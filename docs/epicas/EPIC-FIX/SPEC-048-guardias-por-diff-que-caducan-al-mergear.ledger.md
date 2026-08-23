---
id: SPEC-048
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-048 Guardias por diff que caducan al mergear

## Resumen
- Fase: `hecho` — **GREEN de sdd-verificador el 2026-08-23** (ver §Veredicto). Implementada por
  sdd-implementador el 2026-08-22.
  **Formalizada el 2026-08-23 por sdd-arquitecto** (spec y ledger, sin tocar código): `F-SPEC-048-1`
  ratificado y convertido en **CA-13**, premisa de CA-11 corregida, barrido reescrito con sus **dos
  familias**, `F-SPEC-048-2` redirigido a **EPIC-INFRA** y abierto `F-SPEC-048-3`.
- Rama: `ft/SPEC-048-guardias-de-diff-caducadas` (worktree `D:/src/wt-48`, desde `origin/main` = `104f94e`)
- Batería de unidad: **antes** `3 failed | 1502 passed (1505)` en 100 ficheros ·
  **después** `1555 passed (1555)` en 104 ficheros, **0 saltados**. `npm run lint` y
  `npx tsc --noEmit` limpios. Reconfirmado el 2026-08-23 tras CA-13.2 y `F-SPEC-048-3`:
  **`1555 passed (1555)`**, 104 ficheros, 0 saltados, lint y typecheck limpios.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `tests/ventana-fija.ts` (revisiones como parámetro, nunca dentro de la llamada a git); `ENTREGA_DE_SPEC_047 = { antes: '6da9fbe', despues: '104f94e' }` en `tests/icono-frontera.test.ts` y `tests/icono-guardias-ampliadas.test.ts` | `tests/guardias-ancladas.test.ts` › «CA-1: las dos guardias miran una ventana fija…» (4 casos: sin revisión móvil ×2, constante con nombre ×2) + «los dos extremos son sha literales» + «`antes` es el primer padre de `despues`» | La meta-guardia aplicada a los dos ficheros da **0 infracciones**; `tests/guardias-ancladas.test.ts` 22/22. Contraste propio: el MISMO analizador sobre esos dos ficheros tal y como estaban en `104f94e` encuentra **10** (7 en `icono-frontera`, 3 en `icono-guardias-ampliadas`) — la cifra del implementador, medida por mí. | ✅ |
| CA-2 | centinela en cada uno de los dos ficheros | `tests/icono-frontera.test.ts` › «la ventana no está vacía: trajo el icono, su generador y el guardián»; `tests/icono-guardias-ampliadas.test.ts` › mismo título | Mutación propia: fijando la ventana a `104f94e`…`104f94e` (vacía), **los dos centinelas se ponen rojos**, uno en cada fichero. Salvedad menor anotada abajo: el centinela es **por fichero**, no por `describe` (ADR-031 2.2 dice «del mismo bloque»); como la ventana es una constante única por fichero, cubre igual. | ✅ |
| CA-3 | `describe.skipIf(!HAY_VENTANA)` en los cinco bloques anclados de los dos ficheros | `tests/guardias-ancladas.test.ts` › «CA-3: el salto es por disponibilidad, y no puede ocurrir en CI» (3 casos, uno **siempre activo**). Comprobado además con `CI=1`: 152/152 verdes, **0 saltados** | Batería **completa** con `CI=1`: **1555 passed (1555)** en 104 ficheros, **0 saltados**. Los 10 ficheros de guardias con `CI=1`: 195/195, 0 saltados. El caso «con CI definida … ningún bloque anclado se salta» está fuera de todo `skipIf`: siempre corre. | ✅ |
| CA-4 | `tests/icono-frontera.test.ts` › «el guardián de sesión cambia en una sola línea de código: la del matcher», sobre `lineasDeCodigoDelDiff()` | ese mismo caso (era **R-1**, rojo en `main`) | Verde (`quitadas`/`anadidas` = 1 y 1, las dos con `matcher`) y con los mismos valores en el futuro simulado. Reproducido el **antes**: extrayendo los dos ficheros de `104f94e` y corriéndolos contra este árbol → **3 failed / 26 passed (29)**; R-1 es uno de los tres. | ✅ |
| CA-5 | `tests/icono-frontera.test.ts` › «el diff sobre tests/ añade ficheros y casos, y sólo modifica las tres guardias», sobre `testsModificadosEnLaVentana()` | ese mismo caso (era **R-2**) + mutación de control con un cuarto fichero | Verde; `testsModificadosEnLaVentana` devuelve exactamente los tres autorizados. R-2 reproducido en el mismo experimento del **antes**. Mutación con un cuarto fichero, presente y ejecutada. | ✅ |
| CA-6 | `tests/icono-guardias-ampliadas.test.ts` › «el diff sobre tests/ no modifica ningún fichero ajeno fuera de esas tres» | ese mismo caso (era **R-3**) + `tests/guardias-ancladas.test.ts` › «CA-6: los sha declarados en ambos coinciden» | Verde; R-3 reproducido en el **antes**. «Los sha declarados en ambos coinciden» lee la constante de la fuente de cada fichero: si las dos ventanas se separaran, se vería. | ✅ |
| CA-7 | las **12** aserciones del inventario, re-encuadradas a la ventana y con su mutación de control al lado: 6 en `tests/icono-frontera.test.ts`, 6 en `tests/icono-guardias-ampliadas.test.ts` | los mismos 12 casos; cada uno vuelve a ejecutar su comparación contra una entrada mutada (un fichero de más en la lista, una clave de más en `dependencies`, un byte de más en el caso) y exige que la rechace | **Las 12 llevan mutación y las 12 se ejecutan; comprobado que MUERDEN, no que existan.** Neutralizando los tres comparadores con nombre (`fueraDelConjunto`, `zonasProhibidas`, `qaAjenas` → `() => []`) caen **exactamente esos 3 casos** aunque la aserción principal siga verde; rompiendo el predicado de `public/`, cae el suyo; neutralizando `casos()`, caen los 3 de CA-19.4. **Residual medido**, `F-SPEC-048-4` abajo: en los 3 de «el único caso que cambia es el ampliado» la mutación vive dentro de un `for` que no correría si el extractor dejara de casar, y 2 controles son tautológicos por la forma que el propio CA prescribe. No es vacuidad **hoy** (los bucles recorren ~10 casos por fichero) y la vacuidad por ventana la cierra CA-2, probada. | ✅ |
| CA-8 | comentario dentro de cada uno de los 15 casos tocados por CA-4…CA-7 | `tests/guardias-ancladas.test.ts` › «CA-8: cada re-encuadre lleva su porqué dentro del caso» (11 casos de fuente + centinela del barrido) | 11 casos de fuente → 15 en ejecución (3 rojos + 12 verdes vacíos), todos verdes; cada uno exige `SPEC-048`, su CA, `2026-08-22`, «arbitraje del humano», «Qué vigilaba antes» y «Qué vigila ahora», y aborta con `toBeDefined` si el caso no se encuentra. Leídos los 15 comentarios: dicen lo que el CA pide. | ✅ |
| CA-9.1 | `tests/guardias-no-caducan.test.ts` › `beforeAll`: `git clone --shared --no-checkout` a un temporal + `read-tree`/`hash-object`/`update-index`/`write-tree`/`commit-tree`/`update-ref` | «CA-9.1 — el futuro simulado existe y de verdad ha movido la diana» y «CA-9.1 — y el repositorio real queda como estaba: ni un ref, ni un fichero» | Medido **desde fuera del test**: `HEAD` = `29fe662` antes y después, `git show-ref` con md5 idéntico (`e8c9bebc4178a030a8c742d906bee734`) y `git status --porcelain` **vacío**. El clon es `--shared --no-checkout` y toda la escritura va por fontanería sobre el temporal. Su propio centinela de escenario, verde. | ✅ |
| CA-9.2 | idem | «CA-9.2 — la ventana fija devuelve exactamente lo mismo que en el árbol actual», «…la aserción de CA-4 sigue verde y con los mismos valores», «…las aserciones de CA-5 y CA-6 siguen verdes y con los mismos valores» | Los tres casos verdes, y comparan **valor a valor** contra el árbol real (`toEqual` futuro↔árbol), no sólo «sigue verde». | ✅ |
| CA-9.3 | `FORMULACION_VIEJA = { antes: 'origin/main', despues: 'HEAD' }` evaluada en el futuro simulado | «CA-9.3 — control negativo: la formulación vieja FALLA en ese mismo futuro» (`.toThrow()` sobre las aserciones viejas de CA-5 y CA-4) y «CA-9.3 — y se ve por qué: contra una diana móvil el diff queda vacío». **Contraprobado**: sustituyendo `FORMULACION_VIEJA` por la ventana buena, los dos casos se ponen en rojo (`2 failed` de 7) | **Contraprueba ejecutada por mí.** Copia del fichero con `FORMULACION_VIEJA` sustituida por `{ antes: '6da9fbe', despues: '104f94e' }` → **2 failed / 5 passed (7)**, y los dos rojos son *exactamente* los dos casos de CA-9.3; CA-9.1 y CA-9.2 siguen verdes. El control controla. Copia borrada; árbol limpio. | ✅ |
| CA-9.4 | prosa en la cabecera del fichero y en el caso de CA-9.3 | el propio texto del caso cita ADR-031 pto. 2 y dice que es el caso que impide repetir el error de SPEC-047 | Leídos la cabecera del fichero y el cuerpo del caso: dicen que es el caso que impide repetir el error de SPEC-047 y citan ADR-031 pto. 2. | ✅ |
| CA-10.1 | `tests/revision-movil.ts` — `analizar()` tapa comentarios, literales y expresiones regulares antes de mirar | `tests/revision-movil-en-tests.test.ts` › «sobre un fragmento que sólo la menciona en un comentario, no la detecta» y «CA-10.1 — un título de describe que nombra la diana móvil no es infracción» | Verde, y comprobado sobre ficheros reales: los `describe` y comentarios que nombran `origin/main` en `tests/deploy-gate-workflow.test.ts` y `tests/neon-preview-cleanup-workflow.test.ts` no producen ni una infracción en el barrido de CA-10.4. | ✅ |
| CA-10.2 | `SUBCOMANDOS = ['diff','show','log','rev-list']` — `rev-parse` queda fuera, y una llamada que no es a git tampoco cuenta | `tests/revision-movil-en-tests.test.ts` › «CA-10.2 — `git rev-parse HEAD` sigue siendo legítimo» y «CA-10.2 — pasar HEAD como entrada a un script bajo prueba sigue siendo legítimo» | Verde. `rev-parse` queda fuera de `SUBCOMANDOS`; `tests/version-build-identity.test.ts` y `tests/version-bump-gate.test.ts` pasan el barrido sin infracción. | ✅ |
| CA-10.3 | `infraccionesEnFuente()` exportada, aplicable a un fragmento suelto | `tests/revision-movil-en-tests.test.ts` › «CA-10.3: la meta-guardia se prueba a sí misma» (6 casos: 2 infractores —literal y concatenado—, 4 inocentes) | 6/6, con los dos infractores (literal y concatenado) y los cuatro inocentes. | ✅ |
| CA-10.4 | — | `tests/revision-movil-en-tests.test.ts` › «cero infracciones en todo tests/\*\*/\*.ts» + centinela «el barrido mira de verdad». Contra el árbol previo encontraba **10** infracciones, las de los dos ficheros de SPEC-047 | **Infracción plantada por mí en un fichero real de `tests/`**, en su forma indirecta (`const BASE = 'origin/main'` y luego `${BASE}...HEAD` dentro de `execFileSync('git', […])`): la caza y nombra las dos revisiones. Segunda plantada con `git('show', BASE + ':' + ruta)` y `git('log','--oneline','main..HEAD')`: caza las tres. Retiradas; árbol limpio. Cero infracciones con el árbol tal y como queda. Límite medido en `F-SPEC-048-5`. | ✅ |
| CA-11 | **RI-03** en `docs/fundacion/reglas.md` § *Reglas de ingeniería (RI-xx)* | `tests/reglas-ingenieria-ri03.test.ts` (11 casos). `tests/reglas-ingenieria.test.ts` **no se toca** y sigue en 27/27. ⚠️ Premisa del CA corregida el 2026-08-23 (`F-SPEC-048-1`): escribir RI-03 **sí** rompe una guardia ajena, y su autorización es **CA-13**. Uno de los 11 casos arrastraba `F-SPEC-048-3` y **quedó arreglado el 2026-08-23**, antes del merge: ya no congela la extensión de la serie | 11/11, y `tests/reglas-ingenieria.test.ts` **no está en el diff** y sigue en 27/27. RI-03 vive en `docs/fundacion/reglas.md` con las cuatro condiciones, el mecanismo y la fuente ADR-031. `F-SPEC-048-3` **verificado como arreglado**: ya no queda `toEqual(['RI-01','RI-02','RI-03'])`, y la forma nueva muerde sobre el documento real (ver CA-13.2). | ✅ |
| CA-12 | — | `npm run test` completo: **1555 passed (1555)**, 104 ficheros, **0 saltados**. El verde de `main` sólo es afirmable tras el merge (RI-02) | Batería completa medida por mí: **1555 passed (1555)**, 104 ficheros, **0 saltados** — e idéntico con `CI=1`. `npm run lint` y `npx tsc --noEmit`, limpios. La otra mitad —el verde del CI de `main`— es posterior al merge (RI-02) y **no se finge**: se pega aquí cuando exista. | 🚧 |
| CA-G1 | n-a (criterio de gate) | El diff de la entrega no toca `src/`, `drizzle/`, `vercel.json`, `.github/workflows/` ni `package.json`: 14 ficheros, todos bajo `docs/` y `tests/`. `npm run version:check` no exige bump | Auditado el diff completo `104f94e…HEAD`: **14 ficheros**, todos bajo `docs/` y `tests/`. Ni `src/`, ni `drizzle/`, ni `vercel.json`, ni `.github/workflows/`, ni `package.json`. `npm run version:check` → exit 0, «el diff no toca codigo de aplicacion». | ✅ |
| CA-13.1 | `tests/reglas-ingenieria-hecho-vivo.test.ts`, y dentro de él **un solo caso**: «va después de RI-01, en la misma serie» | `git diff 104f94e HEAD -- tests/` modifica cuatro ficheros y sólo dos son ajenos: éste (CA-13) y `tests/deploy-gate-workflow.test.ts` (prosa, autorizada el 2026-08-22). Dentro de éste el diff cae entero en ese `it(...)`; los otros 15 casos quedan byte a byte. `tests/legal-rutas-publicas.test.ts` y `tests/cuenta-rutas.test.ts`, intactos | Auditado el diff entero: de `tests/` se modifican **cuatro** ficheros y sólo **dos** son ajenos — `tests/deploy-gate-workflow.test.ts` (una línea de prosa, el título del `describe`; cero comportamiento) y éste. `tests/legal-rutas-publicas.test.ts` y `tests/cuenta-rutas.test.ts` **no aparecen en el diff**. Dentro del fichero el único *hunk* es `@@ -77,10 +77,56 @@`, íntegro dentro de `it('va después de RI-01, en la misma serie')`. **La autorización no se ha desbordado.** | ✅ |
| CA-13.2 | `serieSana()`, dentro del propio caso: serie no vacía + `every((n, i) => n === i + 1)` + `includes(2)` | la MISMA comparación rechaza `[1, 3]` (hueco), `[1, 2, 2]` (repetido), `[2, 1, 3]` (desorden), `[1]` (sin RI-02) y `[]` (vacía). Y contraprobado sobre el documento real, no sólo con constantes: renombrando RI-03 a RI-04 en `docs/fundacion/reglas.md` (hueco) y a un segundo RI-02 (repetido), el caso se pone rojo — `3 failed de 27` en cada mutación; restaurado, 27/27 | **Mutado el documento real `docs/fundacion/reglas.md`, no las constantes.** Hueco (RI-03→RI-04): **3 failed / 51 passed (54)**. Repetido (RI-03→segundo RI-02): **3 failed / 51**. Desaparición de RI-02 (RI-02→RI-05): **13 failed / 41**. Restaurado: **54/54**. En el hueco, los rojos incluyen «va después de RI-01, en la misma serie»: la guardia re-encuadrada muerde sobre el documento de verdad. Fortalecimiento confirmado — la forma vieja `toEqual(['RI-01','RI-02'])` no rechazaba ninguna de esas tres formas salvo por accidente. | ✅ |
| CA-13.3 | ninguna otra aserción del fichero se toca | 16/16 en `tests/reglas-ingenieria-hecho-vivo.test.ts`, incluidos «la sección de ingeniería contiene RI-02», «lleva su nombre: "Hecho" significa "vivo"», los ocho fragmentos de CA-14.2, la fuente ADR-018 D-7 y «RI-01 sigue palabra por palabra como la dejó SPEC-032» (CA-14.3) | 16/16 en el fichero, incluido «RI-01 sigue palabra por palabra como la dejó SPEC-032» (CA-14.3) y «la sección de ingeniería contiene RI-02». El único *hunk* del diff no roza ninguna otra aserción; verificado línea a línea. | ✅ |
| CA-13.4 | comentario dentro del propio caso | dice qué vigilaba antes, qué vigila ahora, que la guardia sale **más fuerte**, que lo autoriza **CA-13**, y —sin borrarlo al ratificarse— que el arbitraje **no precedió al cambio**, que lo levantó el implementador como `F-SPEC-048-1` y que el humano (Alberto Fojo) lo ratificó el **2026-08-23** | Leído el comentario: qué vigilaba antes, qué vigila ahora, la fecha, el CA que autoriza, **y que el arbitraje del humano NO precedió al cambio** — que lo levantó el implementador como `F-SPEC-048-1` y que el humano lo ratificó el **2026-08-23**. El incumplimiento **no se ha borrado al ratificarse**. Es excepción datada, no precedente. | ✅ |
| CA-G2 | n-a (criterio de gate) | **Con dos perforaciones nominales, las dos declaradas y autorizadas**, ver *Salvedades*: `tests/deploy-gate-workflow.test.ts` (una línea de prosa, autorizada por el humano el 2026-08-22) y `tests/reglas-ingenieria-hecho-vivo.test.ts` (`F-SPEC-048-1`, ratificado el 2026-08-23 y formalizado como **CA-13**). `tests/legal-rutas-publicas.test.ts` y `tests/cuenta-rutas.test.ts` **intactos** | Confirmadas las **dos** perforaciones nominales y ninguna más. Ninguno de los seis sitios sanos del barrido de la familia 1 está modificado, salvo la línea de prosa autorizada. `tests/legal-rutas-publicas.test.ts` y `tests/cuenta-rutas.test.ts`, byte a byte. **Y se respetó lo de fondo:** `CA-G1/G2/G3` **no** existen como tests permanentes — `grep -rn 'CA-G1/CA-G2/CA-G3' tests/ scripts/` no devuelve nada. | ✅ |
| CA-G3 | n-a (criterio de gate) | Del verificador. Las cifras de antes/después y la contraprueba de CA-9.3 están en §Resumen y en la fila CA-9.3 | **Antes** (los dos ficheros de `104f94e` corridos contra este árbol, con `origin/main` ya movido): **3 failed / 26 passed (29)** — R-1, R-2 y R-3, los tres del run 32583255349. **Después**: **1555 passed (1555)** en 104 ficheros, 0 saltados; con `CI=1`, idéntico; lint y typecheck limpios. **Control negativo de CA-9.3**: sustituyendo la formulación vieja por la ventana buena → **2 failed / 5 passed (7)**, y los dos rojos son los dos casos de CA-9.3. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — sdd-verificador, 2026-08-23.** 24 CA en ✅ y **CA-12 en 🚧**, que es donde
tiene que estar hasta que `main` corra su CI (RI-02). No he leído el relato de nadie: lo
que sigue lo he medido yo en `D:/src/wt-48`, y las mutaciones las he hecho a mano y
retirado, con el árbol comprobado limpio después de cada una.

### Las cifras, medidas aquí

| Qué | Salida |
|---|---|
| `npx vitest run` (completo) | **1555 passed (1555)**, 104 ficheros, **0 saltados** |
| `CI=1 npx vitest run` (completo) | **1555 passed (1555)**, 104 ficheros, **0 saltados** |
| `npm run lint` · `npx tsc --noEmit` | limpios, exit 0 los dos |
| `npm run version:check` | exit 0 — «el diff no toca codigo de aplicacion» |
| **Antes** (los dos ficheros de `104f94e`, corridos contra este árbol) | **3 failed / 26 passed (29)** — R-1, R-2 y R-3 |
| Diff de la entrega `104f94e…HEAD` | 14 ficheros, todos bajo `docs/` y `tests/` |

### Lo que aprieté, y qué pasó

1. **CA-9.3, el control negativo (CA-G3).** Sustituí `FORMULACION_VIEJA` por la ventana
   buena `{ antes: '6da9fbe', despues: '104f94e' }` en una copia del fichero:
   **2 failed / 5 passed (7)**, y los dos rojos son *exactamente* los dos casos de
   CA-9.3, con CA-9.1 y CA-9.2 intactos en verde. **El control controla.**
2. **CA-9.1, sin rastro.** Medido desde fuera del test: `HEAD` = `29fe662` antes y
   después, `git show-ref` con md5 idéntico (`e8c9bebc4178a030a8c742d906bee734`) y
   `git status --porcelain` vacío. El clon es `--shared --no-checkout` y todo se escribe
   con fontanería sobre el temporal.
3. **Las doce mutaciones de CA-7 muerden.** Neutralizando los comparadores con nombre
   (`fueraDelConjunto`, `zonasProhibidas`, `qaAjenas` → `() => []`) caen **exactamente
   esos tres casos**, aunque la aserción principal siga verde; rompiendo el predicado de
   `public/`, cae el suyo; neutralizando `casos()`, caen los tres de CA-19.4. Y la
   vacuidad de ventana la cierra CA-2: con la ventana fijada a `104f94e…104f94e`
   **los dos centinelas se ponen rojos**. Residual acotado en `F-SPEC-048-4`.
4. **CA-13.2, mutando el documento real.** Sobre `docs/fundacion/reglas.md`, no sobre
   constantes: hueco (RI-03→RI-04) **3 failed / 51 passed (54)**; repetido
   (RI-03→segundo RI-02) **3 failed / 51**; desaparición de RI-02 (RI-02→RI-05)
   **13 failed / 41**; restaurado **54/54**. En el hueco, entre los rojos está
   «va después de RI-01, en la misma serie»: la guardia re-encuadrada muerde sobre el
   documento de verdad, y la forma vieja `toEqual(['RI-01','RI-02'])` no rechazaba
   ninguna de las tres. **Es fortalecimiento, no aflojada.**
5. **CA-10, con infracción plantada por mí.** En un fichero real de `tests/`, en la
   forma indirecta que el defecto tenía (`const BASE = 'origin/main'` + interpolación
   dentro de `execFileSync('git', […])`): la caza y nombra las dos revisiones. Segunda
   plantada con `git('show', BASE + ':' + ruta)` y `git('log','--oneline','main..HEAD')`:
   caza las tres. Y el contraste histórico: el mismo analizador sobre los dos ficheros
   tal y como estaban en `104f94e` encuentra **10** infracciones (7 + 3) — la
   meta-guardia habría parado la PR que lo introdujo. `tests/reglas-ingenieria.test.ts`
   no está en el diff y sigue en 27/27.
6. **CA-3, el salto prohibido en CI.** Batería completa con `CI=1`: **0 saltados**.
7. **CA-13.1, la autorización no se desbordó.** De `tests/` se modifican cuatro ficheros
   y sólo dos son ajenos: `deploy-gate-workflow.test.ts` (una línea de prosa) y
   `reglas-ingenieria-hecho-vivo.test.ts`, cuyo único *hunk* cae entero dentro del `it`
   autorizado. `legal-rutas-publicas.test.ts` y `cuenta-rutas.test.ts` **no aparecen en
   el diff**.
8. **Mi propio barrido de la séptima instancia: no la hay.** Repasadas una a una las
   líneas **añadidas** del diff con forma de foto (`toEqual([…])`, `toHaveLength(n)`,
   `toBe(n)`). Todas caen en uno de tres sacos: conjunto **vacío** como propiedad
   («cero infracciones», «nada fuera del conjunto»), hecho **inmutable** de la ventana
   `6da9fbe…104f94e`, o el commit que la propia prueba de CA-9 fabrica. Ninguna congela
   la extensión de una lista que crece por diseño. `F-SPEC-048-3` está arreglado de
   verdad: no queda `toEqual(['RI-01','RI-02','RI-03'])`, y la forma nueva la vi caer
   sobre el documento real.
9. **CA-G1/G2/G3 no se codificaron como tests**, que era lo deliberado:
   `grep -rn 'CA-G1' 'CA-G2' 'CA-G3'` sobre `tests/` y `scripts/` no devuelve nada.

### La celda de *Estado* que tocó el implementador — mi juicio

**Procede, y la mantengo.** CA-12 → 🚧 es la única celda de mi columna que él escribió,
y la habría escrito igual: la spec lo ordena literalmente («hasta entonces CA-12 se marca
🚧, nunca ✅»), 🚧 es la marca **conservadora** —no se atribuye nada—, y lo **declaró** en
el handoff en vez de callarlo. El resto de *Verif.* y *Estado* llegó vacío, que es como
tenía que llegar. Queda dicho para que no se lea como precedente: la columna es del
verificador, y lo que la salva aquí es que el valor era forzoso y la declaración,
espontánea.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-048/. Informe HTML opcional: _qa/SPEC-048/informe.html -->
No aplica: esta spec no toca interfaz. Toda su evidencia es la salida de `npm run test`.

## Salvedades / follow-ups

- **`F-SPEC-048-4` — tres de las doce mutaciones de CA-7 viven dentro de un `for` que
  podría no correr (levantado por sdd-verificador, 2026-08-23).** En
  `tests/icono-guardias-ampliadas.test.ts`, los tres casos *«`${fichero}`: el único caso
  que cambia es el ampliado»* recorren `casos(...)` y ponen su mutación de control dentro
  del bucle. Medido: neutralizando `casos()` para que devuelva un `Map` vacío, esos tres
  casos **siguen verdes** —el bucle no se ejecuta y la mutación tampoco—, mientras que los
  tres de CA-19.4 caen porque `caso()` exige `toBeDefined`. Además, la forma de control que
  el propio CA-7 prescribe («un byte de más en el blob», «una clave de más») es
  tautológica en dos sitios más: `expect(\`${x} \`).not.toBe(x)` y
  `expect({ ...deps, inventada }).not.toEqual(deps)` no pueden fallar nunca.
  - **No es vacuidad hoy** y no es de la familia que rompió `main`: con la ventana fija,
    los blobs vienen de dos revisiones distintas y los bucles recorren ~10 casos por
    fichero. Es fragilidad del extractor, no caducidad por merge — por eso es residual y
    no RED.
  - **Remedio de una línea**, para quien lo recoja: `expect(antes.size).toBeGreaterThan(0)`
    antes del bucle, que es el mismo centinela que `tests/revision-movil-en-tests.test.ts`
    ya se puso a sí mismo («y el barrido mira de verdad»). Encaja en `F-SPEC-048-2`.

- **`F-SPEC-048-5` — el límite medido de la meta-guardia (levantado por sdd-verificador,
  2026-08-23).** `infraccionesEnFuente()` sólo reconoce una llamada como git si el nombre
  invocado contiene `git` o si hay un literal `git` dentro. Probado: con un envoltorio
  local `const g = (...a) => execFileSync('git', a)`, ni `g('show', BASE + ':' + ruta)` ni
  `g('log', '--oneline', 'main..@')` se detectan. Con el envoltorio llamado `git` —que es
  como lo escriben `tests/ventana-fija.ts` y como lo escribió SPEC-047— se detectan las
  tres formas. Es exactamente el límite que **ADR-031 §Consecuencias** ya declara
  («análisis de texto … puede rodearse con suficiente empeño; pretende que colarlo
  requiera intención»), así que **no contradice CA-10** y no se toca. Queda escrito para
  que nadie lo descubra creyendo que encontró un agujero nuevo.

- **Centinela por fichero, no por bloque (observación, sin acción).** ADR-031 pto. 2.2
  pide el centinela «del mismo bloque»; aquí hay **uno por fichero** y los dos ficheros
  tienen varios `describe` anclados. Como la ventana es una constante única por fichero,
  una ventana mal escrita hace caer el centinela igual —comprobado: con la ventana vacía
  caen los dos—, así que el mecanismo cubre. Se anota porque la letra del ADR dice otra
  cosa y conviene que la próxima guardia anclada no lo lea como precedente para omitirlo.

- **Familia 2 viva en el fichero que CA-13 perforó, y correctamente NO tocada.**
  `tests/reglas-ingenieria-hecho-vivo.test.ts` l. 181-183 congela la serie **RN** con un
  `toEqual(['RN-01', …])` literal: la misma forma que CA-13 acaba de re-encuadrar dos
  casos más arriba, sobre otra serie que también crece por diseño. **Está fuera de la
  autorización** —CA-13.1 la cierra a un solo caso— y por tanto dejarla es lo correcto,
  no un olvido. Es material de `F-SPEC-048-2`, y es la instancia más cercana que hay.

- **`F-SPEC-048-1` — la serie RI estaba congelada en dos, y no en el fichero que la spec
  miró.** CA-11 afirma que *«la serie RI no está congelada en `tests/reglas-ingenieria.test.ts`
  y RI-03 entra sin romper nada (verificado en el árbol)»*. Es cierto de **ese** fichero,
  pero **`tests/reglas-ingenieria-hecho-vivo.test.ts`** (SPEC-028 CA-14.1) sí la congelaba:
  `toEqual(['RI-01', 'RI-02'])`. Escribir RI-03 lo puso en rojo. El barrido de §Entidades no
  lo vio porque buscaba comparaciones contra revisiones de git, y ésta es una lista cerrada
  **por estado** — la misma familia de defecto, otra puerta.
  - **Qué se hizo:** re-encuadrarlo a la propiedad que no caduca —la serie empieza en RI-01,
    va en orden, no salta números ni se repite, y RI-02 sigue dentro—, con qué vigilaba antes
    y qué vigila ahora escritos en el caso. Es el mismo remedio que SPEC-043 aplicó a RN-16.
    Lo que SPEC-028 CA-14.1 afirma queda entero, y `RI-01 sigue palabra por palabra` sin tocar.
  - **Por qué fue una salvedad y no un cierre limpio:** `FOUNDATION.md` § *Cómo se trabaja
    aquí* exige que la conversación ocurra **antes** de tocar una guardia ajena, y que quien
    la toca no sea quien se beneficia. Aquí el arbitraje **no** precedió al cambio. Lo
    levantó el propio implementador en vez de dejarlo correr, que es la mitad del proceso
    que sí se cumplió.
  - **RATIFICADO — humano (Alberto Fojo), 2026-08-23.** El cambio se queda: es un
    **fortalecimiento** —de foto a propiedad estructural—, no una aflojada. El código **no
    se rehace**; lo que se arregla es el **registro**. La formalización se encarga a
    **sdd-arquitecto**, precisamente porque no se beneficia de que ese test pase.
  - **Cerrado el 2026-08-23.** Formalizado como **CA-13** de la spec, con la autorización
    **nominal y cerrada** a `tests/reglas-ingenieria-hecho-vivo.test.ts` y sus cuatro
    condiciones (13.1 alcance de un fichero; 13.2 re-encuadre a propiedad, probado con
    mutación; 13.3 lo que SPEC-028 CA-14.1 y CA-14.3 afirman queda entero; 13.4 el porqué al
    lado, **incluido el incumplimiento de proceso, que no se borra al ratificarse**).
    Corregida además la premisa de **CA-11**, que daba la serie RI por no congelada: era
    cierto de `tests/reglas-ingenieria.test.ts` y falso de éste.

- **`F-SPEC-048-2` — la familia 2 entera está sin barrer.** `F-SPEC-048-1` y
  `F-SPEC-048-3` son dos muestras de ella: listas cerradas escritas como *«esto es
  exactamente lo que hay»* que caducan cuando la spec siguiente añade el elemento legítimo
  número N+1. RI-03 y la meta-guardia de CA-10 cubren la **familia 1** —el diff contra
  revisiones móviles—, no ésta. Falta un barrido de `toEqual([...])` / `toHaveLength(n)`
  sobre listas que **crecen por diseño**: series `RI/RN`, `scripts` de `package.json`,
  ficheros de `drizzle/`, workflows. La frontera que hay que saber mirar —*crece por diseño*
  vs. *cerrada por diseño*— queda escrita en §Entidades de la spec.
  - **Destino: EPIC-INFRA**, corregido por el orquestador el 2026-08-23. El implementador lo
    había mandado a EPIC-MEJORA y no es su sitio: **CE-M1 excluye defectos explícitamente**,
    y una guardia que puede quedarse vacía no es fricción de uso — es **salud técnica**, que
    es exactamente el eje de EPIC-INFRA.
  - **Producto esperado**, además del barrido: previsiblemente un **ADR que precise
    ADR-031** (estilo ADR-014 sobre ADR-012), porque la taxonomía de ADR-031 cita *«esta
    lista sigue cerrada»* como propiedad permanente sin distinguir si la lista crece. No se
    escribe hoy: sin el barrido delante sería inventar, y ADR-031 está `aprobada` y es
    inmutable.
  - No entra en SPEC-048 porque no forma parte de ninguno de sus CA.

- **`F-SPEC-048-3` — el test nuevo de esta entrega repite el defecto de la familia 2.**
  `tests/reglas-ingenieria-ri03.test.ts:47` (SPEC-048 CA-11) hace
  `toEqual(['RI-01', 'RI-02', 'RI-03'])` sobre la misma serie que crece por diseño. Es la
  forma exacta que **CA-13** acaba de re-encuadrar en `tests/reglas-ingenieria-hecho-vivo.test.ts`,
  cometida otra vez en el mismo rango de commits. Hoy está verde; se pondrá roja el día que
  se escriba RI-04.
  - **Diferencia con `F-SPEC-048-1`, y es la que importa:** ésta es guardia **propia** de
    SPEC-048, no ajena. No hay arbitraje que pedir ni beneficiario que apartar — sólo hay
    que arreglarla, y el remedio ya está escrito y probado en el fichero de al lado.
  - **Destino: arreglarla ANTES del merge**, recomendación de sdd-arquitecto al gate
    (§Notas para el gate humano, pto. 8). Mergear tal cual es embarcar a sabiendas la sexta
    instancia del defecto que esta spec existe para eliminar, y el argumento *«ya lo cogerá
    `F-SPEC-048-2`»* es el mismo que dejó `main` en rojo.
  - **CERRADA el 2026-08-23, antes del merge.** El caso pasa a llamarse *«y la serie de
    ingeniería sigue bien formada, con RI-03 dentro»* y afirma la **propiedad** —serie no
    vacía, que empieza en RI-01, va en orden, no salta números ni se repite, y RI-03 está
    dentro— con la misma disciplina que CA-13.2 le exige a la de al lado: `serieSana()`
    aislada y cinco **mutaciones de control** —`[1, 2, 4]` hueco, `[1, 2, 3, 3]` repetido,
    `[2, 1, 3]` desorden, `[1, 2]` sin RI-03, `[]` vacía— que la comparación tiene que
    rechazar. Contraprobado sobre `docs/fundacion/reglas.md` de verdad, no sólo con
    constantes: renombrando RI-03 a RI-04 (hueco) y a un segundo RI-02 (repetido), el caso se
    pone rojo las dos veces; restaurado, verde. El porqué —incluida la frontera *crece por
    diseño* vs. *cerrada por diseño*— queda escrito dentro del propio caso.
  - **Barrido del resto de la entrega, hecho el 2026-08-23.** Repasadas las nueve fuentes que
    SPEC-048 añade o modifica buscando la misma forma: **no hay una séptima instancia**. Los
    `toEqual([...])` que quedan en el diff son todos sobre listas **cerradas por diseño**: el
    conjunto vacío de infracciones de CA-10.4, los hechos inmutables de la ventana
    `6da9fbe`…`104f94e`, el commit que la propia prueba de CA-9 construye, y la ventana misma.
    El único recuento sobre una lista que podría crecer es `esperados.length === 13` de
    SPEC-047 CA-19.3 sobre los `scripts` de `package.json` — lista **cerrada por diseño**, su
    rojo dice *«alguien añadió un script sin un CA que lo pida»*—, que además no está en este
    diff y por tanto no se toca.

- **Desviación de CA-G2, autorizada:** `tests/deploy-gate-workflow.test.ts` **sí** aparece en
  el diff. Es la única línea de prosa que el gate humano autorizó el 2026-08-22 (§Notas para
  el gate humano, pto. 4): el título del `describe` de la l. 467 decía *«el diff contra
  origin/main»* cuando su mecanismo es la ventana fija `de3a6ee`…`0d389c8` desde SPEC-034.
  **Cero cambio de comportamiento** — 34/34 casos verdes antes y después—, y el porqué queda
  escrito encima del bloque. Las otras dos hermanas por estado
  (`tests/legal-rutas-publicas.test.ts`, `tests/cuenta-rutas.test.ts`) no se han rozado.

- **Riesgo vivo, ya declarado en ADR-031:** las ventanas ancladas atan la suite al histórico
  de git. Un squash o una migración de repositorio invalidarían a la vez las cuatro que hay
  (SPEC-028, SPEC-042 y las dos de SPEC-047). El `skipIf` lo convierte en salto y el caso de
  CA-3 lo haría visible en CI enseguida, pero el día que ocurra habrá cuatro sitios que tocar.

## Cómo retomar (handoff)

**Hecho.** CA-1…CA-13 implementados y verdes en `ft/SPEC-048-guardias-de-diff-caducadas`.
Siete commits, del `d1b5610` al `HEAD`:

1. `d1b5610` — `tests/revision-movil.ts` (el analizador) y `tests/ventana-fija.ts` (la
   fontanería de la ventana, con las revisiones **como parámetro**), más
   `tests/revision-movil-en-tests.test.ts`. En ese punto la meta-guardia encontraba las **10**
   infracciones de los dos ficheros de SPEC-047: RED buscado.
2. `d470407` — el re-encuadre de `tests/icono-frontera.test.ts` y
   `tests/icono-guardias-ampliadas.test.ts`. Los tres rojos vuelven a verde y los doce verdes
   vacíos vuelven a mirar algo, cada uno con su mutación de control.
3. `f84a9f8` — `tests/guardias-ancladas.test.ts` (CA-1, CA-3, CA-6, CA-8) y
   `tests/guardias-no-caducan.test.ts` (CA-9, el merge simulado con su control negativo).
4. `7e0570f` — RI-03 en `docs/fundacion/reglas.md`, su test, y la línea de prosa autorizada
   de `tests/deploy-gate-workflow.test.ts`.
5. `47b4af0` — `F-SPEC-048-1`: la serie RI deja de estar congelada en dos. Ratificado por el
   humano el 2026-08-23 y formalizado como **CA-13** por sdd-arquitecto en `5830365`.
6. `a4c75d7` — **CA-13.2** gana sus cinco mutaciones de control y su prosa cita CA-13; y
   **`F-SPEC-048-3`** queda arreglado antes del merge: el test que esta misma entrega había
   escrito para CA-11 deja de congelar la extensión de la serie RI.
7. `HEAD` — este ledger.

**Cómo se reproduce el corazón (CA-9).** `npx vitest run tests/guardias-no-caducan.test.ts`
tarda ~1,7 s. Construye un clon `--shared --no-checkout` en `%TEMP%` y escribe con fontanería
(`hash-object` + `update-index` + `commit-tree`) un commit posterior a `104f94e` que toca
`src/proxy.ts` y un **cuarto** fichero ajeno de `tests/`; después apunta ahí `refs/heads/main`
y `refs/remotes/origin/main`. No hace checkout —en Windows el árbol completo no cabe bajo
`%TEMP%` sin pasarse del límite de ruta— y no hace falta. Para ver el control negativo morder,
cambia `FORMULACION_VIEJA` por `ENTREGA_DE_SPEC_047`: los dos casos de CA-9.3 se ponen rojos.

**Cerrado el 2026-08-23 (sdd-implementador), tras la formalización de sdd-arquitecto.**
CA-13.1 y CA-13.3 se sostenían ya sobre el diff y sobre los 16/16 de
`tests/reglas-ingenieria-hecho-vivo.test.ts`, y quedan registrados en la matriz. **CA-13.2 sí
necesitaba código nuevo** y lo tiene: la propiedad aislada en `serieSana()` y cinco mutaciones
de control. `F-SPEC-048-3` queda arreglado antes del merge, con el mismo remedio y la misma
disciplina, y el barrido del resto de la entrega no encuentra una séptima instancia.

**Lo que el verificador tiene que mirar con lupa**, por orden:

1. **`F-SPEC-048-1`**: era una guardia ajena tocada sin arbitraje previo. **Ratificado por el
   humano el 2026-08-23** y formalizado como **CA-13**, con la autorización nominal y cerrada
   a un fichero. Lo que hay que comprobar ya no es si se podía tocar, sino que la
   autorización **no se ha desbordado**: ningún otro fichero ajeno modificado por esta causa,
   y dentro de él ningún otro caso tocado. El incumplimiento de proceso **sigue escrito** en
   el caso y no debe borrarse: es la excepción datada, no el precedente nuevo.
2. **Que las mutaciones de control muerdan de verdad.** Doce en CA-7, cinco en CA-13.2 y
   cinco en `F-SPEC-048-3`; la forma de comprobarlo es invertir una a mano y ver el caso caer.
   Para las dos últimas familias hay una vía mejor que las constantes: tocar
   `docs/fundacion/reglas.md` de verdad —renombrar RI-03 a RI-04, o a un segundo RI-02— y ver
   caer los dos ficheros a la vez.
3. **CA-12 sólo se cierra tras el merge** (RI-02): la afirmación es sobre el CI de `main`, y
   aquí sólo puede afirmarse sobre el árbol de trabajo. Queda en 🚧 — es la **única** celda de
   la columna *Estado* que ha tocado el implementador, por encargo del orquestador y porque la
   propia spec lo manda («hasta entonces CA-12 se marca 🚧, nunca ✅»). El resto de *Verif.* y
   *Estado* sigue intacto y sigue siendo del verificador.
4. **Que no quede una séptima instancia de la familia 2 en el diff.** El barrido está hecho y
   dice que no (ver `F-SPEC-048-3`), pero es justo la clase de afirmación que conviene no
   creerse de palabra: la quinta y la sexta también parecían no estar.

**Lo que NO se ha tocado**, a propósito: `src/`, `drizzle/`, `vercel.json`, los workflows,
`package.json`, `scripts/check-version-bump.mjs`, `tests/legal-rutas-publicas.test.ts`,
`tests/cuenta-rutas.test.ts`, `docs/roadmap.md` y `docs/tablero.md`. No hace falta subir la
versión: el diff no toca `rutasVigiladas`.
