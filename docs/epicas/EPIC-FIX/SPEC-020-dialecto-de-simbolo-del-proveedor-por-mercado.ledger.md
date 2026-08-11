---
id: SPEC-020
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-020 Dialecto de simbolo del proveedor por mercado

## Resumen
- Fase: **hecho**. Verificada GREEN 10/10, mergeada (`8177b92`, PR #22) y desplegada en
  produccion, donde WEN, TTD y PHM pasaron a cotizar.
- **F-SPEC-020-2 CERRADA (2026-08-11)**: el gate quedo firmado por el humano de forma
  **retroactiva** — aprobo la spec cuando ya estaba implementada, verificada y desplegada,
  tras planteársele que la aprobacion original era por delegacion y no por lectura. El
  bloqueo de `estado.mjs` fue **correcto** e hizo justo su trabajo: impidio que una
  aprobacion delegada se colara como firma humana. La entrada original del historial se
  conserva a proposito; el rastro no se reescribe.
- Rama: `ft/SPEC-020-dialecto-de-simbolo-del-proveedor-por-mercado`
- El dialecto del símbolo pasa a ser **conocimiento por mercado** en el adaptador
  (**ADR-012** pto. 4): hay mercados **con** sufijo (`BMEX`, `XETR`→`XETRA`, `XPAR`,
  `XAMS`) y mercados **sin** él (`XNAS`, `XNYS`, que Marketstack solo acepta **pelados**).
  Además, un fallo **global** del proveedor deja de tumbar el ciclo: degrada a fallo por
  símbolo con motivo veraz. Cierra **F-SPEC-015-1** en lo verificado; `XSTO` queda abierto.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (dialecto con sufijo: BMEX/XETR/XPAR/XAMS) | `marketstack-provider.ts` — tabla `PROVIDER_SUFFIX` (con procedencia del dato) + `providerSymbol()` | `market-provider-dialect.test.ts` › CA-1 (2 casos: la URL lleva `ITX.BMEX,SAP.XETRA,MC.XPAR,ASML.XAMS`; el eco vuelve canónico `XETR`) | Tests ejecutados por mí (verdes). Leída la URL espiada: `symbols=ITX.BMEX,SAP.XETRA,MC.XPAR,ASML.XAMS`. `PROVIDER_SUFFIX` cubre los 6 operating MIC de `mic.ts` salvo `XSTO`; `mic.ts` sin tocar (`git diff` vacío) | ✅ |
| CA-2 (dialecto SIN sufijo: XNAS/XNYS pelados) | `marketstack-provider.ts` — `PROVIDER_SUFFIX.XNAS/XNYS = null` → `providerSymbol()` devuelve el ticker pelado | `market-provider-dialect.test.ts` › CA-2 («XNAS y XNYS se piden PELADOS: en la URL no aparece ni .XNAS ni .XNYS») | Test propio con los 4 valores del defecto real: `symbols=WEN,DOCS,TTD,AAPL` y la URL completa no contiene la cadena `XNAS` en ninguna forma | ✅ |
| CA-3 (el eco del pelado casa y se persiste) | `marketstack-provider.ts` — `micEco` desde `row.exchange` + `askable.find(ticker && mic)`; persistencia sin cambios en `refresh.ts` | `market-provider-dialect.test.ts` › CA-3 (2 casos: `{symbol:"AAPL",exchange:"XNAS"}` → quote con `close`/`asOf`; y el ciclo lo persiste con la divisa del símbolo) | Test propio: los 4 ecos pelados casan con `micCode: 'XNAS'`, `price` = `close` (el `adj_close` de la fila era otro), `asOf` = `date`, y `currency` del proveedor se ignora (`undefined`) → la pone el símbolo en `refresh.ts` | ✅ |
| CA-4 (eco de otro mercado → sin precio, con motivo) | `marketstack-provider.ts` — sin `micEco` confirmado no se asigna precio; barrido final con `conPrecio` → `simbolo_no_admitido` | `market-provider-dialect.test.ts` › CA-4 («un eco con exchange XNYS NO se le asigna al pedido de XNAS») | Tests propios en los dos sentidos (pedido XNAS/eco XNYS y pedido XNYS/eco XNAS) y con mercado con sufijo (pedido BMEX/eco XETRA): `quotes` vacío y failure `simbolo_no_admitido`. Contraste comprobado: si el proveedor no devuelve NADA para el símbolo, sigue siendo `simbolo_desconocido` | ✅ |
| CA-5 (mismo ticker en XNAS y XNYS: sin duplicar y sin cruzar precios) | `marketstack-provider.ts` — `new Set(askable.map(a => a.sent))` en `symbols` + atribución por `exchange` del eco | `market-provider-dialect.test.ts` › CA-5 (3 casos: dedupe de la cadena enviada; el precio va a XNAS y XNYS falla; y el simétrico) | Tests propios: 1 llamada y `symbols=WEN` (no `WEN,WEN`); eco XNAS → precio a XNAS y XNYS a failures; eco XNYS → simétrico; dos ecos (uno por mercado) → cada precio a SU mercado; eco SIN `exchange` con ticker ambiguo → **nadie** recibe precio. Comprobado además a nivel de BD tras el ciclo: una única fila en `quotes` (mic `XNYS`) y el diagnóstico `simbolo_no_admitido` en el símbolo `XNAS` | ✅ |
| CA-6 (mercado sin dialecto conocido → `mercado_no_cubierto`, no se pide) | `marketstack-provider.ts` — `XSTO` sin entrada en `PROVIDER_SUFFIX` → `providerSymbol()` = `null` → failure antes de construir la URL. `mic.ts` NO se toca | `market-provider-dialect.test.ts` › CA-6 (3 casos: XSTO no viaja; si todo es XSTO no hay ni una llamada; el ciclo lo reporta con ese motivo) | Tests ejecutados (verdes) + test propio: con fallo global mezclado, `XSTO` conserva `mercado_no_cubierto` y no hereda el motivo del lote. `mic.ts` intacto: `XSTO` sigue siendo operating MIC del dominio | ✅ |
| CA-7 (fallo GLOBAL no tumba el ciclo) | `marketstack-provider.ts` — `fetchBody()` sustituye los dos `throw` por motivo clasificado para todos los pedidos | `market-provider-dialect.test.ts` › CA-7 (3 casos: HTTP 200 con `{error}`; HTTP no-OK; ciclo completo en 200 con disparos y avisos ejecutados) · `market-operating-mic.test.ts` (test de SPEC-015 actualizado) | Test propio del ciclo completo: `runCronCycle` → **200**, `triggers.opened = 1`, aviso enviado por el sender, diagnóstico `simbolo_no_admitido` persistido y **el precio anterior NO se borra** (P/L sigue vivo con el dato de ayer). Cuatro modos probados sin `throw`: 200 con `{error}`, HTTP no-OK, HTTP 500 con cuerpo ilegible y `fetch` que lanza. Ningún pedido desaparece (mezcla BMEX+XNAS+XSTO+legacy: 4 failures, 4 motivos distintos) | ✅ |
| CA-8 (rechazo de la petición ≠ caída del proveedor) | `provider.ts` — motivo nuevo `simbolo_no_admitido`; `fail-reason-text.ts` — su texto; `marketstack-provider.ts` — `classifyGlobal()` | `market-provider-dialect.test.ts` › CA-8 (3 casos: motivos distintos y ninguno `simbolo_desconocido`; red caída → `proveedor_no_disponible`; el texto ni acusa ni promete reintento) | `no_valid_symbols_provided` → `simbolo_no_admitido`; 5xx / red caída / timeout → `proveedor_no_disponible`; ninguno es `simbolo_desconocido`. Texto auditado: *«Nuestro proveedor no nos da precio para este símbolo en este mercado; lo estamos revisando»* — no dice deslistado, no promete reintento ni próximo ciclo, no filtra texto crudo del proveedor y no coincide con el de ningún otro motivo. `quote_diagnostics.reason` es `text`, no enum → el motivo nuevo no necesita migración | ✅ |
| CA-9 (el dominio degrada aunque el adaptador lance) | `refresh.ts` — `try/catch` alrededor de `provider.getQuotes` → todos los símbolos a `proveedor_no_disponible` | `market-provider-dialect.test.ts` › CA-9 (3 casos: adaptador que lanza; `MARKETSTACK_API_KEY` ausente; ciclo completo en 200) | Tests ejecutados (verdes) + test propio con adaptador que lanza **de forma síncrona** (no solo promesa rechazada): también degrada, diagnóstico persistido (SPEC-016 CA-2). Revisado además `quoteProvider()`: sin `MARKETSTACK_API_KEY` construye el adaptador sin lanzar, así que el 500 no puede colarse antes del `try` | ✅ |
| CA-10 (sin regresión: batch, RN-12, RN-09, diagnóstico, aislamiento) | Sin código nuevo: `provider.ts` (contrato `{quotes, failures}`, `quoteKey`) y `refresh.ts` (divisa del símbolo, diagnóstico) intactos | `market-provider-dialect.test.ts` › CA-10 (4 casos) + suite completa: 193/193 en 27 ficheros, y e2e 17/17 | Ejecutado por mí: `npx vitest run` **193/193** en 27 ficheros · `npx tsc --noEmit` limpio · `npx eslint .` **0 errores** (1 warning preexistente en `tests/position.test.ts`) · `npx playwright test` **17/17** (incluye `diagnostico-cotizacion.spec.ts` de SPEC-016) · `npx next build` OK con `DATABASE_URL`/`AUTH_SECRET` de relleno. F-SPEC-020-3 auditada: los 2 cambios en `market-operating-mic.test.ts` son exactamente lo que derogan CA-2 y CA-7, y ninguno debilita la aserción (el batch sigue exigiendo 1 llamada y la cadena completa; el fallo global pasa de `rejects.toThrow` a exigir el failure exacto por símbolo). El resto de SPEC-015/016 sin tocar | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-11, sdd-verificador.** 10/10 CA cerrados. Verificación adversarial sobre
la rama `ft/SPEC-020-dialecto-de-simbolo-del-proveedor-por-mercado`, sin editar código.

**Gates automáticos (ejecutados por mí, no heredados del implementador):**
`npx vitest run` → **193/193** en 27 ficheros · `npx tsc --noEmit` → limpio ·
`npx eslint .` → **0 errores** (1 warning preexistente y ajeno, `tests/position.test.ts`) ·
`npx playwright test` → **17/17** · `npx next build` con `DATABASE_URL`/`AUTH_SECRET` de
relleno → OK.

**Verificación independiente**: además de ejecutar la batería del implementador, escribí y
ejecuté una batería propia (15 casos, borrada tras usarse: no queda residuo en el árbol)
que ataca CA-2/3/4/5/7/8/9 desde ángulos que sus tests no cubren — los dos sentidos de la
colisión US, eco sin `exchange` con ticker ambiguo, dos ecos para la misma cadena, eco de
otro mercado en un mercado CON sufijo, HTTP 500 con cuerpo ilegible, `throw` síncrono del
adaptador, y comprobación **a nivel de BD** de dónde acaba el precio y dónde el
diagnóstico. Todos verdes.

**Lo que más se miró, y qué se encontró:**
- **CA-5**: la cadena viaja **una vez** (`symbols=WEN`) y el precio se atribuye **solo** al
  mercado que confirma el `exchange` del eco, en **ambas** direcciones. Tras el ciclo, la
  BD tiene **una** fila en `quotes` (la del mercado confirmado) y el diagnóstico en el
  otro símbolo. Si el eco no trae `exchange` y el ticker es ambiguo, **nadie** recibe
  precio: falla seguro. RN-09/RN-06 respetadas en el adaptador y en `refresh.ts`.
- **CA-7/CA-9**: el fallo global no mata nada. `runCronCycle` responde **200**, los disparos
  se evalúan (`opened = 1`), el aviso se envía y **el precio anterior no se borra**.
  `quoteProvider()` no lanza al construirse sin API key, así que no hay 500 antes del
  `try/catch`.
- **CA-8 / F-SPEC-020-4**: el texto es veraz en los dos usos del motivo. No acusa de
  deslistado, no promete reintento, no filtra texto crudo del proveedor. La reutilización
  del motivo para "rechazó la petición" y "respondió por otro mercado" **no miente**: en
  ambos, el proveedor respondió y no nos da precio para ese símbolo en ese mercado.
- **F-SPEC-020-3**: **auditada y correcta, no tapa ninguna regresión.** Los 2 cambios en
  `tests/market-operating-mic.test.ts` son exactamente las expectativas que CA-2 y CA-7
  derogan, y ninguna se debilita: el batch sigue exigiendo 1 llamada y la cadena completa,
  y el fallo global pasa de un `rejects.toThrow` genérico a exigir el failure exacto por
  símbolo. El resto de la suite de SPEC-015/016 está intacta (`git diff`: 2 hunks).
- **Ningún test toca la red.** Comprobado por inspección: `https://api.marketstack.com`
  solo aparece en `BASE_URL` del adaptador; **todas** las construcciones de
  `MarketstackProvider` en `tests/` inyectan `fetch`, y el e2e usa `E2E_FAKE_QUOTES=1`.
  No se ha gastado ni una llamada del free tier.
- **`next build`**: el fallo del worktree es, en efecto, `Error: DATABASE_URL no definida`
  al recolectar la page data de `/api/cron/refresh` — configuración local, **ajeno a esta
  spec**. Con variables de relleno el build pasa entero (TypeScript incluido).

**Estado de la spec: NO transicionado a propósito.** Sigue en `aprobada` por
F-SPEC-020-2 (`estado.mjs` no acepta la firma del gate como humana). No se ha forzado ni
tocado el frontmatter: lo desbloquea el humano o el orquestador.

**Riesgos residuales que dejo anotados (ninguno bloquea los CA):**
1. **El P/L mapea precios por TICKER, no por (ticker, MIC)** — `getPriceMap()` /
   `priceByTicker[ticker]` en `portfolio/service.ts:195`. Las posiciones se agrupan por
   `symbolId` (bien), pero el precio se busca por ticker: si un usuario tuviera el **mismo
   ticker en dos mercados**, ambas posiciones cogerían el mismo precio y el P/L de una
   sería falso (RN-09). Es **preexistente** (SPEC-002/004), está **fuera del alcance**
   declarado de esta spec y el adaptador ya hace lo correcto — pero es justo el escenario
   que CA-5 vuelve realista. Merece follow-up propio; hoy no hay ningún ticker duplicado
   en la cartera real.
2. **La atribución US depende de que el eco traiga `exchange: "XNAS"/"XNYS"`.** Está
   verificado contra la API real (2026-08-11, tabla del Problema) y yo **no** lo he
   re-sondeado (prohibido: free tier). Si el proveedor devolviera ahí otra cosa, el fallo
   es **seguro** (sin precio, con motivo veraz), nunca un precio equivocado. Confirmarlo
   en producción es el punto 3 del handoff.
3. **El texto del motivo nuevo no se ha visto renderizado en navegador**: el catálogo fake
   del e2e no produce `simbolo_no_admitido`, y forzarlo exigía tocar código. La ruta de
   render es la compartida `failReasonText()`, ya ejercitada e2e con otro motivo
   (`diagnostico-cotizacion.spec.ts`, verde), y el texto (89 car.) está en el rango de los
   ya renderizados (74 car.). Riesgo de maquetación: bajo.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-020/. Informe HTML opcional: _qa/SPEC-020/informe.html -->

Sin capturas: **SPEC-020 no toca UI**. Ningún fichero de `src/app/**` cambia
(`git diff --name-only`: 4 de código, todos en `src/lib/market/`). La evidencia de que la
UI no ha regresionado es la suite e2e completa en navegador (**17/17**, Chromium 1280×720),
que incluye `diagnostico-cotizacion.spec.ts` (SPEC-016: motivo visible en `/vigiladas` y
`/cartera`), `avisos-zona.spec.ts` (SPEC-007) e `ingesta-cartera.spec.ts` (SPEC-004: el
precio ingerido alimenta el P/L con su `asOf`).

## Salvedades / follow-ups
<!-- IDs F-SPEC-020-1, F-SPEC-020-2… con destino (spec futura o EPIC-MEJORA). -->

- **F-SPEC-020-1 (`XSTO` sin dialecto resuelto)** — abierto ya en la spec, no descubierto
  en implementación. Fallaron `ERIC.XSTO`, `ERIC_B.XSTO` y `VOLV_B.XSTO`. **No se inventa
  el formato**: el mercado se declara no cubierto (CA-6) hasta resolverlo con un sondeo
  presupuestado (~88 llamadas libres este mes) o vía `/tickers?exchange=XSTO`. Sin impacto
  en la cartera real de hoy. Destino: follow-up de despliegue de EPIC-FIX.
- **Cierra F-SPEC-015-1 parcialmente**: `BMEX`, `XETR`, `XPAR`, `XAMS`, `XNAS` y `XNYS`
  quedan **verificados contra la API real** (2026-08-11, ver tabla del Problema en la
  spec). Lo que queda vivo de aquella salvedad es exactamente `XSTO` → F-SPEC-020-1.

Añadidas en implementación (2026-08-11, sdd-implementador):

- **F-SPEC-020-2 (el estado de la spec no se pudo transicionar)** — **bloqueo de proceso,
  no de código**. `estado.mjs` rechaza `aprobada → en-progreso` y `→ en-revision`:
  *"exige una aprobación humana previa, y el historial de esta spec no tiene ninguna
  entrada 'aprobada' firmada por una persona"*. El historial lleva la firma
  `sdd-orquestador (delegacion de Alberto Fojo)`, que el state machine no acepta como
  humana. **No se ha forzado ni falsificado ninguna firma** (regla dura del rol): la spec
  sigue en `aprobada` y el frontmatter **no se ha tocado**. Lo resuelve el orquestador o
  el humano en el gate, no el implementador. Destino: gate de EPIC-FIX.
- **F-SPEC-020-3 (dos tests de SPEC-015 cambiados a propósito)** — no es deriva: son las
  dos expectativas que SPEC-020 **deroga** explícitamente, ambas en
  `tests/market-operating-mic.test.ts`. (a) el batch esperaba `AAPL.XNAS` y ahora espera
  `AAPL` pelado (CA-2); (b) el fallo global esperaba `rejects.toThrow` y ahora espera
  degradación a fallo por símbolo (CA-7 — ese `throw` era el 500 que mataba el ciclo de
  todos los usuarios). El resto de la suite de SPEC-015/016 pasa **sin tocar**.
- **F-SPEC-020-4 (motivo de "el proveedor respondió, pero no para este mercado")** — el
  eco de otro mercado (CA-4/CA-5) reutiliza el motivo nuevo `simbolo_no_admitido` de CA-8,
  porque la spec concede **un** motivo nuevo, no dos. Su texto se redactó para ser cierto
  en los dos casos ("no nos da precio para este símbolo en este mercado"). Si con uso real
  se ve que conviene separarlos ("rechazó la petición" vs. "respondió por otro mercado"),
  es EPIC-MEJORA, no defecto.
- **`next build` exige `DATABASE_URL`/`AUTH_SECRET`** en el árbol de trabajo (no hay `.env`
  en este worktree): falla al recolectar la page data de `/api/cron/refresh`. **Preexistente
  y ajeno a esta spec**; con las variables puestas el build pasa. No se abre follow-up: es
  configuración local, ya cubierta por `.env.example` y `docs/despliegue.md`.

Abierta por el orquestador tras el GREEN (2026-08-11):

- **F-SPEC-020-5 (el P/L resuelve el precio por TICKER, no por `(ticker, MIC)`)** —
  **defecto preexistente, ajeno a SPEC-020, que esta spec vuelve alcanzable**. En
  `src/lib/portfolio/service.ts` (`getPriceMap()` / `priceByTicker[ticker]`) las posiciones
  se agrupan bien por `symbolId`, pero el precio se busca **por ticker**: con el mismo
  ticker en dos mercados, ambas posiciones cogerían el mismo precio y una tendría un P/L
  **falso**, violando RN-09. El adaptador y `refresh.ts` hacen lo correcto —CA-4/CA-5
  garantizan que cada precio va a su mercado— y el fallo está aguas abajo, en la lectura.
  Hoy no hay tickers duplicados en la cartera real, así que no está ardiendo; pero al abrir
  Nasdaq y NYSE (esta spec) el escenario deja de ser teórico: `SAN` cotiza en BMEX y en
  NYSE. Lo destapó el verificador auditando CA-5. Destino: defecto para EPIC-FIX.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Implementación completa (sdd-implementador, 2026-08-11)**, rama
`ft/SPEC-020-dialecto-de-simbolo-del-proveedor-por-mercado`. Los 10 CA tienen código y
test. **Todo queda en el árbol de trabajo: SIN commit, SIN push y SIN desplegar** — esas
etapas se las reservó el humano de forma explícita.

Ficheros tocados (4 de código + 2 de test):
- `src/lib/market/marketstack-provider.ts` — el grueso: `PROVIDER_SUFFIX` (dialecto **por
  mercado**, con la procedencia del dato documentada en el propio comentario),
  `providerSymbol()`, dedupe de la cadena enviada, atribución por `exchange` del eco y
  `fetchBody()` (ningún `throw` por el proveedor).
- `src/lib/market/provider.ts` — motivo nuevo `simbolo_no_admitido` en `QuoteFailureReason`.
- `src/lib/market/fail-reason-text.ts` — su texto de usuario.
- `src/lib/market/refresh.ts` — `try/catch` sobre `provider.getQuotes` (CA-9).
- `tests/market-provider-dialect.test.ts` — **nuevo**, 25 casos, CA-1..CA-10.
- `tests/market-operating-mic.test.ts` — 2 expectativas de SPEC-015 derogadas por esta
  spec (ver F-SPEC-020-3).
- `src/lib/market/mic.ts` **no se ha tocado**, como manda la spec.

Verificación ejecutada por el implementador (la adversarial es del verificador):
`npx vitest run` 193/193 en 27 ficheros · `npx tsc --noEmit` limpio · `npx eslint .` 0
errores (1 warning preexistente en `tests/position.test.ts`, ajeno) · `npx next build` OK
con `DATABASE_URL`/`AUTH_SECRET` de relleno · `npx playwright test` 17/17.

**Ningún test llama a la API real de Marketstack**: todos usan `fetch` inyectado o fakes.
La tabla de dialecto NO se re-sondeó (free tier ~100 req/mes) y va documentada en el
código con su fecha de verificación para que nadie la cambie a ciegas.

Pendiente para la siguiente sesión:
1. **Desbloquear el estado de la spec** (F-SPEC-020-2): sigue en `aprobada` porque
   `estado.mjs` no acepta la firma del orquestador como humana; no la he forzado.
2. **sdd-verificador** sobre esta rama.
3. Tras desplegar, comprobar en producción que DOCS, TTD y WEN cotizan y que PHM (BMEX)
   no ha regresionado — es el síntoma que originó la spec.
4. `XSTO` sigue sin dialecto (F-SPEC-020-1): un valor sueco no cotiza y **lo dice**.
