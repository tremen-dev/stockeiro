import type { SymbolSearchProvider, SymbolMatch, DiscardedSymbol } from './search-provider';
import { TwelveDataSymbolSearchProvider } from './twelve-data-search-provider';
import { FakeSymbolSearchProvider } from './fake-search-provider';

/**
 * Catálogo mínimo para desarrollo/E2E sin `TWELVE_DATA_API_KEY` real. Se usa SOLO
 * cuando `E2E_FAKE_SYMBOL_SEARCH=1` (nunca en producción): hace el buscador demoable
 * en local y permite un E2E determinista sin red.
 */
// ADR-012: el puerto devuelve el MIC CANÓNICO (operating), no el de segmento — el
// adaptador real normaliza XMAD→BMEX y XNGS→XNAS, así que el fake refleja ese contrato.
// El `instrumentType` va con la etiqueta LITERAL del proveedor (SPEC-029/ADR-020): es lo
// que el buscador y la tabla muestran, y lo que se persiste con el símbolo.
const E2E_CATALOG: SymbolMatch[] = [
  { ticker: 'ITX', micCode: 'BMEX', exchange: 'BME', name: 'Industria de Diseño Textil SA (Inditex)', currency: 'EUR', country: 'Spain', instrumentType: 'Common Stock' },
  { ticker: 'SAN', micCode: 'BMEX', exchange: 'BME', name: 'Banco Santander SA', currency: 'EUR', country: 'Spain', instrumentType: 'Common Stock' },
  { ticker: 'AAPL', micCode: 'XNAS', exchange: 'NASDAQ', name: 'Apple Inc', currency: 'USD', country: 'United States', instrumentType: 'Common Stock' },
  { ticker: 'MSFT', micCode: 'XNAS', exchange: 'NASDAQ', name: 'Microsoft Corp', currency: 'USD', country: 'United States', instrumentType: 'Common Stock' },
  { ticker: 'REP', micCode: 'BMEX', exchange: 'BME', name: 'Repsol SA', currency: 'EUR', country: 'Spain', instrumentType: 'Common Stock' },
  { ticker: 'TEF', micCode: 'BMEX', exchange: 'BME', name: 'Telefónica SA', currency: 'EUR', country: 'Spain', instrumentType: 'Common Stock' },
  // --- SPEC-029: entradas PROPIAS de esta spec -------------------------------------
  // Los 6 de arriba están COMPARTIDOS con los e2e de vigiladas, cartera, avisos-zona e
  // importar; sembrar los casos nuevos en ellos contaminaría la prueba de otra spec.
  // Estos cinco no los usa ninguna otra: son de SPEC-029 y de nadie más.
  { ticker: 'ORC', micCode: 'XNYS', exchange: 'NYSE', name: 'Orchid Island Capital Inc.', currency: 'USD', country: 'United States', instrumentType: 'REIT' },
  { ticker: 'LX', micCode: 'XNAS', exchange: 'NASDAQ', name: 'LexinFintech Holdings Ltd. ADS', currency: 'USD', country: 'United States', instrumentType: 'American Depositary Receipt' },
  { ticker: 'UPWK', micCode: 'XNAS', exchange: 'NASDAQ', name: 'Upwork Inc.', currency: 'USD', country: 'United States', instrumentType: 'Common Stock' },
  { ticker: 'IWDA', micCode: 'XAMS', exchange: 'Euronext Amsterdam', name: 'iShares Core MSCI World UCITS ETF USD (Acc)', currency: 'EUR', country: 'Netherlands', instrumentType: 'ETF' },
];

/**
 * SPEC-029: descartes sembrados. `TSCO`@`XLON` NO es un candidato — Londres no está
 * entre los 7 operating MIC soportados—, y el descarte por mercado ocurre en el
 * ADAPTADOR, así que el fake tiene que poder reproducirlo o el e2e no podría ejercer
 * el caso «existe, pero está en un mercado que no cubrimos» (CA-7/CA-10).
 */
const E2E_DISCARDED: DiscardedSymbol[] = [
  { ticker: 'TSCO', name: 'Tesco PLC', micCode: 'XLON', exchange: 'LSE', reason: 'mercado_no_soportado' },
];

/**
 * Factory del proveedor de búsqueda (SPEC-008): real (Twelve Data) o fake E2E según
 * `E2E_FAKE_SYMBOL_SEARCH`. Módulo NO-action para poder reutilizarlo tanto en la
 * server action del buscador (SPEC-008) como en la resolución del import (SPEC-014),
 * que necesita el MISMO proveedor/catálogo.
 */
export function symbolSearchProvider(): SymbolSearchProvider {
  if (process.env.E2E_FAKE_SYMBOL_SEARCH === '1') {
    return new FakeSymbolSearchProvider(E2E_CATALOG, { discarded: E2E_DISCARDED });
  }
  return new TwelveDataSymbolSearchProvider();
}
