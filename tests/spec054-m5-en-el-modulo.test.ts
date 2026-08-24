import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * SPEC-054 CA-13 (mitad unitaria) — **M5 vive en el módulo compartido, con el suelo en
 * 44 × 44, y ninguna guardia se escribe la suya**.
 *
 * ## Por qué esta mitad es unitaria
 *
 * Por lo mismo que SPEC-040 CA-6 (`tests/geometria-guardias.test.ts`) y SPEC-046 CA-9
 * (`tests/spec046-m4-en-el-modulo.test.ts`): la pregunta es binaria y cabe en una
 * revisión. No dice si una pantalla está bien —eso lo mide el navegador—, dice si **la
 * próxima guardia nace ciega**. Y eso hay que saberlo sin arrancar Postgres.
 *
 * ADR-026 §2 manda que una spec que necesite un invariante que no existe **lo aporte al
 * módulo**. SPEC-046 lo ejerció con M4; SPEC-054 lo ejerce por segunda vez con M5, la
 * primera medida del proyecto que pregunta *«¿se puede pulsar?»* en vez de *«¿cabe?»*
 * (ADR-034 §6). La spec 2 de EPIC-007 —la navegación— la hereda sin copiar nada, y ése
 * es exactamente el punto.
 *
 * ## Y por qué se vigila el NÚMERO
 *
 * `44` no es una preferencia: es **WCAG 2.2 SC 2.5.5 *Target Size (Enhanced)*, nivel
 * AAA**, y coincide con los 44 pt de las *Apple HIG*. El mínimo de nivel AA es SC 2.5.8,
 * **24 × 24**. Bajar el suelo hasta que la suite pase sería `F-ADR-026-1` cumpliéndose
 * por escrito —y con la fuente citada mal, además—, así que el número se afirma aquí,
 * donde se ve de un vistazo en la revisión que lo cambie.
 */

const DIR = 'tests/e2e';
const MODULO = `${DIR}/geometria.ts`;

const fuenteDelModulo = () => readFileSync(MODULO, 'utf8');

/**
 * Todo el árbol de e2e MENOS el módulo: guardias y ficheros de apoyo. Es donde con más
 * comodidad reaparecería una copia de la medida — «total, es un helper».
 */
const consumidoresDelModulo = () =>
  readdirSync(DIR)
    .filter((n) => n.endsWith('.ts') && `${DIR}/${n}` !== MODULO)
    .map((n) => `${DIR}/${n}`);

/** Las líneas de código de un fichero, sin comentarios: contar la lección no es cometerla. */
const codigoDe = (fichero: string): string[] =>
  readFileSync(fichero, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));

describe('SPEC-054 CA-13: M5 vive en el módulo, junto a M1, M2, M3 y M4', () => {
  it('el módulo exporta la medida, su suelo, su selector y su descripción', () => {
    const fuente = fuenteDelModulo();
    for (const exportado of [
      'export async function medirAreaTactil', // M5
      'export const describirAreaTactil',
      'export interface MedidaM5',
      'export const SUELO_TACTIL_PX',
      'export const SELECTOR_INTERACTIVO',
    ]) {
      expect(fuente, `${MODULO} no expone \`${exportado}\` (M5, ADR-034 §6)`).toContain(exportado);
    }
  });

  it('el suelo es 44 px, y es el AAA de WCAG citado como tal (ADR-034 §6)', () => {
    const fuente = fuenteDelModulo();
    const declarado = fuente.match(/export const SUELO_TACTIL_PX\s*=\s*(\d+)/)?.[1];
    expect(
      Number(declarado),
      'el suelo de área táctil de M5 dejó de ser 44 px. Bajarlo hasta que la suite pase ' +
        'es `F-ADR-026-1` cumpliéndose por escrito: la salida legítima ante un control ' +
        'pequeño es AGRANDARLO (ADR-026 §4), nunca mover el listón',
    ).toBe(44);
    expect(
      fuente,
      'el módulo no cita la fuente del 44 con precisión. 44 × 44 es WCAG 2.2 SC 2.5.5 ' +
        '(nivel AAA); el mínimo AA es SC 2.5.8, 24 × 24. Vender un AAA como si fuera el ' +
        'mínimo legal es lo que este proyecto no hace (ADR-034 §6)',
    ).toMatch(/2\.5\.5/);
    expect(fuente, 'el módulo no dice cuál es el mínimo de nivel AA (SC 2.5.8)').toMatch(/2\.5\.8/);
  });

  it('M5 mira los siete tipos de control interactivo que nombra ADR-034 §6', () => {
    const fuente = fuenteDelModulo();
    const selector = fuente.match(/export const SELECTOR_INTERACTIVO\s*=\s*'([^']+)'/)?.[1] ?? '';
    expect(selector, 'no se encontró `SELECTOR_INTERACTIVO` en el módulo').not.toBe('');
    for (const tipo of [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      'summary',
    ]) {
      expect(
        selector,
        `M5 no mira \`${tipo}\`, que ADR-034 §6 nombra explícitamente. Una medida que no ` +
          `mira un tipo de control lo aprueba en silencio`,
      ).toContain(tipo);
    }
  });

  it('M5 mide las DOS cosas: el suelo de la caja y el solape entre controles', () => {
    // ADR-034 §6: «…tiene una caja de al menos 44 × 44 px CSS, contando el área ampliada
    // por pseudoelementos si la hay, **y no se solapa con la de otro control**». Dos
    // controles de 44 que se pisan no son dos dianas de 44: son una zona ambigua.
    const fuente = fuenteDelModulo();
    const desde = fuente.indexOf('export async function medirAreaTactil');
    expect(desde, 'no se encontró M5 en el módulo').toBeGreaterThan(-1);
    const cuerpo = fuente.slice(desde);
    expect(
      cuerpo,
      'M5 no reporta los controles por debajo del suelo: sin esa mitad no mide el tamaño ' +
        'de la diana',
    ).toMatch(/pequenos/);
    expect(
      cuerpo,
      'M5 no reporta solapes entre controles, que es la otra mitad de ADR-034 §6',
    ).toMatch(/solapes/);
    expect(
      cuerpo,
      'M5 no tiene en cuenta el área ampliada por pseudoelemento. ADR-034 §6 lo dice ' +
        'expresamente: agrandar la diana con un `::after` absoluto es una salida legítima ' +
        'y una medida que no la ve obligaría a engordar la caja visible sin motivo',
    ).toMatch(/::before|::after|pseudo/i);
  });

  it('el defecto reinyectable de la prueba de eficacia vive en el módulo (ADR-026 §7)', () => {
    // Una guardia que no se pone roja al devolverle el defecto no está midiendo lo que
    // dice medir. El defecto de M5 es el que el árbol tenía el día que la medida nació:
    // `.btn-sm` con ≈31 px de alto, en «Editar», «Quitar» y el botón de dirección.
    const fuente = fuenteDelModulo();
    expect(
      fuente,
      'el módulo no trae el defecto reinyectable de M5. Los de SPEC-040 viven en ' +
        '`DEFECTOS` y el de SPEC-046 en `defectoSuperficieTrasLaLista`: el de M5 se ' +
        'escribe donde se escriben los demás, no dentro de una guardia',
    ).toContain('DEFECTO_AREA_TACTIL');
    const defecto = fuente.match(/DEFECTO_AREA_TACTIL[^`]*`([^`]+)`/)?.[1] ?? '';
    expect(
      defecto,
      'el defecto de M5 no toca `.btn-sm`, que es la clase de los tres controles que ' +
        'nacieron rojos (ADR-034 §6 y R-1 de EPIC-007)',
    ).toContain('.btn-sm');
  });

  it('NINGUNA guardia de spec escribe su propia versión de M5', () => {
    // Misma comprobación binaria que SPEC-040 CA-6 con `scrollWidth` y SPEC-046 CA-9 con
    // el pliegue, y por el mismo motivo: la medida buena entró una vez y se cayó en las
    // dos copias siguientes (SPEC-037, SPEC-039).
    for (const fichero of consumidoresDelModulo()) {
      const lineas = codigoDe(fichero).filter((l) => /\b44\b/.test(l));
      expect(
        lineas,
        `${fichero} escribe el suelo táctil por su cuenta. El 44 vive en ` +
          `\`SUELO_TACTIL_PX\` (${MODULO}, M5) y se importa de allí: repetirlo es como se ` +
          `afloja un umbral sin que nadie lo vea (F-ADR-026-1).\n` +
          lineas.map((l) => `  ${l.trim()}`).join('\n'),
      ).toEqual([]);
    }
  });
});

describe('SPEC-054 CA-13: M5 no nace con puertas de atrás', () => {
  it('no hay una lista de exclusiones propia de M5 escrita en el módulo', () => {
    // F-ADR-026-2: una lista de exclusiones puede crecer hasta vaciar la medida. M5
    // hereda `EXCLUSIONES_M1` si quien mide se la pasa, y no estrena una lista suya con
    // los controles que hoy no pasan — que sería la salida barata de ADR-034 §6.
    const fuente = fuenteDelModulo();
    expect(
      fuente,
      'M5 estrenó su propia lista de exclusiones. Los controles que no llegan al suelo se ' +
        'AGRANDAN (ADR-026 §4); esconderlos en una lista es F-ADR-026-2 cumpliéndose',
    ).not.toContain('EXCLUSIONES_M5');
  });
});
