import Link from 'next/link';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="auth-wrap">
      <h1 className="headline">Entrar</h1>
      <LoginForm />
      <p className="lede">
        ¿No tienes cuenta? <Link href="/register">Crea una</Link>.
      </p>
    </main>
  );
}
