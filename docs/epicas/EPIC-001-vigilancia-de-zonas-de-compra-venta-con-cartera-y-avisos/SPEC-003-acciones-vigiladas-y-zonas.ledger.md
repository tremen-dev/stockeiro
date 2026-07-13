---
id: SPEC-003
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-003 Acciones vigiladas y zonas

## Resumen
- Fase: en-revisión (10 CA implementados con test; unit + e2e en verde). Pendiente de verificación.
- Rama: `ft/SPEC-003-acciones-vigiladas-y-zonas`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/watchlist/service.ts` (watchSymbol sin zonas) · `src/db/schema.ts` (watched_symbols) · `src/app/vigiladas/*` | `tests/watchlist-service.test.ts` › "CA-1…" · **e2e** vigiladas.spec.ts | | ❌ |
| CA-2 | `service.ts` (watchSymbol con zonas) | `tests/watchlist-service.test.ts` › "CA-2…" · **e2e** (ca2-vigilar-con-zonas.png) | | ❌ |
| CA-3 | `service.ts` (validatePair, InvalidZoneError) | `tests/watchlist-service.test.ts` › "CA-3…" (min>max, par incompleto) · **e2e** (ca3-rango-invalido.png) | | ❌ |
| CA-4 | `service.ts` (watchSymbol upsert) | `tests/watchlist-service.test.ts` › "CA-4/CA-10…" | | ❌ |
| CA-5 | `service.ts` (unwatch) · `src/app/vigiladas/actions.ts` (removeAction) | `tests/watchlist-service.test.ts` › "CA-5…" | | ❌ |
| CA-6 | `src/lib/watchlist/zones.ts` (entraEnZona, RN-11) | `tests/zones.test.ts` › "entraEnZona…" (dentro, extremos inclusive, fuera, ausente) | | ❌ |
| CA-7 | `src/lib/watchlist/zones.ts` (zonasEntradas) | `tests/zones.test.ts` › "zonasEntradas…" (compra/venta, solape, sin zonas) | | ❌ |
| CA-8 | `src/lib/portfolio/symbols.ts` (getOrCreateSymbol) | `tests/watchlist-service.test.ts` › "CA-8…" | | ❌ |
| CA-9 | `service.ts` (filtrado userId, getWatchedForOwner) · `ownership.ts` | `tests/watchlist-service.test.ts` › "CA-9…" | | ❌ |
| CA-10 | `service.ts` (upsert por unique(userId,symbolId)) · `schema.ts` (UNIQUE) | `tests/watchlist-service.test.ts` › "CA-4/CA-10…" | | ❌ |

Cobertura automática (implementador): **55 unit verdes** (16 nuevos: 8 zones + 8 servicio) y **8/8 e2e verdes** (incl. regresión auth+cartera). `eslint` 0, `tsc` 0, `next build` verde.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
Capturas del flujo real (Playwright) en `_qa/SPEC-003/`: `ca2-vigilar-con-zonas.png`, `ca3-rango-invalido.png`. Regenerables con `npx playwright test`.

## Salvedades / follow-ups
- **F-SPEC-003-1** (depende de Ingesta+Motor): el predicado `entraEnZona`/`zonasEntradas`
  está listo y probado, pero NO se evalúa contra precios reales todavía (no hay ingesta
  ni motor periódico). El Motor de disparo lo consumirá.
- **F-SPEC-003-2** (coherencia de base de precio): la zona debe compararse contra el
  precio en la misma base ajustada/no-ajustada con que el usuario la definió; garantizarlo
  es de la spec de Ingesta (dictamen sdd-mercados). Aquí se asume "precio observado".

## Cómo retomar (handoff)
- **Qué está hecho:** los 10 CA con test (unit + e2e). Modelo `watched_symbols`
  (zonas opcionales, único por user+símbolo), predicado puro de zona (RN-11, cierra
  R-2), servicios (vigilar/upsert/validar/listar/quitar, aislamiento) y exposición
  mínima `/vigiladas`. 55 unit + 8 e2e verdes.
- **Qué falta (verificador):** verificación adversarial — extremos inclusive del
  predicado (CA-6), aislamiento (CA-9), upsert sin duplicar (CA-10); regenerar
  capturas y emitir GREEN/RED.
- **Cómo correr:** `npx vitest run` (unit) y `npx playwright test` (e2e).
