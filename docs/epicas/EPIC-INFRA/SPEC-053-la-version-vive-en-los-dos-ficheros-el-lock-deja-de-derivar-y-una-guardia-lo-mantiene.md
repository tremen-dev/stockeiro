---
id: SPEC-053
tipo: spec
epica: EPIC-INFRA
estado: aprobada
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-23, por: humano (Alberto Fojo)}
---
# SPEC-053 — La versión vive en los dos ficheros: el lock deja de derivar y una guardia lo mantiene

## Problema

**`package.json` y `package-lock.json` declaran versiones distintas, y la deriva crece
sola.** Sobre `origin/main` = `3b6fc8b`, comprobado al escribir esto:

| Fichero | Campo | Valor |
|---|---|---|
| `package.json` | `version` | **`0.3.4`** |
| `package-lock.json` | `version` (raíz, línea 3) | **`0.3.2`** |
| `package-lock.json` | `packages[""].version` (línea 9) | **`0.3.2`** |

Son **dos** campos en el lock, no uno. Cualquier arreglo que toque uno solo deja el
fichero incoherente consigo mismo.

### Cómo se produce: el gate recomienda el comando que la crea y luego no la mira

El gate de versión (**ADR-024** ptos. 9 y 10, `scripts/check-version-bump.mjs`, step
`Version bump` de `.github/workflows/ci.yml:129-132`) obliga a subir el número en toda
rama que toque código de aplicación, y su propio texto de ayuda dice cómo:

```
Para subirlo:  npm version patch --no-git-tag-version
               npm version minor --no-git-tag-version
```

Ese comando toca **los dos ficheros**. Medido sobre una copia exacta de `3b6fc8b` en un
directorio aparte (no en el árbol del proyecto):

```
$ npm version patch --no-git-tag-version
v0.3.5
$ diff lock.antes.json package-lock.json
3c3
<   "version": "0.3.2",
---
>   "version": "0.3.5",
9c9
<       "version": "0.3.2",
---
>       "version": "0.3.5",
```

**Exactamente dos líneas, y ninguna más.** No re-resuelve dependencias, no toca ni un
`integrity`, ni un `resolved`, ni una entrada de `node_modules/…`. Y escribe el número
de `package.json`, no `lock + 1`: por eso el mismo comando que hoy produce la deriva es
el que la cerraría si se le dejara.

Pero la disciplina de acotación de las specs de este proyecto declara un **conjunto
cerrado de ficheros** con la palabra «únicamente», y `package-lock.json` **nunca ha
estado en esa lista**. El resultado, observado dos veces:

- **SPEC-050** (hoy, 2026-08-23): el implementador subió a `0.3.4`, vio que el lock
  también cambiaba y **lo revirtió a mano** para no romper su CA-19. Lo levantó como
  `F-SPEC-050-4`, con el motivo escrito — que es lo correcto y es lo que hace que esta
  spec exista.
- **La subida anterior**, `0.3.2 → 0.3.3` (SPEC-051), tampoco tocó el lock, y esa vez
  no quedó escrito por qué.

La última subida que sí lo sincronizó fue `0.3.1 → 0.3.2` (`3f62762`, *«package-lock.json
| 4 ++--, package.json | 2 +-»*). Verificado con `git log -L 3,3:package-lock.json`: el
campo se movió en `a3a693e` (0.1.0), `852a9d6` (0.2.0), `345c1e2` (0.2.1), `b4ab80f`
(0.3.0), `dd068e2` (0.3.1) y `3f62762` (0.3.2), y **desde ahí se quedó quieto**.

### La causa raíz es una frase, y está en un ADR aprobado

**ADR-024 pto. 8**, literal:

> Se sube con `npm version <segmento> --no-git-tag-version`, que **edita `package.json` y
> nada más**: no se crean etiquetas de git […]

La *intención* de esa frase es el contraste con las etiquetas de git —el párrafo entero va
de eso—. Pero su *letra* dice que el comando edita un solo fichero, y **es falsa**: edita
dos. La letra es lo que se lee cuando alguien está a mitad de una entrega, ve un
`package-lock.json` modificado que no pidió, y busca autoridad para revertirlo. La
encuentra, y revierte.

Nadie hizo nada mal. El repositorio enseñó a hacerlo mal, dos veces, y cada implementador
lo redescubre solo.

### Lo que esto NO es

**No rompe nada hoy, y esta spec no lo va a fingir.** Confirmado contra `3b6fc8b`:

- **Nadie lee la versión del lock.** El único uso de `package-lock.json` en CI es
  `hashFiles('package-lock.json')` como clave de caché del navegador de Playwright
  (`.github/workflows/ci.yml:169`). El semver de producto sale de `package.json` vía
  `STOCKEIRO_VERSION` (**ADR-024** pto. 4), y `check-version-bump.mjs` compara **dos
  `package.json`** con `git show` (`:388-404`), nunca el lock.
- **`npm ci` no mira ese campo**: valida el árbol de dependencias, no el `version` de la
  raíz. El verificador de SPEC-050 lo comprobó (`npm ci --dry-run` → exit 0 con la deriva
  puesta) y lo confirma el hecho de que la CI y la puerta de despliegue pasan hoy en
  `main` con la deriva dentro.
- **Barrido: no hay un tercer sitio.** `package.json` y `package-lock.json` son los dos
  únicos ficheros del repositorio que declaran algo que pueda leerse como versión de
  producto. Los `"version": "7"` de `drizzle/meta/*.json` son la versión del **formato de
  snapshot** de drizzle-kit, no del producto; `vercel.json` no declara ninguna; y no
  existe un literal `0.3.x` en `src/`, `tests/`, `scripts/`, `.github/` ni `vercel.json`
  (`grep`, cero resultados).

**El daño es fricción operativa recurrente más un artefacto que afirma un número que no
es.** Ni más ni menos. Va a **EPIC-INFRA** (salud técnica) y no a EPIC-FIX **precisamente
por eso**: EPIC-FIX es para lo que está roto, y esto no lo está.

## Usuarios / roles afectados

- **sdd-implementador**, cada vez que sube la versión: hoy tiene que decidir solo qué
  hacer con un fichero modificado que no pidió, sin nada citable en ninguno de los dos
  sentidos. Es quien paga la fricción.
- **sdd-verificador**, que tiene que juzgar si un lock revertido es disciplina o descuido.
- **sdd-arquitecto**, que escribe el conjunto cerrado de ficheros de cada spec y hoy lo
  escribe incompleto.
- **Quien lea `package-lock.json`** —una persona, un `npm pack`, una herramienta futura de
  SBOM o de provenance— y se lleve `0.3.2` de un producto que es `0.3.4`.
- **No afecta al usuario final.** El pie de la app y `/api/version` siguen sirviendo
  `package.json`, hoy y después de esta spec.

## La decisión, y por qué esta y no la otra

Había **dos salidas legítimas y excluyentes**. Se elige **(A)**.

> **(A) El lock lleva la versión y se comprueba.** `package-lock.json` se sincroniza al
> subir versión, una guardia lo verifica, y las specs incluyen el lock en su conjunto
> cerrado de ficheros cuando suben versión.
>
> **(B) El lock NO lleva la versión de producto, y se declara por escrito.** Se documenta
> que ese campo es ruido de npm sin significado aquí, el gate lo ignora explícitamente, y
> las specs siguen revirtiéndolo con una razón citable.

**1. (B) no elimina el trabajo: lo institucionaliza.** El roce que hay que cerrar es un
**revert manual recurrente**. `npm version` escribe esas dos líneas se declaren
significativas o no, así que bajo (B) cada subida futura **sigue** produciendo un diff que
alguien tiene que revertir a mano — lo único que cambia es que ahora el revert tiene una
cita al lado. (A) hace que el comando que el gate ya recomienda produzca el resultado
correcto: se commitean los dos ficheros y no hay paso manual nunca más.

**2. (B) necesitaría su propio mecanismo, y su mecanismo sería absurdo.** Una convención
sin guardia que la ejecute compite con la prisa y pierde: es literalmente lo que **ADR-031**
documentó —una convención de `FOUNDATION.md` saltada **dos días** después de escribirse—.
Para que (B) se sostenga haría falta una guardia que **falle cuando `npm version` hace su
trabajo normal**. Y si no se pone, el campo del lock queda en un valor aleatorio: el de la
última vez que alguien olvidó revertir. (B) sin mecanismo es deriva; (B) con mecanismo es
pelearse con la herramienta.

**3. (A) se comprueba con una PROPIEDAD, que es la primera opción de RI-03.** *«`version`
de `package-lock.json` == `version` de `package.json`»* es cierta sobre el **estado del
árbol**, en cualquier momento y para siempre: no necesita git, no necesita ventana, no
puede quedarse vacía y funciona en cualquier clon. Es exactamente el molde que **ADR-031**
pto. 1 prefiere sobre todo lo demás. **(B) no tiene ninguna propiedad testable**: no se
puede aseverar *«este campo no significa nada»*.

**4. La no-vacuidad no hay que fabricarla: ya existe.** La guardia de (A) está **roja hoy**
sobre `3b6fc8b` (`0.3.4` ≠ `0.3.2`). Un test que nace rojo por un defecto real y se pone
verde al arreglarlo es la antítesis del verde vacío que SPEC-048 tuvo que desmontar.

**5. El coste de (A) sobre la acotación es una línea, no un cheque en blanco.** El miedo
razonable a meter `package-lock.json` en un conjunto cerrado es que el lock es un fichero
enorme e ilegible. Pero está medido arriba: el bump escribe **dos líneas y solo dos**, sin
re-resolución de dependencias. Añadir un nombre a una lista a cambio de eliminar un ritual
manual permanente es un cambio barato.

**6. Y la disciplina pasa a ser automática.** Con la guardia puesta, un implementador que
revierta el lock **verá la suite en rojo**. Deja de ser una regla que hay que recordar y
pasa a ser un mecanismo — que es la diferencia que **ADR-031** existe para nombrar. Por eso
esta spec **no** crea una `RI-04`: la regla se hace cumplir sola.

**7. Honestidad, que es el argumento más débil y por eso va el último.** Este proyecto ha
rechazado dos veces normalizar un artefacto que afirma algo falso: es el razonamiento
entero de **ADR-024** (*«un número congelado miente más que no tener número»*) y es lo que
SPEC-052 está corrigiendo hoy en `docs/despliegue.md`. Aceptar (B) sería la tercera vez, y
esta vez por comodidad. Pero si (B) eliminara la fricción, el argumento de honestidad no
bastaría para descartarla. Lo que la descarta es el punto 1.

**Lo que (A) cuesta, y no está en la propuesta original.** Ver §Fuera de alcance,
*«El precio de (A) que nadie había contado»*: la clave de caché de Playwright.

## Criterios de aceptación

> **Lectura de los CA.** Los que dicen **(gate)** son criterios sobre un **delta** —*«esta
> reparación estuvo acotada»*— y por **RI-03** / **ADR-031** **no se codifican como test
> permanente**: se verifican en el gate y su evidencia va al ledger. En la matriz van
> `n-a` en la columna *Test*, con la nota. Los que dicen **(propiedad)** son ciertos sobre
> el estado del árbol en cualquier momento y viven en la suite.
>
> **Ninguna aserción de la suite que esta spec añada puede tomar `origin/main`, `main`,
> `HEAD` ni `@` como revisión de git** (ADR-031 pto. 2.1, RI-03). No hace falta esquivarlo
> con cuidado: **ninguna de las guardias de aquí necesita git en absoluto**. Que
> `check-version-bump.mjs` sí use `origin/main` es correcto y no se toca: es un **script
> de gate**, no una aserción de la suite, y RI-03 lo cita como molde de la forma buena.

### La deriva se cierra

- **CA-1** *(propiedad)*: **Dado** el árbol del repositorio en cualquier momento, **cuando**
  se leen `package.json` y `package-lock.json`, **entonces** los **tres** campos coinciden
  exactamente: `package.json.version`, `package-lock.json.version` y
  `package-lock.json.packages[""].version`. Sobre `3b6fc8b` esto es **falso** (`0.3.4`,
  `0.3.2`, `0.3.2`); al entregar esta spec tiene que ser cierto, con `0.3.4` en los tres
  salvo que la entrega suba el número por otro motivo.

- **CA-2** *(gate)*: **Dado** el diff de la rama de entrega, **cuando** se mira
  `package-lock.json`, **entonces** cambian **exactamente dos líneas** —el `version` de la
  raíz y el de `packages[""]`— y **ni una más**: ni un `integrity`, ni un `resolved`, ni
  una entrada de dependencia, ni `lockfileVersion`. La reparación la produce npm, no una
  edición a mano: `npm install --package-lock-only` sobre `3b6fc8b` con `package.json` en
  `0.3.4` da **exactamente ese diff de dos líneas** (medido al escribir esta spec, en un
  directorio aparte). *Verificación*: `git diff -- package-lock.json` pegado entero en el
  ledger. **`n-a` en la columna Test.**

- **CA-3** *(gate)*: **Dado** el árbol ya sincronizado, **cuando** se ejecuta
  `npm ci --dry-run`, **entonces** sale con **0** y el número de paquetes instalados es el
  mismo que antes de la sincronización. La salida de las dos ejecuciones, antes y después,
  va al ledger. **`n-a` en la columna Test.**

### La guardia que impide que vuelva

- **CA-4** *(propiedad)*: **Dado** un fichero de test permanente en `tests/`, **cuando** se
  ejecuta la suite, **entonces** falla si cualquiera de los tres campos de CA-1 diverge, y
  pasa si los tres coinciden. La guardia **lee los dos ficheros del disco y no invoca git
  en absoluto**: sin `git diff`, sin `git show`, sin ventana de sha, sin `skipIf`. Es la
  opción 1 de **RI-03** —reexpresar el criterio como propiedad—, no la 2 ni la 3.

- **CA-5** *(propiedad)*: **Dado** que la guardia de CA-4 falla, **cuando** se lee su
  mensaje, **entonces** el mensaje enseña la salida sin obligar a deducirla: nombra **los
  dos ficheros**, **los tres campos** con su valor real, dice **con qué comando** se
  sincroniza (`npm install --package-lock-only`, o `npm version <segmento>
  --no-git-tag-version` si además toca subir) y dice que **los dos ficheros entran en el
  mismo commit**. Un rojo que solo diga *«expected 0.3.2 to be 0.3.4»* deja al siguiente
  implementador donde estábamos.

- **CA-6** *(propiedad + gate)*: **Dado** el fichero de CA-4, **cuando** se comprueba que no
  es un verde vacío, **entonces**: (a) **no contiene** `skip`, `.only` ni `todo(` —siempre
  se ejecuta, en cualquier clon y en CI—; y (b) mutando **cualquiera** de los tres campos a
  un valor distinto, la guardia se pone **roja**, y con los tres iguales, **verde**. La
  mutación se ejecuta y su salida va al ledger; no basta con afirmar que fallaría.
  *Nota*: la prueba de no-vacuidad más fuerte es gratis y hay que aprovecharla — **la
  guardia escrita sobre `3b6fc8b` sin sincronizar nada falla**, porque el defecto está vivo
  ahora mismo. Escribirla **antes** de tocar el lock y dejar ese rojo pegado en el ledger
  es lo que se pide.

- **CA-7** *(propiedad)*: **Dado** el conjunto de guardias del repositorio, **cuando** corre
  la meta-guardia de SPEC-048 (`tests/guardias-no-caducan.test.ts`), **entonces** sigue en
  **verde** con el fichero nuevo dentro: ninguna aserción añadida por esta spec toma una
  revisión móvil. Es el mecanismo que hace cumplible **RI-03** pto. 4 y no se relaja.

### El bucle de aprendizaje: quien sube la versión no tiene que deducirlo

- **CA-8** *(propiedad)*: **Dado** `node scripts/check-version-bump.mjs --help`, **cuando**
  se lee su salida, **entonces** dice que `npm version <segmento> --no-git-tag-version`
  edita **`package.json` y `package-lock.json`**, y que **los dos entran en el commit**;
  y la cabecera del fichero dice lo mismo, con **ADR-033** citado como fuente. Hoy el
  `--help` recomienda el comando y no dice ninguna de las dos cosas.

- **CA-9** *(propiedad)*: **Dado** el veredicto `sin-subir` del gate —el mensaje que se lee
  **en caliente**, con la PR en rojo, y que ya lista `npm version patch/minor`—, **cuando**
  se lee, **entonces** también dice que el comando toca los dos ficheros y que los dos van
  al commit. Es el único de los tres sitios que alguien lee sin buscarlo, y por eso es el
  que más importa. Se prueba sobre la función **pura** `evaluar`, sin invocar git (molde:
  el bloque puro de `tests/version-bump-gate.test.ts`).

- **CA-10** *(propiedad)*: **Dado** el texto del script tras CA-8 y CA-9, **cuando** se
  comprueba contra **ADR-024** pto. 8, **entonces** no queda en el repositorio ninguna
  afirmación de que `npm version` toque un solo fichero. La frase de ADR-024 **no se
  edita** —un ADR aprobado es inmutable—: queda **enmendada por ADR-033**, que es el
  mismo mecanismo que ADR-024 usó con ADR-018 D-6.

### Que las expectativas existentes no se aflojen por el camino

- **CA-11** *(gate)*: **Dado** el diff de la rama sobre `tests/`, **cuando** se listan los
  ficheros de test tocados, **entonces** los únicos son el **fichero nuevo** de CA-4 y
  `tests/version-bump-gate.test.ts` —este último **solo** para añadir los casos de CA-8 y
  CA-9—. En particular **no se toca** ni una línea de sus bloques *SPEC-038 CA-12* y
  *SPEC-038 CA-13* (el que congela el step de CI, `npm run version:check`, el job `Checks`
  y `fetch-depth: 0`), ni de los cinco motivos de `evaluar`, ni del contrato de códigos de
  salida de SPEC-049. Añadir sí; aflojar no. Si algo de ahí **tiene** que cambiar,
  **para y escálalo al gate humano**: quien toca la guardia no es quien se beneficia
  (`FOUNDATION.md`, ADR-031 pto. 5). *Verificación*: `git diff --name-only` de la rama y el
  diff de ese fichero, pegados en el ledger. **`n-a` en la columna Test.**

- **CA-12** *(gate)*: **Dado** el diff completo de la rama, **cuando** se listan sus
  ficheros, **entonces** son **únicamente**: `package-lock.json`; `scripts/check-version-bump.mjs`;
  `tests/version-bump-gate.test.ts`; el fichero de test nuevo de CA-4; esta spec y su
  ledger; `docs/adr/ADR-033-*.md`; y `docs/tablero.md`. **Ningún fichero de `src/`, ninguna
  migración, ni `.github/workflows/ci.yml`, ni `.sdd.json`, ni `package.json`.**
  **`n-a` en la columna Test.**

  > **Y aquí se estrena la regla nueva**, que es medio punto de esta spec: si esta entrega
  > **tuviera** que subir la versión, `package.json` **y** `package-lock.json` entrarían
  > los dos en esa lista. No tiene que: `.sdd.json` declara `rutasVigiladas: ["src/",
  > "app/"]` y esta rama no toca ninguna de las dos, así que `npm run version:check` dirá
  > *«El diff no toca codigo de aplicacion»* y saldrá **0**. La sincronización del lock a
  > `0.3.4` es una **reparación**, no una subida.

## Entidades y reglas afectadas

### Decisiones y reglas que esta spec aplica sin cambiar

- **RI-03** (`docs/fundacion/reglas.md`, fuente **ADR-031**) — es la que decide **dónde**
  vive cada CA de aquí. CA-1 y CA-4..CA-10 son **propiedades** del árbol y van a la suite
  por la opción 1 (*reexpresarlo como propiedad*), sin git de por medio. CA-2, CA-3, CA-11
  y CA-12 son **criterios de gate** sobre un delta y van al **ledger** por la opción 2. No
  se usa la opción de ventana anclada de sha porque **ninguna hace falta**.
- **ADR-031** ptos. 2.1 y 4 — ninguna aserción nueva toma revisión móvil; la meta-guardia
  de SPEC-048 lo comprueba (CA-7).
- **ADR-024** ptos. 3, 4, 9, 10 y 11 — **intactos**. La fuente de verdad del número sigue
  siendo `package.json`; se sigue leyendo en build vía `next.config.mjs` →
  `STOCKEIRO_VERSION`; el gate sigue exigiendo el bump comparando dos `package.json`; la
  comparación sigue siendo semver; y `check-alive.mjs` sigue mirando el **commit**, no el
  semver. Lo único que se enmienda es **la frase del pto. 8** que dice que el comando toca
  un solo fichero (ver ADR-033).
- **SPEC-049** — el contrato de códigos de salida `0/1/2` y la abstención sobre árbol
  sucio no se tocan (CA-11).
- **`FOUNDATION.md`, §*Cómo se trabaja aquí*** — *«un test de frontera fija una propiedad,
  no un estado del árbol»*. CA-1 es literalmente eso, y por eso esta guardia no puede
  caducar al mergear.

### Decisión nueva que esta spec trae

- **ADR-033** (borrador, adjunto): *el `package-lock.json` lleva la versión de producto; el
  bump commitea los dos ficheros; una propiedad de la suite lo vigila*. **Enmienda el pto.
  8 de ADR-024** —solo la cláusula sobre qué ficheros toca `npm version`— y **no lo
  supersede**, por el mismo razonamiento con el que ADR-024 enmendó D-6 de ADR-018 en vez
  de reescribirlo. Sin este ADR la spec estaría reinterpretando un ADR aprobado en
  silencio, que es justo lo que la regla de inmutabilidad prohíbe.

### Lo que esta spec NO cambia en la disciplina de acotación

El conjunto cerrado de ficheros **sigue siendo cerrado y sigue diciendo «únicamente»**. Lo
único que cambia es su contenido: una spec que sube la versión lista **los dos** ficheros
en vez de uno. Y a partir de CA-4 no hace falta acordarse: quien liste solo `package.json`
y revierta el lock verá la suite roja antes de abrir la PR.

### Ficheros que esta spec toca

| Fichero | Qué le pasa |
|---|---|
| `package-lock.json` | dos líneas: `0.3.2` → `0.3.4` en `version` y en `packages[""].version` |
| `tests/<nuevo>.test.ts` | **nuevo**: la guardia de CA-4..CA-6 |
| `scripts/check-version-bump.mjs` | solo texto: cabecera, `--help` y el mensaje de `sin-subir` (CA-8, CA-9) |
| `tests/version-bump-gate.test.ts` | **solo adiciones**: los casos de CA-8 y CA-9 |
| `docs/adr/ADR-033-*.md` | nuevo |
| esta spec + ledger, `docs/tablero.md` | lo de siempre |

No se toca `src/`, ni `.github/workflows/ci.yml`, ni `.sdd.json`, ni `package.json`.

## Fuera de alcance

### La salida (B), y qué la reabriría

**(B) —declarar por escrito que el lock no lleva la versión de producto— queda descartada,
no olvidada.** Su argumento sigue siendo bueno: nadie lee ese campo, y verificarlo es
trabajo a cambio de un dato que nadie consume.

**Lo que la reabriría**, cualquiera de estas tres:

1. **Que `npm` deje de escribir el campo** —o que aparezca una bandera estable tipo
   `--no-lock-version`—. Entonces (A) pierde su ventaja principal (que el comando ya
   produce el resultado correcto) y (B) deja de exigir un revert manual.
2. **Que la guardia de CA-4 se demuestre cara de mantener**: si en tres entregas seguidas
   se pone roja por motivos que no son la deriva —un `npm install` que reformatee el lock,
   una migración de `lockfileVersion`—, el balance cambia.
3. **Que la sincronización deje de ser de dos líneas**: si alguna versión de npm empezara a
   re-resolver dependencias al hacer `npm version`, meter el lock en un conjunto cerrado
   dejaría de ser barato y habría que reconsiderar.

Si se reabre, **el vehículo es un ADR que supersede a ADR-033**, no un cambio de opinión
en una spec.

### El precio de (A) que nadie había contado: la caché de Playwright

La clave de caché del navegador de e2e es
`playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}`
(`.github/workflows/ci.yml:169`), y su comentario explica por qué: *«la clave sale de
`package-lock.json` porque es lo que fija la version de @playwright/test, y el navegador
tiene que casar con ella»*.

Bajo (A), **cada subida de versión cambia el lock y por tanto invalida esa caché**, aunque
`@playwright/test` no se haya movido un milímetro. Consecuencia real y recurrente: **una
descarga de ~130 MB de chromium en cada PR que suba el número** (step `Install Playwright
browser`, con `timeout-minutes: 5`; el `npx playwright install chromium` corre igual, así
que el coste es la descarga, no un fallo). Es aproximadamente un minuto por spec que toque
`src/`. Y hay un daño de diseño además del de tiempo: la clave se elige para seguir a
`@playwright/test` y pasa a seguir también a algo que no tiene nada que ver.

**Se acepta y no se arregla aquí.** Arreglarlo significa tocar la clave de caché —añadir
`restore-keys`, o derivarla de un fichero dedicado— y eso es cambiar un step de CI que
`tests/spec-031-frontera.test.ts` congela, en una spec cuyo objeto es el número de versión.
Un CA de gate para arreglar otro: exactamente el error que `F-SPEC-050-4` describe.
*Destino*: **EPIC-INFRA**. *Lo que lo dispara*: que alguien mida el minuto y le moleste, o
que el job de e2e se acerque a su `timeout-minutes: 25`.

### Lo demás

- **No se automatiza el bump.** ADR-024 pto. 8 lo rechaza con motivo y aquí no se
  reabre: elegir MAJOR/MINOR/PATCH sigue siendo juicio de producto.
- **No se crea una `RI-04`.** El mecanismo de CA-4 sustituye a la convención; una regla en
  prosa además del test sería la tercera copia de la misma verdad. Si algún día la guardia
  se borra, ahí sí hará falta escribirla.
- **No se toca `.github/workflows/ci.yml`.** La guardia de CA-4 es un test unitario y corre
  en el step `Unit tests` que ya existe. No merece un step propio: a diferencia de
  `Migration scan` o `Version bump`, aquí un rojo de *«las versiones no coinciden»* se lee
  perfectamente dentro de `Unit tests`.
- **No se toca `check-alive.mjs` ni `/api/version`.** El semver que sirven sale de
  `package.json` y seguirá saliendo de ahí. Esta spec no cambia ni un byte de lo que ve el
  usuario.
- **No se revisan las versiones históricas.** El lock dijo `0.3.2` durante dos subidas y
  eso queda como está: reescribir el histórico para que un campo derivado cuadre
  retroactivamente no vale lo que cuesta, y `git filter-repo` invalidaría todas las
  ventanas ancladas de ADR-031 de golpe.

## Notas para el gate humano

**1. La decisión que apruebas es (A), y su argumento fuerte no es la honestidad.** Es que
**(B) no cierra el roce**: `npm version` escribirá esas dos líneas se declaren
significativas o no, así que bajo (B) sigue habiendo un revert manual en cada subida,
para siempre, solo que con una cita al lado. Si tu lectura es que la fricción de un revert
documentado es tolerable y prefieres no meter el lock en los conjuntos cerrados, **dilo y
la reescribo como (B)** — pero entonces hay que aceptar que la convención no tendrá
guardia que la ejecute, y ADR-031 ya documentó cómo acaba eso (dos días).

**2. Hay una frase falsa en un ADR aprobado, y esa es la causa raíz.** ADR-024 pto. 8 dice
que `npm version … --no-git-tag-version` *«edita `package.json` y nada más»*. Su intención
era el contraste con las etiquetas de git; su letra es falsa y es lo que se leyó dos veces.
**No la edito** —los ADR son inmutables— y propongo **ADR-033** como enmienda, igual que
ADR-024 hizo con ADR-018 D-6. **Necesita tu aprobación por separado.**

**3. Colisión de id posible: ADR-033.** Los ids de spec me los fijaste desde fuera (053)
porque hay otro arquitecto en SPEC-052 en paralelo, pero **el del ADR lo he tomado yo**.
Lo he comprobado al terminar: SPEC-052 ya ha depositado su spec y su ledger en este mismo
worktree y **no ha creado ningún ADR** —en `docs/adr/` el único fichero nuevo es el mío—.
Riesgo bajo, pero aún puede estar escribiendo: **vuelve a mirarlo antes de mergear**. Si
colisiona, es un renombrado.

**4. Cuesta un minuto de CI por spec, y no te lo estoy escondiendo.** Sincronizar el lock
invalida la caché del navegador de Playwright (`hashFiles('package-lock.json')`), así que
cada PR que suba el número se traga ~130 MB de chromium. Está en §Fuera de alcance con su
disparador de reapertura. **No lo arreglo aquí a propósito**: tocar esa clave es tocar un
step de CI que `tests/spec-031-frontera.test.ts` congela, y sería poner en juego un CA de
gate para arreglar otro — literalmente el error que `F-SPEC-050-4` describe. Si prefieres
que entre en esta spec, es una decisión tuya y la escribo.

**5. Lo que cambia para las specs futuras, en una línea.** Una spec que suba la versión
lista `package.json` **y** `package-lock.json` en su conjunto cerrado de ficheros. Nada
más. Y desde CA-4 nadie tiene que acordarse: si lo revierte, la suite se pone roja.

**6. Dos de los doce CA son gate y no test, y están marcados.** CA-2, CA-3, CA-11 y CA-12
—cuatro, no dos— son criterios sobre un **delta** (*«esta reparación estuvo acotada»*) y
por **RI-03** van al ledger con evidencia, **`n-a` en la columna Test**. Codificarlos como
test permanente es exactamente lo que ADR-031 prohíbe y lo que SPEC-048 tuvo que desmontar.
Si en la verificación ves alguno de esos cuatro convertido en un test que mira
`git diff origin/main`, **es un RED**.

**7. Esta entrega NO sube la versión, y eso es correcto.** No toca `src/` ni `app/`, así
que `npm run version:check` saldrá `0` diciendo *«El diff no toca codigo de aplicacion»*.
La sincronización del lock a `0.3.4` es una reparación, no un bump. Si al verificar ves el
número movido a `0.3.5`, pregunta por qué.

**8. La guardia tiene que nacer roja, y quiero ese rojo en el ledger.** El defecto está
vivo sobre `3b6fc8b`: escribir el test **antes** de tocar el lock lo pone rojo por un
motivo real. Es la mejor prueba de no-vacuidad que se puede pedir y es gratis. Un ledger
que no la traiga es un ledger que no ha demostrado que el test mire algo.
