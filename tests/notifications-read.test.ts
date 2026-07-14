import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { upsertQuote } from '@/lib/market/quotes';
import { evaluateTriggers } from '@/lib/triggers/service';
import {
  notifyCycle,
  listNotificationsForUser,
  countUnread,
  markNotificationRead,
  markAllRead,
} from '@/lib/notifications/service';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

/** Genera avisos reales para un usuario: 2 acciones en zona → entradas + 1 digest. */
async function seedNotifications(userId: string) {
  for (const [ticker, price] of [['ITX', '22'], ['AAPL', '12']] as const) {
    const w = await watchSymbol(db, userId, ticker, 'EUR', { buyMin: ticker === 'ITX' ? 20 : 10, buyMax: ticker === 'ITX' ? 25 : 15 });
    await upsertQuote(db, w.symbolId, { price, currency: 'EUR', asOf: '2026-07-13T00:00:00.000Z' });
  }
  await evaluateTriggers(db);
  await notifyCycle(db, new FakeNotificationSender(), { cycleRef: '2026-07-13' });
}

describe('CA-10: contador de no-leídos; CA-6: lista con readAt/isRead', () => {
  it('los avisos nacen no leídos; el contador los cuenta', async () => {
    await seedNotifications(userA);
    const list = await listNotificationsForUser(db, userA);
    expect(list.length).toBeGreaterThanOrEqual(2); // 2 entradas + 1 digest
    expect(list.every((n) => n.isRead === false && n.readAt === null)).toBe(true);
    expect(await countUnread(db, userA)).toBe(list.length);
  });
});

describe('CA-8: marcar leído individual, idempotente y aislado (RN-01)', () => {
  it('marca uno; repetir no falla; un ajeno no puede marcarlo', async () => {
    await seedNotifications(userA);
    const [first] = await listNotificationsForUser(db, userA);
    const before = await countUnread(db, userA);

    expect(await markNotificationRead(db, first.id, userA)).toBe(true);
    expect(await countUnread(db, userA)).toBe(before - 1);
    // idempotente: marcar de nuevo no cambia nada
    expect(await markNotificationRead(db, first.id, userA)).toBe(false);
    expect(await countUnread(db, userA)).toBe(before - 1);

    // aislamiento: B no puede marcar un aviso de A
    await seedNotifications(userB);
    const [aUnread] = (await listNotificationsForUser(db, userA)).filter((n) => !n.isRead);
    expect(await markNotificationRead(db, aUnread.id, userB)).toBe(false);
    expect((await listNotificationsForUser(db, userA)).find((n) => n.id === aUnread.id)!.isRead).toBe(false);
  });
});

describe('CA-9/CA-11: marcar todos leídos, solo los propios', () => {
  it('marca todos los del usuario y deja el contador a 0; no toca los de otro', async () => {
    await seedNotifications(userA);
    await seedNotifications(userB);
    const nA = await countUnread(db, userA);

    const marked = await markAllRead(db, userA);
    expect(marked).toBe(nA);
    expect(await countUnread(db, userA)).toBe(0);
    // B intacto
    expect(await countUnread(db, userB)).toBeGreaterThan(0);
  });
});
