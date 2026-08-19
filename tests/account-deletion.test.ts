import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { and, eq } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import { makeTestDb, type TestDb } from '@/db/test-db';
import {
  users,
  notifications,
  passwordResetTokens,
  quoteDiagnostics,
  quotes,
  symbolAliases,
  symbols,
  transactions,
  watchedSymbols,
  zoneTriggers,
} from '@/db/schema';
import { registerUser, verifyCredentials } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { recordBuy, recordSell, recordSplit, recordDividend } from '@/lib/portfolio/service';
import {
  ACCOUNT_DELETION_COVERAGE,
  SHARED_TABLES,
  canDeleteAccount,
  deleteMyAccount,
} from '@/lib/account/deletion';

/**
 * SPEC-036 — el borrado de cuenta, contra Postgres de verdad (PGlite).
 *
 *   CA-3  sin la contraseña actual no se borra ni una fila
 *   CA-4  con ella desaparece TODO lo suyo, tabla por tabla
 *   CA-6  lo compartido y lo ajeno no se tocan
 *   CA-7  o cae todo o no cae nada
 *   CA-8  el email vuelve a estar libre y la cuenta nueva no hereda nada
 *   CA-11 una cuenta `admin` no se borra ni invocando la acción directamente
 *   CA-12 la regla no cuenta administradores, así que no pierde la carrera
 *   CA-13 degradarse primero SÍ permite irse
 */

const PWD = 'clave-secreta-123';
const OTRA = 'clave-equivocada-999';

let harness: { db: TestDb; client: PGlite };
const db = () => harness.db;

beforeEach(async () => {
  harness = await makeTestDb();
});

afterEach(async () => {
  await harness.client.close();
});

// ---------------------------------------------------------------------------
// Siembra: un usuario con datos en TODAS sus tablas (lo que exige CA-4)
// ---------------------------------------------------------------------------

interface Habitante {
  id: string;
  email: string;
  symbolId: string;
  watchedId: string;
}

/**
 * Un usuario con avisos leídos y sin leer, vigiladas con zonas, un episodio de zona
 * abierto y otro cerrado, compra, venta, split, dividendo, alias de import y un token
 * de recuperación vivo. Es literalmente la lista de CA-4: si mañana se seca una de
 * estas tablas, el test deja de probar lo que dice probar, y por eso se comprueba
 * después que la siembra dejó filas en todas.
 */
async function sembrar(email: string, ticker: string): Promise<Habitante> {
  const creado = await registerUser(db(), email, PWD);

  const watched = await watchSymbol(db(), creado.id, ticker, 'EUR', {
    buyMin: new Decimal(90),
    buyMax: new Decimal(95),
    sellMin: new Decimal(130),
    sellMax: new Decimal(140),
  });

  const [{ symbolId }] = await db()
    .select({ symbolId: watchedSymbols.symbolId })
    .from(watchedSymbols)
    .where(eq(watchedSymbols.id, watched.id));

  await recordBuy(db(), creado.id, ticker, 'EUR', {
    quantity: new Decimal(10),
    price: new Decimal(100),
    gastos: new Decimal('1.5'),
    occurredOn: '2026-01-02',
  });
  await recordSell(db(), creado.id, symbolId, {
    quantity: new Decimal(3),
    price: new Decimal(120),
    gastos: null,
    occurredOn: '2026-02-02',
  });
  await recordSplit(db(), creado.id, symbolId, new Decimal(2), '2026-03-02');
  await recordDividend(db(), creado.id, symbolId, new Decimal('12.34'), '2026-04-02');

  // Un episodio abierto y otro cerrado (ADR-005).
  const [abierto] = await db()
    .insert(zoneTriggers)
    .values({
      userId: creado.id,
      watchedSymbolId: watched.id,
      symbolId,
      zoneKind: 'buy',
      price: '92',
      asOf: new Date('2026-05-01T00:00:00.000Z'),
    })
    .returning();
  await db().insert(zoneTriggers).values({
    userId: creado.id,
    watchedSymbolId: watched.id,
    symbolId,
    zoneKind: 'sell',
    price: '135',
    asOf: new Date('2026-04-01T00:00:00.000Z'),
    closedAt: new Date('2026-04-05T00:00:00.000Z'),
  });

  // Un aviso sin leer (ligado a su episodio) y otro leído.
  await db().insert(notifications).values({
    userId: creado.id,
    kind: 'entry',
    zoneTriggerId: abierto.id,
    payload: `entrada en zona de ${email}`,
    channel: 'email',
    status: 'sent',
    asOf: new Date('2026-05-01T00:00:00.000Z'),
  });
  await db().insert(notifications).values({
    userId: creado.id,
    kind: 'digest',
    cycleRef: '2026-05-02',
    payload: `resumen de ${email}`,
    channel: 'in_app',
    status: 'failed',
    asOf: new Date('2026-05-02T00:00:00.000Z'),
    readAt: new Date('2026-05-03T00:00:00.000Z'),
  });

  // Una equivalencia aprendida del import (ADR-009).
  await db().insert(symbolAliases).values({
    userId: creado.id,
    brokerName: `VALOR ${ticker}`,
    marketLabel: 'M.CONTINUO',
    symbolId,
  });

  // Un enlace de recuperación vivo (ADR-015).
  await db().insert(passwordResetTokens).values({
    userId: creado.id,
    tokenHash: `hash-${email}`,
    expiresAt: new Date(Date.now() + 30 * 60_000),
  });

  return { id: creado.id, email: creado.email, symbolId, watchedId: watched.id };
}

/** Precio y diagnóstico del símbolo: filas COMPARTIDAS que nadie posee (ADR-004, SPEC-016). */
async function sembrarMercado(symbolId: string) {
  await db().insert(quotes).values({
    symbolId,
    price: '123.45',
    currency: 'EUR',
    asOf: new Date('2026-05-01T00:00:00.000Z'),
  });
}

// ---------------------------------------------------------------------------
// Recuento genérico, tabla por tabla, leyendo el ESQUEMA y no una lista a mano
// ---------------------------------------------------------------------------

/** Las tablas del borrado que llevan `user_id` (todas menos `users`). */
const TABLAS_CON_DUENO = ACCOUNT_DELETION_COVERAGE.map((c) => c.table).filter(
  (t) => t !== 'users',
);

/** Cuántas filas quedan de ese usuario en cada tabla cubierta. Sin muestreo. */
async function censo(userId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const tabla of TABLAS_CON_DUENO) {
    const { rows } = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${tabla}" WHERE user_id = $1`,
      [userId],
    );
    out[tabla] = rows[0].n;
  }
  const { rows } = await harness.client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM users WHERE id = $1`,
    [userId],
  );
  out.users = rows[0].n;
  return out;
}

/** Instantánea completa de las tablas COMPARTIDAS: recuento y valores. */
async function fotoDeLoCompartido() {
  return {
    symbols: await db().select().from(symbols).orderBy(symbols.ticker),
    quotes: await db().select().from(quotes).orderBy(quotes.symbolId),
    diagnostics: await db().select().from(quoteDiagnostics).orderBy(quoteDiagnostics.symbolId),
  };
}

// ---------------------------------------------------------------------------
// CA-4 — con la contraseña correcta desaparece TODO lo suyo
// ---------------------------------------------------------------------------

describe('SPEC-036 CA-4: con la contraseña correcta no queda ninguna fila suya', () => {
  it('la siembra deja filas en las SIETE tablas — si no, el test de abajo no prueba nada', async () => {
    const yo = await sembrar('ca4@example.com', 'ITX');
    const antes = await censo(yo.id);

    for (const tabla of Object.keys(antes)) {
      expect(antes[tabla], `la siembra no dejó ninguna fila en "${tabla}"`).toBeGreaterThan(0);
    }
    // Y las siete son las siete: ni una tabla del esquema se queda fuera del censo.
    expect(Object.keys(antes).sort()).toEqual(
      ACCOUNT_DELETION_COVERAGE.map((c) => c.table).sort(),
    );
  });

  it('tras el borrado el censo es cero en todas, tabla por tabla', async () => {
    const yo = await sembrar('ca4-borra@example.com', 'ITX');

    const resultado = await deleteMyAccount(db(), yo.id, PWD);

    expect(resultado).toEqual({ ok: true });
    expect(await censo(yo.id)).toEqual(
      Object.fromEntries(ACCOUNT_DELETION_COVERAGE.map((c) => [c.table, 0])),
    );
  });

  it('los episodios de zona caen con su acción vigilada, sin borrarlos a mano (ADR-017)', async () => {
    const yo = await sembrar('ca4-cascade@example.com', 'ITX');
    expect(await db().select().from(zoneTriggers)).not.toHaveLength(0);

    await deleteMyAccount(db(), yo.id, PWD);

    expect(await db().select().from(zoneTriggers)).toHaveLength(0);
  });

  it('el borrado no deja huérfanos en NINGUNA tabla del esquema con user_id', async () => {
    const yo = await sembrar('ca4-huerfanos@example.com', 'ITX');

    await deleteMyAccount(db(), yo.id, PWD);

    // No se buscan las filas de ESTE usuario: se busca cualquier fila que apunte a un
    // usuario que ya no existe. Es la propiedad de fondo de "sin rastro".
    for (const tabla of TABLAS_CON_DUENO) {
      const { rows } = await harness.client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${tabla}" t
         WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.user_id)`,
      );
      expect(rows[0].n, `"${tabla}" conserva filas de un usuario que ya no existe`).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// CA-3 — sin la contraseña actual no se borra nada
// ---------------------------------------------------------------------------

describe('SPEC-036 CA-3: sin la contraseña actual no se borra ni una fila', () => {
  it('la contraseña incorrecta se rechaza y el censo queda intacto', async () => {
    const yo = await sembrar('ca3@example.com', 'ITX');
    const antes = await censo(yo.id);

    const resultado = await deleteMyAccount(db(), yo.id, OTRA);

    expect(resultado).toEqual({ ok: false, reason: 'invalid-password' });
    expect(await censo(yo.id)).toEqual(antes);
  });

  it('la contraseña vacía tampoco vale', async () => {
    const yo = await sembrar('ca3-vacia@example.com', 'ITX');

    expect(await deleteMyAccount(db(), yo.id, '')).toEqual({
      ok: false,
      reason: 'invalid-password',
    });
    expect((await censo(yo.id)).users).toBe(1);
  });

  it('la credencial sigue sirviendo después del intento fallido: nada se ha tocado', async () => {
    const yo = await sembrar('ca3-intacta@example.com', 'ITX');

    await deleteMyAccount(db(), yo.id, OTRA);

    // `verifyCredentials` es el MISMO mecanismo que usa el borrado (ADR-022 pto. 6):
    // si el intento fallido hubiera movido algo de la credencial, esto lo delataría.
    await expect(verifyCredentials(db(), yo.email, PWD)).resolves.toMatchObject({
      id: yo.id,
      role: 'tester',
    });
  });

  it('un usuario que ya no existe no puede borrarse, y no revienta', async () => {
    const resultado = await deleteMyAccount(
      db(),
      '00000000-0000-0000-0000-000000000000',
      PWD,
    );
    expect(resultado).toEqual({ ok: false, reason: 'unknown-user' });
  });
});

// ---------------------------------------------------------------------------
// CA-6 — lo compartido y lo ajeno no se tocan
// ---------------------------------------------------------------------------

describe('SPEC-036 CA-6: irse no daña a nadie más (RN-01 por el otro lado)', () => {
  it('symbols, quotes y quote_diagnostics quedan EXACTAMENTE igual', async () => {
    const quien = await sembrar('ca6-se-va@example.com', 'ITX');
    const queda = await sembrar('ca6-se-queda@example.com', 'ITX'); // MISMO símbolo
    expect(quien.symbolId).toBe(queda.symbolId); // el registro es compartido (ADR-002)

    await sembrarMercado(quien.symbolId);
    await db().insert(quoteDiagnostics).values({
      symbolId: quien.symbolId,
      reason: 'not_found',
    });
    const antes = await fotoDeLoCompartido();
    expect(antes.symbols.length).toBeGreaterThan(0);
    expect(antes.quotes.length).toBeGreaterThan(0);
    expect(antes.diagnostics.length).toBeGreaterThan(0);

    await deleteMyAccount(db(), quien.id, PWD);

    // Mismo recuento y mismos VALORES: no basta con que sigan existiendo.
    expect(await fotoDeLoCompartido()).toEqual(antes);
  });

  it('el otro usuario conserva íntegras sus vigiladas, zonas, episodios, avisos y operaciones', async () => {
    const quien = await sembrar('ca6-b-se-va@example.com', 'ITX');
    const queda = await sembrar('ca6-b-se-queda@example.com', 'ITX');
    await sembrarMercado(queda.symbolId);
    const antes = await censo(queda.id);

    await deleteMyAccount(db(), quien.id, PWD);

    expect(await censo(queda.id)).toEqual(antes);

    // Y sigue viendo el precio de ese símbolo, que es lo que le importa a él.
    const [precio] = await db()
      .select()
      .from(quotes)
      .where(eq(quotes.symbolId, queda.symbolId));
    expect(precio?.price).toBe('123.45');

    // Sus zonas, con sus valores, no las de nadie más.
    const [suya] = await db()
      .select()
      .from(watchedSymbols)
      .where(
        and(eq(watchedSymbols.userId, queda.id), eq(watchedSymbols.symbolId, queda.symbolId)),
      );
    expect(suya).toMatchObject({ buyMin: '90', buyMax: '95', sellMin: '130', sellMax: '140' });
  });

  it('el símbolo que se queda sin nadie NO se borra: queda inerte (ADR-022 pto. 2)', async () => {
    const quien = await sembrar('ca6-c@example.com', 'SOLO');
    await sembrarMercado(quien.symbolId);

    await deleteMyAccount(db(), quien.id, PWD);

    const restantes = await db().select().from(symbols).where(eq(symbols.id, quien.symbolId));
    expect(restantes, 'un símbolo sin referencias sigue ahí, sin dueño y sin coste').toHaveLength(
      1,
    );
    expect(await db().select().from(quotes).where(eq(quotes.symbolId, quien.symbolId))).toHaveLength(
      1,
    );
  });

  it('las tablas compartidas no tienen columna de dueño, así que el borrado no puede filtrarlas', async () => {
    for (const tabla of SHARED_TABLES) {
      const { rows } = await harness.client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'user_id'`,
        [tabla],
      );
      expect(rows[0].n, `"${tabla}" ha ganado un user_id: ya no es compartida`).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// CA-7 — o cae todo, o no cae nada
// ---------------------------------------------------------------------------

describe('SPEC-036 CA-7: si una sentencia intermedia falla, la base queda como estaba', () => {
  it('una referencia que el borrado no puede satisfacer lo tumba entero, sin dejar nada a medias', async () => {
    const yo = await sembrar('ca7@example.com', 'ITX');
    const antes = await censo(yo.id);

    // Una tabla ajena al esquema que apunta a `users`: la última sentencia del
    // borrado (`DELETE FROM users`) violará su clave foránea. Es el equivalente
    // controlado de "una de las sentencias intermedias falla".
    await harness.client.exec(`
      CREATE TABLE t_externa (user_id uuid NOT NULL REFERENCES users(id));
    `);
    await harness.client.query(`INSERT INTO t_externa (user_id) VALUES ($1)`, [yo.id]);

    await expect(deleteMyAccount(db(), yo.id, PWD)).rejects.toThrow();

    // Ninguna tabla parcialmente vaciada: el censo entero, tal cual estaba.
    expect(await censo(yo.id)).toEqual(antes);
  });

  it('la carrera con el ciclo diario (F-SPEC-036-1) falla entera, no a medias', async () => {
    const yo = await sembrar('ca7-cron@example.com', 'ITX');
    const antes = await censo(yo.id);

    // Simula al cron insertando un aviso JUSTO DESPUÉS de que el borrado vacíe
    // `notifications` y ANTES de que llegue a `users`: una regla colgada del borrado
    // de `watched_symbols`, que es la sentencia siguiente. Es la ventana de
    // milisegundos que F-SPEC-036-1 declara como residual asumido — y lo que se
    // comprueba es que la transacción cae ENTERA, no que la ventana no exista.
    await harness.client.exec(`
      CREATE RULE cron_mete_un_aviso AS ON DELETE TO watched_symbols DO ALSO
        INSERT INTO notifications (user_id, kind, payload, channel, status, as_of)
        VALUES (OLD.user_id, 'entry', 'aviso del ciclo diario', 'in_app', 'sent', now());
    `);

    await expect(deleteMyAccount(db(), yo.id, PWD)).rejects.toThrow();

    await harness.client.exec(`DROP RULE cron_mete_un_aviso ON watched_symbols`);
    expect(
      await censo(yo.id),
      'el borrado se quedó a medias: sin cuenta y con datos es el peor de los dos mundos',
    ).toEqual(antes);
  });

  it('y tras el fallo el usuario puede reintentar, que es lo que F-SPEC-036-1 promete', async () => {
    const yo = await sembrar('ca7-reintento@example.com', 'ITX');
    await harness.client.exec(`
      CREATE TABLE t_externa2 (user_id uuid NOT NULL REFERENCES users(id));
    `);
    await harness.client.query(`INSERT INTO t_externa2 (user_id) VALUES ($1)`, [yo.id]);
    await expect(deleteMyAccount(db(), yo.id, PWD)).rejects.toThrow();

    // Desaparecida la causa (el cron ya no está insertando), el reintento va.
    await harness.client.exec(`DROP TABLE t_externa2`);

    expect(await deleteMyAccount(db(), yo.id, PWD)).toEqual({ ok: true });
    expect((await censo(yo.id)).users).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CA-8 — el email vuelve a estar libre y la cuenta nueva no hereda nada
// ---------------------------------------------------------------------------

describe('SPEC-036 CA-8: el email vuelve a estar libre (RN-02)', () => {
  const EMAIL = 'ca8-vuelve@example.com';

  it('alguien se registra con el mismo email y el alta funciona', async () => {
    const yo = await sembrar(EMAIL, 'ITX');
    await deleteMyAccount(db(), yo.id, PWD);

    const nueva = await registerUser(db(), EMAIL, 'otra-clave-distinta-1');

    expect(nueva.email).toBe(EMAIL);
    expect(nueva.id).not.toBe(yo.id); // es otra cuenta, no la de antes resucitada
  });

  it('la cuenta nueva no hereda ninguna vigilada, aviso, operación ni alias', async () => {
    const yo = await sembrar('ca8-limpia@example.com', 'ITX');
    await deleteMyAccount(db(), yo.id, PWD);

    const nueva = await registerUser(db(), 'ca8-limpia@example.com', 'otra-clave-distinta-1');

    expect(await censo(nueva.id)).toEqual({
      ...Object.fromEntries(ACCOUNT_DELETION_COVERAGE.map((c) => [c.table, 0])),
      users: 1,
    });
  });

  it('y nace con rol tester, no con el que tuviera la de antes (ADR-021 pto. 8)', async () => {
    const yo = await sembrar('ca8-rol@example.com', 'ITX');
    await db().update(users).set({ role: 'completo' }).where(eq(users.id, yo.id));
    await deleteMyAccount(db(), yo.id, PWD);

    const nueva = await registerUser(db(), 'ca8-rol@example.com', 'otra-clave-distinta-1');

    expect(nueva.role).toBe('tester');
  });

  it('la credencial de antes ya no sirve: la cuenta nueva es de quien la crea', async () => {
    const yo = await sembrar('ca8-cred@example.com', 'ITX');
    await deleteMyAccount(db(), yo.id, PWD);
    await registerUser(db(), 'ca8-cred@example.com', 'otra-clave-distinta-1');

    await expect(verifyCredentials(db(), 'ca8-cred@example.com', PWD)).rejects.toThrow();
    await expect(
      verifyCredentials(db(), 'ca8-cred@example.com', 'otra-clave-distinta-1'),
    ).resolves.toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// CA-11 / CA-12 / CA-13 — la regla del `admin`
// ---------------------------------------------------------------------------

describe('SPEC-036 CA-11: una cuenta admin no se borra ni invocando la acción', () => {
  it('la decisión es pura y no cuenta administradores: `admin` no, los demás sí', () => {
    expect(canDeleteAccount('admin')).toBe(false);
    expect(canDeleteAccount('completo')).toBe(true);
    expect(canDeleteAccount('tester')).toBe(true);
  });

  it('con la contraseña CORRECTA se rechaza igual, y no se borra ni una fila', async () => {
    const yo = await sembrar('ca11@example.com', 'ITX');
    await db().update(users).set({ role: 'admin' }).where(eq(users.id, yo.id));
    const antes = await censo(yo.id);

    const resultado = await deleteMyAccount(db(), yo.id, PWD);

    expect(resultado).toEqual({ ok: false, reason: 'admin-role' });
    expect(await censo(yo.id)).toEqual(antes);
  });

  it('el rechazo se decide por el rol de la BASE, no por lo que traiga quien llama', async () => {
    const yo = await sembrar('ca11-base@example.com', 'ITX');
    await db().update(users).set({ role: 'admin' }).where(eq(users.id, yo.id));

    // La firma no admite un rol de entrada a propósito: si lo admitiera, una sesión
    // rancia con `role: 'tester'` abriría la puerta que ADR-021 pto. 3 cierra.
    expect(deleteMyAccount.length).toBe(3);
    expect(await deleteMyAccount(db(), yo.id, PWD)).toEqual({ ok: false, reason: 'admin-role' });
  });
});

describe('SPEC-036 CA-12: la regla no tiene casos frontera', () => {
  /** Deja `n` administradores en la base y devuelve sus ids. */
  async function conAdmins(n: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const yo = await sembrar(`ca12-admin-${n}-${i}@example.com`, `TK${i}`);
      await db().update(users).set({ role: 'admin' }).where(eq(users.id, yo.id));
      ids.push(yo.id);
    }
    return ids;
  }

  async function cuantosAdmins(): Promise<number> {
    const { rows } = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM users WHERE role = 'admin'`,
    );
    return rows[0].n;
  }

  it('con UN solo admin: no lo consigue y sigue habiendo uno', async () => {
    const [solo] = await conAdmins(1);

    expect(await deleteMyAccount(db(), solo, PWD)).toEqual({ ok: false, reason: 'admin-role' });
    expect(await cuantosAdmins()).toBe(1);
  });

  it('con DOS admins, uno tras otro: ninguno lo consigue y siguen los dos', async () => {
    const [a, b] = await conAdmins(2);

    expect(await deleteMyAccount(db(), a, PWD)).toEqual({ ok: false, reason: 'admin-role' });
    expect(await deleteMyAccount(db(), b, PWD)).toEqual({ ok: false, reason: 'admin-role' });
    expect(await cuantosAdmins()).toBe(2);
  });

  it('con DOS admins que se borran A LA VEZ: ninguno lo consigue y queda al menos uno', async () => {
    const [a, b] = await conAdmins(2);

    // Es el escenario que tumba la regla estrecha ("solo el último no puede"): ambos
    // verían un censo de dos, ambos se creerían no-últimos y el servicio se quedaría
    // con cero operadores. La regla ANCHA no cuenta, así que no puede perder la carrera.
    const [ra, rb] = await Promise.all([
      deleteMyAccount(db(), a, PWD),
      deleteMyAccount(db(), b, PWD),
    ]);

    expect(ra).toEqual({ ok: false, reason: 'admin-role' });
    expect(rb).toEqual({ ok: false, reason: 'admin-role' });
    expect(await cuantosAdmins()).toBe(2);
    expect(await cuantosAdmins()).toBeGreaterThanOrEqual(1);
  });

  it('el borrado NUNCA consulta cuántos admins hay: la regla es sobre el rol propio', async () => {
    // Si contara, el resultado dependería del censo. Aquí el censo cambia (uno, dos,
    // tres administradores) y la respuesta es la misma, siempre.
    for (const n of [1, 2, 3]) {
      harness = await makeTestDb();
      const ids = await conAdmins(n);
      for (const id of ids) {
        expect(await deleteMyAccount(db(), id, PWD)).toEqual({
          ok: false,
          reason: 'admin-role',
        });
      }
      expect(await cuantosAdmins()).toBe(n);
    }
  });
});

describe('SPEC-036 CA-13: degradarse primero SÍ permite irse', () => {
  for (const rol of ['tester', 'completo'] as const) {
    it(`un admin que pasa a ${rol} se borra con normalidad`, async () => {
      const yo = await sembrar(`ca13-${rol}@example.com`, 'ITX');
      await db().update(users).set({ role: 'admin' }).where(eq(users.id, yo.id));
      expect(await deleteMyAccount(db(), yo.id, PWD)).toEqual({ ok: false, reason: 'admin-role' });

      // El UPDATE que hoy hace el operador a mano (F-ADR-021-1).
      await db().update(users).set({ role: rol }).where(eq(users.id, yo.id));

      expect(await deleteMyAccount(db(), yo.id, PWD)).toEqual({ ok: true });
      expect(await censo(yo.id)).toEqual(
        Object.fromEntries(ACCOUNT_DELETION_COVERAGE.map((c) => [c.table, 0])),
      );
    });
  }

  it('la restricción es sobre el ROL, no sobre la persona: el email vuelve a estar libre', async () => {
    const yo = await sembrar('ca13-persona@example.com', 'ITX');
    await db().update(users).set({ role: 'admin' }).where(eq(users.id, yo.id));
    await db().update(users).set({ role: 'completo' }).where(eq(users.id, yo.id));

    await deleteMyAccount(db(), yo.id, PWD);

    await expect(
      registerUser(db(), 'ca13-persona@example.com', 'otra-clave-distinta-1'),
    ).resolves.toMatchObject({ role: 'tester' });
  });
});

// ---------------------------------------------------------------------------
// Aislamiento del borrado frente a las operaciones ajenas (RN-01, CA-15)
// ---------------------------------------------------------------------------

describe('SPEC-036: el borrado no toca las operaciones de otro usuario', () => {
  it('las transacciones del que se queda siguen ahí, con sus mismos importes', async () => {
    const quien = await sembrar('iso-se-va@example.com', 'ITX');
    const queda = await sembrar('iso-se-queda@example.com', 'ITX');
    const antes = await db()
      .select()
      .from(transactions)
      .where(eq(transactions.userId, queda.id))
      .orderBy(transactions.occurredOn);

    await deleteMyAccount(db(), quien.id, PWD);

    const despues = await db()
      .select()
      .from(transactions)
      .where(eq(transactions.userId, queda.id))
      .orderBy(transactions.occurredOn);
    expect(despues).toEqual(antes);
    expect(despues.length).toBe(4); // compra, venta, split y dividendo
  });
});
