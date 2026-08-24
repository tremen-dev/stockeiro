---
id: SPEC-054
tipo: ledger
epica: EPIC-007
---
# Ledger — SPEC-054 La interfaz en el teléfono: la tabla se lee como tarjetas por debajo de 720 px

## Resumen
- Fase: `en-revision` — **implementada**, pendiente de verificación. El gate humano dijo
  que sí el 2026-08-24 y el orquestador registró `aprobada`; sdd-implementador la pasó a
  `en-progreso` y, terminada la entrega, a `en-revision`.
- Rama: `ft/SPEC-054-la-interfaz-en-el-telefono-la-tabla-se-lee-como-tarjetas-por-debajo-de-720-px`,
  abierta desde `origin/main` (primer commit `492c53f`). Sin push, sin PR, sin merge.
- Épica: **EPIC-007 — La app en el teléfono**. La spec nació en **EPIC-MEJORA** y la expulsó
  **CE-M3** de aquella épica (necesita ADR nuevo → replanteo → épica propia, decidido por el
  humano el 2026-08-24). Los criterios que gobiernan ahora son **CE-1 a CE-6 de EPIC-007**, no
  los CE-M*. La rejilla CA → CE está al final de la spec, §Notas para el gate 9.
- Rama: por crear, desde `origin/main`. **No** desde el worktree actual.

### Intendencia — léela antes de tocar nada

- **Sesiones en paralelo.** Este repositorio tiene varias sesiones a la vez. Los ids y el
  estado se leen de **`origin/main`**, nunca del worktree: `git fetch origin main` y
  `git ls-tree -r --name-only origin/main docs/epicas/`. Al escribir esta spec, el id más alto
  en `origin/main` era **SPEC-053** y **SPEC-052 es un hueco** que puede estar reservado por
  otra sesión — **no se rellena**. Lo mismo con los ADR: **ADR-033 ya existe** en `origin/main`
  (es de SPEC-053) y **ADR-013 es un hueco**; por eso el ADR de esta spec es **ADR-034**.
  ⚠️ **`core/scripts/scaffold.mjs` numera leyendo el worktree local**, así que propuso
  SPEC-050 y ADR-033, los dos ya ocupados. Los ficheros se renombraron a mano. **Comprueba el
  id contra `origin/main` después de scaffoldear.**
- **La premisa de los anchos del encargo era falsa y ya está corregida en la spec.**
  `tests/e2e/geometria.ts:66` declara `ANCHOS = [360, 390, 640, 700, 730, 760, 800, 1280]`,
  idéntico en `origin/main` y en el worktree, y coincidente con ADR-026 §3: **360 y 390 llevan
  medidos desde SPEC-040**. No hay que añadir anchos. **El agujero real es que `/cartera` no
  está en el conjunto de rutas** de `tests/e2e/geometria-rutas.spec.ts` y por tanto no se mide
  a ningún ancho. Es **CA-11**.
- **Lo que NO se puede romper, con su sitio exacto:**
  - `.table-scroll` (`src/app/globals.css:496-513`) está **fuera** de todo `@media` a
    propósito, por **SPEC-040 CA-5** y **ADR-026 §4-5**. Su comentario explica por qué. Por
    encima de 720 px tiene que seguir viva, y el comentario intacto o **actualizado con
    honestidad** — nunca borrado.
  - `.quote-fail`, `.quote-pending`, `.quote-stale` (`globals.css:701-712`) llevan
    `max-width: 34ch` y envuelven porque **esta tabla ya se rompió una vez** por un párrafo que
    se extendía. En formato tarjeta conservan la caja (**CA-15**).
  - El estado de zona es **color de fondo**, no distintivo (SPEC-007). En la tarjeta, el fondo
    de la tarjeta (**CA-10**).
  - La capa de edición es un `<dialog>` anclado al borde inferior (**ADR-030**) y **no se
    mueve**; lo único que cambia es sobre qué se abre (**CA-12**).
- **`display: none` es la clave de los dos árboles y hay que saber por qué funciona**: M1 salta
  los elementos con caja `0 × 0` (`tests/e2e/geometria.ts`, *«Invisible: ni ocupa ni se ve»*),
  así que la representación oculta no ensucia el recuento; y `display: none` **retira del árbol
  de accesibilidad**, que es lo que hace correcto tener dos árboles a la vez en el DOM.
- **M5 nace roja, y eso es la medida funcionando.** `.btn-sm` es `padding: 8px 14px` con
  `font: 600 13px/1` → **≈31 px de alto**, y lo usan *Editar*, *Quitar* y el botón de dirección
  del orden. La salida es agrandar y apilar (ADR-026 §4). **Bajar el suelo de M5 hasta que pase
  es `F-ADR-026-1` cumpliéndose por escrito** y lo caza la revisión.
- **La e2e completa reescribe capturas de `_qa/` ajenas.** Restaurar lo que no es de esta spec
  con `git checkout -- _qa/` y commitear **sólo** `_qa/SPEC-054/` (**CA-19**).
- **Dos decisiones de diseño del humano que NO son territorio libre** (gate del 2026-08-24):
  el pie de la tarjeta lleva *Editar* y *Quitar* **al 50 %, en una sola fila** (**CA-20**), y
  por debajo de 720 px hay **una sola columna** de tarjetas a los cuatro anchos, también a 640
  y 700 (**CA-3**). Ninguna de las dos se replantea al implementar.
- **La salida fácil está prohibida y el mal ejemplo está en casa** (**R-2 de EPIC-007**,
  **CA-21**): `design/tremen-ds/responsive.css:11` resuelve su paso a móvil con
  `html, body { overflow-x: hidden }`, que es exactamente lo que **ADR-026 §4** declara que no
  es un arreglo. Ese fichero **sí lo carga la app** —`layout.tsx:5` → `globals.css:3` →
  `components/index.css:26`— así que la tentación está a un `@media` de distancia. Esta spec
  **no añade ni un `overflow: hidden`** y lo comprueba.
- **Ficheros que se van a tocar** (previsión, no compromiso): `src/app/vigiladas/watched-table.tsx`,
  `src/app/cartera/page.tsx`, `src/app/globals.css`, `tests/e2e/geometria.ts` (**añadir M5**,
  nunca aflojar lo que hay), `tests/e2e/geometria-rutas.spec.ts` (**añadir `/cartera`**) y
  ficheros nuevos de guardia bajo `tests/e2e/`. **Nada bajo `src/db/`, `drizzle/`,
  `src/lib/portfolio/`, `src/lib/watchlist/zone-status.ts` ni `src/lib/market/`** (CE-5 de EPIC-007,
  **CA-16**).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 — el modo conmuta, y en el canto exacto (tarjetas ≤720, tabla ≥721; nunca las dos ni ninguna) | `src/app/globals.css` §SPEC-054 (los dos bloques `@media`: `max-width: 720px` apaga `table.data-table` y `.table-scroll`, `min-width: 721px` apaga `.tarjetas`) · `src/app/vigiladas/watched-table.tsx` y `src/app/cartera/page.tsx` montan los dos árboles | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-1: en cada ancho hay UNA representación viva, y es la que toca» (8 anchos × 2 pantallas; `display` computado + `checkVisibility()`) · **mutación**: quitar `table.data-table { display: none }` lo pone rojo | | ❌ |
| CA-2 — el canto queda entre 700 y 730, dos anchos medidos adyacentes | `src/app/globals.css` §SPEC-054 (el canto, escrito por sus dos lados) | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-2: el canto está donde dice ADR-034 §1, medido a los dos lados» (720 y 721 px) · `tests/spec054-breakpoint-y-rutas.test.ts` › «CA-2: `ANCHOS` contiene 700 y 730, y no hay ningún ancho medido entre ellos» | | ❌ |
| CA-3 — una tarjeta por fila y una fila por tarjeta, en el mismo orden | `src/app/globals.css` › `.tarjetas { grid-template-columns: 1fr }` (fuera de los bloques de modo: es el mismo reparto en toda la franja) | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-3: N filas → N tarjetas, en el mismo orden y en una sola columna» (360/390/640/700; la columna única se afirma por la propiedad —dos tarjetas no comparten línea— no por el `grid-template-columns`) | | ❌ |
| CA-4 — cero desborde horizontal a 360 y 390 en las dos páginas (M1+M2+M3) **y ni un contenedor que arrastrar** | Los dos árboles + `src/app/globals.css` §SPEC-054 (`.tarjeta`, `.tarjeta-datos`, `min-width: 0` en cada nivel) | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-4: en un teléfono no desborda nada y no queda nada que arrastrar» — M1, M2, M3 y **`medirOverflowHorizontal`**, que es la mitad que ni M1 ni M2 responden | | ❌ |
| CA-5 — `.table-scroll` intacta y funcional a 730/760/800/1280 (cero regresión de SPEC-040 CA-5) | `src/app/globals.css`: la declaración de SPEC-040 CA-5 **no se toca**; sólo se le añade `display: none` dentro del bloque de 720 | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-5: por encima del canto, la tabla se sigue desplazando en SU caja» (`overflow-x`, `min-width`, `max-width`, M2, y que arrastrando se alcanza la última columna a 730 y 760) · `tests/e2e/geometria-rutas.spec.ts` › SPEC-040 CA-5, verde | | ❌ |
| CA-6 — anti-deriva: la tarjeta dice todo lo que dice la fila, con el mismo rótulo | `src/app/columnas.tsx` (la descripción compartida) · `src/app/vigiladas/columnas-vigiladas.tsx` · `src/app/cartera/columnas-cartera.tsx` — las dos formas salen de la MISMA función `valor()` y del MISMO `rotulo` | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-6: ni un dato de menos, ni un rótulo distinto, ni un rótulo inventado» (celda a celda a 1280 contra la tarjeta a 360, más el conjunto `<dt>` = `<th>` − promocionados) · **mutación**: un `<td>` de más en la tabla, pintado saltándose la descripción, lo pone rojo | | ❌ |
| CA-7 — `aria-sort` desaparece con la tabla y vuelve con ella | `src/app/vigiladas/columnas-vigiladas.tsx` (`ariaSort` por columna) + el `display: none` de CA-1, que es lo que retira del árbol de accesibilidad | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-7: `aria-sort` es de una tabla, y desaparece con ella» (cero elementos con `aria-sort` **pintados** a 360/390; exactamente uno distinto de `none` a 730/760/800/1280) | | ❌ |
| CA-8 — el orden se sigue diciendo y se sigue pudiendo cambiar en móvil | `src/app/vigiladas/watched-table.tsx` — `.orden-control` **no se toca**: sigue fuera de `.table-scroll` (SPEC-041 CA-11) y visible a todos los anchos | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-8: el orden se sigue diciendo y se sigue pudiendo cambiar en móvil» (nombre accesible, criterio activo, `aria-pressed`, y la secuencia de tickers tras ordenar por Estado igual a la de 1280) | | ❌ |
| CA-9 — orden de lectura = orden del DOM = orden del boceto; `<dl>` con `<dt>` por `<dd>` | `src/app/vigiladas/watched-table.tsx` (el `<li>`: cabecera → estado → `<dl>` → pie) · `src/app/columnas.tsx` › `ordenEnLaTarjeta` (el orden del boceto, distinto del de la tabla) · `globals.css` (rejilla de colocación automática, sin `order`/`grid-row`/`direction`) | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-9: el orden de lectura es el del boceto, y nada lo reordena» (estructura del DOM, un `<dt>` por `<dd>`, `medirPropiedadesComputadas` sobre `order`/`grid-row-start`/`grid-column-start`/`direction`, nombre accesible de la lista y recorrido con el tabulador) | | ❌ |
| CA-10 — el estado de zona sigue siendo el fondo, con el mismo color computado (SPEC-007) | `src/app/vigiladas/watched-table.tsx` (`zone-${state}` en el `<li>`) · `src/app/globals.css`: `.tarjeta` **no declara `background`**, a propósito, para no tapar el tinte de zona | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-10: el fondo de la tarjeta es el de su fila, con el mismo color computado» (los cinco estados, `background-color` idéntico al del `<tr>`, un solo color de borde para todos y la etiqueta de texto viva) | | ❌ |
| CA-11 — `/cartera` entra en el conjunto de rutas medidas, a los ocho anchos | `tests/e2e/rutas.ts` (nuevo: las tres listas, importables sin arrancar el navegador) · `tests/e2e/geometria-rutas.spec.ts` las consume | `tests/e2e/geometria-rutas.spec.ts` › «SPEC-054 CA-11: /cartera con posiciones, M1 + M2 + M3 a los ocho anchos» · `tests/spec054-breakpoint-y-rutas.test.ts` › «CA-11: la ruta está en el conjunto, y retirarla se ve en rojo» + «la guardia consume el conjunto compartido» · **mutación**: vaciar `RUTAS_CON_POSICIONES` lo pone rojo | | ❌ |
| CA-12 — M4 sobre la capa de edición, con lista larga afirmada y en tres posiciones (ADR-030) | La capa **no se mueve**: `dialog.editar-vigilada` intacto. Lo único nuevo es `data-editando` en el `<li>` y `.tarjeta.fila-editando` en `globals.css` | `tests/e2e/tarjetas-capa-edicion.spec.ts` › tres casos: M4 en las tres posiciones a 360/390 con la precondición **derivada** sobre la lista de tarjetas; el foco que vuelve por guardar, cancelar y Escape; y la capa anclada a la ventana. La capa entra en M1 como **testigo** | | ❌ |
| CA-13 — **M5** en el módulo compartido, suelo 44×44, con prueba de eficacia por reinyección | `tests/e2e/geometria.ts` › `SUELO_TACTIL_PX`, `SELECTOR_INTERACTIVO`, `medirAreaTactil`, `describirAreaTactil`, `DEFECTO_AREA_TACTIL` · `src/app/globals.css`: `.btn-sm` pasa de ≈31 a 46 px de alto y `.orden-control select` a 45, **sólo por debajo del canto** | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-13: todo control llega al suelo táctil, y la medida ve el defecto» (0 de 17 controles por debajo del suelo; reinyección `.btn-sm { padding: 2px 6px; font-size: 10px }` → rojo, quitada → verde) · `tests/spec054-m5-en-el-modulo.test.ts` (7 casos: el 44 con su fuente citada, los siete tipos de control, las dos mitades, y que ninguna guardia escriba el número por su cuenta) | | ❌ |
| CA-14 — los dos suelos de legibilidad: controles ≥16 px, texto ≥12 px | `src/app/globals.css` §SPEC-054: `.orden-control select`, `.auth-form input/select/textarea`, `.symbol-search-input` a 16 px; **`.page-head .eyebrow` a 12** (hallazgo: el sistema de diseño lo pisa a 11 px) | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-14: 16 px en los controles de formulario y 12 px en cualquier texto», con el alta **desplegada** para que sus campos entren en la medida (`medirSuelosTipograficos`) | | ❌ |
| CA-15 — los avisos de diagnóstico no se rompen en formato tarjeta (`34ch`, envuelven, completos) | `src/app/globals.css` › `.tarjeta-estado .estado-caja`: **no** sobrescribe el `max-width: 34ch` de `.quote-*`, al revés de lo que hace `.data-table .estado-caja` | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-15: los avisos conservan su caja, envuelven y se leen enteros» (texto idéntico al de 1280, `max-width` distinto de `none`, ninguna línea por encima de la caja, el más largo envuelve, ninguno parte palabra, y ninguno se sale de su tarjeta) | | ❌ |
| CA-16 — cero regresión funcional: suites enteras verdes y diff acotado (CE-5) | No hay implementación: es el resultado. El diff **no toca** `src/db/`, `drizzle/`, `src/lib/portfolio/`, `src/lib/watchlist/zone-status.ts` ni `src/lib/market/` | `npx vitest run` → **1702/1702** en 112 ficheros · `npx playwright test` → **323/323**. Detalle de los seis ficheros que sí se tocaron y por qué, en §Decisiones y hallazgos | | ❌ |
| CA-17 — cabecera, control de orden, alta plegable y formularios de cartera cumplen M1/M3/M5 | `src/app/globals.css` §SPEC-054 (los mismos agrandados de CA-13 y CA-14) | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-17: cabecera, orden, alta plegable y formularios de cartera» — cinco superficies × 2 anchos × alta **plegada y desplegada**, con M1 rooteado en cada una (y su testigo), M5, M3 sobre el rótulo del orden y cero contenedores que arrastrar | | ❌ |
| CA-18 — un solo breakpoint de modo en `globals.css`, afirmado por test | `src/app/globals.css`: toda la conmutación vive en los dos lados del mismo canto | `tests/spec054-breakpoint-y-rutas.test.ts` › cuatro casos: los cantos declarados, que sólo el bloque de modo cambia representaciones, que **toda** regla de `display` sobre la tabla o las tarjetas vive en él, y que existen las dos caras · **mutación**: un `@media` de 480 px o un `display` fuera del bloque lo ponen rojo | | ❌ |
| CA-19 — evidencia reproducible sólo bajo `_qa/SPEC-054/` | — | 26 ficheros bajo `_qa/SPEC-054/`: cifras de M1/M2/M3/M5 por ruta y por ancho, el inventario de `overflow`, las medidas de M4 y el pie, capturas de las dos pantallas a 360/390/700/730/1280 y la capa abierta sobre una tarjeta a 360. Las capturas ajenas se restauraron con `git checkout -- _qa/`: **ninguna otra `_qa/SPEC-NNN/` aparece en el diff** | | ❌ |
| CA-20 — pie de tarjeta: *Editar* y *Quitar* al 50 %, misma fila, cada uno ≥44×44 | `src/app/globals.css` › `.tarjeta-pie { display: grid; grid-template-columns: 1fr 1fr }` + `.tarjeta-pie form { display: grid }` y `.tarjeta-pie .btn-sm { width: 100% }` — con la aritmética de la tercera acción de ADR-034 §10 escrita al lado | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-20: *Editar* y *Quitar*, misma fila, mitad y mitad, y pulsables» (mismo `top`, anchos iguales, los dos más el hueco = el ancho del pie, y cada uno ≥ el suelo en los dos ejes) | | ❌ |
| CA-21 — la salida prohibida no se usa: ni un `overflow: hidden` nuevo (R-2 de EPIC-007) | `src/app/globals.css` §SPEC-054: ni una regla de `overflow` nueva | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-21: ni un `overflow: hidden` nuevo, y los que hay son los de siempre» (inventario en tiempo de ejecución contra los heredados) · `tests/spec054-breakpoint-y-rutas.test.ts` › dos casos sobre la fuente · **mutación**: un `overflow-x: hidden` en `.tarjeta > *` lo pone rojo | | ❌ |

## Decisiones y hallazgos durante la implementación
<!-- Lo escribe sdd-implementador: desvíos de la spec, sorpresas, atajos con su motivo. -->

### 1. ⚠️ CA-16 y CA-11 se contradicen, y CA-16 no se cumple entero. **Es para el gate.**

CA-16 dice que estas siete guardias siguen verdes **«sin tocarse»**, y CA-11 dice que
`/cartera` **entra en el conjunto de rutas de `tests/e2e/geometria-rutas.spec.ts`** — que es
una de las siete. Las dos cosas no pueden ser verdad a la vez.

Y hay más: **tres de esas siete conducen la TABLA a 360 y 390 px**, que es exactamente donde
CA-1 manda que la tabla deje de estar en el árbol de accesibilidad. Con la tabla apagada,
`getByRole('button', { name: 'Quitar' })` no encuentra nada, un `waitFor({ state: 'visible' })`
sobre `table.data-table` no vuelve nunca, y un clic sobre un `<td>` oculto se queda esperando.
No es un defecto de la implementación: es que **CA-16 se escribió sin comprobar qué anchos
recorre cada una de las siete**.

**Lo que se ha hecho, y la regla con la que se decidió cada caso**: ni una aserción se afloja;
lo único que cambia es **a qué apuntan los localizadores** y **a qué anchos se mide**, y
siempre con el porqué escrito al lado del cambio. Se prefirió tocar un **helper compartido**
antes que una guardia nombrada, y dentro de una guardia nombrada, la línea más pequeña posible.

| Fichero | Qué cambió | Por qué |
|---|---|---|
| `tests/e2e/spec046.ts` *(helper, no guardia)* | `filas`, `editarEnFila`, `filaDual` y la precondición pasan a la representación **viva** a cada ancho | Deja `vigiladas-capa-edicion.spec.ts` —guardia nombrada— **sin tocar ni una línea** |
| `tests/e2e/vigiladas-capa-edicion.spec.ts` ⚠️ *(nombrada)* | **Una espera**, no una aserción: su `prepararLista` local esperaba a `table.data-table` visible y se llama con la ventana ya estrecha | Es lo único que no se podía sacar al helper. Sus 10 casos y todas sus aserciones quedan intactos |
| `tests/e2e/vigiladas-editar.spec.ts` ⚠️ *(nombrada)* | **Su `editarDe` local**, que ahora busca el control en la representación viva | CA-23 de esa spec recorre los ocho anchos y pulsa *Editar*; a 360 el botón del `<tr>` está apagado |
| `tests/e2e/geometria-rutas.spec.ts` ⚠️ *(nombrada)* | **(a)** Las tres listas de rutas salen a `tests/e2e/rutas.ts` y se importan; **(b)** el caso «la tabla sigue siendo legible» recorre `ANCHOS_TABLA` en vez de los ocho; **(c)** entra el caso de CA-11 | **(a)** lo exige CA-11 (un test unitario no puede importar una lista escrita dentro de un `.spec.ts` sin ejecutar sus `test()`); **(b)** por debajo del canto no hay tabla que arrastrar, y allí rige algo **más fuerte** —CA-4, «no queda ni un contenedor que arrastrar»— |
| `tests/e2e/movil-alta.spec.ts` | El `<tr>` recién dado de alta se busca en la representación viva | Ese caso recorre CE-1 entero **a 360 px**, donde la fila nueva es una tarjeta |
| `tests/e2e/geometria-puntos-ciegos.spec.ts` | El caso «la exención legítima de M1 sigue viva» se re-encuadra de 360 a **730 px** | A 360 ya no hay tabla, así que medía la situación en la que la exención **no puede hacer nada**: aprobaba en el vacío. A 730 la premisa sigue siendo cierta y sus tres precondiciones se siguen exigiendo |

Las otras cuatro de la lista de CA-16 —`vigiladas-orden`, `cartera`, `decimales`,
`sin-refrescar-geometria`— **siguen verdes sin tocarse**, y sus aserciones sobre la tabla a
360 px (`aria-sort` por atributo, `.table-scroll` con `overflow-x: auto` computado) pasan
igual, porque `display: none` no cambia ni los atributos ni el resto de valores computados.

**Pregunta para el humano**: ¿se acepta CA-16 como **⚠️ parcial** —seis ficheros de test
re-encuadrados con su motivo, cero aserciones aflojadas, las dos suites enteras verdes— o
prefieres que el verificador lo trate como rojo y se reabra la redacción del CA?

### 2. Dos guardias unitarias ajenas miraban un fichero que se partió en dos

`tests/spec044-frontera.test.ts` (CA-24, «el id viaja con su fila») y
`tests/spec043-sin-refrescar.test.ts` (CA-12, «una sola definición del umbral») leían
`watched-table.tsx` y `cartera/page.tsx` buscando código que ADR-034 §3 movió a la
descripción de columnas. Las dos se re-encuadran para mirar **la superficie entera de cada
pantalla** en vez de un solo fichero, y las dos **miden más de lo que medían**: si el umbral
de RN-16 reapareciera en la descripción de columnas, antes no lo habría visto nadie.

### 3. `CA-18` tiene un cuarto valor de `@media` que la spec no contempla, y ya estaba

CA-18 pide que «los únicos anchos que aparecen son 720 y 599/600; no aparece ningún cuarto
valor». En el árbol hay un cuarto: **1023**, el borde superior de
`@media (min-width: 600px) and (max-width: 1023px)`, que es el **mismo** bloque de densidad
de `.cards` visto por su otro lado — y `/dashboard` está en el «fuera de alcance» de esta
spec, así que ese bloque no se toca.

El test no lo tolera en silencio: **declara los tres cantos con su motivo** y añade un caso
que exige que **cualquier bloque que no sea el de modo toque `.cards` y nada más**. Eso es lo
que hace inofensivo el 1023: no es un breakpoint de modo porque se comprueba que no lo es.
También normaliza `min-width: 721px` a 720 —son los dos lados del mismo canto, tal como lo
escribe ADR-034 §1— para no contar como «cuarto valor» la otra mitad de la única decisión
que hay.

### 4. Cinco hallazgos de la ejecución, no del diseño

1. **`medirOverflowHorizontal` contaba `<html>` dos veces.** `querySelectorAll('*')` ya lo
   devuelve. Arreglado en el módulo.
2. **M3 daba un falso positivo sobre `.tarjeta-cabecera`.** La medida cuenta cajas de línea
   agrupando los rects de un `Range` por su `top` **redondeado**, y un contenedor con cajas
   anidadas devuelve un rect por caja: medio píxel entre el `div.activo-caja` y el
   `span.ticker` convertía «Z7FALLO» en dos líneas para una palabra. Las guardias miden
   **hojas de texto**, que es como la usa SPEC-040 (`.card h3, .card .num`). La medida no se
   toca.
3. **`.eyebrow` se pinta a 11 px, por debajo del suelo de 12 de ADR-034 §7.** No viene de
   `--t-caption` (que son 12) sino de `design/tremen-ds/components/eyebrows.css:22`, que lo
   pisa **a todos los anchos**. Se sube a 12 **sólo por debajo del canto** y **sólo en
   `.page-head`**: CE-5 dice que el escritorio no paga la factura del móvil, y ADR-026 §5
   dice que la app no muta el sistema de diseño.
4. **`.card` del sistema de diseño recorta a lo ancho, y CA-21 no lo nombra.** Está en
   `cards.css:30` desde el primer commit del proyecto y lo llevan los formularios de compra y
   venta, el de alta y la capa. Se acepta con el mismo motivo que `.data-table` —es una
   máscara de esquinas redondeadas, no una respuesta a un desborde— y queda escrito en la
   guardia. **La lista de heredados de CA-21 se escribió mirando `globals.css`**; éste vive
   en `design/`.
5. **El `as_of` de la siembra movía un máximo global.** La entradilla de `/cartera` enseña
   `max(as_of)` de **todas** las cotizaciones de la base, no de las del usuario, e
   `ingesta-cartera.spec.ts` afirma esa fecha. Sembrar con un `as_of` más nuevo rompía una
   guardia ajena con un síntoma que no se parece a su causa. Se usa el mismo que `spec041.ts`:
   lo que esta spec necesita congelado es `updated_at`, que es otra columna.

### 5. Decisiones de implementación que conviene conocer antes de revisar

- **Las asas de prueba del árbol de tarjetas llevan sufijo** (`editar-zonas-tarjeta`,
  `sin-refrescar-tarjeta`…). No es cosmética: hay guardias que cuentan a nivel de página
  (`page.getByTestId('sin-refrescar')` espera 2, `getByTestId('editar-zonas')` espera 2) y un
  asa repetida las rompe **por duplicado** sin que exista ningún defecto. El helper `asa()` de
  `src/app/columnas.tsx` es lo único que distingue las dos formas.
- **`.tarjeta` no declara `background`**, y es deliberado: sus reglas van después de
  `.zone-*` en el fichero y taparían el tinte de zona por orden de fuente, convirtiendo el
  estado en un distintivo — justo lo que SPEC-007 decidió no hacer (CA-10).
- **La barra de color de la esquina izquierda de la fila no viaja a la tarjeta.** En la tabla
  la pinta `.zone-buy td:first-child { box-shadow: inset … }`, y en la tarjeta no hay `td`.
  Se dejó fuera a propósito: añadirla sería un borde de color nuevo, y CA-10 dice que el
  estado **no** se comunica con distintivos nuevos. La señal es el fondo más la etiqueta, que
  es lo que SPEC-007 decidió.
- **El pie de la tarjeta comparte la clase `.fila-acciones`** con la celda de acciones de la
  tabla, y añade `.tarjeta-pie`. Así, el caso de SPEC-046 CA-15 —que inyecta un tercer control
  simulado en `.fila-acciones` y lo mide a los ocho anchos— sigue funcionando **sin tocarse**,
  y con tres controles la rejilla los apila en vez de encogerlos, que es lo que manda
  ADR-034 §10.
- **El arreglo de M5 va sobre `.btn-sm` a pelo**, sin `min-height` y sin subir la
  especificidad. Es lo que hace que la reinyección de CA-13 pueda deshacerlo: con un
  `min-height: 44px` la altura no bajaría y la prueba de eficacia se quedaría verde pase lo
  que pase. Está escrito en el CSS, al lado de la regla.
- **`.btn-sm` lo usa también el botón «Salir» de la navegación global**, así que agrandarlo
  por debajo del canto también lo agranda a él. `.app-nav` está en el «fuera de alcance», pero
  `.btn-sm` no: el efecto es a favor de CE-3 y no toca ni el marcado ni el reparto de la nav.

## Salvedades y follow-ups
<!-- F-SPEC-054-N: lo que queda pendiente, con dueño y si bloquea o no. -->

- **F-ADR-034-1** (heredado del ADR, no bloquea): `viewport-fit=cover` y las áreas seguras
  quedan inertes a propósito. Si algún día se adoptan, el primer sitio que rellenar con
  `env()` es el borde inferior del `<dialog>` de ADR-030.
- **F-ADR-034-2** (heredado, vigilancia continua): dos árboles se pueden separar. La
  descripción de columnas compartida y CA-6 lo impiden, pero **conviene mirarlo en cada
  revisión que añada una columna**.
- **F-ADR-034-3** (heredado, no bloquea): la decisión de conmutación es **de una tabla de
  datos**. No se extiende por analogía a otras superficies.

- **F-SPEC-054-1** (dueño: **sdd-producto / spec 2 de EPIC-007**; no bloquea esta spec):
  **M5 nace roja fuera del alcance, y ya tiene cifras.** En alcance (`main.page` + la capa)
  van **0 de 17** controles por debajo del suelo. En la pantalla entera van **12 de 30** en
  `/vigiladas` y **12 de 26** en `/cartera`, y los doce son los mismos: los cinco enlaces de
  `.app-nav-links` (36×26 el más pequeño), la marca (97×20), los cuatro enlaces del pie
  (54×20 el más pequeño) y el enlace de feedback (320×37). La lista completa, con su caja,
  está en `_qa/SPEC-054/m5-fuera-de-alcance.txt`, y la guardia la **mide y la escribe** en
  cada ejecución aunque no la afirme. Es `R-1 de EPIC-007` cumpliéndose con números: la spec
  2 de la épica ya se puede dimensionar. **La salida es agrandarlos, nunca bajar el suelo**
  (ADR-034 §6).

- **F-SPEC-054-2** (dueño: **sdd-arquitecto**; **decide el gate humano**): la redacción de
  **CA-16** («siguen verdes **sin tocarse**») es incompatible con **CA-11** y con **CA-1**.
  Está contado entero en §Decisiones y hallazgos, punto 1, con la tabla de qué cambió en cada
  fichero y por qué. Seis ficheros de test re-encuadrados, **cero aserciones aflojadas**, las
  dos suites enteras verdes.

- **F-SPEC-054-3** (dueño: **sdd-arquitecto**; no bloquea): la lista de `overflow: hidden`
  heredados de **CA-21** está incompleta —le falta `.card`, del sistema de diseño, presente
  desde el primer commit del proyecto— y la de **anchos de `@media`** de **CA-18** también
  —le falta el **1023** del bloque de densidad de `.cards`—. Las dos se implementaron con el
  hueco tapado **y explicado en el test**, no en silencio. Si alguna de las dos redacciones se
  corrige en la spec, los tests ya dicen lo que sería cierto.

- **F-SPEC-054-4** (dueño: **quien recoja EPIC-MEJORA**; no bloquea): **`.eyebrow` mide 11 px
  también en escritorio.** Esta spec lo sube a 12 sólo por debajo del canto, porque CE-5 dice
  que el escritorio se queda como estaba y ADR-026 §5 prohíbe mutar el sistema de diseño desde
  la app. Si algún día se decide que once píxeles de mono en versales tampoco valen a 1280 px,
  es un roce de EPIC-MEJORA con su «dónde se vio», no un arreglo de esta épica.

- **F-SPEC-054-5** (verificación pendiente, heredada de **R-6 de EPIC-007**; no bloquea):
  la etiqueta `<meta name="viewport">` **no está declarada** en `src/app/layout.tsx`; se
  confía en el defecto de Next 16 (`width=device-width, initial-scale=1`). R-6 pide
  **comprobarlo en el HTML servido**, no darlo por bueno. Esta spec no lo ha comprobado: no
  hay ningún CA que lo pida, y toda la geometría se mide con el viewport que fija Playwright,
  que no pasa por esa etiqueta. **Es la primera cosa que debería mirar la spec 2 de la
  épica**, porque si el defecto no fuera el que se cree, todo lo medido aquí seguiría siendo
  cierto en la guardia y falso en un teléfono.

## Cómo retomar (handoff)

- **Rama**: `ft/SPEC-054-la-interfaz-en-el-telefono-la-tabla-se-lee-como-tarjetas-por-debajo-de-720-px`,
  desde `origin/main` (`492c53f`). Seis commits. **Sin push, sin PR, sin merge.**
- **Para arrancar la e2e hace falta un `next build` primero, y el build pide cuatro
  variables** — sin ellas muere con `Invalid URL` en `/_not-found`, que no dice nada de la
  causa. Son las mismas de juguete que usa el CI (`.github/workflows/ci.yml`, job `e2e`):
  `DATABASE_URL=postgres://ci:ci@localhost:5432/ci`,
  `AUTH_SECRET=ci-not-a-real-secret-ci-not-a-real-secret`, `AUTH_TRUST_HOST=true`,
  `APP_BASE_URL=http://localhost:3200`. El launcher del e2e reinyecta las suyas al proceso
  hijo, así que estas sólo sirven al build.
- **`tests/e2e/server.mjs` fija los puertos 3200 y 54329 a fuego.** Si están ocupados, es
  otra sesión, no este código.
- **La e2e completa reescribe capturas de `_qa/` ajenas** —incluidas las de SPEC-040, que
  ahora enseñan tarjetas donde enseñaban tabla—. Restaurarlas con `git checkout -- _qa/` y
  commitear **sólo** `_qa/SPEC-054/` (CA-19).
- **El escenario de esta spec** vive en `tests/e2e/spec054.ts`: una cuenta
  (`spec054@example.com`, rol `completo`), siete vigiladas con tickers `Z7` que cubren los
  cinco estados de zona y los tres avisos de diagnóstico, y cuatro de ellas también en
  cartera. La guardia de CA-12 siembra su propia lista larga con tickers `Z8` y **deriva**
  cuántas tarjetas hacen falta.
- **Órdenes útiles**: `npx vitest run` (unitarias) · `npx playwright test` (todo) ·
  `npx playwright test tests/e2e/tarjetas-*.spec.ts` (sólo lo de esta spec) ·
  `npx vitest run tests/spec054-*.test.ts` (las dos unitarias de esta spec).
- **Lo primero que debería leer el verificador**: §Decisiones y hallazgos, punto 1 — la
  contradicción entre CA-16 y CA-11, que es lo único de esta entrega que no está cerrado por
  su cuenta.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
