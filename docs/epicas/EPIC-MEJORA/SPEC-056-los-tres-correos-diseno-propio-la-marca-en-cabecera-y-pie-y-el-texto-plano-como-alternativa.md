---
id: SPEC-056
tipo: spec
epica: EPIC-MEJORA
estado: en-progreso
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-25, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-24, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-24, por: sdd-implementador}
---
# SPEC-056 — Los tres correos: diseño propio, la marca en cabecera y pie, y el texto plano como alternativa

## Problema

**Los tres correos que Stockeiro envía son texto plano puro.** No es una figura retórica:
verificado contra `origin/main` (`825046f`) antes de escribir esto, en los tres cuerpos no hay
**ni una sola etiqueta HTML**, ni un color, ni la marca. Esto es literalmente lo que le llega hoy
a un usuario cuando una acción suya entra en zona:

```
Asunto: ITX entró en tu zona de compra
ITX a 45.20 entró en tu zona de compra (asOf 2026-08-24).
```

Y esto cuando siguen dentro (`src/lib/notifications/service.ts:139`):

```
Asunto: Resumen: 3 acción(es) en zona
Siguen en zona: ITX (compra), SAN (venta), TEF (compra). (asOf 2026-08-24)
```

Y esto cuando alguien pierde la contraseña (`src/lib/auth/password-reset.ts:46`, seis líneas de
texto con la URL suelta en medio).

Técnicamente están bien: dicen lo que tienen que decir, llevan su `asOf` (D-2) y el enlace de reset
funciona. El problema no es que fallen — **es que no parecen de nadie**.

**Dónde se observó** (CE-M2, y aquí no hay especulación): lo pidió el humano el **2026-08-25**, con
un motivo que no es estético sino de negocio, y lo escribió así:

> «Me gustaría mejorar las plantillas de correo electrónico que se envían para tener un diseño más
> actual y para que mencione a tremen.dev, la empresa paraguas de stockeiro. El motivo es que me
> interesa que los receptores de correo tengan a tremen.dev presente cuando les llega una buena
> noticia (una acción entra en zona).»

Ese motivo merece leerse dos veces, porque es el que ordena todo lo demás. **El correo de entrada en
zona es el único artefacto de este producto que llega a alguien sin que lo haya pedido, y llega en un
buen momento.** La app se ve cuando el usuario decide entrar; el correo aparece solo, y aparece justo
cuando algo que el usuario esperaba ha ocurrido. Ese es el instante en que una marca se recuerda —y
hoy ese instante lo ocupa una línea de texto sin firma.

Hay además un desajuste ya presente, no futuro. La app **sí** tiene identidad y **sí** lleva la marca:
`src/app/app-footer.tsx:103` pinta «Stockeiro, un proyecto de tremen.dev» con enlace en el pie de
**todas** las páginas, incluidas las públicas; SPEC-050 la puso en la primera pantalla y SPEC-051 en
la tarjeta que el foro ve antes de entrar. Hay wordmark (`Stockeiro` + un punto de acento,
`src/app/app-nav.tsx:45`), hay paleta (`.v-tremendo` en `design/tremen-ds/colors_and_type.css`) y hay
un icono propio (SPEC-047). **Todo eso se detiene en el borde del navegador.** El correo es la única
superficie del producto que sigue sin firmar, y es —memoria del proyecto— la que va a llegarle a
gente de un foro de bolsa junto a una app que se ha cuidado en todo lo demás.

Lo que esta spec **no** arregla, para que quede claro desde el primer párrafo: no cambia qué se
notifica, ni a quién, ni cuándo, ni cuántas veces. RN-13, RN-14 y RN-15 se quedan exactamente donde
están. Cambia **cómo se ve** lo que ya se envía — que es la definición de mejora de esta épica
(CE-M1).

## Usuarios / roles afectados

- **El usuario que recibe la buena noticia.** Es el destinatario de la spec: abre el correo en su
  cliente —Gmail en el móvil, Outlook en el trabajo, Apple Mail—, y lo hace en un contexto que no
  controlamos y que no es un navegador moderno. Si el correo llega roto, llega peor que hoy: hoy al
  menos el texto plano se lee siempre.
- **El usuario que ha perdido la contraseña.** Es el caso **crítico** y el que impone las
  restricciones más duras. Está bloqueado fuera de su cuenta, con prisa y con desconfianza, y lo
  único que necesita del correo es **el enlace**. Cualquier diseño que entorpezca ese enlace —o que
  lo esconda tras un botón que su cliente no pinta— convierte una mejora en una avería de acceso.
- **Quien mira el correo sin poder ver HTML**: lector de pantalla, cliente en modo texto, vista
  previa del reloj, filtro corporativo que entrega solo la parte de texto. Para esa persona el correo
  de hoy funciona perfectamente, y esta spec tiene la obligación de que **siga funcionando igual**.
- **El humano que publica** (tremen.dev): es quien quiere la marca presente en el momento bueno, y
  quien pierde si el correo llega roto — un correo mal pintado firma peor que uno sin firmar.
- **Quien implemente esto**: hereda una frontera que se mueve (**ADR-036**) y tres emisores que la
  cruzan. Y hereda una advertencia: hay **guardias ajenas leyendo el texto plano** de estos correos
  (§Riesgos, R-2). No se tocan.

## Diseño

Once decisiones. Las tres primeras son las que impiden que esto se convierta en un proyecto de
diseño gráfico; las tres siguientes son las que impiden que se convierta en una avería; la última
(D-11) es la que llegó del gate y la que se lee antes de que el correo se abra.

- **D-1 — Un solo marco, tres cuerpos.** Los tres correos comparten **la misma** cabecera y **el
  mismo** pie, compuestos por una única función de marco; lo propio de cada correo es solo lo que va
  en medio. Motivo: la marca tiene que verse igual en los tres, y tres copias del mismo bloque son
  tres sitios donde diverger. El módulo vive en `src/lib/notifications/templates/`, es **puro** —sin
  base de datos, sin Next, sin sesión— y devuelve `{ subject, text, html }` (ADR-036 pto. 4).

- **D-2 — La marca es TEXTO, nunca una imagen.** El wordmark del correo es la palabra `Stockeiro`
  seguida de un punto en el color de acento, que es literalmente el marcado que ya existe en
  `src/app/app-nav.tsx:45`. **No hay logotipo, no hay `<img>`, no hay ningún fichero.** Y el motivo
  es exactamente el objetivo del humano puesto del revés: la mayoría de clientes de correo **bloquean
  las imágenes por defecto**, así que una marca en imagen es una marca que, en la primera lectura y
  para mucha gente, **es un hueco en blanco**. Poner la marca en un recurso que el cliente decide no
  descargar es no ponerla. Esto es la contrapartida coherente de SPEC-051 D-1: allí las palabras
  salieron del PNG porque el texto se renderiza siempre; aquí, por lo mismo, no entra ningún PNG.

- **D-3 — Cabecera Y pie, y esta es decisión del humano, con su razón.** Arbitrado por el humano
  (Alberto Fojo) el **2026-08-25**: *en una buena noticia el ojo se queda arriba, y un pie solo lo lee
  quien baja hasta el final*. Así que la **cabecera** lleva `Stockeiro` con `tremen.dev` al lado, y el
  **pie** repite la fórmula que la app ya usa, «Stockeiro, un proyecto de tremen.dev», con
  `tremen.dev` enlazado. Se descartó explícitamente el pie con reclamo comercial («¿tienes un proyecto
  entre manos?»): lo que se quiere es **presencia de marca, no publicidad dentro de un correo
  transaccional**. Un correo de recuperación de contraseña que intenta vender servicios es un correo
  que se marca como spam, y llevarse el dominio a la lista negra costaría los avisos de todo el mundo.

- **D-4 — El literal de marca y su URL se leen de `MARCA`, no se teclean.** `MARCA` vive en
  `src/lib/legal/content.ts:48` (`nombre`, `url`, `linea`) y ya la consumen el pie de la app y
  `/legal/aviso-legal`. El correo se suma a esa lista de lectores (ADR-036 pto. 5). Dos literales
  acaban siendo dos marcas distintas, y la copia que se quede vieja saldrá justo por la superficie
  que **no admite corrección después de enviada**.

- **D-5 — El correo se escribe en el subconjunto que sobrevive a Outlook, y eso se mide.** «Diseño
  actual» no es un adjetivo aquí: es una lista cerrada de propiedades comprobables (CA-7 a CA-12).
  Concretamente: **maquetación con tablas** anidadas marcadas `role="presentation"` —el motor de
  Outlook es el de Word y no sabe de flex ni de grid—, **todo el estilo en línea** en atributos
  `style` —Gmail poda las hojas del `<head>`—, **contenedor de 600 px** centrado sobre un fondo a
  sangre, **fluido por debajo** de ese ancho, y `color-scheme` declarado para que el modo oscuro del
  cliente no invierta un diseño que **ya es oscuro**. Lo que queda prohibido: `<script>`, `<iframe>`,
  `<form>`, atributos `on*`, `position`, `float`, `display:flex`, `display:grid`.

- **D-6 — El texto plano no se degrada ni un carácter, y el enlace de reset sigue siendo el primero.**
  El HTML **se añade**; el texto **no se sustituye** (ADR-036 pto. 2). En el correo de recuperación
  eso tiene una consecuencia literal y no negociable: **la línea de marca del pie va al final, después
  del enlace**, porque `tests/password-reset.test.ts:163` toma **la primera** URL absoluta del cuerpo
  y afirma que es el enlace de reset. Colocar `https://tremen.dev` por delante pondría en rojo una
  guardia que hoy protege algo serio —que el correo no lleve al usuario a un host ajeno (CA-4 de
  SPEC-023, ADR-015 pto. 8)—, y la reacción refleja sería aflojarla. FOUNDATION lo tiene escrito:
  aflojar la comprobación hasta que pase no es una de las dos salidas legítimas. **Aquí no hace falta
  ninguna: basta con poner la marca donde ya iba a ir.**

- **D-7 — Cero terceros y cero telemetría.** Ninguna plantilla referencia un recurso externo: sin
  `<img>`, sin `<link>`, sin `@import`, sin `url(...)`, sin tipografía remota y **sin píxel de
  seguimiento**. Toda URL absoluta del HTML es un `href` que el lector decide pinchar. Es la misma
  promesa que SPEC-035 CA-12 hizo para la web y que `tests/legal-sin-terceros.test.ts` ya vigila; aquí
  además evita que la app espíe cuándo alguien abre su correo, que es algo que este producto no ha
  prometido hacer y no va a empezar por la puerta de atrás.

- **D-8 — La tipografía es una pila del sistema, y se acepta que no sea Geist.** La app usa Geist,
  servida desde el propio origen por `next/font` (SPEC-035 CA-12 retiró el `@import` a Google). En
  correo **no hay forma honesta de tener Geist**: exigiría pedir la fuente a un host, que es
  justamente lo que D-7 prohíbe. Así que el correo declara la misma **cadena de reserva** que ya está
  escrita en `--font-sans` (`ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', sans-serif`),
  sin la primera familia. Se pierde la letra exacta; se gana que el correo no pida nada. Es el
  intercambio correcto y queda escrito para que nadie lo «arregle» más adelante.

- **D-9 — El correo se anuncia antes de abrirse: preheader derivado, no inventado.** El bloque de
  texto oculto que los clientes enseñan en la bandeja junto al asunto **no se rellena con copy nuevo**:
  es **la primera línea del cuerpo de texto**, la misma que el correo ya dice. Así el correo aprovecha
  una superficie que hoy desperdicia (sin preheader, el cliente rellena ese hueco con lo primero que
  encuentre en el HTML, que suele ser basura de maquetación) **sin inventar ni una palabra** — que es
  la frontera de CE-M1.

- **D-10 — Los asuntos no se tocan, y el registro in-app tampoco.** Los tres `subject` quedan
  **byte-idénticos** a los de hoy (CA-16): el humano pidió diseño y marca, no copy nuevo, y el asunto
  es lo que la gente ya reconoce en su bandeja. Y `notifications.payload` —lo que alimenta el historial
  in-app de SPEC-007— **sigue siendo texto**, con el mismo formato exacto, sin ninguna etiqueta y sin
  migración de esquema (ADR-036 pto. 7). El correo y el aviso in-app son dos presentaciones del mismo
  hecho para dos lectores distintos; esta spec toca **una**.

- **D-11 — El remitente: `stockeiro@tremen.dev`, y el nombre visible lleva la marca.** Resuelto en el
  gate por el humano (Alberto Fojo) el **2026-08-25**: la **dirección** la fijó él; el **nombre
  visible** lo decide esta spec. Y lo decide así: el valor de referencia pasa a ser

  ```
  "Stockeiro - tremen.dev" <stockeiro@tremen.dev>
  ```

  Cinco razones, porque cada pieza de esa cadena está elegida:

  1. **La marca va en el nombre, no solo en la dirección, porque en el móvil la dirección no se ve.**
     La lista de la bandeja en Gmail, Apple Mail y Outlook móvil enseña **únicamente el nombre
     visible**; la dirección queda plegada hasta que alguien abre el mensaje y la despliega. Dejar
     `tremen.dev` solo en la dirección sería ponerlo justo donde el destinatario **no** mira en el
     momento que le importa al humano — el mismo error de razonamiento que D-2 evita con las
     imágenes.
  2. **Corto a propósito: 22 caracteres.** Los clientes móviles truncan el nombre del remitente
     alrededor de los 25. Por eso el nombre visible **no** es `MARCA.linea` («Stockeiro, un proyecto
     de tremen.dev», 38 caracteres) pese a ser la fórmula de la casa: se cortaría por la mitad y lo
     que quedaría fuera sería precisamente `tremen.dev`. Una fórmula que se trunca donde importa es
     peor que una abreviada a propósito.
  3. **ASCII puro, y por eso un guion y no el `·` de la app.** El separador de la app es ` · `
     (`SEPARADOR`, `src/lib/version/presentation.ts:47`), pero U+00B7 en una cabecera de correo exige
     codificación *encoded-word* (RFC 2047) y un cliente que la deshaga; el guion no exige nada. Es
     exactamente el mismo intercambio que D-8: **el medio manda**, y el correo no es la app.
  4. **Entre comillas, y no por adorno.** `tremen.dev` lleva un punto, y el punto no es `atext` en un
     `display-name` sin comillas (RFC 5322 §3.4): sin ellas se depende de que el receptor tolere
     sintaxis obsoleta. Con ellas no se depende de nada.
  5. **La dirección NO se deriva de `MARCA`, aunque hoy coincidan.** `MARCA.nombre` vale `tremen.dev`
     y sería tentador componer la dirección con él; sería un error. El dominio de envío es
     **configuración de despliegue** —lo que está verificado en Resend (`docs/despliegue.md:54`)—, no
     una etiqueta de marca. Atar uno a otro haría que retocar el rótulo cambiase en silencio desde
     dónde se manda el correo. Es el mismo motivo por el que **SPEC-051 D-4** se negó a derivar
     `metadataBase` de `TITULAR.dominio`. Lo que sí se comprueba contra `MARCA.nombre` es que el
     **nombre visible** lo contenga (CA-19).

  **Y una frontera que hay que decir en voz alta**: esta spec cambia el **valor por defecto del
  código** y **los dos ficheros que lo documentan**. **No** cambia `RESEND_FROM` en el entorno de
  Production de Vercel — eso no es código, es una acción de despliegue del humano, y va como
  **F-SPEC-056-4**. Mientras esa acción no se haga, el remitente real seguirá siendo el que hoy haya
  configurado. Que nadie cierre esta spec creyendo que el remitente ya cambió en producción.

### La paleta y la geometría del correo

La paleta **no se inventa**: es la de `.v-tremendo`, leída de `design/tremen-ds/colors_and_type.css`,
que es la misma fuente que ya usan `tests/tarjeta-imagen.test.ts` (SPEC-051) y `tests/icono-fichero.test.ts`
(SPEC-047) para derivar lo que esperan. En correo hay que escribir los valores literales —las
variables CSS no sobreviven a la mayoría de clientes—, y por eso CA-11 exige que **cada literal de
color del HTML pertenezca al conjunto derivado del fichero de tokens**: el día que la marca cambie de
naranja, el test se pondrá rojo y dirá dónde.

| Elemento | Token de origen | Valor hoy | Uso en el correo |
|---|---|---|---|
| Lienzo / fondo a sangre | `--bg` de `.v-tremendo` | `#111110` | fondo de la tabla exterior, al 100 % de ancho |
| Tarjeta | `--bg-elev` de `.v-tremendo` | `#1A1815` | contenedor de 600 px |
| Texto principal | `--bone` de `:root` | `#F5F1EA` | cuerpo, wordmark |
| Acento | `--accent` de `.v-tremendo` (→ `--ember`) | `#FF6B00` | el punto del wordmark, el botón, los datos destacados |
| Texto secundario | `--fg-muted` de `.v-tremendo` | `rgba(245,241,234,0.66)` | pie, `asOf`, letra pequeña |
| Filete | `--line` de `.v-tremendo` | `#2A2620` | separación entre cabecera, cuerpo y pie |

| Medida | Valor | Motivo |
|---|---|---|
| Ancho del contenedor | **600 px** máximo | el ancho estándar que cabe en el panel de lectura de Outlook sin scroll horizontal |
| Ancho de la tabla exterior | **100 %** | el fondo tiene que llegar al borde, o el correo flota sobre el blanco del cliente |
| Margen interior | **≥ 24 px** | a menos, el texto toca el borde en móvil |
| Cuerpo de texto | **≥ 16 px** | por debajo, iOS reescala el correo entero y descuadra la maquetación |
| Área táctil del botón | **≥ 44 × 44 px** | el mismo suelo que ADR-034 fijó para la app en el teléfono |

**Contraste**, calculado sobre el propio lienzo (los mismos números que SPEC-051 verificó): hueso
sobre `#111110` ≈ **16,8:1**; ember sobre `#111110` ≈ **6,6:1**; el secundario compuesto al 66 %
sobre `#111110` ≈ **8:1**. Los umbrales de CA-12 son **≥ 15:1**, **≥ 6:1** y **≥ 4,5:1**, con la
misma holgura deliberada que SPEC-047 CA-11 y SPEC-051 CA-11.

## Criterios de aceptación

Cada CA es verificable con un test, y **todos** salvo CA-17 y CA-18 corren en **Vitest sin base de
datos y sin navegador**: la plantilla es una función pura que devuelve `string`, así que «lleva la marca»,
«no pide recursos fuera» o «no usa flex» son aserciones sobre texto. Esa es la ganancia de haber
puesto la plantilla sobre el puerto (ADR-036 pto. 4) y no dentro del adaptador.

Tres CA fijan **propiedades y no fotos del árbol** (tercera convención de `FOUNDATION.md`): CA-11
deriva la paleta esperada leyendo `design/tremen-ds/colors_and_type.css` en cada ejecución, CA-6
deriva el literal de marca de `MARCA` en vez de teclearlo, y CA-20 compara **entre sí** el código,
el ejemplo y la guía de despliegue en vez de congelar un número de línea. Ninguno de los tres
caduca al mergear.

**Evidencia visual** (acordada con el humano en el gate del 2026-08-25, y escrita aquí para que el
verificador no la tenga que adivinar): un correo no se pantalla con Playwright como una página, así
que la entrega incluye los **tres HTML generados** con datos de muestra en `_qa/SPEC-056/`
(`entrada.html`, `resumen.html`, `recuperacion.html`), y el verificador los abre en un navegador y
captura los tres **más una a 360 px de ancho** para comprobar el comportamiento del contenedor de
600 px. Queda dicho lo que esa evidencia **no** prueba: cómo se ve en Outlook. Eso solo lo cierra
F-SPEC-056-1.

### La frontera: el puerto y quién compone

- **CA-1 (El mensaje admite dos cuerpos, y el de texto sigue siendo obligatorio).**
  Dado `src/lib/notifications/sender.ts`,
  cuando se mira `NotificationMessage`,
  entonces tiene `body: string` **obligatorio** y `html?: string` **opcional**; y los **tres**
  implementadores del puerto —`FakeNotificationSender`, `OutboxFileSender`, `ResendSender`— siguen
  satisfaciendo `NotificationSender` con `npm run typecheck` en verde **sin que ninguno de los tres
  cambie de conducta**: el fake sigue guardando el mensaje entero y el de buzón sigue escribiendo una
  línea JSON por mensaje.

- **CA-2 (El adaptador manda las dos partes cuando hay dos, y solo el texto cuando hay una).**
  Dado un `ResendSender` construido con un `fetchImpl` de prueba y una key ficticia —lo que su
  constructor ya permite hoy—,
  cuando se le pasa un mensaje **con** `html` y otro **sin** `html`,
  entonces el JSON de la primera petición lleva `text` **y** `html`, con exactamente los valores del
  mensaje; y el de la segunda lleva `text` y **no contiene la clave `html`**. Ninguna de las dos
  llamadas sale a la red.

- **CA-3 (La plantilla es pura y vive sobre el puerto).**
  Dado el grafo transitivo de imports de `src/lib/notifications/templates/`,
  cuando se recorre con el mismo caminante que ya usa `tests/legal-import-graph.test.ts`,
  entonces **no alcanza** `@/db`, ni `drizzle-orm`, ni `next`, ni `next-auth`, ni ningún adaptador del
  puerto; y **ningún adaptador** (`resend-sender.ts`, `fake-sender.ts`, `outbox-file-sender.ts`)
  importa el módulo de plantillas. La dependencia va en un solo sentido.

### La marca: dónde está y de dónde sale

- **CA-4 (Los tres correos llevan la marca arriba, antes de nada).**
  Dados los HTML de los **tres** correos —entrada en zona, resumen de permanencia y recuperación—,
  cuando se busca el bloque de cabecera,
  entonces cada uno contiene la palabra **`Stockeiro`** y el valor de **`MARCA.nombre`**, con
  `MARCA.url` como `href`; y la posición de ese bloque en el documento es **anterior** a la del
  contenido propio del correo (el ticker, la lista o el enlace de reset, según el caso).

- **CA-5 (Los tres llevan el pie con la fórmula exacta de la app).**
  Dados los mismos tres HTML,
  cuando se busca el bloque de pie,
  entonces cada uno contiene el valor de **`MARCA.linea`** —hoy «Stockeiro, un proyecto de
  tremen.dev»— con `MARCA.url` como `href`, y ese bloque está **después** del contenido propio. Y el
  texto plano de los tres termina con esa misma línea.

- **CA-6 (Una sola fuente: nada de la marca está tecleado).**
  Dado todo `src/lib/notifications/` y `src/lib/auth/password-reset.ts`,
  cuando se buscan los literales `tremen.dev`, `https://tremen.dev` y «un proyecto de»,
  entonces **no aparece ninguno escrito a mano**: los tres salen de `MARCA` (`src/lib/legal/content.ts`).
  Y el bloque de cabecera y el de pie están escritos **una sola vez** en el módulo de plantillas — los
  tres correos los obtienen de la misma función de marco, no de tres copias.

### El correo es correo: lo que tiene que sobrevivir al cliente

- **CA-7 (El documento se declara y se anuncia).**
  Dados los tres HTML,
  cuando se leen sus primeros elementos,
  entonces cada uno empieza por `<!DOCTYPE html>`, declara `<html lang="es">`, un
  `<meta charset="utf-8">`, un `<meta name="viewport">`, un `<title>` no vacío, y
  `color-scheme` / `supported-color-schemes` con `dark light` — sin esto último, el modo oscuro de
  Apple Mail y Outlook **invierte** un diseño que ya es oscuro y lo deja ilegible. Y cada uno lleva un
  **preheader**: un bloque de texto oculto cuyo contenido es **exactamente la primera línea del cuerpo
  de texto** del mismo correo (D-9), colocado antes de cualquier otro texto visible.

- **CA-8 (Maquetado como se maqueta el correo, no como se maqueta la web).**
  Dados los tres HTML,
  cuando se inspecciona su estructura,
  entonces la maquetación es **por tablas**: cada `<table>` presente lleva `role="presentation"`, la
  exterior declara `width="100%"` y pinta el fondo a sangre, y el contenedor interior declara un ancho
  máximo de **600 px**. Todo el estilo va **en línea** (atributos `style`); si existe algún `<style>`
  en el `<head>`, **todas** sus reglas están dentro de un `@media` — nada de estilo esencial en un
  bloque que Gmail poda.

- **CA-9 (Nada que el cliente tire, y nada que el cliente ejecute).**
  Dados los tres HTML,
  cuando se buscan construcciones prohibidas,
  entonces **no aparece ninguna** de: `<script`, `<iframe`, `<form`, `<object`, `<embed`, un atributo
  `on*=`, `position:`, `float:`, `display:flex`, `display:grid`, `@import`, `<link`. La lista es
  cerrada y el test la enumera; añadir una construcción a las plantillas obliga a mirar esta lista.

- **CA-10 (Cero terceros: toda URL absoluta es algo que el lector pincha).**
  Dados los tres HTML,
  cuando se extraen **todas** las apariciones de `http://` y `https://`,
  entonces **cada una** es el valor de un atributo `href`; **ninguna** aparece en un `src`, un
  `background`, un `url(...)` ni en ningún otro atributo o declaración de estilo. Y no hay **ni un
  solo** `<img>` en ninguno de los tres. Corolario que el test afirma explícitamente: no hay píxel de
  seguimiento.

- **CA-11 (Los colores son los de la app, leídos de su fuente en cada ejecución).**
  Dado `design/tremen-ds/colors_and_type.css`,
  cuando se derivan de él `--bg`, `--bg-elev`, `--bone`, `--accent`, `--fg-muted` y `--line`
  resolviendo los alias `var(...)` —la misma lectura que hace `tests/tarjeta-imagen.test.ts`—,
  entonces **todo** literal de color que aparezca en los tres HTML pertenece a ese conjunto. Ni un
  séptimo color, ni un degradado, ni una sombra.

- **CA-12 (El contraste se mide, no se supone).**
  Dados los pares de color que las plantillas usan,
  cuando se calcula la razón de contraste WCAG 2.x sobre el fondo correspondiente,
  entonces el texto principal sobre el lienzo está **≥ 15:1**, el acento sobre el lienzo **≥ 6:1** y
  el texto secundario sobre el lienzo **≥ 4,5:1**.

### El texto plano: sigue siendo un correo completo

- **CA-13 (Los dos cuerpos existen y el de texto no tiene ni una etiqueta).**
  Dados los tres mensajes tal y como cruzan el puerto,
  cuando se miran `body` y `html`,
  entonces los dos son cadenas no vacías; y `body` **no contiene ninguna etiqueta HTML** (ninguna
  aparición de `<` seguido de letra o de `/`), ni entidades HTML sin resolver (`&amp;`, `&nbsp;`), ni
  la frase «si no ves bien este correo».

- **CA-14 (Los dos cuerpos dicen lo mismo).**
  Dados los tres correos compuestos con datos de muestra distinguibles,
  cuando se comparan sus dos cuerpos,
  entonces **cada dato variable aparece en los dos**: el ticker, el precio, el tipo de zona y el
  `asOf` en el de entrada; los tickers y sus zonas, el recuento y el `asOf` en el resumen; la URL de
  reset y el plazo de caducidad en el de recuperación. El test los enumera y falla si un dato está en
  uno y no en el otro — que es exactamente el modo en que dos cuerpos divergen (ADR-036, negativas).

- **CA-15 (El enlace de reset sigue siendo lo primero en el texto, y visible en el HTML).**
  Dado el correo de recuperación,
  cuando se busca en su `body` la **primera** URL absoluta,
  entonces es **el enlace de reset**, completo y desnudo (sin corchetes, sin acortar y sin envolver);
  ninguna URL de marca aparece antes que él. Y en el `html`, esa misma URL aparece **dos veces**: como
  `href` del botón de acción **y** como texto visible copiable, para quien no puede pinchar o cuyo
  cliente elimina el botón.

### Cero regresión: lo que no puede moverse

- **CA-16 (Los asuntos son byte-idénticos a los de hoy).**
  Dados los tres correos,
  cuando se leen sus `subject`,
  entonces son exactamente `${ticker} entró en tu zona de ${zona}`, `Resumen: ${n} acción(es) en zona`
  y `Recupera tu contraseña de Stockeiro`. Ni una coma nueva, ni marca en el asunto.

- **CA-17 (El registro in-app sigue siendo texto, y no hay migración).**
  Dado un ciclo de `notifyCycle` sobre la base de test,
  cuando se leen las filas de `notifications` que escribe,
  entonces su `payload` conserva **exactamente** el formato de hoy —`ITX en zona de compra @ 45.20` y
  `Permanencia en zona: …`— y no contiene ninguna etiqueta HTML; la tabla `notifications` **no gana
  ninguna columna**; y el directorio `drizzle/` **no gana ningún fichero** de migración.

- **CA-18 (Nada de lo que ya funcionaba se ha aflojado).**
  Dado el árbol tal y como queda,
  cuando se ejecutan `npm run typecheck`, `npm run lint`, `npm test` y el e2e completo,
  entonces todo está en verde —incluidos `tests/notifications-service.test.ts`,
  `tests/notifications-cycle.test.ts`, `tests/notifications-read.test.ts`, `tests/password-reset.test.ts`,
  `tests/session-epoch.test.ts`, `tests/watchlist-service.test.ts` y `tests/e2e/recuperacion.spec.ts`—
  y **ninguna aserción existente sobre `body` ha sido modificada, relajada ni borrada**. El diff sobre
  los ficheros de test que ya existían **solo puede añadir**. Si alguna guardia se pone roja, se
  declara en el ledger y va al gate: no se ablanda en silencio (FOUNDATION, tercera convención).

### El remitente: lo que se lee antes de abrir nada

- **CA-19 (El remitente por defecto del código deja de apuntar a un dominio que no es nuestro).**
  Dado `src/lib/notifications/resend-sender.ts`,
  cuando se lee el valor **por defecto** de `from` —el que se usa cuando `RESEND_FROM` no está
  definida, hoy `'Stockeiro <avisos@stockeiro.app>'`—,
  entonces es exactamente `"Stockeiro - tremen.dev" <stockeiro@tremen.dev>`; su dominio es
  **`tremen.dev`**, que es el verificado en Resend (`docs/despliegue.md:54`), y **no** `stockeiro.app`;
  su **nombre visible** contiene `Stockeiro` y el valor de **`MARCA.nombre`**, es **ASCII puro** (ni un
  byte ≥ 0x80) y mide **≤ 25 caracteres**; y va **entre comillas** (D-11, razones 3 y 4). En todo
  `src/` no queda ningún remitente que cite `stockeiro.app`.

- **CA-20 (El código, el ejemplo y la guía de despliegue dicen los tres lo mismo — y `.env.example` no
  cambia de tamaño).**
  Dados `src/lib/notifications/resend-sender.ts`, `.env.example` y la §7 de `docs/despliegue.md`,
  cuando se extrae de cada uno el remitente que propone,
  entonces los tres son **el mismo valor, byte a byte** —comparados entre sí, no contra un literal
  escrito en el test—; ninguno de los tres cita `stockeiro.app` como dominio de envío ni como ejemplo
  de dominio a verificar; y `.env.example` sigue declarando **exactamente once** claves, con
  `tests/spec-031-frontera.test.ts` (`toHaveLength(11)`) **verde y sin tocar ninguna aserción**.

  Lo que este CA acota, y es deliberado porque hay dos sesiones en vuelo (R-6): esta spec cambia **el
  valor de la línea `RESEND_FROM` y nada más**. No añade, no quita y no renombra ninguna clave, y **no
  toca `APP_BASE_URL`** ni sus menciones a `stockeiro.app` (`.env.example:30`, `docs/despliegue.md:107`),
  que son territorio de **SPEC-052** y **SPEC-055**. Tampoco toca las constantes `BASE` de
  `tests/password-reset.test.ts:21` y `tests/session-epoch.test.ts:10`, que son fixtures y no
  documentación (y a las que CA-18 prohíbe tocar de todos modos).

## Entidades y reglas afectadas

- **Reglas que se citan y que NO se tocan:** **RN-13** (un episodio por entrada), **RN-14** (tipos de
  aviso e idempotencia del envío) y **RN-15** (canal proactivo con registro in-app y fallback). Esta
  spec no altera qué se emite, ni a quién, ni cuántas veces, ni qué se persiste. **RN-01** sigue
  gobernando el destinatario: cada correo va al email almacenado de su dueño, como hoy.
- **Decisiones locked que siguen mandando:** **D-2** de FOUNDATION — el `asOf` viaja y **se ve** en el
  correo, en los dos cuerpos (CA-14). Un diseño que se coma el `asOf` por estética estaría rompiendo
  un no-negociable, no un detalle.
- **ADR-036** (nuevo, esta spec): el puerto gana `html` opcional, el texto plano sigue siendo el
  contrato y la plantilla vive sobre el puerto. **Enmienda el pto. 1 de ADR-006**; sus puntos 2 a 5
  quedan intactos.
- **ADR-006**: sigue siendo la decisión del canal. La frontera no se mueve; se ensancha el mensaje.
- **ADR-015** pto. 8 y 9: el enlace de reset se compone desde `APP_BASE_URL` y **no** desde la
  cabecera `Host`, y la página de reset no carga terceros. Esta spec extiende esa segunda promesa **al
  correo** (D-7), donde hasta ahora era trivial por no haber HTML.
- **SPEC-035 CA-11 y CA-12**: la fórmula de marca y la ausencia de terceros. El correo pasa a ser el
  cuarto lector de `MARCA`, junto al pie de la app, `/legal/aviso-legal` y —por herencia visual—
  SPEC-050 y SPEC-051.
- **SPEC-007**: el historial in-app y su `payload`. Se cita para decir que **no** cambia (CA-17).
- **`RESEND_FROM` y el remitente**: `docs/despliegue.md` §7 y §13 y `.env.example`. Esta spec
  corrige lo que esos ficheros **dicen** y el valor por defecto del código (CA-19, CA-20); lo que
  esos ficheros **describen hacer en Vercel** sigue siendo del humano (F-SPEC-056-4).
- **Entidades:** `notification` (sin cambios de esquema). Ningún término nuevo para
  `docs/fundacion/dominio.md`: «plantilla de correo», «cabecera» y «pie» son vocabulario técnico, no
  dominio del negocio (ADR-025 obliga a mirarlo, y aquí la respuesta es que no hay término que
  escribir).

## Fuera de alcance

- **Correos nuevos.** Bienvenida al registrarse, confirmación de email, aviso de salida de zona,
  resumen semanal. **Ninguno existe hoy** y esta spec no los inventa: son **capacidad nueva**, que es
  literalmente lo que EPIC-MEJORA excluye. *Lo reabre*: una épica de producto que los pida.
- **Cambiar el copy.** Los asuntos y las frases son los de hoy (D-10, CA-16). Si al humano le parece
  que el texto de entrada en zona debería decir más —por ejemplo, cuál era la zona y no solo el
  precio—, eso es **contenido**, no presentación, y necesita su propia spec. *Lo reabre*: feedback de
  un tester sobre lo que el correo dice.
- **Un enlace a la app desde el correo** («ver en Stockeiro», «ver mis vigiladas»). Es tentador y sería
  útil, pero mete `APP_BASE_URL` en el camino del ciclo de notificaciones, donde hoy **no está**: hoy
  solo lo usa el reset. Eso es una dependencia de configuración nueva en un camino que corre en cron y
  que hoy no puede fallar por falta de variable — y con **SPEC-052** y **SPEC-055** en vuelo
  precisamente sobre el comportamiento de `APP_BASE_URL` cuando falta o está envenenada, meterse ahí
  ahora es buscarse un conflicto de tres bandas. *Lo reabre*: que 052 y 055 cierren, y entonces es un
  CA colgado de una spec pequeña, no de ésta.
- **Renombrar `body` a `text` en el puerto.** El nombre correcto es `text` (ADR-036, alternativas), y
  el renombrado tocaría tres adaptadores, dos emisores y varios ficheros de test **sin cambiar ninguna
  conducta**. Mezclarlo con un cambio que sí cambia conducta hace que un fallo no signifique nada.
  Queda como **higiene** para EPIC-INFRA.
- **Cambiar `RESEND_FROM` en el entorno de Production de Vercel.** Ojo con esta frontera, que el gate
  del 2026-08-25 movió a medias. **Sí entra**: el valor por defecto del código (CA-19) y los dos
  ficheros que lo documentan, `.env.example` y `docs/despliegue.md` (CA-20) — eso es trabajo de
  ficheros, implementable y verificable. **No entra**: fijar el valor real en Vercel, que no es código
  sino una acción de despliegue del humano, con su propia comprobación de que el dominio sigue
  verificado y de que el primer envío no rebota. Va como **F-SPEC-056-4**, con la misma marca de
  DESPLIEGUE con que se llevó F-SPEC-006-1. **Consecuencia que hay que tener presente al cerrar**:
  mientras esa acción no se ejecute, el remitente real en producción **seguirá siendo el que hoy esté
  configurado**, y esta spec puede estar en `hecho` sin que eso haya cambiado.
- **Preferencias de correo** (darse de baja del resumen, elegir frecuencia, HTML vs. texto). Capacidad
  nueva con esquema nuevo; EPIC-MEJORA lo excluye expresamente.
- **Modo claro para el correo.** El diseño de la app es oscuro y el correo lo hereda; una segunda
  paleta condicionada por `prefers-color-scheme` duplicaría la superficie a probar por una ganancia no
  observada. CA-7 se limita a **declarar** el esquema para que el cliente no invierta lo que hay.
- **Probar el correo en clientes reales** (Litmus, Email on Acid o similares). Es un servicio de pago
  y una dependencia externa. Lo que esta spec puede garantizar por test es el **subconjunto
  conservador** (CA-8, CA-9); lo que no, se comprueba con un envío real tras desplegar (F-1).
- **i18n del correo.** La app es en español y así se publica (heredado de EPIC-004).

## Riesgos

- **R-1 — El correo de recuperación es infraestructura de acceso disfrazada de correo.** Es el único
  de los tres cuyo fallo **deja a alguien fuera de su cuenta**. Un botón que un cliente no pinta, un
  enlace que se rompe al envolverse en HTML, un filtro que rechaza el correo por su marcado: cualquiera
  de las tres cosas convierte una mejora estética en una avería de acceso, y la persona afectada es
  precisamente la que no puede entrar a quejarse. **Mitigación**: CA-15 (URL desnuda y primera en el
  texto, y visible además en el HTML), CA-13 (el texto se basta solo) y F-1 (un reset real tras
  desplegar, igual que se cerró F-SPEC-006-1).
- **R-2 — Hay guardias ajenas leyendo el texto plano de estos correos, y el reflejo natural será
  aflojarlas.** `tests/password-reset.test.ts` (líneas 36, 138, 163, 165), `tests/session-epoch.test.ts`
  y `tests/e2e/recuperacion.spec.ts:39` sacan el enlace del cuerpo con expresiones regulares. Si el
  implementador toca el orden del texto, se pondrán rojas, y aflojar el regex es lo que apetece hacer.
  **Mitigación**: D-6 evita el choque por diseño (la marca va al final), y CA-18 lo pone como criterio
  explícito: el diff sobre tests que ya existían **solo puede añadir**.
- **R-3 — «Diseño actual» es un adjetivo, y los adjetivos no fallan.** Ese es el riesgo de esta spec
  entera: entregar algo que a quien lo escribió le parece moderno y que nadie puede refutar.
  **Mitigación**: CA-7 a CA-12 traducen el adjetivo a seis criterios y una veintena de propiedades comprobables. Si al humano el
  resultado le parece feo, eso es una conversación de diseño legítima **encima** de una base que ya
  cumple; sin esos CA no habría base ninguna.
- **R-4 — El correo se ve donde no lo controlamos.** Outlook (motor de Word), Gmail (poda el `<head>`
  y reescribe estilos), Apple Mail (invierte colores en oscuro), clientes móviles que reescalan. **No
  hay guardia automática posible** contra el render real. Lo que sí hay es la restricción de escribir
  solo el subconjunto que sobrevive (D-5) y de medirlo (CA-8, CA-9). Residual asumido y anotado.
- **R-5 — El diseño puede empeorar la entregabilidad.** Un correo con mucho marcado y poco texto puntúa
  peor en los filtros de spam que un texto plano; y ADR-006 recuerda que Resend exige *bounce rate* < 4 %
  y que el *inbox placement* del correo ronda el 80 %. **Mitigación**: HTML sobrio y sin imágenes (D-2,
  D-7 — las imágenes y los recursos remotos son señales clásicas de spam), la parte de texto siempre
  presente (que es lo que los filtros premian), y **cero contenido promocional** en un correo
  transaccional (D-3, decisión del humano). Aun así, es un riesgo real que solo se observa en
  producción: F-2.
- **R-6 — Tres sesiones en paralelo sobre este repositorio.** **SPEC-052** («sin `APP_BASE_URL` el build
  ya no sale verde») y **SPEC-055** («`APP_BASE_URL` envenenada: `appBaseUrl` valida el valor») están en
  vuelo **ahora mismo** y las dos rondan el camino del correo de recuperación. Esta spec parte de
  `origin/main` en `825046f`, o sea **sin** ninguna de las dos. **Y el riesgo subió en el gate del
  2026-08-25**: la resolución del remitente hace que esta spec **sí toque `.env.example`**, que es
  justo el fichero que las otras dos rondan. **Mitigación**, y está escrita como criterio y no como
  intención (CA-20): se cambia **el valor de la línea `RESEND_FROM` y nada más** —ni una clave de más,
  ni una de menos, ni una renombrada—, no se toca `src/lib/config/app-url.ts`, no se toca
  `APP_BASE_URL` ni sus menciones a `stockeiro.app`, y `tests/spec-031-frontera.test.ts` (`toHaveLength(11)`)
  queda verde y sin tocar. Un cambio de una línea con valor distinto es el conflicto más barato que
  existe: el solape real queda en `src/lib/auth/password-reset.ts` —y ahí solo en `resetEmailBody`— y
  en una línea de `.env.example`. Quien mergee el segundo, rebasa y reconcilia.

## Notas para el gate humano

> **Estado: las seis preguntas de esta sección están RESUELTAS.** Las llevó el orquestador al humano
> (Alberto Fojo) y él las decidió el **2026-08-25**. Se conservan con su resolución escrita al lado —no
> se borran— porque dentro de tres meses lo caro no será saber qué se decidió, sino **por qué**. La
> spec sigue en `borrador`: la transición de estado la hace el orquestador, no su autora.

1. **El encaje en EPIC-MEJORA pese a CE-M3: RESUELTO A FAVOR DEL ENCAJE** (humano, 2026-08-25). Es la
   nota importante, así que queda entera.

   La tensión es real y la levanté yo: **CE-M3** de la épica dice, con estas palabras, *«Una mejora que
   necesita migración de esquema, proveedor nuevo o decisión de arquitectura no es una mejora: es
   alcance nuevo. Medida: si la spec necesita ADR nuevo, se replantea su encaje aquí.»* Esta spec
   **necesita un ADR nuevo** (ADR-036), así que el replanteamiento había que hacerlo, y lo hizo el
   humano releyendo la tensión en el gate. Los términos con los que se resolvió:
   - **No hay migración de esquema** (CA-17), **no hay proveedor nuevo** (sigue Resend), **no hay clave
     de entorno nueva** (ADR-036 pto. 8, CA-20) y **no hay dependencia nueva** (se descartó React Email).
   - Lo que hay es **una enmienda aditiva a un contrato interno**: un campo opcional. No mueve la
     frontera que ADR-006 puso; ensancha lo que la cruza. Los tres implementadores del puerto siguen
     válidos **sin tocarse** (CA-1).
   - Cabe en una sesión, que es el espíritu de CE-M3.
   - Y el roce está observado (CE-M2): lo observó el humano, citado literalmente en §Problema.

   **Precedente que esto sienta, y conviene que se lea así**: CE-M3 no dice «prohibido el ADR», dice
   «replantéalo». Una enmienda **aditiva** a un contrato **interno**, sin esquema, sin proveedor, sin
   clave y sin dependencia, cabe en la épica. Una que mueva la frontera, no. El día que otra spec de
   EPIC-MEJORA llegue con un ADR debajo, esta nota es la vara de medir — y lo que **no** vale es
   disimular el ADR para que la spec encaje.

2. **Cabecera y pie (D-3): CONFIRMADO** (humano, 2026-08-25), y confirmado también el **descarte del
   reclamo comercial** en el pie. Presencia de marca, no publicidad dentro de un correo transaccional.

3. **El remitente: RESUELTO, y es lo que más cambió del alcance** (humano, 2026-08-25).
   - La **dirección** la fijó el humano: **`stockeiro@tremen.dev`**.
   - El **nombre visible** lo decidió esta spec, con sus cinco razones en **D-11**:
     `"Stockeiro - tremen.dev"`. En corto: la marca va en el nombre porque en el móvil **la dirección
     no se ve**; va corta porque el nombre se trunca hacia los 25 caracteres; y va en ASCII y entre
     comillas porque una cabecera de correo no es una página web.
   - Se **corrige** además la documentación caduca —`.env.example:58` y `docs/despliegue.md:183`
     y `:187` citan `stockeiro.app`, que **no** es el dominio verificado (`docs/despliegue.md:54`, y
     el reset real de la línea 433 llegó desde `@tremen.dev`)—. No es preferencia de estilo: es
     documentación que miente sobre el estado real del despliegue. Entra por **CA-19** y **CA-20**.
   - Lo que **no** entra: fijar el valor en Vercel. Eso es despliegue, no código → **F-SPEC-056-4**.

4. **Geist fuera (D-8): CONFIRMADO** (humano, 2026-08-25). El correo usa la pila de fuentes del
   sistema. La alternativa habría sido pedirle la fuente a un tercero, que es exactamente lo que
   SPEC-035 CA-12 quitó de la web; no existía tercera opción.

5. **La forma de la evidencia visual: CONFIRMADO el plan propuesto** (humano, 2026-08-25). Los tres
   HTML generados a `_qa/SPEC-056/` y el verificador los captura, **incluida una a 360 px**. Está
   escrito arriba, en la cabecera de §Criterios de aceptación, para que el verificador lo lea donde
   mira y no en una nota de gate. Y queda dicho lo que esa evidencia no prueba: cómo se ve en Outlook.

6. **Versión PATCH: CONFIRMADO** (humano, 2026-08-25), por ADR-024 y con el mismo criterio que
   SPEC-047 y SPEC-051: presentación pura, sin cambio de contrato externo. El campo nuevo del puerto es
   **interno** y opcional; `/api/version` no cambia. Recordatorio de SPEC-049: `npm run version:check`
   se ejecuta **después** de commitear, porque sobre árbol sucio se abstiene con 2 y una abstención no
   es un verde.

7. **Follow-ups que nacen con esta spec** (viven en el ledger; ninguno bloquea la implementación):
   - **F-SPEC-056-1 (DESPLIEGUE)**: un **envío real de cada uno de los tres** tras desplegar, mirado en
     al menos un cliente de escritorio y uno móvil. Única prueba de que la parte HTML se entrega y se
     pinta; se cierra como se cerró F-SPEC-006-1 («un reset real entregado»).
   - **F-SPEC-056-2 (observación)**: vigilar el *bounce rate* y la carpeta de spam los días siguientes
     (R-5). Si empeora, el sospechoso número uno es el marcado.
   - **F-SPEC-056-3 (higiene, EPIC-INFRA)**: renombrar `body` → `text` en `NotificationMessage`, aislado.
   - **F-SPEC-056-4 (DESPLIEGUE, nace del gate)**: fijar `RESEND_FROM` en Production de Vercel al valor
     que CA-19 deja en el código, y **comprobar con un envío real que sale desde `@tremen.dev` y no
     rebota**. Hasta entonces el remitente en producción no ha cambiado, por muy `hecho` que esté esto.
