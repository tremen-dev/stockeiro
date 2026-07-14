/**
 * Puerto `SymbolSearchProvider` (ADR-007): frontera de integración para BUSCAR
 * símbolos por nombre/ticker/ISIN. Es un puerto DISTINTO de `MarketDataProvider`
 * (cotizar): buscar y cotizar son responsabilidades separadas y un proveedor
 * podría dar una y no la otra. El dominio y la UI dependen de esta interfaz, no
 * del proveedor concreto — cambiar de proveedor = nuevo adaptador, sin tocar
 * dominio (mismo patrón que ADR-002).
 */

/** Un candidato de símbolo devuelto por la búsqueda. */
export interface SymbolMatch {
  /** Ticker tal como el proveedor de cotización lo acepta (coherencia con /eod). */
  ticker: string;
  /** MIC ISO 10383 del mercado; fija de qué bolsa/divisa hablamos (ADR-007). */
  micCode: string;
  /** Nombre legible de la bolsa (p. ej. "NASDAQ"). */
  exchange: string;
  /** Nombre del instrumento (instrument_name, p. ej. "Microsoft Corp"). */
  name: string;
  currency: string;
  country: string;
  /** Clase de instrumento normalizada: `'stock'` para renta variable (D-7). */
  type: string;
}

export interface SymbolSearchProvider {
  /**
   * Busca candidatos para `query` (nombre, ticker o ISIN). Puede devolver varias
   * filas del MISMO ticker en distintos mercados (distinto `micCode`), que el
   * dominio ofrece como opciones separadas (CA-3). Puede incluir instrumentos que
   * no son acciones; el filtrado a renta variable lo hace el dominio (CA-2).
   */
  search(query: string): Promise<SymbolMatch[]>;
}
