import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/db/client';
import { verifyCredentials } from './users';
import { credentialsSchema } from './validation';
import { authConfig } from './base-config';
import { resolveSessionWithEpoch } from './session-boundary';
import { toEpochClaim } from './session-epoch';

/**
 * Config COMPLETA de Auth.js (Node runtime): añade el provider Credentials, que
 * usa bcrypt + Postgres. Se usa en el route handler y en los server actions.
 * El middleware NO importa este módulo (usa `base-config.ts`, edge-safe).
 *
 * `verifyCredentials` devuelve el MISMO error genérico ante email inexistente o
 * clave incorrecta (CA-4). La política de contraseña se delega en Auth.js.
 *
 * SPEC-023 / ADR-016: aquí —y solo aquí, porque es Node— se revalida la ÉPOCA DE
 * CREDENCIAL contra la base. Es la frontera por la que pasa todo acceso a datos, así
 * que una sesión previa al cambio de contraseña no sirve ni un dato (CA-13).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        try {
          const user = await verifyCredentials(db, parsed.data.email, parsed.data.password);
          // La época viaja al JWT desde aquí (ADR-016 pto. 2); `base-config` la estampa.
          return {
            id: user.id,
            email: user.email,
            credentialEpoch: toEpochClaim(user.passwordChangedAt),
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Sustituye (no envuelve) a la callback edge-safe de `base-config`: además de
    // copiar el id del token, revalida la época contra la base (ADR-016 pto. 3).
    async session({ session, token }) {
      return resolveSessionWithEpoch(db, session, {
        id: token.id,
        credentialEpoch: token.credentialEpoch,
      });
    },
  },
});
