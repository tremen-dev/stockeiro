---
id: SPEC-047
tipo: spec
epica: EPIC-MEJORA
estado: en-progreso
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-22, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-22, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-22, por: sdd-implementador}
---
# SPEC-047 — El icono de la app: la inicial y el punto de la marca, legibles a 16 px

## Problema

**Stockeiro no tiene icono.** Observado por el humano el 2026-08-22 sobre la pestaña real
del navegador (**CE-M2**), y verificado en el árbol antes de escribir esto: no existe
`public/`, no existe `src/app/icon.*`, no existe `src/app/favicon.ico`, no existe
`src/app/apple-icon.*`. El único `.svg` del repositorio es `design/tremen-ds/icons.svg`, que
es iconografía interna del sistema de diseño y no la marca. `src/app/layout.tsx` declara
`metadata.title` y `metadata.description` y **ningún** campo `icons`.

La consecuencia no es sólo la pestaña. El navegador cae en su icono por defecto —el folio en
blanco— en **cada pestaña, cada marcador, cada entrada del historial y cada pantallazo** que
un tester comparta. Y hay un detalle que lo empeora: el navegador pide `/favicon.ico` por su
cuenta, sin que nadie se lo mande, en cada visita. Hoy esa petición **se pierde**: no hay
fichero. Es decir, la app ya paga la petición y no se lleva nada a cambio.

Esto llega ahora y no antes por lo mismo que existe esta épica: hasta EPIC-004 el único
usuario era el autor, y un autor reconoce su pestaña por costumbre. **EPIC-004 está entera en
`hecho`** y el producto se va a compartir en un foro de bolsa, donde se pegan enlaces y se
comparten capturas. Ahí el folio en blanco no es una molestia privada: es lo primero que se ve.

**Por qué esto es mejora y no rediseño**, que es la frontera delicada de esta épica y ya la
dejó resuelta sdd-producto en `_epica.md` (*«Segundo caso — la app no tiene icono»*): **la
identidad ya existe y está en el código**. La marca es un *wordmark* montado en
`src/app/app-nav.tsx:45` —`Stockeiro` seguido de `<span className="dot">.</span>`— con el
punto pintado en el color de acento (`.app-nav .brand .dot { color: var(--accent); }`,
`src/app/globals.css:271`) y la palabra en `font: 900 20px/1 var(--font-sans)` con
`letter-spacing: -0.045em`. Un icono que sea **esa inicial y ese punto** no inventa identidad:
**aplica la que ya hay** a la única superficie que se quedó sin ella. Esta spec no toca ni el
wordmark, ni la tipografía, ni la paleta.

### Tres hechos del árbol que condicionan el diseño, y no son opcionales

1. **La app tiene un solo tema, y es oscuro.** `design/tremen-ds/colors_and_type.css` declara
   una única variante activa, `.v-tremendo` (`--bg: #111110`, `--fg: var(--bone)` = `#F5F1EA`,
   `--accent: var(--ember)` = `#FF6B00`), montada en `<body className="v-tremendo">`. No hay
   `prefers-color-scheme` en ninguna parte de `src/` ni de `design/` (comprobado). **Pero el
   favicon no vive dentro de la app: vive en el cromo del navegador**, que sí es claro u
   oscuro según el sistema de quien mira. Un icono transparente con la S en hueso desaparece
   sobre una barra de pestañas clara. La respuesta de esta spec es que **el icono trae su
   propio suelo** (§Diseño, D-1): una teselá opaca a sangre con el `--bg` de la app. Así no
   depende del tema de nadie, y de paso la pestaña y la app son del mismo color.

2. **La tipografía no se puede dar por disponible.** **SPEC-035 CA-12** sacó la única petición
   a un tercero que quedaba (`@import` a `fonts.googleapis.com`) y ahora Geist se resuelve en
   build con `next/font` y se sirve desde `/_next/static`. Las páginas de `/legal` **prometen
   por escrito** que no cargan nada de fuera. Un icono con `<text font-family="Geist">` dentro
   dependería de una fuente que el renderizador del favicon no tiene por qué tener, y en el
   peor caso la pediría fuera. Por eso la S de esta spec **es trazado vectorial cerrado, no
   texto** (§Diseño, D-2, y CA-1).

3. **La ruta del icono cae dentro del guardián de sesión, y eso rompería dos tests ajenos.**
   `src/proxy.ts` tiene `matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']`:
   `favicon.ico` **ya** está excluido, pero `icon.svg` **no**, y `isPublicPath` (
   `src/lib/auth/guard.ts`) tampoco lo contempla. Sin tocar nada, una petición anónima a
   `/icon.svg` entraría en Auth.js y saldría **redirigida a `/login`** — es decir, el icono
   fallaría exactamente en las páginas públicas que un desconocido del foro ve primero
   (`/`, `/login`, `/legal`, `/ayuda`). Y hay un daño colateral peor y ya cubierto por un test
   que existe: **SPEC-035 CA-13** (`tests/e2e/legal.spec.ts`, *«recorrer /legal anónimamente
   no fija ninguna cookie»*) se pondría **RED**, porque entrar en el flujo de Auth.js es
   justamente lo que estampaba `authjs.csrf-token` y `authjs.callback-url` y lo que esa spec
   arregló. La reachability del icono no es un detalle de despliegue: es un CA (CA-6, CA-7).

Esta spec se somete a **CE-M1** (no cambia ni un dato, ni un cálculo, ni una regla: el diff
fuera del icono y su ruta está acotado por CA-16), a **CE-M2** (el roce está observado, y las
piezas no observadas se aparcan en §Fuera de alcance) y a **CE-M3** (**sin migración, sin
proveedor nuevo, sin dependencia nueva y sin ADR**).

Reglas en juego, todas por respeto y ninguna por cambio: **RN-01** y **RN-03** —el icono es un
recurso estático, idéntico para todo el mundo y sin un solo byte de dato de usuario, así que
hacerlo alcanzable sin sesión no relaja el aislamiento ni abre una ruta de datos (CA-8 lo
prueba)— y **RI-01**, que no puede incumplirse porque **no hay migración**.

## Usuarios / roles afectados

- **Cualquier usuario con la app abierta** (`tester`, `completo`, `admin`): reconoce la
  pestaña de Stockeiro entre otras veinte sin leer el título, y sus marcadores dejan de ser
  folios en blanco.
- **El visitante que llega del foro y todavía no tiene cuenta**: es el caso que obliga a
  CA-6/CA-7. Ve `/`, `/login`, `/legal` y `/ayuda` **sin sesión**, y ahí es donde el icono
  tiene que salir. Si sólo saliera dentro de la app, el icono estaría justo donde ya no hace
  falta convencer a nadie.
- **El tester que comparte un pantallazo**: la barra de pestañas entra en la captura.
- **Quien mira desde un sistema en modo claro**: no pierde nada, porque el icono trae su
  propio fondo (D-1) y no hereda el del cromo.
- **Quien implemente esto**: hereda un contrato de proporciones (§Diseño) que existe para que
  no improvise a ojo, y una batería de comprobaciones sobre el rasterizado a 16 px, que es
  donde de verdad se decide si un favicon funciona.

## Diseño del icono

El icono es **la inicial del wordmark y su punto de acento**, nada más. Tres decisiones, y
después la geometría.

- **D-1 — El icono trae su propio suelo.** Teselá cuadrada **opaca a sangre** (ocupa el lienzo
  entero) con las esquinas redondeadas, pintada con el `--bg` de `.v-tremendo`. Motivo: el
  cromo del navegador es claro u oscuro según el sistema de quien mira, y un icono
  transparente estaría a merced de él. Con suelo propio, el contraste que se mide en CA-11 es
  el que se ve **siempre**. Efecto secundario buscado: la pestaña es del mismo color que la
  app que abre.
- **D-2 — La S es trazado, no texto.** Un `<path>` cerrado con la forma de la «S», de peso
  óptico equivalente al `font-weight: 900` que `.app-nav .brand` ya usa. Ni `<text>`, ni
  `font-family`, ni `@font-face`: sin dependencia de fuente no hay nada que pedir fuera
  (SPEC-035 CA-12) ni nada que falte en la máquina de quien mira.
- **D-3 — El punto conserva su relación con la letra.** En el wordmark el punto es un punto
  final: apoyado en la línea de base, a la derecha de la palabra, separado de ella y en
  `--accent`. En el icono es exactamente eso mismo respecto de la S. **No** es un badge, ni un
  anillo, ni una diéresis, ni va dentro de la letra.

**La rejilla es de 32.** El `viewBox` es `0 0 32 32` porque 16 y 32 son los dos tamaños que se
van a ver de verdad: sobre esa rejilla, cualquier coordenada en paso de 0,5 cae en un borde de
píxel al renderizar a 16 px, y el trazo no se emborrona al mitad de píxel. Las proporciones de
abajo son el contrato (CA-9); la curva concreta de la S la dibuja quien implementa.

| Elemento | Token de origen | Valor | Medida sobre la rejilla de 32 (y su equivalente a 16 px) |
|---|---|---|---|
| Teselá (fondo) | `--bg` de `.v-tremendo` | `#111110` | `0 0 32 32`, opaca, `rx` entre **5** y **7** (≈ 3 px a 16) |
| Letra «S» | `--bone` (`--fg`) | `#F5F1EA` | altura de mayúscula entre **18** y **22** (9–11 px a 16) |
| Grosor mínimo del trazo de la S | — | — | **≥ 4** (≥ 2 px a 16): por debajo, la S se convierte en hilo al bajar |
| Ojos (contraformas) de la S | — | — | **≥ 3** de luz en su punto más estrecho: por debajo, la S se ciega y queda un borrón |
| Punto | `--accent` (`--ember`) | `#FF6B00` | círculo de diámetro entre **5** y **7** (≈ 3 px a 16) |
| Separación S ↔ punto | — | — | **≥ 2** (≥ 1 px a 16): si se tocan, dejan de ser dos cosas |
| Margen exterior | — | — | **≥ 2** por los cuatro lados (la teselá no llega al borde con tinta) |
| Posición del punto | — | — | apoyado en la línea de base de la S y a su derecha: **mitad derecha y mitad inferior** del lienzo |

**Contraste** (los dos se calculan sobre el suelo de la propia teselá, no sobre el cromo):
hueso sobre `#111110` ≈ **16,8:1**; ember sobre `#111110` ≈ **6,6:1**. Los umbrales que fija
CA-11 son ≥ 15:1 y ≥ 6:1, con holgura deliberada para que un ajuste fino del color no obligue
a reescribir el CA.

**Y la parte que de verdad importa: los 16 px.** Un icono se diseña a 512 y se vive a 16. Lo
que a 512 es una S elegante, a 16 es una mancha con un punto naranja pegado. Por eso esta spec
**no da por bueno el trazado por sus proporciones**: lo rasteriza a 16×16 y le exige tres
cosas medibles (CA-12, CA-13, CA-14) — que el punto sobreviva como región separada, que la S
conserve sus dos ojos y no se rellene, y que la tinta ocupe una franja razonable del cuadrado
(ni hilo, ni bloque). Si el trazado no pasa esas tres, no está terminado, por bonito que sea a
512.

## Formatos que se entregan, y por qué dos

- **`src/app/icon.svg`** — la obra de origen. Nítida a cualquier tamaño y a cualquier densidad
  de pantalla, y un único fichero que no envejece cuando aparezca un tamaño nuevo.
- **`src/app/favicon.ico`** — multi-tamaño (**16, 32 y 48**). Existe por dos motivos, y
  ninguno es nostalgia: (a) el soporte de favicon en SVG **no es universal** —Safari es el
  caso conocido— y sin el `.ico` esas superficies se quedan como están hoy; (b) el navegador
  pide `/favicon.ico` por su cuenta lo declare uno o no, así que esa petición existe igual:
  o devuelve el icono o devuelve un 404. Además, el `.ico` es el único sitio donde el 16 px
  puede **afinarse a mano** en vez de salir de un reescalado automático, que es justo el
  tamaño donde el reescalado falla.

Ambos entran por la **convención de fichero del App Router** (`src/app/icon.svg`,
`src/app/favicon.ico`): es Next quien emite los `<link rel="icon">`. No se escriben `<link>` a
mano en `layout.tsx`, ni se crea `public/`, ni se rellena `metadata.icons` duplicando lo que
el framework ya declara (CA-4).

## Criterios de aceptación

Cada CA es verificable con un test: la forma de los ficheros y los bytes del `.ico` con
**Vitest** (lectura de fichero, sin base de datos); la cabecera servida, la alcanzabilidad y
el rasterizado a 16 px con **Playwright** contra `next start` (que es como corre el e2e de
este proyecto, así que se ejercita el build de producción, no el de desarrollo).

Dos CA fijan **propiedades** y no fotos del árbol, según la tercera convención de
`FOUNDATION.md`: CA-5 y CA-9 derivan sus valores esperados leyendo
`design/tremen-ds/colors_and_type.css`, en vez de teclear los hexadecimales en el test. Si
mañana cambia el token, el test cambia con él o falla diciendo por qué.

### Los ficheros existen y son lo que dicen ser

- **CA-1 (El SVG es autónomo: ni fuente, ni terceros, ni script).**
  Dado el fichero `src/app/icon.svg`,
  cuando se lee su contenido,
  entonces es un SVG válido con `viewBox` **cuadrado**; y **no** contiene ningún elemento
  `<text>`, `<tspan>`, `<script>`, `<foreignObject>` ni `<image>`; **ni** atributo
  `font-family`, `@font-face` o `@import`; **ni** ninguna referencia a un host externo
  (`http://`, `https://`, `//`) en ningún atributo. Un `<title>` es metadato, no texto pintado,
  y sí se admite.

- **CA-2 (El SVG no cambia de aspecto según quién lo mire).**
  Dado el mismo fichero,
  cuando se busca en él `prefers-color-scheme`, `currentColor` o `var(--`,
  entonces no aparece ninguno: los tres colores son literales. Motivo: un favicon que se
  adapta al tema del cromo divergiría del `.ico`, que no puede adaptarse — y dos iconos
  distintos para la misma app es peor que uno.

- **CA-3 (El `.ico` trae los tres tamaños).**
  Dado `src/app/favicon.ico`,
  cuando se parsea su cabecera `ICONDIR` y sus entradas,
  entonces hay entradas para **16×16, 32×32 y 48×48**, y cada una decodifica a una imagen de
  esas dimensiones exactas.

### El documento lo declara, por la vía del framework

- **CA-4 (Los `<link>` los pone Next desde la convención de fichero, y sólo una vez).**
  Dada la app servida,
  cuando se pide el HTML de una página **pública** (`/legal/aviso-legal`) y el de una
  **privada** con sesión (`/vigiladas`),
  entonces el `<head>` de las dos contiene un `<link rel="icon">` con
  `type="image/svg+xml"` apuntando al SVG **y** un `<link rel="icon">` apuntando al `.ico`;
  hay **exactamente uno de cada** (nada duplicado por haberlo declarado también a mano); y el
  diff contra `origin/main` **no** añade ningún `<link>` escrito a mano en `src/app/layout.tsx`,
  ningún campo `icons` en `metadata`, ni ningún fichero bajo `public/`.

- **CA-5 (Los colores del icono son los tokens de la marca, leídos de su fuente).**
  Dado `design/tremen-ds/colors_and_type.css`,
  cuando el test **extrae de ahí** los valores de `--bg` y `--accent` del bloque `.v-tremendo`
  y el de `--bone` de `:root`,
  entonces los tres literales de color que aparecen en `icon.svg` son exactamente esos tres, y
  el SVG no contiene ningún otro color.

### El icono se alcanza sin sesión (y sin dejar rastro)

- **CA-6 (Un anónimo recibe el icono, no un desvío a `/login`).**
  Dado un contexto de navegador **sin sesión**,
  cuando se lee del HTML de `/legal/aviso-legal` el `href` que Next emitió para cada icono y se
  pide cada uno de esos URL directamente,
  entonces cada respuesta es **200** con `content-type` de imagen (`image/svg+xml` y
  `image/x-icon` o `image/vnd.microsoft.icon`), **no** un 3xx a `/login` ni un `text/html`.
  El test toma el `href` del documento y no lo teclea, porque la URL exacta la decide el
  framework (lleva un hash de caché).

- **CA-7 (Pedir el icono no estampa ninguna cookie).**
  Dado el mismo contexto anónimo,
  cuando se piden los dos iconos,
  entonces ninguna respuesta trae `Set-Cookie`, y tras recorrer `/legal` el contexto sigue sin
  cookies. Esto es literalmente lo que ya comprueba **SPEC-035 CA-13**
  (`tests/e2e/legal.spec.ts`): ese test **sigue verde y sin tocar una sola aserción**, y a
  partir de ahora comprueba más que antes, porque la página ya pide un icono.

- **CA-8 (El icono no sabe quién lo pide: RN-01 y RN-03 intactos).**
  Dadas dos peticiones al mismo icono, una **con** sesión y otra **sin** ella,
  entonces los cuerpos son **byte a byte idénticos**; y el cambio en `src/proxy.ts` se limita a
  la cadena del `matcher` — `isPublicPath` / `PUBLIC_PREFIXES` (`src/lib/auth/guard.ts`) **no
  se tocan**, y las suites de `guard` y de `auth` siguen verdes sin modificar ninguna
  aserción. Motivo escrito: un icono es un estático idéntico para todo el mundo, y su sitio es
  la exclusión del `matcher` —donde `favicon.ico` ya estaba—, no la lista de páginas públicas,
  que es la excepción **documentada** a RN-03 y no debe crecer con cosas que no son páginas.

### El diseño es el que se pactó

- **CA-9 (La geometría cumple el contrato de proporciones).**
  Dado `icon.svg`,
  cuando se miden sus formas sobre el `viewBox` normalizado a 32,
  entonces: la teselá cubre el lienzo entero y es **opaca** (sin `fill-opacity`, sin `opacity`,
  sin canal alfa < 1) con `rx` entre 5 y 7; la altura de mayúscula de la S está entre 18 y 22;
  el punto es un círculo de diámetro entre 5 y 7; el centro del punto cae en la **mitad
  derecha** y en la **mitad inferior**; la separación mínima entre punto y S es ≥ 2; y ninguna
  tinta invade los 2 de margen exterior.

- **CA-10 (Sólo hay tres formas, y son las del wordmark).**
  Dado `icon.svg`,
  cuando se cuentan sus elementos de dibujo,
  entonces hay **exactamente tres**: la teselá, la S y el punto. Ni sombras, ni degradados
  (`<linearGradient>`, `<radialGradient>`), ni brillos, ni un anillo, ni un símbolo de bolsa.
  El wordmark tiene dos elementos; el icono tiene esos dos y su suelo.

- **CA-11 (Contraste medido, sobre el suelo propio del icono).**
  Dados los tres colores del icono,
  cuando se calcula el ratio de contraste WCAG de la S y del punto contra la teselá,
  entonces el de la S es **≥ 15:1** y el del punto **≥ 6:1**.

### Legibilidad a 16 px — el requisito de verdad

Los tres siguientes se comprueban **sobre píxeles**, no sobre intenciones: el SVG renderizado
a 16×16 (dibujado en un `<canvas>` de 16×16 y leído con `getImageData`) y la entrada de 16×16
del `.ico` decodificada de sus bytes. Un píxel «es» de un color si su distancia euclídea en
RGB al literal correspondiente es ≤ 24 (tolerancia para el antialiasing del borde).

- **CA-12 (El punto sobrevive al tamaño, y sigue siendo una cosa aparte).**
  Dado el rasterizado a 16×16,
  entonces hay **≥ 6 píxeles** de acento; forman **una sola región conexa**; su centroide cae
  en la mitad derecha y en la mitad inferior; y **ninguno** de esos píxeles es adyacente
  (8-vecindad) a un píxel de hueso — es decir, el punto y la letra no se han fundido.

- **CA-13 (La S sigue siendo una S, no un borrón).**
  Dado el rasterizado a 16×16 y la caja envolvente de los píxeles de hueso,
  entonces existe **al menos una línea horizontal en la mitad superior** de esa caja y **al
  menos una en la mitad inferior** en las que el patrón de píxeles es
  `hueso → fondo → hueso`, con el tramo de fondo de **≥ 1 px** (los dos ojos de la letra
  siguen abiertos). Repetido sobre el rasterizado a 32×32, el tramo de fondo es **≥ 2 px**.

- **CA-14 (La tinta ocupa lo que debe: ni hilo, ni bloque).**
  Dado el rasterizado a 16×16 (256 píxeles),
  entonces los píxeles de hueso están entre el **15 %** y el **40 %** del total; y **todos**
  los 256 píxeles son opacos (alfa 255) salvo, como mucho, los del redondeo de las cuatro
  esquinas — que es lo que garantiza D-1 (el icono trae su propio suelo) y lo que hace que
  CA-11 se cumpla también sobre una barra de pestañas clara.

- **CA-15 (Los dos formatos son el mismo icono).**
  Dados el SVG rasterizado a 16×16 y la entrada de 16×16 del `.ico`,
  entonces los dos cumplen CA-12, CA-13 y CA-14, y su cobertura de hueso no difiere en más de
  **8 puntos porcentuales**. Motivo: dos ficheros distintos pueden divergir sin que nadie se
  entere, porque cada navegador enseña uno solo.

### Cero regresión y cero peso nuevo (CE-M1, CE-M3)

- **CA-16 (El diff está acotado: esto es presentación pura).**
  Dado `git diff --name-only origin/main`,
  entonces los ficheros tocados están **únicamente** dentro de este conjunto:
  `src/app/icon.svg`, `src/app/favicon.ico`, `src/proxy.ts`, `scripts/`, `tests/`,
  `docs/`, `package.json`. En particular **no** hay ni un fichero bajo `src/db/`, ni bajo
  `drizzle/`, ni bajo `src/lib/` — ni un dato, ni un cálculo, ni una regla de negocio (CE-M1).
  El cambio en `src/proxy.ts` afecta a **una sola línea**: la del `matcher`.

- **CA-17 (El `.ico` se reproduce desde fuente comprometida, y no entra ninguna dependencia).**
  Dado el generador que produce el `.ico` (script propio en `scripts/`, invocable por un
  `npm run`),
  cuando se ejecuta sobre un árbol limpio,
  entonces el `favicon.ico` resultante es **byte a byte idéntico** al comprometido; y el diff
  de `package.json` contra `origin/main` **no añade ninguna entrada** en `dependencies` ni en
  `devDependencies`. Motivo: un binario comprometido sin forma de regenerarlo es un callejón
  sin salida en cuanto haya que retocar el trazado, y una dependencia nueva para dibujar tres
  formas es exactamente lo que CE-M3 llama «no es una mejora».

- **CA-18 (Las suites enteras siguen verdes, sin aflojar nada ajeno).**
  Dadas `npm test` y `npx playwright test` completas,
  entonces pasan; y `git diff origin/main -- tests/` no **modifica** ninguna aserción existente
  (sólo añade ficheros o casos nuevos). Con dos verdes citados por su nombre, porque son los
  que este cambio pone a prueba de verdad: **SPEC-035 CA-12** (ni un recurso de terceros en
  `/legal` — que ahora también cubre el icono) y **SPEC-035 CA-13** (ninguna cookie al
  recorrer `/legal` anónimamente — el que cazaría el fallo del `matcher`).

## Entidades y reglas afectadas

- **Ninguna entidad de dominio.** No se toca `src/db/schema.ts`, no hay migración en
  `drizzle/`, no hay término nuevo para `docs/fundacion/dominio.md` (ADR-025 no aplica: el
  icono no introduce ningún rótulo de dominio).
- **RN-01** y **RN-03** (`docs/fundacion/reglas.md`): **por respeto, no por cambio**. El icono
  es un estático sin dato de usuario; CA-8 lo prueba comparando los bytes servidos con y sin
  sesión, y deja `PUBLIC_PREFIXES` —la excepción documentada a RN-03— sin tocar.
- **RI-01** (migraciones aditivas): inaplicable, no hay migración.
- **SPEC-035** (páginas legales, CA-12 y CA-13): frontera de no regresión, no de cambio. Sus
  dos promesas —cero terceros, cero cookies— son las que acotan qué icono es admisible aquí.
- **ADR-015 pto. 9** (`/reset-password` no carga recursos de terceros): mismo respeto; el icono
  entra también en esa página y sale del propio origen.
- **Sin ADR nuevo** (CE-M3). Se ha mirado si alguna decisión de aquí constriñe trabajo futuro:
  la única candidata era la exclusión del `matcher`, y no lo es — es la misma clase de
  excepción que `favicon.ico` ya tenía en esa misma línea, con la misma razón (estático sin
  dato de usuario), y no abre puerta a nada nuevo. Si en el gate se decide meter manifiesto y
  Open Graph, **eso sí** puede pedir decisión propia (`metadataBase`, origen absoluto de
  producción), y por eso están fuera.

## Fuera de alcance

Todo lo de esta lista es **pariente cercano y ninguno está observado** (CE-M2). Se aparca a
propósito, con su razón y con qué lo reabriría.

- **Manifiesto PWA (`manifest.webmanifest`).** No observado. Declarar un manifiesto es declarar
  **instalabilidad**: `name`, `short_name`, `display`, `start_url`, iconos *maskable*… es una
  promesa de producto que nadie ha pedido y que habría que sostener. *Lo reabre*: un tester que
  quiera instalarla en su móvil.
- **`apple-icon` / apple-touch-icon.** No observado. Su superficie es la pantalla de inicio de
  iOS, a la que hoy no lleva ningún camino porque no hay manifiesto ni invitación a instalar.
  Y quiere **otro dibujo**: iOS aplica su propia máscara y su propio redondeo, así que el `rx`
  de D-1 pelearía con el del sistema. Viaja con el manifiesto, y ese es el argumento para
  hacerlos juntos en una spec futura y no medio en ésta.
- **Imagen de Open Graph / Twitter card.** No observada, y es **otra superficie**: la
  vista previa del enlace, no la pestaña. Tiene valor real para el foro y por eso se nombra en
  §Notas para el gate, pero (a) una tarjeta de 1200×630 es una **composición** —wordmark,
  reclamo, fondo—, es decir diseño de identidad y no aplicación de la que ya hay, y roza el
  *«fuera: rediseño visual»* de la épica; y (b) necesita `metadataBase` con el origen absoluto
  de producción, que es una decisión de configuración, justo de lo que CE-M3 saca de aquí.
  *Lo reabre*: la decisión del humano de publicar en el foro con vista previa cuidada — y
  entonces es spec propia, no un CA colgado de ésta.
- **`theme-color`.** No observado. Pinta el cromo del navegador móvil; es una decisión de color
  sobre una superficie de la que nadie se ha quejado. Barato de añadir el día que se pida.
- **Icono que cambia con el estado** (una marca en el favicon cuando algo entra en zona).
  Tentador en una app de vigilancia y **capacidad nueva**, no presentación: exige estado de
  cliente y un icono generado por usuario. Fuera por alcance, no por desinterés.
- **Tocar el wordmark, la tipografía o la paleta.** Fuera por la épica. Esta spec **consume**
  `--bg`, `--bone` y `--accent`; no propone ninguno.
- **Limpiar el `matcher` de `src/proxy.ts`.** Sus alternativas no están ancladas ni escapadas
  (`favicon.ico` empareja el punto como comodín, `api` empareja cualquier ruta que empiece por
  esas letras). Se ha visto al leerlo y **no se arregla aquí**: es EPIC-FIX si alguien
  demuestra que muerde. Esta spec añade su exclusión **con el mismo estilo** que las cuatro que
  ya están, para no dejar la línea a medio criterio.

## Riesgos

- **R-1 — El trazado bonito que no pasa los 16 px.** Es el riesgo principal y el motivo de que
  CA-12/CA-13/CA-14 existan. Una S de peso 900 con ojos estrechos se ciega al bajar a 16, y el
  resultado es una mancha con un punto naranja. *Mitigación*: la tabla de proporciones fija los
  mínimos (trazo ≥ 4, ojos ≥ 3 sobre la rejilla de 32) **antes** de dibujar, y el rasterizado
  los vuelve a comprobar **después**. Si chocan, manda el rasterizado: se engorda el ojo, no se
  afloja el test.
- **R-2 — El 16 px del `.ico` sale de un reescalado automático y se emborrona.** El SVG puede
  cumplir y su reducción a 16 no. *Mitigación*: CA-15 obliga a que **las dos** rasterizaciones
  cumplan lo mismo. Si el reescalado no llega, la salida legítima es **afinar a mano** el
  16×16 del `.ico`; para eso se entrega ese formato.
- **R-3 — El icono se declara y no se alcanza.** El fallo silencioso clásico: el `<link>` está,
  el navegador pide, el guardián redirige, y la pestaña sigue en blanco sin que nadie vea un
  error. *Mitigación*: CA-6 pide el URL **real** emitido por el framework y exige 200 con tipo
  de imagen; y el fallo, si vuelve, se delata solo por CA-7 / SPEC-035 CA-13.
- **R-4 — La URL del icono la decide el framework y puede llevar hash de caché.** Un test que
  teclee `/icon.svg` puede caducar con una versión de Next. *Mitigación*: CA-6 lee el `href`
  del documento servido. Es una propiedad («lo que el documento declara se puede pedir y
  devuelve una imagen»), no una foto del árbol — la tercera convención de `FOUNDATION.md`.
- **R-5 — El binario comprometido que nadie sabe regenerar.** Un `.ico` a mano sin generador es
  un callejón sin salida el día que haya que mover el punto medio píxel. *Mitigación*: CA-17
  (reproducible, sin dependencia nueva). Si el generador sin dependencias resulta caro, la
  salida **no** es añadir una librería de imagen: es dejar escrito en el ledger el
  procedimiento exacto y llevar la excepción al gate.
- **R-6 — Ninguno de los tres worktrees vivos toca esto.** SPEC-046 (EPIC-FIX) y el trabajo de
  EPIC-006 van por otras ramas y otros ficheros; el único punto de contacto es `src/proxy.ts`,
  que esta spec cambia en **una línea**. Conflicto improbable y trivial si aparece.

## Notas para el gate humano

1. **Lo que decido y lo que te dejo decidir.** Dentro: `icon.svg` + `favicon.ico` (16/32/48) y
   que se alcancen sin sesión. Fuera: manifiesto PWA, apple-touch-icon, imagen de Open Graph y
   `theme-color`, cada uno con su razón en §Fuera de alcance. El criterio ha sido CE-M2: lo que
   viste fue la **pestaña**, y la pestaña se arregla con estas dos piezas.
2. **La que más me costó aparcar es la de Open Graph**, y quiero que la mires con lupa: si vas
   a pegar el enlace en el foro, la vista previa la ve **más gente que la pestaña**. La he
   dejado fuera porque una tarjeta de 1200×630 es composición de identidad —no aplicar la que
   hay a un cuadrado de 16— y porque arrastra `metadataBase`. **Si la quieres antes de
   publicar, dilo aquí y la escribo como spec propia**; no la metas en ésta por conveniencia,
   porque es la puerta por la que esta mejora se convierte en un proyecto de marca.
3. **Un cambio en `src/proxy.ts` merece tu mirada, aunque sea de una línea.** El icono cae hoy
   dentro del guardián de sesión y por eso hay que excluirlo del `matcher`, exactamente donde
   `favicon.ico` ya estaba. He descartado a propósito la otra vía —meterlo en
   `PUBLIC_PREFIXES`— porque esa lista es la excepción **documentada** a RN-03 y es de
   **páginas**; engordarla con estáticos la desdibuja. Si prefieres no tocar el guardián en
   absoluto, hay una salida: **entregar sólo el `.ico`**, que ya está excluido. No la
   recomiendo (se pierde la nitidez en pantallas densas y el formato que mejor envejece), pero
   es una decisión tuya de una frase.
4. **Un hecho de navegador sobre el que no tengo certeza total.** El `.ico` lo justifico en
   parte con que el soporte de favicon SVG no es universal (el caso conocido es Safari). No lo
   he verificado en un Safari real desde aquí. **No cambia la decisión** —el segundo motivo, la
   petición automática a `/favicon.ico`, se sostiene solo— pero prefiero que sepas que esa
   frase es un supuesto y no una medida.
5. **Cómo sabrás que el icono es bueno y no sólo que existe.** Los CA de pantalla no dicen «se
   ve bonito»: rasterizan a 16×16 y cuentan píxeles (punto separado de la letra, ojos de la S
   abiertos, tinta entre el 15 % y el 40 %). Aun así, **pide la captura a 16 px en el gate del
   verificador y mírala**: hay un salto entre «cumple los números» y «lo reconozco de un
   vistazo entre veinte pestañas», y ese salto sólo lo cierra un ojo humano. Si no te gusta,
   el sitio de decirlo es ahí y no después.
6. **La versión.** `package.json` está en `0.3.0` y ADR-024 lo hace fuente de verdad del
   número. Esta spec no decide si un icono merece bump; lo dejo apuntado para que no se pierda
   en el merge.
7. **Sin ADR, sin migración, sin dependencia nueva** (CE-M3), y **sin tocar dato, cálculo ni
   regla** (CE-M1, acotado por CA-16). Si en el gate se incorpora el manifiesto o el Open
   Graph, ese encaje cambia y habría que revisarlo.
8. **Queda en `borrador`.** El paso a `aprobada` lo firmas tú.
