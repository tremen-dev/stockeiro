import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
 *
 * SPEC-027 añade al bloque de CA-6 el **canario** (su CA-11): la guardia
 * demuestra en cada pasada que sabe detectar, para que "no hay deriva" no pueda
 * confundirse con "la guardia no llegó a correr". El canario corre sobre una
 * sonda SEMBRADA y rebobinada — el estado de partida real de la guardia—, no
 * sobre una vacía: enmienda del 2026-08-18, con la medición al lado de withProbe.
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
    /**
     * Sonda de usar y tirar, y la invocación de `drizzle-kit` YA LIGADA a ella.
     *
     * Aquí, y en ningún otro sitio, se decide la **forma de la ruta** que recibe
     * `--out`. Ni la guardia ni el canario nombran su sonda: la reciben ligada.
     * Eso es deliberado y es lo que sostiene el canario (SPEC-027 CA-11): quien
     * "limpie" esta forma —a absoluta, a otra unidad, a lo que sea— la cambia en
     * los DOS a la vez, y entonces el canario se pone rojo y lo cuenta. Si cada
     * uno nombrara la suya, se podría romper la guardia dejando el canario verde,
     * que es exactamente el agujero que esta enmienda cierra.
     *
     * Sobre la forma de la ruta se han emitido ya TRES veredictos y cada uno
     * corrigió al anterior; dos llegaron a colarse en un documento firmado. Lo
     * medido el 2026-08-18, con la sonda SEMBRADA que es la que usa la guardia de
     * verdad:
     *
     *   sembrada, sin deriva, `--out` RELATIVO → exit 0, "No schema changes…",
     *       8 → 8 `.sql`  → guardia verde, correcto
     *   sembrada, con deriva, `--out` RELATIVO → exit 0, escribe `0008_*.sql`,
     *       8 → 9         → guardia roja, correcto
     *   sembrada, sin deriva, `--out` ABSOLUTO → exit 0, stdout VACÍO, 1395 B en
     *       stderr, 8 → 8
     *   sembrada, con deriva, `--out` ABSOLUTO → exit 0, stdout VACÍO, 1403 B en
     *       stderr, 8 → 8 → **VERDE EN FALSO**
     *   VACÍA,    sin deriva, `--out` ABSOLUTO → funciona: 0 → 1 `.sql`
     *
     * Mecanismo real: `drizzle-kit` **concatena el cwd delante de la ruta
     * absoluta** al buscar el snapshot previo (`ENOENT … 'D:\…\D:\…\meta\
     * 0000_snapshot.json'`). Por eso falla SOLO con la sonda sembrada —el caso de
     * la guardia— y no con la vacía, y por eso el canario viejo, que usaba sonda
     * vacía, no lo cazaba. Y falla con código 0, así que `execFileSync` no lanza
     * y nadie se entera.
     *
     * Esto documenta una MEDICIÓN, no una regla que el test imponga: abajo no hay
     * ninguna aserción sobre la forma de la ruta, ni a favor ni en contra. Un test
     * sobre la forma fosiliza folklore, se ata a una versión de `drizzle-kit` y
     * daría por cerrado un riesgo que seguiría abierto —cubriría esta manera de
     * morir mudo y ninguna otra—. Lo que cubre el riesgo es el canario sembrado.
     * Descartado expresamente por el humano el 2026-08-18.
     */
    function withProbe<T>(
      label: string,
      fn: (probe: {
        /** Dónde vive la sonda, para sembrarla y leerla. */
        dir: string;
        /** La invocación de la guardia, apuntada a ESTA sonda. */
        generate: () => string;
        /** Los `.sql` que hay ahora mismo en la sonda, ordenados. */
        sqlFiles: () => string[];
      }) => T,
    ): T {
      const relPath = `node_modules/.cache/${label}-${process.pid}-${Date.now()}`;
      const dir = join(rootDir, relPath);
      // ↓ LA forma de la ruta de sonda. Un solo sitio, para los dos tests.
      const outArg = relPath;
      try {
        return fn({
          dir,
          generate: () =>
            execFileSync(
              'npx',
              [
                'drizzle-kit',
                'generate',
                '--dialect',
                'postgresql',
                '--schema',
                './src/db/schema.ts',
                '--out',
                outArg,
              ],
              { cwd: rootDir, encoding: 'utf8', stdio: 'pipe', shell: true, timeout: 120_000 },
            ),
          sqlFiles: () =>
            readdirSync(dir)
              .filter((f) => f.endsWith('.sql'))
              .sort(),
        });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    /** Copia `drizzle/` entero: el estado de partida real de la guardia. */
    function seedFull(dir: string) {
      cpSync(migrationsDir, dir, { recursive: true });
    }

    /**
     * Copia `drizzle/` REBOBINADA a su primer apunte: deja `0000_*.sql` y
     * `meta/0000_snapshot.json`, recorta el journal a `idx 0` y borra el resto.
     *
     * Se rebobina al PRIMERO y no "se quita el último" porque el delta contra
     * `0000` solo puede CRECER con cada migración futura, mientras que el último
     * apunte puede ser una migración escrita a mano sin cambio de esquema
     * —`0004_backfill_operating_mic` es una— y dejaría el canario en rojo
     * acusando a la guardia de algo que no pasa.
     */
    function seedRewound(dir: string) {
      cpSync(migrationsDir, dir, { recursive: true });
      const journalPath = join(dir, 'meta', '_journal.json');
      const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
        entries: { idx: number; tag: string }[];
      };
      const first = [...journal.entries].sort((a, b) => a.idx - b.idx)[0];
      writeFileSync(
        journalPath,
        `${JSON.stringify({ ...journal, entries: [first] }, null, 2)}\n`,
        'utf8',
      );
      const keptSnapshot = `${String(first.idx).padStart(4, '0')}_snapshot.json`;
      for (const file of readdirSync(dir)) {
        if (file.endsWith('.sql') && file !== `${first.tag}.sql`) {
          rmSync(join(dir, file), { force: true });
        }
      }
      const metaDir = join(dir, 'meta');
      for (const file of readdirSync(metaDir)) {
        if (file.endsWith('_snapshot.json') && file !== keptSnapshot) {
          rmSync(join(metaDir, file), { force: true });
        }
      }
      return first.tag;
    }

    it('drizzle/ está al día respecto de src/db/schema.ts', () => {
      withProbe('spec026-guard', ({ dir, generate, sqlFiles }) => {
        seedFull(dir);
        const before = sqlFiles();
        generate();

        // El criterio es "¿apareció un fichero?": drizzle-kit no escribe nada si no
        // hay cambios, y emite un .sql nuevo si los hay.
        const after = sqlFiles();
        expect(
          after.length,
          'src/db/schema.ts tiene cambios de esquema que NO están en drizzle/. ' +
            'Ejecuta `npm run db:generate` y commitea la migración: si no, los tests y ' +
            'producción vuelven a correr contra esquemas distintos (SPEC-026/ADR-019). ' +
            'Ojo con `onDelete`: no tiene ningún efecto en runtime, así que ningún test ' +
            'de comportamiento delataría el olvido. ' +
            `Migración que drizzle-kit quiso generar: ${after
              .filter((f) => !before.includes(f))
              .join(', ')}`,
        ).toBe(before.length);
      });
    }, 180_000);

    // SPEC-027 CA-11 — el canario.
    //
    // El test de arriba pasa de dos maneras: porque no hay deriva, o porque la
    // invocación no llegó a hacer nada. Las dos se ven idénticas desde fuera, y la
    // segunda es una guardia muerta que sigue dando verde. Esto lo distingue: la
    // MISMA invocación, sobre una sonda SEMBRADA como la suya pero rebobinada al
    // primer apunte, tiene que reproducir las migraciones que le faltan.
    //
    // Sembrada y no vacía, y esto es la enmienda del 2026-08-18: una sonda vacía es
    // un estado que la guardia no tiene nunca, y resulta ser justo aquel en el que
    // el fallo mudo NO se reproduce. El canario vacío daba verde mientras la
    // guardia se quedaba muda — medido, no supuesto.
    //
    // No depende de POR QUÉ falle la invocación (ruta, binario ausente, argumento
    // renombrado, otra plataforma, un cambio de banderas que aún no conocemos):
    // solo comprueba que el detector detecta, en sus propias condiciones.
    it('la guardia sabe detectar: sobre una sonda rebobinada reproduce las migraciones que faltan', () => {
      withProbe('spec027-canary', ({ dir, generate, sqlFiles }) => {
        const desde = seedRewound(dir);
        const before = sqlFiles();
        generate();
        const after = sqlFiles();
        expect(
          after.length - before.length,
          'La guardia de esquema NO PUDO EJECUTARSE. La lectura probable: la ' +
            'comprobación de deriva está muerta y lleva quién sabe cuánto dando ' +
            'verde sin mirar nada — revisa la invocación de `drizzle-kit generate` ' +
            '(argumentos, binario, cwd, la forma de la ruta de sonda) antes de ' +
            'creerte el verde del test de arriba. La segunda lectura, menos ' +
            `probable: alguien ha reescrito el historial de \`drizzle/\` y el punto ` +
            `de rebobinado (${desde}) ya no tiene deriva pendiente, en cuyo caso ` +
            'lo que hay que arreglar es este canario y no la guardia.',
        ).toBeGreaterThan(0);
      });
    }, 180_000);
  });
});
