import { test, expect, type Page } from '@playwright/test';
import { rolDe } from './roles';
import { afirmacionesProhibidasEn } from '../ayuda-afirmaciones-prohibidas';
import {
  CADENCIA_LINEA,
  MERCADOS,
  MERCADOS_EN_PROSA,
  MOTIVOS_SIN_PRECIO,
  QUE_HACE,
  VACIO_AVISOS,
  VACIO_PANEL,
  VACIO_VIGILADAS,
} from '../../src/lib/help/content';

/**
 * SPEC-039 — la ayuda, la primera pantalla, los estados vacíos y el feedback, contra
 * la app corriendo de verdad.
 *
 *   CA-1  /ayuda se lee sin cookie de sesión, y una ruta parecida no
 *   CA-2  la raíz explica qué hace la app y con qué cadencia; con sesión, al panel
 *   CA-3  la cadencia se dice en las TRES pantallas, con la misma frase
 *   CA-4  la zona: rango, opcional, extremos incluidos, la pone el usuario
 *   CA-5  aviso de entrada vs. agregado de permanencia, y la bandeja como fallback
 *   CA-6  los mercados que hay de verdad, ni uno más
 *   CA-7  ni una afirmación prohibida en el texto RENDERIZADO (pie incluido)
 *   CA-8  los seis motivos de «sin precio»
 *   CA-9  el estado vacío de Vigiladas, con el formulario a la vista
 *   CA-10 el estado vacío de Avisos, en sus dos variantes
 *   CA-11 el panel de quien acaba de llegar
 *   CA-12 el camino al feedback desde cualquier pantalla, y desde /ayuda
 *   CA-13 lo que se manda lleva la versión que responde /api/version
 *   CA-14 ni un recurso de terceros en las dos páginas públicas
 *   CA-15 el recorrido entero de CE-1, de la raíz a la primera vigilada
 *
 * ## ⚠️ El cupo del registro
 *
 * La base del e2e es UNA y la comparten todas las specs. La migración siembra el
 * grifo con **cupo 50** (SPEC-037 / ADR-023 pto. 7) y la suite entera registra del
 * orden de cuarenta y tantas cuentas: agotarlo rompería specs ajenas con un síntoma
 * —«no aparece el formulario de alta»— que no se parece en nada a la causa.
 *
 * Por eso este fichero da de alta **dos cuentas y solo dos**, prefijadas con
 * `spec039-`:
 *
 *  - `spec039-guia@example.com`, que se **reutiliza** en todos los tests y se deja
 *    SIEMPRE vacía (ni vigiladas ni avisos), porque es el escenario de CA-9 a CA-11;
 *  - `spec039-recorrido@example.com`, exclusiva de CA-15, que por definición tiene
 *    que registrarse de cero y acaba con una vigilada creada.
 *
 * Cada test de Playwright estrena contexto, así que hay que volver a entrar en cada
 * uno. Se pregunta a la BASE si la cuenta ya existe (`rolDe`) en vez de deducirlo de
 * lo que se vea en pantalla, que es lo que dejaba a SPEC-037 colgada en un «email ya
 * registrado». El fichero se llama `ayuda` y ordena después de `admin-*`, que es
 * quien deja el grifo abierto y sin tope al terminar.
 */

const SHOTS = '_qa/SPEC-039';
const PWD = 'clave-secreta-123';

/** La cuenta vacía que comparten todos los tests de estados vacíos. */
const GUIA = 'spec039-guia@example.com';
/** La del recorrido de CE-1. Se registra dentro del propio test, a mano. */
const RECORRIDO = 'spec039-recorrido@example.com';

const pie = (page: Page) => page.locator('footer.app-footer');

/** Entra con la cuenta compartida, registrándola solo la primera vez. */
async function entrarComoGuia(page: Page) {
  const yaExiste = (await rolDe(GUIA)) !== null;
  await page.goto(yaExiste ? '/login' : '/register');
  await page.fill('input[name="email"]', GUIA);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

/** El texto que de verdad lee una persona: el principal más el pie. */
const textoRenderizado = async (page: Page) =>
  `${await page.locator('main').innerText()}\n${await page.locator('footer').innerText()}`;

// ---------------------------------------------------------------------------
// CA-1 — la ayuda es pública
// ---------------------------------------------------------------------------

test.describe('CA-1: /ayuda se lee sin sesión', () => {
  test('responde su contenido sin redirigir a /login', async ({ page }) => {
    const respuesta = await page.goto('/ayuda');

    expect(respuesta?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/ayuda');
    await expect(page.locator('main h1')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/ca1-ayuda-sin-sesion.png`, fullPage: true });
  });

  test('una ruta que solo SE PARECE sigue exigiendo sesión', async ({ page }) => {
    for (const parecida of ['/ayudaX', '/ayuda-interna']) {
      await page.goto(parecida);
      expect(new URL(page.url()).pathname, `${parecida} no puede ser pública`).toBe('/login');
    }
  });

  test('y las rutas de datos tampoco se han abierto de rebote', async ({ page }) => {
    for (const ruta of ['/dashboard', '/vigiladas', '/avisos']) {
      await page.goto(ruta);
      expect(new URL(page.url()).pathname, `${ruta} se abrió sin sesión`).toBe('/login');
    }
  });
});

// ---------------------------------------------------------------------------
// CA-2 — la primera pantalla
// ---------------------------------------------------------------------------

test.describe('CA-2: la raíz atiende al visitante que llega del foro', () => {
  test('explica qué hace la app y con qué cadencia', async ({ page }) => {
    const respuesta = await page.goto('/');

    expect(respuesta?.status()).toBe(200);
    expect(new URL(page.url()).pathname, 'la raíz ya no rebota a /login').toBe('/');
    await expect(page.getByTestId('primera-pantalla')).toBeVisible();

    const texto = await page.locator('main').innerText();
    expect(texto).toContain(QUE_HACE);
    expect(texto, 'la cadencia tiene que estar en la PRIMERA pantalla (R-4)').toContain(
      CADENCIA_LINEA,
    );
    await page.screenshot({ path: `${SHOTS}/ca2-primera-pantalla.png`, fullPage: true });
  });

  test('ofrece los cuatro caminos: crear cuenta, entrar, la ayuda y lo legal', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.locator('a[href="/register"]')).toHaveCount(1);
    await expect(page.locator('a[href="/login"]')).toHaveCount(1);
    await expect(page.locator('a[href="/ayuda"]')).toHaveCount(1);
    // Lo legal se alcanza desde el propio texto y desde el pie compartido.
    expect(await page.locator('a[href^="/legal"]').count()).toBeGreaterThan(0);
  });

  test('los caminos llevan a donde dicen', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/ayuda"]').click();
    await page.waitForURL('**/ayuda');
    expect(new URL(page.url()).pathname).toBe('/ayuda');

    await page.goto('/');
    await page.locator('a[href="/register"]').click();
    await page.waitForURL('**/register');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('con sesión, la raíz sigue llevando al panel exactamente como antes', async ({ page }) => {
    await entrarComoGuia(page);

    await page.goto('/');
    await page.waitForURL('**/dashboard');
    expect(new URL(page.url()).pathname).toBe('/dashboard');
    await expect(page.getByTestId('primera-pantalla')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// CA-3 — la cadencia, tres veces
// ---------------------------------------------------------------------------

test('CA-3: la cadencia se dice en la raíz, en la ayuda y en el estado vacío de Vigiladas', async ({
  page,
}) => {
  // La primera pantalla, sin sesión.
  await page.goto('/');
  expect(await page.locator('main').innerText(), '/ sin cadencia').toContain(CADENCIA_LINEA);

  // La ayuda, sin sesión.
  await page.goto('/ayuda');
  expect(await page.locator('main').innerText(), '/ayuda sin cadencia').toContain(CADENCIA_LINEA);

  // Y el estado vacío de Vigiladas, que es donde alguien se queda mirando un precio
  // que no cambia. Nadie lee la ayuda antes de quejarse: por eso está aquí también.
  await entrarComoGuia(page);
  await page.goto('/vigiladas');
  await expect(page.getByTestId('vigiladas-vacio')).toBeVisible();
  expect(
    await page.getByTestId('vigiladas-vacio-cadencia').innerText(),
    '/vigiladas vacío sin cadencia',
  ).toContain(CADENCIA_LINEA);
});

// ---------------------------------------------------------------------------
// CA-4 a CA-8 — lo que la ayuda cuenta
// ---------------------------------------------------------------------------

test.describe('la ayuda cuenta el producto que hay', () => {
  test('CA-4: la zona es un rango, es opcional, incluye extremos y la pones tú', async ({
    page,
  }) => {
    await page.goto('/ayuda');
    const bloque = await page.getByTestId('ayuda-zonas').innerText();

    expect(bloque).toMatch(/rango/i);
    expect(bloque).toMatch(/m[ií]nimo/i);
    expect(bloque).toMatch(/m[aá]ximo/i);
    expect(bloque).toMatch(/no es un (valor|precio) (puntual|exacto)/i);
    expect(bloque).toMatch(/opcional/i);
    expect(bloque).toMatch(/inclu/i);
    expect(bloque).toMatch(/extremos/i);
    expect(bloque).toMatch(/no las calcula/i);
    await page.screenshot({ path: `${SHOTS}/ca4-ayuda-zonas.png`, fullPage: true });
  });

  test('CA-5: entrada vs. permanencia, y la bandeja aunque el correo falle', async ({ page }) => {
    await page.goto('/ayuda');
    const bloque = await page.getByTestId('ayuda-avisos').innerText();

    expect(bloque).toMatch(/aviso de entrada/i);
    expect(bloque).toMatch(/permanencia/i);
    expect(bloque).toMatch(/no se repite/i);
    expect(bloque).toMatch(/vuelve a entrar/i);
    expect(bloque).toMatch(/bandeja/i);
    expect(bloque).toMatch(/aunque el correo/i);
  });

  test('CA-6: los mercados de verdad, con su nombre de dominio y ni uno más', async ({ page }) => {
    await page.goto('/ayuda');
    const seccion = page.getByTestId('ayuda-mercados');

    // Uno por operating MIC soportado, ni más ni menos.
    await expect(seccion.locator('li[data-mic]')).toHaveCount(MERCADOS.length);
    for (const mercado of MERCADOS) {
      await expect(
        seccion.locator(`li[data-mic="${mercado.mic}"]`),
        `falta ${mercado.mic}`,
      ).toHaveText(mercado.nombre);
    }
    expect(await seccion.innerText()).toContain(MERCADOS_EN_PROSA.palabra);
    await page.screenshot({ path: `${SHOTS}/ca6-ayuda-mercados.png`, fullPage: true });
  });

  test('CA-8: los seis motivos de «sin precio», y el precio que se compara', async ({ page }) => {
    await page.goto('/ayuda');
    const seccion = page.getByTestId('ayuda-sin-precio');

    await expect(seccion.locator('[data-motivo]')).toHaveCount(MOTIVOS_SIN_PRECIO.length);
    for (const motivo of MOTIVOS_SIN_PRECIO) {
      await expect(
        seccion.locator(`[data-motivo="${motivo.id}"]`),
        `falta el motivo ${motivo.id}`,
      ).toHaveCount(1);
    }

    const precios = await page.getByTestId('ayuda-precios').innerText();
    expect(precios).toMatch(/[uú]ltimo precio de cierre/i);
    expect(precios).toMatch(/no ajustad/i);
    await page.screenshot({ path: `${SHOTS}/ca8-ayuda-sin-precio.png`, fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// CA-7 — y NADA de lo que D-1, D-2 y D-4 prohíben
// ---------------------------------------------------------------------------

test.describe('CA-7: ni una afirmación prohibida en el texto renderizado', () => {
  for (const ruta of ['/', '/ayuda']) {
    test(`${ruta} no promete lo que una decisión locked prohíbe`, async ({ page }) => {
      await page.goto(ruta);
      // Se analiza lo que lee una persona, pie incluido: el pie va en todas las
      // páginas y una promesa suya alcanzaría a estas dos igual que al resto.
      const violaciones = afirmacionesProhibidasEn(await textoRenderizado(page));

      expect(
        violaciones.map((v) => `${v.fragmento}\n   → ${v.motivo}`),
        `${ruta} dice algo prohibido`,
      ).toEqual([]);
    });

    test(`${ruta} sí dice, en negativo, que esto no es lo otro`, async ({ page }) => {
      // Callarse pasaría la guardia igual que mentir. R-4 exige lo contrario.
      await page.goto(ruta);
      expect(await page.locator('main').innerText()).toMatch(/no es tiempo real/i);
    });
  }
});

// ---------------------------------------------------------------------------
// CA-9, CA-10, CA-11 — estados vacíos que guían
// ---------------------------------------------------------------------------

test.describe('los estados vacíos señalan el paso siguiente', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComoGuia(page);
  });

  test('CA-9: Vigiladas — primer paso, ejemplo con números, cadencia y ayuda', async ({ page }) => {
    await page.goto('/vigiladas');
    const vacio = page.getByTestId('vigiladas-vacio');

    await expect(vacio).toBeVisible();
    expect(await vacio.innerText()).toContain(VACIO_VIGILADAS.primerPaso);
    // Un ejemplo CON NÚMEROS: «rango de precio» no le dice nada a nadie.
    expect(await page.getByTestId('vigiladas-vacio-ejemplo').innerText()).toMatch(/\d/);
    await expect(vacio.locator('a[href="/ayuda"]')).toHaveCount(1);

    // «El primer paso a la vista»: el formulario de alta se ve sin buscarlo, dentro
    // de la ventana y sin haber hecho scroll.
    const alto = page.viewportSize()!.height;
    const form = page.locator('form', { hasText: 'Vigilar una acción' });
    await expect(form).toBeVisible();
    const caja = await form.boundingBox();
    expect(
      caja!.y,
      `el formulario de alta empieza a ${Math.round(caja!.y)} px, fuera de una ventana ` +
        `de ${alto} px: hay que buscarlo`,
    ).toBeLessThan(alto);

    await page.screenshot({ path: `${SHOTS}/ca9-vigiladas-vacio.png`, fullPage: true });
  });

  test('CA-10: Avisos — cuándo llegará el primero, y que aún no vigila nada', async ({ page }) => {
    await page.goto('/avisos');
    const vacio = page.getByTestId('avisos-vacio');

    await expect(vacio).toBeVisible();
    expect(await vacio.innerText()).toContain(VACIO_AVISOS.primerPaso);
    expect(await page.getByTestId('avisos-vacio-cadencia').innerText()).toMatch(
      /una vez al d[ií]a/i,
    );
    // Esta cuenta no vigila nada: el enlace tiene que mandarle al primer paso.
    await expect(page.getByTestId('avisos-vacio-sin-vigiladas')).toBeVisible();
    await expect(vacio.locator('a[href="/vigiladas"]')).toHaveCount(1);
    await expect(vacio.locator('a[href="/ayuda"]')).toHaveCount(1);

    // Y el contador de no leídos de SPEC-007 sigue intacto: sin avisos, no hay marca.
    await expect(page.locator('nav.app-nav .nav-count')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/ca10-avisos-vacio.png`, fullPage: true });
  });

  test('CA-11: el Panel de quien acaba de llegar señala UN paso, no tres puertas', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    const bloque = page.getByTestId('panel-primer-paso');

    await expect(bloque).toBeVisible();
    expect(await bloque.innerText()).toContain(VACIO_PANEL.primerPaso);
    // Un solo camino de acción, y la ayuda al lado.
    await expect(bloque.locator('a[href="/vigiladas"]')).toHaveCount(1);
    await expect(bloque.locator('a[href="/ayuda"]')).toHaveCount(1);
    // SPEC-034 CA-9 no se reabre: al tester se le sigue sin ofrecer Cartera.
    await expect(page.locator('main a[href="/cartera"]')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/ca11-panel-primer-paso.png`, fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// CA-12 y CA-13 — el canal de feedback
// ---------------------------------------------------------------------------

test.describe('CA-12: hay un camino visible para mandar feedback', () => {
  test('desde /ayuda y desde las páginas públicas, sin sesión', async ({ page }) => {
    for (const ruta of ['/ayuda', '/', '/login', '/register']) {
      await page.goto(ruta);
      const enlace = pie(page).getByTestId('feedback-enlace');
      await expect(enlace, `${ruta} sin camino al feedback`).toBeVisible();
      expect(await enlace.getAttribute('href')).toMatch(/^mailto:/);
    }
  });

  test('y desde cualquier pantalla autenticada', async ({ page }) => {
    await entrarComoGuia(page);

    for (const ruta of ['/dashboard', '/vigiladas', '/avisos', '/cuenta']) {
      await page.goto(ruta);
      await expect(
        pie(page).getByTestId('feedback-enlace'),
        `${ruta} sin camino al feedback`,
      ).toBeVisible();
    }
    await page.screenshot({ path: `${SHOTS}/ca12-feedback-en-el-pie.png`, fullPage: true });
  });

  test('el pie no ha perdido nada de SPEC-035 por el camino', async ({ page }) => {
    await page.goto('/legal');
    const texto = await pie(page).innerText();

    expect(texto).toMatch(/no presta asesoramiento financiero/i);
    expect(texto).toContain('Stockeiro, un proyecto de tremen.dev');
    await expect(pie(page).locator('a[href="/legal/terminos"]')).toHaveCount(1);
  });
});

test('CA-13: lo que se manda lleva la MISMA versión que responde /api/version', async ({
  page,
  request,
}) => {
  const identidad = await (await request.get('/api/version')).json();

  await page.goto('/ayuda');
  const href = (await pie(page).getByTestId('feedback-enlace').getAttribute('href'))!;
  const url = new URL(href);
  const asunto = url.searchParams.get('subject') ?? '';
  const cuerpo = url.searchParams.get('body') ?? '';

  expect(url.protocol).toBe('mailto:');
  // Prefijada: lo primero que se lee en la bandeja del operador.
  expect(asunto.indexOf(identidad.commit)).toBeLessThan(24);
  expect(cuerpo).toContain(identidad.commit);
  expect(cuerpo).toContain(identidad.environment);
  expect(cuerpo).toContain(identidad.builtAt);
});

// ---------------------------------------------------------------------------
// CA-14 — nada de terceros
// ---------------------------------------------------------------------------

test.describe('CA-14: las dos páginas públicas no piden nada de fuera', () => {
  for (const ruta of ['/', '/ayuda']) {
    test(`${ruta} no solicita ningún recurso ajeno a su origen`, async ({ page, baseURL }) => {
      const ajenas: string[] = [];
      page.on('request', (peticion) => {
        const url = peticion.url();
        if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') return;
        if (!url.startsWith(baseURL!)) ajenas.push(`${peticion.resourceType()} ${url}`);
      });

      await page.goto(ruta, { waitUntil: 'networkidle' });

      expect(ajenas, `${ruta} carga recursos externos:\n${ajenas.join('\n')}`).toEqual([]);
    });
  }

  test('y un visitante anónimo no se lleva ni una cookie por leerlas', async ({ page, context }) => {
    // Es la razón de que la sesión se lea en la PÁGINA y no en el middleware: entrar
    // en el flujo de Auth.js en la raíz estamparía authjs.csrf-token en el navegador
    // de quien solo ha pinchado un enlace del foro.
    await page.goto('/');
    await page.goto('/ayuda');

    expect(await context.cookies()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// CA-15 — el recorrido entero de CE-1
// ---------------------------------------------------------------------------

test('CA-15: de la raíz a la primera vigilada, sin ayuda humana', async ({ page }) => {
  // 1. Llega del foro y aterriza en la raíz. Lee qué es esto y con qué cadencia.
  await page.goto('/');
  const portada = await page.locator('main').innerText();
  expect(portada).toContain(QUE_HACE);
  expect(portada).toContain(CADENCIA_LINEA);

  // 2. Quiere saber más antes de dar su correo. Pincha la ayuda desde la portada.
  await page.locator('a[href="/ayuda"]').click();
  await page.waitForURL('**/ayuda');
  expect(await page.getByTestId('ayuda-zonas').innerText()).toMatch(/rango/i);

  // 3. Se decide. Desde la propia ayuda hay camino a crear cuenta.
  await page.locator('main a[href="/register"]').first().click();
  await page.waitForURL('**/register');
  await page.fill('input[name="email"]', RECORRIDO);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');

  // 4. Aterriza en el panel y ahí está el paso siguiente, uno solo.
  await page.waitForURL('**/dashboard');
  await expect(page.getByTestId('panel-primer-paso')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca15-1-panel-recien-llegado.png`, fullPage: true });

  // 5. Lo sigue.
  await page.getByTestId('panel-primer-paso').locator('a[href="/vigiladas"]').click();
  await page.waitForURL('**/vigiladas');
  await expect(page.getByTestId('vigiladas-vacio')).toBeVisible();

  // 6. Busca un valor y crea su primera vigilada con su zona, con el formulario que
  //    el estado vacío le acaba de señalar.
  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  await form.locator('.symbol-search-input').fill('Inditex');
  await form.locator('.symbol-result', { hasText: 'ITX' }).first().click();
  await expect(form.locator('.symbol-chip-tk')).toContainText('ITX');
  await form.locator('input[name="buyMin"]').fill('20');
  await form.locator('input[name="buyMax"]').fill('25');
  await form.locator('button[type="submit"]').click();

  // 7. Lo consiguió, sin salir de la app y sin que nadie le dijera nada.
  const fila = page.locator('tr', { hasText: 'ITX' });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('20 – 25');
  await expect(page.getByTestId('vigiladas-vacio')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ca15-2-primera-vigilada.png`, fullPage: true });
});
