import { redirect } from 'next/navigation';
import { auth } from './config';
import { requireSession, LOGIN_PATH } from './guard';
import { canSee, isRole, type Role, type Section } from './sections';

/** Usuario resuelto en la frontera de sesión: identidad + rol vigente AHORA. */
export interface SessionUser {
  id: string;
  email: string | null;
  /** Rol leído de la base en ESTA petición (ADR-021 pto. 3-4), no del token. */
  role: Role;
}

/**
 * A dónde rebota quien pide una sección que su rol no abre, y cómo se le dice
 * (SPEC-034 CA-8). El panel es el sitio: no es un error, no es un 404 —la sección
 * existe, es la misma app— y una redirección muda sería peor que las dos.
 *
 * La nota viaja en la URL y no en la sesión a propósito: así aparece SOLO tras el
 * rebote y no en cada visita al panel.
 */
export const BOUNCE_PARAM = 'sin-acceso';
export const BOUNCE_PATH = '/dashboard';

export function bounceTo(section: Section): string {
  return `${BOUNCE_PATH}?${BOUNCE_PARAM}=${encodeURIComponent(section)}`;
}

/**
 * Frontera de sesión de las PÁGINAS protegidas (SPEC-023 CA-13, ADR-016 pto. 4).
 *
 * `auth()` ya revalida la época de credencial contra la base, así que una sesión
 * previa a un cambio de contraseña llega aquí SIN usuario. Esta función traduce eso
 * a lo que CA-13 exige: mandar a login. Antes, una cookie revocada llegaba a la
 * página y esta o reventaba (`session!.user.id`) o pintaba el panel sin datos —
 * ninguna de las dos cosas es "la manda a login".
 *
 * De la misma resolución sale el ROL (SPEC-034, ADR-021 pto. 3), así que quien llame
 * a esto ya sabe qué secciones enseñar sin pagar otra consulta.
 *
 * La DECISIÓN sigue siendo la de `requireSession` (probada en tests/guard.test.ts);
 * aquí solo se le da el efecto de Next. El middleware Edge no cambia (ADR-001).
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const result = requireSession(session?.user?.id ? { userId: session.user.id } : null);
  if (!result.ok) redirect(result.redirectTo);
  const role = session?.user?.role;
  // Sin rol válido no hay sesión utilizable: se falla cerrado y se manda a login,
  // igual que con una época que no cuadra. La frontera de Node siempre lo pone.
  if (!isRole(role)) redirect(LOGIN_PATH);
  return { id: result.userId, email: session?.user?.email ?? null, role };
}

/**
 * Frontera de SECCIÓN (SPEC-034 CA-6, ADR-021 pto. 6-7). Lo que usan las páginas y
 * las server actions de una sección restringida.
 *
 * Quitar el enlace del menú no cierra la puerta: la URL se puede teclear y la server
 * action acepta `POST` mientras exista. Por eso la decisión se aplica AQUÍ, en la
 * frontera de Node por la que pasa todo acceso a datos, y no en el middleware Edge
 * —que no puede leer el rol sin romper el split-config de ADR-001—.
 */
export async function requireSectionUser(section: Section): Promise<SessionUser> {
  const user = await requireUser();
  if (!canSee(user.role, section)) redirect(bounceTo(section));
  return user;
}

/**
 * Variante para SERVER ACTIONS: no redirige, devuelve `null`. Una acción no pinta
 * pantalla; lo que tiene que hacer es no producir ningún efecto (CA-7) y terminar sin
 * datos. Quien la llama traduce ese `null` al error que su formulario sepa enseñar.
 */
export async function sectionUserOrNull(section: Section): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  const role = session?.user?.role;
  if (!id || !isRole(role)) return null;
  if (!canSee(role, section)) return null;
  return { id, email: session?.user?.email ?? null, role };
}
