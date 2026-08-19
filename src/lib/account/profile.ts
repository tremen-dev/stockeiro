import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { users } from '@/db/schema';
import type { Role } from '@/lib/auth/sections';

/** Acepta tanto el cliente Neon (producción) como PGlite/postgres-js (tests y e2e). */
type Db = PgDatabase<any, any, any>;

/**
 * Lo que `/cuenta` enseña de una persona: exactamente lo que la app sabe de ella y
 * nada más — correo, rol y fecha de alta. Es la misma lista que `/legal/privacidad`
 * declara bajo la categoría `users`, y esa coincidencia no es casual: si la pantalla
 * enseñara algo que la política no menciona, una de las dos estaría mintiendo.
 *
 * El correo se lee de la BASE y no de la sesión a propósito: es lo que se va a
 * borrar, y enseñar una copia del token es enseñar lo que había cuando se hizo login.
 */
export interface AccountProfile {
  email: string;
  role: Role;
  createdAt: Date;
}

export async function readAccountProfile(db: Db, userId: string): Promise<AccountProfile | null> {
  const [row] = await db
    .select({ email: users.email, role: users.role, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}
