import { test, expect, type Page } from '@playwright/test';
import {
  ANCHOS,
  DEFECTO_SIN_SUPERFICIE,
  describirSuperficie,
  inyectarDefecto,
  medirSuperficieDeTexto,
  ponerVentana,
} from './geometria';
import { entrar, sembrarVigiladas, type FilaSembrada } from './spec041';

/**
 * SPEC-064 — **lo que la capa pinta, ¿tiene algo debajo?**
 *
 * ## Por qué existe esta guardia
 *
 * `dialog.editar-vigilada` va **sin fondo a propósito** desde SPEC-046: la superficie la
 * pone la tarjeta que contiene, y así la capa mide lo que mide su contenido. Cuando
 * SPEC-063 metió un segundo bloque **dentro de la capa y fuera de esa tarjeta**, ese bloque
 * se pintó sobre el velo translúcido: en producción, la tabla se leía **a través** del
 * texto de la nota.
 *
 * Y la batería entera estaba en verde. M1/M2 miden desborde, M3 integridad de palabra, M5
 * área táctil y SPEC-046 CA-6(f) el contraste del texto **de la tabla** con el velo puesto.
 * Ninguna preguntaba lo elemental. Esta lo pregunta.
 *
 * ## Cómo está escrita para que no caduque
 *
 * Se recorre **lo que la capa contenga** —no una lista de bloques conocidos—, así que el
 * próximo bloque que alguien añada ahí queda vigilado sin tocar este fichero. Lo que se
 * afirma es una **propiedad de la capa**, no la presencia de un `background` concreto en un
 * selector concreto: si mañana la superficie la pone otro elemento, esto sigue en verde; si
 * no la pone nadie, se pone rojo.
 */

const CUENTA = 'spec064-superficie@example.com';
const CAPA = 'dialog.editar-vigilada';

const ESCENARIO: FilaSembrada[] = [
  {
    ticker: 'Z5SUP',
    micCode: 'BMEX',
    name: 'Superficie SA',
    instrumentType: 'Common Stock',
    buyMin: '20',
    buyMax: '25',
    price: '22',
  },
];

async function abrirCapaConContexto(page: Page) {
  await entrar(page, CUENTA);
  await sembrarVigiladas(CUENTA, ESCENARIO);
  await page.goto('/vigiladas');
  await page.locator('table.data-table tbody tr').first().getByTestId('editar-zonas').click();
  await page.getByTestId('editar-panel').waitFor({ state: 'visible' });
  await page.getByTestId('contexto-resumen').click();
  await page.getByTestId('contexto-nota').waitFor({ state: 'visible' });
}

test.describe('SPEC-064 CA-1/CA-3: todo lo que la capa muestra tiene superficie opaca debajo', () => {
  test('con el contexto desplegado, ni un texto de la capa se pinta sobre el vacío', async ({
    page,
  }) => {
    await ponerVentana(page, 1280);
    await abrirCapaConContexto(page);

    const m = await medirSuperficieDeTexto(page, CAPA);

    // Centinela de no-vacuidad: sin esto, un selector equivocado daría verde sin mirar nada
    // — que es exactamente el modo de fallo que esta spec viene a cerrar.
    expect(m.medidos.length, 'la medida no encontró texto en la capa: está mirando mal').toBeGreaterThan(8);

    expect(m.sinSuperficie.map((s) => `${s.selector} «${s.texto}»`), describirSuperficie(m)).toEqual([]);
    expect(m.ilegibles.map((s) => `${s.selector} ${s.contraste}:1`), describirSuperficie(m)).toEqual([]);
  });

  test('y sigue siendo verdad a los ocho anchos declarados', async ({ page }) => {
    await abrirCapaConContexto(page);

    for (const ancho of ANCHOS) {
      await ponerVentana(page, ancho);
      await page.goto('/vigiladas');
      const editar =
        ancho > 720
          ? page.locator('table.data-table tbody tr').first().getByTestId('editar-zonas')
          : page.getByTestId('editar-zonas-tarjeta').first();
      await editar.click();
      await page.getByTestId('contexto-resumen').click();
      await page.getByTestId('contexto-nota').waitFor({ state: 'visible' });

      const m = await medirSuperficieDeTexto(page, CAPA);
      expect(m.medidos.length, `a ${ancho} px no se midió nada`).toBeGreaterThan(8);
      expect(m.sinSuperficie.map((s) => s.selector), `a ${ancho} px:\n${describirSuperficie(m)}`).toEqual([]);

      await page.keyboard.press('Escape');
    }
  });
});

test.describe('SPEC-064 CA-2: la guardia se pone roja con el defecto que hubo en producción', () => {
  test('quitarle el fondo al bloque de contexto la pone roja, y devolverlo la deja verde', async ({
    page,
  }) => {
    await ponerVentana(page, 1280);
    await abrirCapaConContexto(page);

    // (a) Verde antes de tocar nada.
    const antes = await medirSuperficieDeTexto(page, CAPA);
    expect(antes.sinSuperficie).toEqual([]);

    // (b) Con el defecto puesto —literalmente lo que había en producción— se pone ROJA.
    const quitar = await inyectarDefecto(page, DEFECTO_SIN_SUPERFICIE);
    const conDefecto = await medirSuperficieDeTexto(page, CAPA);
    expect(
      conDefecto.sinSuperficie.length,
      'la guardia NO ve el defecto que esta spec viene a cerrar: es una casilla, no una guardia',
    ).toBeGreaterThan(0);
    // Y lo que señala es el bloque de contexto, no un elemento cualquiera.
    expect(conDefecto.sinSuperficie.some((s) => s.selector.includes('contexto'))).toBe(true);

    // (c) Retirado el defecto, vuelve a verde: la guardia mide el defecto, no el momento.
    await quitar();
    const despues = await medirSuperficieDeTexto(page, CAPA);
    expect(despues.sinSuperficie).toEqual([]);
  });
});

test.describe('SPEC-064: el enlace usa el acento de la app, no el azul del navegador', () => {
  test('el color del enlace es el mismo que el de los enlaces de texto del producto', async ({
    page,
  }) => {
    await ponerVentana(page, 1280);
    await abrirCapaConContexto(page);

    await page.getByTestId('contexto-url').fill('https://es.tradingview.com/symbols/BME-ITX/');
    await page.getByTestId('contexto-enlace-anadir').click();
    await page.getByTestId('contexto-enlace').first().waitFor({ state: 'visible' });

    const color = await page
      .getByTestId('contexto-enlace')
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    /*
      El acento del sistema, resuelto POR EL NAVEGADOR sobre la propia página: no se teclea
      ningún color aquí. Se pinta una sonda con `color: var(--accent)` y se lee lo que sale
      — `getPropertyValue('--accent')` no vale, porque devuelve la cadena literal
      `var(--ember)` y asignarla en un estilo en línea no resuelve nada.
    */
    const acentoResuelto = await page.evaluate(() => {
      const sonda = document.createElement('span');
      sonda.style.color = 'var(--accent)';
      document.body.appendChild(sonda);
      const c = getComputedStyle(sonda).color;
      sonda.remove();
      return c;
    });

    expect(color, 'el enlace no usa el acento de la app').toBe(acentoResuelto);
    // La otra dirección: el azul por defecto del navegador NO es lo que se pinta.
    expect(color).not.toBe('rgb(0, 0, 238)');
  });
});
