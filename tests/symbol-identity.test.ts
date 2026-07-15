import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { recordBuy } from '@/lib/portfolio/service';
import { symbols, watchedSymbols } from '@/db/schema';

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

const XNAS = { micCode: 'XNAS', exchange: 'NASDAQ', name: 'Microsoft Corp' };
const BMEX = { micCode: 'BMEX', exchange: 'BME', name: 'Inditex' };
const XNYS = { micCode: 'XNYS', exchange: 'NYSE', name: 'Santander ADR' };

describe('CA-4: la selección fija identidad de mercado y divisa (no EUR fijo)', () => {
  it('vigilar con candidato guarda micCode, exchange, name y la divisa del candidato', async () => {
    await watchSymbol(db, userA, 'MSFT', 'USD', {}, XNAS);
    const [sym] = await db.select().from(symbols).where(eq(symbols.ticker, 'MSFT'));
    expect(sym.micCode).toBe('XNAS');
    expect(sym.exchange).toBe('NASDAQ');
    expect(sym.name).toBe('Microsoft Corp');
    expect(sym.currency).toBe('USD'); // divisa del candidato, no EUR
  });

  it('comprar con candidato crea el símbolo con su identidad y divisa', async () => {
    await recordBuy(db, userA, 'MSFT', 'USD', { quantity: 3, price: 400, occurredOn: '2026-01-02' }, XNAS);
    const [sym] = await db.select().from(symbols).where(eq(symbols.ticker, 'MSFT'));
    expect(sym.micCode).toBe('XNAS');
    expect(sym.currency).toBe('USD');
  });
});

describe('CA-5: símbolo compartido por (ticker, micCode)', () => {
  it('dos usuarios eligiendo el mismo mercado comparten el MISMO símbolo', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, BMEX);
    await watchSymbol(db, userB, 'ITX', 'EUR', {}, BMEX);

    const rows = await db.select().from(symbols).where(eq(symbols.ticker, 'ITX'));
    expect(rows).toHaveLength(1); // un único registro compartido

    const watched = await db.select().from(watchedSymbols);
    expect(watched).toHaveLength(2);
    expect(new Set(watched.map((w) => w.symbolId))).toEqual(new Set([rows[0].id])); // mismo símbolo
  });

  it('el mismo ticker en otro mercado es un símbolo DISTINTO', async () => {
    await watchSymbol(db, userA, 'SAN', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME', name: 'Santander' });
    await watchSymbol(db, userB, 'SAN', 'USD', {}, XNYS);

    const rows = await db.select().from(symbols).where(eq(symbols.ticker, 'SAN'));
    expect(rows).toHaveLength(2); // dos símbolos: uno por mercado
    expect(new Set(rows.map((r) => r.micCode))).toEqual(new Set(['BMEX', 'XNYS']));
    expect(new Set(rows.map((r) => r.currency))).toEqual(new Set(['EUR', 'USD']));
  });
});
