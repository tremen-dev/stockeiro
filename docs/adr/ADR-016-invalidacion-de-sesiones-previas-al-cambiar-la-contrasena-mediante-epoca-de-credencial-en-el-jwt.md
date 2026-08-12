---
id: ADR-016
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-12, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-12, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-016: Invalidación de sesiones previas al cambiar la contraseña mediante época de credencial en el JWT

- Deciders: propone sdd-arquitecto (2026-08-12); pendiente de aprobación del humano en el
  gate de SPEC-023. Cierra el riesgo **R-4** de EPIC-003 (*"sesiones vivas después del
  reset"*), que la épica exige cerrar en spec de forma explícita.
- Specs relacionadas: la origina **SPEC-023** (Recuperación de contraseña por email); la
  reutiliza tal cual la spec de **cambio de contraseña desde sesión** (CE-4 de EPIC-003).
  **Extiende ADR-001** (sesión JWT) sin superseder nada de él.

## Contexto

La sesión es un **JWT sin estado** (ADR-001, `base-config.ts`: `session: { strategy: 'jwt' }`).
El servidor no guarda sesiones: valida la firma de la cookie y se fía. Eso significa que
**hoy no existe forma de revocar una sesión emitida**; `signOut` borra la cookie del
navegador que la pide, y nada más. Un JWT copiado sigue valiendo hasta que expire.

Ese diseño es correcto para lo que se decidió: barato, sin lecturas por petición y
compatible con el middleware, que corre en **Edge Runtime** y por eso usa una config
partida y edge-safe (sin DB, sin bcrypt).

Pero choca de frente con la recuperación de contraseña. El motivo por el que una persona
recupera su contraseña no suele ser solo el olvido: es **sospechar que alguien ha entrado**.
Si el reset cambia el `password_hash` y no toca las sesiones, el atacante que ya tiene una
cookie válida **conserva el acceso** — y la víctima cree que acaba de echarlo. Es peor que
no ofrecer la función: es una falsa sensación de seguridad, exactamente lo que la épica
describe en R-4.

La épica no permite resolverlo por omisión: obliga a decidir, y a escribir el coste.

## Decisión

**Sí se invalidan las sesiones previas.** Al cambiar la contraseña (por reset ahora, y por
cambio desde sesión después), **todas** las sesiones anteriores de ese usuario dejan de ser
válidas, incluidas las del propio usuario en sus otros dispositivos. Mecanismo:

1. **`users` gana una columna `passwordChangedAt`** (timestamp con zona, `NOT NULL`,
   por defecto `now()`). Es la **época de credencial** del usuario: cambia cada vez que
   cambia su contraseña. Es un dato de identidad, no un evento, así que aquí sí es una
   columna de `users` (y no una tabla, a diferencia de ADR-015 pto. 3).

2. **La época se estampa en el JWT en el momento del login**, en la callback `jwt` cuando
   llega `user` (el mismo punto donde hoy se copia `token.id`). El token lleva desde
   entonces el valor que tenía la época **cuando se emitió**.

3. **La validación se hace en el lado Node, en la instancia de `config.ts`**, comparando el
   valor estampado en el token contra el valor actual en base de datos. Si no coinciden —o
   si el token no trae el dato—, la sesión **no se resuelve como autenticada**: `auth()`
   devuelve sesión sin usuario y el guard ya existente (`requireSession`) la manda a login.

4. **El middleware (Edge) NO cambia y NO valida la época.** Sigue haciendo lo de siempre:
   redirigir a quien no trae cookie. Esto preserva íntegra la razón de ser del split-config
   de ADR-001 —nada de DB ni bcrypt en el bundle edge— a cambio de un matiz que hay que
   decir claro: una cookie revocada **puede atravesar el middleware**, pero muere en la
   frontera de sesión de Node, que es por donde pasa **todo** acceso a datos (server
   components y server actions). **No se sirve ni un dato** con una sesión revocada; lo
   único que "sobra" es un redirect que ocurre un salto más tarde.

5. **La época se copia hacia adelante en las rotaciones del token, nunca se recalcula.**
   Auth.js re-emite el JWT periódicamente (`updateAge`); si la época se releyera de la base
   en cada rotación, el token del atacante se "curaría" solo y el mecanismo sería
   decorativo. La comparación siempre es *"lo que el token trajo del login"* contra *"lo que
   la base dice ahora"*.

6. **Un token sin el dato se considera caducado**, no válido por defecto. Afecta a las
   sesiones emitidas antes de desplegar esto: en el despliegue, **todo el mundo tiene que
   volver a iniciar sesión una vez**. Es la única lectura segura: tratar la ausencia como
   "vale" dejaría una puerta permanente para cualquier cookie antigua.

7. **La comparación es una función pura y testable**, separada del acceso a datos: recibe la
   época del token y la del usuario y responde si la sesión sigue vigente. Es el mismo
   patrón que `isPublicPath`/`requireSession` (SPEC-001): la lógica que decide se prueba
   sola, y el runtime la invoca.

## Consecuencias

### Positivas
- **R-4 queda cerrado de verdad**: quien recupera su contraseña expulsa a quien estuviera
  dentro. La función hace lo que el usuario cree que hace.
- Se obtiene gratis el equivalente a *"cerrar sesión en todos los dispositivos"*, que es la
  otra mitad de lo que la épica pide en CE-4.
- **ADR-001 sigue en pie**: no se migra a sesiones en base de datos, no se toca la estrategia
  JWT y el middleware sigue siendo edge-safe. Es una extensión acotada, no un cambio de
  modelo.
- La pieza que decide es una función pura: se verifica sin levantar Auth.js.

### Negativas / follow-ups
- **Una lectura de base de datos por resolución de sesión en Node** (`SELECT
  password_changed_at FROM users WHERE id = $1`). Es una búsqueda por clave primaria en una
  tabla diminuta, en páginas que ya consultan datos, pero **es coste nuevo en cada petición
  autenticada** y hay que decirlo. Si algún día molesta, hay margen obvio (cachear la época
  por petición, o por unos segundos) sin cambiar la decisión.
- **La sesión deja de ser estrictamente sin estado.** Sigue sin haber tabla de sesiones,
  pero su validez ya depende de la base de datos: si la base no responde, no hay sesión.
  Antes había sesión aunque la base estuviera caída (aunque no había datos que enseñar).
- **Un cierre de sesión global para todos en el despliegue** (punto 6). Con la base de
  usuarios actual es un incordio de una vez; con testers externos ya dentro, conviene que no
  coincida con el día de la invitación.
- **La revocación no ocurre en el middleware** (punto 4). Quien audite esto debe entender
  que la frontera real es Node. Si en el futuro alguna ruta sirviera datos **sin** pasar por
  la frontera de sesión de Node, se saltaría la revocación: es la invariante que hay que
  mantener.
- **No hay revocación selectiva**: no se puede echar a un dispositivo y conservar los demás.
  Es todo o nada, y para el caso de uso ("me han entrado") es lo correcto.

## Alternativas consideradas

- **No invalidar nada y declararlo** (la opción que la épica permite explícitamente).
  Rechazada. Es defendible en coste, pero el precio no lo paga el proyecto: lo paga el
  usuario que hace exactamente lo que la app le sugiere para protegerse y no consigue nada.
  Una función de seguridad que no cumple lo que su nombre promete es peor que su ausencia,
  porque detiene la búsqueda de otras medidas. Si el humano prefiere esta vía por coste,
  entonces la app debe decírselo al usuario por escrito en la pantalla de reset — y eso
  cambia el producto, no solo la implementación.
- **Migrar a sesiones en base de datos** (adapter de Auth.js con tabla `sessions`).
  Es la solución canónica y da revocación selectiva, pero **supersedería ADR-001**: obliga a
  consultar la base en cada validación —incluido el middleware, que es Edge—, mete el
  adapter y su esquema, y rehace el split-config entero. Coste desproporcionado para el
  problema que hay que resolver hoy. Queda como la evolución natural si algún día se pide
  "ver y cerrar mis sesiones activas".
- **Rotar `AUTH_SECRET`** en cada reset. Invalida las sesiones... de **todos los usuarios del
  sistema**, y exige redesplegar. Absurdo a partir del segundo usuario.
- **Acortar mucho la vida del JWT** (p. ej. 15 min) para que la ventana de supervivencia sea
  pequeña. No es revocación: es esperar. Deja una ventana en la que el atacante sigue
  dentro justo después de que la víctima crea haberlo echado, y empeora la UX de todos para
  mitigar a medias un caso raro.
- **Derivar la época del propio `password_hash`** (p. ej. un prefijo del hash) y ahorrarse la
  columna. Funciona, y es un truco conocido, pero mete material del hash de la contraseña
  dentro de un JWT que el cliente puede leer. Rechazado: no se paga con criptografía de
  credenciales lo que cuesta una columna `timestamp`.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
