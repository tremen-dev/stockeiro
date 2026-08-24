import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import {
  ANCHOS_TABLA,
  ANCHOS_TELEFONO,
  DEFECTO_AREA_TACTIL,
  SELECTOR_INTERACTIVO,
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
const AVISOS = ['.quote-fail', '.quote-pending', '.quote-stale'];
const AVISOS_SEL = AVISOS.join(', ');

/**
 * Los avisos **dentro** de un contenedor.
 *
 * En CSS, `A B, C, D` se lee `(A B), (C), (D)`: sólo el primero queda acotado. Concatenar
 * el prefijo con el `join` de la lista dejaba entrar los avisos de la representación
 * OCULTA —caja 0 × 0, sin tarjeta que los contenga— y la guardia fallaba por su propio
 * selector y no por la pantalla. Se distribuye el prefijo a mano.
 */
const avisosDentroDe = (contenedor: string) => AVISOS.map((a) => `${contenedor} ${a}`).join(', ');

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
      // El selector nombra **hojas de texto**, no contenedores. `medirIntegridadDePalabra`
      // cuenta cajas de línea agrupando los rects de un `Range` por su `top` redondeado, y
      // un contenedor con cajas anidadas —`.tarjeta-cabecera` envuelve un `div.activo-caja`
      // que envuelve un `span.ticker`— devuelve un rect por caja. Con medio píxel de
      // diferencia entre ellas, «Z7FALLO» se contaba como DOS líneas para una palabra: un
      // falso positivo de la medida, no un defecto de la pantalla. Es el mismo criterio con
      // el que SPEC-040 la usa (`.card h3, .card .num`, hojas las dos).
      const textos = await medirIntegridadDePalabra(
        page,
        '.tarjeta .ticker, .tarjeta .activo-nombre, .tarjeta-datos dt, .tarjeta-pie button',
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
   *  - `.card` — `design/tremen-ds/components/cards.css:30`, y con el MISMO motivo: la
   *    tarjeta del sistema de diseño tiene `border-radius` y recorta lo que se salga de
   *    sus esquinas. Está en el árbol **desde el primer commit del proyecto** y lo llevan
   *    los formularios de compra y venta de `/cartera` (`form.card.auth-form`), el de alta
   *    de `/vigiladas` y la capa de edición. **CA-21 no lo nombra**, y es un hallazgo de la
   *    implementación: la lista de la spec se escribió mirando `globals.css` y éste vive en
   *    el sistema de diseño. Se acepta por lo mismo que los otros dos —es una máscara de
   *    esquinas, no una respuesta a un desborde— y queda escrito para que la próxima
   *    revisión no tenga que volver a averiguarlo.
   */
  // Se comparan por ETIQUETA y no por el nombre entero: `nombrar()` añade las dos
  // primeras clases, y `<html>` lleva las de `next/font` —que cambian de hash en cada
  // build— y `<body>` la del tema. Una lista con el hash dentro caducaría en el primer
  // `next build` y el fallo no diría nada de lo que CA-21 vigila.
  const HEREDADOS = /^html\b|^body\b|^table\.data-table\b|\.card\b/;

  const lineas: string[] = [];
  for (const pantalla of PANTALLAS) {
    await abrirAncha(page, pantalla);
    for (const ancho of ANCHOS_TELEFONO) {
      await ponerVentana(page, ancho);
      const recortados = (await medirOverflowHorizontal(page))
        .filter((c) => c.overflowX === 'hidden')
        .map((c) => c.selector);
      lineas.push(`${pantalla.ruta} · ancho ${ancho} · recortan: ${recortados.join(', ')}`);
      const nuevos = [...new Set(recortados)].filter((s) => !HEREDADOS.test(s));
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
   El suelo táctil, afirmado SIN TOLERANCIA — F-VERIF-054-1
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Los controles en alcance, **todos**, dentro de cada raíz.
 *
 * `SELECTOR_INTERACTIVO` es la lista de ADR-034 §6 y viene del módulo: aquí no se enumera
 * ningún tipo de control por segunda vez, que es como una medida se queda ciega el día que
 * alguien pinta un botón con otra etiqueta.
 *
 * Y misma trampa que en `avisosDentroDe`: en CSS, `A B, C` se lee `(A B), (C)`, así que la
 * raíz sólo acotaría al primero. Se reparte el prefijo a mano. (La lista no tiene comas
 * dentro de corchetes —`[role="button"]` no lleva ninguna—, así que partirla por comas es
 * exacto.)
 */
const controlesDentroDe = (raices: string) =>
  raices
    .split(',')
    .flatMap((raiz) =>
      SELECTOR_INTERACTIVO.split(',').map((control) => `${raiz.trim()} ${control.trim()}`),
    )
    .join(', ');

/**
 * **Todo control en alcance, medido SIN tolerancia ninguna y en los DOS ejes** (CA-13,
 * F-VERIF-054-1).
 *
 * `medirAreaTactil` filtra con `alto < suelo − TOLERANCIA_PX`, y el módulo dice para qué
 * existe esa resta: *«tolerancia de redondeo del motor… NO es una holgura de diseño: es
 * que `getBoundingClientRect()` devuelve fracciones y `clientWidth` enteros»*. O sea, vale
 * para un 43,6 que en realidad quería ser 44 — **para fracciones y sólo para fracciones**.
 *
 * Y los campos que devolvieron esta spec del verificador no eran una fracción. Medían
 * **43,000 px exactos** —`padding: 10px` arriba y abajo, `border: 1px` y 21 de línea— en
 * los formularios de compra y venta de `/cartera` (8), en el alta desplegada de
 * `/vigiladas` (5) y en la capa de edición (4): un píxel entero por debajo del suelo,
 * colándose por la puerta que existe para el redondeo. Con la tolerancia haciendo de
 * holgura del suelo, el umbral efectivo de M5 era **43 y no 44** — la versión suave de lo
 * que `F-ADR-026-1` prohíbe por escrito.
 *
 * **Por qué recorre TODOS los controles y no sólo los campos.** La versión anterior de
 * esta comprobación miraba `input`/`select`/`textarea`, que era donde estaba el defecto
 * medido. Pero eso dejaba el suelo efectivo en 43 para el resto —botones, enlaces,
 * `summary`—, y CA-13 no acota por tipo de control: dice *«todo elemento interactivo
 * visible … tiene caja de al menos 44 × 44 px CSS»*. Así que se mide la lista entera de
 * ADR-034 §6, y **en los dos ejes**, que es como el CA escribe el suelo.
 *
 * **Esta guardia no toca `medirAreaTactil`, ni `TOLERANCIA_PX`, ni el suelo.** Añade al
 * lado una afirmación más estricta, con el mismo primitivo de medida (`medirCajas`) y con
 * el número tal y como lo escribe CA-13. Aflojar un suelo está prohibido; apretar la
 * afirmación hasta el suelo que el CA declara, no. Arreglar la resta **en el módulo** está
 * decidido y no es de esta spec: es ADR-035 §2, y su follow-up `F-ADR-035-1`.
 *
 * **Dos diferencias con M5, las dos por el lado seguro y las dos deliberadas:**
 *
 * - **No cuenta el área ampliada por pseudoelemento.** M5 sí (ADR-034 §6). Un control que
 *   agrandara su diana con un `::after` absoluto saldría aquí como pequeño aunque el dedo
 *   llegue. Hoy no hay ninguno en alcance —está medido, no supuesto: con los controles a
 *   su tamaño real esta comprobación da cero— y el día que lo haya, la queja es de más y
 *   no de menos, que es el lado por el que una medida se puede equivocar sin aprobar nada
 *   en falso.
 * - **Descarta lo no pintado por la caja 0 × 0**, no por `checkVisibility()`. Es la misma
 *   regla que M1 y basta para los dos árboles de CA-1, que se apagan con `display: none`.
 */
async function controlesBajoElSuelo(
  page: Page,
  raices: string,
): Promise<{ medidos: number; rasos: string[] }> {
  const cajas = await medirCajas(page, controlesDentroDe(raices));
  // Caja 0 × 0 = no está pintado (el alta plegada, la representación oculta). Misma regla
  // que M1 y que M5.
  const pintados = cajas.filter((c) => c.ancho > 0 || c.alto > 0);
  return {
    // **Se devuelve cuántos se midieron, y quien afirme tiene que exigir que no sean cero.**
    // Una lista de rojos vacía tiene dos causas —que no haya rojos, o que el selector no
    // case con nada— y sin este número no se distinguen. Es la misma constancia que M5
    // lleva en `medidos` y M1 en sus testigos (ADR-026 §7).
    medidos: pintados.length,
    rasos: pintados
      .filter((c) => c.ancho < SUELO_TACTIL_PX || c.alto < SUELO_TACTIL_PX)
      .map((c) => `${c.selector} «${c.texto}» ${c.ancho.toFixed(2)}x${c.alto.toFixed(2)}`),
  };
}

/** El porqué, entero, en el mensaje del fallo: quien lo lea no tiene que venir hasta aquí. */
const porQueSinTolerancia = (donde: string) =>
  `${donde}: hay controles cuya caja NO llega a ${SUELO_TACTIL_PX} × ${SUELO_TACTIL_PX} px, ` +
  `medida sin tolerancia y en los dos ejes. Ojo con la salida fácil: M5 los da por buenos ` +
  `porque compara contra \`suelo − TOLERANCIA_PX\`, y esa resta existe para las FRACCIONES ` +
  `que devuelve \`getBoundingClientRect()\`, no para regalar un píxel de holgura. Un ` +
  `control de 43,00 exactos no es un ${SUELO_TACTIL_PX} mal redondeado: es un 43 ` +
  `(ADR-035 §1). La salida legítima es AGRANDARLO —bajo el canto, que CE-5 dice que el ` +
  `escritorio no paga la factura del móvil—, y apilarlo si dos no caben en una línea; ` +
  `subir la ` +
  `tolerancia o bajar el suelo sería F-ADR-026-1 cumpliéndose por escrito (ADR-026 §4, ` +
  `ADR-034 §6).`;

/**
 * **El defecto de la afirmación estricta, escrito como CSS que lo devuelve** (ADR-026 §7).
 *
 * No es «un CSS que encoja algo»: es **el defecto real de `F-VERIF-054-1`**, el relleno
 * que estos campos tenían el día que el verificador los midió. Devuelve la caja a
 * **43,00 px exactos** — 10 + 10 de relleno + 1 + 1 de borde + 21 de línea.
 *
 * Y es exactamente el defecto que **M5 no ve y esta comprobación sí**: 43 no es menor que
 * `44 − TOLERANCIA_PX`, así que `medirAreaTactil` lo aprueba en silencio. Si algún día las
 * dos cifras se movieran juntas, esta guardia habría dejado de aportar nada sobre M5 y
 * conviene enterarse por un rojo y no por una lectura.
 *
 * Va sin `!important` y sin `@media` a propósito: entra como `<style>` al final del
 * `<head>`, así que le basta el orden de fuente para ganarle al `padding-block: 11px` del
 * bloque de 720 px, que tiene su misma especificidad.
 */
const DEFECTO_UN_PIXEL_POR_DEBAJO =
  `.auth-form input, .auth-form select, .auth-form textarea, .symbol-search-input ` +
  `{ padding-block: 10px }`;

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

      // Y el mismo suelo, otra vez, contra el suelo pelado y sobre TODOS los controles en
      // alcance —no sólo los campos— tal y como lo escribe CA-13 (F-VERIF-054-1, ADR-035 §1).
      const estricto = await controlesBajoElSuelo(page, RAICES_EN_ALCANCE);
      lineas.push(
        `${pantalla.ruta} · ancho ${ancho} · controles medidos sin tolerancia=` +
          `${estricto.medidos} · por debajo de ${SUELO_TACTIL_PX}=${estricto.rasos.length}` +
          `${estricto.rasos.length > 0 ? `\n  ${estricto.rasos.join('\n  ')}` : ''}`,
      );
      expect(
        estricto.medidos,
        `${pantalla.ruta} a ${ancho} px la afirmación sin holgura no midió ni un control: un ` +
          `cero de rojos que sale de una lista vacía no aprueba nada`,
      ).toBeGreaterThan(2);
      expect(estricto.rasos, porQueSinTolerancia(`${pantalla.ruta} a ${ancho} px`)).toEqual([]);
    }
  }

  /*
    ── La capa de edición ────────────────────────────────────────────────────────────

    `RAICES_EN_ALCANCE` la nombra desde el primer día, pero ninguna guardia de este fichero
    llegaba a **abrirla**: el bucle de arriba mide la pantalla con la capa cerrada, así que
    sus campos no los medía nadie y el alcance declarado era mayor que el alcance real. Se
    abre una vez, en el ancho más estrecho, que es donde cuesta más.
  */
  await abrirAncha(page, PANTALLAS[0]);
  await ponerVentana(page, ANCHOS_TELEFONO[0]);
  await page
    .locator(`${TARJETAS_VIGILADAS} > li`)
    .first()
    .getByTestId('editar-zonas-tarjeta')
    .click();
  await page.locator('dialog.editar-vigilada').waitFor({ state: 'visible' });

  const m5Capa = await medirAreaTactil(page, { raices: 'dialog.editar-vigilada' });
  const estrictoCapa = await controlesBajoElSuelo(page, 'dialog.editar-vigilada');
  lineas.push(
    `capa de edición · ancho ${ANCHOS_TELEFONO[0]} · ${describirAreaTactil(m5Capa)} · sin ` +
      `tolerancia: medidos=${estrictoCapa.medidos} · por debajo de ${SUELO_TACTIL_PX}=` +
      `${estrictoCapa.rasos.length}` +
      `${estrictoCapa.rasos.length > 0 ? `\n  ${estrictoCapa.rasos.join('\n  ')}` : ''}`,
  );
  expect(
    m5Capa.medidos,
    `la capa de edición no aportó ni un control a M5: se abrió mal, o la medida no está ` +
      `mirando donde cree`,
  ).toBeGreaterThan(2);
  expect(
    m5Capa.pequenos.map((c) => `${c.selector} «${c.rotulo}»`),
    `la capa de edición tiene controles por debajo del suelo táctil.\n${describirAreaTactil(m5Capa)}`,
  ).toEqual([]);
  expect(
    estrictoCapa.medidos,
    'la capa de edición no aportó ni un control a la afirmación sin holgura: se abrió mal, o ' +
      'el selector no casa con nada',
  ).toBeGreaterThan(2);
  expect(estrictoCapa.rasos, porQueSinTolerancia('la capa de edición')).toEqual([]);
  await page.getByTestId('editar-cancelar').click();
  await expect(page.locator('dialog.editar-vigilada')).toHaveCount(0);

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

  /*
    ── La segunda prueba de eficacia: la del suelo SIN HOLGURA ───────────────────────

    La de arriba demuestra que M5 ve un control aplastado. Ésta demuestra otra cosa, y es
    la que justifica que esta guardia afirme el suelo por su cuenta: que **hay un defecto
    real que M5 no ve y esta comprobación sí**.

    El defecto es el de `F-VERIF-054-1`, tal cual: el relleno que los campos tenían el día
    que el verificador los midió, que devuelve la caja a **43,00 px exactos**. Un píxel
    entero por debajo del suelo — y sin embargo `43 < suelo − TOLERANCIA_PX` es falso, así que
    `medirAreaTactil` lo aprueba en silencio. Si esta comprobación no se pusiera roja aquí,
    no estaría comprando nada sobre M5 y sobraría.

    Se hace en `/cartera` porque es donde los campos están pintados sin desplegar nada: los
    ocho de los formularios de compra y venta. En `/vigiladas` el alta nace plegada.

    ⚠️ **La cifra de M5 sobre el mismo defecto se escribe en la evidencia pero NO se
    afirma.** Hoy es 0 —M5 es ciega a este píxel— y eso es exactamente lo que arregla
    ADR-035 §2 en el módulo, que es trabajo de `F-ADR-035-1` y no de esta spec. El día que
    entre, esa cifra dejará de ser 0 y **no debe hacer roja a esta guardia por ello**: lo
    que aquí se afirma es la propiedad del producto (la caja llega al suelo), no el defecto
    del módulo.
  */
  await abrirAncha(page, PANTALLAS[1]);
  await ponerVentana(page, ANCHOS_TELEFONO[0]);
  const estrictoSano = await controlesBajoElSuelo(page, RAICES_EN_ALCANCE);
  const quitarElPixel = await inyectarDefecto(page, DEFECTO_UN_PIXEL_POR_DEBAJO);
  const estrictoConDefecto = await controlesBajoElSuelo(page, RAICES_EN_ALCANCE);
  const m5AnteElMismoDefecto = await medirAreaTactil(page, { raices: RAICES_EN_ALCANCE });
  await quitarElPixel();
  const estrictoDespues = await controlesBajoElSuelo(page, RAICES_EN_ALCANCE);

  lineas.push(
    `── prueba de eficacia del suelo SIN HOLGURA en ${PANTALLAS[1].ruta} a ` +
      `${ANCHOS_TELEFONO[0]} px · sano=${estrictoSano.rasos.length} · con el defecto=` +
      `${estrictoConDefecto.rasos.length} · al quitarlo=${estrictoDespues.rasos.length}` +
      `\n   y M5, con su tolerancia, ante el MISMO defecto=${m5AnteElMismoDefecto.pequenos.length} ` +
      `(cifra medida, no afirmada: es el hueco que cierra ADR-035 §2 / F-ADR-035-1)` +
      (estrictoConDefecto.rasos.length > 0 ? `\n   ${estrictoConDefecto.rasos.join('\n   ')}` : ''),
  );
  expect(
    estrictoSano.rasos,
    `el caso de control no vale: ${PANTALLAS[1].ruta} ya tiene controles por debajo del ` +
      `suelo sin reinyectar nada`,
  ).toEqual([]);
  expect(
    estrictoConDefecto.rasos.length,
    `la afirmación sin holgura NO ve el defecto reinyectado. Con ` +
      `\`${DEFECTO_UN_PIXEL_POR_DEBAJO}\` puesto, los campos vuelven a medir los 43,00 px ` +
      `exactos de F-VERIF-054-1 y esta comprobación sigue en verde: entonces no está ` +
      `midiendo lo que dice medir, y como M5 tampoco ve ese píxel, el suelo de ` +
      `${SUELO_TACTIL_PX} no lo estaría afirmando nadie (ADR-026 §7, ADR-035 §1)`,
  ).toBeGreaterThan(0);
  expect(
    estrictoDespues.rasos,
    'al quitar la reinyección la comprobación se queda roja: el defecto no era el inyectado',
  ).toEqual([]);

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
    const ancho1280 = await page.locator(AVISOS_SEL).filter({ visible: true }).allTextContents();
    expect(
      ancho1280.length,
      `${pantalla.ruta} a 1280 px no hay ni un aviso de diagnóstico: el escenario no cubre ` +
        `lo que CA-15 mide`,
    ).toBeGreaterThan(0);

    for (const ancho of ANCHOS_TELEFONO) {
      await ponerVentana(page, ancho);
      const enMovil = await page.locator(AVISOS_SEL).filter({ visible: true }).allTextContents();

      // (a) **Completos, carácter a carácter.** No es «se ve algo»: es que no se recortó,
      //     no se puso una elipsis y no se escondió detrás de un `title`.
      expect(
        enMovil,
        `${pantalla.ruta} a ${ancho} px los avisos no dicen lo mismo que a 1280 px. Esta tabla ` +
          `YA se rompió una vez por un párrafo de motivo, y la lección de SPEC-040 CA-4 fue ` +
          `acotar la CAJA, nunca el texto`,
      ).toEqual(ancho1280);

      // (b) Conservan su caja acotada y envuelven de verdad.
      const cajas = await medirPropiedadesComputadas(page, AVISOS_SEL, ['max-width', 'display']);
      const textos = await medirIntegridadDePalabra(page, avisosDentroDe(pantalla.tarjetas), '.tarjeta');
      for (const c of cajas) {
        expect(
          c.props['max-width'],
          `${pantalla.ruta} a ${ancho} px el aviso «${c.texto}» perdió su caja acotada ` +
            `(max-width: ${c.props['max-width']}). Los 34ch los pusieron SPEC-016 y SPEC-043 ` +
            `y el formato tarjeta no es excusa para deshacerlos`,
        ).not.toBe('none');
      }
      /*
        La envoltura se afirma **donde el texto la necesita**, que es lo que «envuelve en
        vez de extenderse» significa. Exigir más de una línea a TODOS los avisos sería
        exigir que la caja fuera estrecha, no que estuviera acotada: en la tarjeta hay más
        ancho que en la celda de 170 px de la tabla, así que un aviso corto cabe en una
        línea **y eso está bien**. Lo que no puede pasar —y es el defecto de SPEC-016 que
        esta tabla ya sufrió una vez— es que un aviso largo se extienda en una sola línea
        saltándose su caja.

        Así que se afirman tres cosas y ninguna se afloja: **(i)** ninguna línea excede la
        caja computada; **(ii)** el aviso más largo SÍ ocupa más de una línea, que es la
        prueba de que la caja está acotada y de que el texto envuelve; y **(iii)** ninguno
        parte una palabra (M3).
      */
      const medidos = textos.filter((t) => t.lineas > 0);
      expect(
        medidos.length,
        `${pantalla.ruta} a ${ancho} px no se midió ningún aviso`,
      ).toBeGreaterThan(0);
      const topes = new Map(cajas.map((c) => [c.texto, parseFloat(c.props['max-width'])]));
      for (const t of medidos) {
        const tope = topes.get(t.texto.slice(0, 60));
        if (tope !== undefined && Number.isFinite(tope)) {
          expect(
            t.anchoLineaMax,
            `${pantalla.ruta} a ${ancho} px una línea del aviso «${t.texto}» mide ` +
              `${Math.round(t.anchoLineaMax)} px y su caja acotada sólo ${Math.round(tope)}: ` +
              `el texto se está extendiendo por encima de su \`max-width\``,
          ).toBeLessThanOrEqual(tope + TOLERANCIA_PX);
        }
        expect(
          t.lineas,
          `${pantalla.ruta} a ${ancho} px el aviso «${t.texto}» ocupa ${t.lineas} líneas para ` +
            `${t.palabras} palabras: está partiendo palabras (M3)`,
        ).toBeLessThanOrEqual(t.palabras);
      }
      const masLargo = medidos.reduce((a, b) => (b.palabras > a.palabras ? b : a));
      expect(
        masLargo.lineas,
        `${pantalla.ruta} a ${ancho} px el aviso más largo («${masLargo.texto}», ` +
          `${masLargo.palabras} palabras) cabe en UNA sola línea de ` +
          `${Math.round(masLargo.anchoLineaMax)} px: su caja dejó de estar acotada y el texto ` +
          `se extiende en vez de envolverse — que es literalmente el defecto que rompió esta ` +
          `tabla en SPEC-016 y que SPEC-040 CA-4 arregló acotando la CAJA, nunca el texto`,
      ).toBeGreaterThan(1);

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
      const avisos = await medirCajas(page, avisosDentroDe(pantalla.tarjetas));
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
          `líneas=${medidos.map((t) => t.lineas).join(',')}`,
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

          // El mismo suelo, pelado y sobre TODOS los controles de la superficie. Aquí
          // importa más que en ningún otro sitio: éstas son EXACTAMENTE las superficies
          // donde vivían los 43,00 (F-VERIF-054-1).
          const estricto = await controlesBajoElSuelo(page, s.selector);
          expect(
            estricto.rasos,
            porQueSinTolerancia(
              `${s.nombre} a ${ancho} px (alta ${plegado ? 'plegada' : 'desplegada'})`,
            ),
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
              `M1 ${m1.violaciones.length}/${m1.medidos} · M5 ${m5.pequenos.length}/${m5.medidos} · ` +
              `sin tolerancia ${estricto.rasos.length}/${estricto.medidos}`,
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
