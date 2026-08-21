import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import {
  watchedSymbols,
  zoneTriggers,
  notifications,
  type WatchedSymbol,
} from '@/db/schema';
import {
  watchSymbol,
  updateWatchedZones,
  unwatch,
  listWatched,
  InvalidZoneError,
} from '@/lib/watchlist/service';
import { readDecimalField } from '@/lib/format/decimal-input';
import { markNotificationRead } from '@/lib/notifications/service';

/**
 * SPEC-044 — **editar las zonas en sitio**, rebanadas 1, 3 y 4.
 *
 * El defecto que arregla esta spec no vivía en el motor de disparo: vivía en el `DELETE`.
 * Mover un rango obligaba a quitar y volver a vigilar, y `zone_triggers` cae en cascada
 * (ADR-017), así que el episodio desaparecía, el ciclo siguiente leía **entrada** y salía
 * un correo por un gesto que no significa nada para el mercado.
 *
 * Aquí se prueba la operación de edición: que conserva la fila (CA-1..CA-4), que no es una
 * puerta trasera de validación (CA-11..CA-13, CA-15) y que identifica y aísla por id con el
 * `userId` dentro del `WHERE` (CA-16..CA-18). La continuidad del episodio a través del
 * ciclo es de `spec044-continuidad-episodio.test.ts`.
 */

const ASOF = new Date('2026-07-13T00:00:00.000Z');

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

const filaDe = async (id: string) =>
  (await db.select().from(watchedSymbols).where(eq(watchedSymbols.id, id)))[0];

const zonasDe = (w: {
  buyMin: string | null;
  buyMax: string | null;
  sellMin: string | null;
  sellMax: string | null;
}) => [w.buyMin, w.buyMax, w.sellMin, w.sellMax];

/** Episodio de zona de una vigilada; `closedAt` null = abierto (RN-13). */
async function sembrarEpisodio(w: WatchedSymbol, closedAt: Date | null = null) {
  const [t] = await db
    .insert(zoneTriggers)
    .values({
      userId: w.userId,
      watchedSymbolId: w.id,
      symbolId: w.symbolId,
      zoneKind: 'buy',
      price: '13',
      asOf: ASOF,
      closedAt,
    })
    .returning();
  return t;
}

/** Aviso de entrada de un episodio, como lo registra `notifyCycle` (RN-14/RN-15). */
async function sembrarAviso(userId: string, triggerId: string, payload: string) {
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

/* ────────────────────────────────────────────────────────────────────────────
   Rebanada 1 — editar no destruye nada (CE-1)
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-044 CA-1: edición en sitio de los cuatro valores', () => {
  it('la MISMA fila cambia de valores conservando id, userId, symbolId y createdAt', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', {
      buyMin: 12,
      buyMax: 14,
      sellMin: 20,
      sellMax: 22,
    });
    const antes = await filaDe(w.id);

    const actualizada = await updateWatchedZones(db, userA, w.id, {
      buyMin: 11,
      buyMax: 13,
      sellMin: 19,
      sellMax: 21,
    });

    expect(actualizada).not.toBeNull();
    expect(zonasDe(actualizada!)).toEqual(['11', '13', '19', '21']);

    const despues = await filaDe(w.id);
    expect(despues.id).toBe(antes.id);
    expect(despues.userId).toBe(antes.userId);
    expect(despues.symbolId).toBe(antes.symbolId);
    expect(despues.createdAt.toISOString()).toBe(antes.createdAt.toISOString());
  });

  it('el recuento de filas de watched_symbols no cambia: ni inserta ni borra', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    await watchSymbol(db, userB, 'ITX', 'EUR', { buyMin: 1, buyMax: 2 });
    const antes = (await db.select().from(watchedSymbols)).length;

    await updateWatchedZones(db, userA, w.id, { buyMin: 11, buyMax: 13 });

    expect((await db.select().from(watchedSymbols)).length).toBe(antes);
  });
});

describe('SPEC-044 CA-2: vaciar una zona entera es una edición válida (RN-10)', () => {
  it('vaciar la compra deja la venta intacta y la vigilada sigue vigilando la venta', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', {
      buyMin: 12,
      buyMax: 14,
      sellMin: 20,
      sellMax: 22,
    });

    await updateWatchedZones(db, userA, w.id, {
      buyMin: null,
      buyMax: null,
      sellMin: 20,
      sellMax: 22,
    });

    const fila = await filaDe(w.id);
    expect(fila.buyMin).toBeNull();
    expect(fila.buyMax).toBeNull();
    expect([fila.sellMin, fila.sellMax]).toEqual(['20', '22']);
    expect(await listWatched(db, userA)).toHaveLength(1); // sigue existiendo: no es una baja
  });

  it('un campo VACÍO del formulario también vacía la zona (ausencia, no "sin cambio")', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    const fd = new FormData();
    for (const campo of ['buyMin', 'buyMax', 'sellMin', 'sellMax']) fd.set(campo, '');

    await updateWatchedZones(db, userA, w.id, {
      buyMin: readDecimalField(fd, 'buyMin'),
      buyMax: readDecimalField(fd, 'buyMax'),
      sellMin: readDecimalField(fd, 'sellMin'),
      sellMax: readDecimalField(fd, 'sellMax'),
    });

    expect(zonasDe(await filaDe(w.id))).toEqual([null, null, null, null]);
  });

  it('vaciar las CUATRO deja la vigilada sin zonas, sin ser una baja', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', {
      buyMin: 12,
      buyMax: 14,
      sellMin: 20,
      sellMax: 22,
    });

    await updateWatchedZones(db, userA, w.id, {});

    expect(zonasDe(await filaDe(w.id))).toEqual([null, null, null, null]);
    expect((await listWatched(db, userA)).map((x) => x.id)).toEqual([w.id]);
  });
});

describe('SPEC-044 CA-3: los episodios y los avisos siguen siendo suyos', () => {
  it('zone_triggers y notifications quedan byte a byte como estaban', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    const abierto = await sembrarEpisodio(w, null);
    const cerrado = await sembrarEpisodio(w, new Date('2026-07-10T00:00:00.000Z'));
    await sembrarAviso(userA, abierto.id, 'ITX en zona de compra @ 13');
    const n2 = await sembrarAviso(userA, cerrado.id, 'ITX en zona de compra @ 12,5');
    await markNotificationRead(db, n2.id, userA); // uno leído, otro no

    const claveEpisodio = (t: (typeof abierto)) =>
      [
        t.id,
        t.openedAt.toISOString(),
        t.closedAt?.toISOString() ?? null,
        t.price,
        t.asOf.toISOString(),
      ].join('|');
    const claveAviso = (n: (typeof n2)) =>
      [n.id, n.zoneTriggerId, n.payload, n.readAt?.toISOString() ?? null, n.status].join('|');

    const episodiosAntes = (await db.select().from(zoneTriggers)).map(claveEpisodio).sort();
    const avisosAntes = (await db.select().from(notifications)).map(claveAviso).sort();

    await updateWatchedZones(db, userA, w.id, { buyMin: 1, buyMax: 2, sellMin: 30, sellMax: 40 });

    expect((await db.select().from(zoneTriggers)).map(claveEpisodio).sort()).toEqual(
      episodiosAntes,
    );
    expect((await db.select().from(notifications)).map(claveAviso).sort()).toEqual(avisosAntes);
  });
});

describe('SPEC-044 CA-4: editar y borrar+recrear dejan de ser el mismo camino', () => {
  it('la editada conserva id, createdAt y su episodio; la recreada no conserva nada', async () => {
    // Dos vigiladas EQUIVALENTES del mismo usuario, cada una con episodio y aviso.
    const editada = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    const recreada = await watchSymbol(db, userA, 'TEF', 'EUR', { buyMin: 12, buyMax: 14 });
    const epEditada = await sembrarEpisodio(editada);
    const epRecreada = await sembrarEpisodio(recreada);
    await sembrarAviso(userA, epEditada.id, 'ITX en zona de compra @ 13');
    await sembrarAviso(userA, epRecreada.id, 'TEF en zona de compra @ 13');

    // Camino A: editar. Camino B: unwatch + volver a vigilar con LAS MISMAS zonas.
    await updateWatchedZones(db, userA, editada.id, { buyMin: 12, buyMax: 14.5 });
    await unwatch(db, userA, recreada.id);
    const renacida = await watchSymbol(db, userA, 'TEF', 'EUR', { buyMin: 12, buyMax: 14.5 });

    // La editada: misma fila, misma edad, mismo episodio.
    const filaEditada = await filaDe(editada.id);
    expect(filaEditada.id).toBe(editada.id);
    expect(filaEditada.createdAt.toISOString()).toBe(editada.createdAt.toISOString());
    const episodiosEditada = await db
      .select()
      .from(zoneTriggers)
      .where(eq(zoneTriggers.watchedSymbolId, editada.id));
    expect(episodiosEditada.map((t) => t.id)).toEqual([epEditada.id]);

    // La recreada: id nuevo, createdAt nuevo, cero episodios. Ésta ES la medida de CE-1.
    expect(renacida.id).not.toBe(recreada.id);
    expect(renacida.createdAt.getTime()).toBeGreaterThanOrEqual(recreada.createdAt.getTime());
    expect(await filaDe(recreada.id)).toBeUndefined();
    expect(
      await db.select().from(zoneTriggers).where(eq(zoneTriggers.watchedSymbolId, renacida.id)),
    ).toHaveLength(0);
    // Y su aviso quedó huérfano (ADR-017), que es la otra mitad del daño.
    const avisosHuerfanos = (await db.select().from(notifications)).filter(
      (n) => n.zoneTriggerId === null,
    );
    expect(avisosHuerfanos).toHaveLength(1);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   Rebanada 3 — la edición no es una puerta trasera de validación
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-044 CA-11: coma decimal, la misma puerta que el alta (SPEC-030)', () => {
  const leer = (valores: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(valores)) fd.set(k, v);
    return {
      buyMin: readDecimalField(fd, 'buyMin'),
      buyMax: readDecimalField(fd, 'buyMax'),
    };
  };

  it('"12,5" se guarda como 12.5', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 1, buyMax: 2 });
    await updateWatchedZones(db, userA, w.id, leer({ buyMin: '12,5', buyMax: '13' }));
    const fila = await filaDe(w.id);
    expect([fila.buyMin, fila.buyMax]).toEqual(['12.5', '13']);
  });

  it('"1 234,56" se guarda como 1234.56 y "1,234" se rechaza por ambiguo', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 1, buyMax: 2 });
    await updateWatchedZones(db, userA, w.id, leer({ buyMin: '1 234,56', buyMax: '2000' }));
    expect((await filaDe(w.id)).buyMin).toBe('1234.56');

    expect(() => leer({ buyMin: '1,234', buyMax: '2000' })).toThrow(/ambiguo/);
  });
});

describe('SPEC-044 CA-12: min > max se rechaza y no se guarda nada (RN-10)', () => {
  it('lanza InvalidZoneError y la fila queda con sus valores ANTERIORES', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', {
      buyMin: 12,
      buyMax: 14,
      sellMin: 20,
      sellMax: 22,
    });

    await expect(
      updateWatchedZones(db, userA, w.id, {
        buyMin: 30,
        buyMax: 10,
        sellMin: 20,
        sellMax: 22,
      }),
    ).rejects.toBeInstanceOf(InvalidZoneError);

    expect(zonasDe(await filaDe(w.id))).toEqual(['12', '14', '20', '22']);
  });

  it('todo o nada: con la compra buena y la venta mala no se guarda la buena', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', {
      buyMin: 12,
      buyMax: 14,
      sellMin: 20,
      sellMax: 22,
    });

    await expect(
      updateWatchedZones(db, userA, w.id, {
        buyMin: 11, // válida y NUEVA
        buyMax: 13,
        sellMin: 40, // inválida
        sellMax: 30,
      }),
    ).rejects.toBeInstanceOf(InvalidZoneError);

    expect(zonasDe(await filaDe(w.id))).toEqual(['12', '14', '20', '22']);
  });
});

describe('SPEC-044 CA-13: par incompleto rechazado (RN-10)', () => {
  it('el mínimo sin su máximo (y al revés) se rechaza y no guarda nada', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });

    await expect(updateWatchedZones(db, userA, w.id, { buyMin: 11 })).rejects.toThrow(
      /Zona de compra incompleta/,
    );
    await expect(updateWatchedZones(db, userA, w.id, { sellMax: 30 })).rejects.toThrow(
      /Zona de venta incompleta/,
    );

    expect(zonasDe(await filaDe(w.id))).toEqual(['12', '14', null, null]);
  });

  it('vaciar AMBOS extremos sigue siendo válido: "incompleta" ≠ "vacía"', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    await expect(
      updateWatchedZones(db, userA, w.id, { buyMin: null, buyMax: null }),
    ).resolves.not.toBeNull();
    expect(zonasDe(await filaDe(w.id))).toEqual([null, null, null, null]);
  });
});

describe('SPEC-044 CA-15: una sola puerta, no dos', () => {
  it('el mensaje de zona inválida es EL MISMO en el alta y en la edición', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR');

    const mensajeDelAlta = await watchSymbol(db, userA, 'TEF', 'EUR', {
      buyMin: 30,
      buyMax: 10,
    }).catch((e) => (e as Error).message);
    const mensajeDeLaEdicion = await updateWatchedZones(db, userA, w.id, {
      buyMin: 30,
      buyMax: 10,
    }).catch((e) => (e as Error).message);

    expect(mensajeDeLaEdicion).toBe(mensajeDelAlta);
    expect(mensajeDeLaEdicion).toContain('Zona de compra');
  });

  it('el mensaje de par incompleto también es el mismo, en las dos zonas', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR');
    for (const [zonas, etiqueta] of [
      [{ buyMin: 11 }, 'compra'],
      [{ sellMax: 30 }, 'venta'],
    ] as const) {
      const alta = await watchSymbol(db, userA, 'TEF', 'EUR', zonas).catch(
        (e) => (e as Error).message,
      );
      const edicion = await updateWatchedZones(db, userA, w.id, zonas).catch(
        (e) => (e as Error).message,
      );
      expect(edicion).toBe(alta);
      expect(edicion).toContain(etiqueta);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   Rebanada 4 — identidad y aislamiento (ADR-007, RN-01)
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-044 CA-16: identifica por id de vigilada, no por ticker', () => {
  it('el mismo ticker en dos mercados: cambia SOLO la señalada (ADR-007/ADR-012)', async () => {
    const bmex = await watchSymbol(
      db,
      userA,
      'SAN',
      'EUR',
      { buyMin: 10, buyMax: 12 },
      { micCode: 'BMEX', exchange: 'BME' },
    );
    const xnys = await watchSymbol(
      db,
      userA,
      'SAN',
      'USD',
      { buyMin: 13, buyMax: 14 },
      { micCode: 'XNYS', exchange: 'NYSE' },
    );
    expect(bmex.symbolId).not.toBe(xnys.symbolId);

    await updateWatchedZones(db, userA, xnys.id, { buyMin: 15, buyMax: 16 });

    expect(zonasDe(await filaDe(xnys.id))).toEqual(['15', '16', null, null]);
    expect(zonasDe(await filaDe(bmex.id))).toEqual(['10', '12', null, null]);
  });
});

describe('SPEC-044 CA-17: un id ajeno no edita nada y no revela nada (RN-01)', () => {
  it('la respuesta es indistinguible de la de un id inexistente y la fila de B no cambia', async () => {
    const wB = await watchSymbol(db, userB, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    const tB = await sembrarEpisodio(wB);

    const conIdAjeno = await updateWatchedZones(db, userA, wB.id, { buyMin: 1, buyMax: 2 });
    const conIdInexistente = await updateWatchedZones(
      db,
      userA,
      '00000000-0000-4000-8000-000000000000',
      { buyMin: 1, buyMax: 2 },
    );

    expect(conIdAjeno).toBeNull();
    expect(conIdAjeno).toEqual(conIdInexistente); // no se revela que ese id exista

    expect(zonasDe(await filaDe(wB.id))).toEqual(['20', '25', null, null]);
    expect(
      (await db.select().from(zoneTriggers).where(eq(zoneTriggers.watchedSymbolId, wB.id))).map(
        (t) => t.id,
      ),
    ).toEqual([tB.id]);
  });
});

describe('SPEC-044 CA-18: id ausente o malformado no es una excepción', () => {
  it('vacío, no-uuid o manipulado: devuelve null sin lanzar y la lista queda intacta', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });

    await expect(updateWatchedZones(db, userA, '', { buyMin: 1, buyMax: 2 })).resolves.toBeNull();
    await expect(
      updateWatchedZones(db, userA, 'no-es-un-uuid', { buyMin: 1, buyMax: 2 }),
    ).resolves.toBeNull();
    await expect(
      updateWatchedZones(db, userA, "' OR 1=1 --", { buyMin: 1, buyMax: 2 }),
    ).resolves.toBeNull();

    expect((await listWatched(db, userA)).map((x) => x.id)).toEqual([w.id]);
    expect(zonasDe(await filaDe(w.id))).toEqual(['12', '14', null, null]);
  });
});
