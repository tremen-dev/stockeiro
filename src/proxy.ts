import NextAuth from 'next-auth';
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
  type NextMiddleware,
} from 'next/server';
import { authConfig } from '@/lib/auth/base-config';
import { isPublicPath, requireSession } from '@/lib/auth/guard';

// Instancia edge-safe (sin bcrypt/DB): solo lee la sesión JWT de la cookie.
const { auth } = NextAuth(authConfig);

/**
 * Protección de rutas (CA-5, RN-03). Reutiliza la MISMA lógica de guard cubierta
 * por tests unitarios, de modo que el comportamiento probado es el que corre en
 * producción.
 */
const conSesion = auth((req) => {
  const session = req.auth?.user?.id ? { userId: req.auth.user.id } : null;
  const result = requireSession(session);
  if (!result.ok) {
    return NextResponse.redirect(new URL(result.redirectTo, req.nextUrl.origin));
  }
  return NextResponse.next();
});

/**
 * SPEC-035 CA-13 — una ruta pública se resuelve ANTES de entrar en Auth.js.
 *
 * Antes, `auth()` envolvía la petición entera y decidía dentro. Funcionaba, pero
 * tenía un efecto colateral que solo se ve mirando las cookies: Auth.js estampaba
 * `authjs.csrf-token` y `authjs.callback-url` en **cualquier** ruta del matcher,
 * incluidas las que no tienen ni formulario ni sesión. Es decir, leer el aviso legal
 * dejaba dos cookies en el navegador de quien solo quería saber quién opera esto —
 * justo lo que `/legal/privacidad` promete que no pasa.
 *
 * Ahora la ruta pública sale por arriba y no se llega a instanciar el flujo de
 * sesión. El inicio de sesión no se resiente: `signIn` corre en una server action
 * (runtime Node), no en este middleware.
 *
 * Lo que NO cambia es el `matcher` (CA-2): `/legal` sigue entrando en él, y quien
 * decide es el guard. Sacarla del matcher la sacaría del middleware entero, que es
 * otra cosa y peor.
 */
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  // `auth()` declara la firma de un route handler (`req, { params }`), no la de un
  // middleware; en runtime es lo mismo y Next lo invoca así desde que existe este
  // fichero. El cast dice eso y nada más.
  return (conSesion as unknown as NextMiddleware)(request, event);
}

/**
 * SPEC-047 CA-6, CA-7 y CA-8 — `icon.svg` se suma a la lista de estáticos excluidos.
 *
 * El navegador pide el icono SIN sesión, y hasta ahora `icon.svg` caía dentro de este
 * matcher: la petición entraba en Auth.js, salía redirigida a `/login` y, de paso,
 * estampaba `authjs.csrf-token` y `authjs.callback-url`. Es decir, el icono fallaba
 * justo en las páginas públicas que ve primero un desconocido (`/`, `/login`, `/legal`,
 * `/ayuda`) y ponía RED lo que SPEC-035 CA-13 arregló.
 *
 * Va aquí y no en `PUBLIC_PREFIXES`, que es lo que primero apetece. Esa lista es la
 * excepción DOCUMENTADA a RN-03 y es de **páginas**: engordarla con estáticos la
 * desdibuja. Lo que hay en esta línea es otra cosa —`_next/static`, `_next/image`,
 * `favicon.ico`—: activos idénticos para todo el mundo, sin un byte de dato de usuario.
 * `icon.svg` es exactamente eso, y `favicon.ico` ya estaba aquí por la misma razón.
 *
 * Lo que NO se toca es el resto de la línea. Sus alternativas no están ancladas ni
 * escapadas (`favicon.ico` empareja el punto como comodín); está visto y anotado, y
 * arreglarlo es otra spec — no algo que se cuele en el guardián de sesión de paso.
 */
export const config = {
  // Todo salvo estáticos y las rutas internas de auth.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
