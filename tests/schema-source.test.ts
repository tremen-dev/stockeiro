import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDb } from '@/db/test-db';

/**
 * SPEC-026 / ADR-019 — El esquema de test es el de producción.
 *
 * Este fichero es la guardia de que existe UNA sola definición del esquema
 * (`src/db/schema.ts` → `drizzle/`) y de que los dos arneses de test la aplican
 * en vez de mantener su propia copia:
 *
 * - CA-1: el arnés unitario monta exactamente el catálogo de las migraciones,
 *   con los nombres de producción.
 * - CA-2: las cláusulas `ON DELETE` de SPEC-024/ADR-017 quedan ancladas contra
 *   el catálogo, no contra el comportamiento (`onDelete` no existe en runtime).
 * - CA-4: ningún arnés vuelve a declarar esquema a mano.
 * - CA-6: `src/db/schema.ts` no puede quedarse sin migrar.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(rootDir, 'drizzle');

type Row = Record<string, unknown>;

/** Catálogo del esquema `public`. La tabla de control de drizzle vive en el
 *  esquema `drizzle` y queda fuera a propósito (ADR-019). */
async function readCatalog(client: PGlite) {
  const q = async (sql: string) => (await client.query<Row>(sql)).rows;
  return {
    tables: await q(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `),
    columns: await q(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, column_name
    `),
    constraints: await q(`
      SELECT rel.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = 'public'
      ORDER BY rel.relname, con.conname
    `),
    indexes: await q(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `),
  };
}

/**
 * Catálogo de referencia: aplica los `.sql` de `drizzle/` en el orden del
 * journal, sentencia a sentencia, sin pasar por el migrador. Es a propósito un
 * camino distinto del que usa `makeTestDb()`, para que la comparación de CA-1
 * signifique algo y no sea el arnés midiéndose a sí mismo.
 */
async function catalogFromMigrationFiles() {
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: { idx: number; tag: string }[] };
  const client = new PGlite();
  for (const entry of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    const sql = readFileSync(join(migrationsDir, `${entry.tag}.sql`), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim() === '') continue;
      await client.exec(statement);
    }
  }
  const catalog = await readCatalog(client);
  await client.close();
  return catalog;
}

describe('SPEC-026 — una sola definición del esquema', () => {
  let harness: Awaited<ReturnType<typeof makeTestDb>>;
  let harnessCatalog: Awaited<ReturnType<typeof readCatalog>>;

  beforeAll(async () => {
    harness = await makeTestDb();
    harnessCatalog = await readCatalog(harness.client);
  });

  afterAll(async () => {
    await harness.client.close();
  });

  describe('CA-1: el arnés unitario monta el esquema de producción', () => {
    it('el catálogo del arnés es exactamente el que producen las migraciones', async () => {
      const expected = await catalogFromMigrationFiles();
      expect(harnessCatalog.tables).toEqual(expected.tables);
      expect(harnessCatalog.columns).toEqual(expected.columns);
      expect(harnessCatalog.constraints).toEqual(expected.constraints);
      expect(harnessCatalog.indexes).toEqual(expected.indexes);
    });

    it('las restricciones únicas llevan los nombres de producción', () => {
      const names = harnessCatalog.constraints.map((c) => c.conname as string);
      for (const expected of [
        'watched_user_symbol',
        'users_email_unique',
        'quotes_symbol_id_unique',
        'password_reset_tokens_token_hash_unique',
        'quote_diagnostics_symbol_id_unique',
      ]) {
        expect(names).toContain(expected);
      }
    });

    it('no queda ningún nombre de los que generaba el DDL a mano', () => {
      const names = new Set([
        ...harnessCatalog.constraints.map((c) => c.conname as string),
        ...harnessCatalog.indexes.map((i) => i.indexname as string),
      ]);
      for (const legacy of [
        'watched_symbols_user_id_symbol_id_key',
        'users_email_key',
        'quotes_symbol_id_key',
        'password_reset_tokens_token_hash_key',
        'quote_diagnostics_symbol_id_key',
      ]) {
        expect(names.has(legacy)).toBe(false);
      }
    });
  });

  describe('CA-2: las cláusulas ON DELETE de SPEC-024 quedan ancladas', () => {
    const fkDefs = () =>
      harnessCatalog.constraints
        .filter((c) => (c.def as string).startsWith('FOREIGN KEY'))
        .map((c) => ({
          table: c.table_name as string,
          name: c.conname as string,
          def: c.def as string,
        }));

    it('zone_triggers.watched_symbol_id → watched_symbols.id es ON DELETE CASCADE', () => {
      const fk = fkDefs().find(
        (f) => f.table === 'zone_triggers' && f.def.includes('(watched_symbol_id)'),
      );
      expect(fk).toBeDefined();
      expect(fk!.def).toMatch(/REFERENCES watched_symbols\(id\)/);
      expect(fk!.def).toMatch(/ON DELETE CASCADE/);
    });

    it('notifications.zone_trigger_id → zone_triggers.id es ON DELETE SET NULL', () => {
      const fk = fkDefs().find(
        (f) => f.table === 'notifications' && f.def.includes('(zone_trigger_id)'),
      );
      expect(fk).toBeDefined();
      expect(fk!.def).toMatch(/REFERENCES zone_triggers\(id\)/);
      expect(fk!.def).toMatch(/ON DELETE SET NULL/);
    });

    it('ninguna otra clave foránea declara ON DELETE', () => {
      const conOnDelete = fkDefs()
        .filter((f) => /ON DELETE/.test(f.def))
        .map((f) => f.name)
        .sort();
      expect(conOnDelete).toEqual([
        'notifications_zone_trigger_id_zone_triggers_id_fk',
        'zone_triggers_watched_symbol_id_watched_symbols_id_fk',
      ]);
    });
  });

  describe('CA-4: no queda ninguna segunda definición del esquema', () => {
    // Fragmentado para que el propio test no case con su regla al leerse a sí
    // mismo si algún día alguien lo mueve dentro de un arnés.
    const ddl = [
      new RegExp(`CREATE${'\\s'}+TABLE`, 'i'),
      new RegExp(`ALTER${'\\s'}+TABLE`, 'i'),
      new RegExp(`CREATE${'\\s'}+(UNIQUE${'\\s'}+)?INDEX`, 'i'),
    ];

    for (const harnessFile of ['src/db/test-db.ts', 'tests/e2e/server.mjs']) {
      it(`${harnessFile} no contiene DDL escrito a mano`, () => {
        const source = readFileSync(join(rootDir, harnessFile), 'utf8');
        for (const pattern of ddl) {
          expect(
            pattern.test(source),
            `${harnessFile} vuelve a declarar esquema a mano (${pattern.source}). ` +
              'El esquema tiene una sola fuente: src/db/schema.ts → drizzle/ (ADR-019).',
          ).toBe(false);
        }
      });
    }
  });

  describe('CA-6: src/db/schema.ts no puede quedarse sin migrar', () => {
    it('drizzle/ está al día respecto de src/db/schema.ts', () => {
      // El probe vive DENTRO del repo a propósito: `drizzle-kit generate` resuelve
      // `--out` contra el cwd y descarta las rutas absolutas, y además termina con
      // código 0 aunque falle. Un probe en el temp del sistema hace que la guardia
      // pase siempre sin haber comprobado nada.
      const probeRel = `node_modules/.cache/spec026-guard-${process.pid}-${Date.now()}`;
      const probeAbs = join(rootDir, probeRel);
      try {
        cpSync(migrationsDir, probeAbs, { recursive: true });
        const before = readdirSync(probeAbs).filter((f) => f.endsWith('.sql')).length;
        const output = execFileSync(
          'npx',
          [
            'drizzle-kit',
            'generate',
            '--dialect',
            'postgresql',
            '--schema',
            './src/db/schema.ts',
            '--out',
            probeRel,
          ],
          { cwd: rootDir, encoding: 'utf8', stdio: 'pipe', shell: true, timeout: 120_000 },
        );
        // drizzle-kit sale con 0 pase lo que pase, así que una invocación rota se
        // vería igual que "no hay cambios". Sin esto, la guardia puede morir muda.
        expect(
          /error|ENOENT/i.test(output),
          `La guardia de esquema no pudo ejecutarse (drizzle-kit falló):\n${output}`,
        ).toBe(false);

        // El criterio es "¿apareció un fichero?": drizzle-kit no escribe nada si no
        // hay cambios, y emite un .sql nuevo si los hay.
        const after = readdirSync(probeAbs).filter((f) => f.endsWith('.sql')).sort();
        expect(
          after.length,
          'src/db/schema.ts tiene cambios de esquema que NO están en drizzle/. ' +
            'Ejecuta `npm run db:generate` y commitea la migración: si no, los tests y ' +
            'producción vuelven a correr contra esquemas distintos (SPEC-026/ADR-019). ' +
            'Ojo con `onDelete`: no tiene ningún efecto en runtime, así que ningún test ' +
            'de comportamiento delataría el olvido. ' +
            `Migración que drizzle-kit quiso generar: ${after.slice(before).join(', ')}`,
        ).toBe(before);
      } finally {
        rmSync(probeAbs, { recursive: true, force: true });
      }
    }, 180_000);
  });
});
