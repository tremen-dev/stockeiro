---
id: SPEC-023
tipo: spec
epica: EPIC-003
estado: hecho
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-12, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-12, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-12, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-12, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-08-12, por: sdd-verificador}
---
# SPEC-023 — Recuperación de contraseña por email

## Problema

**Hoy, un usuario que olvida su contraseña queda fuera de Stockeiro para siempre.**

El `password_hash` de `users` es la única credencial que existe (`src/db/schema.ts`): no
hay reset, no hay rol administrador y no hay canal por el que pedir ayuda. La única salida
es editar el hash a mano en la base de datos de producción — algo que exige tocar la
credencial de otra persona, que no escala y que ningún usuario puede siquiera solicitar.
La app está desplegada desde el 2026-07-14 y va a compartirse con **testers externos**: el
primer tester que se equivoque al teclear su contraseña se pierde en el primer minuto de su
relación con el producto.

Esta spec es la primera de EPIC-003 y cubre **CE-1** (nadie queda fuera para siempre),
**CE-2** (recuperar no revela quién existe) y **CE-3** (el enlace caduca y sirve una sola
vez), y **cierra R-4** (sesiones vivas tras el reset). El cambio de contraseña desde sesión
(**CE-4**) es la segunda spec de la épica y **no entra aquí** (ver *Fuera de alcance* y
*Notas para el gate*).

El problema no es "mandar un correo con un enlace". Es hacerlo **sin abrir tres agujeros**
que el proyecto ya se ha comprometido a no abrir:

1. **Sin convertir el formulario en un padrón de usuarios.** La decisión de **CA-4 de
   SPEC-001** (gate humano del 2026-07-13, *"la seguridad prima sobre la comodidad de UX"*)
   obliga a que la respuesta sea idéntica exista o no la cuenta — y no solo el texto:
   `verifyCredentials` ya paga un **hash señuelo** para igualar tiempos, precisamente porque
   una diferencia de milisegundos también es una respuesta. Es **CE-2** y el riesgo **R-2**.
2. **Sin dejar por ahí una llave equivalente a la contraseña.** El enlace viaja por correo y
   se queda en el buzón, en el historial y —si va en la URL— en cabeceras `Referer` y en
   logs (**R-3**). Caducidad, un solo uso y no almacenarlo en claro son requisitos; el
   mecanismo se decide en **ADR-015**.
3. **Sin mentirle al usuario sobre lo que acaba de conseguir.** La sesión es **JWT sin
   estado** (**ADR-001**): hoy no hay revocación. Quien recupera su contraseña porque
   sospecha que le han entrado **no echaría al intruso** (**R-4**). Se resuelve en
   **ADR-016**.

Y hay una asimetría con lo ya entregado que conviene tener presente: los avisos de zona
tienen red —si el correo falla, el aviso sobrevive in-app (**RN-15**)—. **Aquí no hay red
posible**: el email *es* el canal (**R-5**). Por eso el dominio verificado en Resend
(**F-SPEC-006-1**) es prerrequisito de despliegue y no un adorno.

Reglas en juego: **RN-01** (aislamiento), **RN-02** (email único, que esta spec **no
toca**: recuperar no cambia el email), **RN-03** (acceso autenticado, con dos rutas públicas
nuevas **declaradas**, no heredadas — **CE-5**), **RN-15** (que **no** aplica a este correo).

## Usuarios / roles afectados

- **Usuario final que ha perdido el acceso**: pide la recuperación desde la pantalla de
  login, recibe un enlace en su correo, establece una contraseña nueva y vuelve a entrar,
  **sin intervención de nadie** (CE-1).
- **Usuario final que sospecha que su cuenta está comprometida**: además de recuperar el
  acceso, **expulsa al intruso**: todas las sesiones anteriores dejan de valer (CE-3/R-4,
  ADR-016). Contrapartida honesta: también se cierran **sus propias** sesiones en otros
  dispositivos, y tendrá que volver a entrar en cada uno.
- **Cualquier usuario con sesión abierta el día del despliegue**: tendrá que iniciar sesión
  una vez más. Es consecuencia directa de ADR-016 pto. 6 y no se puede evitar sin dejar una
  puerta abierta.
- **Curioso/atacante que quiere saber quién tiene cuenta**: no obtiene nada nuevo. El
  formulario de recuperación responde lo mismo, y en el mismo tiempo, para un email
  registrado y para uno inventado (CE-2).
- **Operador**: no gana ni pierde tarea; sigue sin ver datos de ningún usuario. Lo que gana
  es dejar de ser el único mecanismo de recuperación que existe — que es el objetivo.

## Criterios de aceptación

Cada CA es verificable con un test. La disciplina de tests del proyecto se mantiene: unidad
e integración con **Vitest sobre PGlite**, e2e con **Playwright** sobre Postgres efímero, y
el correo **siempre** a través de `FakeNotificationSender` (**ADR-006**) — **nunca** se
llama a la API real de Resend, ni siquiera para "comprobar que llega".

- **CA-1 (La respuesta es idéntica exista o no la cuenta — CE-2, RN-02 intacta).**
  Dado el formulario público de recuperación,
  cuando se envía el email de una cuenta **registrada** y cuando se envía uno **que no
  existe**,
  entonces en ambos casos el usuario ve **exactamente el mismo mensaje genérico** y el mismo
  desenlace (mismo destino, sin error, sin distinción alguna en la respuesta); en el segundo
  caso **no se envía ningún correo** (`FakeNotificationSender` no registra ningún mensaje) y
  no se crea ningún token.

- **CA-2 (La respuesta tampoco se distingue por el tiempo — CE-2, R-2).**
  Dado un `NotificationSender` fake con una latencia artificial apreciable (p. ej. 300 ms),
  cuando se procesa la solicitud para un email registrado y para uno inexistente,
  entonces **el envío no está en el camino de la respuesta**: al retornar la operación el
  sender **todavía no ha sido invocado** (el envío queda diferido y se ejecuta después), y
  el tiempo transcurrido en ambas ramas queda **por debajo** de la latencia inyectada, de
  modo que un observador no puede inferir si se envió correo. Es el mismo compromiso que ya
  asume `verifyCredentials` con su hash señuelo.

- **CA-3 (El correo lleva el enlace, sale por el puerto, y NO se registra in-app).**
  Dado un usuario registrado que solicita la recuperación,
  cuando se procesa,
  entonces se entrega **exactamente un** mensaje al puerto `NotificationSender` dirigido al
  email **almacenado** de la cuenta, cuyo cuerpo contiene una URL absoluta a la página de
  contraseña nueva con el token en claro; y **no se crea ninguna fila en `notifications`**
  — este correo no es un aviso de zona, y RN-15 **no** le aplica: registrarlo in-app lo
  haría legible desde una sesión ya abierta, incluida la del intruso al que se pretende
  expulsar (ADR-015 pto. 10).

- **CA-4 (El origen del enlace sale de configuración, no de la petición).**
  Dada una solicitud de recuperación cuya cabecera `Host` / `X-Forwarded-Host` ha sido
  falsificada apuntando a otro dominio,
  cuando se compone el enlace,
  entonces su origen es el de la **configuración de despliegue** (`APP_BASE_URL`) y **no** el
  de la cabecera. Sin esto, un atacante puede pedir el reset de una cuenta ajena y hacer que
  **nuestro** correo, legítimo y firmado, lleve a la víctima a su servidor (ADR-015 pto. 8);
  `AUTH_TRUST_HOST=true` hace esta comprobación imprescindible.

- **CA-5 (El token no queda almacenado en claro — R-3).**
  Dado un token recién emitido y el correo que lo transporta,
  cuando se inspecciona la fila persistida,
  entonces **el token en claro no aparece en ninguna columna** (ni igual, ni contenido en
  ella): lo guardado es un digest irreversible (ADR-015 pto. 2), y localizar la fila exige
  volver a hashear el token recibido. Con solo la base de datos **no se puede reconstruir
  ningún enlace**.

- **CA-6 (Con un enlace válido se establece la contraseña nueva — CE-1).**
  Dado un token vivo, no caducado y no consumido,
  cuando el usuario envía una contraseña nueva en la página de contraseña nueva,
  entonces su `password_hash` se sustituye por el de la nueva (bcrypt, reutilizando
  `hashPassword`, COST 10), **puede iniciar sesión con la nueva** y **ya no puede con la
  anterior**; el token queda consumido y **cualquier otro token vivo de ese usuario queda
  inutilizable**. Su email (**RN-02**) y sus datos (**RN-01**) no cambian.

- **CA-7 (Un solo uso, incluso con envíos simultáneos — CE-3).**
  Dado un token ya consumido,
  cuando se vuelve a usar,
  entonces la contraseña **no** cambia y se muestra el mensaje genérico de enlace no válido.
  Y dado el mismo token enviado **dos veces a la vez**, exactamente **uno** de los dos
  envíos cambia la contraseña: el consumo es una sentencia condicional atómica, no un
  "lee-comprueba-escribe" (ADR-015 pto. 5).

- **CA-8 (Caducidad — CE-3).**
  Dado un token cuya ventana de validez (30 minutos, ADR-015 pto. 4) ya ha pasado,
  cuando se intenta usar,
  entonces **no concede nada**: la contraseña no cambia y se muestra el mismo mensaje
  genérico de enlace no válido.

- **CA-9 (Enlace inexistente o manipulado: misma respuesta).**
  Dado un token que nunca existió, o uno válido con un carácter alterado,
  cuando se envía,
  entonces la respuesta es **indistinguible** de la de CA-7 y CA-8 (mismo mensaje, mismo
  desenlace) y la contraseña no cambia. "Usado", "caducado" e "inexistente" se cuentan
  igual.

- **CA-10 (Abrir el enlace no lo gasta — R-3).**
  Dado un token vivo,
  cuando la página de contraseña nueva se **abre** (GET, como haría el antivirus de correo
  del destinatario o un generador de vista previa),
  entonces el token **sigue siendo usable** y el usuario puede establecer su contraseña a
  continuación. El consumo ocurre **solo** al enviar el formulario (ADR-015 pto. 6).

- **CA-11 (Pedir un enlace nuevo invalida el anterior — CE-3).**
  Dado un usuario con un token vivo,
  cuando solicita la recuperación otra vez y recibe un enlace nuevo,
  entonces el enlace **anterior deja de funcionar** y solo el último es usable. En cualquier
  instante hay como mucho una llave en circulación.

- **CA-12 (Límite de solicitudes por cuenta y ventana, invisible en la respuesta).**
  Dado un usuario que ya ha solicitado la recuperación 3 veces dentro de la última hora,
  cuando solicita una cuarta,
  entonces **no se crea token ni se envía correo**, y **la respuesta es exactamente la misma
  respuesta genérica de CA-1** — sin mensaje de "demasiadas solicitudes" ni ningún otro
  cambio observable, porque un límite visible convertiría el formulario en el oráculo de
  enumeración que CE-2 prohíbe. Pasada la ventana, vuelve a funcionar. El formulario no
  puede usarse como cañón de correo contra un tercero.

- **CA-13 (Las sesiones anteriores dejan de valer — R-4, ADR-016).**
  Dado un usuario con una sesión activa abierta en otro navegador,
  cuando su contraseña se restablece con un enlace válido,
  entonces esa sesión previa **ya no autentica**: cualquier ruta protegida la manda a login y
  **no le sirve ningún dato** (RN-01, RN-03). Verificable en tres niveles: la función pura de
  comparación de época de credencial (unidad), la frontera de sesión de Node (integración) y
  dos contextos de navegador en Playwright (e2e).

- **CA-14 (Tras el reset no hay sesión automática; la sesión nueva sí vale).**
  Dado un reset completado con éxito,
  cuando termina el flujo,
  entonces el usuario **no queda autenticado por el mero hecho de haber usado el enlace**:
  aterriza en `/login` con la confirmación, y al iniciar sesión con la contraseña nueva
  obtiene una sesión que **sí** es válida (su época de credencial coincide con la del
  usuario) y accede a sus datos con normalidad.

- **CA-15 (Las rutas públicas nuevas se declaran y se acotan — CE-5, RN-03).**
  Dado el guard de acceso (`isPublicPath`, `PUBLIC_PREFIXES`),
  cuando se evalúan las rutas,
  entonces **`/forgot-password` y `/reset-password/<token>` son públicas sin sesión**, y
  **siguen exigiendo sesión** `/dashboard`, `/cartera`, `/vigiladas`, `/avisos` y el resto de
  rutas de datos; una ruta que solo *se parezca* a las nuevas (p. ej. `/reset-passwordX`) **no**
  es pública. La excepción a RN-03 se prueba, no se hereda.

- **CA-16 (No degrada lo entregado ni inventa política de contraseña — CE-5).**
  Dada la suite existente,
  cuando se ejecuta,
  entonces siguen verdes **CA-1..CA-8 de SPEC-001** (registro, email único, login, error
  genérico, rutas protegidas, aislamiento, cierre de sesión, persistencia) y el resto de la
  suite; y **una contraseña que el registro acepta hoy, el reset la acepta también**: se
  reutiliza la validación de `validation.ts` sin añadir **ninguna** regla de complejidad
  (resolución del gate de SPEC-001: la política sigue **delegada en Auth.js**). El único
  cambio de expectativa admisible en tests existentes es el derivado de ADR-016 pto. 6 (un
  JWT sin época de credencial deja de autenticar).

## Entidades y reglas afectadas

**Entidades nuevas / modificadas** (esquema Drizzle, `src/db/schema.ts`):

- **`password_reset_tokens`** (tabla nueva, ADR-015 pto. 3): `id`, `userId` → `users.id`,
  `tokenHash` (**único**: es la clave de búsqueda), `expiresAt`, `consumedAt` (`null` =
  vivo), `createdAt`. No lleva el token en claro (CA-5) y no lleva datos de dominio. La
  ventana (30 min) y el límite (3/hora) se leen de constantes nombradas, no de literales
  dispersos.
- **`users`** gana **`passwordChangedAt`** (timestamptz, `NOT NULL`, default `now()`):
  la **época de credencial** de ADR-016. Es lo único que esta spec cambia de `users`; el
  `email` (**RN-02**) no se toca.

**Piezas existentes que se reutilizan, no se duplican:**

- **`NotificationSender` / `FakeNotificationSender`** (`src/lib/notifications/`, ADR-006):
  el correo de recuperación sale por el mismo puerto que los avisos. **No** pasa por
  `notifyCycle` ni escribe en `notifications` (CA-3).
- **`hashPassword`** (`src/lib/auth/passwords.ts`, bcryptjs COST 10) para la contraseña
  nueva; **`credentialsSchema`** (`src/lib/auth/validation.ts`) para la forma del email y de
  la contraseña, **sin añadir reglas** (CA-16).
- **`isPublicPath` / `PUBLIC_PREFIXES`** (`src/lib/auth/guard.ts`): único sitio donde se
  declaran las rutas públicas; ahí entran las dos nuevas (CA-15). `src/proxy.ts` y su
  matcher **no cambian**.
- **Split-config de Auth.js** (`base-config.ts` edge-safe / `config.ts` Node, ADR-001): la
  época se estampa en la callback `jwt` al hacer login y se revalida **solo en Node**
  (ADR-016 pto. 3-4). `base-config.ts` sigue **sin** DB y sin bcrypt.
- **Server actions del grupo `(auth)`** (`src/app/(auth)/actions.ts`) y el patrón de sus
  formularios: las dos acciones nuevas viven ahí, junto a `registerAction`/`loginAction`.

**Rutas nuevas** (públicas por diseño, CA-15): `/forgot-password` (solicitud) y
`/reset-password/<token>` (contraseña nueva). La segunda declara `Referrer-Policy:
no-referrer` (ADR-015 pto. 9) y no carga recursos de terceros.

**Configuración nueva**: `APP_BASE_URL` (origen absoluto de los enlaces, CA-4). Se añade a
`.env.example` con su explicación, como el resto.

**Reglas y decisiones**: **RN-01**, **RN-02** (intacta), **RN-03** (con la excepción
declarada de CA-15), **RN-15** (**no aplica** a este correo, CA-3); **ADR-015** (token) y
**ADR-016** (invalidación de sesiones), ambos originados por esta spec y en `borrador`;
**ADR-001** (JWT y split-config, que ADR-016 **extiende sin superseder**), **ADR-006**
(puerto de envío). Dominio: se añaden a `docs/fundacion/dominio.md` los términos *Enlace de
recuperación*, *Token de recuperación* y *Época de credencial*.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Cambio de contraseña desde sesión (CE-4)**: es la **segunda spec** de EPIC-003 y se hace
  después. Reutilizará el motor de "establecer contraseña nueva" y la invalidación de
  sesiones de ADR-016 que esta spec deja construidos. Razonamiento del corte en *Notas para
  el gate*, punto 1.
- **Verificación de email en el registro**: sigue aparcada desde SPEC-001, y su ausencia
  tiene consecuencia declarada (**R-1** de la épica): quien se registra con un email
  equivocado o ajeno **no podrá recuperar la cuenta**, y su enlace irá al buzón de un
  tercero. Esta spec acota el daño (caducidad corta, un solo uso, un enlace vivo) pero **no
  lo elimina**; la pieza siguiente es esa, y no entra aquí.
- **Política de contraseña propia** (longitud, complejidad, "distinta de la anterior",
  historial): sigue **delegada en Auth.js** por resolución del gate de SPEC-001. Esta spec
  **no reabre** esa decisión ni de refilón: reutiliza la validación existente. Reabrirla
  sería un cambio explícito con su propio ADR y su propio gate.
- **2FA, login social/OAuth, roles y permisos** (incluido un administrador que recupere
  cuentas ajenas): fuera, como en SPEC-001. El autoservicio de CE-1 existe justamente para
  no necesitar ese rol.
- **Perfil editable, preferencias y borrado de cuenta (GDPR)**: cambiar la contraseña **no**
  es abrir la gestión de perfil. Siguen sin épica.
- **Anti-abuso avanzado**: captcha, WAF, límites por IP o por dominio, reputación. Dentro
  solo el límite por cuenta y ventana de CA-12. Nótese que ese límite **no** protege contra
  un atacante que rote emails distintos; protege al **titular de una cuenta** de recibir
  cien correos. Lo demás es infraestructura (Vercel Firewall), no producto.
- **Recuperación por otros canales** (SMS, preguntas de seguridad, códigos de respaldo): el
  email es el único canal de v1.
- **Notificar al usuario que su contraseña ha cambiado** (correo de aviso posterior al
  reset, con "si no has sido tú..."). Es buena práctica y es barato, pero requiere decidir
  qué hacer cuando el usuario dice que no fue él —y hoy no hay a quién avisar—. Se registra
  como **F-SPEC-023-4**.
- **Purga de tokens caducados**: se registra como **F-SPEC-023-2**; nada la hace urgente al
  volumen actual.
- **Revocación selectiva de sesiones** ("ver mis dispositivos y cerrar uno"): exigiría
  sesiones en base de datos y superseder ADR-001. Descartado en ADR-016; queda como
  evolución si algún día se pide.
- **Arreglar que Preview comparta la base de producción**: es **F-SPEC-023-1**, condiciona
  cómo se despliega esta spec y **no lo resuelve esta spec**.

## Salvedades y follow-ups

- **F-SPEC-023-1 (DESPLIEGUE, bloqueante del *merge*, no de la implementación).**
  `DATABASE_URL` tiene **un único valor para *Production* y *Preview***, y `vercel.json`
  hace `buildCommand = db:migrate && build` en **todos** los entornos: **abrir una PR con
  esta spec migraría la base de producción**. Esta spec añade una tabla y una columna, así
  que es exactamente el caso. Atenuante honesto —no solución—: **las dos migraciones son
  aditivas** (`CREATE TABLE`, `ADD COLUMN ... NOT NULL DEFAULT now()`) y el código de
  producción vigente sigue funcionando con ellas. El arreglo real (base Neon aparte para
  Preview) está en el runbook §6 y en el roadmap; **decidir cuándo se abre la PR es del
  humano**.
- **F-SPEC-023-2 (higiene).** Nada purga los tokens caducados o consumidos. Sitio natural:
  el cron diario que ya existe (`/api/cron/refresh`). Irrelevante al volumen actual, pero es
  material sensible con fecha de caducidad.
- **F-SPEC-023-3 (DESPLIEGUE).** Variable nueva `APP_BASE_URL` en Vercel. Si falta o apunta
  mal, **los enlaces no funcionan en absoluto**. Va en el mismo viaje que **F-SPEC-006-1**
  (Resend con dominio verificado, hoy 🔴 **bloqueante**: sin él no hay recuperación posible
  porque el correo no tiene fallback, **R-5**).
- **F-SPEC-023-4 (producto, futuro).** Correo de aviso "tu contraseña ha cambiado". Práctica
  estándar, pendiente de decidir qué ofrece a quien responda que no fue él.
- **F-SPEC-023-5 (residual asumido de CE-2).** La igualación de tiempos de CA-2 saca el
  envío del camino de la respuesta, pero deja un residuo: la rama del email registrado hace
  un `INSERT` que la otra no. Es sub-milisegundo y queda muy por debajo del ruido de red;
  eliminarlo del todo exigiría un escritura señuelo que ensuciaría la tabla. Se asume, igual
  que `verifyCredentials` asume el residuo entre un `SELECT` que acierta y uno que falla.

## Notas para el gate humano

1. **El corte en dos specs: estoy de acuerdo, y este es el motivo.** El cambio desde sesión
   (CE-4) comparte el motor ("establecer contraseña nueva" + invalidar sesiones) pero **no
   comparte el riesgo**: esta spec abre **superficie pública no autenticada** —dos rutas sin
   sesión, un secreto que viaja por correo, un formulario que puede enumerar usuarios y
   mandar correo a terceros— y ahí están 12 de los 16 CA. El cambio desde sesión ocurre
   **detrás** del guard, con el usuario ya identificado y demostrando que conoce su
   contraseña actual. Juntarlas mezclaría dos superficies de ataque en un solo gate y en un
   solo ledger. Además, la segunda es pequeña **porque** esta deja el motor hecho.
   **Sugerencia de secuencia**: implantar esta, desplegarla y **luego** la segunda.

2. **R-4: he decidido SÍ invalidar las sesiones previas (ADR-016), y tiene precio.** La
   épica permitía declarar que no se invalidan; no lo he hecho porque el usuario que
   recupera su contraseña *porque sospecha que le han entrado* creería haber echado al
   intruso sin haberlo echado, y una función de seguridad que no hace lo que su nombre
   promete es peor que su ausencia. Lo que cuesta, dicho sin adornos:
   - **una lectura a la base de datos por petición autenticada** en Node (clave primaria,
     tabla diminuta, en páginas que ya consultan datos);
   - **la sesión deja de ser estrictamente sin estado**: su validez pasa a depender de la
     base de datos;
   - **el día del despliegue, todo el mundo tiene que volver a iniciar sesión una vez**
     (ADR-016 pto. 6) — conviene que no coincida con el día en que invitas a los testers;
   - **la revocación se aplica en la frontera Node, no en el middleware Edge**: una cookie
     revocada puede atravesar el middleware, pero **no obtiene ni un dato** y acaba en login.
     Esto es lo que permite no romper el split-config de ADR-001.
   Si prefieres el camino barato (no invalidar), es una decisión legítima **pero entonces la
   pantalla de reset debe decirle al usuario por escrito que las sesiones abiertas siguen
   abiertas** — y eso cambia el producto, no solo el código.

3. **R-3: el mecanismo del token está en ADR-015; lo que hay que mirar son tres números y
   una elección.** Los números: **30 minutos** de validez, **3 solicitudes/hora** por cuenta,
   **1 enlace vivo** por usuario. Son juicios, no cálculos, y son fáciles de mover. La
   elección discutible es **superseder el enlace anterior** (CA-11): es lo más seguro y lo
   que hace la mayoría, pero produce un caso de UX molesto —el usuario que pincha dos veces
   "he olvidado mi contraseña" y luego abre el **primer** correo se encuentra un enlace
   muerto—. Si te importa más esa fricción que tener una sola llave viva, dilo y se cambia
   por "todos los vivos valen hasta caducar".

4. **Mensaje único para "usado", "caducado" e "inexistente" (CA-9): decisión discutible.**
   Distinguir *"este enlace ha caducado, pide otro"* sería claramente más amable y filtra muy
   poco (quien ve ese mensaje ya tiene el token en la mano). He elegido el mensaje único por
   coherencia con CE-2 y para no tener que razonar caso por caso qué fuga es tolerable. Es
   el punto donde estoy más dispuesto a ceder si lo prefieres.

5. **CA-12 y el límite invisible.** Que el límite **no** se le diga al usuario es
   contraintuitivo y merece tu visto bueno explícito: alguien que pide cuatro correos
   seguidos no verá ningún aviso y creerá que el cuarto se envió. Es el precio de CE-2 —un
   mensaje de "demasiadas solicitudes" solo puede aparecer para emails **que existen**, y
   eso es exactamente el oráculo que la épica prohíbe—.

6. **No hay auto-login tras el reset (CA-14).** El usuario acaba en `/login` y entra con su
   contraseña nueva. No aporta seguridad (acaba de elegir esa contraseña), pero evita que
   una ruta **pública** sea capaz de emitir sesiones, y es lo que la gente espera. Si
   prefieres el auto-login por comodidad, es un cambio pequeño y solo afecta a CA-14.

7. **Dos prerrequisitos de despliegue, uno de ellos ya asumido por ti.** Sin **Resend con
   dominio verificado** (F-SPEC-006-1, 🔴) **no hay recuperación posible**: aquí el correo no
   tiene fallback (R-5). Y hace falta **`APP_BASE_URL`** (F-SPEC-023-3). Los 16 CA se
   verifican con `FakeNotificationSender` **sin** el proveedor real, así que la
   implementación y la verificación **no** están bloqueadas — lo que está bloqueado es que
   la función sirva de algo en producción.

8. **F-SPEC-023-1 es lo que puede morderte sin avisar.** Abrir la PR de esta spec **migra la
   base de datos de producción** (Preview y Production comparten `DATABASE_URL` y el build
   migra siempre). Las migraciones son aditivas y compatibles hacia atrás, así que el riesgo
   es bajo — pero es **tu** decisión cuándo se abre, no la mía ni la del implementador.

9. **Aprobación**: la spec queda en **`borrador`** y **no la firmo yo**. Los dos ADR nacen
   también en `borrador` y se aprueban en este mismo gate; si prefieres aprobar solo uno
   (p. ej. ADR-015 sí, ADR-016 no, quedándote con "no se invalidan las sesiones"), dilo aquí:
   afecta a CA-13, a CA-14 y al punto 2.
