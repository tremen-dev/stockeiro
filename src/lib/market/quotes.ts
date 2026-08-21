import { eq, inArray } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { quoteDiagnostics, quotes, symbols, type Quote } from '@/db/schema';
import type { QuoteFailureReason } from './provider';

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
  /** Símbolo al que pertenece la cotización: la identidad, no el ticker (ADR-007). */
  symbolId: string;
  ticker: string;
  price: string;
  currency: string;
  asOf: Date;
  /**
   * Cuándo **escribió el ciclo** esta fila — no la fecha de mercado del precio, que es
   * `asOf`. Es el dato del que sale «cotización sin refrescar» (SPEC-043 CA-7, RN-16):
   * `asOf` se queda legítimamente en el viernes durante el fin de semana, mientras que
   * esto se mueve en todo ciclo con éxito porque el upsert reescribe la fila aunque el
   * precio no cambie. Ya estaba en la tabla; lo que faltaba era **exponerlo**, para que
   * las pantallas pudieran decidir sin volver a la base.
   */
  updatedAt: Date;
}

/**
 * Cotizaciones vigentes (una por símbolo) con su símbolo, ticker y `asOf` (CA-5, D-2).
 * Si `tickers` se pasa, limita a esos; sin argumento, devuelve todas.
 */
export async function getQuoteViews(db: Db, tickers?: string[]): Promise<QuoteView[]> {
  const base = db
    .select({
      symbolId: quotes.symbolId,
      ticker: symbols.ticker,
      price: quotes.price,
      currency: quotes.currency,
      asOf: quotes.asOf,
      updatedAt: quotes.updatedAt, // SPEC-043: una columna más en el select, ninguna en la base
    })
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
 * Mapa `symbolId` -> precio para alimentar el P/L actual de la cartera (CA-4, RN-06).
 * Formato que `portfolioSummary`/`listPositions` (SPEC-002) consumen.
 *
 * SPEC-025 CA-9: la clave es el SÍMBOLO, no el ticker. Indexando por ticker, dos
 * mercados del mismo valor (`SAN`@BMEX en EUR y `SAN`@XNYS en USD, ADR-012) colapsaban
 * en una sola entrada —ganaba el último— y las dos posiciones se valoraban con el
 * mismo precio: 165 € de error en el P/L actual sin que el usuario tocara nada.
 */
export async function getPriceMap(db: Db, tickers?: string[]): Promise<Record<string, string>> {
  const views = await getQuoteViews(db, tickers);
  const map: Record<string, string> = {};
  for (const v of views) map[v.symbolId] = v.price;
  return map;
}

// ── Diagnóstico del símbolo sin cotización (SPEC-016) ────────────────────────

/**
 * Registra POR QUÉ no se pudo cotizar un símbolo (CA-2). Upsert por `symbolId`: una fila
 * por símbolo con el último motivo y cuándo se intentó.
 */
export async function upsertDiagnostic(db: Db, symbolId: string, reason: QuoteFailureReason): Promise<void> {
  await db
    .insert(quoteDiagnostics)
    .values({ symbolId, reason, attemptedAt: new Date() })
    .onConflictDoUpdate({
      target: quoteDiagnostics.symbolId,
      set: { reason, attemptedAt: new Date() },
    });
}

/** Borra el diagnóstico de un símbolo al obtener precio (CA-8): sin avisos fantasma. */
export async function clearDiagnostic(db: Db, symbolId: string): Promise<void> {
  await db.delete(quoteDiagnostics).where(eq(quoteDiagnostics.symbolId, symbolId));
}

export interface DiagnosticView {
  symbolId: string;
  ticker: string;
  reason: QuoteFailureReason;
  attemptedAt: Date;
}

/**
 * Mapa `symbolId` -> diagnóstico vigente. La UI lo usa para distinguir "no se puede
 * cotizar y por qué" de "el ciclo aún no ha corrido" (CA-3): sin fila = nunca falló.
 *
 * SPEC-025 CA-10: indexado por SÍMBOLO. Por ticker, el motivo de un mercado aparecía
 * junto a la posición del otro — un motivo verdadero en la fila equivocada, que es un
 * fallo silencioso disfrazado de transparencia (CE-F2).
 */
export async function getDiagnosticMap(db: Db): Promise<Record<string, DiagnosticView>> {
  const rows = await db
    .select({
      symbolId: quoteDiagnostics.symbolId,
      ticker: symbols.ticker,
      reason: quoteDiagnostics.reason,
      attemptedAt: quoteDiagnostics.attemptedAt,
    })
    .from(quoteDiagnostics)
    .innerJoin(symbols, eq(quoteDiagnostics.symbolId, symbols.id));
  const map: Record<string, DiagnosticView> = {};
  for (const r of rows) {
    map[r.symbolId] = {
      symbolId: r.symbolId,
      ticker: r.ticker,
      reason: r.reason as QuoteFailureReason,
      attemptedAt: r.attemptedAt,
    };
  }
  return map;
}
