---
id: SPEC-054
tipo: ledger
epica: EPIC-007
---
# Ledger — SPEC-054 La interfaz en el teléfono: la tabla se lee como tarjetas por debajo de 720 px

## Resumen
- Fase: `en-revision` — **implementada, ronda 4**, pendiente de re-verificación. El gate
  humano dijo que sí el 2026-08-24 y el orquestador registró `aprobada`; sdd-implementador
  la pasó a `en-progreso` y, terminada la entrega, a `en-revision`. La verificación devolvió
  **RED** con un único finding de implementación (`F-VERIF-054-1`, el suelo táctil), y la
  ronda 2 lo cerró. La **ronda 3 fue sólo redacción** (sdd-arquitecto reescribió CA-13,
  CA-16, CA-18, CA-19 y CA-21; ni una línea de código). La **ronda 4** ejecuta la única
  tarea de implementación que esa reescritura dejó abierta: **el suelo táctil, afirmado sin
  holgura sobre TODOS los controles en alcance** y no sólo sobre los campos de formulario
  (§Ronda 4). Un commit, de test y evidencia; **ni una línea de `src/`**. **El
  veredicto RED de más abajo es el de la ronda 1 y se deja tal cual: lo reescribe el
  verificador, no el implementador.**
- Rama: `ft/SPEC-054-la-interfaz-en-el-telefono-la-tabla-se-lee-como-tarjetas-por-debajo-de-720-px`,
  abierta desde `origin/main` (primer commit `492c53f`). **Dieciséis commits** contra
  `origin/main`: los de las rondas 1 y 2, **dos** de la ronda 3 (redacción) y **uno** de la
  ronda 4 (`5c5fdbc`). Sin push, sin PR, sin merge.
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
| CA-1 — el modo conmuta, y en el canto exacto (tarjetas ≤720, tabla ≥721; nunca las dos ni ninguna) | `src/app/globals.css` §SPEC-054 (los dos bloques `@media`: `max-width: 720px` apaga `table.data-table` y `.table-scroll`, `min-width: 721px` apaga `.tarjetas`) · `src/app/vigiladas/watched-table.tsx` y `src/app/cartera/page.tsx` montan los dos árboles | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-1: en cada ancho hay UNA representación viva, y es la que toca» (8 anchos × 2 pantallas; `display` computado + `checkVisibility()`) · **mutación**: quitar `table.data-table { display: none }` lo pone rojo | Playwright **propio** (arnés mío, borrado al terminar; sin importar `geometria.ts`), **10 anchos × 2 pantallas**: a 360/390/640/700/**720** `table.data-table` computa `display:none` y `checkVisibility()=false` mientras `ul[data-testid^="tarjetas-"]` computa `display:grid` y visible (alto 2266 en /vigiladas, 898 en /cartera); a **721**/730/760/800/1280, al revés. En ninguno de los 20 pares medidos están las dos ni falta las dos. Coincide con `_qa/SPEC-054/conmutacion-por-ancho.txt`, que volvió byte a byte idéntico tras mis dos pasadas de la e2e. | ✅ |
| CA-2 — el canto queda entre 700 y 730, dos anchos medidos adyacentes | `src/app/globals.css` §SPEC-054 (el canto, escrito por sus dos lados) | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-2: el canto está donde dice ADR-034 §1, medido a los dos lados» (720 y 721 px) · `tests/spec054-breakpoint-y-rutas.test.ts` › «CA-2: `ANCHOS` contiene 700 y 730, y no hay ningún ancho medido entre ellos» | Medido por mí a **720 px** (viva = tarjetas) y **721 px** (viva = tabla) en las dos pantallas; `_qa/SPEC-054/canto-del-modo.txt` dice lo mismo. `ANCHOS = [360, 390, 640, 700, 730, 760, 800, 1280]`: **700** y **730** rodean el canto, son adyacentes y no hay ningún ancho medido entre ellos (`tests/spec054-breakpoint-y-rutas.test.ts`, verde en `npx vitest run` **1702/1702**). | ✅ |
| CA-3 — una tarjeta por fila y una fila por tarjeta, en el mismo orden | `src/app/globals.css` › `.tarjetas { grid-template-columns: 1fr }` (fuera de los bloques de modo: es el mismo reparto en toda la franja) | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-3: N filas → N tarjetas, en el mismo orden y en una sola columna» (360/390/640/700; la columna única se afirma por la propiedad —dos tarjetas no comparten línea— no por el `grid-template-columns`) | Guardia propia a **360, 390, 640 y 700** en las dos pantallas: **7** `<li>` en /vigiladas y **5** en /cartera —exactamente las filas del `<tbody>` a 1280— con la **misma secuencia de tickers**; y `top(i) ≥ bottom(i−1) − 1` en todas: **0** pares de tarjetas compartiendo línea en los **cuatro** anchos, no sólo en los dos de teléfono. | ✅ |
| CA-4 — cero desborde horizontal a 360 y 390 en las dos páginas (M1+M2+M3) **y ni un contenedor que arrastrar** | Los dos árboles + `src/app/globals.css` §SPEC-054 (`.tarjeta`, `.tarjeta-datos`, `min-width: 0` en cada nivel) | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-4: en un teléfono no desborda nada y no queda nada que arrastrar» — M1, M2, M3 y **`medirOverflowHorizontal`**, que es la mitad que ni M1 ni M2 responden | Medido **elemento a elemento con código mío** contra `documentElement.clientWidth`, no por el `scrollWidth` de `body` —que aquí no prueba nada: `design/tremen-ds/responsive.css:11` declara `html, body { overflow-x: hidden }` bajo 720 px y la app lo carga por `layout.tsx:5 → globals.css:3 → components/index.css:26`—. A 360 y 390: **283** elementos pintados en /vigiladas y **154** en /cartera; **0** con `right > clientWidth+1` o `left < −1`; **0** contenedores con `overflow-x: auto` o `scroll` y `scrollWidth > clientWidth`; `documentElement.scrollWidth == clientWidth` (360/360 y 390/390). M1, M2 y M3 de la guardia, verdes en las dos pasadas. | ✅ |
| CA-5 — `.table-scroll` intacta y funcional a 730/760/800/1280 (cero regresión de SPEC-040 CA-5) | `src/app/globals.css`: la declaración de SPEC-040 CA-5 **no se toca**; sólo se le añade `display: none` dentro del bloque de 720 | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-5: por encima del canto, la tabla se sigue desplazando en SU caja» (`overflow-x`, `min-width`, `max-width`, M2, y que arrastrando se alcanza la última columna a 730 y 760) · `tests/e2e/geometria-rutas.spec.ts` › SPEC-040 CA-5, verde | A **730/760/800/1280** en las dos pantallas, medido por mí: `.table-scroll` computa `overflow-x: auto`, `min-width: 0px` y `max-width: 100%`; en /vigiladas `scrollWidth/clientWidth` = **933/634** (730), **933/664** (760) y **933/704** (800) — la tabla de nueve columnas **sigue desbordando SU caja** y desplazándola se alcanza la última columna (caso de SPEC-040 CA-5, verde) — y `documentElement.scrollWidth == clientWidth` a los cuatro anchos. Cero regresión de SPEC-040 CA-5. | ✅ |
| CA-6 — anti-deriva: la tarjeta dice todo lo que dice la fila, con el mismo rótulo | `src/app/columnas.tsx` (la descripción compartida) · `src/app/vigiladas/columnas-vigiladas.tsx` · `src/app/cartera/columnas-cartera.tsx` — las dos formas salen de la MISMA función `valor()` y del MISMO `rotulo` | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-6: ni un dato de menos, ni un rótulo distinto, ni un rótulo inventado» (celda a celda a 1280 contra la tarjeta a 360, más el conjunto `<dt>` = `<th>` − promocionados) · **mutación**: un `<td>` de más en la tabla, pintado saltándose la descripción, lo pone rojo | Comparación propia **celda a celda** a 1280 contra la tarjeta a 360: los 9 `<th>` (`Activo, Tipo, Mercado, Estado, Precio, A fecha, Zona compra, Zona venta, «»`) menos `Activo`, `Estado` y la columna sin rótulo dan **exactamente** el conjunto de los **6** `<dt>` (`Precio, A fecha, Zona compra, Zona venta, Tipo, Mercado`), con `<dt>`/`<dd>` **1:1** (6/6), y **0 de 62** valores de celda ausentes de su tarjeta en las 7 filas. El antídoto de la deriva es real y lo leí: las dos formas invocan el **mismo** `c.valor()` y el **mismo** `c.rotulo` de `src/app/columnas.tsx`. | ✅ |
| CA-7 — `aria-sort` desaparece con la tabla y vuelve con ella | `src/app/vigiladas/columnas-vigiladas.tsx` (`ariaSort` por columna) + el `display: none` de CA-1, que es lo que retira del árbol de accesibilidad | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-7: `aria-sort` es de una tabla, y desaparece con ella» (cero elementos con `aria-sort` **pintados** a 360/390; exactamente uno distinto de `none` a 730/760/800/1280) | Medido por mí en los diez anchos: a 360/390/640/700/**720** px los elementos con `aria-sort` **pintados** (`checkVisibility()`) son **0** —los `<th>` siguen en el DOM, pero `display: none` los retira del árbol de accesibilidad—; a **721**/730/760/800/1280, exactamente **uno** distinto de `none` (`TH:ascending`) y el resto `none`. | ✅ |
| CA-8 — el orden se sigue diciendo y se sigue pudiendo cambiar en móvil | `src/app/vigiladas/watched-table.tsx` — `.orden-control` **no se toca**: sigue fuera de `.table-scroll` (SPEC-041 CA-11) y visible a todos los anchos | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-8: el orden se sigue diciendo y se sigue pudiendo cambiar en móvil» (nombre accesible, criterio activo, `aria-pressed`, y la secuencia de tickers tras ordenar por Estado igual a la de 1280) | Medido por mí a 360 y 390: `.orden-control` **visible** y dentro de la ventana (`left` 16 y 20, no desplazado fuera), `<select>` con nombre accesible «Ordenar por» y valor que nombra el criterio activo, botón de dirección con `aria-pressed="false"` acorde y rótulo «↑ Ascendente». Al cambiar el criterio a **Estado**, la secuencia de las tarjetas es `Z7BOTH, Z7BUY, Z7STALE, Z7SELL, Z7OUT, Z7FALLO, Z7PEND` — **idéntica** a la de las filas a 1280 px con el mismo criterio. | ✅ |
| CA-9 — orden de lectura = orden del DOM = orden del boceto; `<dl>` con `<dt>` por `<dd>` | `src/app/vigiladas/watched-table.tsx` (el `<li>`: cabecera → estado → `<dl>` → pie) · `src/app/columnas.tsx` › `ordenEnLaTarjeta` (el orden del boceto, distinto del de la tabla) · `globals.css` (rejilla de colocación automática, sin `order`/`grid-row`/`direction`) | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-9: el orden de lectura es el del boceto, y nada lo reordena» (estructura del DOM, un `<dt>` por `<dd>`, `medirPropiedadesComputadas` sobre `order`/`grid-row-start`/`grid-column-start`/`direction`, nombre accesible de la lista y recorrido con el tabulador) | A 360 px, medido por mí: los hijos del `<li>` van en el orden del boceto (`tarjeta-cabecera → tarjeta-estado → tarjeta-datos → fila-acciones tarjeta-pie`); los **6** grupos del `<dl>` son `div.tarjeta-par` con **un `<dt>` y un `<dd>` cada uno** (agrupación nombre-valor con `<div>`, válida en HTML y sin pérdida semántica); la lista lleva `aria-label="Acciones vigiladas"`; **0** elementos de la tarjeta tienen `order`, `grid-row-start`, `grid-column-start` o `direction` distintos del inicial; y el recorrido de los enfocables en orden de DOM da `[0,0,1,1,2,2,3,3,4,4,5,5,6,6]` — los controles de la tarjeta **N** antes que los de la **N+1**. | ✅ |
| CA-10 — el estado de zona sigue siendo el fondo, con el mismo color computado (SPEC-007) | `src/app/vigiladas/watched-table.tsx` (`zone-${state}` en el `<li>`) · `src/app/globals.css`: `.tarjeta` **no declara `background`**, a propósito, para no tapar el tinte de zona | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-10: el fondo de la tarjeta es el de su fila, con el mismo color computado» (los cinco estados, `background-color` idéntico al del `<tr>`, un solo color de borde para todos y la etiqueta de texto viva) | `background-color` computado **idéntico** entre el `<li>`@360 y su `<tr>`@1280, comparado por mí ticker a ticker en los cinco estados: both `color(srgb .729618 .868112 .367389 / .19)`, buy `.486275 1 .698039 / .11`, sell `1 .721569 0 / .12`, out `.960784 .945098 .917647 / .03`, none `rgba(0,0,0,0)`. `.tarjeta` no declara `background` (a propósito, para no tapar el tinte), `.zone-label.is-*` sigue viva con su texto, y no hay distintivo, borde de color ni icono nuevos. | ✅ |
| CA-11 — `/cartera` entra en el conjunto de rutas medidas, a los ocho anchos | `tests/e2e/rutas.ts` (nuevo: las tres listas, importables sin arrancar el navegador) · `tests/e2e/geometria-rutas.spec.ts` las consume | `tests/e2e/geometria-rutas.spec.ts` › «SPEC-054 CA-11: /cartera con posiciones, M1 + M2 + M3 a los ocho anchos» · `tests/spec054-breakpoint-y-rutas.test.ts` › «CA-11: la ruta está en el conjunto, y retirarla se ve en rojo» + «la guardia consume el conjunto compartido» · **mutación**: vaciar `RUTAS_CON_POSICIONES` lo pone rojo | `/cartera` está en `RUTAS_CON_POSICIONES` y en `RUTAS_MEDIDAS` (`tests/e2e/rutas.ts`, con las tres listas extraídas **literales** del `.spec.ts`); `tests/spec054-breakpoint-y-rutas.test.ts` lo afirma **y** exige que la guardia importe `from './rutas'` en vez de copiarse la lista — verde. El caso e2e mide **M1 + M2 + M3 a los ocho anchos** con 5 posiciones y precondición afirmada: `_qa/SPEC-054/medidas-cartera.txt` trae las ocho líneas con 0 violaciones y `medidas-cartera-m3.txt` sus 120 rótulos; los dos volvieron byte a byte idénticos en mis dos pasadas. | ✅ |
| CA-12 — M4 sobre la capa de edición, con lista larga afirmada y en tres posiciones (ADR-030) | La capa **no se mueve**: `dialog.editar-vigilada` intacto. Lo único nuevo es `data-editando` en el `<li>` y `.tarjeta.fila-editando` en `globals.css` | `tests/e2e/tarjetas-capa-edicion.spec.ts` › tres casos: M4 en las tres posiciones a 360/390 con la precondición **derivada** sobre la lista de tarjetas; el foco que vuelve por guardar, cancelar y Escape; y la capa anclada a la ventana. La capa entra en M1 como **testigo** | **M4 medido por mí**, no leído: a 360 y 390 px, abriendo la capa desde la tarjeta **primera, intermedia y última**, `dialog.editar-vigilada` cae **entera** dentro de la ventana (`top 379 / bottom 800` sobre 800) y **el desplazamiento del documento es el mismo antes y después del gesto** (0→0, 1176→1176, 2169→2169 a 360; 0→0, 1093→1093, 2087→2087 a 390). Su `aria-label` nombra el activo de **esa** tarjeta (`Editar zonas de Z7STALE · BME`) y hay exactamente **1** `<li>` con `data-editando="true"`. `EXCLUSIONES_M1` contiene **sólo** `.symbol-results`: la capa no está exenta y entra en M1 como testigo. La precondición de lista larga (12 tarjetas, fondo 3419 px por debajo del pliegue) y el foco que vuelve por guardar, cancelar y Escape los afirma la guardia del proyecto, que leí y no es vacua; verde en las dos pasadas. | ✅ |
| CA-13 — **M5** en el módulo compartido, suelo 44×44, con prueba de eficacia por reinyección | `tests/e2e/geometria.ts` › `SUELO_TACTIL_PX`, `SELECTOR_INTERACTIVO`, `medirAreaTactil`, `describirAreaTactil`, `DEFECTO_AREA_TACTIL` · `src/app/globals.css`: `.btn-sm` pasa de ≈31 a 46 px de alto y `.orden-control select` a 45, **sólo por debajo del canto**. **Ronda 2 (F-VERIF-054-1)**: los campos de formulario suben de **43,00** a **45** px con `padding-block: 11px` en el mismo bloque de 720 (`.auth-form input/select/textarea` y `.symbol-search-input`) — 11 + 11 de relleno + 1 + 1 de borde + 21 de línea. **Ni `padding` de dos valores** (se comería el `padding-right: 34px` del cheurón del `select`, que se declara antes en el fichero) **ni `min-height`** (la altura dejaría de derivarse de la caja y un defecto futuro en el relleno o en el tamaño de letra no la bajaría: la medida se volvería decorativa, ADR-026 §7). El porqué está escrito al lado de la regla · **Ronda 4**: sin cambios en `src/` — la medición sin holgura no destapó ni un rojo, así que no hubo nada que agrandar | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-13: todo control llega al suelo táctil, y la medida ve el defecto» (0 de 17 controles por debajo del suelo; reinyección `.btn-sm { padding: 2px 6px; font-size: 10px }` → rojo, quitada → verde) · `tests/spec054-m5-en-el-modulo.test.ts` (7 casos: el 44 con su fuente citada, los siete tipos de control, las dos mitades, y que ninguna guardia escriba el número por su cuenta) · **ronda 2**, en la misma guardia de CA-13: `camposBajoElSuelo` mide los campos con `medirCajas` —el primitivo del módulo— y afirma el suelo **sin tolerancia ninguna**, tal cual lo escribe el CA («caja de al menos 44 × 44 px CSS»). No toca `medirAreaTactil`, ni `TOLERANCIA_PX`, ni el suelo: apretar la afirmación hasta el número que el CA declara no es aflojar un umbral. Rojo antes del arreglo (8 campos a 43,00 en `/cartera`, 5 en el alta desplegada), verde después. Y la misma guardia **abre ahora la capa de edición**, que `RAICES_EN_ALCANCE` nombraba desde el primer día sin que ninguna guardia de este fichero llegara a abrirla: 6 controles medidos, 0 por debajo · **ronda 4**: `camposBajoElSuelo` pasa a `controlesBajoElSuelo` y mide `SELECTOR_INTERACTIVO` —la lista de ADR-034 §6, importada del módulo— **en los dos ejes**, no sólo los cuatro selectores de campo. Sigue sin tocar `medirAreaTactil`, `TOLERANCIA_PX` ni el suelo. Devuelve además `medidos`, y la guardia exige que no sea cero: una lista de rojos vacía por un selector que no case ya no puede pasar por verde. **Segunda prueba de eficacia**, la que justifica que esta guardia afirme por su cuenta: reinyectando `padding-block: 10px` (el defecto real de F-VERIF-054-1) los campos vuelven a **43,00** y la afirmación estricta los ve (**8** en `/cartera`) mientras **M5 sigue en verde (0)** por su tolerancia | **Cerrado, y comprobado contra la redacción nueva.** Medido con código mío —sin `medirAreaTactil`, con `getBoundingClientRect()` contra **44 en los dos ejes y sin restar nada**— sobre `SELECTOR_INTERACTIVO` colgando de `main.page` y de `dialog.editar-vigilada`, a 360 y 390: **0 rojos de 17** medidos en /vigiladas, **0 de 13** en /cartera, **0 de 6** en la capa de edición y **0 de 23** con el alta desplegada. **Ni un control en 43,xx.** Y las **dos** reinyecciones ponen roja **mi propia** medida: `.btn-sm { padding: 2px 6px; font-size: 10px }` → **15** controles a 16 px de alto; `padding-block: 10px` en los campos → **8** campos a **43,00 exactos** en /cartera (`input.symbol-search-input 278.00x43.00`). El arreglo sigue escrito donde la reinyección lo puede deshacer (sin `min-height`, sin subir la especificidad). La acotación de la guardia (`RAICES_EN_ALCANCE = 'main.page, dialog.editar-vigilada'`) es **literalmente** la que el CA reescrito autoriza, y los **12** controles de nav, marca, pie y feedback se miden y se escriben **sin asertarse** en `m5-fuera-de-alcance.txt`. `medirAreaTactil` sigue restando `TOLERANCIA_PX` —suelo efectivo 43— y eso es `F-ADR-035-1`, fuera de esta spec por ADR-035 §5: la propiedad que el CA exige está afirmada aparte y se pone roja de verdad. | ✅ |
| CA-14 — los dos suelos de legibilidad: controles ≥16 px, texto ≥12 px | `src/app/globals.css` §SPEC-054: `.orden-control select`, `.auth-form input/select/textarea`, `.symbol-search-input` a 16 px; **`.page-head .eyebrow` a 12** (hallazgo: el sistema de diseño lo pisa a 11 px) | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-14: 16 px en los controles de formulario y 12 px en cualquier texto», con el alta **desplegada** para que sus campos entren en la medida (`medirSuelosTipograficos`) | Medido por mí en las dos pantallas a 360 y 390: **(a)** **0** `input`/`select`/`textarea` visibles por debajo de 16 px, incluidos los **6** del alta **desplegada** (`select 16px h=49` y cinco `input 16px h=45`) y los **4** de la **capa de edición** (`16px h=45`), comprobados a los **dos** anchos; **(b)** **0** nodos de texto por debajo de 12 px medidos sobre la **página entera** —148 elementos con texto propio en /vigiladas y 91 en /cartera—, o sea también en la nav y el pie, que es la lectura más exigente de «las dos páginas». `.page-head .eyebrow` sube de 11 a 12 sólo por debajo del canto. | ✅ |
| CA-15 — los avisos de diagnóstico no se rompen en formato tarjeta (`34ch`, envuelven, completos) | `src/app/globals.css` › `.tarjeta-estado .estado-caja`: **no** sobrescribe el `max-width: 34ch` de `.quote-*`, al revés de lo que hace `.data-table .estado-caja` | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-15: los avisos conservan su caja, envuelven y se leen enteros» (texto idéntico al de 1280, `max-width` distinto de `none`, ninguna línea por encima de la caja, el más largo envuelve, ninguno parte palabra, y ninguno se sale de su tarjeta) | ⚠️ **La propiedad se cumple; la letra del CA no, y no puede cumplirse sin romper otra cláusula del mismo CA.** Verificado por mí a 360 y 390 en las dos pantallas: texto **idéntico carácter a carácter** al de 1280; `max-width` computado **270.504 px = 34ch** en /vigiladas y **244.8 px = 34ch** en mono en /cartera (nunca `none`); ninguna línea excede su caja; **ninguna palabra partida**; ningún aviso se sale de su tarjeta. **Pero** el CA exige que **cada** aviso «envuelva (más de una caja de línea…)» y `.quote-stale` de /vigiladas —«⚠ No se está actualizando desde el 2026-08-22», 45 caracteres, 8 palabras— ocupa **1 sola caja de línea** a 360 y a 390 px: `anchoLineaMax` **267,20 px** dentro de una caja de **270,504 px**. Medido con un `Range` agrupando rects por `top`, el mismo método que `medirIntegridadDePalabra`, y reproducible: la evidencia del proyecto dice lo mismo (`avisos-en-la-tarjeta.txt`, `líneas=2,2,1`). **No hay trabajo de implementación que lo cierre**: cumplir esa cláusula obligaría a **estrechar la caja**, que es justo lo que el CA prohíbe dos cláusulas antes («conserva `max-width: 34ch` computado»). Es una autocontradicción de redacción → **`F-VERIF-054-2`**, para sdd-arquitecto. *(Nota menor, sin efecto sobre la aserción: el `100%` que aparece en `avisos-en-la-tarjeta.txt` sale del árbol de tabla oculto porque `AVISOS_SEL` no está acotado a la representación viva en esa lectura concreta; la aserción recae sobre un superconjunto, así que mide de más, no de menos.)* | ⚠️ |
| CA-16 — cero regresión funcional: suites enteras verdes y diff acotado (CE-5) | No hay implementación: es el resultado. El diff **no toca** `src/db/`, `drizzle/`, `src/lib/portfolio/`, `src/lib/watchlist/zone-status.ts` ni `src/lib/market/` | `npx vitest run` → **1702/1702** en 112 ficheros · `npx playwright test` → **323/323**. Detalle de los seis ficheros que sí se tocaron y por qué, en §Decisiones y hallazgos | **Cerrado con la redacción nueva, y verificado como el CA manda: leyendo los diffs.** **(a) Suites enteras**: `npx vitest run` **1702/1702** en 112 ficheros; `npx playwright test` **323/323**, ejecutado **dos veces** (5,9 min y 4,8 min); `npm run typecheck` y `npm run lint --max-warnings=0`, exit 0. **(b) Diff acotado**: `git diff --name-only origin/main...HEAD` no toca `src/db/`, `drizzle/`, `src/lib/portfolio/`, `src/lib/watchlist/zone-status.ts` ni `src/lib/market/` — los únicos ficheros de `src/` son los seis de las dos pantallas. **(c) Los diffs, uno a uno**: los cuatro que el CA deja **intactos** (`vigiladas-orden.spec.ts`, `cartera.spec.ts`, `decimales.spec.ts`, `sin-refrescar-geometria.spec.ts`) **no aparecen en el diff**; los ficheros de test con borrados son **exactamente los ocho** que el CA enumera, ni uno más, y cada cambio cae en la letra que le toca con su motivo escrito al lado — `spec046.ts` **(a)**, `vigiladas-capa-edicion.spec.ts` **(b)** (una espera, ninguna aserción), `vigiladas-editar.spec.ts` **(a)**, `geometria-rutas.spec.ts` **(d)** + **(c)**, `movil-alta.spec.ts` **(a)**, `geometria-puntos-ciegos.spec.ts` **(c)**, `spec044-frontera.test.ts` y `spec043-sin-refrescar.test.ts` **(e)**. **Cero aserciones quitadas o debilitadas, cero tolerancias subidas, cero `skip`/`fixme`, ninguna aserción sustituida por una espera, ningún conjunto de anchos recortado para esquivar un rojo.** `tests/e2e/geometria.ts` cambia **+630 / −0**: puramente aditivo, así que `TOLERANCIA_PX` y todo lo anterior siguen literalmente iguales. *(El CA no nombra `geometria.ts` en ninguna de sus dos listas; como su diff no borra ni una línea, no hay nada que aflojar — pero conviene que la próxima redacción lo diga.)* | ✅ |
| CA-17 — cabecera, control de orden, alta plegable y formularios de cartera cumplen M1/M3/M5 | `src/app/globals.css` §SPEC-054 (los mismos agrandados de CA-13 y CA-14, **incluido el `padding-block: 11px` de la ronda 2**, que es lo que sube a 45 px los 8 campos de los formularios de compra y venta y los 5 del alta desplegada) | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-17: cabecera, orden, alta plegable y formularios de cartera» — cinco superficies × 2 anchos × alta **plegada y desplegada**, con M1 rooteado en cada una (y su testigo), M5, M3 sobre el rótulo del orden y cero contenedores que arrastrar. **Ronda 2**: cada superficie pasa además por `camposBajoElSuelo`, el suelo sin tolerancia; la cifra queda escrita superficie a superficie en `_qa/SPEC-054/entorno-de-las-tablas.txt` · **ronda 4**: cada superficie pasa por `controlesBajoElSuelo`, que ahora recorre **todos** los controles y no sólo los campos; la evidencia guarda `rojos/medidos` superficie a superficie | Medido por mí a 360 y 390. **M1**: **0** elementos fuera de la ventana y **0** contenedores que arrastrar, con el alta **plegada** y **desplegada**. **M5 sin holgura**, superficie a superficie: cabecera de vigiladas **0/0** *(no tiene controles)*, control de orden **0/2**, alta plegable **0/1** plegada y **0/7** desplegada, cabecera de cartera **0/1**, formularios de compra y venta **0/12**; mi propia pasada con el alta desplegada da **0 rojos de 23** controles. **CA-14(a)** en los formularios de cartera y del alta: los 16 px se cumplen (`16px h=45`). **M3** sobre el rótulo del orden, verde. Coincide con `_qa/SPEC-054/entorno-de-las-tablas.txt`. | ✅ |
| CA-18 — un solo breakpoint de modo en `globals.css`, afirmado por test | `src/app/globals.css`: toda la conmutación vive en los dos lados del mismo canto | `tests/spec054-breakpoint-y-rutas.test.ts` › cuatro casos: los cantos declarados, que sólo el bloque de modo cambia representaciones, que **toda** regla de `display` sobre la tabla o las tarjetas vive en él, y que existen las dos caras · **mutación**: un `@media` de 480 px o un `display` fuera del bloque lo ponen rojo | **Cerrado con la redacción nueva.** **(a)** Los `@media` de `globals.css` viven en las líneas 300, 304, 531, 711, 1059, 1231, 1514, 1655, 1659 y 1818, y los cantos que declaran —normalizando `min-width: N` a `N−1`— son **exactamente [599, 720, 1023]**: el **720** escrito por sus dos lados (`max-width: 720px` y `min-width: 721px`) y **599/1023** como los dos bordes del único bloque de densidad. **(b)** Los dos bloques que no son de modo (300 y 304) contienen **una sola regla cada uno, y es `.cards`**. **(c)** Las tres reglas de `display` sobre `table.data-table`, `.table-scroll` y `.tarjetas` viven en los dos lados del canto de 720 (`globals.css:1655-1667`) y existen **las dos caras**. El test unitario afirma las tres cosas y no es vacuo: exige encontrar más de dos reglas gobernadas antes de creerse el bucle. | ✅ |
| CA-19 — evidencia reproducible sólo bajo `_qa/SPEC-054/` | — | 26 ficheros bajo `_qa/SPEC-054/`: cifras de M1/M2/M3/M5 por ruta y por ancho, el inventario de `overflow`, las medidas de M4 y el pie, capturas de las dos pantallas a 360/390/700/730/1280 y la capa abierta sobre una tarjeta a 360. Las capturas ajenas se restauraron con `git checkout -- _qa/`: **ninguna otra `_qa/SPEC-NNN/` aparece en el diff** | **(a) La evidencia.** Los **16 `.txt`** volvieron **byte a byte idénticos** (`md5sum`, 16 de 16) tras **dos pasadas completas y seguidas** de `npx playwright test` ejecutadas por mí — y también contra los bytes commiteados: tres estados, un solo hash por fichero. **(b) La ilustración.** De los **11 `.png`**, los 10 `ancho-*.png` cambian entre pasadas (el escenario siembra `updated_at` relativo al reloj, RN-16) y `capa-sobre-tarjeta-360.png` no cambió; **no se afirma su estabilidad y no la afirmo**. **(c) Nada fuera de su sitio.** `git diff --name-only origin/main...HEAD -- _qa` devuelve **sólo** `_qa/SPEC-054/`; mis dos pasadas reescribieron 231 capturas de otras 23 specs y las restauré. **El total son 27 ficheros = 16 `.txt` + 11 `.png`** *(corrijo a la ronda anterior, que escribió «27 ficheros de cifras `.txt`»: los `.txt` son 16)*. | ✅ |
| CA-20 — pie de tarjeta: *Editar* y *Quitar* al 50 %, misma fila, cada uno ≥44×44 | `src/app/globals.css` › `.tarjeta-pie { display: grid; grid-template-columns: 1fr 1fr }` + `.tarjeta-pie form { display: grid }` y `.tarjeta-pie .btn-sm { width: 100% }` — con la aritmética de la tercera acción de ADR-034 §10 escrita al lado | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-20: *Editar* y *Quitar*, misma fila, mitad y mitad, y pulsables» (mismo `top`, anchos iguales, los dos más el hueco = el ancho del pie, y cada uno ≥ el suelo en los dos ejes) | Medido por mí en los **7** pies a los dos anchos: a **360**, pie de **294 px** con hueco **8** → *Editar* **143,00** y *Quitar* **143,00** (143 + 143 + 8 = 294); a **390**, pie **316** → **154** + **154** + 8. Mismo `top` los dos (707,125 y 624,25), **46 px** de alto y ≥ 44 de ancho cada uno, y el `left` del segundo (184) es mayor que el `right` del primero (176): **cero solape**. **0 de 7** pies incumplen alguna de las cinco condiciones, a los dos anchos. | ✅ |
| CA-21 — la salida prohibida no se usa: ni un `overflow: hidden` nuevo (R-2 de EPIC-007) | `src/app/globals.css` §SPEC-054: ni una regla de `overflow` nueva | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-21: ni un `overflow: hidden` nuevo, y los que hay son los de siempre» (inventario en tiempo de ejecución contra los heredados) · `tests/spec054-breakpoint-y-rutas.test.ts` › dos casos sobre la fuente · **mutación**: un `overflow-x: hidden` en `.tarjeta > *` lo pone rojo | **Inventario propio en tiempo de ejecución** a 360 y 390: los únicos elementos con `overflow-x: hidden` computado son `html` y `body` **(i)**, `table.data-table` **(ii)** y, en /cartera, dos `form.card.auth-form` **(iii)** — **exactamente** las tres familias que el CA reescrito enumera, ni una más. En la fuente, el diff completo de `globals.css` no añade **ni una** declaración de `overflow`/`overflow-x`/`overflow-y` (los dos únicos `+` con `overflow` son `overflow-wrap: anywhere`). Y comprobé las tres procedencias que el CA afirma: `design/tremen-ds/responsive.css:11` ✓, `table.data-table` desde **SPEC-007** (`1673eda`) ✓, `.card` en `design/tremen-ds/components/cards.css:30` desde el **primer commit del proyecto** (`a3a693e`) ✓. *(Nota menor: el patrón de heredados de la guardia, `\.card\b`, aceptaría también una clase futura del estilo `.card-algo`; hoy no existe ninguna.)* | ✅ |

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

- ✅ **F-SPEC-054-2** — **CERRADO el 2026-08-24 por sdd-arquitecto: CA-16 reescrito.** La
  redacción anterior («siguen verdes **sin tocarse**») era incompatible con **CA-11** y con
  **CA-1**, y el humano decidió reabrir la redacción en vez de aceptar la salvedad. **CA-16
  dice ahora lo que quería decir: no aflojar, no "no tocar"**, y lo hace verificable — cinco
  formas legítimas de re-encuadre (a)–(e), cinco formas de aflojamiento prohibidas, y la lista
  por nombre de qué guardias quedan intactas y cuáles se re-encuadran, con la letra que
  autoriza cada una. **El trabajo de la ronda 1 no se deshace**: los seis re-encuadres caen
  dentro de (a)–(e). Añadido además: la verificación de CA-16 es **leer los diffs de test**,
  no sólo ver las suites verdes.

- ✅ **F-SPEC-054-3** — **CERRADO el 2026-08-24 por sdd-arquitecto: CA-18 y CA-21
  reescritos.** **CA-18** dejaba de negar el cuarto valor y pasa a **enumerar los tres cantos
  que hay** —720 de modo (por sus dos lados), 599/600 y 1023 como los **dos bordes del único
  bloque de densidad**— más la propiedad que los hace inofensivos (todo bloque que no sea el
  de modo toca `.cards` y nada más). La regla de fondo no se debilita: sigue habiendo **un
  solo breakpoint de modo**. **CA-21** enumera ahora los tres `overflow: hidden` heredados
  —`html`/`body`, `table.data-table` y **`.card`** (`design/tremen-ds/components/cards.css:30`,
  desde el primer commit)— y excluye explícitamente los valores por defecto del agente de
  usuario (`overflow-x: clip` en los campos). **Las dos redacciones ahora coinciden con lo que
  los tests ya afirmaban.**

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

- ✅ **F-SPEC-054-6** — **RESUELTO el 2026-08-24 por sdd-arquitecto: se reescribe CA-19, no se
  congela el reloj.** CA-19 distingue ahora **(a) la evidencia**, que son los 16 `.txt` y de
  los que **sí se afirma** que dos pasadas seguidas los devuelven byte a byte idénticos, de
  **(b) la ilustración**, que son los 11 `.png` y de los que **no se afirma estabilidad**: un
  diff en un `.png` de esta spec no prueba nada por sí solo. **Motivo de la decisión, y es de
  arquitectura, no de comodidad**: ADR-026 §6 ya decidió que este proyecto **mide cajas, no
  píxeles**, precisamente porque una captura de referencia se rompe por cosas que se cambian a
  propósito y no se rompe cuando un botón se va fuera de la pantalla. Congelar `updated_at`
  para estabilizar los PNG **pagaría un invariante de dominio por una comodidad de diff**: la
  fecha relativa es lo que hace que `.quote-stale` (RN-16) signifique algo, y clavarla
  convertiría su guardia en una bomba de relojería. El texto original del hallazgo se conserva
  debajo porque las cifras y la comprobación que lo sostienen son las que dan valor a la
  decisión.

- **F-SPEC-054-6** (dueño: **sdd-verificador / quien lea la evidencia**; no bloquea):
  **la evidencia de CA-19 es reproducible en sus MEDIDAS, no en sus PÍXELES.** Los 16
  `.txt` de `_qa/SPEC-054/` vuelven **byte a byte idénticos** tras dos pasadas completas
  seguidas (comprobado en la ronda 2). Las **10 capturas PNG** de `ancho-*.png` no: cambian
  entre pasadas separadas en el tiempo. **Y no es por el arreglo de esta ronda** — se
  comprobó revirtiéndolo, reconstruyendo y volviendo a capturar: las diez cambian igual, y
  las alturas de imagen son idénticas a las de la base, o sea que la maquetación no se
  mueve. La causa es el escenario, que siembra `updated_at` **relativo al reloj** (RN-16,
  a propósito: una fecha clavada sería una bomba de relojería). Consecuencia práctica:
  **un diff en un `.png` de `_qa/SPEC-054/` no es una regresión por sí solo**; lo que hay
  que leer son los `.txt`, que sí son deterministas.

- **F-ADR-035-1** (dueño: **sdd-arquitecto**; **no bloquea esta spec**): **la tolerancia del
  medidor actúa como holgura del suelo, y el arreglo no es de aquí.** `medirAreaTactil` filtra
  con `alto < suelo - TOLERANCIA_PX`, así que el suelo efectivo de M5 es **43, no 44**, y un
  control que aterrice en 43,00 exactos vuelve a pasar — que es exactamente el defecto que
  produjo el RED. Lo devolvió el implementador con dos salidas propuestas (tolerancia por
  parámetro; restar sólo a fracciones) y **las dos se rechazan**: la primera deja el suelo
  efectivo en 43 para toda guardia que no pase el parámetro y convierte una propiedad del
  producto en una opción de llamada (`F-ADR-026-1`); la segunda es la regla correcta escrita al
  revés. **La regla queda decidida en `ADR-035`** (2026-08-24, `borrador`): una tolerancia
  compara **dos medidas**, nunca una medida contra un **umbral declarado**; contra un umbral se
  afirma a secas. **La implementación —quitar la resta en `medirAreaTactil`— es de una spec
  propia de EPIC-007 y tiene que entrar ANTES de que la spec 2 escriba guardias nuevas de M5**,
  porque la navegación es donde M5 decidirá qué se agranda y decidirlo contra 43 sería
  decidirlo mal. **En esta spec no se implementa nada de esto**: lo que sí cambia es la
  redacción de **CA-13**, que ahora afirma el suelo contra 44 **sin holgura** — la propiedad,
  medida como haga falta.

- **F-SPEC-054-8** (dueño: **quien implemente `F-ADR-035-1`**; no bloquea): **cuando el
  módulo deje de restar, `controlesBajoElSuelo` sobra — pero hay que retirarla mirando, no
  por deducción.** Hoy la guardia de esta spec afirma el suelo sin holgura **por su cuenta**
  porque `medirAreaTactil` no lo hace. En cuanto entre ADR-035 §2, M5 pasará a afirmar lo
  mismo y esta comprobación quedará redundante en su parte principal. **Dos cosas que no lo
  son y que no se deben perder al borrarla**: (a) mide **en los dos ejes** y exige
  `medidos > 0`, que es lo que impide que un cero de rojos salga de un selector que no case;
  y (b) su **segunda prueba de eficacia** —el `padding-block: 10px` que devuelve los campos a
  43,00— es lo que demuestra que el suelo se afirma de verdad, y en ese momento el que tiene
  que ponerse rojo con ella es **M5**. Lo natural es mover esa reinyección al módulo, junto a
  `DEFECTO_AREA_TACTIL`. ⚠️ Su cifra de M5 (hoy `0`, escrita y **no afirmada**) dejará de ser
  0 ese día: es lo esperado, no una regresión.

- ✅ **F-SPEC-054-7** — **CERRADO el 2026-08-24: el drift de trazabilidad contra la épica.** La
  §Notas 9 de la spec decía que **CA-14 y CA-7/CA-8/CA-9** no colgaban de ningún criterio de
  épica (o colgaban de CE-4 «con lectura forzada»). Dejó de ser cierto cuando sdd-producto
  **añadió CE-7 a EPIC-007** el 2026-08-24, a petición de sdd-arquitecto y con este caso como
  motivo. Los cuatro CA **se reapuntan a CE-7**, la nota 8 pasa de «tres cosas abiertas» a
  «dos de tres cerradas», y la rejilla queda consistente: **los siete criterios de la épica
  están tocados y ningún CA queda sin criterio salvo CA-19**, que es convención de proyecto
  (ADR-026 §6) y lo dice.

- ✅ **F-VERIF-054-2** — **CERRADO el 2026-08-24 por sdd-arquitecto: CA-15 reescrito** (ronda
  6). El CA exigía en la misma frase que cada aviso **conservara `max-width: 34ch`** y que
  **envolviera**, y `.quote-stale` —45 caracteres— cabe en una línea por **3,3 px**: cumplir la
  segunda cláusula obligaba a estrechar la caja, que es lo que prohíbe la primera. **No había
  trabajo de implementación y no se ha hecho ninguno.** CA-15 afirma ahora las **tres**
  propiedades que sí son de la caja —ninguna línea por encima de la caja, el aviso **de más
  palabras** envuelve, ninguno parte palabra— que es exactamente lo que la guardia ya afirmaba,
  con su porqué escrito al lado. Igual que en `F-SPEC-054-2` con CA-16: **el humano reabre la
  redacción, no acepta la salvedad**.

- **F-SPEC-054-9** (dueño: **quien estrene la primera clase `.card-*` del sistema de diseño**;
  no bloquea): **el reconocedor de heredados de CA-21 es más ancho que la lista que reconoce.**
  `HEREDADOS` (`tarjetas-geometria.spec.ts`) usa `\.card\b`, y el guion es frontera de palabra,
  así que un `.card-algo` futuro pasaría por heredado **sin que la enumeración de tres de CA-21
  lo incluya**. Hoy no existe ninguna clase así —la lista medida y la escrita coinciden elemento
  a elemento, y por eso CA-21 se verifica—. **La salida es comparar clases enteras, no
  prefijos.** No se hace aquí porque sería cambiar una guardia ya verificada para cazar un caso
  inexistente. Observación (ii) de la ronda 5.

## Cómo retomar (handoff)

- **Rama**: `ft/SPEC-054-la-interfaz-en-el-telefono-la-tabla-se-lee-como-tarjetas-por-debajo-de-720-px`,
  desde `origin/main` (`492c53f`). **Dieciséis commits**: rondas 1 y 2, dos de la 3
  (redacción, sin código) y uno de la 4 (`5c5fdbc`, sólo test y evidencia).
  **Sin push, sin PR, sin merge.**
- **Lo primero que hay que saber de la ronda 4**: la afirmación del suelo táctil sin holgura
  ya **no** mira sólo los campos de formulario; recorre `SELECTOR_INTERACTIVO` entero en los
  dos ejes (`controlesBajoElSuelo`, en `tests/e2e/tarjetas-geometria.spec.ts`). **Cero rojos
  en las tres superficies en alcance**, con las cifras en §Ronda 4. El módulo compartido
  sigue sin tocarse: eso es `F-ADR-035-1`.
- **Para arrancar la e2e hace falta un `next build` primero, y el build pide cuatro
  variables** — sin ellas muere con `Invalid URL` en `/_not-found`, que no dice nada de la
  causa. Son las mismas de juguete que usa el CI (`.github/workflows/ci.yml`, job `e2e`):
  `DATABASE_URL=postgres://ci:ci@localhost:5432/ci`,
  `AUTH_SECRET=ci-not-a-real-secret-ci-not-a-real-secret`, `AUTH_TRUST_HOST=true`,
  `APP_BASE_URL=http://localhost:3200`. El launcher del e2e reinyecta las suyas al proceso
  hijo, así que estas sólo sirven al build.
- ⚠️ **Y ojo con `.env.production.local`, que gana al `.env`.** `next build` carga los dos
  («Environments: .env.production.local, .env») y el primero es el que baja `vercel env
  pull`: sus variables marcadas como sensibles llegan con el valor literal `[SENSITIVE]`.
  `APP_BASE_URL` es una de ellas, y `new URL("[SENSITIVE]")` es exactamente el
  `Invalid URL` de `/_not-found`. En la ronda 2 el build sólo arrancó con
  `APP_BASE_URL=http://localhost:3200 npm run build`: `process.env` gana a los ficheros.
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

### Ronda 2 — qué cambió respecto de lo que se verificó en RED

Tres commits sobre los seis de la ronda 1, y **sólo** para cerrar `F-VERIF-054-1`:

1. `test(SPEC-054)` — la guardia nueva, roja de verdad antes del arreglo: 8 campos a 43,00
   en `/cartera` y 5 en el alta desplegada. Vive dentro de las guardias de CA-13 y CA-17,
   mide con `medirCajas` y **no toca `medirAreaTactil`, ni `TOLERANCIA_PX`, ni el suelo**.
   Añade además la **capa de edición**, que nadie abría.
2. `fix(SPEC-054)` — `padding-block: 11px` en los campos, dentro del bloque de 720 que ya
   existía. 43,00 → **45,00**. Ni un selector nuevo, ni una especificidad más, ni un
   `min-height`.
3. `docs(SPEC-054)` — la evidencia regenerada.

**Lo que NO se tocó, a propósito**: los tres CA mal redactados (CA-16, CA-18 y el alcance
de CA-13) y la enumeración incompleta de CA-21. Un CA que no se puede cumplir no se arregla
implementando más: son `F-SPEC-054-2` y `F-SPEC-054-3`, y son del arquitecto. Tampoco se
deshizo ninguno de los seis re-encuadres de tests de la ronda 1.

**Comprobaciones de la ronda 2**: `npm run typecheck` ✅ · `npm run lint` ✅ ·
`npx vitest run` ✅ **1702/1702** · `npx playwright test` ✅ **323/323**, dos pasadas
completas seguidas · reinyección de defecto **viva**: sano=0, con el defecto=**15**, al
quitarlo=0 · M4 sobre la capa sigue dentro de la ventana y sin desplazar el documento (la
capa crece 4 px de alto: dos filas de campos × 2) · 229 capturas ajenas restauradas.

### Ronda 3 (redacción) — 2026-08-24, sdd-arquitecto. **Ni una línea de código ni de test.**

El humano decidió el 2026-08-24 **reabrir la redacción** en vez de aceptar las salvedades, y
corregir los cuatro CA en la misma ronda. Lo que cambió, y **qué obliga a re-verificar**:

| CA | Qué se reescribió | ¿Re-verificar? |
|---|---|---|
| **CA-16** (⚠️) | «sin tocarse» → **«sin aflojar»**, con el criterio que separa las dos cosas: cinco formas legítimas de re-encuadre (a)–(e), cinco prohibidas, y la lista por nombre de qué guardia queda intacta y cuál se re-encuadra bajo qué letra. Los seis re-encuadres de la ronda 1 caen dentro | **Sí** — y ahora la verificación es **leer los seis diffs de test** y comprobar que cada uno encaja en (a)–(e) y lleva su motivo escrito. Ya lo hiciste en la ronda 1 y confirmaste cero aserciones aflojadas |
| **CA-18** (⚠️) | «no aparece ningún cuarto valor» → **enumera los tres cantos** (720 de modo por sus dos lados; 599/600 y 1023 como los dos bordes del único bloque de densidad) + la propiedad que los hace inofensivos. La regla de fondo no se debilita | **Sí, barato** — es exactamente lo que `tests/spec054-breakpoint-y-rutas.test.ts` ya afirma |
| **CA-13** (⚠️/RED) | La afirmación se **acota por escrito** a `main.page` de las dos páginas + `dialog.editar-vigilada`, con nav/pie/feedback **fuera de la afirmación y dentro de la medición** y sus cifras en `_qa/`. Y el suelo se afirma **contra 44, sin holgura** | **Sí, y con una medida nueva**: la comprobación estricta de la ronda 2 (`camposBajoElSuelo`) sólo recorre **campos de formulario**. Hay que medir **todos** los controles en alcance contra 44 sin restar tolerancia. No se espera ningún rojo (campos 45, `.btn-sm` 46, `select` del orden 45) pero **hay que medirlo, no suponerlo** |
| **CA-21** (✅) | La enumeración de heredados pasa de dos a **tres**: se añade **`.card`** (`design/tremen-ds/components/cards.css:30`), y se excluyen los valores por defecto del agente de usuario (`overflow-x: clip`) | **Sí, barato** — tu propia evidencia de la ronda 1 ya lista `form.card.auth-form` y el `clip` de los campos |
| **CA-19** (✅) | «evidencia reproducible» → **(a) los 16 `.txt` son la evidencia y SÍ se afirma** que dos pasadas seguidas los devuelven byte a byte idénticos; **(b) los 11 `.png` son ilustración y NO se afirma** que sean estables; **(c)** nada fuera de `_qa/SPEC-054/` | **Sí, barato** — ya lo mediste. **Aviso**: tu columna de CA-19 dice «los **27** ficheros de cifras `.txt`»; son **16 `.txt` + 11 `.png` = 27 ficheros**. La cifra de `F-SPEC-054-6` (16 y 10 `ancho-*.png`) es la correcta |

**Trazabilidad**: §Notas 8 y 9 de la spec actualizadas a los **siete** criterios de EPIC-007;
CA-7, CA-8, CA-9 y CA-14 se reapuntan a **CE-7**. Es documento, no código.

**ADR nuevo**: **`ADR-035`** (`borrador`) — *un suelo declarado se afirma sin holgura*.
Precisa ADR-026 y ADR-034 §6, **no supersede** ninguno. **No se implementa en esta spec**
(`F-ADR-035-1`). ⚠️ El id se tomó del hueco siguiente a `ADR-034`; el más alto en `origin/main`
es **ADR-033**, así que **hay que comprobarlo contra `origin/main` antes del merge** por si
otra sesión paralela reclamó el 035.

**Lo que NO se tocó**: ni código, ni tests, ni el estado de la spec (sigue `en-revision`), ni
las columnas *Implementado* / *Test* / *Verif.* / *Estado* de la matriz.

### Ronda 4 — 2026-08-24, sdd-implementador. **La medición sin holgura, sobre todos los controles**

Un solo commit (`5c5fdbc`), de **test y evidencia**. **Ni una línea de `src/`**, porque no
hizo falta: no apareció ni un rojo. Cierra la única casilla de implementación que dejó
abierta la reescritura de CA-13 en la ronda 3.

**Qué había y por qué no bastaba.** La comprobación estricta de la ronda 2
(`camposBajoElSuelo`) afirmaba el suelo **sin tolerancia**, pero sólo recorría cuatro
selectores de campo (`.auth-form input|select|textarea` y `.symbol-search-input`). Todo lo
demás en alcance —botones, enlaces, `summary`— se seguía juzgando **sólo** con
`medirAreaTactil`, que filtra con `alto < suelo − TOLERANCIA_PX`: para esos controles el
suelo efectivo seguía siendo **43**. CA-13, tal y como quedó redactado, no acota por tipo de
control y exige el suelo contra 44 sin holgura.

**Qué se hizo, en una frase.** `camposBajoElSuelo` pasa a `controlesBajoElSuelo` y mide
**`SELECTOR_INTERACTIVO`** —la lista de los siete tipos de ADR-034 §6, **importada del
módulo**, no reescrita aquí— dentro de cada raíz en alcance, **en los dos ejes**.

**Lo que NO se tocó, y es la restricción dura de esta ronda**: `TOLERANCIA_PX`,
`SUELO_TACTIL_PX` y el filtro de `medirAreaTactil` siguen exactamente como estaban. Arreglar
la resta **en el módulo** está decidido (**ADR-035 §2**) y **decidido también que no se
implementa aquí** (`F-ADR-035-1`, ADR-035 §5). La guardia afirma sin holgura **por su
cuenta**, al lado, con el primitivo `medirCajas`.

**Las cifras, medidas y no supuestas** (`_qa/SPEC-054/m5-area-tactil.txt` y
`entorno-de-las-tablas.txt`):

| Superficie | Controles medidos sin holgura | Por debajo de 44 |
|---|---|---|
| `/vigiladas` (`main.page`), 360 y 390 px | 17 | **0** |
| `/cartera` (`main.page`), 360 y 390 px | 13 | **0** |
| `dialog.editar-vigilada`, 360 px | 6 | **0** |
| CA-17 · control de orden | 2 | **0** |
| CA-17 · alta plegable (plegada / desplegada) | 1 / 7 | **0** |
| CA-17 · formularios de compra y venta | 12 | **0** |
| CA-17 · cabecera de cartera | 1 | **0** |
| CA-17 · cabecera de vigiladas | 0 *(no tiene controles)* | — |

**Cero rojos, que es lo que el arquitecto esperaba — pero ahora está medido.** Y hay una
comprobación cruzada que conviene leer: **el número de controles medidos coincide uno a uno
con el `medidos` de M5** en todas las superficies (17/17, 13/13, 6/6, 2/2, 1/1, 7/7, 12/12).
O sea que las dos diferencias conocidas entre las dos medidas —que la estricta **no** cuenta
el área ampliada por pseudoelemento y descarta lo no pintado por la caja 0 × 0 en vez de por
`checkVisibility()`— **no introducen ninguna divergencia real dentro del alcance**: hoy no
hay ni un control que dependa de un pseudoelemento para llegar al suelo. Está escrito en el
docblock de la función, con el porqué de que el error, si algún día lo hubiera, caería del
lado de quejarse de más.

**Una medida vacía ya no puede pasar por verde.** `controlesBajoElSuelo` devuelve además
`medidos`, y la guardia exige que no sea cero antes de creerse el cero de rojos. Una lista
de rojos vacía tenía dos causas —que no haya rojos, o que el selector no case con nada— y
sin ese número no se distinguían. Es la misma constancia que M5 lleva en `medidos` y M1 en
sus testigos.

**Dos pruebas de eficacia, y la segunda es nueva** (ADR-026 §7):

1. **La de M5, intacta y viva**: reinyectando `DEFECTO_AREA_TACTIL` —`.btn-sm { padding: 2px
   6px; font-size: 10px }`— **sano = 0 · con el defecto = 15 · al quitarlo = 0**. Las tres
   cifras son idénticas a las de la ronda 2: el cambio no la ha rozado.
2. **La del suelo sin holgura**, que es la que justifica que esta guardia afirme por su
   cuenta. Se le devuelve **el defecto real de `F-VERIF-054-1`** —`padding-block: 10px` en
   los campos, que es lo que medía el árbol el día del RED— y los campos vuelven a **43,00
   px exactos**. Resultado en `/cartera` a 360 px: **sano = 0 · con el defecto = 8 · al
   quitarlo = 0**, y **M5, ante el MISMO defecto, sigue diciendo 0**. Ése es exactamente el
   hueco que esta comprobación tapa, demostrado con un rojo en vez de con un argumento.
   ⚠️ La cifra de M5 se **escribe en la evidencia pero no se afirma**: dejará de ser 0
   cuando entre `F-ADR-035-1`, y eso no debe volver roja a esta guardia.

**Lo que sigue fuera de la afirmación y no se ha tocado**: la nav global, el pie y el enlace
de feedback. `m5-fuera-de-alcance.txt` los mide y los escribe igual que antes —**12 de 30**
en `/vigiladas`, **12 de 26** en `/cartera`, los mismos doce— sin asertarlos. Es `R-1 de
EPIC-007` y `F-SPEC-054-1`. **No se ha bajado ningún suelo por ellos.**

**Comprobaciones de la ronda 4**: `npm run typecheck` ✅ · `npm run lint --max-warnings=0` ✅
· `npx vitest run` ✅ **1702/1702** en 112 ficheros (incluida
`tests/spec054-m5-en-el-modulo.test.ts`, que prohíbe escribir el literal del suelo fuera del
módulo: el número va interpolado con `${SUELO_TACTIL_PX}` y una línea de comentario hubo que
reescribirla por eso) · `npx playwright test` ✅ **323/323**, **dos pasadas completas
seguidas** · **CA-19 (a)**: los **16 `.txt`** volvieron **byte a byte idénticos** entre las
dos pasadas (`md5sum -c`, 16 de 16 OK), y las dos cifras que este cambio movió
—`m5-area-tactil.txt` y `entorno-de-las-tablas.txt`— reproducen los mismos bytes al
regenerarlas por separado · `npm run version:check` ✅ 0.3.4 → 0.4.0 con el árbol limpio
(**la versión no se vuelve a subir**: ya la subió la ronda 1) · las capturas ajenas que
reescribió la pasada, restauradas; `git diff --name-only origin/main...HEAD -- _qa` sólo
devuelve `_qa/SPEC-054/`.

⚠️ **Aviso de intendencia para quien venga**: `git checkout -- _qa/` restaura **todo** `_qa`,
incluida la evidencia de esta spec, y hay que regenerarla después. Lo acotado es
`git checkout -- $(git diff --name-only -- _qa | grep -v SPEC-054)`.

### Ronda 6 (redacción) — 2026-08-24, sdd-arquitecto. **Ni una línea de código ni de test.**

Responde al **RED de la ronda 5** que está escrito más abajo. Su único finding,
**`F-VERIF-054-2`**, no tenía trabajo de implementación: era una **autocontradicción dentro de
CA-15**. El humano ya había fijado el criterio para esta clase de problema en la ronda 3 —**se
reabre la redacción, no se acepta la salvedad**— y es lo que se ha hecho. Lo que cambió, y qué
obliga a re-verificar:

| CA | Qué se reescribió | ¿Re-verificar? |
|---|---|---|
| **CA-15** (⚠️) | La cláusula «**envuelve** (más de una caja de línea…)» —que aplicaba a **cada** aviso y era incompatible con «conserva `max-width: 34ch`» dos cláusulas antes— se parte en las **tres** propiedades que sí son de la caja: **(i)** ninguna línea de ningún aviso se extiende por encima de su caja, **(ii)** el aviso **de más palabras** de cada pantalla ocupa más de una caja de línea, **(iii)** ninguno parte una palabra (M3). Se añade el porqué con las cifras medidas (`.quote-stale`: 45 caracteres, **1** línea de 267,20 px en una caja de 270,504 — cabe por 3,3 px). El resto del CA —texto idéntico al de 1280, `max-width` nunca `none`, no desbordar la tarjeta— **no se toca** | **Sí, y es barato: la letra nueva es palabra por palabra lo que la guardia ya afirma** (`tarjetas-geometria.spec.ts` › «CA-15: los avisos conservan su caja, envuelven y se leen enteros», con su porqué ya escrito al lado). Y son las tres propiedades que **ya mediste una a una** en la ronda 5. No hay ejecución nueva que pedir; hay que leer la guardia contra el CA |
| **CA-16** (✅) | La enumeración tenía un hueco: `tests/e2e/geometria.ts` estaba **tocado y sin clasificar** en ninguna de sus dos listas. Se añade la forma legítima **(f)** —el módulo de medida compartido al que la spec **añade** medidas sin tocar una línea de las que había— y el fichero se nombra bajo ella. **(f) no es un re-encuadre, es crecimiento**, y por eso su prueba es aritmética: el diff tiene que ser `+N/−0`. Se añade además la frase que hacía falta para que un CA que se verifica leyendo diffs sea cerrable: **las dos listas son exhaustivas**, con el diff acotado a los commits de esta spec, y los siete ficheros restantes **nacen aquí** | **Sí, y de un comando**: `git diff --numstat main...HEAD -- tests/e2e/geometria.ts` → **`630  0`**. Cero líneas borradas y `TOLERANCIA_PX` intacto en la línea 79 — que es lo que ya comprobaste. Lo demás de CA-16 no se toca |
| **CA-21** (✅) | **No cambia la afirmación**: siguen siendo los mismos **tres** heredados, enumerados enteros. Se escribe que el **reconocedor** de la guardia (`\.card\b`) es más ancho que la lista —aceptaría un `.card-algo` futuro, porque el guion es frontera de palabra—, que hoy **no existe ninguna** clase así, y por qué no se aprieta aquí: apretarlo es cambiar una guardia ya verificada para cazar un caso inexistente. Queda como **`F-SPEC-054-9`** | **No.** La aserción es la misma y tu ✅ se sostiene tal cual. El párrafo nuevo es prosa y un follow-up |

**Lo que NO se tocó**: ni código, ni tests, ni el estado de la spec (sigue `en-revision`), ni
las columnas *Implementado* / *Test* de la matriz, ni las columnas *Verif.* / *Estado*, ni el
§Veredicto de la ronda 5, ni **ADR-034** ni **ADR-035** —que siguen en `borrador` y **sin
aprobar por el humano**, y esta reescritura no los toca ni los necesita: CA-15 se apoya en
ADR-034 §7 exactamente donde ya se apoyaba—.

⚠️ **Una tensión que dejo escrita y NO resuelvo, porque resolverla sería tocar tests.**
**ADR-035 §1** clasifica *«un ancho contra los `34ch` de `.quote-*`»* como **medida contra
umbral declarado**, y de esos dice que **no se les resta tolerancia**. La guardia de CA-15
compara `anchoLineaMax <= max-width + TOLERANCIA_PX`. Argumento de que no aplica: **los dos
lados salen del motor** —el ancho de línea de un `Range` y el `max-width` computado, que es la
resolución en píxeles de ese mismo `34ch`—, así que es medida contra medida, primera clase de
ADR-035 §1, y la tolerancia es legítima. Argumento de que sí aplica: el umbral **está escrito
en un ADR** aunque llegue en píxeles. **Hoy no decide nada** —el margen real es de 3,3 px, tres
veces la tolerancia— pero **ADR-035 está sin aprobar y el humano lo tiene delante**, así que
conviene que lo decida a la vez. Si decide que aplica, es un cambio de **una guardia**, no de
esta redacción, y va con `F-ADR-035-1`.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### 🔴 RED — 2026-08-24, sdd-verificador (ronda 5, re-verificación)

**20 de 21 CA cerrados (✅) y uno con salvedad (⚠️).** El RED de la ronda 1 —`F-VERIF-054-1`,
el suelo táctil— **está cerrado y lo he vuelto a medir yo, con reinyección incluida**. Lo
único que queda abierto es **CA-15**, y **no es un defecto de implementación**: es una
cláusula del CA que se contradice con otra cláusula del mismo CA, así que **no hay código que
escribir para cerrarlo**. Va a **sdd-arquitecto**, no a otra ronda de implementación.

#### Gates automáticos

| Gate | Resultado |
|---|---|
| `npm run typecheck` | ✅ exit 0 |
| `npm run lint` (`--max-warnings=0`) | ✅ exit 0 |
| `npx vitest run` | ✅ **1702/1702** en 112 ficheros |
| `npx playwright test` | ✅ **323/323**, **dos pasadas completas y seguidas** (5,9 min y 4,8 min) |
| `APP_BASE_URL=http://localhost:3200 npm run build` | ✅ exit 0 (sin la variable, muere con `Invalid URL` en `/_not-found`) |
| `npm run version:check` | ⛔ **no lo pude ejecutar**: el clasificador de permisos de esta sesión bloqueó el comando. Lo que sí consta: `package.json` y `package-lock.json` van a **0.4.0** en el diff, **no la he subido**, y el árbol está limpio |
| `_qa/` ajeno | ✅ mis dos pasadas reescribieron **231** capturas de otras **23** specs; restauradas. `git diff --name-only origin/main...HEAD -- _qa` devuelve **sólo** `_qa/SPEC-054/` |
| Árbol al terminar | ✅ `git status --porcelain` vacío. **No he tocado ni una línea de código, spec ni test** |

#### Cómo he verificado

**No hay Playwright vía MCP en este subagente** (el único servidor de navegador disponible es
`claude-in-chrome`, que no sirve para medir cajas a diez anchos). Así que conduje **Playwright
directamente**: un arnés propio, escrito por mí en un directorio temporal fuera del control de
versiones y **borrado al terminar**, con su propia configuración y su propio `webServer`. Ese
arnés **no importa ni una medida de `tests/e2e/geometria.ts`** —sólo el sembrado de la cuenta—
y mide con `getBoundingClientRect()` y `getComputedStyle()` a pelo.

El motivo de medir así está escrito en la propia spec y lo confirmé: `layout.tsx:5` →
`globals.css:3` → `design/tremen-ds/components/index.css:26` → `../responsive.css:11` declara
`html, body { overflow-x: hidden }` por debajo de 720 px, **y la app carga ese fichero**. Un
`scrollWidth` de documento sano no prueba nada aquí, así que todo lo geométrico va **elemento
a elemento** contra `documentElement.clientWidth`, que es lo que un recorte no puede
enmascarar.

**Lo que medí yo mismo, sin creerme la guardia**: la conmutación a los **diez** anchos
(360/390/640/700/720/721/730/760/800/1280) en las dos pantallas; el desborde elemento a
elemento y el inventario de contenedores arrastrables; el inventario de `overflow-x: hidden`;
el suelo táctil de 44 px **sin restar nada** sobre todos los controles en alcance, con el alta
desplegada y con la capa abierta; **las dos reinyecciones de defecto**; los dos suelos
tipográficos sobre la **página entera**; el pie de la tarjeta; los fondos de zona; los rótulos
y valores de la anti-deriva; `aria-sort`; el control de orden y el reordenado; la estructura
y el orden de tabulación de la tarjeta; las cajas de línea de los avisos con un `Range`; y
**M4** sobre la capa abierta desde la primera, la intermedia y la última tarjeta.

#### Las reinyecciones: las dos siguen poniendo rojo lo que tienen que poner

Esto lo comprobé **con mi propio medidor**, no leyendo el informe de la guardia:

| Reinyección | Sano | Con el defecto | Al quitarlo |
|---|---|---|---|
| `.btn-sm { padding: 2px 6px; font-size: 10px }` en `/vigiladas` @360 | 0 | **15** controles a 16 px de alto | 0 |
| `padding-block: 10px` en los campos (el defecto real de `F-VERIF-054-1`) en `/cartera` @360 | 0 | **8** campos a **43,00 exactos** | 0 |

Ninguna de las dos es decorativa, y la segunda es la que importa: `43 < 44 − TOLERANCIA_PX`
es falso, así que **M5 sigue sin ver ese píxel** —da 0— y la afirmación sin holgura de la
guardia sí lo ve. Ése es exactamente el hueco que ADR-035 §2 cierra en el módulo y que
`F-ADR-035-1` deja fuera de esta spec: **la propiedad que CA-13 exige está afirmada, y se
pone roja de verdad.**

#### El único finding

**`F-VERIF-054-2` — CA-15 se contradice consigo mismo: pide que *cada* aviso ocupe más de una
caja de línea, y uno de ellos cabe en una.** Dueño: **sdd-arquitecto**. **No hay trabajo de
implementación.**

CA-15 exige, sobre el mismo sujeto y en la misma frase, que cada aviso *«conserve
`max-width: 34ch` computado»* y que *«envuelva (más de una caja de línea sin partir ni una
palabra, M3)»*. Medido por mí a 360 y a 390 px:

| Aviso (en la tarjeta de `/vigiladas`) | Caracteres | Cajas de línea | Ancho de línea máx. | Caja |
|---|---|---|---|---|
| `.quote-fail` | 91 | **2** | 260,17 px | 270,504 px |
| `.quote-pending` | 52 | **2** | 238,94 px | 270,504 px |
| `.quote-stale` | 45 | **1** | **267,20 px** | 270,504 px |

En `/cartera` los dos avisos ocupan 3 y 2 líneas. O sea: **`.quote-stale` cabe en una línea
por 3,3 px**, y la única forma de hacerle ocupar dos sería **estrechar la caja** — que es lo
que la cláusula anterior del mismo CA prohíbe. La guardia del proyecto lo resolvió afirmando
tres cosas en su lugar —ninguna línea excede la caja, el aviso **más largo** sí envuelve, y
ninguno parte palabra— con el porqué escrito al lado, y **eso es lo correcto**; lo que no
puedo hacer es cerrar en ✅ un CA cuya letra el árbol no cumple.

**Todo lo demás de CA-15 lo verifiqué y se cumple**: texto idéntico carácter a carácter al de
1280, `max-width` computado 270,504 px (= 34ch) en vigiladas y 244,8 px (= 34ch en mono) en
cartera, nunca `none`; ninguna línea por encima de la caja; ninguna palabra partida; ningún
aviso fuera de su tarjeta.

La forma de arreglarlo es la misma que el arquitecto ya usó en CA-19 con la palabra
«reproducible»: decir qué se afirma de qué. Una redacción que sí es verificable sería *«ningún
aviso extiende una línea por encima de su caja, el más largo ocupa más de una caja de línea, y
ninguno parte una palabra (M3)»*.

#### Lo que revisé de la ronda anterior, y una corrección

El encargo me pedía no heredar el juicio anterior. Revisé **los 21 CA de cero** y **volví a
medir con código propio** los diecisiete que dependen de la pantalla, incluidos los que
estaban en ✅. Resultado: **coinciden**, con dos matices que dejo escritos.

1. **Corrección de cifra**: la columna de CA-19 de la ronda anterior decía *«los 27 ficheros
   de cifras `.txt`»*. Son **16 `.txt` + 11 `.png` = 27 ficheros**. Los `.txt` son 16 y son
   los únicos de los que CA-19(a) afirma reproducibilidad; los `.png` son 11 y CA-19(b) dice
   expresamente que no la afirma. Lo comprobé a mano.
2. **Dos observaciones menores que no cambian ningún veredicto** y que anoto para que no se
   redescubran: (i) el `100%` que aparece en `avisos-en-la-tarjeta.txt` sale del árbol de
   tabla **oculto**, porque en esa lectura concreta `AVISOS_SEL` no está acotado a la
   representación viva — la aserción recae sobre un superconjunto, así que **mide de más, no
   de menos**; (ii) el patrón de heredados de la guardia de CA-21 (`\.card\b`) aceptaría
   también una clase futura del estilo `.card-algo`, y hoy no existe ninguna.

Y **una cosa que estaba abierta y ya no lo está**: `F-SPEC-054-5` dudaba de que Next 16
sirviera la etiqueta `<meta name="viewport">` por defecto, porque `layout.tsx` no la declara.
La pedí al HTML servido por `next start` y ahí está:
`<meta name="viewport" content="width=device-width, initial-scale=1"/>`. El defecto **es** el
que se creía. No cambia nada de lo medido aquí, pero la spec 2 se ahorra la comprobación.

#### Mapa de evidencia

Todo bajo `_qa/SPEC-054/`. **Las cifras son la evidencia; las capturas son ilustración**
(CA-19).

| CA | Evidencia (cifras) | Ilustración |
|---|---|---|
| CA-1, CA-2 | `conmutacion-por-ancho.txt`, `canto-del-modo.txt` | `ancho-{360,390,700,730,1280}-{vigiladas,cartera}.png` |
| CA-3 | `una-columna.txt` | `ancho-360-*.png` |
| CA-4 | `m1-m2-m3-telefono.txt` | — |
| CA-5 | `table-scroll-sobre-el-canto.txt` | `ancho-{730,1280}-*.png` |
| CA-6 | `anti-deriva.txt` | — |
| CA-11 | `medidas-cartera.txt`, `medidas-cartera-m3.txt` | `ancho-*-cartera.png` |
| CA-12 | `m4-sobre-tarjetas.txt` | `capa-sobre-tarjeta-360.png` |
| CA-13, CA-17 | `m5-area-tactil.txt`, `entorno-de-las-tablas.txt`, `m5-fuera-de-alcance.txt` *(medido, no afirmado)* | — |
| CA-14 | `suelos-de-legibilidad.txt` | — |
| CA-15 | `avisos-en-la-tarjeta.txt` | `ancho-360-vigiladas.png` |
| CA-20 | `pie-de-la-tarjeta.txt` | `ancho-360-vigiladas.png` |
| CA-21 | `overflow-recortado.txt` | — |

#### Preguntas abiertas para el humano

1. **CA-15: ¿se reescribe la cláusula, o se acepta la salvedad?** Es lo único que separa esta
   spec de un GREEN. La reescritura es de una línea y la hace el arquitecto; no toca ni el
   código ni los tests, que ya afirman lo correcto. Yo no puedo cerrarla en ✅ con la letra
   tal cual está, por la misma razón por la que la ronda 1 no pudo cerrar CA-16.
2. **`F-ADR-035-1` sigue abierto y ahora tiene fecha de caducidad real.** `medirAreaTactil`
   sigue restando `TOLERANCIA_PX`: el suelo efectivo de **M5** es **43**, y sólo la afirmación
   propia de esta spec lo lleva a 44. **ADR-035 está en `borrador` y sin aprobar por el
   humano.** Aprobarlo e implementarlo **antes** de que la spec 2 escriba guardias nuevas de
   M5 es lo que evita decidir contra un suelo equivocado.
3. **`F-SPEC-054-1` no es opcional para la spec 2**: los **12** controles de la nav, la marca,
   el pie y el enlace de feedback están medidos y muy por debajo de 44 (el menor, 36×26). La
   salida es agrandarlos; bajar el suelo sería `F-ADR-026-1` cumpliéndose por escrito.

**Estado de la spec**: la dejo en `en-revision` por instrucción explícita del encargo (*«si
emites RED, no la toques»*). El rol, por defecto, la devolvería a `en-progreso` — pero esto no
vuelve al implementador, vuelve al arquitecto.
