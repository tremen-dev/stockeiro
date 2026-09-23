/**
 * SPEC-066 D-3 — los números y los nombres del alta defendida, en UN solo sitio cada uno.
 *
 * Módulo PURO y sin un solo `import`, a propósito: lo leen el servidor, el cliente
 * (`src/instrumentation-client.ts`), las plantillas de correo —que no pueden alcanzar la
 * base (SPEC-056 CA-3)— y el ayudante del e2e, que corre fuera de Next. Cambiar un plazo
 * es cambiar un número aquí, no perseguir literales (ADR-042 ptos. 5 y 15).
 */

/**
 * PLAZO DE ACTIVACIÓN (ADR-042 pto. 5, RN-19): horas desde el alta de la cuenta de las
 * que dispone para activarse. Es de la CUENTA, no del enlace: ningún enlace vive más allá.
 */
export const ACTIVATION_WINDOW_HOURS = 24;

/** Correos de activación por cuenta dentro de la ventana móvil (ADR-042 pto. 5). */
export const ACTIVATION_EMAIL_LIMIT = 3;

/** La ventana móvil del límite de correos de activación, en horas. */
export const ACTIVATION_EMAIL_WINDOW_HOURS = 24;

/**
 * TIEMPO MÍNIMO (ADR-042 pto. 15): milisegundos entre pintar el formulario del alta y
 * recibir el envío, medidos con el reloj del servidor en los dos extremos. Sin cota
 * superior: una pestaña abierta desde ayer es un humano lento, no un bot.
 */
export const MIN_FORM_FILL_MS = 2_000;

/**
 * El CAMPO TRAMPA (ADR-042 pto. 14): un nombre que un automatismo rellena por costumbre
 * y que un humano nunca ve. Cualquier valor no vacío = automatismo.
 */
export const HONEYPOT_FIELD = 'website';

/** El campo oculto que lleva el sello firmado del instante de pintado (ADR-042 pto. 15). */
export const RENDER_SEAL_FIELD = 'sello';

/** Las rutas del alta. Cuelgan todas de `/register`, que ya es pública (SPEC-066 D-2). */
export const REGISTER_PATH = '/register';
export const RESEND_ACTIVATION_PATH = '/register/reenviar';
export const CONFIRM_ACTIVATION_PATH = '/register/confirmar';

/** `/login?activada=1`: a donde llega quien acaba de activar (ADR-042 pto. 8). */
export const ACTIVATED_LOGIN_PATH = '/login?activada=1';
