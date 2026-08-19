import type { ClosedReason } from './gate';

/**
 * Lo que lee quien llega con la puerta cerrada (SPEC-037 CA-6, R-7 de EPIC-004).
 *
 * R-7 dice literalmente: *"si el cupo se agota de madrugada, quien venga del foro se
 * encuentra la puerta cerrada"*. La mitigación no es evitar que pase —el cupo existe
 * justamente para que pase— sino que **no se parezca a un error**. Nada de 404, nada
 * de 500, nada de redirección muda: una pantalla que explica el motivo CONCRETO.
 *
 * Los dos motivos tienen dos textos DISTINTOS a propósito, y no es cosmética:
 *  - «cerrado a mano» es una decisión reversible de quien opera esto, y quien lo lee
 *    debe entender que volver más tarde tiene sentido;
 *  - «lleno» es un aforo alcanzado, y decir «vuelve luego» sería casi mentir: lo que
 *    de verdad puede pasar es que alguien se vaya y deje su plaza.
 * Un solo texto para los dos casos convertiría el porqué en un adorno.
 *
 * Lo que NO hay aquí (F-ADR-023-3): lista de espera ni forma de avisar a quien se
 * encontró la puerta cerrada. Eso necesita su propia spec.
 */

/** El titular de la pantalla. Es el mismo en los dos casos: la puerta está cerrada. */
export const REGISTRO_CERRADO_TITULO = 'El registro está cerrado ahora mismo';

/** El motivo, en una frase. Es la línea que ancla los tests de las dos mitades. */
export const REGISTRO_CERRADO_MOTIVO: Record<ClosedReason, string> = {
  manual:
    'Stockeiro está en pruebas y las altas se abren y se cierran a mano. Ahora mismo están cerradas, ' +
    'así que no se pueden crear cuentas nuevas.',
  capacity:
    'Stockeiro está en pruebas con un número limitado de cuentas y ese número ya está completo, ' +
    'así que no se pueden crear cuentas nuevas.',
};

/** Qué puede hacer quien lo lee. También distinto por motivo, por lo mismo de arriba. */
export const REGISTRO_CERRADO_QUE_HACER: Record<ClosedReason, string> = {
  manual:
    'Vuelve a intentarlo más adelante: cuando las altas se reabran, esta misma página te dejará ' +
    'crear la cuenta sin hacer nada especial.',
  capacity:
    'Las plazas se liberan cuando alguien borra su cuenta, así que vuelve a probar de vez en cuando. ' +
    'Mientras tanto puedes leer los términos y la política de privacidad para saber en qué consiste esto.',
};

/**
 * Lo que lee el OPERADOR en `/admin` al mover el grifo (CA-21).
 *
 * Vive aquí y no en `src/app/admin/actions.ts` por una razón mecánica que conviene
 * dejar escrita: un módulo `'use server'` **solo puede exportar funciones async**, así
 * que una constante compartida entre la acción y su test no cabe ahí. Que además
 * queden todos los textos del grifo en el mismo fichero es una ventaja, no la causa.
 */

/** El cupo que se rechaza (CA-21). Dice qué se acepta y que no se ha cambiado nada. */
export const CUPO_INVALIDO =
  'El cupo tiene que ser un número entero de cero o más, o quedar vacío para no poner tope. No se ha cambiado nada.';

/** Acuse del cambio. La pantalla enseña además el estado resultante. */
export const GRIFO_GUARDADO = 'Listo: el registro queda como se ve arriba.';
