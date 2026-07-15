import type { MarketDataProvider, ProviderQuote, QuoteRequest } from './provider';
import { isOperatingMic } from './mic';

/**
 * Adaptador REAL de Marketstack (ADR-012), proveedor de COTIZACIONES. Sustituye a
 * `TwelveDataProvider`, cuyo free tier NO cubre BME/M.CONTINUO — el mercado principal
 * del usuario (EPIC-FIX). Verificado contra la API real (2026-07-15, free tier):
 *
 *   GET /v1/eod/latest?symbols=ITX.BMEX,SAN.BMEX → 200
 *   { data: [{ symbol:"ITX.BMEX", exchange:"BMEX", date:"2026-07-14T00:00:00+0000",
 *              close:53.72, adj_close:53.72, split_factor:1, dividend:0 }] }
 *
 * - Símbolo = `TICKER.MIC`; **batch en UNA llamada** (ADR-002: 1 símbolo = 1 llamada/ciclo).
 * - Se toma `close` = último cierre **NO ajustado** (RN-12); `adj_close` se IGNORA a
 *   propósito: mezclarlos falsearía disparos y P/L.
 * - `date` → `asOf` (D-2). `exchange` = el MIC pedido → **el eco casa** (ADR-012), que es
 *   lo que mata el descarte silencioso del adaptador anterior.
 * - Resiliencia por símbolo (CA-8/CA-6 de SPEC-004): una fila con `status:"error"` se
 *   omite; los demás pasan. Un fallo GLOBAL viene como HTTP 200 con `{error:{...}}`.
 *
 * NO se ejerce en tests (se usa `FakeMarketDataProvider`); requiere `MARKETSTACK_API_KEY`
 * real: su validación contra la API es follow-up de despliegue (F-ADR-012-2).
 */
const BASE_URL = 'https://api.marketstack.com/v1/eod/latest';

/**
 * Dialecto de Marketstack: su código de mercado NO siempre es el MIC ISO. Xetra es
 * `XETRA` para ellos (el ISO es `XETR`). El dominio guarda SIEMPRE el canónico ISO; la
 * traducción vive aquí (ADR-012).
 */
const TO_PROVIDER: Record<string, string> = { XETR: 'XETRA' };
const FROM_PROVIDER: Record<string, string> = { XETRA: 'XETR' };

const toProviderMic = (mic: string): string => TO_PROVIDER[mic] ?? mic;
const fromProviderMic = (mic: string): string => FROM_PROVIDER[mic.toUpperCase()] ?? mic.toUpperCase();

interface MarketstackRow {
  symbol?: string;
  exchange?: string;
  date?: string;
  close?: number | string;
  status?: string; // 'error' en fallos por símbolo
  code?: number;
  message?: string;
}

interface MarketstackBody {
  data?: MarketstackRow[];
  error?: { code?: string; message?: string };
}

export class MarketstackProvider implements MarketDataProvider {
  constructor(
    private readonly apiKey: string | undefined = process.env.MARKETSTACK_API_KEY,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getQuotes(requests: QuoteRequest[]): Promise<ProviderQuote[]> {
    if (requests.length === 0) return [];
    if (!this.apiKey) throw new Error('MARKETSTACK_API_KEY no definida (ver .env.example).');

    // Solo se piden los símbolos con identidad de mercado canónica: sin operating MIC
    // no se puede cotizar el mercado correcto y NO se adivina (CA-10, RN-09).
    const askable = requests.filter((r) => isOperatingMic(r.micCode));
    if (askable.length === 0) return [];

    const url = new URL(BASE_URL);
    url.searchParams.set('symbols', askable.map((r) => `${r.ticker}.${toProviderMic(r.micCode as string)}`).join(','));
    url.searchParams.set('access_key', this.apiKey);

    const res = await this.fetchImpl(url.toString());
    if (!res.ok) throw new Error(`Marketstack respondió ${res.status}.`);
    const body = (await res.json()) as MarketstackBody;
    // Fallo GLOBAL: HTTP 200 con {error:{...}}. No hay cotizaciones que devolver.
    if (body.error) throw new Error(`Marketstack: ${body.error.message ?? body.error.code ?? 'error'}`);

    const out: ProviderQuote[] = [];
    for (const row of body.data ?? []) {
      if (!row || row.status === 'error') continue; // fallo por símbolo -> se omite (CA-8)
      if (!row.symbol || row.close == null || !row.date) continue;
      const [ticker, providerMic] = row.symbol.split('.');
      if (!ticker) continue;
      // El mic del eco se devuelve en canónico ISO para que el emparejado del dominio
      // (quoteKey) case con lo pedido (CA-4).
      const micCode = fromProviderMic(row.exchange || providerMic || '');
      const req = askable.find((r) => r.ticker === ticker && r.micCode === micCode);
      if (!req) continue; // eco que no corresponde a nada pedido -> se ignora
      out.push({
        ticker,
        micCode,
        price: String(row.close), // último cierre NO ajustado (RN-12); adj_close se ignora
        // Sin `currency`: Marketstack no la devuelve (verificado). La divisa es la del
        // símbolo (RN-09) y la pone el refresco.
        asOf: new Date(row.date).toISOString(), // D-2
      });
    }
    return out;
  }
}
