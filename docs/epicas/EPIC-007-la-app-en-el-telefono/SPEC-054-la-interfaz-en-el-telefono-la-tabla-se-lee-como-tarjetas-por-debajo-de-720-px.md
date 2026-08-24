---
id: SPEC-054
tipo: spec
epica: EPIC-007
estado: en-revision
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-24, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-24, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-24, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-24, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-08-24, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-24, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-24, por: sdd-arquitecto}
  - {estado: en-progreso, fecha: 2026-08-24, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-24, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-24, por: sdd-arquitecto}
---
# SPEC-054 — La interfaz en el teléfono: la tabla se lee como tarjetas por debajo de 720 px

## Problema

**La pantalla donde vive la promesa del producto, vista en un teléfono, es una tabla de nueve
columnas que hay que arrastrar de lado para leer una fila.** Lo pidió el humano (Alberto Fojo)
el 2026-08-24, sobre la app real, con estas palabras:

> *«necesito que la vista sea adaptada a movil. sobre todo la tabla, hay que ver opciones que
> permitan que se vea correctamente, siguiendo los estándares de UI/UX para mobile»*

El roce está **observado sobre la app real**, no imaginado, y llega ahora por lo mismo que
existe **EPIC-007**: EPIC-004 abrió el producto a testers externos y **el enlace se va a
compartir en un foro de bolsa**. Un enlace en un foro se abre en el teléfono, así que el móvil
no es un extra de comodidad: es el **camino de entrada por defecto** al producto. Un autor
tolera cualquier interfaz porque sabe lo que hay detrás de cada celda; alguien que llega del
foro con un teléfono en la mano y dos minutos de paciencia, no.

> **Esta spec es la primera de EPIC-007** y fija el patrón que heredan las demás. Nació en
> EPIC-MEJORA y **la expulsó el criterio CE-M3 de aquella épica** —*«si la spec necesita ADR
> nuevo, se replantea su encaje»*—, cosa que ocurrió: necesita **ADR-034**. Lo decidió el
> humano (Alberto Fojo) el 2026-08-24. El porqué está en §Notas para el gate, nota 5.

### Lo que hay hoy, medido sobre el árbol y no supuesto

1. **`/vigiladas` tiene nueve columnas** (`src/app/vigiladas/watched-table.tsx`): Activo,
   Tipo, Mercado, Estado, Precio, A fecha, Zona compra, Zona venta y las acciones.
   **`/cartera` tiene cinco** (`src/app/cartera/page.tsx`): Ticker, Cantidad viva, Coste
   medio, P/L realizado, P/L actual.
2. **Las dos son más anchas que un teléfono, y lo son por decisiones tomadas a conciencia.**
   `.data-table` declara `width: 100%` (`src/app/globals.css:384`) pero con `table-layout:
   auto` eso es un suelo, no un techo. El relleno de `th`/`td` son **288 px** sólo en la de
   nueve columnas; `.estado-caja` lleva `max-width: 170px` con el motivo de SPEC-016 envuelto
   dentro; `.zone-label` es `white-space: nowrap` para que «En compra y venta» no se parta.
   ADR-030 dejó esta aritmética escrita en su hecho 1 y no ha cambiado.
3. **La única respuesta de hoy a esa anchura es arrastrar.**
   `.table-scroll { overflow-x: auto; min-width: 0; max-width: 100% }`
   (`globals.css:496-513`) es correcta y está donde debe: **SPEC-040 CA-5** la sacó del
   `@media (max-width: 720px)` porque entre 721 y 800 px la absorbía el documento (a 760 px,
   `scrollWidth` 819 sobre `clientWidth` 760). **Esta spec no la toca por encima del
   breakpoint.** Lo que arregla es lo otro: que en un teléfono *«arrastrar»* convierte la
   lectura de una fila en un gesto de exploración por columna.
4. **Y ese gesto tiene una consecuencia ya documentada.** ADR-030, hecho 2: el control
   *Editar* está en la **novena** columna, así que a anchos estrechos **en el instante del
   clic el `scrollLeft` está al máximo**. Lo que se ve de la fila **no es lo que la fila
   dice**.
5. **Los controles de fila no se pueden pulsar con comodidad.** `.btn-sm` es
   `padding: 8px 14px` con `font: 600 13px/1` (`globals.css:483-493`): una caja de **≈31 px
   de alto**. *Editar*, *Quitar* y el botón de dirección del orden son todos `.btn-sm`. Está
   por debajo de cualquier suelo táctil publicado, **y la suite entera está verde** — porque
   ninguna de las cuatro medidas de geometría del proyecto pregunta *«¿se puede pulsar?»*.
6. **Hay tres familias de breakpoint conviviendo y ninguna es «la del producto»**: 720 px (el
   *mobile pass* de `design/tremen-ds/responsive.css:9` y **cinco** bloques de `globals.css` —
   líneas 515, 695, 1043, 1215, 1429), 599/600 px (`globals.css:300` y `:304`, sólo el reparto
   de `.cards`) y 380 px (`responsive.css:192`, apretón tipográfico del sistema).
7. **`/cartera` no se mide a ningún ancho.** El conjunto de rutas de
   `tests/e2e/geometria-rutas.spec.ts` es `/`, `/ayuda`, `/legal`, `/login`, `/register`,
   `/dashboard`, `/vigiladas`, `/avisos` y `/cuenta`. Una de las dos tablas del producto lleva
   sin medirse desde SPEC-002.

### Una corrección al encargo, escrita aquí porque llegó al gate

El encargo daba por hecho que *«el móvil real (<600px) no se mide»* y que los anchos del
módulo compartido eran 600/700/720/730/760/800. **Es falso, y comprobado en las dos ramas.**
`tests/e2e/geometria.ts:66` declara, idéntico en `origin/main` y en el worktree:

```ts
export const ANCHOS = [360, 390, 640, 700, 730, 760, 800, 1280] as const;
```

**360 y 390 llevan medidos desde SPEC-040**, y coinciden con ADR-026 §3. No existe ninguna
lista `600/700/720/730/760/800` en el repositorio. Lo que **sí** falta es el hecho 7 de
arriba: la ruta entera de `/cartera`. Por eso la decisión del humano *«hay que añadir 360 y
390»* se ejecuta en esta spec como **lo que de verdad cierra el agujero que ella describía**:
no anchos nuevos, sino **la superficie que no se mide** (CA-11). El motivo de la decisión
—*«un defecto que sólo existe entre dos anchos medidos es un defecto que nadie mide»*, ADR-026
§3— se respeta íntegro; lo que cambia es dónde estaba el hueco.

### Qué se decide aquí y qué venía decidido

Del gate de orquestación del 2026-08-24, y **no se reabre**: el patrón es **tarjeta por
fila**, con cero desplazamiento horizontal en móvil y la tabla intacta por encima del
breakpoint; el alcance son **las dos tablas y lo que las rodea en sus dos páginas**. El boceto
que aprobó el humano para vigiladas es el de §Diseño.

Lo que esta spec y **ADR-034** deciden porque estaba abierto: **en qué ancho conmuta** (720
px, y por qué ése), **cómo conviven las tres familias de breakpoint**, **cómo se representan
las dos formas sin que se separen**, **qué pasa con la semántica de tabla al dejar de haber
tabla**, y **qué medida nueva entra en el módulo compartido** (M5, área táctil).

**CE-5 de EPIC-007 se cumple y es afirmable** —*«el escritorio no paga la factura del
móvil»*—, y con él la frontera de la épica (*«esta épica no enseña nada que la app no sepa ya
hacer»*): no cambia ni un dato, ni un cálculo, ni una regla. El
`state` de cada fila lo sigue computando el servidor con `entraEnZona` (RN-11), el P/L sigue
saliendo de `portfolioSummary` (RN-04, RN-05, RN-06) y `/cartera` sigue siendo Server
Component. Lo único que cambia es **cómo se presenta**.

## Usuarios / roles afectados

- **Tester (rol `tester`)** — el usuario que motiva la spec. Alcanza `/vigiladas` pero **no**
  `/cartera` (CE-2 de **EPIC-004**, no de esta épica), así que en él impacta la mitad de vigiladas.
- **Usuario completo (rol `completo`)** — alcanza las dos páginas; es quien ve el cambio
  entero.
- **Usuario de lector de pantalla**, en cualquiera de los dos roles: es a quien afecta el
  cambio de semántica del pto. 4 de ADR-034, y por eso tres CA son suyos (CA-7, CA-8, CA-9).
- **No afectados**: el rol `admin` en sus pantallas propias, y cualquiera en las superficies
  de §Fuera de alcance.

## Diseño

### El boceto aprobado (vigiladas)

```
┌─────────────────────────────┐
│ TPG0  Tarjeta Pago Group    │
│ ● En zona de compra         │
│                             │
│ Precio      12,40 €         │
│ A fecha     2026-08-23      │
│ Compra      11,00 – 12,50   │
│ Venta       18,00 – 19,00   │
│ Acción · Mercado  NASDAQ    │
│                             │
│ [ Editar ]      [ Quitar ]  │
└─────────────────────────────┘
```

El fondo de la tarjeta **es** el estado de zona (SPEC-007: color de fondo, no distintivo).
Los pares de la parte central son `<dt>`/`<dd>` dentro de un `<dl>`, y sus términos son
**literalmente los mismos textos** que los `<th>` de la tabla, salvo los tres que el boceto
promociona a otro sitio: `Activo` (que es la cabecera de la tarjeta), `Estado` (que es el
fondo más su etiqueta) y la columna sin rótulo de acciones (que es el pie).

Los avisos de diagnóstico —`.quote-fail`, `.quote-pending`, `.quote-stale`— viven **bajo la
etiqueta de estado**, que es donde están hoy dentro de `.estado-caja`, y **conservan su caja
acotada de `max-width: 34ch` y su envoltura**: esta tabla, dice su propio comentario en
`globals.css:706-710`, *«YA se rompió una vez por un párrafo de motivo que se extendía en vez
de envolverse»*, y el formato tarjeta no es excusa para repetirlo.

### La tarjeta de cartera

Mismo patrón, cinco columnas: `Ticker` como cabecera, y `Cantidad viva`, `Coste medio`,
`P/L realizado` y `P/L actual` como los cuatro pares. Sin fondo de estado (cartera no tiene
zonas) y sin pie de acciones (sus filas no tienen controles). Los avisos de la celda de
P/L actual —`.quote-fail` y `.quote-stale`— acompañan a su `<dd>`.

**El P/L actual y el realizado siguen siendo dos pares distintos y así se leen** (D-6, RN-05,
RN-06): la tarjeta no los agrega ni los pone en la misma línea.

### Los dos árboles

Por ADR-034 §3, cada tabla se pinta **dos veces** —`<table>` y `<ul>` de tarjetas— y el
`@media` de 720 px oculta la que no toca con `display: none`. Las dos formas se derivan de
**una sola descripción de columnas** por tabla, que dice por columna su rótulo y cómo sale su
valor de la fila. Ese detalle no es de estilo: es lo único que impide que las dos formas se
separen cuando alguien añada una columna, y CA-6 lo comprueba por su efecto.

`display: none` importa además para la medida: M1 salta los elementos con caja de 0 × 0
(`tests/e2e/geometria.ts`, *«Invisible: ni ocupa ni se ve. No es maquetación»*), así que la
representación oculta no ensucia ni infla el recuento — y **`display: none` también retira del
árbol de accesibilidad**, que es lo que hace correcto tener dos árboles.

## Criterios de aceptación

> Los CA de geometría se verifican con Playwright a los **ocho anchos del proyecto**
> (`ANCHOS`, ADR-026 §3) salvo cuando el CA nombra otros. **Móvil = 360 y 390 px**;
> **tabla = 730, 760, 800 y 1280 px**. Todas las medidas se importan del módulo compartido
> `tests/e2e/geometria.ts` (ADR-026 §2): **ninguna guardia de esta spec escribe una medida
> propia**.

### La conmutación

- **CA-1 (el modo conmuta, y en el canto exacto)**: Dado un usuario con al menos tres
  vigiladas y al menos dos posiciones en cartera, cuando se carga `/vigiladas` y `/cartera` a
  **360, 390, 640 y 700 px**, entonces en cada página la lista de tarjetas está en el árbol de
  accesibilidad y **`table.data-table` tiene `display: none` computado**; y cuando se cargan a
  **730, 760, 800 y 1280 px**, entonces ocurre lo contrario: la tabla está y la lista de
  tarjetas tiene `display: none`. En **ningún** ancho están las dos a la vez ni falta las dos.

- **CA-2 (el canto está bracketeado por dos anchos medidos adyacentes)**: Dado el mismo
  escenario, cuando se mide a **720 px** y a **721 px**, entonces a 720 px la representación
  viva es la de tarjetas y a 721 px es la tabla; y el conjunto `ANCHOS` contiene **700** y
  **730**, que son los dos anchos medidos que rodean el canto. *(La segunda mitad es un test
  unitario sobre `ANCHOS`; la primera, Playwright.)*

- **CA-3 (una tarjeta por fila, y una sola columna en toda la franja móvil)**: Dado un usuario
  con **N** vigiladas y **M** posiciones, cuando se carga cada página a **360, 390, 640 y
  700 px** —los cuatro anchos por debajo del breakpoint, no sólo los dos de teléfono—,
  entonces la lista de tarjetas de vigiladas tiene exactamente **N** `<li>` y la de cartera
  exactamente **M**, en el **mismo orden** que las filas de la tabla; y **la lista es de una
  sola columna a los cuatro anchos** — el borde superior de cada tarjeta es mayor o igual que
  el borde inferior de la anterior, con la tolerancia del módulo, de modo que no hay dos
  tarjetas compartiendo línea. *(Decisión del humano del 2026-08-24: en 600–720 px **una**
  columna. La salida si algún día molesta está documentada en el «fuera de alcance» de
  EPIC-007 y es un `grid-template-columns`, no un breakpoint nuevo.)*

### Que quepa, que no se arrastre y que se pueda pulsar

- **CA-4 (cero desbordamiento horizontal en móvil, en las dos páginas)**: Dado el mismo
  escenario, cuando se mide `/vigiladas` y `/cartera` a **360 y 390 px**, entonces **M1**
  reporta **cero** violaciones sobre `RAICES` con las exclusiones vigentes, **M2** reporta
  `documentElement.scrollWidth ≤ clientWidth + 1`, y **M3** no encuentra ni un título con más
  cajas de línea que palabras. Y además: **ningún elemento de la página tiene `overflow-x`
  computado `auto` o `scroll` con `scrollWidth > clientWidth`** — es decir, no queda **ni un
  contenedor que arrastrar**, que es la promesa del patrón y no se deduce de M1 ni de M2.

- **CA-5 (`.table-scroll` sobrevive intacta por encima del breakpoint)**: Dado el mismo
  escenario, cuando se mide `/vigiladas` y `/cartera` a **730, 760, 800 y 1280 px**, entonces
  `.table-scroll` sigue teniendo `overflow-x: auto` computado, `min-width: 0` y
  `max-width: 100%`; a 730 y 760 px la tabla de nueve columnas **sí** desborda su caja y
  **desplazándola se alcanza la última columna**; y **M2** reporta cero desborde de documento
  a los cuatro anchos. *(Es SPEC-040 CA-5 ejecutándose entera después del cambio: cero
  regresión, CE-5.)*

- **CA-13 (M5 — el área táctil, en el módulo compartido y con el suelo en 44 × 44)**: Dado
  que `tests/e2e/geometria.ts` exporta una medida `medirAreaTactil` con la forma de ADR-034
  §6, cuando se aplica a `/vigiladas` y `/cartera` a **360 y 390 px**, entonces **todo
  elemento interactivo visible que cuelgue de `main.page` en cualquiera de las dos páginas, o
  de `dialog.editar-vigilada`** (`a[href]`, `button`, `input`, `select`, `textarea`,
  `[role="button"]`, `summary`) tiene caja de al menos **44 × 44 px CSS** —contando el área
  ampliada por pseudoelemento si la hay— y **ninguna se solapa con la de otro control**.

  **El suelo se afirma contra 44, sin restarle ninguna holgura**: un control de 43,00 px es
  rojo. *(Es el finding `F-VERIF-054-1`: los campos de formulario medían 43,00 exactos y
  pasaban porque la comparación restaba `TOLERANCIA_PX`. La regla general —una tolerancia
  compara dos medidas, nunca una medida contra un umbral declarado— la decide **ADR-035**, y
  su implementación en el módulo **no es de esta spec**: `F-ADR-035-1`. Lo que este CA exige
  es la **propiedad**, medida como haga falta.)*

  **La acotación es deliberada y es la del §Fuera de alcance de esta misma spec**: la
  navegación global (`.app-nav`), el pie (`.app-footer`) y el enlace de feedback quedan
  **fuera de la afirmación y dentro de la medición**. La guardia los mide igualmente y escribe
  sus cifras en `_qa/SPEC-054/m5-fuera-de-alcance.txt` **sin asertarlas**, para que la spec 2
  de EPIC-007 llegue con el trabajo dimensionado en vez de descubrirlo. Es `R-1 de EPIC-007`
  cumpliéndose con números, y **no autoriza a bajar el suelo**: la salida cuando esos doce
  controles se afirmen será agrandarlos (ADR-034 §6).

  La guardia entrega además la prueba de que la medida ve el defecto (ADR-026 §7):
  reinyectando `.btn-sm { padding: 2px 6px; font-size: 10px }` la medida **reporta
  violación**, y sin reinyectarlo no.

- **CA-14 (los dos suelos de legibilidad)**: Dado el mismo escenario a 360 y 390 px, entonces
  **(a)** todo `input`, `select` y `textarea` visible tiene `font-size` computado **≥ 16 px**
  —incluidos los del formulario de alta plegable y los de la capa de edición—, y **(b)** ni un
  solo nodo de texto visible de las dos páginas se pinta por debajo de **12 px** computados.
  *(El (a) es el umbral exacto por el que Safari en iOS amplía la página al enfocar un campo;
  el (b) congela el suelo que ya tiene el proyecto en `.quote-fail`/`.quote-pending`/
  `.quote-stale`, no lo sube — ADR-034 §7.)*

### Que no se pierda nada por el camino

- **CA-6 (la tarjeta dice todo lo que dice la fila, con el mismo rótulo — anti-deriva)**: Dado
  un usuario con vigiladas que cubran los cinco estados de zona (`buy`, `sell`, `both`, `out`,
  `none`) y posiciones con y sin P/L actual, cuando se comparan a 1280 px la tabla y a 360 px
  la lista de tarjetas, entonces **para cada fila, cada valor de celda aparece en su tarjeta
  con el mismo texto normalizado**, y **el conjunto de rótulos `<dt>` de la tarjeta es
  exactamente el de los `<th>` de la tabla menos `Activo`, `Estado` y la columna sin rótulo de
  acciones**. Ni un dato de menos, ni un rótulo distinto, ni un rótulo inventado.

- **CA-15 (los avisos de diagnóstico no se rompen en formato tarjeta)**: Dado un usuario con
  una vigilada sin cotización con motivo (`.quote-fail`), una sin datos aún
  (`.quote-pending`), una sin refrescar (`.quote-stale`) y una posición de cartera con aviso
  en su P/L actual, cuando se cargan las dos páginas a 360 y 390 px, entonces cada aviso está
  **visible y completo** —su texto coincide carácter a carácter con el que se lee a 1280 px—,
  conserva su **caja acotada** (`max-width: 34ch` computado, nunca `none`), **ninguna línea de
  ningún aviso se extiende por encima de esa caja**, **el aviso de más palabras de cada
  pantalla ocupa más de una caja de línea**, **ninguno parte una palabra** (M3) y **ninguno
  desborda su tarjeta** (M1 aplicado con la tarjeta como raíz, y el borde derecho de cada
  aviso dentro del de su tarjeta).

  **Por qué el envolvimiento se afirma del aviso más largo y no de cada uno.** Hay que
  escribirlo, porque la redacción anterior pedía las dos cosas a la vez y eran incompatibles.
  Exigir que **cada** aviso ocupe más de una línea dentro de una caja de `34ch` no es una
  propiedad de la caja: es una propiedad de **la longitud del texto de cada motivo**, que esta
  spec no elige. Medido a 360 y 390 px en la tarjeta de `/vigiladas`: `.quote-fail`
  (91 caracteres) ocupa **dos** cajas de línea, `.quote-pending` (52) **dos**, y
  `.quote-stale` (45) **una sola**, con su línea más larga en **267,20 px** dentro de una caja
  de **270,504 px**. Cabe por **3,3 px**, y la única forma de hacerle ocupar dos sería
  **estrechar la caja** — justo lo que la cláusula anterior del mismo CA prohíbe. El CA se
  pedía a sí mismo dos cosas que no pueden ser verdad juntas.

  Lo que esta spec quiere afirmar de verdad es que **la caja acotada funciona**, no que todos
  los motivos sean largos; y eso son **tres** propiedades, no una: **(i)** que nadie se salga
  de su caja; **(ii)** que quien no cabe **envuelva** en vez de extenderse —que es literalmente
  el defecto que rompió esta tabla en SPEC-016, *«un párrafo de motivo que se extendía en vez
  de envolverse»*, y que SPEC-040 CA-4 arregló acotando la **caja**, nunca el texto (ADR-034
  §7)—; y **(iii)** que envolver no se pague **partiendo palabras**. Un aviso corto que cabe en
  una línea **está bien**: en la tarjeta hay más ancho que en la celda de 170 px de la tabla, y
  penalizarlo por ser corto sería convertir el CA en rehén del texto de cada motivo. *(Reescrito
  el 2026-08-24 tras el RED de la ronda 5: **`F-VERIF-054-2`**. La guardia ya afirmaba estas
  tres propiedades, con su porqué escrito al lado; lo que faltaba era que el CA dijera lo que la
  guardia hace. **No cambia ni una línea de código ni de test.**)*

- **CA-16 (cero regresión funcional — CE-5)**: Dado el escenario de cada suite existente,
  cuando se ejecutan enteras `npm test` y `npx playwright test`, entonces **todas pasan y no
  se afloja ni una aserción**; y el diff **no toca** `src/db/`, `drizzle/`,
  `src/lib/portfolio/`, `src/lib/watchlist/zone-status.ts` ni `src/lib/market/`: ni un dato,
  ni un cálculo, ni una regla.

  **Lo que este CA prohíbe es aflojar, no tocar** —y la distinción hay que escribirla porque
  esta spec **obliga** a tocar guardias ajenas: CA-1 apaga `table.data-table` a 360, 390, 640
  y 700 px, así que toda guardia que conduzca la tabla por debajo del canto deja de encontrar
  lo que buscaba; y CA-11 mete `/cartera` en el conjunto de rutas de
  `tests/e2e/geometria-rutas.spec.ts`, que es una de ellas. Una redacción que exigiera «sin
  tocarse» sería incumplible por construcción.

  **El criterio que separa un re-encuadre de un aflojamiento**: un cambio es legítimo si deja
  intacta **qué propiedad se afirma y sobre qué sujeto**, y sólo corrige **dónde vive hoy ese
  sujeto**. Es ilegítimo si toca la afirmación. En concreto:

  - **Legítimo**, y sólo estas seis formas, cada una con su motivo escrito al
    lado del cambio: **(a)** un **localizador** que pasa a apuntar a la representación **viva**
    al ancho que mide; **(b)** una **espera** que aguardaba a `table.data-table` visible y pasa
    a aguardar a la representación viva —una espera no es una aserción—; **(c)** un caso que
    **se re-encuadra al subconjunto de anchos de tabla** porque bajo el canto su premisa deja
    de existir y allí rige un CA **más fuerte** de esta misma spec; **(d)** una lista escrita
    dentro de un `.spec.ts` que **se extrae a un módulo importable** sin cambiar su contenido;
    **(e)** una guardia unitaria que miraba **un fichero** y pasa a mirar **la superficie
    entera** de la pantalla porque ese fichero se partió — mide más, no menos; **(f)** el
    **módulo de medida compartido** de ADR-026, al que esta spec **añade** medidas nuevas sin
    tocar ni una línea de las que ya había. **(f) no es un re-encuadre: es crecimiento**, y por
    eso su prueba es aritmética y no interpretativa — el diff del fichero tiene que ser
    `+N/−0`. Con cero líneas borradas ninguna guardia previa puede haber cambiado de
    significado, porque ninguna de sus líneas cambió.
  - **Ilegítimo (aflojar)**: quitar o debilitar una aserción, subir una tolerancia, marcar un
    caso `skip`/`fixme`, sustituir una aserción por una espera, o recortar el conjunto de
    anchos **para esquivar un rojo** en vez de para seguir a la representación.

  **Y por nombre, porque una regla sin lista se discute**: siguen verdes **sin tocarse**
  `tests/e2e/vigiladas-orden.spec.ts`, `tests/e2e/cartera.spec.ts`,
  `tests/e2e/decimales.spec.ts` y `tests/e2e/sin-refrescar-geometria.spec.ts` —sus aserciones
  sobre la tabla a 360 px son de atributo o de valor computado, y `display: none` no cambia ni
  uno ni otro—. Se tocan, y **sólo por (a)–(f)**:
  `tests/e2e/spec046.ts` *(—(a)—: sus localizadores pasan a apuntar a la representación viva;
  helper, no guardia, y es lo que permite dejar `vigiladas-capa-edicion.spec.ts` intacto)*,
  `tests/e2e/vigiladas-capa-edicion.spec.ts`
  *(una espera —(b)—, ninguna aserción)*, `tests/e2e/vigiladas-editar.spec.ts` *(su `editarDe`
  local —(a)—)*, `tests/e2e/geometria-rutas.spec.ts` *(las tres listas de rutas salen a módulo
  —(d)—, lo exige CA-11; y el caso «la tabla se sigue pudiendo arrastrar» pasa a los anchos de
  tabla —(c)—, porque por debajo del canto rige CA-4, que es **más fuerte**: no queda nada que
  arrastrar)*, `tests/e2e/movil-alta.spec.ts` *(—(a)—)*,
  `tests/e2e/geometria-puntos-ciegos.spec.ts` *(—(c)—: a 360 px la exención de M1 que mide ya
  no puede hacer nada, así que aprobaba en el vacío)*, las dos unitarias
  `tests/spec044-frontera.test.ts` y `tests/spec043-sin-refrescar.test.ts` *(—(e)—)*, y el
  módulo `tests/e2e/geometria.ts` *(—(f)—: el módulo único de ADR-026 estrena M5 y las medidas
  que esta spec necesita; su diff contra `main` es **+630 / −0**, cero líneas borradas, y
  `TOLERANCIA_PX` sigue valiendo 1 en la misma línea y con el mismo comentario)*.

  **Y las dos listas juntas son exhaustivas**, con el diff acotado a **los commits de esta
  spec** —la rama lleva encima trabajo de otras y un `main...HEAD` a pelo mezcla sus ficheros
  con los de aquí—: no queda ni un fichero de test **que ya existiera** tocado por SPEC-054 y
  sin clasificar. Los siete restantes —`tests/e2e/rutas.ts`, `tests/e2e/spec054.ts`,
  `tests/e2e/tarjetas-conmutacion.spec.ts`, `tests/e2e/tarjetas-geometria.spec.ts`,
  `tests/e2e/tarjetas-capa-edicion.spec.ts`, `tests/spec054-breakpoint-y-rutas.test.ts` y
  `tests/spec054-m5-en-el-modulo.test.ts`— **nacen en esta spec**, así que no pueden aflojar
  nada: no había nada que aflojar. *(Escrito el 2026-08-24 tras la ronda 5: `geometria.ts`
  estaba tocado y sin clasificar, y un CA que se verifica leyendo diffs no puede dejar un diff
  fuera de sus listas. No es un defecto —el fichero es puramente aditivo—, es un hueco de la
  enumeración.)*

  **La verificación de este CA es leer los diffs de test**, no sólo ver las dos suites verdes:
  un cambio en un fichero de test que no encaje en (a)–(f), o que no lleve su motivo escrito al
  lado, es rojo aunque todo pase. *(Reescrito el 2026-08-24 tras el RED de la ronda 1, que
  confirmó los seis re-encuadres uno a uno y **cero aserciones aflojadas**: `F-SPEC-054-2`.)*

### La semántica al dejar de haber tabla

- **CA-7 (`aria-sort` es de una tabla, y desaparece con ella)**: Dado el escenario de CA-1,
  cuando se carga `/vigiladas` a **360 y 390 px**, entonces **ningún** elemento del documento
  declara `aria-sort` en el árbol de accesibilidad; y cuando se carga a **730 y 1280 px**,
  entonces exactamente **un** `<th>` declara `aria-sort` distinto de `none` y es el de la
  columna por la que se ordena, tal como lo dejó SPEC-041.

- **CA-8 (el orden se sigue diciendo y se sigue pudiendo cambiar en móvil)**: Dado
  `/vigiladas` a 360 y 390 px, entonces `.orden-control` está **visible** (no oculto, no
  desplazado fuera), su `<select>` tiene nombre accesible y su valor nombra el criterio
  activo, y su botón de dirección declara `aria-pressed` acorde; y cuando se cambia el
  criterio a «Estado», entonces **el orden de las tarjetas cambia igual que cambia el de las
  filas** a 1280 px con el mismo criterio — misma secuencia de tickers.

- **CA-9 (el orden de lectura es el del boceto y el del DOM)**: Dado `/vigiladas` a 360 px,
  cuando se recorre una tarjeta, entonces el orden en el DOM es **ticker (y nombre si lo hay)
  → etiqueta de estado (y sus avisos) → los pares `<dt>`/`<dd>` en el orden del boceto →
  acciones**; cada par está en un `<dl>` con un `<dt>` por `<dd>`; **ninguna** propiedad de CSS
  reordena nada dentro de la tarjeta (ni `order`, ni `grid-row`/`grid-column` explícitos, ni
  `direction`), de modo que el orden visual **es** el del DOM; y la lista tiene un nombre
  accesible que dice de qué lista es. Y el recorrido con el tabulador visita los controles de
  la tarjeta **N** antes que los de la **N+1**.

- **CA-10 (el estado de zona sigue siendo el fondo — SPEC-007)**: Dado un usuario con
  vigiladas en los cinco estados, cuando se cargan a 360 px, entonces cada tarjeta lleva la
  clase `zone-${state}` de su fila y su `background-color` computado **es el mismo** que el del
  `<tr>` correspondiente a 1280 px; la etiqueta `.zone-label.is-${state}` sigue presente con su
  texto; y el estado **no** se comunica con ningún distintivo, borde de color ni icono nuevos.

### La capa de edición sobre la tarjeta

- **CA-12 (la capa de ADR-030 sigue cumpliendo sobre tarjetas, y con lista larga)**: Dado un
  usuario con una lista **larga de verdad** —la guardia **afirma su precondición** (ADR-030
  §4): el final de la lista queda por debajo del pliegue en el ancho que mide, y falla si deja
  de cumplirse—, cuando se pulsa *Editar* en la tarjeta **primera**, en una **intermedia** y
  en la **última**, a **360 y 390 px**, entonces en los tres casos: **M4** se cumple sobre
  `dialog[data-testid="editar-panel"]` —cae entera dentro de la ventana y **la posición de
  desplazamiento del documento es la misma que antes del gesto**—, la capa entra en la medida
  M1 como testigo y no viola nada, su `aria-label` nombra el activo de **esa** tarjeta, la
  tarjeta pulsada queda **marcada** mientras la capa está abierta, y al cerrar por guardar,
  cancelar o **Escape** el foco vuelve al botón que la abrió. La capa **no** entra en
  `EXCLUSIONES_M1` (ADR-030 §5).

### El módulo, las rutas y lo que rodea a las tablas

- **CA-11 (`/cartera` entra en el conjunto de rutas medidas)**: Dado el conjunto de rutas de
  `tests/e2e/geometria-rutas.spec.ts`, cuando se ejecuta la guardia, entonces **`/cartera`
  está en él** y se mide con M1, M2 y M3 a los **ocho** anchos con una cuenta que tenga
  posiciones; y un test unitario afirma que la ruta está en el conjunto, para que retirarla se
  vea en rojo y no en silencio.

- **CA-17 (lo que rodea a las dos tablas también cabe y se puede pulsar)**: Dado `/vigiladas`
  y `/cartera` a **360 y 390 px**, entonces: la cabecera de página (`.page-head`, incluida la
  `.page-head-row` de cartera con su enlace *Importar extracto*) cumple M1 y M5; el
  `.orden-control` cumple M1, M5 y M3 —su `<select>` no parte palabras—; el **formulario de
  alta plegable** (`.alta-vigilada`, `.alta-toggle`) cumple M1 y M5 **desplegado y plegado**;
  y los formularios de compra y venta de `/cartera` cumplen M1, M5 y CA-14(a). Ninguno declara
  un contenedor con desplazamiento horizontal.

- **CA-18 (un solo breakpoint de **modo**, y afirmado)**: Dado `src/app/globals.css`, cuando
  un test unitario extrae **todas** sus consultas `@media`, entonces:

  **(a)** los cantos que aparecen son exactamente **tres** —**720**, que es el de **modo** y
  se escribe por sus dos lados (`max-width: 720px` y `min-width: 721px`, que son la misma
  decisión vista desde cada lado y se normalizan a uno), y **599/600** y **1023**, que son los
  **dos bordes del único bloque de densidad**, el de `.cards` (ADR-034 §2)— y **ningún otro**;

  **(b)** **todo bloque que no sea el de modo toca `.cards` y nada más** — que es lo que hace
  inofensivo un canto de densidad y lo que convierte el CA en una propiedad y no en un
  recuento;

  **(c)** **todas** las reglas que ponen o quitan `display` a `table.data-table`, a
  `.table-scroll` o a la lista de tarjetas viven dentro del canto de **720**, y existen sus
  dos caras.

  *(Es la propiedad, no el estado del árbol: si mañana hace falta otro ancho, el test lo dice
  y se decide en un gate — no se cuela. Corregido el 2026-08-24: la redacción anterior decía
  «no aparece ningún cuarto valor» y era **falsa sobre el árbol** — el 1023 es el borde
  superior de `@media (min-width: 600px) and (max-width: 1023px)`, existe desde antes de esta
  spec, `/dashboard` está en su §Fuera de alcance y ese bloque no se toca. La regla de fondo
  —un solo breakpoint de **modo**, el resto de **densidad**— no cambia; lo que cambia es que
  ahora se afirma contando los cantos que hay, no negando uno que existe. `F-SPEC-054-3`.)*

- **CA-19 (evidencia reproducible, y la palabra «reproducible» se aplica a lo que puede
  serlo)**: Dado el final de la ejecución, entonces `_qa/SPEC-054/` contiene:

  **(a) La evidencia, que son las cifras.** Ficheros de texto con las medidas de M1/M2/M3/M5
  por ruta y por ancho, el canto del modo, el inventario de `overflow`, M4 sobre la capa, el
  pie de la tarjeta y los suelos de legibilidad. **Son deterministas y se afirma que lo son**:
  dos pasadas completas seguidas de la e2e devuelven los `.txt` **byte a byte idénticos**. Un
  `.txt` que cambie sin que haya cambiado el código **es una regresión** y hay que explicarla.

  **(b) La ilustración, que son las capturas.** Los `.png` de las dos páginas a 360, 390, 700,
  730 y 1280 px y el de la capa de edición abierta sobre una tarjeta a 360 px están para que
  un humano vea de qué se está hablando. **No son evidencia y no se afirma que sean estables**:
  el escenario siembra `updated_at` **relativo al reloj** (RN-16, a propósito: una fecha
  clavada sería una bomba de relojería), así que dos pasadas separadas en el tiempo producen
  píxeles distintos sin que nada se haya movido. **Un diff en un `.png` de esta spec no prueba
  nada por sí solo**; lo que hay que leer son los `.txt`. *(Es ADR-026 §6 aplicado a la
  evidencia: el proyecto ya decidió que **se miden cajas, no píxeles**, y una captura que se
  rompe al cambiar una fuente o un reloj no protege nada. Se comprobó en la ronda 2 revirtiendo
  el arreglo, reconstruyendo y recapturando: las diez capturas de ancho cambian igual, y las
  **alturas de imagen son idénticas a las de la base** — la maquetación no se mueve.
  `F-SPEC-054-6`.)*

  **(c) Y nada fuera de su sitio.** **Sólo** se escribe bajo `_qa/SPEC-054/`: ninguna otra
  `_qa/SPEC-NNN/` aparece en el diff. *(La e2e completa reescribe capturas ajenas; se
  restauran con `git checkout -- _qa/`.)*

  *(Reescrito el 2026-08-24. La redacción anterior pedía «evidencia reproducible» sin
  distinguir las dos mitades, y con ella un `.png` distinto obligaba a investigar un fantasma.
  **La alternativa era congelar el reloj del escenario y se rechaza**: `updated_at` relativo es
  lo que hace que `.quote-stale` signifique algo, y clavarlo convertiría la guardia de RN-16 en
  una bomba de relojería — se pagaría un invariante de dominio por una comodidad de diff.)*

- **CA-20 (el pie de la tarjeta: dos botones al 50 %, en una fila)**: Dado un usuario con
  vigiladas, cuando se carga `/vigiladas` a **360 y 390 px**, entonces en cada tarjeta
  *Editar* y *Quitar* están **en la misma fila** —el mismo `top`, con la tolerancia del
  módulo—, cada uno mide **la mitad del ancho disponible del pie menos el hueco**
  (sus dos anchos son iguales entre sí, con la tolerancia del módulo, y juntos más el hueco
  ocupan el ancho del pie), y cada uno cumple **M5** —al menos 44 px de alto y de ancho— sin
  solaparse con el otro. *(Decisión del humano del 2026-08-24: al 50 % y no apilados, porque
  mantiene la tarjeta **corta**, que es lo que importa con cuarenta vigiladas. Este CA cierra
  la ambigüedad que la pregunta 3 del gate dejaba abierta: **M5 aceptaría las dos formas y
  aquí se fija una**.)*

- **CA-21 (la salida prohibida no se usa, y se afirma)**: Dado el diff completo de la spec,
  cuando se buscan reglas nuevas de `overflow` en `src/app/globals.css`, entonces **ninguna
  regla añadida por esta spec declara `overflow-x: hidden`, `overflow-y: hidden` ni
  `overflow: hidden`** sobre un elemento de las dos páginas en alcance; y en tiempo de
  ejecución, a **360 y 390 px**, ningún elemento de `/vigiladas` ni de `/cartera` tiene
  `overflow-x` computado `hidden` **salvo** los que ya lo tenían antes de esta spec, que son
  **tres y se enumeran enteros**:
  **(i)** `html`/`body`, heredados de `design/tremen-ds/responsive.css:11` (ADR-026 §4 acepta
  explícitamente el heredado; lo que prohíbe es **añadirlo**);
  **(ii)** `table.data-table` (`globals.css`), desde SPEC-007, para recortar sus esquinas
  redondeadas;
  **(iii)** `.card` (`design/tremen-ds/components/cards.css:30`, `overflow: hidden`), desde el
  **primer commit del proyecto**, y vivo en los formularios de compra y venta de `/cartera`,
  en el de alta y en la capa de edición. Se acepta por el mismo motivo que (ii) —es una
  máscara de esquinas redondeadas, no una respuesta a un desborde— y **se enumera aquí porque
  la lista anterior se escribió mirando sólo `globals.css` y éste vive en `design/`**
  (`F-SPEC-054-3`).
  No cuentan como `hidden` los **valores por defecto del agente de usuario** —`overflow-x:
  clip` en los campos de texto— porque no son una regla de este proyecto ni de su sistema de
  diseño.

  **La lista de tres es la afirmación; el patrón que la reconoce es más ancho que ella, y eso
  se escribe aquí en vez de apretarse.** La guardia reconoce a los heredados por el nombre del
  elemento, y el trozo que reconoce a (iii) —`\.card\b`— aceptaría también una clase futura del
  tipo `.card-algo`, porque el guion es frontera de palabra. **Hoy no existe ninguna**: la lista
  medida y la lista escrita coinciden elemento a elemento, y por eso el CA se verifica. No se
  aprieta en esta spec porque apretarlo es **cambiar una guardia ya verificada** para cazar un
  caso que no existe, y esta spec no toca guardias para adornarlas. Queda como
  **`F-SPEC-054-9`**: el día que el sistema de diseño estrene su primera clase `.card-*`, el
  reconocedor tiene que pasar a comparar **clases enteras** en vez de prefijos, o la
  enumeración deja de ser exacta sin que nadie se entere. *(Anotado el 2026-08-24, observación
  (ii) de la ronda 5. La alternativa —dejarlo sin escribir— es la que hace que el próximo
  revisor lo redescubra desde cero, que es lo mismo que le pasó a `.card` y costó
  `F-SPEC-054-3`.)*

  *(**R-2 de EPIC-007**: el mal ejemplo
  está en casa. `design/tremen-ds/responsive.css:11` resuelve su paso a móvil con
  `html, body { overflow-x: hidden }`, que es exactamente lo que ADR-026 §4 declara que **no es
  un arreglo**, y es el patrón que cualquiera copiará al ver una barra de desplazamiento. Esta
  spec dice explícitamente que no lo usa, y lo comprueba.)*

## Entidades y reglas afectadas

**Ninguna regla de negocio cambia** (CE-5, y la frontera de EPIC-007). Se citan porque la presentación tiene que seguir
respetándolas:

- **RN-10 / RN-11** (zona = rango; entrada en zona): el `state` de cada fila lo sigue
  computando el servidor; la tarjeta **lo pinta**, no lo recalcula.
- **RN-12** y el no-negociable **D-2** de FOUNDATION (*«mostrar siempre el `asOf` / carácter
  diferido del dato»*): «A fecha» es **par obligatorio** de la tarjeta de vigiladas. Es uno de
  los motivos por los que el patrón elegido no esconde columnas (ADR-034, alternativas).
- **RN-16** (cotización sin refrescar): la marca `.quote-stale` viaja a la tarjeta con su caja
  acotada intacta (CA-15).
- **RN-04 / RN-05 / RN-06** y **D-6**: coste medio, P/L realizado y P/L actual siguen siendo
  magnitudes distintas y se leen como **pares distintos** en la tarjeta de cartera.
- **RN-01 / RN-03**: sin cambio. La presentación no toca consultas ni sesión.
- **ADR-007 / ADR-012**: `Mercado` sale de `micCode` y es la mitad de la identidad del
  símbolo; por eso es **par obligatorio** de la tarjeta y no una columna prescindible (cerró
  `F-SPEC-024-1`).
- **ADR-026**: las tres medidas, el módulo único, los ocho anchos, `overflow: hidden` no es un
  arreglo, el componente declara su caja, nada de comparación de imágenes, y una guardia nueva
  demuestra que caza el defecto (§7 → CA-13).
- **ADR-030**: la capa de edición sigue siendo `<dialog>` anclado al borde inferior y M4 sigue
  midiéndola (CA-12). **Este trabajo no la mueve.**
- **ADR-034** (nuevo, en `borrador`): el breakpoint de modo, la convivencia de los tres
  breakpoints, los dos árboles derivados de una descripción de columnas, la semántica
  sustituida, M5 y las áreas seguras inertes.
- **ADR-035** (nuevo, en `borrador`, 2026-08-24): un **umbral declarado se afirma sin
  holgura** —la tolerancia de redondeo compara dos medidas, nunca una medida contra un umbral
  escrito en un ADR—. Nace del finding `F-VERIF-054-1` de esta spec y **la vincula sólo en la
  redacción de CA-13**: la propiedad («44 es 44») se exige aquí, pero **el cambio en
  `medirAreaTactil` no se implementa en esta spec** (ADR-035 §5, `F-ADR-035-1`).
- **SPEC-007** (fondo, no distintivo) y **SPEC-041 CA-11** (el control de orden fuera de
  `.table-scroll`): se **respetan y se trasladan**, no se reabren.

## Fuera de alcance

Aparcado a propósito, no por descuido. **Dentro** están sólo `src/app/vigiladas/*`,
`src/app/cartera/page.tsx` con sus formularios, y los bloques de `src/app/globals.css` que
sirven a esas dos páginas.

- **La navegación global** (`src/app/app-nav.tsx`, `.app-nav`, `.app-nav-links`). Tiene ya su
  ajuste a 720 px y sus guardias; tocarla mete en el diff una superficie compartida por todas
  las páginas.
- **`/avisos`** y su lista de notificaciones (`.notif-item`, `.notif-actions`).
- **El import de extracto** (`/cartera/importar`, `.import-buckets`, `.import-valor-head`).
  Comparte página madre con cartera pero es su propio flujo, con su propia spec y sus propias
  medidas.
- **`/cuenta`**, **`/admin`** y las **páginas legales** (`/legal/*`), más `/ayuda`, `/`,
  `/login` y `/register`. Todas tienen ya guardia responsive propia
  (`cuenta-responsive`, `admin-responsive`, `ayuda-responsive`, `pie-responsive`) y ninguna
  tiene tabla de datos.
- **El pie** (`.app-footer`) y el panel de teselas de `/dashboard` (`.cards`). El segundo es
  quien usa el breakpoint de densidad 599/600, que **se queda como está** (ADR-034 §2).
- **`viewport-fit=cover` y las áreas seguras.** Hoy son inertes porque `layout.tsx` no exporta
  `viewport`; activarlas extendería el lienzo bajo el notch en **todas** las páginas a la vez.
  Parado con motivo en ADR-034 §8 y anotado como **F-ADR-034-1**.
- **Un componente genérico de tabla responsive.** Hay dos tablas y son muy distintas;
  generalizar sobre dos casos produce una abstracción que encaja mal en los dos. Lo que sí se
  comparte desde el primer día es la **medida** (M5) y la **descripción de columnas**. A la
  tercera tabla, se revisa (ADR-034, alternativas).
- **Filtrar, agrupar o recordar preferencias.** Lo primero es capacidad nueva; lo tercero lo
  excluye `_epica.md` por escrito (*«Preferencias de usuario persistidas»*).
- **Gestos táctiles** (deslizar para borrar, pulsación larga, tirar para refrescar). No están
  observados, no los pidió nadie y cada uno trae su propio problema de descubribilidad.
- **App nativa o PWA instalable.** Fuera por FOUNDATION (*«App móvil nativa»*).
- **Subir el suelo tipográfico por encima de 12 px.** Obligaría a rehacer la caja de
  `.quote-*` que SPEC-016 y SPEC-043 afinaron a `34ch`. Congelado, no elegido (ADR-034 §7).
- **Bajar de 360 px.** ADR-026 §3 lo dejó cerrado: *«a 320 px la tabla de datos y el
  formulario de alta no se ajustan, se rediseñan, y eso es una decisión de producto con su
  épica»*.
- **El cambio de `medirAreaTactil` que decide ADR-035** (dejar de restar `TOLERANCIA_PX` a un
  umbral declarado). La **propiedad** sí se exige aquí —CA-13 afirma el suelo contra 44 sin
  holgura— pero el arreglo del módulo compartido obliga a reejecutar las cinco medidas sobre
  **todas** las rutas medidas, y esta spec ya pasó dos rondas sin ningún rojo que ese cambio
  arregle. Entra en una spec propia de EPIC-007, y **antes** de que la spec 2 escriba guardias
  nuevas de M5: **`F-ADR-035-1`**.

## Notas para el gate humano

### 1. La premisa de los anchos era falsa, y conviene saberlo antes de aprobar

**360 y 390 ya se miden**, desde SPEC-040, y están en `ANCHOS` y en ADR-026 §3 — comprobado en
`origin/main` y en el worktree. No existe la lista `600/700/720/730/760/800` del encargo. **El
agujero real es otro y es mayor**: `/cartera` **no se mide a ningún ancho** porque no está en
el conjunto de rutas. La decisión se ejecuta como **CA-11**. Si al leer esto prefieres que
además se añada algún ancho nuevo, dilo aquí: es una línea, pero cada ancho multiplica la
suite por rutas y **retirar uno después es dejar una franja sin mirar**.

### 2. La franja 600–720 px pierde densidad, y es la única contrapartida real

Con el corte en 720, a **640 y 700 px** —tablet en vertical, ventana estrecha de escritorio—
verás **tarjetas donde hoy hay tabla**. Los tres motivos de elegir 720 están en ADR-034 §1 y
el que decide es que **el canto queda entre 700 y 730, dos anchos medidos adyacentes**,
mientras que con 600 caería en el hueco 390 → 640: **250 px que nadie mide, con el cambio de
representación dentro**. Aun así, si al verlo te sobra aire en esa franja, la salida **no es
un breakpoint nuevo**: es una segunda columna de tarjetas entre 600 y 720, o sea un
`grid-template-columns`. **Puedes pedirlo en este gate y no cambia ni un CA.**

### 3. Mira con lupa: dos árboles en el DOM

ADR-034 §3 monta cada tabla **dos veces** y oculta una con `display: none`. Es la decisión con
más coste y la comparé con las otras dos en el ADR (restilar la misma tabla con
`display: block`, y decidir en el cliente con `matchMedia`). El riesgo de verdad es la
**deriva**: que alguien añada una columna a la tabla y se olvide de la tarjeta. El antídoto es
que las dos formas salgan de **una sola descripción de columnas** y que **CA-6** lo compruebe
dato a dato. Si prefieres pagar el otro precio —una sola representación, decidida en el
cliente, con parpadeo en el primer pintado— este es el momento.

### 4. M5 va a pintar rojo, y eso es la medida funcionando

`.btn-sm` mide **≈31 px de alto** y es lo que usan *Editar*, *Quitar* y el botón de dirección
del orden. Con el suelo en 44 × 44, **esos tres controles no pasan hoy**. La salida legítima
es agrandarlos y apilarlos (ADR-026 §4); la salida prohibida es bajar el suelo de M5 hasta que
pase, que es `F-ADR-026-1` cumpliéndose por escrito. Y una precisión que el ADR hace y merece
tu atención: **44 × 44 es WCAG 2.2 nivel AAA** (SC 2.5.5); el mínimo **AA** es 24 × 24 (SC
2.5.8). Adoptamos 44 porque lo pediste y porque es un teléfono en una mano, **sabiendo que es
el listón alto**, no vendiéndolo como el mínimo.

### 5. Por qué esta spec ya no vive en EPIC-MEJORA — **resuelto: CE-M3 la expulsó**

Se conserva escrito porque **el porqué de la mudanza vale más que el resultado**, y porque es
el precedente de cómo se ejerce un criterio de épica contra una spec que ya estaba escrita.

`EPIC-MEJORA/_epica.md` dice, en **CE-M3**: *«Una mejora que necesita migración de esquema,
proveedor nuevo o decisión de arquitectura no es una mejora: es alcance nuevo. Medida: si la
spec necesita ADR nuevo, se replantea su encaje aquí»*. **Esta spec necesita un ADR nuevo
(ADR-034)**, así que el replanteo era obligatorio y lo llevé al gate.

**Mi lectura era que encajaba igual** —no hay esquema, ni proveedor, ni dato, ni cálculo, ni
regla; y ADR-026 y ADR-030 también nacieron de specs de presentación— y **el humano decidió en
contra el 2026-08-24**. Con motivo, y el motivo es mejor que mi lectura: EPIC-MEJORA es un
*bucket* de **roces sueltos**, cada uno con su «dónde se vio». Esto no es una lista de roces:
es **una superficie entera del producto que nunca se diseñó**, con un breakpoint de modo, una
regla de conmutación y un medidor nuevo detrás. Eso tiene forma de épica, no de caso — y de
hecho la épica que nació de aquí prevé **tres** specs, de las que ésta es sólo la primera.

Lo que aprendo y dejo anotado: **cuando una spec necesita un ADR, la pregunta correcta no es
«¿rompe algún criterio?» sino «¿de qué tamaño es la cosa que estoy decidiendo?»**. La mía
respondía a la primera.

### 6. Lo que NO he reabierto

El patrón (tarjeta por fila), el alcance (dos tablas + su entorno) y el boceto vienen de tu
gate del 2026-08-24 y están tal cual. Tampoco he reabierto SPEC-007 (el estado es fondo, no
distintivo), SPEC-041 CA-11 (el control de orden encima de la tabla) ni ADR-030 (la capa de
edición es un `<dialog>` anclado abajo): los tres se **trasladan** al formato tarjeta y CA-10,
CA-8 y CA-12 lo afirman.

### 7. Las cinco preguntas del gate — **todas resueltas el 2026-08-24**

Se conservan con su respuesta porque cada una fija un CA, y quien implemente necesita saber
que no son territorio libre.

1. **La franja 600–720 px** → **una columna de tarjetas.** No se añade un
   `grid-template-columns` de dos. Motivo del humano: el rango es minoritario en un producto
   que se prueba en móvil y en escritorio. Queda como salida documentada en el «fuera de
   alcance» de EPIC-007 por si molesta después, y sigue sin cambiar ningún CA. Fija **CA-3**.
2. **Densidad de la tarjeta de vigiladas** → **los cinco pares visibles**, como estaba escrito.
   El humano no pidió cambio y el argumento lo sostiene: esconder es la salida que ADR-026 §4
   cierra. Esto ha **subido de rango**: ya no es una decisión de esta spec sino **CE-4 de
   EPIC-007** (*«caber no se paga escondiendo»*), y por tanto vincula también a las specs 2 y 3
   de la épica. Fija **CA-6** y **CA-15**.
3. **El pie de la tarjeta** → **los dos botones repartidos al 50 %**, en **una sola fila**,
   cada uno la mitad del ancho menos el hueco, y cumpliendo el suelo de 44 px de alto. Motivo:
   mantiene la tarjeta **corta**, que es lo que importa con cuarenta vigiladas. Fija **CA-20**,
   que es nuevo y sustituye a la ambigüedad que esta pregunta dejaba en CA-13.
4. **Orden respecto a SPEC-045** (silenciar, tercera acción) → **SPEC-054 primero**,
   confirmado, y anotado como **R-4 de EPIC-007**. SPEC-045 **hereda** este pie de tarjeta y
   quien la implemente debe leer ADR-034. **La consecuencia aritmética se dice ahora y no en
   SPEC-045**: a 360 px, descontado el margen de página y el relleno de la tarjeta, el ancho
   útil ronda los 300 px, así que **tres** controles al 50 % no caben —serían ~95 px cada uno,
   por debajo del suelo de 44 px sólo si se midiera el alto, pero muy por debajo de lo legible
   a lo ancho—. La salida cuando llegue la tercera acción es **dos arriba y una abajo**, o las
   tres apiladas; **no** es encoger los tres ni esconder ninguno (ADR-026 §4). Queda escrito en
   **ADR-034 §10** para que SPEC-045 lo encuentre hecho y no lo redescubra.
5. **`/cartera` no la ve el rol `tester`** (CE-2 de **EPIC-004**, no de esta épica) → **se
   entrega entera**, las dos tablas en la misma spec. No se parte.

### 8. Lo que quedaba abierto contra los criterios de la épica — **dos de tres, cerrados**

La **rejilla de trazabilidad** dejaba tres cosas para sdd-producto. **Dos se cerraron el
2026-08-24 con la creación de CE-7**; la tercera sigue abierta a propósito y no bloquea nada.
Se conservan con su resolución porque el porqué vale más que el resultado:

- ⏳ **CE-2 lo cubro sólo parcialmente, y la épica ya lo dice así a propósito — sigue
  abierto.** CA-11 mete
  `/cartera` en la guardia, pero CE-2 pide que *«el conjunto de rutas que la guardia mide sea
  el conjunto de rutas que el usuario puede alcanzar»*, **derivado por un test y no una lista
  mantenida a mano**. Esta spec deja **diez** rutas medidas de dieciséis y **sigue siendo una
  lista**. Cerrarlo entero es la spec 3. Lo digo aquí para que nadie lea CA-11 como si saldara
  CE-2.
- ✅ **EPIC-007 no tenía criterio de accesibilidad — ya lo tiene: CE-7.** Esta spec tiene
  **tres CA que sólo se justifican por ahí**: CA-7 (`aria-sort` desaparece con la tabla), CA-8
  (el orden se sigue anunciando y se sigue pudiendo cambiar) y CA-9 (orden de lectura = orden
  del DOM). Colgaban de **CE-4** leído con generosidad —para quien usa lector de pantalla, el
  estado de orden *es* un dato que la vista ancha enseña— y lo dije en vez de disimularlo.
  **sdd-producto añadió CE-7 a EPIC-007 el 2026-08-24** —*«cambiar de forma no cambia lo que la
  pantalla significa»*: semántica, orden de lectura, foco y teclado, más el suelo tipográfico—
  y los tres CA **se reapuntan a CE-7** en la rejilla de la nota 9.
- ✅ **CE-3 es táctil, no tipográfico, y CA-14 ya tiene sitio.** **CA-14** —controles de
  formulario ≥ 16 px para no disparar el zoom de iOS, y ningún texto por debajo de 12 px—
  encajaba en CE-3 sólo por vecindad, porque el umbral de 16 px es de **interacción con el
  navegador**, no de tamaño de dedo. **CE-7 lo recoge por escrito** (*«el texto se puede leer
  sin ampliar — suelo de 16 px en los controles de formulario… y ningún texto por debajo de
  12 px»*), así que **CA-14 se reapunta a CE-7** y deja de estar sin CE.
Y una nota de higiene: **CA-19** (evidencia bajo `_qa/SPEC-054/`, cifras deterministas y
capturas ilustrativas) sigue **sin colgar de ningún CE a propósito** — es convención del
proyecto y ADR-026 §6, no criterio de la épica.

### 9. Rejilla de trazabilidad CA → CE de EPIC-007

**Actualizada el 2026-08-24**, contra los **siete** criterios de la épica: CE-7 se añadió
después de escribirse esta rejilla y **CA-7, CA-8, CA-9 y CA-14 cuelgan ahora de él**, que es
donde siempre debieron colgar (nota 8). Ninguno de los cuatro cambia de contenido: cambia de
qué criterio de épica responde.

| CE de EPIC-007 | CA que lo sostienen |
|---|---|
| **CE-1** — ninguna pantalla desborda en un teléfono | CA-4, CA-5, CA-12, CA-15, CA-17, CA-21 |
| **CE-2** — lo que no se mide no cuenta *(**parcial**: 10 de 16 rutas, y aún es lista)* | CA-11 |
| **CE-3** — se puede operar con el pulgar (44×44) | CA-13, CA-17, CA-20 |
| **CE-4** — caber no se paga escondiendo | CA-3, CA-6, CA-10, CA-15, CA-21 |
| **CE-5** — el escritorio no paga la factura del móvil | CA-5, CA-16 |
| **CE-6** — un solo breakpoint de modo | CA-1, CA-2, CA-18 |
| **CE-7** — cambiar de forma no cambia lo que la pantalla significa | CA-7, CA-8, CA-9, CA-14 |
| *(sin CE — convención de proyecto y ADR-026 §6)* | CA-19 |

**Los siete criterios de la épica están tocados por esta spec**, tres de ellos sólo en parte
(CE-2 por diseño, y CE-3 y CE-7 porque las specs 2 y 3 llevan el grueso). **Ningún CA queda
sin criterio salvo CA-19**, que es convención y lo dice.
