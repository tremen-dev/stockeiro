import { MARCA } from '@/lib/legal/content';
import type { NotificationSender, NotificationMessage } from './sender';

/**
 * Adaptador REAL de Resend (ADR-006, canal email transaccional). Envía por la API
 * de Resend usando `RESEND_API_KEY` y un remitente verificado (`RESEND_FROM`).
 *
 * NO se ejerce en tests (se usa `FakeNotificationSender`); requiere key real y dominio
 * verificado, follow-up de despliegue (F-SPEC-006-1). Un fallo de red/HTTP se refleja
 * en `ok:false` para que el servicio conserve el aviso in-app como `failed` (RN-15).
 *
 * Desde SPEC-056 (ADR-036 pto. 3) manda **las dos partes** cuando el mensaje trae
 * `html`: Resend compone entonces un `multipart/alternative` y cada cliente elige la
 * que sabe pintar. El adaptador no decide nada más — sigue traduciendo, que es lo
 * único que le toca: **no compone HTML**, eso vive sobre el puerto (ADR-036 pto. 4).
 */
const RESEND_URL = 'https://api.resend.com/emails';

/**
 * El remitente por defecto (SPEC-056 CA-19, D-11): el que se usa cuando `RESEND_FROM`
 * no está definida. Se exporta para que `.env.example` y `docs/despliegue.md` puedan
 * compararse **contra él** (CA-20) en vez de contra una cadena escrita en un test.
 *
 * Dos mitades con dos orígenes distintos, y esa distinción **es** la decisión:
 *
 *   - **El nombre visible** lleva la marca, y la lleva DERIVADA de `MARCA.nombre`,
 *     porque en la bandeja del móvil la dirección no se ve y el nombre sí. Va corto
 *     (≤ 25 caracteres, que es donde los clientes móviles truncan), en ASCII puro
 *     —de ahí el guion y no el ` · ` de la app, que exigiría *encoded-word* (RFC
 *     2047)— y entre comillas, porque `tremen.dev` lleva un punto y el punto no es
 *     `atext` en un `display-name` sin comillas (RFC 5322 §3.4).
 *   - **La dirección NO se deriva de `MARCA`**, aunque hoy coincidan (D-11 razón 5).
 *     El dominio de envío es **configuración de despliegue** —lo que está verificado
 *     en Resend—, no una etiqueta de marca. Atar uno a otro haría que retocar el
 *     rótulo cambiase en silencio desde dónde se manda el correo. Es el mismo motivo
 *     por el que SPEC-051 D-4 se negó a derivar `metadataBase` de `TITULAR.dominio`.
 *
 * Antes el buzón por defecto colgaba de un dominio que Resend **no** tiene verificado
 * —el verificado es `tremen.dev`, `docs/despliegue.md` §0—, así que el valor por defecto
 * documentaba un envío que no podía salir. El literal viejo está en SPEC-056. Fijar el valor
 * en el entorno de Production de Vercel **no** es parte de esta spec: es F-SPEC-056-4,
 * y hasta que se haga el remitente real en producción sigue siendo el de siempre.
 */
export const REMITENTE_POR_DEFECTO = `"Stockeiro - ${MARCA.nombre}" <stockeiro@tremen.dev>`;

export class ResendSender implements NotificationSender {
  constructor(
    private readonly apiKey: string | undefined = process.env.RESEND_API_KEY,
    private readonly from: string = process.env.RESEND_FROM ?? REMITENTE_POR_DEFECTO,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: NotificationMessage): Promise<{ ok: boolean }> {
    if (!this.apiKey) throw new Error('RESEND_API_KEY no definida (ver .env.example).');
    try {
      const res = await this.fetchImpl(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.from,
          to: message.to,
          subject: message.subject,
          text: message.body,
          // Ausente cuando el mensaje no trae HTML: `JSON.stringify` omite lo
          // indefinido, así que la clave `html` ni siquiera viaja (CA-2).
          ...(message.html === undefined ? {} : { html: message.html }),
        }),
      });
      return { ok: res.ok };
    } catch {
      return { ok: false }; // fallo de red -> el servicio lo marca failed (in-app fallback)
    }
  }
}
