---
id: SPEC-065
tipo: spec
epica: EPIC-MEJORA
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-09-23, por: sdd-arquitecto}
---
# SPEC-065 — Stockeiro se deja encontrar: la portada en buscadores, lo privado fuera

## Problema

El humano (Alberto Fojo, 2026-09-23) quiere que la web pública de Stockeiro
—`https://stockeiro.tremen.dev`, Next.js App Router sobre Vercel— **aparezca en los buscadores**.
Hoy no puede, y no por falta de contenido: la portada ya tiene su `title`, su `description`
(`QUE_HACE`, SPEC-050 CA-11) y el `metadataBase` de SPEC-051. Lo que falla es **lo que ve el
rastreador antes que la página**.

Medido el **2026-09-23** con `curl -I`, sin cookies:

| Petición | Respuesta |
|---|---|
| `https://stockeiro.tremen.dev/robots.txt` | **`307` → `/login`** |
| `https://stockeiro.tremen.dev/sitemap.xml` | **`307` → `/login`** |
| `https://stockeiro.tremen.dev/` | `200`, sin `X-Robots-Tag` |
| `https://stockeiro-lemon.vercel.app/` (alias de **producción**) | `200`, sin `X-Robots-Tag` — **la misma portada en un segundo origen** |
| dos despliegues de **Preview** (`stockeiro-a2lnuxn97-…vercel.app`, `stockeiro-rhhaluelj-…vercel.app`), `/` y `/robots.txt` | `302` al SSO de Vercel **y** `X-Robots-Tag: noindex` |

Leído en código el mismo día:

- **No existe** `src/app/robots.ts` ni `src/app/sitemap.ts`. Y aunque existieran, **las dos rutas
  caen dentro del `matcher` de `src/proxy.ts`** y no son públicas para `isPublicPath`
  (`src/lib/auth/guard.ts`): el proxy las manda a `/login`. Es el mismo fallo silencioso que ya
  mordió a `icon.svg` (SPEC-047) y a la tarjeta social (SPEC-051): la petición del rastreador no
  lleva sesión.
- **Sólo una página declara `noindex`**: `/reset-password/[token]`. `/login` y `/register` **no
  declaran metadatos**; `/forgot-password` y `/cuenta-borrada` declaran `title` y `description`
  y nada más.
- **Ninguna página declara `canonical`**, y la portada se sirve en dos orígenes de producción.

Cubre **CE-M1** (no cambia ningún dato, cálculo ni regla: cambia **cómo se presenta** la app a
quien no es una persona), **CE-M2** (petición del humano y medición con fecha, arriba) y
**CE-M3** (sin esquema, sin proveedor y **sin ADR**: todas las decisiones de abajo son
locales a esta superficie y se escriben en §Diseño, como hizo SPEC-051).

## Usuarios / roles afectados

- **Visitante anónimo que llega desde un buscador**: aterriza en la portada, que es la que ya
  explica qué hace la app, qué no hace y el descargo (SPEC-039, SPEC-050, SPEC-035).
- **Rastreadores** (Googlebot, Bingbot…): reciben `robots.txt` y `sitemap.xml` en vez de un
  rebote a `/login`; ven `noindex` en todo lo que no aporta y `canonical` en lo que sí.
- **Usuario con sesión**: **nada cambia**. Las páginas privadas siguen exigiendo sesión (RN-03).
- **Operador (humano)**: tareas manuales fuera de código —Search Console, alias de Vercel—,
  recogidas en `docs/despliegue.md` (CA-10) y como follow-ups.

## Diseño

Seis decisiones. Las dos primeras son las que impiden que una página nueva se indexe por
descuido.

- **D-1 — Indexar es opt-in, con UNA lista.** Las rutas indexables viven en **una sola
  constante** de un módulo **puro** (sin Next, sin base de datos, sin Auth.js: lo importan el
  sitemap, las páginas y los tests). Propuesta para el gate: **`/` y `/ayuda`**. De esa lista
  **se deriva** el sitemap (CA-8) y contra ella se comprueba lo que cada página sirve (CA-2,
  CA-3). No hay una segunda lista escrita a mano en ningún sitio.
- **D-2 — Por defecto, `noindex`.** El layout raíz declara `robots` con `index: false` (y
  `follow: true`, para que el rastreador siga los enlaces de una página no indexable hacia las
  que sí lo son). Cada página de la lista de D-1 lo **sustituye** por uno indexable y declara su
  `canonical`. Consecuencia buscada: **una página nueva nace invisible** para el buscador hasta
  que alguien la añade a la lista. Es el fallo seguro: olvidarse cuesta visibilidad, nunca
  privacidad. `/reset-password/[token]` conserva su `follow: false`, que es más estricto y
  tiene su porqué (ADR-015 pto. 9).
- **D-3 — `/legal/*` NO se indexa (a confirmar en el gate).** `/legal/aviso-legal` publica el
  **domicilio de una persona física** (`TITULAR`, SPEC-035). La ley pide que sea **accesible**
  desde la web, no que un buscador lo sirva a quien busque ese nombre. Las páginas legales
  siguen públicas y enlazadas desde el pie; sólo quedan fuera de la lista de D-1. Cambiarlo es
  añadir rutas a la lista, sin tocar nada más.
- **D-4 — El entorno que manda en `robots.txt` es el de la identidad del despliegue**, no una
  clave nueva ni la cabecera `Host`. `deploymentIdentity.environment` (`src/lib/version/`,
  SPEC-038) ya lleva `production` / `preview` / `development` / `unknown` desde `VERCEL_ENV`,
  horneado en build, y es la misma fuente que pinta el entorno en el pie. **Sólo `production`
  permite rastrear**; cualquier otro valor —incluido `unknown`, que es lo que da una máquina
  local o el e2e— responde `Disallow: /`. En producción: `Allow: /`, `Disallow: /api/` y la
  línea `Sitemap:` absoluta sobre **`appBaseUrl()`** (ADR-015 pto. 8, SPEC-055).
  - **Por qué no se listan las rutas privadas en `Disallow`** (se aparta de la petición, y va
    al gate): (a) `robots.txt` es público, y listar `/admin`, `/cartera`… es publicar el mapa
    de la zona privada; (b) una URL vetada en `robots.txt` **no se rastrea, pero puede
    indexarse** como URL desnuda si alguien la enlaza, porque el buscador nunca llega a ver su
    `noindex`; (c) sin sesión, toda ruta privada ya responde `307 → /login`, que es `noindex`
    por D-2: el rastreador no puede ver nada de dentro. `/api/` sí se veta: devuelve JSON y no
    tiene dónde llevar un `<meta name="robots">`.
  - **Lo que Vercel ya hace en Preview, medido y no supuesto**: el 2026-09-23 dos despliegues de
    Preview respondieron `302` al SSO de Vercel (*Deployment Protection*) **con**
    `X-Robots-Tag: noindex`, también en `/robots.txt`. D-4 es la tercera capa, no la única: si
    un día se desactivara la protección, los Preview seguirían diciendo `Disallow: /`.
- **D-5 — `robots.txt` y `sitemap.xml` salen del proxy antes de Auth.js por una lista propia,
  de emparejamiento EXACTO, en `src/lib/auth/guard.ts`.** No se añaden al `matcher` de
  `src/proxy.ts` —sería el tercer arrastre de ese literal, y `F-SPEC-051-1` ya escribió que el
  tercero va a **EPIC-FIX** con ficha propia, no parcheado aquí— ni a `PUBLIC_PREFIXES`, que es
  la lista de **páginas** exentas de RN-03 y empareja **por prefijo** (`/sitemap.xml/lo-que-sea`
  quedaría abierto). `guard.ts` sigue siendo el **único sitio** donde se declara una excepción
  a RN-03; lo que cambia es que ahora tiene dos listas con dos semánticas, cada una con su
  porqué escrito al lado. El proxy las consulta a las dos **antes** de instanciar Auth.js, así
  que el rastreador no se lleva `authjs.*` (SPEC-035 CA-13).
- **D-6 — El sitemap no inventa fechas.** Sólo `<loc>`: ni `lastmod`, ni `changefreq`, ni
  `priority`. Los dos últimos los ignora Google; un `lastmod` que no sale de un cambio real
  **enseña al buscador a desconfiar** del campo. Si algún día hay una fecha verdadera, se añade
  con su fuente.

**Qué ya está y no se toca**: el descargo (`DESCARGO_BREVE`, SPEC-035 CA-9) va en el pie de
**todas** las páginas —portada incluida— y `QUE_NO_HACE` está en la portada (SPEC-050). Para
una app de finanzas (*YMYL*, en la jerga de los buscadores) es lo que toca, y ya existe: esta
spec **no añade ni reescribe** un solo literal; sólo comprueba que el rastreador, que no ejecuta
JavaScript, lo recibe en el HTML (CA-9).

## Criterios de aceptación

Unitarios con **Vitest**; los que dicen *lo que se sirve*, **e2e Playwright** contra el build
real (`tests/e2e/server.mjs`), con peticiones **sin cookies** y, donde se dice, **sin
ejecutar JavaScript** (`request`, no navegador), que es como llega un rastreador. Ningún CA
escribe a mano una URL, una ruta de la lista de D-1 ni un texto que ya tenga constante: los
dos lados de cada comparación se **derivan**.

### Rebanada 1 — Qué se puede indexar

- **CA-1 (Una lista, y sólo de rutas públicas).**
  Dada la lista de rutas indexables de D-1,
  cuando se recorre,
  entonces **toda** ruta de la lista es pública según `isPublicPath`, la lista no está vacía y
  contiene `/`. Especímenes, en las dos direcciones: una lista con `/dashboard` o con `/cuenta`
  **se caza**; la lista propuesta (`/`, `/ayuda`) **no**. El módulo es puro: su grafo de imports
  no alcanza Next, Auth.js ni `src/db/` (mismo molde que `tests/legal-import-graph.test.ts`).

- **CA-2 (Lo que no está en la lista se sirve con `noindex`, sin tener que decirlo).**
  Dado el universo de páginas públicas **derivado** del árbol (`page.tsx` bajo `src/app/`,
  grupos de ruta fuera, un valor de muestra en cada segmento dinámico, filtrado por
  `isPublicPath`) más las rutas con sesión que ya censa `tests/e2e/rutas.ts`,
  cuando se pide cada una que **no** esté en la lista de D-1 (las públicas sin cookies; las
  privadas con sesión),
  entonces su HTML lleva `<meta name="robots">` con `noindex`. La aserción es **por elemento**
  y lleva **centinela**: el universo contiene al menos `/login`, `/register`,
  `/forgot-password` y una `/reset-password/<token>` (pertenencia, no igualdad: una página
  pública nueva no rompe este CA). El espécimen que prueba el *por defecto* es **`/login`**, que
  hoy no declara metadatos: si sale `noindex` es por D-2 y no por una línea suya.

- **CA-3 (Lo que está en la lista se deja indexar y dice cuál es su URL).**
  Dada cada ruta de la lista de D-1,
  cuando se pide sin cookies,
  entonces responde `200`, su `<meta name="robots">` —si lo lleva— **no** contiene `noindex` ni
  `nofollow`, y lleva **exactamente un** `<link rel="canonical">` cuyo `href`, normalizado con
  `new URL()`, es igual a `new URL(ruta, appBaseUrl()).href`. En la dirección contraria: quitar
  la ruta de la lista la hace caer en CA-2 sin tocar el test.

- **CA-4 (Ninguna página se declara copia de otra).**
  Dado el mismo universo de CA-2 más la lista de D-1,
  cuando una página lleva `<link rel="canonical">`,
  entonces apunta a **su propia** URL (misma comparación normalizada que CA-3). Espécimen que
  debe cazar: un `canonical` declarado en el layout raíz, que Next heredaría a todas las rutas
  y haría de `/ayuda` una copia de `/`. Espécimen que no debe cazar: una página sin
  `canonical`.

### Rebanada 2 — `robots.txt`

- **CA-5 (La política depende del entorno del despliegue, y sólo producción deja rastrear).**
  Dada la política de D-4, **verificada sobre la ruta real** (`src/app/robots.ts`, importada
  con la identidad de despliegue simulada) y no sobre una copia,
  cuando el entorno es `production`,
  entonces permite `/`, veta `/api/` y declara `Sitemap:` igual a
  `new URL('/sitemap.xml', appBaseUrl()).href`;
  y cuando el entorno es **cualquier otro** —`preview`, `development`, `unknown`—,
  entonces veta `/` y no permite nada. Especímenes en las dos direcciones: los cuatro valores.
  La ruta **no lee** `VERCEL_ENV` ni otra clave de entorno directamente, ni la cabecera `Host`:
  la pregunta es a la identidad de despliegue (D-4).

- **CA-6 (`robots.txt` y `sitemap.xml` se alcanzan sin sesión y sin dejar rastro).**
  Dado el build real,
  cuando se piden `/robots.txt` y `/sitemap.xml` **sin cookies**,
  entonces responden `200` —no `307`—, con `text/plain` y un tipo XML respectivamente, y
  **sin** `Set-Cookie` de `authjs.*` (SPEC-035 CA-13). El cuerpo de `/robots.txt` en el e2e es
  el de **no producción** (el servidor de e2e no es producción, D-4), lo que prueba de paso el
  camino real de un Preview.

- **CA-7 (La excepción es exacta, no un prefijo).**
  Dado el predicado que el proxy consulta para las rutas de rastreador (D-5),
  cuando se le pregunta,
  entonces es cierto para `/robots.txt` y `/sitemap.xml` y **falso** para `/robots.txtx`,
  `/sitemap.xml/x`, `/sitemap.xmlx` y `/robots`. Y `isPublicPath` responde **lo mismo que
  antes** para las rutas públicas y privadas que ya prueban sus tests (RN-03 no se ensancha
  a páginas).

### Rebanada 3 — `sitemap.xml`

- **CA-8 (El sitemap es la lista de D-1, en absoluto y sin inventar).**
  Dado `/sitemap.xml` servido por el build real,
  cuando se leen sus `<loc>`,
  entonces el **conjunto** es igual al de `new URL(ruta, appBaseUrl()).href` para cada ruta de
  la lista de D-1 —los dos lados derivados—; cada `<loc>` es absoluto y de origen
  `appBaseUrl()`; y no hay `lastmod`, `changefreq` ni `priority` (D-6). Añadir una ruta a la
  lista la hace aparecer aquí sin tocar el test.

### Rebanada 4 — Lo que el rastreador lee de la portada

- **CA-9 (El descargo llega en el HTML, sin JavaScript).**
  Dada la portada pedida **sin cookies y sin ejecutar JavaScript**,
  cuando se lee el HTML de la respuesta,
  entonces contiene `DESCARGO_BREVE` y `QUE_NO_HACE`, y su `<meta name="description">` es
  `QUE_HACE` —las tres **importadas de sus módulos** (`src/lib/legal/content.ts`,
  `src/lib/help/content.ts`), sin un literal nuevo—. Las guardias de fuente única de SPEC-039 y
  SPEC-050 siguen en verde sin tocarse.

### Rebanada 5 — Runbook y no regresión

- **CA-10 (El runbook dice cómo comprobarlo y qué es del humano).**
  Dado `docs/despliegue.md` (ADR-018: el runbook es parte del trabajo),
  cuando se lee,
  entonces tiene una sección de buscadores que dice: (a) cómo comprobar tras mergear, con
  `curl`, que `/robots.txt` y `/sitemap.xml` responden `200` en el dominio y que la portada
  lleva su `canonical`; (b) lo medido sobre los Preview (SSO + `X-Robots-Tag: noindex`, con
  fecha); (c) que `stockeiro-lemon.vercel.app` sirve producción y cómo lo neutraliza el
  `canonical`; y (d) los pasos de **Google Search Console** como tarea **humana** —verificar la
  propiedad de dominio `tremen.dev` por registro DNS y enviar el sitemap—. Se verifica **en el
  gate, leyendo**: es prosa, y por **ADR-040** no lleva guardia.

- **CA-11 (Cero regresión, y ninguna guardia ajena se afloja).**
  Dada la batería completa (`npm test` y `npx playwright test`) sobre un build del árbol
  commiteado,
  cuando se ejecuta,
  entonces pasa entera, y **ningún `expect` de un test ajeno a esta spec se modifica ni se
  afloja** —en particular las guardias que congelan el literal del `matcher` de
  `src/proxy.ts` (SPEC-035, SPEC-036, SPEC-047, SPEC-051), que D-5 no toca—. Si alguna tuviera
  que cambiar, **no se re-encuadra en la rama**: se escala al gate (FOUNDATION, 3.ª
  convención). Se comprueba en el gate con el diff, no con una guardia congelada
  (ADR-031/ADR-037). La versión sube según **ADR-024/ADR-033**, en los dos ficheros.

## Entidades y reglas afectadas

- **RN-03** (acceso autenticado): **no se ensancha a páginas**. Se añaden dos rutas no-página
  (`/robots.txt`, `/sitemap.xml`) a la excepción, declaradas en `src/lib/auth/guard.ts`, que
  sigue siendo su único hogar (D-5, CA-7). Ninguna devuelve un dato de usuario.
- **RN-01**: intacta. Ningún flujo nuevo lee la base.
- **ADR-015 pto. 8 / SPEC-055**: el origen absoluto sale de `appBaseUrl()`, nunca del `Host`
  (CA-3, CA-5, CA-8).
- **ADR-018**: mergear es desplegar; el runbook entra en el mismo trabajo (CA-10).
- **ADR-024 / ADR-033**: subida de versión.
- **ADR-031 / ADR-037 / ADR-040**: por qué CA-2 y CA-4 recorren el árbol **por elemento con
  centinela**, por qué CA-11 es criterio de gate y por qué CA-10 no lleva guardia.
- **SPEC-035** (descargo, legales, CA-13 sin cookies), **SPEC-038** (identidad de despliegue),
  **SPEC-039/SPEC-050** (portada y fuente única de sus textos), **SPEC-047/SPEC-051** (activos
  que salen del proxy, `metadataBase`), **F-SPEC-051-1** (el literal del `matcher`).
- Términos de `dominio.md`: ninguno nuevo.

## Riesgos

- **R-1 — Registros basura.** El alta **no tiene** límite de frecuencia, captcha ni campo
  trampa (leído en `src/app/(auth)/actions.ts` y `src/lib/registration/`). Lo que la acota hoy
  es el **cupo de cuentas** (semilla **50**, ADR-023, ajustable en `/admin`) y el grifo manual.
  El daño plausible de más visibilidad no es de coste sino de **aforo**: unas cuantas altas
  basura agotan el cupo y cierran el registro a gente real. → **F-SPEC-065-1**.
- **R-2 — Coste del proveedor.** Más cuentas ⇒ más símbolos distintos. El plan de precios
  aguanta **~322 símbolos distintos** por ciclo (ADR-032) y el alta pide precio en el acto
  (ADR-038). Hay tope de **cuentas** (50) pero **no** de vigiladas por usuario. El riesgo está
  acotado por el cupo y porque los símbolos se comparten entre usuarios, pero no cerrado. →
  **F-SPEC-065-2**.
- **R-3 — Legal.** Las páginas existen (SPEC-035) y esta spec **no cambia** lo que prometen:
  no añade analítica, ni scripts, ni cookies (CA-6 lo comprueba para las rutas nuevas), y la
  verificación de Search Console es por **DNS**, fuera de la página. Si en el futuro se añade
  analítica, `/legal/privacidad` cambia y ese texto es del **humano** (el titular), no de la IA.
  El único efecto legal de indexar es D-3, y va al gate.
- **R-4 — Contenido duplicado.** `stockeiro-lemon.vercel.app` es producción (`VERCEL_ENV =
  production`): recibe el mismo `robots.txt` permisivo. Lo neutraliza el `canonical` (CA-3), y
  quitarlo del todo es una acción en el panel de Vercel. → **F-SPEC-065-4**.
- **R-5 — Indexar no es posicionar.** Una app de finanzas sin contenido editorial compite mal
  en buscadores (*YMYL*). Esta spec entrega que **se pueda** encontrar por su nombre, no que
  salga arriba por «alertas de bolsa». Nadie debería leer el CA-8 verde como una promesa de
  tráfico.

## Fuera de alcance

- **Search Console / Bing Webmaster**: verificación de propiedad, envío del sitemap y petición
  de indexación. Es tarea **humana** con acceso al DNS de `tremen.dev`. → **F-SPEC-065-3**.
- **Anti-abuso del registro** (límite de frecuencia, captcha, campo trampa, verificación de
  correo): capacidad nueva con decisión de producto. → **F-SPEC-065-1**.
- **Tope de vigiladas por usuario** o alarma de presupuesto del proveedor. → **F-SPEC-065-2**.
- **Redirigir o retirar el alias `stockeiro-lemon.vercel.app`** (panel de Vercel). →
  **F-SPEC-065-4**.
- **Arreglar el literal del `matcher`** de `src/proxy.ts`: es `F-SPEC-051-1`, va a EPIC-FIX, y
  D-5 lo esquiva a propósito en vez de ser su tercer arrastre.
- **Datos estructurados** (JSON-LD), `hreflang`, tarjeta social distinta por página
  (`F-SPEC-051-2`), analítica, contenido editorial para posicionar.
- **Cambiar ningún texto** de la portada, la ayuda o el descargo.

## Notas para el gate humano

1. **Qué se indexa (D-1, D-3).** Propuesta: **`/` y `/ayuda`**. `/legal/*` queda en `noindex`
   porque el aviso legal publica tu domicilio; seguiría accesible y enlazado desde el pie. Si
   prefieres indexar `/legal/terminos` o `/legal/privacidad`, es añadirlas a la lista: cero
   diseño nuevo.
2. **`robots.txt` no lista las rutas privadas (D-4)**, al contrario de lo que se pidió. El
   porqué está en D-4: publicaría el mapa de la zona privada y no protege más que el `307` +
   `noindex` que ya hay. Si lo quieres igualmente, dilo y entra como `Disallow` explícito.
3. **Orden sugerido tras mergear**: hacer **F-SPEC-065-1** (anti-abuso del alta) **antes** de
   enviar el sitemap en Search Console (F-SPEC-065-3). No es bloqueante —el cupo de 50 limita
   el daño a *aforo*, no a coste—, pero es lo barato de hacer antes de que llegue tráfico.
4. **Versión**: se propone **MINOR** (ADR-024: capacidad visible nueva — la app aparece en
   buscadores). Si lo lees como PATCH, se cambia en la implementación.
5. **Encaje en EPIC-MEJORA** (CE-M3): sin esquema, sin proveedor, **sin ADR**. Las seis
   decisiones son locales a la superficie que se presenta a los rastreadores, igual que las
   siete de SPEC-051 lo fueron a la tarjeta social.
