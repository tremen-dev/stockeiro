import { and, eq, isNull } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { symbols, type Symbol } from '@/db/schema';

type Db = PgDatabase<any, any, any>;

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/**
 * Identidad de mercado de un símbolo (ADR-007). Cuando el usuario elige un
 * candidato del buscador (SPEC-008), llega el `micCode` (y metadatos); cuando no
 * (camino legacy / operaciones sobre posición ya existente), va `undefined` y la
 * identidad recae solo en el `ticker`.
 */
export interface SymbolMarket {
  micCode: string;
  exchange?: string | null;
  name?: string | null;
}

/**
 * Busca un símbolo por ticker (normalizado); null si no existe. Camino legacy:
 * cuando no se conoce el mercado, resuelve por ticker devolviendo la primera
 * coincidencia. Con varios mercados para un mismo ticker, usa `getSymbolByMarket`.
 */
export async function getSymbolByTicker(db: Db, ticker: string): Promise<Symbol | null> {
  const [s] = await db.select().from(symbols).where(eq(symbols.ticker, normalizeTicker(ticker))).limit(1);
  return s ?? null;
}

/** Busca un símbolo por su identidad de mercado (ticker, micCode); null si no existe. */
export async function getSymbolByMarket(db: Db, ticker: string, micCode: string): Promise<Symbol | null> {
  const [s] = await db
    .select()
    .from(symbols)
    .where(and(eq(symbols.ticker, normalizeTicker(ticker)), eq(symbols.micCode, micCode)))
    .limit(1);
  return s ?? null;
}

/**
 * Devuelve el símbolo, creándolo si no existe (ADR-002/ADR-007). El registro es
 * COMPARTIDO: un único símbolo por identidad sirve a todos los usuarios.
 *
 * - Con `market` (búsqueda): identidad = (ticker, micCode). Dos mercados del mismo
 *   ticker son símbolos DISTINTOS (CA-3/CA-5); guarda exchange/name para mostrar.
 * - Sin `market` (legacy): identidad = ticker con micCode NULL; deduplica por
 *   ticker entre las filas legacy para no crear duplicados.
 */
export async function getOrCreateSymbol(
  db: Db,
  ticker: string,
  currency: string,
  market?: SymbolMarket,
): Promise<Symbol> {
  const t = normalizeTicker(ticker);

  if (market) {
    const existing = await getSymbolByMarket(db, t, market.micCode);
    if (existing) return existing;
    const [created] = await db
      .insert(symbols)
      .values({
        ticker: t,
        micCode: market.micCode,
        exchange: market.exchange ?? null,
        name: market.name ?? null,
        currency,
      })
      .returning();
    return created;
  }

  // Legacy: deduplica por ticker entre las filas sin mercado (micCode NULL).
  const [existing] = await db
    .select()
    .from(symbols)
    .where(and(eq(symbols.ticker, t), isNull(symbols.micCode)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(symbols).values({ ticker: t, currency }).returning();
  return created;
}
