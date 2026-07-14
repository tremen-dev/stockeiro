import { requireSession, type SessionLike } from '@/lib/auth/guard';
import type { SymbolSearchProvider, SymbolMatch } from './search-provider';

/**
 * Umbral mínimo de caracteres para consultar al proveedor (CA-10): protege el
 * free tier compartido con el refresco diario (ADR-002/ADR-007). El debounce del
 * cliente es la primera línea; este umbral es la red del servidor.
 */
export const MIN_QUERY_LENGTH = 2;

/**
 * Búsqueda de símbolos de dominio (CA-1/CA-2): pide candidatos al proveedor y deja
 * SOLO renta variable (D-7); ETFs, cripto y derivados se descartan aunque el
 * proveedor los devuelva. Por debajo del umbral no consulta y devuelve vacío.
 */
export async function searchSymbols(provider: SymbolSearchProvider, query: string): Promise<SymbolMatch[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];
  const raw = await provider.search(q);
  return raw.filter((m) => m.type === 'stock');
}

export type SymbolSearchOutcome =
  | { status: 'unauthorized' }
  | { status: 'error' }
  | { status: 'ok'; results: SymbolMatch[] };

export interface SymbolSearchDeps {
  session: SessionLike;
  provider: SymbolSearchProvider;
  query: string;
}

/**
 * Núcleo de la búsqueda expuesta a la UI (CA-7/CA-8), inyectable para test —
 * mismo patrón que `runCronRefresh`: el comportamiento probado es el que corre en
 * producción.
 *  - Sin sesión válida (RN-03) → `unauthorized` y NO se consulta al proveedor (CA-7).
 *  - Si el proveedor falla → `error`, sin romper (CA-8).
 *  - Con sesión → candidatos filtrados a acciones.
 */
export async function runSymbolSearch(deps: SymbolSearchDeps): Promise<SymbolSearchOutcome> {
  const guard = requireSession(deps.session);
  if (!guard.ok) return { status: 'unauthorized' };
  try {
    const results = await searchSymbols(deps.provider, deps.query);
    return { status: 'ok', results };
  } catch {
    return { status: 'error' };
  }
}
