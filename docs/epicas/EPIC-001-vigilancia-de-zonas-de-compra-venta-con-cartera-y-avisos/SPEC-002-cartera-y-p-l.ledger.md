---
id: SPEC-002
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-002 Cartera y P/L

## Resumen
- Fase: GREEN — los 11 CA verificados (unit + e2e + probe de precisión). Spec a `hecho`.
- Rama: `ft/SPEC-002-cartera-y-p-l`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/portfolio/position.ts` · `service.ts` (recordBuy) · `src/db/schema.ts` | `tests/position.test.ts` › "CA-1…" · **e2e** cartera.spec.ts | Coste base correcto; con redondeo monetario (2 dec) en servicio/UI. Probe periódico OK. | ✅ |
| CA-2 | `src/lib/portfolio/position.ts` (medio ponderado con gastos) | `tests/position.test.ts` › "CA-2…" · periódico | Medio ponderado correcto; 701/7→100.14 estable tras redondeo. | ✅ |
| CA-3 | `position.ts` · `service.ts` (recordSell) | `tests/position.test.ts` › "CA-3…" · "venta total periódica 29.00" | Venta total: realizado correcto también con división periódica. | ✅ |
| CA-4 | `position.ts` (coste proporcional, sin deriva) · `service.ts` | `tests/position.test.ts` › "CA-4…" / "coste medio estable" · **e2e** (ca4-venta-parcial.png) | **Verificado:** cantidad y realizado OK; coste medio del resto SIN deriva (100.33 estable). | ✅ |
| CA-5 | `position.ts` (OversellError) · `service.ts` | `tests/*` › "CA-5…" · **e2e** (ca5-sobreventa-rechazada.png) | **Verificado:** sobreventa rechazada sin insertar; también en UI. | ✅ |
| CA-6 | `position.ts` (plActual = precio×cantidad − costeBaseTotal) · `page.tsx` ("—") | `tests/position.test.ts` › "plActual…" / "CA-6 exacto −1" · **e2e** | **Verificado:** "—" sin precio; con precio EXACTO (`plActual(100)`=−1.00, ya no −0.999…). Probe confirma. | ✅ |
| CA-7 | `position.ts` (split ×r / ÷r) | `tests/position.test.ts` › "split…" | **Verificado:** cantidad ×r, coste medio ÷r, valor y P/L intactos. | ✅ |
| CA-8 | `position.ts` (dividendo → realizado) | `tests/position.test.ts` › "dividendo…" | **Verificado:** dividendo suma al realizado; coste y cantidad intactos. | ✅ |
| CA-9 | `service.ts` (portfolioSummary: totales crudos, redondeo final) | `tests/portfolio-service.test.ts` › "CA-9…" | **Verificado:** realizado/actual SEPARADOS y redondeados (80.00 / 60.00). | ✅ |
| CA-10 | `service.ts` (filtrado userId, getTransactionForOwner) · `ownership.ts` | `tests/portfolio-service.test.ts` › "CA-10…" | **Verificado:** B no ve datos de A ni por lista ni por id. | ✅ |
| CA-11 | `symbols.ts` (getOrCreateSymbol) | `tests/portfolio-service.test.ts` › "CA-11…" | **Verificado:** mismo ticker → mismo símbolo compartido. | ✅ |

Gates automáticos (verificador, re-verificación): **39 unit verdes**, **6/6 e2e verdes** (incl. regresión auth), `eslint` 0, `tsc` 0, `next build` verde.

## Veredicto del verificador
**GREEN — 2026-07-13.**

Los 11 CA cerrados con Implementado + Test + Verif. en verde. El RED previo
(precisión/redondeo) quedó resuelto: `plActual` es exacto (−1.00, no −0.999…), las
ventas no derivan el coste medio, y hay redondeo monetario explícito a 2 decimales.
Un **probe adversarial ampliado** confirmó además fronteras de redondeo half-up
(100.005→100.01; −0.005→−0.01), 7 ventas parciales sin deriva acumulada
(realizado −1.00, qty 0) y coste medio periódico estable (701/7→100.14). No se
encontraron nuevos defectos. Historial: RED 2026-07-13 → RED-A/RED-B resueltos → GREEN 2026-07-13.

## Evidencia visual
Capturas del flujo real (Playwright) en `_qa/SPEC-002/`, regeneradas por el verificador:

| CA | Evidencia | Fichero |
|---|---|---|
| CA-1/CA-6 | Compra → posición con coste medio 100.00 y P/L actual "—" | `_qa/SPEC-002/ca1-ca6-compra-posicion.png` |
| CA-3/CA-4 | Venta parcial → cantidad 6, P/L realizado 80.00 (redondeo limpio) | `_qa/SPEC-002/ca4-venta-parcial.png` |
| CA-5 | Sobreventa rechazada con error | `_qa/SPEC-002/ca5-sobreventa-rechazada.png` |

## Respuesta del implementador al RED (2026-07-13)
- **RED-A resuelto:** `plActual = precio×cantidad − costeBaseTotal` (sin round-trip
  por el coste medio) → `plActual(100)` da **−1** exacto. Ventas: coste vendido y
  remanente PROPORCIONALES al total (sin deriva del coste medio). `money.ts`:
  redondeo explícito a 2 decimales (ROUND_HALF_UP) en la frontera de servicio/UI;
  totales sumados en precisión completa y redondeados al final.
- **RED-B resuelto:** añadidos tests con divisiones periódicas (`buy 3 @100 g1`):
  `tests/position.test.ts` y `tests/portfolio-service.test.ts`.

## Salvedades / follow-ups
- **F-SPEC-002-1** (depende de Ingesta): el P/L actual usa un precio inyectado; sin
  la spec de Ingesta la UI lo muestra "—". Al llegar Ingesta, alimentar `priceByTicker`.
- **F-SPEC-002-2** (futuro): editar/borrar transacciones (hoy el ledger es inmutable;
  corrección = evento compensatorio). Fuera de alcance de esta spec.
- **F-SPEC-002-3** (asunción): redondeo monetario a 2 decimales (EUR/USD). Instrumentos
  con más decimales (p. ej. penny stocks) requerirían escala por divisa; revisar con Ingesta.

## Cómo retomar (handoff)
- **Cerrado (GREEN):** los 11 CA. Spec en `hecho`.
- **Antes de desplegar:** F-SPEC-001-2 (Neon + AUTH_SECRET). El cierre mecánico
  (índices, archivado) lo hace `/sdd-documentalista`; el merge/PR lo decide el humano.
