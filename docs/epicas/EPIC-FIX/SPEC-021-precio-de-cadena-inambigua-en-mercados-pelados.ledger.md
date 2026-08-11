---
id: SPEC-021
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-021 Precio de cadena inambigua en mercados pelados

## Resumen
- Fase: **implementada, pendiente de verificación** (spec en `en-revision`; ADR-014
  `aprobada` en el mismo gate humano que la spec).
- Rama: `ft/SPEC-021-precio-de-cadena-inambigua-en-mercados-pelados`
- Continuación directa de **SPEC-020**: el dialecto ya funciona, pero **DOCS** sigue sin
  precio porque los dos proveedores discrepan sobre su mercado (buscador: `XNYS`;
  Marketstack etiqueta el eco como `XNAS`). Se relaja el rechazo del eco **solo** cuando la
  cadena es **pelada, inambigua y dentro de un grupo de mercados equivalentes**
  (`{XNAS, XNYS}`). Origina **ADR-014** (también en `borrador`).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (DOCS: eco `XNAS` sobre pedido único `XNYS` → precio asignado) | `marketstack-provider.ts` — tabla `EQUIVALENT_MARKET_GROUPS` (con procedencia y argumento de seguridad) + **paso 2** de atribución tras el bucle de filas | `market-provider-equivalent-markets.test.ts` › CA-1 («la cadena viaja PELADA y el precio SÍ se le asigna al pedido»: `close` 25,63 no ajustado y `date`→`asOf`, `failures` vacío) | Suite completa **211/211** verde en mi ejecución. Test no vacío: comprueba la cadena enviada (`['DOCS']`), el precio `25.63` frente a un `adj_close` señuelo de 999,99 (RN-12), `asOf` y `failures: []`. Reproducido con caso propio (`DOCS@XNYS` + eco `XNAS`) contra el código de SPEC-020 en paralelo: **viejo** → `failures:[simbolo_no_admitido]`, **nuevo** → cotización asignada. El defecto real queda cerrado | ✅ |
| CA-2 (el `micCode` que viaja es el DEL PEDIDO; el ciclo persiste con divisa del símbolo) | `marketstack-provider.ts` — el `push` del paso 2 usa `micCode: a.mic` (el del pedido); el del eco va aparte en `providerMicCode`. `refresh.ts` sin cambios en el emparejado por `quoteKey` ni en la divisa | `market-provider-equivalent-markets.test.ts` › CA-2 (3 casos: `micCode` es `XNYS` y no `XNAS`; el ciclo persiste 25,63 en **USD** con su `asOf`; el diagnóstico previo se **limpia**) | Verificado **a nivel de BD** con caso propio, no solo en el retorno del adaptador: tras `refreshQuotes`, el `JOIN quotes×symbols` devuelve **una** fila con `mic_code='XNYS'`, `exchange='NYSE'`, `price='25.63'`, `currency='USD'`, `asOf=2026-08-11T00:00:00.000Z`; y `SELECT mic_code FROM symbols` devuelve **solo** `['XNYS']` — el eco `XNAS` no crea ni contamina ningún símbolo. `refresh.ts` no cambia el emparejado por `quoteKey` ni la divisa (revisado el diff) | ✅ |
| CA-3 (cadena ambigua → estricto; SPEC-020 CA-5 intacta) | `marketstack-provider.ts` — condición (b) del paso 2: `askable.filter(x => x.sent === a.sent).length !== 1` → no se relaja | `market-provider-equivalent-markets.test.ts` › CA-3 (2 casos, los dos sentidos) · sin regresión en `market-provider-dialect.test.ts` › CA-5 (3 casos, intactos) | Casos propios con `SAN@XNAS`+`SAN@XNYS` (el par que más daño haría), los **cuatro** ecos: `XNAS` → solo XNAS cobra; `XNYS` → solo XNYS cobra; **`XETRA` → los dos fallan**; **sin `exchange` → los dos fallan**. Con dos pedidos por la misma cadena no se relaja **nada** en ningún sentido. Verificado también en ciclo: dos símbolos US del mismo ticker → se persiste **una** fila, la del MIC confirmado (`XNAS`), y el otro sale en `skipped` con `simbolo_no_admitido`. SPEC-020 CA-5 sigue verde sin tocar | ✅ |
| CA-4 (mercado CON sufijo → estricto) | `marketstack-provider.ts` — condición (a) del paso 2: `a.sent !== a.req.ticker` → no se relaja | `market-provider-equivalent-markets.test.ts` › CA-4 (2 casos: `MC@XPAR` con eco `XMIL`; `ITX@BMEX` con eco `XETRA`) | Casos propios **distintos de los suyos**, elegidos para forzar la relajación: `ITX@BMEX` con eco **`XNYS`** (mercado *del* grupo) → rechazado; `SAP@XETR` con eco **`XNAS`** → rechazado; `ASML@XAMS` con eco pelado `XNAS` → rechazado. La condición (a) (`a.sent !== a.req.ticker`) corta antes de mirar el grupo, así que ningún mercado con sufijo puede entrar por esta vía | ✅ |
| CA-5 (eco fuera del grupo → estricto; guardarraíl de divisa RN-09) | `marketstack-provider.ts` — condición (c) del paso 2: `sameEquivalentGroup(a.mic, h.micEco)` sobre la tabla declarada | `market-provider-equivalent-markets.test.ts` › CA-5 (2 casos: `WEN@XNAS` con eco `XETRA` sin precio; y el ciclo no persiste **nada** — cero euros guardados como dólares) | Barrido propio sobre `DOCS@XNYS` (pedido único y pelado) con **11 ecos fuera del grupo**: `XETRA`, `XETR`, `XPAR`, `XAMS`, `BMEX`, `XLON`, `XSTO`, `XTSE` y los plausibles del propio proveedor en US (`ARCX`, `BATS`, `IEXG`) — **los 11 rechazados** con `simbolo_no_admitido`. En ciclo con eco `XETRA` sobre símbolo USD: `updated: []`, `mismatched: []` y `SELECT * FROM quotes` **vacío** — ni un euro guardado como dólar. El guardarraíl de divisa está intacto | ✅ |
| CA-6 (eco sin mercado legible → estricto) | `marketstack-provider.ts` — `if (!micEco) continue` **antes** de decidir nada: una fila sin mercado no entra ni en el emparejado exacto ni en las candidatas del paso 2 | `market-provider-equivalent-markets.test.ts` › CA-6 (fila sin `exchange` y sin sufijo en `symbol` → `simbolo_no_admitido`) | Casos propios sobre `DOCS@XNYS`: `exchange` **ausente**, `exchange: ''` y `exchange: null` → los tres rechazados con `simbolo_no_admitido`. Confirmado además el límite que el CA fija: una fila **con** sufijo en `symbol` (`DOCS.XNAS`) y sin `exchange` **sí** relaja — el mercado ahí es legible, es el respaldo que ya existía en SPEC-020 y el CA dice literalmente «sin `exchange` **y** sin sufijo». Conforme, pero documentado abajo | ✅ |
| CA-7 (el emparejado exacto manda; ningún pedido recibe dos precios) | `marketstack-provider.ts` — atribución en **dos pasos**: el paso 2 solo recorre `pedidos` (lo que quedó sin precio) y exige `candidatas.length === 1`; guarda `if (!pedidos.has(clave)) continue` en el paso 1 contra la fila duplicada | `market-provider-equivalent-markets.test.ts` › CA-7 (3 casos: fila que casa + fila que no → gana la que casa y **una sola** cotización; el mismo con las filas al revés; dos filas del grupo sin casar ninguna → **ninguna** se asigna) | Reproducidos los **dos órdenes de llegada** con caso propio: gana siempre la exacta (`25.63`, sin `providerMicCode`) y sale **una sola** cotización. Dos filas del grupo compitiendo sin casar → `quotes: []` y el ciclo no persiste **ninguna** fila en `quotes` (fallo seguro comprobado en BD). Añadidos dos vectores propios de doble asignación: fila del grupo + fila de fuera → solo cuenta la del grupo, **una** vez; y una fila `DOCS@XNAS` con **dos** pedidos (`DOCS@XNYS` pelado + `DOCS@BMEX` con sufijo) → se le cuelga **solo** al pelado, el otro falla. Estructuralmente: una fila reclamada en el paso 1 no entra en `huerfanas`, y dos pedidos que compartan cadena mueren en la condición (b), así que no hay vía para dos precios | ✅ |
| CA-8 (constancia observable de la etiqueta discrepante, sin tabla ni telemetría nuevas) | `provider.ts` — campo **opcional y aditivo** `ProviderQuote.providerMicCode`. `refresh.ts` — `MarketLabelMismatch` y `RefreshResult.mismatched`, que ya viaja entero al cuerpo del cron (`triggers/cycle.ts` sin tocar). Sin tabla, sin telemetría, sin usar `quote_diagnostics` y sin UI | `market-provider-equivalent-markets.test.ts` › CA-8 (3 casos: `mismatched` lleva ticker + mercado pedido + mercado del eco; viaja en `runCronCycle` con `skipped` vacío y **sin** diagnóstico para el usuario; cuando el eco casa, la lista queda vacía) | Tests verdes y revisado el diff: el campo es **aditivo y opcional** en `ProviderQuote`, y `RefreshResult.mismatched` viaja entero al cuerpo del cron por `cycle.ts`/`cron.ts` (no se tocaron). Sin tabla nueva, sin motivo nuevo en `QuoteFailureReason` y sin usar `quote_diagnostics` — al contrario: el diagnóstico se **limpia**. Comprobado que no se anota ruido: con eco que casa, `mismatched: []`; y con eco rechazado (`XETRA`), también `[]` — solo se anota lo efectivamente relajado. `tsc --noEmit` limpio pese a que `mismatched` es obligatorio en el tipo: el único constructor es `refreshQuotes` | ✅ |
| CA-9 (sin regresión; **un solo** test de SPEC-020 cambia de expectativa) | Sin código propio: `mic.ts`, `fail-reason-text.ts`, `quoteKey`, `QuoteFailureReason`, `ProviderFailure`, cartera, motor de disparo, avisos y UI **no se tocan** (`git status`: 3 ficheros de código) | Suite completa **211/211** en 28 ficheros. El **único** test con expectativa cambiada es `market-provider-dialect.test.ts` › CA-4 › «un eco con exchange XNYS … al pedido de XNAS» (el escenario que la spec deroga). Además `market-provider-equivalent-markets.test.ts` › CA-9 congela la tabla en **un** grupo `{XNAS, XNYS}` (ADR-014 pto. 6) | Gates propios: `npx vitest run` **211/211** en 28 ficheros · `npx tsc --noEmit` limpio · `npx eslint .` **0 errores** (1 warning preexistente y ajeno en `tests/position.test.ts`) · `npx playwright test` **17/17** (sin cambio de UI; capturas de `_qa/` restauradas a HEAD). Comprobación de derogación **medida, no creída**: ejecuté el adaptador nuevo y el de SPEC-020 (`git show HEAD:…`) en paralelo sobre una matriz de 25 escenarios (5 mercados pedidos × 5 ecos) y el diff de comportamiento es de **exactamente 2 celdas**, ambas el escenario derogado (`XNAS`←eco `XNYS` y `XNYS`←eco `XNAS`, cadena pelada, pedido único). `git status`: 3 ficheros de código, ninguno de UI/cartera/disparos/avisos | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-11, sdd-verificador. 9/9 CA cerrados.**

Esta spec **relaja un guardarraíl**, así que la verificación no buscó que funcionara sino
**si se había abierto más de lo autorizado**. La respuesta, medida y no razonada: **no**.

**Cómo se midió la apertura.** Ejecuté el adaptador nuevo y el de SPEC-020
(`git show HEAD:src/lib/market/marketstack-provider.ts`, cargado como fixture temporal)
**en paralelo** sobre una matriz de 25 escenarios (pedidos en `XNAS`/`XNYS`/`BMEX`/`XPAR`/
`XETR` × ecos `XNAS`/`XNYS`/`XETRA`/`BMEX`/ausente). El diff de comportamiento son
**exactamente 2 celdas**, y las dos son el escenario que la spec deroga:
`pedido XNAS ← eco XNYS` y `pedido XNYS ← eco XNAS`, con cadena pelada y pedido único.
Todo lo demás devuelve byte a byte lo mismo que antes.

**Los tres guardarraíles que había que atacar, con casos propios (no los suyos):**
- **CA-4 (sufijo)**: `ITX@BMEX` con eco **`XNYS`** —mercado *del* grupo, el caso que más
  tienta a colarse—, `SAP@XETR` con eco `XNAS`, `ASML@XAMS` con eco pelado: **los tres
  rechazados**. La condición (a) corta antes de mirar el grupo.
- **CA-5 (divisa)**: `DOCS@XNYS` contra **11 ecos de fuera del grupo** (`XETRA`, `XETR`,
  `XPAR`, `XAMS`, `BMEX`, `XLON`, `XSTO`, `XTSE`, `ARCX`, `BATS`, `IEXG`): **11 de 11
  rechazados**. En ciclo con eco `XETRA` sobre símbolo USD, `quotes` en BD queda **vacía**:
  cero euros persistidos como dólares.
- **CA-6 (eco ilegible)**: `exchange` ausente, `''` y `null` → rechazo en los tres.

**CA-3 (el caso que más daño haría)**: con `SAN@XNAS` + `SAN@XNYS` compitiendo por la misma
cadena, los cuatro ecos posibles se comportan estrictamente — el confirmado cobra, el otro
falla, y con eco de fuera del grupo o sin mercado **fallan los dos**. No se relaja nada en
ninguno de los dos sentidos.

**CA-2 verificado en BD, no en el retorno del adaptador**: tras `refreshQuotes`, el
`JOIN quotes×symbols` da **una** fila con `mic_code='XNYS'`, `exchange='NYSE'`, `25.63`,
`USD`; y la tabla `symbols` sigue conteniendo **solo** `XNYS`. El eco no toca la identidad.

**CA-7 en los dos órdenes de llegada** y con dos vectores propios de doble asignación
(fila del grupo + fila de fuera; una fila con dos pedidos, uno pelado y otro con sufijo):
nunca sale más de una cotización por pedido, y cuando dos filas compiten sin casar no se
asigna ninguna.

**Auditoría de F-SPEC-021-3 (hueco de cobertura): la afirmación es cierta.** El `describe`
CA-4 de `market-provider-dialect.test.ts` cubría un escenario que se descompone en cuatro
sub-casos, y los cuatro tienen dueño hoy: eco **dentro** del grupo → derogado a propósito
(y su nueva expectativa es la del comportamiento querido, no una aserción debilitada); eco
**fuera** del grupo → CA-5; eco **sin** mercado → CA-6; mercado **con sufijo** → CA-4. No
hay quinto caso, y verifiqué los tres vivos con casos propios además de los suyos. La
aserción colateral que aquel test protegía (`failReasonText('simbolo_no_admitido')` no
acusa de deslistado) **sigue en el test invertido**. Sin hueco.

**Auditoría de F-SPEC-021-4 (el guarda `if (!pedidos.has(clave)) continue`): matiz.**
Medido contra el código de SPEC-020, el guarda **sí** cambia el comportamiento en dos
escenarios, los dos exigiendo que el proveedor devuelva **dos filas para el mismo
(ticker, MIC)** —cosa que no ha hecho nunca y que ningún test existente ejercía—:
(i) dos filas idénticas → antes **2** cotizaciones, ahora **1** (es justo lo que CA-7
exige); (ii) fila de **error** seguida de fila con **precio** → antes cotización *y* fallo,
ahora **solo el fallo**. El caso (ii) no lo menciona el follow-up, que habla solo de filas
duplicadas. Los dos cambios van en dirección **fail-safe**, ninguno altera un test
existente y ninguno es alcanzable con el comportamiento observado del proveedor, así que
**no bloquea**; pero la etiqueta «no cambia comportamiento observable» es imprecisa para
(ii) y queda anotada aquí. Nota adicional: el orden inverso (precio y luego error) sigue
produciendo cotización **y** fallo, en el código viejo y en el nuevo — asimetría
**preexistente**, ajena a esta spec, no agravada por ella.

**F-SPEC-021-1 NO se marca como verificada, ni puede estarlo.** La unicidad de tickers
entre NYSE y Nasdaq y la homogeneidad de divisa son afirmaciones sobre el mundo exterior:
ningún test las alcanza y yo no las he comprobado contra ninguna fuente. Lo que **sí**
verifiqué es que **el código las respeta**: la tabla tiene exactamente un grupo, está
congelada por un test (CA-9), lleva escritos al lado la procedencia y el argumento (a)(b)(c)
como manda ADR-014 pto. 5, y las tres condiciones se comprueban **las tres** en el paso 2 —
ninguna es decorativa. El riesgo queda donde lo dejó el gate humano: **declarado y
aceptado**, con `F-ADR-014-1` (ratificación por sdd-mercados) abierto.

**Gates**: `vitest` 211/211 (28 ficheros) · `tsc --noEmit` limpio · `eslint .` 0 errores
(1 warning preexistente y ajeno en `tests/position.test.ts`) · `playwright` 17/17.
`next build` **no ejecutado**: falla en este worktree por ausencia de `.env`, preexistente y
ajeno (ya anotado en SPEC-020).

**Sin llamadas a la API real**: inspeccionadas las 50 construcciones de `MarketstackProvider`
de la suite — **todas** inyectan `fetch`; no hay ni una referencia a `globalThis.fetch`,
`api.marketstack` ni `process.env.MARKETSTACK_API_KEY` fuera del adaptador. Mis propios
tests adversariales también inyectaron `fetch` y se **borraron** al terminar; las capturas
de `_qa/` que la e2e reescribió se restauraron a HEAD. `git status` queda **idéntico** a
como lo dejó el implementador (3 ficheros de código + 1 test nuevo + 1 test derogado + los
3 documentos). Sin commit, sin push, sin desplegar.

**Observaciones menores, no bloqueantes** (ninguna toca un CA):
1. Un eco **sin** `exchange` pero **con** sufijo en `symbol` (`DOCS.XNAS`) sí cuenta como
   mercado legible y relaja. Es conforme al texto de CA-6 («sin `exchange` **y** sin
   sufijo») y reutiliza el respaldo que SPEC-020 ya tenía, pero conviene saberlo.
2. `SAN@BMEX` + `SAN@XNYS` **no** es cadena ambigua (`SAN.BMEX` ≠ `SAN`), así que el pedido
   pelado sí se relaja. Es exactamente lo que la regla dice —«la cadena corresponde a un
   único pedido»— y comprobé que el pedido de BMEX no se ve afectado ni recibe nada del eco
   US; lo anoto porque a primera vista parece el caso de CA-3 y no lo es.
3. El cuerpo de **ADR-014** conserva del borrador la frase «Pendiente de aprobación humana
   en el gate» (línea 11) mientras su frontmatter ya está `aprobada`. Incoherencia
   cosmética; y como un ADR aprobado es inmutable, se deja constancia en vez de tocarlo.

**Pendiente tras desplegar** (no verificable aquí, es observación en producción): que `DOCS`
cotice mostrando **NYSE**, que `WEN`/`TTD`/`PHM` no regresionen, y que `refresh.mismatched`
traiga **solo** `{DOCS, XNYS, XNAS}` — si apareciera con muchos tickers, el proveedor ha
cambiado de criterio y toca releer ADR-014.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-021/. Informe HTML opcional: _qa/SPEC-021/informe.html -->

**No aplica: esta spec no tiene superficie de UI.** Es detalle de adaptador; `git status`
confirma que no se tocó ni un fichero de UI, cartera, motor de disparo o avisos, y CA-8
exige explícitamente que al usuario **no se le muestre nada**. La evidencia de no-regresión
visual es la suite e2e completa (`npx playwright test` → **17/17**, incluidas
`diagnostico-cotizacion.spec.ts` de SPEC-016 y `ingesta-cartera.spec.ts` de SPEC-004). Las
capturas de `_qa/` que esa ejecución reescribe se **restauraron a HEAD**: no se añade ni se
modifica ninguna imagen por esta verificación.

## Salvedades / follow-ups
<!-- IDs F-SPEC-021-1, F-SPEC-021-2… con destino (spec futura o EPIC-MEJORA). -->

Abiertas en especificación (2026-08-11, sdd-arquitecto) — **no** descubiertas al implementar:

- **F-SPEC-021-1 (la asunción que sostiene toda la spec)** — la corrección **no se
  demuestra**, se **asume**: (a) `XNAS`/`XNYS` son los únicos mercados que este proveedor
  acepta pelados; (b) los dos son **USD**, luego RN-09 no se puede violar dentro del grupo;
  (c) los tickers son **únicos** entre NYSE y Nasdaq, luego la misma cadena no puede ser dos
  empresas. Las tres son afirmaciones sobre el mundo exterior y **ningún test las puede
  verificar**. Si (c) fuera falsa para algún ticker, el usuario recibiría un precio
  equivocado **sin motivo visible**. Destino: gate humano + ratificación por **sdd-mercados**
  (ver F-ADR-014-1).
- **F-SPEC-021-2 (ADR-014 en `borrador`)** — la spec abre una **excepción** a la cláusula
  de **ADR-012 pto. 4** ("valida que el `exchange` devuelto casa"). Como un ADR aceptado es
  inmutable y una spec no puede recortarlo en silencio, la excepción se registra en
  **ADR-014**, que debe aprobarse en el **mismo gate** que esta spec. Si el humano prefiere
  que la asunción viva solo en la spec, ADR-014 se descarta y se dice por qué.
- **Deroga un caso de SPEC-020 CA-4** (ver CA-9 y notas del gate): "eco de otro mercado →
  nunca el precio" pierde **solo** el escenario "cadena pelada + un único pedido + eco del
  mismo grupo". **SPEC-020 CA-5 queda intacta.** En la suite debe cambiar **exactamente un**
  test (`tests/market-provider-dialect.test.ts › CA-4`); si hiciera falta tocar otro, la
  regla está mal acotada y hay que volver a la spec.
  **Cerrada en implementación**: cambió **exactamente ese** test y ninguno más. No hizo
  falta tocar ni debilitar ninguna otra aserción de SPEC-015/016/020.

Añadidas en implementación (2026-08-11, sdd-implementador):

- **F-SPEC-021-3 (la derogación se lleva su describe entero)** — el `describe` «CA-4: eco
  de OTRO mercado» de `market-provider-dialect.test.ts` tenía **un solo** caso, y era justo
  el derogado. Al invertir su expectativa, **SPEC-020 CA-4 deja de tener test en su propio
  fichero**: su parte viva (mercados con sufijo, ecos fuera del grupo, ecos sin mercado)
  pasa a estar cubierta por `market-provider-equivalent-markets.test.ts` › CA-4/CA-5/CA-6.
  Es coherente con CA-9 de esta spec —que lista los CA de SPEC-020 que siguen en pie y
  **no** incluye su CA-4—, pero conviene saberlo al leer aquel fichero: se dejó comentario
  en el `describe` apuntando al nuevo. **No** se añadieron tests ahí para no tocar más de
  lo derogado. Destino: nota para el verificador; no requiere spec.
- **F-SPEC-021-4 (el paso 1 no era idempotente ante filas duplicadas)** — se añadió el
  guarda `if (!pedidos.has(clave)) continue` en el emparejado exacto: sin él, dos filas
  **idénticas** del proveedor para el mismo `(ticker, MIC)` producían **dos** cotizaciones
  para un mismo pedido, y CA-7 exige "una sola". Es un endurecimiento **preexistente y
  ajeno a la relajación** (venía de SPEC-020), descubierto al escribir CA-7. No cambia
  ningún comportamiento observado hasta hoy —el proveedor no ha duplicado filas— y no
  altera ningún test existente. Sin destino: cerrado aquí.
- **`RefreshResult` gana un campo obligatorio en el tipo** (`mismatched`, siempre presente,
  vacío por defecto). Ningún test hacía `toEqual` sobre el objeto entero, así que no rompió
  nada; pero cualquier consumidor externo que construya un `RefreshResult` a mano tendrá
  que añadirlo. Hoy solo lo construye `refreshQuotes`.
- **`next build` sigue fallando en este worktree** por ausencia de `.env`
  (`DATABASE_URL`/`AUTH_SECRET`). **Preexistente y ajeno** a esta spec (ya anotado en el
  ledger de SPEC-020); no se abre follow-up.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Gate humano superado (2026-08-11)**: spec `aprobada` y **ADR-014 `aprobada`** (la
asunción F-SPEC-021-1 se aceptó explícitamente). El ADR se renumeró de 013 a **014** porque
la rama `ft/SPEC-018` ya usaba el 013; **no queda ninguna referencia a "ADR-013"** en el
árbol (comprobado con `grep -rn` sobre todo el repo).

**Implementación completa (sdd-implementador, 2026-08-11)**, rama
`ft/SPEC-021-precio-de-cadena-inambigua-en-mercados-pelados`. Los 9 CA tienen código y test.
**Todo queda en el árbol de trabajo: SIN commit, SIN push y SIN desplegar** — igual que
SPEC-020, esas etapas se las reserva el humano.

Ficheros tocados (3 de código + 1 test nuevo + 1 test derogado):
- `src/lib/market/marketstack-provider.ts` — el grueso: tabla `EQUIVALENT_MARKET_GROUPS`
  (con procedencia del dato y el argumento de seguridad (a)(b)(c) escritos al lado, como
  manda ADR-014 pto. 5), `sameEquivalentGroup()`, y la atribución partida en **dos pasos**
  (exacto primero, relajación después, solo sobre lo que quedó sin precio).
- `src/lib/market/provider.ts` — `ProviderQuote.providerMicCode`, **opcional y aditivo**:
  el fake y cualquier otro adaptador siguen valiendo sin tocarse.
- `src/lib/market/refresh.ts` — `MarketLabelMismatch` y `RefreshResult.mismatched` (CA-8).
  El emparejado por `quoteKey`, la divisa del símbolo, el diagnóstico y el `try/catch` de
  SPEC-020 CA-9 **no cambian**.
- `tests/market-provider-equivalent-markets.test.ts` — **nuevo**, 18 casos, CA-1..CA-9.
- `tests/market-provider-dialect.test.ts` — **una sola** expectativa invertida (la del
  escenario derogado, ver F-SPEC-021-3).
- `src/lib/market/mic.ts`, `fail-reason-text.ts`, cartera, motor de disparo, avisos y UI:
  **sin tocar**, como manda la spec. **Ningún motivo nuevo** en el vocabulario.

Gates ejecutados por el implementador (la verificación adversarial es del verificador):
`npx vitest run` → **211/211** en 28 ficheros · `npx tsc --noEmit` → limpio ·
`npx eslint .` → **0 errores** (1 warning preexistente y ajeno en `tests/position.test.ts`)
· `npx playwright test` → **17/17**. `npx next build` **no** se ejecutó: falla en este
worktree por falta de `.env`, preexistente y ajeno.

**Ningún test llama a la API real de Marketstack**: todos usan `fetch` inyectado o fakes.
No se ha gastado ni una llamada del free tier (~85 restantes). Las capturas de `_qa/` que la
e2e reescribe se restauraron con `git checkout -- _qa/`: el árbol solo tiene los ficheros de
esta spec.

Pendiente para la siguiente sesión:
1. **sdd-verificador** sobre esta rama.
2. Tras desplegar, el síntoma a comprobar en producción es **DOCS**: debe cotizar, con su
   mercado mostrado como **NYSE** (no NASDAQ), y `WEN`/`TTD`/`PHM` no deben regresionar.
   En el cuerpo del cron debe aparecer `refresh.mismatched` con
   `{ticker:"DOCS", requestedMicCode:"XNYS", providerMicCode:"XNAS"}` — si apareciera con
   muchos más tickers, es que el proveedor ha cambiado de criterio y toca releer ADR-014.
3. **F-SPEC-020-5** (el P/L resuelve el precio por ticker, no por `(ticker, MIC)`) sigue
   abierto y fuera de alcance: esta spec no lo agrava (una sola cotización por símbolo, con
   el MIC del pedido) pero tampoco lo cierra.
4. **F-ADR-014-1**: pasar la asunción (c) —unicidad de tickers entre NYSE y Nasdaq— por
   **sdd-mercados** para que la ratifique con fuente. Ningún test puede verificarla.
