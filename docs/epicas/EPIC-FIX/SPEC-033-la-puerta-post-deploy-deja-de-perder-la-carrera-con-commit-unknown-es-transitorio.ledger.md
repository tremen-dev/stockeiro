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
| CA-8 los tests ajenos tocados son exactamente los declarados | n-a (es una propiedad del diff) | `git diff --stat 0d389c8..HEAD` → bajo `tests/` solo `check-alive-carrera.test.ts` (nuevo) y `check-alive.test.ts` (1 caso retitulado). Los 7 prohibidos, verdes y sin tocar | `git diff --name-status 0d389c8..HEAD` → bajo `tests/`, exactamente `check-alive-carrera.test.ts` (A) y `check-alive.test.ts` (M, **un solo hunk**, el caso autorizado). Los siete prohibidos, ausentes del diff y verdes. **Salvedad de encaje**: el fichero nuevo aloja además un bloque `SPEC-033 CA-9.1` que CA-8 no enumeró — arbitraje en §Veredicto | ⚠️ |
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
