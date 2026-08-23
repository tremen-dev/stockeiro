---
id: SPEC-053
tipo: spec
epica: EPIC-INFRA
estado: en-progreso
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-23, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-23, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-23, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-08-24, por: sdd-arquitecto (CA-13 y CA-14 anadidos; enmienda de CA-11 y CA-12 autorizada por humano (Alberto Fojo) el 2026-08-24 para cerrar F-SPEC-053-4)}
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
  ficheros de test tocados, **entonces** los únicos son el **fichero nuevo** de CA-4,
  `tests/version-bump-gate.test.ts` —este último **solo** para añadir los casos de CA-8 y
  CA-9— y `tests/primera-pantalla-fuente.test.ts`, **solo** para lo que **CA-13** autoriza
  nominalmente. En particular **no se toca** ni una línea de sus bloques *SPEC-038 CA-12* y
  *SPEC-038 CA-13* (el que congela el step de CI, `npm run version:check`, el job `Checks`
  y `fetch-depth: 0`), ni de los cinco motivos de `evaluar`, ni del contrato de códigos de
  salida de SPEC-049. Añadir sí; aflojar no. Si algo de ahí **tiene** que cambiar,
  **para y escálalo al gate humano**: quien toca la guardia no es quien se beneficia
  (`FOUNDATION.md`, ADR-031 pto. 5). *Verificación*: `git diff --name-only` de la rama y el
  diff de ese fichero, pegados en el ledger. **`n-a` en la columna Test.**

- **CA-12** *(gate)*: **Dado** el diff completo de la rama, **cuando** se listan sus
  ficheros, **entonces** son **únicamente**: `package-lock.json`; `scripts/check-version-bump.mjs`;
  `tests/version-bump-gate.test.ts`; el fichero de test nuevo de CA-4;
  `tests/primera-pantalla-fuente.test.ts` (**solo** lo que autoriza CA-13); esta spec y su
  ledger; `docs/adr/ADR-033-*.md`; y `docs/tablero.md`. **Ningún fichero de `src/`, ninguna
  migración, ni `.github/workflows/ci.yml`, ni `.sdd.json`, ni `package.json`.**
  **`n-a` en la columna Test.**

  > **Enmienda del 2026-08-24, autorizada por el humano (Alberto Fojo).** `tests/primera-pantalla-fuente.test.ts`
  > **no estaba** en esta lista ni en la de CA-11 cuando el humano aprobó la spec el
  > 2026-08-23: se añade al abrirse `F-SPEC-053-4`, y **solo** con el alcance que CA-13
  > acota. El implementador **no lo tocó** y escaló, que es lo que había que hacer; esta
  > ampliación la escribe el **arquitecto**, no él. Cualquier otra línea de ese fichero
  > sigue siendo **RED**.

  > **Y aquí se estrena la regla nueva**, que es medio punto de esta spec: si esta entrega
  > **tuviera** que subir la versión, `package.json` **y** `package-lock.json` entrarían
  > los dos en esa lista. No tiene que: `.sdd.json` declara `rutasVigiladas: ["src/",
  > "app/"]` y esta rama no toca ninguna de las dos, así que `npm run version:check` dirá
  > *«El diff no toca codigo de aplicacion»* y saldrá **0**. La sincronización del lock a
  > `0.3.4` es una **reparación**, no una subida.

### La guardia ajena que se rompió, y por qué se retira en vez de re-encuadrarse

> **Esto se añade el 2026-08-24, después de aprobada la spec**, porque la implementación se
> topó con una guardia **ajena** en rojo y **escaló en vez de tocarla** (`F-SPEC-053-4`). Hizo
> lo correcto. El humano (**Alberto Fojo**) autorizó el arreglo ese mismo día y pidió que lo
> redactara el **arquitecto**, no el implementador, por la razón de `FOUNDATION.md`: **quien se
> beneficia de que una guardia calle no escribe cómo callarla.**

#### El hecho

`tests/primera-pantalla-fuente.test.ts:310-318` (**SPEC-050 CA-20**, ya mergeada) barre
`docs/adr/` y exige que **ningún** fichero contenga la cadena `SPEC-050`:

```ts
const citantes = adrs.filter((f) => fuente(`docs/adr/${f}`).includes('SPEC-050'));
expect(citantes, 'esta spec no toma ninguna decisión que constriña trabajo futuro (CE-M3)…').toEqual([]);
```

Verificado por mí: `npx vitest run tests/primera-pantalla-fuente.test.ts` → **1 rojo de 21**, y
el rojo lo dispara `ADR-033`. Se puso roja con **`e24c578`** —el commit que deposita el ADR,
mío— y **no con ningún commit del implementador**.

**Por qué se dispara.** Lo que la guardia **quiere** afirmar es razonable: *SPEC-050 no registró
ningún ADR porque no tomó ninguna decisión que constriña futuro* (CE-M3). Lo que **afirma de
hecho** es mucho más ancho: *ningún fichero de `docs/adr/` contiene jamás la cadena `SPEC-050`*.
Confunde **«SPEC-050 tomó una decisión»** con **«alguien menciona a SPEC-050»**. ADR-033 la
menciona porque cita **`F-SPEC-050-4`**, el hallazgo que origina esta spec — que es exactamente
el comportamiento sano de este proyecto: unas specs levantan hallazgos y otras los recogen.

#### La salida elegida: **(b) retirar el caso**. Cuatro razones, en orden de peso

**1. (a) re-encuadrar no funciona, y no lo digo por intuición: lo he comprobado.** La
formulación que el implementador anotó —*«mirar la línea `Specs relacionadas` del ADR y exigir
que ninguna declare a SPEC-050 como la spec que lo origina»*— **seguiría en rojo**. La línea
`Specs relacionadas` de ADR-033 (`docs/adr/ADR-033-…md:19-23`) **contiene** `SPEC-050`, porque
es ahí donde cita `F-SPEC-050-4`. Para que (a) pasara habría que distinguir, **en prosa libre**,
*«la origina SPEC-053»* de *«la levanta `F-SPEC-050-4` (ledger de SPEC-050)»* — un analizador de
texto sobre una viñeta que cada ADR redacta a su manera, y que se rompería con el primero que la
escriba distinto. Cambiaríamos un rojo sin defecto detrás por otro rojo sin defecto detrás, más
caro de mantener.

**2. La proposición ya no puede volver a ser falsa, así que no queda nada que vigilar.** Lo que
el caso niega es *«SPEC-050 registró un ADR»*. **SPEC-050 está en `hecho`, y una spec en `hecho`
no se reabre** (**ADR-025**): no puede registrar nada nunca más. Una guardia sobre una pregunta
ya zanjada no protege de nada; solo puede dar falsos rojos, que es lo que ha hecho. Es
literalmente la **segunda salida legítima** de `FOUNDATION.md`: *borrar, si lo que vigilaba era
del momento de la entrega y ya no puede volver a ser cierto*.

**3. Y es criterio de gate, no propiedad** — **ADR-031** pto. 1.2, **RI-03**. *«Esta entrega no
metió un ADR de tapadillo»* es cierto sobre un **delta**, y su verificador natural es el gate.
Lo fue: el ledger de SPEC-050 lleva el **GREEN 22/22 del 2026-08-23**. El caso es el molde que
SPEC-048 tuvo que desmontar, colado **una spec más tarde**, y con un agravante que conviene
nombrar: los tres casos de SPEC-047 caducaron a **verde vacío** (diff vacío ⇒ aserción
trivialmente cierta); éste caduca a **rojo falso**, porque el conjunto que barre (`docs/adr/`)
solo crece. El verde vacío engaña en silencio; el rojo falso **para la CI de un tercero**, que
es exactamente lo que le acaba de pasar a esta rama.

**4. (c) —spec propia— sería ceremonia.** Es la retirada de un caso, en un fichero que esta rama
ya tiene que poder tocar (CA-11 y CA-12 enmendadas), con la autorización nominal ya dada. Una
spec entera para eso cuesta más que el defecto y deja la CI roja mientras tanto.

**Y el parche que NO se acepta, escrito para que no vuelva**: excluir `ADR-033` **por nombre**
del filtro. Dejaría el molde intacto y volvería a romperse con el siguiente ADR que mencione a
SPEC-050 —y habrá más, porque `F-SPEC-050-4` es un hallazgo vivo—. Lo descartó el humano el
**2026-08-24** y **no tengo argumento que oponerle: coincido**; la condición 3 de CA-13 lo
prohíbe explícitamente.

#### Qué cobertura se pierde, y por qué es aceptable

**Se pierde**: cazar automáticamente que alguien, en el futuro, **retro-ajuste un ADR a
SPEC-050** presentándola como la spec que lo origina. Aceptable por tres motivos: (i) sería una
afirmación falsa sobre una spec `hecho`, que **ADR-025** ya prohíbe; (ii) todo ADR pasa por el
gate humano, que es donde ese criterio de gate debe verificarse; y (iii) el precio de
conservarla es el analizador de prosa del punto 1, que ya sabemos que da rojos sin defecto.

**No se pierde**: la **otra mitad de CA-20** —las listas **exactas** de `dependencies`,
`devDependencies` y `scripts` de `package.json`, y que `version` siga siendo semver— que **sí**
es una propiedad del árbol, no depende de git, y **se queda intacta**. Los otros 20 casos del
fichero, también.

**Y por qué aquí no hay «inverso» que poner, a diferencia de SPEC-050 CA-22.** Aquel precedente
pudo sustituir el caso retirado por su contrario —*«en `/` el canal NO se muestra»*— porque lo
retirado era una afirmación sobre un **comportamiento vivo**, que seguía teniendo dos valores
posibles. Aquí no: la proposición está zanjada, y su contrario —*«SPEC-050 sí registró un
ADR»*— es falso **y** tan incomprobable a futuro como el original. Un test en su lugar sería el
verde vacío que ADR-031 prohíbe. Lo que sustituye al caso es **prosa en el sitio** (condición 2
de CA-13), que es el molde que `FOUNDATION.md` sanciona para la salida «borrar» y que
**`F-SPEC-042-9`** ya usó.

### Los criterios que gobiernan el arreglo

- **CA-13** *(propiedad)* **— la única guardia ajena que se retira, nombrada, y sin perder
  fuerza.** **Dado** el único caso ajeno que esta entrega toca —y **solo** ése—, **cuando** se
  lee `tests/primera-pantalla-fuente.test.ts` **tal y como queda en el árbol**, **entonces** se
  cumplen las **cuatro** condiciones, que son las mismas que **SPEC-047 CA-19** impuso a las
  suyas y **SPEC-050 CA-22** a la suya:

  1. **Está nombrado, y es exactamente éste**: `tests/primera-pantalla-fuente.test.ts:310-318`,
     el caso *«`docs/adr/` no gana ningún fichero por esta spec: no hay decisión que
     registrar»*, del bloque **SPEC-050 CA-20**. Se **retira entero**. Ninguna otra línea de ese
     fichero, y ningún otro fichero ajeno.
  2. **Lleva su porqué escrito en el sitio** —en el propio fichero, donde estaba el caso, y no
     solo en el ledger—: **qué vigilaba antes**, **qué vigila ahora** (nada en la suite: la
     afirmación vuelve al gate, donde ya se consumó), **en virtud de qué CA** (`SPEC-053 CA-13`),
     con la **fecha** y la **autorización nominal del humano (Alberto Fojo) del 2026-08-24**, y
     dejando constancia de que **quien lo escribe no es quien se beneficia**: lo escaló el
     implementador como `F-SPEC-053-4` y lo redacta el **arquitecto**. Molde: `F-SPEC-042-9` y
     SPEC-048 CA-8.
  3. **No es una aflojada y no se toca nada más.** Los otros **20 casos** del fichero siguen
     **verdes y sin una línea tocada** —en particular la otra mitad del propio CA-20—. No se
     marca nada `.skip`, no se borra ningún otro caso, no se cambia ninguna comparación exacta
     por una laxa, y —**explícitamente prohibido**— **no se añade ninguna exclusión por nombre**
     de `ADR-033` ni de ningún otro fichero: eso dejaría el molde vivo para el siguiente.
  4. **Ninguna propiedad protegida se debilita.** Lo retirado no era una propiedad: era un
     criterio de gate ya verificado (GREEN 22/22 de SPEC-050, 2026-08-23) sobre una pregunta que
     **ADR-025** deja cerrada para siempre. Lo que sí era propiedad en CA-20 se queda.

  *Y la condición de proceso, que no es decorativa*: el implementador **no tocó el fichero** y
  escaló; el humano lo autorizó el **2026-08-24**; y la autorización queda escrita **aquí, en la
  spec, antes de que se implemente**. Un cambio en ese fichero que no esté en esta lista **no
  está autorizado** por haberse razonado en el ledger a posteriori.

- **CA-14** *(propiedad + gate)* **— la suite vuelve a verde entera, y no por haber aflojado
  otra cosa.** **Dado** el árbol entregado, **cuando** se ejecuta `npx vitest run`, **entonces**
  hay **cero rojos**; y el recuento lo demuestra caso a caso: `tests/primera-pantalla-fuente.test.ts`
  pasa de **21 casos (20 verdes + 1 rojo)** a **20 casos, los 20 verdes** —la diferencia es
  **exactamente uno**, y es el retirado—, y **ningún otro fichero de `tests/` cambia su número
  de casos**. Los dos recuentos, antes y después, van al ledger. Un verde global obtenido
  retirando dos casos en vez de uno es **RED**.


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
- **No se escribe una meta-guardia contra este molde.** La forma rota es concreta y
  nombrable: *una aserción que enumera `docs/adr/` y espera que el resultado sea vacío*. Ese
  directorio **solo crece**, así que cualquier afirmación negativa cerrada sobre él nace
  caducada. Y hay que distinguirla de la forma **sana**, que este mismo proyecto usa y que
  esta spec usa en CA-10: afirmar una propiedad de un ADR **nombrado** (*«`ADR-024` sigue
  conteniendo esta frase»*) es permanente y legítimo. Una meta-guardia que no supiera separar
  las dos mataría el centinela de CA-10. Y aunque supiera: **es una sola aparición**, no un
  patrón — `grep` sobre `tests/` da dos ficheros que leen `docs/adr/`, y el otro es el de
  CA-10, que es de la forma sana. `FOUNDATION.md` creó su convención tras **cuatro**
  incidentes y ADR-031 su meta-guardia tras **cinco**. *Destino*: **EPIC-FIX**. *Lo que lo
  dispara*: la **segunda** aparición del molde. Queda escrito para que quien la vea sepa que
  ya es la segunda.
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

**9. Lo añadido el 2026-08-24: la guardia ajena, y la salida que elegí.** Me pediste que lo
redactara yo y no el implementador; lo he hecho, y **elijo (b) retirar el caso**, no (a)
re-encuadrarlo. El argumento que lo decide **no** es el tuyo —que «acotado» es criterio de gate,
que lo es y lo digo como razón 3—, sino uno que he comprobado y que nadie tenía: **(a) no
funciona**. La línea `Specs relacionadas` de ADR-033 contiene `SPEC-050`, así que el
re-encuadre que el implementador esbozó **seguiría en rojo** sobre el mismísimo ADR que lo
disparó; para pasar tendría que ser un analizador de prosa libre. Y hay una razón 2 que estaba
antes que todas: **SPEC-050 está en `hecho` y ADR-025 no la deja reabrirse**, así que la
proposición que el caso negaba no puede volver a ser falsa — no hay nada que vigilar. **Lo que
se pierde está escrito sin adornos** en §Qué cobertura se pierde. **El parche de excluir
`ADR-033` por nombre lo prohíbe la condición 3 de CA-13**: coincido contigo y no tengo
argumento que oponerte.

**10. Dos CA nuevos y dos enmendados; míralo con lupa porque toca acotación.** CA-13 y CA-14
son nuevos. **CA-11 y CA-12 los he enmendado** para admitir `tests/primera-pantalla-fuente.test.ts`
en el conjunto cerrado —sin eso, el arreglo sería RED por mi propia spec—, y la enmienda va
marcada con su fecha y tu autorización dentro de CA-12. **Cualquier otra línea de ese fichero
sigue siendo RED**, y el fichero entero seguía fuera del conjunto cuando aprobaste el
2026-08-23.

**8. La guardia tiene que nacer roja, y quiero ese rojo en el ledger.** El defecto está
vivo sobre `3b6fc8b`: escribir el test **antes** de tocar el lock lo pone rojo por un
motivo real. Es la mejor prueba de no-vacuidad que se puede pedir y es gratis. Un ledger
que no la traiga es un ledger que no ha demostrado que el test mire algo.
