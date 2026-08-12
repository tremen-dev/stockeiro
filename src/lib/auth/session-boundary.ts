import type { PgDatabase } from 'drizzle-orm/pg-core';
import { getCredentialEpoch } from './password-reset';
import { isSessionEpochCurrent } from './session-epoch';

/** Acepta tanto el cliente Neon (producción) como PGlite (tests). */
type Db = PgDatabase<any, any, any>;

/** Lo que la frontera necesita del JWT; deliberadamente mínimo (no es el tipo de Auth.js). */
export interface SessionTokenClaims {
  id?: string;
  /** Época de credencial estampada en el login (ADR-016 pto. 2). */
  credentialEpoch?: unknown;
}

/** Forma mínima de una sesión de Auth.js, para poder probar esto sin levantarlo. */
export interface SessionShape {
  user?: { id?: string; email?: string | null } | undefined;
}

/**
 * FRONTERA DE SESIÓN DE NODE (ADR-016 pto. 3-4). Resuelve la sesión revalidando la
 * época de credencial contra la base: si el token trae otra —o no la trae—, la sesión
 * se devuelve SIN usuario, y el guard ya existente (`requireSession`) la manda a login.
 *
 * Vive aquí y no en el middleware a propósito: el middleware corre en Edge y debe
 * seguir sin DB ni bcrypt (ADR-001, split-config). El matiz que eso deja —una cookie
 * revocada puede atravesar el middleware— es aceptable porque TODO acceso a datos
 * (server components y server actions) pasa por esta frontera: no se sirve ni un dato
 * con una sesión revocada; solo se paga un redirect un salto más tarde.
 *
 * Coste declarado (ADR-016, consecuencias): una lectura por clave primaria en cada
 * petición autenticada.
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

  const current = await getCredentialEpoch(db, token.id);
  if (!isSessionEpochCurrent(token.credentialEpoch, current)) return anonima;

  return { ...session, user: { ...session.user, id: token.id } } as S;
}
