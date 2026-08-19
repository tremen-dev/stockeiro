'use server';

import { revalidatePath } from 'next/cache';
import { inArray } from 'drizzle-orm';
import { sectionUserOrNull } from '@/lib/auth/session';
import { notaDeRebote } from '@/lib/auth/section-messages';
import { db } from '@/db/client';
import { symbols } from '@/db/schema';
import { IngXlsStatementReader } from '@/lib/import/ing-xls-reader';
import { ExtractoIllegibleError, type OperacionImportada } from '@/lib/import/statement-reader';
import {
  resolverValores,
  confirmarSeleccion,
  fusionarValor,
  particionar,
  type ValorResolucion,
} from '@/lib/import/identity';
import { previsualizarImport, confirmarImport, type ImportPreview, type ImportResult } from '@/lib/import/register';
import { symbolSearchProvider } from '@/lib/market/search-provider-factory';
import type { SymbolMatch } from '@/lib/market/search-provider';

/**
 * Server actions que orquestan el import (SPEC-014): encadenan lectura (SPEC-011),
 * resolución de identidad (SPEC-012) y registro idempotente (SPEC-013). Cada una
 * resuelve la sesión (RN-01/RN-03); el binario del extracto se procesa en memoria y
 * NO se persiste. El estado del asistente vive en el cliente: estas acciones son sin
 * estado y reciben las operaciones ya parseadas en cada paso.
 */
async function requireUserId(): Promise<string | null> {
  // SPEC-034 CA-7 / ADR-021 pto. 7: además de la sesión (RN-03), la SECCIÓN. Cada
  // action de import pasa por aquí; dejar una sola sin pasar deja el import abierto
  // a quien no puede ni ver la pantalla que lo lanza.
  return (await sectionUserOrNull('importar'))?.id ?? null;
}

/** Mismo motivo que en la página, para que el asistente no enseñe un error opaco. */
const CERRADA = notaDeRebote('importar');

export type ReadResult =
  | { ok: true; operaciones: OperacionImportada[]; numOperaciones: number; numValores: number; titular: string }
  | { ok: false; error: string };

/** CA-2/CA-3: lee el `.xls` subido a operaciones; error legible si no es válido. */
export async function readStatementAction(formData: FormData): Promise<ReadResult> {
  if (!(await requireUserId())) return { ok: false, error: CERRADA };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Elige el fichero .xls del extracto de tu bróker.' };
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = new IngXlsStatementReader().read(bytes);
    const valores = new Set(parsed.operaciones.map((o) => `${o.nombreBroker}|${o.etiquetaMercado}`));
    return {
      ok: true,
      operaciones: parsed.operaciones,
      numOperaciones: parsed.operaciones.length,
      numValores: valores.size,
      titular: parsed.metadatos.titular,
    };
  } catch (e) {
    if (e instanceof ExtractoIllegibleError) return { ok: false, error: e.message };
    return { ok: false, error: 'No se pudo leer el fichero como extracto de ING.' };
  }
}

export interface SymbolInfo {
  ticker: string;
  micCode: string | null;
  name: string | null;
  currency: string;
}

export interface ValorResolucionUI extends ValorResolucion {
  /** True si al resolver este valor su símbolo ya lo usaba otro alias (posible split). */
  fused?: boolean;
  /** Símbolo al que resolvió (para mostrar), en los `remembered`. */
  symbolInfo?: SymbolInfo;
}

/** Info de símbolos por id, para mostrar a qué resolvió cada valor `remembered`. */
async function symbolInfoById(ids: string[]): Promise<Map<string, SymbolInfo>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const rows = await db
    .select({ id: symbols.id, ticker: symbols.ticker, micCode: symbols.micCode, name: symbols.name, currency: symbols.currency })
    .from(symbols)
    .where(inArray(symbols.id, unicos));
  return new Map(rows.map((r) => [r.id, { ticker: r.ticker, micCode: r.micCode, name: r.name, currency: r.currency }]));
}

export type ResolveResult = { ok: true; resoluciones: ValorResolucionUI[] } | { ok: false; error: string };

/**
 * CA-4/CA-6: resuelve los valores del extracto. Auto-confirma los que tienen UN único
 * candidato (sugeridos) para no obligar a confirmar lo obvio en extractos grandes; los
 * ambiguos y sin-coincidencia quedan para que el usuario elija o fusione (no se
 * auto-asigna, CE-3). El import completo lo confirma el usuario al final.
 */
export async function resolveAction(operaciones: OperacionImportada[]): Promise<ResolveResult> {
  const uid = await requireUserId();
  if (!uid) return { ok: false, error: CERRADA };
  const provider = symbolSearchProvider();

  const primera = await resolverValores(db, uid, provider, operaciones);
  const fusedKeys = new Set<string>();
  for (const r of primera) {
    if (r.estado === 'suggested' && r.candidatos?.length === 1) {
      const { fused } = await confirmarSeleccion(
        db,
        uid,
        { nombreBroker: r.nombreBroker, etiquetaMercado: r.etiquetaMercado },
        r.candidatos[0],
      );
      if (fused) fusedKeys.add(`${r.nombreBroker}|${r.etiquetaMercado}`);
    }
  }
  const final = await resolverValores(db, uid, provider, operaciones);
  const info = await symbolInfoById(final.map((r) => r.symbolId).filter((s): s is string => !!s));
  return {
    ok: true,
    resoluciones: final.map((r) => ({
      ...r,
      fused: fusedKeys.has(`${r.nombreBroker}|${r.etiquetaMercado}`),
      symbolInfo: r.symbolId ? info.get(r.symbolId) : undefined,
    })),
  };
}

export type ConfirmResult = { ok: true; fused: boolean; symbolId: string } | { ok: false; error: string };

/** CA-4: el usuario elige un símbolo para un valor ambiguo/sin-match. */
export async function confirmSelectionAction(
  nombreBroker: string,
  etiquetaMercado: string,
  match: SymbolMatch,
): Promise<ConfirmResult> {
  const uid = await requireUserId();
  if (!uid) return { ok: false, error: CERRADA };
  const { symbolId, fused } = await confirmarSeleccion(db, uid, { nombreBroker, etiquetaMercado }, match);
  return { ok: true, fused, symbolId };
}

/** CA-5: el usuario fusiona un valor sobre un símbolo ya resuelto (mismo emisor). */
export async function fuseAction(
  nombreBroker: string,
  etiquetaMercado: string,
  symbolId: string,
): Promise<ConfirmResult> {
  const uid = await requireUserId();
  if (!uid) return { ok: false, error: CERRADA };
  const { fused } = await fusionarValor(db, uid, { nombreBroker, etiquetaMercado }, symbolId);
  return { ok: true, fused, symbolId };
}

async function partir(uid: string, operaciones: OperacionImportada[]) {
  const resoluciones = await resolverValores(db, uid, symbolSearchProvider(), operaciones);
  return particionar(operaciones, resoluciones);
}

export type PreviewResult = { ok: true; preview: ImportPreview } | { ok: false; error: string };

/** CA-7: previsualiza (a-crear/a-saltar/pendientes/avisos) SIN escribir. */
export async function previewAction(operaciones: OperacionImportada[]): Promise<PreviewResult> {
  const uid = await requireUserId();
  if (!uid) return { ok: false, error: CERRADA };
  const { resueltas, pendientes } = await partir(uid, operaciones);
  const preview = await previsualizarImport(db, uid, resueltas, pendientes);
  return { ok: true, preview };
}

export type ImportResultOutcome = { ok: true; result: ImportResult } | { ok: false; error: string };

/** CA-8/CA-9/CA-10: confirma y escribe (idempotente); refresca la cartera. */
export async function confirmImportAction(operaciones: OperacionImportada[]): Promise<ImportResultOutcome> {
  const uid = await requireUserId();
  if (!uid) return { ok: false, error: CERRADA };
  const { resueltas, pendientes } = await partir(uid, operaciones);
  const result = await confirmarImport(db, uid, resueltas, pendientes);
  revalidatePath('/cartera');
  return { ok: true, result };
}
