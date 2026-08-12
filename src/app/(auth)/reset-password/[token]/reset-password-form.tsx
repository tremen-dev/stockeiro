'use client';

import { useActionState } from 'react';
import { resetPasswordAction, type ResetPasswordState } from '../../actions';

/**
 * CA-6/CA-7: el envío de ESTE formulario es lo único que consume el enlace. El token
 * viaja en un campo oculto porque la acción no ve la URL.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    undefined,
  );

  return (
    <form action={action} className="card auth-form">
      <input type="hidden" name="token" value={token} />
      <label>
        Contraseña nueva
        <input name="password" type="password" required autoComplete="new-password" autoFocus />
      </label>
      {state?.error ? <p className="auth-error">{state.error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
