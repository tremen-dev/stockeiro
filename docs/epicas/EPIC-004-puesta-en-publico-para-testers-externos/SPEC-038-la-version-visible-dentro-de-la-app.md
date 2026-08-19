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

**La app ya sabe qué versión es, pero solo se lo cuenta a las máquinas.** SPEC-031 dejó
`/api/version` respondiendo `{commit, environment, builtAt}` desde `deploymentIdentity`
(`src/lib/version/identity.ts`), y `scripts/check-alive.mjs` lo consume para la puerta
post-despliegue (**ADR-018**, **RI-02**). Dentro de la interfaz **no aparece por ningún
lado**: ni en el pie, ni en el panel, ni en ninguna pantalla.

Mientras el único usuario era el autor, eso bastaba: `curl` al endpoint y listo. Con testers
externos deja de bastar, y por un motivo muy concreto: **el bucle de feedback**. Alguien
escribe en el hilo *"a mí no me sale el precio de ITX"* y lo primero que hace falta saber es
**qué versión estaba viendo**. Si hay que pedírselo por `curl`, no se pide y se depura a
ciegas.

**CE-3** lo formula sin ambigüedad: *"Cualquiera lee dentro de la app la versión que está
usando, y ese dato **coincide** con lo que responde `/api/version`"*.

El problema tiene dos trampas:

1. **Duplicar la fuente de verdad.** Lo fácil es leer `process.env` otra vez, o meter un
   `version` en `package.json` y enseñarlo. Cualquiera de las dos abre la puerta a que la
   app diga una cosa y el endpoint otra — que es exactamente lo que CE-3 prohíbe, y lo que
   convertiría la puerta de despliegue de **RI-02** en teatro.
2. **Romper lo que SPEC-031 protegió.** `/api/version` **debe poder responder con la base de
   datos caída** (CA-5 de SPEC-031), y `tests/version-import-graph.test.ts` lo vigila. Meter
   la presentación por el sitio equivocado es la forma más fácil de arrastrar medio proyecto
   a ese grafo de imports sin darse cuenta.

Y hay una decisión que no es técnica: **qué número se enseña**. Este proyecto despliega
**continuamente desde `main`** (**ADR-018**): no hay releases, no hay etiquetas y no hay
ciclo de versión. Un `1.4.2` en el pie sería un número que no significa nada y que nadie
mantendría. Lo que **sí** identifica un despliegue aquí es su **commit** y su **fecha de
construcción**, que además es literalmente lo que responde el endpoint.

Reglas en juego: **RN-03** (la versión se lee **también sin sesión**: es un dato del
artefacto, no del usuario) y **RI-02** (*"hecho significa vivo"*), cuyo mecanismo es
precisamente `/api/version`.

## Usuarios / roles afectados

- **Tester que reporta algo raro**: puede copiar la versión que está viendo y pegarla en su
  mensaje, sin saber qué es un commit ni abrir una terminal.
- **Operador**: al leer un reporte sabe **contra qué código** se produjo, y puede
  contrastarlo con `/api/version` y con la puerta de despliegue (**RI-02**).
- **Cualquiera, con o sin sesión**: la versión está en el pie de las páginas públicas
  también — incluidas las legales de **SPEC-035** y `/login`, que es la primera pantalla que
  ve quien llega del foro.
- **Quien se encuentre un despliegue sin identidad**: lee **`desconocida`**, no un hueco.
  Eso **es la alarma** (SPEC-031): este despliegue no sabe de dónde viene.

## Criterios de aceptación

Cada CA es verificable con un test: el formato con **Vitest** (función pura), la coincidencia
y la presencia con **Playwright**, y la frontera de imports con el mismo estilo de prueba que
ya usa `tests/version-import-graph.test.ts`.

- **CA-1 (La versión se ve, con sesión y sin ella — CE-3).**
  Dado el pie compartido,
  cuando se renderiza **cualquier** página —`/login`, `/legal/terminos`, `/dashboard`,
  `/vigiladas`—,
  entonces la versión del despliegue aparece en él, y aparece igual para un visitante
  anónimo que para un usuario autenticado.

- **CA-2 (Coincide con `/api/version`, y se comprueba de verdad — CE-3).**
  Dada la app corriendo,
  cuando se lee la versión mostrada en el pie y se pide `GET /api/version` **al mismo
  despliegue**,
  entonces el identificador de commit mostrado es **prefijo exacto** del `commit` que
  responde el endpoint y la fecha mostrada corresponde **al mismo instante** que su
  `builtAt`. Es la comprobación literal de CE-3 y se hace en Playwright, no por inspección.

- **CA-3 (Una sola fuente de verdad — CE-3).**
  Dado el módulo que compone lo que se muestra,
  cuando se analiza,
  entonces obtiene sus valores de `deploymentIdentity` (`src/lib/version/identity.ts`) y
  **no** lee `process.env`, **no** menciona los nombres de las variables del canal de build y
  **no** lee `package.json`. Que los dos sitios coincidan es una propiedad **por
  construcción**, no un acuerdo entre dos lectores.

- **CA-4 (`/api/version` sigue respondiendo con la base caída — SPEC-031 CA-5).**
  Dado el grafo de imports de `src/app/api/version/route.ts`,
  cuando se analiza,
  entonces **sigue sin alcanzar** `src/db/` ni ningún módulo de datos: la dependencia entre
  presentación e identidad es **de un solo sentido** —la presentación importa la identidad, y
  la identidad **no importa a la presentación**—. `tests/version-import-graph.test.ts` sigue
  verde **sin relajarse**, y se amplía para que la pieza nueva no pueda colarse mañana.

- **CA-5 (`/api/version` no cambia ni una coma — SPEC-031, ADR-018 D-6).**
  Dado el endpoint,
  cuando se pide,
  entonces sigue devolviendo **exactamente** `{commit, environment, builtAt}`, ni una clave
  más ni una menos, con `cache-control: no-store` y `dynamic = 'force-dynamic'`. Esta spec
  **consume** SPEC-031; no la modifica. `tests/spec-031-frontera.test.ts` sigue verde.

- **CA-6 (El formato es para personas — CE-3).**
  Dada la función pura de formato,
  cuando recibe una identidad completa,
  entonces produce un texto **breve y legible en español** con el commit **abreviado a sus
  primeros caracteres** y la fecha de construcción en formato humano (no ISO crudo, no JSON,
  no un objeto volcado). El resultado es **seleccionable y copiable** como texto.

- **CA-7 (Un despliegue sin identidad lo dice, no lo disimula — SPEC-031).**
  Dada una identidad con `commit`, `environment` o `builtAt` a la sentinela `unknown`,
  cuando se formatea,
  entonces el pie muestra **explícitamente que ese dato se desconoce**; no aparece un hueco,
  ni una cadena vacía, ni la palabra cruda `unknown` sin contexto, ni un valor inventado.
  Que se vea **es** la alarma.

- **CA-8 (El entorno se dice cuando importa, y calla cuando no).**
  Dada una identidad con `environment` igual a `production` y otra con `preview` o
  `development`,
  cuando se formatea,
  entonces en producción **no** se añade ruido y en los demás casos el entorno **sí** se
  muestra, para que nadie confunda un preview con la app real — que es justo el escenario en
  que alguien reporta un fallo desde una URL de Vercel.

- **CA-9 (La función de formato se prueba caso a caso).**
  Dada la función pura,
  cuando se evalúa con: identidad completa, commit corto, commit largo, `builtAt`
  desconocido, `environment` desconocido y los tres desconocidos a la vez,
  entonces devuelve el texto esperado en los seis casos **sin lanzar**. No lee entorno, no
  toca red ni disco y se prueba sin levantar Next — mismo patrón que `resolveIdentity`
  (SPEC-031) e `isPublicPath` (SPEC-001).

- **CA-10 (No degrada lo entregado).**
  Dada la suite existente,
  cuando se ejecuta completa,
  entonces sigue verde, y en particular siguen pasando los tests de SPEC-031 y la puerta
  post-despliegue de **SPEC-028**/`scripts/check-alive.mjs`, que **no** cambia: sigue
  comprobando el endpoint, no el pie.

## Entidades y reglas afectadas

**Sin cambios de esquema y sin base de datos.** Esta spec no escribe, no lee y no migra nada.

**Piezas existentes que se reutilizan, no se duplican:**

- **`src/lib/version/identity.ts`** (`deploymentIdentity`, `UNKNOWN`, `DeploymentIdentity`):
  **única** fuente de verdad, resuelta una sola vez al cargar el módulo desde el canal `env`
  de `next.config.mjs` (SPEC-031 CA-2). Esta spec **no la toca**.
- **`src/app/api/version/route.ts`**: **no cambia** (CA-5).
- **El pie compartido (`AppFooter`) que entrega SPEC-035**: esta spec lo **extiende** con la
  versión. Ninguna de las dos lo duplica; el pie es de SPEC-035 y esta lo amplía. Es la
  frontera explícita entre ambas.
- **`tests/version-import-graph.test.ts`**: se **amplía**, nunca se relaja (CA-4).

**Módulo nuevo**: la función pura de formato para personas, en `src/lib/version/`, que
**importa** `identity.ts` y a la que `identity.ts` **no importa** (CA-4). La dirección de esa
flecha es lo que mantiene vivo `/api/version` con la base caída.

**Reglas y decisiones**: **RN-03** (la versión no es dato de usuario y se lee sin sesión),
**RI-02** (*"hecho significa vivo"*, cuyo mecanismo es este endpoint); **ADR-018** D-6
(propiedades obligatorias de la identidad, mecanismo libre) y **SPEC-031** (de la que esta
spec es consumidora estricta). Dominio: se añade a `docs/fundacion/dominio.md` el término
**Versión del despliegue**.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Versión semántica (`1.4.2`), etiquetas de git o changelog.** Este proyecto despliega
  continuamente desde `main` (**ADR-018**): no hay releases que numerar. Un semver aquí sería
  un número decorativo y, peor, **una segunda fuente de verdad** que podría no coincidir con
  `/api/version` — justo lo que CE-3 prohíbe. Se discute en las notas del gate.
- **Cambiar `/api/version`** (añadirle un campo "legible", una versión semántica o cualquier
  otra clave). Está prohibido por CA-5 y por **ADR-018** D-6.
- **Página "acerca de"** con detalle del despliegue, dependencias o licencias. El pie basta
  para CE-3.
- **Mostrar el estado del último ciclo junto a la versión.** Eso es **SPEC-037** y su
  pantalla de operación; `/api/version` **no dice nada de ciclos** (frontera de SPEC-031) y
  el pie tampoco.
- **Enlazar el commit a GitHub.** El repositorio no es público; un enlace roto para todo el
  mundo es peor que ningún enlace.
- **Instrumentar qué versión usaba cada usuario** (registrar la versión en los reportes o en
  los avisos): sería telemetría, y la analítica está fuera de la épica. Que el tester **pueda
  copiar** el dato es todo lo que se entrega.

## Salvedades y follow-ups

- **F-SPEC-038-1 (dependencia de secuencia).** Esta spec **extiende el pie que entrega
  SPEC-035**. Si se implementara antes, tendría que crearlo, y entonces las dos specs se
  disputarían la misma pieza. **Va después de SPEC-035**, y lo digo aquí para que el orden no
  se decida por casualidad.
- **F-SPEC-038-2 (residual asumido).** La versión mostrada identifica el **artefacto
  servido**, no el estado de la base de datos. Un despliegue nuevo con una migración a medias
  mostraría su commit correctamente y aun así comportarse raro. La versión responde *"¿qué
  código estoy viendo?"*, no *"¿está todo bien?"*.
- **F-SPEC-038-3 (residual heredado de SPEC-031).** Si el canal de build no aporta el sha
  —Vercel deja su variable **vacía** sin integración Git—, la app mostrará `desconocida`
  (CA-7). Es correcto y es la alarma, pero conviene saber que **puede pasar en producción** y
  que su remedio vive en la configuración del despliegue, no en el código.

## Notas para el gate humano

1. **La decisión de producto es "el commit ES la versión", y quiero tu visto bueno.** No hay
   semver porque no hay releases (**ADR-018**: despliegue continuo desde `main`). Un `1.4.2`
   en el pie sería un número que nadie mantiene y —lo grave— una **segunda fuente de verdad**
   que podría dejar de coincidir con `/api/version`, que es exactamente lo que CE-3 prohíbe.
   Si aun así quieres un número "de producto" para el foro, la forma honesta es que
   `/api/version` lo sirva también (**cambia ADR-018 D-6**, y eso es otro ADR y otro gate);
   lo que **no** haré es enseñar en el pie un número que el endpoint no conoce.

2. **No he abierto ADR, y creo que es correcto.** La decisión que hay aquí —el commit como
   versión— **ya está implícita en ADR-018** (no hay releases que numerar) y esta spec no
   constriñe nada nuevo: consume SPEC-031 sin modificarla. Si consideras que "no habrá
   semver" merece constancia propia, se escribe y se aprueba en el mismo gate.

3. **CA-4 es el CA aburrido que protege lo importante.** La garantía de que `/api/version`
   responde con la base caída es lo que hace cumplible **RI-02** (*"hecho significa vivo"*).
   La forma más fácil de romperla es meter la presentación en el sitio equivocado, así que la
   flecha de dependencia va en un solo sentido y hay un test que lo vigila.

4. **CA-7: ver `desconocida` en el pie de producción sería feo, y debe serlo.** Es la alarma
   de SPEC-031 hecha visible para cualquiera, no solo para `check-alive`. Si prefieres que en
   ese caso el pie no muestre nada, dilo — pero entonces el despliegue mudo dejará de
   delatarse solo.

5. **Esta spec no bloquea publicar** y no toca la base de datos: se puede desplegar en
   cualquier momento después de SPEC-035, con muy poca ceremonia.

6. **Aprobación**: la spec queda en **`borrador`** y **no la firmo yo**.
