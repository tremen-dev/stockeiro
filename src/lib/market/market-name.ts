import { type OperatingMic } from './mic';

/**
 * Nombre de dominio de cada mercado soportado (SPEC-029 CA-14). Mapa **TOTAL** sobre
 * `OPERATING_MICS`: el tipo `Record<OperatingMic, string>` hace que añadir un MIC a
 * `mic.ts` sin nombrarlo aquí **no compile**, y un test lo ata además en runtime.
 *
 * Aquí SÍ se sigue el precedente de SPEC-016 sin excepción, al revés que con el tipo
 * de instrumento (`instrument-type-text.ts`), y el motivo es preciso: el vocabulario de
 * mercados **lo cerramos nosotros** (`mic.ts`), no lo dicta el proveedor, así que un
 * mapa total es posible y no pierde información. Donde no se puede cerrar el
 * vocabulario se muestra en crudo; donde sí, se traduce. La regla que gobierna las dos:
 * **no perder información y no inventarla**.
 */
export const MARKET_NAME: Record<OperatingMic, string> = {
  BMEX: 'BME',
  XNAS: 'NASDAQ',
  XNYS: 'NYSE',
  XETR: 'Xetra',
  XSTO: 'Nasdaq Estocolmo',
  XPAR: 'Euronext París',
  XAMS: 'Euronext Ámsterdam',
};

/**
 * Nombre que el usuario LEE para un `micCode`. Lo consumen la tabla de `/vigiladas` y
 * el buscador, para que digan literalmente lo mismo: sin esto, el mismo día que se
 * añade la columna tendríamos «NASDAQ» en la tabla y «XNGS» en el buscador.
 *
 *  - Un MIC de los 7 → su nombre de dominio.
 *  - Un MIC fuera de los 7 (hoy imposible por construcción, pero el dato es dato) →
 *    **en crudo**, nunca oculto.
 *  - Ausente (símbolo legacy pre-ADR-007, `micCode` NULL) → **cadena vacía**: la celda
 *    queda vacía. No se rellena con `exchange`, ni con «—», ni con el ticker: de esos
 *    símbolos NO sabemos en qué mercado cotizan, y escribir uno sería inventarlo.
 */
export function marketName(mic: string | null | undefined): string {
  const m = (mic ?? '').trim().toUpperCase();
  if (m === '') return '';
  return MARKET_NAME[m as OperatingMic] ?? m;
}
