import { expect } from 'vitest';
import { eq } from 'drizzle-orm';
import type { TestDb } from '@/db/test-db';
import { emailVerificationTokens, users } from '@/db/schema';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';
import type { NotificationMessage } from '@/lib/notifications/sender';
import {
  HONEYPOT_FIELD,
  MIN_FORM_FILL_MS,
  RENDER_SEAL_FIELD,
} from '@/lib/registration/activation-rules';
import type { BotCheck } from '@/lib/registration/bot-check';
import { sealFormRender } from '@/lib/registration/form-guard';
import type { SignupFlowDeps } from '@/lib/registration/signup-flow';

/**
 * SPEC-066 — el arnés común de sus unitarios. No es un test: lo importan los
 * `spec066-*.test.ts`. Construye el formulario del alta como lo mandaría el navegador
 * (con su sello y su campo trampa) y cuenta lo que importa de verdad: filas en `users` y
 * en `email_verification_tokens`, y llamadas al puerto de correo. «No crea nada» es esas
 * tres cosas a cero (convención de la spec).
 */

export const SECRETO = 'spec066-secreto-de-prueba-0123456789abcdef';
export const BASE = 'https://stockeiro.app';
export const PWD = 'clave-secreta-123';

/** Un sello propio, pintado `hace` milisegundos antes de `ahora`. */
export function selloDeHace(hace: number, ahora: number, secreto = SECRETO): string {
  return sealFormRender(ahora - hace, secreto);
}

/** Un sello que SÍ supera el tiempo mínimo, con margen. */
export function selloValido(ahora: number): string {
  return selloDeHace(MIN_FORM_FILL_MS + 500, ahora);
}

export function formularioDeAlta(o: {
  email: string;
  password?: string;
  sello?: string | null;
  trampa?: string | null;
  ahora: number;
}): FormData {
  const fd = new FormData();
  fd.set('email', o.email);
  fd.set('password', o.password ?? PWD);
  const sello = o.sello === undefined ? selloValido(o.ahora) : o.sello;
  if (sello !== null) fd.set(RENDER_SEAL_FIELD, sello);
  if (o.trampa !== null && o.trampa !== undefined) fd.set(HONEYPOT_FIELD, o.trampa);
  return fd;
}

export const siempreHumano: BotCheck = async () => 'humano';

export function depsDeAlta(
  db: TestDb,
  sender: FakeNotificationSender,
  o: Partial<SignupFlowDeps> = {},
): SignupFlowDeps {
  return {
    db,
    sender,
    baseUrl: BASE,
    secret: SECRETO,
    now: Date.now(),
    botCheck: siempreHumano,
    ...o,
  };
}

/** Lo que hay en la base y en el buzón: la medida de «no crea nada». */
export async function recuento(db: TestDb, sender: FakeNotificationSender) {
  return {
    cuentas: (await db.select({ id: users.id }).from(users)).length,
    tokens: (await db.select({ id: emailVerificationTokens.id }).from(emailVerificationTokens))
      .length,
    correos: sender.sent.length,
  };
}

export async function cuentaDe(db: TestDb, email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return u;
}

/** El token en claro del enlace de activación que viaja en el TEXTO de un correo. */
export function tokenDelCorreo(msg: NotificationMessage): string {
  const m = msg.body.match(/https?:\/\/\S*\/register\/confirmar\/([A-Za-z0-9_-]+)/);
  expect(m, `el correo no lleva enlace de activación: ${msg.body}`).not.toBeNull();
  return m![1];
}

export { FakeNotificationSender };
