---
id: SPEC-055
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-055 APP_BASE_URL envenenada: appBaseUrl valida el valor y no solo su presencia, y el build dice que clave y que fichero

## Resumen
- Fase: **en-revision** — aprobada por el humano (Alberto Fojo) el 2026-08-24, implementada
  el mismo dia por sdd-implementador. Espera al verificador.
- Rama: `ft/SPEC-055-app-base-url-envenenada-appbaseurl-valida-el-valor-y-no-solo-su-presencia`
  (la abrio el humano desde `origin/main`; su primer commit trae la spec y este ledger).
- Esta entrega **toca `src/`**, asi que el gate `Version bump` exigio subida: **0.4.0 -> 0.4.1**,
  patch y no minor porque restaura una promesa ya entregada en vez de anadir alcance (mismo
  criterio que SPEC-043). `package.json` y `package-lock.json` en el **mismo commit** (ADR-033).
- **Conjunto cerrado de ficheros de la rama**, tal y como queda: la spec, este ledger,
  `src/lib/config/app-url.ts`, `src/app/layout.tsx`, `tests/app-base-url.test.ts`,
  `package.json` y `package-lock.json`. Los dos ultimos son la subida de version que la
  propia spec anticipa; la fila de gate que enumera el diff se escribio antes de saber que
  version tocaba. Nada de `_qa/`: esta spec no genera evidencia visual.
- **Cero ficheros ajenos tocados.** Ni `docs/despliegue.md`, ni `.env.example`, ni
  `tests/ci-workflow.test.ts`, ni `tests/entornos-de-despliegue.test.ts` (territorio de
  SPEC-052); ni `tests/spec-031-frontera.test.ts`, ni `tests/tarjeta-frontera.test.ts`, ni
  `src/lib/auth/password-reset.ts`.
- Suite completa en verde tras el cambio: **113 ficheros, 1767 casos**, mas `typecheck` y
  `lint` limpios.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Qué exige (resumen; la fuente es la spec) | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|---|
| CA-1 | Clave ausente / `'   '` sigue lanzando con `/APP_BASE_URL no definida/` y la firma `appBaseUrl(env)` no cambia — **contrato con SPEC-052 CA-14** | `src/lib/config/app-url.ts` — el literal y la firma **sin tocar**, con el porqué escrito al lado | `tests/app-base-url.test.ts` › CA-1 — 3 casos: clave ausente, `'   '`, y la firma leída del fuente como texto (`export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string {`) más `appBaseUrl.length === 0` | | ❌ |
| CA-2 | Valor que no parsea (`[SENSITIVE]`, sin esquema, `//evil.com`, comillas dentro) → lanza con diagnóstico; cada fila evalúa su propio «antes» | `src/lib/config/app-url.ts` — `new URL(raw)` en `try`/`catch`, y el `catch` llama a `rechazar()` | `tests/app-base-url.test.ts` › CA-2 — centinela de familia no vacía + 5 filas `it.each`; cada fila EJECUTA `new URL(valor)`, exige `/Invalid URL/` y que ese mensaje no nombre la clave, y después el rechazo nuevo | | ❌ |
| CA-3 | Protocolo distinto de `http:`/`https:` (`ftp:`, `file:`, `javascript:`) → lanza; cada fila demuestra que hoy llega vivo al enlace de correo | `src/lib/config/app-url.ts` — guarda de `url.protocol` distinto de `http:`/`https:`; el motivo interpola el protocolo recibido | `tests/app-base-url.test.ts` › CA-3 — centinela + 3 filas (`ftp:`, `file:`, `javascript:`); cada fila MIDE el río abajo con `buildResetUrl` (llega vivo o estalla sin diagnóstico) antes de exigir el rechazo, y comprueba que el mensaje nombra el protocolo y los dos aceptados | | ❌ |
| CA-4 | Ruta / query / fragmento / credenciales → lanza; barra final sigue tolerada (`https://a.com/` → `https://a.com`); la fila de la ruta calcula la discrepancia entre los dos consumidores | `src/lib/config/app-url.ts` — guardas de credenciales, `search`, `hash` y `!/^\/+$/.test(url.pathname)`; el recorte de barras finales sigue siendo `raw.replace(/\/+$/, '')` | `tests/app-base-url.test.ts` › CA-4 — centinela + 5 filas de forma, más el caso de la ruta que CALCULA la discrepancia (`new URL('https://a.com/es').pathname === '/es'` frente al enlace de correo, que la pierde) y el caso de la barra final (una y varias) | | ❌ |
| CA-5 | Los valores vivos siguen valiendo y se **leen** de `.github/workflows/ci.yml` y `tests/e2e/server.mjs`, con centinela de extracción no vacía | sin cambio de código: es la propiedad que la guardia no puede romper | `tests/app-base-url.test.ts` › CA-5 — 4 casos; el de CI recorre el YAML de `.github/workflows/ci.yml`, el del e2e resuelve `${APP_PORT}` desde `tests/e2e/server.mjs`, y el `https` sale de `.env.example`. Los tres con centinela de extracción no vacía. Cuarto caso: `http` y `localhost` valen sin excepción | | ❌ |
| CA-6 | El mensaje nombra clave + valor delimitado + forma esperada con ejemplo + `.env.production.local` manda sobre `.env`; aplicado a **todas** las filas | `src/lib/config/app-url.ts` — `rechazar()` compone las tres partes fijas: clave, valor delimitado con `«»` y recortado, forma esperada con los dos ejemplos, y la precedencia `.env.production.local` sobre `.env` | `tests/app-base-url.test.ts` › CA-6 — centinela + `it.each` sobre **TODAS** las filas de las tres familias, con los cuatro asertos etiquetados (a)(b)(c)(d) | | ❌ |
| CA-7 | `[SENSITIVE]` añade la pista de `vercel env pull` / *Sensitive*; `[REDACTED]` se rechaza igual **sin** pista; valor recortado en el mensaje | `src/lib/config/app-url.ts` — `MARCADOR_DE_VERCEL` y `MAX_VALOR_EN_MENSAJE = 120`; la pista se hace `push` **después** del rechazo genérico, nunca antes | `tests/app-base-url.test.ts` › CA-7 — 3 casos: `[SENSITIVE]` con pista y sin perder nada de CA-6, `[REDACTED]` rechazado igual y **sin** pista, y un valor de 314 caracteres que entra recortado | | ❌ |
| CA-8 | Con la clave envenenada, recuperación falla **igual** para cuenta existente e inexistente y **sin tocar la BD**; el «antes» (oráculo 200/500 + enlace vivo quemado) se mide en el mismo fichero. `password-reset.ts` **sin modificar** | `src/lib/config/app-url.ts` — nada más: el arreglo es que el valor envenenado ya no sale de la función. `src/lib/auth/password-reset.ts` **sin modificar** (comprobado por el propio test) | `tests/app-base-url.test.ts` › CA-8 — 3 casos sobre un doble de `db` que registra CUALQUIER acceso. El DESPUÉS: las dos direcciones lanzan el mismo error con **cero** accesos. El ANTES, medido en el mismo fichero componiendo con `appBaseUrlAnterior`: la inexistente devuelve el acuse y la existente lanza tras un `update` y un `insert`; la asimetría se calcula. Tercer caso: `password-reset.ts` no gana ninguna guardia | | ❌ |
| CA-9 | Única fuente del origen absoluto = `appBaseUrl()`; guardia estática sobre `src/` **con centinela** (cero puntos de uso ⇒ rojo) | sin cambio de código: `appBaseUrl()` sigue siendo el único productor (D-2) | `tests/app-base-url.test.ts` › CA-9 — 2 casos con recorrido de `src/` y comentarios fuera. Uno extrae las invocaciones de `requestPasswordReset` con paréntesis balanceados y exige `baseUrl: appBaseUrl()`; el otro exige que el argumento del origen de la tarjeta sea exactamente `new URL(appBaseUrl())`. Los dos con centinela: cero puntos de uso es rojo | | ❌ |
| CA-10 | Cero claves nuevas: `tests/spec-031-frontera.test.ts` (11, `toHaveLength(11)`) y `tests/tarjeta-frontera.test.ts` verdes **sin tocarse** | ninguna clave nueva: la guardia sólo lee `APP_BASE_URL` | `tests/spec-031-frontera.test.ts` y `tests/tarjeta-frontera.test.ts` verdes **sin una línea modificada** (confirmado con `git diff --name-only origin/main...HEAD`), más `tests/app-base-url.test.ts` › CA-10, que comprueba que `app-url.ts` no lee ninguna otra clave de entorno | | ❌ |
| CA-11 | ADR-026 §7: reimplementación de 3 líneas de la `appBaseUrl()` anterior en el test; cada valor rechazado la atraviesa (o estalla sin diagnóstico). Centinela: tabla no vacía y con las tres familias | n-a (vive en el test) | `tests/app-base-url.test.ts` — `appBaseUrlAnterior()`, la reimplementación de tres líneas con su porqué y su fecha (2026-08-24) al lado, y el bloque › CA-11: `it.each` sobre la tabla entera (atraviesa la anterior → río abajo estalla sin sujeto o llega vivo → la guardia nueva lo detiene) más el centinela de tabla no vacía y con representante de las tres familias | | ❌ |
| CA-12 | La tabla crece sin tocar aserciones: ni `toHaveLength(` ni `toEqual([` sobre ella (`F-SPEC-048-2`) | n-a (vive en el test) | `tests/app-base-url.test.ts` › CA-12 — lee su propio fuente, recoge todo `toHaveLength(` y `toEqual([` y exige que ninguno mencione `VALORES_RECHAZADOS`; centinela de que la constante existe con ese nombre | | ❌ |
| CA-13 | Cabecera de `app-url.ts` y comentario de `layout.tsx` dicen la otra mitad; `layout.tsx` cambia **sólo comentario** y `tarjeta-frontera.test.ts:75` sigue verde | `src/lib/config/app-url.ts` (cabecera) y `src/app/layout.tsx` (**sólo el comentario** del bloque `metadata`; la expresión no se toca) | `tests/app-base-url.test.ts` › CA-13 — 2 casos; cada uno exige la frase «lanza si falta o si el valor no es un origen absoluto `http`/`https`», `[SENSITIVE]` y `vercel env pull`, y el del layout comprueba además que `metadataBase: new URL(appBaseUrl())` y el import siguen literales | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### Verificación de gate (fuera de la suite, a pegar aquí)

No cabe en la batería y se hace una vez, con la salida literal pegada (mismo tratamiento que
SPEC-052 CA-16):

| Escena | Qué se espera | Salida |
|---|---|---|
| `npm run build` con `APP_BASE_URL='[SENSITIVE]'` en el entorno, **antes** del arreglo | `Failed to collect configuration for /_not-found` → `Invalid URL`, sin nombrar clave ni fichero | |
| `npm run build` con `APP_BASE_URL='[SENSITIVE]'`, **después** | falla nombrando `APP_BASE_URL`, el valor, la forma esperada y `.env.production.local` | |
| `npm run build` con `APP_BASE_URL=http://localhost:3200` | verde | |
| `npm run test` / `typecheck` / `lint` | verdes; `tests/spec-031-frontera.test.ts` y `tests/tarjeta-frontera.test.ts` **sin tocar** | |
| `git diff --name-only` de la rama | exactamente: la spec, este ledger, `src/lib/config/app-url.ts`, `src/app/layout.tsx`, `tests/app-base-url.test.ts` | |

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-055/. Informe HTML opcional: _qa/SPEC-055/informe.html -->

**No aplica.** Esta spec no toca UI: el defecto vive en configuración, en el build y en un
camino de servidor. Toda la evidencia es de test y de salida de consola.

## Salvedades / follow-ups
<!-- IDs F-SPEC-055-1, F-SPEC-055-2… con destino (spec futura o EPIC-MEJORA). -->

Abiertos ya por el arquitecto, antes de implementar:

- **`F-SPEC-055-1` — despliegue en sub-ruta (`https://host/app`).** CA-4 **rechaza** ese
  valor en vez de reconciliar a los dos consumidores. Arreglar `buildResetUrl` para que
  respete un prefijo de ruta es otro trabajo, con riesgo sobre enlaces ya enviados. Hoy
  ningún despliegue lo pide. Destino: spec futura, sólo si aparece el caso.
- **`F-SPEC-055-2` — validar el resto de claves de entorno con el mismo patrón**
  (`RESEND_FROM` como dirección, `DATABASE_URL` como URL, `AUTH_SECRET` como longitud
  mínima…). Generalización obvia que no cabe en una spec de FIX: cada clave tiene su forma y
  su consumidor. Destino: **EPIC-INFRA**.


Levantados durante la implementacion, sin cambiar nada por su cuenta:

- **`F-SPEC-055-3` — dos guardias de SPEC-051 se disparan por MENCION, no por conducta, y
  esta entrega tuvo que esquivarlas.** No hubo que tocar ninguna, pero conviene que quede
  escrito porque la proxima persona tropezara igual:
  1. `tests/tarjeta-frontera.test.ts` cuenta los ficheros de `src/` cuyo **codigo** nombra
     el identificador del origen de la tarjeta y exige que sea exactamente uno. El primer
     borrador del mensaje de error lo escribia dentro de un literal de cadena —para
     explicarle al desarrollador por que se rechaza una ruta— y eso puso ROJA esa guardia.
     Reformulado para nombrar a los dos consumidores por lo que son; el porque queda al
     lado, en `src/lib/config/app-url.ts`.
  2. `tests/tarjeta-guardias-ampliadas.test.ts:119` mantiene una lista cerrada de los
     ficheros de `tests/` que mencionan `SPEC-051` —su forma de detectar que alguien
     re-encuadro una guardia ajena sin pasar por el gate—. Un fichero **nuevo** que se
     limite a CITAR esa spec en un comentario tambien la pone roja. `tests/app-base-url.test.ts`
     cita las guardias por su **ruta** en vez de por el id de su spec, con la nota al lado.
  Las dos son propiedades reales y ninguna se aflojo. Lo que queda como seguimiento es que
  el criterio «mencionar» es mas ancho que el criterio «tocar», y que eso encarece cualquier
  entrega futura que quiera explicarse por escrito. Destino: **EPIC-INFRA**, si alguna vez
  molesta lo bastante.

## Dependencias con otra spec en vuelo

- **`D-SPEC-055-1` → SPEC-052** (rama `ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde`,
  `en-revision`, sin pushear). Esta spec **no toca** `docs/despliegue.md` ni `.env.example`
  porque son suyos. Lo que les pide, dos líneas:
  1. `docs/despliegue.md` §0: `vercel env pull` deja `[SENSITIVE]` en las variables marcadas
     como *Sensitive* en Vercel, y en un build de producción `.env.production.local` **manda
     sobre** `.env`.
  2. Comentario de `APP_BASE_URL` en `.env.example`: la forma aceptada — origen `http`/
     `https`, sin ruta ni barra final.
  **Ninguna de las dos hace falta para que los trece CA pasen.** Si SPEC-052 ya ha mergeado
  cuando esto se implemente, pueden colgarse de esta spec; lo decide el humano en el gate.

- **Contrato compartido, no fichero: el literal `APP_BASE_URL no definida`.** SPEC-052 CA-14
  lo congela en `tests/entornos-de-despliegue.test.ts` (en su rama, `:697-740`), junto con la
  firma `appBaseUrl(env)`. **Cambiarlos pone RED a SPEC-052 sin tocar ninguno de sus
  ficheros.** CA-1 de esta spec existe para que eso no ocurra por descuido.
  **Intersección de ficheros entre las dos specs: vacía** (comprobado con
  `git diff --name-only origin/main...ft/SPEC-052-…`).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Hecho:** los trece CA, con su test. Cinco commits en la rama:
`3684b13` (spec + ledger, del humano), `e786b67` (la guardia y su mensaje: CA-1..CA-7,
CA-11, CA-12), `398a80a` (CA-8, el oraculo), `3b74a6b` (CA-9, CA-10, CA-13) y la subida de
version. Nada pusheado, ningun PR, ningun merge.

**Como se midio el «antes» del oraculo (CA-8), que es lo unico que no se ve leyendo el
codigo.** No se afirma en prosa: se ejecuta. `tests/app-base-url.test.ts` monta un doble de
`db` **a mano** —no PGlite— que anota cada `select`, `update` e `insert`, y recorre el
camino de recuperacion dos veces, con un email que existe y con uno que no:

- **el DESPUES**, componiendo el origen como lo hace `src/app/(auth)/actions.ts:128` (o sea
  `appBaseUrl(env)` **como argumento**, antes de entrar): las dos direcciones lanzan el
  **mismo** error y con **cero** accesos anotados;
- **el ANTES**, el mismo camino con `appBaseUrlAnterior` componiendo: la direccion que no
  existe **devuelve el acuse** y la que existe **lanza tras un `update` y un `insert`**. La
  asimetria se calcula comparando las dos listas de accesos, no se escribe.

El doble es a mano a proposito: con una base de verdad, «cero accesos» seria un `count(*)`
sobre tablas vacias —otra afirmacion—; aqui es una lista vacia.

**No es un verde de vacio, y esta comprobado por mutacion.** Aflojando la guardia para que
deje pasar lo que no parsea, la mitad del DESPUES de CA-8 se pone **roja** junto con otros
17 casos del fichero. La guardia se restauro inmediatamente despues.

**Lo que el verificador tiene que rellenar y aqui no esta:** las columnas *Verif.* y
*Estado* de la matriz, el veredicto, y la tabla de §Verificación de gate. Las tres escenas
de `npm run build` ya se han ejecutado en esta maquina y salen como la spec espera —la
envenenada falla nombrando la clave, el valor, la forma y `.env.production.local`, con la
pista de `vercel env pull`; la de `http://localhost:3200` termina en verde—, pero **la
salida literal la pega el verificador**, que es a quien pertenece esa tabla.

**Dos avisos para quien siga:**
1. Para construir en esta maquina hace falta `APP_BASE_URL=http://localhost:3200 npm run build`.
   Eso sigue siendo el apano, no el arreglo: `.env.production.local` sigue trayendo
   `[SENSITIVE]` y lo volvera a traer en el proximo `vercel env pull`. Lo que cambia es que
   ahora el build **dice por que**.
2. `D-SPEC-055-1` sigue abierta hacia SPEC-052 y **no se ejecuto**: `docs/despliegue.md` y
   `.env.example` no se han tocado ni para anadir una linea.
