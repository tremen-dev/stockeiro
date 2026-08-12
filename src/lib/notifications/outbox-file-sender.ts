import { appendFileSync } from 'node:fs';
import { FakeNotificationSender } from './fake-sender';
import type { NotificationMessage } from './sender';

/**
 * Sender de e2e: el mismo `FakeNotificationSender` de los tests, más una copia en
 * disco (JSON por línea) para que el navegador de Playwright pueda leer el enlace
 * que "llegó al buzón". Existe porque en e2e la app corre en OTRO proceso, así que
 * el array en memoria del fake no es observable desde el test.
 *
 * Nunca llama a Resend. Se activa solo con `E2E_OUTBOX_FILE` (ver `sender-factory`).
 */
export class OutboxFileSender extends FakeNotificationSender {
  constructor(private readonly file: string) {
    super();
  }

  override async send(message: NotificationMessage): Promise<{ ok: boolean }> {
    const res = await super.send(message);
    appendFileSync(this.file, `${JSON.stringify(message)}\n`, 'utf8');
    return res;
  }
}
