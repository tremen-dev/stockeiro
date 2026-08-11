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
| CA-1 (cobertura del mercado real) | `marketstack-provider.ts`; `quote-provider-factory.ts`; `api/cron/refresh/route.ts` | `tests/market-operating-mic.test.ts` › CA-1 (ITX/BMEX se cotiza, `skipped` vacío) | verde: el defecto de EPIC-FIX corregido; `updated=['ITX']`, `skipped=[]` | ✅ |
| CA-2 (identidad = operating MIC) | `src/lib/market/mic.ts` (`OPERATING_MICS`, `toOperatingMic`, `isOperatingMic`) | `market-operating-mic.test.ts` › CA-2/CA-3 (normaliza e idempotente) | verde: XMAD→BMEX, XNGS→XNAS, idempotente; `isOperatingMic('XMAD')=false` | ✅ |
| CA-3 (la búsqueda normaliza segmento→operating) | `twelve-data-search-provider.ts` (`toOperatingMic` en la frontera) | `market-operating-mic.test.ts` › CA-2/CA-3 (fetch canned) | verde: el puerto entrega ['BMEX','XNAS']; el mercado desconocido (XXXX) se omite | ✅ |
| CA-4 (el eco casa) | `marketstack-provider.ts` (`fromProviderMic` + match con lo pedido) | `market-operating-mic.test.ts` › CA-4/5/6 | verde: pedido BMEX → devuelto BMEX; el emparejado de `quoteKey` ya no falla | ✅ |
| CA-5 (close NO ajustado + asOf + divisa del símbolo) | `marketstack-provider.ts` (`close`, `date`); `refresh.ts` (divisa del símbolo) | `market-operating-mic.test.ts` › CA-4/5/6 y › CA-5 divisa | verde: con `adj_close=99.99` inyectado se guarda `53.72` (RN-12 real, no cosmético); divisa EUR del símbolo aunque el fake diga USD (RN-09) | ✅ |
| CA-6 (traducción del dialecto) | `marketstack-provider.ts` (`TO_PROVIDER`/`FROM_PROVIDER`: XETR↔XETRA) | `market-operating-mic.test.ts` › CA-4/5/6 | verde: se pide `BMW.XETRA` (spy sobre la URL) y el dominio recibe `XETR` | ✅ |
| CA-7 (dedupe + batch) | `refresh.ts` (`symbolUniverse`); `marketstack-provider.ts` (1 llamada) | `market-operating-mic.test.ts` › CA-7 y › CA-4/5/6 | verde: 2 usuarios → 1 entrada de universo; 3 símbolos → 1 llamada | ✅ |
| CA-8 (resiliencia por símbolo) | `marketstack-provider.ts` (fila `status:'error'` se omite; error global lanza) | `market-operating-mic.test.ts` › CA-8 (2 casos) | verde: la fila 403 no aborta a las demás; el error global se propaga | ✅ |
| CA-9 (`MARKET_MAP`→BMEX, cierra F-SPEC-012-1) | `src/lib/import/market-map.ts` | `market-operating-mic.test.ts` › CA-9 (2 casos) | verde: `M.CONTINUO`→`BMEX`; un candidato `XMAD` ya NO cuela (0 resultados) | ✅ |
| CA-10 (sin MIC canónico NO se cotiza) | `marketstack-provider.ts` (filtro `isOperatingMic`); `drizzle/0004_backfill_operating_mic.sql` | `market-operating-mic.test.ts` › CA-10 y › CA-2/3 | verde en "**no se cotiza**" (legacy null → `skipped`, no se pide) y en "no se inventa" (`toOperatingMic`→null). **Salvedad**: el "**marcado**" es IMPLÍCITO (sin columna; detectable por MIC no canónico) y su visibilidad se entrega en SPEC-016 → ⚠️, no ✅ | ⚠️ |
| CA-11 (el dominio depende del puerto) | `provider.ts` (puerto intacto); `refresh.ts` | `market-operating-mic.test.ts` › CA-11 (adaptador arbitrario) | verde: `refreshQuotes` opera con un adaptador ad-hoc; diff de dominio VACÍO | ✅ |

## Veredicto del verificador
**GREEN** — 2026-07-15 (sdd-verificador). CA-1..CA-9 y CA-11 **✅**; **CA-10 ⚠️** con
salvedad justificada y aceptada (ver abajo).

Gates independientes: `tsc --noEmit` limpio; `eslint src tests` sin errores; unit **25
ficheros** verdes; `next build` OK; **Playwright 15/15** — sin regresión pese a tocar el
catálogo E2E del buscador y la ruta del cron.

**Alcance (auditado)**: `git diff main..HEAD -- src/lib/portfolio src/lib/triggers
src/lib/notifications src/db` → **VACÍO**. El ledger, la cartera, el motor de disparo, los
avisos y el **esquema** están intactos: es un adaptador tras el puerto, como manda ADR-012.

**Auditoría adversarial superada:**
- **RN-12 real, no cosmético**: el test inyecta `adj_close=99.99` junto a `close=53.72` y
  asierta `53.72`. Si alguien tomara el ajustado, el test cae. Correcto.
- **Divisa (CA-5)**: cambiar `ProviderQuote.currency` a opcional y tomar la divisa **del
  símbolo** es **CORRECTO** y no rompe SPEC-002/SPEC-004 (sus suites siguen verdes).
  Marketstack no devuelve divisa (verificado contra la API), y RN-09 ya decía que la divisa
  es la del símbolo (ADR-007 la fija al elegir el candidato). **Corrige un bug latente
  real**: antes se guardaba la del proveedor, así que `SAN`@NYSE habría escrito **USD en un
  símbolo EUR**. Es una mejora de corrección, no un atajo.
- **Tests preexistentes (punto crítico)**: el diff de `symbol-identity`, `market-mic-code`
  e `import-register` es **renombrado puro** `XMAD→BMEX` / `XNGS→XNAS`. **Ninguna aserción
  debilitada, ninguna lógica cambiada**: prueban lo mismo con el MIC canónico. No se
  "arregló" ningún test para que pasara.
- **Migración 0004**: de datos, no de esquema. **Idempotente verificado por lectura**: los
  `WHERE` solo casan MIC de segmento, así que re-ejecutar no cambia nada; y **no toca** lo
  no mapeable ni los `NULL`.
- **CA-9**: `filterByMarket([XMAD], 'M.CONTINUO')` → **0 resultados**. F-SPEC-012-1 cerrado.

**Cambio de comportamiento (juzgado, punto 4): NO es regresión encubierta.** Los símbolos
legacy sin `micCode` —que ADR-007 toleraba y se cotizaban **por ticker**— dejan de
cotizarse. Es **correcto**: cotizar por ticker suelto es EXACTAMENTE lo que producía el
defecto (`SAN` sin mercado → NYSE en USD para una posición de Madrid en EUR), y sin mercado
no se puede garantizar RN-09/RN-06. Lo manda **CA-10** ("no se inventa su mercado") y
**ADR-012** (identidad = ticker + operating MIC). Además está **declarado** en las
salvedades del ledger, no oculto.

**CA-10 → ⚠️ (no ✅)**: el CA pide "quedan **marcados** y no se cotizan". El *"no se
cotizan"* está implementado y probado; el *"marcado"* se resolvió **sin columna**
(implícito: MIC no canónico ⇒ detectable) y **su visibilidad al usuario se difiere a
SPEC-016**. Es una salvedad **justificada y aceptada** —SPEC-016 está en la MISMA épica y
es su CE-F2—, pero mientras no aterrice, un símbolo legacy **deja de cotizar en silencio**:
justo el fallo que EPIC-FIX combate. **No bloquea SPEC-015**, pero **SPEC-016 no es
opcional**: sin ella, esta épica no cumple CE-F2.

**Salvedades declaradas — legítimas, no huecos encubiertos:**
- **F-ADR-012-2**: falta `MARKETSTACK_API_KEY` en Vercel. **Producción seguirá sin cotizar
  aunque esto se mergee.** Es ops, no código; el patrón es idéntico a F-SPEC-004-1.
- **F-SPEC-015-1**: solo `BMEX` (ITX/SAN/TEF) y la codificación `%2C` del batch están
  validados contra la API real; el resto de dialectos (`XETR`→`XETRA`, XSTO/XPAR/XAMS/
  XNAS/XNYS) están en la tabla **sin verificar**. Correctamente declarado: los tests usan
  fake por diseño (patrón SPEC-004) y la validación real es follow-up de despliegue.
- **`TwelveDataProvider` (cotizaciones) queda sin usar**: **aceptable**, no lo exijo
  retirar. Sigue siendo un adaptador válido del puerto, su test está verde y documenta el
  contrato; ADR-012 lo desplaza como proveedor de precios, no lo prohíbe. Retirarlo sería
  limpieza (EPIC-MANT), no parte de este defecto.

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
- **F-ADR-012-2 (despliegue) — ✅ CERRADA**. `MARKETSTACK_API_KEY` estaba aprovisionada en
  Vercel (Production + Preview) desde el 2026-07-15; se comprobó con `vercel env ls` el
  2026-08-11. Nunca fue el bloqueo que este ledger temía. El bloqueo real era otro y nadie
  lo buscaba: **el código de esta épica no estaba desplegado** (ver aviso en
  `docs/despliegue.md`).
- **F-SPEC-015-1 (dialecto por verificar) — ⚠️ CERRADA PARCIALMENTE**. Verificado contra la
  API real el 2026-08-11: `BMEX`, `XETR`→`XETRA`, `XPAR` y `XAMS` correctos; **`XNAS` y
  `XNYS` estaban MAL** —Marketstack los quiere **pelados**, sin sufijo— y ese defecto es el
  que arregla **SPEC-020**. `XSTO` sigue sin resolver (**F-SPEC-020-1**). La sospecha que
  este follow-up dejó anotada era correcta: la tabla sin verificar escondía un fallo real
  que impedía cotizar **cualquier** valor estadounidense.
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
