import type { NextAuthConfig } from 'next-auth';

/**
 * Config base de Auth.js, EDGE-SAFE: sin acceso a base de datos ni bcrypt, para
 * poder usarse desde el middleware (que corre en Edge Runtime, ADR-001). El
 * provider Credentials (Node: bcrypt + Postgres) se añade aparte en `config.ts`.
 * El middleware solo necesita leer/decodificar la sesión JWT, no verificarla
 * contra la DB, así que aquí basta con las callbacks jwt/session.
 *
 * ADR-016 pto. 2: la ÉPOCA DE CREDENCIAL se estampa aquí, en el login, con el valor
 * que trae `user` (lo pone `authorize`, en Node). Estampar no es consultar: este
 * módulo sigue sin DB y sin bcrypt. La REVALIDACIÓN vive en `config.ts` (Node).
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // Solo al hacer login (`user` presente). En las rotaciones del token el claim
      // se copia hacia adelante tal cual y NUNCA se recalcula (ADR-016 pto. 5): si se
      // releyera de la base, el token del intruso se "curaría" solo.
      if (user) {
        token.id = user.id;
        token.credentialEpoch = user.credentialEpoch;
      }
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
