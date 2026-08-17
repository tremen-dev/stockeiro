---
id: SPEC-025
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-025 Cartera: vender, dividir y cobrar dividendo sobre la posicion del mercado correcto

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-025-cartera-vender-dividir-y-cobrar-dividendo-sobre-la-posicion-del-mercado-correcto`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (venta en la posición señalada) | | | | ❌ |
| CA-2 (RN-08 no rechaza lo legítimo) | | | | ❌ |
| CA-3 (RN-08 sí rechaza lo imposible) | | | | ❌ |
| CA-4 (split en la posición señalada) | | | | ❌ |
| CA-5 (dividendo en la posición señalada) | | | | ❌ |
| CA-6 (RN-01: symbolId sin posición no escribe) | | | | ❌ |
| CA-7 (símbolo legacy sin micCode) | | | | ❌ |
| CA-8 (e2e: la UI manda la identidad) | | | | ❌ |
| CA-9 (P/L actual con el precio de su mercado) | | | | ❌ |
| CA-10 (diagnóstico en la fila correcta) | | | | ❌ |
| CA-11 (sin regresión con un solo mercado) | | | | ❌ |
| CA-12 (getSymbolByTicker sin usos, eliminada) | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-025/. Informe HTML opcional: _qa/SPEC-025/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-025-1, F-SPEC-025-2… con destino (spec futura o EPIC-MEJORA). -->
Abiertos ya en la fase de spec (fuera de alcance a propósito, ver la sección homónima):

- **F-SPEC-025-1** (EPIC-MEJORA): la tabla de posiciones de `/cartera` no muestra
  mercado ni divisa, así que dos posiciones del mismo ticker se ven como dos filas
  idénticas. Presentación, no corrección. Hermano de **F-SPEC-024-1** (`/vigiladas`):
  conviene hacerlos en la misma spec.
- **F-SPEC-025-2** (EPIC-FIX, spec propia): `portfolioSummary` suma `realizadoTotal` y
  `actualTotal` sobre posiciones de **divisas distintas** (EUR + USD en una sola cifra).
  Defecto **preexistente e independiente** de SPEC-025 —existe desde SPEC-002 con un solo
  mercado por ticker—. Roza RN-09 y la exclusión de multi-moneda de FOUNDATION; arreglarlo
  exige decidir qué se muestra (totales por divisa / conversión / nada) → producto.
- **F-SPEC-025-3** (higiene): `getQuoteByTicker` (`src/lib/market/quotes.ts:57`) conserva la
  ambigüedad de coger la primera fila cuando un ticker tiene varios mercados. Sin usos en
  `src/`, solo en tests; no se toca en esta spec.

## Reproducción del defecto (fase de spec, 2026-08-17)
`tests/repro-cartera-identidad.test.ts` (**scratch**, se borra al implementar):
`npx vitest run tests/repro-cartera-identidad.test.ts` → **8/8 escenarios reproducen el
defecto** contra PGlite. Resultado clave: con `SAN`@BMEX y `SAN`@XNYS, la venta cae en el
símbolo que gana el `limit(1)` (R1/R6), RN-08 falla en ambos sentidos (R2/R3), split y
dividendo caen en el mercado equivocado (R4/R5) y **solo abrir la cartera** da un P/L actual
de 363,00 € donde correspondían 198,00 € (R7, error de 165 €). La tabla completa está en la
sección *Reproducción* de la spec.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
