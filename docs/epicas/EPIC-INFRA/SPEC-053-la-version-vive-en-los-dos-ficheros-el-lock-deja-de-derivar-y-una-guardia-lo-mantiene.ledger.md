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
- **Hubo una parada para el gate humano**: `F-SPEC-053-4`. Una guardia **ajena** —
  `tests/primera-pantalla-fuente.test.ts`, SPEC-050 CA-20— se pone **roja** por la mera
  existencia de `ADR-033`. El implementador **no la tocó**: no es suya, y quien la toca no
  puede ser quien se beneficia (`FOUNDATION.md`, ADR-031 pto. 5). **Escaló, que es lo que
  había que hacer.**
- **RESUELTA el 2026-08-24.** El humano (Alberto Fojo) autorizó el arreglo y pidió que lo
  redactara el **arquitecto**. Salida elegida: **(b) retirar el caso**, no re-encuadrarlo —el
  re-encuadre esbozado seguiría en rojo, porque la línea `Specs relacionadas` de ADR-033
  también contiene `SPEC-050`—. Gobernado por **CA-13** y **CA-14** de la spec, con el
  argumento entero en §*La guardia ajena que se rompió*.
- **APLICADA el 2026-08-24.** El caso está retirado y su porqué escrito en el hueco que
  dejó. `tests/primera-pantalla-fuente.test.ts` pasa de **21 casos (20 verdes + 1 rojo)** a
  **20, los 20 verdes**; la suite entera, de **1687 (1 rojo)** a **1686, todos verdes** —la
  diferencia es **exactamente un caso** en los dos recuentos—. `lint` **0**, `typecheck`
  **0**. Los catorce CA están cubiertos.
- **Queda un residual menor y ABIERTO a propósito**: `F-SPEC-053-7`. El índice de la
  cabecera de ese fichero sigue anunciando el caso retirado (*«ni un ADR nuevo»*, líneas 25 y
  234). Son dos líneas de comentario, pero CA-13 dice **tres veces** que ninguna otra línea
  del fichero se toca, y decidir que esas dos no cuentan lo haría **quien se beneficia**. Se
  pregunta en vez de interpretar.

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

> **Añadido el 2026-08-24 (CA-13 y CA-14).** **CA-13 es PROPIEDAD**, no gate: sus cuatro
> condiciones son ciertas sobre `tests/primera-pantalla-fuente.test.ts` **tal y como queda en
> el árbol** —qué casos tiene, qué comentario lleva, que no hay `.skip` ni exclusión por
> nombre—, no sobre el diff. **CA-14 es mixto**: el «cero rojos» es propiedad; los dos
> recuentos antes/después son evidencia de gate y van abajo.

| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 — los tres campos de versión coinciden | `package-lock.json:3` y `:9` — `0.3.2` → **`0.3.4`**, producido por `npm install --package-lock-only` (no a mano). `package.json` **sin tocar**, en `0.3.4` | `tests/version-en-los-dos-ficheros.test.ts` — *«los tres campos de version declaran exactamente lo mismo»* y *«y los tres son un semver de producto, no una cadena cualquiera»* | **Verificado por mí, 2026-08-24.** `package.json:3` = `0.3.4`; `package-lock.json:3` y `:9` = `0.3.4`, leídos del árbol. `npx vitest run tests/version-en-los-dos-ficheros.test.ts` → **13 passed (13)**. `git diff --numstat 3b6fc8b...HEAD -- package.json` → **vacío**: el número no se ha movido, la reparación es del lock | ✅ |
| CA-2 — la reparación del lock es de dos líneas exactas | `package-lock.json` (2 ins / 2 del, y nada más) | **n-a (gate)** — criterio sobre el delta; evidencia abajo | **Verificado por mí.** `git diff --numstat 3b6fc8b...HEAD -- package-lock.json` → **`2  2  package-lock.json`**. Leído el diff entero: solo las líneas 3 y 9. Ni un `integrity`, ni un `resolved`, ni una entrada de dependencia, ni `lockfileVersion` | ✅ |
| CA-3 — `npm ci --dry-run` sigue en 0 tras sincronizar | — (no hay nada que implementar: es una comprobación sobre el árbol reparado) | **n-a (gate)** — criterio sobre el delta; evidencia abajo | **Verificado por mí.** `npm ci --dry-run` sobre el árbol sincronizado → *«added 156 packages in 938ms»*, **EXIT=0**. El «antes» no hace falta re-ejecutarlo para saberlo: el diff del lock son **solo** las dos líneas de `version` (CA-2), así que el árbol de dependencias que `npm ci` resuelve es byte a byte el mismo, y el recuento no puede haber cambiado | ✅ |
| CA-4 — guardia permanente, sin git y sin salto declarado | `tests/version-en-los-dos-ficheros.test.ts` — `camposDeVersion` / `divergencias`, leídas del disco con `node:fs`; **cero git** | mismo fichero — *«CA-4 — y no invoca git en absoluto: es una propiedad del arbol, no un diff»* (tokens partidos para no autodetectarse; además comprueba que los únicos `node:*` importados son `fs`, `path` y `url`) | **Verificado por mí leyendo el fichero.** `rootDir` sale de `import.meta.url`, no de git. Los únicos imports son `node:fs`, `node:path`, `node:url` y `vitest`. **Cero** `child_process`, `execFileSync`, `origin/main`, `skipIf`. Es una propiedad del árbol, no un diff | ✅ |
| CA-5 — el rojo enseña la salida (ficheros, campos, comando, «los dos al mismo commit») | `tests/version-en-los-dos-ficheros.test.ts` — `mensajeDeDeriva()`, pasado como mensaje de la aserción | mismo fichero, bloque *«SPEC-053 CA-5: el rojo ensena la salida, no obliga a deducirla»* — 5 casos: los dos ficheros, los tres campos con su valor, los dos comandos, «LOS DOS EN EL MISMO COMMIT» + ADR-033, y que no se queda en un `expected X to be Y` | **Verificado por mí sobre el rojo real**, no sobre el texto: reproducido en un árbol aparte (ver CA-6), el mensaje sale con los dos ficheros, los tres campos con su valor (`0.3.4` / `0.3.2` / `0.3.2`), los dos comandos de sincronización y «LOS DOS EN EL MISMO COMMIT (ADR-033 pto. 4)». 17 líneas, no un `expected X to be Y` | ✅ |
| CA-6 — no vacuidad: mutación roja / coincidencia verde, y sin salto/`only`/pendiente | `tests/version-en-los-dos-ficheros.test.ts` — `conLockMutado()` ejercita el camino entero (parsear → comparar) sin escribir en disco | mismo fichero, bloque *«SPEC-053 CA-6: la guardia no puede ser un verde vacio»* — 6 casos: (a) los tres tokens prohibidos; (b) mutación del `version` de la raíz → roja, de `packages[""]` → roja, de `package.json` → los DOS señalados, y los tres iguales → verde. **Y la no-vacuidad fuerte: la guardia nació ROJA sobre `3b6fc8b`, salida pegada abajo** | **Reproducido por mí, no creído.** Copié `tests/version-en-los-dos-ficheros.test.ts` a un directorio fuera del repositorio junto con `package.json`@`3b6fc8b` (`0.3.4`) y `package-lock.json`@`3b6fc8b` (`0.3.2`) y lo ejecuté: **`1 failed | 12 passed (13)`**, con el mensaje **idéntico** al pegado abajo. Sincronizados los tres campos en ese mismo directorio: **`13 passed (13)`**. Rojo y verde, los dos en disco. Y sin `skip` / `.only` / `todo(` en el fichero | ✅ |
| CA-7 — las meta-guardias de SPEC-048 siguen verdes con el fichero nuevo dentro | — (propiedad de lo entregado: la guardia nueva no invoca git) | `tests/revision-movil-en-tests.test.ts` **8/8** y `tests/guardias-no-caducan.test.ts` **7/7**, con el fichero nuevo dentro de `tests/`. Salida abajo. **Nota**: la spec nombra `guardias-no-caducan.test.ts` como *«la meta-guardia que recorre `tests/`»*; la que recorre `tests/` buscando revisiones móviles es `revision-movil-en-tests.test.ts` (SPEC-048 CA-10) — se han corrido **las dos** | **Verificado por mí.** `npx vitest run` de las cuatro → **`4 passed (4)` / `48 passed (48)`**. Comprobado además que no es vacuo: `revision-movil-en-tests.test.ts` recorre `tests/` con un `readdirSync` recursivo (`:26-27`), así que el fichero nuevo entra de verdad en su barrido. **Corrección a la columna *Test*, que no es mía y no toco**: los recuentos por fichero son **8** (`revision-movil-en-tests`) y **7** (`guardias-no-caducan`), no 12 y 6. Verde igual; el dato estaba mal transcrito | ✅ |
| CA-8 — `--help` y cabecera de `check-version-bump.mjs` dicen «los dos ficheros» | `scripts/check-version-bump.mjs` — bloque nuevo de cabecera *«QUÉ FICHEROS TOCA EL COMANDO QUE ESTE GATE RECOMIENDA (ADR-033…)»* y párrafo nuevo en `USO` | `tests/version-bump-gate.test.ts`, bloque *«SPEC-053 CA-8, CA-9 y CA-10»* — 4 casos: cabecera con los dos ficheros + ADR-033, cabecera con «mismo commit», `--help` con los dos + «MISMO COMMIT» y **saliendo con 0**, y `--help` con `npm install --package-lock-only` | **Verificado por mí.** `node scripts/check-version-bump.mjs --help` → **exit 0** con el párrafo nuevo entero. La cabecera del script trae el bloque *«QUÉ FICHEROS TOCA EL COMANDO…»* citando **ADR-033** y diciendo «mismo commit». Los 4 casos, verdes | ✅ |
| CA-9 — el mensaje de `sin-subir` lo dice también (sobre `evaluar`, puro) | `scripts/check-version-bump.mjs` — mensaje del veredicto `sin-subir` | `tests/version-bump-gate.test.ts` — *«CA-9 — el veredicto `sin-subir` lo dice, sobre la función pura y sin invocar git»* (comprueba además que lo de antes sigue: los dos `npm version …`) y *«CA-9 — y los otros motivos no se contaminan»* (`sin-codigo` y `subida` no hablan del lock) | **Verificado por mí.** Los 2 casos verdes en `tests/version-bump-gate.test.ts`, sobre `evaluar` **puro** (sin git). Leído el diff del script: el aviso está en el veredicto `sin-subir` y **no** contamina `sin-codigo` ni `subida`, que es lo correcto | ✅ |
| CA-10 — no queda en el repositorio ninguna afirmación de «un solo fichero» | `scripts/check-version-bump.mjs` (el texto nuevo no reintroduce la frase); **ADR-024 NO se edita** | `tests/version-bump-gate.test.ts` — 3 casos con **centinela**: el detector *sí* se dispara sobre `docs/adr/ADR-024-*.md` (prueba a la vez que el detector funciona **y** que el ADR sigue intacto: si alguien «arreglara» la frase borrándola, este caso se pondría rojo), **no** se dispara sobre ningún `.mjs` de `scripts/`, y ADR-033 está `aprobada`, dice «enmienda», cita `ADR-024` y `pto. 8` y dice «no lo supersede» | **Verificado por mí con barrido propio.** `grep` multilínea de `edita\s+`?package.json`?\s+y\s+nada\s+m[aá]s` sobre el repositorio entero → **3 ficheros**: `ADR-024` (el original), `ADR-033` y la spec, los dos últimos **citándola para enmendarla**. Ningún script, ningún test, ningún workflow la afirma. **ADR-024 sigue intacto**: `git diff --numstat 3b6fc8b...HEAD -- docs/adr/ADR-024*.md` → **vacío**, y su último commit es `4b187b0`, muy anterior a esta rama. El centinela verde | ✅ |
| CA-11 — sobre `tests/` solo el fichero nuevo, adiciones a `version-bump-gate.test.ts` y lo que CA-13 autoriza | `version-bump-gate.test.ts`: **`173 0`** contra `3b6fc8b` —cero borradas—; `primera-pantalla-fuente.test.ts`: **`50 10`**, solo CA-13 | **n-a (gate)** — criterio sobre el delta; evidencia abajo | **Verificado por mí sobre el diff.** `git diff --numstat 3b6fc8b...HEAD -- tests/` → **tres** ficheros y solo tres. `173  0` en `version-bump-gate.test.ts`: **cero borradas**, luego los bloques *SPEC-038 CA-12* y *CA-13*, los cinco motivos de `evaluar` y el contrato de salidas de SPEC-049 no han podido cambiar. `50  10` en `primera-pantalla-fuente.test.ts`, leídas una a una (ver CA-13). **Y lo que la spec manda mirar**: ninguno de los cuatro CA de gate se ha convertido en test que mire `git diff origin/main` — siguen `n-a`, como debe ser | ✅ |
| CA-12 — conjunto cerrado de ficheros de la rama | **8** ficheros tras la enmienda del 2026-08-24, ninguno bajo `src/` | **n-a (gate)** — criterio sobre el delta; evidencia abajo | **Verificado por mí.** `git diff --name-only 3b6fc8b...HEAD` → los **8** ficheros de la lista y ninguno más. Nada bajo `src/`, ninguna migración, ni `.github/workflows/ci.yml`, ni `.sdd.json`, ni `package.json`. Los dos `.md` de SPEC-052 siguen *untracked* y fuera de todo commit de esta rama | ✅ |
| CA-13 — la guardia ajena que se retira: nombrada, con el porqué en el sitio, sin aflojar y sin exclusión por nombre | `tests/primera-pantalla-fuente.test.ts` — el caso de `:310-318` **retirado entero** y sustituido por **prosa en su sitio** (43 líneas de comentario donde estaba), más la línea 1, que pierde `readdirSync` por quedar sin uso. Diff **`50 10`**: las 10 borradas son las 9 del caso + el import. Ningún `.skip`, ninguna exclusión por nombre de `ADR-033`, ninguna otra línea | **por diseño, no lleva test** — CA-13 es una propiedad del **texto del fichero** y se verifica leyéndolo; escribir un test que afirme *«este comentario está aquí»* sería el verde vacío que ADR-031 prohíbe, y es explícitamente lo que la spec descarta al decir que aquí **no hay «inverso» que poner**. Evidencia (diff completo) abajo | **Las cuatro condiciones, verificadas una a una.** (1) **Un solo caso, y es el nombrado**: recuento estático de `it(`/`test(` → `3b6fc8b` **21**, `1fa3df9^` **21**, árbol **20**. Un único commit toca el fichero (`1fa3df9`). (2) El porqué está **en el hueco**, con las cinco cosas que la condición exige. (3) **Ni un `.skip`, ni un `.only`, ni un `todo(`** en las líneas añadidas de **toda** la rama (`git diff … -- tests/ | grep "^+.*\.skip\|\.only\|todo("` → vacío), y **cero exclusión de `ADR-033` por nombre**: la cadena solo aparece dentro de la prosa que explica por qué está prohibida. (4) La otra mitad de CA-20 —`dependencias`, `devDependencias`, `scripts`, semver— **sin una línea tocada** y entre los 20 verdes. **Ninguna otra guardia ajena tocada en la rama**. *Dictamen sobre `F-SPEC-053-7`: ver §Veredicto* | ✅ |
| CA-14 — la suite vuelve a verde entera; 21 → 20 casos en ese fichero y ningún otro cambia de recuento | — (consecuencia de CA-13; no hay nada que implementar aparte) | **parte gate** — `tests/primera-pantalla-fuente.test.ts` **21 → 20**, los 20 verdes; suite entera **1687 → 1686**, `110 passed (110)`, **cero rojos**. La diferencia global es **exactamente un caso**. Los cuatro recuentos, abajo | **Ejecutado por mí.** `npx vitest run` → **`110 passed (110)` / `1686 passed (1686)`, cero rojos**. `npx vitest run tests/primera-pantalla-fuente.test.ts` → **`20 passed (20)`**. Y el «ningún otro fichero cambia de recuento» comprobado por su causa, no por su síntoma: `git diff --name-only 1fa3df9^..HEAD -- tests/` devuelve **ese fichero y ninguno más**. El verde **no** se obtuvo retirando dos casos: se retiró exactamente uno | ✅ |

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
$ git diff --numstat 3b6fc8b...HEAD -- tests/
50      10      tests/primera-pantalla-fuente.test.ts
173     0       tests/version-bump-gate.test.ts
230     0       tests/version-en-los-dos-ficheros.test.ts
```

Tres ficheros, que son exactamente los tres que CA-11 admite tras su enmienda del
2026-08-24: el **nuevo** de CA-4, `version-bump-gate.test.ts` **solo con adiciones**, y
`primera-pantalla-fuente.test.ts` **solo con lo que CA-13 autoriza** (desglose de sus
`50 10` en §*CA-13 y CA-14*).

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
tests/primera-pantalla-fuente.test.ts
tests/version-bump-gate.test.ts
tests/version-en-los-dos-ficheros.test.ts
```

**Ocho** ficheros, todos en la lista de CA-12 —el octavo,
`tests/primera-pantalla-fuente.test.ts`, entra por la **enmienda del 2026-08-24** y **solo**
con el alcance de CA-13—. **Ninguno bajo `src/`**, ninguna migración, ni
`.github/workflows/ci.yml`, ni `.sdd.json`, ni `package.json`. `docs/tablero.md` está en la
lista permitida pero **no se ha tocado**: lo regenera el documentalista con `/sdd-tablero`,
y editarlo a mano está prohibido (`CLAUDE.md`).

**Fuera de esta lista y fuera de esta rama**: `docs/epicas/EPIC-FIX/SPEC-052-*` aparece
como *untracked* en este worktree. Es de **SPEC-052**, que va por otra rama en paralelo.
**No se ha añadido a ningún commit** — se ha dejado exactamente como estaba.

### CA-13 y CA-14 — la guardia ajena retirada (2026-08-24)

#### CA-14 — los recuentos, antes y después

Los cuatro, ejecutados en este worktree el 2026-08-24:

```
ANTES  (el caso todavía puesto)
$ npx vitest run tests/primera-pantalla-fuente.test.ts
 ❯ tests/primera-pantalla-fuente.test.ts (21 tests | 1 failed) 89ms
   × SPEC-050 CA-20: esto es presentación pura > `docs/adr/` no gana ningún fichero por
     esta spec: no hay decisión que registrar
 Test Files  1 failed (1)
      Tests  1 failed | 20 passed (21)

$ npx vitest run
 Test Files  1 failed | 109 passed (110)
      Tests  1 failed | 1686 passed (1687)


DESPUES (el caso retirado)
$ npx vitest run tests/primera-pantalla-fuente.test.ts
 ✓ tests/primera-pantalla-fuente.test.ts (20 tests) 56ms
 Test Files  1 passed (1)
      Tests  20 passed (20)

$ npx vitest run
 Test Files  110 passed (110)
      Tests  1686 passed (1686)
```

**La cuenta cuadra exactamente**: el fichero pasa de **21 a 20** —diferencia **uno**, y es
el retirado, porque los 20 que quedan son los mismos 20 que ya estaban verdes—; y la suite
entera pasa de **1687 a 1686** —diferencia **uno también**—, con `110 passed (110)` en
ficheros. **Ningún otro fichero de `tests/` cambia su número de casos**: si alguno hubiera
perdido uno, el total global habría bajado en dos y no en uno. Y **cero rojos**: el verde no
se obtiene aflojando nada más, se obtiene retirando exactamente lo autorizado.

#### CA-13 — el diff completo del fichero ajeno

`git diff --numstat -- tests/primera-pantalla-fuente.test.ts` → **`50  10`**.

Las **10 borradas** son, todas y sin ninguna más:

```
-import { readFileSync, readdirSync } from 'node:fs';
-  it('`docs/adr/` no gana ningún fichero por esta spec: no hay decisión que registrar', () => {
-    const adrs = readdirSync('docs/adr').filter((f) => f.endsWith('.md'));
-    const citantes = adrs.filter((f) => fuente(`docs/adr/${f}`).includes('SPEC-050'));
-    expect(
-      citantes,
-      'esta spec no toma ninguna decisión que constriña trabajo futuro (CE-M3): ' +
-        'desacoplar `.brand` de `.app-nav` REDUCE acoplamiento, no abre puerta a nada',
-    ).toEqual([]);
-  });
```

Nueve son **el caso entero** (`:310-318`, el que CA-13 cond. 1 nombra) y la décima es la
**línea 1**: `readdirSync` era usado **solo** por ese caso y `eslint . --max-warnings=0`
rechaza un import sin usar (`@typescript-eslint/no-unused-vars` está en `warn`, y el gate de
lint no admite warnings). **Es consecuencia mecánica de la retirada, no un cambio de
criterio**; queda dicho también dentro del propio comentario, para que quien lea el fichero
no tenga que venir aquí. Verificado: con el import puesto, `npm run lint` sale con **1**.

Las **50 añadidas** son un único bloque de comentario, en el hueco exacto que dejó el caso,
con las cinco cosas que CA-13 cond. 2 exige: **qué vigilaba antes**, **qué vigila ahora**
(nada en la suite; vuelve al gate, donde se consumó con el GREEN 22/22 de SPEC-050 del
2026-08-23), **en virtud de qué CA** (`SPEC-053 CA-13`), la **fecha** y la **autorización
nominal del humano (Alberto Fojo) del 2026-08-24**, y la constancia de que **quien lo
escribió no es quien se beneficia** —lo escaló el implementador como `F-SPEC-053-4` sin tocar
el fichero, y lo redactó el arquitecto—. Añade además por qué (a) no funcionaba, qué se
pierde, qué no se pierde, y que **excluir `ADR-033` por nombre está prohibido**.

Las tres condiciones negativas, comprobadas sobre el diff de arriba:

| Condición | Comprobación | Resultado |
|---|---|---|
| No se marca nada como saltado | `grep -c "\.skip\|\.only\|todo(" ` sobre el diff | **0** |
| No se añade exclusión por nombre de `ADR-033` ni de ningún fichero | `ADR-033` aparece en las líneas **añadidas** solo dentro de la prosa que explica **por qué está prohibido**; **cero** en código | **cumplida** |
| No se toca ninguna otra línea | las 10 borradas son las de arriba y ninguna más; las 50 añadidas son comentario | **cumplida** |

**Y la otra mitad de CA-20 sigue intacta**: las listas exactas de `dependencies`,
`devDependencies` y `scripts`, y el semver de `version`. Sus cuatro casos ni se rozan y están
entre los 20 verdes.

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
$ npx vitest run      -> 0   (110 passed (110) / 1686 passed (1686))
```

**La suite completa está en verde, entera**, tras aplicar CA-13. Antes de aplicarlo quedaba
con un único rojo, que no era de esta implementación —`tests/primera-pantalla-fuente.test.ts`,
SPEC-050 CA-20— y que dio origen a `F-SPEC-053-4`. Los cuatro recuentos, antes y después,
están en §*CA-13 y CA-14*.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## **GREEN** — 2026-08-24, `sdd-verificador`

**Los catorce CA en ✅.** Verificado sobre el árbol de la rama
`ft/SPEC-053-…`, con los dos `.md` de SPEC-052 *untracked* y fuera de todo commit.
Nada de lo que sigue es el relato del implementador: son comandos que he ejecutado yo.

**Los gates, corridos por mí:**

```
$ npm run typecheck   -> 0
$ npm run lint        -> 0   (eslint . --max-warnings=0)
$ npx vitest run      -> 110 passed (110) / 1686 passed (1686), CERO rojos
$ npm run version:check -> 0  «El diff no toca codigo de aplicacion»  (arbol limpio; NO es abstencion)
$ npm ci --dry-run    -> added 156 packages, EXIT=0
$ node ${SDD_ROOT}/core/scripts/valida.mjs -> [valida] OK   (sin BOM: los 8 ficheros de la rama empiezan por su primer byte real)
```

**Lo que más me importaba, y lo reproduje en vez de creerlo.** La guardia de CA-4
**nace roja sobre el defecto vivo**. No me valió el rojo pegado arriba: copié el fichero
de guardia a un directorio **fuera del repositorio** junto con `package.json`@`3b6fc8b`
(`0.3.4`) y `package-lock.json`@`3b6fc8b` (`0.3.2`, en sus dos campos), y lo ejecuté.

```
 × ... > los tres campos de version declaran exactamente lo mismo
   → Las versiones de package.json y package-lock.json no coinciden (SPEC-053 CA-1 / ADR-033).
     · package.json → version   = 0.3.4   <- la fuente de verdad (ADR-024 pto. 3)
     · package-lock.json → version   = 0.3.2
     · package-lock.json → packages[""].version   = 0.3.2
 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
```

Y en ese **mismo** directorio, con los tres campos sincronizados: **`13 passed (13)`**.
Rojo y verde, los dos en disco y los dos por mi mano. Esta guardia **no** es de las de
SPEC-048: mira algo, y lo que mira se puede romper.

**Los otros cuatro sitios donde esto se podía colar, y no se coló:**

1. **ADR-024 está intacto.** `git diff --numstat 3b6fc8b...HEAD -- docs/adr/ADR-024*.md`
   → vacío; su último commit es `4b187b0`. La frase falsa sigue ahí y queda **enmendada**
   por ADR-033 (`aprobada` por el humano el 2026-08-23), no borrada. El centinela de CA-10
   se pondría rojo si alguien la «arreglara», que es el diseño correcto.
2. **Los cuatro CA de gate siguen siendo gate.** CA-2, CA-3, CA-11 y CA-12 están `n-a` en
   la columna *Test* y **no existe ningún test nuevo que mire `git diff origin/main`**. He
   verificado su acotación yo, sobre el diff, que es donde le tocaba.
3. **Se retiró UN caso, no dos.** Recuento estático de `it(`/`test(` en
   `tests/primera-pantalla-fuente.test.ts`: `3b6fc8b` → **21**, `1fa3df9^` → **21**, árbol
   → **20**. Ejecutado: **`20 passed (20)`**. Y `git diff --name-only 1fa3df9^..HEAD --
   tests/` devuelve **ese fichero y ninguno más**, así que ningún otro cambió de recuento:
   el `1687 → 1686` global es aritméticamente el mismo caso.
4. **Cero exclusión de `ADR-033` por nombre y cero aflojamiento.** `ADR-033` solo aparece
   en la prosa que explica por qué está prohibido; en código, nada. Ni un `.skip`, ni un
   `.only`, ni un `todo(` en las líneas **añadidas de toda la rama**. La otra mitad de
   SPEC-050 CA-20 —listas exactas de `dependencies`, `devDependencies`, `scripts` y el
   semver— sigue con sus cuatro casos verdes y **sin una línea tocada**. **Ninguna segunda
   aserción ajena** ha sido modificada: solo tres ficheros de `tests/` cambian, dos son de
   esta spec (uno nuevo y uno con `173  0`, cero borradas) y el tercero es el autorizado.

**Y la versión no se ha movido, que era la otra trampa.** `package.json` sigue en `0.3.4`
(`git diff --numstat … -- package.json` → vacío) y el lock se ha sincronizado **a ese mismo
número**, con `2  2` y nada más. Es una reparación, no un bump. Correcto: la rama no toca
`src/` ni `app/`.

### Dictamen sobre `F-SPEC-053-7` — el índice de la cabecera

El implementador escaló en vez de decidir, y **hizo bien**: se beneficiaba de la lectura.
El árbitro es el verificador, así que dictamino.

**CA-13 gobierna ASERCIONES, no la prosa del fichero.** Tres razones, en orden de peso:

1. **La lectura literal se contradice con la propia CA-13.** Su condición 2 **obliga** a
   escribir el porqué *«en el propio fichero, donde estaba el caso»* — 43 líneas de
   comentario nuevas. Una cláusula que prohibiera tocar *«ninguna otra línea»* de prosa
   haría imposible cumplir la condición que va justo antes. Las tres frases —*«ninguna otra
   línea»*, *«no se toca nada más»*, *«cualquier otra línea sigue siendo RED»*— viven todas
   bajo el encabezado *«**No es una aflojada** y no se toca nada más»*: lo que protegen es
   la **fuerza de las comprobaciones**, y un comentario de índice no tiene ninguna.
2. **El precedente ya está sentado dentro de esta misma entrega.** La línea 1 —el `import`
   que pierde `readdirSync`— **es** «otra línea» y se tocó, porque la retirada la dejaba sin
   uso y el gate de lint no admite warnings. Nadie lo llama RED, y con razón. El mismo
   criterio se aplica a dos líneas de índice que describen el caso retirado.
3. **Dejarlo es el defecto que este proyecto lleva cuatro veces persiguiendo.** Las líneas
   **25** (*«CA-20  ni una dependencia nueva, ni un script nuevo, ni un ADR nuevo»*) y
   **234** (*«CA-20 — sin dependencia nueva, sin script nuevo, sin ADR nuevo»*) anuncian
   una comprobación que **ya no existe**. Es prosa que envejece sola, en la cabecera que
   alguien lee **antes** de llegar al comentario de 43 líneas que lo explica.

**Consecuencia práctica, y es doble:**

- **No es un RED.** Ningún CA de esta spec exige actualizar el índice, y el árbol entregado
  cumple los catorce. Por eso el veredicto es GREEN sin salvedad.
- **Pero se arregla en esta rama, no en otra vida.** Queda **autorizado por este GREEN** —el
  propio residual preveía esta salida: *«el verificador puede dictaminarlo en el mismo GREEN
  y lo aplico»*—, así que aplicarlo **no reabre nada** ni rodea el gate `require-spec`:
  forma parte del trabajo verificado. El texto exacto está en `F-SPEC-053-7`, abajo.

### Lo que NO he verificado, y lo digo

- **No hay evidencia visual y no debe haberla.** La rama no toca `src/` ni `app/`; no hay
  DOM que mirar. Un `_qa/SPEC-053/` con capturas sería teatro, y coincido con el ledger.
- **No he corrido la e2e de Playwright.** No aporta —cero superficie de interfaz— y
  reescribe capturas commiteadas de otras specs bajo `_qa/`. El único CA de UI sería
  inventado.
- **`F-SPEC-053-2` (colisión del id `ADR-033`) sigue siendo del gate humano.** Comprobado
  ahora: `docs/adr/` tiene **un** ADR nuevo, el 033, y SPEC-052 sigue *untracked* sin ADR.
  **Vuelve a mirarlo justo antes de mergear**: yo no puedo ver la otra rama.

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

  ---

  **RESUELTO POR EL GATE — 2026-08-24.** El humano (**Alberto Fojo**) autorizó el arreglo y
  pidió que lo redactara el **arquitecto**, no el implementador. Está en la spec como
  **CA-13** y **CA-14**, con el argumento entero en §*La guardia ajena que se rompió*.

  - **Salida elegida: (b) retirar el caso.** No (a) re-encuadrar, y la razón que lo decide es
    verificable: la línea `Specs relacionadas` de `ADR-033` **contiene** `SPEC-050` (ahí cita
    `F-SPEC-050-4`), así que el re-encuadre esbozado en (a) **seguiría en rojo** sobre el mismo
    ADR que lo disparó. A eso se suma que **SPEC-050 está en `hecho` y ADR-025 no la deja
    reabrirse**: la proposición que el caso negaba no puede volver a ser falsa.
  - **Qué vigilaba antes**: *ningún fichero de `docs/adr/` contiene la cadena `SPEC-050`*,
    como prueba de que SPEC-050 no registró ninguna decisión (CE-M3).
  - **Qué vigila ahora**: **nada en la suite**. Vuelve al gate, donde ya se consumó: el ledger
    de SPEC-050 lleva el **GREEN 22/22 del 2026-08-23**. Es la salida «borrar» de
    `FOUNDATION.md`, molde `F-SPEC-042-9`.
  - **Cobertura perdida**: cazar automáticamente un ADR futuro que se retro-ajuste a SPEC-050.
    Aceptada; el porqué está en la spec.
  - **Cobertura conservada**: la otra mitad de SPEC-050 CA-20 —listas exactas de
    `dependencies`, `devDependencies`, `scripts` y el semver—, que **sí** es propiedad, más
    los otros **20 casos** del fichero, verdes y sin tocar.
  - **CA-11 y CA-12 quedan enmendados** para admitir `tests/primera-pantalla-fuente.test.ts`
    en el conjunto cerrado, **solo** con el alcance de CA-13.
  - **Prohibido**: excluir `ADR-033` por nombre (condición 3 de CA-13).
  - **Y sigue en pie quién hace qué**: el implementador **no tocó el fichero** y escaló, que
    es lo que había que hacer. Ahora sí puede tocarlo, y **solo** eso.

  ---

  **CERRADO — aplicado el 2026-08-24 por el implementador.** El caso está retirado, con su
  porqué escrito en el hueco que dejó. Diff **`50 10`**, suite **1686/1686 en verde**,
  `lint` y `typecheck` en **0**. La evidencia entera —los cuatro recuentos y las diez líneas
  borradas, una a una— está en §*CA-13 y CA-14*. **Un solo apunte sobre el alcance**: además
  de las nueve líneas del caso hubo que quitar `readdirSync` del `import` de la línea 1
  porque quedaba sin uso y el gate de lint no admite warnings; está verificado
  (`npx eslint` con el import → **1**, sin él → **0**) y dicho también dentro del comentario.
  Nada más de ese fichero se ha tocado. Lo que quedó **sin** tocar, a propósito y con
  discusión, es `F-SPEC-053-7`.

- **`F-SPEC-053-7` (ABIERTO, menor — decisión de alcance que NO tomo yo)** — **el índice de
  la cabecera de `tests/primera-pantalla-fuente.test.ts` sigue anunciando el caso retirado.**
  La línea **25** del fichero dice:

  ```
   *   CA-20  ni una dependencia nueva, ni un script nuevo, ni un ADR nuevo
  ```

  y la **234**, la cabecera de la sección, dice *«CA-20 — sin dependencia nueva, sin script
  nuevo, sin ADR nuevo»*. Tras la retirada, *«ni un ADR nuevo»* ya no lo comprueba nada: es
  prosa de índice que se ha quedado desfasada.

  **No la toco, y el motivo es literal**: CA-13 cond. 1 dice *«ninguna otra línea de ese
  fichero»*, cond. 3 dice *«no se toca nada más»*, y la enmienda de CA-12 remata con
  *«cualquier otra línea de ese fichero sigue siendo RED»*. Cabe leerlo como que esas
  cláusulas hablan de **aserciones** y no de prosa de índice —y entonces actualizar dos
  líneas de comentario sería lo correcto—, pero **esa lectura la haría yo, que soy quien se
  beneficia de que el fichero deje de estar rojo**. Habiendo tres frases explícitas en
  contra, lo conservador es preguntar en vez de interpretar.

  **Mitigación mientras tanto**: el índice no engaña mucho rato. Quien lo siga llega al
  bloque `SPEC-050 CA-20` y lo primero que encuentra tras los cuatro casos vivos es el
  comentario de 43 líneas que explica exactamente qué pasó con el quinto. La explicación
  está **en el fichero**, no solo aquí.

  *Destino*: el **verificador** puede dictaminarlo en el mismo GREEN —«actualiza esas dos
  líneas»— y lo aplico; o el **arquitecto** lo mete en la enmienda si prefiere dejarlo
  escrito. *Coste*: dos líneas de comentario.

  ---

  **DICTAMINADO — 2026-08-24, `sdd-verificador`. Se actualiza, y se actualiza aquí.**
  El razonamiento entero está en §*Veredicto del verificador* → *Dictamen sobre
  `F-SPEC-053-7`*. En corto: **CA-13 gobierna aserciones, no la prosa del fichero** —su
  propia condición 2 obliga a escribir 43 líneas de comentario nuevas en ese mismo
  fichero, así que *«ninguna otra línea»* no puede leerse como *«ningún otro carácter»*;
  y la línea 1, el `import`, ya se tocó por la misma clase de razón—. Lo que esas tres
  frases protegen es la **fuerza de las comprobaciones**, y un índice no comprueba nada.
  Dejar un índice que anuncia una comprobación inexistente es *«prosa que envejece sola»*,
  que es el defecto que `FOUNDATION.md` fijó tras cuatro incidentes.

  **No era un RED** —ningún CA lo exigía y el árbol entregado cumple los catorce, por eso
  el veredicto es GREEN sin salvedad—, pero **queda autorizado por este GREEN**: aplicarlo
  es completar el trabajo verificado, no reabrir la spec ni rodear `require-spec`.

  **El texto, para que no haya que interpretarlo.** Solo comentarios; ninguna aserción.

  `tests/primera-pantalla-fuente.test.ts:25` — **de**:

  ```
   *   CA-20  ni una dependencia nueva, ni un script nuevo, ni un ADR nuevo
  ```

  **a**:

  ```
   *   CA-20  ni una dependencia nueva y ni un script nuevo (el tercer caso, «ni un ADR
   *          nuevo», lo retiró SPEC-053 CA-13 el 2026-08-24; el porqué, en el hueco
   *          que dejó)
  ```

  `tests/primera-pantalla-fuente.test.ts:234` — **de**:

  ```
     CA-20 — sin dependencia nueva, sin script nuevo, sin ADR nuevo
  ```

  **a**:

  ```
     CA-20 — sin dependencia nueva y sin script nuevo
     (el «sin ADR nuevo» lo retiró SPEC-053 CA-13 el 2026-08-24; el porqué, más abajo)
  ```

  **Cómo se confirma que no se ha llevado nada por delante** (es el único chequeo que hace
  falta, y va al commit): `npx vitest run tests/primera-pantalla-fuente.test.ts` tiene que
  seguir dando **`20 passed (20)`**, y `npm run lint` **0**. Si el recuento se mueve del 20,
  se ha tocado algo que no era prosa y **eso sí** sería RED.

  *Dueño*: **sdd-implementador**, en esta rama, antes de mergear. *Coste*: dos comentarios.

- **`F-SPEC-053-6` (menor, encontrado y resuelto por el arquitecto el 2026-08-24)** — **este
  ledger se commiteó con un BOM UTF-8 delante del frontmatter, y eso rompía
  `valida.mjs`.** Los tres primeros bytes del fichero eran `EF BB BF` ya en `e25078e`, así
  que `node core/scripts/valida.mjs` daba *«sin frontmatter o sin 'id'»* sobre SPEC-053 —el
  parser no reconoce el `---` precedido de BOM—. **Barrido**: se han comprobado los **siete**
  ficheros de la rama y era **el único**; ni los `.ts`, ni el `.mjs`, ni el `package-lock.json`,
  ni la spec, ni ADR-033 lo tienen. Retirado (`utf-8-sig` al leer, `utf-8` al escribir); sin un
  solo carácter de contenido cambiado. `valida.mjs` vuelve a decir **OK**. Se anota porque es
  invisible en un diff de texto y el siguiente que edite este fichero desde una consola de
  Windows lo va a reintroducir.

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

**Nota (2026-08-24, tercera pasada — aplicado el finding del GREEN)**: el verificador
dictaminó `F-SPEC-053-7` en su propio GREEN (*«CA-13 gobierna aserciones, no la prosa del
índice»*) y dejó el texto exacto a aplicar. Se ha aplicado, literal, en
`tests/primera-pantalla-fuente.test.ts:25` y `:234` — **solo comentarios, ninguna
aserción tocada**. `npx vitest run tests/primera-pantalla-fuente.test.ts` sigue en
**`20 passed (20)`** (antes y después) y `npm run lint` sigue en **0**. De paso, corregida
la errata de la columna *Test* de **CA-7** que el propio verificador señaló como suya de
arreglar por mí: decía «12/12» y «6/6», y son **8/8** y **7/7** (los recuentos reales, ya
verificados en verde por el verificador). No se ha tocado ninguna columna `Verif.` ni
`Estado`.

**Estado (2026-08-24, segunda pasada)**: **implementación terminada**. Los **catorce** CA
están cubiertos —nueve con test permanente, cuatro con evidencia de gate arriba, y CA-13 con
el texto del fichero más su diff—. La spec está en `en-revision`. **Falta el verificador**.
La suite entera está en **verde**: `110 passed (110)` / `1686 passed (1686)`, `lint` 0,
`typecheck` 0. **`F-SPEC-053-4` quedó cerrado**; el único residual abierto que necesita una
respuesta es **`F-SPEC-053-7`**, y son dos líneas de comentario.

**Los commits de la rama, en orden**:

| Commit | Qué trae |
|---|---|
| `e24c578` | la spec, el ledger y ADR-033 (del arquitecto, aprobado por el humano) |
| `c4d774b` | **CA-1, CA-4, CA-5, CA-6** — la guardia nueva (escrita primero, roja por el defecto vivo) y la sincronización del lock a `0.3.4` |
| `d0c3a88` | **CA-8, CA-9, CA-10** — el texto del gate: cabecera, `--help` y `sin-subir` |
| `e25078e` | el ledger con los doce CA y la escalada `F-SPEC-053-4` |
| `fa6481d` | **CA-13 y CA-14** y la enmienda de CA-11/CA-12 (del arquitecto, autorizada por el humano el 2026-08-24) |
| `1fa3df9` | **CA-13** aplicado — la retirada del caso ajeno, con su porqué en el sitio |

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
- `tests/primera-pantalla-fuente.test.ts` — **ajeno**, y por eso el alcance es el más
  estrecho de toda la rama: **un caso retirado** (`:310-318`), **su porqué escrito en el
  hueco** y **el `import` de la línea 1**, que pierde `readdirSync` por quedarse sin uso.
  Nada más. Lo que **no** se hizo, porque está prohibido y porque es lo que apetecía:
  excluir `ADR-033` por nombre del filtro.

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

**Siguiente paso**: **verificador**. La rama **no** tiene PR abierta y **no** se ha mergeado
nada. `F-SPEC-053-4` ya no está sobre la mesa: se cerró aplicando CA-13, y la CI de esta rama
debería salir limpia en `Unit tests`.

**Dos cosas que mirar con lupa al verificar, porque son las que más fácil se cuelan**:

1. **Que la retirada de CA-13 no se llevó nada por delante.** La prueba corta es
   aritmética: `21 → 20` en el fichero y `1687 → 1686` en la suite. Si alguien hubiera
   retirado **dos** casos, el global habría bajado en dos. Está en §*CA-13 y CA-14* con los
   cuatro recuentos pegados, y el desglose de las diez líneas borradas, una a una.
2. **Que no hay exclusión de `ADR-033` por nombre.** La condición 3 de CA-13 la prohíbe, y
   era el parche que apetecía. `ADR-033` solo aparece en las líneas añadidas dentro de la
   prosa que explica **por qué está prohibido**; cero en código.

**Y antes de mergear, mirar otra vez `F-SPEC-053-2`**: SPEC-052 sigue en vuelo por otra
rama. Comprobado hoy en este worktree: sus dos `.md` están ahí como *untracked* y
`docs/adr/` sigue sin ningún ADR suyo, así que `ADR-033` no colisiona **todavía**.
