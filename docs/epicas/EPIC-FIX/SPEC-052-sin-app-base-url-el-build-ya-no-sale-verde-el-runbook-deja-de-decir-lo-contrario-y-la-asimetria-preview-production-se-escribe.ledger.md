---
id: SPEC-052
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-052 Sin `APP_BASE_URL` el build ya no sale verde: el runbook deja de decir lo contrario y la asimetría Preview/Production se escribe

## Resumen
- Fase: **en-revision** — escrita por sdd-arquitecto el 2026-08-23, **arbitrada por el
  humano (Alberto Fojo) el 2026-08-24** e incorporado el arbitraje al texto, **aprobada** ese
  mismo día e **implementada** por sdd-implementador el 2026-08-24. La fuente de verdad del
  estado es el frontmatter de la spec; esta línea solo lo resume.
- **Arbitraje del 2026-08-24, incorporado**: Q-1 resuelta (la asimetría de Preview es
  deliberada → **D-5** + **CA-4 (b)**); Q-2 resuelta (`.env.example` a
  `http://localhost:3000` → **D-6** + **CA-17**, que además ajustó **CA-3**); **sin ADR**
  para la regla de D-1, con la condición de reapertura escrita (ver F-SPEC-052-6). Y un
  hallazgo propio al reverificar contra `3b6fc8b`: una **segunda** afirmación falsa en el
  mismo párrafo de §0, absorbida por **CA-2 (d)**.
- Rama: `ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde`
- Épica: **EPIC-FIX**, validado contra su carta y contra el precedente de SPEC-033,
  SPEC-048 y SPEC-049 (defectos de herramienta ya entregada → EPIC-FIX, no
  EPIC-INFRA).
- **Origen del defecto**: `docs/despliegue.md` §0 líneas 110-111 afirmaba que la
  ausencia de `APP_BASE_URL` era un error de tiempo de petición «así que el deploy
  sale verde igualmente». Dejó de ser cierto con **SPEC-051** (mergeada el
  2026-08-23), que añadió `metadataBase: new URL(appBaseUrl())` al export `metadata`
  del layout raíz.
- **Impacto medido**: el despliegue de **Preview del PR #58** falló en `next build`
  (*Collecting page data* → `Failed to collect configuration for /_not-found`). Todas
  las previews fallaban.
- **Arreglo de ops YA APLICADO por el humano el 2026-08-23** (no lo rehace esta spec):
  `APP_BASE_URL = https://stockeiro.tremen.dev` añadida al entorno **Preview**;
  redespliegue del PR #58 verde en **53 s**.
- **Sin cambios en `src/`**: documentación + una guardia en `tests/`. Consecuencia
  esperada y correcta: `version:check` dirá *«el diff no toca codigo de aplicacion»*.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
> Todos los casos citados viven en **`tests/entornos-de-despliegue.test.ts`** salvo donde se
> diga otra cosa. Se abrevia como **`G`** (la guardia).

| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 — frase falsa fuera, y no vuelve por copia | `docs/despliegue.md` §0 (aviso de `APP_BASE_URL` reescrito) | `G` › *CA-1: la frase falsa desaparece, y no puede volver por copia* — **3 casos**, uno por entrada de la lista cerrada `AFIRMACIONES_RETIRADAS` (frase + fecha + motivo) | | |
| CA-2 — lo que dice en su lugar (build, PR #58, log literal) **+ (d) origen real → `stockeiro.tremen.dev`** | `docs/despliegue.md` §0, bloque 🚨 del aviso | `G` › *CA-2: lo que el aviso dice en su lugar* — **4 casos**: (a) build/`metadataBase`/layout/SPEC-051 · (b) `next build` + *el despliegue no llega a existir* · (c) 2026-08-23 + PR #58 + `Failed to collect configuration for /_not-found` · (d) `stockeiro.tremen.dev` presente y `stockeiro-lemon.vercel.app` ausente | | |
| CA-3 — conserva lo que sí era cierto (falta ≠ mal); **ya NO conserva el desmentido del ejemplo** | `docs/despliegue.md` §0, bloque ⚠️ del aviso | `G` › *CA-3: el arreglo no tira lo que sí seguía siendo cierto* — **1 caso** (falla ruidosamente si falta · no detecta que esté mal · solo lo ve quien pincha). La retirada del desmentido la vigilan CA-1 (3.ª entrada) y CA-17 | | |
| CA-4 — **(a)** columna **Entornos**, vocabulario cerrado, sin celdas vacías · **(b)** el motivo escrito de las solo-Production | `docs/despliegue.md` §0: tabla con la columna **Entornos**, la leyenda del vocabulario y el bloque 🧭 | `G` › *CA-4 (a)* — **1 caso** (toda fila usa un valor de `VOCABULARIO_ENTORNOS`) · *CA-4 (b)* — **2 casos**: las cuatro claves marcadas `Production`, y §0 con el motivo y el precio aceptado literales | | |
| CA-5 — foto de `vercel env ls` del 2026-08-23 en §13, etiquetada como foto | `docs/despliegue.md` **§13.5** (nueva) | `G` › *CA-5* — **2 casos**: comando + fecha + las siete claves del inventario; y *foto fechada* / *no es una fuente de verdad viva* | | |
| CA-6 — el arreglo de ops consta como HECHO (§13 + checklist §5) | `docs/despliegue.md` §13.5, puntero en §13.2 (junto a `ALLOW_MIGRATE`) y línea `- [x]` en §5 | `G` › *CA-6* — **2 casos**: §13 con `vercel env add APP_BASE_URL preview` + valor + PR #58 + fecha; y la línea de checklist de §5 | | |
| CA-7 — Preview deja de ser opcional en §3.2 y §7 | `docs/despliegue.md` §3.2 (bloque de Preview + `env add … preview`) y §7 paso 2 | `G` › *CA-7* — **3 casos**: las **dos** frases prohibidas ausentes de todo el fichero, y §3.2 distinguiendo *Obligatorias en Preview porque el build las lee* de *solo hacen la preview más útil* | | |
| CA-8 — cruce: claves del build ⊆ claves marcadas `Preview + Production` | `G` — `clavesQueExigeElBuild()` + `entornosDeclarados()` + `incumplimientos()` | `G` › *CA-8: el runbook y el workflow concuerdan* — **1 caso** sobre el árbol real. El mensaje de cada incumplimiento se vuelca en el `expect` para que el rojo se lea sin abrir el fichero | | |
| CA-9 — centinela: conjunto derivado no vacío, un solo job, contiene `APP_BASE_URL` y `DATABASE_URL` | `G` — `jobsQueConstruyen()` localiza por **contenido** (`run` con `npm run build`), nunca por nombre | `G` › *CA-9* — **2 casos**: exactamente **un** job construye; y sus claves no están vacías y llevan `APP_BASE_URL` y `DATABASE_URL` | | |
| CA-10 — centinela: tabla parseada ≥ 11 filas, con celdas de entorno no vacías | `G` — `entornosDeclarados()` | `G` › *CA-10* — **2 casos**: **cota inferior** de 11 filas (no recuento exacto: §0 crecerá) y `APP_BASE_URL` + `MARKETSTACK_API_KEY` con celda no vacía | | |
| CA-11 — **la guardia probada en rojo** con entrada propia, en los dos sentidos | `G` — `incumplimientos()` es función pura sobre dos cadenas (D-3) | `G` › *CA-11* — **4 casos**: `Production` a secas → incumplimiento que **nombra la clave** y dice *«el build de Preview de toda PR fallará en `next build`»* · fila ausente → incumplimiento · corregido a `Preview + Production` → **ninguno** · runbook sin §0 → **no** queda en verde por vacío | | |
| CA-12 — `.env.example` admite Production/Preview/Development | `.env.example`, cabecera | `G` › *CA-12* — **2 casos**: la frase del entorno único ausente; y los tres entornos + *no todas viven en todos* + *también en Preview* + remisión a `docs/despliegue.md` | | |
| CA-13 — `.env.example`: la ausencia de `APP_BASE_URL` rompe el build | `.env.example`, bloque de `APP_BASE_URL` | `G` › *CA-13* — **2 casos**: la consecuencia **vieja** conservada literal, y la **nueva** añadida (SPEC-051 + *rompe el `next build`*) | | |
| CA-14 — `appBaseUrl()` sigue lanzando, con la nota de que es deliberado; **y su primer test propio** (premisa del CA corregida el 2026-08-24, F-SPEC-052-8) | **Nada**: `src/lib/config/app-url.ts` intacto (ver **F-SPEC-052-8**) | `G` › *CA-14* — **2 casos**: lanza con la clave ausente **y** con una cadena de espacios, en ambos con el **mensaje literal entero** (`APP_BASE_URL no definida (ver .env.example): sin ella no hay enlaces válidos.`) — el mismo del log del PR #58 —, y **la misma cadena se exige presente en el aviso de §0**, que es lo que ata documento y código; y el propio caso **contiene la nota** (SPEC-051 · D-4 · deliberado · *SPEC-052 NO revisa esta conducta*), leída de la fuente del fichero, sin `git` | | |
| CA-15 — la entrega no toca `src/` ni `drizzle/` | — (criterio sobre el delta) | **n-a — ver nota N-1** | gate | n-a |
| CA-16 — `npm run build` sin `APP_BASE_URL` falla | — (verificación empírica única) | **n-a — ver nota N-2** | gate | n-a |
| CA-17 — `.env.example`: `APP_BASE_URL` → `http://localhost:3000`, y §0 retira el desmentido; **(c) enmienda 2026-08-25 (`D-SPEC-055-1`): el valor de ejemplo pasa `appBaseUrl()`** — invocando la función, con centinela y rojo probado | `.env.example` (valor + comentario) y `docs/despliegue.md` §0 (desmentido retirado) | `G` › *CA-17: el valor de ejemplo es el de desarrollo* — **3 casos** (valor literal · `stockeiro.app` ya no es su valor · `RESEND_FROM` **conserva** el suyo) y *CA-17: §0 retira el desmentido* — **2 casos** (`stockeiro.app` fuera del aviso, pero *origen REAL del despliegue* sigue). **(c)** `G` › *CA-17 (c): el valor de ejemplo además SIRVE* — **4 casos**: `appBaseUrl()` **invocada** acepta el valor y devuelve ese origen · centinela 1 (el lector devuelve el literal congelado, no vacío) · centinela 2 (sin la clave, el lector **lanza** en vez de devolver algo) · **rojo probado** con un ejemplo con ruta, más el **control** que aísla la ruta como causa. Helpers: `valorDeAppBaseUrlEn()` y `elEjemploSirve()` | | |

| CA-18 — re-encuadre autorizado de `tests/tarjeta-guardias-ampliadas.test.ts:118-126`: **(a)** firma en vez de mención · **(b)** autoexclusión probada · **(c)** rojo en los dos sentidos · **(d)** el porqué al lado · **(e)** nada más del fichero aflojado · **(f)** sin atajo del literal | **(a)–(d)** `tests/tarjeta-guardias-ampliadas.test.ts`: `FIRMA_DE_REENCUADRE` (6 marcas), `EXCLUIDOS_DE_LA_DETECCION` (1 elemento, con motivo), `cuerposDeCasos()` **nuevo** —`casos()` NO se toca—, `llevaFirmaDeReencuadre(ruta, fuente)` pura, y el porqué de 40 líneas junto a la comparación. **`PROPIOS` retirado**, con su motivo escrito ahí mismo. **(e)–(f)** `tests/entornos-de-despliegue.test.ts` | **(a)** `tarjeta-guardias-ampliadas` › *los ficheros de tests/ re-encuadrados bajo la autorización de esta spec son esos dos* — **1 caso** · **(b)** *la exclusión de este fichero es NECESARIA, y es exactamente una* — **1 caso**, las dos mitades · **(c)** *la detección se prueba en rojo: firma completa sí, mención en prosa NO* (**3 sentidos**: firma→`true`, cita→`false`, firma incompleta→`false`) y *un TERCER fichero con firma rompería la igualdad* — **2 casos** · **(d)** el porqué es prosa, se verifica leyéndolo · **(e)** `G` › *CA-18 (e)* — **3 casos** (nada apagado · los cuatro bloques en pie · solo cambió el caso nombrado) · **(f)** `G` › *CA-18 (f)* — **2 casos** (barrido de `tests/**/*.ts` + centinela de las 6 formas y 3 inocentes) | | |

> **CA-18 lo añadió sdd-arquitecto el 2026-08-24**, tras la escalada de `F-SPEC-052-7`.
> Las columnas *Implementado* y *Test* las rellena sdd-implementador; *Verif.* y *Estado*,
> sdd-verificador. El arquitecto no las toca.

**Estado de la suite tras la entrega:** `tests/entornos-de-despliegue.test.ts` → **47/47 verde**;
`tests/tarjeta-guardias-ampliadas.test.ts` (re-encuadrada) → **15/15 verde**. `npm run typecheck`
y `npm run lint` limpios. **Suite completa: 1829/1829 en verde, 114/114 ficheros**, sobre la
base vigente `497eccf` (con SPEC-053, SPEC-054 y SPEC-055 ya dentro).

> Antes del re-encuadre de CA-18 la suite estaba en **1702/1703**, con el único rojo de
> `F-SPEC-052-7` — que no era un defecto de esta entrega sino una guardia ajena caducada. Con
> CA-18 aplicado, ese rojo **desaparece por arreglo, no por silencio**: el conjunto ahora se
> cierra sobre la firma de un re-encuadre y no sobre la mención, y sigue mordiendo ante un
> tercero de verdad (demostrado abajo, en el cierre de `F-SPEC-052-7`). Los **9 casos nuevos**
> —5 en el fichero re-encuadrado, 5 en el propio, menos el que se sustituye— son las seis
> partes de CA-18.

### El rojo de nacimiento de la guardia (CA-11 y ADR-031)

La guardia se escribió **antes** de tocar ni una línea de `docs/despliegue.md` o `.env.example`,
y se ejecutó contra el árbol sin arreglar. Salida literal de esa primera pasada:

```
 ❯ tests/entornos-de-despliegue.test.ts (38 tests | 24 failed) 161ms
   × CA-10 … la tabla parseada tiene al menos once filas
     → expected 0 to be greater than or equal to 11
   × CA-8 … el runbook y el workflow concuerdan
     → APP_BASE_URL: el build la exige —está en el bloque `env` del job de CI que ejecuta
       `npm run build`— pero no aparece en la tabla de §0 de `docs/despliegue.md`. Tiene que
       decir «Preview + Production»: si no está en el entorno Preview, el build de Preview de
       toda PR fallará en `next build` y la PR se quedará sin preview, como pasó el 2026-08-23
       en el PR #58.
       [+ AUTH_SECRET, AUTH_TRUST_HOST y DATABASE_URL con el mismo mensaje]
     → expected [ …(4) ] to deeply equal []
   × CA-1 … no vuelve a aparecer: «así que el deploy sale verde igualmente»
   × CA-2 (a)(b)(c)(d) … expected '⚠️ APP_BASE_URL debe ser el origen REAL…' to contain 'SPEC-051'
   × CA-4 (b) … falta el motivo de la asimetría
   × CA-5 … falta el comando que produjo la foto: to contain 'vercel env ls'
   × CA-6 … to contain 'vercel env add APP_BASE_URL preview'
   × CA-7 … not to contain 'repite para Preview si quieres previews funcionales'
   × CA-12 … not to contain 'En producción (Vercel), define estas claves en Settings → …'
   × CA-13 … to contain 'si falta o apunta mal, los enlaces no funcionan en absoluto'
   × CA-17 … to match /^APP_BASE_URL="http:\/\/localhost:3000"$/

 Test Files  1 failed (1)
      Tests  24 failed | 14 passed (38)
```

Los **14 que ya pasaban** en esa primera pasada son la otra mitad de la información, y conviene
leerlos: los **cuatro de CA-11** (la función pura ya distinguía los dos sentidos: ese es el
sentido de escribirla primero), los **dos de CA-9** (el localizador por contenido encontraba el
job desde el minuto cero), **CA-3** (la parte del párrafo que **sí era verdad** ya estaba escrita
— por eso CA-3 existe: para que el arreglo no la tirase) y **CA-14** (`appBaseUrl()` ya lanzaba,
que es justo lo que esta spec **no** cambia).

### Notas de los `n-a` (por qué no hay test, y dónde se verifica en su lugar)

- **N-1 (CA-15)** — *«esta entrega no toca `src/`»* es un criterio sobre un **delta**, no
  una propiedad del árbol: codificado como test caducaría al mergear y pasaría a estar
  vacío, que es literalmente lo que **ADR-031 / RI-03** prohíbe. Se verifica **en el
  gate**. Evidencia a pegar aquí: salida de `git diff --name-only <base>...<rama>`, con
  la base indicada.

  **Ejecutado el 2026-08-24, y RE-EJECUTADO dos veces** sobre las bases nuevas, por lo que
  se explica abajo. Base vigente: `origin/main` en **`497eccf`**. Comando y salida literal:

  ```
  $ git merge-base origin/main HEAD
  497eccf8cc288d843daa8f985c8494abf6291047

  $ git diff --name-only 497eccf...HEAD
  .env.example
  docs/despliegue.md
  docs/epicas/EPIC-FIX/SPEC-052-….ledger.md
  docs/epicas/EPIC-FIX/SPEC-052-….md
  tests/entornos-de-despliegue.test.ts
  tests/tarjeta-guardias-ampliadas.test.ts
  ```

  **Ni un fichero bajo `src/` ni bajo `drizzle/`.** El sexto —la guardia ajena— entra por
  **CA-18**, con autorización nominal del humano; los otros cinco son los de siempre.
  Consecuencia declarada, comprobada:

  ```
  $ npm run version:check
  [check-version-bump] Base: origin/main.
  [check-version-bump] El diff no toca codigo de aplicacion: no hay nada que subir.
  (exit 0)
  ```

  > 🔁 **La base se movió mientras esto se implementaba, y el gate lo cazó.** La primera
  > pasada iba sobre `3b6fc8b` y decía lo mismo en verde. Antes de cerrar se refrescó
  > `origin/main` y **habían entrado dos merges**: **SPEC-053** (PR #60, el lockfile —
  > subió la versión a **0.4.0**) y **SPEC-054** (PR #62, la interfaz en el teléfono).
  > Con la base nueva, `version:check` pasó a **rojo con exit 1**:
  >
  > ```
  > La version BAJA: 0.4.0 en la base y 0.3.4 en esta rama.
  > Suele ser un rebase mal resuelto. Bajarla no es "no subirla": afirma que este
  > artefacto es anterior al que ya esta desplegado.
  > ```
  >
  > **No era un defecto de esta entrega ni pedía subir la versión**: el delta sigue sin
  > tocar código de aplicación. Era la rama sentada sobre una base vieja. Se resolvió
  > **rebasando sobre `825046f`** —cinco commits, sin un solo conflicto: ninguno de los
  > 60 ficheros que trajeron esas dos specs coincide con los seis de esta—, `npm ci` para
  > realinear con el `package-lock.json` nuevo, y **re-ejecutando los gates enteros**. No
  > se tocó `package.json`: subir la versión aquí habría sido afirmar que esta entrega
  > toca producto, que es justo lo que CA-15 dice que no hace.
  >
  > **Y volvió a moverse acto seguido**, lo que confirma que no fue mala suerte sino el
  > régimen normal de este repositorio: al refrescar otra vez entró **SPEC-055** (PR #63,
  > `APP_BASE_URL` envenenada), versión a **0.4.1**, y el gate volvió a rojo por lo mismo.
  > Segundo rebase, ahora sobre **`497eccf`**, seis commits y de nuevo cero conflictos.
  >
  > **La lección operativa, para quien venga:** `version:check` **no se ejecuta al empezar
  > ni una sola vez al final** — se ejecuta **inmediatamente antes de entregar, con
  > `origin/main` recién traído**, y se vuelve a ejecutar si media algo entre esa pasada y
  > el cierre. El número de versión es un recurso compartido que reclama quien mergea
  > primero, y en esta entrega lo reclamaron **tres** specs seguidas.

  Eso es correcto aquí y **no** un verde vacío: `.sdd.json` vigila `src/` y `app/`, y esta
  entrega es documentación más una guardia. Ejecutado **con el árbol limpio y después de
  commitear** (SPEC-049: sobre árbol sucio el gate se abstiene y su verde no dice nada).

- **N-2 (CA-16)** — un `next build` completo por pasada de suite es inviable, y
  sustituirlo por un unitario que «afirme» el fallo sin construir sería el verde vacío
  que ADR-031 prohíbe. Verificación de **gate** (RI-03, opción 2): se ejecuta **una vez**
  y su salida literal se pega aquí. Es lo que sostiene el literal que CA-2 exige en el
  documento.

  **Ejecutado el 2026-08-24** en el worktree de la rama. `.env.local` de este árbol **no**
  define `APP_BASE_URL`, así que un `npm run build` a secas ya reproduce el escenario. Salida
  literal, recortada solo en las líneas de pila que repiten la misma ruta:

  ```
  $ npm run build
  ▲ Next.js 16.2.10 (Turbopack)
  - Environments: .env.local

    Creating an optimized production build ...
  ✓ Compiled successfully in 9.0s
    Running TypeScript ...
    Finished TypeScript in 10.8s ...
    Collecting page data using 15 workers ...
  Error: Failed to collect configuration for /_not-found
      at ignore-listed frames {
    [cause]: Error: APP_BASE_URL no definida (ver .env.example): sin ella no hay enlaces válidos.
        at <unknown> (…\.next\server\chunks\ssr\[root-of-the-server]__0gjddjt._.js:1:125)
        at module evaluation (…)
        …
        at L.layout (…\.next\server\chunks\ssr\02nl_next_dist_esm_build_templates_app-page_1w-5bym.js:1:1502)
  }

  > Build error occurred
  Error: Failed to collect page data for /_not-found
  ```

  Coincide **frase por frase** con el log de Vercel del PR #58, incluida la traza que termina
  en `L.layout` — es decir: el fallo entra por el **layout raíz**, que es exactamente lo que
  SPEC-051 tocó y lo que el aviso reescrito de §0 afirma.

  **CONTROL, para que el rojo signifique algo.** Un build rojo no prueba la causa si el árbol
  estuviera roto por otro motivo. Se repitió con **las cuatro claves del bloque `env` del job
  de CI** (las mismas que `clavesQueExigeElBuild()` deriva) y sale **verde**:

  ```
  $ DATABASE_URL=postgres://ci:ci@localhost:5432/ci \
    AUTH_SECRET=ci-not-a-real-secret-ci-not-a-real-secret \
    AUTH_TRUST_HOST=true APP_BASE_URL=http://localhost:3000 npm run build
  …
  ƒ Proxy (Middleware)
  ○  (Static)   prerendered as static content
  ƒ  (Dynamic)  server-rendered on demand
  (exit 0)
  ```

  Paso intermedio que conviene dejar escrito porque **valida D-1 empíricamente**: con
  `APP_BASE_URL` puesta pero sin `DATABASE_URL`, el build vuelve a caerse
  (`Error: DATABASE_URL no definida. Configúrala (ver .env.example).` en
  `/api/cron/refresh`). Es decir, la derivación de la guardia no es una analogía: ese bloque
  `env` **es** el conjunto mínimo que hace construir a este árbol, ni más ni menos.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
Pendiente.

## Evidencia visual
No aplica: esta spec no cambia ninguna superficie de UI. La evidencia es textual
(diffs de documentación, salida de la guardia y las dos capturas de consola de N-1/N-2).

## Salvedades / follow-ups

- **F-SPEC-052-1** (destino **EPIC-INFRA**, futuro) — **nada compara el runbook con el
  estado REAL de Vercel.** La guardia de CA-8 cruza `docs/despliegue.md` contra
  `.github/workflows/ci.yml`: si el panel de Vercel pierde una clave mañana, la guardia
  sigue verde. Cerrarlo exige la API/CLI de Vercel con credencial y red desde la suite,
  y sale del alcance de un FIX. Mientras tanto, la única prueba imposible de falsear de
  que Preview tiene sus claves es **que una PR construya verde** — mismo argumento que
  el runbook ya da para `ALLOW_MIGRATE` (§13.2, F-SPEC-032-2). **Declarado a propósito:
  se prefirió un documento cierto sin guardia a una guardia falsa.**

- **F-SPEC-052-2** (higiene, sin destino asignado) — la derivación de D-1 (*lo que el
  build exige = bloque `env` del job de CI que construye*) es correcta **porque hoy ese
  job construye en un runner donde no hay definido nada más**. Si algún día heredara
  variables de nivel de workflow, de `secrets` o del entorno del runner, la derivación
  dejaría de ser completa y la guardia pasaría a exigir de menos sin decirlo. Queda
  anotado aquí para que quien toque ese workflow lo sepa.

- **F-SPEC-052-3** (sobreaproximación aceptada) — la guardia exigirá en Preview **todas**
  las claves del bloque `env` del job que construye, incluidas las que el build quizá no
  necesite **estrictamente** (candidata: `AUTH_TRUST_HOST`). Asimetría de coste
  deliberada: exigir de más cuesta una entrada en un panel; exigir de menos cuesta
  **todas** las previews.

- **F-SPEC-052-4** — ~~decisión pendiente del humano (**Q-1**)~~ **CERRADO el 2026-08-24
  por el humano (Alberto Fojo): la asimetría es DELIBERADA y se queda.**
  `TWELVE_DATA_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM` y `CRON_SECRET` siguen **solo en
  Production**, porque *una preview no debe gastar cuota de proveedores externos ni poder
  mandar correo de verdad*. Que en una preview el buscador no busque, no salga un correo
  y el cron no se pruebe es el **precio aceptado, no un defecto**. **No se cierra sin
  dejar trabajo**: pasa a ser **CA-4 (b)** y **D-5** — el motivo se escribe junto a la
  tabla de §0, para que el runbook le responda solo a quien concluya que Preview está mal
  configurado. La configuración no cambia; lo que cambia es su estatuto.

- **F-SPEC-052-5** — ~~decisión pendiente del humano (**Q-2**)~~ **CERRADO el 2026-08-24
  por el humano: `.env.example` pasa a `http://localhost:3000`.** Entra como **CA-17** y
  **D-6**. Un fichero de ejemplo se copia a `.env` y se usa tal cual en local, así que
  sus valores por defecto tienen que funcionar en local; `https://stockeiro.app` era un
  dominio inventado que ni era el real ni servía para desarrollar, y que obligaba a §0 a
  salir a desmentirlo en otro fichero. **Efecto en cascada, ya incorporado**: **CA-3 deja
  de exigir** que §0 conserve ese desmentido, porque se queda sin nadie a quien
  desmentir; retirarlo pasa a estar **exigido** por CA-17.

- **F-SPEC-052-6** — ~~decisión pendiente del humano~~ **CERRADO el 2026-08-24 por
  sdd-arquitecto, con el id ofrecido y declinado: la regla de D-1 NO necesita ADR.** Es
  **autoejecutable en el punto donde se viola** —añadir una lectura de entorno en build
  obliga a tocar el `env` del job de CI, eso obliga a tocar el `toEqual` de
  `tests/ci-workflow.test.ts` 5.1, y la guardia de CA-8 obliga entonces a documentarla
  como necesaria en Preview: tres eslabones que fallan en rojo—. **ADR-031 necesitó ser
  ADR justamente porque su regla no tenía mecanismo** (su propio texto registra que la
  convención en prosa *«aguantó dos días»*, y hubo que fabricarle la meta-guardia de
  SPEC-048). Aquí el mecanismo **es** la regla, y un ADR cuyo contenido íntegro fuese
  *«hay un test que hace esto»* duplicaría el test y añadiría un artefacto inmutable que
  mantener. Precedente: SPEC-051 rechazó tres alternativas por escrito en su §Diseño D-4
  sin ADR y aguantó el arbitraje.
  **Condición de reapertura, escrita para que sea comprobable**: si el build llega a leer
  una clave que el `env` de ese job **no puede ver** —el escenario de **F-SPEC-052-2**—,
  la regla deja de ser autoejecutable, vuelve a ser prosa y **entonces sí** necesita ADR
  + RI-04 con id asignado desde fuera.

- **F-SPEC-052-7** — 🚨 **PARADA, ESCALADA AL GATE: una aserción AJENA se pone roja y NO se ha
  tocado.** `tests/tarjeta-guardias-ampliadas.test.ts` (SPEC-051 **CA-17.1**, caso *«los únicos
  ficheros ajenos de tests/ que esta spec nombra son esos dos»*) recoge **todos** los ficheros
  bajo `tests/` cuya fuente contenga la cadena `SPEC-051` y los compara con `toEqual` contra una
  lista congelada el día de la entrega de SPEC-051. `tests/entornos-de-despliegue.test.ts` la
  menciona —y **tiene que** mencionarla: CA-2 (a) exige que el runbook cite SPEC-051 y CA-14 exige
  que la nota diga de qué spec es el diseño arbitrado— así que el fichero entra en esa lista y el
  caso da rojo:

  ```
  FAIL tests/tarjeta-guardias-ampliadas.test.ts >
    SPEC-051 CA-17.1: son DOS guardias ajenas, y la tercera no ha hecho falta >
    los únicos ficheros ajenos de tests/ que esta spec nombra son esos dos
  AssertionError: un TERCER fichero ajeno re-encuadrado es RED: se escala al gate, no se toca
      Array [
        "tests/cuenta-rutas.test.ts",
        "tests/e2e/tarjeta.spec.ts",
  +     "tests/entornos-de-despliegue.test.ts",
        "tests/legal-rutas-publicas.test.ts",
        "tests/tarjeta-frontera.test.ts",
        "tests/tarjeta-guardias-ampliadas.test.ts",
        "tests/tarjeta-imagen.test.ts",
        "tests/tarjeta-raster.ts",
      ]
  ```

  **Qué es realmente.** No hay ninguna guardia ajena re-encuadrada por SPEC-052: el fichero nuevo
  no toca ni una aserción de nadie. Lo que la guardia de SPEC-051 congeló no es una propiedad sino
  **un estado del árbol** —*«hoy, los ficheros de `tests/` que dicen SPEC-051 son exactamente
  estos ocho»*—, y ese estado caduca en cuanto **cualquier** spec posterior necesite citar a
  SPEC-051 por un motivo legítimo. Es la forma exacta que `FOUNDATION.md` describe desde el
  2026-08-20 (*un test de frontera fija una propiedad, no un estado del árbol*) y su rojo no lleva
  defecto detrás: solo dice que el proyecto avanzó. El propio caso lo anticipa en su mensaje —
  *«se escala al gate, no se toca»*.

  **Qué NO se ha hecho, y por qué.** No se ha tocado el fichero ajeno, y tampoco se ha esquivado
  la guardia escribiendo `SPEC-051` partido o en otra forma para que no case: eso sería aflojar
  la comprobación hasta que pase, la salida que `FOUNDATION.md` declara ilegítima, y encima en
  silencio y a favor de quien se beneficia. **Quien lo re-encuadre no puede ser esta
  implementación.** Del gate salen las dos salidas legítimas: **re-encuadrar** (la propiedad viva
  es *«los ficheros que SPEC-051 re-encuadró son esos dos»*, que se puede afirmar sin barrer todo
  `tests/` por una cadena) o **borrar** (lo que vigilaba era del momento de la entrega). En
  cualquiera de los dos casos, con lo que vigilaba antes y lo que vigila ahora escrito en el
  ledger de quien lo toque. Precedentes de los dos: `F-SPEC-034-6` y `F-SPEC-042-9`.

  ---

  ↳ **RESUELTO el 2026-08-24. Salida elegida: RE-ENCUADRAR.** Autorizado nominalmente por el
  humano (**Alberto Fojo, 2026-08-24**); **escalado sin tocarlo por el implementador**;
  **redactado por sdd-arquitecto**, que es quien no se beneficia de que la guardia calle. Queda
  gobernado por **SPEC-052 CA-18 (a)…(f)** y argumentado en **§Diseño D-7**. Resumen del
  arbitraje, para quien lea solo el ledger:

  - **El diagnóstico del implementador se confirma, y se afina.** El defecto de fondo es un
    **error de converso**: la guardia se apoya —lo dice su propio comentario— en que *«todo
    re-encuadre menciona SPEC-051»*, y la usa como si fuera *«toda mención es un re-encuadre»*.
    Condición necesaria empleada como suficiente. Su forma se nombra: **un conjunto cerrado
    sobre un universo abierto**, familia de `F-SPEC-034-6`, que caduca **por instantánea** y no
    por diana móvil — y por eso la meta-guardia de SPEC-048 no la vio: ahí no hay ni un `git`.
  - **Por qué re-encuadrar y no borrar.** Se leyeron los **cuatro** bloques del fichero:
    CA-17.2, CA-17.3 y CA-17.4 hablan **solo de las dos** guardias autorizadas. **Ninguno dice
    nada sobre un tercero.** Borrar dejaría sin dueño el único punto que vigila *«no hubo un
    tercero»*, y esa proposición **sigue viva**. Es lo que lo separa del caso de SPEC-050
    (SPEC-053 CA-13), donde lo vigilado ya **no podía volver a ser cierto**.
  - **El re-encuadre.** El conjunto se cierra sobre **la firma de un re-encuadre autorizado**
    —la conjunción que **CA-17.2 ya exige**: `SPEC-051` + `CA-17` + `2026-08-23` + *arbitraje
    del humano* + *Qué vigilaba antes* + *Qué vigila ahora*— en vez de sobre la cadena
    `SPEC-051`. Una cita en prosa no produce esa conjunción; un re-encuadre autorizado sí, por
    obligación. El mecanismo pasa a coincidir con la inferencia que la guardia ya declaraba.
  - **Cobertura: idéntica frente al fallo real; desaparece el falso positivo.** Y lo que **NO**
    mejora, dicho en voz alta: un re-encuadre **mudo** —sin nota— no lo caza ninguna de las dos
    versiones. **Tampoco lo cazaba la original**, cuya detección siempre dependió de que el
    infractor escribiera la nota. No se pierde nada; el hueco es de la meta-guardia futura.
  - **Trampa nueva que el implementador debe tratar, y está en CA-18 (b)**: este fichero
    **define** la firma en sus propias aserciones, así que **la contiene y se detectaría a sí
    mismo**. La detección excluye su propia ruta, en constante con su motivo, y un centinela
    afirma que la exclusión es **necesaria** (el fichero sí lleva la firma) y que hay
    **exactamente una**.
  - **`PROPIOS` queda huérfano**: era la **segunda instantánea congelada** del mismo caso y deja
    de alimentar ninguna aserción. Se retira, o se deja inerte **con su motivo escrito**.
  - **El atajo sigue prohibido, ahora por escrito** (CA-18 f): no se parte ni se disfraza el
    literal `'SPEC-051'`. Consta que el implementador **no** lo hizo, y la prohibición queda
    para el siguiente.

  ---

  ↳ **APLICADO y CERRADO el 2026-08-24 por sdd-implementador.** Las seis partes están
  implementadas y probadas; el fichero ajeno queda en **15/15 verde** y la suite completa en
  **1829/1829** sobre la base `497eccf`. Lo que se hizo, y la evidencia de que no es un verde de conveniencia:

  **1. El criterio cambió de verdad, y se puede medir.** Ejecutando **el criterio viejo** (la
  cadena) sobre el árbol de hoy salen **nueve** ficheros; el nuevo (la firma) devuelve
  **exactamente dos**. Los siete de diferencia son los falsos positivos que el converso
  producía:

  ```
  CRITERIO VIEJO (la cadena) -> 9 ficheros
    tests/cuenta-rutas.test.ts               ← re-encuadre real
    tests/e2e/tarjeta.spec.ts                ← propio de SPEC-051, no es re-encuadre
    tests/entornos-de-despliegue.test.ts     ← LA CITA OBLIGADA por CA-2 (a) y CA-14
    tests/legal-rutas-publicas.test.ts       ← re-encuadre real
    tests/tarjeta-frontera.test.ts           ← propio
    tests/tarjeta-guardias-ampliadas.test.ts ← el que DEFINE la firma
    tests/tarjeta-imagen.test.ts             ← propio
    tests/tarjeta-raster.ts                  ← propio
    tests/zz-tercero-sintetico.test.ts       ← el sintético de la prueba de abajo

  CRITERIO NUEVO (la firma) -> 2 ficheros
    tests/cuenta-rutas.test.ts
    tests/legal-rutas-publicas.test.ts
  ```

  **2. El rojo, en los dos sentidos, demostrado sobre el árbol y no solo con cadenas.** Se creó
  un fichero sintético bajo `tests/` y se ejecutó la guardia re-encuadrada dos veces, cambiando
  **solo** su contenido. Con la **firma completa** (`SPEC-051` + `CA-17` + `2026-08-23` +
  *arbitraje del humano* + *Qué vigilaba antes* + *Qué vigila ahora*) → **RED**:

  ```
  FAIL tests/tarjeta-guardias-ampliadas.test.ts >
    SPEC-051 CA-17.1: son DOS guardias ajenas, y la tercera no ha hecho falta >
    los ficheros de tests/ re-encuadrados bajo la autorización de esta spec son esos dos
  AssertionError: un TERCER fichero ajeno re-encuadrado es RED: se escala al gate, no se toca
      Array [
        "tests/cuenta-rutas.test.ts",
        "tests/legal-rutas-publicas.test.ts",
  +     "tests/zz-tercero-sintetico.test.ts",
      ]
   Tests  1 failed | 14 passed (15)
  ```

  Y con el **mismo fichero** limitado a **citar** la spec en un comentario en prosa —el caso
  exacto que rompía la guardia vieja— → **GREEN**, `15/15`. Ese par es la prueba entera: la
  guardia **sigue mordiendo** ante un tercer re-encuadre y **ha dejado** de morder ante una
  cita. El sintético se borró después; no queda en la rama.

  Además, los tres sentidos quedan **permanentes en la suite** como función pura
  (CA-18 c): firma completa → `true`; cita en prosa → `false`; y firma a la que se le quita
  **una sola marca** (la fecha) → `false`, porque una firma incompleta no es la conjunción que
  CA-17.2 exige.

  **3. La autoexclusión es necesaria, y se prueba.** El centinela pregunta por la firma
  **sin** pasar por la exclusión y confirma que la fuente de `tarjeta-guardias-ampliadas`
  **sí la lleva** —la lleva porque su caso de CA-17.2 la define—, de modo que la excepción no
  es un blanqueo preventivo; y que `EXCLUIDOS_DE_LA_DETECCION` tiene **exactamente un**
  elemento, para que la lista no se convierta en un desagüe.

  Detalle de implementación que conviene saber: la extracción de casos que ya existía en el
  fichero (`casos()`) **solo** reconoce `it('…')` a dos espacios, y los casos de CA-17.2 llevan
  el título **interpolado** y van a cuatro. Con ella, el fichero **no** se habría detectado a
  sí mismo y la exclusión habría sido justo el blanqueo que CA-18 (b) prohíbe. Por eso se añade
  `cuerposDeCasos()` —cualquier sangría, comilla simple o acento grave, molde de
  `tests/guardias-ancladas.test.ts`— y **`casos()` se deja intacta**: la usan CA-17.2 y CA-17.3,
  y tocarla sería mover aserciones que SPEC-052 no tiene autorización para mover.

  **4. `PROPIOS` retirado** (no inerte): la constante desaparece y su motivo queda escrito en el
  porqué de la aserción —*era la segunda instantánea congelada del mismo caso, y los ficheros
  propios de SPEC-051 no llevan firma porque no son re-encuadres*—. Dejarla inerte habría
  exigido referenciarla para no romper el lint, que es la forma de acabar con una lista muerta.

  **5. Nada más del fichero se movió.** Los tres bloques protegidos (CA-17.2, CA-17.3 con su
  prueba por mutación, y CA-17.4 con las hermanas, el matcher y `PUBLIC_PREFIXES`) y el caso de
  la guardia que **no** se toca siguen íntegros; la cabecera con el porqué que dejó SPEC-051
  **no se borró**. Lo vigilan los tres casos de CA-18 (e), que además comprueban que el caso
  viejo **ya no está** y el nuevo **sí**: las dos mitades de un re-encuadre.

  **6. El atajo del literal, prohibido y vigilado** (CA-18 f). El barrido recorre
  `tests/**/*.ts` buscando literales cortados por un prefijo propio o partidos por una
  interpolación. Tiene su propio centinela: reconoce las **seis** formas y no marca las **tres**
  inocentes. Y una trampa que hubo que resolver, escrita para quien la herede: los espectros y
  los rótulos de la propia guardia **no pueden contener el fragmento literalmente**, o el
  barrido se marcaría a sí mismo — se componen en tiempo de ejecución y los rótulos usan
  comillas angulares. Una guardia tiene que poder describirse sin infringirse.

- **F-SPEC-052-8** (discrepancia menor de la spec, resuelta sin salirse del CA) — **CA-14 da por
  existente un caso de SPEC-023 que no existe.** El CA dice *«si el caso ya existe (SPEC-023), se
  le añade la nota y no se duplica»*, y la tabla de §Ficheros lista *«el test de `appBaseUrl()`
  (SPEC-023)»* como fichero a modificar. Se buscó por símbolo (`appBaseUrl`), por módulo
  (`app-url`, `buildResetUrl`) y por mensaje (`no definida`) en todo `tests/`: **no hay ningún
  caso que ejercite `appBaseUrl()`**. La única mención viva es
  `tests/tarjeta-frontera.test.ts:75`, y es un test **estático** sobre el texto de
  `src/app/layout.tsx` (`expect(layout).toMatch(/metadataBase:\s*new URL\(appBaseUrl\(\)\)/)`), no
  una llamada a la función. Es decir: la conducta que causó el incidente —lanzar cuando la clave
  falta— **no tenía cobertura unitaria** desde SPEC-023. Se ha creado el caso **una sola vez**,
  dentro de `tests/entornos-de-despliegue.test.ts`, con la nota que CA-14 pide. No se duplica
  nada y no se ha tocado ninguna aserción ajena. Se anota porque la tabla de ficheros de la spec
  dice otra cosa y conviene que el verificador no la busque donde no está.

  ↳ **VALIDADO el 2026-08-24 por sdd-arquitecto: el implementador tenía razón y el CA estaba mal
  redactado.** Escribí *«si el caso ya existe (SPEC-023)»* sobre una suposición que **no
  verifiqué**, y era falsa. **Crear el caso una sola vez en el fichero nuevo es lo correcto.**
  **CA-14 y la tabla de §Ficheros quedan corregidos** en la spec: se retira la premisa falsa y la
  fila *«el test de `appBaseUrl()` (SPEC-023)»*.
  **Y el hallazgo se asciende de discrepancia a hecho registrado**, porque vale más que una
  corrección de redacción: **la función cuya excepción tumbó todas las previews no tenía ni un
  test unitario**. El motivo es lo instructivo: SPEC-023 la ejercitaba solo **de paso**, dentro
  del flujo de recuperación; cuando SPEC-051 le dio un **segundo consumidor completamente
  distinto** —metadatos en tiempo de build— no había nada que la probara **por sí misma**. Una
  función con dos consumidores y cero tests propios se prueba solo por accidente.
  **Exigencia añadida a CA-14**: el caso nuevo asserta el **mensaje literal**
  (`APP_BASE_URL no definida (ver .env.example): sin ella no hay enlaces válidos.`), que es el que
  aparece en el log de Vercel del PR #58 y el que **CA-2 (c)** exige en el documento — así el
  documento y el código quedan atados por el mismo literal y no pueden divergir en silencio.

  ↳ **Epílogo del 2026-08-24, y sale bien: SPEC-055 mergeó encima y NO chocó.** Mientras esto
  se cerraba entró **SPEC-055** (PR #63), que reescribe `src/lib/config/app-url.ts` para que
  `appBaseUrl()` valide el **valor** y no solo su presencia, y estrena
  `tests/app-base-url.test.ts` — el test propio que F-SPEC-052-8 echaba en falta, ahora con 77
  casos. Podría haber sido una colisión fea: mi CA-14 congela un literal de esa misma función.
  No lo fue, y merece quedar escrito **porque es el mecanismo funcionando**:

  - SPEC-055 **dejó intacto** el mensaje de la rama «clave ausente» y escribió al lado, en el
    código, que *«el literal de este mensaje y la firma de esta función son CONTRATO con
    SPEC-052 CA-14, que los congela en `tests/entornos-de-despliegue.test.ts`»*.
  - Su propio test **afloja a propósito** su aserción sobre ese literal (`/APP_BASE_URL no
    definida/`, regex) y **cede el congelado** a esta spec, para no tener dos dueños.
  - Y evitó acoplarse a `.env.example` **sabiendo que CA-17 lo estaba cambiando**, dejándolo
    dicho en su D-7. Dos specs hermanas tocando la misma función el mismo día, sin pisarse.

  Tras el rebase, `tests/app-base-url.test.ts` pasa **77/77** y el caso de CA-14 sigue verde
  con el literal entero. **No hay duplicación**: aquel prueba la validación del valor (SPEC-055),
  este congela el literal y la firma de la rama ausente (SPEC-052).

- **F-SPEC-052-9** (petición entrante de SPEC-055, **NO implementada aquí**) — **`D-SPEC-055-1`
  pide a esta spec una guardia que SPEC-052 no tiene entre sus CA.** El comentario de
  `tests/app-base-url.test.ts` (bloque de CA-5) lo deja escrito: *«si alguien quiere la guardia
  de que el ejemplo de `.env.example` pasa `appBaseUrl()` —propiedad legítima—, vive con el
  dueño del fichero: queda pedida a SPEC-052 en `D-SPEC-055-1`. NO la traigas de vuelta aquí»*.

  Es una propiedad **buena y barata** —una línea: `expect(() => appBaseUrl({ APP_BASE_URL:
  'http://localhost:3000' })).not.toThrow()`— y cae justo al lado de CA-17, que es quien fija
  ese valor. **Y aun así no se ha escrito**, porque **ningún CA de SPEC-052 la pide** y la regla
  del rol es que nada entra fuera de los CA. Con CA-18 recién añadido por el arquitecto, meter
  una aserción por iniciativa propia sería exactamente lo que esa disciplina evita.

  **Lo que hace falta para cerrarla**: que el arquitecto decida si entra como enmienda a CA-17 en
  esta spec —es el sitio natural: el mismo fichero, el mismo valor, y el coste es una línea— o
  si se queda como residual con destino propio. **Decisión del gate, no mía.**

  ---

  ↳ **RESUELTO el 2026-08-25 por sdd-arquitecto: ENTRA, como enmienda a CA-17 → nueva parte
  `CA-17 (c)`.** No como criterio decimonoveno: el humano aprobó *«el valor de ejemplo es el de
  desarrollo»*, y *«y de verdad sirve»* es la **forma-propiedad de ese mismo criterio**, no
  alcance nuevo. **El implementador hizo bien en no escribirla**: con CA-18 recién puesto, añadir
  aserciones que ningún CA pide es justo lo que esa disciplina evita.

  **Por qué entra, y el argumento que me obliga**: **CA-17 congela un literal**, y esta es la
  entrega que en **CA-18** acaba de formalizar que un literal congelado necesita su **hermana**
  que mida la propiedad —el patrón que el propio `tests/tarjeta-guardias-ampliadas.test.ts`
  enuncia en su cabecera—. Enviar CA-17 sin ella, **en esta spec precisamente**, sería predicar y
  no aplicar. Y **SPEC-055 hizo la propiedad significativa**: `appBaseUrl()` ya no comprueba solo
  presencia sino **cuatro condiciones** (protocolo, credenciales, query/fragmento, ruta), así que
  *«el ejemplo sirve»* dejó de ser trivial. Además el valor lo cambia **esta** spec: quien lo
  cambia responde de que sirva. Vive en el **fichero propio** de esta entrega, sin tocar nada
  ajeno, sin `git`, y sin ensanchar CA-15.

  **Lo que tiene que hacer el implementador — tres condiciones, en `CA-17 (c)`:**

  1. **Llamar a la función; NO reescribir sus reglas.** La aserción **invoca** `appBaseUrl()`.
     Queda **prohibido** replicar aquí su criterio con un regex o comprobaciones propias.
     **SPEC-055 es la dueña única** de qué es un origen usable, y restatearlo aquí haría de
     SPEC-052 una **segunda dueña** del mismo contrato — exactamente lo que SPEC-055 evitó al
     aflojar a propósito su aserción sobre el mensaje para que **CA-14** fuese dueño único de
     aquel literal. Un contrato con dos dueños diverge; la forma de tener uno solo es
     **ejecutarlo**.
  2. **Centinela de no-vacuidad sobre el lector**: el valor extraído no está vacío y es el que
     CA-17 (a) congela; y el lector aplicado a un `.env.example` sintético **sin** la clave falla
     de forma reconocible en vez de devolver algo.
  3. **Rojo probado**: con un `.env.example` sintético cuyo `APP_BASE_URL` lleve **ruta**
     (`http://localhost:3000/app`) —el caso que SPEC-055 documenta como el que significaría dos
     cosas distintas según quién lo lea— la comprobación **falla**. Misma exigencia que CA-11 y
     CA-18 (c).

  ---

  ↳ **IMPLEMENTADO y CERRADO el 2026-08-25 por sdd-implementador.** Cuatro casos nuevos en
  `tests/entornos-de-despliegue.test.ts`, bloque *«SPEC-052 CA-17 (c): el valor de ejemplo
  además SIRVE»*. Las tres condiciones, una a una:

  **1. Se invoca la función.** Dos helpers y ni un regex que replique criterio ajeno:
  `valorDeAppBaseUrlEn(plantilla)` **lee** el valor de la plantilla, y `elEjemploSirve(plantilla)`
  se lo pasa a **`appBaseUrl()`**. Todo lo que esta guardia sabe sobre qué es un origen usable lo
  sabe **ejecutando** a SPEC-055; aquí no hay lista de protocolos, ni comprobación de query, ni
  nada que pueda divergir de su dueña. El único regex del bloque es el que **localiza la línea**
  en `.env.example` — lectura, no criterio.

  **2. Centinela, en sus dos mitades.** Un caso afirma que el valor leído **no está vacío** y es
  **el mismo literal que congela CA-17 (a)**; otro, que sobre una plantilla sintética **sin** la
  clave el lector **lanza** en vez de devolver algo. Esa segunda mitad es la que importa y por eso
  el lector se escribió lanzando: si devolviera `undefined` o `''`, el caso principal pasaría en
  verde sin haber comprobado nada — el verde vacío de ADR-031, entrando por la puerta del lector
  en vez de por la de la aserción.

  **3. Rojo probado, y además demostrado sobre el fichero real.** El caso permanente muta una
  copia de la plantilla para darle **ruta** y exige que la comprobación falle, con un **control**
  que aísla la causa: la misma cadena sin la ruta pasa. Y para no fiarse de una plantilla
  sintética, se rompió el `.env.example` **de verdad** —`APP_BASE_URL="http://localhost:3000/app"`—
  y se volvió a correr. Salida literal:

  ```
   ❯ tests/entornos-de-despliegue.test.ts (47 tests | 3 failed | 43 skipped)
     × CA-17 (c) … `appBaseUrl()` acepta el valor de `.env.example` y devuelve ese mismo origen
       → APP_BASE_URL no es un origen absoluto usable: «http://localhost:3000/app» — lleva ruta
         (`/app`): la tarjeta de enlace la conservaría y el enlace de recuperación la perdería,
         así que el mismo valor significaría dos cosas. Se espera un origen `http` o `https` sin
         ruta, query, fragmento ni credenciales; por ejemplo http://localhost:3200 o
         https://stockeiro.tremen.dev. …
       ❯ rechazar src/lib/config/app-url.ts:78:9
       ❯ Module.appBaseUrl src/lib/config/app-url.ts:121:5
       ❯ elEjemploSirve tests/entornos-de-despliegue.test.ts:754:10
     × CA-17 (c) … centinela: el lector devuelve el valor que congela CA-17 (a), no una cadena vacía
       → el lector y el literal congelado se han separado:
         expected 'http://localhost:3000/app' to be 'http://localhost:3000'
     × CA-17 (c) … y se prueba en ROJO: un ejemplo con RUTA no pasa, y el control dice que es la ruta
       → la mutación no se aplicó: la comprobación no probaría nada
  ```

  Nótese la **traza**: el rojo entra por `rechazar` → `appBaseUrl` → `elEjemploSirve`. Es la
  prueba de que la condición 1 se cumple de verdad — la que decide es **la función de SPEC-055**,
  no una réplica local de sus reglas. Y el tercer fallo es el centinela de mutación haciendo su
  trabajo: con el fichero real ya con ruta, la mutación no cambiaba nada y el caso lo dijo en vez
  de pasar.

  **Segunda demostración, la del lector.** Se quitó la clave entera del `.env.example` real y el
  centinela habló con su propio mensaje, en vez de dejar pasar un valor vacío:

  ```
     × CA-17 (c) … `appBaseUrl()` acepta el valor de `.env.example` y devuelve ese mismo origen
       → el lector de `.env.example` no encuentra APP_BASE_URL: o la línea cambió de forma, o la
         clave desapareció. En cualquiera de los dos casos, esta guardia ha dejado de mirar lo
         que dice que mira.
  ```

  `.env.example` restaurado con `git checkout --` en ambos casos; **no queda ninguna mutación en
  la rama**. Con el fichero íntegro: `tests/entornos-de-despliegue.test.ts` **47/47**.


## Cómo retomar (handoff)

**Estado real (2026-08-24)**: **implementación TERMINADA, con CA-18 incluido**; spec en
`en-revision`; rama `ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde` sobre `origin/main`
en **`497eccf`** (rebasada **dos veces**: tras SPEC-053 + SPEC-054, y luego tras SPEC-055).
**Suite completa en verde: 1829/1829**, y `version:check` en verde con el árbol limpio. **Sin PR
y sin merge** — eso es del orquestador.

**No queda nada abierto que necesite a nadie.** Los tres follow-ups que nacieron durante la
implementación están **cerrados**: `F-SPEC-052-7` (la guardia ajena → re-encuadrada bajo
**CA-18**), `F-SPEC-052-8` (la premisa falsa de CA-14 → corregida, y el test propio creado) y
`F-SPEC-052-9` (`D-SPEC-055-1` → entra como **CA-17 (c)**, implementado). Los seis restantes
—`F-SPEC-052-1` … `F-SPEC-052-6`— son declaraciones de alcance de la propia spec, no deuda de la
entrega.

**`F-SPEC-052-7` está CERRADO, y conviene leer su cierre antes que nada.** El rojo de la guardia
ajena de SPEC-051 CA-17.1 **ya no existe, y no porque se haya callado**: el humano autorizó
nominalmente tocarla el 2026-08-24, el arquitecto redactó el re-encuadre como **CA-18** y esta
implementación lo aplicó. El conjunto pasó de cerrarse sobre la **cadena** `SPEC-051` a cerrarse
sobre la **firma de un re-encuadre autorizado**. La prueba de que sigue mordiendo —un tercero
sintético con firma la pone RED, el mismo fichero limitado a citar la deja GREEN— está pegada en
el cierre de ese follow-up, junto con la medida del criterio viejo (9 ficheros) contra el nuevo
(2).

**Cómo se verifica esta entrega, en orden y sin sorpresas:**

1. `npx vitest run tests/entornos-de-despliegue.test.ts` → **47/47**. Todo lo testable de
   CA-1..CA-14, CA-17 **(a)(b)(c)** y las partes (e)/(f) de CA-18.
2. `npx vitest run tests/tarjeta-guardias-ampliadas.test.ts` → **15/15**. La guardia ajena
   re-encuadrada, con las partes (a)…(d) de CA-18.
3. `npm run typecheck` y `npm run lint` → limpios.
4. `npm run test` → **1829/1829**, 114/114 ficheros. **Sin excepciones ni rojos declarados.**
5. Los dos `n-a` **ya están ejecutados y con su salida literal pegada** en N-1 y N-2 de arriba
   (incluido el **control** del build en verde con las cuatro claves de la CI, que es lo que
   hace que el rojo de N-2 signifique algo).
6. `npm run version:check` → *«el diff no toca codigo de aplicacion»*, exit 0, **con el árbol
   limpio**. **Vuelve a ejecutarlo si `origin/main` se mueve otra vez**, y no supongas que un
   verde de ayer sigue valiendo: durante esta entrega la base avanzó dos merges y el gate pasó
   a rojo por versión que **baja** sin que el delta hubiera cambiado ni una línea. La salida es
   **rebasar**, nunca subir la versión: subirla afirmaría que esta entrega toca producto, que
   es exactamente lo que CA-15 niega. Está contado en N-1.

**Para comprobar que las tres guardias no son decoración, sin creerse el ledger:**

- **CA-8** — cambia a mano la celda de `APP_BASE_URL` en la tabla de §0 de `docs/despliegue.md`
  de `Preview + Production` a `Production` y vuelve a correr el fichero. Tiene que ponerse roja
  nombrando la clave y diciendo que *el build de Preview de toda PR fallará en `next build`*.
- **CA-18** — crea un fichero cualquiera bajo `tests/` con un caso que lleve las **seis marcas**
  de la firma (`SPEC-051`, `CA-17`, `2026-08-23`, *arbitraje del humano*, *Qué vigilaba antes*,
  *Qué vigila ahora*) y corre `tests/tarjeta-guardias-ampliadas.test.ts`: **rojo**, listando el
  tercero. Quítale una sola marca —la fecha, por ejemplo— y vuelve: **verde**. Ese par es la
  diferencia entre la guardia y su decoración.
- **CA-17 (c)** — pon `APP_BASE_URL="http://localhost:3000/app"` en `.env.example` y corre el
  fichero: **rojo**, y la traza tiene que entrar por `rechazar` → `appBaseUrl` en
  `src/lib/config/app-url.ts`. Que el rojo venga de **ahí** y no de un regex local es la prueba
  de que SPEC-055 sigue siendo dueña única del criterio. Borra luego la línea entera de la
  clave: el rojo cambia y pasa a ser el del **lector**, con su propio mensaje.

Deshaz los cambios después (`git checkout -- <fichero>`).

**Trampas que siguen vivas para quien toque esto:**

- **No aflojar `tests/ci-workflow.test.ts` caso 5.1**: el `toEqual` que congela el bloque `env`
  del job que construye es el punto de paso obligatorio del que cuelga toda la cadena de D-1.
- **La guardia no puede usar `git`** (D-4). `tests/revision-movil-en-tests.test.ts` barre todo
  `tests/**/*.ts` y lo comprobaría; hoy pasa con cero infracciones.
- **El job que construye se localiza por contenido**, nunca por el nombre `E2E`. CA-9 vigila que
  se encuentre exactamente uno; si mañana hay dos, es información, no un estorbo.
- **`RESEND_FROM` conserva su ejemplo** `Stockeiro <avisos@stockeiro.app>`, y hay un caso que lo
  afirma en positivo para que no se «arregle de paso».
- **Los normalizadores del fichero no tocan el guion bajo** a propósito: `_` forma parte de
  `APP_BASE_URL` y de `/_not-found`, que son contrato. Sí se planchan las marcas de cita `>` de
  markdown, porque una frase partida dentro de un blockquote sigue siendo la misma frase.
- **Lo que la guardia NO sabe**: nada del panel real de Vercel (**F-SPEC-052-1**). Si el panel
  pierde una clave mañana, sigue verde. Lo único que lo delata es una preview roja.

Y tres más que estrena **CA-18**, para quien vuelva a tocar la guardia ajena:

- **`casos()` de `tarjeta-guardias-ampliadas` no se toca.** Solo reconoce `it('…')` a dos
  espacios y la usan CA-17.2 y CA-17.3 para localizar un caso por su título exacto. La detección
  del re-encuadre usa `cuerposDeCasos()`, que es **aparte** y admite cualquier sangría y el
  título interpolado. Ampliar la primera movería aserciones que esta spec no tiene autorización
  para mover.
- **La autoexclusión tiene que seguir siendo NECESARIA.** Si algún día ese fichero dejara de
  contener la firma, la exclusión sobraría y su centinela lo dirá en rojo. Quitarla entonces es
  lo correcto; ampliarla a un segundo fichero, no — la lista es una excepción con nombre, no un
  desagüe.
- **Una guardia tiene que poder describirse sin infringirse.** Los espectros y los rótulos de
  CA-18 (f) se componen en tiempo de ejecución y usan comillas angulares, porque escribir el
  fragmento prohibido tal cual haría que el barrido se marcara a sí mismo. Si añades una forma,
  añade su espectro **y** compruébalo contra los tres inocentes.

Y una que estrena **CA-17 (c)**:

- **SPEC-055 es la dueña única de qué es un origen usable, y esta guardia la EJECUTA.** Si
  mañana falla CA-17 (c) y la tentación es «arreglarlo» aflojando la comprobación, mira antes la
  traza: si entra por `rechazar` → `appBaseUrl` en `src/lib/config/app-url.ts`, lo que falla es
  el **valor de ejemplo**, no la guardia. Y **nunca** se replican aquí sus cuatro condiciones con
  un regex propio para «no depender de ella»: eso crearía un contrato con dos dueños, que es la
  forma exacta en que dos ficheros acaban diciendo cosas distintas sobre lo mismo. La única
  manera de tener un solo dueño es llamarlo.
