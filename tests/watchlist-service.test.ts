import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import {
  symbols,
  watchedSymbols,
  zoneTriggers,
  notifications,
  quotes,
  transactions,
  type WatchedSymbol,
} from '@/db/schema';
import {
  watchSymbol,
  listWatched,
  unwatch,
  getWatchedForOwner,
  InvalidZoneError,
} from '@/lib/watchlist/service';
import { upsertQuote } from '@/lib/market/quotes';
import { evaluateTriggers } from '@/lib/triggers/service';
import {
  notifyCycle,
  listNotificationsForUser,
  countUnread,
  markNotificationRead,
} from '@/lib/notifications/service';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';

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
    // SPEC-024: la baja se identifica por el id de la ACCIÓN VIGILADA, no por ticker
    // (ADR-007). Adaptación de la llamada; la expectativa es la misma que en SPEC-003.
    const w = await watchSymbol(db, userA, 'ITX', 'EUR');
    expect(await unwatch(db, userA, w.id)).toBe(true);
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

// =====================================================================================
// SPEC-024 — quitar de vigiladas la acción correcta, haya estado o no en zona.
// Defecto A: la baja rompía (23503) si la acción está o ha estado en zona; ADR-017 mueve
// la semántica al esquema (cascade en episodios, set null en avisos).
// Defecto B: la baja se resolvía por ticker (ADR-007: la identidad es (ticker, micCode)).
// =====================================================================================

const ASOF = new Date('2026-07-13T00:00:00.000Z');

/** Episodio de zona de una acción vigilada; `closedAt` null = abierto (RN-13). */
async function seedTrigger(w: WatchedSymbol, closedAt: Date | null = null) {
  const [t] = await db
    .insert(zoneTriggers)
    .values({
      userId: w.userId,
      watchedSymbolId: w.id,
      symbolId: w.symbolId,
      zoneKind: 'buy',
      price: '22',
      asOf: ASOF,
      closedAt,
    })
    .returning();
  return t;
}

/** Aviso de entrada de un episodio, como lo registra `notifyCycle` (RN-14/RN-15). */
async function seedEntry(userId: string, triggerId: string, payload: string) {
  const [n] = await db
    .insert(notifications)
    .values({
      userId,
      kind: 'entry',
      zoneTriggerId: triggerId,
      payload,
      channel: 'email',
      status: 'sent',
      asOf: ASOF,
    })
    .returning();
  return n;
}

const triggersOf = (watchedId: string) =>
  db.select().from(zoneTriggers).where(eq(zoneTriggers.watchedSymbolId, watchedId));
const notifRow = (id: string) => db.select().from(notifications).where(eq(notifications.id, id));

describe('SPEC-024 CA-1: quitar una vigilada con episodio de zona ABIERTO', () => {
  it('termina sin error, devuelve true y no deja episodios', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    await seedTrigger(w); // está en zona AHORA

    expect(await unwatch(db, userA, w.id)).toBe(true);
    expect(await listWatched(db, userA)).toHaveLength(0);
    expect(await triggersOf(w.id)).toHaveLength(0);
  });
});

describe('SPEC-024 CA-2: quitar una vigilada con episodios CERRADOS y avisos emitidos', () => {
  it('borra vigilada y episodios, y conserva los avisos intactos (RN-15, ADR-017)', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    const t1 = await seedTrigger(w, new Date('2026-07-10T00:00:00.000Z'));
    const t2 = await seedTrigger(w, new Date('2026-07-12T00:00:00.000Z'));
    const n1 = await seedEntry(userA, t1.id, 'ITX en zona de compra @ 22');
    const n2 = await seedEntry(userA, t2.id, 'ITX en zona de compra @ 21');
    await markNotificationRead(db, n1.id, userA); // uno leído, otro no

    const key = (n: { payload: string; kind: string; status: string; asOf: Date; readAt: Date | null }) =>
      [n.payload, n.kind, n.status, n.asOf.toISOString(), n.readAt?.toISOString() ?? null].join('|');
    const before = (await db.select().from(notifications)).map(key).sort();

    expect(await unwatch(db, userA, w.id)).toBe(true);
    expect(await listWatched(db, userA)).toHaveLength(0);
    expect(await triggersOf(w.id)).toHaveLength(0);

    const after = (await db.select().from(notifications)).map(key).sort();
    expect(after).toEqual(before); // payload, kind, status, asOf y readAt sin tocar
    expect((await notifRow(n1.id))[0].zoneTriggerId).toBeNull(); // solo se pierde el vínculo
    expect((await notifRow(n2.id))[0].zoneTriggerId).toBeNull();
  });
});

describe('SPEC-024 CA-3: el aviso huérfano queda legible y contable', () => {
  it('sigue en la bandeja, lo cuenta countUnread y markNotificationRead lo marca', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    const t = await seedTrigger(w);
    const n = await seedEntry(userA, t.id, 'ITX en zona de compra @ 22');

    expect(await unwatch(db, userA, w.id)).toBe(true);

    const list = await listNotificationsForUser(db, userA);
    expect(list.map((x) => x.id)).toContain(n.id);
    expect(list.find((x) => x.id === n.id)!.payload).toBe('ITX en zona de compra @ 22');
    expect(await countUnread(db, userA)).toBe(1);
    expect((await notifRow(n.id))[0].zoneTriggerId).toBeNull();

    expect(await markNotificationRead(db, n.id, userA)).toBe(true);
    expect(await countUnread(db, userA)).toBe(0);
  });
});

describe('SPEC-024 CA-4: varios avisos huérfanos conviven', () => {
  it('dos avisos con zoneTriggerId null no violan notif_entry_trigger', async () => {
    const w1 = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    const w2 = await watchSymbol(db, userA, 'AAPL', 'USD', { buyMin: 10, buyMax: 15 });
    const n1 = await seedEntry(userA, (await seedTrigger(w1)).id, 'ITX en zona de compra @ 22');
    const n2 = await seedEntry(userA, (await seedTrigger(w2)).id, 'AAPL en zona de compra @ 12');

    expect(await unwatch(db, userA, w1.id)).toBe(true);
    expect(await unwatch(db, userA, w2.id)).toBe(true);

    const list = await listNotificationsForUser(db, userA);
    expect(list.map((n) => n.id).sort()).toEqual([n1.id, n2.id].sort()); // ninguno se pierde
    const rows = await db.select().from(notifications);
    expect(rows.every((r) => r.zoneTriggerId === null)).toBe(true); // los NULL no chocan
  });
});

describe('SPEC-024 CA-5: sin daño colateral (otras vigiladas, otros usuarios, cartera)', () => {
  it('solo desaparecen esa vigilada y SUS episodios', async () => {
    const itxA = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    const aaplA = await watchSymbol(db, userA, 'AAPL', 'USD', { buyMin: 10, buyMax: 15 });
    const itxB = await watchSymbol(db, userB, 'ITX', 'EUR', { buyMin: 19, buyMax: 24 });
    for (const w of [itxA, aaplA, itxB]) await seedEntry(w.userId, (await seedTrigger(w)).id, 'aviso');

    // La cartera de A sobre el MISMO símbolo (ADR-002: el símbolo es compartido).
    await upsertQuote(db, itxA.symbolId, { price: '22', currency: 'EUR', asOf: ASOF.toISOString() });
    await db.insert(transactions).values({
      userId: userA,
      symbolId: itxA.symbolId,
      type: 'buy',
      occurredOn: '2026-01-05',
      quantity: '10',
      price: '21',
    });

    expect(await unwatch(db, userA, itxA.id)).toBe(true);

    expect((await listWatched(db, userA)).map((w) => w.id)).toEqual([aaplA.id]);
    expect(await triggersOf(itxA.id)).toHaveLength(0);
    expect(await triggersOf(aaplA.id)).toHaveLength(1); // la otra de A conserva los suyos
    expect(await triggersOf(itxB.id)).toHaveLength(1); // RN-01: B intacto
    expect((await listWatched(db, userB)).map((w) => w.id)).toEqual([itxB.id]);
    expect(await db.select().from(notifications)).toHaveLength(3); // ningún aviso se pierde

    // Símbolo compartido, cotización y cartera: sin tocar (ADR-002).
    expect(await db.select().from(symbols).where(eq(symbols.id, itxA.symbolId))).toHaveLength(1);
    expect(await db.select().from(quotes).where(eq(quotes.symbolId, itxA.symbolId))).toHaveLength(1);
    expect(await db.select().from(transactions).where(eq(transactions.userId, userA))).toHaveLength(1);
  });
});

describe('SPEC-024 CA-6: re-vigilar un ticker que se quitó vuelve a avisar', () => {
  it('nueva vigilada, episodio nuevo y aviso de entrada nuevo (decisión del gate)', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    await upsertQuote(db, w.symbolId, { price: '22', currency: 'EUR', asOf: ASOF.toISOString() });
    await evaluateTriggers(db);
    const first = await notifyCycle(db, new FakeNotificationSender(), { cycleRef: '2026-07-13' });
    expect(first.entries).toHaveLength(1);

    expect(await unwatch(db, userA, w.id)).toBe(true);

    // Vuelve a vigilarla con las MISMAS zonas; el precio nunca salió de la zona.
    const w2 = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    expect(w2.id).not.toBe(w.id); // vigilada NUEVA, sin episodios heredados
    expect(await triggersOf(w2.id)).toHaveLength(0);

    const evaluated = await evaluateTriggers(db);
    expect(evaluated.opened).toHaveLength(1); // el motor re-arma el disparo
    const second = await notifyCycle(db, new FakeNotificationSender(), { cycleRef: '2026-07-14' });
    expect(second.entries).toHaveLength(1); // y vuelve a avisar
    expect(await listNotificationsForUser(db, userA)).toHaveLength(4); // 2 entradas + 2 digest
  });
});

describe('SPEC-024 CA-8: la invariante vive en el esquema, no en el servicio', () => {
  it('un DELETE directo sobre watched_symbols tampoco falla', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    const t = await seedTrigger(w);
    const n = await seedEntry(userA, t.id, 'ITX en zona de compra @ 22');

    // Sin pasar por `unwatch`: cualquier camino de borrado hereda la semántica (ADR-017).
    await db.delete(watchedSymbols).where(eq(watchedSymbols.id, w.id));

    expect(await triggersOf(w.id)).toHaveLength(0);
    expect((await notifRow(n.id))[0].zoneTriggerId).toBeNull();
    expect((await notifRow(n.id))[0].payload).toBe('ITX en zona de compra @ 22');
  });
});

describe('SPEC-024 CA-10: mismo ticker en dos mercados, se quita el señalado (ADR-007)', () => {
  it('desaparece exactamente esa vigilada y la del otro mercado sigue intacta', async () => {
    const bme = await watchSymbol(db, userA, 'SAN', 'EUR', { buyMin: 10, buyMax: 12 }, { micCode: 'BMEX', exchange: 'BME' });
    const nyse = await watchSymbol(db, userA, 'SAN', 'USD', { buyMin: 13, buyMax: 14 }, { micCode: 'XNYS', exchange: 'NYSE' });
    expect(bme.symbolId).not.toBe(nyse.symbolId); // dos símbolos distintos (ADR-007)
    await upsertQuote(db, bme.symbolId, { price: '11.9', currency: 'EUR', asOf: ASOF.toISOString() });
    await upsertQuote(db, nyse.symbolId, { price: '13.6', currency: 'USD', asOf: ASOF.toISOString() });

    expect(await unwatch(db, userA, nyse.id)).toBe(true);

    const list = await listWatched(db, userA);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(bme.id);
    expect([list[0].buyMin, list[0].buyMax]).toEqual(['10', '12']); // zonas intactas
    // Los símbolos compartidos y sus cotizaciones no se tocan (ADR-002).
    expect(await db.select().from(symbols).where(eq(symbols.ticker, 'SAN'))).toHaveLength(2);
    expect(await db.select().from(quotes)).toHaveLength(2);
  });
});

describe('SPEC-024 CA-11: un id ajeno no borra nada (RN-01 sobre la clave nueva)', () => {
  it('devuelve false, no borra, y es indistinguible de un id inexistente', async () => {
    const wB = await watchSymbol(db, userB, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    const tB = await seedTrigger(wB);

    // A pide quitar el id REAL de la vigilada de B (id válido, llegado por manipulación).
    expect(await unwatch(db, userA, wB.id)).toBe(false);
    // Mismo resultado que un id inexistente: no se revela que ese id existe.
    expect(await unwatch(db, userA, '00000000-0000-4000-8000-000000000000')).toBe(false);

    expect(await listWatched(db, userB)).toHaveLength(1);
    const [row] = await db.select().from(watchedSymbols).where(eq(watchedSymbols.id, wB.id));
    expect([row.buyMin, row.buyMax]).toEqual(['20', '25']); // zonas intactas
    expect((await triggersOf(wB.id)).map((t) => t.id)).toEqual([tB.id]); // episodios intactos
  });
});

describe('SPEC-024 CA-12: id inexistente o ausente: sin efecto y sin excepción', () => {
  it('devuelve false sin lanzar y deja la lista intacta', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR');

    expect(await unwatch(db, userA, '00000000-0000-4000-8000-000000000000')).toBe(false);
    expect(await unwatch(db, userA, '')).toBe(false); // formulario sin el campo
    expect(await unwatch(db, userA, 'no-es-un-uuid')).toBe(false); // campo manipulado

    expect((await listWatched(db, userA)).map((x) => x.id)).toEqual([w.id]);
  });
});
