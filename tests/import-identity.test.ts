import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { symbols, symbolAliases } from '@/db/schema';
import { FakeSymbolSearchProvider } from '@/lib/market/fake-search-provider';
import type { SymbolSearchProvider, SymbolMatch } from '@/lib/market/search-provider';
import type { OperacionImportada } from '@/lib/import/statement-reader';
import {
  resolverValor,
  resolverValores,
  confirmarSeleccion,
  fusionarValor,
  distinctValores,
  particionar,
  runResolucion,
} from '@/lib/import/identity';

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

const op = (
  nombreBroker: string,
  etiquetaMercado: string,
  over: Partial<OperacionImportada> = {},
): OperacionImportada => ({
  occurredOn: '2026-01-01',
  side: 'buy',
  nombreBroker,
  etiquetaMercado,
  cantidad: '10',
  precioOrigen: '1',
  importeEur: '10',
  ...over,
});

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

const valor = (nombreBroker: string, etiquetaMercado: string) => ({ nombreBroker, etiquetaMercado });

describe('CA-1: filtro por mercado (etiqueta → operating MIC)', () => {
  it('mismo nombre en dos mercados: solo se ofrece el de la etiqueta', async () => {
    // ADR-012: el puerto entrega el MIC CANÓNICO (operating). La normalización de
    // sub-MICs (XNGS→XNAS) la hace el adaptador de búsqueda, no este filtro.
    const provider = new FakeSymbolSearchProvider([
      match({ ticker: 'MSFT', micCode: 'XNAS', exchange: 'NASDAQ', name: 'Microsoft Corp' }),
      match({ ticker: 'MSFT', micCode: 'BMEX', exchange: 'BME', name: 'Microsoft Corp', currency: 'EUR' }),
    ]);
    const r = await resolverValor(db, userA, provider, valor('MICROSOFT', 'NASDAQ'));
    expect(r.estado).toBe('suggested');
    expect(r.candidatos).toHaveLength(1);
    expect(r.candidatos![0].micCode).toBe('XNAS'); // el candidato de BMEX se excluye
  });
});

describe('CA-2: búsqueda por nombre vía puerto', () => {
  it('resuelve INDITEX → ITX/BMEX consultando el proveedor', async () => {
    const provider = new FakeSymbolSearchProvider([
      match({ ticker: 'ITX', micCode: 'BMEX', exchange: 'BME', name: 'Inditex SA', currency: 'EUR' }),
    ]);
    const r = await resolverValor(db, userA, provider, valor('INDITEX', 'M.CONTINUO'));
    expect(provider.calls).toContain('INDITEX');
    expect(r.estado).toBe('suggested');
    expect(r.candidatos![0]).toMatchObject({ ticker: 'ITX', micCode: 'BMEX', currency: 'EUR' });
  });
});

describe('CA-3: ambiguo o sin coincidencia → sin resolver (no auto-asigna)', () => {
  it('varios candidatos del mismo mercado → ambiguous sin symbolId', async () => {
    const provider = new FakeSymbolSearchProvider([
      match({ ticker: 'SAN', micCode: 'BMEX', exchange: 'BME', name: 'Banco Santander', currency: 'EUR' }),
      match({ ticker: 'SAN.P', micCode: 'BMEX', exchange: 'BME', name: 'Banco Santander pref', currency: 'EUR' }),
    ]);
    const r = await resolverValor(db, userA, provider, valor('SANTANDER', 'M.CONTINUO'));
    expect(r.estado).toBe('ambiguous');
    expect(r.candidatos).toHaveLength(2);
    expect(r.symbolId).toBeUndefined();
  });

  it('sin candidatos → unmatched sin symbolId', async () => {
    const provider = new FakeSymbolSearchProvider([match({ ticker: 'MSFT', name: 'Microsoft Corp' })]);
    const r = await resolverValor(db, userA, provider, valor('NOEXISTE', 'NASDAQ'));
    expect(r.estado).toBe('unmatched');
    expect(r.symbolId).toBeUndefined();
  });
});

describe('CA-4: la selección del usuario fija la identidad', () => {
  it('confirmar crea el símbolo (ticker,micCode,currency) y persiste el alias', async () => {
    const chosen = match({ ticker: 'ITX', micCode: 'BMEX', exchange: 'BME', name: 'Inditex SA', currency: 'EUR' });
    const { symbolId } = await confirmarSeleccion(db, userA, valor('INDITEX', 'M.CONTINUO'), chosen);

    const [sym] = await db.select().from(symbols).where(eq(symbols.id, symbolId));
    expect(sym).toMatchObject({ ticker: 'ITX', micCode: 'BMEX', currency: 'EUR' });

    const [alias] = await db
      .select()
      .from(symbolAliases)
      .where(and(eq(symbolAliases.userId, userA), eq(symbolAliases.brokerName, 'INDITEX')));
    expect(alias.symbolId).toBe(symbolId);
    expect(alias.marketLabel).toBe('M.CONTINUO');
  });
});

describe('CA-5: lo no resuelto no pasa a registro', () => {
  it('particiona en resueltas (con symbolId) y pendientes', async () => {
    const provider = new FakeSymbolSearchProvider([
      match({ ticker: 'ITX', micCode: 'BMEX', exchange: 'BME', name: 'Inditex SA', currency: 'EUR' }),
    ]);
    const ops = [op('INDITEX', 'M.CONTINUO'), op('NOEXISTE', 'NASDAQ')];
    // Confirmar solo INDITEX; NOEXISTE queda sin resolver.
    await confirmarSeleccion(db, userA, valor('INDITEX', 'M.CONTINUO'), match({ ticker: 'ITX', micCode: 'BMEX', currency: 'EUR', name: 'Inditex SA' }));

    const resoluciones = await resolverValores(db, userA, provider, ops);
    const { resueltas, pendientes } = particionar(ops, resoluciones);
    expect(resueltas.map((r) => r.op.nombreBroker)).toEqual(['INDITEX']);
    expect(pendientes.map((p) => p.nombreBroker)).toEqual(['NOEXISTE']);
    expect(resueltas[0].symbolId).toBeTruthy();
  });
});

describe('CA-6: resolución recordada, sin re-preguntar', () => {
  it('tras confirmar, re-resolver da remembered sin consultar al proveedor', async () => {
    await confirmarSeleccion(db, userA, valor('INDITEX', 'M.CONTINUO'), match({ ticker: 'ITX', micCode: 'BMEX', currency: 'EUR', name: 'Inditex SA' }));
    const provider = new FakeSymbolSearchProvider([match({ ticker: 'ITX', name: 'Inditex SA' })]);
    const r = await resolverValor(db, userA, provider, valor('INDITEX', 'M.CONTINUO'));
    expect(r.estado).toBe('remembered');
    expect(r.symbolId).toBeTruthy();
    expect(provider.calls).toHaveLength(0); // NO se consultó al proveedor
  });
});

describe('CA-7: fusión manual de eventos corporativos (sin re-escalar)', () => {
  it('dos nombres al mismo símbolo → mismo symbolId y aviso de fusión (split)', async () => {
    const phm = match({ ticker: 'PHM', micCode: 'BMEX', exchange: 'BME', name: 'Pharma Mar', currency: 'EUR' });
    const a = await confirmarSeleccion(db, userA, valor('PHARMAMAR', 'M.CONTINUO'), phm);
    expect(a.fused).toBe(false); // primer alias, aún no hay fusión

    const b = await confirmarSeleccion(db, userA, valor('PHARMA MAR', 'M.CONTINUO'), phm);
    expect(b.symbolId).toBe(a.symbolId); // mismo símbolo
    expect(b.fused).toBe(true); // el símbolo ya lo usaba otro alias → aviso de split

    const aliases = await db.select().from(symbolAliases).where(eq(symbolAliases.userId, userA));
    expect(new Set(aliases.map((x) => x.symbolId))).toEqual(new Set([a.symbolId])); // ambos → mismo símbolo
  });

  it('fusionarValor apunta un valor a un símbolo ya resuelto, con aviso', async () => {
    const { symbolId } = await confirmarSeleccion(db, userA, valor('PHARMAMAR', 'M.CONTINUO'), match({ ticker: 'PHM', micCode: 'BMEX', currency: 'EUR', name: 'Pharma Mar' }));
    const f = await fusionarValor(db, userA, valor('PHARMA MAR', 'M.CONTINUO'), symbolId);
    expect(f).toEqual({ symbolId, fused: true });
  });
});

describe('CA-8: independiente por defecto', () => {
  it('dos nombres distintos se resuelven por separado, sin fusión automática', async () => {
    const provider = new FakeSymbolSearchProvider([
      match({ ticker: 'ITX', micCode: 'BMEX', exchange: 'BME', name: 'Inditex SA', currency: 'EUR' }),
      match({ ticker: 'SAN', micCode: 'BMEX', exchange: 'BME', name: 'Banco Santander', currency: 'EUR' }),
    ]);
    const ops = [op('INDITEX', 'M.CONTINUO'), op('SANTANDER', 'M.CONTINUO')];
    expect(distinctValores(ops)).toHaveLength(2);
    const res = await resolverValores(db, userA, provider, ops);
    expect(res.map((r) => r.nombreBroker)).toEqual(['INDITEX', 'SANTANDER']);
    // cada uno con su candidato, sin symbolId compartido ni fusión.
    expect(res.every((r) => r.estado === 'suggested')).toBe(true);
    expect(res[0].candidatos![0].ticker).toBe('ITX');
    expect(res[1].candidatos![0].ticker).toBe('SAN');
  });
});

describe('CA-9 (INVERTIDO por ADR-020 — SPEC-029 CA-16): el import ya no filtra por tipo', () => {
  // Este bloque asertaba lo contrario: «solo acciones (D-7)». ADR-020, aprobado por el
  // humano el 2026-08-18, supersede D-7 en su parte de filtro — el tipo deja de juzgarse
  // y pasa a mostrarse, y el mercado es el único filtro. La expectativa se INVIERTE a
  // propósito y se deja anotada aquí para que el histórico diga que fue una decisión y
  // no una regresión colada. Ver SPEC-029 CA-16.
  it('un ETF del mismo mercado se OFRECE como candidato, ya no se descarta', async () => {
    const provider = new FakeSymbolSearchProvider([
      match({ ticker: 'IAU', micCode: 'XNYS', exchange: 'NYSE', name: 'Gold Trust', instrumentType: 'ETF' }),
      match({ ticker: 'GOLD', micCode: 'XNYS', exchange: 'NYSE', name: 'Barrick Gold', instrumentType: 'Common Stock' }),
    ]);
    const r = await resolverValor(db, userA, provider, valor('GOLD', 'NYSE'));
    expect(r.candidatos!.map((c) => c.ticker).sort()).toEqual(['GOLD', 'IAU']);
    expect(r.estado).toBe('ambiguous'); // dos candidatos: elige el usuario, no filtramos por él
  });

  it('el resto de la resolución se comporta IGUAL: el mercado sigue filtrando', async () => {
    const provider = new FakeSymbolSearchProvider([
      match({ ticker: 'IWDA', micCode: 'XAMS', exchange: 'Euronext Amsterdam', name: 'iShares Core MSCI World', currency: 'EUR', instrumentType: 'ETF' }),
      match({ ticker: 'IWDA', micCode: 'XNYS', exchange: 'NYSE', name: 'iShares Core MSCI World', instrumentType: 'ETF' }),
    ]);
    const r = await resolverValor(db, userA, provider, valor('IWDA', 'BOLSA AMSTERDAM'));
    expect(r.estado).toBe('suggested');
    expect(r.candidatos!.map((c) => c.micCode)).toEqual(['XAMS']);
  });
});

describe('CA-10: aislamiento y acceso (RN-01/RN-03)', () => {
  it('sin sesión válida rechaza y no consulta al proveedor', async () => {
    const provider = new FakeSymbolSearchProvider([match({ ticker: 'ITX', name: 'Inditex SA' })]);
    const outcome = await runResolucion({ session: null, db, provider, ops: [op('INDITEX', 'M.CONTINUO')] });
    expect(outcome.status).toBe('unauthorized');
    expect(provider.calls).toHaveLength(0);
  });

  it('el alias recordado de un usuario no lo ve otro', async () => {
    await confirmarSeleccion(db, userA, valor('INDITEX', 'M.CONTINUO'), match({ ticker: 'ITX', micCode: 'BMEX', currency: 'EUR', name: 'Inditex SA' }));
    const provider = new FakeSymbolSearchProvider([match({ ticker: 'ITX', micCode: 'BMEX', exchange: 'BME', name: 'Inditex SA', currency: 'EUR' })]);
    const rB = await resolverValor(db, userB, provider, valor('INDITEX', 'M.CONTINUO'));
    expect(rB.estado).not.toBe('remembered'); // B no hereda el alias de A
    expect(provider.calls).toContain('INDITEX'); // B sí consulta (no tiene recuerdo)
  });
});

describe('CA-11: resiliencia del proveedor por valor', () => {
  it('si el proveedor falla para un valor, ese queda error y los demás resuelven', async () => {
    const flaky: SymbolSearchProvider = {
      search: async (q: string) => {
        if (q.includes('BADCO')) throw new Error('proveedor caído (simulado)');
        return { matches: [match({ ticker: 'GOOD', micCode: 'XNAS', exchange: 'NASDAQ', name: 'Good Co' })], discarded: [] };
      },
    };
    const ops = [op('GOODCO', 'NASDAQ'), op('BADCO', 'NASDAQ')];
    const res = await resolverValores(db, userA, flaky, ops);
    const byName = Object.fromEntries(res.map((r) => [r.nombreBroker, r.estado]));
    expect(byName['BADCO']).toBe('error');
    expect(byName['GOODCO']).toBe('suggested'); // no se abortó por el fallo del otro
  });
});
