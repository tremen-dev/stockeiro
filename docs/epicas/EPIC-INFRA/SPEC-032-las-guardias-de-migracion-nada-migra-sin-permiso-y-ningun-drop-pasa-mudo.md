---
id: SPEC-032
tipo: spec
epica: EPIC-INFRA
estado: en-progreso
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-18, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-18, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-18, por: sdd-implementador}
---
# SPEC-032 — Las guardias de migración: nada migra sin permiso y ningún DROP pasa mudo

> Origen: **F-SPEC-027-2**, abierto por el arquitecto de SPEC-027 al separar el punto 1 del
> desglose de **ADR-018**: *"`guard-migrate` (ADR-018 D-2) y escáner de SQL destructivo
> (D-5.2). Fuera de alcance aquí porque la ventana que protegen no se abre sin integración
> Vercel↔GitHub. **Bloqueante de SPEC-028**: deben entrar antes de conectar el repo."*
>
> Implementa **ADR-018 D-2** (guardia *fail-closed* delante de `db:migrate`), **ADR-018 D-5.2**
> (detección automática de SQL destructivo con desbloqueo explícito y escrito) y —desde el gate
> del **2026-08-18**— **ADR-018 D-5.1**: la política de migraciones aditivas se adopta como
> **regla del proyecto** y aterriza en `docs/fundacion/reglas.md` como **RI-01**, en una sección
> nueva de *reglas de ingeniería* separada de la serie de dominio RN-01…RN-15. Eso responde la
> **pregunta 2 del gate de ADR-018**, abierta desde el 2026-08-17, y es **CA-15**.
>
> **Es el último bloqueante de SPEC-028.** Los otros dos ya están vivos: la identidad del
> despliegue (**SPEC-031**, `hecho` y mergeada el 2026-08-18) y la BD de Preview separada
> (**F-SPEC-023-1**, cerrada por ops el 2026-08-18 activando *preview branching* en la
> integración nativa de Neon). ADR-018 dice por qué estas dos guardias van **antes** de
> conectar el repo: *"la guardia y el escáner **son** el sustituto del freno humano, y
> separarlos abre una ventana en la que existe la automatización sin su contrapeso"*.
>
> **Nota de id.** No es 028 —reservado para el despliegue automático desde `main` y
> referenciado por nombre desde ADR-018 y desde los ledgers de SPEC-027 y SPEC-031— ni 022
> —id libre en el árbol, pero ADR-018 §Frontera y el ledger de SPEC-023 ya lo usan con otro
> significado (observabilidad del ciclo de refresco) para un documento que nunca existió;
> reutilizarlo crearía una colisión de significado—.
>
> **Esta spec se cierra en local y en CI, sin desplegar nada.** Es la misma restricción que
> hizo verificable a SPEC-031, y aquí es todavía más importante: lo que se entrega es
> precisamente el código que se ejecuta *dentro de un build de Vercel*, y no se puede pedir
> un despliegue para demostrar que funciona.

## Problema

**Hoy lo único que impide que una migración destructiva entre en producción es que un humano
decida teclear `vercel --prod`.** ADR-018 lo llama el *freno 1* y lo describe sin adornos: el
`buildCommand` migra **antes** de construir, en **todos** los entornos, y nadie mira el SQL
antes de que se aplique. Ese freno es exactamente el que SPEC-028 va a retirar.

Son dos agujeros distintos y hace falta una respuesta para cada uno.

### Agujero 1 — el build migra la base a la que apunte, sea cual sea

`vercel.json` fija hoy:

```json
"buildCommand": "npm run db:migrate && npm run build"
```

Ese comando corre en **cualquier** entorno de Vercel, no solo en Production. La propiedad
valiosa se conserva (si la migración falla, el `&&` corta, el build falla y **no se
despliega**: se queda la versión anterior), pero no hay nada en el repositorio que diga
*"este entorno no tiene permiso para migrar"*. La única razón por la que eso no ha explotado
todavía es que **nada dispara builds que no sean los manuales de producción**: no hay
integración Vercel↔GitHub (verificado en ADR-018 el 2026-08-17, sin cambios desde entonces).

El 2026-08-18 esa foto cambió a medias, y conviene decir exactamente en qué:

- **F-SPEC-023-1 está cerrado.** La integración nativa de Neon tiene activado *preview
  branching*: `Create Database Branch For Deployment` = **Preview sí, Production no**, con
  prefijo de variables `DATABASE`. Un build de Preview recibe la `DATABASE_URL` de **su
  propia rama copy-on-write** de Neon, no la de producción.
- **Eso reduce el riesgo, no lo cierra.** El *preview branching* es un ajuste de un panel que
  nadie audita y que nadie versiona: se puede desactivar, se puede desconectar el recurso, se
  puede crear un entorno nuevo (Development, o un entorno personalizado) que herede la
  `DATABASE_URL` de siempre. ADR-018 D-2 pide justamente lo contrario de un ajuste de panel:
  una guardia que *"vive en el repo […], es verificable con un test unitario, y sobrevive a
  cualquier reconfiguración de Vercel"*.

Dicho en una frase: **la separación de bases responde "contra qué base migro"; la guardia
responde "tengo permiso para migrar aquí"**. Son preguntas distintas y hoy la segunda no se
la hace nadie.

### Agujero 2 — el SQL destructivo entra sin que nadie lo lea

`drizzle/` tiene hoy **9 migraciones**, y **ninguna** ha pasado nunca por una revisión que
mire específicamente qué destruye. Medido en este worktree el 2026-08-18, censando todas las
sentencias de los 9 ficheros:

| Migración | Qué hace | ¿Destructiva? |
|---|---|---|
| `0000_real_tusk` | 7 `CREATE TABLE` + 10 `ADD CONSTRAINT` | no |
| `0001_symbol_market_identity` | 3 `ADD COLUMN`, 1 `CREATE INDEX`, 1 `ADD CONSTRAINT` y **1 `DROP CONSTRAINT`** (relaja la unicidad de `ticker`) | **sí** |
| `0002_symbol_aliases` | `CREATE TABLE` + `CREATE INDEX` + 2 `ADD CONSTRAINT` | no |
| `0003_import_idempotency` | 2 `ADD COLUMN` + 1 `ADD CONSTRAINT` | no |
| `0004_backfill_operating_mic` | 3 `UPDATE` (relleno de datos) | no *(ver CA-7)* |
| `0005_quote_diagnostics` | `CREATE TABLE` + `ADD CONSTRAINT` | no |
| `0006_chemical_chronomancer` | `CREATE TABLE` + `ADD COLUMN` + `ADD CONSTRAINT` | no |
| `0007_tearful_roughhouse` | **2 `DROP CONSTRAINT`** + 2 `ADD CONSTRAINT` (SPEC-024: repone dos claves foráneas con `ON DELETE cascade` / `set null`) | **sí** |
| `0008_puzzling_eddie_brock` | 1 `ADD COLUMN` (SPEC-029, `instrument_type`) | no |

**Dos de nueve.** Es la misma calibración que ADR-018 midió sobre 8 (`0008` es posterior y es
aditiva), y su lectura sigue valiendo entera: *"ambas son legítimas y ambas merecen que
alguien las mire: `0007` **habilita borrados en cascada**, que es justo el tipo de cambio que
no debe entrar sin que nadie lo lea. Dos marcas de ocho es ruido asumible, y las dos son
verdaderos positivos."*

Hoy no hay nada que las marque. Y lo que hay debajo tampoco consuela: **`vercel rollback`
devuelve el código, no el esquema**; un rollback tras una migración destructiva deja código
viejo contra un esquema mutilado. La red última es el historial de restauración de Neon, cuya
ventana real **sigue sin comprobarse** (pregunta 7 del gate de ADR-018).

### Lo que ya existe y no hay que rehacer

- **El estreno de las migraciones en cada pasada** lo entregó **SPEC-026** (ADR-019): los
  arneses unitarios aplican `drizzle/` sobre PGlite, `tests/schema-source.test.ts` las aplica
  una a una en orden de journal, y el e2e las corre sobre un Postgres 17 efímero. Es el tercer
  sustituto de D-5 y **ya está vivo**: esta spec no lo toca.
- **El sitio donde ejecutar cosas en cada PR** lo entregó **SPEC-027**: `.github/workflows/ci.yml`,
  dos jobs (`CI / Checks` y `CI / E2E`), **un step por gate** con nombre visible, y
  `tests/ci-workflow.test.ts` como test estático que parsea el YAML de verdad.
- **La convención de `scripts/`** la estrenó **SPEC-031** con `scripts/check-alive.mjs`: solo
  biblioteca estándar de Node, sin secretos, `--help`, y **códigos de salida documentados como
  contrato**. ADR-018 anticipa que ahí viven `guard-migrate.mjs` y el escáner. Esta spec es la
  que cumple esa previsión, y **reutiliza la convención tal cual**.

Ninguna regla de negocio (`docs/fundacion/reglas.md`, RN-01…RN-15) está implicada: esta spec
no toca dominio, ni esquema, ni UI. Añade **una migración cero**.

## Usuarios / roles afectados

- **Operador / mantenedor** (el humano que despliega, y mañana el pipeline de SPEC-028): es
  quien hoy hace de guardia sin saberlo, y quien deja de hacerlo cuando el despliegue se
  automatice. Las dos piezas de esta spec son su sustituto.
- **sdd-implementador de cualquier spec futura que toque esquema**: a partir de aquí, una
  migración destructiva **no pasa el CI** hasta que alguien escriba por qué y cómo se vuelve
  atrás. Es el rol que más nota el cambio, y por eso el mensaje de error tiene su propio CA
  (CA-10).
- **sdd-verificador**: gana un gate más que leer, con nombre propio en la lista de checks.
- **Usuario final**: no percibe nada. Ninguna pantalla cambia, ningún dato se toca.

## Criterios de aceptación

Todos se verifican **en local y en CI, sin desplegar** y **sin red**. Se apoyan en las tres
formas de prueba que el proyecto ya usa (SPEC-027 y SPEC-031):

- **Unitarios (Vitest)** sobre las funciones puras de decisión y de detección.
- **Tests estáticos** que **parsean** ficheros de configuración (`vercel.json`,
  `.github/workflows/ci.yml`, `package.json`), nunca regex sobre el texto crudo.
- **Subproceso real** (`execFile`) contra los dos scripts, con entornos y directorios de
  migraciones sintéticos creados en un temporal dentro del propio test.

### La guardia del build — `scripts/guard-migrate.mjs` (ADR-018 D-2)

- **CA-1 (Existe, vive en el repo y no puede filtrar nada).**
  Dado el repositorio,
  cuando se añade `scripts/guard-migrate.mjs` (segundo habitante de `scripts/`, tras
  `check-alive.mjs`),
  entonces:
  1. Se invoca sin argumentos (`node scripts/guard-migrate.mjs`) y decide leyendo **solo** el
     entorno; `--help` imprime su contrato y sale con **0**.
  2. **No importa nada fuera de la biblioteca estándar de Node** (`node:*`): ni una dependencia
     de `package.json`, ni el código de la app. Corre en el build de Vercel **antes** de que
     nada garantice que `node_modules` sirva para algo.
  3. Los **códigos de salida** son el contrato y están documentados en la cabecera del fichero
     y en `--help`: **0** autoriza la migración · **1** la rechaza · **2** uso incorrecto.
     Cualquier valor distinto de 0 corta el `&&` del `buildCommand`, que es el mecanismo
     entero.
  *Verificación*: test estático (el fichero existe, todos sus `import` son `node:*`) +
  ejecución de `--help` como subproceso.
  *Por qué stdlib*: misma razón que CA-8.2 de SPEC-031, y una más — la guardia se ejecuta en
  la primera línea del `buildCommand`, y una guardia que depende de que la instalación haya
  ido bien es una guardia que se cae justo cuando el build es raro.

- **CA-2 (Fail-closed: la tabla de decisión completa, sin huecos).**
  Dado el proceso de la guardia,
  cuando se ejecuta con un entorno cualquiera,
  entonces decide **exactamente** así, comparando el valor de `ALLOW_MIGRATE` **tras recortar
  espacios** con la cadena `1`:

  | `VERCEL_ENV` | `ALLOW_MIGRATE` | Decisión | Salida |
  |---|---|---|---|
  | `production` | cualquier valor, o ausente | **autoriza** | 0 |
  | `preview` | `1` | **autoriza** | 0 |
  | `preview` | ausente, vacío, `0`, `true`, `yes`, o cualquier otra cosa | **rechaza** | 1 |
  | `development` o cualquier otro valor | `1` | **autoriza** | 0 |
  | `development` o cualquier otro valor | cualquier otra cosa | **rechaza** | 1 |
  | **ausente** (no hay `VERCEL_ENV`) | `1` | **autoriza** | 0 |
  | **ausente** | cualquier otra cosa | **rechaza** | 1 |

  La propiedad que fija ADR-018 D-2, en una línea: **un build que no sea de producción no
  migra, salvo que el entorno donde corre lo autorice de forma explícita; por omisión, no
  migra: falla.** La última fila es la parte *fail-closed* que importa: **la ausencia de
  `VERCEL_ENV` es un rechazo**, no un "no sé, adelante".
  *Verificación*: unitarios sobre la función pura de decisión (una fila = un caso, la tabla
  entera) + un subproceso por cada una de las tres decisiones distintas, comprobando el código
  de salida real.
  *Nota de nombre*: ADR-018 escribe la variable como *"p. ej. `ALLOW_MIGRATE=1`"* y deja
  explícito que *"el nombre y la forma exacta los fija la spec"*. Esta spec los fija:
  `ALLOW_MIGRATE`, valor literal `1`. Ver §Notas para el gate, punto 6.

- **CA-3 (Dice en voz alta qué autorizó y contra qué base, sin credenciales).**
  Dado un build,
  cuando la guardia **autoriza**,
  entonces imprime en su salida estándar el `VERCEL_ENV` que vio, por qué autorizó (producción
  o permiso explícito) y **el host y el nombre de base** de `DATABASE_URL` — y **nada más de
  esa URL**: ni usuario, ni contraseña, ni parámetros de la cadena de conexión.
  Y cuando **rechaza**, su salida de error dice las tres cosas que hacen falta para
  desatascarse sin adivinar: qué entorno vio, **qué variable con qué valor exacto** lo
  autorizaría, y que **la base no se ha tocado**.
  *Por qué el host en el log*: es lo único que deja rastro escrito de *contra qué base migró
  este build*, y es exactamente el dato que faltaría el día que alguien apague el *preview
  branching* sin darse cuenta (§Notas para el gate, punto 3). No previene: delata, que es
  todo lo que un log puede hacer.
  *Verificación*: subproceso con una `DATABASE_URL` sintética que lleve usuario y contraseña
  reconocibles; se afirma que el host y la base **sí** aparecen y que el usuario, la contraseña
  y la *query string* **no**. Y subproceso de rechazo afirmando sobre el texto.

- **CA-4 (Va en `vercel.json`, delante de la migración, y NO en `package.json`).**
  Dado `vercel.json`,
  cuando se lee tras esta spec,
  entonces su `buildCommand` es exactamente
  `node scripts/guard-migrate.mjs && npm run db:migrate && npm run build`:
  la guardia **primero**, encadenada con `&&`, y `db:migrate` **sigue dentro del build** (D-2:
  *"su propiedad valiosa es que si la migración falla, el `&&` corta […] Eso no se toca"*).
  Y `package.json` **no cambia** su script `db:migrate`: sigue siendo `drizzle-kit migrate` a
  secas.
  *Por qué no en `package.json`*: el runbook §1.1 documenta el camino manual
  (`DATABASE_URL="…" npm run db:migrate`) para preparar Neon o depurar fuera de un despliegue.
  Meter la guardia ahí lo rompería —no hay `VERCEL_ENV` en la máquina del humano— y
  convertiría una defensa en un estorbo, que es como mueren las defensas.
  *Verificación*: test estático que **parsea** `vercel.json` y afirma el orden de los tres
  eslabones y el separador `&&`; y que `package.json` conserva `db:migrate` sin envoltorio.

- **CA-5 (Nunca abre la base, nunca sale a la red).**
  Dado un entorno con `DATABASE_URL` apuntando a un host que no existe,
  cuando se ejecuta la guardia,
  entonces **decide igual y con el mismo código de salida**, sin intentar conexión alguna y sin
  esperar a ningún tiempo de espera de red.
  *Por qué es un CA y no una obviedad*: la guardia es lo primero que corre en el build, y la
  tentación evidente al implementarla es "ya que leo la `DATABASE_URL`, compruebo que responde".
  Eso la ataría a la red justo en el momento del build en que menos se puede permitir, y
  convertiría un fallo de red en un despliegue no hecho.
  *Verificación*: subproceso con `DATABASE_URL=postgres://u:p@no-existe.invalid:5432/x`,
  afirmando código de salida y que termina muy por debajo de cualquier tiempo de espera de red
  (holgura amplia, sin fijar milisegundos frágiles).

### El escáner de SQL destructivo — `scripts/scan-destructive-sql.mjs` (ADR-018 D-5.2)

- **CA-6 (Existe, es autosuficiente y no necesita ni git ni red).**
  Dado el repositorio,
  cuando se añade `scripts/scan-destructive-sql.mjs`, invocable como `npm run db:scan`,
  entonces:
  1. Lee los `.sql` de `drizzle/` **en el orden del journal** (`drizzle/meta/_journal.json`) y
     no necesita ninguna otra entrada: ni un `git diff`, ni una rama base, ni acceso a GitHub.
  2. **Solo importa `node:*`**, igual que la guardia y que `check-alive.mjs`.
  3. Códigos de salida documentados en la cabecera y en `--help`: **0** limpio (o todo
     desbloqueado por escrito) · **1** hay SQL destructivo sin desbloquear, o un desbloqueo
     inválido · **2** uso incorrecto o `drizzle/` ilegible.
  *Por qué escanea todo y no "lo nuevo de la PR"*: ADR-018 D-5.2 lo describe como *"escanea las
  migraciones nuevas de la PR"*, y una implementación por diff necesita una rama base — que no
  existe en un `push` a `main`, se comporta distinto en local, depende de la profundidad del
  clonado y muere en un worktree. Escanear **todo** siempre, con desbloqueos escritos (CA-9),
  da **el mismo veredicto para cada PR** y además deja documentadas las dos destructivas
  históricas, que es lo que el propio ADR pide que alguien mire. El desvío es de mecanismo, no
  de propiedad, y está **sancionado por el humano en el gate del 2026-08-18** (§Notas para el
  gate, punto 2).

- **CA-7 (Marca lo que ADR-018 D-5.2 enumera, y no marca folklore).**
  Dado un fichero de migración,
  cuando el escáner lo analiza,
  entonces **marca**, sin distinguir mayúsculas y respetando límites de palabra:
  `DROP` (tabla, columna, índice, restricción o lo que sea), `RENAME`, `TRUNCATE`,
  `DELETE FROM`, `ALTER COLUMN … SET NOT NULL` y `ALTER COLUMN … TYPE` / `SET DATA TYPE`.
  Y **no marca**:
  1. La palabra dentro de un **comentario** (`--` o `/* … */`) ni dentro de un **literal de
     cadena**. Se analiza sobre el SQL con comentarios y literales retirados, troceado por
     sentencias (`;` y el separador `--> statement-breakpoint` que genera drizzle-kit).
  2. `CREATE …`, `ADD COLUMN`, `ADD CONSTRAINT` ni ninguna otra sentencia aditiva.
  3. **`UPDATE`**, aunque toque datos. Es deliberado y merece decirse: la política
     *expand/contract* de D-5.1 **exige** el relleno (*"primero se añade y se rellena"*), así
     que marcar los backfills marcaría precisamente la mitad sancionada del patrón —
     `0004_backfill_operating_mic` es el ejemplo vivo— y enseñaría a desbloquear por rutina, que
     es como se rompe un gate. ADR-018 D-5.2 tampoco lo incluye en su lista. Ver §Notas para el
     gate, punto 5.
  *Verificación*: unitarios sobre la función pura de detección, con ficheros sintéticos por
  cada patrón marcado, por cada forma de no marcarlo (comentario de línea, comentario de
  bloque, literal, `CREATE TABLE dropped_things`) y por el caso `UPDATE`.

- **CA-8 (Calibración medida sobre el árbol de hoy: dos de nueve, y las siete limpias limpias).**
  Dado el `drizzle/` de este repositorio (9 migraciones, `0000`…`0008`),
  cuando se ejecuta el escáner,
  entonces marca **exactamente** `0001_symbol_market_identity` y `0007_tearful_roughhouse`, y
  **ninguna de las otras siete**.
  *Por qué se fija en un test y no se deja a la vista*: es la única forma de que una futura
  "mejora" del detector que empiece a marcar `ADD COLUMN` se caiga en rojo el mismo día, en vez
  de erosionar el gate hasta que se desbloquea todo por costumbre. La tasa de falsos positivos
  es parte del contrato.
  *Verificación*: unitario que ejecuta el detector sobre el `drizzle/` **real** del repositorio
  y compara el conjunto de ficheros marcados con la lista literal.

- **CA-9 (El desbloqueo es explícito, escrito y versionado).**
  Dado un fichero de migración marcado,
  cuando el repositorio incluye `drizzle/destructive-waivers.json` con una entrada para él,
  entonces el escáner sale con **0** si —y solo si— esa entrada trae **las tres cosas que pide
  ADR-018 D-5.2** (*"una marca deliberada […] con la justificación y el plan de vuelta atrás"*)
  más el conteo que la ata a lo que autoriza:

  ```json
  {
    "0007_tearful_roughhouse": {
      "spec": "SPEC-024",
      "reason": "…por qué hace falta destruir esto…",
      "rollback": "…cómo se vuelve atrás si sale mal…",
      "statements": 2
    }
  }
  ```

  Y sale con **1**, nombrando el problema, cuando:
  1. Falta la entrada de un fichero marcado.
  2. La entrada existe pero `spec`, `reason` o `rollback` están vacíos o ausentes: un
     desbloqueo sin justificación **no es un desbloqueo**, es una casilla marcada.
  3. `statements` no coincide con el número de sentencias destructivas encontradas hoy en ese
     fichero: cubre el caso de editar una migración ya desbloqueada para colarle una sentencia
     más. El mensaje dice el número real, para que corregirlo cueste un carácter.
  4. Hay un desbloqueo **huérfano**: nombra un fichero que no existe o que ya no marca nada. Un
     permiso que sobrevive a lo que permitía es ruido que enseña a no leer el fichero.
  Y en la misma entrega se **siembran** las dos entradas de hoy (`0001` y `0007`) con su
  justificación real y su plan de vuelta atrás, tomados de lo que ya está escrito en ADR-018 y
  en SPEC-024.
  *Verificación*: unitarios con un `drizzle/` sintético en un temporal —marcado sin desbloqueo,
  con desbloqueo completo, con `reason` vacío, con `statements` desfasado, con desbloqueo
  huérfano— más el caso real del repositorio (CA-8), que debe salir con **0** una vez sembrado.

- **CA-10 (El rojo es accionable sin abrir el código del escáner).**
  Dado un `drizzle/` con una migración destructiva sin desbloquear,
  cuando el escáner falla,
  entonces su salida de error nombra, por cada hallazgo: **el fichero**, la **línea**, la
  **sentencia** recortada, y a continuación **el fragmento JSON exacto** que hay que pegar en
  `drizzle/destructive-waivers.json` para desbloquearlo, con los campos vacíos por rellenar.
  *Por qué es un CA*: este mensaje es la interfaz de usuario de toda la spec. Un gate cuyo rojo
  no dice qué escribir se salta desactivándolo, y entonces no queda ni gate ni justificación.
  *Verificación*: subproceso contra el `drizzle/` sintético, afirmando sobre el texto (nombre
  de fichero, número de línea, y que el fragmento impreso es JSON válido con las cuatro claves).

### La integración: dos gates visibles y nada conectado

- **CA-11 (El escáner es un gate con nombre propio en la CI).**
  Dado `.github/workflows/ci.yml`,
  cuando se lee tras esta spec,
  entonces el job **`Checks`** tiene un step más, llamado **`Migration scan`**, que ejecuta
  `npm run db:scan` y **solo** eso, con `if: ${{ !cancelled() }}` como sus tres hermanos, de
  modo que un rojo suyo no tapa a los demás ni queda tapado por ellos.
  Y `tests/ci-workflow.test.ts` amplía su mapa `GATES` a **seis** entradas exactas
  (`Typecheck`, `Lint`, `Unit tests`, **`Migration scan`**, `Build`, `End-to-end tests`),
  conservando sus dos aserciones de contrato: un step invoca **un** script, y `Checks` lleva la
  lógica y `E2E` el flujo.
  *Por qué un step propio y no una línea dentro de otro*: es el requisito explícito del humano
  en SPEC-027 —un step por gate, que el nombre del check rojo diga qué se rompió— y el propio
  test estático lo impone.
  *Verificación*: `tests/ci-workflow.test.ts` (parseando el YAML) + la ejecución real de la CI
  en la PR, que el ledger recogerá.

- **CA-12 (`npm test` también lo ejecuta, invocando el mismo script).**
  Dado el repositorio en la máquina de cualquiera,
  cuando se ejecuta `npm test`,
  entonces el escáner corre sobre el `drizzle/` real —**como subproceso del mismo
  `scripts/scan-destructive-sql.mjs`**, sin reimplementar la detección en el test— y la suite
  falla si hay algo marcado sin desbloquear.
  *Por qué duplicar el gate*: es la lección de SPEC-026 al revés. Aquella guardia vivía **solo**
  en `npm test` porque no había CI, y heredó la fragilidad que venía a corregir. Esta vive en la
  CI (CA-11) *y* en la suite: la CI es la que impide el olvido, y la suite es la que te lo dice
  **antes** de empujar, cuando corregirlo cuesta un minuto. Lo que **no** se duplica es la
  lógica: hay una sola implementación y dos invocadores.
  *Verificación*: el propio test, y su coste medido en el ledger (se espera del orden de
  décimas de segundo: 9 ficheros pequeños, sin red y sin base).

- **CA-13 (El runbook explica las dos guardias, y deja de mentir sobre Preview).**
  Dado `docs/despliegue.md`,
  cuando se lee tras esta spec,
  entonces:
  1. Existe una sección que documenta **las dos guardias**: el nuevo `buildCommand`, la tabla de
     decisión de la guardia con sus códigos de salida, la variable `ALLOW_MIGRATE` (**qué es,
     dónde debe existir y qué pasa si falta**), el escáner, y cómo se escribe un desbloqueo en
     `drizzle/destructive-waivers.json`.
  2. **§1.1 y §6 quedan al día**: donde hoy se cita `"npm run db:migrate && npm run build"` como
     el `buildCommand`, se cita el nuevo; y el gotcha de *Preview* —*"un deploy de Preview
     también migra la BD a la que apunte"*— se reescribe con lo que hay hoy: **`DATABASE_URL`
     por rama de Neon vía preview branching** (cierre de **F-SPEC-023-1**, 2026-08-18) **más**
     la guardia como segunda línea que no depende de ese ajuste.
  3. La nota de cabecera que hoy lista **F-SPEC-023-1** como `⏳ pendiente` pasa a **cerrado**
     con su fecha, y la sección *"Nota sobre Preview y la BD de producción"* deja de describir
     una `DATABASE_URL` compartida como estado actual.
  *Alcance estricto*: la documentación es de **uso manual y de contrato**. El runbook **no**
  describe despliegue automático, ni conexión a Vercel, ni puerta post-deploy: eso es SPEC-028.
  Y **poner `ALLOW_MIGRATE=1` en el entorno Preview de Vercel es una acción de ops que esta spec
  documenta pero no ejecuta** (§Fuera de alcance).
  *Verificación*: test estático sobre el runbook, al estilo de `tests/runbook-check-alive.test.ts`
  (aparecen `guard-migrate`, `ALLOW_MIGRATE` y `db:scan`; ya no aparece el `buildCommand` viejo
  como si fuera el vigente) + lectura humana en la revisión.

- **CA-14 (Nada queda conectado: esta spec no despliega ni cambia cómo se dispara un despliegue).**
  Dado el diff completo de la spec,
  cuando se inspecciona,
  entonces:
  1. El workflow **no gana ningún step que hable con la red**, con Vercel o con Neon, ni ninguna
     referencia a `secrets.`; sigue con `permissions: contents: read` y sin migrar nada
     (la aserción 5.3 de `tests/ci-workflow.test.ts` sigue verde: ningún step invoca
     `db:migrate`).
  2. **No se conecta el repositorio a Vercel**, no se añade puerta post-deploy y no se toca
     `/api/version` ni `scripts/check-alive.mjs`.
  3. **No se añade ni una migración** ni se toca `src/db/schema.ts`: `drizzle/` gana un fichero
     de desbloqueos y ni un `.sql`.
  4. La suite completa pasa **sin red**: ninguno de los tests nuevos sale a internet ni abre una
     base de datos gestionada.
  *Por qué es un CA y no una promesa*: es la garantía de que el verificador puede cerrar esta
  spec sin desplegar. Un step "ya que estamos" que llamase a producción la convertiría en
  incerrable, que es justo el error que ADR-018 quiso evitar separando el punto 3 del 4.
  *Verificación*: `tests/ci-workflow.test.ts` + `git diff` acotado (ni `.sql` nuevo, ni cambios
  en `src/`) + la propia ejecución del CI.

### La regla que el gate firmó (ADR-018 D-5.1)

- **CA-15 (La política de migraciones aditivas queda escrita como regla del proyecto, y con
  numeración propia).**
  Dado `docs/fundacion/reglas.md`,
  cuando se lee tras esta spec,
  entonces:
  1. Existe una **sección nueva al final**, titulada **"Reglas de ingeniería (RI-xx)"**,
     **separada** de la serie de dominio `RN-01`…`RN-15` y que no altera ninguna de ellas: ni
     renumera, ni reescribe, ni añade un `RN-16`.
  2. Esa sección contiene **RI-01** con este contenido:
     > **RI-01** (Migraciones aditivas, *expand/contract*): una migración no borra, no renombra y
     > no estrecha una columna **en el mismo despliegue** que cambia el código. Lo destructivo se
     > parte en dos despliegues separados por al menos un despliegue verde: primero se añade y se
     > rellena; después, en otra spec, se retira lo viejo. El incumplimiento se detecta
     > automáticamente (SPEC-032) y **solo se desbloquea por escrito**, con justificación y plan
     > de vuelta atrás, en `drizzle/destructive-waivers.json`. Fuente: ADR-018 D-5.1.
  3. La regla **cita su fuente** (`ADR-018 D-5.1`) y **el mecanismo que la hace cumplible**
     (esta spec y el fichero de desbloqueos), de modo que quien la lea sepa quién la decidió y
     quién la vigila.
  *Por qué numeración aparte y no `RN-16`*: hoy `reglas.md` contiene **solo reglas de negocio**,
  todas con su *"Fuente: sdd-cartera"* o *sdd-mercados*, y las specs las citan como `RN-xx`.
  Meter una regla de ingeniería en esa serie ensucia una numeración que dos skills de dominio
  vigilan. La serie `RI-xx` nace aquí para ese uso.
  *Alcance estricto*: **se escribe la regla, no se reescribe nada más**. Ni `FOUNDATION.md`, ni
  ADR-018 —que es inmutable y no se toca: esta regla es la **respuesta** a su pregunta 2 del
  gate, no una enmienda—, ni ninguna spec anterior.
  *Verificación*: test estático sobre `docs/fundacion/reglas.md` (existe la sección de reglas de
  ingeniería; existe `RI-01`; menciona *expand/contract*, el desbloqueo por escrito,
  `drizzle/destructive-waivers.json` y `ADR-018 D-5.1`; y **siguen estando las quince RN
  originales, sin cambios**) + lectura humana en la revisión.
  *Nota de autoría*: el arquitecto **no** escribió esta regla al redactar la spec, a propósito:
  era una decisión del humano y estaba abierta. Firmada en el gate del **2026-08-18**, la
  escribe el implementador al cerrar este CA.

## Entidades y reglas afectadas

- **Ninguna entidad de dominio, ninguna RN.** No se toca `src/db/schema.ts`, no hay migración
  nueva, no cambia ninguna pantalla ni ningún servicio. Lo único que se añade a `drizzle/` es
  `destructive-waivers.json`, que drizzle-kit ignora (lee `meta/_journal.json` y los `.sql`
  que este enumera).
- **ADR-018 D-2** — la decisión que gobierna la guardia. La propiedad la fija el ADR (*"un build
  que no sea de producción no migra, salvo que el entorno donde corre lo autorice de forma
  explícita"*); el ADR delega expresamente en la spec *"el nombre y la forma exacta"*, y esta
  los fija en CA-1…CA-5.
- **ADR-018 D-5.2** — la decisión que gobierna el escáner: qué patrones, fallar la PR, y
  desbloqueo explícito y escrito. **Desvío de mecanismo, firmado en el gate del 2026-08-18**: el
  desbloqueo se escribe en un fichero versionado del repositorio, no como *"una marca deliberada
  en la PR"*. Motivos en CA-6 y en §Notas para el gate, punto 2; la propiedad —que destruir exija
  decir por escrito por qué y cómo se vuelve atrás— se cumple igual, y mejor: queda en el diff y
  sobrevive a la PR. El ADR **no se modifica**: es inmutable, y apartarse de su redacción con
  firma del humano no es enmendarlo.
- **ADR-018 D-5.1** — la política de migraciones aditivas. **Adoptada como regla del proyecto en
  el gate del 2026-08-18** (Alberto Fojo), lo que responde la **pregunta 2 del gate de ADR-018**,
  abierta desde el 2026-08-17. Esta spec entrega su **mecanismo de detección** (el escáner) *y*
  la escribe donde se cita: `docs/fundacion/reglas.md`, como **RI-01** en una sección de reglas
  de ingeniería aparte de la serie de dominio → **CA-15**.
- **`docs/fundacion/reglas.md`** — gana una sección y una regla (`RI-01`), y **ninguna de sus
  quince RN se toca**. Es el único fichero de `docs/fundacion/` que esta spec modifica; ni
  `FOUNDATION.md`, ni `contexto.md`, ni `dominio.md` cambian.
- **ADR-018 D-3** — *ningún entorno que no sea Production tendrá credenciales de la BD de
  Production*. Se materializó por ops el 2026-08-18 con *preview branching* de Neon (cierre de
  **F-SPEC-023-1**). Esta spec añade el mecanismo que D-2 pedía **precisamente para no depender
  de que esa invariante se respete**.
- **ADR-018 D-4** — regla dura heredada: *el CI nunca apunta `db:migrate` a una base gestionada*.
  CA-14.1 la conserva; el step nuevo solo lee ficheros del repositorio.
- **ADR-019 / SPEC-026** — el estreno de las migraciones en cada pasada, que es el tercer
  sustituto de D-5 y **ya está vivo**. Esta spec no lo toca y no duplica su canario.
- **SPEC-027** — aporta el workflow, el patrón de test estático que parsea de verdad
  (`tests/ci-workflow.test.ts`) y el requisito de *un step por gate* que CA-11 respeta. Su
  **F-SPEC-027-1** (la CI informa pero **no impide** mezclar: el plan de GitHub de la
  organización no ofrece protección de rama en repo privado) **también se aplica a este gate**:
  el escáner en rojo **no bloquea el merge**, lo publica. Es una limitación conocida, sin efecto
  sobre la guardia de build —que no depende de GitHub en absoluto—.
- **SPEC-031** — estrena `scripts/`, la convención de *stdlib-only, sin secretos, `--help`,
  códigos de salida como contrato*, y el patrón de probar un script por subproceso. Esta spec la
  reutiliza entera y cita explícitamente su punto 5 de gate: *"`guard-migrate.mjs` y el escáner
  aterrizarán ahí después"*.
- **`docs/despliegue.md`** — §1.1, §6 y la cabecera quedan al día por CA-13. El runbook es la
  única documentación operativa del proyecto y hoy describe un `buildCommand` que dejará de ser
  el vigente.
- **No se escribe ADR nuevo (no hay ADR-021).** Todo lo que esta spec decide —nombres de fichero
  y de variable, valor literal `1`, códigos de salida, formato del desbloqueo, escaneo total en
  vez de por diff— es mecanismo dentro del margen que ADR-018 deja explícito para D-2 y de la
  propiedad que fija D-5.2. La única decisión con vocación de constreñir todo el trabajo futuro
  —**adoptar la política de migraciones aditivas como regla del proyecto (D-5.1)**— es una
  pregunta de gate de ADR-018 que **no me corresponde responder**: si el humano la firma, su
  sitio es `docs/fundacion/` (§Notas para el gate, punto 1), y si hiciera falta blindarla con un
  ADR, sería uno escrito **después** de esa firma y sobre lo que la firma decida, no antes.

## Fuera de alcance

Aparcado a propósito, y casi todo con dueño y nombre:

- **Conectar el repositorio a Vercel, el despliegue automático desde `main`, la puerta
  post-deploy que exige el sha y la reescritura del runbook para todo eso** → **SPEC-028**
  (ADR-018 D-1 y D-6). Esta spec le entrega el contrapeso que ADR-018 exige tener **antes**.
- **Poner `ALLOW_MIGRATE=1` en el entorno Preview de Vercel.** Es una **acción de ops** (un
  `vercel env add`), no código, y no se puede verificar desde el repositorio. Esta spec la
  **documenta** (CA-13.1) y la deja marcada como **prerrequisito de SPEC-028**: mientras no
  exista integración Git no se disparan builds de Preview, así que hoy no rompe nada; el día que
  SPEC-028 conecte el repo **sin** esa variable, todas las previews fallarán en la guardia — que
  es el comportamiento correcto (ADR-018 D-3: *"fallan en rojo y en la PR, nunca en silencio
  contra producción"*), pero conviene que sea una decisión y no una sorpresa.
- **Adoptar D-7** (*"hecho" pasa a exigir "vivo"*). **Aplazado en el gate de SPEC-031** al gate
  de SPEC-028 → **F-SPEC-031-1**. Esta spec no lo toca ni lo empuja.
- **Tocar la serie `RN-xx` de `docs/fundacion/reglas.md`.** La regla nueva entra como **RI-01**
  en una sección aparte (CA-15): ninguna regla de dominio se renumera, se reescribe ni se
  deroga. *(Escribir la regla **sí** entra en la spec desde el gate del 2026-08-18; lo que queda
  fuera es cualquier otra cosa en ese fichero.)*
- **Impedir el merge con el gate en rojo** → **F-SPEC-027-1**: no es un ajuste pendiente, es que
  el plan de GitHub de la organización no lo ofrece (`403 Upgrade to GitHub Pro`). Decisión del
  humano, con precio, y ajena a esta spec.
- **Detectar `UPDATE`, `INSERT` u otras sentencias de datos** (CA-7.3), y en general ampliar la
  lista de patrones más allá de la que enumera ADR-018 D-5.2. Ensancharla es fácil y barato el
  día que un incidente lo justifique; hacerlo hoy, sin caso, sube la tasa de desbloqueos por
  rutina.
- **Comprobar la ventana de restauración de Neon** (pregunta 7 del gate de ADR-018). Sigue sin
  medirse y sigue siendo la red última; es una comprobación de ops, no código.
- **Verificar desde el build que la `DATABASE_URL` de un Preview no es la de producción.** Sería
  la defensa que cierra del todo el residual del punto 3 de §Notas, pero exige conocer la
  identidad de la base de producción dentro del repositorio (o un marcador que la integración de
  Neon no garantiza). No se inventa aquí: queda como follow-up con destino SPEC-028.
- **Tocar el código de la aplicación, el esquema o los tests existentes**, salvo la ampliación
  del mapa `GATES` de `tests/ci-workflow.test.ts` que exige CA-11.
- **Cualquier `alerting`.** ADR-018 §Frontera: ninguna de estas piezas avisa a nadie. La guardia
  falla un build; el escáner pinta un check en rojo. Quien mire, verá.

## Notas para el gate humano

Lo que había que decidir o mirar con lupa antes de aprobar. **El gate se celebró el 2026-08-18
(Alberto Fojo) y la spec quedó aprobada**: los cuatro primeros puntos eran decisiones suyas y los
cuatro están resueltos. Se dejan escritos **con su resolución, no borrados**, porque la resolución
es parte del contrato; del punto 5 en adelante es información que sigue valiendo tal cual.

1. ✅ **RESUELTO (gate del 2026-08-18) — se adopta D-5.1 como regla del proyecto, y va a
   `docs/fundacion/reglas.md` como `RI-01` en sección aparte. Es CA-15.**
   *La pregunta era* la **pregunta 2 del gate de ADR-018**, formulada el 2026-08-17 y sin
   responder desde entonces:
   *"¿Se acepta la política de migraciones aditivas (D-5.1) como regla del proyecto, con
   desbloqueo explícito y escrito en la PR? Vincula a todas las specs futuras que toquen esquema,
   así que probablemente merece una línea en `docs/fundacion/reglas.md`."*
   Al redactar la spec **entregué el mecanismo** que la hace cumplible (el escáner) y
   **deliberadamente no escribí la regla**: no me correspondía. Lo que llevé al gate, y que el
   humano aceptó entero:
   - **Mi recomendación sobre el fondo: sí**, adóptala. Sin ella, el escáner es un gate sin norma
     detrás: marca cosas y cada uno decide por su cuenta si desbloquear. Con ella, el desbloqueo
     tiene un criterio contra el que juzgarse.
   - **Mi recomendación sobre el sitio: `docs/fundacion/reglas.md`, pero en una sección aparte,
     no como RN-16.** Y esto es un matiz que ADR-018 no podía ver: hoy ese fichero contiene
     **solo reglas de negocio** (RN-01…RN-15, todas de dominio, con su *"Fuente: sdd-cartera"* o
     *sdd-mercados*), y las specs las citan como `RN-xx`. Colar una regla de ingeniería en esa
     numeración ensucia una serie que dos skills de dominio vigilan. Propongo una sección nueva
     al final, **"Reglas de ingeniería (RI-xx)"**, con:
     > **RI-01** (Migraciones aditivas, *expand/contract*): una migración no borra, no renombra y
     > no estrecha una columna **en el mismo despliegue** que cambia el código. Lo destructivo se
     > parte en dos despliegues separados por al menos un despliegue verde: primero se añade y se
     > rellena; después, en otra spec, se retira lo viejo. El incumplimiento se detecta
     > automáticamente (SPEC-032) y **solo se desbloquea por escrito**, con justificación y plan
     > de vuelta atrás, en `drizzle/destructive-waivers.json`. Fuente: ADR-018 D-5.1.
   - **Alternativas si no te convence**: (a) FOUNDATION.md §No-negociables —es constitución y ya
     aloja invariantes de ingeniería, pero sus D-N son decisiones de producto y desentona;
     (b) dejarla **solo** en ADR-018 y que el escáner sea la norma de facto —más barato, pero un
     ADR no se lee al escribir cada spec y `reglas.md` sí—.
   **Resolución del humano: sí a las dos cosas** —al fondo y al sitio, con la sección `RI-xx`
   separada de la serie de dominio—, igual que hizo con `--max-warnings=0` en SPEC-027. Entra en
   esta misma PR como **CA-15**, con ese texto literal. Dos consecuencias que conviene tener
   presentes: la regla **vincula a todas las specs futuras que toquen esquema**, y `RI-01` nace
   ya con su vigilante —el escáner de esta spec—, que es lo que la separa de una buena intención.
   *Quién la escribe*: el **implementador** al cerrar CA-15. El arquitecto no toca
   `docs/fundacion/reglas.md`.

2. ✅ **RESUELTO (gate del 2026-08-18) — firmado: el desbloqueo es un fichero versionado, no una
   etiqueta en la PR.** ADR-018 D-5.2 dice *"una marca deliberada en la PR con la justificación y
   el plan de vuelta atrás"*. Me aparté de la **letra** y pedí firma; el humano la dio, aceptando
   los tres motivos:
   - Una etiqueta o una frase en la descripción de la PR **vive fuera del repositorio**, se puede
     poner **después** de la revisión, y desaparece de la vista en cuanto la PR se cierra. Dentro
     de seis meses, la pregunta *"¿por qué esta migración borró esto?"* no tiene dónde
     responderse.
   - Leer una etiqueta desde el CI exige hablar con la API de GitHub, y **F-SPEC-027-1** ya nos
     dice que este plan no da control sobre la PR. Un fichero no necesita permisos de nada.
   - Un fichero **aparece en el diff**, justo al lado del `.sql` que justifica, y el revisor lo ve
     sin salir del código.
   Coste honesto del cambio: hay que **sembrar** los dos desbloqueos históricos (`0001` y `0007`)
   el primer día. No es una pega: ADR-018 dice literalmente que esas dos *"merecen que alguien las
   mire"*, y esto es exactamente mirarlas y dejar escrito el resultado.

3. ✅ **RESUELTO (gate del 2026-08-18) — la guardia se queda, sabiendo que hoy protege menos.**
   *Lo que puse encima de la mesa*: con *preview branching* activo la guardia baja de defensa
   principal a *tripwire* y auditoría, y ofrecí adelgazar la spec a la mitad si eso no compensaba.
   *Resolución del humano*: **se queda**, precisamente porque **es la única red si alguien apaga
   el branching**; `F-SPEC-032-1` sigue declarado como residual y **CA-3 es su mitigación**.
   El análisis que llevó a esa decisión, íntegro, porque es lo que hay que releer el día que algo
   de esto cambie:
   - **Antes del 2026-08-18**, la guardia era lo único que evitaba que un build de Preview
     migrase producción. Era la defensa principal.
   - **Desde el cierre de F-SPEC-023-1**, un build de Preview migra **su propia rama
     copy-on-write** de Neon. El daño potencial de una migración en Preview ha bajado
     drásticamente, y con `ALLOW_MIGRATE=1` puesto en Preview **la guardia deja de bloquear nada
     en el camino normal**: pasa a ser un *tripwire* para lo que no está declarado (un entorno
     Development, un entorno personalizado, un build con el entorno mal inyectado).
   - **El residual**: `ALLOW_MIGRATE=1` en Preview es una autorización **permanente** que asume
     que el *preview branching* sigue encendido. Si alguien lo apaga, o desconecta y reconecta el
     recurso de Neon sin esa casilla, el permiso **sobrevive** y apunta otra vez a producción. La
     guardia diría que sí, porque su pregunta es *"¿tengo permiso?"*, no *"¿contra qué base?"*.
   - **Lo que hago hoy contra eso**: CA-3 obliga a la guardia a **imprimir el host y la base**
     contra los que autoriza, sin credenciales. No previene: deja rastro escrito en el log del
     build, que es lo único honesto que puede hacer un script que no conoce la identidad de la
     base de producción.
   - **Lo que dejo abierto**: comprobar desde el build que un Preview no apunta a la base de
     producción exige meter esa identidad en el repositorio o confiar en un marcador de la
     integración de Neon que no he verificado. **No lo invento aquí**; queda como follow-up con
     destino SPEC-028, que es quien conecta el repo y quien pondrá la variable.
   Conclusión, la que llevé y la que se firmó: la guardia **sigue mereciendo la pena** por lo que
   dice ADR-018 —vive en el repo, se testea, y sobrevive a cualquier reconfiguración del panel—,
   pero ya no es la defensa principal contra el escenario de F-SPEC-023-1. Su valor hoy es
   *defensa en profundidad* y *auditoría*, más el escenario que decidió al humano: **si alguien
   apaga el branching, no queda nada más**.

4. ✅ **RESUELTO (gate del 2026-08-18) — CA-12 se queda: el escáner corre también dentro de
   `npm test`.** *La pregunta era*: ¿los dos sitios, o solo la CI? Lo puse en los dos a propósito,
   con la lección de SPEC-026 delante: aquella guardia vivía solo en la suite porque no había CI,
   y por eso protegía solo si alguien la ejecutaba. Ahora la CI es la que impide el olvido, y la
   suite es la que te lo dice **antes** de empujar. Cuesta décimas de segundo y **no duplica
   lógica** (el test invoca el mismo script). **Resolución: se queda tal cual.**

5. **INFORMACIÓN — por qué `UPDATE` no se marca.** Podría parecer un olvido y no lo es: la
   política *expand/contract* **exige** rellenar (*"primero se añade y se rellena"*), así que
   marcar los backfills marcaría la mitad buena del patrón. `0004_backfill_operating_mic` son tres
   `UPDATE` y es un backfill de manual. ADR-018 D-5.2 tampoco lo lista. Si algún día un `UPDATE`
   masivo hace daño, ampliar la lista es una línea; hacerlo hoy enseña a desbloquear por rutina,
   que es como se rompen los gates.

6. **INFORMACIÓN — nombres que fija esta spec, por si quieres cambiarlos ahora que es gratis.**
   ADR-018 dice *"p. ej. `ALLOW_MIGRATE=1`"* y delega el nombre. Quedan así: variable
   **`ALLOW_MIGRATE`** con valor literal **`1`** (comparado tras recortar espacios; `true`, `yes`
   o `0` **no** autorizan, y el mensaje de rechazo dice cuál es el valor bueno); scripts
   `scripts/guard-migrate.mjs` (nombre que ya usa el ADR) y `scripts/scan-destructive-sql.mjs`;
   script de npm `db:scan`, en la familia de `db:generate`/`db:migrate`; step de CI
   **`Migration scan`**; fichero de desbloqueos `drizzle/destructive-waivers.json`. Todo en
   inglés, por la regla del proyecto (`CLAUDE.md`: *código e identificadores en inglés*); los
   textos de justificación dentro del JSON, en español, como el resto de la documentación.

7. **INFORMACIÓN — lo que cambia el día que se mergee esto, en producción: nada.** El
   `buildCommand` gana un eslabón, pero un `vercel --prod` sigue construyendo igual: Vercel
   inyecta `VERCEL_ENV=production` y la guardia autoriza (fila 1 de CA-2). No hay build de Preview
   que pueda fallar, porque **no hay integración Git que los dispare**. El único efecto visible
   inmediato es un gate más, verde, en la lista de checks de las PR.

8. **INFORMACIÓN — no hay ADR-021, tampoco después del gate, y quiero decir por qué
   explícitamente.** Todo lo decidido aquí es mecanismo dentro del margen que ADR-018 concede
   (D-2: *"el nombre y la forma exacta los fija la spec"*; D-5.2 fija una propiedad, no una
   implementación). Lo único que constreñía de verdad el futuro era la adopción de D-5.1 como
   regla, y **eso era tuyo**, no mío: por eso lo llevé al gate en vez de fijarlo en un ADR que
   habría decidido por ti con formato inmutable.
   **Firmada la adopción el 2026-08-18, sigue sin hacer falta un ADR nuevo**, y por dos razones:
   la **decisión** ya vive en un ADR aprobado —**ADR-018 D-5.1**—, y lo que faltaba no era
   decidirla sino **escribirla donde se lee al trabajar**, que es `docs/fundacion/reglas.md`
   (CA-15, con `Fuente: ADR-018 D-5.1` dentro de la propia regla). Un ADR-021 que repitiese D-5.1
   sería una segunda fuente de verdad de la misma decisión, que es justo lo que las reglas del
   rol prohíben: las specs y las reglas **referencian** las fuentes, no las duplican.

9. **INFORMACIÓN — coste en CI.** Un step más en el job `Checks`, sin instalación adicional: lee
   9 ficheros de texto de `drizzle/`. Del orden de décimas de segundo sobre una pasada que hoy
   ronda los 6-8 minutos en ese job. La cuota no se entera. Los unitarios nuevos son puros,
   sintéticos y sin red; los subprocesos son de `node` sobre temporales.

10. **INFORMACIÓN — lo que esta spec NO desbloquea sola.** Cierra **F-SPEC-027-2**, que es el
    último bloqueante técnico de SPEC-028 en el repositorio, pero SPEC-028 seguirá necesitando
    dos cosas que no son código y que no puedo hacer desde aquí: **poner `ALLOW_MIGRATE=1` en el
    entorno Preview** (o aceptar que las previews nazcan en rojo) y **decidir la pregunta 1 del
    gate de ADR-018** (conectar el repo con despliegue automático, o replegarse a la alternativa
    4 de la rama `production`). Ambas están declaradas en §Fuera de alcance.

---
*Historial de la spec: redactada el 2026-08-18 a partir de F-SPEC-027-2, con la investigación
medida en este worktree (censo de sentencias de las 9 migraciones de `drizzle/`, lectura de
`vercel.json`, `package.json`, `drizzle.config.ts`, `.github/workflows/ci.yml`,
`tests/ci-workflow.test.ts`, `scripts/check-alive.mjs` y `docs/despliegue.md`, y contraste con
ADR-018 D-2/D-3/D-4/D-5, SPEC-026, SPEC-027 y SPEC-031). Nace en `borrador`: no la apruebo yo.*

*Enmienda del 2026-08-18, tras el gate humano (Alberto Fojo), que **aprobó la spec**: se añade
**CA-15** —la política de migraciones aditivas (ADR-018 D-5.1) se adopta como regla del proyecto
y se escribe en `docs/fundacion/reglas.md` como **RI-01**, en una sección nueva de reglas de
ingeniería separada de la serie de dominio RN-01…RN-15—, con lo que la spec pasa de **14 a 15
CA**. Se marcan como resueltos los puntos 1 a 4 de §Notas para el gate (adopción de D-5.1;
desbloqueo por fichero versionado en vez de etiqueta en la PR, **sancionado**; la guardia se
queda pese a que con *preview branching* protege menos, por ser la única red si alguien apaga el
branching; y CA-12 se mantiene), y se actualizan §Entidades y §Fuera de alcance en consecuencia.
**Ningún CA anterior cambia de enunciado.** El estado del frontmatter lo mueve el orquestador con
`estado.mjs`; el arquitecto no lo toca, y tampoco toca `docs/fundacion/reglas.md`: esa regla la
escribe el implementador al cerrar CA-15.*
