---
id: EPIC-008
tipo: epica
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-25, por: sdd-producto}
---
# EPIC-008 — El precio al momento: la vigilada recién dada de alta no espera al ciclo

## Objetivo
Que **dar de alta una vigilada devuelva su precio en el acto**, en vez de dejar la fila
muda hasta el ciclo diario siguiente. Es la primera capacidad de **refresco bajo demanda**
del producto: hasta SPEC-058, el único camino por el que un precio entraba en la base era
el ciclo diario.

### El roce, observado sobre la pantalla real (2026-08-25, Alberto Fojo)
> *«Cuando añadimos una acción que todavía no está registrada o tiene un valor antiguo
> (alguien la dejó de seguir), es deseable que en ese momento se actualice el precio. Se
> gasta una llamada, pero si no el usuario queda con sensación de desactualización durante
> todo el día (hasta esa noche).»*

La mecánica que lo produce estaba medida, no supuesta.

*(Entregado: SPEC-058 salió GREEN 17/17 el 2026-08-25, y lo que sigue describe el estado
**ANTES** de esa entrega — se conserva porque es el problema que la épica vino a resolver.
Desde entonces `quotes` tiene **dos escritores**, el ciclo y el alta (RN-17, **ADR-038**),
y la hora del ciclo se movió a la mañana UTC en SPEC-059 (**ADR-039**): la hora vive en
`vercel.json` y sólo ahí. Misma cura que recibió `docs/roadmap.md` en `20ffd72`; el
análisis no se reescribe.)*

- El **único** refresco era el cron declarado en `vercel.json`, que llamaba a
  `refreshQuotes` (`src/lib/market/refresh.ts`) sobre el universo
  `watched_symbols ∪ transactions`.
- El alta —`watchAction` (`src/app/vigiladas/actions.ts`) → `watchSymbol`
  (`src/lib/watchlist/service.ts:51`)— **creaba el símbolo y la vigilada y no pedía
  precio**. Metía el símbolo en el universo del ciclo y ahí acababa su trabajo.
- Así que entre el alta y el ciclo siguiente había **hasta 24 horas** en las que la fila
  recién creada enseñaba una de estas dos cosas:
  1. **Símbolo nuevo**: sin cotización. La columna de estado queda en neutro
     (`state: 'none'`, `zone-status.ts`) y el diagnóstico de SPEC-016 está vacío porque
     **nunca ha fallado nada** — el ciclo simplemente no ha corrido todavía.
  2. **Símbolo que alguien dejó de seguir**: un precio **viejo**, el que quedó congelado
     cuando el símbolo salió del universo. Se ve marcado *sin refrescar* (SPEC-043,
     RN-16), que es honesto pero no es lo que el usuario acaba de pedir.

Los dos casos comparten la misma frase del usuario: *acabo de decirle a la app que vigile
esto y la app no sabe cuánto vale*.

### Por qué es capacidad nueva y no cabe en ningún *bucket*
Se descartaron las tres candidatas, con su razón escrita:

- **EPIC-MEJORA** excluye por texto propio *«un dato que no está en la base de datos o una
  acción que la app no sabe hacer»*, y aquí fallan **las dos**: el precio no está, y pedir
  un solo símbolo bajo demanda es un camino que no existe. Su **CE-M1** remata —*«ninguna
  spec altera un dato: cambia cómo se presenta»*— y esto cambia el dato.
- **EPIC-FIX** es lo que **está roto**. Esto no lo está: es exactamente lo que ADR-004
  diseñó. Meterlo aquí emborronaría la frontera que esa épica defendió ocho specs.
- **EPIC-INFRA** es salud técnica. Esto es comportamiento visible del producto.

### Por qué épica propia y no una spec suelta
Porque **abre una superficie**, no un caso. «El precio al día cuando lo pides» tiene
vecinos evidentes —la cartera, el import, un botón de *actualizar ahora*— y esta épica es
el sitio donde se gobiernan cuando lleguen. Hoy entra **uno solo**, por decisión del humano
del 2026-08-25 (ver Alcance); el resto queda escrito ahí fuera, no olvidado.

## Criterios de éxito
- **CE-1 — La vigilada nace con precio.** Dada de alta una acción cotizable en un mercado
  soportado, su fila enseña **precio y estado de zona** sin esperar al ciclo y sin que el
  usuario recargue a mano. Medida: binario, verificable en test y en pantallazo.
- **CE-2 — Nunca peor que hoy.** Si el refresco al alta no se puede hacer —proveedor caído,
  cuota agotada, símbolo no cotizable— **el alta se completa igual** y la pantalla queda
  exactamente como queda hoy (sin cotización + su diagnóstico, o el precio viejo marcado
  *sin refrescar*). El precio es un extra, jamás un requisito del alta. Medida: binario,
  verificable en test.
- **CE-3 — El disparo sigue siendo diferido.** La pantalla puede decir «En compra» al
  instante; el **aviso** sigue saliendo en el ciclo. **D-2** queda intacto y el modelo
  *edge-triggered* de ADR-005 no se toca. Medida: binario — ninguna alta emite notificación.
- **CE-4 — El coste queda escrito en la unidad canónica.** La spec deja la cuenta hecha en
  `símbolos distintos × ciclos` (ADR-027 pto. 1) con el consumo extra que introduce, contra
  el cupo de 10.000/mes de ADR-032. Medida: binario, revisable en el gate.

## Alcance
- **Dentro:**
  - **El alta de una vigilada en `/vigiladas` pide el precio de ese símbolo en el acto**,
    tanto si el símbolo es nuevo como si arrastra una cotización vieja.
  - Que el fallo de esa petición sea **inocuo**: el alta se completa, y lo que el usuario
    ve es lo que ya vería hoy.
  - La **cuenta de consumo** contra el cupo del proveedor, escrita.
- **Fuera (aparcado a propósito, no por descuido):**
  - **El alta manual de una posición en `/cartera`**, que padece el mismo retraso por el
    mismo motivo (el P/L actual sale «—» hasta la noche). Decisión del humano del
    2026-08-25: empezar por la puerta observada. Entra aquí cuando se pida.
  - **El import desde bróker (EPIC-002)**, por la misma decisión y con una razón propia:
    un extracto puede meter decenas de símbolos de golpe, y eso es un patrón de consumo
    distinto —y un flujo asistido distinto— del alta de uno en uno.
  - **Un botón de «actualizar ahora»** sobre una vigilada que ya existe. Es el vecino más
    cercano y el más tentador; no está observado, así que no se especula (regla heredada
    de CE-M2 de EPIC-MEJORA).
  - **Avisar al momento.** Si al refrescar el precio ya está dentro de la zona, la tabla lo
    pinta pero **el correo espera al ciclo**. Decisión del humano del 2026-08-25. Cambiarlo
    reinterpretaría **D-2**, que está *locked*, y el modelo *edge-triggered* de ADR-005: eso
    necesitaría su propio gate y su propio ADR, y no es lo que se pidió.
  - **Tiempo real, polling y refresco automático de la pantalla.** Sigue vetado por D-2 y
    por la visión (*«No hace falta tiempo real»*). Esta épica añade **un** refresco atado a
    **un** gesto del usuario; no abre la puerta a un flujo continuo.
  - **Cambiar la cadencia del ciclo diario** (ADR-004) o el plan del proveedor (ADR-032).

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

> **Propuesta orientativa de sdd-producto** — el desglose real, sus fronteras y su
> numeración son de **sdd-arquitecto**:
>
> 1. Una sola spec. El alta pide el precio del símbolo recién vigilado, el fallo es inocuo
>    y el aviso sigue en el ciclo. Es un punto de llamada, un camino de fallo y una cuenta.

## Riesgos
- **R-1 — Probable ADR, y es lo que decide si esto cabe en una sesión.** Se mete una
  llamada de red **síncrona a un tercero dentro de una server action de escritura**, que
  hasta hoy solo hablaba con la base. Eso toca latencia del alta, comportamiento ante
  timeout y la lectura de **D-2** que sostiene CE-3 (*el precio se puede pedir bajo demanda;
  el disparo no se evalúa fuera del ciclo*). Esa lectura hay que **escribirla**, no
  asumirla. Consúltese `sdd-mercados` al especificar.
- **R-2 — Coste: real pero pequeño, y con la cuenta hecha.** En la unidad de ADR-027 pto. 1,
  hoy se consumen **13 símbolos × 31 ciclos ≈ 400 unidades/mes contra 10.000** (ADR-032,
  margen ~25×). Un refresco al alta cuesta **1 unidad**; ni con 100 altas al mes —muy por
  encima de lo plausible con veinte testers— el consumo pasaría de ~500. **El techo del
  plan sigue siendo el número de símbolos distintos vigilados (~322), no las altas.** Lo
  que sí hay que impedir es que el gesto sea **repetible a voluntad**: `watchSymbol` es
  *upsert* y hoy volver a dar de alta lo mismo no cuesta nada — si cada repetición pidiera
  precio, el usuario tendría un botón de gastar cuota sin saberlo.
- **R-3 — La pantalla y el correo van desacompasados, a propósito.** Un usuario puede ver
  «En compra» a las 10:00 y recibir el aviso a las 22:00. Es consecuencia directa de CE-3 y
  de D-2, y es coherente con lo que la app ya promete (`FOUNDATION`: *«cada cotización
  indica su antigüedad; jamás dar falsa sensación de tiempo real»*). Pero **hay que
  comprobar que no se lee como un fallo**, sobre todo tras SPEC-039, que es la que enseña a
  los testers qué esperar de esta pantalla.
- **R-4 — Colisión de ficheros con lo que está en vuelo.** `/vigiladas` es la pantalla más
  disputada del repositorio: **SPEC-054** (EPIC-007, tarjetas en móvil) y **SPEC-045**
  (EPIC-005, silenciar) tocan esa misma superficie y ninguna está en `main`. El punto de
  llamada de esta épica está en `actions.ts` / `service.ts`, no en el render, así que el
  solape debería ser pequeño — pero quien llegue el segundo **rebasa y reconcilia**.
- **R-5 — Es alcance nuevo entrando por delante de lo comprometido.** EPIC-005 lleva desde
  el 2026-08-22 aprobada y sin implementar, y EPIC-007 está en curso. Esta épica **no las
  desplaza** (una spec, un punto de llamada, worktree propio: el proyecto ya trabaja en
  paralelo), pero conviene que conste que **nace hoy a petición del humano** y no de un
  criterio de corte. Si prefiere que espere, baja a "Después" con un renglón.
