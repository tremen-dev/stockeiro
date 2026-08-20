import type { Page } from '@playwright/test';

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

/** Las raíces que M1 recorre: la app entera visible, sin el `<html>`/`<body>`. */
export const RAICES = 'nav, main, footer';

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
}

/**
 * **M1 — la medida principal.** Recorre cada elemento visible bajo `nav`, `main` y
 * `footer` (las raíces incluidas) y comprueba que su caja cabe en la ventana:
 * `right <= innerWidth + 1` y `left >= -1`.
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
 * `scroll`**. Y **`hidden` NO está en esa lista**, a propósito: recortar es justo lo
 * que hace `html, body { overflow-x: hidden }` del sistema de diseño y justo lo que
 * dejó a la suite en verde con el botón «Vigilar» fuera de la pantalla. Meter `hidden`
 * aquí sería reintroducir la ceguera que este módulo existe para acabar.
 */
export async function medirDesbordePorElemento(
  page: Page,
  opciones: { raices?: string; exclusiones?: readonly Exclusion[] } = {},
): Promise<MedidaM1> {
  const raices = opciones.raices ?? RAICES;
  const exclusiones = selectorDeExclusiones(opciones.exclusiones ?? EXCLUSIONES_M1);

  return page.evaluate(
    ({ raices, exclusiones, tolerancia }) => {
      const ventana = document.documentElement.clientWidth;
      const violaciones: {
        selector: string;
        derecha: number;
        izquierda: number;
        ancho: number;
      }[] = [];
      let medidos = 0;

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
       * `auto` y `scroll` sí; `hidden` NO (ADR-026 §4 y el comentario del jsdoc).
       */
      const dentroDeContenedorDesplazable = (el: Element, tope: Element) => {
        for (let p = el.parentElement; p && p !== tope.parentElement; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
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
      return { ventana, peor: violaciones[0] ?? null, violaciones, medidos };
    },
    { raices, exclusiones, tolerancia: TOLERANCIA_PX },
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
