---
id: SPEC-045
tipo: spec
epica: EPIC-005
estado: aprobada
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-22, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-21, por: humano (Alberto Fojo)}
---
# SPEC-045 — Silenciar una vigilada: calla los avisos sin cegar la vigilancia, y al reactivarla cuenta lo que se perdió

## Problema
A veces la vigilada sigue siendo buena pero el aviso sobra: el valor está lejos, o
simplemente no quieres oírla ahora. **Hoy la única forma de no oír una vigilada es no
tenerla**, y quitarla borra sus episodios (ADR-017), deja sus avisos huérfanos y le resetea
la edad. El usuario paga con vigilancia lo que quería pagar con silencio.

Esta spec entrega el estado **silenciada** con el significado exacto que fijó el humano:
*calla, pero sigue viva*. Cubre **CE-3** (se puede callar una vigilada sin cegarla),
**CE-4** (al quitar el silencio, la app cuenta lo que pasó mientras callaba —y cuánto lleva
así—) y **CE-5** (cero regresión) de EPIC-005. Implementa **ADR-029** y hereda **ADR-028**
(el episodio sobrevive al cambio de opinión del usuario), que es lo que hace posible que
sobreviva también a un silencio.

Tres cosas que esta spec trata como **requisito** y no como detalle:

- **R-3 — el digest no sabe de silencios.** SPEC-006 entrega aviso individual **y** aviso
  agregado, y el agregado se construye aparte. Una silenciada tiene que desaparecer de los
  **dos**, o el silencio será mentira el primer día que se agrupe.
- **R-6 — el silencio puede tapar la promesa del producto.** Una vigilada callada y
  olvidada es exactamente el fallo que EPIC-FIX persiguió durante ocho specs: la app deja
  de avisar y el usuario **no se entera de que no le avisa**. Por eso sigue en la tabla, con
  su estado real y con la marca de que calla y desde cuándo.
- **R-2 — hay migración, y una PR de esta épica migra producción** (`DATABASE_URL`
  compartida Production/Preview, roadmap "Ops y despliegue"). La migración es **aditiva y
  nullable** a propósito: es la más benigna que existe y no necesita desbloqueo de SPEC-032.

Reglas: introduce **RN-17**; consume **RN-01**, **RN-03**, **RN-10**, **RN-11**, **RN-13**,
**RN-14**, **RN-15**, **RN-16**; ingeniería **RI-01** y **RI-02**.

## Usuarios / roles afectados
- **Usuario final** (autenticado, RN-03): silencia una vigilada que no quiere oír ahora, la
  sigue viendo con su precio y su estado reales en `/vigiladas`, y al quitarle el silencio
  se entera de lo que pasó mientras callaba y de **cuánto lleva así**.
- **Sistema** (ciclo de refresco): **la ingesta y el motor no cambian**. El único que
  aprende qué es el silencio es el **notificador** (SPEC-006), en sus dos avisos.

## Criterios de aceptación
Cada CA es verificable con un test. Unitarios con PGlite (`makeTestDb`, esquema aplicado
desde las migraciones reales, ADR-019); ciclo completo con proveedor y `NotificationSender`
**fake** vía `runRefreshCycle`; **e2e Playwright** los que dicen pantalla.

### Rebanada 1 — El estado existe, y es una fecha
- **CA-1 (Columna nueva, migración aditiva, RI-01).**
  Dado el esquema actual,
  cuando se aplica la migración de esta spec,
  entonces `watched_symbols` gana `silenced_at timestamptz` **nullable, sin `default` y sin
  relleno**; `npm run db:scan` (SPEC-032) sigue saliendo **0** y **no** hace falta ninguna
  entrada nueva en `drizzle/destructive-waivers.json`; la migración aplica limpia sobre
  PGlite y toda la suite arranca (ADR-019). Las filas existentes quedan con `null`, que es
  "no silenciada".
- **CA-2 (Silenciar).**
  Dada una vigilada propia que habla,
  cuando el usuario la silencia,
  entonces su `silenced_at` queda con la fecha del gesto, la operación informa de que hizo
  algo, y **ninguna otra tabla cambia** (`zone_triggers` y `notifications` idénticas).
- **CA-3 (Reactivar: quitarle el silencio).**
  Dada una vigilada silenciada,
  cuando el usuario le quita el silencio,
  entonces su `silenced_at` vuelve a `null` y, otra vez, ninguna otra tabla cambia.
- **CA-4 (Los dos gestos son idempotentes, y el "desde cuándo" no se pierde).**
  Dada una vigilada ya silenciada,
  cuando se silencia otra vez,
  entonces `silenced_at` **no se mueve** (conserva la fecha original); y quitar el silencio
  a una que ya habla no falla ni cambia nada.
- **CA-5 (Identidad y aislamiento, ADR-007 / RN-01).**
  Dado el `id` de una vigilada **de otro usuario**, o inexistente, o malformado,
  cuando se invoca cualquiera de los dos gestos,
  entonces no se modifica ninguna fila y la respuesta es **indistinguible** entre los tres
  casos; el `userId` viaja **dentro del `WHERE` del `UPDATE`**. Con el mismo ticker en dos
  mercados, se silencia **exactamente la señalada** (ADR-012).
- **CA-6 (El silencio es de la vigilada entera).**
  Dada una vigilada con zona de compra y de venta,
  cuando se silencia,
  entonces callan **las dos**; no hay forma de silenciar solo una de sus zonas.

### Rebanada 2 — Calla: el individual y el agregado (CE-3, R-3, RN-14)
- **CA-7 (Sin aviso de entrada mientras calla).**
  Dada una vigilada **silenciada** cuyo precio entra en su zona,
  cuando corre el ciclo,
  entonces se **abre su episodio** con normalidad pero **no se emite** ningún aviso por él:
  el `NotificationSender` fake no recibe nada suyo.
- **CA-8 (Suprimido no es registrado: la deuda sobrevive).**
  Dada la situación de CA-7 mantenida durante **varios ciclos**,
  cuando se consulta `notifications`,
  entonces **no existe ninguna fila** con el `zone_trigger_id` de ese episodio — ni
  `sent`, ni `failed`, ni con `read_at` puesto. Es la condición de la que depende CE-4:
  registrar el aviso suprimido consumiría la clave `notif_entry_trigger` y mataría la
  deuda para siempre (ADR-029 pto. 6).
- **CA-9 (El agregado también calla, R-3).**
  Dado un usuario con dos vigiladas en zona, una silenciada y otra no,
  cuando corre el ciclo,
  entonces se emite **un** aviso agregado que lista **solo la que habla**; la silenciada no
  aparece ni en el cuerpo ni en el recuento.
- **CA-10 (Si todas callan, no hay agregado).**
  Dado un usuario cuyas **únicas** vigiladas en zona están silenciadas,
  cuando corre el ciclo,
  entonces **no se emite ni se registra ninguna fila `digest`** para él en ese ciclo — no un
  agregado vacío ni un correo diciendo que no hay nada.
- **CA-11 (El historial no se toca, RN-15).**
  Dada una vigilada con avisos ya emitidos,
  cuando se la silencia,
  entonces ninguno se borra, ninguno se marca leído y el contador de no leídos de
  `/avisos` no cambia (SPEC-007 CA-10). Silenciar mira al futuro, no reescribe el pasado.
- **CA-12 (El silencio es de quien lo pide, RN-01).**
  Dados dos usuarios que vigilan el **mismo símbolo compartido** con la misma zona, uno con
  la suya silenciada,
  cuando el precio entra en zona y corre el ciclo,
  entonces el otro recibe su aviso de entrada y su agregado con normalidad.

### Rebanada 3 — Sigue viva: ingesta, motor y estado real (CE-3, CE-5, ADR-027)
- **CA-13 (Sigue costando cuota, y es la decisión).**
  Dada una vigilada silenciada cuyo símbolo **no lo referencia nadie más**,
  cuando se calcula el universo del ciclo (`symbolUniverse`, `countUniverseSymbols`),
  entonces su símbolo **sigue dentro**, el ciclo le pide precio y lo actualiza, y el
  contador `requested` de la ejecución del ciclo (SPEC-037) **no baja** al silenciar. El
  test lleva escrito que es una decisión y no un descuido (ADR-029 pto. 4, contra la
  tentación de ADR-027).
- **CA-14 (El motor sigue evaluando, RN-13).**
  Dada una vigilada silenciada,
  cuando su precio entra y más tarde sale de la zona,
  entonces se abre y se cierra su episodio con las mismas reglas de ADR-005, y los
  contadores `triggersOpened` / `triggersClosed` de la ejecución del ciclo la cuentan.
- **CA-15 (Su estado real se sigue viendo, RN-11 / RN-16).**
  Dada una vigilada silenciada con cotización,
  cuando se consulta el estado de zona (`zoneStatusForUser`) y se abre `/vigiladas`,
  entonces su `state` (`buy` / `sell` / `both` / `out` / `none`), su precio y su `asOf` son
  **los mismos** que si no estuviera silenciada, y la marca de "sin refrescar" de SPEC-043
  le sigue aplicando igual. El silencio no toca ni un cálculo.
- **CA-16 (Silenciar no es una baja ni un archivado).**
  Dada una vigilada silenciada,
  cuando se lista (`listWatched`, `/vigiladas`),
  entonces **sigue apareciendo**, cuenta como una vigilada más, y quitarla de verdad sigue
  siendo el control **Quitar** (SPEC-024), que sigue haciendo lo de siempre.

### Rebanada 4 — Al reactivar, cuenta lo que se perdió (CE-4)
- **CA-17 (La deuda se paga en el primer ciclo posterior).**
  Dada una vigilada silenciada con un episodio **abierto y sin aviso** (CA-8),
  cuando se le quita el silencio y corre el ciclo siguiente,
  entonces se emite **exactamente un** aviso de entrada para ese episodio, por el camino
  normal de RN-14 (sin rama especial), llevando el **precio y el `as_of` del episodio** —los
  de cuando entró, no los de hoy— y diciendo que **sigue dentro**; nunca presenta el precio
  viejo como si fuera el actual (D-2).
- **CA-18 (Y no se duplica).**
  Dada una vigilada cuyo aviso de entrada **ya se había emitido** antes de silenciarla, con
  el episodio todavía abierto,
  cuando se le quita el silencio y corren varios ciclos,
  entonces **no se emite ningún aviso nuevo** por ese episodio (RN-14 intacta).
- **CA-19 (Lo que abrió y cerró mientras callaba no se cuenta después).**
  Dada una vigilada silenciada cuyo episodio abrió **y cerró** durante el silencio,
  cuando se le quita el silencio y corren ciclos,
  entonces no se emite ningún aviso por ese episodio, ni entonces ni nunca. La pérdida es
  deliberada (ADR-029 pto. 8, **F-ADR-029-1**): un aviso de una entrada que ya terminó
  hablaría de algo sobre lo que ya no se puede actuar.
- **CA-20 (Informe inmediato al reactivar, en pantalla).**
  Dada una vigilada silenciada con uno o dos episodios abiertos,
  cuando el usuario le quita el silencio,
  entonces la pantalla le dice **en el acto** qué encontró: por cada episodio abierto, el
  tipo de zona y **desde cuándo** está dentro (el `as_of` del episodio, con su antigüedad en
  días); y si no hay ninguno, lo dice también, en vez de callarse. El informe se deriva del
  **episodio**, no del estado calculado en render.
- **CA-21 (No empieza a contar de cero).**
  Dada la vigilada de CA-17 tras quitarle el silencio,
  cuando se inspecciona su episodio,
  entonces `opened_at` y `as_of` son **los del día en que entró**, no los de la
  reactivación. Es la medida literal de CE-4.

### Rebanada 5 — Se ve, y por eso no tapa nada (R-6, R-5, ADR-026)
- **CA-22 (Marca de silencio, con texto y con fecha).**
  Dada una vigilada silenciada,
  cuando el usuario abre `/vigiladas`,
  entonces su fila lleva una marca **de texto** que dice que está silenciada **y desde
  cuándo** (no solo un icono, no solo una atenuación: el color no puede ser el único
  portador de significado, misma exigencia que SPEC-007 CA-1), y su **color de fondo y su
  etiqueta de estado de zona no cambian**.
- **CA-23 (No se esconde, no se degrada, no se manda al final).**
  Dada una lista con vigiladas silenciadas y no silenciadas,
  cuando se ordena por cualquiera de los criterios de SPEC-041 (Ticker, Nombre, Estado, en
  las dos direcciones),
  entonces las silenciadas ocupan **la posición que les toca por ese criterio**: el silencio
  **no** es un criterio de orden nuevo ni un desempate, no las agrupa aparte y no las saca
  de ningún recuento.
- **CA-24 ("En zona desde" — y si no se sabe, no se dice).**
  Dada una fila con un episodio **abierto** del tipo de zona que su estado indica,
  cuando se abre `/vigiladas`,
  entonces se muestra desde cuándo está dentro (el `as_of` del episodio, D-2); y dada una
  fila cuyo estado dice "en zona" pero que **aún no tiene episodio abierto** —porque el
  ciclo todavía no ha corrido desde el alta o desde la edición—, entonces **no se muestra
  ninguna fecha**: no se inventa una a partir del estado calculado en render (ADR-029,
  última consecuencia; misma honestidad que SPEC-041 CA-3 con el nombre ausente).
- **CA-25 (El gesto está en la fila y es reversible desde ahí).**
  Dada cada fila de `/vigiladas`,
  cuando se mira su celda de acciones,
  entonces ofrece **Silenciar** si habla y **Reactivar** si calla —los dos rótulos son
  literales y los firmó el humano en el gate del 2026-08-22 (ADR-025/ADR-029 pto. 12): el
  test los compara con la fila del glosario (CA-28), así que "Quitar silencio", "Activar
  avisos" o cualquier variante **no pasa**—; el rótulo refleja
  el estado, no la acción contraria del momento anterior, con el estado expuesto también a
  lectores de pantalla; el gesto viaja con el `id` de **su** fila (no con su posición) y
  funciona igual después de reordenar.
- **CA-26 (Geometría, ADR-026 / SPEC-040).**
  Dada `/vigiladas` con filas silenciadas y no silenciadas, con la marca de silencio y el
  "en zona desde" presentes, a los **ocho anchos** de `tests/e2e/geometria.ts` (360, 390,
  640, 700, 730, 760, 800, 1280),
  cuando se mide,
  entonces (a) ningún elemento visible bajo `nav`/`main`/`footer` viola **M1**
  (`right ≤ innerWidth + 1`, `left ≥ −1`); (b) `document.scrollWidth ≤ clientWidth + 1`;
  (c) desplazando `.table-scroll` al extremo derecho se alcanzan **los tres** controles de
  la fila —Editar, Silenciar/Reactivar y Quitar— dentro de la ventana (SPEC-040 CA-5,
  que hablaba de "el control de Quitar" cuando era el único); y (d) ni la marca de silencio
  ni el "en zona desde" parten palabras (**M3**). `overflow: hidden` no cuenta como arreglo
  (ADR-026 §1); si a 360 px no caben en fila, se apilan.

### Rebanada 6 — La regla, el término y la no regresión
- **CA-27 (RN-17 escrita donde viven las reglas).**
  Dado `docs/fundacion/reglas.md`,
  cuando se cierra el gate de esta spec,
  entonces gana **RN-17 — Vigilada silenciada** con su enunciado (qué suprime el silencio,
  qué **no** suprime, que el aviso suprimido **no se registra**, que el agregado también
  calla, y qué se paga al quitarlo), citando su fuente (**ADR-029**); las dieciséis RN
  anteriores quedan **sin cambios y sin renumerar**, igual que hizo SPEC-032 al escribir
  RI-01.
- **CA-28 (Término del dominio, ADR-025).**
  Dado `docs/fundacion/dominio.md`,
  cuando se cierra el gate,
  entonces gana la fila **Vigilada silenciada** (con el gesto **Silenciar** y su inverso
  **Reactivar** —los dos literales, firmados por el humano en el gate del 2026-08-22— y la
  advertencia de que *no* es baja lógica, archivado ni pausa con vencimiento, y de que
  **"reactivar" aquí significa volver a oírla, no volver a vigilarla**: nunca dejó de
  vigilar, que es justo lo que dice CE-3); y un test compara los rótulos que muestra la
  interfaz —**"Silenciar"** y **"Reactivar"**— con esa fila del glosario, el mismo mecanismo
  con el que SPEC-040 CA-9 ató "Rol de cuenta".
- **CA-29 (Cero regresión, CE-5).**
  Dadas las suites de SPEC-003, SPEC-005, SPEC-006, SPEC-007, SPEC-024, SPEC-037 y
  SPEC-043,
  cuando se ejecutan tras este cambio,
  entonces pasan **sin reescribir ninguna aserción de dominio**; una vigilada con
  `silenced_at` en `null` dispara, avisa, se agrega y se muestra exactamente igual que
  antes; `tests/schema-source.test.ts` y `tests/ops-snapshot.test.ts` quedan al día con la
  columna nueva.

## Entidades y reglas afectadas
- **`watched_symbols.silenced_at`** (nuevo, `timestamptz` nullable): `null` = no silenciada.
  Mismo idioma que `zone_triggers.closed_at` y `notifications.read_at`. Es una **fecha y no
  un booleano** para poder decir "silenciada desde hace tres meses", que es la mitigación de
  R-6 (ADR-029 pto. 2).
- **`zone_triggers`**: **sin cambios**. Sigue siendo estado derivado puro de (zonas, última
  cotización) y no gana ninguna noción de silencio; su episodio abierto **es** la deuda de
  aviso pendiente, por la unicidad `notif_entry_trigger` que ya existe.
- **`notifications`**: **sin cambios de esquema**. Lo que cambia es **qué filas se insertan**:
  mientras la vigilada calla, ninguna por sus episodios.
- **Servicio de vigiladas** (`src/lib/watchlist/service.ts`): dos operaciones nuevas
  (silenciar / reactivar) por `id` con `userId` en el `WHERE`, idempotentes.
- **Servicio de notificación** (`src/lib/notifications/service.ts`): `notifyCycle` une
  `zone_triggers` con `watched_symbols` para conocer el silencio y lo aplica **en los dos**
  avisos (entrada y agregado). Es el **único** punto del ciclo que aprende qué es el
  silencio.
- **Estado de zona** (`src/lib/watchlist/zone-status.ts`): la vista gana `silenced_at` y el
  `as_of` del episodio **abierto** por tipo de zona. Consecuencia declarada: `/vigiladas`
  empieza a leer `zone_triggers`, cosa que hasta hoy no hacía ninguna vista (ADR-017 lo usó
  como argumento); la decisión de ADR-017 no cambia, pero deja de ser cierto que nadie los
  mire.
- **Ingesta y motor** (`src/lib/market/refresh.ts`, `src/lib/triggers/service.ts`): **no se
  tocan**, y hay tests que lo fijan (CA-13, CA-14).
- **UI** (`src/app/vigiladas/watched-table.tsx`, `page.tsx`, `actions.ts`): control por fila,
  marca de silencio, "en zona desde" e informe al reactivar.
- Reglas: **RN-17** (nueva, la escribe esta spec), **RN-01**, **RN-03**, **RN-11**,
  **RN-13**, **RN-14**, **RN-15**, **RN-16**; **RI-01** (migración aditiva, sin desbloqueo)
  y **RI-02**. Decisiones: **ADR-029** (la origina), **ADR-028**, **ADR-005**, **ADR-006**,
  **ADR-007**, **ADR-017**, **ADR-019**, **ADR-023** (contadores del ciclo), **ADR-025**,
  **ADR-026**, **ADR-027** (citado para rechazarlo). Términos: `docs/fundacion/dominio.md`,
  con **una fila nueva** (*Vigilada silenciada*, CA-28).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Pausa con vencimiento** ("reactívala sola el día 15"). Descartado por el humano el
  2026-08-22: introduce tiempo programado, que hoy no existe en ninguna parte del producto.
  `silenced_at` no lo estorba si algún día se pide.
- **Que el silencio ahorre cuota del proveedor.** Descartado en el mismo gate y ratificado
  en ADR-029 pto. 4: congelaría el precio y obligaría a explicar en la tabla que el dato
  está viejo a propósito, justo lo que RN-16 y SPEC-043 acaban de cerrar. Se reabre con ADR
  sucesor si la cuota aprieta.
- **Silenciar por tipo de zona** (callar la compra y oír la venta). Es una matriz de
  preferencias que nadie ha pedido y roza **F-SPEC-006-2**.
- **Recordatorio de "llevas N días callando esto".** La defensa contra la vigilada callada
  y olvidada es que **se ve** (CA-22). Un recordatorio proactivo es capacidad nueva, con su
  cadencia y su canal, y chocaría con el silencio que el usuario pidió → **F-ADR-029-2**.
- **Enseñar lo que abrió y cerró durante el silencio.** El episodio cerrado queda en la
  tabla, pero no hay vista de historial de disparos (F-ADR-017-1) y ésta no la crea →
  **F-ADR-029-1**.
- **Preferencias de notificación por canal o frecuencia** (F-SPEC-006-2): silenciar *una
  vigilada* no es configurar *cómo avisa la app*.
- **Silencio a nivel de cuenta** ("cállalo todo unos días"). No se ha pedido; y con esta
  columna se puede construir después sin deshacer nada.
- **Editar zonas**: es SPEC-044, que va antes.
- **Rediseñar `/vigiladas`**: se respeta lo decidido por SPEC-039, SPEC-040 y SPEC-041.

## Notas para el gate humano
Lo que necesitas mirar con lupa antes de firmar:

1. **Dónde se engancha el silencio decide si CE-4 es posible.** Si el silencio se aplicara
   en el **motor** (que no evalúe), al volver **no habría nada que contar**: `quotes` guarda
   **una sola fila por símbolo**, sin histórico (ADR-004), así que el "desde cuándo" no
   existiría en ninguna tabla del sistema. Por eso el silencio se aplica **en el aviso** y
   el episodio se sigue abriendo. Es la decisión central de ADR-029 y de ella cuelga todo lo
   demás.
2. **El punto contraintuitivo, y el que alguien "corregirá" si no lo firmas: el aviso
   suprimido NO se registra** (CA-8). El instinto de RN-15 dice "regístralo todo". Pero
   RN-15 protege el aviso **emitido**, y una fila insertada consumiría la clave de
   idempotencia del episodio y **mataría la deuda**: al quitar el silencio no llegaría nada.
   Suprimido no es fallido: `failed` significa "lo intentamos y no llegó", y aquí no se
   intentó.
3. **Lo que abrió y cerró mientras callaba se pierde** (CA-19). Entró en zona el martes,
   salió el viernes, quitas el silencio el lunes: **no te lo cuenta nadie**. Es la lectura
   estricta de CE-4 ("entró **y sigue dentro**") y evita avisar de algo sobre lo que ya no
   se puede actuar. **Es la decisión que más margen tenía**: si quieres que sí se cuente,
   dilo ahora, porque implica un tipo de aviso nuevo o una vista de historial de disparos
   (F-ADR-017-1), y eso es otra spec.
4. **El silencio sigue costando cuota** (CA-13). Con ADR-027 midiendo el presupuesto en
   **símbolos por ciclo**, una lista de silenciadas paga igual. Lo elegiste a conciencia
   —congelar el precio era el precio de ahorrar— y está escrito en un test para que nadie lo
   "optimice" dentro de seis meses creyendo que corrige un descuido.
5. **El término: ya está firmado (ADR-025), no hace falta que lo vuelvas a mirar.** Gate del
   2026-08-22: estado **silenciada**, gesto **Silenciar**, inverso **Reactivar**. Los dos
   primeros son la propuesta de sdd-arquitecto; el tercero **no**: yo proponía "Quitar
   silencio" porque "Reactivar" afirma que la vigilada estaba *inactiva* y CE-3 sostiene lo
   contrario, y el humano eligió **Reactivar** por naturalidad en español, oído el
   argumento. **Su firma manda y la cláusula queda cerrada.** Lo que sí hereda la
   implementación es la obligación de que el glosario deshaga la ambigüedad que el rótulo
   introduce: *reactivar* = volver a **oírla**, nunca volver a **vigilarla** (CA-28). Lo
   único descartado sin discusión sigue siendo *pausar*, que prometería el vencimiento que
   está fuera de alcance.
6. **Se amplía algo sobre lo que pedía CE-4, a propósito: el "en zona desde" se muestra en
   TODAS las filas con episodio abierto** (CA-24), no solo en las que acabas de reactivar.
   Hacerlo solo para las reactivadas exigiría recordar quién lo fue y sería arbitrario en
   pantalla; hacerlo para todas es más simple y además sirve a R-6. **Es la ampliación de
   alcance más discutible de esta spec y se corta limpio si no la quieres**: CA-24 fuera, y
   CE-4 se sostiene con CA-20 y CA-17.
7. **`/vigiladas` empieza a leer `zone_triggers`.** ADR-017 argumentó su cascada diciendo
   que "ninguna vista los enseña". Su **decisión no cambia** (el episodio pertenece a la
   vigilada y cae con ella), pero esa frase deja de ser cierta y quien lea ADR-017 a partir
   de hoy debe leerlo junto a ADR-029.
8. **La migración y el aviso de Preview.** Es `ADD COLUMN` nullable, sin `default` y sin
   relleno: aditiva pura (RI-01), sin desbloqueo en `destructive-waivers.json`, y el código
   anterior la ignora. Aun así **abrir la PR migra producción** (`DATABASE_URL` compartida):
   conviene que esa PR sea la de esta spec y no lleve nada más encima.
9. **Tres controles por fila en la pantalla más apretada** (R-5). CA-26 mide con el módulo
   de ADR-026 a los ocho anchos y exige alcanzar los tres; si a 360 px no caben en línea, se
   apilan — esconder no es una salida, y `overflow: hidden` tampoco.
10. **Orden dentro de la épica**: esta spec va **después** de SPEC-044. Hereda de ella que
    el episodio sabe sobrevivir a un cambio del usuario, que es exactamente lo que CE-4 le
    pide al silencio.
