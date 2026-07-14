import { quoteKey, type MarketDataProvider, type ProviderQuote, type QuoteRequest } from './provider';

/**
 * Proveedor fake inyectable para tests/e2e (ADR-004): precios y fallos controlados,
 * sin tocar la API real. El dominio depende del puerto, así que este fake es
 * intercambiable con `TwelveDataProvider` sin cambiar el servicio de refresco.
 *
 * El mapa `prices` se indexa por `quoteKey(ticker, micCode)`: para símbolos legacy
 * (sin mercado) la clave es el ticker (`{ ITX: ... }`); con mercado es
 * `ticker:micCode` (`{ 'MSFT:XNGS': ... }`).
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
   * @param prices  quoteKey -> cotización a devolver. Una clave AUSENTE del mapa
   *                simula un fallo del proveedor para ese símbolo (se omite, CA-6).
   */
  constructor(private readonly prices: Record<string, FakeQuoteSpec>) {}

  async getQuotes(requests: QuoteRequest[]): Promise<ProviderQuote[]> {
    this.calls.push([...requests]);
    const out: ProviderQuote[] = [];
    for (const req of requests) {
      const spec = this.prices[quoteKey(req.ticker, req.micCode)];
      if (!spec) continue; // símbolo sin precio -> se omite (fallo simulado, CA-6)
      out.push({
        ticker: req.ticker,
        micCode: req.micCode ?? null,
        price: spec.price,
        currency: spec.currency,
        asOf: spec.asOf,
      });
    }
    return out;
  }
}
