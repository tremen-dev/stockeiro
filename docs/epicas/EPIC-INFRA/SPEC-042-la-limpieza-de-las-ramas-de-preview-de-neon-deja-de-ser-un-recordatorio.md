---
id: SPEC-042
tipo: spec
epica: EPIC-INFRA
estado: en-revision
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-20, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-20, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-20, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-20, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-08-20, por: sdd-orquestador}
  - {estado: en-revision, fecha: 2026-08-20, por: sdd-implementador}
---
# SPEC-042 — La limpieza de las ramas de preview de Neon deja de ser un recordatorio

> Origen: **F-SPEC-028-2**, abierto por el arquitecto de SPEC-028 el 2026-08-19 —*"el techo de
> ramas de Neon (10 en el plan Free) pasa a ser un recurso escaso el día que el repo se
> conecte, y las ramas de preview sobreviven al cierre de la PR"*—. **Se cumplió el
> 2026-08-19/20**, un día después de escribirlo, tumbando un despliegue de producción. Esta
> spec lo cierra con un mecanismo en vez de con un recordatorio.
>
> **Numeración**: el andamio asignó `SPEC-041`, que está reservada por una sesión paralela
> (`ft/SPEC-041-vigiladas-legible-y-ordenable`, en otro worktree, aún no en `origin/main`).
> Renumerada a **SPEC-042** antes de escribir una línea. Es el mismo fallo que ADR-018
> documenta en su nota de numeración: `scaffold.mjs` numera escaneando el `docs/` **local**, y
> el local no ve las ramas de nadie más.

## Problema

**Hoy, 2026-08-19/20, un despliegue de producción falló** con:

```
Branch limit reached. Upgrade your plan or delete unused branches.
```

El panel de Neon tenía **10 ramas** —el techo del plan Free—: `main`, una rama `preview`
creada a mano, y **ocho `preview/ft/*` creadas por Vercel**, todas de specs **ya mergeadas**.
El humano tuvo que borrar tres a mano para desbloquear el despliegue. No hubo aviso previo:
el recurso se agota en silencio y se entera quien despliega.

### Por qué se acumulan: borrar la rama de git NO borra la rama de Neon

La causa está en la documentación de Neon, no en una suposición. Con la **integración
gestionada por Vercel** —la que este proyecto tiene, con *Create Database Branch For
Deployment* = Preview sí / Production no, `docs/despliegue.md` §13.3— el ciclo de vida de la
rama de Neon **no está atado a la PR sino al despliegue de Vercel**:

> *"Preview branches are automatically deleted when their corresponding Vercel deployments are
> removed. The timing of this cleanup depends on Vercel's deployment retention policy, which
> **retains preview deployments for 6 months by default**."*
>
> *"Because of Vercel's default retention settings, preview branches can persist long after a
> PR is closed."*
>
> — <https://neon.com/docs/guides/vercel-managed-integration>

Es decir: mergear la PR y borrar la rama de git **no toca la rama de Neon**. Se borrará sola
dentro de **seis meses**. Con **una spec por PR** y un techo de **10 ramas**, el sistema
revienta cada ~8 merges, indefinidamente.

### Lo que hace que esto sea peor que una molestia de ops

Desde **SPEC-028** (ADR-018 D-1) **mergear es desplegar**. El recurso que se agota no bloquea
un experimento: bloquea el camino por el que llega el valor a producción, y lo bloquea
**después** del merge, cuando ya no hay vuelta atrás barata. Es exactamente la clase de fallo
que ADR-018 se propuso eliminar —*"el pipeline se rompe sin avisar"*— reaparecido por la
puerta de al lado.

Y hay un agravante de método: **estaba escrito**. `docs/despliegue.md` §13.3 dice, desde el
2026-08-19, *"revisar la consola de Neon periódicamente y borrar las ramas de preview
viejas… Es ops, y nadie avisa antes de que ocurra"*. La defensa era un párrafo pidiéndole a
una persona que se acordara. Es la misma forma exacta del defecto que fundó ADR-018 (*"se
olvidó 27 días"*) y de la que fundó SPEC-027 (*"la suite depende de que alguien se acuerde"*).
**Duró un día.**

### Lo verificado el 2026-08-20 (fuentes citadas, no memoria)

| Hecho | Cómo se comprobó |
|---|---|
| El fallo real: `Branch limit reached. Upgrade your plan or delete unused branches.` con 10 ramas, 8 de ellas `preview/ft/*` de specs mergeadas. | panel de Neon del humano, 2026-08-19/20 |
| Las ramas de preview sobreviven al cierre de la PR porque cuelgan de la **retención de despliegues de Vercel**, **6 meses por defecto**. | <https://neon.com/docs/guides/vercel-managed-integration> (citado arriba) |
| Neon nombra las ramas `preview/<git-branch>` — que es justo lo que se ve en el panel: `preview/ft/SPEC-0NN-…`. | misma página; cuadra con la evidencia del panel |
| La vía recomendada por Neon es un **GitHub Action al cerrar la PR** (su opción 3 de cuatro). | <https://neon.com/docs/guides/vercel-branch-cleanup> |
| La acción existe y **no está archivada ni deprecada**: `neondatabase/delete-branch-action`, versión mayor vigente **`v3`**. Entradas: `project_id`, `api_key`, `branch` (recomendada) y `branch_id` (**deprecada**). **No tiene salidas.** | <https://github.com/neondatabase/delete-branch-action> (README) |
| Requiere `NEON_PROJECT_ID` como **variable** del repositorio y `NEON_API_KEY` como **secreto** del repositorio (clave creada en *Account Settings → API Keys* de Neon). | misma fuente |
| **Contrapartida declarada por Neon**: *"Deleting a Neon branch invalidates any Vercel preview deployments that depend on it. Those deployments will fail on database connections."* | <https://neon.com/docs/guides/vercel-branch-cleanup> |
| **El README no dice qué pasa si la rama no existe.** Ni falla ni no-falla documentado. | README de la acción, leído entero |
| El repositorio es **público** desde el 2026-08-19 (Vercel no despliega en Hobby desde un repo privado de organización). | `docs/despliegue.md` §9, ledger de SPEC-028 (F-SPEC-028-1) |
| Hoy hay **dos** workflows, `ci.yml` y `deploy-gate.yml`, y **ninguno lleva un solo secreto** — propiedad congelada en `tests/spec-031-frontera.test.ts` y `tests/spec-032-frontera.test.ts`. | árbol y tests |
| Había **27 ramas mergeadas** vivas en GitHub, borradas a mano el mismo día. La casilla *Automatically delete head branches* está apagada. | inspección del repositorio |

### Encaje en la épica

EPIC-INFRA nombra *"plataforma de despliegue (Vercel), CI y salud técnica del proyecto"* y
*"CI y **configuración de despliegue**"* dentro de su alcance. Es una épica **bucket** y
**no se cierra**: esta spec entra y sale sin tocar su estado.

## Usuarios / roles afectados

- **El humano que mergea.** Hoy paga el fallo dos veces: el despliegue no sale, y arreglarlo
  exige entrar en un panel, entender qué rama es de qué PR y borrar a mano. Después: no se
  entera de que existía el problema.
- **El Operador** (`docs/fundacion/dominio.md`). El techo de ramas es el primer recurso que se
  agota de todo el sistema y hoy nadie lo vigila.
- **sdd-implementador y sdd-verificador.** Una preview rota por falta de ramas se lee igual
  que una preview rota por un bug: pierden tiempo diagnosticando infraestructura.
- **Usuario final / testers (indirecto).** Un despliegue bloqueado es valor que no llega. Es
  la misma cadena de daño que ADR-018 midió en 27 días.

## Decisión de diseño

**Un tercer workflow de GitHub Actions**, `.github/workflows/neon-preview-cleanup.yml`, que
al **cerrar** una PR borra la rama de Neon que Vercel creó para ella. Es la **opción 3** de la
guía de limpieza de Neon, que es la que Neon recomienda para este caso.

Forma canónica (de la documentación de Neon, verificada hoy; el implementador la ajusta a lo
que exigen los CA, no al revés):

```yaml
name: Cleanup Neon preview branch
on:
  pull_request:
    types: [closed]
jobs:
  delete-branch:
    runs-on: ubuntu-latest
    steps:
      - uses: neondatabase/delete-branch-action@v3
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          branch: preview/${{ github.head_ref }}
          api_key: ${{ secrets.NEON_API_KEY }}
```

### Por qué un fichero aparte y no un job dentro de `ci.yml`

No es preferencia: es la misma decisión que SPEC-028 razonó para `deploy-gate.yml`, y aquí
pesa más.

1. **Ciclo distinto.** `ci.yml` responde *"¿se puede mezclar?"* **antes** del merge;
   `deploy-gate.yml` responde *"¿llegó?"* **después**; este responde *"¿queda basura?"* al
   **cerrar**. Tres preguntas, tres momentos, tres rojos con reacciones distintas.
2. **Este workflow lleva un secreto y los otros dos no.** Que `ci.yml` y `deploy-gate.yml`
   no lleven ni un secreto está **congelado en tests de otras dos specs**
   (`tests/spec-031-frontera.test.ts`, `tests/spec-032-frontera.test.ts`). Meterlo dentro
   rompería esa propiedad y obligaría a editar los tests de specs cerradas — que es
   exactamente el daño que SPEC-028 documentó en `F-SPEC-032-3` y que aquí es evitable por
   completo.
3. **No es un check del merge.** No debe serlo: corre al cerrar la PR, cuando el merge ya
   ocurrió. Un check requerido que se ejecuta después del merge es una contradicción.

### La frontera con la regla de ADR-018 D-4, dicha en voz alta

ADR-018 D-4 afirma, como propiedad *load-bearing*: **«El CI no necesita ni un secreto. Un CI
sin secretos es un CI que no puede filtrar nada ni tumbar nada»**, y su alternativa 2 se
rechazó, entre otras cosas, por *"duplicar los 9+ secretos reales en GitHub Secrets"*.

**Esta spec introduce el primer secreto de GitHub del repositorio.** Conviene no disimularlo.
Por qué no rompe D-4, punto por punto:

- **No es el CI.** No verifica, no construye, no migra y no decide si se puede mezclar. Corre
  cuando la PR ya está cerrada.
- **No duplica ningún secreto existente.** `NEON_API_KEY` es una credencial **nueva**, de
  administración de ramas, que no existe en Vercel y no es la `DATABASE_URL` de producción.
  No hay dos fuentes de verdad que puedan derivar: es la única copia.
- **No puede tumbar producción por acción propia.** Su único verbo es *borrar una rama cuyo
  nombre empieza por `preview/`*. Lo que sí puede es **caducar previews viejas** — y eso está
  declarado abajo como consecuencia, no escondido.
- **Lo que sí cambia, y hay que decirlo**: la frase *"este repositorio no tiene ni un
  secreto"* deja de ser cierta, en un repositorio **público**. Las defensas van en los CA
  (sin `pull_request_target`, sin permisos de escritura, sin PRs de fork, sin el valor en
  claro) y el riesgo residual, en §Riesgos.

**Si el humano considera que eso merece firma de ADR, es lo que hay que firmar, y lo escribo
antes de que se implemente nada.** Mi juicio va en §Notas para el gate, punto 1.

### Por qué NO se filtra por `merged`

El disparador es `pull_request: types: [closed]`, **sin** `if: …merged == true`. Una PR
cerrada **sin** mergear deja exactamente la misma rama huérfana en Neon que una mergeada: la
creó el despliegue de Preview, no el merge. Filtrar por `merged` dejaría fuera justo el caso
en que más fácil es olvidarse.

## Criterios de aceptación

Dos bloques, y la separación es el punto: **un workflow de GitHub no se puede verificar del
todo desde el repositorio.** No se puede cerrar una PR de verdad desde un test, ni comprobar
desde Vitest que una rama desapareció de un panel de Neon. El precedente está sentado
(SPEC-028 marcó 🚀 los cuatro CA que exigían despliegue real; SPEC-031 hizo lo propio) y aquí
se aplica igual: lo verificable en el repo se verifica con tests, y lo demás se **mide una vez
en el primer cierre real** y su evidencia va al ledger. Fingir que todo es testable sería una
casilla marcada, no una garantía.

**Cómo se verifica cada bloque:**

- 🔒 **En el repositorio**: tests estáticos que **parsean el YAML** con el paquete `yaml`
  (patrón de `tests/ci-workflow.test.ts` y `tests/deploy-gate-workflow.test.ts`; un regex
  sobre el texto crudo casa con lo que hay en un comentario y no distingue un step de otro) y
  tests estáticos sobre el runbook (patrón de `tests/runbook-check-alive.test.ts`).
- 🚀 **Solo operativamente**: al cerrar la **primera PR real** con los dos valores de ops ya
  puestos. Evidencia nombrada, pegada en el ledger.

---

### 🔒 Bloque A — Lo que se verifica en el repositorio

- **CA-1 (El workflow existe, aparte, y no toca a los otros dos).**
  Dado el árbol del repositorio,
  cuando se listan los workflows,
  entonces existe `.github/workflows/neon-preview-cleanup.yml`, es un **tercer** fichero, y
  **ni `ci.yml` ni `deploy-gate.yml` cambian ni una línea** respecto a `origin/main`.

- **CA-2 (Un solo disparador, y no filtra por merge).**
  Dado el workflow,
  cuando se parsea su clave `on`,
  entonces declara **exactamente un** disparador, `pull_request` con `types: [closed]`, y
  **ningún** otro (`push`, `schedule`, `workflow_dispatch`, `pull_request_target`: ninguno);
  y **ningún** `if` del fichero condiciona la ejecución a `merged`.
  *Por qué `pull_request_target` es una prohibición explícita y no un olvido*: es el disparador
  que **sí** entrega secretos a una PR de un fork, y el repositorio es público desde el
  2026-08-19. Prohibirlo por CA lo convierte en un rojo, no en una conversación.

- **CA-3 (La acción, su versión y sus tres entradas, literales y verificados).**
  Dado el único step que ejecuta algo,
  cuando se leen su `uses` y su `with`,
  entonces:
  1. `uses` es **`neondatabase/delete-branch-action@v3`** — nombre y versión mayor
     comprobados hoy contra el repositorio de la acción, no copiados de memoria;
  2. `with` tiene **exactamente tres** claves: `project_id`, `branch`, `api_key`;
  3. `project_id` es `${{ vars.NEON_PROJECT_ID }}`, `api_key` es `${{ secrets.NEON_API_KEY }}`
     y `branch` es `preview/${{ github.head_ref }}`;
  4. **no** aparece `branch_id`, que el propio README marca como **deprecada**.
  *Por qué el valor de `branch` se congela y no se deja "a lo que salga"*: `preview/<git-branch>`
  es la convención de nombrado de la integración gestionada por Vercel, y la evidencia del panel
  (`preview/ft/SPEC-0NN-…`) la confirma. Si Neon la cambiara, este CA rojo es el aviso.

- **CA-4 (Nada se borra fuera de `preview/`, y `main` no se nombra).** ⚠️ *el CA de seguridad*
  Dado el workflow,
  cuando se inspecciona el valor de `branch` y el fichero entero,
  entonces:
  1. el valor de `branch` **empieza por la cadena literal `preview/`** — no interpolada, no
     construida, no condicional;
  2. **ningún** step del fichero nombra `main`, `production` ni ninguna rama fija;
  3. **no hay** ni un `run:` en todo el fichero (el único step es el `uses` de CA-3), así que
     no hay superficie donde el secreto pueda acabar en un log ni donde `github.head_ref`
     —dato controlado por quien abre la PR— llegue a una shell;
  4. ni el id del proyecto ni la clave aparecen **en claro**: solo por `vars.` y `secrets.`.
  *Por qué esto es un CA y no una nota*: `main` **es la cartera real del usuario**. Un action
  mal apuntado no da un rojo, da una pérdida de datos. El prefijo literal es lo que hace que el
  peor caso alcanzable por este fichero sea *"borré una preview que no tocaba"*.

- **CA-5 (Higiene del workflow: fork, permisos, plazo, concurrencia, y sin red de seguridad
  que tape el fallo).**
  Dado el workflow,
  cuando se parsea,
  entonces:
  1. **no corre para PRs de un fork**: el job lleva una condición sobre
     `github.event.pull_request.head.repo.full_name == github.repository`. En un repo público,
     una PR de fork **no recibe secretos**, así que sin esta condición cada cierre de PR
     externa pintaría un rojo garantizado y sin significado;
  2. declara `permissions` de forma **explícita** y **sin un solo verbo de escritura**
     (`contents: read` o `{}`): no hay checkout, así que no necesita nada más;
  3. tiene `timeout-minutes` (una llamada HTTP no puede quemar cuota colgada);
  4. tiene un **grupo de concurrencia propio**, distinto del de `ci.yml` y del de
     `deploy-gate.yml`, con `cancel-in-progress: false` — cancelar un borrado a medias no
     ahorra nada y deja la rama viva;
  5. **no** lleva `continue-on-error`, ni `|| true`, ni `if: always()` sobre el step: un fallo
     del borrado **tiene que pintar rojo**. Un limpiador que falla en silencio devuelve el
     problema a los seis meses y con el panel lleno.

- **CA-6 (Frontera: los otros dos workflows siguen sin secretos, y este no gobierna el merge).**
  Dado el conjunto de `.github/workflows/`,
  cuando se parsean los tres ficheros,
  entonces:
  1. `ci.yml` y `deploy-gate.yml` **siguen sin contener la cadena `secrets.`** ni ningún host
     externo nuevo — es decir, `tests/spec-031-frontera.test.ts` y
     `tests/spec-032-frontera.test.ts` **siguen verdes sin editarlos**;
  2. `neon-preview-cleanup.yml` es el **único** fichero del repositorio con `secrets.`;
  3. este workflow **no** aparece entre los contextos requeridos del ruleset `Protected main`
     (que hoy son `Checks` y `E2E`, `docs/despliegue.md` §9): no puede impedir ni retrasar un
     merge, por construcción, porque corre después.
  *Punto 3, cómo se comprueba sin secretos*: es una afirmación **documental**, no una llamada a
  la API de GitHub. El runbook la escribe (CA-7) y el test la congela ahí. Comprobar el ruleset
  vivo es ops, y ya tiene su sitio en §12.5.

- **CA-7 (El runbook cuenta la trampa, la solución y lo que la solución cuesta).**
  Dado `docs/despliegue.md`,
  cuando se lee, y con un test estático que lo congela,
  entonces dice, cada cosa en su sitio:
  1. **§6 (notas y gotchas)** — una entrada nueva: **borrar la rama de git NO borra la rama de
     Neon**; con la integración gestionada por Vercel la rama de preview cuelga de la
     **retención de despliegues de Vercel (6 meses por defecto)**, no de la PR; con una spec por
     PR y 10 ramas de techo, revienta cada ~8 merges. Con la cita y el enlace a la fuente.
  2. **§9 (la CI de las PR)** — el repositorio pasa a tener **tres** workflows, y esta sección
     dice cuál responde qué pregunta y **cuándo**: `ci.yml` *¿se puede mezclar?* (antes),
     `deploy-gate.yml` *¿llegó?* (después del push a `main`), `neon-preview-cleanup.yml`
     *¿queda basura?* (al cerrar la PR). Y que el tercero **no es ni debe ser un check
     requerido**, por la misma razón que `Alive` no lo es.
  3. **§13 (acciones de ops)** — la tabla de acciones gana las filas de `NEON_PROJECT_ID`
     (variable del repo), `NEON_API_KEY` (secreto del repo, creado en *Account Settings → API
     Keys* de Neon) y *Automatically delete head branches*, cada una con su follow-up.
  4. **§13.3 reescrito** — el techo 2 (*"las ramas sobreviven al cierre de la PR"*) deja de
     resolverse con *"revisar la consola periódicamente"* y pasa a tener dueño automático. Se
     conserva el **techo 1** (10 ramas en Free) intacto, porque esta spec **no lo sube**, y se
     añade el **incidente del 2026-08-19/20 con su mensaje literal** (`Branch limit reached.
     Upgrade your plan or delete unused branches.`), que es lo que hará reconocible el fallo si
     vuelve.
  5. **La contrapartida, escrita y no enterrada**: al borrar la rama, **las URLs de preview
     antiguas dejan de conectar** — revisitar un preview viejo da error de base de datos, en
     palabras de Neon: *"Those deployments will fail on database connections"*. Con el flujo de
     este proyecto (mergear y seguir) no molesta; es una consecuencia real, no un detalle.
  6. **Y lo que NO arregla, dicho para que nadie lo confunda**: la casilla de GitHub
     *Automatically delete head branches* **no toca Neon**. Borra ramas de git muertas —el
     2026-08-19/20 había **27** mergeadas, borradas a mano— y eso es todo. Quien crea que con
     esa casilla el problema de Neon está resuelto, se lo volverá a encontrar.

---

### 🚀 Bloque B — Lo que solo se comprueba operativamente

Ninguno de estos tres se puede cerrar sin cerrar una PR real y mirar el panel de Neon. Su
evidencia va al **ledger**, con comando o captura, no a un test.

- **CA-8 (Al cerrar la PR, la rama desaparece de Neon).** 🚀 **CIERRE REAL**
  Dados `NEON_PROJECT_ID` y `NEON_API_KEY` ya puestos (F-SPEC-042-1 y F-SPEC-042-2),
  cuando se cierra la PR de esta misma spec,
  entonces el workflow corre **en verde** y la rama `preview/ft/SPEC-042-…` **ya no está** en
  la consola de Neon, y el recuento total de ramas **baja en una**.
  *Por qué esto es el CA de verdad y no CA-1..CA-7*: un YAML impecable con una clave mal
  copiada es un rojo que nadie ve hasta el siguiente merge. Este es el único observable
  imposible de falsear de que los dos valores de ops existen y son correctos — el mismo
  reparto que SPEC-028 hizo con `F-SPEC-032-2` (el **acto** es ops; el **efecto** es CA).
  *Evidencia para el ledger*: enlace a la ejecución del workflow en Actions (verde), y el
  recuento de ramas de Neon **antes y después**, con la lista de nombres.

- **CA-9 (Qué hace ante una rama que ya no existe: medido y escrito).** 🚀 **CIERRE REAL**
  Dado que **el README de la acción no lo documenta** (verificado hoy, leído entero),
  cuando se re-ejecuta el workflow de CA-8 sobre la rama **ya borrada** (botón *Re-run* en
  Actions, o reabrir y volver a cerrar la PR),
  entonces queda **escrito en el ledger y en §13.3** si sale **verde o rojo** y con qué
  mensaje.
  *Por qué es un CA y no una curiosidad*: decide si este workflow es fiable o ruidoso. Hay PRs
  que se cierran sin haber tenido nunca preview, y hay cierres dobles. Si la acción da **rojo**
  ante una rama inexistente, este limpiador dará falsos rojos —y *"una puerta que da falsos
  rojos enseña a ignorarla"* (SPEC-028 / `deploy-gate.yml`)—, así que **se abre follow-up en el
  acto** y la salida se decide entonces, no ahora inventándola.
  *Lo que NO se hace aquí*: **no** se pone `continue-on-error` preventivamente (CA-5.5). Tapar
  un fallo que aún no se ha medido es cambiar un problema conocido por uno invisible.

- **CA-10 (Nada que no fuera una preview se tocó).** 🚀 **CIERRE REAL**
  Dado el panel de Neon antes y después de CA-8,
  cuando se comparan las dos listas de ramas,
  entonces **la única diferencia** es la desaparición de la rama `preview/ft/SPEC-042-…`; en
  particular **`main` sigue ahí** y la rama `preview` creada a mano tampoco se tocó.
  *Por qué se comprueba lo obvio*: es el riesgo **R-1**, y `main` es la cartera real del
  usuario. La primera vez que un automatismo con permiso de borrado se ejecuta contra la base
  de producción, alguien mira. Una vez.

## Entidades y reglas afectadas

**No toca el dominio.** No hay entidad, ni `RN-xx`, ni término de `docs/fundacion/dominio.md`
implicado: es infraestructura de despliegue. Se cita, sin duplicar:

- **ADR-018** — *Despliegue continuo desde `main`*. Gobierna esto entero:
  - **D-1** (mergear despliega) es lo que convierte el techo de ramas en un bloqueo de
    producción y no en una molestia.
  - **D-3** (ningún entorno que no sea Production tiene credenciales de Production) es lo que
    obliga a que exista una rama de Neon por preview. Esta spec gestiona su **ciclo de vida**,
    que D-3 no fijó.
  - **D-4** (el CI sin secretos) — frontera razonada arriba. **No se enmienda.**
- **ADR-001** — Vercel + Neon. Sin cambios.
- **`RI-02`** (`docs/fundacion/reglas.md`, escrita por SPEC-028): *"hecho" exige "vivo"*. Esta
  spec protege el mecanismo del que `RI-02` depende: sin previews no hay pipeline, y sin
  pipeline `RI-02` es incumplible.
- **F-SPEC-028-2** — **esta spec lo cierra**, y solo su **mitad 2** (las ramas sobreviven al
  cierre de la PR). Su **mitad 1** —el techo de 10 ramas del plan Free— **sigue abierta a
  propósito**: no se sube de plan y el techo no se toca. Con el limpiador vivo el techo deja de
  agotarse solo, que es distinto de desaparecer.
- **F-SPEC-032-1** — *el permiso `ALLOW_MIGRATE` en Preview asume que el preview branching
  sigue encendido*. Sin cambios; esta spec no lo toca ni lo empeora.
- **SPEC-027** y **SPEC-028** — precedentes de cómo se especifica y se congela un workflow en
  este proyecto (jobs visibles, un step por gate, test que parsea el YAML).
- **SPEC-032** — precedente del reparto **acto de ops / efecto como CA** (`F-SPEC-032-2`).

### Ficheros

| Fichero | Qué |
|---|---|
| `.github/workflows/neon-preview-cleanup.yml` | **nuevo** — el workflow. Único fichero del repo con `secrets.` |
| `tests/neon-preview-cleanup-workflow.test.ts` | **nuevo** — CA-1 a CA-6, parseando el YAML con `yaml` |
| `tests/runbook-limpieza-preview.test.ts` | **nuevo** — CA-7, estático sobre `docs/despliegue.md` |
| `docs/despliegue.md` | **editado** — §6, §9, §13 (tabla) y §13.3 reescrito |
| `ci.yml`, `deploy-gate.yml`, `spec-031-frontera.test.ts`, `spec-032-frontera.test.ts` | **NO se tocan** (CA-1, CA-6) |

## Fuera de alcance

Aparcado a propósito, con su motivo:

1. **Cambiar a la integración gestionada por Neon.** Es **la solución más limpia** —tiene una
   casilla, *"Automatically delete obsolete Neon branches"*, que hace esto sin workflow ni
   secreto— y se descarta **por riesgo, no por calidad**: obliga a rehacer la conexión de un
   proyecto **en producción** y a tocar la `DATABASE_URL` de la que vive la cartera real del
   usuario. Queda escrita como **la opción a considerar si el action se queda corto**. Y queda
   dicho el corolario: **si algún día se hace, eso sí es un ADR** —reinterpreta ADR-018 D-3 y
   cambia quién gobierna las credenciales de Preview—, no un cambio de configuración.
2. **Bajar la retención de despliegues de Vercel** (*Settings → Security → Deployment
   Retention Policy → Pre-Production* al mínimo). **Descartada como solución**: la limpieza
   sigue siendo **asíncrona —horas o días—** y Vercel **protege siempre los ~10 despliegues más
   recientes**, así que **mitiga pero no resuelve**, y deja el fallo dependiendo de un plazo que
   nadie controla. Se conserva como **refuerzo opcional** → `F-SPEC-042-4`.
3. **Subir el techo de 10 ramas** (plan de pago de Neon). No se compra nada aquí. La mitad 1
   de F-SPEC-028-2 sigue abierta.
4. **Borrar las ramas de Neon ya acumuladas hoy.** Es ops, con las manos, y ya se hizo en
   parte para desbloquear el despliegue. El workflow solo actúa sobre PRs que se cierren **a
   partir de ahora**: no hay barrido retroactivo.
5. **Vigilar o alertar cuántas ramas quedan.** Exigiría un `schedule` y un umbral, y eso
   convierte esto en un **monitor**: otra cosa, con otro ciclo y otra conversación. Es
   literalmente el argumento con el que `deploy-gate.yml` rechazó su `schedule`.
6. **PRs desde un fork.** No se limpian, y es **deliberado**: en un repo público, dárselas
   limpias exige `pull_request_target` —el disparador que entrega secretos a código de
   terceros— y eso no se paga por barrer una rama. Hoy no hay contribuyentes externos (org de
   un asiento). → `F-SPEC-042-5`.
7. **Limpiar los despliegues de Vercel** (`vercel remove`, opción 2 de la guía de Neon). Otro
   recurso, otro techo, otro día.
8. **La expiración por TTL de ramas de Neon** (*branch expiration*), que la guía menciona como
   complemento. No verificada en el plan Free; no se especifica lo que no se ha comprobado.
9. **La rama `preview` suelta creada a mano** en el panel. No la creó Vercel, no la borra este
   workflow, y decidir si sobra es ops. → `F-SPEC-042-6`.
10. **Escribir el workflow, los tests o las ediciones del runbook.** Los hace el
    implementador. Esta spec **solo toca `docs/`**.

## Notas para el gate humano

Lo que hay que decidir, no lo que hay que leer.

1. **¿Esto merece ADR propio? Mi juicio: NO — y aquí está el argumento en contra, para que lo
   pese usted y no yo solo.**
   *A favor de no escribirlo (lo que recomiendo)*: no cambia ninguna decisión de ADR-018.
   D-1 a D-8 quedan literalmente igual. Lo que se añade es el **ciclo de vida** de un recurso
   que D-3 creó y no gobernó, y ese hueco ya estaba **declarado como follow-up**
   (`F-SPEC-028-2`). Un ADR que dijera *"seguimos con la integración que tenemos y le ponemos
   un barrendero"* registraría una **no-decisión**. La alternativa rechazada de peso —cambiar
   de integración— está escrita arriba (§Fuera de alcance 1) con su motivo, que es donde vive
   una opción de implementación descartada.
   *En contra (el argumento honesto)*: **el repositorio deja de tener cero secretos**, y esa
   propiedad la enunció ADR-018 D-4 como *load-bearing*. Si usted lee eso como una frontera
   del sistema y no como una propiedad del CI, **dígalo en el gate y escribo el ADR antes de
   que se implemente nada**. Sería **ADR-027** y sustituiría a §Fuera de alcance 1 más esta
   sección.
   *Tampoco propongo tocar ADR-018*: es inmutable, nada suyo queda caduco, y una nota de
   ampliación al estilo de la que dejó ADR-024 en su D-6 solo se justifica cuando alguien
   podría leer el ADR aislado y **actuar sobre un contrato caduco**. No es el caso: aquí no
   caduca ningún contrato, se cubre un hueco que ADR-018 dejó abierto con nombre.

2. **`NEON_API_KEY` en un repositorio público: ¿se puede acotar la clave al proyecto?** Es la
   pregunta de seguridad real. La clave que se cree en *Account Settings → API Keys* de Neon
   puede tener alcance de cuenta, y una clave de cuenta filtrada **puede borrar cualquier rama
   de cualquier proyecto**, incluida `main`. Si Neon permite una clave **acotada a este
   proyecto** en el plan actual, es la que hay que crear. Si no, hay que saberlo y aceptarlo con
   los ojos abiertos: los CA acotan lo que **este fichero** puede hacer (CA-4), **no** lo que
   puede hacer la clave. Que se compruebe al crearla es parte de `F-SPEC-042-2`.

3. **¿Se acepta que las URLs de preview antiguas dejen de conectar?** Es la contrapartida que
   Neon declara y no hay forma de tener las dos cosas: o la rama vive y ocupa techo, o muere y
   su preview se rompe. Con el flujo *mergear y seguir* de este proyecto no debería doler; si
   alguna vez se comparte una URL de preview con un tester, **sí dolerá**, y el sitio de
   enterarse es este párrafo y no ese día.

4. **¿Se pone la casilla *Automatically delete head branches* en el mismo lote?**
   Recomiendo que **sí** —el 2026-08-19/20 había 27 ramas mergeadas vivas—, y recomiendo con
   la misma fuerza **no confundirla con la solución**: no toca Neon. Va como acción de ops
   separada (`F-SPEC-042-3`) precisamente para que nadie la lea como *"ya está arreglado"*.

5. **Las dos acciones de ops son bloqueantes de CA-8, CA-9 y CA-10, no del merge.** El
   workflow y sus tests entran verdes sin ellas; lo que no se puede cerrar sin ellas es el
   bloque 🚀. Si el humano prefiere mergear primero y poner los valores después, el reparto
   funciona — con la salvedad de que **el primer cierre de PR dará rojo** por
   `NEON_PROJECT_ID` vacío, y conviene que sea una decisión y no una sorpresa. Es el mismo
   patrón *fail-closed* que `ALLOW_MIGRATE` (ADR-018 D-3) y la misma advertencia.

6. **Sancionar el reparto 🔒/🚀.** Siete CA verificables en el repo y tres que exigen cerrar
   una PR de verdad. Si prefiere menos CA operativos, el que **no** se puede ceder es **CA-8**:
   sin él, esta spec entrega un YAML bonito y ninguna prueba de que borre nada.

## Riesgos

- **R-1 — Un action mal apuntado borra una rama que no toca, y `main` es la cartera real del
  usuario.** Es el riesgo grave y el único con consecuencia irreversible.
  *Mitigación en la spec*: el prefijo literal `preview/` (CA-4.1), la prohibición de nombrar
  `main` (CA-4.2), la ausencia total de `run:` (CA-4.3), y la comparación antes/después del
  panel la primera vez (CA-10).
  *Residual, dicho claro*: las tres primeras acotan **lo que este fichero pide**; no acotan
  **lo que la clave puede hacer**. Eso se acota al crearla (punto 2 del gate) o no se acota. Y
  el fichero es editable: quien pueda mergear una PR puede cambiar ese valor — con la
  diferencia de que ahora habría que hacerlo **por escrito, en una PR, contra un test que lo
  congela**, en vez de a mano en un panel.
- **R-2 — Las URLs de preview viejas dejan de conectar.** Declarado por Neon, aceptado a
  cambio de la limpieza. Punto 3 del gate.
- **R-3 — Falsos rojos si la acción falla ante una rama inexistente.** Comportamiento **no
  documentado** por el README: por eso CA-9 lo mide en vez de suponerlo. Un limpiador que da
  rojo de rutina se ignora, y un check ignorado no es un check.
- **R-4 — Dos limpiadores el día que se cambie de integración.** Si algún día se pasa a la
  integración gestionada por Neon (§Fuera de alcance 1), su casilla y este workflow harían lo
  mismo, y el segundo en llegar se encontraría la rama ya borrada — que es **R-3** otra vez.
  Ese día este fichero se retira; queda escrito aquí para que se recuerde.
- **R-5 — Un secreto en un repositorio público.** Mitigado por CA-2 (nada de
  `pull_request_target`), CA-5.1 (nada de forks), CA-5.2 (sin permisos de escritura) y CA-4.3
  (sin `run:` donde pueda imprimirse). Residual: sigue siendo un secreto en un repo público, y
  la propiedad *"este repo no tiene secretos"* muere aquí.
- **R-6 — El techo sigue siendo 10.** Esta spec quita la **acumulación**, no el **techo**. Con
  varias PRs abiertas a la vez —que es lo que ya pasa en este proyecto: hay varios worktrees
  vivos— diez sigue sin ser mucho. La mitad 1 de F-SPEC-028-2 queda abierta a propósito.

## Salvedades / follow-ups declarados al nacer

Los dos primeros son **acciones de ops del humano**, no CA: no se pueden ejecutar desde el
repositorio. El patrón es el de `F-SPEC-032-2` — el **acto** es ops, el **efecto** es CA-8.

- **F-SPEC-042-1 — `NEON_PROJECT_ID` como *variable* del repositorio.** GitHub → *Settings →
  Secrets and variables → Actions → Variables → New repository variable*. El valor está en
  Neon, *Project settings*. **Variable, no secreto**: no es sensible y verla en el log ayuda a
  diagnosticar. Si falta, `vars.NEON_PROJECT_ID` llega **vacío** y el workflow da rojo. → ops.
- **F-SPEC-042-2 — `NEON_API_KEY` como *secreto* del repositorio.** Se crea en Neon, *Account
  Settings → API Keys*; se pega en GitHub → *Settings → Secrets and variables → Actions →
  Secrets*. **Al crearla, comprobar si puede acotarse al proyecto** (punto 2 del gate) y
  anotar en el ledger qué alcance tiene realmente. → ops.
- **F-SPEC-042-3 — GitHub → *Settings → General → Automatically delete head branches*,** más
  la poda de las ramas mergeadas ya acumuladas (27 el 2026-08-19/20, borradas a mano). **No
  arregla Neon**; evita que el repositorio acumule ramas muertas. Separado a propósito para que
  no se lea como la solución. → ops.
- **F-SPEC-042-4 — Refuerzo opcional: bajar la *Deployment Retention Policy* de Vercel** para
  *Pre-Production Deployments*. Mitiga (acorta los 6 meses), **no resuelve** (asíncrono, y los
  ~10 despliegues más recientes están siempre protegidos). Suma con el workflow; no lo
  sustituye. → ops, sin urgencia.
- **F-SPEC-042-5 — Las PRs desde un fork no se limpian.** Decisión de seguridad (§Fuera de
  alcance 6). El día que haya contribuyentes externos, cada PR suya dejará una rama huérfana y
  habrá que decidir entonces. → EPIC-INFRA.
- **F-SPEC-042-6 — La rama `preview` suelta del panel, creada a mano.** Ni la creó Vercel ni
  la borra este workflow. Ocupa techo. Decidir si sobra es ops. → ops.
- **Hereda de SPEC-028: F-SPEC-028-2, mitad 1 — el techo de 10 ramas del plan Free.** No se
  cierra aquí (R-6). La mitad 2 sí la cierra esta spec.
