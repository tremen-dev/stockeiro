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
| CA-1 (venta en la posición señalada) | `src/lib/portfolio/service.ts` — `recordSell(db, userId, symbolId, input)` + `positionOf` | `tests/portfolio-service.test.ts` › *SPEC-025 CA-1: la venta cae en la posición señalada* | | 🚧 |
| CA-2 (RN-08 no rechaza lo legítimo) | idem CA-1 (RN-08 se evalúa sobre `ownedEntries(db, userId, symbolId)`) | `tests/portfolio-service.test.ts` › *SPEC-025 CA-2: RN-08 no rechaza una venta legítima de la otra posición* | | 🚧 |
| CA-3 (RN-08 sí rechaza lo imposible) | idem CA-1 | `tests/portfolio-service.test.ts` › *SPEC-025 CA-3: RN-08 sí rechaza la venta imposible de esa posición* | | 🚧 |
| CA-4 (split en la posición señalada) | `src/lib/portfolio/service.ts` — `recordSplit(db, userId, symbolId, ratio, occurredOn)` | `tests/portfolio-service.test.ts` › *SPEC-025 CA-4: el split ajusta la posición señalada (RN-07)* | | 🚧 |
| CA-5 (dividendo en la posición señalada) | `src/lib/portfolio/service.ts` — `recordDividend(db, userId, symbolId, amount, occurredOn)` | `tests/portfolio-service.test.ts` › *SPEC-025 CA-5: el dividendo se cobra en la posición señalada (RN-05)* | | 🚧 |
| CA-6 (RN-01: symbolId sin posición no escribe) | `src/lib/portfolio/service.ts` — `positionOf` lanza `NoPositionError` con el `userId` DENTRO de la consulta (`ownedEntries`), sin guardia previa | `tests/portfolio-service.test.ts` › *SPEC-025 CA-6: un symbolId sin posición del usuario no escribe nada (RN-01)* | | 🚧 |
| CA-7 (símbolo legacy sin micCode) | idem CA-1/CA-4/CA-5: la identidad es `symbols.id`, que no depende de `micCode` | `tests/portfolio-service.test.ts` › *SPEC-025 CA-7: símbolo legacy con micCode NULL sigue operando* | | 🚧 |
| CA-8 (e2e: la UI manda la identidad) | `src/app/cartera/portfolio-forms.tsx` (`SellForm` con `<select name="symbolId">` y `positionLabel`), `src/app/cartera/page.tsx` (`<SellForm positions={summary.positions} />`), `src/app/cartera/actions.ts` (`addSellAction` lee `symbolId`), `src/app/globals.css` (`.auth-form select`) | `tests/e2e/cartera.spec.ts` › *SPEC-025 CA-8: con el mismo ticker en dos mercados, la venta cae en la posición elegida*; capturas en `_qa/SPEC-025/ca8-*.png` | | 🚧 |
| CA-9 (P/L actual con el precio de su mercado) | `src/lib/market/quotes.ts` (`getPriceMap` → `Record<symbolId, precio>`, `QuoteView.symbolId`) + `src/lib/portfolio/service.ts` (`rawPositions` busca `priceBySymbolId[sym.id]`) + `src/app/cartera/page.tsx` | `tests/market-quotes-pl.test.ts` › *SPEC-025 CA-9: el P/L actual usa el precio del mercado de la posición (RN-06)* | | 🚧 |
| CA-10 (diagnóstico en la fila correcta) | `src/lib/market/quotes.ts` (`getDiagnosticMap` → `Record<symbolId, DiagnosticView>`) + `src/app/cartera/page.tsx` (`diagnosticos[p.symbolId]`, `key={p.symbolId}`) | `tests/market-quotes-pl.test.ts` › *SPEC-025 CA-10: el motivo de "sin cotización" es el del símbolo que no cotiza* | | 🚧 |
| CA-11 (sin regresión con un solo mercado) | ningún cambio de comportamiento con un mercado por ticker | suites existentes intactas en sus EXPECTATIVAS: `tests/portfolio-service.test.ts`, `tests/market-quotes-pl.test.ts`, `tests/market-refresh.test.ts`, `tests/quote-diagnostics.test.ts`, `tests/market-provider-*.test.ts`, `tests/import-*.test.ts` | | 🚧 |
| CA-12 (getSymbolByTicker sin usos, eliminada) | `src/lib/portfolio/symbols.ts` — función eliminada (queda una lápida en comentario que no la nombra); `getSymbolByMarket` y `getOrCreateSymbol` se conservan | `tests/portfolio-service.test.ts` › *SPEC-025 CA-12: no queda ningún camino que resuelva la posición por ticker* (comprueba el export y recorre `src/` fichero a fichero) | | 🚧 |

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

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-025/. Informe HTML opcional: _qa/SPEC-025/informe.html -->

| CA | Captura | Qué muestra |
|---|---|---|
| CA-8 | `_qa/SPEC-025/ca8-selector-de-posicion.png` | El formulario de venta con el desplegable **Posición** y las dos opciones distinguibles (`SAN · BME (EUR) — 100 uds.` y `SAN · NYSE (USD) — 100 uds.`), donde antes había un campo de texto "Ticker" |
| CA-8 | `_qa/SPEC-025/ca8-venta-en-la-posicion-elegida.png` | Tras vender 50 sobre la posición de NYSE: la fila de coste medio **13.00** baja a **50** con realizado **50.00**, y la de **10.00** sigue en **100** con **0.00** |

También quedan actualizadas las tres capturas de `_qa/SPEC-002/` porque el formulario de
venta cambió de campo de texto a selector (mismo flujo, otra UI).

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
