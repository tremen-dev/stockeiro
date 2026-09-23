import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import {
  cronRuns,
  emailVerificationTokens,
  passwordResetTokens,
  users,
  watchedSymbols,
} from '@/db/schema';
import { registerUser, verifyCredentials } from '@/lib/auth/users';
import { AccountPendingError, InvalidCredentialsError } from '@/lib/auth/errors';
import { requestPasswordReset } from '@/lib/auth/password-reset';
import { watchSymbol } from '@/lib/watchlist/service';
import { upsertQuote } from '@/lib/market/quotes';
import { evaluateTriggers } from '@/lib/triggers/service';
import { notifyCycle } from '@/lib/notifications/service';
import { runCronCycle } from '@/lib/triggers/cycle';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';
import { ACTIVATION_WINDOW_HOURS } from '@/lib/registration/activation-rules';
import { signUp } from '@/lib/registration/signup';
import { BASE, FakeNotificationSender, PWD, cuentaDe } from './spec066-arnes';

/**
 * SPEC-066 — la cuenta pendiente, por dentro: CA-17 (en el verificador de credenciales),
 * CA-18 (no recibe más correo que el de activación) y CA-19 (la caducada se borra, y la
 * purga no toca el ciclo).
 */

let db: TestDb;
let sender: FakeNotificationSender;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  sender = new FakeNotificationSender();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function pendiente(email: string): Promise<string> {
  const r = await signUp(db, sender, email, PWD, { baseUrl: BASE });
  if (r.kind === 'neutral') await r.delivery;
  sender.sent.length = 0;
  return (await cuentaDe(db, email)).id;
}

async function envejecer(userId: string, horas: number) {
  const intervalo = sql.raw(`interval '${horas} hours'`);
  await db.update(users).set({ createdAt: sql`created_at - ${intervalo}` }).where(eq(users.id, userId));
}

describe('SPEC-066 CA-17: el verificador de credenciales no deja entrar a una pendiente', () => {
  it('contraseña correcta → AccountPendingError; incorrecta → el genérico de siempre', async () => {
    await pendiente('p@example.com');
    await expect(verifyCredentials(db, 'p@example.com', PWD)).rejects.toBeInstanceOf(
      AccountPendingError,
    );
    await expect(verifyCredentials(db, 'p@example.com', 'mala')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await expect(verifyCredentials(db, 'nadie@example.com', 'mala')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });
});

describe('SPEC-066 CA-18: una cuenta pendiente no recibe más correo que el de activación', () => {
  it('pedir recuperar la contraseña: el mismo acuse, y ni token ni correo', async () => {
    await pendiente('p@example.com');
    await registerUser(db, 'a@example.com', PWD);

    const deLaPendiente = await requestPasswordReset(db, sender, 'p@example.com', { baseUrl: BASE });
    const deLaActivada = await requestPasswordReset(db, sender, 'a@example.com', { baseUrl: BASE });
    await Promise.all([deLaPendiente.delivery, deLaActivada.delivery]);

    expect(Object.keys(deLaPendiente)).toEqual(Object.keys(deLaActivada));
    expect(sender.sent.map((m) => m.to)).toEqual(['a@example.com']);
    const tokens = await db.select().from(passwordResetTokens);
    expect(tokens).toHaveLength(1);
  });

  it('el ciclo notifica: nada hacia la pendiente, y a la activada igual que antes', async () => {
    const idPendiente = await pendiente('p@example.com');
    const idActivada = (await registerUser(db, 'a@example.com', PWD)).id;
    for (const id of [idPendiente, idActivada]) {
      const w = await watchSymbol(db, id, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });
      await upsertQuote(db, w.symbolId, {
        price: '22',
        currency: 'EUR',
        asOf: '2026-09-22T00:00:00.000Z',
      });
    }
    await evaluateTriggers(db);

    const { entries, digests } = await notifyCycle(db, sender);

    expect(entries.map((e) => e.userId)).toEqual([idActivada]);
    expect(digests.map((d) => d.userId)).toEqual([idActivada]);
    expect(sender.to('p@example.com')).toHaveLength(0);
    expect(sender.to('a@example.com').length).toBeGreaterThan(0);
  });
});

describe('SPEC-066 CA-19: la pendiente caducada se borra, y la purga no toca el ciclo', () => {
  const SECRET = 'cron-secreto-spec066';
  const provider = () =>
    new FakeMarketDataProvider({ ITX: { price: '22', currency: 'EUR', asOf: '2026-09-22T00:00:00.000Z' } });
  const ciclo = (extra: Record<string, unknown> = {}) =>
    runCronCycle({
      authHeader: `Bearer ${SECRET}`,
      secret: SECRET,
      db,
      provider: provider(),
      sender,
      ...extra,
    });

  it('sólo desaparece la pendiente de MÁS de 24 h, con todo lo suyo', async () => {
    const vieja = await pendiente('vieja@example.com');
    await watchSymbol(db, vieja, 'ITX', 'EUR'); // algo suyo, que tiene que caer con ella
    await envejecer(vieja, ACTIVATION_WINDOW_HOURS + 1);
    const reciente = await pendiente('reciente@example.com');
    const activada = (await registerUser(db, 'antigua@example.com', PWD)).id;
    await envejecer(activada, 24 * 90);

    const outcome = await ciclo();

    expect(outcome.status).toBe(200);
    const quedan = (await db.select({ id: users.id }).from(users)).map((u) => u.id).sort();
    expect(quedan).toEqual([reciente, activada].sort());
    expect(
      await db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.userId, vieja)),
    ).toHaveLength(0);
    expect(await db.select().from(watchedSymbols).where(eq(watchedSymbols.userId, vieja))).toHaveLength(0);
    // La reciente conserva su enlace.
    expect(
      await db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.userId, reciente)),
    ).toHaveLength(1);
  });

  it('si la purga LANZA: el ciclo ya hizo lo suyo, cron_runs cerrada con éxito, misma respuesta, y log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const usuario = (await registerUser(db, 'a@example.com', PWD)).id;
    await watchSymbol(db, usuario, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });

    const sinPurga = await ciclo({ purgePending: async () => 0 });
    ({ db } = await makeTestDb());
    sender = new FakeNotificationSender();
    const otro = (await registerUser(db, 'a@example.com', PWD)).id;
    await watchSymbol(db, otro, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 });

    const conPurgaRota = await ciclo({
      purgePending: async () => {
        throw new Error('la base se ha ido a comer');
      },
    });

    // Misma respuesta HTTP: mismo estado y mismo cuerpo (ADR-023 pto. 16).
    expect(conPurgaRota).toEqual(sinPurga);
    // El ciclo ingirió, evaluó y notificó.
    expect(conPurgaRota.status).toBe(200);
    expect(sender.to('a@example.com').length).toBeGreaterThan(0);
    // Su fila, cerrada con éxito.
    const [fila] = await db.select().from(cronRuns);
    expect(fila.outcome).toBe('success');
    expect(fila.finishedAt).not.toBeNull();
    // Y una línea de error que nombra la purga.
    expect(log.mock.calls.map((c) => c.map(String).join(' ')).some((l) => /purga/i.test(l))).toBe(true);
  });
});
