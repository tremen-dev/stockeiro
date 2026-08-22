---
id: SPEC-028
tipo: spec
epica: EPIC-INFRA
estado: hecho
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-18, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-18, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-18, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-18, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-08-22, por: humano (Alberto Fojo)}
---
# SPEC-028 — Despliegue automático desde `main`: conexión Git, puerta post-deploy y runbook reescrito

> Implementa el punto **4** del desglose orientativo de **ADR-018** (*Despliegue continuo desde
> `main`*): *"Despliegue automático desde `main` (conexión Git, puerta post-deploy que exige el
> sha, reescritura del runbook). Es el paso que retira los frenos; solo es sensato cuando sus
> tres sustitutos ya están vivos."*
>
> **La pregunta que gobernaba todo está respondida.** La **pregunta 1 del gate de ADR-018**
> —*"¿se conecta el repo a Vercel, con despliegue automático al mergear?"*— la contestó el humano
> (Alberto Fojo) con un **sí** explícito el **2026-08-18**. Esta spec se escribe sobre esa
> respuesta: **no** plantea la alternativa como opción viva ni ofrece el repliegue de la rama
> `production` (alternativa 4 del ADR). Está decidido.
>
> **Los tres sustitutos están vivos**, verificado en este árbol (`origin/main` @ `de3a6ee`):
> 1. **Identidad del despliegue** — SPEC-031 `hecho` y mergeada: `src/app/api/version/route.ts`
>    y `scripts/check-alive.mjs`, con sus cuatro códigos de salida como contrato.
> 2. **BD de Preview separada** — **F-SPEC-023-1 cerrada** el 2026-08-18 con *preview branching*
>    de Neon (rama copy-on-write por despliegue de Preview).
> 3. **Guardias de migración** — SPEC-032 `hecho` y mergeada: `scripts/guard-migrate.mjs` en el
>    `buildCommand` de `vercel.json`, `scripts/scan-destructive-sql.mjs` con `Migration scan` en
>    la CI, y **RI-01** en `docs/fundacion/reglas.md`.
>
> **Nota de id.** Se usa **SPEC-028** exactamente: lleva reservado desde el 2026-08-17 y lo
> referencian por nombre ADR-018 §Desglose y los ledgers de SPEC-027, SPEC-031 y SPEC-032. **No
> es 022** —ADR-018 §Frontera y el ledger de SPEC-023 ya usan ese id con otro significado
> (observabilidad del ciclo de refresco) para un documento que nunca existió—. El siguiente id
> libre de verdad es **SPEC-033**.
>
> **Y la advertencia que ADR-018 hace sobre esta spec en concreto, atacada de frente.** El ADR
> avisa: *"4 es casi todo configuración de plataforma y un workflow. Mezclar los dos deja una
> spec que el verificador no puede cerrar sin desplegar."* Aquí eso ya no se puede evitar: **esta
> spec ES la conexión**. Lo que sí se puede evitar es la ambigüedad, y por eso los criterios de
> aceptación vienen **separados en tres bloques declarados**:
>
> | Bloque | Cómo se cierra | CA |
> |---|---|---|
> | **Verificable en local y en CI, sin desplegar** | tests estáticos que parsean, `git diff`, suite | CA-4 … CA-9, CA-11 … CA-14 |
> | **Exige un despliegue real** | evidencia nombrada: comando, salida esperada y URL | **CA-1, CA-2, CA-3, CA-10** |
> | **Acción de ops del humano, NO es CA** | se ejecuta en el panel/CLI de Vercel y su evidencia se pega en el ledger | §Acciones de ops |
>
> **Gate humano celebrado el 2026-08-18 (Alberto Fojo): spec APROBADA**, con cuatro
> resoluciones. Una de ellas añade trabajo —**D-7 se adopta como RI-02**, y es **CA-14**— y otra
> iba **en contra de la recomendación del arquitecto** (§Notas para el gate, punto 1). Las cuatro
> quedan escritas **con su resolución, no borradas**, porque la resolución es parte del contrato.
>
> **Actualización del 2026-08-19 — el mundo cambió debajo de la spec, y un CA cambió de signo.**
> El repositorio pasó a ser **público** (razón inmediata: la documentación de Vercel no permite
> desplegar en plan **Hobby** desde un repositorio **privado de una organización**, y el proyecto
> vive en el ámbito personal `albertofojo-5908s-projects`; hacer público el repo fue la salida
> frente a pagar Vercel Pro). Como **efecto colateral**, GitHub habilitó la protección de rama, y
> **está activa**: ruleset `Protected main`, `enforcement: active`, PR obligatoria, `Checks` y
> `E2E` requeridos, y **lista de *bypass* vacía**. Consecuencia: **`F-SPEC-028-1` y
> `F-SPEC-027-1` quedan cerrados**, y **CA-12.5 se reescribe con el signo contrario** — pedía que
> el runbook avisase de que no había red, y hoy la hay. Los otros trece CA, su clasificación
> 🔒/🚀 y el estado de los cuatro 🚀 (abiertos: el repo aún **no está conectado** a Vercel) **no
> cambian**.

## Problema

**Mergear sigue sin ser desplegar, y hoy la distancia entre `main` y producción es de cinco
specs.**

No es una hipótesis: está medido en este worktree el **2026-08-18**, contra el dominio real.

```
$ node scripts/check-alive.mjs --url https://stockeiro.tremen.dev --timeout 12 --interval 4
[check-alive] Se agotó el plazo (12s) esperando a https://stockeiro.tremen.dev/api/version.
[check-alive] último motivo: HTTP 404
exit 1
```

**`/api/version` responde 404 en producción.** El instrumento que SPEC-031 entregó *no está
vivo*, porque el último despliegue de producción es anterior a su merge. Cruzando `git log
--merges` con la fecha del último despliegue, lo que está mergeado en `main` y **mudo** es:

| Spec | Mergeada | Qué está sin llegar al usuario |
|---|---|---|
| SPEC-026 | 2026-08-18 | una sola definición del esquema |
| SPEC-027 | 2026-08-18 | la CI (no afecta a producción, pero mide el atraso) |
| SPEC-029 | 2026-08-18 | el buscador sin filtro de tipo **+ la migración `0008` (`instrument_type`), sin aplicar en Neon** |
| SPEC-031 | 2026-08-18 | `/api/version` y la comprobación de vida — de ahí el 404 |
| SPEC-032 | 2026-08-18 | las dos guardias de migración |

Es exactamente el defecto que abre `docs/despliegue.md` —*"EPIC-FIX estuvo 27 días en `main` sin
llegar a producción"*— ocurriendo otra vez, ahora con cinco pasajeros a la vez y una migración
sin aplicar. Y lo irónico y lo importante: **el instrumento que lo delataría es uno de los
pasajeros**. Mientras el despliegue dependa de que alguien se acuerde, cada spec nueva alarga la
cola.

Las tres causas que ADR-018 separó siguen intactas, y esta spec es la que las cierra:

1. **Desplegar es un ritual manual que hay que acordarse de ejecutar.** → lo mata la conexión
   Git (D-1): un merge a `main` construye y despliega, sin que nadie teclee nada.
2. **`vercel --prod` sube el árbol de trabajo local, no `main`.** → lo mata la misma conexión:
   el artefacto sale de un **commit**, no de un directorio.
3. **No hay forma barata de saber qué está vivo.** → lo mató SPEC-031 a medias (el instrumento
   existe) y lo cierra esta spec: la **puerta post-deploy** interroga `/api/version` tras cada
   despliegue y **falla si el sha mergeado no llega en un plazo**. Es el sustituto del *freno 3*
   de ADR-018 —el humano que abría la app después de desplegar—, que es el que falló 27 días.

Lo que **no** es problema de esta spec, dicho para que nadie lo espere aquí: contra qué base
migra un Preview (lo resolvió el *preview branching*, F-SPEC-023-1) y si un build tiene permiso
para migrar (lo resolvió `guard-migrate`, SPEC-032). Esta spec **retira el freno** que aquellas
dos vinieron a sustituir; por eso iban antes.

Ninguna regla de negocio (`docs/fundacion/reglas.md`, RN-01…RN-15) está implicada: no se toca
dominio, ni esquema, ni una sola pantalla. Sí toca **RI-01** por vecindad —la política de
migraciones aditivas es la que hace tolerable que un merge migre producción sin que nadie mire—,
pero no la modifica.

## Usuarios / roles afectados

- **Operador / mantenedor** (el humano que despliega): deja de desplegar. Su trabajo pasa de
  *"acordarse de ejecutar `vercel --prod` desde el árbol correcto"* a *"mirar un check"*. Es el
  rol que más cambia, y el runbook que lee cambia con él.
- **Quien mergea una PR**: hereda una responsabilidad que antes no tenía. **Mergear pasa a ser
  el acto que despliega a producción**. Desde el **2026-08-19** no está solo en eso: `main` está
  protegida (ruleset `Protected main`), así que **no puede mezclar con `Checks` o `E2E` en rojo**
  ni empujar directamente, y **nadie puede saltárselo** —la lista de *bypass* está vacía—. Lo que
  sigue enteramente en sus manos es el **cuándo**: un cambio de época de credencial cierra la
  sesión de todos los usuarios **en el instante del merge** (ADR-016).
- **sdd-verificador y sdd-orquestador**: **D-7 se adoptó en el gate del 2026-08-18** como
  **RI-02** (CA-14). El GREEN del verificador no cambia —sigue siendo sobre el árbol y antes del
  merge—; lo que cambia es que el paso a `hecho` ocurre **después**, con la puerta verde como
  evidencia. Esta spec es la que hace esa regla cumplible por primera vez.
- **Usuario final**: no percibe nada el día del cambio, y lo percibe todo después — porque a
  partir de aquí lo que se arregla le llega.

## Criterios de aceptación

Cada CA lleva **marcada su forma de cierre**. Los tres bloques no se mezclan a propósito: el
verificador tiene que poder decir *"esto lo cerré sin desplegar"* de **diez de los catorce**,
y *"esto exigió el despliegue y aquí está la evidencia"* de los otros cuatro.

Las formas de prueba son las que el proyecto ya usa (SPEC-027, SPEC-031, SPEC-032):

- **Tests estáticos** que **parsean** el YAML y el JSON, nunca regex sobre el texto crudo
  (`tests/ci-workflow.test.ts` es el patrón).
- **Tests estáticos sobre el runbook**, al estilo de `tests/runbook-check-alive.test.ts` y
  `tests/runbook-guardias-migracion.test.ts`.
- **Evidencia de despliegue** nombrada: comando exacto, salida esperada y URL, pegada en el
  ledger.

---

### 🚀 Bloque A — La conexión (ADR-018 D-1). **Exige despliegue real.**

- **CA-1 (Mergear despliega, y no lo dispara ninguna persona).** 🚀 **DESPLIEGUE REAL**
  Dado el repositorio `tremen-dev/stockeiro` conectado al proyecto de Vercel por la integración
  Git nativa, con rama de producción `main`,
  cuando se mergea una PR a `main`,
  entonces **aparece un despliegue de producción nuevo sin que nadie ejecute ningún comando**, y
  su origen es la integración —no un usuario humano—.
  *Por qué "no lo dispara ninguna persona" es parte del CA y no una obviedad*: es literalmente la
  causa 1 de ADR-018 (*"se olvidó 27 días"*). Un despliegue automático que en la práctica alguien
  tiene que empujar no arregla nada.
  *Evidencia para el ledger*:
  ```bash
  vercel ls --prod                 # el despliegue mas reciente es posterior al merge
  vercel inspect <url-del-deploy>  # meta.githubCommitSha = sha del merge; Creator = la integracion
  ```
  más el enlace al despliegue en el panel, donde el *Source* muestra `main` y el commit.

- **CA-2 (Lo que está vivo dice de qué commit viene, y `unknown` se acabó en producción).**
  🚀 **DESPLIEGUE REAL**
  Dado el despliegue automático de CA-1,
  cuando se interroga el dominio de producción,
  entonces `/api/version` responde **200** con `commit` igual al **sha del commit mergeado**,
  `environment: "production"` y un `builtAt` posterior al merge; ya **no** responde 404 ni
  `unknown`.
  *Línea base medida hoy, para que el antes y el después sean comparables*: el 2026-08-18, en
  este worktree, `/api/version` respondía **HTTP 404** y `check-alive` salía con **1** con
  `último motivo: HTTP 404`.
  *Evidencia para el ledger*:
  ```bash
  curl -s https://stockeiro.tremen.dev/api/version
  # {"commit":"<sha del merge>","environment":"production","builtAt":"2026-…Z"}
  node scripts/check-alive.mjs --url https://stockeiro.tremen.dev --commit $(git rev-parse origin/main)
  # exit 0
  ```

- **CA-3 (Cada PR tiene su Preview, y esa Preview no migró la base de producción).**
  🚀 **DESPLIEGUE REAL**
  Dada una PR abierta contra `main` con el repositorio ya conectado,
  cuando Vercel construye su despliegue de Preview,
  entonces:
  1. El build **pasa la guardia** `guard-migrate` — lo que demuestra, sin poder falsearlo, que
     `ALLOW_MIGRATE=1` existe en el entorno Preview (**F-SPEC-032-2**).
  2. `<url-de-preview>/api/version` responde `environment: "preview"` y el `commit` de la cabeza
     de la PR.
  3. La línea que `guard-migrate` imprime en el log del build (SPEC-032 CA-3) nombra un **host y
     una base distintos** de los que nombra el log del build de producción de CA-1.
  *Por qué el punto 3 es un CA y no una nota*: es el único observable barato del residual
  **F-SPEC-032-1** (*el permiso de migrar en Preview es permanente y asume que el preview
  branching sigue encendido*). No lo cierra —nadie impide apagar el ajuste mañana—, pero deja
  **medido y por escrito, una vez, con el pipeline en marcha**, que hoy apunta donde debe.
  *Evidencia para el ledger*: la URL de Preview que Vercel publica en la PR, el `curl` de su
  `/api/version`, y las **dos** líneas de `guard-migrate` (Preview y Production) copiadas de los
  logs de build, con host y base visibles y sin credenciales —la guardia ya garantiza que no las
  imprime—.

---

### 🔒 Bloque B — La puerta post-deploy (ADR-018 D-6, segundo párrafo). **Sin desplegar.**

ADR-018 la define así: *"una puerta automática tras cada despliegue: un paso que espera a que
`/api/version` en el dominio de producción devuelva el sha mergeado, y falla si no llega en un
plazo"*. Lo que sigue fija su forma; **todo esto se verifica parseando ficheros**.

- **CA-4 (Existe, vive en su propio workflow y se dispara solo donde debe).** 🔒 sin desplegar
  Dado el repositorio,
  cuando se añade `.github/workflows/deploy-gate.yml`,
  entonces:
  1. Se dispara **únicamente** con `push` a `main`. Ni `pull_request` (en una PR no hay
     despliegue de producción que comprobar), ni `schedule`, ni nada más.
  2. Declara `permissions: contents: read` y **no referencia `secrets.`** en ninguna parte.
  3. Es un fichero **aparte de `ci.yml`**, con `name` propio, de modo que su check aparezca en el
     commit con nombre distinguible del de la CI.
  *Por qué un fichero aparte y no un job en `ci.yml`* —y esto es una decisión, no una
  preferencia—:
  (a) **ciclo distinto**: `ci.yml` responde *"¿se puede mezclar?"* **antes** del merge; la puerta
  responde *"¿llegó?"* **después**, y el rojo de cada una pide una reacción distinta;
  (b) **`ci.yml` no habla con hosts externos y la puerta sí**, por definición: mezclarlas rompe
  una propiedad que dos specs anteriores dejaron congelada en tests
  (`tests/spec-031-frontera.test.ts` y `tests/spec-032-frontera.test.ts` afirman, sobre `ci.yml`,
  que ningún step invoca `check-alive` ni cita una URL externa);
  (c) por tanto meterla en `ci.yml` obligaría a **editar los tests de frontera de otras dos
  specs** — que es exactamente lo que ocurrió en `F-SPEC-032-3` y que aquí es evitable por
  completo. Ver **CA-9**.
  *Verificación*: test estático que parsea el YAML (`on`, `permissions`), y búsqueda de
  `secrets.` sobre el fichero.

- **CA-5 (Consume `scripts/check-alive.mjs` tal cual: ni script nuevo, ni lógica
  reimplementada).** 🔒 sin desplegar
  Dado `deploy-gate.yml`,
  cuando se lee su único step de comprobación,
  entonces ejecuta **`node scripts/check-alive.mjs`** con, al menos:
  - `--url` apuntando al **dominio de producción** (`https://stockeiro.tremen.dev`), escrito como
    literal en el workflow — es público, no es un secreto y ser literal lo hace verificable;
  - `--commit ${{ github.sha }}`, que en un `push` es el commit que acaba de aterrizar en `main`
    y es el mismo que Vercel pone en `VERCEL_GIT_COMMIT_SHA` del despliegue de producción.
  Y `scripts/` **sigue teniendo exactamente tres habitantes**: `check-alive.mjs`,
  `guard-migrate.mjs`, `scan-destructive-sql.mjs`. Esta spec **no añade ningún script**.
  *Por qué el dominio propio y no `stockeiro-lemon.vercel.app`*: `stockeiro.tremen.dev` es el
  origen que usan las personas y el valor de `APP_BASE_URL`; interrogarlo comprueba de una vez el
  despliegue, el alias de producción y el CNAME de Cloudflare. El `.vercel.app` puede estar bien
  mientras el dominio real apunta a otro sitio, y ese fallo no lo vería nadie.
  *Verificación*: test estático que parsea el YAML, localiza el step y afirma sobre su `run`
  (invoca el script, lleva `--commit ${{ github.sha }}`, lleva la URL literal) +
  `readdirSync('scripts')` con la lista cerrada de tres.

- **CA-6 (La puerta no necesita nada instalado, ni un secreto, ni la base de datos).**
  🔒 sin desplegar
  Dado el job de la puerta,
  cuando se leen sus steps,
  entonces **no ejecuta `npm ci` ni `npm install`**, no restaura ninguna caché de dependencias y
  no define ninguna variable con credenciales; toma la versión de Node de **`.nvmrc`**
  (`node-version-file`, una sola fuente, SPEC-027 CA-6) y nada más.
  *Por qué es un CA*: es el dividendo de SPEC-031 CA-8.2 (*el script solo importa `node:*`*)
  cobrado aquí. Un `npm ci` en esta puerta añadiría dos minutos y una dependencia del registro de
  npm y del CDN de SheetJS (F-SPEC-011-1) a un paso cuyo único trabajo es hacer una petición a un
  endpoint público. Y ADR-018 D-4.1 —*"un CI sin secretos es un CI que no puede filtrar nada ni
  tumbar nada"*— se hereda entera.
  *Verificación*: test estático sobre los steps del job (ninguno contiene `npm ci`/`npm install`;
  ningún `uses` de caché; el `setup-node` usa `node-version-file: .nvmrc` y no fija número).

- **CA-7 (El plazo es mayor que el build, y el veredicto no se traga).** 🔒 sin desplegar
  Dado el step de la puerta,
  cuando se leen sus banderas y su configuración,
  entonces:
  1. Pasa `--timeout` y `--interval` **explícitos** (no se apoya en los valores por defecto del
     script), con un plazo **holgadamente mayor** que un build completo de Vercel — la referencia
     medida en ADR-018 es ~40 s de build, y desde entonces el `buildCommand` ejecuta además la
     guardia y las migraciones: el plazo se fija en **900 s** con intervalo de **10 s**.
  2. El job **no lleva `continue-on-error`**, el step **no termina en `|| true`** ni en ningún
     otro apaño que convierta un código de salida distinto de 0 en verde.
  3. El job declara `timeout-minutes` mayor que el plazo del script, para que quien corte sea el
     script —con su mensaje— y no el runner con un cuelgue mudo.
  *Por qué el punto 2 tiene su propia línea*: una puerta que nunca se pone roja es peor que no
  tener puerta, porque además tranquiliza. Y es el fallo más fácil de introducir sin querer el
  día que la puerta dé un falso rojo y alguien quiera "que no moleste".
  *Verificación*: test estático (existencia de `--timeout` y `--interval` con valores, ausencia
  de `continue-on-error` en job y step, ausencia de `|| true` y de `if: always()` sobre el
  veredicto, y `timeout-minutes` presente y coherente con el plazo).

- **CA-8 (Un push más nuevo cancela a la puerta vieja; la CI no cambia su semántica).**
  🔒 sin desplegar
  Dado `deploy-gate.yml`,
  cuando se lee su bloque `concurrency`,
  entonces usa un **grupo propio** (distinto del de `ci.yml`) con **`cancel-in-progress: true`**.
  Y `.github/workflows/ci.yml` **conserva** su `cancel-in-progress` condicionado a
  `pull_request` (SPEC-027 CA-5.5), sin tocarlo.
  *Por qué aquí sí y allí no, que es justo lo contrario*: la CI de un push a `main` publica *"este
  commit está verde"*, y cada commit tiene el suyo, así que cancelarlo pierde información. La
  puerta afirma otra cosa: *"lo más nuevo de `main` está vivo"*. Si llega un commit posterior,
  Vercel desplegará **ese**, y la puerta vieja pasará a esperar un sha que ya nunca estará vivo:
  su rojo sería **garantizado y sin significado**. Cancelarla no pierde nada — la puerta del
  commit nuevo cubre a los dos.
  *Verificación*: test estático que parsea el `concurrency` de los dos workflows y afirma que los
  grupos son distintos y las políticas, las descritas.

- **CA-9 (Nada más queda cableado, y no se toca ni un test de otra spec).** 🔒 sin desplegar
  Dado el diff completo de la spec,
  cuando se inspecciona,
  entonces:
  1. `.github/workflows/ci.yml` **no cambia** (ni un step, ni un disparador, ni el `concurrency`).
  2. `vercel.json` **no cambia**: el `buildCommand` sigue siendo
     `node scripts/guard-migrate.mjs && npm run db:migrate && npm run build`.
  3. `src/` **no cambia ni una línea**, `drizzle/` no gana ningún `.sql`, `package.json` no gana
     ningún script.
  4. **`tests/spec-031-frontera.test.ts` y `tests/spec-032-frontera.test.ts` siguen verdes sin
     ser editados**, y lo mismo `tests/ci-workflow.test.ts`.
  *Por qué el punto 4 es un CA con nombre y apellidos*: `F-SPEC-032-3` documenta el precedente —dos
  literales congelados de SPEC-031 hubo que tocarlos porque un CA de SPEC-032 los cambiaba, y el
  implementador tuvo que declararlo—. Aquí ese coste es **evitable por completo** si la puerta
  vive en su propio fichero (CA-4), y por eso se convierte en criterio: si alguien la mete en
  `ci.yml`, este CA se pone rojo y la conversación ocurre **antes** de tocar el test de otro.
  *Verificación*: `git diff --stat` acotado a esos ficheros (vacío) + la suite completa en verde
  **sin cambios** en los tres ficheros nombrados.

- **CA-10 (La puerta corre de verdad, en el merge de esta spec, y sale verde).**
  🚀 **DESPLIEGUE REAL**
  Dado el merge de esta spec a `main` con el repositorio ya conectado,
  cuando la puerta se ejecuta,
  entonces **espera** a que `/api/version` devuelva el sha del merge y **termina en verde**, y su
  salida estándar imprime la identidad completa (commit, entorno, instante del build).
  Y la lectura contraria, que es la que da valor al verde: si el despliegue **no** llegara, la
  puerta terminaría en rojo nombrando el sha esperado y el **último visto** (SPEC-031 CA-10), y
  si el despliegue vivo no supiera de dónde viene, en rojo con código **2** (SPEC-031 CA-11).
  Esas dos ramas **ya están probadas** contra servidores de juguete en `tests/check-alive.test.ts`
  y **no se vuelven a probar aquí**: lo que esta spec añade es el cableado, no el comportamiento.
  *Evidencia para el ledger*: la URL del run de GitHub Actions de la puerta para el commit del
  merge, en verde, con el log del step visible.

---

### 📖 Bloque C — El runbook reescrito. **Sin desplegar.**

`docs/despliegue.md` describe hoy un mundo que esta spec deroga: §3.4 dice que se despliega con
`vercel` / `vercel --prod`, §8 documenta un despliegue manual paso a paso, y §5 lleva un
`vercel --prod verde` en el checklist. **Es el documento que más cambia de todo el diff**, y por
eso lleva tres CA en vez de una nota.

- **CA-11 (El despliegue manual deja de ser la vía normal, y queda marcado como lo que es).**
  🔒 sin desplegar
  Dado `docs/despliegue.md`,
  cuando se lee tras esta spec,
  entonces:
  1. **§3.4 (*Desplegar*)** ya no presenta `vercel` / `vercel --prod` como el procedimiento:
     describe que **un merge a `main` construye y despliega a producción**, y que las PR obtienen
     un despliegue de Preview.
  2. `vercel --prod --archive=tgz` se conserva **explícitamente marcado como recurso de
     emergencia** (ADR-018 D-1: *"pasa a ser recurso de emergencia, y el runbook lo marcará como
     tal con su advertencia"*), con sus dos trampas ya documentadas —el falso `"Not authorized"`
     de §6 y la pérdida de metadatos de git desde un worktree— **y una consecuencia nueva que hay
     que decir en voz alta**: un despliegue por CLI hace que `/api/version` responda
     `commit: unknown`, de modo que **la puerta lo delataría**. Deja de ser un detalle: es la
     firma de un despliegue fuera de proceso.
  3. La **lección del 2026-08-11** de la cabecera **no se borra** —es historia y es la razón de
     todo esto— pero se actualiza: *mergear ya es desplegar*, y lo que hay que mirar ahora es el
     check de la puerta, no la fecha de `vercel ls --prod`.
  *Verificación*: test estático sobre el runbook (§3.4 ya no presenta `vercel --prod` como el
  paso normal; aparecen las cadenas de la vía automática; la palabra "emergencia" acompaña al
  comando de CLI) + lectura humana en la revisión.

- **CA-12 (Existe una sección que documenta el pipeline entero, incluido qué hacer cuando la
  puerta se pone roja).** 🔒 sin desplegar
  Dado `docs/despliegue.md`,
  cuando se lee tras esta spec,
  entonces hay una sección nueva que documenta, como mínimo:
  1. **El disparador**: merge a `main` → build en Vercel (`guard-migrate` → `db:migrate` →
     `next build`) → despliegue de producción; PR → Preview.
  2. **La puerta**: qué workflow es, qué comprueba, contra qué dominio, con qué plazo, y **cómo
     se llama el check** en la lista de GitHub.
  3. **La tabla de reacción**: qué significa cada código de salida de `check-alive` *en este
     contexto* —**0** llegó · **1** no llegó en el plazo (mirar si el build falló en Vercel, y en
     qué eslabón: guardia, migración o build) · **2** hay un despliegue que **no viene de la
     integración Git** (alguien desplegó por CLI) · **3** el origen no responde el contrato (mirar
     dominio y DNS)—.
  4. **Qué NO hace la puerta**: no revierte nada. ADR-018 lo dice sin rodeos —*"un check rojo en
     `main` no revierte nada por sí solo: avisa"*—, y el runbook debe decir cuál es el
     procedimiento manual: `vercel rollback`, **con su límite escrito**: *devuelve el código, no
     el esquema*; tras una migración destructiva deja código viejo contra un esquema mutilado, y
     la red última es el historial de restauración de Neon (**cuya ventana sigue sin comprobar**,
     pregunta 7 del gate de ADR-018).
  5. **Que la CI IMPIDE mezclar: con qué mecanismo exacto, quién no puede saltárselo, y qué no
     cubre.** Desde el **2026-08-19** `main` está protegida, así que esto dejó de ser una
     recomendación y es una regla que aplica GitHub. El runbook tiene que decirlo **donde se lee
     antes de mezclar**, y nombrar las piezas — para que el texto sea comprobable hoy y quede
     **comprobablemente desfasado** el día que alguien las cambie:
     1. **Todo cambio entra por PR**: `main` no acepta *push* directo, y están bloqueados además
        el borrado de la rama y el *force-push* (`deletion`, `non_fast_forward`).
     2. **`Checks` y `E2E` tienen que estar en verde para poder mezclar.** Son los dos contextos
        que el ruleset exige, con esos nombres exactos; en la lista de la PR aparecen como
        `CI / Checks` y `CI / E2E`.
     3. **El ruleset se llama `Protected main`**, está en `enforcement: active` sobre la rama por
        defecto, y **su lista de *bypass* está vacía**. Eso último **es parte de la protección, no
        un detalle de configuración**: sin excepciones, la regla frena también al dueño del
        repositorio. **El día que alguien se añada a esa lista, la red vuelve a ser un
        recordatorio** — y este texto, mentira.
     4. **Lo que la protección NO cubre**, dicho en el mismo sitio para que nadie se apoye de más:
        (a) **no exige revisión de nadie** (`required_approving_review_count: 0`) — exige PR y
        checks verdes, no un segundo par de ojos; (b) **no exige que la rama esté al día con
        `main`** antes de mezclar (política *strict* desactivada), así que los checks pueden haber
        corrido contra una base más vieja que la que acaba desplegándose; (c) **`Alive` no es un
        check requerido, y no debe serlo**: corre en `push` a `main`, o sea **después** del merge,
        y exigirlo en la PR bloquearía todas las PR para siempre, porque ahí no llega a existir.
     5. **Y ningún pasaje del runbook sigue diciendo lo contrario.** Desaparecen del documento
        entero —**§9 incluida**— las afirmaciones de que *"la CI informa, pero no impide mezclar"*
        y de que *"nadie lo va a mirar por ti"*, y la mención a `F-SPEC-027-1` como residual
        abierto.
     *Por qué este punto cambió de signo, y por qué se deja escrito en vez de reescrito en
     silencio*: hasta el 2026-08-18 era exacto —el plan de GitHub no ofrecía protección de rama en
     repo privado, y el humano **aceptó ese riesgo en el gate**, en contra de mi recomendación—. El
     **2026-08-19** el repositorio pasó a **público** por una razón ajena a este debate (Vercel no
     permite desplegar en plan Hobby desde un repo privado de una organización), y GitHub habilitó
     la protección como **efecto colateral**. El riesgo no se corrigió: **se evaporó por un
     movimiento hecho por otro motivo**. Que el texto anterior sobreviviera un solo día sería el
     peor fallo imaginable en un runbook — decirle a quien lo lee que no hay red **justo cuando sí
     la hay**.
     *Por qué es un punto de CA y no una nota suelta*: la protección vive en GitHub, **no en el
     repositorio**; el runbook es el único sitio del árbol donde puede quedar escrita, y un test
     estático puede comprobar que lo está — y que lo viejo ya no.
  *Verificación*: test estático sobre el runbook. En positivo: existe la sección; menciona el
  fichero del workflow, el dominio, los cuatro códigos de salida, `vercel rollback` junto a la
  frase de que no devuelve el esquema, el ruleset `Protected main`, los contextos `Checks` y
  `E2E`, y la lista de *bypass* vacía. **En negativo, que es la mitad que importa**: las frases
  *"informa, pero no impide"* y *"nadie lo va a mirar por ti"* **no aparecen en ningún punto del
  documento**. Más lectura humana en la revisión.

- **CA-13 (La configuración que no vive en el repo queda escrita, con su evidencia y sus
  techos).** 🔒 sin desplegar
  Dado `docs/despliegue.md`,
  cuando se lee tras esta spec,
  entonces documenta, como **acciones de ops con su evidencia** —no como pasos que ejecute el
  implementador—:
  1. **La conexión Git**: qué repositorio, qué proyecto, **rama de producción `main`**, y cómo se
     comprueba que está conectado (`vercel project inspect` muestra el repositorio; los
     despliegues muestran *Source* con rama y commit).
  2. **`ALLOW_MIGRATE=1` en el entorno Preview** (`vercel env add ALLOW_MIGRATE preview`,
     **F-SPEC-032-2**), diciendo qué pasa si falta: **todas las previews fallan en la guardia**,
     en rojo y a propósito.
  3. **El *preview branching* de Neon** y sus dos techos, que hoy no están escritos en ninguna
     parte y son los que romperán las previews sin avisar: **10 ramas** en el plan Free, y las
     ramas de preview **sobreviven al cierre de la PR** (retención de 6 meses de Vercel). Con el
     apartado de mantenimiento correspondiente: revisar y borrar ramas viejas.
  4. **El orden en que se hace todo esto**, que importa: `ALLOW_MIGRATE` **antes** de conectar.
  Y **§5 (checklist)** y **§6 (gotchas)** quedan al día: el checklist deja de pedir
  `vercel --prod verde` y pide el check de la puerta en verde; el gotcha del worktree se reencuadra
  como *lo que verás si alguien despliega fuera de proceso*.
  *Verificación*: test estático sobre el runbook (aparecen `ALLOW_MIGRATE`, la conexión Git, el
  techo de ramas de Neon y el orden; el checklist ya no exige `vercel --prod`) + lectura humana.

---

### ✍️ Bloque D — La regla que el gate firmó (ADR-018 D-7). **Sin desplegar.**

- **CA-14 ("Hecho" pasa a significar "vivo", escrito como regla del proyecto y con el matiz que
  la hace cumplible).** 🔒 sin desplegar
  Dado `docs/fundacion/reglas.md`,
  cuando se lee tras esta spec,
  entonces:
  1. En la sección **"Reglas de ingeniería (RI-xx)"** —que **ya existe**, creada por SPEC-032 con
     `RI-01`— aparece **`RI-02`** con este contenido:
     > **RI-02** (*"Hecho" significa "vivo"*): una spec no pasa a `hecho` por tener GREEN del
     > verificador. Pasa a `hecho` cuando su merge está en `main` **y** el despliegue de ese merge
     > está vivo: la puerta de despliegue (`.github/workflows/deploy-gate.yml`) en verde, o a mano
     > `node scripts/check-alive.mjs --url <origen> --commit <sha del merge>` con salida **0**. El
     > GREEN del verificador **sigue siendo sobre el árbol de trabajo y antes del merge**: lo que
     > esta regla añade es el último paso, que ocurre **después**. La evidencia (enlace al run de
     > la puerta, o la salida del comando) se pega en el ledger de la spec. Fuente: ADR-018 D-7.
  2. La regla **cita su fuente** (`ADR-018 D-7`) y **el mecanismo que la hace cumplible**:
     `/api/version` (SPEC-031) y la puerta post-deploy de esta spec. Sin los dos, la regla es
     incumplible — que es exactamente por lo que estuvo aplazada desde el 2026-08-17.
  3. **`RI-01` no se toca** y **las quince reglas de dominio `RN-01`…`RN-15` siguen intactas**:
     ni se renumeran, ni se reescriben, ni nace un `RN-16`. La serie `RI-xx` sigue separada de la
     de dominio, que es la razón por la que SPEC-032 la creó aparte.
  *Por qué el matiz del punto 1 es la mitad del CA y no una floritura*: la letra de D-7 dice *"el
  verificador no cierra una spec hasta que `/api/version` la contiene"*, y **el verificador
  trabaja antes del merge**, cuando no hay nada vivo que interrogar. Escrita sin el matiz, la
  regla sería otra vez incumplible — el mismo motivo por el que se aplazó — o empujaría al
  verificador a mezclar para poder verificar, que es peor. Con el matiz, dice quién comprueba
  qué y cuándo.
  *Alcance estricto*: **se escribe la regla, nada más**. Ni `FOUNDATION.md`, ni ADR-018 —que es
  inmutable: esta regla es la **respuesta** a su pregunta 3 de gate, no una enmienda—, ni
  ninguna spec anterior, ni el fichero de rol del verificador (que vive en el plugin, no aquí:
  ver §Notas para el gate, punto 2).
  *Verificación*: test estático sobre `docs/fundacion/reglas.md` (existe la sección de reglas de
  ingeniería; existe `RI-02`; menciona `check-alive`, la puerta, el ledger y `ADR-018 D-7`; y
  **siguen estando `RI-01` y las quince RN, sin cambios**), al estilo de
  `tests/reglas-ingenieria.test.ts` que SPEC-032 dejó + lectura humana en la revisión.
  *Nota de autoría*: el arquitecto **no** escribe esta regla. La firmó el humano en el gate del
  2026-08-18; la escribe el **implementador** al cerrar este CA, igual que se hizo con `RI-01`.

## Entidades y reglas afectadas

- **Ninguna entidad de dominio, ninguna RN.** No se toca `src/db/schema.ts`, no hay migración, no
  cambia ninguna pantalla ni ningún servicio. Esta spec **no dispara `guard-migrate` ni el escáner
  de SQL destructivo** en su propio diff, porque no añade ni una línea de SQL.
- **ADR-018 D-1** — *la producción se despliega desde `main`, automáticamente, y solo desde ahí*.
  Es la decisión que gobierna el Bloque A. Su **pregunta 1 de gate está respondida con un sí**
  (humano, 2026-08-18): la **alternativa 4** (rama `production` como disparador) **no se plantea**
  en esta spec, ni como opción ni como repliegue vivo.
- **ADR-018 D-6, segundo párrafo** — *"una puerta automática tras cada despliegue […] y falla si no
  llega en un plazo"*. Es la decisión que gobierna el Bloque B. El ADR fija la propiedad; esta spec
  fija el mecanismo (fichero propio, dominio, plazo, concurrencia), que es el margen que D-6 deja
  explícito (*"mecanismo libre, propiedades obligatorias"*).
- **ADR-018 D-2 / SPEC-032** — la guardia sigue **intacta** dentro del `buildCommand` (CA-9.2).
  Esta spec es la que **abre la ventana** que la guardia protege: hasta hoy no había builds que no
  fueran manuales de producción.
- **ADR-018 D-3 / F-SPEC-023-1** — *ningún entorno que no sea Production tendrá credenciales de la
  BD de Production*. Cerrado por ops el 2026-08-18; **CA-3.3 lo comprueba una vez, con el pipeline
  vivo**, que es la primera oportunidad real de hacerlo.
- **ADR-018 D-4 / SPEC-027** — la CI en cada PR. **No se toca** (CA-9.1). Su **`F-SPEC-027-1`**
  —*la CI informa pero no impide mezclar*— llegó a **cambiar de peso** con esta spec y a peor
  (retirado el humano que desplegaba, era el único freno), y quedó **cerrado el 2026-08-19**: con
  el repositorio público, GitHub habilita la protección de rama y el ruleset `Protected main` está
  activo. La CI pasa de *informa* a **impide**, que es exactamente la premisa sobre la que ADR-018
  aceptó retirar el gate humano previo a producción. Lo único que esta spec debe hacer al respecto
  es que **el runbook lo diga** → **CA-12.5**.
- **ADR-018 D-5.1 → RI-01** (`docs/fundacion/reglas.md`) — la política de migraciones aditivas.
  **No se modifica**, pero conviene saber que a partir de aquí es lo que hace tolerable que un
  merge migre producción sin que nadie mire el SQL: es el contrapeso, y ya está firmado.
- **ADR-018 D-7** — *"hecho" pasa a significar "vivo"*. Estuvo **aplazado en el gate de SPEC-031**
  (`F-SPEC-031-1`) **a este gate**, con la razón escrita: antes de esta spec era una regla
  incumplible. **Adoptado en el gate del 2026-08-18** (Alberto Fojo), lo que responde la
  **pregunta 3 del gate de ADR-018** y **cierra `F-SPEC-031-1`**. Aterriza en
  `docs/fundacion/reglas.md` como **RI-02** → **CA-14**, con el matiz que lo hizo firmable: el
  verificador trabaja **antes** del merge, así que la regla mueve el paso a `hecho` a **después**.
  El ADR **no se modifica**: es inmutable, y esto es la respuesta a su pregunta, no una enmienda.
- **ADR-016** — invalidación de sesiones al cambiar la contraseña. Consecuencia heredada de
  ADR-018 §Consecuencias: *"con auto-deploy, ese instante lo fija quien mergea"*. El runbook ya
  advierte de no hacerlo coincidir con la invitación a testers; a partir de aquí esa advertencia
  hay que leerla **antes de mergear**.
- **SPEC-031** — entrega las dos piezas que esta spec cablea: `/api/version` y
  `scripts/check-alive.mjs` con sus cuatro códigos de salida. Se consumen **tal cual** (CA-5): ni
  se tocan, ni se envuelven, ni se duplican.
- **F-SPEC-011-1** — la dependencia del build con `cdn.sheetjs.com`. Sin cambio de sustancia, con
  cambio de exposición: a partir de aquí una caída de ese CDN tumba **cada** build de Preview y de
  producción, no solo el que alguien lanzase a mano. ADR-018 ya lo llamó *efecto neto positivo*
  (se ve en la PR y no como sorpresa); la puerta de CA-4 no lo cubre porque un build que falla no
  despliega nada y la puerta se quedaría esperando hasta el plazo — que es exactamente el rojo
  correcto, con el mensaje correcto.
- **No se escribe ADR nuevo (no hay ADR-021).** Todo lo que esta spec decide —fichero propio para
  la puerta, dominio interrogado, plazo e intervalo, política de concurrencia, no añadir scripts—
  es **mecanismo** dentro del margen que ADR-018 deja explícito en D-6, y la decisión que sí
  constriñe el futuro —conectar el repo y desplegar al mergear— ya la tomó **D-1**, aprobado el
  2026-08-17 y confirmado en el gate del 2026-08-18. Escribir un ADR aquí sería duplicar una
  decisión viva, que es peor que no escribirlo. **Y D-7, que sí es una decisión nueva con
  vocación de constreñir todo el ciclo, tampoco necesita ADR propio**: lo decidió ADR-018 y el
  humano lo firmó en el gate, así que su sitio es `docs/fundacion/reglas.md` como **RI-02**
  (CA-14), siguiendo exactamente el precedente que SPEC-032 fijó con RI-01. Un ADR aquí
  duplicaría a D-7 sin añadirle nada.

## Fuera de alcance

Aparcado a propósito, y casi todo con dueño y nombre:

- **Todo lo que ya entregaron SPEC-027, SPEC-031 y SPEC-032.** No se reimplementa nada: ni la CI,
  ni `/api/version`, ni `check-alive.mjs`, ni las dos guardias. Esta spec **solo cablea**.
- **Configurar la protección de rama.** Dejó de ser residual el **2026-08-19**: `main` está
  protegida (`Protected main`, PR obligatoria, `Checks` y `E2E` requeridos, *bypass* vacío), y con
  ello se cierran **`F-SPEC-027-1`** y **`F-SPEC-028-1`**. **No lo hizo esta spec** y no lo mantiene:
  es configuración de GitHub, del humano. Lo único que entra aquí es que el runbook lo **cuente
  bien** (**CA-12.5**) — y que deje de contar lo contrario, que es la mitad urgente.
- **Una puerta post-deploy para los despliegues de Preview.** Exigiría la URL de Preview, que solo
  se conoce por el evento `deployment_status` o con un token de Vercel — y un token es un secreto,
  que es justo lo que ADR-018 D-4.1 evita. La PR ya muestra el check propio de Vercel con su URL.
  Follow-up sin urgencia.
- **Revertir automáticamente ante una puerta roja.** ADR-018 lo excluye explícitamente (*"avisa"*).
  Y hay una razón de fondo: un falso rojo —un build lento, una propagación de DNS— dispararía un
  rollback que nadie pidió. La reversión sigue siendo `vercel rollback` + criterio humano (CA-12.4).
- **Alerting de cualquier tipo** (correo, Slack, lo que sea) cuando la puerta falle. ADR-018
  §Frontera: *"ninguna de las dos introduce alerting"*. El rojo se ve en GitHub; convertirlo en un
  aviso es una decisión aparte que abarcaría también a la observabilidad del ciclo.
- **Cerrar del todo `F-SPEC-032-1`** (el permiso `ALLOW_MIGRATE` en Preview es permanente y asume
  que el *preview branching* sigue encendido). CA-3.3 cierra su mitad observable —**hoy apunta
  donde debe, medido y escrito**—; la otra mitad —impedir desde el build que un Preview apunte a la
  base de producción— exige conocer la identidad de esa base dentro del repositorio o un marcador
  de la integración de Neon que **nadie ha verificado**. No se inventa aquí. **Sigue abierto**,
  ahora con destino EPIC-INFRA.
- **Medir la ventana de restauración de Neon** (pregunta 7 del gate de ADR-018). Comprobación de
  ops, de cinco minutos, que **sigue sin hacerse**; el runbook la nombra (CA-12.4) pero no la
  ejecuta.
- **Desplegar el atraso de cinco specs mudas** (SPEC-026/027/029/031/032). Es una **decisión de
  ops con secuencia**, no un CA: ver §Acciones de ops y §Notas para el gate, punto 3.
- **La observabilidad del ciclo de refresco** (lo que ADR-018 llama SPEC-022, documento que sigue
  sin existir). Frontera intacta: la puerta no dice nada de ciclos.
- **Tocar `docs/fundacion/` más allá de añadir `RI-02`, o tocar `FOUNDATION.md` o ADR-018.** El
  ADR es inmutable. `RI-02` **sí** entra (CA-14) desde el gate del 2026-08-18; lo que queda fuera
  es cualquier otra cosa en ese fichero: ni se toca `RI-01`, ni se renumera ninguna `RN-xx`.
- **Cambiar el ciclo tremen-sdd en el plugin.** `RI-02` es una **convención local de este
  repositorio**. ADR-018 D-7 avisa de que el ciclo es del plugin, no de Stockeiro: llevar la regla
  allí es un `KI` para su mantenedor y no es trabajo de esta spec. Aquí no se toca ningún fichero
  de rol.
- **Cambiar el cron, las regiones, o cualquier otro ajuste del proyecto de Vercel** que no sea la
  conexión Git y la rama de producción.

## Acciones de ops (del humano, NO son criterios de aceptación)

Nadie puede ejecutar esto desde un test, y por eso no son CA. Su **evidencia sí** entra en el
ledger, y **CA-1, CA-2 y CA-3 no pueden cerrarse si estas acciones no se han hecho** — de modo
que están vigiladas sin ser criterios.

**El orden es una precondición, no una sugerencia**, y lo fijó el gate del 2026-08-18. Dos
razones, cada una con su paso: el atraso se drena **antes** para no acoplar dos riesgos
independientes en un solo día (§Notas, punto 3), y `ALLOW_MIGRATE` va **antes** de conectar
porque la guardia de SPEC-032 es *fail-closed* por diseño.

| # | Acción | Cómo | Por qué en esta posición |
|---|---|---|---|
| 1 | **Drenar el atraso a mano** (SPEC-026/027/029/031/032 + migración `0008`) | `git fetch origin` · `git switch --detach origin/main` · `git status --short` vacío · `vercel --prod --archive=tgz` (runbook §8 paso 4) | **Decidido en el gate.** Pone producción al día por la vía ya probada, para que si el primer despliegue automático falla se sepa si falló el pipeline o el atraso. |
| 2 | **Verificar que el atraso llegó**: `/api/version` deja de dar 404 | `curl -s https://stockeiro.tremen.dev/api/version` · `node scripts/check-alive.mjs --url https://stockeiro.tremen.dev` | Es la puerta de salida del paso 1. Saldrá con **2** (`commit: unknown`) y **eso es correcto**: la CLI sube sin `.git`. Lo que se comprueba aquí es que el endpoint **existe** y que la migración `0008` se aplicó. |
| 3 | **`ALLOW_MIGRATE=1` en Preview** (F-SPEC-032-2) | `vercel env add ALLOW_MIGRATE preview` (valor `1`) | Si se conecta el repo sin esto, **todas** las previews fallan en la guardia. Es el comportamiento correcto, pero conviene que sea decisión y no sorpresa. |
| 4 | **Conectar `tremen-dev/stockeiro`** al proyecto de Vercel, integración Git nativa, **rama de producción `main`** | panel de Vercel → *Settings → Git* | Es D-1. A partir de aquí, mergear despliega. |
| 5 | **Comprobar qué se disparó al conectar** | `vercel ls --prod` justo después | Si la conexión lanza un despliegue por su cuenta, conviene verlo y no descubrirlo. Tras el paso 1 ese despliegue ya no llevaría sorpresas. |
| 6 | **Anotar el techo de ramas de Neon** | consola de Neon | 10 ramas en el plan Free, y las de preview sobreviven al cierre de la PR. La spec lo documenta (CA-13.3); vigilarlo es ops. |

## Notas para el gate humano

Lo que había que decidir o mirar con lupa antes de aprobar. **El gate se celebró el 2026-08-18
(Alberto Fojo) y la spec quedó aprobada**; los cinco primeros puntos eran decisiones suyas y los
cinco están resueltos. Se dejan escritos **con su resolución, no borrados**, porque la resolución
es parte del contrato — y en el punto 1, porque quien lo lea dentro de seis meses tiene que ver
que el riesgo **se conocía y se asumió**, no que se pasó por alto. Del punto 6 en adelante es
información que sigue valiendo tal cual.

1. ✅ **CERRADO el 2026-08-19 — la CI ya IMPIDE mezclar. El riesgo que el gate aceptó el
   2026-08-18 dejó de existir, y no porque se siguiera mi recomendación.** Los dos actos, en orden
   y con fecha, porque el segundo no anula al primero:
   - **2026-08-18 (gate)**: 🟠 *"se conecta igualmente, SIN pagar la protección de rama. Riesgo
     aceptado, en contra de la recomendación del arquitecto."*
   - **2026-08-19**: el repositorio pasa a **público** —por la razón ajena que explica CA-12.5:
     Vercel no permite desplegar en plan Hobby desde un repo privado de una organización, y hacer
     público el repo era la salida frente a pagar Vercel Pro— y GitHub habilita la protección de
     rama como **efecto colateral**. Queda activa el mismo día: ruleset `Protected main`,
     `enforcement: active`, PR obligatoria, `Checks` y `E2E` requeridos, `deletion` y
     `non_fast_forward` bloqueados, y **lista de *bypass* vacía**. **`F-SPEC-028-1` y
     `F-SPEC-027-1`: cerrados.**
   *Lo que cambia en la spec*: **CA-12.5 se reescribe con el signo contrario** —pedía que el
   runbook avisara de que no había red— y añade la mitad negativa: que ninguna frase vieja
   sobreviva en el documento.
   *Por qué dejo el análisis de abajo íntegro y no lo borro*: porque la aceptación del riesgo fue
   real y fechada, y porque **la protección es configuración de GitHub, no del repositorio**:
   basta con que alguien la desactive o se añada a la lista de *bypass* para que todo lo de abajo
   vuelva a ser cierto en un minuto. Es el análisis que hay que releer ese día, no reconstruirlo.
   *El problema, tal cual lo llevé al gate del 2026-08-18*: al automatizar el despliegue, la CI en
   rojo deja de tener quien la mire.
   Hoy `F-SPEC-027-1` dice que *"la CI informa, pero NO impide mezclar"* —el plan de GitHub de la
   organización no ofrece protección de rama en repo privado: `403 Upgrade to GitHub Pro`—. Hasta
   hoy eso era tolerable porque **entre un merge malo y producción había una persona** que tenía
   que decidir desplegar. **Esta spec retira a esa persona.** A partir de aquí, un merge con
   typecheck, lint, unitarios, `Migration scan` o e2e en rojo **va a producción solo**, y la
   puerta post-deploy dirá alegremente que ese código roto está vivo — porque lo está.
   ADR-018 valoró el gate humano previo a producción y lo cambió por *"una PR con typecheck, lint,
   253 unitarios, 24 e2e, migraciones estrenadas y escáner de SQL destructivo"*. **Ese cambio solo
   es bueno si esa PR puede decir que no.** Hoy no puede.
   *Mi recomendación*: **pagar GitHub Team** (~4 $/asiento/mes, hoy 1 asiento) y activar protección
   de rama sobre `main` exigiendo `CI / Checks` y `CI / E2E`. Es el desembolso más pequeño de todo
   el proyecto y es lo que convierte la CI de *informa* en *impide*, que es la premisa sobre la que
   ADR-018 aceptó retirar el gate humano.
   *Alternativas*: (a) asumirlo y confiar en la disciplina del ciclo tremen-sdd —era lo que había,
   pero había un humano detrás—; (b) hacer público el repo —descartado: app financiera privada—.
   **Resolución del humano el 2026-08-18: (a).** Se conectaba el repositorio **sin** comprar la
   protección de rama; el freno pasaba a ser la disciplina de mirar el check antes de mezclar. Fue
   su decisión, en contra de lo que recomendé, y así queda escrita y fechada. Lo que se aceptaba
   con ella, sin suavizar: **ADR-018 sustituyó el gate humano previo a producción por "una PR que
   verifica", y esa PR entonces no podía decir que no**.
   **Y el 2026-08-19 la salida (b) ocurrió por otro motivo**, arrastrando consigo la protección de
   rama. Merece decirse tal cual: **el riesgo no se corrigió, se evaporó**. La recomendación cara
   (pagar GitHub Team) nunca hizo falta, y la barata (repo público) llegó empujada por una
   restricción de Vercel que nada tenía que ver con este debate. Que salga bien por accidente no
   convierte en buena la decisión de asumirlo — y por eso el análisis se queda escrito.
   *Lo verificable que se deriva, ahora con el signo contrario*: el runbook tiene que decir que la
   CI **impide**, con qué mecanismo y qué no cubre → **CA-12.5**.
   *Lo que queda*: **nada abierto**. `F-SPEC-028-1` y `F-SPEC-027-1` pasan a **cerrados el
   2026-08-19**. Lo que sí queda es una **dependencia frágil**: la protección vive en un ajuste de
   GitHub que nadie versiona ni audita — el mismo tipo de fragilidad que ADR-018 D-2 describe para
   el *preview branching* de Neon. CA-12.5.3 la mitiga como se puede: dejando escrito que la lista
   de *bypass* vacía **es parte de la protección**, de modo que quien se añada rompa el runbook y
   no solo la red.

2. ✅ **RESUELTO (gate del 2026-08-18) — D-7 SE ADOPTA, como `RI-02`. Es CA-14, y cierra
   `F-SPEC-031-1`.** Era la **pregunta 3 del gate de ADR-018**, **aplazada explícitamente a este
   gate**, con la razón escrita: antes de esta spec era una regla **incumplible**, porque sin
   conexión Git el sha real no llega y `/api/version` responde `unknown`. **Con esta spec pasa a
   ser cumplible**, y por eso volvió.
   *Lo que hay que ver antes de firmarla, y que la redacción de D-7 esconde*: **el verificador
   trabaja antes del merge**, y "vivo" solo se puede comprobar **después**. Tal cual está escrita
   —*"el verificador no cierra una spec hasta que `/api/version` la contiene"*— la regla mueve el
   cierre de la spec a **después del merge**, lo que cambia el ciclo: el verificador emitiría GREEN
   sobre el árbol (como hoy), y el paso a `hecho` lo firmaría quien cierra tras el merge, con la
   puerta verde como evidencia.
   *Mi recomendación fue* adoptarla, pero con esa forma explícita y como convención local:
   > una spec pasa a `hecho` cuando su merge está en `main` **y** la puerta de despliegue de ese
   > merge está en verde (o, a mano, `node scripts/check-alive.mjs --url <origen> --commit <sha
   > del merge>` sale 0). El GREEN del verificador sigue siendo sobre el árbol.
   **El humano la aceptó entera, con el matiz incluido** —que es lo que la hizo firmable— y con el
   sitio propuesto: `docs/fundacion/reglas.md`, sección *"Reglas de ingeniería (RI-xx)"* que **ya
   existe** (precedente `RI-01`, de SPEC-032), como **RI-02**. Entra en esta misma entrega como
   **CA-14**, marcado 🔒 **sin desplegar**: lo que el CA comprueba es que la regla **está escrita**
   con ese contenido, su fuente y su mecanismo —y que `RI-01` y las quince `RN` siguen intactas—,
   no que alguien la cumpla. Eso lo comprueba un test estático, y por eso no necesita despliegue.
   *Quién la escribe*: el **implementador** al cerrar CA-14. El arquitecto no toca
   `docs/fundacion/reglas.md`, igual que en SPEC-032.
   *Ojo al alcance, y sigue vigente*: ADR-018 llama a D-7 *"recomendación de proceso"* y avisa de
   que **el ciclo tremen-sdd es del plugin, no de Stockeiro**. Lo adoptado aquí es una **convención
   local**; llevarlo al plugin sería un `KI` para su mantenedor y **no es trabajo de esta spec**
   (§Fuera de alcance). `F-SPEC-031-1` queda **cerrado**: este era el gate al que estaba citado.

3. ✅ **RESUELTO (gate del 2026-08-18) — el atraso se drena A MANO antes de conectar.** Era la
   **pregunta 8 del gate de ADR-018**, reformulada por los hechos.
   *La pregunta original* —*"¿se despliega SPEC-023 antes o después de montar el pipeline?"*— **ya
   está respondida, y no por decisión sino por los hechos**: SPEC-023 se desplegó a mano el
   2026-08-18 y está **viva y probada de punta a punta** (runbook §8). Lo que queda abierto es más
   grande: **hay cinco specs mergeadas y mudas** —SPEC-026, 027, 029, 031, 032— y una **migración
   sin aplicar** (`0008_puzzling_eddie_brock`, `ADD COLUMN instrument_type`, aditiva). Medido hoy:
   `/api/version` responde **404** en producción.
   *Mi recomendación, aceptada por el humano*: **drenar el atraso a mano primero**, con el
   procedimiento que ya funcionó el 2026-08-18 (`git switch --detach origin/main` + `vercel --prod --archive=tgz`, runbook §8 paso
   4), **y después** conectar el repo. Motivo: es exactamente el consejo del propio ADR —*"acopla
   dos riesgos independientes en un solo día"*— aplicado a cinco pasajeros en vez de uno. Si el
   primer despliegue automático falla, quiero saber si falló el pipeline o el atraso, no las dos
   cosas a la vez. Y tiene un premio: drenado el atraso, el **primer despliegue automático de la
   historia del proyecto sería el de esta misma spec**, que no toca `src/` — el pasajero más
   inofensivo posible para estrenar el pipeline.
   *La alternativa* —conectar y que el atraso sea el primer pasajero— era defendible y más rápida
   (una sola operación, y el riesgo real del atraso es bajo: una migración aditiva y cambios ya
   verificados), y quedó **descartada**. El orden firmado vive en §Acciones de ops: **drenar →
   verificar que `/api/version` deja de dar 404 → `ALLOW_MIGRATE=1` en Preview → conectar el repo**.
   *Detalle que no conviene pasar por alto*: un despliegue manual sigue respondiendo
   `commit: unknown` (la CLI sube sin `.git`), así que tras drenar, `check-alive` saldrá con **2** —
   y eso será **correcto**, no un fallo. El `0` llega con el primer despliegue automático.

4. ✅ **RESUELTO (gate del 2026-08-18) — el e2e sigue en cada PR, sin cambios.** Era la
   **pregunta 6 de ADR-018**. Entra hoy en cada PR (SPEC-027) y **recomendé dejarlo así**: es lo que atrapa las regresiones de flujo, y con
   el punto 1 sin resolver es la única red que queda antes de producción. Lo que **sí cambia** con
   esta spec, y conviene tenerlo delante al confirmar: cada PR pasa a costar además **un build de
   Vercel y una rama de Neon**, no solo minutos de GitHub Actions. La cuota de Actions sigue
   sobrada (~6-9 min por pasada sobre ~2.000/mes); el recurso escaso pasa a ser **el techo de 10
   ramas de Neon** del plan Free, agravado porque **las ramas de preview sobreviven al cierre de la
   PR** (retención de 6 meses de Vercel). Con una PR a la vez no molesta; con diez acumuladas,
   bloquea las previews (`Require Active Resource Before Deploy`). Queda documentado (CA-13.3) y
   vigilarlo es ops.

5. ✅ **RESUELTO (gate del 2026-08-18) — la ventana de restauración de Neon queda como dato que
   el humano mirará por su cuenta; no bloquea.** Era la **pregunta 7 de ADR-018**. Sigue **sin
   medirse** y sigue siendo **la red última** ante una migración destructiva, ahora con el freno
   humano retirado. Recomendé mirarla en la consola de Neon antes de aprobar —es un dato, no una
   decisión, y cuesta cinco minutos—; el humano prefirió no bloquear la spec por ello. Si la
   ventana resulta corta, `RI-01` deja de ser prudencia y pasa a ser lo único que hay, que es
   literalmente lo que dice ADR-018 D-5. El runbook la nombra (CA-12.4); medirla sigue siendo ops.

6. 🔧 **`F-SPEC-032-2` (`ALLOW_MIGRATE=1` en Preview): partido en dos, y así queda.** El encargo
   preguntaba si debía ser CA de esta spec en vez de acción de ops. Mi respuesta, que el gate no
   objetó: **las dos cosas, cada una en su sitio**.
   - **El acto sigue siendo ops** (§Acciones de ops, #1): nadie puede ejecutar `vercel env add`
     desde un test, y un CA que el verificador no puede comprobar desde el artefacto degenera en
     casilla marcada.
   - **Su efecto pasa a ser CA** (**CA-3.1**): con el repo conectado, *"la Preview de esta PR
     construye verde"* **es** la prueba de que la variable existe — si faltara, la guardia
     *fail-closed* tumbaría el build. Es un observable barato, imposible de falsear y que solo
     existe a partir de esta spec.
   La alternativa —dejarlo solo como ops— habría caído CA-3.1 sin mover nada más, pero entonces
   nadie comprobaría nunca que la variable está puesta hasta que una preview se rompiera.

7. 🌐 **La puerta interroga `https://stockeiro.tremen.dev`, no `stockeiro-lemon.vercel.app`**
   (CA-5). Es una decisión mía y la señalo por si la quieres al revés: interrogar el dominio propio
   comprueba de una vez el despliegue, el alias de producción y el CNAME de Cloudflare, que es la
   cadena que el usuario recorre. El coste es que un fallo de DNS pinta la puerta de rojo aunque el
   despliegue esté perfecto — y eso, en mi opinión, **es un rojo correcto**: si el dominio no
   responde, la app no está viva para nadie.

8. ⏲️ **El plazo de la puerta son 15 minutos** (CA-7). ADR-018 midió builds de ~40 s, pero desde
   entonces el `buildCommand` ejecuta la guardia y las migraciones, y a la propagación del alias
   hay que darle aire. Prefiero un plazo generoso: **una puerta que se pone roja porque el build
   fue lento enseña a ignorarla**, y una puerta ignorada no es una puerta. Si te parece demasiado
   laxo, bajarlo es cambiar un número en el workflow.

9. ✋ **Lo que esta spec NO arregla, dicho en voz alta.** El rojo de la puerta **no revierte nada**
   (ADR-018 lo excluye a propósito): avisa. Si un merge rompe producción, quien lo arregle sigue
   siendo una persona con `vercel rollback` —que **devuelve el código, no el esquema**— y con
   RI-01 como la razón por la que, si todo el mundo la respeta, el esquema viejo sigue sirviendo al
   código viejo. Esa es toda la red que hay, y merece leerse dos veces antes de firmar.
