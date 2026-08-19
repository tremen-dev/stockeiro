import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  users,
  notifications,
  passwordResetTokens,
  symbolAliases,
  transactions,
  watchedSymbols,
} from '@/db/schema';
import { verifyCredentials } from '@/lib/auth/users';
import type { Role } from '@/lib/auth/sections';

/** Acepta tanto el cliente Neon (producción) como PGlite/postgres-js (tests y e2e). */
type Db = PgDatabase<any, any, any>;

/**
 * Borrado de cuenta (SPEC-036, ADR-022).
 *
 * Cae TODO lo propio, se conserva lo compartido y no se anonimiza nada. No hay
 * borrado suave, ni `deletedAt`, ni lápida: después del borrado no existe ninguna
 * fila en la base que se refiera a esa persona (ADR-022 pto. 1). Esa ausencia de
 * estado intermedio es lo que hace el borrado auditable con una consulta por tabla,
 * en vez de con un filtro que hay que acordarse de poner en cada consulta del
 * proyecto.
 */

/**
 * Cómo desaparece cada tabla:
 *  - `delete`  → sentencia explícita de este módulo, en el orden de ADR-022 pto. 4.
 *  - `cascade` → cae sola al borrarse otra, por su `on delete cascade` (ADR-017).
 *
 * El mecanismo se declara y no se supone: un `cascade` que alguien convierta mañana
 * en `no action` dejaría de borrar en silencio, y `tests/schema-source.test.ts` ancla
 * esas cláusulas precisamente porque ningún test de comportamiento las delataría.
 */
export type CoverageMechanism = 'delete' | 'cascade';

export interface CoveredTable {
  /** Nombre real de la tabla en Postgres — el mismo que devuelve el esquema. */
  table: string;
  via: CoverageMechanism;
  /** Solo en `cascade`: de qué tabla cuelga. */
  from?: string;
  /** Cómo se le nombra a una persona en `/cuenta` (CA-2). No es el nombre técnico. */
  label: string;
}

/**
 * LA declaración de cobertura (CA-5). Un solo sitio, del que salen tres cosas:
 * el orden real del borrado, la lista que lee el usuario antes de pulsar (CA-2), y
 * la comparación contra el esquema que hace fallar la PR de quien añada una tabla
 * con `user_id` y se olvide de borrarla (`tests/account-deletion-coverage.test.ts`).
 *
 * El orden es el de ADR-022 pto. 4 y no es decorativo: `zone_triggers.user_id` y
 * `notifications.user_id` son `no action`, así que la fila de `users` no puede caer
 * mientras queden filas suyas apuntándola.
 */
export const ACCOUNT_DELETION_COVERAGE: readonly CoveredTable[] = [
  {
    table: 'notifications',
    via: 'delete',
    label: 'Tus avisos, leídos y sin leer, y el registro de si se enviaron o no',
  },
  {
    table: 'watched_symbols',
    via: 'delete',
    label: 'Tus acciones vigiladas, con sus zonas de compra y de venta',
  },
  {
    table: 'zone_triggers',
    via: 'cascade',
    from: 'watched_symbols',
    label: 'Los episodios de entrada en zona que esas acciones habían disparado',
  },
  {
    table: 'transactions',
    via: 'delete',
    label: 'Tus operaciones: compras, ventas, splits y dividendos',
  },
  {
    table: 'symbol_aliases',
    via: 'delete',
    label: 'Las equivalencias que aprendió el import entre los nombres de tu bróker y cada valor',
  },
  {
    table: 'password_reset_tokens',
    via: 'delete',
    label: 'Los enlaces de recuperación de contraseña que tuvieras pendientes',
  },
  {
    table: 'users',
    via: 'delete',
    label: 'Tu cuenta: la dirección de correo, la huella de tu contraseña y la fecha de alta',
  },
] as const;

/**
 * Las tablas que NO se tocan (ADR-022 pto. 2). Son hechos de mercado y no son de
 * nadie (ADR-002/ADR-007): borrarlas con quien se va rompería la cartera y la
 * vigilancia de los demás, que es R-6 de EPIC-004.
 *
 * Un símbolo que se quede sin nadie que lo referencie queda inerte, no huérfano
 * peligroso: `symbolUniverse` (`src/lib/market/refresh.ts`) compone el universo del
 * ciclo desde `watched_symbols` y `transactions`, así que deja de cotizarse solo.
 */
export const SHARED_TABLES = ['symbols', 'quotes', 'quote_diagnostics'] as const;

/** Lo que se le dice a una persona sobre cada tabla compartida, en `/cuenta` (CA-2). */
export const SHARED_LABELS: Readonly<Record<(typeof SHARED_TABLES)[number], string>> = {
  symbols: 'El registro de valores (ticker, mercado y divisa), que es común a todos los usuarios',
  quotes: 'Las últimas cotizaciones de esos valores, que son datos de mercado y no datos tuyos',
  quote_diagnostics: 'El motivo por el que un valor no se pudo cotizar, que tampoco es tuyo',
} as const;

/** El orden de las sentencias explícitas. Derivado de la cobertura, no copiado. */
export const DELETION_ORDER: readonly string[] = ACCOUNT_DELETION_COVERAGE.filter(
  (c) => c.via === 'delete',
).map((c) => c.table);

/**
 * El rol que no puede borrarse desde la app (ADR-022 pto. 8). La regla es ANCHA —
 * ningún `admin`, no "solo el último"— y esa anchura es lo que la hace correcta:
 * contar administradores dentro del borrado pierde una carrera (dos que se van a la
 * vez ven ambos censo de dos, ambos se creen no-últimos, el servicio se queda con
 * cero operadores). Esta función no cuenta nada, así que no tiene ese caso.
 */
const ROLE_THAT_CANNOT_LEAVE: Role = 'admin';

/** ¿Este rol puede borrar su cuenta? Pura: no mira la base y no cuenta a nadie. */
export function canDeleteAccount(role: Role): boolean {
  return role !== ROLE_THAT_CANNOT_LEAVE;
}

export type DeleteAccountFailure = 'unknown-user' | 'admin-role' | 'invalid-password';

export type DeleteAccountResult = { ok: true } | { ok: false; reason: DeleteAccountFailure };

/**
 * Las sentencias del borrado, ligadas a la sesión que se le pase (la base o una
 * transacción). Se construyen aparte para poder ejecutarlas con el primitivo que
 * cada driver ofrece, sin dos copias del orden.
 */
function deleteStatements(d: Db, userId: string) {
  return [
    d.delete(notifications).where(eq(notifications.userId, userId)),
    // Arrastra `zone_triggers` por su `on delete cascade` (ADR-017): no hay sentencia
    // para ellos a propósito, para que ningún camino de baja pueda olvidarla.
    d.delete(watchedSymbols).where(eq(watchedSymbols.userId, userId)),
    d.delete(transactions).where(eq(transactions.userId, userId)),
    d.delete(symbolAliases).where(eq(symbolAliases.userId, userId)),
    d.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId)),
    d.delete(users).where(eq(users.id, userId)),
  ] as const;
}

/**
 * Borra todo lo de un usuario en UNA sola transacción (CA-7, ADR-022 pto. 4): o cae
 * todo o no cae nada. Un borrado a medias deja a la persona sin cuenta y con datos,
 * que es el peor de los dos mundos.
 *
 * Los dos caminos NO son una duda ni una optimización: son los dos primitivos
 * atómicos que existen según el driver, y el proyecto usa los dos (ADR-001).
 *
 *  - `neon-http` (producción) **no tiene transacciones interactivas** —cada consulta
 *    es una petición HTTP— y su `transaction()` lanza de propósito. Lo que sí tiene es
 *    `batch()`, que manda todas las sentencias en una sola petición envuelta en
 *    `BEGIN`/`COMMIT`. Es la misma garantía.
 *  - `postgres-js` (e2e) y PGlite (tests unitarios) tienen `transaction()` y no
 *    tienen `batch()`.
 *
 * Se elige por capacidad y no por el nombre del driver: preguntar "¿sabes hacer
 * batch?" no se rompe el día que se cambie de proveedor, y una variable de entorno
 * mal puesta no puede convertir esto en seis sentencias sueltas.
 */
export async function purgeUserData(db: Db, userId: string): Promise<void> {
  const conBatch = db as Db & { batch?: (queries: unknown) => Promise<unknown> };
  if (typeof conBatch.batch === 'function') {
    await conBatch.batch(deleteStatements(db, userId));
    return;
  }
  await db.transaction(async (tx) => {
    for (const statement of deleteStatements(tx as unknown as Db, userId)) {
      await statement;
    }
  });
}

/**
 * El borrado tal y como lo pide una persona: demuestra que es ella y se va.
 *
 * Tres puertas, en este orden:
 *  1. La cuenta existe. Si no, no hay nada que borrar.
 *  2. Su rol lo permite (CA-11). Se lee de la BASE, no de lo que traiga quien llama:
 *     una sesión rancia con el rol de ayer no puede abrir esta puerta (ADR-021 pto. 3).
 *     Por eso la firma no admite un rol de entrada.
 *  3. La contraseña actual, con `verifyCredentials` — el MISMO mecanismo del login
 *     (ADR-022 pto. 6), no un segundo camino de comprobación que pueda divergir.
 *
 * Si algo de la transacción falla, el error SUBE: quien llama tiene que enterarse y
 * el usuario reintenta (F-SPEC-036-1). Tragarse el error aquí sería decirle a alguien
 * que se ha ido cuando sigue estando.
 */
export async function deleteMyAccount(
  db: Db,
  userId: string,
  password: string,
): Promise<DeleteAccountResult> {
  const [row] = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return { ok: false, reason: 'unknown-user' };
  if (!canDeleteAccount(row.role)) return { ok: false, reason: 'admin-role' };

  try {
    await verifyCredentials(db, row.email, password);
  } catch {
    return { ok: false, reason: 'invalid-password' };
  }

  await purgeUserData(db, userId);
  return { ok: true };
}
