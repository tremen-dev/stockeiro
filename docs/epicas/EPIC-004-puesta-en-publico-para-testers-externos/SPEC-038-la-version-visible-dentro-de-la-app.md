---
id: SPEC-038
tipo: spec
epica: EPIC-004
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
---
# SPEC-038 — La versión visible dentro de la app

## Problema

**La app ya sabe qué despliegue es, pero solo se lo cuenta a las máquinas, y en un idioma que
ningún tester va a usar.** SPEC-031 dejó `/api/version` respondiendo
`{commit, environment, builtAt}` desde `deploymentIdentity`
(`src/lib/version/identity.ts`), y `scripts/check-alive.mjs` lo consume para la puerta
post-despliegue (**ADR-018**, **RI-02**). Dentro de la interfaz **no aparece por ningún
lado**: ni en el pie, ni en el panel, ni en ninguna pantalla.

Mientras el único usuario era el autor, eso bastaba: `curl` al endpoint y listo. Con testers
externos deja de bastar, y por un motivo muy concreto: **el bucle de feedback**. Alguien
escribe en el hilo *"a mí no me sale el precio de ITX"* y lo primero que hace falta saber es
**qué versión estaba viendo**.

**CE-3** lo formula sin ambigüedad: *"Cualquiera lee dentro de la app la versión que está
usando, y ese dato **coincide** con lo que responde `/api/version`"*.

El problema tiene tres trampas, y la tercera es la que decidió el humano:

1. **Duplicar la fuente de verdad.** Lo fácil es leer `process.env` otra vez, o enseñar un
   número que solo vive en la interfaz. Cualquiera de las dos abre la puerta a que la app
   diga una cosa y el endpoint otra — que es exactamente lo que CE-3 prohíbe, y lo que
   convertiría la puerta de despliegue de **RI-02** en teatro.
2. **Romper lo que SPEC-031 protegió.** `/api/version` **debe poder responder con la base de
   datos caída** (CA-5 de SPEC-031), y `tests/version-import-graph.test.ts` lo vigila. Meter
   la presentación por el sitio equivocado es la forma más fácil de arrastrar medio proyecto
   a ese grafo de imports sin darse cuenta.
3. **Qué número se enseña.** Yo propuse *"el commit ES la versión"*, porque este proyecto
   **despliega continuamente desde `main`** (**ADR-018**) y no hay releases que numerar. El
   humano lo rechazó en el gate del 2026-08-19 con un argumento de uso que acepto entero:
   **un tester que reporta un fallo en un hilo de foro cita una versión, no un SHA** —y el
   que lo intente, lo copiará mal—. Elegió **semver visible**, asumiendo el coste que yo
   había avisado: para que no haya dos verdades, **`/api/version` tiene que servirlo
   también**, y eso enmienda el punto **D-6 de ADR-018**. Se registra en **ADR-024**.

Y hay una cuarta trampa que este veredicto abre y que hay que cerrar aquí: **un número que
alguien tiene que acordarse de subir a mano acaba congelado**. Un `0.1.0` inmóvil durante seis
meses miente más que no tener número, porque afirma una identidad estable sobre artefactos
distintos. Por eso el bump **se exige en CI** (**ADR-024** ptos. 9 y 10).

Reglas en juego: **RN-03** (la versión se lee **también sin sesión**: es un dato del
artefacto, no del usuario) y **RI-02** (*"hecho significa vivo"*), cuyo mecanismo es
precisamente `/api/version` y que esta spec **no puede romper**.

## Usuarios / roles afectados

- **Tester que reporta algo raro**: copia `v0.3.0` y lo pega en su mensaje. No necesita saber
  qué es un commit ni abrir una terminal.
- **Operador**: al leer un reporte sabe **contra qué código** se produjo. El semver le da el
  vocabulario y el commit, que sigue ahí, la precisión.
- **Cualquiera, con o sin sesión**: la versión está en el pie de las páginas públicas también
  — incluidas las legales de **SPEC-035** y `/login`.
- **Quien se encuentre un despliegue sin identidad**: lee **`desconocida`**, no un hueco.
  Eso **es la alarma** (SPEC-031).
- **Quien abra una PR de código**: tendrá que subir el número, o la CI se lo recordará
  (**ADR-024** pto. 9). Es fricción nueva y deliberada.

## Criterios de aceptación

Cada CA es verificable con un test: el formato con **Vitest** (función pura), la coincidencia
y la presencia con **Playwright**, y las fronteras (grafo de imports, canal de build, gate de
CI) con el mismo estilo de prueba que ya usan `tests/version-import-graph.test.ts` y
`tests/spec-031-frontera.test.ts`.

- **CA-1 (La versión se ve, con sesión y sin ella — CE-3).**
  Dado el pie compartido,
  cuando se renderiza **cualquier** página —`/login`, `/legal/terminos`, `/dashboard`,
  `/vigiladas`—,
  entonces la versión del despliegue aparece en él, y aparece igual para un visitante
  anónimo que para un usuario autenticado.

- **CA-2 (El número que se enseña es el semver, y es citable — CE-3, ADR-024 pto. 1).**
  Dado el pie,
  cuando se lee,
  entonces muestra la versión de producto en formato `vMAJOR.MINOR.PATCH` **en primer
  lugar** —es lo que el tester va a copiar— acompañada del **commit abreviado** y de la fecha
  de construcción. El texto es **seleccionable y copiable**, no una imagen ni un tooltip.

- **CA-3 (`/api/version` sirve el semver — ADR-024 ptos. 1 y 2).**
  Dado el endpoint,
  cuando se pide,
  entonces responde **exactamente** `{version, commit, environment, builtAt}`, ni una clave
  más ni una menos, con `cache-control: no-store` y `dynamic = 'force-dynamic'`. **Este es el
  único cambio admisible sobre el contrato de SPEC-031**, y su justificación es **ADR-024**;
  `tests/version-endpoint.test.ts` y `tests/spec-031-frontera.test.ts` se actualizan **para
  reflejarlo**, no para relajar ninguna otra garantía.

- **CA-4 (Coinciden, y se comprueba de verdad — CE-3).**
  Dada la app corriendo,
  cuando se lee la versión mostrada en el pie y se pide `GET /api/version` **al mismo
  despliegue**,
  entonces el semver mostrado es **idéntico** al `version` del endpoint, el identificador de
  commit mostrado es **prefijo exacto** de su `commit`, y la fecha mostrada corresponde **al
  mismo instante** que su `builtAt`. Es la comprobación literal de CE-3 y se hace en
  Playwright, no por inspección.

- **CA-5 (Una sola fuente de verdad — CE-3, ADR-024 pto. 6).**
  Dado el módulo que compone lo que se muestra,
  cuando se analiza,
  entonces obtiene **todos** sus valores de `deploymentIdentity` (`src/lib/version/identity.ts`)
  y **no** lee `process.env`, **no** menciona los nombres de las variables del canal de build
  y **no** lee `package.json`. Que el pie y el endpoint coincidan es una propiedad **por
  construcción**, no un acuerdo entre dos lectores.

- **CA-6 (El semver entra por el canal de BUILD, no por disco en runtime — ADR-024 pto. 4).**
  Dado `next.config.mjs` y `src/lib/version/build-identity.mjs`,
  cuando se analiza el repositorio,
  entonces `next.config.mjs` es **el único sitio** que lee el `version` de `package.json`, se
  lo pasa a `buildIdentity` como parámetro (el patrón que SPEC-031 ya usa con el sha de
  Vercel) y este devuelve una cuarta clave del canal; **ningún módulo bajo `src/` lee el
  fichero `package.json`**. Leerlo en runtime sería E/S de disco en la ruta que debe
  responder cuando todo lo demás falla.

- **CA-7 (`/api/version` sigue respondiendo con la base caída — SPEC-031 CA-5, ADR-024
  pto. 7).**
  Dado el grafo de imports de `src/app/api/version/route.ts`,
  cuando se analiza,
  entonces **sigue sin alcanzar** `src/db/` ni ningún módulo de datos: la dependencia entre
  presentación e identidad es **de un solo sentido** —la presentación importa la identidad, y
  la identidad **no importa a la presentación**—. `tests/version-import-graph.test.ts` sigue
  verde **sin relajarse**, y se **amplía** para que la pieza nueva no pueda colarse mañana.

- **CA-8 (El semver se valida por contenido — ADR-024 pto. 5).**
  Dada `resolveIdentity`,
  cuando recibe `version` con valor válido (`0.1.0`, `10.20.30`), vacío, con espacios, o con
  cualquier forma que no sea `MAJOR.MINOR.PATCH` (`v1.2`, `1.2.3-beta`, `latest`),
  entonces devuelve el valor solo en el primer caso y la sentinela **`unknown`** en todos los
  demás. Es la misma regla que SPEC-031 aplica al sha y a la fecha: **mirar el contenido, no
  la presencia**.

- **CA-9 (Un despliegue sin identidad lo dice, no lo disimula — SPEC-031).**
  Dada una identidad con `version`, `commit`, `environment` o `builtAt` a `unknown`,
  cuando se formatea,
  entonces el pie muestra **explícitamente que ese dato se desconoce**; no aparece un hueco,
  ni una cadena vacía, ni la palabra cruda `unknown` sin contexto, ni un valor inventado.
  Que se vea **es** la alarma.

- **CA-10 (El entorno se dice cuando importa, y calla cuando no).**
  Dada una identidad con `environment` igual a `production` y otra con `preview` o
  `development`,
  cuando se formatea,
  entonces en producción **no** se añade ruido y en los demás casos el entorno **sí** se
  muestra, para que nadie confunda un preview con la app real — que es justo el escenario en
  que alguien reporta un fallo desde una URL de Vercel.

- **CA-11 (La función de formato se prueba caso a caso).**
  Dada la función pura,
  cuando se evalúa con: identidad completa, commit corto, commit largo, semver desconocido,
  `builtAt` desconocido, `environment` desconocido y **los cuatro** desconocidos a la vez,
  entonces devuelve el texto esperado en los siete casos **sin lanzar**. No lee entorno, no
  toca red ni disco y se prueba sin levantar Next.

- **CA-12 (La CI exige subir el número cuando se toca código — ADR-024 ptos. 9 y 10).**
  Dado el gate nuevo,
  cuando se evalúa una rama cuyo diff contra `origin/main` **toca código de aplicación** y
  cuya `version` de `package.json` **no ha aumentado**,
  entonces **falla**, con un mensaje que dice qué hacer (`npm version <segmento>
  --no-git-tag-version`); y cuando el diff **solo toca documentación**, entonces **pasa sin
  exigir nada**; y cuando la versión ha **bajado** (rebase mal resuelto), entonces **falla**
  también, porque la comparación es semver y exige **estrictamente mayor**. La lógica de
  comparación es una **función pura** probada caso a caso, separada de la que averigua qué
  ficheros cambiaron.

- **CA-13 (El gate se declara donde este proyecto declara sus gates).**
  Dado `.github/workflows/ci.yml` y la lista cerrada de steps que congela
  `tests/spec-031-frontera.test.ts` (CA-13.1),
  cuando se añade el gate de CA-12,
  entonces la lista se **amplía con esa entrada y solo con esa**, tal y como su propio
  comentario exige (*"cada entrada nueva tiene que venir con un CA que la pida"*) — **este es
  ese CA**. El gate **no** invoca `check-alive`, **no** habla con ningún host externo y
  `vercel.json` **no cambia**: las tres aserciones que ese test defiende de verdad siguen
  intactas.

- **CA-14 (La cuarta clave del canal de build tampoco se configura: se calcula — SPEC-031
  CA-13.3).**
  Dado `.env.example` y el workflow de CI,
  cuando se analizan,
  entonces la clave nueva del canal de build **no aparece en ninguno de los dos**, igual que
  sus tres hermanas, y el juego de claves de `.env.example` **no cambia**. La lista de
  variables calculadas que vigila ese test pasa de tres a cuatro; el de claves configurables,
  de diez a diez.

- **CA-15 (La puerta post-despliegue no cambia — RI-02, ADR-024 pto. 11).**
  Dado `scripts/check-alive.mjs`,
  cuando se ejecuta contra un despliegue,
  entonces sigue comprobando **`commit`** contra el sha del merge y **no** el semver: la
  identidad del artefacto para *"hecho significa vivo"* sigue siendo el commit. El script
  **no se modifica** y `tests/check-alive.test.ts` sigue verde sin tocar expectativas.

- **CA-16 (No degrada lo entregado).**
  Dada la suite existente,
  cuando se ejecuta completa,
  entonces sigue verde. Los **únicos** cambios de expectativa admisibles son los que
  **ADR-024** justifica y que CA-3, CA-13 y CA-14 declaran uno a uno: la cuarta clave de la
  respuesta del endpoint, el step nuevo de CI y la cuarta variable calculada. **Ninguna otra
  aserción de SPEC-031 se relaja.**

## Entidades y reglas afectadas

**Sin cambios de esquema y sin base de datos.** Esta spec no escribe, no lee y no migra nada.

**Piezas existentes que se extienden, no se duplican:**

- **`package.json`** (campo `version`, hoy `0.1.0`): **fuente de verdad** del número
  (**ADR-024** pto. 3). No se crea ninguna constante paralela.
- **`next.config.mjs`**: único sitio que lee ese campo y lo inyecta en el canal de build
  (**ADR-024** pto. 4), igual que ya hace con el sha de Vercel.
- **`src/lib/version/build-identity.mjs`** (`buildIdentity`): devuelve una **cuarta** clave.
  Sigue sin validar nada —juzgar es trabajo de `resolveIdentity`— y sigue recibiendo sus
  entradas como parámetros.
- **`src/lib/version/identity.ts`** (`resolveIdentity`, `deploymentIdentity`, `UNKNOWN`):
  valida el semver y lo incorpora al contrato. Sigue siendo **pura** y sin E/S.
- **`src/app/api/version/route.ts`**: gana la cuarta clave y **nada más** (CA-3). Sigue sin
  importar la base (CA-7).
- **El pie compartido (`AppFooter`) que entrega SPEC-035**: esta spec lo **extiende** con la
  versión. El pie es de SPEC-035; **SPEC-039** le añade el feedback. Ninguna lo duplica.
- **`.github/workflows/ci.yml`** y **`scripts/`**: el gate de CA-12/CA-13, con el mismo
  patrón que `scripts/scan-destructive-sql.mjs` (SPEC-032).
- **`tests/version-import-graph.test.ts`** y **`tests/spec-031-frontera.test.ts`**: se
  **amplían**, nunca se relajan (CA-7, CA-13, CA-14).

**Módulo nuevo**: la función pura de formato para personas, en `src/lib/version/`, que
**importa** `identity.ts` y a la que `identity.ts` **no importa** (CA-7). La dirección de esa
flecha es lo que mantiene vivo `/api/version` con la base caída.

**Reglas y decisiones**: **RN-03** (la versión no es dato de usuario y se lee sin sesión),
**RI-02** (*"hecho significa vivo"*, intacta — CA-15); **ADR-024** (origen de esta spec, en
`borrador`, que **enmienda D-6 de ADR-018 sin superseder ADR-018**), **ADR-018** (despliegue
continuo; el commit sigue siendo la identidad del artefacto) y **SPEC-031** (de la que esta
spec es consumidora, y a la que solo modifica en lo que ADR-024 autoriza). Dominio: se añaden
a `docs/fundacion/dominio.md` los términos **Versión de producto** y **Versión del
despliegue**, con la distinción explícita entre ambas.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Etiquetas de git y changelog.** `npm version --no-git-tag-version` edita `package.json` y
  **no crea etiquetas** (**ADR-024** pto. 8): una etiqueta sería un tercer sitio donde vive
  la verdad. El changelog no existe y esta spec no lo crea.
- **Automatizar QUÉ segmento sube** (bump automático de PATCH en CI, versión derivada de la
  fecha o del número de commits). Rechazado en **ADR-024**: un número que sube solo no
  comunica nada. La CI exige **que suba**, no decide **cuánto**.
- **Cambiar cualquier otra cosa de `/api/version`**: prohibido por CA-3 y por **ADR-024**
  pto. 2, que reafirma las garantías de D-6 que **no** se tocan.
- **Cambiar `scripts/check-alive.mjs` o la puerta de despliegue**: prohibido por CA-15.
- **Página "acerca de"** con detalle del despliegue, dependencias o licencias. El pie basta.
- **Mostrar el estado del último ciclo junto a la versión.** Eso es **SPEC-037**;
  `/api/version` **no dice nada de ciclos** (frontera de SPEC-031) y el pie tampoco.
- **Enlazar el commit a GitHub.** El repositorio no es público; un enlace roto para todo el
  mundo es peor que ningún enlace.
- **Instrumentar qué versión usaba cada usuario** (registrarla en los reportes o en los
  avisos): sería telemetría, y la analítica está fuera de la épica. Que el tester **pueda
  copiarla** es todo lo que se entrega — y **SPEC-039** CA-13 hace que el enlace de feedback
  la lleve puesta, leyéndola de la misma fuente.

## Salvedades y follow-ups

- **F-SPEC-038-1 (dependencia de secuencia).** Esta spec **extiende el pie que entrega
  SPEC-035**. Va **después** de SPEC-035, y lo digo aquí para que el orden no se decida por
  casualidad.
- **F-SPEC-038-2 (fricción nueva, aceptada).** A partir de CA-12, **toda PR que toque código
  tiene que subir el número**. El falso positivo típico —una PR de código que de verdad no lo
  merece— se resuelve subiendo el PATCH, que cuesta un comando. Es el precio de que el número
  signifique algo.
- **F-SPEC-038-3 (residual asumido, F-ADR-024-1).** El gate comprueba que la versión **suba**,
  no que suba **bien**. Poner un `MAJOR` donde tocaba un `PATCH` no lo caza ningún script;
  juzgarlo es del gate humano.
- **F-SPEC-038-4 (residual asumido).** La versión identifica el **artefacto servido**, no el
  estado de la base de datos. Un despliegue nuevo con una migración a medias mostraría su
  versión correctamente y aun así comportarse raro. Responde *"¿qué código estoy viendo?"*,
  no *"¿está todo bien?"*.
- **F-SPEC-038-5 (residual heredado de SPEC-031).** Si el canal de build no aporta el sha
  —Vercel deja su variable **vacía** sin integración Git—, el pie mostrará el commit como
  `desconocida` (CA-9). El **semver sí llegará siempre**, porque sale de un fichero del
  repositorio; conviene tenerlo presente para no leer ese "desconocida" como un fallo nuevo.
- **F-SPEC-038-6 (discoverability, ADR-018).** **ADR-018 no se modifica** —está `aprobada` y
  es inmutable, y este proyecto ya sentó el precedente con ADR-016, que extendió ADR-001 sin
  anotarlo—, así que quien lea D-6 aislado **no verá** que ha sido enmendado. Se mitiga
  citando ADR-024 desde esta spec, desde el endpoint y desde el módulo de identidad. Está en
  las notas del gate por si prefieres otra cosa.

## Notas para el gate humano

1. **Tu veredicto está absorbido: semver visible y en el contrato.** No he escondido el
   coste: `/api/version` pasa a devolver **cuatro** claves y eso enmienda **D-6 de ADR-018**,
   lo que exige **tocar dos tests entregados** (`version-endpoint`, `spec-031-frontera`).
   Está declarado en CA-3, CA-13 y CA-14, y **acotado**: son los únicos cambios de
   expectativa admisibles. Lo que **no** se toca es lo que de verdad protegía D-6 —responder
   con la base caída y no exponer dato personal—, y **ADR-024** pto. 2 lo reafirma por
   escrito en vez de darlo por supuesto.

2. **La forma de la enmienda: ADR-024 enmienda D-6, no supersede ADR-018.** ADR-018 decide el
   despliegue continuo, la verificación en PR, el deploy al mergear y la comprobación de
   vida; aquí solo cambia el juego de propiedades de un endpoint. Superseder el ADR entero
   para enmendar una cláusula haría ilegible la historia de las decisiones. **ADR-018 no se
   edita** (es inmutable, y ADR-016 ya sentó ese precedente con ADR-001). El coste es
   **F-SPEC-038-6**: quien lea D-6 suelto no sabrá que hay una enmienda. Si prefieres que
   ADR-018 lleve una nota apuntando a ADR-024 —lo que significa **editar un ADR aprobado**—,
   es tu decisión y no la tomo yo.

3. **Dónde vive el número y quién lo sube (lo que me pediste que decidiera).** Vive en
   **`package.json`**: es el sitio convencional, ya existe con `0.1.0`, `npm version` lo mueve
   y no hay nada que aprovisionar. Lo sube **una persona en la PR**, con
   `npm version <segmento> --no-git-tag-version`. **Lo automático es la exigencia, no el
   acto** (CA-12): la CI falla si tocas código y no subes. Elegí exigir en vez de hacer
   porque un número que se incrementa solo no distingue un arreglo de tipografía de una
   capacidad nueva — y entonces es un sha más largo y peor.

4. **Guía de segmentos, que no es una regla y no la comprueba nadie**: `PATCH` para un
   defecto, `MINOR` para una spec entregada, y `MAJOR` reservado para `1.0.0` —el día que
   Stockeiro deje de ser una prueba—. Si prefieres otra convención, se escribe en ADR-024 y
   ya está; lo que el script comprueba es solo que **suba**.

5. **El semver NO sustituye al commit en la puerta de despliegue (CA-15).** Dos despliegues
   pueden compartir semver; nunca comparten commit. Si `check-alive` mirara el semver,
   **RI-02** dejaría de significar *"este despliegue viene de este merge"*. Por eso el pie
   enseña los dos: el semver para hablar, el commit para precisar.

6. **CA-7 es el CA aburrido que protege lo importante.** La garantía de que `/api/version`
   responde con la base caída es lo que hace cumplible **RI-02**. La forma más fácil de
   romperla es meter la presentación en el sitio equivocado, así que la flecha de dependencia
   va en un solo sentido y hay un test que lo vigila.

7. **CA-9: ver `desconocida` en producción sería feo, y debe serlo.** Es la alarma de
   SPEC-031 hecha visible para cualquiera. Nota práctica: hoy, sin integración Git en Vercel,
   **el commit va a salir así**; el semver no, porque sale del repositorio.

8. **Esta spec no bloquea publicar** y no toca la base de datos: se puede desplegar en
   cualquier momento después de SPEC-035, con poca ceremonia — salvo por el gate de CI, que
   a partir de su merge afecta a **todas** las PR de código, incluidas las de las specs
   hermanas. Convendría que fuera de las últimas, o de las primeras, pero no en medio.

9. **Aprobación**: la spec queda en **`borrador`** y **no la firmo yo**. **ADR-024** nace
   también en `borrador` y se aprueba en este mismo gate; si decae, esta spec vuelve a la
   versión anterior (commit + fecha, sin semver) y CE-3 se cumple igual, pero el tester
   seguirá sin tener nada citable.
