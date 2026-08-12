import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/db/client';
import { isResetTokenUsable } from '@/lib/auth/password-reset';
import { ENLACE_NO_VALIDO } from '@/lib/auth/reset-messages';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Nueva contraseña · Stockeiro',
  description: 'Establece una contraseña nueva desde tu enlace de recuperación.',
  robots: { index: false, follow: false },
};

/**
 * SPEC-023 — Página de contraseña nueva. Ruta PÚBLICA por diseño (CA-15) y con
 * `Referrer-Policy: no-referrer` (ADR-015 pto. 9, declarada en `next.config.mjs`);
 * no carga recursos de terceros, así que la política no cuesta nada.
 *
 * CA-10: este GET solo MIRA si el enlace parece vivo — no lo consume. Los antivirus
 * de correo y los generadores de vista previa visitan los enlaces antes que el
 * destinatario; si abrir gastara, el escáner del propio proveedor de correo dejaría
 * al usuario fuera con un mecanismo que funciona.
 */
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const usable = await isResetTokenUsable(db, token);

  if (!usable) {
    return (
      <main className="auth-wrap">
        <h1 className="headline">Enlace no válido</h1>
        <div className="card auth-form auth-done" role="status">
          {/* CA-9: usado, caducado e inexistente comparten mensaje. */}
          <p className="auth-note">{ENLACE_NO_VALIDO}</p>
          <Link className="btn primary" href="/forgot-password">
            Pedir un enlace nuevo
          </Link>
        </div>
        <p className="lede">
          ¿Ya la recuerdas? <Link href="/login">Entra</Link>.
        </p>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <h1 className="headline">Crea tu contraseña nueva</h1>
      <p className="auth-sub">
        Al guardarla se cerrarán las sesiones que tengas abiertas en otros dispositivos.
      </p>

      <ResetPasswordForm token={token} />

      <p className="lede">
        ¿Prefieres no cambiarla? <Link href="/login">Vuelve a entrar</Link>.
      </p>
    </main>
  );
}
