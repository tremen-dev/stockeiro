import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { getOrCreateSymbol } from '@/lib/portfolio/symbols';
import { watchSymbol } from '@/lib/watchlist/service';
import { refreshQuotes, symbolUniverse } from '@/lib/market/refresh';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';
import { MarketstackProvider } from '@/lib/market/marketstack-provider';
import { toOperatingMic, isOperatingMic } from '@/lib/market/mic';
import { TwelveDataSymbolSearchProvider } from '@/lib/market/twelve-data-search-provider';
import { getQuoteViews } from '@/lib/market/quotes';
import { filterByMarket, MARKET_MAP } from '@/lib/import/market-map';
import type { MarketDataProvider } from '@/lib/market/provider';
import type { SymbolMatch } from '@/lib/market/search-provider';

// SPEC-015 / ADR-012 — el proveedor de cotizaciones cubre el mercado real del usuario
// (BME/M.CONTINUO) y la identidad de mercado se canoniza en el OPERATING MIC.

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

const q = (price: string, currency: string) => ({ price, currency, asOf: '2026-07-14T00:00:00.000Z' });

/** `fetch` canned con la forma real de la respuesta de Marketstack (verificada 2026-07-15). */
const fakeFetch = (body: unknown, ok = true) =>
  (async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;

describe('CA-1: cobertura del mercado real (M.CONTINUO / BMEX)', () => {
  it('un símbolo español se cotiza y deja de saltarse', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME', name: 'Inditex' });
    const provider = new FakeMarketDataProvider({ 'ITX:BMEX': q('53.72', 'EUR') });

    const res = await refreshQuotes(db, provider);

    expect(res.updated).toEqual(['ITX']);
    expect(res.skipped).toEqual([]); // el defecto de EPIC-FIX: antes acababa aquí
    const [view] = await getQuoteViews(db);
    expect(view.price).toBe('53.72');
  });
});

describe('CA-2 / CA-3: identidad canónica = operating MIC', () => {
  it('toOperatingMic normaliza segmento → operating y es idempotente', () => {
    expect(toOperatingMic('XMAD')).toBe('BMEX'); // Bolsa de Madrid → BME
    expect(toOperatingMic('XMCE')).toBe('BMEX');
    expect(toOperatingMic('XNGS')).toBe('XNAS'); // Nasdaq Global Select → Nasdaq
    expect(toOperatingMic('XNMS')).toBe('XNAS');
    expect(toOperatingMic('BMEX')).toBe('BMEX'); // idempotente
    expect(toOperatingMic('XNAS')).toBe('XNAS');
    expect(isOperatingMic('XMAD')).toBe(false); // el de segmento NO es canónico
    expect(isOperatingMic('BMEX')).toBe(true);
  });

  it('un mercado desconocido NO se adivina (CA-10)', () => {
    expect(toOperatingMic('XXXX')).toBeNull();
    expect(toOperatingMic(null)).toBeNull();
    expect(toOperatingMic('')).toBeNull();
  });

  it('el adaptador de búsqueda normaliza el segmento antes de devolver el candidato', async () => {
    // Twelve Data devuelve XMAD (segmento); el puerto debe entregar BMEX (operating).
    const body = {
      data: [
        { symbol: 'ITX', instrument_name: 'Inditex', exchange: 'BME', mic_code: 'XMAD', currency: 'EUR', country: 'Spain', instrument_type: 'Common Stock' },
        { symbol: 'MSFT', instrument_name: 'Microsoft', exchange: 'NASDAQ', mic_code: 'XNGS', currency: 'USD', country: 'US', instrument_type: 'Common Stock' },
        { symbol: 'ZZZ', instrument_name: 'Desconocida', exchange: '?', mic_code: 'XXXX', currency: 'USD', country: '?', instrument_type: 'Common Stock' },
      ],
    };
    const provider = new TwelveDataSymbolSearchProvider('key-de-prueba', fakeFetch(body));
    const out = await provider.search('cualquier');

    expect(out.map((m) => m.micCode)).toEqual(['BMEX', 'XNAS']); // normalizados
    expect(out.every((m) => isOperatingMic(m.micCode))).toBe(true);
    // El mercado no mapeable se omite: sin identidad canónica no se podría cotizar.
    expect(out.find((m) => m.ticker === 'ZZZ')).toBeUndefined();
  });
});

describe('CA-4 / CA-5 / CA-6: adaptador Marketstack', () => {
  it('el eco casa, toma close NO ajustado y date como asOf', async () => {
    const body = {
      data: [
        { symbol: 'ITX.BMEX', exchange: 'BMEX', date: '2026-07-14T00:00:00+0000', close: 53.72, adj_close: 99.99 },
      ],
    };
    const provider = new MarketstackProvider('key', fakeFetch(body));
    const { quotes: out } = await provider.getQuotes([{ ticker: 'ITX', micCode: 'BMEX' }]);

    expect(out).toHaveLength(1);
    expect(out[0].micCode).toBe('BMEX'); // el eco casa con lo pedido (CA-4)
    expect(out[0].price).toBe('53.72'); // close, NO adj_close (RN-12) — el adj era 99.99
    expect(out[0].asOf).toBe('2026-07-14T00:00:00.000Z'); // D-2
  });

  it('traduce el dialecto del proveedor: XETR (ISO) ↔ XETRA (Marketstack)', async () => {
    let pedido = '';
    const spyFetch = (async (url: string) => {
      pedido = String(url);
      return { ok: true, status: 200, json: async () => ({ data: [{ symbol: 'BMW.XETRA', exchange: 'XETRA', date: '2026-07-14T00:00:00+0000', close: 80.5 }] }) };
    }) as unknown as typeof fetch;

    const provider = new MarketstackProvider('key', spyFetch);
    const { quotes: out } = await provider.getQuotes([{ ticker: 'BMW', micCode: 'XETR' }]);

    expect(pedido).toContain('BMW.XETRA'); // se pide en su dialecto
    expect(out[0].micCode).toBe('XETR'); // pero el dominio recibe el canónico ISO
  });

  it('batch: N símbolos en UNA sola llamada (ADR-002)', async () => {
    let llamadas = 0;
    let pedido = '';
    const spyFetch = (async (url: string) => {
      llamadas += 1;
      pedido = String(url);
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    }) as unknown as typeof fetch;

    const provider = new MarketstackProvider('key', spyFetch);
    await provider.getQuotes([
      { ticker: 'ITX', micCode: 'BMEX' },
      { ticker: 'SAN', micCode: 'BMEX' },
      { ticker: 'AAPL', micCode: 'XNAS' },
    ]);

    expect(llamadas).toBe(1);
    // URLSearchParams codifica la coma (%2C); Marketstack la acepta (verificado 2026-07-15).
    // SPEC-020: el dialecto es POR MERCADO — BMEX lleva sufijo y XNAS va PELADO (`.XNAS`
    // es inválido para el proveedor). El batch de una llamada no cambia.
    expect(decodeURIComponent(pedido)).toContain('ITX.BMEX,SAN.BMEX,AAPL');
  });
});

describe('CA-8: resiliencia por símbolo', () => {
  it('una fila en error se omite y las demás pasan', async () => {
    const body = {
      data: [
        { symbol: 'ITX.BMEX', exchange: 'BMEX', date: '2026-07-14T00:00:00+0000', close: 53.72 },
        { symbol: 'ZZZ.BMEX', status: 'error', code: 403, message: 'not available with your plan' },
      ],
    };
    const provider = new MarketstackProvider('key', fakeFetch(body));
    const { quotes: out, failures } = await provider.getQuotes([
      { ticker: 'ITX', micCode: 'BMEX' },
      { ticker: 'ZZZ', micCode: 'BMEX' },
    ]);
    expect(out.map((o) => o.ticker)).toEqual(['ITX']); // el fallido no aborta al otro
    // SPEC-016: el fallido NO desaparece — sale con su motivo clasificado.
    expect(failures).toEqual([{ ticker: 'ZZZ', micCode: 'BMEX', reason: 'mercado_no_cubierto' }]);
  });

  // SPEC-020 CA-7 CAMBIA a propósito esta expectativa. Antes el fallo global se propagaba
  // como excepción y NADIE la capturaba: el ciclo entero moría con 500 y todos los
  // usuarios se quedaban sin refresco, sin disparos y sin avisos. Ahora degrada a fallo
  // POR SÍMBOLO. Lo que se conserva es lo esencial: el fallo no desaparece en silencio.
  it('un fallo GLOBAL (HTTP 200 con {error}) NO tumba el ciclo: sale por símbolo', async () => {
    const provider = new MarketstackProvider('key', fakeFetch({ error: { code: 'usage_limit_reached', message: 'limit' } }));
    const { quotes, failures } = await provider.getQuotes([{ ticker: 'ITX', micCode: 'BMEX' }]);

    expect(quotes).toEqual([]);
    expect(failures).toEqual([{ ticker: 'ITX', micCode: 'BMEX', reason: 'proveedor_no_disponible' }]);
  });
});

describe('CA-5: la divisa es la del SÍMBOLO (RN-09), no la del proveedor', () => {
  it('se persiste la divisa del símbolo aunque el proveedor no la devuelva', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME', name: 'Inditex' });
    // El fake devuelve una divisa DISTINTA a la del símbolo: debe ganar la del símbolo.
    const provider = new FakeMarketDataProvider({ 'ITX:BMEX': q('53.72', 'USD') });

    await refreshQuotes(db, provider);

    const [view] = await getQuoteViews(db);
    expect(view.currency).toBe('EUR'); // la del símbolo, no la del proveedor
  });
});

describe('CA-10: un símbolo sin operating MIC canónico NO se cotiza', () => {
  it('no se pide al proveedor ni se inventa su mercado', async () => {
    // Símbolo legacy sin mercado (pre ADR-007) → sin identidad canónica.
    const legacy = await getOrCreateSymbol(db, 'VIEJO', 'EUR');
    await watchSymbol(db, userA, 'VIEJO', 'EUR');
    expect(legacy.micCode).toBeNull();

    const provider = new MarketstackProvider('key', fakeFetch({ data: [] }));
    const { quotes: out, failures } = await provider.getQuotes([{ ticker: 'VIEJO', micCode: null }]);
    expect(out).toEqual([]); // no se cotiza
    expect(failures[0].reason).toBe('sin_identidad_de_mercado'); // y se dice por qué (SPEC-016)

    const res = await refreshQuotes(db, new FakeMarketDataProvider({}));
    expect(res.updated).toEqual([]);
    expect(res.skipped.map((s) => s.ticker)).toContain('VIEJO'); // se salta CON su motivo (SPEC-016)
  });
});

describe('CA-7: dedupe — 1 símbolo = 1 petición', () => {
  it('el universo pide cada símbolo una sola vez', async () => {
    const userB = (await registerUser(db, 'b@example.com', 'clave')).id;
    const market = { micCode: 'BMEX', exchange: 'BME', name: 'Inditex' };
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, market);
    await watchSymbol(db, userB, 'ITX', 'EUR', {}, market); // dos usuarios, mismo símbolo

    const universe = await symbolUniverse(db);
    expect(universe.filter((u) => u.ticker === 'ITX')).toHaveLength(1);
    expect(universe[0].currency).toBe('EUR'); // el universo lleva la divisa del símbolo
  });
});

describe('CA-9: MARKET_MAP corregido a operating MIC (cierra F-SPEC-012-1)', () => {
  it('M.CONTINUO filtra por BMEX, no por XMAD', () => {
    expect(MARKET_MAP['M.CONTINUO']).toBe('BMEX');
    const cand = (micCode: string): SymbolMatch => ({
      ticker: 'ITX', micCode, exchange: 'BME', name: 'Inditex', currency: 'EUR', country: 'ES', type: 'stock',
    });
    expect(filterByMarket([cand('BMEX')], 'M.CONTINUO')).toHaveLength(1);
    expect(filterByMarket([cand('XMAD')], 'M.CONTINUO')).toHaveLength(0); // el segmento ya no cuela
  });

  it('el resto de etiquetas del extracto mapean a operating MIC', () => {
    expect(MARKET_MAP).toMatchObject({
      NASDAQ: 'XNAS', NYSE: 'XNYS', XETRA: 'XETR', ESTOCOLMO: 'XSTO',
      'BOLSA PARIS': 'XPAR', 'BOLSA AMSTERDAM': 'XAMS',
    });
  });
});

describe('CA-11: el dominio depende del PUERTO, no del proveedor', () => {
  it('refreshQuotes funciona con cualquier adaptador', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME', name: 'Inditex' });
    const otro: MarketDataProvider = {
      getQuotes: async (reqs) => ({ quotes: reqs.map((r) => ({ ticker: r.ticker, micCode: r.micCode ?? null, price: '1.23', asOf: '2026-07-14T00:00:00.000Z' })), failures: [] }),
    };
    const res = await refreshQuotes(db, otro);
    expect(res.updated).toEqual(['ITX']);
  });
});
