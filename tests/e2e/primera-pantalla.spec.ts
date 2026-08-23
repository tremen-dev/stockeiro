import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  ANCHOS,
  TOLERANCIA_PX,
  describirViolaciones,
  medirBloques,
  medirDesbordeDeDocumento,
  medirDesbordePorElemento,
  ponerVentana,
} from './geometria';
import { CUENTA_VACIA, entrar } from './spec040';
import { CADENCIA_LINEA, QUE_HACE, QUE_NO_HACE } from '../../src/lib/help/content';

/**
 * SPEC-050 — la primera pantalla, en el navegador y a los ocho anchos del proyecto.
 *
 *   CA-1  el wordmark, con su punto de acento, y sin `.landing-eyebrow`
 *   CA-2  es una marca, no un microcrédito, y no compite con el titular
 *   CA-3  la barra de navegación NO se entera del desacoplo (no regresión de D-1)
 *   CA-5  el orden de la pantalla es el pactado
 *   CA-6  «Crear cuenta» domina, «Entrar» es secundaria, la ayuda fuera de esa fila
 *   CA-7  «gratis y sin publicidad» sube, con las MISMAS palabras
 *   CA-8  los cuatro caminos siguen siendo cuatro, y uno de cada
 *   CA-9  `CADENCIA_LINEA` entera y en esta pantalla
 *   CA-10 pierde el cromo de alarma, no el sitio
 *   CA-12 el descargo, lo legal y la marca del pie, idénticos a los de `/legal/terminos`
 *   CA-13 en `/` el feedback no se muestra; en el resto, nada cambia
 *   CA-14 la versión sigue visible, legible y copiable
 *   CA-16 con sesión, la raíz sigue llevando al panel
 *   CA-17 geometría a los ocho anchos, y los bloques NUEVOS sin hueco muerto
 *   CA-21 el camino anónimo al canal de feedback sobrevive, en dos clics
 *
 * ## Dos reglas de este fichero
 *
 * **Nada se compara contra `origin/main`, `main` ni `HEAD`** (ADR-031 pto. 2.1). Todo lo
 * de aquí es una propiedad de la página tal y como el navegador la pinta.
 *
 * **Y ningún color se teclea.** Los tokens del tema (`--accent`, `--fg`, `--fg-muted`,
 * `--fg-dim`, `--amber`, `--bg-step`) se resuelven preguntándole al navegador con una
 * sonda, no escribiendo hexadecimales: un test con `#FF6B00` dentro se vuelve mentira el
 * día que la paleta cambie, y se vuelve mentira **en verde**.
 *
 * ## La cuenta
 *
 * No se registra ninguna. CA-3 y CA-16 necesitan sesión y **reutilizan**
 * `spec040-vacio@example.com`: el grifo del e2e tiene cupo 50 y la suite ya gasta
 * cuarenta y tantas altas, así que una cuenta más por una spec de presentación sería
 * gastar cupo ajeno para nada.
 */

const SHOTS = '_qa/SPEC-050';
/** Capturas de trabajo: fuera de git (CA-19). */
const TRABAJO = 'test-results/SPEC-050';

/** El literal que sube del pie de la landing. Se declara aquí (CA-7). */
const LINEA_GRATIS = 'Proyecto personal en pruebas, gratis y sin publicidad.';

/** Promesas que esta línea NO puede acabar haciendo por el camino (CA-7). */
const PROMESAS_PROHIBIDAS = /ilimitad|para siempre|sin coste|siempre gratis/i;

const pie = (page: Page) => page.locator('footer.app-footer');

/* ────────────────────────────────────────────────────────────────────────────
   Sondas: los valores se DERIVAN del CSS de marca, no se teclean
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * El color que produce un token del tema, tal y como lo computa el navegador.
 *
 * La sonda se cuelga de `<body class="v-tremendo">`, así que hereda exactamente el
 * bloque de tema que la spec nombra en CA-1 y CA-10.
 */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((t) => {
    const sonda = document.createElement('span');
    sonda.style.cssText = `position:absolute;opacity:0;color:var(${t})`;
    document.body.append(sonda);
    const valor = getComputedStyle(sonda).color;
    sonda.remove();
    return valor;
  }, token);
}

/** Lo mismo para un token que se usa como fondo. */
async function tokenFondo(page: Page, token: string): Promise<string> {
  return page.evaluate((t) => {
    const sonda = document.createElement('span');
    sonda.style.cssText = `position:absolute;opacity:0;background-color:var(${t})`;
    document.body.append(sonda);
    const valor = getComputedStyle(sonda).backgroundColor;
    sonda.remove();
    return valor;
  }, token);
}

/** Y para la familia tipográfica, que es una cadena larga con su pila de reserva. */
async function tokenFuente(page: Page, token: string): Promise<string> {
  return page.evaluate((t) => {
    const sonda = document.createElement('span');
    sonda.style.cssText = `position:absolute;opacity:0;font-family:var(${t})`;
    document.body.append(sonda);
    const valor = getComputedStyle(sonda).fontFamily;
    sonda.remove();
    return valor;
  }, token);
}

/** Los estilos calculados que interesan de un elemento, en una sola ida y vuelta. */
async function estilos(destino: Locator, props: string[]): Promise<Record<string, string>> {
  return destino.evaluate((el, props) => {
    const cs = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
  }, props);
}

/* ────────────────────────────────────────────────────────────────────────────
   Contraste — WCAG 2.x, con composición sobre el fondo (los tokens tenues
   del tema son `rgba` y sin componer el número saldría mal)
   ──────────────────────────────────────────────────────────────────────────── */

type Rgba = { r: number; g: number; b: number; a: number };

function leerColor(valor: string): Rgba {
  const n = valor.match(/[\d.]+/g)?.map(Number) ?? [];
  return { r: n[0] ?? 0, g: n[1] ?? 0, b: n[2] ?? 0, a: n[3] ?? 1 };
}

const componer = (frente: Rgba, fondo: Rgba): Rgba => ({
  r: frente.a * frente.r + (1 - frente.a) * fondo.r,
  g: frente.a * frente.g + (1 - frente.a) * fondo.g,
  b: frente.a * frente.b + (1 - frente.a) * fondo.b,
  a: 1,
});

function luminancia({ r, g, b }: Rgba): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Contraste de un texto sobre un fondo OPACO, componiendo la transparencia del texto. */
function contraste(texto: string, fondo: string): number {
  const base = leerColor(fondo);
  const frente = componer(leerColor(texto), base);
  const [claro, oscuro] = [luminancia(frente), luminancia(base)].sort((a, b) => b - a);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** El fondo opaco de la página: lo que hay debajo del pie y de los botones. */
const fondoDeLaPagina = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/* ────────────────────────────────────────────────────────────────────────────
   CA-1 y CA-2 — la marca está, y es la que ya existe
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('CA-1: la primera pantalla enseña el wordmark, con su punto de acento', () => {
  test('es el primer elemento de la pantalla, y dice `Stockeiro.`', async ({ page }) => {
    await page.goto('/');

    const primero = page.locator('main.landing > *').first();
    expect(
      await primero.getAttribute('data-testid'),
      'el primer elemento de la primera pantalla tiene que ser la marca',
    ).toBe('landing-marca');

    expect((await primero.innerText()).trim()).toBe('Stockeiro.');
    await expect(primero.locator('.dot'), 'falta el punto de acento').toHaveCount(1);
    expect((await primero.locator('.dot').innerText()).trim()).toBe('.');

    mkdirSync(SHOTS, { recursive: true });
    await primero.screenshot({ path: `${SHOTS}/ca1-wordmark.png` });
  });

  test('el punto es `--accent` y la palabra `--fg`, derivados del tema y no tecleados', async ({
    page,
  }) => {
    await page.goto('/');
    const marca = page.getByTestId('landing-marca');

    expect((await estilos(marca, ['color'])).color).toBe(await tokenColor(page, '--fg'));
    expect((await estilos(marca.locator('.dot'), ['color'])).color).toBe(
      await tokenColor(page, '--accent'),
    );
  });

  test('y `.landing-eyebrow` ha desaparecido de la página', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('.landing-eyebrow'),
      'el microcrédito tipográfico de 11 px lo sustituye la marca (D-2)',
    ).toHaveCount(0);
  });
});

test('CA-2: es una marca, no un microcrédito, y nunca por encima del titular', async ({ page }) => {
  await page.goto('/');
  const sans = await tokenFuente(page, '--font-sans');
  const informe: string[] = [];

  for (const ancho of ANCHOS) {
    await ponerVentana(page, ancho);
    const marca = await estilos(page.getByTestId('landing-marca'), [
      'font-family',
      'font-weight',
      'font-size',
      'text-transform',
    ]);
    const titular = await estilos(page.locator('.landing-title'), ['font-size']);

    const tamano = parseFloat(marca['font-size']);
    const tamanoTitular = parseFloat(titular['font-size']);
    informe.push(`ancho ${ancho}: marca=${tamano}px titular=${tamanoTitular}px`);

    expect(marca['font-family'], `a ${ancho} px la marca no usa la sans del sistema`).toBe(sans);
    expect(marca['font-weight'], `a ${ancho} px la marca no pesa 900`).toBe('900');
    expect(marca['text-transform'], `a ${ancho} px la marca va en mayúsculas forzadas`).toBe(
      'none',
    );
    expect(tamano, `a ${ancho} px la marca mide ${tamano}px: sigue siendo texto corrido`)
      .toBeGreaterThanOrEqual(24);
    expect(tamano, `a ${ancho} px la marca mide ${tamano}px: se pasa de marca`)
      .toBeLessThanOrEqual(32);
    expect(
      tamano,
      `a ${ancho} px la marca (${tamano}px) alcanza al titular (${tamanoTitular}px): quien ` +
        'manda en la jerarquía es el titular',
    ).toBeLessThan(tamanoTitular);
  }

  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(
    `${SHOTS}/ca2-marca-vs-titular.txt`,
    `SPEC-050 CA-2 — tamaño de la marca frente al titular\n${informe.join('\n')}\n`,
    'utf8',
  );
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-3 — la barra de navegación no se entera (no regresión de D-1)
   ──────────────────────────────────────────────────────────────────────────── */

test('CA-3: la marca del menú se pinta EXACTAMENTE igual que antes del desacoplo', async ({
  page,
}) => {
  await entrar(page, CUENTA_VACIA);
  await page.goto('/dashboard');

  const brand = page.locator('.app-nav .brand');
  await expect(brand).toBeVisible();

  // Los valores esperados se DERIVAN: los tres colores y la familia salen de los tokens
  // del tema por sonda; el peso, el tamaño y el tracking salen de la regla `.brand` que
  // `tests/primera-pantalla-fuente.test.ts` acaba de fijar como única definición. El
  // tracking se convierte a px porque es lo que devuelve `getComputedStyle`:
  // -0.045em sobre 20px = -0.9px.
  const medido = await estilos(brand, [
    'font-family',
    'font-weight',
    'font-size',
    'letter-spacing',
    'color',
    'text-decoration-line',
  ]);
  const punto = await estilos(brand.locator('.dot'), ['color']);

  expect(medido['font-family']).toBe(await tokenFuente(page, '--font-sans'));
  expect(medido['font-weight']).toBe('900');
  expect(medido['font-size'], 'el tamaño por defecto de `--brand-size` es 20px').toBe('20px');
  expect(parseFloat(medido['letter-spacing'])).toBeCloseTo(-0.045 * 20, 2);
  expect(medido['color']).toBe(await tokenColor(page, '--fg'));
  expect(punto['color']).toBe(await tokenColor(page, '--accent'));
  expect(
    medido['text-decoration-line'],
    'sacar la declaración a `.brand` bajó la especificidad: si el subrayado vuelve, es que ' +
      '`.app-nav .brand` perdió lo único que sigue siendo suyo',
  ).toBe('none');

  mkdirSync(SHOTS, { recursive: true });
  await page.locator('nav.app-nav').screenshot({ path: `${SHOTS}/ca3-barra-intacta.png` });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-5 — el orden de la pantalla es el pactado
   ──────────────────────────────────────────────────────────────────────────── */

test('CA-5: el orden de documento es el de la tabla de la spec', async ({ page }) => {
  await page.goto('/');

  const orden = await page.evaluate(() =>
    [...document.querySelectorAll('main.landing > *')].map(
      (el) => el.getAttribute('data-testid') ?? el.className,
    ),
  );

  expect(orden).toEqual([
    'landing-marca',
    'landing-title',
    'landing-que-hace',
    'landing-acciones',
    'landing-gratis',
    'landing-cadencia',
    'landing-que-no-hace',
    'landing-mas',
    'landing-legal',
  ]);

  // Y dicho como propiedad, no como lista: el valor y la entrada van DELANTE de las
  // negaciones. Es lo que la spec compró con el reordenado.
  const i = (nombre: string) => orden.indexOf(nombre);
  expect(i('landing-que-hace')).toBeLessThan(i('landing-cadencia'));
  expect(i('landing-acciones')).toBeLessThan(i('landing-cadencia'));
  expect(i('landing-acciones')).toBeLessThan(i('landing-que-no-hace'));
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-6 — la entrada domina
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('CA-6: «Crear cuenta» domina y «Entrar» es secundaria', () => {
  test('el primario es el único de la fila con la clase primaria del sistema', async ({ page }) => {
    await page.goto('/');

    const fila = page.locator('.landing-acciones');
    await expect(fila.locator('.primary')).toHaveCount(1);
    await expect(fila.locator('a[href="/register"].primary')).toHaveCount(1);
    await expect(
      fila.locator('a[href="/ayuda"]'),
      'un enlace a la ayuda no puede estar en la misma fila que dos botones de cuenta',
    ).toHaveCount(0);
  });

  test('su área es al menos 1,3× la de «Entrar», a los ocho anchos', async ({ page }) => {
    await page.goto('/');
    const informe: string[] = [];

    for (const ancho of ANCHOS) {
      await ponerVentana(page, ancho);
      const crear = (await page.locator('a[href="/register"]').boundingBox())!;
      const entrarCaja = (await page.locator('a[href="/login"]').boundingBox())!;

      const areaCrear = crear.width * crear.height;
      const areaEntrar = entrarCaja.width * entrarCaja.height;
      const razon = areaCrear / areaEntrar;
      informe.push(
        `ancho ${ancho}: crear=${Math.round(crear.width)}×${Math.round(crear.height)} ` +
          `entrar=${Math.round(entrarCaja.width)}×${Math.round(entrarCaja.height)} ` +
          `razón=${razon.toFixed(2)}`,
      );

      expect(
        razon,
        `a ${ancho} px «Crear cuenta» no domina: razón de áreas ${razon.toFixed(2)}\n` +
          informe.join('\n'),
      ).toBeGreaterThanOrEqual(1.3);
    }

    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(
      `${SHOTS}/ca6-jerarquia-de-botones.txt`,
      `SPEC-050 CA-6 — área del primario frente a la del secundario\n${informe.join('\n')}\n`,
      'utf8',
    );
  });

  test('y su texto se lee sobre su fondo: contraste ≥ 4,5:1', async ({ page }) => {
    await page.goto('/');
    const boton = await estilos(page.locator('a[href="/register"]'), [
      'color',
      'background-color',
    ]);
    const razon = contraste(boton['color'], boton['background-color']);

    // La cifra se IMPRIME, no solo se comprueba: así queda en el registro de la
    // ejecución y quien revise el gate no tiene que fiarse de un «pasa».
    console.log(
      `[SPEC-050 CA-6] contraste del primario: ${razon.toFixed(2)}:1 ` +
        `(${boton['color']} sobre ${boton['background-color']})`,
    );
    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(
      `${SHOTS}/ca6-contraste-del-primario.txt`,
      `SPEC-050 CA-6 — contraste del botón primario\n${boton['color']} sobre ` +
        `${boton['background-color']} = ${razon.toFixed(2)}:1 (umbral 4,5:1)\n`,
      'utf8',
    );

    expect(
      razon,
      `el botón primario da ${razon.toFixed(2)}:1 (${boton['color']} sobre ` +
        `${boton['background-color']})`,
    ).toBeGreaterThanOrEqual(4.5);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-7 y CA-8 — lo que cuesta, y los cuatro caminos
   ──────────────────────────────────────────────────────────────────────────── */

test('CA-7: «gratis y sin publicidad» sube, con las MISMAS palabras', async ({ page }) => {
  await page.goto('/');
  const linea = page.getByTestId('landing-gratis');

  const texto = (await linea.innerText()).trim();
  expect(texto, 'el literal es el que ya vivía en el pie de la landing').toBe(LINEA_GRATIS);
  expect(texto).toContain('gratis y sin publicidad');
  expect(
    texto.match(PROMESAS_PROHIBIDAS)?.[0] ?? null,
    'la línea no puede afirmar nada que el literal declarado no diga',
  ).toBeNull();

  const suyos = await estilos(linea, ['color', 'font-size']);
  const legal = await estilos(page.getByTestId('landing-legal'), ['font-size']);

  expect(
    suyos['color'],
    'era el texto más apagado de la pantalla: no puede seguir en `--fg-dim`',
  ).not.toBe(await tokenColor(page, '--fg-dim'));
  expect([await tokenColor(page, '--fg'), await tokenColor(page, '--fg-muted')]).toContain(
    suyos['color'],
  );
  expect(parseFloat(suyos['font-size'])).toBeGreaterThanOrEqual(parseFloat(legal['font-size']));

  const orden = await page.evaluate(() =>
    [...document.querySelectorAll('main.landing > *')].map((el) => el.getAttribute('data-testid')),
  );
  expect(orden.indexOf('landing-gratis')).toBeLessThan(orden.indexOf('landing-cadencia'));
});

test('CA-8: los cuatro caminos siguen siendo cuatro, y uno de cada', async ({ page }) => {
  await page.goto('/');

  // Lo mismo que ya afirma SPEC-039 CA-2, repetido aquí porque un wordmark ENLAZADO o un
  // segundo botón lo romperían y hay que saberlo desde este lado.
  await expect(page.locator('a[href="/register"]')).toHaveCount(1);
  await expect(page.locator('a[href="/login"]')).toHaveCount(1);
  await expect(page.locator('a[href="/ayuda"]')).toHaveCount(1);
  expect(await page.locator('a[href^="/legal"]').count()).toBeGreaterThan(0);
  await expect(
    page.locator('main.landing a[href="/"]'),
    'el wordmark no es un enlace: la landing ES el destino al que llevaría (D-2)',
  ).toHaveCount(0);
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-9 y CA-10 — la advertencia se dice entera y deja de gritar
   ──────────────────────────────────────────────────────────────────────────── */

test('CA-9: la cadencia sigue entera, y es la MISMA constante', async ({ page }) => {
  await page.goto('/');

  const texto = await page.locator('main').innerText();
  expect(texto, 'D-2 es locked: la frase se dice entera en la primera pantalla').toContain(
    CADENCIA_LINEA,
  );
  expect(texto).toContain(QUE_HACE);
  expect(texto).toContain(QUE_NO_HACE);
});

test('CA-10: pierde el cromo de alarma, no el sitio', async ({ page }) => {
  await page.goto('/');

  const cadencia = page.getByTestId('landing-cadencia');
  await expect(cadencia).toBeVisible();

  const medido = await estilos(cadencia, [
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'border-left-color',
    'background-color',
    'border-radius',
    'color',
  ]);
  const limites = await estilos(page.getByTestId('landing-que-no-hace'), ['color']);

  const ambar = await tokenColor(page, '--amber');
  const escalon = await tokenFondo(page, '--bg-step');
  const fondoPagina = await fondoDeLaPagina(page);

  for (const lado of ['top', 'right', 'bottom', 'left']) {
    expect(
      parseFloat(medido[`border-${lado}-width`]),
      `la cadencia conserva borde por ${lado}: el ámbar es el color con el que este ` +
        'sistema pinta AVISO, y aquí no hay nada que avisar (D-3)',
    ).toBe(0);
  }
  expect(medido['border-left-color'], 'sigue habiendo ámbar declarado').not.toBe(ambar);
  expect(medido['background-color'], 'sigue teniendo fondo elevado de tarjeta').not.toBe(escalon);
  expect(['rgba(0, 0, 0, 0)', 'transparent', fondoPagina]).toContain(medido['background-color']);
  expect(parseFloat(medido['border-radius']), 'sigue siendo una tarjeta').toBe(0);
  expect(
    medido['color'],
    'la cadencia es prosa: el mismo color de texto secundario que `.landing-limites`',
  ).toBe(limites['color']);
  expect(medido['color']).toBe(await tokenColor(page, '--fg-muted'));
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-12, CA-13 y CA-14 — el pie se subordina sin perder sus promesas
   ──────────────────────────────────────────────────────────────────────────── */

/** Los tres bloques del pie que SPEC-035 declaró universales y esta spec no toca. */
const BLOQUES_UNIVERSALES = [
  '.app-footer-descargo',
  '.app-footer-links',
  '.app-footer-marca',
] as const;

test('CA-12: el descargo, lo legal y la marca siguen EXACTAMENTE igual en `/`', async ({ page }) => {
  await page.goto('/legal/terminos');
  const referencia: Record<string, Record<string, string>> = {};
  for (const bloque of BLOQUES_UNIVERSALES) {
    referencia[bloque] = await estilos(pie(page).locator(bloque), ['color', 'font-size']);
  }

  await page.goto('/');
  const texto = await pie(page).innerText();
  expect(texto).toMatch(/no presta asesoramiento financiero/i);
  expect(texto).toContain('Stockeiro, un proyecto de tremen.dev');
  await expect(pie(page).locator('a[href="/legal/terminos#no-asesoramiento"]')).toHaveCount(1);
  await expect(pie(page).locator('.app-footer-links a')).toHaveCount(3);
  await expect(pie(page).locator('.app-footer-marca a[href*="tremen.dev"]')).toHaveCount(1);

  for (const bloque of BLOQUES_UNIVERSALES) {
    const enLanding = await estilos(pie(page).locator(bloque), ['color', 'font-size']);
    expect(
      enLanding,
      `${bloque} se pinta distinto en la landing: SPEC-035 CA-9/CA-10/CA-11 dicen ` +
        '«cualquier página» y esta spec no los toca',
    ).toEqual(referencia[bloque]);
  }
});

test('CA-13: en `/` el feedback no se muestra; en `/legal/terminos` nada cambia', async ({
  page,
}) => {
  await page.goto('/');

  const feedback = pie(page).getByTestId('feedback');
  const version = pie(page).getByTestId('version');

  const suFeedback = await estilos(feedback, ['display', 'visibility', 'opacity']);
  expect(suFeedback['display'], 'la fila del feedback tiene que retirarse con `display: none`').toBe(
    'none',
  );
  expect(
    suFeedback['visibility'],
    '`visibility: hidden` dejaría la caja ocupando alto: es el hueco muerto que las dos ' +
      'guardias de pie miden y castigan (D-5)',
  ).not.toBe('hidden');
  expect(suFeedback['opacity']).not.toBe('0');
  expect(
    (await feedback.evaluate((el) => el.getBoundingClientRect().height)),
    'la fila retirada no puede reservar ni un píxel de alto',
  ).toBe(0);

  await expect(version).toBeVisible();
  expect((await estilos(version, ['color']))['color']).toBe(await tokenColor(page, '--fg-dim'));

  // Y en cualquier otra pantalla, las dos siguen exactamente como estaban.
  await page.goto('/legal/terminos');
  await expect(pie(page).getByTestId('feedback')).toBeVisible();
  await expect(pie(page).getByTestId('version')).toBeVisible();
  expect((await estilos(pie(page).getByTestId('feedback'), ['color']))['color']).toBe(
    await tokenColor(page, '--fg-muted'),
  );
  expect((await estilos(pie(page).getByTestId('version'), ['color']))['color']).toBe(
    await tokenColor(page, '--fg-dim'),
  );
});

test('CA-14: la versión sigue presente, legible y copiable en `/`', async ({ page }) => {
  await page.goto('/');
  const version = pie(page).getByTestId('version');

  await expect(version).toBeVisible();
  const texto = (await version.innerText()).trim();
  const semver = (await version.getByTestId('version-semver').innerText()).trim();
  const commit = (await version.getByTestId('version-commit').innerText()).trim();
  const construido = (await version.getByTestId('version-construido').innerText()).trim();

  expect(semver, 'SPEC-038 CA-2: el semver primero').toMatch(/^v\d+\.\d+\.\d+$/);
  expect(texto.startsWith(semver)).toBe(true);
  expect(texto.indexOf(semver)).toBeLessThan(texto.indexOf(commit));
  expect(texto.indexOf(commit)).toBeLessThan(texto.indexOf(construido));

  // Los cuatro atajos que R-1 prohíbe: entre «pesa menos» y «no se ve» hay un paso.
  const medido = await estilos(version, [
    'display',
    'visibility',
    'font-size',
    'user-select',
    'color',
  ]);
  expect(medido['display']).not.toBe('none');
  expect(medido['visibility']).not.toBe('hidden');
  expect(parseFloat(medido['font-size'])).toBeGreaterThan(0);
  expect(medido['user-select'], 'lo que un tester tiene que poder hacer con ella es COPIARLA')
    .not.toBe('none');

  const fondo = await fondoDeLaPagina(page);
  const razon = contraste(medido['color'], fondo);
  console.log(
    `[SPEC-050 CA-14] contraste de la versión en \`/\`: ${razon.toFixed(2)}:1 ` +
      `(${medido['color']} compuesto sobre ${fondo})`,
  );
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(
    `${SHOTS}/ca14-contraste-de-la-version.txt`,
    `SPEC-050 CA-14 — la versión sigue legible en la primera pantalla\n` +
      `${medido['color']} compuesto sobre ${fondo} = ${razon.toFixed(2)}:1 (umbral 3:1)\n`,
    'utf8',
  );
  expect(
    razon,
    `la versión da ${razon.toFixed(2)}:1 sobre el fondo: subordinar no es esconder (R-1)`,
  ).toBeGreaterThanOrEqual(3);

  // Y se copia de verdad: lo que se llevaría el portapapeles es su texto.
  const seleccionado = await version.evaluate((el) => {
    const rango = document.createRange();
    rango.selectNodeContents(el);
    return rango.toString().trim();
  });
  expect(seleccionado).toBe(texto);
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-16 — con sesión, la raíz sigue llevando al panel
   ──────────────────────────────────────────────────────────────────────────── */

test('CA-16: con sesión, `/` sigue llevando al panel y no pinta la primera pantalla', async ({
  page,
}) => {
  await entrar(page, CUENTA_VACIA);

  await page.goto('/');
  await page.waitForURL('**/dashboard');
  expect(new URL(page.url()).pathname).toBe('/dashboard');
  await expect(page.getByTestId('primera-pantalla')).toHaveCount(0);
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-17 — geometría, y los bloques NUEVOS sin hueco muerto
   ──────────────────────────────────────────────────────────────────────────── */

/** Los bloques de texto que esta spec introduce o mueve. Se miden AQUÍ, no en el ajeno. */
const BLOQUES_NUEVOS = [
  '[data-testid="landing-marca"]',
  '[data-testid="landing-gratis"]',
  '[data-testid="landing-cadencia"]',
  '.landing-mas',
] as const;

test('CA-17: la primera pantalla no desborda a ninguno de los ocho anchos', async ({ page }) => {
  await page.goto('/');
  const informe: string[] = [];

  for (const ancho of ANCHOS) {
    await ponerVentana(page, ancho);
    await page.locator('main.landing').waitFor({ state: 'visible' });

    const doc = await medirDesbordeDeDocumento(page);
    const m1 = await medirDesbordePorElemento(page, {
      testigos: '.landing-acciones, [data-testid="landing-marca"]',
    });
    informe.push(
      `ancho ${ancho}: documento=${doc.documento}/${doc.ventana} medidos=${m1.medidos} ` +
        `violaciones=${m1.violaciones.length} testigos=${m1.testigos.join('|')}`,
    );

    expect(doc.desborde, `a ${ancho} px la pantalla se sale por la derecha`).toBeLessThanOrEqual(
      TOLERANCIA_PX,
    );
    expect(
      m1.violaciones.length,
      `a ${ancho} px se salen elementos de la primera pantalla:\n${describirViolaciones(m1)}`,
    ).toBe(0);
    expect(
      m1.testigos.length,
      `a ${ancho} px la medida no llegó a mirar los bloques de esta spec: su «cero ` +
        'violaciones» no aprueba nada (ADR-030 §5)',
    ).toBeGreaterThan(0);
  }

  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(
    `${SHOTS}/ca17-geometria.txt`,
    `SPEC-050 CA-17 — M1 + M2 sobre \`/\` a los ocho anchos\n${informe.join('\n')}\n`,
    'utf8',
  );
});

test('CA-17: ningún bloque nuevo reserva alto que su texto no ocupe', async ({ page }) => {
  await page.goto('/');

  for (const ancho of ANCHOS) {
    await ponerVentana(page, ancho);
    await page.locator('main.landing').waitFor({ state: 'visible' });

    // Se mide contra las CAJAS DE LÍNEA del propio texto, no contra los hijos: estos
    // bloques son párrafos con contenido en línea, y ahí `getBoundingClientRect()` de un
    // hijo no dice cuánto ocupa el renglón. Es la misma medida que delató los 280 px de
    // hueco del pie en SPEC-035.
    const medidas = await page.evaluate((selectores) =>
      selectores.map((s) => {
        const el = document.querySelector(s);
        if (el === null) throw new Error(`no existe ningún elemento que case "${s}" en la página`);
        const rango = document.createRange();
        rango.selectNodeContents(el);
        const rects = [...rango.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        return {
          selector: s,
          alto: el.getBoundingClientRect().height,
          altoTexto:
            rects.length === 0
              ? 0
              : Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)),
        };
      }),
    [...BLOQUES_NUEVOS]);

    for (const m of medidas) {
      expect(m.altoTexto, `no se midió el texto de ${m.selector} a ${ancho} px`).toBeGreaterThan(0);
      expect(
        m.alto,
        `hueco muerto en ${m.selector} a ${ancho} px: la caja mide ${Math.round(m.alto)} px y ` +
          `su texto solo ${Math.round(m.altoTexto)} px`,
      ).toBeLessThanOrEqual(m.altoTexto + 12);
    }
  }
});

test('CA-17: la fila de acciones sigue siendo un grid con su nombre de clase', async ({ page }) => {
  await page.goto('/');

  for (const ancho of ANCHOS) {
    await ponerVentana(page, ancho);
    const [fila] = await medirBloques(page, '.landing-acciones');

    expect(
      fila,
      'la clase `.landing-acciones` tiene que seguir existiendo con ese nombre: la mide ' +
        '`tests/e2e/ayuda-responsive.spec.ts` (SPEC-039 CA-17) y su lista CONTENEDORES ' +
        'necesita casar con al menos DOS elementos en `/`',
    ).toBeTruthy();
    expect(fila.display, `a ${ancho} px la fila de acciones no declara su eje`).toBe('grid');
    expect(
      fila.alto,
      `hueco muerto en la fila de acciones a ${ancho} px: caja ${Math.round(fila.alto)} px, ` +
        `contenido ${Math.round(fila.altoContenido)} px`,
    ).toBeLessThanOrEqual(fila.altoContenido + 12);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-21 — el camino anónimo al canal de feedback sobrevive
   ──────────────────────────────────────────────────────────────────────────── */

test('CA-21: desde la primera pantalla se sigue llegando al feedback, en dos clics', async ({
  page,
}) => {
  // El CA más importante de esta entrega. D-5 retira el canal de `/` porque quien acaba
  // de llegar de un hilo todavía no ha usado la app; el humano lo aprobó diciendo que el
  // feedback le importa *«porque permite a los usuarios decirme qué cosas puedo mejorar»*.
  // Lo que hace que esa decisión no degenere en «el visitante pierde el camino» es este
  // recorrido, y por eso se NAVEGA de verdad en vez de comprobar por separado que las dos
  // mitades existen.
  await page.goto('/');
  await expect(page.getByTestId('primera-pantalla')).toBeVisible();

  // Clic 1: el único enlace a la ayuda de la pantalla.
  const aLaAyuda = page.locator('a[href="/ayuda"]');
  await expect(aLaAyuda, 'sin este enlace no hay camino anónimo al canal').toHaveCount(1);
  expect((await aLaAyuda.innerText()).trim()).toBe('Cómo funciona, con detalle');
  await aLaAyuda.click();
  await page.waitForURL('**/ayuda');

  // Clic 2: el canal, ahí sí visible.
  const canal = pie(page).getByTestId('feedback-enlace');
  await expect(
    canal,
    'el canal tiene que estar visible en `/ayuda`: es la mitad pública que SPEC-039 CA-12 ' +
      'sí pedía, y la que sostiene el camino desde la landing',
  ).toBeVisible();
  expect(await canal.getAttribute('href')).toMatch(/^mailto:/);

  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/ca21-camino-al-feedback.png`, fullPage: true });
});

/* ────────────────────────────────────────────────────────────────────────────
   Evidencia visual para el gate
   ──────────────────────────────────────────────────────────────────────────── */

test('la primera pantalla, entera, a los ocho anchos del proyecto y a 768', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  mkdirSync(TRABAJO, { recursive: true });
  await page.goto('/');

  for (const ancho of [...ANCHOS, 768]) {
    await ponerVentana(page, ancho);
    await page.locator('main.landing').waitFor({ state: 'visible' });
    await page.screenshot({ path: `${SHOTS}/ancho-${ancho}-primera-pantalla.png`, fullPage: true });
  }
});
