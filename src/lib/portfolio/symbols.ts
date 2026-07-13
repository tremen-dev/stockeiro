import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { symbols, type Symbol } from '@/db/schema';

type Db = PgDatabase<any, any, any>;

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/** Busca un símbolo por ticker (normalizado); null si no existe. */
export async function getSymbolByTicker(db: Db, ticker: string): Promise<Symbol | null> {
  const [s] = await db.select().from(symbols).where(eq(symbols.ticker, normalizeTicker(ticker))).limit(1);
  return s ?? null;
}

/**
 * Devuelve el símbolo del ticker, creándolo si no existe (ADR-002, CA-11).
 * El registro es COMPARTIDO: un único símbolo por ticker sirve a todos los usuarios.
 */
export async function getOrCreateSymbol(db: Db, ticker: string, currency: string): Promise<Symbol> {
  const existing = await getSymbolByTicker(db, ticker);
  if (existing) return existing;
  const [created] = await db
    .insert(symbols)
    .values({ ticker: normalizeTicker(ticker), currency })
    .returning();
  return created;
}
