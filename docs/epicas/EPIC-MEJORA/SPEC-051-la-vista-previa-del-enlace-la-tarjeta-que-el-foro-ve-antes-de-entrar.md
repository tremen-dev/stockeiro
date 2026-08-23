---
id: SPEC-051
tipo: spec
epica: EPIC-MEJORA
estado: aprobada
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-23, por: humano (Alberto Fojo)}
---
# SPEC-051 — La vista previa del enlace: la tarjeta que el foro ve antes de entrar

## Problema

**Stockeiro no tiene tarjeta social.** Verificado contra `origin/main` (`9387681`) antes de
escribir esto: **cero** apariciones de `openGraph`, `twitter`, `metadataBase` u
`opengraph-image` en todo `src/`. `src/app/layout.tsx:28-31` declara `title` y `description` y
nada más; `src/app/page.tsx:7-12` declara su propio `title` y `description`. No existe
`public/`. Es decir: cuando alguien pega `https://stockeiro.tremen.dev` en un hilo de un foro,
el software del foro busca `og:image` y **no encuentra nada**, así que enseña —según el
motor— o un enlace pelado, o un recuadro vacío, o lo que consiga rascar del HTML.

Esta spec **existe por una condición de reapertura escrita**, no por una ocurrencia.
**SPEC-047** (*El icono de la app*, EPIC-MEJORA, `hecho`, 2026-08-22) aparcó esta pieza en su
§Fuera de alcance con estas palabras:

> «**Imagen de Open Graph / Twitter card.** No observada, y es **otra superficie**: la vista
> previa del enlace, no la pestaña. […] *Lo reabre*: la decisión del humano de publicar en el
> foro con vista previa cuidada — y entonces es spec propia, no un CA colgado de ésta.»

Y su §Notas para el gate, nota 2, se lo llevó al humano en persona:

> «La que más me costó aparcar es la de Open Graph, y quiero que la mires con lupa: si vas a
> pegar el enlace en el foro, la vista previa la ve **más gente que la pestaña**. […] **Si la
> quieres antes de publicar, dilo aquí y la escribo como spec propia**; no la metas en ésta por
> conveniencia, porque es la puerta por la que esta mejora se convierte en un proyecto de marca.»

**El humano ha publicado y ha respondido que sí** (Alberto Fojo, 2026-08-23): la quiere, con
imagen, como spec propia. La condición se ha cumplido y ésta es esa spec.

### Sobre CE-M2, sin disimular

**CE-M2** de la épica pide que el roce esté *observado, no imaginado*. Aquí no hay pantallazo:
nadie ha pegado el enlace y ha enseñado una vista previa fea. Lo que hay es (a) la carencia
**verificada en el árbol** —no hay ninguna tarjeta, así que la vista previa no puede ser buena—,
(b) la **publicación ya hecha** en un foro donde los enlaces se pegan, y (c) una **condición de
reapertura escrita en un gate anterior y activada por el humano**. Eso es lo más cerca de
«observado» que puede estar algo cuya superficie no vive en nuestra pantalla sino en la de un
tercero. **Se dice aquí y no se disfraza**: si al gate le parece que no basta, el sitio de
decirlo es el gate.

### Las tres trampas que ya mordieron en SPEC-047 y que aquí vuelven

1. **La tipografía no se puede dar por disponible.** **SPEC-035 CA-12** sacó la última petición
   a un tercero: Geist se resuelve en build con `next/font` (`src/app/layout.tsx:21-26`) y se
   sirve desde `/_next/static`, y las páginas de `/legal` **prometen por escrito** que no cargan
   nada de fuera. No hay ningún fichero de fuente en el repositorio ni el paquete `geist` en
   `package.json` (comprobado). Una tarjeta con el wordmark **como texto** dependería de una
   fuente que ningún generador tiene a mano, o la pediría fuera. SPEC-047 ya resolvió esto una
   vez, y su respuesta —**D-2: la S es trazado, no texto**— sigue siendo la buena.
2. **La ruta del recurso cae dentro del guardián de sesión.** `src/proxy.ts:75` declara
   `matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)']`. La imagen de Open
   Graph **no está** en esa lista, y `isPublicPath` (`src/lib/auth/guard.ts:52`) tampoco la
   contempla. Sin tocar nada, la petición **anónima** de un rastreador de Facebook, X, Slack,
   WhatsApp o el propio foro entraría en Auth.js y saldría **redirigida a `/login`**: la vista
   previa quedaría vacía y nadie vería un error. Es exactamente el punto 3 de SPEC-047, y con el
   mismo daño colateral: entrar en el flujo de Auth.js es lo que estampaba
   `authjs.csrf-token` y `authjs.callback-url`, y eso pondría **RED a SPEC-035 CA-13**
   (`tests/e2e/legal.spec.ts`, *«recorrer /legal anónimamente no fija ninguna cookie»*).
3. **`metadataBase`.** Sin un origen absoluto declarado, Next emite `og:image` **relativo** o
   cae en `localhost`, y ningún rastreador resuelve una URL relativa. Es la pieza que SPEC-047
   citó como «decisión de configuración» para justificar el aparcamiento. §Diseño D-4 la resuelve
   **sin decisión nueva** y por eso esta spec **no necesita ADR**; el razonamiento completo, con
   las tres alternativas rechazadas, está ahí y en §Notas pto. 3.

Esta spec se somete a **CE-M1** (no toca un dato, un cálculo ni una regla: acotado por CA-20),
a **CE-M2** (con la salvedad escrita arriba) y a **CE-M3** (**sin migración, sin proveedor
nuevo, sin dependencia nueva, sin clave de entorno nueva y sin ADR**).

## Usuarios / roles afectados

- **El desconocido que ve el enlace en el foro y todavía no ha hecho clic.** Es el usuario de
  esta spec, y el único que existe: **ve la tarjeta antes que ninguna otra cosa de Stockeiro**,
  y decide con ella si entra. No tiene sesión, no tiene cuenta y su navegador **no es quien pide
  la imagen** — la pide el rastreador del foro, sin cookies y a menudo sin JavaScript. Eso es lo
  que convierte CA-14/CA-15/CA-16 en obligatorios y no en aseo.
- **El tester que comparte el enlace** en un hilo, por chat o por correo: hoy comparte un
  recuadro vacío.
- **El humano que publica**: la tarjeta es lo que representa al producto en superficies que él
  no controla.
- **Quien implemente esto**: hereda un contrato de proporciones (§Diseño) y la advertencia de
  que **tres guardias ajenas** vuelven a moverse (CA-17); no las toca por su cuenta.

## Diseño

Siete decisiones. Las tres primeras son las que impiden que esto se convierta en un proyecto de
marca.

- **D-1 — En la imagen no hay ni una letra.** La tarjeta **no lleva texto pintado**. Las palabras
  —el nombre, el reclamo— viajan en `og:title` y `og:description`, que es **texto de verdad**:
  todas las plataformas lo renderizan junto a la imagen, con su tipografía, seleccionable y
  legible por un lector de pantalla. Motivo, y es el nudo de esta spec: poner «Stockeiro» dentro
  del PNG solo tiene dos caminos y los dos están cerrados. **Con una fuente** vuelve la trampa 1
  (no hay Geist a mano y `/legal` promete no salir fuera). **Trazando las letras a mano** salen
  nueve glifos que **no son Geist**: eso es **tipografía nueva**, que es literalmente lo que la
  épica excluye. Sacar las palabras del PNG no es una renuncia: es lo que hace que esta tarjeta
  siga siendo *aplicar la identidad que hay* y no *diseñarla*.
- **D-2 — La composición es la marca que ya se genera, en grande.** El dibujo de la tarjeta es
  **la S y su punto de acento**, las mismas formas que `scripts/icon-geometry.mjs` ya produce
  para `icon.svg` y `favicon.ico` (`trazadoDeLaS`, `cuencosDeLaS`, el polígono del punto), a
  escala. **No se dibuja ninguna forma nueva.** Si de aquí saliera un símbolo que no derive de
  ese trazado, sería identidad nueva y saldría de EPIC-MEJORA (misma frontera que SPEC-047).
- **D-3 — La tarjeta no trae teselá: el lienzo ES el suelo.** SPEC-047 D-1 dio al icono un suelo
  propio porque el cromo del navegador es claro u oscuro según el sistema de quien mira. Aquí ese
  motivo **no existe**: la tarjeta ocupa 1200×630 enteros y es su propio fondo. Así que se pinta
  el lienzo con el `--bg` de `.v-tremendo` y se dibujan encima las **dos** formas del wordmark,
  sin el rectángulo redondeado del icono. Consecuencia buscada: la vista previa y la app que
  abre son del mismo color.
- **D-4 — El origen absoluto no es una decisión nueva: es una que ya está tomada.**
  `metadataBase` sale de **`appBaseUrl()`** (`src/lib/config/app-url.ts:13`), que ya existe desde
  SPEC-023, ya está declarada en `.env.example` como *«Origen absoluto de la app»*, ya está entre
  las **once claves** que congela `tests/spec-031-frontera.test.ts:133-149`, ya vale
  `https://stockeiro.tremen.dev` en producción (`docs/despliegue.md:55-56`), ya vale
  `http://localhost:3200` en CI (`.github/workflows/ci.yml:148`, y `tests/e2e/server.mjs:69` en
  el arranque del e2e) y **ya falla ruidosamente si falta**, que es la conducta correcta. No se
  añade ninguna clave, no se crea ninguna segunda fuente de verdad y **no hace falta ADR**. Las
  tres alternativas se han evaluado y se rechazan:
  - **Una variable nueva** (`NEXT_PUBLIC_SITE_URL` o similar): pondría **RED** a
    `tests/spec-031-frontera.test.ts` —lista cerrada de once claves con `toHaveLength(11)`— a
    cambio de nada, y crearía un segundo origen absoluto justo donde **ADR-015 pto. 8** puso uno
    solo a propósito.
  - **Derivar de `TITULAR.dominio`** (`src/lib/legal/content.ts:41`, `stockeiro.tremen.dev`):
    hoy coincide, pero ese dato es una **afirmación legal** sobre quién opera el servicio, no la
    configuración del despliegue. Atar los metadatos a un texto legal significa que corregir el
    aviso legal cambiaría en silencio el origen de la tarjeta; y en un despliegue de *preview*
    apuntaría a producción.
  - **Derivar de `VERCEL_URL`**: es la URL del despliegue, no el alias que recorren las personas
    (`.github/workflows/deploy-gate.yml:79-83` ya dejó escrita esa distinción). Repartiría
    `stockeiro-xxxx.vercel.app` por cada enlace compartido.
- **D-5 — Una sola tarjeta, global, por la convención de fichero.** `src/app/opengraph-image.png`
  en la raíz de `app/`, con su `src/app/opengraph-image.alt.txt`. Es Next quien emite los
  `<meta>` y quien calcula la URL; **no se escribe ningún `<meta>` a mano** y **no se crea
  `public/`** — la misma disciplina que SPEC-047 CA-4 impuso a los iconos. Todas las rutas la
  heredan, que es lo correcto: el enlace que se pega es `/`, y `/ayuda` y `/legal` son destinos
  legítimos del mismo hilo. **Lo que sí es por página son las palabras**: `og:title` y
  `og:description` (CA-3).
- **D-6 — La imagen se compone pensando en el recorte, no en el rectángulo.** Las plataformas
  recortan: X en `summary_large_image` ronda 2:1, otras enseñan un cuadrado. Por eso el contrato
  de §Geometría confina **toda la tinta al cuadrado central de 630×630** con margen. Una tarjeta
  que solo se ve entera en Facebook es media tarjeta.
- **D-7 — `twitter:card` entra, y no cuesta un activo.** `summary_large_image` reutilizando la
  **misma** imagen. Sin él, X enseña el recuadro pequeño; con él, el grande. Es un campo de
  metadatos, no un segundo dibujo, y por eso no arrastra la composición que hizo que SPEC-047 lo
  aparcara junto a Open Graph.

- **D-8 — El generador cuelga de `icon:build`, y así la tercera guardia ajena desaparece en vez
  de parchearse.** Arbitrado por el humano (Alberto Fojo) el **2026-08-23**, que eligió
  explícitamente esta vía sobre la de estrenar clave. La tarjeta la escribe el **mismo**
  `scripts/build-icon.mjs` que ya produce `icon.svg` y `favicon.ico` —tiene sentido: los tres
  salen de la **misma** geometría de `scripts/icon-geometry.mjs` y de los **mismos** tokens—, así
  que `package.json` **no gana ninguna clave en `scripts`** y `tests/deploy-gate-workflow.test.ts`
  (la lista cerrada de SPEC-028 CA-9.3) **sigue verde y sin tocarse**.

  Esto no es solo ahorro: es la lección de que **la mejor forma de tratar con una guardia ajena
  es no necesitarla**. De las tres que SPEC-047 tuvo que ampliar, aquí **una se elimina por
  construcción** y solo quedan las dos del `matcher`, que son inevitables porque el recurso tiene
  que ser alcanzable sin sesión. Y refuerza lo que §Fuera de alcance ya anota sobre esa línea de
  `src/proxy.ts`: si aun descontando ésta sigue arrastrando dos tests cada vez que se añade un
  activo, el problema es la línea, no quien la toca.

  Lo que sí se toca —y está dentro del conjunto de CA-20— es la cabecera de
  `scripts/build-icon.mjs`, que hoy dice *«Escribe los dos ficheros del icono»* y pasará a decir
  la verdad: escribe los **tres** activos de marca. Un documento de verdad que afirma algo falso
  es un defecto, no un detalle.

### Geometría de la tarjeta

Sobre un lienzo de **1200 × 630**. Es el contrato de CA-10; la curva concreta de la S ya está
escrita en `scripts/icon-geometry.mjs` y no se redibuja.

| Elemento | Token de origen | Medida |
|---|---|---|
| Lienzo | `--bg` de `.v-tremendo` (`#111110`) | 1200 × 630, **opaco a sangre**, sin degradado |
| Marca (S + punto) | — | caja envolvente de altura entre **35 %** y **50 %** de 630 (**220–315 px**) |
| Letra «S» | `--bone` / `--fg` (`#F5F1EA`) | derivada de `trazadoDeLaS()`, sin deformar (misma relación alto/ancho que el icono, ±2 %) |
| Punto | `--accent` / `--ember` (`#FF6B00`) | a la derecha de la S, apoyado en su línea de base, separado — la relación de SPEC-047 D-3 |
| Centrado | — | centro de la caja envolvente a **≤ 8 px** del centro del lienzo en los dos ejes |
| Área segura | — | **toda** la tinta dentro del cuadrado central de **630 × 630**, y a **≥ 60 px** de sus cuatro bordes |
| Colores | — | **exactamente tres** (más el antialiasing del borde). Ni cuarto color, ni degradado, ni sombra |

**Contraste**, calculado sobre el propio lienzo: hueso sobre `#111110` ≈ **16,8:1**; ember sobre
`#111110` ≈ **6,6:1**. Los umbrales de CA-11 son **≥ 15:1** y **≥ 6:1**, con la misma holgura
deliberada que SPEC-047 CA-11.

## Criterios de aceptación

Cada CA es verificable con un test: la forma y los bytes del PNG con **Vitest** (lectura de
fichero, sin base de datos); los `<meta>` servidos, la alcanzabilidad anónima y las cookies con
**Playwright** contra `next start`, que es como corre el e2e de este proyecto.

Dos CA fijan **propiedades y no fotos del árbol** (tercera convención de `FOUNDATION.md`): CA-8
deriva los colores esperados leyendo `design/tremen-ds/colors_and_type.css`, y CA-4/CA-14 leen
la URL de la imagen **del documento servido** en vez de teclearla, porque la decide el framework
y puede llevar hash de caché.

### La declaración: qué dice el documento

- **CA-1 (El origen absoluto sale de la configuración que ya existe, y de un solo sitio).**
  Dado el árbol tal y como queda,
  cuando se busca `metadataBase` en `src/`,
  entonces aparece **una sola vez**, en `src/app/layout.tsx`, y su valor se construye con
  **`appBaseUrl()`** de `src/lib/config/app-url.ts`. Y: `.env.example` declara **exactamente
  once** claves —lo que ya afirma `tests/spec-031-frontera.test.ts` con `toHaveLength(11)`, que
  **sigue verde y sin tocar ninguna aserción**, y por eso este CA lo **cita en vez de
  duplicarlo**—; y no aparece en `src/` ninguna referencia a `VERCEL_URL`,
  `NEXT_PUBLIC_SITE_URL` ni a `TITULAR.dominio` con este fin.

- **CA-2 (La primera pantalla sirve una tarjeta completa).**
  Dada `/` servida a un visitante **sin sesión**,
  cuando se leen los `<meta>` del `<head>`,
  entonces están, **una sola vez cada uno**: `og:type` = `website`, `og:site_name` =
  `Stockeiro`, `og:locale` = `es_ES`, `og:title` no vacío, `og:description` no vacío, `og:url`
  absoluto, `og:image` absoluto, `og:image:width` = **1200**, `og:image:height` = **630**,
  `og:image:type` = `image/png` y `og:image:alt` no vacío.

- **CA-3 (Las palabras son las de cada página, no las del layout).**
  Dadas `/`, `/ayuda` y `/legal/aviso-legal` sin sesión,
  cuando se comparan el `<title>` y la `description` de cada una con su `og:title` y su
  `og:description`,
  entonces **coinciden en cada página**: la primera pantalla anuncia *«Stockeiro — vigila tus
  zonas de compra y venta»* y no *«Stockeiro»* a secas. Este CA existe porque la herencia de
  `metadata` entre layout y página **no se da por sabida**: se mide sobre el HTML servido, no se
  deduce del framework.

- **CA-4 (La URL de la imagen es absoluta y del propio origen).**
  Dado el `og:image` servido en `/`,
  cuando se lee su valor,
  entonces es una **URL absoluta** (empieza por `http://` o `https://`), su origen es
  **exactamente** el que devuelve `appBaseUrl()` en ese despliegue, y **no** es `localhost`
  cuando el despliegue no lo es. Motivo: ningún rastreador resuelve una URL relativa, y una
  tarjeta que apunta a `localhost` es peor que no tener tarjeta, porque parece que funciona.

- **CA-5 (X enseña la tarjeta grande, con la misma imagen).**
  Dado el `<head>` de `/`,
  cuando se leen los `<meta name="twitter:*">`,
  entonces `twitter:card` es **`summary_large_image`**, `twitter:title` y `twitter:description`
  están, y `twitter:image` es **la misma URL** que `og:image`. No hay ningún segundo fichero de
  imagen en el repositorio para esto.

- **CA-6 (Lo declara el framework por la convención de fichero, y nadie a mano).**
  Dado el árbol tal y como queda,
  cuando se mira cómo se emiten los `<meta>`,
  entonces existen `src/app/opengraph-image.png` y `src/app/opengraph-image.alt.txt`; **no** hay
  ningún `<meta property="og:` ni `<meta name="twitter:` escrito a mano en ningún `.tsx`; **no**
  hay ningún `<link rel="preload">` ni `<img>` apuntando a la tarjeta; y **no** se crea `public/`.

### La imagen: qué es el fichero

- **CA-7 (Es lo que dice ser).**
  Dado `src/app/opengraph-image.png`,
  cuando se parsea su cabecera,
  entonces es un PNG válido de **1200 × 630** exactos y **todos** sus píxeles son opacos
  (alfa 255): una tarjeta con transparencia se compone contra el fondo que decida cada
  plataforma, y entonces el contraste de CA-11 deja de ser el que se midió.

- **CA-8 (Los colores son los tokens de la marca, leídos de su fuente).**
  Dado `design/tremen-ds/colors_and_type.css`,
  cuando el test **extrae de ahí** `--bg` y `--accent` del bloque `.v-tremendo` y `--bone` de
  `:root`,
  entonces los colores presentes en el PNG son **exactamente esos tres** —permitiendo únicamente
  píxeles intermedios en el borde de las formas (antialiasing), que en ningún caso superan el
  **12 %** del total—; no hay ningún cuarto color, ni degradado, ni sombra.

- **CA-9 (No hay ni una letra, ni una fuente, ni nada de fuera).**
  Dado el generador de la imagen y el propio fichero,
  cuando se leen,
  entonces el generador **no importa ninguna librería de tipografía**, no lee ningún fichero de
  fuente (`.ttf`, `.otf`, `.woff*`), no contiene ningún `<text>` ni `font-family`, y **no
  contiene ninguna URL externa**; y las formas que dibuja provienen de
  `scripts/icon-geometry.mjs`, que es donde ya vive el trazado del wordmark. Es **D-1 y D-2**
  puestos como aserción.

- **CA-10 (La geometría cumple el contrato).**
  Dado el PNG decodificado,
  cuando se mide la caja envolvente de la tinta,
  entonces: su altura está entre **220 y 315 px**; su centro cae a **≤ 8 px** del centro del
  lienzo en los dos ejes; **toda** la tinta cae dentro del cuadrado central de 630 × 630 y a
  **≥ 60 px** de sus bordes; los píxeles de acento forman **una sola región conexa** cuyo
  centroide está a la **derecha** de la caja de la S y en su **mitad inferior**; y **ningún**
  píxel de acento es adyacente (8-vecindad) a uno de hueso — el punto y la letra siguen siendo
  dos cosas.

- **CA-11 (Contraste medido, sobre el propio lienzo).**
  Dados los tres colores,
  cuando se calcula el ratio de contraste WCAG contra el fondo,
  entonces el de la S es **≥ 15:1** y el del punto **≥ 6:1**.

- **CA-12 (Sobrevive al tamaño al que se ve de verdad).**
  Dado el PNG reducido a **240 × 126** —el orden de magnitud de una previsualización en un hilo—,
  entonces los píxeles de acento siguen siendo **≥ 6** y **una sola región conexa** separada de
  la S; y en la caja de la S existe **al menos una línea horizontal en su mitad superior y otra
  en su mitad inferior** con el patrón `hueso → fondo → hueso` y un tramo de fondo de **≥ 2 px**
  — los dos ojos de la letra siguen abiertos. Mismo requisito que SPEC-047 CA-12/CA-13, medido
  donde aquí duele.

- **CA-13 (Se reproduce desde fuente comprometida, sin dependencias y sin clave nueva).**
  Dado `scripts/build-icon.mjs` —**el que ya existe**, no uno nuevo (D-8)—,
  cuando se ejecuta con `--out` sobre un directorio temporal,
  entonces escribe **tres** ficheros y el PNG resultante es **byte a byte idéntico** al
  comprometido, igual que ya se exige de `icon.svg` y `favicon.ico`. Y sobre `package.json` tal
  y como queda en el árbol: `dependencies` y `devDependencies` tienen **exactamente** los mismos
  nombres que hoy, y `scripts` tiene **exactamente** las mismas claves —incluida `icon:build`,
  que ya estaba—. El codificador PNG se escribe sobre `node:zlib`, que es de la biblioteca
  estándar. Motivo: es literalmente la regla que SPEC-047 CA-17 fijó para el `.ico`, y por lo
  mismo — un binario comprometido sin forma de regenerarlo es un callejón sin salida el día que
  haya que mover algo medio píxel. Y `tests/icono-frontera.test.ts` (SPEC-047 CA-17) **sigue
  verde sin tocar ninguna aserción**: compara los bytes de sus dos ficheros, y que el generador
  escriba además un tercero no le quita ni le añade nada.

### Se alcanza sin sesión, y sin dejar rastro

- **CA-14 (Un rastreador anónimo recibe la imagen, no un desvío a `/login`).**
  Dado un contexto de navegador **sin sesión**,
  cuando se lee del HTML de `/` la URL que el framework emitió en `og:image` y se pide
  directamente,
  entonces la respuesta es **200** con `content-type: image/png`, **no** un 3xx a `/login` ni un
  `text/html`. La URL se **toma del documento** y no se teclea, porque la decide el framework.
  Se repite pidiéndola **sin cabecera `Accept` de navegador**, que es como la pide un rastreador.

- **CA-15 (Pedir la imagen no estampa ninguna cookie).**
  Dado el mismo contexto anónimo,
  cuando se pide la imagen,
  entonces la respuesta **no trae `Set-Cookie`** y el contexto sigue sin cookies. Y
  **SPEC-035 CA-13** (`tests/e2e/legal.spec.ts`, *«recorrer /legal anónimamente no fija ninguna
  cookie»*) **sigue verde y sin tocar una sola aserción**.

- **CA-16 (La imagen no sabe quién la pide: RN-01 y RN-03 intactos).**
  Dadas dos peticiones a la misma URL, una **con** sesión y otra **sin** ella,
  entonces los cuerpos son **byte a byte idénticos**; y el cambio en `src/proxy.ts` se limita a
  la **cadena del `matcher`** — `isPublicPath` y `PUBLIC_PREFIXES` (`src/lib/auth/guard.ts:42`)
  **no se tocan**, y las suites de `guard` y de `auth` siguen verdes sin modificar ninguna
  aserción. Motivo escrito, y es el mismo que SPEC-047 CA-8: la tarjeta es un estático idéntico
  para todo el mundo, sin un byte de dato de usuario, y su sitio es la exclusión del `matcher`
  —donde `favicon.ico` e `icon.svg` ya están— y no la lista de **páginas** públicas, que es la
  excepción documentada a RN-03.

### Las guardias ajenas y la no regresión

- **CA-17 (Las DOS guardias ajenas se amplían nombradas, autorizadas en el gate, y ninguna
  propiedad se debilita).**
  Dadas **exactamente** las dos guardias que este cambio mueve —y **solo** esas dos—,
  cuando se leen esos ficheros **tal y como quedan en el árbol** (condiciones 2, 3 y 4, que son
  propiedades del texto y las comprueba un test de esta spec) y el diff de la rama en el gate
  (condición 1, criterio de acotación que va al ledger, **ADR-031 pto. 1.2**),
  entonces se cumplen las cuatro condiciones siguientes:

  1. **Están nombradas, una a una, y son éstas —y son dos, no tres**:
     `tests/legal-rutas-publicas.test.ts:78` (**SPEC-035 CA-2**, *«el matcher sigue siendo el de
     siempre»*) y `tests/cuenta-rutas.test.ts:94` (**SPEC-036 CA-10**, la misma aserción
     calcada). **La tercera que SPEC-047 tuvo que ampliar —`tests/deploy-gate-workflow.test.ts`,
     la lista cerrada de claves de `scripts`— NO se toca**: desaparece por construcción, porque
     el humano eligió el 2026-08-23 que el generador cuelgue del `icon:build` que ya existe
     (**D-8**, **CA-13**). Si en la implementación apareciera una clave nueva en `scripts`, es
     **RED**: el camino barato ya estaba decidido.
  2. **Cada una lleva su porqué escrito al lado de la aserción**, en el propio fichero de test:
     qué vigilaba antes, qué vigila ahora y en virtud de qué CA entra el elemento nuevo (la ruta
     de la tarjeta, por **CA-14/CA-15**), con la fecha y el arbitraje del humano del
     **2026-08-23**. Es la condición literal que `FOUNDATION.md` exige a una guardia
     re-encuadrada.
  3. **Es una ampliación, no una aflojada.** El literal y la lista **crecen exactamente en el
     elemento declarado y siguen cerrados**: no se cambia una comparación exacta por una laxa, no
     se borra ningún caso, no se marca ninguno `.skip`, no se relaja ningún umbral. Comprobable
     pidiéndole al test que **siga fallando** con un cuarto elemento inventado.
  4. **Ninguna propiedad protegida se debilita.** Las dos hermanas que miden la propiedad de
     verdad siguen **verdes y sin tocar**: *«ninguna ruta concreta se cuela como excepción DENTRO
     del matcher»* (la propiedad es *«el matcher no conoce **rutas de producto**»*, y la tarjeta
     **es un activo**, de la misma familia que `_next/static`, `_next/image`, `favicon.ico` e
     `icon.svg`, que ya están en esa línea y por la misma razón) y *«ni `cuenta` ni
     `cuenta-borrada` aparecen dentro del literal»*. Y la regla que `deploy-gate-workflow` se
     escribió al ampliarse dos veces —*«la lista sigue cerrada: el siguiente que aparezca sin CA
     detrás vuelve a poner esto en rojo»*— **no se pone a prueba aquí**, porque esta spec no le
     añade ninguna clave (D-8).

  *Y la condición de proceso, que no es decorativa*: `FOUNDATION.md` exige que **quien toca una
  guardia no sea quien se beneficia de que pase**. Se ha cumplido en ese orden: la autorización
  se pidió **en el gate, por escrito y antes de implementar**, y **el humano la concedió el
  2026-08-23** (§Notas pto. 2), en vez de razonarse en el ledger a posteriori. **Un tercer
  fichero ajeno modificado sigue siendo RED**: se escala, que es lo que CA-18 manda.

- **CA-18 (Las suites enteras siguen verdes, y lo ajeno no se toca salvo lo que CA-17 nombra).**
  Dadas `npm test` y `npx playwright test` completas,
  entonces pasan. Y sobre `tests/`: la entrega **añade** ficheros y casos nuevos y **no modifica
  ninguna aserción existente**, con la **única** excepción de los **dos** ficheros que CA-17
  nombra. Esa segunda mitad **la comprueba el verificador en el gate y deja la salida en el
  ledger** —es criterio de acotación, y **ADR-031 pto. 1.2** dice dónde va—. Lo que sí vive en la
  suite es lo de arriba, con **cuatro** verdes citados por su nombre, porque son los que este
  cambio pone a prueba de verdad: **SPEC-035 CA-12** (ni un recurso de terceros en `/legal`), **SPEC-035 CA-13**
  (ninguna cookie al recorrer `/legal` anónimamente — el que cazaría el fallo del `matcher`) y
  **SPEC-031 CA-13.3** (las once claves de entorno) y **SPEC-047 CA-17**
  (`tests/icono-frontera.test.ts`: el generador sigue produciendo los bytes exactos de
  `icon.svg` y `favicon.ico` aunque ahora escriba además la tarjeta).

- **CA-19 (La primera pantalla sigue sin pedir nada fuera y sin tocar la base).**
  Dada `/` servida a un anónimo con la red interceptada en Playwright,
  entonces **todas** las peticiones que hace el navegador son del propio origen y **ninguna** es
  de la tarjeta (un `<meta>` no provoca descarga: la imagen la pide el rastreador, no el
  visitante). Y `tests/legal-import-graph.test.ts` y `tests/ayuda-import-graph.test.ts` siguen
  verdes: importar `src/lib/config/app-url.ts` desde `src/app/layout.tsx` **no** alcanza
  `src/db/` ni el cliente de base de datos, porque ese módulo no importa nada. Es **SPEC-039
  CA-14** y **SPEC-035 CA-14**, intactos.

- **CA-20 (El alcance está acotado, y no entra nada nuevo). Criterio de GATE, no de suite.**
  **No entra en `npm test`**, por lo mismo que CA-19 de SPEC-050 y por lo que dice **ADR-031
  pto. 1**: *«este cambio está bien acotado»* es criterio de gate, y escribirlo como
  `git diff … origin/main` reproduciría el molde caduco que SPEC-048 desmontó. Se verifica así:

  Dado el diff de la rama **con el árbol limpio** —lo comiteado, no el árbol de trabajo—,
  cuando **sdd-verificador** lo revisa en el gate y **pega la salida en el ledger**,
  entonces los ficheros tocados están **únicamente** dentro de este conjunto:
  `src/app/opengraph-image.png`, `src/app/opengraph-image.alt.txt`, `src/app/layout.tsx`,
  `src/app/page.tsx`, `src/proxy.ts`, `scripts/`, `tests/`, `docs/`, `_qa/SPEC-051/`,
  `package.json`. En particular **no** hay ni un fichero bajo `src/db/`, ni bajo `drizzle/`, ni
  bajo `src/lib/` — ni un dato, ni un cálculo, ni una regla de negocio (**CE-M1**). El cambio en
  `src/proxy.ts` afecta a **una sola línea**: la del `matcher`. En `package.json`, **solo** el
  valor de `version` que **ADR-024** exige: ninguna clave nueva en `scripts` (D-8, CA-13).
  `docs/adr/` **no gana ningún fichero** (**CE-M3**, y §Notas pto. 3). Y **ninguna otra carpeta
  `_qa/SPEC-NNN/`** aparece en el diff: las capturas de trabajo van a `test-results/SPEC-051/`
  (ignorado por git) y la evidencia comiteada a `_qa/SPEC-051/`.

## Entidades y reglas afectadas

- **Ninguna entidad de dominio.** No se toca `src/db/schema.ts`, no hay migración en `drizzle/`
  y **no hay término nuevo** para `docs/fundacion/dominio.md` (**ADR-025** no aplica: la tarjeta
  no introduce ningún rótulo de dominio).
- **RN-01** y **RN-03** (`docs/fundacion/reglas.md`): **por respeto, no por cambio**. La tarjeta
  es un estático sin dato de usuario; CA-16 lo prueba comparando bytes con y sin sesión y deja
  `PUBLIC_PREFIXES` —la excepción documentada a RN-03— sin tocar. **RI-01**: inaplicable, no hay
  migración.
- **ADR-015 pto. 8** (el origen absoluto sale de configuración y **nunca** de la cabecera `Host`):
  **se consume**, no se modifica. `appBaseUrl()` es exactamente esa decisión y esta spec la
  reutiliza para una segunda superficie en vez de inventar una paralela. Es el argumento central
  de por qué no hace falta ADR.
- **ADR-024** (semver al tocar `src/`): se respeta; CA-20.
- **SPEC-035 CA-2, CA-12, CA-13, CA-14** y **SPEC-036 CA-10**: fronteras de no regresión (CA-15,
  CA-17, CA-18, CA-19).
- **SPEC-031 CA-13.3** (las once claves de entorno): frontera de no regresión (CA-1) — y el
  motivo por el que D-4 rechaza una variable nueva.
- **SPEC-039 CA-14** (la primera pantalla no pide nada fuera): frontera de no regresión (CA-19).
- **SPEC-047** (`icon.svg` / `favicon.ico`, `scripts/icon-geometry.mjs`, la exclusión del
  `matcher`): esta spec **hereda** su geometría y su disciplina, y **no toca** ninguno de sus
  entregables. `tests/icono-frontera.test.ts` sigue verde sin tocarse.
- **Sin ADR nuevo** (**CE-M3**). Se ha mirado, y con lupa, si algo de aquí constriñe trabajo
  futuro: la única candidata era el origen absoluto de los metadatos, y **no lo es**, porque no
  se decide nada — se consume la decisión que **ADR-015 pto. 8** ya tomó y que `.env.example` ya
  declara. **Confirmado en el gate del 2026-08-23 por el humano** (Alberto Fojo), que verificó
  `appBaseUrl()` y el `toHaveLength(11)` por su cuenta: **no hay ADR, no hay clave nueva y la
  spec se queda en EPIC-MEJORA**. La alternativa —variable propia para los metadatos— habría
  traído ADR, clave nueva y, por **CE-M3**, el encaje fuera de esta épica; se preguntó antes y no
  después, y consta en §Notas pto. 3.

## Fuera de alcance

Con su razón y con qué lo reabriría.

- **El wordmark completo («Stockeiro») dentro de la imagen.** Es lo que más cuesta aparcar y por
  eso está el primero. Fuera porque los dos únicos caminos están cerrados: **con fuente** vuelve
  la trampa que SPEC-035 CA-12 y SPEC-047 D-2 ya cerraron (no hay Geist en el repositorio y
  `/legal` promete no salir fuera), y **trazando las letras** salen nueve glifos que no son
  Geist, es decir **tipografía nueva**, que la épica excluye por escrito. D-1 lo compensa
  poniendo el nombre en `og:title`, que **todas** las plataformas pintan junto a la imagen.
  *Lo reabre*: la decisión de que Stockeiro tenga un logotipo compuesto propio — y eso es un
  proyecto de identidad, con su épica, no una mejora.
- **Una tarjeta distinta por página** (`/ayuda`, `/legal`, o una por vigilada). No observada, y
  cada una es una composición más. Con D-5 todas heredan la global y cada una pone sus palabras
  (CA-3), que es donde está la diferencia útil. *Lo reabre*: que se empiece a compartir el enlace
  de una pantalla concreta y la tarjeta genérica estorbe.
- **Tarjeta generada al vuelo con `next/og` (`ImageResponse`).** Es la vía «moderna» y se ha
  descartado a propósito: exige alimentarle una fuente —y volvemos a la trampa 1— o aceptar la
  tipografía por defecto de la librería, que **no es la de la marca**. Además convierte un
  estático en una ruta que se ejecuta, justo cuando quien la pide es un rastreador anónimo.
  *Lo reabre*: querer tarjetas con texto variable (p. ej. por página), que es el único caso donde
  compensa.
- **`sitemap.xml`, `robots.txt` y `<link rel="canonical">`.** Parientes cercanos de
  `metadataBase` y **no observados**: son SEO, no vista previa, y nadie ha dicho que Stockeiro
  quiera ser indexado. Meterlos «ya que estamos» es exactamente cómo esta pieza crece sola.
  *Lo reabre*: la decisión de que la app se busque en Google.
- **Manifiesto PWA, `apple-touch-icon` y `theme-color`.** Siguen fuera por lo que ya escribió
  SPEC-047: no observados, otra superficie, y el manifiesto además es una promesa de
  instalabilidad que habría que sostener.
- **Limpiar el `matcher` de `src/proxy.ts`.** Sus alternativas no están ancladas ni escapadas
  (`favicon.ico` empareja el punto como comodín; `api` empareja cualquier ruta que empiece por
  esas letras). SPEC-047 ya lo vio y lo aparcó, y esta spec hace lo mismo y por el mismo motivo:
  **añade su exclusión con el mismo estilo que las cinco que ya están** y no arregla la línea de
  paso. Pero conviene decirlo en voz alta: **es la segunda vez que esa línea arrastra tests
  ajenos** —tres con SPEC-047, dos aquí, y las dos de aquí solo porque la tercera se esquivó
  cambiando el diseño (D-8), no porque la línea haya mejorado—. *Lo reabre*: **la tercera vez**,
  y entonces con ficha en EPIC-FIX y sin discusión: si añadir un activo estático cuesta tocar dos
  literales copiados a mano en dos specs ajenas, el defecto está en el literal.
- **Medir cómo se ve la tarjeta en cada plataforma real** (validador de Facebook, de X, del
  motor del foro). No se puede automatizar sin salir a la red desde CI, que es justo lo que este
  proyecto evita. Lo sustituye CA-12 (legibilidad al tamaño real de una previsualización) más la
  mirada humana en el gate del verificador. *Lo reabre*: una vista previa que en producción salga
  mal pese a los CA verdes.

## Riesgos

- **R-1 — La tarjeta se declara y el rastreador no la alcanza.** Es el riesgo principal y el
  fallo silencioso clásico: el `<meta>` está, el foro pide, el guardián redirige a `/login`, y la
  vista previa sale vacía **sin que nadie vea un error** — ni siquiera el que pegó el enlace.
  *Mitigación*: CA-14 pide la URL **real** emitida por el framework, con y sin cabeceras de
  navegador, y exige 200 con `image/png`; CA-15 y SPEC-035 CA-13 delatan la reincidencia por la
  vía de las cookies.
- **R-2 — `metadataBase` ausente en build y nadie se entera.** `appBaseUrl()` **lanza** si falta
  `APP_BASE_URL`, lo cual es lo correcto, pero cambia la conducta de `npm run build` en una
  máquina sin `.env`: donde antes construía, ahora fallará. Está comprobado que **CI sí la
  define** (`.github/workflows/ci.yml:148`, en el job que ejecuta `Build`) y que **producción
  también** (`docs/despliegue.md:55-56`). *Mitigación*: se acepta el fallo ruidoso como diseño
  —una tarjeta que apunta a `localhost` en producción es peor que un build rojo— y CA-4 lo mide
  en el despliegue. Si se prefiriera un `build` tolerante, eso **sí** sería una decisión nueva y
  va al gate, no al implementador.
- **R-3 — La herencia de `metadata` entre layout y página no hace lo que uno cree.** Un
  `openGraph` declarado en el layout puede **no** recoger el `title` que declara la página, y
  entonces todas las tarjetas dirían «Stockeiro» a secas. *Mitigación*: **CA-3 se mide sobre el
  HTML servido**, no sobre lo que el framework promete. Es una propiedad, no una foto: si una
  versión de Next cambia la regla de mezcla, el test lo dice.
- **R-4 — La tarjeta cumple los números y aun así es pobre.** Un lienzo plano con una marca
  centrada puede leerse como elegante o como vacío, y esa diferencia no la mide ningún CA.
  *Mitigación*: la captura entra en el gate del verificador y se mira (§Notas pto. 4). Si no
  convence, la salida legítima **no** es añadir un degradado o una frase pintada: es decirlo en
  el gate, porque cualquiera de las dos cosas es composición nueva y saca esto de la épica.
- **R-5 — El codificador PNG propio.** Escribir un PNG sobre `node:zlib` es sencillo pero tiene
  detalle (filtro por scanline, CRC de cada chunk) y un fichero mal formado puede abrirse en un
  visor y fallar en un rastreador. *Mitigación*: CA-7 parsea la cabecera y CA-8/CA-10/CA-12
  decodifican los píxeles, así que un PNG que no se pueda decodificar no pasa ningún CA. Si aun
  así resultara caro, la salida **no** es añadir una librería de imagen (CE-M3, CA-13): es
  llevarlo al gate.
- **R-6 — Es la segunda vez que se toca el `matcher` y vuelve a arrastrar guardias ajenas.** El
  patrón se repite y el riesgo es normalizarlo: a la tercera, «ampliar la guardia» deja de ser
  una excepción razonada y pasa a ser costumbre. *Mitigación en tres capas*: **(a)** la
  autorización es **previa** y nominal (CA-17), no un descubrimiento en verificación; **(b)** una
  de las tres guardias de SPEC-047 **se ha eliminado cambiando el diseño en vez de la aserción**
  (D-8: el generador cuelga de `icon:build`), que es el orden correcto y el que hay que intentar
  primero; y **(c)** §Fuera de alcance deja anotado que la tercera vez la línea del `matcher` se
  arregla en EPIC-FIX en vez de seguir parcheándose. Un tercer fichero ajeno modificado en esta
  entrega es RED.
- **R-7 — Sesiones en paralelo, y ya han mordido una vez.** Todo lo citado aquí se ha
  reverificado **dos veces**, la última contra `9387681`; los números de línea envejecen. El
  riesgo no es teórico: entre la primera redacción y el arbitraje, otra sesión **ocupó el id
  `SPEC-049`** y esta spec hubo que renumerarla de `SPEC-050` a `SPEC-051`. El punto de
  contacto probable es `src/proxy.ts` (una línea) y `src/app/layout.tsx`. **SPEC-050** corre en
  paralelo sobre `src/app/page.tsx` y `src/app/globals.css`: el solape con ésta es
  `src/app/page.tsx` si se toca su `metadata`. Quien implemente **rebasa contra `origin/main`
  antes de empezar**, y si las dos van a la vez, la segunda en llegar reconcilia.

## Notas para el gate humano

1. **Lo que decidí y lo que arbitraste tú.** Decido: una tarjeta **global** de 1200×630 con la
   marca que ya existe y **sin una sola letra pintada** (las palabras van en `og:title`, que
   todas las plataformas renderizan al lado); `twitter:card` grande reutilizando esa imagen;
   `metadataBase` desde `APP_BASE_URL`, sin variable nueva y **sin ADR**; y el fichero
   reproducible **por el `icon:build` que ya existe**, sin dependencias y sin clave nueva.
   **Arbitraste tú el 2026-08-23** los puntos 2 y 3, y elegiste además la vía barata sobre la que
   había duda; el texto está reescrito con esas decisiones dentro.

2. **RESUELTO por ti el 2026-08-23: autorizadas las guardias, y elegiste la vía que elimina una.**
   Queda el razonamiento porque es lo que hace auditable la autorización.
   Hacer que la tarjeta sea alcanzable por un rastreador anónimo obliga a excluirla del `matcher`
   de `src/proxy.ts`, exactamente donde `favicon.ico` e `icon.svg` ya están. Y eso mueve un
   literal que **tres tests ajenos tienen copiado carácter a carácter**:
   `tests/legal-rutas-publicas.test.ts:78` (SPEC-035 CA-2), `tests/cuenta-rutas.test.ts:94`
   (SPEC-036 CA-10) y, si el generador entra como clave de `npm run`,
   `tests/deploy-gate-workflow.test.ts:379-388` (SPEC-028 CA-9.3). **Son las mismas tres de
   SPEC-047**, y el razonamiento es el mismo: son fotos del árbol, cada una tiene una hermana que
   mide la propiedad de verdad, y las tres hermanas siguen verdes sin tocarlas. Está escrito como
   **CA-17**, con la exigencia de que cada ampliación lleve su porqué al lado de la aserción y la
   prohibición de aflojar nada. **Sin tu sí, quien implemente no toca esos ficheros: escala.**
   **Tu decisión:** autorizadas las dos del `matcher` —`tests/legal-rutas-publicas.test.ts:78` y
   `tests/cuenta-rutas.test.ts:94`—, y **elegiste explícitamente la alternativa barata** para la
   tercera: el generador **cuelga del `icon:build` que ya existe**, así que
   `tests/deploy-gate-workflow.test.ts` **no se toca en absoluto**. Está ejecutado en **D-8**,
   **CA-13** y **CA-17**, y de paso obliga a corregir la cabecera de `scripts/build-icon.mjs`,
   que hoy afirma escribir *«los dos ficheros del icono»* y pasan a ser tres.

   **Lo que me llevo de esa elección, y lo dejo escrito como precedente:** de las tres guardias
   que SPEC-047 tuvo que ampliar, aquí **una se ha eliminado sin tocarla, cambiando el diseño en
   vez de la aserción**. Ese es el orden correcto. Las dos que quedan son inevitables —el
   rastreador pide el recurso sin sesión y hay que dejarlo pasar—, y por eso §Fuera de alcance
   anota que esa línea del `matcher` ya va por su tercer arrastre y que a la próxima se arregla.

3. **RESUELTO por ti el 2026-08-23: aceptado `APP_BASE_URL` como origen de los metadatos.**
   Sin ADR, sin clave nueva, la lista de once intacta, y la spec se queda en EPIC-MEJORA. Dejo
   el razonamiento entero porque es lo que sostiene ese encaje. En
   SPEC-047 te dije que Open Graph «arrastra `metadataBase`, que es decisión de configuración, y
   por eso sale de esta épica por CE-M3». **Al escribir esto he ido a mirar y la decisión ya
   estaba tomada**: `APP_BASE_URL` existe desde SPEC-023, la declara `.env.example`, la congela
   `tests/spec-031-frontera.test.ts` entre once claves, vale `https://stockeiro.tremen.dev` en
   producción, y **ADR-015 pto. 8** ya dice que el origen absoluto sale de configuración y nunca
   de la petición. Consumirla no es decidir: es obedecer. Por eso **esta spec no lleva ADR y sí
   cabe en EPIC-MEJORA**. He rechazado por escrito las tres alternativas (variable nueva, derivar
   del dominio del aviso legal, derivar de `VERCEL_URL`) en §Diseño D-4. **Si no compartes el
   razonamiento lo compartiste**, y verificaste tú mismo `appBaseUrl()` y el
   `toHaveLength(11)` en `origin/main`. Queda escrito lo que habría pasado si no: ADR nuevo,
   clave nueva, lista cerrada de once rota, y por **CE-M3** esta spec **fuera de EPIC-MEJORA**,
   buscándole sitio (épica propia o EPIC-INFRA). Era la decisión que cambiaba el encaje entero, y
   por eso se preguntó antes y no después.
4. **La tarjeta que verás, dicha sin adornos, para que no te sorprenda.** Es el fondo oscuro de
   la app con **la S y el punto naranja en grande, centrados**, y nada más. No lleva la palabra
   «Stockeiro» dentro ni un reclamo pintado: eso lo pone el foro como texto, a partir de
   `og:title` y `og:description`. Lo he decidido así porque meter letras en el PNG solo se puede
   hacer con una fuente que no tenemos o dibujando letras que no son las nuestras — y cualquiera
   de las dos convierte esto en el proyecto de marca del que te avisé. **Pide la captura en el
   gate del verificador y mírala**: hay un salto entre «cumple los números» y «esto representa a
   mi producto en un hilo lleno de enlaces», y ese salto solo lo cierra tu ojo. Si no te gusta,
   el sitio de decirlo es ahí y no después.
5. **CE-M2, dicho de frente.** El roce **no está observado con un pantallazo**: no hay ninguna
   vista previa fea porque no hay vista previa. Lo que hay es la carencia verificada, la
   publicación ya hecha, y una condición de reapertura que escribí en SPEC-047 y que has
   activado. Me parece suficiente y por eso escribo la spec; pero es el punto más débil de su
   encaje en la épica y prefiero que lo sepas al aprobar.
6. **Lo que NO he tocado y quiero que veas que no.** `icon.svg` y `favicon.ico` de SPEC-047
   quedan intactos; `PUBLIC_PREFIXES` no crece; la primera pantalla sigue sin pedir nada fuera y
   sin tocar la base (CA-19); las once claves de entorno siguen siendo once (CA-1); y en el
   dibujo no hay ni un color, ni una forma, ni una tipografía que no estuvieran ya en el sistema.
7. **Sin ADR, sin migración, sin dependencia nueva y sin clave de entorno nueva** (CE-M3), y
   **sin tocar dato, cálculo ni regla** (CE-M1, acotado por CA-20). La versión sube por ADR-024
   al tocar `src/`; siendo presentación pura, **PATCH**, con el mismo criterio que SPEC-047.
8. **Estado: `borrador`.** No la apruebo yo. Los puntos 2 y 3 ya los arbitraste el 2026-08-23 y
   el texto está reescrito con esas decisiones dentro (D-8, CA-1, CA-13, CA-17, CA-20). El 4 y el
   5 siguen ahí para que apruebes sabiendo qué apruebas. Lo que queda es tu **aprobación formal**.

9. **Un cambio de numeración que debes conocer.** Esta spec nació como `SPEC-050` y ahora es
   `SPEC-051`: mientras se escribía, otra sesión mergeó en `origin/main` una **SPEC-049 propia**
   (EPIC-FIX, *el gate de versión no dice verde sobre un árbol sucio*), y al reasignar ids desde
   `origin/main` la spec de la primera pantalla pasó a `SPEC-050` y ésta a `SPEC-051`. Todas las
   citas se reverificaron contra `9387681` y siguen siendo exactas.

10. **Un CA que reescribí por mi cuenta al reverificar, y que deberías conocer.** El borrador
    escribía media docena de criterios como *«el diff contra `origin/main`»*. Al releer
    `origin/main` encontré que **ADR-031 pto. 2.1** —que trajo SPEC-048, precisamente porque ese
    molde ya se puso verde por vacuidad una vez— **prohíbe** que `origin/main`, `main` o `HEAD`
    alimenten una aserción. Reencuadrados: lo que se puede decir como propiedad del árbol se dice
    así (CA-1, CA-6, CA-13), y lo que no —«el cambio está acotado»— **sale de la suite** y lo
    verifica el verificador en el gate, con la salida en el ledger (CA-20). No cambia lo que se
    exige; cambia dónde vive, y hace que no caduque al mergear.
