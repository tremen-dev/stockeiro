import { and, eq, isNull } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { zoneTriggers, watchedSymbols, symbols, quotes, type ZoneTrigger } from '@/db/schema';
import { entraEnZona, type Zona } from '@/lib/watchlist/zones';
import { findByIdForOwner } from '@/lib/data/ownership';

type Db = PgDatabase<any, any, any>;

export type ZoneKind = 'buy' | 'sell';
const ZONE_KINDS: ZoneKind[] = ['buy', 'sell'];

export interface TriggerView {
  id: string;
  userId: string;
  watchedSymbolId: string;
  symbolId: string;
  ticker: string;
  zoneKind: ZoneKind;
  price: string;
  asOf: Date;
  openedAt: Date;
  closedAt: Date | null;
}

export interface EvaluationResult {
  /** Episodios ABIERTOS en esta evaluación (entradas del ciclo) → aviso individual. */
  opened: TriggerView[];
  /** Episodios CERRADos en esta evaluación (salidas del ciclo). */
  closed: TriggerView[];
}

function toView(t: ZoneTrigger, ticker: string): TriggerView {
  return {
    id: t.id,
    userId: t.userId,
    watchedSymbolId: t.watchedSymbolId,
    symbolId: t.symbolId,
    ticker,
    zoneKind: t.zoneKind as ZoneKind,
    price: t.price,
    asOf: t.asOf,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
  };
}

/** Zona [min,max] de un tipo dado, o null si el par está incompleto (RN-10). */
function zonaOf(kind: ZoneKind, row: { buyMin: string | null; buyMax: string | null; sellMin: string | null; sellMax: string | null }): Zona | null {
  const min = kind === 'buy' ? row.buyMin : row.sellMin;
  const max = kind === 'buy' ? row.buyMax : row.sellMax;
  return min != null && max != null ? { min, max } : null;
}

/**
 * Motor de disparo (ADR-005, RN-13). Por cada acción vigilada CON cotización, evalúa
 * sus zonas contra el último precio no ajustado (RN-11/RN-12) y mantiene un episodio
 * edge-triggered por (acción vigilada, tipo de zona):
 *  - entra en zona y no hay episodio abierto → ABRE (disparo).
 *  - sale de zona y hay episodio abierto → CIERRA.
 *  - sigue dentro/fuera → no-op (idempotente).
 * Un símbolo sin cotización ese ciclo (join interno con `quotes`) NO se evalúa (CA-7).
 */
export async function evaluateTriggers(db: Db): Promise<EvaluationResult> {
  const candidates = await db
    .select({
      watchedSymbolId: watchedSymbols.id,
      userId: watchedSymbols.userId,
      symbolId: watchedSymbols.symbolId,
      ticker: symbols.ticker,
      buyMin: watchedSymbols.buyMin,
      buyMax: watchedSymbols.buyMax,
      sellMin: watchedSymbols.sellMin,
      sellMax: watchedSymbols.sellMax,
      price: quotes.price,
      asOf: quotes.asOf,
    })
    .from(watchedSymbols)
    .innerJoin(symbols, eq(watchedSymbols.symbolId, symbols.id))
    .innerJoin(quotes, eq(quotes.symbolId, symbols.id)); // solo con cotización (CA-7)

  // Episodios abiertos actuales, indexados por (watchedSymbolId, zoneKind).
  const openRows = await db.select().from(zoneTriggers).where(isNull(zoneTriggers.closedAt));
  const openBy = new Map<string, ZoneTrigger>();
  for (const t of openRows) openBy.set(`${t.watchedSymbolId}:${t.zoneKind}`, t);

  const opened: TriggerView[] = [];
  const closed: TriggerView[] = [];

  for (const c of candidates) {
    for (const kind of ZONE_KINDS) {
      const inZone = entraEnZona(c.price, zonaOf(kind, c));
      const episode = openBy.get(`${c.watchedSymbolId}:${kind}`);
      if (inZone && !episode) {
        const [ins] = await db
          .insert(zoneTriggers)
          .values({
            userId: c.userId,
            watchedSymbolId: c.watchedSymbolId,
            symbolId: c.symbolId,
            zoneKind: kind,
            price: c.price,
            asOf: c.asOf,
          })
          .returning();
        opened.push(toView(ins, c.ticker));
      } else if (!inZone && episode) {
        const [upd] = await db
          .update(zoneTriggers)
          .set({ closedAt: c.asOf })
          .where(eq(zoneTriggers.id, episode.id))
          .returning();
        closed.push(toView(upd, c.ticker));
      }
    }
  }

  return { opened, closed };
}

/**
 * CA-10(b): acciones que PERMANECEN en zona (episodios abiertos) de un usuario, para
 * el aviso agregado de permanencia. Filtrado por `userId` (RN-01).
 */
export async function openTriggersForUser(db: Db, userId: string): Promise<TriggerView[]> {
  const rows = await db
    .select({ t: zoneTriggers, ticker: symbols.ticker })
    .from(zoneTriggers)
    .innerJoin(symbols, eq(zoneTriggers.symbolId, symbols.id))
    .where(and(eq(zoneTriggers.userId, userId), isNull(zoneTriggers.closedAt)))
    .orderBy(symbols.ticker);
  return rows.map(({ t, ticker }) => toView(t, ticker));
}

/** Log completo de disparos de un usuario (abiertos y cerrados), SOLO suyos (RN-01). */
export async function listTriggersForUser(db: Db, userId: string): Promise<TriggerView[]> {
  const rows = await db
    .select({ t: zoneTriggers, ticker: symbols.ticker })
    .from(zoneTriggers)
    .innerJoin(symbols, eq(zoneTriggers.symbolId, symbols.id))
    .where(eq(zoneTriggers.userId, userId))
    .orderBy(zoneTriggers.openedAt);
  return rows.map(({ t, ticker }) => toView(t, ticker));
}

/** CA-8: acceso a un disparo por id SOLO si es del usuario (aislamiento RN-01). */
export function getTriggerForOwner(db: Db, id: string, userId: string) {
  return findByIdForOwner(db, zoneTriggers, id, userId);
}
