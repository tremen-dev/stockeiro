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

/**
 * Rutas públicas: accesibles sin sesión. ÚNICO sitio donde se declara la excepción
 * a RN-03 — que se prueba (CA-15), no se hereda.
 *
 * `/forgot-password` y `/reset-password/<token>` (SPEC-023, CE-5) son públicas por
 * diseño: quien ha perdido el acceso no puede tener sesión. El resto de rutas de
 * datos sigue exigiéndola, y el emparejamiento es por segmento completo, así que
 * una ruta que solo SE PAREZCA (p. ej. `/reset-passwordX`) no entra.
 *
 * `/legal` y sus subrutas (SPEC-035, CE-4) son públicas por la misma clase de razón:
 * quien llega de un foro tiene que poder leer quién opera esto y qué se hace con sus
 * datos **antes** de teclear su email. Se declaran aquí y no en el `matcher` de
 * `src/proxy.ts`, que no cambia: sacarlas del matcher las sacaría del middleware
 * entero, que es otra cosa y peor.
 */
export const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/legal',
];

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
