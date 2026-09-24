---
id: SPEC-068
tipo: spec
epica: EPIC-FIX
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-09-24, por: sdd-arquitecto}
---
# SPEC-068 — El icono en Google: un PNG que el buscador acepta y el nombre del sitio que no es el dominio

## Problema

**Observado por el humano el 2026-09-24**: Stockeiro ya sale en Google (lo indexable lo fijó
**SPEC-065**), pero el resultado muestra **el globo genérico** en lugar del icono, y el nombre
del sitio sale como **«tremen.dev»** en vez de **«Stockeiro»**. Es la primera superficie que ve
alguien que busca la app sin haber pasado por el foro, y hoy dice «un sitio cualquiera de un
dominio que no conoces».

Es un arreglo y no una mejora: SPEC-047 (el icono) y SPEC-065 (dejarse encontrar) prometían,
entre las dos, que quien encontrara Stockeiro la reconocería. En la superficie de Google esa
promesa no se cumple.

### Lo que se midió antes de escribir esto (producción, 2026-09-24)

Con `curl` contra `https://stockeiro.tremen.dev/` y contra el árbol de `origin/main` (`75707e3`):

1. **El HTML declara dos iconos**, los dos por la convención de fichero de Next (SPEC-047 CA-4):
   `<link rel="icon" href="/favicon.ico?…" sizes="48x48" type="image/x-icon">` y
   `<link rel="icon" href="/icon.svg?…" sizes="any" type="image/svg+xml">`. Los dos responden
   200 con su `content-type`, y `robots.txt` no los bloquea.
2. **El `.ico` SÍ trae 48×48. La sospecha de partida era falsa, y se corrige aquí.** El
   diagnóstico con el que llegó el encargo decía que `src/app/favicon.ico` sólo contiene 16 y
   32 porque `file` enumera esos dos. `file` **trunca**: dice «3 icons» y lista dos. Parseando
   la cabecera `ICONDIR` a mano, el fichero tiene **tres** entradas —**16, 32 y 48**—, y el que
   sirve producción es **byte a byte idéntico** al comprometido. Es exactamente lo que ya
   garantiza **SPEC-047 CA-3** (`tests/icono-fichero.test.ts`, verde). Así que el
   `sizes="48x48"` que emite Next **es verdad**, y regenerar el `.ico` **no** forma parte de
   esta spec: no hay nada que arreglar ahí.
3. **No hay datos estructurados `WebSite`.** Ni un `<script type="application/ld+json">` en
   todo `src/` (SPEC-065 los dejó fuera a propósito, §Fuera de alcance). Sí existen
   `og:site_name = "Stockeiro"` (SPEC-051) y un `<title>` que empieza por «Stockeiro», pero la
   fuente que Google documenta como **primera** para el nombre del sitio es el `WebSite` de la
   portada; a falta de él, puede caer en el dominio.

### Qué se sabe y qué no del globo

Con el punto 2 corregido, **el favicon de producción ya cumple lo que Google documenta**
(cuadrado, múltiplo de 48, formato admitido, rastreable, declarado en la portada). La causa más
probable del globo es **latencia**: la portada pasó a indexable con SPEC-065 el 2026-09-23 y el
icono de un resultado lo recoge un rastreador aparte que puede tardar días o semanas. **Esto no
es verificable desde aquí**, y esta spec no promete que el globo desaparezca al desplegar.

Lo que sí hace es quitar las dos debilidades objetivas que quedan, para que cuando Google vuelva
no tenga por dónde fallar:

- **El único raster ≥ 48 es la entrada de 48 de un `.ico`.** Es el mínimo exacto que acepta
  Google, en el formato más viejo, y el SVG —que es la obra nítida— no todos los consumidores lo
  rasterizan. Un **PNG cuadrado de 192×192** (4 × 48) es el formato y el tamaño con menos
  ambigüedad posible para un rastreador de iconos, y de paso lo que usan Android/Chrome cuando
  no hay manifiesto.
- **El nombre del sitio no está declarado donde Google lo busca primero.** Un `WebSite` en la
  portada lo declara.

## Usuarios / roles afectados

- **Quien busca «Stockeiro» (o algo cercano) en Google sin cuenta**: ve el icono y el nombre de
  la app, no un globo y el nombre de la marca paraguas.
- **El humano (Alberto Fojo)**: tras desplegar, pide la reindexación de la portada en Search
  Console (§Fuera de alcance, paso post-merge). Es el único paso que no hace el código.
- **Cualquier usuario con sesión**: no nota nada; el `<head>` gana un `<link rel="icon">` más.

## Decisiones

- **D-1 — El PNG sale del MISMO generador y de la MISMA geometría.** `src/app/icon.png`, de
  **192×192**, lo escribe `scripts/build-icon.mjs` (el `npm run icon:build` que ya existe) a
  partir de `rasterizar(192, tokensDeMarca())` de `scripts/icon-geometry.mjs` —la función que ya
  produce las entradas del `.ico`— y lo codifica `scripts/png.mjs` —el codificador que ya usa la
  tarjeta social—. **Ni un píxel se dibuja a mano, ni entra una dependencia, ni una clave nueva
  en `scripts` de `package.json`** (misma regla que SPEC-051 D-8). El diseño de SPEC-047 (D-1 a
  D-3 y su tabla de proporciones) **no se toca**: `icon.svg` y `favicon.ico` quedan byte a byte
  como están.
- **D-2 — Entra por la convención de fichero de Next**, igual que sus dos hermanos: es Next
  quien emite `<link rel="icon" type="image/png" sizes="192x192">`. Nada de `metadata.icons`,
  nada de `<link>` a mano, nada bajo `public/` (SPEC-047 CA-4 sigue vigente y sin tocar).
- **D-3 — `/icon.png` sale del proxy antes de Auth.js por una lista de emparejamiento EXACTO en
  `src/lib/auth/guard.ts`, y el `matcher` de `src/proxy.ts` NO se toca.** Es el patrón de
  SPEC-065 D-5 (`CRAWLER_PATHS`) y SPEC-066 (`isBotIdPath`, ADR-042 pto. 19), y por la misma
  razón: meter `icon.png` en el literal del `matcher` sería el **tercer arrastre** de las dos
  guardias que lo copian carácter a carácter (`tests/legal-rutas-publicas.test.ts`,
  `tests/cuenta-rutas.test.ts`), y `F-SPEC-051-1` dejó escrito que el tercero no se parchea: el
  defecto está en el literal y tiene ficha propia en EPIC-FIX. Lista nueva, separada de las
  otras porque su semántica es otra: **activos de marca estáticos**, idénticos para todo el
  mundo, sin dato de usuario, que no son páginas (no van a `PUBLIC_PREFIXES`, la excepción
  documentada a RN-03) ni rutas de rastreador. El nombre de la lista y del predicado lo elige
  quien implementa; su porqué va escrito al lado, como en las otras.
- **D-4 — El nombre del sitio es «Stockeiro»**, declarado con un `WebSite` en JSON-LD **sólo en
  la portada** (`/`), que es donde Google lo lee:
  `{"@context":"https://schema.org","@type":"WebSite","name":"Stockeiro","url":"https://stockeiro.tremen.dev/"}`.
  Sin `alternateName` y sin `potentialAction` (no hay buscador interno que anunciar). **La marca
  tremen.dev no desaparece**: sigue en la URL del resultado y en el pie de todas las páginas
  («Stockeiro, un proyecto de tremen.dev», SPEC-035 CA-11). *Decisión por defecto del
  orquestador, revertible por el humano en el gate* (§Notas pto. 1).
- **D-5 — Nada se escribe dos veces (ADR-040).** El nombre del sitio es **una constante** en
  `src/lib/seo/` que consumen `openGraph.siteName` del layout y el `name` del JSON-LD (y el
  `title` por defecto del layout, que hoy repite el mismo literal). La `url` del JSON-LD se
  **deriva**: es el `canonical` de la portada (`metadatosIndexables('/')`, SPEC-065 D-1) resuelto
  contra `appBaseUrl()` (ADR-015 pto. 8, SPEC-051 CA-1) — **nunca** tecleada ni sacada de la
  cabecera de la petición. El objeto lo construye una función **pura** en `src/lib/seo/` (sin
  Next, sin Auth.js, como `indexables.ts`) y la portada sólo lo serializa.

## Criterios de aceptación

Unitarios con **Vitest** (ficheros, bytes, código). Lo que dice *lo que se sirve*, **e2e
Playwright** contra el build real (`tests/e2e/server.mjs`), con peticiones **sin cookies** y,
donde se indica, **sin ejecutar JavaScript** (`request`, no navegador), que es como llega un
rastreador. Ningún CA teclea un color, una URL absoluta, un `href` con hash ni el nombre del
sitio: los derivan de su fuente (tercera convención de `FOUNDATION.md`, ADR-040).

### El PNG existe y es el mismo icono

- **CA-1 (Un PNG cuadrado de 192, múltiplo de 48).**
  Dado `src/app/icon.png`,
  cuando se leen su firma y su `IHDR`,
  entonces es un PNG válido (firma de 8 bytes, `IHDR` como primer chunk, CRC correctos), de
  **192×192**, RGBA de 8 bits, y 192 es múltiplo de 48.

- **CA-2 (Es el icono de SPEC-047, píxel a píxel, no un parecido).**
  Dado el PNG decodificado,
  cuando se compara con `rasterizar(192, tokensDeMarca())` de `scripts/icon-geometry.mjs`,
  entonces los 192 × 192 × 4 valores RGBA son **idénticos**. Y, como comprobación de que la
  geometría compartida sigue siendo la de SPEC-047, sobre ese mismo raster: los únicos colores
  opacos presentes (distancia RGB ≤ 24) son `--bg`, `--bone` y `--accent` leídos de
  `design/tremen-ds/colors_and_type.css`; el centroide de los píxeles de acento cae en la mitad
  derecha y la mitad inferior; y la cobertura de hueso difiere en **≤ 8 puntos porcentuales**
  de la de la entrada de 48 del `.ico` (el mismo umbral de SPEC-047 CA-15).

- **CA-3 (Se reproduce con el `icon:build` de siempre, y nada más entra).**
  Dado `node scripts/build-icon.mjs --out <dir temporal>`,
  cuando se ejecuta,
  entonces escribe **exactamente cuatro** ficheros —`favicon.ico`, `icon.png`, `icon.svg`,
  `opengraph-image.png`— y `icon.png` es **byte a byte idéntico** al comprometido, igual que los
  otros tres; `package.json` **no** gana ninguna clave en `scripts`, `dependencies` ni
  `devDependencies`; y el generador sigue importando sólo de `node:*` y de `scripts/`.

- **CA-4 (El generador dice lo que hace).**
  Dado `scripts/build-icon.mjs`,
  cuando se ejecuta con `--help`,
  entonces su salida nombra los **cuatro** ficheros que escribe, incluido `src/app/icon.png`; y
  el comentario de cabecera deja de afirmar «los TRES activos». Motivo: SPEC-051 D-8 ya
  registró que un documento que afirma algo que no es, es un defecto y no un detalle (ADR-040).

- **CA-5 (Lo que ya estaba no se mueve).**
  Dado el diff contra `origin/main`,
  entonces `src/app/icon.svg`, `src/app/favicon.ico` y `src/app/opengraph-image.png` **no
  cambian**; y `tests/icono-fichero.test.ts`, `tests/icono-16px.test.ts` y
  `tests/icono-frontera.test.ts` siguen verdes **sin modificar una sola línea**.

### El documento lo declara, y lo declarado es verdad

- **CA-6 (Next emite el PNG, una vez, junto a los otros dos).**
  Dada la app servida,
  cuando se lee el `<head>` de la portada `/` y de `/legal/aviso-legal` sin sesión, y de
  `/vigiladas` con sesión,
  entonces en las tres hay **exactamente un** `<link rel="icon" type="image/png"
  sizes="192x192">` cuyo `href` apunta a `/icon.png`, además del SVG y del `.ico` (uno de cada):
  **tres** `<link rel="icon">` en total, ninguno duplicado; y `src/app/layout.tsx` sigue sin
  `icons` en `metadata` ni `<link rel="icon">` escrito a mano, y no nace nada bajo `public/`.

- **CA-7 (Todo `sizes` declarado es verdad sobre los bytes servidos).**
  Dada la portada `/` sin sesión,
  cuando para cada `<link rel="icon">` cuyo `sizes` no es `any` se pide su `href` (leído del
  documento, no tecleado) y se decodifica la respuesta,
  entonces el tamaño declarado **existe** en lo servido: para el PNG, sus dimensiones son
  exactamente las de `sizes`; para el `.ico`, alguna de sus entradas `ICONDIR` las tiene. Es la
  propiedad que convierte la sospecha de partida (punto 2 del Problema) en algo que ya no puede
  volver a ser falso sin ponerse rojo.

### El PNG se alcanza sin sesión, sin rastro y sin tocar el `matcher`

- **CA-8 (Un anónimo recibe el PNG, no un desvío a `/login`).**
  Dado un contexto **sin cookies**,
  cuando se pide el `href` del PNG leído de la portada,
  entonces responde **200** con `content-type: image/png`, **no** un 3xx ni `text/html`, y
  **sin** ninguna cabecera `Set-Cookie`; y los bytes servidos con sesión y sin ella son
  **idénticos** (RN-01, RN-03: el icono no sabe quién lo pide).

- **CA-9 (La excepción es exacta, y vive en su lista).**
  Dado `src/lib/auth/guard.ts`,
  entonces existe una lista de activos de marca, de emparejamiento **exacto**, que contiene
  `/icon.png`; su predicado es cierto para `/icon.png` y **falso** para `/icon.pngx`,
  `/icon.png/x`, `/icon`, `/icon.svg` y `/`; `/icon.png` **no** es `isPublicPath`, **no** está
  en `PUBLIC_PREFIXES` ni en `CRAWLER_PATHS`; y `src/proxy.ts` consulta ese predicado **antes**
  de instanciar Auth.js, como hace con los de rastreador y BotID.

- **CA-10 (El `matcher` y las listas ajenas no se tocan).**
  Dado el diff de `src/proxy.ts` y `src/lib/auth/guard.ts` contra `origin/main`,
  entonces la línea del `matcher` es **idéntica**; `PUBLIC_PREFIXES`, `CRAWLER_PATHS` y
  `BOTID_PATH_PREFIX` son **idénticos**; y `tests/legal-rutas-publicas.test.ts`,
  `tests/cuenta-rutas.test.ts`, `tests/spec065-rutas-de-rastreador.test.ts` y
  `tests/spec066-proxy-botid.test.ts` siguen verdes **sin tocarse**.

### El nombre del sitio

- **CA-11 (La portada declara un `WebSite`, legible sin JavaScript).**
  Dada una petición `request` sin cookies a `/` (el HTML tal como llega, sin ejecutar JS),
  cuando se buscan los `<script type="application/ld+json">`,
  entonces hay **exactamente uno**; su contenido es JSON válido; y el objeto tiene
  **exactamente** las claves `@context` = `https://schema.org`, `@type` = `WebSite`, `name` y
  `url` (lista cerrada: una clave más o menos es rojo, y añadir `alternateName` se decide en el
  gate, no en la implementación).

- **CA-12 (El nombre y la URL son los de su fuente, no una copia).**
  Dado ese mismo documento,
  entonces `name` es **igual** al `content` de su `<meta property="og:site_name">`, y `url` es
  **igual** a la URL absoluta de su `<link rel="canonical">`. Y en el código: el literal del
  nombre del sitio aparece **una sola vez** en `src/` como constante del módulo de `src/lib/seo/`
  (fuera de comentarios), y `src/app/layout.tsx` y el constructor del JSON-LD lo consumen sin
  repetirlo; el constructor no contiene ningún `http://`/`https://` ni lee cabeceras de la
  petición (ADR-015 pto. 8).

- **CA-13 (El JSON-LD va donde Google lo lee y en ningún otro sitio).**
  Dadas `/ayuda`, `/legal/aviso-legal` y `/login` sin sesión,
  entonces **ninguna** contiene `application/ld+json`. Motivo: el `WebSite` es de la portada;
  repetirlo por páginas no aporta y abre la puerta a que diverjan.

- **CA-14 (La serialización no se puede romper desde dentro).**
  Dada la serialización del JSON-LD que usa la portada,
  cuando se le pasa un objeto cuyo `name` contuviera `</script>`,
  entonces la salida no contiene `<` sin escapar (va como `<`), que es como Next documenta
  incrustar JSON-LD. Hoy el nombre es una constante inofensiva; el CA protege el mecanismo, no
  el valor.

### Cero regresión

- **CA-15 (Las guardias que congelan la cuenta de iconos se amplían nombradas, y ninguna se
  afloja).**
  Dadas las **tres** aserciones ajenas que un icono más invalida por construcción —y **sólo**
  esas tres—:
  1. `tests/e2e/icono.spec.ts`, SPEC-047 CA-4: `expect(enlaces).toHaveLength(2)` (en sus dos
     casos),
  2. `tests/e2e/icono.spec.ts`, SPEC-047 CA-6: la expresión de `content-type` admitida, que no
     contempla `image/png`,
  3. `tests/tarjeta-frontera.test.ts`, SPEC-051 CA-13: la lista cerrada de ficheros que escribe
     el generador (tres),

  entonces cada una **crece exactamente en el elemento nuevo** (`2 → 3` más un filtro «uno de
  PNG»; `image/png` en la alternativa; `icon.png` en la lista) y **sigue cerrada** (nada de
  `toEqual` → `toContain`, ni `toHaveLength` → `toBeGreaterThan`, ni `.skip`); cada una lleva
  **su porqué escrito al lado** (qué vigilaba, qué vigila ahora, en virtud de qué CA de
  SPEC-068 y con qué arbitraje); y el diff de `tests/` contra `origin/main` no modifica **ninguna
  otra** aserción existente. Un cuarto fichero ajeno modificado es **RED** y se escala al gate.
  Esta autorización se escribe **aquí, antes de implementar**, que es la condición de proceso de
  `FOUNDATION.md` (quien toca una guardia no es quien se beneficia).

- **CA-16 (Las suites enteras siguen verdes, y el diff está acotado).**
  Dadas `npm test` y `npx playwright test` completas,
  entonces pasan —en particular **SPEC-035 CA-13** (recorrer `/legal` sin sesión no deja
  cookies) y el e2e de SPEC-065, sin tocarlos—; y `git diff --name-only origin/main` **sobre lo
  comiteado** sólo contiene: `src/app/icon.png`, `src/app/page.tsx`, `src/app/layout.tsx`,
  `src/lib/seo/`, `src/lib/auth/guard.ts`, `src/proxy.ts`, `scripts/build-icon.mjs`,
  `scripts/icon-geometry.mjs` (sólo si hace falta exportar algo), `tests/`, `docs/`,
  `_qa/SPEC-068/` y `package.json` (sólo el `version`, PATCH por ADR-024). Nada bajo `src/db/`
  ni `drizzle/`; ninguna otra `_qa/SPEC-NNN/` (las e2e reescriben capturas ajenas al correr: se
  restauran, no se commitean).

## Entidades y reglas afectadas

- **Ninguna entidad de dominio.** Sin migración (RI-01 inaplicable), sin término nuevo en
  `docs/fundacion/dominio.md` (ADR-025 no aplica).
- **RN-01 / RN-03** (`docs/fundacion/reglas.md`): por respeto. El PNG es un estático sin dato de
  usuario (CA-8) y sale por una lista propia, no por la de páginas (CA-9, CA-10).
- **SPEC-047** (icono): se consume su geometría y su generador; su diseño, sus ficheros y sus
  tests de fichero/píxel no se tocan (CA-5). Sus CA-4 y CA-6 e2e se amplían bajo CA-15.
- **SPEC-051** (tarjeta social): `og:site_name` es la fuente con la que se compara el `name`
  (CA-12); su CA-13 se amplía bajo CA-15; su D-8 obliga a CA-4.
- **SPEC-065** (buscadores): su D-5 es el molde de D-3; `metadatosIndexables('/')` da la `url`
  (D-5 de esta spec). Las páginas indexables siguen siendo `/` y `/ayuda`.
- **SPEC-035 CA-11** (la marca tremen.dev en el pie): no se toca; es lo que mantiene visible la
  marca paraguas con D-4.
- **ADR-015 pto. 8** (origen absoluto desde configuración), **ADR-024** (versión PATCH),
  **ADR-040** (derivar, no copiar), **ADR-042 pto. 19** (precedente de lista exacta en el proxy).
- **`F-SPEC-051-1`** (literal del `matcher`): **no se arregla aquí** y **no se agrava** (D-3).
- **Sin ADR nuevo.** D-3 es la tercera aplicación de un patrón ya escrito en SPEC-065 D-5 y
  ADR-042 pto. 19, no una decisión nueva; D-4 es de marca, revertible, y vive en esta spec.

## Fuera de alcance

- **Regenerar `favicon.ico`.** Ya trae 16, 32 y 48 (Problema, punto 2). CA-7 impide que deje de
  ser verdad.
- **Pedir la reindexación en Search Console** — **paso post-merge del humano**: tras desplegar,
  inspeccionar la URL de la portada y «Solicitar indexación», y pasar la portada por la prueba de
  resultados enriquecidos para ver el `WebSite` reconocido. **Cuánto tarde Google** en cambiar
  el globo y el nombre no es verificable por CA y esta spec no lo promete.
- **Manifiesto PWA, `apple-icon`, `theme-color`**: siguen fuera por los motivos de SPEC-047
  §Fuera de alcance. El PNG de 192 no convierte la app en instalable.
- **Arreglar el literal del `matcher`** (`F-SPEC-051-1`, `F-SPEC-066-4`): su propia spec en
  EPIC-FIX.
- **Otros tipos de datos estructurados** (`Organization`, `SoftwareApplication`, migas): no
  observados. `Organization` sería de tremen.dev, no de Stockeiro.
- **Cambiar ningún texto visible** de la portada, del `<title>` o del pie.

## Riesgos

- **R-1 — Se despliega y el globo sigue.** Probable durante días, y no significa que esto
  falle: Google refresca iconos y nombres a su ritmo. *Mitigación*: CA-6..CA-8 y CA-11..CA-12
  prueban que lo que Google necesita está servido; el post-merge de Search Console acelera lo
  que se puede acelerar. Si pasadas unas semanas sigue el globo con esto desplegado, es
  investigación nueva con datos de Search Console, no un rojo de esta spec.
- **R-2 — Google no admite nombre de sitio a nivel de subdominio.** Hasta donde sé, la
  documentación de Google admite nombres de sitio en dominio y subdominio (no en subdirectorio),
  pero **no lo he verificado en vivo desde aquí**. Si no lo admitiera, D-4 no cambiaría el nombre
  y seguiría saliendo `tremen.dev`; el `WebSite` no haría daño.
- **R-3 — Hay más e2e que cuentan iconos de las que CA-15 nombra.** Lo nombrado sale de un
  barrido de `tests/` hecho al escribir esto; cualquier otra aparición es rojo y se escala, no
  se toca.
- **R-4 — Worktrees paralelos.** El punto de contacto probable es `src/lib/auth/guard.ts` y
  `src/proxy.ts` (otras specs añaden excepciones ahí). Conflicto trivial por ser listas separadas.

## Notas para el gate humano

1. **El nombre del sitio (D-4) es una decisión tuya de una frase.** Por defecto: «Stockeiro»,
   con `tremen.dev` visible en la URL del resultado y en el pie. Si prefieres que la marca
   paraguas aparezca también en el nombre, las opciones son `alternateName` (Google puede usarlo
   o no) o un `name` distinto; CA-11 tiene la lista de claves cerrada precisamente para que eso
   se decida aquí y no en el código.
2. **Corrijo el diagnóstico de partida.** El `.ico` **sí** tiene 48×48 (`file` truncaba la
   lista; lo verifiqué parseando los bytes, y producción sirve el mismo fichero). Por eso el
   punto «regenerar el `.ico`» del encargo **sale** del alcance y en su lugar entra CA-7, que
   hace imposible que un `sizes` declarado vuelva a mentir.
3. **Expectativa honesta sobre el globo.** Con el `.ico` correcto, lo más probable es que Google
   aún no haya pasado a recoger el icono (la portada es indexable desde ayer). El PNG de 192 es
   **robustez**, no la causa demostrada. Lo que sí es un hueco real es el nombre: no había
   `WebSite`.
4. **D-3 se aparta del encargo a propósito.** El encargo proponía excluir el PNG en el `matcher`;
   eso sería el tercer arrastre de dos guardias ajenas que `F-SPEC-051-1` prohibió parchear. Lo
   saco por una lista exacta en `guard.ts`, como hicieron SPEC-065 y SPEC-066. Si prefieres
   aprovechar para arreglar `F-SPEC-051-1` de raíz, es otra spec y la escribo aparte.
5. **Tres guardias ajenas se amplían, y lo autorizas tú aquí** (CA-15), nombradas una a una y
   antes de implementar. Si no lo apruebas, la alternativa es no añadir el PNG y quedarse sólo
   con el `WebSite`.
6. **Versión**: PATCH sobre la de `origin/main` al abrir el PR (hoy `0.10.0` → `0.10.1`).
7. **Post-merge (tuyo)**: Search Console → inspeccionar `https://stockeiro.tremen.dev/` →
   solicitar indexación; y prueba de resultados enriquecidos sobre la portada.
