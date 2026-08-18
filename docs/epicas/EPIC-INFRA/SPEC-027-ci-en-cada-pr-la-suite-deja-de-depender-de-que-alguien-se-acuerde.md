---
id: SPEC-027
tipo: spec
epica: EPIC-INFRA
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-08-18, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-18, por: Alberto Fojo}
---
# SPEC-027 — CI en cada PR: la suite deja de depender de que alguien se acuerde

> Origen: **F-SPEC-026-1**, abierto por el arquitecto de SPEC-026 ("no hay CI: la única
> detección posible hoy es la que corra dentro de `npm test`, y depende de que alguien la
> ejecute — es el hueco que más me preocupa después de este"). Priorizado por el humano el
> 2026-08-18 como lo más importante de la cola. Implementa el punto **1** del desglose de
> **ADR-018** (*despliegue continuo*), que es el único paso sin secretos y sin poder tocar
> nada gestionado.

## Problema

**El proyecto no tiene CI.** `.github/` no existe ni en el árbol ni en `origin/main`
(verificado hoy: la API de GitHub devuelve `{"total_count": 0, "workflows": []}`). Toda la
red de seguridad —**282 unitarios** en 31 ficheros, **27 e2e** de Playwright en 8, typecheck,
lint y build— **depende de que una persona se acuerde de ejecutarla antes de mezclar**.

No es teórico. En las últimas 48 horas se han mezclado **tres PR** (SPEC-024, SPEC-025,
SPEC-026) sin que ninguna máquina verificara nada. Se verificaron porque el ciclo tremen-sdd
lo exige y hubo un rol dedicado a hacerlo; pero **nada lo impone**: el mismo repositorio
acepta exactamente igual un merge sin verificar, y no queda rastro de la diferencia.

Y hay una vuelta de tuerca que hace este hueco peor de lo que era la semana pasada. Acaba de
entrar **SPEC-026**, cuya razón de ser es una **guardia automática** contra el olvido de
`db:generate` — el fallo que nadie ve porque `onDelete` no tiene efecto en runtime. Esa
guardia vive **dentro de `npm test`** (así se diseñó a propósito: no había CI donde ponerla).
Es decir: la defensa contra los verdes mudos hereda exactamente la misma fragilidad que vino
a corregir. **Protege solo si alguien la ejecuta.**

Agravante de calendario: la app se va a compartir con **testers externos**
(`docs/fundacion/contexto.md`, y `docs/despliegue.md` §2 ya dimensiona el free tier de Resend
"suficiente para el MVP de testers"). El coste de una regresión mezclada sin querer deja de
ser "me molesta a mí" y pasa a ser "se lo enseño a gente".

### Lo verificado el 2026-08-18 en este worktree (medido, no supuesto)

| Hecho | Cómo se comprobó |
|---|---|
| **No hay CI ni workflow alguno.** Actions **sí está habilitado** en el repo (`allowed_actions: all`), sin restricción de acciones. | `ls -a`, `gh api repos/tremen-dev/stockeiro/actions/workflows` y `.../actions/permissions` |
| **Ni protección de rama ni *rulesets* están disponibles en este plan.** Ambos endpoints responden **403 — "Upgrade to GitHub Pro or make this repository public"**. El repo es privado y la org `tremen-dev` está en plan **free**, 1 asiento. | `gh api .../branches/main/protection`, `.../rulesets`, `gh api orgs/tremen-dev` |
| `npm run build` **pasa con variables de juguete**: `DATABASE_URL` sintética, `AUTH_SECRET` inventado. No hay conexión a ninguna base durante el build. **41 s** (caché templada). | ejecutado |
| `npm test` (Vitest) → **282/282 en 31 ficheros**, **145 s** con 16 núcleos, **sin `DATABASE_URL`** en el entorno y sin `.env` en el árbol. | ejecutado |
| `npx tsc --noEmit` → limpio, **10 s** (incremental). `npx eslint .` → **0 errores**, **1 warning** preexistente (`tests/position.test.ts:7`, import sin usar), **11 s**. | ejecutado |
| **No existen los scripts `lint` ni `test:e2e`** en `package.json`. Hoy se invocan a pelo (`npx eslint .`, `npx playwright test`), que es justamente cómo CI y local empiezan a divergir. | `package.json` |
| **El e2e exige un `next build` previo**: `tests/e2e/server.mjs` lanza `npx next start`. No es un detalle: es lo que ordena el pipeline. | lectura del launcher |
| **El e2e correrá en Linux**: `@embedded-postgres/linux-x64` está en `package-lock.json` (`os: linux`, `cpu: x64`, `optional: true`, **`hasInstallScript: true`**). | `package-lock.json` |
| **La versión de Node diverge ya**: local **22.19.0**, Vercel ejecuta **24.x** (verificado en ADR-018 el 2026-08-17). No hay `.nvmrc` ni `engines` en el repo: **nadie ha fijado ninguna**. | `node -v`, ADR-018, `package.json` |
| **`_qa/` está versionado** (11 carpetas de capturas, evidencia de ledgers) y el e2e **lo reescribe** al correr. `test-results/` y `playwright-report/` están en `.gitignore`. | `git ls-files _qa`, `.gitignore` |
| `playwright.config.ts` tiene `trace: 'off'` y **no fija `forbidOnly`**: hoy un `test.only` olvidado dejaría el e2e verde habiendo corrido **un** test. | lectura de la config |
| La suite e2e son **27 tests en 8 ficheros**, `workers: 1`, sin paralelismo. | `npx playwright test --list` |

### Lo que ya está resuelto y no hay que rehacer

ADR-018 **D-4** pide que el CI incluya *"el estreno de las migraciones desde cero"*. **Eso ya
lo entregó SPEC-026** y conviene decirlo para no especificar dos veces lo mismo:
`makeTestDb()` aplica `drizzle/` sobre PGlite en cada arnés unitario, `tests/schema-source.test.ts`
aplica los `.sql` uno a uno en orden de journal sobre una PGlite limpia, y
`tests/e2e/server.mjs` corre `migrate()` sobre un **Postgres 17 real y efímero**. Cada pasada
de la suite estrena la cadena entera de migraciones. Lo que falta no es el estreno: es que
**algo lo ejecute sin que se lo pidan**.

### Encaje en la épica

EPIC-INFRA nombra explícitamente *"**CI** y salud técnica del proyecto"* dentro de su alcance,
y su **R-1** declara la suite E2E/Playwright como *red de no-regresión* para las subidas de
versión. Hoy esa red es una red que hay que acordarse de tender.

## Usuarios / roles afectados

- **El humano que mezcla.** Hoy su única garantía es su memoria y la palabra del verificador.
  Después: un check en la PR, y —este es el requisito explícito, ver §Decisión— **el nombre
  del paso rojo le dice qué se ha roto sin abrir un log**.
- **sdd-verificador.** No lo sustituye (ADR-018: *"el CI no sustituye al verificador"*), pero
  deja de ser el único sitio donde se ejecuta la suite. Y le da algo que hoy no tiene: una
  ejecución en una máquina **que no es la suya**, sin `.env`, sin caché templada y sin las 47
  cosas que funcionan en local por casualidad.
- **sdd-implementador.** Recibe el rojo antes del gate, no en él.
- **Usuario final / testers (indirecto).** Son quienes pagan una regresión mezclada sin querer,
  y son los que están a punto de llegar.

## Decisión de diseño

Un workflow de GitHub Actions, `.github/workflows/ci.yml`, con **dos jobs paralelos** y **un
step por gate**, que corre en cada PR contra `main` y en cada push a `main`, **sin un solo
secreto**.

### Por qué dos jobs y no uno (requisito explícito del humano, argumentado)

El humano pidió *"varios steps, no uno solo con muchos pasos dentro; me ayuda a ver el
estado"*. El requisito de fondo es **leer el estado de un vistazo**, y se cumple en dos niveles
que se suman:

- **Steps con nombre por gate** (`Typecheck`, `Lint`, `Unit tests`, `Build`,
  `End-to-end tests`): dentro de un job, GitHub marca en rojo **el step** que falló y lo
  muestra en la lista sin desplegar el log.
- **Dos jobs**: en la lista de checks de la PR aparecen como **dos entradas separadas**
  (`CI / Checks` y `CI / E2E`). El primer bit de información —*"¿se rompió la lógica o el
  flujo?"*— llega antes incluso de entrar al job.

Y el corte en dos no es estético, lo dicta una dependencia real:

1. **El e2e necesita andamiaje que los demás gates no necesitan**: navegador de Chromium
   (~130 MB de descarga) y, sobre todo, un `next build` previo, porque `server.mjs` arranca
   `next start`. Meterlo todo en un job serializa ~2 min de preparación delante de un
   typecheck que tarda 10 s.
2. **Tiempo de pared contra minutos facturados.** Un job único ≈ **11-14 min de pared**; dos
   jobs ≈ **7-9 min de pared** y ≈ **13-16 min facturados** (el `npm ci` se paga dos veces).
   Con repo privado en plan free (**2.000 min/mes**) eso son ~125-150 pasadas al mes: sobra.
   Se compra ~40 % de latencia por ~15 % de cuota, y la latencia es lo que decide si el humano
   espera al check o mezcla sin mirar.
3. **Aislamiento de fallo.** Un `next build` roto no debe teñir de rojo un job que además
   contiene los unitarios; y un e2e escamado no debe esconder que el typecheck estaba limpio.

**Descartado: tres jobs** (typecheck+lint / unitarios / e2e). No mejora el tiempo de pared —lo
fijan los unitarios y el e2e, que quedarían igual— y añade un tercer `npm ci` a la factura. Se
descarta por precio sin beneficio, no por principio.

### Un gate roto no puede ocultar a los demás

Por defecto, GitHub aborta el job en el primer step que falla: si el typecheck se rompe, el
humano **no llega a saber** si además el lint y los unitarios estaban rojos, y arregla a
ciegas de uno en uno. Los tres gates del job `Checks` son **independientes entre sí**, así que
llevan `if: ${{ !cancelled() }}`: todos se ejecutan, cada uno reporta su propio estado, el job
falla igual. Eso es exactamente "ver el estado de un vistazo".

La excepción es deliberada: **`Build` → `End-to-end tests` sí encadena**. Un e2e sin build no
falla, falla *mintiendo* (`next start` sin `.next`), y un rojo sin información es peor que un
step que no corrió.

### Lo que el CI no puede hacer, por construcción

- **No toca un secreto.** El e2e trae su propio Postgres (`embedded-postgres`) y sus
  proveedores *fake* (`E2E_FAKE_QUOTES`, `E2E_FAKE_SYMBOL_SEARCH`, `E2E_OUTBOX_FILE`, todos
  inyectados por el propio launcher); `next build` solo exige que `DATABASE_URL` **exista** y
  le vale una de juguete (medido hoy). Un CI sin secretos no puede filtrar nada.
- **No migra nada gestionado.** `vercel.json` es configuración *de Vercel*: un runner que
  ejecuta `npm run build` **no** ejecuta el `buildCommand` y por tanto **no** ejecuta
  `db:migrate`. Añadir este workflow **no activa** la trampa de F-SPEC-023-1 (`DATABASE_URL`
  compartida entre Production y Preview): esa se activaría al conectar el repo a Vercel, que
  es otra spec (ADR-018 D-1). Es lo que hace de este paso el primero seguro.
- **No escribe en el repositorio.** `permissions: contents: read`.

## Criterios de aceptación

Cada CA tiene forma verificable. La mayoría se comprueban con un **test estático nuevo**
(`tests/ci-workflow.test.ts`, Vitest) que **parsea el YAML** del workflow — no con regex sobre
el texto, que es la clase de test que parece comprobar y no comprueba; requiere añadir `yaml`
como devDependency (hoy solo hay un `js-yaml` **transitivo** de eslint, del que no se debe
depender). CA-3, CA-9, CA-10, CA-11 y CA-12 exigen además **demostrar el rojo**: un workflow
que solo se ha visto verde no es un gate.

> **Cómo se verifica un workflow sin mezclarlo.** Para el evento `pull_request`, GitHub
> ejecuta el workflow **tal y como está en la rama de la PR**, no el de `main`. Así que la PR
> de esta spec **se verifica a sí misma**: los checks aparecen en ella antes de mezclar. Las
> pruebas en rojo se hacen con commits temporales empujados a esa misma rama y **revertidos**
> antes de mezclar; cada uno queda registrado en el ledger con el enlace a su ejecución.
> (`workflow_dispatch` **no** sirve aquí: solo es invocable si el workflow ya está en la rama
> por defecto.)

- **CA-1 (El workflow existe y se dispara donde debe).**
  Dado un repositorio sin `.github/`,
  cuando se añade `.github/workflows/ci.yml`,
  entonces se dispara en **`pull_request` con base `main`** y en **`push` a `main`**, y en
  ningún otro evento.
  *Verificación*: test estático sobre el YAML + evidencia viva (la ejecución en la propia PR
  y la ejecución del push posterior a mezclar, ambas enlazadas en el ledger).
  *Por qué también en `push` a `main`*: hoy los merges se hacen a mano y nada obliga a pasar
  por una PR; sin el disparador de `push`, lo que entre por otra vía no lo mira nadie. Además
  deja el estado "main está verde" publicado, que es el cimiento de SPEC-028 (despliegue
  automático) y de una eventual protección de rama.

- **CA-2 (Un step por gate, y el nombre basta).**
  Dado el workflow,
  cuando se listan los steps que ejecutan un gate,
  entonces existe **exactamente uno por gate**, con estos nombres: **`Typecheck`**, **`Lint`**,
  **`Unit tests`**, **`Build`**, **`End-to-end tests`**; y **ningún step ejecuta dos gates**
  (el `run` de cada uno invoca un solo script de `package.json`).
  *Verificación*: test estático — el conjunto de nombres presentes es exactamente el esperado,
  y ningún `run` de gate contiene más de uno de los comandos de la lista.
  *Esto es el requisito explícito del humano y no se negocia*: el objetivo es que el nombre del
  step rojo diga qué se rompió sin abrir el log.

- **CA-3 (Un gate roto no oculta a los demás).**
  Dado un commit temporal que rompe **a la vez** el typecheck y el lint,
  cuando corre el workflow,
  entonces **ambos steps aparecen en rojo por separado** y **`Unit tests` también se ejecuta**;
  el job termina en rojo.
  *Mecanismo*: `if: ${{ !cancelled() }}` en `Typecheck`, `Lint` y `Unit tests`.
  *Verificación*: prueba en rojo en la propia PR (commit revertido) + test estático de que los
  tres llevan la condición y de que **`End-to-end tests` no la lleva** (encadena con `Build`
  a propósito).

- **CA-4 (Dos jobs, en paralelo, visibles como dos checks).**
  Dado el workflow,
  cuando se inspecciona,
  entonces declara **dos jobs**: `Checks` (typecheck, lint, unitarios) y `E2E` (build + e2e),
  **sin `needs` entre ellos**, y la PR muestra **dos entradas de check** distintas.
  *Verificación*: test estático (dos jobs, ninguno con `needs`) + captura de la lista de checks
  de la PR en el ledger.

- **CA-5 (El CI no puede hacer daño ni gastarse la cuota).**
  Dado el workflow,
  cuando se inspecciona su YAML,
  entonces se cumplen **todas** estas propiedades, cada una comprobable por separado:
  1. **No aparece ninguna referencia a `secrets.`**. Las variables que el build exige
     (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `APP_BASE_URL`) están escritas en claro
     en el propio fichero con valores **evidentemente falsos** (p. ej.
     `postgres://ci:ci@localhost:5432/ci`).
  2. `permissions` es **`contents: read`** a nivel de workflow.
  3. **Ningún step invoca `db:migrate`** ni `drizzle-kit migrate` (regla dura de ADR-018 D-4:
     el CI nunca apunta una migración a una base gestionada).
  4. **Cada job declara `timeout-minutes`** (≤ 25), para que un `webServer` colgado no queme
     horas de cuota.
  5. Existe `concurrency` por workflow+rama con **`cancel-in-progress` solo en
     `pull_request`** — un push a `main` no se cancela a sí mismo.
  *Verificación*: test estático, una aserción por punto.

- **CA-6 (La versión de Node tiene una sola fuente, y es la de producción).**
  Dado que hoy nadie ha fijado la versión (local 22.19.0, Vercel 24.x, `.nvmrc` inexistente),
  cuando se añade **`.nvmrc`** con la versión,
  entonces el workflow la toma con **`node-version-file: .nvmrc`** y **no escribe ningún número
  de versión en el YAML**.
  *Valor*: **24**, para igualar el runtime de Vercel (ADR-018 D-4).
  *Requisito de implementación, con parada*: la suite completa (typecheck, lint, 282 unitarios,
  build y 27 e2e) debe pasar **en Node 24 y en local** antes de abrir la PR. Hoy está medida en
  **22.19.0** y **no** se ha probado en 24. Si algo se rompe en 24 → **parar y volver al gate**
  con el diagnóstico; **no** forzar y **no** bajar el CI a 22 por la puerta de atrás, porque
  eso reintroduce la deriva que este CA existe para cerrar.
  *Verificación*: test estático (`.nvmrc` existe; el step de setup usa `node-version-file` y no
  `node-version`) + la versión impresa en el log de la ejecución + `node -v` en local pegado en
  el ledger.

- **CA-7 (CI y local ejecutan el mismo comando).**
  Dado que hoy no existen los scripts `lint` ni `test:e2e`,
  cuando se añaden a `package.json` (`"lint": "eslint ."`, `"test:e2e": "playwright test"`),
  entonces **cada gate del workflow invoca `npm run <script>`** de esa lista, y **ninguna
  bandera propia de CI cambia lo que se ejecuta**: las que hay (`--forbid-only`,
  `--trace=retain-on-failure`, `--reporter=list,html`) van tras `--`, son solo de diagnóstico o
  de rigor, y están comentadas en el YAML diciendo por qué.
  *Verificación*: test estático (todo `run` de gate empieza por `npm run` y su script existe en
  `package.json`).

- **CA-8 (Se cachea lo que ayuda; no se cachea lo que engaña).**
  Dado un runner limpio,
  cuando corre el workflow,
  entonces cachea (a) el **directorio de descargas de npm**, vía `actions/setup-node` con
  `cache: npm`, y (b) los **navegadores de Playwright** (`~/.cache/ms-playwright`, con clave
  derivada de `package-lock.json`); y **no cachea `node_modules`** ni `.next/cache`.
  *Motivo, que debe quedar escrito en el propio YAML*: `node_modules` contiene binarios por
  plataforma y paquetes con script de instalación —`embedded-postgres` tiene
  `hasInstallScript: true` y su `@embedded-postgres/linux-x64` **extrae los binarios de
  Postgres al instalar**—; restaurarlo de una caché salta ese script y produce un verde que no
  corresponde a lo instalado. Y `.next/cache` puede enmascarar un fallo de build limpio, que es
  justo lo que este gate viene a detectar.
  *Verificación*: test estático + el ahorro medido (primera ejecución vs. segunda) escrito en
  el ledger.

- **CA-9 (Cuando el e2e falla deja con qué mirar; cuando pasa no deja basura).**
  Dado un e2e en rojo,
  cuando termina el job,
  entonces sube **un artefacto** con `playwright-report/`, `test-results/` (con la traza de los
  tests fallidos, por `--trace=retain-on-failure`) y `_qa/` (las capturas hasta el punto del
  fallo), con **retención de 7 días**; y con el e2e **en verde no sube nada** (`if: failure()`).
  *Verificación*: el mismo commit temporal en rojo de CA-10 sirve — se comprueba que el
  artefacto existe, que se descarga y que la traza **abre**; y que la ejecución verde de la PR
  no tiene artefacto.
  *Nota*: `_qa/` está versionado y el e2e lo reescribe. El workflow **no commitea nada** (CA-5.2
  lo impide), así que la reescritura muere con el runner; subirla como artefacto es su único
  uso legítimo aquí.

- **CA-10 (El e2e no puede pasar en mudo).**
  Dado un `test.only` olvidado en un `.spec.ts`,
  cuando corre el gate `End-to-end tests`,
  entonces **falla** en vez de pasar habiendo ejecutado un solo test (bandera `--forbid-only`;
  hoy `playwright.config.ts` no fija `forbidOnly`, así que sin esto el verde sería falso).
  *Verificación*: prueba en rojo con un `.only` temporal, revertida.
  *Nota*: los unitarios ya están cubiertos sin hacer nada — Vitest desactiva `allowOnly` cuando
  `process.env.CI` está definido, y GitHub Actions siempre lo define.

- **CA-11 (R-1 — La guardia de esquema demuestra que sabe detectar).**
  Dada la guardia de SPEC-026 (`tests/schema-source.test.ts`, CA-6),
  cuando se ejecuta,
  entonces además de comprobar que `drizzle/` está al día ejecuta **la misma invocación de
  `drizzle-kit generate`, con el mismo cwd, el mismo shell y los mismos argumentos, contra un
  directorio de sonda vacío**, y **exige que aparezca al menos un `.sql`**. Si no aparece, el
  test falla con un mensaje que dice **"la guardia no pudo ejecutarse"**, no "hay deriva".
  *Por qué esto y no lo que pedía el follow-up*: es la única comprobación que distingue *"no
  hay deriva"* de *"la guardia no llegó a correr"*, y **no depende de por qué** falle la
  invocación (ruta, binario ausente, argumento renombrado, plataforma distinta). Es el patrón
  que el proyecto ya usa: probar que el detector detecta.
  *Coste medido hoy*: **25 s** la pasada extra, una vez por suite (no por test).
  *Verificación, en los dos sentidos*: en **verde** (el canario genera su `.sql`) y en **rojo**
  (se rompe la invocación a propósito —p. ej. `--schema` a un fichero inexistente— y el test
  debe fallar señalando **la guardia**, no la deriva).

- **CA-12 (R-1 — La guardia deja de apoyarse en una creencia, y se retira el código muerto).**
  Dado el comentario de `tests/schema-source.test.ts:203-206` ("el probe vive DENTRO del repo a
  propósito… drizzle-kit descarta las rutas absolutas… termina con código 0 aunque falle") y la
  inspección `/error|ENOENT/i` de las líneas **228-231**,
  cuando se aplica CA-11,
  entonces **la inspección desaparece** y el comentario se sustituye por lo **medido**:
  1. `drizzle-kit generate` **sí** acepta un `--out` **absoluto** y escribe allí. Comprobado
     hoy en tres formas: absoluto con `/` dentro del repo, absoluto con backslashes de Windows
     a través de `shell: true`, y absoluto al temp del sistema **en otra unidad** (`C:`). Las
     tres generaron el `.sql` en el destino pedido. **La regla "la sonda debe ser relativa" no
     se sostiene**, y congelarla en un test habría fosilizado una superstición.
  2. `drizzle-kit generate` **no siempre sale con 0**: con un `--schema` inexistente sale con
     **1** y escribe el error en **stdout** (no en stderr, al revés de lo que anotó el
     verificador de SPEC-026). Con `execFileSync`, ese caso **ya lanza** y el test ya falla:
     por eso la inspección de stdout era inalcanzable — código muerto, sí, pero por una razón
     distinta de la registrada.
  *Verificación (medición registrada en el ledger, patrón de SPEC-026 CA-8)*: se ejecuta la
  guardia con la sonda en **ruta absoluta** y debe comportarse **igual** — verde sin deriva y
  roja con deriva. Eso demuestra que ya no depende de la forma de la ruta. La sonda se deja
  **relativa** (`node_modules/.cache/…`, ya ignorado por git) porque funciona y no hay motivo
  para moverla; lo que cambia es que **nada depende de ello**.

- **CA-13 (Sin regresión, y con el coste y los tiempos escritos).**
  Dada la suite actual (**282** unitarios en 31 ficheros, **27** e2e en 8, typecheck y lint
  limpios),
  cuando se aplica esta spec,
  entonces **todo sigue verde sin cambiar ninguna expectativa** de ningún test existente, y el
  ledger registra:
  - el incremento de `npx vitest run` por el canario de CA-11 (referencia medida hoy: **145 s**
    antes; **techo aceptable +25 %**; si se pasara, **parar y volver al gate**, no forzar);
  - la duración de **cada job** y los **minutos facturados** de la primera pasada (fría) y de
    la segunda (cachés calientes).
  *Para qué sirve la segunda medición*: es lo que permite responder con datos, y no con
  opinión, si el e2e debe seguir corriendo en cada PR (pregunta 6 del gate de ADR-018).

## Entidades y reglas afectadas

**Ningún cambio de dominio, de esquema ni de comportamiento de la aplicación.** No se toca
`src/`, no hay migración nueva y no se toca ninguna base de datos real. Abrir la PR **no migra
producción**.

### Ficheros

| Fichero | Cambio |
|---|---|
| `.github/workflows/ci.yml` | **Nuevo.** Dos jobs, un step por gate. Único artefacto de CI. |
| `.nvmrc` | **Nuevo.** Una línea: `24`. Fuente única de la versión de Node (CA-6). |
| `package.json` | **`scripts`**: se añaden `"lint": "eslint ."` y `"test:e2e": "playwright test"`. **`devDependencies`**: se añade `yaml` (parser del test estático; trae sus propios tipos). Nada más. |
| `tests/ci-workflow.test.ts` | **Nuevo.** Test estático del workflow: CA-1, CA-2, CA-3 (parte estática), CA-4, CA-5, CA-6, CA-7, CA-8. |
| `tests/schema-source.test.ts` | **Único fichero existente que se toca**, y solo el bloque de CA-6 de SPEC-026: canario (CA-11), retirada de la inspección muerta y reescritura del comentario (CA-12). Ninguna otra expectativa cambia. |
| `docs/despliegue.md` | Nota corta: existe CI, qué mira, y —en voz alta— que **informa pero no impide**, con el motivo real (§Fuera de alcance). |

### Forma del workflow (guía para el implementador, no contrato)

Los CA mandan; esto es el esqueleto que los satisface, para que no haya que redescubrirlo.

- **`Checks`**: `Checkout` → `Set up Node` (`node-version-file: .nvmrc`, `cache: npm`) →
  `Install dependencies` (`npm ci`) → `Typecheck` → `Lint` → `Unit tests`. Los tres últimos con
  `if: ${{ !cancelled() }}`.
- **`E2E`**: `Checkout` → `Set up Node` → `Install dependencies` → `Cache Playwright browsers`
  → `Install Playwright browser` (`npx playwright install --with-deps chromium`; el config solo
  declara el proyecto `chromium`, así que instalar los tres navegadores es tirar minutos) →
  `Build` → `End-to-end tests` → `Upload e2e diagnostics` (`if: failure()`).
- Variables de juguete a nivel de job en `E2E` (medidas hoy contra `npm run build`):
  `DATABASE_URL: postgres://ci:ci@localhost:5432/ci`, `AUTH_SECRET` inventado,
  `AUTH_TRUST_HOST: 'true'`, `APP_BASE_URL: http://localhost:3200`. El launcher del e2e
  **reinyecta las suyas** al proceso hijo, así que estas solo sirven al build.
- El job `Checks` **no necesita ninguna variable**: la suite unitaria pasa hoy sin
  `DATABASE_URL` (medido).
- Nombres de step en inglés (idioma del ecosistema); los comentarios del YAML, en español y
  explicando el **porqué** de cada decisión no obvia (las condiciones `!cancelled()`, la caché
  que no se hace, los valores de juguete).

### Transversal

- Decisión: **ADR-018 — *Despliegue continuo desde main*** (aprobado por el humano el
  2026-08-17), punto **D-4** y punto **1** de su desglose. **Esta spec no necesita ADR nuevo**:
  la decisión ya está tomada y firmada; esto es su ejecución. Contexto: **ADR-018 — *El esquema
  de test es el de producción*** (SPEC-026), cuya guardia se refuerza aquí.
- **Colisión de ids detectada, y no la arregla esta spec**: hay **dos ADR con id `ADR-018`** en
  `docs/adr/` (despliegue continuo y esquema de test). Los dos están `aprobada`. Está reportado
  en §Notas para el gate.
- Épica: **EPIC-INFRA**, alcance *"CI y salud técnica"*; refuerza su **R-1**.
- Identificadores, código y nombres de step en inglés; documentación y comentarios en español.

## Fuera de alcance

Aparcado a propósito, no por descuido.

- **Impedir el merge cuando el CI está rojo.** Es lo más importante de esta sección, así que va
  con su hallazgo delante: **no es un ajuste que el humano pueda activar hoy**. Ni la protección
  de rama clásica ni los *rulesets* están disponibles para un repo **privado** en el plan
  **free** de la organización; ambos endpoints responden hoy `403 — "Upgrade to GitHub Pro or
  make this repository public"`. Es decir: **con el plan actual, esta CI informa y no puede
  impedir**, y esa es la diferencia entre una red y un adorno. Las tres salidas son: pagar
  **GitHub Team** (~4 $/asiento/mes, hoy 1 asiento), hacer **público** el repositorio
  (descartable: app financiera privada), o **asumirlo** y apoyarse en la disciplina del ciclo
  tremen-sdd, que es lo que hay hoy. → **F-SPEC-027-1** (decisión del humano, con coste real).
  *Nota*: ADR-018 da por hecho que *"la barrera es una PR con typecheck, lint, unitarios,
  e2e…"* pero **nunca dice cómo se hace obligatoria**. Este es el hueco; queda registrado, no
  se enmienda el ADR (es inmutable).
- **La guardia `guard-migrate` (ADR-018 D-2) y el escáner de SQL destructivo (D-5.2).** El ADR
  los agrupa con el CI en su punto 1 y desaconseja separarlos *"porque abren una ventana en la
  que existe la automatización sin su contrapeso"*. **Se separan aquí, y el motivo es que esa
  ventana no se abre**: ambos protegen contra builds de Vercel disparados por git, y hoy **no
  hay integración Vercel↔GitHub** (verificado en ADR-018 y sin cambios). Añadir este workflow
  no la crea. La ventana se abriría con D-1 (conectar el repo), que es SPEC-028 — y allí deben
  entrar, **antes** que la conexión. → **F-SPEC-027-2** (bloqueante de SPEC-028).
- **`/api/version` y la comprobación de vida** (ADR-018 D-6, punto 3 del desglose). Es código de
  aplicación con sus propios CA; no se mezcla.
- **Conectar el repo a Vercel y desplegar automáticamente** (ADR-018 D-1). Otra spec, otro
  riesgo, otro gate.
- **BD de Preview separada** (ADR-018 D-3, F-SPEC-023-1). Acción de ops, no spec.
- **Endurecer el lint a `--max-warnings=0`.** Hoy hay **1 warning** preexistente
  (`tests/position.test.ts:7`), así que activarlo dejaría la CI roja el primer día por un import
  sin usar ajeno a esta spec. → pregunta del gate; si el humano dice que sí, entra en la misma
  PR con la línea borrada.
- **Matriz de sistemas operativos o de versiones de Node.** Un solo `ubuntu-latest` con la
  versión de producción. Una matriz multiplica la factura para responder una pregunta que este
  proyecto no tiene (despliega en un único runtime conocido).
- **Cobertura de código, informes, badges, `npm audit` en CI.** Cada uno es un gate más con su
  propia discusión de umbral; ninguno estaba en el follow-up.
- **Tocar el código de la aplicación o los tests existentes**, salvo el bloque de CA-6 de
  `tests/schema-source.test.ts` que exigen CA-11 y CA-12.

## Notas para el gate humano

1. **Tu premisa sobre el residual R-1 no se sostiene, y por eso el CA es otro.** Dijiste que si
   alguien "limpia" la sonda de la guardia a ruta absoluta, `drizzle-kit generate` sale con 0,
   no escribe nada y no imprime nada. **Lo he medido y no ocurre**: con `--out` absoluto escribe
   perfectamente —incluso con backslashes de Windows a través de `shell: true`, e incluso al
   temp del sistema en otra unidad—. Y el otro medio-mito: con un `--schema` inexistente
   **drizzle-kit sale con 1** y escribe el error **en stdout**, no en stderr (la anotación del
   verificador de SPEC-026 también está del revés). Si hubiera escrito el CA que pedías —"un
   test que afirme que la sonda es relativa"— habría **fosilizado una superstición** y, peor,
   habría dado por cerrado un riesgo que seguiría abierto. Lo que sí es verdad y sí importa es
   el riesgo genérico: **una guardia que no llegue a ejecutarse es indistinguible de una guardia
   que no encuentra nada**. Eso lo cierra el **canario** de CA-11, que no depende de ninguna
   teoría sobre por qué podría romperse. Cuesta **25 s** por pasada de suite; es el único precio
   que te pido aprobar aquí.
2. **El hallazgo que cambia el encargo: no puedes activar la protección de rama.** No es que se
   te haya olvidado hacerlo; es que **tu plan no la ofrece**. Repo privado + org en plan free →
   `403 Upgrade to GitHub Pro`, tanto en protección de rama clásica como en *rulesets*.
   Consecuencia dicha sin rodeos: **esta CI informa y no impide**. Sigue mereciendo la pena
   —pasa de "nadie mira" a "la máquina mira y lo publica en la PR"—, pero la decisión de si eso
   basta es tuya y ahora tiene precio: **GitHub Team ronda los 4 $/asiento/mes y tienes 1
   asiento**. Es, con diferencia, la conversión más barata de este proyecto entre dinero y
   seguridad. Está como **F-SPEC-027-1**.
3. **Tu requisito de "varios steps" está cumplido y además subido de nivel.** Cinco steps con
   nombre (`Typecheck`, `Lint`, `Unit tests`, `Build`, `End-to-end tests`), y **dos jobs**, que
   en la PR se ven como dos checks separados. La justificación del corte en dos es técnica, no
   estética: **el e2e necesita un `next build` previo** (`server.mjs` arranca `next start`) y un
   navegador de 130 MB; encadenarlo detrás de todo lo demás pone ~2 min de andamiaje delante de
   un typecheck de 10 s. Precio del corte: el `npm ci` se paga dos veces (~13-16 min facturados
   frente a ~11-14 de un job único), a cambio de bajar la espera de ~12 a ~8 min. Si prefieres
   un solo job, dilo: los CA de nombres de step siguen valiendo tal cual y solo cae CA-4.
4. **Hay una decisión mía que te puede sorprender al ver la PR en rojo: los gates
   independientes se ejecutan todos aunque uno falle.** Por defecto GitHub para en el primero,
   y entonces arreglas a ciegas de uno en uno. Con `if: !cancelled()` verás **todos** los rojos
   a la vez, que es literalmente lo que pediste ("ver el estado"). El efecto secundario: un
   typecheck roto puede arrastrar rojos "de rebote" en los unitarios. Me parece un precio
   pequeño; si te resulta ruidoso, se quita con una línea.
5. **Node 24 es la única pieza que puede tumbar la spec, y quiero que lo sepas antes.**
   ADR-018 (tuyo, firmado) dice Node 24 para igualar a Vercel; tu máquina corre **22.19.0**; el
   repo no fija ninguna versión. Todas las mediciones de esta spec están hechas en **22**, y
   **nadie ha probado la suite en 24**. Si al implementar algo se rompe en 24, la instrucción
   de la spec es **parar y volver al gate** — explícitamente **no** bajar el CI a 22 en
   silencio, porque eso reintroduce la deriva CI↔producción que el CA existe para cerrar.
   Contrapartida honesta: fijar `.nvmrc` a 24 te obliga a **subir tu Node local**.
6. **Lo que este workflow NO despierta, por si te preocupaba.** Añadir `.github/workflows/` no
   conecta nada con Vercel y por tanto **no activa** la trampa de F-SPEC-023-1 (una PR migrando
   producción): eso solo pasa al conectar el repo a Vercel, que es otra spec. Un runner que
   ejecuta `npm run build` **no** ejecuta el `buildCommand` de `vercel.json`, así que **no**
   ejecuta `db:migrate`. Y el CI no lleva ni un secreto: `next build` se conforma con una
   `DATABASE_URL` de juguete (medido).
7. **He partido el punto 1 del desglose de ADR-018 en contra de su propia recomendación, y
   quiero que lo firmes o lo tumbes.** El ADR agrupa CI + `guard-migrate` + escáner de SQL
   destructivo y desaconseja separarlos. Los separo porque el argumento del ADR es *"no dejes
   la automatización sin su contrapeso"* y **aquí no hay automatización que contrapesar**: sin
   integración Vercel↔GitHub, ningún push construye nada. Las dos guardias son prerrequisito de
   **SPEC-028** (conectar el repo), no de esta. Queda como **F-SPEC-027-2**, marcado bloqueante
   de SPEC-028. Si prefieres que entren aquí, la spec crece bastante y con ella el gate.
8. **Colisión de ids que no es de esta spec pero que deberías querer resolver: hay dos
   `ADR-018`.** `ADR-018-despliegue-continuo-…` y `ADR-018-el-esquema-de-test-…`, ambos
   `aprobada`, ambos citados por specs distintas. Un ADR se cita por id; con dos, la cita es
   ambigua para siempre. No lo he tocado (un ADR aceptado es inmutable, y renumerar es decisión
   tuya): dime si quieres que el documentalista lo arregle y cómo.
9. **Estimación de tiempo, para que juzgues la cuota.** Job `Checks` ~6-8 min (los unitarios
   mandan: 145 s en mis 16 núcleos → estimo 4-7 min en los 4 vCPU del runner, y el canario suma
   25 s). Job `E2E` ~6-7 min (instalar navegador ~1 min, build ~1-1,5 min, 27 tests en serie
   ~3-4 min). **Pared ~7-9 min, facturado ~13-16 min.** Con 2.000 min/mes de plan free eso son
   ~125-150 pasadas mensuales: sobra de largo, incluso corriendo el e2e en cada PR (que es lo
   que recomienda ADR-018 y lo que especifico). Todas estas cifras son **estimaciones sobre
   medidas locales**; CA-13 obliga a sustituirlas por las reales del ledger en la primera pasada.
10. **La pregunta abierta pequeña: ¿lint estricto?** Hoy `npx eslint .` da 0 errores y **1
    warning** preexistente y ajeno (`tests/position.test.ts:7`, un import sin usar). Si quieres
    `--max-warnings=0`, entra en la misma PR con esa línea borrada; si no, el gate seguirá
    tolerando warnings y ese hilo se irá alargando. Mi inclinación: **sí, estricto**, borrando
    esa línea — un gate que tolera avisos deja de leerse a los tres meses. Es tu llamada porque
    toca un test existente, y me pediste no tocarlos.

---
*Historial de la spec: redactada el 2026-08-18 a partir de F-SPEC-026-1, con investigación
medida en este worktree (build, typecheck, lint y suite unitaria ejecutados; `drizzle-kit
generate` probado con `--out` relativo, absoluto, con backslashes y fuera de la unidad del
repo; estado de Actions, protección de rama, rulesets y plan de la organización consultados
por API). Sigue en `borrador`: no la apruebo yo.*
