import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { notifications } from '@/db/schema';
import { runCronCycle } from '@/lib/triggers/cycle';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';

const SECRET = 'test-cron-secret';
let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
});

const provider = () => new FakeMarketDataProvider({ ITX: { price: '22', currency: 'EUR', asOf: '2026-07-13T00:00:00.000Z' } });

describe('CA-8: la notificación va en el ciclo de cron protegido (ADR-005/ADR-006)', () => {
  it('sin el secreto correcto -> 401 y no se emite ni registra ningún aviso', async () => {
    const sender = new FakeNotificationSender();
    const outcome = await runCronCycle({ authHeader: 'Bearer nope', secret: SECRET, db, provider: provider(), sender });

    expect(outcome.status).toBe(401);
    expect(sender.sent).toHaveLength(0);
    expect(await db.select().from(notifications)).toHaveLength(0);
  });

  it('con el secreto correcto -> notifica DESPUÉS de evaluar disparos, en el mismo ciclo', async () => {
    const sender = new FakeNotificationSender();
    const outcome = await runCronCycle({ authHeader: `Bearer ${SECRET}`, secret: SECRET, db, provider: provider(), sender });

    expect(outcome.status).toBe(200);
    // El disparo se abrió con el precio del ciclo y el aviso de entrada existe.
    const entries = await db.select().from(notifications).where(eq(notifications.kind, 'entry'));
    expect(entries).toHaveLength(1);
    expect(entries[0].userId).toBe(userA);
    expect(outcome.body).toMatchObject({ notifications: { entries: 1 } });
  });
});
