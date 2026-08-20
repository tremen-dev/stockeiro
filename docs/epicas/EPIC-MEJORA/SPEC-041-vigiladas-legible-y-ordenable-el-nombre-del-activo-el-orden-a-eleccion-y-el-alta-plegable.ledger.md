---
id: SPEC-041
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-041 Vigiladas legible y ordenable: el nombre del activo, el orden a elección y el alta plegable

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-041-vigiladas-legible-y-ordenable`, rebasada sobre `origin/main` en `acf90a2`
  (el merge de SPEC-040, PR #43; antes decía `784c1ea`, el de SPEC-039).

### Intendencia — léela antes de tocar nada

- **El directorio del worktree se llama `spec-040`**
  (`D:\src\tremen-dev\stockeiro\.claude\worktrees\spec-040`) **y eso NO significa que ahí
  viva la SPEC-040.** Windows no dejó renombrarlo cuando esta spec se subió de 040 a 041. Ahí
  vive la rama `ft/SPEC-041-vigiladas-legible-y-ordenable`, o sea **esta** spec.
- **`SPEC-040` es otra spec**: `docs/epicas/EPIC-FIX/SPEC-040-el-movil-completa-el-alta-…`
  (*el móvil completa el alta de una vigilada, y la guardia de geometría deja de ser ciega*),
  **`hecho` y ya en `main`** desde el 2026-08-20 (PR #43), con **ADR-026**. **Toca el mismo
  `WatchForm`** que esta spec pliega, así que su código es herencia, no trabajo pendiente:
  `tests/e2e/geometria.ts` es el domicilio de la medida y **CA-14 y CA-22 lo consumen** en vez
  de escribir el suyo.
- **SPEC-039 ya está en `main`** y `hecho`: su estado vacío de `/vigiladas` es **no regresión**
  (CA-21), no un conflicto pendiente.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/watchlist/zone-status.ts` — `ZoneStatusView.name` y `name: symbols.name` en el `select`; `orderBy(symbols.ticker)` intacto | `tests/vigiladas-nombre.test.ts` — «la fila devuelta incluye el nombre», «sin nombre conocido llega con `name` null», «el orden por defecto sigue siendo `orderBy(symbols.ticker)`», «no hay ninguna migración nueva en `drizzle/`», «`symbols.name` sigue siendo NULLABLE» | | ❌ |
| CA-2 | `src/app/vigiladas/watched-table.tsx` (celda «Activo»: `.ticker` + `.activo-nombre`); `src/app/globals.css` `.activo-caja`/`.activo-nombre` | `tests/e2e/vigiladas-orden.spec.ts` — «la primera columna es «Activo» y lleva ticker + nombre en la misma celda, sin columnas nuevas» (9 `<th>`; el nombre debajo, medido con `boundingBox`) | | ❌ |
| CA-3 | `src/app/vigiladas/watched-table.tsx` — `nombre !== '' &&`: el elemento del nombre NO se renderiza | `tests/e2e/vigiladas-orden.spec.ts` — «sin nombre no se inventa un nombre: la celda muestra SOLO el ticker»; `tests/vigiladas-nombre.test.ts` — «sin nombre conocido llega con `name` null» | | ❌ |
| CA-4 | `src/app/globals.css` `.estado-caja` (caja acotada, texto sin recortar) y `.activo-caja` con `min-width`; `watched-table.tsx` (`th.col-estado` / `th.col-activo`) | `tests/e2e/vigiladas-orden.spec.ts` — «a 1280 px la columna Estado no es más ancha que Activo, y el motivo sigue entero» (a: `boundingBox` de los `<th>`; b: texto completo de `FAIL_REASON_TEXT`, sin recorte y con `text-overflow: clip`; c: `getClientRects().length === 1`) | | ❌ |
| CA-5 | `src/app/vigiladas/watched-table.tsx` — `LABEL`, `.zone-label is-<state>`, `data-state` y `.dot`, traídos tal cual de `page.tsx` | `tests/e2e/vigiladas-orden.spec.ts` — «las etiquetas de estado NO cambian: mismo texto, mismo punto, misma clase, mismo `data-state`» (los cinco estados) | | ❌ |
| CA-6 | `src/lib/watchlist/sort.ts` (`CRITERIOS_ORDEN`, «Ticker» primero); `watched-table.tsx` (estado inicial `ticker`/`asc`) | `tests/vigiladas-orden.test.ts` — describe «CA-6» (3 casos); `tests/e2e/vigiladas-orden.spec.ts` — «sin tocar nada, las filas salen por ticker ascendente y el control dice «Ticker»» (incluye que al volver NO se recuerda el orden) | | ❌ |
| CA-7 | `src/lib/watchlist/sort.ts` — `claveDeNombre` + `Intl.Collator('es', { sensitivity: 'base' })` | `tests/vigiladas-orden.test.ts` — describe «CA-7» (4 casos); `tests/e2e/vigiladas-orden.spec.ts` — «por nombre: alfabético en español…» (ascendente y descendente) | | ❌ |
| CA-8 | `src/lib/watchlist/sort.ts` — `PRIORIDAD_ESTADO` y el desempate dentro de `none` por motivo de fallo | `tests/vigiladas-orden.test.ts` — describe «CA-8» (4 casos); `tests/e2e/vigiladas-orden.spec.ts` — «por estado: both → buy → sell → out → none…» (ascendente y descendente) | | ❌ |
| CA-9 | `src/lib/watchlist/sort.ts` — `compararVigiladas` (desempate SIEMPRE ascendente: nombre → ticker → `id`) y `ordenarVigiladas` (ordena una copia) | `tests/vigiladas-orden.test.ts` — describe «CA-9» (6 casos, incluido el determinismo con la lista de entrada invertida) | | ❌ |
| CA-10 | `src/app/vigiladas/watched-table.tsx` — `useMemo` sobre estado de cliente; ni navegación ni parámetro en la URL | `tests/e2e/vigiladas-orden.spec.ts` — «ordenar no dispara ninguna consulta ni recarga la página» (0 peticiones de red, misma URL, marca en `window` viva, mismo precio/`asOf`/`state` por fila) | | ❌ |
| CA-11 | `src/app/vigiladas/watched-table.tsx` — `.orden-control` FUERA de `.table-scroll` y `aria-sort` en los `<th>`; `src/app/globals.css` `.orden-control` | `tests/e2e/vigiladas-orden.spec.ts` — «el control de orden se alcanza en móvil, fuera de la tabla y con `aria-sort`» (390 × 844: `closest('.table-scroll') === null`, caja dentro de la ventana, los tres criterios, `aria-sort` en las dos columnas) | | ❌ |
| CA-12 | `src/app/vigiladas/alta-vigilada.tsx` (con `listaVacia` devuelve `<WatchForm/>` y **ningún** control); `src/app/vigiladas/page.tsx` | `tests/e2e/vigiladas-alta.spec.ts` — «con la lista vacía el alta sigue desplegada, y justo donde SPEC-039 promete» (campos utilizables sin clic, `alta-toggle` ausente, el formulario es el `nextElementSibling` del bloque `vigiladas-vacio`) | | ❌ |
| CA-13 | `src/app/vigiladas/alta-vigilada.tsx` — botón `alta-toggle` con `aria-expanded`/`aria-controls` y foco al buscador al desplegar | `tests/e2e/vigiladas-alta.spec.ts` — «con al menos una fila el alta está plegada tras un control explícito» (a: 0 campos en el DOM; b: texto y `aria-expanded="false"`; c: misma URL, `aria-expanded="true"`, buscador enfocado; y vuelve a plegarse) | | ❌ |
| CA-14 | `src/app/vigiladas/alta-vigilada.tsx`; `src/app/globals.css` `.alta-vigilada` / `.alta-toggle` | `tests/e2e/vigiladas-alta.spec.ts` — «plegada, la zona de alta ocupa menos, y nada se sale por el lado derecho» (390 px: **M1** importada de `tests/e2e/geometria.ts`, alto plegado < desplegado, `.table-scroll` con `overflow-x: auto`); cifras en `_qa/SPEC-041/medidas-alta-plegable.txt` | | ❌ |
| CA-15 | `src/app/vigiladas/alta-vigilada.tsx` — `abierto` vive en el cliente y sobrevive a la revalidación del servidor tras el alta | `tests/e2e/vigiladas-alta.spec.ts` — «dar de alta varias seguidas sigue siendo un flujo, y un error nunca queda escondido» (de 1 a 2 filas sin plegar y con el formulario limpio; alta fallida con `.auth-error` a la vista) | | ❌ |
| CA-16 | `src/app/vigiladas/alta-vigilada.tsx` — plegar DESMONTA `<WatchForm/>`, no lo esconde | `tests/e2e/vigiladas-alta.spec.ts` — «plegar descarta lo escrito, y se comporta igual siempre» | | ❌ |
| CA-17 | `src/app/vigiladas/watched-table.tsx` — cada fila lleva su `zone-<state>`, su `fail-reason`/`data-reason` o su `sin-datos-aun`, `row-type`, `row-market`, precio, `asOf` y zonas | `tests/e2e/vigiladas-orden.spec.ts` — «tras reordenar por Nombre y por Estado, cada fila conserva LO SUYO» (SPEC-007, SPEC-016, SPEC-029 con la celda de mercado VACÍA, D-2 y las zonas) | | ❌ |
| CA-18 | `src/app/vigiladas/watched-table.tsx` — el `<form>` de cada fila sigue llevando `watchedId`, no el ticker ni el índice | `tests/e2e/vigiladas-orden.spec.ts` — «quitar borra la fila que se pulsó, esté donde esté tras ordenar» (mismo ticker en dos mercados, lista reordenada por Estado descendente) | | ❌ |
| CA-19 | Nada nuevo: `page.tsx` conserva textos y marcas y sólo cambia **quién** los pinta. Ninguna aserción ajena se relajó ni se borró; ningún selector de otra spec necesitó ajuste | Las suites completas: `npm test` y `npx playwright test`. Cifras en «Cómo retomar (handoff)» | | ❌ |
| CA-20 | `src/app/vigiladas/page.tsx` y `src/lib/watchlist/zone-status.ts` — la consulta sigue filtrada por el `userId` de la sesión y sólo gana el nombre | `tests/vigiladas-nombre.test.ts` — «el aislamiento por usuario no se relaja al añadir el nombre»; `tests/e2e/vigiladas-orden.spec.ts` — «cada usuario ve sólo las suyas, ordene como ordene» (el documento no contiene ni un ticker ajeno) | | ❌ |
| CA-21 | `src/app/vigiladas/page.tsx` — el bloque `vigiladas-vacio` NO se toca: mismos `data-testid`, mismos textos, leídos de `src/lib/help/content.ts` | `tests/e2e/vigiladas-alta.spec.ts` — «el estado vacío que dejó SPEC-039 sigue intacto, palabra por palabra» (comparado contra el MÓDULO, no contra cadenas tecleadas en el test); `tests/e2e/ayuda.spec.ts` sigue verde **sin tocar una sola aserción** | | ❌ |
| CA-22 | `src/app/vigiladas/alta-vigilada.tsx` — el estado «lista con filas + alta desplegada» que esta spec inventa | `tests/e2e/vigiladas-alta.spec.ts` — «lista con filas + alta desplegada» se mide con M1 a 360 y 390 px» (M1 importada de `tests/e2e/geometria.ts`, acotada a `form.auth-form` **y** sobre la página entera, más la caja del propio control); cifras en `_qa/SPEC-041/medidas-ca22-estado-nuevo.txt` | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-041/. Informe HTML opcional: _qa/SPEC-041/informe.html -->

| CA | Captura / medida en `_qa/SPEC-041/` |
|---|---|
| CA-2 | `ca2-activo-con-nombre.png` |
| CA-3 | `ca3-sin-nombre-solo-ticker.png` |
| CA-4 | `ca4-reparto-del-ancho.png` |
| CA-7 | `ca7-orden-por-nombre.png` |
| CA-8 | `ca8-orden-por-estado.png` |
| CA-11 | `ca11-control-de-orden-movil.png` |
| CA-12 | `ca12-vacio-con-alta-desplegada.png` |
| CA-13 | `ca13-alta-plegada.png`, `ca13-alta-desplegada.png` |
| CA-14 | `medidas-alta-plegable.txt` |
| CA-15 | `ca15-error-a-la-vista.png` |
| CA-17 | `ca17-cero-regresion-tras-ordenar.png` |
| CA-18 | `ca18-quitar-tras-ordenar.png` |
| CA-22 | `ca22-ancho-360-filas-y-alta-desplegada.png`, `ca22-ancho-390-filas-y-alta-desplegada.png`, `medidas-ca22-estado-nuevo.txt` |

## Salvedades / follow-ups
<!-- IDs F-SPEC-041-1, F-SPEC-041-2… con destino (spec futura o EPIC-MEJORA). -->

- **F-SPEC-041-1 — `getOrCreateSymbol` no rellena `name` en símbolos que ya existen.**
  Levantado por la spec (§Notas pto. 6) y **fuera de su alcance por decisión del
  orquestador**: es escritura de datos, no presentación, y **CE-M1** lo saca de EPIC-MEJORA.
  **No se ha implementado aquí.** Destino: EPIC-FIX. Mientras tanto, **CA-3** dice qué se ve
  (sólo el ticker) y **CA-7** garantiza que esas filas se ordenan por su ticker y no forman un
  bloque mudo al final.

- **F-SPEC-041-2 — con la lista vacía NO se pinta el control «+ Vigilar una acción».**
  §Notas pto. 1 lo describía como «siempre presente», pero **CA-12** exige que entre el bloque
  `vigiladas-vacio` y el formulario no haya **ningún control intermedio que haya que pulsar**,
  y colocarlo *después* del formulario sería un botón de plegar sobre un panel que no debe
  poder plegarse ahí. Se resolvió a favor del CA, que es lo testable: con lista vacía se
  renderiza el formulario y nada más. Decisión del implementador; si el gate prefiere lo
  contrario, es una línea en `src/app/vigiladas/alta-vigilada.tsx`.

- **F-SPEC-041-3 — el ancho de la columna «Activo» está acotado en píxeles, no en `ch`.**
  `.activo-caja` declara `min-width: 170px` y `.estado-caja` `max-width: 170px`, y de ahí sale
  **por construcción** el «Estado ≤ Activo» de CA-4(a): no depende de que los nombres del
  proveedor sean largos. El precio es que los dos números están atados entre sí y hay que
  moverlos a la vez. Si algún día la tipografía cambia de escala, el sitio donde mirar es el
  bloque `SPEC-041` de `src/app/globals.css`, que los declara juntos y lo dice.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Estado: implementación completa, los 22 CA con test. Falta la verificación.**

Tres commits sobre `ft/SPEC-041-vigiladas-legible-y-ordenable` (sin push, sin PR):

1. `feat(SPEC-041): el nombre del activo llega a la vista, y el orden ya sabe ordenar`
   — `zone-status.ts` (CA-1) y `sort.ts` (CA-6..CA-9), con sus dos ficheros de Vitest.
2. `feat(SPEC-041): la tabla ordena y el alta solo aparece cuando se va a usar`
   — `watched-table.tsx`, `alta-vigilada.tsx`, `page.tsx`, `globals.css` y los dos ficheros de
   Playwright.
3. `docs(SPEC-041): ledger con la matriz de los 22 CA` — este fichero.

**Qué mirar primero si algo se pone rojo:**

- **El punto ciego de R-3 está cubierto, y no hizo falta tocar ningún test de SPEC-040.**
  Los tests de reinyección que necesitan `form.auth-form` —`geometria-eficacia.spec.ts` (a) y
  CA-8, `geometria-puntos-ciegos.spec.ts` V-SPEC-040-2 y V-SPEC-040-3— corren todos sobre
  **`CUENTA_VACIA`**, o sea sobre la lista vacía, y ahí el formulario **sigue desplegado**
  (CA-12). El único que usa `asegurarVigilada` con el formulario delante es el (c) de CA-7, y
  ese mide **la tabla**, no el formulario. Lo que sí se ha perdido es la medición *incidental*
  del formulario dentro de «`/vigiladas` CON AL MENOS UNA FILA» (`geometria-rutas.spec.ts`):
  eso es exactamente lo que **CA-22** repone, con el clic delante y a los dos anchos del alta.
- **El comparador es puro y está en `src/lib/watchlist/sort.ts`.** Si el orden por estado se
  discute, se cambia ahí una línea (`PRIORIDAD_ESTADO`) y su describe de
  `tests/vigiladas-orden.test.ts`. Nada más depende de él.
- **`npm run build` necesita `DATABASE_URL`** (aunque no abra ninguna conexión), igual que en
  CI. El e2e no arranca sin un `.next` construido:
  `DATABASE_URL=postgres://ci:ci@localhost:5432/ci AUTH_SECRET=… npm run build` y luego
  `npx playwright test`.
- **Cuentas de e2e de esta spec**: cuatro, prefijadas `spec041-` (`spec041-orden@`,
  `spec041-alta@`, `spec041-quitar@`, `spec041-vacio@`), y sus tickers son **exclusivos**
  (`Z4…`) para no reescribir el `name` de símbolos que otras specs asumen. Todo eso vive en
  `tests/e2e/spec041.ts`, con el escenario de orden documentado en una tabla.
