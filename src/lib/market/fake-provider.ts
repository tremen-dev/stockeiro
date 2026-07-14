import type { MarketDataProvider, ProviderQuote } from './provider';

/**
 * Proveedor fake inyectable para tests/e2e (ADR-004): precios y fallos controlados,
 * sin tocar la API real. El dominio depende del puerto, así que este fake es
 * intercambiable con `TwelveDataProvider` sin cambiar el servicio de refresco.
 */
export interface FakeQuoteSpec {
  price: string;
  currency: string;
  asOf: string;
}

export class FakeMarketDataProvider implements MarketDataProvider {
  /** Registro de los conjuntos pedidos, para asertar dedupe/universo (CA-1/CA-2). */
  public readonly calls: string[][] = [];

  /**
   * @param prices  ticker -> cotización a devolver. Un ticker AUSENTE del mapa
   *                simula un fallo del proveedor para ese símbolo (se omite, CA-6).
   */
  constructor(private readonly prices: Record<string, FakeQuoteSpec>) {}

  async getQuotes(tickers: string[]): Promise<ProviderQuote[]> {
    this.calls.push([...tickers]);
    const out: ProviderQuote[] = [];
    for (const symbol of tickers) {
      const spec = this.prices[symbol];
      if (!spec) continue; // símbolo sin precio -> se omite (fallo simulado, CA-6)
      out.push({ symbol, price: spec.price, currency: spec.currency, asOf: spec.asOf });
    }
    return out;
  }
}
