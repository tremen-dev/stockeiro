import type { NotificationSender } from './sender';
import { ResendSender } from './resend-sender';
import { OutboxFileSender } from './outbox-file-sender';

/**
 * Elige el adaptador del puerto `NotificationSender` (ADR-006). Mismo patrón que
 * `quote-provider-factory` (SPEC-015): el dominio depende del puerto y el runtime
 * decide el adaptador según entorno.
 *
 * `E2E_OUTBOX_FILE` (nunca en producción) desvía el correo a un buzón en disco para
 * que el e2e pueda leer el enlace. Sin esa variable, Resend.
 */
export function resolveNotificationSender(): NotificationSender {
  const outbox = process.env.E2E_OUTBOX_FILE;
  if (outbox) return new OutboxFileSender(outbox);
  return new ResendSender();
}
