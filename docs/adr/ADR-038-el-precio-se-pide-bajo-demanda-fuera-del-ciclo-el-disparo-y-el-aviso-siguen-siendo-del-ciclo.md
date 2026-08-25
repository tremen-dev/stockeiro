---
id: ADR-038
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-25, por: sdd-arquitecto}
---
# ADR-038: El precio se pide bajo demanda fuera del ciclo; el disparo y el aviso siguen siendo del ciclo

- Deciders: propone **sdd-arquitecto** (2026-08-25) al escribir **SPEC-058**, con **dictamen
  de dominio de sdd-mercados** sobre los dos casos que la épica nombra —*«precio bajo demanda
  fuera del ciclo»* y *«símbolo con cotización congelada»*— apoyado en mediciones que este
  repositorio ya tiene escritas (ADR-027, ADR-012) y **sin medición nueva contra la API**.
  Las **dos exclusiones de alcance** (solo `/vigiladas`; el correo sigue saliendo en el ciclo)
  son **decisión del humano (Alberto Fojo) del 2026-08-25**. La **lectura de D-2** del pto. 1
  es lo que este ADR aporta y lo que el humano tiene que aprobar: **D-2 está *locked*** y solo
  un ADR aceptado puede interpretarla. **No decide el plan ni el proveedor** (eso es de
  producto y coste, ADR-032 pto. 7) ni la cadencia del ciclo (ADR-004).
- Specs relacionadas: nace de **SPEC-058** (EPIC-008), que es su primera y única aplicación.
  **Interpreta D-2** de FOUNDATION. **Extiende ADR-002 pto. 4** (dedupe: *un símbolo no se
  pide dos veces por ciclo*) al camino bajo demanda. **Precisa la redacción de RN-16** —de
  SPEC-043 y ADR-027— sin tocar su umbral, su medida ni su motivo. Hereda **ADR-004**
  (cadencia y base no ajustada), **ADR-005** (episodios *edge-triggered*), **ADR-007** y
  **ADR-012** (identidad `(ticker, operating MIC)`), **ADR-014**, **ADR-026** (una medida, un
  módulo), **ADR-027** (unidad de presupuesto) y **ADR-028** (el gesto del usuario no dispara).
  **No supersede a nadie.**

## Contexto

### El hecho, medido y no supuesto

El **único** camino por el que un precio entra en la base es el cron `0 22 * * *` de
`vercel.json` → `/api/cron/refresh` → `runCronCycle` → `refreshQuotes`, sobre el universo
`watched_symbols ∪ transactions` (`src/lib/market/refresh.ts`). El alta —`watchAction`
(`src/app/vigiladas/actions.ts`) → `watchSymbol` (`src/lib/watchlist/service.ts`)— crea la
vigilada, mete el símbolo en ese universo **y no pide precio**. Entre el alta y el ciclo
siguiente hay hasta **24 horas** de fila muda (símbolo nuevo, `state: 'none'` sin diagnóstico
porque nunca ha fallado nada) o de fila con **precio congelado** (símbolo que alguien dejó de
seguir: quedó fuera del universo y su `updated_at` no se mueve, así que RN-16 lo marca *sin
refrescar*).

### La pregunta que hay que responder por escrito, y no de memoria

**D-2** está *locked* y dice: *«**No es tiempo real**. El **disparo** se evalúa en modo
diferido/batch dentro de un ciclo de refresco acordado»*. Caben dos lecturas y hasta hoy
nadie ha tenido que elegir, porque hasta hoy solo había un camino:

- **(A) Todo lo que toca precios es del ciclo, ingesta incluida.** Bajo (A), EPIC-008 es
  ilegal sin superseder D-2, y el proyecto se queda sin refresco bajo demanda para siempre.
- **(B) D-2 gobierna la evaluación del disparo y la emisión del aviso. La ingesta es el
  insumo, no el gatillo.** Bajo (B) el precio se puede pedir cuando haga falta y el correo
  sigue siendo del ciclo.

Tres cosas empujan a **(B)** y ninguna a (A):

1. **El sujeto de la frase de D-2 es *el disparo***, no *el precio*. Lo que se declaró
   diferido fue la evaluación, y el ciclo de refresco es el sitio **donde** ocurre.
2. **El no-negociable que acompaña a D-2 es de presentación**: *«Mostrar siempre el `asOf` /
   carácter diferido del dato… jamás dar falsa sensación de tiempo real»*. Se sigue
   cumpliendo palabra por palabra: el precio bajo demanda lleva su `asOf` y se presenta como
   lo que es.
3. **El dato no se vuelve de tiempo real por pedirlo antes.** El endpoint es
   `https://api.marketstack.com/v1/eod/latest` y devuelve el **último cierre no ajustado**
   (RN-12) a cualquier hora del día. A las 10:00 trae el cierre de la sesión anterior, no un
   intradía. Pedirlo antes cambia **cuándo se escribe la fila**, no **qué** hay dentro.

Este ADR elige (B) y lo escribe **para que nadie tenga que volver a deducirlo**, que es
exactamente lo que R-1 de la épica pedía.

### Dictamen de sdd-mercados (2026-08-25)

Consultado por SPEC-058 sobre los cuatro puntos que la épica nombra. Veredicto:
**correcto con tres avisos**.

1. **La base del precio no cambia.** Mismo endpoint (`/v1/eod/latest`), mismo campo
   (`close`, **no** `adj_close`), misma regla: **último cierre NO ajustado** (RN-12). No hay
   riesgo de mezclar intradía con cierre ni ajustado con no ajustado, que es el error clásico
   de este dominio y el que RN-12 existe para impedir. El refresco bajo demanda **no puede**
   introducirlo porque no elige endpoint: reutiliza el del ciclo.
2. **El precio bajo demanda puede ser una sesión más antiguo que el que traerá el ciclo de
   esa misma noche**, y con **retraso desigual por símbolo**: medido el 2026-08-21 en una sola
   llamada, `APP` traía `date` `2026-08-19` mientras `AAPL` e `ITX` ya traían `2026-08-20`
   (ADR-027, SPEC-043). **No es un dato peor**: es el mismo dato que el producto ya le enseña
   al resto de usuarios de ese símbolo, con su `asOf` a la vista.
3. **Símbolo congelado: el upsert normal basta, sin tratamiento especial.** RN-16 se mide por
   `updated_at` —el momento de la **escritura**— y **nunca** por `as_of`. `upsertQuote`
   reescribe `updatedAt` en cada conflicto **aunque el precio y el `asOf` sean idénticos**, que
   es precisamente el argumento por el que RN-16 se mide así. Un refresco bajo demanda con
   éxito **quita la marca *sin refrescar*** por construcción, incluso cuando el proveedor
   devuelve exactamente lo que ya había.
   **Aviso 1**: la redacción de RN-16 dice *«el momento en que el **ciclo** la escribió»*, y a
   partir de aquí hay un **segundo escritor**. Hay que precisar la redacción o la regla
   empieza a describir mal lo que mide (pto. 7 de la Decisión).
4. **Coste: 1 símbolo = 1 unidad**, sin descuento por ser una petición pequeña. Doble fuente,
   ya escrita en ADR-027: medición contra la API real con la misma clave (**1 símbolo → 200**,
   13 símbolos → 429 `usage_limit_reached`) y documentación del proveedor (*«If a given API
   request contains 5 tickers, 5 API requests will be consumed»*). **Los errores no consumen
   cuota**; un **timeout del lado del cliente sí la consume**, porque la petición salió.
5. **Ningún invariante se rompe por escribir el mismo símbolo dos veces el mismo día.**
   `quotes` es **una fila por símbolo** (ADR-004), no una serie: no hay historia que
   desordenar. RN-11 se computa **en render** sobre la fila vigente (`zone-status.ts`), así que
   persistir el precio basta para que la fila pinte precio y color — **no hace falta tocar el
   motor y no se debe**. RN-13 (*edge-triggered*) se sigue evaluando **una vez por ciclo**,
   sobre la fila que exista en ese instante, que es la que el propio ciclo acaba de escribir.
   **Aviso 2**: si el refresco del ciclo **falla** para ese símbolo, el motor evaluará sobre el
   precio bajo demanda. Eso **no es una clase nueva de comportamiento** —hoy evalúa sobre el
   precio de anteayer cuando el refresco falla— y es la razón de que el pto. 9 prohíba marcar
   ese precio como «provisional».
   **Aviso 3, y este sí es nuevo**: un episodio puede **no llegar a existir nunca**. Si a las
   10:00 el cierre de ayer cae dentro de la zona —la pantalla dice «En compra»— y a las 22:00
   el cierre de hoy cae fuera, el motor **nunca ve la entrada** y **no sale correo**. Es D-2
   funcionando, no un aviso perdido; pero es exactamente el desacompasamiento de **R-3** de la
   épica, y el usuario tiene que **leerlo en la pantalla**, no descubrirlo.
6. **Nota sobre el tope por segundo.** `classifyGlobal` (`marketstack-provider.ts`) presume que
   un 429 mudo es la cuota mensual, y lo argumenta así: *«esta app hace una llamada por ciclo
   (dedupe de ADR-002), así que **no puede** alcanzar un tope de cinco peticiones por
   segundo»*. Con el camino bajo demanda esa **imposibilidad** pasa a ser una
   **improbabilidad**: harían falta cinco altas en el mismo segundo. **No se toca el
   clasificador** —Marketstack sí manda `rate_limit_reached` para ese caso y la rama que lo
   mira va **antes** que la presunción—, pero queda escrito aquí para quien abra el refresco
   bajo demanda a un botón repetible, al import de bróker o a cualquier gesto que pueda
   ráfagar.

## Decisión

### 1. D-2 gobierna el **disparo** y el **aviso**, no la **ingesta**

Un precio se puede pedir **fuera del ciclo** cuando un gesto del usuario lo justifique. Lo que
sigue siendo diferido, y no se toca, es: **la evaluación de la entrada en zona** (RN-11 →
RN-13, ADR-005) y **la emisión del aviso** (RN-14, ADR-006). La pantalla puede decir «En
compra» al instante; el correo sale en el ciclo.

Lo que este punto **no** autoriza, y conviene decirlo porque es la puerta que se abre:
**polling, refresco automático de la pantalla, disparadores por valor puntual e intradía
siguen fuera** —por D-2, por D-3 y por la visión—. Esto añade **un** refresco atado a **un**
gesto del usuario.

### 2. Un solo camino de ingesta: el refresco bajo demanda **es** el del ciclo con un universo de uno

No se escribe una segunda función que pida un precio. El cuerpo que hoy vive en
`refreshQuotes` —pedir por `(ticker, micCode)` (ADR-007/ADR-012), `upsertQuote` con la divisa
**del símbolo** y no la del proveedor (RN-09), `clearDiagnostic` al acertar, `upsertDiagnostic`
con el motivo clasificado al fallar (SPEC-016), y el `try/catch` de defensa en profundidad que
degrada a `proveedor_no_disponible` (SPEC-020 CA-9)— se **extrae** y lo llaman **los dos**
caminos: el ciclo con N símbolos y el alta con uno.

Por qué esto es una decisión y no una preferencia de estilo: **dos definiciones de «cómo se
ingiere un precio» es la duplicación que este proyecto ya ha pagado**. **ADR-026** existe
porque cuatro guardias de geometría se copiaron entre sí y dos perdieron la medida buena;
`src/lib/market/sin-refrescar.ts` existe porque un segundo literal del umbral habría producido
dos umbrales y uno equivocado. Y aquí el precio del error es peor que un número mal copiado:
un segundo camino que construya el símbolo del proveedor por su cuenta es **exactamente** cómo
entra una serie envenenada —el proyecto ya tiene el caso, con un ticker cuyo mercado europeo
trajo la serie estadounidense.

### 3. El refresco bajo demanda **no evalúa disparos, no abre ni cierra episodios y no notifica**

Gemelo exacto de **ADR-028 pto. 3**, y por el mismo motivo: quien reconcilia con el precio
nuevo es **el ciclo siguiente**. Si algún día alguien añade aquí un `evaluateTriggers()` *«para
que se vea al momento»*, reintroduce el aviso por gesto que ADR-028 vino a eliminar **y**
reinterpreta D-2 por la puerta de atrás, sin gate y sin ADR.

### 4. El alta se persiste **antes** de pedir el precio, y el precio **nunca** puede impedir el alta

Orden fijado: **escribir la vigilada → pedir el precio → revalidar la pantalla**. El refresco va
en su **propio `try/catch`**, y cualquier resultado suyo —éxito, fallo clasificado, excepción
inesperada, presupuesto agotado— deja el alta **completada** y la acción devolviendo `{ ok: true }`.

*El precio es un extra, jamás un requisito del alta* (CE-2 de EPIC-008). Y la revalidación va
**después** del refresco a propósito: es lo que hace que el precio aparezca **sin que el usuario
recargue a mano** (CE-1).

### 5. Presupuesto de tiempo declarado, y su agotamiento degrada **por el camino que ya existe**

El alta pasa a esperar a un tercero. Se le pone un **presupuesto de tiempo de 3 segundos**,
declarado **en un solo sitio** y no tecleado dos veces (ADR-026 pto. 2).

Por qué **3 s**, con el precio de las alternativas:

- **1 s**: se agotaría con frecuencia por latencia normal de red hacia un tercero, y
  convertiría el caso bueno en el caso raro.
- **3 s**: por encima de esto el usuario ya asume que algo va mal, y el alta en sí (dos
  escrituras en la base) tarda milisegundos: el presupuesto es **todo** para el tercero.
- **10 s**: es la clase de espera que hace que la gente pulse dos veces el botón.

El presupuesto **vive en el dominio (el refresco), no en el adaptador**: es una propiedad de la
**paciencia de quien llama**, no del proveedor — el ciclo no tiene prisa y **no** lleva
presupuesto, exactamente como hoy.

Y cuando se agota, **no hay motivo de fallo nuevo ni rama nueva**: se trata como un adaptador
que lanza, que es el camino de **SPEC-020 CA-9** ya escrito y ya probado → `proveedor_no_disponible`
para ese símbolo → diagnóstico escrito → la pantalla dice *«sin cotización · el proveedor no
respondió»*. Inventar un motivo `tiempo_agotado` sería ampliar el vocabulario de dominio
(ADR-012 pto. 6) para decir lo mismo.

**El presupuesto ahorra espera, no cuota**: la petición ya salió y la unidad ya se consumió
(dictamen pto. 4).

### 6. No se pide un símbolo cuya cotización **ya es vigente**

Es **ADR-002 pto. 4** —*un símbolo no se pide dos veces por ciclo*— aplicado al camino bajo
demanda. Una cotización es **vigente** cuando **existe** y **no está *sin refrescar***: el
**mismo predicado y el mismo umbral de RN-16 (36 h)**, en su **único hogar**
(`src/lib/market/sin-refrescar.ts`).

Por qué el umbral de RN-16 y no uno propio, que es la pregunta que hay que hacerse antes de
reutilizar un número: **si la pantalla ya la presenta como vigente, no hay nada que ganar
pidiéndola otra vez** — es literalmente la misma pregunta con las mismas consecuencias. Y si
mañana cambia la cadencia (ADR-004) o el umbral (F-SPEC-043-2), las dos cosas se mueven juntas
en vez de divergir en silencio.

Esto es lo que cierra **R-2 de la épica**: `watchSymbol` es *upsert*, así que **dar de alta lo
mismo dos veces no puede gastar cuota dos veces**, y tampoco lo pueden hacer un `unwatch` +
`watch` repetidos ni dos usuarios que añadan el mismo símbolo el mismo día. La propiedad no
depende de distinguir «alta nueva» de «actualización de zonas»: depende **del estado del dato**,
que es lo que de verdad decide si la llamada compra algo.

### 7. RN-16 se **precisa**: `updated_at` es *cuándo se escribió la fila*, no *cuándo la escribió el ciclo*

Cambia **la redacción**, y nada más: **el umbral (36 h), la medida (`updated_at` y nunca
`as_of`), los tres motivos por los que se mide así y la premisa de ciclo diario sin saltos
quedan intactos**. Lo mismo en la entrada «Cotización sin refrescar» de `dominio.md`. Es una
precisión obligada por tener un segundo escritor, no una enmienda al fondo de SPEC-043.

### 8. Alcance: **una sola puerta**, y la lista de las que no se abren

Entra **`/vigiladas`** (`watchAction`). **Quedan fuera** el alta manual en `/cartera`, el import
de bróker (EPIC-002) y un botón de *«actualizar ahora»* sobre una vigilada que ya existe —
decisión del humano del 2026-08-25.

Quien abra cualquiera de esas puertas **vuelve aquí** y revisa **el pto. 6** (el import mete
decenas de símbolos de golpe: otro patrón de consumo) y **el aviso 6 del dictamen** (un botón
repetible sí puede ráfagar contra el tope por segundo).

### 9. Un precio bajo demanda **es un precio**: sin marca de «provisional»

No se añade columna, ni bandera, ni una segunda calidad de precio vigente. Dos calidades serían
**dos definiciones de precio vigente**, y todo lo que hoy lee `quotes` —P/L actual (RN-06),
estado de zona (RN-11), motor (RN-13), la marca de RN-16— tendría que aprender a distinguirlas.
El precio bajo demanda **se ganó su fila** con la misma llamada, el mismo endpoint y la misma
regla que el del ciclo.

## Consecuencias

### Positivas

- **La vigilada nace con precio** y la fila pinta su estado de zona en el acto (CE-1), sin
  esperar hasta 24 h y sin recargar a mano.
- **El símbolo congelado se descongela solo**: el upsert mueve `updated_at` y la marca de RN-16
  desaparece sin código específico para ese caso.
- **El fallo deja de ser mudo antes que hoy**: si el refresco al alta falla, se escribe el
  diagnóstico de SPEC-016 **en el acto**, así que la fila explica su silencio desde el primer
  minuto en vez de a las 22:00.
- **Un solo cuerpo de ingesta** para el ciclo y para el alta: un cambio en cómo se ingiere un
  precio no puede volver a aplicarse a medias.
- **La regla que sostiene todo esto queda escrita.** La siguiente puerta (cartera, import,
  botón) no tiene que volver a deducir la lectura de D-2 ni a inventarse la condición de gasto.

### Negativas / follow-ups

- **El alta pasa a depender de un tercero para su latencia.** Acotada por el pto. 5, pero real:
  el caso bueno añade una ida y vuelta a Marketstack a un formulario que hasta hoy solo hablaba
  con la base. **La latencia real no está medida**; el presupuesto de 3 s es un techo razonado,
  no un percentil observado. **Follow-up**: si molesta, la salida es la alternativa (d) —
  refrescar en segundo plano—, y entonces este ADR se enmienda con otro.
- **La pantalla y el correo van desacompasados a propósito** (R-3 de la épica), y en un caso el
  correo **no llega nunca**: precio de ayer dentro de zona a las 10:00, precio de hoy fuera a
  las 22:00 (dictamen, aviso 3). Es correcto por D-2 y **hay que contarlo en la pantalla**;
  SPEC-058 lleva ese CA.
- **La premisa del 429 mudo se debilita** (dictamen, aviso 6). No se toca hoy; se revisa cuando
  se abra la segunda puerta.
- **Segundo escritor sobre `quotes`.** RN-16 deja de poder decir «el ciclo» (pto. 7), y
  cualquier lectura futura que asuma *«esta fila la escribió el cron»* es a partir de hoy falsa.
- **Consumo extra**, pequeño y acotado por el pto. 6: **1 unidad** por alta que refresca, en la
  unidad de ADR-027 pto. 1. La cuenta completa vive en SPEC-058 (CE-4) y no se duplica aquí.

## Alternativas consideradas

- **(a) Statu quo: esperar al ciclo.** Es el problema que EPIC-008 describe, observado sobre la
  pantalla real. Rechazada.
- **(b) Evaluar disparos y avisar también al alta.** Es la lectura (A)+ de D-2: reinterpretaría
  de verdad *«no es tiempo real»*, rompería el modelo *edge-triggered* de ADR-005 y
  reintroduciría el **aviso por gesto** que ADR-028 eliminó. **Rechazada por decisión del humano
  del 2026-08-25**; si algún día se quiere, necesita su propio gate y su propio ADR.
- **(c) Un camino de ingesta «ligero» dentro del servicio de watchlist.** Más corto de escribir
  y más fácil de reseñar en un PR. Rechazada: es la duplicación de ADR-026 y `sin-refrescar.ts`,
  con un agravante propio —un segundo constructor del símbolo del proveedor es cómo entra una
  serie envenenada (pto. 2)—.
- **(d) Refrescar en segundo plano y no bloquear el alta** (cola, `waitUntil`, o un segundo
  *round-trip* desde el cliente). Rechazada **hoy**: es más maquinaria de la que el problema
  pide, y con la revalidación **después** del refresco (pto. 4) el precio ya aparece sin que el
  usuario recargue, que es literalmente CE-1. Con el presupuesto del pto. 5 el bloqueo está
  acotado. **Reconsiderable** si la latencia medida molesta — y entonces por ADR, no por parche.
- **(e) Marcar el precio bajo demanda como «provisional» hasta que lo confirme el ciclo.**
  Rechazada por el pto. 9: dos definiciones de precio vigente, y todo lector de `quotes`
  obligado a aprender la diferencia para no ganar nada — el dato es el mismo cierre no ajustado.
- **(f) Condicionar el gasto a que el alta sea nueva (`INSERT`) y no una actualización de zonas.**
  Es la respuesta obvia a R-2 y es **peor** que el pto. 6: deja fuera el `unwatch` + `watch`
  repetido, deja fuera al segundo usuario que añade el mismo símbolo, y gasta una unidad cuando
  el precio de anoche ya está en la fila. Rechazada: la condición correcta mira **el estado del
  dato**, no la forma del gesto.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
