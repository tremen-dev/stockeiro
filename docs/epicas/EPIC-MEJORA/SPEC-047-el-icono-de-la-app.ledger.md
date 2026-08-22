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
| CA-1 — SVG autónomo (ni texto, ni fuente, ni terceros) | | | | ❌ |
| CA-2 — el SVG no cambia según quién lo mire | | | | ❌ |
| CA-3 — el `.ico` trae 16, 32 y 48 | | | | ❌ |
| CA-4 — los `<link>` los pone Next, y sólo una vez | | | | ❌ |
| CA-5 — los colores son los tokens, leídos de su fuente | | | | ❌ |
| CA-6 — un anónimo recibe el icono, no un desvío a `/login` | | | | ❌ |
| CA-7 — pedir el icono no estampa cookie | | | | ❌ |
| CA-8 — el icono no sabe quién lo pide (RN-01, RN-03) | | | | ❌ |
| CA-9 — la geometría cumple el contrato de proporciones | | | | ❌ |
| CA-10 — sólo tres formas, y son las del wordmark | | | | ❌ |
| CA-11 — contraste ≥ 15:1 (S) y ≥ 6:1 (punto) | | | | ❌ |
| CA-12 — a 16 px el punto sobrevive y sigue separado | | | | ❌ |
| CA-13 — a 16 px la S conserva sus dos ojos | | | | ❌ |
| CA-14 — a 16 px la tinta ocupa entre el 15 % y el 40 %, y el suelo es opaco | | | | ❌ |
| CA-15 — SVG y `.ico` son el mismo icono | | | | ❌ |
| CA-16 — el diff está acotado (CE-M1) | | | | ❌ |
| CA-17 — el `.ico` se reproduce, y sin dependencia nueva | | | | ❌ |
| CA-18 — suites enteras verdes, sin aflojar nada ajeno | | | | ❌ |

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
