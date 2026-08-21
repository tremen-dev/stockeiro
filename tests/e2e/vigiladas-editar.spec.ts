import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import {
  ANCHOS,
  TOLERANCIA_PX,
  describirViolaciones,
  medirDesbordeDeDocumento,
  medirDesbordePorElemento,
  medirIntegridadDePalabra,
  ponerVentana,
} from './geometria';
import { CADENCIA_LINEA } from '../../src/lib/help/content';
import { entrar, prepararLista, sembrarVigiladas, tickersEnPantalla, ordenarPor } from './spec041';

/**
 * SPEC-044 rebanada 5 — **ajustar las zonas desde la pantalla**, y lo que eso no puede
 * romper.
 *
 * ## Por qué CA-23 mide el panel ABIERTO
 *
 * «Fila + panel de edición abierto» es un estado que **sólo existe tras un clic**. Una
 * guardia que no lo diera dejaría de medirlo sin que ningún test se pusiera rojo: el
 * punto ciego exacto que ADR-026 existe para impedir, y el mismo motivo por el que
 * SPEC-041 tuvo que escribir su CA-22 al plegar el formulario de alta. Aquí se da el
 * clic y se mide a los **ocho** anchos del proyecto, con el panel cerrado y abierto.
 *
 * Ni una línea de medida se escribe en este fichero: se importa de `./geometria`, que es
 * el domicilio único que fijó ADR-026 §1.
 *
 * ## El cupo del registro
 *
 * La base del e2e es UNA y la comparten todas las specs; el grifo se siembra con cupo 50
 * (ADR-023 pto. 7) y la suite ya registra cuarenta y tantas cuentas. SPEC-044 da de alta
 * **una sola**, y sus tickers empiezan por `Z5` —el registro de símbolos es compartido
 * (ADR-002), así que escribir sobre `ITX` cambiaría lo que ven otras pruebas.
 */

const CUENTA = 'spec044-editar@example.com';
const SHOTS = '_qa/SPEC-044';

/** Dos filas: la que se edita y una testigo que tiene que quedarse quieta. */
const ESCENARIO = [
  {
    ticker: 'Z5EDIT',
    micCode: 'BMEX',
    name: 'Editable SA',
    instrumentType: 'Common Stock',
    buyMin: '12',
    buyMax: '14',
    sellMin: '20',
    sellMax: '22',
    price: '13',
  },
  {
    ticker: 'Z5TESTIGO',
    micCode: 'XNYS',
    name: 'Testigo SA',
    instrumentType: 'ETF',
    buyMin: '1',
    buyMax: '2',
    price: '99',
  },
];

const panel = (page: Page) => page.getByTestId('editar-panel');
const formEdicion = (page: Page) => page.getByTestId('editar-form');

/** El control «Editar» de la fila cuyo ticker se pasa. */
function editarDe(page: Page, ticker: string) {
  return page
    .locator('table.data-table tbody tr')
    .filter({ hasText: ticker })
    .getByTestId('editar-zonas');
}

/** La celda de zona de compra («12 – 14» o «—») de una fila. */
async function zonasDe(page: Page, ticker: string): Promise<[string, string]> {
  const celdas = page
    .locator('table.data-table tbody tr')
    .filter({ hasText: ticker })
    .locator('td.num');
  // Columnas: precio, a fecha, zona compra, zona venta.
  return [
    (await celdas.nth(2).innerText()).trim(),
    (await celdas.nth(3).innerText()).trim(),
  ];
}

async function abrirEdicion(page: Page, ticker: string): Promise<void> {
  await editarDe(page, ticker).click();
  await expect(formEdicion(page)).toBeVisible();
}

/* ────────────────────────────────────────────────────────────────────────────
   CA-19 / CA-20 — el panel, y de qué está hecho
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-044 CA-19: el control por fila abre un formulario con los valores actuales', async ({
  page,
}) => {
  await prepararLista(page, CUENTA, ESCENARIO);

  // (a) Cada fila tiene su control, y hasta que se pulsa no hay panel.
  await expect(page.getByTestId('editar-zonas')).toHaveCount(2);
  await expect(panel(page)).toHaveCount(0);

  await abrirEdicion(page, 'Z5EDIT');

  // (b) Los CUATRO campos, precargados con lo vigente.
  await expect(formEdicion(page).locator('input[name="buyMin"]')).toHaveValue('12');
  await expect(formEdicion(page).locator('input[name="buyMax"]')).toHaveValue('14');
  await expect(formEdicion(page).locator('input[name="sellMin"]')).toHaveValue('20');
  await expect(formEdicion(page).locator('input[name="sellMax"]')).toHaveValue('22');

  // (c) El activo se identifica —ticker y mercado— y NO se puede cambiar: sin buscador.
  const activo = formEdicion(page).getByTestId('editar-activo');
  await expect(activo).toContainText('Z5EDIT');
  await expect(activo).toContainText('BME');
  await expect(
    formEdicion(page).locator('.symbol-search-input'),
    'el panel de edición monta el buscador: el símbolo no se edita (ADR-028 pto. 8)',
  ).toHaveCount(0);

  // (d) Una zona SIN definir aparece vacía, no con `0`.
  await editarDe(page, 'Z5EDIT').click(); // cerrar
  await abrirEdicion(page, 'Z5TESTIGO');
  await expect(formEdicion(page).locator('input[name="sellMin"]')).toHaveValue('');
  await expect(formEdicion(page).locator('input[name="sellMax"]')).toHaveValue('');
});

test('SPEC-044 CA-20: el panel reutiliza la caja del alta, sin buscador y sin ancho propio', async ({
  page,
}) => {
  await prepararLista(page, CUENTA, ESCENARIO);
  await abrirEdicion(page, 'Z5EDIT');

  // Misma clase de formulario que el alta: `card auth-form` (SPEC-040 fija su caja).
  await expect(formEdicion(page)).toHaveClass(/auth-form/);
  await expect(formEdicion(page).locator('.zona-campos')).toHaveCount(2);

  // Y vive FUERA de `.table-scroll`: dentro quedaría en el subárbol de un contenedor
  // desplazable, donde M1 deja de medir (ADR-026 §4). Sería un punto ciego regalado.
  expect(
    await panel(page).evaluate((el) => el.closest('.table-scroll') !== null),
    'el panel de edición vive DENTRO de `.table-scroll`: ahí M1 deja de medirlo',
  ).toBe(false);

  // El panel no impone ancho: el que manda es el de `.auth-form` (SPEC-040).
  const cajas = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="editar-panel"]')!;
    const f = document.querySelector('[data-testid="editar-form"]')!;
    const estilo = getComputedStyle(p);
    return {
      panel: p.getBoundingClientRect().width,
      form: f.getBoundingClientRect().width,
      maxWidth: estilo.maxWidth,
    };
  });
  expect(cajas.maxWidth, 'el panel declara un `max-width` propio').toBe('none');
  expect(Math.abs(cajas.panel - cajas.form)).toBeLessThanOrEqual(1);
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-21 / CA-22 — guardar, fallar, y decir cuándo llega el aviso
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-044 CA-21: guardar cierra el panel y la tabla enseña los valores nuevos', async ({
  page,
}) => {
  await prepararLista(page, CUENTA, ESCENARIO);
  await abrirEdicion(page, 'Z5EDIT');

  // La zona nueva deja el precio (13) FUERA: el estado de zona se recalcula en render.
  await expect(page.locator('table.data-table tbody tr').filter({ hasText: 'Z5EDIT' })).toHaveClass(
    /zone-buy/,
  );
  await formEdicion(page).locator('input[name="buyMin"]').fill('30');
  await formEdicion(page).locator('input[name="buyMax"]').fill('40');
  await formEdicion(page).locator('button[type="submit"]').click();

  await expect(panel(page)).toHaveCount(0); // el panel se cierra
  await expect(async () => {
    expect((await zonasDe(page, 'Z5EDIT'))[0]).toBe('30 – 40');
  }).toPass();
  await expect(
    page.locator('table.data-table tbody tr').filter({ hasText: 'Z5EDIT' }),
    'el estado de zona no se recalculó: SPEC-007 CA-1 lo computa en render',
  ).toHaveClass(/zone-out/);

  // La testigo, intacta.
  expect((await zonasDe(page, 'Z5TESTIGO'))[0]).toBe('1 – 2');
});

test('SPEC-044 CA-21: un error de validación deja el panel abierto, con lo escrito y el mensaje', async ({
  page,
}) => {
  await prepararLista(page, CUENTA, ESCENARIO);
  await abrirEdicion(page, 'Z5EDIT');

  await formEdicion(page).locator('input[name="buyMin"]').fill('40');
  await formEdicion(page).locator('input[name="buyMax"]').fill('10');
  await formEdicion(page).locator('button[type="submit"]').click();

  await expect(formEdicion(page)).toBeVisible(); // sigue abierto
  await expect(page.getByTestId('editar-error')).toContainText('Zona de compra');
  await expect(formEdicion(page).locator('input[name="buyMin"]')).toHaveValue('40');
  await expect(formEdicion(page).locator('input[name="buyMax"]')).toHaveValue('10');
  expect((await zonasDe(page, 'Z5EDIT'))[0]).toBe('12 – 14'); // nada se guardó
});

test('SPEC-044 CA-22: al guardar, la pantalla dice que el aviso llega con el próximo ciclo', async ({
  page,
}) => {
  await prepararLista(page, CUENTA, ESCENARIO);

  // La edición mete el precio (99) en una zona en la que NO estaba.
  await abrirEdicion(page, 'Z5TESTIGO');
  await formEdicion(page).locator('input[name="buyMin"]').fill('90');
  await formEdicion(page).locator('input[name="buyMax"]').fill('110');
  await formEdicion(page).locator('button[type="submit"]').click();

  const aviso = page.getByTestId('edicion-cadencia');
  await expect(aviso).toBeVisible();
  // La MISMA frase que la primera pantalla, `/ayuda` y el estado vacío (SPEC-039 CA-3).
  await expect(aviso).toHaveText(CADENCIA_LINEA);
  // Y no se promete inmediatez por otro lado.
  await expect(page.locator('main')).not.toContainText('al instante');
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-24 — la tabla que ya existía no se degrada
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-044 CA-24: reordenar y editar edita LA FILA PULSADA, y la tabla sigue entera', async ({
  page,
}) => {
  await prepararLista(page, CUENTA, ESCENARIO);

  // Se reordena por Estado: `Z5EDIT` (buy) va antes que `Z5TESTIGO` (out); en descendente
  // se invierten. Lo que viaja con el control es el id de SU fila, no su posición.
  await ordenarPor(page, 'state', 'desc');
  const orden = await tickersEnPantalla(page);
  expect(orden[0]).toBe('Z5TESTIGO');

  await abrirEdicion(page, 'Z5EDIT');
  await expect(formEdicion(page).getByTestId('editar-activo')).toContainText('Z5EDIT');
  await formEdicion(page).locator('input[name="buyMin"]').fill('11');
  await formEdicion(page).locator('input[name="buyMax"]').fill('13');
  await formEdicion(page).locator('button[type="submit"]').click();

  await expect(async () => {
    expect((await zonasDe(page, 'Z5EDIT'))[0]).toBe('11 – 13');
  }).toPass();
  expect((await zonasDe(page, 'Z5TESTIGO'))[0], 'se editó la fila equivocada').toBe('1 – 2');

  // Lo que la tabla ya prometía sigue en pie (SPEC-029, SPEC-041 CA-17/CA-18, SPEC-043).
  const fila = page.locator('table.data-table tbody tr').filter({ hasText: 'Z5EDIT' });
  await expect(fila).toHaveClass(/zone-buy/);
  await expect(fila.locator('.zone-label')).toContainText('En zona de compra');
  await expect(fila.getByTestId('row-name')).toHaveText('Editable SA');
  await expect(fila.getByTestId('row-type')).not.toBeEmpty();
  await expect(fila.getByTestId('row-market')).toHaveText('BME');
});

test('SPEC-044 CA-24: el estado vacío no ve ningún control nuevo (SPEC-039 intacto)', async ({
  page,
}) => {
  await entrar(page, CUENTA);
  await sembrarVigiladas(CUENTA, []);
  await page.goto('/vigiladas');
  await page.getByTestId('vigiladas-vacio').waitFor({ state: 'visible' });

  await expect(page.getByTestId('editar-zonas')).toHaveCount(0);
  await expect(page.getByTestId('edicion-cadencia')).toHaveCount(0);
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-23 — geometría a los ocho anchos, con el panel CERRADO y ABIERTO
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-044 CA-23: M1, M2, M3 y alcance de los controles a los ocho anchos', async ({
  page,
}) => {
  test.slow();
  mkdirSync(SHOTS, { recursive: true });
  await prepararLista(page, CUENTA, ESCENARIO);

  const lineas: string[] = [];

  for (const ancho of ANCHOS) {
    for (const estado of ['cerrado', 'abierto'] as const) {
      await ponerVentana(page, ancho);

      const abierto = (await panel(page).count()) > 0;
      if (estado === 'abierto' && !abierto) await abrirEdicion(page, 'Z5EDIT');
      if (estado === 'cerrado' && abierto) {
        await editarDe(page, 'Z5EDIT').click();
        await expect(panel(page)).toHaveCount(0);
      }

      // (a) M1 — desborde por elemento. La medida principal: `overflow: hidden` no la
      //     puede enmascarar, que es justo lo que dejó a SPEC-040 en verde con el botón
      //     «Vigilar» fuera de la pantalla.
      const m1 = await medirDesbordePorElemento(page);
      expect(
        m1.medidos,
        `no se midió ningún elemento a ${ancho} px con el panel ${estado}`,
      ).toBeGreaterThan(5);
      expect(
        m1.violaciones.length,
        `a ${ancho} px con el panel de edición ${estado}, ${m1.violaciones.length} ` +
          `elementos se salen de la ventana.\n${describirViolaciones(m1)}`,
      ).toBe(0);

      // (b) M2 — desborde de documento. Nunca es la única medida (ADR-026 §1), pero es
      //     la que caza el tramo 721–800 px, donde no hay `hidden` que disimule.
      const m2 = await medirDesbordeDeDocumento(page);
      expect(
        m2.desborde,
        `a ${ancho} px con el panel ${estado} el documento mide ${m2.documento} sobre una ` +
          `ventana de ${m2.ventana}`,
      ).toBeLessThanOrEqual(TOLERANCIA_PX);

      lineas.push(
        `ancho ${ancho} · panel ${estado} · M1: ${m1.violaciones.length}/${m1.medidos} · ` +
          `M2: desborde ${m2.desborde} (doc ${m2.documento}, ventana ${m2.ventana})`,
      );

      await page.screenshot({
        path: `${SHOTS}/ca23-${ancho}-${estado}.png`,
        fullPage: true,
      });
    }

    // (c) SPEC-040 CA-5: desplazando `.table-scroll` a tope se alcanzan TODOS los
    //     controles de la fila, incluido el último. Con «Editar» son dos, y con SPEC-045
    //     serán tres: si a 360 px no caben con dignidad, la salida es apilarlos, nunca
    //     esconderlos (ADR-026 §4).
    await page.locator('.table-scroll').evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    const controles = page
      .locator('table.data-table tbody tr')
      .filter({ hasText: 'Z5EDIT' })
      .locator('.fila-acciones button');
    const total = await controles.count();
    expect(total, 'la fila perdió controles').toBeGreaterThanOrEqual(2);

    for (let i = 0; i < total; i++) {
      const medida = await controles.nth(i).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          derecha: r.right,
          izquierda: r.left,
          ventana: document.documentElement.clientWidth,
          texto: (el.textContent ?? '').trim(),
        };
      });
      expect(
        medida.derecha,
        `a ${ancho} px, con la tabla desplazada a tope, el control «${medida.texto}» sigue ` +
          `fuera: right=${Math.round(medida.derecha)} sobre ventana ${medida.ventana}`,
      ).toBeLessThanOrEqual(medida.ventana + TOLERANCIA_PX);
      expect(
        medida.izquierda,
        `a ${ancho} px el control «${medida.texto}» queda cortado por la izquierda`,
      ).toBeGreaterThanOrEqual(-TOLERANCIA_PX);
    }

    // (d) M3 — integridad de palabra. Ninguna etiqueta de los controles nuevos parte
    //     palabras: «Ac / cio / ne / s» no desborda nada, así que ni M1 ni M2 lo verían.
    const textos = await medirIntegridadDePalabra(page, '.fila-acciones button', 'td');
    expect(textos.length, 'M3 no midió ninguna etiqueta de los controles').toBeGreaterThan(0);
    for (const t of textos) {
      expect(
        t.lineas,
        `a ${ancho} px la etiqueta «${t.texto}» se reparte en ${t.lineas} líneas con ` +
          `${t.palabras} palabra(s): está partiendo palabras (M3)`,
      ).toBeLessThanOrEqual(Math.max(1, t.palabras));
    }
  }

  writeFileSync(
    `${SHOTS}/medidas-ca23.txt`,
    `SPEC-044 CA-23 — geometría con el panel de edición cerrado y abierto\n${lineas.join('\n')}\n`,
    'utf8',
  );
});
