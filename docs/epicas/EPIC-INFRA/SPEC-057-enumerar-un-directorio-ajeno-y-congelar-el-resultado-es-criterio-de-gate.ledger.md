---
id: SPEC-057
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-057 Enumerar un directorio ajeno y congelar el resultado es criterio de gate

## Resumen
- Fase: **en revisión** — spec y `ADR-037` **aprobados por el humano (Alberto Fojo) el
  2026-08-25**. **CA-1, CA-2 y CA-4 implementados** ese mismo día por sdd-implementador.
  **CA-3 lo escribió el arquitecto ese mismo día**, tras la escalada correcta del
  implementador: `FOUNDATION.md` es documento locked y su pluma es del arquitecto en el
  gate (ADR-025, y la propia letra de CA-3). `F-SPEC-057-4` queda **cerrado**; se conserva
  entero porque documenta la contradicción interna de este ledger y cómo se resolvió.
- Rama: `ft/SPEC-057-enumerar-un-directorio-ajeno-y-congelar-el-resultado-es-criterio-de-gate`
  (creada desde `origin/main` = `778f189`).
- **Saldo comprometido: −2 comprobaciones / +0.** Es condición de aceptación
  (CA-4), no una aspiración. Si al implementar el saldo deja de ser negativo, se
  escala al gate antes de seguir.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (la retirada, con las cuatro condiciones) | `tests/tarjeta-guardias-ampliadas.test.ts` — **retirado** el bloque `SPEC-051 CA-17.1` entero (111-139 en `778f189`) con sus **dos** casos; en su hueco, el porqué en prosa (**91-162** del árbol entregado); **cabecera corregida** (**29-39**); y los ocho símbolos que quedaban sin uso, fuera. Único fichero de código tocado | **n-a a propósito** — lo que sustituye al bloque es **prosa en el sitio** (cond. 2). Un test en su lugar sería el verde vacío que ADR-031 prohíbe; molde `F-SPEC-042-9` y SPEC-053 CA-13 | **Leído el fichero entero en el árbol entregado (2026-08-25).** **(1)** El diff tiene **4 hunks** y ninguno cae por debajo de la línea 166: fuera el `describe('SPEC-051 CA-17.1…')` con sus **dos** casos y nada más; los ocho símbolos huérfanos que se eliminan son **exactamente** los ocho que la §Nota mecánica de CA-1 pre-autoriza (`readdirSync`, `statSync`, `relative`, `testsDir`, `rel`, `NO_SE_TOCA`, `PROPIOS`, `fuentesDeTests`), y `casos()`, `sinComentarios()`, `caso()`, `fuente()` y `GUARDIAS` siguen ahí. **(2)** El porqué está **en el sitio** (91-162), con los seis puntos exigidos y con **fecha y autorización nominal del humano (Alberto Fojo) del 2026-08-25**, y diciendo que lo redacta el arquitecto. La **cabecera corregida** (29-39) es **cierta hoy**: los `describe` que quedan son 17.2, 17.3 y 17.4, exactamente lo que anuncia. **(3)** Los **10** casos restantes verdes (`npx vitest run tests/tarjeta-guardias-ampliadas.test.ts` → `10 passed`), **cero líneas tocadas** por debajo del hueco; `grep` de `.skip`/`.only`/`.todo` sólo acierta dentro de la prosa; **ninguna exclusión por nombre añadida** —al contrario, `NO_SE_TOCA` y `PROPIOS` desaparecen—. **(4)** Nada protegido se debilita: 17.2, 17.3 (con su mutación de control) y 17.4 (`PUBLIC_PREFIXES` + las doce rutas) intactos | ✅ |
| CA-2 (recuento y suite verde) | — (no hay código que implementar: es el efecto de CA-1) | `npx vitest run` — **antes 1897 / después 1895**, Δ **−2**; **116 ficheros verdes, cero rojos**; el fichero tocado pasa de **12** a **10**. Detalle en §Recuentos | **Ejecutado por el verificador (2026-08-25): `npx vitest run` → `116 passed (116)` / `1895 passed (1895)`, cero rojos**, sin ningún fichero aislado y sin ningún flake. El **12 de partida está medido, no deducido**: el blob de `778f189` del fichero se extrajo a un directorio fuera del árbol y se corrió con `npx vitest run --root <scratch>` → **`12 failed (12)`** (fallan por no encontrar `src/`, que es irrelevante: lo que se medía era el **registro** de casos). El de llegada, medido: **`10 passed (10)`**. Δ = **−2**, exactamente los dos retirados. Y **ningún otro fichero de `tests/` puede haber cambiado**: `git diff --name-status origin/main...HEAD` sólo lista `tests/tarjeta-guardias-ampliadas.test.ts`; `git diff --name-only … -- .github/ scripts/ src/ app/ drizzle/ tests/e2e/` devuelve **0**. `npm run lint` y `npm run typecheck`, sin salida y sin error | ✅ |
| CA-3 (la regla escrita, con su fuente) | **Los tres, y los tres del arquitecto**: `docs/adr/ADR-037-*.md` (aprobado el 2026-08-25); `FOUNDATION.md` **3.er corolario** datado 2026-08-25, pegado a los otros dos, al final de § *Cómo se trabaja aquí*; `docs/fundacion/reglas.md` **`RI-03`**, párrafo *«Precisión del 2026-08-25»* con **Fuente: ADR-037** y sin `RI-04`. Escritos por sdd-arquitecto tras la escalada `F-SPEC-057-4`, no por la implementación (ADR-025) | **n-a a propósito** — no se añade un test que compruebe que un documento contiene una frase: sería una casilla, y esta spec no añade comprobaciones (CA-4) | **Leídos los dos documentos, y comprobada una a una cada referencia que hacen** —no se dan por buenas por sonar bien—. **Pto. 1**: el 3.er corolario está en `FOUNDATION.md` **dentro de** § *Cómo se trabaja aquí* (única sección desde la línea 80 hasta el final) y **pegado al segundo**, no en sección nueva; datado 2026-08-25. Sus afirmaciones **son ciertas**: (a) los **dos incidentes** — `ADR-033` cita `F-SPEC-050-4` en tres sitios (líneas 21, 47, 247), y la propia prosa de retirada de `tests/primera-pantalla-fuente.test.ts:313-350` confirma que ése fue el disparo de SPEC-050 CA-20; el segundo se lee en el código de `778f189:tests/tarjeta-guardias-ampliadas.test.ts:112-132`; (b) las **cuatro formas que sobreviven**, cada una contra su fichero real: vacío → `tests/revision-movil-en-tests.test.ts:114` (`toEqual([])`), por elemento → `tests/version-bump-gate.test.ts:1021-1030` (`readdirSync().filter(.mjs)` + `toBe(false)` por elemento, con su centinela `toBeGreaterThan(0)`), pertenencia/prefijo → `tests/spec-032-frontera.test.ts:121,151,179`, búsqueda por nombre → `tests/version-bump-gate.test.ts:924` `readdirSync(dir).find(n => n.startsWith(\`${id}-\`))` invocado como `adr('ADR-024')` en la línea 1013; (c) **la autocita es real**: `FOUNDATION.md:107` ya nombraba `tests/spec-032-frontera.test.ts` entre *«los tres encuadres buenos que este proyecto ya tiene, y que sirven de molde»*, así que *«uno de los inocentes es el ejemplo que este documento pone de correcto»* **se sostiene**; (d) la referencia al 2.º corolario (*«enumerar formas prohibidas está prohibido»*) existe literalmente en la línea 163. **Pto. 2**: `RI-03` (`docs/fundacion/reglas.md`:114-161) conserva su número —`grep "RI-0"` da **RI-01, RI-02, RI-03 y nada más**—, cierra con **Fuente: ADR-037, que precisa ADR-031 pto. 1 y no lo supersede**, y declara que las condiciones (1)-(4) siguen siendo para guardias con `git` **salvo el centinela de no-vacuidad**. **Pto. 3**: los dos documentos dicen la ausencia de mecanismo **expresamente y con su porqué** —`FOUNDATION.md`: *«Y esto NO lleva guardia, a propósito»*; `RI-03`: *«Esta mitad NO lleva meta-guardia, y es decisión registrada, no olvido»*—, y ninguno afirma que exista una para esta familia. **Y el criterio invertido se cumple: cero tests, cero `toContain` y cero steps que vigilen estos párrafos** | ✅ |
| CA-4 (el saldo, −2 / +0) | — | **Saldo −2 / +0**, medido contra `778f189`: dos casos de `vitest` retirados, **cero** añadidos; ni un fichero nuevo en `tests/`, ni en `tests/e2e/`, ni un script en `scripts/`, ni un step en `.github/workflows/ci.yml`, ni un `toContain` sobre un documento | **Saldo verificado: −2 / +0.** Retiradas: los dos casos medidos arriba. Añadidas: **cero**, y se comprobó de dos maneras. (a) Estructural: `git diff --name-only origin/main...HEAD -- .github/ scripts/ src/ app/ drizzle/ tests/e2e/` → **0 ficheros**; no hay fichero nuevo en `tests/`, ni script de gate, ni step de CI. (b) Textual, que es la que caza el `toContain` de contrabando: `git diff origin/main...HEAD -- tests/ | grep '^+' | grep -E 'expect\(|it\(|describe\(|test\('` devuelve **una sola línea, y es prosa** —el `* describe('SPEC-051 CA-17.1…')` citado dentro del comentario de la retirada—. **Ni una aserción, ni un caso, ni una casilla añadida en toda la entrega** | ✅ |
| CA-5 (acotación) | **n-a** | **n-a — por ADR-031 pto. 1.2 / `RI-03`, con el porqué escrito debajo; no es una omisión** | **Diff revisado con el árbol limpio** (`git status --short` sin salida). **Seis** ficheros, y los seis están en el conjunto permitido; **ninguno bajo `src/`, `app/`, `drizzle/` ni `scripts/`**; **ningún otro fichero de `tests/`**; y los tres dictaminados sanos más `tests/spec-032-frontera.test.ts` **no aparecen**. Salida pegada en §Acotación. `npm run version:check` sobre el árbol limpio: *«El diff no toca codigo de aplicacion: no hay nada que subir»*, y `package.json` sigue en **0.4.2** igual que en `origin/main` — el alcance **no** se ha desviado | ✅ |

> **CA-5 no lleva fila de test a propósito, y su `n-a` no está en blanco por
> descuido.** *«Este cambio está bien acotado»* es cierto sobre un **delta** y su
> sitio es el gate. Codificarlo como test —barriendo `tests/` y congelando qué
> ficheros nombran a `SPEC-057`— sería **literalmente el defecto que esta spec
> persigue**, escrito por la spec que lo persigue. Lo mismo vale, por otra razón,
> para el `n-a` de CA-1 (lo que sustituye al caso retirado es prosa) y el de CA-3
> (un `toContain` sobre un documento es una casilla).

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-25, sdd-verificador.** **5/5 CA cerrados**: tres con verificación
ejecutada (CA-1, CA-2, CA-4), uno leído documento a documento (CA-3) y uno declarado
`n-a` a propósito y verificado como acotación (CA-5). Ningún `⚠️`, ninguna salvedad
bloqueante.

**Gates automáticos, todos sobre el árbol entregado y limpio:** `npx vitest run` →
**116 ficheros / 1895 casos, cero rojos** (una sola corrida, sin flakes y sin necesidad
de aislar ningún fichero de Postgres efímero); `npm run lint` (`eslint . --max-warnings=0`)
sin salida; `npm run typecheck` (`tsc --noEmit`) sin salida; `npm run version:check`
sobre el árbol limpio confirma que no hay bump que hacer. **No se corrió la e2e**: esta
spec no tiene superficie de UI y correrla habría reescrito capturas ajenas bajo `_qa/`.

**El saldo, que era la vara de esta spec: −2 / +0, y las dos cifras están medidas.** El
**12** de partida no se dedujo del ledger de SPEC-051 ni del conteo a ojo: el blob de
`778f189` se extrajo fuera del árbol y se ejecutó con `vitest --root`, que registró
**12** casos; el árbol de llegada registra **10**, verdes. **+0 comprobado por texto**,
no sólo por estructura: el único `+` del diff de `tests/` que contiene `expect(`, `it(`,
`describe(` o `test(` está **dentro de un comentario**.

**Sobre el criterio invertido, que es lo que hacía peligrosa esta entrega.** Se buscó
activamente el defecto contrario —el celo que se paga como virtud— y **no está**: no hay
test nuevo, ni fichero nuevo en `tests/` o `tests/e2e/`, ni script en `scripts/`, ni step
en `.github/workflows/`, ni un `toContain` que vigile que los párrafos nuevos de
`FOUNDATION.md` o de `RI-03` existen. La regla de ADR-037 llega **sin mecanismo**, que es
lo que ADR-037 pto. 4 decidió, y los dos documentos **dicen que no lo lleva y por qué**
en vez de callarlo.

**Sobre CA-3, que es la entrega duradera y donde se puso el listón más alto.** Este
proyecto ha producido esta semana varias frases de la familia *«suena verificado y no lo
está»*, así que el corolario **no se juzgó por su prosa sino por sus referencias**, una a
una y contra el árbol: los dos incidentes con su disparo (`ADR-033` citando
`F-SPEC-050-4`; el `toEqual` de `778f189`), las **cuatro** formas supervivientes contra
cuatro ficheros reales con línea, y —la más frágil de todas— la **autocita**: *«uno de
los inocentes es `tests/spec-032-frontera.test.ts`, que este mismo documento cita más
arriba como molde correcto»* es **verdad**, y está en `FOUNDATION.md:107`. Ninguna
referencia resultó falsa. La cabecera corregida de
`tests/tarjeta-guardias-ampliadas.test.ts` **también dice hoy algo cierto**: enumera 17.2,
17.3 y 17.4, que son exactamente los tres `describe` que quedan.

**Lo que NO se cuenta como defecto, y por qué**: `F-SPEC-057-5`
(`tests/app-base-url.test.ts`:952-957) quedó **confirmado como prosa**: se leyó el caso
entero y sus dos aserciones son `toBeGreaterThan(0)` sobre `puntos.length` y
`toBe('new URL(appBaseUrl())')` sobre cada punto — **ninguna lee este fichero ni afirma
nada sobre él**, y la suite está verde. Tocarlo lo prohíben CA-1 cond. 3 y CA-5. Queda
anotado con destino. Y `F-SPEC-057-4` está **cerrado**: el implementador escaló en vez de
escribir en un documento locked y el arquitecto lo redactó, que es lo que manda ADR-025;
es precedente, no deuda.

**Nota de alcance, para que conste**: el encargo del gate hablaba de *«cinco ficheros»* y
a continuación nombraba **seis**. El diff tiene **seis**, y son exactamente los seis
nombrados. No hay fichero de más ni de menos; la discrepancia estaba en el recuento del
encargo, no en la entrega.

**Pendiente mecánico, fuera de los CA**: `docs/tablero.md` no se ha regenerado — es el
paso de cierre de `/sdd-tablero` una vez la spec está en `hecho`, y está previsto en
§Cómo retomar pto. 3.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-057/. Informe HTML opcional: _qa/SPEC-057/informe.html -->

**n-a.** Esta spec no toca `src/` ni ninguna superficie de interfaz. No hay nada
que capturar.

## Acotación (CA-5) — el diff de la rama, con el árbol limpio
<!-- Lo pega sdd-verificador. Conjunto permitido, para contrastar uno a uno: -->

Conjunto **permitido** por CA-5 (cualquier fichero fuera de esta lista es RED):

- `tests/tarjeta-guardias-ampliadas.test.ts`
- `docs/adr/ADR-037-enumerar-un-directorio-que-otros-hacen-crecer-y-congelar-el-resultado-es-criterio-de-gate-la-regla-se-escribe-y-no-se-mecaniza-precisa-adr-031-pto-1.md`
- `docs/fundacion/reglas.md`
- `FOUNDATION.md`
- `docs/epicas/EPIC-INFRA/SPEC-057-*.md` y `SPEC-057-*.ledger.md`
- `docs/tablero.md` (generado por `/sdd-tablero`, nunca a mano)

Y **prohibido explícitamente**: cualquier fichero bajo `src/`, `app/`, `drizzle/`
o `scripts/`; **cualquier otro fichero de `tests/`**; y en particular los tres que
la spec dictamina sanos —`tests/revision-movil-en-tests.test.ts`,
`tests/version-bump-gate.test.ts`, `tests/primera-pantalla-fuente.test.ts`— y
`tests/spec-032-frontera.test.ts`, que queda declarado como caso fronterizo y **no
se toca**.

**Verificado por sdd-verificador el 2026-08-25, con el árbol limpio** (`git status
--short` sin salida; `HEAD` = `70a48a8`; base `origin/main` = `778f189`):

```
$ git diff --name-status origin/main...HEAD
M	FOUNDATION.md
A	docs/adr/ADR-037-enumerar-un-directorio-que-otros-hacen-crecer-y-congelar-el-resultado-es-criterio-de-gate-la-regla-se-escribe-y-no-se-mecaniza-precisa-adr-031-pto-1.md
A	docs/epicas/EPIC-INFRA/SPEC-057-enumerar-un-directorio-ajeno-y-congelar-el-resultado-es-criterio-de-gate.ledger.md
A	docs/epicas/EPIC-INFRA/SPEC-057-enumerar-un-directorio-ajeno-y-congelar-el-resultado-es-criterio-de-gate.md
M	docs/fundacion/reglas.md
M	tests/tarjeta-guardias-ampliadas.test.ts

$ git diff --stat origin/main...HEAD
 6 files changed, 1178 insertions(+), 60 deletions(-)

$ git diff --name-only origin/main...HEAD -- .github/ scripts/ src/ app/ drizzle/ tests/e2e/
(vacío)
```

**Seis ficheros, los seis dentro del conjunto permitido.** Ninguno bajo `src/`, `app/`,
`drizzle/` ni `scripts/`; **ningún otro fichero de `tests/`**; y los tres dictaminados
sanos —`tests/revision-movil-en-tests.test.ts`, `tests/version-bump-gate.test.ts`,
`tests/primera-pantalla-fuente.test.ts`— más `tests/spec-032-frontera.test.ts` **no
aparecen en el diff**. `docs/tablero.md` (permitido) queda para el cierre.

Y el **único fichero de código** tocado se revisó hunk a hunk: **4 hunks**, el último
termina en la línea 166 y el `describe('SPEC-051 CA-17.2'…)` empieza en la 164 — es
decir, **por debajo del hueco de la retirada no hay ni una línea modificada**.

## Recuentos (CA-2 y CA-4)
<!-- Los pega sdd-implementador (antes/después) y los confirma sdd-verificador. -->

| | Antes (`778f189` + commit de spec) | Después | Δ |
|---|---|---|---|
| `tests/tarjeta-guardias-ampliadas.test.ts` | **12** casos | **10** casos | **−2** ✅ |
| Suite entera (`npx vitest run`) | **1897** casos, **116** ficheros | **1895** casos, **116** ficheros | **−2** ✅ |
| Resto de `tests/**` (1897 − 12 = 1885 / 1895 − 10 = 1885) | **1885** | **1885** | **0** ✅ |
| Comprobaciones **añadidas** | — | **0** | **0** ✅ |

**Salidas literales de `npx vitest run` (reporter `basic`, cola):**

```
ANTES  (778f189 + 3d6d381, árbol limpio)
 Test Files  1 failed | 115 passed (116)
      Tests  1 failed | 1896 passed (1897)
```

```
DESPUÉS (con la retirada aplicada)
 Test Files  116 passed (116)
      Tests  1895 passed (1895)
```

> **El rojo del "antes" es un flake de reloj, no un defecto, y no es de esta entrega.**
> `tests/account-deletion.test.ts` › *«el borrado NUNCA consulta cuántos admins hay»*
> agotó los 20 000 ms de `testTimeout` bajo la carga de la suite completa contra Neon.
> Re-ejecutado **solo ese fichero** sobre el mismo árbol: `30 passed (30)`, ese caso en
> 3 839 ms. En el "después" pasó en la corrida completa sin tocar nada. Se deja escrito
> aquí para que el verificador no lo lea como una regresión ni como una reparación.

**Y el recuento por fichero, para CA-2**: el único fichero de `tests/` que este árbol
modifica es `tests/tarjeta-guardias-ampliadas.test.ts` —lo confirma
`git diff --stat origin/main`, en §Acotación—, así que **ningún otro fichero puede haber
cambiado su número de casos**; y la aritmética lo cierra: 1897 − 12 = 1885 = 1895 − 10.
Los tres que §Problema dictamina *«se queda, intacto»*
(`tests/revision-movil-en-tests.test.ts`, `tests/version-bump-gate.test.ts`,
`tests/primera-pantalla-fuente.test.ts`) no aparecen en el diff.

**Gates de calidad, sobre el mismo árbol:** `npm run typecheck` (`tsc --noEmit`) sin
salida y sin error; `npm run lint` (`eslint . --max-warnings=0`) sin salida y sin error
—que es la comprobación que exigía retirar los ocho símbolos huérfanos.

**Confirmado por sdd-verificador el 2026-08-25, con las dos cifras medidas por él mismo
y no heredadas:**

```
DESPUÉS — $ npx vitest run          (árbol entregado, corrida completa, una sola vez)
 Test Files  116 passed (116)
      Tests  1895 passed (1895)

DESPUÉS — $ npx vitest run tests/tarjeta-guardias-ampliadas.test.ts
      Tests  10 passed (10)

ANTES  — blob de 778f189 extraído FUERA del árbol y corrido con `vitest --root <scratch>`
      Tests  12 failed (12)      <- fallan por no encontrar `src/`; lo que se mide es el
                                    REGISTRO de casos, que es 12
```

El «antes» del fichero está por tanto **medido, no deducido**: **12 → 10, Δ −2**. La
corrida completa del «después» salió verde **a la primera y sin aislar nada**: no hizo
falta separar ningún fichero de Postgres efímero, así que el flake de reloj que el
implementador documenta arriba no se reprodujo y su explicación queda aceptada tal cual.
Y el «resto de `tests/`» no necesita medirse: `git diff --name-status` demuestra que
**el único fichero de `tests/` que este árbol modifica es ése**, luego ningún otro pudo
cambiar su número de casos.

El **12** de partida está además confirmado por el ledger de SPEC-051 (*«Verde (los doce
casos), 17.1 · 17.2 · 17.3 con mutación de control · 17.4»*, GREEN 2026-08-23) y
por el conteo del fichero: 2 (17.1) + 2 (17.2, bucle sobre `GUARDIAS`) + 4 (17.3,
dos bucles) + 4 (17.4) = 12.

## Salvedades / follow-ups
<!-- IDs F-SPEC-057-1, F-SPEC-057-2… con destino (spec futura o EPIC-MEJORA). -->

Levantadas por el **arquitecto al especificar**, antes de implementar:

- **`F-SPEC-057-1` (decisión del humano, bloqueante del gate) — esta spec pisa la
  rama parada de SPEC-052.** `SPEC-052 CA-18` re-encuadra la misma aserción que
  CA-1 retira, está implementada y empujada en
  `ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde` (`130acd1`) y **sin
  PR**. Si se aprueba SPEC-057, **CA-18 (a)-(f) se queda sin objeto**. No se
  resuelve aquí: **es del humano**. Ver §Notas pto. 2 de la spec, con la tabla de
  coste (retirar: un bloque y un comentario; re-encuadrar: **+185 / +212 líneas**,
  **397** en total). Esta spec **no toca** esa rama, ni su ledger, ni `docs/despliegue.md`.
- **`F-SPEC-057-2` (aviso escrito, sin destino) — `tests/spec-032-frontera.test.ts:162-164`
  queda como caso fronterizo declarado.** `readdirSync(drizzle/)` filtrado a
  `.json` y congelado contra `['destructive-waivers.json']` **encaja en la firma**
  de ADR-037 pto. 3. No se toca porque en ese directorio escribe `drizzle-kit`, no
  otra spec: la mano que podría ponerlo rojo no es la de un tercero, y SPEC-032
  está en `hecho` sin defecto. Si algún día `drizzle/` gana un `.json` por otra
  vía, esa guardia se pondrá roja y **este hallazgo es su aviso escrito**.
- **`F-SPEC-057-3` (apuesta declarada, sin destino) — la regla no lleva
  mecanismo.** ADR-031 registró que una convención en prosa *«aguantó dos días»*.
  Ésta se apuesta contra una población **cero** y con el disparador en
  `FOUNDATION.md`, pero es una apuesta. **Si aparece una tercera instancia de la
  forma, la apuesta se ha perdido** y toca mecanismo, con el listón de ADR-037
  pto. 4: traer un discriminante que separe los tres inocentes que el ADR nombra
  por línea. Registrado aquí para que el tercer incidente encuentre el aviso.

Levantadas por el **implementador**, el 2026-08-25:

- **`F-SPEC-057-4` — ✅ CERRADO el 2026-08-25 por sdd-arquitecto.** Se conserva entero
  porque su valor es el precedente: **el implementador escaló en vez de escribir, y hizo
  bien**. *Lo escrito para cerrarlo*: el **3.er corolario** de `FOUNDATION.md` —datado
  2026-08-25, pegado a los otros dos, con la forma que caduca, la pregunta *«¿de quién es
  la mano que puede poner esto rojo?»*, las cuatro formas que sobreviven y la que no, los
  dos incidentes con su coste, y que **no lleva guardia y por qué**— y el párrafo
  *«Precisión del 2026-08-25, para el vector que no usa `git`»* en **`RI-03`**, con
  **Fuente: ADR-037** y dejando dicho que las condiciones (1)-(4) siguen siendo para
  guardias con `git`, salvo el centinela de no-vacuidad. `RI-03` **conserva su número**.
  **Saldo intacto: −2 / +0** — no se añadió ningún `toContain` que vigile que esos
  párrafos existen, porque sería la casilla que ADR-037 pto. 4 ya descartó.
  *El hallazgo, tal y como se levantó*: — la regla NO estaba escrita
  en `FOUNDATION.md` ni en `RI-03`, y el implementador no la escribió a propósito.
  Sobre el árbol entregado, `FOUNDATION.md` § *Cómo se trabaja aquí* sigue con **dos**
  corolarios (2026-08-24) y **ningún tercero datado el 2026-08-25**; y `RI-03`
  (`docs/fundacion/reglas.md`:114-139) sigue cerrando con *«Fuente: ADR-031»*, sin
  `ADR-037` y sin el párrafo nuevo. **CA-3 está por tanto sin cumplir en los puntos 1 y
  2** (el 3 —que ninguno de los dos documentos afirme que hay meta-guardia— se cumple por
  omisión). No se ha tocado ninguno de los dos porque **la propia letra de CA-3 lo
  atribuye al arquitecto**: *«Es documento locked con hook `protege-verdad`; lo escribe
  el arquitecto en el gate, como manda ADR-025»*, y §Trampas conocidas de este handoff lo
  repetía: *«si al implementar falta una frase, se levanta residual y no se escribe en el
  documento de verdad»*. **Y este ledger se contradice a sí mismo**: su §Falta pto. 2
  encargaba a la implementación *«escribir el 3.er corolario de `FOUNDATION.md` y el
  párrafo de `RI-03`»*. Se resuelve a favor de la spec y de ADR-025, que mandan sobre el
  handoff. **Destino: el arquitecto, antes del gate de esta misma spec** — CA-3 no puede
  cerrarse sin ello, y sin CA-3 esta spec se queda sin su única entrega duradera (ADR-037
  pto. 5: *«el disparador, ya que no hay mecanismo, es el sitio donde se lee»*).
- **`F-SPEC-057-5` (aviso escrito, sin destino) — un comentario ajeno queda desfasado, y
  NO se toca.** `tests/app-base-url.test.ts`:954-956 dice *«`tests/tarjeta-guardias-ampliadas.test.ts:119`
  mantiene una lista cerrada de los ficheros de `tests/` que la mencionan […] y este
  fichero no es uno de ellos»*, y explica con eso por qué se refiere a SPEC-051 por su
  ruta y no por su identificador. Tras la retirada, esa lista ya no existe. **Es prosa,
  no una aserción**: ningún caso de `tests/app-base-url.test.ts` lee este fichero ni
  afirma nada sobre él —se comprobó— y la suite queda verde. No se corrige porque **CA-1
  cond. 3 y CA-5 prohíben tocar cualquier otro fichero de `tests/`**, y porque la
  conducta que ese comentario recomienda —citar por ruta, no por identificador— sigue
  siendo la buena por su propio pie. Queda como aviso para quien toque SPEC-055 o
  EPIC-FIX: es un retoque de comentario, no de código, y cuelga de la primera spec viva
  que ya toque ese fichero (ADR-025).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Hecho (arquitecto, 2026-08-25):**

1. Dictamen de los **cinco** ficheros del encargo, en §Problema de la spec. **Uno**
   defectuoso (`tests/tarjeta-guardias-ampliadas.test.ts` CA-17.1), **uno fuera de
   alcance** (`tests/entornos-de-despliegue.test.ts`, que **no existe en
   `origin/main`**: lo crean `fc14150`/`130acd1` en la rama parada de SPEC-052) y **tres
   sanos**, con el porqué de cada uno.
2. **`docs/adr/ADR-037-*.md`** en `borrador`: la regla, la pregunta que la
   reconoce, la medición del falso positivo con los **tres inocentes por línea**, y
   la decisión de **no** escribir meta-guardia con su motivo, para que no se vuelva
   a proponer.
3. La spec con **cinco CA**: la retirada (CA-1), el recuento (CA-2), la regla
   escrita (CA-3), el **saldo −2 / +0** como condición (CA-4) y la acotación como
   **`n-a` declarado** (CA-5).

**Hecho (implementador, 2026-08-25), en un solo commit sobre la rama:**

4. **CA-1 — la retirada, con las cuatro condiciones.** En
   `tests/tarjeta-guardias-ampliadas.test.ts`:
   - **(1) nombrado y exactamente ése**: fuera el bloque
     `describe('SPEC-051 CA-17.1: son DOS guardias ajenas, y la tercera no ha hecho falta')`
     entero —líneas **111-139** de `778f189`— con sus **dos** casos: el barrido de
     `tests/` congelado con `toEqual` (112-132) y
     *«`tests/deploy-gate-workflow.test.ts` ni siquiera sabe que esta spec existe»*
     (133-138). **Los dos, y ningún otro fichero.**
   - **(2) el porqué en el sitio**: en el hueco que dejó (**líneas 91-162** del árbol
     entregado) queda un bloque de prosa con qué vigilaba cada caso, qué vigila ahora
     (*nada en la suite*: la afirmación vuelve al gate, donde se consumó — GREEN 20/20 de
     SPEC-051, 2026-08-23), por qué ya no puede volver a ser cierto (SPEC-051 en `hecho`,
     ADR-025), por qué se retira en vez de re-encuadrarse (397 líneas para conservar un
     criterio consumido), por qué se retiran **los dos**, lo que está prohibido hacer
     (excluir por nombre), **en virtud de qué** (SPEC-057 CA-1 y ADR-037 pto. 7), con la
     **fecha** y la **autorización nominal del humano (Alberto Fojo) del 2026-08-25**, y
     dejando escrito que **quien lo redacta es el arquitecto y el implementador no lo
     decide**. Molde: `tests/primera-pantalla-fuente.test.ts` (SPEC-053 CA-13).
   - **la cabecera corregida en la misma pasada** (líneas **29-39**). Antes cerraba con
     *«lo que sí cabe aquí —y está— es su forma comprobable sin git: nadie más ha sido
     re-encuadrado por esta spec»*, que tras la retirada es **falso**. Ahora dice que esa
     forma **llegó a estar y se retiró el 2026-08-25 por SPEC-057 CA-1**, remite al hueco,
     y enumera lo que el fichero **sí** afirma hoy: las condiciones 2, 3 y 4 de CA-17. El
     resto de la cabecera, intacto.
   - **(3) no es una aflojada**: los **diez** casos restantes (17.2, 17.3 y 17.4) siguen
     con **cero líneas tocadas**; ni un `.skip`/`.only`/`.todo`; ninguna comparación
     exacta cambiada por una laxa; **ninguna exclusión por nombre** añadida.
   - **(4) ninguna propiedad protegida se debilita**: sobrevive todo lo que era propiedad
     —el porqué al lado de cada ampliación, la mutación de control de 17.3,
     `PUBLIC_PREFIXES` y las doce rutas de producto de 17.4.
   - *Nota mecánica*: fuera `readdirSync`, `statSync` (import de `node:fs`),
     `relative` (import de `node:path`), `testsDir`, `rel`, `NO_SE_TOCA`, `PROPIOS` y
     `fuentesDeTests()`, **porque `eslint --max-warnings=0` rechaza un símbolo sin usar**.
     `casos()`, `sinComentarios()`, `caso()`, `fuente()` y `GUARDIAS` se quedan.
5. **CA-2 y CA-4 — recuentos y saldo.** Los dos `npx vitest run` completos, con sus
   salidas literales, en §Recuentos: **1897 → 1895**, Δ **−2**; el fichero tocado **12 →
   10**; resto de `tests/` **1885 → 1885**; **116 ficheros verdes, cero rojos**. Saldo
   **−2 / +0**. Y `npm run typecheck` + `npm run lint` en verde.

**Falta — y en este orden:**

1. **CA-3, y es del arquitecto: `FOUNDATION.md` y `RI-03` siguen sin el párrafo.** Ver
   `F-SPEC-057-4`, que incluye la contradicción interna de este handoff y cómo se
   resuelve. **Sin esto, CA-3 no cierra y la spec se queda sin su única entrega
   duradera.**
2. **Verificar** (sdd-verificador): las cuatro condiciones de CA-1 **leyendo el fichero**;
   los recuentos de §Recuentos; el diff contra el conjunto permitido de §Acotación; y —si
   para entonces existen— los dos documentos de CA-3 contra sus tres puntos.
3. **Regenerar `docs/tablero.md`** con `/sdd-tablero` al cerrar. No se ha tocado.

**Trampas conocidas, para no repetirlas:**

- **`FOUNDATION.md` lo escribe el arquitecto en el gate** (ADR-025), no la
  implementación. Se ha respetado: el implementador levantó `F-SPEC-057-4` y **no
  escribió en el documento de verdad**, aunque §Falta de la versión anterior de este
  handoff se lo pedía.
- **`version:check` juzga lo commiteado**, y con el árbol sucio da un verde vacío
  (SPEC-049). Se ejecutó **después** de commitear. Esta entrega **no toca `src/` ni
  `app/`** —el único fichero de código es de `tests/`— así que **no sube la versión**:
  `package.json` sigue en `0.4.2`. Si el gate pidiera un bump, el alcance se ha desviado.
- **No añadir ni una comprobación.** Cumplido: **+0**. Lo que sustituye al bloque
  retirado es **prosa**, no un test; CA-3 se verificará **leyendo** los documentos, no con
  un `toContain`; y no hay script nuevo en `scripts/` ni step nuevo en CI.
- **Un comentario ajeno queda desfasado y no se toca** (`F-SPEC-057-5`,
  `tests/app-base-url.test.ts`:954-956). Es prosa, no una aserción; la suite queda verde.
