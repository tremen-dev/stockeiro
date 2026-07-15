import type { SymbolSearchProvider } from './search-provider';
import { TwelveDataSymbolSearchProvider } from './twelve-data-search-provider';
import { FakeSymbolSearchProvider } from './fake-search-provider';

/**
 * Catálogo mínimo para desarrollo/E2E sin `TWELVE_DATA_API_KEY` real. Se usa SOLO
 * cuando `E2E_FAKE_SYMBOL_SEARCH=1` (nunca en producción): hace el buscador demoable
 * en local y permite un E2E determinista sin red.
 */
// ADR-012: el puerto devuelve el MIC CANÓNICO (operating), no el de segmento — el
// adaptador real normaliza XMAD→BMEX y XNGS→XNAS, así que el fake refleja ese contrato.
const E2E_CATALOG = [
  { ticker: 'ITX', micCode: 'BMEX', exchange: 'BME', name: 'Industria de Diseño Textil SA (Inditex)', currency: 'EUR', country: 'Spain', type: 'stock' },
  { ticker: 'SAN', micCode: 'BMEX', exchange: 'BME', name: 'Banco Santander SA', currency: 'EUR', country: 'Spain', type: 'stock' },
  { ticker: 'AAPL', micCode: 'XNAS', exchange: 'NASDAQ', name: 'Apple Inc', currency: 'USD', country: 'United States', type: 'stock' },
  { ticker: 'MSFT', micCode: 'XNAS', exchange: 'NASDAQ', name: 'Microsoft Corp', currency: 'USD', country: 'United States', type: 'stock' },
  { ticker: 'REP', micCode: 'BMEX', exchange: 'BME', name: 'Repsol SA', currency: 'EUR', country: 'Spain', type: 'stock' },
  { ticker: 'TEF', micCode: 'BMEX', exchange: 'BME', name: 'Telefónica SA', currency: 'EUR', country: 'Spain', type: 'stock' },
];

/**
 * Factory del proveedor de búsqueda (SPEC-008): real (Twelve Data) o fake E2E según
 * `E2E_FAKE_SYMBOL_SEARCH`. Módulo NO-action para poder reutilizarlo tanto en la
 * server action del buscador (SPEC-008) como en la resolución del import (SPEC-014),
 * que necesita el MISMO proveedor/catálogo.
 */
export function symbolSearchProvider(): SymbolSearchProvider {
  if (process.env.E2E_FAKE_SYMBOL_SEARCH === '1') return new FakeSymbolSearchProvider(E2E_CATALOG);
  return new TwelveDataSymbolSearchProvider();
}
