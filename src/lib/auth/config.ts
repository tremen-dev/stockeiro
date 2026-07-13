import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/db/client';
import { verifyCredentials } from './users';
import { credentialsSchema } from './validation';
import { authConfig } from './base-config';

/**
 * Config COMPLETA de Auth.js (Node runtime): añade el provider Credentials, que
 * usa bcrypt + Postgres. Se usa en el route handler y en los server actions.
 * El middleware NO importa este módulo (usa `base-config.ts`, edge-safe).
 *
 * `verifyCredentials` devuelve el MISMO error genérico ante email inexistente o
 * clave incorrecta (CA-4). La política de contraseña se delega en Auth.js.
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
          return { id: user.id, email: user.email };
        } catch {
          return null;
        }
      },
    }),
  ],
});
