/**
 * Puerto `NotificationSender` (ADR-006): frontera de integración con el canal de
 * aviso (email en v1). El dominio depende de esta interfaz, no del proveedor —
 * cambiar de proveedor = nuevo adaptador. Análogo a `MarketDataProvider` (ADR-002).
 *
 * Contrato de resiliencia (RN-15): un fallo de envío NO lanza hacia el dominio de
 * forma que aborte el lote; se refleja en `ok: false` (o excepción, que el servicio
 * captura) y el aviso se conserva in-app como `failed`.
 */
export interface NotificationMessage {
  /** Destinatario (email del usuario en v1). */
  to: string;
  subject: string;
  /**
   * Cuerpo en **texto plano**. SIEMPRE presente (ADR-036 pto. 1 y 2): es la
   * alternativa completa para quien no ve HTML, y es **lo que este proyecto observa**
   * de su propio correo — el fake de los tests y el buzón del e2e sacan de aquí el
   * enlace de recuperación. No es un resumen del HTML: dice lo mismo, entero.
   */
  body: string;
  /**
   * Cuerpo **HTML**, opcional (ADR-036 pto. 1). Cuando está, viaja JUNTO al texto y
   * nunca en su lugar: el adaptador manda las dos partes y el cliente elige la que
   * sabe pintar. Que sea opcional es lo que hace que la enmienda no rompa nada — un
   * emisor sin plantilla sigue enviando texto y funcionando.
   */
  html?: string;
}

export interface NotificationSender {
  /** Envía un aviso. `ok:false` (o excepción) = no entregado; el servicio lo marca `failed`. */
  send(message: NotificationMessage): Promise<{ ok: boolean }>;
}
