---
id: SPEC-034
tipo: spec
epica: EPIC-004
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
---
# SPEC-034 — Rol por usuario y visibilidad de sección

## Problema

**Hoy Stockeiro enseña a cualquiera que entre exactamente lo mismo que le enseña a su
autor.** `users` (`src/db/schema.ts`) no tiene ningún atributo que distinga una cuenta de
otra más allá del email: `AppNav` (`src/app/app-nav.tsx`) pinta las cuatro secciones para
todo el mundo y `/cartera`, `/cartera/importar`, `/vigiladas` y `/avisos` están protegidas
por sesión y por nada más (`src/proxy.ts` + `isPublicPath`).

EPIC-004 va a publicar la app en un hilo de un foro de bolsa. El feedback que se busca es
sobre **la vigilancia** —vigiladas y avisos, el circuito donde vive la promesa— y **cada
sección que se enseña es superficie que hay que defender ante desconocidos**. Cartera e
Importar funcionan, pero no son lo que se está poniendo a prueba y arrastran un import de
extracto bancario que nadie ha ejercitado con un fichero ajeno.

Esta spec cubre **CE-2** (*"un usuario con rol tester ve Panel, Vigiladas y Avisos, y nada
más"*) y es, junto con **SPEC-035** (legales) y **SPEC-036** (borrar cuenta), el **corte
mínimo que bloquea publicar**. Además es prerrequisito de **SPEC-037**: tras el veredicto
del 2026-08-19, **el operador es un rol** (`admin`) y no una lista de emails, así que la
pantalla de operación se protege con el catálogo que entrega esta spec (**ADR-023** pto. 9).

El problema no es "poner un `if` en el menú". Son tres cosas que se hacen mal por separado:

1. **Quitar el enlace no cierra la puerta.** CE-2 exige por escrito que Cartera e Importar
   **no sean alcanzables tecleando la URL**. Y hay una segunda puerta que la URL ni siquiera
   necesita: las **server actions** de `src/app/cartera/actions.ts` y de
   `src/app/cartera/importar` aceptan `POST` mientras existan, las pinte alguien o no.
2. **Un panel que enlaza a una puerta cerrada es peor que no tener panel.** Lo dice la
   propia épica: `/dashboard` tiene hoy tres tarjetas y la primera es *"01 / cartera"*.
3. **Dónde vive el rol decide si degradar a alguien sirve de algo.** La sesión es JWT
   (**ADR-001**) y **ADR-016** ya la hizo dependiente de una lectura por petición. Meter el
   rol en el token sería gratis en apariencia y dejaría a un usuario degradado con la
   sección abierta hasta su siguiente login. Se resuelve en **ADR-021**.

Reglas en juego: **RN-01** (aislamiento, que esta spec **no toca**: el rol no decide de
quién son los datos, sino qué secciones de **los tuyos** se enseñan), **RN-03** (acceso
autenticado: esta spec **no añade ninguna ruta pública**) y **RI-01** (la migración es
aditiva).

## Usuarios / roles afectados

- **Tester que llega del foro**: se registra y ve una app **coherente** —Panel, Vigiladas,
  Avisos— sin enlaces muertos, sin secciones que le rebotan y sin enterarse de que existe
  algo que no puede usar por el camino de un error.
- **Usuario `completo`**: ve el producto entero —Panel, Cartera, Vigiladas, Avisos,
  Importar— y **no** la pantalla de operación. Hoy no existe ninguna cuenta así: es el rol
  al que se promueve a un tester de confianza cuando se le abre Cartera.
- **Usuario `admin` (hoy, el autor)**: todo lo del `completo` **más** la pantalla de
  operación. Su cuenta ya existe y la migración la deja como `admin` sin ningún paso manual
  (**ADR-021** pto. 8). Sigue viendo las cuatro secciones de hoy.
- **Operador**: gana el interruptor por persona. Promover a alguien a `completo` es un
  `UPDATE` en Neon y **surte efecto en el siguiente clic de esa persona**, sin pedirle que
  cierre sesión (**ADR-021** pto. 4). No hay pantalla para hacerlo: **F-ADR-021-1**.
- **Tester curioso que teclea `/cartera`**: no obtiene ni un dato. Aterriza en el panel con
  una línea que le dice que esa sección no está en la versión de pruebas — ni un error
  opaco, ni un 404 que finja que no existe.
- **Cualquier usuario con sesión abierta el día del despliegue**: no se entera. A diferencia
  de ADR-016, aquí **no hay relogin global**: el rol no viaja en el token, así que ningún
  token queda inválido.

## Criterios de aceptación

Cada CA es verificable con un test. Se mantiene la disciplina del proyecto: unidad e
integración con **Vitest sobre PGlite**, e2e con **Playwright** sobre Postgres efímero, y el
esquema aplicado **desde las migraciones** (**ADR-019**, SPEC-026).

- **CA-1 (La columna existe, con dominio cerrado y por migración — ADR-021 pto. 1, RI-01).**
  Dado el esquema aplicado desde `drizzle/`,
  cuando se inspecciona `users`,
  entonces existe `role`, es `NOT NULL`, y la base **rechaza** cualquier valor distinto de
  `'tester'`, `'completo'` y `'admin'` (un `UPDATE` a `'root'` o a `''` falla). La migración
  **no borra, no renombra y no estrecha** nada (**RI-01**): el código anterior a esta spec
  sigue funcionando contra el esquema nuevo.

- **CA-2 (Las cuentas que ya existían quedan como `admin` — ADR-021 pto. 8).**
  Dada una base con cuentas creadas **antes** de la migración,
  cuando la migración se aplica,
  entonces **todas** quedan con rol `admin`, **ninguna** pierde acceso a ninguna sección y
  **no hace falta ningún `UPDATE` manual** para que el despliegue quede operable.
  Verificable aplicando la migración sobre una base sembrada previamente. La contrapartida
  —que exige confirmar el censo antes del *merge*— es **F-ADR-021-3**.

- **CA-3 (Toda cuenta nueva nace `tester` — ADR-021 pto. 8).**
  Dado el registro (`registerAction`, SPEC-001 CA-1),
  cuando se crea una cuenta después de la migración,
  entonces su rol es `tester`, **tanto si el código lo indica explícitamente como si no**:
  un `INSERT` directo sin la columna también da `tester`. El default de la base es la red,
  no el mecanismo principal.

- **CA-4 (La decisión de visibilidad es una función pura y exhaustiva — ADR-021 pto. 5).**
  Dada la función de visibilidad por sección,
  cuando se evalúa el producto cartesiano de los **tres** roles por las **seis** secciones
  (panel, vigiladas, avisos, cartera, importar, operación),
  entonces `tester` obtiene **verdadero para panel, vigiladas y avisos** y **falso para
  cartera, importar y operación**; `completo` obtiene verdadero en las cinco primeras y
  **falso para operación**; `admin` obtiene verdadero en las seis. Las **18 combinaciones se
  prueban una a una**, no por muestreo. Y se comprueba la propiedad de cadena de **ADR-021**
  pto. 1.a: **no existe ninguna sección que un `tester` vea y un `completo` no, ni ninguna
  que un `completo` vea y un `admin` no**. La función **no** lee la base, **no** importa Next
  y se prueba sin levantar nada.

- **CA-5 (El menú enseña exactamente lo que el rol permite — CE-2).**
  Dada una sesión de cada uno de los tres roles,
  cuando se renderiza `AppNav`,
  entonces la de `tester` **no contiene ningún enlace** a `/cartera` ni a
  `/cartera/importar` (ni el `href`, ni el texto), y sí contiene Panel, Vigiladas y Avisos
  con su contador de no leídos intacto (SPEC-007 CA-10); las de `completo` y `admin`
  contienen las cuatro. El menú **consulta la misma función de CA-4**, no una lista propia.
  **Frontera con SPEC-037**: esta spec **no pinta ningún enlace a la pantalla de operación**
  —esa ruta todavía no existe y un enlace roto es peor que ninguno—; el catálogo ya la
  contempla (CA-4) y **SPEC-037** entrega la ruta y su enlace leyendo ese mismo catálogo.

- **CA-6 (La URL tecleada no llega — CE-2, ADR-021 pto. 6).**
  Dado un usuario con rol `tester` y sesión válida,
  cuando navega directamente a `/cartera` y a `/cartera/importar`,
  entonces **no se le sirve ni un dato de ninguna de las dos** —ni una posición, ni un P/L,
  ni el formulario de import— y acaba en `/dashboard` con la nota de CA-8. Se verifica en
  **Playwright**: el cuerpo de la respuesta final no contiene ningún encabezado ni tabla de
  esas páginas.

- **CA-7 (Las server actions de la sección cerrada tampoco pasan — ADR-021 pto. 7).**
  Dado un usuario con rol `tester`,
  cuando se invoca cada server action de `src/app/cartera/actions.ts` y de
  `src/app/cartera/importar`,
  entonces **ninguna** produce efecto: no se crea, modifica ni borra **ninguna fila** de
  `transactions` ni de `symbol_aliases`, y la operación termina sin datos. Comprobado
  contando filas antes y después, action por action — **una lista que se prueba entera, no
  una muestra**.

- **CA-8 (Rebotar no es fallar — CE-2, R-7 en espíritu).**
  Dado el rebote de CA-6,
  cuando el usuario aterriza en el panel,
  entonces lee **una línea que explica** que esa sección no está disponible en la versión de
  pruebas. No hay error de Next, no hay 404 y no hay redirección muda al panel sin decir por
  qué. La nota aparece **solo** tras el rebote, no en cada visita al panel.

- **CA-9 (El panel del tester no ofrece lo que no puede abrir — épica, §Alcance).**
  Dado `/dashboard`,
  cuando lo visita un `tester`,
  entonces **no aparece la tarjeta de Cartera** y las tarjetas que quedan (Vigiladas y
  Avisos) están completas y bien formadas — sin hueco, sin rejilla rota y sin enlace a
  `/cartera` en ningún texto; cuando lo visita un `completo` o un `admin`, aparecen las
  **tres** tarjetas de hoy, intactas.

- **CA-10 (Degradar y promover surten efecto sin volver a iniciar sesión — ADR-021 pto. 4).**
  Dado un usuario `completo` con sesión abierta que está viendo `/cartera`,
  cuando su rol pasa a `tester` en la base,
  entonces en su **siguiente petición** ya no accede a `/cartera` ni ve su enlace, **con la
  misma cookie**; y dado un `tester` con sesión abierta que pasa a `completo`, en su
  siguiente petición **sí** accede y **sí** ve el enlace, también con la misma cookie. La
  tercera transición —`completo` → `admin` y vuelta— se comprueba igual sobre el catálogo de
  CA-4, sin necesidad de la ruta de operación. Verificable en Playwright con un solo
  contexto de navegador.

- **CA-11 (El rol no viaja en el token — ADR-021 pto. 2).**
  Dado el JWT de sesión emitido en el login,
  cuando se decodifica su contenido,
  entonces **no contiene el rol** (ni bajo ese nombre ni con su valor), y sigue conteniendo
  `id` y `credentialEpoch`; y `src/lib/auth/base-config.ts` **sigue sin importar la base de
  datos ni bcrypt** — comprobable con el mismo estilo de prueba de grafo de imports que ya
  usa `tests/version-import-graph.test.ts`.

- **CA-12 (Saber el rol no cuesta una consulta más — ADR-021 pto. 3).**
  Dada la frontera de sesión de Node con un doble de la base que **cuenta** las consultas
  que recibe,
  cuando se resuelve una petición autenticada,
  entonces se ejecuta **exactamente una** lectura sobre `users` y de ella salen **a la vez**
  la época de credencial y el rol. Dos consultas separadas suspenden este CA aunque el
  comportamiento visible sea correcto.

- **CA-13 (El rol no relaja ni sustituye a RN-01 — ADR-021 pto. 9).**
  Dados dos usuarios con datos propios, **uno de ellos `admin`**,
  cuando cada uno navega por todas las secciones que su rol le abre,
  entonces **ninguno ve ni un dato del otro** —y el `admin` **tampoco**: no accede a la
  cartera, ni a las vigiladas, ni a los avisos de nadie—, exactamente igual que antes de
  esta spec. El rol **no** es un permiso sobre datos ajenos, ni siquiera el de operador
  (**ADR-021** pto. 9). Sigue verde CA-6 de SPEC-001.

- **CA-14 (Lo que el tester sí tiene, funciona entero).**
  Dado un usuario `tester`,
  cuando usa Panel, Vigiladas y Avisos,
  entonces puede **añadir y quitar** acciones vigiladas con sus zonas, ver su estado de zona
  y su `asOf`, y leer y marcar sus avisos: **ninguna** de las capacidades de SPEC-003,
  SPEC-007, SPEC-024 y SPEC-029 se degrada por tener rol `tester`.

- **CA-15 (No degrada lo entregado).**
  Dada la suite existente,
  cuando se ejecuta completa (unidad, integración y e2e),
  entonces sigue verde. El único cambio de expectativa admisible es el derivado de que las
  cuentas creadas **en los tests** nacen `tester` (CA-3): las pruebas que ejercitan Cartera
  o Importar declaran explícitamente el rol que necesitan, en lugar de heredarlo por
  descuido.

## Entidades y reglas afectadas

**Entidades modificadas** (`src/db/schema.ts`, migración en `drizzle/`):

- **`users`** gana **`role`** (`text NOT NULL`, dominio `'tester' | 'completo' | 'admin'`
  impuesto con `CHECK`, sin `enum` de Postgres — **ADR-021** pto. 1). La migración añade con
  `DEFAULT 'admin'` —lo que deja `admin` a las cuentas existentes— y a continuación fija el
  default en `'tester'`, de modo que toda cuenta nueva nazca así (**ADR-021** pto. 8).
  Es lo **único** que esta spec cambia del esquema; `email` (**RN-02**) y
  `passwordChangedAt` (**ADR-016**) no se tocan.

**Piezas existentes que se extienden, no se duplican:**

- **`src/lib/auth/session-boundary.ts`** (`resolveSessionWithEpoch`) y la lectura por clave
  primaria que hoy hace `getCredentialEpoch`: pasan a devolver **época + rol** en la misma
  consulta (**ADR-021** pto. 3, CA-12). `src/lib/auth/session.ts` (`requireUser`) propaga el
  rol.
- **`src/lib/auth/base-config.ts`**: **no cambia**. Sigue edge-safe y sigue estampando solo
  `id` y `credentialEpoch` (CA-11).
- **`src/proxy.ts` y su `matcher`**: **no cambian**. La visibilidad de sección **no** es
  cosa del middleware (**ADR-021** pto. 6). Esta spec **no añade ninguna ruta pública**:
  `PUBLIC_PREFIXES` (`src/lib/auth/guard.ts`) queda igual.
- **`src/app/app-nav.tsx`** y **`src/app/dashboard/page.tsx`**: consultan la función pura de
  visibilidad, no una lista propia (CA-5, CA-9).
- **Server actions de `src/app/cartera/`** (incluido `importar`): cada una pasa por la misma
  frontera (CA-7).

**Módulo nuevo**: la función pura de visibilidad por sección y su catálogo de secciones,
en `src/lib/auth/` junto a `guard.ts` y `session-epoch.ts` — el sitio donde este proyecto ya
pone las decisiones puras de acceso.

**Reglas y decisiones**: **RN-01** (intacta, CA-13), **RN-02** (intacta), **RN-03**
(intacta: ninguna ruta pública nueva), **RI-01** (CA-1); **ADR-021** (origen de esta spec,
en `borrador`), **ADR-001** (JWT y split-config, que ADR-021 **no toca**) y **ADR-016** (de
cuya lectura por petición se cuelga el rol, **extendida sin superseder**). Dominio: se
añaden a `docs/fundacion/dominio.md` los términos **Rol de cuenta** (`tester` / `completo` / `admin`)
y **Sección**.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Pantalla para cambiar el rol de una cuenta.** Se cambia con un `UPDATE` en Neon
  (**F-ADR-021-1**). La pantalla de operación de **SPEC-037** entrega el grifo y los
  contadores, y **no** entrega esto: son dos superficies de escritura distintas y una de
  ellas puede esperar.
- **Flags de capacidad por usuario individual**: descartado por escrito en el gate de la
  épica (§Alcance/Fuera) y registrado en el roadmap "Más adelante".
- **La pantalla de operación en sí.** El rol `admin` y su casilla en el catálogo entran aquí
  (CA-4); **la ruta `/admin`, sus contadores y su enlace en la navegación son SPEC-037**.
  Esta spec entrega la decisión de acceso, no la pantalla a la que da acceso.
- **Un cuarto rol.** Tres valores y punto. Separar "opera el servicio" de "ve el producto
  entero" —hoy unidos en la cadena de **ADR-021** pto. 1.a— exigiría su propio ADR.
- **RLS en Postgres** (**F-SPEC-001-1**): el aislamiento sigue en capa de app. **R-5** de la
  épica sube su prioridad y la épica **no lo cierra**; esta spec tampoco.
- **Ocultar Cartera e Importar en `/api`**: no hay ninguna ruta de API de cartera. `/api`
  solo tiene auth, cron y version, y las tres están fuera del `matcher` por diseño.
- **Cambiar qué secciones ve un tester.** La lista la fijó el gate de la épica (Panel,
  Vigiladas, Avisos). Esta spec la implementa, no la negocia.
- **Ayuda, estados vacíos y cadencia**: son **SPEC-039**. Aquí el panel del tester solo
  **deja de ofrecer** lo que no puede abrir (CA-9); llenar ese hueco con algo que enseñe es
  trabajo de SPEC-039.
- **Versión visible, legales, grifo, borrado**: SPEC-038, SPEC-035, SPEC-037 y SPEC-036.

## Salvedades y follow-ups

- **F-SPEC-034-1 (DESPLIEGUE).** La migración toca `users` y el build migra en **todos** los
  entornos (`vercel.json`), con `DATABASE_URL` compartida entre *Production* y *Preview*:
  **abrir la PR migra producción**. Las dos sentencias son aditivas (**RI-01**) y el código
  vigente sigue funcionando con ellas, pero **cuándo se abre la PR es decisión del humano**,
  como en **F-SPEC-023-1**.
- **F-SPEC-034-2 (orden de despliegue).** Entre el momento en que la migración corre y el
  momento en que el código nuevo está vivo, todas las cuentas son `admin` y nadie ve nada
  distinto —porque nada lee todavía la columna—. Es la propiedad que hace este despliegue
  aburrido, y es intencionada.
- **F-SPEC-034-5 (condición previa al *merge*, hereda F-ADR-021-3).** El backfill deja
  `admin` a **todas** las cuentas existentes. **Confirmar el censo de `users` antes de abrir
  la PR**: si hay alguna cuenta que no sea del operador, se degrada a mano antes de
  desplegar. Es una consulta de diez segundos y evita entregar la pantalla de operación a
  quien no debe.
- **F-SPEC-034-3 (residual asumido).** Una petición de un `tester` a `/cartera` atraviesa el
  middleware Edge y solo se corta en Node (**ADR-021** pto. 6). No se sirve ni un dato
  (CA-6), pero el redirect se paga un salto más tarde. Mismo residuo que **ADR-016** pto. 4.
- **F-SPEC-034-4 (higiene de tests).** Varias pruebas existentes crean usuarios y luego
  operan sobre Cartera. Con CA-3 nacerán `tester`. Que la corrección sea **declarar el rol
  en el arranque de esas pruebas**, no relajar el default: un default cómodo para los tests
  es como se pierde la garantía en producción.

## Notas para el gate humano

1. **El rebote a `/dashboard` con una nota (CA-8) es una decisión de producto, no técnica.**
   Las tres opciones eran: 404 (finge que no existe), pantalla de "no disponible" en la
   propia URL, o rebote con aviso. He elegido la tercera porque el 404 miente —la sección
   existe, es la misma app— y la segunda obliga a inventar una plantilla de error nueva para
   un caso que solo alcanza quien teclea a mano. Si prefieres el 404 por no dar pistas de
   que hay más producto detrás, es un cambio de una línea y solo afecta a CA-6 y CA-8.

2. **El rol NO va en el JWT, y quiero que veas por qué no cuesta nada.** ADR-016 ya paga una
   lectura de la fila del usuario **en cada petición autenticada**; leer una columna más de
   esa misma fila cuesta **cero consultas adicionales** (CA-12). A cambio, degradar a alguien
   funciona en su siguiente clic en vez de "cuando le caduque el token". El camino barato
   aquí no era más barato, solo peor.

3. **Toda cuenta nueva nace `tester`, y las que ya existen quedan `admin`.** Lo segundo es lo
   que hace el despliegue autocontenido —tu cuenta abre la pantalla de operación sin que
   tengas que tocar Neon—, y tiene la contrapartida de **F-SPEC-034-5**: confirma el censo
   antes de abrir la PR. Consecuencia doméstica de lo primero: si algún día borras tu cuenta
   y vuelves a registrarte, entras como `tester` y necesitarás un `UPDATE` para recuperar
   Cartera **y la pantalla de operación**. Por eso **ADR-022** pto. 8 prohíbe que una cuenta
   `admin` se borre desde la app.

4. **No hay UI para promover a nadie (F-ADR-021-1), y es deliberado.** Cambiar el rol de una
   persona es un acto raro y consciente; ponerlo en la pantalla de operación de SPEC-037
   añadiría la primera escritura sobre cuentas ajenas del proyecto. Si prefieres tenerlo ya,
   dilo: es una spec pequeña **aparte**, no un CA más aquí.

5. **CA-7 es el CA que de verdad cierra CE-2, y es el más fácil de hacer mal.** Ocultar la
   página es visible; dejar una server action abierta no lo es. Pido explícitamente que el
   verificador enumere las actions de `cartera` e `importar` **una a una** y no acepte una
   muestra.

6. **Esta spec no cierra R-5.** Con desconocidos dentro, el aislamiento sigue viviendo en
   capa de app. El rol **no** es una capa de seguridad sobre datos ajenos (CA-13) y no
   conviene que nadie lo lea así en el futuro. Si quieres que RLS entre en esta épica, es un
   cambio de alcance de la épica y hay que decidirlo ahí, no aquí.

7. **`admin` NO ve datos de nadie, y CA-13 lo prueba con un `admin` de verdad.** Tu
   veredicto mete al operador en el mismo enum que la visibilidad, y la palabra
   "administrador" arrastra una expectativa —"puede ver todo"— que aquí es **falsa a
   propósito**: `admin` abre una pantalla de **agregados** (ADR-023 pto. 10), no las carteras
   ajenas. Es la línea que más fácilmente se erosionará el día que quieras depurar el
   problema de un tester concreto, así que está escrita como CA y no como buena intención.

8. **Secuencia.** Esta spec va **primera** de EPIC-004: **SPEC-036** necesita su columna
   `role` (CA-11 a CA-13), **SPEC-037** su catálogo de secciones (ADR-023 pto. 9) y
   **SPEC-039** saber qué ve un tester para escribir su ayuda y sus estados vacíos. Las que
   bloquean publicar son esta, **SPEC-035** y **SPEC-036**.
   **Secuencia sancionada en el gate del 2026-08-19: 034 → 035 → 036 → 037 → 039 → 038.**

9. **Aprobación**: la spec queda en **`borrador`** y **no la firmo yo**. **ADR-021** nace
   también en `borrador` y se aprueba en este mismo gate; si prefieres el rol en el JWT,
   decae CA-10, decae CA-12 y hay que reescribir el punto 2 de estas notas en la pantalla de
   operación como *"los cambios de rol tardan en aplicarse"*.
