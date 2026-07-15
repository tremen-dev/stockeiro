---
id: SPEC-016
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-016 Diagnostico visible del simbolo sin cotizacion

## Resumen
- Fase: en-revision (implementación completa; pendiente de verificador)
- Rama: `ft/SPEC-016-diagnostico-visible-del-simbolo-sin-cotizacion`
- El puerto deja de tragarse el motivo (ADR-012 pto. 6): `getQuotes` pasa a devolver
  `{quotes, failures}` con **motivos clasificados del dominio**. Se persisten en la tabla
  nueva `quote_diagnostics` (por símbolo) y se muestran en `/vigiladas` y `/cartera`.
  **RN-06 intacto**: sin precio NO se calcula P/L; solo deja de ser un guion mudo.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (motivo propagado y CLASIFICADO) | `market/provider.ts` (`QuoteFailureReason`, `ProviderFailure`, `QuotesResult`); `marketstack-provider.ts` (`classify`); `fail-reason-text.ts` | `tests/quote-diagnostics.test.ts` › CA-1 (2 casos) + e2e (el texto crudo no llega a la UI) | | ❌ |
| CA-2 (se persiste el último diagnóstico) | `db/schema.ts` (`quote_diagnostics`); `market/quotes.ts` (`upsertDiagnostic`); `refresh.ts` | `quote-diagnostics.test.ts` › CA-2 (motivo + attemptedAt; 1 fila por símbolo) | | ❌ |
| CA-3 (distinguir "sin datos aún" de "no se puede cotizar") | `zone-status.ts` (`failReason`); `vigiladas/page.tsx` | `quote-diagnostics.test.ts` › CA-3 + `e2e/diagnostico-cotizacion.spec.ts` › CA-3/CA-4 | | ❌ |
| CA-4 (visible en /vigiladas) | `vigiladas/page.tsx`; `globals.css` (`.quote-fail`/`.quote-pending`) | `quote-diagnostics.test.ts` › CA-4 + e2e › CA-3/CA-4 (`data-reason`, screenshot) | | ❌ |
| CA-5 (visible en /cartera junto al "—") | `cartera/page.tsx`; `market/quotes.ts` (`getDiagnosticMap`) | `quote-diagnostics.test.ts` › CA-5/CA-6 + e2e › CA-5/CA-6 (screenshot) | | ❌ |
| CA-6 (RN-06 intacto) | sin cambios en `portfolio/position.ts` ni `service.ts` | `quote-diagnostics.test.ts` › CA-5/CA-6 (plActual null, actualTotal null, realizado aparte) | | ❌ |
| CA-7 (la resiliencia no se rompe) | `refresh.ts` (se salta y sigue) | `quote-diagnostics.test.ts` › CA-7; `market-refresh.test.ts` › CA-6 (SPEC-004) sigue verde | | ❌ |
| CA-8 (el diagnóstico se limpia al resolverse) | `market/quotes.ts` (`clearDiagnostic`); `refresh.ts` | `quote-diagnostics.test.ts` › CA-8 (desaparece y la fila vuelve a la normalidad) | | ❌ |
| CA-9 (aislamiento RN-01) | `zone-status.ts` (filtra por `userId`) | `quote-diagnostics.test.ts` › CA-9 | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-016/. Informe HTML opcional: _qa/SPEC-016/informe.html -->

## Decisiones de diseño (la spec dejaba la forma abierta)

**1. El puerto cambia de contrato: `getQuotes` devuelve `QuotesResult`, no `ProviderQuote[]`.**
El motivo tenía que cruzar el puerto o CA-1 era imposible. Alternativa descartada: meter un
`error` dentro de `ProviderQuote` — obligaría a todo consumidor a comprobar si cada "cotización"
es en realidad un fallo, y ensucia el tipo que el dominio usa para calcular. Con `{quotes, failures}`
el que solo quiere precios sigue leyendo `quotes` y nada más. Afecta a los 3 adaptadores
(`marketstack`, `fake`, `twelve-data`) — los tres actualizados; `twelve-data-provider` sigue sin
uso para cotizaciones (ADR-012) pero se mantuvo compilando y con su test verde.

**2. Motivos del dominio, no texto del proveedor** (`QuoteFailureReason`, 4 categorías). El
adaptador TRADUCE (`classify()` en `marketstack-provider.ts`) igual que traduce el dialecto de MIC
(ADR-012): "**symbol** ITX is not available with your plan" es vocabulario de Marketstack, no de
Stockeiro. Si mañana se cambia de proveedor, la UI no se entera. El test CA-1 usa la respuesta
**real** del free tier (verificada 2026-07-15) como fixture, no una inventada.

**3. Tabla propia `quote_diagnostics`, no una columna en `quotes`.** Determinante: el caso que
más duele —el símbolo que NUNCA se ha podido cotizar— no tiene fila en `quotes`. Una columna
exigiría insertar filas de cotización sin cotización (`price` null), y eso rompería a todo el que
lee `quotes` dando por hecho que hay precio (RN-06 se defiende hoy por ausencia de fila). Tabla
aparte = `quotes` intacta y el diagnóstico se borra con `clearDiagnostic` sin tocar precios.
Compartida por símbolo (no por usuario): el motivo no depende de quién mire (igual que `quotes`).

**4. Esquema en los 3 sitios**: `src/db/schema.ts` + migración `0005_quote_diagnostics` +
`src/db/test-db.ts` + `tests/e2e/server.mjs`. Los tres llevan el esquema en paralelo.

## Salvedades / follow-ups
<!-- IDs F-SPEC-016-1, F-SPEC-016-2… con destino (spec futura o EPIC-MEJORA). -->

- **Cierra la ⚠️ de CA-10 de SPEC-015.** El verificador la marcó parcial porque los símbolos sin
  operating MIC canónico dejaban de cotizarse **en silencio**, y difirió la visibilidad aquí. Con
  esta spec, ese caso emite `sin_identidad_de_mercado` y se ve en `/vigiladas` (CA-4). Es la
  razón por la que SPEC-016 no era opcional para CE-F2.
- **F-SPEC-016-1** — El E2E siembra `quote_diagnostics` por SQL directo (`sembrarDiagnostico`) en
  vez de hacer correr el ciclo real contra el fake. Prueba lo que le toca (que la UI lo pinta y lo
  distingue), pero el camino ciclo→BD→UI completo solo está cubierto en unit. `E2E_FAILURES` ya
  existe en `quote-provider-factory.ts` para hacerlo end-to-end si se añade un disparo del cron
  desde el E2E. Destino: EPIC-MEJORA.
- **F-SPEC-016-2** — `proveedor_no_disponible` (caída/5xx del proveedor) no tiene test propio: es
  el `default` de `classify()` y se cubre por descarte. Los otros 3 motivos sí tienen aserto
  directo. Destino: EPIC-MEJORA.
- **No cierra F-ADR-012-2 ni F-SPEC-015-1**: siguen abiertas y son de despliegue/verificación de
  dialectos, ajenas a esta spec.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Implementación COMPLETA y verde.** Gates en local: `npx tsc --noEmit` 0 errores · `npx eslint`
0 errores (1 warning **preexistente**: `LedgerEntry` sin usar en `tests/position.test.ts`, no es
de esta spec) · `npx vitest run` 26 ficheros · `npm run build` OK · `npx playwright test` 17/17.

Qué falta: **sdd-verificador** (columnas Verif./Estado del ledger + veredicto), push y PR. No
fusionado. Capturas del E2E en `_qa/SPEC-016/` (`vigiladas-motivo.png`, `cartera-motivo.png`).

Tests nuevos: `tests/quote-diagnostics.test.ts` (CA-1..CA-9, 9 casos) y
`tests/e2e/diagnostico-cotizacion.spec.ts` (2 tests: CA-3/CA-4 en vigiladas, CA-5/CA-6 en cartera).

Punto de atención para quien verifique: `refresh.ts` cambió `RefreshResult.skipped` de `string[]`
a `SkippedSymbol[]`. `tests/market-refresh.test.ts` › CA-6 (SPEC-004, resiliencia) se ajustó a la
nueva forma **añadiendo** el aserto del motivo — se reforzó, no se relajó para que pasara.
