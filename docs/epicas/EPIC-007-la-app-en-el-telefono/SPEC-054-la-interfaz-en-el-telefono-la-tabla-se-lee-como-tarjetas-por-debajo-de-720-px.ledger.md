---
id: SPEC-054
tipo: ledger
epica: EPIC-007
---
# Ledger — SPEC-054 La interfaz en el teléfono: la tabla se lee como tarjetas por debajo de 720 px

## Resumen
- Fase: `en-revision` — **implementada, ronda 2**, pendiente de re-verificación. El gate
  humano dijo que sí el 2026-08-24 y el orquestador registró `aprobada`; sdd-implementador
  la pasó a `en-progreso` y, terminada la entrega, a `en-revision`. La verificación devolvió
  **RED** con un único finding de implementación (`F-VERIF-054-1`, el suelo táctil), y la
  ronda 2 lo cierra: la spec volvió a `en-progreso` y otra vez a `en-revision`. **El
  veredicto RED de más abajo es el de la ronda 1 y se deja tal cual: lo reescribe el
  verificador, no el implementador.**
- Rama: `ft/SPEC-054-la-interfaz-en-el-telefono-la-tabla-se-lee-como-tarjetas-por-debajo-de-720-px`,
  abierta desde `origin/main` (primer commit `492c53f`). **Nueve commits**: seis de la
  ronda 1 y tres de la 2. Sin push, sin PR, sin merge.
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
| CA-1 — el modo conmuta, y en el canto exacto (tarjetas ≤720, tabla ≥721; nunca las dos ni ninguna) | `src/app/globals.css` §SPEC-054 (los dos bloques `@media`: `max-width: 720px` apaga `table.data-table` y `.table-scroll`, `min-width: 721px` apaga `.tarjetas`) · `src/app/vigiladas/watched-table.tsx` y `src/app/cartera/page.tsx` montan los dos árboles | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-1: en cada ancho hay UNA representación viva, y es la que toca» (8 anchos × 2 pantallas; `display` computado + `checkVisibility()`) · **mutación**: quitar `table.data-table { display: none }` lo pone rojo | | Playwright **propio**, sin importar `geometria.ts`: 10 anchos × 2 pantallas. A 360/390/640/700/**720**, `table.data-table` computa `display:none` y `checkVisibility()=false`, y `ul.tarjetas` `display:grid` visible; a **721**/730/760/800/1280, al revés. En ningún ancho las dos ni ninguna. Coincide con `_qa/SPEC-054/conmutacion-por-ancho.txt`, que tras re-ejecutar la e2e volvió **byte a byte idéntico**. | ✅ 
| CA-2 — el canto queda entre 700 y 730, dos anchos medidos adyacentes | `src/app/globals.css` §SPEC-054 (el canto, escrito por sus dos lados) | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-2: el canto está donde dice ADR-034 §1, medido a los dos lados» (720 y 721 px) · `tests/spec054-breakpoint-y-rutas.test.ts` › «CA-2: `ANCHOS` contiene 700 y 730, y no hay ningún ancho medido entre ellos» | | Medido por mí a **720 px** (tarjetas) y **721 px** (tabla). `ANCHOS` = [360, 390, 640, 700, 730, 760, 800, 1280]: 700 y 730 son adyacentes y no hay ningún ancho medido entre ellos. `npx vitest run` verde (1702/1702). | ✅ 
| CA-3 — una tarjeta por fila y una fila por tarjeta, en el mismo orden | `src/app/globals.css` › `.tarjetas { grid-template-columns: 1fr }` (fuera de los bloques de modo: es el mismo reparto en toda la franja) | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-3: N filas → N tarjetas, en el mismo orden y en una sola columna» (360/390/640/700; la columna única se afirma por la propiedad —dos tarjetas no comparten línea— no por el `grid-template-columns`) | | Mi guardia a 360/390/640/700: **7** `<li>` en /vigiladas y **5** en /cartera, mismos tickers y mismo orden que los `<tr>` a 1280, y `top(i) ≥ bottom(i-1)` en todas las tarjetas de los cuatro anchos — una sola columna en toda la franja, no sólo en los dos de teléfono. | ✅ 
| CA-4 — cero desborde horizontal a 360 y 390 en las dos páginas (M1+M2+M3) **y ni un contenedor que arrastrar** | Los dos árboles + `src/app/globals.css` §SPEC-054 (`.tarjeta`, `.tarjeta-datos`, `min-width: 0` en cada nivel) | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-4: en un teléfono no desborda nada y no queda nada que arrastrar» — M1, M2, M3 y **`medirOverflowHorizontal`**, que es la mitad que ni M1 ni M2 responden | | Medido **elemento a elemento con código mío**, no por el `scrollWidth` de `body` (que aquí no prueba nada: `design/tremen-ds/responsive.css:11` pone `html, body { overflow-x: hidden }` por debajo de 720 y la app lo carga). A 360 y 390: **285** elementos pintados en /vigiladas y **156** en /cartera, **0** con `right > clientWidth+1` o `left < -1`, y **0** contenedores con `overflow-x: auto|scroll` y `scrollWidth > clientWidth`. M1/M2/M3 de la guardia, verdes. | ✅ 
| CA-5 — `.table-scroll` intacta y funcional a 730/760/800/1280 (cero regresión de SPEC-040 CA-5) | `src/app/globals.css`: la declaración de SPEC-040 CA-5 **no se toca**; sólo se le añade `display: none` dentro del bloque de 720 | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-5: por encima del canto, la tabla se sigue desplazando en SU caja» (`overflow-x`, `min-width`, `max-width`, M2, y que arrastrando se alcanza la última columna a 730 y 760) · `tests/e2e/geometria-rutas.spec.ts` › SPEC-040 CA-5, verde | | A 730/760/800/1280 en las dos pantallas: `.table-scroll` computa `overflow-x: auto`, `min-width: 0px` y `max-width: 100%`; a **730** `scrollWidth 933 > clientWidth 634` (sí desborda y desplazándola se alcanza la última columna) y `documentElement.scrollWidth == clientWidth` a los cuatro anchos. SPEC-040 CA-5 verde sin aflojar nada. | ✅ 
| CA-6 — anti-deriva: la tarjeta dice todo lo que dice la fila, con el mismo rótulo | `src/app/columnas.tsx` (la descripción compartida) · `src/app/vigiladas/columnas-vigiladas.tsx` · `src/app/cartera/columnas-cartera.tsx` — las dos formas salen de la MISMA función `valor()` y del MISMO `rotulo` | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-6: ni un dato de menos, ni un rótulo distinto, ni un rótulo inventado» (celda a celda a 1280 contra la tarjeta a 360, más el conjunto `<dt>` = `<th>` − promocionados) · **mutación**: un `<td>` de más en la tabla, pintado saltándose la descripción, lo pone rojo | | Comparación propia celda a celda: los 9 `<th>` de 1280 menos `Activo`, `Estado` y la columna sin rótulo dan exactamente los **6** `<dt>` de cada tarjeta (`Precio, A fecha, Zona compra, Zona venta, Tipo, Mercado`), con un `<dt>` por `<dd>`, y **todo** texto de celda aparece en su tarjeta en las 7 filas. Ni un rótulo inventado ni un dato de menos. | ✅ 
| CA-7 — `aria-sort` desaparece con la tabla y vuelve con ella | `src/app/vigiladas/columnas-vigiladas.tsx` (`ariaSort` por columna) + el `display: none` de CA-1, que es lo que retira del árbol de accesibilidad | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-7: `aria-sort` es de una tabla, y desaparece con ella» (cero elementos con `aria-sort` **pintados** a 360/390; exactamente uno distinto de `none` a 730/760/800/1280) | | A 360 px, elementos con `aria-sort` **pintados = 0** (los `<th>` siguen en el DOM, pero `display: none` los retira del árbol de accesibilidad). A 1280 px, exactamente **uno** distinto de `none` (`TH:ascending`). | ✅ 
| CA-8 — el orden se sigue diciendo y se sigue pudiendo cambiar en móvil | `src/app/vigiladas/watched-table.tsx` — `.orden-control` **no se toca**: sigue fuera de `.table-scroll` (SPEC-041 CA-11) y visible a todos los anchos | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-8: el orden se sigue diciendo y se sigue pudiendo cambiar en móvil» (nombre accesible, criterio activo, `aria-pressed`, y la secuencia de tickers tras ordenar por Estado igual a la de 1280) | | Guardia del proyecto verde y **no vacía**: exige `.orden-control` visible a 360 y 390, etiqueta accesible «Ordenar por», criterio activo, `aria-pressed="false"` en el botón de dirección, y que al ordenar por «Estado» la secuencia de tickers de las tarjetas sea **idéntica** a la de las filas a 1280. | ✅ 
| CA-9 — orden de lectura = orden del DOM = orden del boceto; `<dl>` con `<dt>` por `<dd>` | `src/app/vigiladas/watched-table.tsx` (el `<li>`: cabecera → estado → `<dl>` → pie) · `src/app/columnas.tsx` › `ordenEnLaTarjeta` (el orden del boceto, distinto del de la tabla) · `globals.css` (rejilla de colocación automática, sin `order`/`grid-row`/`direction`) | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-9: el orden de lectura es el del boceto, y nada lo reordena» (estructura del DOM, un `<dt>` por `<dd>`, `medirPropiedadesComputadas` sobre `order`/`grid-row-start`/`grid-column-start`/`direction`, nombre accesible de la lista y recorrido con el tabulador) | | Verificado por mí a 360 px: hijos del `<li>` en el orden del boceto (`tarjeta-cabecera → tarjeta-estado → tarjeta-datos → fila-acciones tarjeta-pie`), `<dt>`/`<dd>` 1:1, `aria-label="Acciones vigiladas"`, y **ninguna** propiedad reordenante — `order` / `grid-row-start` / `grid-column-start` / `direction` en su valor inicial en los 285 elementos medidos. El recorrido con el tabulador lo afirma la guardia, verde. | ✅ 
| CA-10 — el estado de zona sigue siendo el fondo, con el mismo color computado (SPEC-007) | `src/app/vigiladas/watched-table.tsx` (`zone-${state}` en el `<li>`) · `src/app/globals.css`: `.tarjeta` **no declara `background`**, a propósito, para no tapar el tinte de zona | `tests/e2e/tarjetas-conmutacion.spec.ts` › «CA-10: el fondo de la tarjeta es el de su fila, con el mismo color computado» (los cinco estados, `background-color` idéntico al del `<tr>`, un solo color de borde para todos y la etiqueta de texto viva) | | `background-color` computado **idéntico** entre el `<li>`@360 y su `<tr>`@1280 en los cinco estados: both `srgb .7296 .8681 .3674 / .19`, buy `.4863 1 .698 / .11`, sell `1 .7216 0 / .12`, out `.9608 .9451 .9176 / .03`, none `rgba(0,0,0,0)`. `.tarjeta` no declara `background`; `.zone-label.is-*` sigue viva; sin distintivo, borde de color ni icono nuevos. | ✅ 
| CA-11 — `/cartera` entra en el conjunto de rutas medidas, a los ocho anchos | `tests/e2e/rutas.ts` (nuevo: las tres listas, importables sin arrancar el navegador) · `tests/e2e/geometria-rutas.spec.ts` las consume | `tests/e2e/geometria-rutas.spec.ts` › «SPEC-054 CA-11: /cartera con posiciones, M1 + M2 + M3 a los ocho anchos» · `tests/spec054-breakpoint-y-rutas.test.ts` › «CA-11: la ruta está en el conjunto, y retirarla se ve en rojo» + «la guardia consume el conjunto compartido» · **mutación**: vaciar `RUTAS_CON_POSICIONES` lo pone rojo | | `/cartera` está en `RUTAS_CON_POSICIONES` y en `RUTAS_MEDIDAS` (`tests/e2e/rutas.ts`); `tests/spec054-breakpoint-y-rutas.test.ts` lo afirma **y** exige que la guardia importe de `./rutas` en vez de copiarse la lista. El caso e2e mide M1 + M2 + M3 a los ocho anchos con 5 posiciones y precondición afirmada. `medidas-cartera.txt` y `medidas-cartera-m3.txt` se regeneraron idénticos. | ✅ 
| CA-12 — M4 sobre la capa de edición, con lista larga afirmada y en tres posiciones (ADR-030) | La capa **no se mueve**: `dialog.editar-vigilada` intacto. Lo único nuevo es `data-editando` en el `<li>` y `.tarjeta.fila-editando` en `globals.css` | `tests/e2e/tarjetas-capa-edicion.spec.ts` › tres casos: M4 en las tres posiciones a 360/390 con la precondición **derivada** sobre la lista de tarjetas; el foco que vuelve por guardar, cancelar y Escape; y la capa anclada a la ventana. La capa entra en M1 como **testigo** | | `_qa/SPEC-054/m4-sobre-tarjetas.txt` regenerado idéntico: 3 posiciones × 2 anchos, precondición **derivada** (12 tarjetas; fondo de la lista en 4219, o sea 3419 px por debajo del pliegue a 360), capa `top=383 bottom=800` sobre una ventana de 800 (cabe entera) y **el desplazamiento del documento igual antes y después** del gesto (0→0, 2213→2213, 3781→3781). La capa no entra en `EXCLUSIONES_M1`. Foco de vuelta por guardar, cancelar y Escape: verde. | ✅ 
| CA-13 — **M5** en el módulo compartido, suelo 44×44, con prueba de eficacia por reinyección | `tests/e2e/geometria.ts` › `SUELO_TACTIL_PX`, `SELECTOR_INTERACTIVO`, `medirAreaTactil`, `describirAreaTactil`, `DEFECTO_AREA_TACTIL` · `src/app/globals.css`: `.btn-sm` pasa de ≈31 a 46 px de alto y `.orden-control select` a 45, **sólo por debajo del canto**. **Ronda 2 (F-VERIF-054-1)**: los campos de formulario suben de **43,00** a **45** px con `padding-block: 11px` en el mismo bloque de 720 (`.auth-form input/select/textarea` y `.symbol-search-input`) — 11 + 11 de relleno + 1 + 1 de borde + 21 de línea. **Ni `padding` de dos valores** (se comería el `padding-right: 34px` del cheurón del `select`, que se declara antes en el fichero) **ni `min-height`** (la altura dejaría de derivarse de la caja y un defecto futuro en el relleno o en el tamaño de letra no la bajaría: la medida se volvería decorativa, ADR-026 §7). El porqué está escrito al lado de la regla | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-13: todo control llega al suelo táctil, y la medida ve el defecto» (0 de 17 controles por debajo del suelo; reinyección `.btn-sm { padding: 2px 6px; font-size: 10px }` → rojo, quitada → verde) · `tests/spec054-m5-en-el-modulo.test.ts` (7 casos: el 44 con su fuente citada, los siete tipos de control, las dos mitades, y que ninguna guardia escriba el número por su cuenta) · **ronda 2**, en la misma guardia de CA-13: `camposBajoElSuelo` mide los campos con `medirCajas` —el primitivo del módulo— y afirma el suelo **sin tolerancia ninguna**, tal cual lo escribe el CA («caja de al menos 44 × 44 px CSS»). No toca `medirAreaTactil`, ni `TOLERANCIA_PX`, ni el suelo: apretar la afirmación hasta el número que el CA declara no es aflojar un umbral. Rojo antes del arreglo (8 campos a 43,00 en `/cartera`, 5 en el alta desplegada), verde después. Y la misma guardia **abre ahora la capa de edición**, que `RAICES_EN_ALCANCE` nombraba desde el primer día sin que ninguna guardia de este fichero llegara a abrirla: 6 controles medidos, 0 por debajo | | **RED.** (a) La prueba de eficacia **sí funciona**, y lo comprobé aparte con código mío: `.btn-sm` sano mide **46 px** de alto y con `.btn-sm { padding: 2px 6px; font-size: 10px }` reinyectado baja a **16 px**, dejando 16 controles por debajo del suelo; el arreglo está escrito donde la reinyección lo puede deshacer (sin `min-height` y sin subir la especificidad). (b) **Pero el suelo no se cumple**: medidos con mi propio código, **todos** los campos de formulario en alcance miden **43.00 px** exactos de alto — 8 en los formularios de compra y venta de `/cartera`, 5 en el alta desplegada de `/vigiladas` y 4 en la capa de edición. No es una fracción de redondeo: es `height: 43px` computado. Pasan **sólo** porque `medirAreaTactil` compara contra `suelo − TOLERANCIA_PX`, y `TOLERANCIA_PX = 1` está documentado en el módulo como tolerancia de **redondeo del motor** («NO es una holgura de diseño»). Con el suelo tal cual lo escribe el CA, `/cartera` va **8 de 13** en alcance, no 0 de 13. (c) Y el CA dice «todo elemento interactivo visible» de las dos páginas mientras la guardia lo acota a `main.page, dialog.editar-vigilada`: fuera quedan **12 de 30** controles rojos en /vigiladas (documentado como F-SPEC-054-1). | ⚠️ 
| CA-14 — los dos suelos de legibilidad: controles ≥16 px, texto ≥12 px | `src/app/globals.css` §SPEC-054: `.orden-control select`, `.auth-form input/select/textarea`, `.symbol-search-input` a 16 px; **`.page-head .eyebrow` a 12** (hallazgo: el sistema de diseño lo pisa a 11 px) | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-14: 16 px en los controles de formulario y 12 px en cualquier texto», con el alta **desplegada** para que sus campos entren en la medida (`medirSuelosTipograficos`) | | Verificado por mí en las dos pantallas a 360 y 390: (a) ningún `input`/`select`/`textarea` visible por debajo de **16 px** (mínimo = 16), incluidos los del alta desplegada y los de la capa de edición; (b) **cero** nodos de texto por debajo de **12 px**, y lo medí sobre **toda la página**, no sólo `main.page`, que es lo que el CA pide. `.page-head .eyebrow` sube de 11 a 12 sólo por debajo del canto. | ✅ 
| CA-15 — los avisos de diagnóstico no se rompen en formato tarjeta (`34ch`, envuelven, completos) | `src/app/globals.css` › `.tarjeta-estado .estado-caja`: **no** sobrescribe el `max-width: 34ch` de `.quote-*`, al revés de lo que hace `.data-table .estado-caja` | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-15: los avisos conservan su caja, envuelven y se leen enteros» (texto idéntico al de 1280, `max-width` distinto de `none`, ninguna línea por encima de la caja, el más largo envuelve, ninguno parte palabra, y ninguno se sale de su tarjeta) | | A 360 y 390, los tres avisos de la tarjeta computan `max-width: 270.504px` = **34ch** (no `none`; `.tarjeta-estado` no lo sobrescribe), `font-size: 12px`, texto idéntico carácter a carácter al de 1280, envuelven y **ninguno se sale de su tarjeta** (`right ≤ li.right`). En /cartera, `244.8px` = 34ch en mono. Nota: el `100%` que aparece en `avisos-en-la-tarjeta.txt` viene del árbol de **tabla oculto** — `AVISOS_SEL` de la guardia no está acotado a la representación viva. | ✅ 
| CA-16 — cero regresión funcional: suites enteras verdes y diff acotado (CE-5) | No hay implementación: es el resultado. El diff **no toca** `src/db/`, `drizzle/`, `src/lib/portfolio/`, `src/lib/watchlist/zone-status.ts` ni `src/lib/market/` | `npx vitest run` → **1702/1702** en 112 ficheros · `npx playwright test` → **323/323**. Detalle de los seis ficheros que sí se tocaron y por qué, en §Decisiones y hallazgos | | **Salvedad, y el CA es autocontradictorio.** Lo medible se cumple: `npx vitest run` **1702/1702** en 112 ficheros; `npx playwright test` **323/323** (7,4 min); `npm run typecheck` y `npm run lint --max-warnings=0` en verde; `npm run version:check` 0.3.4 → 0.4.0 con el árbol limpio. El diff **no toca** `src/db/`, `drizzle/`, `src/lib/portfolio/`, `src/lib/watchlist/zone-status.ts` ni `src/lib/market/` (comprobado con `git diff --name-only origin/main...HEAD`). Pero **tres de las siete guardias que el CA nombra «sin tocarse» sí se tocaron** (`vigiladas-editar`, `vigiladas-capa-edicion`, `geometria-rutas`), además de `geometria-puntos-ciegos` y `movil-alta`. Leí los seis diffs: **ninguna aserción se afloja** — cambian localizadores, una espera y el conjunto de anchos, con el motivo escrito al lado. | ⚠️ 
| CA-17 — cabecera, control de orden, alta plegable y formularios de cartera cumplen M1/M3/M5 | `src/app/globals.css` §SPEC-054 (los mismos agrandados de CA-13 y CA-14, **incluido el `padding-block: 11px` de la ronda 2**, que es lo que sube a 45 px los 8 campos de los formularios de compra y venta y los 5 del alta desplegada) | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-17: cabecera, orden, alta plegable y formularios de cartera» — cinco superficies × 2 anchos × alta **plegada y desplegada**, con M1 rooteado en cada una (y su testigo), M5, M3 sobre el rótulo del orden y cero contenedores que arrastrar. **Ronda 2**: cada superficie pasa además por `camposBajoElSuelo`, el suelo sin tolerancia; la cifra queda escrita superficie a superficie en `_qa/SPEC-054/entorno-de-las-tablas.txt` | | **RED en M5.** M1 y M3 sí: cabecera, control de orden, alta plegada y desplegada y formularios de cartera dan 0 violaciones y 0 contenedores que arrastrar a 360 y 390, comprobado también con mi medida propia. Pero **M5 no**: las superficies que este CA nombra son exactamente donde están los 43.00 px — los formularios de compra y venta de `/cartera` (8 campos) y el alta desplegada de `/vigiladas` (5 campos). Ver CA-13 (b). | ⚠️ 
| CA-18 — un solo breakpoint de modo en `globals.css`, afirmado por test | `src/app/globals.css`: toda la conmutación vive en los dos lados del mismo canto | `tests/spec054-breakpoint-y-rutas.test.ts` › cuatro casos: los cantos declarados, que sólo el bloque de modo cambia representaciones, que **toda** regla de `display` sobre la tabla o las tarjetas vive en él, y que existen las dos caras · **mutación**: un `@media` de 480 px o un `display` fuera del bloque lo ponen rojo | | **Salvedad: la letra del CA es falsa sobre el árbol.** La parte fuerte sí se cumple y la comprobé: **todas** las reglas de `display` sobre `table.data-table`, `.tarjetas` y `.table-scroll` viven en los dos lados del canto de 720, y el bloque de densidad sólo toca `.cards`. Pero `globals.css` declara los cantos **[599, 720, 1023]** y el CA dice «no aparece ningún cuarto valor». El 1023 ya estaba (borde superior del bloque de `.cards`) y el test lo declara con su motivo en vez de tolerarlo en silencio — pero afirma una propiedad distinta de la que el CA escribe (F-SPEC-054-3). | ⚠️ 
| CA-19 — evidencia reproducible sólo bajo `_qa/SPEC-054/` | — | 26 ficheros bajo `_qa/SPEC-054/`: cifras de M1/M2/M3/M5 por ruta y por ancho, el inventario de `overflow`, las medidas de M4 y el pie, capturas de las dos pantallas a 360/390/700/730/1280 y la capa abierta sobre una tarjeta a 360. Las capturas ajenas se restauraron con `git checkout -- _qa/`: **ninguna otra `_qa/SPEC-NNN/` aparece en el diff** | | **27** ficheros bajo `_qa/SPEC-054/` y **ninguna otra `_qa/SPEC-NNN/` en el diff** (`git diff --name-only origin/main...HEAD -- _qa` devuelve sólo `_qa/SPEC-054`). Y son reproducibles de verdad: tras re-ejecutar la e2e completa, los **27 ficheros de cifras `.txt` volvieron byte a byte idénticos**; sólo cambiaron los 11 PNG. La pasada tocó 241 capturas ajenas y las restauré con `git checkout -- _qa/`. | ✅ 
| CA-20 — pie de tarjeta: *Editar* y *Quitar* al 50 %, misma fila, cada uno ≥44×44 | `src/app/globals.css` › `.tarjeta-pie { display: grid; grid-template-columns: 1fr 1fr }` + `.tarjeta-pie form { display: grid }` y `.tarjeta-pie .btn-sm { width: 100% }` — con la aritmética de la tercera acción de ADR-034 §10 escrita al lado | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-20: *Editar* y *Quitar*, misma fila, mitad y mitad, y pulsables» (mismo `top`, anchos iguales, los dos más el hueco = el ancho del pie, y cada uno ≥ el suelo en los dos ejes) | | Medido por mí a 360 y 390 en los **7** pies: pie de **294 px** con hueco 8 → *Editar* **143** y *Quitar* **143** (143 + 143 + 8 = 294); a 390, pie 316 → 154 + 154 + 8. Mismo `top` (707,13 y 624,25), alto **46 px** los dos, ancho ≥ 44 y solape **0**. | ✅ 
| CA-21 — la salida prohibida no se usa: ni un `overflow: hidden` nuevo (R-2 de EPIC-007) | `src/app/globals.css` §SPEC-054: ni una regla de `overflow` nueva | `tests/e2e/tarjetas-geometria.spec.ts` › «CA-21: ni un `overflow: hidden` nuevo, y los que hay son los de siempre» (inventario en tiempo de ejecución contra los heredados) · `tests/spec054-breakpoint-y-rutas.test.ts` › dos casos sobre la fuente · **mutación**: un `overflow-x: hidden` en `.tarjeta > *` lo pone rojo | | En ejecución a 360 y 390, los únicos `overflow-x: hidden` son `html`, `body` (sistema de diseño), `table.data-table` (árbol oculto) y `form.card.auth-form` (`.card`, del sistema desde el primer commit): **ninguno lo añade esta spec**. En la fuente, la sección §SPEC-054 de `globals.css` no declara ni una regla de `overflow`. Nota: aparece además `overflow-x: clip` en `input` y `.symbol-search-input`, que es el valor por defecto del agente de usuario para campos de texto, no una regla del proyecto. La lista de heredados que enumera el CA **no incluye `.card`** (F-SPEC-054-3). | ✅ 

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

## Cómo retomar (handoff)

- **Rama**: `ft/SPEC-054-la-interfaz-en-el-telefono-la-tabla-se-lee-como-tarjetas-por-debajo-de-720-px`,
  desde `origin/main` (`492c53f`). **Nueve commits** (seis de la ronda 1, tres de la 2).
  **Sin push, sin PR, sin merge.**
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

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### 🔴 RED — 2026-08-24, sdd-verificador

**17 de 21 CA cerrados (✅), 4 con salvedad (⚠️), y de esos cuatro hay uno que es un
incumplimiento medible y no una discusión de redacción.** Lo que devuelve la spec es
**CA-13 (b)**, y su reflejo en **CA-17**.

#### Gates automáticos — todos verdes

| Gate | Resultado |
|---|---|
| `npm run typecheck` | ✅ exit 0 |
| `npm run lint` (`--max-warnings=0`) | ✅ exit 0 |
| `npx vitest run` | ✅ **1702/1702** en 112 ficheros |
| `npx playwright test` | ✅ **323/323** en 7,4 min |
| `npm run version:check` | ✅ 0.3.4 → 0.4.0, árbol limpio (sin abstención de SPEC-049) |
| `_qa/` ajeno | ✅ 241 capturas de otras specs tocadas por la pasada y restauradas con `git checkout -- _qa/`; el diff sólo lleva `_qa/SPEC-054/` |

**Verifiqué con Playwright y con medidas escritas por mí**, sin importar
`tests/e2e/geometria.ts`, precisamente porque `design/tremen-ds/responsive.css:11` declara
`html, body { overflow-x: hidden }` por debajo de 720 px y la app carga ese fichero: un
`scrollWidth` de documento sano aquí no prueba nada. Todo lo geométrico está medido
**elemento a elemento** contra `documentElement.clientWidth`, que es lo que `overflow:
hidden` no puede enmascarar (recorta el pintado, no la caja de maquetación).

#### El finding que devuelve la spec

**F-VERIF-054-1 — el suelo táctil de 44 px no se alcanza: los campos de formulario miden
43.00 px exactos, y pasan por la tolerancia de redondeo.**

Medido por mí a 360 y 390 px, con `getBoundingClientRect()` sin redondear:

| Superficie (en alcance por el §Fuera de alcance de la spec) | Campos a 43.00 px |
|---|---|
| Formularios de compra y venta de `/cartera` | **8** (`symbolId`, `quantity`, `price`, `gastos` ×2) |
| Alta plegable de `/vigiladas`, **desplegada** | **5** (`symbol-search-input`, `buyMin`, `buyMax`, `sellMin`, `sellMax`) |
| Capa de edición (`dialog.editar-vigilada`) | **4** (`buyMin`, `buyMax`, `sellMin`, `sellMax`) |

`height: 43px` computado, `box-sizing: border-box`, `padding: 10px/10px`, `border: 1px/1px`,
`font-size: 16px`. **No es una fracción de redondeo: es 43.000 exactos.**

La guardia los da por buenos porque `medirAreaTactil` filtra con
`m.alto < suelo - tolerancia`, y `TOLERANCIA_PX = 1` está documentado en el propio módulo
como *«Tolerancia de redondeo del motor… NO es una holgura de diseño: es que
`getBoundingClientRect()` devuelve fracciones y `clientWidth` enteros»*. Aquí no hay
fracción que tolerar, así que la tolerancia está funcionando como **holgura del suelo**, que
es la forma suave de lo que ADR-034 §6 y `F-ADR-026-1` prohíben por escrito. Con el suelo
aplicado tal cual lo escribe CA-13, `/cartera` va **8 de 13** controles en alcance por
debajo, no «0 de 13».

**Lo que NO es el problema, y conviene decirlo porque era la sospecha principal:** la prueba
de eficacia por reinyección **funciona de verdad**. Lo comprobé aparte: `.btn-sm` sano mide
**46 px** de alto y, con `.btn-sm { padding: 2px 6px; font-size: 10px }` inyectado, baja a
**16 px** y pone 16 controles bajo el suelo. El arreglo está escrito donde la reinyección lo
puede deshacer —sobre `.btn-sm` a pelo, sin `min-height` y sin subir la especificidad—, tal
como el CSS dice de sí mismo. **El medidor no es decorativo.** Lo que falla es que su umbral
efectivo es 43 y no 44.

**Salida legítima**: agrandar (`padding: 10px` → `11px` en esos campos, sólo por debajo del
canto, o `min-height` — con la cautela de no romper la reinyección de `.btn-sm`, que es otra
regla). **Salida prohibida**: dejarlo como está apoyándose en `TOLERANCIA_PX`.

#### Tres CA que están mal redactados, y no es culpa de quien implementa

Van al arquitecto (o al humano), no a otra ronda de implementación:

1. **CA-16 es autocontradictorio con CA-11 y con CA-1.** Nombra siete guardias que «siguen
   verdes **sin tocarse**», y una de ellas es `geometria-rutas.spec.ts`, que CA-11 obliga a
   modificar. Y tres de las siete conducen la tabla a 360/390 px, donde CA-1 manda que la
   tabla salga del árbol. Revisé los seis diffs uno a uno: **ninguna aserción se afloja** —
   cambian localizadores (a la representación viva), una espera y el conjunto de anchos, con
   el motivo escrito al lado; `spec043`/`spec044` incluso miden **más** superficie que antes.
   Confirma F-SPEC-054-2.
2. **CA-18 dice «no aparece ningún cuarto valor» y sí aparece.** `globals.css` declara los
   cantos `[599, 720, 1023]`; el 1023 es el borde superior del bloque de densidad de
   `.cards` y **ya estaba antes de esta spec**. El test lo declara con su motivo y añade un
   caso que exige que ese bloque toque `.cards` y nada más — que es lo que lo hace inofensivo
   — pero afirma una propiedad distinta de la que el CA escribe. Confirma F-SPEC-054-3.
3. **CA-13 pide «todo elemento interactivo visible» de las dos páginas, y el §Fuera de
   alcance de la misma spec deja fuera la navegación global y el pie.** La guardia acota a
   `main.page, dialog.editar-vigilada` y deja la cifra completa escrita sin afirmarla:
   **12 de 30** controles por debajo del suelo en `/vigiladas` y 12 de 26 en `/cartera`, los
   mismos doce (nav, marca, pie, enlace de feedback). Es una decisión defendible y bien
   documentada (F-SPEC-054-1), pero el CA no la autoriza por escrito.

También queda anotado que **CA-21 enumera los `overflow-x: hidden` heredados sin incluir
`.card`** (`design/tremen-ds/components/cards.css`), presente desde el primer commit y vivo
en los formularios de `/cartera`. La regla del CA («salvo los que ya lo tenían antes de esta
spec») sí se cumple; lo incompleto es la enumeración.

#### Preguntas abiertas para el humano

- **¿Se acepta CA-16 como ⚠️** —seis ficheros re-encuadrados, cero aserciones aflojadas, las
  dos suites enteras verdes— **o se reabre su redacción?** Yo no puedo cerrarlo en ✅ con la
  cláusula «sin tocarse» tal cual está.
- **EPIC-007 ya tiene un CE-7** (semántica, foco y teclado, añadido el 2026-08-24), pero la
  rejilla de trazabilidad de la spec (§Notas para el gate, 9) sigue diciendo que CA-14 y
  CA-7/CA-8/CA-9 no cuelgan de ningún CE o cuelgan de CE-4 «con lectura forzada». Es *drift*
  de documento, no de código, y conviene corregirlo antes de las specs 2 y 3.
- **F-SPEC-054-5 sigue abierto**: `<meta name="viewport">` no está declarado y esta spec no
  lo ha comprobado en el HTML servido. Toda la geometría de aquí se mide con el viewport que
  fija Playwright, que no pasa por esa etiqueta. No bloquea, pero es lo primero de la spec 2.

**Estado de la spec**: lo dejo en `en-revision` por instrucción explícita del encargo (el
rol, por defecto, la devolvería a `en-progreso`). No he tocado ni una línea de código.
