---
id: SPEC-050
tipo: spec
epica: EPIC-MEJORA
estado: en-revision
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-23, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-23, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-23, por: sdd-implementador}
---
# SPEC-050 — La primera pantalla: la marca visible, una entrada clara y la advertencia fuera del hero

## Problema

**«Hay mucha información y poca útil; me gustaría que fuese más sencilla, que estuviera
presente el logo y los botones de login o crear cuenta.»** Es literal del humano (Alberto
Fojo, 2026-08-23) sobre `/` en producción, con la app **ya publicada en un foro de bolsa** y
recibiendo tráfico real de desconocidos. Eso satisface **CE-M2** de EPIC-MEJORA —roce
observado sobre la pantalla real, no imaginado— y llega ahora por lo mismo que existe la
épica: hasta EPIC-004 el único usuario era el autor, y un autor no necesita que le presenten
su propia app.

Todo lo que sigue está verificado contra `origin/main` (`9387681`) antes de escribirlo. Las
citas de línea son de ahí.

### Los cinco roces, medidos

**1. El pie pesa demasiado para lo que la página pide.** `AppFooter`
(`src/app/app-footer.tsx:53`) se monta en el layout raíz (`src/app/layout.tsx:45`), así que la
primera pantalla hereda sus **cinco bloques**: descargo, enlaces legales, canal de feedback,
versión del despliegue y marca. La cuenta, hecha sobre el texto real:

| Bloque | Palabras | Fuente |
|---|---|---|
| `QUE_HACE` (la propuesta de valor) | **21** | `src/lib/help/content.ts:265` |
| `CADENCIA_LINEA` | **40** | `src/lib/help/content.ts:46` |
| `QUE_NO_HACE` | **23** | `src/lib/help/content.ts:270` |
| Titular + antetítulo + pie de la landing | 31 | `src/app/page.tsx:47-78` |
| **Cuerpo de la landing** | **≈ 115** | |
| Pie compartido (descargo 12 + legales 4 + feedback 15 + marca 5 + 4 campos de versión) | **≈ 40** | `src/app/app-footer.tsx` |

Y **diez enlaces** en la pantalla: cuatro del cuerpo (`/register`, `/login`, `/ayuda`,
`/legal`) y **seis del pie**. Tres de esos diez son la llamada a la acción; los otros siete
compiten con ella. Dos bloques del pie son **instrumentación para testers** y ruido para un
desconocido que todavía no tiene cuenta: la **versión del despliegue** con semver, entorno,
commit abreviado y fecha (SPEC-038 CA-1/CA-2) y el **canal de feedback** por `mailto:` con la
versión prefijada (SPEC-039 CA-12/CA-13). El descargo de no asesoramiento, los enlaces legales
y la marca **sí** valen para un desconocido, y además son obligación (SPEC-035 CA-9, CA-10,
CA-11): no se tocan.

**2. No hay logo en la primera pantalla, y la carencia es estructural.** El *wordmark* existe
y está en el código —`Stockeiro` seguido de `<span className="dot">.</span>`,
`src/app/app-nav.tsx:45-47`— pero su tipografía vive en un selector **acoplado al menú**:

```
.app-nav .brand { font: 900 20px/1 var(--font-sans); letter-spacing: -0.045em; color: var(--fg); }
.app-nav .brand .dot { color: var(--accent); }
```
`src/app/globals.css:323-329`

La landing **no monta `AppNav`** —es pública y `AppNav` pregunta quién eres para contar tus
avisos—, así que la marca no puede aparecer aunque se escriba el marcado: el CSS que la define
solo existe dentro de `.app-nav`. Lo único que hay hoy arriba es `.landing-eyebrow`
(`globals.css:1241`): mono de **11 px**, mayúsculas, `letter-spacing: .16em`, en color de
acento. Es un microcrédito tipográfico, no una marca.

**3. Tres llamadas a la acción sin jerarquía.** «Crear cuenta», «Entrar» y «Cómo funciona, con
detalle» comparten la misma rejilla (`.landing-acciones`, `grid-auto-flow: column`,
`globals.css:1286`), y la única diferencia entre las dos primeras es la clase `primary` del
sistema de diseño. Desde un foro **casi todo el tráfico es nuevo**: la primaria tiene que
dominar, «Entrar» ser inequívocamente secundaria, y un enlace a la ayuda no puede estar en la
misma fila que dos botones de cuenta.

**4. La advertencia es el bloque más ruidoso de la página.** `.landing-cadencia`
(`globals.css:1260`) lleva **borde ámbar de 3 px**, fondo elevado (`--bg-step`) y radio de
tarjeta: después del titular es lo que más grita, con **40 palabras**. Sumado a `QUE_NO_HACE`
(23), la primera pantalla dedica **63 palabras a negaciones** frente a **21 de propuesta de
valor**. El problema **no es lo que dice** —eso es innegociable, ver abajo— sino **dónde lo
dice y con cuánto peso**.

**5. «Gratis y sin publicidad» es el texto más apagado de la pantalla.** Vive dentro de
`.landing-pie` (`globals.css:1275`: `--t-body-sm` y `--fg-dim`, el color más tenue del
sistema) y en la **última línea** de la página. Para un público escéptico de foro, «gratis y
sin publicidad» es palanca de conversión de primer orden y está enterrada bajo la advertencia.

### Lo que esta spec NO negocia, y por qué

- **`CADENCIA_LINEA` se queda íntegra y en la página.** **D-2 es locked**
  (`FOUNDATION.md`) y `src/lib/help/content.ts:44` lo escribe sin ambigüedad: *«esto COMUNICA
  el diseño, no lo negocia»*. **SPEC-039 CA-3** exige que la misma constante esté en la primera
  pantalla, en `/ayuda` y en el estado vacío de `/vigiladas`, y **R-4** justifica la
  redundancia: si no se dice alto, el feedback que vuelva del foro será «no actualiza» y se
  habrá gastado la publicación. Lo que esta spec separa es **decirlo alto** de **ocupar el
  hero**: la frase completa se queda, con menos peso visual y en un sitio que no compite con la
  propuesta de valor.
- **El descargo (SPEC-035 CA-9), los enlaces legales (CA-10) y la marca `tremen.dev` (CA-11)
  siguen exactamente igual en `/`.** Los tres CA dicen literalmente *«cualquier página»* o
  *«todas las páginas»*, y los tres valen para un desconocido. Cero cambio.
- **La landing no consulta la base de datos ni carga nada de fuera** (**SPEC-039 CA-14**). Solo
  decodifica la cookie con `tieneSesion()` (`src/app/page.tsx:43`). Esa carencia es lo que la
  hace legible con el resto caído, y ninguna propuesta de aquí introduce una consulta.
- **La identidad no se inventa: se aplica.** Misma frontera que fijó SPEC-047 y que la épica
  aceptó por escrito. Esta spec **consume** `--fg`, `--accent`, `--fg-muted`, `--fg-dim`,
  `--font-sans` y el marcado del wordmark que ya está escrito; **no propone** tipografía nueva,
  ni paleta nueva, ni un dibujo nuevo. Si de aquí saliera un logotipo distinto del wordmark que
  ya existe, eso sería identidad nueva y saldría de EPIC-MEJORA.

Esta spec se somete a **CE-M1** (no cambia un dato, un cálculo ni una regla: es presentación
pura, acotado por CA-19), a **CE-M2** (los cinco roces están observados y lo no observado se
aparca en §Fuera de alcance) y a **CE-M3** (sin migración, sin proveedor, sin dependencia nueva
y **sin ADR**).

## Usuarios / roles afectados

- **El desconocido que llega del foro y no tiene cuenta.** Es el usuario de esta spec y el
  único que ve esta pantalla. Tiene que reconocer de qué producto se trata (la marca), qué hace
  (21 palabras), qué le cuesta (nada) y por dónde entra (un botón que domina), **antes** de
  llegar a lo que la app no hace.
- **El que ya tiene cuenta**: no ve nada de esto. `/` le redirige a `/dashboard`
  (`src/app/page.tsx:43`) y esta spec no toca ese comportamiento (CA-16).
- **El tester que ya está dentro**: sigue teniendo la versión copiable y el canal de feedback a
  un clic en **todas** las pantallas, incluida `/` (CA-14). Lo que cambia en `/` es el peso
  visual de esas dos filas, no su presencia.
- **Quien implemente esto**: hereda un contrato de proporciones (§Diseño) para que no improvise
  a ojo, y una frontera dura sobre tres suites ajenas que esta pantalla ya tiene medidas
  (CA-17, CA-18).

## Diseño

Cinco decisiones. Después el orden de la página.

- **D-1 — El wordmark se desacopla del menú, y sigue habiendo UNA definición.** La tipografía
  del wordmark y el color del punto pasan de `.app-nav .brand` a una regla **`.brand` de primer
  nivel**, reutilizable por cualquier superficie. El tamaño deja de estar escrito dentro de la
  declaración `font` y pasa a una propiedad personalizada (`--brand-size`, valor por defecto
  `20px`) que la superficie puede sobrescribir. `.app-nav` conserva **solo** lo que es del
  menú (que el enlace no lleve subrayado). Consecuencia buscada: la barra de navegación se
  renderiza **idéntica** (CA-3) y la landing usa la misma marca, no una copia.
- **D-2 — En la primera pantalla el wordmark NO es un enlace.** La landing *es* el destino al
  que llevaría. Un enlace a `/` desde `/` es ruido para el lector de pantalla y, además, un
  enlace de más en una pantalla cuyo problema es que tiene diez. Se pinta como texto y sustituye
  a `.landing-eyebrow`, que desaparece.
- **D-3 — La advertencia pierde el cromo de alarma, no las palabras.** `.landing-cadencia` deja
  de ser tarjeta: fuera el borde ámbar de 3 px, fuera el fondo `--bg-step`, fuera el radio.
  Queda prosa, con el color de texto secundario que ya usan `.landing-limites` y
  `.landing-pie`. **El literal no se toca**: sigue siendo `CADENCIA_LINEA` renderizada entera.
  Motivo: el ámbar es el color con el que este sistema pinta *aviso*, y aquí no hay nada que
  avisar — hay algo que explicar. La jerarquía la da el **orden**, no el ruido.
- **D-4 — El pie se subordina en la primera pantalla SIN saber que está en ella.** `AppFooter`
  no lee la sesión, no lee la ruta y no lee la base de datos: esa carencia es su propiedad
  principal (SPEC-035 CA-10, SPEC-039 CA-14) y es lo que le permite vivir en el layout raíz.
  Pasarle una `prop` de ruta se la quitaría. Se resuelve **en CSS y sin tocar el componente**:
  el pie es hermano siguiente del `<main>` de la página dentro de `.frame`
  (`src/app/layout.tsx:43-46`), así que el selector `.landing ~ .app-footer` alcanza al pie
  **solo** cuando la página es la landing. Cero JavaScript, cero `prop`, cero conocimiento de
  ruta dentro del componente.
- **D-5 — En la primera pantalla el feedback se retira y la versión se queda, subordinada.**
  Arbitrado por el humano (Alberto Fojo) el **2026-08-23**, sobre las dos lecturas literales de
  §El arbitraje de abajo. En `/`: la fila del **canal de feedback** deja de mostrarse; la de la
  **versión** sigue mostrándose y baja a `--fg-dim`. En **cualquier otra pantalla**, las dos
  siguen exactamente como están.

  **Por qué retirar el feedback de `/` no contradice el valor que el humano le da al canal**, que
  es el matiz importante y por eso se escribe aquí y no solo se obedece. Sus palabras al
  aprobarlo fueron: *«el feedback es importante para mí, ya que permite a los usuarios decirme
  qué cosas puedo mejorar»*. Y lo aprobó **sabiendo eso**, porque **no se pierde ningún camino
  real**: el canal sobrevive en **toda pantalla autenticada** —que es donde vive quien tiene algo
  que contar— y en **`/ayuda`**, que es pública y se alcanza **desde la propia landing** con el
  enlace «Cómo funciona, con detalle». Lo único que desaparece es su presencia en el sitio donde
  quien mira **todavía no tiene nada sobre lo que opinar**: un desconocido que acaba de llegar de
  un hilo no ha usado la app, así que ofrecerle «cuéntanos qué falla» es una fila y un enlace de
  diez que no le sirven para nada y le restan atención de los dos botones que sí. Que ese camino
  siga vivo **no se deja a la buena fe: lo ata CA-21**, que lo recorre entero desde `/`.

  **Por qué la versión se queda.** No por indecisión, sino porque **SPEC-038 CA-1** dice
  literalmente *«cualquier página»* y quitarla haría falso un CA ajeno aprobado **sin poner rojo
  ningún test** (§El arbitraje). Cuesta cuatro campos en la línea más tenue del pie; enmendar un
  criterio aprobado por esa ganancia no sale a cuenta, y el humano lo ratificó.

  **Cómo se retira, y por qué así.** Con `display: none` desde `.landing ~ .app-footer`, sin
  tocar `AppFooter` (D-4, CA-15). **No** con `visibility: hidden` ni `opacity: 0`: esas dos
  dejan la caja ocupando alto, que es exactamente el «hueco muerto» que
  `tests/e2e/pie-responsive.spec.ts` y `tests/e2e/ayuda-responsive.spec.ts` miden y castigan. Y
  se dice en voz alta lo que esto **no** hace: el enlace `mailto:` sigue existiendo en el HTML
  servido de `/`, oculto. Es el precio de que el pie no sepa en qué ruta está, y es el precio
  correcto — el roce que se contó era **visual**, y visualmente desaparece.

### El arbitraje que esta spec NO se concede a sí misma

El roce 1 pedía **quitar** de `/` la versión y el feedback. Se ha ido a leer los CA ajenos
literales antes de decidir, y **dicen cosas distintas**:

- **SPEC-038 CA-1** dice: *«Dado el pie compartido, cuando se renderiza **cualquier** página
  —`/login`, `/legal/terminos`, `/dashboard`, `/vigiladas`—, entonces la versión del despliegue
  aparece en él»*. El texto es **universal**. Que su test
  (`tests/e2e/version-en-el-pie.spec.ts:47`) solo recorra cuatro rutas y `/` no esté entre ellas
  **no relaja el CA**: relaja la prueba. Quitar la versión de `/` haría **falso un CA aprobado
  ajeno** sin ponerse rojo ningún test — que es la peor forma de romper algo.
- **SPEC-039 CA-12** dice: *«Dada cualquier pantalla **autenticada** y también `/ayuda`»*. `/`
  **no está** en ese CA. Pero su test **sí la recorre**: `tests/e2e/ayuda.spec.ts:361` itera
  `['/ayuda', '/', '/login', '/register']`. Es decir, la prueba afirma **más** que su criterio.
  Quitar el feedback de `/` no haría falso ningún CA, pero **pondría RED una aserción ajena**.

Ninguno de los dos casos lo resolvió esta spec por su cuenta, y ninguno se resuelve tocando el
fichero de otro. `FOUNDATION.md` admite **re-encuadrar** una guardia cuya propiedad sigue viva
y **borrar** la que vigilaba algo que ya no puede ser cierto; quitar `/` de esa lista **no es
ninguna de las dos**: es cambiar la promesa, y eso lo firma el humano, no el arquitecto.

**Arbitrado por el humano (Alberto Fojo) el 2026-08-23**, tras verificar él mismo los dos
literales en `origin/main`:

- **La versión se queda en `/`.** No se enmienda SPEC-038 CA-1, no se toca su test y no se hace
  falsa ninguna afirmación aprobada. Solo baja de peso visual (D-5, CA-13, CA-14).
- **El feedback se retira de `/`.** Su CA no lo pedía; lo pedía **de más** su test. Eso obliga a
  **estrechar una aserción ajena** —`tests/e2e/ayuda.spec.ts:361`, que itera
  `['/ayuda', '/', '/login', '/register']`— y esa autorización queda escrita como **CA-22**,
  nominal y con las mismas cuatro condiciones que **SPEC-047 CA-19** impuso a las suyas: nombrada
  una a una, con su porqué al lado de la aserción, ampliación-o-estrechamiento **declarado** y no
  aflojada, y ninguna propiedad protegida debilitada. **Un segundo fichero ajeno modificado sigue
  siendo RED** (CA-18).

Y como el motivo del humano para valorar el canal es explícito —*«permite a los usuarios decirme
qué cosas puedo mejorar»*—, la retirada **viene con su contrapartida atada**: **CA-21** exige que
el camino anónimo al canal siga existiendo y se recorra en dos clics desde la primera pantalla.
Sin ese CA, «quitarlo de `/`» podría degenerar en «el visitante pierde el camino» sin que ningún
test lo cazara — que es exactamente la clase de fallo silencioso que esta misma sección le
reprocha a SPEC-038 CA-1.

### El orden de la primera pantalla

De arriba abajo. Es el contrato de CA-5 y CA-9.

| # | Elemento | Qué es |
|---|---|---|
| 1 | **Wordmark** `Stockeiro.` | La marca, tamaño real, punto en `--accent` (D-1, D-2) |
| 2 | Titular (`.landing-title`) | Sin cambios |
| 3 | `QUE_HACE` (`.landing-lede`) | Sin cambios de texto: **21 palabras de propuesta de valor** |
| 4 | **Acciones**: «Crear cuenta» primaria · «Entrar» secundaria | La entrada, dominando (D del roce 3) |
| 5 | **«gratis y sin publicidad»** | Sale del pie de la landing y sube junto a las acciones (roce 5) |
| 6 | `CADENCIA_LINEA` | Íntegra, como prosa, sin cromo de alarma (D-3) |
| 7 | `QUE_NO_HACE` | Sin cambios |
| 8 | «Cómo funciona, con detalle» + la línea legal de la landing | Fuera de la fila de botones |

Con este orden, las **21 palabras de valor y la entrada** van por delante de las **63 de
negaciones**, sin que se pierda ni una palabra de las 63.

## Criterios de aceptación

Cada CA es verificable con un test: la estructura y el orden del DOM y los estilos calculados
con **Playwright** contra `next start` (que es como corre el e2e de este proyecto); los textos y
el grafo de imports con **Vitest**, sin base de datos.

**Ningún CA de esta spec alimenta una aserción con `origin/main`, `main` ni `HEAD`.** Es
**ADR-031 pto. 2.1**, y se dice aquí porque el borrador de esta spec sí lo hacía: media docena de
CA estaban escritos como *«el diff contra `origin/main`»*, que es exactamente el molde que
SPEC-048 tuvo que desmontar en `tests/icono-frontera.test.ts`. Reencuadrados según el orden de
preferencia de **ADR-031 pto. 1**:

- Lo que **puede** decirse como propiedad del árbol, se dice así (CA-3, CA-7, CA-10, CA-11,
  CA-13, CA-15, CA-20): el test lee el fichero, o los estilos calculados, o el HTML servido, y
  compara contra un valor **derivado de la fuente** o declarado literalmente. No necesita git y
  funciona en cualquier clon.
- Lo que **no** puede —«este cambio está bien acotado», que es criterio de gate y no test
  permanente (**ADR-031 pto. 1.2**)— **sale de la suite** y se verifica en el gate, con la
  evidencia en el ledger (CA-19).

### La marca está, y es la que ya existe

- **CA-1 (La primera pantalla enseña el wordmark, con su punto de acento).**
  Dada `/` servida a un visitante **sin sesión**,
  cuando se inspecciona el primer elemento de `main.landing`,
  entonces es el wordmark: el texto **`Stockeiro`** seguido de un elemento con clase `dot` cuyo
  contenido es **`.`**; el color calculado del punto es exactamente el valor de `--accent` del
  bloque `.v-tremendo`, y el de la palabra el de `--fg`; y **no existe** ningún elemento con
  clase `landing-eyebrow` en la página.

- **CA-2 (Es una marca, no un microcrédito, y no compite con el titular).**
  Dada `/` a los ocho anchos del proyecto (`tests/e2e/geometria.ts`),
  cuando se miden los estilos calculados del wordmark,
  entonces su `font-family` es la de `--font-sans` (**no** la mono), su `font-weight` es
  **900**, su `text-transform` es **`none`** y su `font-size` está entre **24 px y 32 px** —por
  encima del texto corrido y **nunca por encima** del `font-size` calculado de
  `.landing-title` al mismo ancho, que es quien manda en la jerarquía.

- **CA-3 (La barra de navegación no se entera: la marca del menú se pinta igual que antes).**
  Dado `/dashboard` con sesión,
  cuando se leen los estilos calculados de `.app-nav .brand` y de su `.dot` **antes y después**
  del cambio —el test compara contra los valores que **deriva del propio CSS**, no contra
  literales tecleados—,
  entonces `font-family`, `font-weight`, `font-size` (**20 px**), `letter-spacing`
  (**-0.045em**), `color` del wordmark, `color` del punto y `text-decoration` son **idénticos**.
  Es el CA de no regresión de D-1: desacoplar no puede ser reestilar.

- **CA-4 (Una sola definición de la marca, y el marcado es el mismo).**
  Dado `src/app/globals.css`,
  cuando se buscan las declaraciones tipográficas del wordmark,
  entonces existen en **una sola regla** (`.brand` y su `.dot`), y `.app-nav` **no** vuelve a
  declarar `font`, `font-size`, `font-weight`, `letter-spacing` ni el color del punto. Y el
  marcado que pinta la landing es el mismo par de nodos que `src/app/app-nav.tsx:46`
  (`Stockeiro` + `<span class="dot">.</span>`), no una variante.

### La entrada domina, y se entiende lo que cuesta

- **CA-5 (El orden de la pantalla es el pactado).**
  Dada `/` sin sesión,
  cuando se recorre `main.landing` en orden de documento,
  entonces los elementos aparecen en el orden de la tabla de §El orden de la primera pantalla:
  wordmark → titular → `QUE_HACE` → acciones → la línea de «gratis y sin publicidad» →
  `CADENCIA_LINEA` → `QUE_NO_HACE` → el enlace a `/ayuda` y la línea legal. En particular,
  **`QUE_HACE` y el botón primario preceden a `CADENCIA_LINEA` y a `QUE_NO_HACE`**.

- **CA-6 («Crear cuenta» domina; «Entrar» es secundaria; la ayuda no está en esa fila).**
  Dada `/` sin sesión,
  cuando se miden los dos controles de cuenta,
  entonces el enlace a `/register` es el **único** de la fila con la clase primaria del sistema
  de diseño; su área renderizada (ancho × alto) es **≥ 1,3 ×** la del enlace a `/login` a los
  ocho anchos; el contraste de su texto contra su fondo es **≥ 4,5:1**; y el enlace a `/ayuda`
  **no** es descendiente de `.landing-acciones`.

- **CA-7 («Gratis y sin publicidad» sube, con las MISMAS palabras).**
  Dada `/` sin sesión,
  cuando se lee la línea que acompaña a las acciones,
  entonces contiene literalmente la secuencia **«gratis y sin publicidad»** que hoy vive en
  `src/app/page.tsx:76`; su color calculado **no** es `--fg-dim` (es `--fg` o `--fg-muted`); su
  `font-size` calculado es **≥** el de la línea legal de la landing; y aparece **antes** que
  `CADENCIA_LINEA` en orden de documento. **No se inventa ninguna promesa nueva**: el test declara el
  literal esperado y falla si la línea afirma algo que ese literal no dice — nada de «ilimitado»,
  «para siempre» ni «sin coste» apareciendo por el camino.

- **CA-8 (Los cuatro caminos siguen siendo cuatro, y uno de cada).**
  Dada `/` sin sesión,
  cuando se cuentan los enlaces de la página,
  entonces hay **exactamente uno** a `/register`, **exactamente uno** a `/login` y
  **exactamente uno** a `/ayuda`, y **al menos uno** que empieza por `/legal`. Es literalmente
  lo que ya afirma **SPEC-039 CA-2** (`tests/e2e/ayuda.spec.ts:130-140`): ese test **sigue verde
  y sin tocar una sola aserción**, y este CA lo repite aquí porque un wordmark enlazado o un
  segundo botón lo romperían y hay que saberlo antes.

### La advertencia se dice entera y deja de gritar

- **CA-9 (La frase es la misma constante, entera, y sigue en la primera pantalla).**
  Dada `/` sin sesión,
  cuando se lee el texto de `main`,
  entonces contiene **`CADENCIA_LINEA` completa y literal**, importada de
  `src/lib/help/content.ts` y no copiada; y `tests/e2e/ayuda.spec.ts` (**SPEC-039 CA-3**, la
  cadencia en las tres pantallas) **sigue verde sin tocar ninguna aserción**. **D-2 intacto.**

- **CA-10 (Pierde el cromo de alarma, no el sitio).**
  Dado el bloque de la cadencia en `/`,
  cuando se leen sus estilos calculados,
  entonces **no** tiene `border-left` de 3 px en `--amber` (su `border-*-width` visible es 0),
  **no** tiene `background-color` distinto del `--bg` de la página, y **no** tiene
  `border-radius` de tarjeta; su `color` es el de texto secundario (`--fg-muted`), el mismo que
  `.landing-limites`. El test **deriva** el valor de `--amber` y de `--bg-step` del CSS de
  marca en vez de teclear hexadecimales.

- **CA-11 (Ni una palabra menos, y ni una palabra nueva sobre la cadencia).**
  Dados `src/app/page.tsx` y `src/lib/help/content.ts` **tal y como están en el árbol**,
  cuando se leen,
  entonces la página **importa** `CADENCIA_LINEA` de `@/lib/help/content` y la renderiza entera
  —no la copia—; y `src/app/page.tsx` **no contiene ninguna cadena literal** que empareje
  `/cierre|refresc|una vez al día|tiempo real|diferid/i`. Es la misma exigencia dicha como
  propiedad del árbol y no como diff, según **ADR-031 pto. 1.1**. Motivo
  escrito: la única forma de que la cadencia no se desincronice entre tres pantallas es que
  siga siendo **una constante**, y una versión corta escrita al lado es exactamente el segundo
  literal que este proyecto ya ha visto envejecer en silencio (`F-SPEC-039-3`). El chip
  compacto se evalúa y se descarta en §Fuera de alcance, con lo que lo reabriría.

### El pie se subordina sin perder ninguna de sus cinco promesas

- **CA-12 (El descargo, lo legal y la marca siguen exactamente igual en `/`).**
  Dada `/` sin sesión,
  cuando se lee el pie,
  entonces contiene el descargo de no asesoramiento con su enlace al texto completo, los tres
  enlaces legales y la línea «Stockeiro, un proyecto de tremen.dev» con `tremen.dev` enlazado; y
  sus estilos calculados (`color`, `font-size`) son **idénticos** a los de esos mismos bloques
  en `/legal/terminos`. **SPEC-035 CA-9, CA-10 y CA-11 no se tocan** y
  `tests/e2e/pie-legal.spec.ts` sigue verde sin modificar ninguna aserción.

- **CA-13 (En `/` el feedback no se muestra y la versión baja de peso; en el resto, nada cambia).**
  Dadas `/` y `/legal/terminos`, ambas sin sesión,
  cuando se leen los estilos calculados de la fila de feedback y la de versión en las dos,
  entonces en `/`: la fila de feedback tiene `display: none` —**y no** `visibility: hidden`,
  `opacity: 0` ni alto reservado, porque eso dejaría hueco muerto— y la fila de versión sigue
  mostrándose con el `color` de `--fg-dim`. Y en `/legal/terminos` **las dos están visibles**,
  con la fila de feedback en `--fg-muted` y la de versión en `--fg-dim` —los valores de hoy,
  derivados del CSS de marca por el test, no tecleados—. El cambio está acotado a la landing y
  ninguna otra pantalla lo nota (CA-18 lo confirma sobre las suites).

- **CA-14 (La versión sigue cumpliendo lo que prometió: presente, legible y copiable).**
  Dada `/` sin sesión,
  cuando se busca la versión en el pie,
  entonces **está visible**, empieza por el semver en formato `vMAJOR.MINOR.PATCH`, va **antes**
  que el commit y la fecha, y es **seleccionable y copiable** — literalmente **SPEC-038 CA-1 y
  CA-2**, cuyo test (`tests/e2e/version-en-el-pie.spec.ts`) **sigue verde y sin tocar ninguna
  aserción**. Este CA existe para que la subordinación de D-5 no se convierta en una desaparición
  por accidente: sobre la fila de la versión, `display: none`, `visibility: hidden`,
  `font-size: 0`, `user-select: none` y un contraste por debajo de **3:1** contra el fondo son
  todos **RED**. (Sobre la fila de feedback, `display: none` es justamente lo que CA-13 exige:
  son dos filas con dos destinos distintos y este CA solo habla de una.)

- **CA-15 (El pie sigue sin saber nada, y el componente no se toca).**
  Dado `src/app/app-footer.tsx` tal y como está en el árbol,
  cuando se lee,
  entonces **no contiene** `usePathname`, ni `headers`, ni `landing`, ni ninguna `prop`, ni
  ninguna condición: sigue siendo la función sin argumentos que pinta los mismos cinco bloques
  para todo el mundo. La subordinación de D-4 se logra íntegramente desde
  `src/app/globals.css`, con el pie alcanzado como hermano del `<main>` de la landing.
  Y `tests/legal-import-graph.test.ts` y `tests/ayuda-import-graph.test.ts` siguen verdes: ni
  el pie ni la landing alcanzan `src/db/` (**SPEC-035 CA-14**, **SPEC-039 CA-14**).

### Cero regresión, y las fronteras de la pantalla que ya estaban medidas

- **CA-16 (Con sesión, la raíz sigue llevando al panel).**
  Dado un usuario autenticado,
  cuando abre `/`,
  entonces acaba en `/dashboard` y **no** se renderiza `primera-pantalla`. Es
  `tests/e2e/ayuda.spec.ts:154-161`, que sigue verde sin tocarse.

- **CA-17 (La geometría de la pantalla no empeora a ningún ancho, y la guardia ajena no se
  toca).**
  Dadas `/` a los ocho anchos del proyecto,
  cuando se mide con el módulo compartido de **ADR-026** (`tests/e2e/geometria.ts`),
  entonces **ningún elemento** desborda (medida M1) y **ningún bloque reserva alto que su
  contenido no ocupe**. Y `tests/e2e/ayuda-responsive.spec.ts` **sigue verde sin modificar
  ninguna aserción**: en particular su lista `CONTENEDORES` (línea 93) sigue casando con **al
  menos dos** elementos en `/`, lo que obliga a que **la clase `.landing-acciones` siga
  existiendo con ese nombre** aunque cambie su contenido. Los bloques **nuevos** que esta spec
  introduzca se miden en un fichero de test **propio** de esta spec, no ampliando el ajeno.

- **CA-18 (Las suites enteras siguen verdes y no se toca ni una aserción ajena).**
  Dadas `npm test` y `npx playwright test` completas,
  entonces pasan. Y sobre `tests/`: la entrega **añade** ficheros y casos nuevos y **no modifica
  ninguna aserción existente**, con la **única** excepción del fichero que **CA-22** nombra
  (`tests/e2e/ayuda.spec.ts`). **Cualquier segundo** fichero de test ajeno modificado es **RED**:
  se escala al gate, no se toca. Esa segunda mitad **la comprueba el verificador en el gate y
  deja la salida en el ledger** —no vive en la suite, porque es un criterio de acotación y
  **ADR-031 pto. 1.2** dice dónde va—. Lo que sí vive en la suite es lo de arriba: las suites
  enteras en verde, con cinco citadas por su nombre porque son las que este cambio pone a prueba
  de verdad: `tests/e2e/ayuda.spec.ts` (SPEC-039 CA-2, CA-3,
  CA-12), `tests/e2e/version-en-el-pie.spec.ts` (SPEC-038 CA-1, CA-2),
  `tests/e2e/pie-legal.spec.ts` (SPEC-035 CA-9, CA-10, CA-11),
  `tests/e2e/ayuda-responsive.spec.ts` (SPEC-039 CA-17) y `tests/e2e/pie-responsive.spec.ts`
  (la proporción del pie, que D-5 mueve).

- **CA-19 (El alcance está acotado: esto es presentación pura). Criterio de GATE, no de suite.**
  **No entra en `npm test`**, y es una decisión, no un olvido: *«este cambio está bien acotado»*
  es exactamente lo que **ADR-031 pto. 1** llama criterio de gate, y escribirlo como
  `git diff … origin/main` sería reproducir el molde caduco que **SPEC-048** tuvo que desmontar
  en `tests/icono-frontera.test.ts` — una guardia que se pone verde por vacuidad al mergear.
  Se verifica así:

  Dado el diff de la rama **con el árbol limpio** —lo comiteado, no el árbol de trabajo, por el
  motivo que SPEC-047 CA-16 dejó escrito y que la **SPEC-049 de EPIC-FIX** (mergeada el
  2026-08-23) acaba de generalizar: un veredicto sobre un árbol sucio es un verde vacío—,
  cuando **sdd-verificador** lo revisa en el gate y **pega la salida en el ledger**,
  entonces los ficheros tocados están **únicamente** dentro de este conjunto:
  `src/app/page.tsx`, `src/app/globals.css`, `tests/`, `docs/`, `_qa/SPEC-050/`,
  `package.json`. En particular **no** hay ni un fichero bajo `src/db/`, ni bajo `drizzle/`, ni
  bajo `src/lib/`, ni `src/app/app-footer.tsx`, ni `src/app/app-nav.tsx`, ni `src/proxy.ts` — ni
  un dato, ni un cálculo, ni una regla de negocio (**CE-M1**). Y **ninguna otra carpeta
  `_qa/SPEC-NNN/`** aparece: la evidencia de otras specs es suya. Reparto de capturas: las de
  trabajo a `test-results/SPEC-050/` (ignorado por git); la evidencia que se commitea, a
  `_qa/SPEC-050/`.

  *Nota para quien implemente*: si el orden del DOM obliga a tocar `src/app/app-nav.tsx` para
  desacoplar el wordmark, **eso es una excepción declarada aquí**: se admite un cambio en ese
  fichero **solo** si es la clase del enlace (`className="brand"` intacta) y nada más; cualquier
  otra línea es RED.

  *Y si algún día se quiere esto en la suite por valor de auditoría*, **ADR-031 pto. 2** dice
  cómo: ventana de dos sha fijos declarados en una constante, centinela de no-vacuidad,
  `describe.skipIf` por disponibilidad. Nace anclado o no nace.

- **CA-20 (Sin dependencia nueva y sin ADR).**
  Dado `package.json` tal y como está en el árbol,
  cuando se leen sus claves,
  entonces `dependencies` y `devDependencies` tienen **exactamente** los mismos nombres que hoy
  —lista declarada en el test, sin git— y `scripts` tiene **exactamente** las mismas claves; el
  único cambio admisible es el valor de `version`, que **ADR-024** obliga a subir por tocar
  `src/` (`npm run version:check`). Y `docs/adr/` **no gana ningún fichero**: esta spec no toma
  ninguna decisión que constriña trabajo futuro (**CE-M3**).

### El camino al feedback sobrevive, y la guardia que se estrecha

- **CA-21 (Desde la primera pantalla se sigue llegando al canal de feedback, en dos clics).**
  Dado un visitante **sin sesión** que abre `/`,
  cuando pulsa el enlace «Cómo funciona, con detalle» y aterriza en `/ayuda`,
  entonces el enlace del canal de feedback **está visible** ahí y su `href` empieza por
  `mailto:`. Son **dos clics** desde la primera pantalla —el de ir a la ayuda y el del propio
  canal— y el test los recorre de verdad, navegando, no comprobando que existan por separado.
  **No duplica ningún CA ajeno: los compone.** Las dos mitades ya están garantizadas —
  **SPEC-039 CA-12** exige el canal en `/ayuda` y **SPEC-039 CA-2** (con CA-8 de esta spec)
  exige exactamente un enlace a `/ayuda` en `/`— pero **nadie ata hoy el recorrido entero**, y
  es justo el recorrido lo que D-5 pone en juego al retirar el canal de `/`. Este CA existe para
  que «quitarlo de la landing» no pueda degenerar nunca en «el visitante anónimo pierde el
  camino» sin que un test lo cace.

- **CA-22 (La única guardia ajena que se estrecha, nombrada, y sin perder fuerza).**
  Dada la **única** aserción ajena que este cambio obliga a tocar —y **solo** ésa—,
  cuando se leen `tests/e2e/ayuda.spec.ts` **tal y como queda en el árbol** (condiciones 2, 3 y
  4, que son propiedades del fichero y las comprueba un test de esta spec) y el diff de la rama
  en el gate (condición 1, que es criterio de acotación y va al ledger, **ADR-031 pto. 1.2**),
  entonces se cumplen las **cuatro** condiciones siguientes:

  1. **Está nombrada, y es exactamente ésta**: `tests/e2e/ayuda.spec.ts:361` (**SPEC-039
     CA-12**), cuyo bucle itera hoy `['/ayuda', '/', '/login', '/register']`. Se le quita **`/`**
     y nada más. Ninguna otra línea de ese fichero, y ningún otro fichero.
  2. **Lleva su porqué escrito al lado de la aserción**, en el propio fichero de test y no solo
     en el ledger: qué vigilaba antes (*el canal visible también en la landing*), qué vigila
     ahora (*el canal visible en `/ayuda` y en las públicas de cuenta*), y en virtud de qué entra
     el cambio (**SPEC-050 D-5**, con el camino atado por **CA-21**), con la fecha y el arbitraje
     del humano del **2026-08-23**. Es la condición literal que `FOUNDATION.md` exige.
  3. **No es una aflojada, y el fichero no pierde cobertura sobre `/`.** El caso retirado se
     **sustituye por su inverso**: un caso nuevo que afirma que en `/` el canal **no se muestra**,
     de modo que el comportamiento en la landing sigue **fijado por un test**, solo que al revés.
     Y en lo demás nada se relaja: el bucle conserva `/ayuda`, `/login` y `/register`, conserva
     `toBeVisible()` y conserva la comprobación de que el `href` empieza por `mailto:`; no se
     borra ningún otro caso, no se marca ninguno `.skip` y no se cambia ninguna comparación
     exacta por una laxa.
  4. **Ninguna propiedad protegida se debilita.** El criterio literal de **SPEC-039 CA-12**
     —*«cualquier pantalla autenticada y también `/ayuda`»*— queda **íntegramente** afirmado: la
     segunda mitad de ese mismo test (`'y desde cualquier pantalla autenticada'`, que recorre
     `/dashboard`, `/vigiladas`, `/avisos` y `/cuenta`) sigue **verde y sin tocar**. Lo que se
     retira de la lista es la única ruta que el CA **no** pedía.

  *Y la condición de proceso, que no es decorativa*: `FOUNDATION.md` exige que **quien toca una
  guardia no sea quien se beneficia de que pase**. Se cumple en ese orden: el arquitecto **no
  tocó nada** y lo llevó al gate; **lo decidió el humano el 2026-08-23**; y la autorización queda
  escrita **aquí, en la spec, antes de que se implemente**. Un cambio en ese fichero que no esté
  en esta lista **no está autorizado** por haberlo razonado en el ledger a posteriori.

## Entidades y reglas afectadas

- **Ninguna entidad de dominio.** No se toca `src/db/schema.ts`, no hay migración en
  `drizzle/`, no hay término nuevo para `docs/fundacion/dominio.md` (**ADR-025** no aplica: no
  se introduce ningún rótulo de dominio; «Crear cuenta», «Entrar» y el wordmark ya existen).
- **D-2 de `FOUNDATION.md` (locked)** — *no es tiempo real*: **por respeto, no por cambio**.
  CA-9 y CA-11 lo blindan: la frase se dice entera, con la misma constante y en la misma
  pantalla. Lo único que cambia es que deja de estar pintada como una alarma.
- **D-1 y D-4** — *avisa, no opera* y *la app no calcula zonas*: los dice `QUE_NO_HACE`, que no
  cambia ni de texto ni de pantalla.
- **RN-01 y RN-03** (`docs/fundacion/reglas.md`): **por respeto**. La landing sigue sin
  consultar la base y sin leer más que la cookie; `PUBLIC_PREFIXES` y `src/proxy.ts` **no se
  tocan** (CA-19). **RI-01** (migraciones aditivas): inaplicable, no hay migración.
- **SPEC-035 CA-9, CA-10, CA-11, CA-14** — frontera de no regresión (CA-12, CA-15).
- **SPEC-038 CA-1 y CA-2** — frontera de no regresión (CA-14) y el arbitraje escalado del
  §Notas pto. 2.
- **SPEC-039 CA-2, CA-3, CA-14, CA-17** — frontera de **no regresión** (CA-8, CA-9, CA-15,
  CA-17). **SPEC-039 CA-12** es el único caso distinto: su **criterio** queda intacto —no pedía
  `/`— pero su **test** se estrecha, con autorización nominal del humano y bajo **CA-22**; el
  camino que el canal pierde en la landing lo reata **CA-21**.
- **ADR-026** (la geometría se mide elemento a elemento) — se consume su módulo compartido en
  CA-2, CA-6 y CA-17. **ADR-024** (semver al tocar `src/`) — CA-20.
- **Sin ADR nuevo** (**CE-M3**). Se ha mirado si algo de aquí constriñe trabajo futuro. La única
  candidata era desacoplar `.brand` de `.app-nav`, y no lo es: es una refactorización de CSS que
  **reduce** el acoplamiento y no abre puerta a nada. Si en el gate se decidiera además llevar
  el wordmark a `/login`, `/register` y `/legal`, sigue sin haber ADR — pero sí cambiaría el
  alcance, y por eso está en §Fuera.

## Fuera de alcance

Cada aparcamiento con su razón y con qué lo reabriría.

- **Una captura de pantalla de `/vigiladas` en la landing.** Se propuso y **el humano dijo que
  no** (2026-08-23). Además ya estaba excluida por escrito: SPEC-039 la dejó fuera («ni
  capturas, ni testimonios, ni precios») y EPIC-MEJORA excluye «rediseño visual». *Lo reabre*:
  nada de esta spec — sería alcance de producto y decisión suya, no del arquitecto.
- **Enseñar en la landing si el registro está abierto.** Evaluada y **descartada**: rompería
  **SPEC-039 CA-14** (la landing no consulta la base de datos), que es exactamente lo que la
  hace legible con el resto caído. *Lo reabre*: solo un argumento arquitectónico nuevo que
  permita conocer el estado del grifo **sin** consultar nada.
- **Reescribir el mensaje de `/register` con el cupo lleno para que lea como lista de espera.**
  Se ha ido a leerlo antes de proponerlo, y **ya está resuelto**: `REGISTRO_CERRADO_QUE_HACER`
  (`src/lib/registration/messages.ts:40-42`) dice literalmente *«Las plazas se liberan cuando
  alguien borra su cuenta, así que vuelve a probar de vez en cuando»*, y **SPEC-037 CA-6** ya
  exigía que no se pareciera a un error. Una **lista de espera de verdad** —dejar el correo y
  que te avisen— es capacidad nueva con esquema nuevo, y el propio módulo la declara suya:
  `F-ADR-023-3`, *«necesita su propia spec»*. Meterla aquí sería alcance nuevo disfrazado de
  presentación (**CE-M3**). *Lo reabre*: un tester que se estampe contra el cupo y lo pida.
- **El chip compacto de cadencia** (tipo «Cierre · 1 vez al día») arriba, anticipando la frase
  larga. Evaluado por petición del humano y **descartado con criterio propio**, que es lo que él
  pidió que se hiciera si no convencía. Dos razones: (a) sería un **segundo literal** diciendo
  lo mismo que `CADENCIA_LINEA`, y el propósito entero de SPEC-039 CA-3 es que la cadencia sea
  **una sola constante** en las tres pantallas — este proyecto ya tiene anotado en
  `F-SPEC-039-3` cómo envejece en silencio un literal suelto al lado de una lista derivada; (b)
  **no está observado** (CE-M2): nadie se ha quejado de no ver la cadencia, sino de que la
  pantalla pesa. D-3 resuelve el peso sin añadir texto. *Lo reabre*: si el humano lo quiere
  igualmente, la forma honesta está escrita en §Notas pto. 4 y cuesta un CA, no una improvisación.
- **Llevar el wordmark a `/login`, `/register`, `/forgot-password` y `/legal`.** Esas pantallas
  tampoco montan `AppNav` y también se quedaron sin marca, y D-1 deja la clase lista para
  usarla. Pero **lo observado fue la primera pantalla** (CE-M2), y cada una de esas páginas
  tiene su propio reparto de espacio que habría que decidir de nuevo. *Lo reabre*: una sesión
  mirando el embudo completo del foro, o que el humano lo pida — es barato el día que se pida,
  precisamente porque D-1 ya está hecho.
- **Rediseñar el titular o reescribir `QUE_HACE` / `QUE_NO_HACE`.** Fuera: son textos aprobados
  en el gate de SPEC-039 y esta spec mueve peso visual, no argumentos. *Lo reabre*: feedback de
  testers diciendo que no entienden qué hace la app.
- **Tocar el sistema de color, la tipografía o los componentes `.btn` del design system.** Fuera
  por la épica (*«rediseño visual de la app»*). CA-6 pide **jerarquía entre los dos botones**,
  que se consigue con lo que el sistema ya tiene; si resultara que no se puede, la salida
  legítima **no** es inventar un botón: es decirlo en el gate.
- **`theme-color`, manifiesto PWA y `apple-touch-icon`.** Siguen fuera por lo mismo que en
  SPEC-047: no observados y con otra superficie.

## Riesgos

- **R-1 — Subordinar el pie acaba escondiéndolo.** Es el riesgo principal de D-5: entre «pesa
  menos» y «no se ve» hay un paso y se da sin querer. *Mitigación*: **CA-14** lo mide en
  positivo —visible, copiable, contraste ≥ 3:1— y enumera los cuatro atajos prohibidos. Si el
  peso deseado no se alcanza sin cruzar esa línea, la salida es el gate (§Notas pto. 2), no
  bajar el umbral.
- **R-2 — Desacoplar `.brand` reestila la barra sin que nadie lo note.** Sacar declaraciones de
  un selector de dos niveles a uno de uno cambia la especificidad, y la barra de navegación está
  en todas las pantallas de dentro. *Mitigación*: **CA-3** compara los estilos **calculados**
  de la barra real contra los que deriva del propio CSS, no contra literales; y **CA-19** deja
  `app-nav.tsx` prácticamente congelado.
- **R-3 — La pantalla que ya estaba medida se rompe por otro sitio.** `/` tiene tres guardias
  ajenas encima (SPEC-039 CA-2/CA-3/CA-12 y CA-17, SPEC-038 CA-1/CA-2, SPEC-035 CA-9/CA-10/
  CA-11). Reordenar ocho bloques es exactamente el cambio que las mueve. *Mitigación*: CA-8,
  CA-9, CA-12, CA-14, CA-16, CA-17 y CA-18 las citan una a una y exigen que sigan verdes **sin
  tocar ninguna aserción**. Cualquier fichero ajeno modificado es RED y va al gate.
- **R-4 — Reordenar deja la cadencia «escondida» y vuelve el malentendido que R-4 de EPIC-004
  temía.** Bajar `CADENCIA_LINEA` del segundo al sexto lugar es, medido en píxeles, alejarla del
  primer golpe de vista. *Mitigación*: sigue **por encima del pliegue en escritorio** y **entera
  en la página** (CA-9), sigue en `/ayuda` y en el estado vacío de `/vigiladas` (SPEC-039 CA-3
  intacto), y el pliegue no es donde se decide: quien viene de un foro **lee la pantalla**. Si
  aun así vuelve feedback de «no actualiza», la corrección es barata y tiene sitio: EPIC-MEJORA.
- **R-5 — La jerarquía de botones se mide mal.** «≥ 1,3 × de área» (CA-6) puede cumplirse con un
  botón primario ancho y feo. *Mitigación*: CA-6 se acompaña de captura en el gate del
  verificador; el número evita el empate visual, el ojo humano decide si además está bien.
- **R-6 — Sesiones en paralelo, y ya han mordido una vez.** Este encargo se escribió desde un
  worktree por detrás de `origin/main`, y todo lo citado se ha reverificado **dos veces** contra
  `origin/main`, la última en `9387681`. El riesgo no es teórico: entre la primera redacción y
  el arbitraje, otra sesión **ocupó el id `SPEC-049`** con una spec de EPIC-FIX, y ésta hubo que
  renumerarla. Las citas de línea (`globals.css:323`, `:1233`, `:1260`, `:1286`,
  `ayuda.spec.ts:361`) siguen siendo exactas en `9387681`, comprobado. El único punto de contacto probable con otro trabajo vivo es
  `src/app/globals.css`, que es un fichero largo y que esta spec toca en dos zonas separadas
  (`.app-nav .brand` ~línea 323 y el bloque `.landing*` ~línea 1232). Conflicto de merge
  probable pero trivial. Quien implemente **rebasa contra `origin/main` antes de empezar** y
  vuelve a leer los números de línea: los de esta spec son de `9387681` y envejecen.

## Notas para el gate humano

1. **Lo que decidí y lo que arbitraste tú.** Decido: desacoplar el wordmark y ponerlo en la
   primera pantalla (D-1, D-2); jerarquía real entre los dos botones y la ayuda fuera de esa
   fila; «gratis y sin publicidad» junto a las acciones; y la advertencia entera pero sin cromo
   de alarma y detrás de la propuesta de valor (D-3). **Arbitraste tú el 2026-08-23**: que en `/`
   se retire el canal de feedback y se quede la versión (pto. 2), y que «logo» significa el
   wordmark que ya existe y no un símbolo nuevo (pto. 3). El texto ya está reescrito con esas
   dos decisiones dentro; lo que queda es tu aprobación formal del conjunto.

2. **RESUELTO por ti el 2026-08-23: se retira el feedback de `/`, se queda la versión.** Queda
   aquí el razonamiento completo porque es lo que hace auditable la decisión, no un trámite.
   Pediste «menos información»; la forma fuerte era sacar de la primera pantalla las dos filas de
   instrumentación de tester, y los CA ajenos **literales** no autorizaban lo mismo:
   - **La versión, NO puedo quitarla.** **SPEC-038 CA-1** dice *«cualquier página»*. Su test
     (`tests/e2e/version-en-el-pie.spec.ts:47`) solo recorre `/login`, `/legal/terminos`,
     `/dashboard` y `/vigiladas`, así que quitarla de `/` **no pondría rojo nada** — y por eso
     es peor: haría **falso un criterio tuyo aprobado, en silencio**. Si la quieres fuera, lo
     que hay que enmendar es el CA, y la redacción mínima sería: *«…aparece en el pie de
     cualquier página **de la aplicación**; la primera pantalla (`/`), que es material de
     captación y no de operación, queda excluida por SPEC-050»*. **Dilo aquí y lo escribo como
     enmienda nominal**; no lo hago por conveniencia.
   - **El feedback, tu CA sí lo permite y tu test no.** **SPEC-039 CA-12** dice *«cualquier
     pantalla **autenticada** y también `/ayuda`»* — `/` no está. Pero su test
     (`tests/e2e/ayuda.spec.ts:361`) recorre `['/ayuda', '/', '/login', '/register']`: la
     prueba afirma **más** que el criterio. Quitarlo de `/` no haría falso ningún CA, pero
     **pondría RED una aserción ajena**, y estrechar esa lista **no es re-encuadrar ni borrar**
     en el sentido de `FOUNDATION.md`: es cambiar la promesa. Eso lo firmas tú.

   **Tu decisión, y verificaste tú mismo los dos literales en `origin/main`:** quitar el
   feedback de `/`, dejar la versión. Es lo que recomendé y está ejecutado en **D-5**, **CA-13**
   y **CA-14**. El estrechamiento del test ajeno va como **CA-22**, nominal y con las cuatro
   condiciones de SPEC-047 CA-19.

   **Y recojo tu matiz, porque importa más que la decisión.** Dijiste: *«el feedback es
   importante para mí, ya que permite a los usuarios decirme qué cosas puedo mejorar»*, y aun así
   aprobaste quitarlo de la landing. Lo apruebas sin perder nada real, y así queda escrito en
   D-5: el canal sigue en **toda pantalla autenticada** —donde está quien ya ha usado la app y
   tiene algo que contar— y en **`/ayuda`**, que es pública y se alcanza desde la propia landing
   con «Cómo funciona, con detalle». Lo único que desaparece es su presencia ante quien
   **todavía no tiene nada sobre lo que opinar**. Para que eso no se quede en una buena
   intención, **he añadido CA-21**: un test que recorre `/` → `/ayuda` → canal, **navegando**, y
   exige que el camino siga vivo en dos clics. Sin ese CA, «quitarlo de `/`» podría degenerar en
   «el visitante pierde el camino» sin que nada lo cazara — exactamente el fallo silencioso que
   yo mismo le reproché a SPEC-038 CA-1 en esta misma nota.

3. **RESUELTO por ti el 2026-08-23: «logo» es el wordmark que ya existe.** `Stockeiro` + el
   punto de acento (`src/app/app-nav.tsx:46`), el mismo del que salió el favicon de SPEC-047.
   **No hay símbolo gráfico nuevo, ni tipografía nueva, ni paleta nueva**, y esta spec sigue tal
   cual en ese punto: lo único que hace es **desacoplarlo del menú** (D-1) para poder usarlo en
   una superficie que se quedó sin él. Queda escrito para el verificador: si en la
   implementación apareciera un dibujo que no derive de ese wordmark, es **RED** y sale de la
   épica, no una interpretación generosa de este punto.

4. **El chip de cadencia: lo descarté yo y tú no lo has objetado, así que se queda descartado.**
   Lo dejo escrito igualmente porque fue una propuesta tuya y no quiero que parezca ignorada.
   Propusiste valorar un «Cierre · 1 vez al día» arriba que anticipara sin sustituir. Lo
   descarto por dos razones: sería un **segundo literal** de una frase cuya gracia entera es ser
   **una sola constante** en tres pantallas (SPEC-039 CA-3), y **no está observado** — el roce
   que contaste es que la pantalla pesa, y eso lo arregla D-3 sin escribir una palabra más. **Si
   lo quieres igualmente**, la forma honesta y no la improvisada es: una constante nueva
   exportada **al lado** de `CADENCIA_LINEA` en `src/lib/help/content.ts`, con un test que ate
   las dos a la misma cadencia, y un CA que diga que el chip **nunca sustituye** a la frase.
   Cuesta un CA y una constante; no cuesta un problema, siempre que se haga así.

5. **Lo que NO he tocado y quiero que veas que no.** El descargo de no asesoramiento, los tres
   enlaces legales y la línea «un proyecto de tremen.dev» siguen **idénticos** en la primera
   pantalla (CA-12): los tres son promesas universales de SPEC-035 (CA-9, CA-10, CA-11) y los
   tres valen para un desconocido. `CADENCIA_LINEA` sigue entera y es la misma constante
   (CA-9, CA-11). Y la landing sigue **sin consultar la base de datos** (CA-15): esa carencia es
   lo que la hace legible el día que el resto esté caído.

6. **Un hallazgo que no venía en el encargo y que te ahorra trabajo.** Se propuso, como
   consuelo de haber descartado enseñar el cupo en la landing, hacer que el mensaje de
   `/register` con el cupo lleno leyera como lista de espera. He ido a leerlo: **ya lo hace**
   (`src/lib/registration/messages.ts:40-42`), porque SPEC-037 CA-6 lo exigía. Y una lista de
   espera de verdad —dejar el correo y que te avisen— ya tiene dueño declarado: `F-ADR-023-3`
   dice que necesita su propia spec. No he metido ningún CA por eso.

7. **Sin ADR, sin migración, sin dependencia nueva** (CE-M3) y **sin tocar dato, cálculo ni
   regla** (CE-M1, acotado por CA-19). La versión sube por **ADR-024** al tocar `src/`; siendo
   presentación pura, **PATCH** es lo que corresponde, con el mismo criterio que SPEC-047.

8. **Estado: `borrador`.** No la apruebo yo. Los puntos 2 y 3 ya los arbitraste el 2026-08-23 y
   el texto está reescrito con esas decisiones dentro (D-5, CA-13, CA-14, CA-21, CA-22). Lo que
   queda es tu **aprobación formal** del conjunto ya arbitrado.

9. **Un cambio de numeración que debes conocer.** Esta spec nació como `SPEC-049` y ahora es
   `SPEC-050`: mientras se escribía, otra sesión mergeó en `origin/main` una **SPEC-049 propia**
   (EPIC-FIX, *el gate de versión no dice verde sobre un árbol sucio*). El id se reasignó desde
   `origin/main` y todas las citas se reverificaron contra `9387681`, donde siguen siendo
   exactas. La spec hermana de Open Graph pasó de `SPEC-050` a `SPEC-051` por lo mismo.
