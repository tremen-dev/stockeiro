import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { symbols } from '@/db/schema';

/**
 * Helper de TEST (no es una suite): traduce ticker -> `symbols.id`, que es la
 * identidad con la que operan la cartera y las cotizaciones desde SPEC-025.
 *
 * Exige coincidencia ÚNICA a propósito: si un ticker vive en dos mercados hay que
 * decir cuál (`micCode`). Es justo la ambigüedad que `getSymbolByTicker` resolvía
 * con un `limit(1)` silencioso, y que aquí preferimos que explote.
 */
export async function symbolId(
  db: PgDatabase<any, any, any>,
  ticker: string,
  micCode?: string,
): Promise<string> {
  const t = ticker.trim().toUpperCase();
  const rows = await db
    .select()
    .from(symbols)
    .where(micCode ? and(eq(symbols.ticker, t), eq(symbols.micCode, micCode)) : eq(symbols.ticker, t));
  if (rows.length !== 1) {
    throw new Error(`symbolId(${t}${micCode ? `@${micCode}` : ''}): ${rows.length} coincidencias, se esperaba 1`);
  }
  return rows[0].id;
}
