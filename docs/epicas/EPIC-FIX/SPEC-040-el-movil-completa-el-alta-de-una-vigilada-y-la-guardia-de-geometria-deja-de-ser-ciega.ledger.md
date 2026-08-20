---
id: SPEC-040
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-040 El móvil completa el alta de una vigilada, y la guardia de geometría deja de ser ciega

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-040-movil-completa-el-alta-y-guardia-que-lo-ve`
  **(renombrada desde `fix/SPEC-040-…`; ver §Salvedades, `F-SPEC-040-2`)**

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 el formulario de alta cabe entero | `src/app/globals.css` (bloque «SPEC-040 CA-1», `.zona-campos` y `min-width: 0` en los ítems de `.auth-form`, `.symbol-*` y `.page > *`) · `src/app/vigiladas/watch-form.tsx` (`.zona-campos` sustituye al `style` en línea) | `tests/e2e/movil-alta.spec.ts` → «ningún control del alta se sale de la columna a 360 ni a 390 px» | | ❌ |
| CA-2 CE-1 entero en un teléfono | mismo arreglo que CA-1 | `tests/e2e/movil-alta.spec.ts` → «CE-1 entero en un teléfono de 360 px, sin desplazar la página» (registro → buscador → elegir candidato → zona → Vigilar) | | ❌ |
| CA-3 desborde medido elemento a elemento | los tres arreglos de `src/app/globals.css` | `tests/e2e/geometria-rutas.spec.ts` → «las cinco rutas públicas…», «las cuatro rutas con sesión…», «/vigiladas CON AL MENOS UNA FILA…» (M1 de `tests/e2e/geometria.ts`) | | ❌ |
| CA-4 el panel no parte palabras y reparte por ancho | `src/app/globals.css` (bloque «SPEC-040 CA-4»: `.cards` a 1 pista < 600 px y 2 pistas 600–1023) | `tests/e2e/geometria-rutas.spec.ts` → «con rol tester (dos tarjetas)…» y «con rol completo (tres tarjetas)…» (M3) | | ❌ |
| CA-5 la tabla se desplaza en su caja | `src/app/globals.css` (`.table-scroll` fuera del `@media`, con `min-width: 0` y `max-width: 100%`) | `tests/e2e/geometria-rutas.spec.ts` → «el documento no se va en horizontal…» y «la tabla sigue siendo legible: … el control de Quitar» | | ❌ |
| CA-6 un solo módulo de medida, consumido por las guardias | `tests/e2e/geometria.ts` (M1/M2/M3 + hueco muerto + eje + `ANCHOS` + `EXCLUSIONES_M1`) · migración de `pie-`, `cuenta-`, `admin-` y `ayuda-responsive.spec.ts` | `tests/geometria-guardias.test.ts` (7 casos, unitario: ninguna guardia lee `scrollWidth` por su cuenta, todas importan el módulo, los ocho anchos, exclusiones con motivo, `hidden` no es contenedor desplazable) | | ❌ |
| CA-7 prueba de eficacia: la guardia caza los tres defectos | `tests/e2e/geometria.ts` → `DEFECTOS` + `inyectarDefecto` | `tests/e2e/geometria-eficacia.spec.ts` → «(a) el formulario de alta que no puede encoger», «(b) el panel de tres columnas a 390 px», «(c) la tabla sin contenedor propio a 760 px» | | ❌ |
| CA-8 la lección de `V-SPEC-039-6`, escrita | `tests/e2e/geometria.ts` (M1 y M2 conviven; M2 nunca va sola) | `tests/e2e/geometria-eficacia.spec.ts` → «con el defecto (a) puesto, la medida de documento NO lo ve y la de elemento SÍ» | | ❌ |
| CA-9 el rótulo sale del glosario | `src/app/cuenta/page.tsx` (`<dt data-termino="rol-de-cuenta">Rol de cuenta</dt>`) | `tests/e2e/rotulo-glosario.spec.ts` → «/cuenta rotula el rol con el término del glosario, no con uno propio» (lee la fila de `docs/fundacion/dominio.md`) | | ❌ |
| CA-10 no degradar lo entregado | — (no toca comportamiento) | suite completa: `npm run test` 1116/1116 · `npm run test:e2e` 191/191, con `pie-`, `cuenta-`, `admin-`, `ayuda-responsive`, `ayuda`, `vigiladas`, `roles` y `cuenta` dentro | | ❌ |
| CA-11 evidencia medida | — | `_qa/SPEC-040/` (36 capturas + 6 ficheros de medidas), escritas por `tests/e2e/geometria-rutas.spec.ts` y `tests/e2e/movil-alta.spec.ts` | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual

Todo en `_qa/SPEC-040/`. Capturas a los **ocho anchos** (360, 390, 640, 700, 730, 760,
800, 1280) de `/vigiladas` vacía y con filas, y de `/dashboard` con dos y con tres
tarjetas; más el formulario de alta a 360 y 390 y el recorrido de CE-1 completado.

| CA | Evidencia |
|---|---|
| CA-1 | `ancho-360-alta-formulario.png`, `ancho-390-alta-formulario.png`, `medidas-formulario-alta.txt` |
| CA-2 | `ancho-360-ce1-completado.png` |
| CA-3 | `medidas-rutas-publicas.txt`, `medidas-rutas-con-sesion.txt`, `medidas-vigiladas-con-filas.txt` |
| CA-4 | `ancho-<N>-dashboard-tester.png`, `ancho-<N>-dashboard-completo.png`, `medidas-panel-2-tarjetas.txt`, `medidas-panel-3-tarjetas.txt` |
| CA-5 | `ancho-<N>-vigiladas-con-filas.png`, `medidas-tabla-vigiladas.txt` |
| CA-7 / CA-8 | las cifras se imprimen en la ejecución con prefijo `[SPEC-040 CA-7a/b/c]` y `[SPEC-040 CA-8]` |

### Las tres cifras, antes y después

Medidas con la app corriendo, no razonadas. El «antes» es la ejecución RED sobre el
build de `origin/main` + SPEC-039; el «después», el build de esta rama.

| Medida | Antes | Después |
|---|---|---|
| `.symbol-picker` a **360** px (columna 320) | **444** px, `right`=485 | **278** px, `right`=319 |
| `.symbol-picker` a **390** px (columna 350) | **444** px, `right`=489 | **300** px, `right`=345 |
| campo `min`/`max` de zona a 360 px | **218** px cada uno (2×218+8 = **444**) | **135** px cada uno |
| campo `min`/`max` de zona a 390 px | **218** px cada uno | **146** px cada uno |
| documento en `/vigiladas` con filas a **730** | **819**/730 (desborde 89) | **730**/730 (0) |
| documento en `/vigiladas` con filas a **760** | **819**/760 (desborde 59) | **760**/760 (0) |
| documento en `/vigiladas` con filas a **800** | **819**/800 (desborde 19) | **800**/800 (0) |
| `.table-scroll` `overflow-x` a 730/760/800 | `visible` | `auto` |
| pistas de `.cards` a **360** y **390** | **3** (`98.66px ×3`) | **1** |
| pistas de `.cards` a 640/700/730/760/800 | 3 | **2** |
| pistas de `.cards` a **1280** | 3 | **3** (sin cambio) |
| «Acciones vigiladas» a 390 px | **8 líneas** para 2 palabras | **1 línea** |
| M1 en `/vigiladas` con filas a 360 px | **35** violaciones | **0** |

## Salvedades / follow-ups

- **`F-SPEC-040-1` (ya declarado en la spec, §Fuera de alcance pto. 6).** `/cartera` monta
  su tabla en el mismo `.table-scroll` y su tabla es **más ancha** que la de vigiladas.
  El arreglo de CA-5 la beneficia **de rebote** —`overflow-x: auto` ya no vive dentro del
  `@media`—, pero **nadie lo ha medido**: la ruta queda fuera del conjunto por decisión
  del humano. **Destino**: entra al conjunto de rutas de la guardia el día que Cartera se
  abra a alguien que no sea el titular.

- **`F-SPEC-040-2` — la rama tuvo que renombrarse.** El encargo la nombraba
  `fix/SPEC-040-movil-completa-el-alta-y-guardia-que-lo-ve`, pero el gate **require-spec**
  del estándar (`core/lib/require-spec.mjs`, `RAMA_SPEC_RE = /^ft\/(SPEC-\d{3})-/`) sólo
  admite el prefijo `ft/`, y bloquea **tanto la edición de `src/` como el pre-commit**. Con
  el nombre `fix/` no se podía escribir ni una línea de código vigilado. Se renombró con
  `git branch -m` a `ft/SPEC-040-movil-completa-el-alta-y-guardia-que-lo-ve`, que es lo que
  hicieron todas las specs anteriores de EPIC-FIX (p. ej. `ft/SPEC-033-…`). **Nada más
  cambió**: mismo historial, mismo punto de partida. **Destino**: que quien encargue la
  siguiente rama de EPIC-FIX use `ft/`, o que se decida arriba si el gate debe aceptar
  otros prefijos — no es decisión de la implementación.

- **`F-SPEC-040-3` — las tres páginas legales de segundo nivel no las mide nadie
  elemento a elemento.** El conjunto de rutas de CA-3 incluye `/legal`, pero **no**
  `/legal/aviso-legal`, `/legal/privacidad` ni `/legal/terminos`, que son las que de verdad
  llevan texto largo y tablas de categorías de dato. Tampoco `/forgot-password` ni
  `/reset-password/[token]`. Ninguna estaba en el conjunto que fijó la spec y **no se
  amplía por cuenta propia**. **Destino**: la primera spec que toque cualquiera de ellas
  las añade al conjunto, que es exactamente lo que obliga ADR-026 §2.

- **Hallazgo del as-built, no residual: el 444 px no lo causaba el buscador.** La spec
  atribuía los 444 px a `.symbol-picker` y a `.symbol-search-input`. Medido: los causaban
  **los campos de zona**. Cada `<input>` sin `size` mide **218 px** de mínimo intrínseco con
  la tipografía de la app —no los 170–180 que suponía la hipótesis— y la fila `min`/`max`
  son dos con 8 px de hueco: **218 + 8 + 218 = 444**. Como ningún ítem de `.auth-form` ni de
  `.page` declaraba `min-width`, ese 444 se propagaba a la columna entera y de ahí al
  buscador, al `<strong>` y al botón «Vigilar», que sólo eran **víctimas**. La hipótesis
  declarada en la spec (§«El suelo baja a 360 px») **se confirma y se queda corta**.

- **Hallazgo: bajar el suelo a 360 y añadir 730/800 NO destapó ningún desborde nuevo** en
  las pantallas ya entregadas. Las cuatro guardias migradas (`pie-`, `cuenta-`, `admin-` y
  `ayuda-responsive`) pasan a medir a los **ocho** anchos —y `admin-` y `ayuda-` estrenan
  además la medida por elemento, que no tenían— y **todas quedan verdes sin tocar ni un
  umbral**. Era el riesgo R-2 de la spec; no se materializó.

- **`admin-responsive.spec.ts` mide ahora el hueco muerto de forma más estricta.** Antes
  comparaba el alto **con** `padding` contra 60 px de holgura; el módulo compartido
  descuenta el `padding` propio del bloque antes de comparar (mejora que SPEC-039 había
  hecho sólo en su fichero). El umbral **sigue siendo suyo y sigue siendo 60**: se estrechó
  la medida, no se aflojó nada, y la guardia sigue en verde.

- **Trampa de flujo local (no es defecto del proyecto):** `npm run test:e2e` arranca
  `next start` sobre el `.next` que haya, así que **sin `npm run build` previo se mide el
  build anterior**. La CI sí construye antes del job de e2e (`.github/workflows/ci.yml`,
  step «Build»), así que es sólo un pie del que hay que acordarse en local.

## Cómo retomar (handoff)

**Estado: implementación completa, los once CA con su test, los cinco gates en verde.**
Spec en `en-revision`. Falta el paso del verificador.

- **Rama**: `ft/SPEC-040-movil-completa-el-alta-y-guardia-que-lo-ve` (renombrada, ver
  `F-SPEC-040-2`), sobre `origin/main` con SPEC-039 dentro. Sin push, sin PR.
- **Gates**: `typecheck` ✅ · `lint` ✅ (`--max-warnings=0`) · `test` ✅ **1116/1116** ·
  `build` ✅ · `test:e2e` ✅ **191/191**.
- **⚠️ Para reproducir el e2e**: `npm run build` **antes** de `npm run test:e2e`, o se
  medirá el build anterior y saldrán rojos justo los CA de esta spec.
- **Dónde está lo importante**: el módulo compartido es `tests/e2e/geometria.ts`; su
  comprobación binaria, `tests/geometria-guardias.test.ts`; la prueba de eficacia,
  `tests/e2e/geometria-eficacia.spec.ts`. Los tres arreglos de CSS son tres bloques
  comentados en `src/app/globals.css` («SPEC-040 CA-1», «SPEC-040 CA-4», «SPEC-040 CA-5»).
- **Cuentas del e2e**: tres con prefijo `spec040-` (`spec040-vacio@example.com`,
  `spec040-filas@example.com` y una nueva por ejecución para CA-2), declaradas y
  justificadas en la cabecera de `tests/e2e/spec040.ts`. El cupo del registro no se toca.
- **`design/tremen-ds/` no se ha tocado**, ni una línea. `html, body { overflow-x: hidden }`
  sigue puesto: con M1 ya no esconde nada.
- **Para el verificador**: la forma barata de comprobar que la guardia mira, y no sólo
  pasa, es leer la salida de `[SPEC-040 CA-7a/b/c]` y `[SPEC-040 CA-8]` en la ejecución
  del e2e. En la última: con el defecto (a) puesto a 390 px, la medida de **documento**
  informa desborde **0** y la de **elemento** informa **13 violaciones**, la peor de
  **444 px** llegando a `right=489` sobre una ventana de 390. Eso es `V-SPEC-039-6`
  reproducido y cazado.
