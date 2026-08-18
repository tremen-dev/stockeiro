---
id: SPEC-031
tipo: spec
epica: EPIC-INFRA
estado: en-revision
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-18, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-18, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-18, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-18, por: sdd-implementador}
---
# SPEC-031 — El despliegue dice de qué commit viene: `/api/version` y comprobación de vida

> Implementa el punto **3** del desglose orientativo de **ADR-018** (*Despliegue continuo
> desde `main`*), aprobado por el humano el 2026-08-17: *"Identidad del despliegue:
> `/api/version` + comprobación de vida reutilizable. Código de app con CA testables de
> verdad (congelado en build, sin BD, `desconocido` sin git). Debe existir **antes** de
> automatizar el despliegue, para que el despliegue automático nazca ya verificándose."*
>
> El punto **4** (conectar el repo a Vercel, puerta post-deploy, reescritura del runbook para
> despliegue automático) es **SPEC-028**, cuyo id queda reservado y referenciado por nombre
> desde ADR-018 y desde el ledger de SPEC-027. ADR-018 pide explícitamente **no fusionar 3 y
> 4**: *"3 es código de aplicación con CA verificables por tests; 4 es casi todo configuración
> de plataforma y un workflow. Mezclar los dos deja una spec que el verificador no puede
> cerrar sin desplegar."* **Esta spec se cierra en local y en CI, sin desplegar nada.**

## Problema

**Nadie puede preguntarle a producción qué código está corriendo.**

No es una carencia teórica: es la causa raíz del incidente fechado que abre
`docs/despliegue.md`. EPIC-FIX (SPEC-015/016) estuvo **27 días en `main` sin llegar a
producción** y nadie lo notó, porque el único indicio disponible era la **fecha** del último
despliegue — y la fecha miente cuando el despliegue se hizo por CLI desde un árbol de trabajo
viejo. Está repitiéndose ahora mismo con **SPEC-023**, `hecho` y GREEN desde el 2026-08-12 y
todavía muda.

Las tres piezas del agujero, hoy:

1. **Los despliegues vivos no saben de dónde vienen.** ADR-018 verificó el 2026-08-17 que no
   hay integración Vercel↔GitHub y que las variables `VERCEL_GIT_*` **existen y llegan
   vacías**. Los 5 despliegues de producción del proyecto se hicieron por CLI; el runbook §6
   documenta además que **desplegar desde un git worktree pierde los metadatos de git**
   (`.git` es un fichero, no un directorio, y la CLI avisa con `Error while parsing repo
   data`). No hay commit asociado a lo que está vivo.
2. **La comprobación que prescribe el runbook es un truco, no un mecanismo.** Hoy dice:
   `curl -s https://…/forgot-password | grep -o "forgot-password"` (§8, paso 8). Funciona una
   vez, para una spec, si a alguien se le ocurre una cadena que solo exista tras ese cambio.
   No es reutilizable, no distingue *"no está desplegado"* de *"el HTML cambió de forma"*, y
   hay que inventarlo de nuevo en cada entrega.
3. **SPEC-028 no puede nacer verificándose sin esto.** La puerta post-deploy de ADR-018 D-6
   —*"un paso que espera a que `/api/version` en el dominio de producción devuelva el sha
   mergeado, y falla si no llega en un plazo"*— necesita que el endpoint exista y que exista
   algo que lo interrogue. Si las dos cosas entran con la conexión a Vercel, entran sin
   probar, en la misma spec que retira los frenos.

Ninguna regla de negocio (`docs/fundacion/reglas.md`, RN-01…RN-15) está implicada: esta spec
no toca dominio. Sirve al **operador** —quien despliega y responde de que la app esté viva—,
que hoy no tiene ningún instrumento y trabaja por indicios.

## Usuarios / roles afectados

- **Operador / mantenedor** (el humano que despliega, y mañana la puerta automática de
  SPEC-028): es quien pregunta *"¿qué está vivo?"* y hoy no tiene a quién preguntar.
- **sdd-verificador**, si el humano aprueba **ADR-018 D-7** (*"hecho" pasa a exigir "vivo"*):
  esta spec es la que hace que esa comprobación cueste un segundo. La adopción de D-7 **no se
  decide aquí** (§Notas para el gate).
- **Usuario final**: no percibe nada. El endpoint es público pero no aporta ni consume dato
  suyo, y ninguna pantalla cambia.

## Criterios de aceptación

Todos se verifican **en local y en CI, sin desplegar**. Se apoyan en tres formas de prueba
que el proyecto ya usa:

- **Unitarios (Vitest)** sobre una función pura y sobre el manejador de ruta importado
  directamente.
- **Tests estáticos** que leen y parsean ficheros de configuración, al estilo de
  `tests/ci-workflow.test.ts` (SPEC-027): parsear, no regex sobre el texto.
- **Subproceso real** para el script de comprobación de vida: se ejecuta con `execFile`
  contra un servidor HTTP de juguete levantado con `node:http` **dentro del propio test**.
  No hace falta desplegar para probar un cliente HTTP; hace falta un servidor, y eso es
  gratis.

### El endpoint

- **CA-1 (Existe, es público y su cuerpo es exactamente el contrato).**
  Dado un despliegue de la app,
  cuando se hace `GET /api/version` **sin sesión**,
  entonces responde **200** con `Content-Type: application/json` y un cuerpo cuyo conjunto de
  claves es **exactamente** `{ commit, environment, builtAt }` — ni una más.
  *Por qué "exactamente"*: es la forma verificable de las dos restricciones de ADR-018 D-6
  (*"por construcción no expone dato personal ninguno"*) y de la regla de no solapamiento de
  §Frontera (*"`/api/version` no dice nada de ciclos"*). Una aserción de igualdad de claves
  detecta cualquier campo que alguien añada después sin pensarlo.
  *Nota de diseño, no accidental*: **no** se incluye la rama (`VERCEL_GIT_COMMIT_REF`). El sha
  identifica el artefacto sin ambigüedad; la rama solo añade superficie.
  *Verificación*: unitario sobre el manejador (200, cabecera, igualdad exacta del conjunto de
  claves) + e2e Playwright contra el servidor real (`/api/version` responde sin cookie de
  sesión). El `matcher` de `src/proxy.ts` ya excluye `/api`, así que el endpoint es público
  por construcción; el e2e lo ancla para que una futura edición del matcher lo rompa en rojo.

- **CA-2 (La identidad va congelada con el artefacto).**
  Dado el módulo que resuelve la identidad,
  cuando se sirven dos peticiones y **entre ellas se muta `process.env`**,
  entonces las dos respuestas son **idénticas**: la identidad se resuelve **una sola vez**, al
  cargar el módulo, nunca por petición.
  Y, en el plano estático: los tres valores llegan por un **canal de tiempo de build** —
  declarado en `next.config.mjs` bajo `env`, derivado de `VERCEL_GIT_COMMIT_SHA` / `VERCEL_ENV`
  y del instante del build— y **ningún módulo servido en runtime lee `VERCEL_GIT_*`
  directamente**.
  *Por qué las dos mitades*: ADR-018 D-6 exige que *"si cambia sin build, la comprobación
  miente"*. La mitad estática prueba de **dónde** sale el valor (`env` de Next lo sustituye
  por un literal en tiempo de compilación); la mitad dinámica prueba que **nadie lo relee**.
  *Verificación*: unitario de la mutación de entorno + test estático que parsea
  `next.config.mjs` y comprueba (a) que declara las tres claves bajo `env`, (b) que sus
  valores derivan de las variables de Vercel, y (c) que `grep` de `VERCEL_GIT_` sobre `src/`
  no devuelve nada.

- **CA-3 (`unknown` es una respuesta, y la cadena vacía cuenta como ausencia).**
  Dada la función pura que resuelve la identidad a partir de un entorno,
  cuando ese entorno **no trae** el sha, lo trae **vacío** (`''`), lo trae con solo espacios,
  o lo trae con una forma que **no es un sha hexadecimal** (`[0-9a-f]{7,40}`),
  entonces `commit` vale exactamente **`"unknown"`**; y lo mismo, con la misma regla, para
  `environment` (que además solo admite `production`/`preview`/`development`) y para `builtAt`
  (que solo admite un ISO-8601 válido).
  Y en los cuatro casos el endpoint **sigue respondiendo 200**: la alarma es el **contenido**,
  no el código de estado — interpretar es trabajo de la comprobación de vida (CA-11), no del
  endpoint.
  *Por qué la cadena vacía es el caso importante y no un detalle*: es **el caso real de hoy**.
  ADR-018 verificó que sin integración Git las `VERCEL_GIT_*` **existen y vienen vacías**; un
  `??` en vez de una comprobación de contenido devolvería `""` y el endpoint diría que sabe de
  dónde viene cuando no lo sabe. Un test con `VERCEL_GIT_COMMIT_SHA=''` es la diferencia entre
  la implementación correcta y la que parece correcta.
  > **Nota sobre la letra de ADR-018 D-6.** El ADR escribe la sentinela en español
  > (*"responde `desconocido`"*). Esta spec la fija en **`unknown`** por **decisión del humano
  > en el gate del 2026-08-18**: el valor viaja en un JSON cuyas claves ya están en inglés, y
  > la regla del proyecto es *código e identificadores en inglés*. **No se aparta de la
  > decisión de D-6, solo de su redacción**: D-6 fija propiedades (*"mecanismo libre,
  > propiedades obligatorias"*) —que exista un valor distinguible para *"este despliegue no
  > sabe de dónde viene"*—, no el nombre de ese valor. La cita del ADR se deja intacta donde
  > aparece; el ADR es inmutable y no se toca.
  *Verificación*: unitarios exhaustivos, un caso por combinación.

- **CA-4 (Fallback a git local, y nunca tumba el build).**
  Dado un build fuera de Vercel (local, o CI) donde `VERCEL_GIT_COMMIT_SHA` no aporta nada,
  cuando el repositorio **sí** tiene git usable,
  entonces la identidad toma el sha de `git rev-parse HEAD`;
  y cuando **no** lo tiene —binario ausente, directorio sin repositorio, o el `git` que falla
  con código distinto de cero—, la resolución devuelve `unknown` **sin lanzar excepción y
  sin hacer fallar el build**.
  *Por qué*: un build que muere porque `git` no está es peor que un build que no sabe de dónde
  viene. `unknown` es información; un build roto no lo es.
  *Verificación*: unitario con el ejecutable de git sustituido/inaccesible (`PATH` recortado)
  y comprobación de que la función devuelve `unknown` en vez de propagar el error.
  *Alcance del fallback*: **solo builds locales**. En Vercel el código se sube sin `.git`, así
  que el fallback no se dispara allí — y es correcto que no se dispare (§Notas para el gate).

- **CA-5 (Responde con la base de datos caída).**
  Dado el manejador de `/api/version`,
  cuando se recorre su **grafo de imports transitivo**,
  entonces no contiene **ningún módulo bajo `src/db/`** ni cliente de base de datos alguno;
  y cuando se invoca el manejador con `DATABASE_URL` **sin definir**, responde **200** con el
  cuerpo completo.
  *Por qué el grafo y no solo la llamada*: la llamada pasa hoy por accidente (nadie ha
  importado la BD todavía); el grafo prueba la **propiedad** que ADR-018 D-6 exige —*"debe
  poder responder con la BD caída — es justo cuando más falta hace"*— y falla el día en que
  alguien añada un import inocente.
  *Verificación*: test estático que resuelve los imports desde el fichero de la ruta +
  unitario sin `DATABASE_URL`.

- **CA-6 (No se cachea: una respuesta cacheada es peor que ninguna).**
  Dado `GET /api/version`,
  cuando se inspecciona la respuesta,
  entonces lleva **`Cache-Control: no-store`** y la ruta declara render dinámico
  (`export const dynamic = 'force-dynamic'`).
  *Por qué*: la comprobación de vida interroga el **alias de producción**. Si una capa
  intermedia puede servirle la respuesta de un despliegue anterior, la comprobación diría
  "vivo" sobre código que ya no está — exactamente el fallo que esta spec viene a cerrar, pero
  ahora con un sello de aprobación automático encima. Es peor que no comprobar.
  *Verificación*: unitario sobre las cabeceras del manejador + e2e contra el servidor real.

- **CA-7 (No dice nada de ciclos: la frontera de ADR-018 §Frontera, verificada contra el
  código).**
  Dado el manejador de `/api/version`,
  cuando se recorre su grafo de imports transitivo,
  entonces no alcanza **nada del ciclo de refresco** (`src/lib/market/`, `src/lib/triggers/`,
  `src/lib/notifications/`, `src/app/api/cron/`), y el cuerpo no contiene ningún campo de
  ejecución del ciclo.
  *Por qué es un CA y no una nota*: ADR-018 §Frontera lo escribe como **regla dura** —
  *"`/api/version` no dice nada de ciclos, y el resumen de ciclo no dice nada de versiones"*—
  y las dos cosas sirven al mismo rol, así que la presión para fusionarlas llegará. Un test lo
  impide; un párrafo, no.
  *Sobre SPEC-022*: ADR-018 llama así a la spec de observabilidad del ciclo, pero **ese
  documento no existe** — el id está libre en `origin/main`. Da igual para este CA: lo que
  CA-7 mantiene separado es el **ciclo de refresco ya implementado**, no una spec futura, así
  que se verifica igual hoy y no hay que esperar a nadie ni adivinar qué id llevará.
  *Verificación*: el mismo test estático de grafo de CA-5, con la lista de prefijos prohibidos
  ampliada.

### La comprobación de vida

- **CA-8 (Existe, es reutilizable y no puede filtrar nada).**
  Dado el repositorio,
  cuando se añade `scripts/check-alive.mjs` (primer habitante de `scripts/`, que hoy no
  existe),
  entonces:
  1. Se invoca como
     `node scripts/check-alive.mjs --url <origen> [--commit <sha>] [--timeout <s>] [--interval <s>]`,
     con `--url` obligatorio y `--commit` opcional, y `--help` imprime ese contrato.
  2. **No importa nada fuera de la biblioteca estándar de Node** (`node:*`): ni una
     dependencia de `package.json`, ni el código de la app. Debe poder ejecutarse en un runner
     con solo el repositorio clonado.
  3. **No lee ninguna variable de entorno con secretos** ni acepta credenciales: solo habla
     HTTP con un endpoint público. Es la propiedad que permitirá a SPEC-028 llamarlo desde un
     paso sin secretos, igual que el CI de SPEC-027 (ADR-018 D-4.1).
  4. Los **códigos de salida** son parte del contrato y están documentados en la cabecera del
     fichero: **0** coincide · **1** no coincide o se agotó el plazo · **2** el despliegue
     responde `unknown` · **3** uso incorrecto o respuesta ininteligible.
  *Verificación*: test estático (existe, sus `import` son todos `node:*`, no hay lectura de
  `process.env` salvo las que el propio contrato declare) + ejecución de `--help`.
  *Por qué códigos distintos y no un booleano*: SPEC-028 tendrá que distinguir *"aún no ha
  llegado"* de *"este despliegue no sabe de dónde viene"*, y esa distinción no se puede
  reconstruir después leyendo un log.

- **CA-9 (Verde cuando el despliegue lleva el commit esperado).**
  Dado un servidor que responde en `/api/version` un `commit` igual al pasado en `--commit`,
  cuando se ejecuta el script,
  entonces **sale con 0** e imprime la identidad completa (commit, entorno, instante del
  build) en su salida estándar.
  Y sin `--commit`: sale con **0** si la identidad está bien formada y `commit` **no** es
  `unknown` — modo *smoke*, el que sustituye hoy al truco del runbook.
  *Verificación*: subproceso contra servidor `node:http` local, en las dos formas.

- **CA-10 (Rojo cuando no llega, y con qué se necesita para diagnosticar).**
  Dado un servidor que responde siempre un `commit` **distinto** del esperado,
  cuando se ejecuta con un `--timeout` corto,
  entonces **sale con 1** dentro del plazo (con margen), y su salida de error nombra **las dos
  cosas**: el sha **esperado** y el **último visto**.
  *Por qué el último visto*: sin él, el mensaje solo dice "no llegó" y quien mire tiene que ir
  a mano a averiguar qué hay vivo — que es el trabajo que esta spec elimina.
  *Verificación*: subproceso + aserción sobre código de salida, sobre el texto y sobre el
  tiempo transcurrido (que respeta el plazo en vez de rendirse al primer intento).

- **CA-11 (`unknown` tiene su propio rojo, y la red no se confunde con el desacuerdo).**
  Dado un servidor que responde `commit: "unknown"`,
  cuando se ejecuta el script con `--commit`,
  entonces **sale con 2** y el mensaje dice que **el despliegue no sabe de qué commit viene**,
  no que "no coincide".
  Y dado un servidor que primero **rechaza la conexión** o devuelve **500** y luego responde
  bien, el script **reintenta** cada `--interval` y termina en **0**: un fallo de red no es un
  veredicto, y el despliegue tarda en propagarse.
  Y dado un servidor que responde 200 con un cuerpo que **no es el contrato** (no es JSON, o
  le faltan claves), sale con **3**.
  *Por qué*: `unknown` es la alarma que ADR-018 D-6 pide destacar (*"significa: este
  despliegue no sabe de dónde viene"*), y confundirla con un desacuerdo de sha manda a quien
  mire a buscar el problema en el sitio equivocado.
  *Verificación*: tres subprocesos contra tres servidores de juguete distintos, uno con
  respuestas programadas por secuencia.

### La frontera

- **CA-12 (El truco del `curl | grep` muere en el runbook, y su sustituto se documenta).**
  Dado `docs/despliegue.md`,
  cuando se lee tras esta spec,
  entonces el paso 8 de §8 —`curl -s … | grep -o "forgot-password"`— ha sido **sustituido** por
  la invocación de `scripts/check-alive.mjs`, y existe una sección que documenta el contrato de
  `/api/version` y los cuatro códigos de salida; y la **lección del 2026-08-11** de la cabecera
  deja de recomendar *"`curl` del CSS/HTML público buscando una clase o cadena"* y apunta aquí.
  *Alcance estricto*: la documentación es de **uso manual**. El runbook **no** describe
  despliegue automático, ni puerta post-deploy, ni conexión a Vercel: eso es SPEC-028.
  *Verificación*: test estático sobre el runbook (la cadena `grep -o "forgot-password"` ya no
  aparece; `check-alive` sí) + lectura humana en la revisión.

- **CA-13 (Nada queda conectado: esta spec no despliega ni cambia cómo se despliega).**
  Dado el diff completo de la spec,
  cuando se inspecciona,
  entonces:
  1. `.github/workflows/ci.yml` **no gana ningún step** que invoque `check-alive.mjs` ni que
     hable con ningún host externo.
  2. `vercel.json` **no cambia**.
  3. No se añade ninguna variable de entorno nueva a ningún entorno de Vercel, ni al
     `.env.example`, salvo las tres que `next.config.mjs` **deriva** en tiempo de build (que no
     se configuran en ninguna parte: se calculan).
  4. La suite completa pasa **sin red**: ninguno de los tests nuevos sale a internet.
  *Por qué es un CA y no una promesa*: es la garantía de que el verificador puede cerrar esta
  spec sin desplegar, que es la razón por la que ADR-018 pide separar 3 de 4. Un step de CI
  añadido "ya que estamos" convertiría esta spec en incerrable.
  *Verificación*: test estático sobre el workflow (los nombres de step siguen siendo
  exactamente los cinco de SPEC-027 CA-2) + `git diff` de `vercel.json` vacío + la propia
  ejecución del CI.

## Entidades y reglas afectadas

- **Ninguna entidad de dominio.** No se toca `src/db/schema.ts`, no hay migración, no hay
  `drizzle/` nuevo. En particular: **esta spec no dispara `guard-migrate` ni el escáner de SQL
  destructivo** (F-SPEC-027-2), porque no hay SQL que escanear.
- **ADR-018 D-6** — la decisión que gobierna el endpoint: identidad congelada en el build, sin
  BD, y un valor distinguible cuando no hay metadatos de git. La *puerta automática* que D-6
  menciona en su segundo párrafo se construye en SPEC-028; aquí se entrega **la pieza que esa
  puerta llamará**. **Salvedad de redacción**: D-6 escribe esa sentinela como `desconocido` y
  esta spec la fija como **`unknown`**, por decisión del humano en el gate del 2026-08-18
  (§CA-3, nota). Es apartarse de la **letra** del ADR, no de su decisión — D-6 declara
  *"mecanismo libre, propiedades obligatorias"* y la propiedad se cumple igual. El ADR no se
  modifica: es inmutable.
- **ADR-018 §Frontera con SPEC-022** — regla de no solapamiento, elevada a CA-7. *Ojo*:
  **SPEC-022 no existe en el árbol** — el id está libre en `origin/main` y no hay documento
  que leer; la referencian por nombre ADR-018 y el ledger de SPEC-023. La frontera es real de
  todos modos, porque lo que separa CA-7 es el **ciclo de refresco ya implementado**
  (`src/lib/market/`, `src/lib/triggers/`, `src/lib/notifications/`, `src/app/api/cron/`), no
  un documento. CA-7 se verifica contra el código, así que no depende de que SPEC-022 llegue a
  escribirse ni de qué id acabe llevando.
- **ADR-018 D-7** — *"hecho" pasa a significar "vivo"*: esta spec es su **prerrequisito
  técnico**, no su adopción. **Aplazada en el gate del 2026-08-18**: ni se adopta ni se
  descarta, y se decide en el gate de **SPEC-028** (§Notas, punto 4; **F-SPEC-031-1** en el
  ledger).
- **ADR-018 D-4.1** (*el CI no necesita ni un secreto*) — se hereda en CA-8.3: el script tiene
  que poder correr en un runner sin secretos, o SPEC-028 no podrá usarlo.
- **ADR-001** — Next.js App Router sobre Vercel; el endpoint es un route handler más, en
  `src/app/api/version/route.ts`, junto a `api/cron/refresh` y `api/auth`.
- **SPEC-027** — deja el CI que ejecutará estos tests en cada PR, y el patrón de *test
  estático que parsea de verdad* (`tests/ci-workflow.test.ts`) que reutilizan CA-2, CA-8, CA-12
  y CA-13.
- **`src/proxy.ts`** — su `matcher` excluye `/api`, así que el endpoint nace público sin tocar
  la protección de rutas (RN-03 no se relaja: `/api/version` no sirve dato de usuario).
- **No se escribe ADR nuevo.** Todo lo que esta spec decide —nombres de campo, sentinela,
  códigos de salida, `no-store`— es detalle de spec dentro del margen que ADR-018 D-6 deja
  explícito (*"mecanismo libre, propiedades obligatorias"*). La única decisión con vocación de
  constreñir el futuro —que `/api/version` sea un endpoint público y estable— ya la tomó D-6.

## Fuera de alcance

Lo de esta lista está aparcado **a propósito**, y casi todo tiene dueño con nombre:

- **Conectar el repositorio a Vercel, el despliegue automático desde `main`, la puerta
  post-deploy y la reescritura del runbook para despliegue automático** → **SPEC-028**
  (ADR-018 D-1 y D-6 segundo párrafo, punto 4 del desglose). Esta spec le deja el endpoint y
  el script; SPEC-028 los cablea.
- **Las guardias de migración**: `guard-migrate` (ADR-018 D-2) y el escáner de SQL destructivo
  (D-5.2) → **F-SPEC-027-2**, abierto y declarado **bloqueante de SPEC-028**. No de esta: aquí
  no hay ni una línea de SQL. Se nombra solo para que quede claro que sigue pendiente y que
  esta spec no lo cierra ni lo empuja.
- **La BD de Preview separada** (rama de Neon, `DATABASE_URL` propia, `ALLOW_MIGRATE`) →
  **acción de ops** del punto 2 del desglose, que hace el humano en paralelo y cierra
  **F-SPEC-023-1**. No es código.
- **Alerting de cualquier tipo.** ADR-018 §Frontera: *"ninguna de las dos introduce
  alerting"*. Que `/api/version` diga `unknown` no avisa a nadie; alguien tiene que
  preguntar. Convertir eso en un aviso es una decisión aparte que abarcaría también a
  la observabilidad del ciclo.
- **Cualquier mezcla con el resumen del ciclo diario** (lo que ADR-018 llama SPEC-022, spec
  que **aún no existe**): ni un campo de ciclo aquí, ni un campo de versión allá. CA-7 lo
  ancla contra el código, no contra el documento. La *costura* opcional que ADR-018 contempla
  —correlacionar "el ciclo que falló, ¿con qué build corría?"— está explícitamente **no
  pedida** y sería follow-up de la que aterrice segunda.
- **Adoptar D-7** (que el verificador no cierre una spec hasta que `/api/version` la
  contenga). Es cambio del **ciclo tremen-sdd**, no de este repositorio; esta spec solo lo hace
  posible. **Aplazado en el gate del 2026-08-18**, no descartado → **F-SPEC-031-1**, con
  destino el gate de SPEC-028.
- **Historial de despliegues, panel de versiones, o cualquier UI.** El endpoint es para
  máquinas y para `curl`. Ninguna pantalla cambia.
- **La rama en la respuesta** (`VERCEL_GIT_COMMIT_REF`) y cualquier otro metadato de git más
  allá del sha: excluidos por CA-1, reversible con una línea si el gate lo pide.
- **Proteger el endpoint o limitar su tasa.** Es público a propósito (D-6) y devuelve tres
  constantes: no hay nada que proteger ni nada que agotar.

## Notas para el gate humano

Lo que había que decidir o mirar con lupa antes de aprobar. **El gate se celebró el
2026-08-18 (Alberto Fojo) y la spec quedó aprobada**; los puntos 1 y 4 se resolvieron allí y
se dejan escritos con su resolución, no borrados, porque la resolución es parte del contrato.

1. ✅ **RESUELTO (gate del 2026-08-18) — la sentinela es `unknown`, no `desconocido`.**
   *La pregunta era*: ADR-018 D-6 escribe la sentinela en español (*"responde `desconocido`"*)
   y el ADR está aprobado, pero choca con la regla del proyecto (*código e identificadores en
   inglés*) y **es un contrato público que SPEC-028 va a consumir**: cambiarlo cuesta una línea
   hoy y coordinar dos specs después.
   *Yo recomendé* mantener `desconocido` por fidelidad a la letra del ADR. **El humano decidió
   `unknown`**, en contra de esa recomendación, por coherencia con la regla del proyecto y con
   las claves del JSON, que ya están en inglés. Aplicado en CA-3, CA-4, CA-8 (código de salida
   **2**) y CA-11.
   *Qué NO cambia*: **ADR-018 no se toca** —un ADR aceptado es inmutable— y sus citas literales
   se conservan tal cual en esta spec (§Origen y §Notas punto 2). Apartarse aquí es apartarse
   de la **redacción** de D-6, no de su decisión: D-6 declara *"mecanismo libre, propiedades
   obligatorias"*, y la propiedad —que exista un valor distinguible para *"este despliegue no
   sabe de dónde viene"*— se cumple igual. Detalle en la nota de §CA-3.

2. **Desplegado hoy, este endpoint respondería `unknown`.** No es un fallo de la spec: es
   el diagnóstico correcto, y ADR-018 lo celebra (*"útil desde el minuto uno: hoy respondería
   `desconocido`, que es exactamente lo que son hoy los 5 despliegues vivos"*). Consecuencia
   práctica que conviene tener clara al aprobar: **esta spec no permite todavía comprobar que
   una spec está viva por su sha**. Eso llega con SPEC-028, cuando la integración Git empiece
   a rellenar `VERCEL_GIT_COMMIT_SHA`. Lo que sí entrega hoy es (a) el instante del build, que
   ya distingue un despliegue de otro, y (b) el hecho, ahora legible desde fuera, de que los
   despliegues actuales son anónimos.

3. **El fallback a `git rev-parse HEAD` (CA-4) solo actúa en builds locales.** En Vercel el
   código se sube sin `.git`, así que allí nunca se dispara. ¿Se quiere igualmente? **Sí, en mi
   opinión**: hace que `npm run build && npm start` en local sirva una identidad real, que es lo
   que permite probar el script contra la app de verdad y no solo contra un servidor de
   juguete. El riesgo —ejecutar un subproceso durante la evaluación de `next.config.mjs`— está
   acotado por el CA: nunca lanza, nunca rompe el build. Si prefieres cero subprocesos en el
   build, se cae CA-4 y el resto de la spec no se mueve.

4. ⏳ **APLAZADO (gate del 2026-08-18) — D-7 ("hecho" exige "vivo") ni se adopta ni se
   descarta.** Es la **pregunta 3 del gate de ADR-018**, que sigue sin respuesta y que **esta
   spec no necesita responder**: no depende de ella, solo la hace barata.
   *Razón del aplazamiento, dicha por el humano*: mientras no exista SPEC-028 la comprobación
   de vida solo puede afirmar *"hay un despliegue nuevo"* (por `builtAt`), no *"contiene este
   commit"*. **Adoptar D-7 hoy sería adoptar una regla que aún no se puede cumplir.**
   *Dónde se decide*: en el **gate de SPEC-028**, cuando la integración Git empiece a rellenar
   `VERCEL_GIT_COMMIT_SHA` y la regla pase a ser cumplible. Registrado como **F-SPEC-031-1**
   en el ledger para que quien escriba SPEC-028 se lo encuentre. **ADR-018 no se modifica**:
   D-7 sigue siendo lo que dice, una recomendación pendiente de firma.

5. **Se añade `scripts/` al repositorio, que hoy no existe.** SPEC-029 lo señala como parte de
   lo que bloquea F-SPEC-027-2. Esta spec lo estrena con un fichero; `guard-migrate.mjs` y el
   escáner aterrizarán ahí después. No hay decisión que tomar, pero conviene saber que este es
   el momento en que se fija la convención de dónde viven los scripts del repo.

6. **Coste en CI**: los tests nuevos son unitarios, estáticos y subprocesos locales de menos de
   un segundo. Los servidores de juguete escuchan en el *loopback* con puerto efímero. Ningún
   test sale a la red (CA-13.4), así que ni la cuota de GitHub Actions ni la estabilidad del
   CI se resienten.

7. **Lo que este trabajo NO arregla, dicho en voz alta**: SPEC-023 sigue muda. Esta spec le da
   al operador el instrumento para comprobarlo, no lo despliega. El despliegue de SPEC-023
   —y si se hace a mano ya o como primer pasajero del pipeline nuevo— es la **pregunta 8 del
   gate de ADR-018**, todavía abierta.
