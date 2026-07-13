/**
 * Guardia de acceso (RN-03, CA-5, CA-7). Lógica pura y testable que decide si
 * una petición a una ruta protegida puede continuar o debe redirigir a login.
 * El middleware de Next.js (y cualquier server action) delega en esta función,
 * de modo que el comportamiento probado es el mismo que corre en runtime.
 */
export type SessionLike = { userId: string } | null | undefined;

export type GuardResult =
  | { ok: true; userId: string }
  | { ok: false; redirectTo: string };

export const LOGIN_PATH = '/login';

/** Rutas públicas: accesibles sin sesión (RN-03 excepciona registro y login). */
const PUBLIC_PREFIXES = ['/login', '/register'];

export function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * CA-5: sin sesión en ruta no pública -> redirige a login.
 * CA-7: tras cerrar sesión, la sesión efectiva es null -> vuelve a exigir login.
 */
export function requireSession(session: SessionLike): GuardResult {
  if (!session || !session.userId) {
    return { ok: false, redirectTo: LOGIN_PATH };
  }
  return { ok: true, userId: session.userId };
}
