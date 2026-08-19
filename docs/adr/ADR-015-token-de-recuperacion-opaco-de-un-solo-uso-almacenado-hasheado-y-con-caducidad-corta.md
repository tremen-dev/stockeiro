---
id: ADR-015
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-12, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-12, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-015: Token de recuperación opaco de un solo uso, almacenado hasheado y con caducidad corta

- Deciders: propone sdd-arquitecto (2026-08-12); pendiente de aprobación del humano en el
  gate de SPEC-023. Cierra el riesgo **R-3** de EPIC-003 (*"el token es filtrable por
  naturaleza"*), que la épica delega explícitamente en decisión técnica de arquitectura.
- Specs relacionadas: la origina **SPEC-023** (Recuperación de contraseña por email). La
  consumirá cualquier spec futura que necesite un secreto de un solo uso entregado por
  correo (verificación de email, invitaciones): el mecanismo es reutilizable, la tabla no.

## Contexto

EPIC-003 exige (CE-3) que el enlace de recuperación **caduque** y **no se pueda
reutilizar**, y su riesgo **R-3** enumera por qué esto no es opcional: el token viaja por
correo y **se queda** en el buzón del usuario, en el historial del navegador, en las
cabeceras `Referer` si viaja en la URL, y en los logs de cualquier intermediario. Un
enlace de recuperación es, mientras vive, **equivalente a la contraseña**: quien lo tiene
puede tomar la cuenta.

Además hay una restricción que empuja en la dirección contraria a la seguridad: el correo
no llega instantáneamente (Resend + colocación en bandeja, ADR-006), así que la ventana no
puede ser de un minuto.

Y una restricción de plataforma: **no hay estado en memoria fiable**. La app corre en
funciones serverless en Vercel (ADR-001), sin proceso de larga vida ni Redis. Todo estado
compartido vive en Postgres.

Puntos abiertos que esta decisión tiene que resolver, y que la spec no puede dejar al
criterio de quien implemente porque son la diferencia entre un reset seguro y uno
decorativo: **qué es el token**, **dónde y cómo se guarda**, **cuánto vive**, **cómo se
consume exactamente una vez** y **de dónde sale la URL del enlace**.

## Decisión

1. **El token es un secreto opaco de alta entropía, no un dato con significado.**
   32 bytes de un CSPRNG (`crypto.randomBytes(32)`, Node) codificados en `base64url`. No
   contiene ni el `userId`, ni el email, ni la caducidad: es una **referencia sin
   significado** a una fila. Consecuencia buscada: mirar el token no dice de quién es, y no
   se puede fabricar uno válido sin acertar 256 bits.

2. **En base de datos se guarda solo un digest irreversible: `SHA-256` del token, en hex.**
   La tabla nunca contiene el secreto en claro (requisito literal de R-3): una copia de
   seguridad filtrada, un `SELECT` en la consola de Neon o un log de consulta **no
   permiten reconstruir ningún enlace**.
   **Por qué SHA-256 y no bcrypt**, que es lo que usamos para contraseñas (`passwords.ts`,
   COST 10): son dos problemas distintos.
   - Bcrypt existe para hacer **lenta** la fuerza bruta sobre secretos de baja entropía
     (una contraseña humana). Un token de 256 bits no es forzable por fuerza bruta a
     ninguna velocidad, así que el coste de un KDF lento no compra nada aquí.
   - Bcrypt lleva **sal por fila**, luego no permite buscar por el hash: habría que leer
     todas las filas vivas y comparar una a una, lo que degrada con el uso y abre un canal
     de temporización propio. Con SHA-256 la búsqueda es un **índice único**, coste
     constante y sin recorrido.
   El requisito real que hay que cumplir es *"no almacenado en claro"*, no *"lento de
   verificar"*.

3. **Almacenamiento: tabla propia `password_reset_tokens`, no columnas en `users`.**
   Campos: `id`, `userId` → `users.id`, `tokenHash` (**único**, es la clave de búsqueda),
   `expiresAt`, `consumedAt` (`null` = vivo), `createdAt`.
   Tabla propia porque un token es un **evento con ciclo de vida**, no un atributo de la
   identidad: se crean varios, caducan, se consumen y se auditan; meterlos en `users`
   obligaría a sobrescribir el anterior y perdería el historial que hace posible el límite
   de solicitudes. Es el mismo criterio con el que `quote_diagnostics` no es una columna de
   `quotes` (SPEC-016).

4. **Ventana de validez: 30 minutos** desde la creación.
   Es el punto medio defendible entre las dos presiones: por debajo de ~15 min el correo
   real (entrega + el usuario que lo lee cuando puede) empieza a hacer inservible el
   enlace, y con él la promesa CE-1; por encima de ~1 h la ventana de exposición de R-3 se
   alarga sin ganar nada. El valor vive en **una constante única y nombrada**, no
   esparcido: cambiarlo es cambiar un número, no una regla.

5. **Consumo exactamente una vez, garantizado por la base de datos, no por el código.**
   El consumo es **una sola sentencia condicional atómica**:
   `UPDATE password_reset_tokens SET consumed_at = now() WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now() RETURNING user_id`.
   Si devuelve 0 filas, el enlace no vale — y da igual si era falso, caducado o ya gastado.
   Está escrito así, y no como *"lee, comprueba, escribe"*, porque el patrón leer-comprobar-
   escribir tiene una carrera real: dos envíos simultáneos del mismo enlace pasarían ambos
   la comprobación. Aquí el ganador lo decide Postgres.

6. **El token se consume al ESTABLECER la contraseña (envío del formulario), nunca al
   abrir el enlace (GET).**
   Abrir la página solo comprueba que el token *parece* vivo para decidir si enseña el
   formulario o el mensaje genérico. Motivo concreto y frecuente: los antivirus de correo y
   los generadores de vista previa **visitan los enlaces** antes que el destinatario; si el
   GET consumiera, el escáner del propio proveedor de correo del usuario dejaría el enlace
   inservible antes de que lo viera nadie, y el usuario quedaría fuera con un mecanismo que
   funciona.

7. **Un enlace vivo por usuario: pedir uno nuevo invalida el anterior**, y un reset con
   éxito invalida **todos** los tokens vivos de ese usuario. Reduce a uno el número de
   llaves en circulación en cualquier instante.

8. **El origen del enlace sale de configuración (`APP_BASE_URL`), NUNCA de la petición.**
   Construir la URL a partir de la cabecera `Host` / `X-Forwarded-Host` de la solicitud de
   recuperación permitiría a un atacante pedir el reset **de la cuenta de otra persona** con
   una cabecera falsificada y recibir un correo legítimo, enviado por nosotros a la víctima,
   cuyo enlace apunta a un servidor del atacante — que se queda con el token cuando la
   víctima pincha. El correo lo firmamos nosotros, así que la víctima no tiene por qué
   sospechar. Se cierra por construcción: el origen es una constante de despliegue.
   `AUTH_TRUST_HOST=true` (necesario tras el proxy de Vercel) hace esta precaución
   **imprescindible**, no redundante.

9. **El token viaja en el path (`/reset-password/<token>`) y esa ruta declara
   `Referrer-Policy: no-referrer`.** La fuga por `Referer` no se evita eligiendo path o
   query —las dos filtran igual—, se evita **no enviando la cabecera**. La página de reset
   no carga recursos de terceros, así que la política no cuesta nada.

   > **Corrección de la última frase de este punto (2026-08-19, hallazgo F-SPEC-035-8).**
   > Donde el pto. 9 afirma *«La página de reset no carga recursos de terceros»*, **la
   > afirmación era falsa el día que se escribió** (2026-08-12) y siguió siéndolo hasta
   > **SPEC-035** (2026-08-19). El sistema de diseño cargaba la familia Geist con un
   > `@import url(https://fonts.googleapis.com/css2?family=Geist…)` en
   > `design/tremen-ds/colors_and_type.css`, y la cadena `layout.tsx → globals.css →
   > components/index.css → colors_and_type.css` es **incondicional**: alcanzaba a
   > `/reset-password` exactamente igual que a todas las demás páginas de la app.
   >
   > **Quién lo destapó y cómo.** El **verificador de SPEC-035**, y no leyendo el CSS:
   > extrajo ese fichero de `origin/main`, lo sirvió y lo cargó en un navegador, y observó
   > las peticiones salientes a `https://fonts.googleapis.com/css2?family=Geist…` y a
   > `https://fonts.gstatic.com/s/geist/…`. Nadie lo había comprobado antes porque el punto
   > 9 sonaba a premisa obvia, que es como sobreviven las premisas falsas.
   >
   > **Qué lo arregló y desde cuándo es cierto.** **SPEC-035**: las familias las resuelve
   > `next/font` en tiempo de build y se sirven **autoalojadas** desde `/_next/static`, sin
   > dependencias nuevas. El mismo verificador cargó después un `/reset-password/<token>`
   > real interceptando la red y contó **cero peticiones externas**. Desde el 2026-08-19 el
   > punto 9 se lee ya como se escribió.
   >
   > **La decisión no cambia y no se reescribe.** El token sigue viajando en el path y la
   > ruta sigue declarando `Referrer-Policy: no-referrer`; eso era correcto entonces y lo
   > sigue siendo ahora — la fuga se evita **no enviando la cabecera**, y esa parte del
   > razonamiento nunca dependió de la premisa falsa. Lo que falló fue el *«no cuesta
   > nada»*: durante esa semana la política no era gratis por ausencia de terceros, sino
   > **a pesar** de que había terceros en juego. Es la clase de premisa que un día justifica
   > **quitar** la cabecera («total, si no hay nada de fuera»), y por eso la corrección
   > importa aunque el resultado no cambiara.
   >
   > **Queda pendiente**: la misma frase se repite, palabra por palabra, en el comentario de
   > `next.config.mjs` que declara esta cabecera. Ahí **sigue sin corregir**: es ruta
   > vigilada y su enmienda entra por una spec viva, no por este ADR (**ADR-025** pto. 3).

10. **El enlace de recuperación NO se registra en la bandeja in-app (`notifications`).**
    Esa tabla es el registro de avisos de zona y el fallback de RN-15. Escribir aquí el
    enlace lo haría legible desde cualquier sesión ya abierta — es decir, **desde la sesión
    del atacante al que el usuario está intentando expulsar**. El correo de recuperación usa
    el puerto `NotificationSender` (ADR-006) y **solo** el puerto.

## Consecuencias

### Positivas
- Cumple CE-3 de forma verificable: caducidad, un solo uso y no almacenamiento en claro son
  tres aserciones sobre datos observables, cada una con su test.
- La atomicidad del punto 5 hace que el un-solo-uso sea una propiedad del esquema, no una
  disciplina del código: sobrevive a un refactor descuidado.
- Reutiliza el puerto `NotificationSender` (ADR-006): todo el flujo se ejercita con
  `FakeNotificationSender`, sin llamar a Resend ni consumir cuota (misma disciplina que
  ADR-002/ADR-012 con los proveedores de mercado).
- El mecanismo (secreto opaco + digest + consumo atómico) es reutilizable tal cual para
  verificación de email o invitaciones, que son las piezas que la épica nombra como
  siguientes.

### Negativas / follow-ups
- **Una tabla más y una migración más.** Es aditiva (`CREATE TABLE`), pero cae de lleno en
  el riesgo R-6 de la épica: *Preview comparte la base de datos de producción y el build
  migra en todos los entornos*. Registrado como **F-SPEC-023-1**.
- **Las filas se acumulan**: nada las borra. A este volumen es irrelevante durante años,
  pero es basura con fecha de caducidad y conviene purgarla desde el cron que ya corre a
  diario. Registrado como **F-SPEC-023-2**.
- **30 minutos es un juicio, no un cálculo.** Si la entrega de Resend resulta peor de lo
  previsto, el síntoma será *"el enlace ya no vale cuando llego"* y habrá que subirlo.
- **`APP_BASE_URL` es una variable de entorno nueva** que hay que aprovisionar en Vercel
  junto con Resend, y **si apunta mal, los enlaces no funcionan en absoluto**. Va con
  **F-SPEC-023-3**.
- Un digest SHA-256 sin sal es vulnerable a tablas precalculadas **para entradas de baja
  entropía**; aquí no aplica (256 bits aleatorios), pero la premisa queda escrita: si algún
  día alguien acorta el token, este ADR deja de ser válido y hay que escribir otro.

## Alternativas consideradas

- **Token firmado sin estado (JWT/HMAC con `exp`), sin tabla.** Tentador: cero esquema,
  cero migración, encaja con la sesión JWT de ADR-001. **Rechazado porque no puede ser de un
  solo uso**: un token sin estado es válido cuantas veces se presente hasta que expira, y
  el un-solo-uso es literalmente CE-3. Para gastarlo haría falta guardar en algún sitio que
  ya se gastó — es decir, la misma tabla, y encima con un token más largo y con datos del
  usuario dentro.
- **Guardar el token en claro** y compararlo directo. Rechazado: R-3 lo prohíbe por escrito,
  y convierte cualquier lectura de la base (backup, consola, log de consultas) en una toma
  de cuentas silenciosa. No ahorra nada: hashear cuesta microsegundos.
- **Bcrypt como digest del token.** Rechazado por el punto 2: coste sin beneficio (el token
  no es forzable) y, sobre todo, imposibilita la búsqueda por índice. La variante
  *selector + verificador* (un id público para buscar y un secreto bcrypt para comparar)
  resuelve la búsqueda pero añade una pieza y un formato de token compuesto a cambio de un
  endurecimiento que la entropía ya nos da gratis.
- **Código numérico corto (OTP) en vez de enlace**, tecleado en la app. Es mejor contra la
  fuga por `Referer` e historial, pero su baja entropía obliga a un límite de intentos por
  token y a bloqueos — más máquina, no menos —, y empeora la UX en el caso mayoritario
  (pinchar un enlace desde el móvil). Rechazado para v1; queda disponible si algún día se
  quiere reforzar.
- **Almacén en memoria o KV externo** (Redis/Upstash) con TTL nativo. Rechazado: añade un
  proveedor y una factura para guardar unas pocas filas efímeras, cuando Postgres —que ya
  está, ya se migra y ya sabe hacer el `UPDATE` atómico— resuelve el problema entero.
  En memoria, además, es sencillamente incorrecto en serverless.
- **Ventana de 24 h** (cómoda, común en productos de consumo). Rechazada: multiplica por 48
  el tiempo que un token vive en un buzón ajeno tras un error de tecleo en el registro
  (R-1), que es el escenario que la épica declara sin verificación de email.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
