---
id: SPEC-050
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-050 La primera pantalla: la marca visible, una entrada clara y la advertencia fuera del hero

## Resumen
- Fase: `hecho` — verificada y aprobada por sdd-verificador el 2026-08-23 (GREEN 22/22 CA).
- Rama: `ft/SPEC-050-la-primera-pantalla-la-marca-visible-una-entrada-clara-y-la-advertencia-fuera-del-hero`
  (sale de `origin/main` en `9387681`).
- **Nació como `SPEC-049`.** Otra sesión mergeó en `origin/main` una SPEC-049 propia (EPIC-FIX,
  *el gate de versión no dice verde sobre un árbol sucio*) mientras ésta se escribía. Id
  reasignado desde `origin/main`; citas reverificadas contra `9387681`.
- **Ficheros de producto tocados: dos.** `src/app/page.tsx` y `src/app/globals.css`. Ni
  `app-footer.tsx`, ni `app-nav.tsx`, ni `proxy.ts`, ni `layout.tsx`, ni nada bajo `src/db/`,
  `drizzle/` o `src/lib/`. Versión **0.3.2 → 0.3.4** (PATCH, ADR-024: presentación pura).
- **Un solo fichero de test ajeno modificado**, el que CA-22 autoriza nominalmente:
  `tests/e2e/ayuda.spec.ts`. Ningún otro.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->

| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (wordmark en `/`) | `src/app/page.tsx` (`.landing-marca brand`, `<p>` no enlace) · `src/app/globals.css` (`.brand`, `.landing-marca`; fuera `.landing-eyebrow`) | `tests/e2e/primera-pantalla.spec.ts` › CA-1 ×3 (primer elemento y texto `Stockeiro.`; punto `--accent` y palabra `--fg` **derivados por sonda**; `.landing-eyebrow` a cero) | Navegador (mío, `next start` 3300): primer hijo de `main.landing` es `p.landing-marca.brand[data-testid=landing-marca]` con texto `Stockeiro.`; punto `--accent`, palabra `--fg` por sonda; `.landing-eyebrow` a 0. `_qa/SPEC-050/ca1-wordmark.png` mirado | ✅ |
| CA-2 (es marca, no microcrédito) | `src/app/globals.css` (`.landing-marca { --brand-size: 28px }`) | `tests/e2e/primera-pantalla.spec.ts` › CA-2 (8 anchos: sans, 900, `text-transform: none`, 24–32 px y **siempre < `.landing-title`**). Medido: **marca 28 px, titular 32 px a 360 y 52 px a 1280** — `_qa/SPEC-050/ca2-marca-vs-titular.txt` | `ca2-marca-vs-titular.txt` releído y remedido por mi cuenta a 360/390/768/1280: marca **28 px** constante, titular 32 → 46,08 → 52 px. Sans, 900, `none`. Siempre < titular. **Y mirado**: a 360 y a 1280 se lee como marca, no como microcrédito | ✅ |
| CA-3 (la barra no se entera) | `src/app/globals.css` (`.app-nav .brand` conserva solo `text-decoration`) | `tests/e2e/primera-pantalla.spec.ts` › CA-3 (`/dashboard` con sesión; familia/colores por sonda del tema, 20 px, −0,9 px de tracking, sin subrayado) | `_qa/SPEC-050/ca3-barra-intacta.png` mirada: la barra se pinta igual, sin subrayado y con el punto en acento. El caso e2e pasa en mi ejecución completa (20 px, −0,9 px, colores por sonda) | ✅ |
| CA-4 (una sola definición) | `src/app/globals.css` (`.brand` + `.brand .dot` de primer nivel) · `src/app/page.tsx` | `tests/primera-pantalla-fuente.test.ts` › CA-4 ×5 (una sola regla define la tipografía; `var(--brand-size, 20px)`; un solo `.brand .dot`; `.app-nav` sin `font`/`color`; **mismo par de nodos** que `app-nav.tsx`) | Comprobado sobre el **CSS compilado** (`.next/static/chunks/*.css`), no solo sobre `globals.css`: `.brand` aparece **una sola vez** en todo el bundle —incluido `design/tremen-ds/components/index.css`, que `globals.css` importa—, más `.brand .dot` y `.app-nav .brand{text-decoration:none}`. Ninguna segunda definición se cuela por el design system | ✅ |
| CA-5 (orden de la pantalla) | `src/app/page.tsx` (nueve nodos en el orden de la tabla) | `tests/e2e/primera-pantalla.spec.ts` › CA-5 (secuencia exacta + `QUE_HACE` y acciones **antes** de cadencia y límites) | Orden leído por mí en el navegador: `landing-marca → landing-title → landing-que-hace → landing-acciones → landing-gratis → landing-cadencia → landing-que-no-hace → landing-mas → landing-legal`. Nueve nodos, el de la tabla | ✅ |
| CA-6 (jerarquía de los botones) | `src/app/page.tsx` (ayuda fuera de la fila) · `src/app/globals.css` (`.landing-acciones .btn.primary`) | `tests/e2e/primera-pantalla.spec.ts` › CA-6 ×3 (único `.primary`; razón de áreas ≥ 1,3 → **2,07 a los ocho anchos** (165×55 frente a 90×49), cifras en `_qa/SPEC-050/ca6-jerarquia-de-botones.txt`; contraste del primario en `_qa/SPEC-050/ca6-contraste-del-primario.txt`) | Remedido por mi cuenta: `crear=165×55`, `entrar=90×49`, razón **2,06** a 360/390/768/1280. Único `.primary` de la fila; `a[href="/ayuda"]` fuera de `.landing-acciones`. Contraste 6,88:1. **Con el ojo (R-5)**: el primario domina por caja y color sin que «Entrar» desaparezca; a ≤720 px apilan por el `@media` de SPEC-039, y apilados la jerarquía se lee aún mejor | ✅ |
| CA-7 («gratis y sin publicidad» sube) | `src/app/page.tsx` (`.landing-gratis`) · `src/app/globals.css` | `tests/e2e/primera-pantalla.spec.ts` › CA-7 (literal declarado; **ni «ilimitado» ni «para siempre» ni «sin coste»**; color ≠ `--fg-dim`; tamaño ≥ el de la línea legal; antes que la cadencia) | Literal exacto y color medido por mí: `rgb(245,241,234)` = `--fg` opaco, **no** `--fg-dim`. Antes de la cadencia en orden de documento. Sin «ilimitado/para siempre/sin coste» | ✅ |
| CA-8 (cuatro caminos, uno de cada) | `src/app/page.tsx` | `tests/e2e/primera-pantalla.spec.ts` › CA-8 (uno de cada + **cero `a[href="/"]`**: el wordmark no es enlace) · `tests/e2e/ayuda.spec.ts` › CA-2 «ofrece los cuatro caminos» **sin tocar** | Enumeré **todos** los `<a>` de `/`: uno a `/register`, uno a `/login`, uno a `/ayuda`, cuatro que empiezan por `/legal`, cero `a[href="/"]` dentro de `main.landing`. El wordmark no es enlace | ✅ |
| CA-9 (`CADENCIA_LINEA` entera) | `src/app/page.tsx` (`{CADENCIA_LINEA}`) | `tests/e2e/primera-pantalla.spec.ts` › CA-9 · `tests/e2e/ayuda.spec.ts` › CA-3 (las tres pantallas) **sin tocar ninguna aserción** | `src/lib/help/content.ts` **no aparece en el diff**: `CADENCIA_LINEA` está intacta, 40 palabras, misma constante. Renderizada entera en `/` (leída del DOM). `tests/e2e/ayuda.spec.ts` › CA-3 verde y sin una aserción tocada. **D-2 locked, respetado** | ✅ |
| CA-10 (sin cromo de alarma) | `src/app/globals.css` (`.landing-cadencia` agrupada con `.landing-limites`) | `tests/e2e/primera-pantalla.spec.ts` › CA-10 (4 bordes a 0; `--amber` y `--bg-step` **derivados por sonda** y descartados; radio 0; color idéntico al de `.landing-limites` y a `--fg-muted`) | Medido por mí a los cuatro anchos: `border-left-width: 0px`, fondo `rgba(0,0,0,0)`, radio 0, color = `--fg-muted` = el de `.landing-limites`. **Y mirado**: es prosa, ya no una tarjeta de alarma | ✅ |
| CA-11 (ni una palabra nueva de cadencia) | `src/app/page.tsx` (`description: QUE_HACE`) | `tests/primera-pantalla-fuente.test.ts` › CA-11 ×3 (importa y renderiza la constante; **cero** `/cierre\|refresc\|una vez al día\|tiempo real\|diferid/i` fuera de comentarios; la constante sigue con sus 40 palabras) | El regex de la cadencia no casa nada en `src/app/page.tsx` fuera de comentarios; `CADENCIA_LINEA` se importa y se renderiza. **Con residual**: obligó a cambiar `metadata.description` — ver `F-SPEC-050-1` y mi juicio en el veredicto. El CA se cumple | ✅ |
| CA-12 (descargo, legal y marca intactos) | — (no se toca nada) | `tests/e2e/primera-pantalla.spec.ts` › CA-12 (`color` y `font-size` de los tres bloques **idénticos** a los de `/legal/terminos`) · `tests/e2e/pie-legal.spec.ts` **sin tocar** | `src/app/app-footer.tsx` **no aparece en el diff: cero bytes**. Descargo, tres enlaces legales y `tremen.dev` presentes en `/` con `color`/`font-size` idénticos a los de `/legal/terminos`. `pie-legal.spec.ts` verde sin tocar | ✅ |
| CA-13 (feedback oculto en `/`, versión subordinada) | `src/app/globals.css` (`.landing ~ .app-footer .app-footer-feedback { display: none }`) | `tests/e2e/primera-pantalla.spec.ts` › CA-13 (`display: none` y **alto 0**, no `visibility`/`opacity`; versión visible en `--fg-dim`; en `/legal/terminos` las dos visibles con `--fg-muted`/`--fg-dim`) | Medido por mí en `/`: feedback `display:none`, `visibility:visible`, `opacity:1`, **alto 0 px**; versión `display:block`, `rgba(245,241,234,0.42)` = `--fg-dim`. En `/legal/terminos` las dos visibles. El selector `.landing ~ .app-footer` solo puede alcanzar a `page.tsx`: es el único `className="landing"` del árbol | ✅ |
| CA-14 (la versión sigue visible y copiable) | — (no se toca) | `tests/e2e/primera-pantalla.spec.ts` › CA-14 (semver primero, los cuatro atajos prohibidos comprobados, contraste sobre el fondo ≥ 3:1 con la cifra en `_qa/SPEC-050/ca14-contraste-de-la-version.txt`, y el rango de selección devuelve el texto) · `tests/e2e/version-en-el-pie.spec.ts` **sin tocar** | Verificado por mí: `v0.3.3 · entorno desconocido · cf146bf · 2026-08-23 18:46 UTC`, semver primero, después commit y fecha. `display` ≠ none, `visibility` ≠ hidden, `font-size` 13 px, `user-select: text`. Contraste 3,77:1 (umbral 3). El rango de selección devuelve el texto. **Ronda 2**: reconstruido y remirado con el número nuevo — el pie dice `v0.3.4 · entorno desconocido · 190de31 · 2026-08-23 19:17 UTC`, semver primero, contraste **3,77:1** idéntico. El bump se propaga al producto sin tocar el contrato del pie | ✅ |
| CA-15 (el pie no sabe en qué ruta está) | `src/app/app-footer.tsx` **sin un solo byte de cambio** | `tests/primera-pantalla-fuente.test.ts` › CA-15 ×4 (sin `usePathname`/`headers`/`landing`; `AppFooter()` sin argumentos; sus cinco bloques; la subordinación **vive en el CSS** y es `display: none`) · `tests/legal-import-graph.test.ts` y `tests/ayuda-import-graph.test.ts` verdes | `app-footer.tsx` sin tocar (diff vacío). Sin `usePathname`/`headers`/`landing`, `AppFooter()` sin argumentos, cinco bloques intactos. La subordinación vive entera en `globals.css`. Los dos import-graph verdes en mi ejecución | ✅ |
| CA-16 (con sesión, `/` lleva al panel) | — (no se toca) | `tests/e2e/primera-pantalla.spec.ts` › CA-16 · `tests/e2e/ayuda.spec.ts` › «con sesión, la raíz sigue llevando al panel» **sin tocar** | Caso e2e verde en mi ejecución completa; `ayuda.spec.ts` › «con sesión, la raíz sigue llevando al panel» sin tocar | ✅ |
| CA-17 (geometría a los ocho anchos) | `src/app/globals.css` | `tests/e2e/primera-pantalla.spec.ts` › CA-17 ×3 (M1+M2 a los 8 anchos **con testigos** ADR-030 §5, cifras en `_qa/SPEC-050/ca17-geometria.txt`; hueco muerto de los bloques **nuevos** medido por cajas de línea; `.landing-acciones` sigue siendo grid **con ese nombre**) · `tests/e2e/ayuda-responsive.spec.ts` y `tests/e2e/geometria-rutas.spec.ts` **sin tocar** | `ca17-geometria.txt`: 33 elementos medidos, **0 violaciones** y **2 testigos presentes** a los ocho anchos (ADR-030 §5 — sin testigos el cero no aprueba nada). Documento sin desborde también en mi medida a 360/390/768/1280. `.landing-acciones` **conserva el nombre** y sigue siendo `grid`, así que `ayuda-responsive.spec.ts` sigue casando con ≥2 elementos en `/`. Las dos guardias ajenas, sin tocar | ✅ |
| CA-18 (suites verdes; acotación al gate) | — | `npm test` → **1607 passed (106 ficheros)** · `npx playwright test` **completa** → **289 passed (4,0 min)**, con las cinco citadas dentro: `ayuda.spec.ts`, `version-en-el-pie.spec.ts`, `pie-legal.spec.ts`, `ayuda-responsive.spec.ts` y `pie-responsive.spec.ts`. La mitad de acotación la comprueba el verificador en el gate | Ejecutadas **por mí, enteras**: `npm test` → **1607 passed (106 ficheros)**; `npx playwright test` → **289 passed (4,5 min)**; `npm run lint` y `npm run typecheck` limpios. Las cinco citadas, dentro. Y la mitad de acotación: **un solo fichero de test ajeno modificado** (`tests/e2e/ayuda.spec.ts`, el que CA-22 autoriza). **Ronda 2, re-ejecutado tras el bump**: `npm test` → **1607 passed (106 ficheros)**, `npm run typecheck` y `npm run lint` limpios, `npm run db:scan` limpio, y `npx playwright test tests/e2e/primera-pantalla.spec.ts tests/e2e/version-en-el-pie.spec.ts` → **34/34** sobre un `next build` **posterior** al bump (el `.next` que había era anterior y habría medido `0.3.3`) | ✅ |
| CA-19 (alcance acotado — **criterio de gate, no de suite**) | n-a | n-a — **y la nota es el punto**: *«este cambio está bien acotado»* es criterio de gate (**ADR-031 pto. 1.2**) y escribirlo como `git diff … origin/main` reproduciría el molde que **SPEC-048** desmontó, que se pone verde por vacuidad al mergear. No se ha inventado ningún test: la evidencia del árbol limpio la pega sdd-verificador aquí | **Verificado por mí con el árbol limpio** (`git status --porcelain` vacío) sobre `9387681..HEAD`. Salida pegada bajo el veredicto. Dentro del conjunto permitido; **fuera** `src/db/`, `drizzle/`, `src/lib/`, `app-footer.tsx`, `app-nav.tsx`, `layout.tsx`, `proxy.ts` y cualquier otra `_qa/SPEC-NNN/`. La excepción declarada para `app-nav.tsx` **no se usó**. Fila `n-a` de test: correcta, ADR-031 pto. 1.2, y **no se inventó ningún test para rellenarla**. **Ronda 2, re-verificado**: el conjunto de ficheros **no ha cambiado** —el arreglo de F-1 añadió `package.json` (que ya estaba dentro) y este ledger, nada más—, y **`package-lock.json` sigue fuera del diff**, que es lo que este CA exige aunque incomode: ver el juicio bajo el veredicto de la ronda 2 | ✅ |
| CA-20 (sin dependencia y sin ADR) | `package.json` (solo `version`) | `tests/primera-pantalla-fuente.test.ts` › CA-20 ×5 (deps, devDeps y scripts **declarados en el test**, sin git; semver; **ningún ADR cita SPEC-050**) | **Ronda 1: ❌** — `version:check` daba **exit 1**, porque `origin/main` pasó de `9387681` a `93971e5` (PR #58, SPEC-051) y esa base ya decía `0.3.3`, el mismo número que dejaba esta rama. **Ronda 2: ✅** — re-ejecutado por mí con el árbol limpio (`git status --porcelain` vacío) y con `origin/main` **re-fetcheado** y todavía en `93971e5`: `[check-version-bump] La version sube de 0.3.3 a 0.3.4.` · **exit 0**. Lo demás del CA, re-verificado también: `git diff origin/main...HEAD -- package.json` cambia **una sola línea**, el campo `version`; deps, devDeps y scripts intactos; `docs/adr/` sin fichero nuevo; cero literales de versión en `src/` y `tests/` (`grep -rn '0\.3\.[0-9]'` → vacío), así que el bump no puede romper una aserción por literal. Ver F-1 cerrado en el veredicto de la ronda 2 | ✅ |
| CA-21 (el camino anónimo al feedback sobrevive) | `src/app/page.tsx` (el enlace a `/ayuda`, fuera de la fila pero presente) | `tests/e2e/primera-pantalla.spec.ts` › CA-21 — **navega de verdad**: `/` → clic «Cómo funciona, con detalle» → `/ayuda` → canal visible con `href` `mailto:`. Captura en `_qa/SPEC-050/ca21-camino-al-feedback.png` | **Recorrido por mí, navegando de verdad**: `/` → un único `a[href="/ayuda"]` con texto «Cómo funciona, con detalle» → clic → `/ayuda` → `[data-testid=feedback-enlace]` **visible** con `href` `mailto:hola@tremen.dev?subject=[Stockeiro v0.3.3 …]` (**ronda 2, con el bump puesto: `v0.3.4`** — el asunto compone el semver, no lo teclea). Comprobado además que la fila vuelve a `display:block` en `/ayuda`, que es lo que la navegación **de cliente** de Next podía romper. El test rompe en cada eslabón (`toHaveCount(1)`, `click()`, `waitForURL`, `toBeVisible`): **no puede pasar por vacuidad** | ✅ |
| CA-22 (la guardia ajena que se estrecha) | `tests/e2e/ayuda.spec.ts` (bucle sin `/`, porqué al lado, caso inverso nuevo) | `tests/primera-pantalla-fuente.test.ts` › CA-22 ×4 (una por condición) · el caso inverso vive en `tests/e2e/ayuda.spec.ts` › «y en la primera pantalla NO se muestra» | Las **cuatro** condiciones verificadas sobre el diff y sobre el fichero: (1) solo el bucle de la línea 361 pierde `/`, y **ningún otro fichero ajeno** se toca —lo confirma el diff de CA-19—; (2) el porqué está escrito al lado, con SPEC-050, D-5, CA-21 y la fecha del arbitraje; (3) **el inverso existe y es real**: «y en la primera pantalla NO se muestra» pasa en mi ejecución, y el bucle conserva `toBeVisible()` y `^mailto:`; (4) `'y desde cualquier pantalla autenticada'` con `['/dashboard', '/vigiladas', '/avisos', '/cuenta']` intacto | ✅ |

> **CA-19 no lleva fila de test a propósito.** Es criterio de acotación y **ADR-031 pto. 1.2**
> lo saca de la suite: lo verifica sdd-verificador en el gate y **pega aquí la salida**.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### 🟢 GREEN — 2026-08-23 (ronda 2), sdd-verificador

**22 de 22 CA en verde. `F-1` cerrado, y cerrado sin llevarse por delante ninguno de los 21
que ya lo estaban** — que es el modo de fallo clásico de una segunda ronda y lo primero que
fui a buscar.

#### F-1, re-verificado por mí

Con `origin/main` **re-fetcheado** (sigue en `93971e5`; no se ha vuelto a mover) y el árbol
**limpio** —`git status --porcelain` vacío antes de ejecutar, porque SPEC-049 hace que sobre
un árbol sucio el gate se **abstenga con `2`** y una abstención no es un verde—:

```
$ git status --porcelain          # vacío
$ npm run version:check
> stockeiro@0.3.4 version:check
> node scripts/check-version-bump.mjs

[check-version-bump] Base: origin/main.
[check-version-bump] La version sube de 0.3.3 a 0.3.4.
exit 0
```

#### Que el arreglo no ha movido nada de lo que ya estaba verde

El diff entre las dos rondas (`e5ec6f8..HEAD`) es **tres ficheros y 79 líneas**:

```
$ git diff --name-status e5ec6f8 HEAD
M  docs/epicas/EPIC-MEJORA/SPEC-050-…-fuera-del-hero.ledger.md
M  docs/epicas/EPIC-MEJORA/SPEC-050-…-fuera-del-hero.md
M  package.json
```

- `package.json`: **una línea**, `"version": "0.3.3"` → `"0.3.4"`. Nada más.
- La spec: **solo el frontmatter** (`estado: en-progreso` → `en-revision` y una línea de
  historial). Ni un carácter del cuerpo ni de un CA.
- El ledger: **solo adiciones** —`F-SPEC-050-4` y la sección «Ronda 2»—. **Las columnas
  `Verif.` y `Estado` no las tocó**: lo comprobé sobre el diff, no de palabra. Siguen siendo
  mías.
- **Cero ficheros de producto y cero ficheros de test.** `src/app/page.tsx`,
  `src/app/globals.css`, `tests/e2e/primera-pantalla.spec.ts`,
  `tests/primera-pantalla-fuente.test.ts` y `tests/e2e/ayuda.spec.ts`: sin un byte de
  cambio entre las dos rondas.

Y no me quedé en el diff, porque el número **sí se renderiza**. Reconstruí (`npm run build`
con las variables de juguete del CI, ya que el `.next` que había era de las 20:46 y el bump
es de las 21:05: habría medido `0.3.3` y el verde no habría valido nada) y re-ejecuté:

| Gate | Resultado |
|---|---|
| `npm run typecheck` | limpio |
| `npm run lint` (`--max-warnings=0`) | limpio |
| `npm test` | **1607 passed · 106 ficheros** |
| `npm run db:scan` | 11 migraciones, 2 destructivas, ambas con waiver escrito |
| `npm run version:check` | **exit 0 — 🟢** |
| `npx playwright test primera-pantalla + version-en-el-pie` | **34 passed · 27,4 s** |

**Y con el ojo**: el pie sirve `v0.3.4 · entorno desconocido · 190de31 · 2026-08-23 19:17
UTC` —semver primero, commit `190de31` que es este `HEAD`— y la primera pantalla a 1280
sigue siendo la que aprobé: wordmark `Stockeiro.` primero con su punto de acento, titular,
`QUE_HACE`, «Crear cuenta» dominando a «Entrar», «gratis y sin publicidad» arriba, la
cadencia como **prosa sin cromo de alarma**, «Cómo funciona, con detalle», la línea legal, y
el pie **sin** el canal de feedback. Nada se ha movido.

> **Nota de entorno.** El e2e volvió a reescribir `_qa/SPEC-038/pie-{360,1280}.png`, que es
> evidencia ajena: restauradas con `git checkout -- _qa/SPEC-038/`. Las de `_qa/SPEC-050/`
> **sí** se dejan regeneradas y commiteadas, porque ahora muestran el artefacto real
> (`v0.3.4`) en vez del `v0.3.3` que ya no existe; `_qa/SPEC-050/` está dentro del conjunto
> de CA-19.

#### Sobre `package-lock.json`: la lectura del implementador es la correcta, y además es la única

El lock se quedó en `0.3.2` a propósito. **Le doy la razón, y no por deferencia: verifiqué
las tres cosas que afirma.**

1. **La deriva ya venía de `origin/main`.** `git show origin/main:package.json` → `0.3.3`;
   `git show origin/main:package-lock.json` → `0.3.2`. Esta rama **no la crea**: la hereda y
   la ensancha un patch.
2. **`npm ci` no la mira.** Comprobado ejecutándolo, no razonándolo: `npm ci --dry-run` →
   `added 156 packages`, **exit 0**. `npm ci` valida que el árbol de dependencias del lock
   case con los rangos de `package.json`; el campo `version` de la raíz no entra en esa
   comparación.
3. **`origin/main` pasa la CI hoy con esa misma deriva.** `gh run list --branch main`:
   `CI` → **success** y `Deploy gate` → **success** en `93971e5`.

Y lo comprobé también por el otro lado, que es lo que de verdad cierra el asunto: **nadie en
este repositorio lee la versión del lock**. El único uso de `package-lock.json` en todo el
proyecto es como **clave de caché** de los navegadores de Playwright
(`ci.yml:169`, `hashFiles(...)`), que hashea el fichero y no lo interpreta. El semver de
producto sale de `package.json` vía `STOCKEIRO_VERSION` (`src/lib/version/identity.ts`), y
`scripts/check-version-bump.mjs` compara dos `package.json` con `git show`. Cero
consumidores.

**Lo decisivo, sin embargo, es CA-19, y ahí no hay margen.** Su conjunto es cerrado y dice
«**únicamente**»: `src/app/page.tsx`, `src/app/globals.css`, `tests/`, `docs/`,
`_qa/SPEC-050/`, `package.json`. `package-lock.json` no está en él. Si el implementador lo
hubiera incluido, yo habría tenido que marcar **RED por CA-19** — y ampliar el conjunto por
mi cuenta, en el gate, para acomodar un fichero que la spec no nombró sería **reescribir el
criterio que estoy juzgando**, justo en el CA cuyo único árbitro soy yo. Su decisión no es
solo defendible: dentro de esta spec es la única disponible.

**No, dejar el lock desincronizado no es un defecto que esta entrega deba cerrar.** Precede a
la rama en dos subidas de versión, no rompe ningún gate, no lo lee nadie, y cerrarlo aquí
costaría un CA a cambio de nada.

#### `F-SPEC-050-4`: bien encuadrado, y no es más grave de lo que suena

Su severidad real es **fricción operativa recurrente, no riesgo de producto**: quien suba la
versión seguirá teniendo que revertir el lock a mano sin saber por qué, y quien luego corra
`npm install` verá aparecer un `package-lock.json` modificado que él no pidió. Nada más:
ningún artefacto publicado depende de ese número.

Añado **un dato que refuerza el finding sin agravarlo**: el texto de ayuda del propio gate
(`scripts/check-version-bump.mjs`, `npm version <segmento> --no-git-tag-version`) **recomienda
exactamente el comando que produce la deriva**, y después no la comprueba. El gate documenta
cómo ensuciar el lock y no mira si se ensució. **EPIC-INFRA** es el destino correcto, y la
decisión de una línea que el finding propone —o el gate sincroniza el lock, o se declara por
escrito que el lock no lleva la versión de producto— es exactamente la que hay que tomar.
**Nada de esto bloquea esta entrega.**

#### Lo que sigue en manos del humano

`F-SPEC-050-1` —si la tarjeta que el foro ve al compartir `/` debe volver a decir la
cadencia— **sigue abierto y sigue siendo del humano**, tal como lo dejé en la ronda 1. No
bloquea: ningún criterio aprobado se vuelve falso y las guardias de SPEC-051 están verdes.

---

### 🔴 RED — 2026-08-23 (ronda 1, superado), sdd-verificador

**21 de 22 CA verificados en verde con evidencia ejecutada. Uno falla, y no es de
presentación: `npm run version:check` está en rojo porque `origin/main` se movió debajo de
esta rama.** No hay ningún defecto en la pantalla: la implementación es correcta, acotada y
está bien probada. Lo que falla es la identidad del artefacto, y falla ahora mismo, no en
teoría.

#### Cómo se ha juzgado

Con el árbol **limpio** y **después** de commitear (SPEC-049): `git status --porcelain`
vacío antes y después de cada gate. Ejecutado por mí, entero, en este worktree:

| Gate | Resultado |
|---|---|
| `npm run typecheck` | limpio |
| `npm run lint` (`--max-warnings=0`) | limpio |
| `npm test` | **1607 passed · 106 ficheros** |
| `npx playwright test` (completa) | **289 passed · 4,5 min** |
| `npm run version:check` | **exit 1 — 🔴** |

Y además, **fuera de la suite del proyecto**, una sonda de navegador propia contra
`next start`: orden del DOM, geometría a 360×800, 390×844, 768×1024 y 1280×900, colores
calculados, inventario completo de enlaces, el pie en `/` y en `/legal/terminos`, y el
recorrido de CA-21 navegando. Las capturas commiteadas se han **mirado**, no solo contado.

> **Nota de entorno.** `npx playwright test` completa reescribió las capturas de
> `_qa/SPEC-001…046/`. Restauradas con `git checkout -- _qa/` y **no** commiteadas; solo
> `_qa/SPEC-050/` queda en la rama. El árbol se dejó limpio.

#### F-1 (bloqueante) — la versión ya no sube: `origin/main` se llevó el `0.3.3`

```
$ npm run version:check          # árbol limpio, después de commitear
[check-version-bump] Base: origin/main.

Esta rama toca codigo de aplicacion y deja la version en 0.3.3, la misma
que la base.
Ficheros que lo disparan:
  · src/app/globals.css
  · src/app/page.tsx
exit 1
```

Cuando el implementador lo ejecutó, `origin/main` era `9387681` con `0.3.2` y el gate daba
verde. **Ya no.** `origin/main` es ahora `93971e5` —el merge del **PR #58, SPEC-051**— y su
`package.json` dice **`0.3.3`**: SPEC-051 se llevó ese número primero.

- **Qué rompe**: `ADR-024` pto. 9 y 10 (*el gate falla la PR*; *estrictamente mayor que
  `origin/main`*). Está cableado en `.github/workflows/ci.yml:132`, así que el PR sale rojo.
- **Por qué no es ceremonia**: dos artefactos distintos —dos `globals.css` y dos `page.tsx`
  distintos— publicados ambos como `v0.3.3`. Es literalmente el fallo que ADR-024 nombra,
  *«afirma una identidad estable sobre artefactos distintos»*, y con testers reportando
  desde un foro **por número de versión** deja de ser un detalle.
- **Arreglo**: `npm version patch --no-git-tag-version` → **`0.3.4`**, commitear, y volver a
  correr `npm run version:check` **con el árbol limpio**. Nada más. No toca ningún CA de
  presentación; `tests/primera-pantalla-fuente.test.ts` solo exige formato semver, así que
  sigue verde.
- **Lo que NO hay que hacer**: rebasar sobre `origin/main` para «arreglarlo» sin mirar. Los
  dos diffs no comparten ni un fichero (SPEC-051 toca `layout.tsx`, `proxy.ts`, `scripts/`,
  `opengraph-image.png`; ésta ninguno), pero el número sí colisiona y hay que subirlo a mano.

#### La acotación (CA-19), con el árbol limpio

`git diff --name-only 9387681..HEAD` (`9387681` es la base de la rama; sigue siendo el
`merge-base` con el `origin/main` de hoy):

```
_qa/SPEC-050/ancho-{360,390,640,700,730,760,768,800,1280}-primera-pantalla.png
_qa/SPEC-050/ca1-wordmark.png
_qa/SPEC-050/ca14-contraste-de-la-version.txt
_qa/SPEC-050/ca17-geometria.txt
_qa/SPEC-050/ca2-marca-vs-titular.txt
_qa/SPEC-050/ca21-camino-al-feedback.png
_qa/SPEC-050/ca3-barra-intacta.png
_qa/SPEC-050/ca6-contraste-del-primario.txt
_qa/SPEC-050/ca6-jerarquia-de-botones.txt
docs/epicas/EPIC-MEJORA/SPEC-050-…-fuera-del-hero.ledger.md
docs/epicas/EPIC-MEJORA/SPEC-050-…-fuera-del-hero.md
package.json
src/app/globals.css
src/app/page.tsx
tests/e2e/ayuda.spec.ts
tests/e2e/primera-pantalla.spec.ts
tests/primera-pantalla-fuente.test.ts
```

Verificado uno a uno: ni `src/db/`, ni `drizzle/`, ni `src/lib/`, ni `app-footer.tsx`, ni
`app-nav.tsx`, ni `layout.tsx`, ni `proxy.ts`, ni ninguna otra carpeta `_qa/SPEC-NNN/`. La
excepción que la spec declaró para `app-nav.tsx` **no se usó**. `package.json` cambia
**solo** `version`.

#### Las tres restricciones duras del gate: las tres, respetadas

- **`CADENCIA_LINEA` íntegra y única.** `src/lib/help/content.ts` **no aparece en el diff**.
  40 palabras, la misma constante en `/`, `/ayuda` y el vacío de `/vigiladas`. Ninguna
  aserción de `ayuda.spec.ts` › CA-3 tocada. **D-2 locked, intacto.**
- **`/` no consulta nada.** Sonda de red propia sobre `/`: **cero peticiones a cualquier
  origen distinto de la app**. `page.tsx` sigue llamando solo a `tieneSesion()`. SPEC-039
  CA-14, respetado.
- **`src/app/app-footer.tsx`: cero bytes.** La subordinación entera es
  `.landing ~ .app-footer .app-footer-feedback { display: none }`.

Y lo que **sigue** en `/`: descargo, tres enlaces legales, `tremen.dev` y **la versión del
despliegue** (SPEC-035 CA-9/CA-10/CA-11, SPEC-038 CA-1). Lo único retirado es el canal de
feedback.

#### CA-21 y CA-22: los dos que no podían pasar por vacuidad, y no pasan por vacuidad

- **CA-21** lo recorrí yo, navegando: `/` → único `a[href="/ayuda"]` («Cómo funciona, con
  detalle») → clic → `/ayuda` → canal **visible** con `href` `mailto:`. Comprobé además que
  la fila vuelve a `display:block` al llegar por navegación **de cliente** de Next, que es el
  modo de fallo real de un selector de hermano cuando React intercambia el `<main>`. Cada
  eslabón del test rompe si se corta: `toHaveCount(1)`, `click()`, `waitForURL`,
  `toBeVisible()`.
- **CA-22**: una sola aserción ajena estrechada, la autorizada, con su porqué al lado; y el
  **caso inverso existe y pasa** («y en la primera pantalla NO se muestra»). El fichero no
  pierde cobertura sobre `/`. Ningún segundo fichero ajeno tocado.

#### Sobre la columna `Estado`

La encontré **vacía en `Verif.` y en `❌` en las 22 filas**, y la sección de veredicto sin
escribir. El implementador no se auto-adjudicó nada: la reversión que declaró está hecha
(`cf146bf`). Lo que hay ahora en esas dos columnas es **mío**.

#### Juicio sobre `F-SPEC-050-1` (lo pidió el gate humano)

**Es consecuencia legítima del CA, no un CA mal redactado.** CA-11 nombra el fichero
(`src/app/page.tsx`) y prohíbe en él cualquier literal que empareje
`/cierre|refresc|una vez al día|tiempo real|diferid/i`. La `description` vieja decía
*«Precios de cierre, una vez al día»*: **casaba, y casaba por el motivo exacto que el CA
declara** —era un segundo literal de la cadencia envejeciendo al lado de la constante, que
es `F-SPEC-039-3` otra vez—. No fue daño colateral de un regex ancho: dio en su blanco.
Escalar en vez de cambiarla habría sido peor: dejarla hacía CA-11 inalcanzable, y
parafrasearla para esquivar el regex habría creado un **tercer** literal.

**Pero hay una decisión de producto que el implementador no tenía autoridad para cerrar
solo, y que ahora es más grande que cuando la anotó.** Elegir `QUE_HACE` como reemplazo es
lo más defendible que cabía dentro del CA (misma constante, no puede desincronizarse), y sin
embargo el efecto es que **el fragmento compartido de `/` ya no menciona la cadencia**. Con
**SPEC-051 mergeada**, eso deja de ser abstracto: su CA-3 decide **a propósito** no declarar
`openGraph.description` en el layout para que cada página aporte la suya, así que
`metadata.description` de `page.tsx` **es literalmente el texto de la tarjeta que el foro
enseña antes de entrar**. Y **R-4** dice que si la cadencia no se dice alto, el feedback que
vuelva del foro será «no actualiza» y se habrá gastado la publicación.

Ningún criterio aprobado se vuelve falso —SPEC-039 CA-3 habla de las **tres pantallas**, no
de la etiqueta, y la frase sigue entera en `/`— y las guardias de SPEC-051 siguen verdes
(`tarjeta.spec.ts` compara `og:description` **con** la `description` de la página, no con un
literal). **No bloquea esta entrega.** Lo que pido es que **el humano decida** si la tarjeta
del foro debe volver a decir la cadencia; y si dice que sí, la forma honesta es la que ya
escribieron el arquitecto y el implementador: componerla **desde `CADENCIA_LINEA`**, nunca un
segundo literal. Dueño natural: la sucesora de **SPEC-051**.

#### Qué hace falta para el GREEN

Una sola cosa, mecánica: **subir la versión a `0.3.4`**, commitear y volver a pasar
`version:check` con el árbol limpio. Vuelve entonces al gate y solo hay que re-verificar F-1
—lo demás está medido y no lo toca.

## Evidencia visual
<!-- Capturas de trabajo: test-results/SPEC-050/ (ignorado por git). Evidencia que se commitea: _qa/SPEC-050/ -->
<!-- Pedir en el gate: la primera pantalla completa a 390, 768 y 1280 px, antes y después. -->

En `_qa/SPEC-050/`, todo generado por `tests/e2e/primera-pantalla.spec.ts`. **Las capturas se
regeneraron en la ronda 2** sobre un build posterior al bump, así que el pie que se ve en ellas
dice `v0.3.4` y el commit `190de31`: es el artefacto que se mergea, no el `v0.3.3` que la ronda 1
fotografió y que ya no existe. Los `.txt` de cifras no cambian (ninguna medida depende del
número). Ficheros:

- `ancho-{360,390,640,700,730,760,768,800,1280}-primera-pantalla.png` — la pantalla entera a
  los ocho anchos del proyecto **más 768**, que es el que el gate pidió y no está en `ANCHOS`.
- `ca1-wordmark.png` — la marca sola, con su punto de acento.
- `ca3-barra-intacta.png` — la barra de navegación en `/dashboard` tras el desacoplo (R-2).
- `ca21-camino-al-feedback.png` — `/ayuda` al final del recorrido de dos clics desde `/`.
- `ca2-marca-vs-titular.txt`, `ca6-jerarquia-de-botones.txt`,
  `ca6-contraste-del-primario.txt`, `ca14-contraste-de-la-version.txt`, `ca17-geometria.txt`
  — las cifras, impresas y no solo comprobadas. En corto: marca **28 px** frente a un titular
  de **32–52 px**; áreas **165×55 vs. 90×49 → 2,07×** a los ocho anchos; primario
  **6,88:1** (umbral 4,5); versión en `/` **3,77:1** (umbral 3); M1/M2 con **33 elementos
  medidos y 0 violaciones** a cada ancho, y los **testigos** de `.landing-acciones` y del
  wordmark presentes en los ocho (sin ellos, «cero violaciones» no aprobaría nada).

### Lo que vio el verificador (2026-08-23)

Miradas una a una las capturas commiteadas de **360, 390 y 1280**, y generadas y miradas las
mías propias a **360×800, 390×844, 768×1024 y 1280×900** contra `next start`. Lo que se ve:

- La marca **se lee como marca** a los cuatro anchos: 28 px, negra, con el punto naranja. No
  es un microcrédito ni compite con el titular (32 px a 360, 52 px a 1280).
- **«Crear cuenta» domina sin borrar a «Entrar»**: 165×55 frente a 90×49 (2,06×), naranja
  pleno contra contorno. Por debajo de 720 px apilan —`@media` heredado de SPEC-039— y
  apiladas la jerarquía se lee todavía más clara.
- **«gratis y sin publicidad» ya no es la línea más apagada**: sube pegada a los botones, en
  `--fg` opaco, y se lee antes que cualquier negación.
- La **cadencia se lee como prosa, entera**, sin borde ámbar, sin fondo elevado y sin radio.
- El pie de `/` conserva **descargo, legales, versión y marca**; **falta solo** la fila de
  feedback, con alto 0 y sin hueco muerto detrás.
- A **360×800** la llamada a la acción cae en `y=316…371`: **por encima del pliegue y sin
  desplazar**, que es lo que exige `tests/e2e/movil-alta.spec.ts` (SPEC-040 CA-2), verde y
  sin tocarse.

Medida propia, no del implementador: `/` hace **cero peticiones a cualquier origen externo**.

**Mirado a ojo, no solo en el DOM** (2026-08-23, capturas de 360 y 1280): la marca se lee como
marca; «Crear cuenta» domina sin que «Entrar» desaparezca; «gratis y sin publicidad» queda
pegado a los botones y ya no es la línea más apagada; la cadencia se lee como prosa, entera,
sin borde ámbar; y el pie de `/` conserva descargo, legales, versión y marca, sin la fila de
feedback. A 360 px la llamada a la acción cae hacia los 320–430 px de una ventana de 800:
**por encima del pliegue y sin desplazar**, que es lo que `tests/e2e/movil-alta.spec.ts`
(SPEC-040 CA-2) exige y sigue exigiendo sin tocarse.

## Salvedades / follow-ups
<!-- IDs F-SPEC-050-1… con destino (spec futura o EPIC-MEJORA). -->

- **`F-SPEC-050-1` — la descripción de `/` dejó de contar la cadencia, y fue CA-11 quien lo
  obligó.** `src/app/page.tsx` exportaba `metadata.description` con un literal propio:
  *«…Precios de cierre, una vez al día»*. **CA-11 prohíbe literalmente** cualquier cadena en ese
  fichero que empareje `/cierre|refresc|una vez al día|tiempo real|diferid/i`, así que la
  descripción **tenía que cambiar** o el CA era inalcanzable. Se ha resuelto por donde el propio
  CA apunta: `description: QUE_HACE`, la **misma constante** que se renderiza en la página, en vez
  de una paráfrasis que envejece sola (`F-SPEC-039-3`). Consecuencia que hay que ver: el
  fragmento que un buscador o un compartido enseñan de `/` ya **no menciona la cadencia**. Nada
  la exigía ahí —SPEC-039 CA-3 habla de las **tres pantallas**, no de la etiqueta `description`,
  y la frase sigue entera en `/` (CA-9)—, pero es una decisión de producto que no estaba escrita
  en la spec y por eso se levanta aquí. *Destino*: **EPIC-MEJORA**, y con dueño natural: la
  **SPEC-051 hermana** (la tarjeta de Open Graph) es quien decide qué se lee de `/` cuando se
  comparte. Si el humano quiere la cadencia en el fragmento, la forma honesta es la que ya escribió
  el arquitecto en la nota 4 de esta spec: componerla **desde `CADENCIA_LINEA`**, nunca un segundo
  literal.
- **`F-SPEC-050-2` — el `mailto:` sigue en el HTML de `/`, oculto.** Es consecuencia declarada de
  D-5 y está dicha en la propia spec: el pie no sabe en qué ruta está (CA-15), así que la fila se
  retira **visualmente** con `display: none`. El roce contado era visual y visualmente desaparece;
  un rastreador que lea el HTML crudo seguirá viendo la dirección. *Destino*: **ninguno mientras
  el pie siga siendo agnóstico de ruta** — quitarlo del HTML exigiría dárselo a saber, que es
  exactamente lo que D-4 compra al no hacerlo. Se anota para que nadie lo descubra como sorpresa.
- **`F-SPEC-050-3` — el desacoplo de `.brand` deja lista una capacidad que esta spec no usa.**
  `/login`, `/register`, `/forgot-password` y `/legal` tampoco montan `AppNav` y también están sin
  marca. D-1 deja la clase servida y llevarla allí cuesta una línea por pantalla, pero **está
  fuera de alcance por escrito** (§Fuera) porque lo observado fue la primera pantalla y cada una
  de esas páginas tiene su propio reparto de espacio. *Destino*: **EPIC-MEJORA**, el día que se
  mire el embudo entero del foro o el humano lo pida.

- **`F-SPEC-050-4` — `package-lock.json` sigue declarando `0.3.2`, y se ha dejado así a
  propósito.** `npm version patch --no-git-tag-version` sube el número **en los dos** ficheros;
  aquí el del lock se ha revertido, y el motivo es **CA-19**: su conjunto de ficheros permitidos
  es cerrado (`src/app/page.tsx`, `src/app/globals.css`, `tests/`, `docs/`, `_qa/SPEC-050/`,
  `package.json`) y **`package-lock.json` no está en él**. Meterlo habría puesto en juego un CA
  de gate para arreglar otro. La desincronización **no la crea esta rama**: ya venía de
  `origin/main`, donde hoy conviven `package.json` en `0.3.3` y el lock en `0.3.2` —las dos
  últimas subidas (la de esta rama y la de SPEC-051) tampoco tocaron el lock, mientras que la de
  `0.3.1 → 0.3.2` (`3f62762`) sí lo hizo; de ahí la deriva. Y **no rompe la CI**: los dos jobs
  instalan con `npm ci` (`.github/workflows/ci.yml:85` y `:160`), que valida el árbol de
  dependencias y no el campo `version` de la raíz — comprobado aquí con `npm ci --dry-run`
  → `added 156 packages`, **exit 0**, y comprobado también por el hecho de que `origin/main` pasa
  la CI hoy con esa misma deriva. *Destino*: **EPIC-INFRA**, como decisión de una línea: o el
  gate de ADR-024 sincroniza también el lock, o se declara por escrito que el lock no lleva la
  versión de producto. Mientras no se decida, quien suba la versión seguirá teniendo que revertir
  el lock a mano y sin saber por qué.

## Cómo retomar (handoff)

**Estado: implementada, `en-revision`. Le toca a sdd-verificador.** No hay PR y no se ha
mergeado nada.

### Cómo se ejecuta esto
- Unitarios: `npm test` → **1607 pasan, 106 ficheros**. Los de esta spec están en
  `tests/primera-pantalla-fuente.test.ts` (21 casos).
- Navegador: hace falta **construir antes**, porque el e2e arranca `next start`:
  `DATABASE_URL=postgres://ci:ci@localhost:5432/ci AUTH_SECRET=ci-not-a-real-secret-ci-not-a-real-secret npm run build`
  y después `npx playwright test tests/e2e/primera-pantalla.spec.ts` (22 casos, ~20 s con el
  servidor arriba).
- ⚠️ **`npx playwright test` completa reescribe capturas commiteadas de otras specs** bajo
  `_qa/SPEC-001…046/`. Aparecen modificadas sin que nadie las haya tocado. Se restauran con
  `git checkout -- _qa/` y se commitea **solo** `_qa/SPEC-050/`.

### La prueba de que los tests prueban algo (RED antes de GREEN)
`tests/e2e/primera-pantalla.spec.ts` se ejecutó **contra la implementación anterior**, con
`src/app/page.tsx` y `src/app/globals.css` devueltos a su estado de `9387681` y la app
reconstruida: **10 casos en rojo**, cada uno por su motivo (sin wordmark, `.landing-eyebrow`
presente, orden viejo, la ayuda dentro de `.landing-acciones`, sin línea de «gratis», borde
ámbar de 3 px, feedback en `display: block` en `/`, y los bloques nuevos inexistentes). Los
**12 restantes pasaban ya**, y eso también es información: son los CA de **no regresión**
(CA-3, CA-8, CA-9, CA-12, CA-14, CA-16, CA-21 y la geometría), que por definición tenían que
estar verdes antes y después. Con la implementación puesta: **22/22**.

### Lo que el verificador tiene que juzgar y la suite no puede
- **CA-19 (acotación), que es suyo y va aquí.** El árbol tiene que estar **limpio** antes del
  veredicto (SPEC-049: sobre un árbol sucio el gate de versión se **abstiene con 2**, y eso no es
  un fallo). Ficheros tocados por la rama, esperados: `src/app/page.tsx`, `src/app/globals.css`,
  `tests/e2e/primera-pantalla.spec.ts`, `tests/primera-pantalla-fuente.test.ts`,
  `tests/e2e/ayuda.spec.ts`, `docs/epicas/EPIC-MEJORA/SPEC-050-*`, `_qa/SPEC-050/` y
  `package.json` (solo `version`). **Nada más**: ni `src/app/app-footer.tsx`, ni
  `src/app/app-nav.tsx`, ni `src/app/layout.tsx`, ni `src/proxy.ts`, ni `src/db/`, ni `drizzle/`,
  ni `src/lib/`, ni ninguna otra carpeta `_qa/SPEC-NNN/`.
  Salida de `git diff --name-only origin/main...HEAD` **con el árbol limpio**, tras commitear
  (la deja aquí el implementador como insumo; **el veredicto de CA-19 es del verificador**):

  ```
  _qa/SPEC-050/ancho-{360,390,640,700,730,760,768,800,1280}-primera-pantalla.png
  _qa/SPEC-050/ca1-wordmark.png
  _qa/SPEC-050/ca2-marca-vs-titular.txt
  _qa/SPEC-050/ca3-barra-intacta.png
  _qa/SPEC-050/ca6-contraste-del-primario.txt
  _qa/SPEC-050/ca6-jerarquia-de-botones.txt
  _qa/SPEC-050/ca14-contraste-de-la-version.txt
  _qa/SPEC-050/ca17-geometria.txt
  _qa/SPEC-050/ca21-camino-al-feedback.png
  docs/epicas/EPIC-MEJORA/SPEC-050-…-fuera-del-hero.ledger.md
  docs/epicas/EPIC-MEJORA/SPEC-050-…-fuera-del-hero.md
  package.json
  src/app/globals.css
  src/app/page.tsx
  tests/e2e/ayuda.spec.ts
  tests/e2e/primera-pantalla.spec.ts
  tests/primera-pantalla-fuente.test.ts
  ```

  `npm run version:check` con el árbol limpio: **exit 0**, *«La version sube de 0.3.2 a 0.3.3»*.
  (Ejecutado **después** de commitear, no antes: sobre un árbol sucio SPEC-049 hace que el gate
  se abstenga con **2**, y una abstención citada como verde es lo que costó el PR #56.)

- **La excepción que la spec declaró para `app-nav.tsx` no se ha usado**: el fichero no se ha
  tocado en absoluto. El desacoplo salió entero del CSS.
- **CA-6 con el ojo, no solo con el número** (R-5): la razón de áreas es 2,07 a los ocho anchos,
  pero «≥ 1,3» se cumple también con un botón ancho y feo. Las capturas están en
  `_qa/SPEC-050/`; el juicio es humano.

### Lo que NO se ha tocado, y conviene comprobar que sigue siendo verdad
- **`CADENCIA_LINEA` está intacta** (`src/lib/help/content.ts` no se abre en este diff): 40
  palabras, la misma constante en las tres pantallas. **D-2 locked, respetado.**
- **`src/app/app-footer.tsx`: cero bytes.** La subordinación entera vive en
  `.landing ~ .app-footer .app-footer-feedback { display: none }`.
- **El descargo, los enlaces legales y `tremen.dev`**: idénticos, y CA-12 lo mide comparando
  contra `/legal/terminos` en vez de contra literales.
- **`.landing-acciones` conserva su nombre de clase**, porque `tests/e2e/ayuda-responsive.spec.ts`
  necesita que su lista `CONTENEDORES` case con al menos dos elementos en `/`.

### Contexto que sigue vivo del arquitecto
- **Decisión del humano (D-5, CA-13, CA-14, CA-21, CA-22):** en `/` se **retira el canal de
  feedback** y **se queda la versión**. Su matiz —*«el feedback es importante para mí, ya que
  permite a los usuarios decirme qué cosas puedo mejorar»*— está atado con **CA-21**, que recorre
  `/` → `/ayuda` → canal **navegando**. Ese es el CA que no puede ponerse verde por accidente:
  si un día alguien quita el enlace «Cómo funciona, con detalle» de la landing, el camino anónimo
  al feedback muere y este test es lo único que lo caza.
- **Una sola aserción ajena tocada, y está autorizada:** el bucle de `tests/e2e/ayuda.spec.ts`
  (SPEC-039 CA-12) pierde `/` y **nada más**, con su porqué escrito al lado en el propio fichero
  y sustituido por un caso **inverso** que afirma que en `/` el canal no se muestra. **Un segundo
  fichero ajeno modificado sería RED** — no lo hay.
- **Riesgo de merge conocido**: `src/app/globals.css` en dos zonas (`.app-nav .brand` y el bloque
  `.landing*`). **Solape con SPEC-051** (PR #58, sin mergear): aquella toca `src/app/layout.tsx`,
  `src/proxy.ts`, `scripts/` y `src/app/opengraph-image.png`; ésta **ninguno de los cuatro**. No
  hay conflicto de fichero, pero sí uno **de sentido**: `F-SPEC-050-1` cambia
  `metadata.description` de `/`, que es justo lo que SPEC-051 pone en la tarjeta al compartir. El
  orden de merge lo decide el orquestador.

### Ronda 2 (2026-08-23, sdd-implementador) — cómo se cerró `F-1`

**El veredicto anterior fue RED con 21 de 22 CA en verde, y el único finding no estaba en el
producto: estaba en el número.** Queda escrito aquí porque va a repetirse en cuanto dos specs
hermanas vuelvan a ir en paralelo.

**Qué pasó.** `origin/main` **se movió por debajo de la rama mientras ésta esperaba en el gate**:
de `9387681` —la base contra la que el arquitecto escribió la spec y contra la que se implementó—
a `93971e5`, el merge del PR #58 (**SPEC-051**, la tarjeta de Open Graph). SPEC-051 **se llevó el
`0.3.3`**, que es exactamente el número que esta rama también dejaba puesto. A partir de ese
merge, `npm run version:check` falla:

```
Esta rama toca codigo de aplicacion y deja la version en 0.3.3, la misma que la base.
Ficheros que lo disparan:  · src/app/globals.css  · src/app/page.tsx
exit 1
```

**Por qué importa.** **ADR-024 ptos. 9 y 10** piden versión **estrictamente mayor** que la de la
base, y la CI lo cablea en `.github/workflows/ci.yml:132`. No es ceremonia: se publicarían **dos
`globals.css` y dos `page.tsx` distintos bajo el mismo `v0.3.3`**, y los testers de esta app
reportan **desde un foro, citando el número de versión**. Un número que no se mueve afirma una
identidad estable sobre artefactos que ya no lo son.

**Cómo se cerró.** `npm version patch --no-git-tag-version` → **`0.3.4`**, commiteado, y el gate
re-ejecutado **con el árbol ya limpio** (esto último no es un detalle: **SPEC-049** hizo que sobre
un árbol sucio el gate se **abstenga con `2`**, y una abstención no es un verde):

```
$ npm run version:check          # arbol limpio, despues de commitear
[check-version-bump] Base: origin/main.
[check-version-bump] La version sube de 0.3.3 a 0.3.4.
exit 0
```

**Lo que deliberadamente NO se hizo, y por qué.**
- **No se rebasó sobre `origin/main`.** Los dos diffs **no comparten ni un fichero**: SPEC-051
  tocó `src/app/layout.tsx`, `src/proxy.ts`, `scripts/` y el PNG; ésta toca `src/app/page.tsx`,
  `src/app/globals.css` y tests. Lo que colisiona es **el número**, no el contenido, y el número
  se sube a mano en un fichero. Un rebase habría movido 22 CA de sitio para no arreglar nada.
- **No se tocó ni una línea de presentación.** Los 21 CA verdes tenían evidencia ejecutada; abrir
  un fichero de producto los habría vuelto a poner en juego. El diff de esta ronda es
  `package.json`, un campo, más este ledger.
- **`package-lock.json` se revirtió** — ver `F-SPEC-050-4`, con la evidencia de que `npm ci`
  sigue contento.

**Lo que quedó verde tras la ronda**, re-ejecutado aquí: `npm test` → **1607 pasan, 106
ficheros**; `tests/primera-pantalla-fuente.test.ts` → **21/21**. El diff sigue **dentro del
conjunto de CA-19** y la única carpeta de evidencia tocada sigue siendo `_qa/SPEC-050/`.

**La lección, para la próxima pareja de specs hermanas.** El handoff de la ronda 1 ya había visto
venir a SPEC-051 y anotó el riesgo de merge —pero lo acotó a un conflicto **de fichero** («no hay
conflicto de fichero, pero sí uno de sentido»). Faltaba el tercer tipo: **el conflicto de
recurso compartido único**. La versión de `package.json` es un recurso así, y **la reclama quien
mergea primero**, no quien ramifica primero. Regla práctica: mientras haya otra rama viva que
toque `src/`, la versión de la rama que espera en el gate **es provisional**, y hay que
re-ejecutar `npm run version:check` **inmediatamente antes de abrir la PR**, no cuando se
implementó. Es barato y es el único momento en que la respuesta vale.
