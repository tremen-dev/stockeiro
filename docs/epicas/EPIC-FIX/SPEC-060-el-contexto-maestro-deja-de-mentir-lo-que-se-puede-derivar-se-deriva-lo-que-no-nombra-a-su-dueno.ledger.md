---
id: SPEC-060
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-060 El contexto maestro deja de mentir: lo que se puede derivar se deriva, lo que no, nombra a su dueno

## Resumen
- Fase: **en-revision** — implementada el 2026-09-03 por sdd-implementador, con los **14 CA
  cubiertos** y **cero salvedades bloqueantes**. *(La fuente de verdad del estado es el
  frontmatter de la spec; la transición la registra el script del núcleo.)*
- Rama: `ft/SPEC-060-el-contexto-maestro-deja-de-mentir-lo-que-se-puede-derivar-se-deriva-lo-que-no-nombra-a-su-dueno`
- **Qué entra**: `docs/fundacion/contexto.md` deja de guardar copias de valores cuyo dueño
  es otro fichero (**ADR-040**). Tres afirmaciones pasan a **derivarse** con guardia que
  compara las dos mitades (versión del framework, existencia de las citas, valores de
  `DB_DRIVER`), tres pasan a **delegarse** nombrando a su dueño (`.env.example`,
  `docs/adr/`, `docs/tablero.md`) y el resto es prosa que se corrige y no se vigila.
- **Toca `src/`**: **un fichero y una condición** — `src/db/client.ts` (**CA-14**). Por eso
  la entrega **sube versión patch** (**CA-12**): `0.5.1` → `0.5.2`, con `package.json` y
  `package-lock.json` en el **mismo commit** (**ADR-033**).
- **Cero esquema, cero migración, cero comportamiento observable nuevo en producción**: con
  `DB_DRIVER` ausente —que es como corre allí— la rama nueva es inalcanzable.
- **Guardias nuevas en un solo par de ficheros y con sujeto único**: `tests/spec060-contexto-veraz.ts`
  (detectores + especímenes) y `tests/spec060-contexto-veraz.test.ts`, aplicadas **sólo** a
  `docs/fundacion/contexto.md` (**ADR-040** pto. 4). Ninguna barre `docs/fundacion/` ni
  `tests/` en bloque.
- **CA-14 lleva ese número a propósito** y está colocado junto a CA-3, que es donde se lee:
  entró en el gate cuando los otros trece ya se referenciaban entre sí. **No se renumeró
  nada.**

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `docs/fundacion/contexto.md` §«Stack y arquitectura»: *«Next.js 16 App Router (React 19)»* y *«Auth.js v5 (NextAuth beta)»* | `tests/spec060-contexto-veraz.ts` → `ALIAS_DE_PROSA`, `majoresDeclarados`, `versionesAfirmadas`, `desajustesDeVersion`, `VERSIONES_QUE_HAY_QUE_CAZAR`, `VERSIONES_LEGITIMAS`; `tests/spec060-contexto-veraz.test.ts` *«el detector caza las versiones que NO son las declaradas»*, *«y NO caza las buenas, ni el paquete sin número, ni el texto real del documento»*, *«el mapa de alias apunta a paquetes que package.json declara de verdad»*, *«el documento sigue nombrando su stack (centinela de no-vacuidad)»*, *«ninguna versión que el documento afirma difiere de la que declara package.json»* | Guardia **verde sobre el arbol** y **roja a mano**: mutar el documento real a `Next.js 15` y a `React 18` enciende *«ninguna version … difiere»* (una mutacion cada vez, revertida). Vaciar el documento enciende el **centinela de no-vacuidad**. Los 3 especimenes de «debe cazar» y los 7 de «no debe cazar» pasan, y estos ultimos son **no-vacuos**: sus gemelos con el numero malo si se cazan, luego el extractor extrae. Contrastado a mano contra `package.json` (`next ^16.2.10`, `react ^19.2.7`, `next-auth ^5.0.0-beta.31`) frente a lo que dice el documento: 16, 19 y v5. | ✅ |
| CA-2 | `docs/fundacion/contexto.md` entero: **todas** las rutas se reescriben enteras desde la raíz (`src/app/(auth)/`, `src/app/api/auth/[...nextauth]/route.ts`, `src/lib/auth/passwords.ts`…) y muere `src/middleware.ts`, que Next 16 renombró a `src/proxy.ts` | `tests/spec060-contexto-veraz.ts` → `rutasCitadas`, `identificadoresCitados`, `citasRotas`, `CITAS_QUE_HAY_QUE_CAZAR`, `CITAS_LEGITIMAS`; `tests/spec060-contexto-veraz.test.ts` *«el detector caza la ruta muerta y el identificador que nunca existió»*, *«y NO caza lo que existe, ni los comodines, ni lo que no es un fichero»*, *«el documento sigue citando rutas e identificadores (centinela de no-vacuidad)»*, *«el conjunto de citas rotas del documento está VACÍO»* | `citasRotas(contexto.md)` = **vacio**, verde; anadirle una cita a `src/middleware.ts` y a `ADR-013` lo pone **rojo**; documento vaciado -> **centinela** rojo. Revisado ademas a mano: todas las rutas se escriben **enteras desde la raiz** y existen (`src/proxy.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/cron/refresh/route.ts`, `design/tremen-ds`, `drizzle/`, `.env.example`…), y los identificadores `ADR-`/`SPEC-`/`EPIC-` citados corresponden a ficheros de `docs/`. | ✅ |
| CA-3 | `docs/fundacion/contexto.md` §«Cliente de datos INTERCAMBIABLE por `DB_DRIVER`»: los valores (`DB_DRIVER=neon`, `DB_DRIVER=pg`) y **los tres desenlaces en prosa**, incluido *«cualquier otro valor → falla al arrancar»* (cierto sólo tras CA-14, misma entrega) | `tests/spec060-contexto-veraz.ts` → `driversDelCodigo`, `driversDelDocumento`, `MODULO_CON_DOS_DRIVERS`, `MODULO_CON_TRES_DRIVERS`, `MODULO_SIN_DRIVERS`, `DOCUMENTO_DE_AYER`; `tests/spec060-contexto-veraz.test.ts` *«el extractor del código devuelve exactamente lo que el módulo reconoce»*, *«y devuelve null —no []— cuando no hay conjunto que leer (centinela)»*, *«el documento de AYER no coincide con el código: el par completo, en rojo»*, *«las dos mitades, derivadas, coinciden»* | Las dos mitades derivadas coinciden en `{neon, pg}` **sin un solo literal de driver en el test**. **Rojo a mano por los dos lados**: `DB_DRIVER=pg`->`postgres-js` en el documento lo enciende; hacer que **el modulo** reconozca un tercer valor lo enciende tambien —la guardia **sigue al codigo**, no a esta spec—; dejar el conjunto ilegible devuelve `null` y dispara el centinela en vez de comparar dos vacios. Pto. 2 (prosa, Nivel 3): el documento enuncia los **tres desenlaces** —ausente/`neon` -> Neon, `pg` -> Postgres estandar, cualquier otro -> falla al arrancar nombrando clave y fichero—, cierto solo tras CA-14, que va en la misma entrega. | ✅ |
| CA-4 | `docs/fundacion/contexto.md`: desaparece **la lista** de claves y en su lugar *«las declara `.env.example`, una a una, con su ADR y su porqué»*; sólo se nombran sueltas `CRON_SECRET` y `APP_BASE_URL`, donde la prosa explica una decisión | n-a a propósito (Nivel 2; **ADR-040** pto. 5 y FOUNDATION 1.er corolario: `.env.example` no lo lee ningún proceso, y la lista **ya tiene guardia en su dueño**, `tests/spec-031-frontera.test.ts` CA-13.3). Verificable por revisión del diff | Revision del diff: desaparece **la lista** (las dos claves de once) y queda *«las declara `.env.example`, una a una, con su ADR y su porque»*. Las unicas claves sueltas que quedan —`CRON_SECRET`, `APP_BASE_URL`, `DATABASE_URL`, `DB_DRIVER`— estan dentro de prosa que explica una decision, que es lo que el CA permite. La guardia del dueno (`tests/spec-031-frontera.test.ts` CA-13.3, contador en once) sigue verde en la bateria. | ✅ |
| CA-5 | `docs/fundacion/contexto.md` §«Ciclo diario, ya implementado»: `vercel.json`, `src/app/api/cron/refresh/route.ts`, `CRON_SECRET`, `cron_runs` (**ADR-023**), **ADR-004**/**ADR-039**/**SPEC-059** — y **ADR-038**, porque desde SPEC-058 el ciclo ya no es el único escritor de `quotes` | `tests/spec060-contexto-veraz.test.ts` *«no lleva ni una copia del schedule (ADR-039 pto. 8)»*, con el detector **ya existente** `copiasDelSchedule` de `tests/spec059-hora-del-ciclo.ts`. **Sin detector nuevo ni especímenes nuevos**: los dos sentidos ya los prueba SPEC-059 CA-5 y duplicarlos sería una segunda copia de la regla | `copiasDelSchedule(contexto.md)` = **vacio**, verde, con el detector **ya existente** de SPEC-059 (ni detector ni especimenes nuevos); meterle una copia (`0 6 * * *`) lo pone **rojo**. El documento describe el mecanismo que hay —`vercel.json`, `src/app/api/cron/refresh/route.ts`, `CRON_SECRET`, `cron_runs`/**ADR-023**, **ADR-004**/**ADR-039**/**SPEC-059** y **ADR-038**— **sin teclear la hora**. Sujeto unico comprobado: no barre `docs/fundacion/`, asi que no pisa la entrada en pasado de `dominio.md`. | ✅ |
| CA-6 | `docs/fundacion/contexto.md` §«Qué es Stockeiro»: desaparece toda afirmación de estado de spec o épica y se nombra al dueño (`docs/tablero.md`, el frontmatter, el ledger). Lo dice explícitamente: *«En qué punto está el proyecto no se cuenta aquí»* | n-a a propósito (**ADR-037** / **ADR-040** pto. 5: vigilarlo exigiría congelar prosa o enumerar `docs/epicas/`, y la mano roja sería la de cualquiera que trabaje en otra spec). Verificable por revisión del diff | Revision del diff: fuera *«EPIC-001 … en curso»*, *«SPEC-003 en `borrador`»* y *«Faltan por crear: Ingesta, Motor de disparo, Notificaciones y UI»*. El documento nombra al dueno (`docs/tablero.md`, el frontmatter, el ledger) y lo dice en una linea propia. Barrido del texto nuevo: no queda ninguna afirmacion de estado de spec ni de epica; las citas a SPEC-004/058/059/060 son hechos del sistema o atribucion, no estado. | ✅ |
| CA-7 | `docs/fundacion/contexto.md` §«Stack y arquitectura (resumen as-built)»: las diez rutas de `src/app/`, las trece capas de `src/lib/`, `src/db/schema.ts` **como dueño del esquema** (ninguna tabla enumerada, ninguna calificada de *nueva*), y los cuatro defectos que viven en esa sección corregidos (D-1, D-2, D-4, D-5) | n-a a propósito (**ADR-037**: exigir que toda carpeta de `src/lib/` aparezca nombrada sería enumerar un directorio que crece por mano ajena). El propio texto dice *«la lista orienta; el directorio manda»*. Verificable por revisión del diff | Revision del diff **contra el arbol**: las rutas de `src/app/` y las capas de `src/lib/` que el documento nombra existen todas (`ls src/app`, `ls src/lib`); `src/db/schema.ts` figura **como dueno del esquema** y no se enumera ni se califica de *nueva* ninguna tabla. El propio texto dice *«la lista orienta; el directorio manda»*, asi que no promete exhaustividad y no envejece porque nazca una carpeta. D-1, D-2, D-4 y D-5 quedan corregidos en esa misma seccion. | ✅ |
| CA-8 | `docs/fundacion/contexto.md` §«Riesgos y salvedades»: R-1 sube a as-built con sus ADR (**ADR-012**, **ADR-032**, **ADR-027**); R-2/R-3/R-4 **desaparecen como preguntas abiertas**; las salvedades se delegan al ledger de su spec y los riesgos de épica a `docs/epicas/`. Sólo se conservan las dos que afectan a cualquiera hoy: `DATABASE_URL` compartida (`F-SPEC-023-1`) y el aislamiento en capa de app | n-a a propósito (mismo motivo que CA-6). Verificable por revisión del diff | Revision del diff: R-1 sube a as-built en la seccion de arquitectura con **ADR-012**, **ADR-032** y **ADR-027**; **R-2/R-3/R-4 desaparecen** como preguntas abiertas; las salvedades se delegan al ledger de su spec y los riesgos de epica a `docs/epicas/`. Solo se conservan las dos que afectan a cualquiera hoy (`F-SPEC-023-1` y el aislamiento en capa de app). No queda ninguna pregunta cerrada presentada como abierta. | ✅ |
| CA-9 | `tests/spec043-sin-refrescar.test.ts` (comentario del caso *«un cron que llega unas horas tarde NO dispara la marca»*), `tests/spec058-alta-con-precio.test.ts:302` y `tests/e2e/spec058-alta-con-precio.spec.ts:82` — los tres describen ahora **la cadencia**, no la hora | Los tres tests **siguen verdes sin que cambie una sola aserción**: `npm test` 1970/1970 y `npm run test:e2e` 325/325. **Sin guardia** y con el motivo medido (**ADR-037**: `tests/ops-snapshot.test.ts`, `tests/e2e/admin-grifo.spec.ts` y `tests/spec059-hora-del-ciclo.ts` serían tres inocentes) | Diff de los tres ficheros, linea a linea: **tres comentarios, cero aserciones tocadas**. Los tres siguen verdes dentro de `npm test` **1970/1970** y `npm run test:e2e` **325/325**. Barrido propio de `22:00` sobre `tests/`: quedan exactamente los **tres inocentes** que la spec predijo —fixtures de `ops-snapshot.test.ts` y `e2e/admin-grifo.spec.ts`, y el especimen de `spec059-hora-del-ciclo.ts`—, ninguno de ellos un rotulo caducado. | ✅ |
| CA-10 | Nada. **El diff de la rama no toca** ledgers cerrados, ADR ajenos, `docs/fundacion/dominio.md`, `docs/roadmap.md` ni `vercel.json` | n-a a propósito (**RI-03**, criterio de gate; enumerar en un test los ficheros intocables es lo que **ADR-037** documenta como cero defectos cazados). Verificado con `git diff --name-only origin/main...HEAD`; la lista completa está abajo en «El diff de la rama, fichero a fichero» | `git diff --name-only origin/main...HEAD` = **13 ficheros**, todos con CA detras. **No aparece**: ningun ledger ajeno, ningun ADR salvo el que nace con la spec (`ADR-040`, en el commit del arquitecto `32bd00b`), ni `docs/fundacion/dominio.md`, ni `docs/roadmap.md`, ni `vercel.json` (comprobado: sigue en `0 6 * * *`), ni un solo fichero de `_qa/`. Las capturas que la e2e reescribio durante esta verificacion se restauraron con `git checkout -- _qa/`; el arbol queda limpio. | ✅ |
| CA-11 | `docs/epicas/EPIC-008-el-precio-al-momento-la-vigilada-recien-dada-de-alta-no-espera-al-ciclo/_epica.md`: marcador explícito *«esto describe el estado ANTES de SPEC-058»*, verbos en pasado y la hora nombrada por su dueño (`vercel.json`). **El análisis no se reescribe y la cita del usuario no se toca** | n-a a propósito (mismo motivo que CA-6). Verificable por revisión del diff. **Permiso del gate del 2026-09-03** para tocar un fichero de sdd-producto, igual que SPEC-059 CA-9 | Diff del `_epica.md`: marcador explicito *«describe el estado **ANTES** de SPEC-058»*, verbos en pasado, la hora **nombrada por su dueno** (`vercel.json`) en vez del literal, la **cita del usuario intacta** y el analisis no reescrito — que es exactamente lo que el CA autoriza, con el permiso del gate del 2026-09-03. **Alcance revisado y aceptado**: ademas del parrafo que el CA nombra se corrigieron dos lineas del §Objetivo con **las mismas dos falsedades** (la hora y la unicidad del escritor); esta declarado, cae dentro del titulo literal del CA y dejarlo habria dejado el documento contradiciendose tres parrafos por encima de su propia cura. Nada mas de ese fichero se toca; el `R-3` queda fuera y anotado como `F-SPEC-060-1`. | ✅ |
| CA-12 | `package.json` + `package-lock.json`: `0.5.1` → `0.5.2` (**patch**), los dos en el **mismo commit** que `src/db/client.ts` (`125215c`) | `npm run version:check` **con el bump ya commiteado**: *«La versión sube de 0.5.1 a 0.5.2»*. La propiedad de los dos ficheros la vigila `tests/version-en-los-dos-ficheros.test.ts` (SPEC-053 CA-1), verde en la batería | `npm run version:check` **con el arbol limpio** —`git status --porcelain` vacio, comprobado justo antes (SPEC-049: sobre arbol sucio se abstiene)—: *«La version sube de 0.5.1 a 0.5.2»*. Es **patch**, y `package.json` + `package-lock.json` viajan en el **mismo commit** que `src/db/client.ts` (`125215c`), comprobado con `git log --reverse` por fichero (**ADR-033**). | ✅ |
| CA-13 | `docs/fundacion/contexto.md` §«Dónde vive cada verdad»: tabla de trece dueños, justo bajo la cabecera, con la instrucción delante — *«antes de escribir aquí un valor, mira si su dueño ya lo dice»* | Sus rutas quedan cubiertas por **CA-2** (`citasRotas` las comprueba una a una contra el árbol). El mapa en sí es prosa y **no lleva guardia propia** | El documento abre con **«Donde vive cada verdad»**: tabla de **trece duenos** justo bajo la cabecera y con la instruccion delante (*«antes de escribir aqui un valor, mira si su dueno ya lo dice»*). Cubre los **ocho** que el CA exige (estado, censo de ADR, claves, esquema, hora y cadencia, version, reglas, terminos) y anade cinco mas. Sus rutas pasan por `citasRotas` y existen todas. | ✅ |
| CA-14 | `src/db/client.ts`: `DRIVERS_RECONOCIDOS` (único sitio del módulo donde vive el conjunto) + `resolverDriver()`. Ausente y cadena vacía → `neon`; `pg` → sin cambio; presente y no reconocido → **lanza**, con la clave, el valor delimitado, los valores reconocidos —tomados del mismo sitio que la decisión— y dónde mirar | `tests/spec060-contexto-veraz.test.ts` *«la variable ausente sigue significando el driver por defecto (ni una diferencia)»*, *«los valores reconocidos se comportan como hoy»*, *«un valor presente y no reconocido LANZA, y el mensaje trae las cuatro cosas»* (especímenes del CA: `postgres-js`, `neon-http`, `postgress`, `PG`), *«los valores reconocidos del mensaje salen del MISMO sitio que la decisión»*. La rama `pg` la ejerce el e2e de verdad (`tests/e2e/server.mjs`, único sitio del repositorio que define la variable): **325/325 sin tocar una línea** | **Ejercido en la aplicacion, no solo en el test, y en los tres sentidos.** (1) **Ausente**: `npm run build` sin `DB_DRIVER` -> **exit 0** (el modulo se importa durante el build, luego la rama por defecto queda ejercida) y la app sirve `/login` con **HTTP 200**. (2) **`pg`**: build **fresco** + `npm run test:e2e` -> **325/325 en 5,3 min**, sin tocar una linea de test; el `.next` se reconstruyo a proposito, porque `next start` sobre un build viejo da un verde que no corresponde al codigo (el CI hace `Build` antes de `E2E` por lo mismo). (3) **No reconocido**: `DB_DRIVER=postgres-js npm run build` -> **exit 1**, `Build error occurred`, con el mensaje entero: clave, valor delimitado «postgres-js», los reconocidos `neon` o `pg`, y `.env.example` + `src/db/client.ts`. Es el *fail-closed* que la spec prometia, comprobado en el pipeline real. **Mutaciones**: devolver el fallback silencioso enciende *«un valor presente y no reconocido LANZA»*; volver ilegible el conjunto enciende *«los valores reconocidos del mensaje salen del MISMO sitio que la decision»* y la mitad de codigo de CA-3. Diff acotado: **un fichero de `src/`, una condicion** — no se toca la forma de conectar, ni los parametros de `postgres()`, ni se anade driver. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-09-03, sdd-verificador. Los 14 CA en ✅, cero salvedades bloqueantes.**

**Gates, todos sobre esta rama:**

| Gate | Resultado |
|---|---|
| `npm run typecheck` | verde |
| `npm run lint` | verde (`--max-warnings=0`) |
| `npm test` | **1970/1970**, 122 ficheros |
| `npm run build` (sin `DB_DRIVER`) | **exit 0** |
| `npm run test:e2e` sobre build **fresco** | **325/325** (5,3 min) |
| `npm run build` con `DB_DRIVER=postgres-js` | **exit 1**, rechazo con sujeto — control positivo de CA-14 |
| `npm run version:check` (árbol limpio) | *«La versión sube de 0.5.1 a 0.5.2»* |
| `valida.mjs` del núcleo | `[valida] OK` |
| `git diff --name-only origin/main...HEAD` | 13 ficheros, ninguno prohibido (CA-10) |

**Lo que se juzgó y no se dio por bueno:**

- **Las guardias se pusieron rojas a mano, una a una** (ocho mutaciones, cada una revertida con
  `git checkout --`): las cuatro del documento (`Next.js 15`, `React 18`, cita a
  `src/middleware.ts`, `DB_DRIVER=postgres-js`), la copia del `schedule`, el documento vaciado
  —saltan los **tres centinelas** de no-vacuidad— y **dos sobre `src/db/client.ts`**: quitar el
  rechazo y volver ilegible el conjunto. Ninguna guardia da verde por vacío y ninguna teclea el
  valor que vigila.
- **La mutación del módulo confirma lo que más importa de CA-3**: al hacer que el **código**
  reconozca un driver más, la guardia se enciende porque el **documento** dejó de decir la
  verdad. Sigue al código, no a esta spec.
- **CA-14 se ejerció en la aplicación**, en los dos sentidos y sin arnés propio: variable
  ausente (build verde y `/login` HTTP 200), `pg` (e2e completa verde) y valor envenenado
  (build roto con el mensaje entero). Los dos casos que **no** debían cambiar, no cambiaron.
- **Los especímenes de «no debe cazar» de CA-1 son no-vacuos**: sus gemelos con el número malo
  sí se cazan, luego el extractor está extrayendo y el verde no es por no mirar. `ADR-020`,
  `D-7`, `RN-16`, `SPEC-023`, `10.000/mes`, `30 min` y `~82%` pasan limpios, que es el pisón
  que SPEC-059 pagó y aquí no se da.

**Constancia de método, para quien repita la verificación** (no es un defecto de la entrega):

- `npm run test:e2e` **no construye**: `tests/e2e/server.mjs` levanta `next start` sobre el
  `.next` que haya. En esta máquina había uno del **2026-08-25**, anterior a `125215c`; correr
  la e2e sin reconstruir habría dado 325/325 **sin ejercer una línea de CA-14**. El CI hace
  `Build` antes de `E2E` por este mismo motivo, y así se hizo aquí.
- Dos pasadas intermedias dieron 8 y 5 rojos, **todos** `page.waitForURL` agotando el timeout en
  los últimos tests. La causa es del entorno, no del código: al encadenar pasadas quedó viva
  una instancia de `embedded-postgres` sobre `.pg-e2e`, la base efímera se reusó y el **cupo de
  50 cuentas** del grifo (`src/lib/registration/gate.ts`, ADR-023 pto. 7) se agotó, con lo que
  los registros del final ya no entraban. Borrando `.pg-e2e` y sin procesos huérfanos, la pasada
  limpia es **325/325**. Si vuelve a aparecer, es esto.

**Salvedades**: las tres del implementador (`F-SPEC-060-1`, `-2`, `-3`) están declaradas, ninguna
bloquea y ninguna contradice un CA. Se acepta también, revisada y por escrito, la ampliación de
alcance de **CA-11** al §Objetivo del `_epica.md` (ver su celda).

**Observación menor, sin efecto** (queda anotada, no exige cambio): entre los especímenes «no
debe cazar» de CA-1 la spec escribe `2026-08-23` y el módulo transcribe `2026-08-18` —misma
forma, otra fecha—; y `10.000/mes` / `~82%` ya no son texto del documento corregido, sino del
anterior. La propiedad que importa se comprueba igual sobre el documento real, que sí lleva
`2026-08-23`, y el conjunto sale vacío.

**RI-02 sigue vivo**: `hecho` exige merge en `main` **y** despliegue vivo. Aquí pesa más que de
costumbre porque lo que cambia es el arranque; con `DB_DRIVER` ausente —que es como corre
producción: no está en `vercel.json`, ni en `.github/`, y en `.env.example` está comentada— la
rama nueva es inalcanzable, y el build de esta rama con la variable ausente ya salió verde.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-060/. Informe HTML opcional: _qa/SPEC-060/informe.html -->

**No aplica**: la entrega no cambia ninguna pantalla. Lo que toca es un documento de
fundación, un `_epica.md`, tres comentarios de test y una condición de arranque.

> **Aviso para quien verifique**: la e2e completa **reescribe las capturas de `_qa/` de
> otras specs** (223 ficheros en esta pasada). Se restauraron con `git checkout -- _qa/`
> antes de commitear, y el diff de la rama **no lleva ni una**.

## Salvedades / follow-ups

- **F-SPEC-060-1** (destino: **EPIC-FIX**, próximo lote de rótulos, **ADR-025**). En
  `docs/epicas/EPIC-008-…/_epica.md`, el riesgo **R-3** ilustra el desacompasamiento entre
  pantalla y correo con *«ver “En compra” a las 10:00 y recibir el aviso a las 22:00»*:
  la segunda hora es la del cron viejo. **Queda fuera de CA-11 a propósito** — CA-11 tiene
  por sujeto el párrafo de *«El único refresco…»* y su objetivo, y el R-3 es un **ejemplo
  dentro del análisis de riesgos de sdd-producto**, que la spec prohíbe reescribir. No es
  falso de lo que afirma (que van desacompasados) y no bloquea nada.
- **F-SPEC-060-2** (destino: **EPIC-FIX** o **EPIC-MEJORA**, a triar). `docs/despliegue.md`
  §«Variables» lleva una **tercera copia** de los valores de `DB_DRIVER` (*«`neon` en
  producción (por defecto)»*). Hoy es cierta, pero es exactamente la clase de copia que
  **ADR-040** viene a evitar, y ahora que `src/db/client.ts` tiene un sitio del que
  derivarla, es barata de curar. **Fuera del alcance de esta spec**, que declara sujeto
  único `contexto.md`.
- **F-SPEC-060-3** (destino: spec propia). `docs/fundacion/dominio.md`, `reglas.md` y
  `vision.md` **no se han medido con esta vara**. Puede haber ahí el mismo mal; la spec lo
  aparca por escrito y **ADR-040** pto. 8 dice que no obliga a retro-auditarlos. Se anota
  para que sea un residual con nombre y no un olvido.
- **Salvedad de alcance en CA-11, declarada y no escondida.** Además del párrafo que el CA
  nombra, se corrigieron **dos líneas del §Objetivo** de ese mismo `_epica.md`, que decían
  *«hasta las 22:00»* y *«hasta hoy el único camino… es el ciclo diario»* — las **mismas
  dos falsedades**, en presente, tres párrafos más arriba del marcador. Dejarlas habría
  dejado el documento contradiciéndose consigo mismo justo encima de la cura. El título del
  CA es literal: *«EPIC-008 deja de afirmar en presente lo que ya no es verdad»*.

## El diff de la rama, fichero a fichero (CA-10)

`git diff --name-only origin/main...HEAD`, con el porqué de cada uno:

| Fichero | Quién lo pide |
|---|---|
| `docs/adr/ADR-040-…md` | la decisión de gobierno, escrita por sdd-arquitecto antes de esta sesión |
| `docs/epicas/EPIC-FIX/SPEC-060-….md` | la spec y sus transiciones de estado |
| `docs/epicas/EPIC-FIX/SPEC-060-….ledger.md` | este ledger |
| `docs/fundacion/contexto.md` | CA-1…CA-8, CA-13 |
| `docs/epicas/EPIC-008-…/_epica.md` | CA-11 (con permiso del gate) |
| `src/db/client.ts` | CA-14 — **un fichero, una condición** |
| `package.json`, `package-lock.json` | CA-12 |
| `tests/spec060-contexto-veraz.ts`, `tests/spec060-contexto-veraz.test.ts` | las guardias de CA-1, CA-2, CA-3, CA-5 y CA-14 |
| `tests/spec043-sin-refrescar.test.ts`, `tests/spec058-alta-con-precio.test.ts`, `tests/e2e/spec058-alta-con-precio.spec.ts` | CA-9, tres comentarios |

**Lo que NO está, y es la mitad del criterio**: ningún ledger cerrado, ningún ADR salvo el
que nace con la spec, `docs/fundacion/dominio.md`, `docs/roadmap.md`, `vercel.json` y
`_qa/`.

## Las guardias, puestas rojas a mano (los dos sentidos sobre el árbol real)

Los especímenes sintéticos prueban los detectores; esto prueba que **la guardia aplicada al
árbol se enciende**. Cinco mutaciones, cada una revertida después:

| Mutación | Qué se pone rojo |
|---|---|
| `contexto.md`: `Next.js 16` → `Next.js 15` | CA-1 *«ninguna versión … difiere»* |
| `contexto.md`: `React 19` → `React 18` | CA-1 *«ninguna versión … difiere»* |
| `contexto.md`: se le añade una cita a `src/middleware.ts` | CA-2 *«el conjunto de citas rotas … está VACÍO»* |
| `contexto.md`: `DB_DRIVER=pg` → `DB_DRIVER=postgres-js` | CA-3 *«las dos mitades, derivadas, coinciden»* |
| **`src/db/client.ts`**: `DRIVERS_RECONOCIDOS` pasa a reconocer un tercer valor | CA-3 *«las dos mitades…»* **y** CA-14 *«un valor presente y no reconocido LANZA»* |
| `contexto.md`: se le mete una copia del `schedule` | CA-5 *«no lleva ni una copia del schedule»* |

La quinta es la que enseña que la guardia **sigue al código y no a esta spec**: al hacer
que el módulo reconozca un driver más, el par se pone rojo porque el **documento** dejó de
decir la verdad, y el espécimen de CA-14 se pone rojo porque ese valor **ya no** debe ser
rechazado. Ninguna de las dos mitades estaba tecleada en el test.

## Verificación ejecutada

| Gate | Resultado |
|---|---|
| `npm run typecheck` | verde |
| `npm run lint` | verde (`--max-warnings=0`) |
| `npm test` | **1970/1970**, 122 ficheros |
| `npm run test:e2e` | **325/325** — incluye la rama `pg` de CA-14 |
| `npm run version:check` | *«La versión sube de 0.5.1 a 0.5.2»*, con el bump **ya commiteado** (**SPEC-049**: sobre árbol sucio se abstiene, y un verde de abstención no es un verde) |
| `git diff --name-only origin/main...HEAD` | trece ficheros, todos con CA detrás (CA-10) |

## Cómo retomar (handoff)

**Está todo hecho y commiteado en la rama; falta la verificación y el merge.** Cuatro
commits, ninguno pusheado:

1. `125215c` — **CA-14 + CA-12**: `src/db/client.ts` (`DRIVERS_RECONOCIDOS` + `resolverDriver`)
   y el bump `0.5.1` → `0.5.2` en `package.json` + `package-lock.json`.
2. `5d1c4bb` — **CA-1…CA-8, CA-13**: `docs/fundacion/contexto.md` reescrito y las guardias
   nuevas (`tests/spec060-contexto-veraz.ts` + `.test.ts`).
3. `e468676` — **CA-9**: los tres rótulos de `tests/`.
4. `b65247d` — **CA-11**: el `_epica.md` de EPIC-008.

**Qué mirar primero al verificar**, por orden de riesgo:

- **CA-14 y el arranque.** La rama nueva es inalcanzable en producción porque allí
  `DB_DRIVER` no está definida (el único sitio del repositorio que la define es
  `tests/e2e/server.mjs`). Si el despliegue vive, CA-14 pto. 1 se cumplió. Ojo a la
  decisión de diseño escrita en el módulo: **la cadena vacía cuenta como ausente** —no
  expresa ninguna intención— y **nada se normaliza**: `PG` se rechaza igual que `postgress`.
- **Los ocho especímenes de «no debe cazar» de CA-1** son **texto real del documento
  vigilado** (`ADR-020`, `D-7`, `RN-16`, `SPEC-023`, `10.000/mes`, `30 min`, `~82%`,
  `2026-08-23`). Son la parte que de verdad hay que revisar: son lo que un detector de
  «nombre + número» en bruto acusaría, y es el pisotón que ya pagó SPEC-059.
- **CA-3 pto. 2 y CA-14 no se pueden separar.** El documento describe **tres** desenlaces
  porque el código tiene tres desde `125215c`. Revertir uno deja al otro mintiendo, ahora
  al revés.
- **Las tres salvedades** de arriba están abiertas a propósito y ninguna bloquea.

**Cómo poner las guardias rojas** (para comprobarlo en vez de fiarse): las seis mutaciones
de la tabla de arriba, cada una de una línea, revertibles con
`git checkout -- docs/fundacion/contexto.md` o `git checkout -- src/db/client.ts`.

**Trampa conocida de este repo**: la e2e completa reescribe las capturas de `_qa/` de otras
specs. Si aparecen modificadas, `git checkout -- _qa/` — esta spec no genera evidencia
visual y su diff no lleva ninguna.
