import { Decimal } from 'decimal.js';

/**
 * SPEC-030 — Normalización de la entrada numérica que teclea una persona.
 *
 * El usuario es español y escribe `12,5`. Hasta esta spec ese string llegaba crudo a
 * `new Decimal(...)`, que lanzaba `[DecimalError] Invalid argument: 12,5` y acababa en un
 * `catch` ciego que respondía «Datos inválidos.».
 *
 * ATENCIÓN — este módulo NO es el parser del extracto de ING
 * (`src/lib/import/ing-xls-reader.ts`). Allí la coma es **separador de miles** (en-US, así
 * lo exporta ING) y aquí es **decimal**: unificar los dos haría que `12,5` valiese 125, un
 * error silencioso de dos órdenes de magnitud en una zona de compra. CA-15 lo vigila.
 *
 * Se aplica SOLO en la frontera de entrada manual (las server actions de `/vigiladas` y
 * `/cartera`), nunca dentro de los servicios de dominio ni sobre los precios que llegan del
 * proveedor: lo que teclea una persona tiene idioma; un `Decimal.Value` de dominio, no.
 */

/** Por qué se rechaza un número. Vocabulario cerrado, como `QuoteFailureReason`. */
export type InvalidNumberReason = 'no_es_numero' | 'ambiguo';

/** Las dos salidas concretas que se le ofrecen a quien escribió algo ambiguo (CA-7). */
const SIN_MILES = '1234';
const CON_DECIMALES = '1234,00';

/**
 * Compone el mensaje que lee el usuario. El motivo no es cosmético: es lo que permite que
 * el ambiguo lleve la orientación de CA-7 y que `"abc"` no la finja (CA-10).
 */
export function invalidNumberText(
  field: string,
  value: string,
  reason: InvalidNumberReason,
): string {
  if (reason === 'ambiguo') {
    return (
      `${field}: «${value}» es ambiguo, no sé qué separador es el decimal. ` +
      `Escríbelo sin separador de miles (${SIN_MILES}) o con los decimales ` +
      `explícitos (${CON_DECIMALES}).`
    );
  }
  return (
    `${field}: no entiendo «${value}». Escribe solo cifras, con coma o punto ` +
    `decimal (por ejemplo, 12,5).`
  );
}

/**
 * Error de DATO (culpa del valor escrito, con arreglo evidente), hermano de
 * `InvalidZoneError`. Lleva el campo con su etiqueta en español, el valor rechazado y el
 * motivo clasificado, para que la capa de UI no tenga que adivinar nada.
 */
export class InvalidNumberError extends Error {
  readonly field: string;
  readonly value: string;
  readonly reason: InvalidNumberReason;

  constructor(field: string, value: string, reason: InvalidNumberReason) {
    super(invalidNumberText(field, value, reason));
    this.name = 'InvalidNumberError';
    this.field = field;
    this.value = value;
    this.reason = reason;
  }
}

/** Todo espacio, incluidos el no separable (U+00A0) y el fino no separable (U+202F). */
const WHITESPACE = /\s/g;

/** Forma numérica estricta: signo opcional, dígitos y un punto decimal opcional. */
const STRICT_NUMBER = /^[+-]?\d+(\.\d+)?$/;

/** Un grupo de miles plausible: de 1 a 3 dígitos y sin cero a la izquierda. */
const PLAUSIBLE_THOUSANDS = /^[1-9]\d{0,2}$/;

const countOf = (s: string, ch: string): number => s.split(ch).length - 1;

/**
 * ¿Un separador único seguido de exactamente 3 dígitos es ambiguo? Solo si la parte entera
 * podría ser un grupo de miles (CA-6).
 *
 * La condición del grupo plausible NO es adorno y no se puede simplificar a «tres dígitos
 * detrás → rechazo»: sin ella se caen `0.001`, `0,500` y `1234,567`, que CA-2 y la tabla de
 * casos límite de CA-6 exigen que sigan valiendo.
 */
function isAmbiguousGrouping(intPart: string, fracPart: string): boolean {
  if (fracPart.length !== 3) return false;
  return PLAUSIBLE_THOUSANDS.test(intPart.replace(/^[+-]/, ''));
}

/**
 * Normaliza lo que el usuario escribió a un `Decimal`, o `null` si el campo venía vacío.
 * Lanza `InvalidNumberError` —nunca una `DecimalError`— cuando el valor no es un número o
 * es ambiguo.
 *
 * @param field Etiqueta del campo en español, la que ve el usuario.
 */
export function normalizeDecimalInput(
  raw: string | null | undefined,
  field: string,
): Decimal | null {
  const original = String(raw ?? '');
  // 1. Fuera todos los espacios, también los interiores: son separador de miles (CA-3).
  const s = original.replace(WHITESPACE, '');
  // 2. Vacío = ausente, no error (CA-9).
  if (s === '') return null;

  const invalid = (reason: InvalidNumberReason) =>
    new InvalidNumberError(field, original.trim(), reason);

  const commas = countOf(s, ',');
  const dots = countOf(s, '.');
  let canonical: string;

  if (commas > 0 && dots > 0) {
    // 3. Los dos separadores: el de más a la derecha es el decimal (CA-4).
    const decSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thouSep = decSep === ',' ? '.' : ',';
    if (countOf(s, decSep) > 1) throw invalid('ambiguo');
    canonical = s.split(thouSep).join('').replace(decSep, '.');
  } else if (commas > 1 || dots > 1) {
    // 4. Un solo tipo de separador, repetido: no se adivina (CA-5, ADR-012).
    throw invalid('ambiguo');
  } else if (commas === 1 || dots === 1) {
    // 5. Un solo separador: es el decimal, salvo que sea un corte de miles plausible (CA-6).
    const sep = commas === 1 ? ',' : '.';
    const at = s.indexOf(sep);
    const intPart = s.slice(0, at);
    const fracPart = s.slice(at + 1);
    if (isAmbiguousGrouping(intPart, fracPart)) throw invalid('ambiguo');
    canonical = `${intPart}.${fracPart}`;
  } else {
    canonical = s;
  }

  // 6. Forma estricta. Rechaza también la notación científica (`1e3`), que decimal.js
  //    aceptaría: nadie teclea eso en una zona de compra, y aceptarla solo amplía la
  //    superficie de sorpresas (CA-8).
  if (!STRICT_NUMBER.test(canonical)) throw invalid('no_es_numero');

  // 7. Solo ahora `new Decimal`, que por construcción ya no puede lanzar.
  return new Decimal(canonical);
}

/** Etiqueta en español de cada campo numérico del alta manual: la que ve el usuario. */
export const NUMERIC_FIELD_LABELS = {
  buyMin: 'Zona de compra (mínimo)',
  buyMax: 'Zona de compra (máximo)',
  sellMin: 'Zona de venta (mínimo)',
  sellMax: 'Zona de venta (máximo)',
  quantity: 'Cantidad',
  price: 'Precio',
  gastos: 'Gastos',
} as const;

export type NumericField = keyof typeof NUMERIC_FIELD_LABELS;

/**
 * La ÚNICA puerta por la que un número de un formulario entra en el producto (CA-13).
 *
 * Añadir un campo numérico nuevo pasa por aquí o no se normaliza; que sea una sola función
 * es el requisito de diseño, no una casualidad. Devuelve `null` cuando el campo viene
 * vacío (CA-9) y lanza `InvalidNumberError` cuando el valor no se entiende.
 */
export function readDecimalField(formData: FormData, name: NumericField): Decimal | null {
  return normalizeDecimalInput(String(formData.get(name) ?? ''), NUMERIC_FIELD_LABELS[name]);
}
