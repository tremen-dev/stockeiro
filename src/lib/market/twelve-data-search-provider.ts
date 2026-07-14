import type { SymbolSearchProvider, SymbolMatch } from './search-provider';

/**
 * Adaptador REAL de Twelve Data para búsqueda (ADR-007), endpoint `/symbol_search`
 * (free tier Basic, 1 crédito/llamada). Busca por nombre, ticker, ISIN o FIGI y
 * devuelve por fila: symbol, instrument_name, exchange, mic_code, currency,
 * country, instrument_type. Verificado online 2026-07-14 (https://twelvedata.com/docs).
 *
 * NO se ejerce en tests (se usa `FakeSymbolSearchProvider`); requiere
 * `TWELVE_DATA_API_KEY` real (la misma que la ingesta, SPEC-004).
 *
 * Omite filas sin `mic_code`: sin identidad de mercado no podríamos cotizar el
 * símbolo de forma coherente (ADR-007). El filtrado a renta variable (D-7) lo hace
 * el dominio (`searchSymbols`); aquí solo se normaliza `instrument_type` a `type`.
 */
const BASE_URL = 'https://api.twelvedata.com/symbol_search';

interface TwelveSymbolSearchRow {
  symbol?: string;
  instrument_name?: string;
  exchange?: string;
  mic_code?: string;
  currency?: string;
  country?: string;
  instrument_type?: string;
}

export class TwelveDataSymbolSearchProvider implements SymbolSearchProvider {
  constructor(
    private readonly apiKey: string | undefined = process.env.TWELVE_DATA_API_KEY,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(query: string): Promise<SymbolMatch[]> {
    const q = query.trim();
    if (q === '') return [];
    if (!this.apiKey) throw new Error('TWELVE_DATA_API_KEY no definida (ver .env.example).');

    const url = new URL(BASE_URL);
    url.searchParams.set('symbol', q);
    url.searchParams.set('apikey', this.apiKey);

    const res = await this.fetchImpl(url.toString());
    if (!res.ok) throw new Error(`Twelve Data respondió ${res.status}.`);
    const body = (await res.json()) as { data?: TwelveSymbolSearchRow[] };

    const out: SymbolMatch[] = [];
    for (const r of body.data ?? []) {
      if (!r.symbol || !r.mic_code) continue; // sin identidad de mercado -> se omite
      const instrumentType = r.instrument_type ?? '';
      out.push({
        ticker: r.symbol,
        micCode: r.mic_code,
        exchange: r.exchange ?? '',
        name: r.instrument_name ?? '',
        currency: r.currency ?? 'USD',
        country: r.country ?? '',
        type: /stock/i.test(instrumentType) ? 'stock' : instrumentType.toLowerCase(),
      });
    }
    return out;
  }
}
