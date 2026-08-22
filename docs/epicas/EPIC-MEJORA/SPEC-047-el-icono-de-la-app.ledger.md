---
id: SPEC-047
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-047 El icono de la app: la inicial y el punto de la marca, legibles a 16 px

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
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
| CA-18 — suites enteras verdes, sin aflojar nada ajeno | — | `tests/icono-frontera.test.ts` › CA-18 (el diff sobre `tests/` sólo añade ficheros) + ejecución completa de `npm test` y `npx playwright test` | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-047/. Informe HTML opcional: _qa/SPEC-047/informe.html -->

Pedida expresamente en §Notas para el gate, pto. 5: **una captura del icono a 16 px** (la
pestaña real, no el SVG ampliado) y otra a 32 px, para que el humano juzgue lo que los números
no cubren. Añadir también una sobre cromo **claro** y otra sobre cromo **oscuro**, que es lo
que demuestra D-1 (el icono trae su propio suelo).

## Salvedades / follow-ups
<!-- IDs F-SPEC-047-1, F-SPEC-047-2… con destino (spec futura o EPIC-MEJORA). -->

Candidatos ya identificados al escribir la spec, **abiertos sólo si el gate los acepta**:

- Manifiesto PWA + `apple-icon` (viajan juntos) — EPIC-MEJORA, cuando un tester pida instalarla.
- Imagen de Open Graph / Twitter card — spec propia; arrastra `metadataBase`. Ver §Notas, pto. 2.
- `theme-color` — barato, cuando se pida.
- El `matcher` de `src/proxy.ts` tiene alternativas sin anclar ni escapar (`favicon.ico` empareja
  el punto como comodín). Visto y **no** arreglado aquí; EPIC-FIX si alguien demuestra que muerde.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

Escrita la spec y este ledger. **Nada implementado**: la spec está en `borrador` y espera el
gate humano. Nada de `src/` se ha tocado en esta rama.
