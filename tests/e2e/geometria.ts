import type { Locator, Page } from '@playwright/test';

/**
 * ADR-026 — La geometría de la interfaz se mide elemento a elemento, en ESTE módulo.
 *
 * ## Por qué existe este fichero
 *
 * El proyecto entregó cuatro guardias de geometría, una por spec, copiando cada una de
 * la anterior. La medida buena entró en SPEC-036 —recorrer los elementos y comprobar
 * `rect.right > innerWidth + 1`— y se **cayó en las dos copias siguientes**
 * (SPEC-037 y SPEC-039), que se quedaron sólo con
 * `document.scrollWidth - document.clientWidth`.
 *
 * Eso no es un descuido de nadie: es lo que hace el copiar-pegar. Y tuvo consecuencia
 * medible: con la suite en verde, el botón «Vigilar» de `/vigiladas` estaba **fuera de
 * la pantalla** a 390 px, porque `design/tremen-ds/responsive.css` declara
 * `html, body { overflow-x: hidden }` por debajo de 720 px y eso **recorta al hijo sin
 * mover `scrollWidth`**. La medida elegida era literalmente incapaz de ver el defecto.
 *
 * De ahí la regla operativa de ADR-026 §1, que hay que poder citar:
 *
 *   > Una guardia de geometría que derive el desborde horizontal únicamente de
 *   > `document.scrollWidth` está **mal escrita**.
 *
 * Este módulo es el domicilio de la medida. Cada guardia de spec importa de aquí y
 * añade **lo suyo**: sus rutas, sus umbrales, sus invariantes. Se unifica **cómo se
 * mide**; **no** se unifica qué afirma cada spec.
 *
 * ## Las tres medidas, y ninguna sustituye a otra (ADR-026 §1)
 *
 *  - **M1 — desborde por elemento** (`medirDesbordePorElemento`). La principal: es la
 *    que `overflow: hidden` **no puede enmascarar**.
 *  - **M2 — desborde de documento** (`medirDesbordeDeDocumento`). Sigue siendo útil
 *    —caza el tramo 721–800 px, donde no hay `hidden` que disimule— pero **nunca es
 *    la única**.
 *  - **M3 — integridad de palabra** (`medirIntegridadDePalabra`). Lo único que caza la
 *    «columna imposible»: el texto que se reparte DENTRO de su caja partiendo palabras
 *    («Ac / cio / ne / s»). No desborda nada, así que ni M1 ni M2 lo ven.
 *
 * Y las dos que el proyecto ya usaba y siguen vigentes, aquí para que dejen de estar
 * copiadas: el **hueco muerto** y el **eje declarado** (`medirBloques`).
 *
 * ## Sobre aflojar umbrales (F-ADR-026-1)
 *
 * Este módulo es un punto único de fallo con tentación de aflojar: una holgura
 * relajada aquí afecta a TODAS las guardias a la vez. Las holguras son **de cada
 * guardia** y se pasan por parámetro. Lo único global es `TOLERANCIA_PX`, que es
 * redondeo del motor y no holgura de diseño.
 */

/* ────────────────────────────────────────────────────────────────────────────
   Anchos de referencia — son del PROYECTO, no de cada spec (ADR-026 §3)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Los ocho anchos que mide el proyecto.
 *
 * Los cinco de SPEC-035 (390, 640, 700, 760, 1280), más **730 y 800** —porque
 * `V-SPEC-039-3` vive exactamente en el hueco que dejaban 700 y 760: un defecto que
 * sólo existe entre dos anchos medidos es un defecto que nadie mide—, más **360**, el
 * suelo que fijó el humano en el gate del 2026-08-20 (Android pequeño, iPhone SE).
 *
 * **El suelo declarado es 360 px**, y bajarlo no es un parámetro de test: a 320 px la
 * tabla y el formulario de alta no se ajustan, se rediseñan, y eso es producto.
 */
export const ANCHOS = [360, 390, 640, 700, 730, 760, 800, 1280] as const;

/** Altos de ventana declarados por SPEC-040: 800 a 360, 844 a 390, 900 en el resto. */
const ALTOS: Record<number, number> = { 360: 800, 390: 844 };
const ALTO_POR_DEFECTO = 900;

export const altoPara = (ancho: number): number => ALTOS[ancho] ?? ALTO_POR_DEFECTO;

/**
 * Tolerancia de redondeo del motor, en px. NO es una holgura de diseño: es que
 * `getBoundingClientRect()` devuelve fracciones y `clientWidth` enteros. Subirla sería
 * apagar la medida (ADR-026, alternativa rechazada del «umbral de holgura global»).
 */
export const TOLERANCIA_PX = 1;

/**
 * Las raíces que M1 recorre: **la app entera visible**, sin el `<html>`/`<body>`.
 *
 * ## Por qué `body > *` y no `nav, main, footer` (V-SPEC-040-3)
 *
 * CA-3 de SPEC-040 pedía literalmente `nav`, `main` y `footer`, y eso dejaba fuera el
 * **chrome del layout**: el layout raíz monta `<div class="frame">` alrededor de todo
 * (`src/app/layout.tsx`), así que ni él ni un hermano de `main` entraban en la medida.
 * Medido por el verificador: un `<div>` de **900 px** colgado de `.frame` a 360 px daba
 * **0** violaciones en M1 y `document.scrollWidth` **360** —lo tapa el
 * `overflow-x: hidden` del sistema de diseño—. Es decir, **por debajo de 720 px un
 * desborde del chrome era invisible para las dos medidas a la vez**, que es exactamente
 * la situación que `V-SPEC-039-6` dejó como lección.
 *
 * `body > *` cierra el hueco entero —cubre `.frame`, cualquier hermano suyo y cualquier
 * capa montada al nivel de `body`, que es donde React monta los portales— y su coste es
 * **el mínimo posible**: `.frame` ya contiene `nav`/`main`/`footer`, así que lo único que
 * se añade es lo que colgaba del chrome y nadie recorría.
 *
 * **Coste medido**, en las diez superficies del conjunto a los ocho anchos:
 *
 *  - **3400 → 3509 elementos** por ejecución (**+3,2 %**). De los +109, **+79 son
 *    `.frame`** —un elemento por superficie y ancho— y **+30** son las celdas de la
 *    tabla de `/vigiladas` a 1280 px, que ahora se miden porque a ese ancho la tabla cabe
 *    y su contenedor ya no está desplazado (la otra mitad de `V-SPEC-040-2`). Eso es
 *    cobertura ganada, no ruido.
 *  - `geometria-rutas.spec.ts`: **35,7 s → 33,4 s** (8 tests). La diferencia está dentro
 *    del ruido de dos ejecuciones; ensanchar la raíz **no** cuesta tiempo medible.
 *  - **Cero falsos positivos y cero exclusiones nuevas**: `.frame` es
 *    `max-width: 1440px; margin: 0 auto`, así que su caja es la de la ventana.
 *
 * `body` y `html` se quedan fuera a propósito: su caja es el lienzo, no maquetación, y
 * el desborde del documento ya lo mide M2.
 */
export const RAICES = 'body > *';

/* ────────────────────────────────────────────────────────────────────────────
   Exclusiones de M1 — lista escrita, corta y comentada (CA-3, F-ADR-026-2)
   ──────────────────────────────────────────────────────────────────────────── */

export interface Exclusion {
  selector: string;
  motivo: string;
}

/**
 * Elementos que M1 NO mide, con su motivo por línea.
 *
 * ⚠️ **Esta lista puede crecer hasta vaciar la medida** (F-ADR-026-2). Sólo entra aquí
 * lo que está **fuera de flujo** (`position: absolute|fixed`) y **sólo existe
 * desplegado bajo demanda**: una capa que el usuario abre y cierra no es maquetación de
 * la página. Nada de tolerancias disfrazadas de exclusión, y nada de meter aquí un
 * elemento de flujo porque no cabe — para eso están las dos salidas legítimas de
 * ADR-026 §4: que quepa, o que el desplazamiento viva en su propio contenedor.
 *
 * Ampliarla es una decisión que se ve en la revisión. Ese es el punto.
 */
export const EXCLUSIONES_M1: readonly Exclusion[] = [
  {
    selector: '.symbol-results',
    motivo:
      'Desplegable de candidatos del buscador de símbolos (SPEC-008). Es ' +
      '`position: absolute` y sólo existe mientras se teclea; se ancla a `left: 0; ' +
      'right: 0` de su campo, así que su caja no es maquetación de la página. Su ' +
      'legibilidad la protege CA-2 de SPEC-040, que ELIGE un candidato a 360 px.',
  },
];

const selectorDeExclusiones = (exclusiones: readonly Exclusion[]) =>
  exclusiones.map((e) => e.selector).join(', ');

/* ────────────────────────────────────────────────────────────────────────────
   Ventana
   ──────────────────────────────────────────────────────────────────────────── */

/** Pone la ventana en uno de los anchos de referencia, con el alto que le toca. */
export async function ponerVentana(page: Page, ancho: number): Promise<void> {
  await page.setViewportSize({ width: ancho, height: altoPara(ancho) });
}

/* ────────────────────────────────────────────────────────────────────────────
   M1 — desborde por elemento
   ──────────────────────────────────────────────────────────────────────────── */

export interface Desbordado {
  /** `tag.clase[data-testid]`, suficiente para ir al sitio sin buscar. */
  selector: string;
  derecha: number;
  izquierda: number;
  ancho: number;
}

export interface MedidaM1 {
  ventana: number;
  /** El elemento que más se sale por la derecha, o `null` si ninguno se sale. */
  peor: Desbordado | null;
  /** Todos los que violan, ordenados de peor a mejor. */
  violaciones: Desbordado[];
  /** Cuántos elementos se llegaron a medir. Si es 0, la medida no midió nada. */
  medidos: number;
  /**
   * De qué elementos se tomó medida, entre los que casan el selector `testigos`
   * (SPEC-046 CA-7b, ADR-030 §5).
   *
   * M1 devuelve por defecto **cuántos** elementos midió, y eso basta para saber que la
   * medida no se quedó a cero. No basta para saber que midió **el elemento que a esta
   * guardia le importa**: una capa que se cuela por la puerta de atrás de
   * `EXCLUSIONES_M1`, o que queda bajo la exención de contenedor desplazable, deja la
   * cifra global intacta y desaparece del conjunto sin que nada se ponga rojo.
   *
   * Por eso quien mide puede pedir **testigos**: los nombres de los elementos medidos
   * que casan un selector suyo. Si la lista vuelve vacía, la medida no midió lo que se
   * creía y su «cero violaciones» no aprueba nada. Se pide por selector —no se devuelve
   * el conjunto entero— porque son miles de elementos por ejecución.
   */
  testigos: string[];
}

/**
 * **M1 — la medida principal.** Recorre cada elemento visible bajo `body > *` —es decir,
 * el chrome del layout y todo lo que cuelga de él, raíces incluidas— y comprueba que su
 * caja cabe en la ventana: `right <= innerWidth + 1` y `left >= -1`.
 *
 * Es la única de las tres que `overflow: hidden` no puede enmascarar: el recorte
 * cambia lo que se PINTA, no la caja que el elemento ocupa.
 *
 * ## Lo que hay dentro de un contenedor de desplazamiento DECLARADO
 *
 * ADR-026 §4 admite exactamente **dos** salidas ante un desborde: que quepa, o que el
 * desplazamiento viva **en un contenedor propio declarado** (`overflow-x: auto|scroll`
 * a todos los anchos). Una tabla de nueve columnas dentro de su `.table-scroll` es la
 * segunda salida funcionando, no un defecto: lo que tiene que caber es **el
 * contenedor**, y eso M1 sí lo mide.
 *
 * Por eso M1 no mide los descendientes de un contenedor con `overflow-x` **`auto` o
 * `scroll`** **que además esté desplazado de verdad a lo ancho**
 * (`scrollWidth > clientWidth`). Y **`hidden` NO está en esa lista**, a propósito:
 * recortar es justo lo que hace `html, body { overflow-x: hidden }` del sistema de
 * diseño y justo lo que dejó a la suite en verde con el botón «Vigilar» fuera de la
 * pantalla. Meter `hidden` aquí sería reintroducir la ceguera que este módulo existe
 * para acabar.
 *
 * La condición de que esté **desplazado de verdad** tampoco es cosmética: sin ella
 * bastaba un `overflow-y: auto` en cualquier ancestro para apagar la medida en todo su
 * subárbol, porque el navegador computa `overflow-x` a `auto` cuando el otro eje deja de
 * ser `visible` (`V-SPEC-040-2`; el detalle, en el cuerpo de la función).
 */
export async function medirDesbordePorElemento(
  page: Page,
  opciones: { raices?: string; exclusiones?: readonly Exclusion[]; testigos?: string } = {},
): Promise<MedidaM1> {
  const raices = opciones.raices ?? RAICES;
  const exclusiones = selectorDeExclusiones(opciones.exclusiones ?? EXCLUSIONES_M1);
  const testigos = opciones.testigos ?? null;

  return page.evaluate(
    ({ raices, exclusiones, testigos, tolerancia }) => {
      const ventana = document.documentElement.clientWidth;
      const violaciones: {
        selector: string;
        derecha: number;
        izquierda: number;
        ancho: number;
      }[] = [];
      let medidos = 0;
      const vistosTestigo: string[] = [];

      const nombrar = (el: Element) => {
        const clases = [...el.classList].slice(0, 2).join('.');
        const testid = el.getAttribute('data-testid');
        return (
          el.tagName.toLowerCase() +
          (clases ? `.${clases}` : '') +
          (testid ? `[data-testid="${testid}"]` : '')
        );
      };

      /**
       * ¿Su desborde lo absorbe un contenedor de desplazamiento DECLARADO por encima?
       *
       * Hacen falta LAS DOS condiciones, y la segunda no es un refinamiento (V-SPEC-040-2):
       *
       *  1. `overflow-x` computado `auto` o `scroll`. `hidden` NO (ADR-026 §4 y el
       *     comentario del jsdoc de M1).
       *  2. Que el contenedor sea desplazable **de verdad** a lo ancho:
       *     `scrollWidth > clientWidth`.
       *
       * Sin la (2), la exención se dispara sola. En CSS no existe el par
       * visible/no-visible: si `overflow-y` es `auto|scroll` y `overflow-x` es `visible`,
       * el navegador **computa `overflow-x` a `auto`**. Así que cualquier componente que
       * declarase un área de desplazamiento VERTICAL apagaba la medida en todo su
       * subárbol. Medido a 360 px con el defecto (a) puesto: M1 pasaba de 13 violaciones
       * a 0 —y de 44 a 23 elementos medidos— sólo con añadir
       * `main.page { overflow-y: auto }`.
       */
      const dentroDeContenedorDesplazable = (el: Element, tope: Element) => {
        for (let p = el.parentElement; p && p !== tope.parentElement; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          const declarado = ox === 'auto' || ox === 'scroll';
          if (declarado && p.scrollWidth > p.clientWidth) return true;
        }
        return false;
      };

      const vistos = new Set<Element>();
      for (const raiz of document.querySelectorAll(raices)) {
        for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
          if (vistos.has(el)) continue;
          vistos.add(el);
          // Fuera de la medida por decisión escrita, no por comodidad.
          if (exclusiones && el.closest(exclusiones)) continue;
          if (el !== raiz && dentroDeContenedorDesplazable(el, raiz)) continue;

          const r = el.getBoundingClientRect();
          // Invisible: ni ocupa ni se ve. No es maquetación.
          if (r.width === 0 && r.height === 0) continue;
          medidos += 1;
          // SPEC-046 CA-7b: constancia de que ESTE elemento entró en la medida.
          if (testigos && el.matches(testigos)) vistosTestigo.push(nombrar(el));

          if (r.right > ventana + tolerancia || r.left < -tolerancia) {
            violaciones.push({
              selector: nombrar(el),
              derecha: r.right,
              izquierda: r.left,
              ancho: r.width,
            });
          }
        }
      }

      violaciones.sort((a, b) => b.derecha - a.derecha);
      return {
        ventana,
        peor: violaciones[0] ?? null,
        violaciones,
        medidos,
        testigos: vistosTestigo,
      };
    },
    { raices, exclusiones, testigos, tolerancia: TOLERANCIA_PX },
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   M2 — desborde de documento
   ──────────────────────────────────────────────────────────────────────────── */

export interface MedidaM2 {
  /**
   * Lo que el documento ocupa a lo ancho. Se llama así, y no `scrollWidth`, para que el
   * identificador crudo **no aparezca fuera de este módulo**: eso es lo que hace
   * comprobable de forma binaria la regla de ADR-026 §1 (ver
   * `tests/geometria-guardias.test.ts`).
   */
  documento: number;
  /** Lo que cabe en la ventana. */
  ventana: number;
  /** `documento - ventana`. Nunca es la ÚNICA medida de una guardia. */
  desborde: number;
}

/**
 * **M2 — desborde de documento.** La única lectura de `document.scrollWidth` con fines
 * de desborde horizontal que hay en el árbol de tests, y está aquí a propósito
 * (SPEC-040 CA-6): fuera de este módulo no debe aparecer.
 *
 * Sigue siendo útil —caza el tramo 721–800 px de `V-SPEC-039-3`, donde el
 * `overflow-x: hidden` del sistema **no** está puesto— pero por sí sola es ciega a
 * cualquier recorte por debajo de 720.
 */
export async function medirDesbordeDeDocumento(page: Page): Promise<MedidaM2> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      documento: doc.scrollWidth,
      ventana: doc.clientWidth,
      desborde: doc.scrollWidth - doc.clientWidth,
    };
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   M3 — integridad de palabra
   ──────────────────────────────────────────────────────────────────────────── */

export interface MedidaTexto {
  selector: string;
  texto: string;
  palabras: number;
  /** Cajas de línea distintas: `Range.getClientRects()` agrupadas por su `top`. */
  lineas: number;
  /** Cuántos rects devolvió el rango en crudo, antes de agrupar. Informativo. */
  rects: number;
  /** El ancho de la caja de línea más ancha. */
  anchoLineaMax: number;
  /** Ancho de contenido del contenedor de referencia (sin su `padding`). */
  anchoContenedor: number;
}

/**
 * **M3 — integridad de palabra.** Para cada elemento que casa `selector`, cuenta las
 * cajas de línea que ocupa su texto y las compara con su número de palabras.
 *
 * Es lo único que caza el modo de fallo «columna imposible»: una tarjeta de 110 px
 * donde «Acciones» se reparte en «Ac / cio / ne / s». No hay desborde de documento ni
 * de elemento —el texto cabe, roto— así que M1 y M2 no lo ven.
 *
 * Detalle de implementación, escrito porque importa: `Range.getClientRects()` devuelve
 * un rect **por fragmento**, no por línea, así que un título con dos nodos de texto
 * («Avisos» + «(3 sin leer)») da dos rects en la MISMA línea. Se agrupan por su `top`
 * redondeado para contar **líneas de verdad**. Se devuelve también el crudo (`rects`)
 * para que quien lea el fallo no tenga que fiarse.
 *
 * @param selector   qué textos medir (p. ej. `.card h3, .card .num`).
 * @param contenedor ancestro contra cuyo ancho de contenido se comparan las líneas.
 */
export async function medirIntegridadDePalabra(
  page: Page,
  selector: string,
  contenedor: string,
): Promise<MedidaTexto[]> {
  return page.evaluate(
    ({ selector, contenedor }) => {
      const nombrar = (el: Element) => {
        const clases = [...el.classList].slice(0, 2).join('.');
        return el.tagName.toLowerCase() + (clases ? `.${clases}` : '');
      };

      return [...document.querySelectorAll(selector)].map((el) => {
        const rango = document.createRange();
        rango.selectNodeContents(el);
        const rects = [...rango.getClientRects()].filter((r) => r.width > 0 && r.height > 0);

        // Una «línea» es un `top` distinto. Dos fragmentos de texto seguidos comparten
        // línea aunque `getClientRects()` los devuelva por separado.
        const tops = new Set(rects.map((r) => Math.round(r.top)));

        const texto = (el.textContent ?? '').trim();
        const palabras = texto === '' ? 0 : texto.split(/\s+/).length;

        const caja = el.closest(contenedor) ?? el;
        const estilo = getComputedStyle(caja);
        const anchoContenedor =
          caja.getBoundingClientRect().width -
          parseFloat(estilo.paddingLeft || '0') -
          parseFloat(estilo.paddingRight || '0') -
          parseFloat(estilo.borderLeftWidth || '0') -
          parseFloat(estilo.borderRightWidth || '0');

        return {
          selector: nombrar(el),
          texto,
          palabras,
          lineas: tops.size,
          rects: rects.length,
          anchoLineaMax: rects.length === 0 ? 0 : Math.max(...rects.map((r) => r.width)),
          anchoContenedor,
        };
      });
    },
    { selector, contenedor },
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   M4 — la respuesta al gesto cae dentro de la ventana (ADR-030 §3)
   ──────────────────────────────────────────────────────────────────────────── */

export interface Contencion {
  /** `tag.clase[data-testid]` de la superficie medida. */
  selector: string;
  top: number;
  bottom: number;
  alto: number;
  ventanaAlto: number;
  /** Cuántos px de la superficie quedan POR DEBAJO del pliegue. **La cifra del defecto.** */
  porDebajoDelPliegue: number;
  /** Cuántos px quedan por encima del borde superior de la ventana. */
  porEncimaDelBorde: number;
  /** `true` si la superficie entera cabe entre el borde superior y el pliegue. */
  dentroDeLaVentana: boolean;
}

/**
 * **La mitad de M4 que no depende del gesto**: ¿esta superficie cabe entre el borde
 * superior de la ventana y el pliegue, tal y como está la página ahora mismo?
 *
 * Se expone aparte porque hay un caso en el que hace falta sola: cuando el gesto **sí**
 * desplazó el documento, M4 ya reporta violación por esa mitad, pero la **cifra que hay
 * que enseñar** —a cuántos píxeles por debajo del pliegue se pintó la superficie— sólo
 * aparece si se devuelve la página a donde estaba y se vuelve a mirar. Es exactamente lo
 * que necesita la prueba de eficacia de SPEC-046 CA-10.
 *
 * No sustituye a M4 y no se usa en su lugar: sin la otra mitad, «llevar al usuario a la
 * superficie» pasaría la medida (ADR-030 §3).
 */
export async function medirContencionEnLaVentana(
  page: Page,
  revelado: Locator,
): Promise<Contencion> {
  return revelado.evaluate((el, tolerancia) => {
    const r = el.getBoundingClientRect();
    const alto = document.documentElement.clientHeight;
    const clases = [...el.classList].slice(0, 2).join('.');
    const testid = el.getAttribute('data-testid');
    return {
      selector:
        el.tagName.toLowerCase() +
        (clases ? `.${clases}` : '') +
        (testid ? `[data-testid="${testid}"]` : ''),
      top: r.top,
      bottom: r.bottom,
      alto: r.height,
      ventanaAlto: alto,
      porDebajoDelPliegue: Math.max(0, r.bottom - alto),
      porEncimaDelBorde: Math.max(0, -r.top),
      dentroDeLaVentana: r.top >= -tolerancia && r.bottom <= alto + tolerancia,
    };
  }, TOLERANCIA_PX);
}

/** El relato de una contención, **con la cifra**. */
export const describirContencion = (c: Contencion): string =>
  `${c.selector}: top=${Math.round(c.top)} bottom=${Math.round(c.bottom)} ` +
  `(alto ${Math.round(c.alto)}) sobre una ventana de ${c.ventanaAlto} px · ` +
  (c.porDebajoDelPliegue > 0
    ? `${Math.round(c.porDebajoDelPliegue)} px POR DEBAJO DEL PLIEGUE`
    : c.porEncimaDelBorde > 0
      ? `${Math.round(c.porEncimaDelBorde)} px por encima del borde superior`
      : 'dentro de la ventana');

export interface MedidaM4 extends Contencion {
  /** Rótulo del gesto, para el mensaje de fallo. */
  etiqueta: string;
  /** Posición de desplazamiento del documento **antes** del gesto (F-ADR-030-1). */
  scrollAntes: { x: number; y: number };
  /** Y después. Si no coinciden, al usuario lo han movido de sitio. */
  scrollDespues: { x: number; y: number };
  /** `true` si el gesto desplazó el documento. Es media violación por sí solo. */
  desplazoElDocumento: boolean;
  /** `dentroDeLaVentana === false || desplazoElDocumento === true`. */
  viola: boolean;
}

/**
 * **M4 — la respuesta al gesto cae dentro de la ventana.** La cuarta medida de la
 * geometría del proyecto, y la primera que pregunta por el **eje vertical**.
 *
 * ## Por qué existe (ADR-026 §2, ejercido por primera vez)
 *
 * M1, M2 y M3 son horizontales: preguntan *«¿cabe a lo ancho?»*. Un elemento a 2.400 px
 * por debajo del pliegue **cabe perfectamente**, así que las tres lo aprueban. La familia
 * entera de *«el gesto no produce nada visible»* estaba fuera de su alcance, y por ahí se
 * coló el defecto de SPEC-044: pulsar *Editar* en la primera fila de una lista larga
 * abría el panel al final de la lista, con la suite en verde.
 *
 * La lección de SPEC-040 no era «mide elemento a elemento»: era **«una medida sólo ve lo
 * que pregunta, así que la pregunta hay que escribirla»**. Ésta es la pregunta que
 * faltaba, y vive **aquí** para que la herede quien venga detrás sin copiar nada.
 *
 * ## La forma, tal y como la fija ADR-030 §3
 *
 * > Dado un control y el elemento que su activación revela, tras el gesto y **sin ningún
 * > desplazamiento programático**, el elemento revelado tiene `top >= -tolerancia` y
 * > `bottom <= innerHeight + tolerancia`, y la posición de desplazamiento del documento
 * > es **la misma que antes del gesto**.
 *
 * **Las dos mitades son necesarias.** Sin la segunda, «llevar al usuario a la superficie»
 * a base de `scrollIntoView` pasaría la medida, y eso no es lo mismo: mueve al usuario de
 * sitio, le quita de la vista la lista sobre la que estaba trabajando y hay que devolverlo
 * después. M4 dice *«la respuesta va donde está el usuario»*, no *«el usuario va donde
 * está la respuesta»*.
 *
 * ## F-ADR-030-1 — el desplazamiento que hace el motor de pruebas
 *
 * Playwright **desplaza por su cuenta** antes de interactuar con un elemento que no está
 * a la vista. Si se dejara correr, ese desplazamiento contaminaría la medida de dos
 * formas opuestas y las dos malas: metería la superficie dentro de la ventana por arte
 * del motor, y ensuciaría la comparación de posiciones con un movimiento que la app no
 * hizo.
 *
 * Por eso esta función **separa las dos cosas**: primero lleva el disparador a la vista
 * —que es el usuario alcanzando su control, no la app respondiendo—, **después** registra
 * la posición de desplazamiento, y sólo entonces da el gesto. Cualquier desplazamiento
 * posterior es de la app y cuenta como violación. Quien quiera medir el caso «el
 * disparador ya está a la vista» pasa `alcanzarDisparador: false` y se asegura él mismo.
 *
 * Es la sutileza más fácil de perder en la siguiente copia, y por eso está escrita aquí y
 * no en la guardia de una spec.
 *
 * ## La forma DÉBIL no se implementa (F-ADR-030-3)
 *
 * ADR-030 §3 define también una forma de **proximidad** —«el borde superior de la
 * respuesta cae dentro de la ventana y a menos de una fila del disparador»— para
 * superficies **en flujo**, que no pueden cumplir la contención. No se escribe aquí
 * porque nada la usa. Si una spec futura elige una forma en flujo, la aporta al módulo
 * **con ese nombre**, en vez de inventar una medida desde cero.
 *
 * @param disparador el control que se pulsa.
 * @param revelado   la superficie que el gesto revela.
 * @param gesto      qué hacer con el disparador; por defecto, pulsarlo.
 */
export async function medirRespuestaAlGesto(
  page: Page,
  opciones: {
    disparador: Locator;
    revelado: Locator;
    etiqueta?: string;
    gesto?: (disparador: Locator) => Promise<void>;
    alcanzarDisparador?: boolean;
  },
): Promise<MedidaM4> {
  const { disparador, revelado } = opciones;
  const etiqueta = opciones.etiqueta ?? 'gesto';

  // (1) El usuario alcanza su control. NO es la app respondiendo (F-ADR-030-1).
  if (opciones.alcanzarDisparador !== false) await disparador.scrollIntoViewIfNeeded();

  // (2) La posición se registra AQUÍ: antes del gesto y después de alcanzar el control.
  const scrollAntes = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));

  // (3) El gesto.
  await (opciones.gesto ? opciones.gesto(disparador) : disparador.click());
  await revelado.waitFor({ state: 'visible' });

  // (4) Y la medida, sin desplazar nada por el camino.
  const contencion = await medirContencionEnLaVentana(page, revelado);
  const scrollDespues = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));

  const desplazoElDocumento =
    Math.abs(scrollDespues.x - scrollAntes.x) > TOLERANCIA_PX ||
    Math.abs(scrollDespues.y - scrollAntes.y) > TOLERANCIA_PX;

  return {
    ...contencion,
    etiqueta,
    scrollAntes,
    scrollDespues,
    desplazoElDocumento,
    viola: !contencion.dentroDeLaVentana || desplazoElDocumento,
  };
}

export interface MedidaFondoDeLista {
  selector: string;
  /** Dónde acaba la lista, respecto al borde superior de la ventana. */
  fondo: number;
  ventanaAlto: number;
  /** `fondo - ventanaAlto`. Positivo = la lista NO cabe entera: es larga de verdad. */
  porDebajoDelPliegue: number;
  /**
   * Dónde acaba la lista en coordenadas del DOCUMENTO, no de la ventana.
   *
   * Es lo que necesita quien quiera reinyectar «la superficie se pinta detrás de la
   * lista» (`defectoSuperficieTrasLaLista`): la capa superior del navegador no tiene
   * flujo, así que la posición que el flujo le habría dado hay que medirla.
   */
  fondoEnElDocumento: number;
  /** Cuántos elementos tiene la lista. Informativo: la propiedad es el fondo, no éste. */
  elementos: number;
}

/**
 * **La precondición de una guardia de lista** (ADR-030 §4), aquí porque es del proyecto
 * y no de una spec.
 *
 * Una guardia que mide el comportamiento de una **lista** y se ejecuta con dos filas no
 * prueba nada sobre listas: mide el caso en el que el defecto **no puede existir**. Le
 * pasó a SPEC-044, cuyo escenario de dos filas dejaba el panel de edición dentro de la
 * ventana por accidente del tamaño de la muestra.
 *
 * Lo que se afirma **no es un número de filas** —eso es un estado del árbol, y caduca en
 * silencio cuando cambie el alto de una fila— sino la propiedad: **el fondo de la lista
 * cae por debajo del pliegue**. Quien la use, la afirma antes de medir y falla si dejó de
 * cumplirse (FOUNDATION, 2026-08-20).
 */
export async function medirFondoDeLista(
  page: Page,
  opciones: { lista: string; elementos?: string },
): Promise<MedidaFondoDeLista> {
  return page.evaluate(
    ({ lista, elementos }) => {
      const el = document.querySelector(lista);
      if (!el) throw new Error(`no hay ninguna lista que case "${lista}" en la pantalla`);
      const r = el.getBoundingClientRect();
      const alto = document.documentElement.clientHeight;
      return {
        selector: lista,
        fondo: r.bottom,
        ventanaAlto: alto,
        porDebajoDelPliegue: r.bottom - alto,
        fondoEnElDocumento: r.bottom + window.scrollY,
        elementos: elementos ? el.querySelectorAll(elementos).length : el.children.length,
      };
    },
    { lista: opciones.lista, elementos: opciones.elementos ?? null },
  );
}

/** El relato de una medida de M4, **con la cifra**: lo que se pega en un fallo o en `_qa/`. */
export const describirRespuestaAlGesto = (m: MedidaM4): string =>
  `${m.etiqueta} → ${describirContencion(m)} · desplazamiento del documento ` +
  `${Math.round(m.scrollAntes.y)} → ${Math.round(m.scrollDespues.y)}` +
  (m.desplazoElDocumento ? ' (SE MOVIÓ)' : '');

/* ────────────────────────────────────────────────────────────────────────────
   Hueco muerto y eje declarado — las medidas que el proyecto ya usaba
   ──────────────────────────────────────────────────────────────────────────── */

export interface Bloque {
  selector: string;
  /** Alto ÚTIL de la caja: sin su propio `padding` vertical, que es espacio pedido. */
  alto: number;
  /** Lo que de verdad ocupa el contenido: del borde superior del primer hijo al
   *  inferior del último. Si la caja mide mucho más, hay hueco muerto. */
  altoContenido: number;
  display: string;
  flexDirection: string;
}

/**
 * **Hueco muerto + eje declarado**, la medida que delató el pie de 452 px de SPEC-035
 * (`flex: 1 1 320px` interpretado como ALTURA al heredar `flex-direction: column` del
 * sistema de diseño por debajo de 720 px).
 *
 * Vive aquí porque estaba copiada, con pequeñas divergencias, en tres ficheros. Lo que
 * NO se unifica es el umbral: cada guardia pasa su holgura al comparar, porque
 * `admin` mide bloques con padding distinto que `ayuda` (ADR-026, F-ADR-026-1).
 */
export async function medirBloques(page: Page, selectores: string): Promise<Bloque[]> {
  return page.evaluate((selectores) => {
    return [...document.querySelectorAll(selectores)].map((el) => {
      const caja = el.getBoundingClientRect();
      const estilo = getComputedStyle(el);
      const relleno =
        parseFloat(estilo.paddingTop || '0') + parseFloat(estilo.paddingBottom || '0');
      const hijos = [...el.children]
        .map((h) => h.getBoundingClientRect())
        .filter((r) => r.width > 0 || r.height > 0);
      return {
        selector: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`,
        alto: caja.height - relleno,
        altoContenido:
          hijos.length === 0
            ? caja.height
            : Math.max(...hijos.map((r) => r.bottom)) - Math.min(...hijos.map((r) => r.top)),
        display: estilo.display,
        flexDirection: estilo.flexDirection,
      };
    });
  }, selectores);
}

/* ────────────────────────────────────────────────────────────────────────────
   Composición y presentación
   ──────────────────────────────────────────────────────────────────────────── */

export interface MedidaGeometria {
  ancho: number;
  m1: MedidaM1;
  m2: MedidaM2;
}

/** Las dos medidas de desborde sobre la página tal y como está, a un ancho dado. */
export async function medirDesborde(page: Page, ancho: number): Promise<MedidaGeometria> {
  await ponerVentana(page, ancho);
  await page.locator('main').first().waitFor({ state: 'visible' });
  return {
    ancho,
    m1: await medirDesbordePorElemento(page),
    m2: await medirDesbordeDeDocumento(page),
  };
}

/** Una línea con las dos cifras. Lo que se pega en el mensaje de fallo y en `_qa/`. */
export const describirDesborde = (m: MedidaGeometria): string =>
  `ancho ${m.ancho}: documento=${m.m2.documento}/${m.m2.ventana} ` +
  `(desborde ${m.m2.desborde}) · elementos medidos=${m.m1.medidos} ` +
  `violaciones=${m.m1.violaciones.length}` +
  (m.m1.peor
    ? ` · peor=${m.m1.peor.selector} right=${Math.round(m.m1.peor.derecha)} ` +
      `ancho=${Math.round(m.m1.peor.ancho)} (ventana ${m.m1.ventana})`
    : '');

/** El detalle de las violaciones de M1, para el mensaje de fallo. */
export const describirViolaciones = (m1: MedidaM1): string =>
  m1.violaciones
    .slice(0, 8)
    .map(
      (v) =>
        `  ${v.selector}: right=${Math.round(v.derecha)} left=${Math.round(v.izquierda)} ` +
        `ancho=${Math.round(v.ancho)} (ventana ${m1.ventana})`,
    )
    .join('\n');

/* ────────────────────────────────────────────────────────────────────────────
   Reinyección de defectos — la prueba de eficacia (ADR-026 §7)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Devuelve un defecto a la página con CSS inyectado, para comprobar que la medida lo
 * ve. Si una guardia no se pone roja al devolverle el defecto, no está midiendo lo que
 * dice medir — y este proyecto ya vivió la versión cara de esa lección.
 *
 * Devuelve una función que quita la inyección.
 */
export async function inyectarDefecto(page: Page, css: string): Promise<() => Promise<void>> {
  const id = `defecto-reinyectado-${Math.random().toString(36).slice(2)}`;
  await page.evaluate(
    ({ id, css }) => {
      const estilo = document.createElement('style');
      estilo.id = id;
      estilo.textContent = css;
      document.head.append(estilo);
    },
    { id, css },
  );
  return async () => {
    await page.evaluate((id) => document.getElementById(id)?.remove(), id);
  };
}

/**
 * Los tres defectos de SPEC-040, escritos como CSS que los devuelve.
 *
 * No son «un CSS cualquiera que rompa algo»: cada uno reproduce la causa real que
 * midió el verificador de SPEC-039, para que la prueba de eficacia demuestre que la
 * guardia caza EL defecto y no un defecto.
 */
export const DEFECTOS = {
  /**
   * (a) `V-SPEC-039-1` — el formulario de alta vuelve a no poder encoger.
   *
   * Es **la causa real, no una rotura cualquiera**: devuelve el formulario al estado
   * exacto que tenía antes del arreglo —ítems de rejilla y de flex con `min-width: auto`,
   * y los dos campos de zona sin `flex` ni `width`, como los dejaba el `style` en línea
   * de `WatchForm`—. Su mínimo intrínseco (**218 px por `<input>`** con la tipografía de
   * la app) vuelve a estirar la fila `min`/`max` a 444 px, y con ella la columna entera:
   * fuera de la ventana el buscador, los «max» de las dos zonas y el botón «Vigilar».
   *
   * Las dos mitades hacen falta. Con sólo `min-width: auto`, los campos siguen llevando
   * `flex: 1 1 0` del arreglo y un ítem con base flexible 0 **no aporta su contenido al
   * mínimo del contenedor**: la fila cabe igual y la reinyección no reproduce nada. Está
   * escrito porque se comprobó midiendo, no razonando.
   */
  formularioQueNoEncoge: `
    .page > *,
    .auth-form > *, .auth-form label > *,
    .symbol-picker, .symbol-search, .symbol-search-input,
    .zona-campos, .zona-campos > input {
      min-width: auto !important;
    }
    .zona-campos > input { flex: 0 1 auto !important; width: auto !important; }
  `,
  /**
   * (b) `V-SPEC-039-2` — el panel vuelve a repartir tres columnas a cualquier ancho.
   * Es la regla literal de `design/tremen-ds/components/cards.css:15`, sin la variante
   * responsive que SPEC-040 añade en `src/app/globals.css`.
   */
  panelDeTresColumnasSiempre: `
    .cards { grid-template-columns: repeat(3, 1fr) !important; }
  `,
  /**
   * (c) `V-SPEC-039-3` — la tabla vuelve a no tener contenedor de desplazamiento, así
   * que la absorbe el documento. Es lo que pasaba por encima de 720 px, cuando
   * `.table-scroll { overflow-x: auto }` vivía dentro de `@media (max-width: 720px)`.
   */
  tablaSinContenedorPropio: `
    .page > * { min-width: auto !important; }
    .table-scroll {
      overflow-x: visible !important;
      min-width: auto !important;
      max-width: none !important;
    }
  `,
} as const;

/**
 * **(d) SPEC-046 — la superficie vuelve a pintarse detrás de la lista**, que es la
 * colocación de SPEC-044 y la causa real del defecto que reportó el humano el 2026-08-22.
 *
 * SPEC-044 renderizaba un solo panel **después de la tabla entera**, así que la distancia
 * entre el gesto y su respuesta **crecía con la lista**. Con cuarenta filas, pulsar
 * *Editar* en la primera abría el formulario muy por debajo del pliegue y, para el
 * usuario, **el botón no hacía nada**. Sigue cabiendo a lo ancho, sigue sin partir
 * palabras y sigue sin desplazar el documento: **M1, M2 y M3 no ven nada**. Sólo M4 lo
 * caza (SPEC-046 CA-10).
 *
 * ## Por qué recibe una coordenada, y por qué eso NO es un número mágico
 *
 * Porque **una capa modal vive en la capa superior del navegador, y la capa superior no
 * tiene flujo**. Medido en Chromium mientras se escribía SPEC-046: sobre un
 * `<dialog>` abierto con `showModal()`, tanto `position: static` como
 * `position: absolute` con los cuatro desplazamientos en `auto` dejan la caja **arriba
 * del todo** (`top = 18` con 18 px de margen, sobre una tabla de 2.170 px por debajo del
 * pliegue). Es decir: **la posición estática no se puede recuperar con CSS**, así que
 * «devolver la superficie al flujo» hay que decirlo con la coordenada donde el flujo la
 * habría dejado.
 *
 * Y esa coordenada **no se escribe**: se **mide** —dónde acaba la lista ahora mismo, en
 * coordenadas del documento (`medirFondoDeLista().fondoEnElDocumento`)—. Si mañana la
 * tabla mide otra cosa, el defecto se reinyecta donde toque sin tocar este fichero. Es la
 * misma regla que gobierna el escenario de CA-11: se deriva, no se declara.
 *
 * El velo se apaga a la vez porque, tapando la pantalla entera, escondería que la
 * superficie se fue al final de la lista — y lo que se reinyecta es el defecto, no su
 * disfraz.
 */
export const defectoSuperficieTrasLaLista = (topEnElDocumento: number): string => `
  dialog.editar-vigilada[open] {
    position: absolute !important;
    top: ${Math.round(topEnElDocumento)}px !important;
    bottom: auto !important;
    left: 0 !important;
    right: 0 !important;
    margin: 18px auto 0 !important;
    max-height: none !important;
  }
  dialog.editar-vigilada[open]::backdrop { background: transparent !important; }
`;

/* ────────────────────────────────────────────────────────────────────────────
   Los dos puntos ciegos de M1, escritos como escenario reinyectable
   (V-SPEC-040-2 y V-SPEC-040-3)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Escenarios que **dejaban ciega a M1** sin romper nada visible, encontrados por el
 * verificador de SPEC-040 atacando CA-7 (es decir, buscando lo contrario de lo que se le
 * pedía). No son defectos de una pantalla: son defectos de **la medida**, y por eso se
 * reinyectan igual que los otros — una ceguera cerrada sin test se reabre en el primer
 * refactor, y se reabre en silencio.
 *
 * Los consume `tests/e2e/geometria-puntos-ciegos.spec.ts`.
 */
export const CEGUERAS = {
  /**
   * `V-SPEC-040-2` — un área de desplazamiento **vertical** en un ancestro.
   *
   * En CSS, si `overflow-y` es `auto|scroll` y `overflow-x` es `visible`, el navegador
   * **computa `overflow-x` a `auto`** (no existe el par visible/no-visible). M1 eximía a
   * los descendientes de cualquier elemento con `overflow-x` computado `auto|scroll`, así
   * que **bastaba que un componente declarase desplazamiento vertical** —algo tan común
   * como una lista con altura máxima— para que su subárbol entero dejara de medirse, sin
   * ser desplazable a lo ancho.
   *
   * Medido a 360 px en `/vigiladas` con el defecto (a) puesto: M1 pasaba de **13**
   * violaciones a **0**, y de 44 a **23** elementos medidos.
   *
   * No cambia ni un píxel del reparto horizontal: ese es exactamente el punto.
   */
  areaDeDesplazamientoVertical: `
    main.page { overflow-y: auto !important; }
  `,
} as const;

/**
 * `V-SPEC-040-3` — cuelga un bloque más ancho que la ventana del ancestro que se le
 * diga, para comprobar que la medida **lo ve**.
 *
 * Existe para el chrome del layout: el layout raíz monta `<div class="frame">` alrededor
 * de todo, y un hermano de `main` no lo veía M1 (recorría sólo `nav`, `main` y `footer`)
 * **ni** lo veía M2 (por debajo de 720 px el `overflow-x: hidden` del sistema lo recorta
 * sin mover `scrollWidth`). Dos medidas ciegas a la vez.
 *
 * Se marca con una clase reconocible para que el test pueda exigir que la violación que
 * se reporta sea **ésta** y no otra cualquiera.
 *
 * Devuelve una función que lo quita.
 */
export async function inyectarBloqueAncho(
  page: Page,
  opciones: { padre: string; ancho: number },
): Promise<() => Promise<void>> {
  const marca = `bloque-ancho-reinyectado-${Math.random().toString(36).slice(2)}`;
  await page.evaluate(
    ({ padre, ancho, marca }) => {
      const destino = document.querySelector(padre);
      if (!destino) throw new Error(`no existe el ancestro "${padre}" donde colgar el bloque`);
      const bloque = document.createElement('div');
      bloque.className = `bloque-ancho-reinyectado ${marca}`;
      bloque.style.width = `${ancho}px`;
      bloque.style.height = '20px';
      destino.append(bloque);
    },
    { ...opciones, marca },
  );
  return async () => {
    await page.evaluate((marca) => document.querySelector(`.${marca}`)?.remove(), marca);
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   M5 — el área táctil (SPEC-054, ADR-034 §6)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * El suelo de área táctil del producto, en px CSS.
 *
 * **La fuente, citada con precisión, que es la mitad del valor de escribirlo:** 44 × 44
 * es **WCAG 2.2 SC 2.5.5 *Target Size (Enhanced)*, nivel AAA**, y coincide con los 44 pt
 * de las *Apple Human Interface Guidelines*. El mínimo de **nivel AA** es
 * **SC 2.5.8 *Target Size (Minimum)*, 24 × 24 px**; Material Design pide 48 dp. El
 * proyecto adopta **44 y no 24** porque lo pidió el humano y porque la superficie es un
 * teléfono sostenido con una mano mientras se mira un precio — pero se adopta **sabiendo
 * que es el listón AAA**, no vendiendo un AAA como si fuera el mínimo legal (ADR-034 §6).
 *
 * ⚠️ **Bajarlo hasta que la suite pase es `F-ADR-026-1` cumpliéndose por escrito.** La
 * salida legítima ante un control que no llega es **agrandarlo**, y si dos de 44 no caben
 * en una línea, **apilarlos** — nunca encogerlos ni esconderlos (ADR-026 §4).
 */
export const SUELO_TACTIL_PX = 44;

/**
 * Qué cuenta como control interactivo, tal y como lo enumera ADR-034 §6.
 *
 * Es una lista de **elementos**, no de clases: una medida que preguntara por `.btn` se
 * quedaría ciega el día que alguien pinte un control con otra clase, que es justo el modo
 * de fallo que ADR-026 existe para acabar.
 */
export const SELECTOR_INTERACTIVO =
  'a[href], button, input, select, textarea, [role="button"], summary';

/** Un control medido por M5, con su caja ya ampliada por pseudoelementos si los tiene. */
export interface ControlTactil {
  /** `tag.clase[data-testid]`, suficiente para ir al sitio sin buscar. */
  selector: string;
  /** El rótulo visible o el nombre accesible, recortado: para leer el fallo sin abrir nada. */
  rotulo: string;
  ancho: number;
  alto: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
  /** `true` si un `::before`/`::after` absoluto amplió la caja que se juzga. */
  ampliadoPorPseudo: boolean;
}

/** Dos controles cuyas dianas se pisan: no son dos dianas, es una zona ambigua. */
export interface SolapeTactil {
  a: string;
  b: string;
  ancho: number;
  alto: number;
}

export interface MedidaM5 {
  /** El suelo con el que se juzgó. Se devuelve para que el informe lo diga. */
  suelo: number;
  ventana: number;
  /** Cuántos controles se llegaron a medir. Si es 0, la medida no midió nada. */
  medidos: number;
  /** Los que no llegan al suelo en alguno de los dos ejes, de peor a mejor. */
  pequenos: ControlTactil[];
  /** Los pares que se pisan. */
  solapes: SolapeTactil[];
  /** Constancia de que ESTOS elementos entraron en la medida (misma idea que M1). */
  testigos: string[];
}

/**
 * **M5 — el área táctil.** La quinta medida de la geometría del proyecto y la primera que
 * pregunta *«¿se puede pulsar?»*.
 *
 * ## Por qué existe (ADR-026 §2, ejercido por segunda vez)
 *
 * M1, M2 y M3 preguntan *«¿cabe a lo ancho?»*; M4 pregunta *«¿lo ve quien acaba de
 * pulsar?»*. **Ninguna pregunta si el dedo llega.** Y el árbol daba un número concreto el
 * día que esta medida nació: `.btn-sm` era `padding: 8px 14px` con `font: 600 13px/1`, o
 * sea **≈31 px de alto**, en las dos acciones de cada fila de `/vigiladas` y en el botón
 * de dirección del orden — con la suite entera en verde (ADR-034 §6, R-1 de EPIC-007).
 *
 * ## La forma, tal y como la fija ADR-034 §6
 *
 * > Por debajo del breakpoint de modo, todo elemento interactivo visible (`a[href]`,
 * > `button`, `input`, `select`, `textarea`, `[role="button"]`, `summary`) tiene una caja
 * > de al menos **44 × 44 px CSS**, contando el área ampliada por pseudoelementos si la
 * > hay, y **no se solapa** con la de otro control.
 *
 * **Las dos mitades hacen falta.** Sin la del solape, dos dianas de 44 px que se pisan
 * pasarían la medida, y para el dedo eso no son dos dianas: es una zona en la que no se
 * sabe qué se está pulsando.
 *
 * ## El área ampliada por pseudoelemento, y hasta dónde llega esta medida
 *
 * Agrandar la diana sin engordar la caja visible es una técnica legítima y muy usada: un
 * `::after` con `position: absolute` e `inset` negativos. Los pseudoelementos **no están
 * en el DOM**, así que no tienen `getBoundingClientRect()`; lo que sí se puede leer es su
 * estilo computado. Esta medida cubre **ese idioma y sólo ése**: pseudoelemento con
 * `content` distinto de `none`, `position: absolute|fixed`, y desplazamientos en px que
 * amplían la caja del control. Cualquier otra forma de ampliar la diana (una capa
 * hermana, un `padding` en un envoltorio) queda fuera y se vería como control pequeño —
 * lo cual es **el lado seguro** del error: la medida se queja de más, no de menos.
 *
 * ## M5 es complementaria, nunca sustituta
 *
 * Un control de 44 × 44 también tiene que **caber** a lo ancho (M1) y **no partir su
 * rótulo** (M3). ADR-034 §6 lo dice y conviene repetirlo aquí: M5 mide la caja, M3 mide
 * el rótulo, y un botón puede pasar la primera y fallar la segunda.
 *
 * @param opciones.raices      dónde buscar controles. Por defecto, la app entera (`RAICES`).
 * @param opciones.selector    qué cuenta como control. Por defecto, `SELECTOR_INTERACTIVO`.
 * @param opciones.suelo       el umbral. Por defecto `SUELO_TACTIL_PX`; no se afloja por guardia.
 * @param opciones.exclusiones las de M1, si quien mide se las pasa. M5 no estrena lista propia.
 * @param opciones.testigos    selector de los controles cuya medida hay que poder demostrar.
 */
export async function medirAreaTactil(
  page: Page,
  opciones: {
    raices?: string;
    selector?: string;
    suelo?: number;
    exclusiones?: readonly Exclusion[];
    testigos?: string;
  } = {},
): Promise<MedidaM5> {
  const raices = opciones.raices ?? RAICES;
  const selector = opciones.selector ?? SELECTOR_INTERACTIVO;
  const suelo = opciones.suelo ?? SUELO_TACTIL_PX;
  const exclusiones = selectorDeExclusiones(opciones.exclusiones ?? []);
  const testigos = opciones.testigos ?? null;

  return page.evaluate(
    ({ raices, selector, suelo, exclusiones, testigos, tolerancia }) => {
      const nombrar = (el: Element) => {
        const clases = [...el.classList].slice(0, 2).join('.');
        const testid = el.getAttribute('data-testid');
        return (
          el.tagName.toLowerCase() +
          (clases ? `.${clases}` : '') +
          (testid ? `[data-testid="${testid}"]` : '')
        );
      };

      /** El rótulo con el que una persona reconoce el control en el mensaje de fallo. */
      const rotular = (el: Element) => {
        const propio = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
        const alterno =
          el.getAttribute('aria-label') ??
          el.getAttribute('title') ??
          (el as HTMLInputElement).value ??
          (el as HTMLInputElement).placeholder ??
          '';
        return (propio !== '' ? propio : alterno).slice(0, 40);
      };

      /**
       * La caja del control, ampliada por sus pseudoelementos si los usa para agrandar la
       * diana. Un desplazamiento NEGATIVO de un pseudo absoluto es área que se gana.
       */
      const cajaTactil = (el: Element) => {
        const r = el.getBoundingClientRect();
        let top = r.top;
        let left = r.left;
        let right = r.right;
        let bottom = r.bottom;
        let ampliado = false;
        for (const pseudo of ['::before', '::after']) {
          const s = getComputedStyle(el, pseudo);
          if (s.content === 'none' || s.content === '') continue;
          if (s.position !== 'absolute' && s.position !== 'fixed') continue;
          const px = (v: string) => (v.endsWith('px') ? parseFloat(v) : Number.NaN);
          const [t, d, b, i] = [s.top, s.right, s.bottom, s.left].map(px);
          if ([t, d, b, i].some((n) => Number.isNaN(n))) continue;
          // `inset` se mide DESDE el borde del contenedor hacia dentro: negativo = fuera.
          const nt = r.top + t;
          const ni = r.left + i;
          const nd = r.right - d;
          const nb = r.bottom - b;
          if (nt < top || ni < left || nd > right || nb > bottom) ampliado = true;
          top = Math.min(top, nt);
          left = Math.min(left, ni);
          right = Math.max(right, nd);
          bottom = Math.max(bottom, nb);
        }
        return { top, left, right, bottom, ancho: right - left, alto: bottom - top, ampliado };
      };

      const ventana = document.documentElement.clientWidth;
      const medidos: {
        selector: string;
        rotulo: string;
        ancho: number;
        alto: number;
        top: number;
        left: number;
        right: number;
        bottom: number;
        ampliadoPorPseudo: boolean;
      }[] = [];
      const vistosTestigo: string[] = [];
      const vistos = new Set<Element>();

      for (const raiz of document.querySelectorAll(raices)) {
        const candidatos = [
          ...(raiz.matches(selector) ? [raiz] : []),
          ...raiz.querySelectorAll(selector),
        ];
        for (const el of candidatos) {
          if (vistos.has(el)) continue;
          vistos.add(el);
          if (exclusiones && el.closest(exclusiones)) continue;
          const c = cajaTactil(el);
          // Invisible: ni ocupa ni se ve. No es una diana (misma regla que M1).
          if (c.ancho === 0 && c.alto === 0) continue;
          // `display: none` en un ancestro deja caja 0×0, pero `visibility: hidden` no:
          // se pregunta a la plataforma, que es quien sabe si el control se pinta.
          if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) continue;
          if (testigos && el.matches(testigos)) vistosTestigo.push(nombrar(el));
          medidos.push({
            selector: nombrar(el),
            rotulo: rotular(el),
            ancho: c.ancho,
            alto: c.alto,
            top: c.top,
            left: c.left,
            right: c.right,
            bottom: c.bottom,
            ampliadoPorPseudo: c.ampliado,
          });
        }
      }

      const pequenos = medidos
        .filter((m) => m.ancho < suelo - tolerancia || m.alto < suelo - tolerancia)
        .sort((a, b) => Math.min(a.ancho, a.alto) - Math.min(b.ancho, b.alto));

      const solapes: { a: string; b: string; ancho: number; alto: number }[] = [];
      for (let i = 0; i < medidos.length; i++) {
        for (let j = i + 1; j < medidos.length; j++) {
          const a = medidos[i];
          const b = medidos[j];
          const ancho = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const alto = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ancho > tolerancia && alto > tolerancia) {
            solapes.push({
              a: `${a.selector} «${a.rotulo}»`,
              b: `${b.selector} «${b.rotulo}»`,
              ancho,
              alto,
            });
          }
        }
      }

      return {
        suelo,
        ventana,
        medidos: medidos.length,
        pequenos,
        solapes,
        testigos: vistosTestigo,
      };
    },
    { raices, selector, suelo, exclusiones, testigos, tolerancia: TOLERANCIA_PX },
  );
}

/** El relato de M5, **con las cifras**: lo que se pega en un fallo o en `_qa/`. */
export const describirAreaTactil = (m: MedidaM5): string =>
  `suelo ${m.suelo}x${m.suelo} · controles medidos=${m.medidos} · por debajo=` +
  `${m.pequenos.length} · solapes=${m.solapes.length}` +
  (m.pequenos.length > 0
    ? `\n${m.pequenos
        .slice(0, 10)
        .map(
          (c) =>
            `  ${c.selector} «${c.rotulo}»: ${Math.round(c.ancho)}x${Math.round(c.alto)}` +
            (c.ampliadoPorPseudo ? ' (ampliado por pseudoelemento)' : ''),
        )
        .join('\n')}`
    : '') +
  (m.solapes.length > 0
    ? `\n${m.solapes
        .slice(0, 5)
        .map((s) => `  se pisan ${s.a} y ${s.b} en ${Math.round(s.ancho)}x${Math.round(s.alto)} px`)
        .join('\n')}`
    : '');

/**
 * **El defecto de M5, escrito como CSS que lo devuelve** (ADR-026 §7).
 *
 * No es «un CSS cualquiera que encoja algo»: es la caja que `.btn-sm` tenía el día que la
 * medida nació —`padding: 8px 14px` con `font: 600 13px/1`, ≈31 px de alto— llevada un
 * paso más allá para que el fallo sea inequívoco. `.btn-sm` es la clase de los tres
 * controles que nacieron rojos: *Editar*, *Quitar* y el botón de dirección del orden.
 *
 * Va sin `!important` a propósito: entra como `<style>` al final del `<head>`, así que le
 * basta el orden de fuente para ganar a una regla de la misma especificidad. Si el arreglo
 * que se prueba subiera la especificidad —`.tarjeta-pie .btn-sm`— o pusiera un
 * `min-height`, esta reinyección dejaría de reproducir el defecto **y la prueba de
 * eficacia lo diría**, que es exactamente para lo que está.
 */
export const DEFECTO_AREA_TACTIL = `.btn-sm { padding: 2px 6px; font-size: 10px }`;

/* ────────────────────────────────────────────────────────────────────────────
   Contenedores de desplazamiento y overflow declarado (SPEC-054 CA-4, CA-21)
   ──────────────────────────────────────────────────────────────────────────── */

export interface ContenedorDeDesplazamiento {
  selector: string;
  overflowX: string;
  /** Lo que el contenedor ocupa a lo ancho por dentro. */
  contenido: number;
  /** Lo que se ve de él. */
  visible: number;
  /** `overflow-x` declarado (`auto`/`scroll`) **y** desplazado de verdad: hay que arrastrar. */
  hayQueArrastrar: boolean;
}

/**
 * **El inventario de `overflow-x` de una pantalla**, elemento a elemento.
 *
 * Responde a dos preguntas que ni M1 ni M2 responden y que SPEC-054 necesita afirmar:
 *
 *  - *«¿queda algún contenedor que arrastrar?»* (CA-4). La promesa del patrón de tarjetas
 *    es que en un teléfono **no se arrastra nada**. M1 no lo ve: un contenedor con
 *    desplazamiento declarado es la **segunda salida legítima** de ADR-026 §4 y M1 exime
 *    su subárbol precisamente por eso. Que exista no es un defecto en general; que exista
 *    en móvil **después de esta spec** sí lo es, y hay que preguntarlo aparte.
 *  - *«¿ha aparecido un `overflow: hidden` nuevo?»* (CA-21). ADR-026 §4 dice que recortar
 *    **no es un arreglo**, y el mal ejemplo está en casa: `design/tremen-ds/responsive.css`
 *    resuelve su paso a móvil con `html, body { overflow-x: hidden }`, que la app carga.
 *    Como el recorte no mueve ninguna otra cifra, la única forma de vigilarlo es
 *    **listarlo**.
 *
 * Recorre desde `<html>` a propósito —no desde `RAICES`— porque los dos que el proyecto
 * acepta heredados son justamente `html` y `body`, y una lista que no los enseñe no se
 * puede comparar con la lista de los que se aceptan.
 */
export async function medirOverflowHorizontal(page: Page): Promise<ContenedorDeDesplazamiento[]> {
  return page.evaluate((tolerancia) => {
    const nombrar = (el: Element) => {
      const clases = [...el.classList].slice(0, 2).join('.');
      const testid = el.getAttribute('data-testid');
      return (
        el.tagName.toLowerCase() +
        (clases ? `.${clases}` : '') +
        (testid ? `[data-testid="${testid}"]` : '')
      );
    };
    const salida: {
      selector: string;
      overflowX: string;
      contenido: number;
      visible: number;
      hayQueArrastrar: boolean;
    }[] = [];
    // `querySelectorAll('*')` ya devuelve `<html>`, así que se recorre con un `Set`: sin
    // esto el documento aparecía DOS veces en el inventario y quien lo compara con una
    // lista de elementos aceptados veía un duplicado que no existe.
    const vistos = new Set<Element>([document.documentElement, ...document.querySelectorAll('*')]);
    for (const el of vistos) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'visible') continue;
      const declarado = ox === 'auto' || ox === 'scroll';
      salida.push({
        selector: nombrar(el),
        overflowX: ox,
        contenido: el.scrollWidth,
        visible: el.clientWidth,
        hayQueArrastrar: declarado && el.scrollWidth > el.clientWidth + tolerancia,
      });
    }
    return salida;
  }, TOLERANCIA_PX);
}

/* ────────────────────────────────────────────────────────────────────────────
   Presencia, cajas y suelos tipográficos (SPEC-054 CA-1, CA-3, CA-14, CA-20)
   ──────────────────────────────────────────────────────────────────────────── */

export interface Presencia {
  selector: string;
  /** Cuántos elementos casan el selector. `0` = no está en el DOM. */
  existe: number;
  /** El `display` computado del primero. Cadena vacía si no existe. */
  display: string;
  /**
   * Si la plataforma lo considera pintado (`Element.checkVisibility()`), que es lo mismo
   * que decir **si está en el árbol de accesibilidad** por la vía de `display: none`.
   */
  enElArbol: boolean;
  ancho: number;
  alto: number;
}

/**
 * **Qué representación está viva a este ancho** (SPEC-054 CA-1, ADR-034 §3).
 *
 * La conmutación de modo se afirma por el `display` computado y por si la plataforma
 * considera el elemento pintado, no por una captura: `display: none` es lo que retira del
 * árbol de accesibilidad y lo que deja la caja a 0 × 0 para que M1 la salte.
 */
export async function medirPresencia(page: Page, selectores: string[]): Promise<Presencia[]> {
  return page.evaluate((selectores) => {
    return selectores.map((selector) => {
      const todos = document.querySelectorAll(selector);
      const el = todos[0] ?? null;
      if (!el) {
        return { selector, existe: 0, display: '', enElArbol: false, ancho: 0, alto: 0 };
      }
      const r = el.getBoundingClientRect();
      return {
        selector,
        existe: todos.length,
        display: getComputedStyle(el).display,
        enElArbol: typeof el.checkVisibility === 'function' ? el.checkVisibility() : r.width > 0,
        ancho: r.width,
        alto: r.height,
      };
    });
  }, selectores);
}

export interface CajaMedida {
  selector: string;
  texto: string;
  top: number;
  left: number;
  right: number;
  bottom: number;
  ancho: number;
  alto: number;
}

/**
 * Las cajas de todo lo que casa un selector, en coordenadas de ventana.
 *
 * Es el primitivo con el que una guardia afirma **relaciones** entre cajas —«estas dos
 * están en la misma línea», «ésta empieza por debajo de aquélla», «las dos miden lo
 * mismo»— sin escribirse su propia lectura del DOM. La medida es de aquí; **qué** se
 * afirma con ella es de cada guardia (ADR-026 §2).
 */
export async function medirCajas(page: Page, selector: string): Promise<CajaMedida[]> {
  return page.evaluate((selector) => {
    return [...document.querySelectorAll(selector)].map((el) => {
      const r = el.getBoundingClientRect();
      const clases = [...el.classList].slice(0, 2).join('.');
      const testid = el.getAttribute('data-testid');
      return {
        selector:
          el.tagName.toLowerCase() +
          (clases ? `.${clases}` : '') +
          (testid ? `[data-testid="${testid}"]` : ''),
        texto: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
        top: r.top,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        ancho: r.width,
        alto: r.height,
      };
    });
  }, selector);
}

export interface TextoConTamano {
  selector: string;
  texto: string;
  tamano: number;
}

export interface MedidaTipografia {
  /** Todo `input`/`select`/`textarea` visible, con su `font-size` computado. */
  controles: TextoConTamano[];
  /** Todo elemento visible con texto propio, con su `font-size` computado. */
  textos: TextoConTamano[];
}

/**
 * **Los dos suelos de legibilidad** (SPEC-054 CA-14, ADR-034 §7).
 *
 *  - **16 px en los controles de formulario.** No es estética: por debajo de 16 px,
 *    Safari en iOS **amplía la página al enfocar el campo** y no la devuelve. Es un
 *    defecto de interacción con causa conocida y umbral exacto.
 *  - **12 px en cualquier texto.** Es el suelo que el proyecto **ya tiene**
 *    (`.quote-fail`/`.quote-pending`/`.quote-stale`) y esta medida lo **congela, no lo
 *    sube**: subirlo obligaría a rehacer una caja que SPEC-016 y SPEC-043 afinaron a
 *    `34ch`. WCAG **no fija un tamaño mínimo de fuente** —lo que fija es SC 1.4.4 *Resize
 *    Text* (AA)— y decir lo contrario sería inventarse una norma.
 *
 * Se mide el elemento que **contiene el nodo de texto**, no cualquier ancestro: el
 * `font-size` que importa es el que se hereda hasta donde el texto se pinta.
 */
export async function medirSuelosTipograficos(
  page: Page,
  opciones: { raices?: string } = {},
): Promise<MedidaTipografia> {
  const raices = opciones.raices ?? RAICES;
  return page.evaluate((raices) => {
    const nombrar = (el: Element) => {
      const clases = [...el.classList].slice(0, 2).join('.');
      const testid = el.getAttribute('data-testid');
      return (
        el.tagName.toLowerCase() +
        (clases ? `.${clases}` : '') +
        (testid ? `[data-testid="${testid}"]` : '')
      );
    };
    const pintado = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true;
    };

    const controles: { selector: string; texto: string; tamano: number }[] = [];
    const textos: { selector: string; texto: string; tamano: number }[] = [];
    const vistos = new Set<Element>();

    for (const raiz of document.querySelectorAll(raices)) {
      for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
        if (vistos.has(el)) continue;
        vistos.add(el);
        if (!pintado(el)) continue;
        const tamano = parseFloat(getComputedStyle(el).fontSize || '0');

        if (el.matches('input, select, textarea')) {
          const v = el as HTMLInputElement;
          controles.push({
            selector: nombrar(el),
            texto: (v.name || v.type || '').slice(0, 40),
            tamano,
          });
        }

        // Sólo el elemento que contiene DIRECTAMENTE texto no vacío: el `font-size` que
        // se juzga es el del sitio donde el texto se pinta, no el de cualquier ancestro.
        const propio = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => (n.textContent ?? '').trim())
          .filter((t) => t !== '')
          .join(' ');
        if (propio !== '') {
          textos.push({ selector: nombrar(el), texto: propio.slice(0, 40), tamano });
        }
      }
    }
    return { controles, textos };
  }, raices);
}

/**
 * **El breakpoint de MODO del producto**, en px CSS (ADR-034 §1).
 *
 * Por debajo, la tabla de datos se presenta como tarjetas; por encima, como tabla. Es el
 * **único** ancho de todo el árbol que puede hacer aparecer o desaparecer una
 * representación: 599/600 (el reparto de `.cards`) y 380 (el apretón tipográfico del
 * sistema de diseño) son de DENSIDAD y no hacen aparecer ni desaparecer nada.
 *
 * Vive aquí, junto a `ANCHOS`, porque es **del proyecto y no de una spec**: la spec 2 de
 * EPIC-007 (la navegación) y la 3 (el resto de rutas) lo heredan sin volver a decidirlo, y
 * el día que alguien quiera moverlo tendrá que hacerlo en un sitio donde se ve.
 *
 * La otra cara del mismo canto es `min-width: 721px`, y así lo escribe ADR-034 §1: son
 * **un** breakpoint mirado desde sus dos lados, no dos.
 */
export const BREAKPOINT_MODO_PX = 720;

/** Los anchos medidos en los que manda la representación de tarjetas. */
export const ANCHOS_TARJETA = ANCHOS.filter((a) => a <= BREAKPOINT_MODO_PX);

/** Los anchos medidos en los que manda la tabla. */
export const ANCHOS_TABLA = ANCHOS.filter((a) => a > BREAKPOINT_MODO_PX);

/**
 * Los dos anchos de **teléfono** del proyecto: 360 (Android pequeño, iPhone SE) y 390.
 *
 * Se derivan de `ANCHOS` en vez de escribirse, para que el día que el suelo del proyecto
 * cambie no queden dos listas diciendo cosas distintas. El corte en 400 no es un
 * breakpoint del producto: es «esto es un teléfono en una mano» frente a «esto es una
 * tablet o una ventana estrecha».
 */
export const ANCHOS_TELEFONO = ANCHOS.filter((a) => a < 400);

export interface PropiedadesComputadas {
  selector: string;
  texto: string;
  props: Record<string, string>;
}

/**
 * Las propiedades computadas que se le pidan, de todo lo que casa un selector.
 *
 * Es el hermano de `medirCajas`: un **primitivo de lectura**, no una medida con criterio.
 * Existe para que una guardia pueda afirmar cosas como «el fondo de la tarjeta es el mismo
 * color que el de su fila», «el aviso conserva su caja de `34ch`» o «ninguna propiedad
 * reordena nada dentro de la tarjeta» **sin escribirse su propio `getComputedStyle`** en
 * cada fichero — que es exactamente como se degradaron las cuatro guardias que ADR-026
 * vino a unificar. Qué se lee lo dice quien mide; **cómo** se lee, este módulo.
 *
 * Se pide por nombre de propiedad en camelCase (`backgroundColor`, `maxWidth`,
 * `gridRowStart`), que es como las nombra `CSSStyleDeclaration`.
 */
export async function medirPropiedadesComputadas(
  page: Page,
  selector: string,
  propiedades: readonly string[],
): Promise<PropiedadesComputadas[]> {
  return page.evaluate(
    ({ selector, propiedades }) => {
      return [...document.querySelectorAll(selector)].map((el) => {
        const s = getComputedStyle(el);
        const clases = [...el.classList].slice(0, 2).join('.');
        const testid = el.getAttribute('data-testid');
        const props: Record<string, string> = {};
        for (const p of propiedades) props[p] = s.getPropertyValue(p) || String(s[p as never] ?? '');
        return {
          selector:
            el.tagName.toLowerCase() +
            (clases ? `.${clases}` : '') +
            (testid ? `[data-testid="${testid}"]` : ''),
          texto: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60),
          props,
        };
      });
    },
    { selector, propiedades: [...propiedades] },
  );
}
