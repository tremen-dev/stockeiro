import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { watchedSymbols, symbols, quotes, quoteDiagnostics } from '@/db/schema';
import type { QuoteFailureReason } from '@/lib/market/provider';
import { entraEnZona, type Zona } from './zones';

type Db = PgDatabase<any, any, any>;

/** Estado de zona derivado del último precio (SPEC-007, RN-11). */
export type ZoneState = 'buy' | 'sell' | 'both' | 'out' | 'none';

export interface ZoneStatusView {
  id: string;
  ticker: string;
  /**
   * Operating MIC canónico del símbolo (ADR-012). Es LA MITAD DE LA IDENTIDAD, o sea
   * exactamente lo que distingue dos filas del mismo ticker que hoy se ven iguales
   * (SPEC-029 CA-14, cierra F-SPEC-024-1). NULL en los símbolos legacy pre-ADR-007:
   * de esos no sabemos en qué mercado cotizan, y la celda queda VACÍA.
   */
  micCode: string | null;
  /** Etiqueta de tipo del proveedor (SPEC-029 CA-13); NULL = no lo sabemos. */
  instrumentType: string | null;
  currency: string;
  buyMin: string | null;
  buyMax: string | null;
  sellMin: string | null;
  sellMax: string | null;
  /** Última cotización ingerida del símbolo; null si aún no hay (estado neutro). */
  price: string | null;
  asOf: Date | null;
  hasQuote: boolean;
  inBuy: boolean;
  inSell: boolean;
  /** Estado resumido para pintar el color de fondo: none = sin dato. */
  state: ZoneState;
  /**
   * Por qué NO se puede cotizar este símbolo (SPEC-016). `null` = nunca ha fallado, así
   * que un `state:'none'` sin motivo significa "el ciclo aún no ha corrido" y con motivo
   * significa "no se puede cotizar, y por esto" (CA-3). Sin él, ambos casos se veían
   * igual: "sin cotización" — el fallo silencioso que originó EPIC-FIX.
   */
  failReason: QuoteFailureReason | null;
}

function zona(min: string | null, max: string | null): Zona | null {
  return min != null && max != null ? { min, max } : null;
}

function stateOf(hasQuote: boolean, inBuy: boolean, inSell: boolean): ZoneState {
  if (!hasQuote) return 'none';
  if (inBuy && inSell) return 'both';
  if (inBuy) return 'buy';
  if (inSell) return 'sell';
  return 'out';
}

/**
 * Estado de zona de las acciones vigiladas de un usuario (SPEC-007). Junta cada acción
 * con su ÚLTIMA cotización (left join → sin cotización = neutro, CA-2) y evalúa las zonas
 * con el predicado probado `entraEnZona` (SPEC-003, RN-11). Aislado por `userId` (CA-5/RN-01).
 * Se computa en render, no se materializa (decisión de bajo riesgo, sin ADR).
 */
export async function zoneStatusForUser(db: Db, userId: string): Promise<ZoneStatusView[]> {
  const rows = await db
    .select({
      id: watchedSymbols.id,
      ticker: symbols.ticker,
      micCode: symbols.micCode,
      instrumentType: symbols.instrumentType,
      currency: symbols.currency,
      buyMin: watchedSymbols.buyMin,
      buyMax: watchedSymbols.buyMax,
      sellMin: watchedSymbols.sellMin,
      sellMax: watchedSymbols.sellMax,
      price: quotes.price,
      asOf: quotes.asOf,
      failReason: quoteDiagnostics.reason,
    })
    .from(watchedSymbols)
    .innerJoin(symbols, eq(watchedSymbols.symbolId, symbols.id))
    .leftJoin(quotes, eq(quotes.symbolId, symbols.id))
    // SPEC-016: el diagnóstico del símbolo (si lo hay) viaja con el estado de zona.
    .leftJoin(quoteDiagnostics, eq(quoteDiagnostics.symbolId, symbols.id))
    .where(eq(watchedSymbols.userId, userId))
    .orderBy(symbols.ticker);

  return rows.map((r) => {
    const hasQuote = r.price != null;
    const inBuy = hasQuote && entraEnZona(r.price as string, zona(r.buyMin, r.buyMax));
    const inSell = hasQuote && entraEnZona(r.price as string, zona(r.sellMin, r.sellMax));
    return {
      ...r,
      hasQuote,
      inBuy,
      inSell,
      state: stateOf(hasQuote, inBuy, inSell),
      failReason: (r.failReason as QuoteFailureReason | null) ?? null,
    };
  });
}
