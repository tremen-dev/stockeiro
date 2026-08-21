---
id: SPEC-044
tipo: spec
epica: EPIC-005
estado: aprobada
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-22, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-21, por: humano (Alberto Fojo)}
---
# SPEC-044 — Ajustar las zonas de una vigilada sin perder su episodio

## Problema
Una zona es una **hipótesis sobre el precio**, y las hipótesis se corrigen. Hoy no se
pueden: `src/app/vigiladas/actions.ts` expone alta (`watchAction`) y baja (`removeAction`)
y nada más, así que mover un rango obliga a **quitar y volver a vigilar**. Ese camino no es
equivalente a editar y hace tres daños medibles, todos consecuencia del `ON DELETE CASCADE`
que **ADR-017** puso a `zone_triggers.watched_symbol_id`:

1. **Te vuelve a avisar de algo de lo que ya te avisó.** Sin episodio abierto, el ciclo
   siguiente lee el precio dentro de la zona como una **entrada** (ADR-005, *edge-triggered*)
   y emite otro correo. Mover un rango de 12,00 a 12,50 produce una notificación.
2. **El historial queda huérfano.** Los avisos sobreviven (`notifications.zone_trigger_id`
   es `ON DELETE SET NULL`) pero pierden el episodio que los explicaba.
3. **La vigilada miente sobre su edad.** `created_at` vuelve a hoy.

Esta spec entrega la **edición de los cuatro valores de zona en sitio** y fija la regla que
la hace inofensiva: **el ruido lo genera el precio, no el formulario**. Cubre **CE-1**
(ajustar no destruye nada), **CE-2** (la edición no genera ruido, en sus tres casos) y
**CE-5** (cero regresión) de EPIC-005. Implementa **ADR-028**. Reglas: **RN-10** (zona =
rango, par completo, `min ≤ max`, zonas opcionales e independientes), **RN-11** (entrada en
zona), **RN-13** (disparo por entrada, permanencia observable), **RN-14** (un aviso de
entrada por episodio), **RN-01** (aislamiento). Hereda **ADR-005**, **ADR-007**, **ADR-017**,
**ADR-026** y las validaciones ya resueltas por **SPEC-030**.

**Esta spec no cambia el esquema y no lleva migración** — deliberadamente, porque `main`
migra producción desde cualquier PR (roadmap, "Ops y despliegue"): todo el riesgo de
esquema de EPIC-005 se concentra en SPEC-045.

## Usuarios / roles afectados
- **Usuario final** (autenticado, RN-03; secciones Vigiladas para cualquier rol, ADR-021):
  corrige los rangos de una vigilada que ya tiene, incluido vaciar una zona entera, sin
  perder su antigüedad, sus episodios ni sus avisos, y sin recibir un correo por el gesto.
- **Sistema** (ciclo de refresco): **no cambia**. Reconcilia la zona nueva con el precio en
  su siguiente ejecución, con las reglas de ADR-005 sin modificar.

## Criterios de aceptación
Cada CA es verificable con un test. Unitarios sobre servicio y acción con PGlite
(`makeTestDb`, esquema desde las migraciones reales, ADR-019); **e2e Playwright** los que
dicen pantalla; los del ciclo se ejercen sembrando `quotes` y llamando a
`runRefreshCycle` con proveedor y `sender` **fake**, como ya hacen SPEC-005 y SPEC-006.

### Rebanada 1 — Editar no destruye nada (CE-1)
- **CA-1 (Edición en sitio de los cuatro valores).**
  Dada una vigilada con sus zonas y una antigüedad,
  cuando el usuario cambia cualquiera de `buyMin`, `buyMax`, `sellMin`, `sellMax`,
  entonces la **misma fila** de `watched_symbols` refleja los valores nuevos conservando
  `id`, `userId`, `symbolId` y `created_at`; el recuento de filas de la tabla no cambia
  (no se inserta ni se borra ninguna).
- **CA-2 (Vaciar una zona entera es una edición válida, RN-10).**
  Dada una vigilada con zona de compra y zona de venta,
  cuando el usuario deja vacíos los dos campos de compra y guarda,
  entonces `buy_min` y `buy_max` quedan `null`, la zona de venta queda **intacta**, y la
  vigilada sigue existiendo y sigue vigilando la venta. Vaciar las cuatro también se
  acepta: la vigilada queda sin zonas y no puede disparar (RN-10), sin ser una baja.
- **CA-3 (Los episodios y los avisos siguen siendo suyos).**
  Dada una vigilada con un episodio de zona **abierto**, otro **cerrado** y avisos de
  entrada ya registrados,
  cuando se editan sus zonas,
  entonces las filas de `zone_triggers` son **las mismas** (mismos `id`, `opened_at`,
  `closed_at`, `price`, `as_of`) y ninguna fila de `notifications` cambia: ninguna se
  borra, ninguna pierde su `zone_trigger_id` y ninguna cambia de `payload` o `read_at`.
- **CA-4 (Editar y borrar+recrear dejan de ser el mismo camino).**
  Dadas dos vigiladas equivalentes de un mismo usuario, con episodio abierto y aviso
  emitido,
  cuando a una se le **editan** las zonas y a la otra se le aplica `unwatch` + volver a
  vigilar con esas mismas zonas,
  entonces la editada conserva `id`, `created_at` y su episodio, y la recreada tiene `id` y
  `created_at` nuevos y ningún episodio. La medida de CE-1 es exactamente esta diferencia.

### Rebanada 2 — La edición no genera ruido; solo el precio lo genera (CE-2)
- **CA-5 (Caso 1: sigue dentro → el episodio continúa y no se vuelve a avisar).**
  Dada una vigilada con zona de compra `[12,00 – 14,00]`, última cotización `13,00`,
  episodio abierto y su aviso de entrada ya emitido,
  cuando el usuario cambia la zona a `[12,00 – 14,50]` y después corre el ciclo con esa
  misma cotización,
  entonces el episodio sigue siendo **el mismo** (mismo `id`, `opened_at` sin cambiar,
  `closed_at` null) y sigue habiendo **exactamente un** aviso de entrada para él
  (RN-13/RN-14); no se emite ninguno nuevo, ni de entrada ni por el cambio.
- **CA-6 (Caso 2: el cambio deja el precio fuera → el episodio se cierra).**
  Dada la misma vigilada con episodio abierto y precio `13,00`,
  cuando el usuario cambia la zona a `[10,00 – 11,00]` y corre el ciclo,
  entonces el episodio se **cierra** con `closed_at` = `as_of` del ciclo, no se emite
  ningún aviso por el cierre, y el aviso de entrada anterior sigue en la bandeja intacto.
- **CA-7 (Caso 3: estaba fuera y el cambio lo mete dentro → eso sí es una entrada).**
  Dada una vigilada con zona `[10,00 – 11,00]`, precio `13,00` y **sin** episodio abierto,
  cuando el usuario cambia la zona a `[12,50 – 13,50]` y corre el ciclo,
  entonces se abre un episodio **nuevo** y se emite **exactamente un** aviso de entrada,
  con el precio y el `as_of` de la cotización que lo originó (D-2).
- **CA-8 (La acción de edición no escribe ni un byte fuera de `watched_symbols`).**
  Dada una vigilada cualquiera,
  cuando se ejecuta la edición y **antes** de que corra ningún ciclo,
  entonces `zone_triggers` y `notifications` están **exactamente** como estaban (mismas
  filas, mismos valores) y no se ha enviado nada por el puerto `NotificationSender` (el
  fake no registra ni un envío). Es la garantía dura de ADR-028 pto. 3.
- **CA-9 (El orden del ciclo protege el digest).**
  Dado un usuario con dos vigiladas en zona,
  cuando edita una de modo que su precio quede fuera y a continuación corre el ciclo
  completo,
  entonces el aviso agregado de ese ciclo lista **solo la otra**: los disparos se evalúan
  antes que los avisos (`runRefreshCycle`: ingesta → disparos → avisos) y una vigilada que
  acaba de salir de zona no aparece diciendo que sigue dentro.
- **CA-10 (Editar dos veces antes del ciclo).**
  Dada una vigilada editada dos veces sin que corra ningún ciclo entre medias,
  cuando corre el ciclo,
  entonces se reconcilia **solo** contra los valores vigentes; los intermedios no dejan
  episodio, aviso ni rastro.

### Rebanada 3 — La edición no es una puerta trasera de validación (SPEC-030, RN-10)
- **CA-11 (Coma decimal, misma puerta que el alta).**
  Dada la edición de una zona,
  cuando el usuario escribe `12,5` en un campo,
  entonces se guarda `12.5` sin error, con el **mismo** lector de campos numéricos que usa
  el alta (`readDecimalField`, `src/lib/format/decimal-input.ts`); las reglas de SPEC-030
  aplican íntegras (`1 234,56` → `1234.56`; `1,234` se **rechaza** por ambiguo).
- **CA-12 (`min > max` se rechaza y no se guarda nada, RN-10).**
  Dada una vigilada con zonas válidas,
  cuando el usuario guarda una edición con `min > max` en cualquiera de las dos zonas,
  entonces la operación se rechaza con `InvalidZoneError`, se muestra el mensaje de esa
  zona, y la fila queda **con sus valores anteriores** (la edición es todo o nada; no se
  guarda la zona buena y se descarta la mala).
- **CA-13 (Par incompleto rechazado, RN-10).**
  Dada la edición,
  cuando se envía el mínimo de una zona sin su máximo (o al revés),
  entonces se rechaza con el mensaje de zona incompleta y no se guarda nada. Vaciar
  **ambos** sigue siendo válido (CA-2): la diferencia entre "incompleta" y "vacía" es la
  misma que ya aplica el alta.
- **CA-14 (El error de dato se distingue del fallo nuestro, SPEC-030 CA-10/CA-11/CA-12).**
  Dada la edición,
  cuando el valor es `abc`, entonces el mensaje **nombra el campo y el valor rechazado**,
  dice qué se espera, y **no** escribe traza en el log; cuando falla la base, entonces el
  mensaje es el de "fallo nuestro, reintenta" **y** sí hay traza en el servidor. Los dos
  mensajes son distintos y el test afirma las dos direcciones.
- **CA-15 (Una sola puerta, no dos).**
  Dado el código de la edición,
  cuando se inspecciona,
  entonces la normalización numérica y la validación de par (`validatePair`, RN-10) son
  **las mismas funciones** que usa el alta, sin copia ni variante: no existe un segundo
  normalizador, ni una segunda tabla de mensajes, ni una validación relajada para editar.

### Rebanada 4 — Identidad y aislamiento (ADR-007, RN-01)
- **CA-16 (Identifica por id de vigilada, no por ticker).**
  Dadas dos vigiladas del **mismo ticker en dos mercados** (`SAN`@`BMEX` y `SAN`@`XNYS`,
  ADR-007/ADR-012),
  cuando se edita una,
  entonces cambian **solo** sus zonas; la otra conserva las suyas. La acción recibe el `id`
  de la vigilada, igual que la baja desde SPEC-024, y **no acepta símbolo** (cambiar el
  símbolo está fuera de alcance).
- **CA-17 (Un id ajeno no edita nada y no revela nada, RN-01).**
  Dado el `id` de una vigilada **de otro usuario**,
  cuando se invoca la edición,
  entonces no se modifica ninguna fila y la respuesta es **indistinguible** de la de un id
  inexistente. Requisito de diseño: el `userId` viaja **dentro del `WHERE` del `UPDATE`**,
  no en una comprobación previa que un refactor pueda saltarse.
- **CA-18 (Id ausente o malformado no es una excepción).**
  Dado un `id` vacío, no-uuid o manipulado,
  cuando se invoca la edición,
  entonces no hay nada que editar: no lanza, no revienta la página y la lista queda intacta
  (misma tolerancia que `unwatch`, SPEC-024 CA-12).

### Rebanada 5 — En pantalla (`/vigiladas`)
- **CA-19 (Control de edición por fila, con los valores actuales cargados).**
  Dada una fila de `/vigiladas`,
  cuando el usuario activa su control **Editar**,
  entonces aparece un formulario con los **cuatro campos precargados** con los valores
  vigentes de esa vigilada (una zona sin definir aparece vacía, no con `0`), y el activo
  se muestra identificado (ticker y mercado) **sin buscador y sin poder cambiarse**.
- **CA-20 (Reutiliza la caja del alta; no se inventa una segunda maquetación).**
  Dado el panel de edición,
  cuando se renderiza,
  entonces usa el mismo formulario de zonas que el alta (`WatchForm`) y por tanto la misma
  caja que fija SPEC-040 (anchos, `min-width`, cómo encogen los campos); lo único que no
  monta es el buscador de símbolos. No se declara ancho propio (ADR-026, convención de
  SPEC-040).
- **CA-21 (Guardar cierra; fallar deja el mensaje a la vista).**
  Dado el panel abierto con cambios válidos,
  cuando se guarda,
  entonces la tabla muestra los valores nuevos y el **estado de zona recalculado en render**
  (SPEC-007 CA-1, `entraEnZona` sobre la última cotización) sin recargar a mano, y el panel
  se cierra; con un error de validación el panel **sigue abierto**, con lo escrito y con el
  mensaje visible (mismo comportamiento que el alta, SPEC-041 CA-15).
- **CA-22 (La app dice cuándo llegará el aviso).**
  Dada una edición que deja el precio dentro de una zona en la que no estaba,
  cuando se guarda,
  entonces la pantalla dice que el aviso llega **con el próximo ciclo diario**, usando la
  **misma** constante de cadencia que ya comparten la primera pantalla, `/ayuda` y el estado
  vacío de `/vigiladas` (`CADENCIA_LINEA`, `src/lib/help/content.ts`, SPEC-039 CA-3). No se
  promete inmediatez y no se inventa una frase nueva.
- **CA-23 (Geometría, ADR-026 / SPEC-040).**
  Dada `/vigiladas` con al menos una fila, a los **ocho anchos** declarados en
  `tests/e2e/geometria.ts` (360, 390, 640, 700, 730, 760, 800, 1280),
  cuando se mide con el panel de edición **cerrado** y con el panel **abierto**,
  entonces (a) ningún elemento visible bajo `nav`/`main`/`footer` viola la medida **M1**
  (`right ≤ innerWidth + 1`, `left ≥ −1`); (b) `document.scrollWidth ≤ clientWidth + 1`;
  (c) desplazando `.table-scroll` al extremo derecho se alcanzan **todos** los controles de
  la fila dentro de la ventana, incluido el último (SPEC-040 CA-5); y (d) ninguna etiqueta
  de los controles nuevos parte palabras (medida **M3**). El estado "fila + edición abierta"
  se añade a la barrida: es un estado que solo existe tras un clic y una guardia que no lo
  diera sería el punto ciego que ADR-026 vino a matar (mismo motivo que SPEC-041 CA-22).
- **CA-24 (La tabla que ya existía no se degrada).**
  Dada `/vigiladas` con varias filas,
  cuando se reordena por Nombre o por Estado y luego se edita una fila,
  entonces se edita **la fila pulsada** y ninguna otra (el id viaja con su fila, no con su
  posición), y siguen intactos el color de fondo `zone-<state>`, la etiqueta de estado, el
  motivo de SPEC-016, la marca de "sin refrescar" de SPEC-043, el tipo, el mercado y el
  nombre del activo (SPEC-029, SPEC-041 CA-17/CA-18).

### Rebanada 6 — Cero regresión (CE-5)
- **CA-25 (La promesa de EPIC-001 no se mueve).**
  Dadas las suites de SPEC-003, SPEC-005, SPEC-006 y SPEC-007,
  cuando se ejecutan tras este cambio,
  entonces pasan **sin reescribir ni una aserción de dominio** (se admite ajustar
  selectores e2e, no relajar aserciones), y una vigilada que nadie edita dispara, avisa y
  se muestra exactamente igual que antes.

## Entidades y reglas afectadas
- **`watched_symbols`**: **sin cambio de esquema**. La edición es un `UPDATE` de los cuatro
  `numeric` nullable, identificado por `id` y filtrado por `user_id` en la misma sentencia.
- **`zone_triggers`** y **`notifications`**: **no las toca nadie desde la edición**. Siguen
  siendo, respectivamente, estado derivado del par (zonas, última cotización) y memoria del
  usuario (ADR-017, RN-15).
- **Servicio** (`src/lib/watchlist/service.ts`): la actualización de zonas ya existe dentro
  de `watchSymbol` (upsert por `(userId, symbolId)`, SPEC-003 CA-4/CA-10); lo que falta es
  una operación de **edición por id** que no pase por el buscador de símbolos ni finja un
  alta. Reutiliza `validatePair` y los helpers `has`/`str` sin duplicarlos.
- **Acción** (`src/app/vigiladas/actions.ts`): una tercera server action junto a
  `watchAction` y `removeAction`, con la normalización numérica **fuera** del `try` del
  servicio, como fijó SPEC-030.
- **UI** (`src/app/vigiladas/watched-table.tsx`, `watch-form.tsx`, `alta-vigilada.tsx`):
  control por fila y panel de edición que reutiliza el formulario de zonas.
- Reglas: **RN-01**, **RN-10**, **RN-11**, **RN-13**, **RN-14**, **RN-03**. Decisiones:
  **ADR-028** (la origina), **ADR-005**, **ADR-007**, **ADR-012**, **ADR-017**, **ADR-019**,
  **ADR-021**, **ADR-026**. Ingeniería: **RI-01** no aplica (sin migración); **RI-02** sí,
  como siempre. Términos: `docs/fundacion/dominio.md` (*acción vigilada*, *zona de compra*,
  *zona de venta*, *disparo / entrada en zona*, *estado de zona*, *ciclo de refresco*,
  *asOf*) — **ninguno nuevo**: esta spec no bautiza nada.

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Cambiar el símbolo de una vigilada.** La identidad es `(userId, symbolId)` por unicidad
  de esquema y `(ticker, mic_code)` por ADR-007: sería otra vigilada. Sigue siendo baja +
  alta (EPIC-005, "Fuera").
- **Silenciar y reactivar**, y todo lo que CE-3/CE-4 arrastran: es **SPEC-045**, y llega
  después porque hereda la regla de continuidad que ésta fija.
- **Historial de cambios de zona y deshacer.** La edición pisa los valores anteriores sin
  dejar rastro (ADR-028, F-ADR-028-2). Es esquema nuevo al servicio de una curiosidad que
  nadie ha pedido.
- **Edición masiva o multiselección** ("baja un 5 % todas mis zonas").
- **Notificar en el acto o adelantar el ciclo.** El aviso llega con el ciclo siguiente
  (ADR-028 ptos. 4 y 5); lo único que se hace es **decirlo** (CA-22).
- **Validar signo y rango de los valores de zona.** Hoy `-5` se acepta y se guarda; es
  **F-SPEC-030-2**, la edición lo hereda tal cual y esta spec no lo arregla — arreglarlo
  aquí cambiaría también el alta y sería otra spec.
- **Formatear los importes a español en la tabla** (F-SPEC-030-1, EPIC-MEJORA): los campos
  de edición muestran el valor tal como está guardado.
- **Rediseñar `/vigiladas`.** Se añade una acción por fila y se respeta lo que dejaron
  decidido SPEC-039 (estado vacío, intocable), SPEC-040 (la caja y la guardia) y SPEC-041
  (columnas, orden, alta plegable).

## Notas para el gate humano
Lo que necesitas mirar con lupa antes de firmar:

1. **El hallazgo que abarata la épica: CE-2 no necesita mecanismo nuevo.** ADR-005 no
   compara el precio de ayer con el de hoy; compara *"¿está dentro ahora?"* contra *"¿hay
   episodio abierto?"*. Nunca presupuso que la zona fuera constante, solo que la **fila**
   siguiera siendo la misma. Con la fila intacta, los tres casos de CE-2 son las tres ramas
   que `evaluateTriggers` **ya tiene escritas**. El defecto vive entero en el `DELETE`, no
   en el motor. Por eso **ADR-028 es precisión sobre ADR-005 y no sucesor** — pero sí hace
   falta escribirlo, porque las alternativas equivocadas (cerrar el episodio al editar,
   notificar en el acto) son justo lo que escribiría alguien de buena fe.
2. **Esta spec no migra nada.** Es una propiedad buscada: como cualquier PR migra
   producción (`DATABASE_URL` compartida Production/Preview), EPIC-005 concentra **todo** su
   riesgo de esquema en SPEC-045. Se puede entregar y desplegar 044 sin tocar la base.
3. **La ventana de una cadencia es real y se ve.** Si mueves la zona para que el precio
   quede dentro, la fila dirá "en zona" **al instante** (se calcula en render) y el correo
   llegará **con el ciclo siguiente**, hasta ~24 h después. Es coherente con D-2, pero es
   la primera vez que esa espera la provoca un clic tuyo. CA-22 obliga a decirlo en
   pantalla con la frase de cadencia que ya usamos en tres sitios. **Si prefieres no decir
   nada y dejar que se aprenda solo, es un CA que se cae sin tocar nada más.**
4. **Un episodio puede sobrevivir a una zona que ya no se le parece.** De `12,00–14,00` con
   el precio en 13 a `12,90–13,10`: el episodio continúa, porque sigues estando avisado.
   Parece un bug y es la decisión (ADR-028 pto. 2). Si te chirría, díselo ahora al ADR: es
   el único punto donde CE-2 admitía otra lectura.
5. **Tres acciones por fila en la pantalla más apretada** (R-5). Con SPEC-045 serán
   *Editar*, *Silenciar* y *Quitar*. CA-23 mide con el módulo de ADR-026 a los ocho anchos
   e incluye el estado nuevo "fila + edición abierta"; `overflow: hidden` no cuenta como
   arreglo. Si a 360 px no cabe con dignidad, la salida **no** es esconder controles: es
   apilarlos, y eso se ve en la evidencia de `_qa/`.
6. **Reutilizar el formulario del alta es una decisión de diseño, no pereza** (CA-20). Es lo
   que hace que "la edición no puede tener validación más floja" sea verdad **por
   construcción** y no por vigilancia: si un día alguien afloja la validación, la afloja
   para las dos y lo cazan los tests de SPEC-030.
7. **Términos del dominio (ADR-025): ninguno nuevo.** Esta spec no bautiza nada; el rótulo
   *Editar* es lenguaje corriente. El único término que EPIC-005 necesita es el de SPEC-045.
8. **Orden dentro de la épica**: 044 antes que 045, y no se puede invertir. Si el episodio
   no sabe sobrevivir a una edición, tampoco sabrá sobrevivir a un silencio, y CE-4 se
   apoya en que sobreviva.
