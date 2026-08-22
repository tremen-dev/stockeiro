import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'origin/main';

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * Los ficheros que esta rama toca respecto de `origin/main`, **committeados**.
 *
 * Enmienda de CA-16 tras F-SPEC-047-1: antes esto unía el diff con `git status`, es decir
 * miraba el árbol de trabajo. No servía, y no por un descuido de esta spec: **varias
 * suites e2e antiguas escriben dentro de `_qa/` al correr**, así que pasar la batería
 * entera ensucia `_qa/SPEC-001/…` y compañía sin que nadie haya cambiado nada. Ese ruido
 * es preexistente y la regla es descartarlo, no cometerlo — por eso lo que se juzga es lo
 * comiteado, que es lo que se mergearía.
 *
 * Y se compara contra la BASE DE FUSIÓN (`origin/main...HEAD`), no árbol contra árbol: lo
 * que CA-16 acota es lo que ESTA rama toca. Con dos puntos, cualquier fichero que `main`
 * moviera por su cuenta aparecería aquí como si lo hubiera tocado esta spec.
 */
function tocados(): string[] {
  return git('diff', '--name-only', `${BASE}...HEAD`)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
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

describe('SPEC-047 CA-16: el diff está acotado — esto es presentación pura', () => {
  it('no se toca ni un fichero fuera del conjunto pactado', () => {
    const fuera = tocados().filter((f) => !PERMITIDO.some((p) => p.test(f)));
    expect(fuera, `ficheros fuera del alcance de SPEC-047:\n${fuera.join('\n')}`).toEqual([]);
  });

  it('ni un dato, ni un cálculo, ni una regla: nada bajo src/db, drizzle o src/lib', () => {
    const prohibidos = tocados().filter((f) => /^(src\/db\/|drizzle\/|src\/lib\/)/.test(f));
    expect(prohibidos).toEqual([]);
  });

  it('la evidencia de otras specs es suya: ninguna otra _qa/SPEC-NNN/ en el diff', () => {
    const ajenas = [
      ...new Set(
        tocados()
          .filter((f) => f.startsWith('_qa/') && !f.startsWith('_qa/SPEC-047/'))
          .map((f) => f.split('/').slice(0, 2).join('/')),
      ),
    ];
    expect(
      ajenas,
      'la e2e reescribe capturas de specs viejas al correr: se descartan ' +
        '(`git checkout -- _qa`), no se cometen',
    ).toEqual([]);
  });

  it('el guardián de sesión cambia en una sola línea de código: la del matcher', () => {
    const diff = git('diff', '-U0', `${BASE}...HEAD`, '--', 'src/proxy.ts');
    const lineas = (signo: '+' | '-') =>
      diff
        .split('\n')
        .filter((l) => l.startsWith(signo) && !l.startsWith(`${signo}${signo}${signo}`))
        .map((l) => l.slice(1))
        .filter((l) => l.trim().length > 0);
    // El porqué del cambio se deja escrito en el fichero, con el estilo en prosa que
    // el propio `proxy.ts` usa para documentar sus decisiones. Los comentarios no son
    // comportamiento: lo que CA-16 acota es el CÓDIGO que cambia, y es una línea.
    const codigo = (ls: string[]) => ls.filter((l) => !/^\s*(\/\/|\/?\*)/.test(l));

    expect(codigo(lineas('-')), 'se ha quitado más de una línea de código').toHaveLength(1);
    expect(codigo(lineas('+')), 'se ha añadido más de una línea de código').toHaveLength(1);
    expect(codigo(lineas('-'))[0]).toContain('matcher');
    expect(codigo(lineas('+'))[0]).toContain('matcher');
  });
});

describe('SPEC-047 CA-4 (mitad estática): los <link> no se escriben a mano', () => {
  it('layout.tsx no declara ningún <link rel="icon"> ni campo icons en metadata', () => {
    const layout = readFileSync(join(rootDir, 'src', 'app', 'layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/rel=["']icon/);
    expect(layout).not.toMatch(/\bicons\s*:/);
  });

  it('no nace ningún fichero bajo public/', () => {
    expect(tocados().filter((f) => f.startsWith('public/'))).toEqual([]);
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

  it('no entra ninguna dependencia nueva en package.json', () => {
    const actual = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
    const base = JSON.parse(git('show', `${BASE}:package.json`));
    expect(actual.dependencies).toEqual(base.dependencies);
    expect(actual.devDependencies).toEqual(base.devDependencies);
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

/** Las tres guardias que el arbitraje del humano del 2026-08-22 autoriza a ampliar. Ni una
 *  más: la lista, su porqué y sus cuatro condiciones las ejecuta CA-19 en
 *  `tests/icono-guardias-ampliadas.test.ts`. */
const AMPLIABLES = [
  'tests/cuenta-rutas.test.ts',
  'tests/deploy-gate-workflow.test.ts',
  'tests/legal-rutas-publicas.test.ts',
];

describe('SPEC-047 CA-18: lo ajeno no se toca salvo lo que CA-19 nombra', () => {
  it('el diff sobre tests/ añade ficheros y casos, y sólo modifica las tres guardias', () => {
    const estado = git('diff', '--name-status', `${BASE}...HEAD`, '--', 'tests/')
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('\t'));
    const modificados = estado
      .filter(([tipo]) => tipo !== 'A')
      .map(([, f]) => f)
      .sort();
    expect(
      modificados,
      'un CUARTO fichero ajeno modificado es RED: se escala al gate, no se toca',
    ).toEqual(AMPLIABLES);
  });

  it('los dos verdes que CA-18 cita por su nombre siguen sin tocarse', () => {
    // SPEC-035 CA-12 (ni un recurso de terceros en /legal) y CA-13 (ninguna cookie al
    // recorrerla anónimamente) son los que este cambio pone a prueba de verdad, y los dos
    // viven en `tests/e2e/legal.spec.ts`. Que ese fichero no aparezca en el diff es lo que
    // hace creíble que sigan verdes por mérito propio y no porque se les haya bajado el
    // listón.
    expect(tocados()).not.toContain('tests/e2e/legal.spec.ts');
  });
});
