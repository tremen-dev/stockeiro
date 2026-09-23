import { test, expect, type APIRequestContext } from '@playwright/test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appBaseUrl } from '../../src/lib/config/app-url';
import { DESCARGO_BREVE } from '../../src/lib/legal/content';
import { QUE_HACE, QUE_NO_HACE } from '../../src/lib/help/content';
import { RUTAS_INDEXABLES } from '../../src/lib/seo/indexables';
import { RUTAS_CON_POSICIONES, RUTAS_CON_SESION } from './rutas';
import { CUENTA_CON_FILAS, entrar } from './spec040';
import { ponerRol } from './roles';
import {
  VALOR_DE_MUESTRA,
  camposInventados,
  locsDelSitemap,
  metaDescripcion,
  paginasPublicas,
  problemasDeCanonical,
  problemasDeIndexable,
  problemasDeNoIndexable,
  textoVisible,
} from './spec065';

/**
 * SPEC-065 contra el build real (`next start` + Postgres efímero), pedido como lo pide un
 * rastreador: **sin cookies y sin ejecutar JavaScript** (`request`, no navegador).
 *
 *   CA-2  lo que no está en la lista se sirve con `noindex`, sin tener que decirlo
 *   CA-3  lo que está en la lista se deja indexar y dice cuál es su URL
 *   CA-4  ninguna página se declara copia de otra
 *   CA-6  `robots.txt` y `sitemap.xml` se alcanzan sin sesión y sin dejar rastro
 *   CA-8  el sitemap es la lista de D-1, en absoluto y sin inventar
 *   CA-9  el descargo llega en el HTML, sin JavaScript
 *
 * **Nada se teclea**: las rutas indexables salen de `RUTAS_INDEXABLES`, el universo de
 * páginas públicas se deriva del árbol de `src/app/`, las privadas son las que ya censa
 * `tests/e2e/rutas.ts`, el origen sale de `appBaseUrl()` y los textos de sus módulos.
 *
 * El servidor de e2e NO es producción (su identidad sale `unknown`), así que el
 * `robots.txt` servido aquí es el que veta todo: el mismo camino que un Preview. La rama
 * de producción se prueba en unitario sobre la ruta real (`tests/spec065-robots.test.ts`).
 *
 * La cuenta con sesión se reutiliza (`spec040-filas@example.com`): el grifo del e2e tiene
 * cupo, y una spec de presentación no gasta altas.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = join(rootDir, 'src', 'app');

/** El origen del build: el mismo que `tests/e2e/server.mjs` le pasa a la app. */
function origen(baseURL: string | undefined): string {
  return appBaseUrl({ APP_BASE_URL: process.env.APP_BASE_URL ?? baseURL } as unknown as NodeJS.ProcessEnv);
}

const INDEXABLES: readonly string[] = RUTAS_INDEXABLES;
const PUBLICAS_NO_INDEXABLES = paginasPublicas(APP).filter((r) => !INDEXABLES.includes(r));
const PRIVADAS = [...RUTAS_CON_SESION, ...RUTAS_CON_POSICIONES];

/** HTML servido a una petición, exigiendo que sea la página pedida y no un rebote. */
async function html(request: APIRequestContext, ruta: string): Promise<string> {
  const r = await request.get(ruta, { maxRedirects: 0 });
  expect(r.status(), `${ruta} no responde 200 (¿rebote a /login?)`).toBe(200);
  return r.text();
}

test.describe('CA-2: el universo tiene lo que tiene que tener', () => {
  test('centinela: al menos /login, /register, /forgot-password y un /reset-password/<token>', () => {
    for (const r of ['/login', '/register', '/forgot-password', `/reset-password/${VALOR_DE_MUESTRA}`]) {
      expect(PUBLICAS_NO_INDEXABLES, `el universo ha perdido ${r}`).toContain(r);
    }
    expect(PRIVADAS.length).toBeGreaterThan(0);
  });
});

test.describe('CA-2 y CA-4: páginas públicas fuera de la lista, sin cookies', () => {
  for (const ruta of PUBLICAS_NO_INDEXABLES) {
    test(`${ruta}: noindex, y ningún canonical ajeno`, async ({ request, baseURL }) => {
      const cuerpo = await html(request, ruta);
      expect(problemasDeNoIndexable(cuerpo), ruta).toEqual([]);
      expect(problemasDeCanonical(ruta, cuerpo, origen(baseURL)), ruta).toEqual([]);
    });
  }
});

test.describe('CA-2 y CA-4: páginas privadas, con sesión', () => {
  test('cada una sirve noindex, y ningún canonical ajeno', async ({ page, baseURL }) => {
    await entrar(page, CUENTA_CON_FILAS);
    // `/cartera` la ve sólo un usuario completo (ADR-021); sin el rol, sería un rebote.
    await ponerRol(CUENTA_CON_FILAS, 'completo');
    for (const ruta of PRIVADAS) {
      const cuerpo = await html(page.request, ruta);
      expect(problemasDeNoIndexable(cuerpo), ruta).toEqual([]);
      expect(problemasDeCanonical(ruta, cuerpo, origen(baseURL)), ruta).toEqual([]);
    }
  });
});

test.describe('CA-3 y CA-4: lo que está en la lista, sin cookies', () => {
  for (const ruta of INDEXABLES) {
    test(`${ruta}: indexable y con exactamente un canonical a sí misma`, async ({
      request,
      baseURL,
    }) => {
      const cuerpo = await html(request, ruta);
      expect(problemasDeIndexable(ruta, cuerpo, origen(baseURL)), ruta).toEqual([]);
    });
  }
});

test.describe('CA-6: robots.txt y sitemap.xml se alcanzan sin sesión y sin dejar rastro', () => {
  const casos: Array<[string, RegExp]> = [
    ['/robots.txt', /^text\/plain/],
    ['/sitemap.xml', /^(application|text)\/xml/],
  ];
  for (const [ruta, tipo] of casos) {
    test(`${ruta}: 200, su tipo y ninguna cookie de Auth.js`, async ({ request }) => {
      const r = await request.get(ruta, {
        maxRedirects: 0,
        headers: { accept: '*/*', 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' },
      });
      expect(r.status(), `${ruta} no responde 200`).toBe(200);
      expect(r.headers()['content-type'] ?? '').toMatch(tipo);
      const galletas = r
        .headersArray()
        .filter((h) => h.name.toLowerCase() === 'set-cookie')
        .map((h) => h.value);
      expect(galletas.filter((g) => /authjs\./i.test(g)), `${ruta} estampa authjs.*`).toEqual([]);
    });
  }

  test('el robots.txt del e2e es el de no producción: veta todo y no permite nada', async ({
    request,
  }) => {
    const cuerpo = await (await request.get('/robots.txt', { maxRedirects: 0 })).text();
    const lineas = cuerpo.split(/\r?\n/).map((l) => l.trim());
    expect(lineas).toContain('Disallow: /');
    expect(lineas.filter((l) => /^allow:/i.test(l))).toEqual([]);
    expect(lineas.filter((l) => /^sitemap:/i.test(l))).toEqual([]);
  });
});

test.describe('CA-8: el sitemap es la lista de D-1, en absoluto y sin inventar', () => {
  test('sus <loc> son exactamente las rutas indexables sobre appBaseUrl()', async ({
    request,
    baseURL,
  }) => {
    const base = origen(baseURL);
    const xml = await (await request.get('/sitemap.xml', { maxRedirects: 0 })).text();
    const locs = locsDelSitemap(xml);

    expect(new Set(locs)).toEqual(new Set(INDEXABLES.map((r) => new URL(r, base).href)));
    expect(locs).toHaveLength(new Set(locs).size);
    for (const loc of locs) {
      expect(new URL(loc).origin, loc).toBe(new URL(base).origin);
    }
    expect(camposInventados(xml)).toEqual([]);
  });
});

test.describe('CA-9: el descargo llega en el HTML, sin JavaScript', () => {
  test('la portada sin cookies trae el descargo, lo que no hace y su descripción', async ({
    request,
  }) => {
    const cuerpo = await html(request, '/');
    const texto = textoVisible(cuerpo);
    expect(texto).toContain(DESCARGO_BREVE);
    expect(texto).toContain(QUE_NO_HACE);
    expect(metaDescripcion(cuerpo)).toEqual([QUE_HACE]);
  });
});
