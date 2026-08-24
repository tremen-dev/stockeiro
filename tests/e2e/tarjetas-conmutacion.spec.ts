import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import {
  ANCHOS,
  ANCHOS_TABLA,
  ANCHOS_TARJETA,
  ANCHOS_TELEFONO,
  BREAKPOINT_MODO_PX,
  TOLERANCIA_PX,
  altoPara,
  medirCajas,
  medirPresencia,
  medirPropiedadesComputadas,
  ponerVentana,
} from './geometria';
import {
  PANTALLAS,
  SELECTOR_TABLA,
  SHOTS,
  TARJETAS_VIGILADAS,
  abrirAncha,
  prepararCuenta,
  type Pantalla,
} from './spec054';

/**
 * SPEC-054 CA-1, CA-2, CA-3, CA-6, CA-7, CA-8, CA-9 y CA-10 — **la conmutación de modo, y
 * que no se pierda nada por el camino**.
 *
 * ## Qué mide, y por qué así
 *
 * Las medidas viven en `tests/e2e/geometria.ts` y se importan (ADR-026 §2). Aquí sólo se
 * dice **qué se afirma con ellas**, que es lo que no se unifica.
 *
 * La conmutación se afirma por el **`display` computado** y por si la plataforma considera
 * el elemento pintado (`Element.checkVisibility()`), no por una captura. No es un rodeo:
 * `display: none` es exactamente lo que retira del árbol de accesibilidad —así que en cada
 * ancho hay UNA representación y no dos— y lo que deja la caja a 0 × 0 para que M1 salte la
 * oculta. Comparar imágenes está rechazado por quinta vez en este proyecto (ADR-026 §6): una
 * captura se rompe al cambiar una fuente y no se rompe cuando la tabla no desaparece.
 *
 * ## Y por qué la anti-deriva compara TEXTOS y no marcado
 *
 * Porque el riesgo real de ADR-034 §3 no es que el marcado divirja: es que **un dato se
 * quede fuera**. CA-6 compara la fila a 1280 px con su tarjeta a 360 px celda a celda, con
 * el texto normalizado, y el conjunto de rótulos `<dt>` con el de `<th>`. Si alguien añade
 * una columna a la tabla y se olvida de la tarjeta, esto se pone rojo aunque las dos formas
 * sigan compilando (F-ADR-034-2).
 */

/** Los rótulos que el boceto PROMOCIONA fuera de la lista de pares, por pantalla. */
const PROMOCIONADOS: Record<string, string[]> = {
  // La identidad sube a la cabecera, el estado se convierte en el fondo más su etiqueta, y
  // la columna sin rótulo de acciones baja al pie (ADR-034 §4 y el boceto de §Diseño).
  vigiladas: ['Activo', 'Estado', ''],
  // La cartera no tiene zonas ni controles por fila: sólo sube la identidad.
  cartera: ['Ticker'],
};

const normalizar = (t: string) => t.replace(/\s+/g, ' ').trim();

/** El texto de cada celda de cada fila de la tabla, en el orden en que se pinta. */
const celdasDeLaTabla = (page: Page) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll(`${sel} tbody tr`)].map((tr) =>
        [...tr.querySelectorAll('td')].map((td) =>
          (td.textContent ?? '').replace(/\s+/g, ' ').trim(),
        ),
      ),
    SELECTOR_TABLA,
  );

/** El texto entero de cada tarjeta, en el orden en que se pinta. */
const textoDeLasTarjetas = (page: Page, pantalla: Pantalla) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll(`${sel} > li`)].map((li) =>
        (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ),
    pantalla.tarjetas,
  );

/** Los tickers en el orden en que se ven, en la representación que esté viva. */
const tickersVivos = (page: Page) =>
  page.locator('.ticker').filter({ visible: true }).allInnerTexts();

function guardar(nombre: string, cabecera: string, cuerpo: string) {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(`${SHOTS}/${nombre}`, `${cabecera}\n${cuerpo}\n`, 'utf8');
}

/* ────────────────────────────────────────────────────────────────────────────
   CA-1 y CA-2 — el modo conmuta, y en el canto exacto
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-1: en cada ancho hay UNA representación viva, y es la que toca', async ({
  page,
}) => {
  test.slow();
  await prepararCuenta(page);

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    await abrirAncha(page, pantalla);
    for (const ancho of ANCHOS) {
      await ponerVentana(page, ancho);
      const [tabla, tarjetas] = await medirPresencia(page, [SELECTOR_TABLA, pantalla.tarjetas]);
      const esperada = ancho <= BREAKPOINT_MODO_PX ? 'tarjetas' : 'tabla';
      lineas.push(
        `${pantalla.ruta} · ancho ${ancho} · esperada=${esperada} · ` +
          `tabla[display=${tabla.display} enElArbol=${tabla.enElArbol}] · ` +
          `tarjetas[display=${tarjetas.display} enElArbol=${tarjetas.enElArbol}]`,
      );

      // Las dos existen en el DOM a los dos lados del canto: son DOS ÁRBOLES, no un
      // render condicional. Si una desapareciera del DOM estaríamos en la alternativa de
      // `matchMedia` que ADR-034 §3 rechazó, y este test dejaría de vigilar lo que cree.
      expect(
        tabla.existe,
        `${pantalla.ruta} a ${ancho} px: la tabla no está en el DOM. ADR-034 §3 monta las ` +
          `DOS representaciones y alterna con CSS; si el marcado desaparece, la decisión ` +
          `que se implementó es otra`,
      ).toBe(1);
      expect(tarjetas.existe, `${pantalla.ruta} a ${ancho} px: la lista de tarjetas no está en el DOM`).toBe(1);

      const vivas = [tabla, tarjetas].filter((r) => r.enElArbol).length;
      expect(
        vivas,
        `${pantalla.ruta} a ${ancho} px hay ${vivas} representaciones vivas y tiene que ` +
          `haber exactamente UNA. Con dos, el lector de pantalla lee la lista dos veces y ` +
          `M1 mide el doble; con ninguna, la pantalla está vacía.\n${lineas.join('\n')}`,
      ).toBe(1);

      if (esperada === 'tarjetas') {
        expect(
          tabla.display,
          `${pantalla.ruta} a ${ancho} px la tabla no tiene \`display: none\` computado ` +
            `(tiene "${tabla.display}"). Es lo que la retira del árbol de accesibilidad y ` +
            `lo que deja su caja a 0 × 0 para que M1 la salte (ADR-034 §3)`,
        ).toBe('none');
        expect(tarjetas.enElArbol, `${pantalla.ruta} a ${ancho} px las tarjetas no se pintan`).toBe(true);
      } else {
        expect(
          tarjetas.display,
          `${pantalla.ruta} a ${ancho} px la lista de tarjetas no tiene \`display: none\` ` +
            `computado (tiene "${tarjetas.display}"): el escritorio estaría pagando la ` +
            `factura del móvil, que es justo lo que CE-5 de EPIC-007 prohíbe`,
        ).toBe('none');
        expect(tabla.enElArbol, `${pantalla.ruta} a ${ancho} px la tabla no se pinta`).toBe(true);
      }
    }
  }
  guardar(
    'conmutacion-por-ancho.txt',
    'SPEC-054 CA-1 — qué representación está viva, a los ocho anchos y en las dos pantallas',
    lineas.join('\n'),
  );
});

test('SPEC-054 CA-2: el canto está donde dice ADR-034 §1, medido a los dos lados', async ({
  page,
}) => {
  await prepararCuenta(page);

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    await abrirAncha(page, pantalla);
    for (const [ancho, esperada] of [
      [BREAKPOINT_MODO_PX, 'tarjetas'],
      [BREAKPOINT_MODO_PX + 1, 'tabla'],
    ] as const) {
      // Estos dos anchos NO son de `ANCHOS`: son el canto mismo, y sólo este CA los mide.
      // Los del proyecto que lo rodean —700 y 730— los afirma el test unitario de CA-2.
      await page.setViewportSize({ width: ancho, height: altoPara(ancho) });
      const [tabla, tarjetas] = await medirPresencia(page, [SELECTOR_TABLA, pantalla.tarjetas]);
      lineas.push(
        `${pantalla.ruta} · ancho ${ancho} · viva=${tabla.enElArbol ? 'tabla' : 'tarjetas'} ` +
          `(esperada ${esperada})`,
      );
      expect(
        tabla.enElArbol ? 'tabla' : tarjetas.enElArbol ? 'tarjetas' : 'ninguna',
        `${pantalla.ruta} a ${ancho} px la representación viva no es «${esperada}». El canto ` +
          `del modo es ${BREAKPOINT_MODO_PX}/${BREAKPOINT_MODO_PX + 1} px y esta es la ` +
          `única prueba que lo mira desde sus dos lados`,
      ).toBe(esperada);
    }
  }
  guardar('canto-del-modo.txt', 'SPEC-054 CA-2 — el canto, medido a los dos lados', lineas.join('\n'));
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-3 — una tarjeta por fila, una fila por tarjeta, y UNA columna
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-3: N filas → N tarjetas, en el mismo orden y en una sola columna', async ({
  page,
}) => {
  test.slow();
  await prepararCuenta(page);

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    await abrirAncha(page, pantalla);
    const enLaTabla = (await tickersVivos(page)).map(normalizar);
    expect(
      enLaTabla.length,
      `${pantalla.ruta} a 1280 px no pinta las ${pantalla.filas} filas del escenario`,
    ).toBe(pantalla.filas);

    for (const ancho of ANCHOS_TARJETA) {
      await ponerVentana(page, ancho);
      const cajas = await medirCajas(page, `${pantalla.tarjetas} > li`);
      const enLasTarjetas = (await tickersVivos(page)).map(normalizar);

      // (a) Una tarjeta por fila, y ni una de más.
      expect(
        cajas.length,
        `${pantalla.ruta} a ${ancho} px pinta ${cajas.length} tarjetas para ` +
          `${pantalla.filas} filas`,
      ).toBe(pantalla.filas);

      // (b) Y en el MISMO orden. Reordenar por CSS sería tan invisible como perder una
      //     fila, y con una lista larga nadie lo notaría a ojo.
      expect(
        enLasTarjetas,
        `${pantalla.ruta} a ${ancho} px las tarjetas salen en otro orden que las filas`,
      ).toEqual(enLaTabla);

      // (c) UNA sola columna, a los cuatro anchos de la franja móvil — también a 640 y
      //     700 (decisión del humano del 2026-08-24). Se afirma por la propiedad, no por
      //     el `grid-template-columns`: dos tarjetas no comparten línea.
      for (let i = 1; i < cajas.length; i++) {
        expect(
          cajas[i].top,
          `${pantalla.ruta} a ${ancho} px las tarjetas ${i} y ${i - 1} comparten línea ` +
            `(top ${Math.round(cajas[i].top)} contra bottom ${Math.round(cajas[i - 1].bottom)}): ` +
            `la lista está repartiendo DOS columnas, y bajo el breakpoint hay UNA`,
        ).toBeGreaterThanOrEqual(cajas[i - 1].bottom - TOLERANCIA_PX);
      }
      lineas.push(
        `${pantalla.ruta} · ancho ${ancho} · ${cajas.length} tarjetas, una columna, ` +
          `alto medio ${Math.round(cajas.reduce((s, c) => s + c.alto, 0) / cajas.length)} px`,
      );
    }
  }
  guardar('una-columna.txt', 'SPEC-054 CA-3 — una tarjeta por fila y una sola columna', lineas.join('\n'));
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-6 — anti-deriva: la tarjeta dice todo lo que dice la fila
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-6: ni un dato de menos, ni un rótulo distinto, ni un rótulo inventado', async ({
  page,
}) => {
  test.slow();
  await prepararCuenta(page);

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    // (1) La vista ANCHA: los rótulos de la tabla y el contenido de cada celda.
    await abrirAncha(page, pantalla);
    const th = (await page.locator(`${SELECTOR_TABLA} thead th`).allTextContents()).map(normalizar);
    const celdas = await celdasDeLaTabla(page);
    expect(celdas.length, `${pantalla.ruta} no pinta filas a 1280 px`).toBe(pantalla.filas);

    // (2) La vista ESTRECHA: los rótulos de la tarjeta y su texto entero.
    await ponerVentana(page, ANCHOS_TARJETA[0]);
    const dt = (await page.locator(`${pantalla.tarjetas} dt`).allTextContents()).map(normalizar);
    const tarjetas = await textoDeLasTarjetas(page, pantalla);

    // (a) El conjunto de rótulos: los `<th>` menos los que el boceto promociona. Ni uno
    //     de menos (una columna que se olvidó) ni uno de más (un rótulo inventado).
    const esperados = th.filter((t) => !PROMOCIONADOS[pantalla.nombre].includes(t));
    const unicos = [...new Set(dt)];
    expect(
      [...unicos].sort(),
      `${pantalla.ruta}: los rótulos <dt> de la tarjeta son [${unicos.join(', ')}] y los <th> ` +
        `de la tabla menos los promocionados son [${esperados.join(', ')}]. ADR-034 §4 exige ` +
        `el MISMO texto: es lo que sustituye a la asociación cabecera-celda que daba la ` +
        `tabla. Un rótulo distinto en la tarjeta es vocabulario nuevo que nadie decidió`,
    ).toEqual([...esperados].sort());
    expect(
      dt.length,
      `${pantalla.ruta}: hay ${dt.length} pares para ${pantalla.filas} tarjetas de ` +
        `${esperados.length} rótulos`,
    ).toBe(pantalla.filas * esperados.length);

    // (b) Y los VALORES: cada celda de cada fila aparece en su tarjeta, con el mismo texto.
    for (let i = 0; i < celdas.length; i++) {
      for (const valor of celdas[i]) {
        if (valor === '') continue;
        expect(
          tarjetas[i],
          `${pantalla.ruta}, fila ${i}: la celda «${valor}» de la tabla NO aparece en su ` +
            `tarjeta. Es la deriva que ADR-034 §3 teme (F-ADR-034-2): las dos formas salen ` +
            `de una sola descripción de columnas precisamente para que esto no pueda pasar.` +
            `\n  tarjeta: «${tarjetas[i]}»`,
        ).toContain(valor);
      }
    }
    lineas.push(
      `${pantalla.ruta}: ${th.length} <th> → ${esperados.length} <dt> por tarjeta ` +
        `[${esperados.join(' · ')}] · ${celdas.flat().filter((c) => c !== '').length} valores ` +
        `comparados en ${celdas.length} filas`,
    );
  }
  guardar('anti-deriva.txt', 'SPEC-054 CA-6 — la tarjeta dice todo lo que dice la fila', lineas.join('\n'));
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-7, CA-8 y CA-9 — la semántica al dejar de haber tabla
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-7: `aria-sort` es de una tabla, y desaparece con ella', async ({ page }) => {
  await prepararCuenta(page);
  await abrirAncha(page, PANTALLAS[0]);

  for (const ancho of ANCHOS_TARJETA) {
    await ponerVentana(page, ancho);
    // Se pregunta por lo PINTADO, no por el atributo: el `<th>` sigue en el DOM con su
    // `aria-sort`, y eso está bien —la tabla no desaparece, se apaga—. Lo que no puede
    // pasar es que un lector de pantalla lo anuncie, y `display: none` es justo lo que lo
    // retira del árbol de accesibilidad.
    await expect(
      page.locator('[aria-sort]').filter({ visible: true }),
      `a ${ancho} px hay elementos con \`aria-sort\` en el árbol de accesibilidad. Anunciar ` +
        `el orden de una tabla que quien escucha no puede alcanzar es informar sobre algo ` +
        `que no está (ADR-034 §4)`,
    ).toHaveCount(0);
  }

  for (const ancho of ANCHOS_TABLA) {
    await ponerVentana(page, ancho);
    const marcadas = page.locator(`${SELECTOR_TABLA} thead th[aria-sort]`).filter({ visible: true });
    const valores = await marcadas.evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-sort') ?? ''),
    );
    expect(
      valores.filter((v) => v !== 'none'),
      `a ${ancho} px la tabla declara ${valores.filter((v) => v !== 'none').length} columnas ` +
        `ordenadas y tiene que declarar exactamente UNA (SPEC-041, que esta spec traslada ` +
        `sin reabrir). Valores: [${valores.join(', ')}]`,
    ).toHaveLength(1);
  }
});

test('SPEC-054 CA-8: el orden se sigue diciendo y se sigue pudiendo cambiar en móvil', async ({
  page,
}) => {
  await prepararCuenta(page);
  await abrirAncha(page, PANTALLAS[0]);

  // La secuencia de referencia: ordenar por «Estado» en la vista ANCHA.
  await page.getByTestId('orden-criterio').selectOption('state');
  const porEstadoAncha = (await tickersVivos(page)).map(normalizar);

  for (const ancho of ANCHOS_TELEFONO) {
    await page.goto(PANTALLAS[0].ruta);
    await ponerVentana(page, ancho);

    const control = page.getByTestId('orden-control');
    await expect(
      control,
      `a ${ancho} px el control de orden no está visible. Vive FUERA de \`.table-scroll\` ` +
        `desde SPEC-041 CA-11 por un motivo que ADR-034 §4 confirma en vez de invalidar: es ` +
        `lo ÚNICO que sigue diciendo el orden cuando la tabla ya no está en el árbol`,
    ).toBeVisible();

    // Nombre accesible del `<select>` y valor que nombra el criterio activo.
    const criterio = page.getByTestId('orden-criterio');
    await expect(criterio).toBeVisible();
    expect(
      await criterio.evaluate((el: HTMLSelectElement) => {
        const etiqueta = el.labels?.[0]?.textContent ?? el.getAttribute('aria-label') ?? '';
        return { etiqueta: etiqueta.trim(), activo: el.options[el.selectedIndex]?.text ?? '' };
      }),
      `a ${ancho} px el selector de criterio no tiene nombre accesible o no dice cuál está ` +
        `activo: en móvil es la única forma de saber por qué está ordenada la lista`,
    ).toEqual({ etiqueta: 'Ordenar por', activo: 'Ticker' });

    // Y el botón de dirección declara su estado, no sólo lo pinta.
    const direccion = page.getByTestId('orden-direccion');
    await expect(direccion).toBeVisible();
    await expect(direccion).toHaveAttribute('aria-pressed', 'false');

    // El gesto: cambiar a «Estado» reordena las TARJETAS igual que reordenaba las filas.
    await criterio.selectOption('state');
    await expect
      .poll(async () => (await tickersVivos(page)).map(normalizar))
      .toEqual(porEstadoAncha);
  }
});

test('SPEC-054 CA-9: el orden de lectura es el del boceto, y nada lo reordena', async ({ page }) => {
  await prepararCuenta(page);
  await abrirAncha(page, PANTALLAS[0]);
  await ponerVentana(page, ANCHOS_TARJETA[0]);

  // (a) La lista dice de qué lista es.
  const nombre = await page.locator(TARJETAS_VIGILADAS).getAttribute('aria-label');
  expect(
    (nombre ?? '').trim(),
    'la lista de tarjetas no tiene nombre accesible: quien la recorre con un lector de ' +
      'pantalla no sabe de qué lista está entrando',
  ).not.toBe('');

  // (b) El orden del DOM dentro de cada tarjeta: identidad → estado → pares → acciones.
  const estructura = await page.locator(`${TARJETAS_VIGILADAS} > li`).evaluateAll((lis) =>
    lis.map((li) => ({
      hijos: [...li.children].map((h) => h.tagName.toLowerCase() + '.' + [...h.classList].join('.')),
      dt: li.querySelectorAll('dl.tarjeta-datos > .tarjeta-par > dt').length,
      dd: li.querySelectorAll('dl.tarjeta-datos > .tarjeta-par > dd').length,
      paresConUnoYUno: [...li.querySelectorAll('.tarjeta-par')].every(
        (p) => p.querySelectorAll('dt').length === 1 && p.querySelectorAll('dd').length === 1,
      ),
      rotulos: [...li.querySelectorAll('dt')].map((d) => (d.textContent ?? '').trim()),
    })),
  );
  for (const [i, t] of estructura.entries()) {
    expect(
      t.hijos,
      `la tarjeta ${i} no tiene el orden del boceto en el DOM. Es el orden que recorren el ` +
        `ojo, el lector de pantalla y el tabulador, y por eso se afirma`,
    ).toEqual([
      'div.tarjeta-cabecera',
      'div.tarjeta-estado',
      'dl.tarjeta-datos',
      'div.fila-acciones.tarjeta-pie',
    ]);
    expect(t.dt, `la tarjeta ${i} no tiene un <dt> por cada <dd>`).toBe(t.dd);
    expect(t.paresConUnoYUno, `la tarjeta ${i} tiene un par con más de un <dt> o más de un <dd>`).toBe(true);
    // Y el orden de los pares es el del boceto aprobado: el precio primero, porque en un
    // teléfono es lo primero que se busca; el tipo y el mercado al final.
    expect(
      t.rotulos,
      `la tarjeta ${i} no lee los pares en el orden del boceto que aprobó el humano`,
    ).toEqual(['Precio', 'A fecha', 'Zona compra', 'Zona venta', 'Tipo', 'Mercado']);
  }

  // (c) NINGUNA propiedad de CSS reordena nada dentro de la tarjeta. Sin esto, el orden
  //     visual podría no ser el del DOM y la mitad (b) no probaría nada.
  const props = await medirPropiedadesComputadas(
    page,
    `${TARJETAS_VIGILADAS} > li, ${TARJETAS_VIGILADAS} > li *`,
    ['order', 'grid-row-start', 'grid-column-start', 'direction'],
  );
  expect(props.length, 'no se midió ni un elemento dentro de las tarjetas').toBeGreaterThan(10);
  for (const p of props) {
    expect(
      [p.props.order, p.props['grid-row-start'], p.props['grid-column-start'], p.props.direction],
      `\`${p.selector}\` («${p.texto}») reordena su contenido con CSS: order=` +
        `${p.props.order} grid-row-start=${p.props['grid-row-start']} grid-column-start=` +
        `${p.props['grid-column-start']} direction=${p.props.direction}. El orden visual ` +
        `tiene que SER el del DOM (ADR-034 §4)`,
    ).toEqual(['0', 'auto', 'auto', 'ltr']);
  }

  // (d) Y el tabulador visita los controles de la tarjeta N antes que los de la N+1.
  const cajas = await medirCajas(page, `${TARJETAS_VIGILADAS} > li [data-testid="editar-zonas-tarjeta"]`);
  await page.locator(`${TARJETAS_VIGILADAS} > li`).first().locator('button').first().focus();
  const visitados: string[] = [];
  for (let i = 0; i < cajas.length * 2; i++) {
    const actual = await page.evaluate(() => {
      const a = document.activeElement;
      const li = a?.closest('li.tarjeta');
      if (!li) return '';
      return (li.querySelector('.ticker')?.textContent ?? '').trim();
    });
    if (actual !== '' && visitados.at(-1) !== actual) visitados.push(actual);
    await page.keyboard.press('Tab');
  }
  expect(
    visitados,
    `el tabulador salta entre tarjetas en vez de recorrerlas en orden: visitó ` +
      `[${visitados.join(', ')}]. Con dos controles por tarjeta, el recorrido tiene que ` +
      `terminar una ficha antes de empezar la siguiente`,
  ).toEqual([...new Set(visitados)]);
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-10 — el estado de zona sigue siendo el FONDO (SPEC-007)
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-10: el fondo de la tarjeta es el de su fila, con el mismo color computado', async ({
  page,
}) => {
  await prepararCuenta(page);
  await abrirAncha(page, PANTALLAS[0]);

  const enLaTabla = await medirPropiedadesComputadas(page, `${SELECTOR_TABLA} tbody tr`, [
    'background-color',
    'border-top-color',
  ]);
  const clasesFila = await page
    .locator(`${SELECTOR_TABLA} tbody tr`)
    .evaluateAll((els) => els.map((el) => [...el.classList].find((c) => c.startsWith('zone-')) ?? ''));

  await ponerVentana(page, ANCHOS_TARJETA[0]);
  const enLaTarjeta = await medirPropiedadesComputadas(page, `${TARJETAS_VIGILADAS} > li`, [
    'background-color',
    'border-top-color',
  ]);
  const clasesTarjeta = await page
    .locator(`${TARJETAS_VIGILADAS} > li`)
    .evaluateAll((els) => els.map((el) => [...el.classList].find((c) => c.startsWith('zone-')) ?? ''));

  const estados = [...new Set(clasesFila)];
  expect(
    estados.length,
    `el escenario sólo cubre ${estados.length} estados de zona [${estados.join(', ')}] y CA-10 ` +
      `los pide todos: sin los cinco, esta guardia mide el caso fácil`,
  ).toBe(5);

  expect(clasesTarjeta, 'las tarjetas no llevan la misma clase de estado que sus filas').toEqual(
    clasesFila,
  );
  for (let i = 0; i < enLaTabla.length; i++) {
    expect(
      enLaTarjeta[i].props['background-color'],
      `la tarjeta ${i} (${clasesTarjeta[i]}) tiene fondo ` +
        `${enLaTarjeta[i].props['background-color']} y su fila ` +
        `${enLaTabla[i].props['background-color']}. SPEC-007 decidió FONDO y no distintivo, ` +
        `y ADR-034 §5 lo traslada sin reabrirlo: el mismo color computado`,
    ).toBe(enLaTabla[i].props['background-color']);
  }

  // Y el estado NO se comunica además con un borde de color: si el borde cambiara con el
  // estado, sería el distintivo que SPEC-007 decidió no poner, colado por la puerta de
  // atrás del formato nuevo.
  const bordes = [...new Set(enLaTarjeta.map((t) => t.props['border-top-color']))];
  expect(
    bordes,
    `las tarjetas tienen ${bordes.length} colores de borde distintos [${bordes.join(', ')}]: ` +
      `el estado se estaría comunicando también con el borde, que es el distintivo que ` +
      `SPEC-007 decidió no poner`,
  ).toHaveLength(1);

  // La etiqueta de texto sigue acompañando al color: el color nunca fue la única señal.
  for (const estado of estados) {
    await expect(
      page.locator(`${TARJETAS_VIGILADAS} .zone-label.is-${estado.replace('zone-', '')}`).first(),
      `la tarjeta de estado ${estado} perdió su etiqueta de texto`,
    ).toBeVisible();
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-19 — la evidencia, sólo bajo `_qa/SPEC-054/`
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-19: capturas de las dos pantallas a los anchos que enseñan el cambio', async ({
  page,
}) => {
  test.slow();
  mkdirSync(SHOTS, { recursive: true });
  await prepararCuenta(page);

  // 360 y 390 son teléfono; 700 es la última tarjeta y 730 la primera tabla —el canto, a
  // 30 px de distancia—; 1280 es el escritorio que no debe haber cambiado.
  for (const pantalla of PANTALLAS) {
    await abrirAncha(page, pantalla);
    for (const ancho of [360, 390, 700, 730, 1280]) {
      await ponerVentana(page, ancho);
      await page.screenshot({
        path: `${SHOTS}/ancho-${ancho}-${pantalla.nombre}.png`,
        fullPage: true,
      });
    }
  }
});
