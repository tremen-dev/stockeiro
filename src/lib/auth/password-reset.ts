import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { passwordResetTokens, users } from '@/db/schema';
import { buildResetUrl } from '@/lib/config/app-url';
import type { NotificationSender } from '@/lib/notifications/sender';
import { hashPassword } from './passwords';
import { getUserByEmail } from './users';
import {
  RESET_REQUEST_LIMIT,
  RESET_REQUEST_WINDOW_MINUTES,
  generateResetToken,
  hashResetToken,
  resetTokenExpiry,
} from './reset-tokens';
import { newPasswordSchema } from './validation';

/** Acepta tanto el cliente Neon (producción) como PGlite (tests). */
type Db = PgDatabase<any, any, any>;

export interface PasswordResetRequest {
  /**
   * Envío DIFERIDO del correo (CA-2). No está en el camino de la respuesta: al
   * retornar `requestPasswordReset` el sender todavía no ha sido invocado. Quien
   * llama decide cuándo esperarlo (`after()` en la server action, `await` en tests).
   */
  delivery: Promise<void>;
}

/**
 * Saca el trabajo del camino de la respuesta con un turno de macrotarea. No es
 * cosmético: si se encadenara con `.then()` sobre una promesa ya resuelta, el
 * envío correría ANTES que la continuación de quien llama y volvería a estar en
 * el camino de la respuesta (CE-2, R-2).
 */
function defer(work: () => Promise<unknown>): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      work().then(
        () => resolve(),
        () => resolve(), // un fallo de entrega no rompe nada: aquí no hay fila que marcar
      );
    }, 0);
  });
}

const SUBJECT = 'Recupera tu contraseña de Stockeiro';

function resetEmailBody(url: string): string {
  return [
    'Has pedido recuperar tu contraseña de Stockeiro.',
    '',
    'Abre este enlace para establecer una contraseña nueva:',
    url,
    '',
    'El enlace caduca en 30 minutos y solo sirve una vez.',
    'Si no has sido tú, no hace falta que hagas nada: nadie ha cambiado tu contraseña.',
  ].join('\n');
}

/**
 * CA-1/CA-2/CA-3/CA-11/CA-12: solicitud de recuperación.
 *
 * La respuesta es LA MISMA exista o no la cuenta, esté o no limitada (CE-2): esta
 * función no devuelve ni lanza nada que distinga las ramas, y el envío queda fuera
 * del camino de la respuesta para que tampoco lo delate el reloj.
 *
 * Cuando sí procede: supersede los enlaces vivos del usuario (CA-11, ADR-015 pto. 7),
 * emite uno nuevo guardando solo su digest (CA-5) y despacha el correo por el puerto
 * `NotificationSender` (ADR-006) — sin escribir en `notifications` (CA-3, ADR-015 pto. 10).
 */
export async function requestPasswordReset(
  db: Db,
  sender: NotificationSender,
  email: string,
  opts: { baseUrl: string },
): Promise<PasswordResetRequest> {
  const nothing: PasswordResetRequest = { delivery: Promise.resolve() };

  const user = await getUserByEmail(db, email);
  if (!user) return nothing; // ni token ni correo, y sin decirlo (CA-1)

  // CA-12: límite por cuenta y ventana. Invisible en la respuesta a propósito.
  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        gt(
          passwordResetTokens.createdAt,
          sql`now() - ${`${RESET_REQUEST_WINDOW_MINUTES} minutes`}::interval`,
        ),
      ),
    );
  if ((recent?.n ?? 0) >= RESET_REQUEST_LIMIT) return nothing;

  // CA-11: como mucho una llave en circulación.
  await invalidateLiveTokens(db, user.id);

  const token = generateResetToken();
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashResetToken(token),
    expiresAt: resetTokenExpiry(),
  });

  const url = buildResetUrl(opts.baseUrl, token);
  const to = user.email; // el email ALMACENADO, no el tecleado (CA-3)
  return {
    delivery: defer(() => sender.send({ to, subject: SUBJECT, body: resetEmailBody(url) })),
  };
}

/** Marca como consumidos todos los enlaces vivos de un usuario (CA-6, CA-11). */
async function invalidateLiveTokens(db: Db, userId: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ consumedAt: sql`now()` })
    .where(
      and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.consumedAt)),
    );
}

/**
 * CA-10: ¿este enlace PARECE vivo? Solo mira; no consume (ADR-015 pto. 6). Es lo que
 * usa el GET de la página de contraseña nueva para decidir si enseña el formulario o
 * el mensaje genérico: si el GET consumiera, el antivirus de correo del destinatario
 * dejaría el enlace inservible antes de que lo viera nadie.
 */
export async function isResetTokenUsable(db: Db, token: string): Promise<boolean> {
  const [row] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashResetToken(token)),
        isNull(passwordResetTokens.consumedAt),
        gt(passwordResetTokens.expiresAt, sql`now()`),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export type ResetPasswordResult =
  | { ok: true; userId: string }
  /** Usado, caducado, inexistente o manipulado: los cuatro se cuentan igual (CA-9). */
  | { ok: false; reason: 'invalid-token' }
  | { ok: false; reason: 'invalid-password' };

/**
 * CA-6/CA-7/CA-8/CA-9/CA-13: establece la contraseña nueva a partir del enlace.
 *
 * El consumo es UNA sentencia condicional atómica (ADR-015 pto. 5): quien gana lo
 * decide Postgres, no el código, así que dos envíos simultáneos del mismo enlace no
 * pueden pasar los dos. La contraseña se valida ANTES de consumir para que un envío
 * mal formado no queme el enlace.
 *
 * Al tener éxito mueve la época de credencial (`passwordChangedAt`, ADR-016 pto. 1):
 * ahí es donde las sesiones anteriores dejan de valer.
 */
export async function resetPasswordWithToken(
  db: Db,
  token: string,
  newPassword: unknown,
): Promise<ResetPasswordResult> {
  const parsed = newPasswordSchema.safeParse(newPassword);
  if (!parsed.success) return { ok: false, reason: 'invalid-password' };

  const consumed = await db
    .update(passwordResetTokens)
    .set({ consumedAt: sql`now()` })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashResetToken(token)),
        isNull(passwordResetTokens.consumedAt),
        gt(passwordResetTokens.expiresAt, sql`now()`),
      ),
    )
    .returning({ userId: passwordResetTokens.userId });

  if (consumed.length === 0) return { ok: false, reason: 'invalid-token' };
  const { userId } = consumed[0];

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data), passwordChangedAt: sql`now()` })
    .where(eq(users.id, userId));

  // CA-6: un reset con éxito deja sin valor cualquier otro enlace vivo del usuario.
  await invalidateLiveTokens(db, userId);

  return { ok: true, userId };
}

