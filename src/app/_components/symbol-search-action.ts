'use server';

import { auth } from '@/lib/auth/config';
import { runSymbolSearch, type SymbolSearchOutcome } from '@/lib/market/search';
import type { SymbolSearchProvider } from '@/lib/market/search-provider';
import { TwelveDataSymbolSearchProvider } from '@/lib/market/twelve-data-search-provider';
import { FakeSymbolSearchProvider } from '@/lib/market/fake-search-provider';

/**
 * Catálogo mínimo para desarrollo/E2E sin `TWELVE_DATA_API_KEY` real. Se usa SOLO
 * cuando `E2E_FAKE_SYMBOL_SEARCH=1` (nunca en producción, donde la variable no está):
 * hace el buscador demoable en local y permite un E2E determinista sin red.
 */
const E2E_CATALOG = [
  { ticker: 'ITX', micCode: 'XMAD', exchange: 'BME', name: 'Industria de Diseño Textil SA (Inditex)', currency: 'EUR', country: 'Spain', type: 'stock' },
  { ticker: 'SAN', micCode: 'XMAD', exchange: 'BME', name: 'Banco Santander SA', currency: 'EUR', country: 'Spain', type: 'stock' },
  { ticker: 'AAPL', micCode: 'XNGS', exchange: 'NASDAQ', name: 'Apple Inc', currency: 'USD', country: 'United States', type: 'stock' },
  { ticker: 'MSFT', micCode: 'XNGS', exchange: 'NASDAQ', name: 'Microsoft Corp', currency: 'USD', country: 'United States', type: 'stock' },
  { ticker: 'REP', micCode: 'XMAD', exchange: 'BME', name: 'Repsol SA', currency: 'EUR', country: 'Spain', type: 'stock' },
  { ticker: 'TEF', micCode: 'XMAD', exchange: 'BME', name: 'Telefónica SA', currency: 'EUR', country: 'Spain', type: 'stock' },
];

function provider(): SymbolSearchProvider {
  if (process.env.E2E_FAKE_SYMBOL_SEARCH === '1') return new FakeSymbolSearchProvider(E2E_CATALOG);
  return new TwelveDataSymbolSearchProvider();
}

/**
 * Server action del buscador de símbolos (SPEC-008). Resuelve la sesión (RN-03,
 * CA-7) y delega en `runSymbolSearch` con el adaptador real de Twelve Data. El
 * comportamiento (auth, filtrado a acciones, resiliencia) está en el dominio y
 * probado con fake; aquí solo se inyecta el proveedor y la sesión.
 */
export async function searchSymbolsAction(query: string): Promise<SymbolSearchOutcome> {
  const session = await auth();
  const sessionLike = session?.user?.id ? { userId: session.user.id } : null;
  return runSymbolSearch({ session: sessionLike, provider: provider(), query });
}
