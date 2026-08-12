import { redirect } from 'next/navigation';
import { auth } from './config';
import { requireSession } from './guard';

/**
 * Frontera de sesión de las PÁGINAS protegidas (SPEC-023 CA-13, ADR-016 pto. 4).
 *
 * `auth()` ya revalida la época de credencial contra la base, así que una sesión
 * previa a un cambio de contraseña llega aquí SIN usuario. Esta función traduce eso
 * a lo que CA-13 exige: mandar a login. Antes, una cookie revocada llegaba a la
 * página y esta o reventaba (`session!.user.id`) o pintaba el panel sin datos —
 * ninguna de las dos cosas es "la manda a login".
 *
 * La DECISIÓN sigue siendo la de `requireSession` (probada en tests/guard.test.ts);
 * aquí solo se le da el efecto de Next. El middleware Edge no cambia (ADR-001).
 */
export async function requireUser(): Promise<{ id: string; email: string | null }> {
  const session = await auth();
  const result = requireSession(session?.user?.id ? { userId: session.user.id } : null);
  if (!result.ok) redirect(result.redirectTo);
  return { id: result.userId, email: session?.user?.email ?? null };
}
