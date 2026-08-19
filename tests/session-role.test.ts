import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { users } from '@/db/schema';
import { registerUser, verifyCredentials } from '@/lib/auth/users';
import { authConfig } from '@/lib/auth/base-config';
import { resolveSessionWithEpoch, type SessionShape } from '@/lib/auth/session-boundary';
import { readSessionRow } from '@/lib/auth/session-row';
import { toEpochClaim } from '@/lib/auth/session-epoch';

/**
 * SPEC-034 CA-11 / CA-12 — dónde vive el rol y qué cuesta saberlo (ADR-021 pto. 2-3).
 *
 * Las dos mitades de la decisión que separa esta spec de "meter un claim más":
 *   CA-11 — el rol NO viaja en el token, y el camino Edge sigue sin base de datos.
 *   CA-12 — saberlo no cuesta ni una consulta más: sale de la MISMA lectura que
 *           ADR-016 ya paga por la época de credencial.
 */

const PWD = 'clave-secreta-123';

// ---------------------------------------------------------------------------
// CA-11 — el rol no viaja en el token
// ---------------------------------------------------------------------------

describe('SPEC-034 CA-11: el JWT emitido en el login no contiene el rol', () => {
  /** La callback real de `base-config`, invocada como la invoca Auth.js al hacer login. */
  const jwt = authConfig.callbacks.jwt;

  it('el token estampado en el login trae id y credentialEpoch, y NADA más', async () => {
    const token = await jwt({
      token: {},
      // Lo que devuelve `authorize` en Node. Se le cuela ADEMÁS un rol, a propósito:
      // si algún día alguien lo copia al token "porque venía en el user", esto lo caza.
      user: {
        id: 'u-1',
        email: 'ana@example.com',
        credentialEpoch: 1_700_000_000_000,
        role: 'admin',
      },
    } as never);

    expect(Object.keys(token as object).sort()).toEqual(['credentialEpoch', 'id']);
    expect((token as Record<string, unknown>).id).toBe('u-1');
    expect((token as Record<string, unknown>).credentialEpoch).toBe(1_700_000_000_000);
  });

  it('el contenido serializado del token no menciona el rol, ni por nombre ni por valor', async () => {
    const token = await jwt({
      token: {},
      user: { id: 'u-2', email: 'b@example.com', credentialEpoch: 42, role: 'completo' },
    } as never);

    const serializado = JSON.stringify(token);
    expect(serializado).not.toContain('role');
    for (const valor of ['tester', 'completo', 'admin']) {
      expect(serializado, `el token lleva el valor "${valor}"`).not.toContain(valor);
    }
  });

  it('en las rotaciones del token (sin `user`) tampoco aparece el rol (ADR-016 pto. 5)', async () => {
    const previo = { id: 'u-3', credentialEpoch: 7 };
    const token = await jwt({ token: { ...previo } } as never);
    expect(Object.keys(token as object).sort()).toEqual(['credentialEpoch', 'id']);
  });
});

// El grafo de imports de `base-config.ts` — mismo estilo que tests/version-import-graph.test.ts.
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(rootDir, 'src');
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx'];

function specifiersOf(source: string): string[] {
  const patterns = [
    /(?:^|\n)\s*import\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

function resolveLocal(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(srcDir, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else return null;
  const candidates = [
    base,
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function walk(entry: string): { files: string[]; packages: string[] } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (files.has(current)) continue;
    files.add(current);
    for (const specifier of specifiersOf(readFileSync(current, 'utf8'))) {
      const local = resolveLocal(specifier, current);
      if (local === null) packages.add(specifier);
      else pending.push(local);
    }
  }
  return { files: [...files], packages: [...packages] };
}

describe('SPEC-034 CA-11: base-config.ts sigue siendo edge-safe (ADR-001, ADR-021 pto. 2)', () => {
  const baseConfig = join(srcDir, 'lib', 'auth', 'base-config.ts');

  it('el recorrido no es vacío: el fichero existe y se lee', () => {
    expect(existsSync(baseConfig)).toBe(true);
    expect(walk(baseConfig).files.length).toBeGreaterThan(0);
  });

  it('no alcanza ningún módulo bajo src/db/', () => {
    const reached = walk(baseConfig).files.map((f) => relative(rootDir, f).replace(/\\/g, '/'));
    expect(reached.filter((f) => f.startsWith('src/db/'))).toEqual([]);
  });

  it('no importa la base de datos ni bcrypt', () => {
    const { packages } = walk(baseConfig);
    const prohibidos = [
      'drizzle-orm',
      'postgres',
      'pg',
      '@neondatabase/serverless',
      '@electric-sql/pglite',
      'bcryptjs',
      'bcrypt',
    ];
    for (const pkg of packages) {
      const root = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
      expect(prohibidos, `"${pkg}" rompería el middleware Edge`).not.toContain(root);
    }
  });

  it('la declaración de tipos del JWT no tiene rol: lo que no está declarado no se estampa', () => {
    const tipos = readFileSync(join(srcDir, 'types', 'next-auth.d.ts'), 'utf8');
    const bloqueJwt = tipos.slice(tipos.indexOf("declare module 'next-auth/jwt'"));
    expect(bloqueJwt).not.toContain('role');
  });
});

// ---------------------------------------------------------------------------
// CA-12 — saber el rol no cuesta una consulta más
// ---------------------------------------------------------------------------

/** Doble de la base que CUENTA las consultas que recibe y de qué columnas van. */
function dobleQueCuenta(fila: { epoch: Date; role: string } | null) {
  const consultas: { tabla: unknown; columnas: string[] }[] = [];
  const db = {
    select(campos: Record<string, { name?: string }>) {
      const columnas = Object.values(campos)
        .map((c) => c?.name ?? '?')
        .sort();
      return {
        from(tabla: unknown) {
          consultas.push({ tabla, columnas });
          const encadenable = {
            where: () => encadenable,
            limit: () => Promise.resolve(fila ? [fila] : []),
          };
          return encadenable;
        },
      };
    },
  };
  return { db: db as unknown as PgDatabase<never, never, never>, consultas };
}

describe('SPEC-034 CA-12: una sola lectura sobre users, con la época y el rol juntos', () => {
  const epoch = new Date('2026-08-19T10:00:00.000Z');

  it('resolver una petición autenticada ejecuta EXACTAMENTE una lectura', async () => {
    const { db, consultas } = dobleQueCuenta({ epoch, role: 'completo' });

    const entrante: SessionShape = { user: { email: 'a@b.c' } };
    const sesion = await resolveSessionWithEpoch(db, entrante, {
      id: 'u-1',
      credentialEpoch: toEpochClaim(epoch),
    });

    expect(
      consultas.length,
      'Dos consultas separadas suspenden CA-12 aunque el comportamiento visible sea correcto.',
    ).toBe(1);
    expect(sesion.user?.role).toBe('completo');
  });

  it('y de esa MISMA consulta salen a la vez la época de credencial y el rol', async () => {
    const { db, consultas } = dobleQueCuenta({ epoch, role: 'admin' });
    const entrante: SessionShape = { user: {} };
    await resolveSessionWithEpoch(db, entrante, { id: 'u-1', credentialEpoch: toEpochClaim(epoch) });

    expect(consultas[0].tabla).toBe(users);
    expect(consultas[0].columnas).toEqual(['password_changed_at', 'role']);
  });

  it('una época caducada sigue cortando la sesión, y tampoco gasta una segunda consulta', async () => {
    const { db, consultas } = dobleQueCuenta({ epoch, role: 'admin' });
    const entrante: SessionShape = { user: { email: 'a@b.c' } };
    const sesion = await resolveSessionWithEpoch(db, entrante, {
      id: 'u-1',
      credentialEpoch: toEpochClaim(new Date(epoch.getTime() - 1)),
    });
    expect(sesion.user).toBeUndefined();
    expect(consultas.length).toBe(1);
  });

  it('sin id en el token no se consulta nada (ADR-016): cero lecturas', async () => {
    const { db, consultas } = dobleQueCuenta({ epoch, role: 'admin' });
    const entrante: SessionShape = { user: { email: 'a@b.c' } };
    const sesion = await resolveSessionWithEpoch(db, entrante, {});
    expect(sesion.user).toBeUndefined();
    expect(consultas.length).toBe(0);
  });
});

describe('SPEC-034 CA-12 (integración): contra Postgres de verdad, una sola sentencia sobre users', () => {
  let db: TestDb;
  let client: Awaited<ReturnType<typeof makeTestDb>>['client'];

  beforeEach(async () => {
    ({ db, client } = await makeTestDb());
  });

  it('resolveSessionWithEpoch emite una única sentencia que toca users, y trae rol y época', async () => {
    const creado = await registerUser(db, 'ana@example.com', PWD);
    await db.update(users).set({ role: 'completo' }).where(eq(users.id, creado.id));
    const login = await verifyCredentials(db, 'ana@example.com', PWD);

    // Contador al nivel del cliente: lo que de verdad llega al motor.
    const original = client.query.bind(client);
    const sentencias: string[] = [];
    const instrumentado = (sql: string, ...rest: unknown[]) => {
      sentencias.push(sql);
      return (original as (...a: unknown[]) => unknown)(sql, ...rest);
    };
    (client as unknown as { query: unknown }).query = instrumentado;

    const entrante: SessionShape = { user: { email: creado.email } };
    const sesion = await resolveSessionWithEpoch(db, entrante, {
      id: creado.id,
      credentialEpoch: toEpochClaim(login.passwordChangedAt),
    });

    const sobreUsers = sentencias.filter((s) => /\busers\b/i.test(s));
    expect(sobreUsers).toHaveLength(1);
    expect(sobreUsers[0]).toMatch(/password_changed_at/);
    expect(sobreUsers[0]).toMatch(/"role"|\brole\b/);
    expect(sesion.user?.id).toBe(creado.id);
    expect(sesion.user?.role).toBe('completo');
  });

  it('readSessionRow devuelve época y rol, o null si el usuario no existe', async () => {
    const creado = await registerUser(db, 'bea@example.com', PWD);
    const fila = await readSessionRow(db, creado.id);
    expect(fila?.role).toBe('tester');
    expect(fila?.epoch).toBeInstanceOf(Date);

    expect(await readSessionRow(db, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
