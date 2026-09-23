import { describe, it, expect, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { emailVerificationTokens, registrationSettings, users } from '@/db/schema';
import { registerUser } from '@/lib/auth/users';
import { verifyPassword } from '@/lib/auth/passwords';
import { hashResetToken } from '@/lib/auth/reset-tokens';
import { registrationState } from '@/lib/registration/gate';
import { countAccounts, readRegistrationSettings, resolveRegistrationState } from '@/lib/registration/service';
import {
  ACTIVATION_EMAIL_LIMIT,
  ACTIVATION_WINDOW_HOURS,
} from '@/lib/registration/activation-rules';
import {
  activateAccount,
  isActivationTokenUsable,
  resendActivation,
  signUp,
} from '@/lib/registration/signup';
import { REGISTRO_CERRADO_MOTIVO } from '@/lib/registration/messages';
import { BASE, FakeNotificationSender, PWD, cuentaDe, recuento, tokenDelCorreo } from './spec066-arnes';

/**
 * SPEC-066 capa 3 — la cuenta nace PENDIENTE: CA-8 a CA-12, CA-14, CA-15 y CA-16.
 *
 * Todo contra PGlite con el esquema de las migraciones (ADR-019). El tiempo lo pone
 * Postgres, así que «pasadas 25 h» se simula moviendo las fechas de las filas hacia atrás,
 * no el reloj del proceso.
 */

let db: TestDb;
let sender: FakeNotificationSender;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  sender = new FakeNotificationSender();
});

async function alta(email: string, password = PWD) {
  const r = await signUp(db, sender, email, password, { baseUrl: BASE });
  if (r.kind === 'neutral') await r.delivery;
  return r;
}

async function reenvio(email: string) {
  const { delivery } = await resendActivation(db, sender, email, { baseUrl: BASE });
  await delivery;
}

const ultimoToken = () => tokenDelCorreo(sender.sent[sender.sent.length - 1]);

/** Mueve el alta de una cuenta (y sus enlaces) `horas` hacia el pasado. */
async function envejecer(email: string, horas: number) {
  const u = await cuentaDe(db, email);
  const intervalo = sql.raw(`interval '${horas} hours'`);
  await db.update(users).set({ createdAt: sql`created_at - ${intervalo}` }).where(eq(users.id, u.id));
  await db
    .update(emailVerificationTokens)
    .set({
      createdAt: sql`created_at - ${intervalo}`,
      expiresAt: sql`expires_at - ${intervalo}`,
    })
    .where(eq(emailVerificationTokens.userId, u.id));
}

const cupo = (capacity: number | null, openManually = true) =>
  db.update(registrationSettings).set({ capacity, openManually });

// ---------------------------------------------------------------------------

describe('SPEC-066 CA-8: un alta crea una cuenta pendiente y un correo, y nada más', () => {
  it('una cuenta PENDIENTE, un token vivo guardado como digest, un correo, sin subir el cupo', async () => {
    const antes = await countAccounts(db);
    const r = await alta('Nueva@Example.com');

    expect(r.kind).toBe('neutral');
    const u = await cuentaDe(db, 'nueva@example.com');
    expect(u.emailVerifiedAt).toBeNull();

    const tokens = await db.select().from(emailVerificationTokens);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].consumedAt).toBeNull();

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].to).toBe('nueva@example.com'); // la dirección ALMACENADA
    const token = ultimoToken();
    expect(tokens[0].tokenHash).toBe(hashResetToken(token));
    expect(tokens[0].tokenHash).not.toContain(token);

    expect(await countAccounts(db)).toBe(antes);
  });

  it('la cuenta es pendiente por el CAMINO DE ALTA, no por el default de la columna', async () => {
    // El default de la columna es now() —activada— a propósito (ADR-042 pto. 2): si el
    // camino de alta dejara de escribir NULL, la cuenta nacería activada y esto lo delata.
    const { rows } = await (db as unknown as { $client: { query: (q: string) => Promise<{ rows: Array<{ d: string | null }> }> } })
      .$client.query(
        `SELECT column_default AS d FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'email_verified_at'`,
      );
    expect(rows[0].d).toMatch(/now\(\)/);
    await alta('camino@example.com');
    expect((await cuentaDe(db, 'camino@example.com')).emailVerifiedAt).toBeNull();
  });
});

describe('SPEC-066 CA-9: el alta no dice si el correo existe', () => {
  it('nuevo, pendiente y activado: tres respuestas IDÉNTICAS entre sí', async () => {
    await alta('pendiente@example.com');
    await registerUser(db, 'activada@example.com', PWD);

    // Todo lo observable salvo la promesa del envío, que es el trabajo diferido.
    const forma = (r: Awaited<ReturnType<typeof signUp>>) => ({
      kind: r.kind,
      claves: Object.keys(r).sort(),
    });
    const nuevo = forma(await alta('nuevo@example.com'));
    const pendiente = forma(await alta('pendiente@example.com', 'otra-clave-999'));
    const activado = forma(await alta('activada@example.com', 'otra-clave-999'));

    expect(pendiente).toEqual(nuevo);
    expect(activado).toEqual(nuevo);
  });

  it('sobre la ACTIVADA no cambia nada: ni contraseña, ni época, ni tokens, ni correo', async () => {
    await registerUser(db, 'activada@example.com', PWD);
    const antes = await cuentaDe(db, 'activada@example.com');
    const correos = sender.sent.length;

    await alta('activada@example.com', 'clave-del-intruso-1');

    const despues = await cuentaDe(db, 'activada@example.com');
    expect(despues.passwordHash).toBe(antes.passwordHash);
    expect(despues.passwordChangedAt.getTime()).toBe(antes.passwordChangedAt.getTime());
    expect(despues.createdAt.getTime()).toBe(antes.createdAt.getTime());
    expect(await db.select().from(emailVerificationTokens)).toHaveLength(0);
    expect(sender.sent.length).toBe(correos);
  });

  it('la contraseña se HASHEA en las tres ramas (el trabajo dominante no delata la rama)', async () => {
    // Se cuenta con un espía sobre bcrypt: una llamada a `hash` por alta, sea cual sea la rama.
    const bcrypt = (await import('bcryptjs')).default;
    await alta('pend@example.com');
    await registerUser(db, 'act@example.com', PWD);
    const { vi } = await import('vitest');
    const espia = vi.spyOn(bcrypt, 'hash');
    try {
      await alta('nuevo2@example.com');
      await alta('pend@example.com', 'otra-clave-1');
      await alta('act@example.com', 'otra-clave-1');
      expect(espia).toHaveBeenCalledTimes(3);
    } finally {
      espia.mockRestore();
    }
  });

  it('el envío va FUERA del camino de la respuesta: al volver signUp aún no se ha enviado nada', async () => {
    const r = await signUp(db, sender, 'diferido@example.com', PWD, { baseUrl: BASE });
    expect(sender.sent).toHaveLength(0);
    if (r.kind === 'neutral') await r.delivery;
    expect(sender.sent).toHaveLength(1);
  });

  it('RN-02 sigue: nunca dos filas con el mismo correo normalizado', async () => {
    await alta('dup@example.com');
    await alta(' DUP@example.com ');
    await alta('dup@EXAMPLE.com');
    const filas = await db.select().from(users).where(eq(users.email, 'dup@example.com'));
    expect(filas).toHaveLength(1);
  });
});

describe('SPEC-066 CA-10: volver a darse de alta sobre una pendiente es un alta nueva', () => {
  it('contraseña nueva, plazo reiniciado, enlace anterior muerto y correo con uno nuevo', async () => {
    await alta('realta@example.com', 'la-primera-1');
    const primero = ultimoToken();
    await envejecer('realta@example.com', 5);
    const antes = await cuentaDe(db, 'realta@example.com');

    await alta('realta@example.com', 'la-segunda-2');

    const despues = await cuentaDe(db, 'realta@example.com');
    expect(await verifyPassword('la-segunda-2', despues.passwordHash)).toBe(true);
    expect(despues.createdAt.getTime()).toBeGreaterThan(antes.createdAt.getTime() + 4 * 3_600_000);
    expect(await isActivationTokenUsable(db, primero)).toBe(false);
    const segundo = ultimoToken();
    expect(segundo).not.toBe(primero);
    expect(await isActivationTokenUsable(db, segundo)).toBe(true);
    expect(sender.sent).toHaveLength(2);
  });

  it('con el límite agotado NO cambia nada (ni contraseña, ni plazo, ni enlaces) y responde igual', async () => {
    await alta('agotada@example.com', 'la-primera-1');
    for (let i = 1; i < ACTIVATION_EMAIL_LIMIT; i++) await reenvio('agotada@example.com');
    expect(sender.sent).toHaveLength(ACTIVATION_EMAIL_LIMIT);
    const vivo = ultimoToken();
    const antes = await cuentaDe(db, 'agotada@example.com');

    const r = await alta('agotada@example.com', 'la-segunda-2');

    expect(r.kind).toBe('neutral');
    const despues = await cuentaDe(db, 'agotada@example.com');
    expect(despues.passwordHash).toBe(antes.passwordHash);
    expect(despues.createdAt.getTime()).toBe(antes.createdAt.getTime());
    expect(await isActivationTokenUsable(db, vivo)).toBe(true);
    expect(sender.sent).toHaveLength(ACTIVATION_EMAIL_LIMIT);
  });
});

describe('SPEC-066 CA-11: el enlace — un solo uso, sin secreto en base, con el plazo de la cuenta', () => {
  it('la base sólo tiene el digest', async () => {
    await alta('digest@example.com');
    const token = ultimoToken();
    const [fila] = await db.select().from(emailVerificationTokens);
    expect(Object.values(fila).map(String).some((v) => v.includes(token))).toBe(false);
  });

  it('de dos consumos SIMULTÁNEOS exactamente uno activa', async () => {
    await alta('carrera@example.com');
    const token = ultimoToken();
    const resultados = await Promise.all([activateAccount(db, token), activateAccount(db, token)]);
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
  });

  it('usado, caducado, inexistente y manipulado: el MISMO desenlace', async () => {
    await alta('usado@example.com');
    const usado = ultimoToken();
    await activateAccount(db, usado);

    await alta('caducado@example.com');
    const caducado = ultimoToken();
    await envejecer('caducado@example.com', ACTIVATION_WINDOW_HOURS + 1);

    await alta('manipulado@example.com');
    const vivo = ultimoToken();
    const manipulado = (vivo[0] === 'A' ? 'B' : 'A') + vivo.slice(1);

    const inexistente = 'x'.repeat(43);
    const desenlaces = await Promise.all(
      [usado, caducado, manipulado, inexistente].map((t) => activateAccount(db, t)),
    );
    for (const d of desenlaces) expect(d).toEqual({ ok: false, reason: 'invalid' });
    // Y el vivo sigue sirviendo: los fallos no lo han quemado.
    expect(await isActivationTokenUsable(db, vivo)).toBe(true);
  });

  it('ningún enlace vive más allá de las 24 h del ALTA, aunque se pida en la hora 23', async () => {
    await alta('hora23@example.com');
    await envejecer('hora23@example.com', ACTIVATION_WINDOW_HOURS - 1);
    await reenvio('hora23@example.com');
    const deLaHora23 = ultimoToken();

    const [fila] = await db
      .select({
        expira: emailVerificationTokens.expiresAt,
        alta: users.createdAt,
      })
      .from(emailVerificationTokens)
      .innerJoin(users, eq(users.id, emailVerificationTokens.userId))
      .where(eq(emailVerificationTokens.tokenHash, hashResetToken(deLaHora23)));
    expect(fila.expira.getTime()).toBeLessThanOrEqual(
      fila.alta.getTime() + ACTIVATION_WINDOW_HOURS * 3_600_000,
    );

    // Pasada la hora que le quedaba, ya no activa.
    await envejecer('hora23@example.com', 2);
    expect(await activateAccount(db, deLaHora23)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('SPEC-066 CA-12: tres correos por cuenta en 24 h, cuente lo que cuente la causa', () => {
  it('límite + 1 peticiones mezclando alta, re-alta y reenvío: salen exactamente `límite`', async () => {
    const causas = [
      () => alta('limite@example.com'),
      () => reenvio('limite@example.com'),
      () => alta('limite@example.com', 'otra-clave-2'),
      () => reenvio('limite@example.com'),
    ];
    for (let i = 0; i < ACTIVATION_EMAIL_LIMIT + 1; i++) await causas[i % causas.length]();
    expect(sender.sent).toHaveLength(ACTIVATION_EMAIL_LIMIT);
  });

  it('la ventana es MÓVIL: pasadas 24 h desde los primeros, vuelve a haber hueco', async () => {
    await alta('movil@example.com');
    for (let i = 1; i < ACTIVATION_EMAIL_LIMIT; i++) await reenvio('movil@example.com');
    await alta('movil@example.com', 'otra-clave-3'); // agotada: nada
    expect(sender.sent).toHaveLength(ACTIVATION_EMAIL_LIMIT);

    // Se envejecen los correos (no la cuenta, que sigue en plazo por la re-alta futura).
    await db
      .update(emailVerificationTokens)
      .set({ createdAt: sql`created_at - interval '25 hours'` });
    await alta('movil@example.com', 'otra-clave-4');
    expect(sender.sent).toHaveLength(ACTIVATION_EMAIL_LIMIT + 1);
  });
});

describe('SPEC-066 CA-14: el grifo se consulta al activar, y cerrado no quema el enlace', () => {
  it.each([
    ['a mano', 'manual' as const, () => cupo(50, false)],
    ['por cupo', 'capacity' as const, () => cupo(0)],
  ])('cerrado %s: sigue pendiente, el enlace vivo, el motivo concreto; reabierto, el MISMO enlace activa', async (_n, motivo, cerrar) => {
    await alta('grifo@example.com');
    const token = ultimoToken();
    await cerrar();

    const cerrado = await activateAccount(db, token);
    expect(cerrado).toEqual({ ok: false, reason: 'closed', closed: motivo });
    expect(REGISTRO_CERRADO_MOTIVO[motivo]).toBeTruthy();
    expect((await cuentaDe(db, 'grifo@example.com')).emailVerifiedAt).toBeNull();
    expect(await isActivationTokenUsable(db, token)).toBe(true);

    await cupo(50, true);
    expect((await activateAccount(db, token)).ok).toBe(true);
    expect((await cuentaDe(db, 'grifo@example.com')).emailVerifiedAt).not.toBeNull();
  });
});

describe('SPEC-066 CA-15: el cupo cuenta cuentas activadas', () => {
  it('con N−1 activadas y muchas pendientes, abierto y el recuento dice N−1; con N, cerrado', async () => {
    const N = 3;
    await cupo(N);
    for (let i = 0; i < N - 1; i++) await registerUser(db, `activa-${i}@example.com`, PWD);
    for (let i = 0; i < 5; i++) await alta(`pendiente-${i}@example.com`);

    expect(await countAccounts(db)).toBe(N - 1);
    expect(await resolveRegistrationState(db)).toEqual({ open: true });

    await registerUser(db, 'la-que-llena@example.com', PWD);
    expect(await countAccounts(db)).toBe(N);
    expect(await resolveRegistrationState(db)).toEqual({ open: false, reason: 'capacity' });
  });

  it('la función pura no cambia: lo que cambia es el número que se le pasa', async () => {
    const ajustes = await readRegistrationSettings(db);
    expect(registrationState({ ...ajustes, capacity: 2 }, 1)).toEqual({ open: true });
    expect(registrationState({ ...ajustes, capacity: 2 }, 2)).toEqual({ open: false, reason: 'capacity' });
  });

  it('activar una pendiente SÍ ocupa plaza', async () => {
    await alta('ocupa@example.com');
    const antes = await countAccounts(db);
    await activateAccount(db, ultimoToken());
    expect(await countAccounts(db)).toBe(antes + 1);
  });
});

describe('SPEC-066 CA-16: pedir otro correo no enumera y respeta el plazo', () => {
  it('cinco casos, cinco respuestas idénticas; SÓLO la pendiente en plazo recibe correo', async () => {
    await registerUser(db, 'activada@example.com', PWD);
    await alta('en-plazo@example.com');
    await alta('agotada@example.com');
    for (let i = 1; i < ACTIVATION_EMAIL_LIMIT; i++) await reenvio('agotada@example.com');
    await alta('fuera@example.com');
    await envejecer('fuera@example.com', ACTIVATION_WINDOW_HOURS + 1);
    sender.sent.length = 0;

    const casos = [
      'nadie@example.com',
      'activada@example.com',
      'en-plazo@example.com',
      'agotada@example.com',
      'fuera@example.com',
    ];
    const respuestas = [];
    for (const email of casos) {
      const r = await resendActivation(db, sender, email, { baseUrl: BASE });
      respuestas.push(Object.keys(r).sort());
      await r.delivery;
    }
    for (const r of respuestas) expect(r).toEqual(respuestas[0]);
    expect(sender.sent.map((m) => m.to)).toEqual(['en-plazo@example.com']);
  });

  it('el enlace nuevo invalida los anteriores y NO alarga el plazo', async () => {
    await alta('reenvio@example.com');
    const primero = ultimoToken();
    await envejecer('reenvio@example.com', 10);
    const { createdAt } = await cuentaDe(db, 'reenvio@example.com');

    await reenvio('reenvio@example.com');
    const segundo = ultimoToken();

    expect(await isActivationTokenUsable(db, primero)).toBe(false);
    expect(await isActivationTokenUsable(db, segundo)).toBe(true);
    expect((await cuentaDe(db, 'reenvio@example.com')).createdAt.getTime()).toBe(createdAt.getTime());
    const [fila] = await db
      .select({ expira: emailVerificationTokens.expiresAt })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, hashResetToken(segundo)));
    expect(fila.expira.getTime()).toBe(createdAt.getTime() + ACTIVATION_WINDOW_HOURS * 3_600_000);
  });

  it('no crea nada para quien no existe', async () => {
    await reenvio('fantasma@example.com');
    expect(await recuento(db, sender)).toEqual({ cuentas: 0, tokens: 0, correos: 0 });
  });
});
