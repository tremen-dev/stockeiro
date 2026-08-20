import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/**
 * SPEC-032 CA-14 — nada queda conectado.
 *
 * Esta spec entrega las dos guardias; **no** conecta el repositorio a Vercel, no
 * añade puerta post-deploy y no cambia cómo se dispara un despliegue. Eso es
 * SPEC-028 (ADR-018 D-1 y D-6).
 *
 * Es un CA y no una promesa porque es la garantía de que el verificador puede
 * cerrar esta spec **sin desplegar**: un step "ya que estamos" que llamase a
 * producción la convertiría en incerrable, que es justo el error que ADR-018
 * quiso evitar separando el punto 3 del 4. Y aquí importa el doble, porque lo
 * que se entrega es precisamente el código que corre dentro de un build de
 * Vercel.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = join(rootDir, '.github', 'workflows', 'ci.yml');
const drizzleDir = join(rootDir, 'drizzle');
const testsDir = join(rootDir, 'tests');
const scriptsDir = join(rootDir, 'scripts');

type Step = { name?: string; uses?: string; run?: string; env?: Record<string, string> };
type Workflow = { permissions?: unknown; jobs: Record<string, { steps: Step[] }> };

const workflowSource = () => readFileSync(workflowPath, 'utf8');
const workflow = () => parse(workflowSource()) as Workflow;
const steps = () => Object.values(workflow().jobs ?? {}).flatMap((job) => job.steps ?? []);

/** Los cinco ficheros de test que añade esta spec. */
const NUEVOS = [
  'destructive-sql-scan.test.ts',
  'guard-migrate.test.ts',
  'reglas-ingenieria.test.ts',
  'runbook-guardias-migracion.test.ts',
  'spec-032-frontera.test.ts',
];

describe('SPEC-032 CA-14.1: el workflow no gana nada que hable con la red', () => {
  it('el step nuevo ejecuta db:scan y solo eso', () => {
    const paso = steps().find((s) => s.name === 'Migration scan');
    expect(paso, 'No existe el step `Migration scan`').toBeDefined();
    expect(paso!.run!.trim()).toBe('npm run db:scan');
  });

  it('sigue sin una sola referencia a secrets.', () => {
    expect(workflowSource()).not.toMatch(/secrets\./);
  });

  it('permissions sigue siendo contents: read', () => {
    expect(workflow().permissions).toEqual({ contents: 'read' });
  });

  it('5.3 — ningún step migra nada (regla dura de ADR-018 D-4)', () => {
    for (const step of steps()) {
      expect(step.run ?? '').not.toMatch(/db:migrate|drizzle-kit\s+migrate/);
    }
  });

  it('ningún step nombra Vercel ni Neon', () => {
    for (const step of steps()) {
      const texto = `${step.run ?? ''} ${step.uses ?? ''}`;
      expect(texto).not.toMatch(/vercel|neon/i);
    }
  });

  it('ningún step habla con un host externo', () => {
    for (const step of steps()) {
      expect(step.run ?? '').not.toMatch(/https?:\/\//);
    }
  });
});

describe('SPEC-032 CA-14.2: ni puerta post-deploy, ni /api/version, ni check-alive', () => {
  it('el workflow sigue sin invocar check-alive', () => {
    expect(
      workflowSource(),
      'La puerta post-deploy es SPEC-028. Un step aquí exigiría un despliegue para ' +
        'cerrar esta spec.',
    ).not.toContain('check-alive');
  });

  it('el buildCommand no invoca check-alive ni nada que salga a la red', () => {
    const { buildCommand } = JSON.parse(readFileSync(join(rootDir, 'vercel.json'), 'utf8')) as {
      buildCommand: string;
    };
    expect(buildCommand).not.toContain('check-alive');
    expect(buildCommand).not.toMatch(/curl|https?:\/\//);
  });

  it('las dos piezas nuevas no invocan check-alive ni /api/version', () => {
    // Se mira el CÓDIGO, no la cabecera: ahí `scan-destructive-sql.mjs` cita a
    // `check-alive.mjs` como la convención que hereda (SPEC-031), que es
    // exactamente lo que la spec pide que haga.
    for (const script of ['guard-migrate.mjs', 'scan-destructive-sql.mjs']) {
      const codigo = readFileSync(join(scriptsDir, script), 'utf8').split('*/').slice(1).join('*/');
      expect(codigo).not.toContain('check-alive');
      expect(codigo).not.toContain('/api/version');
    }
  });

  it('los dos scripts de esta spec están, y `check-alive.mjs` sigue ahí', () => {
    // Re-encuadrado por SPEC-038 (FOUNDATION §Cómo se trabaja aquí, 2026-08-20).
    //
    // Qué vigilaba antes: que `scripts/` tuviera EXACTAMENTE estos tres ficheros.
    // Qué vigila ahora: que los dos que entrega esta spec sigan ahí y que
    // `check-alive.mjs` —que esta spec no tocó— tampoco haya desaparecido. La
    // propiedad de CA-14.2 no cambia; lo que caducaba era congelar el listado del
    // directorio, que es exactamente el patrón que `LAS_NUEVE` de más abajo ya
    // había dejado de usar para las migraciones, y por el mismo motivo.
    //
    // Quien lo dispara: SPEC-038 CA-12 añade `check-version-bump.mjs`, declarado
    // en su spec y aprobado en su gate.
    const habitantes = readdirSync(scriptsDir).sort();
    for (const script of ['check-alive.mjs', 'guard-migrate.mjs', 'scan-destructive-sql.mjs']) {
      expect(habitantes).toContain(script);
    }
  });
});

/**
 * Las nueve migraciones que había cuando esta spec se cerró. La afirmación de CA-14.3
 * es *"SPEC-032 no añade ninguna"*, y eso es un hecho sobre SU entrega, no una promesa
 * de que el proyecto no vuelva a migrar nunca: por eso se comprueba que las nueve
 * siguen ahí, en su sitio y en su orden, y no que sean las únicas que existen.
 * Enmienda de SPEC-034, que sí trae una décima (`0009_user_role`); la propiedad que
 * este bloque protege —que esta spec no tocó el esquema— queda intacta.
 */
const LAS_NUEVE = [
  '0000_real_tusk.sql',
  '0001_symbol_market_identity.sql',
  '0002_symbol_aliases.sql',
  '0003_import_idempotency.sql',
  '0004_backfill_operating_mic.sql',
  '0005_quote_diagnostics.sql',
  '0006_chemical_chronomancer.sql',
  '0007_tearful_roughhouse.sql',
  '0008_puzzling_eddie_brock.sql',
];

describe('SPEC-032 CA-14.3: ni una migración nueva, ni un cambio de esquema', () => {
  it('las nueve .sql de esta spec siguen ahí, las mismas de siempre y en su orden', () => {
    const sql = readdirSync(drizzleDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    expect(sql.slice(0, LAS_NUEVE.length)).toEqual(LAS_NUEVE);
  });

  it('el journal sigue empezando por esas nueve entradas, sin reescribir el historial', () => {
    const journal = JSON.parse(
      readFileSync(join(drizzleDir, 'meta', '_journal.json'), 'utf8'),
    ) as { entries: { idx: number; tag: string }[] };
    const primeras = [...journal.entries].sort((a, b) => a.idx - b.idx).slice(0, LAS_NUEVE.length);
    expect(primeras.map((e) => `${e.tag}.sql`)).toEqual(LAS_NUEVE);
  });

  it('lo único que gana drizzle/ es el fichero de desbloqueos', () => {
    const noSql = readdirSync(drizzleDir).filter((f) => f.endsWith('.json'));
    expect(noSql).toEqual(['destructive-waivers.json']);
  });

  it('drizzle-kit ignora ese fichero: lee el journal y los .sql que enumera', () => {
    // No es una migración disfrazada; comprobado por construcción, no por fe.
    const journal = JSON.parse(
      readFileSync(join(drizzleDir, 'meta', '_journal.json'), 'utf8'),
    ) as { entries: { tag: string }[] };
    expect(journal.entries.map((e) => e.tag)).not.toContain('destructive-waivers');
  });
});

describe('SPEC-032 CA-14.4: la suite pasa sin red', () => {
  it('los cinco ficheros de test de esta spec existen', () => {
    const presentes = readdirSync(testsDir);
    for (const fichero of NUEVOS) expect(presentes).toContain(fichero);
  });

  it('ninguno cita una URL http(s) que no sea el loopback', () => {
    for (const fichero of NUEVOS) {
      const urls = [
        ...readFileSync(join(testsDir, fichero), 'utf8').matchAll(/https?:\/\/[^\s'"`)]+/g),
      ].map((m) => m[0]);
      for (const url of urls) {
        expect(url, `${fichero} cita ${url}`).toMatch(/^https?:\/\/(127\.0\.0\.1|localhost)/);
      }
    }
  });

  it('las cadenas de conexión de los tests apuntan a `.invalid`, que no resuelve', () => {
    // RFC 2606: `.invalid` está reservado y nunca resuelve. Si un test intentase
    // conectar, se notaría; lo que se afirma es que ninguno lo intenta.
    const guardia = readFileSync(join(testsDir, 'guard-migrate.test.ts'), 'utf8');
    const conexiones = [...guardia.matchAll(/postgres(?:ql)?:\/\/[^\s'"`]+/g)].map((m) => m[0]);
    expect(conexiones.length).toBeGreaterThan(0);
    for (const cadena of conexiones) {
      expect(cadena, `${cadena} no apunta a un host reservado`).toMatch(/\.invalid[:/]/);
    }
  });

  it('ningún script nuevo abre sockets ni resuelve nombres', () => {
    for (const script of ['guard-migrate.mjs', 'scan-destructive-sql.mjs']) {
      const codigo = readFileSync(join(scriptsDir, script), 'utf8').split('*/').slice(1).join('*/');
      for (const prohibido of [/node:net\b/, /node:tls\b/, /node:dns\b/, /node:http/, /\bfetch\s*\(/]) {
        expect(codigo, `${script} usa ${prohibido}`).not.toMatch(prohibido);
      }
    }
  });

  it('ninguno de los dos scripts nuevos importa nada de la app ni de node_modules', () => {
    for (const script of ['guard-migrate.mjs', 'scan-destructive-sql.mjs']) {
      const source = readFileSync(join(scriptsDir, script), 'utf8');
      const especificadores = [...source.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map(
        (m) => m[1],
      );
      expect(especificadores.length).toBeGreaterThan(0);
      for (const especificador of especificadores) expect(especificador).toMatch(/^node:/);
    }
  });
});
