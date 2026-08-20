---
id: SPEC-042
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-042 La limpieza de las ramas de preview de Neon deja de ser un recordatorio

## Resumen
- Fase: **en-revision (ronda 3)** — bloque 🔒 (CA-1 a CA-7) implementado y verde (7/7 en la ronda 2), con el finding **N-1** del GREEN cerrado en la ronda 3: la línea de diagnóstico de `F-SPEC-042-7` decía que un job saltado *«no aparece en Actions»* y era **falsa**; ahora §13.3 dice lo que de verdad se ve, los dos *fail-closed* del apartado se distinguen, y el hueco lo congelan cinco casos nuevos. Antes, en la ronda 2, los tres findings del RED: el nombre de rama se filtra antes de llegar a la shell de la composite action (F-1), la frase falsa corregida en sus tres artefactos (F-2) y CA-9 desatado de CA-8 (F-3). Bloque 🚀: CA-9 se puede medir **ya**, con un comando y sin cerrar nada; CA-8 y CA-10 siguen esperando el primer cierre real de PR.
<!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-042-limpieza-automatica-de-ramas-de-preview-en-neon`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
<!-- 🔒 = verificable en el repositorio con un test. 🚀 = solo comprobable al cerrar una PR de verdad; su evidencia va abajo, no a un test. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| 🔒 CA-1 el workflow existe, aparte, y no toca a los otros dos | `.github/workflows/neon-preview-cleanup.yml` (nuevo) | `tests/neon-preview-cleanup-workflow.test.ts` · CA-1 1.1–1.4 (el 1.4 compara `ci.yml` y `deploy-gate.yml` **byte a byte** con `origin/main`) | **Ronda 2, revisado de nuevo.** Los **blobs de git** de `ci.yml` y `deploy-gate.yml` coinciden con los del `origin/main` de ahora (`124085a`): `34b47942…` y `dcd8713f…` en ambos lados — comparacion por hash, que no admite interpretacion. `.github/workflows/` sigue teniendo exactamente tres ficheros. El test 1.4 corrio de verdad (39/39 casos, ninguno *skipped*). | ✅ |
| 🔒 CA-2 un solo disparador `pull_request: [closed]`, sin filtro por `merged`, sin `pull_request_target` | `.github/workflows/neon-preview-cleanup.yml`, clave `on` | `tests/neon-preview-cleanup-workflow.test.ts` · CA-2 2.1–2.5 (2.4 busca `pull_request_target` también en los comentarios; 2.5, `merged` en cualquier `if` y en el texto crudo) | **Ronda 2.** `on = {"pull_request":{"types":["closed"]}}`, una sola clave. Cero `pull_request_target` en todo el fichero, comentarios incluidos. Ningun `if` sobre `merged`: el del job crecio, pero solo con los tres `!contains`. | ✅ |
| 🔒 CA-3 `neondatabase/delete-branch-action@v3` con exactamente tres entradas | `.github/workflows/neon-preview-cleanup.yml`, único step | `tests/neon-preview-cleanup-workflow.test.ts` · CA-3 3.1–3.4 | **Ronda 2.** `with` sigue siendo exactamente `['project_id','branch','api_key']`. Volvi a la fuente: `v3` **sigue** en `4468d825…`, la accion no esta archivada ni deshabilitada. Sus cinco entradas reales, y omitir `branch_id` (deprecada) y `api_host` (default correcto) sigue siendo lo correcto. | ✅ |
| 🔒 CA-4 nada fuera del prefijo literal `preview/`; `main` no se nombra; sin `run:` | `.github/workflows/neon-preview-cleanup.yml`: `with.branch`, forma del fichero **y el filtro de caracteres del `if` del job** (ronda 2, F-1) — `!contains(github.head_ref, '$')`, `` '`' `` y `'"'`, sumados a la condición de fork, que no se toca. El comentario del step **ya no afirma** que sin `run:` el nombre de rama no llegue a una shell: dice que la acción es composite, que su paso final es `shell: bash` y que quien impide la inyección es el filtro | `tests/neon-preview-cleanup-workflow.test.ts` · CA-4 4.1–4.4 (4.2 prohíbe `main`/`production` en el **fichero entero**, comentarios incluidos) **+ 4.5, nuevo**: (a) le pregunta a `git check-ref-format` cuál de los cuatro especiales de bash dentro de comillas dobles (`$`, backtick, `\`, `"`) acepta en una ref y exige que el filtro sea exactamente los tres que pasan — la derivación se ejecuta, no se recuerda; (b) los tres `!contains` van sobre la **misma** expresión que alimenta `with.branch`; (c) la condición de fork **sigue** ahí (tres `&&`, ni uno más); (d) el step no tiene un `if` propio que se salte al del job | **F-1 CERRADO, y verificado sin fiarme del arreglo que yo mismo propuse.** Volvi a derivar el conjunto **desde cero y exhaustivamente sobre los 95 ASCII imprimibles**, cruzando dos preguntas por caracter: si `git check-ref-format` lo acepta en una ref, y si el **cuerpo literal del `run:`** de la accion devuelve el argumento identico o bash reacciona. Resultado: `CONJUNTO PELIGROSO REAL = ['"', '$', '`']` — exactamente los tres que el filtro bloquea, **ni uno de menos ni uno de mas**. Los que bash trata como especiales pero git rechaza en una ref (`espacio`, `*`, `:`, `?`, `[`, `\`, `^`, `~`) no llegan nunca. Revise los **cuatro** caminos por los que un dato puede entrar al bash de la accion —incluida la interpolacion **sin comillas** de `project_id`— y ninguno es alcanzable desde una PR: `project_id` es variable de repo (admin), `branch_id` es la rama inalcanzable del `if [ -z ]`, y `api_key`/`api_host` solo van en `env`. El comentario del step ya dice la verdad. **No queda vector.** | ✅ |
| 🔒 CA-5 higiene: sin forks, sin permisos de escritura, con plazo y concurrencia, sin `continue-on-error` | `.github/workflows/neon-preview-cleanup.yml`: `if` de fork, `permissions: {}`, `timeout-minutes: 10`, grupo propio con `cancel-in-progress: false` | `tests/neon-preview-cleanup-workflow.test.ts` · CA-5 5.1–5.5 | **Ronda 2.** `permissions: {}`, `timeout-minutes: 10`, grupo `neon-preview-cleanup-…` distinto de los otros dos, `cancel-in-progress: false`. **La condicion de fork sigue dentro del `if`**: el filtro se **suma**, no la sustituye (verificado sobre el YAML parseado). Sin `continue-on-error`, sin encadenado que se trague el codigo de salida, sin `always()`. | ✅ |
| 🔒 CA-6 frontera: `ci.yml` y `deploy-gate.yml` siguen sin secretos; este no gobierna el merge | ningún cambio en `ci.yml` ni `deploy-gate.yml`; punto 3 escrito en `docs/despliegue.md` §9 | `tests/neon-preview-cleanup-workflow.test.ts` · CA-6 6.1–6.2 + `tests/spec-031-frontera.test.ts` y `tests/spec-032-frontera.test.ts` verdes **sin editarlos**; el punto 3 lo congela `tests/runbook-limpieza-preview.test.ts` · CA-7.2 | **Ronda 2.** `git grep -l 'secrets\.'` fuera de `docs/` y `tests/` → **solo** el limpiador. `tests/spec-031-frontera.test.ts` (11) y `tests/spec-032-frontera.test.ts` (19) verdes **sin una linea editada** (`git diff` contra `origin/main` sobre esos ficheros: vacio). Ruleset `Protected main` comprobado vivo: contextos `E2E` y `Checks`, bypass vacio. **La lectura de CA-6.2 no se ha tocado**: sigue siendo la que juzgue legitima en la ronda 1. | ✅ |
| 🔒 CA-7 el runbook cuenta la trampa, la solución y su contrapartida (§6, §9, §13, §13.3) | `docs/despliegue.md`: §6 (gotcha nuevo), §9 (tabla de los tres workflows), §13 (filas de ops 7, 8 y 9), §13.3 **reescrita**. Ronda 2 (F-2): §13.3 ya **no** dice *"con tres entradas y ni una línea de shell"* ni *"eso es lo que acota el peor caso"*. Dice que la acción es composite y **sí** ejecuta bash por dentro, que sin filtro el peor caso era ejecución de comandos con la clave, que lo que acota el peor caso es el **filtro de caracteres** más el prefijo literal, y **qué cuesta el filtro** (`F-SPEC-042-7`). **Ronda 3 (N-1)**: la línea de diagnóstico decía que un job saltado *«no aparece en Actions»* — es **falso**, y comprobado contra la API de GitHub, no discutido: el evento crea la ejecución y el `if` se evalúa después, a nivel de job. §13.3 dice ahora lo que de verdad se ve (ejecución **completada, en gris, `skipped`, el job sin un solo paso**) y **distingue los dos *fail-closed*** del apartado: el del filtro *y en silencio*, el de las variables de ops *y en rojo* | `tests/runbook-limpieza-preview.test.ts` · CA-7.1–7.6, troceando el documento por secciones, **más el bloque O-2 (5 casos)** que congela el filtro, su coste, la frase de diagnóstico correcta y la distinción de los dos *fail-closed* | **F-2 CERRADO en los tres artefactos, y sin borrar la explicacion** — que era lo que importaba para que nadie lo reintroduzca «simplificando». §13.3 perdio *«ni una linea de shell»* y gano una viñeta que dice que **este runbook lo dio por bueno** y por que es falso a medias. Los seis subpuntos de CA-7 siguen ahi y siguen siendo ciertos (citas de Neon literales, aritmetica, §9 afirmando la ausencia de secretos **solo** de la CI de las PR). **N-1**, no bloqueante: una frase añadida por encima de CA-7 —*«no aparece en Actions»*— es falsa; ver el veredicto. | ✅ |
| 🚀 CA-8 al cerrar la PR, la rama desaparece de Neon y el recuento baja en una | `.github/workflows/neon-preview-cleanup.yml` | **no testeable desde el repo** — evidencia abajo. Bloqueado por F-SPEC-042-1 y F-SPEC-042-2 | **No cerrado, y es lo unico que impide `hecho`.** Sin cambios respecto a la ronda 1: los dos valores de ops existen (`gh variable list` / `gh secret list`), el disparador `pull_request` usa el workflow **de la rama de la PR**, y la rama de esta PR no lleva ninguno de los tres caracteres de `F-SPEC-042-7`, asi que el job **se ejecutara** al cerrar. Falta el cierre real y su evidencia. | 🚧 |
| 🚀 CA-9 comportamiento ante una rama inexistente, medido y escrito | hueco escrito en `docs/despliegue.md` §13.3 (*"lo que aún no se sabe"*), a la espera del dato, **más el comando que lo responde y qué hacer con cada resultado** (ronda 2, F-3) | **no testeable desde el repo, pero YA NO DEPENDE DE CA-8.** No necesita una PR cerrada ni un *Re-run*: necesita la credencial, que existe desde el 2026-08-20. Lo responde, sin tocar nada, `neonctl branches delete preview/no-existe-jamas --project-id orange-lab-24079923` — **corrible antes de mezclar**. Verde ⇒ la acción se traga la rama inexistente, no habrá falsos rojos, CA-9 cerrado. Rojo (lo esperable: `neonctl` resuelve el nombre a un id) ⇒ este limpiador dará rojo en **toda PR cerrada sin preview**, hay que saberlo **antes** del merge y se abre follow-up en el acto. En ninguno de los dos casos se pone `continue-on-error` (CA-5.5, congelado en `tests/neon-preview-cleanup-workflow.test.ts` · 5.5). El implementador **no puede ejecutarlo**: la clave no está en el entorno local y no se pide | **F-3 CERRADO en el planteamiento; el dato sigue sin tomarse.** CA-9 ya **no depende de CA-8**: la fila y §13.3 traen el comando exacto, que significa cada resultado y que hacer con el, y el handoff lo pone como **paso 1, antes del merge**. Verifique que **no** se ha puesto `continue-on-error` , ni encadenado que se trague el codigo de salida, ni `always()`. Queda ejecutarlo: es del humano, la clave no esta en el entorno local. | 🚧 |
| 🚀 CA-10 nada que no fuera una preview se tocó (`main` sigue ahí) | prefijo `preview/` literal en `.github/workflows/neon-preview-cleanup.yml` | **no testeable desde el repo** — comparación de las dos listas del panel de Neon | **No cerrado.** Depende de CA-8. La evidencia prevista (dos listas de **nombres**, antes y despues) sigue siendo la correcta. | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### 🟢 GREEN del bloque 🔒 — ronda 2, 2026-08-20, sdd-verificador

**Recuento, separando los dos bloques:**

- 🔒 **Bloque A (CA-1 … CA-7): 7 ✅ · 0 ⚠️ · 0 ❌.** Los dos findings del RED están cerrados, y
  cerrados **bien**: no solo cumplen la letra, cumplen la propiedad. Verifiqué los siete de nuevo,
  no solo los dos que fallaban; la corrección **no rompió ninguno**.
- 🚀 **Bloque B (CA-8, CA-9, CA-10): 0 ✅ · 3 🚧.** CA-9 queda **desatado** de CA-8 y es medible
  hoy con un comando. CA-8 y CA-10 siguen esperando el primer cierre real.

**Veredicto de estado: la spec NO pasa a `hecho`.** Mantengo el criterio de la ronda 1: su
observable central —una rama de Neon desapareciendo— no se ha visto **nunca**. Queda en
`en-revision`. Qué la cierra, en §«Qué falta para `hecho`».

**Los seis gates, corridos por mí sobre `0addfaf`** (árbol rebasado sobre el `origin/main` nuevo,
`124085a`): `typecheck` 0 · `lint` 0 · `test` **1207/1207** en 86 ficheros · `build` 0 ·
`test:e2e` **214/214** · `db:scan` 0. Sin choque con la sesión paralela.

---

#### F-1 — CERRADO. El filtro es correcto, completo y no excesivo; lo derivé yo, aparte

No me fié de que el arreglo fuera el que propuse: **volví a derivar el conjunto desde cero**,
exhaustivamente sobre los **95 ASCII imprimibles**, cruzando dos preguntas por carácter:

1. ¿lo acepta `git check-ref-format` en `refs/heads/ft/a<c>b`? (o sea, ¿puede llegar de verdad en
   un `github.head_ref`?)
2. ejecutando el **cuerpo literal del `run:`** de `neondatabase/delete-branch-action@v3` con el
   nombre ya sustituido, ¿sale el argumento **idéntico** al de entrada, o bash reacciona?

Resultado, sin ambigüedad:

```
git ACEPTA  '"' -> ROMPE-LA-SINTAXIS
git ACEPTA  '$' -> ARG=<preview/ft/a>      (expansión: el resto desaparece)
git ACEPTA  '`' -> ROMPE-LA-SINTAXIS
CONJUNTO PELIGROSO REAL = ['"', '$', '`']
```

Y los que bash trataría como especiales pero **git rechaza en una ref**, así que no llegan nunca:
`espacio`, `*`, `:`, `?`, `[`, `\`, `^`, `~`.

**El filtro del `if` bloquea exactamente `$`, `` ` `` y `"`. Ni uno de menos —no queda vector— ni
uno de más** —`;`, `&&`, `|`, `>`, `<`, `!`, `#`, `'`, `{}` quedan literales dentro de las
comillas dobles, y excluirlos solo dejaría más ramas sin barrer—. Es el conjunto mínimo correcto.

**El `if` parseado, tal y como lo lee el YAML:**

```
github.event.pull_request.head.repo.full_name == github.repository
  && !contains(github.head_ref, '$')
  && !contains(github.head_ref, '`')
  && !contains(github.head_ref, '"')
```

Un job, un step, **sin `if` de step** que pueda saltarse al del job (comprobado sobre el YAML
parseado, no sobre el texto).

**El test 4.5 ata la propiedad, no el texto**, y esto era lo importante:

- (a) le **pregunta a `git check-ref-format` en tiempo de ejecución** cuál de los cuatro
  especiales de bash acepta, y exige que el filtro sea exactamente los que pasan. Si git aflojara
  con la barra invertida, este caso se pone rojo solo. Eso es una derivación ejecutada, no un
  literal congelado.
- (b) extrae la interpolación **de `with.branch`** y exige el `!contains` sobre **esa misma
  expresión**: cambiar `branch` a otra fuente sin mover el filtro pone el test rojo.
- (c) cuenta los `&&` (tres, ni uno más) y exige que la condición de fork **siga** ahí: impide
  cambiar una defensa por la otra o colar un `||`.
- (d) prohíbe un `if` de step.

Lo único que un test estático no puede hacer es **evaluar una expresión de GitHub Actions**. No
hay forma de cerrar ese milímetro desde Vitest, y lo que rodea al milímetro está atado.

**¿Queda vector abierto? Los revisé todos, y no desde el `if` hacia fuera sino desde el `run:` de
la acción hacia dentro** — que es donde el dato acaba:

| Entrada que la acción interpola en su bash | ¿Comillas? | ¿Puede controlarla quien abre una PR? |
|---|---|---|
| `inputs.branch` = `preview/${{ github.head_ref }}` | dobles | **Sí** → es la que se filtra. Cerrada |
| `inputs.project_id` = `${{ vars.NEON_PROJECT_ID }}` | **SIN comillas** | **No**: es una *variable de repositorio*, y ponerla exige permiso de admin. El workflow lleva `permissions: {}`, así que no puede escribirla él. Quien pudiera cambiarla ya puede editar el workflow entero |
| `inputs.branch_id` | **SIN comillas** | **Inalcanzable**: es la rama `then` de `if [ -z "<branch>" ]`, y `branch` **nunca** es vacía porque lleva el prefijo literal `preview/`. Además CA-3.4 prohíbe pasarla |
| `inputs.api_key`, `inputs.api_host` | solo en `env:` | No se interpolan en el texto del script |

O sea: la interpolación sin comillas de `project_id` **existe y conviene tenerla escrita**, pero
**no es un vector en este modelo de amenaza** — no hay camino desde una PR hasta ella. La
concurrencia usa `github.event.pull_request.number`, que es un número y no toca ninguna shell.

**Lo que sí queda, y ya está declarado**: la corrección del conjunto de tres depende de **cómo
entrecomilla la acción**, y la acción está clavada a `@v3`, un tag **móvil** (hoy
`4468d825d5a88ef4012f1705a82f02ec3072f776`, sin mover desde la ronda 1). Si Neon pasara a comillas
simples, el carácter peligroso sería `'` y el test 4.5 **no se enteraría**: deriva de las reglas de
*git*, no del entrecomillado de la acción. Está escrito como `F-SPEC-042-7` punto 3 y como O-1.
Cerrarlo exige enmendar CA-3.1 → no es de este ciclo.

#### F-2 — CERRADO en los tres artefactos, y la explicación **no se ha borrado**

Que es lo que importaba: un borrado limpio habría dejado el camino abierto para que alguien
reintrodujera el problema «simplificando».

| Artefacto | Cómo ha quedado |
|---|---|
| `.github/workflows/neon-preview-cleanup.yml`, comentario del step | Parte en dos lo que la ausencia de `run:` **sí** compra (no hay shell **nuestra** donde el secreto se imprima) y lo que **no** compra (que el nombre de rama no llegue a un intérprete), dice que la acción es *composite* y que quien impide la inyección es el filtro, no la ausencia de `run:`. Abre con *«para que nadie lo vuelva a "simplificar"»* |
| `tests/…-workflow.test.ts`, comentario de 4.3 | Igual, y **fecha el error**: *«se creyó que sí hasta el 2026-08-20»*. El bloque 4.5 lleva encima la reproducción completa del fallo |
| `docs/despliegue.md` §13.3 | Cayó *«ni una línea de shell»*. Hay una viñeta nueva, *«Cuidado con el argumento "no tiene ni un `run:`"»*, que dice que **este runbook lo dio por bueno** y por qué es falso a medias |

El comentario del `if` del job explica además **por qué el filtro va en el job y no en el step**
(«cuando llega a este step ya es tarde»), que es justo lo que evita que alguien lo mueva.

#### F-3 — CERRADO. CA-9 desatado de CA-8

En la matriz y en §13.3, con el comando exacto (`neonctl branches delete preview/no-existe-jamas
--project-id orange-lab-24079923`), **qué significa cada resultado** y qué se hace con él, y
colocado como **paso 1** del handoff, delante del merge. Verifiqué que **no** se ha puesto
`continue-on-error` (ni `|| true`, ni `always()`): CA-5.5 sigue intacto y su test también.

#### N-1 (NO bloqueante, pero corregir antes de mezclar) — una frase de la declaración del hueco es falsa, y es justo la que se usará para diagnosticar

La declaración de `F-SPEC-042-7` es **honesta**, no maquillaje: ver §«El hueco nuevo». Pero dice,
en el ledger y en §13.3:

> «Es silencioso. Un job saltado por su `if` no pinta rojo: **no aparece en Actions**. Si una PR
> cerrada **no dejó rastro**, el primer sitio donde mirar es el nombre de su rama.»

La primera mitad es correcta. **La segunda es falsa, y del modo que más estorba**: el disparador
`pull_request: [closed]` no tiene filtros de rama ni de ruta, así que el evento **crea la
ejecución**; el `if` se evalúa **después**, a nivel de job. La ejecución **sí aparece** en Actions
—con su job saltado y una conclusión que no es roja—; `skipped` es un estado listable de la API de
runs de GitHub, no una ausencia. El operador que siga esta frase verá una ejecución en Actions,
concluirá que el limpiador corrió, y **nunca mirará el nombre de la rama** — que es exactamente lo
contrario de lo que la frase pretende.

Corrección sugerida, misma longitud: *«Es silencioso. Un job saltado por su `if` no pinta rojo: la
ejecución **aparece en Actions con el job saltado**, que se lee igual que un éxito. Si una PR
cerrada dejó una ejecución sin trabajo hecho, el primer sitio donde mirar es el nombre de su
rama.»*

No lo cuento como ⚠️ de ningún CA porque no lo es: los seis subpuntos de CA-7 están y son ciertos,
y esta frase es prosa **añadida** por encima de lo que CA-7 pide. Pero con `protegeVerdad` activo
es una frase falsa en el runbook, y encima es la línea de diagnóstico.

#### O-2 (observación) — el hueco nuevo no lo congela ningún test

Todo lo demás de §13.3 lo congela `tests/runbook-limpieza-preview.test.ts`. La viñeta del filtro,
la del coste (`F-SPEC-042-7`) y el comando de CA-9 son **prosa nueva sin test**: se pueden borrar
sin que nada se ponga rojo. No es un incumplimiento —CA-7 es anterior a todo esto— pero es
asimétrico con el resto del documento.

---

### El hueco nuevo (`F-SPEC-042-7`): la declaración **es honesta**

Se le pidió que no lo maquillara y no lo maquilla. Lo compruebo punto por punto:

- **Lo nombra y le da ID**, en el ledger y en §13.3, en vez de dejarlo implícito.
- **Dice lo incómodo con todas las letras**: *«Es silencioso. Un job saltado por su `if` no pinta
  rojo»*. Era la pregunta exacta, y la responde de frente.
- **Dice la consecuencia**: la rama de Neon **queda huérfana** hasta que alguien la borre a mano.
- **Dice que puede ocurrir sin malicia**, y por qué en este proyecto en concreto: los nombres de
  rama los generan agentes desde títulos de spec, y ahí un `$` cabe sin que nadie ataque nada.
- **No se escuda en que sea poco probable**, y **declara cuál sería la salida limpia** —sanear el
  nombre en vez de descartarlo, o dejar de depender de una acción que interpola en bash— y por qué
  no se hace aquí: exige enmendar CA-3/CA-4.
- **Cuantifica el intercambio** sin adornarlo: no barrer una rama cuesta un hueco de diez; ejecutar
  código con esa clave cuesta el proyecto.

Dos matices, ninguno descalificador: (1) la frase de N-1; (2) llamarlo *«fail-closed»* mete en el
mismo saco este caso —que falla **en silencio**— y el de las variables de ops que faltan —que
falla **en rojo**—, dos párrafos más abajo en el mismo documento. Son comportamientos opuestos
bajo la misma etiqueta; conviene no reusar el término para el silencioso.

### Los cinco CA que no debían moverse: no se movieron

- **CA-1** — `ci.yml` y `deploy-gate.yml` **idénticos al `origin/main` de ahora** (`124085a`), y no
  «por diff»: los **blobs de git coinciden** —`34b47942…` y `dcd8713f…` en ambos lados—, que es la
  comparación que no admite interpretación. El limpiador sigue siendo el tercer fichero.
- **CA-2** — `on = {"pull_request":{"types":["closed"]}}`, una sola clave; cero
  `pull_request_target` en todo el fichero, comentarios incluidos; ningún `if` sobre `merged` (el
  `if` del job creció, pero solo con los tres `!contains`).
- **CA-3** — `with` sigue siendo exactamente `project_id`, `branch`, `api_key`. Revolví la fuente
  otra vez: `v3` **sigue** en `4468d825…`, la acción no está archivada ni deshabilitada.
- **CA-5** — `permissions: {}`, `timeout-minutes: 10`, grupo `neon-preview-cleanup-…` distinto de
  los otros dos, `cancel-in-progress: false`, y **la condición de fork sigue dentro del `if`** —el
  filtro se **suma**, no sustituye—. Sin `continue-on-error`, sin `always()`.
- **CA-6** — `git grep -l 'secrets\.'` fuera de `docs/` y `tests/` → **solo** el limpiador. Los
  tests de frontera de SPEC-031 y SPEC-032 verdes **sin una línea editada** (`git diff` sobre esos
  ficheros contra `origin/main`: vacío). Y **la lectura de CA-6.2 no se ha tocado**: sigue siendo
  la que juzgué legítima en la ronda 1.
- **Intocables** — `src/`, `package.json`, `package-lock.json`, `next.config.mjs`, `vercel.json`,
  `tsconfig.json` y los tests de otras specs: `git diff origin/main...HEAD` sobre esa lista
  devuelve **vacío**.

### Nada se salió del encargo

Los cinco ficheros de la ronda 2 son los que tocaba: el workflow, su test, el runbook, el ledger y
—solo el frontmatter— la spec, con las dos transiciones de estado (`en-progreso` por
sdd-orquestador, `en-revision` por sdd-implementador). Ni una línea del cuerpo de la spec.

### Qué falta para `hecho`

1. **CA-9, y va primero**: `neonctl branches delete preview/no-existe-jamas --project-id
   orange-lab-24079923`, **antes** de mezclar. Anotar verde/rojo **y el mensaje literal** en la
   fila de CA-9 y en §13.3. Si sale rojo, follow-up en el acto. Sin `continue-on-error`.
2. **N-1**: corregir la frase de «no aparece en Actions» en el ledger y en §13.3.
3. **CA-8 y CA-10**: mezclar, cerrar la PR, y pegar el enlace a la ejecución en Actions más las
   **dos listas de nombres** de ramas de Neon, antes y después. La rama de esta PR
   (`ft/SPEC-042-limpieza-automatica-de-ramas-de-preview-en-neon`) no lleva ninguno de los tres
   caracteres, así que el job **se ejecutará**.

Con esas tres cosas la spec es `hecho`. Sin la 3, no: un limpiador cuyo barrido no ha visto nadie
es el mismo acto de fe que esta spec vino a sustituir.

### Lo que NO cambié

No edité código, ni la spec, ni `docs/despliegue.md`, ni ningún test, ni el workflow. Solo esta
mitad del ledger. `_qa/` queda **limpio** (`git checkout -- _qa/` tras el e2e).

---

<details>
<summary><strong>Ronda 1 — el RED que abrió F-1, F-2 y F-3 (se conserva entero: es el registro de por qué el filtro existe)</strong></summary>

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


</details>

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
  mano. Es *fail-closed* **y en silencio** —a diferencia del otro *fail-closed* de §13.3, el de
  las variables de ops que faltan, que **pinta rojo**: no barrer una rama cuesta uno de los diez
  huecos del techo; ejecutar código con la única clave de borrado del proyecto cuesta el
  proyecto—, pero tiene tres consecuencias que hay que tener escritas:
  1. **Es silencioso, pero NO invisible — y la diferencia es justo la que se usa para
     diagnosticar.** El disparador `pull_request: [closed]` no tiene filtros de rama ni de ruta,
     así que el evento **sí crea la ejecución**; el `if` se evalúa después, **a nivel de job**.
     En Actions **aparece** una ejecución completada, en gris, con conclusión `skipped` y el job
     **sin un solo paso**: no pinta rojo, no bloquea nada y de un vistazo se pasa por buena.
     Comprobado el 2026-08-20 contra la API de GitHub, no recordado: `?status=skipped` es un
     filtro válido de `/actions/runs` y devuelve ejecuciones reales — p. ej.
     `vercel/next.js` run `28138702764`, evento `pull_request`, sus **nueve** jobs `skipped` con
     **cero pasos** cada uno. Así que **la señal no es que falte la ejecución, sino que la
     ejecución no hizo nada**: si una PR cerrada dejó una ejecución sin trabajo hecho, el primer
     sitio donde mirar es el nombre de su rama.
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
**Ronda 3 (2026-08-20), tras el GREEN 7/7.** No es una ronda de RED: se cierra **N-1** —una frase
falsa en un documento de verdad, con `protegeVerdad` activo— y su matiz hermano, y se decide **O-2**.
Nada de los siete CA verdes cambió de forma: el `if` sigue siendo la condición de fork más los tres
`!contains`, `permissions: {}`, `timeout-minutes`, el grupo de concurrencia, `pull_request:
types: [closed]` como único disparador y las tres claves de `with` están intactos, y el bloque 4.5
no se tocó. `ci.yml` y `deploy-gate.yml` siguen byte a byte como `origin/main`.

- **N-1 — comprobado antes de adoptar la corrección, no dado por bueno.** La frase decía que un
  job saltado por su `if` *«no aparece en Actions»*. Lo verifiqué contra la **API de GitHub**, que
  es donde el comportamiento se puede mirar sin cerrar una PR:
  1. `GET /repos/{owner}/{repo}/actions/runs?status=skipped` es una consulta **válida** y
     devuelve ejecuciones reales (`vercel/next.js` → `total_count=51542`; `microsoft/vscode` →
     `27954`). Si `skipped` fuera una ausencia, no habría nada que listar.
  2. Un caso exacto del mismo tipo que el nuestro —evento `pull_request`, sin filtros de rama ni
     de ruta, jobs saltados por su `if`—: `vercel/next.js` run **`28138702764`**
     (`build-and-deploy`), `status: completed`, `conclusion: skipped`, y sus **nueve** jobs con
     `conclusion: skipped` y **cero pasos** cada uno. La ejecución existe, está listada y tiene
     URL propia.
  3. En este repositorio no había ningún `skipped` con el que comparar (las 50 últimas
     ejecuciones son `success`), así que la evidencia se tomó fuera a propósito.

  **El matiz sí era otro, y por eso el texto no es el sugerido palabra por palabra.** La
  corrección propuesta decía que la ejecución *«se lee igual que un éxito»*, y eso concede de
  más: no se ve un ✔ verde, se ve un icono **gris** de `skipped`. Lo cierto —y lo que se ha
  escrito— es que **no pinta rojo, no bloquea nada y de un vistazo se pasa por buena**, que es
  la propiedad de la que se sigue el consejo de diagnóstico. Y el consejo se invirtió donde
  tenía que invertirse: la señal **no es que falte la ejecución**, sino que la ejecución **no
  hizo nada**.

  **La idea estaba copiada en dos artefactos, no en tres.** Se corrigió en `docs/despliegue.md`
  §13.3 y en `F-SPEC-042-7` punto 1 de este ledger. **No** estaba en
  `.github/workflows/neon-preview-cleanup.yml` ni en `tests/neon-preview-cleanup-workflow.test.ts`
  ni en `tests/runbook-limpieza-preview.test.ts` —comprobado por búsqueda sobre el árbol
  entero—; al workflow se le **añadió** el diagnóstico correcto en el comentario del `if`, que
  es donde aterriza quien investigue por qué su rama no se barrió. La cita de la frase falsa que
  hay en el veredicto del verificador **no se toca**: es su acta.

- **El *fail-closed*, distinguido sin inventar terminología.** §13.3 usaba la misma etiqueta
  para dos comportamientos opuestos. Ahora el del filtro es *fail-closed* **y en silencio**
  («de los dos de este apartado es el que **no avisa**») y el de las variables de ops que faltan
  es *fail-closed* **y en rojo** («**este sí avisa**, aquel no»). Misma distinción en el
  comentario del workflow y en `F-SPEC-042-7`.

- **O-2 — decisión: se congela casi todo, y se dice qué no y por qué.** `tests/runbook-limpieza-preview.test.ts`
  gana el bloque **O-2** (5 casos, mutation-tested: se reintrodujo la frase falsa y la etiqueta
  única, y cada uno pintó rojo por su motivo). Congela: los tres caracteres del filtro y por qué
  llegan a una shell; lo que cuesta, con su `F-SPEC-042-7`; que §13.3 **no vuelva** a decir que
  un job saltado no aparece en Actions; lo que sí se ve (`skipped`, sin trabajo hecho, mirar el
  nombre de la rama); y que los dos *fail-closed* se distingan. **Lo que NO se congela, a
  propósito: el comando de CA-9 y sus dos ramas** («si sale verde» / «si sale rojo»). Ese texto
  está escrito para ser **sustituido** por el veredicto antes de mezclar; un test sobre él
  tendría que editarse en el mismo commit que lo responde —un test que pide permiso en vez de
  proteger algo—. Lo que sí sobrevive al veredicto, que §13.3 declare el hueco de CA-9, ya lo
  congelaba el caso 7.4. El motivo queda aquí escrito y también en la cabecera del bloque O-2
  del test.

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
