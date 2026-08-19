---
id: SPEC-035
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-035 Paginas legales titular y descargo de no asesoramiento

## Resumen
- Fase: en-revision (ronda 2, respuesta al RED del 2026-08-19) <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-035-paginas-legales-titular-y-descargo`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/auth/guard.ts` (`PUBLIC_PREFIXES` += `/legal`); `src/app/legal/page.tsx`, `.../aviso-legal/page.tsx`, `.../privacidad/page.tsx`, `.../terminos/page.tsx` | `tests/e2e/legal.spec.ts` › *CA-1: las cuatro se leen sin sesión, y las de datos no* (4 rutas + «las rutas de datos siguen exigiendo sesión») | Ejecutado por mí (Playwright propio, app real en :3200): las 4 rutas responden **200** y se quedan en su `pathname` con contexto **sin cookies**; `/dashboard`, `/cartera`, `/cartera/importar`, `/vigiladas` y `/avisos` acaban en `/login`. | ✅ |
| CA-2 | `src/lib/auth/guard.ts`; `src/proxy.ts` (matcher intacto) | `tests/legal-rutas-publicas.test.ts` › *CA-2: /legal y sus subrutas son públicas* (4) + *el matcher del proxy no cambia* (2) | `git diff origin/main...HEAD -- src/proxy.ts`: el literal del `matcher` es idéntico. Contra la app: `/legalX`, `/legal-admin`, `/legales` y `/legal.json` acaban en `/login`. La excepción vive solo en `PUBLIC_PREFIXES`. | ✅ |
| CA-3 | `src/lib/legal/content.ts` (`TITULAR`); `src/app/legal/aviso-legal/page.tsx` | `tests/e2e/legal.spec.ts` › *CA-3: quién opera esto y cómo escribirle* (3, incl. «ninguna página legal contiene texto de relleno»); lista en `tests/legal-afirmaciones-prohibidas.ts` (`MARCADORES_DE_POSICION`) | Texto **renderizado** leído por mí en el navegador: «Alberto Fojo Eiras, persona física», domicilio completo, `hola@tremen.dev` (con `mailto:`) y `stockeiro.tremen.dev`. Barrido con **mi propia** lista de marcadores (13 patrones): ninguno. | ✅ |
| CA-4 | `src/app/legal/aviso-legal/page.tsx` (`data-testid="titular"`); `src/app/legal/privacidad/page.tsx` (`data-testid="responsable"`); `src/lib/legal/content.ts` (`MARCA`) | `tests/e2e/legal.spec.ts` › *CA-4: el responsable es la persona, no la marca* (4) | Leídas las dos frases marcadas: el sujeto es la persona en ambas. `tremen.dev` solo aparece en la sección «Marca y proyecto» y en el pie, nunca como titular ni responsable. | ✅ |
| CA-5 | `src/lib/legal/content.ts` (`CATEGORIAS_DE_DATO`); `src/app/legal/privacidad/page.tsx` | `tests/legal-datos-y-esquema.test.ts` (5: los dos conjuntos son EXACTAMENTE el mismo) + `tests/e2e/legal.spec.ts` › *la privacidad describe las siete categorías de dato del esquema* | Contrastado por mí contra `src/db/schema.ts`: tablas con `user_id` = `password_reset_tokens`, `transactions`, `watched_symbols`, `zone_triggers`, `notifications`, `symbol_aliases`, más `users`. Son exactamente las 7 declaradas. Las 5 columnas de `users` (email, hash, `password_changed_at`, `role`, `created_at`) están descritas una a una. | ✅ |
| CA-6 | `src/lib/legal/content.ts` (`ENCARGADOS`); `src/app/legal/privacidad/page.tsx` | `tests/e2e/legal.spec.ts` › *la privacidad nombra a los cinco terceros y para qué interviene cada uno* | Los cinco visibles con su «para qué» y su «qué ve». Contrastado con el código: precios **solo** Marketstack (`quote-provider-factory.ts`; `TwelveDataProvider` no está cableado), Twelve Data solo búsqueda, Resend en `resend-sender.ts`, cron diario `0 22 * * *` en `vercel.json`, Vercel/Neon por `docs/despliegue.md` §0. | ✅ |
| CA-7 | `src/lib/legal/content.ts` (`DATOS_DE_MERCADO`, `FUENTE_DE_PRECIOS`); `src/app/legal/terminos/page.tsx` y `.../privacidad/page.tsx` (`data-testid="datos-de-mercado"`) | `tests/e2e/legal.spec.ts` › *CA-7: de dónde vienen los precios y qué son* (2 rutas × fuente + diferido + informativo) | Leído el bloque en las dos rutas: fuente (Marketstack), «precios de cierre diferidos… no precios en tiempo real», «fecha de referencia», «carácter meramente informativo». | ✅ |
| CA-8 | `tests/legal-afirmaciones-prohibidas.ts` (lista cerrada, **16** entradas con motivo: +`con antelación`, +`aviso previo`, +`se avisaría`, ronda 2); redacción de `src/lib/legal/content.ts` (`DISPONIBILIDAD`, `CONSERVACION`) y de las 4 páginas | `tests/e2e/legal.spec.ts` › *CA-8: y NADA más que eso* (4 rutas) + *la disponibilidad describe el servicio y no promete un cierre avisado*; `tests/legal-textos-veraces.test.ts` (21 casos: la caducidad publicada = `RESET_TOKEN_TTL_MINUTES`, veto a las vaguedades más laxas que la realidad, y barrido de **todas** las cadenas del módulo con la lista cerrada) | Barrido del texto renderizado de las 4 páginas con **mi propia** lista (20 patrones, incluidos `copyright`, `©`, «derecho de uso» y «reserva de derechos», que no están en la del implementador): **ninguna** afirmación prohibida. Único acierto, `tiempo real`, es la forma negada que CA-7 exige. | ✅ |
| CA-9 | `src/app/app-footer.tsx`; `src/lib/legal/content.ts` (`DESCARGO_BREVE`, `DESCARGO_COMPLETO`); `src/app/legal/terminos/page.tsx` (`#no-asesoramiento`) | `tests/e2e/pie-legal.spec.ts` › *CA-9: el descargo de no asesoramiento, donde se ve* (5 públicas + «también con sesión iniciada» + «/legal/terminos contiene el texto completo») | Pie leído en 5 públicas y en `/dashboard`, `/cartera`, `/vigiladas`, `/avisos` con sesión real: descargo + enlace `#no-asesoramiento`. Texto completo en `/legal/terminos` con D-1 y D-4 explícitos. **Funcionalmente correcto; ver CA-17 por su presentación en móvil.** | ✅ |
| CA-10 | `src/app/app-footer.tsx` (sin sesión, sin BD); `src/app/layout.tsx` | `tests/e2e/pie-legal.spec.ts` › *CA-10* (4) + `tests/legal-import-graph.test.ts` › *el pie no lee la sesión* y *no alcanza ningún módulo prohibido* | Pie idéntico con y sin sesión; en `/dashboard`…`/avisos` con sesión el pie **no contiene el email** del usuario; sin sesión no hay `nav.app-nav` ni enlaces autenticados. Grafo de imports revisado: no alcanza `src/db/` ni `next-auth`. | ✅ |
| CA-11 | `src/app/app-footer.tsx`; `src/lib/legal/content.ts` (`MARCA`) | `tests/e2e/pie-legal.spec.ts` › *CA-11: de quién es esto* (6 rutas + «también con sesión iniciada») | «Stockeiro, un proyecto de tremen.dev» con exactamente **un** `a[href="https://tremen.dev"]` en las 6 rutas públicas y con sesión. **Funcionalmente correcto; ver CA-17.** | ✅ |
| CA-12 | `src/app/layout.tsx` (`next/font/google`); `design/tremen-ds/colors_and_type.css` (fuera el `@import` remoto); `src/app/globals.css` (tokens reapuntados) | `tests/e2e/legal.spec.ts` › *CA-12: ni un recurso de terceros* (4 rutas, interceptando `page.on('request')`) + `tests/legal-sin-terceros.test.ts` (3) | Intercepción **mía** de `page.on("request")` en 8 rutas públicas + 4 autenticadas + `/reset-password/<token>`: **cero** peticiones fuera del origen. Las `.woff2` salen de `/_next/static/media/…`; `document.fonts` confirma que Geist y Geist Mono cargan de verdad (no es una pila de reserva). | ✅ |
| CA-13 | `src/proxy.ts` (la ruta pública sale antes de instanciar Auth.js); `src/lib/legal/content.ts` (`COOKIES_Y_ANALITICA`); `src/app/legal/privacidad/page.tsx` | `tests/e2e/legal.spec.ts` › *CA-13* (recorrer `/legal` no deja NINGUNA cookie; en `/login` solo las de Auth.js) | Contextos vírgenes por separado: recorrer las 4 de `/legal` deja **0 cookies** y **ninguna cabecera `Set-Cookie`** (comprobado también con `fetch` crudo); `/login` a pelo deja **0 cookies**. Registro, login, `forgot-password` → correo → `reset-password` → entrar con la nueva: **todo verde de punta a punta** tras el cambio de `src/proxy.ts`. | ✅ |
| CA-14 | `src/lib/legal/content.ts` (módulo puro: 0 imports); las 4 páginas; `src/app/layout.tsx`; `src/app/app-footer.tsx` | `tests/legal-import-graph.test.ts` (21 casos: 6 entradas × existe / prefijos prohibidos / clientes de BD, + recorrido no vacío + pureza del módulo) | **Verificado con la base parada de verdad**: `pg_ctl stop -m fast` (puerto 54329 en `ECONNREFUSED` comprobado) y las 4 páginas siguen respondiendo **200** con su contenido real («Alberto Fojo Eiras» en el HTML). El build las emite como estáticas (`○` en la tabla de rutas). | ✅ |
| CA-15 | `src/app/app-footer.tsx` montado en el layout raíz → alcanza al grupo `(auth)` | `tests/e2e/pie-legal.spec.ts` › *CA-15: se llega desde donde hace falta llegar* (3) | Desde `/login` y `/register`, sin teclear nada, pinchado el enlace del pie y alcanzada `/legal/privacidad`; aviso legal y términos también enlazados. | ✅ |
| CA-16 | `src/lib/legal/content.ts` (`DERECHOS`); `src/app/legal/privacidad/page.tsx` (`data-testid="derechos"`) | `tests/e2e/legal.spec.ts` › *CA-16* (2: enunciado + ruta + residual F-ADR-022-1; y «esta spec NO crea el enlace a /cuenta») | El apartado enuncia la supresión, nombra `/cuenta` y recoge el residual de F-ADR-022-1. **Salvedad**: `/cuenta` **no existe todavía** (la entrega SPEC-036), así que hoy la página afirma al lector algo que no puede hacer. Es la frontera que la spec declara, pero **bloquea publicar en solitario** (F-SPEC-035-7). | ⚠️ |
| CA-17 | **Ronda 2**: `src/app/globals.css` — `.app-footer` declara `flex-direction: row` (deja de heredar el `column` del sistema de diseño) y `.app-footer-descargo` cambia `flex: 1 1 320px` por `flex: 1 1 auto` + `min-width: min(320px, 100%)` | **`tests/e2e/pie-responsive.spec.ts`** (5 casos, /legal y /login × 390·640·700·760·1280 px): *su caja no se dispara al estrechar la ventana*, *el descargo no reserva alto que su texto no ocupa* (medido con `Range.getClientRects()`) y *el pie fija su eje y no lo hereda*. Suite completa: `npm test` **900/900** (64 ficheros) · `npm run test:e2e` **102/102** · `typecheck` · `lint` · `build` · `db:scan` — incl. `tests/guard.test.ts` (CA-15 de SPEC-023) con la lista ampliada. *(El 878 que ponía aquí en la ronda 1 estaba mal contado: eran 879, como midió el verificador.)* | La suite sigue verde (**879/879** vitest, **95/95** playwright, typecheck, lint, db:scan, build). **Pero degrada lo entregado en móvil**: por debajo de ~720 px el sistema de diseño aplica `footer { flex-direction: column }` (`design/tremen-ds/responsive.css` §footer) y el `flex: 1 1 320px` de `.app-footer-descargo` pasa a ser **320 px de ALTO**, dejando ~280 px de hueco muerto en el pie de **todas** las páginas —públicas y autenticadas—. Medido a 700/640/390 px; en escritorio (≥760 px) es correcto. Ver captura `regresion-pie-movil-700px.png`. | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**RED — 2026-08-19 (sdd-verificador).** 15/17 CA cerrados, 1 con salvedad (CA-16) y
**1 incumplido (CA-17)**.

El contenido legal es lo mejor de esta entrega y lo he verificado a mano, no por test:
los datos del titular son reales y completos, la lista de datos **coincide columna a
columna** con `src/db/schema.ts`, los cinco terceros coinciden con el código y el runbook,
y **no hay ni una afirmación de derechos sobre las cotizaciones** —lo he barrido con mi
propia lista de 20 patrones, más amplia que la del implementador—. Los seis gates pasan.
Las páginas responden **con Postgres parado de verdad** y **no piden nada a ningún
tercero**, ni ellas ni el resto de la app.

**Lo que devuelve la spec es una regresión visual, no de contenido.** El pie nuevo se monta
en el layout raíz, así que aparece en **todas** las páginas; por debajo de ~720 px de ancho
el sistema de diseño le aplica `footer { flex-direction: column }` y el `flex: 1 1 320px`
del párrafo del descargo deja de ser un ancho y pasa a ser **320 px de alto**. Resultado:
~280 px de hueco muerto en el pie de cada pantalla en móvil y tablet, en la release que
bloquea publicar y que se va a enseñar a desconocidos. El ledger afirmaba que el pie
quedaba bien (F-SPEC-035-10) «por razonamiento, no con una captura»: la captura lo
desmiente. Es un arreglo de una línea de CSS.

**Findings — ver «Findings del verificador» abajo.**

## Findings del verificador (RED)

- **V-1 (BLOQUEANTE, CA-17). El pie rompe el aspecto de toda la app por debajo de ~720 px.**
  - **Reproducir**: `npm run build` + `node tests/e2e/server.mjs`; abrir cualquier página
    (`/legal`, `/login`, `/dashboard`…) con el viewport a 700, 640 o 390 px.
  - **Medido**: `footer.app-footer` mide **452 px** de alto en vez de ~138; dentro,
    `.app-footer-descargo` mide **320 px** con dos líneas de texto. A 760 px y más, correcto
    (`footerH=138`, `descargoH=39`).
  - **Causa exacta**: `design/tremen-ds/responsive.css` §footer aplica
    `footer { flex-direction: column; align-items: flex-start; }` en su breakpoint. Como
    `.app-footer` (`src/app/globals.css`) no fija `flex-direction`, hereda `column`, y ahí
    `flex: 1 1 320px` del `.app-footer-descargo` se interpreta sobre el **eje vertical**:
    `flex-basis` pasa a ser altura.
  - **Qué hacer**: en `.app-footer` (`src/app/globals.css`) fijar explícitamente el eje
    —`flex-direction: row`— y/o cambiar `.app-footer-descargo` a `flex: 1 1 320px` solo
    cuando la dirección sea `row` (p. ej. `min-width: 320px` + `flex: 1 1 auto`). Comprobar
    a 390, 640, 700, 760 y 1280 px.
  - **Evidencia**: `_qa/SPEC-035/regresion-pie-movil-700px.png` y
    `_qa/SPEC-035/movil-login-con-pie.png`.

- **V-2 (no bloqueante, informativo, CA-16 ⚠️).** `/legal/privacidad` dice hoy «Puedes
  borrar tu cuenta y todos tus datos desde la propia app, en la pantalla de cuenta
  (/cuenta). Es inmediato». **`/cuenta` no existe.** CA-16 pide exactamente eso y la
  frontera con SPEC-036 está declarada, así que no es un defecto de implementación — pero
  es una afirmación **falsa mientras 036 no entre**. Confirmado: **035 y 036 salen juntas**
  (F-SPEC-035-7), o hay que reescribir `DERECHOS` en `src/lib/legal/content.ts`.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-035/. Informe HTML opcional: _qa/SPEC-035/informe.html -->

| CA | Captura | Qué demuestra |
|---|---|---|
| CA-1 | `_qa/SPEC-035/ca1-legal-indice.png` | El índice legal servido a un navegador sin cookies. |
| CA-3, CA-4 | `_qa/SPEC-035/ca3-ca4-aviso-legal.png` | Titular, domicilio, contacto y dominio reales; `tremen.dev` solo como marca. |
| CA-5, CA-6 | `_qa/SPEC-035/ca5-ca6-privacidad.png` | Las siete categorías de dato y los cinco terceros. |
| CA-7, CA-8, CA-9 | `_qa/SPEC-035/ca7-ca8-ca9-terminos.png` | Descargo completo y bloque de precios, sin afirmar ningún derecho. |
| CA-9, CA-10, CA-11 | `_qa/SPEC-035/ca9-pie-autenticado-dashboard.png` | El mismo pie con sesión iniciada, sin filtrar dato de usuario. |
| CA-12 | `_qa/SPEC-035/reset-password-sin-terceros.png` | `/reset-password/<token>` sin una sola petición externa (ADR-015 pto. 9, ahora cierto). |
| CA-15 | `_qa/SPEC-035/ca15-login-con-pie.png` | Camino a lo legal desde el formulario de acceso, sin teclear nada. |
| **CA-17 (fallo)** | `_qa/SPEC-035/regresion-pie-movil-700px.png`, `_qa/SPEC-035/movil-login-con-pie.png`, `_qa/SPEC-035/movil-privacidad.png` | El hueco muerto de ~280 px en el pie por debajo de ~720 px. |

## Gates ejecutados por el verificador (2026-08-19)

| Gate | Resultado |
|---|---|
| `npm run typecheck` | ✅ exit 0, sin salida |
| `npm run lint` | ✅ exit 0 (`--max-warnings=0`), sin salida |
| `npm test` | ✅ **63 ficheros, 879/879** |
| `npm run build` | ✅ compilado; `/legal`, `/legal/aviso-legal`, `/legal/privacidad` y `/legal/terminos` como **estáticas (○)** |
| `npm run test:e2e` | ✅ **95/95** |
| `npm run db:scan` | ✅ 10 migraciones, 2 destructivas con waiver escrito |

**Comprobaciones propias fuera de la suite:** 41/42 en verde (la única «roja» era un fallo
de diseño de mi propio script, no del producto: mezclaba `/legal` con rutas protegidas, y
las cookies venían del `/login` al que redirigen). Añadidas: base de datos parada de
verdad, intercepción de red en la app entera, rutas que solo se parecen a `/legal`,
tipografía realmente cargada y los tres flujos de credenciales de punta a punta.

## Salvedades / follow-ups

### Cerrados en esta implementación

- **F-SPEC-035-1 — ✅ CERRADO (ya venía cerrado de la spec).** Titular, domicilio y
  contacto están en `src/lib/legal/content.ts` como texto real.
- **F-SPEC-035-5 (domicilio particular) — ✅ CERRADO el 2026-08-19.** El humano
  **confirmó explícitamente** publicar el domicilio particular *Estrada de Viveiro 62,
  15337 Porto do Barqueiro, Mañón, A Coruña*. Era el único cabo que quedaba abierto:
  se había aportado tras la advertencia, pero sin un "publícalo" expreso. Ya lo hay,
  así que el dato entra en `/legal/aviso-legal` sin salvedad. Si algún día prefiere un
  apartado de correos o un coworking, el cambio es editar `TITULAR.domicilio`: ningún
  CA se mueve.
- **F-SPEC-035-6 (buzón `hola@tremen.dev`) — ✅ CERRADO el 2026-08-19.** El humano
  **creó el buzón** ese día. El aviso legal ya no apunta a una dirección muerta y CE-5
  tiene canal para ejercer derechos. De rebote queda resuelto también **F-SPEC-039-6**,
  que usa la misma dirección como canal de feedback (CE-8) — anotado aquí como
  referencia; cerrarlo en su ledger es de SPEC-039, no de esta spec.

### Ronda 2 — lo cerrado contra el RED del 2026-08-19

- **V-1 (CA-17, bloqueante) — ✅ CERRADO.** El pie ya no rompe el móvil.
  - **La causa, confirmada:** `.app-footer` no declaraba `flex-direction`, así que por
    debajo de 720 px heredaba el `footer { flex-direction: column }` que
    `design/tremen-ds/responsive.css` §footer aplica al **selector de elemento**. Las
    demás declaraciones de ese bloque (padding, gap, align-items) las ganaba
    `.app-footer` por especificidad; el eje se colaba porque nadie competía por él. Y en
    un contenedor en columna, `flex-basis` actúa sobre el eje vertical: los 320 px del
    descargo pasaban a ser **alto**.
  - **El arreglo, en `src/app/globals.css`:** `.app-footer` declara `flex-direction: row`
    —el apilado en pantalla estrecha lo hace `flex-wrap`, que es quien debe hacerlo—, y
    `.app-footer-descargo` cambia `flex: 1 1 320px` por `flex: 1 1 auto` +
    `min-width: min(320px, 100%)`. Lo segundo es lo que impide que vuelva: dicho como
    **ancho mínimo**, esos 320 px no pueden reinterpretarse como una altura. El `min()`
    evita desbordar por debajo de 320 px de ventana.
  - **Medido después, en `/legal`, `/login` y `/dashboard`:**

    | ancho | `flex-direction` | `footerH` | `descargoH` | texto real | scroll horizontal |
    |---|---|---|---|---|---|
    | 390 | `row` | **171** | **39** | 37 | no |
    | 640 | `row` | **171** | **39** | 37 | no |
    | 700 | `row` | **171** | **39** | 37 | no |
    | 760 | `row` | **171** | **39** | 37 | no |
    | 1280 | `row` | **138** | **39** | 37 | no |

    Antes: `footerH=452`, `descargoH=320`. Los 171 px de móvil frente a los 138 de
    escritorio son la fila de enlaces legales bajando a su propia línea — eso es el
    apilado que se quiere, no hueco muerto. Captura:
    `_qa/SPEC-035/pie-movil-390px-arreglado.png` (las del verificador se conservan
    intactas).
  - **Cómo queda blindado — `tests/e2e/pie-responsive.spec.ts`, 5 casos.** El verificador
    señaló, con razón, que el defecto llegó hasta él con 879 tests en verde porque
    **todos preguntaban por el contenido del pie y ninguno por su forma**, y que la ronda
    1 dio el móvil por bueno «por razonamiento… no con una captura». Este mide píxeles, y
    a propósito **no** compara imágenes —una prueba de captura se rompe cuando cambia una
    fuente o un color, que no es lo que hay que proteger—. Fija dos invariantes de caja y
    una causa:
    1. el pie no crece más de **2,2×** respecto a su alto de escritorio;
    2. la caja del descargo no excede lo que ocupa **su propio texto**, medido con
       `Range.getClientRects()` sobre el contenido del párrafo. Este es el que ata el
       defecto por la causa y no por el síntoma: da igual que mañana el descargo tenga
       tres líneas o que cambie el `padding`; si `flex-basis` vuelve a ser altura, el
       hueco reaparece y se pone rojo;
    3. `.app-footer` declara su eje (`flex-direction === 'row'`), para que el mensaje de
       fallo apunte al sitio en vez de dejar buscando a quien lo lea.
  - **RED reproducido antes de tocar nada** (TDD, commit `829f523`): las mismas cifras que
    midió el verificador — `flex-direction=column altoPie=452 altoDescargo=320
    altoTexto=37` a 390/640/700 px, en `/legal` y en `/login`.

- **Caducidad de los enlaces de recuperación — ✅ CORREGIDA.** La privacidad decía
  «caducan solos y a las pocas horas ya no sirven». **La ventana real son 30 minutos**:
  `RESET_TOKEN_TTL_MINUTES = 30` en `src/lib/auth/reset-tokens.ts`, que es donde ADR-015
  pto. 4 se materializa y de donde salen tanto `resetTokenExpiry()` como el texto del
  correo («El enlace caduca en 30 minutos y solo sirve una vez») y el acuse de SPEC-023.
  No era falso —a las pocas horas, en efecto, ya no sirve— pero describía una ventana
  **seis veces mayor** que la real, y en un texto legal decir de más sobre la propia
  exposición juega en contra de quien lo firma. El párrafo se muda a `CONSERVACION` en
  `src/lib/legal/content.ts` para poder compararlo sin renderizar; el número **se copia**
  (el módulo es puro por CA-14 y no puede importar la constante) y
  `tests/legal-textos-veraces.test.ts` comprueba que la copia sigue coincidiendo — mismo
  patrón que CA-5 con el esquema: si mañana cambia el TTL, ese test se pone rojo y dice
  qué frase hay que tocar.

- **La única promesa del texto — ✅ FUERA.** Los términos decían: «Si el servicio se fuera
  a interrumpir de forma definitiva, se avisaría por correo con antelación suficiente para
  que puedas quedarte con lo tuyo». Era el **único punto de las cuatro páginas donde se
  prometía algo en vez de describirlo**; no lo pedía ningún CA; contradecía al párrafo de
  al lado («no hay compromiso de servicio, ni horario de atención, ni plazo de
  respuesta»); y comprometía al titular a una obligación que nadie decidió asumir y que
  además es la más difícil de cumplir justo cuando tocaría —si el servicio se cae del
  todo, no queda quien mande el correo—. Sustituido por descripción sin compromiso, en
  `DISPONIBILIDAD`: «Tampoco hay compromiso de permanencia: el servicio puede dejar de
  prestarse, y no hay plazo comprometido para anunciarlo». `AFIRMACIONES_PROHIBIDAS`
  incorpora esa familia —`con antelación`, `aviso previo`, `se avisaría`— por la misma
  razón por la que ya prohibía `garant`: allí se prometía exactitud, aquí permanencia.
  **No** prohíbe «se avisa» a secas: los cambios de los términos sí se comunican cuando
  ocurren, y eso es descripción de lo que se hace, no promesa de lo que se hará.

- **Recuento de tests del ledger — ✅ CUADRADO.** La ronda 1 escribió `878/878`; eran
  **879**, como midió el verificador. Corregido en la matriz, aquí y en el handoff. Hoy
  son **900** vitest (64 ficheros) y **102** Playwright.

### Siguen abiertos

- **F-SPEC-035-2 (residual asumido de R-1).** Sin cambios. Que las páginas no afirmen
  derechos que no se tienen **no crea** los derechos que faltan: publicar precios del
  free tier de Marketstack en abierto sigue siendo el riesgo que el gate asumió. Esta
  spec lo hace visible y honesto; lo resuelve **F-EPIC-004-1**.
- **F-SPEC-035-3 (mantenimiento).** Vivo y funcionando: `tests/legal-datos-y-esquema.test.ts`
  se pondrá rojo el día que alguien añada una tabla con `userId`. El mensaje de fallo
  dice explícitamente qué hacer (describir el dato en `src/lib/legal/content.ts`) y qué
  **no** hacer (relajar la comprobación).
- **F-SPEC-035-4 (futuro).** Sigue sin haber versionado ni fecha de última actualización
  de los textos legales. `/legal/terminos` dice ahora, por escrito, que esta es la
  primera versión y que no hay historial anterior — con lo que la ausencia queda al
  menos declarada. Cuando cambien, hará falta.

### Nuevos, abiertos en esta implementación

- **F-SPEC-035-7 (frontera con SPEC-036, BLOQUEA PUBLICAR).** `/legal/privacidad`
  nombra la ruta `/cuenta` como el sitio donde se borra la cuenta, tal y como exige
  **CA-16**. Esa pantalla **todavía no existe**: la entrega SPEC-036. Mientras no entre,
  la página enuncia un derecho cuya vía no está construida. No es un defecto de esta
  spec (CA-16 pide justo eso, y hay un test que impide crear aquí el **enlace** para no
  dejar un enlace roto), pero **036 y 035 tienen que publicarse juntas**. Si se decidiera
  publicar sin supresión, hay que reescribir `DERECHOS` en
  `src/lib/legal/content.ts` — y CE-5 se queda sin cumplir.
- **F-SPEC-035-8 (hallazgo de as-built, CORREGIDO aquí, con residual documental).**
  El sistema de diseño cargaba Geist con `@import url('https://fonts.googleapis.com/…')`
  en `design/tremen-ds/colors_and_type.css`. Consecuencia: **todas** las páginas de
  Stockeiro pedían un recurso a un tercero — no solo las de `/legal` (CA-12), también
  `/reset-password`, sobre la que **ADR-015 pto. 9** afirma por escrito *"esta página no
  carga recursos de terceros, así que la política no cuesta nada"*, y la misma frase se
  repite en el comentario de `next.config.mjs`. **Era falso desde que se escribió.**
  Arreglado: las familias las resuelve `next/font/google` en tiempo de build y se sirven
  desde `/_next/static`, sin dependencias nuevas en `package.json`. Ahora esas dos
  afirmaciones son ciertas. **Residual:** ni el ADR ni el runbook mencionan el episodio,
  y no me corresponde editarlos. Merece una nota en ADR-015 —o un ADR de "sin recursos
  de terceros" que generalice la disciplina a toda la app— que decida el arquitecto.
- **F-SPEC-035-9 (cambio de comportamiento del middleware, verificado).** Para que
  **CA-13** fuera verdad y no una excepción, `src/proxy.ts` resuelve ahora las rutas
  públicas **antes** de instanciar Auth.js. Antes, `auth()` envolvía cualquier ruta del
  matcher y estampaba `authjs.csrf-token` y `authjs.callback-url` incluso en páginas sin
  formulario ni sesión: leer el aviso legal dejaba dos cookies. Efecto colateral a vigilar:
  `/login`, `/register`, `/forgot-password` y `/reset-password` **ya no reciben esas
  cookies desde el middleware**. Se ha comprobado que no importa —`signIn` corre en una
  server action de Node— y toda la e2e de auth y de recuperación sigue verde (95/95),
  pero queda escrito por si algún flujo futuro de Auth.js las diera por puestas.
- **F-SPEC-035-11 (ronda 2, ABIERTO — para el arquitecto).** El proyecto sigue **sin
  disciplina general de regresión visual**: `tests/e2e/pie-responsive.spec.ts` mide la
  geometría **del pie** y nada más, porque es lo que esta spec entregó. La causa de V-1 no
  es exclusiva del pie: `design/tremen-ds/` estiliza por **selector de elemento**
  (`footer`, `nav`, `h1`…) y su `responsive.css` cambia ejes y direcciones por debajo de
  720 px, así que cualquier componente de `src/app/` que use uno de esos elementos y no
  declare sus propias propiedades de flex hereda las del sistema **sin que ningún test lo
  vea**. Merece decidirse arriba: o una convención escrita («todo componente propio
  declara su eje»), o un puñado de comprobaciones de caja en las pantallas principales. No
  lo resuelvo por mi cuenta: es política de proyecto, no un CA de esta spec.
- **F-SPEC-035-10 (deuda visual mínima, ACTUALIZADO en ronda 2).** Lo que se advertía aquí
  —«no hay test de regresión visual… esto se ha comprobado por razonamiento y con la e2e
  funcional, no con una captura»— es exactamente por donde entró V-1. El pie ya no depende
  del razonamiento: se mide. Y `.auth-wrap` queda cubierto de rebote, porque
  `pie-responsive.spec.ts` mide también en `/login`, que es una página de auth. La
  redacción original de la ronda 1 se conserva debajo, sin tocar.
- **F-SPEC-035-10 (redacción original).** `.auth-wrap` tenía `min-height: 100vh`, lo que
  con el pie en el layout raíz lo empujaba fuera de pantalla en todas las páginas de auth.
  Ahora es `flex: 1 1 auto` dentro de un `.frame` en columna. Los formularios siguen
  centrados y el pie queda abajo, pero **no hay test de regresión visual** en el proyecto:
  esto se ha comprobado por razonamiento y con la e2e funcional, no con una captura.

### Re-encuadre de guardia (declarado por el aviso 4 del encargo)

- **`tests/legal-rutas-publicas.test.ts` › «el matcher del proxy no cambia».** En su
  primera versión el test afirmaba `expect(proxy).not.toContain('legal')` sobre el
  **fichero entero**. Se rompió en cuanto `src/proxy.ts` ganó los comentarios que
  explican por qué `/legal` se decide en el guard y no en el matcher — es decir, se
  rompió porque el fichero mejoró.
  - **Qué vigilaba antes:** que la cadena `legal` no apareciera en `src/proxy.ts`.
  - **Qué vigila ahora:** que **dentro del literal del `matcher`** no aparezca ninguna
    ruta de producto (`legal`, `login`, `register`, `forgot-password`, `reset-password`),
    más la comprobación literal de que el matcher sigue siendo exactamente el de siempre.
  - **Por qué es la misma propiedad, y no menos:** lo que CA-2 protege es que la
    excepción a RN-03 viva en `PUBLIC_PREFIXES` y **no** en el matcher; que el fichero
    mencione `/legal` en un comentario es justamente lo que se quiere que siga escrito
    ahí. La versión nueva cubre además las cuatro rutas públicas anteriores, que la
    versión vieja no miraba.

### Fuera de mi alcance, visto de paso

- **SPEC-038 y SPEC-039** heredan `src/app/app-footer.tsx`. Está preparado para crecer
  (tres bloques independientes, sin sesión y sin BD) y **no** lleva ni versión ni enlace
  de feedback: no son de esta spec. Aviso para quien las implemente: la e2e de CA-9/CA-10
  exige **exactamente un** `a[href="/legal/terminos"]` en el pie; añadir enlaces nuevos
  no lo rompe, duplicar ese sí.
- **`package.json` y `next.config.mjs` no se han tocado** (el semver es de SPEC-038). El
  arreglo de tipografías no necesitó ninguna dependencia nueva.
- **`docs/despliegue.md` §0** describe bien los cinco proveedores; la lista de `ENCARGADOS`
  sale de ahí y de los ADR, y coincide.

## Cómo retomar (handoff)

**Estado: ronda 2 completa. V-1 (el bloqueante del RED) cerrado con test de geometría,
más las tres correcciones de texto del encargo. Spec de vuelta en `en-revision`.**

- **Rama:** `ft/SPEC-035-paginas-legales-titular-y-descargo`, salida de `origin/main`
  limpio (SPEC-034 ya mergeada). Sin push.
- **Commits:** 5 de la ronda 1 y 4 de la ronda 2, todos con `Refs: SPEC-035`.
  1. `/legal` es pública por diseño, declarada en el único sitio que decide.
  2. La lista de datos guardados sale del esquema, no de la memoria.
  3. Páginas legales públicas, pie compartido y tipografía sin terceros.
  4. Titular, Marca, Descargo y Fuente de precios entran al glosario.
  5. El ledger (este fichero).
  6. *(ronda 2)* RED de V-1: el pie mide 452 px de alto por debajo de 720 px.
  7. *(ronda 2)* El pie declara su eje y deja de romper el móvil de toda la app.
  8. *(ronda 2)* La caducidad real son 30 minutos, y fuera la única promesa del texto.
  9. *(ronda 2)* El ledger.
- **Verde comprobado (ronda 2, la suite entera):** `npm run typecheck` ✓ · `npm run lint`
  (`--max-warnings=0`) ✓ · `npm test` **900/900** en 64 ficheros ✓ · `npm run build` ✓ ·
  `npm run test:e2e` **102/102** ✓ · `npm run db:scan` ✓ (10 migraciones, 2 destructivas
  con waiver escrito). El e2e exige `npm run build` previo. Aviso práctico: la suite e2e
  **reescribe los PNG de `_qa/` de otras specs**; se restauraron con
  `git checkout -- _qa/` antes de commitear, y lo único que entra de `_qa/` en la ronda 2
  es la captura nueva `_qa/SPEC-035/pie-movil-390px-arreglado.png`.
- **Ficheros nuevos:** `src/lib/legal/content.ts`, `src/app/app-footer.tsx`, las cuatro
  `src/app/legal/**/page.tsx`, `tests/legal-afirmaciones-prohibidas.ts`,
  `tests/legal-rutas-publicas.test.ts`, `tests/legal-datos-y-esquema.test.ts`,
  `tests/legal-import-graph.test.ts`, `tests/legal-sin-terceros.test.ts`,
  `tests/e2e/legal.spec.ts`, `tests/e2e/pie-legal.spec.ts`; **ronda 2**:
  `tests/e2e/pie-responsive.spec.ts`, `tests/legal-textos-veraces.test.ts`.
- **Ficheros tocados:** `src/lib/auth/guard.ts`, `src/proxy.ts`, `src/app/layout.tsx`,
  `src/app/globals.css`, `design/tremen-ds/colors_and_type.css`,
  `docs/fundacion/dominio.md`; **ronda 2**: `src/app/globals.css` (el pie),
  `src/lib/legal/content.ts` (`CONSERVACION`, `DISPONIBILIDAD`),
  `src/app/legal/privacidad/page.tsx`, `src/app/legal/terminos/page.tsx`,
  `tests/legal-afirmaciones-prohibidas.ts`, `tests/e2e/legal.spec.ts`.
- **Lo que la ronda 2 NO tocó, a propósito:** los 15 CA que el verificador dejó verdes;
  `src/proxy.ts` (matcher idéntico a `origin/main`, verificado); la tipografía y
  `next/font` de CA-12; `package.json` y `next.config.mjs` (el semver es de SPEC-038);
  `design/tremen-ds/responsive.css` (es el sistema de diseño, y su regla es legítima para
  el `footer` de la web de marca: el que tenía que declarar su eje era el pie de la app);
  y `docs/adr/ADR-015-*.md`, que es documento de verdad y le toca al arquitecto
  (F-SPEC-035-8).
- **Dónde mirar primero si algo falla:** los tres puntos donde la implementación tuvo que
  corregir el as-built son `src/proxy.ts` (F-SPEC-035-9), `src/app/layout.tsx` +
  `design/tremen-ds/colors_and_type.css` (F-SPEC-035-8) y `.auth-wrap` en
  `src/app/globals.css` (F-SPEC-035-10).
- **Lo que NO se ha hecho, a propósito:** la pantalla `/cuenta` y su enlace (SPEC-036), la
  versión visible en el pie (SPEC-038) y el enlace de feedback (SPEC-039).
- **Antes de publicar:** F-SPEC-035-7 — esta spec y SPEC-036 salen juntas, o la privacidad
  nombra una ruta que no existe.
