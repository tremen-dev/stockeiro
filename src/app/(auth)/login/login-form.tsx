'use client';

import { useActionState } from 'react';
import { loginAction, type FormState } from '../actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, undefined);

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
      {state?.error ? <p className="auth-error">{state.error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
