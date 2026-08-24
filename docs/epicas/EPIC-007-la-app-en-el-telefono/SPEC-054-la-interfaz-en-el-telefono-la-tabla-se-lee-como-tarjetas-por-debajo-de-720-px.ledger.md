---
id: SPEC-054
tipo: ledger
epica: EPIC-007
---
# Ledger — SPEC-054 La interfaz en el teléfono: la tabla se lee como tarjetas por debajo de 720 px

## Resumen
- Fase: `borrador` — **el gate humano ya dijo que sí el 2026-08-24**; la transición a
  `aprobada` la registra el orquestador con `estado.mjs` una vez confirmada la mudanza de
  épica. No hay implementación ni verificación.
- Épica: **EPIC-007 — La app en el teléfono**. La spec nació en **EPIC-MEJORA** y la expulsó
  **CE-M3** de aquella épica (necesita ADR nuevo → replanteo → épica propia, decidido por el
  humano el 2026-08-24). Los criterios que gobiernan ahora son **CE-1 a CE-6 de EPIC-007**, no
  los CE-M*. La rejilla CA → CE está al final de la spec, §Notas para el gate 9.
- Rama: por crear, desde `origin/main`. **No** desde el worktree actual.

### Intendencia — léela antes de tocar nada

- **Sesiones en paralelo.** Este repositorio tiene varias sesiones a la vez. Los ids y el
  estado se leen de **`origin/main`**, nunca del worktree: `git fetch origin main` y
  `git ls-tree -r --name-only origin/main docs/epicas/`. Al escribir esta spec, el id más alto
  en `origin/main` era **SPEC-053** y **SPEC-052 es un hueco** que puede estar reservado por
  otra sesión — **no se rellena**. Lo mismo con los ADR: **ADR-033 ya existe** en `origin/main`
  (es de SPEC-053) y **ADR-013 es un hueco**; por eso el ADR de esta spec es **ADR-034**.
  ⚠️ **`core/scripts/scaffold.mjs` numera leyendo el worktree local**, así que propuso
  SPEC-050 y ADR-033, los dos ya ocupados. Los ficheros se renombraron a mano. **Comprueba el
  id contra `origin/main` después de scaffoldear.**
- **La premisa de los anchos del encargo era falsa y ya está corregida en la spec.**
  `tests/e2e/geometria.ts:66` declara `ANCHOS = [360, 390, 640, 700, 730, 760, 800, 1280]`,
  idéntico en `origin/main` y en el worktree, y coincidente con ADR-026 §3: **360 y 390 llevan
  medidos desde SPEC-040**. No hay que añadir anchos. **El agujero real es que `/cartera` no
  está en el conjunto de rutas** de `tests/e2e/geometria-rutas.spec.ts` y por tanto no se mide
  a ningún ancho. Es **CA-11**.
- **Lo que NO se puede romper, con su sitio exacto:**
  - `.table-scroll` (`src/app/globals.css:496-513`) está **fuera** de todo `@media` a
    propósito, por **SPEC-040 CA-5** y **ADR-026 §4-5**. Su comentario explica por qué. Por
    encima de 720 px tiene que seguir viva, y el comentario intacto o **actualizado con
    honestidad** — nunca borrado.
  - `.quote-fail`, `.quote-pending`, `.quote-stale` (`globals.css:701-712`) llevan
    `max-width: 34ch` y envuelven porque **esta tabla ya se rompió una vez** por un párrafo que
    se extendía. En formato tarjeta conservan la caja (**CA-15**).
  - El estado de zona es **color de fondo**, no distintivo (SPEC-007). En la tarjeta, el fondo
    de la tarjeta (**CA-10**).
  - La capa de edición es un `<dialog>` anclado al borde inferior (**ADR-030**) y **no se
    mueve**; lo único que cambia es sobre qué se abre (**CA-12**).
- **`display: none` es la clave de los dos árboles y hay que saber por qué funciona**: M1 salta
  los elementos con caja `0 × 0` (`tests/e2e/geometria.ts`, *«Invisible: ni ocupa ni se ve»*),
  así que la representación oculta no ensucia el recuento; y `display: none` **retira del árbol
  de accesibilidad**, que es lo que hace correcto tener dos árboles a la vez en el DOM.
- **M5 nace roja, y eso es la medida funcionando.** `.btn-sm` es `padding: 8px 14px` con
  `font: 600 13px/1` → **≈31 px de alto**, y lo usan *Editar*, *Quitar* y el botón de dirección
  del orden. La salida es agrandar y apilar (ADR-026 §4). **Bajar el suelo de M5 hasta que pase
  es `F-ADR-026-1` cumpliéndose por escrito** y lo caza la revisión.
- **La e2e completa reescribe capturas de `_qa/` ajenas.** Restaurar lo que no es de esta spec
  con `git checkout -- _qa/` y commitear **sólo** `_qa/SPEC-054/` (**CA-19**).
- **Dos decisiones de diseño del humano que NO son territorio libre** (gate del 2026-08-24):
  el pie de la tarjeta lleva *Editar* y *Quitar* **al 50 %, en una sola fila** (**CA-20**), y
  por debajo de 720 px hay **una sola columna** de tarjetas a los cuatro anchos, también a 640
  y 700 (**CA-3**). Ninguna de las dos se replantea al implementar.
- **La salida fácil está prohibida y el mal ejemplo está en casa** (**R-2 de EPIC-007**,
  **CA-21**): `design/tremen-ds/responsive.css:11` resuelve su paso a móvil con
  `html, body { overflow-x: hidden }`, que es exactamente lo que **ADR-026 §4** declara que no
  es un arreglo. Ese fichero **sí lo carga la app** —`layout.tsx:5` → `globals.css:3` →
  `components/index.css:26`— así que la tentación está a un `@media` de distancia. Esta spec
  **no añade ni un `overflow: hidden`** y lo comprueba.
- **Ficheros que se van a tocar** (previsión, no compromiso): `src/app/vigiladas/watched-table.tsx`,
  `src/app/cartera/page.tsx`, `src/app/globals.css`, `tests/e2e/geometria.ts` (**añadir M5**,
  nunca aflojar lo que hay), `tests/e2e/geometria-rutas.spec.ts` (**añadir `/cartera`**) y
  ficheros nuevos de guardia bajo `tests/e2e/`. **Nada bajo `src/db/`, `drizzle/`,
  `src/lib/portfolio/`, `src/lib/watchlist/zone-status.ts` ni `src/lib/market/`** (CE-5 de EPIC-007,
  **CA-16**).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 — el modo conmuta, y en el canto exacto (tarjetas ≤720, tabla ≥721; nunca las dos ni ninguna) | | | | ❌ |
| CA-2 — el canto queda entre 700 y 730, dos anchos medidos adyacentes | | | | ❌ |
| CA-3 — una tarjeta por fila y una fila por tarjeta, en el mismo orden | | | | ❌ |
| CA-4 — cero desborde horizontal a 360 y 390 en las dos páginas (M1+M2+M3) **y ni un contenedor que arrastrar** | | | | ❌ |
| CA-5 — `.table-scroll` intacta y funcional a 730/760/800/1280 (cero regresión de SPEC-040 CA-5) | | | | ❌ |
| CA-6 — anti-deriva: la tarjeta dice todo lo que dice la fila, con el mismo rótulo | | | | ❌ |
| CA-7 — `aria-sort` desaparece con la tabla y vuelve con ella | | | | ❌ |
| CA-8 — el orden se sigue diciendo y se sigue pudiendo cambiar en móvil | | | | ❌ |
| CA-9 — orden de lectura = orden del DOM = orden del boceto; `<dl>` con `<dt>` por `<dd>` | | | | ❌ |
| CA-10 — el estado de zona sigue siendo el fondo, con el mismo color computado (SPEC-007) | | | | ❌ |
| CA-11 — `/cartera` entra en el conjunto de rutas medidas, a los ocho anchos | | | | ❌ |
| CA-12 — M4 sobre la capa de edición, con lista larga afirmada y en tres posiciones (ADR-030) | | | | ❌ |
| CA-13 — **M5** en el módulo compartido, suelo 44×44, con prueba de eficacia por reinyección | | | | ❌ |
| CA-14 — los dos suelos de legibilidad: controles ≥16 px, texto ≥12 px | | | | ❌ |
| CA-15 — los avisos de diagnóstico no se rompen en formato tarjeta (`34ch`, envuelven, completos) | | | | ❌ |
| CA-16 — cero regresión funcional: suites enteras verdes y diff acotado (CE-5) | | | | ❌ |
| CA-17 — cabecera, control de orden, alta plegable y formularios de cartera cumplen M1/M3/M5 | | | | ❌ |
| CA-18 — un solo breakpoint de modo en `globals.css`, afirmado por test | | | | ❌ |
| CA-19 — evidencia reproducible sólo bajo `_qa/SPEC-054/` | | | | ❌ |
| CA-20 — pie de tarjeta: *Editar* y *Quitar* al 50 %, misma fila, cada uno ≥44×44 | | | | ❌ |
| CA-21 — la salida prohibida no se usa: ni un `overflow: hidden` nuevo (R-2 de EPIC-007) | | | | ❌ |

## Decisiones y hallazgos durante la implementación
<!-- Lo escribe sdd-implementador: desvíos de la spec, sorpresas, atajos con su motivo. -->

## Salvedades y follow-ups
<!-- F-SPEC-054-N: lo que queda pendiente, con dueño y si bloquea o no. -->

- **F-ADR-034-1** (heredado del ADR, no bloquea): `viewport-fit=cover` y las áreas seguras
  quedan inertes a propósito. Si algún día se adoptan, el primer sitio que rellenar con
  `env()` es el borde inferior del `<dialog>` de ADR-030.
- **F-ADR-034-2** (heredado, vigilancia continua): dos árboles se pueden separar. La
  descripción de columnas compartida y CA-6 lo impiden, pero **conviene mirarlo en cada
  revisión que añada una columna**.
- **F-ADR-034-3** (heredado, no bloquea): la decisión de conmutación es **de una tabla de
  datos**. No se extiende por analogía a otras superficies.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
