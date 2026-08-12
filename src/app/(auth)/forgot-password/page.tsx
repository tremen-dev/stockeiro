import Link from 'next/link';
import type { Metadata } from 'next';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Recuperar contraseña · Stockeiro',
  description: 'Recibe un enlace por email para crear una contraseña nueva.',
};

/**
 * SPEC-023 — Solicitud de recuperación. Ruta PÚBLICA por diseño (CA-15): quien ha
 * perdido el acceso no puede tener sesión.
 *
 * La pantalla no promete que exista la cuenta ni antes ni después de enviar (CE-2):
 * el acuse está redactado en condicional y es el mismo en todos los casos.
 */
export default function ForgotPasswordPage() {
  return (
    <main className="auth-wrap">
      <h1 className="headline">¿Has olvidado tu contraseña?</h1>
      <p className="auth-sub">
        Escribe el email de tu cuenta y te enviamos un enlace para crear una contraseña nueva.
      </p>

      <ForgotPasswordForm />

      <p className="lede">
        ¿Te has acordado? <Link href="/login">Vuelve a entrar</Link>.
      </p>
    </main>
  );
}
