---
id: SPEC-065
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-065 Stockeiro se deja encontrar: la portada en buscadores, lo privado fuera

## Resumen
- Fase: **hecho** — implementada por sdd-implementador y verificada GREEN por sdd-verificador el 2026-09-23
- Rama: `ft/SPEC-065-stockeiro-se-deja-encontrar`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/seo/indexables.ts` (`RUTAS_INDEXABLES`, `metadatosIndexables`) | `tests/spec065-indexables.test.ts` — lista válida; especímenes `/dashboard`, `/cuenta`, vacía, sin `/` (cazan) y `[/, /ayuda]` (no caza); grafo de imports puro + mutación con `next` y `@/db/client` | Vitest verde; mutante (añadir `/dashboard` a la lista) → rojo en «la lista real es válida»; grafo puro con espécimen `next`/`@/db/client` que caza | ✅ |
| CA-2 | `src/app/layout.tsx` (`robots: { index: false, follow: true }`) | `tests/e2e/spec065-buscadores.spec.ts` «CA-2 y CA-4: páginas públicas fuera de la lista» (universo derivado de `src/app/`, sin cookies) y «páginas privadas, con sesión» (`RUTAS_CON_SESION` + `RUTAS_CON_POSICIONES`); centinela «CA-2: el universo…»; comprobación puesta roja en `tests/spec065-html.test.ts` (CA-2) | e2e verde (11 públicas derivadas del árbol, incl. `/legal/*`, + privadas con sesión); mutante (quitar `robots` del layout) → 11 rojos «no lleva <meta name=robots>»; página pública nueva sin opt-in (`/legal/prueba-verificador`) entra sola en el universo y sale `noindex, follow`; `curl` a `/login` con UA Googlebot y curl: `noindex, follow` | ✅ |
| CA-3 | `src/app/page.tsx`, `src/app/ayuda/page.tsx` (`...metadatosIndexables(ruta)`) | `tests/e2e/spec065-buscadores.spec.ts` «CA-3 y CA-4: lo que está en la lista»; especímenes en `tests/spec065-html.test.ts` (CA-3) | e2e verde; `curl` sobre `next start`: `/` → `index, follow` + un canonical `http://localhost:3200`, `/ayuda` → `index, follow` + canonical `…/ayuda`; espécimen «noindex heredado» y «otro origen» cazan en unitario | ✅ |
| CA-4 | `src/app/layout.tsx` (sin `canonical`), `src/lib/seo/indexables.ts` | `tests/e2e/spec065-buscadores.spec.ts` (los tres bloques CA-2/CA-3 aplican `problemasDeCanonical`); especímenes en `tests/spec065-html.test.ts` (CA-4: canonical del layout heredado caza; sin canonical no caza) | mutante (`alternates.canonical: '/'` en el layout raíz) → 11 rojos «canonical apunta a …/ y la página es …» en públicas y privadas; `/ayuda` lo sustituye por el suyo (su espécimen heredado caza en `spec065-html.test.ts`) | ✅ |
| CA-5 | `src/app/robots.ts` | `tests/spec065-robots.test.ts` — ruta real con identidad simulada: `production` y `preview`/`development`/`unknown`; identidad vs `VERCEL_ENV` en los dos sentidos; origen de `APP_BASE_URL`; fuente sin `process.env` ni `next/headers` | Vitest verde sobre `src/app/robots.ts` real; mutante (`!== 'production'` → `=== 'preview'`) → rojos en `development` y `unknown`; build de e2e prerenderiza `User-Agent: * / Disallow: /` | ✅ |
| CA-6 | `src/lib/auth/guard.ts` (`CRAWLER_PATHS`, `isCrawlerPath`), `src/proxy.ts`, `src/app/robots.ts`, `src/app/sitemap.ts` | `tests/e2e/spec065-buscadores.spec.ts` «CA-6» (200, tipo, sin `authjs.*`; cuerpo de no producción) | e2e verde; `curl` sin cookies: `/robots.txt` 200 `text/plain`, `/sitemap.xml` 200 `application/xml`, sin `Set-Cookie`; mutante (quitar `isCrawlerPath` del proxy) → los dos 307 | ✅ |
| CA-7 | `src/lib/auth/guard.ts`, `src/proxy.ts` (matcher y `PUBLIC_PREFIXES` intactos) | `tests/spec065-rutas-de-rastreador.test.ts` | Vitest verde; mutante (`includes` → `startsWith`) → rojos en `/robots.txtx`, `/sitemap.xml/x`, `/sitemap.xmlx`; en el build real `/robots.txtx`, `/sitemap.xml/x`, `/sitemap.xmlx`, `/robots`, `/ROBOTS.TXT` → 307 a `/login`; `/robots.txt/` → 308 a `/robots.txt`; matcher y `PUBLIC_PREFIXES` sin diff | ✅ |
| CA-8 | `src/app/sitemap.ts` | `tests/e2e/spec065-buscadores.spec.ts` «CA-8»; lectura de `<loc>` y campos inventados en `tests/spec065-html.test.ts` (CA-8) | e2e verde; cuerpo real: dos `<loc>` absolutos (`/`, `/ayuda`) sobre `APP_BASE_URL`, nada más; mutante (`lastModified`) → rojo | ✅ |
| CA-9 | sin cambio de código: `src/app/page.tsx`, `src/app/app-footer.tsx` ya lo servían | `tests/e2e/spec065-buscadores.spec.ts` «CA-9» (`request`, sin JS; constantes importadas) | e2e verde (`request`, sin JS, constantes importadas); guardias de SPEC-039/050 sin diff y en verde en `npm test` | ✅ |
| CA-10 | `docs/despliegue.md` §14 | n-a — prosa, se verifica en el gate leyendo (ADR-040) | leído: §14.1 (a) curl de `/robots.txt`, `/sitemap.xml` y canonical de la portada; §14.2 (b) Preview SSO + `X-Robots-Tag: noindex` con fecha 2026-09-23; §14.3 (c) alias `stockeiro-lemon` y canonical; §14.4 (d) Search Console por DNS de `tremen.dev` + envío del sitemap como tarea humana | ✅ |
| CA-11 | `package.json` y `package-lock.json` 0.7.1 → 0.8.0 (MINOR) | `npm test` y `npx playwright test` completos; ningún `expect` ajeno tocado (ver handoff) | `npm test` 132/2132 verde; build con variables de juguete del job E2E + `npx playwright test` 371/371 verde; `git diff origin/main...HEAD -- tests` sólo añade ficheros `spec065*` (0 expects ajenos tocados); `npm run version:check` 0.7.1 → 0.8.0 sobre árbol commiteado | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-09-23, sdd-verificador.** 11/11 CA cerrados, sobre el árbol commiteado de
`ft/SPEC-065-stockeiro-se-deja-encontrar` (HEAD `b50c6de` al verificar).

- Gates: `npm run typecheck` OK · `npm run lint` OK · `npm test` 132 ficheros / 2132 tests OK ·
  `npm run build` con `DATABASE_URL`/`AUTH_SECRET`/`AUTH_TRUST_HOST`/`APP_BASE_URL` de juguete
  del job E2E · `npx playwright test` 371/371 OK (19 de SPEC-065) · `npm run version:check`
  0.7.1 → 0.8.0.
- Mutaciones (todas revertidas, ninguna commiteada), cada una puso rojo su test:
  `isCrawlerPath` por prefijo (CA-7); `robots.ts` sólo veta `preview` (CA-5); `/dashboard` en
  `RUTAS_INDEXABLES` (CA-1); `canonical` en el layout raíz (CA-4, 11 rojos); `lastModified` en
  el sitemap (CA-8); sin `robots` en el layout (CA-2, 11 rojos); sin `isCrawlerPath` en el
  proxy (CA-6, 307 en los dos).
- Caso borde medido en el build real (`next start`, sin cookies): `/robots.txtx`,
  `/sitemap.xml/x`, `/sitemap.xmlx`, `/robots`, `/ROBOTS.TXT` → `307 → /login`;
  `/robots.txt?x=1` → 200; `/robots.txt/` → `308 → /robots.txt` (normalización de Next).
- Página pública nueva sin opt-in (`src/app/legal/prueba-verificador/page.tsx`, temporal): el
  universo de CA-2 la recogió sola y se sirvió con `noindex, follow`.
- Entorno no producción: el e2e (`unknown`) sirve `Disallow: /` sin `Allow` ni `Sitemap`; la
  rama de producción, en unitario sobre la ruta real.

Observación no bloqueante: `/robots.txt` y `/sitemap.xml` se prerenderizan en build (`○`), así
que la identidad y `APP_BASE_URL` que sirven son las del build. Es coherente con D-4 (identidad
horneada en build) y el layout ya exigía `APP_BASE_URL` en build (`metadataBase`), de modo que
no añade requisito nuevo a los Preview.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-065/. Informe HTML opcional: _qa/SPEC-065/informe.html -->

n-a: SPEC-065 no cambia nada visible en pantalla. La evidencia es de respuesta HTTP (estado,
cabeceras, `<meta name="robots">`, `<link rel="canonical">`, cuerpos de `robots.txt` y
`sitemap.xml`), recogida con `request` en el e2e y con `curl` contra `next start`; ver el
veredicto.

## Salvedades / follow-ups
<!-- IDs F-SPEC-065-1, F-SPEC-065-2… con destino (spec futura o EPIC-MEJORA). -->

Levantados por sdd-arquitecto al escribir la spec (2026-09-23), antes de implementar:

- **F-SPEC-065-1 — El alta no tiene anti-abuso.** Sin límite de frecuencia, captcha, campo
  trampa ni verificación de correo; sólo el cupo de cuentas (semilla 50, ADR-023) y el grifo
  manual de `/admin`. Con la portada indexada, unas altas basura pueden **agotar el cupo** y
  cerrar el registro a gente real. *Destino*: spec propia (capacidad nueva con decisión de
  producto; EPIC-INFRA o la épica que elija el humano). *Recomendación*: antes de enviar el
  sitemap en Search Console (F-SPEC-065-3). *Dueño de la decisión*: humano.
- **F-SPEC-065-2 — No hay tope de vigiladas por usuario.** El presupuesto del proveedor es
  ~322 símbolos distintos por ciclo (ADR-032) y el alta pide precio en el acto (ADR-038). Lo
  acota el cupo de cuentas y que los símbolos se compartan, pero no hay techo por usuario ni
  alarma de presupuesto. *Destino*: spec propia (EPIC-INFRA / producto), cuando el recuento de
  símbolos distintos se acerque al umbral de ADR-032.
- **F-SPEC-065-3 — Search Console es tarea humana.** Verificar la **propiedad de dominio
  `tremen.dev`** por registro TXT en el DNS, enviar `https://stockeiro.tremen.dev/sitemap.xml`
  y pedir la indexación de la portada. Requiere acceso al DNS y a la cuenta de Google del
  titular: no es automatizable ni verificable por un agente. *Destino*: paso manual tras el
  merge, descrito en `docs/despliegue.md` (CA-10). *Dueño*: humano (Alberto Fojo).
- **F-SPEC-065-4 — `stockeiro-lemon.vercel.app` sirve producción sin `noindex`.** Medido el
  2026-09-23: `200` y sin `X-Robots-Tag`. El `canonical` de CA-3 lo neutraliza como duplicado;
  quitarlo del todo es redirigir ese alias al dominio (o retirarlo) en el panel de Vercel.
  *Destino*: acción manual del humano, sin código. *Dueño*: humano.

Levantados por sdd-implementador al implementar (2026-09-23):

- **F-SPEC-065-5 — La comprobación de CA-10 (a) no lleva `curl | grep`.** `tests/runbook-check-alive.test.ts`
  (SPEC-031 CA-12) prohíbe cualquier `curl … | grep` en `docs/despliegue.md`. La §14.1 pide el
  `curl` y dice qué debe aparecer en la salida, en vez de filtrarla. La guardia ajena no se tocó.
  *Destino*: ninguno; queda anotado para quien lea §14.1 y eche en falta el filtro.
- **F-SPEC-065-6 — El `canonical` de la portada puede salir sin barra final.** Next resuelve
  `alternates.canonical: '/'` sobre el origen del layout; los tests comparan normalizando con
  `new URL()` (CA-3), así que con barra o sin ella el valor es correcto. Sólo afecta a quien lo
  compare a ojo, y por eso §14.1 dice «con o sin barra final». *Destino*: ninguno.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**2026-09-23, sdd-implementador — spec en `en-revision`, los 11 CA implementados; falta el verificador.**

- **Diseño tal y como está en la spec**: lista única `RUTAS_INDEXABLES = ['/', '/ayuda']` en
  `src/lib/seo/indexables.ts` (D-1, D-3: `/legal/*` fuera); `noindex, follow` en el layout raíz
  (D-2); `/` y `/ayuda` lo sustituyen con `...metadatosIndexables(ruta)` (robots indexable +
  `alternates.canonical` relativo, que el `metadataBase` del layout vuelve absoluto: no hay un
  segundo sitio que calcule el origen); `src/app/robots.ts` pregunta a `deploymentIdentity`
  (D-4); `src/app/sitemap.ts` sólo `<loc>` (D-6); `CRAWLER_PATHS` / `isCrawlerPath` en
  `src/lib/auth/guard.ts`, consultado por `src/proxy.ts` antes de Auth.js (D-5).
- **No se tocó** el `matcher` de `src/proxy.ts`, `PUBLIC_PREFIXES` ni ningún `expect` de un test
  ajeno (CA-11). El diff sobre `src/proxy.ts` son el import y dos líneas (+ comentario) en el
  cuerpo de `proxy()`.
- **Dónde están las comprobaciones que se ponen rojas**: la guardia e2e
  (`tests/e2e/spec065-buscadores.spec.ts`) usa las funciones puras de `tests/e2e/spec065.ts`,
  y `tests/spec065-html.test.ts` las pone rojas con especímenes en los dos sentidos (incluido el
  `canonical` del layout heredado por `/ayuda`, CA-4). El universo de CA-2 se deriva del árbol
  de `src/app/` en cada ejecución; las privadas son `RUTAS_CON_SESION` + `RUTAS_CON_POSICIONES`
  de `tests/e2e/rutas.ts`, pedidas con la cuenta reutilizada `spec040-filas@example.com` puesta
  en `completo` (no gasta cupo del grifo).
- **Gates locales, sobre el árbol commiteado** (build con los valores de juguete del job `E2E`
  de `ci.yml`): `npm run typecheck` OK · `npm run lint` OK · `npm test` 132 ficheros / 2132 tests
  OK · `npx playwright test` 371/371 OK (18 de SPEC-065) · `npm run version:check` 0.7.1 → 0.8.0
  (MINOR, `package.json` y `package-lock.json`). `_qa/` restaurado tras la e2e.
- **Pendiente tras mergear (humano)**: la comprobación de §14.1 de `docs/despliegue.md` sobre el
  dominio, cuyo resultado se pega aquí (CA-10 a); y F-SPEC-065-1/3/4.

Notas del arquitecto (antes de implementar), que siguen valiendo:

- **Las mediciones de la spec (§Problema) son del 2026-09-23** y se hicieron con `curl -I` sin
  cookies contra producción, el alias `stockeiro-lemon` y dos Preview. Tras mergear (mergear es
  desplegar, ADR-018), repetirlas sobre el dominio es la comprobación post-despliegue que pide
  CA-10 (a); su resultado se pega aquí.
- **No tocar el `matcher` de `src/proxy.ts` ni `PUBLIC_PREFIXES`** (D-5). Dos ficheros de
  `tests/` (`cuenta-rutas`, `legal-rutas-publicas`) congelan el literal del matcher y otros leen esas guardias; tocarlo es exactamente el tercer arrastre que
  `F-SPEC-051-1` manda a EPIC-FIX.
- **El e2e no es producción**: `deploymentIdentity.environment` sale `unknown` en
  `tests/e2e/server.mjs`, así que `/robots.txt` servido ahí es el de `Disallow: /`. La rama de
  producción se prueba en unitario sobre la ruta real (CA-5), no cambiando el entorno del
  servidor de e2e (que cambiaría también lo que pinta el pie).
- **`canonical` nunca en el layout raíz** (CA-4): Next lo heredaría a todas las rutas.
