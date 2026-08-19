/**
 * Lo que se le dice a una persona cuando el borrado no sale (SPEC-036).
 *
 * Módulo aparte y sin imports por dos razones. La de Next: un fichero `'use server'`
 * solo puede exportar funciones asíncronas, así que las constantes no caben en
 * `actions.ts`. La de fondo: estos textos los lee el usuario y los leen los tests, y
 * tenerlos en un sitio es lo que impide que el mensaje de la pantalla y el que se
 * verifica se separen sin que nadie se entere.
 */

/** Contraseña incorrecta (CA-3). No dice "esa no es tu contraseña" de más maneras. */
export const PASSWORD_INCORRECTA =
  'Esa no es tu contraseña actual. No se ha borrado nada.';

/**
 * Rol `admin` (CA-11, ADR-022 pto. 8). El mensaje tiene que decir las dos cosas: por
 * qué no se puede y cómo proceder. Un "no puedes" a secas deja a alguien atrapado en
 * una app de la que la política de privacidad promete que puede irse.
 */
export const ADMIN_NO_SE_BORRA =
  'Esta cuenta es la del operador del servicio (rol admin) y no puede borrarse desde ' +
  'la app: sin operador, el servicio se quedaría sin gobierno. Para irte, primero hay ' +
  'que degradar la cuenta a tester o a completo; entonces podrás borrarla como ' +
  'cualquier otra.';

/** La sesión ya no vale (o la cuenta ya no está). No se borra nada y se vuelve a entrar. */
export const SESION_NO_VALIDA =
  'Tu sesión ya no es válida. Vuelve a entrar e inténtalo otra vez.';

/**
 * El borrado se intentó y falló ENTERO (CA-7 / F-SPEC-036-1). Es el caso de la
 * carrera con el ciclo diario: la transacción cae entera —nunca queda a medias— y lo
 * único que hay que hacer es repetir. Se dice así, sin dramatizar y sin mentir.
 */
export const REINTENTA =
  'No se ha podido completar el borrado y no se ha borrado nada. Vuelve a intentarlo.';
