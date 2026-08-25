import { MARCA } from '@/lib/legal/content';
import { ANCHO_MAXIMO, COLOR, PILA_DE_FUENTES } from './paleta';

/**
 * SPEC-056 D-1 — **un solo marco, tres cuerpos**.
 *
 * La cabecera y el pie se escriben **aquí y en ningún otro sitio**: los tres correos los
 * obtienen de la misma función. Tres copias del mismo bloque son tres sitios donde
 * diverger, y la copia que se quede vieja saldrá justo por la superficie que no admite
 * corrección después de enviada.
 *
 * El literal de marca y su URL se leen de `MARCA` (`src/lib/legal/content.ts`), que es la
 * misma constante que alimenta el pie de la app y `/legal/aviso-legal` (ADR-036 pto. 5,
 * CA-6). Aquí no se teclea «tremen.dev» ni «un proyecto de».
 *
 * **Este módulo es puro** (ADR-036 pto. 4): sin base de datos, sin Next, sin sesión y sin
 * ningún adaptador del puerto. La dependencia va en un solo sentido —correo → legal— y
 * `tests/spec056-plantillas.test.ts` recorre el grafo para comprobarlo (CA-3).
 *
 * **Y el correo no es la web** (D-5). Todo lo de abajo está escrito en el subconjunto que
 * sobrevive al motor de Word: maquetación por tablas anidadas marcadas `role="presentation"`,
 * todo el estilo en atributos `style` —Gmail poda las hojas del `<head>`—, cero `<img>`,
 * cero recurso externo y cero `position`, `float`, `flex` o `grid`. La lista completa de
 * construcciones prohibidas la enumera CA-9, y el test la comprueba sobre los tres HTML.
 */

/** Lo que una plantilla devuelve: el mensaje entero, con sus dos cuerpos (ADR-036 pto. 4). */
export interface CorreoCompuesto {
  /** Byte-idéntico al de hoy (CA-16): esta spec cambia el diseño, no el copy. */
  subject: string;
  /** Cuerpo en texto plano, completo y autosuficiente (ADR-036 pto. 2). */
  text: string;
  /** Cuerpo HTML. Viaja junto al texto, nunca en su lugar. */
  html: string;
}

/** Las piezas propias de un correo; lo demás lo pone el marco. */
export interface PiezasDelCorreo {
  subject: string;
  /**
   * Las líneas del cuerpo de texto **sin** la línea de marca: la añade el marco, y la
   * añade al final (D-6). Ese detalle no es estético: `tests/password-reset.test.ts`
   * toma la PRIMERA URL absoluta del cuerpo y afirma que es el enlace de reset. Poner
   * la marca por delante pondría en rojo una guardia que protege algo serio.
   */
  lineas: string[];
  /** Las filas de tabla propias de este correo, ya compuestas. */
  filas: string[];
}

/** Escapa lo que viene de datos. Un ticker no puede abrir una etiqueta. */
export function escapar(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FUENTE = `font-family:${PILA_DE_FUENTES};`;

/** El margen interior de todos los bloques. ≥ 24 px: a menos, el texto toca el borde. */
const SANGRADO = '28px';

/** Estilo de un párrafo del cuerpo. `line-height` en número, que Outlook sí respeta. */
export function parrafo(
  texto: string,
  opciones: { tamano?: number; color?: string; peso?: number; margenSuperior?: number } = {},
): string {
  const { tamano = 16, color = COLOR.hueso, peso = 400, margenSuperior = 0 } = opciones;
  return (
    `<p style="margin:${margenSuperior}px 0 0;${FUENTE}font-size:${tamano}px;` +
    `line-height:1.55;font-weight:${peso};color:${color};">${texto}</p>`
  );
}

/** Una fila de la tarjeta con su sangrado. */
export function fila(contenido: string, relleno = `24px ${SANGRADO}`): string {
  return `<tr><td style="padding:${relleno};">${contenido}</td></tr>`;
}

/**
 * D-3 — **la cabecera**, arbitrada por el humano el 2026-08-25: en una buena noticia el
 * ojo se queda arriba, así que la marca va también ahí y no solo en el pie.
 *
 * El wordmark es el mismo marcado que ya existe en `src/app/app-nav.tsx`: la palabra y un
 * punto en el color de acento. **Es texto, nunca una imagen** (D-2): la mayoría de
 * clientes bloquean las imágenes por defecto, así que una marca en imagen es —en la
 * primera lectura y para mucha gente— un hueco en blanco. Poner la marca en un recurso
 * que el cliente decide no descargar es no ponerla.
 */
function cabecera(): string {
  return (
    `<tr><td style="padding:26px ${SANGRADO} 22px;border-bottom:1px solid ${COLOR.filete};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="width:100%;border-collapse:collapse;">` +
    `<tr>` +
    `<td align="left" style="${FUENTE}font-size:20px;font-weight:700;letter-spacing:-0.02em;` +
    `color:${COLOR.hueso};">Stockeiro<span style="color:${COLOR.acento};">.</span></td>` +
    `<td align="right" style="${FUENTE}font-size:13px;color:${COLOR.apagado};">` +
    `<a href="${MARCA.url}" style="color:${COLOR.apagado};text-decoration:none;">` +
    `${escapar(MARCA.nombre)}</a></td>` +
    `</tr></table></td></tr>`
  );
}

/**
 * D-3 — **el pie**, con la fórmula que la app ya usa en todas sus páginas.
 *
 * Se descartó explícitamente el pie con reclamo comercial: lo que se quiere es presencia
 * de marca, no publicidad dentro de un correo transaccional. Un correo de recuperación de
 * contraseña que intenta vender servicios es un correo que se marca como spam, y llevarse
 * el dominio a la lista negra costaría los avisos de todo el mundo.
 */
function pie(): string {
  return (
    `<tr><td style="padding:20px ${SANGRADO} 26px;border-top:1px solid ${COLOR.filete};">` +
    `<a href="${MARCA.url}" style="${FUENTE}font-size:13px;line-height:1.55;` +
    `color:${COLOR.apagado};text-decoration:none;">${escapar(MARCA.linea)}</a>` +
    `</td></tr>`
  );
}

/**
 * D-9 — **el preheader**: el bloque oculto que el cliente enseña en la bandeja junto al
 * asunto. No se rellena con copy nuevo, que es la frontera de esta spec: es **la primera
 * línea del cuerpo de texto**, la misma que el correo ya dice. Sin él, el cliente rellena
 * ese hueco con lo primero que encuentra en el HTML, que suele ser basura de maquetación.
 */
function preheader(texto: string): string {
  return (
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;` +
    `font-size:1px;line-height:1px;color:${COLOR.lienzo};">${escapar(texto)}</div>`
  );
}

/**
 * El documento entero. `color-scheme` va declarado (CA-7) porque sin él el modo oscuro de
 * Apple Mail y Outlook **invierte** un diseño que ya es oscuro y lo deja ilegible.
 *
 * No hay ni un `<style>`: el contenedor es fluido por construcción (`width:100%` con
 * `max-width`), así que no hace falta una sola regla `@media` — y lo que no existe no lo
 * puede podar Gmail.
 */
function documento(subject: string, textoDelPreheader: string, filas: string[]): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark light">',
    '<meta name="supported-color-schemes" content="dark light">',
    `<title>${escapar(subject)}</title>`,
    '</head>',
    `<body style="margin:0;padding:0;background-color:${COLOR.lienzo};color:${COLOR.hueso};">`,
    preheader(textoDelPreheader),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
      `style="width:100%;border-collapse:collapse;background-color:${COLOR.lienzo};">`,
    '<tr><td align="center" style="padding:24px 12px;">',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
      `style="width:100%;max-width:${ANCHO_MAXIMO}px;border-collapse:collapse;` +
      `background-color:${COLOR.tarjeta};border-radius:14px;">`,
    cabecera(),
    ...filas,
    pie(),
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n');
}

/**
 * Compone el mensaje entero a partir de las piezas propias del correo.
 *
 * **Una sola función devuelve los dos cuerpos**, y es la mitigación que ADR-036 exige
 * contra su propia consecuencia negativa: dos cuerpos que dicen lo mismo pueden divergir,
 * y el modo en que divergen es que alguien toque uno y se olvide del otro. Aquí no hay dos
 * sitios que tocar.
 */
export function componer({ subject, lineas, filas }: PiezasDelCorreo): CorreoCompuesto {
  return {
    subject,
    // La marca cierra el texto (D-6). Nunca por delante del enlace de reset.
    text: [...lineas, '', MARCA.linea].join('\n'),
    html: documento(subject, lineas[0], filas),
  };
}
