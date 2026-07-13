import type { NextAuthConfig } from 'next-auth';

/**
 * Config base de Auth.js, EDGE-SAFE: sin acceso a base de datos ni bcrypt, para
 * poder usarse desde el middleware (que corre en Edge Runtime, ADR-001). El
 * provider Credentials (Node: bcrypt + Postgres) se añade aparte en `config.ts`.
 * El middleware solo necesita leer/decodificar la sesión JWT, no verificarla
 * contra la DB, así que aquí basta con las callbacks jwt/session.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
