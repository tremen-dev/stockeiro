import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import {
  ANCHOS_TELEFONO,
  TOLERANCIA_PX,
  describirRespuestaAlGesto,
  describirViolaciones,
  medirDesbordePorElemento,
  medirFondoDeLista,
  medirPropiedadesComputadas,
  medirRespuestaAlGesto,
  ponerVentana,
  type MedidaFondoDeLista,
  type MedidaM4,
} from './geometria';
import { CUENTA, SHOTS, entrar, sembrar, type SembradoVigilada } from './spec054';

/**
 * SPEC-054 CA-12 — **la capa de ADR-030 sigue cumpliendo sobre tarjetas, y con lista
 * larga**.
 *
 * ## Qué se está probando aquí, y qué NO
 *
 * **Esta spec no mueve la capa.** ADR-030 sigue en pie sin un rasguño: la superficie que
 * abre *Editar* es un `<dialog>` nativo anclado al borde inferior de la ventana, y M4
 * —«¿lo ve quien acaba de pulsar?»— la sigue midiendo igual. Lo único que cambia es **sobre
 * qué se abre**: por debajo de 720 px el disparador ya no vive en la novena columna de una
 * tabla, sino en el pie de una tarjeta.
 *
 * Y ese cambio no es cosmético para ADR-030: su **hecho 2** decía que a anchos estrechos,
 * en el instante del clic, el `scrollLeft` de la tabla estaba al máximo, así que **lo que
 * se veía de la fila no era lo que la fila decía**. Con tarjetas ese caso **desaparece por
 * construcción** — no hay `scrollLeft` que valga cuando no hay desplazamiento horizontal—,
 * y lo que queda por demostrar es que la otra mitad sigue en pie: que la respuesta cae
 * donde está el usuario.
 *
 * ## La precondición, afirmada (ADR-030 §4)
 *
 * Una guardia que mide el comportamiento de una **lista** y se ejecuta con dos filas no
 * prueba nada sobre listas: mide el caso en el que el defecto **no puede existir**. Le pasó
 * a SPEC-044. Aquí la lista es larga **de verdad** y el número de filas **no se escribe**:
 * se deriva hasta que el fondo de la lista de tarjetas cae por debajo del pliegue, y cada
 * caso vuelve a afirmarlo en el ancho que está midiendo. Si un día las tarjetas encogen,
 * esto se pone rojo en vez de aprobar en silencio.
 *
 * La derivación se hace a **390 px** porque es el ancho donde la precondición cuesta más de
 * los dos de teléfono: la ventana es más alta (844 frente a 800) y las tarjetas, con más
 * ancho, envuelven menos y son más bajas.
 */

/** La cuenta de esta guardia: la de SPEC-054, con su lista larga propia. */
const LISTA_DE_TARJETAS = 'ul[data-testid="tarjetas-vigiladas"]';
const TARJETAS = `${LISTA_DE_TARJETAS} > li`;
const SELECTOR_CAPA = 'dialog[data-testid="editar-panel"]';

/** Con cuántas tarjetas se empieza a tantear. No es la respuesta: es el primer intento. */
const FILAS_INICIALES = 12;
/** Techo del tanteo. Si con esto no basta, el escenario dejó de ser una lista. */
const FILAS_MAXIMAS = 96;
/** El ancho donde la precondición cuesta más de los dos de teléfono. */
const ANCHO_DE_DERIVACION = 390;

/**
 * `n` vigiladas con tickers propios de esta guardia (`Z8`), cada una con nombre, tipo,
 * mercado, precio y las cuatro zonas: una lista de filas mínimas sería más corta que la de
 * verdad y la precondición se derivaría sobre un escenario más fácil.
 */
function listaLarga(n: number): SembradoVigilada[] {
  return Array.from({ length: n }, (_, i) => {
    const num = String(i + 1).padStart(3, '0');
    return {
      ticker: `Z8L${num}`,
      micCode: i % 2 === 0 ? 'BMEX' : 'XNYS',
      name: `Tarjeta Larga ${num}`,
      instrumentType: i % 3 === 0 ? 'ETF' : 'Common Stock',
      buyMin: '10',
      buyMax: '20',
      sellMin: '40',
      sellMax: '50',
      price: i % 4 === 0 ? '15' : '30',
    };
  });
}

const capa = (page: Page) => page.getByTestId('editar-panel');
const tarjetas = (page: Page) => page.locator(TARJETAS);
const editarEnTarjeta = (page: Page, i: number) =>
  tarjetas(page).nth(i).getByTestId('editar-zonas-tarjeta');

/** La medida de la precondición sobre la lista de TARJETAS (ADR-030 §4, en el módulo). */
const medirPrecondicion = (page: Page): Promise<MedidaFondoDeLista> =>
  medirFondoDeLista(page, { lista: LISTA_DE_TARJETAS, elementos: ':scope > li' });

async function afirmarListaLarga(page: Page, ancho: number): Promise<MedidaFondoDeLista> {
  const p = await medirPrecondicion(page);
  expect(
    p.porDebajoDelPliegue,
    `a ${ancho} px el escenario dejó de ser una LISTA LARGA: con ${p.elementos} tarjetas, el ` +
      `fondo de la lista cae en ${Math.round(p.fondo)} sobre una ventana de ${p.ventanaAlto} ` +
      `px, o sea POR ENCIMA del pliegue. Con la lista entera a la vista, el defecto que ` +
      `ADR-030 arregla no puede existir y medirlo no demuestra nada. Re-encuadra el ` +
      `escenario —más tarjetas—, nunca la medida`,
  ).toBeGreaterThan(TOLERANCIA_PX);
  return p;
}

/** Afirma M4 sobre una medida ya tomada, con la cifra en el mensaje. */
function afirmarM4(m: MedidaM4): void {
  expect(
    m.dentroDeLaVentana,
    `la superficie que abre el gesto NO cabe en la ventana. ${describirRespuestaAlGesto(m)}. ` +
      `Es el defecto que ADR-030 arregló: para el usuario, el botón no hace nada`,
  ).toBe(true);
  expect(
    m.desplazoElDocumento,
    `el gesto DESPLAZÓ el documento para enseñar la respuesta. ` +
      `${describirRespuestaAlGesto(m)}. M4 dice «la respuesta va donde está el usuario», no ` +
      `«el usuario va donde está la respuesta» (ADR-030 §3)`,
  ).toBe(false);
}

/** Cierra la capa por donde se cierra de verdad. */
async function cerrarCapa(page: Page): Promise<void> {
  if ((await capa(page).count()) === 0) return;
  const cancelar = page.getByTestId('editar-cancelar');
  if ((await cancelar.count()) > 0) await cancelar.click();
  else await page.getByTestId('editar-cerrar').click();
  await expect(capa(page)).toHaveCount(0);
}

/** Deja el documento arriba del todo, sin haber pulsado nada. */
async function subirDelTodo(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
}

/** Cuántas tarjetas hizo falta sembrar para que la lista sea larga de verdad. */
let TARJETAS_TOTAL = 0;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await entrar(page);
    await ponerVentana(page, ANCHO_DE_DERIVACION);
    for (let n = FILAS_INICIALES; n <= FILAS_MAXIMAS; n *= 2) {
      await sembrar(CUENTA, listaLarga(n));
      await page.goto('/vigiladas');
      await page.locator(LISTA_DE_TARJETAS).waitFor({ state: 'visible' });
      const p = await medirPrecondicion(page);
      if (p.porDebajoDelPliegue > TOLERANCIA_PX) {
        TARJETAS_TOTAL = p.elementos;
        break;
      }
    }
    expect(
      TARJETAS_TOTAL,
      `ni con ${FILAS_MAXIMAS} tarjetas el fondo de la lista cae por debajo del pliegue a ` +
        `${ANCHO_DE_DERIVACION} px. O la tarjeta cambió mucho, o la siembra no está llegando ` +
        `a la pantalla`,
    ).toBeGreaterThan(0);
    console.log(
      `[SPEC-054 CA-12] escenario derivado: ${TARJETAS_TOTAL} tarjetas hacen que el fondo de ` +
        `la lista caiga por debajo del pliegue a ${ANCHO_DE_DERIVACION} px`,
    );
  } finally {
    await page.close();
  }
});

/** Entra, deja la lista larga recién sembrada y la pinta. Cada caso parte de lo mismo. */
async function prepararLista(page: Page): Promise<void> {
  await entrar(page);
  await sembrar(CUENTA, listaLarga(TARJETAS_TOTAL));
  await page.goto('/vigiladas');
  await page.locator(LISTA_DE_TARJETAS).waitFor({ state: 'attached' });
}

/** Las tres posiciones que ADR-030 §4 exige medir: cada una mata un error distinto. */
const posiciones = (total: number) => [
  { nombre: 'primera', indice: 0 },
  { nombre: 'intermedia', indice: Math.floor(total / 2) },
  { nombre: 'última', indice: total - 1 },
];

test('SPEC-054 CA-12: M4 sobre la capa abierta desde la primera, la intermedia y la última tarjeta', async ({
  page,
}) => {
  test.slow();
  mkdirSync(SHOTS, { recursive: true });
  await prepararLista(page);

  const lineas: string[] = [];
  for (const ancho of ANCHOS_TELEFONO) {
    await ponerVentana(page, ancho);
    await subirDelTodo(page);
    const precondicion = await afirmarListaLarga(page, ancho);

    for (const pos of posiciones(precondicion.elementos)) {
      await subirDelTodo(page);
      const disparador = editarEnTarjeta(page, pos.indice);
      const ticker = (await tarjetas(page).nth(pos.indice).locator('.ticker').innerText()).trim();

      const m4 = await medirRespuestaAlGesto(page, {
        disparador,
        revelado: capa(page),
        etiqueta: `${ancho} px · tarjeta ${pos.nombre} (${pos.indice}) de ${precondicion.elementos}`,
      });
      afirmarM4(m4);
      lineas.push(
        `${describirRespuestaAlGesto(m4)} · precondición: fondo de la lista en ` +
          `${Math.round(precondicion.fondo)} (${Math.round(precondicion.porDebajoDelPliegue)} px ` +
          `por debajo del pliegue) con ${precondicion.elementos} tarjetas`,
      );

      // (a) La capa nombra el activo de ESA tarjeta. Una capa que no dice de qué fila
      //     habla reintroduce el problema en su versión semántica (ADR-030 §2).
      const etiqueta = (await capa(page).getAttribute('aria-label')) ?? '';
      expect(
        etiqueta,
        `a ${ancho} px la capa abierta desde la tarjeta ${pos.nombre} no nombra su activo: ` +
          `«${etiqueta}» y la tarjeta es «${ticker}»`,
      ).toContain(ticker);

      // (b) La tarjeta pulsada queda MARCADA mientras la capa está abierta, y sólo ella.
      //     Detrás del velo hay que poder encontrar de cuál se está hablando.
      await expect(
        page.locator(`${TARJETAS}[data-editando="true"]`),
        `a ${ancho} px no hay exactamente UNA tarjeta marcada con la capa abierta`,
      ).toHaveCount(1);
      await expect(tarjetas(page).nth(pos.indice)).toHaveAttribute('data-editando', 'true');
      const [marca] = await medirPropiedadesComputadas(
        page,
        `${TARJETAS}[data-editando="true"]`,
        ['outline-style', 'outline-width'],
      );
      expect(
        marca.props['outline-style'] !== 'none' && parseFloat(marca.props['outline-width']) > 0,
        `a ${ancho} px la tarjeta en edición no se distingue en pantalla (outline ` +
          `${marca.props['outline-style']} ${marca.props['outline-width']})`,
      ).toBe(true);

      // (c) La capa entra en M1 como TESTIGO y no viola nada. Un «cero violaciones» que no
      //     la incluye no la aprueba: o la excluye alguien, o la exime un contenedor
      //     desplazable (ADR-030 §5, SPEC-046 CA-7b).
      const m1 = await medirDesbordePorElemento(page, { testigos: SELECTOR_CAPA });
      expect(
        m1.testigos,
        `a ${ancho} px la capa NO aparece entre los elementos que M1 midió, aunque está ` +
          `abierta. La capa NO entra en EXCLUSIONES_M1: una capa modal ocupa la ventana y ES ` +
          `maquetación (ADR-030 §5)`,
      ).not.toEqual([]);
      expect(
        m1.violaciones.length,
        `a ${ancho} px, con la capa abierta sobre una tarjeta, ${m1.violaciones.length} ` +
          `elementos se salen de la ventana:\n${describirViolaciones(m1)}`,
      ).toBe(0);

      await cerrarCapa(page);
      await expect(page.locator(`${TARJETAS}[data-editando="true"]`)).toHaveCount(0);
    }

    if (ancho === ANCHOS_TELEFONO[0]) {
      await editarEnTarjeta(page, 0).click();
      await expect(capa(page)).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/capa-sobre-tarjeta-${ancho}.png` });
      await cerrarCapa(page);
    }
  }

  writeFileSync(
    `${SHOTS}/m4-sobre-tarjetas.txt`,
    `SPEC-054 CA-12 — M4 sobre la capa abierta desde una tarjeta, en las tres posiciones\n` +
      `${lineas.join('\n')}\n`,
    'utf8',
  );
});

test('SPEC-054 CA-12: al cerrar por guardar, cancelar o Escape, el foco vuelve a su tarjeta', async ({
  page,
}) => {
  test.slow();
  await prepararLista(page);

  for (const ancho of ANCHOS_TELEFONO) {
    await ponerVentana(page, ancho);
    await subirDelTodo(page);
    await afirmarListaLarga(page, ancho);

    // El caso que de verdad importa es la tarjeta INTERMEDIA: con la primera, el foco
    // podría «volver» por accidente del tamaño de la muestra.
    const indice = Math.floor(TARJETAS_TOTAL / 2);
    const disparador = editarEnTarjeta(page, indice);

    // (a) Cancelar.
    await disparador.click();
    await expect(capa(page)).toBeVisible();
    await page.getByTestId('editar-cancelar').click();
    await expect(capa(page)).toHaveCount(0);
    expect(
      await disparador.evaluate((el) => el === document.activeElement),
      `a ${ancho} px, tras cancelar, el foco no volvió al control «Editar» de su tarjeta: el ` +
        `usuario se queda sin saber dónde estaba`,
    ).toBe(true);

    // (b) Escape — lo maneja la plataforma, y aun así tiene que pasar por el mismo camino.
    await disparador.click();
    await expect(capa(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(capa(page)).toHaveCount(0);
    expect(
      await disparador.evaluate((el) => el === document.activeElement),
      `a ${ancho} px, tras cerrar con Escape, el foco no volvió al control «Editar» de su ` +
        `tarjeta`,
    ).toBe(true);

    // (c) Guardar: la confirmación se lee DENTRO de la capa —donde se hizo el gesto— y al
    //     cerrarla el foco vuelve igual.
    await disparador.click();
    await expect(capa(page)).toBeVisible();
    const guardar = page.getByTestId('editar-form').locator('button[type="submit"]');
    const m4 = await medirRespuestaAlGesto(page, {
      disparador: guardar,
      revelado: page.getByTestId('edicion-cadencia'),
      etiqueta: `${ancho} px · confirmación tras guardar sobre una tarjeta`,
      alcanzarDisparador: false,
    });
    afirmarM4(m4);
    await page.getByTestId('editar-cerrar').click();
    await expect(capa(page)).toHaveCount(0);
    expect(
      await disparador.evaluate((el) => el === document.activeElement),
      `a ${ancho} px, tras confirmar, el foco no volvió al control «Editar» de su tarjeta`,
    ).toBe(true);
  }
});

test('SPEC-054 CA-12: la capa no se mueve — sigue anclada a la VENTANA sobre tarjetas', async ({
  page,
}) => {
  await prepararLista(page);
  await ponerVentana(page, ANCHOS_TELEFONO[0]);
  const { ventanaAlto } = await afirmarListaLarga(page, ANCHOS_TELEFONO[0]);

  /** Abre la capa tras dejar la página como diga `situar`, y devuelve su caja. */
  async function cajaCon(situar: () => Promise<void>) {
    await situar();
    await editarEnTarjeta(page, 0).click();
    await expect(capa(page)).toBeVisible();
    const caja = await capa(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        position: getComputedStyle(el).position,
        fueraDeLaLista: el.closest('ul[data-testid="tarjetas-vigiladas"]') === null,
      };
    });
    await cerrarCapa(page);
    return caja;
  }

  const arriba = await cajaCon(() => subirDelTodo(page));
  const abajo = await cajaCon(async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  });

  expect(
    arriba.position,
    `la capa no está anclada a la ventana (position: ${arriba.position}). Toda la decisión de ` +
      `ADR-030 §1 es que su caja se defina respecto al viewport, y SPEC-054 no la mueve`,
  ).toBe('fixed');
  expect(
    arriba.fueraDeLaLista,
    'la capa vive DENTRO de la lista de tarjetas: heredaría su flujo y volvería a alejarse ' +
      'del gesto a medida que la lista crece, que es el defecto que ADR-030 arregló',
  ).toBe(true);
  for (const lado of ['top', 'bottom', 'left', 'right'] as const) {
    expect(
      Math.abs(abajo[lado] - arriba[lado]),
      `con la página al fondo, la capa cambia de sitio: ${lado} ${Math.round(arriba[lado])} → ` +
        `${Math.round(abajo[lado])}. Su caja tiene que ser la misma pase lo que pase con el ` +
        `desplazamiento (ADR-030 §1)`,
    ).toBeLessThanOrEqual(TOLERANCIA_PX);
  }
  expect(
    arriba.bottom,
    `la capa no está anclada al borde inferior: bottom=${Math.round(arriba.bottom)} sobre una ` +
      `ventana de ${ventanaAlto} px. El pulgar está abajo, y lo que queda a la vista por ` +
      `encima es la parte alta de la lista (ADR-030 §1)`,
  ).toBeGreaterThanOrEqual(ventanaAlto - TOLERANCIA_PX);
});
