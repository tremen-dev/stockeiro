import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cuenta borrada · Stockeiro',
  description: 'Tu cuenta y todos tus datos se han borrado de Stockeiro.',
};

/**
 * SPEC-036 CA-10 — donde aterriza quien acaba de borrar su cuenta.
 *
 * Es PÚBLICA y no puede no serlo: su usuario ya no existe, así que una página
 * autenticada le rebotaría a `/login` y se quedaría sin saber si el borrado salió.
 * La excepción a RN-03 se declara en `PUBLIC_PREFIXES` (`src/lib/auth/guard.ts`),
 * donde se declaran todas, y `tests/cuenta-rutas.test.ts` la ata.
 *
 * No importa nada de `src/db` ni de la sesión, por la misma razón que las páginas de
 * `/legal` (SPEC-035 CA-14): tiene que poder pintarse aunque la base esté caída — y
 * el momento en que alguien la lee es justo aquel en el que su fila ya no está.
 *
 * Dice tres cosas y solo tres: que se ha borrado, qué queda fuera del alcance, y que
 * el email vuelve a estar libre. Ni una encuesta de salida, ni un «¿seguro?» tardío.
 */
export default function CuentaBorradaPage() {
  return (
    <main className="auth-wrap" data-testid="cuenta-borrada">
      <h1 className="headline">Tu cuenta se ha borrado</h1>

      <p className="auth-note auth-note-ok" role="status">
        Tu cuenta y todos tus datos se han borrado de Stockeiro: tus operaciones, tus acciones
        vigiladas con sus zonas, tus avisos y las equivalencias de tus importaciones. No queda
        ninguna fila tuya, y no hay copia.
      </p>

      <p className="auth-sub">
        Lo que sigue ahí son los valores y sus cotizaciones, que son datos de mercado
        compartidos por todos los usuarios y no eran tuyos. Y los correos que ya te enviamos
        siguen en tu buzón: eso queda fuera del alcance de esta app.
      </p>

      <p className="auth-sub">
        Tu dirección de correo vuelve a estar libre. Si algún día quieres volver, puedes
        registrarte otra vez con ella, aunque la cuenta nueva empezará vacía.
      </p>

      <p className="lede">
        <Link href="/register">Crear una cuenta nueva</Link>
      </p>
      <p className="lede">
        ¿Te has borrado por error y no era tu cuenta? <Link href="/login">Entrar</Link>.
      </p>
    </main>
  );
}
