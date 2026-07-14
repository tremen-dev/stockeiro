---
id: SPEC-008
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-008 Buscador de simbolos por nombre

## Resumen
- Fase: en-revision (implementación completa; pendiente de verificación)
- Rama: `ft/SPEC-008-buscador-de-simbolos`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 Buscar por nombre | `src/lib/market/search.ts` (`searchSymbols`), `search-provider.ts`, `twelve-data-search-provider.ts` | `tests/symbol-search.test.ts` › CA-1 busca "Microsoft" → MSFT | ✅ unit verde + e2e (REP/AAPL/ITX encontrados y elegidos en navegador) | ✅ |
| CA-2 Solo renta variable (D-7) | `src/lib/market/search.ts` (filtro `type==='stock'`) | `tests/symbol-search.test.ts` › CA-2 descarta cripto/ETF | ✅ unit verde | ✅ |
| CA-3 Desambiguación por mercado | `search.ts` + UI `symbol-search.tsx` (opciones por micCode) | `tests/symbol-search.test.ts` › CA-3 dos mercados SAN | ✅ unit verde (SAN XMAD/XNYS separados, divisas distintas) | ✅ |
| CA-4 Selección fija identidad+divisa | `src/lib/portfolio/symbols.ts` (`getOrCreateSymbol` market), `symbol-selection.ts`, actions | `tests/symbol-identity.test.ts` › CA-4 (vigilar/comprar) | ✅ unit verde + e2e (chip muestra BME · EUR real, no EUR fijo) | ✅ |
| CA-5 Símbolo compartido por (ticker,micCode) | `src/lib/portfolio/symbols.ts`, `db/schema.ts` (unique) | `tests/symbol-identity.test.ts` › CA-5 (mismo/otro mercado) | ✅ unit verde | ✅ |
| CA-6 Coherencia símbolo↔cotización | `src/lib/market/provider.ts` (`QuoteRequest`), `refresh.ts`, `twelve-data-provider.ts` (mic_code→/eod) | `tests/market-mic-code.test.ts` › CA-6 (petición con micCode; dos mercados) | ✅ unit verde (cada mercado su precio/divisa) | ✅ |
| CA-7 Búsqueda exige sesión (RN-03) | `src/lib/market/search.ts` (`runSymbolSearch`), `symbol-search-action.ts` | `tests/symbol-search.test.ts` › CA-7 sin/con sesión | ✅ unit verde | ✅ |
| CA-8 Resiliencia del proveedor | `src/lib/market/search.ts` (try/catch), UI estado `error`; `readSymbolSelection` (no guardar sin resolver) | `tests/symbol-search.test.ts` › CA-8 proveedor falla | ✅ unit verde | ✅ |
| CA-9 Ambos formularios, componente compartido | `src/app/_components/symbol-search.tsx` en `watch-form.tsx` y `portfolio-forms.tsx` | e2e `vigiladas.spec.ts` + `ingesta-cartera.spec.ts` (flujo buscador) | ❌ **REGRESIÓN**: el buscador NO se resetea tras un alta con éxito → no se puede añadir una segunda acción sin pulsar "Cambiar"; rompe `avisos-zona.spec.ts` (2º `vigilar`). Ver V-SPEC-008-1. | 🚧 |
| CA-10 Debounce + umbral | `symbol-search.tsx` (debounce 300ms, MIN 2), `search.ts` (`MIN_QUERY_LENGTH`, red del servidor) | `tests/symbol-search.test.ts` › CA-2 «umbral no consulta» | ✅ unit verde | ✅ |

## Veredicto del verificador
**RED — 2026-07-14 (sdd-verificador), iteración 1/3.**

Gates: `tsc` limpio, `eslint` 0 errores (1 warning preexistente ajeno), `vitest run`
**105/105 verde**. e2e Playwright: **11/12** — falla `avisos-zona.spec.ts:52` de forma
determinista. Los 10 CA cumplen su contrato a nivel unit/integración; 9/10 quedan ✅.
El RED lo dispara una **regresión de flujo** en la UI (gate de regresión):

- **V-SPEC-008-1 (bloqueante).** El componente `SymbolSearch` no se **resetea tras un
  envío con éxito**: mantiene el estado `selected` y sigue mostrando el chip de la acción
  anterior, ocultando el campo de búsqueda. Consecuencia: para añadir una **segunda**
  acción (vigilar varias seguidas, o comprar tras vigilar) el usuario está obligado a
  pulsar "Cambiar". Evidencia DOM (Playwright): tras vigilar `REP`, el form "Vigilar una
  acción" muestra `REP · Repsol SA · BME · EUR · [Cambiar]` en vez del buscador, y el 2º
  `vigilar('TEF')` agota el timeout esperando `.symbol-search-input`. Rompe un e2e de
  SPEC-007 y es un defecto de UX real para el objetivo de UI profesional (la watchlist se
  llena de varias acciones). Fichero: `src/app/_components/symbol-search.tsx` +
  formularios `watch-form.tsx`/`portfolio-forms.tsx`.
  **Fix sugerido**: al pasar `state` a `{ok:true}` (useActionState), resetear la selección
  del buscador — p. ej. remontar `<SymbolSearch key={okCounter} />` o exponer un
  `resetSignal` que limpie `selected`/`query`. Cubrirlo dejando pasar el 2º `vigilar` del
  e2e ya existente.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-008/. Informe HTML opcional: _qa/SPEC-008/informe.html -->
Pendiente del verificador: los e2e (`tests/e2e/vigiladas.spec.ts`, `ingesta-cartera.spec.ts`,
`avisos-zona.spec.ts`, `cartera.spec.ts`) ya usan el flujo del buscador y el launcher
`tests/e2e/server.mjs` arranca con `E2E_FAKE_SYMBOL_SEARCH=1` (catálogo determinista sin red).
Ejecutar `npx playwright test` para capturas de CA-9/CA-3 (desambiguación) y CA-8 (error).

## Salvedades / follow-ups
- **F-SPEC-008-1** (destino: EPIC-MEJORA / SPEC-002): el mapa de precios de la cartera
  (`getPriceMap`/`getQuoteViews` en `src/lib/market/quotes.ts`) indexa por **ticker**. Las
  cotizaciones se persisten por `symbolId` (correcto), pero la LECTURA colapsa por ticker: si
  un usuario tuviera el MISMO ticker en dos mercados, ambos leerían el mismo precio. Riesgo
  bajo (caso raro), pero para cerrarlo del todo hay que teclear el mapa por `symbolId`. No
  bloquea SPEC-008: la ingesta ya es correcta por mercado (CA-6).
- **F-SPEC-008-2** (destino: despliegue, junto a F-SPEC-004-1): el adaptador real
  `TwelveDataProvider.getQuotes` envía `symbol` y `mic_code` como listas paralelas a `/eod`;
  el batch con `mic_code` para tickers homónimos debe verificarse contra la API real (no se
  ejerce en tests). Alternativa si falla: una llamada por símbolo con mercado.
- **F-SPEC-008-3** (destino: EPIC-MEJORA): venta/split/dividendo y `unwatch` resuelven el
  símbolo por `getSymbolByTicker` (primera coincidencia). Con el mismo ticker en dos mercados
  sería ambiguo; la UX correcta es elegir de entre las posiciones/vigiladas propias del
  usuario. Fuera del alcance de SPEC-008 (que cubre el ALTA por nombre).

## Cómo retomar (handoff)
- **Estado**: 10/10 CA implementados con test unitario; `vitest run` = **105 tests verde**;
  `tsc --noEmit` limpio; `next build` de producción OK.
- **Migración**: `drizzle/0001_symbol_market_identity.sql` (añade mic_code/exchange/name,
  unicidad `(ticker, mic_code)`, índice por ticker; quita el unique de ticker). **Backfill**:
  no destructivo — los símbolos legacy conservan `mic_code` NULL y siguen resolubles por
  ticker (camino legacy en `getOrCreateSymbol`); al re-elegirlos por el buscador quedan con
  identidad de mercado completa. `test-db.ts` y `tests/e2e/server.mjs` en sincronía.
- **Contrato cambiado (deliberado)**: `MarketDataProvider.getQuotes(string[])` →
  `getQuotes(QuoteRequest[])` con micCode. Tests de SPEC-004 adaptados (no es regresión).
- **Qué falta**: verificación adversarial (verificador) + e2e Playwright para evidencia
  visual de CA-9/CA-3/CA-8. Nada de código pendiente.
