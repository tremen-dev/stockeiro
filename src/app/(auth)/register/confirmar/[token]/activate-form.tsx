'use client';

import { useActionState } from 'react';
import { activateAccountAction, type ActivateState } from '../../../actions';
import { ACTIVAR_BOTON } from '@/lib/registration/signup-messages';

/**
 * SPEC-066 CA-13/CA-14 — el botón que activa. El token viaja en el cuerpo del POST; con
 * éxito la acción manda a `/login?activada=1` sin iniciar sesión. Con el grifo cerrado se
 * lee aquí el motivo, y el mismo enlace sigue sirviendo cuando se reabra.
 */
export function ActivateForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ActivateState, FormData>(
    activateAccountAction,
    undefined,
  );

  return (
    <form action={action} className="card auth-form">
      <input type="hidden" name="token" value={token} />
      {state?.error ? (
        <p className="auth-error" data-testid="activacion-error">
          {state.error}
        </p>
      ) : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Activando…' : ACTIVAR_BOTON}
      </button>
    </form>
  );
}
