---
id: ADR-017
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-17, por: sdd-arquitecto}
---
# ADR-017: Baja de una acción vigilada: los episodios de zona son derivados y el historial de avisos se conserva

- Deciders: propone **sdd-arquitecto** (2026-08-17) a partir de un **defecto observado en
  producción** (500 al quitar de vigiladas), no de un dictamen nuevo de dominio. Pendiente
  de aprobación por el humano en el gate de **SPEC-024**. La decisión no es "cómo evitar el
  error de Postgres" —eso tiene tres soluciones técnicas equivalentes— sino **qué significa
  dejar de vigilar** para los datos que la vigilancia dejó por el camino; por eso es un ADR
  y no una nota dentro de la spec.
- Specs relacionadas: la origina **SPEC-024** (Quitar de vigiladas la acción correcta, haya
  estado o no en zona, EPIC-FIX). Afecta al modelo de **SPEC-003** (acción vigilada, CA-5), **SPEC-005**
  (episodios de disparo, ADR-005) y **SPEC-006/SPEC-007** (avisos y bandeja). No toca
  **ADR-002**, **ADR-004**, **ADR-007** ni **ADR-012**.

## Contexto

`unwatch` (SPEC-003 CA-5) hace un `DELETE` pelado sobre `watched_symbols`. Cuando esa acción
vigilada **ha estado alguna vez en zona**, el borrado viola la clave foránea
`zone_triggers.watched_symbol_id` (declarada `ON DELETE no action`) y Postgres responde
`23503`. La server action revienta y el usuario recibe un digest opaco de Next.js: no puede
quitar la acción y no sabe por qué.

El caso **no** es "estar en zona ahora mismo". El motor (ADR-005, RN-13) **nunca borra**
episodios: al entrar inserta y al salir solo pone `closedAt`. Cualquier acción vigilada que
haya entrado en zona **una vez en su vida** arrastra filas que bloquean su baja para siempre.
El defecto crece con el uso: cuanto mejor funciona la vigilancia, menos acciones se pueden
quitar. Encaja de lleno en EPIC-FIX (**CE-F1**): una capacidad dada por `hecho` que no cumple
su promesa con uso real, y con un fallo que además el usuario no puede interpretar —el mismo
espíritu de **CE-F2** (nada opaco), aquí en forma de error en vez de silencio.

Romper la FK no basta con borrar los episodios, porque hay una **segunda** FK detrás:
`notifications.zone_trigger_id → zone_triggers.id`, también `ON DELETE no action`. Si la
acción vigilada llegó a generar avisos, borrar sus episodios choca igual. Es decir: la
cadena obliga a decidir **qué pasa con el historial de avisos del usuario cuando deja de
vigilar**. Ahí es donde hay dominio en juego, no fontanería.

Los dos artefactos no valen lo mismo:

- **`zone_triggers` es estado derivado y operativo.** Su razón de ser (ADR-005, RN-13) es
  (i) la idempotencia edge-triggered del disparo y (ii) hacer **observable la permanencia**
  (`closedAt is null` = en zona ahora). Se recalcula solo en el siguiente ciclo a partir de
  las zonas y de la última cotización. **Ninguna vista lo enseña**: `listTriggersForUser` y
  `openTriggersForUser` solo los consume el motor de avisos y los tests; el estado de zona de
  `/vigiladas` se computa con `entraEnZona` sobre la última cotización (SPEC-007 CA-1), no
  con los episodios. Sin acción vigilada no hay nada que re-armar ni permanencia que
  observar: el episodio pierde su referente.
- **`notifications` es memoria del usuario.** El propio esquema lo declara —"el registro
  in-app (fuente de verdad y fallback, **RN-15**)"— y **RN-15** lo eleva a invariante: un
  aviso registrado no se pierde. La bandeja (SPEC-007 CA-6..CA-11) lo lee, lo marca leído y
  lo cuenta. Es el registro de *"la app me avisó de esto"*, que es literalmente la promesa
  del producto (**D-1**: la app avisa). Que el usuario deje de vigilar un valor **hoy** no
  hace falso que se le avisara **ayer**.

Y hay un detalle del esquema que hace la distinción barata en vez de teórica: la fila de
`notifications` es **autocontenida**. `payload` es el texto legible del aviso, y `kind`,
`asOf`, `status`, `readAt` y `createdAt` son suyos. `listNotificationsForUser` **no hace
join** con `zone_triggers`. El `zoneTriggerId` no aporta contenido al aviso: es solo la
**clave de idempotencia** que garantiza "un aviso de entrada por episodio" (RN-14), a través
del único `notif_entry_trigger`. Cuando el episodio desaparece, esa idempotencia deja de
tener objeto —no hay episodio que pueda re-notificarse— pero el aviso sigue siendo legible
íntegro.

## Decisión

**Dejar de vigilar borra la vigilancia y su estado derivado; el historial de avisos
sobrevive, huérfano pero íntegro.** Y esa semántica se declara en el **esquema**, no en el
código de servicio, cambiando las dos claves foráneas por migración drizzle:

1. `zone_triggers.watched_symbol_id → watched_symbols.id` pasa a **`ON DELETE CASCADE`**.
   Un episodio de zona **pertenece** a la acción vigilada que lo originó: sin ella no
   significa nada (RN-13). La FK es el sitio correcto para expresar esa pertenencia.
2. `notifications.zone_trigger_id → zone_triggers.id` pasa a **`ON DELETE SET NULL`**.
   El aviso **no** pertenece al episodio: lo referencia. Al desaparecer el episodio se pierde
   el vínculo, no el aviso. La fila conserva `payload`, `asOf`, `status` y `readAt`, que es
   todo lo que la bandeja muestra (SPEC-007). RN-15 queda intacta.
3. `unwatch` **no cambia de forma**: sigue siendo un `DELETE` sobre `watched_symbols`. El
   motor referencial de Postgres ejecuta la cascada y el `SET NULL` **dentro de la misma
   sentencia**, así que la atomicidad es del esquema y no de una transacción escrita a mano
   que alguien pueda olvidar en el siguiente camino de borrado.

   *Precisión de alcance añadida en el mismo gate (2026-08-17), tras decidir el humano que el
   defecto de identidad de `unwatch` se arregla dentro de SPEC-024:* esa spec **sí** cambia
   **cómo `unwatch` localiza** la fila a borrar —por `id` de la acción vigilada en vez de por
   `ticker`, cumpliendo la identidad `(ticker, mic_code)` de **ADR-007**— y con ello su firma
   y su cláusula `where`. **No cambia lo que este ADR decide**: sigue siendo un único `DELETE`
   sobre `watched_symbols`, sin borrado explícito de episodios ni de avisos, con la semántica
   de la baja viviendo en las dos FKs. Lo que este punto 3 afirma es que **el borrado no
   lleva cascada escrita a mano**, no que su `where` sea inmutable.

Corolario aceptado a propósito: **quitar y volver a vigilar re-arma el disparo.** Al
re-vigilar se crea una acción vigilada **nueva** (id nuevo; la unicidad `(user_id, symbol_id)`
no estorba porque la anterior se borró de verdad) sin episodios, de modo que si el precio
sigue dentro de la zona el ciclo siguiente **abre un episodio nuevo y emite un aviso de
entrada nuevo**. No es una violación de RN-13/RN-14 sino su lectura correcta: la
idempotencia es *por episodio de vigilancia*, y volver a vigilar es un acto explícito del
usuario pidiendo que se le vuelva a vigilar. Recibir el aviso otra vez es lo que espera; no
recibirlo sería el bug.

## Consecuencias

### Positivas
- El defecto muere en su raíz y para **todos** los caminos de borrado, presentes y futuros
  (baja de cuenta, limpieza administrativa, import): la invariante vive en la FK, no en un
  `unwatch` que hay que acordarse de replicar.
- **RN-15 se respeta sin excepciones**: ningún aviso registrado se pierde nunca, por ningún
  motivo. La bandeja y el contador de no leídos (SPEC-007 CA-6/CA-10) no cambian.
- Coste de código ~cero en el dominio: una migración y dos anotaciones en `src/db/schema.ts`.
  Ni servicio, ni UI, ni motor.
- El modelo queda **dicho**: `zone_triggers` derivado, `notifications` historial. Hasta hoy
  eso era una intuición repartida entre comentarios; ahora es una restricción.

### Negativas / follow-ups
- **Se pierde la trazabilidad aviso → episodio** de los avisos huérfanos. Hoy no la consume
  nadie, pero si algún día se quiere enseñar "a qué disparo corresponde este aviso" (precio y
  `asOf` del episodio), esos avisos ya no podrán enlazarlo. Mitigación disponible y barata:
  `payload` ya lleva ticker, tipo de zona y precio, y el aviso su propio `asOf`.
- **Se pierde el log histórico de episodios** de las acciones que se dejan de vigilar. Se
  asume: no hay ninguna vista que lo muestre y su valor analítico es hipotético. Si en el
  futuro se quiere un "historial de disparos" persistente, tendrá que ser un artefacto propio
  (con su retención), no un efecto colateral de que la FK no dejara borrar. → **F-ADR-017-1**.
- **Cambio de esquema en producción.** La migración es un `ALTER TABLE` de constraints,
  compatible hacia atrás (el código viejo nunca dependía de que la FK fallase), pero
  `DATABASE_URL` está compartida entre Production y Preview (**F-SPEC-023-1**): abrir el PR
  migra producción. Se hereda esa salvedad.
- La cascada es **acción a distancia**: un `DELETE` de una línea borra filas de otra tabla.
  Se acepta porque es exactamente la semántica de pertenencia que se quiere y porque el
  esquema la documenta; la alternativa (borrado explícito) traslada el riesgo a que alguien
  escriba mal el siguiente borrado.
- Queda **fuera** el borrado de cuenta completa (`users` sigue con `no action` en todas sus
  FKs): esta decisión no lo resuelve ni pretende hacerlo. → **F-ADR-017-2**.

## Alternativas consideradas

- **(a) Borrado en cascada explícito dentro de `unwatch`, en una transacción**: borrar
  `notifications` de esos episodios → borrar `zone_triggers` → borrar la vigilada.
  **Rechazada por dos motivos, y el primero es de dominio**: destruye el historial de avisos
  del usuario, lo que contradice **RN-15** (registro in-app como fuente de verdad y fallback)
  y el propio comentario del esquema. Segundo: deja la FK como una mina para cualquier otro
  camino de borrado que se escriba después, y convierte una invariante en una secuencia que
  hay que recordar. Su única ventaja —no tocar el esquema— no compensa.
- **(b) `ON DELETE CASCADE` en las dos FKs**: misma migración que la decisión, pero
  cascadeando también los avisos. **Rechazada por el mismo motivo de dominio que (a)**:
  el efecto sobre el historial es idéntico, solo que ejecutado por el motor. Es la opción que
  parece "más limpia" y es justo la que borra lo que no debe. La decisión conserva su parte
  buena (la invariante en el esquema) y corrige su parte mala diferenciando la semántica de
  cada FK: **cascade** donde hay pertenencia, **set null** donde solo hay referencia.
- **(c) Baja lógica / archivado**: no borrar; marcar la acción vigilada como archivada y
  excluirla de `listWatched` y del ciclo de refresco/disparo. **Rechazada**: conserva todo,
  sí, pero (i) **cambia el significado de CA-5 de SPEC-003** —"desaparece de sus acciones
  vigiladas" pasaría a ser "sigue ahí, oculta"— y de paso el de RN-01 sobre datos que el
  usuario cree haber quitado; (ii) obliga a auditar **todos** los consumidores de
  `watched_symbols` (listado, motor de disparo, notificación, estado de zona) y cualquier
  omisión reabre el bug como *"me sigue avisando de algo que quité"*, que es peor que el 500
  porque es silencioso (**R-F4**); (iii) rompe la unicidad `(user_id, symbol_id)`, obligando a
  que re-vigilar sea un "revivir" con estado previo —incluidos episodios abiertos que
  suprimirían el aviso de re-entrada—; y (iv) es una funcionalidad nueva (archivo/papelera)
  entrando por una spec de defecto, algo que EPIC-FIX declara **fuera de alcance**. Se descarta
  el archivado **como solución a este bug**, no como idea: si algún día el producto quiere una
  papelera de vigiladas, que venga de sdd-producto con su épica.
- **(d) Hacer `zone_triggers.watched_symbol_id` anulable y `SET NULL` también ahí**:
  conservaría el log de episodios. **Rechazada**: la columna es `not null` por una razón
  (un episodio sin acción vigilada no es interpretable: no se sabe contra qué zona se disparó),
  y guardar episodios huérfanos que nadie muestra es acumular basura con coste de esquema.
