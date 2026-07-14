import { eq, inArray } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { quotes, symbols, type Quote } from '@/db/schema';

type Db = PgDatabase<any, any, any>;

export interface QuoteInput {
  price: string;
  currency: string;
  asOf: string | Date;
}

/**
 * Upsert de la ÚLTIMA cotización de un símbolo (CA-3, ADR-004): una fila por
 * `symbolId`. Un segundo refresco ACTUALIZA la misma fila (precio/divisa/asOf +
 * updatedAt), no la duplica. El precio se guarda tal cual (NO ajustado, RN-12).
 */
export async function upsertQuote(db: Db, symbolId: string, q: QuoteInput): Promise<Quote> {
  const asOf = q.asOf instanceof Date ? q.asOf : new Date(q.asOf);
  const [row] = await db
    .insert(quotes)
    .values({ symbolId, price: q.price, currency: q.currency, asOf })
    .onConflictDoUpdate({
      target: quotes.symbolId,
      set: { price: q.price, currency: q.currency, asOf, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export interface QuoteView {
  ticker: string;
  price: string;
  currency: string;
  asOf: Date;
}

/**
 * Cotizaciones vigentes (una por símbolo) con su ticker y `asOf` (CA-5, D-2).
 * Si `tickers` se pasa, limita a esos; sin argumento, devuelve todas.
 */
export async function getQuoteViews(db: Db, tickers?: string[]): Promise<QuoteView[]> {
  const base = db
    .select({ ticker: symbols.ticker, price: quotes.price, currency: quotes.currency, asOf: quotes.asOf })
    .from(quotes)
    .innerJoin(symbols, eq(quotes.symbolId, symbols.id));
  const rows = tickers
    ? tickers.length === 0
      ? []
      : await base.where(inArray(symbols.ticker, tickers.map((t) => t.trim().toUpperCase())))
    : await base;
  return rows as QuoteView[];
}

/** Cotización vigente de un ticker (CA-5); null si no hay. */
export async function getQuoteByTicker(db: Db, ticker: string): Promise<QuoteView | null> {
  const [row] = await getQuoteViews(db, [ticker]);
  return row ?? null;
}

/**
 * Mapa ticker -> precio para alimentar el P/L actual de la cartera (CA-4, RN-06).
 * Formato que `portfolioSummary`/`listPositions` (SPEC-002) ya consumen.
 */
export async function getPriceMap(db: Db, tickers?: string[]): Promise<Record<string, string>> {
  const views = await getQuoteViews(db, tickers);
  const map: Record<string, string> = {};
  for (const v of views) map[v.ticker] = v.price;
  return map;
}
