---
id: SPEC-059
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-059 El ciclo diario deja de traer el cierre de anteayer: la hora del cron se mueve a la mañana UTC

## Resumen
- Fase: **hecho** — GREEN de `sdd-verificador` el 2026-09-03, con **CA-8 abierto a propósito**
  (observación post-deploy) y **CA-10 con una salvedad declarada**; ver «Veredicto del
  verificador». Escrita por sdd-arquitecto el 2026-09-03 junto con **ADR-039** y
  **aprobada por el humano (Alberto Fojo) ese mismo día**; **implementada el 2026-09-03** por
  sdd-implementador, con **CA-1 a CA-7, CA-9, CA-10 y CA-11 en verde** y **CA-8 abierto a
  propósito** hasta que haya dos filas de `cron_runs` bajo el horario nuevo. *(La fuente de verdad
  del estado es el frontmatter de la spec; la transición la registra el script del núcleo.)*
- Rama: `ft/SPEC-059-el-ciclo-diario-deja-de-traer-el-cierre-de-anteayer-la-hora-del-cron-se-mueve-a-la-manana-utc`
- **Lo que se decidió en el gate del 2026-09-03 (Alberto Fojo)**, que es lo que convierte esta
  spec en implementable:
  1. **La hora es `0 6 * * *`** — 06:00 UTC = 08:00 de Madrid en verano (opción **A** de las tres
     que la spec puso sobre la mesa). Se eligió por **asimetría de riesgo** y **con la salvedad
     encima de la mesa**: 06:00 UTC **no está probada** por la evidencia —cae dentro de la ventana
     abierta `(22:48, 11:05)` UTC—, el peor caso de equivocarse es el **statu quo**, y **ADR-039
     pto. 4** deja pactado mover a ≥ 11:05 UTC **sin ADR nuevo** si se confirma que el proveedor
     publica más tarde. **Ya no es una pregunta abierta; es la decisión, y `CA-8` es su condición.**
  2. **ADR-004 queda aprobado en el mismo gate** (llevaba desde 2026-07-14 en `borrador`,
     *«pendiente de aprobación»*, mientras gobernaba la cadencia). ADR-039 ya no precisa nada
     pendiente.
  3. **CA-5 y CA-6 dentro del alcance**: la entrega toca `src/` a propósito y **sube versión
     patch**. No se parte para evitarlo.
  4. **La línea ~39 de `docs/roadmap.md` la cura esta spec** (CA-9), no sdd-producto. Las ~16 y
     ~18 están en pasado y no se tocan.
- **Decisión de gobierno**: **ADR-039** (*la hora del ciclo la fija cuándo publica el proveedor,
  no el cierre de mercado; precisa ADR-004 pto. 1*), **aprobado por Alberto Fojo el 2026-09-03**.
  No supersede a nadie.
- **Toca `src/`**: `src/lib/market/sin-refrescar.ts`, `src/lib/help/content.ts` y
  `src/app/vigiladas/actions.ts` (dos comentarios y una frase de copia). El gate **Version bump**
  exigirá subida **patch** con `package.json` + `package-lock.json` en el mismo commit (ADR-033) y
  `version:check` sobre árbol limpio (SPEC-049).
- **Cero esquema, cero migración.**
- **El merge no tiene condición de horario**: con `0 6 * * *` el hueco de transición es de
  **31 h 12 min** contra el umbral de 36 h de RN-16 (CA-7). Con la opción (C) descartada sí la
  habría tenido — y volverá a tenerla si CA-8 obliga a mover la hora a ≥ 11:05 UTC.
- **Entrega parcialmente verificable en batería**: CA-1…CA-6 automáticos, CA-7 y CA-10 por
  recálculo y diff, y **CA-8 se cierra después del merge** con dos filas de `cron_runs`. Está
  declarado así en la spec a propósito, y con la hora elegida pesa más: `0 6 * * *` es justo la
  opción cuya corrección **solo** se confirma observando.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Qué exige (resumen; la fuente es la spec) | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|---|
| CA-1 | `vercel.json` → `crons[0].schedule` pasa a **`0 6 * * *`**; **nada más** del fichero cambia | `vercel.json` → `crons[0].schedule` = `0 6 * * *` | `tests/deploy-gate-workflow.test.ts` *9.2*, `tests/spec-031-frontera.test.ts` *CA-13.2* y `tests/version-bump-gate.test.ts` *«vercel.json no cambia por culpa de este gate»* — las tres comparan el fichero **entero**; `tests/spec059-hora-del-ciclo.test.ts` *«hay un solo cron»* | El diff de `vercel.json` es **una línea**: `0 22 * * *` → `0 6 * * *`. `$schema`, `buildCommand`, el número de entradas de `crons` y el `path` **idénticos**. Las tres guardias hacen `toEqual` sobre el `JSON.parse` del fichero **entero** y pasan; mutado a mano a `0 7 * * *` se ponen **rojas** (ver CA-3) | ✅ |
| CA-2 | La expresión declara **una sola ejecución diaria a hora fija**; eficacia en los dos sentidos (`0,30 6 * * *` y `0 */6 * * *` sí; `0 6 * * *` y `30 11 * * *` no) | `vercel.json` (la expresión) | `tests/spec059-hora-del-ciclo.ts` → `declaraUnaEjecucionDiariaAHoraFija`; `tests/spec059-hora-del-ciclo.test.ts` *«el detector caza…»*, *«y NO caza…»*, *«la cadencia declarada en vercel.json…»* | Los dos sentidos ejercitados por el test sobre los cuatro especímenes del CA, **y además contra el fichero real**: con `0,30 6 * * *` en `vercel.json` el caso *«la cadencia declarada…»* se pone **rojo**; con `30 11 * * *` —el destino pactado en ADR-039 pto. 4— sigue **verde**. El detector no teclea la hora: mira la forma de los cinco campos y su rango | ✅ |
| CA-3 | Las **tres** guardias que congelan `vercel.json` entero se **re-congelan** al valor nuevo, sin relajar ni derivar del propio fichero; qué vigilaban antes / ahora, escrito aquí | `tests/deploy-gate-workflow.test.ts`, `tests/spec-031-frontera.test.ts`, `tests/version-bump-gate.test.ts` (solo el valor del `schedule`) | ellos mismos; antes/ahora escrito abajo en «Las tres guardias re-congeladas» | Leídas una a una: las tres siguen con `toEqual` sobre el `JSON.parse` del fichero **entero** —ni `toContain`, ni `objectContaining`, ni valor derivado del propio `vercel.json`— y el diff de cada una es **una línea**, la del literal del `schedule`. Los dos sentidos **ejecutados por el verificador**: con el árbol de la entrega, verdes; con `vercel.json` mutado a mano a `0 7 * * *`, **rojas las tres** (y con ellas CA-4, que deriva). `tests/spec043-sin-refrescar.test.ts` **verde y sin una línea tocada**. Antes/ahora escrito abajo | ✅ |
| CA-4 | `docs/despliegue.md` §3.3: el bloque JSON **derivado** coincide con `crons`, con centinela; y la nota de plan recoge Hobby (minuto arbitrario, día no garantizado) vs Pro (clavado) | `docs/despliegue.md` §3.3 (bloque JSON + nota de plan) | `tests/spec059-hora-del-ciclo.ts` → `cronsDelRunbook`; `tests/spec059-hora-del-ciclo.test.ts` *«el extractor devuelve el bloque de VERDAD…»*, *«el bloque JSON de §3.3, parseado, ES el `crons`…»*, *«la nota de plan recoge lo MEDIDO…»* | El caso **deriva las dos mitades** y no teclea la hora. Los dos sentidos ejecutados: mutado el bloque JSON de §3.3 a `0 9 * * *` → **rojo**; mutado `vercel.json` → **rojo**. Centinela ejercitado sobre cuatro especímenes sintéticos (bloque ausente, JSON no parseable, sección equivocada, `crons` vacío) → `null`, no `[]`. La nota de plan trae *Hobby*, *Pro*, *minuto*, *no garantiza*, `2026-08-24` y *clavado*, y el *«nos vale»* ya no está | ✅ |
| CA-5 | `src/lib/market/sin-refrescar.ts` deja de llevar una **segunda copia** del valor: nombra el fichero dueño, no la hora; eficacia en los dos sentidos | `src/lib/market/sin-refrescar.ts` (comentario de `HORAS_POR_CICLO`) | `tests/spec059-hora-del-ciclo.ts` → `copiasDelSchedule`; `tests/spec059-hora-del-ciclo.test.ts` *«el detector caza una copia…»*, *«y NO caza nombrar al dueño…»*, *«…sigue nombrando al fichero que posee la hora»* (centinela), *«…y no lleva ni una copia del schedule»* | Reintroducida **a mano** en el comentario de `HORAS_POR_CICLO` la copia *«el cron de `vercel.json` es `0 6 * * *`»* → **rojo**. El otro sentido: las tres menciones legítimas —incluida la aritmética `UMBRAL_SIN_REFRESCAR_HORAS * 60 * 60 * 1000` que escribe el propio módulo vigilado— **no** se cazan. Centinela vivo: el módulo sigue nombrando `vercel.json` y sigue diciendo la premisa *«uno al día»* | ✅ |
| CA-6 | Ningún texto visible nombra franja horaria del ciclo (*«sin esperar a la noche»* fuera); `CADENCIA_LINEA` y `AVISO_LO_EMITE_EL_CICLO` **sin tocar** y sus guardias verdes | `src/lib/help/content.ts` (copia + comentario del ejemplo), `src/app/vigiladas/actions.ts` (comentario) | `tests/spec059-hora-del-ciclo.ts` → `franjasHorariasEn`; `tests/spec059-hora-del-ciclo.test.ts` *«el detector caza las frases…»*, *«y NO caza la cadencia…»*, *«el barrido encuentra copia de verdad»* (centinela), *«la copia visible no nombra ninguna franja horaria»*, *«las dos frases que NO cambian…»* | Reintroducida **a mano** *«sin esperar a la noche»* en `CADENCIA.parrafos` → **rojo**. El otro sentido: *«cada mañana»* y *«esperar a mañana»*, que están en la copia de hoy y hablan de un día, **no** se cazan. El barrido es **recursivo sobre todo el módulo exportado**, no una lista de constantes, con centinela que exige encontrar dentro las dos frases con guardia propia. `CADENCIA_LINEA` y `AVISO_LO_EMITE_EL_CICLO` **no están en el diff**; `tests/ayuda-contenido.test.ts` verde en la batería y `tests/e2e/ayuda.spec.ts` + `tests/e2e/primera-pantalla.spec.ts` → **50 passed** sin una línea tocada. Barrido propio del verificador por `src/`: ningún otro texto visible nombra franja horaria | ✅ |
| CA-7 | El hueco de transición no supera `UMBRAL_SIN_REFRESCAR_HORAS`. **Con `0 6 * * *`: 31 h 12 min contra 36 h → se cumple con holgura y el merge no tiene condición de horario.** Por recálculo, **sin guardia permanente** | Recálculo escrito abajo en «El hueco de transición, recalculado» | n-a (a propósito) | **Recalculado por el verificador con el módulo del proyecto**, no con un arné propio: importando `UMBRAL_SIN_REFRESCAR_HORAS` de `@/lib/market/sin-refrescar` (36, derivado de 24 × 1,5) y leyendo el `schedule` de `vercel.json`. `22:48 D-1 → 06:00 D+1` = **31,2 h** < **36 h**, holgura **4,8 h** → **no cruza**, el merge no tiene condición de horario. Contraste con la opción (C): `0 12 * * *` = **37,2 h** → **sí cruza**. El fichero de medida se borró y el árbol quedó limpio | ✅ |
| CA-8 | **Observación post-deploy**: dos filas de `cron_runs` **a las 06:00 UTC** con `outcome=success`, y `as_of` = D-1 contrastado con un símbolo y su serie; desenlace de ADR-039 pto. 4 si sigue D-2. **Es la condición de la hora elegida, no un extra** | Pendiente del merge — nada que implementar | n-a (no automatizable) | **No verificable antes del merge, y está escrito como tal en los dos sitios**: la spec lo dice en voz alta y `tests/spec059-hora-del-ciclo.test.ts` lo declara en su cabecera. **Lo que el verificador sí comprobó es lo contrario**: ningún caso de la batería finge cubrirlo — no hay ningún test que afirme nada sobre qué `as_of` traerá el proveedor. El procedimiento post-merge (4 pasos, con el desenlace de ADR-039 pto. 4) está escrito en el handoff | ⚠️ pendiente post-deploy |
| CA-9 | `docs/roadmap.md`: las dos frases en **pasado** no se tocan; la que está en **presente** (*«el aviso sigue saliendo a las 22:00»*) deja de nombrar la hora. Sin guardia | `docs/roadmap.md` línea ~39 | n-a (ADR-037) | Por diff: **una sola línea tocada**, la del presente — *«sigue saliendo a las 22:00»* → *«sigue saliendo en el ciclo diario»*. Las dos en pasado (líneas 16 y 18: *«era el cron `0 22 * * *`»*, *«Entre el alta y las 22:00 había»*) están **intactas**, y el párrafo que las contiene se declara a sí mismo *«el estado ANTES de esa entrega»*. `grep` sobre el roadmap: no queda **ninguna** afirmación en presente que nombre la hora del ciclo. Sin guardia, como pide el CA | ✅ |
| CA-10 | Ledgers, ADR y `dominio.md` que citan las 22:00 **en pasado** no se tocan. Criterio de gate (`RI-03`), por `git diff --name-only`. **Sin guardia** (ADR-037) | El diff de la rama; comprobación escrita abajo en «El diff, acotado» | n-a (a propósito) | `git diff --name-only origin/main...HEAD` = **17 ficheros**, exactamente los que el ledger lista. `SPEC-004.ledger`, `SPEC-035.ledger`, `SPEC-039.ledger`, `SPEC-058`, `ADR-038`, `docs/fundacion/dominio.md` y `tests/spec043-sin-refrescar.test.ts` **no aparecen**: sus citas en pasado siguen intactas. **Salvedad, ver abajo**: `ADR-004` sí aparece, y el CA lo nombra entre los que no se tocan | ⚠️ con salvedad declarada |
| CA-11 | Subida de versión **patch** con los dos ficheros en el mismo commit (ADR-033) y `version:check` sobre árbol limpio (SPEC-049) | `package.json` + `package-lock.json` (0.5.0 → **0.5.1**, mismo commit) | `tests/version-en-los-dos-ficheros.test.ts` (SPEC-053 CA-1) y `npm run version:check` sobre árbol limpio | `0.5.0` → `0.5.1` (**patch**), los dos ficheros en el **mismo commit** (`50daa71`, y solo esos dos), con `package-lock.json` coherente en `version` y en `packages['']`. `npm run version:check` **con el árbol limpio** (verificado con `git status` vacío antes de correrlo): *«La version sube de 0.5.0 a 0.5.1»* — un verde con contenido, no la abstención de SPEC-049 | ✅ |

## Las tres guardias re-congeladas (CA-3)

FOUNDATION, 3.ª convención: *«queda escrito en el ledger qué vigilaba antes y qué vigila
ahora»*. Las tres comparaban el `vercel.json` **entero** contra un literal que incluía
`schedule: '0 22 * * *'`, y las tres se pusieron **rojas** en cuanto la hora se movió — que es
exactamente su trabajo. **Se re-congelan al valor nuevo**: en cada una se cambió **el valor del
`schedule` y nada más**.

| Fichero (caso) | Qué vigilaba antes | Qué vigila ahora |
|---|---|---|
| `tests/deploy-gate-workflow.test.ts` *9.2* — «vercel.json sigue siendo exactamente lo que era» | El fichero entero tal y como quedó tras SPEC-032, con `0 22 * * *`: **SPEC-028 no lo tocó** | Lo mismo con la hora nueva: **ningún cambio se cuela sin un CA que lo pida**, y el CA que lo pidió es **CA-1 de SPEC-059** |
| `tests/spec-031-frontera.test.ts` *CA-13.2* — «vercel.json solo cambia cuando una spec lo cambia» | El mismo literal: **SPEC-031 no tocó este fichero** | El mismo literal con la hora nueva; la propiedad de SPEC-031 sigue en pie |
| `tests/version-bump-gate.test.ts` — «vercel.json no cambia por culpa de este gate» | El mismo literal: el **gate de versión** de SPEC-038 no se coló en el `vercel.json` | El mismo literal con la hora nueva; el gate de versión sigue sin tocar el fichero |

Lo que **no** se hizo, porque CA-3 lo prohíbe con esas palabras: no se convirtió ninguna
comparación en parcial, no se relajó ninguna a `toContain` / `objectContaining`, y **no se derivó
el valor esperado del propio `vercel.json`** — eso sería congelar el fichero contra sí mismo y
dejar las tres verdes de vacío.

**Eficacia comprobada en los dos sentidos, y las dos direcciones se ejecutaron de verdad:**

1. Con las guardias ya al valor nuevo y `vercel.json` todavía en `0 22 * * *`: **3 failed, 129
   passed**, y el diff del error señalaba exactamente el `schedule`.
2. Con el árbol de la entrega y el `schedule` de `vercel.json` cambiado **a mano** a
   `0 7 * * *`: **3 failed, 129 passed** otra vez.

Con el árbol de la entrega intacto: **3 passed**. Y `tests/spec043-sin-refrescar.test.ts` sigue
**verde sin una línea tocada** — mira solo los tres campos de calendario, no el literal: la
diferencia entre vigilar una propiedad y congelar una foto, con las dos formas en el mismo
repositorio y a la vista.

**Esta entrega no añade un cuarto literal.** `tests/spec059-hora-del-ciclo.test.ts` comprueba
**propiedades** —una ejecución diaria a hora fija, un solo cron— y **no teclea la hora**: la
comparación estructural del fichero entero que CA-1 pide ya la hacen esas tres guardias, y
**ADR-039 pto. 8** quiere que la próxima vez que la hora se mueva se toque lo menos posible.

## El hueco de transición, recalculado (CA-7)

**El umbral se lee de su único hogar, no se teclea.** Derivado de
`src/lib/market/sin-refrescar.ts`: `HORAS_POR_CICLO` = **24** y `CICLOS_HASTA_SIN_REFRESCAR` =
**1,5**, luego `UMBRAL_SIN_REFRESCAR_HORAS` = **36 h** (RN-16).

Peor caso, el que fijan la spec y ADR-039 pto. 6: **el despliegue se come la ejecución del día en
curso**, así que la última escritura del horario viejo es la de anoche a las **22:48 UTC** —la
hora real de las filas de `cron_runs` en Hobby, no las 22:00 declaradas— y la primera del nuevo
es la de **D+1 a las 06:00 UTC**.

| Magnitud | Valor |
|---|---|
| Última escritura del horario viejo | `D-1 22:48 UTC` |
| Primera escritura del horario nuevo | `D+1 06:00 UTC` |
| **Hueco de transición** | **31 h 12 min** |
| Umbral de RN-16 (derivado, no tecleado) | 36 h |
| ¿Cruza? | **No** — holgura de **4 h 48 min** |

**Conclusión: el merge NO tiene condición de horario.** Se puede mergear a cualquier hora sin que
el universo aparezca marcado *sin refrescar* una mañana sin que nada esté roto.

Y queda escrito porque es **el mismo control que hay que repetir** si CA-8 obliga a mover la hora
a ≥ 11:05 UTC (**ADR-039 pto. 4**): con `0 12 * * *` el hueco sería de **37 h 12 min**, cruzaría
el umbral por 1 h 12 min, y ese segundo merge tendría que ir **después** del ciclo de esa noche.

**Sin guardia permanente, a propósito**: es una propiedad del **momento de la entrega**, no del
producto, y dejarla en la batería sería congelar cómo estaba el árbol el día del merge — el
patrón que FOUNDATION prohíbe en su 3.ª convención.

## El diff, acotado (CA-10)

`git diff --name-only origin/main...HEAD` sobre la rama, **diecisiete ficheros** y ni uno más:

```
docs/adr/ADR-004-cadencia-diaria-y-base-no-ajustada-de-la-ingesta-persistencia-de-cotizaciones.md
docs/adr/ADR-039-la-hora-del-ciclo-la-fija-cuando-publica-el-proveedor-....md
docs/despliegue.md
docs/epicas/EPIC-FIX/SPEC-059-....ledger.md
docs/epicas/EPIC-FIX/SPEC-059-....md
docs/roadmap.md
package-lock.json
package.json
src/app/vigiladas/actions.ts
src/lib/help/content.ts
src/lib/market/sin-refrescar.ts
tests/deploy-gate-workflow.test.ts
tests/spec-031-frontera.test.ts
tests/spec059-hora-del-ciclo.test.ts
tests/spec059-hora-del-ciclo.ts
tests/version-bump-gate.test.ts
vercel.json
```

**La evidencia histórica no se reescribe.** `SPEC-004.ledger`, `SPEC-035.ledger`,
`SPEC-039.ledger`, `SPEC-058`, `ADR-038` y `docs/fundacion/dominio.md` citan `0 22 * * *` o *«el
cron de las 22:00»* **en pasado**: eran ciertos cuando se escribieron —y son lo que permitió
encontrar este defecto—, así que **no están en el diff**. Tampoco lo está
`tests/spec043-sin-refrescar.test.ts`. Los dos ADR que sí aparecen son los del gate del
2026-09-03 —**ADR-039**, que nace con esta spec, y la aprobación de **ADR-004**— y entraron en el
commit de la spec, antes de la implementación.


## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-09-03, `sdd-verificador`.** 9 CA en ✅ y 2 en ⚠️, las dos con su salvedad
justificada, declarada por escrito antes de llegar aquí y aceptada en el gate humano del
2026-09-03. Ninguna de las dos es un «casi».

### Los gates, corridos por el verificador sobre la rama

| Gate | Resultado |
|---|---|
| `npm run typecheck` | verde |
| `npm run lint` (`--max-warnings=0`) | verde |
| `npm test` | **121 ficheros, 1952 casos, 0 fallos** |
| `npx playwright test tests/e2e/ayuda.spec.ts tests/e2e/primera-pantalla.spec.ts` | **50 passed** |
| `npm run version:check` **con `git status` vacío** | verde, `0.5.0 → 0.5.1` |

La e2e reescribió capturas de `_qa/SPEC-039` y `_qa/SPEC-050` que **no son de esta spec**: se
restauraron con `git checkout -- _qa/` y el árbol quedó limpio. Esta entrega no genera evidencia
visual propia.

### Lo que se comprobó ejecutando, y no leyendo

Ninguna guardia de esta entrega se dio por buena porque estuviera verde. Las cinco que congelan o
detectan algo se pusieron **rojas a mano** antes de aceptarlas —una guardia que solo se comprueba
en un sentido no está comprobada—:

| Mutación aplicada al árbol | Qué se puso rojo |
|---|---|
| `vercel.json` → `0 7 * * *` | las **tres** guardias de CA-3 **y** el caso derivado de CA-4 (4 ficheros); `tests/spec043-sin-refrescar.test.ts` siguió **verde**, que es su encuadre correcto |
| `vercel.json` → `0,30 6 * * *` | CA-2 *«la cadencia declarada…»* |
| `vercel.json` → `30 11 * * *` (destino de ADR-039 pto. 4) | **nada**: sigue verde, como tiene que ser |
| bloque JSON de `docs/despliegue.md` §3.3 → `0 9 * * *` | CA-4 (el lado del runbook) |
| copia del `schedule` reintroducida en `sin-refrescar.ts` | CA-5 |
| *«sin esperar a la noche»* reintroducida en `CADENCIA.parrafos` | CA-6 |

Y **CA-7 se recalculó con el módulo del proyecto**, importando `UMBRAL_SIN_REFRESCAR_HORAS` en
vez de teclear 36: **31,2 h** de hueco contra **36 h**, holgura de **4,8 h**; la opción (C)
descartada daría **37,2 h** y sí cruzaría. El fichero de medida se borró al terminar.

### Las dos salvedades, dichas enteras

1. **CA-8 queda abierto, y el veredicto no lo tapa.** Es observación post-deploy y así está
   escrito en la spec y en la cabecera de `tests/spec059-hora-del-ciclo.test.ts`. Lo que este
   verificador sí buscó —y no encontró— es lo contrario: **ningún caso de la batería finge
   probar qué `as_of` traerá el proveedor**. El GREEN es sobre *«la hora declarada es la
   aprobada y nada en el repositorio dice otra cosa»*, que es exactamente lo que la batería
   puede sostener. **Esta spec pasa a `hecho` con una deuda nombrada**: las dos filas de
   `cron_runs` del handoff. Quien las mire y vea D-2 aplica ADR-039 pto. 4 y **rehace CA-7**,
   porque a ≥ 11:00 UTC el hueco sí cruza el umbral de RN-16.
2. **CA-10 se cumple en la propiedad y tiene una excepción en la letra.** La propiedad —*«la
   evidencia histórica no se reescribe»*— está **entera**: ni una de las citas en pasado de
   `SPEC-004.ledger`, `SPEC-035.ledger`, `SPEC-039.ledger`, `SPEC-058`, `ADR-038` ni
   `docs/fundacion/dominio.md` aparece en el diff. La excepción es **`ADR-004`**, que el CA
   nombra entre los intocables y que **sí** está en el diff: solo su **frontmatter**
   (`borrador` → `aprobada`, con su línea de historial), que es la transición que **§Notas para
   el gate humano pto. 3 de esta misma spec ordena**, entró en el commit del arquitecto
   (`d1e3cdb`) **antes de la implementación** y está declarada en «El diff, acotado». Su cuerpo
   no cambia — y, comprobado, **ADR-004 no contiene ninguna cita del horario**: la lista del CA
   lo incluyó de más. No hay evidencia falseada, así que no es motivo de RED; queda ⚠️ y escrito
   para que nadie lo lea como un descuido dentro de seis meses.

### Lo que este verificador NO puede afirmar

Que el ciclo ya trae el cierre de la sesión anterior. Eso no lo dice la batería, no lo dice este
veredicto y no lo va a decir ningún test: lo dirán dos filas de `cron_runs`.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-059/. Informe HTML opcional: _qa/SPEC-059/informe.html -->

Esta spec **no genera evidencia visual**: no cambia ninguna pantalla. La evidencia de CA-8 es
**tabular** (filas de `cron_runs` y de `quotes`) y va escrita en este ledger, no en capturas.

## Salvedades / follow-ups
<!-- IDs F-SPEC-059-1, F-SPEC-059-2… con destino (spec futura o EPIC-MEJORA). -->

Abiertas ya desde el diseño (las dos nacen en ADR-039 y se anotan aquí para que no se pierdan):

- **F-ADR-039-1 — la hora de publicación del proveedor sigue sin medir.** La evidencia solo acota
  la ventana abierta `(22:48, 11:05)` UTC. Medirla cuesta un sondeo por horas durante varios días
  y **consume cuota** (ADR-027 pto. 1). Destino: spec de observabilidad del ciclo.
- **F-ADR-039-2 — nadie vigila que el `as_of` que escribe el ciclo sea el de la sesión anterior.**
  Es lo que cazaría este defecto si el proveedor volviera a mover su hora de publicación. Destino:
  **EPIC-MEJORA** (capacidad nueva; EPIC-FIX restaura, no añade).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Hecho: CA-1 a CA-7, CA-9, CA-10 y CA-11.** La implementación está completa en la rama
`ft/SPEC-059-el-ciclo-diario-deja-de-traer-el-cierre-de-anteayer-la-hora-del-cron-se-mueve-a-la-manana-utc`,
con todos los commits marcados `Refs: SPEC-059`, **sin push y sin PR** — eso es del orquestador.

Los gates, ejecutados en este orden y todos verdes:

| Gate | Resultado |
|---|---|
| `npm run typecheck` | verde |
| `npm run lint` | verde (`--max-warnings=0`) |
| `npm test` (unit) | **121 ficheros, 1952 casos, 0 fallos** |
| e2e de las guardias de CA-6 (`ayuda`, `primera-pantalla`, `spec058-alta-con-precio`) | **52 passed** |
| `npm run version:check` **sobre árbol limpio** | verde, con el bump ya commiteado |

Dos cosas que conviene saber antes de repetirlos:

- **El gate de versión juzga commits, no el árbol** (SPEC-049): con el árbol sucio se abstiene, y
  un verde de abstención no es un verde. Se ejecutó **después** de commitear el bump.
- **La e2e reescribió capturas de `_qa/` de SPEC-039, SPEC-050 y SPEC-058.** Se restauraron con
  `git checkout -- _qa/`: esta spec **no genera evidencia visual** y reescribir las capturas
  ajenas sería falsear la evidencia de otras entregas.

**Lo único que falta antes del merge es la revisión**: `sdd-verificador` sobre CA-1…CA-6 (batería),
CA-7 (recálculo escrito arriba) y CA-10 (diff). **CA-8 no se puede cerrar aquí y no se va a
fingir que sí.**

### Lo que hay que hacer DESPUÉS del merge, y sin lo cual esta spec no está hecha (CA-8)

Mergear **es** desplegar (ADR-018 / SPEC-028), y el cron nuevo entra en vigor con ese despliegue.
La cuenta está en **Pro**, así que la fila tiene que aparecer **clavada**:

1. Mirar las **dos primeras** filas de `cron_runs` bajo el horario nuevo. Deben salir a las
   **06:00 UTC**, con `outcome = success` y `finished_at` **no nulo**.
2. Mirar el `as_of` de las cotizaciones que esas ejecuciones escribieron: tiene que ser el cierre
   de la **sesión anterior (D-1)**, no de dos sesiones antes. Se contrasta con **al menos un
   símbolo** y su serie, igual que se hizo con `WEN` para levantar el defecto.
3. **Anotar aquí** fecha, hora de la fila y `as_of` observado de las dos. Sin eso la decisión
   queda sin evidencia y el siguiente tendrá que volver a medirlo todo.
4. **Si las dos siguen escribiendo D-2**, la hora cayó dentro del hueco de publicación: se aplica
   **ADR-039 pto. 4** —mover a una hora probada, ≥ 11:05 UTC, **sin ADR nuevo**— y entonces **hay
   que rehacer CA-7**, porque con ≥ 11:00 UTC el hueco de transición **sí** cruza el umbral de
   RN-16 y ese segundo merge tiene que ir **después** del ciclo de esa noche.

Mover la hora otra vez, si toca, cuesta **cuatro ficheros**: `vercel.json`, las tres guardias que
lo congelan (`deploy-gate-workflow` 9.2, `spec-031-frontera` CA-13.2, `version-bump-gate`). El
runbook, `sin-refrescar.ts` y la copia visible **ya no hay que tocarlos**: derivan el valor o
nombran a su dueño, que es lo que CA-4, CA-5 y CA-6 acaban de comprar.

**La spec no se puede dar por hecha hasta que esas dos filas estén en este ledger.**
