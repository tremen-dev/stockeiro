import {
  quoteKey,
  type MarketDataProvider,
  type ProviderFailure,
  type ProviderQuote,
  type QuoteFailureReason,
  type QuoteRequest,
  type QuotesResult,
} from './provider';

/**
 * Proveedor fake inyectable para tests/e2e (ADR-004): precios y fallos controlados,
 * sin tocar la API real. El dominio depende del puerto, así que este fake es
 * intercambiable con `MarketstackProvider` sin cambiar el servicio de refresco.
 *
 * El mapa `prices` se indexa por `quoteKey(ticker, micCode)`: para símbolos legacy
 * (sin mercado) la clave es el ticker (`{ ITX: ... }`); con mercado es
 * `ticker:micCode` (`{ 'ITX:BMEX': ... }`).
 */
export interface FakeQuoteSpec {
  price: string;
  currency: string;
  asOf: string;
}

export class FakeMarketDataProvider implements MarketDataProvider {
  /** Registro de las peticiones recibidas, para asertar dedupe/universo/mic_code. */
  public readonly calls: QuoteRequest[][] = [];

  /**
   * @param prices    quoteKey -> cotización a devolver.
   * @param failures  quoteKey -> motivo CLASIFICADO (SPEC-016). Una clave que no está
   *                  en ninguno de los dos mapas se reporta como `simbolo_desconocido`:
   *                  el fake nunca hace desaparecer un símbolo en silencio, igual que el
   *                  adaptador real.
   */
  constructor(
    private readonly prices: Record<string, FakeQuoteSpec>,
    private readonly failures: Record<string, QuoteFailureReason> = {},
  ) {}

  async getQuotes(requests: QuoteRequest[]): Promise<QuotesResult> {
    this.calls.push([...requests]);
    const quotes: ProviderQuote[] = [];
    const fails: ProviderFailure[] = [];

    for (const req of requests) {
      const key = quoteKey(req.ticker, req.micCode);
      const spec = this.prices[key];
      if (spec) {
        quotes.push({
          ticker: req.ticker,
          micCode: req.micCode ?? null,
          price: spec.price,
          currency: spec.currency,
          asOf: spec.asOf,
        });
        continue;
      }
      fails.push({
        ticker: req.ticker,
        micCode: req.micCode ?? null,
        reason: this.failures[key] ?? 'simbolo_desconocido',
      });
    }
    return { quotes, failures: fails };
  }
}
