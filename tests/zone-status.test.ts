import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { upsertQuote } from '@/lib/market/quotes';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

async function watchAndMaybeQuote(userId: string, ticker: string, zone: any, price?: string) {
  const w = await watchSymbol(db, userId, ticker, 'EUR', zone);
  if (price != null) await upsertQuote(db, w.symbolId, { price, currency: 'EUR', asOf: '2026-07-13T00:00:00.000Z' });
  return w;
}
const byTicker = (list: Awaited<ReturnType<typeof zoneStatusForUser>>, t: string) => list.find((x) => x.ticker === t)!;

describe('CA-1/CA-3: estado de zona según la última cotización (RN-11)', () => {
  it('clasifica dentro-compra, dentro-venta, ambas y fuera', async () => {
    await watchAndMaybeQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22'); // buy
    await watchAndMaybeQuote(userA, 'MSFT', { sellMin: 35, sellMax: 40 }, '37'); // sell
    await watchAndMaybeQuote(userA, 'TSLA', { buyMin: 20, buyMax: 30, sellMin: 25, sellMax: 35 }, '28'); // both
    await watchAndMaybeQuote(userA, 'NKE', { buyMin: 20, buyMax: 25 }, '30'); // out

    const list = await zoneStatusForUser(db, userA);
    expect(byTicker(list, 'ITX').state).toBe('buy');
    expect(byTicker(list, 'ITX').asOf?.toISOString()).toBe('2026-07-13T00:00:00.000Z'); // CA-4
    expect(byTicker(list, 'MSFT').state).toBe('sell');
    expect(byTicker(list, 'TSLA').state).toBe('both');
    expect(byTicker(list, 'TSLA').inBuy && byTicker(list, 'TSLA').inSell).toBe(true);
    expect(byTicker(list, 'NKE').state).toBe('out');
  });
});

describe('CA-2: sin cotización → estado neutro', () => {
  it('una acción sin cotización queda en "none" con price null (no asume 0)', async () => {
    await watchAndMaybeQuote(userA, 'AAPL', { buyMin: 10, buyMax: 15 }); // sin quote
    const [aapl] = await zoneStatusForUser(db, userA);
    expect(aapl.state).toBe('none');
    expect(aapl.hasQuote).toBe(false);
    expect(aapl.price).toBeNull();
    expect(aapl.asOf).toBeNull();
  });
});

describe('CA-5: aislamiento del estado (RN-01)', () => {
  it('un usuario solo ve el estado de sus acciones', async () => {
    await watchAndMaybeQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');
    await watchAndMaybeQuote(userB, 'MSFT', { buyMin: 20, buyMax: 25 }, '22');

    const a = await zoneStatusForUser(db, userA);
    const b = await zoneStatusForUser(db, userB);
    expect(a.map((x) => x.ticker)).toEqual(['ITX']);
    expect(b.map((x) => x.ticker)).toEqual(['MSFT']);
  });
});
