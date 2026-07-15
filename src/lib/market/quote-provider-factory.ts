import type { MarketDataProvider } from './provider';
import { MarketstackProvider } from './marketstack-provider';
import { FakeMarketDataProvider } from './fake-provider';

/**
 * Catálogo de precios para E2E sin `MARKETSTACK_API_KEY` real. Se usa SOLO cuando
 * `E2E_FAKE_QUOTES=1` (nunca en producción). Claves = `quoteKey(ticker, operatingMic)`
 * (ADR-012: el MIC canónico es el **operating**).
 */
const E2E_PRICES = {
  'ITX:BMEX': { price: '53.72', currency: 'EUR', asOf: '2026-07-14T00:00:00.000Z' },
  'SAN:BMEX': { price: '11.984', currency: 'EUR', asOf: '2026-07-14T00:00:00.000Z' },
  'TEF:BMEX': { price: '3.615', currency: 'EUR', asOf: '2026-07-14T00:00:00.000Z' },
  'REP:BMEX': { price: '12.10', currency: 'EUR', asOf: '2026-07-14T00:00:00.000Z' },
  'AAPL:XNAS': { price: '210.50', currency: 'USD', asOf: '2026-07-14T00:00:00.000Z' },
};

/**
 * Fallos simulados para el E2E de SPEC-016: `MSFT` no se cotiza y se explica por qué.
 * Permite verificar en navegador que "sin cotización" deja de ser mudo (CE-F2).
 */
const E2E_FAILURES = {
  'MSFT:XNAS': 'mercado_no_cubierto' as const,
};

/**
 * Factory del proveedor de COTIZACIONES (ADR-012): Marketstack real, o fake E2E según
 * `E2E_FAKE_QUOTES`. Mismo patrón que `search-provider-factory` (SPEC-008): el dominio
 * depende del puerto; aquí solo se elige el adaptador.
 *
 * Sustituye a `TwelveDataProvider` como proveedor de precios porque su free tier NO
 * cubre BME/M.CONTINUO (EPIC-FIX). Twelve Data se mantiene para la BÚSQUEDA (ADR-007).
 */
export function quoteProvider(): MarketDataProvider {
  if (process.env.E2E_FAKE_QUOTES === '1') return new FakeMarketDataProvider(E2E_PRICES, E2E_FAILURES);
  return new MarketstackProvider();
}
