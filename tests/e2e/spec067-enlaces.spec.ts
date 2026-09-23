import { mkdirSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { DB_URL } from './roles';
import {
  ANCHOS,
  ANCHOS_TARJETA,
  BREAKPOINT_MODO_PX,
  TOLERANCIA_PX,
  describirAreaTactil,
  describirRespuestaAlGesto,
  describirViolaciones,
  inyectarDefecto,
  medirAreaTactil,
  medirContrasteDeControl,
  medirDesbordeDeDocumento,
  medirDesbordePorElemento,
  medirIntegridadDePalabra,
  medirOverflowHorizontal,
  medirPropiedadesComputadas,
  medirRespuestaAlGesto,
  medirSuelosTipograficos,
  ponerVentana,
} from './geometria';
import { entrar, sembrarVigiladas, type FilaSembrada } from './spec041';
import { afirmarListaLarga, filas, listaLarga, medirPrecondicion, posiciones, subirDelTodo } from './spec046';

/**
 * SPEC-067 — **el enlace se abre desde la fila**.
 *
 * Lo puro (qué es abrible, qué frase dice cada señal) está en
 * `tests/spec067-senales.test.ts`. Aquí, lo que sólo se ve en un navegador: las dos señales
 * en las dos formas de la descripción única (tabla ≥ 720 px y tarjeta < 720 px, ADR-034),
 * el enlace que se abre en una pestaña nueva, la capa de varios enlaces con las
 * obligaciones de ADR-030, el teclado, y la geometría con el módulo compartido.
 *
 * **Nada sale a Internet.** Los destinos son dominios `*.example.com` y la navegación de
 * la pestaña nueva se intercepta en el contexto y se responde en local.
 */

const CUENTA = 'spec067-enlaces@example.com';
const SHOTS = '_qa/SPEC-067';
const MERCADO = 'BME';

/* ────────────────────────────────────────────────────────────────────────────
   Escenario — tickers `Z9`, exclusivos de esta spec (el registro es compartido)
   ──────────────────────────────────────────────────────────────────────────── */

const vigilada = (ticker: string, name: string, price = '30'): FilaSembrada => ({
  ticker,
  micCode: 'BMEX',
  name,
  instrumentType: 'Common Stock',
  buyMin: '20',
  buyMax: '25',
  price,
});

const ESCENARIO: FilaSembrada[] = [
  vigilada('Z9PELADA', 'Sin Contexto SA'),
  vigilada('Z9NOTA', 'Solo Nota SA'),
  vigilada('Z9UNO', 'Un Enlace SA'),
  // En zona de compra: su fila lleva el tinte más claro, que es donde el contraste del
  // glifo de enlaces se juega de verdad (CA-13).
  vigilada('Z9VARIOS', 'Nota y Enlaces SA', '22'),
  vigilada('Z9MALO', 'Esquemas Prohibidos SA'),
  vigilada('Z9MEZCLA', 'Mezcla SA'),
];

interface EnlaceSembrado {
  url: string;
  label: string | null;
}

const UNO: EnlaceSembrado = { url: 'https://foro.example.com/hilo', label: null };

const VARIOS: EnlaceSembrado[] = [
  { url: 'https://www.tesis.example.com/q3', label: 'Tesis Q3' },
  { url: 'https://foro.example.com/hilo/9', label: 'Hilo del foro' },
  { url: 'https://graficos.example.com/z9', label: null },
];

/** Valores que NO pasaron por el formulario: una fila antigua, una escritura a mano. */
const MALO: EnlaceSembrado[] = [
  { url: 'javascript:alert(1)', label: 'Pulsa' },
  { url: 'data:text/html,<script>alert(1)</script>', label: null },
];

const MEZCLA: EnlaceSembrado[] = [
  { url: 'https://uno.example.com/a', label: 'Uno' },
  { url: 'JavaScript:alert(document.cookie)', label: 'Trampa' },
  { url: 'https://dos.example.com/b', label: 'Dos' },
];

const CONTEXTO: Record<string, { nota?: string; enlaces?: EnlaceSembrado[] }> = {
  Z9NOTA: { nota: 'La sigo por el dividendo.' },
  Z9UNO: { enlaces: [UNO] },
  Z9VARIOS: { nota: 'Tesis larga.', enlaces: VARIOS },
  Z9MALO: { nota: 'Con enlaces que no se pueden abrir.', enlaces: MALO },
  Z9MEZCLA: { enlaces: MEZCLA },
};

async function conSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/**
 * Deja a la cuenta con EXACTAMENTE este contexto. Escribe directo en la base, sin pasar
 * por el formulario, a propósito: es lo único que permite sembrar un `javascript:` —el
 * formulario lo rechaza (SPEC-063 CA-11)— y comprobar que al PINTAR tampoco se ofrece.
 */
async function sembrarContexto(
  email: string,
  contexto: Record<string, { nota?: string; enlaces?: EnlaceSembrado[] }>,
): Promise<void> {
  await conSql(async (sql) => {
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    await sql`DELETE FROM symbol_notes WHERE user_id = ${u.id}`;
    await sql`DELETE FROM symbol_links WHERE user_id = ${u.id}`;
    for (const [ticker, c] of Object.entries(contexto)) {
      const [s] = await sql`SELECT id FROM symbols WHERE ticker = ${ticker} AND mic_code = 'BMEX'`;
      if (c.nota) {
        await sql`INSERT INTO symbol_notes (user_id, symbol_id, note) VALUES (${u.id}, ${s.id}, ${c.nota})`;
      }
      for (const [i, e] of (c.enlaces ?? []).entries()) {
        await sql`
          INSERT INTO symbol_links (user_id, symbol_id, url, label, position)
          VALUES (${u.id}, ${s.id}, ${e.url}, ${e.label}, ${i})`;
      }
    }
  });
}

/**
 * La pestaña nueva se responde EN LOCAL: ningún test de esta spec sale a Internet. Se
 * registra cada petición a un dominio del usuario, para CA-11.
 */
async function interceptarDestinos(context: BrowserContext): Promise<string[]> {
  const pedidas: string[] = [];
  await context.route(/^https?:\/\/([a-z0-9-]+\.)*example\.com\//, (route) => {
    pedidas.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><title>destino</title><p>destino local</p>',
    });
  });
  return pedidas;
}

async function preparar(page: Page): Promise<string[]> {
  const pedidas = await interceptarDestinos(page.context());
  await entrar(page, CUENTA);
  await sembrarVigiladas(CUENTA, ESCENARIO);
  await sembrarContexto(CUENTA, CONTEXTO);
  await page.goto('/vigiladas');
  await page.locator('table.data-table').waitFor({ state: 'visible' });
  return pedidas;
}

type Forma = 'tabla' | 'tarjeta';
const FORMAS: Array<{ forma: Forma; ancho: number }> = [
  { forma: 'tabla', ancho: 1280 },
  { forma: 'tarjeta', ancho: 390 },
];
const asa = (base: string, forma: Forma) => (forma === 'tabla' ? base : `${base}-tarjeta`);

/** La fila (tabla) o la tarjeta de un ticker. */
const fila = (page: Page, ticker: string, forma: Forma): Locator =>
  (forma === 'tabla'
    ? page.locator('table.data-table tbody tr')
    : page.locator('ul[data-testid="tarjetas-vigiladas"] > li')
  ).filter({ has: page.locator('.ticker', { hasText: new RegExp(`^${ticker}`) }) });

const senalNota = (page: Page, ticker: string, forma: Forma = 'tabla') =>
  fila(page, ticker, forma).getByTestId(asa('nota-senal', forma));
const senalEnlaces = (page: Page, ticker: string, forma: Forma = 'tabla') =>
  fila(page, ticker, forma).getByTestId(asa('enlaces-senal', forma));
const capa = (page: Page) => page.getByTestId('enlaces-capa');
const enlacesDeLaCapa = (page: Page) => capa(page).getByTestId('enlaces-capa-enlace');

const esElFoco = (el: Locator) => el.evaluate((n) => n === document.activeElement);

/** Pulsa y espera la pestaña nueva, que se abre en el CONTEXTO (con `noopener` no hay `opener`). */
async function pulsarYEsperarPestana(page: Page, gesto: () => Promise<void>): Promise<Page> {
  const [nueva] = await Promise.all([page.context().waitForEvent('page'), gesto()]);
  await nueva.waitForLoadState('domcontentloaded');
  return nueva;
}

/* ────────────────────────────────────────────────────────────────────────────
   Rebanada 1 — nota y enlaces, cada uno con su señal
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('SPEC-067 CA-1: dos señales distintas, las cuatro combinaciones', () => {
  for (const { forma, ancho } of FORMAS) {
    test(`en ${forma} (${ancho} px)`, async ({ page }) => {
      await preparar(page);
      await ponerVentana(page, ancho);

      // Sin contexto: ni marca ni hueco — la caja del ticker no tiene ni un elemento dentro.
      await expect(fila(page, 'Z9PELADA', forma)).toHaveCount(1);
      await expect(senalNota(page, 'Z9PELADA', forma)).toHaveCount(0);
      await expect(senalEnlaces(page, 'Z9PELADA', forma)).toHaveCount(0);
      expect(
        await fila(page, 'Z9PELADA', forma).locator('.ticker').evaluate((el) => el.childElementCount),
        'la fila sin contexto tiene algo pegado al ticker',
      ).toBe(0);

      // Sólo nota: la de nota y NO la de enlaces.
      await expect(senalNota(page, 'Z9NOTA', forma)).toBeVisible();
      await expect(senalEnlaces(page, 'Z9NOTA', forma)).toHaveCount(0);

      // Sólo enlaces: la de enlaces y NO la de nota (hoy enseñaba un lápiz).
      await expect(senalEnlaces(page, 'Z9UNO', forma)).toBeVisible();
      await expect(senalNota(page, 'Z9UNO', forma)).toHaveCount(0);

      // Las dos.
      await expect(senalNota(page, 'Z9VARIOS', forma)).toBeVisible();
      await expect(senalEnlaces(page, 'Z9VARIOS', forma)).toBeVisible();

      // Dos elementos distintos, con glifos distintos.
      const nota = senalNota(page, 'Z9VARIOS', forma);
      const enlaces = senalEnlaces(page, 'Z9VARIOS', forma);
      expect(await nota.evaluate((n, otro) => n !== otro, await enlaces.elementHandle())).toBe(true);
      const glifoNota = await nota.evaluate((n) => n.innerHTML);
      const glifoEnlaces = await enlaces.locator('svg').evaluate((n) => n.outerHTML);
      expect(glifoNota).toContain('✎');
      expect(glifoEnlaces).not.toContain('✎');
      expect(await nota.locator('svg').count()).toBe(0);
    });
  }
});

test.describe('SPEC-067 CA-2: la señal de nota es información, no un control', () => {
  for (const { forma, ancho } of FORMAS) {
    test(`en ${forma} (${ancho} px)`, async ({ page }) => {
      await preparar(page);
      await ponerVentana(page, ancho);
      const nota = senalNota(page, 'Z9NOTA', forma);

      await expect(nota).toHaveAttribute('role', 'img');
      await expect(nota).toHaveAccessibleName('Tiene nota tuya');
      await expect(nota).toHaveAttribute('title', 'Tiene nota tuya');
      // No es alcanzable con Tab: ni es un control, ni tiene `tabindex`.
      expect(await nota.evaluate((n) => (n as HTMLElement).tabIndex)).toBeLessThan(0);
      expect(await nota.evaluate((n) => n.hasAttribute('tabindex'))).toBe(false);

      // Y no reacciona al clic: ni capa de edición, ni capa de enlaces, ni navegación.
      const antes = page.url();
      await nota.click();
      await expect(page.getByTestId('editar-panel')).toHaveCount(0);
      await expect(capa(page)).toHaveCount(0);
      expect(page.url()).toBe(antes);
      expect(page.context().pages()).toHaveLength(1);
    });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   Rebanada 2 — un enlace: un gesto
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('SPEC-067 CA-3/CA-4: con un enlace, la señal ES el enlace, y dice adónde lleva', () => {
  for (const { forma, ancho } of FORMAS) {
    test(`en ${forma} (${ancho} px)`, async ({ page }) => {
      await preparar(page);
      await ponerVentana(page, ancho);
      const senal = senalEnlaces(page, 'Z9UNO', forma);

      expect(await senal.evaluate((n) => n.tagName)).toBe('A');
      await expect(senal).toHaveAttribute('href', UNO.url);
      await expect(senal).toHaveAttribute('target', '_blank');
      const rel = (await senal.getAttribute('rel')) ?? '';
      expect(rel.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));

      // CA-4: nombre accesible y `title` dicen el destino y que se abre en pestaña nueva.
      const titulo = (await senal.getAttribute('title')) ?? '';
      await expect(senal).toHaveAccessibleName(titulo);
      expect(titulo).toContain('foro.example.com');
      expect(titulo).toMatch(/pestaña nueva/);
      expect(titulo).not.toContain(UNO.url);

      const antes = page.url();
      const nueva = await pulsarYEsperarPestana(page, () => senal.click());
      expect(nueva.url()).toBe(UNO.url);
      // `noopener`: la pestaña nueva no alcanza a la de origen.
      expect(await nueva.evaluate(() => window.opener)).toBeNull();
      await nueva.close();

      // La pestaña original sigue en /vigiladas, sin capa abierta.
      expect(page.url()).toBe(antes);
      await expect(page.getByTestId('editar-panel')).toHaveCount(0);
      await expect(capa(page)).toHaveCount(0);
    });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   Rebanada 3 — varios enlaces: se eligen en una capa
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('SPEC-067 CA-5: con varios, la señal abre la lista, con cuántos a la vista', () => {
  for (const { forma, ancho } of FORMAS) {
    test(`en ${forma} (${ancho} px)`, async ({ page }) => {
      await preparar(page);
      await ponerVentana(page, ancho);
      const senal = senalEnlaces(page, 'Z9VARIOS', forma);

      expect(await senal.evaluate((n) => n.tagName)).toBe('BUTTON');
      await expect(senal).toHaveAttribute('aria-haspopup', 'dialog');
      expect(await senal.getAttribute('aria-expanded')).toBeNull();
      await expect(senal).toContainText('3');
      const nombre = (await senal.getAttribute('aria-label')) ?? '';
      expect(nombre).toContain('3 enlaces');
      expect(nombre).toContain('Z9VARIOS');

      await senal.click();
      await expect(capa(page)).toBeVisible();
      expect(await capa(page).evaluate((d) => d.tagName === 'DIALOG' && d.matches(':modal'))).toBe(true);
      await expect(page.getByRole('dialog', { name: `Enlaces de Z9VARIOS · ${MERCADO}` })).toBeVisible();

      // Exactamente 3, en el orden guardado, cada uno con su rótulo y, debajo, su dominio.
      await expect(enlacesDeLaCapa(page)).toHaveCount(3);
      const hrefs = await enlacesDeLaCapa(page).evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      expect(hrefs).toEqual(VARIOS.map((e) => e.url));
      for (let i = 0; i < 3; i++) {
        const a = enlacesDeLaCapa(page).nth(i);
        await expect(a).toHaveAttribute('target', '_blank');
        const rel = (await a.getAttribute('rel')) ?? '';
        expect(rel.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
      }
      await expect(enlacesDeLaCapa(page).nth(0).getByTestId('enlaces-capa-rotulo')).toHaveText('Tesis Q3');
      await expect(enlacesDeLaCapa(page).nth(0).getByTestId('enlaces-capa-dominio')).toHaveText('tesis.example.com');
      await expect(enlacesDeLaCapa(page).nth(1).getByTestId('enlaces-capa-rotulo')).toHaveText('Hilo del foro');
      await expect(enlacesDeLaCapa(page).nth(1).getByTestId('enlaces-capa-dominio')).toHaveText('foro.example.com');
      // Sin etiqueta, el rótulo YA es el dominio (SPEC-063 CA-15): no se repite debajo.
      await expect(enlacesDeLaCapa(page).nth(2).getByTestId('enlaces-capa-rotulo')).toHaveText('graficos.example.com');
      await expect(enlacesDeLaCapa(page).nth(2).getByTestId('enlaces-capa-dominio')).toHaveCount(0);

      // «Debajo», medido: el dominio empieza donde acaba el rótulo, no a su lado.
      const [rot, dom] = await Promise.all([
        enlacesDeLaCapa(page).nth(0).getByTestId('enlaces-capa-rotulo').boundingBox(),
        enlacesDeLaCapa(page).nth(0).getByTestId('enlaces-capa-dominio').boundingBox(),
      ]);
      expect(dom!.y).toBeGreaterThanOrEqual(rot!.y + rot!.height - TOLERANCIA_PX);
    });
  }
});

test.describe('SPEC-067 CA-6: la capa se comporta como la de editar', () => {
  for (const { forma, ancho } of FORMAS) {
    test(`en ${forma} (${ancho} px)`, async ({ page }) => {
      await preparar(page);
      await ponerVentana(page, ancho);
      const senal = senalEnlaces(page, 'Z9VARIOS', forma);

      // (a) Escape.
      await senal.click();
      await expect(capa(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(capa(page)).toHaveCount(0);
      expect(await esElFoco(senal), 'tras Escape el foco no volvió a la señal').toBe(true);

      // (b) El botón de cerrar, visible.
      await senal.click();
      await expect(page.getByTestId('enlaces-capa-cerrar')).toBeVisible();
      await page.getByTestId('enlaces-capa-cerrar').click();
      await expect(capa(page)).toHaveCount(0);
      expect(await esElFoco(senal), 'tras Cerrar el foco no volvió a la señal').toBe(true);

      // (c) Activar un enlace: pestaña nueva con ESA URL, la capa se cierra y el foco vuelve.
      await senal.click();
      await expect(capa(page)).toBeVisible();
      const antes = page.url();
      const nueva = await pulsarYEsperarPestana(page, () => enlacesDeLaCapa(page).nth(1).click());
      expect(nueva.url()).toBe(VARIOS[1].url);
      await nueva.close();
      await expect(capa(page)).toHaveCount(0);
      expect(await esElFoco(senal), 'tras abrir un enlace el foco no volvió a la señal').toBe(true);
      expect(page.url()).toBe(antes);
    });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   Rebanada 4 — teclado, foco y no disparar otra cosa
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('SPEC-067 CA-8: se llega y se usa con teclado', () => {
  /** Tabula desde el principio del documento hasta `destino`, y devuelve lo que ha pisado. */
  async function tabularHasta(page: Page, destino: Locator, max = 120): Promise<string[]> {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator('body').focus();
    const pisados: string[] = [];
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      pisados.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          const fila = el?.closest('tr, li');
          const ticker = fila?.querySelector('.ticker')?.firstChild?.textContent ?? '';
          return `${ticker}:${el?.getAttribute('data-testid') ?? el?.tagName.toLowerCase()}`;
        }),
      );
      if (await esElFoco(destino)) return pisados;
    }
    throw new Error(`tras ${max} tabulaciones el foco no llegó a la señal: ${pisados.join(' → ')}`);
  }

  for (const { forma, ancho } of FORMAS) {
    test(`en ${forma} (${ancho} px)`, async ({ page }) => {
      await preparar(page);
      await ponerVentana(page, ancho);

      // Varios enlaces: la señal recibe el foco ANTES que «Editar» de su fila.
      const senal = senalEnlaces(page, 'Z9VARIOS', forma);
      const pisados = await tabularHasta(page, senal);
      expect(
        pisados.filter((p) => p.startsWith('Z9VARIOS:')),
        'en la fila, antes de la señal de enlaces, no debe haber otro control (la nota no lo es)',
      ).toEqual([`Z9VARIOS:${asa('enlaces-senal', forma)}`]);
      expect(pisados.some((p) => p.includes('nota-senal')), 'la señal de nota recibió el foco').toBe(false);

      // Con un anillo de foco visible.
      const [anillo] = await medirPropiedadesComputadas(
        page,
        `[data-testid="${asa('enlaces-senal', forma)}"]:focus-visible`,
        ['outline-style', 'outline-width'],
      );
      expect(anillo, 'la señal enfocada con teclado no casa `:focus-visible`').toBeDefined();
      expect(anillo.props['outline-style']).not.toBe('none');
      expect(parseFloat(anillo.props['outline-width'])).toBeGreaterThanOrEqual(2);

      // Y después, «Editar» de la misma fila.
      await page.keyboard.press('Tab');
      expect(await esElFoco(fila(page, 'Z9VARIOS', forma).getByTestId(asa('editar-zonas', forma)))).toBe(true);

      // Enter sobre la señal abre la capa con el foco en el primer enlace.
      await senal.focus();
      await page.keyboard.press('Enter');
      await expect(capa(page)).toBeVisible();
      expect(await esElFoco(enlacesDeLaCapa(page).first()), 'el foco no cayó en el primer enlace').toBe(true);
      await page.keyboard.press('Escape');
      await expect(capa(page)).toHaveCount(0);

      // Un enlace: Enter lo abre.
      const uno = senalEnlaces(page, 'Z9UNO', forma);
      await tabularHasta(page, uno);
      const nueva = await pulsarYEsperarPestana(page, () => page.keyboard.press('Enter'));
      expect(nueva.url()).toBe(UNO.url);
      await nueva.close();
    });
  }
});

test.describe('SPEC-067 CA-9: activar la señal no hace nada más', () => {
  for (const { forma, ancho } of FORMAS) {
    test(`en ${forma} (${ancho} px)`, async ({ page }) => {
      await preparar(page);
      await ponerVentana(page, ancho);

      // Un manejador en CADA fila y tarjeta: hoy no hay ninguno, y el test lo fija para
      // cuando lo haya. Se cuentan los clics que les llegan.
      await page.evaluate(() => {
        const w = window as unknown as { __clicsEnFila: number };
        w.__clicsEnFila = 0;
        for (const f of document.querySelectorAll('table.data-table tbody tr, ul[data-testid="tarjetas-vigiladas"] > li')) {
          f.addEventListener('click', () => (w.__clicsEnFila += 1));
        }
      });
      const clicsEnFila = () =>
        page.evaluate(() => (window as unknown as { __clicsEnFila: number }).__clicsEnFila);
      const orden = () =>
        page
          .locator(forma === 'tabla' ? 'table.data-table tbody tr .ticker' : 'ul[data-testid="tarjetas-vigiladas"] > li .ticker')
          .evaluateAll((ts) => ts.map((t) => t.firstChild?.textContent ?? ''));
      const ordenAntes = await orden();
      const antes = page.url();

      // Un enlace, con el ratón y con el teclado.
      let nueva = await pulsarYEsperarPestana(page, () => senalEnlaces(page, 'Z9UNO', forma).click());
      await nueva.close();
      await senalEnlaces(page, 'Z9UNO', forma).focus();
      nueva = await pulsarYEsperarPestana(page, () => page.keyboard.press('Enter'));
      await nueva.close();

      // Varios: abrir, elegir uno, y también cerrar sin elegir.
      await senalEnlaces(page, 'Z9VARIOS', forma).click();
      nueva = await pulsarYEsperarPestana(page, () => enlacesDeLaCapa(page).first().click());
      await nueva.close();
      await senalEnlaces(page, 'Z9VARIOS', forma).click();
      await page.getByTestId('enlaces-capa-cerrar').click();

      await expect(page.getByTestId('editar-panel')).toHaveCount(0);
      expect(page.url()).toBe(antes);
      expect(await orden()).toEqual(ordenAntes);
      expect(await clicsEnFila(), 'un clic en la señal o en su capa llegó al manejador de la fila').toBe(0);
    });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   Rebanada 5 — seguridad
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('SPEC-067 CA-10: sólo http/https se ofrecen como enlace, también al pintar', () => {
  for (const { forma, ancho } of FORMAS) {
    test(`en ${forma} (${ancho} px)`, async ({ page }) => {
      await preparar(page);
      await ponerVentana(page, ancho);

      // Ningún `href` que no sea http/https en lo que pintan las filas, las tarjetas y la
      // capa. (El pie lleva un `mailto:` de contacto que no es de esta spec.)
      const prohibidos = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('.activo-caja a[href], dialog.enlaces-capa a[href]')]
            .map((a) => a.getAttribute('href') ?? '')
            .filter((h) => !/^https?:/i.test(h.trim())),
        );
      expect(
        await page.locator('.activo-caja a[href], dialog.enlaces-capa a[href]').count(),
        'no hay ni un enlace en las filas: la guardia no mira nada',
      ).toBeGreaterThan(0);
      expect(await prohibidos()).toEqual([]);

      // Nada abrible: no hay señal de enlaces; la de nota sigue.
      await expect(senalEnlaces(page, 'Z9MALO', forma)).toHaveCount(0);
      await expect(senalNota(page, 'Z9MALO', forma)).toBeVisible();

      // Mezcla: se ofrecen los 2 abribles, en su orden, y la trampa no.
      const senal = senalEnlaces(page, 'Z9MEZCLA', forma);
      await expect(senal).toContainText('2');
      await senal.click();
      await expect(enlacesDeLaCapa(page)).toHaveCount(2);
      expect(
        await enlacesDeLaCapa(page).evaluateAll((as) => as.map((a) => a.getAttribute('href'))),
      ).toEqual([MEZCLA[0].url, MEZCLA[2].url]);
      await expect(capa(page)).not.toContainText('Trampa');
      expect(await prohibidos()).toEqual([]);
    });
  }
});

test('SPEC-067 CA-11: la app sigue sin visitar lo que el usuario pega', async ({ page }) => {
  const pedidas = await preparar(page);
  const delNavegador: string[] = [];
  page.on('request', (r) => delNavegador.push(r.url()));

  // Cargar la página y abrir la capa: ni una petición a un dominio del usuario.
  await page.reload();
  await page.locator('table.data-table').waitFor({ state: 'visible' });
  await senalEnlaces(page, 'Z9VARIOS').click();
  await expect(enlacesDeLaCapa(page)).toHaveCount(3);
  await page.waitForLoadState('networkidle');
  expect(pedidas, 'sin activar ningún enlace, alguien pidió un destino del usuario').toEqual([]);
  expect(delNavegador.filter((u) => /example\.com/.test(u))).toEqual([]);

  // La única que aparece es la navegación de la pestaña nueva, y sólo tras activar.
  const nueva = await pulsarYEsperarPestana(page, () => enlacesDeLaCapa(page).nth(1).click());
  await nueva.close();
  expect(pedidas).toEqual([VARIOS[1].url]);
  expect(delNavegador.filter((u) => /example\.com/.test(u)), 'la página de origen pidió el destino').toEqual([]);
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-7 — la respuesta cae donde está el usuario, y cabe
   ──────────────────────────────────────────────────────────────────────────── */

const CAPA_SEL = 'dialog[data-testid="enlaces-capa"]';
const SENAL_SEL = '[data-testid="enlaces-senal"], [data-testid="enlaces-senal-tarjeta"]';

test('SPEC-067 CA-7: M1, M2, M3 a los ocho anchos, M5 por debajo de 720, y la tabla no crece', async ({
  page,
}) => {
  test.slow();
  await preparar(page);
  mkdirSync(SHOTS, { recursive: true });
  const lineas: string[] = [];

  for (const ancho of ANCHOS) {
    await ponerVentana(page, ancho);
    const forma: Forma = ancho > BREAKPOINT_MODO_PX ? 'tabla' : 'tarjeta';

    // La fila con sus señales, sin capa.
    const m1Fila = await medirDesbordePorElemento(page, { testigos: SENAL_SEL });
    // M1 no mide dentro de un contenedor desplazado DE VERDAD (ADR-026 §4): a 730–760 px la
    // tabla se arrastra dentro de `.table-scroll` y lo que tiene que caber es el contenedor.
    // En el resto de anchos, las señales tienen que estar entre lo medido.
    const tablaArrastrada = (await medirOverflowHorizontal(page)).some(
      (c) => c.selector.startsWith('div.table-scroll') && c.hayQueArrastrar,
    );
    if (!tablaArrastrada) {
      expect(m1Fila.testigos, `a ${ancho} px M1 no midió ninguna señal de enlaces`).not.toEqual([]);
    }
    expect(m1Fila.violaciones, `a ${ancho} px: ${describirViolaciones(m1Fila)}`).toEqual([]);
    expect((await medirDesbordeDeDocumento(page)).desborde, `a ${ancho} px el documento desborda`).toBeLessThanOrEqual(
      TOLERANCIA_PX,
    );

    // La capa abierta: entra en la medida (testigo), no viola nada, no parte palabras.
    await senalEnlaces(page, 'Z9VARIOS', forma).click();
    await expect(capa(page)).toBeVisible();
    const m1 = await medirDesbordePorElemento(page, { testigos: CAPA_SEL });
    expect(m1.testigos, `a ${ancho} px la capa NO entró en M1 (ADR-030 §5)`).not.toEqual([]);
    expect(m1.violaciones, `a ${ancho} px con la capa: ${describirViolaciones(m1)}`).toEqual([]);
    const m2 = await medirDesbordeDeDocumento(page);
    expect(m2.desborde, `a ${ancho} px con la capa el documento desborda`).toBeLessThanOrEqual(TOLERANCIA_PX);
    const m3 = await medirIntegridadDePalabra(
      page,
      `${CAPA_SEL} .enlaces-capa-rotulo, ${CAPA_SEL} .enlaces-capa-dominio, ${CAPA_SEL} button`,
      CAPA_SEL,
    );
    expect(m3.length, `a ${ancho} px M3 no midió ningún texto de la capa`).toBeGreaterThan(0);
    expect(
      m3.filter((t) => t.lineas > t.palabras).map((t) => `${t.texto}: ${t.lineas}/${t.palabras}`),
      `a ${ancho} px la capa parte palabras`,
    ).toEqual([]);
    lineas.push(
      `${ancho} px · ${forma} · M1 fila=${m1Fila.violaciones.length} (testigos señal ` +
        `${m1Fila.testigos.length}${tablaArrastrada ? ', tabla arrastrada: mide el contenedor' : ''}) ` +
        `capa=${m1.violaciones.length} ` +
        `(testigos capa ${m1.testigos.length}) · M2 ${m2.desborde} · M3 textos=${m3.length}`,
    );

    // M5 por debajo del canto: la señal y cada enlace de la capa, ≥ 44 × 44 y sin solapes.
    if (ANCHOS_TARJETA.includes(ancho as (typeof ANCHOS_TARJETA)[number])) {
      const m5Capa = await medirAreaTactil(page, { raices: CAPA_SEL, testigos: '.enlaces-capa-enlace' });
      expect(m5Capa.testigos.length, `a ${ancho} px M5 no midió los enlaces de la capa`).toBe(3);
      expect(m5Capa.pequenos, `a ${ancho} px: ${describirAreaTactil(m5Capa)}`).toEqual([]);
      expect(m5Capa.solapes, `a ${ancho} px: ${describirAreaTactil(m5Capa)}`).toEqual([]);
      lineas.push(`  M5 capa · ${describirAreaTactil(m5Capa)}`);
    }
    await page.keyboard.press('Escape');
    await expect(capa(page)).toHaveCount(0);

    if (ANCHOS_TARJETA.includes(ancho as (typeof ANCHOS_TARJETA)[number])) {
      const m5 = await medirAreaTactil(page, {
        raices: 'ul[data-testid="tarjetas-vigiladas"]',
        testigos: '[data-testid="enlaces-senal-tarjeta"]',
      });
      expect(m5.testigos.length, `a ${ancho} px M5 no midió las señales de enlaces`).toBe(3);
      expect(m5.pequenos, `a ${ancho} px: ${describirAreaTactil(m5)}`).toEqual([]);
      expect(m5.solapes, `a ${ancho} px: ${describirAreaTactil(m5)}`).toEqual([]);
      lineas.push(`  M5 tarjetas · ${describirAreaTactil(m5)}`);
    }

    // La señal no añade columna y no ensancha la tabla: con y sin ella, el mismo contenido.
    if (forma === 'tabla') {
      const columnas = await page.locator('table.data-table thead th').count();
      expect(columnas, 'la señal añadió una columna').toBe(9);
      const ancho1 = (await medirOverflowHorizontal(page)).find((c) => c.selector.startsWith('div.table-scroll'));
      const quitar = await inyectarDefecto(page, '.enlaces-senal, .nota-senal { display: none !important }');
      const ancho0 = (await medirOverflowHorizontal(page)).find((c) => c.selector.startsWith('div.table-scroll'));
      await quitar();
      expect(ancho1, 'no se encontró `.table-scroll`').toBeDefined();
      expect(
        ancho1!.contenido - ancho0!.contenido,
        `a ${ancho} px las señales ensanchan la tabla: ${ancho0!.contenido} → ${ancho1!.contenido}`,
      ).toBeLessThanOrEqual(TOLERANCIA_PX);
      lineas.push(`  tabla · contenido sin señales=${ancho0!.contenido} con señales=${ancho1!.contenido}`);
    }
  }

  writeFileSync(`${SHOTS}/geometria.txt`, `SPEC-067 CA-7 — geometría\n${lineas.join('\n')}\n`, 'utf8');
});

test('SPEC-067 CA-7: con una lista larga de verdad, la capa cae dentro de la ventana (M4)', async ({ page }) => {
  test.slow();
  await interceptarDestinos(page.context());
  await entrar(page, CUENTA);
  await ponerVentana(page, 1280);

  // La lista larga se DERIVA: se dobla hasta que el fondo cae por debajo del pliegue.
  let total = 0;
  for (let n = 24; n <= 192; n *= 2) {
    await sembrarVigiladas(CUENTA, listaLarga(n));
    await page.goto('/vigiladas');
    await page.locator('table.data-table').waitFor({ state: 'visible' });
    const p = await medirPrecondicion(page);
    if (p.porDebajoDelPliegue > TOLERANCIA_PX) {
      total = p.elementos;
      break;
    }
  }
  expect(total, 'ni con 192 filas la lista es larga: el escenario dejó de ser una lista').toBeGreaterThan(0);

  // Tres enlaces en CADA vigilada de la cuenta: todas las filas tienen el botón.
  await conSql(async (sql) => {
    const [u] = await sql`SELECT id FROM users WHERE email = ${CUENTA}`;
    await sql`DELETE FROM symbol_notes WHERE user_id = ${u.id}`;
    await sql`DELETE FROM symbol_links WHERE user_id = ${u.id}`;
    for (const [i, host] of ['uno', 'dos', 'tres'].entries()) {
      await sql`
        INSERT INTO symbol_links (user_id, symbol_id, url, label, position)
        SELECT w.user_id, w.symbol_id, ${`https://${host}.example.com/`} || s.ticker, ${host}, ${i}
        FROM watched_symbols w JOIN symbols s ON s.id = w.symbol_id
        WHERE w.user_id = ${u.id}`;
    }
  });
  await page.goto('/vigiladas');
  mkdirSync(SHOTS, { recursive: true });
  const lineas: string[] = [];

  for (const ancho of ANCHOS) {
    await ponerVentana(page, ancho);
    await subirDelTodo(page);
    const precondicion = await afirmarListaLarga(page, ancho);

    for (const pos of posiciones(total)) {
      const disparador = filas(page).nth(pos.indice).locator(SENAL_SEL);
      const m4 = await medirRespuestaAlGesto(page, {
        disparador,
        revelado: capa(page),
        etiqueta: `${ancho} px · fila ${pos.nombre} (${pos.indice}) de ${precondicion.elementos}`,
      });
      expect(m4.viola, describirRespuestaAlGesto(m4)).toBe(false);
      lineas.push(describirRespuestaAlGesto(m4));
      await page.keyboard.press('Escape');
      await expect(capa(page)).toHaveCount(0);
      expect(await esElFoco(disparador), `a ${ancho} px el foco no volvió a la fila ${pos.nombre}`).toBe(true);
    }
  }

  writeFileSync(`${SHOTS}/m4-lista-larga.txt`, `SPEC-067 CA-7 — M4 en lista larga\n${lineas.join('\n')}\n`, 'utf8');

  // Deja la cuenta con su escenario corto para quien venga después.
  await sembrarVigiladas(CUENTA, ESCENARIO);
  await sembrarContexto(CUENTA, CONTEXTO);
});

/* ────────────────────────────────────────────────────────────────────────────
   Rebanada 6 — nivel profesional, con evidencia
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-067 CA-13: reposo, hover y foco se distinguen, el glifo contrasta, y capturas', async ({ page }) => {
  await preparar(page);
  mkdirSync(SHOTS, { recursive: true });
  const informe: string[] = [];

  for (const { forma, ancho } of FORMAS) {
    await ponerVentana(page, ancho);
    await page.mouse.move(0, 0);
    const testid = asa('enlaces-senal', forma);
    const sel = `[data-testid="${testid}"]`;
    const PROPS = ['color', 'background-color', 'border-top-color', 'outline-style'] as const;
    const leer = async () => (await medirPropiedadesComputadas(page, sel, PROPS))[0].props;

    // Reposo.
    const reposo = await leer();
    // Contraste no textual del glifo (WCAG 2.2 SC 1.4.11): ≥ 3:1 en cada señal de enlaces.
    const contrastes = await medirContrasteDeControl(page, sel);
    expect(contrastes.length, `en ${forma} no se midió ninguna señal`).toBeGreaterThanOrEqual(3);
    for (const c of contrastes) {
      expect(c.contraste, `${c.selector}: ${c.color} sobre ${c.fondo}`).toBeGreaterThanOrEqual(3);
    }
    informe.push(`${forma} · contraste del glifo: ${contrastes.map((c) => `${c.contraste}:1 sobre ${c.fondo}`).join(' · ')}`);

    // Hover.
    await senalEnlaces(page, 'Z9VARIOS', forma).hover();
    const leerHover = async () => (await medirPropiedadesComputadas(page, `${sel}:hover`, PROPS))[0]?.props;
    // La transición dura 120 ms: se espera a que el estado se asiente, no a un reloj.
    await expect
      .poll(async () => {
        const h = await leerHover();
        return !!h && h.color !== reposo.color && h['background-color'] !== reposo['background-color'];
      }, { message: `en ${forma} el hover no se distingue del reposo` })
      .toBe(true);
    const hover = (await leerHover())!;
    await page.mouse.move(0, 0);

    // Foco con teclado.
    await senalEnlaces(page, 'Z9VARIOS', forma).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const foco = (await medirPropiedadesComputadas(page, `${sel}:focus-visible`, PROPS))[0]?.props;
    expect(foco, `en ${forma} la señal no casa :focus-visible`).toBeDefined();
    expect(foco['outline-style']).not.toBe('none');
    expect(reposo['outline-style']).toBe('none');
    informe.push(`${forma} · reposo ${JSON.stringify(reposo)} · hover ${JSON.stringify(hover)} · foco ${JSON.stringify(foco)}`);

    // La nota sigue discreta: no es control y no se le exige 3:1.
    // Ningún texto de las señales baja de 12 px (ADR-034 §7), a ningún ancho: ni el número
    // de enlaces ni el glifo de la nota. Se mide la celda «Activo», que es lo que esta spec
    // toca; las cabeceras de la tabla de escritorio no son suyas.
    const suelos = await medirSuelosTipograficos(page, { raices: '.activo-caja' });
    expect(suelos.textos.some((t) => t.texto === '3'), 'no se midió el número de enlaces').toBe(true);
    expect(suelos.textos.some((t) => t.texto === '✎'), 'no se midió el glifo de la nota').toBe(true);
    expect(suelos.textos.filter((t) => t.tamano < 12).map((t) => `${t.selector} «${t.texto}» ${t.tamano}px`)).toEqual([]);

    // Capturas: la fila con las cuatro combinaciones, la señal en foco, la capa abierta.
    await page.screenshot({ path: `${SHOTS}/senales-foco-${ancho}.png`, fullPage: false });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.screenshot({ path: `${SHOTS}/fila-cuatro-combinaciones-${ancho}.png`, fullPage: true });
    await senalEnlaces(page, 'Z9VARIOS', forma).click();
    await expect(capa(page)).toBeVisible();
    const suelosCapa = await medirSuelosTipograficos(page, { raices: CAPA_SEL });
    expect(suelosCapa.textos.length).toBeGreaterThan(0);
    expect(suelosCapa.textos.filter((t) => t.tamano < 12).map((t) => `${t.selector} ${t.tamano}px`)).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/capa-enlaces-${ancho}.png`, fullPage: false });
    await page.keyboard.press('Escape');
    await expect(capa(page)).toHaveCount(0);
  }

  writeFileSync(`${SHOTS}/estados-y-contraste.txt`, `SPEC-067 CA-13\n${informe.join('\n')}\n`, 'utf8');
});
