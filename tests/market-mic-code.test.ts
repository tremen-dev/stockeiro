import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { getOrCreateSymbol } from '@/lib/portfolio/symbols';
import { watchedSymbols, quotes } from '@/db/schema';
import { refreshQuotes } from '@/lib/market/refresh';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

const q = (price: string, currency: string) => ({ price, currency, asOf: '2026-07-13T00:00:00.000Z' });

describe('CA-6: coherencia símbolo↔cotización — se pide por (ticker, micCode) (ADR-007)', () => {
  it('la petición al proveedor incluye el micCode del símbolo', async () => {
    const san = await getOrCreateSymbol(db, 'SAN', 'EUR', { micCode: 'XMAD', exchange: 'BME', name: 'Banco Santander' });
    await db.insert(watchedSymbols).values({ userId: userA, symbolId: san.id });

    const provider = new FakeMarketDataProvider({ 'SAN:XMAD': q('4.20', 'EUR') });
    await refreshQuotes(db, provider);

    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toContainEqual({ ticker: 'SAN', micCode: 'XMAD' });

    const [quote] = await db.select().from(quotes).where(eq(quotes.symbolId, san.id));
    expect(quote.price).toBe('4.20');
    expect(quote.currency).toBe('EUR');
  });

  it('el mismo ticker en dos mercados recibe cada uno el precio y divisa de SU mercado', async () => {
    const sanMad = await getOrCreateSymbol(db, 'SAN', 'EUR', { micCode: 'XMAD', exchange: 'BME', name: 'Santander' });
    const sanNyc = await getOrCreateSymbol(db, 'SAN', 'USD', { micCode: 'XNYS', exchange: 'NYSE', name: 'Santander ADR' });
    expect(sanMad.id).not.toBe(sanNyc.id); // símbolos distintos (identidad por mercado)

    await db.insert(watchedSymbols).values({ userId: userA, symbolId: sanMad.id });
    await db.insert(watchedSymbols).values({ userId: userA, symbolId: sanNyc.id });

    const provider = new FakeMarketDataProvider({
      'SAN:XMAD': q('4.20', 'EUR'),
      'SAN:XNYS': q('4.55', 'USD'),
    });
    await refreshQuotes(db, provider);

    const [madQuote] = await db.select().from(quotes).where(eq(quotes.symbolId, sanMad.id));
    const [nycQuote] = await db.select().from(quotes).where(eq(quotes.symbolId, sanNyc.id));
    expect(madQuote.price).toBe('4.20');
    expect(madQuote.currency).toBe('EUR'); // mercado de Madrid en euros
    expect(nycQuote.price).toBe('4.55');
    expect(nycQuote.currency).toBe('USD'); // ADR de NY en dólares, sin mezclar
  });
});
