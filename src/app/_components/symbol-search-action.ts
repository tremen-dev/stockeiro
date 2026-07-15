'use server';

import { auth } from '@/lib/auth/config';
import { runSymbolSearch, type SymbolSearchOutcome } from '@/lib/market/search';
import { symbolSearchProvider } from '@/lib/market/search-provider-factory';

/**
 * Server action del buscador de símbolos (SPEC-008). Resuelve la sesión (RN-03,
 * CA-7) y delega en `runSymbolSearch` con el adaptador real de Twelve Data (o el fake
 * E2E). El comportamiento (auth, filtrado a acciones, resiliencia) está en el dominio
 * y probado con fake; aquí solo se inyecta el proveedor y la sesión.
 */
export async function searchSymbolsAction(query: string): Promise<SymbolSearchOutcome> {
  const session = await auth();
  const sessionLike = session?.user?.id ? { userId: session.user.id } : null;
  return runSymbolSearch({ session: sessionLike, provider: symbolSearchProvider(), query });
}
