import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/**
 * SPEC-028 CA-4 … CA-9 — la puerta post-deploy (ADR-018 D-6, segundo párrafo).
 *
 * ADR-018 fija la propiedad —*"un paso que espera a que `/api/version` en el
 * dominio de producción devuelva el sha mergeado, y falla si no llega en un
 * plazo"*— y deja el mecanismo libre. Este test es el mecanismo escrito: fichero
 * propio, disparador, dominio, plazo, concurrencia y la lista de lo que la puerta
 * NO hace.
 *
 * Parsea el YAML de verdad (paquete `yaml`), como `tests/ci-workflow.test.ts`:
 * un regex sobre el texto crudo casa con lo que hay en un comentario y no
 * distingue un step de otro.
 *
 * Los cuatro CA que **no** se cierran aquí son los marcados 🚀 en la spec (CA-1,
 * CA-2, CA-3, CA-10): exigen un despliegue real y su evidencia va al ledger, no
 * a un test. Un test que "probase la intención" de esos cuatro sería una casilla
 * marcada — la intención ya la prueban los seis de abajo.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gatePath = join(rootDir, '.github', 'workflows', 'deploy-gate.yml');
const ciPath = join(rootDir, '.github', 'workflows', 'ci.yml');

/** El origen que recorre una persona: dominio propio, no el `.vercel.app`.
 *  Interrogarlo comprueba de una vez el despliegue, el alias de producción y el
 *  CNAME de Cloudflare (CA-5, §Notas para el gate punto 7). */
const DOMINIO = 'https://stockeiro.tremen.dev';
/** CA-7.1: plazo holgadamente mayor que un build completo de Vercel. */
const PLAZO_SEGUNDOS = 900;
const INTERVALO_SEGUNDOS = 10;

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
  'timeout-minutes'?: number;
  'continue-on-error'?: unknown;
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

function leer(path: string): { source: string; workflow: Workflow } {
  const source = readFileSync(path, 'utf8');
  return { source, workflow: parse(source) as Workflow };
}

const puerta = () => leer(gatePath);
const ci = () => leer(ciPath);
const jobs = () => Object.values(puerta().workflow.jobs ?? {});
const steps = () => jobs().flatMap((job) => job.steps ?? []);
/** El único step que ejecuta algo: el veredicto (CA-5). */
const pasoDeComprobacion = () => steps().filter((s) => typeof s.run === 'string');

/** Valor de una bandera larga dentro del `run` de la puerta. */
function bandera(nombre: string): string | undefined {
  const run = pasoDeComprobacion()[0]?.run ?? '';
  return new RegExp(`--${nombre}\\s+(\\S+)`).exec(run)?.[1];
}

describe('SPEC-028 CA-4: la puerta existe, vive en su propio workflow y se dispara solo donde debe', () => {
  it('4.0 — existe .github/workflows/deploy-gate.yml', () => {
    expect(
      existsSync(gatePath),
      'Sin puerta, un despliegue automático que no llega no lo delata nadie: ' +
        'es el freno 3 de ADR-018, el que falló 27 días.',
    ).toBe(true);
  });

  it('4.1 — se dispara únicamente con push a main', () => {
    expect(Object.keys(puerta().workflow.on ?? {})).toEqual(['push']);
    expect(puerta().workflow.on!.push?.branches).toEqual(['main']);
  });

  it('4.1 — ni pull_request, ni schedule, ni nada más', () => {
    // En una PR no hay despliegue de producción que comprobar, y un `schedule`
    // convertiría la puerta en un monitor: otra cosa, con otro ciclo.
    for (const evento of ['pull_request', 'schedule', 'workflow_dispatch', 'deployment_status']) {
      expect(puerta().workflow.on ?? {}).not.toHaveProperty(evento);
    }
  });

  it('4.2 — declara permissions: contents: read', () => {
    expect(puerta().workflow.permissions).toEqual({ contents: 'read' });
  });

  it('4.2 — no referencia `secrets.` en ninguna parte', () => {
    expect(
      puerta().source,
      'La puerta interroga un endpoint público. Un secreto aquí es una credencial ' +
        'que no hace falta (ADR-018 D-4.1).',
    ).not.toMatch(/secrets\./);
  });

  it('4.3 — es un fichero aparte de ci.yml, con `name` propio y distinguible', () => {
    expect(existsSync(ciPath)).toBe(true);
    const suyo = puerta().workflow.name;
    expect(typeof suyo).toBe('string');
    expect(suyo).not.toBe(ci().workflow.name);
  });

  it('4.3 — y la puerta NO se ha colado dentro de ci.yml', () => {
    // Si viviera allí habría que editar tests/spec-031-frontera.test.ts y
    // tests/spec-032-frontera.test.ts, que es justo lo que CA-9 evita.
    expect(ci().source).not.toContain('check-alive');
    expect(ci().source).not.toContain(DOMINIO);
  });
});

describe('SPEC-028 CA-5: consume scripts/check-alive.mjs tal cual', () => {
  it('5.1 — hay exactamente un step con `run`: el veredicto', () => {
    expect(pasoDeComprobacion()).toHaveLength(1);
  });

  it('5.1 — ese step invoca node scripts/check-alive.mjs', () => {
    expect(pasoDeComprobacion()[0].run!.trim().startsWith('node scripts/check-alive.mjs')).toBe(
      true,
    );
  });

  it('5.2 — apunta al dominio de producción, escrito como literal', () => {
    // Es público, no es un secreto, y ser literal lo hace verificable desde aquí.
    expect(bandera('url')).toBe(DOMINIO);
  });

  it('5.3 — espera el commit que acaba de aterrizar en main', () => {
    // En un `push`, github.sha es el mismo que Vercel pone en
    // VERCEL_GIT_COMMIT_SHA del despliegue de producción.
    expect(pasoDeComprobacion()[0].run).toContain('--commit ${{ github.sha }}');
  });

  it('5.4 — no reimplementa nada: ni curl, ni fetch, ni un parseo propio', () => {
    const run = pasoDeComprobacion()[0].run!;
    expect(run).not.toMatch(/\bcurl\b/);
    expect(run).not.toMatch(/\bfetch\b/);
    expect(run).not.toContain('/api/version');
  });

  it('5.5 — los tres scripts que esta spec cablea siguen ahí, y ella no añadió ninguno', () => {
    // Re-encuadrado por SPEC-038 (FOUNDATION §Cómo se trabaja aquí, 2026-08-20).
    //
    // Qué vigilaba antes: que `scripts/` tuviera EXACTAMENTE tres habitantes.
    // Qué vigila ahora: que los tres que esta spec cablea sigan estando. La
    // afirmación de CA-5.5 —"esta spec cablea lo que SPEC-031 y SPEC-032
    // entregaron; no añade scripts"— es un hecho sobre SU entrega y sigue siendo
    // cierta; lo que caducaba era su FORMA, una foto del árbol que se pone roja
    // la primera vez que otra spec añade un script legítimo. Es el mismo
    // re-encuadre que ya se le hizo a `LAS_NUEVE` migraciones en
    // `tests/spec-032-frontera.test.ts`, y por el mismo motivo.
    //
    // Quien lo dispara: SPEC-038 CA-12 trae `check-version-bump.mjs`, declarado
    // en su spec y aprobado en su gate.
    const habitantes = readdirSync(join(rootDir, 'scripts')).sort();
    for (const script of ['check-alive.mjs', 'guard-migrate.mjs', 'scan-destructive-sql.mjs']) {
      expect(
        habitantes,
        `Falta ${script}: esta spec lo cablea y no puede desaparecer sin que la puerta ` +
          'post-despliegue deje de tener qué ejecutar.',
      ).toContain(script);
    }
  });
});

describe('SPEC-028 CA-6: la puerta no necesita nada instalado, ni un secreto, ni la base', () => {
  it('6.1 — ningún step ejecuta npm ci ni npm install', () => {
    for (const step of steps()) {
      expect(
        step.run ?? '',
        'El dividendo de SPEC-031 CA-8.2 (el script solo importa node:*) se cobra aquí: ' +
          'un npm ci añadiría dos minutos y una dependencia del registro de npm y del CDN ' +
          'de SheetJS a un paso que solo hace una petición HTTP.',
      ).not.toMatch(/npm\s+(ci|install)/);
    }
  });

  it('6.2 — no restaura ninguna caché de dependencias', () => {
    for (const step of steps()) {
      expect(step.uses ?? '').not.toMatch(/^actions\/cache/);
      expect(step.with?.cache).toBeUndefined();
      expect(step.with?.['cache-dependency-path']).toBeUndefined();
    }
  });

  it('6.3 — no define ninguna variable de entorno, ni en el job ni en un step', () => {
    for (const job of jobs()) expect(job.env).toBeUndefined();
    for (const step of steps()) expect(step.env).toBeUndefined();
  });

  it('6.4 — la versión de Node sale de .nvmrc y no hay ningún número en el YAML', () => {
    const setups = steps().filter((s) => (s.uses ?? '').startsWith('actions/setup-node'));
    expect(setups.length).toBeGreaterThan(0);
    for (const step of setups) {
      expect(step.with?.['node-version-file']).toBe('.nvmrc');
      expect(step.with?.['node-version']).toBeUndefined();
    }
    // Una sola fuente para la versión de Node (SPEC-027 CA-6).
    expect(puerta().source).not.toMatch(/node-version:/);
  });

  it('6.5 — no toca la base de datos ni migra nada', () => {
    for (const step of steps()) {
      expect(step.run ?? '').not.toMatch(/db:migrate|drizzle-kit|DATABASE_URL/);
    }
  });
});

describe('SPEC-028 CA-7: el plazo es mayor que el build, y el veredicto no se traga', () => {
  it('7.1 — pasa --timeout y --interval explícitos, sin apoyarse en los defectos del script', () => {
    // Los defectos del script son 120 s y 5 s (SPEC-031). Un build de Vercel con
    // guardia y migraciones no cabe ahí, y heredar un defecto de otra spec es una
    // dependencia invisible.
    expect(Number(bandera('timeout'))).toBe(PLAZO_SEGUNDOS);
    expect(Number(bandera('interval'))).toBe(INTERVALO_SEGUNDOS);
  });

  it('7.1 — el plazo es holgadamente mayor que un build completo (~40 s en ADR-018)', () => {
    expect(Number(bandera('timeout'))).toBeGreaterThan(600);
  });

  it('7.2 — ni el job ni el step llevan continue-on-error', () => {
    for (const job of jobs()) expect(job['continue-on-error']).toBeUndefined();
    for (const step of steps()) expect(step['continue-on-error']).toBeUndefined();
    expect(puerta().source).not.toContain('continue-on-error');
  });

  it('7.2 — el veredicto no se traga con `|| true` ni con ningún encadenado', () => {
    const run = pasoDeComprobacion()[0].run!.trim();
    expect(
      run,
      'Una puerta que nunca se pone roja es peor que no tener puerta, porque además ' +
        'tranquiliza.',
    ).not.toMatch(/\|\||;|&&/);
    expect(run.endsWith('|| true')).toBe(false);
  });

  it('7.2 — ningún step lleva `if: always()` sobre el veredicto', () => {
    for (const step of steps()) {
      expect(step.if ?? '').not.toMatch(/always\(\)/);
    }
  });

  it('7.3 — el job declara timeout-minutes, y corta después que el script', () => {
    for (const job of jobs()) {
      const minutos = job['timeout-minutes'];
      expect(typeof minutos, `El job "${job.name}" no declara timeout-minutes`).toBe('number');
      expect(
        minutos! * 60,
        'Si el runner corta antes que el script, quien manda es un cuelgue mudo y no ' +
          'el mensaje de check-alive, que dice el sha esperado y el último visto.',
      ).toBeGreaterThan(PLAZO_SEGUNDOS);
    }
  });
});

describe('SPEC-028 CA-8: concurrencia propia; la CI conserva la suya', () => {
  it('8.1 — la puerta declara un grupo de concurrencia distinto del de la CI', () => {
    const grupoPuerta = puerta().workflow.concurrency?.group;
    const grupoCi = ci().workflow.concurrency?.group;
    expect(typeof grupoPuerta).toBe('string');
    expect(grupoPuerta).not.toBe(grupoCi);
  });

  it('8.2 — la puerta cancela la pasada en curso: un push nuevo invalida a la vieja', () => {
    // La puerta afirma "lo más nuevo de main está vivo". Si llega un commit
    // posterior, Vercel desplegará ese y la puerta vieja esperaría un sha que ya
    // nunca estará vivo: su rojo sería garantizado y sin significado.
    expect(puerta().workflow.concurrency?.['cancel-in-progress']).toBe(true);
  });

  it('8.3 — ci.yml conserva su cancel-in-progress condicionado a pull_request', () => {
    const concurrency = ci().workflow.concurrency!;
    expect(concurrency.group).toContain('github.ref');
    expect(String(concurrency['cancel-in-progress'])).toMatch(
      /github\.event_name\s*==\s*'pull_request'/,
    );
  });
});

describe('SPEC-028 CA-9: nada más queda cableado', () => {
  it('9.1 — ci.yml conserva sus disparadores, sus permisos y su forma', () => {
    // Congelado por estructura y no por hash: lo que CA-9.1 protege es que esta
    // spec no le añada un step, un disparador ni un cambio de concurrencia.
    const { workflow } = ci();
    expect(Object.keys(workflow.on ?? {}).sort()).toEqual(['pull_request', 'push']);
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(Object.values(workflow.jobs).map((j) => j.name)).toEqual(['Checks', 'E2E']);
    expect(
      Object.values(workflow.jobs).flatMap((j) => (j.steps ?? []).map((s) => s.name)),
    ).toEqual([
      'Checkout',
      'Set up Node',
      'Install dependencies',
      'Typecheck',
      'Lint',
      'Unit tests',
      'Migration scan',
      // SPEC-038 CA-13 / ADR-024 pto. 9. Esta lista congelaba «SPEC-028 no le
      // añade un step a ci.yml», y esa propiedad SIGUE siendo la que se protege:
      // lo que caduca al mergear no es la afirmación sino su forma —una foto del
      // árbol—. Se amplía con la entrada que un CA pide, y con esa sola; la lista
      // queda igual de cerrada que estaba y la siguiente vuelve a ponerla roja.
      // El gate hermano de esta misma entrada vive en
      // `tests/spec-031-frontera.test.ts` CA-13.1, ampliado igual y por lo mismo.
      'Version bump',
      'Checkout',
      'Set up Node',
      'Install dependencies',
      'Cache Playwright browsers',
      'Install Playwright browser',
      'Build',
      'End-to-end tests',
      'Upload e2e diagnostics',
    ]);
  });

  it('9.2 — vercel.json sigue siendo exactamente lo que era', () => {
    expect(JSON.parse(readFileSync(join(rootDir, 'vercel.json'), 'utf8'))).toEqual({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      buildCommand: 'node scripts/guard-migrate.mjs && npm run db:migrate && npm run build',
      crons: [{ path: '/api/cron/refresh', schedule: '0 22 * * *' }],
    });
  });

  it('9.3 — package.json no gana ningún script sin un CA que lo pida', () => {
    // Igual que 9.1: lo que esta lista afirma es que SPEC-028 no añadió scripts, y
    // eso sigue siendo cierto. `version:check` lo trae SPEC-038 CA-13 —el gate de
    // ADR-024 pto. 9— y entra por la puerta de delante, declarado en su spec y
    // discutido en su gate. La lista sigue cerrada: el siguiente que aparezca sin
    // CA detrás vuelve a poner esto en rojo.
    //
    // AMPLIADA POR SPEC-047 (CA-19), arbitraje del humano del 2026-08-22 — y por la
    // puerta que este propio test dejó abierta arriba, que es la única que hay.
    //
    // Qué vigilaba antes: la lista cerrada de claves de `scripts` tal y como quedó al
    // entrar `version:check`. Qué vigila ahora: exactamente lo mismo, con una clave
    // más. Sigue siendo un `toEqual` contra un array literal —comparación EXACTA, no
    // `arrayContaining` ni `toContain`—, así que una clave de más o de menos sigue
    // poniendo esto en rojo. No se ha borrado ningún caso ni se ha marcado ninguno
    // `.skip`.
    //
    // En virtud de qué entra `icon:build`: **CA-17 de SPEC-047**, que exige que el
    // `.ico` se reproduzca «desde fuente comprometida» con «un script propio en
    // `scripts/`, invocable por un `npm run`». Un binario comprometido sin forma de
    // regenerarlo es un callejón sin salida, y una librería de imagen para dibujar tres
    // formas era la alternativa que CE-M3 descarta. La clave, por tanto, tiene CA
    // detrás, declarado en su spec y discutido en su gate: la misma puerta que
    // `version:check`, y la regla de arriba no se afloja ni un milímetro.
    const { scripts } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(Object.keys(scripts).sort()).toEqual(
      [
        'build',
        'db:generate',
        'db:migrate',
        'db:scan',
        'dev',
        'icon:build',
        'lint',
        'start',
        'test',
        'test:e2e',
        'test:watch',
        'typecheck',
        'version:check',
      ].sort(),
    );
  });

  it('9.3 — drizzle/ no gana ningún .sql en ESTA entrega', () => {
    // Las nueve que había al cerrar SPEC-028, en su sitio y en su orden. Lo que CA-9.3
    // afirma es que esta spec no migró nada, no que nadie pueda migrar después: la
    // ventana la fija el rango de commits de abajo, no un recuento eterno. Enmienda de
    // SPEC-034, que trae `0009_user_role` (aditiva, RI-01).
    const previas = [
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
    const sql = readdirSync(join(rootDir, 'drizzle'))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    expect(sql.slice(0, previas.length)).toEqual(previas);
  });
});

/**
 * CA-9.3 y CA-9.4, la mitad que solo el diff puede decidir: que `src/` no cambie
 * ni una línea y que **no se edite ni un test de otra spec**.
 *
 * `F-SPEC-032-3` es el precedente que este bloque viene a evitar: allí hubo que
 * tocar dos literales congelados de SPEC-031 y el implementador tuvo que
 * declararlo. Aquí el coste es evitable por completo (la puerta vive en su propio
 * fichero) y por eso se vigila.
 *
 * Se salta —y lo dice— si el commit base no está en el clon: los tests de
 * frontera de SPEC-031 y SPEC-032 fijaron la convención de poder decidir en un
 * clon superficial de CI, y esta comprobación no puede. La evidencia de la que
 * no puede prescindir el verificador es el `git diff --stat` del ledger.
 */
const BASE = 'de3a6ee';

/**
 * Hasta dónde llega ESTA entrega: el merge de SPEC-028 en `main` (PR #35).
 *
 * Antes el rango terminaba en `HEAD`, y eso convertía un CA sobre el diff de una PR
 * en una condena perpetua: cualquier spec posterior que tocara `src/` ponía en rojo
 * el CA-9 de SPEC-028 sin que SPEC-028 hubiera cambiado nada. La ventana correcta es
 * la de su propia entrega, y así la comprobación sigue diciendo exactamente lo que se
 * verificó — ni más ni menos. Enmienda de SPEC-034, la primera que tocó `src/`
 * después. Si alguno de los dos sha no está en el clon, el bloque se salta igual.
 */
const HASTA = '0d389c8';

function baseDisponible(): boolean {
  try {
    for (const rev of [BASE, HASTA]) {
      execFileSync('git', ['-C', rootDir, 'rev-parse', '--verify', `${rev}^{commit}`], {
        stdio: 'ignore',
      });
    }
    return true;
  } catch {
    return false;
  }
}

function ficherosTocados(): string[] {
  return execFileSync('git', ['-C', rootDir, 'diff', '--name-only', `${BASE}...${HASTA}`], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

describe.skipIf(!baseDisponible())(
  'SPEC-028 CA-9: y el diff contra origin/main no toca lo que no debe',
  () => {
    it('9.3 — src/ no cambia ni una línea', () => {
      expect(ficherosTocados().filter((f) => f.startsWith('src/'))).toEqual([]);
    });

    it('9.1 y 9.2 — ni ci.yml ni vercel.json aparecen en el diff', () => {
      const tocados = ficherosTocados();
      expect(tocados).not.toContain('.github/workflows/ci.yml');
      expect(tocados).not.toContain('vercel.json');
    });

    it('9.4 — no se ha editado ni un test de otra spec', () => {
      const ajenos = [
        'tests/spec-031-frontera.test.ts',
        'tests/spec-032-frontera.test.ts',
        'tests/ci-workflow.test.ts',
      ];
      const tocados = ficherosTocados();
      for (const fichero of ajenos) {
        expect(
          tocados,
          `${fichero} pertenece a otra spec. Si esta entrega necesita cambiarlo, la ` +
            'conversación ocurre ANTES de tocarlo (es el caso de F-SPEC-032-3).',
        ).not.toContain(fichero);
      }
    });
  },
);
