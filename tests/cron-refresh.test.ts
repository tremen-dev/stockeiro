import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { quotes } from '@/db/schema';
import { authorizeCron, runCronRefresh } from '@/lib/market/cron';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';

const SECRET = 'test-cron-secret';

describe('CA-7: autorización del endpoint de cron (ADR-004)', () => {
  it('authorizeCron: solo el Bearer con el secreto correcto pasa', () => {
    expect(authorizeCron(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(authorizeCron('Bearer wrong', SECRET)).toBe(false);
    expect(authorizeCron(SECRET, SECRET)).toBe(false); // sin el prefijo Bearer
    expect(authorizeCron(null, SECRET)).toBe(false); // sin cabecera
    expect(authorizeCron(`Bearer ${SECRET}`, undefined)).toBe(false); // sin secreto configurado -> fail-closed
    expect(authorizeCron(`Bearer ${SECRET}`, '')).toBe(false);
  });
});

describe('CA-7: el endpoint rechaza sin secreto y NO ejecuta la ingesta', () => {
  let db: TestDb;
  beforeEach(async () => {
    ({ db } = await makeTestDb());
    const userA = (await registerUser(db, 'a@example.com', 'clave')).id;
    await watchSymbol(db, userA, 'ITX', 'EUR');
  });

  it('sin el secreto correcto -> 401 y ninguna cotización persistida', async () => {
    const provider = new FakeMarketDataProvider({ ITX: { price: '31', currency: 'EUR', asOf: '2026-07-13T00:00:00.000Z' } });
    const outcome = await runCronRefresh({ authHeader: 'Bearer nope', secret: SECRET, db, provider });

    expect(outcome.status).toBe(401);
    expect(provider.calls).toHaveLength(0); // ni siquiera se llamó al proveedor
    expect(await db.select().from(quotes)).toHaveLength(0); // ingesta NO ejecutada
  });

  it('con el secreto correcto -> 200 y la cotización se persiste', async () => {
    const provider = new FakeMarketDataProvider({ ITX: { price: '31', currency: 'EUR', asOf: '2026-07-13T00:00:00.000Z' } });
    const outcome = await runCronRefresh({ authHeader: `Bearer ${SECRET}`, secret: SECRET, db, provider });

    expect(outcome.status).toBe(200);
    expect(await db.select().from(quotes)).toHaveLength(1);
  });
});
