/**
 * Puerto `MarketDataProvider` (ADR-002): frontera de integración con el proveedor
 * de datos de mercado. El dominio (refresco, cartera) depende de esta interfaz, no
 * del proveedor concreto — cambiar de proveedor = nuevo adaptador, sin tocar dominio.
 *
 * Contrato de resiliencia (CA-6 de SPEC-004, ADR-004): `getQuotes` OMITE los
 * símbolos para los que no obtiene precio (fallo puntual); no lanza por un símbolo
 * suelto. El servicio de refresco trata "ausente" como "no actualizado", sin abortar
 * el ciclo entero.
 *
 * Identidad por mercado (ADR-007/SPEC-008): la cotización se pide por
 * (`ticker`, `micCode`), no solo por ticker, para que el precio venga del mercado y
 * divisa correctos (coherencia símbolo↔cotización). `micCode` es opcional para los
 * símbolos legacy (pre ADR-007), en cuyo caso la identidad recae en el ticker.
 */

/** Petición de cotización: identidad de mercado del símbolo (ADR-007). */
export interface QuoteRequest {
  ticker: string;
  /** MIC ISO 10383; null/undefined = símbolo legacy sin mercado fijado. */
  micCode?: string | null;
}

/** Una cotización devuelta por el proveedor. `price` como string decimal (sin float). */
export interface ProviderQuote {
  /** Ticker tal como se pidió (normalizado por el dominio antes de llamar). */
  ticker: string;
  /**
   * MIC del mercado que cotizó el precio, en **operating MIC canónico** (eco de la
   * petición, ADR-007/ADR-012). El adaptador traduce el dialecto del proveedor.
   */
  micCode?: string | null;
  /** Último cierre NO ajustado (RN-12), como string decimal. */
  price: string;
  /**
   * Divisa **informativa**: no todos los proveedores la devuelven (Marketstack no,
   * verificado 2026-07-15). La divisa de la cotización es la **del símbolo** (RN-09,
   * fijada al elegir el candidato en la búsqueda, ADR-007): el refresco usa esa, no
   * esta. Se conserva porque algún adaptador sí la aporta.
   */
  currency?: string;
  /** Fecha de referencia del precio (D-2), ISO 8601. */
  asOf: string;
}

/**
 * Clave de identidad de un símbolo para casar peticiones con respuestas y deduplicar
 * (ADR-007): `ticker:micCode` cuando hay mercado; solo `ticker` para legacy. Dos
 * mercados del mismo ticker tienen claves distintas y no colisionan.
 */
export function quoteKey(ticker: string, micCode?: string | null): string {
  return micCode ? `${ticker}:${micCode}` : ticker;
}

export interface MarketDataProvider {
  /**
   * Pide las cotizaciones de `requests` en UNA operación (ADR-002: 1 símbolo = 1
   * llamada por ciclo). Cada petición lleva su `micCode` para desambiguar el mercado
   * (ADR-007). Devuelve solo los que se pudieron resolver; los que fallan se omiten
   * del resultado (CA-6 de SPEC-004), nunca hacen fallar a los demás.
   */
  getQuotes(requests: QuoteRequest[]): Promise<ProviderQuote[]>;
}
