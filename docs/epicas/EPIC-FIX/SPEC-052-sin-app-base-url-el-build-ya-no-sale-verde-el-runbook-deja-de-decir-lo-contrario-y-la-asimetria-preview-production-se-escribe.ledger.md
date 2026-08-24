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
| CA-14 — `appBaseUrl()` sigue lanzando, con la nota de que es deliberado | **Nada**: `src/lib/config/app-url.ts` intacto (ver **F-SPEC-052-8**) | `G` › *CA-14* — **2 casos**: lanza con la clave ausente y con una cadena de espacios; y el propio caso **contiene la nota** (SPEC-051 · D-4 · deliberado · *SPEC-052 NO revisa esta conducta*), leída de la fuente del fichero, sin `git` | | |
| CA-15 — la entrega no toca `src/` ni `drizzle/` | — (criterio sobre el delta) | **n-a — ver nota N-1** | gate | n-a |
| CA-16 — `npm run build` sin `APP_BASE_URL` falla | — (verificación empírica única) | **n-a — ver nota N-2** | gate | n-a |
| CA-17 — `.env.example`: `APP_BASE_URL` → `http://localhost:3000`, y §0 retira el desmentido | `.env.example` (valor + comentario) y `docs/despliegue.md` §0 (desmentido retirado) | `G` › *CA-17: el valor de ejemplo es el de desarrollo* — **3 casos** (valor literal · `stockeiro.app` ya no es su valor · `RESEND_FROM` **conserva** el suyo) y *CA-17: §0 retira el desmentido* — **2 casos** (`stockeiro.app` fuera del aviso, pero *origen REAL del despliegue* sigue) | | |

**Estado de la suite tras la entrega:** `tests/entornos-de-despliegue.test.ts` → **38/38 verde**.
`npm run typecheck` y `npm run lint` limpios. Suite completa: **1702/1703**, con **un rojo que no
es de esta entrega y que NO se ha tocado** — ver **F-SPEC-052-7**.

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

  **Ejecutado el 2026-08-24.** Base: `origin/main` en `3b6fc8b` (`git merge-base origin/main
  HEAD` lo confirma). Comando y salida literal:

  ```
  $ git merge-base origin/main HEAD
  3b6fc8bd2611958e6faeb15f3c60f51341f6fe88

  $ git diff --name-only 3b6fc8b...HEAD
  .env.example
  docs/despliegue.md
  docs/epicas/EPIC-FIX/SPEC-052-….ledger.md
  docs/epicas/EPIC-FIX/SPEC-052-….md
  tests/entornos-de-despliegue.test.ts
  ```

  **Ni un fichero bajo `src/` ni bajo `drizzle/`.** Consecuencia declarada, comprobada:

  ```
  $ npm run version:check
  [check-version-bump] Base: origin/main.
  [check-version-bump] El diff no toca codigo de aplicacion: no hay nada que subir.
  (exit 0)
  ```

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


## Cómo retomar (handoff)

**Estado real (2026-08-24)**: **implementación TERMINADA**, spec en `en-revision`, rama
`ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde` sobre `origin/main` en `3b6fc8b`.
Dos commits: el de la spec y el de la entrega. **Sin PR y sin merge** — eso es del orquestador.

**Lo que hay que mirar primero, antes que ninguna otra cosa: `F-SPEC-052-7`.** Hay **un rojo en
la suite** y **no es de esta entrega**: `tests/tarjeta-guardias-ampliadas.test.ts` (SPEC-051
CA-17.1) congeló la lista de ficheros de `tests/` que mencionan `SPEC-051`, y el fichero nuevo
la menciona porque **dos CA de SPEC-052 obligan a mencionarla** (CA-2 a y CA-14). Es una
aserción **ajena**, la spec no la nombra, y **no se ha tocado ni esquivado**: se escala. Hasta
que el gate decida, `npm run test` da **1702/1703**.

**Cómo se verifica esta entrega, en orden y sin sorpresas:**

1. `npx vitest run tests/entornos-de-despliegue.test.ts` → **38/38**. Es donde vive todo lo
   testable de CA-1..CA-14 y CA-17.
2. `npm run typecheck` y `npm run lint` → limpios.
3. `npm run test` → **1702/1703**, con el único rojo de `F-SPEC-052-7`.
4. Los dos `n-a` **ya están ejecutados y con su salida literal pegada** en N-1 y N-2 de arriba
   (incluido el **control** del build en verde con las cuatro claves de la CI, que es lo que
   hace que el rojo de N-2 signifique algo).
5. `npm run version:check` → *«el diff no toca codigo de aplicacion»*, exit 0, **con el árbol
   limpio**. Si SPEC-053 (PR #60, el lockfile) se mergea antes, **re-ejecútalo**: la versión
   base es un recurso compartido y la reclama quien mergea primero.

**Para comprobar que la guardia de CA-8 no es decoración, sin creerse el ledger:** cambia a mano
la celda de `APP_BASE_URL` en la tabla de §0 de `docs/despliegue.md` de `Preview + Production`
a `Production` y vuelve a correr el fichero. Tiene que ponerse roja nombrando la clave y
diciendo que *el build de Preview de toda PR fallará en `next build`*. Deshaz el cambio después.

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
