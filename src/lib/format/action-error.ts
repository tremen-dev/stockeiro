import { InvalidNumberError } from './decimal-input';
import { InvalidZoneError } from '@/lib/watchlist/service';
import { NoPositionError } from '@/lib/portfolio/service';
import { OversellError } from '@/lib/portfolio/position';

/**
 * SPEC-030 — Traducción de una excepción a lo que lee el usuario, en un solo sitio.
 *
 * Hasta esta spec, el `catch` de las server actions respondía «Datos inválidos.» a
 * cualquier cosa: eso significaba a la vez "has escrito mal un número" (culpa del dato,
 * con arreglo evidente) y "se ha caído la base de datos" (culpa nuestra, sin arreglo por
 * su parte), y además **no dejaba rastro** — un fallo de infraestructura en producción era
 * invisible para nosotros e inaccionable para él (CE-F2 de EPIC-FIX).
 *
 * Es una función PURA salvo por el log, que es justo lo que hace CA-10..CA-12 testables
 * sin montar un servidor.
 */

/** Lo que ve el usuario cuando el fallo es nuestro, no suyo. Distinto del de dato (CA-11). */
export const INFRA_ERROR_TEXT =
  'No hemos podido guardarlo: ha fallado algo por nuestra parte. Vuelve a intentarlo dentro de un momento.';

/** Mensajes de dominio que ya existían y que esta spec NO cambia (CA-14). */
const OVERSELL_TEXT = 'No puedes vender más de lo que tienes.';
const NO_POSITION_TEXT = 'No tienes posición en ese valor.';

export type ActionErrorResult = { error: string };

/**
 * Mapea la excepción de una server action al mensaje del usuario.
 *
 * - Error de DATO (`InvalidNumberError`): campo, valor y qué se espera. Sin log.
 * - Errores de DOMINIO (`InvalidZoneError` RN-10, `OversellError` RN-08,
 *   `NoPositionError`): sus mensajes de siempre. Sin log.
 * - Cualquier otra cosa: es infraestructura. Mensaje distinto **y log**.
 *
 * El log registra la acción y la excepción, y **nada más**: el formulario lleva importes
 * y posiciones del usuario y no se vuelca (RN-01, D-5). El valor rechazado sí viaja en el
 * mensaje al usuario —es suyo y lo acaba de escribir—, pero no hace falta en el log.
 *
 * @param action Nombre corto de la acción ('vigilar', 'comprar', 'vender'), para la traza.
 */
export function toFormError(action: string, e: unknown): ActionErrorResult {
  if (e instanceof InvalidNumberError) return { error: e.message };
  if (e instanceof InvalidZoneError) return { error: e.message };
  if (e instanceof OversellError) return { error: OVERSELL_TEXT };
  if (e instanceof NoPositionError) return { error: NO_POSITION_TEXT };
  console.error(`[SPEC-030] fallo de infraestructura en la acción "${action}"`, e);
  return { error: INFRA_ERROR_TEXT };
}
