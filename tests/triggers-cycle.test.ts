import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { zoneTriggers, quotes } from '@/db/schema';
import { runRefreshCycle, runCronCycle } from '@/lib/triggers/cycle';
import { openTriggersForUser } from '@/lib/triggers/service';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';

const SECRET = 'test-cron-secret';
let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

const q = (price: string) => ({ price, currency: 'EUR', asOf: '2026-07-13T00:00:00.000Z' });

describe('CA-7: la evaluación corre tras la ingesta, sobre las cotizaciones del ciclo (ADR-005)', () => {
  it('refresca y evalúa en el mismo ciclo; un símbolo sin cotización no se evalúa', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
    await watchSymbol(db, userA, 'AAPL', 'EUR', { buyMin: 10, buyMax: 15 });

    // El proveedor resuelve ITX (en zona) pero NO AAPL (se omite -> sin cotización).
    const provider = new FakeMarketDataProvider({ ITX: q('22') });
    const { refresh, triggers } = await runRefreshCycle(db, provider);

    // Ingesta: solo ITX; el disparo de ITX existe porque el upsert corrió ANTES de evaluar.
    expect(refresh.updated).toEqual(['ITX']);
    expect(triggers.opened).toHaveLength(1);
    expect(triggers.opened[0].ticker).toBe('ITX');

    // AAPL sin cotización ese ciclo: no se evalúa (no dispara).
    const open = await openTriggersForUser(db, userA);
    expect(open.map((t) => t.ticker)).toEqual(['ITX']);
  });
});

describe('CA-7: el endpoint del ciclo exige CRON_SECRET (hereda ADR-004)', () => {
  beforeEach(async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
  });

  it('sin el secreto correcto -> 401 y no se ingiere ni se dispara nada', async () => {
    const provider = new FakeMarketDataProvider({ ITX: q('22') });
    const outcome = await runCronCycle({ authHeader: 'Bearer nope', secret: SECRET, db, provider });

    expect(outcome.status).toBe(401);
    expect(provider.calls).toHaveLength(0);
    expect(await db.select().from(quotes)).toHaveLength(0);
    expect(await db.select().from(zoneTriggers)).toHaveLength(0);
  });

  it('con el secreto correcto -> 200 y el ciclo ingiere y dispara', async () => {
    const provider = new FakeMarketDataProvider({ ITX: q('22') });
    const outcome = await runCronCycle({ authHeader: `Bearer ${SECRET}`, secret: SECRET, db, provider });

    expect(outcome.status).toBe(200);
    expect(outcome.body).toMatchObject({ triggers: { opened: 1, closed: 0 } });
    expect(await db.select().from(zoneTriggers)).toHaveLength(1);
  });
});
