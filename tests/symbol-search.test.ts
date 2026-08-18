import { describe, it, expect } from 'vitest';
import { searchSymbols, runSymbolSearch, MIN_QUERY_LENGTH } from '@/lib/market/search';
import { FakeSymbolSearchProvider } from '@/lib/market/fake-search-provider';
import { TwelveDataSymbolSearchProvider } from '@/lib/market/twelve-data-search-provider';
import type { SymbolMatch, DiscardedSymbol } from '@/lib/market/search-provider';

const match = (over: Partial<SymbolMatch>): SymbolMatch => ({
  ticker: 'MSFT',
  micCode: 'XNAS',
  exchange: 'NASDAQ',
  name: 'Microsoft Corp',
  currency: 'USD',
  country: 'United States',
  instrumentType: 'Common Stock',
  ...over,
});

const CATALOG: SymbolMatch[] = [
  match({ ticker: 'MSFT', micCode: 'XNAS', name: 'Microsoft Corp', currency: 'USD' }),
  // Mismo ticker en dos mercados con distinta divisa (desambiguación, CA-3 de SPEC-008).
  match({ ticker: 'SAN', micCode: 'BMEX', exchange: 'BME', name: 'Banco Santander SA', currency: 'EUR' }),
  match({ ticker: 'SAN', micCode: 'XNYS', exchange: 'NYSE', name: 'Banco Santander SA', currency: 'USD' }),
];

const session = { userId: 'u-1' };

/**
 * SPEC-029 — el buscador ofrece cualquier instrumento del mercado soportado.
 *
 * Los tests de adaptador corren contra **fixtures de la respuesta real** de
 * `/symbol_search` capturada el 2026-08-18 (mismo patrón que
 * `tests/quote-diagnostics.test.ts` CA-1): sin red, pero con los datos que de
 * verdad devuelve Twelve Data para las tres búsquedas que reportó el humano.
 */
const fakeFetch = (body: unknown) =>
  (async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;

/** Fila cruda de `/symbol_search` tal como la devolvió el proveedor el 2026-08-18. */
const ROW_ORC = {
  symbol: 'ORC',
  instrument_name: 'Orchid Island Capital Inc.',
  exchange: 'NYSE',
  mic_code: 'XNYS',
  currency: 'USD',
  country: 'United States',
  instrument_type: 'REIT',
};
const ROW_LX = {
  symbol: 'LX',
  instrument_name: 'LexinFintech Holdings Ltd. ADS',
  exchange: 'NASDAQ',
  mic_code: 'XNGS',
  currency: 'USD',
  country: 'United States',
  instrument_type: 'American Depositary Receipt',
};
const ROW_UPWK = {
  symbol: 'UPWK',
  instrument_name: 'Upwork Inc.',
  exchange: 'NASDAQ',
  mic_code: 'XNGS',
  currency: 'USD',
  country: 'United States',
  instrument_type: 'Common Stock',
};
const ROW_IWDA = {
  symbol: 'IWDA',
  instrument_name: 'iShares Core MSCI World UCITS ETF USD (Acc)',
  exchange: 'Euronext Amsterdam',
  mic_code: 'XAMS',
  currency: 'EUR',
  country: 'Netherlands',
  instrument_type: 'ETF',
};
/** Mercado NO soportado: Londres no está entre los 7 operating MIC de `mic.ts`. */
const ROW_TSCO = {
  symbol: 'TSCO',
  instrument_name: 'Tesco PLC',
  exchange: 'LSE',
  mic_code: 'XLON',
  currency: 'GBp',
  country: 'United Kingdom',
  instrument_type: 'Common Stock',
};

const provider = (body: unknown) => new TwelveDataSymbolSearchProvider('key', fakeFetch(body));

describe('CA-1: un REIT se encuentra y se puede elegir', () => {
  it('«orchid island» devuelve ORC@XNYS en USD, con su tipo, entre los candidatos', async () => {
    const { matches, discarded } = await provider({ data: [ROW_ORC] }).search('orchid island');
    expect(matches).toEqual([
      {
        ticker: 'ORC',
        micCode: 'XNYS',
        exchange: 'NYSE',
        name: 'Orchid Island Capital Inc.',
        currency: 'USD',
        country: 'United States',
        instrumentType: 'REIT',
      },
    ]);
    expect(discarded).toEqual([]);
  });

  it('el dominio no lo vuelve a tirar: llega entero a `searchSymbols`', async () => {
    const p = new FakeSymbolSearchProvider([
      match({ ticker: 'ORC', micCode: 'XNYS', exchange: 'NYSE', name: 'Orchid Island Capital Inc.', instrumentType: 'REIT' }),
    ]);
    const { matches } = await searchSymbols(p, 'orchid island');
    expect(matches.map((m) => m.ticker)).toEqual(['ORC']);
  });
});

describe('CA-2: un ADR se encuentra y se puede elegir', () => {
  it('«lexinfintech» devuelve LX con el segmento XNGS normalizado a XNAS (ADR-012)', async () => {
    const { matches, discarded } = await provider({ data: [ROW_LX] }).search('lexinfintech');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      ticker: 'LX',
      micCode: 'XNAS',
      currency: 'USD',
      instrumentType: 'American Depositary Receipt',
    });
    expect(discarded).toEqual([]);
  });
});

describe('CA-3: no hay regresión — la acción común sigue pasando', () => {
  it('«upwork» devuelve UPWK@XNAS en USD, exactamente como antes', async () => {
    const { matches } = await provider({ data: [ROW_UPWK] }).search('upwork');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ ticker: 'UPWK', micCode: 'XNAS', currency: 'USD' });
  });
});

describe('CA-4: un ETF en mercado soportado entra, y eso es querido', () => {
  // INVERSIÓN DELIBERADA de CA-2 de SPEC-008 («solo renta variable», D-7), por
  // ADR-020 (aprobado 2026-08-18): el tipo deja de filtrar y pasa a mostrarse.
  // No es una regresión colada: es la decisión, y aquí queda escrita.
  it('un ETF de Euronext Ámsterdam aparece entre los candidatos', async () => {
    const { matches, discarded } = await provider({ data: [ROW_IWDA] }).search('ishares core msci world');
    expect(matches.map((m) => m.ticker)).toEqual(['IWDA']);
    expect(matches[0].micCode).toBe('XAMS');
    expect(discarded).toEqual([]);
  });

  it('el dominio tampoco lo filtra', async () => {
    const p = new FakeSymbolSearchProvider([
      match({ ticker: 'IWDA', micCode: 'XAMS', exchange: 'Euronext Amsterdam', name: 'iShares Core MSCI World UCITS ETF', currency: 'EUR', instrumentType: 'ETF' }),
    ]);
    const { matches } = await searchSymbols(p, 'ishares');
    expect(matches.map((m) => m.ticker)).toEqual(['IWDA']);
  });
});

describe('CA-5: ninguna capa filtra por tipo — el defecto no puede volver', () => {
  const INVENTADO = 'Closed-End Fund';
  const OTRO_INVENTADO = 'Zzz Instrumento Que Nadie Ha Previsto';

  it('un `instrument_type` que nadie ha previsto pasa igual por el adaptador', async () => {
    const raro = { ...ROW_UPWK, symbol: 'RARO', instrument_name: 'Cosa Rara', instrument_type: INVENTADO };
    const arbitrario = { ...ROW_ORC, symbol: 'ARB', instrument_name: 'Cosa Arbitraria', instrument_type: OTRO_INVENTADO };
    const { matches, discarded } = await provider({ data: [raro, arbitrario] }).search('cosa');
    expect(matches.map((m) => m.ticker)).toEqual(['RARO', 'ARB']);
    expect(matches.map((m) => m.instrumentType)).toEqual([INVENTADO, OTRO_INVENTADO]);
    expect(discarded).toEqual([]);
  });

  it('y pasa igual por el dominio', async () => {
    const p = new FakeSymbolSearchProvider([
      match({ ticker: 'RARO', name: 'Cosa Rara', instrumentType: INVENTADO }),
      match({ ticker: 'ARB', name: 'Cosa Arbitraria', instrumentType: OTRO_INVENTADO }),
    ]);
    const { matches } = await searchSymbols(p, 'cosa');
    expect(matches.map((m) => m.ticker)).toEqual(['RARO', 'ARB']);
  });

  it('lo que antes se caía por no ser «stock» —cripto y ETF— ya solo se juzga por su mercado', async () => {
    // El filtro de D-7 tiraba estas dos filas por su tipo. Hoy el único filtro es el
    // mercado: la cripto se cae por XXXX (no soportado) y el ETF de XNYS entra.
    const cripto = { ...ROW_UPWK, symbol: 'BTC/USD', instrument_name: 'Bitcoin', mic_code: 'XXXX', instrument_type: 'Digital Currency' };
    const etfUs = { ...ROW_ORC, symbol: 'SPY', instrument_name: 'SPDR S&P 500 ETF Trust', instrument_type: 'ETF' };
    const { matches, discarded } = await provider({ data: [cripto, etfUs] }).search('x');
    expect(matches.map((m) => m.ticker)).toEqual(['SPY']);
    expect(discarded.map((d) => d.ticker)).toEqual(['BTC/USD']);
    expect(discarded[0].reason).toBe('mercado_no_soportado');
  });
});

describe('CA-6: el tipo del proveedor llega íntegro al dominio, sin normalizar', () => {
  it('la etiqueta viaja tal cual: ni «stock», ni minúsculas, ni vacío', async () => {
    const { matches } = await provider({ data: [ROW_ORC, ROW_LX, ROW_UPWK, ROW_IWDA] }).search('x');
    expect(matches.map((m) => m.instrumentType)).toEqual([
      'REIT',
      'American Depositary Receipt',
      'Common Stock',
      'ETF',
    ]);
    // El adaptador ya no aplasta nada a 'stock' ni baja a minúsculas.
    expect(matches.map((m) => m.instrumentType)).not.toContain('stock');
  });

  it('una fila SIN `instrument_type` deja el campo vacío y NO se descarta', async () => {
    const sinTipo = { ...ROW_UPWK, instrument_type: undefined };
    const { matches, discarded } = await provider({ data: [sinTipo] }).search('upwork');
    expect(matches).toHaveLength(1);
    expect(matches[0].instrumentType).toBe('');
    expect(discarded).toEqual([]);
  });
});

describe('CA-7: descarte por mercado no soportado — se reporta, con su mercado', () => {
  it('XLON no sale entre candidatos y sí entre descartes, con su mic y su exchange', async () => {
    const { matches, discarded } = await provider({ data: [ROW_TSCO] }).search('tesco');
    expect(matches).toEqual([]);
    expect(discarded).toEqual([
      {
        ticker: 'TSCO',
        name: 'Tesco PLC',
        micCode: 'XLON',
        exchange: 'LSE',
        reason: 'mercado_no_soportado',
      },
    ]);
  });

  it('acompañada de otras filas, solo se cae la suya (matches y discarded son DISJUNTOS)', async () => {
    // F-SPEC-016-3: un símbolo salía a la vez en `quotes` y en `failures`. Aquí se
    // asertan los DOS conjuntos con igualdad estricta, no solo la presencia del propio.
    const { matches, discarded } = await provider({ data: [ROW_ORC, ROW_TSCO, ROW_IWDA] }).search('x');
    expect(matches.map((m) => m.ticker)).toEqual(['ORC', 'IWDA']);
    expect(discarded.map((d) => d.ticker)).toEqual(['TSCO']);
    const enAmbos = matches.filter((m) => discarded.some((d) => d.ticker === m.ticker));
    expect(enAmbos).toEqual([]);
  });
});

describe('CA-8: descarte por falta de identidad de mercado — se reporta', () => {
  it('una fila sin `mic_code` va a descartes con motivo `sin_identidad_de_mercado`', async () => {
    const sinMic = { ...ROW_UPWK, mic_code: undefined };
    const { matches, discarded } = await provider({ data: [sinMic] }).search('upwork');
    expect(matches).toEqual([]);
    expect(discarded).toEqual([
      { ticker: 'UPWK', name: 'Upwork Inc.', micCode: '', exchange: 'NASDAQ', reason: 'sin_identidad_de_mercado' },
    ]);
  });

  it('los dos motivos conviven en la misma respuesta, cada fila con el suyo', async () => {
    const sinMic = { ...ROW_LX, mic_code: '' };
    const { matches, discarded } = await provider({ data: [ROW_ORC, ROW_TSCO, sinMic] }).search('x');
    expect(matches.map((m) => m.ticker)).toEqual(['ORC']);
    expect(discarded.map((d) => [d.ticker, d.reason])).toEqual([
      ['TSCO', 'mercado_no_soportado'],
      ['LX', 'sin_identidad_de_mercado'],
    ]);
  });
});

describe('CA-9: tres desenlaces distinguibles en el resultado del dominio', () => {
  const orc = match({ ticker: 'ORC', micCode: 'XNYS', exchange: 'NYSE', name: 'Orchid Island Capital Inc.', instrumentType: 'REIT' });
  const tsco: DiscardedSymbol = {
    ticker: 'TSCO', name: 'Tesco PLC', micCode: 'XLON', exchange: 'LSE', reason: 'mercado_no_soportado',
  };

  it('(a) no existe: sin candidatos y SIN descartes', async () => {
    const p = new FakeSymbolSearchProvider([orc], { discarded: [tsco] });
    const outcome = await runSymbolSearch({ session, provider: p, query: 'nombrequenoexiste' });
    expect(outcome).toEqual({ status: 'ok', results: [], discarded: [] });
  });

  it('(b) todo descartado: sin candidatos y CON descartes, con sus motivos', async () => {
    const p = new FakeSymbolSearchProvider([orc], { discarded: [tsco] });
    const outcome = await runSymbolSearch({ session, provider: p, query: 'tesco' });
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.results).toEqual([]);
    expect(outcome.discarded).toEqual([tsco]);
  });

  it('(c) hay candidatos: se muestran, y los descartes van al lado sin impedirlo', async () => {
    const p = new FakeSymbolSearchProvider([match({ ticker: 'TSCA', name: 'Tesco Digital SA' }), orc], { discarded: [tsco] });
    const outcome = await runSymbolSearch({ session, provider: p, query: 'tesco' });
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.results.map((r) => r.ticker)).toEqual(['TSCA']);
    expect(outcome.discarded.map((d) => d.ticker)).toEqual(['TSCO']);
  });

  it('por debajo del umbral mínimo no consulta y no hay ni candidatos ni descartes', async () => {
    const p = new FakeSymbolSearchProvider(CATALOG);
    const res = await searchSymbols(p, 'a'.repeat(MIN_QUERY_LENGTH - 1));
    expect(res).toEqual({ matches: [], discarded: [] });
    expect(p.calls).toHaveLength(0);
  });
});

describe('CA-17: sesión y resiliencia intactas, y distinguibles de los otros desenlaces', () => {
  it('sin sesión responde unauthorized y NO consulta al proveedor (RN-03)', async () => {
    const p = new FakeSymbolSearchProvider(CATALOG);
    const outcome = await runSymbolSearch({ session: null, provider: p, query: 'Microsoft' });
    expect(outcome).toEqual({ status: 'unauthorized' });
    expect(p.calls).toHaveLength(0);
  });

  it('con sesión válida devuelve resultados', async () => {
    const p = new FakeSymbolSearchProvider(CATALOG);
    const outcome = await runSymbolSearch({ session, provider: p, query: 'Microsoft' });
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') expect(outcome.results.map((r) => r.ticker)).toContain('MSFT');
  });

  it('si el proveedor falla responde error, sin lanzar', async () => {
    const p = new FakeSymbolSearchProvider(CATALOG, { fail: true });
    const outcome = await runSymbolSearch({ session, provider: p, query: 'Microsoft' });
    expect(outcome).toEqual({ status: 'error' });
  });

  it('error, «no existe» y «todo descartado» son TRES estados distintos', async () => {
    const tsco: DiscardedSymbol = {
      ticker: 'TSCO', name: 'Tesco PLC', micCode: 'XLON', exchange: 'LSE', reason: 'mercado_no_soportado',
    };
    const caido = await runSymbolSearch({ session, provider: new FakeSymbolSearchProvider([], { fail: true }), query: 'tesco' });
    const inexistente = await runSymbolSearch({ session, provider: new FakeSymbolSearchProvider([]), query: 'tesco' });
    const descartado = await runSymbolSearch({ session, provider: new FakeSymbolSearchProvider([], { discarded: [tsco] }), query: 'tesco' });

    expect(caido).toEqual({ status: 'error' });
    expect(inexistente).toEqual({ status: 'ok', results: [], discarded: [] });
    expect(descartado).toEqual({ status: 'ok', results: [], discarded: [tsco] });
    // Ninguno se confunde con otro: el error no trae listas y los dos «ok» difieren.
    expect(descartado).not.toEqual(inexistente);
    expect(descartado).not.toEqual(caido);
  });
});

describe('CA-3 de SPEC-008 (no regresión): desambiguación por mercado', () => {
  it('el mismo ticker en dos mercados aparece como opciones distintas por micCode/divisa', async () => {
    const p = new FakeSymbolSearchProvider(CATALOG);
    const { matches } = await searchSymbols(p, 'Santander');
    const san = matches.filter((r) => r.ticker === 'SAN');
    expect(san).toHaveLength(2);
    expect(new Set(san.map((r) => r.micCode))).toEqual(new Set(['BMEX', 'XNYS']));
    expect(new Set(san.map((r) => r.currency))).toEqual(new Set(['EUR', 'USD']));
  });
});
