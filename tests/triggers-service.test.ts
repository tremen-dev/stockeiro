import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { upsertQuote } from '@/lib/market/quotes';
import {
  evaluateTriggers,
  openTriggersForUser,
  listTriggersForUser,
  getTriggerForOwner,
} from '@/lib/triggers/service';

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

const ASOF = '2026-07-13T00:00:00.000Z';
/** Vigila un ticker con zonas y siembra su cotización (como haría la ingesta). */
async function watchAndQuote(
  userId: string,
  ticker: string,
  zones: { buyMin?: number; buyMax?: number; sellMin?: number; sellMax?: number },
  price: string,
  asOf = ASOF,
) {
  const w = await watchSymbol(db, userId, ticker, 'EUR', zones);
  await upsertQuote(db, w.symbolId, { price, currency: 'EUR', asOf });
  return w;
}

describe('CA-1: disparo al entrar en zona de compra (RN-11)', () => {
  it('precio dentro de [buyMin,buyMax] abre un disparo de compra con precio y asOf', async () => {
    await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');

    const { opened } = await evaluateTriggers(db);
    expect(opened).toHaveLength(1);
    expect(opened[0].zoneKind).toBe('buy');
    expect(opened[0].ticker).toBe('ITX');
    expect(opened[0].price).toBe('22');
    expect(opened[0].asOf.toISOString()).toBe(ASOF);
    expect(await openTriggersForUser(db, userA)).toHaveLength(1);
  });
});

describe('CA-2: disparo al entrar en zona de venta, independiente de compra (RN-11)', () => {
  it('precio en zona de venta abre disparo sell; la de compra no interfiere', async () => {
    await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25, sellMin: 35, sellMax: 40 }, '37');

    const { opened } = await evaluateTriggers(db);
    expect(opened).toHaveLength(1);
    expect(opened[0].zoneKind).toBe('sell');
  });
});

describe('CA-3: no re-disparo mientras permanece dentro; permanencia observable (RN-13)', () => {
  it('dos ciclos dentro de la zona → un solo disparo, pero sigue "en zona"', async () => {
    const w = await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');

    const first = await evaluateTriggers(db);
    expect(first.opened).toHaveLength(1);

    // Segundo ciclo, sigue dentro (mismo/otro precio dentro del rango).
    await upsertQuote(db, w.symbolId, { price: '23', currency: 'EUR', asOf: '2026-07-14T00:00:00.000Z' });
    const second = await evaluateTriggers(db);
    expect(second.opened).toHaveLength(0); // NO re-dispara
    expect(await listTriggersForUser(db, userA)).toHaveLength(1); // sigue habiendo uno
    expect(await openTriggersForUser(db, userA)).toHaveLength(1); // permanencia observable
  });
});

describe('CA-4: re-armado tras salir y volver a entrar (RN-13)', () => {
  it('dentro → fuera (cierra) → dentro otra vez → segundo disparo', async () => {
    const w = await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');
    await evaluateTriggers(db); // abre episodio 1

    await upsertQuote(db, w.symbolId, { price: '30', currency: 'EUR', asOf: '2026-07-14T00:00:00.000Z' });
    const out = await evaluateTriggers(db); // sale de zona → cierra
    expect(out.closed).toHaveLength(1);
    expect(await openTriggersForUser(db, userA)).toHaveLength(0);

    await upsertQuote(db, w.symbolId, { price: '21', currency: 'EUR', asOf: '2026-07-15T00:00:00.000Z' });
    const again = await evaluateTriggers(db); // vuelve a entrar → segundo disparo
    expect(again.opened).toHaveLength(1);
    expect(await listTriggersForUser(db, userA)).toHaveLength(2); // dos episodios en total
  });
});

describe('CA-5: fuera de zona o sin zona no dispara', () => {
  it('sin zona no dispara; con precio fuera del rango tampoco', async () => {
    await watchAndQuote(userA, 'SIN', {}, '99'); // vigilada sin zonas
    await watchAndQuote(userA, 'OUT', { buyMin: 20, buyMax: 25 }, '30'); // fuera de rango

    const { opened } = await evaluateTriggers(db);
    expect(opened).toHaveLength(0);
    expect(await openTriggersForUser(db, userA)).toHaveLength(0);
  });
});

describe('CA-6: límites inclusive y zona de punto único (RN-11)', () => {
  it('precio exactamente en el extremo dispara; zona min=max también', async () => {
    await watchAndQuote(userA, 'EDGE', { buyMin: 20, buyMax: 25 }, '25'); // extremo max
    await watchAndQuote(userB, 'POINT', { sellMin: 20, sellMax: 20 }, '20'); // punto único (venta)

    const { opened } = await evaluateTriggers(db);
    // Un disparo por usuario: EDGE(buy) de A, POINT(sell) de B.
    expect(await openTriggersForUser(db, userA)).toHaveLength(1);
    const b = await openTriggersForUser(db, userB);
    expect(b).toHaveLength(1);
    expect(b[0].zoneKind).toBe('sell');
    expect(opened).toHaveLength(2);
  });
});

describe('CA-8: aislamiento por usuario con símbolo compartido (RN-01)', () => {
  it('mismo símbolo, zonas distintas: solo dispara el usuario cuya zona se cumple', async () => {
    // A y B vigilan el MISMO ITX con zonas distintas; una sola cotización compartida.
    const wA = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    await watchSymbol(db, userB, 'ITX', 'EUR', { buyMin: 30, buyMax: 35 });
    await upsertQuote(db, wA.symbolId, { price: '22', currency: 'EUR', asOf: ASOF }); // en zona de A, no de B

    await evaluateTriggers(db);

    const openA = await openTriggersForUser(db, userA);
    const openB = await openTriggersForUser(db, userB);
    expect(openA).toHaveLength(1);
    expect(openB).toHaveLength(0);

    // B no puede leer el disparo de A por id; A sí el suyo.
    expect(await getTriggerForOwner(db, openA[0].id, userB)).toBeNull();
    expect(await getTriggerForOwner(db, openA[0].id, userA)).not.toBeNull();
  });
});

describe('CA-9: el disparo lleva el asOf de la cotización (D-2)', () => {
  it('persiste el asOf que originó el disparo, disponible para mostrarse', async () => {
    await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22', '2026-07-10T00:00:00.000Z');
    await evaluateTriggers(db);
    const [t] = await openTriggersForUser(db, userA);
    expect(t.asOf.toISOString()).toBe('2026-07-10T00:00:00.000Z');
  });
});
