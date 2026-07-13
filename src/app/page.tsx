import { redirect } from 'next/navigation';

// La raíz lleva al panel. Si no hay sesión, el middleware redirige a /login (CA-5).
export default function Home() {
  redirect('/dashboard');
}
