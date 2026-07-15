import type {
  MarketDataProvider,
  ProviderFailure,
  ProviderQuote,
  QuoteRequest,
  QuotesResult,
} from './provider';

/**
 * Adaptador REAL de Twelve Data (ADR-002, primer proveedor por su free tier diario).
 *
 * Usa el endpoint `/eod` (end-of-day): último cierre NO ajustado por símbolo (RN-12),
 * con su `datetime` como `asOf` (D-2). Batch de símbolos en una sola llamada
 * (ADR-002: 1 símbolo = 1 llamada por ciclo). Cada símbolo se pide con su `mic_code`
 * para que el precio venga del mercado correcto (ADR-007): symbol y mic_code van como
 * listas paralelas alineadas. Resiliencia por símbolo (CA-6): si el proveedor
 * devuelve error para uno, se omite del resultado y los demás pasan.
 *
 * NO se ejerce en tests (se usa `FakeMarketDataProvider`); requiere
 * `TWELVE_DATA_API_KEY` real, follow-up de despliegue (F-SPEC-004-1). El batch con
 * mic_code para tickers homónimos queda pendiente de verificar contra la API real
 * (F-SPEC-008-2).
 */
const BASE_URL = 'https://api.twelvedata.com/eod';

interface TwelveDataEod {
  symbol?: string;
  mic_code?: string;
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

  async getQuotes(requests: QuoteRequest[]): Promise<QuotesResult> {
    if (requests.length === 0) return { quotes: [], failures: [] };
    if (!this.apiKey) throw new Error('TWELVE_DATA_API_KEY no definida (ver .env.example).');

    const url = new URL(BASE_URL);
    url.searchParams.set('symbol', requests.map((r) => r.ticker).join(','));
    // mic_code alineado con symbol (ADR-007). Solo se envía si algún símbolo lo tiene.
    if (requests.some((r) => r.micCode)) {
      url.searchParams.set('mic_code', requests.map((r) => r.micCode ?? '').join(','));
    }
    url.searchParams.set('apikey', this.apiKey);

    const res = await this.fetchImpl(url.toString());
    if (!res.ok) throw new Error(`Twelve Data respondió ${res.status}.`);
    const body = (await res.json()) as unknown;

    // Twelve Data devuelve el objeto de un símbolo directamente, o un mapa
    // { "AAPL": {...}, "MSFT": {...} } para varios. Normalizamos a lista.
    const rows: TwelveDataEod[] =
      requests.length === 1
        ? [body as TwelveDataEod]
        : Object.values(body as Record<string, TwelveDataEod>);

    const out: ProviderQuote[] = [];
    const resueltos = new Set<string>();
    for (const row of rows) {
      if (!row || row.status === 'error') continue; // fallo por símbolo -> no aborta (CA-6)
      if (!row.symbol || row.close == null || !row.datetime) continue;
      // Recupera el micCode pedido para este ticker (eco de la petición, ADR-007).
      const req = requests.find((r) => r.ticker === row.symbol);
      resueltos.add(row.symbol);
      out.push({
        ticker: row.symbol,
        micCode: row.mic_code ?? req?.micCode ?? null,
        price: String(row.close), // último cierre no ajustado (RN-12)
        currency: row.currency ?? 'USD',
        asOf: new Date(row.datetime).toISOString(), // D-2
      });
    }
    // SPEC-016: lo no resuelto sale con su motivo. Este adaptador ya no se usa para
    // cotizar (ADR-012 lo sustituyó por Marketstack), pero mantiene el contrato del
    // puerto: es el motivo por el que el free tier de Twelve Data falla (BME) lo que
    // originó EPIC-FIX, así que aquí es `mercado_no_cubierto` por defecto.
    const failures: ProviderFailure[] = requests
      .filter((r) => !resueltos.has(r.ticker))
      .map((r) => ({ ticker: r.ticker, micCode: r.micCode ?? null, reason: 'mercado_no_cubierto' as const }));
    return { quotes: out, failures };
  }
}
