import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registrationSettings, users } from '@/db/schema';
import { registerUser } from '@/lib/auth/users';
import { REGISTRO_CERRADO_MOTIVO } from '@/lib/registration/messages';
import { BASE, SECRETO, formularioDeAlta } from './spec066-arnes';

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

/**
 * SPEC-066: el correo de activación sale por el puerto; aquí se anula para no depender
 * de Resend. Y el alta necesita `AUTH_SECRET` (sello del tiempo mínimo) y `APP_BASE_URL`
 * (origen del enlace), que en la app vienen del entorno.
 */
vi.mock('@/lib/notifications/sender-factory', () => ({
  resolveNotificationSender: () => ({ send: async () => ({ ok: true }) }),
}));
process.env.AUTH_SECRET = SECRETO;
process.env.APP_BASE_URL = BASE;

const { registerAction } = await import('@/app/(auth)/actions');

const PWD = 'clave-secreta-123';

/**
 * El formulario tal y como lo manda el navegador desde SPEC-066: con su sello de pintado
 * válido y el campo trampa vacío. Sin sello, el alta toma el envío por un automatismo y
 * responde la pantalla neutra ANTES de mirar el grifo (ADR-042 pto. 12), y este fichero
 * dejaría de probar el grifo.
 */
function formulario(email: string): FormData {
  return formularioDeAlta({ email, password: PWD, ahora: Date.now() });
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

/**
 * ⚠️ RE-ENCUADRE AUTORIZADO por SPEC-066 CA-25 ptos. 1 y 2 (anotado en su ledger).
 *
 * - **Qué vigilaba antes**: que con el grifo abierto el alta creaba la cuenta e iniciaba
 *   sesión hacia `/dashboard` (SPEC-001 CA-1), y que un correo duplicado devolvía el
 *   mensaje de SPEC-001 CA-2 («Ese email ya está registrado») y no el del grifo.
 * - **Qué vigila ahora**: que con el grifo abierto el alta crea la cuenta PENDIENTE sin
 *   sesión y responde la pantalla neutra (SPEC-066 CA-8), y que el duplicado responde
 *   EXACTAMENTE lo mismo que un correo nuevo —ni su mensaje antiguo ni el del grifo—
 *   (SPEC-066 CA-9). La propiedad del grifo de este fichero (CA-4, arriba) no cambia.
 */
describe('SPEC-037 CA-3: con el grifo abierto, la action hace lo de siempre', () => {
  it('crea la cuenta PENDIENTE, sin sesión, y responde la pantalla neutra (SPEC-066 CA-8)', async () => {
    const resultado = await ejecutar('spec037-action-ok@example.com');

    expect(await cuentas()).toBe(1);
    expect(signIn).not.toHaveBeenCalled();
    expect(resultado).toEqual({ sent: true });
  });

  it('el email duplicado responde lo MISMO que uno nuevo, no el mensaje del grifo (SPEC-066 CA-9)', async () => {
    await registerUser(db, 'ya-esta@example.com', PWD);

    const duplicado = await ejecutar('ya-esta@example.com');
    const nuevo = await ejecutar('otro-nuevo@example.com');

    expect(await cuentas()).toBe(2);
    expect(duplicado).toEqual(nuevo);
    expect(duplicado).not.toEqual({ error: REGISTRO_CERRADO_MOTIVO.manual });
    expect(duplicado).not.toEqual({ error: REGISTRO_CERRADO_MOTIVO.capacity });
  });
});
