---
id: SPEC-050
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-050 La primera pantalla: la marca visible, una entrada clara y la advertencia fuera del hero

## Resumen
- Fase: `en-revision` — implementada por sdd-implementador el 2026-08-23 sobre la spec
  aprobada por el humano ese mismo día. Pendiente del gate de sdd-verificador.
- Rama: `ft/SPEC-050-la-primera-pantalla-la-marca-visible-una-entrada-clara-y-la-advertencia-fuera-del-hero`
  (sale de `origin/main` en `9387681`).
- **Nació como `SPEC-049`.** Otra sesión mergeó en `origin/main` una SPEC-049 propia (EPIC-FIX,
  *el gate de versión no dice verde sobre un árbol sucio*) mientras ésta se escribía. Id
  reasignado desde `origin/main`; citas reverificadas contra `9387681`.
- **Ficheros de producto tocados: dos.** `src/app/page.tsx` y `src/app/globals.css`. Ni
  `app-footer.tsx`, ni `app-nav.tsx`, ni `proxy.ts`, ni `layout.tsx`, ni nada bajo `src/db/`,
  `drizzle/` o `src/lib/`. Versión **0.3.2 → 0.3.3** (PATCH, ADR-024: presentación pura).
- **Un solo fichero de test ajeno modificado**, el que CA-22 autoriza nominalmente:
  `tests/e2e/ayuda.spec.ts`. Ningún otro.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->

| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (wordmark en `/`) | `src/app/page.tsx` (`.landing-marca brand`, `<p>` no enlace) · `src/app/globals.css` (`.brand`, `.landing-marca`; fuera `.landing-eyebrow`) | `tests/e2e/primera-pantalla.spec.ts` › CA-1 ×3 (primer elemento y texto `Stockeiro.`; punto `--accent` y palabra `--fg` **derivados por sonda**; `.landing-eyebrow` a cero) | | 🚧 |
| CA-2 (es marca, no microcrédito) | `src/app/globals.css` (`.landing-marca { --brand-size: 28px }`) | `tests/e2e/primera-pantalla.spec.ts` › CA-2 (8 anchos: sans, 900, `text-transform: none`, 24–32 px y **siempre < `.landing-title`**). Medido: **marca 28 px, titular 32 px a 360 y 52 px a 1280** — `_qa/SPEC-050/ca2-marca-vs-titular.txt` | | 🚧 |
| CA-3 (la barra no se entera) | `src/app/globals.css` (`.app-nav .brand` conserva solo `text-decoration`) | `tests/e2e/primera-pantalla.spec.ts` › CA-3 (`/dashboard` con sesión; familia/colores por sonda del tema, 20 px, −0,9 px de tracking, sin subrayado) | | 🚧 |
| CA-4 (una sola definición) | `src/app/globals.css` (`.brand` + `.brand .dot` de primer nivel) · `src/app/page.tsx` | `tests/primera-pantalla-fuente.test.ts` › CA-4 ×5 (una sola regla define la tipografía; `var(--brand-size, 20px)`; un solo `.brand .dot`; `.app-nav` sin `font`/`color`; **mismo par de nodos** que `app-nav.tsx`) | | 🚧 |
| CA-5 (orden de la pantalla) | `src/app/page.tsx` (nueve nodos en el orden de la tabla) | `tests/e2e/primera-pantalla.spec.ts` › CA-5 (secuencia exacta + `QUE_HACE` y acciones **antes** de cadencia y límites) | | 🚧 |
| CA-6 (jerarquía de los botones) | `src/app/page.tsx` (ayuda fuera de la fila) · `src/app/globals.css` (`.landing-acciones .btn.primary`) | `tests/e2e/primera-pantalla.spec.ts` › CA-6 ×3 (único `.primary`; razón de áreas ≥ 1,3 → **2,07 a los ocho anchos** (165×55 frente a 90×49), cifras en `_qa/SPEC-050/ca6-jerarquia-de-botones.txt`; contraste del primario en `_qa/SPEC-050/ca6-contraste-del-primario.txt`) | | 🚧 |
| CA-7 («gratis y sin publicidad» sube) | `src/app/page.tsx` (`.landing-gratis`) · `src/app/globals.css` | `tests/e2e/primera-pantalla.spec.ts` › CA-7 (literal declarado; **ni «ilimitado» ni «para siempre» ni «sin coste»**; color ≠ `--fg-dim`; tamaño ≥ el de la línea legal; antes que la cadencia) | | 🚧 |
| CA-8 (cuatro caminos, uno de cada) | `src/app/page.tsx` | `tests/e2e/primera-pantalla.spec.ts` › CA-8 (uno de cada + **cero `a[href="/"]`**: el wordmark no es enlace) · `tests/e2e/ayuda.spec.ts` › CA-2 «ofrece los cuatro caminos» **sin tocar** | | 🚧 |
| CA-9 (`CADENCIA_LINEA` entera) | `src/app/page.tsx` (`{CADENCIA_LINEA}`) | `tests/e2e/primera-pantalla.spec.ts` › CA-9 · `tests/e2e/ayuda.spec.ts` › CA-3 (las tres pantallas) **sin tocar ninguna aserción** | | 🚧 |
| CA-10 (sin cromo de alarma) | `src/app/globals.css` (`.landing-cadencia` agrupada con `.landing-limites`) | `tests/e2e/primera-pantalla.spec.ts` › CA-10 (4 bordes a 0; `--amber` y `--bg-step` **derivados por sonda** y descartados; radio 0; color idéntico al de `.landing-limites` y a `--fg-muted`) | | 🚧 |
| CA-11 (ni una palabra nueva de cadencia) | `src/app/page.tsx` (`description: QUE_HACE`) | `tests/primera-pantalla-fuente.test.ts` › CA-11 ×3 (importa y renderiza la constante; **cero** `/cierre\|refresc\|una vez al día\|tiempo real\|diferid/i` fuera de comentarios; la constante sigue con sus 40 palabras) | | 🚧 |
| CA-12 (descargo, legal y marca intactos) | — (no se toca nada) | `tests/e2e/primera-pantalla.spec.ts` › CA-12 (`color` y `font-size` de los tres bloques **idénticos** a los de `/legal/terminos`) · `tests/e2e/pie-legal.spec.ts` **sin tocar** | | 🚧 |
| CA-13 (feedback oculto en `/`, versión subordinada) | `src/app/globals.css` (`.landing ~ .app-footer .app-footer-feedback { display: none }`) | `tests/e2e/primera-pantalla.spec.ts` › CA-13 (`display: none` y **alto 0**, no `visibility`/`opacity`; versión visible en `--fg-dim`; en `/legal/terminos` las dos visibles con `--fg-muted`/`--fg-dim`) | | 🚧 |
| CA-14 (la versión sigue visible y copiable) | — (no se toca) | `tests/e2e/primera-pantalla.spec.ts` › CA-14 (semver primero, los cuatro atajos prohibidos comprobados, contraste sobre el fondo ≥ 3:1 con la cifra en `_qa/SPEC-050/ca14-contraste-de-la-version.txt`, y el rango de selección devuelve el texto) · `tests/e2e/version-en-el-pie.spec.ts` **sin tocar** | | 🚧 |
| CA-15 (el pie no sabe en qué ruta está) | `src/app/app-footer.tsx` **sin un solo byte de cambio** | `tests/primera-pantalla-fuente.test.ts` › CA-15 ×4 (sin `usePathname`/`headers`/`landing`; `AppFooter()` sin argumentos; sus cinco bloques; la subordinación **vive en el CSS** y es `display: none`) · `tests/legal-import-graph.test.ts` y `tests/ayuda-import-graph.test.ts` verdes | | 🚧 |
| CA-16 (con sesión, `/` lleva al panel) | — (no se toca) | `tests/e2e/primera-pantalla.spec.ts` › CA-16 · `tests/e2e/ayuda.spec.ts` › «con sesión, la raíz sigue llevando al panel» **sin tocar** | | 🚧 |
| CA-17 (geometría a los ocho anchos) | `src/app/globals.css` | `tests/e2e/primera-pantalla.spec.ts` › CA-17 ×3 (M1+M2 a los 8 anchos **con testigos** ADR-030 §5, cifras en `_qa/SPEC-050/ca17-geometria.txt`; hueco muerto de los bloques **nuevos** medido por cajas de línea; `.landing-acciones` sigue siendo grid **con ese nombre**) · `tests/e2e/ayuda-responsive.spec.ts` y `tests/e2e/geometria-rutas.spec.ts` **sin tocar** | | 🚧 |
| CA-18 (suites verdes; acotación al gate) | — | `npm test` → **1607 passed (106 ficheros)** · `npx playwright test` **completa** → **289 passed (4,0 min)**, con las cinco citadas dentro: `ayuda.spec.ts`, `version-en-el-pie.spec.ts`, `pie-legal.spec.ts`, `ayuda-responsive.spec.ts` y `pie-responsive.spec.ts`. La mitad de acotación la comprueba el verificador en el gate | | 🚧 |
| CA-19 (alcance acotado — **criterio de gate, no de suite**) | n-a | n-a — **y la nota es el punto**: *«este cambio está bien acotado»* es criterio de gate (**ADR-031 pto. 1.2**) y escribirlo como `git diff … origin/main` reproduciría el molde que **SPEC-048** desmontó, que se pone verde por vacuidad al mergear. No se ha inventado ningún test: la evidencia del árbol limpio la pega sdd-verificador aquí | | 🚧 |
| CA-20 (sin dependencia y sin ADR) | `package.json` (solo `version`) | `tests/primera-pantalla-fuente.test.ts` › CA-20 ×5 (deps, devDeps y scripts **declarados en el test**, sin git; semver; **ningún ADR cita SPEC-050**) | | 🚧 |
| CA-21 (el camino anónimo al feedback sobrevive) | `src/app/page.tsx` (el enlace a `/ayuda`, fuera de la fila pero presente) | `tests/e2e/primera-pantalla.spec.ts` › CA-21 — **navega de verdad**: `/` → clic «Cómo funciona, con detalle» → `/ayuda` → canal visible con `href` `mailto:`. Captura en `_qa/SPEC-050/ca21-camino-al-feedback.png` | | 🚧 |
| CA-22 (la guardia ajena que se estrecha) | `tests/e2e/ayuda.spec.ts` (bucle sin `/`, porqué al lado, caso inverso nuevo) | `tests/primera-pantalla-fuente.test.ts` › CA-22 ×4 (una por condición) · el caso inverso vive en `tests/e2e/ayuda.spec.ts` › «y en la primera pantalla NO se muestra» | | 🚧 |

> **CA-19 no lleva fila de test a propósito.** Es criterio de acotación y **ADR-031 pto. 1.2**
> lo saca de la suite: lo verifica sdd-verificador en el gate y **pega aquí la salida**.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Capturas de trabajo: test-results/SPEC-050/ (ignorado por git). Evidencia que se commitea: _qa/SPEC-050/ -->
<!-- Pedir en el gate: la primera pantalla completa a 390, 768 y 1280 px, antes y después. -->

En `_qa/SPEC-050/`, todo generado por `tests/e2e/primera-pantalla.spec.ts`:

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
