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

describe('SPEC-031 CA-13.1: el workflow de CI no gana ni un step por la puerta de atrás', () => {
  it('los steps con `run` son los de SPEC-027 más los gates de SPEC-032 y SPEC-038', () => {
    // Lista cerrada a propósito: cada entrada nueva tiene que venir con un CA que
    // la pida. `Migration scan` la pide SPEC-032 CA-11 —lee ficheros del repo, no
    // habla con nada—, y las tres aserciones de abajo (no toca check-alive, no
    // sale a ningún host) siguen siendo lo que este bloque defiende de verdad.
    //
    // `Version bump` la pide SPEC-038 CA-13, que existe precisamente porque este
    // comentario lo exige: ADR-024 pto. 9 añade un gate que compara la versión de
    // la rama con la de `origin/main`, y la spec lo trajo al gate humano en vez de
    // colarlo. Lee dos `package.json` con `git show` y cruza el diff con las rutas
    // que `.sdd.json` declara vigiladas: no invoca `check-alive`, no habla con
    // ningún host y no toca `vercel.json` — las tres propiedades que este bloque
    // defiende de verdad siguen intactas y se comprueban abajo, sobre la lista
    // ampliada.
    //
    // Qué vigilaba antes y qué vigila ahora: exactamente lo mismo —que ningún step
    // entre sin un CA que lo pida—, sobre una lista de diez entradas en vez de
    // nueve. La lista sigue CERRADA: la número once vuelve a poner esto en rojo.
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
        'Migration scan',
        'Typecheck',
        'Unit tests',
        'Version bump',
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

describe('SPEC-031 CA-13.2: vercel.json solo cambia cuando una spec lo cambia', () => {
  it('sigue siendo exactamente lo que era, más la guardia de SPEC-032', () => {
    // Literal congelado, no un `git diff`: el test tiene que poder decidir esto
    // en un clone superficial de CI, sin `origin/main` a mano.
    //
    // SPEC-032 (ADR-018 D-2) añadió `node scripts/guard-migrate.mjs &&` delante
    // de `db:migrate`, y eso ES el CA-4 de aquella spec: la única forma de que
    // este literal siguiera intacto era no implementarla. Lo que este test
    // conserva —y sigue conservando— es la propiedad de SPEC-031: **su** spec no
    // tocó este fichero, y ningún cambio se cuela aquí sin un CA que lo pida.
    expect(JSON.parse(readFileSync(join(rootDir, 'vercel.json'), 'utf8'))).toEqual({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      buildCommand: 'node scripts/guard-migrate.mjs && npm run db:migrate && npm run build',
      crons: [{ path: '/api/cron/refresh', schedule: '0 22 * * *' }],
    });
  });
});

describe('SPEC-031 CA-13.3: ninguna variable de entorno nueva', () => {
  const envExample = () => readFileSync(join(rootDir, '.env.example'), 'utf8');
  /** Claves declaradas en la plantilla, comentadas o no. */
  const declaradas = () =>
    [...envExample().matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]).sort();

  it('.env.example declara las mismas claves de siempre, más la que SPEC-039 pidió', () => {
    // Lista CERRADA, y sigue cerrada. Lo que esta guardia vigila no es el número diez
    // sino la propiedad: **ninguna clave entra sin un CA que la pida**. SPEC-031 no
    // añadió ninguna (esa era su CA-13.3) y esta lista lo demostraba con un literal.
    //
    // SPEC-039 CA-16 añade `FEEDBACK_EMAIL` —la dirección del canal de feedback— y lo
    // hace DECLARÁNDOLO aquí, que es exactamente el mecanismo funcionando: la spec
    // escribió «de diez claves a once, con esa y solo con esa» para que la variable se
    // discutiera en el gate en vez de descubrirse en una CI roja. Antes vigilaba que
    // no hubiera ninguna nueva; ahora vigila que no haya ninguna nueva **más allá de
    // la que se aprobó**. La lista sigue siendo el sitio donde hay que pedir permiso.
    expect(declaradas()).toEqual(
      [
        'APP_BASE_URL',
        'AUTH_SECRET',
        'AUTH_TRUST_HOST',
        'CRON_SECRET',
        'DATABASE_URL',
        'DB_DRIVER',
        'FEEDBACK_EMAIL',
        'MARKETSTACK_API_KEY',
        'RESEND_API_KEY',
        'RESEND_FROM',
        'TWELVE_DATA_API_KEY',
      ].sort(),
    );
  });

  it('y son ONCE: si mañana hay doce, es que alguien no pasó por un gate', () => {
    expect(declaradas()).toHaveLength(11);
  });

  it('las CUATRO del canal de build NO se configuran en ninguna parte: se calculan', () => {
    // De tres a cuatro por SPEC-038 CA-14 / ADR-024 pto. 4: `STOCKEIRO_VERSION`
    // sale de `package.json` en tiempo de build, igual que sus tres hermanas salen
    // de git y del reloj. La propiedad que vigila esta lista no cambia —una
    // variable del canal no se configura, se calcula—; lo que cambia es que ahora
    // son cuatro las que tienen que cumplirla.
    for (const clave of [
      'STOCKEIRO_COMMIT',
      'STOCKEIRO_ENVIRONMENT',
      'STOCKEIRO_BUILT_AT',
      'STOCKEIRO_VERSION',
    ]) {
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
