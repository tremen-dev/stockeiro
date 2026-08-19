import type { PgDatabase } from 'drizzle-orm/pg-core';
import { isRole, type Role } from './sections';
import { readSessionRow } from './session-row';
import { isSessionEpochCurrent } from './session-epoch';

/** Acepta tanto el cliente Neon (producción) como PGlite (tests). */
type Db = PgDatabase<any, any, any>;

/** Lo que la frontera necesita del JWT; deliberadamente mínimo (no es el tipo de Auth.js). */
export interface SessionTokenClaims {
  id?: string;
  /** Época de credencial estampada en el login (ADR-016 pto. 2). */
  credentialEpoch?: unknown;
  // OJO: aquí NO hay rol, y no es un olvido (ADR-021 pto. 2, SPEC-034 CA-11). El rol
  // se lee de la base en cada petición; un rol estampado sería rancio por diseño.
}

/** Forma mínima de una sesión de Auth.js, para poder probar esto sin levantarlo. */
export interface SessionShape {
  user?: { id?: string; email?: string | null; role?: Role } | undefined;
}

/**
 * FRONTERA DE SESIÓN DE NODE (ADR-016 pto. 3-4, ADR-021 pto. 3). Resuelve la sesión
 * revalidando la época de credencial contra la base: si el token trae otra —o no la
 * trae—, la sesión se devuelve SIN usuario, y el guard ya existente (`requireSession`)
 * la manda a login.
 *
 * De la MISMA lectura sale el ROL de cuenta (SPEC-034), que se propaga a
 * `session.user.role`. No cuesta ninguna consulta adicional —la fila ya se leía— y a
 * cambio degradar o promover a alguien surte efecto en su petición siguiente, con la
 * misma cookie, sin pedirle que cierre sesión (ADR-021 pto. 4).
 *
 * Vive aquí y no en el middleware a propósito: el middleware corre en Edge y debe
 * seguir sin DB ni bcrypt (ADR-001, split-config). El matiz que eso deja —una cookie
 * revocada, o la de un `tester`, puede atravesar el middleware— es aceptable porque
 * TODO acceso a datos (server components y server actions) pasa por esta frontera: no
 * se sirve ni un dato; solo se paga un redirect un salto más tarde (F-SPEC-034-3).
 *
 * Coste declarado (ADR-016, consecuencias): una lectura por clave primaria en cada
 * petición autenticada. Sigue siendo UNA (CA-12).
 */
export async function resolveSessionWithEpoch<S extends SessionShape>(
  db: Db,
  session: S,
  token: SessionTokenClaims,
): Promise<S> {
  // Sin usuario: `requireSession` la manda a login. El cast es necesario porque el
  // tipo `Session` de Auth.js declara `user` obligatorio; en runtime, ausente = anónima.
  const anonima = { ...session, user: undefined } as S;
  if (!token.id) return anonima;

  const row = await readSessionRow(db, token.id);
  if (!isSessionEpochCurrent(token.credentialEpoch, row?.epoch)) return anonima;

  // Un rol que no es del dominio no existe: la base lo impide con un CHECK, así que
  // llegar aquí significa que alguien lo esquivó. Se falla cerrado, no se supone.
  if (!isRole(row?.role)) return anonima;

  return { ...session, user: { ...session.user, id: token.id, role: row.role } } as S;
}
