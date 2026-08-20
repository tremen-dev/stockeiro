---
id: SPEC-042
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-042 La limpieza de las ramas de preview de Neon deja de ser un recordatorio

## Resumen
- Fase: **en-revision** — bloque 🔒 (CA-1 a CA-7) implementado y verde; bloque 🚀 (CA-8, CA-9, CA-10) pendiente del primer cierre real de PR.
<!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-042-limpieza-automatica-de-ramas-de-preview-en-neon`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
<!-- 🔒 = verificable en el repositorio con un test. 🚀 = solo comprobable al cerrar una PR de verdad; su evidencia va abajo, no a un test. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| 🔒 CA-1 el workflow existe, aparte, y no toca a los otros dos | `.github/workflows/neon-preview-cleanup.yml` (nuevo) | `tests/neon-preview-cleanup-workflow.test.ts` · CA-1 1.1–1.4 (el 1.4 compara `ci.yml` y `deploy-gate.yml` **byte a byte** con `origin/main`) | | ❌ |
| 🔒 CA-2 un solo disparador `pull_request: [closed]`, sin filtro por `merged`, sin `pull_request_target` | `.github/workflows/neon-preview-cleanup.yml`, clave `on` | `tests/neon-preview-cleanup-workflow.test.ts` · CA-2 2.1–2.5 (2.4 busca `pull_request_target` también en los comentarios; 2.5, `merged` en cualquier `if` y en el texto crudo) | | ❌ |
| 🔒 CA-3 `neondatabase/delete-branch-action@v3` con exactamente tres entradas | `.github/workflows/neon-preview-cleanup.yml`, único step | `tests/neon-preview-cleanup-workflow.test.ts` · CA-3 3.1–3.4 | | ❌ |
| 🔒 CA-4 nada fuera del prefijo literal `preview/`; `main` no se nombra; sin `run:` | `.github/workflows/neon-preview-cleanup.yml`, `with.branch` y forma del fichero | `tests/neon-preview-cleanup-workflow.test.ts` · CA-4 4.1–4.4 (4.2 prohíbe `main`/`production` en el **fichero entero**, comentarios incluidos) | | ❌ |
| 🔒 CA-5 higiene: sin forks, sin permisos de escritura, con plazo y concurrencia, sin `continue-on-error` | `.github/workflows/neon-preview-cleanup.yml`: `if` de fork, `permissions: {}`, `timeout-minutes: 10`, grupo propio con `cancel-in-progress: false` | `tests/neon-preview-cleanup-workflow.test.ts` · CA-5 5.1–5.5 | | ❌ |
| 🔒 CA-6 frontera: `ci.yml` y `deploy-gate.yml` siguen sin secretos; este no gobierna el merge | ningún cambio en `ci.yml` ni `deploy-gate.yml`; punto 3 escrito en `docs/despliegue.md` §9 | `tests/neon-preview-cleanup-workflow.test.ts` · CA-6 6.1–6.2 + `tests/spec-031-frontera.test.ts` y `tests/spec-032-frontera.test.ts` verdes **sin editarlos**; el punto 3 lo congela `tests/runbook-limpieza-preview.test.ts` · CA-7.2 | | ❌ |
| 🔒 CA-7 el runbook cuenta la trampa, la solución y su contrapartida (§6, §9, §13, §13.3) | `docs/despliegue.md`: §6 (gotcha nuevo), §9 (tabla de los tres workflows), §13 (filas de ops 7, 8 y 9), §13.3 **reescrita** | `tests/runbook-limpieza-preview.test.ts` · CA-7.1–7.6, troceando el documento por secciones | | ❌ |
| 🚀 CA-8 al cerrar la PR, la rama desaparece de Neon y el recuento baja en una | `.github/workflows/neon-preview-cleanup.yml` | **no testeable desde el repo** — evidencia abajo. Bloqueado por F-SPEC-042-1 y F-SPEC-042-2 | | ❌ |
| 🚀 CA-9 comportamiento ante una rama inexistente, medido y escrito | hueco escrito en `docs/despliegue.md` §13.3 (*"lo que aún no se sabe"*), a la espera del dato | **no testeable desde el repo** — se mide re-ejecutando el workflow de CA-8. **NO se ha puesto `continue-on-error`** (CA-5.5, congelado en `tests/neon-preview-cleanup-workflow.test.ts` · 5.5) | | ❌ |
| 🚀 CA-10 nada que no fuera una preview se tocó (`main` sigue ahí) | prefijo `preview/` literal en `.github/workflows/neon-preview-cleanup.yml` | **no testeable desde el repo** — comparación de las dos listas del panel de Neon | | ❌ |

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
**Implementación cerrada el 2026-08-20** por sdd-implementador, en
`ft/SPEC-042-limpieza-automatica-de-ramas-de-preview-en-neon`, dos commits sobre `origin/main`
(`acf90a2`):

- `1f2ded6` — el workflow y su test (CA-1 … CA-6).
- `8d91a8b` — el runbook y su test (CA-7).

El gate humano del **2026-08-20** decidió los seis puntos: **sin ADR-027** (D-4 de ADR-018 se lee
como propiedad **del CI**, no como frontera del repositorio), **los dos valores de ops se crean
ANTES del merge** para que el *fail-closed* sea decisión y no sorpresa, y **se acepta** que las
URLs de preview antiguas dejen de conectar.

**Qué está hecho**: los siete CA 🔒. Cinco gates en verde (`typecheck`, `lint`, `test` 1180/1180,
`build`, `test:e2e` 195/195). `ci.yml` y `deploy-gate.yml` **no cambian ni un byte** —comprobado
contra `origin/main` en el propio test— y `tests/spec-031-frontera.test.ts` y
`tests/spec-032-frontera.test.ts` siguen verdes **sin editarlos**.

**Qué falta, y no lo puede cerrar el repositorio**: los tres CA 🚀. Están bloqueados por dos
acciones de ops del humano, `F-SPEC-042-1` y `F-SPEC-042-2`, que el gate colocó **antes** del
merge. El orden operativo es:

1. Crear la variable `NEON_PROJECT_ID` y el secreto `NEON_API_KEY` (`docs/despliegue.md` §13,
   filas 7 y 8). Al crear la clave, **anotar aquí qué alcance tiene realmente**: si Neon permitió
   acotarla a este proyecto o quedó de cuenta. Es el punto 2 del gate y el residual de **R-1**.
2. Mezclar la PR de esta spec y **cerrarla**. El workflow corre al cerrar, mergeada o no.
3. Recoger la evidencia de CA-8 y CA-10 **antes y después**: la lista de ramas de Neon con sus
   **nombres**, no solo el recuento, y el enlace a la ejecución en Actions.
4. Re-ejecutar esa misma ejecución (*Re-run*) sobre la rama **ya borrada** y anotar el veredicto
   de CA-9: **verde o rojo, y con qué mensaje**. Va al ledger **y a §13.3**, donde ya hay hueco
   escrito para el dato. Si sale **rojo**, abrir follow-up en el acto: un limpiador que da falsos
   rojos de rutina se acaba ignorando.

**Lo que NO se ha hecho, a propósito**: no se ha puesto `continue-on-error` preventivo (CA-5.5 y
CA-9), no se han creado los dos valores de ops (son del humano), no se ha tocado `src/`, ni
`package.json`, ni `vercel.json`, ni `ci.yml`, ni `deploy-gate.yml`, ni ningún test de otra spec,
ni se ha hecho push ni PR.
