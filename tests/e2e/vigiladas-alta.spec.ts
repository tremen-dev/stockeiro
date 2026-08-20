import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import {
  CADENCIA_LINEA,
  RUTA_AYUDA,
  VACIO_VIGILADAS,
} from '../../src/lib/help/content';
import {
  TOLERANCIA_PX,
  describirViolaciones,
  medirDesbordePorElemento,
  ponerVentana,
} from './geometria';
import {
  CUENTA_ALTA,
  CUENTA_VACIA,
  ESCENARIO_ALTA,
  SHOTS,
  entrar,
  prepararLista,
  sembrarVigiladas,
} from './spec041';

/**
 * SPEC-041 CA-12 a CA-16, CA-21 y CA-22 — **el alta que sólo aparece cuando se va a
 * usar**, y lo que eso no puede romper.
 *
 * ## Las dos mitades, y por qué van juntas en un fichero
 *
 * Plegar el formulario tiene **dos consecuencias que no se ven la una a la otra**:
 *
 *  1. **De producto** (CA-12..CA-16): quien llega con cero vigiladas no puede perder el
 *     primer paso, y quien ya tiene lista gana la pantalla que ocupaba un formulario que
 *     casi nunca usa.
 *  2. **De guardia** (CA-22): hasta esta spec `<WatchForm />` estaba **siempre** en el
 *     DOM, así que la barrida elemento a elemento de SPEC-040 lo medía en las dos rutas
 *     que recorre. Con el plegado, en `/vigiladas` **con filas** el formulario deja de
 *     existir hasta que alguien pulse el control: **esa medición desaparecería sola, sin
 *     que ningún test se pusiera rojo**. Es exactamente la clase de punto ciego que
 *     ADR-026 existe para impedir, y sería una ironía crearlo nosotros.
 *
 * CA-22 es el CA que existe **por** esta spec: da el clic que faltaba y mide el estado
 * nuevo —«lista con filas + alta desplegada»— con **M1** del módulo compartido, a 360 y
 * a 390 px. Ni una línea de medida se escribe aquí: se importa de `./geometria`, que es
 * el domicilio único que fijó ADR-026.
 *
 * ## Lo que esta spec NO decide
 *
 * **Cuánto mide** el formulario —anchos, `min-width`, cómo encogen el buscador y los
 * campos de zona— es de SPEC-040 (EPIC-FIX). Aquí sólo se decide **cuándo está a la
 * vista**. Si CA-22 se pusiera rojo con un control fuera de la ventana, el arreglo
 * viviría allí, no aquí.
 */

const ANCHOS_DEL_ALTA = [360, 390] as const;

const alta = (page: Page) => page.locator('form.auth-form');
const toggle = (page: Page) => page.getByTestId('alta-toggle');

/** Deja la cuenta vacía realmente vacía y entra: el escenario de CA-12 y CA-21. */
async function conListaVacia(page: Page): Promise<void> {
  await entrar(page, CUENTA_VACIA);
  await sembrarVigiladas(CUENTA_VACIA, []);
  await page.goto('/vigiladas');
  await page.getByTestId('vigiladas-vacio').waitFor({ state: 'visible' });
}

/* ────────────────────────────────────────────────────────────────────────────
   Con la lista vacía: nada cambia, y no puede cambiar
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-041 CA-12: con la lista vacía el alta sigue desplegada, y justo donde SPEC-039 promete', async ({
  page,
}) => {
  await conListaVacia(page);

  // (a) Desplegada y utilizable SIN ningún clic previo.
  await expect(alta(page)).toBeVisible();
  await expect(alta(page).locator('.symbol-search-input')).toBeVisible();
  await expect(alta(page).locator('input[name="buyMin"]')).toBeVisible();
  await expect(alta(page).locator('button[type="submit"]')).toBeVisible();

  // (b) Y no hay NINGÚN control intermedio que pulsar. Es una exigencia literal:
  //     `VACIO_VIGILADAS.primerPaso` dice «Empieza aquí abajo…», o sea una promesa de
  //     POSICIÓN. Un botón entre el texto y el formulario deja a la app mintiendo.
  expect(VACIO_VIGILADAS.primerPaso).toContain('aquí abajo');
  await expect(
    toggle(page),
    'con la lista vacía aparece el control de desplegar: CA-12 exige que el formulario ' +
      'esté a la vista sin nada que pulsar entre el estado vacío y él',
  ).toHaveCount(0);

  // (c) El formulario va INMEDIATAMENTE DESPUÉS del bloque del estado vacío.
  const posicion = await page.evaluate(() => {
    const vacio = document.querySelector('[data-testid="vigiladas-vacio"]')!;
    const form = document.querySelector('form.auth-form')!;
    return {
      // Node.DOCUMENT_POSITION_FOLLOWING === 4
      despues: (vacio.compareDocumentPosition(form) & 4) !== 0,
      hermanoSiguiente: vacio.nextElementSibling === form,
      yVacio: vacio.getBoundingClientRect().bottom,
      yForm: form.getBoundingClientRect().top,
    };
  });
  expect(posicion.despues, 'el formulario está POR ENCIMA del bloque del estado vacío').toBe(true);
  expect(
    posicion.hermanoSiguiente,
    'entre el bloque del estado vacío y el formulario se ha colado otro elemento: ' +
      '«Empieza aquí abajo…» tiene que apuntar al formulario y a nada más',
  ).toBe(true);
  expect(posicion.yForm).toBeGreaterThanOrEqual(posicion.yVacio - 1);

  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/ca12-vacio-con-alta-desplegada.png`, fullPage: true });
});

test('SPEC-041 CA-21: el estado vacío que dejó SPEC-039 sigue intacto, palabra por palabra', async ({
  page,
}) => {
  await conListaVacia(page);

  const vacio = page.getByTestId('vigiladas-vacio');
  await expect(vacio).toBeVisible();

  // Los textos se siguen leyendo de `src/lib/help/content.ts`: esta spec no los copia, no
  // los mueve de fichero y no los reescribe. Por eso se comparan contra el MÓDULO, no
  // contra una cadena tecleada aquí — una copia local pasaría en verde mientras la
  // pantalla dijera otra cosa.
  await expect(vacio.locator('.empty-title')).toHaveText(VACIO_VIGILADAS.titulo);
  expect(await vacio.innerText()).toContain(VACIO_VIGILADAS.primerPaso);
  const ejemplo = VACIO_VIGILADAS.ejemplo ?? '';
  expect(ejemplo, 'VACIO_VIGILADAS se quedó sin ejemplo: eso es SPEC-039 CA-9 roto').not.toBe('');
  await expect(page.getByTestId('vigiladas-vacio-ejemplo')).toHaveText(ejemplo);
  expect(await page.getByTestId('vigiladas-vacio-ejemplo').innerText()).toMatch(/\d/);
  await expect(page.getByTestId('vigiladas-vacio-cadencia')).toHaveText(CADENCIA_LINEA);
  await expect(vacio.locator(`a[href="${RUTA_AYUDA}"]`)).toHaveCount(1);
});

/* ────────────────────────────────────────────────────────────────────────────
   Con lista: el alta se pliega
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-041 CA-13: con al menos una fila el alta está plegada tras un control explícito', async ({
  page,
}) => {
  await prepararLista(page, CUENTA_ALTA, ESCENARIO_ALTA);

  // (a) El formulario NO está en pantalla: ni sus campos ni el buscador.
  await expect(alta(page)).toHaveCount(0);
  await expect(page.locator('.symbol-search-input')).toHaveCount(0);
  await expect(page.locator('input[name="buyMin"]')).toHaveCount(0);

  // (b) Hay un control visible que dice qué hace, y declara que está plegado.
  await expect(toggle(page)).toBeVisible();
  await expect(toggle(page)).toHaveText('+ Vigilar una acción');
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');

  await page.screenshot({ path: `${SHOTS}/ca13-alta-plegada.png`, fullPage: true });

  // (c) Al activarlo aparece EN LA MISMA PÁGINA, sin navegar, y el buscador recibe el foco.
  const url = page.url();
  await toggle(page).click();
  await expect(alta(page)).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  expect(page.url(), 'desplegar el alta navegó a otra ruta').toBe(url);
  await expect(alta(page).locator('.symbol-search-input')).toBeFocused();

  await page.screenshot({ path: `${SHOTS}/ca13-alta-desplegada.png`, fullPage: true });

  // Y al volver a activarlo, se pliega.
  await toggle(page).click();
  await expect(alta(page)).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
});

test('SPEC-041 CA-14: plegada, la zona de alta ocupa menos, y nada se sale por el lado derecho', async ({
  page,
}) => {
  await prepararLista(page, CUENTA_ALTA, ESCENARIO_ALTA);
  await ponerVentana(page, 390);

  const zona = page.locator('.alta-vigilada');
  const plegada = (await zona.boundingBox())!.height;

  // M1 de ADR-026 — la medida que `overflow-x: hidden` NO puede enmascarar. La redacción
  // anterior de este CA usaba `document.body.scrollWidth <= window.innerWidth`, que es
  // justo la medida ciega: por debajo de 720 px el sistema de diseño recorta al hijo sin
  // mover ese número, así que el CA habría pasado en verde con medio formulario fuera.
  const m1 = await medirDesbordePorElemento(page);
  expect(m1.medidos, 'no se midió ningún elemento a 390 px').toBeGreaterThan(5);
  expect(
    m1.violaciones.length,
    `con el alta plegada a 390 px hay ${m1.violaciones.length} elementos fuera de la ` +
      `ventana:\n${describirViolaciones(m1)}`,
  ).toBe(0);

  // El desborde horizontal de la tabla, si lo hay, sigue confinado a su contenedor.
  const caja = await page.locator('.table-scroll').evaluate((el) => ({
    overflowX: getComputedStyle(el).overflowX,
    contenido: el.scrollWidth,
    visible: el.clientWidth,
  }));
  expect(caja.overflowX, 'ADR-026 §4: el desplazamiento vive en `.table-scroll`').toBe('auto');

  await toggle(page).click();
  await expect(alta(page)).toBeVisible();
  const desplegada = (await zona.boundingBox())!.height;

  expect(
    Math.round(plegada),
    `la zona de alta plegada ocupa ${Math.round(plegada)} px y desplegada ` +
      `${Math.round(desplegada)}: plegar no está devolviendo pantalla a la tabla (CE-M4)`,
  ).toBeLessThan(Math.round(desplegada));

  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(
    `${SHOTS}/medidas-alta-plegable.txt`,
    `SPEC-041 CA-14 — /vigiladas con filas a 390 px\n` +
      `  zona de alta plegada:    ${Math.round(plegada)} px de alto\n` +
      `  zona de alta desplegada: ${Math.round(desplegada)} px de alto\n` +
      `  M1: ${m1.violaciones.length} violaciones sobre ${m1.medidos} elementos medidos\n` +
      `  .table-scroll[overflow-x=${caja.overflowX} contenido=${caja.contenido} visible=${caja.visible}]\n`,
    'utf8',
  );
});

test('SPEC-041 CA-15: dar de alta varias seguidas sigue siendo un flujo, y un error nunca queda escondido', async ({
  page,
}) => {
  await prepararLista(page, CUENTA_ALTA, ESCENARIO_ALTA);
  await toggle(page).click();
  await expect(alta(page)).toBeVisible();

  // --- El alta con ÉXITO: pasar de 1 a 2 filas no vuelve a plegar el formulario.
  const form = alta(page);
  await form.locator('.symbol-search-input').fill('Inditex');
  await form.locator('.symbol-result', { hasText: 'ITX' }).first().click();
  await expect(form.locator('.symbol-chip-tk')).toContainText('ITX');
  await form.locator('input[name="buyMin"]').fill('20');
  await form.locator('input[name="buyMax"]').fill('25');
  await form.locator('button[type="submit"]').click();

  await expect(page.locator('table.data-table tbody tr').filter({ hasText: 'ITX' })).toBeVisible();
  await expect(
    alta(page),
    'tras un alta con éxito el formulario se plegó: dar de alta varias seguidas volvería ' +
      'a ser un ritual de dos clics por acción (CA-15)',
  ).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  // Y limpio, listo para la siguiente (V-SPEC-008-1).
  await expect(alta(page).locator('.symbol-chip-tk')).toHaveCount(0);
  await expect(alta(page).locator('input[name="buyMin"]')).toHaveValue('');

  // --- El alta que FALLA: el mensaje se ve, con el formulario desplegado.
  await alta(page).locator('.symbol-search-input').fill('Apple');
  await alta(page).locator('.symbol-result', { hasText: 'AAPL' }).first().click();
  await alta(page).locator('input[name="buyMin"]').fill('30');
  await alta(page).locator('input[name="buyMax"]').fill('10'); // min > max, SPEC-003
  await alta(page).locator('button[type="submit"]').click();

  await expect(alta(page)).toBeVisible();
  await expect(alta(page).locator('.auth-error')).toContainText('mínimo no puede ser mayor');
  await page.screenshot({ path: `${SHOTS}/ca15-error-a-la-vista.png`, fullPage: true });
});

test('SPEC-041 CA-16: plegar descarta lo escrito, y se comporta igual siempre', async ({ page }) => {
  await prepararLista(page, CUENTA_ALTA, ESCENARIO_ALTA);
  await toggle(page).click();

  const form = alta(page);
  await form.locator('.symbol-search-input').fill('Repsol');
  await form.locator('.symbol-result', { hasText: 'REP' }).first().click();
  await expect(form.locator('.symbol-chip-tk')).toContainText('REP');
  await form.locator('input[name="buyMin"]').fill('11');
  await form.locator('input[name="sellMax"]').fill('99');

  await toggle(page).click();
  await expect(alta(page)).toHaveCount(0);
  await toggle(page).click();

  // Plegar DESCARTA: no guarda un borrador. Es la misma semántica que el reset tras un
  // alta con éxito, y se declara para que no sea una sorpresa.
  await expect(alta(page).locator('.symbol-chip-tk')).toHaveCount(0);
  await expect(alta(page).locator('.symbol-search-input')).toHaveValue('');
  await expect(alta(page).locator('input[name="buyMin"]')).toHaveValue('');
  await expect(alta(page).locator('input[name="sellMax"]')).toHaveValue('');
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-22 — el estado nuevo es un estado MEDIDO, no un hueco
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-041 CA-22: «lista con filas + alta desplegada» se mide con M1 a 360 y 390 px', async ({
  page,
}) => {
  await prepararLista(page, CUENTA_ALTA, ESCENARIO_ALTA);

  const lineas: string[] = [];
  for (const ancho of ANCHOS_DEL_ALTA) {
    await ponerVentana(page, ancho);

    // El clic que faltaba. Sin él, este estado del formulario no existe en el DOM y la
    // barrida de SPEC-040 sobre `/vigiladas` con filas dejaría de alcanzarlo — en
    // silencio, que es la única forma en que un punto ciego se abre.
    if ((await toggle(page).getAttribute('aria-expanded')) === 'false') await toggle(page).click();
    await expect(alta(page)).toBeVisible();

    // M1 acotada al formulario y todo su contenido: `right <= innerWidth + 1` y
    // `left >= -1`, elemento a elemento.
    const m1 = await medirDesbordePorElemento(page, { raices: 'form.auth-form' });
    expect(
      m1.medidos,
      `no se midió ningún elemento del formulario a ${ancho} px: el clic de CA-13 no lo ` +
        `desplegó, y esta guardia estaría midiendo el vacío`,
    ).toBeGreaterThan(5);
    lineas.push(
      `ancho ${ancho} · con filas + alta desplegada · M1: ${m1.violaciones.length} ` +
        `violaciones sobre ${m1.medidos} elementos medidos (ventana ${m1.ventana})`,
    );
    expect(
      m1.violaciones.length,
      `a ${ancho} px, con la lista con filas y el alta desplegada, ${m1.violaciones.length} ` +
        `elementos del formulario se salen de la ventana. La CAJA del formulario es ` +
        `territorio de SPEC-040 (ADR-026): el arreglo vive allí, pero el estado lo mide ` +
        `esta spec porque antes no existía.\n${describirViolaciones(m1)}`,
    ).toBe(0);

    // Y la página entera con ese formulario desplegado, no sólo el formulario: un panel
    // que empuje a un hermano se vería aquí y no en la medida acotada.
    const pagina = await medirDesbordePorElemento(page);
    expect(
      pagina.violaciones.length,
      `a ${ancho} px, con el alta desplegada sobre una lista con filas, hay elementos de ` +
        `la PÁGINA fuera de la ventana:\n${describirViolaciones(pagina)}`,
    ).toBe(0);
    lineas.push(
      `ancho ${ancho} · página completa · M1: ${pagina.violaciones.length} violaciones ` +
        `sobre ${pagina.medidos} elementos medidos`,
    );

    // El control de plegar también tiene que caber: es el único camino al formulario.
    const boton = await toggle(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { derecha: r.right, izquierda: r.left, ventana: document.documentElement.clientWidth };
    });
    expect(
      boton.derecha,
      `el control «+ Vigilar una acción» se sale por la derecha a ${ancho} px: ` +
        `right=${Math.round(boton.derecha)} sobre ventana ${boton.ventana}`,
    ).toBeLessThanOrEqual(boton.ventana + TOLERANCIA_PX);
    expect(boton.izquierda).toBeGreaterThanOrEqual(-TOLERANCIA_PX);

    await page.screenshot({
      path: `${SHOTS}/ca22-ancho-${ancho}-filas-y-alta-desplegada.png`,
      fullPage: true,
    });
  }

  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(
    `${SHOTS}/medidas-ca22-estado-nuevo.txt`,
    `SPEC-041 CA-22 — M1 sobre el estado «lista con filas + alta desplegada»\n${lineas.join('\n')}\n`,
    'utf8',
  );
});
