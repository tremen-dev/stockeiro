---
id: ADR-023
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
---
# ADR-023: El grifo del registro es estado de aplicación, y el ciclo diario deja constancia de cada ejecución

- Deciders: propone **sdd-arquitecto** (2026-08-19). El gate de **EPIC-004** (2026-08-19,
  Alberto Fojo) fijó **qué** hace falta —*"interruptor manual + cupo automático, y ambos se
  cambian **sin desplegar**"* (**CE-6**)— y dejó el mecanismo al arquitecto, señalando la
  disyuntiva: ajuste en base de datos frente a variable de entorno en Vercel.
  **Revisión del mismo día (gate de veredictos)**: el humano resolvió (a) que el operador se
  identifica por **rol `admin`**, no por configuración —esa parte sale de este ADR y pasa a
  **ADR-021**—, (b) que el resultado de cada ciclo del cron **se registra**, en contra de mi
  propuesta inicial de derivarlo, y (c) que el cupo semilla es **50**. Los tres veredictos
  están absorbidos abajo. Pendiente de aprobación por el humano en el gate de **SPEC-037**.
- Specs relacionadas: la origina **SPEC-037** (El grifo del registro y la pantalla de
  operación). Toca la superficie pública de **SPEC-001** (registro) y el ciclo de
  **ADR-004/ADR-005/ADR-006** (`runCronCycle`). Depende de **ADR-021** (el rol `admin` es
  quien opera) y de **ADR-022** pto. 9 (el cupo cuenta cuentas vivas). **No** toca
  **ADR-018**.

## Contexto

**Lo que CE-6 exige.** Que el registro se cierre y se reabra **sin desplegar**; que además
se cierre solo al llegar a un cupo; y que quien llegue con el registro cerrado **lea por
qué**, no un error (**R-7**: *"si el cupo se agota de madrugada, quien venga del foro se
encuentra la puerta cerrada"*).

**Por qué la variable de entorno no llega.** Es el camino más simple y el primero que se le
ocurre a cualquiera, pero cambiar una variable en Vercel **exige redespliegue** para que el
runtime la vea con garantías. La épica escribió "sin desplegar" en el criterio, y eso no es
una preferencia estética: el escenario real es el hilo del foro yendo bien un domingo por la
noche y el operador queriendo cerrar la puerta **ahora**. Un redespliegue es dos minutos y
un riesgo (el build **migra la base**, `vercel.json`), justo cuando no se quiere ninguno.

**Por qué esto no es solo una preferencia de almacenamiento.** El grifo es el primer **estado
de aplicación mutable en caliente** del proyecto. Hasta hoy todo lo que hay en la base es
dato **de usuario** (aislado por RN-01) o dato **de mercado** (compartido, ADR-002). Aparece
una tercera categoría —**estado operativo**— y a ella pertenecen tanto el grifo como el
registro de ejecuciones del ciclo.

**Lo que CE-7 exige, y lo que hoy se puede saber.** La pantalla debe responder *"si el
último ciclo del cron corrió y cuántos símbolos se quedaron sin precio"*. Materia prima
verificada en el código: `users`, `watched_symbols`, `symbolUniverse`
(`src/lib/market/refresh.ts`) y `quote_diagnostics` (**SPEC-016**). Del **ciclo** en sí **no
se persiste nada**: `runCronCycle` (`src/lib/triggers/cycle.ts`) devuelve `CycleResult`
—`refresh`, `triggers`, `notifications`— en el cuerpo de la respuesta HTTP, y ahí muere.

Mi propuesta inicial fue **derivar** el estado del ciclo de `quotes.updated_at` y
`quote_diagnostics.attempted_at`, para no adelantar la idea *"Observabilidad del ciclo
diario"* que el roadmap tiene aparcada. **El humano lo rechazó**, y con un argumento que
acepto entero: derivar deja un agujero — *"un ciclo que corre sin cambiar nada es
indistinguible de uno que no corrió"* — y ese agujero es **precisamente lo que CE-7
pregunta**. Un rótulo que dice *"último dato de mercado: 18 ago"* no responde *"¿corrió el
cron anoche?"*; solo lo insinúa. Y el precedente pesa: el defecto de cobertura de
**EPIC-FIX** pasó **semanas** sin detectarse porque el único síntoma era un `asOf` viejo,
que es exactamente la señal que yo proponía volver a usar.

## Decisión

### El grifo del registro

1. **El grifo vive en la base de datos, en una tabla propia de una sola fila**:
   `registration_settings { id, open_manually boolean not null, capacity integer,
   updated_at, updated_by }`. La unicidad de la fila se impone en el esquema (clave
   primaria constante con `CHECK`), no por convenio: dos filas de configuración es un
   defecto silencioso esperando a ocurrir. `capacity` **nullable**: `null` = sin cupo.

2. **Tabla tipada, no un almacén clave-valor genérico.** Un `app_settings(key, value text)`
   invita a que todo ajuste futuro acabe siendo una cadena sin tipo ni validación. Cuando
   haya un segundo ajuste que no sea el registro, tendrá su tabla o su columna, con su tipo.

3. **El registro está abierto si y solo si** `open_manually` es verdadero **y** (`capacity`
   es `null` **o** el número de cuentas vivas es **menor** que `capacity`). Las dos
   condiciones son independientes y la respuesta dice **cuál** de las dos falló.

4. **La decisión es una función pura**, al margen de la base y de Next —el patrón de
   `isPublicPath` (SPEC-001) e `isSessionEpochCurrent` (ADR-016 pto. 7)—: dados los ajustes
   y el número de cuentas, devuelve *abierto* o *cerrado con motivo*. Se prueba caso a caso
   sin levantar nada.

5. **La comprobación se hace en el camino de registro, no solo al pintar el formulario.**
   Ocultar el formulario y dejar la server action aceptando envíos no es cerrar el registro;
   es esconderlo. Igual que **ADR-021** pto. 7 para las secciones.

6. **Efecto inmediato, sin caché.** Los ajustes se leen en la petición. Ni memoización de
   módulo, ni `revalidate`: un grifo que tarda cinco minutos en cerrarse no es un grifo.

7. **La fila la siembra la migración** con `open_manually = true` y **`capacity = 50`**
   (veredicto del humano, 2026-08-19). Esos valores viven en **una** constante nombrada, que
   es también la respuesta si la fila faltara. Cerrar el registro por una fila ausente sería
   matar el objetivo de la épica en silencio. El 50 es **semilla, no política**: se cambia
   desde la pantalla de operación sin desplegar (pto. 6), que es justo lo que CE-6 pide.

8. **El cupo es un tope operativo, no una licencia: se comprueba, no se serializa.** Dos
   registros exactamente simultáneos en la última plaza pueden dejar el contador uno por
   encima del cupo. Se acepta **declaradamente**: el cupo protege una cuota con margen
   amplio, y bloquear la tabla `users` en cada alta para ganar una plaza exacta es pagar
   contención permanente por una precisión que a nadie le importa. Lo que **sí** se
   garantiza es que a partir de ahí no entra nadie más.

### Quién opera

9. **Quién opera **no** se decide en este ADR: se decide con el rol.** El operador es la
   cuenta con rol **`admin`** (**ADR-021** ptos. 1 y 1.a). Este ADR **no introduce ningún
   mecanismo de identidad propio**: ni lista de emails, ni variable de entorno, ni segunda
   condición. La pantalla de operación es una **sección más del catálogo** de ADR-021
   pto. 5, protegida en la frontera de Node como todas las demás (ADR-021 pto. 6), con sus
   server actions cubiertas una a una (ADR-021 pto. 7). **Esta spec no aporta ninguna
   variable de entorno nueva.**

10. **La pantalla de operación no muestra dato de ningún usuario identificable**: cuenta
    filas, no lista personas. Ni emails, ni tickers de nadie, ni carteras. **RN-01 no se
    relaja**: un agregado no es un dato de usuario, y en el momento en que la pantalla
    enseñe una fila concreta de alguien, sí lo será. Es la línea que impide que `admin`
    signifique lo que "administrador" suele significar.

### El ciclo diario deja constancia

11. **Cada ejecución autorizada del ciclo escribe una fila** en una tabla propia,
    `cron_runs { id, started_at, finished_at, outcome, requested, updated, skipped,
    triggers_opened, triggers_closed, notifications_entries, notifications_digests,
    error }`. Es estado **operativo**: no tiene `userId`, no lo lee ningún usuario y **RN-01**
    no le aplica.

12. **La fila se abre al empezar y se cierra al terminar, y esa es toda la gracia.**
    `started_at` se escribe **antes** de ingerir nada; `finished_at`, los contadores y el
    desenlace se escriben al acabar. Una fila con `finished_at` **nulo** significa *"empezó y
    no volvió"* — el ciclo que revienta a mitad, que es justo el caso que ninguna
    derivación podía detectar. Si el ciclo lanza, se cierra la fila con el error **y se
    vuelve a lanzar**: registrar no puede tragarse el fallo.

13. **Los contadores son los de `CycleResult`, no unos nuevos.** `requested`, `updated`,
    `skipped` salen de `RefreshResult`; `triggers_opened`/`triggers_closed` de la evaluación;
    `notifications_entries`/`notifications_digests` del envío. **Una sola definición**: lo
    que la pantalla enseña es literalmente lo que el endpoint del cron ya devolvía y nadie
    leía.

14. **Una petición NO autorizada no escribe fila.** `authorizeCron` rechaza con 401 **antes**
    de que empiece nada (`runCronCycle`), y un 401 no es una ejecución. Además evita que
    quien sondee el endpoint llene la tabla.

15. **Registrar no es alertar, y esta frontera es normativa.** El registro de ejecuciones
    **se muestra** en la pantalla de operación y **nada más**: no envía correo, no manda
    aviso, no escribe en `notifications` y no despierta a nadie. La **alerta proactiva al
    operador** sigue **fuera del alcance** de EPIC-004 por decisión escrita de la épica, y
    sigue siendo la idea *"Observabilidad del ciclo diario"* del roadmap. Quien mañana
    quiera añadirla, que traiga su spec: **esta tabla no es una excusa para colarla**.

16. **La respuesta HTTP del cron no cambia.** `/api/cron/refresh` sigue devolviendo el mismo
    cuerpo con el mismo `CycleResult`: la tabla es un registro **adicional**, no un
    sustituto, y ningún consumidor existente se entera.

## Consecuencias

### Positivas

- **CE-6 se cumple literalmente**: dos clics en la pantalla de operación cierran el registro
  y el siguiente visitante se lo encuentra cerrado. Sin build, sin migración, sin riesgo.
- **CE-7 se cumple de verdad**, no por aproximación: se puede afirmar *"el ciclo de anoche
  corrió, terminó, pidió 31 símbolos y falló 4"*, y también *"el de anoche empezó y no
  terminó"*, que es la respuesta que más importa y la que ninguna derivación daba.
- **R-7 queda mitigado**: el cierre por cupo tiene su propio mensaje, distinto del cierre
  manual, y ambos explican en vez de fallar.
- **Cero variables de entorno nuevas.** El veredicto del rol elimina `ADMIN_EMAILS` y con
  ella dos modos de fallo: el email liberado que sigue abriendo la puerta y la variable
  ausente que deja el servicio sin operador. También evita tocar la lista cerrada de claves
  que vigila `tests/spec-031-frontera.test.ts` (CA-13.3).
- **Un solo mecanismo de acceso** en toda la app: el catálogo de secciones por rol. No
  conviven dos formas de decidir quién entra a dónde.
- **El diagnóstico del ciclo deja de depender de mirar logs de Vercel**, que es como se
  tardó semanas en ver el defecto de EPIC-FIX.

### Negativas / follow-ups

- **Una consulta más en el registro.** El alta lee los ajustes y cuenta cuentas. Es la
  operación menos frecuente de la app.
- **Dos escrituras más por ciclo** (abrir y cerrar la fila). Una vez al día, sobre una tabla
  sin índices que mantener. Irrelevante.
- **El cupo puede rebasarse en uno bajo concurrencia** (pto. 8). Asumido y declarado.
- **`cron_runs` crece sin límite**: una fila al día, 365 al año. Inocuo hoy, pero es una
  tabla que nadie purga → **F-ADR-023-2**.
- **F-ADR-023-1 (higiene, futuro).** No hay historial de quién cambió el grifo y cuándo, más
  allá de `updated_at`/`updated_by` en la propia fila: el estado anterior se pierde. Con un
  operador es suficiente; con dos, no lo sería.
- **F-ADR-023-2 (higiene, futuro).** Purga o retención de `cron_runs`. Sitio natural: el
  propio ciclo diario, igual que **F-SPEC-023-2** para los tokens caducados. Nada lo hace
  urgente.
- **F-ADR-023-3 (producto, futuro).** No hay lista de espera ni forma de avisar a quien se
  encontró la puerta cerrada. El único camino que se le ofrece es el canal de feedback de
  **SPEC-039**.
- **La tentación de alertar va a llegar** (pto. 15). En cuanto exista la tabla, añadir un
  correo *"el ciclo falló"* será una tarde de trabajo. Que sea fácil no lo pone dentro de
  alcance.

## Alternativas consideradas

- **Variable de entorno en Vercel** (`REGISTRATION_OPEN`, `REGISTRATION_CAPACITY`).
  **Rechazada**: cambiarla exige redespliegue para que el runtime la vea con garantías, lo
  que incumple el "sin desplegar" de CE-6 en el único momento en que ese criterio importa
  —cerrar la puerta **ahora**, no dentro de un build—. Además, en este proyecto el build
  **migra la base de producción**, así que redesplegar para mover un interruptor es
  desproporcionado.

- **Identificar al operador por lista de emails en configuración** (`ADMIN_EMAILS`), sola o
  combinada con el rol `completo`. **Era mi propuesta inicial y el humano la rechazó en el
  gate del 2026-08-19**, con razón. Dos fragilidades que un valor en la fila del usuario no
  tiene: (a) **un email liberado sigue abriendo la puerta** —si la cuenta listada se borra,
  la dirección vuelve a estar libre (**RN-02**) y sigue en la lista, así que quien la
  registre hereda el acceso—, que obligaba a **dos parches** (prohibir ese borrado y exigir
  una segunda condición de rol) para sostener un mecanismo que no debería necesitarlos; y
  (b) **una variable puede faltar** —sin ella no hay operador, la pantalla es inaccesible
  para todos y ninguna cuenta queda protegida contra su propio borrado—. El precio del
  veredicto es que el enum mezcla visibilidad y operación (**ADR-021** pto. 1.b); se paga a
  gusto.

- **Vercel Edge Config** (ajuste sin redespliegue, leído desde Edge). **Rechazada**: sería la
  respuesta correcta a la pregunta "sin desplegar" —hay que reconocerlo—, pero introduce un
  **proveedor más** en la arquitectura y en las páginas legales de **SPEC-035** (que deben
  enumerar quién procesa los datos), añade un segundo lugar donde vive el estado y otro modo
  de fallo, todo ello para un dato que la app ya sabe leer de la base que consulta en cada
  registro. No paga su complejidad con veinte testers.

- **Almacén genérico clave-valor `app_settings`.** **Rechazada** (pto. 2): flexibilidad que
  se cobra en tipos perdidos y validaciones dispersas.

- **Derivar el estado del ciclo de `quotes` y `quote_diagnostics`, sin tabla.** **Era mi
  propuesta inicial y el humano la rechazó en el gate del 2026-08-19**, con razón: deja sin
  responder *"¿corrió?"* cuando el ciclo corre y no cambia nada, y **no puede** distinguir un
  ciclo que reventó a mitad. CE-7 pregunta exactamente eso. El argumento que yo esgrimía
  —no adelantar la idea del roadmap— se atiende mejor con la **frontera del pto. 15**
  (registrar sí, alertar no) que con una carencia.

- **Registrar el ciclo en un servicio de observabilidad externo** (logs estructurados,
  Sentry, etc.). **Rechazada**: otro proveedor en las páginas legales de SPEC-035, otra
  cuenta que mantener y otro sitio donde mirar, para un dato que cabe en una fila diaria de
  la base que ya existe.

- **Deducir el cupo del plan de Marketstack.** **Rechazada**: el cupo es de **cuentas** y la
  cuota del proveedor es de **símbolos** — **R-3** de la épica lo dice: *"las cotizaciones no
  escalan con usuarios, sino con símbolos"*. Atar dos magnitudes que no se mueven juntas da
  una falsa sensación de control.

- **Cupo transaccional exacto.** **Rechazada** (pto. 8): contención permanente en el alta a
  cambio de una exactitud que nadie va a auditar.
