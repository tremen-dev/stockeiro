---
id: SPEC-024
tipo: spec
epica: EPIC-FIX
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-08-17, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-17, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-08-17, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-17, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-08-17, por: sdd-verificador}
---
# SPEC-024 — Quitar de vigiladas la acción correcta, haya estado o no en zona

## Problema

El botón "Quitar" de `/vigiladas` tiene **dos defectos independientes**, ambos en el mismo
camino (`page.tsx` → `removeAction` → `unwatch`), y ambos entran en esta spec. El primero
rompe la operación con un 500; el segundo la ejecuta **sobre la fila equivocada**.

### Defecto A — quitar una acción que ha estado en zona devuelve 500

Quitar una acción de la lista de vigiladas devuelve **500** si esa acción está —o **ha
estado alguna vez**— en zona. El usuario pulsa "Quitar", la app se rompe y Next.js en
producción solo le devuelve un digest opaco: ni la acción se quita, ni sabe por qué.

Cadena confirmada (reproducida contra Postgres real en el worktree):

1. `removeAction` (`src/app/vigiladas/actions.ts:50`) llama a `unwatch`.
2. `unwatch` (`src/lib/watchlist/service.ts:127`) hace un `DELETE` pelado sobre
   `watched_symbols`, sin tocar nada más.
3. `zone_triggers.watched_symbol_id` referencia `watched_symbols.id` con **`ON DELETE no
   action`** (`src/db/schema.ts:208-210`; constraint
   `zone_triggers_watched_symbol_id_watched_symbols_id_fk`, `drizzle/0000_real_tusk.sql:88`).
4. El motor de disparo (`src/lib/triggers/service.ts`) **nunca borra** episodios: al entrar
   en zona inserta y al salir solo pone `closedAt` (ADR-005, **RN-13**).
5. Postgres lanza `23503`: `update or delete on table "watched_symbols" violates foreign key
   constraint ... on table "zone_triggers"` (el nombre exacto de la constraint difiere entre
   producción y el esquema de test; la violación es la misma).

El alcance real es peor que "está en zona ahora": como los episodios no se borran nunca,
**cualquier vigilada que haya entrado en zona una sola vez queda imposible de quitar para
siempre**. El defecto crece con el uso: cuanto mejor funciona la vigilancia, menos acciones
se pueden quitar. Y hay una **segunda** FK detrás —`notifications.zone_trigger_id →
zone_triggers.id`, también `no action` (`src/db/schema.ts:241`)— así que borrar los
episodios tampoco basta si esa vigilada llegó a generar avisos.

### Defecto B — "Quitar" identifica la vigilada por ticker, ignorando el mercado

Toda la cadena viaja **por ticker**: la fila manda `<input name="ticker" value={r.ticker}>`
(`src/app/vigiladas/page.tsx:91`), `removeAction` lo lee (`actions.ts:52`) y `unwatch`
resuelve el símbolo con `getSymbolByTicker` (`service.ts:128`), que consulta
`where(symbols.ticker = ...)` con **`.limit(1)`** y devuelve *la primera coincidencia*
(`src/lib/portfolio/symbols.ts:28-31`; su propio comentario ya lo llama "camino legacy").

Pero **la identidad del símbolo es `(ticker, mic_code)`**, no el ticker (**ADR-007**, punto 1;
`docs/fundacion/dominio.md`, entrada *Símbolo*). Y el caso de dos mercados para un mismo
ticker **no es hipotético**: ADR-012 lo documenta con medición propia —`SAN.BMEX` a 11,984 €
y `SAN` en NYSE a ~13,63 USD, el mismo valor en dos mercados y dos divisas—. Con las dos
vigiladas en la lista, "Quitar" en la fila de Madrid puede borrar la de Nueva York, porque
por el cable solo viaja `SAN`.

Sus dos modos de fallo son ambos malos, y ninguno avisa:

- **Borra la que no es**: el usuario pierde una vigilancia que no pidió quitar, con sus
  zonas, y la que quería quitar sigue ahí. Silencioso.
- **No borra nada**: si el símbolo que gana el `limit(1)` es uno que el usuario no vigila,
  el `DELETE` no encuentra fila, `unwatch` devuelve `false`, `removeAction` **ignora el
  valor de retorno** y hace `revalidatePath` igual. La fila sigue ahí y no hay ningún
  mensaje: el botón simplemente "no hace nada". Es exactamente el fallo mudo que **CE-F2**
  persigue.

Nótese que **RN-01 no está rota hoy** (el `DELETE` filtra por `userId`): el daño se limita a
los datos del propio usuario. Al cambiar la clave a un `id`, mantener esa propiedad deja de
ser gratis y pasa a ser un criterio explícito (CA-11).

### Encaje en la épica

Esto rompe **CA-5 de SPEC-003** ("dejar de vigilar"), dada por `hecho` y verificada — el
caso exacto que EPIC-FIX existe para restaurar (**CE-F1**), con el añadido de que ambos
defectos son ilegibles para el usuario: uno como error opaco y el otro como silencio
(**CE-F2**).

Reglas en juego: **RN-13** (episodios y permanencia), **RN-14** (idempotencia del aviso),
**RN-15** (el aviso registrado in-app es fuente de verdad y no se pierde), **RN-01**
(aislamiento). Decisiones: **ADR-017** (nueva, para el defecto A) y **ADR-007** (vigente,
del que el defecto B es una aplicación pendiente). El defecto B **no necesita ADR propio**:
no decide nada nuevo, solo cumple lo que ADR-007 ya decidió.

## Usuarios / roles afectados

- **Usuario final**: quiere quitar de su lista una acción que ya no le interesa. Hoy no
  puede si la app llegó a avisarle de ella —justo las que más motivo tiene para revisar—, y
  si vigila el mismo ticker en dos mercados no puede confiar en que se quite el que señaló.
  Debe poder quitar **la que ha elegido**, **sin perder** los avisos que ya recibió
  (bandeja, SPEC-007).

## Criterios de aceptación

Cada CA es verificable con un test. CA-1..CA-6, CA-8 y CA-10..CA-12 son de servicio (Vitest
sobre Postgres real / PGlite, `tests/watchlist-service.test.ts`); CA-7 y CA-13 son e2e
(Playwright, `tests/e2e/vigiladas.spec.ts`); CA-9 es de regresión sobre suites existentes.

### Defecto A — la baja no falla y el historial de avisos sobrevive

- **CA-1 (Quitar una vigilada con episodio de zona ABIERTO).**
  Dada una acción vigilada de un usuario con un episodio de disparo **abierto**
  (`closedAt` null, está en zona ahora mismo),
  cuando el usuario deja de vigilarla,
  entonces la operación **termina sin error**, `unwatch` devuelve `true`, la acción ya no
  aparece en `listWatched` y **no queda ningún `zone_trigger`** de esa acción vigilada.

- **CA-2 (Quitar una vigilada con episodios CERRADOS y avisos ya emitidos).**
  Dada una acción vigilada con uno o más episodios **cerrados** (`closedAt` informado, entró
  y salió de zona en ciclos anteriores) y con sus avisos de entrada ya registrados en
  `notifications`,
  cuando el usuario deja de vigilarla,
  entonces la operación termina sin error, desaparecen la acción vigilada y sus episodios, y
  **los avisos siguen existiendo**: `listNotificationsForUser` los devuelve con el mismo
  `payload`, `kind`, `asOf`, `status` y `readAt` que antes (**RN-15**, ADR-017).

- **CA-3 (El aviso huérfano queda legible y contable).**
  Dado el estado resultante de CA-2 con al menos un aviso **no leído**,
  cuando se consulta la bandeja del usuario,
  entonces el aviso aparece en la lista, el contador de no leídos (`countUnread`) lo sigue
  contando y `markNotificationRead` lo marca correctamente; su `zoneTriggerId` es **null**
  (vínculo perdido, aviso intacto) y eso no impide ninguna de esas operaciones
  (SPEC-007 CA-6/CA-8/CA-10).

- **CA-4 (Varios avisos huérfanos conviven).**
  Dados **dos o más** avisos de entrada cuyos episodios se han borrado al dejar de vigilar
  (distintas acciones o distintos episodios),
  cuando quedan todos con `zoneTriggerId` null,
  entonces **ninguno se pierde ni choca**: el único `notif_entry_trigger` no se viola
  (los NULL son distintos en Postgres) y la bandeja los muestra todos.

- **CA-5 (No hay daño colateral: otras vigiladas, otros usuarios, cartera).**
  Dado el usuario A con dos acciones vigiladas —ambas con episodios y avisos— y el usuario B
  con la suya,
  cuando A deja de vigilar **una**,
  entonces solo desaparecen esa acción vigilada y **sus** episodios: la otra acción de A
  conserva los suyos, los de B quedan intactos (**RN-01**) y ni el símbolo compartido, ni su
  cotización, ni las transacciones/posiciones de la cartera sobre ese símbolo se ven
  afectados (ADR-002).

- **CA-6 (Re-vigilar un ticker que se quitó).**
  Dado un usuario que quitó una acción que estaba en zona y cuyo precio **sigue** dentro de
  la zona,
  cuando la vuelve a vigilar con las mismas zonas y corre el ciclo,
  entonces se crea una acción vigilada **nueva** (sin colisión con el único
  `(user_id, symbol_id)`, sin episodios heredados) y el motor **abre un episodio nuevo** y
  emite un **aviso de entrada nuevo** — el disparo se re-arma porque volver a vigilar es un
  acto explícito del usuario (RN-13/RN-14 leídas por episodio de vigilancia, ADR-017).
  *Comportamiento querido, no efecto colateral*: el humano lo confirmó explícitamente en el
  gate del 2026-08-17 — «está ok que vuelva a avisar». Este CA es la prueba de esa decisión.

- **CA-7 (El usuario lo ve funcionar, sin página de error).**
  Dado un usuario autenticado en `/vigiladas` con una acción marcada **en zona**,
  cuando pulsa "Quitar",
  entonces vuelve a `/vigiladas` con la fila desaparecida, **sin pantalla de error genérica
  ni 500**, y sus avisos siguen visibles en la bandeja (CE-F1; espíritu de CE-F2).

- **CA-8 (La invariante vive en el esquema, no en el servicio).**
  Dada una acción vigilada con episodios y avisos,
  cuando se ejecuta un `DELETE` **directo** sobre `watched_symbols` (sin pasar por
  `unwatch`),
  entonces el borrado tampoco falla: los episodios caen en cascada y los avisos quedan con
  `zoneTriggerId` null. Cualquier camino de borrado futuro hereda la semántica correcta
  (ADR-017, punto 3).

- **CA-9 (Sin regresión en el motor y en la notificación).**
  Dada la suite existente de SPEC-005 (`tests/triggers-*.test.ts`) y SPEC-006/SPEC-007
  (`tests/notifications*.test.ts`),
  cuando se aplica el cambio de esquema,
  entonces **toda** pasa sin modificar sus expectativas: la idempotencia del disparo
  (RN-13), la del aviso (RN-14) y el fallback in-app (RN-15) siguen comportándose igual
  mientras la acción vigilada exista.

### Defecto B — se quita la vigilada que el usuario señaló, y solo si es suya

- **CA-10 (Mismo ticker en dos mercados: se quita exactamente la señalada).**
  Dado un usuario con **dos** acciones vigiladas del **mismo ticker** y **distinto
  `micCode`** —dos símbolos distintos por ADR-007, p. ej. `SAN`@`BMEX` y `SAN`@`XNYS`—,
  cada una con sus propias zonas,
  cuando deja de vigilar **una** de ellas identificándola por el `id` de la **acción
  vigilada**,
  entonces desaparece **exactamente esa**, `unwatch` devuelve `true`, y la otra sigue en
  `listWatched` con sus zonas intactas; los dos símbolos compartidos y sus cotizaciones no
  se tocan (ADR-002).
  *Este CA falla con la implementación actual*: es el test que fija el defecto B.

- **CA-11 (RN-01 sobre la clave nueva: un id ajeno no borra nada).**
  Dado el usuario B con una acción vigilada y el usuario A autenticado,
  cuando A pide quitar pasando el `id` **real** de la acción vigilada de B (id válido y
  existente, llegado por manipulación del formulario, no por la UI),
  entonces `unwatch` devuelve `false`, **no borra ninguna fila**, la vigilada de B sigue
  existiendo con sus zonas y sus episodios, y el resultado es **indistinguible** del de un
  id inexistente (no se revela que ese id existe; misma semántica que `findByIdForOwner`).
  **Requisito de diseño, verificable en el test**: el filtro por `userId` viaja en la
  **misma sentencia** que el borrado (`where id = ? and user_id = ?`), de modo que el
  aislamiento no dependa ni de que la UI mande el id correcto ni de que alguien recuerde
  comprobar la propiedad antes (**RN-01**, D-5, `src/lib/data/ownership.ts`).

- **CA-12 (Id inexistente o ausente: sin efecto, sin excepción, sin pantalla de error).**
  Dado un `id` que no corresponde a ninguna acción vigilada (o un envío del formulario
  **sin** ese campo),
  cuando se invoca quitar,
  entonces `unwatch` devuelve `false` sin lanzar, `removeAction` no revienta y el usuario
  vuelve a `/vigiladas` con su lista intacta. Es el comportamiento tolerante que hoy tiene
  `removeAction` con el ticker vacío, conservado sobre la clave nueva.

- **CA-13 (La UI manda la identidad correcta, extremo a extremo).**
  Dado un usuario autenticado en `/vigiladas` con **dos filas del mismo ticker en mercados
  distintos** y zonas distintas (sembradas por SQL, como en `tests/e2e/avisos-zona.spec.ts`),
  cuando pulsa "Quitar" en **una** de las dos filas,
  entonces desaparece esa fila y **la otra permanece**, con su zona reconocible sin cambios,
  sin pantalla de error. Cierra la cadena completa `page.tsx → removeAction → unwatch`: si
  la UI siguiera mandando el ticker, este CA falla aunque el servicio sea correcto.

## Entidades y reglas afectadas

### Esquema (defecto A)

- **`zone_triggers`** (SPEC-005/ADR-005): la FK `watched_symbol_id → watched_symbols.id`
  pasa a **`ON DELETE CASCADE`**. Expresa que el episodio **pertenece** a la acción vigilada:
  es estado derivado del par (zonas, última cotización), recalculable en el ciclo siguiente y
  **sin ninguna vista que lo muestre** (`listTriggersForUser`/`openTriggersForUser` solo los
  consume el motor de avisos).
- **`notifications`** (SPEC-006/ADR-006): la FK `zone_trigger_id → zone_triggers.id` pasa a
  **`ON DELETE SET NULL`**. El aviso **referencia** el episodio, no le pertenece: la fila es
  autocontenida (`payload`, `kind`, `asOf`, `status`, `readAt`) y `listNotificationsForUser`
  no hace join con `zone_triggers`. El `zoneTriggerId` solo servía de clave de idempotencia
  (RN-14) y esa idempotencia queda sin objeto cuando el episodio ya no existe. La restricción
  única `notif_entry_trigger` se conserva tal cual (NULL distintos en Postgres).
- **`watched_symbols`** (SPEC-003): sin cambios de forma. Se mantienen el borrado físico y la
  unicidad `(user_id, symbol_id)`; **CA-5 de SPEC-003 no cambia de significado** ("desaparece
  de sus acciones vigiladas" sigue queriendo decir que se borra).
- **Migración**: una migración drizzle nueva (`drizzle/0007_*.sql`, generada con
  `db:generate`, no escrita a mano) que hace `DROP CONSTRAINT` + `ADD CONSTRAINT` de esas dos
  FKs. Es de constraints, sin movimiento de datos, **compatible hacia atrás** (el código
  anterior nunca dependió de que la FK fallase).
- **Paridad del esquema de test**: `src/db/test-db.ts` monta el esquema con **DDL escrito a
  mano** (líneas ~82-107). Debe reflejar las mismas cláusulas `ON DELETE`, o los tests
  unitarios verificarían un esquema que no es el de producción. **Es parte del cambio, no un
  detalle.**

### Código (defecto B) — la baja pasa a identificarse por el id de la acción vigilada

Ningún cambio de esquema: la clave que se usa (`watched_symbols.id`) ya existe y ya viaja
hasta la UI. Es cableado.

- **`src/lib/watchlist/service.ts:126-135`** — `unwatch(db, userId, ticker)` pasa a
  `unwatch(db, userId, watchedId)`. Borra por `id` **y** `userId` en una sola sentencia
  (CA-11) y deja de usar `getSymbolByTicker` (que se queda para el camino legacy de cartera).
  Devuelve `true` solo si borró. Su comentario documenta además que la baja arrastra los
  episodios y deja los avisos huérfanos **a propósito** (ADR-017), para que nadie "arregle"
  la cascada más adelante.
  - `getWatchedForOwner` (`service.ts:122`) ya resuelve por id restringiendo al dueño y **es
    la pieza adecuada si se quiere distinguir "no existe" de "no es tuya"**. No obstante,
    usarla como guardia previa **no sustituye** al filtro por `userId` dentro del `DELETE`:
    CA-11 exige que el aislamiento esté en la sentencia de borrado, no en una comprobación
    que un refactor pueda saltarse. Si se usa, es guardia adicional; el `where` va igual.
- **`src/app/vigiladas/actions.ts:50-57`** — `removeAction` lee `watchedId` en vez de
  `ticker`. Mantiene la guarda de campo vacío (CA-12) y el `revalidatePath('/vigiladas')`.
- **`src/app/vigiladas/page.tsx:90-91`** — el campo oculto del formulario pasa a
  `<input type="hidden" name="watchedId" value={r.id} />`. El `id` es el de
  `watched_symbols` y **ya está disponible**: `ZoneStatusView.id` lo trae
  (`src/lib/watchlist/zone-status.ts:59`) y la fila ya lo usa como `key`. No hay consulta
  nueva ni columna nueva.
- **`tests/watchlist-service.test.ts:78-84`** — el test vigente de CA-5 de SPEC-003 llama
  `unwatch(db, userA, 'ITX')`; se adapta a la firma por id. Es adaptación de llamada, **no
  cambio de expectativa**: sigue verificando que la acción desaparece de `listWatched`.
- Identificadores en inglés (`watchedId`), textos y términos de dominio en español.

### Transversal

- Reglas: **RN-01, RN-13, RN-14, RN-15**. Decisiones: **ADR-017** (nueva), **ADR-007**
  (identidad del símbolo, que el defecto B incumplía), ADR-012 (caso real de ticker en dos
  mercados), ADR-005, ADR-006, ADR-002. Términos: `docs/fundacion/dominio.md` (símbolo,
  acción vigilada, disparo / entrada en zona, aviso de entrada, aviso de permanencia,
  bandeja de avisos, aviso leído / no leído).
- **Test de regresión permanente**: el escenario del bug pasa a
  `tests/watchlist-service.test.ts` (junto al resto de CA de `unwatch`). El fichero de
  investigación `tests/repro-unwatch-en-zona.test.ts` es un **scratch** y **se borra** en esta
  spec: no se queda ni renombrado.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Archivado o papelera de acciones vigiladas** (baja lógica, "restaurar lo quitado"): es
  funcionalidad nueva y EPIC-FIX la deja fuera por definición. Evaluada y **rechazada como
  solución a este defecto** en ADR-017, alternativa (c). Si se quiere, entra por sdd-producto.
- **Historial persistente de disparos** (una vista "estas son las veces que ITX entró en
  zona"): hoy no existe ninguna vista de episodios, y esta spec no la crea. Consecuencia
  asumida y registrada como **F-ADR-017-1**.
- **Borrado de cuenta completa**: `users` sigue con `no action` en todas sus FKs; borrar un
  usuario seguiría fallando. Es un defecto distinto, sin caso de uso hoy (no hay "borrar mi
  cuenta"). Registrado como **F-ADR-017-2**.
- **Convertir `removeAction` en acción conversacional** (`useActionState` con mensaje de
  error en la UI): con las dos causas raíz eliminadas, los modos de fallo que quedan son de
  infraestructura. CA-7 y CA-13 solo exigen que el flujo real no acabe en pantalla de error.
  Mejora, no defecto → EPIC-MEJORA.
- **Mostrar el mercado en la tabla de `/vigiladas`**: resuelto el defecto B, el borrado ya
  quita la fila correcta, pero **el usuario sigue viendo dos filas idénticas** ("SAN" y
  "SAN") y solo puede distinguirlas por precio y zonas. Es un problema de presentación, no de
  corrección, y esta spec no lo toca. → **F-SPEC-024-1** (EPIC-MEJORA): añadir mercado/divisa
  a la columna de ticker. *(Cerrado después por **SPEC-029 CA-14**, gate del 2026-08-18. Se
  anota; SPEC-024 no se reabre.)*
- **El mismo defecto de identidad en la cartera**: `recordSell`, `recordSplit` y
  `recordDividend` (`src/lib/portfolio/service.ts:98,127,144`) también resuelven el símbolo
  con `getSymbolByTicker`. Es la misma clase de defecto, en otra pantalla, con otro impacto
  (P/L, RN-06/RN-09) y sin reproducción todavía. **No se arregla aquí**: esta spec cierra el
  botón "Quitar" de vigiladas. → **F-SPEC-024-2** (candidato a spec propia en EPIC-FIX).

## Notas para el gate humano

Esta spec cubre **dos defectos del mismo botón**. El primero ya tiene decisión tomada; el
segundo entró aquí por decisión tuya en el gate anterior.

1. **Decisión propuesta (ADR-017): el historial de avisos se conserva.** Quitar una vigilada
   borra la vigilancia y sus **episodios de zona** (estado derivado del motor, que nadie ve y
   que se recalcula solo), pero **no toca los avisos**: siguen en tu bandeja, legibles y
   contables, solo que sin vínculo interno al episodio. El argumento es que **RN-15** declara
   el registro in-app *fuente de verdad y fallback*, y que la app "avisa" (D-1): que dejes de
   vigilar hoy no hace falso que se te avisara ayer.
2. **Descartadas, con motivo, en ADR-017**: (a) borrado en cascada a mano dentro de `unwatch`
   y (b) `ON DELETE CASCADE` en las dos FKs — ambas **destruyen el historial de avisos**, que
   es justo lo que RN-15 protege; (c) **archivado/baja lógica** — conserva todo pero cambia el
   significado de "quitar" en SPEC-003 CA-5, obliga a auditar listado + motor + notificación
   (y cualquier olvido reabre el bug como *"me sigue avisando de algo que quité"*, silencioso
   y peor que el 500, **R-F4**) y mete funcionalidad nueva por una spec de defecto.
3. **Confirmado por ti en el gate del 2026-08-17 (CA-6): quitar y volver a vigilar te
   volverá a avisar**, aunque el precio no haya salido de la zona en ningún momento —
   «está ok que vuelva a avisar». Queda como **comportamiento querido y probado**, no como
   efecto colateral, y así lo dice el propio CA-6.
4. **Decidido por ti: el defecto de identidad se arregla aquí, no en una SPEC-025 hermana.**
   La spec anterior lo dejaba fuera y recomendaba spec propia; tu instrucción fue
   *"lo resolvemos aquí"*. En consecuencia: título y resumen ampliados, defecto B descrito
   con sus dos modos de fallo, y **CA-10..CA-13** nuevos. Los CA-1..CA-9 que ya revisaste
   **no se han tocado ni renumerado** (CA-6 solo lleva anotada tu confirmación).
5. **Lo único nuevo que te pido mirar con lupa es CA-11.** Pasar de ticker a `id` mejora la
   corrección pero **cambia la naturaleza del dato que viaja en el formulario**: hoy un
   atacante tendría que adivinar el ticker de otro (fácil, pero el `where user_id` lo
   protege); mañana manda un `id` opaco. Por eso el aislamiento **no puede quedar en la UI ni
   en una comprobación previa**: CA-11 exige que el `userId` esté dentro del `DELETE`. Si
   prefieres además la guardia explícita con `getWatchedForOwner`, dilo y se añade — pero el
   `where` va igual.
6. **Toca el esquema y `DATABASE_URL` está compartida entre Production y Preview**
   (F-SPEC-023-1): abrir el PR **migra producción**. La migración es solo de constraints, sin
   movimiento de datos y compatible hacia atrás, así que el riesgo es bajo — pero es un
   `ALTER TABLE` en producción y toca decirlo.
7. **Confirma que el scratch se va**: `tests/repro-unwatch-en-zona.test.ts` se borra y su
   escenario vive a partir de ahora en `tests/watchlist-service.test.ts` (CA-1/CA-2).
8. **Dos follow-ups nuevos, ambos fuera de alcance a propósito**: **F-SPEC-024-1** (la tabla
   de `/vigiladas` no muestra el mercado, así que dos filas del mismo ticker se ven iguales —
   presentación, EPIC-MEJORA) y **F-SPEC-024-2** (la cartera tiene el mismo defecto de
   identidad por ticker en `recordSell`/`recordSplit`/`recordDividend` — corrección, candidato
   a spec propia en EPIC-FIX). Dime si el segundo te urge y se prioriza.

---
*Historial de la spec: redactada el 2026-08-17 (defecto A). Ampliada el mismo día tras el
gate humano para absorber el defecto B (identidad por `id` en vez de por ticker) y renombrada
en consecuencia; el título anterior era "Quitar de vigiladas una acción que ha estado en
zona". Sigue en `borrador`.*
