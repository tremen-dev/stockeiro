---
id: SPEC-033
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-033 La puerta post-deploy deja de perder la carrera: con --commit, unknown es transitorio

## Resumen
- Fase: **escrita por sdd-arquitecto el 2026-08-19**, en `borrador`. **Pendiente del gate humano**,
  que conduce el orquestador. La transición de estado la registra el orquestador con `estado.mjs`;
  la fuente de verdad es el frontmatter de la spec.
- Rama: `ft/SPEC-033-carrera-check-alive` (worktree `.claude/worktrees/spec-033`), sobre
  `origin/main` @ `0d389c8` — el mismo merge cuyo job `Alive` salió rojo y que motiva esta spec.
- **Sin ADR nuevo.** ADR-018 D-6 ya decide que la puerta *espera y falla si no llega en un plazo*;
  esta spec devuelve el script a esa letra. Justificación en §Entidades y en §Notas punto 4.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 la carrera se deja de perder (`unknown`→sha → 0) | | | | ❌ |
| CA-2 el plazo se usa de verdad; 2 al expirar | | | | ❌ |
| CA-3 el 2 es comprensible: esperado, `unknown`, `builtAt`, las dos causas | | | | ❌ |
| CA-4 una línea al primer `unknown`, exactamente una | | | | ❌ |
| CA-5 modo *smoke* intacto: terminal e inmediato | | | | ❌ |
| CA-6 ningún código de salida cambia de significado | | | | ❌ |
| CA-7 `scripts/` con tres habitantes; la puerta no cambia | | | | ❌ |
| CA-8 los tests ajenos tocados son exactamente los declarados | | | | ❌ |
| CA-9 la regla nueva escrita en cabecera, §10, §12.2 y §12.3 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
**n-a**: esta spec no toca UI. No hay captura que hacer y `_qa/SPEC-033/` no debe existir. La
evidencia es la salida de los subprocesos contra servidores de juguete en *loopback*.

## Salvedades / follow-ups
<!-- IDs F-SPEC-033-1, F-SPEC-033-2… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
La spec está escrita y **sin aprobar**. Nada de código, ningún commit de implementación.

Para quien siga:
- Los nueve CA se cierran **sin desplegar**, con `node:http` en *loopback* + subprocesos reales; la
  convención la fijó `tests/check-alive.test.ts` (SPEC-031).
- **CA-1 es el RED que hay que ver rojo antes de tocar nada**: es la reproducción literal del fallo
  del job `Alive` del merge `0d389c8`.
- El único test ajeno que se puede tocar está declarado en **CA-8** y autorizado en §Fuera de
  alcance; la lista prohibida está en el mismo CA.
- Al mergear: **el propio merge de esta spec** es la mejor verificación de que el arreglo funciona
  —su job `Alive` debe salir verde a la primera— y ese run sirve además como evidencia **RI-02**
  para desbloquear el cierre de SPEC-028, que sigue en `en-revision`.
