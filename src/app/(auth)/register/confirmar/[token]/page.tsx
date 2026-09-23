import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/db/client';
import { isActivationTokenUsable } from '@/lib/registration/signup';
import { RESEND_ACTIVATION_PATH } from '@/lib/registration/activation-rules';
import {
  ACTIVAR_EXPLICACION,
  ACTIVAR_TITULO,
  ENLACE_ACTIVACION_NO_VALIDO,
} from '@/lib/registration/signup-messages';
import { ActivateForm } from './activate-form';

export const metadata: Metadata = {
  title: 'Activa tu cuenta · Stockeiro',
  description: 'Activa tu cuenta de Stockeiro desde el enlace del correo de activación.',
  robots: { index: false, follow: false },
};

/** El enlace se mira en cada petición: nada de prerender con un token dentro. */
export const dynamic = 'force-dynamic';

/**
 * SPEC-066 CA-13 — la página del enlace de activación. Ruta PÚBLICA (cuelga de
 * `/register`, D-2), con `Referrer-Policy: no-referrer` (declarada en `next.config.mjs`,
 * como la de recuperación, ADR-015 pto. 9) y `noindex`.
 *
 * El GET sólo MIRA si el enlace parece vivo: no activa (ADR-042 pto. 8). Los escáneres de
 * correo pinchan los enlaces; si abrir activara, activarían cuentas de bots con correos
 * ajenos cuyo proveedor los pincha. Activa el botón, que es un POST.
 */
export default async function ConfirmActivationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const usable = await isActivationTokenUsable(db, token);

  if (!usable) {
    return (
      <main className="auth-wrap">
        <h1 className="headline">Enlace no válido</h1>
        <div className="card auth-form auth-done" role="status" data-testid="activacion-no-valida">
          {/* CA-11: usado, caducado, inexistente y manipulado comparten mensaje. */}
          <p className="auth-note">{ENLACE_ACTIVACION_NO_VALIDO}</p>
          <Link className="btn primary" href={RESEND_ACTIVATION_PATH}>
            Pedir otro enlace
          </Link>
        </div>
        <p className="lede">
          ¿Ya la activaste? <Link href="/login">Entra</Link>.
        </p>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <h1 className="headline">{ACTIVAR_TITULO}</h1>
      <p className="auth-sub">{ACTIVAR_EXPLICACION}</p>
      <ActivateForm token={token} />
    </main>
  );
}
