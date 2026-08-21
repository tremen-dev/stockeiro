---
id: SPEC-033
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-033 La puerta post-deploy deja de perder la carrera: con --commit, unknown es transitorio

## Resumen
- Fase: **implementada por sdd-implementador el 2026-08-19**, en `en-revision`. Pendiente del
  **verificador**. La fuente de verdad del estado es el frontmatter de la spec.
- Escrita por sdd-arquitecto el 2026-08-19 y **aprobada en el gate humano** (Alberto Fojo) el
  mismo día, con sus tres decisiones cerradas: el veredicto sigue siendo el **2**, el `builtAt`
  **informa pero no decide**, y hay **permiso firmado** para editar un caso —uno— de
  `tests/check-alive.test.ts`.
- Rama: `ft/SPEC-033-carrera-check-alive` (worktree `.claude/worktrees/spec-033`), sobre
  `origin/main` @ `0d389c8` — el mismo merge cuyo job `Alive` salió rojo y que motiva esta spec.
- **Sin ADR nuevo.** ADR-018 D-6 ya decide que la puerta *espera y falla si no llega en un plazo*;
  esta spec devuelve el script a esa letra. Justificación en §Entidades y en §Notas punto 4.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 la carrera se deja de perder (`unknown`→sha → 0) | `scripts/check-alive.mjs` (rama `unknown` con `esperado !== null`: deja de salir y sigue el bucle) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-1* (2 casos: el 0, y el contador ≥ 4 peticiones) | Subproceso propio del verificador contra servidor de juguete (`node:http`, loopback, puerto efímero) que responde `unknown` en los 3 primeros sondeos y el sha después → **code=0** en 1622 ms, **4 peticiones** registradas y stdout con `commit=… environment=… builtAt=…`. **Control decisivo**: el mismo escenario contra `git show 0d389c8:scripts/check-alive.mjs` da **code=2, 1 petición, 116 ms** — el rojo de 1 s del merge real, reproducido y luego arreglado | ✅ |
| CA-2 el plazo se usa de verdad; 2 al expirar | `scripts/check-alive.mjs` (`ultimaIdentidad` + veredicto de plazo agotado con `SALIDA.DESCONOCIDO`) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-2* (2 casos: código + tiempo 2,7 s ≤ t < 12 s; y el texto de SPEC-031 que sobrevive) | Subproceso propio, servidor siempre `unknown`, `--timeout 3 --interval 0.5` → **code=2**, **3065 ms** medidos (≥2700 y <12000), **7 sondeos**; stderr casa `/no sabe de qué commit viene/i` y **no** casa `/no coincide/i`. Contra el script viejo: 113 ms y 1 sondeo | ✅ |
| CA-3 el 2 es comprensible: esperado, `unknown`, `builtAt`, las dos causas | `scripts/check-alive.mjs` (bloque `Dos causas posibles, y el builtAt de arriba es lo que las separa`) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-3* (2 casos: los tres datos; y las dos causas + desempate) | Sobre ese mismo stderr: contiene el sha esperado `0d389c8…ad13`, dice que lo vivo responde `unknown`, imprime `builtAt=2026-08-18T22:55:08.899Z`, y enumera **(a)** build que no llegó / despliegue ANTERIOR vivo y **(b)** despliegue por CLI, diciendo que «el builtAt de arriba es lo que las separa». Bloque único, junto | ✅ |
| CA-4 una línea al primer `unknown`, exactamente una | `scripts/check-alive.mjs` (`avisadoDeLaEspera`, línea `sigo esperando a …`) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-4* (2 casos: la línea lleva el `builtAt`; y aparece 1 vez con 4 sondeos `unknown`) | Con 7 sondeos `unknown`: `sigo esperando` aparece **1 vez**, y lleva `builtAt=`. Segundo escenario (4 sondeos `unknown` y luego el sha, `--interval 0.3`): **1 vez** y code=0. Contra el script viejo: 0 ocurrencias | ✅ |
| CA-5 modo *smoke* intacto: terminal e inmediato | `scripts/check-alive.mjs` (rama `esperado === null`, con el mensaje de SPEC-031 sin tocar) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-5* + `tests/check-alive.test.ts` › *SPEC-031 CA-11* › «modo smoke también es 2» (**palabra por palabra**, sin editar) | Sin `--commit`, servidor siempre `unknown`, `--timeout 60` → **code=2 en 92 ms** y **1 sola petición**: no espera. El caso «modo smoke también es 2» de `tests/check-alive.test.ts` es **byte a byte idéntico** a `0d389c8` (`diff` del bloque extraído de ambas revisiones: sin diferencias; el fichero tiene **un solo hunk**) | ✅ |
| CA-6 ningún código de salida cambia de significado | `scripts/check-alive.mjs` (`SALIDA` intacto; salidas 0/1/3 sin tocar) | `tests/check-alive.test.ts` **22/22** (con la única edición de CA-8) + `tests/spec-031-frontera.test.ts` **verde sin tocarlo** | Los cinco puntos ejercitados como procesos por el verificador: (1) sha coincidente → 0 con `--commit` y en smoke; (2) sha distinto persistente → **1** a los 3070 ms, nombrando esperado y último visto; (3) cuerpo fuera de contrato → **3** con **1 petición**, y no-JSON → **3** con **1 petición** (sin reintentar); (4) sin `--url`, `--modo puerta`, `--timeout pronto`, `--interval 0` → **3**; (5) dos `500` y luego bueno → **0**; puerto muerto que luego levanta → **0**. `tests/spec-031-frontera.test.ts` verde y ausente del diff | ✅ |
| CA-7 `scripts/` con tres habitantes; la puerta no cambia | `.github/workflows/deploy-gate.yml`: **solo el comentario** del código 2 (`git diff` → 13 `+` / 5 `−`, todas líneas `#`) | `tests/deploy-gate-workflow.test.ts` **34/34 sin tocarlo** (5.5 cuenta los tres ficheros de `scripts/`; 4.2 y 7.2 vigilan `secrets.`, `node-version:` y `continue-on-error` sobre el texto crudo) | `ls scripts/` → **tres** ficheros. Diff de `deploy-gate.yml` filtrando las líneas que no empiezan por `#`: **vacío** — solo cambian comentarios; `on`, `concurrency`, `permissions`, job `Alive`, nombres de steps y el `run:` (línea 111) intactos, con `--timeout 900 --interval 10`. `grep -F` sobre el fichero entero: `continue-on-error` 0, `node-version:` 0, `secrets.` 0. `ci.yml`, `vercel.json`, `src/`, `drizzle/` ausentes del `--name-status` | ✅ |
| CA-8 los tests ajenos tocados son exactamente los declarados | n-a (es una propiedad del diff) | `git diff --stat 0d389c8..HEAD` → bajo `tests/` solo `check-alive-carrera.test.ts` (nuevo) y `check-alive.test.ts` (1 caso retitulado). Los 7 prohibidos, verdes y sin tocar | `git diff --name-status 0d389c8..HEAD` → bajo `tests/`, exactamente `check-alive-carrera.test.ts` (A) y `check-alive.test.ts` (M, **un solo hunk**, el caso autorizado). Los siete prohibidos, ausentes del diff y verdes. **Re-medido el 2026-08-21 sobre el rango ya mergeado** (`git diff --name-status 0d389c8 7b73fb0 -- tests/`): idéntico, y el hunk único de `check-alive.test.ts` es el caso autorizado (retitulado + aserción de tiempo ≥1800 ms + nota que remite a SPEC-033), con el caso de modo *smoke* intacto. **Arbitraje resuelto en §Veredicto (2026-08-21): CA-8 se cumple**; el bloque `SPEC-033 CA-9.1` del fichero propio no lo incumple | ✅ |
| CA-9 la regla nueva escrita en cabecera, §10, §12.2 y §12.3 | `scripts/check-alive.mjs` (cabecera + `USO`; el bloque de códigos acaba en la **línea 32**, dentro de la ventana de 60) · `docs/despliegue.md` §10 (fila del **2** y bloque «El comando»), §12.2 (el incidente con fecha y sha) y §12.3 (fila del **2**) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-9.1* (cabecera y `--help`) + `tests/runbook-check-alive.test.ts` y `tests/runbook-despliegue-automatico.test.ts` **verdes sin tocarlos** | Cabecera: bloque `CÓDIGOS DE SALIDA` en las **líneas 21–32**, dentro de la ventana de 60 que mira `check-alive.test.ts` 8.4. `--help` (proceso real) → code 0 y dice *transitorio* y *agotar el plazo*. `docs/despliegue.md`: §10 conserva sus **cuatro** filas `| **N** |` y ya no dice «Hoy es lo normal» (0 ocurrencias en el fichero); §12.3 conserva la palabra `CLI` y añade las dos causas; §12.2 lleva el incidente con fecha 2026-08-19 y sha `0d389c8`. `runbook-check-alive.test.ts` y `runbook-despliegue-automatico.test.ts` **verdes y ausentes del diff** | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-19, sdd-verificador.** 8 CA ✅ y 1 ⚠️ aceptada (CA-8, por encaje de redacción,
no por comportamiento). Sin findings.

**Gates automáticos**: `npm test` **769/769** en 54 ficheros · `npm run typecheck` limpio ·
`npm run lint` (`--max-warnings=0`) limpio · los 9 ficheros de test relevantes **173/173**.

**Evidencia propia, no heredada.** El verificador no se apoyó en los tests de la rama: escribió
su propio arnés (`node:http` en loopback + `spawn` del script como **proceso real**) y ejecutó
**41 comprobaciones**, todas en verde. Las mismas 41 contra
`git show 0d389c8:scripts/check-alive.mjs` dan **27/41**, y los 14 fallos son **exactamente**
CA-1, CA-2 (tiempo y número de sondeos), CA-3, CA-4 y CA-9.1. Es la prueba de las dos mitades:
el defecto se reproduce en el árbol de antes y desaparece en el de ahora **sin que ningún otro
código de salida se mueva** — los 27 que pasan en ambos son CA-5 y CA-6 enteros.

**La carrera del merge `0d389c8`, reproducida literalmente**: servidor que responde `unknown` en
los 3 primeros sondeos y el sha después. Antes: `code=2` en **116 ms** con **1 petición** (el
rojo de 1 s del log real). Ahora: `code=0` en **1622 ms** con **4 peticiones**.

**`builtAt` no decide.** `grep` sobre `scripts/check-alive.mjs`: aparece en `CONTRATO`
(validación de claves, heredada de SPEC-031) y en cinco literales de mensaje. **Cero**
apariciones en una condición. Confirmado además leyendo las tres ramas del bucle y el veredicto
final: el único `if` nuevo es `ultimaIdentidad.commit === UNKNOWN`.

**El veredicto sigue siendo el 2**, no el 1, y se resuelve con información: comprobado sobre el
stderr real que las dos causas y el desempate por `builtAt` salen juntos, en un solo bloque.

**Arbitraje del bloque `SPEC-033 CA-9.1`** (declarado por el implementador en Salvedades punto
1). Se acepta, y consta que el encaje es forzado — las dos cosas:
- *Respeta CA-8 donde CA-8 obliga*: lo que ese CA enumera y cierra es la **lista de ficheros**
  («son **exactamente dos**») y la lista prohibida. `git diff --name-status` confirma ambas.
  Ningún fichero de tests ajeno se tocó y no se creó un tercero.
- *Estira su redacción*: «donde viven CA-1 … CA-5» describe el contenido del fichero nuevo, y
  ahí vive ahora un sexto bloque. Y CA-9 preveía para su punto 1 «lectura humana en la
  revisión», o sea que el test no lo exigía la spec.
- *Por qué se acepta igualmente*: la propiedad que automatiza —el bloque de códigos dentro de
  las primeras 60 líneas— es mecánica y frágil, y dejarla a ojo es justo aquello de lo que un CA
  no debería depender. La alternativa que habría respetado la redacción al pie de la letra (un
  tercer fichero) habría roto la restricción que **sí** ata. Coste cero sobre lo que CA-8
  protege.
- Se marca **CA-8 ⚠️** y no ✅ por la regla del rol (salvedad = ⚠️), no porque haya nada que
  arreglar. **No genera follow-up.**

**Lo que este GREEN NO certifica — RI-02.** Por `docs/fundacion/reglas.md` **RI-02**, este GREEN
es sobre el **árbol de trabajo y antes del merge**; la spec **no pasa a `hecho`** aquí y queda
deliberadamente en `en-revision`. Falta, en este orden:
1. mergear `ft/SPEC-033-carrera-check-alive` a `main`;
2. que el job **`Alive`** de ese merge salga **verde a la primera, sin relanzarlo** — que es la
   verificación en producción de esta misma spec, y ocurre gratis;
3. pegar el enlace de ese run en este ledger. Solo entonces `hecho`.

Ese mismo run es además la evidencia RI-02 que **SPEC-028** necesita para salir de
`en-revision`. **EPIC-FIX no se cierra**: es una épica *bucket*, transversal y siempre abierta.

**Nada que capturar en `_qa/`**: no hay UI. `_qa/SPEC-033/` no existe, y es lo correcto.

---

## Segunda firma — 2026-08-21, sdd-verificador (cierre)

**GREEN — 9 de 9 CA ✅.** Se resuelve el arbitraje que quedó abierto en CA-8 y se cierra la spec.

### Por qué esta firma llega con dos días de retraso, dicho sin adornos

El flujo **no fue limpio**, y conviene que quede escrito antes que ninguna otra cosa:

1. El GREEN de arriba se emitió el **2026-08-19 sobre el árbol de trabajo**, y **a propósito** no
   pasó la spec a `hecho`: por **RI-02** faltaba que el job `Alive` del propio merge saliera verde
   a la primera. Eso era correcto.
2. El merge se hizo ese mismo día (**PR #36**, `7b73fb0`) y el código lleva **desde el 19 en
   producción**. Pero **nadie volvió a por el paso 3** —pegar el enlace del run y transicionar—, y
   la spec se quedó en `en-revision` **dos días**, siendo el último cabo suelto del tablero.
3. A eso se sumó que **CA-8 quedó en ⚠️** con un arbitraje que el veredicto del 19 sí razonó, pero
   que resolvió marcando ⚠️ «por la regla del rol». Eso es circular: la regla dice que *una
   salvedad* se marca ⚠️, no que un CA se marque ⚠️ porque su lectura exigiera un arbitraje. Si el
   arbitraje concluye que el CA se cumple, no hay salvedad que marcar.

Ninguna de las dos cosas es un defecto del código. Son un cierre que se dejó a medias.

### La evidencia RI-02 que faltaba, que es lo que de verdad bloqueaba el cierre

**Job `Alive` del merge de esta spec** — <https://github.com/tremen-dev/stockeiro/actions/runs/32231957968>

| Dato | Valor |
|---|---|
| Run | `32231957968`, job `Alive` (`96003518073`) |
| Sha | `7b73fb090d1be38f51c2758db74a3fbb329d7475` (PR #36) |
| **Intento** | **1** — verde **a la primera, sin relanzarlo** |
| Conclusión | `success` |
| Paso *Wait for the deployment to go live* | 08:18:30 → **08:19:13 = 43 s** |

Los **43 s** son el CA-1 cobrado en producción: el script **esperó** a que el despliegue llegara.
El script viejo salía en **1 s**. Log literal del run:

```
[check-alive] VIVO en https://stockeiro.tremen.dev/api/version
[check-alive] commit=7b73fb090d1be38f51c2758db74a3fbb329d7475 environment=production builtAt=2026-08-19T08:18:31.879Z
```

**Matiz honesto**: en esa ventana producción servía el despliegue **anterior** (`0d389c8`), que
tiene sha de verdad — así que el run **no ejercitó la rama `unknown`**, sino la de *sha que aún no
coincide*. La espera se demuestra en producción; el `unknown` transitorio, solo en el arnés de
*loopback*. Es exactamente lo que la spec previó (§Notas 7: los CA se cierran sin desplegar).

### Re-verificación completa el 2026-08-21, porque la evidencia de hace dos días ya no bastaba

Entre medias **SPEC-038 tocó `scripts/check-alive.mjs`** (`baec1cd`). Se re-verificó todo de cero
con un **arnés propio y nuevo** —`node:http` en *loopback*, puerto efímero, el script como
**proceso real**, 49 comprobaciones— corrido contra **tres revisiones** del script:

| Revisión | Resultado | Qué demuestra |
|---|---|---|
| `0d389c8` — **antes** de SPEC-033 | **29/49**, 20 fallos | El defecto se reproduce: CA-1, CA-2, CA-3, CA-4 y CA-9.1 caen enteros |
| `7b73fb0` — SPEC-033 **al mergearse** | **44/49**, 5 fallos | SPEC-033 arregla lo suyo; los 5 fallos son **solo** los del contrato de 4 claves |
| **`HEAD` de hoy** (post SPEC-038) | **49/49**, 0 fallos | Nada erosionado, y cinco casos **ganados** |

**SPEC-038 no erosionó SPEC-033: la rescató.** El dato incómodo está en la fila del medio. Con el
contrato de **cuatro** claves que ADR-024 aprobó, el script **tal como lo dejó SPEC-033** devuelve
**3 sin reintentar** incluso en el escenario de la carrera — es decir, **CA-1, CA-2 y CA-5 habrían
dejado de cumplirse en producción** en cuanto `/api/version` creciera. La guardia de forma de
SPEC-038 CA-15.1 es lo que los mantiene vivos. Medido:

```
CA-1 con 4 claves: unknown transitorio -> 0   HOY: ok (code=0, 3 peticiones)
                                              7b73fb0: FALLA (code=3, 1 petición)
CA-2 con 4 claves: 2 al expirar               HOY: ok (code=2, 3107ms)
                                              7b73fb0: FALLA (code=3, 141ms)
CA-5 con 4 claves: smoke sigue inmediato      HOY: ok (code=2, 192ms)
                                              7b73fb0: FALLA (code=3, 244ms)
```

**Lo que CA-6.3 protege sigue intacto.** La letra de CA-6.3 dice «cuerpo que **no es el contrato de
tres claves** → 3, y sin reintentar», y hoy un cuerpo de cuatro claves ya **no** da 3. No es
erosión, por tres razones: (a) el **significado** de los cuatro códigos no se ha movido —que es lo
que CA-6 titula—; (b) el contrato de `/api/version` es de **SPEC-031**, y SPEC-033 lo puso
explícitamente **fuera de alcance**: ADR-024 y SPEC-038 CA-15.1 lo enmendaron por su propio gate;
(c) **todos** los modos de fallo que CA-6.3 de verdad vigila siguen dando **3 con una sola
petición**, comprobados uno a uno: falta `builtAt` → 3, `commit: null` → 3, array JSON → 3, cuerpo
sin las claves → 3, no-JSON → 3.

**Medidas propias sobre el `HEAD` de hoy**, las tres que importan:
- **`unknown` es transitorio y se reintenta**: `unknown`×3 y luego el sha → **code=0** en 1437 ms
  con **4 peticiones** registradas por el servidor de juguete. No es un sondeo: son cuatro.
- **El plazo se usa y expira en 2**: `--timeout 3 --interval 0.5` siempre `unknown` → **code=2** a
  los **3063 ms**, **7 sondeos**. Ni 0 ni 1. El texto conserva «no sabe de qué commit viene» y
  **no** dice «no coincide».
- **Modo *smoke* sin tocar**: sin `--commit`, `--timeout 60` → **code=2 en 156 ms**, **1 sola
  petición**, y **sin** la línea de espera.

**D-D sigue en pie**: `builtAt` no aparece en **ninguna** condición del script (`grep` sobre
`if (…builtAt` y comparaciones: cero). Informa, no decide.
**Frontera de SPEC-031 intacta**: cero `import`/`require` fuera de los globals de Node, **cero**
`process.env`, **un** `fetch(`, y `url: null` por defecto (línea 102).

### CA-7 y CA-9, re-medidos sobre el árbol de hoy

- **CA-7**: `deploy-gate.yml` **sin un solo commit** desde `7b73fb0`; el `run:` de la línea 111
  sigue literal con `--timeout 900 --interval 10`; `continue-on-error`, `node-version:` y
  `secrets.` siguen a **0** ocurrencias; `ci.yml`, `vercel.json`, `src/` y `drizzle/` ausentes del
  diff de la spec.
  *Nota de encaje, gemela de la de CA-8*: `scripts/` tiene hoy **cuatro** habitantes —SPEC-038
  CA-12 trajo `check-version-bump.mjs`—, y CA-7.1 decía «exactamente tres». **No es erosión**:
  CA-7 está enunciado «dado **el diff completo de esta spec**», y el diff de SPEC-033 sobre
  `scripts/` es `M scripts/check-alive.mjs` y nada más. Es una propiedad **histórica** de una
  entrega, no un invariante perpetuo del árbol. El propio `tests/deploy-gate-workflow.test.ts` 5.5
  fue re-encuadrado por SPEC-038 con esa misma lectura, declarada y aprobada en su gate, y sigue
  **verde**.
- **CA-9**: §10 conserva sus **cuatro** filas `| **N** |` y «Hoy es lo normal» sigue en **0**
  ocurrencias; §12.3 conserva `CLI` y las dos causas; §12.2 conserva el incidente con su fecha y su
  sha `0d389c8`; el bloque `CÓDIGOS DE SALIDA` sigue en las **líneas 21–32**, dentro de la ventana
  de 60 —SPEC-038 metió su comentario **por debajo**, sin desbordarla— y `--help` sigue diciendo
  *transitorio* y *agotar el plazo*.

### Arbitraje de CA-8 — resuelto: **se cumple**, y pasa a ✅

Esto es lo que quedó pendiente el 19, y esta es la decisión.

**El hecho, re-medido**: `git diff --name-status 0d389c8 7b73fb0 -- tests/` devuelve exactamente
`A tests/check-alive-carrera.test.ts` y `M tests/check-alive.test.ts`, este último con **un solo
hunk**, que es el caso autorizado. Los siete ficheros prohibidos, ausentes del diff y **141/141**
verdes hoy. La duda nunca fue esa: es que el fichero nuevo aloja un sexto bloque,
`SPEC-033 CA-9.1`, que CA-8 no enumeró.

**No es un incumplimiento**, y el argumento es el texto del CA:

1. **La medición que el propio CA prescribe es sobre ficheros.** Dice: *«cuando **se listan los
   ficheros** bajo `tests/` que toca, entonces son **exactamente dos**»*. El predicado recae sobre
   la lista de ficheros, y esa lista se cumple. La coletilla *«donde viven CA-1 … CA-5»* es una
   **aposición que identifica** cuál es el fichero nuevo, no un manifiesto cerrado de su contenido.
2. **El CA habla de tests *ajenos*.** Su título es *«Los tests **ajenos** que se tocan son estos y
   solo estos»*, y su *Por qué* nombra el daño que previene: repetir `F-SPEC-032-3`, el choque con
   **literales congelados de otra spec** descubierto tarde. `check-alive-carrera.test.ts` es de
   **esta** spec. Un bloque de más en el fichero propio no colisiona con nada de nadie.
3. **La lectura literal es autocontradictoria.** Si el sexto bloque no cabe en el fichero nuevo,
   solo queda un tercer fichero bajo `tests/` — que **sí** rompe la cláusula que ata («exactamente
   dos»). Un CA que ninguna implementación puede satisfacer se está leyendo mal, no incumpliendo.
4. **Y el bloque estaba obligado a existir.** CA-9.1 es un criterio de aceptación; la regla del rol
   es que un CA sin test no está implementado. Dejarlo a «lectura humana» habría sido el defecto
   real, y encima sobre una propiedad mecánica y frágil (la ventana de 60 líneas) que hoy, con
   SPEC-038 metiendo texto en la cabecera, es **más** necesaria que el día que se escribió.

**Riesgo residual: cero.** Lo que CA-8 protege —que ningún test ajeno se toque a escondidas— está
verificado por medición directa, no por confianza. Por tanto **no hay salvedad**, y marcarlo ⚠️
sería castigar una redacción imperfecta del CA en vez de juzgar la entrega. **CA-8 ✅.**

### Gates ejecutados hoy, 2026-08-21

| Gate | Resultado |
|---|---|
| `npm test` | **1355/1355** en **89** ficheros, exit 0 |
| `npm run typecheck` | limpio, exit 0 |
| `npm run lint` (`--max-warnings=0`) | limpio, exit 0 |
| `npm run build` | exit 0 |
| `npm run test:e2e` | **227/227** passed (4,4 min), exit 0 |
| Focalizado `check-alive*` | **38/38** (2 ficheros) |
| Los **siete prohibidos** de CA-8 | **141/141**, y ausentes del diff |
| Arnés propio del verificador | **49/49** contra `HEAD`; 29/49 y 44/49 contra los dos controles |

### Estado en que queda

**`hecho`.** Las tres condiciones que el veredicto del 19 dejó pendientes están cumplidas: el merge
está hecho (PR #36), su job `Alive` salió **verde al primer intento**, y su enlace queda pegado
arriba. **Sin follow-ups**: no se abre ninguno.

**Queda abierto, y no es de esta spec**: **SPEC-028** sigue en `en-revision` y el run
`32231957968` es también **su** evidencia RI-02. **EPIC-FIX no se cierra** — es una épica *bucket*,
transversal y siempre abierta.

## Evidencia visual
**n-a**: esta spec no toca UI. No hay captura que hacer y `_qa/SPEC-033/` no debe existir. La
evidencia es la salida de los subprocesos contra servidores de juguete en *loopback*.

## Salvedades / follow-ups
<!-- IDs F-SPEC-033-1, F-SPEC-033-2… con destino (spec futura o EPIC-MEJORA). -->

**Sin follow-ups** —el verificador lo confirma: no abre ninguno—: los nueve CA quedan cubiertos, nada se quedó a medias y no apareció trabajo
necesario fuera de ellos. Dos cosas que sí conviene que el verificador sepa, declaradas aquí y no
descubiertas por él (que es la lección de `F-SPEC-032-3`):

1. **El fichero nuevo lleva un bloque de más: `SPEC-033 CA-9.1`.** CA-8 lo describe como el sitio
   «donde viven CA-1 … CA-5», y esa frase se ha respetado en lo que restringe —la **lista de
   ficheros**, que sigue siendo exactamente dos—. El bloque extra son dos casos que afirman que la
   cabecera del script y su `--help` dicen la regla nueva (*smoke* / *transitorio* / SPEC-033), y
   que el bloque de códigos de salida sigue dentro de la ventana de 60 líneas. Sin ellos, CA-9.1
   sería el único punto de esta spec verificable solo a ojo, y la regla del rol es que **un CA sin
   test no está implementado**. No se creó ningún fichero adicional para alojarlos, precisamente
   para no tocar la lista cerrada de CA-8.
2. **El caso retitulado de `tests/check-alive.test.ts` pasó a rojo antes de pasar a verde.** Con la
   aserción de tiempo añadida (`>= 1800 ms`) falla contra el script viejo, que salía en ~50 ms. Es
   la comprobación que la spec pedía: sin ella el caso «seguiría pasando sin tocarlo», que era
   justamente el argumento para tocarlo.

## Cómo retomar (handoff)
Implementación **completa** en la rama `ft/SPEC-033-carrera-check-alive` (worktree
`.claude/worktrees/spec-033`), sobre `origin/main` @ `0d389c8`. **Sin push y sin PR**: lo hace el
orquestador tras el verificador.

Tres commits, en orden RED → GREEN → docs:

| Sha | Qué |
|---|---|
| `2b8fd46` | `test(SPEC-033)`: RED. Spec y ledger (venían *untracked*), `tests/check-alive-carrera.test.ts` nuevo y la única edición autorizada de `tests/check-alive.test.ts` |
| `4407bab` | `feat(SPEC-033)`: `scripts/check-alive.mjs` — `unknown` transitorio con `--commit`, el aviso único, el veredicto con las dos causas, cabecera y `--help` |
| `f528a45` | `docs(SPEC-033)`: el comentario del código 2 en `deploy-gate.yml` y las tres reescrituras de `docs/despliegue.md` |

Cómo verificarlo, todo **en local, sin desplegar y sin red** (la ventana se simula con `node:http`
en *loopback* y el script corre como subproceso real):

```bash
npm ci                                   # el worktree no traía node_modules propio
npx vitest run tests/check-alive-carrera.test.ts tests/check-alive.test.ts
npx vitest run tests/spec-031-frontera.test.ts tests/spec-032-frontera.test.ts \
  tests/ci-workflow.test.ts tests/deploy-gate-workflow.test.ts \
  tests/runbook-check-alive.test.ts tests/runbook-despliegue-automatico.test.ts \
  tests/reglas-ingenieria-hecho-vivo.test.ts        # los 7 prohibidos, verdes SIN tocarlos
npm run typecheck && npm run lint && npm test
git diff --stat 0d389c8..HEAD                        # CA-7.4 y CA-8: la lista de ficheros
```

Resultados obtenidos el 2026-08-19: **33/33** los dos primeros ficheros, **140/140** los siete
prohibidos, **769/769** la suite entera, typecheck y lint limpios, y el diff toca **7 ficheros**
—ninguno de ellos `ci.yml`, `vercel.json`, `src/` ni `drizzle/`—.

Lo que queda para después del verificador, y no es de esta rama:
- **El propio merge de esta spec es su mejor verificación**: su job `Alive` debe salir **verde a la
  primera**, sin relanzarlo. Ese run sirve además como evidencia **RI-02** para desbloquear el
  cierre de **SPEC-028**, que sigue en `en-revision` con cuatro CA 🚀.
- **EPIC-FIX no se cierra**: es una épica *bucket*, transversal y siempre abierta.

## Notas del verificador (2026-08-19)

Ninguna es un finding; son observaciones para quien lea esto dentro de seis meses.

1. **Orden de precedencia entre `unknown` y sha discrepante al expirar el plazo.** El veredicto
   final lo decide la **última identidad legible**, no un acumulado. Comprobado con dos
   escenarios propios: `unknown` → otro sha persistente da **1** (y nombra esperado y último
   visto); otro sha → `unknown` persistente da **2**. Es coherente con §12.3 —cada código manda
   a mirar un sitio distinto— y ningún CA lo especificaba. Se deja escrito porque es la clase de
   detalle que si no, se redescubre a base de sustos.
2. **El precio del arreglo está pagado a sabiendas.** Un merge cuyo build falle deja el job
   `Alive` corriendo los 900 s antes de ponerse rojo. Está dicho en la spec (§Notas 6), en el
   comentario del workflow y en §12.2 del runbook, y mitigado por la línea única de D-C. No es
   una regresión oculta.
3. **La aserción de ventana de `CA-9.1` es débil, y lo es por consistencia**: `\b0\b`…`\b3\b`
   sobre las primeras 60 líneas es literalmente lo que ya hacía `check-alive.test.ts` 8.4.
   Replicarla no es un descuido; el verificador comprobó además a mano que el bloque ocupa las
   líneas 21–32.
