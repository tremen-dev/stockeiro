import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { recordBuy, recordSplit, portfolioSummary, listPositions } from '@/lib/portfolio/service';
import { watchSymbol } from '@/lib/watchlist/service';
import { refreshQuotes } from '@/lib/market/refresh';
import {
  getDiagnosticMap,
  getPriceMap,
  getQuoteByTicker,
  upsertDiagnostic,
  upsertQuote,
} from '@/lib/market/quotes';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';
import { symbolId } from './symbol-id';

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

describe('CA-4: la cotización ingerida alimenta el P/L actual (CE-3, RN-06)', () => {
  it('con precio ingerido, plActual deja de ser "—" = (precio − coste medio) × cantidad viva', async () => {
    await recordBuy(db, userA, 'ITX', 'EUR', { quantity: 10, price: 100, occurredOn: '2026-01-01' });

    // Sin ingesta todavía: P/L actual sin dato.
    const before = await portfolioSummary(db, userA, await getPriceMap(db));
    expect(before.positions[0].plActual).toBeNull();

    // Se ingiere ITX a 110.
    await refreshQuotes(db, new FakeMarketDataProvider({ ITX: { price: '110', currency: 'EUR', asOf: '2026-07-13T00:00:00.000Z' } }));

    const after = await portfolioSummary(db, userA, await getPriceMap(db));
    const itx = after.positions.find((p) => p.ticker === 'ITX')!;
    expect(itx.plActual).toBe('100.00'); // (110-100)*10
    expect(after.actualTotal).toBe('100.00');
  });
});

describe('CA-5: base NO ajustada + asOf (RN-12, D-2)', () => {
  it('persiste y expone el último precio no ajustado con su asOf; no se ajusta por splits', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR');
    await refreshQuotes(
      db,
      new FakeMarketDataProvider({ ITX: { price: '123.45', currency: 'EUR', asOf: '2026-07-13T00:00:00.000Z' } }),
    );

    const quote = await getQuoteByTicker(db, 'ITX');
    expect(quote).not.toBeNull();
    expect(quote!.price).toBe('123.45'); // exactamente lo que dio el proveedor (no ajustado)
    expect(quote!.currency).toBe('EUR');
    expect(quote!.asOf.toISOString().slice(0, 10)).toBe('2026-07-13'); // asOf disponible para mostrarse

    // Un split en la cartera NO altera la cotización ingerida (la serie no se ajusta, RN-12).
    await recordBuy(db, userA, 'ITX', 'EUR', { quantity: 10, price: 100, occurredOn: '2026-01-01' });
    await recordSplit(db, userA, 'ITX', 2, '2026-02-01');
    const stillRaw = await getQuoteByTicker(db, 'ITX');
    expect(stillRaw!.price).toBe('123.45'); // intacta pese al split
  });
});

// ─── SPEC-025 — cada posición se valora con el precio de SU mercado ─────────────
//
// ADR-004 ya guarda una cotización por `symbolId`; el colapso lo introducía el mapa
// (Record<ticker, precio>), que con dos mercados del mismo ticker deja UNA clave.

const BMEX = { micCode: 'BMEX', exchange: 'BME', name: 'Banco Santander' };
const XNYS = { micCode: 'XNYS', exchange: 'NYSE', name: 'Banco Santander ADR' };

/** 100 SAN@BMEX a 10 EUR y 100 SAN@XNYS a 13 USD (ADR-012, caso real medido). */
async function dosMercadosSAN(userId: string) {
  await recordBuy(db, userId, 'SAN', 'EUR', { quantity: 100, price: 10, occurredOn: '2026-01-01' }, BMEX);
  await recordBuy(db, userId, 'SAN', 'USD', { quantity: 100, price: 13, occurredOn: '2026-01-02' }, XNYS);
  return { bmex: await symbolId(db, 'SAN', 'BMEX'), xnys: await symbolId(db, 'SAN', 'XNYS') };
}

describe('SPEC-025 CA-9: el P/L actual usa el precio del mercado de la posición (RN-06)', () => {
  it('BMEX a 11,98 da 198,00 y XNYS a 13,63 da 63,00 — no 363,00 en las dos', async () => {
    const { bmex, xnys } = await dosMercadosSAN(userA);
    await upsertQuote(db, bmex, { price: '11.98', currency: 'EUR', asOf: '2026-02-01T00:00:00.000Z' });
    await upsertQuote(db, xnys, { price: '13.63', currency: 'USD', asOf: '2026-02-01T00:00:00.000Z' });

    const map = await getPriceMap(db);
    expect(Object.keys(map).sort()).toEqual([bmex, xnys].sort()); // una clave por SÍMBOLO
    expect(map[bmex]).toBe('11.98');
    expect(map[xnys]).toBe('13.63');

    const pos = await listPositions(db, userA, map);
    const bme = pos.find((p) => p.symbolId === bmex)!;
    const ny = pos.find((p) => p.symbolId === xnys)!;
    expect(bme.plActual).toBe('198.00'); // (11,98 − 10) × 100
    expect(bme.plActual).not.toBe('363.00'); // el valor que daba con el precio de NYSE
    expect(ny.plActual).toBe('63.00'); // (13,63 − 13) × 100
    expect(bme.currency).toBe('EUR');
    expect(ny.currency).toBe('USD');
  });
});

describe('SPEC-025 CA-10: el motivo de "sin cotización" es el del símbolo que no cotiza', () => {
  it('solo XNYS falla: el aviso va con XNYS y BMEX no muestra motivo alguno', async () => {
    const { bmex, xnys } = await dosMercadosSAN(userA);
    await upsertQuote(db, bmex, { price: '11.98', currency: 'EUR', asOf: '2026-02-01T00:00:00.000Z' });
    await upsertDiagnostic(db, xnys, 'mercado_no_cubierto');

    const diag = await getDiagnosticMap(db);
    expect(diag[xnys].reason).toBe('mercado_no_cubierto');
    expect(diag[xnys].symbolId).toBe(xnys);
    expect(diag[xnys].ticker).toBe('SAN');
    expect(diag[bmex]).toBeUndefined(); // el que cotiza NO hereda el motivo del otro

    // Y en la cartera cada fila cuenta su propia verdad (RN-06 + CE-F2).
    const pos = await listPositions(db, userA, await getPriceMap(db));
    expect(pos.find((p) => p.symbolId === bmex)!.plActual).toBe('198.00');
    expect(pos.find((p) => p.symbolId === xnys)!.plActual).toBeNull();
  });
});
