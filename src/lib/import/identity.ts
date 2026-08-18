import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { symbolAliases, type SymbolAlias } from '@/db/schema';
import { getOrCreateSymbol } from '@/lib/portfolio/symbols';
import { searchSymbols } from '@/lib/market/search';
import { requireSession, type SessionLike } from '@/lib/auth/guard';
import type { SymbolSearchProvider, SymbolMatch } from '@/lib/market/search-provider';
import type { OperacionImportada } from './statement-reader';
import { filterByMarket } from './market-map';

/**
 * Resolución de identidad del import (SPEC-012, ADR-009): lleva cada valor del
 * extracto (`nombreBroker` + `etiquetaMercado`, SIN ticker/ISIN) a un símbolo
 * canónico `(ticker, micCode)` reutilizando el puerto `SymbolSearchProvider`
 * (ADR-007). NO auto-asigna en caso ambiguo (CE-3): el usuario confirma. La
 * decisión confirmada se RECUERDA (`symbol_aliases`, por usuario, RN-01) para no
 * re-preguntar en re-imports (CA-6) y estabilizar la idempotencia (ADR-010).
 * Esta capa NO escribe transacciones (SPEC-013) ni re-escala splits (ADR-009).
 */
type Db = PgDatabase<any, any, any>;

/** Un valor distinto del extracto a resolver. */
export interface ValorBroker {
  nombreBroker: string;
  etiquetaMercado: string;
}

export type EstadoResolucion =
  | 'remembered' // ya resuelto por un alias previo del usuario (CA-6)
  | 'suggested' // exactamente 1 candidato tras el filtro de mercado (sugerencia, a confirmar)
  | 'ambiguous' // >1 candidatos: el usuario elige (CA-3)
  | 'unmatched' // 0 candidatos (CA-3)
  | 'error'; // el proveedor falló para este valor (CA-11)

export interface ValorResolucion extends ValorBroker {
  estado: EstadoResolucion;
  /** Presente solo en `remembered` (identidad ya fijada). */
  symbolId?: string;
  /** Candidatos ofrecidos al usuario en `suggested`/`ambiguous`. */
  candidatos?: SymbolMatch[];
}

const keyOf = (v: ValorBroker): string => `${v.nombreBroker}|${v.etiquetaMercado}`;

/** Valores DISTINTOS (nombre+mercado) del extracto, en el primer orden de aparición. */
export function distinctValores(ops: OperacionImportada[]): ValorBroker[] {
  const seen = new Set<string>();
  const out: ValorBroker[] = [];
  for (const o of ops) {
    const v = { nombreBroker: o.nombreBroker, etiquetaMercado: o.etiquetaMercado };
    const k = keyOf(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

async function getAlias(db: Db, userId: string, v: ValorBroker): Promise<SymbolAlias | null> {
  const [a] = await db
    .select()
    .from(symbolAliases)
    .where(
      and(
        eq(symbolAliases.userId, userId),
        eq(symbolAliases.brokerName, v.nombreBroker),
        eq(symbolAliases.marketLabel, v.etiquetaMercado),
      ),
    )
    .limit(1);
  return a ?? null;
}

/**
 * Resuelve UN valor (CA-1/CA-2/CA-3/CA-6/CA-9/CA-11): alias recordado → búsqueda por
 * nombre filtrada por MERCADO → estado. No auto-asigna. Desde ADR-020 (SPEC-029 CA-16)
 * ya no se filtra por tipo: un ETF o un REIT del extracto también se pueden resolver.
 */
export async function resolverValor(
  db: Db,
  userId: string,
  provider: SymbolSearchProvider,
  v: ValorBroker,
): Promise<ValorResolucion> {
  const alias = await getAlias(db, userId, v);
  if (alias) return { ...v, estado: 'remembered', symbolId: alias.symbolId }; // CA-6: NO consulta al proveedor

  let candidatos: SymbolMatch[];
  try {
    // ADR-020 (SPEC-029 CA-16): el tipo YA NO FILTRA. Aquí decía «solo renta variable
    // (D-7, CA-9)», y por eso el extracto real no podía resolver un ETF ni un REIT. El
    // único filtro que queda es el de MERCADO, que es el de la línea siguiente.
    const { matches } = await searchSymbols(provider, v.nombreBroker);
    candidatos = filterByMarket(matches, v.etiquetaMercado); // CA-1
  } catch {
    return { ...v, estado: 'error' }; // CA-11: el fallo de un valor no aborta los demás
  }

  if (candidatos.length === 0) return { ...v, estado: 'unmatched' }; // CA-3
  if (candidatos.length === 1) return { ...v, estado: 'suggested', candidatos };
  return { ...v, estado: 'ambiguous', candidatos }; // CA-3: el usuario elige
}

/** Resuelve todos los valores distintos del extracto, resiliente por valor (CA-11). */
export async function resolverValores(
  db: Db,
  userId: string,
  provider: SymbolSearchProvider,
  ops: OperacionImportada[],
): Promise<ValorResolucion[]> {
  const out: ValorResolucion[] = [];
  for (const v of distinctValores(ops)) {
    out.push(await resolverValor(db, userId, provider, v));
  }
  return out;
}

export interface Confirmacion {
  symbolId: string;
  /** True si el símbolo ya lo usaba OTRO alias del usuario: fusión → aviso de split. */
  fused: boolean;
}

async function symbolYaUsadoPorOtroAlias(
  db: Db,
  userId: string,
  symbolId: string,
  v: ValorBroker,
): Promise<boolean> {
  const rows = await db
    .select()
    .from(symbolAliases)
    .where(and(eq(symbolAliases.userId, userId), eq(symbolAliases.symbolId, symbolId)));
  return rows.some((a) => a.brokerName !== v.nombreBroker || a.marketLabel !== v.etiquetaMercado);
}

async function upsertAlias(db: Db, userId: string, v: ValorBroker, symbolId: string): Promise<void> {
  const existing = await getAlias(db, userId, v);
  if (existing) {
    await db.update(symbolAliases).set({ symbolId }).where(eq(symbolAliases.id, existing.id));
  } else {
    await db
      .insert(symbolAliases)
      .values({ userId, brokerName: v.nombreBroker, marketLabel: v.etiquetaMercado, symbolId });
  }
}

/**
 * Confirma la selección del usuario para un valor (CA-4): materializa el símbolo
 * compartido con la identidad y divisa del candidato (`(ticker, micCode)`, ADR-007)
 * y persiste/actualiza el alias recordado (CA-6). `fused=true` si ese símbolo ya lo
 * usaba otro alias del usuario (fusión manual de eventos corporativos, CA-7): la
 * capa avisa de un posible split a reconciliar a mano (RN-07); NO re-escala.
 */
export async function confirmarSeleccion(
  db: Db,
  userId: string,
  v: ValorBroker,
  match: SymbolMatch,
): Promise<Confirmacion> {
  const sym = await getOrCreateSymbol(db, match.ticker, match.currency, {
    micCode: match.micCode,
    exchange: match.exchange,
    name: match.name,
    instrumentType: match.instrumentType, // SPEC-029: el tipo viaja también desde el import
  });
  const fused = await symbolYaUsadoPorOtroAlias(db, userId, sym.id, v);
  await upsertAlias(db, userId, v, sym.id);
  return { symbolId: sym.id, fused };
}

/**
 * Fusiona explícitamente un valor sobre un símbolo YA resuelto (CA-7): apunta su
 * alias al mismo `symbolId`. Devuelve `fused=true` (aviso de split). NO re-escala
 * cantidades ni precios: la reconciliación del split es manual (ADR-003/RN-07).
 */
export async function fusionarValor(
  db: Db,
  userId: string,
  v: ValorBroker,
  symbolId: string,
): Promise<Confirmacion> {
  const fused = await symbolYaUsadoPorOtroAlias(db, userId, symbolId, v);
  await upsertAlias(db, userId, v, symbolId);
  return { symbolId, fused };
}

export interface Particion {
  resueltas: { op: OperacionImportada; symbolId: string }[];
  pendientes: OperacionImportada[];
}

/**
 * Particiona las operaciones en RESUELTAS (con `symbolId`) y PENDIENTES (CA-5): lo
 * no resuelto NO pasa al registro (SPEC-013). Solo cuentan como resueltos los
 * valores con `symbolId` (estado `remembered` tras confirmación).
 */
export function particionar(ops: OperacionImportada[], resoluciones: ValorResolucion[]): Particion {
  const symbolByValor = new Map<string, string>();
  for (const r of resoluciones) if (r.symbolId) symbolByValor.set(keyOf(r), r.symbolId);

  const resueltas: Particion['resueltas'] = [];
  const pendientes: OperacionImportada[] = [];
  for (const op of ops) {
    const symbolId = symbolByValor.get(keyOf({ nombreBroker: op.nombreBroker, etiquetaMercado: op.etiquetaMercado }));
    if (symbolId) resueltas.push({ op, symbolId });
    else pendientes.push(op);
  }
  return { resueltas, pendientes };
}

export type ResolucionOutcome =
  | { status: 'unauthorized' }
  | { status: 'ok'; resoluciones: ValorResolucion[] };

export interface ResolucionDeps {
  session: SessionLike;
  db: Db;
  provider: SymbolSearchProvider;
  ops: OperacionImportada[];
}

/**
 * Núcleo con sesión expuesto a la UI (CA-10): sin sesión válida (RN-03) rechaza y no
 * resuelve nada; con sesión, resuelve los valores del usuario (aislado por `userId`,
 * RN-01) — el mapeo recordado de un usuario no lo ven otros.
 */
export async function runResolucion(deps: ResolucionDeps): Promise<ResolucionOutcome> {
  const guard = requireSession(deps.session);
  if (!guard.ok) return { status: 'unauthorized' };
  const resoluciones = await resolverValores(deps.db, guard.userId, deps.provider, deps.ops);
  return { status: 'ok', resoluciones };
}
