import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  blob,
  ficherosDeLaVentana,
  git,
  hayVentana,
  lineasDeCodigoDelDiff,
  testsModificadosEnLaVentana,
  type Ventana,
} from './ventana-fija';

/**
 * SPEC-048 CA-9 — **prueba de no-caducidad por merge simulado**.
 *
 * *Éste es el caso que impide repetir el error de SPEC-047* (CA-9.4). ADR-031 pto. 2
 * afirma que una guardia anclada a dos sha fijos no puede invertirse cuando `main`
 * avanza. Aquí eso **se prueba, no se argumenta**: se construye un repositorio temporal
 * en el que `main` ya ha avanzado por encima de la entrega de SPEC-047 y se vuelven a
 * evaluar allí las aserciones re-encuadradas.
 *
 * El atajo —*«confía, la ventana es fija»*— es exactamente el razonamiento que produjo el
 * rojo del 2026-08-22: quien escribió las dos guardias defectuosas conocía la convención
 * de `FOUNDATION.md`, escrita dos días antes, y aun así las escribió contra `origin/main`.
 * Por eso la prueba lleva **control negativo** (CA-9.3): la formulación vieja tiene que
 * FALLAR en ese mismo futuro. Si no falla, el escenario no reproduce la caducidad y el
 * caso es rojo — la comprobación no probaría nada.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** La ventana de la entrega de SPEC-047, la misma que declaran las dos guardias (CA-1). */
const ENTREGA_DE_SPEC_047: Ventana = { antes: '6da9fbe', despues: '104f94e' };

/**
 * **La formulación vieja, el espécimen del experimento.**
 *
 * Es literalmente lo que los dos ficheros hacían antes: `origin/main...HEAD`. Aparece
 * aquí como **dato**, no como revisión escrita dentro de una llamada a git — se le pasa a
 * las mismas funciones de `tests/ventana-fija.ts` que reciben la ventana buena, y son
 * ellas las que invocan a git. Es el mismo carve-out que RI-03 concede a
 * `tests/version-bump-gate.test.ts` cuando le pasa `HEAD` como ENTRADA al script bajo
 * prueba (SPEC-048 CA-10.2): la revisión móvil es el sujeto de la prueba, no su método.
 */
const FORMULACION_VIEJA: Ventana = { antes: 'origin/main', despues: 'HEAD' };

/** Lo que SPEC-047 CA-18 y CA-19.1 afirman sobre su propia entrega. */
const AMPLIABLES = [
  'tests/cuenta-rutas.test.ts',
  'tests/deploy-gate-workflow.test.ts',
  'tests/legal-rutas-publicas.test.ts',
];

/** El CUARTO fichero ajeno que el futuro simulado toca: el que habría puesto RED a CA-18. */
const CUARTO_FICHERO_AJENO = 'tests/ci-workflow.test.ts';

const HAY_VENTANA = hayVentana(rootDir, ENTREGA_DE_SPEC_047);

const ENTORNO = {
  ...process.env,
  GIT_AUTHOR_NAME: 'SPEC-048',
  GIT_AUTHOR_EMAIL: 'spec048@stockeiro.invalid',
  GIT_COMMITTER_NAME: 'SPEC-048',
  GIT_COMMITTER_EMAIL: 'spec048@stockeiro.invalid',
  GIT_CONFIG_GLOBAL: '',
  GIT_CONFIG_SYSTEM: '',
};

const gitEn = (repo: string, args: string[], entrada?: string) =>
  execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    env: ENTORNO,
    input: entrada,
    stdio: entrada === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  });

/** Lo que hay que poder afirmar, al terminar, que sigue exactamente igual (CA-9.1). */
type Foto = { cabeza: string; referencias: string; arbol: string };

function foto(): Foto {
  return {
    cabeza: git(rootDir, 'rev-parse', 'HEAD').trim(),
    referencias: git(rootDir, 'show-ref').trim(),
    // El árbol de trabajo se mira acotado a las cuatro carpetas de código y documentación
    // porque varias suites e2e antiguas escriben dentro de `_qa/` al correr, y la batería
    // es paralela: comparar el `status` entero haría de este centinela una moneda al aire.
    arbol: git(rootDir, 'status', '--porcelain', '--', 'src/', 'tests/', 'scripts/', 'docs/').trim(),
  };
}

let temporal = '';
let futuro = '';
let commitDelFuturo = '';
let antesDeTodo: Foto = { cabeza: '', referencias: '', arbol: '' };

describe.skipIf(!HAY_VENTANA)('SPEC-048 CA-9: el arreglo no caduca cuando main avanza', () => {
  beforeAll(() => {
    antesDeTodo = foto();

    // CA-9.1 — el futuro se construye en un repositorio temporal, con fontanería y sin
    // árbol de trabajo (`--no-checkout`): en Windows el checkout completo de este
    // repositorio no cabe bajo un directorio temporal sin pasarse del límite de ruta, y
    // además no hace falta ni un fichero en disco para escribir un commit.
    temporal = mkdtempSync(join(tmpdir(), 'spec048-futuro-'));
    futuro = join(temporal, 'clon');
    execFileSync('git', ['clone', '--shared', '--no-checkout', '--quiet', rootDir, futuro], {
      encoding: 'utf8',
      env: ENTORNO,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Un commit posterior a `104f94e` que **habría invertido la formulación vieja**: toca
    // `src/proxy.ts` —la línea del matcher, justo lo que CA-16 medía— y modifica un CUARTO
    // fichero ajeno de `tests/`, que es lo que CA-18 y CA-19.1 prohíben.
    gitEn(futuro, ['read-tree', ENTREGA_DE_SPEC_047.despues]);
    const proxy = blob(futuro, ENTREGA_DE_SPEC_047.despues, 'src/proxy.ts').replace(
      'favicon.ico|icon.svg',
      'favicon.ico|icon.svg|inventado.svg',
    );
    const cuarto =
      blob(futuro, ENTREGA_DE_SPEC_047.despues, CUARTO_FICHERO_AJENO) +
      '\n// Tocado por una spec futura que nada tiene que ver con SPEC-047.\n';

    const objeto = (contenido: string) =>
      gitEn(futuro, ['hash-object', '-w', '--stdin'], contenido).trim();
    gitEn(futuro, [
      'update-index',
      '--add',
      '--cacheinfo',
      `100644,${objeto(proxy)},src/proxy.ts`,
    ]);
    gitEn(futuro, [
      'update-index',
      '--add',
      '--cacheinfo',
      `100644,${objeto(cuarto)},${CUARTO_FICHERO_AJENO}`,
    ]);

    const arbol = gitEn(futuro, ['write-tree']).trim();
    commitDelFuturo = gitEn(futuro, [
      'commit-tree',
      arbol,
      '-p',
      ENTREGA_DE_SPEC_047.despues,
      '-m',
      'futuro simulado: main avanza por encima de la entrega de SPEC-047',
    ]).trim();

    // Y `main` —la local y la remota— pasa a apuntar ahí. Es el estado exacto en el que
    // la CI de `main` se puso roja el 2026-08-22: la diana ya se movió.
    gitEn(futuro, ['update-ref', 'refs/heads/main', commitDelFuturo]);
    gitEn(futuro, ['update-ref', 'refs/remotes/origin/main', commitDelFuturo]);
    gitEn(futuro, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  });

  afterAll(() => {
    try {
      rmSync(temporal, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // Un temporal que no se deja borrar en Windows no es motivo para tumbar la suite.
    }
  });

  it('CA-9.1 — el futuro simulado existe y de verdad ha movido la diana', () => {
    // Centinela del escenario: si el commit no llegara a existir, o no tocara lo que dice
    // tocar, el control negativo de abajo fallaría por el motivo equivocado y esta prueba
    // no probaría nada.
    expect(commitDelFuturo).toMatch(/^[0-9a-f]{40}$/);
    expect(gitEn(futuro, ['rev-parse', 'origin/main']).trim()).toBe(commitDelFuturo);
    expect(gitEn(futuro, ['rev-parse', 'HEAD']).trim()).toBe(commitDelFuturo);

    const traeElFuturo = ficherosDeLaVentana(futuro, {
      antes: ENTREGA_DE_SPEC_047.despues,
      despues: commitDelFuturo,
    });
    expect(traeElFuturo.sort()).toEqual([CUARTO_FICHERO_AJENO, 'src/proxy.ts'].sort());
  });

  it('CA-9.2 — la ventana fija devuelve exactamente lo mismo que en el árbol actual', () => {
    expect(ficherosDeLaVentana(futuro, ENTREGA_DE_SPEC_047)).toEqual(
      ficherosDeLaVentana(rootDir, ENTREGA_DE_SPEC_047),
    );
  });

  it('CA-9.2 — la aserción de CA-4 sigue verde y con los mismos valores', () => {
    const enElFuturo = lineasDeCodigoDelDiff(futuro, ENTREGA_DE_SPEC_047, 'src/proxy.ts');
    const enElArbol = lineasDeCodigoDelDiff(rootDir, ENTREGA_DE_SPEC_047, 'src/proxy.ts');

    expect(enElFuturo).toEqual(enElArbol);
    expect(enElFuturo.quitadas).toHaveLength(1);
    expect(enElFuturo.anadidas).toHaveLength(1);
    expect(enElFuturo.quitadas[0]).toContain('matcher');
    expect(enElFuturo.anadidas[0]).toContain('matcher');
  });

  it('CA-9.2 — las aserciones de CA-5 y CA-6 siguen verdes y con los mismos valores', () => {
    const enElFuturo = testsModificadosEnLaVentana(futuro, ENTREGA_DE_SPEC_047);

    expect(enElFuturo).toEqual(testsModificadosEnLaVentana(rootDir, ENTREGA_DE_SPEC_047));
    expect(enElFuturo).toEqual(AMPLIABLES);
    expect(
      enElFuturo,
      'el cuarto fichero que el futuro toca NO puede aparecer aquí: la ventana es de la ' +
        'entrega de SPEC-047, y lo que pasó después no es suyo',
    ).not.toContain(CUARTO_FICHERO_AJENO);
  });

  it('CA-9.3 — control negativo: la formulación vieja FALLA en ese mismo futuro', () => {
    // Sin esto la prueba no prueba nada. ADR-031 pto. 2 dice que anclar a dos sha fijos
    // hace que el veredicto no dependa de dónde apunte ninguna rama; lo que se comprueba
    // aquí es la otra mitad: que en este futuro la formulación VIEJA —`origin/main...HEAD`,
    // la que los dos ficheros tenían hasta el 2026-08-22— se invierte de verdad. Si no se
    // invirtiera, el escenario no reproduciría la caducidad y los verdes de CA-9.2 serían
    // gratis.
    const aserciónViejaDeCA5 = () => {
      expect(testsModificadosEnLaVentana(futuro, FORMULACION_VIEJA)).toEqual(AMPLIABLES);
    };
    expect(
      aserciónViejaDeCA5,
      'la formulación vieja NO falla en el futuro simulado: el escenario no reproduce la ' +
        'caducidad y este caso no demuestra nada',
    ).toThrow();

    const aserciónViejaDeCA4 = () => {
      expect(
        lineasDeCodigoDelDiff(futuro, FORMULACION_VIEJA, 'src/proxy.ts').quitadas,
      ).toHaveLength(1);
    };
    expect(aserciónViejaDeCA4, 'la formulación vieja de CA-4 tampoco puede sobrevivir').toThrow();
  });

  it('CA-9.3 — y se ve por qué: contra una diana móvil el diff queda vacío', () => {
    // El mecanismo exacto del incidente, dicho con el dato delante: cuando `origin/main`
    // ya contiene el propio cambio, `origin/main...HEAD` no devuelve nada. De ahí salen a
    // la vez los tres ROJOS —una lista vacía no es la lista esperada— y los doce VERDES
    // VACÍOS —una lista vacía no contiene nada prohibido—. La misma causa, dos síntomas, y
    // el silencioso es el peor.
    expect(ficherosDeLaVentana(futuro, FORMULACION_VIEJA)).toEqual([]);
    expect(testsModificadosEnLaVentana(futuro, FORMULACION_VIEJA)).toEqual([]);
    expect(
      ficherosDeLaVentana(futuro, FORMULACION_VIEJA).filter((f) => f.startsWith('public/')),
      'aquí está el verde vacío: la comprobación pasa sin haber mirado nada',
    ).toEqual([]);
  });

  it('CA-9.1 — y el repositorio real queda como estaba: ni un ref, ni un fichero', () => {
    const ahora = foto();
    expect(ahora.cabeza, 'la prueba ha movido HEAD del repositorio real').toBe(antesDeTodo.cabeza);
    expect(ahora.referencias, 'la prueba ha tocado alguna referencia del repositorio real').toBe(
      antesDeTodo.referencias,
    );
    expect(ahora.arbol, 'la prueba ha ensuciado el árbol de trabajo').toBe(antesDeTodo.arbol);
  });
});
