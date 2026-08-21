---
id: ADR-028
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-22, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-21, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-028: El episodio de zona sobrevive al cambio de opinión: editar una zona es una actualización, y la reconciliación es del ciclo siguiente

- Deciders: propone **sdd-arquitecto** (2026-08-22) a partir del riesgo **R-1** de EPIC-005,
  registrado por sdd-producto. Pendiente de aprobación por el humano en el gate de
  **SPEC-044**. **Precisión sobre ADR-005**, no sucesor: ADR-005 sigue vigente y no se
  toca ni una de sus cuatro cláusulas. Lo que aquí se decide es lo que ADR-005 **calló**
  —qué significa un episodio cuando el que se mueve es el rango y no el precio— y por qué
  la respuesta correcta es *no hacer nada especial*. Mismo idioma de enmienda que usaron
  **ADR-016** sobre ADR-001 y **ADR-024** sobre D-6 de ADR-018.
- Specs relacionadas: la origina **SPEC-044** (Ajustar las zonas de una vigilada sin
  perder su episodio, EPIC-005). Constriñe a **SPEC-005** (motor de disparo) y **SPEC-006**
  (avisos) sin cambiarlas, y se apoya en **ADR-017** (el episodio pertenece a la vigilada).
  La hereda **SPEC-045** (silencio), que necesita que el episodio sepa sobrevivir a un
  cambio del usuario antes de sobrevivir a un silencio. No toca ADR-002/004/007/012.

## Contexto

Hoy la vigilada es inmutable en la práctica: `/vigiladas` expone alta (`watchAction`) y
baja (`removeAction`), y el único camino para mover un rango es **quitar y volver a
vigilar**. Ese camino no es equivalente a editar, y el propio **ADR-017** explica por qué:
`zone_triggers.watched_symbol_id` es `ON DELETE CASCADE`, así que la baja **borra el
episodio**. Con el episodio borrado, el ciclo siguiente ve un precio dentro de una zona
sin episodio abierto, lo lee como **entrada** (ADR-005, *edge-triggered*) y emite un aviso
nuevo. Mover un rango de 12,00 a 12,50 —un gesto que no significa nada para el mercado—
produce un correo. Y de propina la vigilada pierde su `createdAt` y sus avisos quedan
huérfanos. ADR-017 ya declaró ese re-armado **correcto para la baja** ("volver a vigilar
es un acto explícito del usuario pidiendo que se le vuelva a vigilar"); el defecto no es
esa decisión, es usar la baja como si fuera una edición.

EPIC-005 **CE-2** fija lo que el usuario debe observar al editar, en tres casos:

1. el precio sigue dentro de la zona nueva → el episodio abierto **continúa**, no se
   vuelve a avisar;
2. el cambio deja el precio fuera → el episodio se **cierra**;
3. el precio estaba fuera y el cambio lo mete dentro → eso **sí** es una entrada y se
   avisa como tal.

R-1 anticipaba que esto sería regla nueva sobre ADR-005, porque introduce un suceso que
aquel modelo no nombra: **la zona se mueve debajo de un precio quieto**. Al examinarlo,
el suceso es nuevo pero **el mecanismo no hace falta**. ADR-005 no decide comparando el
precio de ayer con el de hoy: decide comparando **"¿está dentro ahora?"** contra **"¿hay
episodio abierto?"**. Nunca presupuso que la zona fuese constante; presupuso que la fila
de `watched_symbols` siguiera siendo la misma. Con la fila intacta, los tres casos de
CE-2 son literalmente las tres ramas que `evaluateTriggers` ya tiene escritas
(`src/lib/triggers/service.ts`): `dentro && sin episodio → abre`,
`fuera && con episodio → cierra`, `resto → no-op`.

Es decir: **el defecto vive entero en el `DELETE`**, no en el motor. Lo que falta no es
una regla nueva sino la decisión —explícita, para que nadie la deshaga— de que la edición
**no toca el episodio** y de que quien reconcilia sigue siendo el ciclo. Sin escribirla,
las tres tentaciones de abajo (§Alternativas) son exactamente lo que escribiría alguien
razonando de buena fe, y dos de ellas producen el aviso duplicado que CE-2 prohíbe.

Hay además un detalle del código que conviene decir para que no se malinterprete el
alcance: `watchSymbol` **ya** hace upsert por `(userId, symbolId)` y actualiza zonas en
sitio (SPEC-003 CA-4/CA-10). O sea, el camino que preserva la identidad ya existe en el
servicio; lo que no existe es una **acción de edición** que lo alcance sin pasar por el
buscador de símbolos y sin fingir un alta. Esta decisión no inventa la actualización:
declara que la edición **es** esa actualización y le prohíbe efectos colaterales.

## Decisión

**Editar las zonas de una vigilada es un `UPDATE` sobre su fila de `watched_symbols` y
nada más. El episodio de zona no se toca, no se cierra, no se recalcula y no se notifica
en el acto: la reconciliación con la zona nueva la hace el ciclo siguiente, con las
reglas de ADR-005 sin modificar.**

1. **La identidad de la vigilada es la fila, no sus números.** Una edición conserva `id`,
   `userId`, `symbolId` y `createdAt`. Cambiar un rango es **corregir la hipótesis**, no
   plantear otra: la vigilada que sigues desde hace tres meses sigue teniendo tres meses.
   Corolario: `unwatch` + `watch` y `editar` dejan de ser el mismo camino, y esa
   diferencia es observable en test.

2. **El episodio es por `(vigilada, tipo de zona)`, no por `(vigilada, tipo de zona,
   valores de la zona)`.** Ésta es la cláusula que ADR-005 no llegó a escribir y de la que
   cuelga todo lo demás. El episodio responde a *"ya te dije que entró"*, y esa deuda es
   con la vigilada, no con el par de números que tenía puesto cuando entró. Por eso un
   cambio de rango **no invalida** un episodio abierto.

3. **La edición no abre, no cierra y no notifica.** La server action de edición valida,
   escribe y termina. No llama al motor, no llama al notificador y no manda correo. Lo
   único que puede cambiar por editar es lo que el usuario ve al instante en `/vigiladas`
   —el estado de zona, que ya se computa en render con `entraEnZona` sobre la última
   cotización (SPEC-007 CA-1)— y eso no es un aviso: es la pantalla diciendo la verdad.

4. **Quien reconcilia es el ciclo, y el resultado son los tres casos de CE-2 sin código
   nuevo.** En la ejecución siguiente, `evaluateTriggers` compara la última cotización
   contra la zona **nueva**: sigue dentro → no-op (el episodio continúa y RN-14 impide un
   segundo aviso de entrada, porque la unicidad `notif_entry_trigger` es por episodio y el
   episodio no ha cambiado de `id`); quedó fuera → cierra; entró → abre y se avisa. La
   asimetría es la correcta: **el ruido lo genera el precio, no el formulario**.

5. **La latencia es de una cadencia y se asume declarada (D-2).** Entre la edición y la
   reconciliación pueden pasar hasta ~24 h. En esa ventana el **estado de zona** de la
   fila (derivado de la última cotización) y el **episodio** (derivado del último ciclo)
   pueden discrepar. No es una regresión: hoy pasa exactamente igual al dar de alta una
   vigilada cuyo precio ya está dentro. Lo que esta decisión añade es la obligación de que
   **nada presente el episodio como si fuera el estado de ahora** y de que la app no
   invente un aviso para cerrar esa ventana.

6. **El orden del ciclo es garantía, no casualidad.** `runRefreshCycle` corre siempre
   ingesta → disparos → avisos (`src/lib/triggers/cycle.ts`). Por eso una edición que deja
   el precio fuera **cierra el episodio antes** de que se construya el agregado de ese
   ciclo, y la vigilada editada no aparece en un digest diciendo que sigue en zona cuando
   ya no lo está. Ese orden queda protegido por test de SPEC-044: es de lo que depende
   CE-2, no un detalle de implementación reordenable.

7. **La edición no es una puerta trasera de validación.** Pasa por la **misma** puerta
   numérica que el alta (`readDecimalField`, SPEC-030) y por la **misma** validación de
   par (RN-10: ambos extremos o ninguno, `min ≤ max`), en el mismo servicio. No se
   duplican reglas: se reusan. Vaciar una zona entera es una edición válida y no un error.

8. **El símbolo no se edita.** La identidad es `(userId, symbolId)` con unicidad de
   esquema, y la mitad de esa identidad la fija `(ticker, mic_code)` (ADR-007). Cambiar el
   símbolo sería otra vigilada, con la pregunta abierta de qué pasa con los episodios del
   símbolo viejo: sigue siendo baja + alta. La acción de edición **no acepta** símbolo.

9. **La edición identifica su fila por `id` de vigilada y con el `userId` dentro del
   `WHERE`.** Misma disciplina que fijó SPEC-024 para la baja: por ticker no se identifica
   nada cuando el mismo ticker cotiza en dos mercados (ADR-007), y el aislamiento (RN-01)
   no puede depender de que la UI mande el id correcto. Un id ajeno, inexistente o
   malformado **no es una excepción: es "no hay nada que editar"**, y no revela si existe.

## Consecuencias

### Positivas
- **CE-2 sale gratis y sale probado.** Los tres casos son las tres ramas que el motor ya
  tiene; lo que hay que escribir son los tests, no el mecanismo. Cuanto menos código nuevo
  toque el camino del disparo, menos riesgo corre CE-5 (cero regresión sobre EPIC-001).
- **ADR-005 no se supersede.** Su modelo *edge-triggered* queda intacto y gana una
  cláusula que le faltaba (pto. 2). Nadie tiene que releer el motor para entender la
  edición.
- **`zone_triggers` sigue siendo estado derivado puro** (ADR-017): función de (zonas,
  última cotización) y de nada más. Ninguna acción de usuario escribe en esa tabla, así
  que no aparece un segundo autor de episodios al que auditar.
- **RN-14 se respeta sin excepciones**: exactamente un aviso de entrada por episodio,
  también a través de una edición, porque el episodio conserva su `id`.
- **La vigilada deja de mentir sobre su edad** y sus avisos dejan de quedarse huérfanos
  por un gesto que no era una baja.

### Negativas / follow-ups
- **La ventana de hasta una cadencia entre editar y reconciliar es real y visible.** Quien
  mueva la zona para que el precio quede dentro verá su fila "en zona" al instante y
  recibirá el aviso con el ciclo siguiente. Es coherente con D-2 y con toda la app, pero
  es la primera vez que la incoherencia la provoca **el propio usuario con un clic**, así
  que se leerá como retraso y no como cadencia. Mitigación de producto, no de
  arquitectura: SPEC-044 lo dice en pantalla. → **F-ADR-028-1**.
- **No hay historial de zonas ni deshacer.** La edición pisa los valores anteriores y no
  queda rastro de cuáles eran (EPIC-005 lo deja fuera a propósito). Si algún día se quiere
  "antes tenías 12,00–14,00", es esquema nuevo y spec propia, no un efecto colateral de
  esta decisión. → **F-ADR-028-2**.
- **Un episodio puede sobrevivir a una zona que ya no se le parece.** Si la zona era
  12,00–14,00 con el precio en 13 y se cambia a 12,90–13,10, el episodio abierto continúa
  aunque el rango sea otro casi por completo. Es la consecuencia querida del pto. 2 —el
  usuario no ha dejado de estar avisado— pero conviene decirlo en voz alta porque parece
  un bug y no lo es.
- **El caso "editar y volver a editar antes del ciclo" no deja rastro intermedio.** Solo
  se reconcilia contra los valores vigentes cuando pasa el ciclo. Es lo correcto (no hay
  precio nuevo que evaluar) y también significa que un ida y vuelta de zonas dentro del
  mismo día es, para el motor, como si nunca hubiera ocurrido.

## Alternativas consideradas

- **(a) Cerrar el episodio abierto al editar la zona** ("la zona cambió, el episodio
  anterior ya no vale"). **Rechazada, y es la más peligrosa porque parece la más limpia**:
  al cerrar el episodio, el ciclo siguiente encuentra el precio dentro y **sin** episodio,
  abre uno nuevo y emite otro aviso de entrada. Es exactamente el aviso duplicado que
  **CE-2 prohíbe**, reproducido con más pasos que el borrar-y-recrear que veníamos a
  eliminar. Además convertiría una acción de usuario en autora de episodios y rompería el
  carácter derivado que ADR-017 le dio a `zone_triggers`.
- **(b) Evaluar (y notificar) en el acto, dentro de la acción de edición.** Cerraría la
  ventana del pto. 5 y daría gratificación inmediata. **Rechazada por tres motivos**:
  (i) contradice ADR-005 pto. 1, que fijó **una sola cadencia y un solo enganche** para
  que precio y evaluación no puedan desfasarse — aquí evaluaríamos contra una cotización
  que puede tener 20 h; (ii) mete **envío de correo en la ruta de una petición de
  usuario**, con su latencia y su modo de fallo, en un producto cuyo canal ya está tras un
  puerto pensado para correr en el cron (ADR-006); (iii) obligaría a razonar la
  idempotencia del digest (`cycleRef`) fuera de un ciclo, que es justo donde no está
  definida. Si algún día se quiere inmediatez, el camino es adelantar **el ciclo**, no
  duplicar el motor.
- **(c) Dejar el borrar-y-recrear y solo maquillarlo en la UI** (un botón "Editar" que por
  debajo llame a `unwatch` + `watchSymbol`). **Rechazada**: es el defecto con otro nombre.
  Sigue cascadeando el episodio (ADR-017), sigue reseteando `createdAt`, sigue dejando
  avisos huérfanos y sigue produciendo el correo duplicado. Que el usuario no vea los dos
  pasos no hace que no ocurran.
- **(d) Hacer el episodio dependiente de los valores de la zona** (guardar en
  `zone_triggers` el rango que lo originó y considerarlo caducado si el rango cambia).
  **Rechazada**: es la versión "con memoria" de (a) y produce el mismo aviso duplicado en
  cuanto el rango cambie un céntimo, con esquema nuevo de propina. Y responde a una
  pregunta que nadie hace: el usuario no quiere saber con qué rango se le avisó, quiere
  saber si sigue dentro.
- **(e) Reconciliar en el acto sin notificar** (abrir/cerrar el episodio al editar, pero
  sin emitir aviso hasta el ciclo). **Rechazada por poco margen**, y merece explicación
  porque es tentadora: cerraría la ventana del pto. 5 sin mandar correos. Pero (i) abre un
  segundo autor de episodios con sus propias condiciones de carrera contra el cron;
  (ii) evalúa contra una cotización vieja, que es lo que ADR-005 pto. 1 evitó a propósito;
  y (iii) el aviso de entrada acabaría llevando un `asOf` de un episodio abierto fuera de
  ciclo, ensuciando el contrato de D-2. El beneficio —adelantar como mucho una cadencia un
  dato que la pantalla ya enseña— no paga nada de eso.
- **(f) No escribir ADR y dejarlo dentro de SPEC-044.** **Rechazada**: la decisión
  constriñe el motor de disparo y el notificador, que son de otras specs ya `hecho`, y su
  parte más importante (pto. 2) es una cláusula que le faltaba a ADR-005. Una regla que
  vive en la spec de una funcionalidad se pierde en cuanto esa spec se archiva; ésta tiene
  que poder citarse cuando alguien proponga (a) dentro de seis meses.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
