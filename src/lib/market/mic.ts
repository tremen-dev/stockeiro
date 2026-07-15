/**
 * Identidad de mercado canónica (ADR-012, SPEC-015). ISO 10383 distingue dos MIC:
 *
 *  - **operating MIC**: el OPERADOR del mercado (`BMEX` = Bolsas y Mercados Españoles,
 *    `XNAS` = Nasdaq).
 *  - **segment MIC**: un segmento concreto dentro de ese operador (`XMAD` = Bolsa de
 *    Madrid, cuyo operating MIC es BMEX; `XNGS`/`XNMS`/`XNCM` = segmentos de Nasdaq).
 *
 * ADR-007 fijó la identidad del símbolo como `(ticker, mic_code)` pero **no dijo cuál
 * de los dos**. Cada proveedor elige distinto (Twelve Data devuelve segmento; Marketstack
 * devuelve operating), y esa ambigüedad fue la RAÍZ de dos defectos: el descarte
 * silencioso al no casar el eco del mic, y el mapeo `M.CONTINUO→XMAD` del import
 * (F-SPEC-012-1).
 *
 * ADR-012 canoniza en **operating MIC**: es más estable (los segmentos se subdividen y
 * cambian) y es lo que devuelve el proveedor de cotizaciones, que es quien debe casar.
 * `symbols.micCode` guarda SIEMPRE el operating MIC. Este módulo es conocimiento de
 * **mercado** (ISO 10383), no de proveedor: la traducción al dialecto de cada proveedor
 * vive en su adaptador.
 */

/** Operating MIC soportados (los 7 mercados del extracto real de ING, EPIC-002). */
export const OPERATING_MICS = ['BMEX', 'XNAS', 'XNYS', 'XETR', 'XSTO', 'XPAR', 'XAMS'] as const;

export type OperatingMic = (typeof OPERATING_MICS)[number];

/**
 * Mapa ISO 10383 **segmento → operating**. Solo los segmentos que nos pueden llegar del
 * proveedor de búsqueda para los mercados soportados. Un operating MIC se mapea a sí
 * mismo (`XNYS`→`XNYS`) para que la normalización sea idempotente.
 */
const SEGMENT_TO_OPERATING: Record<string, OperatingMic> = {
  // España — BME (Bolsas y Mercados Españoles)
  BMEX: 'BMEX',
  XMAD: 'BMEX', // Bolsa de Madrid
  XMCE: 'BMEX', // Mercado Continuo Español (SIBE)
  XBAR: 'BMEX', // Barcelona
  XBIL: 'BMEX', // Bilbao
  XVAL: 'BMEX', // Valencia
  // EEUU — Nasdaq
  XNAS: 'XNAS',
  XNGS: 'XNAS', // Global Select
  XNMS: 'XNAS', // Global Market
  XNCM: 'XNAS', // Capital Market
  // EEUU — NYSE
  XNYS: 'XNYS',
  // Alemania — Xetra
  XETR: 'XETR',
  XETA: 'XETR',
  // Suecia — Nasdaq Stockholm
  XSTO: 'XSTO',
  // Euronext
  XPAR: 'XPAR',
  XAMS: 'XAMS',
};

const norm = (mic: string | null | undefined): string => (mic ?? '').trim().toUpperCase();

/** True si el MIC ya es un operating MIC soportado. */
export function isOperatingMic(mic: string | null | undefined): mic is OperatingMic {
  return (OPERATING_MICS as readonly string[]).includes(norm(mic));
}

/**
 * Normaliza un `mic_code` de proveedor (segmento u operating) al **operating MIC
 * canónico**. Devuelve `null` si no se conoce: en ese caso el símbolo **no se cotiza**
 * — no se inventa su mercado (CA-10), porque cotizar el mercado equivocado falsearía
 * el P/L (RN-09/RN-06).
 */
export function toOperatingMic(mic: string | null | undefined): OperatingMic | null {
  return SEGMENT_TO_OPERATING[norm(mic)] ?? null;
}
