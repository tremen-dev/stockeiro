import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import {
  altoPara,
  describirViolaciones,
  medirDesbordePorElemento,
  ponerVentana,
} from './geometria';
import {
  CUENTA_VACIA,
  PWD,
  SHOTS,
  cajaDe,
  entrar,
  pulsarSinDesplazar,
} from './spec040';

/**
 * SPEC-040 CA-1 y CA-2 — **el móvil completa el alta de una vigilada**.
 *
 * ## Por qué existe este fichero
 *
 * La app se publica en un hilo de un foro de bolsa, y **los foros se leen en el móvil**.
 * Con la suite entera en verde, el verificador de SPEC-039 encontró a mano que a 390 px
 * el botón **«Vigilar» estaba fuera de la pantalla**: `.symbol-picker` medía **444 px**
 * dentro de una columna de **350**, y `html, body { overflow-x: hidden }` del sistema de
 * diseño lo recortaba **en silencio** — ni barra de desplazamiento ni nada. El usuario no
 * ve que le falta algo: ve un formulario que parece completo y no lo es.
 *
 * Es exactamente el paso que persigue **CE-1 de EPIC-004**: *«un tester que llega desde
 * el foro sin hablar con nadie … crea su primera acción vigilada con su zona»*.
 *
 * ## Los dos anchos, y por qué el suelo es 360
 *
 * `.auth-wrap` es `width: min(420px, 100%)` y `.frame` se lleva 20 px de relleno a cada
 * lado, así que la columna del formulario es de **350 px a 390** y de **320 px a 360**.
 * El suelo lo fijó el humano en el gate del 2026-08-20 (Android pequeño, iPhone SE), y
 * endurece el objetivo: `.symbol-picker` no tiene que bajar 94 px, tiene que bajar 124.
 *
 * CA-2 mide el recorrido entero en **360**, el más estrecho: si se completa ahí, se
 * completa en los demás.
 */

const ANCHOS_DEL_ALTA = [360, 390] as const;

/** La columna que le toca al formulario en cada uno: `min(420px, 100%)` menos 40 de marco. */
const COLUMNA_ESPERADA: Record<number, number> = { 360: 320, 390: 350 };

/** Los controles que un desconocido tiene que poder ver y tocar para completar CE-1. */
const CONTROLES: [selector: string, nombre: string][] = [
  ['.symbol-picker', 'el bloque del buscador'],
  ['.symbol-search-input', 'el campo de búsqueda'],
  ['input[name="buyMin"]', 'zona de compra (min)'],
  ['input[name="buyMax"]', 'zona de compra (max)'],
  ['input[name="sellMin"]', 'zona de venta (min)'],
  ['input[name="sellMax"]', 'zona de venta (max)'],
  ['button[type="submit"]', 'el botón Vigilar'],
];

test.describe('SPEC-040 CA-1: el formulario de alta cabe entero', () => {
  test('ningún control del alta se sale de la columna a 360 ni a 390 px', async ({ page }) => {
    await entrar(page, CUENTA_VACIA);
    await page.goto('/vigiladas');
    await page.getByTestId('vigiladas-vacio').waitFor({ state: 'visible' });

    const lineas: string[] = [];

    for (const ancho of ANCHOS_DEL_ALTA) {
      await ponerVentana(page, ancho);
      const form = page.locator('form.auth-form');
      await form.waitFor({ state: 'visible' });

      // Las anchuras medidas de cada control, en el mensaje de fallo. La ronda RED de
      // SPEC-035 se resolvió cuando alguien midió 452 px: aquí el número va de serie.
      const anchuras: string[] = [];
      for (const [selector, nombre] of CONTROLES) {
        const caja = await cajaDe(form.locator(selector).first());
        anchuras.push(
          `    ${nombre} (${selector}): ancho=${Math.round(caja.ancho)} ` +
            `right=${Math.round(caja.derecha)} left=${Math.round(caja.izquierda)}`,
        );
      }
      const detalle = `a ${ancho} px (columna esperada ${COLUMNA_ESPERADA[ancho]} px, ventana ${
        await page.evaluate(() => document.documentElement.clientWidth)
      }):\n${anchuras.join('\n')}`;
      lineas.push(detalle);

      // (a) Nada dentro del formulario se sale de la ventana. M1: la medida que
      //     `overflow-x: hidden` no puede enmascarar.
      const m1 = await medirDesbordePorElemento(page, { raices: 'form.auth-form' });
      expect(m1.medidos, `no se midió ningún elemento del formulario a ${ancho} px`).toBeGreaterThan(
        5,
      );
      expect(
        m1.violaciones.length,
        `a ${ancho} px hay ${m1.violaciones.length} elementos del formulario de alta fuera de ` +
          `la ventana:\n${describirViolaciones(m1)}\n${detalle}`,
      ).toBe(0);

      // (b) Y cada control nombrado cabe en la columna que le toca.
      for (const [selector, nombre] of CONTROLES) {
        const caja = await cajaDe(form.locator(selector).first());
        expect(
          Math.round(caja.ancho),
          `«${nombre}» mide ${Math.round(caja.ancho)} px a ${ancho} px, y la columna del ` +
            `formulario es de ${COLUMNA_ESPERADA[ancho]}\n${detalle}`,
        ).toBeLessThanOrEqual(COLUMNA_ESPERADA[ancho]);
      }

      // (c) El propio formulario no genera desplazamiento interno: si lo hiciera,
      //     estaríamos moviendo el problema de sitio en vez de resolverlo.
      const propio = await form.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(
        propio.scrollWidth,
        `el formulario se desplaza por dentro a ${ancho} px: scrollWidth=${propio.scrollWidth} ` +
          `sobre clientWidth=${propio.clientWidth}\n${detalle}`,
      ).toBeLessThanOrEqual(propio.clientWidth + 1);
    }

    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(
      `${SHOTS}/medidas-formulario-alta.txt`,
      `SPEC-040 CA-1 — el formulario de alta de /vigiladas, medido en el navegador\n` +
        `${lineas.join('\n')}\n`,
      'utf8',
    );
    for (const ancho of ANCHOS_DEL_ALTA) {
      await ponerVentana(page, ancho);
      await page.screenshot({ path: `${SHOTS}/ancho-${ancho}-alta-formulario.png`, fullPage: true });
    }
  });
});

test('SPEC-040 CA-2: CE-1 entero en un teléfono de 360 px, sin desplazar la página', async ({
  page,
}) => {
  // Un desconocido que llega del foro no tiene cuenta: se registra aquí y ahora.
  const email = `spec040-movil-${Date.now()}@example.com`;
  await page.setViewportSize({ width: 360, height: altoPara(360) });

  await page.goto('/');
  await pulsarSinDesplazar(page, page.getByRole('link', { name: /crear cuenta|registr/i }).first(), 'el enlace de registro');
  await page.waitForURL('**/register');

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await pulsarSinDesplazar(page, page.locator('button[type="submit"]'), 'el botón de registro');
  await page.waitForURL('**/dashboard');

  // Al panel llega desde la navegación compartida, como llegaría una persona.
  await pulsarSinDesplazar(
    page,
    page.locator('.app-nav-links a[href="/vigiladas"]'),
    'el enlace Vigiladas de la navegación',
  );
  await page.waitForURL('**/vigiladas');

  const form = page.locator('form.auth-form');
  await form.waitFor({ state: 'visible' });

  // El buscador: teclear y ELEGIR un candidato de la lista. Elegir importa tanto como
  // teclear (R-1 de la spec): si el arreglo del ancho dejara el desplegable ilegible,
  // se perdería lo que entregó SPEC-029 —distinguir dos mercados del mismo ticker— y
  // esto lo notaría.
  const campo = form.locator('.symbol-search-input');
  const cajaCampo = await cajaDe(campo);
  expect(
    cajaCampo.derecha,
    `el campo de búsqueda se sale a 360 px: right=${Math.round(cajaCampo.derecha)} ` +
      `sobre ventana ${cajaCampo.ventana}`,
  ).toBeLessThanOrEqual(cajaCampo.ventana + 1);
  await campo.fill('Inditex');

  const candidato = form.locator('.symbol-result', { hasText: 'ITX' }).first();
  await candidato.waitFor({ state: 'visible' });
  await pulsarSinDesplazar(page, candidato, 'el candidato ITX del desplegable');
  await expect(form.locator('.symbol-chip-tk')).toContainText('ITX');

  for (const [selector, nombre, valor] of [
    ['input[name="buyMin"]', 'zona de compra (min)', '20'],
    ['input[name="buyMax"]', 'zona de compra (max)', '25'],
  ] as const) {
    const campoZona = form.locator(selector);
    const caja = await cajaDe(campoZona);
    expect(
      caja.derecha,
      `«${nombre}» se sale a 360 px: right=${Math.round(caja.derecha)} ` +
        `(ancho ${Math.round(caja.ancho)}) sobre ventana ${caja.ventana}`,
    ).toBeLessThanOrEqual(caja.ventana + 1);
    await campoZona.fill(valor);
  }

  await pulsarSinDesplazar(page, form.locator('button[type="submit"]'), 'el botón Vigilar');

  const fila = page.locator('tr', { hasText: 'ITX' });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('20 – 25');

  // Y el recorrido entero ocurrió sin que la página se fuera en horizontal.
  expect(await page.evaluate(() => window.scrollX)).toBe(0);

  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/ancho-360-ce1-completado.png`, fullPage: true });
});
