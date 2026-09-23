import { describe, it, expect } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VALOR_DE_MUESTRA,
  camposInventados,
  canonicales,
  locsDelSitemap,
  metaDescripcion,
  metaRobots,
  paginasPublicas,
  problemasDeCanonical,
  problemasDeIndexable,
  problemasDeNoIndexable,
  rutasDePagina,
  textoVisible,
} from './e2e/spec065';

/**
 * SPEC-065 CA-2, CA-3, CA-4, CA-8, CA-9 — las comprobaciones que la guardia e2e
 * (`tests/e2e/spec065-buscadores.spec.ts`) aplica al build real, puestas ROJAS aquí con
 * especímenes en los dos sentidos: lo que tienen que cazar y lo que no.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(rootDir, 'src', 'app');
const ORIGEN = 'https://stockeiro.example';

const pagina = (head: string, body = '') =>
  `<!DOCTYPE html><html><head>${head}</head><body>${body}` +
  // La carga RSC serializa los mismos metadatos: no puede contar como etiqueta.
  `<script>self.__next_f.push([1,"<meta name=\\"robots\\" content=\\"index\\"/>"])</script>` +
  `</body></html>`;

describe('SPEC-065 CA-2: el universo de páginas públicas se deriva del árbol', () => {
  it('centinela (pertenencia, no igualdad): contiene las públicas conocidas', () => {
    const publicas = paginasPublicas(APP);
    for (const r of ['/login', '/register', '/forgot-password', `/reset-password/${VALOR_DE_MUESTRA}`]) {
      expect(publicas, `el universo ha perdido ${r}`).toContain(r);
    }
  });

  it('los grupos de ruta no son segmentos, y lo privado no entra', () => {
    const todas = rutasDePagina(APP);
    expect(todas.some((r) => r.includes('('))).toBe(false);
    expect(todas).toContain('/dashboard');
    expect(paginasPublicas(APP)).not.toContain('/dashboard');
  });
});

describe('SPEC-065 CA-2: lo que no está en la lista se sirve con noindex', () => {
  it('no debe cazar: noindex, follow', () => {
    expect(problemasDeNoIndexable(pagina('<meta name="robots" content="noindex, follow"/>'))).toEqual([]);
  });
  it('no debe cazar: noindex, nofollow (reset-password)', () => {
    expect(problemasDeNoIndexable(pagina('<meta name="robots" content="noindex, nofollow"/>'))).toEqual([]);
  });
  it('debe cazar: sin meta robots (el `noindex` sólo vive en el script)', () => {
    expect(problemasDeNoIndexable(pagina('<title>x</title>'))).toHaveLength(1);
  });
  it('debe cazar: meta robots indexable', () => {
    expect(problemasDeNoIndexable(pagina('<meta name="robots" content="index, follow"/>'))).toHaveLength(1);
  });
});

describe('SPEC-065 CA-3: lo que está en la lista se deja indexar y dice su URL', () => {
  const buena = pagina(
    `<meta name="robots" content="index, follow"/><link rel="canonical" href="${ORIGEN}/ayuda"/>`,
  );
  it('no debe cazar: indexable con su canonical', () => {
    expect(problemasDeIndexable('/ayuda', buena, ORIGEN)).toEqual([]);
  });
  it('no debe cazar: la portada con el canonical sin barra final', () => {
    expect(
      problemasDeIndexable('/', pagina(`<link rel="canonical" href="${ORIGEN}"/>`), ORIGEN),
    ).toEqual([]);
  });
  it('debe cazar: noindex heredado', () => {
    const p = pagina(`<meta name="robots" content="noindex, follow"/><link rel="canonical" href="${ORIGEN}/ayuda"/>`);
    expect(problemasDeIndexable('/ayuda', p, ORIGEN)).toHaveLength(1);
  });
  it('debe cazar: nofollow', () => {
    const p = pagina(`<meta name="robots" content="index, nofollow"/><link rel="canonical" href="${ORIGEN}/ayuda"/>`);
    expect(problemasDeIndexable('/ayuda', p, ORIGEN)).toHaveLength(1);
  });
  it('debe cazar: sin canonical, y con dos', () => {
    expect(problemasDeIndexable('/ayuda', pagina(''), ORIGEN)).toHaveLength(1);
    const dos = pagina(
      `<link rel="canonical" href="${ORIGEN}/ayuda"/><link rel="canonical" href="${ORIGEN}/ayuda"/>`,
    );
    expect(problemasDeIndexable('/ayuda', dos, ORIGEN)).toHaveLength(1);
  });
  it('debe cazar: canonical de otro origen', () => {
    const p = pagina('<link rel="canonical" href="https://stockeiro-lemon.vercel.app/ayuda"/>');
    expect(problemasDeIndexable('/ayuda', p, ORIGEN)).toHaveLength(1);
  });
});

describe('SPEC-065 CA-4: ninguna página se declara copia de otra', () => {
  it('debe cazar: el canonical del layout raíz heredado por /ayuda', () => {
    const heredado = pagina(`<link rel="canonical" href="${ORIGEN}/"/>`);
    expect(problemasDeCanonical('/ayuda', heredado, ORIGEN)).toHaveLength(1);
  });
  it('no debe cazar: una página sin canonical', () => {
    expect(problemasDeCanonical('/login', pagina(''), ORIGEN)).toEqual([]);
  });
  it('no debe cazar: su propio canonical', () => {
    expect(
      problemasDeCanonical('/login', pagina(`<link rel="canonical" href="${ORIGEN}/login"/>`), ORIGEN),
    ).toEqual([]);
  });
});

describe('SPEC-065 CA-8: lectura del sitemap', () => {
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://a.example/</loc></url>' +
    '<url><loc>https://a.example/ayuda</loc></url></urlset>';
  it('lee los <loc>', () => {
    expect(locsDelSitemap(xml)).toEqual(['https://a.example/', 'https://a.example/ayuda']);
  });
  it('caza los campos inventados, y no los ve donde no están', () => {
    expect(camposInventados(xml)).toEqual([]);
    expect(camposInventados(xml.replace('</loc>', '</loc><lastmod>2026-01-01</lastmod>'))).toEqual([
      'lastmod',
    ]);
  });
});

describe('SPEC-065 CA-9: lectura del HTML sin JavaScript', () => {
  it('resuelve entidades y quita etiquetas, comentarios y scripts', () => {
    const html = pagina(
      '<meta name="description" content="Tú &amp; yo &#x27;así&#x27;"/>',
      '<p>No ejecuta <!-- -->órdenes,</p><p>de verdad</p>',
    );
    expect(metaDescripcion(html)).toEqual(["Tú & yo 'así'"]);
    expect(textoVisible(html)).toContain('No ejecuta órdenes, de verdad');
    expect(textoVisible(html)).not.toContain('__next_f');
    expect(metaRobots(html)).toEqual([]);
    expect(canonicales(html)).toEqual([]);
  });
});
