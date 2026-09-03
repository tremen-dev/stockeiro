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
| CA-1 | `docs/fundacion/contexto.md` §«Stack y arquitectura»: *«Next.js 16 App Router (React 19)»* y *«Auth.js v5 (NextAuth beta)»* | `tests/spec060-contexto-veraz.ts` → `ALIAS_DE_PROSA`, `majoresDeclarados`, `versionesAfirmadas`, `desajustesDeVersion`, `VERSIONES_QUE_HAY_QUE_CAZAR`, `VERSIONES_LEGITIMAS`; `tests/spec060-contexto-veraz.test.ts` *«el detector caza las versiones que NO son las declaradas»*, *«y NO caza las buenas, ni el paquete sin número, ni el texto real del documento»*, *«el mapa de alias apunta a paquetes que package.json declara de verdad»*, *«el documento sigue nombrando su stack (centinela de no-vacuidad)»*, *«ninguna versión que el documento afirma difiere de la que declara package.json»* | | ❌ |
| CA-2 | `docs/fundacion/contexto.md` entero: **todas** las rutas se reescriben enteras desde la raíz (`src/app/(auth)/`, `src/app/api/auth/[...nextauth]/route.ts`, `src/lib/auth/passwords.ts`…) y muere `src/middleware.ts`, que Next 16 renombró a `src/proxy.ts` | `tests/spec060-contexto-veraz.ts` → `rutasCitadas`, `identificadoresCitados`, `citasRotas`, `CITAS_QUE_HAY_QUE_CAZAR`, `CITAS_LEGITIMAS`; `tests/spec060-contexto-veraz.test.ts` *«el detector caza la ruta muerta y el identificador que nunca existió»*, *«y NO caza lo que existe, ni los comodines, ni lo que no es un fichero»*, *«el documento sigue citando rutas e identificadores (centinela de no-vacuidad)»*, *«el conjunto de citas rotas del documento está VACÍO»* | | ❌ |
| CA-3 | `docs/fundacion/contexto.md` §«Cliente de datos INTERCAMBIABLE por `DB_DRIVER`»: los valores (`DB_DRIVER=neon`, `DB_DRIVER=pg`) y **los tres desenlaces en prosa**, incluido *«cualquier otro valor → falla al arrancar»* (cierto sólo tras CA-14, misma entrega) | `tests/spec060-contexto-veraz.ts` → `driversDelCodigo`, `driversDelDocumento`, `MODULO_CON_DOS_DRIVERS`, `MODULO_CON_TRES_DRIVERS`, `MODULO_SIN_DRIVERS`, `DOCUMENTO_DE_AYER`; `tests/spec060-contexto-veraz.test.ts` *«el extractor del código devuelve exactamente lo que el módulo reconoce»*, *«y devuelve null —no []— cuando no hay conjunto que leer (centinela)»*, *«el documento de AYER no coincide con el código: el par completo, en rojo»*, *«las dos mitades, derivadas, coinciden»* | | ❌ |
| CA-4 | `docs/fundacion/contexto.md`: desaparece **la lista** de claves y en su lugar *«las declara `.env.example`, una a una, con su ADR y su porqué»*; sólo se nombran sueltas `CRON_SECRET` y `APP_BASE_URL`, donde la prosa explica una decisión | n-a a propósito (Nivel 2; **ADR-040** pto. 5 y FOUNDATION 1.er corolario: `.env.example` no lo lee ningún proceso, y la lista **ya tiene guardia en su dueño**, `tests/spec-031-frontera.test.ts` CA-13.3). Verificable por revisión del diff | | ❌ |
| CA-5 | `docs/fundacion/contexto.md` §«Ciclo diario, ya implementado»: `vercel.json`, `src/app/api/cron/refresh/route.ts`, `CRON_SECRET`, `cron_runs` (**ADR-023**), **ADR-004**/**ADR-039**/**SPEC-059** — y **ADR-038**, porque desde SPEC-058 el ciclo ya no es el único escritor de `quotes` | `tests/spec060-contexto-veraz.test.ts` *«no lleva ni una copia del schedule (ADR-039 pto. 8)»*, con el detector **ya existente** `copiasDelSchedule` de `tests/spec059-hora-del-ciclo.ts`. **Sin detector nuevo ni especímenes nuevos**: los dos sentidos ya los prueba SPEC-059 CA-5 y duplicarlos sería una segunda copia de la regla | | ❌ |
| CA-6 | `docs/fundacion/contexto.md` §«Qué es Stockeiro»: desaparece toda afirmación de estado de spec o épica y se nombra al dueño (`docs/tablero.md`, el frontmatter, el ledger). Lo dice explícitamente: *«En qué punto está el proyecto no se cuenta aquí»* | n-a a propósito (**ADR-037** / **ADR-040** pto. 5: vigilarlo exigiría congelar prosa o enumerar `docs/epicas/`, y la mano roja sería la de cualquiera que trabaje en otra spec). Verificable por revisión del diff | | ❌ |
| CA-7 | `docs/fundacion/contexto.md` §«Stack y arquitectura (resumen as-built)»: las diez rutas de `src/app/`, las trece capas de `src/lib/`, `src/db/schema.ts` **como dueño del esquema** (ninguna tabla enumerada, ninguna calificada de *nueva*), y los cuatro defectos que viven en esa sección corregidos (D-1, D-2, D-4, D-5) | n-a a propósito (**ADR-037**: exigir que toda carpeta de `src/lib/` aparezca nombrada sería enumerar un directorio que crece por mano ajena). El propio texto dice *«la lista orienta; el directorio manda»*. Verificable por revisión del diff | | ❌ |
| CA-8 | `docs/fundacion/contexto.md` §«Riesgos y salvedades»: R-1 sube a as-built con sus ADR (**ADR-012**, **ADR-032**, **ADR-027**); R-2/R-3/R-4 **desaparecen como preguntas abiertas**; las salvedades se delegan al ledger de su spec y los riesgos de épica a `docs/epicas/`. Sólo se conservan las dos que afectan a cualquiera hoy: `DATABASE_URL` compartida (`F-SPEC-023-1`) y el aislamiento en capa de app | n-a a propósito (mismo motivo que CA-6). Verificable por revisión del diff | | ❌ |
| CA-9 | `tests/spec043-sin-refrescar.test.ts` (comentario del caso *«un cron que llega unas horas tarde NO dispara la marca»*), `tests/spec058-alta-con-precio.test.ts:302` y `tests/e2e/spec058-alta-con-precio.spec.ts:82` — los tres describen ahora **la cadencia**, no la hora | Los tres tests **siguen verdes sin que cambie una sola aserción**: `npm test` 1970/1970 y `npm run test:e2e` 325/325. **Sin guardia** y con el motivo medido (**ADR-037**: `tests/ops-snapshot.test.ts`, `tests/e2e/admin-grifo.spec.ts` y `tests/spec059-hora-del-ciclo.ts` serían tres inocentes) | | ❌ |
| CA-10 | Nada. **El diff de la rama no toca** ledgers cerrados, ADR ajenos, `docs/fundacion/dominio.md`, `docs/roadmap.md` ni `vercel.json` | n-a a propósito (**RI-03**, criterio de gate; enumerar en un test los ficheros intocables es lo que **ADR-037** documenta como cero defectos cazados). Verificado con `git diff --name-only origin/main...HEAD`; la lista completa está abajo en «El diff de la rama, fichero a fichero» | | ❌ |
| CA-11 | `docs/epicas/EPIC-008-el-precio-al-momento-la-vigilada-recien-dada-de-alta-no-espera-al-ciclo/_epica.md`: marcador explícito *«esto describe el estado ANTES de SPEC-058»*, verbos en pasado y la hora nombrada por su dueño (`vercel.json`). **El análisis no se reescribe y la cita del usuario no se toca** | n-a a propósito (mismo motivo que CA-6). Verificable por revisión del diff. **Permiso del gate del 2026-09-03** para tocar un fichero de sdd-producto, igual que SPEC-059 CA-9 | | ❌ |
| CA-12 | `package.json` + `package-lock.json`: `0.5.1` → `0.5.2` (**patch**), los dos en el **mismo commit** que `src/db/client.ts` (`125215c`) | `npm run version:check` **con el bump ya commiteado**: *«La versión sube de 0.5.1 a 0.5.2»*. La propiedad de los dos ficheros la vigila `tests/version-en-los-dos-ficheros.test.ts` (SPEC-053 CA-1), verde en la batería | | ❌ |
| CA-13 | `docs/fundacion/contexto.md` §«Dónde vive cada verdad»: tabla de trece dueños, justo bajo la cabecera, con la instrucción delante — *«antes de escribir aquí un valor, mira si su dueño ya lo dice»* | Sus rutas quedan cubiertas por **CA-2** (`citasRotas` las comprueba una a una contra el árbol). El mapa en sí es prosa y **no lleva guardia propia** | | ❌ |
| CA-14 | `src/db/client.ts`: `DRIVERS_RECONOCIDOS` (único sitio del módulo donde vive el conjunto) + `resolverDriver()`. Ausente y cadena vacía → `neon`; `pg` → sin cambio; presente y no reconocido → **lanza**, con la clave, el valor delimitado, los valores reconocidos —tomados del mismo sitio que la decisión— y dónde mirar | `tests/spec060-contexto-veraz.test.ts` *«la variable ausente sigue significando el driver por defecto (ni una diferencia)»*, *«los valores reconocidos se comportan como hoy»*, *«un valor presente y no reconocido LANZA, y el mensaje trae las cuatro cosas»* (especímenes del CA: `postgres-js`, `neon-http`, `postgress`, `PG`), *«los valores reconocidos del mensaje salen del MISMO sitio que la decisión»*. La rama `pg` la ejerce el e2e de verdad (`tests/e2e/server.mjs`, único sitio del repositorio que define la variable): **325/325 sin tocar una línea** | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

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
