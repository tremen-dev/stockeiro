---
id: SPEC-002
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-002 Cartera y P/L

## Resumen
- Fase: en-revisión (11 CA implementados con test; unit + e2e en verde). Pendiente de verificación.
- Rama: `ft/SPEC-002-cartera-y-p-l`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/portfolio/position.ts` (computePosition) · `src/lib/portfolio/service.ts` (recordBuy) · `src/db/schema.ts` (symbols/transactions) | `tests/position.test.ts` › "CA-1…" · **e2e** `tests/e2e/cartera.spec.ts` (📸 ca1-ca6-compra-posicion.png) | | ❌ |
| CA-2 | `src/lib/portfolio/position.ts` (coste medio ponderado con gastos) | `tests/position.test.ts` › "CA-2: varias compras…" | | ❌ |
| CA-3 | `src/lib/portfolio/position.ts` · `src/lib/portfolio/service.ts` (recordSell) | `tests/position.test.ts` › "CA-3: venta total…" | | ❌ |
| CA-4 | `src/lib/portfolio/position.ts` (venta parcial) · `service.ts` (recordSell) | `tests/position.test.ts` › "CA-4…" · **e2e** cartera.spec.ts (📸 ca4-venta-parcial.png) | | ❌ |
| CA-5 | `src/lib/portfolio/position.ts` (OversellError) · `service.ts` (recordSell valida antes de insertar) | `tests/position.test.ts` › oversell · `tests/portfolio-service.test.ts` › "CA-5…" · **e2e** (📸 ca5-sobreventa-rechazada.png) | | ❌ |
| CA-6 | `src/lib/portfolio/position.ts` (plActual: null sin precio) · `src/app/cartera/page.tsx` ("—") | `tests/position.test.ts` › "plActual…" · **e2e** cartera.spec.ts | | ❌ |
| CA-7 | `src/lib/portfolio/position.ts` (split ×r / ÷r) | `tests/position.test.ts` › "split…" | | ❌ |
| CA-8 | `src/lib/portfolio/position.ts` (dividendo → realizado) | `tests/position.test.ts` › "dividendo…" | | ❌ |
| CA-9 | `src/lib/portfolio/service.ts` (portfolioSummary: realizado/actual separados) | `tests/portfolio-service.test.ts` › "CA-9…" | | ❌ |
| CA-10 | `src/lib/portfolio/service.ts` (filtrado por userId, getTransactionForOwner) · `src/lib/data/ownership.ts` | `tests/portfolio-service.test.ts` › "CA-10…" | | ❌ |
| CA-11 | `src/lib/portfolio/symbols.ts` (getOrCreateSymbol, ticker normalizado) | `tests/portfolio-service.test.ts` › "CA-11…" | | ❌ |

Cobertura automática (ejecutada por el implementador): **35 unit verdes** (14 nuevos: 10 position + 4 servicio) y **6/6 e2e verdes** (incluye la regresión de auth). `eslint` 0, `tsc` 0, `next build` verde. Aritmética con Decimal (sin float).

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
Capturas del flujo real en `_qa/SPEC-002/` (Playwright): `ca1-ca6-compra-posicion.png`, `ca4-venta-parcial.png`, `ca5-sobreventa-rechazada.png`. El verificador puede regenerarlas con `npx playwright test`.

## Salvedades / follow-ups
- **F-SPEC-002-1** (depende de Ingesta): el P/L actual usa un precio inyectado; sin
  la spec de Ingesta la UI lo muestra "—". Al llegar Ingesta, alimentar `priceByTicker`.
- **F-SPEC-002-2** (futuro): editar/borrar transacciones (hoy el ledger es inmutable;
  corrección = evento compensatorio). Fuera de alcance de esta spec.
- Nota: la posición se DERIVA en cada consulta (ADR-003); materializar/cachear es
  optimización futura si el volumen lo pide.

## Cómo retomar (handoff)
- **Qué está hecho:** los 11 CA con test (unit + e2e). Modelo ledger
  (`symbols`/`transactions`), cálculo puro con Decimal (`position.ts`), servicios
  (`service.ts`, `symbols.ts`) y exposición mínima `/cartera`. 35 unit + 6 e2e verdes.
- **Qué falta (verificador):** verificación adversarial — especialmente signos y
  **redondeo monetario** (dictamen sdd-cartera), aislamiento (CA-10) y la
  separación realizado/actual (CA-9); regenerar capturas y emitir GREEN/RED.
- **Cómo correr:** `npx vitest run` (unit) y `npx playwright test` (e2e, levanta
  Postgres efímero). Matriz de CA arriba con fichero y test por fila.
