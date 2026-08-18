import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/**
 * SPEC-027 / ADR-018 D-4 — CI en cada PR.
 *
 * Test estático del workflow. Parsea el YAML de verdad (paquete `yaml`) en vez
 * de pasarle regex al texto: un regex sobre `.github/workflows/ci.yml` es la
 * clase de test que parece comprobar y no comprueba — casa con lo que hay en un
 * comentario y no distingue un step de otro.
 *
 * Cubre la parte estática de CA-1 … CA-8. Lo que no se puede comprobar leyendo
 * un fichero —que un gate roto aparezca en rojo sin tapar a los demás (CA-3),
 * que el artefacto de diagnóstico exista (CA-9), que `--forbid-only` tumbe un
 * `.only` (CA-10)— se prueba en rojo en la propia PR y queda en el ledger.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = join(rootDir, '.github', 'workflows', 'ci.yml');
const nvmrcPath = join(rootDir, '.nvmrc');

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, unknown>;
};

type Job = {
  name?: string;
  'runs-on'?: string;
  needs?: unknown;
  'timeout-minutes'?: number;
  env?: Record<string, string>;
  steps: Step[];
};

type Workflow = {
  name?: string;
  on?: Record<string, { branches?: string[] }>;
  permissions?: unknown;
  concurrency?: { group?: string; 'cancel-in-progress'?: unknown };
  jobs: Record<string, Job>;
};

/** Nombre visible del step → script de `package.json` que le toca ejecutar.
 *  Este mapa ES el contrato de CA-2: el nombre del step rojo tiene que bastar
 *  para saber qué se rompió sin abrir el log. */
const GATES: Record<string, string> = {
  Typecheck: 'typecheck',
  Lint: 'lint',
  'Unit tests': 'test',
  // SPEC-032 CA-11: el escáner de SQL destructivo es un gate con nombre propio,
  // no una línea dentro de otro step. Es el requisito del humano en SPEC-027 —
  // que el nombre del check rojo diga qué se rompió — y lo impone este mapa.
  'Migration scan': 'db:scan',
  Build: 'build',
  'End-to-end tests': 'test:e2e',
};

let cache: { source: string; workflow: Workflow } | null = null;

function load() {
  if (cache === null) {
    const source = readFileSync(workflowPath, 'utf8');
    cache = { source, workflow: parse(source) as Workflow };
  }
  return cache;
}

const jobs = () => Object.values(load().workflow.jobs ?? {});
const steps = () => jobs().flatMap((job) => job.steps ?? []);
const gateSteps = () =>
  steps().filter((s) => typeof s.name === 'string' && s.name in GATES);
const jobByName = (name: string) => jobs().find((j) => j.name === name);
/** Scripts de npm que invoca un `run`, en orden de aparición. */
const invokedScripts = (run: string) =>
  [...run.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)].map((m) => m[1]);
/** Solo las líneas de comentario del YAML: donde la spec exige que el porqué
 *  quede escrito (CA-8). */
const commentLines = () =>
  load()
    .source.split('\n')
    .filter((line) => /^\s*#/.test(line))
    .join('\n');

describe('SPEC-027 — el workflow de CI', () => {
  describe('CA-1: existe y se dispara donde debe', () => {
    it('.github/workflows/ci.yml existe', () => {
      expect(
        existsSync(workflowPath),
        'No hay workflow de CI: la suite sigue dependiendo de que alguien se acuerde.',
      ).toBe(true);
    });

    it('se dispara en pull_request y en push, y en ningún otro evento', () => {
      expect(Object.keys(load().workflow.on ?? {}).sort()).toEqual([
        'pull_request',
        'push',
      ]);
    });

    it('ambos disparadores están limitados a la rama main', () => {
      const on = load().workflow.on!;
      expect(on.pull_request?.branches).toEqual(['main']);
      expect(on.push?.branches).toEqual(['main']);
    });
  });

  describe('CA-2: un step por gate, y el nombre basta', () => {
    it('están exactamente los seis gates, una vez cada uno', () => {
      const names = gateSteps().map((s) => s.name!);
      expect(names.slice().sort()).toEqual(Object.keys(GATES).sort());
      expect(new Set(names).size).toBe(names.length);
    });

    it('ningún step ejecuta dos gates: cada run invoca un solo script', () => {
      for (const step of gateSteps()) {
        expect(
          invokedScripts(step.run ?? ''),
          `El step "${step.name}" no invoca exactamente su propio script. ` +
            'Un step que ejecuta dos gates rompe el único requisito del humano: ' +
            'que el nombre del step rojo diga qué se ha roto.',
        ).toEqual([GATES[step.name!]]);
        expect(step.run).not.toMatch(/&&|\|\||;/);
      }
    });
  });

  describe('CA-3: un gate roto no oculta a los demás', () => {
    it('los cuatro gates de Checks se ejecutan aunque uno falle', () => {
      for (const name of ['Typecheck', 'Lint', 'Unit tests', 'Migration scan']) {
        const step = gateSteps().find((s) => s.name === name)!;
        expect(
          step.if ?? '',
          `El step "${name}" debe llevar if: !cancelled(); si no, GitHub aborta el ` +
            'job en el primer gate rojo y el humano arregla a ciegas de uno en uno.',
        ).toMatch(/!\s*cancelled\(\)/);
      }
    });

    it('End-to-end tests NO la lleva: encadena con Build a propósito', () => {
      // Un e2e sin `.next` no falla, falla mintiendo (`next start` sin build).
      expect(gateSteps().find((s) => s.name === 'End-to-end tests')!.if).toBeUndefined();
    });
  });

  describe('CA-4: dos jobs, en paralelo, visibles como dos checks', () => {
    it('hay exactamente dos jobs, Checks y E2E', () => {
      expect(jobs().map((j) => j.name).sort()).toEqual(['Checks', 'E2E']);
    });

    it('ninguno depende del otro (needs), así que corren en paralelo', () => {
      for (const job of jobs()) expect(job.needs).toBeUndefined();
    });

    it('cada job lleva sus gates: Checks la lógica, E2E el flujo', () => {
      const namesOf = (job: Job) =>
        (job.steps ?? [])
          .map((s) => s.name)
          .filter((n): n is string => typeof n === 'string' && n in GATES);
      expect(namesOf(jobByName('Checks')!)).toEqual([
        'Typecheck',
        'Lint',
        'Unit tests',
        'Migration scan',
      ]);
      expect(namesOf(jobByName('E2E')!)).toEqual(['Build', 'End-to-end tests']);
    });
  });

  describe('CA-5: el CI no puede hacer daño ni gastarse la cuota', () => {
    it('5.1 — no hay ni una referencia a secrets.', () => {
      expect(
        load().source,
        'Un CI sin secretos no puede filtrar nada. Este ya no lo es.',
      ).not.toMatch(/secrets\./);
    });

    it('5.1 — las variables del build son de juguete y están en claro', () => {
      expect(jobByName('E2E')!.env).toEqual({
        DATABASE_URL: 'postgres://ci:ci@localhost:5432/ci',
        AUTH_SECRET: 'ci-not-a-real-secret-ci-not-a-real-secret',
        AUTH_TRUST_HOST: 'true',
        APP_BASE_URL: 'http://localhost:3200',
      });
    });

    it('5.2 — permissions es contents: read a nivel de workflow', () => {
      expect(load().workflow.permissions).toEqual({ contents: 'read' });
    });

    it('5.3 — ningún step migra nada (regla dura de ADR-018 D-4)', () => {
      for (const step of steps()) {
        const run = step.run ?? '';
        expect(
          run,
          'El CI nunca apunta una migración a una base gestionada.',
        ).not.toMatch(/db:migrate|drizzle-kit\s+migrate/);
      }
    });

    it('5.4 — cada job declara timeout-minutes, y es ≤ 25', () => {
      for (const job of jobs()) {
        const timeout = job['timeout-minutes'];
        expect(typeof timeout, `El job "${job.name}" no declara timeout-minutes`).toBe(
          'number',
        );
        expect(timeout!).toBeLessThanOrEqual(25);
      }
    });

    it('5.5 — concurrency por rama, y cancel-in-progress solo en pull_request', () => {
      const concurrency = load().workflow.concurrency!;
      expect(concurrency.group).toContain('github.ref');
      expect(String(concurrency['cancel-in-progress'])).toMatch(
        /github\.event_name\s*==\s*'pull_request'/,
      );
    });
  });

  describe('CA-6: la versión de Node tiene una sola fuente', () => {
    it('.nvmrc existe y fija la versión de producción (Vercel, ADR-018)', () => {
      expect(existsSync(nvmrcPath)).toBe(true);
      expect(readFileSync(nvmrcPath, 'utf8').trim()).toBe('24');
    });

    it('el setup de Node lee .nvmrc y no escribe ningún número en el YAML', () => {
      const setups = steps().filter((s) => (s.uses ?? '').startsWith('actions/setup-node'));
      expect(setups.length).toBeGreaterThan(0);
      for (const step of setups) {
        expect(step.with?.['node-version-file']).toBe('.nvmrc');
        expect(step.with?.['node-version']).toBeUndefined();
      }
      // Un número suelto en el YAML es una segunda fuente esperando a divergir.
      expect(load().source).not.toMatch(/node-version:/);
    });
  });

  describe('CA-7: CI y local ejecutan el mismo comando', () => {
    const scripts = () =>
      (JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }).scripts;

    it('los scripts lint y test:e2e existen en package.json', () => {
      expect(Object.keys(scripts())).toEqual(expect.arrayContaining(['lint', 'test:e2e']));
    });

    it('cada gate invoca npm run <script> y ese script existe', () => {
      for (const step of gateSteps()) {
        const script = GATES[step.name!];
        expect(scripts()[script], `package.json no define "${script}"`).toBeDefined();
        expect(step.run!.startsWith(`npm run ${script}`)).toBe(true);
      }
    });

    it('ninguna bandera de CI cambia lo que se ejecuta: van tras --', () => {
      for (const step of gateSteps()) {
        const run = step.run!.trim();
        const bare = `npm run ${GATES[step.name!]}`;
        expect(
          run === bare || run.startsWith(`${bare} -- `),
          `El step "${step.name}" mete banderas antes de "--": eso es CI ejecutando ` +
            'algo distinto de lo que ejecuta el humano en local, que es como empieza la deriva.',
        ).toBe(true);
      }
    });
  });

  describe('CA-8: se cachea lo que ayuda; no se cachea lo que engaña', () => {
    it('la caché de descargas de npm va por setup-node', () => {
      const setups = steps().filter((s) => (s.uses ?? '').startsWith('actions/setup-node'));
      for (const step of setups) expect(step.with?.cache).toBe('npm');
    });

    it('los navegadores de Playwright se cachean con clave del package-lock', () => {
      const cacheStep = steps().find(
        (s) =>
          (s.uses ?? '').startsWith('actions/cache') &&
          String(s.with?.path ?? '').includes('ms-playwright'),
      );
      expect(cacheStep, 'Sin caché del navegador se pagan ~130 MB en cada pasada').toBeDefined();
      expect(String(cacheStep!.with?.key)).toContain('package-lock.json');
    });

    it('no se cachea node_modules ni .next/cache', () => {
      const cachedPaths = steps()
        .filter((s) => (s.uses ?? '').startsWith('actions/cache'))
        .map((s) => String(s.with?.path ?? ''))
        .concat(
          steps()
            .filter((s) => (s.uses ?? '').startsWith('actions/setup-node'))
            .map((s) => String(s.with?.['cache-dependency-path'] ?? '')),
        );
      for (const path of cachedPaths) {
        expect(path).not.toMatch(/node_modules/);
        expect(path).not.toMatch(/\.next/);
      }
    });

    it('el porqué de la caché que NO se hace está escrito en el propio YAML', () => {
      // Sin el motivo escrito, el primero que quiera acelerar el CI cacheará
      // node_modules y se llevará por delante el script de instalación de
      // embedded-postgres, con un verde que no corresponde a lo instalado.
      const comments = commentLines();
      expect(comments).toMatch(/node_modules/);
      expect(comments).toMatch(/embedded-postgres/);
      expect(comments).toMatch(/\.next\/cache/);
    });
  });
});
