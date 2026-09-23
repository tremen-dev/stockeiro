import { ESQUEMAS_PERMITIDOS } from './enlace';

/**
 * SPEC-067 CA-10 — **qué enlaces de un símbolo se ofrecen como enlace al pintar**. Lógica
 * PURA: ni base de datos, ni red.
 *
 * ## Por qué se vuelve a mirar lo que ya se validó al guardar
 *
 * `normalizarEnlace` (SPEC-063 CA-11) ya rechaza cualquier esquema que no sea `http` o
 * `https` **al escribir**. Pero lo que llega a la página no tiene por qué haber pasado por
 * ahí: una fila anterior a esa validación, una escritura fuera del formulario, una
 * migración de datos. Y aquí el valor deja de ser texto y pasa a ser un `href` que el
 * navegador **ejecuta** al pulsarlo, dentro de la sesión de su dueño. Así que se vuelve a
 * decidir en el último sitio donde todavía se puede: defensa en profundidad.
 *
 * Con **la misma lista cerrada** (`ESQUEMAS_PERMITIDOS`) y **el mismo parser** que el
 * navegador (`new URL`): una segunda lista escrita a mano acabaría discrepando de la
 * primera, y entonces la fila ofrecería algo que el formulario rechaza — o al revés.
 *
 * ## Y por qué la app sigue sin visitar nada
 *
 * Decidir si un enlace es abrible es mirar su forma, no su destino. Este módulo no importa
 * ni llama a nada que salga a la red (EPIC-009 CE-4; SPEC-067 CA-11).
 */

/** `true` si el navegador puede abrir esto como una página web, y nada más. */
export function esAbrible(url: string): boolean {
  return hrefAbrible(url) !== null;
}

/**
 * El `href` que se pinta, o `null` si no se debe pintar ninguno.
 *
 * Es la forma canónica del parser —la misma que guarda `normalizarEnlace`—, no la cadena
 * cruda: así un `href` nunca lleva espacios delante ni un esquema en mayúsculas raras.
 */
function hrefAbrible(url: string): string | null {
  let parseada: URL;
  try {
    parseada = new URL((url ?? '').trim());
  } catch {
    return null;
  }
  return (ESQUEMAS_PERMITIDOS as readonly string[]).includes(parseada.protocol)
    ? parseada.href
    : null;
}

/**
 * Los enlaces que se ofrecen, **en el orden guardado** (SPEC-063 CA-2), cada uno con el
 * `href` que se puede pintar. Los que no son abribles desaparecen de la oferta: no se
 * pintan como texto muerto, porque el usuario no puede hacer nada con ellos desde la fila
 * y siguen visibles —y borrables— en la capa de edición.
 */
export function enlacesAbribles<T extends { url: string; label: string | null }>(
  enlaces: readonly T[],
): Array<T & { href: string }> {
  const abribles: Array<T & { href: string }> = [];
  for (const e of enlaces) {
    const href = hrefAbrible(e.url);
    if (href !== null) abribles.push({ ...e, href });
  }
  return abribles;
}

/**
 * El dominio de un enlace, sin `www.` (SPEC-063 CA-15): lo único que se sabe del destino
 * sin visitarlo. Sin puerto: el puerto no ayuda a reconocer un sitio.
 */
export function dominioDeEnlace(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
