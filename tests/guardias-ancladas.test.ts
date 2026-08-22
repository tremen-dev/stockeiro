import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, hayVentana, type Ventana } from './ventana-fija';
import { infraccionesEnFuente } from './revision-movil';

/**
 * SPEC-048 CA-1, CA-3, CA-6 y CA-8 — **las cuatro condiciones de ADR-031 pto. 2, sobre
 * las dos guardias que las incumplían**.
 *
 * `tests/icono-frontera.test.ts` y `tests/icono-guardias-ampliadas.test.ts` son las dos
 * guardias que pusieron `main` en rojo el 2026-08-22 al mergear la PR #52. Este fichero
 * comprueba que su arreglo cumple lo que ADR-031 exige a cualquier guardia por diff que
 * se quede en la suite: ventana de dos sha fijos (2.1), centinela de no-vacuidad (2.2),
 * salto declarado y prohibido en CI (2.3) y el porqué escrito al lado (2.4).
 *
 * No mira ningún diff: mira el **texto** de los dos ficheros. Por eso no necesita ventana
 * propia, no se salta nunca y sigue diciendo la verdad en un clon superficial.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Los dos ficheros anclados por esta spec, y el sha que los dos tienen que declarar. */
const ANCLADOS = ['tests/icono-frontera.test.ts', 'tests/icono-guardias-ampliadas.test.ts'];
const ENTREGA_DE_SPEC_047: Ventana = { antes: '6da9fbe', despues: '104f94e' };

const fuente = (ruta: string) => readFileSync(join(rootDir, ruta), 'utf8');

const HAY_VENTANA = hayVentana(rootDir, ENTREGA_DE_SPEC_047);

/** La ventana que un fichero declara, leída de su fuente. */
function ventanaDeclarada(ruta: string): Ventana {
  const m = /const\s+ENTREGA_DE_SPEC_047[^=]*=\s*\{\s*antes:\s*'([^']+)',\s*despues:\s*'([^']+)'/.exec(
    fuente(ruta),
  );
  expect(m, `${ruta} no declara la ventana en una constante con nombre (CA-1)`).not.toBeNull();
  return { antes: m![1], despues: m![2] };
}

/**
 * Los casos de un fichero, por su título **tal y como está escrito** — con comillas
 * simples o con acento grave, porque los tres casos que se repiten por fichero llevan el
 * nombre interpolado. Mismo mecanismo que `casos()` en
 * `tests/icono-guardias-ampliadas.test.ts`, pero sin atarse a una sangría concreta: los
 * bloques anclados van dentro de un `describe.skipIf` y algunos casos caen a cuatro
 * espacios.
 */
function casos(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const patron =
    /^([ \t]+)it\((?:'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`),[\s\S]*?^\1\}\);$/gm;
  for (const m of src.matchAll(patron)) out.set(m[2] ?? m[3], m[0]);
  return out;
}

/**
 * El caso con las continuaciones de comentario planchadas. Lo que CA-8 exige es que el
 * porqué esté **escrito dentro del caso**; dónde caiga cada salto al ajustar el margen a
 * cien columnas no es contrato. Mismo criterio que `ingenieriaLlana()` en
 * `tests/reglas-ingenieria.test.ts`.
 */
const llano = (src: string) => src.replace(/\s*\n\s*\/\/ ?/g, ' ');

/**
 * CA-8 — cada aserción que SPEC-048 re-encuadró, con el CA que la autoriza. Son las
 * quince que el inventario de §Entidades nombra: los tres rojos (CA-4, CA-5, CA-6) y los
 * doce verdes vacíos (CA-7). Tres de las entradas se repiten en tiempo de ejecución, una
 * por guardia ajena, pero en la fuente son un solo caso con el título interpolado.
 */
const RE_ENCUADRADAS: ReadonlyArray<[string, string, string]> = [
  ['tests/icono-frontera.test.ts', 'no se toca ni un fichero fuera del conjunto pactado', 'CA-7'],
  [
    'tests/icono-frontera.test.ts',
    'ni un dato, ni un cálculo, ni una regla: nada bajo src/db, drizzle o src/lib',
    'CA-7',
  ],
  [
    'tests/icono-frontera.test.ts',
    'la evidencia de otras specs es suya: ninguna otra _qa/SPEC-NNN/ en el diff',
    'CA-7',
  ],
  [
    'tests/icono-frontera.test.ts',
    'el guardián de sesión cambia en una sola línea de código: la del matcher',
    'CA-4',
  ],
  ['tests/icono-frontera.test.ts', 'no nace ningún fichero bajo public/', 'CA-7'],
  ['tests/icono-frontera.test.ts', 'no entra ninguna dependencia nueva en package.json', 'CA-7'],
  [
    'tests/icono-frontera.test.ts',
    'el diff sobre tests/ añade ficheros y casos, y sólo modifica las tres guardias',
    'CA-5',
  ],
  [
    'tests/icono-frontera.test.ts',
    'los dos verdes que CA-18 cita por su nombre siguen sin tocarse',
    'CA-7',
  ],
  [
    'tests/icono-guardias-ampliadas.test.ts',
    'el diff sobre tests/ no modifica ningún fichero ajeno fuera de esas tres',
    'CA-6',
  ],
  [
    'tests/icono-guardias-ampliadas.test.ts',
    '${fichero}: el único caso que cambia es el ampliado',
    'CA-7',
  ],
  [
    'tests/icono-guardias-ampliadas.test.ts',
    '${fichero}: la hermana que mide la propiedad sigue byte a byte como estaba',
    'CA-7',
  ],
];

describe('SPEC-048 CA-1: las dos guardias miran una ventana fija, no una diana móvil', () => {
  for (const ruta of ANCLADOS) {
    it(`${ruta}: ninguna revisión móvil alimenta una aserción`, () => {
      const infracciones = infraccionesEnFuente(fuente(ruta));
      expect(
        infracciones.map((i) => `${i.revision} en ${i.invocacion}`),
        'ADR-031 pto. 2.1: las revisiones son sha literales, no `origin/main`, `main`, ' +
          '`HEAD` ni `@`',
      ).toEqual([]);
    });

    it(`${ruta}: declara la ventana en una constante con nombre`, () => {
      expect(ventanaDeclarada(ruta)).toEqual(ENTREGA_DE_SPEC_047);
    });
  }

  it('los dos extremos son sha literales, no nombres', () => {
    expect(ENTREGA_DE_SPEC_047.antes).toMatch(/^[0-9a-f]{7,40}$/);
    expect(ENTREGA_DE_SPEC_047.despues).toMatch(/^[0-9a-f]{7,40}$/);
  });
});

describe.skipIf(!HAY_VENTANA)('SPEC-048 CA-1: y la ventana es la entrega, no un rango cómodo', () => {
  it('`antes` es el primer padre de `despues`, que es el merge de la PR #52', () => {
    // Centinela del propio anclaje. Sin esto, la ventana podría reescribirse con un rango
    // que dejara los bloques en verde por comodidad, que es la versión deliberada del
    // mismo fallo que SPEC-048 arregla. `rev-parse` no compara nada: sólo resuelve un
    // nombre a un sha, y por eso RI-03 no lo alcanza (CA-10.2).
    const resolver = (rev: string) => git(rootDir, 'rev-parse', '--verify', `${rev}^{commit}`).trim();
    expect(resolver(`${ENTREGA_DE_SPEC_047.despues}^1`)).toBe(resolver(ENTREGA_DE_SPEC_047.antes));
  });
});

describe('SPEC-048 CA-6: los dos ficheros leen exactamente la misma ventana', () => {
  it('los sha declarados en ambos coinciden', () => {
    const [uno, otro] = ANCLADOS.map(ventanaDeclarada);
    expect(
      otro,
      'las dos guardias son de la misma entrega: si sus ventanas se separan, una de las ' +
        'dos deja de decir lo que dice',
    ).toEqual(uno);
  });
});

describe('SPEC-048 CA-3: el salto es por disponibilidad, y no puede ocurrir en CI', () => {
  for (const ruta of ANCLADOS) {
    it(`${ruta}: los bloques anclados se saltan si el sha no está en el clon`, () => {
      expect(
        fuente(ruta),
        'ADR-031 pto. 2.3: un clon superficial no puede convertir la guardia en rojo falso',
      ).toContain('describe.skipIf(');
    });
  }

  it('con CI definida, la ventana está disponible: ningún bloque anclado se salta', () => {
    // El job `Checks` de `.github/workflows/ci.yml` lleva `fetch-depth: 0` (SPEC-038
    // CA-13, vigilado por `tests/version-bump-gate.test.ts`), así que en el runner los sha
    // históricos son alcanzables. Este caso está SIEMPRE activo a propósito: un `skipIf`
    // sin esta contrapartida sería exactamente el mismo defecto por otra puerta — un verde
    // en CI que viene de no haber mirado nada.
    const enCI = process.env.CI !== undefined;
    expect(
      hayVentana(rootDir, ENTREGA_DE_SPEC_047) || !enCI,
      'la ventana de SPEC-047 no es alcanzable en CI: o se ha perdido `fetch-depth: 0` en ' +
        'el job `Checks`, o el histórico se ha reescrito. Un verde saltado no vale.',
    ).toBe(true);
  });
});

describe('SPEC-048 CA-8: cada re-encuadre lleva su porqué dentro del caso', () => {
  for (const [ruta, titulo, ca] of RE_ENCUADRADAS) {
    it(`${ruta} / "${titulo}"`, () => {
      const encontrado = casos(fuente(ruta)).get(titulo);
      expect(encontrado, `no se encuentra el caso "${titulo}" en ${ruta}`).toBeDefined();
      const cuerpo = llano(encontrado!);

      expect(cuerpo, 'falta la spec que re-encuadra').toContain('SPEC-048');
      expect(cuerpo, 'falta el CA de SPEC-048 que autoriza el re-encuadre').toContain(ca);
      expect(cuerpo, 'falta la fecha del arbitraje').toContain('2026-08-22');
      expect(cuerpo, 'falta decir que lo arbitró el humano').toMatch(/arbitraje del humano/i);
      expect(cuerpo, 'falta qué vigilaba antes').toMatch(/Qué vigilaba antes/);
      expect(cuerpo, 'falta qué vigila ahora').toMatch(/Qué vigila ahora/);
    });
  }

  it('y el barrido de casos mira de verdad: encuentra los quince', () => {
    // Centinela: si el extractor de casos dejara de casar —una sangría distinta, un
    // título interpolado— los quince casos de arriba pasarían por `toBeDefined` fallando,
    // pero conviene decirlo también aquí, en positivo y de una vez.
    for (const [ruta, titulo] of RE_ENCUADRADAS) {
      expect([...casos(fuente(ruta)).keys()], `${ruta} no expone "${titulo}"`).toContain(titulo);
    }
  });
});
