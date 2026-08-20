import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { FAIL_REASON_TEXT } from '../../src/lib/market/fail-reason-text';
import { ponerVentana } from './geometria';
import {
  CUENTA_ALTA,
  CUENTA_ORDEN,
  CUENTA_QUITAR,
  ESCENARIO_ALTA,
  ESCENARIO_ORDEN,
  ESCENARIO_QUITAR,
  POR_ESTADO,
  POR_NOMBRE,
  POR_TICKER,
  SHOTS,
  ordenarPor,
  prepararLista,
  tickersEnPantalla,
} from './spec041';

/**
 * SPEC-041 — **la tabla de `/vigiladas`, mirada en el navegador**: el nombre del activo,
 * el reparto del ancho y el orden a elección.
 *
 * ## Qué prueba esto que no pruebe el test unitario
 *
 * `tests/vigiladas-orden.test.ts` demuestra que el **comparador** ordena como manda la
 * decisión de producto. Aquí se demuestra lo otro, que no es lo mismo: que la **pantalla
 * lo usa**, que reordenar **no va al servidor** (CA-10) y que después de reordenar cada
 * fila **sigue llevando lo suyo** — color de fondo, motivo, tipo, mercado, precio, `asOf`
 * y zonas (CA-17). Un comparador correcto conectado a la columna equivocada pasaría el
 * unitario y rompería la pantalla.
 *
 * ## El escenario
 *
 * Una fila por estado de zona, con nombres elegidos para que los tres criterios den
 * **tres secuencias distintas** (ver la tabla en `spec041.ts`). Si el orden por nombre
 * coincidiera con el orden por ticker, un test en verde no significaría nada.
 */

const laFila = (page: Page, ticker: string) =>
  page.locator('table.data-table tbody tr').filter({ hasText: ticker });

/* ────────────────────────────────────────────────────────────────────────────
   El nombre del activo
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('SPEC-041 CA-2/CA-3: el nombre del activo, bajo el ticker y sin inventarse ninguno', () => {
  test('la primera columna es «Activo» y lleva ticker + nombre en la misma celda, sin columnas nuevas', async ({
    page,
  }) => {
    await prepararLista(page, CUENTA_ORDEN, ESCENARIO_ORDEN);

    // (a) La tabla NO ha ganado columnas: las mismas nueve de antes de esta spec.
    const cabeceras = page.locator('table.data-table thead th');
    await expect(
      cabeceras,
      'la tabla ha cambiado de número de columnas: CA-2 exige exactamente las mismas ' +
        'nueve que antes de SPEC-041 — el nombre va en la celda del ticker, no aparte',
    ).toHaveCount(9);
    await expect(cabeceras.first()).toHaveText('Activo');

    // (b) Ticker destacado con su clase de siempre, y el nombre DEBAJO, en la misma celda.
    const celda = laFila(page, 'Z4BUY').locator('td').first();
    await expect(celda.locator('.ticker')).toHaveText('Z4BUY');
    await expect(celda.getByTestId('row-name')).toHaveText('iberdrola');

    const ticker = (await celda.locator('.ticker').boundingBox())!;
    const nombre = (await celda.getByTestId('row-name').boundingBox())!;
    expect(
      nombre.y,
      `el nombre no está DEBAJO del ticker (ticker y=${Math.round(ticker.y)}, nombre ` +
        `y=${Math.round(nombre.y)}): CA-2 pide ticker arriba como ancla y nombre debajo`,
    ).toBeGreaterThanOrEqual(ticker.y + ticker.height - 1);

    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/ca2-activo-con-nombre.png`, fullPage: true });
  });

  test('sin nombre no se inventa un nombre: la celda muestra SOLO el ticker', async ({ page }) => {
    await prepararLista(page, CUENTA_ORDEN, ESCENARIO_ORDEN);

    const celda = laFila(page, 'Z4NOFALLO').locator('td').first();
    // El elemento del nombre NO se renderiza. Nada de «—», «Sin nombre» ni «(desconocido)».
    await expect(
      celda.getByTestId('row-name'),
      'la fila sin nombre pinta un elemento de nombre: CA-3 dice que no se renderiza',
    ).toHaveCount(0);

    const texto = (await celda.innerText()).trim();
    expect(
      texto,
      `la celda «Activo» de un símbolo sin nombre dice «${texto}» y debería decir sólo ` +
        `su ticker: ni «—», ni «Sin nombre», ni el mercado, ni el ticker repetido`,
    ).toBe('Z4NOFALLO');

    // Y la fila es por lo demás idéntica a cualquier otra: sigue teniendo sus zonas.
    await expect(laFila(page, 'Z4NOFALLO')).toContainText('10 – 15');
    await page.screenshot({ path: `${SHOTS}/ca3-sin-nombre-solo-ticker.png`, fullPage: true });
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   El reparto del ancho
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('SPEC-041 CA-4/CA-5: `Estado` se estrecha, y no pierde ni una palabra', () => {
  test('a 1280 px la columna Estado no es más ancha que Activo, y el motivo sigue entero', async ({
    page,
  }) => {
    await prepararLista(page, CUENTA_ORDEN, ESCENARIO_ORDEN);
    await ponerVentana(page, 1280);

    const activo = (await page.locator('table.data-table thead th.col-activo').boundingBox())!;
    const estado = (await page.locator('table.data-table thead th.col-estado').boundingBox())!;

    // (a) El trato de esta spec, medido: el ancho que suelta `Estado` es el que ocupa el
    //     nombre. Antes, el párrafo del motivo estiraba `Estado` y era la columna más
    //     ancha de la tabla.
    expect(
      Math.round(estado.width),
      `a 1280 px la columna «Estado» mide ${Math.round(estado.width)} px y «Activo» ` +
        `${Math.round(activo.width)}: Estado sigue siendo la que se lleva el ancho`,
    ).toBeLessThanOrEqual(Math.round(activo.width));

    // (b) Y el motivo de SPEC-016 está ENTERO: sin recorte, sin «…», sin tooltip.
    const motivo = laFila(page, 'Z4NOFALLO').getByTestId('fail-reason');
    await expect(motivo).toBeVisible();
    const completo = FAIL_REASON_TEXT.sin_identidad_de_mercado;
    expect(await motivo.innerText()).toContain(completo);
    const recorte = await motivo.evaluate((el) => ({
      alto: el.scrollHeight,
      visible: el.clientHeight,
      ancho: el.scrollWidth,
      visibleAncho: el.clientWidth,
      overflow: getComputedStyle(el).textOverflow,
    }));
    expect(
      recorte.alto,
      `el motivo está recortado en vertical (${recorte.alto} sobre ${recorte.visible}): ` +
        `CA-4b pide que se ENVUELVA en varias líneas, no que se corte`,
    ).toBeLessThanOrEqual(recorte.visible + 1);
    expect(recorte.ancho, 'el motivo se desplaza dentro de su caja').toBeLessThanOrEqual(
      recorte.visibleAncho + 1,
    );
    expect(recorte.overflow, 'el motivo lleva puntos suspensivos: eso es perder texto').toBe(
      'clip',
    );

    // (c) La etiqueta más larga se lee en UNA sola línea.
    const etiqueta = laFila(page, 'Z4BOTH').locator('.zone-label');
    await expect(etiqueta).toContainText('En compra y venta');
    const lineas = await etiqueta.evaluate((el) => el.getClientRects().length);
    expect(
      lineas,
      `«En compra y venta» ocupa ${lineas} líneas: CA-4c pide una sola, sin partirse por ` +
        `la mitad de una palabra`,
    ).toBe(1);

    await page.screenshot({ path: `${SHOTS}/ca4-reparto-del-ancho.png`, fullPage: true });
  });

  test('las etiquetas de estado NO cambian: mismo texto, mismo punto, misma clase, mismo `data-state`', async ({
    page,
  }) => {
    await prepararLista(page, CUENTA_ORDEN, ESCENARIO_ORDEN);

    // Estrechar la columna es un cambio de LAYOUT, no de vocabulario: el rótulo es
    // dominio (*Estado de zona*) y esta spec no lo reescribe.
    const esperado: [string, string, string][] = [
      ['Z4BOTH', 'both', 'En compra y venta'],
      ['Z4BUY', 'buy', 'En zona de compra'],
      ['Z4SELL', 'sell', 'En zona de venta'],
      ['Z4OUT', 'out', 'Fuera de zona'],
      ['Z4NOPEND', 'none', 'Sin cotización'],
    ];
    for (const [ticker, estado, texto] of esperado) {
      const etiqueta = laFila(page, ticker).locator('.zone-label');
      await expect(etiqueta).toHaveText(new RegExp(texto));
      await expect(etiqueta).toHaveAttribute('data-state', estado);
      await expect(etiqueta).toHaveClass(new RegExp(`zone-label is-${estado}`));
      await expect(etiqueta.locator('.dot')).toHaveCount(1);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   El orden
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('SPEC-041 CA-6/CA-7/CA-8: el orden, en la pantalla', () => {
  test('sin tocar nada, las filas salen por ticker ascendente y el control dice «Ticker»', async ({
    page,
  }) => {
    await prepararLista(page, CUENTA_ORDEN, ESCENARIO_ORDEN);

    expect(await tickersEnPantalla(page)).toEqual(POR_TICKER);
    await expect(page.getByTestId('orden-criterio')).toHaveValue('ticker');
    await expect(page.getByTestId('orden-direccion')).toHaveAttribute('data-direccion', 'asc');

    // No hay orden recordado de una visita anterior (fuera de alcance por decisión de la
    // épica): se reordena, se vuelve, y sale otra vez el de por defecto.
    await ordenarPor(page, 'state', 'desc');
    expect(await tickersEnPantalla(page)).not.toEqual(POR_TICKER);
    await page.goto('/vigiladas');
    await page.locator('table.data-table').waitFor({ state: 'visible' });
    expect(
      await tickersEnPantalla(page),
      'al volver a la pantalla se recuerda el orden de la visita anterior: la épica lo ' +
        'excluye por escrito (preferencias persistidas)',
    ).toEqual(POR_TICKER);
  });

  test('por nombre: alfabético en español, sin mayúsculas ni acentos de por medio, y quien no tiene nombre no se cae', async ({
    page,
  }) => {
    await prepararLista(page, CUENTA_ORDEN, ESCENARIO_ORDEN);

    await ordenarPor(page, 'name', 'asc');
    expect(
      await tickersEnPantalla(page),
      '«iberdrola» en minúscula e «Índice Zeta» con tilde tienen que caer donde les toca ' +
        'alfabéticamente, y la fila SIN nombre por su ticker — nunca en un bloque mudo al final',
    ).toEqual(POR_NOMBRE);

    await ordenarPor(page, 'name', 'desc');
    expect(await tickersEnPantalla(page)).toEqual([...POR_NOMBRE].reverse());

    await page.screenshot({ path: `${SHOTS}/ca7-orden-por-nombre.png`, fullPage: true });
  });

  test('por estado: both → buy → sell → out → none, y dentro de `none` primero el que tiene motivo', async ({
    page,
  }) => {
    await prepararLista(page, CUENTA_ORDEN, ESCENARIO_ORDEN);

    await ordenarPor(page, 'state', 'asc');
    expect(
      await tickersEnPantalla(page),
      'el orden por estado no es el alfabético de las etiquetas: es la prioridad de ' +
        'producto ratificada en el gate — lo que reclama tu atención, primero',
    ).toEqual(POR_ESTADO);

    await ordenarPor(page, 'state', 'desc');
    expect(await tickersEnPantalla(page)).toEqual([...POR_ESTADO].reverse());

    await page.screenshot({ path: `${SHOTS}/ca8-orden-por-estado.png`, fullPage: true });
  });
});

test('SPEC-041 CA-10: ordenar no dispara ninguna consulta ni recarga la página', async ({
  page,
}) => {
  await prepararLista(page, CUENTA_ORDEN, ESCENARIO_ORDEN);

  // Lo que se ve AHORA, fila a fila: precio, fecha y estado. Después de reordenar tiene
  // que ser exactamente lo mismo — el estado de zona se sigue calculando en el servidor
  // con `entraEnZona` (RN-11 intacta, CE-M1); el cliente sólo cambia el orden.
  const retrato = async () =>
    Object.fromEntries(
      await Promise.all(
        POR_TICKER.map(async (t) => {
          const celdas = laFila(page, t).locator('td');
          return [
            t,
            {
              estado: await laFila(page, t).locator('.zone-label').getAttribute('data-state'),
              precio: (await celdas.nth(4).innerText()).trim(),
              asOf: (await celdas.nth(5).innerText()).trim(),
            },
          ] as const;
        }),
      ),
    );

  const antes = await retrato();
  const url = page.url();

  // Una marca que SÓLO sobrevive si no hubo navegación ni recarga.
  await page.evaluate(() => {
    (window as unknown as { __spec041: number }).__spec041 = 41;
  });

  const peticiones: string[] = [];
  page.on('request', (r) => peticiones.push(`${r.method()} ${r.url()}`));

  await ordenarPor(page, 'state', 'asc');
  await ordenarPor(page, 'name', 'desc');

  expect(
    peticiones,
    `ordenar disparó ${peticiones.length} peticiones de red. El orden vive en el cliente ` +
      `precisamente para no ir al servidor:\n${peticiones.join('\n')}`,
  ).toEqual([]);
  expect(page.url(), 'ordenar cambió la URL: el orden no viaja en la dirección').toBe(url);
  expect(
    await page.evaluate(() => (window as unknown as { __spec041?: number }).__spec041),
    'la página se recargó al ordenar: la marca puesta antes ya no está',
  ).toBe(41);

  await ordenarPor(page, 'ticker', 'asc');
  expect(await retrato(), 'los datos de las filas cambiaron al reordenar').toEqual(antes);
});

test('SPEC-041 CA-11: el control de orden se alcanza en móvil, fuera de la tabla y con `aria-sort`', async ({
  page,
}) => {
  await prepararLista(page, CUENTA_ORDEN, ESCENARIO_ORDEN);
  await ponerVentana(page, 390);

  const control = page.getByTestId('orden-control');
  await expect(control).toBeVisible();

  // (a) Vive FUERA de `.table-scroll`. Dentro sería inalcanzable justo donde hace falta:
  //     en móvil la tabla desborda su caja y sus cabeceras se salen de la pantalla.
  expect(
    await control.evaluate((el) => el.closest('.table-scroll') !== null),
    'el control de orden vive DENTRO de `.table-scroll`: en móvil habría que arrastrar la ' +
      'tabla para encontrarlo, que es lo que CA-11 viene a impedir',
  ).toBe(false);

  // (b) Y se ve entero sin desplazar nada.
  const caja = await control.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { izquierda: r.left, derecha: r.right, ventana: document.documentElement.clientWidth };
  });
  expect(caja.derecha, `el control se sale por la derecha: right=${Math.round(caja.derecha)}`)
    .toBeLessThanOrEqual(caja.ventana + 1);
  expect(caja.izquierda).toBeGreaterThanOrEqual(-1);
  expect(await page.evaluate(() => window.scrollX), 'la página está desplazada a lo ancho').toBe(0);

  // (c) Los tres criterios y las dos direcciones, todos alcanzables.
  const criterios = await page.getByTestId('orden-criterio').locator('option').allInnerTexts();
  expect(criterios).toEqual(['Ticker', 'Nombre', 'Estado']);

  // (d) La columna por la que se ordena queda marcada con `aria-sort` para el lector de
  //     pantalla — que es lo que se ofrece a cambio de no tener cabeceras pinchables.
  const thActivo = page.locator('table.data-table thead th.col-activo');
  const thEstado = page.locator('table.data-table thead th.col-estado');

  await ordenarPor(page, 'ticker', 'asc');
  await expect(thActivo).toHaveAttribute('aria-sort', 'ascending');
  await expect(thEstado).toHaveAttribute('aria-sort', 'none');

  await ordenarPor(page, 'name', 'desc');
  await expect(thActivo).toHaveAttribute('aria-sort', 'descending');

  await ordenarPor(page, 'state', 'asc');
  await expect(thEstado).toHaveAttribute('aria-sort', 'ascending');
  await expect(thActivo).toHaveAttribute('aria-sort', 'none');

  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/ca11-control-de-orden-movil.png`, fullPage: true });
});

/* ────────────────────────────────────────────────────────────────────────────
   Cero regresión
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-041 CA-17: tras reordenar por Nombre y por Estado, cada fila conserva LO SUYO', async ({
  page,
}) => {
  await prepararLista(page, CUENTA_ORDEN, ESCENARIO_ORDEN);
  await ordenarPor(page, 'name', 'asc');
  await ordenarPor(page, 'state', 'desc');

  // SPEC-007: el color de fondo sigue siendo el de SU estado, no el de su posición.
  for (const [ticker, estado] of [
    ['Z4BOTH', 'both'],
    ['Z4BUY', 'buy'],
    ['Z4SELL', 'sell'],
    ['Z4OUT', 'out'],
    ['Z4NOFALLO', 'none'],
  ] as const) {
    await expect(laFila(page, ticker)).toHaveClass(new RegExp(`zone-${estado}`));
  }

  // SPEC-016 CE-F2: el motivo con su marca y su `data-reason`, y el «aún sin datos» del
  // que simplemente espera al ciclo. Los dos casos siguen distinguiéndose.
  const motivo = laFila(page, 'Z4NOFALLO').getByTestId('fail-reason');
  await expect(motivo).toHaveAttribute('data-reason', 'sin_identidad_de_mercado');
  await expect(motivo).toContainText('No se vigila');
  await expect(laFila(page, 'Z4NOFALLO').getByTestId('sin-datos-aun')).toHaveCount(0);
  await expect(laFila(page, 'Z4NOPEND').getByTestId('sin-datos-aun')).toBeVisible();
  await expect(laFila(page, 'Z4NOPEND').getByTestId('fail-reason')).toHaveCount(0);

  // SPEC-029 CA-13/CA-14: tipo y mercado, y la celda de mercado VACÍA cuando no se sabe
  // —ni «—» ni inventado—.
  await expect(laFila(page, 'Z4OUT').getByTestId('row-type')).toHaveText('REIT');
  await expect(laFila(page, 'Z4SELL').getByTestId('row-market')).toHaveText('NYSE');
  expect(
    (await laFila(page, 'Z4NOFALLO').getByTestId('row-market').innerText()).trim(),
    'la celda de mercado de un símbolo sin identidad de mercado dejó de estar vacía',
  ).toBe('');
  expect((await laFila(page, 'Z4NOFALLO').getByTestId('row-type').innerText()).trim()).toBe('');

  // D-2: precio y `asOf` siguen a la vista; y las zonas de compra y de venta.
  await expect(laFila(page, 'Z4BOTH')).toContainText('28');
  await expect(laFila(page, 'Z4BOTH')).toContainText('2026-07-13');
  await expect(laFila(page, 'Z4BOTH')).toContainText('20 – 30');
  await expect(laFila(page, 'Z4BOTH')).toContainText('25 – 35');

  await page.screenshot({ path: `${SHOTS}/ca17-cero-regresion-tras-ordenar.png`, fullPage: true });
});

test('SPEC-041 CA-18: quitar borra la fila que se pulsó, esté donde esté tras ordenar', async ({
  page,
}) => {
  await prepararLista(page, CUENTA_QUITAR, ESCENARIO_QUITAR);

  // El mismo ticker en dos mercados son DOS vigiladas (ADR-007), y sólo el mercado —y la
  // zona— las distinguen en pantalla.
  await expect(laFila(page, 'Z4DUAL')).toHaveCount(2);

  // Se reordena para que la posición de cada fila difiera de la original: si «Quitar»
  // viajara con el índice en vez de con el `watchedId`, aquí se llevaría la otra.
  await ordenarPor(page, 'state', 'desc');
  const orden = await tickersEnPantalla(page);
  expect(orden.length).toBe(3);

  const nyse = page.locator('table.data-table tbody tr').filter({ hasText: '60 – 65' });
  await expect(nyse).toHaveCount(1);
  await nyse.locator('button', { hasText: 'Quitar' }).click();

  // Estado final POSITIVO: queda UNA fila de Z4DUAL, la de BME, y la otra vigilada sigue.
  await expect(laFila(page, 'Z4DUAL')).toHaveCount(1);
  await expect(page.locator('table.data-table tbody tr').filter({ hasText: '10 – 15' })).toHaveCount(1);
  await expect(page.locator('table.data-table tbody tr').filter({ hasText: '60 – 65' })).toHaveCount(0);
  await expect(laFila(page, 'Z4SOLO')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('Acciones vigiladas');
  await expect(page.locator('body')).not.toContainText("This page couldn't load");

  await page.screenshot({ path: `${SHOTS}/ca18-quitar-tras-ordenar.png`, fullPage: true });
});

test('SPEC-041 CA-20: cada usuario ve sólo las suyas, ordene como ordene', async ({ page }) => {
  await prepararLista(page, CUENTA_ALTA, ESCENARIO_ALTA);
  await ordenarPor(page, 'name', 'desc');

  expect(await tickersEnPantalla(page)).toEqual(['Z4ALTA']);
  // Ordenar en cliente NO amplía el conjunto de datos que llega al navegador: lo que se
  // serializa es la salida de `zoneStatusForUser` para ESE usuario. Si las filas del otro
  // viajaran «por si acaso», estarían en el documento aunque no se pintaran.
  const documento = await page.content();
  for (const ajeno of ['Z4BOTH', 'Z4BUY', 'Z4SELL', 'Z4NOFALLO']) {
    expect(
      documento.includes(ajeno),
      `la página de ${CUENTA_ALTA} contiene «${ajeno}», que es de otro usuario`,
    ).toBe(false);
  }

  await prepararLista(page, CUENTA_ORDEN, ESCENARIO_ORDEN);
  await ordenarPor(page, 'state', 'asc');
  expect(await tickersEnPantalla(page)).toEqual(POR_ESTADO);
  expect((await page.content()).includes('Z4ALTA')).toBe(false);
});
