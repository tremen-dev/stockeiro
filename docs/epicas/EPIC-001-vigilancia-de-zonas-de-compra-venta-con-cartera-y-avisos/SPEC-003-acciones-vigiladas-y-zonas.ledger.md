---
id: SPEC-003
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-003 Acciones vigiladas y zonas

## Resumen
- Fase: GREEN — los 10 CA verificados (unit + e2e + probe del predicado). Spec a `hecho`.
- Rama: `ft/SPEC-003-acciones-vigiladas-y-zonas`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/watchlist/service.ts` (watchSymbol) · `schema.ts` (watched_symbols) · `src/app/vigiladas/*` | `tests/watchlist-service.test.ts` › "CA-1…" · **e2e** vigiladas.spec.ts | **Verificado:** vigilar sin zonas crea la entrada; visible en /vigiladas. | ✅ |
| CA-2 | `service.ts` (watchSymbol con zonas) | `tests/watchlist-service.test.ts` › "CA-2…" · **e2e** (ca2-vigilar-con-zonas.png) | **Verificado:** rangos guardados; en UI "20 – 25" / "35 – 40". | ✅ |
| CA-3 | `service.ts` (validatePair, InvalidZoneError) | `tests/watchlist-service.test.ts` › "CA-3…" · **e2e** (ca3-rango-invalido.png) | **Verificado:** min>max y par incompleto rechazados; en UI error y nada guardado. | ✅ |
| CA-4 | `service.ts` (watchSymbol upsert) | `tests/watchlist-service.test.ts` › "CA-4/CA-10…" | **Verificado:** re-vigilar actualiza zonas sin duplicar. | ✅ |
| CA-5 | `service.ts` (unwatch) · `actions.ts` (removeAction) | `tests/watchlist-service.test.ts` › "CA-5…" | **Verificado:** unwatch elimina de la lista. | ✅ |
| CA-6 | `src/lib/watchlist/zones.ts` (entraEnZona) | `tests/zones.test.ts` › "entraEnZona…" | **Verificado + probe:** min ≤ p ≤ max inclusive; extremos, punto único, y SIN bug lexicográfico ('9'∉['10','100']). | ✅ |
| CA-7 | `src/lib/watchlist/zones.ts` (zonasEntradas) | `tests/zones.test.ts` › "zonasEntradas…" | **Verificado:** compra/venta con la misma regla; sin zonas nunca reporta entrada. | ✅ |
| CA-8 | `src/lib/portfolio/symbols.ts` (getOrCreateSymbol) | `tests/watchlist-service.test.ts` › "CA-8…" | **Verificado:** mismo ticker → mismo símbolo compartido. | ✅ |
| CA-9 | `service.ts` (filtrado userId, getWatchedForOwner) · `ownership.ts` | `tests/watchlist-service.test.ts` › "CA-9…" | **Verificado:** B no ve la watchlist de A ni por lista ni por id. | ✅ |
| CA-10 | `service.ts` (upsert) · `schema.ts` (UNIQUE user+símbolo) | `tests/watchlist-service.test.ts` › "CA-4/CA-10…" | **Verificado:** una sola entrada por (usuario, símbolo). | ✅ |

Gates automáticos (verificador): **55 unit verdes**, **e2e vigiladas 2/2** (+ regresión auth/cartera 6/6), `eslint` 0, `tsc` 0, `next build` verde.

## Veredicto del verificador
**GREEN — 2026-07-13.**

Los 10 CA cerrados con Implementado + Test + Verif. en verde. La formalización de
"zona" (R-2, RN-11) resiste un **probe adversarial**: extremos inclusive, zona de
punto único (min=max), decimales, y —clave— NINGÚN error de comparación
lexicográfica pese a que los `numeric` llegan como strings (todo se compara con
Decimal). El rango inválido se rechaza en servicio y en UI. Sin findings.

## Evidencia visual
Capturas del flujo real (Playwright) en `_qa/SPEC-003/`, regeneradas por el verificador:

| CA | Evidencia | Fichero |
|---|---|---|
| CA-2 | Acción vigilada con zona compra 20–25 y venta 35–40 | `_qa/SPEC-003/ca2-vigilar-con-zonas.png` |
| CA-3 | Rango inválido rechazado con error, nada guardado | `_qa/SPEC-003/ca3-rango-invalido.png` |

## Salvedades / follow-ups
- **F-SPEC-003-1** (depende de Ingesta+Motor): el predicado está listo y probado,
  pero NO se evalúa contra precios reales aún; el Motor de disparo lo consumirá.
- **F-SPEC-003-2** (coherencia de base de precio): comparar la zona contra el precio
  en la misma base ajustada/no-ajustada es de la spec de Ingesta (dictamen sdd-mercados).

## Cómo retomar (handoff)
- **Cerrado (GREEN):** los 10 CA. Spec en `hecho`. R-2 formalmente cerrada (RN-10/RN-11).
- **Siguiente natural:** Ingesta de cotizaciones (desbloquea P/L actual real y alimenta
  el predicado) o Motor de disparo (consume `zonasEntradas`). Vía `/sdd-arquitecto`.
