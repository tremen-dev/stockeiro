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
 *
 * `/ayuda` (SPEC-039, CE-1) es la tercera de la misma familia y la que más lo pide:
 * quien llega de un hilo de un foro tiene que poder leer **qué hace esto y con qué
 * cadencia** ANTES de teclear su correo. Una ayuda que exige cuenta para explicar si
 * merece la pena tener cuenta no ayuda a nadie — y la cadencia (una vez al día tras
 * el cierre, D-2) es justo el malentendido que puede gastar la publicación (R-4).
 *
 * `/cuenta-borrada` (SPEC-036 CA-10) es la más forzosa de todas: quien acaba de
 * borrar su cuenta **ya no tiene usuario**, así que una página autenticada no podría
 * enseñarle la confirmación de que se ha ido — le daría un rebote a `/login`. Ojo con
 * la pareja: `/cuenta`, que SÍ es de datos, no entra aquí y no la abre este prefijo,
 * porque el emparejamiento es por segmento completo.
 */
export const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/legal',
  '/cuenta-borrada',
  '/ayuda',
];

export function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Rutas de rastreador (SPEC-065 D-5): `robots.txt` y `sitemap.xml`. Segunda lista de
 * excepciones a RN-03, con una semántica distinta a la de arriba, y por eso separada:
 *
 * - **No son páginas.** `PUBLIC_PREFIXES` es la lista de páginas exentas de sesión; meter
 *   aquí dos ficheros de texto la desdibujaría, igual que habría hecho con los estáticos.
 * - **Emparejan EXACTO, no por prefijo.** Por prefijo, `/sitemap.xml/lo-que-sea` quedaría
 *   abierto; aquí sólo abre la ruta tal cual.
 *
 * Quien las pide es un rastreador, sin cookies: dentro del `matcher` de `src/proxy.ts` y
 * sin esta excepción saldrían redirigidas a `/login` —el mismo fallo silencioso que mordió
 * al icono (SPEC-047) y a la tarjeta social (SPEC-051)— y estamparían `authjs.*`. Ninguna
 * devuelve un dato de usuario. El matcher no se toca (`F-SPEC-051-1`).
 */
export const CRAWLER_PATHS: readonly string[] = ['/robots.txt', '/sitemap.xml'];

export function isCrawlerPath(pathname: string): boolean {
  return CRAWLER_PATHS.includes(pathname);
}

/**
 * Rutas de BotID (SPEC-066 CA-6, ADR-042 pto. 19): el reto que carga el cliente de BotID
 * y el proxy hacia Vercel. Tercera familia de excepciones a RN-03, separada por lo mismo
 * que la de rastreador: **no son páginas** y no llevan dato de usuario. Quien las pide es
 * quien se está dando de alta, SIN sesión: dentro del `matcher` de `src/proxy.ts` y sin
 * esta excepción, el reto rebotaría a `/login` y el alta no se enviaría nunca.
 *
 * El prefijo es el que `withBotId` (`botid/next/config`) reescribe. NO se copia a ciegas:
 * `tests/spec066-proxy-botid.test.ts` lo DERIVA de `withBotId(...).rewrites()` en cada
 * ejecución y exige que toda ruta reescrita salga por aquí (ADR-040). Si la librería lo
 * cambia al actualizarse, esa guardia se pone roja.
 *
 * Empareja por SEGMENTO: el prefijo exacto o el prefijo seguido de `/`. Una ruta que sólo
 * se le parezca (sin el separador, con un carácter de más) sigue exigiendo sesión.
 */
export const BOTID_PATH_PREFIX =
  '/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3';

export function isBotIdPath(pathname: string): boolean {
  return pathname === BOTID_PATH_PREFIX || pathname.startsWith(`${BOTID_PATH_PREFIX}/`);
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
