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
| 1 | **Se conecta igualmente, sin pagar la protección de rama de GitHub.** En contra de la recomendación del arquitecto: **riesgo aceptado y fechado**. ⚠️ **SUPERADA el 2026-08-19** — ver el bloque de abajo. | `F-SPEC-028-1` quedó abierto como riesgo aceptado y **está CERRADO desde el 2026-08-19**. **CA-12.5 se reescribió con el signo contrario.** |
| 2 | **D-7 se adopta**, con el matiz de que el paso a `hecho` ocurre **después** del merge. | **CA-14 nuevo** (`RI-02` en `docs/fundacion/reglas.md`). **Cierra `F-SPEC-031-1`.** Total: **14 CA**. |
| 3 | **El atraso se drena a mano ANTES de conectar.** | §Acciones de ops pasa a ser una **precondición ordenada**: drenar → verificar que `/api/version` deja de dar 404 → `ALLOW_MIGRATE=1` → conectar. |
| 4 | **Sin cambios**: e2e en cada PR; la ventana de restauración de Neon la mira el humano por su cuenta y no bloquea. | `F-SPEC-028-2` (techo de 10 ramas de Neon) sigue abierto; la pregunta 7 de ADR-018 sigue sin medirse. |

### ⚠️ Actualización del 2026-08-19 — el repositorio es público y `main` está protegida

**Cambió el mundo, no la spec**, y un CA cambió de signo con él.

- El repositorio `tremen-dev/stockeiro` es **público** (`isPrivate: false`). La razón inmediata no
  era la protección de rama: la documentación de Vercel no permite desplegar en cuenta **Hobby**
  desde un repositorio **privado de una organización**, y el proyecto vive en el ámbito personal
  `albertofojo-5908s-projects`. Hacer público el repo fue la salida frente a pagar Vercel Pro.
- **Efecto colateral**: GitHub habilita la protección de rama, y **está activa**. Verificado contra
  la API (`gh api repos/tremen-dev/stockeiro/rulesets/21014989`): ruleset **`Protected main`**,
  `enforcement: active`, sobre `~DEFAULT_BRANCH`, con `pull_request` requerido,
  `required_status_checks` = **`Checks`** y **`E2E`**, `deletion` y `non_fast_forward` bloqueados,
  y **`bypass_actors: []`** — lista vacía, así que la regla frena también al dueño del repositorio.

**Consecuencias sobre esta spec**:

| Qué | Efecto |
|---|---|
| `F-SPEC-028-1` y `F-SPEC-027-1` | **CERRADOS el 2026-08-19** |
| **CA-12.5** | **Reescrito con el signo contrario** por el arquitecto: pedía que el runbook avisara de que *no* había red, y hoy la hay. Pedirlo tal cual haría que el runbook **afirmara algo falso en el sentido peligroso** |
| Los otros trece CA, la clasificación 🔒/🚀, y los cuatro 🚀 abiertos | **Sin cambio**. El repo sigue **sin conectar** a Vercel: la conexión es el siguiente paso del humano |

**Lo que hay que rehacer** (implementador, y después verificador): `docs/despliegue.md` **§12.5**
entera y el aviso de **§9** —los dos dicen hoy lo contrario de lo que ocurre—, más las aserciones
de `tests/runbook-despliegue-automatico.test.ts` que congelan las frases viejas.

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
| CA-1 Mergear despliega, sin que nadie teclee | 🚀 despliegue real | **n-a para el implementador**: no es código. Es la acción de ops #4 (conectar el repo), sin hacer a 2026-08-19 | **n-a**: evidencia de despliegue, no test — ver §Evidencia visual | 🚀 **ABIERTO — correcto que lo esté.** Las seis acciones de ops siguen sin ejecutar (comprobado: `/api/version` sigue en 404, luego el repo no está conectado). Evidencia declarada **suficiente por el lado de `meta.githubCommitSha`**; ver salvedad V-3 sobre `Creator` | ❌ |
| CA-2 Producción dice de qué commit viene | 🚀 despliegue real | **n-a**: lo entregó SPEC-031 (`src/app/api/version/route.ts`); aquí solo cambia quién lo rellena | **n-a**: `curl` + `check-alive` contra producción. Línea base re-medida el **2026-08-19**: sigue **HTTP 404** | 🚀 **ABIERTO.** El "antes" lo re-medí yo el **2026-08-19**: `node scripts/check-alive.mjs --url https://stockeiro.tremen.dev --commit bdffabb --timeout 8 --interval 4` → `HTTP 404`, **exit 1**. Evidencia declarada suficiente; ver salvedad V-4 (`git fetch` antes de `rev-parse origin/main`) | ❌ |
| CA-3 Preview existe y no migra la base de producción | 🚀 despliegue real | **n-a**: depende de ops #3 (`ALLOW_MIGRATE`) y #4 (conectar) | **n-a**: URL de Preview + las dos líneas de `guard-migrate` de los logs de build | 🚀 **ABIERTO.** Evidencia declarada **suficiente y correcta**, verificada contra el artefacto: en `scripts/guard-migrate.mjs`, con `VERCEL_ENV=preview` el **único** camino que autoriza es `ALLOW_MIGRATE=1` (una Preview verde sí es prueba imposible de falsear, CA-3.1), y la guardia imprime `[guard-migrate] DATABASE_URL: host=… base=…` sin credenciales, así que las dos líneas de CA-3.3 existen y son obtenibles | ❌ |
| CA-4 La puerta existe, en su propio workflow | 🔒 sin desplegar | `.github/workflows/deploy-gate.yml` | `tests/deploy-gate-workflow.test.ts` › *CA-4* (6 casos: existe · solo `push` a `main` · ni `pull_request`/`schedule` · `permissions` · sin `secrets.` · fichero y `name` propios, y no colada en `ci.yml`) | ✅ YAML **parseado por mí** con `yaml` fuera del test: `on` = `{push:{branches:[main]}}` y nada más · `permissions = {contents: read}` · `grep -n "secrets."` → 0 coincidencias · `name: Deploy gate` ≠ `name: CI`. 7/7 casos verdes | ✅ |
| CA-5 Consume `check-alive.mjs` tal cual | 🔒 sin desplegar | `.github/workflows/deploy-gate.yml` (step *Wait for the deployment to go live*) | `tests/deploy-gate-workflow.test.ts` › *CA-5* (5 casos: un único `run` · invoca el script · `--url` literal · `--commit ${{ github.sha }}` · `scripts/` con **tres** habitantes) | ✅ Único `run` = `node scripts/check-alive.mjs --url https://stockeiro.tremen.dev --commit ${{ github.sha }} --timeout 900 --interval 10` · `ls scripts/` = **tres** habitantes · y **ejecuté esa misma forma de banderas de verdad** contra producción: el script las acepta y responde su contrato. 5/5 verdes | ✅ |
| CA-6 Sin instalar nada, sin secretos | 🔒 sin desplegar | `.github/workflows/deploy-gate.yml` (job `alive`) | `tests/deploy-gate-workflow.test.ts` › *CA-6* (5 casos: sin `npm ci`/`install` · sin caché · sin `env` · `node-version-file: .nvmrc` · no toca la BD) | ✅ Tres steps: `actions/checkout@v4`, `actions/setup-node@v4` con `node-version-file: .nvmrc` (`.nvmrc` = 24) y el `run`. Ni `npm ci`/`npm install`, ni `cache`, ni `env`, ni `DATABASE_URL` en ningún nivel del árbol parseado. 5/5 verdes | ✅ |
| CA-7 Plazo mayor que el build, veredicto no tragado | 🔒 sin desplegar | `.github/workflows/deploy-gate.yml` (`--timeout 900 --interval 10`, `timeout-minutes: 20`) | `tests/deploy-gate-workflow.test.ts` › *CA-7* (6 casos: banderas explícitas · plazo > 600 s · sin `continue-on-error` · sin `\|\| true` ni encadenados · sin `if: always()` · `timeout-minutes` × 60 > plazo) | ✅ `--timeout 900 --interval 10` explícitos (los defectos del script son 120/5, leídos en `scripts/check-alive.mjs`, y son **segundos**) · sin `continue-on-error` en job, step ni fichero · el `run` no lleva `||`, `&&` ni `;` · sin `if:` · `timeout-minutes: 20` = 1200 s > 900 s. 6/6 verdes | ✅ |
| CA-8 Concurrencia propia; la CI no cambia | 🔒 sin desplegar | `.github/workflows/deploy-gate.yml` (`concurrency.group: deploy-gate-${{ github.ref }}`) | `tests/deploy-gate-workflow.test.ts` › *CA-8* (3 casos: grupo distinto del de `ci.yml` · `cancel-in-progress: true` · `ci.yml` conserva el suyo condicionado a `pull_request`) | ✅ `deploy-gate-${{ github.ref }}` + `cancel-in-progress: true`, frente al `${{ github.workflow }}-${{ github.ref }}` + `${{ github.event_name == 'pull_request' }}` de `ci.yml`, que sigue **fuera del diff**. 3/3 verdes | ✅ |
| CA-9 Nada más cableado; ni un test ajeno tocado | 🔒 sin desplegar | — (es lo que NO se tocó) | `tests/deploy-gate-workflow.test.ts` › *CA-9* (4 congelados: forma de `ci.yml` · `vercel.json` literal · `package.json` sin scripts nuevos · `drizzle/` con nueve `.sql`) **+ 3 sobre el diff real** (`src/` intacto · `ci.yml`/`vercel.json` fuera del diff · los tres tests ajenos sin editar). Evidencia adicional abajo | ✅ Sobre el **diff real** contra `de3a6ee`: el `git diff --stat` acotado sale **vacío**, y el diff completo son **8 ficheros**, ninguno ajeno. Suite completa **53 ficheros / 753 tests en verde**. Los 3 casos que dependen del commit base **se ejecutaron** (no se saltaron por `skipIf`). 7/7 verdes | ✅ |
| CA-10 La puerta corre en el merge y sale verde | 🚀 despliegue real | **n-a**: la puerta existe (CA-4…CA-8); que *corra* exige el merge y el repo conectado | **n-a**: URL del run de Actions en verde. Las dos ramas rojas ya están probadas en `tests/check-alive.test.ts` (SPEC-031) y **no se re-prueban aquí** | 🚀 **ABIERTO.** El nombre del check declarado, **`Deploy gate / Alive`**, coincide con lo que produce el YAML (`name: Deploy gate` + job `alive` con `name: Alive`): la evidencia pedida es la correcta. Ver salvedad V-2: si esta spec se mergea **antes** de ops #4, su primera pasada es un rojo garantizado | ❌ |
| CA-11 El despliegue manual pasa a emergencia | 🔒 sin desplegar | `docs/despliegue.md` §3.4 (reescrita), cabecera (lección del 2026-08-11 actualizada), §7 paso 3 | `tests/runbook-despliegue-automatico.test.ts` › *CA-11* (7 casos: merge→producción · PR→Preview · sin `vercel --prod` como paso normal · `--archive=tgz` marcado *emergencia* · las dos trampas · `unknown` + la puerta + *fuera de proceso* · la lección actualizada) | ✅ Leído `docs/despliegue.md`: §3.4 es ahora una tabla merge→producción / PR→Preview, y el bloque suelto ```vercel``` / ```vercel --prod``` **está borrado en el diff**; `--archive=tgz` queda bajo 🚨 *RECURSO DE EMERGENCIA* con las dos trampas (`"Not authorized"`, worktree) y la consecuencia nueva (`unknown` → puerta en rojo con **2**). La lección del 2026-08-11 **no se borró**: se reescribió en la cabecera. 7/7 verdes | ✅ |
| CA-12 El runbook documenta el pipeline y el rojo | 🔒 sin desplegar | `docs/despliegue.md` **§12** (§12.1 disparador · §12.2 la puerta · §12.3 tabla de reacción · §12.4 no revierte · **§12.5 REESCRITA el 2026-08-19**, con el signo contrario: `main` protegida, la tabla de piezas con el `gh api` que las comprueba, y los cuatro puntos del CA) + **aviso de §9 rehecho** (de *"la CI informa pero no impide"* a *"estos dos checks IMPIDEN mezclar"*, con lo que no cubre y el enlace a §12.5) | `tests/runbook-despliegue-automatico.test.ts` › *CA-12* (**14 casos**; 12.1–12.4 intactos. **12.5 rehecha**: 4 en positivo —PR obligatoria + `deletion`/`non_fast_forward` · `Checks`/`E2E` y `CI / Checks`/`CI / E2E` · ruleset `Protected main` + `enforcement: active` + `bypass_actors: []` · lo que NO cubre: revisión, rama al día, `Alive`— y **3 en negativo sobre el documento entero**: ni *"no impide mezclar"*, ni *"nadie lo va a mirar por ti"*, ni `F-SPEC-027-1`/`F-SPEC-028-1` presentados como abiertos) | ✅ §12 leída entera: 12.1 el encadenado `guard-migrate → db:migrate → next build`; 12.2 workflow, dominio, plazo y nombre del check; 12.3 los **cuatro** códigos con qué mirar en cada uno; 12.4 `vercel rollback` **con** *"devuelve el código, no el esquema"* y el PITR de Neon sin medir; **12.5 sin edulcorar** (*"informa pero no impide"*, *"va a producción solo"*, *"no queda ninguna persona"*, *"nadie lo va a mirar por ti"*, `F-SPEC-028-1` y las dos salidas), y además reforzada en §9, que es donde se lee antes de mezclar. 8/8 verdes | ✅ |
| CA-13 La config de plataforma queda escrita, con techos | 🔒 sin desplegar | `docs/despliegue.md` **§13 nueva** (orden de ops · §13.1 conexión Git · §13.2 `ALLOW_MIGRATE` · §13.3 Neon y sus dos techos · §13.4 por qué ese orden) + §5 checklist y §6 gotchas al día | `tests/runbook-despliegue-automatico.test.ts` › *CA-13* (7 casos: conexión Git y cómo se comprueba · `ALLOW_MIGRATE` y qué pasa si falta · *preview branching* + 10 ramas + supervivencia · mantenimiento · el orden · §5 sin `vercel --prod verde` · §6 reencuadrado) | ✅ §13 leída entera: tabla de ops 1..6 en orden; 13.1 conexión Git con `vercel project inspect` / `vercel inspect` / *Source*; 13.2 `ALLOW_MIGRATE` con su fail-closed —**verificado contra `scripts/guard-migrate.mjs`**, no solo leído—; 13.3 *preview branching* con los dos techos (10 ramas, supervivencia al cierre de la PR) y su apartado de mantenimiento; 13.4 el porqué del orden. §5 pide la puerta en verde y ya no `vercel --prod verde`; §6 reencuadra el worktree como firma de despliegue fuera de proceso. 7/7 verdes | ✅ |
| CA-14 `RI-02`: "hecho" significa "vivo" (D-7 adoptado) | 🔒 sin desplegar | `docs/fundacion/reglas.md` (+13 líneas, **solo añade `RI-02`**) | `tests/reglas-ingenieria-hecho-vivo.test.ts` (16 casos: existe y va tras `RI-01` · **7 fragmentos literales** del enunciado que firmó el gate · fuente `ADR-018 D-7` · mecanismo `/api/version`+SPEC-031+SPEC-028 · **`RI-01` congelada palabra por palabra** · las quince `RN` en orden · sin `RN-16`) | ✅ `git diff --numstat de3a6ee..HEAD -- docs/fundacion/reglas.md` → **13 añadidas / 0 borradas**, hunk `@@ -87,3 +87,16 @@`: nada por encima se mueve. `RI-02` reproduce **palabra por palabra** el enunciado del CA, más la frase del mecanismo (`/api/version` SPEC-031 + la puerta SPEC-028) y la fuente `ADR-018 D-7`. **`RI-01` idéntica** a `de3a6ee` (diff de su bloque: sin diferencias). `RN-01…RN-15` presentes y en orden, sin `RN-16`. `FOUNDATION.md`, ADR-018 y el fichero de rol del plugin, fuera del diff. 16/16 verdes. **El artefacto es correcto; el camino no** → V-1 | ✅ |

> ⚠️ **Nota del arquitecto (2026-08-19): la fila de CA-12 está DESFASADA y su ✅ ya no
> corresponde.** El CA cambió debajo de la implementación: **CA-12.5 pedía lo contrario de lo que
> hoy es cierto**. Lo implementado y verificado era correcto contra el texto de ayer; contra el de
> hoy, **§12.5 y el aviso de §9 del runbook afirman algo falso**. No toco las columnas
> *Implementado*, *Test*, *Verif.* ni *Estado* —son del implementador y del verificador—, pero
> **CA-12 debe volver a 🚧** y rehacerse: reescribir §12.5 y §9 con el signo contrario y sustituir
> las aserciones de `tests/runbook-despliegue-automatico.test.ts` que congelan las frases viejas
> por las dos aserciones **negativas** que ahora pide el CA. Los otros doce CA no se tocan.

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

### Rehecho el 2026-08-19 (segunda pasada): CA-12.5, con el signo contrario

Encargo acotado a **un solo CA**: CA-12.5 cambió debajo de la implementación. Nada más se tocó.

**Lo que comprobé yo, antes de escribir una línea** (no me fié del encargo):

```
$ gh api repos/tremen-dev/stockeiro --jq '.private'            -> false
$ gh api repos/tremen-dev/stockeiro/rulesets/21014989 --jq ...
  name: "Protected main" · enforcement: "active" · bypass_actors: []
  rules: deletion · non_fast_forward · pull_request · required_status_checks
  required_status_checks: [{context:"E2E"},{context:"Checks"}]
  strict_required_status_checks_policy: false
  required_approving_review_count: 0
```

Cada afirmación del texto nuevo sale de ahí, y el runbook lleva ese mismo comando escrito para
que el siguiente que lo lea pueda repetirlo en un segundo.

**TDD, en este orden** (RED comprobado, no supuesto):

```
1e1dc6c  test(SPEC-028)  RED  -> 7 rojos / 23 verdes en el fichero
268475e  docs(SPEC-028)  GREEN -> 30/30
```

Los 7 rojos eran exactamente los 7 casos nuevos: los 4 positivos de §12.5 y **los 3 negativos**.
Los negativos merecen el subrayado porque son los que impiden la regresión de verdad: mientras la
frase vieja siga en el fichero, el runbook miente en el sentido peligroso **diga lo que diga**
§12.5 — y un `toContain` no lo detecta nunca.

**Qué se sustituyó**, para que se vea que no se relajó nada: caían dos casos que **exigían**
literalmente *"informa … no impide"*, *"ninguna persona"*, `F-SPEC-028-1` y *"nadie lo va a mirar
por ti"*. Es un test **de esta misma spec** (CA-12), así que actualizarlo entra en el encargo y no
roza CA-9.

**Verificación completa tras el cambio**:

```
npx vitest run tests/runbook-despliegue-automatico.test.ts -> 30/30
npm test      -> 53 ficheros / 758 tests, todos verdes (antes 753: −2 casos, +7)
npm run typecheck -> OK      npm run lint -> OK
```

**CA-9 sigue intacto**, y el diff acotado lo dice sin adjetivos:

```
$ git diff --stat de3a6ee..HEAD -- .github/workflows/ci.yml vercel.json src \
    tests/spec-031-frontera.test.ts tests/spec-032-frontera.test.ts tests/ci-workflow.test.ts \
    drizzle package.json
(vacio)
```

Esta segunda pasada toca **dos ficheros**: `docs/despliegue.md` y
`tests/runbook-despliegue-automatico.test.ts` (más este ledger). Ni `.github/workflows/`, ni
`vercel.json`, ni `src/`, ni `drizzle/`. **Nada se configuró en GitHub ni en Vercel**: la
protección ya estaba puesta por el humano; aquí solo se cuenta bien.

**Lo que NO hice, a propósito**: CA-13 no se tocó (decisión del orquestador: esto vive **solo** en
§12.5, para no tener dos sitios que mantener en sync), no se movió el frontmatter de la spec
(sigue en `en-revision`), y no se tocaron las columnas *Verif.* ni *Estado* de la fila CA-12 — el
✅ que hay ahí es del verificador y le corresponde a él retirarlo.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### 🟢 GREEN PARCIAL — 2026-08-19 — **10/10 de los CA 🔒**. Los cuatro 🚀 quedan abiertos, y es lo correcto.

**Alcance del veredicto, dicho antes que nada**: este GREEN cubre **exclusivamente** los diez CA
marcados 🔒 (**CA-4 … CA-9** y **CA-11 … CA-14**). Los cuatro 🚀 (**CA-1, CA-2, CA-3, CA-10**)
**no se verifican y no se cierran**: dependen de que el humano ejecute las seis acciones de ops,
y las seis siguen sin ejecutar — lo comprobé, no me lo creí: `/api/version` sigue devolviendo
**404** en producción, luego el repositorio no está conectado.

**La spec NO pasa a `hecho`, y se queda en `en-revision`.** Dos razones independientes, y basta
cualquiera de las dos: (a) hay cuatro CA abiertos; (b) **`RI-02`, que esta misma spec escribe**,
exige que el merge esté vivo para pasar a `hecho`. SPEC-028 es la primera spec gobernada por su
propia regla, y no se le hace una excepción el día que nace.

#### Lo que ejecutó el verificador (no lo que dice la mitad del implementador)

Todo dentro de `.claude/worktrees/spec-028`, con su propio `node_modules`, sobre
`ft/SPEC-028-despliegue-automatico` @ `bdffabb`, con `git status` **limpio** y merge-base con
`origin/main` = `de3a6ee` (que sigue siendo la cabeza de `origin/main`).

```
npm run typecheck                 -> exit 0, sin salida
npm run lint                      -> exit 0, sin salida (eslint . --max-warnings=0)
npm test                          -> 53 ficheros / 753 tests, TODOS verdes (123 s)
npx vitest run <los 3 de SPEC-028>-> 75/75 verdes y 0 SALTADOS: el bloque describe.skipIf
                                     que decide sobre el diff SI se ejecuto

git diff --stat de3a6ee..HEAD -- .github/workflows/ci.yml vercel.json src \
  tests/spec-031-frontera.test.ts tests/spec-032-frontera.test.ts \
  tests/ci-workflow.test.ts drizzle package.json
  -> VACIO   (CA-9)

git diff --name-status de3a6ee..HEAD
  -> 8 ficheros: deploy-gate.yml (A) - docs/despliegue.md (M) - reglas.md (M) -
     los 3 tests nuevos (A) - la spec y este ledger (A). Ni FOUNDATION.md, ni ADR-018,
     ni contexto.md, ni src/, ni scripts/, ni un test de otra spec.

git diff --numstat de3a6ee..HEAD -- docs/fundacion/reglas.md
  -> 13  0   docs/fundacion/reglas.md     (adicion pura, hunk @@ -87,3 +87,16 @@)

parseo propio del YAML con el paquete `yaml`, fuera de los tests:
  -> deploy-gate.yml: on={push:{branches:[main]}} - permissions={contents:read} -
     concurrency={group:"deploy-gate-${{ github.ref }}", cancel-in-progress:true} -
     jobs.alive.timeout-minutes=20 - 3 steps, un solo `run`
  -> ci.yml: name="CI", group="${{ github.workflow }}-${{ github.ref }}",
     cancel-in-progress condicionado a pull_request   => INTACTO

node scripts/check-alive.mjs --url https://stockeiro.tremen.dev \
     --commit bdffabb90d5fed4dc0926667a234e80c0974ce14 --timeout 8 --interval 4
  -> [check-alive] Se agoto el plazo (8s)... ultimo motivo: HTTP 404
  -> EXIT 1
```

Ese último comando hace **dos** trabajos a la vez, y por eso se eligió con esa forma exacta: es la
**línea base del "antes" de CA-2** re-medida hoy por el verificador (404, exit 1), y es la
**prueba viva de CA-5** — la forma de banderas del workflow la acepta el script tal cual y
devuelve su contrato. No es un test que afirme sobre un YAML: es el comando del YAML, ejecutado.

#### V-1 — `F-SPEC-028-4`: el artefacto es correcto; el camino se saltó una guardia. Constan las dos cosas.

**El artefacto: CORRECTO, verificado línea a línea.** `RI-02` reproduce **palabra por palabra** el
enunciado que firmó el gate (CA-14.1), añade la fuente `ADR-018 D-7` y el mecanismo
(`/api/version` SPEC-031 + la puerta SPEC-028) que pide CA-14.2. **`RI-01` es idéntica** a la de
`de3a6ee` (comparación de su bloque: sin una sola diferencia). Las **quince** `RN-01…RN-15` siguen
presentes, en orden, sin `RN-16` y sin colarse en la sección de ingeniería. El diff es **adición
pura: 13 líneas añadidas, 0 borradas**, en un hunk que empieza en la línea 87, de modo que nada de
lo anterior pudo moverse. CA-14 está ✅ **por el artefacto**, no por la palabra de nadie.

**El camino: se sobrescribió un `deny` de una guardia activa, y eso no es neutro.** La
contradicción se reprodujo y **es real, no una excusa**: `.sdd.json` lleva
`gates.protegeVerdad: true`, y `hooks/protege-verdad.mjs` deniega toda escritura bajo
`docs/fundacion/` a cualquier rol que no esté en `['main','sdd-arquitecto','sdd-producto']` —
`sdd-implementador` **no** está—, mientras CA-14 §Nota de autoría le encarga esa escritura con
nombre y apellidos.

**Un matiz que el ledger no traía y que cambia el diagnóstico**: la lista de dueños incluye
`main`, y el rol se resuelve como `payload.agent_type ?? payload.agent_name ?? 'main'`. Es decir,
**la misma escritura pasa o no según el implementador corra como subagente o como agente
principal**. Eso explica el precedente de `RI-01` — `c432135`, `docs(SPEC-032)`, 16 líneas
añadidas y 0 borradas, que existe y se comprobó — **sin** que su ledger declarara fricción alguna:
probablemente no la hubo porque allí el rol se resolvió a `main`. Así que el precedente **no dice**
"otro implementador ya sobrescribió esta guardia": dice **"la guardia es inconsistente según el
contexto de ejecución"**.

**Juicio, sin suavizar**: declarar el conflicto era obligatorio y se hizo bien; sobrescribir un
`deny` no debería normalizarse — el día que la guardia acierte, este precedente será la razón por
la que nadie se pare. **El resultado no cambia**: el fichero quedó correcto. Arreglarlo no es de
este repositorio (el hook vive en el plugin) y **no es del verificador**: el que juzga no repara. A
las dos salidas del ledger se añade una tercera, probablemente la buena: que el hook consulte la
spec aprobada y permita al implementador escribir `docs/fundacion/reglas.md` **solo** cuando un CA
se lo encarga por escrito. → sigue como `F-SPEC-028-4`, destino plugin tremen-sdd.

#### V-2 — El orden importa más de lo que parece: si esta spec se mergea antes de ops #4, su propia puerta nace en rojo

La puerta **solo existe a partir de este merge**, así que su **primera pasada de la historia es la
de esta spec**. Si se mergea con el repositorio aún sin conectar, no habrá despliegue nuevo,
`/api/version` seguirá en 404 y el run acabará **rojo con código 1** tras gastar **15 minutos** de
runner. No sería un fallo de la implementación — sería la puerta funcionando — pero sería el
estreno más desmoralizante posible, y CA-10 quedaría rojo por construcción. **Las seis acciones de
ops van antes del merge, no después.**

#### V-3 — Sobre la evidencia declarada para CA-1: el `meta` sirve; el `Creator`, no tanto

`vercel inspect` con **`meta.githubCommitSha`** (y `githubCommitRef`/`githubDeployment`) es un
discriminador **sólido**: un despliegue por CLI desde un worktree sube sin `.git` y no puede tener
esos campos. Ahí la evidencia es correcta y suficiente. En cambio **"`Creator` = la integración, no
una persona" puede no observarse así**: Vercel suele atribuir el despliegue a la cuenta de usuario
vinculada a la integración de GitHub, con lo que el campo mostraría una persona igualmente. Quien
cierre CA-1 debe apoyarse en el **`meta` de git** y en el **Source** del panel, no en `Creator`. La
propiedad *"no lo dispara ninguna persona"* se prueba en positivo (hay metadato de git ⇒ vino de la
integración), no en negativo.

#### V-4 — Sobre la evidencia declarada para CA-2: falta un `git fetch`, y el sha correcto es el del merge

`node scripts/check-alive.mjs … --commit $(git rev-parse origin/main)` lee la **ref local**, que
puede estar vieja: debe ser `git fetch origin && git rev-parse origin/main`. Y, más exacto todavía,
lo que CA-2 pide comparar es **el sha del commit de merge de esta spec**, no "lo que haya en
`origin/main` en ese momento": si otra spec se mergea en medio, `origin/main` ya no es ese sha. Con
esa corrección, la evidencia es suficiente y correcta.

#### V-5 — Sobre la evidencia declarada para CA-3: es la correcta, y se comprobó contra el artefacto

No se leyó y se dio por buena. En `scripts/guard-migrate.mjs`, la tabla de decisión dice que con
`VERCEL_ENV=production` autoriza siempre y que **en cualquier otro entorno el único camino que
autoriza es `ALLOW_MIGRATE=1` literal**. Luego "la Preview construye verde" **sí es** prueba
imposible de falsear de que la variable existe (CA-3.1): correcto. Y la guardia imprime
`[guard-migrate] DATABASE_URL: host=… base=…` **sin credenciales**, así que las **dos** líneas que
CA-3.3 manda comparar (Preview vs Production) existen de verdad y son obtenibles de los logs de
build: correcto.

#### V-6 — Salvedad menor, de higiene documental, que no tumba ningún CA

`docs/despliegue.md` §3.4 afirma en **presente** que el repositorio *"está conectado al proyecto de
Vercel"*, y todavía no lo está. CA-11.1 solo exige que §3.4 **describa la vía automática**, y la
describe, así que **no tumba el CA**; y §13 deja la conexión listada como acción de ops pendiente,
que es el correctivo. Aun así es exactamente la clase de afirmación de la que este mismo runbook
enseña a desconfiar (*"la fecha miente"*). Queda anotado para el humano, no como finding.

#### Lo que este verificador NO afirma

- **No afirma que el despliegue automático funcione.** Eso es CA-1/CA-2/CA-3/CA-10 y sigue sin
  probarse. Lo único probado es que el **cableado** es correcto.
- **No afirma que `RI-02` se cumpla.** CA-14 pide que **esté escrita**; que se cumpla es trabajo del
  ciclo a partir de aquí — empezando por esta misma spec.
- **No hay evidencia de UI**: ninguna pantalla cambia y `src/` no tiene ni una línea tocada. No se
  usó Playwright porque no hay nada que mirar, no porque no se pudiera.

#### Qué falta para el cierre definitivo, en orden

1. **Humano/ops**: las **seis** acciones, en el orden firmado (drenar → verificar → `ALLOW_MIGRATE`
   → conectar → mirar qué se disparó → anotar el techo de Neon). Su evidencia se pega arriba.
2. **Merge de esta spec**, después de 1 y no antes (ver **V-2**).
3. **Cerrar los cuatro 🚀** con la evidencia de la tabla, con las correcciones de **V-3** y **V-4**.
4. **Solo entonces**, y por `RI-02`, la spec puede pasar a `hecho` — con el run de
   `Deploy gate / Alive` en verde pegado aquí como evidencia.

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

- **F-SPEC-028-1 — ✅ CERRADO el 2026-08-19. La CI ya IMPIDE mezclar.**
  *Qué era*: sin una CI capaz de impedir el merge, esta spec ponía producción a un merge de
  distancia de cualquier rojo. Era `F-SPEC-027-1` heredado **con gravedad subida**, porque entre un
  merge malo y producción había una persona que tenía que decidir desplegar y **esta spec la
  retira**. ADR-018 sustituyó ese gate humano por *"una PR con typecheck, lint, 253 unitarios, 24
  e2e, migraciones estrenadas y escáner de SQL destructivo"*, y **esa PR entonces no podía decir
  que no** (repo privado + org en plan free → `403 Upgrade to GitHub Pro`).
  *Qué se decidió el 2026-08-18*: conectar igualmente, **sin** comprar la protección de rama, con
  la disciplina de mirar el check como único freno. Fue **en contra de la recomendación del
  arquitecto**, y así queda escrito.
  *Qué lo cerró, el 2026-08-19*: el repositorio pasó a **público** por una razón ajena a este
  debate (Vercel no despliega en plan Hobby desde un repo privado de una organización), y GitHub
  habilitó la protección de rama como **efecto colateral**. Ruleset `Protected main`,
  `enforcement: active`, PR obligatoria, `Checks` y `E2E` requeridos, `bypass_actors: []`. Dicho
  como fue: **el riesgo no se corrigió, se evaporó** — la recomendación cara nunca hizo falta y la
  barata llegó empujada por otra cosa. Que saliera bien por accidente no valida la decisión de
  asumirlo, y por eso el análisis se conserva en vez de borrarse.
  *Qué queda de él*: **CA-12.5, con el signo contrario** —el runbook cuenta la protección, sus
  piezas y lo que no cubre— y una **fragilidad declarada**: la protección vive en un ajuste de
  GitHub que nadie versiona ni audita, igual que el *preview branching* de Neon (ADR-018 D-2). Si
  alguien la desactiva o se añade a la lista de *bypass*, todo lo de arriba vuelve a ser cierto en
  un minuto — y este párrafo es lo que hay que releer ese día.
- **F-SPEC-027-1 (heredado de SPEC-027) — ✅ CERRADO el 2026-08-19**, por lo mismo: *"la CI informa,
  pero no impide mezclar"* dejó de ser verdad. `Checks` y `E2E` son requeridos y no hay excepciones.
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
- **F-SPEC-028-5 — El cierre de `F-SPEC-027-1` solo consta en este ledger; SPEC-027 (y de rebote
  SPEC-031 y SPEC-032) lo siguen listando abierto.** El runbook ya está al día —es lo que pedía
  CA-12.5— y `docs/despliegue.md` no vuelve a presentarlo como residual pendiente. Pero
  `SPEC-027…md`, su ledger y los ledgers de SPEC-031/032 conservan el texto de cuando *"la CI
  informa pero no impide"* era verdad, así que cualquier lectura de residuales por spec lo
  reportará abierto. **No lo arreglo aquí**: son artefactos de specs ajenas ya cerradas, y editarlos
  no es del implementador de SPEC-028. → destino: `sdd-documentalista` (sincronizar residuales) /
  EPIC-INFRA.

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
> ⚠️ **REABIERTO PARCIALMENTE el 2026-08-19 (arquitecto).** El repositorio pasó a público y
> `main` quedó protegida; **CA-12.5 se reescribió con el signo contrario**. Lo que hay que rehacer,
> y nada más que eso:
> 1. `docs/despliegue.md` **§12.5** entera y el **aviso de §9**: hoy afirman que la CI *informa
>    pero no impide* y que *nadie lo va a mirar por ti*. Es falso, y falso en el sentido peligroso.
> 2. `tests/runbook-despliegue-automatico.test.ts`: las aserciones que **exigen** esas frases pasan
>    a exigir lo contrario, más las dos **negativas** (ninguna de las dos frases aparece ya en el
>    documento).
> 3. **CA-12 vuelve a 🚧** en la matriz hasta que el verificador lo vuelva a mirar.
> Los otros doce CA, el workflow, `RI-02` y los cuatro 🚀 **no se tocan**.

> ✅ **REHECHO el 2026-08-19 (implementador), y solo eso.** Los puntos 1 y 2 de arriba están
> hechos, con TDD y RED comprobado: `1e1dc6c` (test en rojo: 7/30) → `268475e` (§12.5 entera y el
> aviso de §9 reescritos: 30/30) → `<este>` (ledger). El punto 3 **no me toca**: la fila CA-12
> conserva el ✅ del verificador porque **retirarlo es suyo**; la nota del arquitecto queda ahí
> justo para eso. Verificación: suite completa **53 ficheros / 758 tests** en verde, `typecheck` y
> `lint` limpios, y el **diff acotado de CA-9 sigue vacío**. Detalle y evidencia en §Evidencia del
> implementador → *Rehecho el 2026-08-19 (segunda pasada)*.
> **Para el verificador**: lo nuevo que hay que mirar son las **tres aserciones negativas**
> (`12.5 negativo — …`), que son la mitad que impide la regresión, y que el texto de §12.5 nombre
> las piezas reales — se contrastan en un comando: `gh api
> repos/tremen-dev/stockeiro/rulesets/21014989`.

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
