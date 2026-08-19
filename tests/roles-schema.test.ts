import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { users } from '@/db/schema';
// El escáner de SPEC-032 se consume tal cual, sin tipos: es un script de node.
import * as escaner from '../scripts/scan-destructive-sql.mjs';

type Marcada = { tag: string; hallazgos: unknown[] };
const escanear = (dir: string) =>
  (escaner as unknown as { escanear: (d: string) => { ficheros: Marcada[] } }).escanear(dir);

/**
 * SPEC-034 CA-1 / CA-2 / CA-3 — la columna `role` en `users`.
 *
 * El esquema se aplica DESDE LAS MIGRACIONES (ADR-019, SPEC-026): aquí no se
 * escribe DDL. Lo que se comprueba es lo que producen los `.sql` de `drizzle/`,
 * que es exactamente lo que correrá en Neon.
 *
 * La migración de esta spec se llama `0009_user_role` y tiene un nombre elegido a
 * mano —como `0004_backfill_operating_mic`— porque estos tests la nombran: CA-2
 * necesita aplicar todo LO ANTERIOR, sembrar cuentas y solo entonces aplicarla.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(rootDir, 'drizzle');
const TAG = '0009_user_role';

type JournalEntry = { idx: number; tag: string };

function journalEntries(): JournalEntry[] {
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: JournalEntry[] };
  return [...journal.entries].sort((a, b) => a.idx - b.idx);
}

/** Aplica un `.sql` de `drizzle/` sentencia a sentencia, sin pasar por el migrador. */
async function aplicar(client: PGlite, tag: string) {
  const sql = readFileSync(join(migrationsDir, `${tag}.sql`), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    if (statement.trim() === '') continue;
    await client.exec(statement);
  }
}

describe('SPEC-034 CA-1: la columna existe, con dominio cerrado y por migración', () => {
  let harness: Awaited<ReturnType<typeof makeTestDb>>;

  beforeAll(async () => {
    harness = await makeTestDb();
  });

  afterAll(async () => {
    await harness.client.close();
  });

  /** Una cuenta cualquiera, por SQL crudo: aquí se mide el ESQUEMA, no el código. */
  async function sembrar(email: string): Promise<string> {
    const { rows } = await harness.client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id`,
      [email],
    );
    return rows[0].id;
  }

  it('users tiene una columna `role` de tipo text y NOT NULL', async () => {
    const { rows } = await harness.client.query<{
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(`
      SELECT data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('text');
    expect(rows[0].is_nullable).toBe('NO');
  });

  it('el dominio se impone con un CHECK, no con un enum de Postgres (ADR-021 pto. 1)', async () => {
    const { rows: tipos } = await harness.client.query<{ typname: string }>(
      `SELECT typname FROM pg_type WHERE typtype = 'e'`,
    );
    expect(tipos.map((t) => t.typname)).toEqual([]);

    const { rows: checks } = await harness.client.query<{ def: string }>(`
      SELECT pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'users' AND con.contype = 'c'
    `);
    const defs = checks.map((c) => c.def).join(' ');
    for (const valor of ['tester', 'completo', 'admin']) {
      expect(defs).toContain(valor);
    }
  });

  it('la base ACEPTA los tres valores del dominio', async () => {
    const id = await sembrar('ca1-validos@example.com');
    for (const rol of ['tester', 'completo', 'admin']) {
      await harness.client.query(`UPDATE users SET role = $1 WHERE id = $2`, [rol, id]);
      const { rows } = await harness.client.query<{ role: string }>(
        `SELECT role FROM users WHERE id = $1`,
        [id],
      );
      expect(rows[0].role).toBe(rol);
    }
  });

  it('la base RECHAZA cualquier valor distinto: un UPDATE a "root" o a "" falla', async () => {
    const id = await sembrar('ca1-invalidos@example.com');
    for (const impostor of ['root', '', 'TESTER', 'operador', 'Admin']) {
      await expect(
        harness.client.query(`UPDATE users SET role = $1 WHERE id = $2`, [impostor, id]),
        `la base aceptó role = ${JSON.stringify(impostor)}`,
      ).rejects.toThrow();
    }
    // Y NULL tampoco, que es la otra manera de quedarse sin rol.
    await expect(
      harness.client.query(`UPDATE users SET role = NULL WHERE id = $1`, [id]),
    ).rejects.toThrow();
  });

  it('RI-01: la migración no borra, no renombra y no estrecha nada', () => {
    const marcada = escanear(migrationsDir).ficheros.find((f) => f.tag === TAG);
    expect(marcada, `no existe la migración ${TAG}`).toBeDefined();
    expect(
      marcada!.hallazgos,
      'La migración de SPEC-034 tiene que ser puramente aditiva (RI-01): ' +
        'si el escáner la marca, o sobra una sentencia o hace falta un desbloqueo escrito.',
    ).toEqual([]);
  });

  it('RI-01: el código anterior a esta spec sigue funcionando contra el esquema nuevo', async () => {
    // Un INSERT tal cual lo hacía SPEC-001, sin saber que existe `role`.
    await expect(
      harness.client.query(
        `INSERT INTO users (email, password_hash) VALUES ('ri01@example.com', 'hash')`,
      ),
    ).resolves.toBeDefined();
    // Y las columnas de antes siguen ahí, con su forma (RN-02, ADR-016).
    const { rows } = await harness.client.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY column_name
    `);
    expect(rows.map((r) => r.column_name)).toEqual([
      'created_at',
      'email',
      'id',
      'password_changed_at',
      'password_hash',
      'role',
    ]);
  });
});

describe('SPEC-034 CA-2: las cuentas que ya existían quedan como admin', () => {
  it('sembrando ANTES de la migración, todas quedan admin sin ningún UPDATE manual', async () => {
    const entries = journalEntries();
    const nueva = entries.find((e) => e.tag === TAG);
    expect(nueva, `${TAG} no está en el journal de drizzle/`).toBeDefined();
    const anteriores = entries.filter((e) => e.idx < nueva!.idx);
    expect(anteriores.length).toBeGreaterThan(0);

    const client = new PGlite();
    try {
      // 1. La base tal y como estaba ANTES de esta spec.
      for (const entry of anteriores) await aplicar(client, entry.tag);

      // Prueba de que de verdad estamos en el "antes": la columna no existe todavía.
      const { rows: antes } = await client.query<{ n: string }>(`
        SELECT count(*) AS n FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
      `);
      expect(Number(antes[0].n)).toBe(0);

      // 2. Cuentas creadas antes de la migración — el censo de F-SPEC-034-5.
      for (const email of ['operador@example.com', 'otra@example.com', 'tercera@example.com']) {
        await client.query(`INSERT INTO users (email, password_hash) VALUES ($1, 'hash')`, [email]);
      }

      // 3. La migración.
      await aplicar(client, TAG);

      // 4. TODAS quedan admin: el despliegue queda operable sin tocar Neon a mano.
      const { rows } = await client.query<{ email: string; role: string }>(
        `SELECT email, role FROM users ORDER BY email`,
      );
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.role, `${row.email} no quedó admin`).toBe('admin');
      }
      const { rows: sinRol } = await client.query<{ n: string }>(
        `SELECT count(*) AS n FROM users WHERE role IS DISTINCT FROM 'admin'`,
      );
      expect(Number(sinRol[0].n)).toBe(0);
    } finally {
      await client.close();
    }
  }, 60_000);

  it('y ninguna pierde acceso a ninguna sección: admin ve las seis', async () => {
    // La contrapartida del backfill (ADR-021 pto. 8) es justo esta: nadie se queda
    // fuera de lo que ya tenía el día del despliegue.
    const { canSee, SECTIONS } = await import('@/lib/auth/sections');
    for (const seccion of SECTIONS) expect(canSee('admin', seccion)).toBe(true);
  });
});

describe('SPEC-034 CA-3: toda cuenta nueva nace tester', () => {
  let db: TestDb;
  let client: PGlite;

  beforeAll(async () => {
    ({ db, client } = await makeTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  it('el registro (registerUser, SPEC-001 CA-1) crea la cuenta con rol tester', async () => {
    const creado = await registerUser(db, 'nueva@example.com', 'clave-secreta-123');
    expect(creado.role).toBe('tester');

    const [fila] = await db.select().from(users);
    expect(fila.role).toBe('tester');
  });

  it('un INSERT directo SIN la columna también da tester: el default de la base es la red', async () => {
    await client.query(`INSERT INTO users (email, password_hash) VALUES ('cruda@example.com', 'h')`);
    const { rows } = await client.query<{ role: string }>(
      `SELECT role FROM users WHERE email = 'cruda@example.com'`,
    );
    expect(rows[0].role).toBe('tester');
  });

  it('el default declarado en el esquema aplicado es tester, no admin', async () => {
    const { rows } = await client.query<{ column_default: string | null }>(`
      SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
    `);
    expect(rows[0].column_default).toContain("'tester'");
  });
});
