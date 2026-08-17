import { and, eq } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { watchedSymbols, symbols, type WatchedSymbol } from '@/db/schema';
import { findByIdForOwner } from '@/lib/data/ownership';
import { getOrCreateSymbol, type SymbolMarket } from '@/lib/portfolio/symbols';

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

/** Un id de acción vigilada solo puede ser un uuid; cualquier otra cosa no existe. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * CA-5 (SPEC-003) + SPEC-024: deja de vigilar la acción vigilada `watchedId`.
 * Devuelve true si borró algo.
 *
 * Se identifica por el **id de la acción vigilada**, no por ticker: la identidad del
 * símbolo es (ticker, micCode) (ADR-007), así que con el mismo ticker en dos mercados
 * resolver por ticker borraba la fila equivocada — o ninguna, en silencio (CA-10).
 *
 * El `userId` viaja DENTRO del `DELETE` (CA-11, RN-01): el aislamiento no depende de que
 * la UI mande el id correcto ni de una comprobación previa que un refactor pueda saltarse.
 * Un id ajeno devuelve false igual que un id inexistente: no se revela que exista.
 *
 * La baja arrastra los episodios de zona y deja sus avisos huérfanos **a propósito**
 * (ADR-017): la cascada y el `set null` viven en las FKs (`src/db/schema.ts`), no aquí.
 * Que este método sea un DELETE pelado es la decisión, no un olvido — no lo "arregles"
 * añadiendo borrados explícitos.
 */
export async function unwatch(db: Db, userId: string, watchedId: string): Promise<boolean> {
  // CA-12: un campo vacío o manipulado no es una excepción, es "no existe".
  if (!UUID.test(watchedId?.trim() ?? '')) return false;
  const deleted = await db
    .delete(watchedSymbols)
    .where(and(eq(watchedSymbols.id, watchedId.trim()), eq(watchedSymbols.userId, userId)))
    .returning();
  return deleted.length > 0;
}
