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
  type Position,
} from './position';
import { moneyStr } from './money';
import { getOrCreateSymbol, type SymbolMarket } from './symbols';

type Db = PgDatabase<any, any, any>;

/** Se lanza al operar (vender/split/dividendo) sobre un símbolo sin posición. */
export class NoPositionError extends Error {
  constructor(symbolId: string) {
    super(`No tienes posición en ${symbolId}.`);
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

/**
 * CA-1/CA-2 (SPEC-002): registra una compra (crea el símbolo si hace falta, ADR-002).
 * Con `market` (SPEC-008/ADR-007): identidad (ticker, micCode) y divisa del candidato.
 */
export async function recordBuy(
  db: Db,
  userId: string,
  ticker: string,
  currency: string,
  input: BuySellInput,
  market?: SymbolMarket,
): Promise<Transaction> {
  const sym = await getOrCreateSymbol(db, ticker, currency, market);
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
 * Ledger del usuario sobre ESE símbolo (SPEC-025 CA-6). El `userId` viaja DENTRO de
 * la consulta (`ownedEntries`), no en una guardia previa: sin filas, el usuario no
 * tiene posición ahí y no se escribe nada — da igual que el símbolo exista y sea de
 * otro (el registro de símbolos es compartido, ADR-002).
 */
async function positionOf(db: Db, userId: string, symbolId: string) {
  const entries = await ownedEntries(db, userId, symbolId);
  if (entries.length === 0) throw new NoPositionError(symbolId);
  return computePosition(entries);
}

/**
 * CA-3/CA-4: registra una venta. CA-5/RN-08: rechaza (OversellError) si la
 * cantidad supera la viva, SIN insertar nada.
 *
 * SPEC-025 CA-1: la posición se identifica por `symbolId` (ADR-007), no por ticker:
 * el mismo ticker en dos mercados son dos posiciones distintas, con distinta divisa
 * (RN-09), y solo el `symbolId` dice cuál de las dos se está vendiendo.
 */
export async function recordSell(
  db: Db,
  userId: string,
  symbolId: string,
  input: BuySellInput,
): Promise<Transaction> {
  const pos = await positionOf(db, userId, symbolId);
  if (new Decimal(input.quantity).gt(pos.cantidadViva)) {
    throw new OversellError(pos.cantidadViva, new Decimal(input.quantity));
  }
  const [txn] = await db
    .insert(transactions)
    .values({
      userId,
      symbolId,
      type: 'sell',
      occurredOn: input.occurredOn,
      quantity: str(input.quantity),
      price: str(input.price),
      gastos: str(input.gastos),
    })
    .returning();
  return txn;
}

/** CA-7: registra un split (evento manual en v1) sobre la posición señalada (RN-07). */
export async function recordSplit(
  db: Db,
  userId: string,
  symbolId: string,
  ratio: Decimal.Value,
  occurredOn: string,
): Promise<Transaction> {
  await positionOf(db, userId, symbolId);
  const [txn] = await db
    .insert(transactions)
    .values({ userId, symbolId, type: 'split', occurredOn, ratio: str(ratio) })
    .returning();
  return txn;
}

/** CA-8: registra un dividendo cobrado sobre la posición señalada (RN-05). */
export async function recordDividend(
  db: Db,
  userId: string,
  symbolId: string,
  amount: Decimal.Value,
  occurredOn: string,
): Promise<Transaction> {
  await positionOf(db, userId, symbolId);
  const [txn] = await db
    .insert(transactions)
    .values({ userId, symbolId, type: 'dividend', occurredOn, amount: str(amount) })
    .returning();
  return txn;
}

export interface PositionView {
  /** Identidad de la posición (ADR-007): con ella se vende, se divide y se cobra. */
  symbolId: string;
  ticker: string;
  /** MIC del mercado; null en los símbolos legacy anteriores a ADR-007 (CA-7). */
  micCode: string | null;
  exchange: string | null;
  currency: string;
  cantidadViva: string;
  costeMedio: string | null;
  realizadoPL: string;
  /** P/L actual con el precio dado; null = "sin dato" (RN-06/D-6). */
  plActual: string | null;
  isOpen: boolean;
}

interface SymbolIdentity {
  symbolId: string;
  ticker: string;
  micCode: string | null;
  exchange: string | null;
  currency: string;
}

interface RawPosition extends SymbolIdentity {
  pos: Position;
  /** P/L actual en Decimal (precisión completa); null = "sin dato". */
  plActualRaw: Decimal | null;
}

/** Deriva las posiciones del usuario en precisión COMPLETA (sin redondear todavía). */
async function rawPositions(
  db: Db,
  userId: string,
  priceBySymbolId: Record<string, Decimal.Value>,
): Promise<RawPosition[]> {
  const rows = await db
    .select({ txn: transactions, sym: symbols })
    .from(transactions)
    .innerJoin(symbols, eq(transactions.symbolId, symbols.id))
    .where(eq(transactions.userId, userId))
    .orderBy(transactions.occurredOn, transactions.createdAt, transactions.id);

  const bySymbol = new Map<string, SymbolIdentity & { txns: Transaction[] }>();
  for (const { txn, sym } of rows) {
    const g = bySymbol.get(sym.id) ?? {
      symbolId: sym.id,
      ticker: sym.ticker,
      micCode: sym.micCode,
      exchange: sym.exchange,
      currency: sym.currency,
      txns: [] as Transaction[],
    };
    g.txns.push(txn);
    bySymbol.set(sym.id, g);
  }

  const out: RawPosition[] = [];
  for (const { txns, ...id } of bySymbol.values()) {
    const pos = computePosition(toEntries(txns));
    // SPEC-025 CA-9: el precio se busca por SÍMBOLO. Por ticker, dos mercados del
    // mismo valor recibían el mismo precio (y una de las dos, de otra divisa).
    const price = priceBySymbolId[id.symbolId] ?? null;
    out.push({ ...id, pos, plActualRaw: plActual(pos, price) });
  }
  return out;
}

function toView(raw: RawPosition): PositionView {
  const cm = costeMedio(raw.pos);
  return {
    symbolId: raw.symbolId,
    ticker: raw.ticker,
    micCode: raw.micCode,
    exchange: raw.exchange,
    currency: raw.currency,
    cantidadViva: raw.pos.cantidadViva.toString(), // cantidad, no importe monetario
    costeMedio: cm ? moneyStr(cm) : null,
    realizadoPL: moneyStr(raw.pos.realizadoPL),
    plActual: raw.plActualRaw ? moneyStr(raw.plActualRaw) : null,
    isOpen: raw.pos.isOpen,
  };
}

/**
 * CA-10: lista las posiciones del usuario (SOLO las suyas, filtrado por userId).
 * Importes redondeados a la unidad monetaria (SPEC-002). `priceBySymbolId` aporta
 * precios (SPEC-025 CA-9); sin precio, plActual = null.
 */
export async function listPositions(
  db: Db,
  userId: string,
  priceBySymbolId: Record<string, Decimal.Value> = {},
): Promise<PositionView[]> {
  const raws = await rawPositions(db, userId, priceBySymbolId);
  return raws.map(toView);
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
  priceBySymbolId: Record<string, Decimal.Value> = {},
): Promise<PortfolioSummary> {
  const raws = await rawPositions(db, userId, priceBySymbolId);
  // Totales sumados en precisión COMPLETA y redondeados al final (no suma de redondeos).
  const realizadoTotal = raws.reduce((acc, r) => acc.plus(r.pos.realizadoPL), new Decimal(0));
  const priced = raws.filter((r) => r.plActualRaw !== null);
  const actualTotal = priced.length
    ? priced.reduce((acc, r) => acc.plus(r.plActualRaw as Decimal), new Decimal(0))
    : null;
  return {
    realizadoTotal: moneyStr(realizadoTotal),
    actualTotal: actualTotal ? moneyStr(actualTotal) : null,
    positions: raws.map(toView),
  };
}

/** CA-10: acceso a una transacción por id SOLO si es del usuario (aislamiento RN-01). */
export function getTransactionForOwner(db: Db, id: string, userId: string) {
  return findByIdForOwner(db, transactions, id, userId);
}
