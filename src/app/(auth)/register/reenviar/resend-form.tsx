'use client';

import { useActionState } from 'react';
import { resendActivationAction, type ResendState } from '../../actions';

/** SPEC-066 CA-16: el acuse es el mismo en todos los casos; sólo la forma del email da error. */
export function ResendForm() {
  const [state, action, pending] = useActionState<ResendState, FormData>(
    resendActivationAction,
    undefined,
  );

  if (state && 'sent' in state) {
    return (
      <div className="card auth-form auth-done" role="status" data-testid="reenvio-enviado">
        <p className="auth-note">{state.sent}</p>
      </div>
    );
  }

  return (
    <form action={action} className="card auth-form">
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" autoFocus />
      </label>
      {state && 'error' in state ? <p className="auth-error">{state.error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar otro enlace'}
      </button>
    </form>
  );
}
