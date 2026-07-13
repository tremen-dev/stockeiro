---
id: SPEC-002
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-002 Cartera y P/L

## Resumen
- Fase: RED-A/RED-B resueltos por el implementador (P/L actual exacto + redondeo monetario; tests con divisiones periódicas). Devuelto a en-revisión para re-verificación.
- Rama: `ft/SPEC-002-cartera-y-p-l`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/portfolio/position.ts` (computePosition) · `service.ts` (recordBuy) · `src/db/schema.ts` | `tests/position.test.ts` › "CA-1…" · **e2e** cartera.spec.ts | Fórmula correcta, pero coste base SIN redondeo monetario: con 3 uds+gastos sale `100.33333333333333333` (17 decimales). Ver RED-A. | ⚠️ |
| CA-2 | `src/lib/portfolio/position.ts` (medio ponderado con gastos) | `tests/position.test.ts` › "CA-2…" | Correcta con números exactos; sin redondeo y con deriva tras operaciones (RED-A). | ⚠️ |
| CA-3 | `src/lib/portfolio/position.ts` · `service.ts` (recordSell) | `tests/position.test.ts` › "CA-3…" | OK con números exactos; con gastos+división periódica hereda la deriva (RED-A). | ⚠️ |
| CA-4 | `src/lib/portfolio/position.ts` (venta parcial) · `service.ts` | `tests/position.test.ts` › "CA-4…" · **e2e** (ca4-venta-parcial.png) | Cantidad y realizado OK, pero coste medio del resto DERIVA: `100.33333333333333334` en vez de 301/3 (RED-A). | ⚠️ |
| CA-5 | `position.ts` (OversellError) · `service.ts` (valida antes de insertar) | `tests/position.test.ts` · `tests/portfolio-service.test.ts` › "CA-5…" · **e2e** (ca5-sobreventa-rechazada.png) | **Verificado:** venta > cantidad viva rechazada, sin insertar; observado también en UI. | ✅ |
| CA-6 | `position.ts` (plActual: null sin precio) · `src/app/cartera/page.tsx` ("—") | `tests/position.test.ts` › "plActual…" · **e2e** cartera.spec.ts | "sin dato"→"—" **OK**. PERO el valor con precio es INCORRECTO por redondeo: `plActual(100)` da `-0.99999999999999999` cuando debe ser −1.00 (RED-A). | ⚠️ |
| CA-7 | `position.ts` (split ×r / ÷r) | `tests/position.test.ts` › "split…" | **Verificado** con caso exacto: cantidad ×r, coste medio ÷r, valor y P/L intactos. | ✅ |
| CA-8 | `position.ts` (dividendo → realizado) | `tests/position.test.ts` › "dividendo…" | **Verificado:** el dividendo suma al realizado, sin tocar coste ni cantidad. | ✅ |
| CA-9 | `service.ts` (portfolioSummary: realizado/actual separados) | `tests/portfolio-service.test.ts` › "CA-9…" | Separación realizado/actual **OK** (magnitudes distintas). Pero los totales heredan la falta de redondeo (RED-A). | ⚠️ |
| CA-10 | `service.ts` (filtrado por userId, getTransactionForOwner) · `ownership.ts` | `tests/portfolio-service.test.ts` › "CA-10…" | **Verificado:** B no ve posiciones de A ni su transacción por id. | ✅ |
| CA-11 | `symbols.ts` (getOrCreateSymbol, ticker normalizado) | `tests/portfolio-service.test.ts` › "CA-11…" | **Verificado:** dos usuarios con el mismo ticker referencian el mismo símbolo. | ✅ |

Gates automáticos (verificador): **35 unit verdes**, **e2e cartera 2/2 verde**, `eslint` 0, `tsc` 0. Sin regresiones. Los tests, sin embargo, solo usan entradas exactas (ver RED-B).

## Veredicto del verificador
**RED — 2026-07-13.**

Los CA no computacionales están verificados (CA-5, CA-7, CA-8, CA-10, CA-11) y la
separación realizado/actual (CA-9) y el "—" sin precio (CA-6) son correctos. PERO
un **probe adversarial** con divisiones periódicas (entradas totalmente normales:
3 acciones con 1 de gastos) destapa un defecto de precisión **visible para el
usuario**, que los tests actuales no cubren:

- `plActual(100)` = **−0.99999999999999999** cuando el valor correcto es **−1.00** (CA-6).
- coste medio tras venta parcial = **100.33333333333333334** (deriva; debería ser 301/3) (CA-4).
- coste base/medio y P/L se muestran con **17 decimales**, sin redondeo a la unidad
  monetaria (la UI mostraría `-0.33333333333333333`). Incumple la directiva de
  precisión de la spec y el invariante de sdd-cartera.

### Findings accionables
- **RED-A (redondeo y deriva de precisión).** (1) Evitar el round-trip por el coste
  medio en las ventas: calcular el coste de lo vendido de forma proporcional
  (`costeTotal × q / cantidad`) para que el coste remanente no derive. (2) Redondear
  explícitamente los importes monetarios (coste medio, realizado, plActual y totales)
  a la unidad menor de la divisa (p. ej. 2 decimales) con un modo de redondeo
  definido, en la frontera de servicio/UI. Afecta a CA-1, CA-2, CA-3, CA-4, CA-6, CA-9.
- **RED-B (cobertura de tests insuficiente).** Los tests unit/e2e solo usan números
  exactos (100.5, enteros) y ENMASCARAN RED-A. Añadir casos con división periódica
  (3 uds + gastos) que asserten los valores REDONDEADOS esperados (p. ej. plActual → −1.00).

## Evidencia visual
Capturas del flujo real (Playwright) en `_qa/SPEC-002/`: `ca1-ca6-compra-posicion.png`,
`ca4-venta-parcial.png`, `ca5-sobreventa-rechazada.png` (flujos OK con números exactos;
el defecto de precisión no aflora con esas entradas — ver RED-B). Probe de precisión
ejecutado sobre `src/lib/portfolio/position.ts` (no versionado; salida en el informe del gate).

## Salvedades / follow-ups
- **F-SPEC-002-1** (depende de Ingesta): el P/L actual usa un precio inyectado; sin
  la spec de Ingesta la UI lo muestra "—". Al llegar Ingesta, alimentar `priceByTicker`.
- **F-SPEC-002-2** (futuro): editar/borrar transacciones (hoy el ledger es inmutable;
  corrección = evento compensatorio). Fuera de alcance de esta spec.

## Respuesta del implementador al RED (2026-07-13)
- **RED-A resuelto:** `plActual = precio×cantidad − costeBaseTotal` (sin round-trip
  por el coste medio) → `plActual(100)` da **−1** exacto. Ventas: coste vendido y
  remanente PROPORCIONALES al total (sin deriva del coste medio). `money.ts`:
  redondeo explícito a 2 decimales (ROUND_HALF_UP) en la frontera de servicio/UI;
  totales sumados en precisión completa y redondeados al final.
- **RED-B resuelto:** añadidos tests con divisiones periódicas (`buy 3 @100 g1`):
  `tests/position.test.ts` (plActual −1, coste medio 100.33 estable tras venta
  parcial, venta total 29.00) y `tests/portfolio-service.test.ts` (plActual −1.00,
  costeMedio 100.33 extremo a extremo). El probe de precisión ya devuelve −1.
- Gates: **39 unit verdes**, e2e cartera 2/2, `eslint` 0, `tsc` 0, `next build` verde.

## Cómo retomar (handoff)
- **Listo para re-verificación:** los 11 CA con Implementado + Test; RED-A/RED-B saldados.
- **Dónde seguir:** re-lanzar `/sdd-verificador`; reproducir el probe (`buy 3 @100 g1`
  → `plActual(100)` = −1) y confirmar el redondeo monetario en `portfolioSummary`.
