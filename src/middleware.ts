import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth/base-config';
import { isPublicPath, requireSession } from '@/lib/auth/guard';

// Instancia edge-safe (sin bcrypt/DB): solo lee la sesión JWT de la cookie.
const { auth } = NextAuth(authConfig);

/**
 * Protección de rutas (CA-5, RN-03). Reutiliza la MISMA lógica de guard cubierta
 * por tests unitarios, de modo que el comportamiento probado es el que corre en
 * producción.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const session = req.auth?.user?.id ? { userId: req.auth.user.id } : null;
  const result = requireSession(session);
  if (!result.ok) {
    return NextResponse.redirect(new URL(result.redirectTo, req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  // Todo salvo estáticos y las rutas internas de auth.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
