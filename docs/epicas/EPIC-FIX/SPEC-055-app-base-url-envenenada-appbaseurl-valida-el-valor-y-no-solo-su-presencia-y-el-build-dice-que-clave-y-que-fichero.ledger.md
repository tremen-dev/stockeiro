---
id: SPEC-055
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-055 APP_BASE_URL envenenada: appBaseUrl valida el valor y no solo su presencia, y el build dice que clave y que fichero

## Resumen
- Fase: **en-revision** — aprobada por el humano (Alberto Fojo) el 2026-08-24, implementada
  el mismo dia por sdd-implementador. **Tercera pasada, tras el SEGUNDO RED del verificador**:
  12 de 13 CA en verde con evidencia ejecutada; el unico bloqueante es **F1 de la 2.a vuelta**
  y vuelve a ser **de la letra** —CA-12 describia una forma prohibida en vez de la propiedad—.
  El arquitecto lo reescribio el 2026-08-24 (§Vuelta del 2.º RED) y el implementador respondio
  el mismo dia (§Respuesta al 2.º RED): el cambio vive entero en el bloque de CA-12 de
  `tests/app-base-url.test.ts`, con el detector extraido a funcion pura y la prueba de eficacia
  por mutacion en los dos sentidos. La pasada anterior cerro F1 de la
  1.a vuelta (CA-5), verificado.
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
- Suite completa en verde tras el cambio: **113 ficheros, 1779 casos**, mas `typecheck` y
  `lint` limpios.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Qué exige (resumen; la fuente es la spec) | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|---|
| CA-1 | Clave ausente / `'   '` sigue lanzando con `/APP_BASE_URL no definida/` y la firma `appBaseUrl(env)` no cambia — **contrato con SPEC-052 CA-14** | `src/lib/config/app-url.ts` — el literal y la firma **sin tocar**, con el porqué escrito al lado | `tests/app-base-url.test.ts` › CA-1 — 3 casos: clave ausente, `'   '`, y la firma leída del fuente como texto (`export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string {`) más `appBaseUrl.length === 0` | **3.a vuelta, re-medido.** El literal y la firma siguen en el fuente: `src/lib/config/app-url.ts:87` conserva `APP_BASE_URL no definida (ver .env.example)...` y `:81` la firma `export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string {`. Contrato con SPEC-052 comprobado **contra su rama**: `git show ft/SPEC-052-...:tests/entornos-de-despliegue.test.ts` tiene sus dos unicas invocaciones de runtime en `:712` y `:716`, las dos `toThrow(/APP_BASE_URL no definida/)` -sin la clave y con `'   '`- y las dos con un solo argumento; el codigo de esta rama las satisface (`:82` hace `trim()` y `:83` `if (!raw)`). 3 casos verdes en la bateria. | ✅ |
| CA-2 | Valor que no parsea (`[SENSITIVE]`, sin esquema, `//evil.com`, comillas dentro) → lanza con diagnóstico; cada fila evalúa su propio «antes» | `src/lib/config/app-url.ts` — `new URL(raw)` en `try`/`catch`, y el `catch` llama a `rechazar()` | `tests/app-base-url.test.ts` › CA-2 — centinela de familia no vacía + 5 filas `it.each`; cada fila EJECUTA `new URL(valor)`, exige `/Invalid URL/` y que ese mensaje no nombre la clave, y después el rechazo nuevo | **3.a vuelta, re-medido.** 5 filas verdes. El «antes» se **ejecuta**: cada fila corre `new URL(valor)`, exige `/Invalid URL/` y exige que ese mensaje **no** contenga `APP_BASE_URL` (`tests/app-base-url.test.ts:228-243`). **Mutacion mia (repetida, no heredada):** `git checkout origin/main -- src/lib/config/app-url.ts` -> **45 rojos / 32 verdes** en el fichero, las 5 filas de CA-2 entre ellos. Restaurado: `git hash-object` = `29fcd0e53f918067fca2461477b774e6fa104e0e`, `git status --porcelain` vacio. | ✅ |
| CA-3 | Protocolo distinto de `http:`/`https:` (`ftp:`, `file:`, `javascript:`) → lanza; cada fila demuestra que hoy llega vivo al enlace de correo | `src/lib/config/app-url.ts` — guarda de `url.protocol` distinto de `http:`/`https:`; el motivo interpola el protocolo recibido | `tests/app-base-url.test.ts` › CA-3 — centinela + 3 filas (`ftp:`, `file:`, `javascript:`); cada fila MIDE el río abajo con `buildResetUrl` (llega vivo o estalla sin diagnóstico) antes de exigir el rechazo, y comprueba que el mensaje nombra el protocolo y los dos aceptados | **3.a vuelta, re-medido.** 3 filas verdes. El rio abajo se **mide** con `buildResetUrl` (`:251-272`): `ftp:` y `file:` llegan vivos al enlace del correo conservando su protocolo, `javascript:` estalla alli con `Invalid URL` sin nombrar la clave. El mensaje nuevo interpola el protocolo recibido y nombra `http:`/`https:` (`app-url.ts:97-101`). Con el defecto de `origin/main` reinyectado, las 3 se ponen rojas. | ✅ |
| CA-4 | Ruta / query / fragmento / credenciales → lanza; barra final sigue tolerada (`https://a.com/` → `https://a.com`); la fila de la ruta calcula la discrepancia entre los dos consumidores | `src/lib/config/app-url.ts` — guardas de credenciales, `search`, `hash` y `!/^\/+$/.test(url.pathname)`; el recorte de barras finales sigue siendo `raw.replace(/\/+$/, '')` | `tests/app-base-url.test.ts` › CA-4 — centinela + 5 filas de forma, más el caso de la ruta que CALCULA la discrepancia (`new URL('https://a.com/es').pathname === '/es'` frente al enlace de correo, que la pierde) y el caso de la barra final (una y varias) | **3.a vuelta, re-medido.** 5 filas de forma + los 2 casos propios, verdes. La discrepancia entre los dos consumidores se **calcula** (`:285-298`). La barra final se tolera y tambien las varias (`:300-305`), que es la Decision 4. Guardas leidas una a una en `app-url.ts:102-126` (credenciales, `search`, `hash`, `!/^\/+$/.test(url.pathname)`); el recorte sigue siendo `raw.replace(/\/+$/, '')` (`:128`). | ✅ |
| CA-5 | Los valores vivos siguen valiendo: los **DOS** que un proceso consume se **leen** de `.github/workflows/ci.yml` y `tests/e2e/server.mjs`, con centinela de extracción no vacía; el origen `https` de producción va **escrito en el test** y **ningún caso lee `.env.example`** (D-7) | sin cambio de código: es la propiedad que la guardia no puede romper | `tests/app-base-url.test.ts` › CA-5 — 4 casos. **Se leen exactamente dos**, y son los vivos: el de CI recorre el YAML de `.github/workflows/ci.yml` y el del e2e resuelve `${APP_PORT}` desde `tests/e2e/server.mjs`, los dos con centinela de extracción no vacía. El tercero, *«y el origen https de producción, escrito aquí y no leído de ningún fichero (D-7)»*, usa el literal `https://stockeiro.tremen.dev` —el mismo que CA-6 ya exige dentro del mensaje, así que no entra ningún valor nuevo al fichero— y comprueba lo de siempre: `appBaseUrl()` lo devuelve sin lanzar y sin recorte. Cuarto caso: `http` y `localhost` valen sin excepción. **Corrección de F1:** eliminado `valorDeEnvExample()` entero con su comentario; `.env.example` ya no se lee en ningún punto del fichero (sólo sobrevive dentro del literal del mensaje de `appBaseUrlAnterior` y en comentarios, que no leen nada). El porqué —se lee lo que un proceso real **consume**, no documentación de otra spec— queda escrito junto al caso y en la cabecera del bloque, citando **D-7**. **No se añadió ninguna guardia sobre qué ficheros lee esta batería** (sería `F-SPEC-048-2`), como pide la §Nota de encuadre de CA-5 | **F1 de la 1.a vuelta sigue cerrado; lo volvi a medir entero.** (a) `.env.example` **no se lee en ningun punto**: las siete llamadas a `fuente()` (`:214, :323, :342, :868, :976, :989, :997`) son `app-url.ts` x3, `ci.yml`, `server.mjs`, `password-reset.ts` y `layout.tsx`; el literal solo sobrevive en el mensaje de `appBaseUrlAnterior` (`:67`) y en tres comentarios (`:374, :380, :972`). (b) **Prueba fuerte repetida:** puesto el `.env.example` **real** de la rama de SPEC-052 (`APP_BASE_URL="http://localhost:3000"`, hash `774d8572c89121553694cc0fb5c05980a821c609`) -> bateria **77/77 verde**. Restaurado byte a byte: hash `7b86eff3796ce4747cc8e0a6370113f102a54255`, `git status --porcelain` vacio. (c) Los dos valores vivos se leen de verdad y sus centinelas son reales: `valores.length > 0` para CI (`:354`) y `expect(m, ...).not.toBeNull()` mas `not.toContain('${')` para el e2e (`:343, :364`). (d) El liston no se paso de frenada: `APP_BASE_URL=http://localhost:3200 npm run build` -> **exit 0**, `Compiled successfully in 4.3s`, 21/21 paginas. | ✅ |
| CA-6 | El mensaje nombra clave + valor delimitado + forma esperada con ejemplo + `.env.production.local` manda sobre `.env`; aplicado a **todas** las filas | `src/lib/config/app-url.ts` — `rechazar()` compone las tres partes fijas: clave, valor delimitado con `«»` y recortado, forma esperada con los dos ejemplos, y la precedencia `.env.production.local` sobre `.env` | `tests/app-base-url.test.ts` › CA-6 — centinela + `it.each` sobre **TODAS** las filas de las tres familias, con los cuatro asertos etiquetados (a)(b)(c)(d) | **3.a vuelta, re-medido dentro y fuera de la suite.** 13 filas verdes, una por valor de las tres familias: los cuatro asertos (a)(b)(c)(d) se aplican a **todas** (`:401-409`), no a una de muestra. Y comprobado en la salida literal de `npm run build` con el `.env.production.local` real envenenado (Escena 2 de esta vuelta): el `[cause]` de la segunda linea lleva la clave, `«[SENSITIVE]»`, los dos ejemplos (`http://localhost:3200`, `https://stockeiro.tremen.dev`) y la precedencia de `.env.production.local` sobre `.env`. | ✅ |
| CA-7 | `[SENSITIVE]` añade la pista de `vercel env pull` / *Sensitive*; `[REDACTED]` se rechaza igual **sin** pista; valor recortado en el mensaje | `src/lib/config/app-url.ts` — `MARCADOR_DE_VERCEL` y `MAX_VALOR_EN_MENSAJE = 120`; la pista se hace `push` **después** del rechazo genérico, nunca antes | `tests/app-base-url.test.ts` › CA-7 — 3 casos: `[SENSITIVE]` con pista y sin perder nada de CA-6, `[REDACTED]` rechazado igual y **sin** pista, y un valor de 314 caracteres que entra recortado | **3.a vuelta, re-medido.** 3 casos verdes. La pista es **aditiva y no la rama que decide**: `[REDACTED]` se rechaza igual y su mensaje **no** contiene `vercel env pull` (`:422-430`); el `if` de `app-url.ts:70` va **despues** de componer las tres partes fijas, no antes. El recorte a 120 se recalcula en el test a mano (`:50-52`) en vez de preguntarselo a la implementacion. La pista aparece tambien en la salida real del build envenenado. | ✅ |
| CA-8 | Con la clave envenenada, recuperación falla **igual** para cuenta existente e inexistente y **sin tocar la BD**; el «antes» (oráculo 200/500 + enlace vivo quemado) se mide en el mismo fichero. `password-reset.ts` **sin modificar** | `src/lib/config/app-url.ts` — nada más: el arreglo es que el valor envenenado ya no sale de la función. `src/lib/auth/password-reset.ts` **sin modificar** (comprobado por el propio test) | `tests/app-base-url.test.ts` › CA-8 — 3 casos sobre un doble de `db` que registra CUALQUIER acceso. El DESPUÉS: las dos direcciones lanzan el mismo error con **cero** accesos. El ANTES, medido en el mismo fichero componiendo con `appBaseUrlAnterior`: la inexistente devuelve el acuse y la existente lanza tras un `update` y un `insert`; la asimetría se calcula. Tercer caso: `password-reset.ts` no gana ninguna guardia | **El apreton principal, repetido desde cero y aguanta.** El «antes» se **ejecuta**: con `appBaseUrlAnterior` componiendo, `noexiste@` devuelve el **acuse** y `existe@` **lanza** `Invalid URL` -sin nombrar `APP_BASE_URL`- tras `update:passwordResetTokens` e `insert:passwordResetTokens` (`:833-863`); la asimetria se **calcula** (`expect(existe.desenlace.tipo).not.toBe(noExiste.desenlace.tipo)` y `existe.accesos.length > noExiste.accesos.length`). El «despues»: las dos direcciones lanzan `toStrictEqual` el mismo desenlace y `accesos` **vacio** en las dos. **Y no es verde de vacio:** reinyectado `origin/main:src/lib/config/app-url.ts`, la mitad del DESPUES cae con los otros 44. `src/lib/auth/password-reset.ts` **identico a `origin/main` por hash**, y el tercer caso lo vigila desde dentro (`:866-873`). | ✅ |
| CA-9 | Única fuente del origen absoluto = `appBaseUrl()`; guardia estática sobre `src/` **con centinela** (cero puntos de uso ⇒ rojo) | sin cambio de código: `appBaseUrl()` sigue siendo el único productor (D-2) | `tests/app-base-url.test.ts` › CA-9 — 2 casos con recorrido de `src/` y comentarios fuera. Uno extrae las invocaciones de `requestPasswordReset` con paréntesis balanceados y exige `baseUrl: appBaseUrl()`; el otro exige que el argumento del origen de la tarjeta sea exactamente `new URL(appBaseUrl())`. Los dos con centinela: cero puntos de uso es rojo | **3.a vuelta, re-medido a mano sobre `src/`.** 2 casos verdes y sus centinelas son reales: `puntos.length` con `toBeGreaterThan(0)` y mensaje propio en `:931-934` y `:956-959` -cero puntos de uso pone el caso rojo, no verde-. Contrastado a mano: el **unico** `requestPasswordReset(` fuera de su propio modulo es `src/app/(auth)/actions.ts:124`, con `baseUrl: appBaseUrl()` en `:128`; la **unica** expresion `metadataBase:` de `src/` es `src/app/layout.tsx:67`, y vale exactamente `new URL(appBaseUrl())`. | ✅ |
| CA-10 | Cero claves nuevas: `tests/spec-031-frontera.test.ts` (11, `toHaveLength(11)`) y `tests/tarjeta-frontera.test.ts` verdes **sin tocarse** | ninguna clave nueva: la guardia sólo lee `APP_BASE_URL` | `tests/spec-031-frontera.test.ts` y `tests/tarjeta-frontera.test.ts` verdes **sin una línea modificada** (confirmado con `git diff --name-only origin/main...HEAD`), más `tests/app-base-url.test.ts` › CA-10, que comprueba que `app-url.ts` no lee ninguna otra clave de entorno | **3.a vuelta, re-medido.** Verde. `git diff --name-only origin/main..HEAD` = **8 ficheros** exactos, los ocho del conjunto cerrado, **cero `_qa/`**. Comparados por hash contra `origin/main`: `tests/spec-031-frontera.test.ts` (con su `toHaveLength(11)` en `:149`), `tests/tarjeta-frontera.test.ts`, `tests/tarjeta-guardias-ampliadas.test.ts`, `src/lib/auth/password-reset.ts`, `.env.example`, `docs/despliegue.md`, `.github/workflows/ci.yml`, `tests/e2e/server.mjs`, `tests/ci-workflow.test.ts` y `tests/version-bump-gate.test.ts` -los **diez identicos**-. El caso propio (`:970-981`) tiene centinela (`claves.size > 0`) y confirma que `app-url.ts` no lee ninguna otra clave. | ✅ |
| CA-11 | ADR-026 §7: reimplementación de 3 líneas de la `appBaseUrl()` anterior en el test; cada valor rechazado la atraviesa (o estalla sin diagnóstico). Centinela: tabla no vacía y con las tres familias | n-a (vive en el test) | `tests/app-base-url.test.ts` — `appBaseUrlAnterior()`, la reimplementación de tres líneas con su porqué y su fecha (2026-08-24) al lado, y el bloque › CA-11: `it.each` sobre la tabla entera (atraviesa la anterior → río abajo estalla sin sujeto o llega vivo → la guardia nueva lo detiene) más el centinela de tabla no vacía y con representante de las tres familias | **3.a vuelta, re-medido, y ademas sobrevive a la guardia nueva -que era la mitad en riesgo.** 13 filas + el centinela de las tres familias, verdes. La reimplementacion de `appBaseUrlAnterior` (`:65-69`) coincide linea a linea con `git show origin/main:src/lib/config/app-url.ts`. Con el defecto reinyectado el bloque entero se pone rojo (ADR-026 §7). **Y la reparacion barata quedo descartada por medida:** inyectado `expect(VALORES_RECHAZADOS.length).toBeGreaterThan(0);` -el centinela literal de este CA- a media altura del fuente real, la bateria queda **77/77 verde**: la guardia de CA-12 **no** lo caza, asi que no hay presion para aflojar este suelo. | ✅ |
| CA-12 | **(a)** Añadir una fila mañana no obliga a tocar ningún aserto de la batería. Discriminante único: **si añadir una fila obligara a actualizar ese aserto, ese aserto congela**; lo que se **deriva** de la propia tabla y el **suelo sin techo** (el centinela de CA-11) sobreviven intactos. **(b)** Y la guardia que lo vigila **se puede poner roja**: prueba de eficacia **por mutación y en los dos sentidos** —lo que debe cazar y lo que **no** debe cazar— más el fuente real, que sale limpio; con centinelas que fallan en vez de pasar de vacío. *(Letra reescrita el 2026-08-24 tras `F1` de la 2.ª vuelta; **la fuente es la spec**, §CA-12, y el porqué de no enumerar formas está en **D-8** y `F-SPEC-048-2`. Este resumen se actualizó el 2026-08-25 cerrando `O1`: decía la letra vieja.)* | n-a (vive en el test). **Reescrito entero en la 3.ª pasada** tras `F1` de la 2.ª vuelta: el detector sale del `it` y pasa a ser **función pura de texto** —`asertosQueCongelan(codigo)` y su `congelaLaTabla(fragmento)`—, apoyada en `soloCodigo()` (quita comentarios, vacía cadenas y colapsa expresiones regulares) y `sentenciasDeAserto()` (recorta **del `expect(` a su `;`**, con paréntesis balanceados y atravesando saltos de línea). **El criterio no enumera formas prohibidas** (D-8): un aserto congela cuando las **tres** cosas a la vez — lo observado depende de la tabla, el matcher compara **exacto** y lo esperado es una **magnitud o lista escrita a mano** en vez de derivada. La única lista es la de matchers **tolerantes** (`toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toContain`, `toContainEqual`), y es de lo **permitido** a propósito: un matcher desconocido cuenta como exacto, así que la guardia falla hacia el **rojo**, nunca hacia la ceguera. Nota al lado con el porqué, citando `F1` de la 2.ª vuelta, **D-8**, `F-SPEC-048-2` y ADR-026 §7 | `tests/app-base-url.test.ts` › CA-12 — **13 casos** (antes 1). Dos **centinelas**: el conjunto de especímenes no está vacío **y tiene las dos direcciones**, y la constante sigue existiendo con ese nombre en el fuente. Un caso para el **fuente real**, que debe salir limpio (`asertosQueCongelan(src)` → `[]`). Y la **prueba de eficacia por mutación, sin tocar el disco**, sobre cinco especímenes escritos en el test y en **dos modos** cada uno —el detector suelto, y el espécimen **inyectado en el fuente real en memoria**, que además mide el recorrido a escala de fichero—: **debe cazar** `expect(VALORES_RECHAZADOS).toHaveLength(13);` y `expect(VALORES_RECHAZADOS.length).toBe(13);` —los dos escritos como **regresión de `F1`, 2026-08-24**, que es lo que el verificador inyectó y la guardia dejó pasar— más uno de composición con `toEqual([...])`; y **NO debe cazar** `expect(algo).toHaveLength(VALORES_RECHAZADOS.length);` (derivada) ni `expect(VALORES_RECHAZADOS.length).toBeGreaterThan(0);` (**el centinela de CA-11**, con el porqué escrito al lado: cazarlo es la reparación barata y pondría roja a CA-11) | **GREEN, y por mutacion propia en los dos sentidos. F1 de la 2.a vuelta esta cerrado.** **(a) La propiedad se cumple, verificada a mano y exhaustivamente:** las unicas sentencias `expect(` del fichero que dependen de la tabla son `:225`, `:248`, `:277` (`deFamilia(...).length`), `:395` y `:442`, y **las cinco** son `toBeGreaterThan(0)` -suelo sin techo-; ninguna fija longitud ni compara con lista literal. **(b) «Debe cazar», medido en el disco y a media altura, que es donde la anterior era ciega:** inyectado `expect(VALORES_RECHAZADOS).toHaveLength(13);` tras las lineas **221, 468, 724 y 968** (21%, 46%, 71% y 96% del fichero), el caso `el fuente real no congela la tabla` se pone **rojo en las cuatro** (`expected [ Array(1) ] to deeply equal []`). **(c) La normalizacion no deja ciego el recorrido en ningun punto:** inyectada la misma congelacion en **las 13 fronteras de nivel superior a la vez**, el detector devuelve **`Array(13)`** -las ve todas; ningun literal raro descarrila el analizador-. **(d) «NO debe cazar», que era la mitad que faltaba:** inyectadas en el fuente real `expect(VALORES_RECHAZADOS.length).toBeGreaterThan(0);` (el centinela de CA-11), `expect(VALORES_RECHAZADOS).toHaveLength(VALORES_RECHAZADOS.length);` (derivada) y `expect(VALORES_RECHAZADOS.map((f) => f.nombre)).toContain('ftp:');`, la bateria queda **77/77 verde** en las tres: cero falsas alarmas, y **CA-11 sigue verde**. **(e) Se puede violar de una forma que no esta entre los cinco especimenes y aun asi falla** -el liston que el propio D-8 fija-: `toEqual(13)`, `toStrictEqual([1, 2])`, la version **multilinea** de `expect(\n VALORES_RECHAZADOS,\n).toHaveLength(13);`, `expect(VALORES_RECHAZADOS.filter(...)).toHaveLength(5)` y hasta un techo `toBeLessThan(14)` -matcher desconocido, luego cuenta como exacto- se ponen **rojas las cinco**. **(f) Nada aflojado:** cero `.skip`/`.only`/`.todo` en el fichero; el diff `9ba7659..HEAD` de `tests/app-base-url.test.ts` es **+250/-10** y las 10 lineas borradas son **exactamente el caso ciego anterior**, nada mas. Arbol restaurado tras cada mutacion: hash `6f5704a3a19b0cf60e9e64dd1d137144019fcacb`, `git status --porcelain` vacio. | ✅ |
| CA-13 | Cabecera de `app-url.ts` y comentario de `layout.tsx` dicen la otra mitad; `layout.tsx` cambia **sólo comentario** y `tarjeta-frontera.test.ts:75` sigue verde | `src/lib/config/app-url.ts` (cabecera) y `src/app/layout.tsx` (**sólo el comentario** del bloque `metadata`; la expresión no se toca) | `tests/app-base-url.test.ts` › CA-13 — 2 casos; cada uno exige la frase «lanza si falta o si el valor no es un origen absoluto `http`/`https`», `[SENSITIVE]` y `vercel env pull`, y el del layout comprueba además que `metadataBase: new URL(appBaseUrl())` y el import siguen literales | **3.a vuelta, re-medido.** 2 casos verdes. `git diff origin/main..HEAD -- src/app/layout.tsx` cae **entero** dentro del bloque `/** ... */` (lineas 37-56): la expresion `metadataBase: new URL(appBaseUrl())` sigue literal en `:67` y `tests/tarjeta-frontera.test.ts` es identico por hash a `origin/main` y verde. La cabecera de `app-url.ts:10-33` dice la otra mitad y nombra `[SENSITIVE]`, `vercel env pull` y `.env.production.local`. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### GREEN (3.a vuelta) — 2026-08-24, sdd-verificador

**GREEN. Los trece CA en verde, y el que faltaba lo cerre por mutacion en los dos sentidos.**
`F1` de la 2.a vuelta esta cerrado: la guardia de CA-12 ya no es ciega, se pone roja cuando la
tabla se congela **a cualquier altura del fichero**, y **no** muerde a su vecina CA-11.

**No herede ninguna casilla.** Las columnas de las dos vueltas anteriores las trate como
material, no como veredicto: volvi a apretar las dos mutaciones caras que sostienen los CA con
mas peso -el defecto de `app-url.ts` reinyectado desde `origin/main`, y el `.env.example` de la
rama de SPEC-052 puesto en su sitio-, volvi a correr **las tres escenas de build** con el
`.env.production.local` real, y volvi a mirar los once CA restantes desde el fuente.

**Lo que ejecute, y no lo que se me conto:**

- `npm test` -> **113 ficheros, 1779 casos, todos verdes**, 133,94 s, exit 0. La subida
  1767 -> 1779 y 65 -> 77 casos en el fichero es la esperada: esta vuelta **anade** casos, no
  sustituye uno.
- `npm run typecheck` -> exit 0. `npm run lint` (`eslint . --max-warnings=0`) -> exit 0.
- `npm run version:check` -> `La version sube de 0.4.0 a 0.4.1`, exit 0, **con el arbol
  limpio**, que es la condicion que SPEC-049 le puso a este gate. `package.json` en `0.4.1`.
- **Las tres escenas de build**, con `npm run build` y con el `.env.production.local` real de
  esta maquina -`APP_BASE_URL="[SENSITIVE]"`, cubierto por `.gitignore:12`-, que **no se toco**.
- **Nueve mutaciones**, todas restauradas y comprobadas con `git hash-object` +
  `git status --porcelain` vacio. Detalle en §Verificacion de gate (3.a vuelta).
- Comparacion por hash contra `origin/main` de los **diez** ficheros ajenos sensibles: los diez
  identicos. Diff de la rama: **ocho ficheros**, los ocho del conjunto cerrado, **cero `_qa/`**.

**Como cerre CA-12, que era el encargo.** Cuatro medidas, y las cuatro pasan:

1. **Debe cazar, y a media altura.** Inyecte `expect(VALORES_RECHAZADOS).toHaveLength(13);` en
   el fichero **real** tras las lineas 221, 468, 724 y 968 -21%, 46%, 71% y 96%-. El caso
   `el fuente real no congela la tabla` se pone **rojo en las cuatro**. La guardia anterior
   seguia verde con esa misma inyeccion: la ceguera esta cerrada.
2. **El recorrido no queda ciego a partir de ningun punto.** Este era el modo de fallo natural
   de una normalizacion que vacia cadenas y colapsa regex. Inyecte la congelacion en **las 13
   fronteras de nivel superior a la vez** y el detector devolvio **`Array(13)`**: las ve todas.
   Ningun literal del fichero descarrila el analizador.
3. **NO debe cazar, que es la mitad que importa.** Inyectados en el fuente real el centinela
   literal de CA-11 (`expect(VALORES_RECHAZADOS.length).toBeGreaterThan(0);`), la forma
   derivada (`toHaveLength(VALORES_RECHAZADOS.length)`) y una pertenencia (`toContain`), la
   bateria queda **77/77 verde** en los tres casos. **CA-11 sigue verde.** La reparacion barata
   -cazar cualquier mencion de la constante- queda descartada por medida, no por promesa.
4. **Nada se aflojo para conseguirlo.** Cero `.skip`, `.only`, `.todo`, `xit` o `xdescribe` en
   el fichero. El diff `9ba7659..HEAD` de `tests/app-base-url.test.ts` es **+250 / -10**, y las
   diez lineas borradas son **exactamente el caso ciego anterior**. La unica lista de matchers
   que hay es la de los **tolerantes** y es de lo permitido: un matcher desconocido cuenta como
   exacto, asi que la guardia falla hacia el rojo y nunca hacia la ceguera -lo comprobe con
   `toBeLessThan(14)`, que no esta en ninguna parte y se caza igual-.

**Y le aplique a CA-12 su propio liston, el de D-8:** *un CA esta bien escrito si se puede
violar de una forma que no se le ocurrio a quien lo escribio, y aun asi falla*. Cinco formas de
congelar que **no** estan entre los cinco especimenes -`toEqual(13)`, `toStrictEqual([1, 2])`,
la version **multilinea** del `expect(`, `expect(VALORES_RECHAZADOS.filter(...)).toHaveLength(5)`
y el techo `toBeLessThan(14)`- se ponen **rojas las cinco**. El CA pasa su propia prueba.

**Sobre `FOUNDATION.md`.** El humano autorizo el 2026-08-24 que se tocara en esta rama, asi que
no es hallazgo mio; lo que si juzgo es si lo que dice es **cierto** y si los artefactos lo
respetan. Lo es en la parte que puedo medir: de los cuatro casos de la tabla de D-8, los dos de
SPEC-055 los verifique yo mismo -CA-5 acabo leyendo `.env.example`, de otra spec, y CA-12
resulto ciega a la congelacion escrita al derecho-, y el corolario que sale de ahi lo cumple el
propio CA-12 reescrito: enuncia la propiedad, se niega expresamente a enumerar formas
prohibidas, y exige la prueba de eficacia con especimenes minimos en los dos sentidos. Los dos
de SPEC-054 no son de mi jurisdiccion y no los mido aqui.

### Verificacion de gate (3.a vuelta, fuera de la suite) — 2026-08-24

| Escena | Que se espera | Salida medida |
|---|---|---|
| `npm run build` con `APP_BASE_URL='[SENSITIVE]'`, **antes** del arreglo (`origin/main:src/lib/config/app-url.ts` reinyectado, y restaurado despues) | `Invalid URL` sin nombrar clave ni fichero | `Error: Failed to collect configuration for /_not-found` y `for /ayuda` -**dos rutas distintas en la misma corrida**, que confirma lo que §Problema dice de la variabilidad- - `[cause]: TypeError: Invalid URL`. **exit 1**, y `grep -c APP_BASE_URL` sobre el log entero = **0**. |
| `npm run build` con `APP_BASE_URL='[SENSITIVE]'`, **despues** | falla nombrando clave, valor, forma y `.env.production.local`, con la pista de `vercel env pull` | `Error: Failed to collect configuration for /_not-found` - `[cause]: Error: APP_BASE_URL no es un origen absoluto usable: «[SENSITIVE]» — no es una URL absoluta, \`new URL()\` la rechaza. Se espera un origen \`http\` o \`https\` sin ruta, query, fragmento ni credenciales; por ejemplo http://localhost:3200 o https://stockeiro.tremen.dev. Donde mirar: en un build de produccion \`.env.production.local\` manda sobre \`.env\` ... Pista: «[SENSITIVE]» es lo que escribe \`vercel env pull\` ...` **exit 1**. Las cuatro partes de CA-6 y la pista de CA-7, dentro del `[cause]` de la segunda linea. |
| `APP_BASE_URL=http://localhost:3200 npm run build` | verde | `✓ Compiled successfully in 4.3s` - `✓ Generating static pages using 15 workers (21/21) in 457ms` - **exit 0**. |
| `npm test` / `npm run typecheck` / `npm run lint` | verdes | `Test Files 113 passed (113)` - `Tests 1779 passed (1779)`, 133,94 s - **exit 0**. Typecheck y lint, exit 0 y sin salida. |
| `npm run version:check` | la version sube y el arbol esta limpio (SPEC-049) | `[check-version-bump] Base: origin/main.` - `[check-version-bump] La version sube de 0.4.0 a 0.4.1.` - **exit 0**. |
| `git diff --name-only origin/main..HEAD` | el conjunto cerrado de **ocho**, cero `_qa/` | `FOUNDATION.md`, la spec, este ledger, `package-lock.json`, `package.json`, `src/app/layout.tsx`, `src/lib/config/app-url.ts`, `tests/app-base-url.test.ts` - **8**, cero `_qa/`. |
| Ficheros ajenos, contra `origin/main` | identicos | `tests/spec-031-frontera.test.ts`, `tests/tarjeta-frontera.test.ts`, `tests/tarjeta-guardias-ampliadas.test.ts`, `src/lib/auth/password-reset.ts`, `.env.example`, `docs/despliegue.md`, `.github/workflows/ci.yml`, `tests/e2e/server.mjs`, `tests/ci-workflow.test.ts`, `tests/version-bump-gate.test.ts` - **los diez identicos por hash**. |
| Mutacion 1 (la guardia) | reinyectar el defecto pone roja la bateria, CA-8 incluida | `origin/main:src/lib/config/app-url.ts` -> **45 rojos / 32 verdes**, en CA-2, CA-3, CA-4, CA-6, CA-7, CA-8, CA-11 y CA-13. Restaurado: hash `29fcd0e5...`, `git status --porcelain` vacio. |
| Mutacion 2 (`F1` de la 1.a vuelta) | el `.env.example` de SPEC-052 no tumba nada | Con `APP_BASE_URL="http://localhost:3000"` (hash `774d8572...`): bateria **77/77 verde**. Restaurado byte a byte: hash `7b86eff3796ce4747cc8e0a6370113f102a54255`, arbol limpio. |
| Mutacion 3 (`F1` de la 2.a vuelta, **debe cazar**) | congelar la tabla **a media altura** pone rojo CA-12 | `expect(VALORES_RECHAZADOS).toHaveLength(13);` inyectado tras las lineas **221 / 468 / 724 / 968** del fichero real: `el fuente real no congela la tabla` **rojo en las cuatro** (`expected [ Array(1) ] to deeply equal []`). |
| Mutacion 4 (ceguera parcial) | la normalizacion no deja ciego el recorrido a partir de ningun punto | La misma congelacion inyectada en **las 13 fronteras de nivel superior a la vez** -> el detector devuelve **`Array(13)`**. Las ve todas. |
| Mutacion 5 (**NO debe cazar**) | las formas buenas no se cazan, y CA-11 sigue verde | Inyectados en el fuente real `expect(VALORES_RECHAZADOS.length).toBeGreaterThan(0);`, `expect(VALORES_RECHAZADOS).toHaveLength(VALORES_RECHAZADOS.length);` y `expect(VALORES_RECHAZADOS.map((f) => f.nombre)).toContain('ftp:');` -> **77/77 verde** en los tres. Cero falsas alarmas. |
| Mutacion 6 (el liston de D-8) | violarla de una forma que no esta entre los especimenes y aun asi falla | `toEqual(13)`, `toStrictEqual([1, 2])`, el `expect(` **multilinea**, `expect(VALORES_RECHAZADOS.filter(...)).toHaveLength(5)` y `toBeLessThan(14)` -> **rojas las cinco**. |
| Estado del arbol al terminar | limpio, y los tres ficheros mutados en su hash original | `git status --porcelain` **vacio**. `tests/app-base-url.test.ts` = `6f5704a3...`, `src/lib/config/app-url.ts` = `29fcd0e5...`, `.env.example` = `7b86eff3...`. |

### Observaciones que NO bloquean (3.a vuelta), y de quien son

Ninguna baja un CA. Las escribo porque son accionables y porque tienen dueno.

- **O1 (drift documental, del arquitecto) — la columna *Que exige* de la fila CA-12 de la
  matriz de arriba sigue diciendo la letra VIEJA**: *«ni `toHaveLength(` ni `toEqual([` sobre
  ella»*, que es exactamente la enumeracion de formas que **D-8 prohibe** y que causo `F1`.
  **La culpa no es del implementador.** `git log -L 55,55` sobre este fichero la situa en
  `3684b13`, el commit fundacional del ledger, que es del **arquitecto** y traia la spec; cuando
  el arquitecto reescribio CA-12 en `bfb35c3` actualizo la spec y no su propio resumen aqui. El
  implementador hizo bien en no tocarla: no es su columna -la nota de escritores solo le asigna
  *Implementado* y *Test*- y tampoco es la mia. **No la toco; va al arquitecto.** El dano es
  acotado: la cabecera de la tabla ya dice *«resumen; la fuente es la spec»*, y la spec esta al
  dia. Pero es la letra caduca sobreviviendo en el sitio donde el proximo la lee primero, que es
  justo lo que el corolario nuevo de `FOUNDATION.md` viene a evitar.
- **O2 (residual del mecanismo, para quien gobierne una CA-12 futura) — el detector reconoce la
  tabla por su nombre literal dentro del `expect(`, y eso deja dos escapes que **medi**:**
  `expect(deFamilia('forma')).toHaveLength(5);` -congelacion a traves de un **alias**- y
  `const TRECE = 13; expect(VALORES_RECHAZADOS).toHaveLength(TRECE);` -la magnitud a traves de
  una **constante con nombre**- pasan las dos en **verde**. **No bajo CA-12 por esto**, y el
  motivo esta en la letra: CA-12 (a) afirma una propiedad **sobre el fichero de hoy**, y hoy se
  cumple -lo verifique exhaustivamente a mano: las cinco sentencias `expect(` que dependen de la
  tabla (`:225`, `:248`, `:277`, `:395`, `:442`) son **todas** `toBeGreaterThan(0)`-; y CA-12
  (b) fija los especimenes minimos y deja el mecanismo al implementador, que los cubre y ademas
  caza cinco formas que el CA no nombra. Los dos escapes caen fuera de los tres ejes que la
  letra enumera -*«con que matcher, en que orden o de que lado del `expect(`»*-. Queda anotado
  como **`F-SPEC-055-4`**: si alguna vez se escribe una guardia asi para otra tabla, el nombre
  literal como unico ancla es su punto ciego conocido.
- **O3 (ajeno, ya anotado por el arquitecto) — el literal caduco `/_not-found`** sigue vivo en
  `docs/roadmap.md:153`. No es de esta spec y no se toca. Anecdota de esta vuelta que lo
  refuerza: mi Escena 1 nombro `/_not-found` **y** `/ayuda` en la **misma** corrida, asi que la
  variabilidad que §Problema describe queda medida otra vez.
- **O4 (aseo, para el documentalista) — el §Resumen de este ledger sigue diciendo «Espera al
  verificador»** y «113 ficheros, 1767 casos». Ya no es cierto: hay veredicto, son **1779**
  casos y la spec pasa a `hecho`. No es mi columna ni mi seccion; lo dejo apuntado para el
  cierre mecanico.

### RED (2.a vuelta) — 2026-08-24, sdd-verificador

**F1 de la primera vuelta esta cerrado, y lo cerre midiendo, no leyendo el relato.** Doce de
trece CA quedan en verde con evidencia ejecutada. Devuelvo **un solo bloqueante nuevo**, y no
esta en la guardia ni en el mensaje ni en el oraculo: esta en **CA-12**, cuyo caso es el unico
de este fichero que **no puede ponerse rojo** cuando su propia propiedad se viola. Lo demostre
por mutacion. La reparacion vuelve a ser una linea de test y una clausula de la letra.

**No herede ninguna casilla.** Volvi a apretar las dos que el encargo señalaba y las dos
aguantan: F1 (CA-5) y el oraculo (CA-8). Y volvi a mirar las once restantes desde cero.

Lo que ejecute, y no lo que se me conto:

- `npx vitest run` -> **113 ficheros, 1767 casos, todos verdes**, 183 s, exit 0.
- `npx tsc --noEmit` -> exit 0. `npx eslint . --max-warnings=0` -> exit 0.
- `npm run version:check` -> `La version sube de 0.4.0 a 0.4.1`, exit 0, con el arbol limpio,
  que es la condicion que SPEC-049 le puso a este gate.
- **Las tres escenas de build**, esta vez con `npm run build` y no con `npx next build`
  (§Verificacion de gate). La envenenada usa el `.env.production.local` real de esta maquina
  —`APP_BASE_URL="[SENSITIVE]"`, cubierto por `.gitignore:12`— y **no se toco**.
- **Prueba fuerte de F1**: el `.env.example` de la rama de SPEC-052 puesto en su sitio y la
  bateria entera corrida encima; restaurado byte a byte. Detalle en la fila CA-5.
- **Tres mutaciones**, todas restauradas y comprobadas con `git hash-object` +
  `git status --porcelain` vacio: el defecto de `origin/main` reinyectado en `app-url.ts`
  (45 rojos, incluida la mitad del DESPUES de CA-8); el test anterior al arreglo corrido
  contra el `.env.example` de SPEC-052 (rojo, como F1 midio); y la congelacion de la tabla
  inyectada en una copia del fichero de test (**verde** — ver F1 de abajo).
- Comparacion contra `origin/main` de los nueve ficheros ajenos sensibles: **los nueve
  identicos**. Diff de la rama: **ocho ficheros**, los ocho del conjunto cerrado, cero `_qa/`.

### Findings

**F1 (bloqueante) — la guardia de CA-12 no puede ver la congelacion que dice vigilar; medido
por mutacion.** `tests/app-base-url.test.ts:471-483` recoge las aserciones sospechosas con

    const congelantes = src.match(/(?:toHaveLength\(|toEqual\(\[)[^\n]*/g) ?? [];
    for (const uso of congelantes) expect(uso).not.toContain(NOMBRE_DE_LA_TABLA);

El patron empieza **en el matcher**, asi que lo que examina es solo el texto **posterior** a
`toHaveLength(` / `toEqual([`. En una congelacion real el nombre de la tabla va **antes**, del
lado del `expect(...)`. Inyectadas en una copia del fichero las dos formas naturales de
congelarla —

    expect(VALORES_RECHAZADOS).toHaveLength(13);
    expect(VALORES_RECHAZADOS.length).toBe(13);

— el caso de CA-12 **sigue verde** (`npx vitest run tests/zz-ca12.test.ts -t "CA-12"` ->
`1 passed`). Lo unico que la guardia cazaria es `toHaveLength(VALORES_RECHAZADOS.length)`, que
es la forma **dinamica**, justo la que no hay que prohibir. La copia se borro; el arbol quedo
limpio.

Por que esto es RED y no una salvedad que se acepta:

1. **CA-12 no es una propiedad de hoy: es una guardia de mañana, y su unico entregable es esa
   guardia.** Que la tabla no este congelada hoy lo verifique yo a mano (fila CA-12), pero eso
   no es lo que el CA compra. Lo que compra es que la proxima persona que añada una fila no
   pueda congelarla en silencio — y hoy puede.
2. **Es exactamente `F-SPEC-048-2` un piso mas arriba**, que es la familia a la que el propio
   CA-12 se acoge por escrito: una guardia que da por vigilado algo que no vigila. Y es la
   misma patologia que el ledger ya tiene abierta en `F-SPEC-055-3` —«miden un proxy en vez de
   la propiedad»—, solo que aqui la guardia es **de esta spec**, no de una vecina.
3. **El liston se lo pone la spec a si misma.** Todos los demas centinelas de este fichero se
   ponen rojos cuando su propiedad falla —lo comprobe: CA-2, CA-3, CA-8 y CA-11 con el defecto
   reinyectado; los de CA-5 y CA-9 fallan con lista vacia— y D-6 lo dice con todas las letras:
   *«no afirma que un valor es malo: lo demuestra»*. CA-12 es la unica casilla que se queda
   afirmando.
4. **La reparacion es barata y no toca la guardia de produccion**: que el recorrido examine la
   **sentencia** de aserto entera (del `expect(` al `;`) en vez del rabo del matcher. Y la
   letra de CA-12 tiene que decir *sentencia*, porque hoy dice literalmente «que la constante
   no aparece **dentro de** un `toHaveLength(`», que es lo que se implemento y por eso el
   defecto es de la letra otra vez. Lo decide el arquitecto; yo no reparo.

### Salvedades que NO bloquean, y de quien son

**O1 (arquitecto, y es el reverso de F1) — la letra de CA-12 prescribe el test ciego.** Igual
que O1 de la primera vuelta con CA-5: el implementador cumplio la instruccion al pie de la
letra y la instruccion era la que estaba mal. Hay que reescribir el *Test:* de CA-12 antes de
volver a implementarlo, o se implementara ciego otra vez.

**O2 (informativo) — `npm run build` envenenado nombra `/admin` o `/register`, no
`/_not-found`.** La spec (§Problema, eslabon 5) y las escenas dicen `/_not-found`. Sale la ruta
del worker que estalla primero y son 15 workers, asi que el nombre varia entre pasadas: lo vi
con `/admin` y con `/register` en dos corridas de la misma escena. No cambia nada del
diagnostico —el `[cause]` es el mismo— pero quien compare la salida con la spec al pie de la
letra se va a extrañar.

**O3 (informativo) — el diagnostico bueno viaja dentro de `[cause]`.** Confirmado tambien con
`npm run build`: la primera linea es `Error: Failed to collect configuration for /admin` y el
mensaje de `appBaseUrl()` va en la segunda. Es de Next y no de esta spec.

### Lo que si quedo demostrado, y merece constar

- **F1 de la primera vuelta esta cerrado de verdad.** No basta con que el caso haya cambiado:
  `.env.example` **no se lee en ningun punto** del fichero de test (las siete llamadas a
  `fuente()` enumeradas en la fila CA-5), y con el `.env.example` **real** de la rama de
  SPEC-052 dentro del arbol la bateria da **65/65**. Con el fichero de test de `26aeae9` —el
  anterior al arreglo— ese mismo contenido la **tumbaba**. La mina estaba y ya no esta.
- **CA-8 no es un verde de vacio, y lo volvi a medir yo.** Con el defecto reinyectado, la
  mitad del DESPUES se pone **roja**. La mitad del ANTES distingue las dos direcciones
  calculandolas: acuse para la cuenta que no existe, `Invalid URL` tras `update` e `insert`
  para la que si. Un test de seguridad que se puede poner rojo protege algo.
- **El contrato con SPEC-052 CA-14 esta intacto**, leido en las dos ramas: literal en
  `app-url.ts:87`, firma en `:81`, y las dos unicas aserciones de runtime de SPEC-052
  (`:712`, `:716`) siguen satisfechas.
- **El liston no se paso de frenada**: `APP_BASE_URL=http://localhost:3200 npm run build`
  termina en **exit 0** con sus 21 paginas y 24 rutas. `http` y `localhost` siguen valiendo.
- **La severidad, ahora que esta escrita, esta bien contada.** Los dos apoyos se sostienen y
  los verifique por separado: (1) el razonamiento —reinyecte el defecto y el build envenenado
  **cae con exit 1**, luego un despliegue de produccion con la clave envenenada no llega a
  existir—; y (2) la medida contra produccion, que **repeti yo**:
  `curl -s https://stockeiro.tremen.dev/login` devuelve
  `<meta property="og:url" content="https://stockeiro.tremen.dev"/>`, y ese `og:url` sale de
  `metadataBase` <- `appBaseUrl()` (`src/app/layout.tsx:67`), luego la clave viva es valida.
  El texto de §*La otra mitad de la frase* no exagera —dice «victimas potenciales, no
  victimas» y «no hay incidente que investigar»— ni rebaja lo que se arregla: mantiene que el
  200/500 es real en cuanto la clave se envenena, que es un `vercel env pull` de distancia.
  Lo doy por bien contado.
- **`FOUNDATION.md` dice algo cierto, y el resto de artefactos lo respetan.** El corolario es
  verificable y lo verifique: `ci.yml:148` y `server.mjs:69` son valores que un proceso
  consume, `.env.example` no lo lee ningun proceso, y **ninguna rama en vuelo** (SPEC-049,
  SPEC-052, SPEC-053, SPEC-054) toca `ci.yml` ni `server.mjs`, con lo que las dos lecturas que
  CA-5 conserva cumplen la regla que el corolario fija. No lo cuento como hallazgo: el humano
  autorizo que viaje en esta rama el 2026-08-24.

### Verificacion de gate (2.a vuelta, fuera de la suite)

| Escena | Que se espera | Salida |
|---|---|---|
| `npm run build` con `APP_BASE_URL='[SENSITIVE]'` (el `.env.production.local` real), **antes** del arreglo — medido reinyectando `origin/main:src/lib/config/app-url.ts` y restaurado despues | `Invalid URL` sin nombrar clave ni fichero | `Error: Failed to collect configuration for /register` · `[cause]: TypeError: Invalid URL` — **exit 1**. Ni `APP_BASE_URL`, ni el valor, ni fichero alguno. |
| `npm run build` con `APP_BASE_URL='[SENSITIVE]'`, **despues** | falla nombrando la clave, el valor, la forma y `.env.production.local`, con la pista de `vercel env pull` | `Error: Failed to collect configuration for /admin` · `[cause]: Error: APP_BASE_URL no es un origen absoluto usable: «[SENSITIVE]» — no es una URL absoluta, \`new URL()\` la rechaza. Se espera un origen \`http\` o \`https\` sin ruta, query, fragmento ni credenciales; por ejemplo http://localhost:3200 o https://stockeiro.tremen.dev. Donde mirar: en un build de produccion \`.env.production.local\` manda sobre \`.env\`, asi que el valor puede venir de ahi aunque \`.env\` ni siquiera declare la clave. Pista: «[SENSITIVE]» es lo que escribe \`vercel env pull\` cuando la variable esta marcada como Sensitive en Vercel: la CLI no revela el valor y deja ese marcador en \`.env.production.local\`. Escribe ahi el origen real, o desmarca la variable en Vercel.` — **exit 1**. Las cuatro partes de CA-6 y la pista de CA-7. |
| `APP_BASE_URL=http://localhost:3200 npm run build` | verde | `✓ Compiled successfully` · `✓ Generating static pages using 15 workers (21/21) in 700ms` · tabla de 24 rutas — **exit 0**. |
| `npx vitest run` / `npx tsc --noEmit` / `npx eslint . --max-warnings=0` | verdes | `Test Files 113 passed (113)` · `Tests 1767 passed (1767)`, 183.50 s — **exit 0**. Typecheck y lint, **exit 0** y sin salida. |
| `npm run version:check` | la version sube y el arbol esta limpio (SPEC-049) | `[check-version-bump] Base: origin/main.` · `[check-version-bump] La version sube de 0.4.0 a 0.4.1.` — **exit 0**. `package.json` y `package-lock.json` los dos en `0.4.1` (ADR-033). |
| `git diff --name-only origin/main..HEAD` | el conjunto cerrado de **ocho** ficheros, cero `_qa/` | `FOUNDATION.md`, la spec, este ledger, `package-lock.json`, `package.json`, `src/app/layout.tsx`, `src/lib/config/app-url.ts`, `tests/app-base-url.test.ts` — **8 ficheros**, cero `_qa/`. |
| Ficheros ajenos, contra `origin/main` | identicos | `tests/spec-031-frontera.test.ts` (`toHaveLength(11)` en `:149`), `tests/tarjeta-frontera.test.ts`, `tests/tarjeta-guardias-ampliadas.test.ts`, `src/lib/auth/password-reset.ts`, `.env.example`, `docs/despliegue.md`, `.github/workflows/ci.yml`, `tests/e2e/server.mjs`, `tests/ci-workflow.test.ts` — **los nueve identicos**. |
| Mutacion 1 (guardia) | reinyectar el defecto pone roja la mitad del DESPUES de CA-8 | `npx vitest run tests/app-base-url.test.ts` con `origin/main:src/lib/config/app-url.ts` -> **45 rojos / 20 verdes**, incluido `CA-8 › el DESPUES…`. Restaurado: `git hash-object` = `29fcd0e53f918067fca2461477b774e6fa104e0e`, `git status --porcelain` vacio. |
| Mutacion 2 (F1) | el `.env.example` de SPEC-052 ya no tumba nada, y antes si | Con `APP_BASE_URL="http://localhost:3000"` (hash `774d8572…`): bateria **65/65 verde**. Con el test de `26aeae9` y ese mismo fichero: **1 rojo** — `.env.example declara «http://localhost:3000», que no es https`. `.env.example` restaurado: hash `7b86eff3796ce4747cc8e0a6370113f102a54255`, `git status --porcelain` vacio. |
| Mutacion 3 (CA-12) | congelar la tabla tiene que poner **rojo** el caso de CA-12 | Inyectados `expect(VALORES_RECHAZADOS).toHaveLength(13);` y `expect(VALORES_RECHAZADOS.length).toBe(13);` en una copia del fichero: **`1 passed`, verde**. La guardia no lo ve. **Es F1 de esta vuelta.** Copia borrada, arbol limpio. |
| `curl -s https://stockeiro.tremen.dev/login` | comprobar el segundo apoyo de la latencia | `<meta property="og:url" content="https://stockeiro.tremen.dev"/>` — la `APP_BASE_URL` viva de produccion es un origen valido. |

### Primera vuelta (historico)


#### RED (1.a vuelta) — 2026-08-24, sdd-verificador

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

#### Findings (1.a vuelta)

**F1 (bloqueante, CERRADO en la 2.a vuelta) — CA-5 planta una mina roja bajo SPEC-052, y en el fichero que esta spec
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

#### Salvedades de la 1.a vuelta

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

#### Lo que quedó demostrado en la 1.a vuelta

- **CA-8 no es un verde de vacío.** Es lo que más apreté. El «antes» se ejecuta con un doble
  de `db` fiel al camino real de `password-reset.ts:79-107`, y la asimetría 200/500 se
  **calcula** comparando dos listas de accesos. Con el defecto reinyectado, la mitad del
  DESPUÉS se pone **roja**. Un test de seguridad que se puede poner rojo protege algo.
- **El contrato con SPEC-052 CA-14 está intacto**, leído en el fuente de las dos ramas: el
  literal `APP_BASE_URL no definida` en `app-url.ts:87` y la firma `appBaseUrl(env)` en `:81`.
- **El listón de «válido» no se pasó de frenada**: `http` y `localhost` siguen valiendo, y no
  de palabra — un `next build` completo con `http://localhost:3200` termina en **verde**.

#### Verificación de gate (1.a vuelta)

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

Levantado por el verificador en la 3.a vuelta (2026-08-24), sin bajar ningun CA:

- **`F-SPEC-055-4` — una guardia de texto que ancla en el NOMBRE literal de la tabla tiene dos
  puntos ciegos conocidos, y estan medidos.** El detector de CA-12
  (`asertosQueCongelan`, `tests/app-base-url.test.ts:620`) exige que `VALORES_RECHAZADOS`
  aparezca **literalmente dentro del `expect(`**. Por eso deja pasar en verde dos congelaciones
  reales: a traves de un **alias** —`expect(deFamilia('forma')).toHaveLength(5);`— y a traves de
  una **constante con nombre** —`const TRECE = 13; expect(VALORES_RECHAZADOS).toHaveLength(TRECE);`—.
  **Hoy no hay ninguna de las dos en el fichero** (verificado a mano: las cinco sentencias
  `expect(` que dependen de la tabla son todas `toBeGreaterThan(0)`), y las dos caen fuera de
  los tres ejes que CA-12 enumera, asi que **el CA se cumple**. Se anota para que quien escriba
  la proxima guardia de esta familia sepa donde esta el borde: el ancla literal es barata y
  suficiente para un fichero, y no generaliza. Destino: **EPIC-INFRA**, en el mismo lote que
  `F-SPEC-048-2` y `F-SPEC-055-3` —son la misma familia: guardias que miden un proxy del
  criterio en vez del criterio—.

  **Triaje del arquitecto (2026-08-25), y un matiz sobre dónde cae el escape.** Suscribo el
  destino y el no-bloqueo: los dos escapes son del **mecanismo**, no de la letra, y CA-12 (a)
  afirma una propiedad **sobre el fichero de hoy**, que se cumple y está verificada a mano.
  El matiz es de encuadre, y conviene que quede escrito porque cambia a quién apunta el
  seguimiento: **los dos escapes caen DENTRO del discriminante de la letra, no fuera.** El
  discriminante es uno solo —*si añadir una fila obligara a actualizar ese aserto, ese aserto
  congela*— y `expect(deFamilia('forma')).toHaveLength(5);` lo cumple de lleno: añadir una fila
  de esa familia obliga a tocarlo. Lo que queda fuera son los **tres ejes ilustrativos** que la
  letra menciona a continuación (*«con qué matcher, en qué orden o de qué lado del `expect(`»*),
  que están escritos como **concesión** —da igual cuál de ellos— y no como definición. Es decir:
  la propiedad ya cubre el escape; el detector no. Ahí es donde va el trabajo futuro.

  **Y de ahí sale la única lección generalizable, que dejo planteada y NO aplico.** Una
  cláusula que enumera ejes *para ampliar* se lee, a la hora de implementar, como el **alcance**
  de lo que hay que cubrir: el detector acabó anclado exactamente en esos tres ejes y ciego a lo
  de al lado. Es la misma mecánica que **D-8** describe —la forma nombrada desplaza a la
  propiedad—, entrando esta vez por una cláusula que pretendía justo lo contrario. **No toco
  `FOUNDATION.md` ni D-8 por esto, y por tres motivos:** (i) es **un** dato, y los dos corolarios
  vigentes se fijaron tras costar rondas rojas —éste no ha costado ninguna: el verificador lo
  midió y CA-12 pasó—; (ii) la spec está en `hecho` y `FOUNDATION.md` es uno de los ocho ficheros
  que el verificador ya midió con su veredicto puesto, así que retocarlo ahora ensucia una
  entrega cerrada; y (iii) un cambio de constitución no lo aprueba su autor. Si el humano quiere
  recogerlo, la forma mínima es un cuarto punto del segundo corolario: *ilustrar con ejemplos sí,
  pero marcados como ejemplos —lo que fija el alcance es el discriminante, y sólo él*. Queda como
  parte de `F-SPEC-055-4` para el lote de **EPIC-INFRA**.

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

### Vuelta del 2.º RED — qué cambió la spec y qué toca al implementador (2026-08-24, sdd-arquitecto)

El verificador devolvió **RED** por segunda vez, con **un solo bloqueante (F1) y ningún defecto
de código ni de test**. Y por segunda vez el defecto era **de la letra**, así que esta pasada
mía **no toca ni código ni tests**: sólo la spec, este ledger y `FOUNDATION.md`. El humano
decidió el **2026-08-24** que **se arregla** — no se acepta como salvedad.

**El diagnóstico, con las palabras del verificador y no con las mías.** CA-12 **no es una
propiedad de hoy —ésa se cumple, la verificó a mano— sino una guardia de mañana, y su único
entregable es esa guardia.** Una guardia contra listas congeladas que no puede ver una lista
congelada es `F-SPEC-048-2` un piso más arriba, y el listón se lo pone la spec a sí misma:
todos los demás centinelas de este fichero **sí** se ponen rojos cuando su propiedad falla.
Coincido entero, y **acepto O1**: la letra prescribía el test ciego.

#### Lo que cambió en la spec, para que se pueda releer sin diff

- **CA-12, reescrito de arriba abajo, con criterio distinto.** Ya no describe una forma
  prohibida: enuncia la propiedad con un discriminante que no menciona sintaxis —**«si añadir
  una fila obligara a actualizar ese aserto, ese aserto congela»**—, **prohíbe expresamente
  enumerar matchers** (y dice por qué: la enumeración caduca igual escrita en la spec que
  escrita en el test), deja **el mecanismo al implementador**, y exige la **prueba de eficacia
  por mutación en los dos sentidos** (ADR-026 §7) con especímenes mínimos nombrados: **tres que
  la guardia debe cazar** —los dos que el verificador inyectó, más uno de composición— y **dos
  que NO debe cazar** —la forma derivada y el suelo de CA-11—, más el fuente real, que debe
  salir limpio.
- **D-8 nuevo**, con la lección general y la **tabla de los cuatro casos** (SPEC-054 CA-15 y
  CA-16, SPEC-055 CA-5 y CA-12): cada uno nombró una forma y quería una propiedad.
- **`FOUNDATION.md`, segundo corolario.** Subo D-8 a la constitución, apoyándome en el
  precedente que el humano autorizó el 2026-08-24 para el corolario de D-7. **Criterio para
  subirlo:** cuatro casos, dos specs, dos épicas, una ronda roja cada uno, y encaja como
  generalización del corolario que ya vive ahí — aquél dice que **el test** fija una propiedad
  y no un estado; éste dice que **el CA** pide una propiedad y no una forma. Es la misma
  doctrina aplicada al autor en vez de al implementador. Queda marcado en §Notas pto. 8 como lo
  primero que el humano debe mirar, y es lo único de este lote que sale del territorio de la
  spec: si prefiere que espere a su propio gate, se saca y CA-12 se sostiene con D-8 dentro.
- **O2 corregido en §Problema** (párrafo de cabecera y eslabón 5). **No se sustituyó un literal
  por otro**: se escribe que **la ruta es variable** —Next nombra la del worker que estalla
  primero, de quince, y se midieron `/register` y `/admin` en dos corridas de la misma escena—
  y que la comparación se hace contra el diagnóstico, no contra la ruta. **O3** entra en el
  mismo sitio: el diagnóstico bueno viaja dentro de **`[cause]`, en la segunda línea**.
- **§Entidades**, la tabla de ficheros y §Notas pto. 7/8, puestas al día.

**Lo que NO cambia: el conjunto cerrado sigue siendo de ocho ficheros.** `FOUNDATION.md` ya
estaba dentro; no es código de aplicación, así que **la versión sigue en `0.4.1`**. Ni el
estado de la spec, ni ninguna columna de esta matriz, ni ningún otro CA.

**Deuda menor que dejo anotada y NO toco, porque no son míos:** el literal caduco
`/_not-found` sobrevive en `docs/roadmap.md:153` (territorio de sdd-producto) y en
`docs/epicas/EPIC-007-…/SPEC-054-….ledger.md:387, :397, :749` (territorio de SPEC-054).
Ninguno de los dos afecta a ningún CA de esta spec; quien gobierne esos documentos decide.

#### Lo que tiene que cambiar el implementador, y es todo lo que tiene que cambiar

En `tests/app-base-url.test.ts`, en el bloque de **CA-12** y **sólo ahí**:

1. **Extraer el detector a una función pura de texto**, del tipo
   `congelaLaTabla(fragmento: string): boolean` (o el nombre que prefiera), para que se le
   pueda pasar **un espécimen escrito en el test** y no sólo el fuente del fichero. Hoy el
   recorrido está incrustado en el `it` y por eso no hay forma de probarlo.
2. **Arreglar la ceguera.** La reparación que el verificador apunta —y que es una sugerencia,
   no un mandato: el mecanismo lo eliges tú— es que el recorrido examine **la sentencia de
   aserto entera, del `expect(` al `;`**, en vez del rabo del matcher. El patrón de hoy
   (`/(?:toHaveLength\(|toEqual\(\[)[^\n]*/g`) empieza **en el matcher**, así que sólo ve el
   texto **posterior** a él, y en una congelación real el nombre de la tabla va **antes**.
   **Cualquier mecanismo vale si pasa el punto 3 en los dos sentidos.**
3. **Añadir la prueba de eficacia, en los dos sentidos, con especímenes escritos en el test y
   sin tocar el disco** (nada de copias de fichero: eso es del verificador, no de la suite):
   - **debe cazar**: `expect(VALORES_RECHAZADOS).toHaveLength(13);`,
     `expect(VALORES_RECHAZADOS.length).toBe(13);` y una de composición, del tipo
     `expect(VALORES_RECHAZADOS.map((f) => f.nombre)).toEqual(['…']);`
   - **NO debe cazar**: `expect(algo).toHaveLength(VALORES_RECHAZADOS.length);` y
     `expect(VALORES_RECHAZADOS.length).toBeGreaterThan(0);`
   - **el fuente real** del fichero: **limpio**.
   Los dos primeros de la lista de «debe cazar» son literalmente los que el verificador inyectó
   el 2026-08-24 y que la guardia dejó pasar en verde: **son la regresión de F1**, y deben
   quedar escritos como tales, con la fecha al lado.
4. **Conservar los centinelas y añadir el que falta:** el de que la constante existe con ese
   nombre en el fuente **se queda**; se añade que **el conjunto de especímenes no está vacío y
   tiene las dos direcciones**. Si falta cualquiera, el caso **falla** en vez de pasar de vacío.
5. **Dejar escrito al lado el porqué**, citando **F1 de la 2.ª vuelta** y **D-8**: que la letra
   vieja pedía una forma, que por eso la guardia era ciega, y que la mitad de «NO debe cazar»
   existe para que nadie repare esto cazando cualquier mención de la constante —eso pondría
   roja a CA-11 y acabaría con la guardia aflojada. Sin esa nota, el próximo lo «simplifica».
6. **No tocar nada más.** Ni `src/lib/config/app-url.ts` —la guardia de producción pasó el gate
   entera—, ni los otros doce CA, ni `.env.example`, ni `docs/despliegue.md`, ni
   `tests/ci-workflow.test.ts`, ni `tests/spec-031-frontera.test.ts`, ni las guardias de
   SPEC-051, ni la versión: **`0.4.1` se queda**, este cambio no toca `src/`.

**Qué hay que re-verificar y qué no.** El cambio está **contenido en el bloque de CA-12**, que
no comparte estado con ningún otro: no toca la tabla `VALORES_RECHAZADOS`, ni `appBaseUrlAnterior`,
ni el doble de `db`, ni el fuente de `src/`. **Ningún CA que ya estaba ✅ necesita re-verificarse
por este cambio** — pero sí hay dos consecuencias mecánicas que el verificador debe mirar:
**(a) CA-11**, porque uno de los especímenes de «NO debe cazar» es literalmente su centinela y
la reparación mal hecha lo tumbaría; y **(b)** el recuento del fichero (**65 casos hoy**) y el
de la suite (**1767**) suben, porque esto **añade** casos en vez de sustituir uno. Esa es la
única diferencia con la vuelta anterior, donde los totales no se movían.

### Respuesta al 2.º RED — qué hizo el implementador (2026-08-24, sdd-implementador)

**Un solo fichero y un solo bloque, como pedía la vuelta: `tests/app-base-url.test.ts`, CA-12.**
Ni `src/`, ni los otros doce CA, ni `.env.example`, ni `docs/despliegue.md`, ni ninguna guardia
ajena. La versión sigue en **0.4.1** porque esto no toca `src/`.

**El mecanismo que elegí, y por qué ése.** El detector sale del `it` y pasa a ser función pura
de texto (`asertosQueCongelan(codigo)`, con `congelaLaTabla(fragmento)` encima), así que se le
puede dar un espécimen escrito en el test y no sólo el fuente. Recorta **la sentencia entera,
del `expect(` a su `;`** —con paréntesis balanceados y atravesando saltos de línea—, que es la
sugerencia del verificador; el patrón viejo empezaba en el matcher y por eso no veía el lado
del `expect(`. Sobre esa sentencia el criterio **no enumera formas prohibidas** (D-8): congela
cuando se dan **las tres** a la vez —lo **observado** depende de la tabla, el matcher compara
**exacto**, y lo **esperado** es una magnitud o una lista **escrita a mano** en vez de derivada
de la propia tabla—. Si falta cualquiera de las tres, añadir una fila no obliga a tocar ese
aserto, que es el discriminante que la spec pide.

**La única lista que hay es la de matchers TOLERANTES, y es deliberadamente de lo permitido**
(`toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toContain`, `toContainEqual`): un matcher que no
esté ahí cuenta como exacto, así que un matcher nuevo hace que la guardia falle hacia el
**rojo** —visible— y nunca hacia la ceguera, que es exactamente el defecto de `F1`. Un techo
(`toBeLessThan(13)`) **sí** se caza, y a propósito: un techo sobre el tamaño también congela la
tabla en la dirección en la que crece.

**Dos piezas de fontanería que no son adorno.** (1) `soloCodigo()` quita comentarios, **vacía**
las cadenas y colapsa las expresiones regulares. Sin vaciar cadenas, los propios especímenes
—que llevan el nombre de la tabla dentro— se contarían como asertos del fichero; sin tratar las
regex, `.replace(/^['"`]|['"`]$/g, '')` de `valoresDeCi()` descarrila el analizador y lo deja
ciego de ahí al final del fichero, o sea el mismo defecto por otra puerta. (2) La prueba de
mutación se hace en **dos modos** por espécimen: el detector suelto **y el espécimen inyectado
en el fuente real, en memoria**. El segundo modo es el que demuestra que el recorrido llega
entero hasta el final del fichero: si `soloCodigo()` se descarrilara a media altura, los
especímenes inyectados dejarían de verse y esos casos se pondrían rojos.

**Las dos direcciones, medidas y no afirmadas.** Aparte de los 10 casos de mutación que ya
viven en la suite, aflojé la guardia a mano dos veces y restauré el fichero al hash
`6f5704a3a19b0cf60e9e64dd1d137144019fcacb` las dos veces (comprobado con `git hash-object`, y
`git status --porcelain` sin residuos):

1. **Congelación real inyectada a media altura** —`expect(VALORES_RECHAZADOS).toHaveLength(13);`
   metido dentro del centinela de CA-6, en la línea 396, lejos del final—: el bloque de CA-12 se
   pone **rojo, 6 de 13 casos**, empezando por «el fuente real no congela la tabla». Es
   literalmente la mutación que la guardia anterior dejaba pasar en verde.
2. **La reparación barata**, o sea quitar los dos filtros y cazar cualquier mención de la tabla:
   **rojo, 7 de 13**, y entre ellos «el detector, sobre *un suelo sin techo — el centinela de
   CA-11*». Esa es la mitad que el CA exige y la razón de que exista: sin ella, esta reparación
   habría pasado y CA-11 se habría caído después.

**Recuentos, que suben como el arquitecto anticipó.** `tests/app-base-url.test.ts`: **65 → 77**
casos (el caso ciego se sustituye por 13). Suite completa: **1767 → 1779**, `113/113` ficheros
verdes. `npm run typecheck` y `npm run lint` (`--max-warnings=0`) limpios. **CA-11 verde**, sus
14 casos, sin tocar una línea. El diff de la rama sigue dentro del conjunto cerrado de ocho
ficheros y **cero `_qa/`**: esta spec no genera evidencia visual.

**Lo que NO toqué y dejo señalado, porque no es mío.** La columna *Qué exige* de la fila CA-12
de la matriz sigue diciendo la letra **vieja** —*«ni `toHaveLength(` ni `toEqual([` sobre
ella»*—, que es justo la enumeración de formas que **D-8** prohíbe. No es una columna de las
mías y no la edito; queda para el arquitecto, que la puso al día en la spec pero no aquí.
