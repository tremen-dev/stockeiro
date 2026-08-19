---
id: SPEC-033
tipo: spec
epica: EPIC-FIX
estado: en-revision
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-19, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-19, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-19, por: sdd-implementador}
---
# SPEC-033 — La puerta post-deploy deja de perder la carrera: con `--commit`, `unknown` es transitorio

> **Nota de id.** Se usa **SPEC-033** exactamente. **022 está quemado** —ADR-018 §Frontera y el
> ledger de SPEC-023 usan ese id con otro significado (observabilidad del ciclo de refresco) para
> un documento que nunca existió— y **028 ya se gastó**. SPEC-028 §Nota de id lo dejó escrito:
> *"el siguiente id libre de verdad es SPEC-033"*.

## Problema

El **primer despliegue automático del proyecto** funcionó. La puerta que debía certificarlo salió
**roja**.

El 2026-08-19 se mergeó la PR #35 (SPEC-028) a `main`, sha
`0d389c81c44d01f57dbe0fa7302b1c6059b7ad13`. Vercel construyó y publicó: hoy
`https://stockeiro.tremen.dev/api/version` responde

```json
{"commit":"0d389c81c44d01f57dbe0fa7302b1c6059b7ad13","environment":"production","builtAt":"2026-08-19T07:14:30.796Z"}
```

Pero el job `Alive` de `.github/workflows/deploy-gate.yml` terminó en rojo **en 1 segundo**, con
este log literal:

```
Run node scripts/check-alive.mjs --url https://stockeiro.tremen.dev --commit 0d389c81c44d01f57dbe0fa7302b1c6059b7ad13 --timeout 900 --interval 10
[check-alive] https://stockeiro.tremen.dev/api/version: el despliegue NO sabe de qué commit viene (commit=unknown). No es que el sha discrepe: es que ahí no hay metadatos de git que comparar.
[check-alive] identidad: commit=unknown environment=production builtAt=2026-08-18T22:55:08.899Z
Error: Process completed with exit code 2.
```

**Es una carrera.** GitHub Actions arranca el job en el instante del `push` a `main`; Vercel tarda
del orden de 35 s en construir y publicar. Durante esa ventana, `/api/version` **sigue sirviendo
el despliegue anterior** — y el `builtAt=2026-08-18T22:55:08.899Z` del log lo delata: es el
despliegue manual por CLI de la noche anterior, que por venir de la CLI responde
`commit: unknown` (`docs/despliegue.md` §10 y §3.4). `check-alive` trata `unknown` como
**terminal** y sale con **2 al primer sondeo**: sus `--timeout 900 --interval 10` **no llegan a
usarse nunca**.

Relanzado a mano minutos después, el mismo job salió **verde**, con producción ya sirviendo el sha
correcto. O sea: el fallo es **exclusivamente de la ventana**, no del despliegue — y **se repetirá
en cada merge**, porque nada de lo que falló depende de este merge en concreto.

### De quién es la culpa, que importa para no arreglar lo que no está roto

La regla *"`unknown` es terminal"* la fijó **SPEC-031 CA-11** y **no era un error**. Como
comprobación **manual**, `unknown` es un diagnóstico legítimo y valioso: *"aquí no hay metadatos
de git que comparar"*, que es una cosa distinta de *"el sha discrepa"*, y ADR-018 D-6 pide
destacarla (*"y eso es la alarma"*).

El defecto aparece cuando **SPEC-028 reutiliza el mismo script como puerta que espera a un
despliegue en curso**. Ahí `unknown` ya no significa *"este despliegue no sabe de dónde viene"*
sino **"todavía no ha llegado el mío"**, y lo correcto es reintentar. El script no cambió; cambió
la pregunta que se le hace, y nadie releyó la respuesta a la luz de la pregunta nueva.

### Por qué esto es EPIC-FIX y no una mejora

Es el patrón exacto de la épica (**CE-F1**): una capacidad **ya entregada y verificada** —la
puerta post-deploy de SPEC-028, con GREEN del verificador sobre sus diez CA 🔒— **no cumple su
promesa con uso real**. Y es **CE-F2** de manual: el rojo no es silencioso, es peor — es un rojo
**que miente**, y una puerta que da falsos rojos enseña a ignorarla. SPEC-028 lo escribió como
premonición: *"una puerta ignorada no es una puerta"*.

Además bloquea **RI-02** en la práctica: *"hecho" significa "vivo"* exige la puerta en verde como
evidencia, y hoy la puerta se pone roja aunque el despliegue esté perfecto. **SPEC-028 sigue en
`en-revision` por esto mismo** — no puede aportar la evidencia que su propio CA-14 introdujo.

## Usuarios / roles afectados

- **Quien mergea** (hoy: el humano, Alberto Fojo): recibe un check rojo por cada merge correcto, y
  la única salida es relanzar el job a mano y acordarse de por qué.
- **sdd-verificador y sdd-documentalista**: RI-02 les pide el run de la puerta en verde como
  evidencia para pasar una spec a `hecho`. Hoy esa evidencia no se puede obtener a la primera.
- **Ningún usuario final**: la app no se toca. Esto es instrumentación del despliegue.

## Decisiones de diseño

Van aquí y no en un ADR nuevo, por lo que dice §Entidades: **ADR-018 D-6 ya decide esto**, y lo que
hace esta spec es devolver el script a la letra del ADR.

### D-A. La presencia de `--commit` es lo que separa los dos modos

Con `--commit` el script **espera a un despliegue que viene**. Sin él, **pregunta por el que hay**.
`unknown` significa cosas distintas en cada caso, y por eso se trata distinto. Es la misma
distinción que SPEC-031 ya llamó *modo smoke*: no se inventa un concepto, se le da la consecuencia
que le faltaba.

*Alternativa rechazada*: una bandera nueva (`--esperar-unknown`, `--modo puerta`). Sería una
segunda forma de decir lo que `--commit` ya dice, y una oportunidad más de olvidarla justo en el
sitio donde importa — el workflow. Una bandera que hay que acordarse de poner para que la puerta
funcione es la misma clase de fallo que ADR-018 vino a matar (*"no hay ritual que olvidar"*).

### D-B. Con `--commit`, `unknown` es transitorio; el veredicto sigue siendo **2**

Se reintenta cada `--interval` hasta agotar `--timeout`, y **solo al expirar** se sale, con **2**.

*Por qué 2 y no 1*: son preguntas distintas y `docs/despliegue.md` §12.3 las manda a mirar sitios
distintos. **1** = *"lo vivo lleva OTRO sha"* → mira el build. **2** = *"lo vivo no tiene metadatos
de git"* → hay un despliegue fuera de la integración Git en producción, y eso es un hecho que quien
mire necesita saber aunque la causa inmediata sea otra. Colapsarlos perdería la distinción que
ADR-018 D-6 llama *la alarma* y que SPEC-031 CA-8.4 congeló como contrato.

### D-C. La espera no es muda

La **primera** vez que ve `unknown`, el script escribe **una** línea diciendo que sigue esperando y
por qué puede estar pasando. 900 s de silencio en un job de CI son indistinguibles de un cuelgue, y
la queja legítima contra este cambio es precisamente esa: *"antes fallaba en 1 s; ahora, si alguien
desplegó a mano, ¿me cuelga un cuarto de hora?"*. No: informa en el segundo 0 y falla con
explicación al final.

Una línea **por ejecución**, no por sondeo: 90 líneas idénticas no son un log, son ruido.

### D-D. `builtAt` **informa**, no decide

Se consideró ramificar con `builtAt`: si el `builtAt` del despliegue que responde `unknown` es
**posterior** al arranque de la espera, es un despliegue **nuevo** sin sha (alguien acaba de subir
por CLI) y se podría fallar rápido; si es **anterior**, es el despliegue viejo aún vivo y hay que
esperar. **Rechazado.**

1. Exige comparar el reloj del runner de GitHub con el de la máquina de build de Vercel. Una
   desviación de segundos convierte la puerta en un oráculo caprichoso, y el fallo sería
   **intermitente** — la peor clase.
2. El caso que compraría (un despliegue por CLI **durante** la ventana de 35 s) es rarísimo; el
   caso común (CLI **antes**, que es literalmente lo que pasó) se comporta igual con la regla
   simple.
3. Un build fallido deja el despliegue anterior vivo con `builtAt` antiguo: la lógica sofisticada
   esperaría los 15 minutos **igual** que la simple. No compra nada donde duele.

Lo que **sí** se hace con `builtAt` es **imprimirlo**, en la línea de espera y en el veredicto
final, porque ahí sí vale: un `builtAt` de anoche dice *"carrera, o build caído"*; uno de hace tres
minutos dice *"alguien desplegó por CLI ahora mismo"*. El desempate lo hace la persona, con el dato
delante, y no un `if` contra dos relojes que no se hablan.

### D-E. La puerta no cambia

`--timeout 900 --interval 10` ya eran los valores correctos: el defecto es que **nunca se usaban**.
No se toca el `run:`, ni el disparador, ni la concurrencia, ni los nombres. Lo único que se corrige
en `deploy-gate.yml` es el **comentario** que explica el código 2, que hoy dice solo *"alguien
desplegó por CLI"* y con esto se queda corto.

*Alternativa rechazada*: esperar **fuera** del script (un `sleep 60` antes del step, o escuchar el
evento `deployment_status` de Vercel). El `sleep` es adivinar, y adivina mal el día que el build
tarde 90 s. El `deployment_status` exige leer la API de Vercel, o sea **un token**, o sea un
secreto — exactamente lo que ADR-018 D-4.1 y SPEC-028 CA-6 evitan a propósito.

## Criterios de aceptación

Los nueve son **cerrables en local y en CI, sin desplegar**. La ventana se simula con un servidor
de juguete (`node:http` en *loopback*, puerto efímero) que responde por secuencia, y el script se
ejecuta como **subproceso real** — porque el código de salida es el contrato, y un código de salida
solo existe cuando hay proceso. Es la convención que fijó `tests/check-alive.test.ts` en SPEC-031;
esta spec la sigue sin inventar nada.

- **CA-1 (La carrera se deja de perder: `unknown`, y después el sha, termina en verde).**
  Dado un servidor de juguete que responde `commit: "unknown"` en sus **primeros N sondeos** (N ≥ 2)
  y el sha esperado a partir de ahí,
  cuando se ejecuta `node scripts/check-alive.mjs --url <toy> --commit <sha>` con un `--timeout`
  holgado y un `--interval` corto,
  entonces **sale con 0** e imprime la identidad completa.
  Y el servidor registra **al menos N+1 peticiones**: si el script hubiera salido al primer
  `unknown`, el contador lo delataría.
  *Por qué es el CA-1*: es la reproducción literal del fallo del 2026-08-19 (job `Alive` del merge
  `0d389c8`). Sin este caso **rojo antes** del arreglo, no hay prueba de que se arregló lo que se
  dijo.

- **CA-2 (El plazo se usa de verdad: `unknown` para siempre agota `--timeout`, y entonces sale 2).**
  Dado un servidor que responde **siempre** `commit: "unknown"`,
  cuando se ejecuta con `--commit` y un plazo corto (p. ej. `--timeout 3 --interval 0.5`),
  entonces:
  1. **sale con 2**;
  2. el **tiempo transcurrido respeta el plazo** —no se rinde al primer intento— y **no lo
     desborda** (cota superior con margen): ni un veredicto prematuro, ni un cuelgue;
  3. el mensaje **conserva el diagnóstico de SPEC-031**: dice que el despliegue **no sabe de qué
     commit viene**, y **no** dice que "no coincide".
  *Verificación*: subproceso + medición del tiempo transcurrido + aserción sobre el texto.

- **CA-3 (El despliegue manual por CLI acaba en un 2 comprensible, no en un cuelgue mudo).**
  Dado ese mismo servidor,
  cuando expira el plazo,
  entonces la salida de error nombra, junto y en el mismo bloque:
  1. el sha **esperado**;
  2. que lo que está vivo responde `unknown`;
  3. el **`builtAt`** de ese despliegue vivo;
  4. **las dos causas posibles con su desempate**: *el despliegue anterior sigue vivo porque el
     build nuevo no llegó* frente a *alguien desplegó por CLI*, diciendo que el `builtAt` es lo que
     las separa.
  *Por qué es un CA y no una nota de estilo*: SPEC-028 dejó la CLI viva **a propósito** como
  recurso de emergencia (§3.4 del runbook). Un plazo de 15 minutos que termina en un 2 sin explicar
  por qué se esperó tanto convierte un recurso legítimo en una trampa.

- **CA-4 (La espera no es muda, y tampoco es ruido: una línea, exactamente una).**
  Dado un servidor que responde `unknown` en varios sondeos consecutivos (≥ 3),
  cuando se ejecuta con `--commit`,
  entonces en el **primer** sondeo que ve `unknown` escribe en la salida de error una línea que
  dice **que sigue esperando** y con qué `builtAt`,
  y esa línea aparece **exactamente una vez** por ejecución, por muchos sondeos `unknown` que haya
  después.
  *Verificación*: contar ocurrencias del marcador en `stderr`.

- **CA-5 (El modo *smoke* no cambia: sin `--commit`, `unknown` sigue siendo terminal e inmediato).**
  Dado un servidor que responde siempre `commit: "unknown"`,
  cuando se ejecuta **sin `--commit`** y con un plazo largo (p. ej. `--timeout 60`),
  entonces **sale con 2** y lo hace **en unos pocos segundos**, muy por debajo del plazo: la
  aserción es sobre el **tiempo**, porque es lo único que distingue "no esperó" de "esperó".
  *Por qué*: sin `--commit` la pregunta es *"¿este despliegue sabe de dónde viene?"*, y la respuesta
  inmediata es la útil. Es el uso manual que documenta `docs/despliegue.md` §10 y el que cerraron
  SPEC-031 CA-9 y CA-11.

- **CA-6 (Ni un código de salida cambia de significado: el contrato de SPEC-031 sigue en pie).**
  Dado el resto del contrato,
  cuando se ejecutan sus casos,
  entonces:
  1. sha coincidente → **0**, con `--commit` y en modo smoke;
  2. sha **distinto** y persistente → **1** al agotar el plazo, nombrando **esperado** y **último
     visto**;
  3. cuerpo que no es el contrato de tres claves (o no es JSON) → **3**, y **sin reintentar**:
     reintentar no arregla un contrato roto;
  4. `--url` ausente, bandera desconocida o plazo no numérico → **3**;
  5. conexión rechazada o `500`, y luego respuesta buena → reintenta y **0**.
  Y el script **sigue sin importar nada fuera de `node:*`, sin leer ni una variable de entorno y
  sin origen por defecto** (SPEC-031 CA-8.2 y CA-8.3, que `tests/spec-031-frontera.test.ts` congela
  afirmando `url: null` y un único `fetch(endpoint)`).
  *Verificación*: `tests/check-alive.test.ts` entero en verde, con la única edición que autoriza
  CA-8, y `tests/spec-031-frontera.test.ts` en verde **sin tocarlo**.

- **CA-7 (`scripts/` no gana un habitante, y la puerta no cambia de comportamiento).**
  Dado el diff completo de esta spec,
  cuando se inspecciona,
  entonces:
  1. `scripts/` sigue teniendo **exactamente tres** ficheros: `check-alive.mjs`,
     `guard-migrate.mjs` y `scan-destructive-sql.mjs` (lo afirma SPEC-028 CA-5 y lo prueba
     `tests/deploy-gate-workflow.test.ts` 5.5);
  2. `.github/workflows/deploy-gate.yml` conserva **idénticos** su `on:`, su `concurrency`, sus
     `permissions`, el nombre del job (`Alive`), los nombres de los steps y el `run:` **literal**
     —misma URL, mismo `--commit ${{ github.sha }}`, mismos `--timeout 900 --interval 10`—;
  3. lo **único** que puede cambiar en ese fichero es el **comentario** que describe el código 2.
     Tres cadenas quedan prohibidas dentro de ese comentario, porque
     `tests/deploy-gate-workflow.test.ts` afirma sobre el **texto** del fichero —no sobre el YAML
     parseado— que no aparecen: **`continue-on-error`**, **`node-version:`** y **`secrets.`**;
  4. `ci.yml`, `vercel.json`, `src/` y `drizzle/` **no aparecen** en el diff.
  *Por qué es un CA*: la tentación de "ya que estoy, subo el plazo" o "meto un `|| true` mientras
  depuro" es real, y el fichero es de otra spec.

- **CA-8 (Los tests ajenos que se tocan son estos y solo estos, y está escrito antes).**
  Dado el diff completo,
  cuando se listan los ficheros bajo `tests/` que toca,
  entonces son **exactamente dos**:
  1. **`tests/check-alive-carrera.test.ts` — nuevo**, de esta spec, donde viven CA-1 … CA-5.
  2. **`tests/check-alive.test.ts` — ajeno (SPEC-031), y su edición es inevitable**: el caso
     *«commit `unknown` con --commit → 2, y el mensaje NO dice "no coincide"»* del bloque
     `SPEC-031 CA-11` **describe con su título una regla que esta spec cambia**. Se **retitula**
     para decir que ahora el 2 llega **al agotar el plazo**, se le añade la aserción de tiempo que
     lo demuestra, y se le pone una nota que remite a SPEC-033. **El resto del fichero no se toca**
     — en particular, el caso de modo *smoke* del mismo bloque sigue **palabra por palabra** como
     está, porque su regla no cambia (CA-5).
  Y **ninguno** de estos aparece en el diff: `tests/spec-031-frontera.test.ts`,
  `tests/spec-032-frontera.test.ts`, `tests/ci-workflow.test.ts`,
  `tests/deploy-gate-workflow.test.ts`, `tests/runbook-check-alive.test.ts`,
  `tests/runbook-despliegue-automatico.test.ts`, `tests/reglas-ingenieria-hecho-vivo.test.ts`.
  *Por qué esto es un CA y no una nota al pie*: en SPEC-032 el choque con literales congelados de
  otra spec **se descubrió tarde** y acabó en `F-SPEC-032-3`; SPEC-028 montó un bloque de diff
  entero para que no se repitiera. Aquí el permiso está escrito **antes de empezar**, con su
  límite. El permiso formal vive en §Fuera de alcance.
  *Nota*: el caso que se retitula **seguiría pasando sin tocarlo** —sale 2 igual, solo que un par de
  segundos más tarde—, y por eso hay que tocarlo: un test que pasa por una razón distinta de la que
  anuncia su título es peor que un test roto.

- **CA-9 (La regla nueva queda escrita en los tres sitios donde vive el contrato).**
  Dado el árbol tras esta spec,
  cuando se leen,
  entonces:
  1. **La cabecera de `scripts/check-alive.mjs` y su `--help`** dicen que `unknown` es **terminal
     en modo smoke** y **transitorio con `--commit`**, y que en ese modo el **2** solo llega al
     **agotar el plazo**. El bloque de códigos de salida sigue **dentro de las primeras 60 líneas**
     del fichero: es la ventana exacta que mira `tests/check-alive.test.ts` 8.4, y desbordarla
     rompería un test que esta spec no autoriza a tocar más allá de lo que dice CA-8.
  2. **`docs/despliegue.md` §10** — la fila del código **2** deja de decir *"Hoy es lo normal"*.
     Era cierto **antes** de SPEC-028; con el repositorio conectado, un `unknown` en producción es
     una **anomalía**, cosa que el propio §10 ya dice tres párrafos más arriba, contradiciéndose.
     Pasa a decir las **dos lecturas por modo**. Las cuatro filas conservan su forma `| **N** |`.
  3. **`docs/despliegue.md` §12.3** — la fila del **2** añade la segunda causa: además de *"alguien
     desplegó por CLI"*, ahora también significa *"esperé el plazo entero y lo único vivo no tiene
     metadatos de git"*, con el `builtAt` como desempate. **Conserva la palabra `CLI`**, que es el
     ancla del test de SPEC-028 CA-12.
  4. **`docs/despliegue.md` §12.2** gana una línea: la puerta **usa el plazo de verdad**, y hasta el
     2026-08-19 no lo usaba — salía en 1 s. Se deja escrito el incidente, con su fecha y su sha,
     porque un runbook que no cuenta por qué es como es se vuelve a romper igual.
  *Verificación*: `tests/runbook-check-alive.test.ts` y `tests/runbook-despliegue-automatico.test.ts`
  **siguen verdes sin tocarlos** — que es justamente la prueba de que la reescritura respetó las
  anclas (afirman **presencia**: las cuatro filas `| **N** |`, y las palabras `unknown`, `CLI`,
  `DNS`, `guardia|migración`) — más lectura humana en la revisión.

## Entidades y reglas afectadas

- **Ninguna entidad de dominio.** No se toca `src/`, no hay esquema y no hay migración: **esta spec
  no dispara `guard-migrate` ni el escáner de SQL destructivo** de SPEC-032, porque no hay SQL que
  escanear. Tampoco hay UI: **no hay evidencia visual que capturar** en el ledger.
- **ADR-018 D-6** — es **la fuente y la justificación**. D-6 pide *"un paso que **espera** a que
  `/api/version` en el dominio de producción devuelva el sha mergeado, y **falla si no llega en un
  plazo**"*. El script de hoy no espera: falla **antes** de empezar a esperar. Esta spec no cambia
  la decisión del ADR, **la cumple**. Por eso **no se escribe ADR-021**: no hay decisión nueva que
  constriña trabajo futuro —ni stack, ni datos, ni frontera, ni integración—; hay un script que se
  aparta de una decisión ya tomada. Un ADR aquí sería ruido con número.
- **ADR-018 D-4.1** (*el CI no necesita ni un secreto*) — la razón por la que se rechaza esperar
  con el evento `deployment_status` de Vercel (§D-E): leerlo exige un token.
- **RI-02** (*"hecho" significa "vivo"*, `docs/fundacion/reglas.md`) — la regla que este defecto
  hace **incumplible en la práctica**: pide la puerta en verde como evidencia, y hoy la puerta se
  pone roja aunque el despliegue esté perfecto. Esta spec no modifica RI-02 **ni una palabra**;
  arregla el mecanismo que la hace cumplible (`tests/reglas-ingenieria-hecho-vivo.test.ts` congela
  su enunciado por fragmentos literales y **no se toca**).
- **RI-01** — no aplica: no hay migración.
- **SPEC-031 CA-11** — es el CA que esta spec **reinterpreta**, no deroga. Su regla sobrevive
  íntegra para el modo *smoke* (CA-5), y su **mensaje** sobrevive en los dos modos (CA-2.3). Lo que
  cambia es **cuándo** se emite el veredicto cuando hay `--commit`. SPEC-031 sigue `hecho`; su
  ledger no se reescribe.
- **SPEC-031 CA-8.4** — los **cuatro códigos de salida** siguen significando lo mismo y siguen
  documentados en la cabecera (CA-6, CA-9.1).
- **SPEC-028 CA-5, CA-7 y CA-12** — la puerta y su tabla de reacción. CA-5 y CA-7 se conservan
  **intactos** (el CA-7 de esta spec los protege explícitamente); de CA-12 se **amplía** la fila del
  código 2 sin romper sus anclas (CA-9.3).
- **EPIC-FIX CE-F1 y CE-F2** — los criterios de la épica que esta spec cierra: una promesa entregada
  que no se cumple con uso real, y un fallo que engaña a quien mira.

## Fuera de alcance

- **`/api/version` y todo `src/`.** Es SPEC-031, está `hecho` y **funciona**: hoy devuelve el sha
  correcto. El defecto está en el cliente, no en el endpoint.
- **`vercel.json`, la conexión a Vercel y las guardias de migración.** Nada de SPEC-032 ni de las
  acciones de ops de SPEC-028 entra aquí.
- **El comportamiento de `deploy-gate.yml`.** Solo su **comentario** sobre el código 2 (CA-7.3). Ni
  el plazo, ni el intervalo, ni el disparador, ni la concurrencia, ni los nombres.
- **La puerta para despliegues de Preview** (`F-SPEC-028-3`): sigue fuera, sigue exigiendo un
  secreto, sigue sin hacerse.
- **Alerting.** El rojo se ve en GitHub y en ningún otro sitio (ADR-018 §Frontera). Esta spec hace
  que el rojo sea **verdad**; no lo lleva a ninguna parte.
- **Reabrir SPEC-031 o SPEC-028.** Ni se editan sus specs, ni sus ledgers, ni se les añaden CA. Lo
  que esta spec cambia de su comportamiento queda dicho **aquí**, en §Entidades.

### Permiso explícito para tocar un test ajeno

> **Autorizado por esta spec, antes de empezar y con este límite exacto**: el implementador de
> SPEC-033 **puede y debe editar `tests/check-alive.test.ts`**, que pertenece a **SPEC-031**,
> **únicamente** en el caso *«commit `unknown` con --commit → 2, y el mensaje NO dice "no
> coincide"»* del bloque `SPEC-031 CA-11`: retitularlo, añadirle la aserción de que el 2 llega al
> **agotar el plazo**, y dejar una nota que remita a SPEC-033. **Ningún otro caso de ese fichero, y
> ningún otro fichero de tests ajeno.** La lista cerrada y la lista prohibida están en **CA-8**.
>
> Es **inevitable**: SPEC-031 CA-11 congeló en un test una regla que este defecto obliga a desdoblar
> en dos modos, y el test vive en el fichero de SPEC-031. La alternativa —dejarlo intacto porque
> *técnicamente sigue pasando*— es peor: quedaría un caso cuyo título afirma una regla derogada y
> que pasa por una razón distinta de la que anuncia.
>
> Se escribe aquí, y no se improvisa después, por **`F-SPEC-032-3`**: allí el choque con literales
> congelados de otra spec se descubrió a mitad de la implementación y hubo que declararlo a
> posteriori. Este párrafo es esa conversación, tenida **antes**.

## Notas para el gate humano

1. **La propuesta del encargo se adopta, con dos añadidos.** Con `--commit`, `unknown` pasa a
   transitorio y el 2 solo llega al expirar el plazo; en modo *smoke* sigue terminal e inmediato.
   Los añadidos son **D-C** (una línea en cuanto ve el primer `unknown`, para que 15 minutos de
   espera no parezcan un cuelgue) y **D-D** (`builtAt` se **imprime** para desempatar a ojo, pero
   **no** entra en la lógica: comparar el reloj del runner con el de Vercel compraría un caso raro
   a cambio de fallos intermitentes). Si prefieres el desempate automático por `builtAt`, dilo en el
   gate: es un CA distinto y cambia CA-3.
2. **El veredicto sigue siendo 2, no 1.** Es la decisión discutible de la spec (§D-B). A favor:
   conserva la distinción que ADR-018 D-6 llama *"la alarma"* y que §12.3 usa para mandar a mirar
   sitios distintos. En contra: cuando la causa es *"el build falló y quedó vivo el despliegue por
   CLI de antes"*, el código honesto sería el 1 (*no llegó*). Lo resuelvo con información y no con
   código: CA-3 obliga a que el mensaje diga **las dos causas** y cómo desempatarlas.
3. **Un test de SPEC-031 se toca, y el permiso está escrito** en §Fuera de alcance con su límite
   exacto. Es lo que el encargo pedía no volver a descubrir tarde.
4. **No hay ADR-021.** ADR-018 D-6 ya decidió que la puerta *espera y falla si no llega en un
   plazo*; el script se apartaba de esa decisión. Si en el gate consideras que la regla *"`--commit`
   define el modo"* merece quedar como decisión formal reutilizable, se escribe — pero mi juicio es
   que sería un ADR sin decisión dentro.
5. **Qué pasa con SPEC-028.** Sigue en `en-revision` con cuatro CA 🚀 abiertos, y **RI-02** le exige
   la puerta en verde. Esta spec es lo que hace posible ese verde. Orden sugerido: mergear SPEC-033,
   comprobar que **su propio** merge saca la puerta en verde a la primera —es la mejor verificación
   posible, y ocurre gratis— y usar ese run como evidencia para desbloquear el cierre de SPEC-028.
6. **Riesgo asumido, dicho en voz alta.** A partir de aquí, un merge cuyo build falle deja el job
   `Alive` corriendo **15 minutos** antes de ponerse rojo, en vez de 1 segundo. Es el precio de que
   el rojo signifique algo. Se mitiga con D-C (dice en el segundo 0 que está esperando, y por qué) y
   no cuesta dinero: los runners públicos de GitHub son gratis en repositorio público, que es lo que
   este repositorio es desde el 2026-08-19.
7. **Nada de esto exige desplegar para verificarse.** Los nueve CA se cierran con servidores de
   juguete en *loopback* y subprocesos reales, igual que SPEC-031. El verificador puede dar GREEN
   sin tocar producción.
