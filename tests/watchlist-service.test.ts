import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { symbols, watchedSymbols } from '@/db/schema';
import {
  watchSymbol,
  listWatched,
  unwatch,
  getWatchedForOwner,
  InvalidZoneError,
} from '@/lib/watchlist/service';

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

describe('CA-1: vigilar sin zona', () => {
  it('crea la acción vigilada sin zonas', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR');
    const list = await listWatched(db, userA);
    expect(list).toHaveLength(1);
    expect(list[0].ticker).toBe('ITX');
    expect(list[0].buyMin).toBeNull();
    expect(list[0].sellMax).toBeNull();
  });
});

describe('CA-2: vigilar con zonas de compra y/o venta', () => {
  it('guarda los rangos tal cual', async () => {
    await watchSymbol(db, userA, 'AAPL', 'USD', {
      buyMin: 150,
      buyMax: 160,
      sellMin: 200,
      sellMax: 210,
    });
    const [w] = await listWatched(db, userA);
    expect(w.buyMin).toBe('150');
    expect(w.buyMax).toBe('160');
    expect(w.sellMin).toBe('200');
    expect(w.sellMax).toBe('210');
  });
});

describe('CA-3: rango inválido rechazado (RN-10)', () => {
  it('min > max se rechaza y no guarda', async () => {
    await expect(
      watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 10 }),
    ).rejects.toBeInstanceOf(InvalidZoneError);
    expect(await listWatched(db, userA)).toHaveLength(0);
  });

  it('par incompleto (solo min) se rechaza', async () => {
    await expect(
      watchSymbol(db, userA, 'ITX', 'EUR', { sellMin: 100 }),
    ).rejects.toBeInstanceOf(InvalidZoneError);
  });
});

describe('CA-4 / CA-10: upsert por (userId, símbolo)', () => {
  it('vigilar el mismo ticker de nuevo actualiza zonas sin duplicar', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 18, buyMax: 22, sellMin: 30, sellMax: 33 });

    const list = await listWatched(db, userA);
    expect(list).toHaveLength(1); // no duplica
    expect(list[0].buyMin).toBe('18');
    expect(list[0].sellMin).toBe('30');
  });
});

describe('CA-5: dejar de vigilar', () => {
  it('quita la acción de la lista', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR');
    expect(await unwatch(db, userA, 'ITX')).toBe(true);
    expect(await listWatched(db, userA)).toHaveLength(0);
  });
});

describe('CA-8: símbolo compartido (ADR-002)', () => {
  it('dos usuarios vigilando el mismo ticker comparten símbolo', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR');
    await watchSymbol(db, userB, ' itx ', 'EUR');
    const syms = await db.select().from(symbols).where(eq(symbols.ticker, 'ITX'));
    expect(syms).toHaveLength(1);
    const wA = await db.select().from(watchedSymbols).where(eq(watchedSymbols.userId, userA));
    const wB = await db.select().from(watchedSymbols).where(eq(watchedSymbols.userId, userB));
    expect(wA[0].symbolId).toBe(wB[0].symbolId);
  });
});

describe('CA-9: aislamiento por usuario (RN-01)', () => {
  it('B no ve la watchlist de A ni su entrada por id', async () => {
    const wA = await watchSymbol(db, userA, 'ITX', 'EUR');
    expect(await listWatched(db, userB)).toHaveLength(0);
    expect(await getWatchedForOwner(db, wA.id, userB)).toBeNull();
    expect(await getWatchedForOwner(db, wA.id, userA)).not.toBeNull();
  });
});
