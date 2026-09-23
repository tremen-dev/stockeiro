import { dominioDeEnlace } from './abribles';
import { rotuloDeEnlace } from './enlace';
import type { ContextoDeSimbolo } from './service';

/**
 * SPEC-063 CA-10 — **lo que dice la señal de contexto, en palabras**.
 *
 * Vive aquí, en un módulo puro, y no junto a la celda que la pinta, por dos motivos: se
 * puede probar sin arrastrar media aplicación —la celda importa acciones de servidor, que
 * traen Auth.js detrás—, y deja claro que la frase es **del dominio** y no decoración de
 * una pantalla.
 *
 * Se escribe entera y no se compone de trozos («nota» + «2 enlaces») porque quien escucha
 * recibe **una frase**, no una lista de etiquetas sueltas — y porque el singular y el
 * plural de «enlace» no se resuelven concatenando.
 */
export function textoDeContexto(contexto: ContextoDeSimbolo): string {
  const enlaces = contexto.enlaces.length;
  const conEnlaces = enlaces === 1 ? 'y 1 enlace' : `y ${enlaces} enlaces`;
  if (contexto.note !== null) {
    return enlaces === 0 ? 'Tiene nota tuya' : `Tiene nota tuya ${conEnlaces}`;
  }
  return enlaces === 1 ? 'Tiene 1 enlace tuyo' : `Tiene ${enlaces} enlaces tuyos`;
}

/* ────────────────────────────────────────────────────────────────────────────
   SPEC-067 — **dos señales, no una**
   ────────────────────────────────────────────────────────────────────────────

   SPEC-063 pintaba una sola señal para la nota y los enlaces, con un lápiz. Con sólo
   enlaces, la fila enseñaba un lápiz — que se lee «nota» o «editar», nunca «enlace» — y la
   señal no hacía nada: abrir el enlace pedía tres gestos y una capa modal. SPEC-067 la
   parte en dos, y cada mitad dice lo suyo:

   - la de **nota** sigue siendo información (`role="img"`), y su frase no habla de enlaces;
   - la de **enlaces** es un control, y su nombre dice **adónde** lleva (1) o **cuántos**
     hay y de qué activo (≥ 2).

   `textoDeContexto`, arriba, se queda: es el resumen del bloque de contexto de la capa de
   edición (`contexto-form.tsx`), donde sí se habla de las dos cosas a la vez. */


/** La frase de la señal de nota. Una sola, y sin mencionar los enlaces: tienen la suya. */
export const TEXTO_SENAL_NOTA = 'Tiene nota tuya';

/** La frase de la señal de nota, o `null` si no hay nota — y entonces no hay señal. */
export function textoDeSenalDeNota(contexto: ContextoDeSimbolo): string | null {
  return contexto.note !== null ? TEXTO_SENAL_NOTA : null;
}

/**
 * SPEC-067 CA-4 — **adónde lleva un enlace, antes de pulsarlo**.
 *
 * Con etiqueta, la etiqueta **y** el dominio: la etiqueta la escribió el usuario y puede
 * decir cualquier cosa, el dominio es lo que de verdad se va a abrir. Sin etiqueta, el
 * dominio **una sola vez** —el rótulo de SPEC-063 CA-15 ya es el dominio— y nunca la URL
 * entera, que en un lector de pantalla es un minuto de ruido.
 *
 * Dice «tu enlace», en singular, a propósito: entre las dos señales de la fila el nombre
 * accesible tiene que contar que hay enlaces y cuántos (SPEC-067 CA-14).
 */
export function destinoDeEnlace(enlace: { url: string; label: string | null }): string {
  const rotulo = rotuloDeEnlace(enlace);
  const dominio = dominioDeEnlace(enlace.url);
  const destino =
    rotulo.toLowerCase() === dominio.toLowerCase() ? dominio : `«${rotulo}» (${dominio})`;
  return `Abrir tu enlace ${destino} en una pestaña nueva`;
}

/** SPEC-067 CA-5 — el nombre del control que abre la lista: cuántos, y de qué activo. */
export function nombreDeSenalDeEnlaces(cuantos: number, activo: string): string {
  return `Elegir entre tus ${cuantos} enlaces de ${activo}`;
}

/** SPEC-067 CA-5 / ADR-030 §2 — el nombre de la capa: el activo y su mercado. */
export function tituloDeCapaDeEnlaces(activo: string): string {
  return `Enlaces de ${activo}`;
}
