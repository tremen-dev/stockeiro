import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/**
 * SPEC-031 CA-13 — nada queda conectado.
 *
 * Esta spec entrega el endpoint y el script; **no** los cablea. Conectar el repo
 * a Vercel, la puerta post-deploy y la reescritura del runbook para despliegue
 * automático son SPEC-028. ADR-018 pide explícitamente no fusionar los dos
 * puntos: "3 es código de aplicación con CA verificables por tests; 4 es casi
 * todo configuración de plataforma y un workflow. Mezclar los dos deja una spec
 * que el verificador no puede cerrar sin desplegar".
 *
 * Es un CA y no una promesa porque un step de CI añadido "ya que estamos"
 * convertiría esta spec en incerrable.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = join(rootDir, '.github', 'workflows', 'ci.yml');
const testsDir = join(rootDir, 'tests');

type Step = { name?: string; uses?: string; run?: string };
type Workflow = { jobs: Record<string, { steps: Step[] }> };

/** Los cinco gates de SPEC-027 CA-2, ni uno más. */
const GATES_DE_SPEC_027 = ['Build', 'End-to-end tests', 'Lint', 'Typecheck', 'Unit tests'];

const workflow = () => parse(readFileSync(workflowPath, 'utf8')) as Workflow;
const steps = () => Object.values(workflow().jobs ?? {}).flatMap((job) => job.steps ?? []);

describe('SPEC-031 CA-13.1: el workflow de CI no gana ni un step', () => {
  it('los steps con `run` siguen siendo exactamente los de SPEC-027', () => {
    const conRun = steps().filter((s) => typeof s.run === 'string');
    const nombres = conRun.map((s) => s.name ?? '(sin nombre)').sort();
    expect(nombres).toEqual(
      [
        'Build',
        'End-to-end tests',
        'Install Playwright browser',
        'Install dependencies',
        'Install dependencies',
        'Lint',
        'Typecheck',
        'Unit tests',
      ].sort(),
    );
  });

  it('los cinco gates nombrados de SPEC-027 siguen ahí, una vez cada uno', () => {
    const gates = steps()
      .map((s) => s.name)
      .filter((n): n is string => typeof n === 'string' && GATES_DE_SPEC_027.includes(n));
    expect(gates.slice().sort()).toEqual(GATES_DE_SPEC_027);
  });

  it('ningún step invoca check-alive', () => {
    for (const step of steps()) {
      expect(
        step.run ?? '',
        'La puerta post-deploy es SPEC-028. Un step aquí exigiría un despliegue ' +
          'para cerrar esta spec, que es justo lo que ADR-018 pide evitar.',
      ).not.toMatch(/check-alive/);
    }
    expect(readFileSync(workflowPath, 'utf8')).not.toContain('check-alive');
  });

  it('ningún step habla con un host externo', () => {
    for (const step of steps()) {
      expect(step.run ?? '').not.toMatch(/https?:\/\//);
    }
  });
});

describe('SPEC-031 CA-13.2: vercel.json no cambia', () => {
  it('sigue siendo exactamente lo que era antes de esta spec', () => {
    // Literal congelado, no un `git diff`: el test tiene que poder decidir esto
    // en un clone superficial de CI, sin `origin/main` a mano.
    expect(JSON.parse(readFileSync(join(rootDir, 'vercel.json'), 'utf8'))).toEqual({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      buildCommand: 'npm run db:migrate && npm run build',
      crons: [{ path: '/api/cron/refresh', schedule: '0 22 * * *' }],
    });
  });
});

describe('SPEC-031 CA-13.3: ninguna variable de entorno nueva', () => {
  const envExample = () => readFileSync(join(rootDir, '.env.example'), 'utf8');
  /** Claves declaradas en la plantilla, comentadas o no. */
  const declaradas = () =>
    [...envExample().matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]).sort();

  it('.env.example declara las mismas claves de siempre', () => {
    expect(declaradas()).toEqual(
      [
        'APP_BASE_URL',
        'AUTH_SECRET',
        'AUTH_TRUST_HOST',
        'CRON_SECRET',
        'DATABASE_URL',
        'DB_DRIVER',
        'MARKETSTACK_API_KEY',
        'RESEND_API_KEY',
        'RESEND_FROM',
        'TWELVE_DATA_API_KEY',
      ].sort(),
    );
  });

  it('las tres del canal de build NO se configuran en ninguna parte: se calculan', () => {
    for (const clave of ['STOCKEIRO_COMMIT', 'STOCKEIRO_ENVIRONMENT', 'STOCKEIRO_BUILT_AT']) {
      expect(envExample()).not.toContain(clave);
      expect(readFileSync(workflowPath, 'utf8')).not.toContain(clave);
    }
  });
});

describe('SPEC-031 CA-13.4: la suite pasa sin red', () => {
  const NUEVOS = [
    'check-alive.test.ts',
    'runbook-check-alive.test.ts',
    'spec-031-frontera.test.ts',
    'version-build-channel.test.ts',
    'version-build-identity.test.ts',
    'version-endpoint.test.ts',
    'version-identity.test.ts',
    'version-import-graph.test.ts',
  ];

  it('los ocho ficheros de test de esta spec existen', () => {
    const presentes = readdirSync(testsDir);
    for (const fichero of NUEVOS) expect(presentes).toContain(fichero);
  });

  /** Identificadores que parecen URL y no lo son: nadie los descarga. */
  const NO_SON_PETICIONES = [
    // Identificador del JSON Schema de vercel.json, copiado literal para
    // congelar el fichero (CA-13.2). Es un nombre, no un destino.
    'https://openapi.vercel.sh/vercel.json',
  ];

  it('ninguno cita una URL que no sea el loopback', () => {
    for (const fichero of NUEVOS) {
      const urls = [
        ...readFileSync(join(testsDir, fichero), 'utf8').matchAll(/https?:\/\/[^\s'"`)]+/g),
      ]
        .map((m) => m[0])
        .filter((url) => !NO_SON_PETICIONES.includes(url));

      for (const url of urls) {
        expect(url, `${fichero} cita ${url}`).toMatch(/^https?:\/\/(127\.0\.0\.1|localhost)/);
      }
    }
  });

  it('el script no tiene origen por defecto: todo lo que consulta entra por --url', () => {
    // Un host codificado sería una llamada a la red esperando a que alguien
    // ejecute el script sin argumentos. Los ejemplos del `--help` son texto; lo
    // que importa es a dónde apunta el único `fetch`.
    const source = readFileSync(join(rootDir, 'scripts', 'check-alive.mjs'), 'utf8');
    const destinos = [...source.matchAll(/\bfetch\(\s*([^\s,)]+)/g)].map((m) => m[1]);

    expect(destinos).toEqual(['endpoint']);
    expect(source).toMatch(/url:\s*null/);
  });
});
