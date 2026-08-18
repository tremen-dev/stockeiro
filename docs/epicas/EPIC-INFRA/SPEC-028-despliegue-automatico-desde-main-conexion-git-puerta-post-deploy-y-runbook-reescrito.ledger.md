---
id: SPEC-028
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-028 Despliegue automático desde `main`: conexión Git, puerta post-deploy y runbook reescrito

## Resumen
- Fase: escrita por sdd-arquitecto el 2026-08-18 y **APROBADA en el gate humano del 2026-08-18**
  (Alberto Fojo), con cuatro resoluciones aplicadas. **La transición de estado la registra el
  orquestador**: la fuente de verdad es el frontmatter de la spec.
- Rama: `ft/SPEC-028-despliegue-automatico` (worktree `.claude/worktrees/spec-028`), sobre
  `origin/main` @ `de3a6ee` (incluye SPEC-031 y SPEC-032 mergeadas).
- Origen: punto **4** del desglose orientativo de **ADR-018**. Id **reservado desde el
  2026-08-17** y referenciado por nombre desde ADR-018 §Desglose y desde los ledgers de
  SPEC-027, SPEC-031 y SPEC-032.
- **Pregunta 1 del gate de ADR-018 respondida con un SÍ** por el humano (Alberto Fojo,
  2026-08-18): se conecta el repo, con despliegue automático al mergear. La alternativa 4 del
  ADR (rama `production`) **no se plantea** en esta spec.

### Resoluciones del gate del 2026-08-18

| # | Qué se decidió | Efecto en la spec |
|---|---|---|
| 1 | **Se conecta igualmente, sin pagar la protección de rama de GitHub.** En contra de la recomendación del arquitecto: **riesgo aceptado y fechado**. | `F-SPEC-028-1` queda **abierto como riesgo aceptado**, con el análisis intacto. Lo verificable que se deriva es **CA-12.5** (el runbook dice que mirar el check es el único freno). |
| 2 | **D-7 se adopta**, con el matiz de que el paso a `hecho` ocurre **después** del merge. | **CA-14 nuevo** (`RI-02` en `docs/fundacion/reglas.md`). **Cierra `F-SPEC-031-1`.** Total: **14 CA**. |
| 3 | **El atraso se drena a mano ANTES de conectar.** | §Acciones de ops pasa a ser una **precondición ordenada**: drenar → verificar que `/api/version` deja de dar 404 → `ALLOW_MIGRATE=1` → conectar. |
| 4 | **Sin cambios**: e2e en cada PR; la ventana de restauración de Neon la mira el humano por su cuenta y no bloquea. | `F-SPEC-028-2` (techo de 10 ramas de Neon) sigue abierto; la pregunta 7 de ADR-018 sigue sin medirse. |

### Prerrequisitos, verificados en este árbol (no supuestos)

| Prerrequisito | Estado | Evidencia en el árbol |
|---|---|---|
| Identidad del despliegue (SPEC-031) | ✅ vivo | `src/app/api/version/route.ts`, `scripts/check-alive.mjs` |
| BD de Preview separada (F-SPEC-023-1) | ✅ cerrado 2026-08-18 | `docs/despliegue.md` cabecera y §8 (*preview branching* de Neon) |
| Guardias de migración (SPEC-032) | ✅ vivo | `scripts/guard-migrate.mjs` en el `buildCommand` de `vercel.json`, `Migration scan` en `ci.yml`, `RI-01` en `docs/fundacion/reglas.md` |

### Línea base medida el 2026-08-18 (el "antes" de CA-2)

```
$ node scripts/check-alive.mjs --url https://stockeiro.tremen.dev --timeout 12 --interval 4
[check-alive] Se agotó el plazo (12s) esperando a https://stockeiro.tremen.dev/api/version.
[check-alive] último motivo: HTTP 404
exit 1
```

`/api/version` responde **404** en producción: el despliegue vivo es anterior al merge de
SPEC-031. Atraso mergeado y mudo: **SPEC-026, 027, 029, 031, 032**, más la migración
`0008_puzzling_eddie_brock` (`ADD COLUMN instrument_type`, aditiva) **sin aplicar en Neon**.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->

**Lee la columna *Cierre* antes que ninguna otra**: 🚀 significa que ese CA **no se puede cerrar
sin un despliegue real**, y su fila de *Verif.* debe llevar la evidencia nombrada en la spec
(comando, salida y URL), no un test.

| CA | Cierre | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|---|
| CA-1 Mergear despliega, sin que nadie teclee | 🚀 despliegue real | | | | ❌ |
| CA-2 Producción dice de qué commit viene | 🚀 despliegue real | | | | ❌ |
| CA-3 Preview existe y no migra la base de producción | 🚀 despliegue real | | | | ❌ |
| CA-4 La puerta existe, en su propio workflow | 🔒 sin desplegar | | | | ❌ |
| CA-5 Consume `check-alive.mjs` tal cual | 🔒 sin desplegar | | | | ❌ |
| CA-6 Sin instalar nada, sin secretos | 🔒 sin desplegar | | | | ❌ |
| CA-7 Plazo mayor que el build, veredicto no tragado | 🔒 sin desplegar | | | | ❌ |
| CA-8 Concurrencia propia; la CI no cambia | 🔒 sin desplegar | | | | ❌ |
| CA-9 Nada más cableado; ni un test ajeno tocado | 🔒 sin desplegar | | | | ❌ |
| CA-10 La puerta corre en el merge y sale verde | 🚀 despliegue real | | | | ❌ |
| CA-11 El despliegue manual pasa a emergencia | 🔒 sin desplegar | | | | ❌ |
| CA-12 El runbook documenta el pipeline y el rojo | 🔒 sin desplegar | | | | ❌ |
| CA-13 La config de plataforma queda escrita, con techos | 🔒 sin desplegar | | | | ❌ |
| CA-14 `RI-02`: "hecho" significa "vivo" (D-7 adoptado) | 🔒 sin desplegar | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
Pendiente. **Aviso para quien verifique**: esta spec es la única de la serie que **no se puede
cerrar entera sin desplegar**, y ADR-018 lo anticipó. **Diez CA** (CA-4 … CA-9, CA-11 … CA-14) se
cierran con tests estáticos y `git diff`, exactamente como SPEC-031 y SPEC-032; los **cuatro**
marcados 🚀 (CA-1, CA-2, CA-3, CA-10) exigen que las acciones de ops estén hechas y se cierran
con evidencia pegada, no con un test. No los des por buenos con un test que "prueba la
intención": la intención ya la prueban CA-4…CA-9.

Y **CA-14 es 🔒 a propósito**, aunque hable de despliegues: lo que exige es que `RI-02` **esté
escrita** con su contenido, su fuente y su mecanismo, y que `RI-01` y las quince `RN` sigan
intactas. Que la regla se cumpla es trabajo del ciclo a partir de aquí, no de este verificador.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-028/. Informe HTML opcional: _qa/SPEC-028/informe.html -->
No hay UI: ninguna pantalla cambia. La evidencia de esta spec es de **plataforma**, y va aquí
en forma de salidas de comando y enlaces:

| CA | Evidencia esperada |
|---|---|
| CA-1 | `vercel ls --prod` posterior al merge · `vercel inspect <url>` con `meta.githubCommitSha` · enlace al despliegue con *Source* = `main` + commit |
| CA-2 | `curl -s https://stockeiro.tremen.dev/api/version` · `node scripts/check-alive.mjs --url https://stockeiro.tremen.dev --commit $(git rev-parse origin/main)` → exit 0 |
| CA-3 | URL de Preview publicada en la PR · `curl` de su `/api/version` (`environment: "preview"`) · las **dos** líneas de `guard-migrate` (Preview y Production) con host y base distintos |
| CA-10 | URL del run de GitHub Actions de la puerta para el commit del merge, en verde, con el log del step |

## Acciones de ops (del humano; su evidencia se pega aquí, pero NO son CA)

**El orden es una precondición firmada en el gate del 2026-08-18**, no una sugerencia.

| # | Acción | Estado | Evidencia |
|---|---|---|---|
| 1 | **Drenar el atraso a mano** (SPEC-026/027/029/031/032 + migración `0008`): `git switch --detach origin/main` + `vercel --prod --archive=tgz` | ⏳ pendiente | |
| 2 | **Verificar que llegó**: `/api/version` deja de dar 404 (saldrá `commit: unknown`, y **es correcto**) | ⏳ pendiente | |
| 3 | `ALLOW_MIGRATE=1` en Preview (`vercel env add ALLOW_MIGRATE preview`) — **F-SPEC-032-2** | ⏳ pendiente | |
| 4 | Conectar `tremen-dev/stockeiro` al proyecto de Vercel, rama de producción `main` | ⏳ pendiente | |
| 5 | Comprobar qué despliegue se disparó al conectar (`vercel ls --prod`) | ⏳ pendiente | |
| 6 | Anotar el techo de ramas de Neon (10 en el plan Free; las de preview sobreviven al cierre de la PR) | ⏳ pendiente | |

**Por qué ese orden, con dos razones distintas**: #1 y #2 van primero para no acoplar dos riesgos
independientes en un solo día (si el primer despliegue automático falla, se sabrá si falló el
pipeline o el atraso). #3 va antes que #4 porque la guardia de SPEC-032 es *fail-closed*: conectar
el repo sin `ALLOW_MIGRATE` deja **todas** las previews en rojo.

## Salvedades / follow-ups
<!-- IDs F-SPEC-028-1, F-SPEC-028-2… con destino (spec futura o EPIC-MEJORA). -->
Declarados ya al nacer la spec (en §Fuera de alcance y §Notas para el gate):

- **F-SPEC-028-1 — 🟠 RIESGO ACEPTADO (Alberto Fojo, 2026-08-18). Sin una CI capaz de impedir el
  merge, esta spec pone producción a un merge de distancia de cualquier rojo.**
  **Queda ABIERTO a propósito**: no es una tarea pendiente, es un riesgo que se conocía y se
  asumió, con fecha y con nombre. El análisis, intacto: es `F-SPEC-027-1` heredado **con gravedad
  subida**, porque hasta hoy entre un merge malo y producción había una persona que tenía que
  decidir desplegar, y **esta spec la retira**. ADR-018 sustituyó ese gate humano por *"una PR con
  typecheck, lint, 253 unitarios, 24 e2e, migraciones estrenadas y escáner de SQL destructivo"*, y
  **esa PR hoy no puede decir que no** (repo privado + org en plan free → `403 Upgrade to GitHub
  Pro`). Un merge en rojo llega a producción solo, y la puerta post-deploy confirmará que ese
  código roto está vivo — porque lo estará.
  *Lo que se decidió*: conectar igualmente, **sin** comprar la protección de rama. El freno pasa a
  ser la disciplina de mirar el check antes de mezclar. **Va en contra de la recomendación del
  arquitecto**, y así se deja escrito.
  *Mitigación entregada aquí*: **CA-12.5** — el runbook lo dice donde se lee antes de mezclar.
  *Salidas si el criterio cambia*: pagar GitHub Team (~4 $/asiento/mes, hoy 1 asiento) y exigir
  `CI / Checks` y `CI / E2E` sobre `main`; o hacer público el repo (descartado: app financiera
  privada). → destino: EPIC-INFRA, sin fecha.
- **F-SPEC-028-2 — El techo de ramas de Neon (10 en el plan Free) pasa a ser un recurso escaso
  el día que el repo se conecte**, y las ramas de preview **sobreviven al cierre de la PR**
  (retención de 6 meses de Vercel). Sin mantenimiento, la preview número 11 no despliega
  (`Require Active Resource Before Deploy`). La spec lo documenta (CA-13.3); vigilarlo y podarlo
  es **ops**. → EPIC-INFRA / ops.
- **F-SPEC-028-3 — No hay puerta post-deploy para los despliegues de Preview.** Exigiría la URL
  de Preview (evento `deployment_status` o token de Vercel, que es un secreto y ADR-018 D-4.1 los
  evita). La PR muestra el check propio de Vercel. → follow-up sin urgencia.

Heredados, con su estado real:

- **F-SPEC-031-1 — ✅ CERRADO el 2026-08-18: D-7 (*"hecho" exige "vivo"*) SE ADOPTA.** Estuvo
  aplazado a este gate con razón escrita (antes de esta spec la regla era incumplible). El humano
  lo firmó **con el matiz que lo hizo firmable**: el verificador trabaja antes del merge, así que
  la regla mueve el paso a `hecho` a **después**, con la puerta verde como evidencia. Aterriza en
  `docs/fundacion/reglas.md` como **`RI-02`** → **CA-14**, que **escribe el implementador** (el
  arquitecto no toca ese fichero, igual que en SPEC-032 con `RI-01`). Responde la **pregunta 3 del
  gate de ADR-018**, abierta desde el 2026-08-17. **ADR-018 no se modifica**: es inmutable, y esto
  es la respuesta a su pregunta, no una enmienda.
  *Alcance, que sigue vigente*: `RI-02` es **convención local de este repositorio**. El ciclo
  tremen-sdd es del plugin; llevarla allí sería un `KI` para su mantenedor y **no es trabajo de
  esta spec**.
- **F-SPEC-032-1 — el permiso `ALLOW_MIGRATE` en Preview es permanente y asume que el *preview
  branching* sigue encendido.** **CA-3.3 cierra su mitad observable** (queda medido y escrito, una
  vez y con el pipeline vivo, que el host de Preview no es el de producción). La otra mitad
  —impedirlo desde el build— exige conocer la identidad de la base de producción dentro del repo o
  un marcador de la integración de Neon no verificado; **no se inventa aquí**. Sigue abierto →
  EPIC-INFRA.
- **F-SPEC-032-2 — `ALLOW_MIGRATE=1` en el entorno Preview.** Partido a propósito: el **acto**
  sigue siendo ops (#1 de la tabla de arriba); su **efecto** pasa a ser CA (**CA-3.1**), porque
  con el repo conectado una Preview verde es prueba imposible de falsear de que la variable
  existe. Sancionar el reparto es punto 6 del gate.
- **F-SPEC-011-1 — el build necesita `cdn.sheetjs.com`.** Sin cambio de sustancia, con cambio de
  exposición: pasa a afectar a **cada** build de Preview y de producción, no solo a los manuales.
- **Pregunta 7 del gate de ADR-018 — la ventana de restauración de Neon sigue sin medirse**, y es
  la red última ahora que se retira el freno humano. Comprobación de ops de cinco minutos
  (§Notas, punto 5).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
**Estado: spec APROBADA en el gate del 2026-08-18 y con las cuatro resoluciones ya aplicadas al
documento.** El frontmatter sigue en `borrador` **a propósito**: la transición la registra el
orquestador con `estado.mjs`, no el arquitecto. No hay implementación, ni tests, ni cambios en el
código.

**Qué hay en la rama `ft/SPEC-028-despliegue-automatico`** (worktree `.claude/worktrees/spec-028`,
sobre `origin/main` @ `de3a6ee`): **solo estos dos ficheros**, la spec y este ledger. Ni una línea
de `src/`, ni de `.github/`, ni de `vercel.json`.

**Lo que el gate decidió y que el implementador no puede desandar**: se conecta sin protección de
rama (riesgo aceptado, `F-SPEC-028-1`), **D-7 se adopta y es CA-14**, y **el atraso se drena a
mano antes de conectar** (§Acciones de ops, pasos 1 y 2).

**Qué hace el implementador**, por bloques y en este orden:

1. **Bloque B, sin desplegar** (CA-4 … CA-9): `.github/workflows/deploy-gate.yml` + su test
   estático, al estilo de `tests/ci-workflow.test.ts` (parsear el YAML, no regex). **No tocar
   `ci.yml`, ni `vercel.json`, ni `scripts/`, ni los tests de frontera de SPEC-031/032** — CA-9
   lo vigila.
2. **Bloque C, sin desplegar** (CA-11 … CA-13): reescritura de `docs/despliegue.md` + su test
   estático, al estilo de `tests/runbook-guardias-migracion.test.ts`. **No olvidar CA-12.5**: es
   lo único que deja rastro en el repositorio del riesgo aceptado en `F-SPEC-028-1`.
3. **Bloque D, sin desplegar** (CA-14): `RI-02` en `docs/fundacion/reglas.md`, dentro de la
   sección *"Reglas de ingeniería (RI-xx)"* **que ya existe** — no se crea otra —, con su test
   estático al estilo de `tests/reglas-ingenieria.test.ts`. **No tocar `RI-01` ni ninguna `RN`.**
4. **Parar y devolver.** Los CA 🚀 (CA-1, CA-2, CA-3, CA-10) **no los cierra el implementador**:
   dependen de las acciones de ops del humano y de un merge real. Se cierran en el ledger con
   evidencia después.

**Cómo comprobarlo sin red y sin desplegar**, cuando el bloque B y C estén:

```bash
npm ci                     # dentro del worktree: sin node_modules propio, la resolución cae al padre
npm run typecheck && npm run lint && npm test
git diff --stat -- .github/workflows/ci.yml vercel.json src tests/spec-031-frontera.test.ts tests/spec-032-frontera.test.ts
# debe salir VACIO (CA-9)
git diff -- docs/fundacion/reglas.md
# solo AÑADE RI-02; ni RI-01 ni ninguna RN-xx cambian (CA-14.3)
```
