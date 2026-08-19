---
id: SPEC-037
tipo: spec
epica: EPIC-004
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
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
  cuentas hay, cuántas vigiladas, si el último ciclo corrió y cuántos símbolos se quedaron
  sin precio. Y hay precedente: el defecto de cobertura de **EPIC-FIX** pasó **semanas** sin
  detectarse porque nadie miraba.

Y hay un tercer problema, más callado, que esta spec resuelve porque no queda otra: **quién
puede tocar todo eso**. El rol de **SPEC-034** tiene dos valores y ninguno significa "opera
el servicio": abrir la pantalla a cualquier `completo` significaría que promover a un tester
para que pruebe Cartera le entrega también el interruptor del registro. Se resuelve en
**ADR-023**, que separa *qué ves de lo tuyo* de *quién opera esto*.

Esta spec cubre **CE-6** y **CE-7**, y mitiga **R-7** (*"el grifo puede cerrarse en mal
momento"*: quien llega con la puerta cerrada **lee por qué**). **No bloquea publicar** —el
corte mínimo es SPEC-034 + SPEC-035 + SPEC-036—, pero es lo primero que se echa de menos el
día después.

Reglas en juego: **RN-01** (la pantalla cuenta filas, **no lista personas**: un agregado no
es un dato de usuario, y en el momento en que enseñe la fila de alguien sí lo sería),
**RN-02** (el alta sigue exigiendo email libre), **RN-03** (`/register` sigue siendo pública;
`/admin` exige sesión **y más**) y **RI-01** (la migración es aditiva).

## Usuarios / roles afectados

- **Operador (Alberto Fojo)**: cierra y abre el registro desde `/admin` en dos clics, fija o
  quita el cupo, y ve de un vistazo cuántas cuentas y vigiladas hay y si llegaron datos de
  mercado. Deja de depender de los logs de Vercel.
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
  fila sembrada por la migración deja el registro **abierto y sin cupo**. La migración es
  **aditiva** (**RI-01**) y el código anterior a esta spec sigue funcionando con ella.

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

- **CA-10 (Ser operador exige las DOS condiciones — ADR-023 ptos. 9 y 10, CE-7).**
  Dada `/admin`,
  cuando la visitan (a) alguien **sin sesión**, (b) un `tester` **listado** en la
  configuración de operador, (c) un `completo` **no listado** y (d) un `completo`
  **listado**,
  entonces solo **(d)** obtiene la pantalla; (a) va a `/login` y (b) y (c) **no reciben
  ninguno de los contadores** ni saben que la ruta existe. La comprobación es una **función
  pura** (email + rol + lista) probada caso a caso, incluidas mayúsculas y espacios en la
  lista.

- **CA-11 (Y sus acciones también — ADR-023 pto. 12).**
  Dado un usuario que **no** es operador,
  cuando invoca directamente la server action que cambia el interruptor o el cupo,
  entonces **no se modifica la fila de ajustes**. Igual que **CA-7 de SPEC-034**: cerrar la
  pantalla sin cerrar la acción es esconder, no cerrar.

- **CA-12 (Los cuatro contadores dicen la verdad — CE-7).**
  Dada una base sembrada con un número conocido de cuentas, de acciones vigiladas, de
  símbolos en el universo del ciclo y de símbolos con diagnóstico de "sin precio",
  cuando el operador abre `/admin`,
  entonces los cuatro números **coinciden exactamente** con la base, y los símbolos sin
  precio aparecen **con su motivo** (`QuoteFailureReason`, **SPEC-016**), no como un número
  mudo.

- **CA-13 (El último ciclo se dice sin mentir — ADR-023 ptos. 13 y 14).**
  Dada una base con cotizaciones y diagnósticos de fechas distintas,
  cuando el operador abre `/admin`,
  entonces ve la **marca más reciente** entre `quotes.updated_at` y
  `quote_diagnostics.attempted_at`, rotulada como **último dato de mercado registrado** —no
  como *"el cron corrió"*—; y con una base sin cotizaciones ni diagnósticos ve que **no hay
  ningún dato registrado**, no una fecha inventada ni un hueco.

- **CA-14 (El operador cambia el grifo y queda constancia de quién y cuándo — CE-6).**
  Dado el operador en `/admin`,
  cuando cambia el interruptor y fija, modifica o **retira** el cupo,
  entonces los valores quedan persistidos, `updated_at` y `updated_by` reflejan el cambio y
  **la pantalla muestra el estado resultante**; un cupo inválido (negativo, o no entero) se
  **rechaza** sin modificar nada.

- **CA-15 (La pantalla de operación no enseña a nadie — RN-01, ADR-023 pto. 15).**
  Dada una base con varios usuarios y sus datos,
  cuando el operador abre `/admin`,
  entonces la página **no contiene ningún email, ningún ticker de la cartera o vigiladas de
  nadie, ni ninguna fila individual de usuario**: solo agregados y la fecha del último dato.

- **CA-16 (Responde deprisa porque pregunta poco — CE-7).**
  Dada una base sembrada con volumen (p. ej. 500 cuentas y 5.000 vigiladas) y un doble que
  **cuenta** las consultas,
  cuando se compone la pantalla,
  entonces el número de consultas es **constante** —no crece con el número de cuentas ni de
  símbolos— y todas son agregaciones. Los cinco segundos de CE-7 se garantizan por la forma
  de las consultas, no por un cronómetro que un día va lento y falla la CI.

- **CA-17 (El acceso a la pantalla se ofrece solo a quien puede usarla).**
  Dada la navegación,
  cuando la ve el operador y cuando la ve cualquier otro usuario,
  entonces solo el operador encuentra camino a `/admin`, y el resto de la navegación
  (Panel/Vigiladas/Avisos, y Cartera según **SPEC-034**) queda **igual** para todos.

- **CA-18 (No degrada lo entregado).**
  Dada la suite existente,
  cuando se ejecuta completa,
  entonces sigue verde, incluidos los CA de registro de **SPEC-001** y los de **SPEC-034**.

## Entidades y reglas afectadas

**Entidad nueva** (`src/db/schema.ts`, migración en `drizzle/`): la tabla de **ajustes del
registro**, de **una sola fila** impuesta por el esquema (clave primaria constante con
`CHECK`, **ADR-023** pto. 1), con `open_manually boolean NOT NULL`, `capacity integer`
(nullable = sin cupo), `updated_at` y `updated_by`. La migración **siembra** la fila con los
valores por defecto del producto —abierto, sin cupo— y esos mismos valores viven en **una**
constante nombrada que es también la respuesta si la fila faltara (**ADR-023** pto. 7).

**No se crea** ninguna tabla de ejecuciones del cron: el estado del último ciclo se **deriva**
de `quotes` y `quote_diagnostics` (**ADR-023** pto. 13). Instrumentar el ciclo es la idea
*"Observabilidad del ciclo diario"* del roadmap y no se adelanta aquí.

**Rutas nuevas**: `/admin` (autenticada **y** restringida al operador; **no** es una sección
del catálogo de **SPEC-034**). `/register` **no** es nueva: cambia de contenido según el
grifo, y **sigue siendo pública** (`PUBLIC_PREFIXES` no cambia).

**Piezas existentes que se extienden**: `registerAction` (`src/app/(auth)/actions.ts`), que
consulta el grifo **antes** de crear nada (CA-4/CA-5); `AppNav` (`src/app/app-nav.tsx`), que
gana el acceso a `/admin` solo para el operador (CA-17); `symbolUniverse`
(`src/lib/market/refresh.ts`), reutilizado como definición del contador de símbolos del
ciclo para que **no haya dos definiciones de "universo"** en el proyecto.

**Configuración nueva**: `ADMIN_EMAILS` (lista separada por comas, **ADR-023** pto. 9). Se
añade a `.env.example` con su explicación y al runbook, como el resto.

**Reglas y decisiones**: **RN-01** (CA-15), **RN-02** (intacta, CA-3), **RN-03** (intacta:
ninguna ruta pública nueva), **RI-01** (CA-1); **ADR-023** (origen de esta spec, en
`borrador`), **ADR-021** (el rol, segunda condición del operador), **ADR-022** pto. 9 (el
cupo cuenta cuentas vivas), **ADR-004**/**SPEC-016** (de dónde sale el estado del ciclo).
Dominio: se añaden a `docs/fundacion/dominio.md` los términos **Grifo del registro**,
**Cupo** y **Operador**.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Alerta proactiva al operador si el cron falla**: fuera por decisión escrita de la épica.
  Aquí el resultado del último ciclo **solo se muestra**.
- **Tabla de ejecuciones del cron / observabilidad del ciclo**: idea del roadmap, rechazada
  aquí en **ADR-023** (alternativas). Su precio está declarado en el pto. 14 del ADR.
- **Analítica de uso y retención**: fuera de la épica. Estos son **contadores operativos**,
  no un panel de producto: no hay usuarios activos, ni retención, ni embudos.
- **Cambiar el rol de una cuenta desde `/admin`**: **F-ADR-021-1**. Sería la primera
  escritura del proyecto sobre la cuenta de otra persona y merece su propia spec.
- **Ver, buscar o listar usuarios**: prohibido por CA-15. Una pantalla de operación que
  empieza listando emails termina siendo un panel de administración de personas.
- **Lista de espera o aviso a quien encontró la puerta cerrada**: **F-ADR-023-3**. El único
  camino que se le ofrece es el canal de feedback de **SPEC-039**.
- **Historial de cambios del grifo**: **F-ADR-023-2**. Solo se guarda el estado actual con su
  `updated_at`/`updated_by`.
- **Verificación de email al registrarse**: fuera de la épica por decisión escrita. El grifo
  limita **cuántos** entran, no **quién**.
- **Anti-abuso del registro** (captcha, límites por IP): infraestructura (Vercel Firewall),
  no producto. El grifo no es una defensa contra un bot: es un tope de aforo.
- **Cambiar de plan en Marketstack**: **F-EPIC-004-1**, acción de ops ya decidida.

## Salvedades y follow-ups

- **F-SPEC-037-1 (DESPLIEGUE, bloqueante del *merge*).** La migración crea una tabla y el
  build migra en **todos** los entornos con `DATABASE_URL` compartida: **abrir la PR migra
  producción** (`F-SPEC-023-1`). Es aditiva (`CREATE TABLE` + `INSERT` de la fila semilla) y
  el código vigente sigue funcionando, pero **cuándo se abre la PR es decisión del humano**.
- **F-SPEC-037-2 (DESPLIEGUE).** `ADMIN_EMAILS` en Vercel (**F-ADR-023-1**). **Si falta, no
  hay operador**: `/admin` no es accesible para nadie y el grifo solo se mueve con un
  `UPDATE` en Neon. Y afecta también a **CA-11 de SPEC-036** (sin la variable, ninguna cuenta
  está protegida contra su propio borrado).
- **F-SPEC-037-3 (residual asumido, ADR-023 pto. 8).** Dos altas exactamente simultáneas en
  la última plaza pueden dejar el contador **uno por encima** del cupo. Aceptado: el cupo es
  un tope operativo con margen amplio, no una licencia. A partir de ahí no entra nadie más.
- **F-SPEC-037-4 (residual asumido, ADR-023 pto. 14).** Un ciclo que corre y no cambia nada
  es **indistinguible** de un ciclo que no corrió. Por eso el rótulo habla de datos y no de
  ejecuciones (CA-13). Cerrarlo del todo es la idea del roadmap.
- **F-SPEC-037-5 (higiene).** Con el cupo alcanzado, la app deja de crecer sin avisar a
  nadie: **no hay notificación al operador** cuando se llega al tope. Se ve entrando en
  `/admin`, que es exactamente lo que la épica pidió y nada más.

## Notas para el gate humano

1. **El mecanismo del grifo es ADR-023 y responde a la disyuntiva que planteaste.** Elijo
   **base de datos**, no variable de entorno, porque cambiar una variable en Vercel exige
   **redespliegue** — y en este proyecto **el build migra la base**, así que redesplegar para
   mover un interruptor es desproporcionado justo en el momento en que no quieres tocar nada.
   Es exactamente el "roza el sin desplegar de CE-6" que tú mismo señalaste, y creo que no lo
   roza: lo incumple.

2. **Descarté Edge Config, y quiero que sepas que era una opción legítima.** Da ajuste sin
   redespliegue de verdad. La rechacé porque mete **un proveedor más** en la arquitectura y,
   por tanto, en la lista de subencargados de **SPEC-035** CA-5, para guardar un dato que la
   app ya lee de la base en cada alta. Si prefieres Edge Config, dilo: cambia ADR-023 y
   cambian CA-1 y CA-7, pero la spec sobrevive.

3. **La decisión que va MÁS ALLÁ de lo que fijaste: quién es operador (ADR-023 pto. 9).** El
   gate fijó dos roles (`tester`/`completo`) para la **visibilidad de sección**, y ninguno
   dice "opera el servicio". He resuelto **fuera del rol**: operador = email en `ADMIN_EMAILS`
   **y** rol `completo`. La conjunción no es adorno: cierra el caso de un email listado que
   **no** esté registrado y que alguien pudiera reclamar (toda cuenta nueva nace `tester`).
   **La alternativa es un tercer rol `admin`**, que es más convencional y amplía el enum que
   tú acotaste. **Este es el punto donde más me interesa tu veredicto.**

4. **No creo tabla de ejecuciones del cron, y eso tiene un precio honesto (CA-13).** La
   pantalla puede decir *"último dato de mercado registrado: 18 ago"*, pero **no** puede
   decir *"el cron corrió"*: un ciclo que corre sin cambiar nada es indistinguible de uno
   que no corrió. Lo he hecho así porque instrumentar el ciclo es la idea *"Observabilidad
   del ciclo diario"* que tienes aparcada en el roadmap, y hacer media idea del roadmap
   dentro de otra épica es cómo se acaba con las dos a medias. Si prefieres cerrarlo ya, es
   una tabla pequeña y **dos CA más** — pero entonces asume que estás metiendo parte de esa
   idea aquí.

5. **El cupo puede rebasarse en uno (F-SPEC-037-3).** Asumido y declarado. Hacerlo exacto
   exige serializar las altas, y pagar contención permanente por una plaza que nadie va a
   auditar no me parece un buen cambio.

6. **CA-15 prohíbe listar usuarios, y es a propósito.** La tentación de añadir *"ver los
   últimos registros"* llegará el primer día. En cuanto la pantalla enseñe una fila
   individual, deja de ser operación y pasa a ser administración de personas — y **RN-01**
   deja de ser una verdad simple.

7. **Cupo inicial: no propongo número.** Depende de cuánta gente quieras y de tu tolerancia
   al riesgo con el free tier. Si quieres que salga con un valor distinto de "sin cupo", dilo
   en el gate y va en la fila semilla; si no, se publica abierto y lo fijas desde `/admin`
   cuando veas el ritmo.

8. **Secuencia.** Va **después de SPEC-034** (necesita `role` para CA-10) y **después de
   SPEC-036** (CA-9 comprueba que un borrado libera plaza). No bloquea publicar, pero es lo
   primero que echarás de menos si el hilo funciona.

9. **Aprobación**: la spec queda en **`borrador`** y **no la firmo yo**. **ADR-023** nace
   también en `borrador` y se aprueba en este mismo gate.
