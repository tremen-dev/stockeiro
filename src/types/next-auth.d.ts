import 'next-auth';
import 'next-auth/jwt';
import type { Role } from '@/lib/auth/sections';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      /**
       * Rol de cuenta (SPEC-034, ADR-021). Lo pone la frontera de sesión de NODE
       * leyéndolo de la base en cada petición, no el token: por eso está aquí y
       * NO en la interfaz `JWT` de abajo.
       */
      role?: Role;
    };
  }

  interface User {
    /** Época de credencial del usuario al autenticarse (ADR-016 pto. 2), en ms. */
    credentialEpoch?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    /** Copia estampada en el login; se compara contra la base en Node (ADR-016 pto. 3). */
    credentialEpoch?: number;
  }
}
