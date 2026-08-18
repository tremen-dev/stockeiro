import type {
  SymbolSearchProvider,
  SymbolMatch,
  SymbolSearchResult,
  DiscardedSymbol,
} from './search-provider';
import { toOperatingMic } from './mic';

/**
 * Adaptador REAL de Twelve Data para búsqueda (ADR-007), endpoint `/symbol_search`
 * (free tier Basic, 1 crédito/llamada). Busca por nombre, ticker, ISIN o FIGI y
 * devuelve por fila: symbol, instrument_name, exchange, mic_code, currency,
 * country, instrument_type. Verificado online 2026-07-14 (https://twelvedata.com/docs).
 *
 * No se ejerce contra la red en tests: se inyecta un `fetch` con **fixtures de la
 * respuesta real** capturada el 2026-08-18 (`tests/symbol-search.test.ts`).
 *
 * SPEC-029/ADR-020 — dos cambios, y los dos son el mismo:
 *  - El **tipo no se toca**: `instrument_type` viaja íntegro a `instrumentType`. Antes
 *    se aplastaba a `'stock'`/minúsculas y el dominio tiraba lo que no fuera `'stock'`,
 *    con lo que un REIT o un ADR —que SON renta variable— desaparecían.
 *  - El **descarte deja de ser mudo**: las filas sin `mic_code` y las de mercados fuera
 *    de los 7 operating MIC ya no se saltan con un `continue`; se empujan a `discarded`
 *    con su motivo y con el mic/exchange crudos, para poder decirle al usuario qué
 *    mercado es. El mercado sigue siendo el único filtro (ADR-012).
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

  async search(query: string): Promise<SymbolSearchResult> {
    const q = query.trim();
    if (q === '') return { matches: [], discarded: [] };
    if (!this.apiKey) throw new Error('TWELVE_DATA_API_KEY no definida (ver .env.example).');

    const url = new URL(BASE_URL);
    url.searchParams.set('symbol', q);
    url.searchParams.set('apikey', this.apiKey);

    const res = await this.fetchImpl(url.toString());
    if (!res.ok) throw new Error(`Twelve Data respondió ${res.status}.`);
    const body = (await res.json()) as { data?: TwelveSymbolSearchRow[] };

    const matches: SymbolMatch[] = [];
    const discarded: DiscardedSymbol[] = [];
    for (const r of body.data ?? []) {
      // Sin ticker no hay nada que ofrecer NI que nombrar en un descarte.
      if (!r.symbol) continue;
      const rawMic = (r.mic_code ?? '').trim();
      const exchange = r.exchange ?? '';
      const name = r.instrument_name ?? '';

      if (rawMic === '') {
        // ADR-007: sin identidad de mercado no se podría cotizar. La razón no cambia;
        // lo que cambia es que ya no se calla (SPEC-029 CA-8).
        discarded.push({ ticker: r.symbol, name, micCode: '', exchange, reason: 'sin_identidad_de_mercado' });
        continue;
      }
      // ADR-012: Twelve Data devuelve el MIC de SEGMENTO (XNGS, XMAD…). La identidad
      // canónica del dominio es el OPERATING MIC (XNAS, BMEX…), así que se normaliza
      // AQUÍ, en el adaptador. Un mercado que no sabemos mapear no se adivina: se
      // descarta, y ahora se DICE (SPEC-029 CA-7).
      const micCode = toOperatingMic(rawMic);
      if (!micCode) {
        discarded.push({ ticker: r.symbol, name, micCode: rawMic, exchange, reason: 'mercado_no_soportado' });
        continue;
      }

      matches.push({
        ticker: r.symbol,
        micCode,
        exchange,
        name,
        currency: r.currency ?? 'USD',
        country: r.country ?? '',
        instrumentType: r.instrument_type ?? '',
      });
    }
    return { matches, discarded };
  }
}
