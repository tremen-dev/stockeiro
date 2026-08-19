---
id: ADR-022
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-19, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-022: Borrado de cuenta: cae todo lo propio, se conserva lo compartido y no se anonimiza nada

- Deciders: propone **sdd-arquitecto** (2026-08-19) para cerrar **R-6** de **EPIC-004**
  (*"Borrar la cuenta choca con lo derivado y lo compartido"*), que la propia épica declara
  *"una decisión de diseño, no un `DELETE`"*. Pendiente de aprobación por el humano en el
  gate de **SPEC-036**.
- Specs relacionadas: la origina **SPEC-036** (Borrar mi cuenta). Toca el modelo de
  **ADR-002/ADR-007** (registro de símbolos **compartido**), **ADR-003** (ledger de
  transacciones), **ADR-005** (episodios de zona), **ADR-006/RN-15** (registro in-app de
  avisos), **ADR-009** (alias de import), **ADR-015** (tokens de recuperación) y
  **ADR-016** (época de credencial). Interactúa con **SPEC-037** (el cupo del registro
  cuenta cuentas vivas) y con **ADR-021** (el rol `admin` es quien opera la app: pto. 8).

## Contexto

**CE-5** de EPIC-004 exige que un usuario borre su cuenta y sus datos **desde la app**, que
*"no quede rastro suyo"* y que **su email vuelva a estar libre** (**RN-02**). Es uno de los
dos criterios que la épica marca como bloqueantes para publicar.

Un `DELETE FROM users` no funciona, y no por un detalle de fontanería: el esquema
(`src/db/schema.ts`) tiene **seis** tablas que apuntan a `users` y **tres** que no le
pertenecen a nadie. El grafo real, verificado en el esquema:

| Tabla | Vínculo con el usuario | Qué es |
|---|---|---|
| `password_reset_tokens` | `user_id` → `users` | Llaves vivas (ADR-015) |
| `transactions` | `user_id` → `users`; `symbol_id` → `symbols` | Ledger propio (ADR-003) |
| `watched_symbols` | `user_id` → `users`; `symbol_id` → `symbols` | Vigilancia propia (SPEC-003) |
| `zone_triggers` | `user_id` → `users`; `watched_symbol_id` → `watched_symbols` **`on delete cascade`** | Estado **derivado** (ADR-005/ADR-017) |
| `notifications` | `user_id` → `users`; `zone_trigger_id` → `zone_triggers` **`on delete set null`** | Memoria del usuario (RN-15) |
| `symbol_aliases` | `user_id` → `users`; `symbol_id` → `symbols` | Resolución aprendida del import (ADR-009) |
| `symbols` | **ninguno** | **Compartido** entre usuarios (ADR-002/ADR-007) |
| `quotes` | `symbol_id` → `symbols` | **Compartida**: una fila por símbolo (ADR-004) |
| `quote_diagnostics` | `symbol_id` → `symbols` | **Compartida**: por qué no hay precio (SPEC-016) |

Tres tensiones de verdad, no de SQL:

1. **Lo compartido no es suyo.** `symbols` es *"entidad global compartida entre usuarios […]
   no propiedad de ningún usuario"* (dominio; ADR-002). Borrar los símbolos que un usuario
   tocó **rompería la cartera y la vigilancia de los demás**. La misma lógica cubre `quotes`
   y `quote_diagnostics`: son hechos de **mercado**, no datos de la persona. Que Inditex
   cerrara ayer a 48,20 € no dice nada de quien se va.

2. **RN-15 dice que un aviso registrado no se pierde… ¿también cuando se va su dueño?**
   **ADR-017** ya razonó este eje para la baja de una acción vigilada y resolvió que
   `notifications` es *"memoria del usuario"* y se conserva, mientras `zone_triggers` es
   *"estado derivado y operativo"* y cae. Ese razonamiento se sostiene **mientras haya
   usuario**. Aquí no lo hay: RN-15 protege al usuario de perder **su** memoria, y quien
   pide el borrado está pidiendo exactamente que esa memoria desaparezca. Aplicar RN-15
   contra la voluntad de su beneficiario sería usar una regla de confianza como excusa para
   retener datos personales.

3. **"Libre" y "sin rastro" son dos exigencias, no una.** Un borrado suave que deje la fila
   con el email machacado (`borrado-<uuid>@…`) libera el email —RN-02 se cumple— pero deja
   **rastro**: cuándo se registró, cuántas operaciones tenía, cuándo se fue. CE-5 pide las
   dos cosas.

Y hay una restricción de orden: `zone_triggers.user_id` y `notifications.user_id` son
`no action`, así que la fila de `users` no puede caer sin que caigan antes. `zone_triggers`
se va **solo** al borrar `watched_symbols` (cascade, ADR-017), y eso deja los `notifications`
de esos episodios con `zone_trigger_id` a null (set null, ADR-017) — sin romper nada.

## Decisión

1. **Se borra, de verdad. No hay borrado suave, ni anonimización, ni tumba.** Desaparecen
   las filas de `password_reset_tokens`, `notifications`, `watched_symbols` (y con ellas
   `zone_triggers`, por cascade), `transactions`, `symbol_aliases` y, por último, `users`.
   Después del borrado **no existe ninguna fila en la base que se refiera a esa persona**.

2. **`symbols`, `quotes` y `quote_diagnostics` NO se tocan.** Son compartidas y son hechos
   de mercado. Un símbolo que se quede sin nadie que lo vigile ni lo tenga en cartera queda
   **inerte, no huérfano peligroso**: `symbolUniverse` (`src/lib/market/refresh.ts`) compone
   el universo del ciclo como la unión de los símbolos referenciados por `watched_symbols` y
   `transactions` **de cualquier usuario**, así que un símbolo que ya no referencia nadie
   **deja de cotizarse solo**, sin consumir cuota del proveedor y sin código nuevo. Su
   última cotización queda ahí y se reutiliza si alguien vuelve a vigilarlo.

3. **No se anonimiza nada porque no hay nadie que consuma el anonimato.** La analítica de
   uso y retención está **explícitamente fuera** de EPIC-004 (§Fuera y roadmap "Más
   adelante"), así que una fila-lápida no alimentaría ningún informe: sería dato personal
   residual sin propósito. El día que exista analítica, la decisión se reabre **con su
   propio ADR** y con la pregunta correcta encima de la mesa ("¿qué contamos y con qué
   base?"), no de refilón.

4. **Todo en una sola transacción, y en este orden**: `notifications` → `watched_symbols`
   (arrastra `zone_triggers`) → `transactions` → `symbol_aliases` →
   `password_reset_tokens` → `users`. O cae todo o no cae nada: un borrado a medias deja a
   la persona sin cuenta pero con datos, que es el peor de los dos mundos.

5. **El email queda libre en el mismo instante** (**RN-02**): al desaparecer la fila
   desaparece el índice único, y esa dirección puede registrarse de nuevo como si nunca
   hubiera estado. La cuenta nueva **no hereda nada**: ni avisos, ni vigiladas, ni alias, ni
   rol — nace `tester` como cualquier otra (**ADR-021** pto. 8).

6. **Para borrar hay que demostrar que eres tú, con la contraseña actual.** Se reutiliza
   `verifyCredentials` (`src/lib/auth/users.ts`), no se inventa un segundo mecanismo. Una
   sesión abierta en un portátil prestado no puede evaporar una cartera entera con dos
   clics.

7. **Las sesiones del usuario borrado mueren solas, en todas partes, y sin código nuevo.**
   La frontera de sesión de Node (**ADR-016**) lee la fila del usuario en cada petición; sin
   fila no hay época, e `isSessionEpochCurrent(claim, null)` devuelve `false`, así que la
   sesión se resuelve **anónima** y el guard manda a login. Es una propiedad **heredada**,
   pero se prueba en **SPEC-036**: heredar una garantía sin comprobarla es confiar, no
   diseñar.

8. **Una cuenta con rol `admin` no se borra desde la app. Ninguna, no solo la última.**
   El botón no está y la acción se rechaza (**ADR-021** pto. 1: el operador es un rol, no
   una lista de emails). El motivo directo es que el servicio no puede quedarse **sin
   operador y sin forma de recuperarlo**: no hay UI para nombrar a otro (**F-ADR-021-1**),
   así que un borrado sin red dejaría el grifo del registro y la pantalla de operación
   inalcanzables hasta un `UPDATE` a mano en Neon.

   **Por qué "ningún `admin`" y no "el último `admin`"**, que es la regla que primero se le
   ocurre a cualquiera: contar administradores dentro del borrado introduce una **carrera**
   —dos `admin` que se borran a la vez ven ambos un censo de dos, ambos se creen "no el
   último", y el servicio se queda con cero— y cerrarla exige serializar la tabla `users`
   en cada baja. La regla simple no tiene ese caso, no cuesta una consulta y **cubre por
   construcción** el escenario que preocupa. El precio es una fricción para el `admin` que
   quiere irse de verdad: **primero se degrada a `tester` o a `completo`, y luego se borra**
   — dos pasos deliberados en una operación que debe serlo, exactamente la misma disciplina
   que ya rige el nombramiento.

9. **Un borrado libera plaza en el cupo del registro** (**SPEC-037**): el cupo cuenta
   **cuentas vivas**, y quien se fue no ocupa ninguna. No es una fuga —recuperar la plaza
   exige haber renunciado antes a todos los datos—, y la alternativa (contar cuentas que ya
   no existen) haría que el cupo se agotara para siempre por gente que ya no está.

10. **Lo que se borra no se puede recuperar, y se dice antes de pulsar.** No hay copia,
    no hay papelera y no hay ventana de arrepentimiento. La pantalla lo dice con esas
    palabras y enumera qué desaparece.

## Consecuencias

### Positivas

- **CE-5 se cumple literalmente**: sin rastro y con el email libre, comprobable con una
  consulta por tabla.
- **Nadie más se entera.** Las carteras y vigiladas de los demás usuarios siguen intactas,
  con sus mismos símbolos y sus mismas cotizaciones (RN-01 por el otro lado: aislamiento
  también significa que irse no daña a terceros).
- **Sin código nuevo de sesión**: la expulsión inmediata de todas las sesiones sale gratis
  de ADR-016.
- **Sin coste en el ciclo diario**: el universo de símbolos se encoge solo.
- **El servicio no puede quedarse sin operador** (pto. 8), y la regla que lo impide **no
  tiene casos frontera**: no cuenta, no compara y no puede perder una carrera.

### Negativas / follow-ups

- **Es irreversible y no hay red.** Un borrado por error no tiene vuelta atrás salvo por la
  copia de seguridad de Neon, que ni es un producto de esta app ni se ofrece al usuario.
  Se mitiga con la reautenticación (pto. 6) y con el aviso (pto. 10), no se elimina.
- **F-ADR-022-1 (residual asumido).** El correo transaccional ya **entregado** por Resend
  antes del borrado sigue en el buzón del destinatario y en los registros del proveedor,
  fuera de nuestro alcance. Las páginas legales de **SPEC-035** deben decirlo en vez de
  prometer un borrado que llega más lejos de donde llega.
- **F-ADR-022-2 (higiene, futuro).** Quedan en `symbols` filas que ya no referencia nadie.
  No cuestan cuota (pto. 2) ni se muestran a nadie, pero acumulan. Una purga de símbolos
  inertes es aseo, no corrección; no entra en EPIC-004.
- **F-ADR-022-3 (producto, futuro).** No se envía correo de confirmación *"tu cuenta ha sido
  borrada"*. Sería coherente con **F-SPEC-023-4** (el aviso de contraseña cambiada, también
  pendiente) y ambos merecen la misma decisión a la vez. Aquí hay además una ironía honesta:
  escribir a alguien de quien acabas de prometer no conservar nada obliga a usar su email
  una última vez.
- **Sin analítica, no se sabrá cuánta gente se va.** Es la contrapartida directa del pto. 3
  y es coherente con lo que la épica dejó fuera. Si mañana importa, hay que decidirlo con un
  ADR, no con una columna.

## Alternativas consideradas

- **Borrado suave / anonimización** (`users` se queda con `email = 'borrado-<uuid>'`,
  `deletedAt` con fecha, y los datos de dominio intactos). **Rechazada**: cumple RN-02 por la
  letra y **traiciona CE-5 por el fondo** —"no queda rastro suyo"—, y además obligaría a
  colar un filtro `deletedAt is null` en cada consulta del proyecto, que es la clase de
  invariante que se olvida en la novena consulta. Retener datos financieros de un
  desconocido que ha pedido irse, sin ningún consumidor que lo justifique, es exactamente lo
  que la épica quiere evitar al publicar.

- **Conservar los avisos por RN-15, desvinculados del usuario.** **Rechazada**: los avisos
  llevan ticker, precio y `asOf`; anonimizarlos de verdad los vacía de contenido, y no
  anonimizarlos deja un historial de las operaciones de una persona identificable por
  correlación. RN-15 protege al usuario de perder su memoria, no faculta a la app para
  quedársela cuando él se va. **ADR-017 no se contradice**: allí seguía habiendo usuario a
  quien proteger, aquí no.

- **Borrar también los `symbols` que quedan sin referencias.** **Rechazada**: son
  compartidos (**ADR-002**) y su borrado es una operación global disparada por un acto
  individual — el patrón exacto que produce daños colaterales entre usuarios. Además no
  aporta nada: un símbolo inerte no se cotiza (pto. 2). Como aseo diferido, F-ADR-022-2.

- **Cola de borrado diferido con periodo de gracia de N días.** **Rechazada** para v1:
  añade un estado intermedio ("cuenta pendiente de borrado": ¿puede entrar?, ¿ocupa cupo?,
  ¿recibe avisos?, ¿libera el email?) y un proceso que lo consuma, para resolver un
  arrepentimiento que con veinte testers es hipotético. La confirmación con contraseña cubre
  el error accidental, que es el caso real.

- **Exigir teclear el email en vez de la contraseña.** **Rechazada**: es teatro de fricción,
  no una prueba de identidad — el email está a la vista de cualquiera que tenga el portátil
  abierto. La contraseña demuestra quién eres y reutiliza código ya probado.

- **Permitir el borrado a un `admin` mientras quede otro `admin` vivo** ("el último no").
  **Rechazada** (pto. 8): exige contar dentro de la transacción de borrado, y ese conteo
  pierde ante dos bajas simultáneas —ambas se creen no-últimas y el servicio se queda con
  cero operadores—. Cerrarlo de verdad obliga a serializar `users` en cada baja. La regla
  simple no tiene el caso, y su coste es un `UPDATE` previo en una operación que ya es
  deliberada.

- **Que el borrado lo ejecute el operador a petición del usuario.** **Rechazada de plano**:
  es exactamente el modelo que EPIC-003 acaba de desmontar para la contraseña ("nadie
  depende del autor") y CE-5 dice *"desde la app, sin pedírselo a nadie"*.
