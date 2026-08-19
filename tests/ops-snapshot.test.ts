import { describe, it, expect, beforeEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { makeTestDb, type TestDb } from '@/db/test-db';
import {
  cronRuns,
  quoteDiagnostics,
  registrationSettings,
  symbols,
  transactions,
  users,
  watchedSymbols,
} from '@/db/schema';
import { countUniverseSymbols, symbolUniverse } from '@/lib/market/refresh';
import { FAIL_REASON_TEXT } from '@/lib/market/fail-reason-text';
import { readOperationSnapshot } from '@/lib/ops/snapshot';

/**
 * SPEC-037 CA-13 / CA-18 / CA-22 / CA-23 — lo que la pantalla de operación SABE.
 *
 * La pantalla se prueba en el navegador (`tests/e2e/admin.spec.ts`); aquí se prueba
 * lo que le da de comer, que es donde puede mentir sin que se note: cuatro números
 * que tienen que coincidir EXACTAMENTE con la base, el último ciclo tal y como es, y
 * la forma de las consultas que garantiza los cinco segundos de CE-7.
 *
 * CA-23 se mide con un doble que CUENTA LAS CONSULTAS y no con un cronómetro: un
 * cronómetro en CI un día va lento y pone la suite en rojo sin que nada se haya roto.
 * Lo que se protege es la FORMA —número de consultas constante, todas agregadas—, que
 * es lo que de verdad hace que la pantalla responda.
 */

let db: TestDb;
let client: PGlite;

beforeEach(async () => {
  ({ db, client } = await makeTestDb());
});

const PWD_HASH = '$2a$10$abcdefghijklmnopqrstuv';

/** Inserta N cuentas en UNA sentencia: el volumen es del test, no de bcrypt. */
async function sembrarCuentas(n: number, prefijo = 'u'): Promise<string[]> {
  const filas = Array.from({ length: n }, (_, i) => ({
    email: `${prefijo}${i}@example.com`,
    passwordHash: PWD_HASH,
  }));
  const creados = await db.insert(users).values(filas).returning({ id: users.id });
  return creados.map((c) => c.id);
}

async function sembrarSimbolos(n: number, prefijo = 'S'): Promise<string[]> {
  const filas = Array.from({ length: n }, (_, i) => ({
    ticker: `${prefijo}${i}`,
    micCode: 'XNAS',
    currency: 'USD',
  }));
  const creados = await db.insert(symbols).values(filas).returning({ id: symbols.id });
  return creados.map((c) => c.id);
}

describe('SPEC-037 CA-13: los cuatro contadores dicen la verdad', () => {
  it('cuentas, vigiladas, símbolos del ciclo y símbolos sin precio, exactos', async () => {
    const [u1, u2] = await sembrarCuentas(3); // 3 cuentas
    const simbolos = await sembrarSimbolos(5); // 5 símbolos en el registro...

    // ...pero el UNIVERSO DEL CICLO son solo los referenciados: 3 vigilados + 1 operado.
    await db.insert(watchedSymbols).values([
      { userId: u1, symbolId: simbolos[0] },
      { userId: u1, symbolId: simbolos[1] },
      { userId: u2, symbolId: simbolos[0] }, // el mismo símbolo, otro usuario: NO duplica
      { userId: u2, symbolId: simbolos[2] },
    ]);
    await db.insert(transactions).values({
      userId: u2,
      symbolId: simbolos[3],
      type: 'buy',
      occurredOn: '2026-01-05',
      quantity: '10',
      price: '100',
    });

    // Dos símbolos sin precio, con motivos DISTINTOS (SPEC-016).
    await db.insert(quoteDiagnostics).values([
      { symbolId: simbolos[0], reason: 'mercado_no_cubierto' },
      { symbolId: simbolos[2], reason: 'simbolo_desconocido' },
    ]);

    const s = await readOperationSnapshot(db);

    expect(s.accounts).toBe(3);
    expect(s.watchedSymbols).toBe(4); // filas de vigilancia, no símbolos distintos
    expect(s.cycleSymbols).toBe(4); // simbolos[0], [1], [2] vigilados + [3] operado
    expect(s.symbolsWithoutPrice.total).toBe(2);
  });

  it('los símbolos sin precio traen SU MOTIVO, no un número mudo', async () => {
    const [u] = await sembrarCuentas(1);
    const simbolos = await sembrarSimbolos(4);
    await db.insert(watchedSymbols).values(simbolos.map((symbolId) => ({ userId: u, symbolId })));
    await db.insert(quoteDiagnostics).values([
      { symbolId: simbolos[0], reason: 'mercado_no_cubierto' },
      { symbolId: simbolos[1], reason: 'mercado_no_cubierto' },
      { symbolId: simbolos[2], reason: 'proveedor_no_disponible' },
    ]);

    const s = await readOperationSnapshot(db);

    expect(s.symbolsWithoutPrice.total).toBe(3);
    expect(s.symbolsWithoutPrice.byReason).toEqual([
      { reason: 'mercado_no_cubierto', text: FAIL_REASON_TEXT.mercado_no_cubierto, count: 2 },
      { reason: 'proveedor_no_disponible', text: FAIL_REASON_TEXT.proveedor_no_disponible, count: 1 },
    ]);
  });

  it('con la base vacía los cuatro son cero, y eso no es un fallo', async () => {
    const s = await readOperationSnapshot(db);
    expect([s.accounts, s.watchedSymbols, s.cycleSymbols, s.symbolsWithoutPrice.total]).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it('el contador del universo y `symbolUniverse` no pueden divergir', async () => {
    // UNA sola definición de «universo del ciclo» (spec §Entidades). Este test es lo
    // que la sostiene: si alguien cambia una de las dos funciones, se pone rojo.
    const [u] = await sembrarCuentas(1);
    const simbolos = await sembrarSimbolos(6);

    for (const escenario of [
      () => db.insert(watchedSymbols).values({ userId: u, symbolId: simbolos[0] }),
      () => db.insert(watchedSymbols).values({ userId: u, symbolId: simbolos[1] }),
      () =>
        db.insert(transactions).values({
          userId: u,
          symbolId: simbolos[1], // ya vigilado: el universo no lo duplica
          type: 'buy',
          occurredOn: '2026-01-05',
          quantity: '1',
          price: '1',
        }),
      () =>
        db.insert(transactions).values({
          userId: u,
          symbolId: simbolos[4],
          type: 'buy',
          occurredOn: '2026-01-06',
          quantity: '1',
          price: '1',
        }),
    ]) {
      await escenario();
      expect(await countUniverseSymbols(db)).toBe((await symbolUniverse(db)).length);
    }
  });
});

describe('SPEC-037 CA-18: `/admin` cuenta el último ciclo como es', () => {
  it('sin ninguna fila, dice que el ciclo NO HA CORRIDO NUNCA', async () => {
    const s = await readOperationSnapshot(db);
    // `null` y no un cero ambiguo, ni una fecha inventada, ni un hueco.
    expect(s.lastCycle).toBeNull();
  });

  it('con varias filas, la MÁS RECIENTE, con sus contadores', async () => {
    await db.insert(cronRuns).values([
      {
        startedAt: new Date('2026-08-15T22:00:00Z'),
        finishedAt: new Date('2026-08-15T22:00:20Z'),
        outcome: 'success',
        requested: 10,
        updated: 9,
        skipped: 1,
        triggersOpened: 0,
        triggersClosed: 0,
        notificationsEntries: 0,
        notificationsDigests: 0,
      },
      {
        startedAt: new Date('2026-08-18T22:00:00Z'),
        finishedAt: new Date('2026-08-18T22:00:31Z'),
        outcome: 'success',
        requested: 31,
        updated: 27,
        skipped: 4,
        triggersOpened: 2,
        triggersClosed: 1,
        notificationsEntries: 3,
        notificationsDigests: 1,
      },
      {
        startedAt: new Date('2026-08-16T22:00:00Z'),
        finishedAt: null,
        outcome: null,
      },
    ]);

    const s = await readOperationSnapshot(db);

    expect(s.lastCycle?.startedAt.toISOString()).toBe('2026-08-18T22:00:00.000Z');
    expect(s.lastCycle?.finishedAt?.toISOString()).toBe('2026-08-18T22:00:31.000Z');
    expect(s.lastCycle?.outcome).toBe('success');
    expect(s.lastCycle).toMatchObject({
      requested: 31,
      updated: 27,
      skipped: 4,
      triggersOpened: 2,
      triggersClosed: 1,
      notificationsEntries: 3,
      notificationsDigests: 1,
    });
  });

  it('un ciclo que empezó y no volvió se lee como tal: `finishedAt` nulo', async () => {
    await db.insert(cronRuns).values({
      startedAt: new Date('2026-08-19T22:00:00Z'),
      finishedAt: null,
      outcome: null,
    });
    const s = await readOperationSnapshot(db);
    expect(s.lastCycle?.finishedAt).toBeNull();
    expect(s.lastCycle?.outcome).toBeNull();
  });
});

describe('SPEC-037 CA-22: la pantalla no puede enseñar a nadie, porque no lo sabe', () => {
  it('el snapshot no contiene ningún email, ningún ticker ni ninguna fila de usuario', async () => {
    const [u] = await sembrarCuentas(3, 'persona');
    const simbolos = await sembrarSimbolos(2, 'TICKER');
    await db.insert(watchedSymbols).values({ userId: u, symbolId: simbolos[0] });
    await db.insert(transactions).values({
      userId: u,
      symbolId: simbolos[1],
      type: 'buy',
      occurredOn: '2026-01-05',
      quantity: '1',
      price: '1',
    });
    await db.insert(quoteDiagnostics).values({ symbolId: simbolos[0], reason: 'simbolo_desconocido' });
    await db.update(registrationSettings).set({ updatedBy: u });

    const serializado = JSON.stringify(await readOperationSnapshot(db));

    expect(serializado).not.toContain('@');
    expect(serializado).not.toContain('TICKER');
    expect(serializado).not.toContain('persona');
    // Ni siquiera el id del operador que tocó el grifo sale del módulo de datos:
    // `updated_by` es auditoría en la fila, no contenido de pantalla.
    expect(serializado).not.toContain(u);
  });
});

describe('SPEC-037 CA-23: responde deprisa porque pregunta poco', () => {
  /** Cuenta las consultas REALES que salen hacia Postgres mientras corre `fn`. */
  async function consultasDe(fn: () => Promise<unknown>): Promise<number> {
    const original = client.query.bind(client);
    let n = 0;
    (client as unknown as { query: typeof original }).query = ((...args: unknown[]) => {
      n += 1;
      return (original as (...a: unknown[]) => unknown)(...args);
    }) as typeof original;
    try {
      await fn();
    } finally {
      (client as unknown as { query: typeof original }).query = original;
    }
    return n;
  }

  it('el número de consultas NO crece con las cuentas ni con los símbolos', async () => {
    // El doble sabe contar: si no viera nada, todo lo de abajo sería verde en vacío.
    const enVacio = await consultasDe(() => readOperationSnapshot(db));
    expect(enVacio).toBeGreaterThan(0);

    // Base pequeña.
    const [u] = await sembrarCuentas(2, 'peq');
    const pocos = await sembrarSimbolos(3, 'P');
    await db.insert(watchedSymbols).values(pocos.map((symbolId) => ({ userId: u, symbolId })));
    const conPocos = await consultasDe(() => readOperationSnapshot(db));

    // Base con volumen: 500 cuentas y 5.000 vigiladas, como pide el CA.
    const muchos = await sembrarCuentas(500, 'vol');
    const simbolos = await sembrarSimbolos(500, 'V');
    const vigiladas: { userId: string; symbolId: string }[] = [];
    for (let i = 0; i < 5000; i++) {
      vigiladas.push({ userId: muchos[i % 500], symbolId: simbolos[i % 500] });
    }
    // (userId, symbolId) es único: se siembran 500×10 pares distintos.
    const unicos = new Map(vigiladas.map((v) => [`${v.userId}|${v.symbolId}`, v]));
    await db.insert(watchedSymbols).values([...unicos.values()]).onConflictDoNothing();
    const conMuchos = await consultasDe(() => readOperationSnapshot(db));

    expect(conMuchos, `pocos=${conPocos} muchos=${conMuchos}`).toBe(conPocos);
    expect(conMuchos, `vacío=${enVacio} muchos=${conMuchos}`).toBe(enVacio);
  });

  it('y la pantalla se compone con un puñado de consultas, no con una por fila', async () => {
    const n = await consultasDe(() => readOperationSnapshot(db));
    expect(n).toBeLessThanOrEqual(8);
  });
});
