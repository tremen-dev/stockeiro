import { Decimal } from 'decimal.js';

/**
 * Cálculo de posición y P/L a partir del ledger de transacciones (ADR-003,
 * RN-04..RN-08). Lógica PURA y determinista: no toca DB. Todo el aritmético usa
 * Decimal (nunca float) para no falsear signos ni redondeo (dictamen sdd-cartera).
 */

export type TxnType = 'buy' | 'sell' | 'split' | 'dividend';

/** Entrada del ledger. Los importes aceptan string (numeric de Postgres) o número. */
export interface LedgerEntry {
  type: TxnType;
  occurredOn: string; // 'YYYY-MM-DD'
  quantity?: Decimal.Value | null;
  price?: Decimal.Value | null;
  gastos?: Decimal.Value | null;
  ratio?: Decimal.Value | null;
  amount?: Decimal.Value | null;
  /** Desempate de orden cuando dos eventos comparten fecha (p. ej. orden de inserción). */
  seq?: number;
}

/** Se lanza al intentar vender más cantidad que la viva (RN-08, CA-5). */
export class OversellError extends Error {
  constructor(available: Decimal, requested: Decimal) {
    super(`No se puede vender ${requested} : solo hay ${available} en cartera.`);
    this.name = 'OversellError';
  }
}

export interface Position {
  /** Cantidad viva tras todos los eventos. */
  cantidadViva: Decimal;
  /** Coste base total remanente de la cantidad viva (incluye gastos de compra). */
  costeBaseTotal: Decimal;
  /** P/L realizado acumulado (ventas netas de gastos + dividendos). */
  realizadoPL: Decimal;
  /** true si queda cantidad viva. */
  isOpen: boolean;
}

function d(v: Decimal.Value | null | undefined): Decimal {
  return new Decimal(v ?? 0);
}

/**
 * Deriva la posición de una lista de entradas del ledger (RN-04, RN-05, RN-07).
 * Procesa en orden por fecha y `seq`. Lanza OversellError si una venta supera la
 * cantidad viva en ese momento (RN-08).
 */
export function computePosition(entries: LedgerEntry[]): Position {
  const sorted = [...entries].sort((a, b) => {
    if (a.occurredOn < b.occurredOn) return -1;
    if (a.occurredOn > b.occurredOn) return 1;
    return (a.seq ?? 0) - (b.seq ?? 0);
  });

  let qty = new Decimal(0);
  let costTotal = new Decimal(0);
  let realized = new Decimal(0);

  for (const e of sorted) {
    switch (e.type) {
      case 'buy': {
        const q = d(e.quantity);
        const p = d(e.price);
        const g = d(e.gastos);
        qty = qty.plus(q);
        costTotal = costTotal.plus(p.times(q)).plus(g); // RN-04: gastos al coste base
        break;
      }
      case 'sell': {
        const q = d(e.quantity);
        const p = d(e.price);
        const g = d(e.gastos);
        if (q.gt(qty)) throw new OversellError(qty, q); // RN-08
        const avg = qty.isZero() ? new Decimal(0) : costTotal.div(qty);
        const proceeds = p.times(q).minus(g); // RN-05: neto de gastos
        const costOfSold = avg.times(q);
        realized = realized.plus(proceeds.minus(costOfSold));
        costTotal = costTotal.minus(costOfSold); // el coste medio del resto no cambia
        qty = qty.minus(q);
        break;
      }
      case 'split': {
        const r = d(e.ratio);
        // RN-07: cantidad ×r; coste total intacto → coste medio ÷r; valor y P/L intactos.
        qty = qty.times(r);
        break;
      }
      case 'dividend': {
        // RN-05: el dividendo suma al realizado como ingreso; no altera coste ni cantidad.
        realized = realized.plus(d(e.amount));
        break;
      }
    }
  }

  return {
    cantidadViva: qty,
    costeBaseTotal: costTotal,
    realizadoPL: realized,
    isOpen: qty.gt(0),
  };
}

/** Coste medio por acción de la cantidad viva; null si la posición está cerrada. */
export function costeMedio(pos: Position): Decimal | null {
  return pos.cantidadViva.isZero() ? null : pos.costeBaseTotal.div(pos.cantidadViva);
}

/**
 * P/L actual (no realizado) dado un precio de mercado (RN-06, D-6).
 * - Sin precio (null/undefined) → null: "sin dato", NUNCA 0 ni mezclado con el realizado.
 * - Posición cerrada → 0 (no hay no-realizado).
 */
export function plActual(
  pos: Position,
  marketPrice: Decimal.Value | null | undefined,
): Decimal | null {
  if (marketPrice === null || marketPrice === undefined) return null;
  if (pos.cantidadViva.isZero()) return new Decimal(0);
  const avg = pos.costeBaseTotal.div(pos.cantidadViva);
  return new Decimal(marketPrice).minus(avg).times(pos.cantidadViva);
}
