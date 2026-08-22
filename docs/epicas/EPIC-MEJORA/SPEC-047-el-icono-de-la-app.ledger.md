---
id: SPEC-047
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-047 El icono de la app: la inicial y el punto de la marca, legibles a 16 px

## Resumen
- Fase: `hecho` — **GREEN del verificador el 2026-08-22**. Implementado y **con el arbitraje ya ejecutado**. Los dos
  follow-ups que levantó la implementación (F-SPEC-047-1 y F-SPEC-047-2) están resueltos
  por el gate del 2026-08-22 y aplicados bajo CA-19.
- Rama: `ft/SPEC-047-favicon`, en el worktree `D:/src/wt-47`, creada desde `origin/main` más el
  commit de producto que registra el caso en `docs/epicas/EPIC-MEJORA/_epica.md`.

### Intendencia — léela antes de tocar nada

- **Sesiones en paralelo.** SPEC-046 (EPIC-FIX) y el trabajo de EPIC-006 van por otras ramas y
  otros worktrees. **No toques** `D:/src/tremen-dev/stockeiro` (tiene cambios sin commitear de
  otra sesión), ni `D:/src/wt-e6`, ni `D:/src/wt-46`.
- **El único fichero compartido con alguien es `src/proxy.ts`**, y esta spec le cambia **una
  línea**: la del `matcher`. Si hay conflicto, es trivial.
- **El hallazgo que no se puede olvidar al implementar**: `src/proxy.ts` excluye hoy
  `favicon.ico` del `matcher` pero **no** `icon.svg`, e `isPublicPath` (`src/lib/auth/guard.ts`)
  tampoco lo cubre. Sin esa exclusión, la petición anónima del icono entra en Auth.js, se
  redirige a `/login` **y estampa cookies** — con lo que **SPEC-035 CA-13**
  (`tests/e2e/legal.spec.ts`, «recorrer /legal anónimamente no fija ninguna cookie») se pone
  RED. Es CA-6, CA-7 y CA-8.
- **El e2e corre `next start`** (`tests/e2e/server.mjs`, Postgres efímero, puerto 3200), así que
  la convención de fichero de iconos del App Router se ejercita sobre el build de producción.
  No hace falta inventar montaje.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 — SVG autónomo (ni texto, ni fuente, ni terceros) | `src/app/icon.svg` vía `svgDelIcono` en `scripts/icon-geometry.mjs` | `tests/icono-fichero.test.ts` › CA-1 (6 casos: viewBox cuadrado, cinco elementos prohibidos, fuentes, hosts, `<title>`) | `npm test` — 6/6. Y lectura propia del fichero comiteado: `viewBox="0 0 32 32"` (cuadrado); los únicos elementos son `svg`, `title`, `rect`, `path`, `circle` — ni `text`, `tspan`, `script`, `foreignObject` ni `image`; ni `font-family`, `@font-face` o `@import`. La única cadena `http` del fichero es el `xmlns` del espacio de nombres SVG, que ningún renderizador descarga. | ✅ |
| CA-2 — el SVG no cambia según quién lo mire | `src/app/icon.svg` | `tests/icono-fichero.test.ts` › CA-2 (3 casos: `prefers-color-scheme`, `currentColor`, `var(--`) | `npm test` — 3/3. Búsqueda propia sobre el fichero: no aparece `prefers-color-scheme`, ni `currentColor`, ni `var(--`. Los tres colores son literales de 6 dígitos. | ✅ |
| CA-3 — el `.ico` trae 16, 32 y 48 | `src/app/favicon.ico`, `codificarIco`/`icoDelIcono` en `scripts/icon-geometry.mjs` | `tests/icono-fichero.test.ts` › CA-3 (cabecera + decodificación de cada entrada), con lector propio en `tests/icono-raster.ts` | `npm test` — 2/2. Y parseo propio del binario, con un lector escrito por el verificador: `ICONDIR` reservado=0, tipo=1, **3 entradas**; declaradas 16×16, 32×32 y 48×48; cada DIB con cabecera de 40 bytes, 32 bpp y `BI_RGB`, y decodifica a esas dimensiones exactas. | ✅ |
| CA-4 — los `<link>` los pone Next, y sólo una vez | convención de fichero del App Router: `src/app/icon.svg` + `src/app/favicon.ico`; `src/app/layout.tsx` **sin tocar** | mitad estática en `tests/icono-frontera.test.ts` › CA-4; mitad servida en `tests/e2e/icono.spec.ts` › CA-4 | `npx playwright test` — 2/2, y `npm test` — 2/2. Comprobación propia contra `next start` (build de producción, puerto 3299): `/legal/aviso-legal` y `/login` emiten **exactamente dos** `<link rel="icon">` — `/favicon.ico?favicon.1a9sdmo-23tw5.ico` (`type="image/x-icon"`) y `/icon.svg?icon.18uo1x-ipl1h-.svg` (`type="image/svg+xml"`) —, uno de cada y ninguno duplicado. `src/app/layout.tsx` no contiene ni `rel="icon"` ni `icons:`; `public/` no existe. | ✅ |
| CA-5 — los colores son los tokens, leídos de su fuente | `tokensDeMarca()` en `scripts/icon-geometry.mjs` lee `design/tremen-ds/colors_and_type.css` | `tests/icono-fichero.test.ts` › CA-5 (extractor propio, independiente del generador) | `npm test` — 2/2. Extracción propia de `design/tremen-ds/colors_and_type.css`: `--bg` = `#111110`, `--bone` = `#F5F1EA`, `--accent` = `var(--ember)` → `#FF6B00`. Los únicos literales de color del SVG son esos tres, y cada forma lleva el suyo. | ✅ |
| CA-6 — un anónimo recibe el icono, no un desvío a `/login` | `src/proxy.ts` — `icon.svg` añadido a la exclusión del `matcher` | `tests/e2e/icono.spec.ts` › CA-6 | `npx playwright test` — verde. Y petición propia con `curl` **sin sesión** contra `next start`: los cuatro URL (`/icon.svg` y `/favicon.ico`, con y sin el hash de caché que emite el framework) devuelven **200** con `content-type: image/svg+xml` y `image/x-icon`. Ni un 3xx, ni un `text/html`, ni rastro de `/login`. | ✅ |
| CA-7 — pedir el icono no estampa cookie | `src/proxy.ts` (misma línea) | `tests/e2e/icono.spec.ts` › CA-7; y `tests/e2e/legal.spec.ts` › CA-13 sigue verde **sin tocar una aserción** | `npx playwright test` — verde. En mis peticiones directas ninguna de las cuatro respuestas trae **`Set-Cookie`**. Y con un Playwright propio, contexto anónimo recorriendo `/legal`, `/legal/aviso-legal`, `/legal/privacidad`, `/legal/terminos`, `/login` y `/`: `context.cookies()` = `[]`, **cero** respuestas con `Set-Cookie` y **cero** peticiones a hosts externos. `tests/e2e/legal.spec.ts` no aparece en el diff y su CA-13 pasa. | ✅ |
| CA-8 — el icono no sabe quién lo pide (RN-01, RN-03) | `src/proxy.ts`; `src/lib/auth/guard.ts` **intacto** | `tests/e2e/icono.spec.ts` › CA-8 (bytes con y sin sesión) + `tests/icono-frontera.test.ts` › CA-16 (una sola línea de código) | `npx playwright test` — verde (bytes con y sin sesión). Verificación propia más fuerte: el `sha256` del cuerpo servido coincide con el del fichero comiteado en las cuatro peticiones — `5324f5a7…` para el `.ico` y `43f9d359…` para el SVG. `src/lib/auth/guard.ts` **no aparece en el diff** y `PUBLIC_PREFIXES` sigue con sus siete entradas de siempre. | ✅ |
| CA-9 — la geometría cumple el contrato de proporciones | `scripts/icon-geometry.mjs` (altura 22, trazo 5, semiejes 9,5×6,75, punto ⌀7 en 26,5/23, rx 6) | `tests/icono-fichero.test.ts` › CA-9 (6 casos, midiendo el `d` del fichero committeado) | `npm test` — 6/6. Medición propia del `d` comiteado: altura de mayúscula **21,996** (18–22); teselá `0 0 32 32` con `rx=6`, `fill` de 6 dígitos y sin `opacity`/`fill-opacity`/`rgba(`; punto ⌀7 centrado en (26,5 / 23) → mitad derecha y mitad inferior; separación mínima S↔punto **2,361** (≥ 2); toda la tinta dentro de x∈[2,00 – 30,00] e y∈[5,00 – 27,00], o sea el margen de 2 respetado por los cuatro lados. | ✅ |
| CA-10 — sólo tres formas, y son las del wordmark | `src/app/icon.svg` | `tests/icono-fichero.test.ts` › CA-10 (2 casos) | `npm test` — 2/2. Recuento propio: exactamente tres elementos de dibujo (`rect`, `path`, `circle`) y ni un `linearGradient`, `radialGradient`, `filter`, `pattern` o `mask`. | ✅ |
| CA-11 — contraste ≥ 15:1 (S) y ≥ 6:1 (punto) | tokens del sistema de diseño, sin retoque | `tests/icono-fichero.test.ts` › CA-11 (WCAG 2.x sobre los literales extraídos del CSS) | `npm test` — 2/2. Cálculo WCAG 2.x propio sobre los tres literales: hueso/teselá **16,78:1** (≥ 15) y acento/teselá **6,62:1** (≥ 6). | ✅ |
| CA-12 — a 16 px el punto sobrevive y sigue separado | `rasterizar()` en `scripts/icon-geometry.mjs` | `tests/icono-16px.test.ts` › CA-12 (`.ico`, 4 casos) + `tests/e2e/icono.spec.ts` › CA-12 (SVG en `<canvas>`) | `npm test` — 4/4 sobre el `.ico`; `npx playwright test` — verde sobre el SVG. Medición propia decodificando el `.ico` a 16×16: **7** píxeles de acento (≥ 6), **una sola** región conexa por 8-vecindad, centroide en **(12,71 / 11,00)** —mitad derecha y mitad inferior— y **0** adyacencias acento↔hueso: el punto y la letra no se han fundido. | ✅ |
| CA-13 — a 16 px la S conserva sus dos ojos | `scripts/icon-geometry.mjs` — barrido 295° y ojo de 3,5 sobre la rejilla | `tests/icono-16px.test.ts` › CA-13 (16 y 32) + `tests/e2e/icono.spec.ts` › CA-13 | `npm test` — 2/2; `npx playwright test` — verde. Medición propia: a **16 px**, patrón `hueso → fondo → hueso` con ≥ 1 px de fondo en y=5 (mitad superior de la caja) y en y=10 (mitad inferior); a **32 px**, en y=10–13 y en y=18–21 con ≥ 2 px de fondo. Los dos ojos siguen abiertos. | ✅ |
| CA-14 — a 16 px la tinta ocupa entre el 15 % y el 40 %, y el suelo es opaco | `scripts/icon-geometry.mjs` — teselá opaca a sangre (D-1) | `tests/icono-16px.test.ts` › CA-14 (3 casos) + `tests/e2e/icono.spec.ts` › CA-14 | `npm test` — 3/3; `npx playwright test` — verde. Medición propia a 16×16 (256 píxeles): hueso **49 px = 19,1 %** (dentro del 15–40 %); **0** píxeles no opacos fuera de los cuadrados de 3 px de las cuatro esquinas; caja de tinta x[1,14] y[3,12], sin tocar el borde. El suelo es opaco de verdad. | ✅ |
| CA-15 — SVG y `.ico` son el mismo icono | los dos formatos salen de la MISMA polilínea en `scripts/icon-geometry.mjs` | `tests/e2e/icono.spec.ts` › CA-15 | `npx playwright test` — verde. Y a ojo, sobre `_qa/SPEC-047/icono-16px-ampliado.png`, los dos rasterizados a 16 px son indistinguibles; la cobertura de hueso que medí en el `.ico` es 19,1 %, bien dentro de los 8 puntos de tolerancia. | ✅ |
| CA-16 — el diff está acotado (CE-M1) | nada bajo `src/db/`, `drizzle/` ni `src/lib/`; evidencia sólo en `_qa/SPEC-047/` | `tests/icono-frontera.test.ts` › CA-16 (4 casos, sobre **lo comiteado**: `origin/main...HEAD`. Incluye «ninguna otra `_qa/SPEC-NNN/` en el diff») | `npm test` — 4/4. Comprobación propia: `git diff --name-status origin/main...HEAD` = **22 ficheros**, todos dentro del conjunto pactado; ni uno bajo `src/db/`, `drizzle/` o `src/lib/`; la única carpeta de `_qa/` es `_qa/SPEC-047/`. Tras dos pasadas completas de la e2e, `_qa/SPEC-047/` **no aparece modificada** (la evidencia es reproducible); el ruido en las `_qa/SPEC-0xx/` ajenas es el preexistente y se descartó sin cometer. Salvedad de forma anotada en el veredicto (el diff de `src/proxy.ts` es 1 línea de código, más un bloque de comentario). | ✅ |
| CA-17 — el `.ico` se reproduce, y sin dependencia nueva | `scripts/build-icon.mjs` + `npm run icon:build` | `tests/icono-frontera.test.ts` › CA-17 (4 casos: bytes idénticos, script declarado, cero deps, sólo `node:*`) | `npm test` — 4/4, y **ejecutado por el verificador** sobre árbol limpio: `node scripts/build-icon.mjs --out <tmp>` produce `sha256 5324f5a723a5…` (`favicon.ico`) y `43f9d359292b…` (`icon.svg`), **byte a byte idénticos** a los comiteados. `git show origin/main:package.json` frente al actual: `dependencies` y `devDependencies` **sin un solo cambio**; el generador sólo importa de `node:*`. | ✅ |
| CA-18 — suites enteras verdes, y lo ajeno intacto salvo lo que CA-19 nombra | — | `tests/icono-frontera.test.ts` › CA-18 (2 casos: los modificados bajo `tests/` son EXACTAMENTE las tres guardias — un cuarto es RED —, y `tests/e2e/legal.spec.ts` no aparece en el diff) + ejecución completa de `npm test` y `npx playwright test` | Ejecutadas enteras por el verificador: **`npm test` 1505/1505** en 100 ficheros (con el `testTimeout: 20000` por defecto, sin banderas) y **`npx playwright test` 255/255**. `npm run typecheck` y `npm run lint --max-warnings=0` limpios; `npm run version:check` confirma 0.3.0 → 0.3.1. El diff sobre `tests/` modifica **exactamente** los tres ficheros de CA-19 y todo lo demás son altas. `tests/e2e/legal.spec.ts` no está en el diff: **SPEC-035 CA-12** (4 casos) y **CA-13** (2 casos) pasan por mérito propio, y lo confirmé además con mi propio Playwright. | ✅ |
| CA-19 — las tres guardias ajenas se amplían nombradas, y ninguna propiedad se debilita | `tests/legal-rutas-publicas.test.ts`, `tests/cuenta-rutas.test.ts` (literal del `matcher` + `|icon.svg`, por CA-6/CA-7) y `tests/deploy-gate-workflow.test.ts` (lista de `scripts` + `icon:build`, por CA-17); cada una con su porqué escrito al lado de la aserción | `tests/icono-guardias-ampliadas.test.ts` › CA-19.1 (4 casos), CA-19.2 (3), CA-19.3 (6, con **remutación**: la guardia se vuelve a ejecutar contra una entrada con un cuarto elemento inventado y tiene que rechazarla), CA-19.4 (4) | `npm test` — 17/17, y **re-verificado a mano por el verificador, mutando el árbol** (detalle en el veredicto): con `|inventado.png` en el `matcher` las dos guardias del literal vuelven a **RED**; con `"inventado:x"` en `scripts` la lista cerrada vuelve a **RED**. Ninguna aserción se ha aflojado (`toContain` sigue sobre cadena literal, `toEqual` sobre array literal; ni `arrayContaining`, ni regex, ni `.skip`/`.only`/`xit` nuevos), las tres hermanas están **byte a byte** como en `origin/main`, y no hay un cuarto fichero ajeno modificado. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-22, sdd-verificador.** Los 19 CA cerrados con evidencia propia. Ni un ❌, ni
una ⚠️.

Este veredicto se emite sin haber leído el informe del implementador: se juzgan artefactos. Todo
lo que se afirma abajo lo ejecutó o lo midió el verificador en el worktree `D:/src/wt-47`, sobre
`ft/SPEC-047-favicon` en `96f497c`, con el árbol limpio antes y después.

### Cifras reales

| Gate | Resultado |
|---|---|
| `npm test` (vitest, `testTimeout` por defecto, sin banderas) | **1505 pasadas / 0 falladas**, 100 ficheros, 202 s |
| `npx playwright test` (suite entera, `next start` + Postgres efímero) | **255 pasadas / 0 falladas**, 3,7 min |
| `npm run typecheck` | limpio |
| `npm run lint` (`--max-warnings=0`) | limpio |
| `npm run version:check` | 0.3.0 → 0.3.1 |

Los **timeouts intermitentes** que este ledger avisaba en `tests/account-deletion.test.ts` y
`tests/spec043-sin-refrescar.test.ts` **no se reprodujeron**: la batería entera pasó a la primera
con el presupuesto por defecto de `vitest.config.ts`. No hay regresión que imputar a esta rama.

### Lo que se apretó de verdad: el arbitraje (CA-18 / CA-19)

Es el punto donde una spec así se rompe, y se verificó **por mutación del árbol**, no leyendo el
diff.

1. **Los ficheros ajenos modificados son exactamente tres.** `git diff --name-status
   origin/main...HEAD -- tests/` da tres `M` —`tests/cuenta-rutas.test.ts`,
   `tests/deploy-gate-workflow.test.ts`, `tests/legal-rutas-publicas.test.ts`— y seis `A`. **No
   hay cuarto.**
2. **Mutación del `matcher`.** Metí `|inventado.png` en la exclusión de `src/proxy.ts` y volví a
   correr las guardias: **4 falladas / 40 pasadas** — las dos guardias del literal (SPEC-035 CA-2
   y SPEC-036 CA-10) y los dos casos de CA-19.3 que las vuelven a ejecutar contra una entrada
   mutada. La lista **sigue cerrada**: un elemento de más la pone en rojo igual que antes.
3. **Mutación de `package.json`.** Metí la clave `"inventado:x"` en `scripts`: **2 falladas /
   61 pasadas** — SPEC-028 CA-9.3 y su vigilante de CA-19.3. La comparación sigue siendo un
   `toEqual` contra un array literal de 13 claves, no un mínimo.
4. **Revertido y comprobado.** Tras las dos mutaciones, `git status` vacío y los `sha256` de
   `src/proxy.ts`, `package.json`, `src/app/icon.svg` y `src/app/favicon.ico` son los del commit.
5. **Nada se ha aflojado.** Las únicas dos líneas de aserción retiradas en todo el diff de
   `tests/` son los dos literales del `matcher`, sustituidos por el mismo literal con un
   elemento más. `toContain` era ya `toContain` antes de esta spec y sigue comparando una
   **cadena literal completa**; `toEqual` sigue siendo `toEqual`. No hay ni un `arrayContaining`,
   ni un `stringMatching`, ni una regex permisiva, ni un `.skip`/`.only`/`xit` nuevo, ni un
   umbral relajado en ninguna parte del diff.
6. **Las hermanas siguen verdes y sin tocar.** Las tres —«ninguna ruta concreta se cuela como
   excepción DENTRO del matcher», «ni `cuenta` ni `cuenta-borrada` aparecen dentro del literal»
   y «drizzle/ no gana ningún .sql en ESTA entrega»— son **byte a byte** las de `origin/main`, y
   pasan. `PUBLIC_PREFIXES` no se ha tocado: `src/lib/auth/guard.ts` no aparece en el diff.
7. **SPEC-035 CA-12 y CA-13, por mérito propio.** `tests/e2e/legal.spec.ts` no está en el diff.
   Sus casos pasan, y además lo comprobé por mi cuenta con un Playwright escrito por mí:
   recorriendo `/legal`, sus tres subrutas, `/login` y `/` sin sesión, el contexto acaba con
   **cero cookies**, **cero** respuestas con `Set-Cookie` y **cero** peticiones fuera del origen.
   Es exactamente el fallo que el `matcher` habría causado, y no ocurre.

### El icono, medido y mirado

Medido con un decodificador de `.ico` y un analizador de píxeles escritos por el verificador,
independientes de los del implementador. A **16×16**: 49 px de hueso (**19,1 %**, dentro del
15–40 %), 7 px de acento en **una** región conexa con centroide en (12,71 / 11,00), **cero**
adyacencias acento↔hueso, ojos abiertos en y=5 y en y=10, y **cero** píxeles no opacos fuera del
redondeo. A 32×32 y 48×48, lo mismo con holgura. El `.ico` regenerado con `npm run icon:build`
sale **byte a byte idéntico** al comiteado, y no entra ni una dependencia.

Y mirado, que es lo que §Notas pto. 5 pide: se rasterizó el SVG **servido por la app** a 16, 24,
32, 64 y 128 px sobre cromo claro y oscuro, y en una simulación de pestaña. A 16 px la S se lee
como S, con los dos ojos abiertos, y el punto naranja se lee como punto y no como una mancha
pegada a la letra. El suelo propio hace que el icono sea el mismo sobre barra clara y oscura.
**El juicio estético final sigue siendo del humano** (§Notas pto. 5): la evidencia está en
`_qa/SPEC-047/`, es reproducible, y ahí es donde toca mirarla.

### Una salvedad de forma que NO bloquea, y por qué

CA-16 dice que el cambio en `src/proxy.ts` «afecta a **una sola línea**: la del `matcher`». El
diff real cambia esa línea **y añade 21 líneas de comentario** explicando el porqué. Se acepta
como ✅, no como ⚠️, por tres razones: (a) el test de CA-16 audita explícitamente **líneas de
código**, con el criterio escrito al lado de la aserción, y en código el diff es exactamente 1
quitada y 1 puesta; (b) un comentario no es comportamiento, y lo que CE-M1 acota es dato,
cálculo y regla; (c) la propia CA-19.2 de esta spec **exige** dejar el porqué escrito junto a lo
que se toca, que es la misma disciplina aplicada al fichero de producción. Queda anotado para
que nadie lo descubra como sorpresa en el merge.

### Residuales que deben quedar escritos

- **Puertos fijos en el e2e.** `tests/e2e/server.mjs` clava 3200 (app) y 54329 (Postgres), así que
  **dos worktrees no pueden correr la e2e a la vez**: durante esta verificación el worktree de
  SPEC-046 los tenía tomados y `npx playwright test` murió primero con «is already used» y
  después con un timeout de `webServer`. Es infraestructura preexistente y ajena a esta spec,
  pero muerde a diario en este proyecto. *Destino*: EPIC-INFRA.
- **Un flake de Chromium, no una regresión.** En la primera pasada completa,
  `tests/e2e/admin-grifo.spec.ts` (SPEC-037 CA-6) falló con
  `page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot`. En
  aislado pasa **10/10** y en la segunda pasada completa pasa. No es aserción fallada ni tiene
  nada que ver con el icono.
- **`docs/tablero.md` no se ha regenerado en esta rama** (el diff de tres puntos no lo toca). Al
  cerrar hay que pasarle `sdd-documentalista`.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-047/. Informe HTML opcional: _qa/SPEC-047/informe.html -->

Pedida expresamente en §Notas para el gate, pto. 5: **una captura del icono a 16 px** (la
pestaña real, no el SVG ampliado) y otra a 32 px, para que el humano juzgue lo que los números
no cubren. Añadir también una sobre cromo **claro** y otra sobre cromo **oscuro**, que es lo
que demuestra D-1 (el icono trae su propio suelo).

**Producidas y comiteadas** en `_qa/SPEC-047/`, que es el domicilio que le dio CA-16 al
resolver F-SPEC-047-1. Las genera `tests/e2e/icono.spec.ts` (bloque *«lo que los números no
cubren: el icono, para mirarlo»*), así que se regeneran con
`npx playwright test tests/e2e/icono.spec.ts`:

| Fichero | Qué enseña | CA que ilustra |
|---|---|---|
| `_qa/SPEC-047/icono-cromo-claro-y-oscuro.png` | el icono a 16, 32 y 64 px sobre cromo **claro** y sobre cromo **oscuro** | D-1 y CA-14: el icono trae su propio suelo, y por eso se ve igual en los dos |
| `_qa/SPEC-047/icono-16px-ampliado.png` | los 256 píxeles del SVG y los del `.ico`, ampliados ×16 y sin suavizar, uno al lado del otro | CA-12, CA-13, CA-14 y CA-15 — es exactamente lo que cuentan los tests, para un ojo humano |

Y en `test-results/SPEC-047/` (ignorado) queda el artefacto de trabajo: `icon.svg`, tal y como
lo sirvió la app.

Lo que se ve: a 16 px la S llena el cuadro con los dos ojos abiertos y el punto se lee como
punto, separado de la letra; los dos formatos son indistinguibles a simple vista; y el suelo
propio hace que el icono se vea igual sobre la barra clara y sobre la oscura.

Queda por hacer lo que ningún test puede hacer y §Notas pto. 5 pide expresamente: **que el
humano mire la pestaña real** en el gate del verificador. Hay un salto entre «cumple los
números» y «lo reconozco de un vistazo entre veinte pestañas».

## Salvedades / follow-ups
<!-- IDs F-SPEC-047-1, F-SPEC-047-2… con destino (spec futura o EPIC-MEJORA). -->

Candidatos ya identificados al escribir la spec, **abiertos sólo si el gate los acepta**:

- Manifiesto PWA + `apple-icon` (viajan juntos) — EPIC-MEJORA, cuando un tester pida instalarla.
- Imagen de Open Graph / Twitter card — spec propia; arrastra `metadataBase`. Ver §Notas, pto. 2.
- `theme-color` — barato, cuando se pida.
- El `matcher` de `src/proxy.ts` tiene alternativas sin anclar ni escapar (`favicon.ico` empareja
  el punto como comodín). Visto y **no** arreglado aquí; EPIC-FIX si alguien demuestra que muerde.

Y los dos que ha levantado la implementación:

- **F-SPEC-047-1 — CA-16 no deja sitio para la evidencia visual. RESUELTO por el arquitecto,
  2026-08-22, enmendando CA-16.** El reparto queda escrito y es el que el implementador ya
  eligió, ahora con respaldo en la spec: **capturas de trabajo → `test-results/SPEC-047/`**
  (ignorado, no puede ensuciar el diff) y **evidencia que se commitea → `_qa/SPEC-047/`**, que
  entra en el conjunto de CA-16 como **única** carpeta de `_qa/` admitida — ninguna otra
  `_qa/SPEC-NNN/` puede aparecer en el diff. Y CA-16 pasa a evaluarse sobre **lo comiteado**
  (`HEAD`, árbol limpio) y no sobre el árbol de trabajo, precisamente porque la suite e2e
  reescribe `_qa/` de specs viejas: ese ruido es **preexistente**, se descarta y no se commitea.
  El texto de abajo es el planteamiento original del implementador y se conserva.

  El conjunto cerrado de
  ficheros que CA-16 permite (`src/app/icon.svg`, `src/app/favicon.ico`, `src/proxy.ts`,
  `scripts/`, `tests/`, `docs/`, `package.json`) **no incluye `_qa/`**, que en este repositorio
  no está en `.gitignore` y sí se comete. Es decir: la §Evidencia visual de este mismo ledger
  pide capturas en `_qa/SPEC-047/` y CA-16 las prohíbe. Aquí se ha resuelto por el lado que no
  rompe nada —las capturas van a `test-results/`, que sí está ignorado— pero el verificador se
  va a topar con la misma pared si comete las suyas. Y no hace falta cometer nada para chocar:
  **ejecutar la suite e2e entera reescribe `_qa/SPEC-001/…` y compañía**, porque media docena de
  specs viejas guardan ahí sus capturas; después de un `npx playwright test` completo hay que
  hacer `git checkout -- _qa` o el propio test de CA-16 se pone rojo por ficheros que no son de
  esta spec. *Destino*: decidirlo en el gate (ampliar CA-16 con `_qa/` es una frase), o dejarlo
  escrito como convención para las mejoras siguientes.

- **F-SPEC-047-2 — CA-18 y CA-6/7/8/16/17 no se pueden cumplir a la vez. RESUELTO por el
  humano (Alberto Fojo) en el gate del 2026-08-22: se amplían las tres guardias y NO se retira
  `icon.svg`.** La autorización es nominal y vive en la spec —§El arbitraje de las tres
  guardias ajenas y **CA-19**—, no aquí: un ledger no autoriza a tocar un test ajeno. Lo que
  CA-19 exige de quien lo ejecute: las tres nombradas y sólo esas tres; el porqué escrito **al
  lado de la aserción**, en el propio fichero de test; ampliación y nunca aflojada (la lista
  sigue cerrada, nada de `.skip` ni de regex permisiva); y las tres hermanas que miden la
  propiedad, verdes y sin tocar. Un cuarto fichero ajeno modificado sigue siendo RED (CA-18).
  El planteamiento original del implementador se conserva abajo, tal cual lo escribió.

  *Ejecutado el 2026-08-22*, bajo CA-19 y con su test propio
  (`tests/icono-guardias-ampliadas.test.ts`, 17 casos). Las tres ampliaciones, una a una:

  | Guardia | Qué crece | Por qué CA |
  |---|---|---|
  | `tests/legal-rutas-publicas.test.ts` (SPEC-035 CA-2) | el literal del `matcher` gana `|icon.svg` | CA-6 y CA-7 |
  | `tests/cuenta-rutas.test.ts` (SPEC-036 CA-10) | el mismo literal, calcado | CA-6 y CA-7 |
  | `tests/deploy-gate-workflow.test.ts` (SPEC-028 CA-9.3) | la lista de `scripts` gana `icon:build` (12 → 13 claves) | CA-17 |

  Y así se comprobó cada condición, que es lo que hace que esto no sea una excepción de palabra:

  - **19.1** — el diff sobre `tests/` modifica **exactamente** esos tres ficheros. Antes de
    tocar nada se buscó por todo el árbol si había un cuarto: `_next/image` sólo aparece en
    esos dos tests y en `src/proxy.ts`, y la única lista **cerrada** de `scripts` es la de
    `deploy-gate` (la de `ci-workflow.test.ts:251` usa `arrayContaining`, así que no es
    cerrada y no se toca). **No apareció ningún cuarto fichero.**
  - **19.2** — cada aserción lleva encima su bloque de comentario con qué vigilaba, qué vigila,
    en virtud de qué CA entra el elemento, la fecha y el arbitraje. El test lo exige por texto.
  - **19.3, la de verdad** — no se dio por buena leyendo el diff. Se **mutó el árbol real**:
    `|inventado.svg` metido en el `matcher` de `src/proxy.ts` y una clave `"inventado:x"`
    metida en `package.json`; con esa mutación las tres guardias volvieron a **3 failed /
    46 passed**, exactamente las mismas tres y por la misma razón que antes de ampliarlas. Se
    revirtió la mutación acto seguido. Y para que no dependa de que alguien lo repita a mano,
    CA-19.3 deja esa remutación **dentro del test**: vuelve a ejecutar la comparación de cada
    guardia contra una entrada con un cuarto elemento inventado y exige que la rechace, además
    de auditar que el operador sigue siendo exacto (`toContain` sobre cadena literal,
    `toEqual` sobre array literal) y que no hay ningún `.skip`/`.only`.
  - **19.4** — las tres hermanas se comparan **byte a byte** contra `git show origin/main:…`,
    igual que el resto de casos de esos tres ficheros: el único que difiere es el ampliado.

  *Planteamiento original (bloqueante entonces):* Tres tests **ajenos** se ponen en rojo con este cambio, y ninguno de los
  tres se puede arreglar sin **modificar una aserción existente**, que es exactamente lo que
  CA-18 prohíbe. No se ha tocado ninguno.

  | Test ajeno | Qué congela | Por qué se rompe |
  |---|---|---|
  | `tests/legal-rutas-publicas.test.ts:53` — *SPEC-035 CA-2 › «sigue siendo el de siempre»* | el literal `matcher: ['/((?!api\|_next/static\|_next/image\|favicon.ico).*)']` | CA-16 exige cambiar esa línea, y CA-6/7/8 no se pueden cumplir sin cambiarla |
  | `tests/cuenta-rutas.test.ts:69` — *SPEC-036 CA-10 › «sigue siendo el de siempre»* | el mismo literal, copiado | lo mismo |
  | `tests/deploy-gate-workflow.test.ts:356` — *SPEC-028 CA-9.3 › «package.json no gana ningún script sin un CA que lo pida»* | la lista cerrada de `scripts` de `package.json` | CA-17 exige que el generador sea `invocable por un npm run`, y eso es `icon:build` |

  **Lo que la spec sí previó y sigue en verde:** los dos que cita CA-18 por su nombre —SPEC-035
  CA-12 (ni un recurso de terceros) y SPEC-035 CA-13 (ninguna cookie al recorrer `/legal`)— pasan
  sin que se les haya tocado una aserción. El e2e entero está en verde: **254/254**.

  **La propiedad que esos tres tests defienden no se ha violado**, y por eso esto es un arbitraje
  y no un error: SPEC-035 CA-2 y SPEC-036 CA-10 protegen *«el matcher no conoce rutas de
  producto; quien decide qué PÁGINA es pública es el guard»* —y sigue siendo cierto: lo añadido
  es un **activo**, `PUBLIC_PREFIXES` no se ha tocado, y sus dos casos hermanos («ninguna ruta
  concreta se cuela dentro del matcher») **siguen verdes**. Lo que se cae es la otra mitad, que
  es una **foto del árbol**: un literal congelado. SPEC-028 CA-9.3 ya fue ampliada una vez por
  esta misma razón, y lo dejó escrito en el propio test: *«Se amplía con la entrada que un CA
  pide, y con esa sola»* (fue `version:check`, de SPEC-038 CA-13).

  **Las dos salidas, y las dos son del humano, no mías:**
  1. **Ampliar las tres aserciones** —el literal del matcher en los dos ficheros, y la lista de
     scripts en el tercero— dejando escrito el porqué al lado, como ya se hizo con `version:check`.
     Es un cambio de tres líneas y deja SPEC-047 entera en verde. Exige relajar CA-18, que dice
     «sólo añade ficheros o casos nuevos».
  2. **Retirar el `icon.svg`** y entregar sólo el `.ico`, que ya estaba excluido del matcher.
     Es la salida que la propia spec ofrece en §Notas para el gate, pto. 3. No toca el guardián
     de sesión ni ninguna aserción ajena, pero pierde la nitidez en pantallas densas, el formato
     que mejor envejece, y deja CA-1, CA-2, CA-5, CA-9, CA-10 y CA-15 sin objeto.

  *Recomendación de quien ha implementado*: la 1. La 2 tira el 80 % de la spec para salvar dos
  literales que ya nacieron sabiendo que caducarían.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Implementado y committeado en `ft/SPEC-047-favicon`** (worktree `D:/src/wt-47`), con el
arbitraje del 2026-08-22 ya ejecutado bajo CA-19. Lo que hay:

| Fichero | Qué es |
|---|---|
| `scripts/icon-geometry.mjs` | la fuente: tokens leídos del sistema de diseño, geometría sobre la rejilla de 32, trazado de la S, rasterizador y codificador de `.ico`. Sólo `node:*`. |
| `scripts/build-icon.mjs` | `npm run icon:build`. Acepta `--out <dir>`, que es como lo llama el test de CA-17. |
| `src/app/icon.svg`, `src/app/favicon.ico` | generados, no escritos a mano. 5,2 KB y 14,7 KB. |
| `src/proxy.ts` | **una línea de código**: `icon.svg` sumado a la exclusión del `matcher`. El resto del diff son comentarios con el porqué, en el estilo en prosa del propio fichero. |
| `tests/icono-raster.ts` | herramientas de medida sobre píxeles + lector de `.ico` propio, compartidas por la suite unitaria y la e2e. |
| `tests/icono-fichero.test.ts` · `icono-16px.test.ts` · `icono-frontera.test.ts` | 46 casos unitarios: forma de los ficheros, píxeles del `.ico` y frontera del diff. |
| `tests/icono-guardias-ampliadas.test.ts` | CA-19: 17 casos que vigilan la ampliación de las tres guardias ajenas, remutación incluida. |
| `tests/e2e/icono.spec.ts` | 12 casos: los CA que piden servidor y rasterizador, más la evidencia visual. |
| `_qa/SPEC-047/` | la evidencia comiteada (dos PNG). La genera la e2e; ninguna otra `_qa/SPEC-NNN/` entra en el diff. |
| las tres guardias ajenas | ampliadas bajo CA-19 y sólo esas tres: `tests/legal-rutas-publicas.test.ts`, `tests/cuenta-rutas.test.ts`, `tests/deploy-gate-workflow.test.ts`. |
| `package.json` | `icon:build` y `0.3.0 → 0.3.1` (ADR-024: esto toca `src/`, así que el número sube; PATCH porque es presentación pura). |

**Cifras reales, tras ejecutar CA-19 (2026-08-22):**
- `npx playwright test` — **255 passed, 0 failed** (12 de esta spec). `tests/e2e/legal.spec.ts`
  no aparece en el diff, así que SPEC-035 CA-12 y CA-13 pasan por mérito propio.
- `npm test` — **1505 passed, 0 failed**, 100 ficheros. Las tres guardias ampliadas incluidas:
  antes de la enmienda eran 1483 pasadas y **3 falladas**; ahora no falla ninguna.
- `npm run typecheck` y `npm run lint` — limpios.

*Un aviso honesto sobre el número de arriba*: con el presupuesto por defecto de
`vitest.config.ts` (`testTimeout: 20000`) esta máquina dio **timeouts intermitentes** en dos
ficheros que no tienen nada que ver con esta spec —`tests/account-deletion.test.ts` y
`tests/spec043-sin-refrescar.test.ts`—, y no siempre los mismos entre ejecuciones. No son
aserciones falladas: son arranques de Postgres WASM que no caben en 20 s cuando la máquina
viene de compilar y de correr Playwright. Se comprobó de dos formas: los dos ficheros pasan
**48/48 en aislado**, y la batería entera pasa **1505/1505 con `--testTimeout=60000`**, sin
tocar ni un fichero. Es ruido de máquina, preexistente y ajeno; si reaparece en CI, es
EPIC-FIX y no de aquí.

**Lo primero que hay que hacer al retomar**: nada pendiente por parte del implementador. Los
19 CA están implementados con su test y las dos suites están enteras en verde. Lo que queda es
el gate del verificador, y en él la única cosa que ningún test cubre: **mirar la pestaña real**
(§Notas pto. 5), con `_qa/SPEC-047/` delante.

**Dos trampas de este repositorio que conviene saber antes de correr nada:**

1. **La suite e2e reescribe `_qa/` de specs viejas.** Media docena de specs guardan ahí sus
   capturas y las regeneran al correr, así que tras un `npx playwright test` completo el árbol
   sale sucio con ficheros que no son de esta spec. Es ruido preexistente: se descarta con
   `git checkout -- _qa` y **no se commitea**. CA-16 lo contempla desde la enmienda —se evalúa
   sobre lo comiteado— y tiene un caso propio que caza cualquier `_qa/SPEC-NNN/` ajena.
2. **El e2e necesita `npm run build` antes.** `tests/e2e/server.mjs` arranca `next start`
   sobre un Postgres efímero, pero no construye: sin `.next` no hay servidor. Y el build pide
   `DATABASE_URL`, `DB_DRIVER=pg` y `AUTH_SECRET` en el entorno, aunque sean de juguete.

**Cómo se regenera el binario**, que es lo que R-5 pedía dejar escrito: `npm run icon:build`.
Lee los tres colores de `design/tremen-ds/colors_and_type.css`, rasteriza el vector a 16, 32 y 48
—el 16 **no** sale de reescalar el 32— y reescribe los dos ficheros. `tests/icono-frontera.test.ts`
lo ejecuta contra un directorio temporal y compara byte a byte, así que un `.ico` retocado por
fuera se cae el mismo día. Para mover el dibujo se tocan las constantes de la cabecera de
`scripts/icon-geometry.mjs` (`ALTURA`, `TRAZO`, `SEMI_X`, `BARRIDO`, `PUNTO`, `RADIO_TESELA`) y se
vuelve a generar; los CA de 16 px dirán enseguida si el retoque ha cerrado un ojo.
