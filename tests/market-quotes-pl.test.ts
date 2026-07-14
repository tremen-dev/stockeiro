import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { recordBuy, recordSplit, portfolioSummary } from '@/lib/portfolio/service';
import { watchSymbol } from '@/lib/watchlist/service';
import { refreshQuotes } from '@/lib/market/refresh';
import { getPriceMap, getQuoteByTicker } from '@/lib/market/quotes';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';

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
