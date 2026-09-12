import {
  LIMITE_ETIQUETA_CARACTERES,
  LIMITE_URL_CARACTERES,
} from '@/lib/config/limites-contexto';

/**
 * SPEC-063 CA-11 / CA-15 — **qué es un enlace aceptable, y cómo se presenta el que no
 * trae etiqueta**. Lógica PURA: ni base de datos, ni red.
 *
 * ## Por qué esto se parsea y no se «valida con una expresión regular»
 *
 * Porque el ataque no está en la forma de la cadena, está en **el esquema**: lo que hace
 * peligroso a `javascript:alert(1)` es que un `href` con ese esquema **ejecuta** al
 * pulsarlo, dentro de la sesión de su propio dueño. Una expresión regular que intente
 * describir «una URL buena» deja fuera direcciones legítimas —puertos, *query*, acentos en
 * la ruta— y sigue sin ver las variantes raras del esquema.
 *
 * Así que se **parsea con el mismo parser que usará el navegador** (`new URL`) y se
 * compara su `protocol` contra una **lista cerrada de permitidos**. Eso caza de un golpe
 * `JavaScript:`, ` javascript:` con espacios delante, `jAvAsCrIpT:` y `data:` — no porque
 * estén enumerados, sino porque **ninguno es `http` ni `https`**, que es la propiedad.
 *
 * La segunda dirección importa igual: un filtro que caza de más acaba **aflojado** por
 * quien se harta de que le rechace su enlace del foro. Por eso los especímenes de CA-11
 * incluyen lo que **no** debe rechazarse.
 *
 * ## Y por qué la app no visita lo que aquí se acepta
 *
 * Porque pedir desde el servidor una URL que escribe el usuario es **SSRF** —la red
 * interna de producción alcanzable escribiendo una dirección en un formulario— y además
 * un coste de red por fila. Está prohibido en EPIC-009 CE-4 y no se hace: ni para
 * validar, ni para sacar el título, ni para previsualizar. Este módulo **no importa
 * `fetch` y no lo llamará nunca**.
 */

/** Los dos únicos esquemas que un enlace puede tener. Cerrada a propósito. */
export const ESQUEMAS_PERMITIDOS = ['http:', 'https:'] as const;

/** Por qué se rechaza un enlace. Vocabulario del dominio, no del parser. */
export type MotivoEnlaceInvalido =
  | 'vacio'
  | 'no_es_una_direccion'
  | 'esquema_no_permitido'
  | 'demasiado_largo'
  | 'etiqueta_demasiado_larga';

export interface EnlaceNormalizado {
  url: string;
  label: string | null;
}

export type ResultadoDeEnlace =
  | { ok: true; enlace: EnlaceNormalizado }
  | { ok: false; motivo: MotivoEnlaceInvalido; detalle?: string };

/**
 * Texto para el usuario. Dice **qué pasa con lo que escribió**, no «error»: la misma
 * cortesía que SPEC-030 fijó para el alta manual — el mensaje distingue *lo que escribiste
 * no vale* de *algo ha fallado*.
 */
export const MOTIVO_ENLACE_TEXTO: Record<MotivoEnlaceInvalido, string> = {
  vacio: 'Escribe la dirección del enlace.',
  no_es_una_direccion:
    'Eso no parece una dirección web. Pega la dirección completa, empezando por https://',
  esquema_no_permitido: 'Solo se aceptan direcciones que empiecen por http:// o https://',
  demasiado_largo: `La dirección no puede pasar de ${LIMITE_URL_CARACTERES} caracteres.`,
  etiqueta_demasiado_larga: `La etiqueta no puede pasar de ${LIMITE_ETIQUETA_CARACTERES} caracteres.`,
};

/**
 * Normaliza lo que el usuario escribió, o dice por qué no vale (CA-11).
 *
 * El recorte de espacios va **antes** de parsear a propósito: `'  javascript:…'` con
 * espacios delante es el espécimen clásico con el que se cuela un esquema prohibido en un
 * filtro que mira el principio de la cadena en crudo.
 */
export function normalizarEnlace(urlBruta: string, etiquetaBruta?: string | null): ResultadoDeEnlace {
  const crudo = (urlBruta ?? '').trim();
  if (crudo === '') return { ok: false, motivo: 'vacio' };
  if (crudo.length > LIMITE_URL_CARACTERES) return { ok: false, motivo: 'demasiado_largo' };

  let parseada: URL;
  try {
    parseada = new URL(crudo);
  } catch {
    return { ok: false, motivo: 'no_es_una_direccion' };
  }

  if (!(ESQUEMAS_PERMITIDOS as readonly string[]).includes(parseada.protocol)) {
    return { ok: false, motivo: 'esquema_no_permitido', detalle: parseada.protocol };
  }

  const etiqueta = (etiquetaBruta ?? '').trim();
  if (etiqueta.length > LIMITE_ETIQUETA_CARACTERES) {
    return { ok: false, motivo: 'etiqueta_demasiado_larga' };
  }

  return {
    ok: true,
    // `href` es la forma canónica que devuelve el parser; guardar la cadena cruda dejaría
    // que dos escrituras de la misma dirección se vieran distintas.
    enlace: { url: parseada.href, label: etiqueta === '' ? null : etiqueta },
  };
}

/**
 * Con qué se presenta un enlace **sin etiqueta** (CA-15): su **dominio**, que es dato suyo.
 *
 * Ni una etiqueta inventada, ni «Enlace 1», ni la URL entera desbordando la caja. Es la
 * misma regla que SPEC-041 CA-3 aplicó al nombre del activo: sin dato no se inventa un
 * dato, se enseña lo único que sí se sabe.
 */
export function rotuloDeEnlace(enlace: { url: string; label: string | null }): string {
  const etiqueta = (enlace.label ?? '').trim();
  if (etiqueta !== '') return etiqueta;
  try {
    return new URL(enlace.url).hostname.replace(/^www\./, '');
  } catch {
    // No debería ocurrir —lo guardado pasó por `normalizarEnlace`—, pero enseñar la cadena
    // cruda es mejor que romper la fila de quien tenga una fila antigua.
    return enlace.url;
  }
}
