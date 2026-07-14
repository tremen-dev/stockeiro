import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { transactions, symbols } from '@/db/schema';
import { type LedgerEntry } from '@/lib/portfolio/position';
import type { OperacionImportada } from './statement-reader';

/**
 * Registro idempotente del import en el ledger (SPEC-013, ADR-010/ADR-011). Toma las
 * operaciones YA resueltas a símbolo (SPEC-012) y las escribe como transacciones
 * `buy`/`sell` (ADR-003), sin duplicar en re-imports. Previsualiza antes de escribir
 * (nada se escribe hasta confirmar) y avisa de sobreventa (RN-08) en vez de crear una
 * posición imposible. No lee el fichero (SPEC-011) ni resuelve identidad (SPEC-012).
 */
type Db = PgDatabase<any, any, any>;

/** Una operación del extracto ya resuelta a un símbolo canónico (salida de SPEC-012). */
export interface OperacionResuelta {
  op: OperacionImportada;
  symbolId: string;
}

interface Candidato extends OperacionResuelta {
  importKey: string;
}

export interface ImportPreview {
  /** Operaciones nuevas que se crearían al confirmar. */
  aCrear: Candidato[];
  /** Operaciones ya presentes (mismo importKey): se saltan (idempotencia, CA-4). */
  aSaltar: OperacionResuelta[];
  /** Operaciones de valores sin resolver: no se escriben (CA-10). */
  pendientes: OperacionImportada[];
  /** Avisos (p. ej. sobreventa por historia incompleta, CA-8). */
  avisos: string[];
}

export interface ImportResult {
  creadas: number;
  saltadas: number;
  pendientes: number;
  avisos: string[];
}

/** Campos estables de la operación que definen su identidad (sin el ordinal). */
function baseKey(symbolId: string, op: OperacionImportada): string {
  return [symbolId, op.side, op.occurredOn, op.cantidad, op.precioOrigen, op.importeEur].join('|');
}

/** Clave derivada determinista (ADR-010): hash de los campos + ordinal intradía. */
function importKeyOf(symbolId: string, op: OperacionImportada, ordinal: number): string {
  return createHash('sha256').update(`${baseKey(symbolId, op)}|${ordinal}`).digest('hex');
}

/**
 * Coste según ADR-011 (divisa del símbolo). Mercado EUR: `gastos = |importeEur −
 * price×cantidad|` (reproduce el importe, RN-04). No-euro: `gastos = 0` y el importe
 * EUR queda como metadato.
 */
function camposCoste(op: OperacionImportada, currency: string): { gastos: string; importeEur: string } {
  const importeEur = new Decimal(op.importeEur).toString();
  if (currency === 'EUR') {
    const base = new Decimal(op.precioOrigen).times(op.cantidad);
    return { gastos: new Decimal(op.importeEur).minus(base).abs().toString(), importeEur };
  }
  return { gastos: '0', importeEur };
}

/** Asigna importKey a cada operación resuelta, con ordinal intradía por campos idénticos. */
function conClaves(resueltas: OperacionResuelta[]): Candidato[] {
  const counts = new Map<string, number>();
  return resueltas.map(({ op, symbolId }) => {
    const bk = baseKey(symbolId, op);
    const ordinal = counts.get(bk) ?? 0;
    counts.set(bk, ordinal + 1);
    return { op, symbolId, importKey: importKeyOf(symbolId, op, ordinal) };
  });
}

async function clavesExistentes(db: Db, userId: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db
    .select({ k: transactions.importKey })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.importKey, keys)));
  return new Set(rows.map((r) => r.k).filter((k): k is string => k !== null));
}

async function ledgerExistente(db: Db, userId: string, symbolId: string): Promise<LedgerEntry[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.symbolId, symbolId)))
    .orderBy(transactions.occurredOn, transactions.createdAt, transactions.id);
  return rows.map((r, i) => ({
    type: r.type as LedgerEntry['type'],
    occurredOn: r.occurredOn,
    quantity: r.quantity,
    ratio: r.ratio,
    seq: i,
  }));
}

/**
 * Detecta las operaciones NUEVAS que provocarían sobreventa (RN-08, CA-8) al mezclarse
 * con el ledger existente en la línea temporal. No aplica la venta imposible: la marca
 * para avisar; el usuario decide (p. ej. añadir la compra anterior y reimportar).
 */
async function detectarSobreventa(db: Db, userId: string, nuevos: Candidato[]): Promise<Set<Candidato>> {
  const oversell = new Set<Candidato>();
  const porSimbolo = new Map<string, Candidato[]>();
  for (const c of nuevos) porSimbolo.set(c.symbolId, [...(porSimbolo.get(c.symbolId) ?? []), c]);

  for (const [symbolId, cands] of porSimbolo) {
    const existentes = await ledgerExistente(db, userId, symbolId);
    type Item = { occurredOn: string; seq: number; type: string; quantity?: Decimal.Value | null; ratio?: Decimal.Value | null; cand?: Candidato };
    const items: Item[] = [];
    existentes.forEach((e, i) => items.push({ occurredOn: e.occurredOn, seq: i, type: e.type, quantity: e.quantity, ratio: e.ratio }));
    cands.forEach((c, i) =>
      items.push({ occurredOn: c.op.occurredOn, seq: existentes.length + i, type: c.op.side, quantity: c.op.cantidad, cand: c }),
    );
    items.sort((a, b) => (a.occurredOn < b.occurredOn ? -1 : a.occurredOn > b.occurredOn ? 1 : a.seq - b.seq));

    let qty = new Decimal(0);
    for (const it of items) {
      if (it.type === 'buy') qty = qty.plus(it.quantity ?? 0);
      else if (it.type === 'split') qty = qty.times(it.ratio ?? 1);
      else if (it.type === 'sell') {
        const q = new Decimal(it.quantity ?? 0);
        if (q.gt(qty)) {
          if (it.cand) oversell.add(it.cand); // venta nueva imposible → avisar, no aplicar
          continue;
        }
        qty = qty.minus(q);
      }
    }
  }
  return oversell;
}

/**
 * CA-7: previsualiza el import SIN escribir nada. Clasifica en a-crear / a-saltar
 * (duplicados ya en BD, CA-4) / pendientes (CA-10) y genera avisos de sobreventa (CA-8).
 */
export async function previsualizarImport(
  db: Db,
  userId: string,
  resueltas: OperacionResuelta[],
  pendientes: OperacionImportada[] = [],
): Promise<ImportPreview> {
  const cands = conClaves(resueltas);
  const existentes = await clavesExistentes(db, userId, cands.map((c) => c.importKey));

  const nuevos = cands.filter((c) => !existentes.has(c.importKey));
  const aSaltar = cands
    .filter((c) => existentes.has(c.importKey))
    .map(({ op, symbolId }) => ({ op, symbolId }));

  const oversell = await detectarSobreventa(db, userId, nuevos);
  const aCrear = nuevos.filter((c) => !oversell.has(c));
  const avisos = [...oversell].map(
    (c) =>
      `Venta de ${c.op.cantidad} de "${c.op.nombreBroker}" (${c.op.occurredOn}) supera la cantidad disponible: falta una compra anterior a la ventana del extracto. Se omite; añádela y reimporta.`,
  );

  return { aCrear, aSaltar, pendientes, avisos };
}

async function divisaPorSimbolo(db: Db, symbolIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(symbolIds)];
  if (ids.length === 0) return new Map();
  const rows = await db.select({ id: symbols.id, currency: symbols.currency }).from(symbols).where(inArray(symbols.id, ids));
  return new Map(rows.map((r) => [r.id, r.currency]));
}

/**
 * CA-1..CA-6: confirma el import y ESCRIBE las operaciones a-crear como transacciones
 * (buy/sell, ADR-003), con coste según ADR-011 e `importKey` idempotente (ADR-010).
 * El `onConflictDoNothing` sobre (userId, importKey) hace la escritura idempotente
 * también a nivel de BD (CA-4). Los duplicados/pendientes/sobreventa no se escriben.
 */
export async function confirmarImport(
  db: Db,
  userId: string,
  resueltas: OperacionResuelta[],
  pendientes: OperacionImportada[] = [],
): Promise<ImportResult> {
  const preview = await previsualizarImport(db, userId, resueltas, pendientes);
  const divisas = await divisaPorSimbolo(db, preview.aCrear.map((c) => c.symbolId));

  let creadas = 0;
  for (const c of preview.aCrear) {
    const currency = divisas.get(c.symbolId) ?? '';
    const { gastos, importeEur } = camposCoste(c.op, currency);
    const inserted = await db
      .insert(transactions)
      .values({
        userId,
        symbolId: c.symbolId,
        type: c.op.side,
        occurredOn: c.op.occurredOn,
        quantity: c.op.cantidad,
        price: c.op.precioOrigen,
        gastos,
        importeEur,
        importKey: c.importKey,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted.length > 0) creadas += 1;
  }

  return {
    creadas,
    saltadas: preview.aSaltar.length,
    pendientes: preview.pendientes.length,
    avisos: preview.avisos,
  };
}
