---
id: SPEC-041
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-041 Vigiladas legible y ordenable: el nombre del activo, el orden a elección y el alta plegable

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-041-vigiladas-legible-y-ordenable`, rebasada sobre `origin/main` en `784c1ea`
  (el merge de SPEC-039, PR #42).

### Intendencia — léela antes de tocar nada

- **El directorio del worktree se llama `spec-040`**
  (`D:\src\tremen-dev\stockeiro\.claude\worktrees\spec-040`) **y eso NO significa que ahí
  viva la SPEC-040.** Windows no dejó renombrarlo cuando esta spec se subió de 040 a 041. Ahí
  vive la rama `ft/SPEC-041-vigiladas-legible-y-ordenable`, o sea **esta** spec.
- **`SPEC-040` es otra spec**: `docs/epicas/EPIC-FIX/SPEC-040-el-movil-completa-el-alta-…`
  (*el móvil completa el alta de una vigilada, y la guardia de geometría deja de ser ciega*),
  aprobada el 2026-08-20 con **ADR-026**, en la rama
  `ft/SPEC-040-movil-completa-el-alta-y-guardia-que-lo-ve`. **Toca el mismo `WatchForm`** que
  esta spec pliega. Antes de implementar, lee §Riesgos **R-2** y **R-3** de la spec: el reparto
  de territorio y el punto ciego que **CA-22** existe para evitar.
- **SPEC-039 ya está en `main`** y `hecho`: su estado vacío de `/vigiladas` es **no regresión**
  (CA-21), no un conflicto pendiente.

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
| CA-14 | | | | ❌ |
| CA-15 | | | | ❌ |
| CA-16 | | | | ❌ |
| CA-17 | | | | ❌ |
| CA-18 | | | | ❌ |
| CA-19 | | | | ❌ |
| CA-20 | | | | ❌ |
| CA-21 | | | | ❌ |
| CA-22 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-041/. Informe HTML opcional: _qa/SPEC-041/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-041-1, F-SPEC-041-2… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
