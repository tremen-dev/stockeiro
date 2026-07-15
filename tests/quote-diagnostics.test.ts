import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { quoteDiagnostics } from '@/db/schema';
import { refreshQuotes } from '@/lib/market/refresh';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';
import { MarketstackProvider } from '@/lib/market/marketstack-provider';
import { getDiagnosticMap } from '@/lib/market/quotes';
import { failReasonText, FAIL_REASON_TEXT } from '@/lib/market/fail-reason-text';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';
import { watchSymbol } from '@/lib/watchlist/service';
import { recordBuy } from '@/lib/portfolio/service';
import { portfolioSummary } from '@/lib/portfolio/service';
import { getPriceMap } from '@/lib/market/quotes';

// SPEC-016 — ningún símbolo se descarta sin traza visible (CE-F2 de EPIC-FIX).

let db: TestDb;
let userA: string;

const BME = { micCode: 'BMEX', exchange: 'BME', name: 'Inditex' };
const q = (price: string) => ({ price, currency: 'EUR', asOf: '2026-07-14T00:00:00.000Z' });

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

const fakeFetch = (body: unknown) =>
  (async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;

describe('CA-1: el motivo se propaga por el puerto, CLASIFICADO', () => {
  it('el adaptador traduce el error del proveedor a vocabulario del dominio', async () => {
    // Respuesta real del free tier para un mercado no cubierto (verificada 2026-07-15).
    const body = {
      data: [
        { symbol: 'ITX.BMEX', code: 403, status: 'error', message: '**symbol** ITX is not available with your plan' },
        { symbol: 'ZZZ.BMEX', code: 404, status: 'error', message: 'symbol not found' },
      ],
    };
    const provider = new MarketstackProvider('key', fakeFetch(body));
    const { failures } = await provider.getQuotes([
      { ticker: 'ITX', micCode: 'BMEX' },
      { ticker: 'ZZZ', micCode: 'BMEX' },
    ]);

    expect(failures).toEqual([
      { ticker: 'ITX', micCode: 'BMEX', reason: 'mercado_no_cubierto' },
      { ticker: 'ZZZ', micCode: 'BMEX', reason: 'simbolo_desconocido' },
    ]);
  });

  it('el texto del proveedor NO sale a la UI: solo categorías del dominio', () => {
    // La UI muestra esto; jamás "upgrade your plan" ni un {"code":403}.
    expect(failReasonText('mercado_no_cubierto')).toBe(FAIL_REASON_TEXT.mercado_no_cubierto);
    expect(failReasonText('mercado_no_cubierto')).not.toMatch(/plan|403|upgrade/i);
    expect(failReasonText(null)).toBe('');
  });
});

describe('CA-2: se persiste el último diagnóstico por símbolo', () => {
  it('el ciclo registra motivo y cuándo se intentó', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, BME);
    const provider = new FakeMarketDataProvider({}, { 'ITX:BMEX': 'mercado_no_cubierto' });

    const res = await refreshQuotes(db, provider);

    expect(res.skipped).toEqual([{ ticker: 'ITX', reason: 'mercado_no_cubierto' }]);
    const diag = await getDiagnosticMap(db);
    expect(diag.ITX.reason).toBe('mercado_no_cubierto');
    expect(diag.ITX.attemptedAt).toBeInstanceOf(Date);
    // Una fila por símbolo: un segundo ciclo actualiza, no duplica.
    await refreshQuotes(db, provider);
    expect(await db.select().from(quoteDiagnostics)).toHaveLength(1);
  });
});

describe('CA-3: distinguir "sin datos aún" de "no se puede cotizar"', () => {
  it('sin ciclo → sin diagnóstico; tras fallar → diagnóstico con motivo', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, BME);

    // Nunca ha corrido el ciclo: estado neutro y SIN motivo.
    let [row] = await zoneStatusForUser(db, userA);
    expect(row.state).toBe('none');
    expect(row.failReason).toBeNull(); // "aún sin datos"

    await refreshQuotes(db, new FakeMarketDataProvider({}, { 'ITX:BMEX': 'mercado_no_cubierto' }));

    // Ahora sigue sin cotización, pero es distinguible: hay motivo.
    [row] = await zoneStatusForUser(db, userA);
    expect(row.state).toBe('none');
    expect(row.failReason).toBe('mercado_no_cubierto'); // "no se puede cotizar, y por esto"
  });
});

describe('CA-4: visible en /vigiladas', () => {
  it('el estado de zona lleva el motivo del símbolo que no se puede cotizar', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: '40', buyMax: '50' }, BME);
    await refreshQuotes(db, new FakeMarketDataProvider({}, { 'ITX:BMEX': 'sin_identidad_de_mercado' }));

    const [row] = await zoneStatusForUser(db, userA);
    expect(row.ticker).toBe('ITX');
    expect(row.state).toBe('none'); // el estado de zona sigue siendo "sin dato" (RN-11)
    expect(row.failReason).toBe('sin_identidad_de_mercado');
    expect(failReasonText(row.failReason)).toBeTruthy(); // hay texto que enseñar
  });
});

describe('CA-5 / CA-6: /cartera muestra el motivo, pero RN-06 sigue intacto', () => {
  it('el P/L actual sigue siendo "sin dato" y NO se mezcla con el realizado', async () => {
    await recordBuy(db, userA, 'ITX', 'EUR', { quantity: 10, price: 40, occurredOn: '2026-01-02' }, BME);
    await refreshQuotes(db, new FakeMarketDataProvider({}, { 'ITX:BMEX': 'mercado_no_cubierto' }));

    const summary = await portfolioSummary(db, userA, await getPriceMap(db));
    const [pos] = summary.positions;

    expect(pos.plActual).toBeNull(); // RN-06: sin precio NO se calcula (no se inventa)
    expect(summary.actualTotal).toBeNull();
    expect(pos.realizadoPL).toBe('0.00'); // D-6: jamás se mezcla con el realizado

    // …pero el motivo está disponible para acompañar ese "—" (CA-5).
    const diag = await getDiagnosticMap(db);
    expect(diag.ITX.reason).toBe('mercado_no_cubierto');
  });
});

describe('CA-7: la resiliencia no se rompe (CA-6 de SPEC-004)', () => {
  it('un símbolo que falla no impide que los demás se actualicen', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, BME);
    await watchSymbol(db, userA, 'SAN', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME', name: 'Santander' });

    const res = await refreshQuotes(
      db,
      new FakeMarketDataProvider({ 'SAN:BMEX': q('11.98') }, { 'ITX:BMEX': 'mercado_no_cubierto' }),
    );

    expect(res.updated).toEqual(['SAN']); // el otro SÍ se actualiza
    expect(res.skipped).toEqual([{ ticker: 'ITX', reason: 'mercado_no_cubierto' }]);
    const diag = await getDiagnosticMap(db);
    expect(diag.SAN).toBeUndefined(); // el que fue bien no tiene diagnóstico
  });
});

describe('CA-8: el diagnóstico se limpia al resolverse', () => {
  it('un ciclo posterior con precio borra el aviso (sin fantasmas)', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, BME);

    await refreshQuotes(db, new FakeMarketDataProvider({}, { 'ITX:BMEX': 'mercado_no_cubierto' }));
    expect((await getDiagnosticMap(db)).ITX).toBeDefined();

    // Ahora el proveedor SÍ lo cotiza (p. ej. tras cambiar de proveedor o de plan).
    const res = await refreshQuotes(db, new FakeMarketDataProvider({ 'ITX:BMEX': q('53.72') }));

    expect(res.updated).toEqual(['ITX']);
    expect((await getDiagnosticMap(db)).ITX).toBeUndefined(); // desaparece
    const [row] = await zoneStatusForUser(db, userA);
    expect(row.failReason).toBeNull();
    expect(row.state).not.toBe('none'); // vuelve a la normalidad
  });
});

describe('CA-9: aislamiento (RN-01)', () => {
  it('cada usuario solo ve el diagnóstico de los símbolos que referencia', async () => {
    const userB = (await registerUser(db, 'b@example.com', 'clave')).id;
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, BME);
    await refreshQuotes(db, new FakeMarketDataProvider({}, { 'ITX:BMEX': 'mercado_no_cubierto' }));

    // A vigila ITX y ve su motivo; B no vigila nada → no ve filas.
    const filasA = await zoneStatusForUser(db, userA);
    expect(filasA).toHaveLength(1);
    expect(filasA[0].failReason).toBe('mercado_no_cubierto');

    const filasB = await zoneStatusForUser(db, userB);
    expect(filasB).toHaveLength(0);
  });
});
