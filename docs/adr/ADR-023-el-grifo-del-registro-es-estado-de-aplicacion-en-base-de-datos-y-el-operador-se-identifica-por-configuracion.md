---
id: ADR-023
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
---
# ADR-023: El grifo del registro es estado de aplicación en base de datos, y el operador se identifica por configuración

- Deciders: propone **sdd-arquitecto** (2026-08-19). El gate de **EPIC-004** (2026-08-19,
  Alberto Fojo) fijó **qué** hace falta —*"interruptor manual + cupo automático, y ambos se
  cambian **sin desplegar**"* (**CE-6**)— y dejó el mecanismo explícitamente al arquitecto,
  señalando la disyuntiva: ajuste en base de datos manejado desde la pantalla de operación
  frente a variable de entorno en Vercel. Pendiente de aprobación por el humano en el gate
  de **SPEC-037**.
- Specs relacionadas: la origina **SPEC-037** (El grifo del registro y la pantalla de
  operación). Toca la superficie pública de **SPEC-001** (registro). Depende de **ADR-021**
  (rol) para la segunda condición de la identidad del operador y de **ADR-022** pto. 8
  (la cuenta del operador no se borra). Cuenta cuentas vivas, así que **ADR-022** pto. 9 le
  aplica.

## Contexto

**Lo que CE-6 exige.** Que el registro se cierre y se reabra **sin desplegar**; que además
se cierre solo al llegar a un cupo; y que quien llegue con el registro cerrado **lea por
qué**, no un error (**R-7**: *"si el cupo se agota de madrugada, quien venga del foro se
encuentra la puerta cerrada"*).

**Por qué la variable de entorno no llega.** Es el camino más simple y el que primero se le
ocurre a cualquiera, pero cambiar una variable en Vercel **exige redespliegue** para que el
runtime la vea con garantías. La épica escribió "sin desplegar" en el criterio, y eso no es
una preferencia estética: el escenario real es el hilo del foro yendo bien un domingo por la
noche y el operador queriendo cerrar la puerta **ahora**. Un redespliegue es dos minutos y
un riesgo (el build **migra la base**, `vercel.json`), justo cuando no se quiere ningún
riesgo.

**Por qué esto no es solo una preferencia de almacenamiento.** El grifo es el primer **estado
de aplicación mutable en caliente** del proyecto. Hasta hoy todo lo que hay en la base es
dato **de usuario** (aislado por RN-01) o dato **de mercado** (compartido, ADR-002). Aparece
una tercera categoría —**ajuste operativo**— y con ella la pregunta de quién puede tocarla.

**Y ahí aparece un hueco que la épica no cierra.** El gate fijó el rol en dos valores,
`tester` y `completo`, **para la visibilidad de sección**. Ninguno de los dos significa
"opera el servicio": si la pantalla de operación se abriera a cualquier `completo`, el día
que se promueva a un tester de confianza para que pruebe Cartera se le estaría entregando
también el interruptor del registro y los contadores globales. Son dos preguntas distintas
—*"¿qué secciones de lo tuyo se te enseñan?"* y *"¿operas tú este servicio?"*— y meterlas en
el mismo enum es cómo se acaba con un rol de administrador por accidente.

**Materia prima disponible para los contadores (CE-7)**, verificada en el código: `users`
(cuentas), `watched_symbols` (vigiladas), `symbolUniverse` en
`src/lib/market/refresh.ts` (los símbolos que el ciclo pide: la unión de los referenciados
por vigiladas y transacciones) y `quote_diagnostics` (por qué un símbolo no tiene precio,
SPEC-016). Del **ciclo** en sí **no se persiste nada**: `runCronCycle`
(`src/lib/triggers/cycle.ts`) devuelve su resultado en el cuerpo de la respuesta HTTP y ahí
muere. Registrar cada ejecución es precisamente la idea *"Observabilidad del ciclo diario"*
que el roadmap tiene aparcada en "Más adelante" y que la épica **deja fuera** (*"aquí el
resultado del último ciclo solo se **muestra**"*).

## Decisión

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

7. **La fila la siembra la migración** con los valores por defecto del producto —**abierto,
   sin cupo**, que es lo que la épica declara— y esos mismos valores son la respuesta si la
   fila faltara. Viven en **una** constante nombrada, no repartidos por el código. Cerrar el
   registro por una fila ausente sería matar el objetivo de la épica en silencio.

8. **El cupo es un tope operativo, no una licencia: se comprueba, no se serializa.** Dos
   registros exactamente simultáneos en la última plaza pueden dejar el contador uno por
   encima del cupo. Se acepta **declaradamente**: el cupo protege una cuota con margen
   amplio, y bloquear la tabla `users` en cada alta para ganar una plaza exacta es pagar
   contención permanente por una precisión que a nadie le importa. Lo que **sí** se
   garantiza es que a partir de ahí no entra nadie más.

9. **Quién opera se decide FUERA del rol, con dos condiciones que deben cumplirse a la vez**:
   (a) el email de la sesión figura en la lista de operadores de la configuración de
   despliegue (`ADMIN_EMAILS`, separada por comas, comparada normalizada y sin distinguir
   mayúsculas), **y** (b) la cuenta tiene rol `completo` (**ADR-021**). Cualquier otra cosa
   —incluida una cuenta `completo` que no está en la lista, y una cuenta listada que es
   `tester`— **no** es operador.

10. **La conjunción del pto. 9 es deliberada y cierra un agujero concreto.** Una lista de
    emails a secas sería vulnerable si un email listado **no estuviera registrado**:
    cualquiera podría registrarlo y entrar a la pantalla de operación. La segunda condición
    lo impide, porque **toda cuenta nueva nace `tester`** (ADR-021 pto. 8) y promover a
    `completo` exige acceso a la base. Se complementa con **ADR-022** pto. 8, que impide
    borrar la cuenta del operador para que su email no vuelva a quedar libre.

11. **Que la lista de operadores exija redespliegue es correcto y es el punto.** Cambia
    prácticamente nunca, y que cambiarla sea un acto deliberado de despliegue es una
    propiedad, no una carencia. **CE-6 habla del grifo, no de quién lo abre.**

12. **La pantalla de operación se protege en la frontera de Node**, como las secciones
    (**ADR-021** pto. 6): el middleware Edge sigue sin saber nada. Quien no es operador **no
    ve la ruta**: no se le sirve ningún contador.

13. **El estado del último ciclo se DERIVA de lo que ya se persiste; no se crea tabla de
    ejecuciones.** La marca del último ciclo es la más reciente entre `quotes.updated_at` y
    `quote_diagnostics.attempted_at`; los símbolos sin precio son las filas de
    `quote_diagnostics`, con su motivo. Registrar cada ejecución del cron es la idea
    aparcada del roadmap y **no se adelanta aquí**: la épica pide *mostrar*, no *instrumentar*.

14. **Residual declarado del pto. 13**: un ciclo que corre y no cambia nada —porque el
    universo está vacío, o porque el proveedor devuelve exactamente lo mismo y no se
    reescribe ninguna fila— es **indistinguible** de un ciclo que no corrió. La pantalla no
    puede decir "el cron corrió"; dice **"último dato de mercado registrado: <fecha>"**, que
    es lo que de verdad sabe. Decir lo primero sería mentir con precisión.

15. **La pantalla de operación no muestra dato de ningún usuario identificable**: cuenta
    filas, no lista personas. Ni emails, ni tickers de nadie, ni carteras. **RN-01 no se
    relaja**: un agregado no es un dato de usuario, y en el momento en que la pantalla
    enseñe una fila concreta de alguien, sí lo será.

## Consecuencias

### Positivas

- **CE-6 se cumple literalmente**: dos clics en `/admin` cierran el registro y el siguiente
  visitante se lo encuentra cerrado. Sin build, sin migración, sin riesgo.
- **R-7 queda mitigado**: el cierre por cupo tiene su propio mensaje, distinto del cierre
  manual, y ambos explican en vez de fallar.
- **CE-7 sin esquema nuevo más allá del grifo**: cuatro consultas de agregación y una fecha.
- **El operador no es un rol de producto**, así que promover a alguien a `completo` para que
  pruebe Cartera **no** le entrega el interruptor. Las dos decisiones se mueven por separado
  porque son cosas distintas.
- **No se adelanta la observabilidad del ciclo**, que sigue siendo una idea del roadmap con
  su propio alcance, sin quedar medio hecha por el camino.

### Negativas / follow-ups

- **Una consulta más en el registro.** El alta lee los ajustes y cuenta cuentas. Es la
  operación menos frecuente de la app.
- **El cupo puede rebasarse en uno bajo concurrencia** (pto. 8). Asumido y declarado.
- **"El cron corrió" no es exactamente lo que se muestra** (pto. 14). Es la limitación
  honesta de derivar en vez de instrumentar, y el motivo de que el rótulo hable de datos y
  no de ejecuciones.
- **F-ADR-023-1 (DESPLIEGUE).** Variable nueva `ADMIN_EMAILS` en Vercel. **Si falta, no hay
  operador y la pantalla no es accesible para nadie** — el grifo solo se podría mover con un
  `UPDATE` en Neon. Va a `.env.example` con su explicación y al runbook.
- **F-ADR-023-2 (higiene, futuro).** No hay historial de quién cambió el grifo y cuándo, más
  allá de `updated_at`/`updated_by` en la propia fila: el estado anterior se pierde. Con un
  operador es suficiente; con dos, no lo sería.
- **F-ADR-023-3 (producto, futuro).** No hay lista de espera ni forma de avisar a quien se
  encontró la puerta cerrada. El único camino que se le ofrece es el canal de feedback de
  **SPEC-039**.

## Alternativas consideradas

- **Variable de entorno en Vercel** (`REGISTRATION_OPEN`, `REGISTRATION_CAPACITY`).
  **Rechazada**: cambiarla exige redespliegue para que el runtime la vea con garantías, lo
  que incumple el "sin desplegar" de CE-6 en el único momento en que ese criterio importa
  —cerrar la puerta **ahora**, no dentro de un build—. Además, en este proyecto el build
  **migra la base de producción**, así que redesplegar para mover un interruptor es
  desproporcionado. Se conserva el mecanismo de entorno solo para lo que **no** debe cambiar
  en caliente: la lista de operadores (pto. 11).

- **Vercel Edge Config** (ajuste sin redespliegue, leído desde Edge). **Rechazada**: sería la
  respuesta correcta a la pregunta "sin desplegar" —y hay que reconocerlo—, pero introduce un
  **proveedor más** en la arquitectura y en las páginas legales de **SPEC-035** (que deben
  enumerar quién procesa los datos), añade un segundo lugar donde vive el estado y otro modo
  de fallo, todo ello para un dato que la app ya sabe leer de la base que consulta en cada
  registro. No paga su complejidad con veinte testers.

- **Almacén genérico clave-valor `app_settings`.** **Rechazada** (pto. 2): flexibilidad que
  se cobra en tipos perdidos y validaciones dispersas. La flexibilidad no es gratis y aquí no
  hace falta.

- **Deducir el cupo del propio plan de Marketstack.** **Rechazada**: el cupo es de **cuentas**
  y la cuota del proveedor es de **símbolos** — y **R-3** de la épica ya lo dice: *"las
  cotizaciones no escalan con usuarios, sino con símbolos"*. Atar dos magnitudes que no se
  mueven juntas daría una falsa sensación de control.

- **Que el operador sea un tercer valor del rol (`admin`).** **Rechazada**: el gate de
  EPIC-004 enumeró dos roles y ampliar el enum es ampliar la épica; pero, sobre todo, mezcla
  *qué ves de lo tuyo* con *quién opera el servicio*, y esas dos cosas deben poder moverse
  por separado (pto. 9). Si el humano prefiere el tercer rol, la conjunción del pto. 9
  desaparece y con ella su garantía: habría que reinstaurarla de otra forma.

- **Cupo transaccional exacto** (bloqueo o restricción que impida rebasar la plaza).
  **Rechazada** (pto. 8): contención permanente en el alta a cambio de una exactitud que
  nadie va a auditar.

- **Registrar cada ejecución del cron en una tabla `cron_runs`.** **Rechazada aquí**: es la
  idea *"Observabilidad del ciclo diario"* del roadmap, aparcada a propósito, y la épica
  pide **mostrar** el último ciclo, no instrumentarlo. Hacer media idea del roadmap dentro
  de otra épica es la vía rápida a tener las dos a medias. El precio de no hacerlo está
  declarado en el pto. 14 y es el punto donde este ADR es más discutible.
