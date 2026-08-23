import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-051 CA-17 — **las DOS guardias ajenas se amplían nombradas, y ninguna propiedad se
 * debilita**.
 *
 * Excluir la tarjeta del `matcher` de `src/proxy.ts` es lo que la hace alcanzable por un
 * rastreador anónimo (CA-14, CA-15) y, de paso, mueve un literal que dos tests ajenos
 * tienen copiado carácter a carácter. Son **fotos del árbol**, no propiedades, y cada una
 * tiene una **hermana** en su mismo fichero que sí mide la propiedad.
 *
 * **Son dos, no tres.** SPEC-047 tuvo que ampliar tres; aquí la tercera
 * —`tests/deploy-gate-workflow.test.ts`, la lista cerrada de claves de `scripts` de
 * SPEC-028 CA-9.3— **desaparece por construcción**: el humano eligió el 2026-08-23 que el
 * generador de la tarjeta cuelgue del `icon:build` que ya existía (D-8), así que
 * `package.json` no gana ninguna clave y ese fichero no se toca en absoluto. Es la lección
 * que la spec deja escrita como precedente: **la mejor forma de tratar con una guardia
 * ajena es no necesitarla**, y el orden correcto es cambiar el diseño antes que la
 * aserción.
 *
 * El implementador no las tocó por su cuenta: escaló, lo decidió el humano (Alberto Fojo,
 * 2026-08-23) y la autorización quedó escrita **en la spec** —§Notas pto. 2 y CA-17— ANTES
 * de ejecutarse. Ese orden es la condición de proceso de `FOUNDATION.md`: quien toca una
 * guardia no es quien se beneficia de que pase.
 *
 * Este fichero es lo que impide que esa autorización se convierta en barra libre. Y no
 * mira ningún diff: **todo lo que afirma es una propiedad del árbol de hoy** (ADR-031
 * pto. 1.1). La condición 1 de CA-17 en su versión «el diff sólo toca estos dos ficheros»
 * es criterio de acotación y vive en el gate (CA-20, ADR-031 pto. 1.2); lo que sí cabe
 * aquí —y está— es su forma comprobable sin git: *nadie más ha sido re-encuadrado por
 * esta spec*.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = join(rootDir, 'tests');

const fuente = (ruta: string) => readFileSync(join(rootDir, ruta), 'utf8');
const rel = (f: string) => relative(rootDir, f).replace(/\\/g, '/');

/** Las DOS, nombradas una a una — CA-17.1. Ni una más. */
const GUARDIAS = [
  {
    fichero: 'tests/legal-rutas-publicas.test.ts',
    de: 'SPEC-035 CA-2',
    ampliada: 'sigue siendo el de siempre — quien decide es el guard, no el matcher',
    hermana: 'ninguna ruta concreta se cuela como excepción DENTRO del matcher',
  },
  {
    fichero: 'tests/cuenta-rutas.test.ts',
    de: 'SPEC-036 CA-10',
    ampliada: 'sigue siendo el de siempre — quien decide es el guard, no el matcher',
    hermana: 'ni `cuenta` ni `cuenta-borrada` aparecen dentro del literal del matcher',
  },
];

/** La que NO se toca, y el motivo por el que no hace falta (D-8). */
const NO_SE_TOCA = 'tests/deploy-gate-workflow.test.ts';

/** Los ficheros de `tests/` que esta spec ESTRENA. Todo lo demás que la nombre es ajeno. */
const PROPIOS = [
  'tests/e2e/tarjeta.spec.ts',
  'tests/tarjeta-frontera.test.ts',
  'tests/tarjeta-guardias-ampliadas.test.ts',
  'tests/tarjeta-imagen.test.ts',
  'tests/tarjeta-raster.ts',
];

/**
 * Los casos de un fichero de test, por título: un `it(` con dos espacios de sangría y
 * todo lo suyo hasta el `});` que lo cierra a esa misma sangría — el estilo de los dos
 * ficheros de arriba. Mismo mecanismo que `casos()` en
 * `tests/icono-guardias-ampliadas.test.ts`, reescrito aquí en vez de importado porque
 * aquel fichero es de SPEC-047 y esta spec no lo toca ni para exportarle algo.
 */
function casos(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^ {2}it\('((?:[^'\\]|\\.)*)',[\s\S]*?^ {2}\}\);$/gm)) {
    out.set(m[1], m[0]);
  }
  return out;
}

/**
 * El caso sin sus comentarios. Hace falta porque el porqué que CA-17.2 obliga a escribir
 * al lado de la aserción NOMBRA las formas prohibidas de aflojarla, y buscarlas sobre el
 * texto entero encontraría la explicación en vez del código.
 */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function caso(src: string, titulo: string): string {
  const encontrado = casos(src).get(titulo);
  expect(encontrado, `no se encuentra el caso "${titulo}"`).toBeDefined();
  return encontrado!;
}

/** Todos los fuentes bajo `tests/`, incluidos los de e2e y los helpers. */
function fuentesDeTests(dir = testsDir): string[] {
  const out: string[] = [];
  for (const entrada of readdirSync(dir).sort()) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) out.push(...fuentesDeTests(ruta));
    else if (entrada.endsWith('.ts')) out.push(ruta);
  }
  return out;
}

describe('SPEC-051 CA-17.1: son DOS guardias ajenas, y la tercera no ha hecho falta', () => {
  it('los únicos ficheros ajenos de tests/ que esta spec nombra son esos dos', () => {
    // La versión comprobable sin git de «están nombradas, una a una, y son dos». Si
    // alguien re-encuadrara un tercer fichero ajeno tendría que escribir su porqué al
    // lado —lo exige CA-17.2 y `FOUNDATION.md`—, y ese porqué nombra la spec. Así que la
    // lista de ficheros de `tests/` que dicen «SPEC-051» es exactamente: los dos
    // autorizados más los que esta entrega estrena. Un tercero ajeno aquí es RED.
    const nombran = fuentesDeTests()
      .filter((f) => readFileSync(f, 'utf8').includes('SPEC-051'))
      .map(rel)
      .sort();
    const esperados = [...GUARDIAS.map((g) => g.fichero), ...PROPIOS].sort();
    expect(
      nombran,
      'un TERCER fichero ajeno re-encuadrado es RED: se escala al gate, no se toca',
    ).toEqual(esperados);
    expect(
      [...nombran, 'tests/ci-workflow.test.ts'].sort(),
      'la comparación no distingue un tercero: habría dejado de ser una lista cerrada',
    ).not.toEqual(esperados);
  });

  it(`${NO_SE_TOCA} ni siquiera sabe que esta spec existe`, () => {
    // D-8, y es el punto entero de la elección del humano: la tercera guardia de SPEC-047
    // no se ha ampliado, se ha vuelto innecesaria. Si esta spec hubiera estrenado un
    // `npm run`, tendría que aparecer aquí — y su ausencia es la prueba de que no lo hizo.
    expect(fuente(NO_SE_TOCA)).not.toContain('SPEC-051');
  });
});

describe('SPEC-051 CA-17.2: cada ampliación lleva su porqué al lado de la aserción', () => {
  for (const { fichero, ampliada } of GUARDIAS) {
    it(`${fichero}: dice qué vigilaba, qué vigila y en virtud de qué CA entra`, () => {
      const cuerpo = caso(fuente(fichero), ampliada);

      expect(cuerpo, 'falta la spec que amplía').toContain('SPEC-051');
      expect(cuerpo, 'falta el CA que autoriza la ampliación').toContain('CA-17');
      expect(cuerpo, 'falta la fecha del arbitraje').toContain('2026-08-23');
      expect(cuerpo, 'falta decir que lo arbitró el humano').toMatch(/arbitraje del humano/i);
      expect(cuerpo, 'falta qué vigilaba antes').toMatch(/Qué vigilaba antes/);
      expect(cuerpo, 'falta qué vigila ahora').toMatch(/Qué vigila ahora/);
      expect(cuerpo, 'falta en virtud de qué CA entra el elemento nuevo').toMatch(
        /CA-14 y CA-15/,
      );
      // Y lo que SPEC-047 escribió sigue ahí: una ampliación no borra la anterior, porque
      // entonces la auditoría de la primera desaparecería con la segunda.
      expect(cuerpo, 'se ha borrado el porqué que dejó SPEC-047').toContain('2026-08-22');
    });
  }
});

describe('SPEC-051 CA-17.3: es una ampliación, no una aflojada', () => {
  for (const { fichero } of GUARDIAS) {
    it(`${fichero}: ningún caso queda apagado`, () => {
      expect(fuente(fichero)).not.toMatch(/\b(it|describe|test)\.(skip|only|todo)\b/);
      expect(fuente(fichero)).not.toMatch(/\bxit\(|\bxdescribe\(/);
    });
  }

  for (const { fichero, ampliada } of GUARDIAS) {
    it(`${fichero}: la guardia sigue cerrada ante una exclusión inventada`, () => {
      const cuerpo = sinComentarios(caso(fuente(fichero), ampliada));
      // Sigue siendo una CADENA literal comparada con `toContain`: ni expresión regular,
      // ni `stringMatching`, ni `stringContaining` — que es como se afloja esto sin que
      // se note.
      expect(cuerpo, 'la comparación ha dejado de ser sobre una cadena literal').not.toMatch(
        /stringMatching|stringContaining|new RegExp|toMatch\(/,
      );
      const m = /toContain\(\s*\n?\s*"([^"]+)"/.exec(cuerpo);
      expect(m, 'no se encuentra el literal del matcher en la aserción').not.toBeNull();
      const literal = m![1];
      expect(
        literal,
        'la guardia ya no describe la exclusión que esta spec añade',
      ).toContain('opengraph-image.png');

      const proxy = fuente('src/proxy.ts');
      // Con el árbol real, la guardia pasa…
      expect(proxy, 'la guardia no describe el matcher que hay').toContain(literal);
      // …y con una SÉPTIMA exclusión inventada, la MISMA comparación la rechaza. Esto no
      // es leer el diff: es volver a ejecutar la guardia contra una entrada mutada.
      const mutado = proxy.replace(/(matcher: \['\/\(\(\?!)([^)]*)/, '$1$2|inventado.svg');
      expect(mutado, 'la mutación no se aplicó: la comprobación no probaría nada').not.toBe(proxy);
      expect(
        mutado.includes(literal),
        'la guardia acepta un matcher con una exclusión de más: ha dejado de estar cerrada',
      ).toBe(false);
    });
  }
});

describe('SPEC-051 CA-17.4: ninguna propiedad protegida se debilita', () => {
  for (const { fichero, hermana } of GUARDIAS) {
    it(`${fichero}: la hermana que mide la propiedad sigue ahí y sigue mirando`, () => {
      // La propiedad es «el matcher no conoce **rutas de producto**», y la tarjeta es un
      // ACTIVO —de la familia de `_next/static`, `_next/image`, `favicon.ico` e
      // `icon.svg`, que ya están en esa línea y por la misma razón—. Así que la hermana
      // tiene que seguir siendo cierta sin tocarla, y aquí se comprueba que sigue
      // existiendo y que su lista de rutas prohibidas no se ha recortado.
      const cuerpo = caso(fuente(fichero), hermana);
      expect(cuerpo).toMatch(/matcher/);
      expect(cuerpo).toMatch(/not\.toContain/);
    });
  }

  it('el matcher sigue sin conocer una sola ruta de producto', () => {
    const literal = /matcher:\s*\[([\s\S]*?)\]/.exec(fuente('src/proxy.ts'))![1];
    for (const pagina of [
      'legal',
      'login',
      'register',
      'forgot-password',
      'reset-password',
      'cuenta',
      'ayuda',
      'vigiladas',
      'cartera',
      'dashboard',
      'avisos',
      'admin',
    ]) {
      expect(literal, `"${pagina}" no se decide en el matcher, se decide en el guard`).not.toContain(
        pagina,
      );
    }
  });

  it('`PUBLIC_PREFIXES` no crece: la excepción documentada a RN-03 sigue siendo de páginas', () => {
    // CA-16. La lista de páginas públicas es la excepción DOCUMENTADA a RN-03 y engordarla
    // con estáticos la desdibuja. La tarjeta no entra aquí, entra en el matcher.
    const guard = fuente('src/lib/auth/guard.ts');
    const bloque = /export const PUBLIC_PREFIXES = \[([\s\S]*?)\];/.exec(guard);
    expect(bloque, 'no se encuentra PUBLIC_PREFIXES').not.toBeNull();
    const rutas = [...bloque![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(rutas).toEqual(
      [
        '/ayuda',
        '/cuenta-borrada',
        '/forgot-password',
        '/legal',
        '/login',
        '/register',
        '/reset-password',
      ].sort(),
    );
    expect(bloque![1], 'la tarjeta NO es una página pública: es un activo').not.toContain(
      'opengraph',
    );
  });
});
