import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { OversellError } from '@/lib/portfolio/position';
import {
  recordBuy,
  recordSell,
  listPositions,
  portfolioSummary,
  getTransactionForOwner,
} from '@/lib/portfolio/service';
import { symbols, transactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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
      recordSell(db, userA, 'ITX', { quantity: 6, price: 35, occurredOn: '2026-01-02' }),
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
    await recordSell(db, userA, 'ITX', { quantity: 4, price: 120, occurredOn: '2026-01-05' });

    // Precio de mercado solo para ITX; AAPL sin precio -> plActual null.
    const summary = await portfolioSummary(db, userA, { ITX: 110 });

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

describe('RED-B: precisión con divisiones periódicas (extremo a extremo)', () => {
  it('3 uds + gastos: P/L actual −1.00 exacto y coste medio 100.33', async () => {
    await recordBuy(db, userA, 'REC', 'EUR', {
      quantity: 3,
      price: 100,
      gastos: 1,
      occurredOn: '2026-01-01',
    });
    const summary = await portfolioSummary(db, userA, { REC: 100 });
    const pos = summary.positions.find((p) => p.ticker === 'REC')!;
    expect(pos.costeMedio).toBe('100.33');
    expect(pos.plActual).toBe('-1.00'); // no -0.99999…
    expect(summary.actualTotal).toBe('-1.00');
  });
});
