import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-032 CA-15 — la política de migraciones aditivas (ADR-018 D-5.1) queda
 * escrita como regla del proyecto, y con numeración propia.
 *
 * El gate del 2026-08-18 firmó dos cosas: adoptar D-5.1 como regla, y ponerla en
 * `docs/fundacion/reglas.md` **en una sección aparte**, no como `RN-16`. El
 * porqué del sitio importa tanto como el fondo: hoy ese fichero contiene solo
 * reglas de **dominio**, todas con su *"Fuente: sdd-cartera"* o *sdd-mercados*,
 * y dos skills vigilan esa numeración. Una regla de ingeniería colada en esa
 * serie ensucia algo que no es suyo.
 *
 * Por eso este test tiene dos mitades: que la regla nueva esté, y que las quince
 * de dominio sigan exactamente donde estaban.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reglasPath = join(rootDir, 'docs', 'fundacion', 'reglas.md');

const source = () => readFileSync(reglasPath, 'utf8');

const TITULO_INGENIERIA = 'Reglas de ingeniería (RI-xx)';
/** El encabezado exacto, como texto literal: el título lleva paréntesis, y
 *  construir con él un regex sin escaparlos los convertiría en grupos de
 *  captura — el patrón casaría con todo menos con lo que hay escrito. */
const ENCABEZADO = `\n## ${TITULO_INGENIERIA}\n`;

/** Todo lo que va después del encabezado de la sección de ingeniería. */
function seccionDeIngenieria(): string {
  const partes = source().split(ENCABEZADO);
  expect(
    partes.length,
    `No hay ninguna sección "## ${TITULO_INGENIERIA}" en docs/fundacion/reglas.md`,
  ).toBe(2);
  return partes[1];
}

/** La sección con los saltos de línea planchados: el texto de la regla es el que
 *  fija CA-15, pero dónde caiga cada salto al ajustar el margen no es contrato. */
function ingenieriaLlana(): string {
  return seccionDeIngenieria().replace(/\s+/g, ' ');
}

/** Y todo lo que va antes: la serie de dominio, intacta. */
function seccionDeDominio(): string {
  return source().split(ENCABEZADO)[0];
}

describe('SPEC-032 CA-15.1: hay una sección nueva, al final y aparte', () => {
  it('existe la sección "Reglas de ingeniería (RI-xx)"', () => {
    expect(source()).toContain(ENCABEZADO);
  });

  it('va al final: después de ella no hay ninguna regla de dominio', () => {
    expect(seccionDeIngenieria()).not.toMatch(/\*\*RN-\d+\*\*/);
  });
});

describe('SPEC-032 CA-15.2 y CA-15.3: RI-01 dice qué es, quién la decidió y quién la vigila', () => {
  it('la sección contiene RI-01', () => {
    expect(seccionDeIngenieria()).toContain('**RI-01**');
  });

  it('nombra la política por su nombre: migraciones aditivas, expand/contract', () => {
    const cuerpo = ingenieriaLlana();
    expect(cuerpo).toMatch(/migraciones aditivas/i);
    expect(cuerpo).toMatch(/expand\/contract/i);
  });

  it('dice qué prohíbe: ni borrar, ni renombrar, ni estrechar en el mismo despliegue', () => {
    const cuerpo = ingenieriaLlana();
    expect(cuerpo).toMatch(/no borra/i);
    expect(cuerpo).toMatch(/no renombra/i);
    expect(cuerpo).toMatch(/no estrecha/i);
    expect(cuerpo).toMatch(/mismo despliegue/i);
  });

  it('dice cómo se parte lo destructivo: añadir y rellenar, y retirar en otra spec', () => {
    const cuerpo = ingenieriaLlana();
    expect(cuerpo).toMatch(/se a[ñn]ade y se rellena/i);
    expect(cuerpo).toMatch(/otra spec/i);
  });

  it('cita el mecanismo que la hace cumplible: SPEC-032 y el fichero de desbloqueos', () => {
    const cuerpo = ingenieriaLlana();
    expect(cuerpo).toContain('SPEC-032');
    expect(cuerpo).toContain('drizzle/destructive-waivers.json');
    expect(cuerpo).toMatch(/solo se desbloquea por escrito/i);
    expect(cuerpo).toMatch(/plan de vuelta atr[áa]s/i);
  });

  it('cita su fuente: ADR-018 D-5.1', () => {
    expect(seccionDeIngenieria()).toContain('ADR-018 D-5.1');
  });
});

describe('SPEC-032 CA-15: y las quince RN de dominio siguen intactas', () => {
  /** El nombre entre paréntesis de cada regla, tal como estaba antes de esta
   *  spec. Congela el encabezado de cada RN sin congelar su prosa: renumerar,
   *  reescribir un título o colar una RN-16 se cae aquí; una precisión de
   *  redacción que sdd-cartera o sdd-mercados hagan mañana, no. */
  const DOMINIO: ReadonlyArray<[string, string]> = [
    ['RN-01', 'Aislamiento de datos por usuario'],
    ['RN-02', 'Identidad por email único'],
    ['RN-03', 'Acceso autenticado'],
    ['RN-04', 'Coste base = precio medio ponderado'],
    ['RN-05', 'P/L realizado'],
    ['RN-06', 'P/L actual'],
    ['RN-07', 'Splits'],
    ['RN-08', 'No sobreventa'],
    ['RN-09', 'Divisa única por posición'],
    ['RN-10', 'Zona = rango de precio'],
    ['RN-11', 'Entrada en zona'],
    ['RN-12', 'Base de precio = último cierre NO ajustado'],
    ['RN-13', 'Disparo por entrada; permanencia observable'],
    ['RN-14', 'Tipos de aviso e idempotencia del envío'],
    ['RN-15', 'Canal proactivo con registro y fallback'],
  ];

  it('siguen siendo quince, y en el mismo orden', () => {
    const encontradas = [...seccionDeDominio().matchAll(/\*\*(RN-\d+)\*\*/g)].map((m) => m[1]);
    expect(encontradas).toEqual(DOMINIO.map(([id]) => id));
  });

  for (const [id, nombre] of DOMINIO) {
    it(`${id} conserva su enunciado (${nombre})`, () => {
      expect(seccionDeDominio()).toContain(`**${id}** (${nombre}`);
    });
  }

  it('no nace ninguna RN-16: la regla de ingeniería NO entra en la serie de dominio', () => {
    expect(
      source(),
      'Meter una regla de ingeniería en la serie RN ensucia una numeración que ' +
        'vigilan sdd-cartera y sdd-mercados.',
    ).not.toMatch(/\bRN-1[6-9]\b|\bRN-[2-9]\d\b/);
  });

  it('la cabecera del fichero sigue presentando la serie RN como lo que es', () => {
    expect(seccionDeDominio()).toContain('las specs y ADRs las citan como RN-xx');
  });
});
