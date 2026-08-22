import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-047 CA-19 — **las tres guardias ajenas se amplían nombradas, y ninguna propiedad
 * se debilita**.
 *
 * Excluir `icon.svg` del `matcher` desbloquea el icono (CA-6, CA-7) y, de paso, mueve un
 * literal que dos tests ajenos tenían copiado carácter a carácter; y el generador que
 * pide CA-17 añade una clave a una lista de `scripts` que un tercero congelaba. Las tres
 * son **fotos del árbol**, no propiedades, y cada una tiene una **hermana** en su mismo
 * fichero que sí mide la propiedad.
 *
 * El implementador no las tocó: escaló, lo decidió el humano (Alberto Fojo, 2026-08-22)
 * y la autorización quedó escrita **en la spec** —§El arbitraje de las tres guardias
 * ajenas, y este CA-19— ANTES de ejecutarse. Ese orden es la condición de proceso de
 * `FOUNDATION.md`: quien toca una guardia no es quien se beneficia de que pase.
 *
 * Este test es lo que impide que esa autorización se convierta en barra libre. Comprueba
 * las cuatro condiciones de CA-19, y la tercera —«ampliación, no aflojada»— no la da por
 * buena leyendo el diff: **vuelve a ejecutar la comparación de cada guardia contra una
 * entrada con un cuarto elemento inventado y exige que la rechace**.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'origin/main';

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const fuente = (ruta: string) => readFileSync(join(rootDir, ruta), 'utf8');
const fuenteEnMain = (ruta: string) => git('show', BASE + ':' + ruta);

/** Las tres, nombradas una a una — CA-19.1. Ni una más. */
const GUARDIAS = [
  {
    fichero: 'tests/legal-rutas-publicas.test.ts',
    clase: 'matcher' as const,
    ampliada: 'sigue siendo el de siempre — quien decide es el guard, no el matcher',
    hermana: 'ninguna ruta concreta se cuela como excepción DENTRO del matcher',
    porque: /CA-6 y CA-7/,
  },
  {
    fichero: 'tests/cuenta-rutas.test.ts',
    clase: 'matcher' as const,
    ampliada: 'sigue siendo el de siempre — quien decide es el guard, no el matcher',
    hermana: 'ni `cuenta` ni `cuenta-borrada` aparecen dentro del literal del matcher',
    porque: /CA-6 y CA-7/,
  },
  {
    fichero: 'tests/deploy-gate-workflow.test.ts',
    clase: 'scripts' as const,
    ampliada: '9.3 — package.json no gana ningún script sin un CA que lo pida',
    hermana: '9.3 — drizzle/ no gana ningún .sql en ESTA entrega',
    porque: /CA-17/,
  },
];

/**
 * Los casos de un fichero de test, por título: un `it(` con dos espacios de sangría y
 * todo lo suyo hasta el `});` que lo cierra a esa misma sangría — que es el estilo de los
 * tres ficheros. Sirve para comparar caso a caso contra `origin/main` sin que un salto de
 * línea en otro sitio del fichero cuente como «tocado».
 */
function casos(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^ {2}it\('((?:[^'\\]|\\.)*)',[\s\S]*?^ {2}\}\);$/gm)) {
    out.set(m[1], m[0]);
  }
  return out;
}

/**
 * El caso sin sus comentarios. Hace falta porque el porqué que CA-19.2 obliga a escribir
 * al lado de la aserción NOMBRA las formas prohibidas («ni `arrayContaining` ni
 * `toContain`»), y buscarlas sobre el texto entero encontraría la explicación en vez del
 * código. Lo que se audita es lo que se ejecuta.
 */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function caso(src: string, titulo: string): string {
  const encontrado = casos(src).get(titulo);
  expect(encontrado, `no se encuentra el caso "${titulo}"`).toBeDefined();
  return encontrado!;
}

describe('SPEC-047 CA-19.1: sólo se amplían las tres guardias nombradas', () => {
  it('el diff sobre tests/ no modifica ningún fichero ajeno fuera de esas tres', () => {
    const modificados = git('diff', '--name-status', `${BASE}...HEAD`, '--', 'tests/')
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('\t'))
      .filter(([tipo]) => tipo !== 'A')
      .map(([, f]) => f)
      .sort();

    expect(
      modificados,
      'un CUARTO fichero ajeno modificado es RED (CA-18): se escala al gate, no se toca',
    ).toEqual(GUARDIAS.map((g) => g.fichero).sort());
  });

  for (const { fichero, ampliada } of GUARDIAS) {
    it(`${fichero}: el único caso que cambia es el ampliado`, () => {
      const ahora = casos(fuente(fichero));
      const antes = casos(fuenteEnMain(fichero));

      expect([...ahora.keys()].sort(), 'no nace ni muere ningún caso').toEqual(
        [...antes.keys()].sort(),
      );
      for (const [titulo, cuerpo] of antes) {
        if (titulo === ampliada) continue;
        expect(ahora.get(titulo), `"${titulo}" no es de esta spec y no se toca`).toBe(cuerpo);
      }
    });
  }
});

describe('SPEC-047 CA-19.2: cada ampliación lleva su porqué al lado de la aserción', () => {
  for (const { fichero, ampliada, porque } of GUARDIAS) {
    it(`${fichero}: dice qué vigilaba, qué vigila y en virtud de qué CA entra`, () => {
      const cuerpo = caso(fuente(fichero), ampliada);

      expect(cuerpo, 'falta la spec que amplía').toContain('SPEC-047');
      expect(cuerpo, 'falta el CA que autoriza la ampliación').toContain('CA-19');
      expect(cuerpo, 'falta la fecha del arbitraje').toContain('2026-08-22');
      expect(cuerpo, 'falta decir que lo arbitró el humano').toMatch(/arbitraje del humano/i);
      expect(cuerpo, 'falta qué vigilaba antes').toMatch(/Qué vigilaba antes/);
      expect(cuerpo, 'falta qué vigila ahora').toMatch(/Qué vigila ahora/);
      expect(cuerpo, 'falta en virtud de qué CA entra el elemento nuevo').toMatch(porque);
    });
  }
});

describe('SPEC-047 CA-19.3: es una ampliación, no una aflojada', () => {
  for (const { fichero } of GUARDIAS) {
    it(`${fichero}: ningún caso queda apagado`, () => {
      expect(fuente(fichero)).not.toMatch(/\b(it|describe|test)\.(skip|only|todo)\b/);
      expect(fuente(fichero)).not.toMatch(/\bxit\(|\bxdescribe\(/);
    });
  }

  for (const { fichero, ampliada } of GUARDIAS.filter((g) => g.clase === 'matcher')) {
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
      const proxy = fuente('src/proxy.ts');

      // Con el árbol real, la guardia pasa…
      expect(proxy, 'la guardia no describe el matcher que hay').toContain(literal);
      // …y con una exclusión inventada de más, la MISMA comparación la rechaza. Esto no
      // es leer el diff: es volver a ejecutar la guardia contra una entrada mutada.
      const mutado = proxy.replace(/(matcher: \['\/\(\(\?!)([^)]*)/, '$1$2|inventado.svg');
      expect(mutado, 'la mutación no se aplicó: la comprobación no probaría nada').not.toBe(proxy);
      expect(
        mutado.includes(literal),
        'la guardia acepta un matcher con una exclusión de más: ha dejado de estar cerrada',
      ).toBe(false);
    });
  }

  it('deploy-gate: la lista de scripts sigue siendo exacta y cerrada', () => {
    const { fichero, ampliada } = GUARDIAS[2];
    const cuerpo = sinComentarios(caso(fuente(fichero), ampliada));

    // Comparación EXACTA: `toEqual` contra un array literal. Un `arrayContaining` o un
    // `toContain` convertirían la lista cerrada en un mínimo, que es la aflojada clásica.
    expect(cuerpo, 'la comparación ha dejado de ser exacta').toMatch(/\.toEqual\(\s*\n?\s*\[/);
    expect(cuerpo).not.toMatch(/arrayContaining|objectContaining|toContain\(/);

    const esperados = [...cuerpo.matchAll(/^ {8}'([^']+)',$/gm)].map((x) => x[1]).sort();
    expect(esperados.length, 'no se ha podido leer la lista literal de la guardia').toBe(13);
    expect(esperados, 'la clave que autoriza CA-17 tiene que estar').toContain('icon:build');

    const { scripts } = JSON.parse(fuente('package.json')) as { scripts: Record<string, string> };
    const reales = Object.keys(scripts).sort();

    // Con el árbol real coincide…
    expect(reales).toEqual(esperados);
    // …y con una clave inventada de más, deja de coincidir. La lista sigue cerrada.
    expect([...reales, 'inventado:x'].sort()).not.toEqual(esperados);
  });
});

describe('SPEC-047 CA-19.4: ninguna propiedad protegida se debilita', () => {
  for (const { fichero, hermana } of GUARDIAS) {
    it(`${fichero}: la hermana que mide la propiedad sigue byte a byte como estaba`, () => {
      expect(caso(fuente(fichero), hermana)).toBe(caso(fuenteEnMain(fichero), hermana));
    });
  }

  it('la propiedad de las dos primeras sigue siendo cierta: el matcher no conoce páginas', () => {
    // Lo que `icon.svg` añade es un ACTIVO, de la misma familia que `_next/static`,
    // `_next/image` y `favicon.ico`. Las rutas de producto se siguen decidiendo en el
    // guard y `PUBLIC_PREFIXES` no se ha tocado (CA-8): eso lo miden las hermanas, y esto
    // lo deja dicho también desde el lado de SPEC-047.
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
    ]) {
      expect(literal, `"${pagina}" no se decide en el matcher, se decide en el guard`).not.toContain(
        pagina,
      );
    }
  });
});
