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
  body: string;
}

export interface NotificationSender {
  /** Envía un aviso. `ok:false` (o excepción) = no entregado; el servicio lo marca `failed`. */
  send(message: NotificationMessage): Promise<{ ok: boolean }>;
}
