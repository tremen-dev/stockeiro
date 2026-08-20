import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/**
 * SPEC-042 CA-1 … CA-6 — el barrendero de las ramas de preview de Neon.
 *
 * El 2026-08-19/20 un despliegue de producción murió con `Branch limit reached.
 * Upgrade your plan or delete unused branches.`: el panel de Neon tenía las diez
 * ramas del plan Free y ocho eran `preview/ft/*` de specs ya mezcladas. Con la
 * integración gestionada por Vercel, **borrar la rama de git NO borra la rama de
 * Neon** — cuelga de la retención de despliegues de Vercel, seis meses por
 * defecto. Este workflow la borra al cerrar la PR.
 *
 * El test parsea el YAML de verdad (paquete `yaml`), como
 * `tests/ci-workflow.test.ts` y `tests/deploy-gate-workflow.test.ts`: un regex
 * sobre el texto crudo casa con lo que hay en un comentario y no distingue un
 * step de otro. Donde aquí SÍ se mira el texto crudo —CA-4— es a propósito y
 * está dicho en cada caso: son prohibiciones sobre el fichero entero, comentarios
 * incluidos, y ahí un falso positivo de un comentario es exactamente lo que se
 * quiere.
 *
 * Los tres CA que este fichero **no** cierra son los marcados 🚀 en la spec
 * (CA-8, CA-9, CA-10): exigen cerrar una PR de verdad y mirar el panel de Neon.
 * Su evidencia va al ledger, no a un test. Fingir aquí que son testables sería
 * una casilla marcada, no una garantía.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDir = join(rootDir, '.github', 'workflows');
const limpiadorPath = join(workflowsDir, 'neon-preview-cleanup.yml');
const ciPath = join(workflowsDir, 'ci.yml');
const puertaPath = join(workflowsDir, 'deploy-gate.yml');

/** Ruta del limpiador tal y como la ve git (separadores POSIX). */
const LIMPIADOR_EN_GIT = '.github/workflows/neon-preview-cleanup.yml';

/**
 * Verificado el 2026-08-20 contra el repositorio de la acción y no copiado de
 * memoria: `neondatabase/delete-branch-action` no está archivada ni deshabilitada,
 * su tag flotante `v3` existe (último publicado, `v3.2.1`) y su `action.yaml`
 * declara `project_id`, `api_key` y `branch` — más `branch_id`, con
 * `deprecationMessage`, y `api_host`, que trae valor por defecto y no se pasa.
 */
const ACCION = 'neondatabase/delete-branch-action@v3';

/** CA-4.1: el prefijo va literal en el YAML. No interpolado, no construido. */
const PREFIJO = 'preview/';

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  'continue-on-error'?: unknown;
  with?: Record<string, unknown>;
};

type Job = {
  name?: string;
  'runs-on'?: string;
  if?: string;
  'timeout-minutes'?: number;
  'continue-on-error'?: unknown;
  env?: Record<string, string>;
  concurrency?: unknown;
  steps: Step[];
};

type Workflow = {
  name?: string;
  on?: Record<string, { types?: string[]; branches?: string[] }>;
  permissions?: unknown;
  concurrency?: { group?: string; 'cancel-in-progress'?: unknown };
  jobs: Record<string, Job>;
};

function leer(path: string): { source: string; workflow: Workflow } {
  const source = readFileSync(path, 'utf8');
  return { source, workflow: parse(source) as Workflow };
}

const limpiador = () => leer(limpiadorPath);
const ci = () => leer(ciPath);
const puerta = () => leer(puertaPath);
const jobs = () => Object.values(limpiador().workflow.jobs ?? {});
const steps = () => jobs().flatMap((job) => job.steps ?? []);

/** Todos los `if` del fichero: el del workflow no existe, pero los de job y step sí. */
const condiciones = () =>
  [...jobs().map((j) => j.if), ...steps().map((s) => s.if)].filter(
    (c): c is string => typeof c === 'string',
  );

function git(...args: string[]): string {
  // `stderr` capturado y no heredado: varias llamadas de aquí abajo se esperan
  // que fallen (comprobar que un fichero NO está en la base), y un `fatal:` de
  // git escupido en medio de la suite se lee como un fallo que no es.
  return execFileSync('git', ['-C', rootDir, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** ¿Hay un `origin/main` en este clon? En uno superficial puede no haberlo. */
function hayBase(): boolean {
  try {
    git('rev-parse', '--verify', 'origin/main^{commit}');
    return true;
  } catch {
    return false;
  }
}

/** El contenido de un fichero tal y como está en `origin/main`. */
function enBase(rutaEnGit: string): string {
  return git('show', `origin/main:${rutaEnGit}`);
}

describe('SPEC-042 CA-1: el workflow existe, aparte, y no toca a los otros dos', () => {
  it('1.1 — existe .github/workflows/neon-preview-cleanup.yml', () => {
    expect(
      existsSync(limpiadorPath),
      'Sin este fichero, la limpieza de las ramas de preview vuelve a ser un párrafo del ' +
        'runbook pidiéndole a una persona que se acuerde. Duró un día.',
    ).toBe(true);
  });

  it('1.2 — es el TERCER workflow: ci.yml, deploy-gate.yml y este', () => {
    expect(readdirSync(workflowsDir).sort()).toEqual([
      'ci.yml',
      'deploy-gate.yml',
      'neon-preview-cleanup.yml',
    ]);
  });

  it('1.3 — tiene `name` propio, distinto del de los otros dos', () => {
    const suyo = limpiador().workflow.name;
    expect(typeof suyo).toBe('string');
    expect(suyo).not.toBe(ci().workflow.name);
    expect(suyo).not.toBe(puerta().workflow.name);
  });
});

describe.skipIf(!hayBase())(
  'SPEC-042 CA-1: y ni ci.yml ni deploy-gate.yml cambian ni una línea',
  () => {
    // Byte a byte contra `origin/main`, no "por estructura": lo que CA-1 afirma es
    // que esta entrega no le añade un step, un disparador ni un comentario a los
    // workflows de otras specs. El precedente que se evita es `F-SPEC-032-3`, donde
    // hubo que tocar literales congelados de otra spec y declararlo.
    it('1.4 — ci.yml es idéntico al de origin/main', () => {
      expect(readFileSync(ciPath, 'utf8')).toBe(enBase('.github/workflows/ci.yml'));
    });

    it('1.4 — deploy-gate.yml es idéntico al de origin/main', () => {
      expect(readFileSync(puertaPath, 'utf8')).toBe(enBase('.github/workflows/deploy-gate.yml'));
    });

    it('1.4 — y el limpiador es un fichero NUEVO, no una copia de otro', () => {
      let existiaAntes = true;
      try {
        enBase(LIMPIADOR_EN_GIT);
      } catch {
        existiaAntes = false;
      }
      expect(existiaAntes).toBe(false);
    });
  },
);

describe('SPEC-042 CA-2: un solo disparador, y no filtra por si la PR se mezcló', () => {
  it('2.1 — se dispara únicamente con pull_request', () => {
    expect(Object.keys(limpiador().workflow.on ?? {})).toEqual(['pull_request']);
  });

  it('2.2 — y solo con el tipo `closed`', () => {
    expect(limpiador().workflow.on!.pull_request?.types).toEqual(['closed']);
  });

  it('2.3 — ni push, ni schedule, ni workflow_dispatch, ni nada más', () => {
    for (const evento of [
      'push',
      'schedule',
      'workflow_dispatch',
      'workflow_run',
      'deployment_status',
      'delete',
    ]) {
      expect(limpiador().workflow.on ?? {}).not.toHaveProperty(evento);
    }
  });

  it('2.4 — NADA de pull_request_target, y esto es una prohibición, no un olvido', () => {
    // Es el disparador que SÍ entrega secretos a una PR de un fork, y el
    // repositorio es público desde el 2026-08-19. Se mira también el texto crudo:
    // que no aparezca ni escrito en un comentario como "opción a considerar".
    expect(limpiador().workflow.on ?? {}).not.toHaveProperty('pull_request_target');
    expect(
      limpiador().source,
      'pull_request_target en un repositorio público entrega el secreto a código de ' +
        'terceros. No se negocia en un comentario.',
    ).not.toContain('pull_request_target');
  });

  it('2.5 — ningún `if` condiciona la ejecución a que la PR se haya mezclado', () => {
    // Una PR cerrada SIN mezclar deja exactamente la misma rama huérfana en Neon:
    // la creó el despliegue de Preview, no el merge. Filtrar dejaría fuera justo
    // el caso en que más fácil es olvidarse.
    for (const condicion of condiciones()) {
      expect(condicion).not.toMatch(/merged/i);
    }
    expect(limpiador().source).not.toMatch(/merged/i);
  });
});

describe('SPEC-042 CA-3: la acción, su versión y sus tres entradas, literales', () => {
  it('3.1 — hay exactamente un step, y es el único que ejecuta algo', () => {
    expect(steps()).toHaveLength(1);
  });

  it('3.1 — `uses` es neondatabase/delete-branch-action@v3, clavado', () => {
    // Nombre y versión mayor comprobados contra el repositorio de la acción el
    // 2026-08-20 (no archivada, tag `v3` vivo), no copiados de memoria.
    expect(steps()[0].uses).toBe(ACCION);
  });

  it('3.2 — `with` tiene exactamente tres claves: project_id, branch, api_key', () => {
    expect(Object.keys(steps()[0].with ?? {}).sort()).toEqual(['api_key', 'branch', 'project_id']);
  });

  it('3.3 — y cada una vale exactamente lo que tiene que valer', () => {
    const entradas = steps()[0].with!;
    expect(entradas.project_id).toBe('${{ vars.NEON_PROJECT_ID }}');
    expect(entradas.api_key).toBe('${{ secrets.NEON_API_KEY }}');
    expect(entradas.branch).toBe('preview/${{ github.head_ref }}');
  });

  it('3.4 — no aparece `branch_id`, que el propio action marca como deprecada', () => {
    expect(steps()[0].with ?? {}).not.toHaveProperty('branch_id');
    expect(limpiador().source).not.toContain('branch_id');
  });

  it('3.4 — ni `api_host`: su valor por defecto es la consola de Neon y no se toca', () => {
    expect(steps()[0].with ?? {}).not.toHaveProperty('api_host');
  });
});

describe('SPEC-042 CA-4: nada se borra fuera de `preview/`, y la rama de la que vive la cartera no se nombra', () => {
  it('4.1 — el valor de `branch` EMPIEZA por la cadena literal `preview/`', () => {
    // No interpolada, no construida, no condicional. Es lo que hace que el peor
    // caso alcanzable por este fichero sea "borré una preview que no tocaba".
    const rama = String(steps()[0].with!.branch);
    expect(rama.startsWith(PREFIJO), `\`branch\` vale ${rama}`).toBe(true);
    // Y el prefijo no puede venir de una expresión: lo que hay antes de la
    // primera `${{` tiene que ser el prefijo entero.
    expect(rama.slice(0, rama.indexOf('${{'))).toBe(PREFIJO);
  });

  it('4.2 — ningún step nombra una rama fija', () => {
    for (const step of steps()) {
      const texto = JSON.stringify(step);
      expect(texto).not.toMatch(/\bmain\b/i);
      expect(texto).not.toMatch(/\bproduction\b/i);
    }
  });

  it('4.2 — y tampoco aparece en el fichero entero, comentarios incluidos', () => {
    // Aquí el texto crudo es lo correcto y no una pereza: la rama de la que vive
    // la cartera real del usuario no tiene por qué figurar en el fichero que
    // sostiene la única credencial con permiso de borrado del repositorio. Un
    // falso positivo desde un comentario es exactamente lo que se busca.
    const { source } = limpiador();
    expect(source).not.toMatch(/\bmain\b/i);
    expect(source).not.toMatch(/\bproduction\b/i);
  });

  it('4.3 — no hay ni un `run:` en todo el fichero', () => {
    // Sin shell no hay sitio donde el secreto acabe en un log, ni donde
    // `github.head_ref` —dato que controla quien abre la PR— llegue a un intérprete
    // de comandos.
    for (const step of steps()) expect(step.run).toBeUndefined();
    expect(limpiador().source).not.toMatch(/^\s*run:/m);
  });

  it('4.4 — ni el id del proyecto ni la clave aparecen en claro', () => {
    const { source } = limpiador();
    // Las dos únicas menciones posibles son las expresiones de CA-3.3.
    const menciones = [...source.matchAll(/NEON_[A-Z_]+/g)].map((m) => m[0]);
    expect(menciones.sort()).toEqual(['NEON_API_KEY', 'NEON_PROJECT_ID']);
    expect(source).toContain('${{ vars.NEON_PROJECT_ID }}');
    expect(source).toContain('${{ secrets.NEON_API_KEY }}');
    // Un id de proyecto de Neon tiene la forma `adjetivo-sustantivo-12345678`, y
    // una clave de API es una ristra hexadecimal larga. Ni una cosa ni la otra.
    expect(source).not.toMatch(/[0-9a-f]{32,}/i);
  });
});

describe('SPEC-042 CA-5: higiene — forks, permisos, plazo, concurrencia y ninguna red de seguridad', () => {
  it('5.1 — el job no corre para PRs de un fork', () => {
    // En un repo público una PR de fork NO recibe secretos: sin esta condición,
    // cada cierre de PR externa pintaría un rojo garantizado y sin significado.
    const condicion = jobs()[0].if ?? '';
    expect(condicion).toContain('github.event.pull_request.head.repo.full_name');
    expect(condicion).toContain('github.repository');
    expect(condicion).toMatch(/==/);
  });

  it('5.2 — declara `permissions` de forma explícita', () => {
    expect(limpiador().workflow.permissions).toBeDefined();
  });

  it('5.2 — y sin un solo verbo de escritura: no hay checkout que lo justifique', () => {
    const permisos = JSON.stringify(limpiador().workflow.permissions);
    expect(permisos).not.toContain('write');
    expect([...steps()].every((s) => !(s.uses ?? '').startsWith('actions/checkout'))).toBe(true);
  });

  it('5.3 — el job declara timeout-minutes', () => {
    // Una llamada HTTP no puede quemar cuota colgada.
    for (const job of jobs()) {
      expect(typeof job['timeout-minutes'], `El job "${job.name}" no declara plazo`).toBe('number');
      expect(job['timeout-minutes']).toBeGreaterThan(0);
    }
  });

  it('5.4 — tiene grupo de concurrencia propio, distinto del de los otros dos', () => {
    const suyo = limpiador().workflow.concurrency?.group;
    expect(typeof suyo).toBe('string');
    expect(suyo).not.toBe(ci().workflow.concurrency?.group);
    expect(suyo).not.toBe(puerta().workflow.concurrency?.group);
  });

  it('5.4 — y NO cancela lo que está en curso', () => {
    // Cancelar un borrado a medias no ahorra nada y deja la rama viva.
    expect(limpiador().workflow.concurrency?.['cancel-in-progress']).toBe(false);
  });

  it('5.5 — ni el job ni el step llevan continue-on-error', () => {
    // CA-9 lo mide antes de decidir. Taparlo preventivamente cambia un problema
    // conocido por uno invisible: un limpiador que falla en silencio devuelve el
    // problema a los seis meses y con el panel lleno.
    for (const job of jobs()) expect(job['continue-on-error']).toBeUndefined();
    for (const step of steps()) expect(step['continue-on-error']).toBeUndefined();
    expect(limpiador().source).not.toContain('continue-on-error');
  });

  it('5.5 — no hay `|| true` ni ningún encadenado que se trague el fallo', () => {
    expect(limpiador().source).not.toContain('|| true');
  });

  it('5.5 — ningún `if` es `always()`', () => {
    for (const condicion of condiciones()) {
      expect(condicion).not.toMatch(/always\(\)/);
    }
    expect(limpiador().source).not.toContain('always()');
  });
});

describe('SPEC-042 CA-6: la frontera con los otros dos workflows', () => {
  it('6.1 — ci.yml sigue sin contener la cadena `secrets.`', () => {
    expect(ci().source).not.toMatch(/secrets\./);
  });

  it('6.1 — deploy-gate.yml sigue sin contener la cadena `secrets.`', () => {
    expect(puerta().source).not.toMatch(/secrets\./);
  });

  it('6.1 — y ninguno de los dos menciona a Neon ni a este workflow', () => {
    for (const otro of [ci().source, puerta().source]) {
      expect(otro).not.toContain('delete-branch-action');
      expect(otro).not.toContain('neon-preview-cleanup');
    }
  });

  it('6.2 — el limpiador es el único fichero ejecutable del repo con `secrets.`', () => {
    // "Del repositorio" con una salvedad que conviene decir en voz alta: `docs/` y
    // `tests/` HABLAN del secreto —esta spec, su ledger, el runbook y este mismo
    // fichero— y eso no es llevarlo. Lo que CA-6.2 protege es que no haya un
    // segundo sitio donde una credencial se USE.
    // `--untracked` a propósito: si el limpiador todavía no está indexado, un
    // `git grep` normal lo pasaría por alto y este test saldría verde por no
    // haber mirado. Verde por no mirar es la clase de test que esta spec evita.
    const ficheros = git('grep', '-l', '--untracked', 'secrets\\.', '--', '.')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((f) => !f.startsWith('docs/') && !f.startsWith('tests/'));
    expect(ficheros).toEqual([LIMPIADOR_EN_GIT]);
  });
});
