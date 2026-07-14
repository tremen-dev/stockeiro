import type { MarketDataProvider, ProviderQuote } from './provider';

/**
 * Adaptador REAL de Twelve Data (ADR-002, primer proveedor por su free tier diario).
 *
 * Usa el endpoint `/eod` (end-of-day): último cierre NO ajustado por símbolo (RN-12),
 * con su `datetime` como `asOf` (D-2). Batch de símbolos en una sola llamada
 * (ADR-002: 1 símbolo = 1 llamada por ciclo). Resiliencia por símbolo (CA-6): si el
 * proveedor devuelve error para uno, se omite del resultado y los demás pasan.
 *
 * NO se ejerce en tests (se usa `FakeMarketDataProvider`); requiere
 * `TWELVE_DATA_API_KEY` real, follow-up de despliegue (F-SPEC-004-1).
 */
const BASE_URL = 'https://api.twelvedata.com/eod';

interface TwelveDataEod {
  symbol?: string;
  currency?: string;
  datetime?: string;
  close?: string;
  status?: string; // 'error' en fallos por símbolo
  code?: number;
  message?: string;
}

export class TwelveDataProvider implements MarketDataProvider {
  constructor(
    private readonly apiKey: string | undefined = process.env.TWELVE_DATA_API_KEY,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getQuotes(tickers: string[]): Promise<ProviderQuote[]> {
    if (tickers.length === 0) return [];
    if (!this.apiKey) throw new Error('TWELVE_DATA_API_KEY no definida (ver .env.example).');

    const url = new URL(BASE_URL);
    url.searchParams.set('symbol', tickers.join(','));
    url.searchParams.set('apikey', this.apiKey);

    const res = await this.fetchImpl(url.toString());
    if (!res.ok) throw new Error(`Twelve Data respondió ${res.status}.`);
    const body = (await res.json()) as unknown;

    // Twelve Data devuelve el objeto de un símbolo directamente, o un mapa
    // { "AAPL": {...}, "MSFT": {...} } para varios. Normalizamos a lista.
    const rows: TwelveDataEod[] =
      tickers.length === 1
        ? [body as TwelveDataEod]
        : Object.values(body as Record<string, TwelveDataEod>);

    const out: ProviderQuote[] = [];
    for (const row of rows) {
      if (!row || row.status === 'error') continue; // fallo por símbolo -> se omite (CA-6)
      if (!row.symbol || row.close == null || !row.datetime) continue;
      out.push({
        symbol: row.symbol,
        price: String(row.close), // último cierre no ajustado (RN-12)
        currency: row.currency ?? 'USD',
        asOf: new Date(row.datetime).toISOString(), // D-2
      });
    }
    return out;
  }
}
