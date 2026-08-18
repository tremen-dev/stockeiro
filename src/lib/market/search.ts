import { requireSession, type SessionLike } from '@/lib/auth/guard';
import type {
  SymbolSearchProvider,
  SymbolMatch,
  SymbolSearchResult,
  DiscardedSymbol,
} from './search-provider';

/**
 * Umbral mínimo de caracteres para consultar al proveedor (CA-10): protege el
 * free tier compartido con el refresco diario (ADR-002/ADR-007). El debounce del
 * cliente es la primera línea; este umbral es la red del servidor.
 */
export const MIN_QUERY_LENGTH = 2;

/**
 * Búsqueda de símbolos de dominio. Pide candidatos al proveedor y **propaga tal cual**
 * lo que le da: candidatos y descartes. Por debajo del umbral no consulta y devuelve
 * las dos listas vacías.
 *
 * Aquí vivía el filtro `m.type === 'stock'` que implementaba D-7. Lo **borra ADR-020**
 * (aprobado 2026-08-18): la regla efectiva era «el proveedor escribió literalmente la
 * palabra *stock*», y con ella desaparecían en silencio un REIT y un ADR —que son renta
 * variable— y cualquier etiqueta que el proveedor invente mañana. El único filtro es el
 * **mercado**, y vive en el adaptador (ADR-012), que además ahora lo reporta.
 */
export async function searchSymbols(
  provider: SymbolSearchProvider,
  query: string,
): Promise<SymbolSearchResult> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return { matches: [], discarded: [] };
  return provider.search(q);
}

/**
 * Desenlace de la búsqueda expuesto a la UI. Los tres casos «ok» son distinguibles
 * SIN ambigüedad (CA-9), que es justo lo que faltaba: hoy «no existe» y «lo hemos
 * descartado» se veían igual.
 *  - sin candidatos y sin descartes → no existe;
 *  - sin candidatos y con descartes → existe, pero no lo cubrimos;
 *  - con candidatos → se muestran, con sus descartes al lado si los hubo.
 */
export type SymbolSearchOutcome =
  | { status: 'unauthorized' }
  | { status: 'error' }
  | { status: 'ok'; results: SymbolMatch[]; discarded: DiscardedSymbol[] };

export interface SymbolSearchDeps {
  session: SessionLike;
  provider: SymbolSearchProvider;
  query: string;
}

/**
 * Núcleo de la búsqueda expuesta a la UI (CA-7/CA-8 de SPEC-008), inyectable para test —
 * mismo patrón que `runCronRefresh`: el comportamiento probado es el que corre en
 * producción.
 *  - Sin sesión válida (RN-03) → `unauthorized` y NO se consulta al proveedor.
 *  - Si el proveedor falla → `error`, sin romper. Es un estado DISTINTO de «no existe»
 *    y de «todo descartado» (SPEC-029 CA-17): son tres cosas distintas para el usuario.
 */
export async function runSymbolSearch(deps: SymbolSearchDeps): Promise<SymbolSearchOutcome> {
  const guard = requireSession(deps.session);
  if (!guard.ok) return { status: 'unauthorized' };
  try {
    const { matches, discarded } = await searchSymbols(deps.provider, deps.query);
    return { status: 'ok', results: matches, discarded };
  } catch {
    return { status: 'error' };
  }
}
