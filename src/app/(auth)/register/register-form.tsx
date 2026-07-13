'use client';

import { useActionState } from 'react';
import { registerAction, type FormState } from '../actions';

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, undefined);

  return (
    <form action={action} className="card auth-form">
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        Contraseña
        <input name="password" type="password" required autoComplete="new-password" />
      </label>
      {state?.error ? <p className="auth-error">{state.error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
