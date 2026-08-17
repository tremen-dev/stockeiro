---
id: SPEC-024
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-024 Quitar de vigiladas la accion correcta, haya estado o no en zona

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-024-quitar-de-vigiladas-la-accion-correcta-haya-estado-o-no-en-zona`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | | | | ❌ |
| CA-2 | | | | ❌ |
| CA-3 | | | | ❌ |
| CA-4 | | | | ❌ |
| CA-5 | | | | ❌ |
| CA-6 | | | | ❌ |
| CA-7 | | | | ❌ |
| CA-8 | | | | ❌ |
| CA-9 | | | | ❌ |
| CA-10 | | | | ❌ |
| CA-11 | | | | ❌ |
| CA-12 | | | | ❌ |
| CA-13 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-024/. Informe HTML opcional: _qa/SPEC-024/informe.html -->
<!-- CA-7 y CA-13 son e2e Playwright: se espera captura de ambos. -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-024-1, F-SPEC-024-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-024-1** (abierto en spec, fuera de alcance): `/vigiladas` no muestra el mercado,
  así que dos vigiladas del mismo ticker en mercados distintos se ven como filas idénticas.
  Presentación, no corrección → EPIC-MEJORA.
- **F-SPEC-024-2** (abierto en spec, fuera de alcance): mismo defecto de identidad por ticker
  en la cartera (`recordSell`/`recordSplit`/`recordDividend`,
  `src/lib/portfolio/service.ts:98,127,144`) → candidato a spec propia en EPIC-FIX.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Spec en `borrador`, ampliada tras el gate humano del 2026-08-17 para absorber el defecto de
  identidad (`unwatch` por ticker → por `id` de la acción vigilada). Pendiente de aprobación.
- `tests/repro-unwatch-en-zona.test.ts` es scratch de investigación: se borra al implementar
  y su escenario pasa a `tests/watchlist-service.test.ts` (CA-1/CA-2).
