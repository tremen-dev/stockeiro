'use server';

import { AuthError } from 'next-auth';
import { db } from '@/db/client';
import { registerUser } from '@/lib/auth/users';
import { signIn, signOut } from '@/lib/auth/config';
import { credentialsSchema } from '@/lib/auth/validation';
import { EmailAlreadyRegisteredError } from '@/lib/auth/errors';

export type FormState = { error: string } | undefined;

/**
 * CA-1 / CA-2: registro. Crea la cuenta (email único), y si va bien inicia sesión
 * y redirige al panel. Email duplicado -> mensaje claro (CA-2).
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
    await registerUser(db, parsed.data.email, parsed.data.password);
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
