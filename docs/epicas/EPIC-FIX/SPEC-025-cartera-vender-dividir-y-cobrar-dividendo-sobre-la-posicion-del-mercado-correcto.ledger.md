---
id: SPEC-025
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-025 Cartera: vender, dividir y cobrar dividendo sobre la posicion del mercado correcto

## Resumen
- Fase: **en-revisión** (implementación completa, esperando al verificador)
- Rama: `ft/SPEC-025-cartera-vender-dividir-y-cobrar-dividendo-sobre-la-posicion-del-mercado-correcto`
- Commits: `28ee4d1` (RED de los 11 CA testables) · `b3d17aa` (arreglo: identidad por
  `symbolId` en escritura y lectura, selector de venta, `getSymbolByTicker` eliminada)
- **Sin cambio de esquema y sin migración**: es cableado. La clave (`symbols.id`,
  `transactions.symbol_id`) ya existía y ya agrupaba las posiciones; se dejaba de usar a
  mitad de camino.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (venta en la posición señalada) | `src/lib/portfolio/service.ts` — `recordSell(db, userId, symbolId, input)` + `positionOf` | `tests/portfolio-service.test.ts` › *SPEC-025 CA-1: la venta cae en la posición señalada* | verde en `npx vitest run tests/portfolio-service.test.ts`; **muta a rojo** con MUT-A (resolución por ticker con `limit(1)`) → `expected '<uuid-bmex>' to be '<uuid-xnys>'`. Aserciones de valor exacto: `50`/`USD`/`50.00` en XNYS y `100`/`0.00` en BMEX (RN-09) | ✅ |
| CA-2 (RN-08 no rechaza lo legítimo) | idem CA-1 (RN-08 se evalúa sobre `ownedEntries(db, userId, symbolId)`) | `tests/portfolio-service.test.ts` › *SPEC-025 CA-2: RN-08 no rechaza una venta legítima de la otra posición* | verde; **muta a rojo** con MUT-A → `promise resolved instead of rejecting`… (se registra donde no toca). Sentido "rechaza lo legítimo" de RN-08 cubierto | ✅ |
| CA-3 (RN-08 sí rechaza lo imposible) | idem CA-1 | `tests/portfolio-service.test.ts` › *SPEC-025 CA-3: RN-08 sí rechaza la venta imposible de esa posición* | verde; **muta a rojo** con MUT-A. Sentido inverso de RN-08 cubierto, con `sells` a 0 filas (no solo la excepción) | ✅ |
| CA-4 (split en la posición señalada) | `src/lib/portfolio/service.ts` — `recordSplit(db, userId, symbolId, ratio, occurredOn)` | `tests/portfolio-service.test.ts` › *SPEC-025 CA-4: el split ajusta la posición señalada (RN-07)* | verde; **muta a rojo** con MUT-A. Valores exactos `200`/`6.50` (XNYS) y `100`/`10.00` (BMEX) — RN-07 con coste total intacto | ✅ |
| CA-5 (dividendo en la posición señalada) | `src/lib/portfolio/service.ts` — `recordDividend(db, userId, symbolId, amount, occurredOn)` | `tests/portfolio-service.test.ts` › *SPEC-025 CA-5: el dividendo se cobra en la posición señalada (RN-05)* | verde; **muta a rojo** con MUT-A. Comprueba además que no altera cantidad (`100`) ni coste base (`13.00`), RN-05 | ✅ |
| CA-6 (RN-01: symbolId sin posición no escribe) | `src/lib/portfolio/service.ts` — `positionOf` lanza `NoPositionError` con el `userId` DENTRO de la consulta (`ownedEntries`), sin guardia previa | `tests/portfolio-service.test.ts` › *SPEC-025 CA-6: un symbolId sin posición del usuario no escribe nada (RN-01)* | verde; **muta a rojo** con MUT-C (quitar `eq(transactions.userId, userId)` del `where` de `ownedEntries`) → es el ÚNICO test que cae de los 13, y cae por `promise resolved instead of rejecting`. Verificado en el código: el `userId` va dentro de la consulta, sin guardia previa | ✅ |
| CA-7 (símbolo legacy sin micCode) | idem CA-1/CA-4/CA-5: la identidad es `symbols.id`, que no depende de `micCode` | `tests/portfolio-service.test.ts` › *SPEC-025 CA-7: símbolo legacy con micCode NULL sigue operando* | verde; afirma `sym.micCode` NULL antes de operar y encadena venta+split+dividendo con `120`/`15.00`/`212.00`. Inmune a MUT-A y MUT-C, como debe ser (un solo símbolo por ticker) | ✅ |
| CA-8 (e2e: la UI manda la identidad) | `src/app/cartera/portfolio-forms.tsx` (`SellForm` con `<select name="symbolId">` y `positionLabel`), `src/app/cartera/page.tsx` (`<SellForm positions={summary.positions} />`), `src/app/cartera/actions.ts` (`addSellAction` lee `symbolId`), `src/app/globals.css` (`.auth-form select`) | `tests/e2e/cartera.spec.ts` › *SPEC-025 CA-8: con el mismo ticker en dos mercados, la venta cae en la posición elegida*; capturas en `_qa/SPEC-025/ca8-*.png` | `npx playwright test` → 27/27. **Contra-prueba de la trampa de SPEC-024**: con MUT-A compilada (`npm run build` + e2e) CA-8 **cae**, y cae por la cifra (`Expected "50" / Received "100"`), no por un locator ausente ni por pantalla de error → cierra de verdad la cadena `portfolio-forms → addSellAction → recordSell`. Opciones distinguibles verificadas en captura: `SAN · BME (EUR) — 100 uds.` / `SAN · NYSE (USD) — 100 uds.` | ✅ |
| CA-9 (P/L actual con el precio de su mercado) | `src/lib/market/quotes.ts` (`getPriceMap` → `Record<symbolId, precio>`, `QuoteView.symbolId`) + `src/lib/portfolio/service.ts` (`rawPositions` busca `priceBySymbolId[sym.id]`) + `src/app/cartera/page.tsx` | `tests/market-quotes-pl.test.ts` › *SPEC-025 CA-9: el P/L actual usa el precio del mercado de la posición (RN-06)* | verde; **muta a rojo** con MUT-B (`map[v.ticker]`) y, sobre todo, con **MUT-B3** (colapso aguas abajo, que sí reproduce el número del bug): `expected '363.00' to be '198.00'`. Queda probado que la aserción **separa el 198,00 correcto del 363,00 erróneo**, no solo "hay un número" | ✅ |
| CA-10 (diagnóstico en la fila correcta) | `src/lib/market/quotes.ts` (`getDiagnosticMap` → `Record<symbolId, DiagnosticView>`) + `src/app/cartera/page.tsx` (`diagnosticos[p.symbolId]`, `key={p.symbolId}`) | `tests/market-quotes-pl.test.ts` › *SPEC-025 CA-10: el motivo de "sin cotización" es el del símbolo que no cotiza* | verde; **muta a rojo** con MUT-B. Afirma en positivo (`diag[xnys].reason`) y en negativo acotado (`diag[bmex]` undefined) + el P/L de cada fila (`198.00` / `null`) | ✅ |
| CA-11 (sin regresión con un solo mercado) | ningún cambio de comportamiento con un mercado por ticker | suites existentes intactas en sus EXPECTATIVAS: `tests/portfolio-service.test.ts`, `tests/market-quotes-pl.test.ts`, `tests/market-refresh.test.ts`, `tests/quote-diagnostics.test.ts`, `tests/market-provider-*.test.ts`, `tests/import-*.test.ts` | `npx vitest run` → **273/273 en 30 ficheros**; `npx playwright test` → **27/27**. Comprobado por `git diff 62b6989 HEAD -- tests/quote-diagnostics.test.ts tests/market-provider-dialect.test.ts tests/market-provider-equivalent-markets.test.ts tests/portfolio-service.test.ts`: **ningún valor esperado cambia**, solo la clave de acceso (`diag.ITX` → `diag[await symbolId(db,'ITX')]`, `{ITX:110}` → `{[itxId]:110}`) y el import del helper. Los `80.00`/`60.00`/`100.33`/`-1.00` siguen idénticos | ✅ |
| CA-12 (getSymbolByTicker sin usos, eliminada) | `src/lib/portfolio/symbols.ts` — función eliminada (queda una lápida en comentario que no la nombra); `getSymbolByMarket` y `getOrCreateSymbol` se conservan | `tests/portfolio-service.test.ts` › *SPEC-025 CA-12: no queda ningún camino que resuelva la posición por ticker* (comprueba el export y recorre `src/` fichero a fichero) | comprobado por el verificador **fuera del test**: `grep -rn "getSymbolByTicker" src/` → 0 resultados (exit 1); en todo el repo solo aparece en las 3 líneas del propio test de CA-12. El `git diff` confirma **eliminación**, no `@deprecated`. `getSymbolByMarket`/`getOrCreateSymbol` intactas | ✅ |

### Evidencia de la implementación (comandos y resultado)

- **RED antes del arreglo** (`28ee4d1`):
  - `npx vitest run tests/portfolio-service.test.ts tests/market-quotes-pl.test.ts` →
    **10 fallos / 7 pasan**. CA-1/CA-2/CA-4/CA-5/CA-7 con `NoPositionError` (el `symbolId`
    no es un ticker); **CA-3** con `expected NoPositionError … to be an instance of
    OversellError`; CA-6 y CA-12 por aserción; **CA-9** con
    `expected [ 'SAN' ] to deeply equal [ …(2) ]` — el colapso de `getPriceMap` en una
    sola clave, que es literalmente el defecto B.
  - `npx playwright test tests/e2e/cartera.spec.ts` → **CA-8 rojo**:
    `locator('select[name="symbolId"]') … element(s) not found` (el formulario era un
    campo de texto). Los otros 2 tests de cartera pasaban con el bug delante.
- **GREEN final** (`b3d17aa` + limpieza):
  - `npx vitest run` → **273/273** en 30 ficheros.
  - `npx playwright test` → **27/27** (incluye CA-8 y las regresiones de SPEC-024).
  - `npm run typecheck` → limpio, sin salida.
  - `npx eslint src tests` → **0 errores**; 1 warning **preexistente** y ajeno
    (`tests/position.test.ts:7`, `LedgerEntry` sin usar).
  - `DATABASE_URL=… AUTH_SECRET=… npm run build` → OK.
- **CA-11 comprobado por diff, no de palabra**:
  `git diff 28ee4d1^ HEAD -- tests/quote-diagnostics.test.ts tests/market-provider-dialect.test.ts tests/market-provider-equivalent-markets.test.ts`
  solo cambia la **clave** de acceso (`diag.ITX` → `diag[await symbolId(db,'ITX')]`) y
  añade el import del helper. **Ningún valor esperado cambia** en ninguna de las suites
  adaptadas (lo mismo en `tests/portfolio-service.test.ts`: `{ ITX: 110 }` → `{ [itxId]: 110 }`
  con los mismos `80.00` / `60.00`).
- **CA-12 comprobado en el árbol**: `grep -rn "getSymbolByTicker" src` → **0 resultados**.
  Las únicas apariciones del nombre en el repo son las tres líneas del propio test de
  CA-12, que tiene que nombrarlo para buscarlo.
- **Trampa de SPEC-024 evitada**: el e2e de CA-8 no afirma por ausencia. Afirma **en
  positivo** el estado final celda a celda de las **dos** filas (`50` / `13.00` / `50.00`
  en la de NYSE y `100` / `10.00` / `0.00` en la de BME): con el bug delante la venta
  caía en la fila de BME y la aserción de la de NYSE fallaba. Y las cifras de dinero de
  CA-9 son exactas (`198.00`, `63.00`), con una aserción explícita de que **no** es el
  `363.00` erróneo.
- **Scratch borrado**: `tests/repro-cartera-identidad.test.ts` ya no existe (nunca llegó a
  commitearse). Sus 8 escenarios están cubiertos por los CA permanentes — R1→CA-1,
  R2→CA-2, R3→CA-3, R4→CA-4, R5→CA-5, R6→CA-1 (la identidad ya no depende del orden de
  filas), R7→CA-9, R8→premisa del escenario de dos mercados en ambos ficheros.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-17, sdd-verificador.** 12/12 CA cerrados. Sin salvedades.

### Gates automáticos (ejecutados por el verificador, no de palabra)

| Gate | Comando | Resultado |
|---|---|---|
| Tests unitarios/integración | `npx vitest run` | **273 pasan / 273** en 30 ficheros |
| Typecheck | `npm run typecheck` | limpio, sin salida |
| Lint | `npx eslint src tests` | **0 errores**; 1 warning **preexistente y ajeno** (`tests/position.test.ts:7`, `LedgerEntry` sin usar — fichero no tocado por esta spec) |
| Build | `DATABASE_URL=… AUTH_SECRET=… npm run build` | OK, 13 rutas |
| E2E | `npx playwright test` | **27 pasan / 27** |
| Esquema | `git diff --stat 62b6989 HEAD -- drizzle/ src/db/` | **vacío**: sin cambio de esquema y sin migración, como declaraba la spec |

### Contra-pruebas por mutación (el CA prueba lo que dice)

El riesgo que se buscaba era el de SPEC-024: CA que pasan por accidente (un uuid nunca
coincide con un ticker) y tests que pasan con el bug delante. Se descarta con cuatro
mutaciones, cada una aplicada, ejecutada y **revertida** (`git status` limpio y
`git hash-object` idéntico a HEAD al terminar; el verificador no dejó código tocado):

- **MUT-A — escritura por ticker.** Se reintroduce el `limit(1)` sin `ORDER BY` en
  `positionOf` **y** en el `symbolId` que insertan `recordSell`/`recordSplit`/`recordDividend`.
  → caen **CA-1, CA-2, CA-3, CA-4, CA-5** (5 de 13). **No** caen CA-6, CA-7 ni CA-12, que
  es lo correcto: no dependen de la resolución por ticker y tienen su propia mutación.
- **MUT-B — lectura por ticker.** `getPriceMap` vuelve a `map[v.ticker] = v.price`.
  → caen **CA-9, CA-10** y, de propina, un test preexistente de SPEC-004
  (`expected null to be '100.00'`), que confirma que la suite vieja también vigila.
- **MUT-B3 — el bug original con su número.** MUT-B deja el precio en `undefined` (P/L
  `null`), así que se hizo una segunda mutación que reproduce el **colapso aguas abajo**:
  ambas posiciones toman el precio del último símbolo del ticker. Resultado:
  `AssertionError: expected '363.00' to be '198.00'`. **CA-9 distingue el valor correcto
  del erróneo**, no se limita a comprobar que "hay un número".
- **MUT-C — aislamiento (RN-01).** Se quita `eq(transactions.userId, userId)` del `where`
  de `ownedEntries`. → cae **exactamente un test de trece: CA-6**. El `userId` está de
  verdad dentro de la consulta y es load-bearing.
- **MUT-A recompilada contra el e2e** (`npm run build` + `npx playwright test tests/e2e/cartera.spec.ts`):
  **CA-8 cae**, y cae por la cifra (`Expected "50" / Received "100"` en la cantidad viva de
  la fila de NYSE), no por un selector ausente ni por una pantalla de error. Es la prueba
  de que el e2e afirma **en positivo** el estado final de las dos filas y de que la cadena
  UI → action → servicio está realmente cerrada. Los otros 2 tests de `cartera.spec.ts`
  seguían verdes con el bug delante, que es justo por lo que CA-8 tenía que existir.

### Comprobaciones adicionales de criterio propio

- **RN-08 en los dos sentidos**: CA-2 (no rechaza lo legítimo) y CA-3 (sí rechaza lo
  imposible, con `sells` a 0 filas) están ambos, y ambos mutan a rojo. La reproducción R2/R3
  queda cubierta.
- **RN-09**: el `realizadoPL` de XNYS se calcula con precio de venta USD sobre coste USD
  (`50.00`) y el de BMEX se queda en `0.00`. Al identificar por `symbolId`, la divisa de la
  operación es por construcción la del símbolo: no hay camino que cruce divisas.
- **`getSymbolByTicker`**: eliminada, no deprecada. `grep -rn` sobre `src/` → 0 resultados.
- **Consumidores desalineados**: `grep` de `getPriceMap`, `getDiagnosticMap`,
  `portfolioSummary`, `listPositions`, `recordSell/Split/Dividend` en `src/` → el único
  llamador de cada uno está adaptado. No queda ningún sitio pasando un mapa por ticker.
- **`src/app/globals.css` (fichero fuera de la lista de la spec)**: es **alcance legítimo de
  CA-8**, no colado. Añade `.auth-form select` (mismo trato que los `input` hermanos),
  cheurón inline y color de las `option`; sin ello el desplegable nuevo salía blanco sobre
  un formulario oscuro. Verificado que el único `<select>` dentro de un `.auth-form` es el
  de la venta (el del asistente de import no lleva esa clase), así que no hay efecto
  colateral. Cero cambio de comportamiento.
- **El uuid no se filtra al usuario**: `NoPositionError` lleva el `symbolId` en el mensaje
  interno, pero `addSellAction` lo traduce a *"No tienes posición en ese valor."* y un
  `symbolId` malformado cae en el `catch` genérico (*"Datos inválidos."*), sin 500.
- **Scratch**: `tests/repro-cartera-identidad.test.ts` no está en el árbol y **nunca se
  commiteó** (`git log --all -- <fichero>` vacío). Sus 8 escenarios quedan cubiertos por CA
  permanentes: R1→CA-1, R2→CA-2, R3→CA-3, R4→CA-4, R5→CA-5, R6→CA-1 (la identidad ya no
  depende del orden de filas), R7→CA-9, R8→premisa del escenario de dos mercados.
- **Decisiones humanas vinculantes respetadas**: escritura y lectura en la misma spec (1),
  `getSymbolByTicker` eliminada (2), selector de posición en la venta (3), CA-7 legacy con
  `micCode` NULL operativo (4), `userId` dentro de la consulta (5). No se ha tocado nada de
  lo declarado fuera de alcance (F-SPEC-025-2 sigue intacto, verificado en el diff).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-025/. Informe HTML opcional: _qa/SPEC-025/informe.html -->

| CA | Captura | Qué muestra |
|---|---|---|
| CA-8 | `_qa/SPEC-025/ca8-selector-de-posicion.png` | El formulario de venta con el desplegable **Posición** y las dos opciones distinguibles (`SAN · BME (EUR) — 100 uds.` y `SAN · NYSE (USD) — 100 uds.`), donde antes había un campo de texto "Ticker" |
| CA-8 | `_qa/SPEC-025/ca8-venta-en-la-posicion-elegida.png` | Tras vender 50 sobre la posición de NYSE: la fila de coste medio **13.00** baja a **50** con realizado **50.00**, y la de **10.00** sigue en **100** con **0.00** |

También quedan actualizadas las tres capturas de `_qa/SPEC-002/` porque el formulario de
venta cambió de campo de texto a selector (mismo flujo, otra UI).

**Revisadas por el verificador (2026-08-17).** Las dos capturas de `_qa/SPEC-025/` muestran
lo que dicen: en la primera, el desplegable **Posición** con `SAN · BME (EUR) — 100 uds.` y
las dos posiciones distinguibles donde antes había un campo de texto "Ticker"; en la
segunda, la fila de coste medio **13.00** (NYSE) en **50** con realizado **50.00** y la de
**10.00** (BME) intacta en **100** con **0.00**, sin pantalla de error. El DOM respeta el
lenguaje ubicuo de `docs/fundacion/dominio.md`: *Posición*, *Cantidad viva*, *Coste medio*,
*P/L realizado*, *P/L actual*. Tras la corrida de verificación se restauró `_qa/` con
`git checkout -- _qa` para no inflar el diff con PNG de specs anteriores.

## Salvedades / follow-ups
<!-- IDs F-SPEC-025-1, F-SPEC-025-2… con destino (spec futura o EPIC-MEJORA). -->
Abiertos ya en la fase de spec (fuera de alcance a propósito, ver la sección homónima):

- **F-SPEC-025-1** (EPIC-MEJORA): la tabla de posiciones de `/cartera` no muestra
  mercado ni divisa, así que dos posiciones del mismo ticker se ven como dos filas
  idénticas. Presentación, no corrección. Hermano de **F-SPEC-024-1** (`/vigiladas`):
  conviene hacerlos en la misma spec.
- **F-SPEC-025-2** (EPIC-FIX, spec propia): `portfolioSummary` suma `realizadoTotal` y
  `actualTotal` sobre posiciones de **divisas distintas** (EUR + USD en una sola cifra).
  Defecto **preexistente e independiente** de SPEC-025 —existe desde SPEC-002 con un solo
  mercado por ticker—. Roza RN-09 y la exclusión de multi-moneda de FOUNDATION; arreglarlo
  exige decidir qué se muestra (totales por divisa / conversión / nada) → producto.
- **F-SPEC-025-3** (higiene): `getQuoteByTicker` (`src/lib/market/quotes.ts:57`) conserva la
  ambigüedad de coger la primera fila cuando un ticker tiene varios mercados. Sin usos en
  `src/`, solo en tests; no se toca en esta spec.

Abiertos durante la implementación:

- **F-SPEC-025-4** (higiene, EPIC-MEJORA): `getQuoteViews(db, tickers?)` sigue filtrando por
  **ticker** (`inArray(symbols.ticker, …)`). Hoy es inocuo —todos sus llamadores en `src/`
  la usan **sin** argumento, y el mapa que produce ya va indexado por `symbolId`—, pero es
  el último parámetro del camino de lectura que habla en tickers. Filtrar por `symbolId`
  cerraría el patrón. Hermano natural de **F-SPEC-025-3**: los dos viven en el mismo
  fichero y conviene hacerlos juntos.
- **F-SPEC-025-5** (presentación, EPIC-MEJORA): la etiqueta del selector de venta usa
  `exchange ?? micCode`. En los símbolos **legacy** (`micCode` NULL, CA-7) no hay ninguno de
  los dos y la opción queda como `ITX (EUR) — 100 uds.`. Es correcto —esos símbolos no
  tienen mercado que mostrar y, por definición, no conviven con un gemelo del mismo
  ticker— pero si algún día se rellena la identidad de los legacy, esa etiqueta mejora
  sola. No hace falta tocar nada ahora.

Comprobado, sin follow-up: **no se ha tocado F-SPEC-025-2** (`portfolioSummary` sigue
sumando `realizadoTotal`/`actualTotal` sobre divisas distintas, exactamente igual que
antes) pese a estar en el mismo fichero y a dos líneas de las que sí cambiaron.
Tampoco se ha tocado el import de extracto ni `getQuoteByTicker`.

## Reproducción del defecto (fase de spec, 2026-08-17)
`tests/repro-cartera-identidad.test.ts` (**scratch**, se borra al implementar):
`npx vitest run tests/repro-cartera-identidad.test.ts` → **8/8 escenarios reproducen el
defecto** contra PGlite. Resultado clave: con `SAN`@BMEX y `SAN`@XNYS, la venta cae en el
símbolo que gana el `limit(1)` (R1/R6), RN-08 falla en ambos sentidos (R2/R3), split y
dividendo caen en el mercado equivocado (R4/R5) y **solo abrir la cartera** da un P/L actual
de 363,00 € donde correspondían 198,00 € (R7, error de 165 €). La tabla completa está en la
sección *Reproducción* de la spec.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Estado**: implementación completa. Los 12 CA tienen código y test; falta el gate del
verificador. Nada a medias, nada pendiente de decisión.

**Dónde está todo**: rama
`ft/SPEC-025-cartera-vender-dividir-y-cobrar-dividendo-sobre-la-posicion-del-mercado-correcto`
(worktree `fix-quitar-vigilada-en-zona`), commits `28ee4d1` (RED) y `b3d17aa` (arreglo).
Sin push, sin PR.

**Ficheros tocados** (7 de código, 6 de test):
`src/lib/portfolio/service.ts`, `src/lib/portfolio/symbols.ts`, `src/lib/market/quotes.ts`,
`src/app/cartera/page.tsx`, `src/app/cartera/portfolio-forms.tsx`,
`src/app/cartera/actions.ts`, `src/app/globals.css`;
`tests/portfolio-service.test.ts`, `tests/market-quotes-pl.test.ts`,
`tests/quote-diagnostics.test.ts`, `tests/market-provider-dialect.test.ts`,
`tests/market-provider-equivalent-markets.test.ts`, `tests/e2e/cartera.spec.ts`, más el
helper nuevo `tests/symbol-id.ts`.

**Cómo reproducir los gates**:
`npx vitest run` (273/273) · `npm run typecheck` · `npx eslint src tests` ·
`DATABASE_URL=… AUTH_SECRET=… npm run build` y `npx playwright test` (27/27).

**Para la contra-prueba del verificador** (el defecto vive en dos sitios):
1. Escritura — en `recordSell` sustituir `positionOf(db, userId, symbolId)` por una
   resolución por ticker: CA-1..CA-7 se ponen rojos.
2. Lectura — en `getPriceMap` volver a `map[v.ticker] = v.price`: CA-9 da `363.00` donde
   toca `198.00` (los 165 € de error de la reproducción).
3. Aislamiento (RN-01) — quitar `eq(transactions.userId, userId)` del `where` de
   `ownedEntries`: CA-6 debería ser el que cante.

**Sin migración**: abrir el PR no toca producción. Y ojo con el punto 6 del gate humano —
las ventas/splits/dividendos ya escritos contra el símbolo equivocado **no** se corrigen
aquí; eso es una revisión manual sobre los datos reales, fuera de esta spec.
