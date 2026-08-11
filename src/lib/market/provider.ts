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

/**
 * Motivo CLASIFICADO por el que un símbolo no se pudo cotizar (SPEC-016, ADR-012 pto. 6).
 * Es vocabulario del DOMINIO, no el texto del proveedor: la UI muestra esto, nunca un
 * `{"code":403,"message":"...upgrade your plan"}`. El texto crudo, si acaso, va al log.
 */
export type QuoteFailureReason =
  /** El plan/proveedor no sirve ese mercado (p. ej. BME en el free tier de Twelve Data). */
  | 'mercado_no_cubierto'
  /** El proveedor no conoce el símbolo (deslistado, ilíquido, ticker erróneo). */
  | 'simbolo_desconocido'
  /** El símbolo no tiene operating MIC canónico: no se puede cotizar sin adivinar (ADR-012). */
  | 'sin_identidad_de_mercado'
  /**
   * El proveedor RESPONDIÓ y no nos sirve ese símbolo tal y como se lo pedimos (SPEC-020):
   * rechazó la petición (`no_valid_symbols_provided`) o devolvió el precio de OTRO mercado.
   * No es `simbolo_desconocido` —el valor no está deslistado— ni `proveedor_no_disponible`
   * —reintentar no lo arregla—: las dos cosas serían mentira, y el defecto de esta épica
   * es exactamente el motivo mentiroso (CE-F2).
   */
  | 'simbolo_no_admitido'
  /** Caída/límite del proveedor: es transitorio, no un problema del símbolo. */
  | 'proveedor_no_disponible';

/** Un símbolo que NO se pudo cotizar, con su motivo (SPEC-016). */
export interface ProviderFailure {
  ticker: string;
  micCode?: string | null;
  reason: QuoteFailureReason;
}

/**
 * Resultado de pedir cotizaciones: lo resuelto Y lo no resuelto **con su motivo**.
 * Antes se devolvía solo `ProviderQuote[]` y lo que faltaba se descartaba en silencio —
 * por eso el defecto de cobertura de EPIC-FIX pasó semanas sin detectarse. El puerto ya
 * no se traga el motivo (ADR-012 pto. 6).
 */
export interface QuotesResult {
  quotes: ProviderQuote[];
  failures: ProviderFailure[];
}

export interface MarketDataProvider {
  /**
   * Pide las cotizaciones de `requests` en UNA operación (ADR-002: 1 símbolo = 1
   * llamada por ciclo). Cada petición lleva su `micCode` para desambiguar el mercado
   * (ADR-007/ADR-012). Devuelve lo resuelto en `quotes` y lo NO resuelto en `failures`
   * **con su motivo clasificado** (SPEC-016): un símbolo que falla nunca hace fallar a
   * los demás (CA-6 de SPEC-004), pero tampoco desaparece sin explicación.
   */
  getQuotes(requests: QuoteRequest[]): Promise<QuotesResult>;
}
