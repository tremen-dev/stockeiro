import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import {
  ANCHOS,
  TOLERANCIA_PX,
  describirRespuestaAlGesto,
  describirViolaciones,
  medirDesbordeDeDocumento,
  medirDesbordePorElemento,
  medirIntegridadDePalabra,
  medirRespuestaAlGesto,
  ponerVentana,
  type MedidaM4,
} from './geometria';
import { CADENCIA_LINEA } from '../../src/lib/help/content';
import { entrar, ordenarPor, sembrarVigiladas } from './spec041';
import {
  ANCHO_DE_DERIVACION,
  CUENTA,
  SHOTS,
  TICKER_DUAL,
  TICKER_SIN_ZONA_DE_VENTA,
  ZONAS_DUAL,
  afirmarListaLarga,
  cadencia,
  capa,
  cerrarCapa,
  derivarListaLarga,
  editarEnFila,
  filaDual,
  filas,
  formEdicion,
  listaLarga,
  posiciones,
  subirDelTodo,
} from './spec046';

/**
 * SPEC-046 — **la capa de edición se abre donde el usuario mira, y aquí se mide**.
 *
 * ## Lo que esta guardia hace y la anterior no
 *
 * `vigiladas-editar.spec.ts` (SPEC-044 CA-23) ya medía el panel de edición a los ocho
 * anchos, con M1, M2 y M3, y **pasaba** mientras el defecto estaba entregado. Dos motivos,
 * los dos corregidos aquí:
 *
 *  1. **Medía el eje equivocado.** Las tres medidas de ADR-026 preguntan *«¿cabe a lo
 *     ancho?»*. Un panel a 2.400 px por debajo del pliegue cabe perfectamente. La pregunta
 *     que faltaba —*«¿lo ve quien acaba de pulsar?»*— es **M4**, y vive en el módulo
 *     compartido (ADR-030 §3), no aquí.
 *  2. **Medía un escenario donde el defecto no puede existir.** Dos filas. Aquí la lista
 *     se **deriva** hasta que su fondo cae por debajo del pliegue y **se afirma antes de
 *     medir**, en el ancho que se está midiendo (CA-11, ADR-030 §4).
 *
 * Y se mide en las **tres posiciones** de la lista, porque cada una mata una solución
 * equivocada distinta: la primera mata el panel al final, la última mataría un panel al
 * principio, la intermedia mata las dos.
 *
 * Ni una línea de medida se escribe en este fichero: se importa de `./geometria`.
 */

/** Cuántas filas hizo falta sembrar para que la lista sea larga de verdad (CA-11). */
let FILAS_TOTAL = 0;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    FILAS_TOTAL = await derivarListaLarga(page);
    console.log(
      `[SPEC-046] escenario derivado: ${FILAS_TOTAL} filas hacen que el fondo de la tabla ` +
        `caiga por debajo del pliegue a ${ANCHO_DE_DERIVACION} px`,
    );
  } finally {
    await page.close();
  }
});

/**
 * Entra, deja la lista larga recién sembrada y la pinta. Cada test parte de lo mismo.
 *
 * ── ADAPTACIÓN DE SPEC-054 (a qué se espera, no qué se exige) ─────────────────────────
 *
 * **Es lo único que cambia en este fichero, y no es una aserción: es una espera.** Desde
 * SPEC-054 / ADR-034 §1, `/vigiladas` monta la fila dos veces y el `@media` de 720 px
 * apaga la que no toca. Varios casos de aquí recorren los ocho anchos y vuelven a preparar
 * la lista **con la ventana ya estrecha**, así que esperar a `table.data-table` visible se
 * quedaba esperando para siempre a un árbol que a ese ancho está apagado a propósito.
 *
 * Se espera a que **la lista esté pintada**, sea cual sea su forma — que es la
 * precondición que este helper siempre quiso decir. Todo lo demás de este fichero, incluida
 * cada una de sus aserciones, se queda exactamente como estaba: `filas`, `editarEnFila` y
 * la precondición de lista larga ya apuntan solas a la representación viva desde
 * `spec046.ts`.
 */
async function prepararLista(page: Page): Promise<void> {
  await entrar(page, CUENTA);
  await sembrarVigiladas(CUENTA, listaLarga(FILAS_TOTAL));
  await page.goto('/vigiladas');
  await page
    .locator('table.data-table, ul[data-testid="tarjetas-vigiladas"]')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible' });
}

/** Las cuatro casillas de zona de la capa. */
const campo = (page: Page, nombre: string) => formEdicion(page).locator(`input[name="${nombre}"]`);

/** Afirma M4 sobre una medida ya tomada, con la cifra en el mensaje. */
function afirmarM4(m: MedidaM4): void {
  expect(
    m.dentroDeLaVentana,
    `la superficie que abre el gesto NO cabe en la ventana. ${describirRespuestaAlGesto(m)}. ` +
      `Es el defecto que SPEC-046 arregla: para el usuario, el botón no hace nada`,
  ).toBe(true);
  expect(
    m.desplazoElDocumento,
    `el gesto DESPLAZÓ el documento para enseñar la respuesta. ` +
      `${describirRespuestaAlGesto(m)}. M4 dice «la respuesta va donde está el usuario», ` +
      `no «el usuario va donde está la respuesta» (ADR-030 §3)`,
  ).toBe(false);
}

/* ────────────────────────────────────────────────────────────────────────────
   CA-1 y CA-2 — el caso reportado, y las tres posiciones
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-046 CA-1/CA-11: la primera fila de una lista larga abre la capa dentro de la ventana, a los ocho anchos', async ({
  page,
}) => {
  test.slow();
  mkdirSync(SHOTS, { recursive: true });
  await prepararLista(page);

  const lineas: string[] = [];

  for (const ancho of ANCHOS) {
    await ponerVentana(page, ancho);
    await subirDelTodo(page);

    // CA-11: la precondición se AFIRMA antes de medir. Sin lista larga, el defecto que
    // esta spec arregla no puede existir y medirlo no demostraría nada.
    const precondicion = await afirmarListaLarga(page, ancho);

    const antes = await page.evaluate(() => window.scrollY);
    expect(antes, `el caso reportado es con la página SIN desplazar, y está en ${antes}`).toBeLessThanOrEqual(
      TOLERANCIA_PX,
    );

    const m4 = await medirRespuestaAlGesto(page, {
      disparador: editarEnFila(page, 0),
      revelado: capa(page),
      etiqueta: `${ancho} px · primera fila de ${precondicion.elementos}`,
    });
    afirmarM4(m4);

    // Y lo que se ve es un formulario utilizable, no una franja vacía: título, los cuatro
    // campos y el botón de guardar.
    await expect(formEdicion(page).getByText('Editar zonas')).toBeVisible();
    for (const nombre of ['buyMin', 'buyMax', 'sellMin', 'sellMax']) {
      await expect(campo(page, nombre)).toBeVisible();
    }
    await expect(formEdicion(page).locator('button[type="submit"]')).toBeVisible();

    lineas.push(
      `${describirRespuestaAlGesto(m4)} · precondición: fondo de la tabla en ` +
        `${Math.round(precondicion.fondo)} (${Math.round(precondicion.porDebajoDelPliegue)} px ` +
        `por debajo del pliegue) con ${precondicion.elementos} filas`,
    );

    // CA-17(b): el «después», a 360 y 1280, con la capa dentro de la ventana.
    if (ancho === 360 || ancho === 1280) {
      await page.screenshot({ path: `${SHOTS}/despues-${ancho}.png` });
    }
    await cerrarCapa(page);
  }

  writeFileSync(
    `${SHOTS}/medidas-m4-primera-fila.txt`,
    `SPEC-046 CA-1/CA-2 — M4 sobre la PRIMERA fila, a los ocho anchos\n${lineas.join('\n')}\n`,
    'utf8',
  );
});

test('SPEC-046 CA-2: las tres posiciones de la lista, con la página arriba y desplazada', async ({
  page,
}) => {
  test.slow();
  mkdirSync(SHOTS, { recursive: true });
  await prepararLista(page);

  const lineas: string[] = [];

  for (const ancho of [360, 1280] as const) {
    await ponerVentana(page, ancho);
    await subirDelTodo(page);
    const precondicion = await afirmarListaLarga(page, ancho);

    for (const pos of posiciones(precondicion.elementos)) {
      // (i) Con la página arriba del todo: el usuario alcanza su control y pulsa.
      await subirDelTodo(page);
      const arriba = await medirRespuestaAlGesto(page, {
        disparador: editarEnFila(page, pos.indice),
        revelado: capa(page),
        etiqueta: `${ancho} px · fila ${pos.nombre} (${pos.indice}) · página arriba`,
      });
      afirmarM4(arriba);
      lineas.push(describirRespuestaAlGesto(arriba));
      await cerrarCapa(page);

      // (ii) Y con la página DESPLAZADA hasta tener esa fila a la vista, que es como se
      //      llega de verdad a la fila intermedia y a la última.
      if (pos.nombre === 'primera') continue;
      await filas(page)
        .nth(pos.indice)
        .evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const desplazada = await medirRespuestaAlGesto(page, {
        disparador: editarEnFila(page, pos.indice),
        revelado: capa(page),
        etiqueta: `${ancho} px · fila ${pos.nombre} (${pos.indice}) · página desplazada`,
        alcanzarDisparador: false,
      });
      afirmarM4(desplazada);
      lineas.push(describirRespuestaAlGesto(desplazada));
      await cerrarCapa(page);
    }
  }

  // CA-17(c): el fichero de medidas de M4 para las tres posiciones.
  writeFileSync(
    `${SHOTS}/medidas-m4-tres-posiciones.txt`,
    `SPEC-046 CA-2 — M4 en las tres posiciones de la lista, a 360 y 1280 px\n` +
      `${lineas.join('\n')}\n`,
    'utf8',
  );
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-3 — la capa es la de la fila que pulsaste, y esa fila se sabe cuál es
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-046 CA-3: la capa nombra la fila pulsada, trae sus valores y la deja marcada', async ({
  page,
}) => {
  await prepararLista(page);
  await ponerVentana(page, 1280);
  const precondicion = await afirmarListaLarga(page, 1280);

  // (a) En las tres posiciones, la capa habla de ESA fila.
  for (const pos of posiciones(precondicion.elementos)) {
    const fila = filas(page).nth(pos.indice);
    const ticker = (await fila.locator('.ticker').innerText()).trim();
    const mercado = (await fila.getByTestId('row-market').innerText()).trim();

    await editarEnFila(page, pos.indice).click();
    await expect(formEdicion(page)).toBeVisible();

    const activo = formEdicion(page).getByTestId('editar-activo');
    await expect(activo, `la capa no nombra el ticker de la fila ${pos.nombre}`).toContainText(
      ticker,
    );
    if (mercado !== '') {
      await expect(activo, `la capa no nombra el mercado de la fila ${pos.nombre}`).toContainText(
        mercado,
      );
    }
    // El nombre accesible de la capa dice de qué activo habla (ADR-030 §2).
    const etiqueta = (await capa(page).getAttribute('aria-label')) ?? '';
    expect(
      etiqueta,
      `la capa no tiene nombre accesible que nombre al activo: «${etiqueta}». Una capa que ` +
        `no dice de qué fila habla reintroduce el problema en su versión semántica`,
    ).toContain(ticker);

    // (b) La fila que se edita queda MARCADA, y sólo ella.
    await expect(filas(page).locator('[data-editando="true"]')).toHaveCount(0);
    await expect(page.locator('tr[data-editando="true"]')).toHaveCount(1);
    await expect(fila).toHaveAttribute('data-editando', 'true');
    const marca = await fila.evaluate((el) => {
      const s = getComputedStyle(el);
      return { estilo: s.outlineStyle, ancho: parseFloat(s.outlineWidth || '0') };
    });
    expect(
      marca.estilo !== 'none' && marca.ancho > 0,
      `la fila en edición no se distingue en pantalla (outline ${marca.estilo} ` +
        `${marca.ancho}px): detrás del velo hay que poder encontrarla`,
    ).toBe(true);

    await cerrarCapa(page);
    // Y deja de estarlo al cerrar.
    await expect(page.locator('tr[data-editando="true"]')).toHaveCount(0);
  }

  // (c) El caso que de verdad lo prueba: el MISMO ticker en dos mercados (ADR-007).
  await expect(filas(page).filter({ hasText: TICKER_DUAL })).toHaveCount(2);

  await filaDual(page, 'BME').getByTestId('editar-zonas').click();
  await expect(formEdicion(page).getByTestId('editar-activo')).toContainText('BME');
  await expect(campo(page, 'buyMin')).toHaveValue(ZONAS_DUAL.BMEX.buyMin);
  await expect(campo(page, 'buyMax')).toHaveValue(ZONAS_DUAL.BMEX.buyMax);
  await expect(campo(page, 'sellMin')).toHaveValue(ZONAS_DUAL.BMEX.sellMin);
  await expect(campo(page, 'sellMax')).toHaveValue(ZONAS_DUAL.BMEX.sellMax);
  await expect(filaDual(page, 'BME')).toHaveAttribute('data-editando', 'true');
  await cerrarCapa(page);

  await filaDual(page, 'NYSE').getByTestId('editar-zonas').click();
  await expect(formEdicion(page).getByTestId('editar-activo')).toContainText('NYSE');
  await expect(
    campo(page, 'buyMin'),
    'la capa se abrió con los valores de la OTRA vigilada del mismo ticker',
  ).toHaveValue(ZONAS_DUAL.XNYS.buyMin);
  await expect(campo(page, 'sellMax')).toHaveValue(ZONAS_DUAL.XNYS.sellMax);
  await expect(filaDual(page, 'NYSE')).toHaveAttribute('data-editando', 'true');
  await expect(filaDual(page, 'BME')).not.toHaveAttribute('data-editando', 'true');
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-4 — anclada a la VENTANA, no al documento
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-046 CA-4: la caja de la capa no depende del desplazamiento de nada', async ({
  page,
}) => {
  await prepararLista(page);
  await ponerVentana(page, 360);
  // El alto de la ventana sale de la medida del módulo: ninguna guardia lo calcula por
  // su cuenta (CA-9, misma regla binaria que SPEC-040 CA-6 con `scrollWidth`).
  const { ventanaAlto } = await afirmarListaLarga(page, 360);

  /** Abre la capa tras dejar la página como diga `situar`, y devuelve su caja. */
  async function cajaCon(situar: () => Promise<void>) {
    await situar();
    await editarEnFila(page, 0).click();
    await expect(capa(page)).toBeVisible();
    const caja = await capa(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        position: s.position,
        fueraDeLaTabla: el.closest('.table-scroll') === null,
      };
    });
    await cerrarCapa(page);
    return caja;
  }

  const arriba = await cajaCon(() => subirDelTodo(page));
  const abajo = await cajaCon(async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  });
  const tablaArrastrada = await cajaCon(async () => {
    await subirDelTodo(page);
    await page.locator('.table-scroll').evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
  });

  // (a) Anclada a la ventana.
  expect(
    arriba.position,
    `la capa no está anclada a la ventana (position: ${arriba.position}). Toda la decisión ` +
      `de ADR-030 §1 es que su caja se defina respecto al viewport`,
  ).toBe('fixed');

  // (b) Y sigue FUERA de `.table-scroll`, que es lo que SPEC-044 protegía.
  expect(
    arriba.fueraDeLaTabla,
    'la capa vive DENTRO de `.table-scroll`: ahí M1 deja de medirla (ADR-026 §4)',
  ).toBe(true);

  // (c) La propiedad estructural entera, como medida: la misma caja en los tres casos.
  for (const [nombre, otra] of [
    ['con la página al fondo', abajo],
    ['con la tabla arrastrada a su extremo derecho', tablaArrastrada],
  ] as const) {
    for (const lado of ['top', 'bottom', 'left', 'right'] as const) {
      expect(
        Math.abs(otra[lado] - arriba[lado]),
        `${nombre}, la capa cambia de sitio: ${lado} ${Math.round(arriba[lado])} → ` +
          `${Math.round(otra[lado])}. Su caja tiene que ser la misma pase lo que pase con ` +
          `el desplazamiento (ADR-030 §1)`,
      ).toBeLessThanOrEqual(TOLERANCIA_PX);
    }
  }

  // (d) Anclada al borde INFERIOR: el pulgar está abajo, y lo que queda a la vista por
  //     encima es la parte alta de la lista (ADR-030 §1).
  expect(
    arriba.bottom,
    `la capa no está anclada al borde inferior: bottom=${Math.round(arriba.bottom)} sobre ` +
      `una ventana de ${ventanaAlto} px`,
  ).toBeGreaterThanOrEqual(ventanaAlto - TOLERANCIA_PX);
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-5 — el vehículo, y lo que la plataforma da hecho
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-046 CA-5: `<dialog>` modal, foco que entra, fondo inerte y foco que vuelve', async ({
  page,
}) => {
  await prepararLista(page);
  await ponerVentana(page, 1280);
  await afirmarListaLarga(page, 1280);

  // El disparador declara lo que hace: abre un diálogo. Y NO dice `aria-expanded`, que
  // prometería contenido desplegado en flujo, justo donde ya no aparece (ADR-030 §2).
  const disparador = editarEnFila(page, 0);
  await expect(disparador).toHaveAttribute('aria-haspopup', 'dialog');
  expect(
    await disparador.getAttribute('aria-expanded'),
    'el disparador sigue diciendo `aria-expanded`: engaña al lector de pantalla sobre ' +
      'dónde va a aparecer el contenido',
  ).toBeNull();

  await disparador.click();
  await expect(capa(page)).toBeVisible();

  // (a) Es un `<dialog>` y está abierto con `showModal()`, no con `open`.
  const vehiculo = await capa(page).evaluate((el) => ({
    etiqueta: el.tagName,
    modal: el.matches(':modal'),
    focoDentro: el.contains(document.activeElement),
  }));
  expect(vehiculo.etiqueta, 'la capa no es un `<dialog>` nativo').toBe('DIALOG');
  expect(
    vehiculo.modal,
    'la capa no está abierta con `showModal()`: sin eso no hay capa superior, ni fondo ' +
      'inerte, ni `::backdrop`, y la trampa de foco habría que escribirla a mano',
  ).toBe(true);
  // (b) El foco ENTRA en ella al abrirse.
  expect(vehiculo.focoDentro, 'al abrir la capa, el foco se quedó fuera').toBe(true);

  // (c) El fondo queda inerte: ni se puede enfocar…
  const enfocable = await page.evaluate(() => {
    const ajeno = document.querySelector<HTMLElement>('[data-testid="orden-criterio"]')!;
    ajeno.focus();
    return document.activeElement === ajeno;
  });
  expect(enfocable, 'con la capa abierta, un control del fondo sigue siendo enfocable').toBe(
    false,
  );
  // …ni se puede activar con el ratón.
  const direccion = page.getByTestId('orden-direccion');
  const antes = await direccion.getAttribute('data-direccion');
  const caja = await direccion.boundingBox();
  if (caja) await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  expect(
    await direccion.getAttribute('data-direccion'),
    'con la capa abierta, un clic en el fondo ACTIVÓ un control de la tabla',
  ).toBe(antes);

  // (d) Escape cierra, y el foco vuelve al control que la abrió.
  await page.keyboard.press('Escape');
  await expect(capa(page)).toHaveCount(0);
  expect(
    await disparador.evaluate((el) => el === document.activeElement),
    'tras cerrar con Escape, el foco no volvió al control «Editar» de su fila: el usuario ' +
      'se queda sin saber dónde estaba',
  ).toBe(true);

  // (e) Y por cancelar, lo mismo.
  await disparador.click();
  await page.getByTestId('editar-cancelar').click();
  await expect(capa(page)).toHaveCount(0);
  expect(
    await disparador.evaluate((el) => el === document.activeElement),
    'tras cancelar, el foco no volvió al control «Editar» de su fila',
  ).toBe(true);
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-6, CA-7 y CA-8 — la capa cabe, se mide, y su caja sigue siendo la del alta
   ──────────────────────────────────────────────────────────────────────────── */

const SELECTOR_CAPA = 'dialog[data-testid="editar-panel"]';

test('SPEC-046 CA-6/CA-7/CA-8: M1, M2 y M3 con la capa abierta, y la capa dentro de la medida', async ({
  page,
}) => {
  test.slow();
  mkdirSync(SHOTS, { recursive: true });
  await prepararLista(page);

  const lineas: string[] = [];

  for (const ancho of ANCHOS) {
    await ponerVentana(page, ancho);
    await subirDelTodo(page);
    await afirmarListaLarga(page, ancho);

    await editarEnFila(page, 0).click();
    await expect(capa(page)).toBeVisible();

    // (a) M1 — y CA-7(b): la capa ENTRÓ en el conjunto medido. Una medida que no la mide
    //     tampoco la puede aprobar, y esconderla en las exclusiones sería F-ADR-026-2.
    const m1 = await medirDesbordePorElemento(page, { testigos: SELECTOR_CAPA });
    expect(m1.medidos, `no se midió ningún elemento a ${ancho} px`).toBeGreaterThan(5);
    expect(
      m1.testigos,
      `a ${ancho} px la capa de edición NO aparece entre los elementos que M1 midió, ` +
        `aunque está abierta. O la excluye alguien, o la exime un contenedor desplazable: ` +
        `en los dos casos su «cero violaciones» no aprueba nada (CA-7b, ADR-030 §5)`,
    ).not.toEqual([]);
    expect(
      m1.violaciones.length,
      `a ${ancho} px, con la capa de edición abierta, ${m1.violaciones.length} elementos se ` +
        `salen de la ventana.\n${describirViolaciones(m1)}`,
    ).toBe(0);

    // (b) M2 — el documento no se desplaza a lo ancho.
    const m2 = await medirDesbordeDeDocumento(page);
    expect(
      m2.desborde,
      `a ${ancho} px con la capa abierta el documento mide ${m2.documento} sobre una ` +
        `ventana de ${m2.ventana}`,
    ).toBeLessThanOrEqual(TOLERANCIA_PX);

    // (c) y (d) — la capa no se desplaza a lo ancho, y si no cabe a lo alto el
    //     desplazamiento es VERTICAL, PROPIO y DECLARADO (ADR-026 §4, segunda salida).
    const propia = await capa(page).evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowX: s.overflowX,
        overflowY: s.overflowY,
      };
    });
    expect(
      propia.scrollWidth - propia.clientWidth,
      `a ${ancho} px la capa se desplaza a lo ancho (${propia.scrollWidth}/` +
        `${propia.clientWidth}). Además de estar mal, dispara la exención de contenedor ` +
        `desplazable de M1 y su subárbol deja de medirse`,
    ).toBeLessThanOrEqual(TOLERANCIA_PX);
    expect(
      ['auto', 'scroll'],
      `a ${ancho} px la capa declara \`overflow-y: ${propia.overflowY}\`. Ante un contenido ` +
        `más alto que la ventana las salidas son dos (ADR-026 §4): que quepa, o que el ` +
        `desplazamiento viva DENTRO de ella y esté declarado. \`hidden\` no es un arreglo`,
    ).toContain(propia.overflowY);

    // (e) M3 — ninguna etiqueta ni rótulo de la capa parte palabras.
    const textos = await medirIntegridadDePalabra(
      page,
      `${SELECTOR_CAPA} strong, ${SELECTOR_CAPA} label, ${SELECTOR_CAPA} button, ` +
        `${SELECTOR_CAPA} [data-testid="editar-activo"]`,
      SELECTOR_CAPA,
    );
    expect(textos.length, 'M3 no midió ningún rótulo de la capa').toBeGreaterThan(0);
    for (const t of textos) {
      expect(
        t.lineas,
        `a ${ancho} px el rótulo «${t.texto}» se reparte en ${t.lineas} líneas con ` +
          `${t.palabras} palabra(s): está partiendo palabras (M3)`,
      ).toBeLessThanOrEqual(Math.max(1, t.palabras));
    }

    // CA-8 — la caja del formulario sigue siendo la que fijó SPEC-040, y la capa no
    //        impone un ancho propio distinto.
    await expect(formEdicion(page)).toHaveClass(/auth-form/);
    await expect(formEdicion(page).locator('.symbol-search-input')).toHaveCount(0);
    const cajas = await page.evaluate((selector) => {
      const c = document.querySelector(selector)!;
      const f = document.querySelector('[data-testid="editar-form"]')!;
      return { capa: c.getBoundingClientRect().width, form: f.getBoundingClientRect().width };
    }, SELECTOR_CAPA);
    expect(
      Math.abs(cajas.capa - cajas.form),
      `a ${ancho} px la capa (${Math.round(cajas.capa)}) y el formulario ` +
        `(${Math.round(cajas.form)}) ya no miden lo mismo: la capa está declarando un ancho ` +
        `propio y la caja dejó de ser la de \`.auth-form\` (SPEC-044 CA-20)`,
    ).toBeLessThanOrEqual(TOLERANCIA_PX);

    lineas.push(
      `ancho ${ancho} · M1: ${m1.violaciones.length}/${m1.medidos} (testigos ` +
        `${m1.testigos.length}) · M2: desborde ${m2.desborde} · capa: ` +
        `${propia.clientWidth}×${propia.clientHeight} (contenido ${propia.scrollWidth}×` +
        `${propia.scrollHeight}, overflow ${propia.overflowX}/${propia.overflowY}) · ` +
        `form ${Math.round(cajas.form)}`,
    );

    await cerrarCapa(page);
  }

  writeFileSync(
    `${SHOTS}/medidas-capa-abierta.txt`,
    `SPEC-046 CA-6/CA-7/CA-8 — geometría con la capa abierta, a los ocho anchos\n` +
      `${lineas.join('\n')}\n`,
    'utf8',
  );
});

test('SPEC-046 CA-6(f): el velo atenúa sin ocultar — la lista se sigue leyendo detrás', async ({
  page,
}) => {
  await prepararLista(page);
  await ponerVentana(page, 1280);
  await afirmarListaLarga(page, 1280);
  await subirDelTodo(page);

  await editarEnFila(page, 0).click();
  await expect(capa(page)).toBeVisible();

  /*
    Se mide el CONTRASTE EFECTIVO del texto de la tabla con el velo puesto, no la
    opacidad declarada (CA-6f). Un velo opaco pasaría cualquier comprobación de «tiene
    alfa < 1» si estuviera bien elegido el número, y aun así habría quitado lo que aquí
    se paga: la devolución parcial del contexto que se le debe a la opción que el humano
    prefería (ADR-030 §1).

    El cálculo compone el color del texto y el fondo REAL de su fila —recorriendo
    ancestros hasta encontrar un fondo opaco, porque `.zone-*` son tintes con alfa— con
    el color del `::backdrop`, y saca la razón de contraste de WCAG sobre el resultado.
  */
  const legibilidad = await page.evaluate((selector) => {
    const rgba = (css: string) => {
      const n = (css.match(/[\d.]+/g) ?? []).map(Number);
      return { r: n[0] ?? 0, g: n[1] ?? 0, b: n[2] ?? 0, a: n[3] ?? (n.length >= 3 ? 1 : 0) };
    };
    type Color = ReturnType<typeof rgba>;
    const sobre = (frente: Color, fondo: Color): Color => ({
      r: frente.r * frente.a + fondo.r * (1 - frente.a),
      g: frente.g * frente.a + fondo.g * (1 - frente.a),
      b: frente.b * frente.a + fondo.b * (1 - frente.a),
      a: 1,
    });
    const luminancia = (c: Color) => {
      const canal = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
    };
    const contraste = (a: Color, b: Color) => {
      const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    /** El fondo real de un elemento: apila los tintes con alfa hasta dar con uno opaco. */
    const fondoReal = (el: Element): Color => {
      const capas: Color[] = [];
      for (let p: Element | null = el; p; p = p.parentElement) {
        const c = rgba(getComputedStyle(p).backgroundColor);
        if (c.a === 0) continue;
        capas.push(c);
        if (c.a === 1) break;
      }
      let acumulado: Color = capas.pop() ?? { r: 0, g: 0, b: 0, a: 1 };
      while (capas.length > 0) acumulado = sobre(capas.pop()!, acumulado);
      return acumulado;
    };

    const dialogo = document.querySelector(selector)!;
    const velo = rgba(getComputedStyle(dialogo, '::backdrop').backgroundColor);

    // Una fila que queda POR ENCIMA de la capa: es la que el usuario tiene que seguir
    // leyendo mientras edita.
    const arribaDeLaCapa = dialogo.getBoundingClientRect().top;
    const fila = [...document.querySelectorAll('table.data-table tbody tr')].find(
      (tr) => tr.getBoundingClientRect().bottom <= arribaDeLaCapa,
    );
    if (!fila) throw new Error('la capa tapa la tabla entera: no queda ninguna fila a la vista');
    const texto = fila.querySelector('.ticker') ?? fila;

    const tinta = rgba(getComputedStyle(texto).color);
    const fondo = fondoReal(texto);
    const tintaSobreFondo = sobre(tinta, fondo);

    return {
      velo: getComputedStyle(dialogo, '::backdrop').backgroundColor,
      veloAlfa: velo.a,
      filasVisiblesPorEncima: [...document.querySelectorAll('table.data-table tbody tr')].filter(
        (tr) => {
          const r = tr.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= arribaDeLaCapa;
        },
      ).length,
      contrasteSinVelo: contraste(tintaSobreFondo, fondo),
      contrasteConVelo: contraste(sobre(velo, tintaSobreFondo), sobre(velo, fondo)),
    };
  }, SELECTOR_CAPA);

  console.log(
    `[SPEC-046 CA-6f] velo ${legibilidad.velo} · contraste del texto de la tabla ` +
      `${legibilidad.contrasteSinVelo.toFixed(2)}:1 → ${legibilidad.contrasteConVelo.toFixed(2)}:1 ` +
      `con el velo puesto · ${legibilidad.filasVisiblesPorEncima} filas legibles por encima`,
  );

  expect(
    legibilidad.filasVisiblesPorEncima,
    'con la capa abierta no queda ninguna fila entera a la vista por encima de ella: la ' +
      'devolución parcial del contexto que paga esta spec no existe',
  ).toBeGreaterThan(0);
  expect(
    legibilidad.contrasteConVelo,
    `con el velo puesto, el texto de la tabla queda a ${legibilidad.contrasteConVelo.toFixed(2)}:1 ` +
      `(sin velo, ${legibilidad.contrasteSinVelo.toFixed(2)}:1). El velo OCULTA en vez de ` +
      `atenuar, y eso es justo lo que se pagó por no elegir la fila desplegable (ADR-030 §1)`,
  ).toBeGreaterThanOrEqual(4.5);
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-12 y CA-13 — lo que SPEC-044 prometió, y la confirmación donde se pulsó
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-046 CA-12: los cuatro campos precargados, guardar, fallar y reordenar siguen como los dejó SPEC-044', async ({
  page,
}) => {
  await prepararLista(page);
  await ponerVentana(page, 1280);
  await afirmarListaLarga(page, 1280);

  // CA-19 — una zona SIN definir aparece vacía, nunca con `0`. Se comprueba sobre la
  // lista larga, que es donde vive esta spec: `0` es un número que el usuario no escribió.
  await filas(page)
    .filter({ hasText: TICKER_SIN_ZONA_DE_VENTA })
    .getByTestId('editar-zonas')
    .click();
  await expect(campo(page, 'buyMin')).toHaveValue('10');
  await expect(campo(page, 'sellMin'), 'una zona sin definir se precargó con `0`').toHaveValue('');
  await expect(campo(page, 'sellMax')).toHaveValue('');
  await cerrarCapa(page);

  // CA-19 — precargados con lo vigente, el activo identificado y sin buscador.
  await filaDual(page, 'BME').getByTestId('editar-zonas').click();
  await expect(campo(page, 'buyMin')).toHaveValue(ZONAS_DUAL.BMEX.buyMin);
  await expect(formEdicion(page).locator('.symbol-search-input')).toHaveCount(0);

  // CA-21 — un error de validación deja la superficie ABIERTA, con lo escrito y el mensaje.
  await campo(page, 'buyMin').fill('40');
  await campo(page, 'buyMax').fill('10');
  await formEdicion(page).locator('button[type="submit"]').click();
  await expect(formEdicion(page)).toBeVisible();
  await expect(page.getByTestId('editar-error')).toContainText('Zona de compra');
  await expect(campo(page, 'buyMin')).toHaveValue('40');
  await expect(campo(page, 'buyMax')).toHaveValue('10');

  // CA-21 — y guardar refleja los valores nuevos en la tabla, con el estado recalculado.
  await campo(page, 'buyMin').fill('30');
  await campo(page, 'buyMax').fill('40');
  await formEdicion(page).locator('button[type="submit"]').click();
  await expect(cadencia(page)).toBeVisible();
  await page.getByTestId('editar-cerrar').click();
  await expect(capa(page)).toHaveCount(0);

  const zonaCompra = async () =>
    (await filaDual(page, 'BME').locator('td.num').nth(2).innerText()).trim();
  await expect(async () => expect(await zonaCompra()).toBe('30 – 40')).toPass();
  // El precio de la fila BME es 12: con la zona nueva se queda FUERA (SPEC-007 CA-1).
  await expect(filaDual(page, 'BME')).toHaveClass(/zone-out/);
  // Y la otra vigilada del mismo ticker, intacta.
  await expect(filaDual(page, 'NYSE').locator('td.num').nth(2)).toHaveText(
    `${ZONAS_DUAL.XNYS.buyMin} – ${ZONAS_DUAL.XNYS.buyMax}`,
  );

  // CA-24 — tras reordenar se edita LA FILA PULSADA, y la tabla sigue entera.
  await ordenarPor(page, 'name', 'desc');
  const fila = filas(page).nth(3);
  const retrato = await fila.evaluate((el) => ({
    clase: el.className,
    estado: el.querySelector('.zone-label')?.textContent?.trim() ?? '',
    tipo: el.querySelector('[data-testid="row-type"]')?.textContent?.trim() ?? '',
    mercado: el.querySelector('[data-testid="row-market"]')?.textContent?.trim() ?? '',
    nombre: el.querySelector('[data-testid="row-name"]')?.textContent?.trim() ?? '',
    ticker: el.querySelector('.ticker')?.textContent?.trim() ?? '',
  }));

  await editarEnFila(page, 3).click();
  await expect(formEdicion(page).getByTestId('editar-activo')).toContainText(retrato.ticker);
  await campo(page, 'sellMin').fill('77');
  await campo(page, 'sellMax').fill('88');
  await formEdicion(page).locator('button[type="submit"]').click();
  await expect(cadencia(page)).toBeVisible();
  await page.getByTestId('editar-cerrar').click();

  const editada = filas(page).filter({ hasText: retrato.ticker });
  await expect(async () =>
    expect((await editada.locator('td.num').nth(3).innerText()).trim()).toBe('77 – 88'),
  ).toPass();
  const despues = await editada.first().evaluate((el) => ({
    clase: el.className,
    estado: el.querySelector('.zone-label')?.textContent?.trim() ?? '',
    tipo: el.querySelector('[data-testid="row-type"]')?.textContent?.trim() ?? '',
    mercado: el.querySelector('[data-testid="row-market"]')?.textContent?.trim() ?? '',
    nombre: el.querySelector('[data-testid="row-name"]')?.textContent?.trim() ?? '',
    ticker: el.querySelector('.ticker')?.textContent?.trim() ?? '',
  }));
  expect(despues, 'editar una zona degradó lo que la fila ya contaba (SPEC-029/041/043)').toEqual(
    retrato,
  );
});

test('SPEC-046 CA-13: la confirmación se lee DENTRO de la ventana, y se cierra cuando el usuario lo dice', async ({
  page,
}) => {
  await prepararLista(page);

  for (const ancho of [360, 1280] as const) {
    await prepararLista(page);
    await ponerVentana(page, ancho);
    await subirDelTodo(page);
    await afirmarListaLarga(page, ancho);

    const disparador = editarEnFila(page, 0);
    await disparador.click();
    await expect(formEdicion(page)).toBeVisible();
    await campo(page, 'buyMin').fill('5');
    await campo(page, 'buyMax').fill('7');

    // La confirmación se mide con M4 igual que el formulario: el defecto que esta spec
    // arregla era, literalmente, un mensaje que nadie lee.
    const m4 = await medirRespuestaAlGesto(page, {
      disparador: formEdicion(page).locator('button[type="submit"]'),
      revelado: cadencia(page),
      etiqueta: `${ancho} px · confirmación tras guardar`,
    });
    afirmarM4(m4);

    // Es la MISMA frase de cadencia de SPEC-039 CA-3, sin frase nueva.
    await expect(cadencia(page)).toHaveText(CADENCIA_LINEA);
    // Y está DENTRO de la capa, no detrás de la tabla.
    expect(
      await cadencia(page).evaluate((el) => el.closest('[data-testid="editar-panel"]') !== null),
      `a ${ancho} px la confirmación se pinta fuera de la capa: con una lista larga eso es ` +
        `invisible, que es el mismo defecto que SPEC-046 arregla`,
    ).toBe(true);

    // La capa NO se cierra sola: se cierra cuando el usuario lo dice (gate 2026-08-22).
    await expect(capa(page)).toBeVisible();
    await page.getByTestId('editar-cerrar').click();
    await expect(capa(page)).toHaveCount(0);
    expect(
      await disparador.evaluate((el) => el === document.activeElement),
      'tras confirmar, el foco no volvió al control «Editar» de su fila (CA-5)',
    ).toBe(true);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-15 — la celda de acciones admite una TERCERA acción sin esconder ninguna
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-046 CA-15: con un tercer control simulado, los tres se alcanzan a los ocho anchos', async ({
  page,
}) => {
  test.slow();
  await prepararLista(page);

  for (const ancho of ANCHOS) {
    await ponerVentana(page, ancho);

    /*
      El tercer control lo INYECTA el test: SPEC-045 (silenciar) está aprobada y sin
      implementar, y aquí no se le adelanta ni un rótulo ni un estado. Lo que se mide es
      lo que la celda TOLERA hoy, para que SPEC-045 llegue a una pantalla ya medida (R-5
      de EPIC-005). La etiqueta tiene el largo de «Silenciar» y nada más.
    */
    await filas(page)
      .first()
      .evaluate((fila) => {
        const caja = fila.querySelector('.fila-acciones')!;
        caja.querySelector('.tercer-control-simulado')?.remove();
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'btn-sm tercer-control-simulado';
        boton.textContent = 'Silenciar';
        caja.append(boton);
      });

    await page.locator('.table-scroll').evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });

    const controles = filas(page).first().locator('.fila-acciones button');
    expect(
      await controles.count(),
      `a ${ancho} px la fila no tiene los tres controles: esconder uno no cuenta como ` +
        `arreglo (ADR-026 §4)`,
    ).toBe(3);

    const medidas = await controles.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          texto: (el.textContent ?? '').trim(),
          izquierda: r.left,
          derecha: r.right,
          ventana: document.documentElement.clientWidth,
        };
      }),
    );
    for (const m of medidas) {
      expect(
        m.derecha,
        `a ${ancho} px, con la tabla desplazada a tope, el control «${m.texto}» sigue fuera: ` +
          `right=${Math.round(m.derecha)} sobre una ventana de ${m.ventana}`,
      ).toBeLessThanOrEqual(m.ventana + TOLERANCIA_PX);
      expect(
        m.izquierda,
        `a ${ancho} px el control «${m.texto}» queda cortado por la izquierda`,
      ).toBeGreaterThanOrEqual(-TOLERANCIA_PX);
    }

    // M3 — y ninguna de las tres etiquetas parte palabras.
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
});
