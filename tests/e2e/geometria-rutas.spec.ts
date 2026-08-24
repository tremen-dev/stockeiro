import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import {
  ANCHOS,
  TOLERANCIA_PX,
  describirDesborde,
  describirViolaciones,
  medirDesborde,
  medirIntegridadDePalabra,
  ponerVentana,
} from './geometria';
import {
  CUENTA_CON_FILAS,
  CUENTA_VACIA,
  SHOTS,
  asegurarVigilada,
  entrar,
} from './spec040';
import { RUTAS_CON_POSICIONES, RUTAS_CON_SESION, RUTAS_PUBLICAS } from './rutas';
// SPEC-054 CA-11: `/cartera` con posiciones. El escenario lo monta quien lo tiene —esta
// guardia no siembra carteras— y de ahí salen también las cifras de `_qa/SPEC-054/`.
import { PANTALLAS, SELECTOR_TABLA, prepararCuenta } from './spec054';

/**
 * SPEC-040 CA-3, CA-4, CA-5 y CA-11 — **la geometría de las rutas que alcanza un
 * tester**, medida elemento a elemento a los ocho anchos del proyecto.
 *
 * ## Qué mide, y por qué así (ADR-026)
 *
 * Las medidas NO viven aquí: viven en `tests/e2e/geometria.ts`. Ese es el punto entero
 * de esta spec. El proyecto entregó cuatro guardias copiadas una de otra y la técnica se
 * degradó dos veces: SPEC-036 escribió la medida buena —recorrer los elementos y
 * comprobar `right > innerWidth + 1`— y SPEC-037 y SPEC-039 se quedaron sólo con
 * `document.scrollWidth`, que `overflow-x: hidden` enmascara. Por eso la suite estuvo en
 * verde con el botón «Vigilar» fuera de la pantalla.
 *
 *  - **CA-3** aplica **M1** (desborde por elemento) a las diez superficies que alcanza un
 *    tester. Es la medida principal porque no se puede enmascarar.
 *  - **CA-4** aplica **M3** (integridad de palabra) al panel, y comprueba el reparto de
 *    columnas. Es el único CA que caza el defecto «Ac / cio / ne / s», que **no desborda
 *    nada**: el texto se rompe DENTRO de su caja.
 *  - **CA-5** aplica **M2** (desborde de documento) a `/vigiladas` con filas, que es
 *    donde vive el defecto del tramo 721–800 px, y además comprueba que la tabla sigue
 *    siendo legible: que desplazándola se llega a la última columna.
 *  - **CA-11** deja las cifras y las capturas en `_qa/SPEC-040/`.
 *
 * Nada de comparar imágenes (ADR-026 §6): una captura de referencia se rompe al cambiar
 * una fuente o un color —cosas que se cambian a propósito— y NO se rompe cuando un botón
 * se va fuera de la pantalla dentro de un contenedor recortado.
 */

/*
  Las tres listas de rutas viven en `./rutas.ts` desde SPEC-054 CA-11, y por un motivo:
  para poder afirmarlas **sin arrancar el navegador**. Una lista escrita aquí dentro no se
  puede importar desde un test unitario sin ejecutar de paso todos los `test()` de este
  fichero, y CA-11 pide exactamente eso — un test que diga en rojo, y no en silencio, si
  alguien retira `/cartera` del conjunto.
*/

async function recorrerAnchos(page: Page, ruta: string) {
  const medidas = [];
  for (const ancho of ANCHOS) medidas.push(await medirDesborde(page, ancho));
  const informe = medidas.map(describirDesborde).join('\n');

  for (const m of medidas) {
    expect(m.m1.medidos, `no se midió ningún elemento en ${ruta} a ${m.ancho} px`).toBeGreaterThan(
      5,
    );
    expect(
      m.m1.violaciones.length,
      `${ruta} a ${m.ancho} px: ${m.m1.violaciones.length} elementos se salen de la ventana\n` +
        `${describirViolaciones(m.m1)}\n${informe}`,
    ).toBe(0);
  }
  return { medidas, informe };
}

function guardarMedidas(nombre: string, cabecera: string, cuerpo: string) {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(`${SHOTS}/${nombre}`, `${cabecera}\n${cuerpo}\n`, 'utf8');
}

test.describe('SPEC-040 CA-3: ningún elemento se sale de la ventana', () => {
  test('las cinco rutas públicas, a los ocho anchos', async ({ page }) => {
    const partes: string[] = [];
    for (const ruta of RUTAS_PUBLICAS) {
      await page.goto(ruta);
      const { informe } = await recorrerAnchos(page, ruta);
      partes.push(`── ${ruta}\n${informe}`);
    }
    guardarMedidas(
      'medidas-rutas-publicas.txt',
      'SPEC-040 CA-3 — M1 (desborde por elemento) + M2, rutas públicas',
      partes.join('\n'),
    );
  });

  test('las cuatro rutas con sesión, más /vigiladas vacía, a los ocho anchos', async ({ page }) => {
    await entrar(page, CUENTA_VACIA);
    const partes: string[] = [];
    for (const ruta of RUTAS_CON_SESION) {
      await page.goto(ruta);
      const { informe } = await recorrerAnchos(page, ruta);
      partes.push(`── ${ruta} (cuenta sin vigiladas)\n${informe}`);
    }
    guardarMedidas(
      'medidas-rutas-con-sesion.txt',
      'SPEC-040 CA-3 — M1 (desborde por elemento) + M2, rutas con sesión, lista vacía',
      partes.join('\n'),
    );
  });

  test('/vigiladas CON AL MENOS UNA FILA, a los ocho anchos', async ({ page }) => {
    await asegurarVigilada(page);
    await page.goto('/vigiladas');
    await page.locator('table.data-table').waitFor({ state: 'visible' });
    const { informe } = await recorrerAnchos(page, '/vigiladas (con filas)');
    guardarMedidas(
      'medidas-vigiladas-con-filas.txt',
      'SPEC-040 CA-3/CA-5 — /vigiladas con filas',
      informe,
    );
  });
});

test.describe('SPEC-040 CA-4: el panel reparte columnas y no parte palabras', () => {
  /** Cuántas pistas resuelve la rejilla de tarjetas AHORA, a este ancho. */
  const pistasDeCards = (page: Page) =>
    page.evaluate(() => {
      const cards = document.querySelector('.cards');
      if (!cards) return { pistas: 0, valor: 'sin .cards', tarjetas: 0 };
      const valor = getComputedStyle(cards).gridTemplateColumns;
      return {
        pistas: valor === 'none' ? 0 : valor.trim().split(/\s+/).length,
        valor,
        tarjetas: cards.querySelectorAll(':scope > .card').length,
      };
    });

  for (const [rol, cuenta, tarjetasEsperadas] of [
    ['tester (dos tarjetas)', CUENTA_VACIA, 2],
    ['completo (tres tarjetas)', CUENTA_CON_FILAS, 3],
  ] as const) {
    test(`con rol ${rol}: una columna en móvil, dos como mucho a 640/700 y tres a 1280`, async ({
      page,
    }) => {
      if (cuenta === CUENTA_CON_FILAS) await asegurarVigilada(page);
      else await entrar(page, cuenta);
      await page.goto('/dashboard');
      await page.locator('.cards').waitFor({ state: 'visible' });

      const lineas: string[] = [];
      for (const ancho of ANCHOS) {
        await ponerVentana(page, ancho);
        const rejilla = await pistasDeCards(page);
        expect(
          rejilla.tarjetas,
          `el panel de un ${rol} no pinta ${tarjetasEsperadas} tarjetas sino ${rejilla.tarjetas}`,
        ).toBe(tarjetasEsperadas);

        // (a) y (b) — el reparto de columnas.
        if (ancho === 360 || ancho === 390) {
          expect(
            rejilla.pistas,
            `a ${ancho} px el panel reparte ${rejilla.pistas} columnas ("${rejilla.valor}"); ` +
              `en un teléfono tiene que ser UNA, o los títulos se parten letra a letra`,
          ).toBe(1);
        }
        if (ancho === 640 || ancho === 700) {
          expect(
            rejilla.pistas,
            `a ${ancho} px el panel reparte ${rejilla.pistas} columnas ("${rejilla.valor}")`,
          ).toBeLessThanOrEqual(2);
        }
        if (ancho === 1280) {
          // A 1280 la rejilla sigue siendo de TRES pistas con los dos roles: es la de
          // siempre. Un `tester` ocupa dos de las tres porque no tiene Cartera (CE-2),
          // y eso es lo que ya hacía antes de esta spec — el escritorio no cambia.
          expect(
            rejilla.pistas,
            `a 1280 px el escritorio tiene que verse IGUAL que antes: tres pistas en ` +
              `.cards, y resuelve "${rejilla.valor}"`,
          ).toBe(3);
        }

        // (c) — M3: ninguna palabra se rompe, y ninguna línea excede su tarjeta.
        const textos = await medirIntegridadDePalabra(page, '.card h3, .card .num', '.card');
        expect(textos.length, `no se midió ningún texto de tarjeta a ${ancho} px`).toBeGreaterThan(
          0,
        );
        for (const t of textos) {
          lineas.push(
            `ancho ${ancho} · ${t.selector} «${t.texto}»: palabras=${t.palabras} ` +
              `lineas=${t.lineas} rects=${t.rects} anchoLineaMax=${Math.round(t.anchoLineaMax)} ` +
              `anchoTarjeta=${Math.round(t.anchoContenedor)} · pistas=${rejilla.pistas}`,
          );
          expect(
            t.lineas,
            `a ${ancho} px el texto «${t.texto}» ocupa ${t.lineas} líneas para ${t.palabras} ` +
              `palabras: se está partiendo DENTRO de una palabra («Ac / cio / ne / s»). ` +
              `La tarjeta mide ${Math.round(t.anchoContenedor)} px de contenido y la rejilla ` +
              `reparte ${rejilla.pistas} columnas`,
          ).toBeLessThanOrEqual(t.palabras);
          expect(
            t.anchoLineaMax,
            `a ${ancho} px una línea de «${t.texto}» mide ${Math.round(t.anchoLineaMax)} px y ` +
              `el contenido de su tarjeta sólo ${Math.round(t.anchoContenedor)}`,
          ).toBeLessThanOrEqual(t.anchoContenedor + TOLERANCIA_PX);
        }
      }
      guardarMedidas(
        `medidas-panel-${tarjetasEsperadas}-tarjetas.txt`,
        `SPEC-040 CA-4 — M3 (integridad de palabra) y reparto de .cards, rol ${rol}`,
        lineas.join('\n'),
      );
    });
  }
});

test.describe('SPEC-040 CA-5: la tabla se desplaza dentro de su caja, nunca la página', () => {
  test('el documento no se va en horizontal a ninguno de los ocho anchos', async ({ page }) => {
    await asegurarVigilada(page);
    await page.goto('/vigiladas');
    await page.locator('table.data-table').waitFor({ state: 'visible' });

    const lineas: string[] = [];
    for (const ancho of ANCHOS) {
      const m = await medirDesborde(page, ancho);
      const contenedor = await page.locator('.table-scroll').evaluate((el) => ({
        overflowX: getComputedStyle(el).overflowX,
        contenido: el.scrollWidth,
        visible: el.clientWidth,
      }));
      lineas.push(
        `${describirDesborde(m)} · .table-scroll[overflow-x=${contenedor.overflowX} ` +
          `contenido=${contenedor.contenido} visible=${contenedor.visible}]`,
      );

      // (a) M2: el documento no se desplaza. Medida de hoy que debe desaparecer:
      //     scrollWidth 819 sobre clientWidth 760.
      expect(
        m.m2.documento,
        `a ${ancho} px /vigiladas desplaza el DOCUMENTO: ocupa ${m.m2.documento} en una ` +
          `ventana de ${m.m2.ventana}\n${lineas.join('\n')}`,
      ).toBeLessThanOrEqual(m.m2.ventana + TOLERANCIA_PX);

      // (b) Y el contenedor de la tabla declara su desplazamiento A TODOS LOS ANCHOS,
      //     no sólo por debajo de 720 (ADR-026 §4: la segunda salida legítima).
      expect(
        contenedor.overflowX,
        `a ${ancho} px .table-scroll no absorbe el desplazamiento (overflow-x=` +
          `${contenedor.overflowX}); por encima de 720 px lo absorbía el documento`,
      ).toBe('auto');
    }
    guardarMedidas('medidas-tabla-vigiladas.txt', 'SPEC-040 CA-5 — M2 y .table-scroll', lineas.join('\n'));
  });

  test('la tabla sigue siendo legible: desplazándola se alcanza el control de Quitar', async ({
    page,
  }) => {
    await asegurarVigilada(page);
    await page.goto('/vigiladas');
    await page.locator('table.data-table').waitFor({ state: 'visible' });

    for (const ancho of ANCHOS) {
      await ponerVentana(page, ancho);
      const caja = page.locator('.table-scroll');
      await caja.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });

      const quitar = page
        .locator('table.data-table tbody tr')
        .first()
        .getByRole('button', { name: 'Quitar' });
      const medida = await quitar.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          derecha: r.right,
          izquierda: r.left,
          ventana: document.documentElement.clientWidth,
          texto: (el.textContent ?? (el as HTMLInputElement).value ?? '').trim(),
        };
      });

      expect(
        medida.derecha,
        `a ${ancho} px, con la tabla desplazada a tope, el control «${medida.texto}» de la ` +
          `última columna sigue fuera: right=${Math.round(medida.derecha)} sobre ventana ` +
          `${medida.ventana}`,
      ).toBeLessThanOrEqual(medida.ventana + TOLERANCIA_PX);
      expect(
        medida.izquierda,
        `a ${ancho} px el control «${medida.texto}» queda cortado por la izquierda: ` +
          `left=${Math.round(medida.izquierda)}`,
      ).toBeGreaterThanOrEqual(-TOLERANCIA_PX);
    }
  });
});

test('SPEC-040 CA-11: capturas de los ocho anchos en _qa/SPEC-040', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });

  await entrar(page, CUENTA_VACIA);
  for (const [ruta, nombre] of [
    ['/vigiladas', 'vigiladas-vacia'],
    ['/dashboard', 'dashboard-tester'],
  ] as const) {
    await page.goto(ruta);
    for (const ancho of ANCHOS) {
      await ponerVentana(page, ancho);
      await page.screenshot({ path: `${SHOTS}/ancho-${ancho}-${nombre}.png`, fullPage: true });
    }
  }

  await asegurarVigilada(page);
  for (const [ruta, nombre] of [
    ['/vigiladas', 'vigiladas-con-filas'],
    ['/dashboard', 'dashboard-completo'],
  ] as const) {
    await page.goto(ruta);
    for (const ancho of ANCHOS) {
      await ponerVentana(page, ancho);
      await page.screenshot({ path: `${SHOTS}/ancho-${ancho}-${nombre}.png`, fullPage: true });
    }
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   SPEC-054 CA-11 / ADR-034 §9 — `/cartera` entra en el conjunto de rutas medidas
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Una de las dos tablas del producto **no se medía a ningún ancho**, y llevaba así desde
 * SPEC-002. No era un hueco entre dos anchos medidos como el que descubrió SPEC-040: era
 * la ausencia de la superficie entera, que es la misma lección de ADR-026 §3 en su versión
 * de ruta.
 *
 * Se mide **con posiciones** a propósito: `/cartera` sin operaciones pinta el estado vacío,
 * que es otra pantalla y no tiene tabla dentro. Medir la vacía sería medir el caso en el
 * que el defecto no puede existir.
 *
 * Y se mide con las **tres** medidas horizontales, no sólo con M1: M2 caza el tramo
 * 721–800 px, donde el `overflow-x: hidden` del sistema de diseño no está puesto para
 * disimular nada, y M3 es la única que ve la «columna imposible» —el texto que se parte
 * DENTRO de su caja— que ni M1 ni M2 pueden ver porque no desborda nada.
 */
test('SPEC-054 CA-11: /cartera con posiciones, M1 + M2 + M3 a los ocho anchos', async ({
  page,
}) => {
  test.slow();
  await prepararCuenta(page);

  const cartera = PANTALLAS.find((p) => p.ruta === RUTAS_CON_POSICIONES[0]);
  expect(cartera, `\`${RUTAS_CON_POSICIONES[0]}\` no está descrita en PANTALLAS`).toBeDefined();

  await page.goto(RUTAS_CON_POSICIONES[0]);
  await page.locator(SELECTOR_TABLA).waitFor({ state: 'visible' });
  // La precondición: si la cuenta no tuviera posiciones, esto mediría el estado vacío.
  await expect(
    page.locator(`${SELECTOR_TABLA} tbody tr`),
    'la cuenta de SPEC-054 no tiene posiciones en cartera: se estaría midiendo el estado ' +
      'vacío, que es otra pantalla y no tiene tabla dentro',
  ).toHaveCount(cartera!.filas);

  const { informe } = await recorrerAnchos(page, RUTAS_CON_POSICIONES[0]);

  // M3 sobre los rótulos de las DOS representaciones. A cada ancho hay una viva y otra
  // con caja 0 × 0, así que se exige que se haya medido texto de verdad: si las dos
  // estuvieran ocultas, «cero palabras partidas» no aprobaría nada.
  const lineas: string[] = [];
  for (const ancho of ANCHOS) {
    await ponerVentana(page, ancho);
    const textos = await medirIntegridadDePalabra(
      page,
      '.data-table th, .tarjeta-cabecera, .tarjeta-datos dt',
      '.table-scroll, .tarjeta',
    );
    const pintados = textos.filter((t) => t.lineas > 0);
    expect(
      pintados.length,
      `a ${ancho} px no se midió ni un rótulo de /cartera: o la tabla y las tarjetas están ` +
        `ocultas las dos, o el selector dejó de casar y M3 aprueba en el vacío`,
    ).toBeGreaterThan(0);
    for (const t of pintados) {
      lineas.push(
        `ancho ${ancho} · ${t.selector} «${t.texto}»: palabras=${t.palabras} ` +
          `lineas=${t.lineas} anchoLineaMax=${Math.round(t.anchoLineaMax)} ` +
          `contenedor=${Math.round(t.anchoContenedor)}`,
      );
      expect(
        t.lineas,
        `a ${ancho} px el rótulo «${t.texto}» de /cartera ocupa ${t.lineas} líneas para ` +
          `${t.palabras} palabra(s): se está partiendo DENTRO de una palabra («Ac / cio / ` +
          `ne / s»), que es lo único que M3 ve y que ni M1 ni M2 pueden ver`,
      ).toBeLessThanOrEqual(Math.max(1, t.palabras));
    }
  }

  guardarMedidas(
    'medidas-cartera.txt',
    'SPEC-054 CA-11 — M1 + M2 sobre /cartera con posiciones, a los ocho anchos',
    informe,
  );
  mkdirSync('_qa/SPEC-054', { recursive: true });
  writeFileSync(
    '_qa/SPEC-054/medidas-cartera-m3.txt',
    `SPEC-054 CA-11 — M3 sobre los rótulos de /cartera, a los ocho anchos\n${lineas.join('\n')}\n`,
    'utf8',
  );
});
