'use client';

import { useActionState } from 'react';
import { updateGateAction, type GateFormState } from './actions';

/**
 * El interruptor y el cupo (SPEC-037 CA-7, CA-21).
 *
 * Dos controles y un botón: el estado del grifo se cambia en **dos clics** —marcar o
 * desmarcar y guardar—, que es literalmente lo que CE-6 pide. Nada de confirmaciones
 * ni de diálogos: cerrar la puerta un domingo por la noche tiene que ser inmediato.
 *
 * El cupo se escribe en claro y vacío significa «sin tope», no cero. La validación
 * de verdad NO está aquí sino en la server action (`parseCapacity`): un `type=number`
 * en el navegador es una comodidad, jamás la garantía — quien envíe el formulario a
 * mano se salta cualquier atributo del HTML.
 */
export function GateForm({
  openManually,
  capacity,
}: {
  openManually: boolean;
  capacity: number | null;
}) {
  const [state, action, pending] = useActionState<GateFormState, FormData>(
    updateGateAction,
    undefined,
  );

  return (
    <form action={action} className="ops-form" data-testid="grifo-form">
      <label className="ops-check">
        <input
          type="checkbox"
          name="openManually"
          value="si"
          defaultChecked={openManually}
          data-testid="interruptor"
        />
        <span>Aceptar altas nuevas</span>
      </label>

      <label className="ops-campo">
        <span>Cupo de cuentas (vacío = sin tope)</span>
        <input
          name="capacity"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={capacity === null ? '' : String(capacity)}
          data-testid="cupo"
        />
      </label>

      <button className="btn primary" type="submit" disabled={pending} data-testid="guardar-grifo">
        {pending ? 'Guardando…' : 'Guardar'}
      </button>

      {state && 'error' in state ? (
        <p className="auth-error" data-testid="grifo-error">
          {state.error}
        </p>
      ) : null}
      {state && 'ok' in state ? (
        <p className="ops-ok" data-testid="grifo-ok">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
