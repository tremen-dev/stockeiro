---
id: SPEC-055
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-055 APP_BASE_URL envenenada: appBaseUrl valida el valor y no solo su presencia, y el build dice que clave y que fichero

## Resumen
- Fase: **en-revision** — aprobada por el humano (Alberto Fojo) el 2026-08-24, implementada
  el mismo dia por sdd-implementador. **Segunda pasada tras el RED del verificador**: el
  bloqueante F1 era de la letra de CA-5, que el arquitecto reescribio; la reparacion es una
  linea de test y esta hecha (ver la fila CA-5 y §Vuelta del RED). Espera al verificador.
- Rama: `ft/SPEC-055-app-base-url-envenenada-appbaseurl-valida-el-valor-y-no-solo-su-presencia`
  (la abrio el humano desde `origin/main`; su primer commit trae la spec y este ledger).
- Esta entrega **toca `src/`**, asi que el gate `Version bump` exigio subida: **0.4.0 -> 0.4.1**,
  patch y no minor porque restaura una promesa ya entregada en vez de anadir alcance (mismo
  criterio que SPEC-043). `package.json` y `package-lock.json` en el **mismo commit** (ADR-033).
- **Conjunto cerrado de ficheros de la rama**, tal y como queda: **ocho** — la spec, este
  ledger, `src/lib/config/app-url.ts`, `src/app/layout.tsx`, `tests/app-base-url.test.ts`,
  `package.json`, `package-lock.json` y **`FOUNDATION.md`**. Los dos penultimos son la subida
  de version que la propia spec anticipa; la fila de gate que enumera el diff se escribio
  antes de saber que version tocaba. `FOUNDATION.md` entra en la segunda pasada, con D-7: no
  es codigo de aplicacion y por tanto **no** vuelve a mover la version
  (`tests/version-bump-gate.test.ts` lo tiene declarado como no vigilado), que sigue en
  **0.4.1**. Nada de `_qa/`: esta spec no genera evidencia visual.
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
| CA-1 | Clave ausente / `'   '` sigue lanzando con `/APP_BASE_URL no definida/` y la firma `appBaseUrl(env)` no cambia — **contrato con SPEC-052 CA-14** | `src/lib/config/app-url.ts` — el literal y la firma **sin tocar**, con el porqué escrito al lado | `tests/app-base-url.test.ts` › CA-1 — 3 casos: clave ausente, `'   '`, y la firma leída del fuente como texto (`export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string {`) más `appBaseUrl.length === 0` | **Verificado leyendo el fuente, no el relato.** `src/lib/config/app-url.ts:87` conserva el literal `APP_BASE_URL no definida (ver .env.example)…` y `:81` la firma `export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string {`. Contrastado contra la rama hermana con `git show ft/SPEC-052-…:tests/entornos-de-despliegue.test.ts`: sus dos únicas aserciones de runtime (`:712` y `:716`, `toThrow(/APP_BASE_URL no definida/)` sin la clave y con `'   '`) siguen satisfechas. Los 3 casos verdes en la suite. | ✅ |
| CA-2 | Valor que no parsea (`[SENSITIVE]`, sin esquema, `//evil.com`, comillas dentro) → lanza con diagnóstico; cada fila evalúa su propio «antes» | `src/lib/config/app-url.ts` — `new URL(raw)` en `try`/`catch`, y el `catch` llama a `rechazar()` | `tests/app-base-url.test.ts` › CA-2 — centinela de familia no vacía + 5 filas `it.each`; cada fila EJECUTA `new URL(valor)`, exige `/Invalid URL/` y que ese mensaje no nombre la clave, y después el rechazo nuevo | 5 filas verdes. El «antes» no es prosa: cada fila ejecuta `new URL(valor)`, exige `/Invalid URL/` y exige que ese mensaje **no** contenga `APP_BASE_URL` (`tests/app-base-url.test.ts:228-243`). Reinyectado el defecto (`git checkout origin/main -- src/lib/config/app-url.ts`), las 5 se ponen **rojas**; restaurado después, `git hash-object` vuelve a `29fcd0e`. | ✅ |
| CA-3 | Protocolo distinto de `http:`/`https:` (`ftp:`, `file:`, `javascript:`) → lanza; cada fila demuestra que hoy llega vivo al enlace de correo | `src/lib/config/app-url.ts` — guarda de `url.protocol` distinto de `http:`/`https:`; el motivo interpola el protocolo recibido | `tests/app-base-url.test.ts` › CA-3 — centinela + 3 filas (`ftp:`, `file:`, `javascript:`); cada fila MIDE el río abajo con `buildResetUrl` (llega vivo o estalla sin diagnóstico) antes de exigir el rechazo, y comprueba que el mensaje nombra el protocolo y los dos aceptados | 3 filas verdes. El río abajo se **mide** con `buildResetUrl` (`:251-272`): `ftp:` y `file:` llegan vivos al enlace del correo y se comprueba que conservan su protocolo; `javascript:` estalla allí con `Invalid URL` y sin nombrar la clave. Rojas las 3 con el defecto reinyectado. | ✅ |
| CA-4 | Ruta / query / fragmento / credenciales → lanza; barra final sigue tolerada (`https://a.com/` → `https://a.com`); la fila de la ruta calcula la discrepancia entre los dos consumidores | `src/lib/config/app-url.ts` — guardas de credenciales, `search`, `hash` y `!/^\/+$/.test(url.pathname)`; el recorte de barras finales sigue siendo `raw.replace(/\/+$/, '')` | `tests/app-base-url.test.ts` › CA-4 — centinela + 5 filas de forma, más el caso de la ruta que CALCULA la discrepancia (`new URL('https://a.com/es').pathname === '/es'` frente al enlace de correo, que la pierde) y el caso de la barra final (una y varias) | 5 filas de forma + los 2 casos propios, verdes. La discrepancia entre consumidores se **calcula** (`:285-298`): `new URL('https://a.com/es').pathname === '/es'` frente a `/reset-password/tok` en el correo. La barra final se sigue tolerando: `appBaseUrl('https://a.com/') === 'https://a.com'`, y también con varias. Guardas leídas en `app-url.ts:102-126`. | ✅ |
| CA-5 | Los valores vivos siguen valiendo: los **DOS** que un proceso consume se **leen** de `.github/workflows/ci.yml` y `tests/e2e/server.mjs`, con centinela de extracción no vacía; el origen `https` de producción va **escrito en el test** y **ningún caso lee `.env.example`** (D-7) | sin cambio de código: es la propiedad que la guardia no puede romper | `tests/app-base-url.test.ts` › CA-5 — 4 casos. **Se leen exactamente dos**, y son los vivos: el de CI recorre el YAML de `.github/workflows/ci.yml` y el del e2e resuelve `${APP_PORT}` desde `tests/e2e/server.mjs`, los dos con centinela de extracción no vacía. El tercero, *«y el origen https de producción, escrito aquí y no leído de ningún fichero (D-7)»*, usa el literal `https://stockeiro.tremen.dev` —el mismo que CA-6 ya exige dentro del mensaje, así que no entra ningún valor nuevo al fichero— y comprueba lo de siempre: `appBaseUrl()` lo devuelve sin lanzar y sin recorte. Cuarto caso: `http` y `localhost` valen sin excepción. **Corrección de F1:** eliminado `valorDeEnvExample()` entero con su comentario; `.env.example` ya no se lee en ningún punto del fichero (sólo sobrevive dentro del literal del mensaje de `appBaseUrlAnterior` y en comentarios, que no leen nada). El porqué —se lee lo que un proceso real **consume**, no documentación de otra spec— queda escrito junto al caso y en la cabecera del bloque, citando **D-7**. **No se añadió ninguna guardia sobre qué ficheros lee esta batería** (sería `F-SPEC-048-2`), como pide la §Nota de encuadre de CA-5 | Verde hoy y **medido en el mundo real**: `APP_BASE_URL=http://localhost:3200 npx next build` termina en **verde** (21 rutas, exit 0), así que el listón no se pasó de frenada. CI (`.github/workflows/ci.yml:148`) y el e2e (`tests/e2e/server.mjs:69`) se leen de verdad y ninguno se ha tocado. **PERO el tercer caso** (`tests/app-base-url.test.ts:375-379`) deriva su origen `https` de `.env.example` **y además exige que sea `https`** — y `.env.example` es fichero de SPEC-052, que ahora mismo lo está cambiando a `http://localhost:3000`. Simulado con el contenido real de esa rama: el caso **FALLARÍA**. Ver F1 del veredicto. | ⚠️ |
| CA-6 | El mensaje nombra clave + valor delimitado + forma esperada con ejemplo + `.env.production.local` manda sobre `.env`; aplicado a **todas** las filas | `src/lib/config/app-url.ts` — `rechazar()` compone las tres partes fijas: clave, valor delimitado con `«»` y recortado, forma esperada con los dos ejemplos, y la precedencia `.env.production.local` sobre `.env` | `tests/app-base-url.test.ts` › CA-6 — centinela + `it.each` sobre **TODAS** las filas de las tres familias, con los cuatro asertos etiquetados (a)(b)(c)(d) | 13 filas verdes, una por valor de las tres familias: los cuatro asertos se aplican a **todas**, no a una de muestra. Comprobado además fuera de la suite, en la salida literal del build envenenado (§Verificación de gate, escena 2): el mensaje lleva la clave, `«[SENSITIVE]»`, los dos ejemplos y la precedencia de `.env.production.local` sobre `.env`. | ✅ |
| CA-7 | `[SENSITIVE]` añade la pista de `vercel env pull` / *Sensitive*; `[REDACTED]` se rechaza igual **sin** pista; valor recortado en el mensaje | `src/lib/config/app-url.ts` — `MARCADOR_DE_VERCEL` y `MAX_VALOR_EN_MENSAJE = 120`; la pista se hace `push` **después** del rechazo genérico, nunca antes | `tests/app-base-url.test.ts` › CA-7 — 3 casos: `[SENSITIVE]` con pista y sin perder nada de CA-6, `[REDACTED]` rechazado igual y **sin** pista, y un valor de 314 caracteres que entra recortado | 3 casos verdes. La pista es **aditiva y no la rama que decide**: `[REDACTED]` se rechaza igual y su mensaje **no** contiene `vercel env pull` (`:416-424`); el `if` de `app-url.ts:70` está después de componer el rechazo genérico, no antes. El recorte a 120 se recalcula en el test a mano en vez de preguntárselo a la implementación (`:50-52`). | ✅ |
| CA-8 | Con la clave envenenada, recuperación falla **igual** para cuenta existente e inexistente y **sin tocar la BD**; el «antes» (oráculo 200/500 + enlace vivo quemado) se mide en el mismo fichero. `password-reset.ts` **sin modificar** | `src/lib/config/app-url.ts` — nada más: el arreglo es que el valor envenenado ya no sale de la función. `src/lib/auth/password-reset.ts` **sin modificar** (comprobado por el propio test) | `tests/app-base-url.test.ts` › CA-8 — 3 casos sobre un doble de `db` que registra CUALQUIER acceso. El DESPUÉS: las dos direcciones lanzan el mismo error con **cero** accesos. El ANTES, medido en el mismo fichero componiendo con `appBaseUrlAnterior`: la inexistente devuelve el acuse y la existente lanza tras un `update` y un `insert`; la asimetría se calcula. Tercer caso: `password-reset.ts` no gana ninguna guardia | **El apretón principal, y aguanta.** El «antes» está medido, no afirmado: con `appBaseUrlAnterior` componiendo, `noexiste@` devuelve el **acuse** y `existe@` **lanza** `Invalid URL` tras `update:passwordResetTokens` e `insert:passwordResetTokens` (`:587-617`); la asimetría se calcula comparando las dos listas de accesos. El doble de `db` es fiel al camino real (comprobado contra `password-reset.ts:79-107`: `getUserByEmail`, el `count(*)` que devuelve `n:0`, el `update` y el `insert`). **Y no es verde de vacío:** reinyectado el defecto de `origin/main`, la mitad del DESPUÉS se pone **roja** (junto con otros 43 casos del fichero); restaurado el árbol al hash original. `src/lib/auth/password-reset.ts` **idéntico a `origin/main`** (hash comparado). | ✅ |
| CA-9 | Única fuente del origen absoluto = `appBaseUrl()`; guardia estática sobre `src/` **con centinela** (cero puntos de uso ⇒ rojo) | sin cambio de código: `appBaseUrl()` sigue siendo el único productor (D-2) | `tests/app-base-url.test.ts` › CA-9 — 2 casos con recorrido de `src/` y comentarios fuera. Uno extrae las invocaciones de `requestPasswordReset` con paréntesis balanceados y exige `baseUrl: appBaseUrl()`; el otro exige que el argumento del origen de la tarjeta sea exactamente `new URL(appBaseUrl())`. Los dos con centinela: cero puntos de uso es rojo | 2 casos verdes. Los centinelas son reales: si `puntos.length === 0` el caso falla con mensaje propio (`:685-688`, `:712-715`). Contrastado a mano: el único punto de uso es `src/app/(auth)/actions.ts:128` (`{ baseUrl: appBaseUrl() }`) y el único `metadataBase` es `src/app/layout.tsx` con `new URL(appBaseUrl())`. | ✅ |
| CA-10 | Cero claves nuevas: `tests/spec-031-frontera.test.ts` (11, `toHaveLength(11)`) y `tests/tarjeta-frontera.test.ts` verdes **sin tocarse** | ninguna clave nueva: la guardia sólo lee `APP_BASE_URL` | `tests/spec-031-frontera.test.ts` y `tests/tarjeta-frontera.test.ts` verdes **sin una línea modificada** (confirmado con `git diff --name-only origin/main...HEAD`), más `tests/app-base-url.test.ts` › CA-10, que comprueba que `app-url.ts` no lee ninguna otra clave de entorno | Verde. Comprobado por hash que `tests/spec-031-frontera.test.ts` (con su `toHaveLength(11)` en `:149`) y `tests/tarjeta-frontera.test.ts` son **byte a byte idénticos a `origin/main`**; también `tests/tarjeta-guardias-ampliadas.test.ts`. Ninguna guardia ajena aflojada. El diff de la rama son 7 ficheros y ninguno de `_qa/`. | ✅ |
| CA-11 | ADR-026 §7: reimplementación de 3 líneas de la `appBaseUrl()` anterior en el test; cada valor rechazado la atraviesa (o estalla sin diagnóstico). Centinela: tabla no vacía y con las tres familias | n-a (vive en el test) | `tests/app-base-url.test.ts` — `appBaseUrlAnterior()`, la reimplementación de tres líneas con su porqué y su fecha (2026-08-24) al lado, y el bloque › CA-11: `it.each` sobre la tabla entera (atraviesa la anterior → río abajo estalla sin sujeto o llega vivo → la guardia nueva lo detiene) más el centinela de tabla no vacía y con representante de las tres familias | 13 filas + centinela, verdes. El contraste con `appBaseUrlAnterior` (`:65-69`) es fiel a lo que había: coincide línea a línea con `git show origin/main:src/lib/config/app-url.ts:13-19`. Con el defecto reinyectado el bloque entero se pone rojo, que es justo lo que ADR-026 §7 pide de una guardia nueva. | ✅ |
| CA-12 | La tabla crece sin tocar aserciones: ni `toHaveLength(` ni `toEqual([` sobre ella (`F-SPEC-048-2`) | n-a (vive en el test) | `tests/app-base-url.test.ts` › CA-12 — lee su propio fuente, recoge todo `toHaveLength(` y `toEqual([` y exige que ninguno mencione `VALORES_RECHAZADOS`; centinela de que la constante existe con ese nombre | Verde. Recorrido comprobado a mano sobre el fuente: no hay ningún `toHaveLength(` ni `toEqual([` que mencione `VALORES_RECHAZADOS`, y el centinela de que la constante existe con ese nombre impide que el caso pase de vacío si alguien la renombra. La tabla se recorre con `it.each` en los cuatro bloques que la usan. | ✅ |
| CA-13 | Cabecera de `app-url.ts` y comentario de `layout.tsx` dicen la otra mitad; `layout.tsx` cambia **sólo comentario** y `tarjeta-frontera.test.ts:75` sigue verde | `src/lib/config/app-url.ts` (cabecera) y `src/app/layout.tsx` (**sólo el comentario** del bloque `metadata`; la expresión no se toca) | `tests/app-base-url.test.ts` › CA-13 — 2 casos; cada uno exige la frase «lanza si falta o si el valor no es un origen absoluto `http`/`https`», `[SENSITIVE]` y `vercel env pull`, y el del layout comprueba además que `metadataBase: new URL(appBaseUrl())` y el import siguen literales | 2 casos verdes. `src/app/layout.tsx` cambia **sólo comentario**: `git diff origin/main..HEAD -- src/app/layout.tsx` son 10 líneas, todas dentro del bloque `/** … */`; la expresión `metadataBase: new URL(appBaseUrl())` no se toca y `tests/tarjeta-frontera.test.ts` sigue verde sin modificarse. La cabecera de `app-url.ts:10-33` dice la otra mitad y nombra `[SENSITIVE]`, `vercel env pull` y `.env.production.local`. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### RED — 2026-08-24, sdd-verificador

**Doce de trece CA cerrados con evidencia ejecutada. CA-5 queda con salvedad NO aceptada, y
esa salvedad es un rojo futuro garantizado en una spec hermana.** No encontré ningún defecto
en el código: la guardia hace lo que la spec pide, el mensaje dice lo que tiene que decir y el
oráculo de enumeración está cerrado y **medido**. Lo que devuelvo es una línea de test.

Lo que ejecuté, y no lo que se me contó:

- `npx tsc --noEmit` → exit 0. `npx eslint . --max-warnings=0` → exit 0.
- `npx vitest run` → **113 ficheros, 1767 casos, todos verdes**, 169 s.
- `node scripts/check-version-bump.mjs` → `La version sube de 0.4.0 a 0.4.1`, exit 0, con el
  árbol limpio, que es la condición que SPEC-049 le puso a este gate.
- Las tres escenas de build, con su salida literal en §Verificación de gate.
- **Prueba de mutación**: `git checkout origin/main -- src/lib/config/app-url.ts` (defecto
  reinyectado), `npx vitest run tests/app-base-url.test.ts` → **44 casos rojos**, entre ellos
  la mitad del DESPUÉS de CA-8. Restaurado acto seguido con `git checkout HEAD -- …`:
  `git hash-object` devuelve el mismo `29fcd0e5` de partida y `git status --porcelain` sale
  vacío. **No edité código: lo mutilé para medir y lo devolví byte a byte.**
- Comparación por hash contra `origin/main` de los ficheros ajenos sensibles:
  `tests/spec-031-frontera.test.ts` (con su `toHaveLength(11)` en `:149`),
  `tests/tarjeta-frontera.test.ts`, `tests/tarjeta-guardias-ampliadas.test.ts`,
  `src/lib/auth/password-reset.ts`, `.env.example`, `docs/despliegue.md`,
  `.github/workflows/ci.yml`, `tests/e2e/server.mjs` y `tests/ci-workflow.test.ts`:
  **los nueve idénticos**. Cero `_qa/` en el diff, como corresponde a una spec sin UI.

### Findings

**F1 (bloqueante) — CA-5 planta una mina roja bajo SPEC-052, y en el fichero que esta spec
declaró territorio ajeno.** `tests/app-base-url.test.ts:375-379` extrae el origen `https` de
`.env.example` y **exige que empiece por `https://`**:

    it('y el origen https de producción, leído de .env.example', () => {
      const v = valorDeEnvExample();
      expect(v.startsWith('https://'), `.env.example declara «${v}», que no es https`).toBe(true);

`.env.example` es de SPEC-052, y su CA-17 lo está cambiando ahora mismo. Ejecutado el mismo
extractor contra el contenido real de esa rama
(`git show ft/SPEC-052-…:.env.example` → `APP_BASE_URL="http://localhost:3000"`):

    valor extraido de .env.example de SPEC-052: "http://localhost:3000"
    startsWith(https://) => false => el caso CA-5 de SPEC-055 FALLARIA

Por qué esto es RED y no una salvedad que se acepta:

1. **Es simétrico al daño que esta misma spec dedicó una sección entera a evitar.** §Frontera
   con SPEC-052 y CA-1 existen porque «cambiar ese literal pone RED a SPEC-052 sin tocar ni
   uno de sus ficheros». CA-1 cumple. CA-5 comete exactamente esa falta por otro canal: quien
   mergee primero deja al otro rojo, y si es SPEC-055 quien entra antes, el verificador de
   SPEC-052 verá un rojo cuya causa aparente será su propio CA-17, que es un cambio legítimo.
2. **Contradice el motivo que el propio CA-5 invoca.** `FOUNDATION.md:101`: *«Un test de
   frontera fija una propiedad, no un estado del árbol […] Caduca al mergear —no cuando algo
   se rompe— y entonces pinta rojo sin defecto detrás, que es la peor clase de rojo.»* Que
   `.env.example` traiga hoy un ejemplo `https` es un estado del árbol, no una propiedad de
   `appBaseUrl()`.
3. **El ledger afirma lo contrario de lo que pasa.** «Intersección de ficheros entre las dos
   specs: vacía» es cierto para *escrituras* y falso para el acoplamiento real: este test
   **lee** un fichero de la otra spec y **asevera sobre su contenido**. Y «ninguna de las dos
   [líneas de D-SPEC-055-1] hace falta para que los trece CA pasen» se queda corto: no es que
   no hagan falta, es que uno de los cambios de SPEC-052 **rompe** un caso de CA-5.
4. **La reparación es una línea y no toca la guardia**, así que devolverla es barato: o el
   origen `https` se escribe en el test (CA-5 sólo obliga a **leer** los de CI y del e2e — «los
   **dos** valores se leen de esos ficheros»), o se lee `.env.example` sin aseverar el
   esquema, comprobando únicamente que `appBaseUrl()` devuelve lo que ese fichero declare.
   Lo decide quien implemente; yo no reparo.

### Salvedades que NO bloquean, y de quién son

**O1 (arquitecto) — CA-5 está mal redactado y es el origen de F1.** «Más un origen `https` de
producción **de la misma forma**» admite las dos lecturas: «también extraído de un fichero» y
«que se comporta igual». La frase siguiente sólo nombra **dos** ficheros. El implementador
escogió la lectura ancha y se llevó el acoplamiento; el CA debería decir de qué fuente sale el
tercer valor, o decir que se escribe a mano.

**O2 (arquitecto) — la enumeración cerrada de ficheros de la spec no incluye la subida de
versión.** §Ficheros que esta spec modifica lista tres, y el diff real trae además
`package.json` y `package-lock.json`. **No lo cuento contra el implementador**: la propia spec
cierra esa sección diciendo que el gate `Version bump` **sí** exigirá subida, ADR-033 obliga a
llevar versión y lock en el mismo commit, y `7ef6566` los lleva juntos y solos. Es la tabla la
que se escribió antes que su propia frase; el ledger ya lo dejó anotado. El conjunto se lee
razonablemente, pero la tabla debería listarlos.

**O3 (arquitecto) — la severidad del oráculo se cuenta sin decir que era LATENTE.** Todos los
artefactos condicionan la frase («con la clave envenenada», «en un despliegue con la clave
envenenada»), así que **ninguno miente**. Pero ninguno dice la otra mitad, y este proyecto ya
tiene specs dedicadas a frases que fueron ciertas y dejaron de serlo. La mitad que falta se
deduce de los propios artefactos, sin salir del repositorio: `metadataBase` se evalúa **en
tiempo de build** (SPEC-051 CA-1, y lo acabo de ver fallar), así que **un despliegue de
producción con `APP_BASE_URL` envenenada no llega a existir** — el build se cae antes. Por
tanto el oráculo **nunca estuvo abierto en un despliegue vivo**: era un defecto latente que
esperaba a que alguien construyera con la clave marcada *Sensitive*. Recomiendo que la spec o
el ledger lo digan con esas palabras. **Lo que NO puedo verificar desde los artefactos** es
cuánto vale hoy `APP_BASE_URL` en Vercel: `.env.production.local` la trae enmascarada, que es
el defecto entero.

**O4 (informativo) — el diagnóstico bueno del build viaja dentro de `[cause]`.** Next imprime
`Failed to collect configuration for /_not-found` en la primera línea y el mensaje de
`appBaseUrl()` en la segunda. Es de Next y no de esta spec, y el texto aparece completo; lo
anoto porque quien lea sólo la primera línea seguirá igual de perdido que antes.

### Lo que sí quedó demostrado, y merece constar

- **CA-8 no es un verde de vacío.** Es lo que más apreté. El «antes» se ejecuta con un doble
  de `db` fiel al camino real de `password-reset.ts:79-107`, y la asimetría 200/500 se
  **calcula** comparando dos listas de accesos. Con el defecto reinyectado, la mitad del
  DESPUÉS se pone **roja**. Un test de seguridad que se puede poner rojo protege algo.
- **El contrato con SPEC-052 CA-14 está intacto**, leído en el fuente de las dos ramas: el
  literal `APP_BASE_URL no definida` en `app-url.ts:87` y la firma `appBaseUrl(env)` en `:81`.
- **El listón de «válido» no se pasó de frenada**: `http` y `localhost` siguen valiendo, y no
  de palabra — un `next build` completo con `http://localhost:3200` termina en **verde**.

### Verificación de gate (fuera de la suite, a pegar aquí)

No cabe en la batería y se hace una vez, con la salida literal pegada (mismo tratamiento que
SPEC-052 CA-16):

**Cómo se corrió el envenenado.** No se fabricó nada: `.env.production.local` de esta máquina
ya trae `APP_BASE_URL="[SENSITIVE]"` —está cubierto por `.gitignore:12`, es local y **no se
tocó**— y Next lo carga por encima de `.env` en build de producción. Así que la escena
envenenada es, literalmente, `npx next build` a secas. Se usó `npx next build` y no
`npm run build` por una restricción del entorno del gate; es el mismo comando que ejecuta el
script.

| Escena | Qué se espera | Salida |
|---|---|---|
| `npx next build` con `APP_BASE_URL='[SENSITIVE]'`, **antes** del arreglo (medido reinyectando `origin/main:src/lib/config/app-url.ts`, y restaurado después) | `Failed to collect configuration` → `Invalid URL`, sin nombrar clave ni fichero | `Error: Failed to collect configuration for /admin` · `[cause]: TypeError: Invalid URL` · `at module evaluation (…/.next/server/chunks/ssr/[root-of-the-server]__0gktz9z._.js:7:1143)` — **exit 1**. Ni `APP_BASE_URL`, ni el valor, ni fichero alguno. (Nombra `/admin` y no `/_not-found`: sale la ruta del worker que estalla primero, y son 15.) |
| `npx next build` con `APP_BASE_URL='[SENSITIVE]'`, **después** | falla nombrando `APP_BASE_URL`, el valor, la forma esperada y `.env.production.local` | `- Environments: .env.production.local, .env` … `Error: Failed to collect configuration for /_not-found` · `[cause]: Error: APP_BASE_URL no es un origen absoluto usable: «[SENSITIVE]» — no es una URL absoluta, \`new URL()\` la rechaza. Se espera un origen \`http\` o \`https\` sin ruta, query, fragmento ni credenciales; por ejemplo http://localhost:3200 o https://stockeiro.tremen.dev. Dónde mirar: en un build de producción \`.env.production.local\` manda sobre \`.env\`, así que el valor puede venir de ahí aunque \`.env\` ni siquiera declare la clave. Pista: «[SENSITIVE]» es lo que escribe \`vercel env pull\` cuando la variable está marcada como Sensitive en Vercel: la CLI no revela el valor y deja ese marcador en \`.env.production.local\`. Escribe ahí el origen real, o desmarca la variable en Vercel.` — **exit 1**. Las cuatro partes de CA-6 y la pista de CA-7, en una sola línea. |
| `APP_BASE_URL=http://localhost:3200 npx next build` | verde | `✓ Compiled successfully in 4.2s` · `✓ Generating static pages using 15 workers (21/21) in 463ms` · tabla de 24 rutas — **exit 0**. `http` y `localhost` siguen valiendo de verdad, no sólo en un unitario. |
| `npx vitest run` / `npx tsc --noEmit` / `npx eslint . --max-warnings=0` | verdes; `tests/spec-031-frontera.test.ts` y `tests/tarjeta-frontera.test.ts` **sin tocar** | `Test Files 113 passed (113)` · `Tests 1767 passed (1767)`, 169.09 s — **exit 0**. Typecheck y lint, **exit 0** y sin salida. Los dos ficheros, y también `tests/tarjeta-guardias-ampliadas.test.ts`, **idénticos por hash a `origin/main`**. |
| `git diff --name-only` de la rama | (expectativa escrita antes de saber que tocaba subir versión — ver O2) | `docs/…/SPEC-055-….ledger.md`, `docs/…/SPEC-055-….md`, `package-lock.json`, `package.json`, `src/app/layout.tsx`, `src/lib/config/app-url.ts`, `tests/app-base-url.test.ts` — **7 ficheros**. Los dos de versión son los que ADR-033 exige en el mismo commit (`7ef6566`, y sólo ellos) y que el gate `Version bump` hace obligatorios por tocar `src/`. Cero `_qa/`. |
| Prueba de mutación (no la pide la spec; la pide el gate) | aflojar la guardia tiene que poner **roja** la mitad del DESPUÉS de CA-8 | Con `origin/main:src/lib/config/app-url.ts` en su sitio, `npx vitest run tests/app-base-url.test.ts` → **44 casos rojos**, incluido `CA-8 › el DESPUÉS: cuenta que existe y cuenta que no fallan idéntico y sin tocar la BD`. Restaurado con `git checkout HEAD -- …`: `git hash-object` = `29fcd0e53f918067fca2461477b774e6fa104e0e` (el de partida) y `git status --porcelain` vacío. |

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

- **`F-SPEC-055-3` — dos guardias de SPEC-051 miden MENCIONES cuando la propiedad que
  protegen es de CONDUCTA, y por eso castigan a quien se explica por escrito.**
  *(Re-encuadrado por sdd-arquitecto el 2026-08-24 sobre lo que levantó el implementador; su
  relato, intacto, debajo.)* Ninguna se tocó ni se aflojó, y las dos vigilan algo real. Lo que
  falla es el proxy: cuentan **dónde aparece un nombre** para decidir **quién hace algo**, y
  esos dos conjuntos dejan de coincidir en cuanto alguien escribe un mensaje de error o un
  comentario que **nombra** aquello de lo que habla. El coste no es un rojo: es que la
  entrega siguiente aprenda a **no explicarse** para no despertarlas, que es justo lo
  contrario de lo que este proyecto pide. Familia de `F-SPEC-048-2`. El relato del
  implementador, porque la proxima persona tropezara igual:
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
  entrega futura que quiera explicarse por escrito.

  **Triaje del arquitecto (2026-08-24), con el re-encuadre propuesto para quien lo recoja.**
  No pido aflojar ninguna de las dos: pido que midan lo que dicen medir, que es la salida
  «re-encuadrar» que `FOUNDATION.md` §Cómo se trabaja aquí ya declara legítima.
  1. La primera quiere decir *«un solo fichero de `src/` **asigna** el origen de la tarjeta»*.
     Hoy dice *«un solo fichero de `src/` **nombra** ese identificador»*, y por eso una
     aparición dentro de un literal de cadena la pone roja. Re-encuadre: contar **asignaciones**
     (la propiedad), o al menos excluir comentarios y literales de cadena antes de contar.
  2. La segunda quiere decir *«nadie re-encuadra una guardia de SPEC-051 sin pasar por el
     gate»*. Hoy congela **la lista de ficheros de `tests/` que citan `SPEC-051`**, así que un
     fichero **nuevo** que sólo la cite en un comentario la tumba — y una lista que crece es
     exactamente `F-SPEC-048-2`. Re-encuadre: vigilar **los ficheros que contienen las
     guardias**, por ruta, en vez de a todo el que pronuncie el id.
  Ninguno de los dos cambios es de esta spec —son guardias de SPEC-051— y por eso van a
  seguimiento en vez de al diff. Destino: **EPIC-INFRA**, junto con `F-SPEC-048-2`, con el que
  conviene tratarlas en el mismo lote: son el mismo defecto de proxy.

## Dependencias con otra spec en vuelo

- **`D-SPEC-055-1` → SPEC-052** (rama `ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde`,
  `en-revision`, sin pushear). Esta spec **no toca** `docs/despliegue.md` ni `.env.example`
  porque son suyos. Lo que les pide, dos líneas:
  1. `docs/despliegue.md` §0: `vercel env pull` deja `[SENSITIVE]` en las variables marcadas
     como *Sensitive* en Vercel, y en un build de producción `.env.production.local` **manda
     sobre** `.env`.
  2. Comentario de `APP_BASE_URL` en `.env.example`: la forma aceptada — origen `http`/
     `https`, sin ruta ni barra final.
  3. **Añadido el 2026-08-24, y es el reverso de F1:** si alguien quiere una guardia de que el
     valor que `.env.example` **enseña** pasa `appBaseUrl()` —y es una propiedad legítima; era
     la intención buena detrás del caso que hubo que quitar de CA-5—, **esa guardia vive en el
     fichero de test de SPEC-052, que es la dueña de `.env.example`**, y no en el de SPEC-055.
     Desde aquí sólo se puede pedir. Si SPEC-052 la declina, muere aquí: nadie más puede
     escribirla sin volver a plantar el acoplamiento.
  **Ninguno de los tres hace falta para que los trece CA pasen** — y desde la reescritura de
  CA-5 eso ya no esconde nada: ningún caso de esta spec depende del contenido de un fichero
  ajeno. Si SPEC-052 ya ha mergeado cuando esto se implemente, los tres pueden colgarse de
  esta spec; lo decide el humano en el gate.

- **Contrato compartido, no fichero: el literal `APP_BASE_URL no definida`.** SPEC-052 CA-14
  lo congela en `tests/entornos-de-despliegue.test.ts` (en su rama, `:697-740`), junto con la
  firma `appBaseUrl(env)`. **Cambiarlos pone RED a SPEC-052 sin tocar ninguno de sus
  ficheros.** CA-1 de esta spec existe para que eso no ocurra por descuido.

- **CORRECCIÓN del 2026-08-24, sdd-arquitecto (F1 pto. 3 del verificador).** Este ledger decía
  *«Intersección de ficheros entre las dos specs: vacía»*, y esa frase **es cierta para las
  escrituras y falsa para el acoplamiento real**. El comando que la respaldaba
  (`git diff --name-only origin/main...ft/SPEC-052-…`) sólo ve lo que se **escribe**. Lo que
  había era una **lectura**: `tests/app-base-url.test.ts` leía `.env.example` —fichero de
  SPEC-052— y **aseveraba sobre su contenido**, con lo que el primer merge de cualquiera de
  las dos ramas dejaba roja a la otra. Redacción correcta: **intersección de ESCRITURAS
  vacía; acoplamientos, DOS** — el contrato del literal (arriba) y esa lectura, cerrada al
  reescribir CA-5.
  Y la otra frase que se quedaba corta: *«ninguna de las dos [líneas de `D-SPEC-055-1`] hace
  falta para que los trece CA pasen»* era verdad de las dos líneas pedidas, pero ocultaba que
  **un cambio legítimo de SPEC-052 rompía un caso de CA-5**. Ya no: CA-5 no lee ningún fichero
  ajeno. La lección, generalizada, en `FOUNDATION.md` §Cómo se trabaja aquí y en D-7 de la
  spec.

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

### Vuelta del RED — qué cambió la spec y qué toca al implementador (2026-08-24, sdd-arquitecto)

El verificador devolvió **RED** con un solo bloqueante (F1) y **ningún defecto de código**.
Lo que estaba mal era la letra de CA-5, así que esta pasada **no toca ni código ni tests**:
sólo la spec, este ledger y `FOUNDATION.md`.

**Lo que cambió en la spec, para que se pueda releer sin diff:** CA-5 reescrito (dos valores
leídos, uno escrito) con la historia de por qué; **D-7** nuevo, con la lección general;
§Frontera con SPEC-052 pasa a enumerar **dos** acoplamientos (contrato y lectura); §Problema
gana §*La otra mitad de la frase* (el oráculo era **latente**, con la medida contra
producción); la tabla de ficheros lista ya `package.json`, `package-lock.json` y
`FOUNDATION.md`; y §Decisiones registra las **cuatro** decisiones que estaban tácitas.
**Consecuencia para el gate:** el conjunto cerrado de ficheros de la rama que enumera el
§Resumen de arriba pasa de siete a **ocho** — entra `FOUNDATION.md`, que no es código de
aplicación y por tanto **no** vuelve a mover la versión (`tests/version-bump-gate.test.ts`
lo tiene declarado como no vigilado).

**Lo que tiene que cambiar el implementador, y es todo lo que tiene que cambiar.** En
`tests/app-base-url.test.ts`, y sólo ahí:
1. **Borrar `valorDeEnvExample()`** entero, con su comentario de cabecera (hoy `:346-356`).
   Es su **único** uso: comprobado, `.env.example` no vuelve a aparecer en el fichero salvo
   dentro de literales de mensaje y de comentarios, que no leen nada.
2. **Sustituir el caso `it('y el origen https de producción, leído de .env.example', …)`**
   (hoy `:375-379`) por uno que use el origen **escrito en el test**:
   `https://stockeiro.tremen.dev` — el mismo literal que CA-6 ya exige en el mensaje, así que
   no introduce un valor nuevo en el fichero. Lo que debe seguir comprobando es lo de siempre:
   que `appBaseUrl()` lo devuelve sin lanzar y sin recorte.
3. **Dejar escrito al lado por qué ése no se lee y los otros dos sí**, citando **D-7**: se lee
   lo que un proceso consume de verdad (CI construye con el suyo, el e2e sirve con el suyo) y
   no se lee documentación de otra spec. Sin esa nota, el próximo lo «arregla» de vuelta.
4. **No añadir ninguna guardia** que vigile qué ficheros lee esta batería: sería la lista
   cerrada de `F-SPEC-048-2`. Está dicho en la §Nota de encuadre de CA-5.
5. **No tocar nada más.** Ni `.env.example`, ni `docs/despliegue.md`, ni
   `tests/ci-workflow.test.ts`, ni las guardias de SPEC-051, ni `src/lib/config/app-url.ts`
   —la guardia pasó el gate entera—, ni la versión: `0.4.1` ya está puesta y este cambio no
   toca `src/`.
Los otros dos casos de CA-5 (el de CI y el del e2e) **se quedan exactamente como están**,
centinelas incluidos: ésos sí leen valores vivos, y ésa es la mitad de CA-5 que siempre
estuvo bien.

### Respuesta al RED — qué hizo el implementador (2026-08-24, sdd-implementador)

**Hecho, y es todo lo que se hizo:** los cinco puntos de §Vuelta del RED, en
`tests/app-base-url.test.ts` y **sólo ahí**. Cero líneas de `src/`, cero ficheros ajenos.

1. `valorDeEnvExample()` **borrado** entero, con su comentario de cabecera.
2. El caso `it('y el origen https de producción, leído de .env.example', …)` **sustituido**
   por `it('y el origen https de producción, escrito aquí y no leído de ningún fichero
   (D-7)', …)`, que usa el literal `https://stockeiro.tremen.dev` —el mismo que CA-6 ya exige
   dentro del mensaje— y comprueba lo de siempre: `appBaseUrl()` lo devuelve sin lanzar y sin
   recorte.
3. El **porqué** queda escrito en dos sitios, para que sobreviva al próximo que lo lea: en la
   cabecera del bloque de CA-5 (reescrita: «los DOS valores VIVOS se LEEN; el tercero se
   escribe aquí») y en un comentario de once líneas junto al caso, citando **D-7** y cerrando
   con un *«NO la traigas de vuelta aquí»* dirigido a quien tenga la tentación de arreglarlo
   de vuelta.
4. **Ninguna guardia nueva** sobre qué ficheros lee esta batería, como pide la §Nota de
   encuadre de CA-5: sería la lista cerrada de `F-SPEC-048-2`.
5. Los casos de CI y del e2e, **intactos**, centinelas incluidos.

**La mina está desactivada, y medido y no afirmado.** No basta con decir que ya no se lee: se
puso el contenido **real** de la rama de SPEC-052 en `.env.example`
(`APP_BASE_URL="http://localhost:3000"`, el valor que su CA-17 introduce) y se corrió la
batería entera: **65/65 verdes**, el mismo resultado que con el fichero de hoy. Antes de este
cambio ese mismo contenido tumbaba el caso, que es exactamente lo que F1 midió. `.env.example`
se restauró acto seguido y se comprobó **byte a byte** con `git hash-object`
(`7b86eff3796ce4747cc8e0a6370113f102a54255` antes y después) y `git status --porcelain`
vacío: **se tocó para medir y se devolvió idéntico**, nunca entra en el diff.

**Comprobado además que `.env.example` no se lee en ningún punto del fichero:** `fuente()` —el
único lector— se invoca siete veces y ninguna con ese fichero (`ci.yml`, `server.mjs`,
`app-url.ts` ×3, `password-reset.ts`, `layout.tsx`). El literal `.env.example` sobrevive en
tres sitios y ninguno lee nada: el mensaje de la `appBaseUrl()` anterior reimplementada
(`:67`), y dos comentarios.

**Verde en esta pasada:** `tests/app-base-url.test.ts` **65/65**; suite completa **113
ficheros, 1767 casos**, los mismos totales que antes porque un caso sustituye a otro;
`npx tsc --noEmit` exit 0; `npx eslint . --max-warnings=0` exit 0.

**Lo que sigue sin ejecutarse, a propósito:** `D-SPEC-055-1` hacia SPEC-052, ahora con tres
puntos —el tercero es la guardia de que el ejemplo de `.env.example` pasa `appBaseUrl()`, que
vive con el dueño del fichero (D-7)—. Y el gate de build/versión, que es del verificador: la
versión no se movió porque este cambio no toca `src/`, y `FOUNDATION.md` no está vigilado.
