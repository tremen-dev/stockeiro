---
id: SPEC-037
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-037 El grifo del registro y la pantalla de operacion

## Resumen
- Fase: hecho (verificada por sdd-verificador el 2026-08-19 — GREEN, 25/25 CA)
- Rama: `ft/SPEC-037-grifo-del-registro-y-pantalla-de-operacion`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/db/schema.ts` (`registrationSettings` con PK entera + `CHECK id = 1`; `cronRuns`) y `drizzle/0010_registration_gate_and_cron_runs.sql` (dos `CREATE TABLE` + `INSERT` de la fila semilla con `ON CONFLICT DO NOTHING`) | `tests/registration-esquema.test.ts` — columnas de las dos tablas, **la base rechaza la segunda fila con el id que sea**, semilla = `SEED_REGISTRATION_SETTINGS`, ninguna lleva `user_id`, y la migración no toca ninguna tabla anterior. Contra Postgres real: `tests/e2e/admin-grifo.spec.ts` › *CA-1* (`{openManually: true, capacity: 50}` en la base recién migrada) | Contra **Postgres real, base recién migrada** (arnés propio del verificador, no el del implementador): 1 fila, `open_manually=true`, `capacity=50`, `cron_runs` vacía. `INSERT` con id 1 **y** con id 2: los dos rechazados por la base. `drizzle-kit check` limpio y `db:scan` cuenta 11 migraciones sin marcar la nueva. **Y una comprobación que no estaba**: reaplicada la sentencia de siembra sobre una base donde el operador había puesto `capacity=7, open_manually=false`, la fila **no se pisa** — ni siquiera `updated_at`. | ✅ |
| CA-2 | `src/lib/registration/gate.ts` — `registrationState`, módulo sin una sola importación | `tests/registration-gate.test.ts` — matriz completa (manual × {null, >, ==, <}), **la frontera `cuentas == capacity` cerrada**, y una comprobación de que el fuente no tiene ningún `import` | `gate.ts` leído: **cero importaciones**, confirmado a mano. Frontera `cuentas == capacity` cerrada, comprobada además en vivo (con N cuentas y cupo N no entra nadie). El motivo **manual manda** cuando fallan los dos: verificado en el navegador con `open_manually=false, capacity=0` → `data-motivo="manual"`. | ✅ |
| CA-3 | `src/app/(auth)/actions.ts` (`registerAction` → `registerIfOpen`), `src/lib/registration/service.ts` | `tests/registration-service.test.ts` › *CA-3* (cuenta creada, rol `tester`, duplicado sigue lanzando `EmailAlreadyRegisteredError`) y `tests/registration-action.test.ts` › *CA-3* (`signIn` llamado con `redirectTo: '/dashboard'`; el duplicado da su mensaje, no el del grifo) | En el navegador contra la app corriendo: alta → sesión → `/dashboard`, cuenta creada. El duplicado sigue dando su propio mensaje y no el del grifo. | ✅ |
| CA-4 | `src/app/(auth)/actions.ts` + `registerIfOpen` (`src/lib/registration/service.ts`); pantalla en `src/app/(auth)/register/page.tsx` | `tests/registration-action.test.ts` › *CA-4* — **la server action invocada DIRECTAMENTE** con `FormData` a pelo: 0 filas en `users`, `signIn` sin llamar. Y `tests/registration-service.test.ts` › *CA-4*. Formulario ausente: `tests/e2e/admin-grifo.spec.ts` › *CA-6* | **Ejecutado el ataque que el CA describe**: `/register` cargada con el grifo ABIERTO (formulario pintado y confirmado presente), grifo cerrado **después** en la base, y envío del formulario ya pintado. Resultado: `users` no crece, no queda fila con ese email, no hay sesión, y quien lo intentó **lee el motivo**. Ocultar el formulario no habría bastado y no bastó: la acción rechaza. | ✅ |
| CA-5 | `countAccounts` + `registrationState` (`src/lib/registration/service.ts`) | `tests/registration-service.test.ts` › *CA-5* — con N cuentas y cupo N no entra nadie aunque el interruptor esté abierto; con N−1 el alta funciona y **deja cerrado para la siguiente**; sin cupo no hay tope | Mismo ataque con el **cupo**: formulario pintado con una plaza libre, aforo llenado después, envío → no entra nadie. Frontera medida en vivo: con N−1 cuentas y cupo N el alta **sí** funciona y deja el registro cerrado para la siguiente, con `data-motivo="capacity"`. | ✅ |
| CA-6 | `src/app/(auth)/register/page.tsx` y `src/lib/registration/messages.ts` (`REGISTRO_CERRADO_MOTIVO` / `_QUE_HACER`, uno por motivo) | `tests/e2e/admin-grifo.spec.ts` › *CA-6* — cerrado a mano y cerrado por cupo en la misma ejecución: **dos textos distintos**, `data-motivo` correcto, todas las respuestas de `/register` con estado **200**, URL intacta y sin rastro de error de Next. Capturas `_qa/SPEC-037/ca6-*.png` | Los dos motivos en la misma sesión de navegador: textos **distintos** y ambos explicativos (>40 car.), `data-motivo` correcto en cada uno, **todas las respuestas de `/register` con estado 200**, URL intacta, sin rastro de «application error», «internal server error», «unhandled» ni «404», y con salida ofrecida (`/login` y `/legal`). Además el **pie legal de SPEC-035 sigue en esta pantalla nueva**: descargo, autoría y los tres enlaces legales. | ✅ |
| CA-7 | `resolveRegistrationState` se lee en la petición (sin memoización ni `revalidate`) + `export const dynamic = 'force-dynamic'` en `/register` y `/admin` | `tests/e2e/admin-grifo.spec.ts` › *CA-7* (cerrar → la visita siguiente lo ve cerrado; reabrir → la siguiente lo ve abierto, con la app corriendo sin reiniciar) y › *CA-21* (lo mismo, pero movido desde la pantalla) | Verificado en el **mismo proceso**, sin reiniciar ni reconstruir: abierto→formulario, cerrado→la visita siguiente ya lo ve, reabierto→la siguiente ya lo ve, **y otra vuelta más** para descartar un acierto de caché. `next build` confirma `/register` y `/admin` como **ƒ (dynamic)**. Ni una variable de entorno nueva: `.env.example` intacto. | ✅ |
| CA-8 | Sin código propio: el grifo solo se consulta en el camino de alta | `tests/e2e/admin-grifo.spec.ts` › *CA-8* — con el registro cerrado, un usuario ya registrado inicia sesión, abre Vigiladas y Avisos y usa la recuperación de contraseña | Con el grifo cerrado a mano: login de una cuenta previa, `/vigiladas`, `/avisos` y `/dashboard` enteras, y recuperación de contraseña que **entrega su correo** (leído en el buzón del arnés). Ni una de esas puertas menciona el cierre. | ✅ |
| CA-9 | `countAccounts` cuenta **cuentas vivas** (`src/lib/registration/service.ts`) | `tests/registration-service.test.ts` › *CA-9* — con el cupo lleno, un borrado **real** por `deleteMyAccount` (SPEC-036) reabre el registro y el alta siguiente funciona | Con el aforo exactamente lleno y `/register` sin formulario, una persona borra su cuenta por el **flujo real de `/cuenta`** (contraseña + confirmar → `/cuenta-borrada`). Acto seguido `/register` **vuelve a pintar el formulario** y el alta siguiente funciona. | ✅ |
| CA-10 | `src/app/admin/page.tsx` (`requireSectionUser('operacion')`) — la sección del catálogo de SPEC-034, sin mecanismo propio ni variable de entorno | `tests/e2e/admin-grifo.spec.ts` › *CA-10/CA-24* — (a) sin sesión → `/login`; (b) `tester` y (c) `completo` rebotan al panel y **no reciben ninguno de los rótulos ni contadores** de la pantalla; (d) `admin` la obtiene entera. Captura `_qa/SPEC-037/ca10-ca24-pantalla-de-operacion.png` | Los cuatro casos en el navegador: (a) sin sesión → `/login`; (b) `tester` y (c) `completo` → `/dashboard?sin-acceso=operacion`, y **ninguno de los ocho rótulos** de la pantalla llega — comprobado también en el **HTML crudo**, donde no aparece ni `ops-bloque`, ni `ops-cifra`, ni `grifo-form`, ni el número de cuentas; (d) `admin` la obtiene entera. La respuesta del rebote es **200**, no un error. | ✅ |
| CA-11 | `src/app/admin/actions.ts` (`sectionUserOrNull('operacion')` como primera línea) | `tests/admin-actions-role.test.ts` — `tester`, `completo`, sin sesión y con un rol inventado: **la fila de ajustes no se mueve** (valores, `updated_at` y `updated_by` idénticos). Más el test que enumera las actions del directorio y exige que la lista cubierta sea exactamente esa | **Ejecutado el bypass**: `/admin` cargada como `admin` con su formulario vivo, rol degradado a `completo` **en la base** con la pantalla ya en el navegador, y envío de la acción. La fila de ajustes queda **idéntica**: `open_manually`, `capacity`, `updated_by` y **`updated_at` sin avanzar** — la acción no escribió nada. | ✅ |
| CA-12 | Sin código propio: el rol se relee en la frontera de Node en cada petición (ADR-021 pto. 3-4) | `tests/e2e/admin-grifo.spec.ts` › *CA-12* — un `admin` **dentro** de `/admin` pasa a `completo` en la base; al recargar, **con la misma cookie**, rebota al panel y pierde el enlace. Y al revés | Con la **misma cookie**: degradado → `/admin` rebota y el enlace desaparece del menú en la petición siguiente; promovido → recupera pantalla y enlace. Sin cerrar sesión y sin redespliegue. | ✅ |
| CA-13 | `src/lib/ops/snapshot.ts` (`readOperationSnapshot`) y `countUniverseSymbols` en `src/lib/market/refresh.ts` | `tests/ops-snapshot.test.ts` › *CA-13* — los cuatro números exactos sobre una base sembrada, los símbolos sin precio **con su `QuoteFailureReason` y su texto**, y el test que exige `countUniverseSymbols(db) === (await symbolUniverse(db)).length` en cuatro escenarios. En el navegador: `tests/e2e/admin-grifo.spec.ts` › *CA-13* compara la pantalla contra `SELECT count(*)` | Los cuatro números comparados contra `SELECT count(*)` en la misma base (6/2/3/2), y los sin-precio salen **agrupados por motivo** con su `QuoteFailureReason` en el DOM (`mercado_no_cubierto`, `simbolo_desconocido`) y su texto en castellano. Repetido **con volumen** (11.507 cuentas): el contador sigue exacto. | ✅ |
| CA-14 | `src/lib/ops/cron-runs.ts` (`openCronRun`/`closeCronRun`) y `src/lib/triggers/cycle.ts` | `tests/ops-cron-runs.test.ts` › *CA-14* — una fila con **todos** los contadores derivados del `CycleResult` devuelto, `started_at < finished_at`, y un proveedor «fisgón» que comprueba que **durante** el ciclo la fila ya existe y está sin cerrar | **Ciclo real disparado contra el endpoint** con el secreto correcto: exactamente **una** fila nueva, `started_at ≤ finished_at`, desenlace `success`, y los siete contadores comparados **uno a uno contra el `CycleResult` que devolvió la respuesta HTTP**. | ✅ |
| CA-15 | `failCronRun` + `try/catch` que **relanza** en `runCronCycle` | `tests/ops-cron-runs.test.ts` › *CA-15* — la ingesta revienta al persistir (`NOT NULL` de `quotes.price`, por detrás de la defensa en profundidad de SPEC-020 CA-9): fila con `outcome = 'failure'`, error registrado, contadores sin escribir, **y la excepción sube** | `tests/ops-cron-runs.test.ts` provoca el fallo **donde se provocaría en producción** (violación del `NOT NULL` de `quotes.price` dentro de la ingesta, por detrás de la defensa de SPEC-020 CA-9): fila con `outcome=failure`, error registrado, contadores sin escribir y **la excepción sube**. Lo entregado escribe `finished_at` **y** desenlace de fallo — el CA admite «o», así que cumple; y la pantalla sabe leer también el `finished_at` nulo, verificado aparte. | ✅ |
| CA-16 | `runCronCycle` escribe la fila pase lo que pase | `tests/ops-cron-runs.test.ts` › *CA-16* — universo vacío (fila con `requested/updated/skipped = 0` y éxito) y dos ciclos idénticos seguidos (dos filas, las dos con éxito) | Verificado **en vivo con universo vacío**: el ciclo responde 200 y deja su fila con `requested/updated/skipped = 0` y desenlace de éxito. Es el caso que la derivación rechazada no podía ver, y se ve. | ✅ |
| CA-17 | `authorizeCron` sigue rechazando **antes** de abrir la fila | `tests/ops-cron-runs.test.ts` › *CA-17* — 401 con el cuerpo de siempre y `cron_runs` vacía; y 25 sondeos seguidos que no dejan ni una fila | Contra el endpoint real: `Bearer` incorrecto → **401** con el cuerpo `{"error":"unauthorized"}` de siempre y `cron_runs` **sin una sola fila**; **10 sondeos seguidos** tampoco dejan ninguna. La fila se abre después de `authorizeCron`, comprobado en el orden de sentencias. | ✅ |
| CA-18 | `leerUltimoCiclo` en `src/lib/ops/snapshot.ts` (`ORDER BY started_at DESC LIMIT 1`) y el bloque «El ciclo diario» de `src/app/admin/page.tsx` | `tests/ops-snapshot.test.ts` › *CA-18* (sin filas → `null`; con tres de fechas distintas → la más reciente con sus contadores; `finishedAt` nulo se lee como tal) y `tests/e2e/admin-grifo.spec.ts` › *CA-18* (**«El ciclo no ha corrido nunca»** explícito, luego la más reciente, luego «No terminó»). Capturas `_qa/SPEC-037/ca18-*.png` | En el navegador: sin filas dice **«El ciclo no ha corrido nunca»** y no pinta ninguna fecha ni cero ambiguo; con tres filas de fechas distintas enseña **la más reciente** (44/41/3, 17 ago 2026) y no otra; y con la última sin `finished_at`, «No terminó» y «empezó y no volvió». El residual **F-SPEC-037-4 se declara en la propia pantalla**. | ✅ |
| CA-19 | `src/lib/ops/cron-runs.ts` — tres importaciones, ninguna de notificación | `tests/ops-cron-runs.test.ts` › *CA-19* — un ciclo que falla no deja **ningún** envío en `FakeNotificationSender` ni **ninguna** fila en `notifications`; un ciclo que sí avisa solo avisa de zonas y a su dueño; y un test que lee las **importaciones** del módulo y prohíbe `notifications`, `sender`, `resend`, `mail` y `fetch(` | Verificado **por mi cuenta y por tres vías**, sin fiarme del test: (1) grafo de importaciones de `cron-runs.ts` y `snapshot.ts` leído a mano — ninguna toca `notifications`, `sender`, `resend`, `mail`, y `grep` sobre el diff completo de `src/` no añade **ni un `fetch(`, ni una URL, ni un webhook**; (2) `insert(notifications)` solo existe en `src/lib/notifications/service.ts`, el camino de avisos de zona de siempre; (3) **empíricamente**: tras todo el recorrido de verificación —ciclos disparados incluidos— `notifications` sigue con **0 filas** y el buzón de correo del arnés contiene **un solo mensaje**, la recuperación de contraseña que un usuario pidió, dirigida a él. Ningún envío al operador. | ✅ |
| CA-20 | `runCronCycle` devuelve el mismo `body` de antes; el registro es una escritura aparte | `tests/ops-cron-runs.test.ts` › *CA-20* — las claves del cuerpo son exactamente `refresh` + `triggers`, el contenido es el de siempre y no aparece nada de `cron_runs`. Y `tests/cron-refresh.test.ts`, `tests/triggers-cycle.test.ts`, `tests/notifications-cycle.test.ts` siguen verdes **sin cambiar una sola expectativa** | Endpoint real invocado: **200** y cuerpo con las claves del `CycleResult` de siempre (`refresh`, `triggers` y `notifications` cuando hay sender — la misma condicional que ya existía antes de esta spec), `notifications` conservando su forma `{entries, digests}`, y **ni una mención de `cron_runs`** en la respuesta. `tests/cron-refresh.test.ts`, `triggers-cycle` y `notifications-cycle` verdes sin cambiar expectativas. | ✅ |
| CA-21 | `src/app/admin/gate-form.tsx` + `src/app/admin/actions.ts` + `saveRegistrationSettings` (`INSERT … ON CONFLICT DO UPDATE`, `updated_by` = **id**) | `tests/admin-actions-role.test.ts` › *CA-21* (fija cupo, lo retira, y rechaza `-1`, `2,5`, `3.5`, `cincuenta`, `1e3` **sin modificar nada**), `tests/registration-service.test.ts` › *CA-21* (`updated_at`/`updated_by`, y la fila se recompone si faltara) y `tests/e2e/admin-grifo.spec.ts` › *CA-21* (dos clics cierran; la pantalla refleja el estado resultante; `/register` lo ve). Capturas `_qa/SPEC-037/ca21-*.png` | Todo en el navegador: dos clics cierran; la pantalla enseña el estado resultante con su motivo; `updated_by` = **id** del operador (nunca el email) y `updated_at` avanza; se fija 120, se **retira** el cupo («sin cupo» en pantalla). Cupos inválidos rechazados **sin mover nada** —`-1`, `2,5`, `3.5`, `cincuenta`, `1e3`, y dos que añadí yo: `" 7 7"` y el dígito árabe `"٣"`—, con `updated_at` congelado en los siete casos y su mensaje en pantalla. `capacity = 0` se **acepta** y cierra por **aforo**, no a mano. | ✅ |
| CA-22 | `src/lib/ops/snapshot.ts` no devuelve ningún email, ticker ni fila de usuario; `updated_by` guarda el id y no llega a la pantalla | `tests/ops-snapshot.test.ts` › *CA-22* (el snapshot serializado no contiene `@`, ni el ticker sembrado, ni el id del operador) y `tests/e2e/admin-grifo.spec.ts` › *CA-22* (el `main` no casa con ninguna dirección de correo ni con ningún UUID, y no hay tabla). Captura `_qa/SPEC-037/ca22-sin-datos-de-nadie.png` | Mirado por mí en el cuerpo servido, no solo en el test: sobre una base con usuarios, vigiladas, cartera y `updated_by` poblado, ni el texto ni el HTML del `main` contienen **ninguna dirección de correo** (ni la del propio operador), **ningún ticker** de nadie (`ZZA/ZZB/ZZC` ausentes de toda la página) y **ningún UUID**; no hay tabla de filas de usuario. El `updated_by` se guarda pero **no viaja**. | ✅ |
| CA-23 | `readOperationSnapshot`: seis consultas fijas, todas agregadas salvo el `LIMIT 1` del último ciclo | `tests/ops-snapshot.test.ts` › *CA-23* — un doble que **cuenta las consultas reales** hacia Postgres (parchea `client.query` de PGlite): vacío, base pequeña y **500 cuentas + 5.000 vigiladas** dan el MISMO número, y el doble se autocomprueba (`> 0`) para que el verde no pueda ser «no vio nada» | **Medido con volumen de verdad y contando las sentencias reales**: `log_statement=all` en Postgres y recuento de lo que ejecutan los backends de la app al componer `/admin`. **10 sentencias con 5.507 cuentas / 10.002 vigiladas y las MISMAS 10 con 11.507 cuentas / 130.002 vigiladas** — las siete de la pantalla son cuatro `count(*)` (una de ellas el `UNION` agregado del universo), un `group by` acotado por los motivos del dominio, y tres lecturas de **una fila** (`limit 1`); las tres restantes son el marco de sesión/menú que llevan todas las páginas autenticadas. **Latencia: 53 ms → 96 ms**, muy por debajo de los 5 s de CE-7, con el volumen multiplicado por trece. Salvedad **no bloqueante** anotada abajo sobre la siembra del test unitario. | ✅ |
| CA-24 | `src/app/app-nav.tsx` — `canSee(role, 'operacion')`, la misma llamada que decide Cartera | `tests/e2e/admin-grifo.spec.ts` › *CA-10/CA-24* (el `admin` tiene su enlace y **las otras cuatro secciones intactas**; `tester` y `completo`, cero) y `tests/e2e/roles.spec.ts` › *CA-5/CA-9* **re-encuadrada** (ver Salvedades) | Menú comparado rol a rol en vivo: `tester` y `completo` **cero** enlaces a `/admin` y ni la palabra «Operación»; `admin` **uno**, y Panel/Cartera/Vigiladas/Avisos **exactamente igual** para él. La decisión es la misma `canSee(role, "operacion")` que gobierna la ruta, así que el menú no puede ofrecer lo que la ruta niega. | ✅ |
| CA-25 | — | Suite completa: `npm test` (**75 ficheros / 1.034 casos**, exit 0) y `npm run test:e2e` (**139 casos**, exit 0), incluidos los de registro de SPEC-001 (`tests/e2e/auth.spec.ts`) y los de SPEC-034 (`tests/e2e/roles.spec.ts`, `tests/section-visibility.test.ts`, `tests/session-role.test.ts`). Geometría de las dos pantallas nuevas a 390/640/700/760/1280 px en `tests/e2e/admin-responsive.spec.ts` | Los seis gates ejecutados por mí: `typecheck`, `lint`, `test` (**75 ficheros / 1.034 casos**), `test:e2e` (**139 casos**), `build` y `db:scan`, todos exit 0. **Geometría medida por mí** a 390/640/700/760/1280 px en `/admin` y en la pantalla de registro cerrado: **desborde horizontal 0 px en los diez casos**, los tres bloques `display: grid` a los cinco anchos, hueco caja−contenido = el `padding` (38–42 px) en las quince medidas, y ningún bloque se sale por la derecha. Además: los PNG de `_qa/` de otras specs **no están pisados** en la rama. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-19 — 25/25 CA cerrados.**

Verificado en contexto aislado, sin leer el relato del implementador y partiendo de que
ningún CA estaba cumplido. Los seis gates en verde (`typecheck`, `lint`, `test` 75/1.034,
`test:e2e` 139, `build`, `db:scan`) y, **por encima de ellos, un arnés propio**: Postgres
efímero y `next start` levantados por este rol, con `RESEND_API_KEY` **vaciada a propósito**
para que ninguna comprobación pudiera enviar correo real, y cinco pasadas de Playwright
escritas aquí —no las del implementador— contra la app corriendo. Ese arnés no ha dejado
nada en el árbol: `git status` limpio y HEAD en `9de6325`.

**Lo que se atacó de verdad, y aguantó.** Los dos agujeros clásicos de esta forma de spec
son «la pantalla se esconde pero la acción sigue viva» y «el guard se evalúa una vez». Los
dos se ejercitaron con la página **ya pintada**: `/register` cargada con el grifo abierto y
enviada después de cerrarlo (no se crea cuenta, ni con el interruptor ni con el aforo), y
`/admin` cargada como `admin` y su acción enviada tras **degradar el rol en la base** (la
fila de ajustes no se mueve, `updated_at` incluido). También se comprobó que el rebote de un
no-`admin` no filtra la pantalla **ni en el HTML crudo**.

**La frontera de «no alerta» se comprobó de tres formas y ninguna es «hay un test que lo
dice»**: el grafo de importaciones leído a mano, un `grep` sobre el diff entero de `src/`
que no encuentra ni un `fetch(` ni una URL ni un webhook nuevos, y la prueba empírica —tras
ciclos reales disparados contra el endpoint, `notifications` sigue en **cero filas** y el
buzón contiene **un solo correo**: la recuperación de contraseña que un usuario pidió, para
él—. `insert(notifications)` sigue existiendo en un solo sitio, el camino de avisos de zona
de siempre.

**CE-6 y CE-7, comprobados como los enuncia la épica.** El registro se cierra y se reabre
**sin desplegar y sin reiniciar** —la app llevaba corriendo desde el principio, y se hizo dos
veces el ciclo cerrar/abrir para descartar un acierto de caché—, se cierra **solo** al llegar
al cupo, y quien llega lee **por qué** con **200** y dos textos distintos. La pantalla
responde en **96 ms con 11.507 cuentas y 130.002 filas de vigilancia**, con el **mismo número
de sentencias** que con trece veces menos datos.

**Las cuatro discrepancias señaladas, juzgadas.** (1) La ubicación de `cron-runs.ts` es solo
ubicación. (2) `countUniverseSymbols` es una **segunda implementación, no una segunda
definición**: vive pegada a `symbolUniverse`, está atada a ella por un test de igualdad y las
claves foráneas hacen imposible la única divergencia estructural que quedaba; se acepta, con
un follow-up menor. (3) Escribir `finished_at` **y** desenlace de fallo cumple el CA, que
admitía «o», y no se buscó ningún `finished_at` nulo tras un fallo. (4) `capacity = 0` es
coherente con CA-21 y con la función pura, se comporta como «cerrado por aforo» —verificado
en el navegador— y **ya está escrito** en el glosario; queda como decisión visible, no como
regla tácita.

**Las dos guardias que cambiaron no se han aflojado.** `tests/e2e/roles.spec.ts` exigía 0
enlaces a `/admin` para `completo` **y** para `admin` porque la ruta no existía; ahora exige
**0 para `completo` y 1 para `admin`**. La mitad con valor de seguridad —que un `completo` no
lo vea— sigue **idéntica**; lo que se añade es la comprobación por el otro lado. La
calibración de `tests/destructive-sql-scan.test.ts` (10→11) es el mantenimiento previsto de
esa guardia: `db:scan` sigue marcando **exactamente `0001` y `0007`** y la migración nueva no
está desbloqueada porque no marca nada.

**Las cuatro filas del glosario dicen la verdad.** Se contrastaron contra el código y contra
la app corriendo: la unicidad por `CHECK "id" = 1`, la semilla abierta con cupo 50 y la
respuesta-semilla si la fila faltara, el manual mandando sobre el cupo, la frontera estricta
`N == capacity` = lleno, `capacity = 0` como «cerrado por aforo», el borrado liberando plaza,
`updated_by` guardando el id y nunca el email, el rol releído en cada petición, la lectura de
**solo la última fila** de `cron_runs`, el 401 que no escribe, y la ausencia total de purga.
Ninguna afirmación resultó falsa.

**Residuales.** Los seis declarados (`F-SPEC-037-1` a `-6`) siguen vivos y **ninguno bloquea
publicar**; el único bloqueante del *merge* es el de siempre, `F-SPEC-037-1` (abrir la PR
migra producción), que es decisión del humano. `F-SPEC-037-4` no se contó como
incumplimiento: está declarado, aceptado, y la pantalla lo dice en voz alta en vez de
disimularlo. Se añaden abajo cuatro follow-ups de higiene, todos **no bloqueantes**.

Spec a `hecho`.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-037/. Informe HTML opcional: _qa/SPEC-037/informe.html -->

| CA | Captura |
|---|---|
| CA-6 | `_qa/SPEC-037/ca6-registro-cerrado-a-mano.png`, `_qa/SPEC-037/ca6-registro-cerrado-por-cupo.png` |
| CA-10 / CA-24 | `_qa/SPEC-037/ca10-ca24-pantalla-de-operacion.png` |
| CA-13 | `_qa/SPEC-037/ca13-contadores.png` |
| CA-18 | `_qa/SPEC-037/ca18-ciclo-nunca-ha-corrido.png`, `_qa/SPEC-037/ca18-ultimo-ciclo.png` |
| CA-21 | `_qa/SPEC-037/ca21-grifo-cerrado-desde-la-pantalla.png`, `_qa/SPEC-037/ca21-cupo-invalido-rechazado.png` |
| CA-22 | `_qa/SPEC-037/ca22-sin-datos-de-nadie.png` |
| CA-25 | `_qa/SPEC-037/ancho-{390,640,700,760,1280}-admin.png` y `…-registro-cerrado.png` |

**Medidas tomadas por el verificador** (arnés propio, `next start` sobre Postgres efímero;
`desbordeH` = `scrollWidth − clientWidth`, `caja/contenido` en px):

| Ancho | `/admin` desborde | `grifo` | `contadores` | `ultimo-ciclo` | registro cerrado |
|---|---|---|---|---|---|
| 390 | **0 px** | 421 / 383 | 400 / 362 | 621 / 583 | **0 px** · 280 / 222 |
| 640 | **0 px** | 374 / 336 | 241 / 203 | 391 / 353 | **0 px** · 280 / 222 |
| 700 | **0 px** | 374 / 336 | 245 / 207 | 391 / 353 | **0 px** · 280 / 222 |
| 760 | **0 px** | 378 / 336 | 254 / 212 | 395 / 353 | **0 px** · 280 / 222 |
| 1280 | **0 px** | 382 / 340 | 199 / 157 | 307 / 265 | **0 px** · 280 / 222 |

Los cuatro contenedores computan `display: grid` a los cinco anchos y la diferencia
caja−contenido es **exactamente el `padding` (38–42 px)** en las quince medidas de `/admin` y
en las cinco de la pantalla de registro cerrado: **no hay hueco muerto en ninguna**, que es lo
que el defecto de SPEC-035 sí tenía. Ningún bloque rebasa el borde derecho de la ventana a
ningún ancho. Las cifras coinciden con las que imprimió el implementador salvo en
`contadores`, donde las mías son algo mayores porque mi base tenía **dos motivos de "sin
precio"** que añaden su lista.

**Rendimiento de CE-7, medido con `log_statement = 'all'`** (sentencias reales contra
Postgres al componer `/admin`, descartando el backend del propio medidor):

| Base | Sentencias por petición | Latencia |
|---|---|---|
| 5.507 cuentas / 10.002 vigiladas | **10** | 53 ms |
| 11.507 cuentas / **130.002** vigiladas | **10** | 96 ms |

Siete son de la pantalla —`count(*)` de cuentas, de vigiladas y del `UNION` del universo, un
`group by` acotado por los motivos del dominio, y tres lecturas de **una** fila (`limit 1`)— y
tres son el marco de sesión y menú que llevan todas las páginas autenticadas. **Ninguna crece
con el volumen**, ni en número ni en filas traídas.

**Medidas de `/admin` a los cinco anchos** (impresas por el propio test, `desbordeH` = `scrollWidth − clientWidth`):

| Ancho | Desborde H | `grifo` (caja / contenido) | `contadores` | `ultimo-ciclo` |
|---|---|---|---|---|
| 390 | **0 px** | 421 / 383 | 330 / 292 | 621 / 583 |
| 640 | **0 px** | 374 / 336 | 213 / 175 | 391 / 353 |
| 700 | **0 px** | 374 / 336 | 217 / 179 | 391 / 353 |
| 760 | **0 px** | 378 / 336 | 226 / 184 | 395 / 353 |
| 1280 | **0 px** | 382 / 340 | 171 / 129 | 307 / 265 |

Los tres bloques computan `display: grid` a los cinco anchos; la diferencia caja−contenido
es **exactamente el `padding` (38-42 px)** en las quince medidas, así que no hay hueco
muerto en ninguna. La pantalla **crece** al estrechar —las cuatro cifras pasan de una fila
a dos y luego a cuatro, y los datos del ciclo de cuatro columnas a una— y el desborde
horizontal es **cero** en los cinco anchos, que es lo que el defecto de SPEC-035 no tenía.
La pantalla de registro cerrado se mide en el mismo fichero, con los mismos invariantes.

## Salvedades / follow-ups

Los seis residuales que la spec ya declaraba (**F-SPEC-037-1** a **F-SPEC-037-6**) siguen
vivos tal cual: la PR migra producción, no hay variable nueva que aprovisionar, el cupo
puede rebasarse en uno bajo concurrencia, el ciclo que Vercel nunca invoca no deja fila,
nadie avisa al llegar al tope, y `cron_runs` crece sin purga. **No se ha intentado cerrar
F-SPEC-037-4**: cerrarlo *es* la alerta, y la alerta está fuera de alcance. La pantalla lo
dice en voz alta en vez de disimularlo (`data-testid="ciclo-residual"`).

Nuevos, de la implementación:

- **F-SPEC-037-7 (documental, para sdd-arquitecto — ADR-025 pto. 1).** La §Entidades pide
  añadir a `docs/fundacion/dominio.md` los términos **Grifo del registro**, **Cupo**,
  **Operador** y **Ejecución del ciclo**. **No están escritos** y este rol no los escribe:
  ADR-025 (aprobado el 2026-08-19, posterior a la aprobación de esta spec) da la pluma del
  glosario al arquitecto **en el gate**. Los rótulos de la UI se han elegido con esos cuatro
  conceptos en la cabeza («Operación», «Cupo de cuentas», «El ciclo diario»), pero la fila
  del glosario está pendiente. Destino: **sdd-arquitecto**, antes del GREEN.
- **F-SPEC-037-8 (guardia re-encuadrada, hecho).** `tests/e2e/roles.spec.ts` › *CA-5/CA-9*
  exigía **0** enlaces a `/admin` para `completo` **y** para `admin` — «que nadie lo
  adelante aquí», porque la ruta no existía. Ahora exige **0 para `completo` y 1 para
  `admin`**: la misma propiedad de SPEC-034 (*el menú no ofrece lo que la ruta niega*)
  comprobada en los dos sentidos en vez de en uno. Que `/admin` responda de verdad y que
  quien no es `admin` no la alcance ni tecleando la URL es de esta spec y vive en
  `tests/e2e/admin-grifo.spec.ts` › *CA-10/CA-24*. **No se ha aflojado nada**: es el mismo
  movimiento que se hizo con el enlace a `/cuenta` entre SPEC-035 y SPEC-036.
- **F-SPEC-037-9 (higiene del arnés e2e, asumido).** La base del e2e es una y la comparten
  todas las specs, que registran del orden de cuarenta y tantas cuentas — peligrosamente
  cerca del **cupo semilla de 50**. Se ha resuelto sin tocar `tests/e2e/server.mjs` ni
  relajar la semilla: el fichero se llama `admin-grifo.spec.ts` para que Playwright lo
  ordene el **primero** del directorio (así puede verificar la fila recién sembrada, CA-1) y
  tanto él como `admin-responsive.spec.ts` dejan el grifo **abierto y sin tope** al terminar.
  La dependencia del orden alfabético está documentada en la cabecera de `tests/e2e/grifo.ts`
  y en la de los dos ficheros. Si algún día la suite creciera y una spec anterior apareciera,
  el síntoma sería «no aparece el formulario de alta» — que no se parece a la causa.
- **F-SPEC-037-10 (calibración, hecho).** `tests/destructive-sql-scan.test.ts` (SPEC-032
  CA-8) fija el número de migraciones del árbol: **10 → 11**, con su comentario. Es
  mantenimiento previsto de esa guardia, igual que hizo SPEC-034 al pasar de 9 a 10. El
  veredicto no cambia: `db:scan` sigue marcando **exactamente `0001` y `0007`**, y la
  migración nueva **no está desbloqueada** porque no marca nada.
- **F-SPEC-037-11 (higiene, futuro).** `updated_by` guarda el **id** del operador y nunca
  se enseña (CA-22). Con un solo operador es información inútil pero honesta; el día que
  haya dos, harán falta o un nombre que enseñar sin romper RN-01, o el historial de
  **F-ADR-023-1**. No se ha inventado ninguna de las dos cosas aquí.

Del verificador (**ninguno bloquea publicar ni el GREEN**):

- **F-SPEC-037-12 (calidad de test, para sdd-implementador).** El test de CA-23
  (`tests/ops-snapshot.test.ts`) **no siembra las 5.000 vigiladas que dice sembrar**: genera
  5.000 pares con `muchos[i % 500]` y `simbolos[i % 500]`, y como los dos índices usan el
  **mismo** módulo, el `Map` que deduplica los colapsa a **500** pares distintos. El comentario
  «se siembran 500×10 pares distintos» es falso. La **propiedad** del CA no está en duda —la he
  medido yo a **130.002** filas de vigilancia y el número de sentencias no se movió—, pero el
  test protege un orden de magnitud menos de lo que declara. Arreglo: `simbolos[i % 10]` (o
  cualquier índice independiente del de usuario) y corregir el comentario.
- **F-SPEC-037-13 (documental, menor).** Dos comentarios apuntan a `tests/e2e/admin.spec.ts`,
  que **no existe**: el fichero es `tests/e2e/admin-grifo.spec.ts`, renombrado a propósito por
  el orden alfabético que explica F-SPEC-037-9. Están en `tests/e2e/roles.spec.ts` (línea 112) y
  `tests/ops-snapshot.test.ts` (línea 20). Quien siga el puntero no encuentra nada.
- **F-SPEC-037-14 (calidad de test, menor).** El test que ata `countUniverseSymbols` a
  `symbolUniverse` recorre cuatro escenarios que **solo hacen crecer** el universo y nunca
  compara los dos números con el **universo vacío**, que es donde una de las dos funciones tiene
  un `return []` temprano y la otra no. Añadir esa comparación cuesta una línea y cierra el
  único hueco de la atadura.
- **F-SPEC-037-15 (ledger, ya resuelto).** **F-SPEC-037-7 está obsoleto**: las cuatro filas del
  glosario —*Grifo del registro*, *Cupo*, *Operador*, *Ejecución del ciclo*— **ya existen** en
  `docs/fundacion/dominio.md` (las escribió el arquitecto en `9de6325`), y este rol ha
  verificado que **lo que dicen es cierto** respecto al código. No queda nada pendiente ahí.

Nota sobre la evidencia visual: la suite e2e regenera los PNG de **todas** las specs al
correr. Se han restaurado todos a su estado commiteado —incluidos los de SPEC-037— para no
ensuciar la rama; los estados que retratan son los mismos que este rol ha verificado por su
cuenta, y las medidas propias quedan en la tabla de arriba. En la rama, `git diff
origin/main...HEAD -- _qa` toca **solo** `_qa/SPEC-037/`: no se ha pisado ningún PNG de otra
spec.

Cosas que vi y **no eran mías**:

- `src/app/cuenta/page.tsx` sigue rotulando el rol como «**Tipo de cuenta**» cuando el
  dominio dice «**Rol de cuenta**» (**F-SPEC-036-9**). ADR-025 pto. 3 dice que ese retoque
  entra por arrastre en una spec viva que toque esa superficie: **SPEC-037 no toca
  `/cuenta`**, así que no lo he arrastrado. Sigue esperando destino del arquitecto.
- `symbolUniverse` filtra el universo con un `inArray` contra `symbols` que las claves
  foráneas ya garantizan. No molesta y no es de esta spec; queda anotado porque
  `countUniverseSymbols` **no** replica ese filtro (y un test exige que los dos números
  coincidan, así que la diferencia está vigilada).

## Cómo retomar (handoff)

**Estado: implementación completa, los 25 CA con test.** Los seis gates en verde:
`typecheck`, `lint`, `test` (75 ficheros / 1.034 casos), `test:e2e` (139 casos),
`build` y `db:scan`. La spec queda en `en-revision`; el veredicto es del
verificador y las columnas *Verif.* / *Estado* de la matriz están sin tocar a propósito.

**Dónde está cada cosa**

- El grifo: `src/lib/registration/{gate,service,messages}.ts`. `gate.ts` es puro y no
  importa nada — si hay que tocar la decisión, se toca ahí y se recorre la matriz del test.
- La pantalla: `src/app/admin/{page,actions,gate-form}.tsx` y `src/lib/ops/snapshot.ts`.
- El registro del ciclo: `src/lib/ops/cron-runs.ts` y el `try/catch` de
  `src/lib/triggers/cycle.ts`.
- La migración: `drizzle/0010_registration_gate_and_cron_runs.sql`.

**Tres cosas que conviene saber antes de tocar nada**

1. **El e2e depende del orden de los ficheros** (F-SPEC-037-9). Si se renombra
   `admin-grifo.spec.ts`, CA-1 deja de poder ver la semilla y —peor— la suite entera puede
   quedarse sin plazas a mitad. Leer la cabecera de `tests/e2e/grifo.ts` antes.
2. **`src/app/admin/actions.ts` es `'use server'`**, así que solo puede exportar funciones
   async: los textos viven en `src/lib/registration/messages.ts`. Meter una constante ahí
   rompe el `build`, no el `typecheck`.
3. **La frontera de CA-19 está escrita en las importaciones** de `cron-runs.ts` y hay un
   test que las lee. Si algún día entra la alerta al operador, entra con su spec y cambiando
   ese test a la vez — no colándola por debajo.

**Lo que falta para cerrar**: el veredicto del verificador y la fila del glosario
(**F-SPEC-037-7**), que es del arquitecto.
