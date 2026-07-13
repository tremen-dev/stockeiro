import Link from 'next/link';
import { RegisterForm } from './register-form';

export default function RegisterPage() {
  return (
    <main className="auth-wrap">
      <h1 className="headline">Crear cuenta</h1>
      <RegisterForm />
      <p className="lede">
        ¿Ya tienes cuenta? <Link href="/login">Entra</Link>.
      </p>
    </main>
  );
}
