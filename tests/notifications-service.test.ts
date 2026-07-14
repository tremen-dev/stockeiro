import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { upsertQuote } from '@/lib/market/quotes';
import { evaluateTriggers } from '@/lib/triggers/service';
import { notifications } from '@/db/schema';
import {
  notifyCycle,
  listNotificationsForUser,
  getNotificationForOwner,
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

const ASOF = '2026-07-13T00:00:00.000Z';
/** Vigila un ticker con zona y siembra su cotización (deja el episodio listo para evaluar). */
async function watchAndQuote(userId: string, ticker: string, zone: { buyMin?: number; buyMax?: number; sellMin?: number; sellMax?: number }, price: string, asOf = ASOF) {
  const w = await watchSymbol(db, userId, ticker, 'EUR', zone);
  await upsertQuote(db, w.symbolId, { price, currency: 'EUR', asOf });
  return w;
}
const entriesOf = (userId: string) => db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.kind, 'entry')));
const digestsOf = (userId: string) => db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.kind, 'digest')));

describe('CA-1: aviso de entrada por acción que entra (CE-2/RN-14)', () => {
  it('emite y registra un aviso de entrada al usuario con ticker, precio y asOf', async () => {
    await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');
    await evaluateTriggers(db);

    const sender = new FakeNotificationSender();
    const { entries } = await notifyCycle(db, sender);

    expect(entries).toEqual([{ userId: userA, ticker: 'ITX', status: 'sent' }]);
    const rows = await entriesOf(userA);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('sent');
    expect(rows[0].asOf.toISOString()).toBe(ASOF);
    // llegó al email del usuario con el ticker en el cuerpo
    expect(sender.to('a@example.com').some((m) => m.body.includes('ITX'))).toBe(true);
  });
});

describe('CA-2: idempotencia del aviso de entrada (RN-14)', () => {
  it('el mismo episodio abierto no se re-notifica en ciclos sucesivos', async () => {
    await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');
    await evaluateTriggers(db);

    const sender = new FakeNotificationSender();
    await notifyCycle(db, sender);
    const second = await notifyCycle(db, sender); // mismo episodio, mismo ciclo
    expect(second.entries).toHaveLength(0);
    expect(await entriesOf(userA)).toHaveLength(1); // exactamente uno por episodio
  });
});

describe('CA-3: aviso agregado de permanencia (RN-14)', () => {
  it('un solo aviso agregado por usuario que lista todas sus acciones en zona', async () => {
    await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');
    await watchAndQuote(userA, 'AAPL', { buyMin: 10, buyMax: 15 }, '12');
    await evaluateTriggers(db);

    const sender = new FakeNotificationSender();
    const { digests } = await notifyCycle(db, sender);

    expect(digests).toHaveLength(1); // uno agregado, no uno por acción
    const rows = await digestsOf(userA);
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toContain('ITX');
    expect(rows[0].payload).toContain('AAPL');
  });
});

describe('CA-4: el agregado se repite por ciclo pero no dentro del ciclo (RN-14)', () => {
  it('mismo cycleRef -> un digest; ciclo posterior -> nuevo digest', async () => {
    await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');
    await evaluateTriggers(db);
    const sender = new FakeNotificationSender();

    await notifyCycle(db, sender, { cycleRef: '2026-07-13' });
    await notifyCycle(db, sender, { cycleRef: '2026-07-13' }); // reintento del MISMO ciclo
    expect(await digestsOf(userA)).toHaveLength(1);

    await notifyCycle(db, sender, { cycleRef: '2026-07-14' }); // ciclo POSTERIOR
    expect(await digestsOf(userA)).toHaveLength(2); // recordatorio nuevo
  });
});

describe('CA-5: registro consultable con asOf y estado (D-2)', () => {
  it('lista los avisos del usuario con su asOf y estado', async () => {
    await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');
    await evaluateTriggers(db);
    await notifyCycle(db, new FakeNotificationSender());

    const list = await listNotificationsForUser(db, userA);
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const n of list) {
      expect(n.asOf).toBeInstanceOf(Date);
      expect(['sent', 'failed']).toContain(n.status);
    }
    expect(list.some((n) => n.kind === 'entry')).toBe(true);
  });
});

describe('CA-6: aislamiento por usuario (RN-01)', () => {
  it('cada uno solo ve sus avisos; el agregado de A no incluye acciones de B', async () => {
    await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');
    await watchAndQuote(userB, 'MSFT', { buyMin: 20, buyMax: 25 }, '22');
    await evaluateTriggers(db);
    await notifyCycle(db, new FakeNotificationSender());

    const listA = await listNotificationsForUser(db, userA);
    const listB = await listNotificationsForUser(db, userB);
    expect(listA.every((n) => n.payload.includes('ITX') || n.kind === 'digest')).toBe(true);
    const digestA = listA.find((n) => n.kind === 'digest')!;
    expect(digestA.payload).toContain('ITX');
    expect(digestA.payload).not.toContain('MSFT'); // el agregado de A no incluye lo de B

    // B no puede leer un aviso de A por id; A sí el suyo.
    expect(await getNotificationForOwner(db, listA[0].id, userB)).toBeNull();
    expect(await getNotificationForOwner(db, listB[0].id, userA)).toBeNull();
    expect(await getNotificationForOwner(db, listA[0].id, userA)).not.toBeNull();
  });
});

describe('CA-7: envío tras puerto + fallback in-app (RN-15)', () => {
  it('si el canal falla para un usuario, su aviso queda in-app failed y los demás se envían', async () => {
    await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');
    await watchAndQuote(userB, 'MSFT', { buyMin: 20, buyMax: 25 }, '22');
    await evaluateTriggers(db);

    const sender = new FakeNotificationSender(new Set(['b@example.com'])); // falla para B
    const { entries } = await notifyCycle(db, sender);

    const a = entries.find((e) => e.userId === userA)!;
    const b = entries.find((e) => e.userId === userB)!;
    expect(a.status).toBe('sent');
    expect(b.status).toBe('failed');

    // El aviso de B se conserva in-app pese al fallo; el de A se envió.
    expect((await entriesOf(userB))[0].status).toBe('failed');
    expect((await entriesOf(userA))[0].status).toBe('sent');
  });
});

describe('CA-9: cobertura CE-2 — ningún disparo sin aviso', () => {
  it('aunque TODOS los envíos fallen, cada episodio abierto tiene su aviso de entrada', async () => {
    await watchAndQuote(userA, 'ITX', { buyMin: 20, buyMax: 25 }, '22');
    await watchAndQuote(userB, 'MSFT', { buyMin: 20, buyMax: 25 }, '22');
    await evaluateTriggers(db);

    // sender que falla para todos
    const sender = new FakeNotificationSender(new Set(['a@example.com', 'b@example.com']));
    await notifyCycle(db, sender);

    const allEntries = await db.select().from(notifications).where(eq(notifications.kind, 'entry'));
    expect(allEntries).toHaveLength(2); // uno por episodio abierto (los 2), ninguno omitido
    expect(allEntries.every((n) => n.status === 'failed')).toBe(true);
  });
});
