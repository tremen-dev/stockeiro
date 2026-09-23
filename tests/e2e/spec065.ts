import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isPublicPath } from '../../src/lib/auth/guard';

/**
 * SPEC-065 — lo que un rastreador lee del HTML, y el universo de páginas que se le pide.
 *
 * Sin dependencias de Playwright a propósito: la guardia e2e lo importa para recorrer el
 * build real, y `tests/spec065-html.test.ts` lo importa para ponerlo ROJO con especímenes
 * en los dos sentidos sin arrancar un servidor (FOUNDATION, 2.º corolario). Una
 * comprobación que no se puede poner roja no es una guardia.
 */

/** Valor con el que se rellena un segmento dinámico (`[token]`, `[...x]`, `[[...x]]`). */
export const VALOR_DE_MUESTRA = 'muestra-spec065';

/**
 * Las rutas de página que declara el árbol de `src/app/`: cada `page.tsx`, con los grupos
 * de ruta fuera y un valor de muestra en cada segmento dinámico. Se DERIVA en cada
 * ejecución; una página nueva entra sola.
 */
export function rutasDePagina(appDir: string): string[] {
  const rutas: string[] = [];
  const recorrer = (dir: string, segmentos: string[]) => {
    for (const nombre of readdirSync(dir)) {
      const completo = join(dir, nombre);
      if (statSync(completo).isDirectory()) {
        if (nombre.startsWith('_')) continue; // carpeta privada: no es ruta
        if (/^\(.*\)$/.test(nombre)) recorrer(completo, segmentos);
        else if (/^\[.*\]$/.test(nombre)) recorrer(completo, [...segmentos, VALOR_DE_MUESTRA]);
        else recorrer(completo, [...segmentos, nombre]);
      } else if (nombre === 'page.tsx' || nombre === 'page.ts') {
        rutas.push('/' + segmentos.join('/'));
      }
    }
  };
  recorrer(appDir, []);
  return [...new Set(rutas)].sort();
}

/** Las que se piden sin cookies: públicas según `isPublicPath` (RN-03). */
export function paginasPublicas(appDir: string): string[] {
  return rutasDePagina(appDir).filter((r) => isPublicPath(r));
}

// ---------------------------------------------------------------------------
// Lectura del HTML servido, como lo lee un rastreador: sin ejecutar JavaScript.
// ---------------------------------------------------------------------------

/** El HTML sin `<script>` ni `<style>`: la carga RSC repite los metadatos serializados. */
function sinScripts(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

function atributos(etiqueta: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of etiqueta.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g)) {
    attrs[m[1].toLowerCase()] = decodificar(m[2]);
  }
  return attrs;
}

function etiquetas(html: string, nombre: string): Array<Record<string, string>> {
  const patron = new RegExp(`<${nombre}\\b[^>]*>`, 'gi');
  return [...sinScripts(html).matchAll(patron)].map((m) => atributos(m[0]));
}

export function decodificar(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Los `content` de cada `<meta name="robots">`. */
export function metaRobots(html: string): string[] {
  return etiquetas(html, 'meta')
    .filter((a) => (a.name ?? '').toLowerCase() === 'robots')
    .map((a) => a.content ?? '');
}

/** Los `href` de cada `<link rel="canonical">`. */
export function canonicales(html: string): string[] {
  return etiquetas(html, 'link')
    .filter((a) => (a.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'))
    .map((a) => a.href ?? '');
}

/** Los `content` de cada `<meta name="description">`. */
export function metaDescripcion(html: string): string[] {
  return etiquetas(html, 'meta')
    .filter((a) => (a.name ?? '').toLowerCase() === 'description')
    .map((a) => a.content ?? '');
}

/** El texto que ve quien no ejecuta JavaScript: sin etiquetas, con entidades resueltas. */
export function textoVisible(html: string): string {
  return decodificar(
    sinScripts(html)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

const directivas = (content: string) =>
  content
    .toLowerCase()
    .split(',')
    .map((d) => d.trim());

/** CA-2 — qué falla en una página que NO está en la lista. Vacío = lleva su `noindex`. */
export function problemasDeNoIndexable(html: string): string[] {
  const robots = metaRobots(html);
  if (robots.length === 0) return ['no lleva <meta name="robots">'];
  return robots.some((c) => directivas(c).includes('noindex'))
    ? []
    : [`su <meta name="robots"> no dice noindex: ${robots.join(' | ')}`];
}

/** CA-3 — qué falla en una página que SÍ está en la lista. Vacío = indexable y canónica. */
export function problemasDeIndexable(ruta: string, html: string, origen: string): string[] {
  const problemas: string[] = [];
  for (const c of metaRobots(html)) {
    const d = directivas(c);
    if (d.includes('noindex') || d.includes('nofollow') || d.includes('none')) {
      problemas.push(`su <meta name="robots"> la bloquea: ${c}`);
    }
  }
  const hrefs = canonicales(html);
  if (hrefs.length !== 1) {
    problemas.push(`lleva ${hrefs.length} <link rel="canonical"> y tiene que llevar exactamente uno`);
  }
  problemas.push(...problemasDeCanonical(ruta, html, origen));
  return problemas;
}

/** CA-4 — si una página lleva `canonical`, apunta a SU propia URL. Sin `canonical`, nada. */
export function problemasDeCanonical(ruta: string, html: string, origen: string): string[] {
  const propia = new URL(ruta, origen).href;
  const problemas: string[] = [];
  for (const href of canonicales(html)) {
    let absoluta: string;
    try {
      absoluta = new URL(href).href;
    } catch {
      problemas.push(`canonical no absoluto: «${href}»`);
      continue;
    }
    if (absoluta !== propia) problemas.push(`canonical apunta a ${absoluta} y la página es ${propia}`);
  }
  return problemas;
}

/** CA-8 — los `<loc>` del sitemap y lo que no debe llevar. */
export function locsDelSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((m) => decodificar(m[1]));
}

export function camposInventados(xml: string): string[] {
  return ['lastmod', 'changefreq', 'priority'].filter((c) => new RegExp(`<${c}\\b`).test(xml));
}
