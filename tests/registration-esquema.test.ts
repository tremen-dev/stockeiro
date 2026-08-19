import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '@/db/test-db';
import type { PGlite } from '@electric-sql/pglite';
import { SEED_REGISTRATION_SETTINGS } from '@/lib/registration/gate';

/**
 * SPEC-037 CA-1 — los ajustes existen, son UNA SOLA fila y nacen abiertos
 * (ADR-023 ptos. 1 y 7, RI-01).
 *
 * El esquema que se inspecciona aquí es el de PRODUCCIÓN: `makeTestDb()` aplica los
 * `.sql` de `drizzle/`, no una copia (ADR-019 / SPEC-026). Así que lo que este
 * fichero comprueba —columnas, unicidad de la fila, valores sembrados— es
 * literalmente lo que quedará en Neon cuando la PR se abra (F-SPEC-037-1).
 *
 * La propiedad que más importa NO es que existan las columnas: es que **la base
 * impide insertar una segunda fila**. Dos filas de configuración es un defecto
 * silencioso esperando a ocurrir —la app leería una y el operador estaría mirando la
 * otra—, y por eso la unicidad se impone en el esquema (clave primaria constante con
 * CHECK) y no por convenio de quien escriba el `INSERT`.
 */

type Row = Record<string, unknown>;

let client: PGlite;

beforeEach(async () => {
  ({ client } = await makeTestDb());
});

const q = async (sql: string) => (await client.query<Row>(sql)).rows;

const columnas = (tabla: string) =>
  q(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '${tabla}'
    ORDER BY column_name
  `);

describe('SPEC-037 CA-1: la tabla de ajustes del registro', () => {
  it('existe con las columnas que ADR-023 pto. 1 nombra', async () => {
    const cols = new Map(
      (await columnas('registration_settings')).map((c) => [
        c.column_name as string,
        { tipo: c.data_type as string, nullable: c.is_nullable === 'YES' },
      ]),
    );

    expect([...cols.keys()].sort()).toEqual([
      'capacity',
      'id',
      'open_manually',
      'updated_at',
      'updated_by',
    ]);
    expect(cols.get('open_manually')).toEqual({ tipo: 'boolean', nullable: false });
    // `capacity` NULLABLE es parte de la decisión: null = SIN cupo (ADR-023 pto. 1).
    expect(cols.get('capacity')?.nullable).toBe(true);
    expect(cols.get('updated_at')?.nullable).toBe(false);
  });

  it('la fila sembrada por la migración deja el registro ABIERTO y con CUPO 50', async () => {
    const filas = await q('SELECT open_manually, capacity FROM registration_settings');
    expect(filas).toHaveLength(1);
    expect(filas[0].open_manually).toBe(true);
    expect(Number(filas[0].capacity)).toBe(50);

    // Y la semilla de la migración es la MISMA constante nombrada que responde si la
    // fila faltara (ADR-023 pto. 7): un solo sitio, no dos que puedan divergir.
    expect({
      openManually: filas[0].open_manually,
      capacity: Number(filas[0].capacity),
    }).toEqual(SEED_REGISTRATION_SETTINGS);
  });

  it('LA BASE impide insertar una segunda fila, con el id que sea', async () => {
    // Con el mismo id: choca con la clave primaria.
    await expect(
      client.query(`INSERT INTO registration_settings (id, open_manually) VALUES (1, false)`),
    ).rejects.toThrow();

    // Con otro id: choca con el CHECK que fija la clave a un valor constante. Este es
    // el caso que un simple PRIMARY KEY no cubriría, y el que hace que «una sola
    // fila» sea una propiedad de la BASE y no una costumbre del código.
    await expect(
      client.query(`INSERT INTO registration_settings (id, open_manually) VALUES (2, false)`),
    ).rejects.toThrow();

    expect(await q('SELECT count(*)::int AS n FROM registration_settings')).toEqual([{ n: 1 }]);
  });
});

describe('SPEC-037 CA-1: la tabla de ejecuciones del ciclo', () => {
  it('`cron_runs` existe con los contadores de CycleResult, ni uno más', async () => {
    const cols = new Map(
      (await columnas('cron_runs')).map((c) => [
        c.column_name as string,
        { tipo: c.data_type as string, nullable: c.is_nullable === 'YES' },
      ]),
    );

    expect([...cols.keys()].sort()).toEqual([
      'error',
      'finished_at',
      'id',
      'notifications_digests',
      'notifications_entries',
      'outcome',
      'requested',
      'skipped',
      'started_at',
      'triggers_closed',
      'triggers_opened',
      'updated',
    ]);

    // `started_at` se escribe SIEMPRE, antes de ingerir nada (ADR-023 pto. 12).
    expect(cols.get('started_at')?.nullable).toBe(false);
    // `finished_at` NULLABLE es la gracia entera: null = «empezó y no volvió».
    expect(cols.get('finished_at')?.nullable).toBe(true);
  });

  it('nace vacía: una base recién migrada no ha ejecutado ningún ciclo', async () => {
    expect(await q('SELECT count(*)::int AS n FROM cron_runs')).toEqual([{ n: 0 }]);
  });

  it('no tiene `user_id`: es estado OPERATIVO, no dato de nadie (ADR-023 pto. 11)', async () => {
    for (const tabla of ['cron_runs', 'registration_settings']) {
      const nombres = (await columnas(tabla)).map((c) => c.column_name);
      expect(nombres, tabla).not.toContain('user_id');
    }
  });
});

describe('SPEC-037 CA-1: la migración es ADITIVA (RI-01)', () => {
  it('no toca ninguna tabla anterior: el código previo a esta spec sigue valiendo', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { dirname, join, resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const drizzleDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
    const nueva = readdirSync(drizzleDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .at(-1)!;
    const sql = readFileSync(join(drizzleDir, nueva), 'utf8');

    expect(nueva, 'la migración de SPEC-037 debe ser la última del directorio').toMatch(
      /^0010_/,
    );
    // Solo crea y siembra. Ni ALTER de tablas existentes, ni DROP, ni RENAME.
    expect(sql).toMatch(/CREATE TABLE[\s\S]*"registration_settings"/);
    expect(sql).toMatch(/CREATE TABLE[\s\S]*"cron_runs"/);
    expect(sql).not.toMatch(/\bDROP\b|\bRENAME\b|\bTRUNCATE\b|\bDELETE FROM\b/i);
    for (const anterior of ['users', 'quotes', 'watched_symbols', 'transactions', 'notifications']) {
      expect(sql, `la migración toca "${anterior}"`).not.toMatch(
        new RegExp(`ALTER TABLE "${anterior}"`, 'i'),
      );
    }
  });
});
