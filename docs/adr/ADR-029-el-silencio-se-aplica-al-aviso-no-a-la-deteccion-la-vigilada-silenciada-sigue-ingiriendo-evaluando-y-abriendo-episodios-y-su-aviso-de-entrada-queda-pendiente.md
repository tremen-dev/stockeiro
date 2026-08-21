---
id: ADR-029
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-22, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-21, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-029: El silencio se aplica al aviso, no a la detección: la vigilada silenciada sigue ingiriendo, evaluando y abriendo episodios, y su aviso de entrada queda pendiente

- Deciders: propone **sdd-arquitecto** (2026-08-22) a partir de **CE-3**, **CE-4** y los
  riesgos **R-1**, **R-3** y **R-6** de EPIC-005. Pendiente de aprobación por el humano en
  el gate de **SPEC-045**. **Matiz ya cerrado en el gate del 2026-08-22** (Alberto Fojo):
  el rótulo del gesto inverso es **Reactivar** y **no** *Quitar silencio* como proponía
  sdd-arquitecto — el humano oyó el argumento del nombre (§Decisión pto. 12) y decidió en
  contra por naturalidad en español. El resto de la decisión llega al gate sin enmiendas. Hereda **ADR-028** (el episodio sobrevive al cambio de opinión
  del usuario) y **ADR-005** (episodios *edge-triggered*), ninguno de los cuales se
  modifica. Domina el término del glosario (**ADR-025**): *vigilada silenciada*.
- Specs relacionadas: la origina **SPEC-045** (Silenciar una vigilada, EPIC-005). Toca el
  contrato de **SPEC-006** (aviso individual **y** digest) y el de **SPEC-007** (estado de
  zona en `/vigiladas`); deja intactas **SPEC-004** (ingesta) y **SPEC-005** (motor).
  Interactúa con **ADR-027** (presupuesto del proveedor en símbolos por ciclo) para
  **rechazar** explícitamente el ahorro. Consume **ADR-026** (geometría) y **ADR-017**
  (los episodios son derivados y caen con la vigilada).

## Contexto

Hoy la única forma de dejar de oír una vigilada es dejar de tenerla. **CE-3** pide callarla
sin cegarla: *"deja de avisar, pero sigue viva: su precio se actualiza cada ciclo y su
estado real se ve en la tabla"*. **CE-4** añade lo que ocurre al volver: *"si durante el
silencio la acción entró en zona y sigue dentro, al reactivarla el usuario se entera —y se
entera de cuánto lleva así—, no empieza a contar de cero"*.

Esas dos frases, juntas, deciden la arquitectura casi solas, y conviene ver por qué antes
de elegir. **El silencio se puede enganchar en tres sitios**, y cada uno recorta algo:

1. **En la ingesta** (no pedir precio de un símbolo que solo vigilan silenciadas).
   Ahorraría cuota —ADR-027 mide el presupuesto en **símbolos por ciclo**, así que sería
   ahorro de verdad— pero **congela el precio**, y entonces la tabla tendría que explicar
   que ese dato está viejo **a propósito**, justo después de que SPEC-043 y RN-16 costaran
   una spec entera para que un dato viejo nunca se presente como vigente. Contradice CE-3
   palabra por palabra y el humano lo descartó por escrito el 2026-08-22.
2. **En la detección** (que el motor se salte las vigiladas silenciadas). Es la lectura
   ingenua de "que no dispare". Y **hace CE-4 imposible**, no difícil: si no se abre
   episodio mientras calla, al volver no hay nada que contar y **no hay de dónde
   reconstruirlo**, porque `quotes` guarda **una sola fila por símbolo** (ADR-004: upsert,
   sin histórico). Sin episodio no existe el "desde cuándo": no está en ninguna parte.
3. **En el aviso** (detectar como siempre; no emitir). Conserva el episodio con su
   `openedAt` y su `asOf`, que es exactamente el dato que CE-4 pide, y deja el motor —la
   pieza de la que depende CE-5, cero regresión— sin tocar una línea.

El tercero no es una preferencia: es el **único** que satisface los dos criterios a la vez.
Lo que queda por decidir de verdad es lo que viene después: qué pasa con el **aviso que no
se emitió**, qué pasa con el **digest** (R-3: se construye aparte y es fácil olvidarlo), y
cómo se evita que el silencio reproduzca el fallo que EPIC-FIX persiguió ocho specs (R-6:
la app deja de avisar y el usuario no se entera de que no le avisa).

Sobre el aviso no emitido hay un detalle del esquema que hace la decisión barata: la
idempotencia del aviso de entrada es el único `notif_entry_trigger` sobre
`notifications.zone_trigger_id` (RN-14). O sea, **el episodio abierto sin fila de aviso
ES, por construcción, un aviso pendiente**. No hace falta inventar una cola: ya existe.

## Decisión

**Silenciar una vigilada suprime sus avisos y nada más. Sigue en el universo del ciclo,
sigue evaluándose, sigue abriendo y cerrando episodios y sigue enseñando su estado real en
`/vigiladas`. El aviso de entrada que le tocaba no se emite y tampoco se registra: queda
**pendiente** en su episodio abierto, y lo paga el primer ciclo tras **reactivarla**.**

1. **Estado nuevo: `watched_symbols.silenced_at timestamptz null`.** `null` = no
   silenciada. Es el mismo idioma que ya usan `zone_triggers.closed_at` y
   `notifications.read_at`: la ausencia es el estado normal y la presencia lleva su fecha.
   Migración **puramente aditiva** (`ADD COLUMN`, nullable, sin `default`, sin relleno):
   cumple **RI-01** sin necesidad de desbloqueo en `drizzle/destructive-waivers.json`, y el
   código anterior a ella la ignora sin enterarse — que es la propiedad que hace tolerable
   el aviso del roadmap de que **Preview comparte la base de producción**.
2. **Es una fecha y no un booleano, a propósito.** `silenced_at` responde *"¿desde
   cuándo?"*, y esa pregunta es el antídoto de **R-6**: una vigilada callada hace tres
   meses puede decirlo en pantalla; un `boolean` solo sabe decir que calla. El coste es
   cero y la información no se puede reconstruir después.
3. **El silencio es de la vigilada entera, no de cada zona.** Calla la compra y la venta a
   la vez. Silenciar por tipo de zona sería una matriz de preferencias que nadie ha pedido
   y que empieza a parecerse a las *preferencias de notificación por canal* que **F-SPEC-006-2**
   mantiene aparcadas desde SPEC-006.
4. **La ingesta no se entera** (CE-3, contra ADR-027). `symbolUniverse`
   (`src/lib/market/refresh.ts`) **no filtra** por silencio: una vigilada silenciada
   mantiene su símbolo en el universo del ciclo y **sigue consumiendo presupuesto del
   proveedor**. Se escribe aquí para que nadie lo "optimice" más adelante creyendo que
   corrige un descuido: es el precio elegido de que el precio siga fresco (RN-16, D-2).
5. **El motor no se entera** (CE-5). `evaluateTriggers` sigue abriendo y cerrando episodios
   de las vigiladas silenciadas con las mismas reglas de ADR-005 y ADR-028. `zone_triggers`
   permanece como estado derivado puro de (zonas, última cotización) y **no gana ninguna
   noción de silencio**: si la ganara, dejaría de ser derivado y CE-4 se quedaría sin la
   memoria que necesita.
6. **El aviso de entrada se suprime SIN registrarlo.** Mientras la vigilada esté
   silenciada, el notificador se salta sus episodios abiertos y **no inserta fila** en
   `notifications`. Esto es lo contrario de lo que dicta el instinto de RN-15, y es
   deliberado: **RN-15 protege el aviso emitido**, no obliga a materializar uno que se
   decidió no emitir; y una fila insertada consumiría la clave `notif_entry_trigger` del
   episodio, matando para siempre la deuda que **es** el mecanismo de CE-4. Un aviso
   suprimido no es un aviso fallido: `status='failed'` significa *"lo intentamos y no
   llegó"* y aquí no se intentó.
7. **Al reactivar, la deuda se paga sola.** El primer ciclo posterior encuentra el
   episodio **abierto y sin fila de aviso** y emite su aviso de entrada por el camino
   normal (RN-14, sin excepción ni rama especial). Va acotado por construcción: una
   vigilada debe como mucho **dos** avisos (compra y venta), así que no hay avalancha
   posible. El aviso dice **cuándo entró** y que **sigue dentro**; no presenta el precio
   del episodio como si fuera el de hoy (D-2).
8. **Lo que se cerró mientras callaba no se cuenta después.** Un episodio que abrió y
   cerró durante el silencio **no genera aviso retroactivo**. CE-4 habla solo de *"entró y
   sigue dentro"*, y avisar de una entrada que ya terminó sería un aviso sobre algo que ya
   no se puede hacer — la misma familia de defecto que ADR-027 llamó *motivo mentiroso*.
   Además sale gratis: el notificador ya solo mira episodios con `closed_at is null`. La
   pérdida de conocimiento es real y se acepta con nombre → **F-ADR-029-1**.
9. **El digest también calla** (R-3). El aviso agregado de permanencia excluye las
   vigiladas silenciadas. Si **todas** las que un usuario tiene en zona están silenciadas,
   ese ciclo **no se emite digest** para él: no un digest vacío, ninguno. Un silencio que
   solo tapa el aviso individual sería mentira el primer día que se agrupe.
10. **El "desde cuándo" se dice con el `asOf` del episodio, no con su `openedAt`.**
    `opened_at` es la hora del servidor en que corrió el ciclo; `as_of` es la fecha de
    mercado del precio que lo abrió, que es la que el usuario piensa y la que toda la app
    enseña (D-2). `opened_at` se queda como dato interno.
11. **Silenciada no es archivada ni desactivada, y la pantalla tiene que dejarlo claro**
    (CE-3, R-6). La fila sigue en `/vigiladas`, con su color y su etiqueta de estado de
    zona **sin cambiar** (SPEC-007 CA-1), y encima lleva una marca **de texto** —no solo un
    icono ni solo una atenuación— que dice que está silenciada y desde cuándo. No se
    esconde, no se manda al final de la lista y no se saca de ningún recuento. El silencio
    es lo único que se apaga.
12. **El término (ADR-025): *vigilada silenciada*; el gesto, *Silenciar*; su inverso,
    *Reactivar*.** Los tres son literales de interfaz y los tres están firmados por el
    humano en el gate del 2026-08-22. Los dos primeros son la propuesta de sdd-arquitecto;
    el tercero **la corrige**: sdd-arquitecto proponía *Quitar silencio* razonando que
    "reactivar" afirma que la vigilada estaba **inactiva** —exactamente lo contrario de lo
    que sostiene CE-3, y la clase de trampa de nombre que ADR-025 existe para evitar—, y el
    humano, oído el argumento, eligió **Reactivar** por naturalidad en español. Queda
    cerrado. Se rechaza *pausar*, que prometería el vencimiento que está fuera de alcance.

    **Consecuencia que sí hereda quien implemente**: como el rótulo elegido puede leerse
    como "volver a vigilarla", la fila del glosario tiene que deshacer esa ambigüedad de
    forma explícita —*reactivar* = volver a **oírla**, nunca volver a **vigilarla**, porque
    nunca dejó de vigilar (pto. 4 y pto. 5)—. Esa fila la escribe sdd-arquitecto en el gate
    de SPEC-045, no antes, y hay test que ata los rótulos de pantalla a ella (SPEC-045
    CA-28).
13. **El silencio no caduca y la app no insiste.** No hay vencimiento, no hay recordatorio
    periódico, no hay correo de *"llevas 40 días callando esto"*. La única defensa contra
    la vigilada callada y olvidada es que **se ve** (pto. 11). Es una defensa deliberadamente
    modesta y se registra como tal → **F-ADR-029-2**.
14. **Silenciar y reactivar no tocan `notifications` ni `zone_triggers`.** No
    marcan nada leído, no borran, no cierran episodios. Son un `UPDATE` de una columna de
    `watched_symbols`, con el `userId` dentro del `WHERE` y el id de la vigilada como
    identidad (RN-01, misma disciplina de SPEC-024 y ADR-028 pto. 9). Y son
    **idempotentes**: silenciar lo ya silenciado no mueve `silenced_at` —o se perdería el
    "desde cuándo"— y reactivar lo que ya habla no hace nada.

## Consecuencias

### Positivas
- **CE-4 es posible.** El episodio abierto ES la memoria de lo que pasó mientras nadie
  escuchaba, y su `as_of` ES el "cuánto lleva así". Sin la decisión 5, ese dato no existe
  en ninguna tabla del sistema.
- **CE-5 sale casi gratis**: el motor y la ingesta no cambian, así que la suite de EPIC-001
  no tiene por qué moverse. Todo el cambio de comportamiento se concentra en el
  notificador, en una columna y en la tabla de `/vigiladas`.
- **La cola de avisos pendientes no existe** como artefacto: es el estado que RN-14 ya
  mantenía. Cero esquema nuevo por ese lado, cero riesgo de que la cola y la realidad
  diverjan.
- **La migración es la más benigna posible** (aditiva, nullable, sin relleno), que es lo
  máximo que se puede pedir sabiendo que una PR de esta épica migra producción.
- **El silencio es reversible sin pérdida**: nada se borra, así que reactivar
  devuelve exactamente el estado que habría habido, salvo los avisos que se decidió no dar.

### Negativas / follow-ups
- **F-ADR-029-1 — Lo que pasó y terminó durante el silencio se pierde para el usuario.**
  El episodio cerrado queda en `zone_triggers`, pero nadie lo enseña (F-ADR-017-1 sigue
  abierto: no hay vista de historial de disparos). Si algún día se quiere *"mientras
  callaba, ITX estuvo en zona tres días"*, es la misma spec de historial que ya está
  aparcada, no un parche aquí.
- **F-ADR-029-2 — La vigilada callada y olvidada sigue siendo posible.** La mitigación es
  visual (pto. 11) y depende de que el usuario mire la tabla. Un recordatorio proactivo
  ("llevas N días sin oír esto") es capacidad nueva, con su cadencia y su canal, y hoy
  chocaría con el propio silencio que el usuario pidió.
- **El silencio cuesta cuota.** Con el presupuesto de ADR-027 medido en símbolos por ciclo,
  una lista de vigiladas silenciadas sigue pagando. Está asumido a conciencia (pto. 4) y es
  lo primero que alguien propondrá recortar si la cuota aprieta: entonces habrá que volver
  aquí y escribir el ADR sucesor, no editar éste.
- **Aparece una tercera acción por fila en `/vigiladas`**, en la pantalla más apretada del
  producto (R-5), con SPEC-040 CA-5 exigiendo que la última columna siga siendo alcanzable
  a 360 px. La geometría se mide con el módulo de ADR-026 y `overflow: hidden` no cuenta
  como arreglo; el reparto concreto lo resuelve SPEC-045.
- **`/vigiladas` empieza a leer `zone_triggers`.** Para decir "en zona desde el X" hace
  falta el episodio, y hasta hoy **ninguna vista lo enseñaba** —ADR-017 lo usó como
  argumento para cascadearlo en la baja—. La decisión de ADR-017 **no cambia** (el episodio
  sigue perteneciendo a la vigilada y sigue cayendo con ella), pero deja de ser cierto que
  nadie lo mire, y quien lea aquel ADR debe leerlo junto a éste.
- **El estado de la fila y el episodio pueden discrepar durante una cadencia**, por lo
  mismo que explica ADR-028 pto. 5. Regla derivada: si no hay episodio abierto de ese tipo,
  **no se dice desde cuándo**; no se inventa una fecha a partir del estado calculado en
  render.

## Alternativas consideradas

- **(a) Silenciar sacando el símbolo del universo de la ingesta.** Ahorraría cuota real
  (ADR-027). **Rechazada por el humano el 2026-08-22 y ratificada aquí**: congela el precio,
  obliga a explicar en la tabla que el dato está viejo a propósito —justo lo que RN-16 y
  SPEC-043 acaban de cerrar—, y rompe CE-3 ("su precio se actualiza cada ciclo"). Se reabre
  si la cuota aprieta, y entonces será un ADR sucesor, no una excepción escondida.
- **(b) Silenciar en el motor (no evaluar las vigiladas silenciadas).** **Rechazada porque
  hace CE-4 imposible**, no solo peor: sin episodio no hay "desde cuándo" y `quotes` no
  guarda histórico del que reconstruirlo. Además ensuciaría `zone_triggers`, que hoy es
  función pura de (zonas, última cotización), con un estado de preferencia del usuario.
- **(c) Emitir el aviso y marcarlo como suprimido / leído** (insertar la fila con un estado
  nuevo, o con `read_at` puesto). Parece más fiel a RN-15 y deja rastro. **Rechazada**:
  consume la clave `notif_entry_trigger` del episodio, de modo que al quitar el silencio
  **ya no hay deuda que pagar** y CE-4 muere; además llena la bandeja de avisos que el
  usuario pidió no recibir, que es el gesto contrario al que hizo.
- **(d) Al reactivar, emitir un "resumen de lo que te perdiste" propio** (un aviso
  nuevo, de tipo nuevo, con lo ocurrido durante el silencio). **Rechazada**: exige un tipo
  de aviso más, su plantilla, su idempotencia y su ventana temporal, para decir lo mismo
  que ya dicen los avisos de entrada pendientes más el digest del ciclo siguiente. Y la
  parte que sí aporta —enterarse **en el momento** de quitar el silencio— se resuelve en
  pantalla, sin correo y sin esquema (SPEC-045).
- **(e) `silenced boolean not null default false`.** **Rechazada**: mismo coste y menos
  información. No puede contestar "¿desde cuándo?", que es la única defensa contra R-6, y
  obliga a una segunda columna el día que se quiera. Una migración con `default` además
  reescribe toda la tabla, cosa que la nullable no hace.
- **(f) Baja lógica / archivado ("silenciada" como una papelera).** **Rechazada, y ya lo
  estaba**: es la alternativa (c) que ADR-017 descartó para la baja, con los mismos motivos
  —obliga a auditar a todos los consumidores de `watched_symbols` y cualquier omisión
  reabre el bug silencioso "me sigue avisando de algo que quité"—. Aquí sería peor todavía,
  porque CE-3 dice literalmente lo contrario: silenciar **no** es un borrado blando.
- **(g) Silencio con vencimiento** ("cállala hasta el día 15"). **Descartado por el humano
  el 2026-08-22**: introduce un concepto de tiempo programado que hoy no existe en ninguna
  parte del producto (no hay ni un solo trabajo diferido que no sea el ciclo). Se reabre si
  alguien lo pide de verdad; el `silenced_at` de esta decisión no lo estorba.
- **(h) No escribir ADR y resolverlo dentro de SPEC-045.** **Rechazada**: la decisión
  atraviesa cuatro specs ya `hecho` (004, 005, 006, 007), rechaza a conciencia una
  optimización que ADR-027 hace tentadora, y su pieza central (pto. 6, *no registrar el
  aviso suprimido*) es contraintuitiva frente a RN-15 y será "corregida" por alguien de
  buena fe si no está escrita donde se pueda citar.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
