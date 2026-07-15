import { inArray } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { symbols, transactions, watchedSymbols } from '@/db/schema';
import { quoteKey, type MarketDataProvider, type QuoteFailureReason } from './provider';
import { clearDiagnostic, upsertDiagnostic, upsertQuote } from './quotes';

type Db = PgDatabase<any, any, any>;

export interface UniverseSymbol {
  symbolId: string;
  ticker: string;
  micCode: string | null;
  /** Divisa del símbolo: es la VERDAD de la cotización (RN-09), no la que diga el proveedor. */
  currency: string;
}

/**
 * Universo de símbolos a refrescar (CA-1/CA-2): la UNIÓN DISTINCT de los símbolos
 * referenciados por alguna acción vigilada (watchlist) o alguna transacción
 * (cartera), de CUALQUIER usuario. Un símbolo que nadie referencia NO entra
 * (aunque exista en `symbols`). El `Set` garantiza que no hay duplicados: un
 * símbolo que vigilan/operan N usuarios aparece una sola vez (dedupe, ADR-002).
 */
export async function symbolUniverse(db: Db): Promise<UniverseSymbol[]> {
  const watched = await db.selectDistinct({ symbolId: watchedSymbols.symbolId }).from(watchedSymbols);
  const traded = await db.selectDistinct({ symbolId: transactions.symbolId }).from(transactions);

  const ids = new Set<string>();
  for (const r of watched) ids.add(r.symbolId);
  for (const r of traded) ids.add(r.symbolId);
  if (ids.size === 0) return [];

  const rows = await db.select().from(symbols).where(inArray(symbols.id, [...ids]));
  return rows.map((s) => ({ symbolId: s.id, ticker: s.ticker, micCode: s.micCode, currency: s.currency }));
}

/** Un símbolo que no se pudo cotizar, con su motivo clasificado (SPEC-016). */
export interface SkippedSymbol {
  ticker: string;
  reason: QuoteFailureReason;
}

export interface RefreshResult {
  requested: string[]; // tickers pedidos (distinct)
  updated: string[]; // tickers cuya cotización se persistió
  /**
   * Tickers que no se pudieron cotizar, CON SU MOTIVO (SPEC-016). Antes era una lista
   * de tickers pelada y el motivo se tiraba: por eso el defecto de cobertura de EPIC-FIX
   * pasó semanas sin detectarse. Se saltan sin abortar el ciclo (CA-6 de SPEC-004).
   */
  skipped: SkippedSymbol[];
}

/**
 * Refresco diario de cotizaciones (ADR-004): calcula el universo distinct, pide
 * los precios al proveedor en UNA llamada (ADR-002), y hace upsert de cada
 * cotización devuelta. Los símbolos que el proveedor no resuelve se SALTAN sin
 * abortar el ciclo (CA-6). El precio se guarda NO ajustado con su `asOf` (RN-12).
 */
export async function refreshQuotes(db: Db, provider: MarketDataProvider): Promise<RefreshResult> {
  const universe = await symbolUniverse(db);
  const requested = universe.map((u) => u.ticker);
  if (universe.length === 0) return { requested, updated: [], skipped: [] };

  // Se pide por (ticker, micCode) para desambiguar el mercado (ADR-007). El universo
  // ya es distinct por símbolo, así que no hay duplicados (dedupe, ADR-002).
  const requests = universe.map((u) => ({ ticker: u.ticker, micCode: u.micCode }));
  const { quotes: devueltas, failures } = await provider.getQuotes(requests);
  const returned = new Map(devueltas.map((q) => [quoteKey(q.ticker, q.micCode), q]));
  const failed = new Map(failures.map((f) => [quoteKey(f.ticker, f.micCode), f.reason]));

  const updated: string[] = [];
  const skipped: SkippedSymbol[] = [];
  for (const u of universe) {
    const key = quoteKey(u.ticker, u.micCode);
    const q = returned.get(key);
    if (!q) {
      // No se pudo cotizar: se salta sin abortar el ciclo (CA-6 de SPEC-004) PERO el
      // motivo se registra para que el usuario lo vea (SPEC-016, CE-F2 de EPIC-FIX).
      const reason = failed.get(key) ?? 'proveedor_no_disponible';
      await upsertDiagnostic(db, u.symbolId, reason);
      skipped.push({ ticker: u.ticker, reason });
      continue;
    }
    // La divisa es la DEL SÍMBOLO (RN-09), no la que devuelva el proveedor: la fijó el
    // candidato elegido en la búsqueda (ADR-007). Marketstack ni siquiera la devuelve, y
    // fiarse del proveedor permitía guardar USD (SAN@NYSE) en un símbolo EUR (ADR-012).
    await upsertQuote(db, u.symbolId, { price: q.price, currency: u.currency, asOf: q.asOf });
    await clearDiagnostic(db, u.symbolId); // se resolvió: fuera el diagnóstico (CA-8)
    updated.push(u.ticker);
  }
  return { requested, updated, skipped };
}
