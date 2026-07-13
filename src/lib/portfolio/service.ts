import { and, eq } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { transactions, symbols, type Transaction } from '@/db/schema';
import { findByIdForOwner } from '@/lib/data/ownership';
import {
  computePosition,
  costeMedio,
  plActual,
  OversellError,
  type LedgerEntry,
} from './position';
import { getOrCreateSymbol, getSymbolByTicker } from './symbols';

type Db = PgDatabase<any, any, any>;

/** Se lanza al operar (vender/split/dividendo) sobre un símbolo sin posición. */
export class NoPositionError extends Error {
  constructor(ticker: string) {
    super(`No tienes posición en ${ticker}.`);
    this.name = 'NoPositionError';
  }
}

function toEntries(rows: Transaction[]): LedgerEntry[] {
  return rows.map((r, i) => ({
    type: r.type as LedgerEntry['type'],
    occurredOn: r.occurredOn,
    quantity: r.quantity,
    price: r.price,
    gastos: r.gastos,
    ratio: r.ratio,
    amount: r.amount,
    seq: i, // filas ya vienen ordenadas por (occurredOn, createdAt, id)
  }));
}

async function ownedEntries(db: Db, userId: string, symbolId: string): Promise<LedgerEntry[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.symbolId, symbolId)))
    .orderBy(transactions.occurredOn, transactions.createdAt, transactions.id);
  return toEntries(rows);
}

function str(v: Decimal.Value | null | undefined): string | null {
  return v === null || v === undefined ? null : new Decimal(v).toString();
}

export interface BuySellInput {
  quantity: Decimal.Value;
  price: Decimal.Value;
  gastos?: Decimal.Value | null;
  occurredOn: string;
}

/** CA-1/CA-2: registra una compra (crea el símbolo si hace falta, ADR-002). */
export async function recordBuy(
  db: Db,
  userId: string,
  ticker: string,
  currency: string,
  input: BuySellInput,
): Promise<Transaction> {
  const sym = await getOrCreateSymbol(db, ticker, currency);
  const [txn] = await db
    .insert(transactions)
    .values({
      userId,
      symbolId: sym.id,
      type: 'buy',
      occurredOn: input.occurredOn,
      quantity: str(input.quantity),
      price: str(input.price),
      gastos: str(input.gastos),
    })
    .returning();
  return txn;
}

/**
 * CA-3/CA-4: registra una venta. CA-5/RN-08: rechaza (OversellError) si la
 * cantidad supera la viva, SIN insertar nada.
 */
export async function recordSell(
  db: Db,
  userId: string,
  ticker: string,
  input: BuySellInput,
): Promise<Transaction> {
  const sym = await getSymbolByTicker(db, ticker);
  if (!sym) throw new NoPositionError(ticker);
  const pos = computePosition(await ownedEntries(db, userId, sym.id));
  if (new Decimal(input.quantity).gt(pos.cantidadViva)) {
    throw new OversellError(pos.cantidadViva, new Decimal(input.quantity));
  }
  const [txn] = await db
    .insert(transactions)
    .values({
      userId,
      symbolId: sym.id,
      type: 'sell',
      occurredOn: input.occurredOn,
      quantity: str(input.quantity),
      price: str(input.price),
      gastos: str(input.gastos),
    })
    .returning();
  return txn;
}

/** CA-7: registra un split (evento manual en v1). */
export async function recordSplit(
  db: Db,
  userId: string,
  ticker: string,
  ratio: Decimal.Value,
  occurredOn: string,
): Promise<Transaction> {
  const sym = await getSymbolByTicker(db, ticker);
  if (!sym) throw new NoPositionError(ticker);
  const [txn] = await db
    .insert(transactions)
    .values({ userId, symbolId: sym.id, type: 'split', occurredOn, ratio: str(ratio) })
    .returning();
  return txn;
}

/** CA-8: registra un dividendo cobrado (evento manual en v1). */
export async function recordDividend(
  db: Db,
  userId: string,
  ticker: string,
  amount: Decimal.Value,
  occurredOn: string,
): Promise<Transaction> {
  const sym = await getSymbolByTicker(db, ticker);
  if (!sym) throw new NoPositionError(ticker);
  const [txn] = await db
    .insert(transactions)
    .values({ userId, symbolId: sym.id, type: 'dividend', occurredOn, amount: str(amount) })
    .returning();
  return txn;
}

export interface PositionView {
  ticker: string;
  currency: string;
  cantidadViva: string;
  costeMedio: string | null;
  realizadoPL: string;
  /** P/L actual con el precio dado; null = "sin dato" (RN-06/D-6). */
  plActual: string | null;
  isOpen: boolean;
}

/**
 * CA-10: lista las posiciones del usuario (SOLO las suyas, filtrado por userId).
 * `priceByTicker` aporta precios de mercado; sin precio, plActual = null.
 */
export async function listPositions(
  db: Db,
  userId: string,
  priceByTicker: Record<string, Decimal.Value> = {},
): Promise<PositionView[]> {
  const rows = await db
    .select({ txn: transactions, sym: symbols })
    .from(transactions)
    .innerJoin(symbols, eq(transactions.symbolId, symbols.id))
    .where(eq(transactions.userId, userId))
    .orderBy(transactions.occurredOn, transactions.createdAt, transactions.id);

  const bySymbol = new Map<string, { ticker: string; currency: string; txns: Transaction[] }>();
  for (const { txn, sym } of rows) {
    const g = bySymbol.get(sym.id) ?? { ticker: sym.ticker, currency: sym.currency, txns: [] };
    g.txns.push(txn);
    bySymbol.set(sym.id, g);
  }

  const views: PositionView[] = [];
  for (const { ticker, currency, txns } of bySymbol.values()) {
    const pos = computePosition(toEntries(txns));
    const price = priceByTicker[ticker] ?? null;
    const cm = costeMedio(pos);
    const actual = plActual(pos, price);
    views.push({
      ticker,
      currency,
      cantidadViva: pos.cantidadViva.toString(),
      costeMedio: cm ? cm.toString() : null,
      realizadoPL: pos.realizadoPL.toString(),
      plActual: actual ? actual.toString() : null,
      isOpen: pos.isOpen,
    });
  }
  return views;
}

export interface PortfolioSummary {
  realizadoTotal: string;
  /** Total de P/L actual con los precios disponibles; null si no hay ninguno (RN-06/D-6). */
  actualTotal: string | null;
  positions: PositionView[];
}

/**
 * CA-9: resumen de cartera que mantiene SEPARADOS realizado y actual (D-6),
 * nunca sumados en una sola cifra.
 */
export async function portfolioSummary(
  db: Db,
  userId: string,
  priceByTicker: Record<string, Decimal.Value> = {},
): Promise<PortfolioSummary> {
  const positions = await listPositions(db, userId, priceByTicker);
  const realizadoTotal = positions.reduce((acc, p) => acc.plus(p.realizadoPL), new Decimal(0));
  const priced = positions.filter((p) => p.plActual !== null);
  const actualTotal = priced.length
    ? priced.reduce((acc, p) => acc.plus(p.plActual as string), new Decimal(0))
    : null;
  return {
    realizadoTotal: realizadoTotal.toString(),
    actualTotal: actualTotal ? actualTotal.toString() : null,
    positions,
  };
}

/** CA-10: acceso a una transacción por id SOLO si es del usuario (aislamiento RN-01). */
export function getTransactionForOwner(db: Db, id: string, userId: string) {
  return findByIdForOwner(db, transactions, id, userId);
}
