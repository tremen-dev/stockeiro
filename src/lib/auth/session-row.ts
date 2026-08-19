import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { users } from '@/db/schema';
import type { Role } from './sections';

/** Acepta tanto el cliente Neon (producción) como PGlite (tests). */
type Db = PgDatabase<any, any, any>;

/**
 * Lo que la frontera de sesión necesita de la fila del usuario: la época de
 * credencial (ADR-016) y el rol de cuenta (ADR-021).
 */
export interface SessionRow {
  /** `passwordChangedAt`: la época contra la que se compara el claim del token. */
  epoch: Date;
  /** Rol de cuenta. Decide qué SECCIONES se enseñan, nunca de quién son los datos. */
  role: Role;
}

/**
 * LA lectura por petición autenticada (ADR-021 pto. 3). Generaliza el
 * `getCredentialEpoch` que introdujo ADR-016: es el mismo `SELECT` por clave
 * primaria sobre `users`, con una columna más.
 *
 * El número de consultas por petición NO cambia, y ese es justo el argumento que
 * tumbó la alternativa de meter el rol en el JWT: la fila ya se estaba leyendo, así
 * que el claim no habría ahorrado ni una ida a la base y a cambio habría dejado a
 * un usuario degradado con la sección abierta hasta que le expirase el token.
 *
 * Que las dos columnas salgan de la MISMA consulta no es una optimización que se
 * pueda deshacer sin querer: es CA-12, y hay un doble de la base que las cuenta.
 */
export async function readSessionRow(db: Db, userId: string): Promise<SessionRow | null> {
  const [row] = await db
    .select({ epoch: users.passwordChangedAt, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}
