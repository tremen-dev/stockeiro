'use server';

import { AuthError } from 'next-auth';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { signIn, signOut } from '@/lib/auth/config';
import { registerIfOpen } from '@/lib/registration/service';
import { REGISTRO_CERRADO_MOTIVO } from '@/lib/registration/messages';
import { credentialsSchema, emailSchema } from '@/lib/auth/validation';
import { EmailAlreadyRegisteredError } from '@/lib/auth/errors';
import { requestPasswordReset, resetPasswordWithToken } from '@/lib/auth/password-reset';
import { appBaseUrl } from '@/lib/config/app-url';
import { resolveNotificationSender } from '@/lib/notifications/sender-factory';
import { ENLACE_NO_VALIDO, RECUPERACION_ENVIADA } from '@/lib/auth/reset-messages';

export type FormState = { error: string } | undefined;

/**
 * CA-1 / CA-2: registro. Crea la cuenta (email único), y si va bien inicia sesión
 * y redirige al panel. Email duplicado -> mensaje claro (CA-2).
 *
 * SPEC-037 CA-4/CA-5 — EL GRIFO SE CONSULTA AQUÍ, antes de crear nada, y no solo al
 * pintar el formulario (ADR-023 pto. 5). Ocultar el formulario y dejar esta acción
 * aceptando envíos no sería cerrar el registro: sería esconderlo, y un `POST`
 * fabricado a mano seguiría creando cuentas. Es el mismo criterio que ADR-021 pto. 7
 * aplica a las secciones por rol.
 *
 * El motivo del cierre viaja hasta el formulario porque quien llega con la puerta
 * cerrada tiene que leer POR QUÉ (R-7), también si llegó por este camino.
 */
export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: 'Revisa el email y la contraseña.' };
  }

  try {
    const alta = await registerIfOpen(db, parsed.data.email, parsed.data.password);
    if (!alta.ok) {
      return { error: REGISTRO_CERRADO_MOTIVO[alta.reason] };
    }
  } catch (e) {
    if (e instanceof EmailAlreadyRegisteredError) {
      return { error: e.message };
    }
    throw e;
  }

  // signIn lanza la redirección (NEXT_REDIRECT); va fuera del try de registro.
  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: '/dashboard',
  });
  return undefined;
}

/**
 * CA-3 / CA-4: login. Credenciales válidas -> sesión + panel. Inválidas ->
 * mensaje genérico (no revela si el email existe).
 */
export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
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
