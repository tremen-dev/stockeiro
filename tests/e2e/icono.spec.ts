import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Analisis,
  caja,
  centroide,
  enEsquina,
  imagenIcoDe,
  noOpacos,
  ojos,
  regionesConexas,
  seTocan,
  type Colores,
  type Raster,
} from '../icono-raster';

/**
 * SPEC-047 contra la app corriendo de verdad (`next start` + Postgres efímero).
 *
 * Cubre lo que sólo se ve con un servidor delante y un rasterizador de verdad:
 *
 *   CA-4  los `<link>` los emite Next desde la convención de fichero, y sólo una vez
 *   CA-6  un anónimo recibe el icono, no un desvío a `/login`
 *   CA-7  pedir el icono no estampa ninguna cookie
 *   CA-8  el icono no sabe quién lo pide: mismos bytes con sesión y sin ella
 *   CA-12 · CA-13 · CA-14  el SVG rasterizado a 16 px, medido píxel a píxel
 *   CA-15 los dos formatos son el mismo icono
 *
 * El `.ico` pasa CA-12…CA-14 en `tests/icono-16px.test.ts`, sin navegador; aquí se
 * repiten sobre él sólo dentro de CA-15, que es quien exige que **los dos** cumplan.
 *
 * Las URL no se teclean (R-4): se leen del documento que sirve el framework, porque es
 * él quien decide el hash de caché. Lo que se prueba es la propiedad —«lo que el
 * documento declara se puede pedir y devuelve una imagen»—, no una foto del árbol.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const icoPath = join(rootDir, 'src', 'app', 'favicon.ico');
const cssPath = join(rootDir, 'design', 'tremen-ds', 'colors_and_type.css');
/** Artefactos de trabajo: `.gitignore` los tapa, así que no pueden ensuciar el diff. */
const CAPTURAS = join(rootDir, 'test-results', 'SPEC-047');
/** Evidencia que SÍ se commitea. La única carpeta de `_qa/` que CA-16 admite. */
const EVIDENCIA = join(rootDir, '_qa', 'SPEC-047');
const PWD = 'clave-secreta-123';

/** Los tres colores, desde su fuente (CA-5), no tecleados aquí. */
function colores(): Colores {
  const css = readFileSync(cssPath, 'utf8');
  const leer = (selector: string, nombre: string): string => {
    const desde = css.indexOf(`${selector} {`);
    const bloque = css.slice(desde, css.indexOf('}', desde));
    const valor = new RegExp(`--${nombre}\\s*:\\s*([^;]+);`).exec(bloque)![1].trim();
    const alias = /^var\(\s*--([\w-]+)\s*\)$/.exec(valor);
    return alias ? leer(':root', alias[1]) : valor;
  };
  return {
    fondo: leer('.v-tremendo', 'bg'),
    hueso: leer(':root', 'bone'),
    acento: leer('.v-tremendo', 'accent'),
  };
}

type Enlace = { rel: string; href: string; type: string; sizes: string };

/** Los `<link rel="icon">` que el documento servido declara, tal cual. */
async function enlacesDeIcono(page: Page): Promise<Enlace[]> {
  return page.$$eval('link[rel~="icon"]', (nodos) =>
    nodos.map((n) => ({
      rel: n.getAttribute('rel') ?? '',
      href: n.getAttribute('href') ?? '',
      type: n.getAttribute('type') ?? '',
      sizes: n.getAttribute('sizes') ?? '',
    })),
  );
}

const elSvg = (enlaces: Enlace[]) => enlaces.filter((e) => e.type === 'image/svg+xml');
const elIco = (enlaces: Enlace[]) => enlaces.filter((e) => /favicon\.ico/.test(e.href));

/** Entra con una cuenta nueva. Cada test usa su correo: la base es única por ejecución. */
async function entrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

/**
 * Rasteriza el SVG a `lado`×`lado` DENTRO del navegador: se le fija el tamaño al
 * documento, se carga como imagen y se dibuja 1:1 en un `<canvas>` de ese lado. Fijar
 * `width`/`height` importa: sin eso el navegador rasterizaría a su tamaño natural (32)
 * y luego reescalaría el mapa de bits, que es justo lo que CA-15 quiere evitar.
 */
async function rasterDelSvg(page: Page, href: string, lado: number): Promise<Raster> {
  const datos = await page.evaluate(
    async ({ href, lado }) => {
      const texto = await (await fetch(href)).text();
      const ajustado = texto
        .replace(/width="\d+"/, `width="${lado}"`)
        .replace(/height="\d+"/, `height="${lado}"`);
      const img = new Image();
      await new Promise((listo, falla) => {
        img.onload = listo;
        img.onerror = falla;
        img.src = `data:image/svg+xml;base64,${btoa(ajustado)}`;
      });
      const lienzo = document.createElement('canvas');
      lienzo.width = lado;
      lienzo.height = lado;
      const ctx = lienzo.getContext('2d')!;
      ctx.clearRect(0, 0, lado, lado);
      ctx.drawImage(img, 0, 0, lado, lado);
      return Array.from(ctx.getImageData(0, 0, lado, lado).data);
    },
    { href, lado },
  );
  return { size: lado, data: new Uint8ClampedArray(datos) };
}

const analisisDelIco = (lado: number) =>
  new Analisis(imagenIcoDe(new Uint8Array(readFileSync(icoPath)), lado).raster, colores());

const cobertura = (an: Analisis) => (100 * an.puntos('H').length) / (an.size * an.size);

// ---------------------------------------------------------------------------

test.describe('CA-4: los <link> los pone Next desde la convención de fichero, y sólo una vez', () => {
  test('una página pública declara el SVG y el .ico, uno de cada', async ({ page }) => {
    await page.goto('/legal/aviso-legal');
    const enlaces = await enlacesDeIcono(page);

    expect(elSvg(enlaces), `enlaces: ${JSON.stringify(enlaces)}`).toHaveLength(1);
    expect(elIco(enlaces), `enlaces: ${JSON.stringify(enlaces)}`).toHaveLength(1);
    expect(enlaces).toHaveLength(2);
  });

  test('una página privada con sesión declara exactamente los mismos', async ({ page }) => {
    await entrar(page, 'ca4@example.com');
    await page.goto('/vigiladas');
    const enlaces = await enlacesDeIcono(page);

    expect(elSvg(enlaces)).toHaveLength(1);
    expect(elIco(enlaces)).toHaveLength(1);
    expect(enlaces).toHaveLength(2);
  });
});

test.describe('CA-6 y CA-7: el icono se alcanza sin sesión, y sin dejar rastro', () => {
  test('cada icono declarado responde 200 con tipo de imagen, no un 3xx a /login', async ({
    page,
    request,
  }) => {
    await page.goto('/legal/aviso-legal');
    const enlaces = await enlacesDeIcono(page);
    expect(enlaces.length).toBeGreaterThan(0);

    for (const enlace of enlaces) {
      const respuesta = await request.get(enlace.href, { maxRedirects: 0 });
      const tipo = respuesta.headers()['content-type'] ?? '';

      expect(respuesta.status(), `${enlace.href} no responde 200`).toBe(200);
      expect(new URL(respuesta.url()).pathname, 'el icono ha acabado en /login').not.toBe('/login');
      expect(tipo, `${enlace.href} sirve ${tipo}`).toMatch(
        /^image\/(svg\+xml|x-icon|vnd\.microsoft\.icon)/,
      );
      expect(tipo).not.toMatch(/text\/html/);
    }
  });

  test('ninguna respuesta del icono trae Set-Cookie', async ({ page, request }) => {
    await page.goto('/legal/aviso-legal');
    for (const enlace of await enlacesDeIcono(page)) {
      const respuesta = await request.get(enlace.href, { maxRedirects: 0 });
      const galletas = respuesta
        .headersArray()
        .filter((h) => h.name.toLowerCase() === 'set-cookie');
      expect(galletas, `${enlace.href} estampa cookie`).toEqual([]);
    }
  });

  test('recorrer /legal pidiendo el icono deja el contexto sin una sola cookie', async ({
    page,
    context,
  }) => {
    // La misma promesa que SPEC-035 CA-13, pero ahora la página además pide un icono:
    // si el `matcher` se dejara `icon.svg` dentro, Auth.js estamparía aquí sus dos
    // cookies y esto cantaría.
    for (const ruta of ['/legal', '/legal/aviso-legal', '/legal/privacidad', '/legal/terminos']) {
      await page.goto(ruta, { waitUntil: 'networkidle' });
    }
    expect(await context.cookies()).toEqual([]);
  });
});

test.describe('CA-8: el icono no sabe quién lo pide (RN-01, RN-03)', () => {
  test('los bytes servidos con sesión y sin ella son idénticos', async ({ page, request }) => {
    await entrar(page, 'ca8@example.com');
    await page.goto('/vigiladas');
    const enlaces = await enlacesDeIcono(page);
    expect(enlaces.length).toBeGreaterThan(0);

    for (const enlace of enlaces) {
      const conSesion = await page.request.get(enlace.href);
      const sinSesion = await request.get(enlace.href);
      expect(conSesion.status()).toBe(200);
      expect(sinSesion.status()).toBe(200);
      expect(
        Buffer.from(await conSesion.body()).equals(Buffer.from(await sinSesion.body())),
        `${enlace.href} sirve algo distinto según quién lo pida`,
      ).toBe(true);
    }
  });
});

test.describe('CA-12, CA-13 y CA-14: el SVG rasterizado a 16 px', () => {
  test('el punto sobrevive al tamaño y sigue siendo una cosa aparte', async ({ page }) => {
    await page.goto('/legal/aviso-legal');
    const href = elSvg(await enlacesDeIcono(page))[0].href;
    const an = new Analisis(await rasterDelSvg(page, href, 16), colores());

    expect(an.puntos('A').length, `\n${an.dibujo()}`).toBeGreaterThanOrEqual(6);
    expect(regionesConexas(an.puntos('A')).length, `\n${an.dibujo()}`).toBe(1);
    const c = centroide(an.puntos('A'));
    expect(c.x).toBeGreaterThan(7.5);
    expect(c.y).toBeGreaterThan(7.5);
    expect(seTocan(an, 'A', 'H'), `el punto y la letra se han fundido\n${an.dibujo()}`).toEqual([]);
  });

  test('la S conserva sus dos ojos, a 16 y a 32', async ({ page }) => {
    await page.goto('/legal/aviso-legal');
    const href = elSvg(await enlacesDeIcono(page))[0].href;

    const a16 = new Analisis(await rasterDelSvg(page, href, 16), colores());
    const o16 = ojos(a16, 1);
    expect(o16.superiores, `ojo superior cerrado a 16\n${a16.dibujo()}`).not.toEqual([]);
    expect(o16.inferiores, `ojo inferior cerrado a 16\n${a16.dibujo()}`).not.toEqual([]);

    const a32 = new Analisis(await rasterDelSvg(page, href, 32), colores());
    const o32 = ojos(a32, 2);
    expect(o32.superiores, `ojo superior cerrado a 32\n${a32.dibujo()}`).not.toEqual([]);
    expect(o32.inferiores, `ojo inferior cerrado a 32\n${a32.dibujo()}`).not.toEqual([]);
  });

  test('la tinta ocupa entre el 15 % y el 40 %, y el suelo es opaco', async ({ page }) => {
    await page.goto('/legal/aviso-legal');
    const href = elSvg(await enlacesDeIcono(page))[0].href;
    const an = new Analisis(await rasterDelSvg(page, href, 16), colores());

    expect(cobertura(an), `ni hilo ni bloque\n${an.dibujo()}`).toBeGreaterThanOrEqual(15);
    expect(cobertura(an), `ni hilo ni bloque\n${an.dibujo()}`).toBeLessThanOrEqual(40);
    // D-1: el icono trae su propio suelo. Sólo el redondeo (rx 6 sobre 32 = 3 px a 16)
    // puede no ser opaco; si hubiera transparencia en otro sitio, el icono heredaría el
    // color del cromo y el contraste medido en CA-11 dejaría de ser el que se ve.
    const fuera = noOpacos(an).filter((p) => !enEsquina(p, 16, 3));
    expect(fuera, `hay transparencia fuera del redondeo\n${an.dibujo()}`).toEqual([]);
    const c = caja([...an.puntos('H'), ...an.puntos('A')]);
    expect([c.x0 > 0, c.y0 > 0, c.x1 < 15, c.y1 < 15]).toEqual([true, true, true, true]);
  });
});

test.describe('CA-15: los dos formatos son el mismo icono', () => {
  test('el .ico cumple lo mismo que el SVG y su cobertura no difiere en más de 8 puntos', async ({
    page,
  }) => {
    await page.goto('/legal/aviso-legal');
    const href = elSvg(await enlacesDeIcono(page))[0].href;

    const svg16 = new Analisis(await rasterDelSvg(page, href, 16), colores());
    const ico16 = analisisDelIco(16);

    // CA-12 y CA-13 sobre el .ico, aquí mismo: CA-15 exige que los DOS cumplan.
    expect(ico16.puntos('A').length).toBeGreaterThanOrEqual(6);
    expect(regionesConexas(ico16.puntos('A')).length).toBe(1);
    expect(seTocan(ico16, 'A', 'H')).toEqual([]);
    expect(ojos(ico16, 1).superiores).not.toEqual([]);
    expect(ojos(ico16, 1).inferiores).not.toEqual([]);
    expect(cobertura(ico16)).toBeGreaterThanOrEqual(15);
    expect(cobertura(ico16)).toBeLessThanOrEqual(40);

    const diferencia = Math.abs(cobertura(svg16) - cobertura(ico16));
    expect(
      diferencia,
      `el SVG cubre ${cobertura(svg16).toFixed(1)} % y el .ico ${cobertura(ico16).toFixed(1)} %:` +
        ` han divergido\nSVG\n${svg16.dibujo()}\nICO\n${ico16.dibujo()}`,
    ).toBeLessThanOrEqual(8);
  });
});

test.describe('lo que los números no cubren: el icono, para mirarlo', () => {
  // §Notas para el gate, pto. 5: «pide la captura a 16 px en el gate del verificador y
  // mírala». El reparto lo fija CA-16 tras F-SPEC-047-1: los artefactos de trabajo van a
  // `test-results/SPEC-047/` (en `.gitignore`) y la evidencia que se COMMITEA va a
  // `_qa/SPEC-047/`, la única carpeta de `_qa/` que el diff admite.

  test('la evidencia: el icono sobre cromo claro y sobre cromo oscuro', async ({ page }) => {
    await page.goto('/legal/aviso-legal');
    const href = elSvg(await enlacesDeIcono(page))[0].href;
    const svg = await page.evaluate((h) => fetch(h).then((r) => r.text()), href);

    mkdirSync(CAPTURAS, { recursive: true });
    mkdirSync(EVIDENCIA, { recursive: true });
    writeFileSync(join(CAPTURAS, 'icon.svg'), svg);
    const fuente = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;

    await page.setContent(
      ['#F5F1EA', '#111110']
        .map(
          (fondo) =>
            `<div style="background:${fondo};padding:24px;display:flex;gap:24px;align-items:center">` +
            [16, 32, 64]
              .map((n) => `<img src="${fuente}" width="${n}" height="${n}" alt="">`)
              .join('') +
            `</div>`,
        )
        .join(''),
    );
    await page.screenshot({ path: join(EVIDENCIA, 'icono-cromo-claro-y-oscuro.png') });
    expect(await page.locator('img').count()).toBe(6);
  });

  test('la evidencia: los 16 px de los dos formatos, ampliados píxel a píxel', async ({ page }) => {
    // Lo que miden CA-12, CA-13 y CA-14, pero para un ojo humano: los mismos 256 píxeles
    // que cuentan los tests, ampliados ×16 y sin suavizar, con el SVG a la izquierda y el
    // `.ico` a la derecha — que es la comparación que hace CA-15.
    await page.goto('/legal/aviso-legal');
    const href = elSvg(await enlacesDeIcono(page))[0].href;
    const delSvg = await rasterDelSvg(page, href, 16);
    const delIco = imagenIcoDe(new Uint8Array(readFileSync(icoPath)), 16).raster;

    mkdirSync(EVIDENCIA, { recursive: true });
    await page.setContent(
      '<div id="hoja" style="background:#222;padding:24px;display:flex;gap:24px;' +
        'font:12px/1.6 system-ui;color:#F5F1EA"></div>',
    );
    await page.evaluate(
      ({ svg, ico }) => {
        const hoja = document.getElementById('hoja')!;
        for (const [rotulo, pixeles] of [
          ['icon.svg → 16×16', svg],
          ['favicon.ico → 16×16', ico],
        ] as const) {
          const lienzo = document.createElement('canvas');
          lienzo.width = 16;
          lienzo.height = 16;
          const datos = new ImageData(new Uint8ClampedArray(pixeles), 16, 16);
          lienzo.getContext('2d')!.putImageData(datos, 0, 0);
          lienzo.style.cssText =
            'width:256px;height:256px;image-rendering:pixelated;display:block';
          const caja = document.createElement('div');
          caja.append(lienzo, Object.assign(document.createElement('div'), { textContent: rotulo }));
          hoja.append(caja);
        }
      },
      { svg: Array.from(delSvg.data), ico: Array.from(delIco.data) },
    );
    await page.locator('#hoja').screenshot({ path: join(EVIDENCIA, 'icono-16px-ampliado.png') });
    expect(await page.locator('canvas').count()).toBe(2);
  });
});
