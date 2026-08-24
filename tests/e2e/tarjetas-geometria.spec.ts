import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import {
  ANCHOS_TABLA,
  ANCHOS_TELEFONO,
  DEFECTO_AREA_TACTIL,
  SUELO_TACTIL_PX,
  TOLERANCIA_PX,
  describirAreaTactil,
  describirDesborde,
  describirViolaciones,
  inyectarDefecto,
  medirAreaTactil,
  medirCajas,
  medirDesborde,
  medirDesbordePorElemento,
  medirIntegridadDePalabra,
  medirOverflowHorizontal,
  medirPropiedadesComputadas,
  medirSuelosTipograficos,
  ponerVentana,
} from './geometria';
import {
  PANTALLAS,
  RAICES_EN_ALCANCE,
  SELECTOR_TABLA,
  SHOTS,
  TARJETAS_VIGILADAS,
  abrirAncha,
  prepararCuenta,
} from './spec054';

/**
 * SPEC-054 CA-4, CA-5, CA-13, CA-14, CA-15, CA-17, CA-20 y CA-21 — **que quepa, que no se
 * arrastre, que se pueda pulsar y que se pueda leer**.
 *
 * ## Todas las medidas se importan (ADR-026 §2)
 *
 * Ninguna guardia de esta spec escribe una medida propia. M1, M2 y M3 vienen de SPEC-040;
 * **M5** —el área táctil— la aporta esta spec al módulo, junto a los primitivos que
 * necesita (`medirOverflowHorizontal`, `medirCajas`, `medirPropiedadesComputadas`,
 * `medirSuelosTipograficos`). Aquí sólo se dice **qué se afirma**.
 *
 * ## Por qué M2 no basta, y por qué hay una pregunta que M1 tampoco responde
 *
 * `design/tremen-ds/responsive.css` declara `html, body { overflow-x: hidden }` por debajo
 * de 720 px, **y la app carga ese fichero** (`layout.tsx` → `globals.css` →
 * `components/index.css` → `../responsive.css`). O sea: en un teléfono, un `scrollWidth` de
 * documento sano **no prueba nada**. De ahí que ADR-026 mida elemento a elemento.
 *
 * Y hay una tercera pregunta que ni M1 ni M2 responden: *«¿queda algún contenedor que
 * arrastrar?»*. M1 exime a propósito los descendientes de un contenedor con desplazamiento
 * declarado —es la segunda salida legítima de ADR-026 §4— así que una tabla dentro de su
 * `.table-scroll` le parece bien, **y le parecía bien antes de esta spec**. La promesa del
 * patrón de tarjetas es que en móvil no se arrastra nada, y eso hay que preguntarlo aparte:
 * es la segunda mitad de CA-4.
 *
 * ## El alcance de M5 y de los suelos tipográficos
 *
 * Está escrito en `RAICES_EN_ALCANCE` y en el «fuera de alcance» de la spec: `main.page` de
 * las dos pantallas más la capa de edición. La navegación global y el pie **quedan fuera de
 * la afirmación pero dentro de la medición**: sus cifras se escriben en `_qa/SPEC-054/` sin
 * asertarse, porque `R-1 de EPIC-007` predijo que el medidor nacería rojo también ahí y la
 * spec 2 de la épica no se puede dimensionar sin esos números.
 */

function guardar(nombre: string, cabecera: string, cuerpo: string) {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(`${SHOTS}/${nombre}`, `${cabecera}\n${cuerpo}\n`, 'utf8');
}

/** Los avisos de diagnóstico, en la representación que esté viva. */
const AVISOS = '.quote-fail, .quote-pending, .quote-stale';

/* ────────────────────────────────────────────────────────────────────────────
   CA-4 — cero desbordamiento y NI UN CONTENEDOR QUE ARRASTRAR
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-4: en un teléfono no desborda nada y no queda nada que arrastrar', async ({
  page,
}) => {
  test.slow();
  await prepararCuenta(page);

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    await abrirAncha(page, pantalla);
    for (const ancho of ANCHOS_TELEFONO) {
      const m = await medirDesborde(page, ancho);
      lineas.push(`${pantalla.ruta} · ${describirDesborde(m)}`);

      // (a) M1 — la medida principal, la que `overflow: hidden` no puede enmascarar.
      expect(m.m1.medidos, `${pantalla.ruta} a ${ancho} px no se midió nada`).toBeGreaterThan(5);
      expect(
        m.m1.violaciones.length,
        `${pantalla.ruta} a ${ancho} px: ${m.m1.violaciones.length} elementos se salen de la ` +
          `ventana.\n${describirViolaciones(m.m1)}`,
      ).toBe(0);

      // (b) M2 — el documento no se desplaza. Nunca es la única (ADR-026 §1).
      expect(
        m.m2.desborde,
        `${pantalla.ruta} a ${ancho} px el documento mide ${m.m2.documento} sobre una ventana ` +
          `de ${m.m2.ventana}`,
      ).toBeLessThanOrEqual(TOLERANCIA_PX);

      // (c) M3 — ningún rótulo se parte DENTRO de una palabra. No desborda nada, así que
      //     ni (a) ni (b) lo verían.
      const textos = await medirIntegridadDePalabra(
        page,
        '.tarjeta-cabecera, .tarjeta-datos dt, .tarjeta-datos dd, .tarjeta-pie button',
        '.tarjeta',
      );
      const pintados = textos.filter((t) => t.lineas > 0);
      expect(
        pintados.length,
        `${pantalla.ruta} a ${ancho} px M3 no midió ni un texto de tarjeta`,
      ).toBeGreaterThan(0);
      for (const t of pintados) {
        expect(
          t.lineas,
          `${pantalla.ruta} a ${ancho} px «${t.texto}» ocupa ${t.lineas} líneas para ` +
            `${t.palabras} palabra(s): se está partiendo dentro de una palabra`,
        ).toBeLessThanOrEqual(Math.max(1, t.palabras));
      }

      // (d) **Y ni un contenedor que arrastrar.** Es la promesa del patrón, y no se
      //     deduce de (a) ni de (b): M1 exime el subárbol de un contenedor con
      //     desplazamiento declarado precisamente porque es una salida legítima.
      const contenedores = await medirOverflowHorizontal(page);
      const arrastrables = contenedores.filter((c) => c.hayQueArrastrar);
      expect(
        arrastrables.map((c) => `${c.selector} (${c.contenido}/${c.visible})`),
        `${pantalla.ruta} a ${ancho} px queda un contenedor que hay que arrastrar de lado. ` +
          `El patrón de tarjetas existe para que en un teléfono la lectura de una fila deje ` +
          `de ser un gesto de exploración por columna: si algo sigue desplazándose a lo ` +
          `ancho, el arreglo está a medias`,
      ).toEqual([]);
      lineas.push(
        `  contenedores con overflow-x declarado o recortado: ` +
          `${contenedores.map((c) => `${c.selector}=${c.overflowX}`).join(', ')}`,
      );
    }
  }
  guardar('m1-m2-m3-telefono.txt', 'SPEC-054 CA-4 — las tres medidas en teléfono', lineas.join('\n'));
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-21 — la salida prohibida no se usa (R-2 de EPIC-007)
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-21: ni un `overflow: hidden` nuevo, y los que hay son los de siempre', async ({
  page,
}) => {
  await prepararCuenta(page);

  /**
   * Los tres que ya estaban antes de esta spec, con su motivo:
   *
   *  - `html` y `body` — los pone `design/tremen-ds/responsive.css` en su pasada móvil.
   *    Es **el mal ejemplo que ADR-026 §4 nombra**, vive en un fichero que la app carga, y
   *    ADR-026 lo acepta explícitamente como heredado: quitarlo es una auditoría de todas
   *    las superficies del producto, no un cambio de esta spec.
   *  - `table.data-table` — lo lleva desde SPEC-007 para recortar sus esquinas
   *    redondeadas, que es `overflow: hidden` haciendo de máscara y no de arreglo.
   */
  const HEREDADOS = ['html', 'body', 'table.data-table'];

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    await abrirAncha(page, pantalla);
    for (const ancho of ANCHOS_TELEFONO) {
      await ponerVentana(page, ancho);
      const recortados = (await medirOverflowHorizontal(page))
        .filter((c) => c.overflowX === 'hidden')
        .map((c) => c.selector);
      lineas.push(`${pantalla.ruta} · ancho ${ancho} · recortan: ${recortados.join(', ')}`);
      const nuevos = recortados.filter((s) => !HEREDADOS.includes(s));
      expect(
        nuevos,
        `${pantalla.ruta} a ${ancho} px hay elementos que recortan a lo ancho y no estaban ` +
          `antes: [${nuevos.join(', ')}]. ADR-026 §4 dice que \`overflow: hidden\` **no es un ` +
          `arreglo**: es la versión visual del fallo silencioso. Las dos salidas legítimas ` +
          `son que quepa, o que el desplazamiento viva en un contenedor propio declarado — y ` +
          `en móvil esta spec eligió la primera`,
      ).toEqual([]);
    }
  }
  guardar('overflow-recortado.txt', 'SPEC-054 CA-21 — quién recorta a lo ancho, y desde cuándo', lineas.join('\n'));
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-5 — `.table-scroll` sobrevive intacta por encima del breakpoint
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-5: por encima del canto, la tabla se sigue desplazando en SU caja', async ({
  page,
}) => {
  test.slow();
  await prepararCuenta(page);

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    await abrirAncha(page, pantalla);
    for (const ancho of ANCHOS_TABLA) {
      const m = await medirDesborde(page, ancho);
      const [caja] = await medirPropiedadesComputadas(page, '.table-scroll', [
        'overflow-x',
        'min-width',
        'max-width',
        'display',
      ]);
      const contenedores = await medirOverflowHorizontal(page);
      const scroll = contenedores.find((c) => c.selector.startsWith('div.table-scroll'));

      lineas.push(
        `${pantalla.ruta} · ${describirDesborde(m)} · .table-scroll[` +
          `overflow-x=${caja.props['overflow-x']} min-width=${caja.props['min-width']} ` +
          `max-width=${caja.props['max-width']} display=${caja.props.display} ` +
          `contenido=${scroll?.contenido}/${scroll?.visible}]`,
      );

      // (a) La declaración de SPEC-040 CA-5 sigue en pie, entera.
      expect(
        caja.props['overflow-x'],
        `a ${ancho} px \`.table-scroll\` no absorbe el desplazamiento. SPEC-040 CA-5 la sacó ` +
          `del \`@media\` porque entre 721 y 800 px lo absorbía el DOCUMENTO (a 760 px, 819 ` +
          `sobre 760). Esta spec no la toca por encima del canto`,
      ).toBe('auto');
      expect(caja.props['min-width'], `a ${ancho} px \`.table-scroll\` perdió su \`min-width: 0\``).toBe('0px');
      expect(
        caja.props['max-width'] === '100%' || caja.props['max-width'].endsWith('px'),
        `a ${ancho} px \`.table-scroll\` declara \`max-width: ${caja.props['max-width']}\`, que ` +
          `no acota nada`,
      ).toBe(true);
      expect(caja.props.display, `a ${ancho} px \`.table-scroll\` está apagada`).not.toBe('none');

      // (b) M2 — el documento no se desplaza a lo ancho a ninguno de los cuatro.
      expect(
        m.m2.desborde,
        `a ${ancho} px ${pantalla.ruta} desplaza el DOCUMENTO: ${m.m2.documento} sobre ` +
          `${m.m2.ventana}. Es la regresión exacta que SPEC-040 CA-5 arregló`,
      ).toBeLessThanOrEqual(TOLERANCIA_PX);
    }

    // (c) Y sigue siendo LEGIBLE: desplazándola se alcanza la última columna. Sólo tiene
    //     sentido donde la tabla no cabe, que en la de nueve columnas es 730 y 760.
    if (pantalla.ruta !== '/vigiladas') continue;
    for (const ancho of [730, 760]) {
      await ponerVentana(page, ancho);
      const scroll = (await medirOverflowHorizontal(page)).find((c) =>
        c.selector.startsWith('div.table-scroll'),
      );
      expect(
        scroll?.hayQueArrastrar,
        `a ${ancho} px la tabla de nueve columnas NO desborda su caja, así que este caso no ` +
          `prueba que el desplazamiento siga funcionando: mide la situación en la que el ` +
          `defecto no puede existir`,
      ).toBe(true);

      await page.locator('.table-scroll').evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      const [quitar] = await medirCajas(
        page,
        `${SELECTOR_TABLA} tbody tr:first-child .fila-acciones form button`,
      );
      expect(
        quitar.right,
        `a ${ancho} px, con la tabla desplazada a tope, el control «${quitar.texto}» de la ` +
          `última columna sigue fuera de la ventana (right=${Math.round(quitar.right)})`,
      ).toBeLessThanOrEqual(m1Ventana(ancho));
      expect(quitar.left, `a ${ancho} px «${quitar.texto}» queda cortado por la izquierda`).toBeGreaterThanOrEqual(
        -TOLERANCIA_PX,
      );
    }
  }
  guardar('table-scroll-sobre-el-canto.txt', 'SPEC-054 CA-5 — cero regresión de SPEC-040 CA-5', lineas.join('\n'));
});

/** El borde derecho admisible a un ancho dado, con la tolerancia de redondeo del motor. */
const m1Ventana = (ancho: number) => ancho + TOLERANCIA_PX;

/* ────────────────────────────────────────────────────────────────────────────
   CA-13 — M5, el área táctil, con su prueba de eficacia
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-13: todo control llega al suelo táctil, y la medida ve el defecto', async ({
  page,
}) => {
  test.slow();
  await prepararCuenta(page);

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    await abrirAncha(page, pantalla);
    for (const ancho of ANCHOS_TELEFONO) {
      await ponerVentana(page, ancho);

      const m5 = await medirAreaTactil(page, {
        raices: RAICES_EN_ALCANCE,
        testigos: '.tarjeta-pie button, [data-testid="orden-direccion"]',
      });
      lineas.push(`${pantalla.ruta} · ancho ${ancho} · ${describirAreaTactil(m5)}`);

      expect(
        m5.medidos,
        `${pantalla.ruta} a ${ancho} px M5 no midió ni un control: la medida no está mirando ` +
          `donde cree`,
      ).toBeGreaterThan(2);
      if (pantalla.ruta === '/vigiladas') {
        expect(
          m5.testigos,
          `${pantalla.ruta} a ${ancho} px los controles de la tarjeta NO aparecen entre lo ` +
            `que M5 midió. Un «cero por debajo del suelo» que no incluye los controles que ` +
            `esta spec agrandó no aprueba nada`,
        ).not.toEqual([]);
      }
      expect(
        m5.pequenos.map((c) => `${c.selector} «${c.rotulo}» ${Math.round(c.ancho)}x${Math.round(c.alto)}`),
        `${pantalla.ruta} a ${ancho} px hay controles por debajo del suelo de ` +
          `${SUELO_TACTIL_PX}x${SUELO_TACTIL_PX}. La salida legítima es AGRANDARLOS —y ` +
          `apilarlos si dos no caben en una línea— nunca bajar el suelo, que sería ` +
          `F-ADR-026-1 cumpliéndose por escrito (ADR-026 §4, ADR-034 §6).\n` +
          describirAreaTactil(m5),
      ).toEqual([]);
      expect(
        m5.solapes.map((s) => `${s.a} ↔ ${s.b}`),
        `${pantalla.ruta} a ${ancho} px dos dianas se pisan. Dos controles de ` +
          `${SUELO_TACTIL_PX} px que se solapan no son dos dianas: son una zona en la que no ` +
          `se sabe qué se está pulsando`,
      ).toEqual([]);
    }
  }

  /*
    ── Prueba de eficacia (ADR-026 §7) ───────────────────────────────────────────────

    Una guardia que no se pone roja al devolverle el defecto no está midiendo lo que dice
    medir, y este proyecto ya vivió la versión cara de esa lección. Aquí se le devuelve **el
    defecto real**: `.btn-sm` con la caja pequeña que tenía el día que M5 nació —≈31 px de
    alto en *Editar*, *Quitar* y el botón de dirección del orden— con la suite entera en
    verde porque ninguna medida preguntaba si el dedo llega.

    Es además la prueba de que el arreglo se escribió **donde la reinyección lo puede
    deshacer**: si el `padding` viviera detrás de un `min-height` o de un selector más
    específico, esto seguiría verde y la guardia no demostraría nada.
  */
  await abrirAncha(page, PANTALLAS[0]);
  await ponerVentana(page, ANCHOS_TELEFONO[0]);
  const sano = await medirAreaTactil(page, { raices: RAICES_EN_ALCANCE });
  const quitar = await inyectarDefecto(page, DEFECTO_AREA_TACTIL);
  const conDefecto = await medirAreaTactil(page, { raices: RAICES_EN_ALCANCE });
  await quitar();
  const despues = await medirAreaTactil(page, { raices: RAICES_EN_ALCANCE });

  lineas.push(
    `── prueba de eficacia a ${ANCHOS_TELEFONO[0]} px · sano=${sano.pequenos.length} · ` +
      `con el defecto=${conDefecto.pequenos.length} · al quitarlo=${despues.pequenos.length}`,
  );
  expect(
    sano.pequenos.length,
    'el caso de control no vale: la pantalla ya tiene controles por debajo del suelo sin ' +
      'reinyectar nada',
  ).toBe(0);
  expect(
    conDefecto.pequenos.length,
    `M5 NO ve el defecto reinyectado. Con \`${DEFECTO_AREA_TACTIL}\` puesto, los controles ` +
      `de fila vuelven a medir lo que medían antes de esta spec y la medida sigue en verde: ` +
      `o no mira donde cree, o el arreglo está escrito detrás de un \`min-height\` o de un ` +
      `selector más específico, que es lo que hace inservible la prueba (ADR-026 §7)`,
  ).toBeGreaterThan(0);
  expect(
    despues.pequenos.length,
    'al quitar la reinyección la medida se queda roja: el defecto no era el inyectado',
  ).toBe(0);

  guardar('m5-area-tactil.txt', 'SPEC-054 CA-13 — M5 en las dos pantallas, con su prueba de eficacia', lineas.join('\n'));
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-14 — los dos suelos de legibilidad
   ──────────────────────────────────────────────────────────────────────────── */

/** Por debajo, Safari en iOS amplía la página al enfocar el campo y no la devuelve. */
const SUELO_CONTROL_PX = 16;
/** El suelo que el proyecto YA tenía (`.quote-*`). Se congela, no se sube (ADR-034 §7). */
const SUELO_TEXTO_PX = 12;

test('SPEC-054 CA-14: 16 px en los controles de formulario y 12 px en cualquier texto', async ({
  page,
}) => {
  test.slow();
  await prepararCuenta(page);

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    await abrirAncha(page, pantalla);
    for (const ancho of ANCHOS_TELEFONO) {
      await ponerVentana(page, ancho);
      // El formulario de alta, desplegado: sus campos también cuentan.
      if (pantalla.ruta === '/vigiladas') {
        const toggle = page.getByTestId('alta-toggle');
        if ((await toggle.count()) > 0 && (await toggle.getAttribute('aria-expanded')) === 'false') {
          await toggle.click();
        }
      }

      const t = await medirSuelosTipograficos(page, { raices: RAICES_EN_ALCANCE });
      lineas.push(
        `${pantalla.ruta} · ancho ${ancho} · ${t.controles.length} controles, ` +
          `${t.textos.length} textos · control mínimo=` +
          `${Math.min(...t.controles.map((c) => c.tamano))} · texto mínimo=` +
          `${Math.min(...t.textos.map((c) => c.tamano))}`,
      );

      expect(t.controles.length, `${pantalla.ruta} a ${ancho} px no se midió ni un campo`).toBeGreaterThan(0);
      expect(
        t.controles.filter((c) => c.tamano < SUELO_CONTROL_PX).map((c) => `${c.selector} ${c.tamano}px`),
        `${pantalla.ruta} a ${ancho} px hay campos de formulario por debajo de ` +
          `${SUELO_CONTROL_PX} px. No es estética: es el umbral EXACTO por el que Safari en ` +
          `iOS amplía la página al enfocar el campo y no la devuelve, dejando al usuario en ` +
          `una vista desplazada de la que tiene que salir a mano (ADR-034 §7)`,
      ).toEqual([]);

      expect(t.textos.length, `${pantalla.ruta} a ${ancho} px no se midió ni un texto`).toBeGreaterThan(5);
      expect(
        t.textos.filter((c) => c.tamano < SUELO_TEXTO_PX).map((c) => `${c.selector} «${c.texto}» ${c.tamano}px`),
        `${pantalla.ruta} a ${ancho} px hay texto por debajo de ${SUELO_TEXTO_PX} px. Es el ` +
          `suelo que el proyecto YA tenía en \`.quote-*\`, y esta spec lo congela: subirlo ` +
          `obligaría a rehacer la caja de 34ch que SPEC-016 y SPEC-043 afinaron`,
      ).toEqual([]);
    }
  }
  guardar('suelos-de-legibilidad.txt', 'SPEC-054 CA-14 — los dos suelos, en las dos pantallas', lineas.join('\n'));
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-15 — los avisos de diagnóstico no se rompen en formato tarjeta
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-15: los avisos conservan su caja, envuelven y se leen enteros', async ({
  page,
}) => {
  test.slow();
  await prepararCuenta(page);

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    // (1) El texto de referencia: el que se lee en la vista ANCHA.
    await abrirAncha(page, pantalla);
    const ancho1280 = await page.locator(AVISOS).filter({ visible: true }).allTextContents();
    expect(
      ancho1280.length,
      `${pantalla.ruta} a 1280 px no hay ni un aviso de diagnóstico: el escenario no cubre ` +
        `lo que CA-15 mide`,
    ).toBeGreaterThan(0);

    for (const ancho of ANCHOS_TELEFONO) {
      await ponerVentana(page, ancho);
      const enMovil = await page.locator(AVISOS).filter({ visible: true }).allTextContents();

      // (a) **Completos, carácter a carácter.** No es «se ve algo»: es que no se recortó,
      //     no se puso una elipsis y no se escondió detrás de un `title`.
      expect(
        enMovil,
        `${pantalla.ruta} a ${ancho} px los avisos no dicen lo mismo que a 1280 px. Esta tabla ` +
          `YA se rompió una vez por un párrafo de motivo, y la lección de SPEC-040 CA-4 fue ` +
          `acotar la CAJA, nunca el texto`,
      ).toEqual(ancho1280);

      // (b) Conservan su caja acotada y envuelven de verdad.
      const cajas = await medirPropiedadesComputadas(page, AVISOS, ['max-width', 'display']);
      const textos = await medirIntegridadDePalabra(page, AVISOS, '.tarjeta, td');
      for (const c of cajas) {
        expect(
          c.props['max-width'],
          `${pantalla.ruta} a ${ancho} px el aviso «${c.texto}» perdió su caja acotada ` +
            `(max-width: ${c.props['max-width']}). Los 34ch los pusieron SPEC-016 y SPEC-043 ` +
            `y el formato tarjeta no es excusa para deshacerlos`,
        ).not.toBe('none');
      }
      const largos = textos.filter((t) => t.palabras > 3 && t.lineas > 0);
      expect(
        largos.length,
        `${pantalla.ruta} a ${ancho} px no se midió ningún aviso largo`,
      ).toBeGreaterThan(0);
      for (const t of largos) {
        expect(
          t.lineas,
          `${pantalla.ruta} a ${ancho} px el aviso «${t.texto}» cabe en una sola línea de ` +
            `${Math.round(t.anchoLineaMax)} px: o no está acotado, o no está envolviendo`,
        ).toBeGreaterThan(1);
        expect(
          t.lineas,
          `${pantalla.ruta} a ${ancho} px el aviso «${t.texto}» ocupa ${t.lineas} líneas para ` +
            `${t.palabras} palabras: está partiendo palabras (M3)`,
        ).toBeLessThanOrEqual(t.palabras);
      }

      // (c) Y no desborda su tarjeta. **M1 rooteado en la tarjeta responde a otra
      //     pregunta** —si cabe en la VENTANA— así que se afirman las dos: la de M1, que
      //     es la que el CA nombra, y la comparación de cajas, que es lo que «no desborda
      //     su tarjeta» significa literalmente.
      const m1 = await medirDesbordePorElemento(page, { raices: `${pantalla.tarjetas} > li` });
      expect(
        m1.violaciones.length,
        `${pantalla.ruta} a ${ancho} px hay contenido de tarjeta fuera de la ventana:\n` +
          describirViolaciones(m1),
      ).toBe(0);
      const avisos = await medirCajas(page, `${pantalla.tarjetas} ${AVISOS}`);
      const tarjetas = await medirCajas(page, `${pantalla.tarjetas} > li`);
      for (const a of avisos) {
        const suya = tarjetas.find((t) => a.top >= t.top - TOLERANCIA_PX && a.bottom <= t.bottom + TOLERANCIA_PX);
        expect(suya, `no se encontró la tarjeta del aviso «${a.texto}»`).toBeDefined();
        expect(
          a.right,
          `${pantalla.ruta} a ${ancho} px el aviso «${a.texto}» se sale de su tarjeta por la ` +
            `derecha: ${Math.round(a.right)} contra ${Math.round(suya!.right)}`,
        ).toBeLessThanOrEqual(suya!.right + TOLERANCIA_PX);
      }
      lineas.push(
        `${pantalla.ruta} · ancho ${ancho} · ${avisos.length} avisos, ` +
          `max-width=${[...new Set(cajas.map((c) => c.props['max-width']))].join('/')} · ` +
          `líneas=${largos.map((t) => t.lineas).join(',')}`,
      );
    }
  }
  guardar('avisos-en-la-tarjeta.txt', 'SPEC-054 CA-15 — los avisos, enteros y dentro de su caja', lineas.join('\n'));
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-17 — lo que rodea a las dos tablas también cabe y se puede pulsar
   ──────────────────────────────────────────────────────────────────────────── */

/** Cada superficie en alcance que rodea a una tabla, con la pantalla en la que vive. */
const ENTORNO: { ruta: string; selector: string; nombre: string }[] = [
  { ruta: '/vigiladas', selector: '.page-head', nombre: 'cabecera de vigiladas' },
  { ruta: '/vigiladas', selector: '.orden-control', nombre: 'control de orden' },
  { ruta: '/vigiladas', selector: '.alta-vigilada', nombre: 'alta plegable' },
  { ruta: '/cartera', selector: '.page-head.page-head-row', nombre: 'cabecera de cartera' },
  { ruta: '/cartera', selector: 'form.auth-form', nombre: 'formularios de compra y venta' },
];

test('SPEC-054 CA-17: cabecera, orden, alta plegable y formularios de cartera', async ({ page }) => {
  test.slow();
  await prepararCuenta(page);

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    const superficies = ENTORNO.filter((e) => e.ruta === pantalla.ruta);
    for (const ancho of ANCHOS_TELEFONO) {
      for (const plegado of [true, false]) {
        await abrirAncha(page, pantalla);
        await ponerVentana(page, ancho);
        // El alta se mide **desplegada y plegada**: son dos cajas distintas y la de dentro
        // sólo existe en una de las dos.
        const toggle = page.getByTestId('alta-toggle');
        if ((await toggle.count()) > 0) {
          const abierto = (await toggle.getAttribute('aria-expanded')) === 'true';
          if (abierto === plegado) await toggle.click();
        } else if (plegado === false) {
          continue;
        }

        for (const s of superficies) {
          const presentes = await medirCajas(page, s.selector);
          if (presentes.length === 0) continue;

          const m1 = await medirDesbordePorElemento(page, { raices: s.selector, testigos: s.selector });
          expect(
            m1.testigos,
            `${s.nombre} a ${ancho} px no entró en la medida: M1 no midió nada suyo`,
          ).not.toEqual([]);
          expect(
            m1.violaciones.length,
            `${s.nombre} a ${ancho} px (alta ${plegado ? 'plegada' : 'desplegada'}) se sale de ` +
              `la ventana:\n${describirViolaciones(m1)}`,
          ).toBe(0);

          const m5 = await medirAreaTactil(page, { raices: s.selector });
          expect(
            m5.pequenos.map((c) => `${c.selector} «${c.rotulo}» ${Math.round(c.ancho)}x${Math.round(c.alto)}`),
            `${s.nombre} a ${ancho} px tiene controles por debajo del suelo táctil`,
          ).toEqual([]);

          // Y ninguna de estas superficies declara un contenedor con desplazamiento
          // horizontal: la salida de «no cabe» aquí es que quepa, no que se arrastre.
          const arrastrables = (await medirOverflowHorizontal(page)).filter(
            (c) => c.hayQueArrastrar,
          );
          expect(
            arrastrables.map((c) => c.selector),
            `${s.nombre} a ${ancho} px deja un contenedor que arrastrar`,
          ).toEqual([]);

          lineas.push(
            `${s.nombre} · ancho ${ancho} · alta ${plegado ? 'plegada' : 'desplegada'} · ` +
              `M1 ${m1.violaciones.length}/${m1.medidos} · M5 ${m5.pequenos.length}/${m5.medidos}`,
          );
        }

        // M3 sobre el `<select>` del orden: un rótulo partido no desborda nada y sólo lo
        // ve la integridad de palabra.
        if (pantalla.ruta === '/vigiladas') {
          const opciones = await medirIntegridadDePalabra(page, '.orden-control label', '.orden-control');
          for (const t of opciones.filter((t) => t.lineas > 0)) {
            expect(
              t.lineas,
              `a ${ancho} px «${t.texto}» del control de orden se parte en ${t.lineas} líneas ` +
                `para ${t.palabras} palabras`,
            ).toBeLessThanOrEqual(Math.max(1, t.palabras));
          }
        }
      }
    }
  }
  guardar('entorno-de-las-tablas.txt', 'SPEC-054 CA-17 — lo que rodea a las dos tablas', lineas.join('\n'));
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-20 — el pie de la tarjeta: dos controles al 50 %, en una fila
   ──────────────────────────────────────────────────────────────────────────── */

test('SPEC-054 CA-20: *Editar* y *Quitar*, misma fila, mitad y mitad, y pulsables', async ({
  page,
}) => {
  await prepararCuenta(page);
  await abrirAncha(page, PANTALLAS[0]);

  const lineas: string[] = [];
  for (const ancho of ANCHOS_TELEFONO) {
    await ponerVentana(page, ancho);
    const pies = await medirCajas(page, `${TARJETAS_VIGILADAS} .tarjeta-pie`);
    expect(pies.length, `a ${ancho} px no hay pies de tarjeta que medir`).toBeGreaterThan(0);

    for (const [i, pie] of pies.entries()) {
      const botones = (await medirCajas(page, `${TARJETAS_VIGILADAS} > li:nth-child(${i + 1}) .tarjeta-pie button`));
      expect(
        botones.length,
        `a ${ancho} px el pie de la tarjeta ${i} no tiene los dos controles: esconder uno no ` +
          `cuenta como arreglo (ADR-026 §4)`,
      ).toBe(2);
      const [editar, quitar] = botones;

      // (a) En la MISMA fila. Es la decisión del humano del 2026-08-24 frente a apilarlos,
      //     y el motivo es que mantiene la tarjeta corta — con cuarenta vigiladas, el alto
      //     de la tarjeta es el coste que paga el usuario en cada recorrido.
      expect(
        Math.abs(editar.top - quitar.top),
        `a ${ancho} px «${editar.texto}» y «${quitar.texto}» no están en la misma fila ` +
          `(top ${Math.round(editar.top)} contra ${Math.round(quitar.top)})`,
      ).toBeLessThanOrEqual(TOLERANCIA_PX);

      // (b) Al 50 %: los dos miden lo mismo, y juntos con el hueco ocupan el pie entero.
      expect(
        Math.abs(editar.ancho - quitar.ancho),
        `a ${ancho} px los dos controles no miden lo mismo: ${Math.round(editar.ancho)} contra ` +
          `${Math.round(quitar.ancho)}`,
      ).toBeLessThanOrEqual(TOLERANCIA_PX);
      const hueco = quitar.left - editar.right;
      expect(
        editar.ancho + quitar.ancho + hueco,
        `a ${ancho} px los dos controles más el hueco (${Math.round(hueco)} px) no ocupan el ` +
          `ancho del pie (${Math.round(pie.ancho)} px): no están repartidos al 50 %`,
      ).toBeCloseTo(pie.ancho, 0);
      expect(hueco, `a ${ancho} px los dos controles se tocan o se pisan`).toBeGreaterThan(0);

      // (c) Y cada uno cumple el suelo táctil por sí solo, en los DOS ejes.
      for (const b of [editar, quitar]) {
        expect(
          Math.min(b.ancho, b.alto),
          `a ${ancho} px «${b.texto}» mide ${Math.round(b.ancho)}x${Math.round(b.alto)} y no ` +
            `llega al suelo de ${SUELO_TACTIL_PX}x${SUELO_TACTIL_PX} (ADR-034 §6)`,
        ).toBeGreaterThanOrEqual(SUELO_TACTIL_PX - TOLERANCIA_PX);
      }
    }
    lineas.push(
      `ancho ${ancho} · ${pies.length} pies · ancho del pie ${Math.round(pies[0].ancho)} px · ` +
        `cada control ~${Math.round((pies[0].ancho - 8) / 2)} px`,
    );
  }
  guardar('pie-de-la-tarjeta.txt', 'SPEC-054 CA-20 — dos controles al 50 %, en una fila', lineas.join('\n'));
});

/* ────────────────────────────────────────────────────────────────────────────
   El trabajo que M5 descubre FUERA del alcance de esta spec (R-1 de EPIC-007)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * No afirma nada: **mide y deja la cifra**.
 *
 * `R-1 de EPIC-007` predijo que el medidor de área táctil nacería rojo en sitios que esta
 * spec no puede tocar —la navegación global y el pie están en su «fuera de alcance»— y que
 * *«la spec 2 y la 3 no se pueden dimensionar bien hasta que SPEC-054 encienda el
 * medidor»*. Encendido está: esto deja el número donde la spec 2 lo encuentre.
 *
 * Lo que **no** se hace es bajar el suelo hasta que pase (ADR-034 §6). Y lo que no se hace
 * tampoco es callarlo.
 */
test('SPEC-054 — la cifra de M5 fuera de alcance, para la spec 2 de la épica', async ({ page }) => {
  await prepararCuenta(page);
  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    await abrirAncha(page, pantalla);
    for (const ancho of ANCHOS_TELEFONO) {
      await ponerVentana(page, ancho);
      const entera = await medirAreaTactil(page);
      const enAlcance = await medirAreaTactil(page, { raices: RAICES_EN_ALCANCE });
      const fuera = entera.pequenos.filter(
        (c) => !enAlcance.pequenos.some((d) => d.selector === c.selector && d.top === c.top),
      );
      lineas.push(
        `${pantalla.ruta} · ancho ${ancho} · pantalla entera: ${entera.pequenos.length} de ` +
          `${entera.medidos} controles por debajo del suelo · en alcance: ` +
          `${enAlcance.pequenos.length} de ${enAlcance.medidos} · FUERA de alcance: ${fuera.length}`,
        ...fuera.map(
          (c) => `    ${c.selector} «${c.rotulo}»: ${Math.round(c.ancho)}x${Math.round(c.alto)}`,
        ),
      );
    }
  }
  guardar(
    'm5-fuera-de-alcance.txt',
    'SPEC-054 — R-1 de EPIC-007: lo que M5 destapa en la nav y el pie. NO se afirma aquí:\n' +
      'la navegación global y el pie están en el «fuera de alcance» de esta spec y son la\n' +
      'spec 2 de la épica. La salida es agrandarlos, nunca bajar el suelo (ADR-034 §6).',
    lineas.join('\n'),
  );
  // Una sola aserción, y no es sobre el número: que la medida siga viendo la pantalla
  // entera. Si dejara de verla, este informe se quedaría en cero y parecería una buena
  // noticia.
  expect(lineas.length, 'no se midió ninguna pantalla entera').toBeGreaterThan(0);
});
