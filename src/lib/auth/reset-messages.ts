/**
 * Textos de la recuperación de contraseña (SPEC-023). Viven aquí, en un solo sitio,
 * porque la INDISTINGUIBILIDAD es un requisito, no un detalle de redacción: si cada
 * pantalla escribiese su propia variante, el formulario acabaría delatando la rama.
 */

/**
 * CA-1 / CA-12: acuse único de la solicitud. Se muestra igual si la cuenta existe,
 * si no existe y si se ha alcanzado el límite de solicitudes. Está redactado en
 * condicional a propósito ("si hay una cuenta"): no promete nada que revele el padrón.
 */
export const RECUPERACION_ENVIADA =
  'Si hay una cuenta con ese email, te hemos enviado un enlace para crear una contraseña nueva. Revisa tu bandeja de entrada y la carpeta de spam: el enlace caduca en 30 minutos.';

/**
 * CA-7 / CA-8 / CA-9: mensaje único de enlace no válido. "Usado", "caducado" e
 * "inexistente" se cuentan igual, por coherencia con CE-2 y para no tener que
 * razonar caso por caso qué fuga es tolerable (decisión del gate humano).
 */
export const ENLACE_NO_VALIDO =
  'Este enlace no es válido. Puede que ya se haya usado o que haya caducado. Pide uno nuevo.';

/** CA-14: confirmación tras el reset, ya en `/login`, donde el usuario vuelve a entrar. */
export const CONTRASENA_ACTUALIZADA =
  'Contraseña actualizada. Entra con la contraseña nueva. Por seguridad, se han cerrado las sesiones que tuvieras abiertas.';
