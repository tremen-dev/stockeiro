---
id: SPEC-025
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
# SPEC-025 — Cartera: vender, dividir y cobrar dividendo sobre la posición del mercado correcto

## Problema

La cartera **identifica la posición por ticker**, no por la identidad canónica del símbolo. Es
el mismo defecto de identidad que SPEC-024 cerró en `/vigiladas` (defecto B), en la otra
pantalla y con otro precio: allí se perdía una fila de lista, aquí se falsea **dinero**.

**La identidad del símbolo es `(ticker, mic_code)`** (**ADR-007** punto 1;
`docs/fundacion/dominio.md`, entrada *Símbolo*), y el caso de un mismo ticker en dos mercados
**no es hipotético**: **ADR-012** lo documenta con medición propia contra la API real —`SAN` a
11,984 € en BME y `SAN` a ~13,63 USD en NYSE, el mismo valor en dos mercados y dos divisas—.

A diferencia del 500 de SPEC-024, **este fallo es mudo**: no hay excepción, ni pantalla de
error, ni traza. Solo números mal. Es exactamente el modo de fallo que **CE-F2** persigue y el
que **R-F4** identifica como peor que el bug ruidoso.

Hay **dos caminos rotos**, con la misma raíz y distinto disparador.

### Defecto A — la operación se escribe contra la posición equivocada

`recordSell`, `recordSplit` y `recordDividend` (`src/lib/portfolio/service.ts:98,127,144`)
resuelven el símbolo con **`getSymbolByTicker`** (`src/lib/portfolio/symbols.ts:28-31`), que
consulta `where(symbols.ticker = ...)` con **`.limit(1)` y sin `ORDER BY`**: devuelve *una*
coincidencia cualquiera. Su propio comentario ya se llama a sí mismo "camino legacy".

La firma no admite el mercado (`recordSell(db, userId, ticker, input)`), así que **el usuario
no tiene forma de expresar cuál de sus dos posiciones está vendiendo**, ni la tiene la UI: el
formulario de venta es un **campo de texto libre** (`src/app/cartera/portfolio-forms.tsx:67`)
cuyo comentario dice, precisamente, que "la divisa y el mercado ya están fijados por la
compra" — lo que deja de ser cierto en cuanto hay dos.

Consecuencias medidas (ver reproducción):

- La venta cae en el símbolo que gane el `limit(1)` — que depende del **orden físico de las
  filas**, no de ninguna regla. Una posición queda mutilada y la otra intacta.
- **RN-09 (divisa única por posición)** se rompe: un precio de venta en USD se contabiliza
  dentro de una posición en EUR. El P/L realizado resultante no es una magnitud de nada.
- **RN-08 (no sobreventa)** se evalúa contra la posición equivocada, y falla **en los dos
  sentidos**: rechaza una venta legítima ("no puedes vender más de lo que tienes" cuando sí lo
  tiene) y **acepta una venta imposible** saltándose el control.
- **RN-07** (split) y **RN-05** (dividendo) ajustan la posición que no es.

### Defecto B — el P/L actual usa el precio del otro mercado, sin que el usuario haga nada

El mismo error de clave está en el camino de **lectura**, y este ni siquiera necesita que el
usuario opere: basta con abrir `/cartera`.

- `getPriceMap` (`src/lib/market/quotes.ts:66-71`) construye un `Record<ticker, precio>`. Dos
  símbolos del mismo ticker producen **una sola clave**: gana el último y **las dos posiciones
  reciben el mismo precio**.
- `rawPositions` (`src/lib/portfolio/service.ts:195`) agrupa correctamente por `symbolId` pero
  después busca el precio con `priceByTicker[ticker]`. El acierto se pierde en la última línea.
- `getDiagnosticMap` (`quotes.ts:104-114`) tiene el mismo colapso: el motivo de "sin cotización"
  que ve el usuario puede ser el **del otro mercado** (**CE-F2**: el "por qué" es falso).
- `src/app/cartera/page.tsx:71` renderiza `key={p.ticker}`: con dos posiciones del mismo ticker,
  **claves de React duplicadas**.

Esto rompe **RN-06** directamente: el P/L actual deja de ser
`(precio de mercado − precio medio) × cantidad viva` para ser *(precio de otro mercado − …)*.
Y lo hace en la pantalla que **CE-3** de EPIC-001 promete.

### Reproducción (2026-08-17, PGlite, worktree `fix-quitar-vigilada-en-zona`)

Fichero **scratch** `tests/repro-cartera-identidad.test.ts`, ejecutado con
`npx vitest run tests/repro-cartera-identidad.test.ts` → **8/8 escenarios reproducen el
defecto**. Escenario base: `userA` compra 100 `SAN`@`BMEX` a 10 EUR y 100 `SAN`@`XNYS` a 13 USD
(dos símbolos distintos, verificado con `getSymbolByMarket`).

| # | Qué se pide | Qué pasa hoy |
|---|---|---|
| R1 | Vender 50 de la posición de **NYSE** | Se escribe contra **BMEX**. BME queda en 50 (debía seguir en 100), NYSE en 100 (debía bajar a 50). `realizadoPL` de la posición **EUR** = `200.00`, calculado con un precio en **USD** (RN-09). |
| R2 | Vender 50 teniendo 5 en BME y 100 en NYSE | **`OversellError`**: rechaza una venta perfectamente legítima. |
| R3 | Vender 50 teniendo 100 en BME y 5 en NYSE | **Se acepta**: el control de RN-08 se valida contra la posición que no es. |
| R4 | Split 2:1 | Se aplica a BMEX: 100→200; NYSE se queda en 100 (RN-07). |
| R5 | Dividendo de 60 | Se suma al realizado de BMEX; NYSE queda a 0 (RN-05). |
| R6 | Idem R1 pero creando **antes** el símbolo de NYSE | Ahora gana **NYSE**. El "ganador" es el orden de las filas: **azar, no identidad**. |
| R7 | Solo **abrir** `/cartera` con cotización en los dos mercados | `getPriceMap` devuelve `{ SAN: '13.63' }`. P/L actual: EUR = **363,00** (lo correcto con 11,98 es **198,00**, error de **165 €**), USD = 63,00. Sin operar, sin avisar. |
| R8 | Control | Hay 2 símbolos `SAN` y 2 transacciones: el modelo de datos está bien; lo que falla es la resolución. |

**Hipótesis confirmada, y ampliada**: el defecto registrado en F-SPEC-024-2 (camino de
escritura) es real, y la investigación destapó que el **camino de lectura** está roto por la
misma causa y con **mayor superficie de exposición** (no requiere ninguna acción del usuario).

**Comprobado y descartado**: el **import de extracto** (SPEC-012/013) **NO está afectado**.
`confirmarImport` (`src/lib/import/register.ts:196-210`) escribe las transacciones con el
`symbolId` ya resuelto por `symbol_aliases` (`src/lib/import/identity.ts`), sin pasar por
`recordSell` ni por `getSymbolByTicker`. La identidad del import ya es correcta (ADR-009).

### Encaje en la épica

`/cartera` (SPEC-002, `hecho` y verificada, 11/11 CA) no cumple su promesa con datos reales en
cuanto el usuario tiene el mismo ticker en dos mercados —caso normal en la cartera real del
usuario, mayoritariamente española más posiciones en mercados extranjeros (`_epica.md`)—. Es
literalmente **CE-F1**, y el fallo es silencioso, que es **CE-F2**. Sin coste (**CE-F3**): no
hay cambio de proveedor, ni de esquema, ni de plan.

## Usuarios / roles afectados

- **Usuario final con el mismo valor en dos mercados** (p. ej. `SAN` en BME y su ADR en NYSE,
  o cualquier valor con doble cotización). Hoy: no puede vender la posición que quiere —no hay
  manera de decirlo—, y el P/L actual que ve en pantalla puede estar calculado con el precio
  del otro mercado y otra divisa. Necesita **elegir sobre qué posición opera** y que **cada
  posición se valore con su propio precio**.
- **Cualquier usuario, de rebote**: el defecto B no exige tener dos mercados para existir en el
  código, pero solo se manifiesta cuando los hay. Con un único mercado por ticker el
  comportamiento actual es correcto y **debe seguir siéndolo** (CA-11).

## Criterios de aceptación

Cada CA es verificable con un test. **CA-1..CA-7 y CA-9..CA-12** son de servicio (Vitest sobre
PGlite: `tests/portfolio-service.test.ts` y `tests/market-quotes-pl.test.ts`); **CA-8** es e2e
(Playwright, `tests/e2e/cartera.spec.ts`); **CA-11** es de regresión sobre suites existentes.
Escenario común de dos mercados: `SAN`@`BMEX` (EUR) y `SAN`@`XNYS` (USD), como en
`tests/symbol-identity.test.ts`.

### Defecto A — se opera sobre la posición que el usuario ha elegido

- **CA-1 (La venta cae en la posición señalada).**
  Dado un usuario con **dos posiciones del mismo ticker en distinto mercado** (100 `SAN`@BMEX
  a 10 EUR y 100 `SAN`@XNYS a 13 USD),
  cuando registra una venta de 50 identificando la posición por el **`symbolId` de XNYS**,
  entonces la transacción creada tiene `symbolId` = el de **XNYS**, la posición de XNYS baja a
  50 con su P/L realizado en **USD**, y la de BMEX **sigue intacta** en 100 con realizado 0
  (RN-05, RN-09).
  *Este CA falla con la implementación actual* (reproducción R1): es el test que fija el defecto A.

- **CA-2 (RN-08 se evalúa contra la posición correcta — no rechaza lo legítimo).**
  Dado un usuario con 5 `SAN`@BMEX y 100 `SAN`@XNYS,
  cuando vende 50 sobre el `symbolId` de **XNYS**,
  entonces la venta **se registra sin error** (tiene 100), y la cantidad viva de BMEX no cambia.
  *Hoy lanza `OversellError`* (R2).

- **CA-3 (RN-08 se evalúa contra la posición correcta — sí rechaza lo imposible).**
  Dado un usuario con 100 `SAN`@BMEX y 5 `SAN`@XNYS,
  cuando intenta vender 50 sobre el `symbolId` de **XNYS**,
  entonces se rechaza con **`OversellError`** y **no se inserta ninguna transacción**
  (**RN-08**), sin que la posición de BMEX intervenga en la decisión.
  *Hoy la venta se acepta* (R3).

- **CA-4 (El split ajusta la posición señalada).**
  Dado el escenario de dos mercados con 100 acciones en cada uno,
  cuando se registra un split de ratio 2 sobre el `symbolId` de **XNYS**,
  entonces la cantidad viva de XNYS pasa a 200 y su precio medio se divide por 2, y la de
  **BMEX no cambia** (**RN-07**). *Hoy se aplica al mercado equivocado* (R4).

- **CA-5 (El dividendo se cobra en la posición señalada).**
  Dado el mismo escenario,
  cuando se registra un dividendo de 60 sobre el `symbolId` de **XNYS**,
  entonces se suma al P/L realizado de **XNYS** sin alterar su coste base ni su cantidad, y el
  realizado de BMEX sigue a 0 (**RN-05**). *Hoy se cobra en el mercado equivocado* (R5).

- **CA-6 (RN-01: un `symbolId` sobre el que el usuario no tiene posición no escribe nada).**
  Dado el usuario B con una posición en `SAN`@BMEX y el usuario A **sin** posición en ese
  símbolo,
  cuando A intenta vender / dividir / cobrar dividendo pasando el `symbolId` **real** de ese
  símbolo (llegado por manipulación del formulario, no por la UI),
  entonces las tres operaciones fallan con **`NoPositionError`**, **no se inserta ninguna
  transacción**, y la posición de **B queda intacta** (**RN-01**, D-5).
  **Requisito de diseño, verificable en el test**: la posición sobre la que se decide se deriva
  con el `userId` **dentro** de la consulta (`ownedEntries(db, userId, symbolId)`), no en una
  comprobación previa que un refactor pueda saltarse — mismo criterio que SPEC-024 CA-11.
  *Nota*: el `symbolId` **no es un secreto** — el registro de símbolos es compartido entre
  usuarios (ADR-002) —, así que aquí el aislamiento protege la **escritura**, no la existencia
  del identificador.

- **CA-7 (Símbolo legacy sin `micCode`: sigue funcionando).**
  Dada una posición creada por el camino legacy (`recordBuy` sin `market`, símbolo con
  `micCode` **NULL**, como las de SPEC-002 y las que hay hoy en producción),
  cuando el usuario vende, divide o cobra dividendo sobre ella,
  entonces la operación se registra correctamente sobre ese símbolo. Identificar por
  `symbolId` **no depende de que el `micCode` esté informado** — es justamente por eso que se
  elige el `id` y no el par `(ticker, micCode)` (**ADR-007**).

- **CA-8 (La UI deja elegir la posición y manda su identidad, extremo a extremo).**
  Dado un usuario autenticado en `/cartera` con **dos posiciones del mismo ticker en mercados
  distintos** (sembradas como en `tests/e2e/ingesta-cartera.spec.ts`),
  cuando abre el formulario "Registrar venta", **elige una de las dos posiciones de forma
  distinguible** (la opción muestra ticker + mercado/divisa, no dos etiquetas idénticas) y
  registra la venta,
  entonces la cantidad viva y el P/L realizado que cambian son **los de la posición elegida**,
  la otra fila no se mueve, y no hay pantalla de error. Cierra la cadena completa
  `portfolio-forms.tsx → addSellAction → recordSell`: si la UI siguiera mandando un ticker,
  este CA falla aunque el servicio sea correcto.

### Defecto B — cada posición se valora con el precio de su propio mercado

- **CA-9 (El P/L actual usa el precio del mercado de la posición).**
  Dado un usuario con 100 `SAN`@BMEX a 10 EUR y 100 `SAN`@XNYS a 13 USD, y **una cotización por
  símbolo** (11,98 para BMEX y 13,63 para XNYS),
  cuando se consulta la cartera,
  entonces el P/L actual de la posición de BMEX es **198,00** (= (11,98 − 10) × 100) y el de
  XNYS es **63,00** (= (13,63 − 13) × 100) — cada uno con **su** precio (**RN-06**).
  *Hoy la de BMEX da 363,00, un error de 165 €* (R7).

- **CA-10 (El motivo de "sin cotización" es el del símbolo que no cotiza).**
  Dados dos símbolos del mismo ticker donde **solo uno** tiene diagnóstico registrado
  (SPEC-016),
  cuando se consulta la cartera,
  entonces el aviso ⚠ con su motivo aparece **solo** junto a la posición de ese símbolo, y la
  otra no muestra motivo alguno. Un motivo verdadero en la fila equivocada es un fallo
  silencioso disfrazado de transparencia (**CE-F2**).

- **CA-11 (Sin regresión: un solo mercado por ticker se comporta igual que hoy).**
  Dadas las suites existentes de SPEC-002 (`tests/portfolio-service.test.ts`), SPEC-004
  (`tests/market-quotes-pl.test.ts`, `tests/market-refresh.test.ts`), SPEC-016
  (`tests/quote-diagnostics.test.ts`) y del import (`tests/import-*.test.ts`),
  cuando se aplica el cambio,
  entonces **todas pasan sin cambiar sus expectativas**: solo se adaptan las **llamadas** cuya
  firma cambia (pasar `symbolId` en vez de ticker, y `priceBySymbolId` en vez de
  `priceByTicker`). Cualquier cambio de un valor **esperado** en esas suites es señal de que el
  arreglo ha movido algo que no debía.

- **CA-12 (No queda ningún camino que resuelva la posición por ticker).**
  Dado el árbol `src/` tras el cambio,
  cuando se busca `getSymbolByTicker`,
  entonces **no aparece ningún uso**, y la función se ha **eliminado** de
  `src/lib/portfolio/symbols.ts`. Era el "camino legacy" que SPEC-024 dejó vivo *para la
  cartera*; cerrada la cartera, no le queda cliente y dejarla es dejar la trampa armada para el
  próximo. `getSymbolByMarket` y `getOrCreateSymbol` (identidad completa) se conservan.

## Entidades y reglas afectadas

**Ningún cambio de esquema.** La clave que hace falta (`symbols.id`, `transactions.symbol_id`)
ya existe, ya es la que agrupa las posiciones y ya llega hasta la página. Es **cableado**: se
deja de tirar la identidad correcta a mitad de camino. Sin migración ⇒ **abrir el PR no toca
producción** (a diferencia de SPEC-024).

### Camino de escritura (defecto A)

- **`src/lib/portfolio/service.ts:92,120,137`** — `recordSell`, `recordSplit` y
  `recordDividend` pasan de recibir `ticker: string` a recibir **`symbolId: string`**. Derivan
  la posición con `ownedEntries(db, userId, symbolId)` —que **ya filtra por `userId`**, CA-6— y
  lanzan **`NoPositionError`** cuando el usuario no tiene ledger sobre ese símbolo (hoy esa
  excepción solo salta si el símbolo no existe en absoluto). Dejan de importar
  `getSymbolByTicker`.
  - `NoPositionError` sigue siendo un error **legible**: `addSellAction` ya traduce a
    *"No tienes posición en ese valor."* y ese texto no cambia.
  - `recordBuy` **no se toca**: ya recibe el `market` del buscador (SPEC-008/ADR-007) y crea el
    símbolo con su identidad. Es el único de los cuatro que estaba bien.
- **`PositionView`** (`service.ts:153-162`) gana **`symbolId`** y la identidad de mercado
  (`micCode`, `exchange`) que ya está en la fila de `symbols` y que `rawPositions` descarta hoy.
  Sin eso la UI no puede ni identificar la posición ni presentarla de forma distinguible (CA-8).
- **`src/app/cartera/portfolio-forms.tsx:60-76`** — `SellForm` deja de ser un **campo de texto
  libre** y pasa a ofrecer las posiciones del usuario para elegir una
  (`<select name="symbolId">` o equivalente), etiquetadas de forma distinguible
  (ticker + mercado/divisa). Requisitos de diseño: **solo posiciones con cantidad viva > 0**
  (vender una posición cerrada es sobreventa por definición) y, **sin posiciones**, el
  formulario lo dice en vez de ofrecer un selector vacío. La lista sale de
  `summary.positions`, que la página ya tiene: **no hay consulta nueva**.
- **`src/app/cartera/actions.ts:55-75`** — `addSellAction` lee `symbolId` en vez de `ticker`;
  mantiene la guarda de campo vacío (mensaje del tipo *"Elige la posición que vendes."*) y el
  `revalidatePath('/cartera')`. El `readCommon` deja de leer `ticker` para la venta.
- **`recordSplit`/`recordDividend` no tienen ningún llamador en `src/`** (solo tests): son API
  latente. Se corrigen igual —heredarían el defecto en cuanto alguien les ponga UI— pero
  **esta spec no les añade pantalla** (ver *Fuera de alcance*).

### Camino de lectura (defecto B)

- **`src/lib/market/quotes.ts`** — `QuoteView` gana `symbolId`; **`getPriceMap` devuelve
  `Record<symbolId, precio>`** y **`getDiagnosticMap` devuelve `Record<symbolId, DiagnosticView>`**.
  Los datos ya se guardan por `symbolId` (`quotes.symbolId`, `quote_diagnostics.symbolId`,
  ADR-004/SPEC-016): el colapso lo introducía el mapa, no la persistencia.
- **`src/lib/portfolio/service.ts:172-199`** — `rawPositions` busca el precio con
  `priceBySymbolId[sym.id]`, no con el ticker. Los parámetros `priceByTicker` de `listPositions`
  y `portfolioSummary` se renombran a **`priceBySymbolId`** (identificadores en inglés).
- **`src/app/cartera/page.tsx:70-89`** — `key={p.symbolId}` en vez de `key={p.ticker}` (claves
  de React duplicadas con dos mercados) y `diagnosticos[p.symbolId]`.
- **`getQuoteByTicker`** (`quotes.ts:57`) queda solo con uso en tests y arrastra la misma
  ambigüedad (`[row]` sobre varias filas). Esta spec **no la usa ni la cambia**; se registra
  como **F-SPEC-025-3**.

### Tests a adaptar (adaptación de llamada, no de expectativa — CA-11)

`tests/portfolio-service.test.ts` (`recordSell`, `portfolioSummary({ITX: 110})`),
`tests/market-quotes-pl.test.ts` (`recordSplit`, `getPriceMap`),
`tests/quote-diagnostics.test.ts` y `tests/market-provider-*.test.ts` (`getDiagnosticMap`
indexado por ticker: `.ITX`, `.AAPL`, `.DOCS`, `.ERIC_B`),
`tests/e2e/cartera.spec.ts:56,68` (el `input[name="ticker"]` de la venta pasa a selector).

### Transversal

- Reglas: **RN-05, RN-06, RN-07, RN-08, RN-09** (las que el defecto falsea) y **RN-01**
  (aislamiento, CA-6). Decisiones: **ADR-007** (identidad del símbolo, que este defecto
  incumple), **ADR-012** (caso real de doble mercado), **ADR-002** (símbolo compartido),
  **ADR-003** (ledger), **ADR-004** (una cotización por símbolo), **ADR-009** (identidad del
  import, no afectada). Términos: `docs/fundacion/dominio.md` — *Símbolo*, *Posición*,
  *Cantidad*, *Precio medio de compra*, *Venta parcial*, *Split*, *Dividendo*, *P/L actual*,
  *P/L realizado*.
- **No hace falta ADR nuevo.** Igual que el defecto B de SPEC-024, esto **no decide nada**:
  aplica lo que **ADR-007** ya decidió. La única elección con sabor a decisión —identificar por
  **`symbolId`** en vez de por el par `(ticker, micCode)`— está forzada por CA-7: hay símbolos
  legacy con `micCode` NULL y el par no los identifica. Queda razonada aquí y consistente con
  SPEC-024 (que también eligió el `id`).
- **Test de regresión permanente**: los escenarios del bug pasan a
  `tests/portfolio-service.test.ts` (CA-1..CA-7) y `tests/market-quotes-pl.test.ts` (CA-9/CA-10).
  El fichero de investigación **`tests/repro-cartera-identidad.test.ts` es un scratch y se
  borra** en esta spec: no se queda ni renombrado (mismo criterio que SPEC-024 con
  `tests/repro-unwatch-en-zona.test.ts`).

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Mostrar el mercado/divisa en la tabla de posiciones de `/cartera`.** Resuelto el defecto,
  las cifras son correctas, pero el usuario **sigue viendo dos filas "SAN"** que solo distingue
  por los números (la tabla no tiene columna de divisa ni de mercado). Es presentación, no
  corrección. El **selector de venta sí lo lleva** porque ahí la distinción es load-bearing
  (CA-8). → **F-SPEC-025-1** (EPIC-MEJORA), hermano de **F-SPEC-024-1** para `/vigiladas`: mismo
  arreglo, misma épica, conviene hacerlos juntos.
- **Los totales de la cabecera suman divisas distintas.** `portfolioSummary` agrega
  `realizadoTotal` y `actualTotal` sobre **todas** las posiciones sin mirar la divisa: una
  cartera con EUR y USD muestra una cifra que no es ni euros ni dólares (roza **RN-09** y la
  exclusión de multi-moneda de FOUNDATION). Es un **defecto preexistente e independiente** —
  existe desde SPEC-002, con un solo mercado por ticker, y no lo causa ni lo agrava esta spec.
  Arreglarlo exige decidir *qué* se muestra (totales por divisa, conversión, o nada), o sea
  producto. → **F-SPEC-025-2** (EPIC-FIX, spec propia).
- **UI para registrar splits y dividendos.** `recordSplit`/`recordDividend` se corrigen pero
  siguen sin pantalla (hoy son API latente). Darles UI es funcionalidad nueva → sdd-producto.
- **`getQuoteByTicker`**: se queda como está, con su ambigüedad y su único uso en tests. →
  **F-SPEC-025-3** (higiene).
- **El import de extracto** (SPEC-012/013): **verificado no afectado**. No se toca ni se
  "refuerza por si acaso".
- **El buscador de la compra** (`SymbolSearch`, SPEC-008): ya resuelve la identidad bien.
- **RLS / aislamiento en base de datos**: sigue en capa de app (F-SPEC-001-1).
- **Reconciliación de posiciones ya contaminadas.** Si en producción hay ventas, splits o
  dividendos ya escritos contra el símbolo equivocado, esta spec **no los corrige**: arregla el
  código para que no vuelva a pasar. Ver nota 6 del gate.

## Notas para el gate humano

1. **El defecto es real y está reproducido.** 8/8 escenarios en
   `tests/repro-cartera-identidad.test.ts` (PGlite), con la tabla del apartado *Reproducción*.
   No es un fantasma y no hace falta creerse nada: `npx vitest run tests/repro-cartera-identidad.test.ts`.

2. **Esto es más grande de lo que decía F-SPEC-024-2, y necesito que lo decidas.** El follow-up
   registraba solo `recordSell`/`recordSplit`/`recordDividend` (escritura). Al reproducirlo
   apareció que **el camino de lectura tiene el mismo defecto y una superficie mayor**: abrir
   `/cartera` ya muestra un P/L actual falso —**165 € de error** en el escenario medido— sin que
   el usuario haga nada. Lo he metido como **defecto B (CA-9/CA-10)** porque comparte causa,
   fichero y regla, y porque arreglar solo la escritura dejaría el dinero mal en pantalla, que
   es exactamente el "arreglo a medias peor que el bug" de **R-F4**. **Si prefieres partirlo**,
   CA-9..CA-10 salen limpiamente a una SPEC-026 — dilo y lo reescribo. Mi recomendación es
   dejarlo junto.

3. **Buena noticia: el import NO está afectado.** Lo verifiqué expresamente porque lo pedías:
   `confirmarImport` escribe con el `symbolId` ya resuelto por `symbol_aliases`, sin pasar por
   `getSymbolByTicker`. El alcance **no** se estira hacia SPEC-012/013.

4. **Cambio de UX visible: el formulario de venta deja de ser un campo de texto.** Hoy escribes
   "AAPL"; mañana eliges tu posición en una lista. Es la **única forma** de expresar sobre qué
   mercado vendes —no existe otro dato que lo diga— y de paso mata la clase entera de errores de
   tecleo. Pero es un cambio que verás, así que lo digo en vez de colarlo: **confírmalo**.

5. **`getSymbolByTicker` se elimina (CA-12).** SPEC-024 la dejó viva argumentando "camino legacy
   de cartera"; cerrada la cartera, se queda sin un solo cliente. Dejarla es dejar armada la
   trampa para el siguiente que necesite "buscar un símbolo rápido". Si prefieres conservarla
   marcada como `@deprecated`, dilo — pero entonces CA-12 se queda solo con la mitad verificable.

6. **Datos ya contaminados en producción: no los toco, y hay que decidir si importa.** Si en tu
   cartera real ya hay una venta, un split o un dividendo escritos contra el mercado equivocado,
   este arreglo **no los mueve**: a partir del despliegue las operaciones nuevas caen bien, las
   viejas siguen donde están. Como el defecto solo se manifiesta con **el mismo ticker en dos
   mercados**, lo más probable es que no haya ninguna — pero es una comprobación que solo puedes
   hacer tú sobre tus datos. Si aparece alguna, es una corrección manual, y la registro como
   follow-up de despliegue.

7. **Sin cambio de esquema: abrir el PR no migra producción.** A diferencia de SPEC-024, aquí no
   hay `ALTER TABLE` ni migración drizzle. El riesgo de despliegue es el normal de un cambio de
   código, y **F-SPEC-023-1** (la `DATABASE_URL` compartida entre Production y Preview) **no
   aplica** a esta spec.

8. **Sin ADR nuevo, y con motivo.** Esta spec no decide nada: cumple **ADR-007**, igual que el
   defecto B de SPEC-024 (que tampoco llevó ADR). La única elección discutible —identificar por
   `symbolId` y no por `(ticker, micCode)`— está forzada por los símbolos legacy con `micCode`
   NULL (CA-7) y queda razonada en el cuerpo. Si aun así lo quieres registrado, es un ADR de
   tres líneas; dilo.

9. **Tres follow-ups nuevos, todos fuera de alcance a propósito**: **F-SPEC-025-1** (la tabla de
   `/cartera` no muestra el mercado — presentación, EPIC-MEJORA, hermano de F-SPEC-024-1),
   **F-SPEC-025-2** (los totales suman EUR con USD — defecto **preexistente e independiente**,
   ya existía con un solo mercado; spec propia en EPIC-FIX) y **F-SPEC-025-3**
   (`getQuoteByTicker` mantiene la ambigüedad, higiene). El segundo lo encontré de camino y me
   parece el más relevante de los tres.

10. **Confirma que el scratch se va**: `tests/repro-cartera-identidad.test.ts` se borra y sus
    escenarios viven a partir de ahora en `tests/portfolio-service.test.ts` y
    `tests/market-quotes-pl.test.ts`.

---
*Historial de la spec: redactada el 2026-08-17 a partir del follow-up **F-SPEC-024-2** del
ledger de SPEC-024, tras reproducir el defecto contra PGlite. Sigue en `borrador`.*
