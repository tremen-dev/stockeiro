---
id: SPEC-015
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-015 Proveedor de cotizaciones con cobertura del mercado real

## Resumen
- Fase: en-revision (implementación completa; pendiente de verificador)
- Rama: `ft/SPEC-015-proveedor-de-cotizaciones-con-cobertura-del-mercado-real`
- **Marketstack** pasa a ser el adaptador de cotizaciones (ADR-012); **Twelve Data se
  mantiene solo para la búsqueda**. La identidad canónica pasa a **operating MIC**
  (`BMEX`, `XNAS`…), con la traducción en los adaptadores. Migración de datos `0004`
  (backfill). Sin cambio de esquema.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (cobertura del mercado real) | `marketstack-provider.ts`; `quote-provider-factory.ts`; `api/cron/refresh/route.ts` | `tests/market-operating-mic.test.ts` › CA-1 (ITX/BMEX se cotiza, `skipped` vacío) | | ❌ |
| CA-2 (identidad = operating MIC) | `src/lib/market/mic.ts` (`OPERATING_MICS`, `toOperatingMic`, `isOperatingMic`) | `market-operating-mic.test.ts` › CA-2/CA-3 (normaliza e idempotente) | | ❌ |
| CA-3 (la búsqueda normaliza segmento→operating) | `twelve-data-search-provider.ts` (`toOperatingMic` en la frontera) | `market-operating-mic.test.ts` › CA-2/CA-3 (XMAD→BMEX, XNGS→XNAS; XXXX se omite) | | ❌ |
| CA-4 (el eco casa) | `marketstack-provider.ts` (`fromProviderMic` + match con lo pedido) | `market-operating-mic.test.ts` › CA-4/5/6 (micCode devuelto = BMEX) | | ❌ |
| CA-5 (close NO ajustado + asOf + divisa del símbolo) | `marketstack-provider.ts` (`close`, `date`); `refresh.ts` (divisa del símbolo) | `market-operating-mic.test.ts` › CA-4/5/6 (adj_close=99.99 ignorado) y › CA-5 divisa | | ❌ |
| CA-6 (traducción del dialecto) | `marketstack-provider.ts` (`TO_PROVIDER`/`FROM_PROVIDER`: XETR↔XETRA) | `market-operating-mic.test.ts` › CA-4/5/6 (pide BMW.XETRA, devuelve XETR) | | ❌ |
| CA-7 (dedupe + batch) | `refresh.ts` (`symbolUniverse`); `marketstack-provider.ts` (1 llamada) | `market-operating-mic.test.ts` › CA-7 y › CA-4/5/6 (batch: 1 llamada) | | ❌ |
| CA-8 (resiliencia por símbolo) | `marketstack-provider.ts` (fila `status:'error'` se omite; error global lanza) | `market-operating-mic.test.ts` › CA-8 (2 casos) | | ❌ |
| CA-9 (`MARKET_MAP`→BMEX, cierra F-SPEC-012-1) | `src/lib/import/market-map.ts` | `market-operating-mic.test.ts` › CA-9 (2 casos) | | ❌ |
| CA-10 (sin MIC canónico NO se cotiza) | `marketstack-provider.ts` (filtro `isOperatingMic`); `drizzle/0004_backfill_operating_mic.sql` | `market-operating-mic.test.ts` › CA-10 y › CA-2/3 (`toOperatingMic`→null) | | ❌ |
| CA-11 (el dominio depende del puerto) | `provider.ts` (puerto intacto); `refresh.ts` | `market-operating-mic.test.ts` › CA-11 (adaptador arbitrario) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-015/. Informe HTML opcional: _qa/SPEC-015/informe.html -->

## Salvedades / follow-ups
- **Cómo se "marca" lo no mapeable (CA-10)** — decisión de implementación: **sin columna
  nueva**. Un símbolo sin operating MIC canónico (legacy `null`, o un MIC desconocido)
  simplemente **no se pide** al proveedor (`isOperatingMic` filtra en el adaptador) y cae
  en `skipped`. Es detectable sin tocar el esquema; **hacerlo VISIBLE al usuario es
  SPEC-016** (CE-F2). La migración `0004` deja esos símbolos **tal cual** a propósito: no
  se inventa su mercado.
- **Cambio de comportamiento (consciente)**: los símbolos **legacy sin `micCode`** (que
  ADR-007 toleraba y se cotizaban por ticker) **dejan de cotizarse**. Es lo correcto
  según ADR-012 —sin mercado no se puede garantizar divisa (RN-09) y adivinarlo falsea el
  P/L—, pero es un cambio real respecto a antes. El backfill no los toca; SPEC-016 dirá
  por qué no cotizan.
- **`ProviderQuote.currency` pasa a OPCIONAL** (cambio de contrato del puerto): Marketstack
  **no devuelve divisa** (verificado contra la API). La divisa la pone el **refresco desde
  el símbolo** (RN-09/CA-5). Esto **corrige un bug latente**: antes se guardaba la divisa
  del proveedor, así que `SAN`@NYSE habría escrito **USD en un símbolo EUR**.
- **F-ADR-012-2 (despliegue, BLOQUEANTE en producción)**: `MARKETSTACK_API_KEY` ya está en
  `.env.example`, pero **hay que aprovisionarla en Vercel**. Sin ella, producción sigue sin
  cotizar aunque esto se mergee. Igual que pasó con `TWELVE_DATA_API_KEY`.
- **F-SPEC-015-1 (dialecto por verificar)**: solo se ha validado contra la API real
  **BMEX** (ITX/SAN/TEF) y la codificación `%2C` del batch. El resto de dialectos
  (`XETR`→`XETRA`, y XSTO/XPAR/XAMS/XNAS/XNYS) están en la tabla **sin verificar contra la
  API**. Destino: follow-up de despliegue, junto a F-ADR-012-2.
- **Twelve Data sigue necesario** (`TWELVE_DATA_API_KEY`) para la BÚSQUEDA: no se puede
  retirar. Dos proveedores, cada uno tras su puerto (ADR-012).

## Cómo retomar (handoff)
Implementación de SPEC-015 **completa y en verde**: unit **25 ficheros** (nuevo
`tests/market-operating-mic.test.ts` con los 11 CA), **e2e 15/15 sin regresión**,
`tsc` y `eslint` limpios, `next build` OK.

Ficheros nuevos:
- `src/lib/market/mic.ts` — catálogo de operating MIC + mapa ISO segmento→operating (dominio).
- `src/lib/market/marketstack-provider.ts` — adaptador de cotizaciones (batch, close no
  ajustado, dialecto, resiliencia).
- `src/lib/market/quote-provider-factory.ts` — real vs fake por `E2E_FAKE_QUOTES`.
- `drizzle/0004_backfill_operating_mic.sql` — backfill idempotente (migración de datos).
- `tests/market-operating-mic.test.ts` — CA-1..CA-11.

Tocados: `twelve-data-search-provider.ts` (normaliza), `provider.ts` (`currency` opcional),
`refresh.ts` (universo con divisa; upsert con la del símbolo), `import/market-map.ts`
(→BMEX, simplificado), `search-provider-factory.ts` (catálogo E2E canónico),
`api/cron/refresh/route.ts` (usa `quoteProvider()`), `.env.example`, `tests/e2e/server.mjs`
(`E2E_FAKE_QUOTES=1`), y los tests que codificaban MIC de segmento (import-identity,
import-register, market-mic-code, symbol-identity, symbol-search) → canónico, **sin
cambiar lo que prueban**.

`TwelveDataProvider` (cotizaciones) queda **sin usar** pero NO se borra: es el adaptador de
referencia del puerto y su test sigue verde. Si el verificador prefiere retirarlo, es
trivial. Siguiente: **verificador** (gate de SPEC-015), y después **SPEC-016** (hacer
visible el motivo del descarte).
