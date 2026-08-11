---
id: SPEC-020
tipo: spec
epica: EPIC-FIX
estado: aprobada
aprobada-por: sdd-orquestador, por delegacion explicita de Alberto Fojo (sesion 2026-08-11) — SIN revision humana del contenido
historial:
  - {estado: borrador, fecha: 2026-08-11, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-11, por: sdd-orquestador (delegacion de Alberto Fojo; el humano autorizo el pipeline completo antes de que esta spec existiera y no ha leido su contenido)}
---
# SPEC-020 — Dialecto de simbolo del proveedor por mercado

## Problema
**Ninguna acción estadounidense ha podido cotizar jamás.** Verificado en producción hoy
(2026-08-11, tras desplegar `main` con `MARKETSTACK_API_KEY` ya aprovisionada): PHM (BMEX)
cotiza a 80,90 €, pero **DOCS, TTD y WEN** muestran *"No se vigila: El proveedor no
reconoce este símbolo (puede estar deslistado)"*. No están deslistadas: **el motivo es
falso**.

La causa es una premisa incompleta de **SPEC-015**, correctamente declarada entonces como
salvedad **F-SPEC-015-1**: el adaptador construye **siempre** `TICKER.MIC`
(`marketstack-provider.ts:118`) y solo traduce un dialecto suelto de MIC
(`TO_PROVIDER = { XETR: 'XETRA' }`, línea 38). Pero **Marketstack no admite sufijo para
los mercados estadounidenses**: hay que pedir el **ticker pelado**. El dialecto no es una
traducción de código de mercado: es **conocimiento por mercado**, y hay mercados **con**
sufijo y mercados **sin** él.

**Tabla verificada contra la API real** (2026-08-11; NO se vuelve a sondear: el free tier
son ~100 peticiones/mes y ya se han gastado ~12):

| Operating MIC | Forma que ACEPTA el proveedor | Verificado con |
|---|---|---|
| `BMEX` | `TICKER.BMEX` | ITX 59,10 · SAN 12,852 · TEF 3,636 · PHM 80,90 |
| `XETR` | `TICKER.XETRA` | SAP.XETRA 179,3 |
| `XPAR` | `TICKER.XPAR` | MC.XPAR 482,45 |
| `XAMS` | `TICKER.XAMS` | ASML.XAMS 1513,8 |
| **`XNAS`** | **`TICKER` pelado** (`.XNAS` es inválido) | AAPL 308,26 · WEN 7,30 · DOCS 25,63 · TTD 13,39 |
| **`XNYS`** | **`TICKER` pelado** (`.XNYS` es inválido) | KO 86,87 |
| `XSTO` | **SIN RESOLVER** (fallaron `ERIC.XSTO`, `ERIC_B.XSTO`, `VOLV_B.XSTO`) | — |

En los valores US el MIC **sigue volviendo** en el campo `exchange` del eco
(`"exchange":"XNAS"`), así que la identidad del precio **se puede verificar sin sufijo** y
**RN-09** no se relaja: se pide pelado, pero se **confirma el mercado** antes de asignar
el precio.

**El defecto tiene dos modos de fallo, y el segundo es peor que el primero:**

1. **Lote enteramente inválido** → HTTP **200** con `{error:{code:"no_valid_symbols_provided"}}`
   → el adaptador hace `throw` (`marketstack-provider.ts:125`). **Nadie lo captura**:
   `refreshQuotes` no envuelve `provider.getQuotes`, así que el **ciclo entero muere con
   500** — sin cotizaciones, sin evaluación de disparos (**SPEC-005**) y sin avisos
   (**SPEC-006**), para **todos** los usuarios. Un solo mercado mal formado tumba el
   refresco de todo el mundo.
2. **Lote mixto** → los símbolos mal formados **desaparecen sin fila de error**, caen al
   barrido final de `pedidos` y se reportan como `simbolo_desconocido` → *"puede estar
   deslistado"*. **Un motivo falso que despista al usuario**: es exactamente el fallo que
   **SPEC-016** vino a matar (**CE-F2**), reaparecido un nivel más abajo — ya no un
   silencio, sino una **mentira**.

Esta spec cierra **CE-F1** para los mercados verificados y devuelve **CE-F2** a su
promesa. Es **detalle de adaptador**: **implementa ADR-012 pto. 4** (la traducción vive en
el adaptador; el dominio guarda siempre el operating MIC canónico) y **precisa** el
contrato de resiliencia del puerto (**ADR-002**, CA-6 de SPEC-004; **ADR-012 pto. 6**).
**No cambia ninguna decisión**: no hace falta un ADR nuevo (ver notas del gate, punto 5).
Reglas: **RN-09** (divisa/mercado del símbolo), **RN-06** (sin precio, sin P/L), **RN-12**
(cierre no ajustado), **D-2** (`asOf`). Dominio: sdd-mercados.

## Usuarios / roles afectados
- **Usuario final**: sus acciones **estadounidenses** (Nasdaq y NYSE) pasan a cotizar —
  P/L actual con dato (**RN-06**) y zonas evaluadas (**RN-11**), como ya ocurre con las
  españolas. Y cuando algo **no** se pueda cotizar, el motivo que lea será **cierto**: deja
  de acusar de "deslistado" a un valor que cotiza perfectamente.
- **Todos los usuarios (resiliencia)**: un fallo global del proveedor deja de tumbar el
  ciclo diario. Hoy, un único mercado mal formado deja **a todo el mundo** sin refresco,
  sin disparos y sin avisos.
- **Operador**: el resultado del ciclo deja de ser un 500 opaco.

## Criterios de aceptación
Cada CA es verificable con un test. Se usa el `FakeMarketDataProvider` / fakes existentes
y `fetch` inyectado (patrón de SPEC-015/SPEC-016): **NO se llama a la API real en tests**
— la tabla de arriba ya está verificada y el free tier no da para sondeos.

- **CA-1 (Dialecto por mercado — mercados CON sufijo).**
  Dados símbolos con operating MIC `BMEX`, `XETR`, `XPAR` y `XAMS`,
  cuando el adaptador construye la petición,
  entonces pide `ITX.BMEX`, `SAP.XETRA`, `MC.XPAR` y `ASML.XAMS` — el dialecto de `XETR`
  sigue siendo `XETRA` y el dominio sigue guardando el canónico `XETR` (**ADR-012 pto. 4**).
- **CA-2 (Dialecto por mercado — mercados SIN sufijo, el defecto corregido).**
  Dados símbolos con operating MIC `XNAS` y `XNYS` (p. ej. `AAPL@XNAS`, `KO@XNYS`),
  cuando el adaptador construye la petición,
  entonces los pide **pelados** (`symbols=AAPL,KO`) y **nunca** con sufijo: en la URL no
  aparece `.XNAS` ni `.XNYS`.
- **CA-3 (El eco del ticker pelado se empareja y se persiste).**
  Dado `AAPL@XNAS` pedido pelado y una respuesta con `{symbol:"AAPL", exchange:"XNAS",
  close, date}`,
  cuando el adaptador responde,
  entonces la cotización **casa** con la petición por identidad completa (ticker +
  operating MIC, tomando el mercado del campo `exchange`) y se **persiste**: `close` no
  ajustado (**RN-12**), `date` como `asOf` (**D-2**) y la divisa **del símbolo**
  (**RN-09**). Deja de caer en `skipped`.
- **CA-4 (Eco de OTRO mercado: nunca el precio equivocado).**
  Dado `TICKER@XNAS` pedido pelado y una respuesta cuyo `exchange` es `XNYS`,
  cuando el adaptador responde,
  entonces **NO** se le asigna ese precio al pedido de `XNAS` (falsearía el P/L,
  **RN-09**/**RN-06**): el símbolo sale en `failures` **con motivo**, no en `quotes`. Un
  precio equivocado es peor que ningún precio.
- **CA-5 (Mismo ticker en dos mercados US — la colisión del pelado).**
  Dado el mismo ticker pedido a la vez en `XNAS` y en `XNYS` (ambos sin sufijo, luego
  **misma cadena** para el proveedor),
  cuando se construye el lote,
  entonces el símbolo **no se pide dos veces** (dedupe de la cadena enviada, **ADR-002**) y
  el precio devuelto se asigna **solo** al mercado que confirma el `exchange` del eco; el
  otro sale en `failures`. Ningún pedido recibe un precio que no le corresponde.
- **CA-6 (Mercado sin dialecto conocido: no se pide y no se miente).**
  Dado un símbolo de un mercado soportado por el dominio pero **sin dialecto verificado**
  (hoy `XSTO`),
  cuando se ejecuta el ciclo,
  entonces **no se gasta una llamada** en adivinar su formato y el símbolo sale con motivo
  **`mercado_no_cubierto`** ("nuestro proveedor no cubre este mercado", que es cierto para
  nosotros hoy) y **nunca** `simbolo_desconocido` ("puede estar deslistado", que sería
  falso).
- **CA-7 (Un fallo GLOBAL del proveedor no tumba el ciclo).**
  Dado que el proveedor devuelve un fallo global (HTTP 200 con `{error:{...}}`, o un HTTP
  no-OK),
  cuando se ejecuta el ciclo,
  entonces el adaptador **no lanza**: degrada a **fallo por símbolo** para todos los
  pedidos, `refreshQuotes` termina, la evaluación de disparos y los avisos **se ejecutan
  igual** y el endpoint del cron responde **200** con los símbolos en `skipped` y su
  motivo. **Ningún ciclo muere por el proveedor.**
- **CA-8 (Motivos distintos: rechazo de la petición ≠ caída del proveedor).**
  Dado (a) un fallo global `no_valid_symbols_provided` —el proveedor respondió y rechazó
  **nuestra** petición— y (b) una caída real (HTTP 5xx, red caída, timeout),
  cuando se clasifican los motivos,
  entonces son **motivos distintos** y ninguno de los dos es `simbolo_desconocido`: (b) es
  `proveedor_no_disponible` ("se reintentará en el próximo ciclo", que es cierto) y (a)
  usa un motivo propio (p. ej. `simbolo_no_admitido`) cuyo texto **no acusa al valor** de
  estar deslistado ni promete que el reintento lo arregle — porque no lo arreglará.
- **CA-9 (Defensa en profundidad: el dominio también degrada).**
  Dado un adaptador que **lanza igualmente** (excepción inesperada, `MARKETSTACK_API_KEY`
  ausente, error de red no contemplado),
  cuando se ejecuta `refreshQuotes`,
  entonces el ciclo **no aborta**: los símbolos del universo quedan con motivo
  `proveedor_no_disponible`, su diagnóstico se persiste (**SPEC-016** CA-2) y el ciclo
  continúa. La resiliencia no depende de que un adaptador futuro se porte bien.
- **CA-10 (Sin regresión de lo ya entregado).**
  Dado el ciclo completo con la suite existente,
  cuando se ejecuta,
  entonces siguen verdes: **batch de una sola llamada** y dedupe por símbolo
  (**ADR-002**/CA-7 de SPEC-015), **`close` no ajustado** con `adj_close` ignorado
  (**RN-12**), divisa del símbolo (**RN-09**), resiliencia **por símbolo** (CA-6 de
  SPEC-004), diagnóstico persistido y **limpiado al resolverse** (CA-2/CA-8 de SPEC-016) y
  aislamiento por usuario (**RN-01/RN-03**).

## Entidades y reglas afectadas
- **`market/marketstack-provider.ts`** (el grueso del cambio): la tabla `TO_PROVIDER`/
  `FROM_PROVIDER` se sustituye por **conocimiento por mercado** — la forma sugerida es una
  función `providerSymbol(ticker, mic)` sobre una tabla que declare, por operating MIC,
  **si lleva sufijo y cuál** (`BMEX`→`.BMEX`, `XETR`→`.XETRA`, `XPAR`, `XAMS`) o si va
  **pelado** (`XNAS`, `XNYS`), y que **no tenga entrada** para lo no verificado (`XSTO`) →
  no se pide (CA-6). La forma exacta la decide el implementador; los CA fijan lo
  observable. Esta tabla es conocimiento **de proveedor**, así que vive **aquí** y no en
  `market/mic.ts` (**ADR-012 pto. 4**).
- **`market/mic.ts`**: **no se toca**. `XSTO` sigue siendo un operating MIC soportado por
  el dominio (ISO 10383); que hoy no sepamos pedirlo a *este* proveedor es ignorancia del
  adaptador, no del mercado.
- **`market/provider.ts`**: `QuoteFailureReason` gana **un** motivo para el rechazo de la
  petición por el proveedor (CA-8). El resto del contrato del puerto —`{quotes, failures}`,
  `quoteKey`, `ProviderQuote`— **no cambia**.
- **`market/fail-reason-text.ts`**: texto de usuario del motivo nuevo. Regla heredada de
  SPEC-016: **categoría del dominio, nunca el texto crudo del proveedor**.
- **`market/refresh.ts`**: envuelve la llamada al puerto para degradar un `throw` a fallo
  por símbolo (CA-9). Es la única línea de dominio que se toca; el cálculo de P/L, el motor
  de disparo y los avisos **no se tocan**.
- Reglas: **RN-09** (mercado/divisa del símbolo: el eco debe confirmar el mercado antes de
  asignar precio), **RN-06** (sin precio no hay P/L actual), **RN-12** (cierre no
  ajustado), **RN-11** (evaluación de zona), **RN-01/RN-03** (aislamiento), **D-2**
  (`asOf`). Decisiones: **ADR-012** (pto. 4 y pto. 6, que esta spec **implementa**, no
  altera), **ADR-002** (puerto, batch y dedupe intactos), **ADR-004** (cadencia intacta),
  **ADR-007** (identidad `(ticker, operating MIC)` intacta).
- Cierra **F-SPEC-015-1** para `BMEX`, `XETR`, `XPAR`, `XAMS`, `XNAS` y `XNYS`
  (verificados contra la API real, tabla del Problema). Deja **`XSTO` abierto** como
  follow-up explícito.

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Resolver el dialecto de `XSTO`**: los tres formatos probados fallaron y **no se
  inventa** el cuarto. Queda como follow-up **F-SPEC-020-1**, a resolver con un sondeo
  **presupuestado** (quedan ~88 llamadas del mes) o consultando `/tickers?exchange=XSTO`,
  no a base de reintentos a ciegas. Mientras tanto, un valor de Estocolmo **no cotiza y lo
  dice** (CA-6). Hoy no hay ninguno en la cartera real.
- **Mercados nuevos** (Milán, Londres, Suiza…): esta spec arregla los siete ya soportados.
- **Reintentos/backoff y alerting al operador** del ciclo: mejora, no defecto (EPIC-MEJORA;
  ya aparcado por SPEC-015/SPEC-016). Aquí solo se garantiza que el ciclo **sobreviva**.
- **Que el diagnóstico distinga "intento de este ciclo" de "estado persistente"**: un fallo
  global sobrescribe el motivo anterior más específico de cada símbolo. Es cierto y va
  fechado (`attemptedAt`, SPEC-016 CA-2); afinarlo es EPIC-MEJORA.
- **Llamar a la API real en tests**: prohibido (coste y flakiness). La verificación real ya
  está hecha y va anotada en el código y en esta spec.
- **Cambiar el proveedor de búsqueda** (Twelve Data) o el de cotizaciones: **ADR-012** sigue
  vigente. Esto es un arreglo dentro del adaptador que ese ADR eligió.
- **Ajuste por eventos corporativos, histórico de cotizaciones y cadencia**: intactos
  (**ADR-004**).

## Notas para el gate humano
1. **El dato está verificado, no supuesto** — y **no se puede re-verificar barato**: la
   tabla del Problema sale de llamadas reales del 2026-08-11 y el free tier son ~100
   peticiones/mes (ya gastadas ~12). Por eso la tabla se documenta **con su procedencia**
   en el código y los tests usan fakes.
2. **Lo que más duele no es el sufijo, es el 500.** El modo de fallo 1 significa que **un
   solo mercado mal formado deja a todos los usuarios sin refresco, sin disparos y sin
   avisos** ese día. Por eso CA-7 y CA-9 (belt and braces: el adaptador no lanza **y** el
   dominio aguanta si lanza) son parte del defecto, no una mejora.
3. **Motivo nuevo en el vocabulario del dominio** (CA-8): la alternativa era reusar
   `simbolo_desconocido` ("puede estar deslistado") o `proveedor_no_disponible` ("se
   reintentará en el próximo ciclo"). **Las dos mienten** en este caso: el valor no está
   deslistado y el reintento no arregla nada. En la épica cuyo producto **es** el motivo
   (CE-F2), un motivo mentiroso es el defecto, no un detalle.
4. **`XSTO` se queda fuera con nombre y apellidos** (F-SPEC-020-1). Prefiero un mercado que
   declara "no lo cubro" a un formato inventado que gasta cuota y devuelve motivos falsos.
   Si tienes o quieres valores suecos, dilo en el gate y lo resolvemos antes de implementar.
5. **No hay ADR nuevo, y es deliberado.** ADR-012 ya decidió lo que había que decidir: la
   identidad canónica es el operating MIC y **la traducción al dialecto del proveedor vive
   en el adaptador** (pto. 4); el puerto propaga el motivo por símbolo (pto. 6). Que ese
   dialecto sea "sufijo o nada según el mercado" es **cumplir** esa decisión con el dato
   real, no cambiarla; y la resiliencia por símbolo ya es contrato de ADR-002/SPEC-004. Un
   ADR aquí solo repetiría los dos anteriores. **Si discrepas, el sitio donde discutirlo es
   este punto**: lo más cercano a "decisión nueva" es el motivo añadido al vocabulario del
   puerto (punto 3).
6. **Aprobación**: la spec queda en **`borrador`**. El rol sdd-arquitecto no aprueba sus
   propias specs — ni siquiera con delegación: la delegación autoriza a **quien conduce el
   pipeline** a registrar la aprobación en el gate, no al autor a auto-aprobarse. El
   orquestador debe estampar el estado `aprobada` haciendo constar la delegación explícita
   de Alberto Fojo en esta sesión (2026-08-11).
