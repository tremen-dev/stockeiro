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
| CA-1 el formulario de alta cabe entero | `src/app/globals.css` (bloque «SPEC-040 CA-1», `.zona-campos` y `min-width: 0` en los ítems de `.auth-form`, `.symbol-*` y `.page > *`) · `src/app/vigiladas/watch-form.tsx` (`.zona-campos` sustituye al `style` en línea) | `tests/e2e/movil-alta.spec.ts` → «ningún control del alta se sale de la columna a 360 ni a 390 px» | Yo, a 360 y 390 px contra la app corriendo: `.symbol-picker` **278** px (right=319) a 360 y **300** (right=345) a 390; los cuatro campos de zona **135** / **146**; botón Vigilar **278** / **300**. Ningún control se sale (`right<=ventana+1`, `left>=-1`). Reproducido con mi propia función, no con la del módulo. | ✅ |
| CA-2 CE-1 entero en un teléfono | mismo arreglo que CA-1 | `tests/e2e/movil-alta.spec.ts` → «CE-1 entero en un teléfono de 360 px, sin desplazar la página» (registro → buscador → elegir candidato → zona → Vigilar) | **Recorrido hecho por mí** a 360×800 con cuenta nueva: portada -> «Crear cuenta» (right=153) -> registro (botón right=319) -> nav «Vigiladas» (right=286) -> buscar «Inditex» -> **elegir el candidato ITX** (right=314, legible: `ITX | Industria de Diseño Textil SA (Inditex) | BME · ACCIÓN · EUR`) -> zona 20/25 -> **Vigilar** (right=319) -> **fila creada** (`ITX … 20 – 25 … Quitar`). `window.scrollX = 0` en todo el recorrido. | ✅ |
| CA-3 desborde medido elemento a elemento | los tres arreglos de `src/app/globals.css` | `tests/e2e/geometria-rutas.spec.ts` → «las cinco rutas públicas…», «las cuatro rutas con sesión…», «/vigiladas CON AL MENOS UNA FILA…» (M1 de `tests/e2e/geometria.ts`) | Medí yo los **ocho anchos** en las **diez** superficies con mi propia función: 0 violaciones en todas. Mi barrido es más amplio que M1 (recorre `body *` y no exime a los descendientes de un contenedor desplazable) y sólo difiere en `/vigiladas` con filas: la tabla dentro de `.table-scroll` (ver §Veredicto). Exclusiones: **una** (`.symbol-results`), con motivo escrito. | ✅ |
| CA-4 el panel no parte palabras y reparte por ancho | `src/app/globals.css` (bloque «SPEC-040 CA-4»: `.cards` a 1 pista < 600 px y 2 pistas 600–1023) | `tests/e2e/geometria-rutas.spec.ts` → «con rol tester (dos tarjetas)…» y «con rol completo (tres tarjetas)…» (M3) | Medido por mí a los ocho anchos: pistas **1** a 360/390, **2** a 640/700/730/760/800, **3** a 1280 (`384px 384px 384px`). Integridad de palabra: ninguna caja de línea supera el número de palabras en ningún ancho (peor caso «Acciones vigiladas» 2 líneas / 2 palabras a 640-730). El reparto de **tres** tarjetas (rol `completo`) queda medido en `_qa/SPEC-040/medidas-panel-3-tarjetas.txt`: 1 pista a 360/390, 3 a 1280. | ✅ |
| CA-5 la tabla se desplaza en su caja | `src/app/globals.css` (`.table-scroll` fuera del `@media`, con `min-width: 0` y `max-width: 100%`) | `tests/e2e/geometria-rutas.spec.ts` → «el documento no se va en horizontal…» y «la tabla sigue siendo legible: … el control de Quitar» | Medido por mí con una fila real: documento **N/N** exacto a los ocho anchos (el 819/760 ha desaparecido). `.table-scroll` computa `overflow-x: auto` a **los ocho** anchos, también a 1280. Tabla legible: desplazada a tope, «Quitar» queda dentro (360: right=327/360 · 760: right=695/760 · 1280: right=1199/1280). | ✅ |
| CA-6 un solo módulo de medida, consumido por las guardias | `tests/e2e/geometria.ts` (M1/M2/M3 + hueco muerto + eje + `ANCHOS` + `EXCLUSIONES_M1`) · migración de `pie-`, `cuenta-`, `admin-` y `ayuda-responsive.spec.ts` | `tests/geometria-guardias.test.ts` (7 casos, unitario: ninguna guardia lee `scrollWidth` por su cuenta, todas importan el módulo, los ocho anchos, exclusiones con motivo, `hidden` no es contenedor desplazable) | Verificado leyendo y con `grep`: `tests/e2e/geometria.ts` es el único sitio del árbol que lee `document.scrollWidth` con fines de desborde. **Las cuatro** guardias importan del módulo (`pie-` los anchos; `cuenta-`, `admin-` y `ayuda-` además M1/M2 y `medirBloques`) y ninguna conserva copia. Cada una mantiene sus umbrales (`FACTOR_MAXIMO` 2.2, `HOLGURA_PX` 60, holgura 12). `tests/geometria-guardias.test.ts` no es vacío: 7 casos que verifican exportaciones, los ocho anchos, exclusiones con motivo y que `hidden` **no** cuente como contenedor desplazable. | ✅ |
| CA-7 prueba de eficacia: la guardia caza los tres defectos | `tests/e2e/geometria.ts` → `DEFECTOS` + `inyectarDefecto` | `tests/e2e/geometria-eficacia.spec.ts` → «(a) el formulario de alta que no puede encoger», «(b) el panel de tres columnas a 390 px», «(c) la tabla sin contenedor propio a 760 px» | **Reinyecté yo los tres defectos** contra la app corriendo. (a) a 360 y 390: sano 0 violaciones -> con defecto **13** (M1) y **35** (mi barrido), peor `strong` ancho=444 right=485/489. (b) a 390: sano 0 rotos -> con defecto **2** («Acciones vigiladas» 8 líneas/2 palabras, «Avisos» 3/1). (c) a 760: sano doc 760/760 y M1=0 -> con defecto doc **819/760** y M1 **28**. Los tres casos de control valen. | ✅ |
| CA-8 la lección de `V-SPEC-039-6`, escrita | `tests/e2e/geometria.ts` (M1 y M2 conviven; M2 nunca va sola) | `tests/e2e/geometria-eficacia.spec.ts` → «con el defecto (a) puesto, la medida de documento NO lo ve y la de elemento SÍ» | Reproducido por mí a 390 px con el defecto (a) puesto: la medida de **documento** informa `390/390`, desborde **0** —no ve nada—; la medida **por elemento** informa **13** violaciones, peor ancho=444 right=489. `V-SPEC-039-6` reproducido y cazado. | ✅ |
| CA-9 el rótulo sale del glosario | `src/app/cuenta/page.tsx` (`<dt data-termino="rol-de-cuenta">Rol de cuenta</dt>`) | `tests/e2e/rotulo-glosario.spec.ts` → «/cuenta rotula el rol con el término del glosario, no con uno propio» (lee la fila de `docs/fundacion/dominio.md`) | `/cuenta` rotula «**Rol de cuenta**» y «Tipo de cuenta» no aparece en la pantalla. El test lee la fila del término en `docs/fundacion/dominio.md` (línea 52) y la compara con lo que pinta el DOM vía `data-termino`; salta en los dos sentidos. Verde en mi ejecución. | ✅ |
| CA-10 no degradar lo entregado | — (no toca comportamiento) | suite completa: `npm run test` 1116/1116 · `npm run test:e2e` 191/191, con `pie-`, `cuenta-`, `admin-`, `ayuda-responsive`, `ayuda`, `vigiladas`, `roles` y `cuenta` dentro | `typecheck` ✅ · `lint` ✅ · `test` **1116/1116** ✅ · `build` ✅ · `db:scan` ✅ · `test:e2e` **191/191** ✅ (2.ª ejecución; ver `V-SPEC-040-1`). A 1280 px comprobado por mí: **3** pistas en `.cards` y `.table-scroll` con contenido 1184 = visible 1184, sin barra. Descartado por medida que las reglas de SPEC-040 alteren `/cuenta` en escritorio. | ✅ |
| CA-11 evidencia medida | — | `_qa/SPEC-040/` (36 capturas + 6 ficheros de medidas), escritas por `tests/e2e/geometria-rutas.spec.ts` y `tests/e2e/movil-alta.spec.ts` | `_qa/SPEC-040/`: **35** capturas (8 anchos × 4 escenarios + 2 del formulario + 1 de CE-1) y **7** ficheros de medidas. Contrasté las cifras del «después» con mis propias medidas y coinciden. Salvedad de sitio, no de fondo: las cifras del «antes» viven en la tabla de este ledger y en el registro de la ejecución (`[SPEC-040 CA-7a/b/c]`), no en `_qa/`; las reproduje yo reinyectando (444 / 819-760 / 8 líneas). | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 11/11 CA cerrados. sdd-verificador, 2026-08-20.**

Verificado sobre `ft/SPEC-040-movil-completa-el-alta-y-guardia-que-lo-ve`, HEAD `91c1720`,
con `npm run build` previo y la app corriendo. **No he editado ni una línea de código,
CSS, test ni spec**: sólo esta mitad del ledger y el frontmatter de la spec.

### Lo que hice yo, no lo que me contaron

1. **Completé el alta en un teléfono de 360 px, de principio a fin.** Cuenta nueva desde la
   portada, registro, buscador, **elección de candidato**, zona 20/25 y **Vigilar**; la fila
   aparece con su zona. Antes de cada clic medí la caja del control: los once quedaron
   dentro de la ventana, y `window.scrollX` fue **0** durante todo el recorrido. Es CE-1 de
   EPIC-004 funcionando en el ancho más estrecho que el proyecto soporta.
2. **Medí los ocho anchos con mi propia función**, escrita aparte y deliberadamente **más
   amplia** que M1: recorre `body *` y **no** exime a los descendientes de un contenedor
   desplazable. Coincide con M1 elemento a elemento en las nueve rutas; la única divergencia
   es la tabla dentro de `.table-scroll`, que es la segunda salida legítima de ADR-026 §4 y
   que comprobé aparte (con la tabla desplazada a tope, la última columna cae dentro de la
   ventana a los ocho anchos).
3. **Ataqué CA-7 reinyectando yo los tres defectos**, y los tres se cazan con las cifras
   correctas. También busqué lo contrario —un defecto que la guardia **no** vea— y encontré
   **dos**, anotados abajo como `V-SPEC-040-2` y `V-SPEC-040-3`. Ninguno se materializa hoy
   en la app: son deuda de la guardia, no de la pantalla, y **no bloquean publicar**.

### La letra pequeña, comprobada

- **`design/tremen-ds/` no se ha tocado**: `git diff origin/main...HEAD -- design/` vacío.
- **`overflow: hidden` no se ha usado como arreglo** en ninguno de los tres defectos. Las
  soluciones son `min-width: 0` (que quepa) y sacar `.table-scroll` del `@media` (su propio
  contenedor declarado, a todos los anchos). Ni un `!important` en el CSS entregado.
- **`document.scrollWidth` con fines de desborde aparece sólo en el módulo.** Las otras dos
  lecturas del árbol son de un **elemento**, no del documento, y cada una la exige su CA:
  `.table-scroll` (informe de CA-5) y `form.auth-form` (CA-1 (c), literal).
- **`hidden` no cuenta como contenedor desplazable en M1**, ni en el código ni en el
  comportamiento: con el `overflow-x: hidden` del sistema puesto, M1 sigue viendo el defecto
  (a). Eso es CA-8 y lo reproduje con las dos cifras.
- **`/cartera` e `/importar` quedan fuera por decisión del gate (`F-SPEC-040-1`)** y no lo
  cuento como incumplimiento; tampoco los medí (con rol `tester` la ruta rebota al panel).

### Guardia por guardia: qué medía antes y qué mide ahora

| Guardia | Antes | Ahora | ¿Perdió poder? |
|---|---|---|---|
| `pie-responsive` (SPEC-035) | 5 anchos propios; altos del pie, hueco muerto y eje | 8 anchos del módulo; mismas afirmaciones y mismo `FACTOR_MAXIMO` 2.2 | **No.** Gana 360, 730 y 800 |
| `cuenta-responsive` (SPEC-036) | M2 + recorrido de `main *` quedándose con **el peor** | M2 + M1 sobre `nav, main, footer`, con **todas** las violaciones y su detalle | **No.** Gana `nav`/`footer` y 3 anchos; sólo deja de mirar dentro de contenedores desplazables (en `/cuenta` no hay ninguno) |
| `admin-responsive` (SPEC-037) | **Sólo** M2 (`scrollWidth − clientWidth`) | M2 **+ M1**; hueco muerto ahora descuenta el `padding` propio | **No: gana.** Estrena la medida por elemento y una medida de hueco más estricta, con el mismo umbral 60 |
| `ayuda-responsive` (SPEC-039) | **Sólo** M2 | M2 **+ M1** en `/`, `/ayuda` y el vacío de `/vigiladas` | **No: gana.** Estrena la medida por elemento |

### Los seis gates, ejecutados por mí

| Gate | Resultado |
|---|---|
| `npm run typecheck` | ✅ exit 0 (`tsc --noEmit`, sin salida) |
| `npm run lint` | ✅ exit 0 (`eslint . --max-warnings=0`, sin salida) |
| `npm test` | ✅ **82 ficheros, 1116/1116** en 138.64 s |
| `npm run build` | ✅ exit 0, 22 rutas |
| `npm run test:e2e` | ✅ **191 passed (3.6 m)** en la 2.ª ejecución. La 1.ª dio **190 passed / 1 failed** por un intermitente ajeno a esta spec (`V-SPEC-040-1`) |
| `npm run db:scan` | ✅ 11 migraciones, 2 con SQL destructivo y desbloqueo escrito |

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

### Residuales que levanta el verificador (2026-08-20)

- **`V-SPEC-040-1` — `admin-grifo.spec.ts` CA-21 es intermitente, y no es de esta spec.**
  En mi **primera** ejecución completa del e2e falló: tras `fill('[data-testid="cupo"]', '')`
  y el clic en guardar, `leerGrifo()` devolvió `{ openManually: true, capacity: 120 }` en vez
  de `capacity: null`. En la **segunda** pasó, y con el fichero aislado pasa 10/10. La causa
  está a la vista: ese paso es el **único** del bloque que lee la base **sin una espera de UI
  entre medias** —los pasos vecinos hacen `await expect(getByTestId(...))` antes de leer—, así
  que compite con la revalidación del server action. El fichero **no lo toca esta rama** y
  SPEC-040 no cambia el grifo. **Impacto**: «toda la suite en verde» (CA-10) no es determinista
  hoy en CI. **Destino**: EPIC-FIX; añadir la espera que falta en
  `tests/e2e/admin-grifo.spec.ts:422`. **No bloquea publicar.**

- **`V-SPEC-040-2` — un `overflow-y: auto` deja ciega a M1 en todo su subárbol.**
  Encontrado atacando CA-7. En CSS, si `overflow-y` es `auto|scroll` y `overflow-x` es
  `visible`, **`overflow-x` computa a `auto`**. M1 exime a los descendientes de cualquier
  elemento con `overflow-x` computado `auto|scroll`, así que basta con que un componente
  declare un área de desplazamiento **vertical** para que su subárbol entero deje de medirse.
  Medido por mí en `/vigiladas` a 360 px: con el defecto (a) puesto, M1 informa **13**
  violaciones; añadiendo `main.page { overflow-y: auto }`, informa **0** y baja de 44 a **23**
  elementos medidos, mientras mi barrido sin exención sigue viendo **35**. Hoy **no se
  materializa**: comprobé a 360/760/1280 en las diez rutas que el único elemento con
  `overflow-x` computado `auto|scroll` es `.table-scroll`, y `.symbol-results` (que es
  `overflow-y: auto`) ya está excluido con motivo. **Destino**: que la exención de M1 exija
  además que el elemento sea de verdad desplazable en horizontal
  (`scrollWidth > clientWidth`), o un `overflow-x` declarado explícitamente. Es la ampliación
  natural de `F-ADR-026-2`. **No bloquea publicar.**

- **`V-SPEC-040-3` — lo que vive fuera de `nav`, `main` y `footer` no lo mide nadie.**
  M1 recorre esas tres raíces, que es literalmente lo que pide CA-3; pero el layout raíz monta
  `<div class="frame">` alrededor de todo, y ni él ni un hipotético hermano de `main` entran en
  la medida. Comprobado: inserté un `<div>` de **900 px** como hijo directo de `.frame` a
  360 px → M1 **0** violaciones, mi barrido **23**, y `document.scrollWidth` **360** (lo tapa
  el `overflow-x: hidden` del sistema). Es decir: **por debajo de 720 px un desborde del chrome
  del layout es invisible a las dos medidas a la vez**. Hoy `.frame` sólo contiene
  `nav`/`main`/`footer` y `next-route-announcer`, así que no hay superficie afectada.
  **Destino**: añadir `.frame` (o `body > *`) a las raíces de M1. **No bloquea publicar.**

- **`V-SPEC-040-4` — evidencia de otras specs, regenerada a medias.** La rama commitea
  capturas nuevas en `_qa/SPEC-037/` y `_qa/SPEC-039/` (los anchos 360, 730 y 800 que estrenan
  sus guardias migradas), pero **no** los `_qa/SPEC-036/medidas-*.txt`, que la migración también
  reescribe: pasan de cinco a ocho anchos y estrenan la columna `violaciones`. Comprobé que la
  diferencia de altura de `/cuenta` entre el fichero commiteado y la ejecución de hoy (zona
  665 → 621 a 1280 px) **no la causa SPEC-040**: neutralizando sus reglas de `min-width` el
  número no se mueve. Es evidencia rancia desde SPEC-036, no una regresión.
  **Destino**: sdd-documentalista. **No bloquea publicar.**

- **Nota sobre el cupo del registro (precisión, no defecto).** `movil-alta.spec.ts` CA-2
  registra **una cuenta nueva por ejecución** (`spec040-movil-<timestamp>@example.com`), como
  debe: el recorrido que mide es el de un desconocido que llega del foro. La cabecera de
  `tests/e2e/spec040.ts` dice «tres cuentas y sólo tres» y el handoff dice «el cupo del registro
  no se toca»; con precisión son **dos fijas más una por ejecución**. Es inofensivo —la base del
  e2e es efímera y se recrea en cada arranque de `tests/e2e/server.mjs`—, pero conviene dejarlo
  escrito para que nadie cuente mal el margen contra el cupo de 50.

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

### Cierre de los dos puntos ciegos y del intermitente (sdd-implementador, 2026-08-20)

**Ronda posterior al GREEN, y no es una ronda RED**: ningún CA falló. El verificador,
atacando CA-7 —buscando lo contrario de lo que se le pedía— dejó escritos dos huecos de la
guardia y un intermitente ajeno. Se cierran **antes de la PR** porque la guardia **es la
razón de ser de esta spec**: dejarla con huecos conocidos es exactamente lo que SPEC-040
vino a evitar.

**Todo el trabajo vive en `tests/`, que no es ruta vigilada (`.sdd.json` vigila `src/` y
`app/`). Ni una línea de `src/` ni de `design/`**: `git diff 2d5ce97..HEAD --stat` toca
cuatro ficheros y los cuatro son de test. La spec **sigue en `hecho`** y su matriz de CA
**no se ha tocado**: es el retrato del gate que se pasó. (Consecuencia visible y
deliberada: la fila de CA-6 sigue diciendo «7 casos» de `tests/geometria-guardias.test.ts`,
que es lo que había al verificar; hoy son **9**, los dos nuevos descritos aquí abajo.)

- **`V-SPEC-040-2` — cerrado.** La exención de M1 miraba el **`overflow-x` computado**, y
  en CSS no existe el par visible/no-visible: si `overflow-y` es `auto|scroll` y
  `overflow-x` es `visible`, el navegador **computa `overflow-x` a `auto`**. Ahora la
  exención exige **las dos cosas**: `overflow-x` computado `auto|scroll` **y** que el
  contenedor esté desplazado de verdad a lo ancho (**`scrollWidth > clientWidth`**).
  - **Reproducido y medido** (`tests/e2e/geometria-puntos-ciegos.spec.ts`, «con el defecto
    (a) puesto, M1 lo sigue viendo…»), a 360 px en `/vigiladas`: con el defecto (a)
    reinyectado, M1 informa **13 violaciones sobre 52 elementos**; añadiendo
    `main.page { overflow-y: auto }` informa **13 sobre 52** — antes bajaba a **0**. El
    test afirma además que el escenario sigue reproduciendo la causa: que `main.page`
    computa `overflow-x: auto` sin haberlo declarado, y que **no** es desplazable a lo
    ancho (contenido 328 = visible 328). Si algún día el motor dejara de computar así, el
    test lo dice en vez de aprobar callado.
  - **La exención legítima sigue viva**, y con la prueba de que *hace* algo: segundo test
    del mismo bloque, `/vigiladas` con fila a 360 px. `.table-scroll` es `overflow-x: auto`
    con **contenido 771 sobre 328 visibles**, y la celda más a la derecha llega a
    **right=786** en una ventana de **360** — o sea, hay desborde real que la exención está
    absorbiendo— y aun así **M1 = 0 violaciones**. Es la segunda salida legítima de
    **ADR-026 §4** funcionando, no un defecto tapado.
  - **Comprobación binaria añadida** a `tests/geometria-guardias.test.ts`: la exención de
    M1 tiene que nombrar `scrollWidth > …clientWidth`. De paso se arregló un test que
    **habría dejado de mirar en silencio**: el de «`hidden` no cuenta» casaba la condición
    con `/if \(ox === …\) return true;/` literal y devolvía `''` —aprobando— en cuanto la
    condición creciera. Ahora, si no encuentra la función, **falla**.

- **`V-SPEC-040-3` — cerrado.** Las raíces de M1 pasan de `nav, main, footer` a
  **`body > *`**. `body` y `html` se quedan fuera a propósito: su caja es el lienzo, y el
  desborde del documento ya lo mide M2.
  - **Reproducido**: un `<div>` de **900 px** colgado de `.frame` a 360 px. **Antes**: M1
    **0** violaciones y documento **360/360** — las dos medidas ciegas a la vez. **Ahora**:
    M1 **1** violación sobre **53** elementos, `peor=div.bloque-ancho-reinyectado
    right=916`. El test afirma también que **M2 sigue sin verlo** (documento 360/360):
    es `V-SPEC-039-6` otra vez, en otra zona de la página, y por eso el hueco era grave.
  - **Coste medido**, no razonado, en las **diez superficies** del conjunto a los **ocho**
    anchos (los ficheros de `_qa/SPEC-040/medidas-*.txt` de dos ejecuciones, antes y
    después):

    | Medida | Antes | Después |
    |---|---|---|
    | elementos medidos por ejecución | **3400** (80 medidas) | **3509** (80 medidas), **+3,2 %** |
    | de los +109: `.frame` | — | **+79**, uno por superficie y ancho |
    | de los +109: celdas de la tabla a 1280 px | — | **+30** (`/vigiladas` con filas: 45 → 75) |
    | `geometria-rutas.spec.ts` (8 tests) | **35,7 s** | **33,4 s** |
    | exclusiones nuevas | — | **ninguna** |
    | violaciones nuevas | — | **ninguna** |

    Los **+30** no son coste: son **cobertura ganada** por la otra mitad del arreglo. A
    1280 px la tabla **cabe** dentro de `.table-scroll`, así que su contenedor ya no está
    desplazado y sus celdas **entran en la medida** por primera vez. El tiempo no se mueve
    (la diferencia está dentro del ruido de dos ejecuciones): ensanchar la raíz **no cuesta
    tiempo medible**, porque `.frame` ya contenía `nav`/`main`/`footer` y lo que se añade
    es lo poco que colgaba del chrome. **Ninguna exclusión nueva hizo falta**: `.frame` es
    `max-width: 1440px; margin: 0 auto`, así que su caja es la de la ventana. La lista de
    `EXCLUSIONES_M1` **sigue teniendo una sola entrada** (`.symbol-results`), que es lo que
    vigila `F-ADR-026-2`.
  - Y queda un test que **paga el coste en voz alta** («el chrome del layout entra en la
    cuenta de elementos medidos…»), para que el día que alguien proponga estrechar la raíz
    «porque la suite tarda» tenga el número delante.

- **`V-SPEC-040-1` — cerrado, y es de SPEC-037, no de esta spec.**
  `tests/e2e/admin-grifo.spec.ts` CA-21. **Qué vigilaba antes**: que al vaciar el campo de
  cupo la base guarde `null` —«sin tope», no cero— y que la pantalla lo diga. **Qué vigila
  ahora**: exactamente lo mismo, en el orden que lo hace comprobable — **primero la señal
  de UI que corresponde al dato, después la lectura de la base**. No perdió ni una
  afirmación: las tres siguen ahí (`capacity: null` en la base, «sin cupo» en pantalla, y
  el cupo 120 previo).

  | Paso de CA-21 | Antes | Ahora |
  |---|---|---|
  | fijar cupo **120** | esperaba `data-abierto=si` —que habla del **interruptor**, no del cupo— y leía la base | espera además **«de 120 plazas»** en `grifo-aforo`, que sí habla del dato que se comprueba |
  | **retirar** el cupo | leía la base **sin ninguna espera**, y luego miraba la pantalla | mira la pantalla (**«sin cupo»**) y **después** lee la base |
  | cupo inválido `-3` | esperaba `grifo-error` visible | igual (ya estaba bien) |

  Ni `skip` ni timeout más largo: las dos cosas esconderían el problema. **Ni una línea de
  `src/`** — el defecto era del test, no del grifo. **Dos pasadas completas del e2e en
  verde**, 195/195 las dos (ver los gates abajo).

- **Los cuatro residuales que NO se cierran aquí siguen abiertos, con su destino intacto**:
  `V-SPEC-040-4` (evidencia rancia en `_qa/SPEC-036/`, para sdd-documentalista),
  `F-SPEC-040-1` (`/cartera` fuera del conjunto), `F-SPEC-040-2` (el gate `require-spec`
  sólo admite el prefijo `ft/`) y `F-SPEC-040-3` (páginas legales de segundo nivel y flujos
  de contraseña sin medir).

- **`_qa/` se restauró antes de cada commit** (`git checkout -- _qa/`): la suite regenera
  las capturas y las medidas de **todas** las specs, y las de `_qa/SPEC-036/` son
  precisamente `V-SPEC-040-4`, que no me toca cerrar. La evidencia commiteada sigue siendo
  la que dejó el verificador; las cifras nuevas de esta ronda viven **aquí** y en el jsdoc
  de `RAICES`.

#### Los cinco gates de esta ronda (sdd-implementador, 2026-08-20)

| Gate | Resultado |
|---|---|
| `npm run typecheck` | ✅ exit 0 (`tsc --noEmit`, sin salida) |
| `npm run lint` | ✅ exit 0 (`eslint . --max-warnings=0`, sin salida) |
| `npm test` | ✅ **82 ficheros, 1118/1118** en 152,11 s (1116 + los 2 casos nuevos de `geometria-guardias`) |
| `npm run build` | ✅ exit 0 |
| `npm run test:e2e` | ✅ **195 passed (3,2 m)** y ✅ **195 passed (3,1 m)** — **dos** pasadas completas, las dos en verde (191 + los 4 tests nuevos) |

## Cómo retomar (handoff)

**Estado: verificada GREEN 11/11, spec en `hecho`, y los dos puntos ciegos que el
verificador levantó (`V-SPEC-040-2` y `V-SPEC-040-3`) más el intermitente ajeno
(`V-SPEC-040-1`) ya cerrados encima, sólo en `tests/`.** Lo que queda es la PR.

- **Rama**: `ft/SPEC-040-movil-completa-el-alta-y-guardia-que-lo-ve` (renombrada, ver
  `F-SPEC-040-2`), sobre `origin/main` con SPEC-039 dentro. Sin push, sin PR.
- **Gates** (última ronda): `typecheck` ✅ · `lint` ✅ (`--max-warnings=0`) · `test` ✅
  **1118/1118** · `build` ✅ · `test:e2e` ✅ **195/195**, **dos veces**. (En la ronda de
  implementación fueron 1116 y 191: la diferencia son los 2 casos unitarios y los 4 tests
  e2e que cierran los puntos ciegos.)
- **Dónde están los puntos ciegos cerrados**: `tests/e2e/geometria-puntos-ciegos.spec.ts`
  (4 tests, reinyectan el escenario como manda ADR-026 §7). El arreglo de `V-SPEC-040-2`
  es la exención de M1 en `tests/e2e/geometria.ts` (`dentroDeContenedorDesplazable`, ahora
  exige `scrollWidth > clientWidth`); el de `V-SPEC-040-3`, la constante `RAICES` del mismo
  fichero (`nav, main, footer` → `body > *`), con el coste medido escrito en su jsdoc.
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
