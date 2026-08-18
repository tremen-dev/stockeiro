---
id: SPEC-031
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-031 El despliegue dice de qué commit viene: `/api/version` y comprobación de vida

## Resumen
- Fase: spec escrita por el arquitecto y **pasada por el gate humano el 2026-08-18 (Alberto
  Fojo): aprobada con un cambio y una decisión aplazada**. Sin implementación todavía. La
  fuente de verdad del estado es el frontmatter de la spec, y la transición la registra el
  orquestador con `estado.mjs`.
- **Resoluciones del gate**, ya aplicadas al texto de la spec:
  1. **La sentinela del contrato es `unknown`, no `desconocido`** (§CA-3, CA-4, CA-8 código de
     salida 2, CA-11). Decisión del humano **en contra de la recomendación del arquitecto**,
     por coherencia con la regla del proyecto (código e identificadores en inglés) y con las
     claves del JSON. Se aparta de la **letra** de ADR-018 D-6, no de su decisión: D-6 fija
     propiedades, no nombres. **ADR-018 no se ha tocado** y sus citas literales se conservan.
  2. **ADR-018 D-7 ("hecho" exige "vivo"): aplazada** → **F-SPEC-031-1**.
- Rama: `ft/SPEC-031-identidad-del-despliegue`
  (worktree `.claude/worktrees/spec-031`, basado en `origin/main` @ `2702111`)
- Origen: punto **3** del desglose orientativo de **ADR-018**. El punto 4 es **SPEC-028**
  (id reservado, referenciado por nombre desde ADR-018 y desde el ledger de SPEC-027).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 Endpoint público, cuerpo exacto | `src/app/api/version/route.ts` | `tests/version-endpoint.test.ts` (CA-1: 5 casos) · `tests/e2e/version.spec.ts` (CA-1, sin sesión) | | ❌ |
| CA-2 Identidad congelada en el build | `src/lib/version/identity.ts` (`deploymentIdentity`, resuelto al cargar) · `next.config.mjs` (`env`) · `src/lib/version/build-identity.mjs` | `tests/version-endpoint.test.ts` (CA-2: mutar `process.env` entre dos peticiones) · `tests/version-build-channel.test.ts` (8 casos: `env`, derivación, `grep VERCEL_GIT_` sobre `src/`) | | ❌ |
| CA-3 `unknown` (ausente / vacío / mal formado) | `src/lib/version/identity.ts` (`resolveIdentity`, `UNKNOWN`) | `tests/version-identity.test.ts` (31 casos) · `tests/version-endpoint.test.ts` («sha vacío → 200 y `unknown`») | | ❌ |
| CA-4 Fallback a git local, fail-safe | `src/lib/version/build-identity.mjs` (`gitHeadSha`, `buildIdentity`) | `tests/version-build-identity.test.ts` (10 casos: binario sustituido, dir sin repo, `PATH` recortado) · `tests/e2e/version.spec.ts` (CA-4 en build local) | | ❌ |
| CA-5 Responde con la BD caída | `src/app/api/version/route.ts` (único import: la identidad) | `tests/version-import-graph.test.ts` (grafo transitivo) · `tests/version-endpoint.test.ts` (sin `DATABASE_URL`) | | ❌ |
| CA-6 `Cache-Control: no-store` + render dinámico | `src/app/api/version/route.ts` (`no-store`, `dynamic = 'force-dynamic'`) | `tests/version-endpoint.test.ts` (CA-6: 2 casos) · `tests/e2e/version.spec.ts` (CA-6) | | ❌ |
| CA-7 No dice nada de ciclos (frontera ADR-018, contra el código) | `src/app/api/version/route.ts` | `tests/version-import-graph.test.ts` (prefijos prohibidos: `src/lib/market`, `src/lib/triggers`, `src/lib/notifications`, `src/app/api/cron`) · `tests/e2e/version.spec.ts` (CA-7) | | ❌ |
| CA-8 `scripts/check-alive.mjs`: contrato, stdlib, sin secretos | | | | ❌ |
| CA-9 Salida 0 cuando coincide (y modo *smoke*) | | | | ❌ |
| CA-10 Salida 1 cuando no llega, con esperado y visto | | | | ❌ |
| CA-11 Salida 2 en `unknown`; reintento; 3 si el cuerpo no es el contrato | | | | ❌ |
| CA-12 El runbook retira el `curl \| grep` | | | | ❌ |
| CA-13 Nada queda conectado (CI, `vercel.json`, red) | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
Pendiente. **Esta spec debe poder cerrarse sin desplegar nada**: es la razón por la que
ADR-018 pide no fusionar los puntos 3 y 4 del desglose. Si al verificar aparece un CA que
exige un despliegue real, es un defecto de la spec, no del verificador — pararse y devolverla.

## Evidencia visual
No aplica: esta spec no cambia ninguna pantalla. La evidencia es textual (respuestas HTTP,
códigos de salida de subproceso, salida de los tests estáticos).

## Salvedades / follow-ups

- **F-SPEC-031-1 — ADR-018 D-7 ("hecho" pasa a significar "vivo"): decisión APLAZADA.**
  Abierta en el gate del **2026-08-18**: el humano **ni la adopta ni la descarta**. Razón:
  mientras no exista **SPEC-028**, la comprobación de vida solo puede afirmar *"hay un
  despliegue nuevo"* (por `builtAt`), no *"contiene este commit"* —hoy `VERCEL_GIT_COMMIT_SHA`
  llega vacía—, así que adoptarla sería adoptar una regla que aún no se puede cumplir.
  **Destino: el gate de SPEC-028**, que es cuando la regla pasa a ser cumplible. Quien escriba
  SPEC-028 debe llevarla a ese gate junto con la pregunta 3 del gate de ADR-018, de la que
  procede. **No bloquea SPEC-031**: esta spec es el prerrequisito técnico de D-7, no su
  adopción, y se cierra igual sin ella. **ADR-018 no se modifica** (inmutable): D-7 sigue
  siendo una recomendación pendiente de firma.

Fronteras heredadas que **siguen abiertas y no se cierran aquí**:

- **F-SPEC-027-2** — `guard-migrate` (ADR-018 D-2) y escáner de SQL destructivo (D-5.2).
  **Bloqueante de SPEC-028**, no de esta: SPEC-031 no toca ni una línea de SQL.
- **F-SPEC-027-1** — la CI informa pero no impide mezclar (plan de GitHub). Sin efecto aquí.
- **F-SPEC-023-1** — `DATABASE_URL` compartida Production/Preview. La cierra la acción de ops
  del punto 2 del desglose (BD de Preview separada), no esta spec.

Dato de contexto verificado el **2026-08-18**, no es una salvedad de esta spec pero conviene
que no se pierda: **`SPEC-022` no existe** ni en `origin/main` ni en ninguna rama remota. La
referencian por nombre ADR-018 (§Frontera con SPEC-022) y el ledger de SPEC-023, pero el id
está libre en el árbol — o se escribió en una sesión paralela y nunca se subió, o se perdió.
No afecta a **CA-7**, que se verifica contra el **código del ciclo de refresco** ya existente
y no contra un documento; la spec ya está redactada así.

## Cómo retomar (handoff)
Estado real: **solo existe la spec en `borrador` y este ledger**. No hay ni una línea de
código, ni test, ni commit de implementación.

Siguiente paso: **implementar**. El gate ya se celebró (2026-08-18, Alberto Fojo) y la spec
está aprobada; sus dos resoluciones —sentinela `unknown` y D-7 aplazada— ya están aplicadas al
texto, así que **no queda nada que preguntar antes de empezar**. Lo único que falta por
registrar es la transición de estado a `aprobada`, que hace el orquestador con `estado.mjs`.

El orden natural de implementación es: (a) la función pura de
resolución de identidad con sus unitarios —es donde vive CA-3, el CA con más casos y el que
recoge el fallo real de hoy (`VERCEL_GIT_COMMIT_SHA` **vacía**, no ausente)—; (b) el canal de
build en `next.config.mjs` y la ruta; (c) `scripts/check-alive.mjs` con sus servidores de
juguete; (d) el runbook. Los tests estáticos de CA-2, CA-5, CA-7 y CA-13 siguen el patrón de
`tests/ci-workflow.test.ts` (SPEC-027): parsear de verdad, no pasarle regex al texto.
