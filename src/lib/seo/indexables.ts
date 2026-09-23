/**
 * SPEC-065 D-1 — qué se deja indexar en un buscador, en UNA lista.
 *
 * Indexar es **opt-in**. El layout raíz declara `noindex` para todo (D-2) y cada ruta de
 * esta lista lo sustituye por uno indexable con su `canonical`. De aquí se derivan el
 * sitemap (`src/app/sitemap.ts`) y los metadatos de las páginas indexables; no hay una
 * segunda lista escrita a mano en ningún sitio.
 *
 * El fallo seguro es el buscado: una página nueva nace invisible para el buscador hasta
 * que alguien la añade aquí. Olvidarse cuesta visibilidad, nunca privacidad.
 *
 * `/legal/*` NO está, a propósito (D-3): el aviso legal publica el domicilio de una
 * persona física. La ley pide que sea accesible desde la web —y lo es, enlazado desde el
 * pie—, no que un buscador lo sirva a quien busque ese nombre.
 *
 * Módulo **puro**: sin Next, sin Auth.js, sin base de datos. Lo importan el sitemap, las
 * páginas y los tests (SPEC-065 CA-1).
 */
export const RUTAS_INDEXABLES = ['/', '/ayuda'] as const;

export type RutaIndexable = (typeof RUTAS_INDEXABLES)[number];

/**
 * Los metadatos que convierten una ruta de la lista en indexable: `robots` sustituye al
 * `noindex` heredado del layout y `canonical` dice cuál es su URL. El `canonical` va
 * relativo a propósito: lo vuelve absoluto el origen que el layout ya declara a partir de
 * `appBaseUrl()` (SPEC-051), y así no hay un segundo sitio que calcule el origen.
 *
 * El tipo es estructural y no `Metadata` de Next para que el módulo siga siendo puro.
 */
export function metadatosIndexables(ruta: RutaIndexable): {
  robots: { index: true; follow: true };
  alternates: { canonical: RutaIndexable };
} {
  return { robots: { index: true, follow: true }, alternates: { canonical: ruta } };
}
