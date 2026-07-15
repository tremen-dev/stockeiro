import { describe, it, expect } from 'vitest';
import { searchSymbols, runSymbolSearch, MIN_QUERY_LENGTH } from '@/lib/market/search';
import { FakeSymbolSearchProvider } from '@/lib/market/fake-search-provider';
import type { SymbolMatch } from '@/lib/market/search-provider';

const match = (over: Partial<SymbolMatch>): SymbolMatch => ({
  ticker: 'MSFT',
  micCode: 'XNAS',
  exchange: 'NASDAQ',
  name: 'Microsoft Corp',
  currency: 'USD',
  country: 'United States',
  type: 'stock',
  ...over,
});

const CATALOG: SymbolMatch[] = [
  match({ ticker: 'MSFT', micCode: 'XNAS', name: 'Microsoft Corp', currency: 'USD' }),
  // Mismo ticker en dos mercados con distinta divisa (desambiguación, CA-3).
  match({ ticker: 'SAN', micCode: 'BMEX', exchange: 'BME', name: 'Banco Santander SA', currency: 'EUR' }),
  match({ ticker: 'SAN', micCode: 'XNYS', exchange: 'NYSE', name: 'Banco Santander SA', currency: 'USD' }),
  // No-acción: debe descartarse (D-7).
  match({ ticker: 'BTC', micCode: 'XXXX', name: 'Bitcoin', currency: 'USD', type: 'crypto' }),
  match({ ticker: 'SPY', micCode: 'ARCX', name: 'SPDR S&P 500 ETF', currency: 'USD', type: 'etf' }),
];

const session = { userId: 'u-1' };

describe('CA-1: buscar por nombre resuelve el ticker', () => {
  it('busca "Microsoft" y encuentra MSFT con su identidad completa', async () => {
    const provider = new FakeSymbolSearchProvider(CATALOG);
    const results = await searchSymbols(provider, 'Microsoft');
    const msft = results.find((r) => r.ticker === 'MSFT');
    expect(msft).toBeDefined();
    expect(msft).toMatchObject({
      ticker: 'MSFT',
      micCode: 'XNAS',
      exchange: 'NASDAQ',
      name: 'Microsoft Corp',
      currency: 'USD',
    });
  });
});

describe('CA-2: solo renta variable (D-7)', () => {
  it('descarta cripto aunque el proveedor la devuelva', async () => {
    const provider = new FakeSymbolSearchProvider(CATALOG);
    const results = await searchSymbols(provider, 'Bitcoin'); // el proveedor devuelve BTC (crypto)
    expect(results).toEqual([]); // filtrado por no ser acción (D-7)
  });

  it('descarta ETF pero mantiene las acciones que matchean', async () => {
    // "SP" matchea el ETF "SPDR S&P 500" y también podría matchear acciones; solo pasan acciones.
    const provider = new FakeSymbolSearchProvider(CATALOG);
    const results = await searchSymbols(provider, 'SPDR');
    expect(results).toEqual([]); // el único match era un ETF -> fuera
    // Una consulta a una acción sí devuelve, y todo lo devuelto es acción.
    const stocks = await searchSymbols(provider, 'Santander');
    expect(stocks.length).toBeGreaterThan(0);
    expect(stocks.every((r) => r.type === 'stock')).toBe(true);
  });

  it('por debajo del umbral mínimo no consulta y devuelve vacío (CA-10 red del servidor)', async () => {
    const provider = new FakeSymbolSearchProvider(CATALOG);
    const results = await searchSymbols(provider, 'a'.repeat(MIN_QUERY_LENGTH - 1));
    expect(results).toEqual([]);
    expect(provider.calls).toHaveLength(0); // no se llamó al proveedor
  });
});

describe('CA-3: desambiguación por mercado', () => {
  it('el mismo ticker en dos mercados aparece como opciones distintas por micCode/divisa', async () => {
    const provider = new FakeSymbolSearchProvider(CATALOG);
    const results = await searchSymbols(provider, 'Santander');
    const san = results.filter((r) => r.ticker === 'SAN');
    expect(san).toHaveLength(2);
    expect(new Set(san.map((r) => r.micCode))).toEqual(new Set(['BMEX', 'XNYS']));
    expect(new Set(san.map((r) => r.currency))).toEqual(new Set(['EUR', 'USD']));
  });
});

describe('CA-7: la búsqueda exige sesión (RN-03)', () => {
  it('sin sesión responde unauthorized y NO consulta al proveedor', async () => {
    const provider = new FakeSymbolSearchProvider(CATALOG);
    const outcome = await runSymbolSearch({ session: null, provider, query: 'Microsoft' });
    expect(outcome.status).toBe('unauthorized');
    expect(provider.calls).toHaveLength(0);
  });

  it('con sesión válida devuelve resultados', async () => {
    const provider = new FakeSymbolSearchProvider(CATALOG);
    const outcome = await runSymbolSearch({ session, provider, query: 'Microsoft' });
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') expect(outcome.results.map((r) => r.ticker)).toContain('MSFT');
  });
});

describe('CA-8: resiliencia del proveedor', () => {
  it('si el proveedor falla responde error, sin lanzar', async () => {
    const provider = new FakeSymbolSearchProvider(CATALOG, { fail: true });
    const outcome = await runSymbolSearch({ session, provider, query: 'Microsoft' });
    expect(outcome.status).toBe('error');
  });
});
