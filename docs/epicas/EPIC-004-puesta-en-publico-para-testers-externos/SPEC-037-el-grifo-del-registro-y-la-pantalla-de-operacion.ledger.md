---
id: SPEC-037
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-037 El grifo del registro y la pantalla de operacion

## Resumen
- Fase: en-revision (implementación entregada; pendiente del verificador)
- Rama: `ft/SPEC-037-grifo-del-registro-y-pantalla-de-operacion`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/db/schema.ts` (`registrationSettings` con PK entera + `CHECK id = 1`; `cronRuns`) y `drizzle/0010_registration_gate_and_cron_runs.sql` (dos `CREATE TABLE` + `INSERT` de la fila semilla con `ON CONFLICT DO NOTHING`) | `tests/registration-esquema.test.ts` — columnas de las dos tablas, **la base rechaza la segunda fila con el id que sea**, semilla = `SEED_REGISTRATION_SETTINGS`, ninguna lleva `user_id`, y la migración no toca ninguna tabla anterior. Contra Postgres real: `tests/e2e/admin-grifo.spec.ts` › *CA-1* (`{openManually: true, capacity: 50}` en la base recién migrada) | | ❌ |
| CA-2 | `src/lib/registration/gate.ts` — `registrationState`, módulo sin una sola importación | `tests/registration-gate.test.ts` — matriz completa (manual × {null, >, ==, <}), **la frontera `cuentas == capacity` cerrada**, y una comprobación de que el fuente no tiene ningún `import` | | ❌ |
| CA-3 | `src/app/(auth)/actions.ts` (`registerAction` → `registerIfOpen`), `src/lib/registration/service.ts` | `tests/registration-service.test.ts` › *CA-3* (cuenta creada, rol `tester`, duplicado sigue lanzando `EmailAlreadyRegisteredError`) y `tests/registration-action.test.ts` › *CA-3* (`signIn` llamado con `redirectTo: '/dashboard'`; el duplicado da su mensaje, no el del grifo) | | ❌ |
| CA-4 | `src/app/(auth)/actions.ts` + `registerIfOpen` (`src/lib/registration/service.ts`); pantalla en `src/app/(auth)/register/page.tsx` | `tests/registration-action.test.ts` › *CA-4* — **la server action invocada DIRECTAMENTE** con `FormData` a pelo: 0 filas en `users`, `signIn` sin llamar. Y `tests/registration-service.test.ts` › *CA-4*. Formulario ausente: `tests/e2e/admin-grifo.spec.ts` › *CA-6* | | ❌ |
| CA-5 | `countAccounts` + `registrationState` (`src/lib/registration/service.ts`) | `tests/registration-service.test.ts` › *CA-5* — con N cuentas y cupo N no entra nadie aunque el interruptor esté abierto; con N−1 el alta funciona y **deja cerrado para la siguiente**; sin cupo no hay tope | | ❌ |
| CA-6 | `src/app/(auth)/register/page.tsx` y `src/lib/registration/messages.ts` (`REGISTRO_CERRADO_MOTIVO` / `_QUE_HACER`, uno por motivo) | `tests/e2e/admin-grifo.spec.ts` › *CA-6* — cerrado a mano y cerrado por cupo en la misma ejecución: **dos textos distintos**, `data-motivo` correcto, todas las respuestas de `/register` con estado **200**, URL intacta y sin rastro de error de Next. Capturas `_qa/SPEC-037/ca6-*.png` | | ❌ |
| CA-7 | `resolveRegistrationState` se lee en la petición (sin memoización ni `revalidate`) + `export const dynamic = 'force-dynamic'` en `/register` y `/admin` | `tests/e2e/admin-grifo.spec.ts` › *CA-7* (cerrar → la visita siguiente lo ve cerrado; reabrir → la siguiente lo ve abierto, con la app corriendo sin reiniciar) y › *CA-21* (lo mismo, pero movido desde la pantalla) | | ❌ |
| CA-8 | Sin código propio: el grifo solo se consulta en el camino de alta | `tests/e2e/admin-grifo.spec.ts` › *CA-8* — con el registro cerrado, un usuario ya registrado inicia sesión, abre Vigiladas y Avisos y usa la recuperación de contraseña | | ❌ |
| CA-9 | `countAccounts` cuenta **cuentas vivas** (`src/lib/registration/service.ts`) | `tests/registration-service.test.ts` › *CA-9* — con el cupo lleno, un borrado **real** por `deleteMyAccount` (SPEC-036) reabre el registro y el alta siguiente funciona | | ❌ |
| CA-10 | `src/app/admin/page.tsx` (`requireSectionUser('operacion')`) — la sección del catálogo de SPEC-034, sin mecanismo propio ni variable de entorno | `tests/e2e/admin-grifo.spec.ts` › *CA-10/CA-24* — (a) sin sesión → `/login`; (b) `tester` y (c) `completo` rebotan al panel y **no reciben ninguno de los rótulos ni contadores** de la pantalla; (d) `admin` la obtiene entera. Captura `_qa/SPEC-037/ca10-ca24-pantalla-de-operacion.png` | | ❌ |
| CA-11 | `src/app/admin/actions.ts` (`sectionUserOrNull('operacion')` como primera línea) | `tests/admin-actions-role.test.ts` — `tester`, `completo`, sin sesión y con un rol inventado: **la fila de ajustes no se mueve** (valores, `updated_at` y `updated_by` idénticos). Más el test que enumera las actions del directorio y exige que la lista cubierta sea exactamente esa | | ❌ |
| CA-12 | Sin código propio: el rol se relee en la frontera de Node en cada petición (ADR-021 pto. 3-4) | `tests/e2e/admin-grifo.spec.ts` › *CA-12* — un `admin` **dentro** de `/admin` pasa a `completo` en la base; al recargar, **con la misma cookie**, rebota al panel y pierde el enlace. Y al revés | | ❌ |
| CA-13 | `src/lib/ops/snapshot.ts` (`readOperationSnapshot`) y `countUniverseSymbols` en `src/lib/market/refresh.ts` | `tests/ops-snapshot.test.ts` › *CA-13* — los cuatro números exactos sobre una base sembrada, los símbolos sin precio **con su `QuoteFailureReason` y su texto**, y el test que exige `countUniverseSymbols(db) === (await symbolUniverse(db)).length` en cuatro escenarios. En el navegador: `tests/e2e/admin-grifo.spec.ts` › *CA-13* compara la pantalla contra `SELECT count(*)` | | ❌ |
| CA-14 | `src/lib/ops/cron-runs.ts` (`openCronRun`/`closeCronRun`) y `src/lib/triggers/cycle.ts` | `tests/ops-cron-runs.test.ts` › *CA-14* — una fila con **todos** los contadores derivados del `CycleResult` devuelto, `started_at < finished_at`, y un proveedor «fisgón» que comprueba que **durante** el ciclo la fila ya existe y está sin cerrar | | ❌ |
| CA-15 | `failCronRun` + `try/catch` que **relanza** en `runCronCycle` | `tests/ops-cron-runs.test.ts` › *CA-15* — la ingesta revienta al persistir (`NOT NULL` de `quotes.price`, por detrás de la defensa en profundidad de SPEC-020 CA-9): fila con `outcome = 'failure'`, error registrado, contadores sin escribir, **y la excepción sube** | | ❌ |
| CA-16 | `runCronCycle` escribe la fila pase lo que pase | `tests/ops-cron-runs.test.ts` › *CA-16* — universo vacío (fila con `requested/updated/skipped = 0` y éxito) y dos ciclos idénticos seguidos (dos filas, las dos con éxito) | | ❌ |
| CA-17 | `authorizeCron` sigue rechazando **antes** de abrir la fila | `tests/ops-cron-runs.test.ts` › *CA-17* — 401 con el cuerpo de siempre y `cron_runs` vacía; y 25 sondeos seguidos que no dejan ni una fila | | ❌ |
| CA-18 | `leerUltimoCiclo` en `src/lib/ops/snapshot.ts` (`ORDER BY started_at DESC LIMIT 1`) y el bloque «El ciclo diario» de `src/app/admin/page.tsx` | `tests/ops-snapshot.test.ts` › *CA-18* (sin filas → `null`; con tres de fechas distintas → la más reciente con sus contadores; `finishedAt` nulo se lee como tal) y `tests/e2e/admin-grifo.spec.ts` › *CA-18* (**«El ciclo no ha corrido nunca»** explícito, luego la más reciente, luego «No terminó»). Capturas `_qa/SPEC-037/ca18-*.png` | | ❌ |
| CA-19 | `src/lib/ops/cron-runs.ts` — tres importaciones, ninguna de notificación | `tests/ops-cron-runs.test.ts` › *CA-19* — un ciclo que falla no deja **ningún** envío en `FakeNotificationSender` ni **ninguna** fila en `notifications`; un ciclo que sí avisa solo avisa de zonas y a su dueño; y un test que lee las **importaciones** del módulo y prohíbe `notifications`, `sender`, `resend`, `mail` y `fetch(` | | ❌ |
| CA-20 | `runCronCycle` devuelve el mismo `body` de antes; el registro es una escritura aparte | `tests/ops-cron-runs.test.ts` › *CA-20* — las claves del cuerpo son exactamente `refresh` + `triggers`, el contenido es el de siempre y no aparece nada de `cron_runs`. Y `tests/cron-refresh.test.ts`, `tests/triggers-cycle.test.ts`, `tests/notifications-cycle.test.ts` siguen verdes **sin cambiar una sola expectativa** | | ❌ |
| CA-21 | `src/app/admin/gate-form.tsx` + `src/app/admin/actions.ts` + `saveRegistrationSettings` (`INSERT … ON CONFLICT DO UPDATE`, `updated_by` = **id**) | `tests/admin-actions-role.test.ts` › *CA-21* (fija cupo, lo retira, y rechaza `-1`, `2,5`, `3.5`, `cincuenta`, `1e3` **sin modificar nada**), `tests/registration-service.test.ts` › *CA-21* (`updated_at`/`updated_by`, y la fila se recompone si faltara) y `tests/e2e/admin-grifo.spec.ts` › *CA-21* (dos clics cierran; la pantalla refleja el estado resultante; `/register` lo ve). Capturas `_qa/SPEC-037/ca21-*.png` | | ❌ |
| CA-22 | `src/lib/ops/snapshot.ts` no devuelve ningún email, ticker ni fila de usuario; `updated_by` guarda el id y no llega a la pantalla | `tests/ops-snapshot.test.ts` › *CA-22* (el snapshot serializado no contiene `@`, ni el ticker sembrado, ni el id del operador) y `tests/e2e/admin-grifo.spec.ts` › *CA-22* (el `main` no casa con ninguna dirección de correo ni con ningún UUID, y no hay tabla). Captura `_qa/SPEC-037/ca22-sin-datos-de-nadie.png` | | ❌ |
| CA-23 | `readOperationSnapshot`: seis consultas fijas, todas agregadas salvo el `LIMIT 1` del último ciclo | `tests/ops-snapshot.test.ts` › *CA-23* — un doble que **cuenta las consultas reales** hacia Postgres (parchea `client.query` de PGlite): vacío, base pequeña y **500 cuentas + 5.000 vigiladas** dan el MISMO número, y el doble se autocomprueba (`> 0`) para que el verde no pueda ser «no vio nada» | | ❌ |
| CA-24 | `src/app/app-nav.tsx` — `canSee(role, 'operacion')`, la misma llamada que decide Cartera | `tests/e2e/admin-grifo.spec.ts` › *CA-10/CA-24* (el `admin` tiene su enlace y **las otras cuatro secciones intactas**; `tester` y `completo`, cero) y `tests/e2e/roles.spec.ts` › *CA-5/CA-9* **re-encuadrada** (ver Salvedades) | | ❌ |
| CA-25 | — | Suite completa: `npm test` (**75 ficheros / 1.034 casos**, exit 0) y `npm run test:e2e` (**139 casos**, exit 0), incluidos los de registro de SPEC-001 (`tests/e2e/auth.spec.ts`) y los de SPEC-034 (`tests/e2e/roles.spec.ts`, `tests/section-visibility.test.ts`, `tests/session-role.test.ts`). Geometría de las dos pantallas nuevas a 390/640/700/760/1280 px en `tests/e2e/admin-responsive.spec.ts` | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

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
