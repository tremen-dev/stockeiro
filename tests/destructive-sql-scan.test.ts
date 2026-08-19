import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  detectar,
  escanear,
  evaluar,
  SALIDA,
  FICHERO_DE_DESBLOQUEOS,
} from '../scripts/scan-destructive-sql.mjs';

/**
 * SPEC-032 CA-6 … CA-10 y CA-12 — `scripts/scan-destructive-sql.mjs`
 * (ADR-018 D-5.2).
 *
 * Tres capas, y cada una prueba algo que las otras no pueden:
 *
 *   - **Unitarios sobre la detección pura**, con SQL sintético: un caso por
 *     patrón marcado y un caso por cada forma de NO marcarlo (comentario de
 *     línea, comentario de bloque, literal de cadena, `dropped_things`). La tasa
 *     de falsos positivos es parte del contrato: si un día alguien "mejora" el
 *     detector para que marque `ADD COLUMN`, se cae aquí el mismo día.
 *   - **El `drizzle/` real del repositorio** (CA-8), que fija la calibración
 *     medida: exactamente `0001` y `0007` de diez.
 *   - **Subprocesos** contra directorios sintéticos en un temporal, porque el
 *     código de salida es el contrato y solo existe cuando hay proceso.
 *
 * Ningún test sale a la red ni abre una base de datos (CA-14.4).
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(rootDir, 'scripts', 'scan-destructive-sql.mjs');
const drizzleDir = join(rootDir, 'drizzle');

type Run = { code: number; stdout: string; stderr: string };

function run(args: string[]): Promise<Run> {
  return new Promise((resolveRun) => {
    execFile(process.execPath, [scriptPath, ...args], { encoding: 'utf8' }, (error, stdout, stderr) => {
      const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 1;
      resolveRun({ code, stdout, stderr });
    });
  });
}

/** Un `drizzle/` de juguete: journal en orden + los `.sql` que enumera. */
function drizzleSintetico(
  base: string,
  migraciones: Record<string, string>,
  desbloqueos?: unknown,
): string {
  const dir = mkdtempSync(join(base, 'drizzle-'));
  mkdirSync(join(dir, 'meta'), { recursive: true });
  const entries = Object.keys(migraciones).map((tag, idx) => ({
    idx,
    version: '7',
    when: 1780000000000 + idx,
    tag,
    breakpoints: true,
  }));
  writeFileSync(
    join(dir, 'meta', '_journal.json'),
    JSON.stringify({ version: '7', dialect: 'postgresql', entries }, null, 2),
    'utf8',
  );
  for (const [tag, sql] of Object.entries(migraciones)) {
    writeFileSync(join(dir, `${tag}.sql`), sql, 'utf8');
  }
  if (desbloqueos !== undefined) {
    writeFileSync(join(dir, FICHERO_DE_DESBLOQUEOS), JSON.stringify(desbloqueos, null, 2), 'utf8');
  }
  return dir;
}

let temporal: string;
beforeAll(() => {
  temporal = mkdtempSync(join(tmpdir(), 'spec032-'));
});
afterAll(() => {
  rmSync(temporal, { recursive: true, force: true });
});

const patrones = (sql: string) => detectar(sql).map((h) => h.patron);

describe('SPEC-032 CA-6: el escáner existe, es autosuficiente y no necesita ni git ni red', () => {
  it('scripts/scan-destructive-sql.mjs existe', () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('6.2 — no importa nada fuera de la biblioteca estándar de Node', () => {
    const source = readFileSync(scriptPath, 'utf8');
    const especificadores = [
      ...source.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm),
      ...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]/g),
      ...source.matchAll(/\brequire\(\s*['"]([^'"]+)['"]/g),
    ].map((m) => m[1]);
    expect(especificadores.length).toBeGreaterThan(0);
    for (const especificador of especificadores) {
      expect(especificador).toMatch(/^node:/);
    }
  });

  it('6.1 — no invoca git, ni una rama base, ni GitHub, ni la red', () => {
    // Se mira el CÓDIGO, no la cabecera: el porqué de todo esto está escrito ahí
    // arriba y menciona git y GitHub a propósito.
    const codigo = readFileSync(scriptPath, 'utf8').split('*/').slice(1).join('*/');
    for (const prohibido of [
      /\bexecFile\b/,
      /\bexecSync\b/,
      /\bspawn\b/,
      /node:child_process/,
      /\bfetch\s*\(/,
      /https?:\/\//,
    ]) {
      expect(codigo, `El escáner usa ${prohibido}: deja de ser autosuficiente`).not.toMatch(
        prohibido,
      );
    }
  });

  it('6.1 — lee los .sql en el orden del journal, no en el del sistema de ficheros', () => {
    const dir = drizzleSintetico(temporal, {
      '0002_tercera': 'ALTER TABLE "a" ADD COLUMN "c" text;',
      '0000_primera': 'CREATE TABLE "a" ("id" uuid);',
      '0001_segunda': 'ALTER TABLE "a" ADD COLUMN "b" text;',
    });
    expect(escanear(dir).ficheros.map((f) => f.tag)).toEqual([
      '0002_tercera',
      '0000_primera',
      '0001_segunda',
    ]);
  });

  it('6.3 — `--help` sale con 0 y documenta los tres códigos de salida', async () => {
    const { code, stdout } = await run(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain(FICHERO_DE_DESBLOQUEOS);
    for (const codigo of ['0', '1', '2']) {
      expect(stdout).toMatch(new RegExp(`(^|\\n)\\s*${codigo}\\s+\\S`));
    }
  });

  it('los códigos de salida exportados son el contrato: 0 / 1 / 2', () => {
    expect(SALIDA).toEqual({ LIMPIO: 0, MARCADO: 1, USO: 2 });
  });

  it('6.3 — un `drizzle/` ilegible es uso incorrecto: sale con 2', async () => {
    const { code } = await run(['--dir', join(temporal, 'no-existe-este-directorio')]);
    expect(code).toBe(SALIDA.USO);
  });

  it('6.3 — una bandera desconocida sale con 2', async () => {
    const { code } = await run(['--rama-base', 'main']);
    expect(code).toBe(SALIDA.USO);
  });
});

describe('SPEC-032 CA-7: marca lo que ADR-018 D-5.2 enumera', () => {
  const MARCADOS: ReadonlyArray<[string, string]> = [
    ['DROP TABLE "cosas";', 'DROP'],
    ['ALTER TABLE "symbols" DROP CONSTRAINT "symbols_ticker_unique";', 'DROP'],
    ['ALTER TABLE "symbols" DROP COLUMN "exchange";', 'DROP'],
    ['DROP INDEX "symbols_ticker_idx";', 'DROP'],
    ['ALTER TABLE "symbols" RENAME TO "instruments";', 'RENAME'],
    ['ALTER TABLE "symbols" RENAME COLUMN "name" TO "label";', 'RENAME'],
    ['TRUNCATE TABLE "quotes";', 'TRUNCATE'],
    ['DELETE FROM "quotes" WHERE "price" IS NULL;', 'DELETE FROM'],
    ['ALTER TABLE "symbols" ALTER COLUMN "mic_code" SET NOT NULL;', 'ALTER COLUMN … SET NOT NULL'],
    ['ALTER TABLE "symbols" ALTER COLUMN "name" TYPE varchar(64);', 'ALTER COLUMN … TYPE'],
    [
      'ALTER TABLE "symbols" ALTER COLUMN "name" SET DATA TYPE varchar(64);',
      'ALTER COLUMN … TYPE',
    ],
  ];

  for (const [sql, patron] of MARCADOS) {
    it(`marca ${patron}: ${sql}`, () => {
      expect(patrones(sql)).toContain(patron);
    });
  }

  it('no distingue mayúsculas de minúsculas', () => {
    expect(patrones('alter table symbols drop constraint c;')).toContain('DROP');
    expect(patrones('Truncate Table quotes;')).toContain('TRUNCATE');
  });

  it('respeta límites de palabra: informa de la línea de cada hallazgo', () => {
    const sql = 'CREATE TABLE "a" ("id" uuid);\n--> statement-breakpoint\nDROP TABLE "a";\n';
    const hallazgos = detectar(sql);
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].linea).toBe(3);
    expect(hallazgos[0].sentencia).toContain('DROP TABLE');
  });
});

describe('SPEC-032 CA-7: y no marca folklore', () => {
  const LIMPIOS: ReadonlyArray<[string, string]> = [
    ['comentario de línea', '-- Aquí antes había un DROP TABLE "viejo";\nCREATE TABLE "a" ("id" uuid);'],
    ['comentario de bloque', '/* DROP TABLE "viejo";\n   TRUNCATE "otro"; */\nCREATE TABLE "a" ("id" uuid);'],
    [
      'literal de cadena',
      `INSERT INTO "notes" ("body") VALUES ('DROP TABLE x; RENAME y; TRUNCATE z');`,
    ],
    ['identificador que contiene la palabra', 'CREATE TABLE "dropped_things" ("id" uuid);'],
    ['columna que contiene la palabra', 'ALTER TABLE "a" ADD COLUMN "renamed_at" timestamp;'],
    ['CREATE TABLE', 'CREATE TABLE "a" ("id" uuid PRIMARY KEY, "x" text NOT NULL);'],
    ['ADD COLUMN', 'ALTER TABLE "symbols" ADD COLUMN "instrument_type" text;'],
    [
      'ADD COLUMN con NOT NULL (no es ALTER COLUMN … SET NOT NULL)',
      'ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp with time zone DEFAULT now() NOT NULL;',
    ],
    [
      'ADD CONSTRAINT con ON DELETE (no es DELETE FROM)',
      'ALTER TABLE "zone_triggers" ADD CONSTRAINT "fk" FOREIGN KEY ("watched_symbol_id") REFERENCES "public"."watched_symbols"("id") ON DELETE cascade ON UPDATE no action;',
    ],
    ['CREATE INDEX', 'CREATE INDEX "symbols_ticker_idx" ON "symbols" USING btree ("ticker");'],
    [
      'UPDATE: es la mitad sancionada de expand/contract (CA-7.3)',
      `UPDATE symbols SET mic_code = 'BMEX' WHERE mic_code IN ('XMAD', 'XMCE');`,
    ],
  ];

  for (const [nombre, sql] of LIMPIOS) {
    it(`no marca ${nombre}`, () => {
      expect(detectar(sql), `Falso positivo en: ${sql}`).toEqual([]);
    });
  }

  it('el separador `--> statement-breakpoint` trocea, no se lee como comentario', () => {
    const sql =
      'ALTER TABLE "a" ADD COLUMN "b" text;--> statement-breakpoint\nDROP TABLE "c";--> statement-breakpoint\nDROP TABLE "d";';
    expect(detectar(sql)).toHaveLength(2);
  });

  it('un DROP escondido tras un comentario en la misma línea SÍ se marca', () => {
    // El comentario se retira; lo que queda es SQL de verdad.
    expect(patrones('DROP TABLE "a"; -- adiós')).toContain('DROP');
  });
});

describe('SPEC-032 CA-8: calibración medida sobre el árbol de hoy', () => {
  it('el drizzle/ real tiene once migraciones en el journal', () => {
    // Nueve hasta SPEC-032; la décima es `0009_user_role` (SPEC-034) y la undécima
    // `0010_registration_gate_and_cron_runs` (SPEC-037). Las dos, aditivas.
    expect(escanear(drizzleDir).ficheros).toHaveLength(11);
  });

  it('marca exactamente 0001 y 0007, y ninguna de las otras nueve', () => {
    const marcados = escanear(drizzleDir)
      .ficheros.filter((f) => f.hallazgos.length > 0)
      .map((f) => f.tag);
    expect(
      marcados,
      'La tasa de falsos positivos es parte del contrato: si esto cambia sin que ' +
        'cambien las migraciones, el detector ha empezado a marcar de más o de menos.',
    ).toEqual(['0001_symbol_market_identity', '0007_tearful_roughhouse']);
  });

  it('0001 tiene una sentencia destructiva y 0007 tiene dos', () => {
    const porTag = new Map(escanear(drizzleDir).ficheros.map((f) => [f.tag, f.hallazgos.length]));
    expect(porTag.get('0001_symbol_market_identity')).toBe(1);
    expect(porTag.get('0007_tearful_roughhouse')).toBe(2);
  });
});

describe('SPEC-032 CA-9: el desbloqueo es explícito, escrito y versionado', () => {
  const DESTRUCTIVA = 'ALTER TABLE "a" DROP CONSTRAINT "c";';
  const DOS_DESTRUCTIVAS = `${DESTRUCTIVA}--> statement-breakpoint\nALTER TABLE "a" DROP CONSTRAINT "d";`;
  const COMPLETO = {
    spec: 'SPEC-999',
    reason: 'hace falta porque sí, y aquí está escrito',
    rollback: 'se repone la restricción con un ADD CONSTRAINT idéntico',
    statements: 1,
  };

  const veredicto = (migraciones: Record<string, string>, desbloqueos?: unknown) => {
    const dir = drizzleSintetico(temporal, migraciones, desbloqueos);
    return evaluar(escanear(dir));
  };

  it('sin nada destructivo, sale limpio aunque no haya fichero de desbloqueos', () => {
    expect(veredicto({ '0000_a': 'CREATE TABLE "a" ("id" uuid);' }).salida).toBe(SALIDA.LIMPIO);
  });

  it('9.1 — marcado sin entrada de desbloqueo: falla y lo nombra', () => {
    const r = veredicto({ '0000_a': DESTRUCTIVA });
    expect(r.salida).toBe(SALIDA.MARCADO);
    expect(r.problemas.join('\n')).toContain('0000_a');
  });

  it('con desbloqueo completo, sale con 0', () => {
    const r = veredicto({ '0000_a': DESTRUCTIVA }, { '0000_a': COMPLETO });
    expect(r.problemas).toEqual([]);
    expect(r.salida).toBe(SALIDA.LIMPIO);
  });

  it('9.2 — reason vacío no es un desbloqueo, es una casilla marcada', () => {
    const r = veredicto({ '0000_a': DESTRUCTIVA }, { '0000_a': { ...COMPLETO, reason: '   ' } });
    expect(r.salida).toBe(SALIDA.MARCADO);
    expect(r.problemas.join('\n')).toContain('reason');
  });

  it('9.2 — falta rollback: mismo veredicto', () => {
    const sinRollback = { spec: COMPLETO.spec, reason: COMPLETO.reason, statements: 1 };
    const r = veredicto({ '0000_a': DESTRUCTIVA }, { '0000_a': sinRollback });
    expect(r.salida).toBe(SALIDA.MARCADO);
    expect(r.problemas.join('\n')).toContain('rollback');
  });

  it('9.2 — falta spec: mismo veredicto', () => {
    const sinSpec = { reason: COMPLETO.reason, rollback: COMPLETO.rollback, statements: 1 };
    const r = veredicto({ '0000_a': DESTRUCTIVA }, { '0000_a': sinSpec });
    expect(r.salida).toBe(SALIDA.MARCADO);
    expect(r.problemas.join('\n')).toContain('spec');
  });

  it('9.3 — statements desfasado: falla y dice el número real', () => {
    // El caso de editar una migración ya desbloqueada para colarle una sentencia más.
    const r = veredicto({ '0000_a': DOS_DESTRUCTIVAS }, { '0000_a': COMPLETO });
    expect(r.salida).toBe(SALIDA.MARCADO);
    expect(r.problemas.join('\n')).toMatch(/statements/);
    expect(r.problemas.join('\n')).toContain('2');
  });

  it('9.4 — desbloqueo huérfano de un fichero que no existe', () => {
    const r = veredicto({ '0000_a': 'CREATE TABLE "a" ("id" uuid);' }, { '0009_fantasma': COMPLETO });
    expect(r.salida).toBe(SALIDA.MARCADO);
    expect(r.problemas.join('\n')).toContain('0009_fantasma');
  });

  it('9.4 — desbloqueo huérfano de un fichero que ya no marca nada', () => {
    const r = veredicto({ '0000_a': 'CREATE TABLE "a" ("id" uuid);' }, { '0000_a': COMPLETO });
    expect(r.salida).toBe(SALIDA.MARCADO);
    expect(r.problemas.join('\n')).toMatch(/hu[ée]rfano/i);
  });

  it('un fichero de desbloqueos que no es JSON válido sale con 2', async () => {
    const dir = drizzleSintetico(temporal, { '0000_a': DESTRUCTIVA });
    writeFileSync(join(dir, FICHERO_DE_DESBLOQUEOS), '{ esto no es json', 'utf8');
    const { code } = await run(['--dir', dir]);
    expect(code).toBe(SALIDA.USO);
  });

  it('el repositorio trae sembradas las dos entradas de hoy, con justificación real', () => {
    const desbloqueos = JSON.parse(
      readFileSync(join(drizzleDir, FICHERO_DE_DESBLOQUEOS), 'utf8'),
    ) as Record<string, { spec: string; reason: string; rollback: string; statements: number }>;

    expect(Object.keys(desbloqueos).sort()).toEqual([
      '0001_symbol_market_identity',
      '0007_tearful_roughhouse',
    ]);
    expect(desbloqueos['0001_symbol_market_identity'].statements).toBe(1);
    expect(desbloqueos['0007_tearful_roughhouse'].statements).toBe(2);
    for (const entrada of Object.values(desbloqueos)) {
      expect(entrada.spec).toMatch(/^SPEC-\d{3}$/);
      expect(entrada.reason.trim().length).toBeGreaterThan(30);
      expect(entrada.rollback.trim().length).toBeGreaterThan(30);
    }
  });
});

describe('SPEC-032 CA-10: el rojo es accionable sin abrir el código del escáner', () => {
  it('nombra fichero, línea y sentencia recortada, e imprime el JSON exacto que hay que pegar', async () => {
    const dir = drizzleSintetico(temporal, {
      '0000_inocente': 'CREATE TABLE "a" ("id" uuid);',
      '0001_culpable':
        'ALTER TABLE "a" ADD COLUMN "b" text;--> statement-breakpoint\nALTER TABLE "a" DROP CONSTRAINT "a_b_unique";',
    });

    const { code, stderr } = await run(['--dir', dir]);

    expect(code).toBe(SALIDA.MARCADO);
    expect(stderr).toContain('0001_culpable.sql');
    expect(stderr).toMatch(/l[íi]nea 2/i);
    expect(stderr).toContain('DROP CONSTRAINT');
    expect(stderr).not.toContain('0000_inocente');

    // El fragmento va entre marcas para que se pueda copiar de un tirón.
    const bloque = stderr.split('8<')[1]?.split('>8')[0] ?? '';
    const pegable = JSON.parse(bloque) as Record<string, Record<string, unknown>>;
    expect(Object.keys(pegable)).toEqual(['0001_culpable']);
    expect(Object.keys(pegable['0001_culpable']).sort()).toEqual([
      'reason',
      'rollback',
      'spec',
      'statements',
    ]);
    expect(pegable['0001_culpable'].statements).toBe(1);
  });
});

describe('SPEC-032 CA-12: `npm test` también lo ejecuta, invocando el mismo script', () => {
  it('el escáner sale con 0 sobre el drizzle/ real del repositorio', async () => {
    // Sin reimplementar la detección: una sola lógica, dos invocadores (la CI y
    // esta suite). Aquí es donde te enteras ANTES de empujar.
    const { code, stdout, stderr } = await run([]);
    expect(code, `El escáner ha fallado:\n${stdout}\n${stderr}`).toBe(SALIDA.LIMPIO);
  });

  it('package.json expone el script db:scan y apunta a este fichero', () => {
    const scripts = (
      JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts;
    expect(scripts['db:scan']).toBe('node scripts/scan-destructive-sql.mjs');
  });
});
