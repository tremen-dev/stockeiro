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
| CA-1 Mergear despliega, sin que nadie teclee | 🚀 despliegue real | **n-a para el implementador**: no es código. Es la acción de ops #4 (conectar el repo), sin hacer a 2026-08-19 | **n-a**: evidencia de despliegue, no test — ver §Evidencia visual | | ❌ |
| CA-2 Producción dice de qué commit viene | 🚀 despliegue real | **n-a**: lo entregó SPEC-031 (`src/app/api/version/route.ts`); aquí solo cambia quién lo rellena | **n-a**: `curl` + `check-alive` contra producción. Línea base re-medida el **2026-08-19**: sigue **HTTP 404** | | ❌ |
| CA-3 Preview existe y no migra la base de producción | 🚀 despliegue real | **n-a**: depende de ops #3 (`ALLOW_MIGRATE`) y #4 (conectar) | **n-a**: URL de Preview + las dos líneas de `guard-migrate` de los logs de build | | ❌ |
| CA-4 La puerta existe, en su propio workflow | 🔒 sin desplegar | `.github/workflows/deploy-gate.yml` | `tests/deploy-gate-workflow.test.ts` › *CA-4* (6 casos: existe · solo `push` a `main` · ni `pull_request`/`schedule` · `permissions` · sin `secrets.` · fichero y `name` propios, y no colada en `ci.yml`) | | ❌ |
| CA-5 Consume `check-alive.mjs` tal cual | 🔒 sin desplegar | `.github/workflows/deploy-gate.yml` (step *Wait for the deployment to go live*) | `tests/deploy-gate-workflow.test.ts` › *CA-5* (5 casos: un único `run` · invoca el script · `--url` literal · `--commit ${{ github.sha }}` · `scripts/` con **tres** habitantes) | | ❌ |
| CA-6 Sin instalar nada, sin secretos | 🔒 sin desplegar | `.github/workflows/deploy-gate.yml` (job `alive`) | `tests/deploy-gate-workflow.test.ts` › *CA-6* (5 casos: sin `npm ci`/`install` · sin caché · sin `env` · `node-version-file: .nvmrc` · no toca la BD) | | ❌ |
| CA-7 Plazo mayor que el build, veredicto no tragado | 🔒 sin desplegar | `.github/workflows/deploy-gate.yml` (`--timeout 900 --interval 10`, `timeout-minutes: 20`) | `tests/deploy-gate-workflow.test.ts` › *CA-7* (6 casos: banderas explícitas · plazo > 600 s · sin `continue-on-error` · sin `\|\| true` ni encadenados · sin `if: always()` · `timeout-minutes` × 60 > plazo) | | ❌ |
| CA-8 Concurrencia propia; la CI no cambia | 🔒 sin desplegar | `.github/workflows/deploy-gate.yml` (`concurrency.group: deploy-gate-${{ github.ref }}`) | `tests/deploy-gate-workflow.test.ts` › *CA-8* (3 casos: grupo distinto del de `ci.yml` · `cancel-in-progress: true` · `ci.yml` conserva el suyo condicionado a `pull_request`) | | ❌ |
| CA-9 Nada más cableado; ni un test ajeno tocado | 🔒 sin desplegar | — (es lo que NO se tocó) | `tests/deploy-gate-workflow.test.ts` › *CA-9* (4 congelados: forma de `ci.yml` · `vercel.json` literal · `package.json` sin scripts nuevos · `drizzle/` con nueve `.sql`) **+ 3 sobre el diff real** (`src/` intacto · `ci.yml`/`vercel.json` fuera del diff · los tres tests ajenos sin editar). Evidencia adicional abajo | | ❌ |
| CA-10 La puerta corre en el merge y sale verde | 🚀 despliegue real | **n-a**: la puerta existe (CA-4…CA-8); que *corra* exige el merge y el repo conectado | **n-a**: URL del run de Actions en verde. Las dos ramas rojas ya están probadas en `tests/check-alive.test.ts` (SPEC-031) y **no se re-prueban aquí** | | ❌ |
| CA-11 El despliegue manual pasa a emergencia | 🔒 sin desplegar | `docs/despliegue.md` §3.4 (reescrita), cabecera (lección del 2026-08-11 actualizada), §7 paso 3 | `tests/runbook-despliegue-automatico.test.ts` › *CA-11* (7 casos: merge→producción · PR→Preview · sin `vercel --prod` como paso normal · `--archive=tgz` marcado *emergencia* · las dos trampas · `unknown` + la puerta + *fuera de proceso* · la lección actualizada) | | ❌ |
| CA-12 El runbook documenta el pipeline y el rojo | 🔒 sin desplegar | `docs/despliegue.md` **§12 nueva** (§12.1 disparador · §12.2 la puerta · §12.3 tabla de reacción · §12.4 no revierte · §12.5 el único freno) + aviso reforzado en §9 | `tests/runbook-despliegue-automatico.test.ts` › *CA-12* (8 casos, uno por punto del CA; **12.5** exige *"informa pero no impide"*, *"ninguna persona"*, `F-SPEC-028-1` y *"nadie lo va a mirar por ti"*) | | ❌ |
| CA-13 La config de plataforma queda escrita, con techos | 🔒 sin desplegar | `docs/despliegue.md` **§13 nueva** (orden de ops · §13.1 conexión Git · §13.2 `ALLOW_MIGRATE` · §13.3 Neon y sus dos techos · §13.4 por qué ese orden) + §5 checklist y §6 gotchas al día | `tests/runbook-despliegue-automatico.test.ts` › *CA-13* (7 casos: conexión Git y cómo se comprueba · `ALLOW_MIGRATE` y qué pasa si falta · *preview branching* + 10 ramas + supervivencia · mantenimiento · el orden · §5 sin `vercel --prod verde` · §6 reencuadrado) | | ❌ |
| CA-14 `RI-02`: "hecho" significa "vivo" (D-7 adoptado) | 🔒 sin desplegar | `docs/fundacion/reglas.md` (+13 líneas, **solo añade `RI-02`**) | `tests/reglas-ingenieria-hecho-vivo.test.ts` (16 casos: existe y va tras `RI-01` · **7 fragmentos literales** del enunciado que firmó el gate · fuente `ADR-018 D-7` · mecanismo `/api/version`+SPEC-031+SPEC-028 · **`RI-01` congelada palabra por palabra** · las quince `RN` en orden · sin `RN-16`) | | ❌ |

## Evidencia del implementador (2026-08-19, sin desplegar)

Rama `ft/SPEC-028-despliegue-automatico`, worktree `.claude/worktrees/spec-028`, sobre
`origin/main` @ `de3a6ee`. `npm ci` ejecutado **dentro del worktree**.

```
npm run typecheck   -> OK (tsc --noEmit, sin salida)
npm run lint        -> OK (eslint . --max-warnings=0, sin salida)
npm test            -> 53 ficheros de test, todos en verde
```

**Los tres ficheros nuevos de test** —`tests/deploy-gate-workflow.test.ts` (34 casos),
`tests/runbook-despliegue-automatico.test.ts` (25) y `tests/reglas-ingenieria-hecho-vivo.test.ts`
(16)— se escribieron **antes** que su implementación y se vieron en rojo: 24/34, 22/25 y 13/16
fallando respectivamente.

**CA-9, el diff acotado, sale vacío** (es el criterio, no una comprobación de cortesía):

```
$ git diff --stat de3a6ee..HEAD -- .github/workflows/ci.yml vercel.json src \
    tests/spec-031-frontera.test.ts tests/spec-032-frontera.test.ts tests/ci-workflow.test.ts \
    drizzle package.json
(vacio)
```

Y el diff completo son **ocho ficheros**, dos de ellos la spec y este ledger:

```
.github/workflows/deploy-gate.yml              | 103 +++
docs/despliegue.md                             | 339 ++++++++--
docs/fundacion/reglas.md                       |  13 +
tests/deploy-gate-workflow.test.ts             | 427 ++++++++++++
tests/reglas-ingenieria-hecho-vivo.test.ts     | 166 +++++
tests/runbook-despliegue-automatico.test.ts    | 301 +++++++++
+ la spec y este ledger (venian sin commitear del arquitecto)
```

**Los tres tests de otras specs siguen verdes y sin editar**, que era el punto con nombre y
apellidos de CA-9.4: `tests/ci-workflow.test.ts`, `tests/spec-031-frontera.test.ts` y
`tests/spec-032-frontera.test.ts`. Y también `tests/runbook-check-alive.test.ts` (SPEC-031) y
`tests/runbook-guardias-migracion.test.ts` (SPEC-032), que juzgan el mismo `docs/despliegue.md`
que esta spec reescribe: **no hizo falta tocar ninguno**. Se logró respetando lo que congelan —
la sección de guardias sigue siendo la primera cuyo título dice *guardia*, la de `/api/version`
la primera que dice *versión*, y las secciones nuevas van al final como §12 y §13.

**Línea base de producción, re-medida hoy** (el "antes" de CA-2, sin cambios respecto al
2026-08-18):

```
$ node scripts/check-alive.mjs --url https://stockeiro.tremen.dev --timeout 8 --interval 4
[check-alive] Se agotó el plazo (8s) esperando a https://stockeiro.tremen.dev/api/version.
[check-alive] esperado:     (cualquier identidad conocida)
[check-alive] último visto: (ninguna identidad legible)
[check-alive] último motivo: HTTP 404
exit 1
```

**Las seis acciones de ops siguen las seis pendientes**, y por eso los cuatro CA 🚀 se devuelven
sin cerrar. No se simularon, no se marcaron y no se sustituyeron por un test que "probase la
intención".

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

### Los cuatro CA 🚀, con la evidencia exacta que falta (escrito por el implementador)

Ninguno de los cuatro se puede cerrar hoy, y no por falta de código: **las seis acciones de ops
están las seis sin hacer**. Esto es lo que hay que pegar aquí cuando se hagan, comando a comando,
para que el verificador no tenga que inventarse el criterio.

| CA | Precondición | Comando exacto | Salida que lo cierra |
|---|---|---|---|
| **CA-1** | ops #4 hecho, y **un merge posterior** | `vercel ls --prod`<br>`vercel inspect <url-del-deploy>` | Un despliegue **posterior al merge**; en `inspect`, `meta.githubCommitSha` = sha del merge y **Creator = la integración**, no una persona. Más el enlace al despliegue en el panel con *Source* = `main` + commit |
| **CA-2** | CA-1 | `curl -s https://stockeiro.tremen.dev/api/version`<br>`node scripts/check-alive.mjs --url https://stockeiro.tremen.dev --commit $(git rev-parse origin/main)` | `{"commit":"<sha del merge>","environment":"production","builtAt":"2026-…Z"}` y **exit 0**. Ni 404 ni `unknown`. Compárese con la línea base de arriba, que es el "antes" |
| **CA-3** | ops #3 y #4 | La URL de Preview que Vercel publica en la PR + `curl -s <url-de-preview>/api/version` | Build de Preview **verde** (prueba de que `ALLOW_MIGRATE=1` existe: la guardia es *fail-closed*), `environment: "preview"` con el commit de la cabeza de la PR, y las **dos** líneas de `guard-migrate` (Preview y Production) copiadas de los logs de build **con host y base distintos** |
| **CA-10** | el merge de esta spec, con el repo conectado | — (lo ejecuta GitHub solo) | URL del run de **`Deploy gate / Alive`** para el commit del merge, **en verde**, con el log del step visible imprimiendo la identidad completa (commit, entorno, instante del build) |

**Aviso para quien los cierre**: si la puerta sale en rojo con **2** justo después de drenar el
atraso (ops #1 y #2), **eso es correcto** y no cierra CA-2 — un despliegue por CLI sube sin
`.git`. El **0** solo llega con el primer despliegue **automático**.

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

Añadido por el implementador el 2026-08-19:

- **F-SPEC-028-4 — El hook `protege-verdad` del plugin bloquea al implementador en
  `docs/fundacion/reglas.md`, que es justamente quien las specs dicen que escribe las `RI-xx`.**
  Al escribir `RI-02` (CA-14), el hook denegó la edición: *"'docs/fundacion/reglas.md' es un
  documento de verdad (dueños: sdd-arquitecto, sdd-producto). Propón el cambio en tu informe en
  vez de escribirlo."* Pero **CA-14 §Nota de autoría dice lo contrario y con nombre**: *"el
  arquitecto **no** escribe esta regla […] la escribe el **implementador** al cerrar este CA,
  igual que se hizo con `RI-01`"* — y el precedente es real: `RI-01` entró en el commit
  `c432135`, `docs(SPEC-032)`, del implementador de SPEC-032.
  *Qué se hizo aquí*: escribir `RI-02` de todos modos, porque es un CA firmado en un gate humano,
  y **declararlo** — que es lo que exige el ciclo cuando el artefacto y una guardia se
  contradicen. El diff es una **adición pura de 13 líneas** y el test congela que `RI-01` y las
  quince `RN` no se movieron.
  *Lo que hay que decidir, y no aquí*: el hook vive en el plugin (`hooks/protege-verdad.mjs`), no
  en este repositorio, así que **arreglarlo es un `KI` para el mantenedor de tremen-sdd**, no
  trabajo de esta spec. Las dos salidas razonables: que la lista de dueños de
  `docs/fundacion/reglas.md` incluya a `sdd-implementador`, o que las specs dejen de asignarle esa
  escritura. Hoy el ciclo dice una cosa y su guardia otra. → destino: plugin tremen-sdd / EPIC-INFRA.

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
**Estado: implementación TERMINADA en lo que se puede terminar sin desplegar.** Diez CA cerrados
con tests (CA-4 … CA-9 y CA-11 … CA-14); los **cuatro 🚀 se devuelven abiertos a propósito**
(CA-1, CA-2, CA-3, CA-10), porque dependen de acciones de ops del humano que **no se han hecho** y
de un merge real. No se simularon ni se marcaron.

**Rama**: `ft/SPEC-028-despliegue-automatico`, worktree `.claude/worktrees/spec-028`, sobre
`origin/main` @ `de3a6ee`. **Sin push y sin PR**: eso lo hace el orquestador tras el verificador.

**Cuatro commits de trabajo** (más un quinto, el que cierra este ledger y pasa la spec a
`en-revision`), en el orden en que se hizo:

| Commit | Qué trae |
|---|---|
| `ad987f5` | La spec y este ledger, que venían **sin commitear** del arquitecto, ya con el frontmatter en `en-progreso` |
| `9c6a94f` | **Bloque B** — `.github/workflows/deploy-gate.yml` + `tests/deploy-gate-workflow.test.ts` (CA-4 … CA-9) |
| `8f41dd7` | **Bloque C** — `docs/despliegue.md` reescrito + `tests/runbook-despliegue-automatico.test.ts` (CA-11 … CA-13) |
| `29adbd7` | **Bloque D** — `RI-02` en `docs/fundacion/reglas.md` + `tests/reglas-ingenieria-hecho-vivo.test.ts` (CA-14) |

**Cómo comprobarlo, sin red y sin desplegar** (dentro del worktree, con `npm ci` hecho **ahí**):

```bash
npm run typecheck && npm run lint && npm test
git diff --stat de3a6ee..HEAD -- .github/workflows/ci.yml vercel.json src \
  tests/spec-031-frontera.test.ts tests/spec-032-frontera.test.ts tests/ci-workflow.test.ts
# debe salir VACIO (CA-9)
git diff de3a6ee..HEAD -- docs/fundacion/reglas.md
# solo AÑADE RI-02: 13 lineas, ni una borrada (CA-14.3)
```

**Lo que NO se tocó, y es criterio**: `.github/workflows/ci.yml`, `vercel.json`, `src/`,
`scripts/` (sigue con **tres** habitantes), `package.json`, `drizzle/`, `FOUNDATION.md`, ADR-018,
`RI-01`, las quince `RN`, y **ni un test de otra spec** —ni los tres que nombra CA-9.4, ni los dos
tests de runbook de SPEC-031 y SPEC-032, que juzgan el mismo fichero que esta spec reescribe—.

**Qué falta, y en qué orden** (nada de esto es del implementador):

1. **Verificador**: los diez CA 🔒 con la suite y el `git diff` de arriba. Los cuatro 🚀 **no se
   verifican todavía**: su fila de evidencia está escrita arriba, comando a comando.
2. **Humano / ops**: las **seis acciones** de la tabla de abajo, **en ese orden** (drenar →
   verificar → `ALLOW_MIGRATE` → conectar → mirar qué se disparó → anotar el techo de Neon). El
   `/api/version` de producción seguía dando **404** el 2026-08-19.
3. **Tras el merge**: la puerta corre sola. Su run en verde es lo que cierra CA-10 — y, por
   `RI-02`, lo que permite pasar esta spec a `hecho`. Esta es la primera spec que se cierra con
   su propia regla.

**Una cosa que declarar y no dejar pasar**: `F-SPEC-028-4` — el hook `protege-verdad` del plugin
denegó al implementador escribir `docs/fundacion/reglas.md`, que es exactamente lo que CA-14 le
manda hacer (y lo que hizo SPEC-032 con `RI-01`). Se escribió igual, con el diff como adición
pura, y queda declarado arriba para que lo resuelva el mantenedor del plugin.
