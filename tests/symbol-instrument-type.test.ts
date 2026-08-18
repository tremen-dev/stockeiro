import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { symbols } from '@/db/schema';
import { getOrCreateSymbol } from '@/lib/portfolio/symbols';
import { watchSymbol } from '@/lib/watchlist/service';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';
import { readSymbolSelection } from '@/lib/market/symbol-selection';
import { instrumentTypeText } from '@/lib/market/instrument-type-text';
import { marketName } from '@/lib/market/market-name';

/**
 * SPEC-029 — el tipo se persiste con el símbolo (CA-15) y la proyección de
 * `/vigiladas` lleva tipo (CA-13) y mercado (CA-14) hasta la tabla.
 */

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

describe('CA-15: el tipo viaja del buscador al símbolo persistido', () => {
  it('la selección del formulario lleva el `instrumentType` del candidato elegido', () => {
    const sel = readSymbolSelection(
      form({ ticker: 'orc', micCode: 'XNYS', exchange: 'NYSE', name: 'Orchid Island Capital Inc.', currency: 'USD', instrumentType: 'REIT' }),
    );
    expect(sel).not.toBeNull();
    expect(sel!.market.instrumentType).toBe('REIT');
  });

  it('un candidato SIN tipo deja la identidad de mercado sin tipo (null), no cadena vacía', () => {
    const sel = readSymbolSelection(form({ ticker: 'ITX', micCode: 'BMEX', currency: 'EUR' }));
    expect(sel!.market.instrumentType).toBeNull();
  });

  it('`getOrCreateSymbol` persiste el tipo en el símbolo COMPARTIDO', async () => {
    const sym = await getOrCreateSymbol(db, 'ORC', 'USD', {
      micCode: 'XNYS', exchange: 'NYSE', name: 'Orchid Island Capital Inc.', instrumentType: 'REIT',
    });
    expect(sym.instrumentType).toBe('REIT');
    const [row] = await db.select().from(symbols).where(eq(symbols.id, sym.id));
    expect(row.instrumentType).toBe('REIT');
  });

  it('un tipo desconocido se persiste EN CRUDO: la base tampoco tiene lista blanca', async () => {
    const sym = await getOrCreateSymbol(db, 'RARO', 'USD', { micCode: 'XNAS', instrumentType: 'Closed-End Fund' });
    expect(sym.instrumentType).toBe('Closed-End Fund');
  });

  it('un símbolo creado sin tipo lo deja NULL (sin default inventado)', async () => {
    const sym = await getOrCreateSymbol(db, 'ITX', 'EUR', { micCode: 'BMEX', exchange: 'BME' });
    expect(sym.instrumentType).toBeNull();
  });
});

describe('CA-13/CA-14/CA-15: la proyección de /vigiladas lleva tipo y mercado', () => {
  it('CA-13: cada fila lleva el tipo de su símbolo hasta la tabla', async () => {
    await watchSymbol(db, userA, 'ORC', 'USD', {}, {
      micCode: 'XNYS', exchange: 'NYSE', name: 'Orchid Island Capital Inc.', instrumentType: 'REIT',
    });
    const [fila] = await zoneStatusForUser(db, userA);
    expect(fila.instrumentType).toBe('REIT');
    expect(instrumentTypeText(fila.instrumentType)).toBe('REIT');
  });

  it('CA-14: dos filas del MISMO ticker en mercados distintos se distinguen por la celda de mercado', async () => {
    // Identidades distintas por ADR-007. Hoy las dos filas se ven iguales; con la
    // columna de mercado dejan de serlo SIN mirar precios ni zonas. Cierra F-SPEC-024-1.
    await watchSymbol(db, userA, 'SAN', 'EUR', { buyMin: 4, buyMax: 5 }, {
      micCode: 'BMEX', exchange: 'BME', name: 'Banco Santander SA', instrumentType: 'Common Stock',
    });
    await watchSymbol(db, userA, 'SAN', 'USD', { buyMin: 4, buyMax: 5 }, {
      micCode: 'XNYS', exchange: 'NYSE', name: 'Banco Santander SA', instrumentType: 'Common Stock',
    });

    const filas = await zoneStatusForUser(db, userA);
    expect(filas.map((f) => f.ticker)).toEqual(['SAN', 'SAN']);
    const mercados = filas.map((f) => marketName(f.micCode)).sort();
    expect(mercados).toEqual(['BME', 'NYSE']);
    expect(new Set(mercados).size).toBe(2); // distinguibles por esa celda, y solo por ella
  });

  it('CA-14: el mercado sale de `micCode`, NO de `exchange` (texto libre del proveedor)', async () => {
    // Dos símbolos del MISMO mercado guardados con `exchange` distinto —lo que pasa
    // cuando el proveedor cambia su rótulo— quedan rotulados IGUAL en la tabla.
    await watchSymbol(db, userA, 'AAA', 'USD', {}, { micCode: 'XNAS', exchange: 'NASDAQ' });
    await watchSymbol(db, userA, 'BBB', 'USD', {}, { micCode: 'XNAS', exchange: 'Nasdaq Global Select' });
    const filas = await zoneStatusForUser(db, userA);
    expect(filas.map((f) => marketName(f.micCode))).toEqual(['NASDAQ', 'NASDAQ']);
  });

  it('CA-15: las tres combinaciones que existen de verdad en la base no rompen, y las celdas ausentes quedan VACÍAS', async () => {
    // (1) con tipo y con mercado
    await watchSymbol(db, userA, 'ORC', 'USD', {}, { micCode: 'XNYS', exchange: 'NYSE', instrumentType: 'REIT' });
    // (2) sin tipo y con mercado — símbolo creado entre ADR-007 y esta spec
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME' });
    // (3) legacy: sin tipo y sin micCode (pre-ADR-007)
    await watchSymbol(db, userA, 'TEF', 'EUR', {});

    const filas = await zoneStatusForUser(db, userA);
    const byTicker = (t: string) => filas.find((f) => f.ticker === t)!;

    expect(byTicker('ORC').instrumentType).toBe('REIT');
    expect(marketName(byTicker('ORC').micCode)).toBe('NYSE');

    expect(byTicker('ITX').instrumentType).toBeNull();
    expect(instrumentTypeText(byTicker('ITX').instrumentType)).toBe(''); // celda vacía
    expect(marketName(byTicker('ITX').micCode)).toBe('BME');

    expect(byTicker('TEF').instrumentType).toBeNull();
    expect(byTicker('TEF').micCode).toBeNull();
    expect(instrumentTypeText(byTicker('TEF').instrumentType)).toBe(''); // celda vacía
    expect(marketName(byTicker('TEF').micCode)).toBe(''); // celda vacía, NO `exchange` ni «—»
  });
});
