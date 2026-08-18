---
id: SPEC-027
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-027 CI en cada PR: la suite deja de depender de que alguien se acuerde

## Resumen
- Fase: en-revision — implementación cerrada **y verificada en CI real**. La PR se verificó a
  sí misma: 6 ejecuciones, 3 de ellas en rojo a propósito y revertidas.
- Rama: `ft/SPEC-027-ci-en-cada-pr` (worktree `.claude/worktrees/followups-024-025`)
- PR: **<https://github.com/tremen-dev/stockeiro/pull/31>**
- **Enmienda del 2026-08-18** (`9ae29ea`, arquitecto): CA-11 pasa a **sonda sembrada**.
  Reimplementado en `231b2c6` con sus dos roturas demostradas — §CA-11 reimplementado.
- Commits permanentes: `c5ba11f` (RED del test estático) · `dbcb7dc` (workflow + `.nvmrc` +
  scripts) · `6c2a625` (canario y retirada del código muerto) · `674de6f` (runbook) ·
  `015536b` (ledger) · `c62a2b3` (arreglo del cuelgue de `--with-deps`) · `231b2c6` (canario sembrado)
- Commits temporales en la rama, **los tres revertidos**: `4197e23`→`9094a2c` (CA-3) ·
  `8f4185f`→(revert) (CA-10) · `e8036d4`→`e2f7b2a` (CA-9). `git diff c62a2b3 e2f7b2a` = **vacío**.
- Las **dos roturas de CA-11** no se commitearon: son de una línea y se ejecutaron en local,
  porque lo que demuestran ocurre en `npx vitest run` y no necesita un runner. Ambas revertidas;
  el fichero no conserva ni un resto (`grep` de las marcas temporales = 0).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `.github/workflows/ci.yml` (`on: pull_request/push`, ambos `branches: [main]`) | `tests/ci-workflow.test.ts` › *CA-1* (3 casos) **+ evidencia viva**: 6 ejecuciones disparadas por `pull_request` en la PR #31, la primera de ellas sobre el commit que introduce el propio workflow ([run 32086893473](https://github.com/tremen-dev/stockeiro/actions/runs/32086893473), success) | | ❌ |
| CA-2 | `.github/workflows/ci.yml` (steps `Typecheck`, `Lint`, `Unit tests`, `Build`, `End-to-end tests`) | `tests/ci-workflow.test.ts` › *CA-2* (2 casos) **+ evidencia viva**: en [run 32087238733](https://github.com/tremen-dev/stockeiro/actions/runs/32087238733) el rojo se lee en el nombre del step (`Typecheck: failure`, `Lint: failure`) sin abrir el log | | ❌ |
| CA-3 | `.github/workflows/ci.yml` (`if: ${{ !cancelled() }}` en los tres gates de `Checks`; ausente en `End-to-end tests`) | `tests/ci-workflow.test.ts` › *CA-3* (2 casos) **+ prueba en rojo**: [run 32087238733](https://github.com/tremen-dev/stockeiro/actions/runs/32087238733) → `Typecheck: failure` · `Lint: failure` · **`Unit tests: success` (se ejecutó igual)** · job en rojo. Y la contrapartida en el mismo run: `Build: failure` → **`End-to-end tests: skipped`** (encadena a propósito). Commit `4197e23`, revertido en `9094a2c` | | ❌ |
| CA-4 | `.github/workflows/ci.yml` (jobs `checks`/`Checks` y `e2e`/`E2E`, sin `needs`) | `tests/ci-workflow.test.ts` › *CA-4* (3 casos) **+ evidencia viva**: los dos jobs arrancan en el **mismo segundo** (`01:28:48Z` los dos, [run 32088353875](https://github.com/tremen-dev/stockeiro/actions/runs/32088353875)) y aparecen como dos checks separados en la PR; en [run 32087612615](https://github.com/tremen-dev/stockeiro/actions/runs/32087612615) uno falla y el otro pasa (`E2E: failure`, `Checks: success`), que es el aislamiento que el CA pide | | ❌ |
| CA-5 | `.github/workflows/ci.yml` (`permissions: contents: read`; `env` de juguete en `E2E`; `timeout-minutes` 20/25; `concurrency` con `cancel-in-progress` condicionado) | `tests/ci-workflow.test.ts` › *CA-5* (6 casos, uno por punto: 5.1 sin `secrets.` / 5.1 variables de juguete / 5.2 permissions / 5.3 sin `db:migrate` / 5.4 timeouts / 5.5 concurrency). **5.4 demostrado en vivo, sin quererlo**: el `timeout-minutes: 25` cortó el job colgado de [run 32085219147](https://github.com/tremen-dev/stockeiro/actions/runs/32085219147) — el tope existe y muerde | | ❌ |
| CA-6 | `.nvmrc` (`24`) + `node-version-file: .nvmrc` en los dos `Set up Node` | `tests/ci-workflow.test.ts` › *CA-6* (2 casos) **+ el runner lo imprime**: `Found in cache @ /opt/hostedtoolcache/node/24.19.0/x64` y `node: v24.19.0`, con `node-version-file: .nvmrc` en el log. Suite completa ejecutada además en Node 24 en local — ver §Mediciones | | ❌ |
| CA-7 | `package.json` › `scripts.lint` = `eslint . --max-warnings=0`, `scripts["test:e2e"]` = `playwright test`; todo gate del YAML invoca `npm run <script>` | `tests/ci-workflow.test.ts` › *CA-7* (3 casos: los scripts existen; cada gate invoca el suyo; las banderas van tras `--`). En el log de CI se lee el comando entero: `> playwright test --forbid-only --trace=retain-on-failure --reporter=list,html` | | ❌ |
| CA-8 | `.github/workflows/ci.yml` (`cache: npm` en setup-node; `actions/cache` de `~/.cache/ms-playwright` con clave de `package-lock.json`; sin caché de `node_modules` ni `.next/cache`, con el motivo escrito en el YAML) | `tests/ci-workflow.test.ts` › *CA-8* (4 casos) **+ ahorro medido** — ver §Ahorro de caché. Frío→caliente: `Install Playwright browser` **14 s → 1 s**; `Cache hit` de 261 MB (navegador) y 212 MB (npm) en el log | | ❌ |
| CA-9 | `.github/workflows/ci.yml` › step `Upload e2e diagnostics` (`if: failure()`, `playwright-report/` + `test-results/` + `_qa/`, `retention-days: 7`) | Sin test estático a propósito: lo que se afirma es que el artefacto *existe y abre*. **Prueba en rojo**: [run 32087968719](https://github.com/tremen-dev/stockeiro/actions/runs/32087968719) → artefacto `e2e-diagnostics` de **9,8 MB**, descargado y abierto — ver §Artefacto. **Y en verde no sube nada**: [run 32088353875](https://github.com/tremen-dev/stockeiro/actions/runs/32088353875) tiene **0 artefactos**. Commit `e8036d4`, revertido en `e2f7b2a` | | ❌ |
| CA-10 | `.github/workflows/ci.yml` › `npm run test:e2e -- --forbid-only …` | **Prueba en rojo**: [run 32087612615](https://github.com/tremen-dev/stockeiro/actions/runs/32087612615) → `End-to-end tests: failure` con el mensaje literal `Error: item focused with '.only' is not allowed due to the '--forbid-only' CLI flag: "vigiladas.spec.ts SPEC-003: …"`. Sin la bandera habría pasado en verde con **1 test de 27**. Commit `8f4185f`, revertido | | ❌ |
| CA-11 | `tests/schema-source.test.ts` › bloque CA-6, **reimplementado tras la enmienda del 2026-08-18** (`231b2c6`): canario sobre **sonda sembrada y rebobinada** al primer apunte del journal; la **forma de la ruta de sonda vive en un solo sitio** (`withProbe`), ni guardia ni canario nombran su `--out` | `tests/schema-source.test.ts` › *CA-6* › «la guardia sabe detectar: sobre una sonda rebobinada reproduce las migraciones que faltan». **Verde + las DOS roturas exigidas, ambas revertidas** — ver §CA-11 reimplementado | | ❌ |
| CA-12 | `tests/schema-source.test.ts`: la inspección `/error\|ENOENT/i` sigue retirada (**no se revirtió**) y el comentario recoge las **tres rondas** medidas, incluido el mecanismo real: `drizzle-kit` concatena el cwd delante de la ruta absoluta al buscar `meta/NNNN_snapshot.json` | Lectura del fichero: **no queda ninguna inspección de la salida del proceso ni ninguna aserción sobre la forma de la ruta**, ni a favor ni en contra (descartado por el humano el 2026-08-18). El comportamiento lo verifica CA-11 | | ❌ |
| CA-13 | Sin cambios de expectativas en ningún test existente; único fichero de test existente tocado: `tests/schema-source.test.ts` (+ `tests/position.test.ts`, un import sin usar, autorizado en el gate) | Suite completa verde en Node 22 y Node 24 en local (308/308 en 32 ficheros) **y en CI** (32/32 ficheros, 27/27 e2e). **Coste aislado del canario SEMBRADO medido** — ver §CA-11 reimplementado. Tiempos y minutos facturados reales — ver §Tiempos reales de CI | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-027/. Informe HTML opcional: _qa/SPEC-027/informe.html -->

Esta spec no toca `src/`: no hay UI de aplicación que capturar. Su evidencia es la propia PR
**#31** y sus ejecuciones, enlazadas una a una en la matriz y en §Ejecuciones de CI. Todas son
navegables por el verificador sin reproducir nada.

## Ejecuciones de CI (la PR se verificó a sí misma)

Para el evento `pull_request` GitHub ejecuta el workflow **de la rama de la PR**, así que estas
seis ejecuciones son el workflow de esta spec verificándose a sí mismo antes de existir en
`main`.

| # | Run | Commit | Para qué | Desenlace |
|---|---|---|---|---|
| 1 | [32085219147](https://github.com/tremen-dev/stockeiro/actions/runs/32085219147) | `015536b` | primera pasada | `Checks: success` (3m28s) · **`E2E: cancelled`** por el `timeout-minutes` — ver §El primer run |
| 2 | [32086893473](https://github.com/tremen-dev/stockeiro/actions/runs/32086893473) | `c62a2b3` | primera pasada **verde** (npm caliente, navegador **frío**) | **success** — Checks 4m29s · E2E 2m01s |
| 3 | [32087238733](https://github.com/tremen-dev/stockeiro/actions/runs/32087238733) | `4197e23` ⟳ | **rojo de CA-3** | failure — `Typecheck ✗` · `Lint ✗` · `Unit tests ✓` · `Build ✗` → `End-to-end tests` skipped |
| 4 | [32087612615](https://github.com/tremen-dev/stockeiro/actions/runs/32087612615) | `8f4185f` ⟳ | **rojo de CA-10** (`.only`) | failure — `--forbid-only` lo tumba; `Checks: success` |
| 5 | [32087968719](https://github.com/tremen-dev/stockeiro/actions/runs/32087968719) | `e8036d4` ⟳ | **rojo de CA-9** (aserción falsa) | failure — **1 failed / 26 passed**, artefacto de 9,8 MB con traza |
| 6 | [32088353875](https://github.com/tremen-dev/stockeiro/actions/runs/32088353875) | `e2f7b2a` | pasada final, **todo caliente** | **success** — Checks 3m48s · E2E 1m42s · **0 artefactos** |

**Las seis corrieron con el canario ANTERIOR (sonda vacía)**: siguen probando CA-1…CA-10 y CA-13,
pero **no CA-11** — ver el aviso de §Cómo retomar.

⟳ = commit temporal, revertido. `git diff c62a2b3 HEAD` está **vacío**: no queda ni un resto.

## Tiempos reales de CI (CA-13) — el número que nadie tenía

| | Checks | E2E | Pared | Facturado* |
|---|---|---|---|---|
| **Run 2** (npm caliente, navegador frío) | **4m29s** | **2m01s** | **4m29s** | ~7 min |
| **Run 6** (todo caliente) | **3m48s** | **1m42s** | **3m48s** | **~6 min** |

<sub>*GitHub factura por job redondeando al minuto: 4+2 = 6 min en el run 6. Repo privado, plan
free, 2.000 min/mes.</sub>

Desglose del run 6, por step:

| Checks | | E2E | |
|---|---|---|---|
| Set up Node | 5 s | Set up Node | 3 s |
| Install dependencies | 15 s | Install dependencies | 11 s |
| **Typecheck** | **6 s** | Cache Playwright browsers | 6 s |
| **Lint** | **4 s** | **Install Playwright browser** | **1 s** |
| **Unit tests** | **3m11s** | **Build** | **14 s** |
| | | **End-to-end tests** | **57 s** |

**La estimación de la spec se queda corta por el lado bueno.** Predecía 7-9 min de pared y 13-16
facturados; lo real es **3m48s de pared y ~6 min facturados**, menos de la mitad. A ~6 min por
pasada, los 2.000 min/mes del plan free dan para **~330 pasadas mensuales**: correr el e2e en
cada PR (pregunta 6 del gate de ADR-018) no está ni cerca de ser un problema de cuota, y ahora
está respondido con datos.

### Ahorro de caché (CA-8)

| | Run 2 (navegador frío) | Run 6 (caliente) |
|---|---|---|
| `Cache Playwright browsers` | 1 s (miss) | 6 s (restore de **261 MB**) |
| `Install Playwright browser` | **14 s** | **1 s** |
| `Install dependencies` (npm) | 13 s | 11 s (cache hit de **212 MB**) |

Líneas literales del log: `Cache hit for: playwright-Linux-9d37e1f0…` y `Cache hit for:
node-cache-Linux-x64-npm-9d37e1f0…`. El ahorro neto del navegador es modesto en segundos
(~7 s) porque el binario ya venía comprimido y la restauración cuesta lo suyo; lo que evita de
verdad es **descargar 130 MB desde el CDN de Microsoft en cada pasada**, que es un punto de
fallo externo, no solo tiempo. Y sigue **sin cachearse `node_modules`**: la instalación de
`@embedded-postgres/linux-x64` se ejecuta de verdad en cada pasada, que es exactamente lo que
el CA quería proteger.

### El artefacto de diagnóstico, descargado y abierto (CA-9)

Del run 5, `gh run download`:

```
art/_qa/                      50 capturas .png
art/playwright-report/        index.html + data/ + trace/
art/test-results/vigiladas-SPEC-003-…-chromium/
                              error-context.md (9,5 KB)
                              trace.zip (1.125.825 B)
```

La traza **abre**: dentro del `.zip` están `test.trace`, `0-trace.trace`, `0-trace.network` y el
screencast completo en `resources/*.jpeg`. No es un fichero vacío con nombre bonito. Retención
confirmada por la API: creado `2026-08-18T01:24:10Z`, expira `2026-08-25T01:24:09Z` — **7 días
exactos**. Y la mitad que más se olvida: la pasada verde (run 6) tiene **`total_count: 0`**.

## CA-11 reimplementado (enmienda del 2026-08-18)

La enmienda (`9ae29ea`) cambia el **comportamiento** del canario, no su redacción: pasa de sonda
**vacía** a sonda **sembrada y rebobinada**. Reimplementado en `231b2c6`.

Qué hace ahora, y por qué así:

- **Sonda sembrada, rebobinada al primer apunte del journal**: copia de `drizzle/` recortada a
  `idx 0` (`0000_real_tusk.sql` + `meta/0000_snapshot.json`), borrando el resto. Al primero y no
  *"quitando el último"* porque el delta contra `0000` **solo puede crecer**, mientras que el
  último apunte puede ser una migración a mano sin cambio de esquema
  —`0004_backfill_operating_mic` lo es— y dejaría el canario en rojo acusando a la guardia de
  algo que no pasa.
- **La forma de la ruta de sonda se decide en un único sitio** (`withProbe`, `const outArg`). Ni
  la guardia ni el canario nombran su `--out`: lo reciben ya ligado junto con `dir`, `generate()`
  y `sqlFiles()`. Esto es lo que convierte la enmienda en cierre y no en parche.
- **Mensaje de fallo en dos lecturas**: primero la probable (*"la guardia está muerta y lleva
  quién sabe cuánto dando verde sin mirar nada"*), detrás la segunda (*"…o alguien ha reescrito
  el historial de `drizzle/` y el punto de rebobinado (0000_real_tusk) ya no tiene deriva
  pendiente"*), con el tag interpolado para que no haya que ir a buscarlo.

### Verde

```
✓ drizzle/ está al día respecto de src/db/schema.ts                              2.29 s
✓ la guardia sabe detectar: sobre una sonda rebobinada reproduce las
  migraciones que faltan                                                          2.05 s
```

El canario genera el delta `0000 → esquema actual`, es decir las 7 migraciones que le faltan a la
sonda rebobinada, condensadas en un `.sql`.

### Rojo (1) — se rompe la invocación (`--schema` inexistente)

```
× drizzle/ está al día respecto de src/db/schema.ts
  → Command failed: npx drizzle-kit generate --dialect postgresql
    --schema ./src/db/NO-EXISTE-rotura-1.ts --out node_modules/.cache/spec026-guard-…
× la guardia sabe detectar: sobre una sonda rebobinada …
  → Command failed: npx drizzle-kit generate --dialect postgresql
    --schema ./src/db/NO-EXISTE-rotura-1.ts --out node_modules/.cache/spec027-canary-…
```

`drizzle-kit` sale con **1**, `execFileSync` lanza y **ninguno de los dos puede quedarse verde**.
El fallo señala la **invocación**, no la deriva. Revertida.

### Rojo (2) — la que el canario viejo NO cazaba: sonda en ruta absoluta

Cambiando **una sola línea** en el sitio único (`const outArg = relPath` → `= dir`):

```
✓ drizzle/ está al día respecto de src/db/schema.ts                    2.30 s   <-- VERDE EN FALSO
× la guardia sabe detectar: sobre una sonda rebobinada reproduce las migraciones que faltan
  → La guardia de esquema NO PUDO EJECUTARSE. La lectura probable: la comprobación de
    deriva está muerta y lleva quién sabe cuánto dando verde sin mirar nada — revisa la
    invocación de `drizzle-kit generate` (argumentos, binario, cwd, la forma de la ruta
    de sonda) antes de creerte el verde del test de arriba. La segunda lectura, menos
    probable: alguien ha reescrito el historial de `drizzle/` y el punto de rebobinado
    (0000_real_tusk) ya no tiene deriva pendiente, en cuyo caso lo que hay que arreglar
    es este canario y no la guardia.
```

**Esta es la evidencia que faltaba y la razón de ser de la enmienda.** La guardia informa
alegremente de que no hay deriva sin haber mirado nada, y **el canario es lo único que se entera**.
Con la versión anterior —sonda vacía— este mismo cambio dejaba a los dos en verde: la sonda vacía
es justo el estado en el que `drizzle-kit` sí acepta la ruta absoluta. Revertida.

### Coste aislado del canario sembrado (CA-13)

| Versión del canario | Coste por pasada de suite |
|---|---|
| sonda **vacía** (implementación anterior) | 1,96 s · 1,99 s |
| sonda **sembrada y rebobinada** (actual) | **2,05 s · 2,80 s** |

El mismo orden de magnitud, como preveía la enmienda: el gasto es la invocación de `drizzle-kit`,
no la copia de 17 ficheros ni el recorte del JSON. **Techo declarado: 10 s. Margen sobrado**, sin
necesidad de volver al gate. Suite completa tras el cambio: **308/308 en 32 ficheros, 105,9 s** en
Node 24 — sin regresión.

## El primer run: por qué el gate no dependía de lo que creíamos

El riesgo que traía señalado de la implementación local era
`@embedded-postgres/linux-x64` — la primera vez que su script de instalación corría en Linux.
**No dio ningún problema**: `Install dependencies` pasó en **21 s** a la primera, y el e2e
levanta su Postgres efímero sin una queja. Ese miedo queda cerrado.

Lo que sí tumbó el primer run fue otra cosa, y no estaba en ninguna lista:

```
00:37:55  Installing dependencies...                        <- playwright install --with-deps
00:37:55  Switching to root user to install dependencies...
00:38:33  Ign:14 http://azure.archive.ubuntu.com/ubuntu noble-updates/main amd64 Packages
          … 24 minutos sin una sola línea …
01:02:40  ##[error]The operation was canceled.               <- timeout-minutes: 25
```

`--with-deps` se pasa a root y lanza un `apt-get update` que se quedó esperando al mirror
`azure.archive.ubuntu.com`. El job murió en el tope sin ejecutar **un solo test**, quemando
~25 min de cuota para cero información.

Arreglado en `c62a2b3`, y merece explicación porque es una decisión y no un parche:

- **Se retira `--with-deps`.** La imagen `ubuntu-latest` ya trae las librerías de sistema que
  pide Chromium, así que no aportaba nada y a cambio ataba **cada pasada del gate** a la salud de
  un mirror de apt. Si algún día faltara una librería de verdad, Chromium no arranca y el e2e lo
  dice a gritos: es un fallo que se delata solo. Medido: el step pasó de colgarse a **14 s** en
  frío y **1 s** en caliente.
- **El step gana `timeout-minutes: 5`.** Para que un cuelgue ahí cueste 5 minutos y no los 25 del
  job entero.
- **No toca ningún CA.** `--with-deps` venía de §*Forma del workflow* de la spec, marcada
  literalmente como *«guía para el implementador, no contrato»*. Ningún criterio de aceptación lo
  menciona.

Lectura que conviene no perder: el `timeout-minutes` de CA-5.4 **hizo su trabajo el primer día**.
Sin él, ese cuelgue se habría comido la cuota hasta el tope de 6 h de GitHub.

## Mediciones

### Node 24 — la pieza que podía tumbar la spec, y no la tumba

La máquina no tiene gestor de versiones (`nvm`, `fnm`, `volta`: ninguno). Se descargó el
binario portable **v24.19.0** (`node-v24.19.0-win-x64`, la última 24.x LTS «Krypton» el
2026-08-03) al scratchpad y se ejecutó la suite entera anteponiéndolo al `PATH`. Local sigue en
**v22.19.0**; `.nvmrc` fija **24**, que es lo que corre Vercel (ADR-018).

| Gate | Node 22.19.0 | **Node 24.19.0** | Resultado |
|---|---|---|---|
| `npm run typecheck` | exit 0 | **exit 0** | limpio |
| `npm run lint` (`--max-warnings=0`) | exit 0 | **exit 0** | 0 errores, 0 warnings |
| `npm run test` | 308/308 en 32 ficheros · **97,08 s** | **308/308 en 32 ficheros · 104,55 s** | sin una sola diferencia de comportamiento |
| `npm run build` (variables de juguete) | — | **exit 0 · 33,5 s** | confirma CA-5.1: el build no abre ninguna conexión |
| `npm run test:e2e -- --forbid-only --trace=retain-on-failure --reporter=list,html` | — | **27/27 · 77,9 s** (`CI=1`) | verde a la primera |

**Node 24 no rompe nada.** No hubo que bajar el CI a 22 ni forzar nada. Los `[auth][error]
CredentialsSignin` del log del e2e son los tests de login inválido haciendo su trabajo, no un
fallo.

Caveat honesto: esto es Node 24 **en Windows y contra el `node_modules` ya instalado**. El
runner es `ubuntu-latest` con `npm ci` desde cero, y ahí entra `@embedded-postgres/linux-x64`
con su script de instalación, que **nadie ha ejecutado nunca**. Es el riesgo que solo cierra la
primera pasada real de CI.

### CA-13 — coste del canario

| Referencia | Tests | Duración |
|---|---|---|
| Antes de esta spec (medido por el arquitecto, Node 22) | 282 en 31 ficheros | 145 s |
| Después, Node 22 | 308 en 32 ficheros | **97,08 s** |
| Después, Node 24 | 308 en 32 ficheros | **104,55 s** |

El coste aislado del canario, tomado del desglose por test de Vitest, es **≈ 2,0 s** por pasada
de suite (1,96 s / 1,99 s en dos ejecuciones) — no los **25 s** que estimaba la spec. La suite
completa queda **por debajo** de la referencia de 145 s pese a sumar 26 tests, así que el techo
de **+25 %** no se acerca siquiera. (El resto de la diferencia es varianza de máquina/caché
entre la medición del arquitecto y estas; no se atribuye al cambio.)

### CA-11 y CA-12 — mediciones de la PRIMERA implementación (histórico, superado)

> ⚠️ **Lo de abajo está SUPERADO por la enmienda del 2026-08-18** y se conserva porque es la
> medición que la provocó —y porque la spec (§Enmienda) pide explícitamente que no se vuelva a
> "corregir" esto sin medir. El canario descrito aquí usaba **sonda vacía** y tenía el punto ciego
> que se documenta más abajo. **El canario vigente es el de §CA-11 reimplementado.** La antigua
> conclusión "CA-12 no se puede cerrar como está escrito" **ya no aplica**: el arquitecto enmendó
> CA-11 y CA-12 el 2026-08-18 y ambos están ahora implementados y demostrados.

### CA-11 — el canario, probado en los dos sentidos

- **Verde**: la misma invocación contra una sonda vacía escribe el esquema entero
  (`0000_*.sql`). Es lo que corre en cada pasada.
- **Rojo**: se rompió la invocación a propósito (commit temporal, revertido: `--out` apuntando a
  `${outRel}-BREAK-TEMPORAL`, que simula el fallo realista de que la salida aterrice en otro
  sitio). Resultado, y es exactamente el que justifica el CA:

  ```
  ✓ drizzle/ está al día respecto de src/db/schema.ts            <-- la guardia, VERDE en falso
  × la guardia sabe detectar: contra un directorio vacío genera migración
    → La guardia de esquema NO PUDO EJECUTARSE. Esto no dice que haya deriva:
      dice que la comprobación de deriva está muerta …
  ```

  La guardia sigue verde estando rota; **solo el canario se pone rojo**, y señala la guardia, no
  la deriva.

### CA-12 — la medición prescrita sale al revés de lo que dice el CA

CA-12 pide ejecutar la guardia con la sonda en **ruta absoluta** y comprobar que «se comporta
igual — verde sin deriva y roja con deriva». **No se comporta igual.** Medido el 2026-08-18 con
la invocación exacta del test (`execFileSync`, `cwd` = raíz, `shell: true`):

| Sonda | `--out` | Resultado |
|---|---|---|
| sembrada con `drizzle/`, **sin** deriva | relativo | `status 0`, stdout `No schema changes, nothing to migrate 😴`, 8 → 8 `.sql` → guardia **verde**, correcto |
| sembrada con `drizzle/`, **con** deriva | relativo | `status 0`, escribe `0008_*.sql`, 8 → 9 → guardia **roja**, correcto |
| sembrada con `drizzle/`, **sin** deriva | **absoluto** | `status 0`, **stdout vacío**, 1395 B en **stderr**, 8 → 8 → guardia **verde** |
| sembrada con `drizzle/`, **con** deriva | **absoluto** | `status 0`, **stdout vacío**, 1403 B en **stderr**, 8 → 8 → guardia **VERDE EN FALSO** |
| vacía, sin deriva | absoluto | funciona: 0 → 1 `.sql` |

El stderr del caso absoluto dice qué pasa, y no es lo que creía nadie:

```
Error: ENOENT: no such file or directory, open
'D:\…\followups-024-025\D:\…\followups-024-025\node_modules\.cache\mx-abs\meta\0000_snapshot.json'
```

`drizzle-kit` **concatena el cwd delante de la ruta absoluta** al buscar el snapshot previo. Por
eso falla **solo cuando la sonda está sembrada** —el caso de la guardia— y no cuando está vacía
—el caso del canario—. Y falla con **código 0**, así que `execFileSync` no lanza.

Consecuencias, sin adornos:

1. **El punto 1 de CA-12 es correcto solo para el directorio vacío.** «`drizzle-kit generate` sí
   acepta un `--out` absoluto y escribe allí» se midió contra sondas vacías; contra una sembrada
   no escribe nada y no lo dice por stdout. La creencia vieja («la sonda debe ser relativa»)
   resulta ser **cierta para la guardia**, aunque el motivo que se le atribuía era falso.
2. **El punto 2 sigue en pie y la retirada del código muerto es correcta**, con una razón más
   que la registrada: la inspección `/error|ENOENT/i` miraba **stdout**, y el único fallo
   realmente mudo escribe en **stderr**. Nunca lo habría cazado.
3. **El canario, tal y como lo define CA-11 (sonda vacía), no cubre este caso concreto.** Si
   alguien «limpia» la sonda a ruta absoluta, la guardia se vuelve muda **y el canario sigue
   verde**, porque su directorio vacío es justo la forma que sí funciona. → **F-SPEC-027-3**.

Se ha dejado escrito en el comentario del test (medición, no test) y **no** se ha escrito ningún
CA ni aserción que fije «la sonda debe ser relativa»: ataría el test a una versión de
drizzle-kit y seguiría sin cubrir las demás formas de morir mudo. La decisión de si CA-12 se da
por cerrado, se reescribe o se refuerza el canario **es del gate, no mía**.

### Validación estática del YAML

`actionlint 1.7.12` sobre `.github/workflows/ci.yml`: **0 hallazgos** (exit 0). No sustituye a
la ejecución real, pero descarta el viaje de ida y vuelta por un error de sintaxis.

## Salvedades / follow-ups

- **F-SPEC-027-1 — La CI informa, pero no impide mezclar.** Ya declarado en la spec (§Fuera de
  alcance): repo privado + org en plan free ⇒ `403 Upgrade to GitHub Pro` tanto en protección de
  rama como en *rulesets*. No se ha intentado configurar nada. Queda escrito en
  `docs/despliegue.md` §9 para que nadie lea un check verde como una barrera. **Decisión del
  humano, con precio** (GitHub Team ~4 $/asiento/mes, 1 asiento).
- **F-SPEC-027-2 — `guard-migrate` (ADR-018 D-2) y escáner de SQL destructivo (D-5.2).** Fuera
  de alcance aquí porque la ventana que protegen no se abre sin integración Vercel↔GitHub.
  **Bloqueante de SPEC-028**: deben entrar *antes* de conectar el repo.
- ~~**F-SPEC-027-3 — El canario tiene un punto ciego medido: la sonda absoluta con directorio
  sembrado.**~~ **CERRADO** el 2026-08-18, absorbido por la **enmienda de CA-11** (`9ae29ea`) y su
  reimplementación (`231b2c6`). El humano eligió la opción **(a)** de las tres que dejé abiertas:
  canario sobre **sonda sembrada**, con la forma de la ruta en un **único sitio**. Descartó
  expresamente la aserción sobre la forma de la ruta —fosiliza folklore y cierra en falso un
  riesgo que seguiría abierto—, y el arquitecto descartó con motivo la opción (b) —exigir `stderr`
  vacío— porque ata la guardia a que `drizzle-kit` no imprima nunca un aviso benigno por ese canal
  y volvería a cubrir **una** sola forma de morir mudo. **Demostrado con el rojo (2)**: ver
  §CA-11 reimplementado.
- ~~**F-SPEC-027-4 — Pruebas en rojo y evidencia viva pendientes de la PR.**~~ **CERRADO** el
  2026-08-18 con la PR #31: seis ejecuciones, tres rojos deliberados revertidos, artefacto
  descargado y traza abierta, tiempos reales medidos. Ver §Ejecuciones de CI.
- **F-SPEC-027-5 — `actions/checkout@v4` y `actions/setup-node@v4` están deprecadas.** Cada
  ejecución emite el aviso: *«Node.js 20 is deprecated. The following actions target Node.js 20
  but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4»*. Hoy es
  ruido —GitHub las fuerza a Node 24 y funcionan—, pero es deuda con fecha de caducidad. Subirlas
  a `@v5` es un cambio de dos líneas; no entra aquí porque ningún CA lo pide y tocarlo el mismo
  día que se estrena el gate mezcla dos cosas. → **EPIC-INFRA**.
- **Lectura de CA-7 que conviene que el verificador conozca**: la spec escribe el script como
  `"lint": "eslint ."` y deja `--max-warnings=0` como pregunta del gate. El humano dijo que sí, y
  la bandera se ha puesto **dentro del script de `package.json`**, no en el YAML, precisamente
  porque CA-7 exige que ninguna bandera propia de CI cambie lo que se ejecuta: así `npm run lint`
  significa lo mismo en la máquina del humano y en el runner. Efecto colateral autorizado: se
  borra el import sin usar de `tests/position.test.ts:7` (`type LedgerEntry`).
- ~~**El e2e en Linux no se ha ejecutado nunca.**~~ **Cerrado, y el sospechoso era inocente**:
  `@embedded-postgres/linux-x64` instaló en 21 s a la primera y el e2e levanta su Postgres
  efímero sin queja. Lo que rompió el primer run fue `playwright install --with-deps` colgado
  contra un mirror de apt — ver §El primer run.
- **Colisión de ids de ADR: resuelta antes de empezar** (commit `e930f1c`): **ADR-018** =
  despliegue continuo (el que gobierna esta spec), **ADR-019** = el esquema de test es el de
  producción (SPEC-026). No se ha renumerado nada.

## Cómo retomar (handoff)

**Hecho y verde en local** (Node 22 y Node 24): los 13 CA tienen implementación; 12 tienen test
o medición registrada. La suite completa pasa: **308/308 unitarios en 32 ficheros**, **27/27
e2e**, typecheck y lint limpios con `--max-warnings=0`, build verde con variables de juguete.
`actionlint` no encuentra nada en el workflow.

**Ficheros tocados** (todos commiteados en `ft/SPEC-027-ci-en-cada-pr`):

| Fichero | Cambio |
|---|---|
| `.github/workflows/ci.yml` | nuevo — dos jobs, un step por gate |
| `.nvmrc` | nuevo — `24` |
| `package.json` | scripts `lint` y `test:e2e`; devDependency `yaml` |
| `tests/ci-workflow.test.ts` | nuevo — 25 casos, CA-1…CA-8 |
| `tests/schema-source.test.ts` | canario **sembrado y rebobinado** (CA-11, enmienda) + retirada del código muerto y comentario con las tres rondas medidas (CA-12) |
| `tests/position.test.ts` | borrado el import sin usar (autorizado en el gate) |
| `docs/despliegue.md` | §9 nueva |

**El guion de verificación en CI está ejecutado y cerrado.** La PR #31 se verificó a sí misma en
seis ejecuciones (§Ejecuciones de CI): una verde en frío, tres rojos deliberados —CA-3, CA-10,
CA-9— cada uno revertido, y una verde final con las cachés calientes. El artefacto de diagnóstico
se descargó y la traza se abrió.

**La enmienda de CA-11 está reimplementada y demostrada** (§CA-11 reimplementado): canario sobre
sonda sembrada y rebobinada, forma de la ruta en un único sitio, y las **dos** roturas exigidas
—invocación rota, y sonda en absoluta— ejecutadas y revertidas. Coste medido: **2,0-2,8 s**, muy
por debajo del techo de 10 s. **F-SPEC-027-3 queda cerrado.**

> ⚠️ **Aviso al verificador sobre las ejecuciones de CI.** Los seis runs de §Ejecuciones de CI
> corrieron con el canario **anterior** (sonda vacía). Siguen siendo evidencia válida de CA-1…CA-10
> y CA-13 —el workflow no ha cambiado desde entonces salvo el arreglo de `--with-deps`, anterior a
> todos ellos—, pero **su verde ya no prueba CA-11**. La evidencia de CA-11 es la de §CA-11
> reimplementado (local) más la pasada de CI del commit `231b2c6` en adelante, que sí lleva el
> canario sembrado.

**Estado para el verificador**: los 13 CA tienen implementación, test y evidencia. **No queda
trabajo mío pendiente en esta spec.** Lo único abierto no es técnico:

1. **F-SPEC-027-1** es la conversación cara: la CI informa y **no impide** mezclar, porque el plan
   de GitHub no lo ofrece. Escrito en `docs/despliegue.md` §9 para que un check verde no se lea
   como una barrera que no existe.
2. **F-SPEC-027-2** (guardias de migración) es bloqueante de SPEC-028, no de esta.
3. **F-SPEC-027-5** (actions deprecadas) es deuda con fecha, no urgencia.

**Si hay que retomar el workflow**, lo único no obvio está en `.github/workflows/ci.yml` con su
porqué al lado: por qué no se cachea `node_modules`, por qué `--with-deps` no está, y por qué
`End-to-end tests` es el único gate que encadena.

**Si alguien va a "limpiar" `tests/schema-source.test.ts`**: lee antes el comentario de
`withProbe` y §Enmienda de la spec. Sobre la forma de la ruta de sonda se han emitido tres
veredictos y cada uno corrigió al anterior; dos llegaron a colarse en un documento firmado. La
regla de método está escrita: **toda medición sobre esta guardia se hace con su estado de partida
—sonda sembrada—**; medir con sonda vacía ya produjo dos conclusiones contradictorias.
