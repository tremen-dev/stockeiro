import { count, inArray } from 'drizzle-orm';
import { union, type PgDatabase } from 'drizzle-orm/pg-core';
import { symbols, transactions, watchedSymbols } from '@/db/schema';
import { quoteKey, type MarketDataProvider, type QuoteFailureReason, type QuotesResult } from './provider';
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

/**
 * CUÁNTOS símbolos tiene ese universo, sin traérselos (SPEC-037 CA-13/CA-23).
 *
 * Vive AQUÍ, pegada a `symbolUniverse`, y no en la pantalla de operación, porque el
 * proyecto no puede tener dos definiciones de «universo del ciclo»: la de lo que se
 * cotiza y la de lo que se cuenta. Si mañana el universo deja de ser
 * `watched_symbols ∪ transactions`, las dos funciones se cambian a la vez y el mismo
 * test las compara — `tests/ops-snapshot.test.ts` exige que este número sea siempre
 * `(await symbolUniverse(db)).length`.
 *
 * Es una AGREGACIÓN y no un `length` de la otra: la pantalla de operación tiene que
 * responder deprisa porque pregunta poco (CE-7), y traerse cinco mil filas para
 * contarlas es justo lo contrario. El `UNION` (no `UNION ALL`) hace el dedupe en la
 * base, igual que el `Set` de arriba lo hace en memoria.
 */
export async function countUniverseSymbols(db: Db): Promise<number> {
  const universo = union(
    db.selectDistinct({ symbolId: watchedSymbols.symbolId }).from(watchedSymbols),
    db.selectDistinct({ symbolId: transactions.symbolId }).from(transactions),
  ).as('universo');
  const [fila] = await db.select({ n: count() }).from(universo);
  return Number(fila?.n ?? 0);
}

/** Un símbolo que no se pudo cotizar, con su motivo clasificado (SPEC-016). */
export interface SkippedSymbol {
  ticker: string;
  reason: QuoteFailureReason;
}

/**
 * Un precio que SÍ se asignó aunque el proveedor etiquetara la fila con otro mercado del
 * mismo grupo equivalente (SPEC-021 CA-8, ADR-014). No es un fallo y **no se le muestra al
 * usuario**: para él hay precio y no hay diagnóstico. Es constancia para el OPERADOR, en
 * el canal que ya existe —el resultado del ciclo, que viaja entero al cuerpo del cron—,
 * sin tabla nueva, sin telemetría y sin tocar `quote_diagnostics`, que es el canal de "no
 * hay precio" y aquí sí lo hay. Si el proveedor empezara a etiquetar mal en masa, se ve
 * aquí y no en el P/L de un usuario.
 */
export interface MarketLabelMismatch {
  ticker: string;
  /** Operating MIC del símbolo: el que se pidió y el ÚNICO que se persiste (ADR-007). */
  requestedMicCode: string | null;
  /** Mercado con el que el proveedor etiquetó la fila (del mismo grupo equivalente). */
  providerMicCode: string;
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
  /** Precios asignados con etiqueta de mercado discrepante (SPEC-021 CA-8). */
  mismatched: MarketLabelMismatch[];
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
  if (universe.length === 0) return { requested, updated: [], skipped: [], mismatched: [] };

  // Se pide por (ticker, micCode) para desambiguar el mercado (ADR-007). El universo
  // ya es distinct por símbolo, así que no hay duplicados (dedupe, ADR-002).
  const requests = universe.map((u) => ({ ticker: u.ticker, micCode: u.micCode }));

  // Defensa en profundidad (SPEC-020 CA-9). El contrato del puerto dice que `getQuotes`
  // NO lanza (CA-6 de SPEC-004): informa el fallo por símbolo. Pero si un adaptador se
  // porta mal —excepción inesperada, API key ausente, error de red no contemplado— el
  // ciclo NO puede morir: sin refresco no hay evaluación de disparos (SPEC-005) ni avisos
  // (SPEC-006) para NINGÚN usuario ese día. Un adaptador roto degrada a "el proveedor no
  // respondió", que es exactamente lo que ha pasado.
  let resultado: QuotesResult;
  try {
    resultado = await provider.getQuotes(requests);
  } catch {
    resultado = {
      quotes: [],
      failures: requests.map((r) => ({ ticker: r.ticker, micCode: r.micCode, reason: 'proveedor_no_disponible' as const })),
    };
  }

  const returned = new Map(resultado.quotes.map((q) => [quoteKey(q.ticker, q.micCode), q]));
  const failed = new Map(resultado.failures.map((f) => [quoteKey(f.ticker, f.micCode), f.reason]));

  const updated: string[] = [];
  const skipped: SkippedSymbol[] = [];
  const mismatched: MarketLabelMismatch[] = [];
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
    // El proveedor etiquetó la fila con otro mercado del grupo equivalente (SPEC-021).
    // El precio se persiste igual, con el mercado y la divisa DEL SÍMBOLO; aquí solo queda
    // la constancia para el operador.
    if (q.providerMicCode) {
      mismatched.push({ ticker: u.ticker, requestedMicCode: u.micCode, providerMicCode: q.providerMicCode });
    }
  }
  return { requested, updated, skipped, mismatched };
}
