/**
 * Puerto `BrokerStatementReader` (ADR-009, SPEC-011): frontera de integración para
 * LEER un extracto de bróker y devolver un modelo intermedio en memoria. El dominio
 * depende de esta interfaz y del modelo `ExtractoParseado`, NO del formato concreto
 * (ING `.xls`) ni de la librería de parseo — cambiar de bróker/formato = nuevo
 * adaptador, sin tocar dominio (mismo patrón que `MarketDataProvider`, ADR-002).
 *
 * ALCANCE (SPEC-011): SOLO lectura → modelo. No resuelve símbolos (SPEC-012), no
 * persiste ni escribe cartera (SPEC-013), no decide divisa/coste (ADR-011). Conserva
 * `nombreBroker`, `etiquetaMercado`, `precioOrigen` e `importeEur` TAL CUAL vienen.
 */

/** Lado de la operación, normalizado al ledger (ADR-003): COMPRA→buy, VENTA→sell. */
export type OperacionSide = 'buy' | 'sell';

/** Metadatos de cabecera del extracto (no son operaciones). */
export interface MetadatosExtracto {
  numeroCuenta: string;
  titular: string;
  /** Fecha de exportación tal como la declara el extracto (cruda, informativa). */
  fechaExportacion: string;
}

/**
 * Una operación de compra/venta leída del extracto, sin interpretar identidad ni
 * coste. Los importes se representan como STRING decimal canónico (no float) para
 * no perder precisión (CA-5; coherente con `numeric`/`Decimal.Value`, ADR-003).
 */
export interface OperacionImportada {
  /** Fecha de la operación en formato `'YYYY-MM-DD'` (como `LedgerEntry.occurredOn`). */
  occurredOn: string;
  side: OperacionSide;
  /** Nombre del valor tal como lo muestra el bróker (identidad SIN resolver, SPEC-012). */
  nombreBroker: string;
  /** Etiqueta de mercado propia del bróker (p. ej. `M.CONTINUO`, `NASDAQ`). */
  etiquetaMercado: string;
  /** Número de títulos (decimal string). */
  cantidad: string;
  /** Precio en divisa origen (decimal string, informativo — ADR-011). */
  precioOrigen: string;
  /** Importe total neto en EUR (decimal string; comisiones incluidas — ADR-011). */
  importeEur: string;
}

/** Resultado de leer un extracto: metadatos + operaciones COMPRA/VENTA. */
export interface ExtractoParseado {
  metadatos: MetadatosExtracto;
  operaciones: OperacionImportada[];
}

/**
 * Se lanza cuando el fichero no es un extracto legible (hoja/columnas inesperadas,
 * corrupto, o una fila de operación con datos inválidos). Falla de forma legible
 * y NO emite operaciones parciales ni basura (CA-7).
 */
export class ExtractoIllegibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractoIllegibleError';
  }
}

export interface BrokerStatementReader {
  /**
   * Lee el contenido binario de un extracto y devuelve el modelo intermedio.
   * Lanza `ExtractoIllegibleError` si el fichero no se puede interpretar.
   */
  read(contenido: Uint8Array | ArrayBuffer): ExtractoParseado;
}
