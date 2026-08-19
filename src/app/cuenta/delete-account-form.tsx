'use client';

import { useActionState } from 'react';
import { deleteAccountAction, type DeleteAccountState } from './actions';

/**
 * SPEC-036 CA-3 — la confirmación con la contraseña actual (ADR-022 pto. 6).
 *
 * Se pide la contraseña y no "teclea tu email": el email está a la vista de
 * cualquiera que tenga el portátil abierto, así que teclearlo no demuestra nada. La
 * contraseña sí, y además reutiliza `verifyCredentials`, que ya está probado.
 *
 * El error se pinta con `role="alert"` porque es la única señal de que no ha pasado
 * nada — y en esta pantalla "no ha pasado nada" es exactamente lo que hay que saber.
 */
export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccountAction,
    undefined,
  );

  return (
    <form action={action} className="danger-form" data-testid="form-borrado">
      <label>
        Escribe tu contraseña actual para confirmar
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          data-testid="borrado-password"
        />
      </label>

      {state?.error ? (
        <p className="auth-error" role="alert" data-testid="error-borrado">
          {state.error}
        </p>
      ) : null}

      <button
        className="btn danger"
        type="submit"
        disabled={pending}
        data-testid="confirmar-borrado"
      >
        {pending ? 'Borrando…' : 'Borrar mi cuenta y todos mis datos'}
      </button>
    </form>
  );
}
