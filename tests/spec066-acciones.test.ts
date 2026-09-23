import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { users } from '@/db/schema';
import { registerUser } from '@/lib/auth/users';
import { InvalidCredentialsError } from '@/lib/auth/errors';
import { ACTIVATED_LOGIN_PATH } from '@/lib/registration/activation-rules';
import {
  CUENTA_PENDIENTE,
  ENLACE_ACTIVACION_NO_VALIDO,
} from '@/lib/registration/signup-messages';
import { isActivationTokenUsable } from '@/lib/registration/signup';
import { BASE, PWD, SECRETO, cuentaDe, formularioDeAlta, tokenDelCorreo } from './spec066-arnes';
import type { NotificationMessage } from '@/lib/notifications/sender';

/**
 * SPEC-066 — las server actions REALES, invocadas por detrás de la pantalla, como haría
 * un `POST` fabricado a mano: CA-9 (la respuesta del alta), CA-13 (activar no inicia
 * sesión) y CA-17 (entrar con una cuenta pendiente).
 *
 * El arnés es el de `tests/registration-action.test.ts`: `@/db/client` es PGlite y
 * `@/lib/auth/config` un doble, de modo que la acción corre entera contra una base real.
 * El correo se captura sustituyendo la fábrica del puerto por un buzón en memoria, y BotID
 * corre por su vía de desarrollo (fuera de Vercel), que es lo que ocurre en local y en CI.
 */

const contexto: { db: TestDb | null } = { db: null };
const buzon: NotificationMessage[] = [];

vi.mock('@/db/client', () => ({
  get db() {
    return contexto.db;
  },
}));
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }));
const pendientes: Array<Promise<unknown>> = [];
vi.mock('next/server', () => ({
  after: (fn: () => unknown) => {
    pendientes.push(Promise.resolve(fn()));
  },
}));
vi.mock('next/navigation', () => ({
  redirect: (destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  },
}));
const signIn = vi.fn(async () => undefined);
vi.mock('@/lib/auth/config', () => ({
  auth: async () => null,
  signIn: (...args: unknown[]) => signIn(...(args as [])),
  signOut: async () => undefined,
  handlers: {},
}));
vi.mock('@/lib/notifications/sender-factory', () => ({
  resolveNotificationSender: () => ({
    send: async (m: NotificationMessage) => {
      buzon.push(m);
      return { ok: true };
    },
  }),
}));

let acciones: typeof import('@/app/(auth)/actions');

beforeAll(async () => {
  process.env.AUTH_SECRET = SECRETO;
  process.env.APP_BASE_URL = BASE;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  acciones = await import('@/app/(auth)/actions');
});

let db: TestDb;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  contexto.db = db;
  buzon.length = 0;
  pendientes.length = 0;
  signIn.mockClear();
});

async function darDeAlta(email: string, password = PWD) {
  const ahora = Date.now();
  const r = await acciones.registerAction(undefined, formularioDeAlta({ email, password, ahora }));
  await Promise.all(pendientes);
  return r;
}

async function ejecutar<T>(fn: () => Promise<T>): Promise<T | { redirect: string }> {
  try {
    return await fn();
  } catch (e) {
    const m = /^NEXT_REDIRECT:(.*)$/.exec(e instanceof Error ? e.message : '');
    if (m) return { redirect: m[1] };
    throw e;
  }
}

function login(email: string, password: string) {
  const fd = new FormData();
  fd.set('email', email);
  fd.set('password', password);
  return ejecutar(() => acciones.loginAction(undefined, fd));
}

function activar(token: string) {
  const fd = new FormData();
  fd.set('token', token);
  return ejecutar(() => acciones.activateAccountAction(undefined, fd));
}

describe('SPEC-066 CA-9: la acción del alta responde lo mismo exista o no el correo', () => {
  it('nuevo, pendiente y activado: el MISMO valor, comparados entre sí', async () => {
    await darDeAlta('pendiente@example.com');
    await registerUser(db, 'activada@example.com', PWD);

    const nuevo = await darDeAlta('nuevo@example.com');
    const pendiente = await darDeAlta('pendiente@example.com', 'otra-clave-7');
    const activada = await darDeAlta('activada@example.com', 'otra-clave-7');

    expect(pendiente).toEqual(nuevo);
    expect(activada).toEqual(nuevo);
    expect(nuevo).not.toHaveProperty('error');
  });

  it('«Ese email ya está registrado» no sale por ningún camino, y no hay sesión', async () => {
    await registerUser(db, 'ya@example.com', PWD);
    const r = await darDeAlta('ya@example.com');
    expect(JSON.stringify(r)).not.toMatch(/ya está registrado/i);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('un alta NO inicia sesión (CA-8): nadie llama a signIn', async () => {
    await darDeAlta('sin-sesion@example.com');
    expect(signIn).not.toHaveBeenCalled();
    expect(buzon).toHaveLength(1);
  });
});

describe('SPEC-066 CA-13: abrir el enlace no activa; pulsar sí, y no inicia sesión', () => {
  it('pulsar activa, consume, manda a /login con el aviso y NO llama a signIn', async () => {
    await darDeAlta('activar@example.com');
    const token = tokenDelCorreo(buzon[0]);

    const r = await activar(token);

    expect(r).toEqual({ redirect: ACTIVATED_LOGIN_PATH });
    expect((await cuentaDe(db, 'activar@example.com')).emailVerifiedAt).not.toBeNull();
    expect(await isActivationTokenUsable(db, token)).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('un enlace que no sirve dice el mensaje único y no redirige', async () => {
    expect(await activar('no-existe')).toEqual({ error: ENLACE_ACTIVACION_NO_VALIDO });
  });
});

describe('SPEC-066 CA-17: entrar con una cuenta pendiente', () => {
  it('con la contraseña CORRECTA: no hay sesión y se dice que falta activar, con enlace a reenviar', async () => {
    await darDeAlta('pend@example.com');
    const r = await login('pend@example.com', PWD);
    expect(r).toEqual({ error: CUENTA_PENDIENTE, pendiente: true });
    expect(signIn).not.toHaveBeenCalled();
  });

  it('con la contraseña INCORRECTA: idéntico a un correo inexistente (SPEC-001 CA-4 intacto)', async () => {
    await darDeAlta('pend@example.com');
    const mala = await login('pend@example.com', 'esta-no-es');
    const inexistente = await login('nadie@example.com', 'esta-no-es');
    expect(mala).toEqual(inexistente);
    expect(mala).toEqual({ error: new InvalidCredentialsError().message });
    expect(signIn).not.toHaveBeenCalled();
  });

  it('control: una cuenta activada con su contraseña sí llega a signIn', async () => {
    await registerUser(db, 'activa@example.com', PWD);
    await login('activa@example.com', PWD);
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('y tras activar, la misma persona ya entra', async () => {
    await darDeAlta('luego@example.com');
    await activar(tokenDelCorreo(buzon[0]));
    await login('luego@example.com', PWD);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect((await db.select().from(users)).length).toBe(1);
  });
});
