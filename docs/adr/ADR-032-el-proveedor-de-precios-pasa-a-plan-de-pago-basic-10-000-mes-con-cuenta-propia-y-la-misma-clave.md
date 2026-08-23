---
id: ADR-032
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-23, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-032: El proveedor de precios pasa a plan de pago Basic (10.000/mes) con cuenta propia y la misma clave

- Deciders: **decide el humano (Alberto Fojo) el 2026-08-23**, contratando el plan **Basic
  (10.000 unidades/mes, ~$9,99/mes)** de Marketstack sobre **cuenta propia del titular**.
  **sdd-arquitecto** solo lo **registra**: la elección de plan no era mía —**ADR-027 pto. 7**
  la puso por escrito en el humano ("*elegir free tier, Basic o cambiar de proveedor es
  decisión de producto y coste*"), y esto es exactamente esa decisión, tomada. Este ADR nace
  en `borrador`; lo aprueba el humano en el gate.
- Specs relacionadas: **ninguna, y eso es el titular de la noticia**. No origina spec, no
  consume spec y no pide implementación: **cero cambios de código y cero cambios de
  configuración de despliegue**. Completa **ADR-012** (retira una consecuencia positiva
  caducada y da por ejecutada una mitigación escrita) y **ADR-027** (cierra `F-ADR-027-1` y
  la pata (i) de `F-ADR-027-2`, y aplica su pto. 1). **No supersede a ninguno de los dos**:
  los dos siguen vigentes casi enteros y se reafirman por escrito. Mismo encuadre de
  *enmienda desde fuera* con el que **ADR-024** enmendó D-6 de **ADR-018** y con el que
  **ADR-027** enmendó ADR-002 pto. 4.

## Contexto

### El hecho (2026-08-23)

El **2026-08-21**, ADR-027 dejó medido que el free tier de Marketstack **no puede** sostener
este producto: **13 símbolos distintos × ~31 días ≈ 400 unidades/mes** contra **100** de
cupo. El presupuesto moría hacia el octavo día del ciclo de facturación, y eso fue el
incidente del 19 al 21 de agosto: tres días enseñando el mismo precio con cara de vigente.

ADR-027 se negó explícitamente a resolverlo —pto. 7: *«nada de esto decide el plan»*— y dejó
el problema abierto en `F-ADR-027-1` **para el gate humano**. El **2026-08-23** el humano lo
resuelve **pagando**:

- **Plan contratado: Basic, 10.000 unidades/mes** (~$9,99/mes). Ya activo.
- **Cuenta propia del titular**, no la cuenta de prueba con la que se arrancó.
- **Se reaprovecha la misma clave**: `MARKETSTACK_API_KEY` **no cambia**. No hay rotación,
  no hay que tocar Vercel, no hay ventana de corte.

> **Nota de vocabulario, porque ya ha costado una confusión.** En la escala de Marketstack,
> **Basic = 10.000 peticiones/mes** y **Professional = 100.000**. Lo contratado es **Basic**.
> En este proyecto se escribe siempre **«Basic (10.000/mes)»** y **nunca «Pro»**: llamarlo
> "Pro" haría creer a quien lea después que el techo es diez veces el que hay, y la unidad
> de ADR-027 pto. 1 solo sirve si el número contra el que se compara es el verdadero.

### La cuenta, en la unidad canónica (ADR-027 pto. 1)

ADR-027 pto. 1 no es una recomendación: obliga a que **toda decisión futura sobre plan o
proveedor haga la cuenta en `símbolos distintos × ciclos` y la deje escrita con el universo
de símbolos que supone**. Aquí está, y es la primera vez que se aplica:

| Magnitud | Valor | Fuente |
|---|---|---|
| Universo de símbolos distintos hoy | **13** | medido en producción el 2026-08-21 (ADR-027) |
| Ciclos por mes | **~31** (uno diario, sin saltar fines de semana) | ADR-004, `vercel.json` |
| **Consumo previsto** | **13 × 31 ≈ 400 unidades/mes** | producto de los dos anteriores |
| **Cupo contratado** | **10.000 unidades/mes** | plan Basic, 2026-08-23 |
| **Margen** | **~25×** | 10.000 / 400 |

Y el **corolario que importa para el futuro**, en la misma unidad: con ciclo diario, el plan
soporta **~322 símbolos distintos** (10.000 / 31) antes de agotarse. El techo ya no es el
plan: es **cuántos valores distintos vigilen entre todos los usuarios**. Quien vea ese número
acercarse a los 300 tiene que volver aquí, no improvisar.

### Lo que este ADR no es

No es un cambio de arquitectura ni un cambio de comportamiento. Es el **registro de una
decisión de coste** que ya está tomada y que resuelve dos follow-ups abiertos. Está aquí y no
en una nota de spec por el mismo motivo por el que ADR-027 se escribió como ADR: *quien elija
el siguiente plan o el siguiente proveedor lee los ADR, no las specs cerradas*, y la premisa
"$0 de arranque" ya viajó tres saltos (ADR-002 → ADR-012 → EPIC-FIX) antes de que alguien la
midiera.

## Decisión

1. **El proveedor de cotizaciones opera desde el 2026-08-23 sobre el plan de pago Basic de
   Marketstack, 10.000 unidades/mes, en cuenta propia del titular.** La unidad es la de
   ADR-027 pto. 1 (`símbolos distintos × ciclos`) y la cuenta queda escrita arriba: **~400
   previstas contra 10.000**, margen **~25×**.

2. **`MARKETSTACK_API_KEY` no cambia y no hay paso de rotación.** El plan se contrató sobre
   la misma clave. Ni Vercel, ni `.env.example`, ni el runbook necesitan un valor nuevo: lo
   único que cambia en `docs/despliegue.md` es que **conste qué plan sostiene esa clave y de
   quién es la cuenta**. Quien lea este ADR buscando el procedimiento de rotación que ADR-027
   anunciaba (*«el humano dará de alta cuenta propia y rotará la clave»*) que se ahorre el
   viaje: **la cuenta es propia y la clave es la de siempre**.

3. **Cero cambios de comportamiento. Lo que NO cambia, enumerado, porque es casi todo:**
   - **El motivo `cuota_agotada` de ADR-027 pto. 4 se queda**, con su contrato intacto. Con
     margen 25× simplemente **no aparecerá nunca** — y eso es precisamente lo que ADR-027
     pto. 7 pedía: *que la app diga la verdad pague lo que pague*. Un motivo que no se dispara
     no es un motivo muerto: es un motivo que dice la verdad sobre un estado que hoy no
     ocurre. **Borrarlo sería volver al defecto del 19 de agosto** el día que la cuota se
     agote por otro camino (más símbolos, más ciclos, un fallo de facturación).
   - **La taxonomía del 429 de ADR-027 pto. 5 se queda entera**, incluida la presunción de
     `cuota_agotada` ante 429 con cuerpo ilegible. Pagar no cambia qué significa un código.
   - **El batch se queda** (ADR-002 pto. 4 / ADR-012 pto. 1), por los motivos que ADR-027
     dejó ciertos: latencia, sockets y superficie de fallo. Sigue sin ahorrar cuota.
   - **Se quedan** el puerto `MarketDataProvider`, el dedupe por símbolo, el `asOf` explícito,
     la cadencia diaria, el operating MIC canónico y **Twelve Data en free tier para la
     búsqueda** (ADR-012 pto. 2). Esta decisión toca **un plan**, no un diseño.
   - **ADR-023 pto. 15 sigue en pie**: se registra y se muestra, nunca alerta. Ver pto. 6.

4. **Enmienda a ADR-012 — se retiran dos frases, y se reafirma todo lo demás.** ADR-012 es
   **inmutable** y no se edita en su sitio. Lo que queda **caducado a partir de hoy** es:
   - la consecuencia positiva *«**$0 de arranque** (CE-F3): el free tier de Marketstack sirve
     BMEX y el consumo real (~30 llamadas/mes) cabe en las 100»* — **doblemente caduca**: la
     cifra ya la había medido falsa ADR-027 pto. 3 (~400, no ~30), y ahora además **el
     arranque deja de ser $0**. Lo que sobrevive de esa frase, y sigue siendo cierto y
     verificado, es que **Marketstack sirve BMEX**, que era el defecto que ADR-012 vino a
     arreglar;
   - la mitigación escrita en el follow-up de **riesgo de licencia**: *«pasar a Basic
     ($9.99/mes) es cambiar de plan, misma key, cero código»*. No se retira por falsa: **se
     retira por ejecutada**. Ver pto. 5.

   **Todo lo demás de ADR-012 queda íntegro y se reafirma por escrito**: Marketstack como
   adaptador de cotizaciones, Twelve Data para la búsqueda, la identidad canónica por
   operating MIC, la traducción de dialecto en el adaptador, `MARKET_MAP` corregido, y el
   contrato del puerto que no se traga el motivo. **Este ADR NO supersede a ADR-012.**

5. **La predicción del proyecto se cumplió, literalmente, y queda registrada.** ADR-012
   escribió en 2026-07-15 que la mitigación del riesgo de licencia era *«pasar a Basic
   ($9.99/mes): cambiar de plan, misma key, cero código»*, y EPIC-FIX la calificó de
   *«minutos, cero código»*. El **2026-08-23 se ejecutó y salió exactamente así**: mismo
   precio, misma clave, cero líneas de código, cero variables tocadas en Vercel, cero
   ventanas de corte. **Se deja escrito porque una mitigación que se escribe y luego se
   cumple es la única prueba de que el riesgo estaba bien acotado** — y porque la lección
   práctica que hay debajo (*la mitigación barata existe cuando el proveedor está detrás de un
   puerto y el plan no es un supuesto del código*) es reutilizable con el proveedor siguiente.

6. **`F-ADR-027-2` se cierra **a medias**, y la mitad que sigue cerrada sigue cerrada.**
   ADR-027 partió el follow-up en dos patas y dijo que rotar la clave *«arregla (i) y no
   (ii)»*. Con cuenta propia:
   - **(i) queda CERRADO.** Los avisos automáticos del proveedor al **75/90/100 %** de consumo
     van al correo del **titular de la cuenta**, que ahora **es el titular de Stockeiro**. Ya
     no caen en un buzón que nadie lee. Ese canal es a partir de hoy **un canal del operador,
     que vive fuera de la app**: correo del proveedor a una persona. **No es un componente del
     sistema**, no tiene contrato, no se testea y ningún ADR ni spec puede apoyarse en él como
     garantía de producto.
   - **(ii) sigue FUERA, y este ADR no la abre.** Cablear esos avisos **a la app** —convertir
     el correo del proveedor en una alerta que la app emita— sería exactamente la **alerta
     proactiva al operador** que **ADR-023 pto. 15** deja fuera por decisión escrita
     (*«se registra y se muestra, nunca alerta»*). Sigue necesitando su propia spec y su
     propio gate. Pagar no es la puerta de atrás por la que se cuela, igual que `cron_runs`
     no lo era.

7. **`F-ADR-027-1` se cierra ELIGIENDO EL GASTO, no forzando el criterio.** El conflicto que
   ADR-027 dejó a la vista era real y no tenía arreglo técnico: **CE-F3 de EPIC-FIX**
   (*«coste cero de arranque: el arreglo funciona en la capa gratuita, sin gasto recurrente»*)
   y **la promesa CE-1** (cero zonas perdidas) **no caben juntos** con trece símbolos y ciclo
   diario. Ante los dos, el humano ha elegido **CE-1 y pagar**. La consecuencia técnica —la
   que sí es mía y la que registro— es que **desde el 2026-08-23 este proyecto tiene un coste
   recurrente de infraestructura de datos**, y que ninguna decisión posterior puede volver a
   invocar "capa gratuita" como restricción vigente del proveedor de precios sin reabrir esto.

   **La redacción de CE-F3 en `docs/epicas/EPIC-FIX/_epica.md` es de producto y NO la toco**
   —ni CE-F3, ni R-F1, ni la nota del gate—: un criterio de éxito de una épica lo escribe
   sdd-producto. Lo que este ADR aporta es el **hecho** con el que producto redactará. Lo
   mismo vale para **R-1 de EPIC-004** y para **F-EPIC-004-1** del roadmap.

8. **Lo que este ADR obliga a mantener actualizado, y dónde.** Dos documentos, que se
   actualizan **con este ADR**: `docs/fundacion/dominio.md` (fila *Fuente de precios*: cambia
   **el motivo**, no la conducta) y `docs/despliegue.md` (qué plan sostiene la clave, de quién
   es la cuenta, y que **no hay rotación**). Y tres **comentarios de código** que quedan
   fechados y desalineados, que **no se tocan aquí** porque `src/` está tras el gate
   `require-spec`: van como **`F-ADR-032-1`** (ver Consecuencias). **El texto visible de
   `/legal` NO cambia** y `tests/legal-afirmaciones-prohibidas.ts` **NO se toca**: ver pto. 9.

9. **El texto legal no cambia, y el motivo por el que no cambia sí.** Decisión del humano del
   2026-08-23, que registro porque es la clase de cosa que alguien "arregla" dentro de seis
   meses creyendo que quedó obsoleta: las páginas legales seguirán **nombrando la fuente**,
   declarando el dato **de cierre diferido** y **de carácter meramente informativo**, y
   sirviéndolo **sin compromiso de exactitud, continuidad ni disponibilidad**. Lo que
   **caduca** es la **razón**: antes se decía así porque el free tier **no concedía** derechos
   de uso comercial ni de redistribución (**R-1**); a partir de hoy se dice así por
   **prudencia deliberada** — es lo correcto de decir sobre un dato de cierre diferido de un
   tercero **pague lo que pague** quien lo sirve. **Un plan de pago compra cupo, no exactitud
   ni continuidad**, y afirmar más de lo que se puede sostener sería peor negocio que callar.
   Por eso la lista cerrada de afirmaciones prohibidas de `tests/legal-afirmaciones-prohibidas.ts`
   **sigue igual y con toda su fuerza**.

## Consecuencias

### Positivas
- **El incidente del 19-21 de agosto no puede repetirse por esta causa.** Con margen 25×, la
  ruta que dejó el producto tres días con precios rancios queda cerrada — y si aun así se
  agotara, ahora la app lo **dice con su nombre** (`cuota_agotada`, ADR-027 pto. 4), que es la
  otra mitad del arreglo y la que no dependía del dinero.
- **CE-1 y CE-3 dejan de depender de una promesa que no se podía sostener.** El criterio que
  se rompía cada mes hacia el día octavo ya no se rompe.
- **El riesgo de licencia R-F1/R-1 se disuelve en su origen**, no se mitiga: el plan Basic es
  de pago y con él desaparece la ambigüedad de "¿cuenta como uso comercial?" que el humano
  venía asumiendo a conciencia desde el 2026-07-15. **La app se comparte con testers sin esa
  espina.** (La *decisión* de cerrar R-1 y F-EPIC-004-1 es de producto; el hecho que la
  sostiene es este.)
- **Coste marginal de crecer, ahora conocido y barato**: cada símbolo nuevo que alguien vigile
  cuesta ~31 unidades/mes de un cupo de 10.000. Añadir un valor deja de ser una decisión con
  consecuencias de disponibilidad.
- **La arquitectura salió indemne, y esa es la prueba del puerto.** Cambiar el plan del
  proveedor de precios costó **cero código** porque ADR-002 puso un puerto y ADR-012 metió el
  dialecto en el adaptador. La factura del diseño se cobró aquí.

### Negativas / follow-ups
- **Gasto recurrente, y ya no hay vuelta atrás gratis.** ~$9,99/mes es poco, pero es un coste
  **mensual y sin ingresos detrás**. Dejar de pagarlo no devuelve el proyecto al estado
  anterior: lo devuelve al **incidente** —free tier agotado hacia el día octavo, CE-1 roto—,
  porque los trece símbolos no caben en 100 y eso no lo arregla ningún cambio de código. **La
  suscripción es ahora parte de la infraestructura**, al mismo nivel que la base de datos.
- **Un cupo generoso invita a dejar de mirar.** El riesgo nuevo no es quedarse sin cuota
  mañana: es que **nadie vuelva a mirar** el consumo hasta que vuelva a doler. Contra eso hay
  hoy dos cosas y las dos son débiles a propósito: los avisos al 75/90/100 % del proveedor
  (pto. 6, canal del operador, **fuera de la app**) y `cuota_agotada` (que llega **cuando ya
  pasó**). Ver el dictamen sobre F-ADR-027-3 justo abajo.
- **`F-ADR-027-3` (EPIC-MEJORA, contador de consumo en Operación) — dictamen: SIGUE VIVO,
  BAJA DE PRIORIDAD, y CAMBIA DE ARGUMENTO.** El margen 25× **no** lo mata, porque lo que ese
  contador vigila nunca fue *«¿llegamos a fin de mes?»* sino *«¿cuántos símbolos distintos
  estamos vigilando y hacia dónde va eso?»* — y esa pregunta **sigue sin tener ningún sitio
  donde verse**. Lo que cambia es su **urgencia** y su **redacción**: deja de ser una defensa
  contra un corte inminente (era casi un incidente esperando) y pasa a ser **visibilidad de
  crecimiento**, con un umbral concreto que antes no existía: **~322 símbolos distintos** con
  ciclo diario (10.000 / 31). Recomendación: **se mantiene en EPIC-MEJORA, con prioridad
  bajada**, y quien la escriba que lo haga contra ese número y no contra el miedo. **No lo
  implemento aquí**: es funcionalidad y va a su épica con su spec.
- **Saltar el ciclo los fines de semana — dictamen: el rechazo de ADR-027 se REFUERZA, y hoy
  es más claro que ayer.** ADR-027 lo rechazó con la cuenta hecha: sobre Basic (10.000/mes) el
  ahorro son ~114 unidades, un **1,1 %**. Con Basic **ya contratado**, ese 1,1 % es todo lo
  que hay que ganar — y sigue costando exactamente lo mismo que costaba: romper el umbral de
  rancidez de SPEC-043 (72 h de hueco de viernes a lunes contra 36 h de umbral), reintroducir
  el calendario de sesiones que medir por `updated_at` había eliminado, y perder el cierre del
  viernes hasta el lunes para los símbolos con publicación rezagada (medido el 2026-08-21:
  `APP` traía `2026-08-19` mientras `AAPL` e `ITX` ya traían `2026-08-20`). **Pagar por
  redondear un 1,1 % de un cupo que sobra 25 veces, a cambio de degradar la frescura del dato,
  es un mal negocio evidente.** Se mantiene la condición de ADR-027: si alguna vez entra,
  entra **a la vez** que un umbral consciente del calendario, **nunca antes** — y ya no podrá
  entrar invocando la cuota, porque la cuota deja de ser un argumento.
- **`F-ADR-027-2` queda cerrado solo por (i).** La pata (ii) sigue abierta como *idea*
  («Observabilidad del ciclo diario» del roadmap) y **cerrada como decisión** por ADR-023 pto.
  15. Que ahora los correos lleguen a alguien **no** es un paso hacia cablearlos.
- **`F-ADR-032-1` (EPIC-FIX, lote de comentarios caducados en `src/`).** El motivo retirado
  en el pto. 4 no vive solo en un sitio: está **escrito en tres comentarios de código**, y los
  tres afirman hoy algo que ya no es cierto. Ninguno cambia **comportamiento** —el texto y la
  conducta que documentan son correctos y se quedan (pto. 9)—; lo que miente es **el porqué**:
  - `src/lib/legal/content.ts` (bloque de `DATOS_DE_MERCADO`): *«El gate de EPIC-004 decidió
    publicar con el free tier de Marketstack asumiendo R-1: ese plan no concede derechos de
    uso comercial ni de redistribución»*.
  - `src/app/legal/terminos/page.tsx` (cabecera): *«el plan que los sirve no concede
    redistribución (R-1, ADR-012)»*. **Mismo motivo caducado, segundo sitio** — y la prueba de
    que retirarlo solo en uno lo dejaría vivo.
  - `src/lib/market/marketstack-provider.ts` (tabla de dialecto): *«el free tier son ~100
    peticiones/mes»*. Aquí el motivo se debilita pero **la conclusión aguanta por su otra
    mitad, que es la fuerte**: un formato inventado le devuelve al usuario un motivo falso
    sobre un valor que cotiza. Prioridad más baja que los dos anteriores.

  **Cómo entra, y por qué no entra aquí.** `src/` está en `rutasVigiladas` con
  `requireSpec: true`, y el gate **se ha disparado de verdad** al intentar el retoque desde la
  rama de documentación de este ADR (*«la rama no es una rama de spec»*). **No se rodea**:
  lo prohíbe **ADR-025**, que además dice exactamente qué hacer con un retoque trivial de
  `src/` descubierto después —*cuelga de una spec viva que ya toque esa superficie, o espera
  en **EPIC-FIX** a un lote de rótulos*—. Hoy **no hay ninguna spec viva** sobre
  `src/lib/legal/` (SPEC-035 está `hecho` y no se reabre), así que va **al lote**. Mientras
  tanto **este ADR es la verdad de referencia** y los tres comentarios son residuo fechado.
- **Los *motivos* de `tests/legal-afirmaciones-prohibidas.ts` también quedan fechados, y ese
  fichero NO se toca.** Sus entradas citan *«el free tier de Marketstack no concede…»* y *«el
  plan gratuito excluye el uso comercial»* como razón de cada prohibición. **La lista de
  afirmaciones prohibidas sigue siendo correcta y sigue con toda su fuerza** —lo que la
  sostiene a partir de hoy es el pto. 9: un plan de pago compra cupo, no exactitud—, pero la
  razón escrita al lado de cada una envejeció. Es **decisión explícita del humano
  (2026-08-23)** dejar ese fichero como está, y se respeta: reescribir los motivos de una
  guardia legal es trabajo con su propio gate, no un efecto colateral de cambiar de plan.
- **Nadie vigila que "Basic" siga siendo 10.000.** El cupo, el precio y los nombres de los
  planes los cambia el proveedor cuando quiere, y esta cuenta se hizo con los de hoy. No hay
  ni puede haber un test de eso. Lo que sí hay es la unidad: **quien revise el plan repite la
  cuenta de la tabla de arriba con el universo de símbolos del día**, y si no cabe, vuelve al
  gate.

## Alternativas consideradas

- **Seguir en free tier y recortar el universo de símbolos** hasta que cupiera en 100 (≈3
  símbolos con ciclo diario). Rechazada de plano: sería **romper el producto para salvar la
  factura**. La cartera real del usuario es de trece valores y CE-1 promete cero zonas
  perdidas sobre **sus** valores, no sobre tres de ellos.
- **Seguir en free tier y espaciar el ciclo** (semanal, o solo días hábiles). Rechazada: el
  fin de semana ya lo rechazó ADR-027 por ahorrar un 1,1 % (ver dictamen arriba) y un ciclo
  semanal **rompe D-2 y CE-1** —una zona que se toca el martes y se abandona el miércoles no
  se detecta jamás—. Sería convertir un problema de coste en un defecto de dominio.
- **Cambiar de proveedor a uno con free tier suficiente.** Rechazada: **no existe** entre los
  evaluados. ADR-012 verificó **contra la API real** que Twelve Data free no cubre BME (y su
  plan con Europa cuesta **$229/mes**, 23×), que Yahoo está descartado por ToS y endpoints no
  oficiales, que Stooq no tiene API, y que EODHD (€19,99) es **el doble de caro** con la misma
  fricción de licencia. Cambiar de proveedor cuesta un adaptador nuevo; cambiar de plan costó
  cero. La comparación no está reñida.
- **Contratar Professional (100.000/mes)** en vez de Basic. Rechazada por **desproporcionada**:
  el consumo previsto es de ~400 unidades. Basic ya deja margen **25×** y techo para **~322
  símbolos distintos** con ciclo diario; pagar por 10× más cupo del que ya sobra es comprar
  holgura que nadie ha pedido. Si el universo de símbolos se acercara a los 300, se vuelve
  aquí con la cuenta rehecha.
- **Aprovechar el cambio para retirar `cuota_agotada`**, ya que "con Basic no va a pasar".
  Rechazada, y es la alternativa que más importa rechazar por escrito. (a) Es **exactamente**
  el defecto que ADR-027 cerró: un motivo que falta obliga a la respuesta a caer en
  `proveedor_no_disponible`, que promete *«se reintentará en el próximo ciclo»* — la mentira
  del 19 de agosto, otra vez. (b) La cuota **puede** agotarse igual (más símbolos, un fallo de
  pago, un cambio de plan del proveedor). (c) ADR-027 pto. 7 pedía que la app dijera la verdad
  **pague lo que pague**: un motivo que nunca se dispara es el **éxito** de esa regla, no su
  obsolescencia.
- **Aprovechar el cambio para relajar el texto legal** (afirmar exactitud o continuidad ahora
  que se paga). Rechazada por el humano y por mí, con el mismo argumento: **un plan de pago
  compra cupo, no exactitud**. El dato sigue siendo de cierre diferido y de un tercero. Ver
  pto. 9.
- **Cablear los avisos de consumo del proveedor a la app** ahora que llegan a un buzón real.
  Rechazada: es la pata (ii) de F-ADR-027-2 y la prohíbe **ADR-023 pto. 15** por decisión
  escrita. Que el canal exista no autoriza a conectarlo; quien lo quiera, que traiga su spec.
- **No escribir ADR y dejarlo como nota en el roadmap.** Rechazada por el mismo motivo por el
  que ADR-027 rechazó ser una nota de spec: **quien elija el siguiente plan o proveedor lee los
  ADR**. La cifra "$0 de arranque" de ADR-012 viajó a EPIC-FIX y a las páginas legales sin que
  nadie la volviera a medir; retirarla en un sitio que no sea un ADR es garantizar el tercer
  viaje.
- **Superseder ADR-012 o ADR-027.** Rechazada por desproporcionada, y por regla: un ADR
  aceptado es **inmutable** y se enmienda **desde fuera**. De ADR-012 caducan **dos frases** de
  la sección de consecuencias; su decisión —Marketstack para precios, Twelve Data para
  búsqueda, operating MIC canónico— está **más viva que nunca**. De ADR-027 no caduca **nada**:
  este ADR es su pto. 1 y su pto. 7 **aplicados**. Superseder lo bueno con lo caduco destruiría
  trazabilidad sin ganar nada — el mismo razonamiento de ADR-024 sobre ADR-018.
- **Escribir una spec para el cambio de plan.** Rechazada: **no hay comportamiento observable
  que verificar**. No se toca ni una línea de código, no cambia ni una variable de entorno, no
  hay CA que pueda tener un test. Es literalmente el caso que ADR-027 ya juzgó: *«una spec
  necesita CA con test; esto necesita constar»*.
- **Abrir una spec propia (habría sido SPEC-049) solo para corregir los comentarios de
  `src/`.** Rechazada, con la misma navaja y en el mismo sitio. Un comentario **no tiene
  comportamiento observable**: el único CA posible sería *«el fichero ya no contiene esta
  frase»*, es decir, un test que congela **la redacción de un comentario**. Eso es
  exactamente la guardia caduca que **FOUNDATION** prohíbe desde el 2026-08-20 —*un test de
  frontera fija una propiedad, no un estado del árbol*— y que ya costó cuatro veces
  (`F-SPEC-034-6`, `F-SPEC-042-9`). Fabricar un CA para poder abrir la spec sería **usar el
  estándar contra su propio criterio**. Va como residual (`F-ADR-032-1`) por la vía que
  ADR-025 dejó escrita para este caso exacto.
- **Corregir esos comentarios aquí mismo, desde la rama de este ADR, alegando que es
  "verdad documental" y no código.** Rechazada, y conviene que quede escrito por qué, porque
  es la tentación razonable. El argumento a favor es bueno —un comentario no despliega nada—
  pero el gate no lo distingue, y **FOUNDATION dice que el gate `require-spec` no se rodea**,
  sin excepción de trivialidad. Rodearlo aquí sería crear la excepción *"si yo juzgo que es
  trivial"*, que es precisamente la que ADR-025 nació para cerrar. El coste de esperar es
  bajo: el comentario está fechado y **este ADR es la verdad**.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
