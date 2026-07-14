import type { NotificationSender, NotificationMessage } from './sender';

/**
 * Adaptador REAL de Resend (ADR-006, canal email transaccional). Envía por la API
 * de Resend usando `RESEND_API_KEY` y un remitente verificado (`RESEND_FROM`).
 *
 * NO se ejerce en tests (se usa `FakeNotificationSender`); requiere key real y dominio
 * verificado, follow-up de despliegue (F-SPEC-006-1). Un fallo de red/HTTP se refleja
 * en `ok:false` para que el servicio conserve el aviso in-app como `failed` (RN-15).
 */
const RESEND_URL = 'https://api.resend.com/emails';

export class ResendSender implements NotificationSender {
  constructor(
    private readonly apiKey: string | undefined = process.env.RESEND_API_KEY,
    private readonly from: string = process.env.RESEND_FROM ?? 'Stockeiro <avisos@stockeiro.app>',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: NotificationMessage): Promise<{ ok: boolean }> {
    if (!this.apiKey) throw new Error('RESEND_API_KEY no definida (ver .env.example).');
    try {
      const res = await this.fetchImpl(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.from, to: message.to, subject: message.subject, text: message.body }),
      });
      return { ok: res.ok };
    } catch {
      return { ok: false }; // fallo de red -> el servicio lo marca failed (in-app fallback)
    }
  }
}
