import Link from 'next/link';
import type { Metadata } from 'next';
import { REENVIAR_TITULO } from '@/lib/registration/signup-messages';
import { ResendForm } from './resend-form';

export const metadata: Metadata = {
  title: 'Pedir otro correo de activación · Stockeiro',
  description: 'Pide otro enlace para activar tu cuenta de Stockeiro.',
};

/**
 * SPEC-066 CA-16 — pedir otro correo de activación. Pública (cuelga de `/register`, D-2)
 * y `noindex` por el layout raíz. El POST está protegido por BotID (ADR-042 pto. 16).
 */
export default function ResendActivationPage() {
  return (
    <main className="auth-wrap">
      <h1 className="headline">{REENVIAR_TITULO}</h1>
      <p className="auth-sub">
        Escribe el correo con el que te diste de alta. Si la cuenta aún no está activada y sigue
        en plazo, te enviaremos un enlace nuevo.
      </p>
      <ResendForm />
      <p className="lede">
        ¿Ya la activaste? <Link href="/login">Entra</Link>.
      </p>
    </main>
  );
}
