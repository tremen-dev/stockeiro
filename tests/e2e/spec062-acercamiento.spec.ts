import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { ESCALA_ACERCAMIENTO_PCT } from '../../src/lib/config/escala-acercamiento';
import { ANCHOS_TARJETA, TOLERANCIA_PX, ponerVentana } from './geometria';
import {
  ESCENARIO,
  SHOTS,
  laFila,
  ordenarPor,
  porCercaniaAscendente,
  prepararLista,
  tickersEnPantalla,
} from './spec062';

/**
 * SPEC-062 — **la barra de acercamiento, mirada en el navegador**.
 *
 * ## Qué prueba esto que no pruebe el unitario
 *
 * `tests/spec062-acercamiento.test.ts` demuestra que la **medida** es la que RN-18 dice.
 * Aquí se demuestra lo otro, que no es lo mismo: que la pantalla **la usa**, que la barra
 * **mide lo que dice medir** —la fracción pintada contra la fracción calculada, dos
 * medidas comparadas entre sí (ADR-035)— y que en un teléfono la tarjeta enseña lo mismo
 * que la tabla (ADR-034 §3).
 *
 * Una función pura correcta conectada a una barra que se pinta al 100% siempre pasaría el
 * unitario entero.
 */

const barra = (page: Page, ticker: string) => laFila(page, ticker).getByTestId('acercamiento');

/** La fracción REALMENTE pintada: ancho del relleno sobre ancho de su carril. */
async function fraccionPintada(page: Page, ticker: string): Promise<number> {
  const fila = laFila(page, ticker);
  const carril = (await fila.getByTestId('acercamiento-carril').boundingBox())!;
  const relleno = (await fila.getByTestId('acercamiento-relleno').boundingBox())!;
  return relleno.width / carril.width;
}

/** La fracción que la regla de CA-8 exige para el dato que la propia fila declara. */
async function fraccionEsperada(page: Page, ticker: string, escala: number): Promise<number> {
  const el = barra(page, ticker);
  if ((await el.getAttribute('data-dentro')) === 'true') return 1;
  const pct = Number(await el.getAttribute('data-porcentaje'));
  return Math.min(1, Math.max(0, 1 - pct / escala));
}

test.describe('SPEC-062 CA-6/CA-7: cada fila dice lo cerca que está, y de qué zona', () => {
  test('fuera de zona: barra, porcentaje y sentido; dentro: barra llena y sin porcentaje', async ({
    page,
  }) => {
    await prepararLista(page);

    // (a) Fuera, y por encima del rango: tiene que BAJAR.
    const cerca = barra(page, 'Z6CERCA');
    await expect(cerca).toHaveAttribute('data-zona', 'compra');
    await expect(cerca).toHaveAttribute('data-sentido', 'bajar');
    await expect(laFila(page, 'Z6CERCA').getByTestId('acercamiento-texto')).toContainText('0,5%');
    await expect(laFila(page, 'Z6CERCA').getByTestId('acercamiento-texto')).toContainText('compra');

    // (b) Dentro: la barra está, el porcentaje NO — lo dice la etiqueta de estado.
    const dentro = barra(page, 'Z6DENTRO');
    await expect(dentro).toHaveAttribute('data-dentro', 'true');
    await expect(laFila(page, 'Z6DENTRO').getByTestId('acercamiento-texto')).toHaveCount(0);
    await expect(laFila(page, 'Z6DENTRO').locator('.zone-label')).toHaveText('En zona de compra');

    // (c) Con las dos zonas, apunta a la más cercana: aquí, venta.
    const venta = barra(page, 'Z6VENTA');
    await expect(venta).toHaveAttribute('data-zona', 'venta');
    await expect(venta).toHaveAttribute('data-sentido', 'subir');
  });

  test('sin cotización o sin zonas no hay barra — y la fila sigue diciendo lo que ya decía', async ({
    page,
  }) => {
    await prepararLista(page);

    await expect(laFila(page, 'Z6SINQ').getByTestId('acercamiento')).toHaveCount(0);
    await expect(laFila(page, 'Z6SINQ').getByTestId('sin-datos-aun')).toBeVisible();

    await expect(laFila(page, 'Z6SINZONA').getByTestId('acercamiento')).toHaveCount(0);
    await expect(laFila(page, 'Z6SINZONA').locator('.zone-label')).toHaveText('Fuera de zona');
  });
});

test.describe('SPEC-062 CA-9: el sentido, porque un 3% arriba y un 3% abajo no son la misma noticia', () => {
  test('la que está por debajo de su zona dice SUBIR; la que está por encima, BAJAR', async ({
    page,
  }) => {
    await prepararLista(page);

    // Misma zona (90–100) en las dos filas; lo único que cambia es de qué lado cae el precio.
    await expect(barra(page, 'Z6DEBAJO')).toHaveAttribute('data-sentido', 'subir');
    await expect(barra(page, 'Z6LEJOS')).toHaveAttribute('data-sentido', 'bajar');

    const debajo = await laFila(page, 'Z6DEBAJO').getByTestId('acercamiento-texto').innerText();
    const encima = await laFila(page, 'Z6LEJOS').getByTestId('acercamiento-texto').innerText();
    expect(debajo).toContain('▲');
    expect(encima).toContain('▼');
    expect(debajo).not.toBe(encima);
  });

  test('el nombre accesible dice la frase entera, sin flechas ni barras', async ({ page }) => {
    await prepararLista(page);

    const nombre = (await barra(page, 'Z6DEBAJO').getAttribute('aria-label')) ?? '';
    expect(nombre).toMatch(/subir/i);
    expect(nombre).toMatch(/zona de compra/i);
    expect(nombre).not.toContain('▲');

    // Y dentro de zona también tiene nombre: la barra nunca es un adorno mudo.
    expect(await barra(page, 'Z6DENTRO').getAttribute('aria-label')).toMatch(/dentro de la zona/i);
  });
});

test.describe('SPEC-062 CA-8: la barra mide lo que dice medir', () => {
  test('la fracción pintada coincide con la calculada, fila a fila', async ({ page }) => {
    await prepararLista(page);

    /*
      ADR-035 — se comparan **dos medidas**: el ancho pintado del relleno sobre su carril,
      y la fracción que la regla de CA-8 da para el `data-porcentaje` que esa misma fila
      declara. No hay ningún número escrito a mano en la comparación, y la escala se
      **importa** de su único hogar en vez de teclearse aquí.
    */
    for (const ticker of ['Z6DENTRO', 'Z6CERCA', 'Z6CASI', 'Z6DEBAJO', 'Z6LEJOS', 'Z6VENTA']) {
      const pintada = await fraccionPintada(page, ticker);
      const esperada = await fraccionEsperada(page, ticker, ESCALA_ACERCAMIENTO_PCT);
      const carril = (await laFila(page, ticker).getByTestId('acercamiento-carril').boundingBox())!;

      expect(
        Math.abs(pintada - esperada) * carril.width,
        `${ticker}: la barra pinta ${(pintada * 100).toFixed(1)}% y el dato de su propia ` +
          `fila exige ${(esperada * 100).toFixed(1)}%`,
      ).toBeLessThanOrEqual(TOLERANCIA_PX);
    }
  });

  test('la escala declarada es la que se usa: a media distancia, media barra', async ({ page }) => {
    await prepararLista(page);

    // `Z6LEJOS` está a ~23%: por encima de cualquier escala razonable, barra vacía.
    expect(await fraccionPintada(page, 'Z6LEJOS')).toBeLessThanOrEqual(0.01);
    // Y el número NO se acota con ella: sigue diciendo la verdad entera.
    await expect(laFila(page, 'Z6LEJOS').getByTestId('acercamiento-texto')).toContainText('23,1%');

    // `Z6DENTRO` está dentro: barra llena.
    expect(await fraccionPintada(page, 'Z6DENTRO')).toBeGreaterThanOrEqual(0.99);

    // Y entre las dos, la más cercana pinta más barra que la más lejana. Sin esto, todo lo
    // anterior pasaría con una barra que fuera siempre 0 o siempre 1.
    expect(await fraccionPintada(page, 'Z6CERCA')).toBeGreaterThan(
      await fraccionPintada(page, 'Z6DEBAJO'),
    );
    expect(await fraccionPintada(page, 'Z6DEBAJO')).toBeGreaterThan(
      await fraccionPintada(page, 'Z6LEJOS'),
    );
  });
});

test.describe('SPEC-062 CA-13: el redondeo no fabrica una entrada en zona', () => {
  test('a 0,04% se lee «menos de 0,1%», y la fila sigue siendo una fila fuera de zona', async ({
    page,
  }) => {
    await prepararLista(page);

    const texto = await laFila(page, 'Z6CASI').getByTestId('acercamiento-texto').innerText();
    expect(texto).toContain('menos de 0,1%');
    expect(texto).not.toContain('0,0%');

    // Lo que separa a esta fila de la de al lado sigue estando donde siempre (SPEC-007).
    await expect(laFila(page, 'Z6CASI').locator('.zone-label')).toHaveText('Fuera de zona');
    await expect(laFila(page, 'Z6CASI')).toHaveClass(/zone-out/);
    await expect(laFila(page, 'Z6DENTRO')).toHaveClass(/zone-buy/);
  });
});

test.describe('SPEC-062 CA-14: sobre un precio sin refrescar, la barra se apaga con él', () => {
  test('la fila congelada marca su acercamiento; la fresca, no — y el número no se borra', async ({
    page,
  }) => {
    await prepararLista(page);

    await expect(barra(page, 'Z6VIEJA')).toHaveAttribute('data-sin-refrescar', 'true');
    await expect(laFila(page, 'Z6VIEJA').getByTestId('sin-refrescar')).toBeVisible();
    // Marcar no es borrar (RN-16): el porcentaje sigue ahí.
    await expect(laFila(page, 'Z6VIEJA').getByTestId('acercamiento-texto')).toContainText('%');

    // La dirección buena: una fila fresca NO lleva la marca.
    expect(await barra(page, 'Z6CERCA').getAttribute('data-sin-refrescar')).toBeNull();
  });
});

test.describe('SPEC-062 CA-11/CA-12: ordenar por cercanía', () => {
  test('«Cercanía» está entre los criterios, ordena, y lo que no se sabe queda al final', async ({
    page,
  }) => {
    await prepararLista(page);

    const criterios = await page.getByTestId('orden-criterio').locator('option').allInnerTexts();
    expect(criterios).toContain('Cercanía');

    await ordenarPor(page, 'cercania', 'asc');
    expect(await tickersEnPantalla(page)).toEqual(porCercaniaAscendente(ESCENARIO));

    // Descendente invierte a las que tienen medida, y NO a las que no la tienen.
    await ordenarPor(page, 'cercania', 'desc');
    const desc = await tickersEnPantalla(page);
    const sinMedida = ESCENARIO.filter((f) => f.price == null || (f.buyMin == null && f.sellMin == null))
      .map((f) => f.ticker)
      .sort();
    expect(desc.slice(-sinMedida.length).sort()).toEqual(sinMedida);
  });

  test('reordenar no cambia lo que dice ninguna fila', async ({ page }) => {
    await prepararLista(page);

    const leerFila = async (ticker: string) => ({
      texto: await laFila(page, ticker).getByTestId('acercamiento-texto').innerText(),
      zona: await barra(page, ticker).getAttribute('data-zona'),
      porcentaje: await barra(page, ticker).getAttribute('data-porcentaje'),
      estado: await laFila(page, ticker).locator('.zone-label').innerText(),
    });

    await ordenarPor(page, 'ticker', 'asc');
    const antes = await leerFila('Z6CERCA');
    await ordenarPor(page, 'cercania', 'desc');
    const despues = await leerFila('Z6CERCA');

    expect(despues).toEqual(antes);
    // Y la lista tiene las mismas filas, ni una más ni una menos.
    expect((await tickersEnPantalla(page)).sort()).toEqual(ESCENARIO.map((f) => f.ticker).sort());
  });

  test('los criterios de SPEC-041 siguen ordenando como antes', async ({ page }) => {
    await prepararLista(page);

    await ordenarPor(page, 'ticker', 'asc');
    const porTicker = await tickersEnPantalla(page);
    expect(porTicker).toEqual([...porTicker].sort());
  });
});

test.describe('SPEC-062 CA-6 (tarjeta): en un teléfono se lee lo mismo', () => {
  test('la tarjeta enseña la misma barra, el mismo número y el mismo nombre accesible', async ({
    page,
  }) => {
    await prepararLista(page);

    // Primero se lee en la tabla, con la ventana ancha.
    await ponerVentana(page, 1280);
    const enTabla = {
      texto: await laFila(page, 'Z6CERCA').getByTestId('acercamiento-texto').innerText(),
      nombre: await barra(page, 'Z6CERCA').getAttribute('aria-label'),
    };

    // Y luego en la tarjeta, a 390 px.
    await ponerVentana(page, 390);
    const tarjeta = page
      .getByTestId('tarjetas-vigiladas')
      .locator('li')
      .filter({ hasText: 'Z6CERCA' });
    await expect(tarjeta.getByTestId('acercamiento-tarjeta')).toBeVisible();
    expect(await tarjeta.getByTestId('acercamiento-texto-tarjeta').innerText()).toBe(enTabla.texto);
    expect(await tarjeta.getByTestId('acercamiento-tarjeta').getAttribute('aria-label')).toBe(
      enTabla.nombre,
    );
  });

  test('y la barra no desborda la tarjeta en ningún ancho de teléfono', async ({ page }) => {
    await prepararLista(page);
    mkdirSync(SHOTS, { recursive: true });

    for (const ancho of ANCHOS_TARJETA) {
      await ponerVentana(page, ancho);
      const desbordes = await page.evaluate(() => {
        const limite = document.documentElement.clientWidth;
        return [...document.querySelectorAll('.acercamiento, .acercamiento-carril')]
          .map((el) => ({ clase: el.className, derecha: el.getBoundingClientRect().right }))
          .filter((c) => c.derecha > limite + 1);
      });
      expect(desbordes, `a ${ancho} px la barra se sale de la pantalla`).toEqual([]);
    }

    await ponerVentana(page, 390);
    await page.screenshot({ path: `${SHOTS}/tarjetas-cercania-390.png`, fullPage: true });
    await ponerVentana(page, 1280);
    await page.screenshot({ path: `${SHOTS}/tabla-cercania-1280.png`, fullPage: true });
  });
});
