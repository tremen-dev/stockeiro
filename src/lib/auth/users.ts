import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { users, type User } from '@/db/schema';
import type { Role } from './sections';
import { hashPassword, verifyPassword } from './passwords';
import { AccountPendingError, EmailAlreadyRegisteredError, InvalidCredentialsError } from './errors';

/** Acepta tanto el cliente Neon (producción) como PGlite (tests). */
type Db = PgDatabase<any, any, any>;

/**
 * Identidad pública de un usuario: nunca expone el hash de contraseña.
 * `passwordChangedAt` es la época de credencial (ADR-016 pto. 1) — no es material
 * de la credencial, solo la marca temporal que el JWT estampa al hacer login.
 */
export type PublicUser = {
  id: string;
  email: string;
  passwordChangedAt: Date;
  /** Rol de cuenta (SPEC-034, ADR-021). Toda cuenta nueva nace `tester`. */
  role: Role;
  createdAt: Date;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublic(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    passwordChangedAt: u.passwordChangedAt,
    role: u.role,
    createdAt: u.createdAt,
  };
}

/**
 * ⚠️ SPEC-066: **no es el camino de alta de la app** —ése es `signUp`
 * (`src/lib/registration/signup.ts`), que crea la cuenta PENDIENTE y no dice si el correo
 * existe—. Esto crea una cuenta ACTIVADA en el acto (inserta sin nombrar
 * `email_verified_at` y la columna la da por verificada, ADR-042 pto. 2), y lo usan los
 * tests como semilla de «una cuenta que ya existía».
 *
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
 * - Contraseña correcta de una cuenta PENDIENTE: lanza `AccountPendingError` (SPEC-066).
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
  // SPEC-066 CA-17 (ADR-042 pto. 9, RN-19): una cuenta pendiente no entra. Va DESPUÉS de
  // la contraseña: con una incorrecta, el error es el genérico, indistinguible del de un
  // correo inexistente (SPEC-001 CA-4 intacto).
  if (user.emailVerifiedAt === null) {
    throw new AccountPendingError();
  }
  return toPublic(user);
}
