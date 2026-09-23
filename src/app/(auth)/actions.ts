'use server';

import { AuthError } from 'next-auth';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { signIn, signOut } from '@/lib/auth/config';
import { REGISTRO_CERRADO_MOTIVO } from '@/lib/registration/messages';
import { credentialsSchema, emailSchema } from '@/lib/auth/validation';
import { AccountPendingError } from '@/lib/auth/errors';
import { verifyCredentials } from '@/lib/auth/users';
import { handleResend, handleSignup } from '@/lib/registration/signup-flow';
import { makeBotCheck } from '@/lib/registration/bot-check';
import { activateAccount } from '@/lib/registration/signup';
import { ACTIVATED_LOGIN_PATH } from '@/lib/registration/activation-rules';
import {
  CUENTA_PENDIENTE,
  ENLACE_ACTIVACION_NO_VALIDO,
  REENVIO_ENVIADO,
} from '@/lib/registration/signup-messages';
import { requestPasswordReset, resetPasswordWithToken } from '@/lib/auth/password-reset';
import { appBaseUrl } from '@/lib/config/app-url';
import { resolveNotificationSender } from '@/lib/notifications/sender-factory';
import { ENLACE_NO_VALIDO, RECUPERACION_ENVIADA } from '@/lib/auth/reset-messages';

export type FormState = { error: string } | undefined;

/** Lo que el alta devuelve al formulario: un error de forma o de grifo, o la respuesta neutra. */
export type RegisterState = { error: string } | { sent: true } | undefined;

/** `AUTH_SECRET` sin la cual no hay sello del tiempo mínimo (ADR-042 pto. 15, ninguna variable nueva). */
function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET no definida (ver .env.example): sin ella no hay alta.');
  return secret;
}

/**
 * SPEC-066 — el ALTA defendida (ADR-042). Ya no crea una cuenta con sesión: crea, como
 * mucho, una cuenta PENDIENTE y un correo de activación, detrás de tres capas —campo
 * trampa y tiempo mínimo, BotID, verificación del correo— en el orden de ADR-042 pto. 12.
 *
 * La respuesta es la NEUTRA (`{ sent: true }`) tanto si el correo es nuevo como si ya
 * tenía cuenta pendiente o activada, y también si el envío se ha tomado por un
 * automatismo (ptos. 6 y 13). El texto «Ese email ya está registrado» ya no sale por
 * ningún camino (CA-9); RN-02 sigue intacta.
 *
 * SPEC-037 CA-4/CA-5 sigue en pie: el grifo se consulta aquí, en el camino del alta, y
 * cerrado no crea nada y dice por qué (ADR-023 pto. 5).
 *
 * El envío del correo sale del camino de la respuesta con `after()` (ADR-015).
 */
export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const resultado = await handleSignup(
    {
      db,
      sender: resolveNotificationSender(),
      baseUrl: appBaseUrl(), // nunca desde la cabecera Host (ADR-015 pto. 8)
      secret: authSecret(),
      now: Date.now(),
      botCheck: makeBotCheck(),
    },
    formData,
  );

  if (resultado.kind === 'invalid-form') return { error: 'Revisa el email y la contraseña.' };
  if (resultado.kind === 'closed') return { error: REGISTRO_CERRADO_MOTIVO[resultado.reason] };

  after(() => resultado.delivery);
  return { sent: true };
}

/** Lo que el login devuelve: el error, y si es el de cuenta pendiente (enlace a reenviar). */
export type LoginState = { error: string; pendiente?: true } | undefined;

/**
 * CA-3 / CA-4: login. Credenciales válidas -> sesión + panel. Inválidas ->
 * mensaje genérico (no revela si el email existe).
 *
 * SPEC-066 CA-17 (ADR-042 pto. 9): las credenciales se comprueban aquí ANTES de
 * `signIn`, con el mismo `verifyCredentials` que usa Auth.js. Con la contraseña correcta
 * de una cuenta pendiente no hay sesión y se dice que falta activarla; con una
 * incorrecta, el genérico de siempre. Las tres ramas de fallo cuestan lo mismo (un solo
 * bcrypt, el señuelo incluido), así que el reloj tampoco distingue.
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: 'Email o contraseña incorrectos.' };
  }

  try {
    await verifyCredentials(db, parsed.data.email, parsed.data.password);
  } catch (e) {
    if (e instanceof AccountPendingError) return { error: CUENTA_PENDIENTE, pendiente: true };
    return { error: 'Email o contraseña incorrectos.' };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/dashboard',
    });
  } catch (e) {
    // AuthError = credenciales inválidas. Cualquier otro error (p. ej. la
    // redirección de éxito) se re-lanza para que Next lo procese.
    if (e instanceof AuthError) {
      return { error: 'Email o contraseña incorrectos.' };
    }
    throw e;
  }
  return undefined;
}

/** CA-7: cierre de sesión. Invalida la sesión y vuelve a login. */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}

// ============================================================================
// SPEC-023 — Recuperación de contraseña por email
// ============================================================================

export type ForgotPasswordState = { sent: string } | { error: string } | undefined;

/**
 * SPEC-023 CA-1/CA-2/CA-12: solicitud de recuperación.
 *
 * Devuelve SIEMPRE el mismo acuse, exista la cuenta o no, y esté o no limitada por
 * CA-12 (CE-2): esta acción no sabe —ni quiere saber— qué rama tomó el servicio.
 *
 * El envío sale del camino de la respuesta con `after()` (CA-2): el acuse se pinta
 * sin esperar al correo, así que el reloj tampoco delata si se envió algo.
 *
 * El único error posible es de FORMA del email (no es una dirección), que no depende
 * de si está registrado y por tanto no es un oráculo de enumeración.
 */
export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) {
    return { error: 'Escribe una dirección de email válida.' };
  }

  const { delivery } = await requestPasswordReset(
    db,
    resolveNotificationSender(),
    parsed.data,
    { baseUrl: appBaseUrl() }, // CA-4: nunca desde la cabecera Host
  );
  after(() => delivery);

  return { sent: RECUPERACION_ENVIADA };
}

export type ResetPasswordState = { error: string } | undefined;

/**
 * SPEC-023 CA-6..CA-9/CA-14: establece la contraseña nueva.
 *
 * Es el ÚNICO punto que consume el enlace (ADR-015 pto. 6). Usado, caducado,
 * inexistente y manipulado comparten mensaje (CA-9). Con éxito NO se emite sesión
 * (CA-14): una ruta pública no debe poder autenticar; el usuario vuelve a `/login`.
 */
export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get('token') ?? '');
  const result = await resetPasswordWithToken(db, token, formData.get('password'));

  if (!result.ok) {
    return {
      error:
        result.reason === 'invalid-password'
          ? 'Escribe la contraseña nueva.'
          : ENLACE_NO_VALIDO,
    };
  }

  redirect('/login?reset=1'); // lanza NEXT_REDIRECT
}

// ============================================================================
// SPEC-066 — Activación de la cuenta y reenvío del correo
// ============================================================================

export type ResendState = { sent: string } | { error: string } | undefined;

/**
 * SPEC-066 CA-16: pedir otro correo de activación. El acuse es el MISMO para un correo
 * inexistente, una cuenta activada, una pendiente en plazo, una con el límite agotado y
 * una fuera de plazo; sólo en el tercer caso sale correo. Protegido por BotID (CA-4, CA-5).
 */
export async function resendActivationAction(
  _prev: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const resultado = await handleResend(
    {
      db,
      sender: resolveNotificationSender(),
      baseUrl: appBaseUrl(),
      botCheck: makeBotCheck(),
    },
    formData,
  );
  if (resultado.kind === 'invalid-email') return { error: 'Escribe una dirección de email válida.' };
  after(() => resultado.delivery);
  return { sent: REENVIO_ENVIADO };
}

export type ActivateState = { error: string } | undefined;

/**
 * SPEC-066 CA-13/CA-14: el botón de activar. Es el ÚNICO punto que consume el enlace (el
 * GET de la página sólo mira). Con éxito NO inicia sesión: manda a `/login` con el aviso
 * de cuenta activada (ADR-042 pto. 8). Con el grifo cerrado, la cuenta sigue pendiente,
 * el enlace sigue vivo y se lee el motivo (pto. 10).
 */
export async function activateAccountAction(
  _prev: ActivateState,
  formData: FormData,
): Promise<ActivateState> {
  const token = String(formData.get('token') ?? '');
  const resultado = await activateAccount(db, token);
  if (!resultado.ok) {
    return {
      error:
        resultado.reason === 'closed'
          ? REGISTRO_CERRADO_MOTIVO[resultado.closed]
          : ENLACE_ACTIVACION_NO_VALIDO,
    };
  }
  redirect(ACTIVATED_LOGIN_PATH); // lanza NEXT_REDIRECT
}
