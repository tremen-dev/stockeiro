/**
 * Texto que ve el USUARIO para el tipo de instrumento (SPEC-029 CA-11). Hermano de
 * `fail-reason-text.ts` y con la misma responsabilidad, pero se aparta de él en UN
 * punto y solo en uno: aquí el caso por defecto **no** es una categoría genérica, es
 * **la etiqueta del proveedor tal cual** (ADR-020 pto. 3).
 *
 * El motivo, para el registro: en SPEC-016 queríamos *estabilizar* un mensaje de error;
 * aquí queremos **no perder información sobre el activo**, y «Otro» es indistinguible
 * de «no te lo digo» —que es exactamente el defecto que esta spec viene a matar—.
 *
 * ESTO NO ES UNA LISTA BLANCA: no filtra nada. Un tipo que no esté en el mapa se
 * muestra igual, y su candidato aparece igual en el buscador (CA-5).
 */
const KNOWN: Record<string, string> = {
  'common stock': 'Acción',
  reit: 'REIT',
  'american depositary receipt': 'ADR',
  etf: 'ETF',
};

/**
 * Traduce la etiqueta del proveedor:
 *  - conocida → vocabulario del dominio (`Common Stock` → «Acción»);
 *  - desconocida → **en crudo**, nunca «Otro», nunca oculta;
 *  - vacía o ausente → cadena vacía: no se muestra nada, ni hueco raro ni «—»
 *    engañoso (un símbolo sin tipo conocido **no tiene** tipo, y eso es verdad).
 */
export function instrumentTypeText(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  if (t === '') return '';
  return KNOWN[t.toLowerCase()] ?? t;
}
