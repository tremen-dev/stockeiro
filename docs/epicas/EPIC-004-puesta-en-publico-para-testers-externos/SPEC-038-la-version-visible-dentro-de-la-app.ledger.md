---
id: SPEC-038
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-038 La version visible dentro de la app

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-038-la-version-visible-dentro-de-la-app`
- Versión de producto: **0.1.0 → 0.2.0** (`npm version minor --no-git-tag-version`, en `852a9d6`).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/app/app-footer.tsx` (fila `app-footer-version`, `data-testid="version"`), `src/app/layout.tsx` (sin cambios: el pie ya iba en el layout raíz), `src/app/globals.css` (`.app-footer-version`) | `tests/e2e/version-en-el-pie.spec.ts` «CA-1» (4 casos: `/login` y `/legal/terminos` sin sesión · `/dashboard` y `/vigiladas` con sesión y con el MISMO texto · el pie de SPEC-035 y el feedback de SPEC-039 intactos) | Ejecutado. `npm run test:e2e` 227/227, con los 4 casos de CA-1 verdes. Vista propia: `_qa/SPEC-038/pie-360.png` **regenerado por mi ejecucion** ensena la fila en `/legal/terminos` sin sesion. | ✅ |
| CA-2 | `src/lib/version/presentation.ts` (`etiquetaDeVersion`, `SEPARADOR`, `LARGO_DEL_COMMIT_CORTO`), `src/app/app-footer.tsx` | `tests/version-presentacion.test.ts` «CA-2» (5) · `tests/e2e/version-en-el-pie.spec.ts` «CA-2» (2: el orden semver→commit→fecha en el navegador · es TEXTO — ni `img`/`svg`, ni `title=`, ni `::before`/`::after`, `user-select` ≠ `none`, y lo que un `Range` se llevaría al portapapeles es exactamente el texto de la fila) | Ejecutado. El caso e2e «es TEXTO» pasa: ni `img`/`svg`, ni `title=`, `user-select` distinto de `none`, `::before`/`::after` vacios y el `Range` devuelve exactamente el texto de la fila. Leido en mi captura: `v0.2.0 · entorno desconocido · baec1cd · 2026-08-20 22:54 UTC`, semver el primero. | ✅ |
| CA-3 | `src/lib/version/identity.ts` (`DeploymentIdentity` gana `version`), `src/app/api/version/route.ts` (sin cambio de código: serializa la identidad entera; sí de documentación) | `tests/version-endpoint.test.ts` (conjunto de claves = `{builtAt, commit, environment, version}`, semver válido, semver inválido → `unknown` y no crudo, canal vacío → las CUATRO en `unknown`, `no-store`, `force-dynamic`) · `tests/e2e/version-en-el-pie.spec.ts` «CA-4» (el contrato exacto contra la app corriendo) | Ejecutado contra la app corriendo (`next start` sobre el build de esta rama): `GET /api/version` devuelve `{version:0.2.0, commit:baec1cd99301…, environment:unknown, builtAt:2026-08-20T22:54:54.278Z}` con `cache-control: no-store`. `dynamic = 'force-dynamic'` leido en `route.ts`. **Cuatro claves, ni una mas.** | ✅ |
| CA-4 | `src/lib/version/presentation.ts` (`construidoISO`), `src/app/app-footer.tsx` (`<time dateTime=…>`) | `tests/e2e/version-en-el-pie.spec.ts` «CA-4» (3: sin sesión · con sesión · el `mailto:` del feedback). Compara **el mismo despliegue**: `page.request` comparte contexto con la navegación. Semver `=== 'v' + body.version`; `body.commit.startsWith(mostrado)`; `Date.parse(datetime) === Date.parse(body.builtAt)` | Ejecutado. Compare yo mismo el pie con el endpoint del MISMO despliegue: `v0.2.0` es `v` + `version`; `baec1cd` es prefijo exacto de `baec1cd99301d2305b9a67eee522c36580f1787e`; `2026-08-20 22:54 UTC` es el mismo instante que `2026-08-20T22:54:54.278Z`. Mas los 3 casos e2e verdes. | ✅ |
| CA-5 | `src/lib/version/presentation.ts` (recibe la identidad como argumento y nada más) | `tests/version-presentacion.test.ts` «CA-5» (4: no cita `process.env` · no cita `STOCKEIRO_` · no abre `package.json` —sobre el código sin comentarios— · con otra identidad, otra etiqueta) | Leido: `etiquetaDeVersion` recibe la identidad como unico argumento y no hay `process.env`, ni `STOCKEIRO_`, ni apertura de `package.json` fuera de un comentario. `grep` propio sobre `src/`: **ningun** modulo abre `package.json`. | ✅ |
| CA-6 | `next.config.mjs` (lee `package.json` y pasa `version` a `buildIdentity`), `src/lib/version/build-identity.mjs` (`STOCKEIRO_VERSION`, sin validar) | `tests/version-build-channel.test.ts` «CA-6» (4: el canal aporta el semver de `package.json` · `buildIdentity` lo recibe como PARÁMETRO · lista cerrada de lectores de `package.json` = `next.config.mjs` + `scripts/check-version-bump.mjs` · ningún módulo bajo `src/` lo abre) · `tests/version-build-identity.test.ts` (las cuatro claves) | Ejecutado `grep` propio de lectores de `package.json` en todo el repo sin `node_modules`: exactamente `next.config.mjs` y `scripts/check-version-bump.mjs`, y **cero** bajo `src/`. La excepcion del gate esta declarada (F-SPEC-038-11) y su lista es cerrada. | ✅ |
| CA-7 | `src/lib/version/presentation.ts` (importa `identity.ts`; `identity.ts` no importa nada) | `tests/version-import-graph.test.ts` — bloque nuevo «SPEC-038 CA-7» (5): la pieza existe · el endpoint no alcanza la presentación ni el pie · no arrastra `react`/`react-dom`/`next/link`/`next/font/google` · **`identity.ts` no importa NADA del proyecto** · la presentación SÍ importa `identity.ts`. Los 4 casos de SPEC-031 siguen tal cual, con 3 prefijos prohibidos más | **Ejecutado PARANDO Postgres.** Con un Postgres efimero arriba: `/api/version` 200 y `/login` 200. Con Postgres **parado**: `/api/version` sigue dando **200** con las cuatro claves y `no-store`, mientras `/register` —que si lee la base— da **500**. Mas `version-import-graph` verde con sus 5 casos nuevos. | ✅ |
| CA-8 | `src/lib/version/identity.ts` (`SEMVER`, sin `trim` deliberado) | `tests/version-identity.test.ts` «SPEC-038 CA-8» (19: 4 válidos + 14 inválidos —vacío, solo espacios, con espacios alrededor, con espacio dentro, `v1.2`, `v1.2.3`, `1.2.3-beta`, `1.2.3+build.7`, `latest`, `1.2.3.4`, `01.2.3`, `^1.2.3`, ausente, nulo— + no contamina a las otras tres claves) | Re-ejecutado `tests/version-identity.test.ts` (19 casos) en verde. Leido el `SEMVER` de `identity.ts`: sin `trim` previo, sin `v`, sin prelanzamiento, sin metadatos y sin ceros a la izquierda — la regla que el CA enumera. | ✅ |
| CA-9 | `src/lib/version/presentation.ts` (`DESCONOCIDO`, `filter` antes del `join`) | `tests/version-presentacion.test.ts` «CA-9» (4: ninguna pieza vacía · nunca la palabra cruda `unknown` · nunca un valor inventado (`v\d`, `\d{4}-\d{2}-\d{2}`) · nunca dos separadores seguidos, que serían el hueco) | Visto en mi captura: «entorno desconocido» con palabras, sin hueco, sin dos separadores seguidos y sin la palabra cruda `unknown`. Unit «CA-9» (4 casos) verde. | ✅ |
| CA-10 | `src/lib/version/presentation.ts` (`entorno: null` en producción), `src/app/globals.css` (`.app-footer-version-entorno`) | `tests/version-presentacion.test.ts` «CA-10» (4: producción calla y no cita `production` · `preview` y `development` se muestran · va justo detrás del semver) | Unit «CA-10» (4) verde. En mi ejecucion local `environment` vale `unknown`, y el pie **si lo dice**, destacado y justo detras del semver: es el escenario que el CA quiere que se vea. | ✅ |
| CA-11 | `src/lib/version/presentation.ts` (pura y total) | `tests/version-presentacion.test.ts` «CA-11» (8): los **siete** casos que pide el CA —completa, commit corto, commit largo, semver desconocido, `builtAt` desconocido, `environment` desconocido, los cuatro a la vez— con el texto exacto esperado, más un caso que recorre los siete y exige que ninguno lance | Unit «CA-11» (8) verde, con los siete textos exactos y el caso que recorre los siete exigiendo que ninguno lance. | ✅ |
| CA-12 | `scripts/check-version-bump.mjs`, `package.json` (`version:check`) | `tests/version-bump-gate.test.ts` (43 casos): comparación pura (`parsearSemver` ×10, `compararSemver` ×4 incl. `0.10.0 > 0.9.0`), rutas de aplicación (×10, incl. `srcado/` ≠ `src/` y separadores de Windows), veredicto (×9: sube, no sube, mensaje con el comando y el fichero culpable, solo docs, diff vacío, baja con docs, baja con código, semver inválido en rama y en base), ejecución real (×5: `--help`, bandera desconocida → 2, base inexistente → 2, `--base HEAD` → 0, **esta rama** → 0), y qué no hace (×4: solo `node:*`, sin red, sin escrituras, `git` solo `diff`/`show`/`rev-parse`) | **Ejecutado por mi, con casos limite.** Funcion pura: `0.10.0` vs `0.9.0` sube; `0.9.0` vs `0.10.0` es **bajada** y falla; igual con codigo tocado falla; **solo documentacion pasa**; semver invalido en rama y en base falla; `srcado/` no es `src/`. Ejecucion real: `--base 852a9d6` (mismo `0.2.0` tocando `src/`) sale **1** con el comando en el mensaje; `--base HEAD` sale 0; base inexistente sale **2**; bandera desconocida 2; `--help` 0. Y `npm run version:check` sale 0 diciendo que sube de 0.1.0 a 0.2.0. | ✅ |
| CA-13 | `.github/workflows/ci.yml` (step `Version bump` en el job `Checks` + `fetch-depth: 0` en su checkout) | `tests/version-bump-gate.test.ts` «CA-13» (9: existe · ejecuta `npm run version:check` y solo eso · en el job `Checks` · `if: !cancelled()` · `fetch-depth: 0` · no invoca `check-alive` · no habla con ningún host · `vercel.json` idéntico · `package.json` apunta al fichero) · `tests/spec-031-frontera.test.ts` CA-13.1 (lista cerrada de 9 → 10 entradas) | Leido `ci.yml`: step `Version bump` en el job `Checks`, `if: !cancelled()`, `run: npm run version:check`, con `fetch-depth: 0` en el checkout de ese job y solo de ese. `deploy-gate.yml` y `vercel.json` con **diff vacio** contra `origin/main`. Listas cerradas de CA-13.1 (10 entradas) y de 9.1/9.3 verdes. | ✅ |
| CA-14 | `next.config.mjs` (`STOCKEIRO_VERSION` se calcula), `.env.example` (sin cambios) | `tests/spec-031-frontera.test.ts` CA-13.3 (el bucle de variables calculadas pasa de 3 a 4; las claves declaradas en `.env.example` **no cambian** — ver F-SPEC-038-14 para la cifra) · `tests/version-bump-gate.test.ts` «CA-14» (ni en `.env.example` ni en el workflow) | `git diff origin/main -- .env.example` **vacio**; `grep STOCKEIRO` sobre `.env.example` y `ci.yml`: **cero coincidencias**. Conte yo las claves declaradas: **once**. La cifra «de diez a diez» del texto del CA sigue estando mal (ver V-SPEC-038-1); la **propiedad** se cumple entera. | ✅ |
| CA-15 ⚠️*enmendado* | `scripts/check-alive.mjs` — la comparación de identidad **no se ha tocado**: sigue siendo `identidad.commit.trim().toLowerCase() === esperado` (línea 219), nunca el semver. Del script solo se abre la **guardia de forma** (CA-15.1); plazo, códigos de salida, modo *smoke*, semántica de `unknown` y `deploy-gate.yml` intactos | `tests/check-alive.test.ts` «CA-9», «CA-10», «CA-11» verdes sin tocar una expectativa · caso nuevo «el semver NO participa: el veredicto lo decide el commit» (dos cuerpos con el MISMO `version: 0.2.0` y distinto commit → **0** y **1**) · `tests/check-alive-carrera.test.ts`, `tests/runbook-check-alive.test.ts` y `tests/deploy-gate-workflow.test.ts` verdes (el step sigue pasando `--commit ${{ github.sha }}`) | **Ejecutado.** Dos cuerpos con el MISMO `version: 0.2.0` y distinto commit, contra el script de esta rama: **0** y **1**. La comparacion sigue siendo `identidad.commit.trim().toLowerCase() === esperado`, sin tocar. Modo *smoke*, codigos de salida, plazo y semantica de `unknown` reproducidos y sin cambio; `deploy-gate.yml` con diff vacio. | ✅ |
| CA-15.1 | `scripts/check-alive.mjs` — `CONTRATO` (igualdad exacta de conjunto) pasa a `CLAVES_NECESARIAS` y la guardia de `claves.join(',') !== CONTRATO.join(',')` a `CLAVES_NECESARIAS.some((clave) => typeof json[clave] !== 'string')`. **Mismo código de salida y mismo mensaje literal** | `tests/check-alive.test.ts` «SPEC-038 CA-15.1» (4: clave **inventada** ignorada y llega a comparar · con clave desconocida, un commit distinto sigue siendo **1** · el **cuerpo real de cuatro claves** producido por el manejador de `/api/version` → **0** · el semver no participa) + los dos simétricos en rojo, nuevos, en el bloque de CA-12 de SPEC-031: falta `commit` → **3**, `commit: null` → **3** | **Reproducido de cero, con 22 cuerpos distintos, sin fiarme del `.txt` del ledger.** Antes/despues contra el origen REAL de esta rama: el `check-alive.mjs` de `origin/main` sale **3** («el cuerpo no es el contrato…»), el de la rama sale **0** («VIVO… commit=baec1cd…»). Clave **inventada** (`berenjenaCosmica`): sale 0 **y llega a comparar** — con esa misma clave y un commit distinto sale **1**. Siguen en rojo con **3** y el **mismo mensaje literal**: falta `commit`, falta `environment`, falta `builtAt`, `commit: null`, `commit` numerico, `commit` objeto, `{}`, array, `null`, cadena JSON y cuerpo no-JSON. | ✅ |
| CA-16 | — (no degrada) | Suite completa verde: **1355** unitarios en **89** ficheros y **227** e2e. Los únicos cambios de expectativa son los tres que ADR-024 autoriza (cuarta clave del endpoint, step nuevo de CI, cuarta variable calculada), los tres re-encuadres declarados abajo y el que **la enmienda de CA-15.1 exige** (la igualdad exacta de claves de `check-alive`). Geometría del pie con el módulo compartido de ADR-026 a los ocho anchos, en `tests/e2e/version-en-el-pie.spec.ts` | **Los siete gates ejecutados por mi**: `typecheck` 0, `lint` 0, `npm test` **1355/1355 en 89 ficheros**, `build` 0, `test:e2e` **227/227**, `db:scan` 0 y `version:check` 0. Geometria regenerada por mi ejecucion: **0 violaciones y 0 px** de desborde en los 16 puntos, y el fichero sale **identico** al commiteado. `tests/feedback-canal.test.ts` (SPEC-039) sin diff y verde. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-21 — 17 de 17 CA cerrados** (los 16 originales mas CA-15.1, por la
enmienda del gate del 2026-08-21). Verificado por `sdd-verificador` sobre
`ft/SPEC-038-la-version-visible-dentro-de-la-app` en `baec1cd`, contra `origin/main` en
`31bb01b`. **No he editado codigo**: solo esta mitad del ledger.

**Los siete gates, ejecutados por mi, salida literal:**

- `npm run typecheck` -> `tsc --noEmit`, **exit 0**, sin salida.
- `npm run lint` -> `eslint . --max-warnings=0`, **exit 0**, sin salida.
- `npm test` -> `Test Files 89 passed (89)` · `Tests 1355 passed (1355)` · `Duration 156.95s`, **exit 0**.
- `npm run build` -> `next build` completo, 22 rutas, **exit 0**.
- `npm run test:e2e` -> `227 passed (4.1m)`, **exit 0**.
- `npm run db:scan` -> `11 migracion(es) escaneada(s)` y `2 con SQL destructivo, todas desbloqueadas`, **exit 0**.
- `npm run version:check` -> `Base: origin/main.` y `La version sube de 0.1.0 a 0.2.0.`, **exit 0**.

**CA-15.1 reproducido, que era el encargo principal.** Levante la app de esta rama
(`next start` sobre su propio build) y le pase su respuesta **real** a los dos scripts:

```
$ node <check-alive.mjs de origin/main> --url http://localhost:3311 --commit baec1cd9930...
[check-alive] http://localhost:3311/api/version: el cuerpo no es el contrato
{builtAt, commit, environment} (recibido: {builtAt, commit, environment, version}).
EXIT=3

$ node scripts/check-alive.mjs --url http://localhost:3311 --commit baec1cd9930...
[check-alive] VIVO en http://localhost:3311/api/version
[check-alive] commit=baec1cd99301d2305b9a67eee522c36580f1787e environment=unknown
              builtAt=2026-08-20T22:54:54.278Z
EXIT=0
```

El defecto que la enmienda describe **existia y era exactamente ese**: la puerta
post-despliegue se habria puesto roja en el primer merge de esta rama, sobre un
despliegue vivo. Con la guardia de CA-15.1 sale 0.

**Intento de romper la guardia nueva: 22 cuerpos, y no pasa ninguno que no deba.** La
clave inventada `berenjenaCosmica` se ignora **y el script llega a comparar** —con esa
misma clave y un commit distinto el veredicto es **1**, no 0—. Siguen rechazados con **3**
y el **mismo mensaje literal** de antes: falta `commit`, falta `environment`, falta
`builtAt`, `commit: null`, `commit` numerico, `commit` objeto, `{}`, array JSON, `null`,
cadena JSON y cuerpo que no es JSON. `unknown` conserva su rojo propio (2 en *smoke*, 2 al
agotar el plazo). El **unico** ensanchamiento real mas alla de «claves de mas» es que una
clave ajena ya **no tiene que ser cadena** —antes se exigia a todas—: es correcto, porque
el script no la usa, y el tipo se sigue comprobando en las tres que si necesita.

**Lo que NO es regresion de esta spec, pero conviene saber**: un `commit: ""` en modo
*smoke* sale **0** («VIVO») en los dos scripts, el de `origin/main` y el de la rama. Es
comportamiento anterior, CA-15.1 no lo toca y no lo cuento contra esta entrega
(V-SPEC-038-2).

**Las seis guardias ajenas, juzgadas una a una: ninguna pierde poder de deteccion sobre lo
que de verdad protegia.** Las cuatro «ampliadas» siguen siendo listas cerradas que se
ponen rojas con la entrada siguiente; las dos «re-encuadradas» cambian una foto del arbol
por un hecho que ya no puede caducar, y la de `neon-preview-cleanup` gana ademas un caso
anti-vacuidad que comprobe a mano: la ventana `124085a`…`31bb01b` contiene el limpiador y
**no** contiene `ci.yml` ni `deploy-gate.yml`.

**Geometria del pie, medida en mi ejecucion** con el modulo compartido de ADR-026, a los
ocho anchos y en las dos rutas: **0 violaciones de M1 y 0 px de desborde de documento** en
los 16 puntos (32 elementos medidos en `/login`, 54 en `/legal/terminos`). El fichero que
produce mi ejecucion sale **byte a byte identico** al commiteado.

**`/api/version` con la base caida, comprobado parando Postgres** (no por inspeccion): con
Postgres vivo responde 200; con Postgres **parado** sigue respondiendo **200** con las
cuatro claves y `cache-control: no-store`, mientras `/register` da **500**. D-6 de ADR-018,
reafirmado por ADR-024 pto. 2, se sostiene.

**F-SPEC-038-7 cerrado de verdad**: el asunto es `[Stockeiro v0.2.0 <sha completo>] `,
semver primero y commit detras, comprobado tambien en el navegador contra el endpoint.
`tests/feedback-canal.test.ts` (de SPEC-039, cerrada) **no tiene ni un byte de diff** y
sigue verde. La afirmacion de SPEC-039 CA-13 es cierta a partir de este commit.

**Residuales que dejo abiertos y no impiden cerrar** — ver la seccion de salvedades:
V-SPEC-038-1 (la cifra de `.env.example` en el texto de CA-14), V-SPEC-038-2 (el `commit`
vacio en modo *smoke*, heredado) y V-SPEC-038-3 (dos ficheros sin seguimiento de otra
sesion en este checkout). Ninguno bloquea EPIC-004.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-038/. Informe HTML opcional: _qa/SPEC-038/informe.html -->

| CA | Evidencia |
|---|---|
| CA-1, CA-2 | `_qa/SPEC-038/pie-360.png` y `_qa/SPEC-038/pie-1280.png` — el pie con la fila de la versión, en el suelo de anchos y en escritorio |
| CA-15.1 | `_qa/SPEC-038/check-alive-antes-y-despues.txt` — el mismo origen sirviendo la respuesta **real de cuatro claves**, contra el script de `origin/main` y contra el de esta rama: **EXIT=3** («el cuerpo no es el contrato…») y **EXIT=0** («VIVO… commit=…») |
| CA-16 | `_qa/SPEC-038/geometria-del-pie.txt` — M1 y M2 en `/login` y `/legal/terminos` a **360, 390, 640, 700, 730, 760, 800 y 1280 px**: **0 violaciones** y **0 px** de desborde de documento en los 16 puntos, con 32 y 54 elementos medidos respectivamente |

### Lo que verifique yo, y con que (sdd-verificador, 2026-08-21)

| Que | Como lo comprobe |
|---|---|
| CA-15.1, antes y despues | **Reproducido desde cero**, sin usar el `.txt` del ledger: app de esta rama con `next start`, su respuesta real de cuatro claves, y los dos scripts contra el mismo origen. `origin/main` sale **3**; la rama, **0**. Coincide con lo que el ledger afirmaba |
| CA-15.1, intento de rotura | **22 cuerpos**: clave inventada aceptada y comparada, commit distinto sigue en 1, y once formas de cuerpo roto que siguen en **3** con el mismo mensaje. No pasa nada que no deba |
| CA-15, el commit y no el semver | Dos cuerpos con `version: 0.2.0` identico y commits distintos: **0** y **1** |
| CA-7, base caida | Postgres efimero **parado** con la app viva: `/api/version` 200 con cuatro claves y `no-store`, `/register` 500 |
| CA-3 y CA-4 | Peticion propia al endpoint del build de esta rama, contrastada con la fila del pie de mi captura: semver identico, commit prefijo exacto, misma marca de tiempo |
| CA-12, casos limite | `0.10.0` vs `0.9.0`, bajada, version igual, solo documentacion, semver invalido en las dos puntas, base inexistente, `--base HEAD` y la rama real |
| CA-16, geometria | `_qa/SPEC-038/geometria-del-pie.txt` **regenerado por mi ejecucion**, identico al commiteado: 0 violaciones y 0 px a los ocho anchos |
| Capturas | `_qa/SPEC-038/pie-360.png` y `pie-1280.png` **regenerados por mi ejecucion**; el pie ensena `v0.2.0 · entorno desconocido · baec1cd · 2026-08-20 22:54 UTC` |

## Salvedades / follow-ups
<!-- IDs F-SPEC-038-1, F-SPEC-038-2… con destino (spec futura o EPIC-MEJORA). -->

### Lo que la spec ya declaraba

- **F-SPEC-038-1 (secuencia)** — cumplido: SPEC-035 estaba en `main` y el pie existía.
- **F-SPEC-038-2, F-SPEC-038-3, F-SPEC-038-4, F-SPEC-038-5** — residuales asumidos, sin cambio.
- **F-SPEC-038-6** — ya resuelto antes de implementar.
- **F-SPEC-038-7 — CERRADO.** El asunto del feedback pasa a `[Stockeiro v0.2.0 <sha completo>]`
  y el cuerpo lleva `versión: v0.2.0` y `commit: <sha>` en líneas distintas (antes ponía
  `versión: <sha>`, que era honesto cuando el sha era lo único que había). El commit va
  **entero** en el asunto y no abreviado: en un asunto no compite por sitio, y `git show`
  lo quiere completo. Test propio en `tests/feedback-lleva-el-semver.test.ts` (11 casos) y
  comprobación contra la app en `tests/e2e/version-en-el-pie.spec.ts`. **`tests/feedback-canal.test.ts`
  (de SPEC-039, cerrada) no se ha tocado y sigue verde**: su caso «el asunto lleva la versión
  PREFIJADA» medía `indexOf(commit) < 24` y ahora vale 18. **La afirmación de SPEC-039 CA-13
  es cierta a partir de este commit**, y lo es porque alguien escribió la línea, no sola.

### Lo que apareció al implementar

- **F-SPEC-038-8 (para el arquitecto, ADR-025 pto. 1).** La spec pide añadir a
  `docs/fundacion/dominio.md` los términos **Versión de producto** y **Versión del
  despliegue**, con la distinción explícita entre ambas. **No los he escrito**: la pluma del
  glosario es del arquitecto y se ejerce en el gate (ADR-025). Hoy `dominio.md` no contiene
  ninguno de los dos. Queda como residual dirigido al arquitecto, con el material ya
  decidido: la *versión de producto* es el semver de `package.json`, sube a mano y **no**
  identifica un artefacto (dos despliegues pueden compartirla); la *versión del despliegue*
  es el commit, la calcula el build y **sí** lo identifica — es la que mira `check-alive`.
- **V-SPEC-039-4 (arrastrado hasta aquí) — LISTO PARA CERRAR.** La fila «Canal de feedback»
  de `dominio.md` dice que `deploymentIdentity` es *«la misma fuente que responde
  `/api/version` y que **enseña el pie**»*. Con esta entrega **el pie la enseña de verdad**:
  fila `data-testid="version"` en `src/app/app-footer.tsx`, alimentada por
  `deploymentIdentity` a través de `etiquetaDeVersion`, y comprobado en el navegador contra
  el endpoint (CA-4). **No hay nada que reescribir**: la frase pasó a ser cierta sola, tal y
  como el humano previó en el gate del 2026-08-20. El residual se cierra citando esta spec.
- **F-SPEC-038-9 (residual asumido: qué dispara el gate).** «Código de aplicación» se deriva
  de `.sdd.json` → `rutasVigiladas` (hoy `src/` y `app/`) con `src/` de suelo, que es lo que
  ADR-024 pto. 9 dice literalmente. Consecuencia: un cambio confinado a `next.config.mjs`,
  `drizzle/`, `scripts/` o `.github/` **no** exige subir el número. Es deliberado —el gate
  reutiliza la declaración que el proyecto ya tiene en vez de inventar una segunda lista que
  divergiría— y ensancharlo es editar `.sdd.json`, no el script. Si algún día se quiere
  incluir las migraciones, ahí está el mando.
- **F-SPEC-038-10 (residual asumido: el gate en `push` a `main`).** En un `push` a `main`,
  `HEAD` y `origin/main` son el mismo commit, así que el diff es vacío y el gate pasa
  trivialmente. Es correcto —lo que hay que gatear es la PR, y ahí sí compara— pero significa
  que **un merge que se salte la PR no lo caza nadie**. Es la misma limitación que ya declara
  F-SPEC-027-1 (este plan de GitHub no ofrece protección de rama en repos privados): el CI
  informa, no impide.
- **F-SPEC-038-11 (excepción declarada a la letra de CA-6).** CA-6 dice que `next.config.mjs`
  es «el único sitio» que lee el `version` de `package.json`. El gate de CA-12 tiene que leer
  **dos** `package.json` (el de la rama y el de `origin/main`) para poder compararlos: es
  inevitable y no es el canal de build —no se empaqueta, no se importa desde `src/` y no
  corre en runtime—. El test no lo esconde: la lista es **cerrada** y tiene exactamente dos
  entradas, `next.config.mjs` y `scripts/check-version-bump.mjs`, con el motivo escrito al
  lado. La cláusula que sí se cumple sin excepción es la que protege el endpoint: **ningún
  módulo bajo `src/` abre `package.json`**.
- **F-SPEC-038-13 — CERRADO.** La cabecera de `src/app/api/version/route.ts` decía *"Responde
  `{commit, environment, builtAt}` y nada más"* y *"devuelve tres constantes"*. Era **falso desde
  CA-3**, y era el comentario que lee quien vaya a tocar el endpoint. Ahora dice las **cuatro**
  claves, cita **ADR-024** como la enmienda de D-6, recuerda que el semver **no** sustituye al
  commit y remite a `identity.ts` para el cómo, sin repetirlo. **Sin cambio de código**: el
  `export function GET` y el `dynamic` están intactos (CA-3 lo prohíbe). Y se corrige de paso la
  nota de este ledger que afirmaba *"sin cambio de código; sí de documentación"* describiendo algo
  que entonces no había ocurrido.

- **F-SPEC-038-14 — CUADRADO.** Tres fuentes decían tres números para `.env.example`. Contado, no
  estimado: la **convención del test** (`/^#?\s*([A-Z][A-Z0-9_]*)=/gm` en
  `tests/spec-031-frontera.test.ts`) cuenta las claves **declaradas**, comentadas o no, y da
  **once** — con un `toHaveLength(11)` explícito al lado. Las **asignaciones sin comentar** son
  **nueve** (dos claves van comentadas en la plantilla). El *"de diez a diez"* del CA es una cifra
  de antes de que SPEC-039 CA-16 añadiera `FEEDBACK_EMAIL`. **La propiedad que el CA defiende se
  cumple entera y sin discusión**: esta spec **no toca `.env.example`** (`git diff origin/main --
  .env.example` vacío) y las cuatro variables del canal se **calculan**. La cifra que hay que citar
  es **once por la convención del test**; ninguna de las tres fuentes debería contarlo a mano, y
  por eso el test lo cuenta por su cuenta sobre el fichero.

- **F-SPEC-038-15 — ATENDIDO.** La fila CA-15 usaba el `git diff` vacío de `check-alive.mjs` como
  evidencia de cumplimiento. Reescrita: hoy ese dato probaba lo contrario. La fila cita ahora lo
  que de verdad cierra el CA —que la comparación **sigue siendo el commit**, con su caso nuevo— y
  CA-15.1 tiene fila propia.

- **F-SPEC-038-16 (lo que este defecto enseña, para quien escriba la próxima guardia).** El fallo
  no estaba en el código nuevo: estaba en una guardia **ajena y correcta el día que se escribió**,
  que congelaba un conjunto exacto. Sus tests estaban verdes porque sus *fixtures* llevaban tres
  claves, es decir, **se probaba contra un cuerpo que ninguna versión de la app volvería a
  servir**. De ahí el caso de extremo a extremo nuevo: el cuerpo lo produce el manejador de
  `/api/version` **de verdad** (`cuerpoRealDeApiVersion`), no una constante escrita a mano, así
  que no puede volver a quedarse probando una forma muerta. Es la variante *fixture caduca* del
  antipatrón que FOUNDATION nombra, y merece decirse: **un fixture también congela el estado del
  árbol**.

- **F-SPEC-038-12 (trampa de herramienta, para quien venga detrás).** Un literal de expresión
  regular que case la barra invertida —incluso **dentro de un comentario**— hace que Vitest
  2.1 no pueda importar un `.mjs`: `SyntaxError: Invalid or unexpected token`, aunque Node y
  esbuild lo parseen sin quejarse. Lo mismo pasa con un `.mjs` guardado con finales de línea
  **CRLF**. Me costó un rato largo aislarlo. `scripts/check-version-bump.mjs` normaliza rutas
  con `split`/`join` por eso, y lo lleva escrito en su propio comentario.

### Guardias ajenas que he tocado (FOUNDATION § *Cómo se trabaja aquí*)

Ninguna se ha aflojado. Cuatro se **amplían** con la entrada que un CA pide —y siguen
cerradas— y dos se **re-encuadran**. Todas llevan el porqué escrito en el propio fichero.

| Guardia | Qué vigilaba antes | Qué vigila ahora | Por qué |
|---|---|---|---|
| `tests/spec-031-frontera.test.ts` CA-13.1 | Lista **cerrada** de 9 steps con `run` en `ci.yml` | La misma lista cerrada, con **10**: entra `Version bump` | Su propio comentario exigía que «cada entrada nueva venga con un CA que la pida». **CA-13 es ese CA.** Las tres aserciones que ese bloque defiende de verdad —no invoca `check-alive`, no habla con un host externo, `vercel.json` intacto— siguen ahí y se comprueban sobre la lista ampliada |
| `tests/spec-031-frontera.test.ts` CA-13.3 | Las **tres** variables del canal no se configuran en `.env.example` ni en el workflow | Las **cuatro** | ADR-024 pto. 4 / CA-14. La propiedad («se calculan, no se configuran») es idéntica; cambia cuántas la cumplen. Las claves de `.env.example` siguen siendo **once** |
| `tests/version-build-identity.test.ts` | `buildIdentity` declara **exactamente tres** claves | **Cuatro** | Lo mismo. Sigue siendo igualdad de conjunto: la quinta vuelve a ponerlo rojo |
| `tests/deploy-gate-workflow.test.ts` 9.1 y 9.3 | Lista **completa** de los step names de `ci.yml` y juego **exacto** de scripts de `package.json` | Las mismas listas con `Version bump` y `version:check` | Congelaban «SPEC-028 no añade steps ni scripts», y eso sigue siendo cierto; lo que caducaba era la forma. Ampliadas con esas dos entradas y solo esas |
| `tests/deploy-gate-workflow.test.ts` 5.5 y `tests/spec-032-frontera.test.ts` | `scripts/` tiene **exactamente tres** habitantes | Los tres que a cada spec le importan **siguen estando** | **Re-encuadre.** «Exactamente tres» era una foto del árbol: se pone roja la primera vez que otra spec añade un script legítimo, sin defecto detrás. El molde ya estaba diez líneas más abajo, en `LAS_NUEVE` migraciones de `spec-032-frontera` |
| `scripts/check-alive.mjs` (guardia de forma) y su caso `200 con claves de MÁS también es 3` | Que el conjunto de claves del cuerpo fuera **exactamente** `{builtAt, commit, environment}` | Que estén **las claves que el script necesita**, del tipo esperado, traiga el cuerpo otras o no; y que se siga **rechazando** si falta una, si no es cadena o si no es un objeto | **Re-encuadre exigido por la enmienda de CA-15.1** (gate del 2026-08-21). No es aflojar: la igualdad exacta congelaba **el contrato del día de la entrega**, ADR-024 aprobó que creciera y la guardia leyó ese crecimiento como avería —salida **3**, sin reintentar— sobre un despliegue vivo. Dos casos **nuevos en rojo** (falta `commit`; `commit` no es cadena) sustituyen lo que el caso borrado protegía de verdad. `version` **no** entra en la lista: el script no lo usa |
| `tests/neon-preview-cleanup-workflow.test.ts` 1.4 | `ci.yml` y `deploy-gate.yml` **byte a byte** contra `origin/main` | Que el diff de **la ventana de la entrega de SPEC-042** (`124085a`…`31bb01b`) no toque ninguno de los dos, **más un caso que comprueba que la ventana no está vacía** | **Re-encuadre.** Comparar contra `origin/main` es el `HEAD` móvil que FOUNDATION nombra: caduca al mergear, no cuando algo se rompe. La afirmación de CA-1 —«esta entrega no toca los workflows de otras specs»— es un hecho sobre commits concretos y ya no puede cambiar |

**Sobre «quien lo toca no es quien se beneficia»**: soy el beneficiario de las seis, así que
la regla que sí puedo cumplir es la otra mitad — **declararlas en vez de ablandarlas en
silencio**. Van todas aquí arriba, con su antes y su después, y en los mensajes de commit
`852a9d6`, `cdbc314` y `587778c`. Ninguna baja el listón: las cuatro primeras siguen siendo
listas cerradas que se ponen rojas con la entrada siguiente, y las dos re-encuadradas
comprueban ahora algo que **no puede caducar**.

### Cosas que vi y no eran mías

- **`next.config.mjs`** conserva el comentario de ADR-015 pto. 9 que afirma que
  `/reset-password` «no carga recursos de terceros». Está caduco y **no lo he tocado**;
  tampoco lo he empeorado — mi cambio entra por arriba, en el bloque de la identidad.
- **`.gitignore`** aparecía modificado al empezar la sesión (solo finales de línea). No forma
  parte de ningún commit de esta rama.

### Residuales que abre el verificador (2026-08-21)

- **V-SPEC-038-1 (cifra caduca en el TEXTO de CA-14, para el arquitecto).** F-SPEC-038-14
  cuadro el numero en el ledger —**once** claves por la convencion del test— pero el
  **texto de CA-14 en la spec sigue diciendo «de diez a diez»**. Lo conte yo sobre el
  fichero: son **once**. La **propiedad** que el CA defiende se cumple entera y sin
  discusion (`git diff origin/main -- .env.example` vacio, `STOCKEIRO_VERSION` ausente de
  `.env.example` y de `ci.yml`), asi que **no es motivo de RED**: es una cifra escrita a
  mano en un documento de verdad, y corregirla es de la pluma del arquitecto, no mia.

- **V-SPEC-038-2 (heredado, no lo abre esta spec).** En modo *smoke* —sin `--commit`— un
  cuerpo con `commit: ""` hace que `check-alive` diga VIVO y salga **0**: la cadena vacia
  pasa la guardia de tipo y no es `unknown`, asi que ni el rechazo por forma ni el rojo
  propio de `unknown` la ven. Lo comprobe contra los **dos** scripts, el de `origin/main` y
  el de esta rama, y **sale 0 en los dos**: es comportamiento anterior a la enmienda y
  CA-15.1 no lo toca ni lo empeora. Lo dejo escrito porque el escenario que lo produciria
  —un canal de build que aporte la variable vacia— es exactamente el que F-SPEC-038-5
  declara vigente hoy. Destino: **EPIC-FIX** o la spec que retome la puerta.

- **V-SPEC-038-3 (higiene del checkout, no de la rama).** Al terminar mi verificacion
  aparecen en la raiz dos ficheros **sin seguimiento** que no son de esta rama ni mios:
  `diag-cron.mjs` y `diag2.mjs`, diagnosticos read-only del ciclo diario creados durante mi
  sesion por **otra sesion que trabaja en este mismo checkout**. No los he borrado —podrian
  estar en uso— y no forman parte de ningun commit de SPEC-038. Que no se cuelen en el merge.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Estado: implementación completa, spec en `en-revision`, lista para el verificador.**

Rama `ft/SPEC-038-la-version-visible-dentro-de-la-app`, salida de `origin/main` (`31bb01b`),
**ocho commits**:

1. `b577637` — el semver entra en el contrato de la identidad (CA-3, CA-6, CA-8).
2. `852a9d6` — el gate de CI y el `npm version minor` a **0.2.0** (CA-12, CA-13, CA-14).
3. `cdbc314` — re-encuadre de las dos guardias del listado de `scripts/`.
4. `587778c` — la versión en el pie, el módulo de presentación, el grafo de imports y
   F-SPEC-038-7 (CA-1, CA-2, CA-4, CA-5, CA-7, CA-9, CA-10, CA-11).
5. `be293c1` — el contrato de cuatro claves en el e2e de `/api/version`, y este ledger.
6. `ebc61de` — la spec a `en-revision`.
7. `528f2e6` — el handoff del ledger lista sus commits.
8. **(esta ronda, 2026-08-21)** — CA-15.1: la guardia de forma de `check-alive.mjs`, sus cuatro
   casos nuevos más los dos simétricos, la cabecera de `route.ts` (F-SPEC-038-13) y el
   cuadre de F-SPEC-038-14/15.

**Dónde mirar primero si algo se pone rojo:**

- El gate se prueba a sí mismo sobre esta rama (`tests/version-bump-gate.test.ts`, «esta rama
  pasa el gate»). Juzga **commits**, no el árbol de trabajo: si alguien sube el número y no lo
  commitea, el script lo dice en su propio mensaje.
- El gate necesita `origin/main` en el clon. En local, `git fetch origin main`; en CI lo trae
  el `fetch-depth: 0` del checkout del job `Checks`.
- `_qa/` lo reescribe la suite entera al correr. Restaurar con `git checkout -- _qa/` antes de
  commitear; los dos PNG y el `.txt` de esta spec están en `_qa/SPEC-038/`.

**Si vuelve a aparecer un rojo en la puerta post-despliegue**: `scripts/check-alive.mjs` ya no
rechaza por exceso de claves. La reproducción del defecto original está en
`_qa/SPEC-038/check-alive-antes-y-despues.txt` y se rehace en un minuto sirviendo la respuesta
real desde un servidor de juguete y ejecutando contra ella el script de `origin/main` y el de la
rama.

**Lo que NO está hecho, a propósito:** los dos términos de `docs/fundacion/dominio.md`
(F-SPEC-038-8) los escribió el arquitecto en el gate del 2026-08-21 (`6f4da39`); ese residual ya
no es mío.
