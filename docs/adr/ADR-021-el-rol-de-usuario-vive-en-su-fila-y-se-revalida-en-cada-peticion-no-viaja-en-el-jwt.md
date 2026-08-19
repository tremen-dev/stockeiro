---
id: ADR-021
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
---
# ADR-021: El rol de usuario vive en su fila y se revalida en cada petición, no viaja en el JWT

- Deciders: propone **sdd-arquitecto** (2026-08-19) a partir de la decisión de producto
  tomada en el gate de **EPIC-004** (2026-08-19, Alberto Fojo): *"el gating es por **rol**
  por usuario, no por flags individuales ni por variable de entorno global"*. Lo que el gate
  **ya resolvió** es **qué** gobierna la visibilidad; lo que este ADR decide es **dónde vive
  ese dato y cuándo surte efecto** — que es lo que constriñe el trabajo futuro y lo que
  determina si degradar a alguien tiene efecto hoy o dentro de un mes.
  **Revisión del 2026-08-19 (mismo día, gate de veredictos)**: el humano resolvió ampliar el
  enum a **tres** valores (`tester` / `completo` / `admin`), aceptando lo que ese tercer
  valor cuesta a cambio de que la identificación del operador sea **autocontenida** —sin
  variable de entorno—. Ese cambio se absorbe aquí; **ADR-023** deja de decidir la identidad
  del operador y se limita al grifo. Pendiente de aprobación por el humano en el gate de
  **SPEC-034**.
- Specs relacionadas: la origina **SPEC-034** (Rol por usuario y visibilidad de sección).
  La consumen **SPEC-037** (la pantalla de operación lee el rol de las cuentas) y
  **SPEC-039** (la ayuda y los estados vacíos no ofrecen lo que el rol no permite).
  **Extiende ADR-016 sin superseder**: reutiliza su frontera de sesión de Node y su lectura
  por clave primaria. No toca **ADR-001** (JWT sin estado, split-config edge/Node) más allá
  de lo que ADR-016 ya lo tocó.

## Contexto

**El punto de partida.** `users` (`src/db/schema.ts`) es `{id, email, passwordHash,
passwordChangedAt, createdAt}`: **no hay campo de rol**. La sesión es **JWT sin estado**
(**ADR-001**), estampada en la callback `jwt` de `src/lib/auth/base-config.ts`, que es
**edge-safe** y no puede tocar la base de datos porque el middleware de `src/proxy.ts` corre
en Edge.

**Lo que ADR-016 ya cambió, y que aquí es decisivo.** SPEC-023 introdujo la **época de
credencial**: el JWT la estampa en el login y la **frontera de sesión de Node**
(`resolveSessionWithEpoch`, `src/lib/auth/session-boundary.ts`) la revalida **contra la base
en cada petición autenticada**, mediante `getCredentialEpoch` — un `SELECT` de una columna
por clave primaria sobre `users`. ADR-016 declaró ese coste explícitamente en sus
consecuencias: *"una lectura a la base de datos por petición autenticada"*.

Es decir: **la fila del usuario ya se lee en cada petición autenticada**. La pregunta "¿meto
el rol en el JWT para ahorrarme una consulta?" está mal planteada, porque la consulta ya se
está pagando y **leer una columna más de la misma fila cuesta cero consultas adicionales**.

**Por qué esto no es fontanería.** El rol decide si un usuario ve Cartera e Importar
(**CE-2** de EPIC-004). Si el rol viaja en el JWT, entonces:

- **promover** a alguien a `completo` no tiene efecto hasta que vuelva a iniciar sesión —el
  operador le dice "ya lo tienes" y el usuario no lo tiene—;
- **degradar** a alguien a `tester` **no le quita nada** hasta que su token expire o cierre
  sesión: sigue viendo y operando la sección que se le acaba de cerrar.

Y el segundo caso es exactamente el fallo que ADR-016 se negó a aceptar para la contraseña:
una función de seguridad que no hace lo que su nombre promete es peor que su ausencia. Aquí
el rol no protege datos de terceros (RN-01 sigue haciendo eso, y no depende del rol), pero
sí es la frontera que define **qué superficie se enseña a un desconocido** — que es la razón
de ser de la épica.

**La restricción que no se puede saltar.** El middleware Edge **no puede leer el rol**
(ADR-001: sin DB, sin bcrypt). Así que la protección de ruta no puede vivir ahí. Es el mismo
matiz que ADR-016 pto. 4 ya aceptó y documentó para la revocación de sesiones: *"una cookie
revocada puede atravesar el middleware, pero no obtiene ni un dato"*. Aquí se repite:
**una petición de un `tester` a `/cartera` atraviesa el middleware, pero la página no le
sirve ni un dato**.

## Decisión

1. **El rol es una columna de `users`**: `role text NOT NULL`, con dominio cerrado
   `'tester' | 'completo' | 'admin'` — los tres valores que fijó el gate de EPIC-004, ni uno
   más. La validación del valor vive en el código como unión de tipos y en la base como
   `CHECK`; no se crea un tipo `enum` de Postgres, porque ampliarlo después es una migración
   destructiva-en-espíritu y **RI-01** prefiere lo aditivo.

   **1.a — Los tres roles son una cadena, no tres islas.** `tester` ⊂ `completo` ⊂ `admin`:
   todo lo que ve un `tester` lo ve un `completo`, y todo lo que ve un `completo` lo ve un
   `admin`, que además es el único que alcanza la pantalla de operación. La jerarquía se
   escribe **una vez**, en la función pura del pto. 5, y no se reconstruye a base de
   condicionales por pantalla. Un `admin` es un `completo` que además opera: **no** es una
   cuenta distinta ni una cuenta de servicio, y por eso sigue teniendo sus propios datos
   aislados por **RN-01** como cualquier otra.

   **1.b — Que `admin` esté en el mismo enum que la visibilidad tiene un precio, y se asume
   con los ojos abiertos.** Mezcla *qué ves de lo tuyo* con *quién opera el servicio*, que
   son preguntas distintas, y obliga a que promover a alguien a operador le dé también
   Cartera. A cambio compra dos propiedades que la alternativa —una lista de emails en
   configuración— no tiene: **no hay email liberado que siga dando acceso** (borrar una
   cuenta se lleva su rol con ella) y **no hay variable que pueda faltar** y dejar el
   servicio sin operador o sin la protección que depende de saber quién lo es. Con un solo
   operador previsible, esas dos fragilidades pesan más que la pureza del enum.

2. **El rol NO se estampa en el JWT.** `base-config.ts` sigue exactamente igual: sigue sin
   DB, sigue estampando solo `id` y `credentialEpoch`. Ni una línea nueva en el camino Edge.

3. **El rol se lee en la frontera de sesión de Node, en la MISMA consulta que ya lee la
   época.** `getCredentialEpoch` se generaliza a una lectura de la fila de sesión que
   devuelve `{ passwordChangedAt, role }`; `resolveSessionWithEpoch` lo propaga a
   `session.user.role`, y `requireUser()` (`src/lib/auth/session.ts`) lo devuelve junto al
   `id` y el `email`. **El número de consultas por petición no cambia**: sigue siendo una
   lectura por clave primaria sobre `users`.

4. **Efecto de un cambio de rol: inmediato, en la petición siguiente.** No hace falta cerrar
   sesión, no hace falta esperar a que caduque nada. Promover y degradar son simétricos y
   ambos surten efecto en el siguiente `requireUser()`.

5. **La decisión de visibilidad es una función pura**, aislada del acceso a datos y de Next
   —mismo patrón que `isPublicPath`/`requireSession` (SPEC-001) e `isSessionEpochCurrent`
   (ADR-016 pto. 7)—: dado un rol y una sección, ¿puede? El runtime la invoca; el test no
   necesita levantar Auth.js ni una base de datos. **La pantalla de operación entra en ese
   mismo catálogo de secciones**: no hay un segundo mecanismo de acceso conviviendo con el
   primero, que es exactamente lo que la lista de emails habría creado.

6. **La protección de ruta vive en la frontera de Node, no en el middleware Edge.** Toda
   página y **toda server action** de una sección restringida pasa por la misma frontera.
   El middleware **no cambia**: sigue decidiendo solo "hay sesión / no hay sesión". Esto
   preserva el split-config de ADR-001 sin excepciones nuevas.

7. **Cubrir la página no basta: las server actions se cubren una a una.** Una sección oculta
   cuyas acciones siguen aceptando `POST` no está cerrada, solo escondida. La frontera se
   aplica en el punto de entrada de cada server action de la sección restringida, no solo en
   el componente que la pinta.

8. **Valor por defecto asimétrico, y a propósito.** La migración añade la columna con
   `DEFAULT 'admin'` —de modo que las cuentas **existentes** quedan como `admin`— y **acto
   seguido** cambia el default a `'tester'`, de modo que **toda cuenta nueva nace
   `tester`**. Las dos sentencias son aditivas (**RI-01**): ni borran, ni renombran, ni
   estrechan nada. Un `DEFAULT 'tester'` de una sola pasada convertiría al operador en
   tester en el mismo despliegue que le quita Cartera **y la pantalla de operación**, y eso
   es un incidente, no una migración.

   El backfill a `admin` —y no a `completo`— es lo que hace la solución **autocontenida**:
   el despliegue queda operable sin ningún `UPDATE` manual posterior. Se sostiene sobre un
   hecho comprobable, no sobre una suposición: **toda cuenta anterior a esta migración
   precede a la apertura al público**, porque hasta EPIC-004 la app no se había anunciado en
   ningún sitio. Ese hecho tiene una **condición de verificación** que el humano debe
   cumplir antes del *merge* (**F-ADR-021-3**): confirmar el censo. Si hubiera alguna cuenta
   ajena, se degrada a mano **antes** de desplegar, no después.

9. **El rol no relaja ni sustituye a RN-01, ni siquiera para `admin`.** El aislamiento por
   usuario sigue siendo el de `src/lib/data/ownership.ts` y no depende del rol: un
   `completo` no ve datos de nadie más — **y un `admin` tampoco**. El rol responde a *"¿qué
   secciones de **lo tuyo** se te enseñan?"*, nunca a *"¿de quién son los datos que se te
   sirven?"*. `admin` abre **una pantalla de agregados** (**ADR-023** pto. 15: cuenta filas,
   no lista personas), no una puerta a las carteras ajenas. Es la línea que impide que
   "administrador" signifique lo que suele significar, y se prueba en **SPEC-034** CA-13.

## Consecuencias

### Positivas

- **Coste cero en consultas.** La lectura ya existía por ADR-016; se le añade una columna.
  Elegir el JWT no habría ahorrado ni una ida a la base.
- **Degradar funciona de verdad.** Cerrar Cartera a alguien es efectivo en su siguiente
  clic, sin pedirle que cierre sesión ni esperar a que expire un token.
- **Ni una línea de DB en el camino Edge.** ADR-001 y su split-config quedan intactos; el
  middleware sigue siendo el de siempre.
- **Un solo sitio donde se decide.** La función pura de visibilidad es el análogo de
  `isPublicPath`: la excepción se declara y se prueba, no se hereda ni se disemina por
  condicionales en la UI.
- **La UI y la ruta no pueden divergir.** El enlace de navegación y el guard de la página
  consultan la misma función, así que es imposible que el menú ofrezca lo que la ruta niega
  (o al revés) sin que un test lo cace.

### Negativas / follow-ups

- **La sesión depende aún más de la base.** ADR-016 ya la hizo dependiente; ahora también la
  *forma* de la app lo es. Con la base caída no hay app autenticada — lo que ya era cierto,
  porque sin base no hay datos que enseñar. Nótese que `/api/version` sigue **fuera** de
  esta frontera y sigue respondiendo con la base caída (SPEC-031), y **SPEC-038** no puede
  romper eso.
- **Una petición de `tester` a `/cartera` atraviesa el middleware Edge** y solo se corta un
  salto más tarde, en Node. No sirve ni un dato, pero el redirect se paga después. Es
  literalmente el mismo residuo que ADR-016 pto. 4 aceptó y por el mismo motivo.
- **`admin` hereda Cartera quiera o no.** Al ser una cadena (pto. 1.a), no se puede ser
  operador sin ver el producto entero. Con un solo operador que además es el autor, es lo
  natural; el día que haya un operador que no deba ver Cartera, este enum se queda corto y
  habrá que separar las dos preguntas con otro ADR.
- **F-ADR-021-1 (higiene, futuro).** No hay UI para cambiar el rol de una cuenta: se cambia
  con un `UPDATE` en Neon. Con un operador y veinte testers es correcto —promover a alguien
  es un evento raro y deliberado—, pero es un follow-up conocido, no un olvido. Ponerlo en
  la pantalla de operación de **SPEC-037** sería la evolución natural; **no entra** ahí.
  Con el tercer rol adquiere **más** peso: es también el único camino para nombrar a un
  segundo operador o para degradarse a uno mismo antes de irse (**ADR-022** pto. 8).
- **F-ADR-021-2 (residual asumido).** El enum mezcla visibilidad de producto y operación del
  servicio (pto. 1.b). Se acepta a cambio de eliminar las dos fragilidades de la
  configuración externa. Si algún día el operador no debe ver Cartera, se separa con un ADR
  nuevo — y entonces la migración será la incómoda, no esta.
- **F-ADR-021-3 (DESPLIEGUE, condición previa al *merge*).** El backfill del pto. 8 deja
  `admin` a **todas** las cuentas existentes. **El humano debe confirmar el censo antes de
  abrir la PR**: si hay alguna cuenta que no sea suya, se degrada a mano antes de desplegar.
  Es barato de comprobar y caro de descubrir tarde.

## Alternativas consideradas

- **Estampar el rol como claim del JWT** (lo barato aparente). **Rechazada**: no ahorra
  ninguna consulta —la fila ya se lee en cada petición por ADR-016— y a cambio hace que
  degradar a alguien **no le quite nada** hasta que expire su token, y que promover a
  alguien no le dé nada hasta que vuelva a entrar. Pagar un defecto de correción por un
  ahorro que no existe no es un compromiso, es un error. Además chocaría de frente con
  ADR-016 pto. 5, que prohíbe **recalcular** claims en las rotaciones del token: un rol
  estampado y nunca recalculado sería rancio por diseño.

- **Gatear en el middleware Edge** (la protección "de verdad", en la puerta). **Rechazada**:
  exigiría o bien el rol en el JWT (ver arriba) o bien acceso a la base desde Edge, lo que
  rompe **ADR-001** y el split-config que SPEC-023 acaba de consolidar. El precio de no
  hacerlo —un redirect un salto más tarde— ya está aceptado y documentado en ADR-016 pto. 4.

- **Una tabla `user_capabilities` con flags por usuario** (`ver_cartera`, `ver_importar`…).
  **Rechazada**, y no por mí: el gate de EPIC-004 la descartó por escrito en §Alcance/Fuera
  (*"hoy no hay ningún caso que pida abrir Cartera a tres personas concretas, y multiplica
  los estados que hay que verificar"*). Se registra aquí para que el rechazo sea rastreable
  desde el código, no para reabrirlo.

- **Una variable de entorno global de "modo tester"**. **Rechazada** también en el gate de
  EPIC-004: es global, no por usuario, así que el operador se cerraría Cartera a sí mismo, y
  cambiarla exige redespliegue.

- **Un enum de Postgres para el rol.** **Rechazada**: `CREATE TYPE` + `ALTER TYPE ... ADD
  VALUE` es incómodo de revertir y de aplicar en dos despliegues, y **RI-01** empuja a lo
  aditivo. `text` + `CHECK` da la misma garantía en la base y una unión de tipos en
  TypeScript, que es donde de verdad se comprueba.

- **Derivar el rol de una lista de emails en configuración** (`ADMIN_EMAILS`), para el rol
  de producto o para el de operador. **Rechazada en el gate del 2026-08-19**, y por dos
  motivos que ninguna variable de entorno puede quitarse de encima:
  (a) **un email liberado sigue abriendo la puerta** — si la cuenta listada se borra, su
  dirección vuelve a estar libre (**RN-02**) y sigue en la lista, así que el siguiente que
  la registre hereda el acceso; taparlo exigía prohibir el borrado de esa cuenta *y* exigir
  una segunda condición de rol, dos parches para un mecanismo que no debería necesitarlos;
  y (b) **una variable puede faltar** — sin ella no hay operador, la pantalla no es
  accesible para nadie y, peor, ninguna cuenta queda protegida contra su propio borrado.
  Un valor en la fila del usuario no tiene ninguna de las dos propiedades. Además, el rol de
  un tester cambia con la relación y eso no puede exigir un redespliegue.
