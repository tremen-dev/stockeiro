import Link from 'next/link';
import { CONTRASENA_ACTUALIZADA } from '@/lib/auth/reset-messages';
import { CUENTA_ACTIVADA } from '@/lib/registration/signup-messages';
import { LoginForm } from './login-form';

/**
 * SPEC-023 CA-14: tras un reset con éxito el usuario aterriza AQUÍ con su
 * confirmación, y NO autenticado. No hay auto-login a propósito: una ruta pública no
 * debería poder emitir sesiones, y entrar con la contraseña recién elegida es lo que
 * la gente espera.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; activada?: string }>;
}) {
  const { reset, activada } = await searchParams;

  return (
    <main className="auth-wrap">
      <h1 className="headline">Entrar</h1>

      {reset === '1' ? (
        <p className="auth-note auth-note-ok" role="status">
          {CONTRASENA_ACTUALIZADA}
        </p>
      ) : null}

      {/* SPEC-066 CA-13: activar NO inicia sesión; aquí se entra con la contraseña. */}
      {activada === '1' ? (
        <p className="auth-note auth-note-ok" role="status" data-testid="cuenta-activada">
          {CUENTA_ACTIVADA}
        </p>
      ) : null}

      <LoginForm />

      <p className="lede">
        <Link href="/forgot-password">¿Has olvidado tu contraseña?</Link>
      </p>
      <p className="lede">
        ¿No tienes cuenta? <Link href="/register">Crea una</Link>.
      </p>
    </main>
  );
}
