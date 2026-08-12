'use client';

import { useActionState } from 'react';
import { requestPasswordResetAction, type ForgotPasswordState } from '../actions';

/**
 * CA-1: el desenlace es el mismo exista o no la cuenta — misma pantalla, mismo
 * texto, mismo estado visual. La única bifurcación posible es de FORMA del email,
 * que no depende de si está registrado.
 */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordResetAction,
    undefined,
  );

  if (state && 'sent' in state) {
    return (
      <div className="card auth-form auth-done" role="status">
        <p className="auth-note">{state.sent}</p>
        <p className="auth-hint">
          ¿No te ha llegado? Espera un par de minutos y vuelve a intentarlo desde esta misma
          pantalla.
        </p>
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
        {pending ? 'Enviando…' : 'Enviar enlace'}
      </button>
    </form>
  );
}
