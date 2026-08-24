---
id: ADR-033
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-23, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-033: El `package-lock.json` lleva la versión de producto, el bump commitea los dos ficheros y una propiedad lo vigila (enmienda pto. 8 de ADR-024)

- Deciders: propone **sdd-arquitecto** (2026-08-23, al especificar **SPEC-053**).
  Pendiente de aprobación por el **humano (Alberto Fojo)** en el gate de SPEC-053.
  El humano había expresado una lectura previa —*(B) parece más barato y más honesto con
  lo verificado, pero tiene el olor de normalizar un artefacto que miente*— y pidió
  explícitamente que se decidiera con argumentos y no por comodidad. Se decide **(A)**, y
  el argumento que la decide **no** es el de la honestidad sino el del pto. 1 de
  §Decisión: **(B) no elimina el revert manual, lo institucionaliza**.
- Specs relacionadas: la origina y la consume **SPEC-053**. **Enmienda el pto. 8 de
  ADR-024**; no lo supersede ni toca ningún otro de sus puntos. La levanta
  `F-SPEC-050-4` (ledger de **SPEC-050**). Aplica **RI-03** / **ADR-031** al decidir dónde
  vive la comprobación. No toca **SPEC-031**, **SPEC-038**, **SPEC-049** ni la puerta de
  **SPEC-028**.

## Contexto

### El hecho

Sobre `origin/main` = `3b6fc8b` (2026-08-23), `package.json` declara `0.3.4` y
`package-lock.json` declara `0.3.2` en sus **dos** campos de versión —el de la raíz y el de
`packages[""]`—. El campo del lock se movió con cada subida hasta `0.3.2` (`3f62762`) y
desde entonces se quedó quieto mientras el de `package.json` subió dos veces más.

### Por qué se produce

**ADR-024** pto. 9 exige subir la versión en toda rama que toque código de aplicación, y su
pto. 8 dice cómo: `npm version <segmento> --no-git-tag-version`. Ese comando escribe
**dos** ficheros. Medido el 2026-08-23 sobre una copia exacta de `3b6fc8b`, el diff que
produce sobre `package-lock.json` es **exactamente dos líneas** —la 3 y la 9, los dos
campos `version`— y nada más: ni un `integrity`, ni un `resolved`, ni una entrada de
dependencia. No re-resuelve nada.

Pero las specs de este proyecto acotan su alcance con un **conjunto cerrado de ficheros**
que dice «únicamente», y `package-lock.json` nunca ha estado en esa lista. Dos
implementadores han revertido el cambio del lock para no romper su propio criterio de
acotación: **SPEC-051** (sin dejarlo escrito) y **SPEC-050** (dejándolo escrito, como
`F-SPEC-050-4`).

### La causa raíz es una frase, y está en un ADR aprobado

**ADR-024 pto. 8**, literal:

> Se sube con `npm version <segmento> --no-git-tag-version`, que **edita `package.json` y
> nada más**: no se crean etiquetas de git […]

La **intención** de la frase es el contraste con las etiquetas de git; el párrafo entero va
de eso. Su **letra** afirma que el comando edita un solo fichero, y es **falsa**. La letra
es lo que se lee cuando alguien está a mitad de una entrega, ve un `package-lock.json`
modificado que no pidió y busca autoridad para revertirlo.

### Lo que esto no es, y hay que decirlo antes de decidir

**No rompe nada.** Verificado contra `3b6fc8b`: el único uso de `package-lock.json` en CI
es `hashFiles(…)` como clave de caché de Playwright; `npm ci` valida el árbol de
dependencias y no el `version` de la raíz (`npm ci --dry-run` → 0 con la deriva puesta); el
semver de producto sale de `package.json` vía `STOCKEIRO_VERSION` (ADR-024 pto. 4) y
`check-version-bump.mjs` compara **dos `package.json`** con `git show`. La CI y la puerta
de despliegue pasan hoy en `main` con la deriva dentro. Y no hay un tercer sitio: los
`"version": "7"` de `drizzle/meta/*.json` son la versión del formato de snapshot de
drizzle-kit, no del producto.

El daño es **fricción operativa recurrente** más un artefacto que declara un número que no
es. Este ADR no lo infla ni lo minimiza.

### Las dos salidas

Eran excluyentes:

- **(A)** el lock lleva la versión, se sincroniza al subir, y algo lo comprueba;
- **(B)** el lock **no** lleva la versión de producto, se declara por escrito que ese campo
  es ruido de npm, y las specs siguen revirtiéndolo con una razón citable.

## Decisión

**1. Se elige (A). El argumento que la decide es que (B) no elimina el trabajo: lo
institucionaliza.** El roce a cerrar es un **revert manual recurrente**. `npm version`
escribe esas dos líneas se declaren significativas o no; bajo (B) cada subida futura sigue
produciendo un diff que alguien tiene que revertir a mano, y lo único que cambia es que el
revert tiene una cita al lado. Bajo (A) el comando que el gate ya recomienda produce el
resultado correcto y no queda paso manual ninguno.

**2. (B) además necesitaría un mecanismo, y su mecanismo sería absurdo.** Una convención
sin guardia que la ejecute compite con la prisa y pierde — es lo que **ADR-031** documentó
al ver saltarse una convención de `FOUNDATION.md` **dos días** después de escribirla. Para
sostener (B) haría falta una guardia que **falle cuando `npm version` hace su trabajo
normal**; y sin guardia, el campo del lock queda en el valor de la última vez que alguien
olvidó revertir. (B) sin mecanismo es deriva con permiso; (B) con mecanismo es pelearse
con la herramienta.

**3. El campo `version` de `package-lock.json` es, a partir de aquí, un espejo derivado y
obligatorio de `package.json`.** No es una segunda fuente de verdad y no se le pregunta
nada: **la fuente sigue siendo `package.json`** (ADR-024 pto. 3, intacto). Lo que se decide
es que el espejo **tiene que reflejar**, y que el reflejo es responsabilidad del mismo
commit que mueve el original.

**4. El bump commitea los dos ficheros.** `npm version <segmento> --no-git-tag-version`
edita `package.json` **y** `package-lock.json`, y **los dos entran en el mismo commit**.
Una reparación sin subir el número se hace con `npm install --package-lock-only`, que sobre
este árbol produce el mismo diff de dos líneas. En ninguno de los dos casos se edita el
lock a mano.

**5. Una spec que sube la versión lista los dos ficheros en su conjunto cerrado.** La
disciplina de acotación **sigue siendo cerrada y sigue diciendo «únicamente»**: lo que
cambia es su contenido, no su naturaleza. El coste es un nombre más en una lista, y está
acotado por el pto. 4: el diff son dos líneas, no un fichero enorme sin revisar.

**6. Se comprueba con una PROPIEDAD de la suite, no con un criterio de gate.** Por
**RI-03** / **ADR-031** pto. 1, *«los tres campos de versión coinciden»* es cierto sobre el
**estado del árbol** en cualquier momento y para siempre: se escribe como test permanente
que lee los dos ficheros del disco y **no invoca git en absoluto** —sin `git diff`, sin
`git show`, sin ventana de sha, sin `skipIf`—. No puede caducar al mergear y no puede
quedarse vacío. (B), por contraste, **no tiene ninguna propiedad testable**: no se puede
aseverar *«este campo no significa nada»*.

**7. El gate de versión NO gana lógica nueva.** `scripts/check-version-bump.mjs` sigue
comparando dos `package.json` y sigue sin mirar el lock. Duplicar la comprobación en el
script sería un segundo sitio donde vive la misma verdad, y además la haría depender de git
cuando no lo necesita. Del script solo cambia **texto** (pto. 8).

**8. El bucle de aprendizaje se cierra en los tres sitios donde alguien se lo encuentra.**
Quien sube la versión no debe tener que deducir esto:
   - la **cabecera** de `scripts/check-version-bump.mjs` y su **`--help`** dicen que el
     comando toca los dos ficheros y que los dos van al commit, con este ADR citado;
   - el mensaje del veredicto **`sin-subir`** —el que se lee en caliente, con la PR en
     rojo, y que ya lista `npm version patch/minor`— lo dice también; es el único de los
     tres que alguien lee sin buscarlo;
   - el **rojo de la guardia** del pto. 6 nombra los dos ficheros, los tres campos con su
     valor real y el comando que los sincroniza.

**9. Esto ENMIENDA el pto. 8 de ADR-024; no lo supersede.** ADR-024 está **aprobado** y es
inmutable: no se reescribe. Lo que cambia es **una cláusula** —la que afirma que
`npm version … --no-git-tag-version` edita `package.json` y nada más—. **Todo lo demás del
pto. 8 sigue vigente y queda explícitamente reafirmado**: quién sube el número es una
persona y deliberadamente; la guía PATCH/MINOR/MAJOR no cambia; y **no se crean etiquetas
de git**, que era la afirmación que aquella frase de verdad quería hacer. Quien lea el pto.
8 a partir de hoy debe leerlo junto a este ADR. **Ningún otro punto de ADR-024 queda
tocado**: la fuente de verdad sigue siendo `package.json` (pto. 3), se sigue leyendo en
build (pto. 4), se valida por contenido (pto. 5), una sola fuente y dos consumidores (pto.
6), el gate sigue exigiendo el bump (pto. 9), la comparación sigue siendo semver (pto. 10)
y la puerta post-despliegue sigue mirando el **commit** y no el semver (pto. 11). El
precedente de forma es el propio ADR-024, que enmendó D-6 de ADR-018 en vez de reescribirlo.

**10. No se crea una regla `RI-xx`.** El mecanismo del pto. 6 sustituye a la convención:
quien revierta el lock verá la suite roja antes de abrir la PR. Una regla en prosa además
del test sería una tercera copia de la misma verdad, y la serie RI existe para lo que **no**
se puede hacer cumplir solo. Si algún día la guardia se borrara, ahí sí habría que
escribirla.

## Consecuencias

### Positivas

- **El revert manual desaparece.** El comando que el gate recomienda produce el resultado
  correcto y no hay nada que deshacer, nunca más.
- **La disciplina deja de depender de la memoria.** Es un rojo de la suite, no una
  costumbre — la diferencia que ADR-031 existe para nombrar.
- **La guardia nace roja por un defecto real** (`0.3.4` ≠ `0.3.2` sobre `3b6fc8b`), que es
  la mejor prueba de no-vacuidad posible y es gratis.
- **No caduca.** Es una propiedad del árbol, sin git: sobrevive a cualquier merge, a
  cualquier clon superficial y a cualquier reescritura de histórico.
- **La causa raíz queda nombrada por escrito** en vez de redescubrirse una tercera vez.
- **Cero superficie nueva de producto**: no toca `src/`, ni `/api/version`, ni el pie, ni
  `check-alive.mjs`. Lo que ve el usuario no cambia en un byte.

### Negativas / follow-ups

- **`ADR-024` pto. 8 deja de leerse solo.** Es el coste inevitable de enmendar un ADR
  aprobado en vez de reescribirlo, y es el mismo coste que ADR-024 aceptó con ADR-018 D-6.
  Se mitiga citando este ADR desde el propio script (pto. 8) y desde SPEC-053.
- **`F-ADR-033-1` — la caché del navegador de Playwright se invalida en cada bump.** La
  clave es `playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}`
  (`.github/workflows/ci.yml:169`) y su comentario dice que sale del lock *«porque es lo
  que fija la version de @playwright/test»*. Bajo esta decisión el lock cambia también
  cuando `@playwright/test` no se ha movido: **~130 MB de descarga de chromium en cada PR
  que suba el número**, aproximadamente un minuto. Además de tiempo hay un daño de diseño:
  una clave elegida para seguir a un paquete pasa a seguir a algo ajeno. **Se acepta**:
  arreglarlo obliga a tocar un step de CI que `tests/spec-031-frontera.test.ts` congela, y
  eso es poner en juego un criterio de gate para arreglar otro. *Destino*: **EPIC-INFRA**,
  el día que el minuto moleste o el job de e2e se acerque a su `timeout-minutes: 25`.
- **Un fichero más en cada conjunto cerrado** de las specs que suban versión. Fricción
  real, pequeña, y acotada por el hecho de que el diff son dos líneas.
- **Se depende de que `npm version` siga escribiendo solo esas dos líneas.** Si una versión
  futura de npm empezara a re-resolver dependencias al subir el número, meter el lock en un
  conjunto cerrado dejaría de ser barato. Es uno de los tres disparadores que reabrirían la
  decisión (ver §Alternativas, (B)).
- **El histórico no se toca.** El lock declaró `0.3.2` durante dos subidas y se queda así:
  reescribir el histórico para cuadrar un campo derivado invalidaría de golpe todas las
  ventanas ancladas de ADR-031.

## Alternativas consideradas

- **(B) Declarar por escrito que el lock no lleva la versión de producto**, hacer que el
  gate lo ignore explícitamente y permitir a las specs seguir revirtiéndolo con una razón
  citable. Era la opción **más barata de escribir** y la más fiel a lo verificado (nadie lee
  ese campo). **Rechazada** por el pto. 1: no elimina el revert manual, lo convierte en un
  ritual permanente con nota al pie; y por el pto. 2: para sostenerse necesitaría una
  guardia que falle cuando la herramienta hace su trabajo, y sin guardia el campo queda en
  un valor aleatorio. Como argumento secundario —y solo secundario— normaliza un artefacto
  que afirma un número que no es, que es lo que ADR-024 rechaza en su propio razonamiento
  (*«un número congelado miente más que no tener número»*). **Se reabre** si npm deja de
  escribir el campo o aparece una bandera estable para no escribirlo; si la guardia del pto.
  6 se pone roja tres entregas seguidas por motivos que no son la deriva; o si sincronizar
  deja de ser un diff de dos líneas. El vehículo sería un ADR que supersede a este.

- **Que `check-version-bump.mjs` comprobara también el lock** (pto. 7). Es lo que sugería la
  formulación original de (A), y es tentador porque el script ya lee `package.json` en una
  referencia. **Rechazada**: sería un segundo sitio con la misma verdad, y haría depender de
  git una comprobación que no necesita git ni la referencia de nadie. Por **RI-03** una
  propiedad del árbol se prueba como propiedad del árbol; el script se queda en lo que sabe
  hacer, que es juzgar un delta.

- **Un step propio de CI para la comprobación**, al estilo de `Migration scan` o
  `Version bump`. **Rechazada**: el valor de un step propio es que el nombre del check rojo
  diga qué se rompió, y aquí un rojo de *«las versiones de `package.json` y
  `package-lock.json` no coinciden»* dentro de `Unit tests` ya se lee perfectamente. Un
  step más es superficie de CI congelada por `tests/spec-031-frontera.test.ts` a cambio de
  nada.

- **Quitar `package-lock.json` del repositorio** o dejar de versionarlo. **Rechazada de
  plano**: `npm ci` lo exige, es lo que hace reproducible el build, y resolvería el
  problema del campo destruyendo la razón de existir del fichero.

- **Editar la frase de ADR-024 pto. 8** para que diga la verdad. Es lo que apetece: son
  cuatro palabras. **Rechazada**: un ADR aceptado es **inmutable**, y corregir en el sitio
  una frase que ya fue leída y actuada dos veces borraría precisamente la historia que
  explica por qué existe esta decisión. La enmienda por ADR nuevo es el mecanismo que el
  propio ADR-024 usó con ADR-018 D-6.

- **Escribir una `RI-04` en `docs/fundacion/reglas.md`** además de la guardia (pto. 10).
  **Rechazada**: la serie RI existe para lo que no se puede hacer cumplir solo, y esto sí
  se puede. Una regla en prosa junto a un test que ya la ejecuta es una tercera copia de la
  misma verdad, y las copias se desincronizan.

- **Arreglar aquí la clave de caché de Playwright** para que el bump no la invalide.
  **Rechazada para este ADR** (ver `F-ADR-033-1`): toca un step de CI congelado por una
  guardia entregada, en una decisión cuyo objeto es el número de versión. Poner en juego un
  criterio de gate para arreglar otro es el error que `F-SPEC-050-4` describe.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
