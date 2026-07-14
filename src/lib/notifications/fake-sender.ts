import type { NotificationSender, NotificationMessage } from './sender';

/**
 * Sender fake inyectable para tests/e2e (ADR-006): registra los mensajes intentados
 * y puede simular fallo de entrega para destinatarios concretos (CA-7). El dominio
 * depende del puerto, así que es intercambiable con `ResendSender` sin tocar el servicio.
 */
export class FakeNotificationSender implements NotificationSender {
  /** Todos los mensajes cuyo envío se intentó (incluidos los que "fallan"). */
  public readonly sent: NotificationMessage[] = [];

  /** @param failFor destinatarios (email) para los que el envío devuelve ok:false. */
  constructor(private readonly failFor: Set<string> = new Set()) {}

  async send(message: NotificationMessage): Promise<{ ok: boolean }> {
    this.sent.push(message);
    return { ok: !this.failFor.has(message.to) };
  }

  /** Mensajes enviados a un destinatario concreto. */
  to(recipient: string): NotificationMessage[] {
    return this.sent.filter((m) => m.to === recipient);
  }
}
