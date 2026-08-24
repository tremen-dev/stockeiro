---
id: ADR-034
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-24, por: sdd-arquitecto}
aprobada-por:
---
# ADR-034: La tabla de datos conmuta a tarjetas por debajo de 720 px, que es el único breakpoint de **modo** del producto, y el área táctil se mide

- Deciders: propone **sdd-arquitecto** (2026-08-24) al escribir **SPEC-054**, sobre la
  petición literal del humano (Alberto Fojo) ese mismo día: *«necesito que la vista sea
  adaptada a movil. sobre todo la tabla, hay que ver opciones que permitan que se vea
  correctamente, siguiendo los estándares de UI/UX para mobile»*. El **patrón** (tarjeta por
  fila) y el **alcance** (las dos tablas y lo que las rodea) los fijó el humano en el gate de
  orquestación del 2026-08-24 y **no se reabren aquí**. Lo que este ADR decide es lo que
  aquella conversación dejó abierto: **en qué ancho conmuta**, **cómo conviven las tres
  familias de breakpoint que hay hoy en el árbol**, **cómo se representan las dos formas sin
  que se separen** y **qué medida nueva entra en el módulo compartido**. Pendiente de
  aprobación por el humano. **No es una decisión de producto ni de stack**: es una decisión
  sobre **cómo se presenta una tabla de datos cuando no cabe** y sobre **qué más mide la
  geometría**.
- Épica: **EPIC-007 — La app en el teléfono**. Este ADR fija su **CE-6** (un solo breakpoint de modo) y crea el medidor de su **CE-3** (área táctil), así que constriñe a las **tres** specs de la épica, no sólo a la primera.
- Specs relacionadas: la origina y la consume **SPEC-054**. **Precisa —no supersede—
  ADR-026**, del que hereda las tres medidas horizontales, el módulo único y los ocho anchos,
  y del que ejerce por segunda vez el §2 (*«una spec que necesite un invariante que no existe
  lo aporta al módulo»*). **No toca ADR-030**: la capa de edición sigue siendo un `<dialog>`
  anclado al borde inferior, y M4 sigue midiéndola igual — lo único que cambia es **sobre qué
  se abre** en móvil. Reinterpreta la colocación que fijó **SPEC-041 CA-11** (el control de
  orden encima de la tabla) sin invalidar su motivo, y hereda la caja acotada que
  **SPEC-016 / SPEC-043** pusieron a `.quote-fail`, `.quote-pending` y `.quote-stale`.

## Contexto

**El producto se va a compartir en un foro de bolsa con testers externos, y su pantalla
principal en un teléfono es una tabla de nueve columnas que hay que arrastrar de lado.**

Los hechos del árbol, medidos antes de escribir esto y no supuestos:

1. **Las dos tablas del producto son anchas por decisiones ya tomadas y buenas.**
   `src/app/vigiladas/watched-table.tsx` tiene **nueve** columnas; `.data-table` declara
   `width: 100%` (`src/app/globals.css:384`) pero con `table-layout: auto` eso es un **suelo**,
   no un techo: la anchura real es el máximo entre ese 100 % y la suma de los mínimos de las
   columnas. Aquí esa suma es grande **a propósito** — `padding: 12–14px 16px` en `th`/`td`
   son **288 px sólo de relleno**, `.activo-caja` lleva `min-width`, `.estado-caja` un
   `max-width: 170px` con el motivo de SPEC-016 envuelto dentro, y `.zone-label` es
   `white-space: nowrap` para que «En compra y venta» no se parta. `src/app/cartera/page.tsx`
   tiene **cinco** columnas, cuatro de ellas numéricas en tipografía monoespaciada. ADR-030 ya
   dejó esta aritmética escrita en su hecho 1 y **no ha cambiado**.

2. **Hoy la única respuesta a esa anchura es arrastrar.** `.table-scroll { overflow-x: auto }`
   (`globals.css:509`) es la segunda salida legítima de **ADR-026 §4** y está bien puesta: fue
   **SPEC-040 CA-5** quien la sacó del `@media (max-width: 720px)` porque entre 721 y 800 px no
   había contenedor que absorbiera la tabla y la absorbía el documento. Es correcta y **no se
   toca**. Lo que este ADR observa es otra cosa: *«que quepa»* y *«que se desplace en su
   caja»* son las dos salidas de ADR-026 §4 ante un **desborde**, y las dos son válidas — pero
   en un teléfono, la segunda convierte la lectura de una fila en **un gesto de exploración
   por columna**. ADR-030 ya documentó la consecuencia más aguda de eso en su hecho 2: cuando
   pulsas *Editar*, que vive en la **novena** columna, **el `scrollLeft` está al máximo**, y
   por tanto lo que se ve de la fila **no es lo que la fila dice**.

3. **Hay tres familias de breakpoint conviviendo, y ninguna está declarada como la del
   producto.** Comprobado sobre el árbol:
   - **720 px** — `design/tremen-ds/responsive.css:9` (*«Single breakpoint mobile pass»*, y
     ahí dentro `html, body { overflow-x: hidden }` y los cambios de eje sobre selectores de
     elemento que costaron `F-SPEC-035-11`), más **cinco** bloques en `src/app/globals.css`
     (líneas 515, 695, 1043, 1215 y 1429). Es, de facto, **el ancho en que la app entra en
     modo móvil**.
   - **599 / 600 px** — `globals.css:300` y `:304`, y su único efecto es
     `.cards { grid-template-columns: … }`: una y dos columnas de teselas en el panel. No
     cambia de modo nada: cambia **densidad**.
   - **380 px** — `design/tremen-ds/responsive.css:192`, un apretón tipográfico para teléfonos
     muy pequeños. Tampoco cambia de modo nada.

4. **La premisa de que «el móvil real no se mide» era falsa, y conviene dejarlo por escrito
   porque llegó al gate.** `tests/e2e/geometria.ts:66` declara
   `ANCHOS = [360, 390, 640, 700, 730, 760, 800, 1280]`, idéntico en `origin/main` y en el
   worktree, y coincidente con **ADR-026 §3**. **360 y 390 llevan medidos desde SPEC-040.** No
   hay ninguna lista `600/700/720/730/760/800` en el repositorio.
   **Lo que sí falta es otra cosa, y es peor:** el conjunto de rutas de
   `tests/e2e/geometria-rutas.spec.ts` es `/`, `/ayuda`, `/legal`, `/login`, `/register`,
   `/dashboard`, `/vigiladas`, `/avisos`, `/cuenta`. **`/cartera` no está.** Una de las dos
   tablas del producto **no se mide a ningún ancho**, y no por un hueco entre dos anchos sino
   por ausencia de la superficie entera. Es la misma lección de ADR-026 §3 —*«un defecto que
   sólo existe entre dos anchos medidos es un defecto que nadie mide»*— en su versión de
   ruta.

5. **Las cuatro medidas de hoy preguntan por la caja y por el gesto, nunca por el dedo.** M1,
   M2 y M3 (ADR-026) preguntan *«¿cabe a lo ancho?»*; M4 (ADR-030) pregunta *«¿lo ve quien
   acaba de pulsar?»*. Ninguna pregunta *«¿se puede pulsar?»*. Y el árbol da un número
   concreto: `.btn-sm` es `padding: 8px 14px` con `font: 600 13px/1`
   (`globals.css:483-493`), o sea una caja de **≈31 px de alto** — los dos controles de cada
   fila de `/vigiladas` (*Editar* y *Quitar*) y el de dirección del orden. Está por debajo de
   cualquier suelo táctil publicado, y **la suite entera está verde**.

Debajo de todo esto hay **un problema y no cuatro**, y es el que la decisión ataca: **la app
no tiene declarado qué significa «modo móvil»**. Cada spec eligió el `@media` que le vino
bien —599, 600, 720— y cada uno era defendible por su cuenta. Mientras lo que cambiaba era
densidad, convivir salía gratis. En el momento en que algo cambia de **representación**, un
breakpoint sin dueño deja una franja en la que la app cree una cosa y el sistema de diseño
otra: exactamente la frontera sin escribir de la que nació `F-SPEC-035-11`.

## Decisión

### 1. **720 px es el breakpoint de MODO del producto.** Por debajo, la tabla de datos se presenta como tarjetas; por encima, como tabla

Un único ancho gobierna el cambio de **representación** en toda la app: `max-width: 720px`
es móvil, `min-width: 721px` es tabla. Se elige 720 —y no 599/600, que era el otro candidato
razonable— por **tres motivos, y el tercero es el que decide**:

- **Es donde el sistema de diseño ya cambia de modo, y lo hace EN EJECUCIÓN.**
  `design/tremen-ds/responsive.css` se describe a sí mismo como *«single breakpoint mobile
  pass»* a 720 px, y ahí dentro activa `html, body { overflow-x: hidden }` y cambia ejes sobre
  selectores de elemento. Elegir otro ancho crearía una franja —600–720 px— en la que **la app
  se cree escritorio y el sistema ya se cree móvil**. Esa discrepancia no es teórica: es
  literalmente el mecanismo de `F-SPEC-035-11`, donde `.app-footer` heredó un eje que no
  esperaba y midió 452 px con 280 de hueco muerto en todas las pantallas de móvil y tablet.

  > **Nota de verificación, escrita porque en el gate se puso en duda.** Se sostuvo que ese
  > fichero *«no lo carga la app»* y que `design/` es sólo material de referencia. **Se
  > comprobó y es incorrecto.** La cadena de carga es de tres saltos y está entera en el
  > árbol:
  >
  > ```
  > src/app/layout.tsx:5           import './globals.css'
  > src/app/globals.css:3          @import '../../design/tremen-ds/components/index.css'
  > .../components/index.css:26    @import url('../responsive.css')
  > ```
  >
  > La cabecera del propio `index.css` lo dice sin ambigüedad: *«Includes tokens
  > (colors_and_type.css) + every component partial **+ the responsive overrides**. Source
  > order matters»*. Next inlina los `@import` anidados en build, así que `responsive.css`
  > llega al navegador.
  >
  > Y hay **prueba empírica**, no sólo de lectura: todo `V-SPEC-039-6` —el botón «Vigilar»
  > fuera de la pantalla a 390 px que originó ADR-026— **se explica por ese
  > `overflow-x: hidden`**, y `tests/e2e/geometria.ts` documenta la medición que lo confirma
  > (un `<div>` de 900 px colgado de `.frame` a 360 px daba **0** violaciones en M1 y
  > `scrollWidth` **360**, *«lo tapa el `overflow-x: hidden` del sistema de diseño»*). Si el
  > fichero no se cargara, ese comportamiento medido no existiría y **ADR-026 estaría
  > construido sobre una premisa falsa** — no lo está.
  >
  > Lo que sí es cierto de la objeción: SPEC-035 CA-12 sacó un `@import` a `fonts.googleapis`
  > que el sistema traía, y el comentario de `layout.tsx:8-20` lo cuenta en pasado. Eso fue
  > **la petición de tipografías a un tercero**, no el sistema de diseño entero, que sigue
  > importado desde `globals.css:3`. **Confundir las dos cosas es el origen del malentendido**
  > y por eso queda escrito aquí.

  Aun así, y para que este motivo se pese por lo que vale: **es el más débil de los tres**.
  Es un argumento de **coherencia** —conviene que la app y el CSS del que deriva corten en el
  mismo sitio— y si mañana `tremen-ds` dejara de cargarse, seguiría en pie por los otros dos.
  **El que decide es el tercero**, y ése es del código de la app y de su guardia.
- **Es donde la app ya cambia de modo cinco veces.** Los cinco bloques de `globals.css`
  (nav, notificaciones, *buckets* de import, zona de peligro, la primera pantalla) ya usan
  720. Elegir 600 añadiría un **cuarto** valor a un árbol que tiene tres.
- **Es el único candidato cuyo canto queda entre dos anchos medidos ADYACENTES.** Los ocho
  anchos del proyecto son 360, 390, 640, 700, 730, 760, 800 y 1280. Con el corte en 720, el
  canto cae entre **700** (última tarjeta) y **730** (primera tabla): dos anchos consecutivos,
  a 30 px uno del otro, y **730 existe precisamente porque SPEC-040 descubrió que el hueco
  700–760 escondía un defecto**. Con el corte en 599/600, el canto caería en el hueco
  **390 → 640**: 250 px en los que nadie mira, con el cambio de representación dentro. Es
  ADR-026 §3 aplicado a una decisión nueva en vez de recordado después.

**Contrapartida aceptada y dicha:** a 640 y 700 px —tablet en vertical, ventana estrecha de
escritorio— se verá una lista de tarjetas donde hoy hay una tabla que ahí **ya se arrastra
igual** (por el hecho 1, la de nueve columnas no cabe en 700). No es una regresión de
información, pero sí una decisión de densidad. **Resuelto por el humano en el gate del
2026-08-24: una sola columna en toda la franja**, porque el rango es minoritario en un producto
que se prueba en móvil y en escritorio. La salida por si algún día molesta queda documentada
—una segunda columna entre 600 y 720, que es un `grid-template-columns` y **no** un breakpoint
nuevo— y está en el «fuera de alcance» de EPIC-007.

### 2. **599/600 y 380 se quedan, y se quedan degradados a lo que son: breakpoints de DENSIDAD**

No se unifican y no se borran. Se les escribe el dominio que tienen:

> **Un breakpoint de modo cambia qué elementos existen. Un breakpoint de densidad cambia
> cuántos caben en una línea o cuánto miden. Sólo hay un breakpoint de modo —720 px— y sólo
> él puede hacer aparecer o desaparecer una representación.**

`599/600` reparte teselas de `.cards` en una o dos columnas; `380` aprieta tipografía del
sistema. Ninguno hace aparecer ni desaparecer nada, así que ninguno entra en conflicto.
Unificarlos ahora significaría cambiar el reparto del panel de `/dashboard` —superficie que
esta spec no toca— para ganar coherencia estética, y **eso es tocar lo que funciona por
simetría**, que no es motivo.

**Lo que sí queda prohibido**: que aparezca un **cuarto** valor. Un `@media` nuevo en
`src/app/` usa 720 si cambia el modo, y si necesita otro ancho para cambiar densidad, lo
justifica por escrito en el sitio.

### 3. Las dos representaciones son **dos árboles**, alternados por CSS, y **derivadas de la misma fuente**

La tabla se queda **exactamente como está** —`<table>`, `<thead>`, `<th>` con `aria-sort`— y
al lado se monta una lista de tarjetas (`<ul>`/`<li>`, con los pares etiqueta-valor en
`<dl>`/`<dt>`/`<dd>`). El `@media` de 720 px pone `display: none` a la que no toca.

Las tres alternativas y por qué esta:

- **Restilar la misma `<table>` con `display: block` en `tr`/`td` y `::before` con la
  etiqueta.** Es el patrón clásico y **se rechaza**: al sobrescribir `display` los motores
  dejan caer los roles de tabla del árbol de accesibilidad, con lo que queda una lista de
  celdas sin cabecera que las nombre. Recuperarlo exige repintar `role="table|row|cell"` a
  mano y entonces el lector anuncia *«tabla»* sobre algo que ya no lo es y cuyas cabeceras no
  se ven. Y las etiquetas en `content:` de un pseudoelemento **no son texto seleccionable ni
  copiable**, que en una pantalla de precios y rangos importa.
- **Renderizar una sola representación decidiendo el ancho en el cliente
  (`matchMedia` + estado).** Se rechaza: el servidor no sabe el ancho, así que o se pinta la
  tabla y se cambia al montar —parpadeo garantizado en todos los teléfonos— o se acepta un
  desajuste de hidratación. Además ataría la representación a que haya JavaScript, y hoy
  `/cartera` **es Server Component** y se pinta sin él.
- **Dos árboles con `display: none` (elegida).** Coste real: el DOM de la lista se duplica.
  A cambio: cada forma usa el marcado **nativamente correcto** para lo que es, no hay
  parpadeo, no hay desajuste de hidratación, y `display: none` **retira de verdad** del árbol
  de accesibilidad —así que en cada ancho hay **una** representación y no dos.

**Y el coste tiene su antídoto escrito, porque es el riesgo de verdad:** dos árboles se
separan. Por eso la decisión no es sólo «dos árboles» sino **dos árboles derivados de una
sola descripción de las columnas**: una estructura por tabla que dice, por columna, su rótulo
y cómo se saca su valor de la fila, y de la que se pintan **las dos** formas. Añadir una
columna a la tabla y olvidarse de la tarjeta deja de ser posible por construcción, y la
guardia lo comprueba además por su efecto (SPEC-054 CA-6): **todo dato visible en una fila lo
es en su tarjeta, y con el mismo rótulo**.

### 4. Al conmutar de tabla a lista, **la semántica no se traduce: se sustituye por la que corresponde**

Tres consecuencias, y las tres son afirmables:

- **`aria-sort` es de una tabla.** Por debajo de 720 px **ningún** elemento del documento
  declara `aria-sort`: anunciar el orden de una tabla que no está en el árbol es informar
  sobre algo que quien escucha no puede alcanzar. El estado de orden lo sigue comunicando
  `.orden-control`, que vive **fuera** de `.table-scroll` desde SPEC-041 CA-11 —por un motivo
  que este ADR confirma en vez de invalidar: *«un control encima de la tabla se ve siempre y
  no exige un gesto para encontrar el gesto»*— y que es visible **a todos los anchos**. Su
  `<select>` dice el criterio y su botón dice la dirección con `aria-pressed`.
- **Los `<th>` se convierten en los `<dt>` de cada tarjeta**, con el **mismo texto**. Es lo
  que sustituye a la asociación cabecera-celda que da la tabla, y es nativa: `<dl>` asocia
  término y descripción sin ARIA.
- **El orden de lectura de la tarjeta es el del boceto que aprobó el humano**: identidad
  (ticker y nombre) → estado → los pares etiqueta-valor → acciones. Es el orden del DOM, así
  que el lector de pantalla y el tabulador recorren lo mismo que el ojo, y no hay ni una
  propiedad de CSS reordenando nada (`order`, `grid-row`, `direction`). Que el orden visual y
  el del DOM coincidan **es afirmable** y se afirma.

### 5. **El estado de zona sigue siendo color de FONDO** (SPEC-007), y en la tarjeta el fondo es el de la tarjeta

`zone-${state}` deja de pintar un `<tr>` y pasa a pintar la tarjeta entera, con **el mismo
color computado**. No se convierte en un distintivo, ni en un borde, ni en un icono: SPEC-007
decidió fondo y esta spec **no reabre** esa decisión, la traslada. La etiqueta de texto
`.zone-label.is-${state}` sigue acompañándolo, porque el color nunca fue la única señal.

### 6. **M5 — el área táctil**, en el módulo compartido, con el suelo en **44 × 44 px CSS**

Quinta medida de la geometría del proyecto, en `tests/e2e/geometria.ts` junto a M1–M4:

> Por debajo del breakpoint de modo, todo elemento interactivo visible (`a[href]`, `button`,
> `input`, `select`, `textarea`, `[role="button"]`, `summary`) tiene una caja de al menos
> **44 × 44 px CSS**, contando el área ampliada por pseudoelementos si la hay, y no se solapa
> con la de otro control.

**Y la fuente se cita con precisión, que es la mitad del valor de escribirlo:** 44 × 44 px es
**WCAG 2.2 SC 2.5.5 *Target Size (Enhanced)*, nivel AAA**, y coincide con los 44 pt de las
*Apple Human Interface Guidelines*; el mínimo de **nivel AA** es **SC 2.5.8 *Target Size
(Minimum)*, 24 × 24 px**, y Material Design pide 48 dp. **El proyecto adopta 44 y no 24**
porque lo pidió el humano y porque la superficie es un teléfono sostenido con una mano
mientras se mira un precio; pero se adopta **sabiendo que es el listón AAA**, no vendiendo un
AAA como si fuera el mínimo legal. Esa distinción importa el día que alguien tenga que
decidir si una excepción es una infracción de accesibilidad o una decisión de producto.

M5 es **complementaria**, nunca sustituta: un control de 44 × 44 también tiene que caber a lo
ancho (M1) y no partir su rótulo (M3). Y hereda la regla de ADR-026 §4: si dos controles de
44 no caben en una línea, la salida es **apilarlos**, nunca encogerlos ni esconderlos.

### 7. La legibilidad tiene dos suelos, y **sólo uno de ellos es negociable**

- **Todo control de formulario** (`input`, `select`, `textarea`) tiene, por debajo de 720 px,
  un `font-size` computado de **al menos 16 px**. No es estética: por debajo de 16 px, Safari
  en iOS **amplía la página al enfocar el campo** y no la devuelve, con lo que el usuario
  acaba en una vista desplazada de la que tiene que salir a mano. Es un defecto de
  interacción con causa conocida y umbral exacto.
- **Ningún texto baja de 12 px.** Es el suelo **que el proyecto ya tiene**
  (`.quote-fail`/`.quote-pending`/`.quote-stale`, `globals.css:701-703`) y esta spec lo
  **congela, no lo sube**: subirlo obligaría a rehacer una caja que SPEC-016 y SPEC-043
  afinaron a `max-width: 34ch` precisamente porque *«esta tabla YA se rompió una vez por un
  párrafo de motivo que se extendía en vez de envolverse»*. WCAG **no fija un tamaño mínimo
  de fuente** —lo que fija es SC 1.4.4 *Resize Text* (AA): que el texto llegue al 200 % sin
  pérdida de contenido ni de función— y decir lo contrario sería inventarse una norma.

### 8. Las **áreas seguras** se nombran y se dejan inertes, a propósito

`src/app/layout.tsx` **no exporta `viewport`**, así que Next emite el suyo por defecto
(`width=device-width, initial-scale=1`) **sin `viewport-fit=cover`**. Sin esa bandera,
`env(safe-area-inset-*)` resuelve a **0** y el navegador reserva por su cuenta la franja del
notch y de la barra de gestos. Es decir: **hoy no hay problema de área segura, porque la app
no ha pedido pintar debajo del notch.**

**Este ADR decide no pedirlo.** Añadir `viewport-fit=cover` extendería el lienzo bajo el
notch **en todas las páginas a la vez** —incluidas las públicas, las legales y la capa
`<dialog>` de ADR-030— y convertiría un cambio acotado en una auditoría de superficies que
nadie ha medido. Es palabra por palabra la objeción con la que ADR-026 rechazó quitar el
`overflow-x: hidden` del sistema de diseño. Queda como **F-ADR-034-1**: si algún día se
adopta `viewport-fit=cover`, el primer sitio que hay que rellenar con `env()` es el borde
inferior del `<dialog>` de ADR-030, que es lo único del producto pegado al canto de la
pantalla.

### 9. **`/cartera` entra en el conjunto de rutas medidas**

No como CA suelto de esta spec sino como corrección del conjunto: una superficie del producto
con una tabla dentro que no se mide a ningún ancho es un agujero de la misma familia que el
hueco 700–760 de SPEC-040, sólo que más grande. Entra con las demás y a los ocho anchos.

### 10. El **pie de la tarjeta**: dos controles al 50 %, y lo que eso le deja a la tercera acción

Los controles de una tarjeta van **repartidos al 50 % en una sola fila**, cada uno la mitad del
ancho del pie menos el hueco, y cada uno cumpliendo M5. Lo decidió el humano en el gate del
2026-08-24 frente a la alternativa de apilarlos, y el motivo es de lectura, no de estética:
**mantiene la tarjeta corta**, y con cuarenta vigiladas el alto de la tarjeta es el coste que
paga el usuario en cada recorrido de la lista.

**Y aquí se dice lo que le va a pasar a la tercera acción, para que no se descubra en la spec
que la traiga.** SPEC-045 (silenciar) añade un control más a la misma superficie, y entra
**detrás** de SPEC-054 por decisión del roadmap (**R-4 de EPIC-007**). La aritmética a 360 px:
descontados el margen de la página y el relleno de la tarjeta, el ancho útil del pie ronda los
**300 px**. Con dos controles al 50 % salen ~146 px cada uno, cómodos. **Con tres salen ~95**,
y un botón de 95 px con un rótulo como «Silenciar» queda al filo de partir palabra (M3) aunque
M5 lo dé por bueno, porque **M5 mide la caja y M3 mide el rótulo**.

Así que la regla para la tercera acción queda escrita **ahora**: cuando el pie pase de dos
controles, la salida es **apilar** —dos arriba y uno abajo, o los tres en columna—, nunca
encoger los tres por debajo de lo que su rótulo necesita y nunca esconder ninguno detrás de un
menú (ADR-026 §4). Quien implemente SPEC-045 no tiene que redescubrir esto ni volver al gate a
por ello.

## Consecuencias

### Positivas

- **La pantalla principal del producto deja de exigir un gesto para leer una fila.** El caso
  que ADR-030 documentó en su hecho 2 —que en el instante del clic lo que se ve de la fila no
  es lo que la fila dice— **desaparece por construcción** en móvil: no hay `scrollLeft` que
  valga cuando no hay desplazamiento horizontal.
- **El proyecto pasa a tener un breakpoint con dueño.** «¿Es esto móvil?» deja de ser una
  pregunta que cada spec responde por su cuenta, y la respuesta es citable en una revisión.
- **La geometría pasa a tener las tres preguntas escritas**: *«¿cabe?»* (M1, M2, M3),
  *«¿lo ve quien acaba de pulsar?»* (M4) y *«¿se puede pulsar?»* (M5). Y M5 nace en el
  módulo, así que la hereda la spec siguiente sin copiar nada.
- **`/cartera` deja de ser un punto ciego** después de haber tenido tabla desde SPEC-002.
- **`.table-scroll` sobrevive con su motivo intacto.** Por encima de 720 px sigue siendo la
  segunda salida de ADR-026 §4, declarada a todos los anchos, tal como la dejó SPEC-040 CA-5.

### Negativas / follow-ups

- **El DOM de las listas se duplica**, y en `/vigiladas` con cuarenta filas eso son varios
  cientos de nodos que en cada ancho están a medias ocultos. Se acepta a cambio del marcado
  correcto en las dos formas, y se acota: la duplicación es **de marcado**, nunca de consulta
  ni de cálculo (CE-5 de EPIC-007).
- **Dos árboles se pueden separar.** Es el riesgo principal y por eso el pto. 3 no se
  conforma con «dos árboles»: exige la descripción de columnas compartida y una guardia que
  compare dato a dato. Si alguna vez alguien pinta una tarjeta a mano saltándose esa
  estructura, la guardia lo dice — pero **conviene mirarlo en cada revisión que añada una
  columna**. Queda como **F-ADR-034-2**.
- **La franja 600–720 px pierde densidad.** Llevado al gate como pregunta abierta y
  **resuelto allí el 2026-08-24: una sola columna**. Se asume a sabiendas, con la salida
  documentada (una segunda columna, que es un `grid-template-columns` y no un breakpoint
  nuevo) por si el uso real la reclama.
- **M5 va a pintar rojo el día que entre**, y en sitios que hoy nadie considera rotos:
  `.btn-sm` mide ≈31 px de alto y se usa en las dos acciones de cada fila de `/vigiladas` y en
  el botón de dirección del orden. Eso **no es un efecto colateral**: es la medida
  funcionando. Lo que no se acepta es la salida barata —subir el suelo de M5 hasta que pase—,
  que es `F-ADR-026-1` cumpliéndose por escrito. Las holguras son de cada guardia y con
  motivo.
- **Se acepta un suelo tipográfico de 12 px** que no todo el mundo defendería. Está congelado,
  no elegido: subirlo es rehacer una caja afinada por dos specs y entra por su propia spec.
- **F-ADR-034-1** — `viewport-fit=cover` y las áreas seguras, parados a propósito (pto. 8).
- **F-ADR-034-3** — este ADR decide la conmutación **de una tabla de datos**. No dice nada de
  las demás superficies (formularios de página completa, el panel de teselas, la ayuda, el
  import de extracto), que siguen como están con razón. Si alguna llega a tener el mismo
  problema se decide entonces; **no se extiende esta decisión por analogía**, que es la misma
  cautela que puso ADR-030 en su `F-ADR-030-2`.
- **Tres superficies nuevas que medir a los ocho anchos** (la lista de tarjetas de vigiladas,
  la de cartera y `/cartera` entera), con su coste de e2e. ADR-026 ya avisó de que la suite
  crece por spec, y su salida declarada si el tiempo aprieta es **reducir anchos por ruta**,
  nunca volver a una medida ciega.

## Alternativas consideradas

- **No conmutar: dejar `.table-scroll` y mejorar el arrastre** (sombras de borde, columna de
  ticker pegada con `position: sticky`). **Rechazada.** Es más barata y arregla la mitad
  visible del problema —saber qué fila estás mirando— pero no la otra: leer una fila entera
  sigue costando dos o tres gestos, y el control *Editar* sigue en la novena columna con lo
  que ADR-030 describió. Además `position: sticky` dentro de una tabla con
  `border-collapse: separate` y `overflow: hidden` en `.data-table` es frágil entre motores, y
  cambiar eso toca la caja que SPEC-007 y SPEC-041 dejaron afinada.

- **Reducir columnas en móvil: esconder las menos importantes.** **Rechazada, y es la
  tentación fuerte.** Es lo que hace medio internet y sale casi gratis. Pero esconder es
  exactamente la salida que **ADR-026 §4** cierra: *«ante un desborde hay dos salidas
  legítimas —que quepa, o que el desplazamiento viva en un contenedor propio»*, y recortar
  contenido para que el número salga bien es *«la versión visual del fallo silencioso que
  CE-F2 de EPIC-FIX existe para erradicar»*. Peor aquí que en general: las columnas
  candidatas a esconderse serían Tipo, Mercado y «A fecha», y **Mercado es la mitad de la
  identidad del símbolo** (ADR-012 / ADR-007 — con el mismo ticker en dos mercados es lo único
  que distingue las dos filas, y cerrar eso costó `F-SPEC-024-1`), mientras que «A fecha» es
  **un no-negociable de FOUNDATION** (*«mostrar siempre el `asOf` / carácter diferido del
  dato»*, D-2). La tarjeta las lleva **todas**, y por eso el patrón es este y no el de
  esconder.

- **Cortar en 599/600 px en vez de en 720.** **Rechazada** por los dos motivos del pto. 1 que
  no son cuestión de gusto: dejaría la franja 600–720 con la app en modo escritorio y el
  sistema de diseño ya en su pasada móvil —el mecanismo exacto de `F-SPEC-035-11`— y pondría
  el canto de la conmutación en el hueco **390 → 640**, doscientos cincuenta píxeles que
  nadie mide, con el cambio de representación dentro. Su único argumento a favor —a 640 y 700
  se ve mejor una tabla que una tarjeta— es real y está recogido como pregunta abierta del
  gate, con una salida que **no necesita un breakpoint nuevo**.

- **Un breakpoint por componente** («la tabla de nueve columnas conmuta a 800, la de cinco a
  600, porque son de anchos distintos»). **Rechazada**, aunque sea la respuesta técnicamente
  más fina. Multiplica los anchos que hay que medir por el número de tablas, hace que el
  usuario vea la app cambiar de forma en dos sitios distintos al girar el teléfono, y devuelve
  el proyecto justo al estado del que este ADR lo saca: breakpoints sin dueño. Si algún día
  una tabla concreta necesita otro ancho, será una excepción **nombrada y con motivo**, no la
  regla.

- **Un componente genérico de tabla responsive que sirva a todo el producto.** **Rechazada por
  ahora, y sin cerrar la puerta.** Hay **dos** tablas y son muy distintas: nueve columnas con
  estado de zona, avisos de diagnóstico y dos acciones por fila una, cinco columnas numéricas
  la otra. Generalizar sobre dos casos produce una abstracción que encaja mal en los dos y
  cara de cambiar. Lo que **sí** se comparte desde el primer día es lo que ADR-026 §2 manda
  compartir: **la medida** (M5 en el módulo) y **la forma de describir columnas** (pto. 3).
  A la tercera tabla, se revisa.

- **Ampliar sólo la geometría y no tocar la presentación** («que M5 y las medidas señalen los
  problemas y que los arregle quien pueda»). **Rechazada** por el mismo motivo con el que
  ADR-030 rechazó su equivalente: con la tabla como está, esas guardias **nacen rojas y no se
  pueden poner verdes sin cambiar la presentación**. Escribir la medida sin la decisión es
  dejar el arreglo a la improvisación de quien implemente.

- **Comparación de imágenes para comprobar que la conmutación se ve bien.** **Rechazada por
  quinta vez en este proyecto**, con el motivo de ADR-026 §6 intacto: una captura se rompe al
  cambiar una fuente o un color —cosas que se cambian a propósito— y no se rompe cuando un
  control de 31 px de alto es imposible de pulsar con el pulgar. Se miden cajas.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
