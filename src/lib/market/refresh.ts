import { inArray } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { symbols, transactions, watchedSymbols } from '@/db/schema';
import { quoteKey, type MarketDataProvider } from './provider';
import { upsertQuote } from './quotes';

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

export interface RefreshResult {
  requested: string[]; // tickers pedidos (distinct)
  updated: string[]; // tickers cuya cotización se persistió
  skipped: string[]; // tickers que el proveedor no resolvió (se saltan, CA-6)
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
  const quotesFromProvider = await provider.getQuotes(requests);
  const returned = new Map(quotesFromProvider.map((q) => [quoteKey(q.ticker, q.micCode), q]));

  const updated: string[] = [];
  const skipped: string[] = [];
  for (const u of universe) {
    const q = returned.get(quoteKey(u.ticker, u.micCode));
    if (!q) {
      skipped.push(u.ticker); // proveedor no lo resolvió -> se salta (CA-6)
      continue;
    }
    // La divisa es la DEL SÍMBOLO (RN-09), no la que devuelva el proveedor: la fijó el
    // candidato elegido en la búsqueda (ADR-007). Marketstack ni siquiera la devuelve, y
    // fiarse del proveedor permitía guardar USD (SAN@NYSE) en un símbolo EUR (ADR-012).
    await upsertQuote(db, u.symbolId, { price: q.price, currency: u.currency, asOf: q.asOf });
    updated.push(u.ticker);
  }
  return { requested, updated, skipped };
}
