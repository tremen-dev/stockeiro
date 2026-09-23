import { ACTIVATION_WINDOW_HOURS } from './activation-rules';

/**
 * SPEC-066 D-4 — los textos del alta defendida, en UN módulo que importan la página y su
 * test. Igual que los de la recuperación (`src/lib/auth/reset-messages.ts`), vivir en un
 * solo sitio no es orden: es la INDISTINGUIBILIDAD. Si cada pantalla escribiese su propia
 * variante, el formulario acabaría delatando la rama.
 *
 * Los motivos de grifo cerrado NO están aquí: se reutilizan de `./messages.ts`.
 */

/** Titular de la respuesta neutra del alta (ADR-042 ptos. 6 y 13). */
export const ALTA_ENVIADA_TITULO = 'Revisa tu correo';

/**
 * LA RESPUESTA NEUTRA del alta (ADR-042 pto. 6). Es la misma para un correo nuevo, uno de
 * una cuenta pendiente, uno de una cuenta activada y un envío que se ha tomado por un
 * automatismo (pto. 13). Por eso está escrita en condicional y cubre los casos a la vez:
 * no puede decir nada que sólo sea cierto en una rama.
 */
export const ALTA_ENVIADA: readonly string[] = [
  'Si todo está en orden, te hemos enviado un correo con un enlace para activar tu cuenta. ' +
    `Tienes ${ACTIVATION_WINDOW_HOURS} horas para activarla; hasta entonces no podrás entrar.`,
  'Si ya tenías cuenta con este correo, no te llegará nada: entra con tu contraseña o recupérala.',
  'Si en unos minutos no te ha llegado —mira también en spam—, vuelve a darte de alta con el ' +
    'mismo correo o pide otro enlace.',
];

/** El acuse del reenvío: idéntico exista la cuenta, esté activada, pendiente o caducada. */
export const REENVIO_ENVIADO =
  'Si hay una cuenta pendiente de activar con ese correo y aún está en plazo, te hemos enviado ' +
  'un enlace nuevo. Revisa tu bandeja de entrada y la carpeta de spam.';

/** Lo que lee quien entra con la contraseña correcta de una cuenta pendiente (ADR-042 pto. 9). */
export const CUENTA_PENDIENTE =
  'Tu cuenta todavía no está activada. Abre el enlace del correo de activación que te enviamos ' +
  'al darte de alta.';

/** El rótulo del enlace que acompaña a `CUENTA_PENDIENTE`. */
export const PEDIR_OTRO_ENLACE = 'Pedir otro correo de activación';

/** Usado, caducado, inexistente y manipulado: un solo mensaje (CA-11, ADR-015 pto. 6). */
export const ENLACE_ACTIVACION_NO_VALIDO =
  'Este enlace de activación no es válido. Puede que ya se haya usado o que haya caducado. ' +
  'Si tu cuenta sigue sin activar, pide otro enlace o vuelve a darte de alta.';

/** La página del enlace vivo: un GET que NO activa, y un botón que sí (ADR-042 pto. 8). */
export const ACTIVAR_TITULO = 'Activa tu cuenta';
export const ACTIVAR_EXPLICACION =
  'Pulsa el botón para activar tu cuenta. Después entrarás con el correo y la contraseña que ' +
  'elegiste al darte de alta.';
export const ACTIVAR_BOTON = 'Activar mi cuenta';

/** El aviso de `/login?activada=1`: activar NO inicia sesión (ADR-042 pto. 8). */
export const CUENTA_ACTIVADA = 'Cuenta activada. Ya puedes entrar con tu correo y tu contraseña.';

/** Titular de la página de reenvío. */
export const REENVIAR_TITULO = 'Pedir otro correo de activación';
