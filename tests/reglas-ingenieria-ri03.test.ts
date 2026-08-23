import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-048 CA-11 — **RI-03 queda escrita, y con su fuente**.
 *
 * Las reglas de ingeniería de este proyecto viven en `docs/fundacion/reglas.md`
 * § *Reglas de ingeniería (RI-xx)* y su fuente es siempre un ADR. ADR-031 se aprobó en
 * el gate del 2026-08-22 junto con SPEC-048, así que la regla que constriñe a todas las
 * specs futuras tiene que estar escrita ahí y no sólo en el ADR.
 *
 * Va en un fichero propio y **no se toca `tests/reglas-ingenieria.test.ts`** (SPEC-032
 * CA-15): aquella spec congela la serie RN de dominio y comprueba RI-01; la serie RI no
 * está congelada en él y RI-03 entra sin romper nada. Es el mismo criterio con el que
 * SPEC-043 añadió RN-16 sin reescribir el test de SPEC-032.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reglasPath = join(rootDir, 'docs', 'fundacion', 'reglas.md');

const source = () => readFileSync(reglasPath, 'utf8');

const TITULO_INGENIERIA = 'Reglas de ingeniería (RI-xx)';
/** El encabezado exacto, como texto literal: el título lleva paréntesis y construir con
 *  él un regex sin escaparlos los convertiría en grupos de captura. */
const ENCABEZADO = `\n## ${TITULO_INGENIERIA}\n`;

function seccionDeIngenieria(): string {
  const partes = source().split(ENCABEZADO);
  expect(partes.length, `No hay ninguna sección "## ${TITULO_INGENIERIA}"`).toBe(2);
  return partes[1];
}

/** La sección con los saltos de línea planchados: el texto de la regla es contrato; dónde
 *  caiga cada salto al ajustar el margen, no. */
const ingenieriaLlana = () => seccionDeIngenieria().replace(/\s+/g, ' ');

describe('SPEC-048 CA-11: RI-03 existe y está en la serie de ingeniería', () => {
  it('la sección contiene RI-03', () => {
    expect(seccionDeIngenieria()).toContain('**RI-03**');
  });

  it('y la serie de ingeniería sigue bien formada, con RI-03 dentro', () => {
    // **`F-SPEC-048-3` — re-encuadrado el 2026-08-23, antes del merge.**
    //
    // Qué vigilaba antes: que la serie fuera EXACTAMENTE `['RI-01', 'RI-02', 'RI-03']`.
    // Una foto de su extensión de hoy: cierta mientras tres fueran tres, y roja el día
    // que alguien escriba RI-04 sin que RI-04 tenga nada de malo. Es la forma exacta que
    // CA-13 acaba de re-encuadrar en `tests/reglas-ingenieria-hecho-vivo.test.ts`,
    // cometida otra vez en el mismo rango de commits, dentro de la spec que existe para
    // eliminarla. Qué vigila ahora: la propiedad que no caduca —la serie empieza en
    // RI-01, va en orden, no salta números ni se repite, y RI-03 está dentro—. Lo que
    // CA-11 afirma sigue entero, y el contenido de RI-03 lo miden los bloques de abajo.
    //
    // Esto es guardia **PROPIA** de SPEC-048, y ahí está la diferencia con
    // `F-SPEC-048-1`: no hay fichero ajeno, no hay arbitraje que pedir y no hay
    // beneficiario que apartar. Sólo hay que hacerlo bien, y hacerlo antes del merge —
    // embarcarlo sabiendo lo que es sería la sexta instancia del defecto, y el argumento
    // «ya lo cogerá el follow-up» es el que dejó `main` en rojo.
    //
    // **La frontera que decide, escrita para quien pase por aquí:** ¿la lista crece por
    // diseño o está cerrada por diseño? El literal del `matcher` de `src/proxy.ts` o los
    // `scripts` de `package.json` están CERRADOS: congelarlos al milímetro es una guardia
    // correcta, y su rojo dice «alguien añadió algo sin un CA que lo pida». La serie RI
    // CRECE: congelar su extensión es una foto, y su rojo sólo dice «el proyecto avanzó»,
    // que no es información.
    const numeros = (fuente: string) =>
      [...fuente.matchAll(/\*\*RI-(\d+)\*\*/g)].map((m) => Number(m[1]));

    /** La propiedad entera, aislada para poder volver a ejecutarla contra una serie mutada. */
    const serieSana = (serie: number[]) =>
      serie.length > 0 && serie.every((n, i) => n === i + 1) && serie.includes(3);

    const serie = numeros(seccionDeIngenieria());
    expect(serie, 'la serie RI ni salta números, ni se repite, ni se desordena').toEqual(
      serie.map((_, i) => i + 1),
    );
    expect(serie, 'RI-03 tiene que estar dentro de la serie').toContain(3);
    expect(serieSana(serie), 'la serie de ingeniería del árbol real no cumple la propiedad').toBe(
      true,
    );

    // …y la MISMA comparación rechaza las cuatro formas de romperla, más la serie vacía.
    // Sin esto estaría afirmando una propiedad que no he probado, que es la otra mitad
    // del defecto que esta spec persigue.
    expect(serieSana([1, 2, 4]), 'acepta un hueco: RI-03 podría desaparecer sin ruido').toBe(false);
    expect(serieSana([1, 2, 3, 3]), 'acepta un número repetido').toBe(false);
    expect(serieSana([2, 1, 3]), 'acepta la serie desordenada').toBe(false);
    expect(serieSana([1, 2]), 'acepta que RI-03 desaparezca de la serie').toBe(false);
    expect(serieSana([]), 'acepta una sección de ingeniería vacía').toBe(false);
  });
});

describe('SPEC-048 CA-11: RI-03 dice qué distingue un criterio de gate de una propiedad', () => {
  it('nombra las dos clases y qué las hace distintas: delta contra estado', () => {
    const cuerpo = ingenieriaLlana();
    expect(cuerpo).toMatch(/criterio de gate/i);
    expect(cuerpo).toMatch(/propiedad/i);
    expect(cuerpo).toMatch(/este cambio está bien acotado/i);
    expect(cuerpo).toMatch(/delta/i);
    expect(cuerpo).toMatch(/estado del árbol/i);
  });

  it('dice dónde va cada una: propiedad, gate con evidencia en el ledger, o script de CI', () => {
    const cuerpo = ingenieriaLlana();
    expect(cuerpo).toMatch(/ledger/i);
    expect(cuerpo).toContain('scripts/check-version-bump.mjs');
  });
});

describe('SPEC-048 CA-11: RI-03 enumera las cuatro condiciones de la guardia anclada', () => {
  it('1 — ventana de dos sha fijos, y ninguna revisión móvil', () => {
    const cuerpo = ingenieriaLlana();
    expect(cuerpo).toMatch(/dos sha fijos/i);
    expect(cuerpo).toContain('origin/main');
    expect(cuerpo).toContain('HEAD');
  });

  it('2 — centinela de no-vacuidad', () => {
    expect(ingenieriaLlana()).toMatch(/no-vacuidad/i);
  });

  it('3 — salto declarado por disponibilidad, y prohibido en CI', () => {
    const cuerpo = ingenieriaLlana();
    expect(cuerpo).toContain('skipIf');
    expect(cuerpo).toMatch(/no puede ocurrir en CI/i);
  });

  it('4 — el porqué al lado: qué vigilaba antes, qué vigila ahora, qué CA y qué fecha', () => {
    const cuerpo = ingenieriaLlana();
    expect(cuerpo).toMatch(/qué vigilaba antes/i);
    expect(cuerpo).toMatch(/qué vigila ahora/i);
  });
});

describe('SPEC-048 CA-11: RI-03 cita su mecanismo y su fuente', () => {
  it('cita el mecanismo que la hace cumplible: la meta-guardia de SPEC-048', () => {
    const cuerpo = ingenieriaLlana();
    expect(cuerpo).toContain('SPEC-048');
    expect(cuerpo).toMatch(/meta-guardia/i);
  });

  it('cita su fuente: ADR-031', () => {
    expect(seccionDeIngenieria()).toContain('ADR-031');
  });

  it('y no ensucia la serie de dominio: ninguna RN nace en la sección de ingeniería', () => {
    expect(seccionDeIngenieria()).not.toMatch(/\*\*RN-\d+\*\*/);
  });
});
