---
id: SPEC-042
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-042 La limpieza de las ramas de preview de Neon deja de ser un recordatorio

## Resumen
- Fase: **en-revision (ronda 2)** — bloque 🔒 (CA-1 a CA-7) implementado y verde, con los tres findings del RED cerrados: el nombre de rama se filtra antes de llegar a la shell de la composite action (F-1), la frase falsa corregida en sus tres artefactos (F-2) y CA-9 desatado de CA-8 (F-3). Bloque 🚀: CA-9 se puede medir **ya**, con un comando y sin cerrar nada; CA-8 y CA-10 siguen esperando el primer cierre real de PR.
<!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-042-limpieza-automatica-de-ramas-de-preview-en-neon`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
<!-- 🔒 = verificable en el repositorio con un test. 🚀 = solo comprobable al cerrar una PR de verdad; su evidencia va abajo, no a un test. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| 🔒 CA-1 el workflow existe, aparte, y no toca a los otros dos | `.github/workflows/neon-preview-cleanup.yml` (nuevo) | `tests/neon-preview-cleanup-workflow.test.ts` · CA-1 1.1–1.4 (el 1.4 compara `ci.yml` y `deploy-gate.yml` **byte a byte** con `origin/main`) | Parseo el YAML yo mismo: `.github/workflows/` tiene exactamente los tres ficheros. `git diff --name-status origin/main...HEAD` **no lista** `ci.yml` ni `deploy-gate.yml` — cero bytes de cambio, comprobado fuera del test. El test 1.4 corrió de verdad (no *skipped*): 35/35 casos. | ✅ |
| 🔒 CA-2 un solo disparador `pull_request: [closed]`, sin filtro por `merged`, sin `pull_request_target` | `.github/workflows/neon-preview-cleanup.yml`, clave `on` | `tests/neon-preview-cleanup-workflow.test.ts` · CA-2 2.1–2.5 (2.4 busca `pull_request_target` también en los comentarios; 2.5, `merged` en cualquier `if` y en el texto crudo) | `node -e` sobre el YAML: `on = {"pull_request":{"types":["closed"]}}`, una sola clave. `grep -i pull_request_target` sobre el fichero entero: cero. Ningún `if` menciona `merged`. | ✅ |
| 🔒 CA-3 `neondatabase/delete-branch-action@v3` con exactamente tres entradas | `.github/workflows/neon-preview-cleanup.yml`, único step | `tests/neon-preview-cleanup-workflow.test.ts` · CA-3 3.1–3.4 | `with` = `['project_id','branch','api_key']`, exactamente tres. Contra la fuente (`gh api repos/neondatabase/delete-branch-action`): **no archivada, no deshabilitada**, `v3` → `4468d825…`, último release `v3.2.1`. Su `action.yaml` declara **cinco** entradas: las tres usadas + `branch_id` (con `deprecationMessage`) + `api_host` (con default `https://console.neon.tech/api/v2`). Omitir ambas es **correcto**, no descuido. El snippet coincide literalmente con el que Neon recomienda. | ✅ |
| 🔒 CA-4 nada fuera del prefijo literal `preview/`; `main` no se nombra; sin `run:` | `.github/workflows/neon-preview-cleanup.yml`: `with.branch`, forma del fichero **y el filtro de caracteres del `if` del job** (ronda 2, F-1) — `!contains(github.head_ref, '$')`, `` '`' `` y `'"'`, sumados a la condición de fork, que no se toca. El comentario del step **ya no afirma** que sin `run:` el nombre de rama no llegue a una shell: dice que la acción es composite, que su paso final es `shell: bash` y que quien impide la inyección es el filtro | `tests/neon-preview-cleanup-workflow.test.ts` · CA-4 4.1–4.4 (4.2 prohíbe `main`/`production` en el **fichero entero**, comentarios incluidos) **+ 4.5, nuevo**: (a) le pregunta a `git check-ref-format` cuál de los cuatro especiales de bash dentro de comillas dobles (`$`, backtick, `\`, `"`) acepta en una ref y exige que el filtro sea exactamente los tres que pasan — la derivación se ejecuta, no se recuerda; (b) los tres `!contains` van sobre la **misma** expresión que alimenta `with.branch`; (c) la condición de fork **sigue** ahí (tres `&&`, ni uno más); (d) el step no tiene un `if` propio que se salte al del job | 4.1, 4.2, 4.3 y 4.4 se cumplen **al pie de la letra** y lo comprobé fuera del test. **PERO la propiedad que 4.3 afirma comprar es falsa**: `neondatabase/delete-branch-action@v3` es una **composite action** y su último paso es `run: bash` con `neonctl branches delete "${{ inputs.branch }}"`. `github.head_ref` **sí llega a un intérprete de comandos**, y git acepta `$(…)` y backticks en un nombre de rama (verificado). Simulado el `run:` literal de la acción: **ejecución arbitraria de comandos**, dos veces, con `NEON_API_KEY` en el entorno. El prefijo `preview/` **no** acota el peor caso. Ver F-1 del veredicto. | ⚠️ |
| 🔒 CA-5 higiene: sin forks, sin permisos de escritura, con plazo y concurrencia, sin `continue-on-error` | `.github/workflows/neon-preview-cleanup.yml`: `if` de fork, `permissions: {}`, `timeout-minutes: 10`, grupo propio con `cancel-in-progress: false` | `tests/neon-preview-cleanup-workflow.test.ts` · CA-5 5.1–5.5 | 5.1 `if: github.event.pull_request.head.repo.full_name == github.repository` — con `head.repo` nulo (fork borrado) la comparación es falsa: *fail-closed*, correcto. 5.2 `permissions: {}`. 5.3 `timeout-minutes: 10`. 5.4 grupo `neon-preview-cleanup-…`, distinto de `${{ github.workflow }}-${{ github.ref }}` (ci) y `deploy-gate-${{ github.ref }}` (puerta), `cancel-in-progress: false`. 5.5 sin `continue-on-error`, sin encadenado que se trague el codigo de salida, sin `always()`. | ✅ |
| 🔒 CA-6 frontera: `ci.yml` y `deploy-gate.yml` siguen sin secretos; este no gobierna el merge | ningún cambio en `ci.yml` ni `deploy-gate.yml`; punto 3 escrito en `docs/despliegue.md` §9 | `tests/neon-preview-cleanup-workflow.test.ts` · CA-6 6.1–6.2 + `tests/spec-031-frontera.test.ts` y `tests/spec-032-frontera.test.ts` verdes **sin editarlos**; el punto 3 lo congela `tests/runbook-limpieza-preview.test.ts` · CA-7.2 | 6.1 `ci.yml` y `deploy-gate.yml` **byte a byte idénticos** a `origin/main` (mi propio `git diff`), y `tests/spec-031-frontera.test.ts` (11) y `tests/spec-032-frontera.test.ts` (19) verdes **sin una línea editada**. 6.2 `git grep -l 'secrets\.'` → 14 ficheros; fuera de `docs/` y `tests/`, **solo** el limpiador. 6.3 comprobado **vivo**, no solo documentalmente: `gh api repos/tremen-dev/stockeiro/rulesets/21014989` → contextos requeridos exactamente `E2E` y `Checks`, bypass vacío. | ✅ |
| 🔒 CA-7 el runbook cuenta la trampa, la solución y su contrapartida (§6, §9, §13, §13.3) | `docs/despliegue.md`: §6 (gotcha nuevo), §9 (tabla de los tres workflows), §13 (filas de ops 7, 8 y 9), §13.3 **reescrita**. Ronda 2 (F-2): §13.3 ya **no** dice *"con tres entradas y ni una línea de shell"* ni *"eso es lo que acota el peor caso"*. Dice que la acción es composite y **sí** ejecuta bash por dentro, que sin filtro el peor caso era ejecución de comandos con la clave, que lo que acota el peor caso es el **filtro de caracteres** más el prefijo literal, y **qué cuesta el filtro** (`F-SPEC-042-7`) | `tests/runbook-limpieza-preview.test.ts` · CA-7.1–7.6, troceando el documento por secciones | Los seis subpuntos están y **dicen la verdad**: las dos citas de Neon de §6 y §13.3 las contrasté contra las fuentes y son **literales**; la aritmética (10 − `main` − `preview` = ~8 merges) cuadra; §9 dejó de afirmar que el repositorio no tiene secretos y **sigue** afirmándolo de la CI de las PR, lo cual es cierto (`ci.yml` no contiene `secrets.`); la casilla de GitHub queda bien separada de Neon. **Salvedad**: §13.3 repite la frase falsa de F-1 (*«eso es lo que acota el peor caso… a “borré una preview que no tocaba”»* y *«ni una línea de shell»*). | ⚠️ |
| 🚀 CA-8 al cerrar la PR, la rama desaparece de Neon y el recuento baja en una | `.github/workflows/neon-preview-cleanup.yml` | **no testeable desde el repo** — evidencia abajo. Bloqueado por F-SPEC-042-1 y F-SPEC-042-2 | **No cerrado.** F-SPEC-042-1 y F-SPEC-042-2 **ya no bloquean**: `gh variable list` → `NEON_PROJECT_ID=orange-lab-24079923`; `gh secret list` → `NEON_API_KEY`. El disparador `pull_request` usa el workflow **de la rama de la PR**, así que la PR de esta spec puede cerrar CA-8 sin haber mergeado antes el fichero. Falta el cierre real. | 🚧 |
| 🚀 CA-9 comportamiento ante una rama inexistente, medido y escrito | hueco escrito en `docs/despliegue.md` §13.3 (*"lo que aún no se sabe"*), a la espera del dato, **más el comando que lo responde y qué hacer con cada resultado** (ronda 2, F-3) | **no testeable desde el repo, pero YA NO DEPENDE DE CA-8.** No necesita una PR cerrada ni un *Re-run*: necesita la credencial, que existe desde el 2026-08-20. Lo responde, sin tocar nada, `neonctl branches delete preview/no-existe-jamas --project-id orange-lab-24079923` — **corrible antes de mezclar**. Verde ⇒ la acción se traga la rama inexistente, no habrá falsos rojos, CA-9 cerrado. Rojo (lo esperable: `neonctl` resuelve el nombre a un id) ⇒ este limpiador dará rojo en **toda PR cerrada sin preview**, hay que saberlo **antes** del merge y se abre follow-up en el acto. En ninguno de los dos casos se pone `continue-on-error` (CA-5.5, congelado en `tests/neon-preview-cleanup-workflow.test.ts` · 5.5). El implementador **no puede ejecutarlo**: la clave no está en el entorno local y no se pide | **No cerrado.** Confirmo que no es determinable desde el repositorio: el paquete `neonctl@2` de npm es un *stub* que descarga el binario en `postinstall`, así que no hay código que leer. **Pero no hace falta esperar a CA-8**: con la clave ya creada, `neonctl branches delete preview/no-existe --project-id orange-lab-24079923` responde la pregunta en diez segundos y sin tocar nada. Ver J-2. | 🚧 |
| 🚀 CA-10 nada que no fuera una preview se tocó (`main` sigue ahí) | prefijo `preview/` literal en `.github/workflows/neon-preview-cleanup.yml` | **no testeable desde el repo** — comparación de las dos listas del panel de Neon | **No cerrado.** Depende de CA-8. La evidencia prevista (dos listas de nombres, antes y después) es la correcta. | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### 🔴 RED — 2026-08-20, sdd-verificador

**Recuento, separando los dos bloques:**

- 🔒 **Bloque A (CA-1 … CA-7): 5 ✅ · 2 ⚠️ · 0 ❌.** Ningún CA falla en su letra. Los dos ⚠️ son
  el mismo defecto, encontrado atacando CA-4, y por eso el veredicto es RED: **una salvedad en
  el CA de seguridad no es un ✅**, y ésta nadie la ha aceptado todavía.
- 🚀 **Bloque B (CA-8, CA-9, CA-10): 0 ✅ · 3 🚧.** Correctamente clasificados. Su evidencia
  prevista es la correcta (ver J-1). CA-8 **ya está desbloqueado**: la variable y el secreto
  existen en el repositorio a día de hoy.

**Los seis gates, en verde, corridos por mí sobre `0f00c31`:** `typecheck` 0 · `lint` 0 ·
`test` **1180/1180** en 84 ficheros · `build` 0 · `test:e2e` **195/195** · `db:scan` 0
(11 migraciones, 2 destructivas con *waiver* escrito). Sin choque con la sesión paralela.

---

#### F-1 (BLOQUEANTE) — la acción **sí** mete `github.head_ref` en una shell, y el prefijo `preview/` no acota el peor caso

CA-4.3 exige *«no hay ni un `run:` en todo el fichero»* **y de ahí concluye** *«así que no hay
superficie donde el secreto pueda acabar en un log ni donde `github.head_ref` —dato controlado
por quien abre la PR— llegue a una shell»*. **La primera mitad se cumple; la segunda es falsa.**

`neondatabase/delete-branch-action@v3` (su `action.yaml` en el tag `v3`, hoy `4468d825…`) es una
**composite action**:

```yaml
runs:
  using: "composite"
  steps:
    - run: npm i -g neonctl@v2
      shell: bash
    - name: Delete branch
      shell: bash
      env:
        NEON_API_KEY: ${{ inputs.api_key }}
      run: |
        if [ -z "${{ inputs.branch }}" ]; then
          ...
        else
          neonctl branches delete "${{ inputs.branch }}" --project-id ${{ inputs.project_id }}
        fi
```

`${{ inputs.branch }}` se sustituye **textualmente** dentro de un script bash, con el secreto en
el entorno de ese mismo paso. No hay `run:` en nuestro fichero, pero lo hay en el de la acción,
y es el que recibe el dato.

**Lo que verifiqué, reproducible:**

1. Git **acepta** `$(…)`, backticks, `;` y `&&` en un nombre de rama (probado con `git branch` y
   con `git check-ref-format`). Los `..`, los espacios y las barras finales sí los rechaza, así
   que `../main` **no** es un vector; no hace falta.
2. Dentro de comillas dobles, bash expande `$(…)` y las backticks — **no hace falta romper la
   comilla**. Simulando el cuerpo literal del `run:` de la acción con
   `branch = preview/ft/SPEC-999-x$(…)`, el comando inyectado se ejecuta **dos veces** (una en el
   `[ -z … ]` y otra en el `delete`) y ve `$NEON_API_KEY`.

**Consecuencia:** el peor caso alcanzable no es *«borré una preview que no tocaba»*, sino
*ejecución de comandos con la única credencial de borrado del proyecto* — incluido
`neonctl branches delete <la rama de la cartera real> --project-id orange-lab-24079923`. Es
exactamente el daño que CA-4 existe para acotar.

**Atenuante, que hay que decir igual de alto:** el `if` de CA-5.1 excluye las PRs de fork, así
que disparar esto exige **permiso de escritura en el repositorio**. No es un ataque anónimo desde
Internet. Pero el nombre de rama es un dato que en este proyecto generan **agentes** a partir de
títulos de spec, y la defensa de CA-4 está declarada *load-bearing*.

**Arreglo mínimo, y cabe entero dentro de los CA vigentes** (no añade `run:`, no añade
disparador, no añade clave a `with`, no nombra ninguna rama fija, y el `if` sigue conteniendo la
condición de fork que CA-5.1 pide). Dentro de comillas dobles bash solo reacciona a `$`,
backtick, barra invertida y `"`; la barra invertida ya la prohíbe el formato de refs de git, así
que el conjunto completo son **tres caracteres**:

```yaml
    if: >-
      github.event.pull_request.head.repo.full_name == github.repository
      && !contains(github.head_ref, '$')
      && !contains(github.head_ref, '`')
      && !contains(github.head_ref, '"')
```

Con su caso de test, y con el porqué —que la acción es composite— en el comentario.

#### F-2 (BLOQUEANTE, mismo origen) — tres artefactos afirman por escrito una propiedad que el repositorio no tiene

La frase de F-1 no está solo en la spec: se ha copiado a tres sitios que el proyecto trata como
verdad. Con `protegeVerdad` activo en `.sdd.json`, esto se corrige junto con F-1.

| Dónde | Qué dice, y por qué es falso |
|---|---|
| `.github/workflows/neon-preview-cleanup.yml`, comentario del step | *«sin intérprete de comandos no hay sitio donde el secreto acabe en un log, ni donde `github.head_ref` llegue a una shell»* — lo hay, dentro de la acción |
| `tests/neon-preview-cleanup-workflow.test.ts`, comentario de 4.3 | *«Sin shell no hay sitio donde… `github.head_ref` … llegue a un intérprete de comandos»* — ídem |
| `docs/despliegue.md` §13.3 | *«…con tres entradas y ni una línea de shell»* y *«Eso es lo que acota el peor caso alcanzable desde el fichero a “borré una preview que no tocaba”»* — la acción instala `neonctl` y lo invoca desde bash; el prefijo no acota ese peor caso |

Nota: la cabecera de `tests/neon-preview-cleanup-workflow.test.ts` **cita el `action.yaml`** para
enumerar sus cinco entradas. El fichero estuvo delante; lo que se leyó fueron los `inputs` y no
el `runs:`.

#### O-1 (observación, no bloqueante) — `@v3` es un tag móvil

CA-3.1 fija `@v3` a propósito y el implementador cumplió, así que **no es un finding contra la
entrega**. Pero conviene que conste: `v3` es un tag mutable de un tercero, y hoy resuelve a una
acción que ejecuta bash con el único secreto del repositorio en el entorno y hace
`npm i -g neonctl@v2` en tiempo de ejecución. El SHA de hoy es
`4468d825d5a88ef4012f1705a82f02ec3072f776`. Clavarlo exigiría enmendar CA-3.1 → candidato a
follow-up, no a este ciclo.

---

### Juicio sobre los tres CA 🚀

**J-1 — CA-8 y CA-10 están bien planteados y su evidencia es la correcta.** No se puede cerrar
una PR de verdad desde Vitest, y la evidencia nombrada —enlace a la ejecución verde en Actions y
las **dos listas de nombres** de ramas de Neon, antes y después— es exactamente lo que hace falta:
pedir los nombres y no solo el recuento es lo que convierte CA-10 en comprobable en vez de en un
acto de fe. **No es una excusa**: la única alternativa habría sido un `workflow_dispatch` de
prueba, y CA-2 lo prohíbe por seguridad con motivo escrito. Bien cambiado.
Confirmo además dos cosas que hacen CA-8 alcanzable **en esta misma PR**: (a) `gh variable list`
y `gh secret list` muestran `NEON_PROJECT_ID` (`orange-lab-24079923`) y `NEON_API_KEY`; (b) en un
evento `pull_request`, GitHub usa el workflow **de la rama de la PR**, así que no hace falta que
el fichero esté antes en `main`.

**J-2 — CA-9 está bien planteado, pero su método es más caro de lo necesario y se puede medir
HOY.** La premisa es cierta y la comprobé: el README no lo documenta, y el paquete `neonctl@2`
de npm es un *stub* que se baja el binario en `postinstall`, así que tampoco hay código que leer
desde el escritorio. Hasta ahí, correcto. Lo que sobra es **atarlo a CA-8**: la pregunta *«¿qué
hace ante una rama que ya no existe?»* no necesita una PR cerrada ni un *Re-run*, necesita **la
credencial**, que ya existe. Un solo comando la responde, sin tocar nada:

```
neonctl branches delete preview/no-existe-jamas --project-id orange-lab-24079923
```

Recomendación: medirlo así **antes** de mergear. Si sale rojo —que es lo que espero, porque
`neonctl` tiene que resolver el nombre a un id— se sabrá **antes** del merge que este limpiador
dará falsos rojos en toda PR que se cierre sin haber tenido preview, y la decisión sobre la red
de seguridad se tomará con el dato encima de la mesa en vez de después del primer falso rojo.
**No cambia su marca 🚀** (sigue necesitando algo que no vive en el repositorio), pero **deja de
estar bloqueado contra CA-8**.

### Juicio sobre la lectura de CA-6.2 («único fichero **ejecutable**»)

**Legítima, y además la única lectura coherente.** CA-6.2 dice *«único fichero del repositorio
con `secrets.`»*, y al pie de la letra es **insatisfacible por construcción**: la propia
`SPEC-042-….md` contiene esa cadena en su §Decisión de diseño. Un test que aplicara la letra
habría nacido rojo. Comprobé el universo real: `git grep -l` da **14** ficheros; los otros 13 son
11 specs/ledgers y `tests/ci-workflow.test.ts`, `tests/deploy-gate-workflow.test.ts`,
`tests/spec-032-frontera.test.ts` y el test nuevo — todos **hablan** del secreto para prohibirlo o
documentarlo. El acotamiento **no afloja nada**: la exclusión es solo `docs/` y `tests/`, así que
`src/`, `scripts/`, `.github/`, `vercel.json` y la raíz siguen cubiertos, y el hueco teórico —un
fichero de `tests/` que *usara* un secreto de verdad— lo cierra CA-6.1, que congela que `ci.yml`
no lleva ninguno. Motivo escrito en el propio test. **No es un aflojamiento; es precisión.**

### Qué falta para el GREEN del bloque 🔒

Cerrar F-1 y F-2. Es un `if` con tres `!contains`, su caso de test, y corregir la misma frase en
tres sitios. Nada más del bloque A está pendiente.

### Lo que NO cambié

No edité código, ni la spec, ni `docs/despliegue.md`, ni ningún test. Solo esta mitad del ledger.
La spec queda en **`en-revision`** por indicación explícita del encargo (el rol por defecto la
pasaría a `en-progreso`).


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
- **F-SPEC-042-7 — Las ramas con `$`, backtick o `"` en el nombre no se limpian.** *(Nuevo en la
  ronda 2. Es el precio del arreglo de F-1, y no se disimula: cerrar un agujero abrió un hueco.)*
  El job se salta la limpieza cuando `github.head_ref` contiene uno de esos tres caracteres, así
  que **esa PR no dispara nada y su rama de Neon queda huérfana** hasta que alguien la borre a
  mano. Es *fail-closed* deliberado —no barrer una rama cuesta uno de los diez huecos del techo;
  ejecutar código con la única clave de borrado del proyecto cuesta el proyecto—, pero tiene tres
  consecuencias que hay que tener escritas:
  1. **Es silencioso.** Un job saltado por su `if` no pinta rojo: no aparece en Actions. Si una
     PR cerrada no dejó rastro, el primer sitio donde mirar es el nombre de su rama.
  2. **Puede pasar sin malicia.** En este proyecto los nombres de rama los generan **agentes** a
     partir de títulos de spec: un `$` puede llegar ahí sin que nadie ataque nada.
  3. **La salida limpia no cabía en los CA vigentes.** Lo correcto de verdad es **sanear** el
     nombre en vez de descartarlo, o dejar de depender de una acción que interpola en bash
     (llamar a la API de Neon directamente, o clavar la acción a un SHA auditado — ver O-1 del
     verificador). Las dos vías exigen enmendar CA-3 y/o CA-4, así que no se hacen aquí.
  → EPIC-INFRA.

Heredados:

- **F-SPEC-028-2 — se cierra su mitad 2** (*las ramas de preview sobreviven al cierre de la
  PR*) cuando CA-8 quede verde. Su **mitad 1** —el techo de 10 ramas del plan Free— **queda
  abierta a propósito**: esta spec quita la acumulación, no el techo (R-6). → EPIC-INFRA.
- **F-SPEC-032-1** — el permiso `ALLOW_MIGRATE` en Preview asume que el *preview branching*
  sigue encendido. Sin cambios: esta spec no lo toca ni lo empeora.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
**Ronda 2 (2026-08-20), tras el RED del verificador.** Se cerraron los tres findings; los cinco
CA que estaban ✅ (CA-1, 2, 3, 5, 6) no se tocaron, y tampoco `ci.yml`, `deploy-gate.yml`, `src/`,
`package.json`, `next.config.mjs`, `vercel.json` ni ningún test de otra spec.

- **F-1 (CA-4)** — El defecto se reprodujo **antes** de aceptar el arreglo, no después:
  (a) descargado el `action.yaml` del tag `v3`, que `git ls-remote` resuelve hoy a
  `4468d825…`, y ahí está el `runs: composite` con `shell: bash`, la clave de la API en el `env`
  del paso y `"${{ inputs.branch }}"` interpolado en el script **dos veces**;
  (b) enumerados los 94 ASCII imprimibles contra `git check-ref-format`: **acepta** `$`,
  backtick, `"`, `;`, `&&`, `|`, `<`, `>`, `!`, `#`, `'`, `{}`, y **rechaza** `\ * : ? [ ^ ~`,
  el espacio, el tabulador, el CR y el LF;
  (c) ejecutado el cuerpo literal del `run:` con un `neonctl` de mentira: `$(…)` y las backticks
  se ejecutan **dos veces** dentro de las comillas dobles y ven `$NEON_API_KEY`; `"` rompe la
  comilla y encadena; y `;`, `&&`, `|`, `!`, `'`, `>`, `{}`, `#` **quedan literales**, así que
  filtrarlos sería filtrar de más. La barra invertida sola es inerte **y** git la rechaza.
  De ahí salen **tres** caracteres y no más ni menos, que es el arreglo que propuso el
  verificador — adoptado **después** de comprobarlo, no copiado.
- **F-2 (CA-7)** — la frase falsa corregida en los **tres** artefactos: el comentario del step del
  workflow, el comentario de 4.3 del test y `docs/despliegue.md` §13.3.
- **F-3 (CA-9)** — desatado de CA-8 en la fila de la matriz y en §13.3, con el comando exacto y
  qué hacer con cada resultado. **No se ejecutó**: la clave no está en el entorno local y no se
  pide. Es del humano, y **antes** de mezclar.

**Ronda 1 (2026-08-20)**, en la misma rama, sobre `origin/main` (`acf90a2`):

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

0. ~~Crear la variable `NEON_PROJECT_ID` y el secreto `NEON_API_KEY`~~ — **hecho el 2026-08-20**
   (`gh variable list` → `orange-lab-24079923`; `gh secret list` → `NEON_API_KEY`). Falta
   **anotar aquí qué alcance tiene realmente la clave**: si Neon permitió acotarla a este
   proyecto o quedó de cuenta. Es el punto 2 del gate y el residual de **R-1**.
1. **CA-9, y va primero porque ya no depende de nadie más** (F-3):
   `neonctl branches delete preview/no-existe-jamas --project-id orange-lab-24079923`.
   Anotar el veredicto —**verde o rojo, y con qué mensaje**— en la fila de CA-9 **y en §13.3**,
   donde ya está el hueco escrito. Si sale **rojo**, abrir follow-up en el acto: un limpiador que
   da falsos rojos de rutina se acaba ignorando. Sin `continue-on-error` en ningún caso (CA-5.5).
2. Mezclar la PR de esta spec y **cerrarla**. El workflow corre al cerrar, mezclada o no —y la
   rama de esta PR no lleva ninguno de los tres caracteres de `F-SPEC-042-7`, así que se
   ejecutará.
3. Recoger la evidencia de CA-8 y CA-10 **antes y después**: la lista de ramas de Neon con sus
   **nombres**, no solo el recuento, y el enlace a la ejecución en Actions.

**Lo que NO se ha hecho, a propósito**: no se ha puesto `continue-on-error` preventivo (CA-5.5 y
CA-9), no se ha ejecutado el comando de CA-9 (la clave no está en el entorno local y no se pide),
no se ha tocado `src/`, ni `package.json`, ni `next.config.mjs`, ni `vercel.json`, ni `ci.yml`,
ni `deploy-gate.yml`, ni ningún test de otra spec, ni se ha hecho push ni PR. Tampoco se ha
saneado el nombre de rama en vez de descartarlo ni se ha clavado la acción a un SHA: las dos
cosas exigen enmendar CA-3 o CA-4 y están escritas como `F-SPEC-042-7` y O-1.
