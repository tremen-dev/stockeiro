import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { recordBuy } from '@/lib/portfolio/service';
import { watchSymbol } from '@/lib/watchlist/service';
import { symbols, quotes } from '@/db/schema';
import { symbolUniverse, refreshQuotes } from '@/lib/market/refresh';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

const q = (price: string, asOf = '2026-07-13T00:00:00.000Z', currency = 'EUR') => ({ price, currency, asOf });

describe('CA-1: dedupe 1-símbolo-1-llamada (ADR-002)', () => {
  it('un símbolo referenciado por varios usuarios se pide UNA sola vez', async () => {
    // A lo vigila, B lo tiene en cartera: mismo símbolo compartido, dos referencias.
    await watchSymbol(db, userA, 'ITX', 'EUR');
    await recordBuy(db, userB, 'ITX', 'EUR', { quantity: 5, price: 30, occurredOn: '2026-01-01' });

    const provider = new FakeMarketDataProvider({ ITX: q('31') });
    await refreshQuotes(db, provider);

    expect(provider.calls).toHaveLength(1); // una sola llamada al proveedor por ciclo
    const requested = provider.calls[0].map((r) => r.ticker); // peticiones -> tickers (ADR-007)
    expect(requested.filter((t) => t === 'ITX')).toHaveLength(1); // ITX una vez, sin duplicar
    expect(new Set(requested).size).toBe(requested.length); // conjunto sin duplicados
  });
});

describe('CA-2: universo = unión distinct de watchlist ∪ transacciones', () => {
  it('pide la unión de símbolos referenciados; ignora los no referenciados', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR'); // watchlist A
    await recordBuy(db, userA, 'AAPL', 'USD', { quantity: 1, price: 100, occurredOn: '2026-01-01' }); // cartera A
    await recordBuy(db, userB, 'ITX', 'EUR', { quantity: 2, price: 30, occurredOn: '2026-01-02' }); // cartera B (mismo ITX)
    await watchSymbol(db, userB, 'MSFT', 'USD'); // watchlist B
    // Símbolo huérfano: existe en el registro pero nadie lo referencia -> NO se pide.
    await db.insert(symbols).values({ ticker: 'ORPHAN', currency: 'USD' });

    const universe = await symbolUniverse(db);
    const tickers = universe.map((u) => u.ticker).sort();
    expect(tickers).toEqual(['AAPL', 'ITX', 'MSFT']); // unión distinct, sin ORPHAN

    const provider = new FakeMarketDataProvider({ ITX: q('31'), AAPL: q('101', undefined, 'USD'), MSFT: q('201', undefined, 'USD') });
    const result = await refreshQuotes(db, provider);
    expect(result.requested.sort()).toEqual(['AAPL', 'ITX', 'MSFT']);
    expect(result.requested).not.toContain('ORPHAN');
  });
});

describe('CA-3: persistencia de la cotización (upsert por símbolo, ADR-004)', () => {
  it('guarda la última cotización; un 2º refresco la actualiza, no la duplica', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR');
    const [sym] = await db.select().from(symbols).where(eq(symbols.ticker, 'ITX'));

    await refreshQuotes(db, new FakeMarketDataProvider({ ITX: q('31.50') }));
    let rows = await db.select().from(quotes).where(eq(quotes.symbolId, sym.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].price).toBe('31.50');

    // Segundo ciclo con precio distinto: misma fila actualizada.
    await refreshQuotes(db, new FakeMarketDataProvider({ ITX: q('32.10', '2026-07-14T00:00:00.000Z') }));
    rows = await db.select().from(quotes).where(eq(quotes.symbolId, sym.id));
    expect(rows).toHaveLength(1); // NO duplica
    expect(rows[0].price).toBe('32.10'); // actualizada
  });
});

describe('CA-6: resiliencia por símbolo (ADR-004)', () => {
  it('si el proveedor falla para un símbolo, ese se salta y los demás se actualizan', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR');
    await watchSymbol(db, userA, 'AAPL', 'USD');

    // El fake NO tiene precio para AAPL -> lo omite (fallo simulado).
    const provider = new FakeMarketDataProvider({ ITX: q('31') });
    const result = await refreshQuotes(db, provider);

    expect(result.updated).toEqual(['ITX']);
    expect(result.skipped).toEqual(['AAPL']);

    const [itx] = await db.select().from(symbols).where(eq(symbols.ticker, 'ITX'));
    const [aapl] = await db.select().from(symbols).where(eq(symbols.ticker, 'AAPL'));
    expect(await db.select().from(quotes).where(eq(quotes.symbolId, itx.id))).toHaveLength(1);
    expect(await db.select().from(quotes).where(eq(quotes.symbolId, aapl.id))).toHaveLength(0); // sin actualizar
  });
});
