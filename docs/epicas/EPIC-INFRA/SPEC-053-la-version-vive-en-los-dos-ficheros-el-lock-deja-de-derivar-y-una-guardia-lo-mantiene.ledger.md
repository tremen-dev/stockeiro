---
id: SPEC-053
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-053 La versión vive en los dos ficheros: el lock deja de derivar y una guardia lo mantiene

## Resumen
- Fase: **en-revisión** — implementación terminada, pendiente del verificador. La fuente de
  verdad es el frontmatter de la spec.
- Rama: `ft/SPEC-053-la-version-vive-en-los-dos-ficheros-el-lock-deja-de-derivar-y-una-guardia-lo-mantiene`,
  desde `origin/main` = **`3b6fc8b`**.
- Trae un ADR aprobado aparte en el mismo gate: **ADR-033** (enmienda el pto. 8 de ADR-024).
- **Esta entrega NO sube la versión, y es correcto**: no toca `src/` ni `app/`.
  `package.json` se queda en **`0.3.4`** y el lock se sincroniza **a ese mismo número**.
  La sincronización es una **reparación**, no un bump (`npm run version:check` → **0**,
  *«El diff no toca codigo de aplicacion»*; salida pegada abajo).
- **Hay una parada para el gate humano**: `F-SPEC-053-4`. Una guardia **ajena** —
  `tests/primera-pantalla-fuente.test.ts`, SPEC-050 CA-20— se pone **roja** por la mera
  existencia de `ADR-033`. No la toco: no es mía, la cierra CA-11/CA-12, y quien la toca
  no puede ser quien se beneficia (`FOUNDATION.md`, ADR-031 pto. 5). **Detalle y las tres
  salidas posibles en §Salvedades.**

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->

> **Cuatro CA son criterios de GATE, no de test** (RI-03 / ADR-031): **CA-2, CA-3, CA-11 y
> CA-12** afirman algo sobre un **delta** —*«esta reparación estuvo acotada»*—, que deja de
> ser cierto en cuanto se mergea. Van `n-a` en la columna *Test* **a propósito**, con la
> evidencia en §Evidencia de los criterios de gate. Convertirlos en un test que mire
> `git diff origin/main` es exactamente lo que ADR-031 prohíbe y lo que SPEC-048 tuvo que
> desmontar: **si aparecen como test, es RED**.

| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 — los tres campos de versión coinciden | `package-lock.json:3` y `:9` — `0.3.2` → **`0.3.4`**, producido por `npm install --package-lock-only` (no a mano). `package.json` **sin tocar**, en `0.3.4` | `tests/version-en-los-dos-ficheros.test.ts` — *«los tres campos de version declaran exactamente lo mismo»* y *«y los tres son un semver de producto, no una cadena cualquiera»* | | ❌ |
| CA-2 — la reparación del lock es de dos líneas exactas | `package-lock.json` (2 ins / 2 del, y nada más) | **n-a (gate)** — criterio sobre el delta; evidencia abajo | | ❌ |
| CA-3 — `npm ci --dry-run` sigue en 0 tras sincronizar | — (no hay nada que implementar: es una comprobación sobre el árbol reparado) | **n-a (gate)** — criterio sobre el delta; evidencia abajo | | ❌ |
| CA-4 — guardia permanente, sin git y sin salto declarado | `tests/version-en-los-dos-ficheros.test.ts` — `camposDeVersion` / `divergencias`, leídas del disco con `node:fs`; **cero git** | mismo fichero — *«CA-4 — y no invoca git en absoluto: es una propiedad del arbol, no un diff»* (tokens partidos para no autodetectarse; además comprueba que los únicos `node:*` importados son `fs`, `path` y `url`) | | ❌ |
| CA-5 — el rojo enseña la salida (ficheros, campos, comando, «los dos al mismo commit») | `tests/version-en-los-dos-ficheros.test.ts` — `mensajeDeDeriva()`, pasado como mensaje de la aserción | mismo fichero, bloque *«SPEC-053 CA-5: el rojo ensena la salida, no obliga a deducirla»* — 5 casos: los dos ficheros, los tres campos con su valor, los dos comandos, «LOS DOS EN EL MISMO COMMIT» + ADR-033, y que no se queda en un `expected X to be Y` | | ❌ |
| CA-6 — no vacuidad: mutación roja / coincidencia verde, y sin salto/`only`/pendiente | `tests/version-en-los-dos-ficheros.test.ts` — `conLockMutado()` ejercita el camino entero (parsear → comparar) sin escribir en disco | mismo fichero, bloque *«SPEC-053 CA-6: la guardia no puede ser un verde vacio»* — 6 casos: (a) los tres tokens prohibidos; (b) mutación del `version` de la raíz → roja, de `packages[""]` → roja, de `package.json` → los DOS señalados, y los tres iguales → verde. **Y la no-vacuidad fuerte: la guardia nació ROJA sobre `3b6fc8b`, salida pegada abajo** | | ❌ |
| CA-7 — las meta-guardias de SPEC-048 siguen verdes con el fichero nuevo dentro | — (propiedad de lo entregado: la guardia nueva no invoca git) | `tests/revision-movil-en-tests.test.ts` **12/12** y `tests/guardias-no-caducan.test.ts` **6/6**, con el fichero nuevo dentro de `tests/`. Salida abajo. **Nota**: la spec nombra `guardias-no-caducan.test.ts` como *«la meta-guardia que recorre `tests/`»*; la que recorre `tests/` buscando revisiones móviles es `revision-movil-en-tests.test.ts` (SPEC-048 CA-10) — se han corrido **las dos** | | ❌ |
| CA-8 — `--help` y cabecera de `check-version-bump.mjs` dicen «los dos ficheros» | `scripts/check-version-bump.mjs` — bloque nuevo de cabecera *«QUÉ FICHEROS TOCA EL COMANDO QUE ESTE GATE RECOMIENDA (ADR-033…)»* y párrafo nuevo en `USO` | `tests/version-bump-gate.test.ts`, bloque *«SPEC-053 CA-8, CA-9 y CA-10»* — 4 casos: cabecera con los dos ficheros + ADR-033, cabecera con «mismo commit», `--help` con los dos + «MISMO COMMIT» y **saliendo con 0**, y `--help` con `npm install --package-lock-only` | | ❌ |
| CA-9 — el mensaje de `sin-subir` lo dice también (sobre `evaluar`, puro) | `scripts/check-version-bump.mjs` — mensaje del veredicto `sin-subir` | `tests/version-bump-gate.test.ts` — *«CA-9 — el veredicto `sin-subir` lo dice, sobre la función pura y sin invocar git»* (comprueba además que lo de antes sigue: los dos `npm version …`) y *«CA-9 — y los otros motivos no se contaminan»* (`sin-codigo` y `subida` no hablan del lock) | | ❌ |
| CA-10 — no queda en el repositorio ninguna afirmación de «un solo fichero» | `scripts/check-version-bump.mjs` (el texto nuevo no reintroduce la frase); **ADR-024 NO se edita** | `tests/version-bump-gate.test.ts` — 3 casos con **centinela**: el detector *sí* se dispara sobre `docs/adr/ADR-024-*.md` (prueba a la vez que el detector funciona **y** que el ADR sigue intacto: si alguien «arreglara» la frase borrándola, este caso se pondría rojo), **no** se dispara sobre ningún `.mjs` de `scripts/`, y ADR-033 está `aprobada`, dice «enmienda», cita `ADR-024` y `pto. 8` y dice «no lo supersede» | | ❌ |
| CA-11 — sobre `tests/` solo el fichero nuevo y adiciones a `version-bump-gate.test.ts` | `tests/version-bump-gate.test.ts`: **173 insertions, 0 deletions** contra `3b6fc8b` | **n-a (gate)** — criterio sobre el delta; evidencia abajo | | ❌ |
| CA-12 — conjunto cerrado de ficheros de la rama | 7 ficheros, ninguno bajo `src/` | **n-a (gate)** — criterio sobre el delta; evidencia abajo | | ❌ |

## Evidencia de los criterios de gate
<!-- CA-2, CA-3, CA-11, CA-12. Salida de comandos pegada, no parafraseada (RI-03 opción 2). -->

Base de todos los rangos: **`3b6fc8b`** (`origin/main` al salir la rama). Ejecutado en el
worktree `.claude/worktrees/deploy-main`, el 2026-08-24.

### El rojo de la guardia ANTES de tocar el lock (CA-6, y la mitad viva de CA-1)

Escrita sobre `3b6fc8b` sin sincronizar nada. Esto es la no-vacuidad que la spec pide en
su nota 8 del gate, y es la prueba de que la guardia mira algo real:

```
$ npx vitest run tests/version-en-los-dos-ficheros.test.ts

 FAIL  tests/version-en-los-dos-ficheros.test.ts > SPEC-053 CA-1 y CA-4: la version vive
       en los dos ficheros y coincide > los tres campos de version declaran exactamente
       lo mismo
AssertionError: Las versiones de package.json y package-lock.json no coinciden (SPEC-053 CA-1 / ADR-033).

Los tres campos que tienen que decir lo mismo:
  · package.json → version   = 0.3.4   <- la fuente de verdad (ADR-024 pto. 3)
  · package-lock.json → version   = 0.3.2
  · package-lock.json → packages[""].version   = 0.3.2

No edites package-lock.json a mano. Lo sincroniza npm:
  npm install --package-lock-only            # reparar sin subir el numero
  npm version <segmento> --no-git-tag-version # subirlo y sincronizar a la vez

Y package.json y package-lock.json entran LOS DOS EN EL MISMO COMMIT (ADR-033 pto. 4).
Si estas subiendo la version, tu spec lista LOS DOS ficheros en su conjunto
cerrado (ADR-033 pto. 5): revertir el lock para no romper la acotacion es lo que
produjo esta deriva dos veces.: expected [ 'package-lock.json → version', …(1) ] to deeply equal []

- Expected
+ Received
- Array []
+ Array [
+   "package-lock.json → version",
+   "package-lock.json → packages[\"\"].version",
+ ]

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
```

**Los 12 verdes de esa misma ejecución son los de CA-5 y CA-6** —los cinco del mensaje y
los seis de mutación/tokens prohibidos—: ya estaban vivos antes de la reparación, así que
el único rojo era el defecto. Tras `npm install --package-lock-only`: **13/13 verde**.

### CA-2 — la reparación del lock es de dos líneas exactas

Producida por `npm install --package-lock-only` (exit **0**, *«up to date, audited 391
packages»*), **no** por una edición a mano. `git diff 3b6fc8b...HEAD -- package-lock.json`,
entero:

```
diff --git a/package-lock.json b/package-lock.json
index b857c72..65fa729 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,12 +1,12 @@
 {
   "name": "stockeiro",
-  "version": "0.3.2",
+  "version": "0.3.4",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "stockeiro",
-      "version": "0.3.2",
+      "version": "0.3.4",
       "dependencies": {
         "@neondatabase/serverless": "^0.10.4",
         "bcryptjs": "^2.4.3",
```

`git diff --numstat` sobre ese fichero: **`2  2  package-lock.json`**. Ni un `integrity`,
ni un `resolved`, ni una entrada de dependencia, ni `lockfileVersion`. Es exactamente el
diff que el arquitecto midió al escribir la spec.

Y `package.json` **no se toca**: `git diff --numstat 3b6fc8b...HEAD -- package.json`
devuelve **vacío**. Sigue en `0.3.4`.

### CA-3 — `npm ci --dry-run`, antes y después

Idéntico en las dos, hasta el recuento:

```
ANTES (con la deriva 0.3.4 / 0.3.2 puesta)
$ npm ci --dry-run
…
added 156 packages in 884ms
87 packages are looking for funding
EXIT=0

DESPUES (con los tres campos en 0.3.4)
$ npm ci --dry-run
…
added 156 packages in 884ms
87 packages are looking for funding
EXIT=0
```

**156 paquetes las dos veces, exit 0 las dos veces.** Confirma lo que la spec afirmaba:
`npm ci` valida el árbol de dependencias, no el `version` de la raíz. Sincronizar el campo
no cambia nada de lo que se instala.

### CA-11 — sobre `tests/`, solo el fichero nuevo y adiciones

```
$ git diff --name-only 3b6fc8b...HEAD -- tests/
tests/version-bump-gate.test.ts
tests/version-en-los-dos-ficheros.test.ts

$ git diff --numstat 3b6fc8b...HEAD -- tests/version-bump-gate.test.ts
173     0       tests/version-bump-gate.test.ts
```

**`173  0`: ciento setenta y tres líneas añadidas y CERO borradas.** Es la forma más corta
de demostrar «solo adiciones»: no hay ninguna línea de los bloques *SPEC-038 CA-12* y
*CA-13* (el step de CI, `npm run version:check`, el job `Checks`, `fetch-depth: 0`), ni de
los cinco motivos de `evaluar`, ni del contrato de códigos de salida de SPEC-049, que haya
podido cambiar: **no se ha borrado ni una**. Lo añadido es un único `describe` al final
—*«SPEC-053 CA-8, CA-9 y CA-10»*— más la línea `import { readdirSync } from 'node:fs';`
que necesita para localizar los ADR por su id (los nombres de fichero llevan el título,
así que hardcodearlos sería frágil justo el día que `F-SPEC-053-2` obligue a renombrar
ADR-033).

### CA-12 — el conjunto cerrado de ficheros de la rama

```
$ git diff --name-only 3b6fc8b...HEAD
docs/adr/ADR-033-el-package-lock-json-lleva-la-version-de-producto-el-bump-commitea-los-dos-ficheros-y-una-propiedad-lo-vigila-enmienda-pto-8-de-adr-024.md
docs/epicas/EPIC-INFRA/SPEC-053-la-version-vive-en-los-dos-ficheros-el-lock-deja-de-derivar-y-una-guardia-lo-mantiene.ledger.md
docs/epicas/EPIC-INFRA/SPEC-053-la-version-vive-en-los-dos-ficheros-el-lock-deja-de-derivar-y-una-guardia-lo-mantiene.md
package-lock.json
scripts/check-version-bump.mjs
tests/version-bump-gate.test.ts
tests/version-en-los-dos-ficheros.test.ts
```

Siete ficheros, todos en la lista de CA-12. **Ninguno bajo `src/`**, ninguna migración, ni
`.github/workflows/ci.yml`, ni `.sdd.json`, ni `package.json`. `docs/tablero.md` está en la
lista permitida pero **no se ha tocado**: lo regenera el documentalista con `/sdd-tablero`,
y editarlo a mano está prohibido (`CLAUDE.md`).

**Fuera de esta lista y fuera de esta rama**: `docs/epicas/EPIC-FIX/SPEC-052-*` aparece
como *untracked* en este worktree. Es de **SPEC-052**, que va por otra rama en paralelo.
**No se ha añadido a ningún commit** — se ha dejado exactamente como estaba.

### CA-7 — las meta-guardias de SPEC-048, con el fichero nuevo dentro

```
$ npx vitest run tests/revision-movil-en-tests.test.ts tests/guardias-no-caducan.test.ts \
                 tests/guardias-ancladas.test.ts tests/reglas-ingenieria-ri03.test.ts
 Test Files  4 passed (4)
```

Verde. La guardia nueva no aparece porque **no invoca git**: no hay revisión, móvil ni
fija, que analizar en ella. Es la opción 1 de RI-03 —reexpresar el criterio como propiedad
del árbol— y por eso no necesita ventana anclada, ni centinela de ventana, ni salto
declarado por disponibilidad.

### `npm run version:check`

```
$ npm run version:check
[check-version-bump] Base: origin/main.
[check-version-bump] El diff no toca codigo de aplicacion: no hay nada que subir.
EXIT=0
```

Lo esperado por la spec (nota 7 del gate). Ejecutado **con todo commiteado**: el gate juzga
commits, y sobre árbol sucio se abstiene con 2 (SPEC-049). Los únicos pendientes del árbol
son los dos `.md` de SPEC-052, que no son código de aplicación.

### El texto nuevo, tal y como se lee (CA-8 y CA-9)

`node scripts/check-version-bump.mjs --help`, párrafo nuevo (exit **0**):

```
Ese comando edita DOS ficheros —package.json y package-lock.json, y en el lock
los DOS campos `version`: el de la raiz y el de packages[""]— y los dos entran
en el MISMO COMMIT (ADR-033, que enmienda el pto. 8 de ADR-024). Tu spec los
lista los dos en su conjunto cerrado de ficheros. Para reparar el lock SIN subir
el numero: npm install --package-lock-only. No lo edites a mano. Lo vigila
tests/version-en-los-dos-ficheros.test.ts, no este gate.
```

Y el veredicto `sin-subir` —el único de los tres que se lee **en caliente**— renderizado
desde la función pura `evaluar`, sin invocar git:

```
Subelo y vuelve a intentarlo:
  npm version patch --no-git-tag-version   # corregiste un defecto
  npm version minor --no-git-tag-version   # entregaste una spec

Ese comando edita DOS ficheros —package.json y package-lock.json— y los dos
entran en el MISMO COMMIT (ADR-033, que enmienda el pto. 8 de ADR-024). No
reviertas el lock: tu spec lista los dos ficheros en su conjunto cerrado, y si
solo commiteas package.json la suite se pone roja
(tests/version-en-los-dos-ficheros.test.ts).

No crea etiquetas de git a proposito (ADR-024 pto. 8): la identidad del
despliegue sigue siendo el commit.
```

### Calidad

```
$ npm run typecheck   -> 0
$ npm run lint        -> 0   (eslint . --max-warnings=0)
$ npx vitest run      -> ver F-SPEC-053-4
```

La suite completa queda con **un único rojo**, y no es de esta implementación:
`tests/primera-pantalla-fuente.test.ts` (SPEC-050 CA-20). Ver §Salvedades.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

_Pendiente: la spec está en `en-revision`._

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-053/. Informe HTML opcional: _qa/SPEC-053/informe.html -->

**No aplica.** Esta spec no toca `src/` ni cambia un solo píxel de la interfaz. Su
evidencia es la salida de comandos, que va en §Evidencia de los criterios de gate y en la
matriz. Un `_qa/SPEC-053/` con capturas sería teatro.

## Salvedades / follow-ups

- **`F-SPEC-053-1` (aceptado, escrito antes de empezar)** — **la caché del navegador de
  Playwright se invalida en cada subida de versión.** La clave es
  `playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}`
  (`.github/workflows/ci.yml:169`) y su comentario dice que sale del lock *«porque es lo que
  fija la version de @playwright/test»*. Al sincronizar el lock en cada bump, la clave
  cambia aunque `@playwright/test` no se haya movido: **~130 MB de chromium descargados en
  cada PR que suba el número**, ~1 min (step `Install Playwright browser`,
  `timeout-minutes: 5`; `npx playwright install chromium` corre igual, así que el coste es
  la descarga, no un fallo). No se arregla aquí a propósito: tocar esa clave es tocar un
  step de CI que `tests/spec-031-frontera.test.ts` congela, y sería poner en juego un
  criterio de gate para arreglar otro —el error que `F-SPEC-050-4` describe—. *Destino*:
  **EPIC-INFRA**. *Disparador*: que el minuto moleste, o que el job de e2e se acerque a su
  `timeout-minutes: 25`. Es el mismo residual que **ADR-033** registra como `F-ADR-033-1`.

- **`F-SPEC-053-2` (para el gate, mecánico)** — **posible colisión del id `ADR-033`.** Los
  ids de spec vienen fijados desde fuera (053) porque hay otro arquitecto trabajando
  **SPEC-052** en paralelo; el del ADR lo asignó `scaffold.mjs`. **Comprobado al escribir
  esto**: en este worktree SPEC-052 ya ha depositado su spec y su ledger
  (`docs/epicas/EPIC-FIX/SPEC-052-…`) y **no ha creado ningún ADR** —`git status` sobre
  `docs/adr/` solo lista `ADR-033`, el mío—. Riesgo bajo, pero SPEC-052 aún puede estar
  escribiendo: **volver a mirar antes de mergear**. Si colisiona, el arreglo es un
  renombrado.

- **`F-SPEC-053-3` (cerrado por esta spec, se registra para trazabilidad)** —
  **`F-SPEC-050-4`** (ledger de SPEC-050) es el finding que origina esta spec. Se cierra
  con CA-1 (la deriva) y CA-8/CA-9 (el bucle de aprendizaje que lo produjo). Al cerrar
  SPEC-053, anotarlo allí.

- **`F-SPEC-053-4` (ABIERTO — PARADA, decisión del gate humano)** — **una guardia ajena se
  pone roja por la mera existencia de `ADR-033`, y el implementador no puede tocarla.**

  `tests/primera-pantalla-fuente.test.ts:311-317` (**SPEC-050 CA-20**) dice:

  ```ts
  it('`docs/adr/` no gana ningún fichero por esta spec: no hay decisión que registrar', () => {
    const adrs = readdirSync('docs/adr').filter((f) => f.endsWith('.md'));
    const citantes = adrs.filter((f) => fuente(`docs/adr/${f}`).includes('SPEC-050'));
    expect(citantes, 'esta spec no toma ninguna decisión que constriña trabajo futuro …').toEqual([]);
  });
  ```

  Salida sobre esta rama:

  ```
  FAIL tests/primera-pantalla-fuente.test.ts > SPEC-050 CA-20: esto es presentación pura
       > `docs/adr/` no gana ningún fichero por esta spec: no hay decisión que registrar
  - Array []
  + Array [
  +   "ADR-033-el-package-lock-json-lleva-la-version-de-producto-…-enmienda-pto-8-de-adr-024.md",
  + ]
  ```

  **Por qué se dispara**: `ADR-033` contiene la cadena `SPEC-050` porque **cita el finding
  que lo origina** (*«La levanta `F-SPEC-050-4` (ledger de SPEC-050)»*). El filtro es
  `includes('SPEC-050')` sobre el texto entero, así que no distingue *«un ADR que registra
  una decisión DE SPEC-050»* —lo que la guardia quería negar— de *«un ADR posterior que
  MENCIONA a SPEC-050»*, que es lo que hay aquí.

  **Es una caducidad del molde que `FOUNDATION.md` describe**: la guardia congela un estado
  del árbol del día de la entrega —*«hoy ningún fichero de `docs/adr/` contiene la cadena
  SPEC-050»*— en vez de una propiedad. Deja de ser cierto **al mergear cualquier ADR futuro
  que cite esa spec**, no cuando algo se rompe. Sobre `3b6fc8b` estaba verde; se puso roja
  con el commit del arquitecto (`e24c578`), no con ninguno de los míos.

  **Por qué NO la toco, y son cuatro motivos independientes**:
  1. **CA-11 y CA-12** cierran el conjunto de ficheros de esta rama; `tests/primera-pantalla-fuente.test.ts`
     no está en ninguno de los dos. Tocarlo sería RED por mi propia spec.
  2. **`FOUNDATION.md` / ADR-031 pto. 5**: *«quien lo toca no es quien se beneficia»*. Soy
     exactamente quien se beneficia de que se ponga verde.
  3. La otra salida aparente —quitar la mención a `SPEC-050` de `ADR-033`— es **editar un
     ADR aprobado e inmutable**. Prohibido, y además borraría la trazabilidad al finding que
     origina la decisión.
  4. La spec lo dice literal: *«Si algo de ahí tiene que cambiar, para y escálalo al gate
     humano»*.

  **Las tres salidas, para que el gate elija** (ninguna es mía):
  - **(a) Re-encuadrar** la guardia ajena, que es lo que `FOUNDATION.md` llama la salida
    buena cuando la propiedad sigue viva y solo estaba mal expresada. Por ejemplo: mirar la
    línea *«Specs relacionadas»* del ADR y exigir que ninguna declare a SPEC-050 como spec
    **que lo origina**, en vez de buscar la cadena en el texto entero. La propiedad que
    SPEC-050 quería fijar —*«esta spec no registró ninguna decisión»*— sobrevive.
  - **(b) Borrar** el caso, si se juzga que lo que vigilaba era del momento de la entrega de
    SPEC-050 y ya no puede volver a ser cierto.
  - **(c) Que lo arregle una spec propia** (EPIC-FIX o EPIC-INFRA) escrita por el
    arquitecto, con su motivo en el ledger de SPEC-050 y en el suyo.

  En **(a)** y **(b)**, `FOUNDATION.md` exige además que **quede escrito en el ledger qué
  vigilaba antes y qué vigila ahora**.

  **Efecto práctico**: hasta que se resuelva, `npx vitest run` sale con **1 rojo** y la CI
  de esta rama estará roja en el step `Unit tests`. Todo lo de SPEC-053 está verde.

- **`F-SPEC-053-5` (menor, resuelto en el sitio; se anota porque el verificador lo verá)** —
  **`tests/tarjeta-guardias-ampliadas.test.ts` (SPEC-051 CA-17.1) también se puso roja, y
  esta sí era mía.** Esa guardia afirma que la lista de ficheros de `tests/` que contienen
  la cadena `SPEC-051` es exactamente la cerrada de su entrega, para que un tercer fichero
  ajeno re-encuadrado sea RED. Mis dos ficheros la nombraban **en prosa**, contando que las
  dos últimas subidas revirtieron el lock. **El arreglo se ha hecho en mi lado, no en el
  suyo**: se ha reescrito mi propia prosa para no citar la spec por id (*«las dos últimas
  subidas de versión»*, con `F-SPEC-050-4` como referencia, que es el finding realmente
  relevante). La guardia ajena **no se ha tocado ni una línea** y vuelve a estar en verde
  con su fuerza intacta. Se anota para que quede claro que fue una mención incidental
  eliminada, no un aflojamiento.

## Cómo retomar (handoff)

**Estado (2026-08-24)**: **implementación terminada**. Los doce CA están cubiertos —ocho con
test permanente, cuatro con evidencia de gate arriba—. La spec está en `en-revision`.
**Falta el verificador**, y hay **una parada abierta**: `F-SPEC-053-4`.

**Los tres commits de la rama, en orden**:

| Commit | Qué trae |
|---|---|
| `e24c578` | la spec, el ledger y ADR-033 (del arquitecto, aprobado por el humano) |
| `c4d774b` | **CA-1, CA-4, CA-5, CA-6** — la guardia nueva (escrita primero, roja por el defecto vivo) y la sincronización del lock a `0.3.4` |
| `d0c3a88` | **CA-8, CA-9, CA-10** — el texto del gate: cabecera, `--help` y `sin-subir` |

**Dónde está cada cosa**:

- `tests/version-en-los-dos-ficheros.test.ts` — **nuevo**, 13 casos. La propiedad de CA-1 y
  las pruebas de no-vacuidad de CA-5 y CA-6. No importa nada más que `node:fs`,
  `node:path` y `node:url`, y él mismo lo comprueba.
- `tests/version-bump-gate.test.ts` — **solo adiciones** (`173 0`): un `describe` al final,
  *«SPEC-053 CA-8, CA-9 y CA-10»*, más su `import { readdirSync }`.
- `scripts/check-version-bump.mjs` — **solo texto**. Ni una línea de lógica: `evaluar`,
  `evaluarConPendientes`, `rutasDeAplicacion`, `tocanCodigoDeAplicacion` y el contrato de
  códigos de salida están byte a byte como estaban.
- `package-lock.json` — dos líneas, producidas por npm.

**Decisiones que tomé y que el verificador puede querer discutir**:

1. **Dónde vive CA-10.** La spec dice *«no queda en el repositorio ninguna afirmación de que
   `npm version` toque un solo fichero»*, y a la vez dice que la frase de **ADR-024 pto. 8
   no se edita**. Las dos cosas juntas solo son ciertas si el sujeto del barrido son los
   **scripts** (que es lo que la propia CA-10 nombra: *«dado el texto del script»*) y la
   frase del ADR queda cubierta por la **enmienda**. Así está implementado: el barrido
   recorre `scripts/*.mjs` y exige cero; el **centinela** comprueba que el detector *sí* se
   dispara sobre `ADR-024`. Ese centinela hace dos trabajos a la vez: prueba que el detector
   no es vacuo, y **se pondría rojo si alguien «arreglara» ADR-024 borrando la frase**, que
   es lo que la inmutabilidad prohíbe.
2. **Qué es «la meta-guardia de SPEC-048»** (CA-7). La spec nombra
   `tests/guardias-no-caducan.test.ts`, pero la que *recorre `tests/` buscando revisiones
   móviles* —la descripción que la spec usa, y la que RI-03 cita— es
   `tests/revision-movil-en-tests.test.ts` (SPEC-048 CA-10). Se han corrido **las dos**, más
   `guardias-ancladas.test.ts` y `reglas-ingenieria-ri03.test.ts`: **4 ficheros, verde**.
3. **El aviso del lock no se repite en los cinco motivos de `evaluar`.** Va en `sin-subir`,
   que es el que se lee con la PR en rojo. `sin-codigo` y `subida` no hablan del lock: quien
   los lee no está subiendo nada, y un aviso en los cinco mensajes es ruido. Hay un caso que
   lo fija (*«CA-9 — y los otros motivos no se contaminan»*).
4. **`docs/tablero.md` no se ha regenerado.** Está permitido por CA-12 pero editarlo a mano
   está prohibido y regenerarlo es del documentalista.

**Lo verificado al escribir la spec, que la implementación confirmó punto por punto**:

| Afirmación | Cómo se comprobó | Resultado |
|---|---|---|
| La deriva existe en `3b6fc8b` | `git show origin/main:package.json` / `:package-lock.json` | `0.3.4` vs `0.3.2` (dos campos: líneas 3 y 9) |
| `npm version` toca los dos ficheros | copia de `3b6fc8b` en un directorio aparte + `diff` | **exactamente 2 líneas** (3 y 9), sin re-resolver dependencias |
| La reparación sin bump también | `npm install --package-lock-only` con `package.json` en `0.3.4` | **el mismo diff de 2 líneas** |
| Nadie lee el `version` del lock en CI | `grep package-lock .github/workflows/*.yml` | solo `hashFiles(…)` como clave de caché (`ci.yml:169`) |
| El gate compara `package.json`, no el lock | lectura de `scripts/check-version-bump.mjs` | `versionEn(ref)` → `git show <ref>:package.json` |
| Cuándo empezó la deriva | `git log -L 3,3:package-lock.json` | última sincronía en `3f62762` (0.3.2); `0.3.3` y `0.3.4` no la tocaron |
| No hay un tercer sitio con la versión | `grep '"version"'` en `*.json` + `grep '0\.3\.[0-9]'` en `src/ tests/ scripts/ .github/ vercel.json` | solo `package.json` y el lock; los `"version": "7"` de `drizzle/meta/` son el formato de snapshot; cero literales |

**El orden importaba, y se respetó**: la guardia de CA-4 se escribió **antes** de tocar
`package-lock.json`, se dejó que se pusiera roja por el defecto vivo de `3b6fc8b`, y ese
rojo está pegado entero arriba. Solo después se ejecutó `npm install --package-lock-only`.

**Siguiente paso**: **verificador**, con `F-SPEC-053-4` sobre la mesa. La rama **no** tiene
PR abierta y **no** se ha mergeado nada. Si el gate decide (a) o (b) para la guardia ajena,
eso es trabajo de otra mano —no del implementador de esta spec— y probablemente de otra
rama; hasta entonces la CI de ésta seguirá roja en `Unit tests` por ese único caso.

**Y antes de mergear, mirar otra vez `F-SPEC-053-2`**: SPEC-052 sigue en vuelo por otra
rama. Comprobado hoy en este worktree: sus dos `.md` están ahí como *untracked* y
`docs/adr/` sigue sin ningún ADR suyo, así que `ADR-033` no colisiona **todavía**.
