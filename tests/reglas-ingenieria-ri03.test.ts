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

  it('y la serie de ingeniería sigue completa y en orden: RI-01, RI-02, RI-03', () => {
    const encontradas = [...seccionDeIngenieria().matchAll(/\*\*(RI-\d+)\*\*/g)].map((m) => m[1]);
    expect(encontradas).toEqual(['RI-01', 'RI-02', 'RI-03']);
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
