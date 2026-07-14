/**
 * Puerto `MarketDataProvider` (ADR-002): frontera de integración con el proveedor
 * de datos de mercado. El dominio (refresco, cartera) depende de esta interfaz, no
 * del proveedor concreto — cambiar de proveedor = nuevo adaptador, sin tocar dominio.
 *
 * Contrato de resiliencia (CA-6, ADR-004): `getQuotes` OMITE los símbolos para los
 * que no obtiene precio (fallo puntual); no lanza por un símbolo suelto. El servicio
 * de refresco trata "ausente" como "no actualizado", sin abortar el ciclo entero.
 */

/** Una cotización devuelta por el proveedor. `price` como string decimal (sin float). */
export interface ProviderQuote {
  /** Ticker tal como se pidió (normalizado por el dominio antes de llamar). */
  symbol: string;
  /** Último cierre NO ajustado (RN-12), como string decimal. */
  price: string;
  currency: string;
  /** Fecha de referencia del precio (D-2), ISO 8601. */
  asOf: string;
}

export interface MarketDataProvider {
  /**
   * Pide las cotizaciones de `tickers` en UNA operación (ADR-002: 1 símbolo = 1
   * llamada por ciclo). Devuelve solo los que se pudieron resolver; los que fallan
   * se omiten del resultado (CA-6), nunca hacen fallar a los demás.
   */
  getQuotes(tickers: string[]): Promise<ProviderQuote[]>;
}
