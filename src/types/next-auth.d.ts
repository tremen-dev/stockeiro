import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
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
