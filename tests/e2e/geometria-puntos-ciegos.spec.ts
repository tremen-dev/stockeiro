import { test, expect } from '@playwright/test';
import {
  CEGUERAS,
  DEFECTOS,
  TOLERANCIA_PX,
  describirViolaciones,
  inyectarBloqueAncho,
  inyectarDefecto,
  medirDesbordeDeDocumento,
  medirDesbordePorElemento,
  ponerVentana,
} from './geometria';
import { CUENTA_VACIA, asegurarVigilada, entrar } from './spec040';

/**
 * **Los dos puntos ciegos que M1 todavía tenía**, cerrados con la misma disciplina con
 * la que se cerró el defecto que la creó: reinyectando el escenario y exigiendo que la
 * medida lo vea (ADR-026 §7).
 *
 * ## Por qué existe este fichero
 *
 * SPEC-040 quedó GREEN con 11/11 CA. El verificador, atacando CA-7 —es decir, buscando
 * lo contrario de lo que se le pedía: un defecto que la guardia **no** viera— encontró
 * dos, y los dejó escritos como `V-SPEC-040-2` y `V-SPEC-040-3`. Ninguno se materializa
 * hoy en ninguna pantalla, así que no bloqueaban publicar; pero la guardia **es la razón
 * de ser de la spec**, y dejarla con huecos conocidos es justo lo que SPEC-040 vino a
 * evitar. El proyecto ya sabe lo que cuesta una medida que no mira: cuatro specs en
 * verde con el botón «Vigilar» fuera de la pantalla.
 *
 * Y hay una razón por la que estas dos comprobaciones no valen como comentario en el
 * módulo: **un punto ciego cerrado sin test se reabre en el primer refactor**, y se
 * reabre en silencio, que es la forma en que se abrió el primero.
 *
 *  - **`V-SPEC-040-2`** — un `overflow-y: auto` en un ancestro apagaba M1 en **todo su
 *    subárbol**. En CSS, si `overflow-y` es `auto|scroll` y `overflow-x` es `visible`,
 *    el navegador **computa `overflow-x` a `auto`**; M1 eximía por `overflow-x`
 *    computado, así que bastaba un área de desplazamiento **vertical** —algo que un
 *    componente declara sin pensar— para dejar de medir su contenido.
 *  - **`V-SPEC-040-3`** — M1 recorría `nav`, `main` y `footer`, que es literalmente lo
 *    que pedía CA-3; pero el layout raíz monta `<div class="frame">` alrededor de todo.
 *    Un desborde del **chrome del layout** —un hermano de `main`— no lo veía M1 **ni**
 *    lo veía M2, porque por debajo de 720 px el `overflow-x: hidden` del sistema de
 *    diseño lo recorta sin mover `scrollWidth`. Dos medidas ciegas a la vez, que es
 *    exactamente la situación que `V-SPEC-039-6` dejó como lección.
 *
 * ## Lo que estos tests protegen, y lo que NO
 *
 * Cierran el hueco **sin apagar la exención legítima**: ADR-026 §4 admite que el
 * desplazamiento viva en un contenedor propio declarado, y la tabla de `/vigiladas`
 * dentro de `.table-scroll` es esa segunda salida funcionando. Por eso el primer bloque
 * tiene **dos** tests y no uno: el que exige que la ceguera se acabe, y el que exige que
 * la exención **siga viva** — con la comprobación de que de verdad está haciendo algo,
 * no de que no haga falta.
 */

/* ────────────────────────────────────────────────────────────────────────────
   V-SPEC-040-2 — un área de desplazamiento VERTICAL no puede apagar la medida
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('V-SPEC-040-2: un `overflow-y: auto` no deja ciega a M1 en su subárbol', () => {
  test('con el defecto (a) puesto, M1 lo sigue viendo aunque un ancestro declare desplazamiento vertical', async ({
    page,
  }) => {
    await entrar(page, CUENTA_VACIA);
    await page.goto('/vigiladas');
    await page.locator('form.auth-form').waitFor({ state: 'visible' });
    await ponerVentana(page, 360);

    // Control: sin nada inyectado no hay violación. Si esto fallara, el resto del test
    // no diría nada — es la mitad que suele faltar.
    const sano = await medirDesbordePorElemento(page);
    expect(
      sano.violaciones.length,
      `sin reinyectar nada, /vigiladas ya viola M1 a 360 px — el caso de control no ` +
        `vale:\n${describirViolaciones(sano)}`,
    ).toBe(0);

    // (1) El defecto (a), tal cual: es el que CA-7 ya cazaba.
    const quitarDefecto = await inyectarDefecto(page, DEFECTOS.formularioQueNoEncoge);
    const sinAreaVertical = await medirDesbordePorElemento(page);
    expect(
      sinAreaVertical.violaciones.length,
      `el defecto (a) reinyectado a 360 px no produce violación: el escenario de este ` +
        `test no reproduce nada y lo que venga después no demuestra nada`,
    ).toBeGreaterThan(0);

    // (2) El mismo defecto, con un ancestro que declara desplazamiento VERTICAL. No
    //     cambia nada de la maquetación a lo ancho: el contenido sigue saliéndose
    //     exactamente igual. Lo único que cambia es lo que el navegador COMPUTA.
    const quitarArea = await inyectarDefecto(page, CEGUERAS.areaDeDesplazamientoVertical);
    const computado = await page.evaluate(() => {
      const main = document.querySelector('main.page')!;
      const estilo = getComputedStyle(main);
      return {
        overflowX: estilo.overflowX,
        overflowY: estilo.overflowY,
        contenido: main.scrollWidth,
        visible: main.clientWidth,
      };
    });
    const conAreaVertical = await medirDesbordePorElemento(page);
    await quitarArea();
    await quitarDefecto();

    console.log(
      `[V-SPEC-040-2] 360 px · main.page declara overflow-y:auto → computa ` +
        `overflow-x:${computado.overflowX} (contenido=${computado.contenido} ` +
        `visible=${computado.visible}) · M1 sin el área: ${sinAreaVertical.violaciones.length} ` +
        `violaciones sobre ${sinAreaVertical.medidos} elementos; con el área: ` +
        `${conAreaVertical.violaciones.length} sobre ${conAreaVertical.medidos}`,
    );

    // El escenario reproduce la causa REAL, no una rotura cualquiera: lo que hace daño
    // es que el navegador compute `auto` en el eje que nadie declaró.
    expect(
      computado.overflowX,
      `este navegador NO computa \`overflow-x: auto\` al declarar sólo \`overflow-y: ` +
        `auto\` (computa "${computado.overflowX}"), así que el escenario de ` +
        `V-SPEC-040-2 ya no reproduce nada y este test hay que reescribirlo con lo que ` +
        `sea cierto ahora`,
    ).toBe('auto');
    expect(
      computado.contenido,
      `main.page resultó ser desplazable de verdad a lo ancho (contenido=` +
        `${computado.contenido} visible=${computado.visible}), así que eximir su ` +
        `subárbol sería legítimo y el test no está midiendo lo que dice`,
    ).toBeLessThanOrEqual(computado.visible + TOLERANCIA_PX);

    // Y lo que importa: la medida no se apaga.
    expect(
      conAreaVertical.violaciones.length,
      `un ancestro con \`overflow-y: auto\` apagó M1 en su subárbol: sin él ve ` +
        `${sinAreaVertical.violaciones.length} violaciones y con él ve ` +
        `${conAreaVertical.violaciones.length}. La exención de M1 debe exigir que el ` +
        `contenedor sea desplazable DE VERDAD a lo ancho (\`scrollWidth > clientWidth\`), ` +
        `no fiarse del \`overflow-x\` computado`,
    ).toBe(sinAreaVertical.violaciones.length);
    expect(
      conAreaVertical.medidos,
      `M1 dejó de MEDIR elementos al aparecer un área de desplazamiento vertical: ` +
        `${sinAreaVertical.medidos} → ${conAreaVertical.medidos}. Una medida que mide ` +
        `menos elementos no es una medida más limpia, es una medida más ciega`,
    ).toBe(sinAreaVertical.medidos);
  });

  test('la exención legítima sigue viva: la tabla ancha dentro de `.table-scroll` no da violación', async ({
    page,
  }) => {
    await asegurarVigilada(page);
    await page.goto('/vigiladas');
    await page.locator('table.data-table').waitFor({ state: 'visible' });
    await ponerVentana(page, 360);

    // El contenedor es desplazable DE VERDAD, y su contenido se sale de la ventana: si
    // no fuera así, «M1 = 0» no demostraría que la exención sigue funcionando, sólo que
    // no hacía falta.
    const caja = await page.locator('.table-scroll').evaluate((el) => {
      const r = el.getBoundingClientRect();
      const celdas = [...el.querySelectorAll('td, th')].map(
        (c) => c.getBoundingClientRect().right,
      );
      return {
        overflowX: getComputedStyle(el).overflowX,
        contenido: el.scrollWidth,
        visible: el.clientWidth,
        derechaContenedor: r.right,
        derechaCeldaMax: celdas.length === 0 ? 0 : Math.max(...celdas),
        ventana: document.documentElement.clientWidth,
      };
    });

    console.log(
      `[V-SPEC-040-2 exención] 360 px · .table-scroll[overflow-x=${caja.overflowX} ` +
        `contenido=${caja.contenido} visible=${caja.visible}] · celda más a la derecha ` +
        `right=${Math.round(caja.derechaCeldaMax)} sobre ventana ${caja.ventana}`,
    );

    expect(caja.overflowX, 'ADR-026 §4: el desplazamiento vive en su contenedor').toBe('auto');
    expect(
      caja.contenido,
      `.table-scroll no es desplazable a lo ancho a 360 px (contenido=${caja.contenido} ` +
        `visible=${caja.visible}): este test no está probando la exención`,
    ).toBeGreaterThan(caja.visible);
    expect(
      caja.derechaCeldaMax,
      `ninguna celda de la tabla se sale de la ventana a 360 px, así que la exención de ` +
        `M1 no está haciendo nada aquí y este test no prueba nada`,
    ).toBeGreaterThan(caja.ventana + TOLERANCIA_PX);

    // Y con todo eso, M1 no reporta violación: lo que tiene que caber es el CONTENEDOR.
    const m1 = await medirDesbordePorElemento(page);
    expect(
      m1.violaciones.length,
      `M1 reporta violaciones dentro de un contenedor de desplazamiento declarado. Esa ` +
        `es la segunda salida legítima de ADR-026 §4 y no puede contar como ` +
        `defecto:\n${describirViolaciones(m1)}`,
    ).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   V-SPEC-040-3 — el chrome del layout también se mide
   ──────────────────────────────────────────────────────────────────────────── */

test.describe('V-SPEC-040-3: lo que vive fuera de `nav`/`main`/`footer` también se mide', () => {
  test('un bloque desbordado como hermano de `main` lo ve M1 — y no lo ve M2, que es el punto', async ({
    page,
  }) => {
    await entrar(page, CUENTA_VACIA);
    await page.goto('/vigiladas');
    await page.locator('form.auth-form').waitFor({ state: 'visible' });
    await ponerVentana(page, 360);

    const sano = await medirDesbordePorElemento(page);
    expect(
      sano.violaciones.length,
      `sin reinyectar nada, /vigiladas ya viola M1 a 360 px — el caso de control no ` +
        `vale:\n${describirViolaciones(sano)}`,
    ).toBe(0);

    // 900 px dentro de una ventana de 360: el desborde más grosero que cabe imaginar,
    // y hasta hoy invisible para las DOS medidas a la vez.
    const quitar = await inyectarBloqueAncho(page, { padre: '.frame', ancho: 900 });
    const m1 = await medirDesbordePorElemento(page);
    const m2 = await medirDesbordeDeDocumento(page);
    await quitar();

    console.log(
      `[V-SPEC-040-3] 360 px · <div> de 900 px como hijo de .frame → M1 ` +
        `${m1.violaciones.length} violaciones sobre ${m1.medidos} elementos (peor ` +
        `${m1.peor?.selector} right=${Math.round(m1.peor?.derecha ?? 0)}) · documento ` +
        `${m2.documento}/${m2.ventana} (desborde ${m2.desborde})`,
    );

    // (1) M1 lo ve, y lo nombra.
    expect(
      m1.violaciones.length,
      `un bloque de 900 px colgado del chrome del layout (hermano de main, dentro de ` +
        `.frame) es INVISIBLE para M1 a 360 px. Las raíces de M1 tienen que cubrir el ` +
        `chrome del layout, no sólo nav/main/footer`,
    ).toBeGreaterThan(0);
    expect(
      m1.violaciones.some((v) => v.selector.includes('bloque-ancho-reinyectado')),
      `M1 informa de violaciones pero NINGUNA es el bloque reinyectado, así que no es ` +
        `este defecto lo que está cazando:\n${describirViolaciones(m1)}`,
    ).toBe(true);

    // (2) Y M2 no lo ve: por debajo de 720 px el `overflow-x: hidden` del sistema de
    //     diseño lo recorta sin mover `scrollWidth`. Escrito como afirmación porque es
    //     LA razón por la que este hueco era grave: sin M1 ampliada, no quedaba nadie
    //     mirando. Es `V-SPEC-039-6` otra vez, en otra zona de la página.
    expect(
      m2.desborde,
      `la medida de documento SÍ ve el bloque desbordado a 360 px (${m2.documento}/` +
        `${m2.ventana}) — entonces ya no es cierto que \`overflow-x: hidden\` la ` +
        `enmascare aquí, y esta afirmación hay que reescribirla con lo que sea cierto ahora`,
    ).toBeLessThanOrEqual(TOLERANCIA_PX);

    // (3) Quitada la inyección, la página vuelve a estar limpia. La medida no se queda
    //     «pegada» al defecto.
    const limpio = await medirDesbordePorElemento(page);
    expect(limpio.violaciones.length, describirViolaciones(limpio)).toBe(0);
  });

  test('el chrome del layout entra en la cuenta de elementos medidos, en las dos rutas de más peso', async ({
    page,
  }) => {
    // El coste de ensanchar la raíz se paga en elementos medidos por ejecución, así que
    // se deja escrito cuánto es: es el número que hay que mirar el día que alguien
    // proponga estrecharla otra vez «porque la suite tarda».
    await asegurarVigilada(page);

    for (const ruta of ['/dashboard', '/vigiladas'] as const) {
      await page.goto(ruta);
      await ponerVentana(page, 360);
      const conChrome = await medirDesbordePorElemento(page);
      const soloTresRaices = await medirDesbordePorElemento(page, { raices: 'nav, main, footer' });

      console.log(
        `[V-SPEC-040-3 coste] ${ruta} a 360 px · raíces del módulo: ` +
          `${conChrome.medidos} elementos · sólo nav/main/footer: ` +
          `${soloTresRaices.medidos} · diferencia ${conChrome.medidos - soloTresRaices.medidos}`,
      );

      expect(
        conChrome.medidos,
        `las raíces del módulo miden ${conChrome.medidos} elementos y las tres de CA-3 ` +
          `miden ${soloTresRaices.medidos}: la raíz NO se ha ensanchado, o \`.frame\` no ` +
          `está entrando en la medida`,
      ).toBeGreaterThan(soloTresRaices.medidos);
      expect(
        conChrome.violaciones.length,
        `ensanchar la raíz destapó desbordes en ${ruta} a 360 px. Si son reales, son un ` +
          `hallazgo y van a la spec que corresponda; si son ruido, van a la lista de ` +
          `exclusiones CON SU MOTIVO (F-ADR-026-2), nunca a una holgura ` +
          `global:\n${describirViolaciones(conChrome)}`,
      ).toBe(0);
    }
  });
});
