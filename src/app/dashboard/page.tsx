import { auth } from '@/lib/auth/config';
import { logoutAction } from '../(auth)/actions';

// Ruta protegida (CA-5): el middleware exige sesión antes de llegar aquí.
export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="auth-wrap">
      <h1 className="headline">Tu panel</h1>
      <p className="lede">
        Sesión iniciada como <strong>{session?.user?.email ?? 'usuario'}</strong>.
      </p>
      <p className="lede">
        Aquí vivirán tu cartera y tus acciones vigiladas (próximas specs de EPIC-001).
      </p>
      <form action={logoutAction}>
        <button className="btn" type="submit">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
