---
id: SPEC-043
tipo: spec
epica: EPIC-FIX
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-08-21, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-21, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-08-21, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-21, por: sdd-implementador}
---
# SPEC-043 — La cotizacion que dejo de refrescarse lo dice, y la cuota agotada deja de disfrazarse de caida del proveedor

## Problema

El **2026-08-21** se descubrió que el ciclo diario llevaba desde el **2026-08-19** sin
actualizar ni un precio. Tres días. Nadie se enteró — y no por falta de datos: la base los
tenía todos desde el primer minuto.

Los hechos, leídos de producción (no hipótesis):

- **`cron_runs`**: runs del `2026-08-19T22:12Z` y del `2026-08-20T22:14Z`, ambos
  `outcome='success'`, `requested=13`, `updated=0`, `skipped=13`.
- **`quote_diagnostics`**: los **13** símbolos con `reason='proveedor_no_disponible'`,
  escritos **en el mismo segundo** — firma de fallo **global**, no de trece fallos sueltos.
- **Causa externa**: Marketstack respondió **HTTP 429** con
  `{"code":"usage_limit_reached","message":"Your monthly usage limit has been reached."}`.
  Cuota mensual agotada.
- **Última ingesta buena**: `2026-08-18T23:43Z`.

De ahí salen **dos defectos independientes**, y los dos son del tipo que **EPIC-FIX** existe
para matar: **CE-F2, ningún fallo silencioso**.

### Defecto 1 — el aviso existe en la base y ninguna pantalla lo enseña

`quote_diagnostics` tenía las trece filas desde el día 19. Pero el aviso que **SPEC-016**
entregó está condicionado a que **no haya precio**:

- `src/app/vigiladas/watched-table.tsx:166` pinta el motivo **solo si** `r.state === 'none'`.
- `src/app/cartera/page.tsx:83` lo pinta **solo si** `p.plActual === null`.

Con una cotización vieja **sí hay precio**: hay estado de zona (salía «Fuera de zona») y hay
P/L actual calculado. Así que el motivo quedaba **oculto** y el símbolo se presentaba como
sano, congelado en su última cotización buena, **indefinidamente**. El único síntoma visible
era la fecha «a fecha» en gris, que el usuario cazó a ojo **tres días tarde**.

**SPEC-016 cerró el silencio del símbolo que NUNCA tuvo precio. Sigue abierto el del símbolo
que DEJÓ de tenerlo.** Es el mismo CE-F2 un escalón más arriba, y es el **más grave de los
dos**: el producto promete vigilancia (**CE-1**) y P/L al día (**CE-3**) y lo que hace es
enseñar un precio de hace tres días con la misma tipografía que uno de anoche. Un usuario
puede decidir una compra sobre ese precio creyéndolo de hoy — y el no-negociable de
FOUNDATION (**D-2**: *«jamás dar falsa sensación de tiempo real»*) se cumple en la letra
(el `asOf` está ahí) y **se incumple en el fin**.

### Defecto 2 — el motivo que se persiste es falso

`classifyGlobal` (`src/lib/market/marketstack-provider.ts:171`) no tiene rama para HTTP 429
ni para `usage_limit_reached`, así que la respuesta cae al motivo por defecto,
`proveedor_no_disponible`, cuyo contrato **escrito en el código** promete que *«es
transitorio y el próximo ciclo puede ir bien»* y cuyo texto de usuario dice *«se reintentará
en el próximo ciclo»*.

**No lo es.** La cuota agotada es **terminal** hasta que renueve el mes o se cambie de plan:
reintentar mañana falla igual, y falló igual dos días seguidos. Al operador se le dijo *«el
proveedor se cayó»* cuando la verdad era *«te has quedado sin cuota»*, que pide una acción
**distinta**: reponer, no esperar. Un motivo mentiroso es peor que ningún motivo, porque
consume la confianza que SPEC-016 acababa de construir (**R-F4**).

### Por qué el arreglo va donde el usuario mira, y no en una alerta

La pregunta obvia —*«¿por qué no avisar al operador?»*— tiene respuesta escrita y es
**normativa**: **ADR-023 pto. 15** (*el ciclo se registra y se muestra; nunca alerta*) deja
la alerta proactiva fuera por decisión del humano, y `cron_runs` **no es la puerta de atrás
por la que se cuela**. Así que el único arreglo legítimo dentro de la constitución de este
proyecto es **decir la verdad en las pantallas que el usuario ya abre**. Que es, además,
donde el daño se produce.

Reglas y decisiones que gobiernan: **D-2** (carácter diferido siempre visible), **RN-06**
(sin precio no se calcula P/L — **no cambia**), **RN-11** (entrada en zona — **no cambia**),
**RN-12** (último cierre no ajustado), **RN-01/RN-03** (aislamiento y sesión), **ADR-012**
pto. 6 (el puerto no se traga el motivo), **ADR-023** pto. 15 (registrar no es alertar),
**ADR-026** (geometría medida elemento a elemento), y **ADR-027**, escrito con esta spec.

## Usuarios / roles afectados

- **Usuario final** (`tester` y `completo`): deja de ver un precio viejo con cara de
  vigente. Cuando su acción lleva sin refrescarse, la fila **lo dice** y, si se sabe, dice
  **por qué**. Puede actuar en consecuencia: no decidir una compra sobre un dato muerto.
- **Operador** (`admin`): cuando la causa es la cuota, el motivo persistido le manda a
  **reponer**, no a esperar. No recibe ninguna alerta nueva (ADR-023 pto. 15): lo ve donde
  ya mira.
- **Sistema**: el clasificador del adaptador deja de meter en el cajón de «el proveedor se
  cayó» un fallo que no es una caída.

## Criterios de aceptación

Cada CA es verificable con un test; los de UI con Playwright (patrón SPEC-007) y los de
geometría con el módulo compartido de **ADR-026**. Los motivos se inyectan con el **fake**
tras `MarketDataProvider`, como en SPEC-016 y SPEC-020; la respuesta del proveedor se
simula con `fetchImpl`, como en SPEC-020.

### A — El motivo verdadero (defecto 2)

- **CA-1 (La cuota agotada tiene nombre propio).**
  Dado que el proveedor responde **HTTP 429** con código `usage_limit_reached`,
  cuando el ciclo pide las cotizaciones,
  entonces **todos** los símbolos pedidos quedan con el motivo **`cuota_agotada`** —no
  `proveedor_no_disponible`— y ese es el motivo que se persiste por símbolo y el que
  llega a la UI (ADR-027 pto. 4; el mecanismo de propagación y persistencia es el de
  SPEC-016 CA-1/CA-2 y **no se re-especifica aquí**).

- **CA-2 (El tope por segundo sigue siendo transitorio).**
  Dado que el proveedor responde **HTTP 429** con `rate_limit_reached` o
  `too_many_requests`,
  cuando el ciclo pide las cotizaciones,
  entonces el motivo es **`proveedor_no_disponible`**, que ahí sí es la verdad. Los dos
  429 **no se confunden** (ADR-027 pto. 5).

- **CA-3 (Ante un 429 mudo se presume cuota, y consta por qué).**
  Dado un **HTTP 429** con cuerpo ilegible o con un código no reconocido,
  cuando se clasifica,
  entonces el motivo es **`cuota_agotada`**: esta app hace **una** llamada por ciclo y no
  puede alcanzar un tope por segundo, y equivocarse hacia «revisa tu cuota» manda al
  operador al sitio correcto, mientras que equivocarse hacia «se reintentará» reproduce el
  defecto (ADR-027 pto. 5). La presunción queda **escrita junto al código**, no implícita.

- **CA-4 (El texto de usuario no promete lo que no puede cumplir).**
  Dado el motivo `cuota_agotada`,
  cuando se busca su texto de usuario,
  entonces existe una entrada **propia y distinta** de la de `proveedor_no_disponible`,
  que **no contiene** ninguna fórmula de reintento (*«se reintentará»*, *«próximo ciclo»*)
  ni acusa al valor de estar deslistado, y que atribuye la causa y la acción a **nosotros**.
  Se ata con una **lista cerrada y versionada de fórmulas prohibidas**, mismo mecanismo que
  SPEC-035 CA-7 y SPEC-039 CA-7.

- **CA-5 (La resiliencia y el contrato del ciclo no cambian — no regresión).**
  Dado un fallo global por cuota agotada,
  cuando corre el ciclo,
  entonces se degrada a fallo **por símbolo** sin abortar, los símbolos que sí obtienen
  precio se actualizan igual, el endpoint sigue devolviendo **200** con el mismo cuerpo y
  `cron_runs` se cierra como hoy. El criterio es de **SPEC-016 CA-7** y **SPEC-020 CA-9**:
  aquí solo se comprueba que **la rama nueva no lo rompe**.

- **CA-6 (La ayuda explica el motivo nuevo y su cuenta deja de mentir).**
  Dado que `QuoteFailureReason` gana un valor,
  cuando se compila y se abre `/ayuda`,
  entonces el motivo nuevo **tiene su explicación** (garantía que ya da el mapa total de
  SPEC-039: sin ella **no compila**) **y** la cifra escrita en prosa de
  `SIN_PRECIO_SECCION` —hoy *«es uno de estos seis»*— deja de ser un literal suelto y
  queda **atada al recuento real** de motivos, igual que `MERCADOS_EN_PROSA` está atada a
  `OPERATING_MICS.length`. Sin esto, la ayuda envejece **en silencio** el día que se añade
  el motivo, que es exactamente el defecto que costó EPIC-FIX entera (F-SPEC-039-3).

### B — La cotización que dejó de refrescarse (defecto 1)

- **CA-7 (Qué es una cotización sin refrescar, y se mide por `updated_at`).**
  Dada una cotización cuyo `updated_at` —el momento en que **el ciclo la escribió**, no su
  `as_of` de mercado— tiene **más de 36 h** (umbral fijado en el gate, ver CA-12 y nota 2),
  cuando se consulta,
  entonces está **sin refrescar**.
  Y su contrapositivo, que es la mitad importante: **un fin de semana, un festivo o un día
  sin sesión NO la vuelven «sin refrescar»**, porque un ciclo con éxito **reescribe la fila
  aunque el precio no haya cambiado**, y `updated_at` se mueve igualmente. Medir por
  `as_of` exigiría un calendario de sesiones por mercado que la app **no tiene y no
  introduce**; medir por `updated_at` no necesita ninguno. Hay un tercer argumento, medido
  el 2026-08-21 en una sola llamada: **el proveedor publica el EOD con retraso desigual por
  símbolo** (`APP` traía `date` `2026-08-19` mientras `AAPL` e `ITX` ya traían
  `2026-08-20`), así que `as_of` puede ir atrasado **en un símbolo que se está refrescando
  perfectamente**. Por `as_of` habría falsos positivos incluso con calendario.

  **Premisa explícita de este CA, y no es un detalle:** las 36 h suponen un ciclo **diario
  sin saltos**. El día que el ciclo deje de correr algún día de la semana, este umbral
  marca de golpe **todo** el universo como sin refrescar (72 h de hueco de viernes a lunes
  contra un umbral de 36 h) y vuelve a hacer falta el calendario de sesiones que este CA
  elimina. Por eso el salto de fin de semana está fuera de alcance **y no puede entrar sin
  tocar este umbral en la misma entrega** (ver «Fuera de alcance»).

- **CA-8 (`/vigiladas` lo dice aunque haya precio y aunque haya estado de zona).**
  Dada una acción vigilada cuya cotización está sin refrescar,
  cuando el usuario abre `/vigiladas`,
  entonces la fila **dice que ese precio no se está actualizando** y, si hay diagnóstico
  vigente para el símbolo, **por qué** — **con independencia de su estado de zona**. En
  particular ocurre con `state` distinto de `none` (hoy el aviso está condicionado a
  `r.state === 'none'`, `watched-table.tsx:166`, y ese es el defecto).

- **CA-9 (`/cartera` lo dice aunque el P/L actual tenga número).**
  Dada una posición cuya cotización está sin refrescar,
  cuando el usuario abre `/cartera`,
  entonces la celda de **P/L actual** lleva la misma marca y, si lo hay, el motivo — **con
  independencia de que el P/L esté calculado**. En particular ocurre con `plActual !== null`
  (hoy está condicionado a `p.plActual === null`, `cartera/page.tsx:83`, y ese es el
  defecto).

- **CA-10 (Sin diagnóstico se dice lo que se sabe y no se inventa el resto).**
  Dada una cotización sin refrescar para la que **no** hay fila en `quote_diagnostics`
  —el caso del ciclo que **nunca llegó a invocarse**, hueco declarado y aceptado en
  **F-SPEC-037-4**—,
  cuando el usuario la mira,
  entonces se le dice que **no se está actualizando desde** su fecha, **sin atribuirle
  ningún motivo**. Ni «el proveedor no respondió» ni ninguna otra causa inventada: se dice
  el hecho y se calla la causa que no se conoce.

- **CA-11 (La marca desaparece sola al volver la normalidad).**
  Dada una cotización sin refrescar,
  cuando un ciclo posterior **sí** la actualiza,
  entonces la marca y el motivo **desaparecen** en la visita siguiente, sin intervención y
  sin avisos fantasma (hermano de **SPEC-016 CA-8**, que ya limpia el diagnóstico).

- **CA-12 (Una sola definición y un umbral derivado de la cadencia declarada).**
  Dado que dos pantallas tienen que decir lo mismo,
  cuando se decide si una cotización está sin refrescar,
  entonces **ambas llaman a la misma función** sobre el **mismo umbral** —las **36 h** de
  CA-7—, que vive en **un solo sitio** y está expresado **en ciclos de la cadencia
  declarada** (un ciclo perdido + medio día de holgura), no como un número de horas
  repetido en cada pantalla, del mismo modo que `CADENCIA_LINEA` se dice tres veces desde
  una sola constante (SPEC-039 CA-3). Un segundo literal es la forma más barata de acabar
  con dos definiciones y una equivocada. Ese único sitio es, además, **el que tendrá que
  tocar** quien algún día meta el salto de fin de semana (ver «Fuera de alcance») y el que
  **RN-16** describe en prosa: código y regla apuntan al mismo número.

- **CA-13 (RN-06 y RN-11 intactos: marcar no es borrar).**
  Dada una cotización sin refrescar,
  cuando se calculan el P/L actual y el estado de zona,
  entonces **se siguen calculando exactamente como hoy** sobre esa cotización: el P/L no
  pasa a «—» y el estado de zona no pasa a «sin dato». Esta spec **no cambia RN-06, RN-11
  ni RN-12**; hace **observable** lo que ya ocurría, que es literalmente lo que hizo
  SPEC-016. Ocultar el dato sería sustituir una mentira por una pérdida de información.

### C — Fronteras que esta spec no cruza

- **CA-14 (No se alerta a nadie — ADR-023 pto. 15).**
  Dada cualquier situación de esta spec (cuota agotada, cotización sin refrescar, ciclo que
  no corrió),
  cuando se procesa,
  entonces **no se envía correo, no se crea aviso in-app, no se escribe en `notifications`
  y no se despierta a nadie**. La frontera es normativa y esta spec **no la abre**.

- **CA-15 (La marca nueva no rompe la tabla — ADR-026).**
  Dada `/vigiladas` a **360 px** y a **1280 px** con filas marcadas y sin marcar,
  cuando se mide **elemento a elemento** con el módulo compartido de ADR-026,
  entonces **ningún elemento desborda** su contenedor y la tabla no se estira. Se pide
  explícitamente porque **esta tabla ya se rompió por esto**: el párrafo del motivo de
  SPEC-016 la estiraba, y lo arregló SPEC-040 CA-4. La marca de esta spec entra en la misma
  celda.

- **CA-16 (El incidente real, reproducido — CE-F1).**
  Dado el escenario **exacto** del 19 y 20 de agosto —trece símbolos, un único **429
  `usage_limit_reached`**, y cotizaciones cuyo `updated_at` se quedó en el `2026-08-18`—,
  cuando se corre el ciclo y se abren `/vigiladas` y `/cartera`,
  entonces las trece filas quedan con motivo **`cuota_agotada`** y **las dos pantallas
  dicen que esos precios no se están actualizando y por qué**. Es la verificación que
  **CE-F1** exige: el defecto **corregido**, demostrado sobre el caso que lo destapó.

## Entidades y reglas afectadas

- **`QuoteFailureReason`** (`src/lib/market/provider.ts`): gana **`cuota_agotada`**
  (ADR-027 pto. 4). Tipo **cerrado**, así que el valor nuevo arrastra por compilación su
  texto de usuario (`fail-reason-text.ts`) y su explicación en la ayuda
  (`src/lib/help/content.ts`) — esa totalidad es una garantía de SPEC-039 y se **usa**, no
  se rodea.
- **`MarketstackProvider.classifyGlobal`** (`src/lib/market/marketstack-provider.ts`):
  clasifica el 429 según ADR-027 pto. 5. Hoy no recibe el **estado HTTP**, solo el cuerpo;
  cómo se lo lleva es del implementador, pero **el estado es información necesaria** y no
  puede seguir descartándose.
- **Cotización sin refrescar** (concepto nuevo, término propuesto para el glosario en las
  notas del gate): derivada de `quotes.updated_at`, **no** de `quotes.as_of` (CA-7). No es
  una entidad ni una columna nueva: el dato ya está en la fila.
- **Lectura de cotizaciones** (`src/lib/market/quotes.ts`): `QuoteView` hoy **no expone**
  `updated_at`; tendrá que hacerlo para que las pantallas puedan decidir. Es lectura, no
  esquema.
- **UI**: `src/app/vigiladas/watched-table.tsx` y `src/app/cartera/page.tsx` — las dos
  condiciones que ocultan el motivo (`r.state === 'none'` y `p.plActual === null`) son el
  defecto y desaparecen como condición **de la marca**. Design system `tremen-ds`.
- **Ayuda** (`src/lib/help/content.ts`): motivo nuevo explicado + la cifra en prosa atada al
  recuento (CA-6).
- **Reglas**: **RN-06**, **RN-11**, **RN-12** — citadas y **sin cambiar** (CA-13);
  **RN-01/RN-03** (aislamiento y sesión: la marca se ve sobre los símbolos que el usuario
  referencia, bajo sesión — el criterio es **SPEC-016 CA-9** y no se re-especifica).
- **Regla nueva: RN-16 (Cotización sin refrescar)**, decidida en el gate del 2026-08-21 y
  **escrita en `docs/fundacion/reglas.md` al aprobar** (redacción cerrada en la nota 5). Es
  la **gemela documental de CA-12**: fija en prosa el mismo umbral de 36 h que el código
  tiene en un solo sitio, para que el siguiente que enseñe un precio —o el siguiente que
  toque el ciclo— no tenga que redecidirlo.
- **Decisiones**: **ADR-027** (unidad de presupuesto y motivo nuevo), **ADR-012** pto. 6
  (contrato del puerto), **ADR-023** pto. 15 (registrar no es alertar), **ADR-026**
  (geometría), **ADR-025** (quién escribe el glosario y cuándo), **D-2** (no-negociable).
- **Línea de EPIC-FIX sobre este mismo puerto**: **SPEC-015** (cobertura), **SPEC-016**
  (diagnóstico visible), **SPEC-020** (dialecto por mercado y fallo global), **SPEC-021**
  (cadena inambigua). Esta spec **continúa** esa línea y **no repite** sus criterios: los
  cita.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Cambiar de plan o de proveedor.** Es decisión de **producto y coste** y ya está sobre la
  mesa del humano (Basic, $9.99/mes: 10.000 unidades/mes y uso comercial, que el free tier
  **no** concede; el consumo real de ~400/mes cabe de sobra). **Esta spec funciona pague lo
  que pague**: con cuota de sobra el motivo no aparece nunca; con cuota agotada aparece con
  su nombre. Lo que la decisión de plan **sí** toca es **CE-F3 de EPIC-FIX** — ver
  **F-ADR-027-1** y la nota 4 del gate.
- **Alerta proactiva al operador** (correo, webhook, aviso in-app del estado del ciclo).
  **Prohibida por ADR-023 pto. 15**, que es frontera normativa. Sigue siendo la idea
  *«Observabilidad del ciclo diario»* del roadmap y necesita **su propia spec**; que ahora
  sea más fácil no la mete en alcance (CA-14).
- **Cambiar la semántica de `outcome` en `cron_runs`.** **Mirado y dejado a propósito
  (gate humano, 2026-08-21)**, que no es lo mismo que no haberlo visto: un ciclo con
  `requested=13`, `updated=0`, `skipped=13` y `outcome='success'` es incómodo de leer, y
  aun así se queda **como está**. **SPEC-037 / ADR-023** decidieron por escrito que
  Operación enseña **los contadores** y el **operador juzga**; tocarlo abre el contrato de
  ADR-023 y merece su propia decisión, no un CA colado aquí. Quien lo relea dentro de seis
  meses debe saber que **se miró en el incidente que lo destapó y se decidió no moverlo**.
- **Suprimir o alterar disparos y avisos sobre una cotización sin refrescar.** El aviso de
  **permanencia** (RN-14) se repite cada ciclo sobre los episodios abiertos, así que con un
  precio congelado seguiría diciendo *«sigue en zona»* sobre un precio de hace tres días.
  **Decidido fuera de alcance (2026-08-21)**, con el contexto verificado anotado para quien
  lo retome:
  - `src/lib/notifications/service.ts:140` compone el cuerpo como
    `` `Siguen en zona: ${lista}. (asOf ${cycleRef})` ``: el aviso **sí lleva fecha**, no es
    mudo. Pero repite **exactamente la misma señal débil** —una fecha suelta— que ya falló
    en pantalla y que es el defecto de esta spec.
  - Peor: `cycleRef` sale de **`max(quotes.asOf)` GLOBAL** (línea 67), **no por símbolo**.
    Basta **un** símbolo fresco para que el digest entero **parezca fresco**, aunque los
    otros doce lleven tres días congelados.
  - **El arreglo natural, una vez exista RN-16, es que RN-14 consuma esa misma regla** en
    lugar de redecidir qué es viejo. Por eso el orden importa: primero la regla, después el
    aviso. Se abre como **F-SPEC-043-1** (idea de roadmap), **no** como CA: tocar el motor
    de disparo o el contenido de los avisos es **cambiar el producto**, y RN-13/RN-14 son
    reglas de negocio con dictamen propio.
- **Saltar el ciclo los fines de semana para ahorrar cuota.** Propuesto en el gate y
  **rechazado para esta spec (2026-08-21)**. Los motivos, que son los que hay que releer
  cuando se retome:
  - **No rescata ningún plan.** 13 símbolos × ~22 días hábiles ≈ **286 unidades/mes**,
    todavía casi **3×** las 100 del free tier. Y sobre Basic (10.000/mes) ahorra ~114
    unidades: un **1,1 %**. No arregla nada en ninguno de los dos lados.
  - **Choca de frente con CA-7.** Con salto de fin de semana, el último `updated_at` bueno
    es el viernes a las 22:00 UTC y el siguiente el lunes a las 22:00 UTC: **72 h de hueco
    contra un umbral de 36 h**. Sábado, domingo y lunes la app marcaría **todo** el universo
    como sin refrescar. Volvería a hacer falta el **calendario de sesiones por mercado** que
    el dictamen de sdd-mercados eliminó precisamente al medir por `updated_at`.
  - **La ejecución del sábado no es inútil.** El proveedor publica el EOD con **retraso
    desigual por símbolo** (medido el 2026-08-21, misma llamada: `APP` traía `date`
    `2026-08-19` mientras `AAPL` e `ITX` ya traían `2026-08-20`). Matar el ciclo del sábado
    **pierde el cierre del viernes hasta el lunes** para los símbolos rezagados.
  - **«Fin de semana» es la parte fácil.** Los mercados del universo (BMEX, XPAR, XNAS,
    XNYS) tienen **calendarios de festivos distintos**, y ahí está la otra mitad del ahorro
    y toda la dificultad.
  → Candidato a **spec propia** (**F-SPEC-043-2**), con una condición escrita: si se hace,
  **entra a la vez que un umbral consciente del calendario**. Las dos cosas **no se pueden
  separar** — meter el salto sin tocar el umbral rompe CA-7 el primer sábado.
- **Reintentos y backoff** del proveedor: fuera desde SPEC-016, y aquí además **inútil por
  construcción** — reintentar una cuota agotada falla igual (ADR-027).
- **Contabilizar el consumo dentro de la app** o frenar el ciclo al acercarse a la cuota:
  rechazado en **ADR-027** (llevaría dentro una contabilidad que vive fuera y que no podemos
  leer; el primer desajuste rompería CE-1 por precaución).
- **Contador de consumo previsto en Operación**: útil, pero es **funcionalidad**, no
  defecto → **F-ADR-027-3**, EPIC-MEJORA.
- **Histórico** de rancidez o series de consumo: se conserva **solo el último estado**, como
  `quotes` y `quote_diagnostics` (ADR-004). No se introduce ninguna tabla.
- **Calendario de sesiones por mercado**: no se introduce y **no hace falta** — medir por
  `updated_at` lo evita entero (CA-7). Introducirlo sería alcance nuevo y una fuente de
  verdad más que mantener.
- **Re-especificar lo ya entregado**: la propagación del motivo por el puerto (SPEC-016
  CA-1), su persistencia por símbolo (SPEC-016 CA-2), su limpieza al resolverse (CA-8), el
  aislamiento (CA-9), el dialecto por mercado (SPEC-020) y la cadena inambigua (SPEC-021)
  **se citan, no se repiten**.

## Notas para el gate humano

> **Estado de estas notas (2026-08-21).** El humano ya ha respondido a todo lo que había
> abierto; lo respondido se marca **DECIDIDO** y se conserva con su razón, porque la razón
> es lo que hay que releer, no el veredicto. **La spec sigue en `borrador`: la aprobación
> explícita no ha llegado y no la da el arquitecto.**

**1. Vocabulario a fijar en este gate — DECIDIDO (ok tal cual, 2026-08-21).** Dos términos,
redactados aquí y **pendientes de pegarse en `docs/fundacion/dominio.md` al aprobar**, no
al cerrar (ADR-025). El texto está cerrado; lo único que falta es el acto de aprobación:

- **`cuota_agotada`** — motivo de `QuoteFailureReason`. Texto de usuario propuesto:
  > *«Hemos agotado la cuota de precios de nuestro proveedor; no se actualizará hasta que la
  > repongamos»*.

  Dice las tres cosas que tiene que decir: la causa es **nuestra** (no del valor, no del
  mercado), la acción es **nuestra**, y **no** promete el próximo ciclo (CA-4).

- **Cotización sin refrescar** — fila de glosario propuesta:
  > Cotización que sigue en la fila pero que **el ciclo dejó de reescribir**: su
  > `updated_at` tiene más antigüedad que el umbral de la cadencia declarada. **No es una
  > cotización vieja**: `as_of` se queda legítimamente en el viernes durante el fin de
  > semana, mientras que `updated_at` se mueve **todo ciclo con éxito**, festivo incluido,
  > porque el upsert reescribe la fila aunque el precio no cambie. Por eso se mide por
  > `updated_at` y por eso **no hace falta un calendario de sesiones**. Se **marca, no se
  > borra**: el P/L actual y el estado de zona se siguen calculando sobre ella (RN-06,
  > RN-11); lo que cambia es que deja de presentarse como vigente (D-2, SPEC-043).

  **Nombre descartado a propósito: «cotización detenida»** — en mercados *detenida* o
  *suspendida* significa otra cosa (suspensión de negociación del valor), y colisionar con
  eso sería fabricar el siguiente motivo mentiroso. Aviso de **sdd-mercados**.

**2. El umbral — DECIDIDO: 36 h (gate humano, 2026-08-21).** *Un ciclo perdido, más medio
día de holgura para un cron que llega tarde.* Queda fijado en CA-7 y vive en un solo sitio
por CA-12. Las alternativas y su precio, que es por lo que 36 y no otra cosa:
- **24 h**: pinta la marca cada vez que el cron se retrasa unas horas. Demasiado nervioso.
- **36 h (propuesto)**: dice la verdad —*«anoche no se actualizó»*— a la mañana siguiente.
  Con la cadencia diaria declarada, **cero falsos positivos** por calendario de mercado
  (CA-7).
- **48 h**: tolera **dos** ciclos perdidos, o sea **dos días mintiendo**. En este incidente
  habría avisado el día 21 — el mismo día que el usuario lo cazó a ojo. No sirve de nada.

**3. Dictamen de sdd-mercados (2026-08-21), citado y usado.** (a) **Marketstack cuenta cuota
POR SÍMBOLO**: medido contra la API real (13 símbolos → 429; 1 símbolo → 200; 5 símbolos →
200, misma clave, tres llamadas seguidas) **y corroborado por su propia FAQ** (*«If a given
API request contains 5 tickers, 5 API requests will be consumed»*). Consumo real ≈ **400
unidades/mes** contra **100**: el presupuesto muere hacia el día ocho. (b) **No todo 429 es
cuota**: el proveedor usa 429 también para el tope de 5 req/s, que sí es transitorio — de
ahí CA-2 y CA-3. (c) **Una cotización que dejó de refrescarse no es un dato de pleno
derecho**: enseñar el `asOf` cumple D-2 en la letra y lo incumple en el fin; pero **borrarla
sería peor** (perderíamos el P/L y una información real), luego **se marca**. (d) **Medir la
rancidez por `updated_at` y nunca por `as_of`**, para no necesitar un calendario de sesiones
que la app no tiene. (e) **No usar «detenida»/«suspendida»** para nombrarla.

**4. Tensión que esta spec destapa y NO resuelve — `CE-F3` de EPIC-FIX** (*«coste cero de
arranque»*). Con trece símbolos y ciclo diario, el free tier **no puede sostener la
promesa**, y **ningún cambio de código lo arregla**: el criterio de éxito y la realidad
medida ya no caben juntos. Está levantado como **F-ADR-027-1**. Esta spec deja la app
**diciendo la verdad** mientras tanto, que es lo único que un arreglo de código puede
hacer aquí.

**5. Regla de negocio nueva — DECIDIDO: SÍ se escribe (2026-08-21).** **RN-16 (Cotización
sin refrescar)** entra en `docs/fundacion/reglas.md`, con el resto del vocabulario, **al
aprobar**. Redacción:
> **RN-16** (Cotización sin refrescar): una cotización cuyo `updated_at` —el momento en que
> el ciclo la **escribió**, no su `as_of` de mercado— supera el umbral de la cadencia
> declarada (**36 h**: un ciclo perdido más medio día de holgura) está **sin refrescar**.
> Se **sigue usando** para RN-06 y RN-11 —marcar no es borrar—, pero **no se presenta como
> vigente**: toda pantalla que la muestre dice que no se está actualizando y, si se conoce,
> por qué. Se mide por `updated_at` y **nunca** por `as_of`, porque un ciclo con éxito
> reescribe la fila aunque el precio no cambie: así el fin de semana, el festivo y el
> retraso desigual de publicación del proveedor **no** producen falsos positivos, y no hace
> falta calendario de sesiones. El umbral **presupone ciclo diario sin saltos**: quien
> introduzca saltos lo revisa en la misma entrega. Fuente: sdd-mercados; D-2; ADR-027;
> SPEC-043.

Por qué sí, y no «es opcional»:
- **(a)** CA-12 ya obliga a **una sola función y un solo umbral** compartidos por las dos
  pantallas. RN-16 es su **gemela documental**: sin ella, las 36 h viven **solo en el
  código** y no hay dónde leer por qué son 36.
- **(b)** En el propio gate ya han aparecido **dos consumidores futuros** de esa definición
  —el salto de fin de semana (F-SPEC-043-2) y el aviso de permanencia (F-SPEC-043-1)—, así
  que la definición **se va a revisitar seguro**. Conviene que tenga **una sola dirección** a
  la que apuntar antes de que dos specs la redecidan por separado.
- **(c)** Cuesta un párrafo.

**6. Las dos preguntas abiertas — RESUELTAS (2026-08-21).** Las dos se quedan **fuera de
alcance**, con su motivo escrito en «Fuera de alcance» y su follow-up abierto:
- **P1 — `outcome='success'` con `updated=0`**: **se queda como está**, y consta como
  **decisión consciente**, no como omisión. Se miró en el incidente que lo destapó.
- **P2 — el aviso de permanencia sobre un precio congelado**: **no se toca aquí** →
  **F-SPEC-043-1**. Se verificó que el aviso **sí** lleva fecha
  (`notifications/service.ts:140`) pero que su `cycleRef` es `max(quotes.asOf)` **global**
  (línea 67), así que un solo símbolo fresco hace parecer fresco el digest entero. El
  arreglo natural, **una vez exista RN-16**, es que RN-14 **consuma esa regla** en vez de
  redecidir qué es viejo.
- **Añadido en el mismo gate y también fuera**: el **salto de fin de semana**
  (**F-SPEC-043-2**), rechazado con cuatro motivos medidos y con una condición para el día
  que se retome — entra **a la vez** que un umbral consciente del calendario, o rompe CA-7
  el primer sábado.

**7. Lo que esta spec deliberadamente NO decide: el plan.** No hay ningún CA que dependa de
qué plan se contrate. Si mañana pasas a Basic, `cuota_agotada` simplemente deja de
aparecer — y sigue estando bien escrito para el día en que vuelva.

**8. Orden sugerido.** El **bloque A** (motivo verdadero) es pequeño y cerrado, y se puede
verificar solo con el fake. El **bloque B** (cotización sin refrescar) es el **más grave de
los dos** y el que el usuario nota. Si hay que partir la entrega, **B primero**: A sin B
seguiría dejando el motivo escondido detrás de un precio viejo.

**9. Dato operativo que invalida una mitigación, y hay que saberlo (2026-08-21).** La clave
`MARKETSTACK_API_KEY` que hay **hoy** en producción pertenece a una **cuenta de prueba
creada con un correo cualquiera que el humano NO administra**. Consecuencia directa: los
**avisos de consumo al 75/90/100 %** que el proveedor envía —y que el dictamen de
sdd-mercados registra como hecho documentado— **van a un buzón que nadie lee**. Ese canal
de alerta **no existe en la práctica** y **no puede usarse como mitigación** en ningún
razonamiento de esta spec ni de ADR-027: si se hubiera contado con él, el incidente del 19
de agosto habría sido *«teníamos aviso y lo ignoramos»*, y no lo fue — el aviso nunca
llegó a nadie.
El humano dará de alta una cuenta propia y **rotará la clave**. **Nada de esta spec depende
de esa clave** —el motivo `cuota_agotada` se verifica con el fake y con `fetchImpl`, no
contra la API real—, así que la rotación **no bloquea** ni la implementación ni la
verificación. Queda como constancia de despliegue, no como salvedad bloqueante.
