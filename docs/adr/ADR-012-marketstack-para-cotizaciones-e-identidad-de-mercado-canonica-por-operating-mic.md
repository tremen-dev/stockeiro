---
id: ADR-012
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-15, por: humano (Alberto Fojo)}
---
# ADR-012: Marketstack para cotizaciones e identidad de mercado canonica por operating MIC

- Deciders: propone sdd-arquitecto, con **dictamen de dominio de sdd-mercados (2026-07-15) verificado CONTRA LA API REAL** (no solo documentación); aprueba el humano (gate). EPIC-FIX.
- Specs relacionadas: origina **SPEC-015** (Proveedor de cotizaciones con cobertura del mercado real) y **SPEC-016** (Diagnóstico visible del símbolo sin cotización). **Reinterpreta ADR-002** (proveedor de cotizaciones) y **cierra un hueco de ADR-007** (qué MIC es la identidad). Toca la tabla `MARKET_MAP` de **ADR-009** (F-SPEC-012-1). No altera el ledger (ADR-003) ni la cadencia/base de precio (ADR-004: sigue el último cierre NO ajustado, RN-12).

## Contexto

**El defecto, verificado en producción (2026-07-15).** El free tier de Twelve Data **no
cubre BME/M.CONTINUO**: `/eod?symbol=ITX` → `404 "This symbol is available starting with
the Pro plan"`. La cartera real del usuario es **~82% mercado continuo español** (204 de
250 operaciones del extracto de ING). Consecuencia: **CE-1** (cero zonas perdidas) y
**CE-3** (P/L al día) de EPIC-001 **no se cumplen** desde el despliegue. Y el fallo es
**silencioso**: el ciclo responde `200`, `refreshQuotes` marca el símbolo como `skipped`
(CA-6 de SPEC-004, resiliencia por diseño) y el motivo del proveedor se descarta; el
usuario solo ve *"sin cotización"*.

**ADR-002 fijó Twelve Data "por su free tier diario" sin verificar que ese free tier
cubriera el mercado principal del usuario.** Premisa incompleta: de ahí este ADR.

**Dictamen sdd-mercados (2026-07-15), verificado contra la API real:**
- **Twelve Data**: Basic (free) = **3 mercados**; **Pro = $229/mes** es el mínimo con
  Europa (la ficha de XMAD exige "Pro+/Venture+"; los dos mensajes de error distintos se
  explican porque hay **dos familias de planes**, Individual y Business).
- **Marketstack** cubre los **7 mercados** del extracto (`BMEX`, `XNAS`, `XNYS`, `XETRA`,
  `XSTO`, `XPAR`, `XAMS`). Llamada real en **free tier**:
  `GET /v1/eod/latest?symbols=ITX.BMEX,SAN.BMEX,TEF.BMEX` → `200`, **batch de 3 en 1
  llamada**, devolviendo por fila `{symbol:"ITX.BMEX", exchange:"BMEX",
  date:"2026-07-14T00:00:00+0000", close:53.72, adj_close:53.72, split_factor:1,
  dividend:0}`. Es decir: **`close` NO ajustado** (RN-12 nativo), **`exchange` = el MIC
  pedido** (el eco **casa**), **`date` = asOf** (D-2).
- **Cross-check que valida el dato**: `SAN.BMEX` 11,984 € × ~1,138 EUR/USD ≈ **13,63 USD**
  = exactamente lo que Twelve Data devolvió para `SAN` en NYSE. **El mismo valor en dos
  mercados y dos divisas** — prueba empírica de por qué RN-09/ADR-007 exigen el MIC.
- **Yahoo**: rechazo **ratificado** (ToS "personal use only" —más grave ahora, con
  testers— y endpoints no oficiales que se bloquean sin aviso → romperían CE-1).
  **Stooq**: sin API. **EODHD** (€19,99): buen encaje técnico pero licencia "personal use".

**El hueco de ADR-007.** ADR-007 fijó la identidad del símbolo como `(ticker, mic_code)`
pero **nunca dijo CUÁL MIC**. ISO 10383 distingue **operating MIC** (el operador:
`BMEX`, `XNAS`) de **segment MIC** (el segmento concreto: `XMAD`, `XNGS`/`XNMS`/`XNCM`).
Cada proveedor elige distinto: Twelve Data `/symbol_search` devuelve **segmento**
(`XNGS` para MSFT; `XNYS` para SAN), Marketstack devuelve **operating** (`BMEX`, `XNAS`).
**Esta ambigüedad es la raíz de dos defectos**: (a) el eco de `mic_code` que no casa en
`refresh.ts` (`quoteKey(ticker, micCode)` no empareja → `skipped` silencioso) y (b) la
tabla `MARKET_MAP` de ADR-009 que mapea `M.CONTINUO→XMAD` (**F-SPEC-012-1**). Sin
canonizar, el bug reaparece con el proveedor siguiente.

**Verificación propia (sdd-arquitecto, 2026-07-15): la búsqueda de Marketstack NO sirve.**
`/tickers?search=inditex` devuelve `ITX.XMIL` (Milán), `IXD1.XFRA`, `IXD1.XETRA`,
`ITX/N` — **pero NO `ITX.BMEX`**, aunque su precio sí existe y `/tickers?exchange=BMEX`
lo lista el primero. Igual con "santander" (Brasil/Varsovia/NYSE, **no** `SAN.BMEX`).
→ **No se puede unificar todo en Marketstack.** Y esto **valida ADR-007**, que separó
`SymbolSearchProvider` de `MarketDataProvider` precisamente porque *"un proveedor podría
dar búsqueda y otro precios"*.

## Decisión

1. **Marketstack pasa a ser el adaptador de COTIZACIONES** (`MarketDataProvider`,
   ADR-002), sustituyendo a `TwelveDataProvider`. Endpoint `/v1/eod/latest`, formato de
   símbolo `TICKER.MIC`, **batch en una llamada** (se mantiene el invariante de ADR-002:
   1 símbolo = 1 llamada por ciclo, dedupe por símbolo). Se toma `close` (NO ajustado,
   RN-12), `date` como `asOf` (D-2) y la divisa del símbolo (RN-09). **Reinterpreta el
   punto de ADR-002 que fijaba Twelve Data como primer adaptador; el resto de ADR-002
   (puerto, símbolo compartido, caché deduplicada) sigue vigente.**
2. **Twelve Data se MANTIENE, en free tier, solo para la BÚSQUEDA** de símbolos
   (`SymbolSearchProvider`, SPEC-008/ADR-007): su `/symbol_search` sí funciona en free y
   el de Marketstack no encuentra Madrid (verificado). **Dos proveedores, cada uno tras
   su puerto**, exactamente el escenario que ADR-007 previó.
3. **La identidad canónica del símbolo es `(ticker, operating MIC)`** (ISO 10383):
   `BMEX`, `XNAS`, `XNYS`, `XETR`, `XSTO`, `XPAR`, `XAMS`. Se elige **operating** sobre
   segment porque es **más estable** (los segmentos cambian y se subdividen) y porque es
   lo que devuelve el proveedor de cotizaciones, que es quien **debe casar**.
   `symbols.micCode` guarda **siempre el operating MIC**.
4. **La traducción vive en los ADAPTADORES, nunca en el dominio** (es la razón de ser del
   puerto):
   - **Adaptador de búsqueda (Twelve Data)**: normaliza el `mic_code` de **segmento →
     operating** antes de devolver `SymbolMatch` (p. ej. `XNGS`/`XNMS`/`XNCM`→`XNAS`,
     `XMAD`→`BMEX`).
   - **Adaptador de cotizaciones (Marketstack)**: traduce el operating MIC canónico a su
     propio dialecto al construir `TICKER.MIC` (p. ej. `XETR`→`XETRA`, que **no es un MIC
     ISO válido** pero es lo que ellos usan) y valida que el `exchange` devuelto **casa**.
   - El mapa ISO **segmento→operating** y el catálogo de operating MIC soportados viven en
     un módulo de dominio (`market/mic.ts`): son conocimiento **de mercado** (ISO 10383),
     no de proveedor.
5. **`MARKET_MAP` (ADR-009/SPEC-012) se corrige** a operating MIC: `M.CONTINUO→BMEX` (no
   `XMAD`), y se revisa el resto. Cierra **F-SPEC-012-1**.
6. **El contrato del puerto deja de tragarse el motivo** (CE-F2): `getQuotes` pasa a poder
   informar, por símbolo, **por qué** no hubo precio (no cotizado por el plan, símbolo
   desconocido, fallo del proveedor). La resiliencia de CA-6 se mantiene —un símbolo que
   falla no aborta el ciclo—, pero **el motivo se propaga** en vez de descartarse. El
   detalle de forma y de UI lo fija SPEC-016.
7. **La identidad del dominio NO cambia**: sigue siendo `(ticker, mic_code)` de ADR-007.
   Solo se **precisa cuál** MIC. Los símbolos ya persistidos con MIC de segmento se
   **backfillan** a operating (ver follow-ups).

## Consecuencias

### Positivas
- **Restaura la promesa**: CE-1 y CE-3 vuelven a cumplirse para el mercado real del
  usuario (~82% de su cartera), **verificado contra la API real** antes de decidir.
- **$0 de arranque** (CE-F3): el free tier de Marketstack sirve BMEX y el consumo real
  (~30 llamadas/mes) cabe en las 100.
- **Mata el descarte silencioso por construcción**: el `exchange` devuelto **casa** con el
  pedido, así que el emparejado por `quoteKey` deja de fallar.
- **Cero cambios de dominio**: puerto, ledger, cartera, motor de disparo y avisos intactos.
  Es un **adaptador** — justo lo que ADR-002 compró al introducir el puerto.
- **Canonizar el MIC arregla dos defectos con una decisión** (el eco y F-SPEC-012-1) y
  evita que reaparezcan con el proveedor siguiente.
- Bonus: Marketstack expone `split_factor`/`dividend`, que haría más viable el ajuste por
  eventos corporativos que EPIC-002 dejó fuera (no entra aquí).

### Negativas / follow-ups
- **Dos proveedores = dos cosas que pueden romperse** (búsqueda en Twelve Data,
  cotizaciones en Marketstack). Se acepta porque la alternativa (unificar) **no existe**:
  la búsqueda de Marketstack no encuentra Madrid. Mitigación: ambos tras su puerto.
- **Riesgo de licencia (R-F1 de EPIC-FIX)**: el free tier de Marketstack **no concede
  derechos de uso comercial** y la app se compartirá con testers. Ambigüedad **asumida
  por el humano** en el gate; mitigación: pasar a Basic ($9.99/mes) es cambiar de plan,
  misma key, cero código.
- **Migración de datos (F-ADR-012-1)**: producción ya tiene `symbols.micCode` con MIC de
  **segmento** (de `/symbol_search`) o `null` (legacy pre-ADR-007). Hay que **backfillar a
  operating MIC**; los que no se puedan mapear quedan marcados y no se cotizan hasta
  resolverse. Lo acota SPEC-015.
- **El dialecto de Marketstack no es ISO estricto** (`XETRA` en vez de `XETR`): la tabla
  de traducción del adaptador hay que **verificarla mercado a mercado** contra la API real
  (no solo BMEX). Follow-up de despliegue.
- **Calidad de datos de Marketstack**: sus nombres traen mojibake (`INDUSTRIA DE DISEO
  TEXTIL` por `DISEÑO`). No afecta a precios (solo se usa el `close`), pero descarta
  usarlos para mostrar nombres.
- **`MARKETSTACK_API_KEY`** debe añadirse a `.env.example` y al runbook
  (`docs/despliegue.md`), y aprovisionarse en Vercel. Follow-up de despliegue
  (**F-ADR-012-2**), como F-SPEC-004-1 en su día.
- **Lección de ADR-002**, que este ADR paga: **verificar la cobertura del mercado real
  ANTES de fijar un proveedor**, no su free tier en abstracto.

## Alternativas consideradas
- **Pagar Twelve Data Pro ($229/mes)**: arregla el defecto con **cero código** (mismo
  adaptador). Rechazada por **coste desproporcionado** — 23× la alternativa — para un
  proyecto sin ingresos, y porque no resuelve el hueco del MIC (seguiría devolviendo
  segmentos).
- **Yahoo Finance**: cubre BME, pero rechazo **ratificado** por sdd-mercados — ToS
  "personal use only" (agravado por los testers) y endpoints no oficiales que se bloquean
  sin aviso, lo que **rompería CE-1**, que es justo lo que esta épica arregla. Arreglaría
  el síntoma introduciendo un riesgo mayor que el problema.
- **EODHD (€19,99/mes)**: excelente encaje técnico (`close`/`adjusted_close` explícitos,
  los 5 mercados europeos). Rechazada frente a Marketstack por **coste** (2× con free tier
  descartado) y **licencia "personal use"** — la misma fricción que Marketstack, pero
  pagando. Queda como **segundo adaptador** si Marketstack falla.
- **Stooq**: gratis y con cobertura europea, pero **no tiene API** (solo descarga CSV por
  web). Rechazada: sería scraping, con el mismo problema de fiabilidad que Yahoo.
- **Unificar todo en Marketstack** (búsqueda + cotizaciones): **imposible**, verificado —
  su `/tickers?search=` no encuentra los valores de Madrid.
- **Quitar el `mic_code` de la petición** para que el proveedor resuelva solo: **peor que
  el bug**. Devolvería el mercado y la divisa equivocados (SAN→NYSE en USD para una
  posición de Madrid en EUR) y falsearía el P/L en silencio. Lo prohíben RN-09/RN-06 y es
  exactamente lo que ADR-007 vino a impedir.
- **Canonizar en segment MIC** en vez de operating: rechazada — los segmentos cambian, no
  todos los proveedores los devuelven, y el de cotizaciones (quien debe casar) usa
  operating.
- **Múltiples cuentas free**: fuera de alcance por decisión de producto (EPIC-FIX), viola
  ToS y es innecesario (~30 de 100 llamadas/mes).

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
