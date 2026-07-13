import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { users, type User } from '@/db/schema';
import { hashPassword, verifyPassword } from './passwords';
import { EmailAlreadyRegisteredError, InvalidCredentialsError } from './errors';

/** Acepta tanto el cliente Neon (producción) como PGlite (tests). */
type Db = PgDatabase<any, any, any>;

/** Identidad pública de un usuario: nunca expone el hash de contraseña. */
export type PublicUser = { id: string; email: string; createdAt: Date };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublic(u: User): PublicUser {
  return { id: u.id, email: u.email, createdAt: u.createdAt };
}

/**
 * CA-1 / CA-2: registra un usuario con email único (RN-02).
 * - Normaliza el email (trim + lowercase) para que la unicidad sea real.
 * - Lanza EmailAlreadyRegisteredError si el email ya existe (no crea 2ª cuenta).
 */
export async function registerUser(
  db: Db,
  email: string,
  password: string,
): Promise<PublicUser> {
  const normalized = normalizeEmail(email);
  const existing = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (existing.length > 0) {
    throw new EmailAlreadyRegisteredError();
  }
  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(users)
    .values({ email: normalized, passwordHash })
    .returning();
  return toPublic(created);
}

/** Busca por email normalizado; null si no existe. Uso interno. */
export async function getUserByEmail(db: Db, email: string): Promise<User | null> {
  const [u] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return u ?? null;
}

// Hash señuelo para gastar el mismo tiempo cuando el email no existe y así no
// filtrar por timing si un email está registrado (refuerzo de CA-4).
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('stockeiro-dummy-password-for-timing');
  return dummyHashPromise;
}

/**
 * CA-3 / CA-4: verifica credenciales.
 * - Éxito: devuelve la identidad pública.
 * - Fallo (email inexistente O contraseña incorrecta): lanza el MISMO
 *   InvalidCredentialsError genérico, sin revelar cuál falló.
 */
export async function verifyCredentials(
  db: Db,
  email: string,
  password: string,
): Promise<PublicUser> {
  const user = await getUserByEmail(db, email);
  if (!user) {
    await verifyPassword(password, await getDummyHash()); // iguala el tiempo
    throw new InvalidCredentialsError();
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new InvalidCredentialsError();
  }
  return toPublic(user);
}
