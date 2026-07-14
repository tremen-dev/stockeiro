import { and, eq } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { watchedSymbols, symbols, type WatchedSymbol } from '@/db/schema';
import { findByIdForOwner } from '@/lib/data/ownership';
import { getOrCreateSymbol, getSymbolByTicker, type SymbolMarket } from '@/lib/portfolio/symbols';

type Db = PgDatabase<any, any, any>;

/** Zona [min,max] inválida: par incompleto o min > max (RN-10, CA-3). */
export class InvalidZoneError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'InvalidZoneError';
  }
}

export interface WatchInput {
  buyMin?: Decimal.Value | null;
  buyMax?: Decimal.Value | null;
  sellMin?: Decimal.Value | null;
  sellMax?: Decimal.Value | null;
}

function has(v: Decimal.Value | null | undefined): boolean {
  return v !== null && v !== undefined && `${v}`.trim() !== '';
}

function str(v: Decimal.Value | null | undefined): string | null {
  return has(v) ? new Decimal(v as Decimal.Value).toString() : null;
}

/** Valida un par de zona: ambos presentes con min ≤ max, o ambos ausentes (RN-10). */
function validatePair(min: Decimal.Value | null | undefined, max: Decimal.Value | null | undefined, label: string) {
  if (has(min) !== has(max)) {
    throw new InvalidZoneError(`Zona de ${label} incompleta: define el mínimo y el máximo.`);
  }
  if (has(min) && new Decimal(min as Decimal.Value).gt(new Decimal(max as Decimal.Value))) {
    throw new InvalidZoneError(`Zona de ${label}: el mínimo no puede ser mayor que el máximo.`);
  }
}

/**
 * CA-1/CA-2/CA-4/CA-10 (SPEC-003): vigila un ticker con zonas opcionales. Crea el
 * símbolo compartido si hace falta (ADR-002). Upsert por (userId, symbolId): si ya
 * se vigila, ACTUALIZA sus zonas en vez de duplicar.
 *
 * Con `market` (SPEC-008/ADR-007): la identidad del símbolo es (ticker, micCode) y
 * la divisa la fija el candidato elegido; sin él, camino legacy por ticker.
 */
export async function watchSymbol(
  db: Db,
  userId: string,
  ticker: string,
  currency: string,
  zones: WatchInput = {},
  market?: SymbolMarket,
): Promise<WatchedSymbol> {
  validatePair(zones.buyMin, zones.buyMax, 'compra');
  validatePair(zones.sellMin, zones.sellMax, 'venta');

  const sym = await getOrCreateSymbol(db, ticker, currency, market);
  const values = {
    buyMin: str(zones.buyMin),
    buyMax: str(zones.buyMax),
    sellMin: str(zones.sellMin),
    sellMax: str(zones.sellMax),
  };

  const [existing] = await db
    .select()
    .from(watchedSymbols)
    .where(and(eq(watchedSymbols.userId, userId), eq(watchedSymbols.symbolId, sym.id)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(watchedSymbols)
      .set(values)
      .where(eq(watchedSymbols.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(watchedSymbols)
    .values({ userId, symbolId: sym.id, ...values })
    .returning();
  return created;
}

export interface WatchedView {
  id: string;
  ticker: string;
  currency: string;
  buyMin: string | null;
  buyMax: string | null;
  sellMin: string | null;
  sellMax: string | null;
}

/** CA-9: lista las acciones vigiladas del usuario (SOLO las suyas, por userId). */
export async function listWatched(db: Db, userId: string): Promise<WatchedView[]> {
  const rows = await db
    .select({ w: watchedSymbols, s: symbols })
    .from(watchedSymbols)
    .innerJoin(symbols, eq(watchedSymbols.symbolId, symbols.id))
    .where(eq(watchedSymbols.userId, userId))
    .orderBy(symbols.ticker);
  return rows.map(({ w, s }) => ({
    id: w.id,
    ticker: s.ticker,
    currency: s.currency,
    buyMin: w.buyMin,
    buyMax: w.buyMax,
    sellMin: w.sellMin,
    sellMax: w.sellMax,
  }));
}

/** CA-9: acceso a una acción vigilada por id SOLO si es del usuario (RN-01). */
export function getWatchedForOwner(db: Db, id: string, userId: string) {
  return findByIdForOwner(db, watchedSymbols, id, userId);
}

/** CA-5: deja de vigilar un ticker. Devuelve true si borró algo. */
export async function unwatch(db: Db, userId: string, ticker: string): Promise<boolean> {
  const sym = await getSymbolByTicker(db, ticker);
  if (!sym) return false;
  const deleted = await db
    .delete(watchedSymbols)
    .where(and(eq(watchedSymbols.userId, userId), eq(watchedSymbols.symbolId, sym.id)))
    .returning();
  return deleted.length > 0;
}
