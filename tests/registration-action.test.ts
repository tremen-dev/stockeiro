import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registrationSettings, users } from '@/db/schema';
import { registerUser } from '@/lib/auth/users';
import { REGISTRO_CERRADO_MOTIVO } from '@/lib/registration/messages';

/**
 * SPEC-037 CA-4 / CA-5 — la server action del alta, invocada DIRECTAMENTE.
 *
 * «Ocultar el formulario sin cerrar la acción **no** cumple este CA», dice la spec, y
 * es la clase de defecto que solo se ve atacando la acción por detrás de la pantalla.
 * Así que aquí no hay navegador: se importa `registerAction` y se le pasa un
 * `FormData` a pelo, como haría un `POST` fabricado a mano.
 *
 * El arnés es el de `tests/cartera-actions-role.test.ts` (SPEC-034 CA-7), que es el
 * patrón del proyecto para esto: `@/db/client` se sustituye por PGlite y
 * `@/lib/auth/config` por dobles, de modo que la action real corre entera contra una
 * base real.
 *
 * Y la medida es la de siempre: **cuántas filas hay en `users`**. Que la acción
 * devuelva un mensaje no prueba nada; que la cuenta no exista, sí.
 */

const contexto: { db: TestDb | null } = { db: null };

vi.mock('@/db/client', () => ({
  get db() {
    return contexto.db;
  },
}));

/**
 * `next-auth` y los ayudantes de Next se anulan porque `actions.ts` los importa en
 * el módulo (no en la función): sin esto, el fichero ni siquiera carga fuera del
 * runtime de Next. Lo que se prueba sigue siendo la action REAL.
 */
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));
vi.mock('next/navigation', () => ({
  redirect: (destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  },
}));

/** `signIn` se anula: aquí no se prueba la sesión, se prueba que no se crea la cuenta. */
const signIn = vi.fn(async () => undefined);
vi.mock('@/lib/auth/config', () => ({
  auth: async () => null,
  signIn: (...args: unknown[]) => signIn(...(args as [])),
  signOut: async () => undefined,
  handlers: {},
}));

const { registerAction } = await import('@/app/(auth)/actions');

const PWD = 'clave-secreta-123';

function formulario(email: string): FormData {
  const fd = new FormData();
  fd.set('email', email);
  fd.set('password', PWD);
  return fd;
}

/** Invoca la action y devuelve lo que resolvió, o el error que lanzó. */
async function ejecutar(email: string): Promise<unknown> {
  try {
    return (await registerAction(undefined, formulario(email))) ?? {};
  } catch (e) {
    return { throw: e instanceof Error ? e.message : String(e) };
  }
}

let db: TestDb;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  contexto.db = db;
  signIn.mockClear();
});

const cuentas = async () => (await db.select().from(users)).length;

describe('SPEC-037 CA-4: la server action del alta también está cerrada', () => {
  it('con el registro cerrado A MANO no se crea ninguna cuenta, y lo dice', async () => {
    await db.update(registrationSettings).set({ openManually: false });

    const resultado = await ejecutar('spec037-action-manual@example.com');

    expect(await cuentas()).toBe(0);
    expect(resultado).toEqual({ error: REGISTRO_CERRADO_MOTIVO.manual });
    // Ni se ha iniciado sesión de nadie: no hay cuenta con la que iniciarla.
    expect(signIn).not.toHaveBeenCalled();
  });

  it('con el registro cerrado POR CUPO tampoco, y el mensaje es el OTRO', async () => {
    await db.update(registrationSettings).set({ openManually: true, capacity: 1 });
    await registerUser(db, 'ocupante@example.com', PWD);

    const resultado = await ejecutar('spec037-action-cupo@example.com');

    expect(await cuentas()).toBe(1);
    expect(resultado).toEqual({ error: REGISTRO_CERRADO_MOTIVO.capacity });
    expect(REGISTRO_CERRADO_MOTIVO.capacity).not.toBe(REGISTRO_CERRADO_MOTIVO.manual);
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe('SPEC-037 CA-3: con el grifo abierto, la action hace lo de siempre', () => {
  it('crea la cuenta e inicia sesión hacia el panel (SPEC-001 CA-1)', async () => {
    await ejecutar('spec037-action-ok@example.com');

    expect(await cuentas()).toBe(1);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn.mock.calls[0]).toEqual([
      'credentials',
      expect.objectContaining({ email: 'spec037-action-ok@example.com', redirectTo: '/dashboard' }),
    ]);
  });

  it('el email duplicado sigue dando el mensaje de SPEC-001 CA-2, no el del grifo', async () => {
    await registerUser(db, 'ya-esta@example.com', PWD);

    const resultado = (await ejecutar('ya-esta@example.com')) as { error?: string };

    expect(await cuentas()).toBe(1);
    expect(resultado.error).toBeTruthy();
    expect(resultado.error).not.toBe(REGISTRO_CERRADO_MOTIVO.manual);
    expect(resultado.error).not.toBe(REGISTRO_CERRADO_MOTIVO.capacity);
  });
});
