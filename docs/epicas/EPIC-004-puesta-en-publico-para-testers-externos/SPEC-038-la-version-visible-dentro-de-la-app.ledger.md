---
id: SPEC-038
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-038 La version visible dentro de la app

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-038-la-version-visible-dentro-de-la-app`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-038/. Informe HTML opcional: _qa/SPEC-038/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-038-1, F-SPEC-038-2… con destino (spec futura o EPIC-MEJORA). -->

- **`V-SPEC-039-4` — arrastrado hasta aquí por decisión del gate humano (2026-08-20).**
  *Escrito por **sdd-arquitecto**, no por el implementador ni por el verificador: es una
  corrección de `docs/fundacion/dominio.md`, documento de verdad, y por **ADR-025 pto. 1** la
  pluma es del arquitecto.*

  La fila **«Canal de feedback»** de `docs/fundacion/dominio.md` dice hoy que
  `deploymentIdentity` es *«la misma fuente que responde `/api/version` y que **enseña el
  pie**»*. **La frase está en presente y describe un futuro**: el pie **consume** la identidad
  para componer el `mailto:` de feedback, pero **no la pinta** — eso es justamente lo que
  entrega esta spec. El verificador de SPEC-039 lo levantó como `V-SPEC-039-4` y lo dirigió al
  arquitecto; el humano decidió en el gate del 2026-08-20 **no corregirlo antes**, porque al
  cerrar SPEC-038 la frase **pasa a ser cierta sola**.

  **Qué hay que hacer al cerrar esta spec**: comprobar que el pie **enseña** de verdad la
  versión y, si es así, **no hay nada que reescribir** — la fila deja de mentir por sí misma y
  el residual se cierra citando esta spec. Si SPEC-038 acabara entregando la versión en otro
  sitio que no fuera el pie, entonces **sí** hay que reescribir la fila, y la reescribe el
  arquitecto.

  Se anota aquí, y no en el texto de SPEC-038, por dos motivos: este ledger es donde trabaja
  quien cierra, y `SPEC-038-...app.md` lo está modificando ahora mismo la rama de SPEC-039
  (PR #42) — escribir en él desde otra rama sólo produciría un conflicto de merge sin ganar
  nada.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
