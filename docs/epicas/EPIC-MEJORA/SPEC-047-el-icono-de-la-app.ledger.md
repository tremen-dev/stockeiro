---
id: SPEC-047
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-047 El icono de la app: la inicial y el punto de la marca, legibles a 16 px

## Resumen
- Fase: `en-revision` — implementado, **con un arbitraje pendiente del gate humano**
  (F-SPEC-047-2: tres tests ajenos en rojo que CA-18 prohíbe tocar).
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
| CA-16 — el diff está acotado (CE-M1) | nada bajo `src/db/`, `drizzle/` ni `src/lib/` | `tests/icono-frontera.test.ts` › CA-16 (3 casos, contra `git diff origin/main`) | | ❌ |
| CA-17 — el `.ico` se reproduce, y sin dependencia nueva | `scripts/build-icon.mjs` + `npm run icon:build` | `tests/icono-frontera.test.ts` › CA-17 (4 casos: bytes idénticos, script declarado, cero deps, sólo `node:*`) | | ❌ |
| CA-18 — suites enteras verdes, y lo ajeno intacto salvo lo que CA-19 nombra | — | `tests/icono-frontera.test.ts` › CA-18 (el diff sobre `tests/` sólo añade ficheros) + ejecución completa de `npm test` y `npx playwright test` | | ❌ |
| CA-19 — las tres guardias ajenas se amplían nombradas, y ninguna propiedad se debilita | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-047/. Informe HTML opcional: _qa/SPEC-047/informe.html -->

Pedida expresamente en §Notas para el gate, pto. 5: **una captura del icono a 16 px** (la
pestaña real, no el SVG ampliado) y otra a 32 px, para que el humano juzgue lo que los números
no cubren. Añadir también una sobre cromo **claro** y otra sobre cromo **oscuro**, que es lo
que demuestra D-1 (el icono trae su propio suelo).

**Producidas ya, pero NO en `_qa/`** — ver F-SPEC-047-1. El último caso de
`tests/e2e/icono.spec.ts` deja el icono a 16, 32 y 64 px sobre cromo claro y sobre cromo oscuro
en `test-results/SPEC-047/icono-claro-y-oscuro.png`, junto con una copia del SVG servido. Ese
directorio está en `.gitignore`, así que la captura se regenera con `npx playwright test
tests/e2e/icono.spec.ts` y no ensucia el diff que acota CA-16.

Lo que se ve en ella: la S llena el cuadro y el punto se lee como punto ya a 16 px; el suelo
propio hace que el icono se vea igual sobre la barra clara y sobre la oscura, que es justo lo
que D-1 prometía.

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

**Implementado y committeado en `ft/SPEC-047-favicon`** (worktree `D:/src/wt-47`). Lo que hay:

| Fichero | Qué es |
|---|---|
| `scripts/icon-geometry.mjs` | la fuente: tokens leídos del sistema de diseño, geometría sobre la rejilla de 32, trazado de la S, rasterizador y codificador de `.ico`. Sólo `node:*`. |
| `scripts/build-icon.mjs` | `npm run icon:build`. Acepta `--out <dir>`, que es como lo llama el test de CA-17. |
| `src/app/icon.svg`, `src/app/favicon.ico` | generados, no escritos a mano. 5,2 KB y 14,7 KB. |
| `src/proxy.ts` | **una línea de código**: `icon.svg` sumado a la exclusión del `matcher`. El resto del diff son comentarios con el porqué, en el estilo en prosa del propio fichero. |
| `tests/icono-raster.ts` | herramientas de medida sobre píxeles + lector de `.ico` propio, compartidas por la suite unitaria y la e2e. |
| `tests/icono-fichero.test.ts` · `icono-16px.test.ts` · `icono-frontera.test.ts` · `tests/e2e/icono.spec.ts` | 45 casos unitarios + 11 e2e. |
| `package.json` | `icon:build` y `0.3.0 → 0.3.1` (ADR-024: esto toca `src/`, así que el número sube; PATCH porque es presentación pura). |

**Cifras reales de la última ejecución (2026-08-22):**
- `npx playwright test` — **254 passed**, 0 failed. Incluye SPEC-035 CA-12 y CA-13 intactos.
- `npm test` — **1483 passed, 3 failed**. Los tres son los de F-SPEC-047-2 y **no se han tocado**.
- `npm run typecheck` y `npm run lint` — limpios.

**Lo primero que hay que hacer al retomar** es resolver F-SPEC-047-2 en el gate humano. Hasta
entonces CA-18 no se puede firmar, y con él CA-6, CA-7 y CA-8 quedan sujetos a la decisión (si
el gate elige la salida 2, hay que retirar `icon.svg` y revertir `src/proxy.ts`).

Si el gate elige la salida 1, el cambio es mecánico y son tres líneas:
`tests/legal-rutas-publicas.test.ts:53`, `tests/cuenta-rutas.test.ts:69` (el literal del matcher
pasa a `…|favicon.ico|icon.svg).*)`) y `tests/deploy-gate-workflow.test.ts:356` (añadir
`'icon:build'` a la lista), cada uno con su comentario de por qué se amplía.

**Cómo se regenera el binario**, que es lo que R-5 pedía dejar escrito: `npm run icon:build`.
Lee los tres colores de `design/tremen-ds/colors_and_type.css`, rasteriza el vector a 16, 32 y 48
—el 16 **no** sale de reescalar el 32— y reescribe los dos ficheros. `tests/icono-frontera.test.ts`
lo ejecuta contra un directorio temporal y compara byte a byte, así que un `.ico` retocado por
fuera se cae el mismo día. Para mover el dibujo se tocan las constantes de la cabecera de
`scripts/icon-geometry.mjs` (`ALTURA`, `TRAZO`, `SEMI_X`, `BARRIDO`, `PUNTO`, `RADIO_TESELA`) y se
vuelve a generar; los CA de 16 px dirán enseguida si el retoque ha cerrado un ojo.
