import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-051 contra la app corriendo de verdad (`next start` + Postgres efímero).
 *
 * Cubre lo que sólo se ve con un servidor delante:
 *
 *   CA-2  la primera pantalla sirve una tarjeta completa
 *   CA-3  las palabras son las de cada página, no las del layout
 *   CA-4  la URL de la imagen es absoluta y del propio origen
 *   CA-5  X enseña la tarjeta grande, con la misma imagen
 *   CA-14 un rastreador anónimo recibe la imagen, no un desvío a `/login`
 *   CA-15 pedir la imagen no estampa ninguna cookie
 *   CA-16 la imagen no sabe quién la pide
 *   CA-19 la primera pantalla sigue sin pedir nada fuera — y no pide la tarjeta
 *
 * **Las URL no se teclean** (CA-4, CA-14): se leen del documento que sirve el framework,
 * porque es él quien decide el hash de caché. Lo que se prueba es la propiedad —«lo que
 * el documento declara se puede pedir y devuelve un PNG»—, no una foto del árbol. Es la
 * misma disciplina de `tests/e2e/icono.spec.ts`.
 *
 * Y la mitad de CA-3 que importa se mide **sobre el HTML servido** y no sobre lo que el
 * framework promete (R-3): un `openGraph` declarado en el layout puede no recoger el
 * `title` de la página, y entonces todas las tarjetas dirían «Stockeiro» a secas.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Artefactos de trabajo: `.gitignore` los tapa, así que no pueden ensuciar el diff. */
const CAPTURAS = join(rootDir, 'test-results', 'SPEC-051');
const PWD = 'clave-secreta-123';

/** Todos los `<meta>` del documento servido, en orden y tal cual. */
async function metas(page: Page): Promise<Array<{ clave: string; valor: string }>> {
  return page.$$eval('head meta', (nodos) =>
    nodos
      .map((n) => ({
        clave: n.getAttribute('property') ?? n.getAttribute('name') ?? '',
        valor: n.getAttribute('content') ?? '',
      }))
      .filter((m) => m.clave !== ''),
  );
}

const valores = (lista: Array<{ clave: string; valor: string }>, clave: string) =>
  lista.filter((m) => m.clave === clave).map((m) => m.valor);

/** El valor único de un `<meta>` que tiene que aparecer UNA sola vez. */
function unico(lista: Array<{ clave: string; valor: string }>, clave: string): string {
  const encontrados = valores(lista, clave);
  expect(encontrados, `"${clave}" tiene que aparecer exactamente una vez`).toHaveLength(1);
  return encontrados[0];
}

/** Entra con una cuenta nueva. Cada test usa su correo: la base es única por ejecución. */
async function entrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

// ---------------------------------------------------------------------------

test.describe('CA-2: la primera pantalla sirve una tarjeta completa', () => {
  test('están los diez campos de Open Graph, y cada uno una sola vez', async ({ page }) => {
    await page.goto('/');
    const m = await metas(page);

    expect(unico(m, 'og:type')).toBe('website');
    expect(unico(m, 'og:site_name')).toBe('Stockeiro');
    expect(unico(m, 'og:locale')).toBe('es_ES');
    expect(unico(m, 'og:title').trim().length).toBeGreaterThan(0);
    expect(unico(m, 'og:description').trim().length).toBeGreaterThan(0);
    expect(unico(m, 'og:url')).toMatch(/^https?:\/\//);
    expect(unico(m, 'og:image')).toMatch(/^https?:\/\//);
    expect(unico(m, 'og:image:width')).toBe('1200');
    expect(unico(m, 'og:image:height')).toBe('630');
    expect(unico(m, 'og:image:type')).toBe('image/png');
    expect(
      unico(m, 'og:image:alt').trim().length,
      'un alt vacío promete accesibilidad y no la da',
    ).toBeGreaterThan(0);
  });
});

test.describe('CA-3: las palabras son las de cada página, no las del layout', () => {
  const PAGINAS = ['/', '/ayuda', '/legal/aviso-legal'];

  for (const ruta of PAGINAS) {
    test(`${ruta}: og:title y og:description coinciden con los de la página`, async ({ page }) => {
      await page.goto(ruta);
      const m = await metas(page);
      const titulo = await page.title();
      const descripcion = unico(m, 'description');

      expect(unico(m, 'og:title'), 'la tarjeta no dice lo que dice la pestaña').toBe(titulo);
      expect(unico(m, 'og:description')).toBe(descripcion);
    });
  }

  test('la primera pantalla anuncia su reclamo, no «Stockeiro» a secas', async ({ page }) => {
    // Es el fallo concreto que R-3 describe: si el `openGraph` del layout se llevara el
    // `title` del layout, TODAS las vistas previas dirían lo mismo y la que más se
    // comparte —la raíz— perdería justo la frase por la que alguien haría clic.
    await page.goto('/');
    const m = await metas(page);
    expect(unico(m, 'og:title')).not.toBe('Stockeiro');
    expect(unico(m, 'og:title')).toMatch(/zonas de compra y venta/i);
  });
});

test.describe('CA-4: la URL de la imagen es absoluta y del propio origen', () => {
  test('es absoluta, del origen que se está sirviendo, y no apunta a otro sitio', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/');
    const imagen = new URL(unico(await metas(page), 'og:image'));

    // Ningún rastreador resuelve una URL relativa, y una tarjeta que apunta a `localhost`
    // desde producción es peor que no tener tarjeta porque parece que funciona. La
    // propiedad se enuncia sin teclear el host: el origen de la imagen es EL MISMO que el
    // del documento que la declara, sea cual sea el despliegue.
    expect(imagen.protocol).toMatch(/^https?:$/);
    expect(imagen.origin).toBe(new URL(baseURL!).origin);
    expect(imagen.origin).toBe(new URL(page.url()).origin);
    expect(imagen.pathname).toMatch(/\.png$/);
  });
});

test.describe('CA-5: X enseña la tarjeta grande, con la misma imagen', () => {
  test('twitter:card es summary_large_image y reutiliza el og:image', async ({ page }) => {
    await page.goto('/');
    const m = await metas(page);

    expect(unico(m, 'twitter:card')).toBe('summary_large_image');
    expect(unico(m, 'twitter:title').trim().length).toBeGreaterThan(0);
    expect(unico(m, 'twitter:description').trim().length).toBeGreaterThan(0);
    expect(
      unico(m, 'twitter:image'),
      'no hay una segunda imagen: es un campo de metadatos, no un segundo dibujo',
    ).toBe(unico(m, 'og:image'));
  });
});

test.describe('CA-14 y CA-15: se alcanza sin sesión, y sin dejar rastro', () => {
  test('la URL que emite el framework responde 200 con image/png', async ({ page, request }) => {
    await page.goto('/');
    const href = unico(await metas(page), 'og:image');

    const respuesta = await request.get(href, { maxRedirects: 0 });
    expect(respuesta.status(), `${href} no responde 200`).toBe(200);
    expect(
      new URL(respuesta.url()).pathname,
      'la tarjeta ha acabado en /login: la vista previa saldría vacía y nadie vería el error',
    ).not.toBe('/login');
    const tipo = respuesta.headers()['content-type'] ?? '';
    expect(tipo, `la tarjeta sirve ${tipo}`).toMatch(/^image\/png/);
    expect(tipo).not.toMatch(/text\/html/);
  });

  test('y también sin cabecera Accept de navegador, que es como la pide un rastreador', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const href = unico(await metas(page), 'og:image');

    const respuesta = await request.get(href, {
      maxRedirects: 0,
      headers: { accept: '*/*', 'user-agent': 'facebookexternalhit/1.1' },
    });
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-type'] ?? '').toMatch(/^image\/png/);
  });

  test('pedir la imagen no trae Set-Cookie y el contexto sigue sin cookies', async ({
    page,
    context,
    request,
  }) => {
    await page.goto('/');
    const href = unico(await metas(page), 'og:image');

    const respuesta = await request.get(href, { maxRedirects: 0 });
    const galletas = respuesta.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie');
    expect(galletas, 'la tarjeta estampa cookie: ha entrado en el flujo de Auth.js').toEqual([]);

    await page.request.get(href);
    expect(await context.cookies()).toEqual([]);
  });
});

test.describe('CA-16: la imagen no sabe quién la pide (RN-01, RN-03)', () => {
  test('los bytes servidos con sesión y sin ella son idénticos', async ({ page, request }) => {
    await page.goto('/');
    const href = unico(await metas(page), 'og:image');
    const sinSesion = await request.get(href);

    await entrar(page, 'spec051@example.com');
    const conSesion = await page.request.get(href);

    expect(sinSesion.status()).toBe(200);
    expect(conSesion.status()).toBe(200);
    expect(
      Buffer.from(await conSesion.body()).equals(Buffer.from(await sinSesion.body())),
      'la tarjeta sirve algo distinto según quién la pida: es un estático, no un dato',
    ).toBe(true);
  });
});

test.describe('CA-19: la primera pantalla sigue sin pedir nada fuera', () => {
  test('todas las peticiones son del propio origen, y ninguna es la tarjeta', async ({
    page,
    baseURL,
  }) => {
    const ajenas: string[] = [];
    const pedidas: string[] = [];
    page.on('request', (peticion) => {
      const url = peticion.url();
      if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') return;
      pedidas.push(url);
      if (!url.startsWith(baseURL!)) ajenas.push(`${peticion.resourceType()} ${url}`);
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    expect(ajenas, `la primera pantalla carga recursos externos:\n${ajenas.join('\n')}`).toEqual([]);
    expect(
      pedidas.filter((u) => u.includes('opengraph-image')),
      'el navegador se ha descargado la tarjeta: un `<meta>` no provoca descarga, y ' +
        'cobrarle 16 KB a quien llega del foro para no enseñarle nada es lo contrario de ' +
        'lo que esta spec busca',
    ).toEqual([]);

    mkdirSync(CAPTURAS, { recursive: true });
    await page.screenshot({ path: join(CAPTURAS, 'primera-pantalla.png'), fullPage: true });
  });
});
