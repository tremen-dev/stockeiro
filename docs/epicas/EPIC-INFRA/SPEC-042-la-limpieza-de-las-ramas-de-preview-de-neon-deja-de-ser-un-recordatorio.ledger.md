---
id: SPEC-042
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-042 La limpieza de las ramas de preview de Neon deja de ser un recordatorio

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-042-limpieza-automatica-de-ramas-de-preview-en-neon`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
<!-- 🔒 = verificable en el repositorio con un test. 🚀 = solo comprobable al cerrar una PR de verdad; su evidencia va abajo, no a un test. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| 🔒 CA-1 el workflow existe, aparte, y no toca a los otros dos | | | | ❌ |
| 🔒 CA-2 un solo disparador `pull_request: [closed]`, sin filtro por `merged`, sin `pull_request_target` | | | | ❌ |
| 🔒 CA-3 `neondatabase/delete-branch-action@v3` con exactamente tres entradas | | | | ❌ |
| 🔒 CA-4 nada fuera del prefijo literal `preview/`; `main` no se nombra; sin `run:` | | | | ❌ |
| 🔒 CA-5 higiene: sin forks, sin permisos de escritura, con plazo y concurrencia, sin `continue-on-error` | | | | ❌ |
| 🔒 CA-6 frontera: `ci.yml` y `deploy-gate.yml` siguen sin secretos; este no gobierna el merge | | | | ❌ |
| 🔒 CA-7 el runbook cuenta la trampa, la solución y su contrapartida (§6, §9, §13, §13.3) | | | | ❌ |
| 🚀 CA-8 al cerrar la PR, la rama desaparece de Neon y el recuento baja en una | | | | ❌ |
| 🚀 CA-9 comportamiento ante una rama inexistente, medido y escrito | | | | ❌ |
| 🚀 CA-10 nada que no fuera una preview se tocó (`main` sigue ahí) | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-042/. Informe HTML opcional: _qa/SPEC-042/informe.html -->

Lo que hace falta pegar aquí para los tres CA 🚀, nombrado por el arquitecto para que nadie
improvise la evidencia:

| CA | Evidencia |
|---|---|
| CA-8 | Enlace a la ejecución verde del workflow en Actions + lista de ramas de Neon **antes** y **después** del cierre (nombres, no solo el recuento) |
| CA-9 | Enlace a la re-ejecución sobre la rama ya borrada + el mensaje literal de la acción, y el veredicto: ¿verde o rojo? |
| CA-10 | Las dos listas de CA-8 comparadas: la única diferencia es `preview/ft/SPEC-042-…`; `main` y la rama `preview` suelta siguen ahí |

## Salvedades / follow-ups
<!-- IDs F-SPEC-042-1, F-SPEC-042-2… con destino (spec futura o EPIC-MEJORA). -->
Declarados ya al nacer la spec (§Fuera de alcance y §Salvedades de `SPEC-042-….md`). Los dos
primeros son **acciones de ops del humano**, no CA: el **acto** es ops, el **efecto** es CA-8
—mismo reparto que `F-SPEC-032-2`—.

- **F-SPEC-042-1 — `NEON_PROJECT_ID` como *variable* del repositorio** (GitHub → *Settings →
  Secrets and variables → Actions → Variables*). Valor en Neon, *Project settings*. Variable y
  no secreto: no es sensible y verla en el log ayuda a diagnosticar. Si falta, llega **vacía** y
  el workflow da rojo. → ops.
- **F-SPEC-042-2 — `NEON_API_KEY` como *secreto* del repositorio**, creado en Neon *Account
  Settings → API Keys*. **Al crearla hay que comprobar si puede acotarse a este proyecto** y
  anotar aquí qué alcance tiene realmente (punto 2 del gate). → ops.
- **F-SPEC-042-3 — GitHub → *Settings → General → Automatically delete head branches***, más la
  poda de las ramas mergeadas acumuladas (27 el 2026-08-19/20, borradas a mano). **No arregla
  Neon.** Separado a propósito para que no se lea como la solución. → ops.
- **F-SPEC-042-4 — Refuerzo opcional: bajar la *Deployment Retention Policy* de Vercel** para
  *Pre-Production Deployments*. Mitiga, no resuelve (asíncrono, y los ~10 despliegues más
  recientes están siempre protegidos). → ops, sin urgencia.
- **F-SPEC-042-5 — Las PRs desde un fork no se limpian**, por decisión de seguridad (no se usa
  `pull_request_target`). Hoy no hay contribuyentes externos. → EPIC-INFRA.
- **F-SPEC-042-6 — La rama `preview` suelta del panel**, creada a mano: ni la creó Vercel ni la
  borra este workflow, y ocupa techo. → ops.

Heredados:

- **F-SPEC-028-2 — se cierra su mitad 2** (*las ramas de preview sobreviven al cierre de la
  PR*) cuando CA-8 quede verde. Su **mitad 1** —el techo de 10 ramas del plan Free— **queda
  abierta a propósito**: esta spec quita la acumulación, no el techo (R-6). → EPIC-INFRA.
- **F-SPEC-032-1** — el permiso `ALLOW_MIGRATE` en Preview asume que el *preview branching*
  sigue encendido. Sin cambios: esta spec no lo toca ni lo empeora.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Spec escrita el 2026-08-20 y dejada en **`borrador`**: el arquitecto no aprueba su propia spec.
Lo siguiente es el **gate humano**, con seis puntos que decidir (§Notas para el gate). El más
sustancial es el punto **1** —si el hecho de que el repositorio deje de tener cero secretos
merece ADR propio (sería **ADR-027**)—; mi recomendación escrita es que **no**, y el argumento
en contra está redactado para que el humano pueda darle la vuelta sin que yo se lo mastique.

Nada de código escrito: esta rama toca **solo `docs/`**.
