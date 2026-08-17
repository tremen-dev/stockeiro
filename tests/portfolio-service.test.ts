import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { OversellError } from '@/lib/portfolio/position';
import {
  recordBuy,
  recordSell,
  recordSplit,
  recordDividend,
  listPositions,
  portfolioSummary,
  getTransactionForOwner,
  NoPositionError,
} from '@/lib/portfolio/service';
import { symbols, transactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { symbolId } from './symbol-id';

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

describe('CA-11: símbolo compartido entre usuarios (ADR-002)', () => {
  it('dos usuarios operando el mismo ticker referencian el MISMO símbolo', async () => {
    await recordBuy(db, userA, 'ITX', 'EUR', { quantity: 10, price: 30, occurredOn: '2026-01-01' });
    await recordBuy(db, userB, ' itx ', 'EUR', { quantity: 5, price: 31, occurredOn: '2026-01-02' });

    const rows = await db.select().from(symbols).where(eq(symbols.ticker, 'ITX'));
    expect(rows).toHaveLength(1); // un solo símbolo, no uno por usuario

    const txA = await db.select().from(transactions).where(eq(transactions.userId, userA));
    const txB = await db.select().from(transactions).where(eq(transactions.userId, userB));
    expect(txA[0].symbolId).toBe(txB[0].symbolId);
  });
});

describe('CA-5: no sobreventa (RN-08)', () => {
  it('vender más que la cantidad viva se rechaza y no inserta la venta', async () => {
    await recordBuy(db, userA, 'ITX', 'EUR', { quantity: 5, price: 30, occurredOn: '2026-01-01' });
    await expect(
      recordSell(db, userA, await symbolId(db, 'ITX'), { quantity: 6, price: 35, occurredOn: '2026-01-02' }),
    ).rejects.toBeInstanceOf(OversellError);

    const sells = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userA), eq(transactions.type, 'sell')));
    expect(sells).toHaveLength(0);
  });
});

describe('CA-9: el resumen separa P/L realizado y actual (D-6)', () => {
  it('realizadoTotal y actualTotal son magnitudes SEPARADAS', async () => {
    await recordBuy(db, userA, 'ITX', 'EUR', { quantity: 10, price: 100, occurredOn: '2026-01-01' });
    await recordBuy(db, userA, 'AAPL', 'USD', { quantity: 10, price: 50, occurredOn: '2026-01-01' });
    const itxId = await symbolId(db, 'ITX');
    await recordSell(db, userA, itxId, { quantity: 4, price: 120, occurredOn: '2026-01-05' });

    // Precio de mercado solo para ITX; AAPL sin precio -> plActual null.
    const summary = await portfolioSummary(db, userA, { [itxId]: 110 });

    expect(summary.realizadoTotal).toBe('80.00'); // (120-100)*4, redondeo monetario
    expect(summary.actualTotal).toBe('60.00'); // (110-100)*6, solo ITX priced
    // separados: no es una sola cifra
    expect(summary.realizadoTotal).not.toBe(summary.actualTotal);

    const itx = summary.positions.find((p) => p.ticker === 'ITX')!;
    const aapl = summary.positions.find((p) => p.ticker === 'AAPL')!;
    expect(itx.realizadoPL).toBe('80.00');
    expect(itx.plActual).toBe('60.00');
    expect(aapl.realizadoPL).toBe('0.00');
    expect(aapl.plActual).toBeNull(); // sin precio -> sin dato
  });
});

describe('CA-10: aislamiento por usuario (RN-01)', () => {
  it('B no ve las posiciones de A ni puede leer su transacción por id', async () => {
    const txnA = await recordBuy(db, userA, 'ITX', 'EUR', {
      quantity: 10,
      price: 100,
      occurredOn: '2026-01-01',
    });

    const posB = await listPositions(db, userB);
    expect(posB).toHaveLength(0);

    const asB = await getTransactionForOwner(db, txnA.id, userB);
    expect(asB).toBeNull();

    const asA = await getTransactionForOwner(db, txnA.id, userA);
    expect(asA).not.toBeNull();
  });
});

// ─── SPEC-025 — la operación cae en la posición del MERCADO señalado ────────────
//
// ADR-007: la identidad del símbolo es (ticker, micCode), y ADR-012 documenta el caso
// real: SAN cotiza en BME (EUR) y en NYSE (USD). Resolver la posición por ticker a
// secas falseaba dinero en silencio. La identidad que viaja es `symbolId` (y no el par
// (ticker, micCode)) porque los símbolos legacy tienen micCode NULL — ver CA-7.

const BMEX = { micCode: 'BMEX', exchange: 'BME', name: 'Banco Santander' };
const XNYS = { micCode: 'XNYS', exchange: 'NYSE', name: 'Banco Santander ADR' };

/** Escenario común: `qtyBmex` SAN@BMEX a 10 EUR y `qtyXnys` SAN@XNYS a 13 USD. */
async function dosMercados(userId: string, qtyBmex = 100, qtyXnys = 100) {
  await recordBuy(db, userId, 'SAN', 'EUR', { quantity: qtyBmex, price: 10, occurredOn: '2026-01-01' }, BMEX);
  await recordBuy(db, userId, 'SAN', 'USD', { quantity: qtyXnys, price: 13, occurredOn: '2026-01-02' }, XNYS);
  return { bmex: await symbolId(db, 'SAN', 'BMEX'), xnys: await symbolId(db, 'SAN', 'XNYS') };
}

describe('SPEC-025 CA-1: la venta cae en la posición señalada', () => {
  it('vender 50 sobre el symbolId de XNYS mueve XNYS y deja BMEX intacta', async () => {
    const { bmex, xnys } = await dosMercados(userA);
    expect(bmex).not.toBe(xnys); // dos símbolos distintos (ADR-007)

    const txn = await recordSell(db, userA, xnys, { quantity: 50, price: 14, occurredOn: '2026-02-01' });
    expect(txn.symbolId).toBe(xnys);

    const pos = await listPositions(db, userA);
    const ny = pos.find((p) => p.symbolId === xnys)!;
    const bme = pos.find((p) => p.symbolId === bmex)!;
    expect(ny.cantidadViva).toBe('50');
    expect(ny.currency).toBe('USD');
    expect(ny.realizadoPL).toBe('50.00'); // (14 − 13) × 50, todo en USD (RN-09)
    expect(bme.cantidadViva).toBe('100'); // la de Madrid NO se toca
    expect(bme.realizadoPL).toBe('0.00');
  });
});

describe('SPEC-025 CA-2: RN-08 no rechaza una venta legítima de la otra posición', () => {
  it('con 5 en BMEX y 100 en XNYS, vender 50 de XNYS se registra sin error', async () => {
    const { bmex, xnys } = await dosMercados(userA, 5, 100);

    const txn = await recordSell(db, userA, xnys, { quantity: 50, price: 14, occurredOn: '2026-02-01' });
    expect(txn.symbolId).toBe(xnys);

    const pos = await listPositions(db, userA);
    expect(pos.find((p) => p.symbolId === xnys)!.cantidadViva).toBe('50');
    expect(pos.find((p) => p.symbolId === bmex)!.cantidadViva).toBe('5'); // intacta
  });
});

describe('SPEC-025 CA-3: RN-08 sí rechaza la venta imposible de esa posición', () => {
  it('con 100 en BMEX y 5 en XNYS, vender 50 de XNYS se rechaza sin insertar nada', async () => {
    const { bmex, xnys } = await dosMercados(userA, 100, 5);

    await expect(
      recordSell(db, userA, xnys, { quantity: 50, price: 14, occurredOn: '2026-02-01' }),
    ).rejects.toBeInstanceOf(OversellError);

    const sells = await db.select().from(transactions).where(eq(transactions.type, 'sell'));
    expect(sells).toHaveLength(0); // RN-08: ni una fila

    const pos = await listPositions(db, userA);
    expect(pos.find((p) => p.symbolId === bmex)!.cantidadViva).toBe('100');
    expect(pos.find((p) => p.symbolId === xnys)!.cantidadViva).toBe('5');
  });
});

describe('SPEC-025 CA-4: el split ajusta la posición señalada (RN-07)', () => {
  it('un split 2:1 sobre XNYS duplica XNYS y no toca BMEX', async () => {
    const { bmex, xnys } = await dosMercados(userA);

    const txn = await recordSplit(db, userA, xnys, 2, '2026-03-01');
    expect(txn.symbolId).toBe(xnys);

    const pos = await listPositions(db, userA);
    const ny = pos.find((p) => p.symbolId === xnys)!;
    const bme = pos.find((p) => p.symbolId === bmex)!;
    expect(ny.cantidadViva).toBe('200');
    expect(ny.costeMedio).toBe('6.50'); // 13 ÷ 2 (RN-07: coste total intacto)
    expect(bme.cantidadViva).toBe('100');
    expect(bme.costeMedio).toBe('10.00');
  });
});

describe('SPEC-025 CA-5: el dividendo se cobra en la posición señalada (RN-05)', () => {
  it('un dividendo de 60 sobre XNYS suma al realizado de XNYS y no al de BMEX', async () => {
    const { bmex, xnys } = await dosMercados(userA);

    const txn = await recordDividend(db, userA, xnys, 60, '2026-03-01');
    expect(txn.symbolId).toBe(xnys);

    const pos = await listPositions(db, userA);
    const ny = pos.find((p) => p.symbolId === xnys)!;
    const bme = pos.find((p) => p.symbolId === bmex)!;
    expect(ny.realizadoPL).toBe('60.00');
    expect(ny.cantidadViva).toBe('100'); // ni cantidad…
    expect(ny.costeMedio).toBe('13.00'); // …ni coste base
    expect(bme.realizadoPL).toBe('0.00');
  });
});

describe('SPEC-025 CA-6: un symbolId sin posición del usuario no escribe nada (RN-01)', () => {
  it('A no puede vender, dividir ni cobrar dividendo sobre el símbolo donde solo B tiene posición', async () => {
    await recordBuy(db, userB, 'SAN', 'EUR', { quantity: 100, price: 10, occurredOn: '2026-01-01' }, BMEX);
    // El symbolId NO es un secreto (registro compartido, ADR-002): A lo puede conocer.
    const bmex = await symbolId(db, 'SAN', 'BMEX');

    await expect(
      recordSell(db, userA, bmex, { quantity: 1, price: 14, occurredOn: '2026-02-01' }),
    ).rejects.toBeInstanceOf(NoPositionError);
    await expect(recordSplit(db, userA, bmex, 2, '2026-02-01')).rejects.toBeInstanceOf(NoPositionError);
    await expect(recordDividend(db, userA, bmex, 60, '2026-02-01')).rejects.toBeInstanceOf(NoPositionError);

    const deA = await db.select().from(transactions).where(eq(transactions.userId, userA));
    expect(deA).toHaveLength(0); // ninguna transacción escrita

    // La posición de B sigue exactamente como estaba (afirmado en positivo).
    const posB = await listPositions(db, userB);
    expect(posB).toHaveLength(1);
    expect(posB[0].symbolId).toBe(bmex);
    expect(posB[0].cantidadViva).toBe('100');
    expect(posB[0].costeMedio).toBe('10.00');
    expect(posB[0].realizadoPL).toBe('0.00');
    const deB = await db.select().from(transactions).where(eq(transactions.userId, userB));
    expect(deB).toHaveLength(1);
    expect(deB[0].type).toBe('buy');
  });
});

describe('SPEC-025 CA-7: símbolo legacy con micCode NULL sigue operando', () => {
  it('vender, dividir y cobrar dividendo sobre una posición sin identidad de mercado', async () => {
    // Camino legacy de SPEC-002: recordBuy sin `market` -> símbolo con micCode NULL.
    await recordBuy(db, userA, 'ITX', 'EUR', { quantity: 100, price: 30, occurredOn: '2026-01-01' });
    const itx = await symbolId(db, 'ITX');
    const [sym] = await db.select().from(symbols).where(eq(symbols.id, itx));
    expect(sym.micCode).toBeNull(); // es justo el caso que el par (ticker, micCode) NO identifica

    await recordSell(db, userA, itx, { quantity: 40, price: 35, occurredOn: '2026-02-01' });
    await recordSplit(db, userA, itx, 2, '2026-03-01');
    await recordDividend(db, userA, itx, 12, '2026-04-01');

    const [pos] = await listPositions(db, userA);
    expect(pos.symbolId).toBe(itx);
    expect(pos.micCode).toBeNull();
    expect(pos.cantidadViva).toBe('120'); // 60 tras la venta, ×2 por el split
    expect(pos.costeMedio).toBe('15.00'); // 1800 ÷ 120
    expect(pos.realizadoPL).toBe('212.00'); // (35 − 30) × 40 + 12 de dividendo
  });
});

describe('SPEC-025 CA-12: no queda ningún camino que resuelva la posición por ticker', () => {
  it('getSymbolByTicker no se exporta y no aparece en ningún fichero de src/', async () => {
    const mod = await import('@/lib/portfolio/symbols');
    expect(Object.keys(mod)).not.toContain('getSymbolByTicker');
    // La identidad completa se conserva: son las que sí deben quedar.
    expect(Object.keys(mod)).toEqual(expect.arrayContaining(['getSymbolByMarket', 'getOrCreateSymbol']));

    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && readFileSync(p, 'utf8').includes('getSymbolByTicker')) hits.push(p);
      }
    };
    walk(resolve(process.cwd(), 'src'));
    expect(hits).toEqual([]);
  });
});

describe('RED-B: precisión con divisiones periódicas (extremo a extremo)', () => {
  it('3 uds + gastos: P/L actual −1.00 exacto y coste medio 100.33', async () => {
    await recordBuy(db, userA, 'REC', 'EUR', {
      quantity: 3,
      price: 100,
      gastos: 1,
      occurredOn: '2026-01-01',
    });
    const summary = await portfolioSummary(db, userA, { [await symbolId(db, 'REC')]: 100 });
    const pos = summary.positions.find((p) => p.ticker === 'REC')!;
    expect(pos.costeMedio).toBe('100.33');
    expect(pos.plActual).toBe('-1.00'); // no -0.99999…
    expect(summary.actualTotal).toBe('-1.00');
  });
});
