'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, type LoginState } from '../actions';
import { RESEND_ACTIVATION_PATH } from '@/lib/registration/activation-rules';
import { PEDIR_OTRO_ENLACE } from '@/lib/registration/signup-messages';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);

  return (
    <form action={action} className="card auth-form">
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        Contraseña
        <input name="password" type="password" required autoComplete="current-password" />
      </label>
      {state?.error ? (
        <p className="auth-error" data-testid={state.pendiente ? 'cuenta-pendiente' : undefined}>
          {state.error}
          {/* SPEC-066 CA-17: a quien le falta activar, el camino para pedir otro correo. */}
          {state.pendiente ? (
            <>
              {' '}
              <Link href={RESEND_ACTIVATION_PATH}>{PEDIR_OTRO_ENLACE}</Link>.
            </>
          ) : null}
        </p>
      ) : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
