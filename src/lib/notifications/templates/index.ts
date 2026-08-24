/**
 * SPEC-056 / ADR-036 pto. 4 — la superficie pública de las plantillas de correo.
 *
 * El módulo vive **sobre el puerto**: los emisores (`service.ts`, `password-reset.ts`)
 * componen aquí el mensaje y lo entregan por `NotificationSender`, de modo que el fake de
 * los tests y el buzón del e2e —los dos sitios desde los que este proyecto mira su propio
 * correo— ven exactamente lo que ve el destinatario. Componer dentro de un adaptador
 * dejaría el diseño solo en el camino de Resend.
 *
 * La dependencia va en un solo sentido: **ningún adaptador importa esto** (CA-3).
 */
export { COLOR, PILA_DE_FUENTES, ANCHO_MAXIMO } from './paleta';
export { escapar, type CorreoCompuesto } from './marco';
export {
  correoDeEntradaEnZona,
  correoDeResumen,
  correoDeRecuperacion,
  type DatosDeEntradaEnZona,
  type DatosDelResumen,
  type DatosDeRecuperacion,
  type PosicionEnZona,
} from './correos';
