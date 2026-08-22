import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  blob,
  ficherosDeLaVentana,
  hayVentana,
  lineasDeCodigoDelDiff,
  testsModificadosEnLaVentana,
  type Ventana,
} from './ventana-fija';

/**
 * SPEC-047 CA-16 y CA-17 — **la frontera de la mejora**.
 *
 * Esta spec es presentación pura (CE-M1) y no trae peso nuevo (CE-M3), y las dos
 * cosas se afirman en el enunciado. Aquí se comprueban contra `git`, que es donde
 * viven de verdad: el conjunto de ficheros tocados, la única línea del guardián de
 * sesión, la reproducibilidad del binario y la ausencia de dependencias nuevas.
 *
 * De propina, la mitad estática de CA-4: que los `<link>` NO se escriban a mano. La
 * otra mitad —que Next los emita y sólo una vez— necesita servidor y está en
 * `tests/e2e/icono.spec.ts`.
 *
 * **Re-encuadrado entero por SPEC-048 el 2026-08-22.** Lo que aquí mira un diff lo mira
 * ahora sobre la ventana fija de la entrega de SPEC-047, no contra `origin/main`. El
 * porqué está escrito caso a caso, al lado de cada aserción, como exige `FOUNDATION.md`
 * § *Cómo se trabaja aquí* y ahora también RI-03 (ADR-031).
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * **La ventana de la entrega de SPEC-047** — SPEC-048 CA-1, ADR-031 pto. 2.1.
 *
 * `6da9fbe` es `main` justo antes del merge (`104f94e^1`) y `104f94e` el merge de la
 * PR #52. Entre esos dos commits está TODO lo que SPEC-047 entregó, y es un hecho que
 * ya no puede cambiar.
 *
 * Antes este fichero declaraba `const BASE = 'origin/main'` y comparaba la rama contra
 * él. Mientras la rama estaba sin mergear eso funcionaba; al mergear, `origin/main` pasó
 * a incluir el propio cambio, el diff quedó **vacío**, tres casos se invirtieron para
 * siempre —run 32583255349— y otros seis pasaron a estar verdes sin mirar nada. Es el
 * quinto incidente de esa familia y el que originó ADR-031: un criterio con forma de
 * *«este cambio está bien acotado»* no puede medirse contra una diana que se mueve.
 *
 * Riesgo declarado y aceptado (ADR-031, §Consecuencias): anclar a sha ata la suite al
 * histórico de git. Si alguno de los dos no está en el clon, el bloque se salta —y
 * `tests/guardias-ancladas.test.ts` comprueba que ese salto **no ocurre en CI**.
 */
const ENTREGA_DE_SPEC_047: Ventana = { antes: '6da9fbe', despues: '104f94e' };

const HAY_VENTANA = hayVentana(rootDir, ENTREGA_DE_SPEC_047);

/**
 * Los ficheros que la entrega de SPEC-047 tocó, **committeados**.
 *
 * Enmienda de CA-16 tras F-SPEC-047-1: antes esto unía el diff con `git status`, es decir
 * miraba el árbol de trabajo. No servía, y no por un descuido de aquella spec: **varias
 * suites e2e antiguas escriben dentro de `_qa/` al correr**, así que pasar la batería
 * entera ensucia `_qa/SPEC-001/…` y compañía sin que nadie haya cambiado nada. Ese ruido
 * es preexistente y la regla es descartarlo, no cometerlo — por eso lo que se juzga es lo
 * comiteado, que es lo que se mergeó.
 */
function tocados(): string[] {
  return ficherosDeLaVentana(rootDir, ENTREGA_DE_SPEC_047);
}

/** El conjunto cerrado de CA-16. Nada de `src/db/`, nada de `drizzle/`, nada de `src/lib/`. */
const PERMITIDO = [
  /^src\/app\/icon\.svg$/,
  /^src\/app\/favicon\.ico$/,
  /^src\/proxy\.ts$/,
  /^scripts\//,
  /^tests\//,
  /^docs\//,
  // La evidencia visual que se commitea vive aquí, y sólo aquí (CA-16, enmienda del
  // 2026-08-22). Las capturas de trabajo van a `test-results/SPEC-047/`, que está en
  // `.gitignore` y por tanto no puede ensuciar el diff.
  /^_qa\/SPEC-047\//,
  /^package\.json$/,
];

/** La comparación de CA-16, aislada para poder volver a ejecutarla contra una entrada mutada. */
const fueraDelConjunto = (lista: string[]) => lista.filter((f) => !PERMITIDO.some((p) => p.test(f)));

/** La de «ni un dato, ni un cálculo, ni una regla», igual. */
const zonasProhibidas = (lista: string[]) =>
  lista.filter((f) => /^(src\/db\/|drizzle\/|src\/lib\/)/.test(f));

/** Y la de la evidencia visual ajena. */
const qaAjenas = (lista: string[]) => [
  ...new Set(
    lista
      .filter((f) => f.startsWith('_qa/') && !f.startsWith('_qa/SPEC-047/'))
      .map((f) => f.split('/').slice(0, 2).join('/')),
  ),
];

describe.skipIf(!HAY_VENTANA)('SPEC-047 CA-16 sobre la ventana de su entrega', () => {
  it('la ventana no está vacía: trajo el icono, su generador y el guardián', () => {
    // SPEC-048 CA-2 — centinela de no-vacuidad (ADR-031 pto. 2.2). Sin este caso, una
    // ventana mal escrita dejaría todo el bloque en verde sin haber mirado nada, que es
    // exactamente el modo de fallo que trajo aquí a SPEC-048: al mergear la PR #52 el
    // diff quedó vacío y seis casos de este fichero pasaron a pasar por vacuidad.
    const ficheros = tocados();
    for (const esperado of ['src/app/icon.svg', 'scripts/build-icon.mjs', 'src/proxy.ts']) {
      expect(ficheros, 'la ventana de SPEC-047 no contiene lo que SPEC-047 entregó').toContain(
        esperado,
      );
    }
  });

  it('no se toca ni un fichero fuera del conjunto pactado', () => {
    // Re-encuadrado por SPEC-048 CA-7 el 2026-08-22, por arbitraje del humano (Alberto
    // Fojo). Qué vigilaba antes: el diff de la rama contra `origin/main`, que al mergear
    // la PR #52 quedó vacío y dejó este caso pasando sin mirar nada. Qué vigila ahora: los
    // ficheros de la ventana fija de la entrega, un hecho que ya no puede cambiar. Y para
    // que no vuelva a estar verde por vacuidad, la MISMA comparación se ejecuta contra una
    // entrada mutada y tiene que rechazarla — la disciplina que SPEC-047 CA-19.3 aplicó a
    // las guardias ajenas, aplicada aquí a las propias.
    const fuera = fueraDelConjunto(tocados());
    expect(fuera, `ficheros fuera del alcance de SPEC-047:\n${fuera.join('\n')}`).toEqual([]);
    expect(
      fueraDelConjunto([...tocados(), 'src/db/schema.ts']),
      'la comparación acepta un fichero fuera del conjunto: ha dejado de estar cerrada',
    ).toEqual(['src/db/schema.ts']);
  });

  it('ni un dato, ni un cálculo, ni una regla: nada bajo src/db, drizzle o src/lib', () => {
    // Re-encuadrado por SPEC-048 CA-7 el 2026-08-22, por arbitraje del humano (Alberto
    // Fojo). Qué vigilaba antes: el diff contra `origin/main`, vacío desde el merge. Qué
    // vigila ahora: la ventana fija de la entrega. La mutación de abajo demuestra que la
    // comparación sigue rechazando lo que tiene que rechazar.
    expect(zonasProhibidas(tocados())).toEqual([]);
    expect(
      zonasProhibidas([...tocados(), 'drizzle/0010_inventada.sql']),
      'la comparación acepta una migración: ha dejado de mirar',
    ).toEqual(['drizzle/0010_inventada.sql']);
  });

  it('la evidencia de otras specs es suya: ninguna otra _qa/SPEC-NNN/ en el diff', () => {
    // Re-encuadrado por SPEC-048 CA-7 el 2026-08-22, por arbitraje del humano (Alberto
    // Fojo). Qué vigilaba antes: el diff contra `origin/main`, vacío desde el merge. Qué
    // vigila ahora: la ventana fija de la entrega. Con la mutación, la misma comparación
    // encuentra la evidencia ajena — no está pasando por lista vacía.
    expect(
      qaAjenas(tocados()),
      'la e2e reescribe capturas de specs viejas al correr: se descartan ' +
        '(`git checkout -- _qa`), no se cometen',
    ).toEqual([]);
    expect(qaAjenas([...tocados(), '_qa/SPEC-001/portada.png'])).toEqual(['_qa/SPEC-001']);
  });

  it('el guardián de sesión cambia en una sola línea de código: la del matcher', () => {
    // Re-encuadrado por SPEC-048 CA-4 el 2026-08-22, por arbitraje del humano (Alberto
    // Fojo). Qué vigilaba antes: el diff de `src/proxy.ts` contra `origin/main`, que al
    // mergear la PR #52 quedó vacío y puso este caso en ROJO permanente — es el R-1 del
    // run 32583255349. Qué vigila ahora: el mismo diff sobre la ventana fija de la
    // entrega. La afirmación no se afloja ni un milímetro: sigue siendo «exactamente una
    // línea quitada, exactamente una añadida, y las dos con `matcher`». Lo que cambia es
    // que vuelve a ser comprobable, y para siempre, porque el rango ya no se mueve.
    //
    // El porqué del cambio se dejó escrito en el propio fichero, con el estilo en prosa
    // que `proxy.ts` usa para documentar sus decisiones. Los comentarios no son
    // comportamiento: lo que CA-16 acota es el CÓDIGO que cambia, y es una línea.
    const { quitadas, anadidas } = lineasDeCodigoDelDiff(
      rootDir,
      ENTREGA_DE_SPEC_047,
      'src/proxy.ts',
    );

    expect(quitadas, 'se ha quitado más de una línea de código').toHaveLength(1);
    expect(anadidas, 'se ha añadido más de una línea de código').toHaveLength(1);
    expect(quitadas[0]).toContain('matcher');
    expect(anadidas[0]).toContain('matcher');
  });
});

describe('SPEC-047 CA-4 (mitad estática): los <link> no se escriben a mano', () => {
  it('layout.tsx no declara ningún <link rel="icon"> ni campo icons en metadata', () => {
    const layout = readFileSync(join(rootDir, 'src', 'app', 'layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/rel=["']icon/);
    expect(layout).not.toMatch(/\bicons\s*:/);
  });
});

describe.skipIf(!HAY_VENTANA)('SPEC-047 CA-4: la entrega no creó nada bajo public/', () => {
  it('no nace ningún fichero bajo public/', () => {
    // Re-encuadrado por SPEC-048 CA-7 el 2026-08-22, por arbitraje del humano (Alberto
    // Fojo). Qué vigilaba antes: el diff contra `origin/main`, vacío desde el merge —un
    // filtro sobre una lista vacía es verde siempre—. Qué vigila ahora: la ventana fija de
    // la entrega, con su mutación de control al lado.
    expect(tocados().filter((f) => f.startsWith('public/'))).toEqual([]);
    expect([...tocados(), 'public/favicon.ico'].filter((f) => f.startsWith('public/'))).toEqual([
      'public/favicon.ico',
    ]);
  });
});

describe('SPEC-047 CA-17: el .ico se reproduce, y sin dependencia nueva', () => {
  it('regenerar sobre un árbol limpio devuelve los mismos bytes, uno a uno', () => {
    const salida = mkdtempSync(join(tmpdir(), 'icono-047-'));
    try {
      execFileSync(process.execPath, [join('scripts', 'build-icon.mjs'), '--out', salida], {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      for (const fichero of ['favicon.ico', 'icon.svg']) {
        const generado = readFileSync(join(salida, fichero));
        const committeado = readFileSync(join(rootDir, 'src', 'app', fichero));
        expect(
          generado.equals(committeado),
          `${fichero} regenerado difiere del committeado: el binario y su fuente se han ` +
            'separado. Ejecuta `npm run icon:build` y comete el resultado.',
        ).toBe(true);
      }
    } finally {
      rmSync(salida, { recursive: true, force: true });
    }
  });

  it('el generador está declarado como npm run, no como conjuro de una sesión', () => {
    const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
    expect(pkg.scripts['icon:build']).toContain('scripts/build-icon.mjs');
  });

  it('el generador sólo importa de node:*, como los demás scripts del proyecto', () => {
    for (const fichero of ['build-icon.mjs', 'icon-geometry.mjs']) {
      const fuente = readFileSync(join(rootDir, 'scripts', fichero), 'utf8');
      for (const m of fuente.matchAll(/from\s+'([^']+)'/g)) {
        expect(m[1], `${fichero} importa ${m[1]}`).toMatch(/^(node:|\.\/|\.\.\/)/);
      }
    }
  });
});

describe.skipIf(!HAY_VENTANA)('SPEC-047 CA-17: la entrega no trajo dependencia nueva', () => {
  it('no entra ninguna dependencia nueva en package.json', () => {
    // Re-encuadrado por SPEC-048 CA-7 el 2026-08-22, por arbitraje del humano (Alberto
    // Fojo). Qué vigilaba antes: el `package.json` del árbol contra el de `origin/main`
    // —que desde el merge de la PR #52 es el mismo blob, así que el caso pasaba por
    // definición sin comparar nada—. Qué vigila ahora: los dos extremos de la ventana de
    // la entrega, uno contra otro. Con una dependencia inventada de más, la MISMA
    // comparación deja de coincidir: no está pasando por vacuidad.
    const antes = JSON.parse(blob(rootDir, ENTREGA_DE_SPEC_047.antes, 'package.json'));
    const despues = JSON.parse(blob(rootDir, ENTREGA_DE_SPEC_047.despues, 'package.json'));

    expect(despues.dependencies).toEqual(antes.dependencies);
    expect(despues.devDependencies).toEqual(antes.devDependencies);

    expect(
      { ...despues.dependencies, inventada: '^1.0.0' },
      'la comparación de dependencias no distingue una clave de más',
    ).not.toEqual(antes.dependencies);
  });
});

/** Las tres guardias que el arbitraje del humano del 2026-08-22 autoriza a ampliar. Ni una
 *  más: la lista, su porqué y sus cuatro condiciones las ejecuta CA-19 en
 *  `tests/icono-guardias-ampliadas.test.ts`. */
const AMPLIABLES = [
  'tests/cuenta-rutas.test.ts',
  'tests/deploy-gate-workflow.test.ts',
  'tests/legal-rutas-publicas.test.ts',
];

describe.skipIf(!HAY_VENTANA)('SPEC-047 CA-18: sólo se tocan las tres guardias de CA-19', () => {
  it('el diff sobre tests/ añade ficheros y casos, y sólo modifica las tres guardias', () => {
    // Re-encuadrado por SPEC-048 CA-5 el 2026-08-22, por arbitraje del humano (Alberto
    // Fojo). Qué vigilaba antes: el `--name-status` sobre `tests/` contra `origin/main`,
    // que al mergear la PR #52 devolvió lista vacía y puso este caso en ROJO permanente
    // — es el R-2 del run 32583255349. Qué vigila ahora: el mismo `--name-status` sobre la
    // ventana fija de la entrega. La afirmación es idéntica y sigue siendo cierta: en
    // aquella entrega los únicos ficheros de `tests/` MODIFICADOS —no añadidos— fueron los
    // tres que el arbitraje autorizó.
    const modificados = testsModificadosEnLaVentana(rootDir, ENTREGA_DE_SPEC_047);
    expect(
      modificados,
      'un CUARTO fichero ajeno modificado es RED: se escala al gate, no se toca',
    ).toEqual(AMPLIABLES);
    expect(
      [...modificados, 'tests/ci-workflow.test.ts'].sort(),
      'la comparación no distingue un cuarto fichero: habría dejado de ser una lista cerrada',
    ).not.toEqual(AMPLIABLES);
  });

  it('los dos verdes que CA-18 cita por su nombre siguen sin tocarse', () => {
    // SPEC-035 CA-12 (ni un recurso de terceros en /legal) y CA-13 (ninguna cookie al
    // recorrerla anónimamente) son los que este cambio pone a prueba de verdad, y los dos
    // viven en `tests/e2e/legal.spec.ts`. Que ese fichero no aparezca en el diff es lo que
    // hace creíble que sigan verdes por mérito propio y no porque se les haya bajado el
    // listón.
    //
    // Re-encuadrado por SPEC-048 CA-7 el 2026-08-22, por arbitraje del humano (Alberto
    // Fojo). Qué vigilaba antes: el diff contra `origin/main`, vacío desde el merge — un
    // `not.toContain` sobre una lista vacía es verde siempre. Qué vigila ahora: la ventana
    // fija de la entrega, con la mutación de control que demuestra que sí distingue.
    expect(tocados()).not.toContain('tests/e2e/legal.spec.ts');
    expect([...tocados(), 'tests/e2e/legal.spec.ts']).toContain('tests/e2e/legal.spec.ts');
  });
});
