---
id: SPEC-047
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-047 El icono de la app: la inicial y el punto de la marca, legibles a 16 px

## Resumen
- Fase: `en-revision` — implementado y **con el arbitraje ya ejecutado**. Los dos
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
| CA-1 — SVG autónomo (ni texto, ni fuente, ni terceros) | `src/app/icon.svg` vía `svgDelIcono` en `scripts/icon-geometry.mjs` | `tests/icono-fichero.test.ts` › CA-1 (6 casos: viewBox cuadrado, cinco elementos prohibidos, fuentes, hosts, `<title>`) | | ❌ |
| CA-2 — el SVG no cambia según quién lo mire | `src/app/icon.svg` | `tests/icono-fichero.test.ts` › CA-2 (3 casos: `prefers-color-scheme`, `currentColor`, `var(--`) | | ❌ |
| CA-3 — el `.ico` trae 16, 32 y 48 | `src/app/favicon.ico`, `codificarIco`/`icoDelIcono` en `scripts/icon-geometry.mjs` | `tests/icono-fichero.test.ts` › CA-3 (cabecera + decodificación de cada entrada), con lector propio en `tests/icono-raster.ts` | | ❌ |
| CA-4 — los `<link>` los pone Next, y sólo una vez | convención de fichero del App Router: `src/app/icon.svg` + `src/app/favicon.ico`; `src/app/layout.tsx` **sin tocar** | mitad estática en `tests/icono-frontera.test.ts` › CA-4; mitad servida en `tests/e2e/icono.spec.ts` › CA-4 | | ❌ |
| CA-5 — los colores son los tokens, leídos de su fuente | `tokensDeMarca()` en `scripts/icon-geometry.mjs` lee `design/tremen-ds/colors_and_type.css` | `tests/icono-fichero.test.ts` › CA-5 (extractor propio, independiente del generador) | | ❌ |
| CA-6 — un anónimo recibe el icono, no un desvío a `/login` | `src/proxy.ts` — `icon.svg` añadido a la exclusión del `matcher` | `tests/e2e/icono.spec.ts` › CA-6 | | ❌ |
| CA-7 — pedir el icono no estampa cookie | `src/proxy.ts` (misma línea) | `tests/e2e/icono.spec.ts` › CA-7; y `tests/e2e/legal.spec.ts` › CA-13 sigue verde **sin tocar una aserción** | | ❌ |
| CA-8 — el icono no sabe quién lo pide (RN-01, RN-03) | `src/proxy.ts`; `src/lib/auth/guard.ts` **intacto** | `tests/e2e/icono.spec.ts` › CA-8 (bytes con y sin sesión) + `tests/icono-frontera.test.ts` › CA-16 (una sola línea de código) | | ❌ |
| CA-9 — la geometría cumple el contrato de proporciones | `scripts/icon-geometry.mjs` (altura 22, trazo 5, semiejes 9,5×6,75, punto ⌀7 en 26,5/23, rx 6) | `tests/icono-fichero.test.ts` › CA-9 (6 casos, midiendo el `d` del fichero committeado) | | ❌ |
| CA-10 — sólo tres formas, y son las del wordmark | `src/app/icon.svg` | `tests/icono-fichero.test.ts` › CA-10 (2 casos) | | ❌ |
| CA-11 — contraste ≥ 15:1 (S) y ≥ 6:1 (punto) | tokens del sistema de diseño, sin retoque | `tests/icono-fichero.test.ts` › CA-11 (WCAG 2.x sobre los literales extraídos del CSS) | | ❌ |
| CA-12 — a 16 px el punto sobrevive y sigue separado | `rasterizar()` en `scripts/icon-geometry.mjs` | `tests/icono-16px.test.ts` › CA-12 (`.ico`, 4 casos) + `tests/e2e/icono.spec.ts` › CA-12 (SVG en `<canvas>`) | | ❌ |
| CA-13 — a 16 px la S conserva sus dos ojos | `scripts/icon-geometry.mjs` — barrido 295° y ojo de 3,5 sobre la rejilla | `tests/icono-16px.test.ts` › CA-13 (16 y 32) + `tests/e2e/icono.spec.ts` › CA-13 | | ❌ |
| CA-14 — a 16 px la tinta ocupa entre el 15 % y el 40 %, y el suelo es opaco | `scripts/icon-geometry.mjs` — teselá opaca a sangre (D-1) | `tests/icono-16px.test.ts` › CA-14 (3 casos) + `tests/e2e/icono.spec.ts` › CA-14 | | ❌ |
| CA-15 — SVG y `.ico` son el mismo icono | los dos formatos salen de la MISMA polilínea en `scripts/icon-geometry.mjs` | `tests/e2e/icono.spec.ts` › CA-15 | | ❌ |
| CA-16 — el diff está acotado (CE-M1) | nada bajo `src/db/`, `drizzle/` ni `src/lib/`; evidencia sólo en `_qa/SPEC-047/` | `tests/icono-frontera.test.ts` › CA-16 (4 casos, sobre **lo comiteado**: `origin/main...HEAD`. Incluye «ninguna otra `_qa/SPEC-NNN/` en el diff») | | ❌ |
| CA-17 — el `.ico` se reproduce, y sin dependencia nueva | `scripts/build-icon.mjs` + `npm run icon:build` | `tests/icono-frontera.test.ts` › CA-17 (4 casos: bytes idénticos, script declarado, cero deps, sólo `node:*`) | | ❌ |
| CA-18 — suites enteras verdes, y lo ajeno intacto salvo lo que CA-19 nombra | — | `tests/icono-frontera.test.ts` › CA-18 (2 casos: los modificados bajo `tests/` son EXACTAMENTE las tres guardias — un cuarto es RED —, y `tests/e2e/legal.spec.ts` no aparece en el diff) + ejecución completa de `npm test` y `npx playwright test` | | ❌ |
| CA-19 — las tres guardias ajenas se amplían nombradas, y ninguna propiedad se debilita | `tests/legal-rutas-publicas.test.ts`, `tests/cuenta-rutas.test.ts` (literal del `matcher` + `|icon.svg`, por CA-6/CA-7) y `tests/deploy-gate-workflow.test.ts` (lista de `scripts` + `icon:build`, por CA-17); cada una con su porqué escrito al lado de la aserción | `tests/icono-guardias-ampliadas.test.ts` › CA-19.1 (4 casos), CA-19.2 (3), CA-19.3 (6, con **remutación**: la guardia se vuelve a ejecutar contra una entrada con un cuarto elemento inventado y tiene que rechazarla), CA-19.4 (4) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

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
