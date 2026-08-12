import { describe, it, expect, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { notifications, passwordResetTokens, users } from '@/db/schema';
import { registerUser, verifyCredentials } from '@/lib/auth/users';
import { InvalidCredentialsError } from '@/lib/auth/errors';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';
import type { NotificationMessage, NotificationSender } from '@/lib/notifications/sender';
import {
  requestPasswordReset,
  resetPasswordWithToken,
  isResetTokenUsable,
} from '@/lib/auth/password-reset';
import {
  RESET_REQUEST_LIMIT,
  RESET_TOKEN_TTL_MINUTES,
  hashResetToken,
} from '@/lib/auth/reset-tokens';
import { credentialsSchema, newPasswordSchema } from '@/lib/auth/validation';

const BASE = 'https://stockeiro.app';
const EMAIL = 'ana@example.com';
const OLD_PWD = 'clave-vieja-123';
const NEW_PWD = 'clave-nueva-456';

let db: TestDb;
let sender: FakeNotificationSender;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  sender = new FakeNotificationSender();
});

/** Extrae el token del enlace que viaja en el cuerpo del correo. */
function tokenFromEmail(msg: NotificationMessage): string {
  const m = msg.body.match(/https?:\/\/\S*\/reset-password\/([A-Za-z0-9_-]+)/);
  if (!m) throw new Error(`El correo no lleva enlace de recuperación: ${msg.body}`);
  return m[1];
}

/** Pide un enlace, espera al envío diferido y devuelve el token en claro. */
async function requestAndReadToken(email = EMAIL): Promise<string> {
  const before = sender.sent.length;
  const { delivery } = await requestPasswordReset(db, sender, email, { baseUrl: BASE });
  await delivery;
  expect(sender.sent.length).toBe(before + 1);
  return tokenFromEmail(sender.sent[sender.sent.length - 1]);
}

describe('CA-1: la respuesta es idéntica exista o no la cuenta (CE-2, RN-02 intacta)', () => {
  it('email registrado y email inexistente devuelven el mismo desenlace, sin error', async () => {
    await registerUser(db, EMAIL, OLD_PWD);

    const conCuenta = await requestPasswordReset(db, sender, EMAIL, { baseUrl: BASE });
    const sinCuenta = await requestPasswordReset(db, sender, 'nadie@example.com', { baseUrl: BASE });

    // Mismo tipo de resultado observable: ninguna de las dos ramas informa de nada.
    expect(Object.keys(conCuenta)).toEqual(Object.keys(sinCuenta));
    await Promise.all([conCuenta.delivery, sinCuenta.delivery]);
  });

  it('un email que no existe no envía correo ni crea token', async () => {
    const { delivery } = await requestPasswordReset(db, sender, 'nadie@example.com', {
      baseUrl: BASE,
    });
    await delivery;

    expect(sender.sent).toHaveLength(0);
    const rows = await db.select().from(passwordResetTokens);
    expect(rows).toHaveLength(0);
  });

  it('un email registrado sí crea exactamente un token y envía exactamente un correo', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const { delivery } = await requestPasswordReset(db, sender, EMAIL, { baseUrl: BASE });
    await delivery;

    expect(sender.sent).toHaveLength(1);
    expect(await db.select().from(passwordResetTokens)).toHaveLength(1);
  });
});

describe('CA-2: la respuesta tampoco se distingue por el tiempo (CE-2, R-2)', () => {
  /** Sender con latencia artificial: si el envío estuviera en el camino de la respuesta, se notaría. */
  class SlowSender implements NotificationSender {
    readonly sent: NotificationMessage[] = [];
    constructor(private readonly latencyMs: number) {}
    async send(message: NotificationMessage): Promise<{ ok: boolean }> {
      this.sent.push(message);
      await new Promise((r) => setTimeout(r, this.latencyMs));
      return { ok: true };
    }
  }

  const LATENCY = 300;

  it('al retornar, el sender aún NO ha sido invocado y el envío ocurre después', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const slow = new SlowSender(LATENCY);

    const { delivery } = await requestPasswordReset(db, slow, EMAIL, { baseUrl: BASE });
    expect(slow.sent).toHaveLength(0); // el envío quedó diferido

    await delivery;
    expect(slow.sent).toHaveLength(1); // y se ejecutó después
  });

  it('ambas ramas responden por debajo de la latencia inyectada', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const slow = new SlowSender(LATENCY);

    const t0 = Date.now();
    const a = await requestPasswordReset(db, slow, EMAIL, { baseUrl: BASE });
    const conCuenta = Date.now() - t0;

    const t1 = Date.now();
    const b = await requestPasswordReset(db, slow, 'nadie@example.com', { baseUrl: BASE });
    const sinCuenta = Date.now() - t1;

    expect(conCuenta).toBeLessThan(LATENCY);
    expect(sinCuenta).toBeLessThan(LATENCY);
    await Promise.all([a.delivery, b.delivery]);
  });
});

describe('CA-3: el correo lleva el enlace, sale por el puerto y NO se registra in-app', () => {
  it('un solo mensaje al puerto, al email almacenado, con URL absoluta y el token en claro', async () => {
    await registerUser(db, '  ANA@Example.COM  ', OLD_PWD); // se almacena normalizado
    const { delivery } = await requestPasswordReset(db, sender, 'ana@example.com', {
      baseUrl: BASE,
    });
    await delivery;

    expect(sender.sent).toHaveLength(1);
    const msg = sender.sent[0];
    expect(msg.to).toBe('ana@example.com'); // el email ALMACENADO
    const token = tokenFromEmail(msg);
    expect(msg.body).toContain(`${BASE}/reset-password/${token}`);

    // El token del enlace es el que abre la fila persistida.
    const [row] = await db.select().from(passwordResetTokens);
    expect(row.tokenHash).toBe(hashResetToken(token));
  });

  it('no se crea ninguna fila en `notifications` (RN-15 no aplica a este correo)', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const { delivery } = await requestPasswordReset(db, sender, EMAIL, { baseUrl: BASE });
    await delivery;

    expect(await db.select().from(notifications)).toHaveLength(0);
  });
});

describe('CA-4: el origen del enlace sale de configuración, no de la petición', () => {
  it('el enlace usa APP_BASE_URL aunque el Host de la petición esté falsificado', async () => {
    await registerUser(db, EMAIL, OLD_PWD);

    // La petición "llega" con un Host falsificado; el servicio no lo recibe siquiera.
    const forgedHost = 'atacante.example';
    const { delivery } = await requestPasswordReset(db, sender, EMAIL, { baseUrl: BASE });
    await delivery;

    const link = sender.sent[0].body.match(/https?:\/\/\S+/)![0];
    expect(new URL(link).origin).toBe(BASE);
    expect(sender.sent[0].body).not.toContain(forgedHost);
  });
});

describe('CA-5: el token no queda almacenado en claro (R-3)', () => {
  it('ninguna columna persistida contiene el token en claro', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const token = await requestAndReadToken();

    const [row] = await db.select().from(passwordResetTokens);
    const persisted = Object.values(row).map((v) => String(v));
    for (const value of persisted) {
      expect(value).not.toBe(token);
      expect(value).not.toContain(token);
    }
    // Lo guardado es un digest irreversible; localizar la fila exige re-hashear.
    expect(row.tokenHash).toBe(hashResetToken(token));
    expect(row.tokenHash).not.toBe(token);
  });
});

describe('CA-6: con un enlace válido se establece la contraseña nueva (CE-1)', () => {
  it('cambia el hash, permite entrar con la nueva y ya no con la anterior', async () => {
    const user = await registerUser(db, EMAIL, OLD_PWD);
    const [antes] = await db.select().from(users).where(eq(users.id, user.id));
    const token = await requestAndReadToken();

    const res = await resetPasswordWithToken(db, token, NEW_PWD);
    expect(res.ok).toBe(true);

    const [despues] = await db.select().from(users).where(eq(users.id, user.id));
    expect(despues.passwordHash).not.toBe(antes.passwordHash);

    await expect(verifyCredentials(db, EMAIL, NEW_PWD)).resolves.toMatchObject({ id: user.id });
    await expect(verifyCredentials(db, EMAIL, OLD_PWD)).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('el email (RN-02) y el resto de la identidad no cambian', async () => {
    const user = await registerUser(db, EMAIL, OLD_PWD);
    const token = await requestAndReadToken();
    await resetPasswordWithToken(db, token, NEW_PWD);

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.email).toBe(EMAIL);
    expect(row.createdAt.getTime()).toBe(user.createdAt.getTime());
  });

  it('el token queda consumido y cualquier otro token vivo del usuario deja de servir', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const primero = await requestAndReadToken();
    // Se fabrica un segundo token vivo saltándose la supersesión, para probar el barrido.
    await db.insert(passwordResetTokens).values({
      userId: (await db.select().from(users))[0].id,
      tokenHash: hashResetToken('otro-token-vivo'),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });

    await resetPasswordWithToken(db, primero, NEW_PWD);

    const rows = await db.select().from(passwordResetTokens);
    expect(rows.every((r) => r.consumedAt !== null)).toBe(true);
    expect(await isResetTokenUsable(db, 'otro-token-vivo')).toBe(false);
  });
});

describe('CA-7: un solo uso, incluso con envíos simultáneos (CE-3)', () => {
  it('reusar un token consumido no cambia la contraseña', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const token = await requestAndReadToken();
    await resetPasswordWithToken(db, token, NEW_PWD);

    const segundo = await resetPasswordWithToken(db, token, 'tercera-clave-789');
    expect(segundo).toEqual({ ok: false, reason: 'invalid-token' });
    await expect(verifyCredentials(db, EMAIL, NEW_PWD)).resolves.toBeTruthy();
    await expect(verifyCredentials(db, EMAIL, 'tercera-clave-789')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('dos envíos simultáneos del mismo token: exactamente uno cambia la contraseña', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const token = await requestAndReadToken();

    const [a, b] = await Promise.all([
      resetPasswordWithToken(db, token, 'clave-a-111'),
      resetPasswordWithToken(db, token, 'clave-b-222'),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);

    // Y solo la ganadora vale para entrar.
    const ganadora = a.ok ? 'clave-a-111' : 'clave-b-222';
    const perdedora = a.ok ? 'clave-b-222' : 'clave-a-111';
    await expect(verifyCredentials(db, EMAIL, ganadora)).resolves.toBeTruthy();
    await expect(verifyCredentials(db, EMAIL, perdedora)).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });
});

describe('CA-8: caducidad (30 min, ADR-015 pto. 4)', () => {
  it('la ventana configurada es de 30 minutos y se persiste en `expiresAt`', async () => {
    expect(RESET_TOKEN_TTL_MINUTES).toBe(30);
    await registerUser(db, EMAIL, OLD_PWD);
    await requestAndReadToken();

    const [row] = await db.select().from(passwordResetTokens);
    const minutos = (row.expiresAt.getTime() - row.createdAt.getTime()) / 60_000;
    expect(minutos).toBeCloseTo(RESET_TOKEN_TTL_MINUTES, 1);
  });

  it('un token caducado no concede nada y no cambia la contraseña', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const token = await requestAndReadToken();
    await db.update(passwordResetTokens).set({ expiresAt: sql`now() - interval '1 minute'` });

    expect(await isResetTokenUsable(db, token)).toBe(false);
    const res = await resetPasswordWithToken(db, token, NEW_PWD);
    expect(res).toEqual({ ok: false, reason: 'invalid-token' });
    await expect(verifyCredentials(db, EMAIL, OLD_PWD)).resolves.toBeTruthy();
  });
});

describe('CA-9: enlace inexistente o manipulado, misma respuesta', () => {
  it('un token que nunca existió responde igual que uno consumido o caducado', async () => {
    await registerUser(db, EMAIL, OLD_PWD);

    const inexistente = await resetPasswordWithToken(db, 'jamas-emitido', NEW_PWD);

    const usado = await requestAndReadToken();
    await resetPasswordWithToken(db, usado, NEW_PWD);
    const reusado = await resetPasswordWithToken(db, usado, 'otra-mas-999');

    const caducado = await requestAndReadToken();
    await db.update(passwordResetTokens).set({ expiresAt: sql`now() - interval '1 minute'` });
    const expirado = await resetPasswordWithToken(db, caducado, 'otra-mas-999');

    expect(inexistente).toEqual(reusado);
    expect(reusado).toEqual(expirado);
    expect(inexistente).toEqual({ ok: false, reason: 'invalid-token' });
  });

  it('un token válido con un carácter alterado no vale', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const token = await requestAndReadToken();
    const alterado = (token[0] === 'A' ? 'B' : 'A') + token.slice(1);

    expect(await isResetTokenUsable(db, alterado)).toBe(false);
    expect(await resetPasswordWithToken(db, alterado, NEW_PWD)).toEqual({
      ok: false,
      reason: 'invalid-token',
    });
    await expect(verifyCredentials(db, EMAIL, OLD_PWD)).resolves.toBeTruthy();
  });
});

describe('CA-10: abrir el enlace no lo gasta (R-3)', () => {
  it('comprobar el token (GET) lo deja usable y luego el envío sí lo consume', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const token = await requestAndReadToken();

    // Tres "visitas" (antivirus de correo, vista previa, el propio usuario).
    expect(await isResetTokenUsable(db, token)).toBe(true);
    expect(await isResetTokenUsable(db, token)).toBe(true);
    expect(await isResetTokenUsable(db, token)).toBe(true);

    const [row] = await db.select().from(passwordResetTokens);
    expect(row.consumedAt).toBeNull();

    expect((await resetPasswordWithToken(db, token, NEW_PWD)).ok).toBe(true);
  });
});

describe('CA-11: pedir un enlace nuevo invalida el anterior (CE-3)', () => {
  it('solo el último enlace es usable', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const viejo = await requestAndReadToken();
    const nuevo = await requestAndReadToken();
    expect(nuevo).not.toBe(viejo);

    expect(await isResetTokenUsable(db, viejo)).toBe(false);
    expect(await isResetTokenUsable(db, nuevo)).toBe(true);

    expect(await resetPasswordWithToken(db, viejo, NEW_PWD)).toEqual({
      ok: false,
      reason: 'invalid-token',
    });
    expect((await resetPasswordWithToken(db, nuevo, NEW_PWD)).ok).toBe(true);
  });
});

describe('CA-12: límite por cuenta y ventana, invisible en la respuesta', () => {
  it('la cuarta solicitud dentro de la hora no crea token ni envía correo', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    expect(RESET_REQUEST_LIMIT).toBe(3);

    for (let i = 0; i < RESET_REQUEST_LIMIT; i++) {
      const { delivery } = await requestPasswordReset(db, sender, EMAIL, { baseUrl: BASE });
      await delivery;
    }
    expect(sender.sent).toHaveLength(RESET_REQUEST_LIMIT);
    const tokensAntes = await db.select().from(passwordResetTokens);

    const cuarta = await requestPasswordReset(db, sender, EMAIL, { baseUrl: BASE });
    await cuarta.delivery;

    expect(sender.sent).toHaveLength(RESET_REQUEST_LIMIT); // ni un correo más
    expect(await db.select().from(passwordResetTokens)).toHaveLength(tokensAntes.length);
  });

  it('la respuesta de la cuarta es indistinguible de la genérica de CA-1', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    for (let i = 0; i < RESET_REQUEST_LIMIT; i++) {
      await (await requestPasswordReset(db, sender, EMAIL, { baseUrl: BASE })).delivery;
    }

    const limitada = await requestPasswordReset(db, sender, EMAIL, { baseUrl: BASE });
    const desconocida = await requestPasswordReset(db, sender, 'nadie@example.com', {
      baseUrl: BASE,
    });
    expect(Object.keys(limitada)).toEqual(Object.keys(desconocida));
    await Promise.all([limitada.delivery, desconocida.delivery]);
  });

  it('pasada la ventana vuelve a funcionar', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    for (let i = 0; i < RESET_REQUEST_LIMIT; i++) {
      await (await requestPasswordReset(db, sender, EMAIL, { baseUrl: BASE })).delivery;
    }
    // Las solicitudes envejecen fuera de la ventana de una hora.
    await db
      .update(passwordResetTokens)
      .set({ createdAt: sql`now() - interval '2 hours'` });

    const { delivery } = await requestPasswordReset(db, sender, EMAIL, { baseUrl: BASE });
    await delivery;
    expect(sender.sent).toHaveLength(RESET_REQUEST_LIMIT + 1);
  });

  it('el límite es por cuenta: otro usuario no se ve afectado', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    await registerUser(db, 'bea@example.com', OLD_PWD);
    for (let i = 0; i < RESET_REQUEST_LIMIT + 1; i++) {
      await (await requestPasswordReset(db, sender, EMAIL, { baseUrl: BASE })).delivery;
    }
    const antes = sender.sent.length;

    await (await requestPasswordReset(db, sender, 'bea@example.com', { baseUrl: BASE })).delivery;
    expect(sender.sent).toHaveLength(antes + 1);
  });
});

describe('CA-16: el reset no inventa política de contraseña (CE-5)', () => {
  /** Contraseñas que el REGISTRO acepta hoy: la política sigue delegada en Auth.js. */
  const aceptadasPorElRegistro = ['a', '1234', 'clave', 'clave sin mayúsculas ni dígitos', '        x'];

  it('la regla del reset ES la del registro, tomada de `credentialsSchema`', () => {
    expect(newPasswordSchema).toBe(credentialsSchema.shape.password);
  });

  it('lo que el registro acepta, el reset lo acepta también', async () => {
    for (const pwd of aceptadasPorElRegistro) {
      expect(credentialsSchema.shape.password.safeParse(pwd).success).toBe(true);
      expect(newPasswordSchema.safeParse(pwd).success).toBe(true);
    }
  });

  it('extremo a extremo: una contraseña débil que el registro admite sirve para el reset', async () => {
    await registerUser(db, EMAIL, 'a'); // el registro la admite hoy
    const token = await requestAndReadToken();

    expect((await resetPasswordWithToken(db, token, 'b')).ok).toBe(true);
    await expect(verifyCredentials(db, EMAIL, 'b')).resolves.toBeTruthy();
  });

  it('lo único que se rechaza es la ausencia de contraseña, y sin quemar el enlace', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const token = await requestAndReadToken();

    expect(await resetPasswordWithToken(db, token, '')).toEqual({
      ok: false,
      reason: 'invalid-password',
    });
    // El enlace sigue vivo: un envío mal formado no puede dejar al usuario fuera.
    expect(await isResetTokenUsable(db, token)).toBe(true);
    expect((await resetPasswordWithToken(db, token, NEW_PWD)).ok).toBe(true);
  });
});
