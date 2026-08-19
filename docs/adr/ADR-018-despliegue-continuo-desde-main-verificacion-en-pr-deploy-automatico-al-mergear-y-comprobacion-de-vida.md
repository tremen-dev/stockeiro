---
id: ADR-018
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-17, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-17, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-018: Despliegue continuo desde main: verificacion en PR, deploy automatico al mergear y comprobacion de vida

> **Nota de numeración (2026-08-17).** Este ADR se redactó como *ADR-017* porque quien lo
> encargó leyó los ids libres de un worktree en una rama vieja, no de `origin/main`. Mientras
> se escribía, `main` recibió **SPEC-024**, **SPEC-025** y un **ADR-017** distinto (*baja de una
> acción vigilada*). Renumerado a **ADR-018**; el desglose de §Desglose se corrió a
> **SPEC-026/027/028**. Se deja escrito porque es el mismo fallo que este ADR combate —operar
> sobre una referencia obsoleta en lugar de sobre `main`— cometido al escribirlo.

- Deciders: propone sdd-arquitecto (2026-08-17); **aprueba el humano en el gate**. La
  decisión que más constriñe (conectar el repo a Vercel, D-1) es reversible pero visible,
  y la que más disciplina impone (política de migraciones aditivas, D-5) obliga a todas
  las specs futuras que toquen esquema: ninguna de las dos se da por buena sin firma.
- Specs relacionadas: gobierna EPIC-INFRA (*"plataforma de despliegue (Vercel), CI y salud
  técnica"*, *Dentro*: *"CI y configuración de despliegue"*). Cierra **F-SPEC-023-1**
  (`DATABASE_URL` compartida entre Production y Preview). Reinterpreta la operativa de
  despliegue de **ADR-001** (que fijó Vercel + Neon + despliegue continuo, sin decir cómo
  se dispara) sin superseder nada. Frontera dibujada con **SPEC-022** (§Frontera).
  Desglose orientativo en specs al final (§Desglose), **no autoritativo**.

## Contexto

### El defecto: mergear no es desplegar, y ningún paso del método lo mira

`docs/despliegue.md` abre con una lección fechada: EPIC-FIX (SPEC-015/016) estuvo **27 días
en `main` sin llegar a producción**. El despliegue vivo era del 20-jul y se había hecho con
`vercel --prod` desde un árbol de trabajo que no contenía esos cambios. Durante ese mes el
defecto que la épica arreglaba seguía intacto **y además mudo**, porque el diagnóstico que
lo habría delatado tampoco estaba desplegado.

No es un accidente aislado: **está repitiéndose**. SPEC-023 (recuperación de contraseña)
está `hecho` y GREEN desde el 2026-08-12 y hoy sigue sin estar viva. Y es un agujero **del
método**, no solo de la infraestructura: el ciclo tremen-sdd cierra una spec con tests y
flujo local, y **nadie mira producción**. El verificador emite GREEN contra un árbol de
trabajo; entre ese GREEN y el usuario no hay ningún paso con dueño.

Las tres causas son separables, y conviene separarlas porque cada una pide una respuesta
distinta:

1. **Desplegar es un ritual manual que hay que acordarse de ejecutar.** Se olvidó 27 días.
2. **`vercel --prod` sube el árbol de trabajo local, no `main`.** Lo que se despliega no
   está determinado por ninguna referencia de git; el nombre de la rama no importa.
3. **No hay forma barata de saber qué está vivo.** Los despliegues por CLI no dejan
   metadatos de git, así que la única pista es la fecha — y la fecha miente si el árbol era
   viejo. El runbook prescribe hoy `curl` + `grep` de una cadena que solo exista tras el
   cambio: un truco, no un mecanismo.

### Lo verificado el 2026-08-17 (no supuesto)

| Hecho | Cómo se comprobó |
|---|---|
| **No existe CI de ningún tipo.** No hay `.github/` ni en el árbol ni en `origin/main`. | `ls -a`, `git` |
| **No hay integración Vercel↔GitHub.** `vercel project inspect` no muestra repositorio conectado; las `VERCEL_GIT_*` existen y vienen **vacías**. Las PR no reportan checks. | `vercel project inspect`, `vercel env pull` |
| **Todo se despliega a mano.** 5 despliegues de producción en 34 días, todos con usuario humano, el último hace 6 días. Build de ~40 s. | `vercel ls --prod` |
| **Las 24 variables del proyecto están marcadas `Sensitive`** (write-only). `vercel env pull` las devuelve como `"[REDACTED]"`. | `vercel env ls`, `vercel env pull --environment=preview` |
| **`DATABASE_URL` está definida para `Production, Preview`** con un único valor. | `vercel env ls` |
| **El `buildCommand` migra en todos los entornos**, antes de construir: `npm run db:migrate && npm run build` (en `vercel.json`, versionado; el ajuste del panel es el `next build` por defecto). | `vercel.json`, `vercel project inspect` |
| **Ningún test estrena nunca las migraciones.** `src/db/test-db.ts` crea el esquema con SQL explícito *"para no depender de drizzle-kit en tests"*, y `tests/e2e/server.mjs` lo vuelve a crear a mano con `CREATE TABLE`. Los 7 ficheros de `drizzle/` **se ejecutan por primera vez en producción**. | `grep`, lectura de ambos ficheros |
| **La suite es autosuficiente y sin secretos**: e2e con `embedded-postgres` efímero, proveedores *fake* (`E2E_FAKE_QUOTES`, `E2E_FAKE_SYMBOL_SEARCH`) y correo a fichero (`E2E_OUTBOX_FILE`), todo inyectado por el harness al proceso hijo. | `tests/e2e/server.mjs` |
| Repo `tremen-dev/stockeiro`, **privado**. Vercel ejecuta **Node 24.x**. Plan Hobby. | `gh repo view`, `vercel project inspect` |

### Los frenos que hoy pone el humano sin saber que los pone

Automatizar el despliegue no es solo añadir un disparador: es **retirar tres frenos**
implícitos que hoy sostiene una persona. El ADR no puede limitarse a añadir el disparador.

- **Freno 1 — nadie migra si nadie despliega.** El `buildCommand` migra **antes** de
  construir; hoy lo único que se interpone entre una migración destructiva y la BD de
  producción es que un humano decide teclear `vercel --prod`.
- **Freno 2 — no hay builds de Preview.** `DATABASE_URL` es la misma en Production y
  Preview, así que un build de Preview migraría producción. La trampa está **latente solo
  porque nada dispara builds de PR**. Conectar el repo la **activa**.
- **Freno 3 — el humano mira la app después de desplegar.** Es la única comprobación de
  vida que existe, y es la que falló durante 27 días.

## Decisión

### D-1. La producción se despliega desde `main`, automáticamente, y solo desde ahí

Se conecta el repositorio `tremen-dev/stockeiro` al proyecto de Vercel mediante la
**integración Git nativa**. Un merge a `main` construye y despliega a producción sin
intervención. `vercel --prod` desde un árbol local **deja de ser la vía normal**: pasa a ser
recurso de emergencia, y el runbook lo marcará como tal con su advertencia.

Por qué la integración nativa y no un workflow que despliegue: **el build tiene que ocurrir
en Vercel**, porque es el único sitio donde viven los secretos (todas las variables son
`Sensitive` y son irrecuperables por diseño; ver §Alternativas, alternativa 2). Como efecto
colateral, la integración es también lo que devuelve los **metadatos de git** que hoy faltan
y sin los cuales D-6 no es posible.

Esto mata las causas 1 y 2 de raíz: no hay ritual que olvidar, y lo que se despliega es un
commit de `main`, no un directorio.

### D-2. El build sigue migrando, pero con una guardia *fail-closed* en el repo

`db:migrate` **se queda dentro del `buildCommand`**: su propiedad valiosa es que si la
migración falla, el `&&` corta, el build falla y **no se despliega** — se queda la versión
anterior. Eso no se toca.

Lo que se añade es una guardia previa, versionada en el repo:

```
node scripts/guard-migrate.mjs && npm run db:migrate && npm run build
```

La guardia **aborta el build** si `VERCEL_ENV` no es `production` y ese entorno no declara
explícitamente su permiso (una variable propia del entorno, p. ej. `ALLOW_MIGRATE=1`). El
nombre y la forma exacta los fija la spec; lo que fija este ADR es la propiedad:

> **Un build que no sea de producción no migra, salvo que el entorno donde corre lo
> autorice de forma explícita.** Por omisión, no migra: falla.

Es *fail-closed*, vive en el repo (no en un ajuste del panel que nadie audita), es
verificable con un test unitario, y sobrevive a cualquier reconfiguración de Vercel.
Convierte el freno 2 de *"la trampa está latente porque nada la dispara"* en *"la trampa
está cerrada porque el código se niega"*.

### D-3. Ningún entorno que no sea Production tendrá credenciales de la BD de Production

Invariante, y es la respuesta a **F-SPEC-023-1**. Se materializa con una **base de datos de
Preview aparte** (rama de Neon), con su propia `DATABASE_URL` limitada al entorno Preview, y
`ALLOW_MIGRATE` puesto **solo ahí** una vez separada.

Orden y grado de bloqueo, que importan:

- Mientras esa separación no exista, Preview **no** lleva permiso de migración: sus builds
  fallan **en rojo y en la PR**, nunca en silencio contra producción. Esto es lo que permite
  desacoplar el orden: D-2 hace que conectar el repo (D-1) sea seguro **antes** de tener la
  BD de Preview, a cambio de no tener previews útiles hasta entonces.
- La separación deja de ser prerrequisito de *desplegar* y pasa a ser prerrequisito de
  *tener previews*. Sigue siendo obligatoria: sin ella, media épica de valor (revisar una PR
  en una URL real) queda apagada.

### D-4. La verificación se adelanta a la PR, y no toca ningún secreto

Un workflow de GitHub Actions corre en **cada PR y cada push a `main`**: instalación,
`typecheck`, `eslint`, unitarios (Vitest/PGlite), e2e (Playwright) y —lo nuevo—
**estreno de las migraciones desde cero** (`db:migrate` sobre un Postgres desechable
levantado en el propio runner, seguido de una comprobación de que el esquema resultante es
el que la app espera). Node 24, para igualar a Vercel.

Dos propiedades, ambas verificadas hoy y ambas load-bearing:

1. **El CI no necesita ni un secreto.** El e2e trae su propio Postgres y sus proveedores
   *fake*; `next build` solo exige que `DATABASE_URL` **exista**, y le vale una de juguete.
   Un CI sin secretos es un CI que no puede filtrar nada ni tumbar nada.
2. **El CI no puede migrar nada gestionado, por construcción.** `vercel.json` es
   configuración *de Vercel*: un runner que ejecuta `npm run build` **no** ejecuta el
   `buildCommand`, y por tanto **no** ejecuta `db:migrate`. Añadir CI, por sí solo, no
   activa la trampa del freno 2. Eso convierte a D-4 en el primer paso seguro.

Regla dura asociada: **el CI nunca apunta `db:migrate` a una base gestionada** (ni Neon de
producción, ni de preview). Solo a Postgres efímero del runner. Y `E2E_OUTBOX_FILE` vive
únicamente dentro del harness de e2e, jamás como variable de un entorno de Vercel
(F-SPEC-023-8).

### D-5. El freno ante una migración destructiva se sustituye por tres cosas, no por una

Ninguna sola sustituye al humano que decide desplegar. Las tres juntas, sí:

1. **Política de migraciones aditivas (*expand/contract*), como regla del proyecto.** Una
   migración no borra, no renombra y no estrecha una columna **en el mismo despliegue** que
   cambia el código. Lo destructivo se parte en dos despliegues separados por al menos un
   despliegue verde: primero se añade y se rellena, después —en otra spec— se retira lo
   viejo. Es lo que SPEC-023 ya hizo de facto (`CREATE TABLE` + `ADD COLUMN … DEFAULT now()`,
   ambas compatibles hacia atrás); aquí se eleva de costumbre a regla.
2. **Detección automática, no confianza.** Un check del CI escanea las migraciones nuevas de
   la PR buscando SQL destructivo (`DROP`, `RENAME`, `TRUNCATE`, `DELETE FROM`, `ALTER
   COLUMN … SET NOT NULL`/`TYPE`) y **falla la PR**. El desbloqueo es explícito y queda
   escrito: una marca deliberada en la PR con la justificación y el plan de vuelta atrás.
   El freno pasa de *"el humano se acuerda de mirar"* a *"el humano tiene que decir que sí
   por escrito"*. Calibración medida, no supuesta: de las **8** migraciones que hoy tiene
   `main` el escáner marcaría **dos** — `0001` (un `DROP CONSTRAINT` que relaja una unicidad)
   y `0007` (SPEC-024: quita y repone dos claves foráneas para darles `ON DELETE cascade` /
   `set null`). Ambas son legítimas y ambas merecen que alguien las mire: `0007` **habilita
   borrados en cascada**, que es justo el tipo de cambio que no debe entrar sin que nadie lo
   lea. Dos marcas de ocho es ruido asumible, y las dos son verdaderos positivos.
3. **El estreno en CI de D-4.** Hoy la primera vez que una migración se ejecuta es **en
   producción**, porque ningún test la toca. Con D-4 se estrena en cada PR contra un
   Postgres desechable. Esto no es un extra: es el freno que más se parece al que se retira,
   porque es el único que puede decir *"esta migración ni siquiera aplica"* antes de que
   aplique en Neon.

Y lo que **no** protege, dicho en voz alta para que nadie se apoye en ello: **`vercel
rollback` devuelve el código, no el esquema.** Un rollback tras una migración destructiva
deja código viejo contra un esquema mutilado. Por eso la defensa real son 1–3, y la red
última es el historial de restauración de Neon (cuya ventana en el plan actual hay que
confirmar antes de contar con ella — §Preguntas del gate).

### D-6. El despliegue publica su identidad, y se comprueba desde fuera

> **D-6 enmendado por ADR-024 (2026-08-19)**: el contrato de `/api/version` pasa de tres
> claves a cuatro — se le añade `version` (semver de producto, con fuente en
> `package.json`). El resto de D-6 queda **intacto**: sigue respondiendo con la BD caída,
> sigue sin exponer dato personal, el valor sigue congelado con el artefacto y la sentinela
> de lo desconocido sigue siendo la alarma. Ningún otro punto de este ADR (D-1 a D-5, D-7)
> queda afectado.
> *La decisión original no se reescribe: esta nota solo evita que alguien lea D-6 aislado y
> actúe sobre un contrato caduco.*

Se añade un endpoint público `/api/version` que responde, como mínimo, **el sha del commit
del que se construyó el artefacto**, el entorno y el instante del build. Restricciones de
diseño (mecanismo libre, propiedades obligatorias):

- **El valor va congelado con el artefacto.** No puede leerse de algo que alguien pueda
  cambiar después sin reconstruir: si cambia sin build, la comprobación miente.
- **No consulta la base de datos ni nada del usuario.** Debe poder responder con la BD caída
  — es justo cuando más falta hace. Por construcción no expone dato personal ninguno.
- **Si no hay metadatos de git, responde `desconocido`, y eso es la alarma**, no un detalle
  cosmético: significa *"este despliegue no sabe de dónde viene"*, que es exactamente lo que
  son hoy los 5 despliegues vivos del proyecto.

Encima de eso, **una puerta automática tras cada despliegue**: un paso que espera a que
`/api/version` en el dominio de producción devuelva el sha mergeado, y **falla si no llega**
en un plazo. Sustituye al freno 3 —el humano que abría la app— por algo que no se olvida, y
retira del runbook el truco del `curl | grep` de una cadena inventada.

### D-7. "Hecho" pasa a significar "vivo" (recomendación de proceso, requiere firma)

La lección del 2026-08-11 dice que *ningún paso del ciclo tremen-sdd lo detectó*. Se
recomienda cerrar ese agujero: **una spec no se da por entregada hasta que `/api/version`
responde un commit que la contiene.** D-6 hace que eso sea una comprobación de un segundo.

Se marca como recomendación y no como decisión ejecutable de este repo porque el ciclo
tremen-sdd es del plugin, no de Stockeiro: adoptarlo aquí es una convención local
(y probablemente un `KI-2` para el mantenedor del plugin). Decide el humano.

### D-8. Nada de lo anterior exige plan de pago

La integración Git de Vercel, las previews y el rollback están en Hobby; el cron sigue
siendo diario por la misma razón de siempre (runbook §3.3) y este ADR no lo toca. GitHub
Actions sobre repo privado consume minutos de la cuota gratuita (~2.000/mes en el plan
Free; una pasada completa aquí ronda los 6–9 min). Quedan dos confirmaciones de coste
listadas en §Preguntas del gate: la rama de Preview en el plan de Neon y la protección de
las URLs de preview en Hobby.

## Consecuencias

### Positivas

- **Los dos fallos históricos se vuelven estructuralmente imposibles**: no se puede olvidar
  desplegar (D-1) y no se puede desplegar un árbol equivocado (D-1: el artefacto sale de un
  commit, no de un directorio).
- **El gate se mueve al sitio correcto.** Hoy la única barrera antes de producción es que
  alguien esté cansado a las 2 de la mañana; después, la barrera es una PR con typecheck,
  lint, 253 unitarios, 24 e2e, migraciones estrenadas y escáner de SQL destructivo.
- **Las migraciones dejan de estrenarse en producción**, que es probablemente el riesgo
  mayor de todo el sistema y hoy no lo cubre nadie.
- **Se cierra F-SPEC-023-1** con una invariante (D-3) *y* con un mecanismo que no depende de
  que la invariante se respete (D-2).
- **El CI llega sin secretos y sin poder tocar nada gestionado**, lo que permite empezar por
  él sin negociar riesgo.
- **La pregunta "¿está vivo?" pasa a tener respuesta de un `curl`**, verdadera y barata, en
  lugar de un truco frágil.

### Negativas / follow-ups

- **Se renuncia a un gate de aprobación humano justo antes de producción.** Vercel no ofrece
  aprobación previa al despliegue; la única vía que la daría es construir en GitHub Actions,
  rechazada por coste de secretos (§Alternativas, 2). Si el humano quiere conservar ese
  gate, la alternativa 4 es el repliegue exacto y cambia solo el disparador.
- **La invalidación de sesiones (ADR-016) queda atada al merge.** Cualquier despliegue con
  cambio de época de credencial cierra la sesión de todos los usuarios una vez; con
  auto-deploy, ese instante lo fija **quien mergea**, no una decisión aparte. El runbook ya
  advierte de no hacerlo coincidir con la invitación a testers: ahora esa advertencia hay
  que leerla **antes de mergear**, no antes de desplegar.
- **La dependencia del build con `cdn.sheetjs.com` (F-SPEC-011-1) se hereda en el runner**:
  si GitHub no alcanza ese host, el CI muere en `npm ci`. Efecto neto **positivo** —una
  caída del CDN pasa a verse en la PR y no como sorpresa en el despliegue—, pero si resulta
  inestable habrá que replegarse (caché de npm, o vendorizar el tarball), y esa es decisión
  de SPEC-011, no de este ADR.
- **Previews públicas**: mientras no exista la BD de Preview no habrá previews (fallarán en
  la guardia, a propósito). Cuando existan, hay que confirmar si Hobby protege sus URLs; si
  no, la BD de Preview debe considerarse de juguete y no recibir datos reales nunca.
- **Deriva entre `drizzle/` y el DDL escrito a mano** de `test-db.ts` y `tests/e2e/server.mjs`:
  hoy son tres fuentes del mismo esquema y nada las compara. D-4 la delata pero no la
  elimina; unificarlas es follow-up, no parte de esta decisión.
- **El CI no sustituye al verificador** ni cierra specs: es una red de no-regresión, no un
  gate adversarial. El ciclo tremen-sdd sigue igual salvo por D-7, si se aprueba.
- **Un check rojo en `main`** (por ejemplo, la puerta de vida de D-6) no revierte nada por sí
  solo: avisa. La reversión sigue siendo `vercel rollback` + criterio humano.

## Alternativas consideradas

1. **Statu quo con un guardián local.** Un script que aborte `vercel --prod` si `HEAD` no es
   `origin/main` o el árbol está sucio. **Coste**: ~1 h, riesgo cero, ninguna dependencia.
   **Rechazada como respuesta**: arregla la causa 2 (árbol equivocado) y no toca la 1 (el
   olvido), que es la que costó 27 días y va camino de repetirse con SPEC-023. Se conserva
   como **mitigación puente** en el runbook mientras D-1 no esté vivo: es barata y suma.
2. **Construir en GitHub Actions y desplegar con `vercel deploy --prebuilt`.** Daría control
   total del pipeline y permitiría un gate de aprobación con *environments* de GitHub.
   **Rechazada por un hecho verificado hoy**: las 24 variables del proyecto están marcadas
   `Sensitive` y `vercel env pull` las devuelve como `"[REDACTED]"` — son irrecuperables por
   diseño. Construir fuera de Vercel obligaría a **duplicar los 9+ secretos reales** (entre
   ellos la `DATABASE_URL` de producción y `CRON_SECRET`) en GitHub Secrets: dos fuentes de
   verdad que derivan en silencio, una copia más de la credencial de producción, y la
   migración de producción ejecutándose dentro de un runner efímero de terceros. **Coste
   permanente y alto** para ganar un gate de aprobación.
3. **Desplegar preview al mergear y promover a mano con `vercel promote`.** Suena al término
   medio ideal. **Rechazada por incompatibilidad técnica, no por gusto**: `promote` **no
   reconstruye**, solo reapunta el alias de producción al artefacto ya construido. Con
   `db:migrate` dentro del `buildCommand`, el artefacto se construyó contra la BD de
   *Preview*: promoverlo pondría **código nuevo contra el esquema viejo de producción**, sin
   que nadie lo note hasta el primer error de columna inexistente. Sería viable solo sacando
   la migración del build (alternativa 5), y entonces hereda sus costes.
4. **Rama `production` como disparador** (merge a `main` = preview; *fast-forward* de
   `production` = despliegue). Conserva un punto de decisión humano y arregla igual la causa
   2, porque el artefacto sale de una referencia de git. **Rechazada** porque mantiene un
   ritual manual que hay que acordarse de ejecutar, que es **exactamente el mecanismo que
   falló durante 27 días**. Se documenta con detalle porque es el **repliegue natural** si
   el humano no acepta el despliegue automático: el resto del ADR (D-2 a D-8) se sostiene
   sin cambios; solo cambia el disparador de D-1.
5. **Sacar `db:migrate` del `buildCommand`** y migrar en un paso aparte, antes o después del
   despliegue. **Rechazada**: pierde la propiedad *fail-closed* actual (migración rota ⇒
   build roto ⇒ no se despliega, se queda la versión anterior) y exige la `DATABASE_URL` de
   producción fuera de Vercel, que es la misma pared que tumbó la alternativa 2. Además
   diagnostica mal el problema: lo peligroso no es *dónde* migra, es que **nadie estrena la
   migración antes**; eso lo arregla D-4, no mover el comando.
6. **Cambiar de plataforma de despliegue** para tener gates nativos. **Rechazada**:
   contradice ADR-001, y el defecto no es de Vercel — es de un proceso que dependía de la
   memoria de una persona.

## Frontera con SPEC-022 (observabilidad del ciclo de refresco)

Ambas cosas sirven al mismo rol —el **Operador** de `dominio.md`— y por eso se rozan. La
línea es limpia y conviene dejarla escrita antes de que las dos estén en vuelo:

| | SPEC-022 | Este ADR (D-6) |
|---|---|---|
| Pregunta que responde | ¿Qué hizo el **ciclo diario** de refresco? | ¿Qué **código** está vivo, y desde cuándo? |
| Sujeto | Una ejecución del cron | Un artefacto de despliegue |
| Canal | `console` estructurado → `vercel logs` | Endpoint HTTP público `/api/version` |
| Frecuencia | Una línea por ejecución (diaria) | Constante mientras el despliegue viva |
| Toca la BD | Sí (proyecta `CycleResult`) | **Nunca** (debe responder con la BD caída) |
| Dominio de fallo | El proveedor de datos, el ciclo | El pipeline de despliegue |

Reglas de no solapamiento: **`/api/version` no dice nada de ciclos**, y **el resumen de
ciclo no dice nada de versiones**. Ninguna de las dos introduce *alerting*: si algún día se
quiere avisar al operador, es una decisión aparte que las abarcaría a ambas.

Costura opcional, explícitamente **no** requerida aquí: si en el futuro interesa correlacionar
*"el ciclo que falló, ¿con qué build corría?"*, la fuente sería la misma constante congelada
en el build de D-6, y sería follow-up de la que aterrice segunda. No se pide ahora.

## Desglose orientativo en specs — NO autoritativo

Propuesta de troceado, para que el humano la juzgue en el gate. **No es parte de la
decisión** y ninguna de estas specs está escrita: se escribirán cuando y como el humano
diga, y solo entonces se fijan ids y alcance.

| # | Trabajo | Artefacto sugerido | Prerrequisitos | Por qué en este orden |
|---|---|---|---|---|
| 1 | **CI de verificación en PR** (typecheck, lint, unit, e2e, **estreno de migraciones**, escáner de SQL destructivo) + guardia `guard-migrate` con su test | SPEC-026 | **ninguno** | Es el único paso sin secretos y sin poder tocar nada gestionado (D-4.2). Entrega valor inmediato y **deja armadas** las dos defensas (D-2, D-5) antes de que exista el riesgo que mitigan. |
| 2 | **BD de Preview separada** (rama de Neon, `DATABASE_URL` propia, `ALLOW_MIGRATE` solo ahí) | **Acción de ops, no spec** | 1 | No cambia una línea del repo: es configuración de plataforma. El proyecto ya tiene precedente y sitio para esto (`docs/roadmap.md` §"Ops y despliegue", donde viven F-SPEC-001-2 y F-SPEC-004-1 con su ✅). Su evidencia es un `vercel env ls preview` pegado en el runbook. **Cierra F-SPEC-023-1.** |
| 3 | **Identidad del despliegue**: `/api/version` + comprobación de vida reutilizable | SPEC-027 | 1 | Código de app con CA testables de verdad (congelado en build, sin BD, `desconocido` sin git). Debe existir **antes** de automatizar el despliegue, para que el despliegue automático nazca ya verificándose. Útil desde el minuto uno: hoy respondería `desconocido`, que es el diagnóstico correcto. |
| 4 | **Despliegue automático desde `main`** (conexión Git, puerta post-deploy que exige el sha, reescritura del runbook) | SPEC-028 | 2 y 3 | Es el paso que retira los frenos; solo es sensato cuando sus tres sustitutos ya están vivos. |

Notas del troceado, por si se prefiere otro corte:

- **1 podría partirse en dos** (CI "a secas" / guardias de migración). No se recomienda: la
  guardia y el escáner **son** el sustituto del freno humano, y separarlos abre una ventana
  en la que existe la automatización sin su contrapeso.
- **2 podría ser spec** si el humano prefiere que pase por gate formal. El coste es papeleo;
  el beneficio, trazabilidad. Como acción de ops se cierra igual de trazable, con el patrón
  que el proyecto ya usa.
- **3 y 4 podrían fusionarse.** No se recomienda: 3 es código de aplicación con CA
  verificables por tests; 4 es casi todo configuración de plataforma y un workflow. Mezclar
  los dos deja una spec que el verificador no puede cerrar sin desplegar.

## Preguntas del gate

Las que **deciden**, no las que informan:

1. **¿Se conecta el repo a Vercel (D-1), con despliegue automático al mergear?** Si la
   respuesta es "no sin que yo mire", la alternativa 4 (rama `production`) es el repliegue y
   el resto del ADR no cambia. Es la pregunta que gobierna todas las demás.
2. **¿Se acepta la política de migraciones aditivas (D-5.1) como regla del proyecto**, con
   desbloqueo explícito y escrito en la PR? Vincula a todas las specs futuras que toquen
   esquema, así que probablemente merece una línea en `docs/fundacion/reglas.md`.
3. **¿"Hecho" pasa a exigir "vivo" (D-7)?** ¿El verificador no cierra una spec hasta que
   `/api/version` la contiene, o queda como comprobación del despliegue? Toca el ciclo
   tremen-sdd, no solo este repo.
4. **BD de Preview: ¿rama fija de Neon o rama por despliegue?** Y sobre todo: **¿cabe en el
   plan actual de Neon sin coste?** Es la única pieza del plan cuyo precio no está
   verificado.
5. **¿Quedan protegidas las URLs de preview en el plan Hobby?** Si no, la BD de Preview es
   de juguete por decreto y nunca recibe datos reales.
6. **¿El e2e completo entra en cada PR, o solo en `main`?** Cuota de GitHub Actions (repo
   privado) contra red de seguridad. Recomendación: en cada PR — a ~6-9 min por pasada, la
   cuota gratuita da de sobra y el e2e es justamente lo que atrapa las regresiones de flujo.
7. **¿Cuál es la ventana real de restauración de Neon en el plan actual?** Es la red última
   ante una migración destructiva y hoy nadie la ha comprobado. Si es corta, la política de
   D-5.1 deja de ser prudencia y pasa a ser lo único que hay.
8. **¿Se despliega SPEC-023 antes o después de todo esto?** Está `hecho` y muda desde el
   2026-08-12, y su despliegue cierra la sesión de todos los usuarios (ADR-016). Desplegarla
   a mano ya (con el runbook §8) es defendible; hacerla el primer pasajero del pipeline nuevo
   también, pero acopla dos riesgos independientes en un solo día.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
