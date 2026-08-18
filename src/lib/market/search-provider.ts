/**
 * Puerto `SymbolSearchProvider` (ADR-007): frontera de integración para BUSCAR
 * símbolos por nombre/ticker/ISIN. Es un puerto DISTINTO de `MarketDataProvider`
 * (cotizar): buscar y cotizar son responsabilidades separadas y un proveedor
 * podría dar una y no la otra. El dominio y la UI dependen de esta interfaz, no
 * del proveedor concreto — cambiar de proveedor = nuevo adaptador, sin tocar
 * dominio (mismo patrón que ADR-002).
 *
 * SPEC-029/ADR-020: el puerto devuelve CANDIDATOS **y DESCARTES**, igual que
 * `MarketDataProvider.getQuotes` pasó a `{quotes, failures}` en SPEC-016
 * (ADR-012 pto. 6). El motivo del descarte tiene que CRUZAR la frontera, no
 * morir en el adaptador: mientras moría, un valor que existía y un nombre que no
 * existía se veían exactamente igual («Sin resultados»).
 */

/** Un candidato de símbolo devuelto por la búsqueda. */
export interface SymbolMatch {
  /** Ticker tal como el proveedor de cotización lo acepta (coherencia con /eod). */
  ticker: string;
  /** Operating MIC canónico del mercado; fija de qué bolsa/divisa hablamos (ADR-007/ADR-012). */
  micCode: string;
  /** Nombre legible de la bolsa según el proveedor (texto libre, p. ej. "NASDAQ"). */
  exchange: string;
  /** Nombre del instrumento (instrument_name, p. ej. "Microsoft Corp"). */
  name: string;
  currency: string;
  country: string;
  /**
   * Etiqueta de tipo **tal cual la dio el proveedor** (`Common Stock`, `REIT`,
   * `American Depositary Receipt`, `ETF`, o cualquier otra que invente mañana);
   * cadena vacía si no la dio. NO se normaliza y NO filtra: el tipo se MUESTRA
   * (ADR-020). Se llamaba `type` y valía `'stock'`; el renombrado es deliberado,
   * para que ninguna comparación `=== 'stock'` sobreviva escondida.
   */
  instrumentType: string;
}

/**
 * Por qué una fila del proveedor NO llega a ser candidata. Vocabulario del
 * **dominio**, cerrado y estable (mismo criterio que `QuoteFailureReason`): el
 * texto crudo del proveedor no cruza el puerto.
 */
export type SearchDiscardReason = 'mercado_no_soportado' | 'sin_identidad_de_mercado';

/**
 * Una fila descartada, con lo justo para **explicárselo al usuario**. El MIC y el
 * exchange van **tal como los dio el proveedor**, sin normalizar: son precisamente
 * lo que no supimos normalizar, y sin ellos no se puede decir *qué* mercado es.
 */
export interface DiscardedSymbol {
  ticker: string;
  name: string;
  /** `mic_code` crudo del proveedor; cadena vacía si no lo dio. */
  micCode: string;
  /** `exchange` crudo del proveedor; cadena vacía si no lo dio. */
  exchange: string;
  reason: SearchDiscardReason;
}

/**
 * Resultado de una búsqueda. **Invariante: `matches` y `discarded` son disjuntos**
 * — una fila está en una lista o en la otra, nunca en las dos. Es la lección cara
 * de F-SPEC-016-3, donde un símbolo salía a la vez en `quotes` y en `failures`.
 */
export interface SymbolSearchResult {
  matches: SymbolMatch[];
  discarded: DiscardedSymbol[];
}

export interface SymbolSearchProvider {
  /**
   * Busca candidatos para `query` (nombre, ticker o ISIN). Puede devolver varias
   * filas del MISMO ticker en distintos mercados (distinto `micCode`), que el
   * dominio ofrece como opciones separadas (CA-3 de SPEC-008). El **único** filtro
   * es el mercado (ADR-012): lo que cae fuera de los operating MIC soportados —o
   * llega sin identidad de mercado— va a `discarded` con su motivo, nunca al vacío.
   */
  search(query: string): Promise<SymbolSearchResult>;
}
