| CA-14 | `tests/e2e/spec063-contexto.spec.ts`, `tests/spec063-vocabulario-y-ayuda.test.ts` (adaptados, ver Salvedades); `package.json`/`package-lock.json` 0.10.0 | Batería completa (unit + e2e) — ver handoff; `npm run version:check` tras commitear: 0.9.0 → 0.10.0 | | ❌ || CA-13 | `globals.css` (reposo `--fg-muted` / hover `--accent`+`--bg-step` / foco anillo `--ember`; `.nota-senal` a `max(12px,.8em)`), `tests/e2e/geometria.ts` (`medirContrasteDeControl`) | tests/e2e/spec067-enlaces.spec.ts › «CA-13: reposo, hover y foco…» (7,69:1 medido). Capturas `_qa/SPEC-067/`: fila-cuatro-combinaciones-{1280,390}, senales-foco-{1280,390}, capa-enlaces-{1280,390}; `estados-y-contraste.txt` | | ❌ || CA-12 | Diff sin `src/db/schema.ts`, sin migración, sin acción de servidor ni ruta (ver `git diff --name-only origin/main...HEAD`) | Gate: `git diff origin/main...HEAD` + `npm run db:scan` (sin cambios: las 2 de siempre, con waiver) | | ❌ || CA-11 | `abribles.ts`, `senal.ts`, `enlaces-senal.tsx` (sin `fetch`, sin favicon/prefetch) | tests/spec067-senales.test.ts › «CA-11…»; tests/e2e/spec067-enlaces.spec.ts › «CA-11: la app sigue sin visitar…» | | ❌ || CA-10 | `src/lib/contexto/abribles.ts` (`esAbrible`, `enlacesAbribles`, reutiliza `ESQUEMAS_PERMITIDOS`) | tests/spec067-senales.test.ts › «CA-10…» (6+3 prohibidos, 5 permitidos, orden, sin segunda lista); tests/e2e/spec067-enlaces.spec.ts › «CA-10…» (Z9MALO sin señal de enlaces, Z9MEZCLA ofrece 2 de 3) | | ❌ || CA-9 | `enlaces-senal.tsx` (escuchador NATIVO con `stopPropagation` en la señal; `noSubir` en la capa por el portal) | tests/e2e/spec067-enlaces.spec.ts › «CA-9: activar la señal no hace nada más» (manejadores nativos en cada fila/tarjeta: 0 clics; URL y orden intactos) | | ❌ || CA-8 | `enlaces-senal.tsx` (foco al primer enlace tras `showModal`), `globals.css` (`:focus-visible` 2 px `--ember`) | tests/e2e/spec067-enlaces.spec.ts › «CA-8: se llega y se usa con teclado» (tabla y tarjeta) | | ❌ || CA-7 | `globals.css` (`.enlaces-senal` 22 px + `::after` bajo 720 px; `dialog.enlaces-capa` anclada abajo, 92dvh, overflow-y propio), `tests/e2e/geometria.ts` (sin cambios en M1–M5) | tests/e2e/spec067-enlaces.spec.ts › «CA-7: M1, M2, M3 a los ocho anchos, M5 por debajo de 720, y la tabla no crece»; «CA-7: con una lista larga de verdad… (M4)». Evidencia: `_qa/SPEC-067/geometria.txt`, `_qa/SPEC-067/m4-lista-larga.txt` | | ❌ || CA-6 | `enlaces-senal.tsx` (todo cierre pasa por `dialog.close()` → evento `close` → desmonta y enfoca la señal) | tests/e2e/spec067-enlaces.spec.ts › «CA-6: la capa se comporta como la de editar» (Escape, Cerrar, activar enlace; tabla y tarjeta) | | ❌ || CA-5 | `enlaces-senal.tsx` (botón `aria-haspopup="dialog"` + número; `<dialog>` modal por portal en `<body>`), `senal.ts` (`nombreDeSenalDeEnlaces`, `tituloDeCapaDeEnlaces`), `globals.css` (`dialog.enlaces-capa`) | tests/spec067-senales.test.ts › «CA-5…»; tests/e2e/spec067-enlaces.spec.ts › «CA-5: con varios…» (tabla y tarjeta) | | ❌ || CA-4 | `src/lib/contexto/senal.ts` (`destinoDeEnlace`) | tests/spec067-senales.test.ts › «CA-4…» (con etiqueta, sin etiqueta, etiqueta = dominio); tests/e2e/spec067-enlaces.spec.ts › «CA-3/CA-4…» (aria-label = title) | | ❌ || CA-3 | `src/app/_components/enlaces-senal.tsx` (rama de 1 enlace: `<a target=_blank rel="noopener noreferrer">`) | tests/e2e/spec067-enlaces.spec.ts › «CA-3/CA-4…» (tabla y tarjeta: pestaña nueva interceptada en local, `window.opener` null, origen sigue en /vigiladas) | | ❌ || CA-2 | `src/lib/contexto/senal.ts` (`TEXTO_SENAL_NOTA`, `textoDeSenalDeNota`), `columnas-vigiladas.tsx` | tests/spec067-senales.test.ts › «CA-2…»; tests/e2e/spec067-enlaces.spec.ts › «CA-2: la señal de nota es información…» (tabla y tarjeta) | | ❌ || CA-1 | `src/app/vigiladas/columnas-vigiladas.tsx` (celda «Activo»: `nota-senal` + `EnlacesSenal`), `src/app/_components/enlaces-senal.tsx` | tests/e2e/spec067-enlaces.spec.ts › «CA-1: dos señales distintas…» en tabla (1280) y tarjeta (390) | | ❌ |---
id: SPEC-067
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-067 El enlace se abre desde la fila: uno va directo, varios se eligen, y la nota tiene su propia señal

## Resumen
- Fase: en-revision <!-- la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-067-el-enlace-se-abre-desde-la-fila`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | | | e2e CA-1 tabla/tarjeta verde (403/403); capturas fila-cuatro-combinaciones-{1280,390} revisadas | ⚠️ |
| CA-2 | | | unit CA-2 + e2e CA-2 verdes; role=img, sin tabindex, clic inerte | ⚠️ |
| CA-3 | | | e2e CA-3/CA-4 verde: `<a>` href/target/rel, pestaña interceptada, opener null, origen en /vigiladas | ⚠️ |
| CA-4 | | | unit CA-4 (con/sin etiqueta, dominio 1 vez, sin URL) + e2e aria-label = title | ⚠️ |
| CA-5 | | | unit + e2e CA-5: button aria-haspopup=dialog, «3», dialog :modal «Enlaces de Z9VARIOS · BME», 3 en orden, rel ok | ⚠️ |
| CA-6 | | | e2e CA-6: Escape, Cerrar y activar enlace cierran y devuelven foco a la señal | ⚠️ |
| CA-7 | | | e2e CA-7 ×2 verdes; geometria.txt y m4-lista-larga.txt (M4 3 posiciones × 8 anchos, M5 sin pequeños ni solapes, tabla 933=933). M1 de la señal no mide a 730–800 (tabla arrastrada, ADR-026 §4) | ⚠️ |
| CA-8 | | | e2e CA-8: Tab llega a la señal antes que Editar, :focus-visible 2px, Enter abre capa con foco en 1er enlace / abre el enlace | ⚠️ |
| CA-9 | | | e2e CA-9: 0 clics en manejadores nativos de fila/tarjeta; URL y orden intactos; sin capa de edición | ⚠️ |
| CA-10 | | | unit CA-10 (9 no / 5 sí, orden, sin segunda lista) + e2e (Z9MALO sin señal, Z9MEZCLA 2 de 3, ningún href no-http) | ⚠️ |
| CA-11 | | | unit (sin fetch/prefetch/favicon) + e2e CA-11: 0 peticiones a example.com hasta activar; sólo la navegación | ⚠️ |
| CA-12 | | | `git diff --name-only origin/main...HEAD`: sin schema/migración/acción/ruta; `db:scan` = las 2 de siempre con waiver | ⚠️ |
| CA-13 | | | FALLO de medida (F-V1): `medirContrasteDeControl` lee mal `color(srgb … / a)`; la fila en zona sale como rgb(15,15,14) en vez de ≈rgb(23,40,28). Estados reposo/hover/foco y suelo 12 px sí verdes | ❌ |
| CA-14 | | | typecheck ✓, lint ✓, unit 143/2266 ✓, e2e 403/403 ✓ (build con VERCEL_ENV=development y APP_BASE_URL local), version:check 0.9.0→0.10.0 ✓; adaptación SPEC-063 revisada: no afloja | ⚠️ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**RED — 2026-09-23 (sdd-verificador).** El comportamiento verifica en el flujo real (e2e completa
403/403, unit 2266/2266, typecheck y lint verdes), pero se devuelve por dos findings:

- **F-V1 (CA-13) — la medida de contraste no ve el tinte de zona.** `medirContrasteDeControl`
  (`tests/e2e/geometria.ts`) extrae números con `/[\d.]+/g`; Chromium serializa
  `color-mix(in srgb, …)` (los fondos `.zone-*`) como `color(srgb 0.29 0.87 0.50 / 0.11)`, en escala
  0–1, así que el tinte verde se lee como casi negro. Evidencia: `estados-y-contraste.txt` da para la
  fila de Z9VARIOS (en zona, «donde el contraste se juega de verdad») un fondo rgb(15,15,14), cuando
  la captura `senales-foco-1280.png` la enseña verde (≈ rgb(23,40,28)). El contraste real estimado
  (≈ 6,6:1) cumple, pero la guardia no mide el caso que dice medir y daría verde a un tinte que lo
  rompiera. Acción: parsear `color(srgb r g b / a)` escalando ×255 (o resolver el color con un
  canvas), afirmar que el fondo de la fila en zona NO es el del lienzo, y regenerar la evidencia.
  (El mismo parser está en M6 `medirSuperficieDeTexto`: preexistente, fuera de esta spec.)
- **F-V2 (todos los CA / proceso) — el ledger está roto.** Las filas del implementador se
  escribieron en la línea 1, antes del `---` del frontmatter, en orden inverso y sin saltos de
  línea; la matriz quedó con Implementado/Test vacíos. `valida.mjs` falla: «sin frontmatter o sin
  'id'». Acción: mover esas celdas a sus filas de la matriz y dejar el `---` en la línea 1. Por eso
  los CA verificados quedan ⚠️ y no ✅.

Menor: el ledger dice 926/926 px de `.table-scroll` a 730–760 y `geometria.txt` dice 933/933.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-067/. Informe HTML opcional: _qa/SPEC-067/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-067-1, F-SPEC-067-2… con destino (spec futura o EPIC-MEJORA). -->
- **`expect` ajenos modificados (CA-14, ADR-031/ADR-037), uno a uno.** Todos en
  `tests/e2e/spec063-contexto.spec.ts`, test «SPEC-063 CA-9/CA-10: … la señal habla»:
  1. `getByTestId('contexto-senal')).toHaveCount(0)` → dos `expect`, uno por señal
     (`nota-senal`, `enlaces-senal`). Motivo: la señal única ya no existe; la propiedad
     «sin contexto no hay marca» se afirma sobre las dos.
  2. `senal` (`contexto-senal`) `toHaveCount(1)` y `aria-label 'Tiene nota tuya'` → lo
     mismo sobre `nota-senal`. Motivo: la frase de la nota es idéntica; cambia el asa.
  3. `laFila('Z8PELADA').getByTestId('contexto-senal')).toHaveCount(0)` → sobre
     `nota-senal` **y** `enlaces-senal`. Se endurece: ahora mira las dos.
  4. `aria-label 'Tiene nota tuya y 1 enlace'` → la nota sigue diciendo «Tiene nota tuya» y
     la de enlaces dice «tu enlace» (singular) y no «enlaces». Motivo: la frase conjunta se
     parte en dos (Decisión pto. 1); la propiedad «entre las dos se dice nota, enlaces y
     cuántos» se conserva.
  Además, un comentario del test de CA-7 de SPEC-063 cambia «señal de contexto» por «señal de
  nota» (sin tocar su `expect`). En `tests/spec063-vocabulario-y-ayuda.test.ts` **no se
  modificó ningún `expect`**: se AÑADE un caso para las dos frases; `textoDeContexto`
  sigue existiendo como resumen del bloque de la capa de edición (`contexto-form.tsx`).
- **Interpretación de CA-5 «rótulo y, debajo, su dominio»**: con etiqueta se pintan las dos
  líneas; **sin etiqueta el rótulo YA es el dominio** (SPEC-063 CA-15) y no se repite debajo
  (lo mismo que CA-4 pide para el nombre accesible). El e2e lo fija (`graficos.example.com`
  sin segunda línea). Si el verificador lo lee de otro modo, es un cambio de una línea.
- **CA-7, M1 sobre la fila a 730/760/800 px**: la tabla se arrastra dentro de
  `.table-scroll` (926 px de contenido) y M1, por diseño (ADR-026 §4), no mide dentro de un
  contenedor desplazado de verdad; ahí mide el contenedor. La señal SÍ entra como testigo a
  360–700 (tarjetas) y a 1280. «La tabla no desborda más que hoy» se mide aparte: contenido
  de `.table-scroll` con y sin las señales, **idéntico** (926/926 y 1184/1184 px).
- **CA-13, suelo de 12 px**: `.nota-senal` era `.8em` = **11,2 px** en la tabla (heredado de
  SPEC-063). Se sube a `max(12px, .8em)`. La medida de CA-13 se hace sobre la celda
  «Activo»; los `<th>` y el `.eyebrow` de escritorio (11 px) no son de esta spec y ADR-034
  §7 se aplica por debajo de 720 px (SPEC-054) — no se tocan.
- **Diana táctil asimétrica**: el `::after` de la señal de enlaces crece 6 px a la izquierda
  (sólo el hueco con el lápiz) y 16 px a la derecha, para que un dedo sobre la nota no abra
  los enlaces. M5 la da por buena (≥ 44 × 46, sin solapes).
- **Gate e2e local y `.env.production.local`**: la batería completa dio **401 ✓ / 2 ✗**
  (`spec065-buscadores` CA-6 robots, `spec066-alta` CA-5 BotID). Causa: el
  `.env.production.local` de este equipo (`vercel env pull`) mete `VERCEL_ENV=production` en
  el build y el robots/BotID se construyen como producción. Reconstruido con
  `VERCEL_ENV=development`, esos dos ficheros pasan **30/30**. Ninguno toca este diff.
- **F-SPEC-067-1** (→ EPIC-009, spec de `/cartera`): `EnlacesSenal` vive en
  `src/app/_components/` sin acoplarse a `/vigiladas` (recibe enlaces, nombre del activo y
  asa); la nota es un `<span>` en la celda de `/vigiladas` y habría que extraerla igual.
- **F-SPEC-067-2** (→ EPIC-MEJORA): la capa no se cierra con clic fuera (no se usa
  `closedby="any"`, igual que la de edición). Se cierra con Escape, *Cerrar* o eligiendo.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Implementación completa en `ft/SPEC-067-el-enlace-se-abre-desde-la-fila` (sin push). Spec en
`en-revision`. Commits: `9e65e0e` feat (código + unit), `2171ebb` test (e2e + geometría +
adaptación SPEC-063), `fed7a8a` versión 0.10.0, y el de ledger/evidencia.

Gates ejecutados sobre el árbol commiteado: `npm run typecheck` ✓, `npm run lint` ✓,
`npm test` 143 ficheros / 2266 tests ✓ (tras corregir el caso añadido a SPEC-063),
`npm run build` ✓, `npx playwright test` 401 ✓ / 2 ✗ ambientales (ver Salvedades),
`tests/e2e/spec067-enlaces.spec.ts` 20/20 ✓, `npm run db:scan` sin cambios,
`npm run version:check` 0.9.0 → 0.10.0 ✓.

Para el verificador: el e2e necesita `npm run build` antes (`server.mjs` sólo hace
`next start`); en este equipo, con `VERCEL_ENV=development` para que el
`.env.production.local` no convierta el build en producción. Evidencia en `_qa/SPEC-067/`.
