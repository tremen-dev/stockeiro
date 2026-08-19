---
id: SPEC-037
tipo: spec
epica: EPIC-004
estado: hecho
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-19, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-19, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-19, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-08-19, por: sdd-verificador}
---
# SPEC-037 — El grifo del registro y la pantalla de operación

## Problema

**Hoy el registro de Stockeiro está abierto de par en par y no hay manera de cerrarlo, ni de
saber cuánta gente ha entrado.** `registerAction` (`src/app/(auth)/actions.ts`) crea la
cuenta sin más condición que un email libre (**RN-02**), y no existe ninguna pantalla que
diga cuántas cuentas hay, cuántas acciones se están vigilando ni si el ciclo diario dejó
algún símbolo sin precio. El resultado del ciclo existe —`runCronCycle`
(`src/lib/triggers/cycle.ts`) lo devuelve entero en el cuerpo de la respuesta— y **muere
ahí**: para verlo hay que mirar los logs de Vercel.

Publicar en un hilo de un foro convierte las dos carencias en riesgo:

- **No poder cerrar la puerta.** Si el hilo funciona mejor de lo esperado, entran cien
  personas sobre un free tier de Marketstack (**R-1**, asumido a conciencia en el gate) y
  una cuota de búsqueda de Twelve Data **compartida entre todos** (**R-2**). **CE-6** exige
  cerrarlo y reabrirlo **sin desplegar** y que además se cierre solo al llegar a un cupo.
- **No saber cómo va.** **CE-7** pide una pantalla que responda en cinco segundos cuántas
  cuentas hay, cuántas vigiladas, **si el último ciclo corrió** y cuántos símbolos se
  quedaron sin precio. Y hay precedente: el defecto de cobertura de **EPIC-FIX** pasó
  **semanas** sin detectarse porque nadie miraba.

Sobre lo segundo hubo una decisión que el humano **corrigió**, y conviene que quede escrita.
Yo propuse **derivar** el estado del ciclo de `quotes.updated_at` y
`quote_diagnostics.attempted_at`, para no adelantar la idea *"Observabilidad del ciclo
diario"* que el roadmap tiene aparcada. El veredicto del 2026-08-19 lo rechazó porque esa
derivación **no responde la pregunta**: un ciclo que corre y no cambia nada es
indistinguible de uno que no corrió, y uno que revienta a mitad no deja rastro ninguno. De
modo que el ciclo **registra cada ejecución** (**ADR-023** ptos. 11 a 16) — con una frontera
tajante: **registrar y mostrar, nunca alertar**.

Y hay un tercer asunto que esta spec no decide pero sí consume: **quién puede tocar todo
eso**. Tras el mismo veredicto, el operador es el rol **`admin`** (**ADR-021**), así que la
pantalla se protege con el catálogo de secciones de **SPEC-034** y **esta spec no introduce
ningún mecanismo de acceso propio ni ninguna variable de entorno**.

Esta spec cubre **CE-6** y **CE-7**, y mitiga **R-7** (*"el grifo puede cerrarse en mal
momento"*: quien llega con la puerta cerrada **lee por qué**). **No bloquea publicar** —el
corte mínimo es SPEC-034 + SPEC-035 + SPEC-036—, pero es lo primero que se echa de menos el
día después.

Reglas en juego: **RN-01** (la pantalla cuenta filas, **no lista personas**: un agregado no
es un dato de usuario, y en el momento en que enseñe la fila de alguien sí lo sería),
**RN-02** (el alta sigue exigiendo email libre), **RN-03** (`/register` sigue siendo pública;
`/admin` exige sesión **y más**) y **RI-01** (la migración es aditiva).

## Usuarios / roles afectados

- **Operador (rol `admin`; hoy, Alberto Fojo)**: cierra y abre el registro desde `/admin` en
  dos clics, fija o quita el cupo, y ve de un vistazo cuántas cuentas y vigiladas hay y **si
  el ciclo de anoche corrió y cómo le fue**. Deja de depender de los logs de Vercel.
- **Visitante que llega del foro con el registro cerrado**: lee **por qué** —cerrado a mano o
  cupo completo— y qué puede hacer. **No** ve un error (**R-7**).
- **Tester ya registrado**: no se entera de nada. Con el registro cerrado **sigue entrando**
  con normalidad: cerrar el grifo cierra las **altas**, no la app.
- **Usuario `completo` que no es operador**: `/admin` no existe para él. Ni la ve, ni la
  alcanza, ni recibe ninguno de sus números.
- **Quien borra su cuenta (SPEC-036)**: libera una plaza del cupo. No es una fuga: recuperar
  la plaza exige haber renunciado antes a todos sus datos (**ADR-022** pto. 9).

## Criterios de aceptación

Cada CA es verificable con un test: la decisión pura y los agregados con **Vitest sobre
PGlite**, las pantallas y el flujo con **Playwright** sobre Postgres efímero, y el esquema
aplicado **desde las migraciones** (**ADR-019**).

- **CA-1 (Los ajustes existen, son una sola fila y nacen abiertos — ADR-023 ptos. 1 y 7,
  RI-01).**
  Dado el esquema aplicado desde `drizzle/`,
  cuando se inspecciona,
  entonces existe la tabla de ajustes del registro con `open_manually`, `capacity`
  (nullable), `updated_at` y `updated_by`; **la base impide insertar una segunda fila**; y la
  fila sembrada por la migración deja el registro **abierto y con cupo 50** (veredicto del
  humano, 2026-08-19). También existe `cron_runs` (CA-14). Ambas migraciones son **aditivas**
  (**RI-01**) y el código anterior a esta spec sigue funcionando con ellas.

- **CA-2 (La decisión es una función pura y exhaustiva — ADR-023 ptos. 3 y 4).**
  Dada la función que decide si el registro está abierto,
  cuando se evalúa con las combinaciones de (`open_manually` verdadero/falso) × (`capacity`
  nulo / mayor que las cuentas / igual a las cuentas / menor que las cuentas),
  entonces devuelve **abierto** solo cuando `open_manually` es verdadero **y** (`capacity`
  es nulo **o** las cuentas son **estrictamente menores** que `capacity`), y en los demás
  casos devuelve **cerrado con el motivo concreto** (manual o cupo). No lee la base, no
  importa Next y se prueba sin levantar nada. El caso frontera `cuentas == capacity` está
  **cerrado**.

- **CA-3 (Con el registro abierto no cambia nada — SPEC-001).**
  Dado el registro abierto,
  cuando alguien se da de alta,
  entonces funciona exactamente como hoy: cuenta creada, sesión iniciada, panel, y el mensaje
  de email duplicado intacto (**RN-02**, SPEC-001 CA-1/CA-2).

- **CA-4 (El interruptor manual cierra de verdad — CE-6, ADR-023 pto. 5).**
  Dado el registro cerrado a mano,
  cuando alguien visita `/register`, entonces **no ve el formulario** sino la pantalla de
  registro cerrado; y cuando se invoca `registerAction` **directamente**, entonces **no se
  crea ninguna cuenta**. Ocultar el formulario sin cerrar la acción **no** cumple este CA.

- **CA-5 (El cupo cierra solo — CE-6).**
  Dado `capacity = N` y **N** cuentas existentes,
  cuando alguien intenta registrarse,
  entonces **no se crea la cuenta**, aunque `open_manually` sea verdadero; y con **N−1**
  cuentas, el alta **sí** funciona y deja el registro cerrado para la siguiente.

- **CA-6 (Quien llega con la puerta cerrada lee POR QUÉ, y el porqué correcto — CE-6, R-7).**
  Dado el registro cerrado **a mano** y, en otra ejecución, cerrado **por cupo**,
  cuando un visitante llega a `/register`,
  entonces lee **dos mensajes distintos**, cada uno correspondiente a su motivo, con
  indicación de qué puede hacer; **no** hay error de Next, **no** hay 500 y **no** hay
  redirección muda.

- **CA-7 (Se cierra y se reabre sin desplegar y sin esperar — CE-6, ADR-023 pto. 6).**
  Dada la app **corriendo, sin reiniciar ni reconstruir**,
  cuando el operador cierra el registro desde `/admin`,
  entonces **la siguiente** visita a `/register` ya lo ve cerrado; y cuando lo reabre, la
  siguiente visita ya lo ve abierto. Sin caché de módulo, sin revalidación diferida, sin
  variable de entorno.

- **CA-8 (Cerrar el grifo no cierra la app).**
  Dado el registro cerrado por cualquiera de los dos motivos,
  cuando un usuario **ya registrado** inicia sesión, recupera su contraseña y usa Vigiladas y
  Avisos,
  entonces todo funciona con normalidad. El grifo afecta **solo** al alta.

- **CA-9 (Borrar una cuenta libera plaza — ADR-022 pto. 9, frontera con SPEC-036).**
  Dado el registro cerrado **por cupo**,
  cuando un usuario borra su cuenta (**SPEC-036**),
  entonces el registro vuelve a estar **abierto** y una alta nueva funciona: el cupo cuenta
  **cuentas vivas**.

- **CA-10 (La pantalla es solo para el rol `admin` — ADR-023 pto. 9, CE-7).**
  Dada `/admin`,
  cuando la visitan (a) alguien **sin sesión**, (b) un `tester`, (c) un `completo` y (d) un
  `admin`,
  entonces solo **(d)** obtiene la pantalla; (a) va a `/login`, y (b) y (c) **no reciben
  ninguno de los contadores** —rebotan igual que con cualquier otra sección cerrada
  (**SPEC-034** CA-6/CA-8)—. La decisión **no** es un mecanismo nuevo: es el **mismo
  catálogo de secciones** de SPEC-034 CA-4, con la sección `operación`. **No hay ninguna
  variable de entorno implicada.**

- **CA-11 (Y sus acciones también — ADR-023 pto. 9).**
  Dado un usuario que **no** es `admin`,
  cuando invoca directamente la server action que cambia el interruptor o el cupo,
  entonces **no se modifica la fila de ajustes**. Igual que **CA-7 de SPEC-034**: cerrar la
  pantalla sin cerrar la acción es esconder, no cerrar.

- **CA-12 (Degradar al operador le cierra la pantalla en el acto — ADR-021 pto. 4).**
  Dado un `admin` con sesión abierta **dentro** de `/admin`,
  cuando su rol pasa a `completo` en la base,
  entonces en su **siguiente petición** ya no accede a la pantalla ni ve su enlace, **con la
  misma cookie**. Es la propiedad que la lista de emails no daba: revocar la operación no
  espera a ningún redespliegue ni a ningún token.

- **CA-13 (Los cuatro contadores dicen la verdad — CE-7).**
  Dada una base sembrada con un número conocido de cuentas, de acciones vigiladas, de
  símbolos en el universo del ciclo y de símbolos con diagnóstico de "sin precio",
  cuando el operador abre `/admin`,
  entonces los cuatro números **coinciden exactamente** con la base, y los símbolos sin
  precio aparecen **con su motivo** (`QuoteFailureReason`, **SPEC-016**), no como un número
  mudo.

- **CA-14 (Cada ejecución del ciclo deja una fila — CE-7, ADR-023 ptos. 11 a 13).**
  Dado un ciclo autorizado que se ejecuta hasta el final,
  cuando termina,
  entonces existe **exactamente una** fila nueva en `cron_runs` con `started_at` **anterior**
  a `finished_at`, desenlace de éxito, y **todos los contadores iguales a los del
  `CycleResult` devuelto** —`requested`, `updated`, `skipped`, disparos abiertos y cerrados,
  avisos individuales y agregados—. Una sola definición: lo que se registra es lo que el
  endpoint del cron ya devolvía.

- **CA-15 (Un ciclo que revienta a mitad se nota, y no se traga el error — ADR-023 pto. 12).**
  Dado un ciclo cuya ingesta lanza a mitad,
  cuando se ejecuta,
  entonces queda una fila con `started_at` puesto, **`finished_at` nulo o desenlace de
  fallo** y el error registrado; **y la excepción se vuelve a lanzar**, de modo que el
  endpoint sigue comportándose como hoy. Es exactamente el caso que **ninguna derivación de
  `quotes`/`quote_diagnostics` podía detectar**, y la razón de que esta tabla exista.

- **CA-16 (Un ciclo que corre sin cambiar nada TAMBIÉN deja constancia — CE-7).**
  Dado un ciclo con **universo vacío** (ningún símbolo vigilado ni operado) o cuyo proveedor
  devuelve exactamente los mismos precios,
  cuando se ejecuta,
  entonces **también** escribe su fila, y `/admin` puede afirmar que **el ciclo corrió** con
  cero actualizaciones. Este es el CA que separa esta solución de la derivación que propuse
  y que el humano rechazó: allí, "corrió y no cambió nada" era indistinguible de "no corrió".

- **CA-17 (Una petición no autorizada NO escribe fila — ADR-023 pto. 14).**
  Dada una petición a `/api/cron/refresh` **sin el secreto correcto**,
  cuando se procesa,
  entonces responde 401 como hoy (SPEC-004 CA-7) y **no se crea ninguna fila** en
  `cron_runs`: un 401 no es una ejecución, y quien sondee el endpoint no llena la tabla.

- **CA-18 (`/admin` cuenta el último ciclo como es — CE-7).**
  Dada una base con varias filas de `cron_runs` de fechas distintas,
  cuando el operador abre la pantalla,
  entonces ve **la más reciente**: cuándo empezó, **si terminó**, y sus contadores; y dada
  una base **sin ninguna fila**, lee explícitamente que **el ciclo no ha corrido nunca** —no
  una fecha inventada, no un hueco, no un cero ambiguo—.

- **CA-19 (Registrar no es alertar, y se prueba — ADR-023 pto. 15, épica §Fuera).**
  Dado un ciclo que falla y deja su fila de fallo,
  cuando termina,
  entonces **no se ha enviado ningún mensaje al operador**: `FakeNotificationSender` no
  registra ningún envío dirigido a él y **no se crea ninguna fila en `notifications`** que no
  sea un aviso de zona de un usuario. La alerta proactiva sigue **fuera de alcance** y esta
  tabla no es la puerta de atrás por la que se cuela.

- **CA-20 (La respuesta del cron no cambia — ADR-023 pto. 16).**
  Dado `/api/cron/refresh`,
  cuando se invoca con el secreto correcto,
  entonces devuelve **el mismo cuerpo que hoy** con el mismo `CycleResult` y el mismo código:
  la tabla es un registro **adicional**, no un sustituto, y `tests/cron-refresh.test.ts`
  sigue verde sin cambiar expectativas.

- **CA-21 (El operador cambia el grifo y queda constancia de quién y cuándo — CE-6).**
  Dado el operador en `/admin`,
  cuando cambia el interruptor y fija, modifica o **retira** el cupo,
  entonces los valores quedan persistidos, `updated_at` y `updated_by` reflejan el cambio y
  **la pantalla muestra el estado resultante**; un cupo inválido (negativo, o no entero) se
  **rechaza** sin modificar nada.

- **CA-22 (La pantalla de operación no enseña a nadie — RN-01, ADR-023 pto. 10).**
  Dada una base con varios usuarios y sus datos,
  cuando el operador abre `/admin`,
  entonces la página **no contiene ningún email, ningún ticker de la cartera o vigiladas de
  nadie, ni ninguna fila individual de usuario**: solo agregados, el estado del grifo y los datos del último ciclo, que no llevan `userId` ninguno.

- **CA-23 (Responde deprisa porque pregunta poco — CE-7).**
  Dada una base sembrada con volumen (p. ej. 500 cuentas y 5.000 vigiladas) y un doble que
  **cuenta** las consultas,
  cuando se compone la pantalla,
  entonces el número de consultas es **constante** —no crece con el número de cuentas ni de
  símbolos— y todas son agregaciones. Los cinco segundos de CE-7 se garantizan por la forma
  de las consultas, no por un cronómetro que un día va lento y falla la CI.

- **CA-24 (El acceso a la pantalla se ofrece solo a quien puede usarla).**
  Dada la navegación,
  cuando la ve el operador y cuando la ve cualquier otro usuario,
  entonces solo un `admin` encuentra camino a `/admin` —el enlace lo decide el **mismo catálogo** de SPEC-034 CA-4, no una condición aparte—, y el resto de la navegación
  (Panel/Vigiladas/Avisos, y Cartera según **SPEC-034**) queda **igual** para todos.

- **CA-25 (No degrada lo entregado).**
  Dada la suite existente,
  cuando se ejecuta completa,
  entonces sigue verde, incluidos los CA de registro de **SPEC-001** y los de **SPEC-034**.

## Entidades y reglas afectadas

**Entidades nuevas** (`src/db/schema.ts`, migraciones en `drizzle/`), las dos de estado
**operativo** —sin `userId`, fuera del alcance de **RN-01** porque no son de nadie—:

- **Ajustes del registro**: **una sola fila** impuesta por el esquema (clave primaria
  constante con `CHECK`, **ADR-023** pto. 1), con `open_manually boolean NOT NULL`,
  `capacity integer` (nullable = sin cupo), `updated_at` y `updated_by`. La migración
  **siembra** la fila **abierta y con cupo 50**, y esos valores viven en **una** constante
  nombrada que es también la respuesta si la fila faltara (**ADR-023** pto. 7).
- **`cron_runs`**: una fila por ejecución autorizada del ciclo, con `started_at`,
  `finished_at` (nulo mientras no termina, **ADR-023** pto. 12), desenlace, `error` y los
  contadores de `CycleResult` —`requested`, `updated`, `skipped`, disparos abiertos y
  cerrados, avisos individuales y agregados—. **Los contadores no se redefinen**: son los que
  `runCronCycle` ya devuelve (**ADR-023** pto. 13).

**Rutas nuevas**: `/admin` (autenticada y **restringida al rol `admin`**; es la sección
`operación` del catálogo de **SPEC-034**, no un mecanismo aparte). `/register` **no** es
nueva: cambia de contenido según el grifo, y **sigue siendo pública** (`PUBLIC_PREFIXES` no
cambia).

**Piezas existentes que se extienden**: `registerAction` (`src/app/(auth)/actions.ts`), que
consulta el grifo **antes** de crear nada (CA-4/CA-5); `runCronCycle`
(`src/lib/triggers/cycle.ts`), que abre y cierra la fila de `cron_runs` alrededor del ciclo
**sin cambiar su respuesta** (CA-14, CA-20); `AppNav` (`src/app/app-nav.tsx`), que gana el
acceso a `/admin` leyendo el catálogo (CA-24); `symbolUniverse`
(`src/lib/market/refresh.ts`), reutilizado como definición del contador de símbolos del
ciclo para que **no haya dos definiciones de "universo"** en el proyecto.

**Configuración nueva: ninguna.** Tras el veredicto del 2026-08-19 el operador es un rol, así
que esta spec **no añade ninguna variable de entorno** — y por tanto **no toca** la lista
cerrada de claves de `.env.example` que congela `tests/spec-031-frontera.test.ts` (CA-13.3).

**Reglas y decisiones**: **RN-01** (CA-22), **RN-02** (intacta, CA-3), **RN-03** (intacta:
ninguna ruta pública nueva), **RI-01** (CA-1); **ADR-023** (origen de esta spec, en
`borrador`), **ADR-021** (el rol `admin` como identidad del operador), **ADR-022** pto. 9 (el
cupo cuenta cuentas vivas), **ADR-004**/**ADR-005**/**ADR-006** (el ciclo cuyo resultado se
registra) y **SPEC-016** (los motivos de "sin precio"). Dominio: se añaden a
`docs/fundacion/dominio.md` los términos **Grifo del registro**, **Cupo**, **Operador** y
**Ejecución del ciclo**.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Alerta proactiva al operador si el cron falla.** Fuera por decisión escrita de la épica,
  y **esta es la frontera más importante de la spec** (**ADR-023** pto. 15, **CA-19**): el
  resultado del ciclo **se registra y se muestra**, y **nada más**. No hay correo, no hay
  aviso in-app, no hay webhook y no hay nadie a quien se despierte. Ahora que la tabla
  existe, añadir esa alerta será una tarde de trabajo y por eso está escrita como CA
  negativo: *que sea fácil no la pone dentro de alcance*. La alerta al operador sigue siendo
  la idea **"Observabilidad del ciclo diario"** del roadmap y necesita su propia spec.
- **Cualquier otro consumo de `cron_runs`**: gráficas de evolución, series históricas,
  comparativas entre ciclos, exportación. Aquí solo se lee **la última fila** (CA-18).
- **Analítica de uso y retención**: fuera de la épica. Estos son **contadores operativos**,
  no un panel de producto: no hay usuarios activos, ni retención, ni embudos.
- **Cambiar el rol de una cuenta desde `/admin`**: **F-ADR-021-1**. Sería la primera
  escritura del proyecto sobre la cuenta de otra persona y merece su propia spec.
- **Ver, buscar o listar usuarios**: prohibido por CA-22. Una pantalla de operación que
  empieza listando emails termina siendo un panel de administración de personas.
- **Lista de espera o aviso a quien encontró la puerta cerrada**: **F-ADR-023-3**. El único
  camino que se le ofrece es el canal de feedback de **SPEC-039**.
- **Historial de cambios del grifo**: **F-ADR-023-1**. Solo se guarda el estado actual con su
  `updated_at`/`updated_by`.
- **Purga o retención de `cron_runs`**: **F-ADR-023-2**. Una fila al día no urge nada.
- **Verificación de email al registrarse**: fuera de la épica por decisión escrita. El grifo
  limita **cuántos** entran, no **quién**.
- **Anti-abuso del registro** (captcha, límites por IP): infraestructura (Vercel Firewall),
  no producto. El grifo no es una defensa contra un bot: es un tope de aforo.
- **Cambiar de plan en Marketstack**: **F-EPIC-004-1**, acción de ops ya decidida.

## Salvedades y follow-ups

- **F-SPEC-037-1 (DESPLIEGUE, bloqueante del *merge*).** Las migraciones crean **dos** tablas
  y el build migra en **todos** los entornos con `DATABASE_URL` compartida: **abrir la PR
  migra producción** (`F-SPEC-023-1`). Son aditivas (dos `CREATE TABLE` + un `INSERT` de la
  fila semilla) y el código vigente sigue funcionando, pero **cuándo se abre la PR es
  decisión del humano**.
- **F-SPEC-037-2 (DESPLIEGUE): ninguna variable nueva.** Se registra en positivo porque en la
  versión anterior de esta spec sí había una (`ADMIN_EMAILS`) y era un prerrequisito
  bloqueante. Tras el veredicto del rol, **no hay nada que aprovisionar en Vercel** ni nada
  que pueda faltar.
- **F-SPEC-037-3 (residual asumido, ADR-023 pto. 8).** Dos altas exactamente simultáneas en
  la última plaza pueden dejar el contador **uno por encima** del cupo. Aceptado: el cupo es
  un tope operativo con margen amplio, no una licencia. A partir de ahí no entra nadie más.
- **F-SPEC-037-4 (residual asumido, ADR-023 pto. 12).** El único caso que `cron_runs` no
  distingue con certeza es **el ciclo que nunca llegó a dispararse**: Vercel Cron podría no
  invocar el endpoint y entonces no hay fila ninguna, exactamente igual que si el despliegue
  estuviera caído. `/admin` lo dice como lo que es —*"la última ejecución registrada fue el
  X"*— y es el operador quien juzga si esa fecha es vieja. Cerrarlo del todo exigiría una
  alerta, que está **fuera de alcance** por decisión de la épica.
- **F-SPEC-037-5 (higiene).** Con el cupo alcanzado, la app deja de crecer sin avisar a
  nadie: **no hay notificación al operador** cuando se llega al tope. Se ve entrando en
  `/admin`, que es exactamente lo que la épica pidió y nada más.
- **F-SPEC-037-6 (higiene, hereda F-ADR-023-2).** `cron_runs` crece una fila al día y nadie
  la purga. Inocuo durante años; sitio natural para la purga, el propio ciclo diario, como
  **F-SPEC-023-2** para los tokens caducados.

## Notas para el gate humano

1. **El mecanismo del grifo es ADR-023 y responde a la disyuntiva que planteaste.** Elijo
   **base de datos**, no variable de entorno, porque cambiar una variable en Vercel exige
   **redespliegue** — y en este proyecto **el build migra la base**, así que redesplegar para
   mover un interruptor es desproporcionado justo en el momento en que no quieres tocar nada.
   Es exactamente el "roza el sin desplegar de CE-6" que tú mismo señalaste, y creo que no lo
   roza: lo incumple.

2. **Descarté Edge Config, y quiero que sepas que era una opción legítima.** Da ajuste sin
   redespliegue de verdad. La rechacé porque mete **un proveedor más** en la arquitectura y,
   por tanto, en la lista de subencargados de **SPEC-035** CA-6, para guardar un dato que la
   app ya lee de la base en cada alta. Si prefieres Edge Config, dilo: cambia ADR-023 y
   cambian CA-1 y CA-7, pero la spec sobrevive.

3. **Quién es operador: tu veredicto, absorbido — y sale de esta spec.** Yo proponía
   `ADMIN_EMAILS` + rol `completo`; elegiste el **tercer rol `admin`**. Está aplicado y creo
   que acertaste: la conjunción que yo defendía era **dos parches** (prohibir el borrado de
   esa cuenta *y* exigir un rol además del email) para sostener un mecanismo que no debería
   necesitarlos. Con el rol, esta spec pierde su única variable de entorno, su único
   prerrequisito de despliegue y dos modos de fallo. Lo que **cuesta** —y conviene que lo
   tengas presente— es que **no se puede ser operador sin ver Cartera**: la cadena de roles
   (**ADR-021** pto. 1.a) los une. Hoy da igual porque el operador eres tú; el día que quieras
   un operador que no vea carteras, hará falta otro ADR.

4. **Tabla de ejecuciones del cron: tu veredicto, absorbido — y me convenciste.** Yo derivaba
   el estado del ciclo de `quotes`/`quote_diagnostics` para no adelantar la idea del roadmap.
   Tenías razón en que eso **no responde CE-7**: hay dos casos que la derivación no ve —el
   ciclo que corre sin cambiar nada (**CA-16**) y el que **revienta a mitad** (**CA-15**)— y
   el segundo es justo el que más importa. Lo que he hecho para no comerme la idea del
   roadmap es **escribir la frontera como CA negativo**: **CA-19** exige que un ciclo fallido
   **no envíe nada a nadie**. Registrar sí, alertar no. Sin ese CA, la primera tarde libre
   alguien añade el correo de "el ciclo falló" y la idea del roadmap se queda a medias dentro
   de esta épica.
   Coste de la decisión: la spec pasa de 18 a **25 CA** (estimé +2 y son +7 — los conté mal:
   la fila hay que abrirla, cerrarla, no escribirla si el 401, mostrarla, y **no** alertar).

   **Resuelto en el gate: la spec NO se parte**, y con mi propio argumento —el interruptor
   vive **en** esa pantalla, y separarlas dejaría el grifo sin forma de moverse; una spec que
   no se puede verificar sola no es una spec, es media—. Los 25 CA se asumen.

   **Costura documentada, por si el verificador quiere atacarla en dos pasadas** (esto es una
   sugerencia de método, **no** una división de la spec: se aprueba, se implementa y se cierra
   como **una**):
   - **Pasada 1 — el grifo (CA-1..CA-12)**: ajustes, decisión pura, cierre manual, cupo,
     mensajes de puerta cerrada, efecto inmediato, plaza liberada y acceso por rol. Se puede
     ejercitar entera desde `/register` y la fila de ajustes.
   - **Pasada 2 — operación y ciclo (CA-13..CA-25)**: contadores, `cron_runs` (incluido el
     CA negativo de "no alertar"), pantalla, rendimiento y no-regresión. Necesita ejecutar el
     ciclo, que es un montaje distinto.

5. **El cupo puede rebasarse en uno (F-SPEC-037-3).** Asumido y declarado. Hacerlo exacto
   exige serializar las altas, y pagar contención permanente por una plaza que nadie va a
   auditar no me parece un buen cambio.

6. **CA-22 prohíbe listar usuarios, y con el rol `admin` importa más que antes.** La
   tentación de añadir *"ver los últimos registros"* llegará el primer día, y ahora la
   pantalla la abre algo que se llama literalmente "admin". En cuanto enseñe una fila
   individual, deja de ser operación y pasa a ser administración de personas — y **RN-01**
   deja de ser una verdad simple. `admin` **no ve datos de nadie**; eso está también en
   **SPEC-034** CA-13.

7. **Cupo inicial: 50, como fijaste.** Va en la fila semilla de la migración (CA-1). Recuerda
   que es **semilla, no política**: se cambia desde `/admin` sin desplegar (CA-7/CA-21), que
   es exactamente lo que CE-6 exige. Si el hilo va bien y quieres 120, son dos clics.

8. **Secuencia.** **Secuencia sancionada en el gate del 2026-08-19: 034 → 035 → 036 → 037 → 039 → 038.** Esta va **cuarta**: después de **SPEC-034** (necesita `role` para
   CA-10 y el catálogo para CA-24) y de **SPEC-036** (CA-9 comprueba que un borrado libera
   plaza). No bloquea publicar, pero es lo primero que echarás de menos si el hilo funciona.

9. **Aprobación**: la spec queda en **`borrador`** y **no la firmo yo**. **ADR-023** nace
   también en `borrador` y se aprueba en este mismo gate.
