import { SECTION_LABEL, type Section } from './sections';

/**
 * Lo que se le dice a quien alcanza una sección que su rol no abre (SPEC-034 CA-8).
 *
 * Rebotar no es fallar. Las tres opciones eran 404 (finge que la sección no existe,
 * y miente: es la misma app), una pantalla de error propia en la misma URL, o el
 * rebote al panel con una nota. El gate eligió la tercera, así que lo que NO puede
 * pasar es que el usuario se quede con un error de Next, un 404 o una redirección
 * muda sin saber por qué se ha movido de sitio.
 *
 * Vive aquí, en un solo sitio, porque lo comparten dos caminos que deben decir lo
 * mismo: la nota del panel tras el rebote (CA-8) y el error que devuelve una server
 * action cerrada (CA-7).
 */

/** El motivo, en una línea. Es la frase que ancla los tests de las dos mitades. */
export const SECCION_NO_DISPONIBLE = 'no está disponible en la versión de pruebas';

/** La nota completa que lee quien acaba de rebotar al panel. */
export function notaDeRebote(section: Section): string {
  return `${SECTION_LABEL[section]} ${SECCION_NO_DISPONIBLE}.`;
}
