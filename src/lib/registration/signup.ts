import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { emailVerificationTokens, users } from '@/db/schema';
import { hashPassword } from '@/lib/auth/passwords';
import { generateResetToken, hashResetToken } from '@/lib/auth/reset-tokens';
import { buildActivationUrl } from '@/lib/config/app-url';
import type { NotificationSender } from '@/lib/notifications/sender';
import { correoDeActivacion } from '@/lib/notifications/templates';
import { purgeUserData } from '@/lib/account/deletion';
import {
  ACTIVATION_EMAIL_LIMIT,
  ACTIVATION_EMAIL_WINDOW_HOURS,
  ACTIVATION_WINDOW_HOURS,
} from './activation-rules';
import type { ClosedReason } from './gate';
import { resolveRegistrationState } from './service';

/** Acepta tanto el cliente Neon (producción) como PGlite/postgres-js (tests y e2e). */
type Db = PgDatabase<any, any, any>;

/**
 * SPEC-066 capa 3 — la cuenta nace PENDIENTE (ADR-042 §A a §D, RN-19).
 *
 * Mecánica de token de ADR-015 reutilizada tal cual (pto. 4): 32 bytes de CSPRNG, sólo
 * su SHA-256 en base, un solo uso con consumo por sentencia condicional atómica, el GET
 * no consume y emitir uno nuevo invalida los vivos. Lo que cambia es el plazo, que es de
 * la CUENTA y no del enlace (pto. 5).
 *
 * El tiempo lo pone Postgres (`now()`), como en la recuperación: un solo reloj para
 * emitir, caducar, limitar y purgar.
 */

const PLAZO = sql.raw(`interval '${ACTIVATION_WINDOW_HOURS} hours'`);
const VENTANA_DEL_LIMITE = sql.raw(`interval '${ACTIVATION_EMAIL_WINDOW_HOURS} hours'`);

/** El envío diferido: fuera del camino de la respuesta (ADR-015, CA-9). */
export interface ActivationDelivery {
  delivery: Promise<void>;
}

const NADA: ActivationDelivery = { delivery: Promise.resolve() };

/**
 * Saca el envío del camino de la respuesta con un turno de macrotarea, igual que la
 * recuperación (`src/lib/auth/password-reset.ts`): encadenarlo con `.then()` lo haría
 * correr antes que la continuación de quien llama, y el reloj delataría la rama.
 */
function defer(work: () => Promise<unknown>): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      work().then(
        () => resolve(),
        () => resolve(), // un fallo de entrega no rompe nada: quien no lo reciba, repite el alta
      );
    }, 0);
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Correos de activación emitidos a esta cuenta en la ventana móvil (CA-12). */
async function emailsInWindow(db: Db, userId: string): Promise<number> {
  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        gt(emailVerificationTokens.createdAt, sql`now() - ${VENTANA_DEL_LIMITE}`),
      ),
    );
  return fila?.n ?? 0;
}

/** Marca como consumidos los enlaces vivos de una cuenta (ADR-015 pto. 7). */
async function invalidateLiveActivationTokens(db: Db, userId: string): Promise<void> {
  await db
    .update(emailVerificationTokens)
    .set({ consumedAt: sql`now()` })
    .where(
      and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.consumedAt)),
    );
}

/**
 * Emite un enlace y prepara su correo. La caducidad es el FINAL DEL PLAZO de la cuenta
 * (`created_at + 24 h`), no «ahora + 24 h»: un enlace pedido en la hora 23 vive una hora
 * (CA-11). Devuelve el envío diferido.
 */
async function issueAndSend(
  db: Db,
  sender: NotificationSender,
  user: { id: string; email: string },
  baseUrl: string,
): Promise<ActivationDelivery> {
  const token = generateResetToken();
  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    tokenHash: hashResetToken(token),
    expiresAt: sql`(select ${users.createdAt} from ${users} where ${users.id} = ${user.id}) + ${PLAZO}`,
  });
  const correo = correoDeActivacion({
    url: buildActivationUrl(baseUrl, token),
    horasDePlazo: ACTIVATION_WINDOW_HOURS,
  });
  const to = user.email; // el ALMACENADO, no el tecleado
  return {
    delivery: defer(() =>
      sender.send({ to, subject: correo.subject, body: correo.text, html: correo.html }),
    ),
  };
}

export type SignUpOutcome =
  | ({ kind: 'neutral' } & ActivationDelivery)
  | { kind: 'closed'; reason: ClosedReason };

/**
 * EL ALTA (CA-8, CA-9, CA-10, CA-12, ADR-042 ptos. 6, 7 y 10).
 *
 * El grifo se consulta ANTES de crear nada (ADR-023 pto. 5). Con él abierto, la respuesta
 * es la MISMA exista o no el correo, y el trabajo dominante —el hash de la contraseña—
 * se hace en las tres ramas:
 *
 *   - **correo nuevo**: cuenta PENDIENTE (`email_verified_at` NULL escrito AQUÍ, no por el
 *     default de la columna, que va en la dirección contraria: ADR-042 pto. 2) y un enlace.
 *   - **cuenta pendiente**: es un alta NUEVA (pto. 7): contraseña nueva, plazo reiniciado,
 *     enlaces anteriores invalidados y uno nuevo. Con el límite agotado no toca NADA.
 *   - **cuenta activada**: nada. Ni contraseña, ni época, ni tokens, ni correo.
 */
export async function signUp(
  db: Db,
  sender: NotificationSender,
  email: string,
  password: string,
  opts: { baseUrl: string },
): Promise<SignUpOutcome> {
  const estado = await resolveRegistrationState(db);
  if (!estado.open) return { kind: 'closed', reason: estado.reason };

  const normalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password); // en las tres ramas (CA-9)

  const [nueva] = await db
    .insert(users)
    .values({ email: normalized, passwordHash, emailVerifiedAt: null })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email });
  if (nueva) {
    const envio = await issueAndSend(db, sender, nueva, opts.baseUrl);
    return { kind: 'neutral', ...envio };
  }

  const [existente] = await db
    .select({ id: users.id, email: users.email, verificada: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  if (!existente || existente.verificada !== null) return { kind: 'neutral', ...NADA };

  // Re-alta sobre una pendiente (pto. 7). El límite va primero: agotado, no se toca nada.
  if ((await emailsInWindow(db, existente.id)) >= ACTIVATION_EMAIL_LIMIT) {
    return { kind: 'neutral', ...NADA };
  }
  const [renovada] = await db
    .update(users)
    .set({ passwordHash, passwordChangedAt: sql`now()`, createdAt: sql`now()` })
    .where(and(eq(users.id, existente.id), isNull(users.emailVerifiedAt)))
    .returning({ id: users.id, email: users.email });
  if (!renovada) return { kind: 'neutral', ...NADA }; // se activó entre medias
  await invalidateLiveActivationTokens(db, renovada.id);
  const envio = await issueAndSend(db, sender, renovada, opts.baseUrl);
  return { kind: 'neutral', ...envio };
}

/**
 * PEDIR OTRO CORREO (CA-16). La respuesta es la misma en los cinco casos; SÓLO sale correo
 * para una cuenta pendiente, dentro de su plazo y con el límite sin agotar. El enlace nuevo
 * invalida los anteriores y NO alarga el plazo (ADR-042 pto. 5).
 */
export async function resendActivation(
  db: Db,
  sender: NotificationSender,
  email: string,
  opts: { baseUrl: string },
): Promise<ActivationDelivery> {
  const [cuenta] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.email, normalizeEmail(email)),
        isNull(users.emailVerifiedAt),
        gt(users.createdAt, sql`now() - ${PLAZO}`),
      ),
    )
    .limit(1);
  if (!cuenta) return NADA;
  if ((await emailsInWindow(db, cuenta.id)) >= ACTIVATION_EMAIL_LIMIT) return NADA;

  await invalidateLiveActivationTokens(db, cuenta.id);
  return issueAndSend(db, sender, cuenta, opts.baseUrl);
}

/** La condición de «enlace vivo»: suyo, sin consumir, en plazo y de una cuenta pendiente. */
function enlaceVivo(token: string) {
  return and(
    eq(emailVerificationTokens.tokenHash, hashResetToken(token)),
    isNull(emailVerificationTokens.consumedAt),
    gt(emailVerificationTokens.expiresAt, sql`now()`),
    isNull(users.emailVerifiedAt),
  );
}

/**
 * ¿Este enlace PARECE vivo? Sólo mira; no consume (ADR-015 pto. 6, CA-13): los escáneres
 * de correo pinchan los enlaces, y si abrir activara, activarían cuentas de bots con
 * correos ajenos.
 */
export async function isActivationTokenUsable(db: Db, token: string): Promise<boolean> {
  const [fila] = await db
    .select({ id: emailVerificationTokens.id })
    .from(emailVerificationTokens)
    .innerJoin(users, eq(users.id, emailVerificationTokens.userId))
    .where(enlaceVivo(token))
    .limit(1);
  return fila !== undefined;
}

export type ActivationResult =
  | { ok: true; userId: string }
  /** Usado, caducado, inexistente o manipulado: los cuatro se cuentan igual (CA-11). */
  | { ok: false; reason: 'invalid' }
  /** El grifo está cerrado: la cuenta sigue pendiente y el enlace NO se consume (CA-14). */
  | { ok: false; reason: 'closed'; closed: ClosedReason };

/** Las filas de `db.execute`, sea cual sea el driver (PGlite y Neon: `.rows`; postgres-js: array). */
function filasDe<T>(resultado: unknown): T[] {
  if (Array.isArray(resultado)) return resultado as T[];
  return ((resultado as { rows?: T[] }).rows ?? []) as T[];
}

/**
 * ACTIVAR (CA-11, CA-13, CA-14, ADR-042 ptos. 8 y 10).
 *
 * El grifo se consulta AQUÍ también, porque activar es cuando la cuenta TOMA plaza. Si
 * está cerrado, no se consume nada y se devuelve el motivo; si se reabre dentro del
 * plazo, el mismo enlace sirve.
 *
 * El consumo y la activación son UNA sentencia (una CTE que modifica datos): o pasan las
 * dos o ninguna, en los tres drivers —`neon-http` no tiene transacciones interactivas—.
 * De dos consumos simultáneos del mismo enlace, Postgres deja pasar exactamente uno.
 */
export async function activateAccount(db: Db, token: string): Promise<ActivationResult> {
  if (!(await isActivationTokenUsable(db, token))) return { ok: false, reason: 'invalid' };

  const estado = await resolveRegistrationState(db);
  if (!estado.open) return { ok: false, reason: 'closed', closed: estado.reason };

  const resultado = await db.execute(sql`
    WITH consumido AS (
      UPDATE email_verification_tokens AS t
         SET consumed_at = now()
        FROM users AS u
       WHERE t.token_hash = ${hashResetToken(token)}
         AND t.consumed_at IS NULL
         AND t.expires_at > now()
         AND u.id = t.user_id
         AND u.email_verified_at IS NULL
      RETURNING t.user_id
    )
    UPDATE users
       SET email_verified_at = now()
      FROM consumido
     WHERE users.id = consumido.user_id
       AND users.email_verified_at IS NULL
    RETURNING users.id AS id
  `);
  const [activada] = filasDe<{ id: string }>(resultado);
  if (!activada) return { ok: false, reason: 'invalid' };
  return { ok: true, userId: activada.id };
}

/**
 * LA PURGA (CA-19, ADR-042 pto. 11): borra las cuentas pendientes cuyo plazo venció, con
 * TODO lo suyo y por el mismo camino que la baja voluntaria (`purgeUserData`, ADR-022).
 * Devuelve cuántas ha borrado. Una activada, por antigua que sea, no se toca.
 */
export async function purgeExpiredPendingAccounts(db: Db): Promise<number> {
  const caducadas = await db
    .select({ id: users.id })
    .from(users)
    .where(and(isNull(users.emailVerifiedAt), lt(users.createdAt, sql`now() - ${PLAZO}`)));
  for (const { id } of caducadas) await purgeUserData(db, id);
  return caducadas.length;
}

