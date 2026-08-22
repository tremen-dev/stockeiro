---
id: SPEC-048
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-048 Guardias por diff que caducan al mergear

## Resumen
- Fase: `borrador` — spec y ADR-031 escritos por sdd-arquitecto el 2026-08-22, a la espera del gate humano. Sin implementar.
- Rama: `ft/SPEC-048-guardias-de-diff-caducadas`

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
| CA-9.1 | | | | ❌ |
| CA-9.2 | | | | ❌ |
| CA-9.3 | | | | ❌ |
| CA-9.4 | | | | ❌ |
| CA-10.1 | | | | ❌ |
| CA-10.2 | | | | ❌ |
| CA-10.3 | | | | ❌ |
| CA-10.4 | | | | ❌ |
| CA-11 | | | | ❌ |
| CA-12 | | | | ❌ |
| CA-G1 | | | | ❌ |
| CA-G2 | | | | ❌ |
| CA-G3 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-048/. Informe HTML opcional: _qa/SPEC-048/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-048-1, F-SPEC-048-2… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
Hecho: `SPEC-048` (borrador) y `ADR-031` (borrador) escritos, con el barrido completo de
`tests/`, `scripts/`, `src/` y `.github/workflows/` documentado en §Entidades de la spec.
Reproducido el rojo en este worktree: 3 failed | 26 passed en
`tests/icono-frontera.test.ts` + `tests/icono-guardias-ampliadas.test.ts`.
Verificado en el árbol: la ventana `6da9fbe`…`104f94e` contiene `src/app/icon.svg`,
`scripts/build-icon.mjs` y `src/proxy.ts`; los únicos ficheros de `tests/` **modificados**
en ella son los tres autorizados; y el diff de `src/proxy.ts` en esa ventana tiene
exactamente una línea de código quitada y una añadida, las dos con `matcher`.
Falta: el **gate humano** (dos preguntas abiertas en §Notas, ptos. 4 y 5) y toda la
implementación. Nada de `src/` se toca; no hace falta subir la versión.
