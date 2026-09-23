'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { registerAction, type RegisterState } from '../actions';
import {
  HONEYPOT_FIELD,
  RENDER_SEAL_FIELD,
  RESEND_ACTIVATION_PATH,
} from '@/lib/registration/activation-rules';
import { ALTA_ENVIADA, ALTA_ENVIADA_TITULO } from '@/lib/registration/signup-messages';

/**
 * El formulario del alta (SPEC-001, defendido por SPEC-066).
 *
 * - `sello` es el instante de pintado FIRMADO por el servidor (ADR-042 pto. 15): lo trae
 *   la página y vuelve con el envío; el tiempo mínimo se mide con el reloj del servidor.
 * - El CAMPO TRAMPA (pto. 14) va dentro de un bloque `hidden` y `aria-hidden`: no se ve,
 *   no se alcanza con el tabulador, no lo lee un lector de pantalla y el navegador no lo
 *   autocompleta. Un humano lo deja vacío sin saber que existe.
 * - Tras enviar, la respuesta es SIEMPRE la neutra (pto. 6): ni «ese email ya existe», ni
 *   nada que distinga un alta nueva de una repetida o de un envío tomado por un bot.
 */
export function RegisterForm({ sello }: { sello: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerAction,
    undefined,
  );

  if (state && 'sent' in state) {
    return (
      <div className="card auth-form auth-done" role="status" data-testid="alta-enviada">
        <h2 className="auth-done-titulo">{ALTA_ENVIADA_TITULO}</h2>
        {ALTA_ENVIADA.map((parrafo) => (
          <p key={parrafo} className="auth-note">
            {parrafo}
          </p>
        ))}
        <Link className="btn" href={RESEND_ACTIVATION_PATH}>
          Pedir otro enlace
        </Link>
      </div>
    );
  }

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
      <input type="hidden" name={RENDER_SEAL_FIELD} value={sello} />
      <div hidden aria-hidden="true" data-testid="campo-trampa">
        <label>
          Deja este campo vacío
          <input name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {state?.error ? <p className="auth-error">{state.error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
