---
id: SPEC-036
tipo: spec
epica: EPIC-004
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
---
# SPEC-036 — Borrar mi cuenta

## Problema

**Hoy nadie puede irse de Stockeiro.** No hay pantalla de cuenta, no hay borrado y no hay
forma de pedirlo: la única salida es escribirle al autor para que ejecute `DELETE` a mano en
Neon — el mismo modelo de "depender del autor" que **EPIC-003** acaba de desmontar para la
contraseña. Mientras el único usuario era el propietario de la base, eso era una carencia
teórica. Cuando la app se publique en un foro, la base pasará a contener **datos financieros
de desconocidos** (**R-5** de la épica) y no poder retirarlos deja de ser teórico.

Esta spec cubre **CE-5** (*"Un usuario borra su cuenta y sus datos desde la app, sin
pedírselo a nadie. Tras hacerlo no queda rastro suyo y su email vuelve a estar libre"*) y es,
con **SPEC-034** y **SPEC-035**, el corte mínimo que **bloquea publicar**.

El problema no es escribir un `DELETE`. Es que **el esquema no deja**, y no por capricho:

- **Seis tablas apuntan a `users`** y dos de esas relaciones son `no action`
  (`zone_triggers.user_id`, `notifications.user_id`): la fila de `users` no cae sola.
- **Tres tablas no son de nadie.** `symbols` es *"entidad global compartida entre usuarios […]
  no propiedad de ningún usuario"* (dominio; **ADR-002**/**ADR-007**), y con ella `quotes` y
  `quote_diagnostics`. Borrarlas con quien se va **rompería la cartera y la vigilancia de los
  demás**. Es **R-6** de la épica, que la propia épica califica de *"decisión de diseño, no
  un `DELETE`"*.
- **`notifications` está protegida por RN-15** (*"un fallo de entrega no pierde el aviso"*) y
  **ADR-017** ya decidió conservarla cuando se deja de vigilar una acción. Aquí la respuesta
  es la contraria y hay que argumentarla, no ignorarla.
- **"Sin rastro" y "email libre" son dos exigencias distintas** (**RN-02**), y un borrado
  suave solo satisface la segunda.

Todo eso se decide en **ADR-022**; esta spec lo hace verificable.

Reglas en juego: **RN-01** (aislamiento: irse **no puede** dañar los datos de otro),
**RN-02** (el email vuelve a estar libre), **RN-03** (`/cuenta` exige sesión), **RN-15**
(cuya aplicación aquí se acota: ADR-022 pto. 3).

## Usuarios / roles afectados

- **Tester que decide que esto no es para él**: borra su cuenta desde la app, en dos pasos,
  sin escribirle a nadie y sin esperar. Se lleva la certeza de que no queda nada suyo.
- **Cualquier usuario, con cualquiera de los tres roles**: `/cuenta` **no** es una sección
  sujeta al catálogo de **SPEC-034** —no está en él— y se alcanza siempre. La única
  diferencia por rol es la del punto siguiente, y es sobre **el botón de borrado**, no sobre
  la pantalla.
- **El resto de usuarios**: no se enteran de nada. Los símbolos que compartían siguen ahí,
  con su última cotización, y su cartera y su vigilancia no cambian ni un dígito.
- **El operador (rol `admin`)**: **no puede borrar su cuenta desde la app** (**ADR-022**
  pto. 8), y da igual cuántos `admin` haya. Motivo: sin operador no hay grifo del registro ni
  pantalla de operación, y **no existe UI para nombrar otro** (**F-ADR-021-1**), así que el
  servicio quedaría sin gobierno hasta un `UPDATE` a mano en Neon. Para irse de verdad,
  primero se degrada a `tester` o a `completo`; **entonces** puede borrarse como cualquiera
  (CA-13).
- **Quien borra por error**: no tiene vuelta atrás. Por eso hay contraseña (**ADR-022**
  pto. 6) y por eso la pantalla lo dice antes (**ADR-022** pto. 10).

## Criterios de aceptación

Cada CA es verificable con un test: dominio y borrado con **Vitest sobre PGlite**, flujo y
sesiones con **Playwright** sobre Postgres efímero.

- **CA-1 (La pantalla existe, exige sesión y se alcanza desde la app — CE-5, RN-03).**
  Dado `/cuenta`,
  cuando la visita alguien **sin sesión**, entonces va a `/login`; y cuando la visita un
  usuario autenticado —**con cualquiera de los tres roles**—, entonces la ve y **hay camino
  visible hasta ella desde la navegación** sin teclear la URL.

- **CA-2 (Se dice qué desaparece y que no hay vuelta atrás, antes de pulsar — ADR-022
  pto. 10).**
  Dada `/cuenta`,
  cuando se lee la zona de borrado,
  entonces enumera **qué se borra** (cuenta, operaciones, acciones vigiladas y zonas,
  avisos, equivalencias del import) y **qué no** (los símbolos y sus cotizaciones, que son
  compartidos y no son suyos), y declara que la operación es **irreversible y sin copia**.

- **CA-3 (Sin la contraseña actual no se borra nada — ADR-022 pto. 6).**
  Dado un usuario autenticado,
  cuando confirma el borrado con una contraseña **incorrecta**,
  entonces **no se borra ni una fila** —comprobado contando en las seis tablas—, la sesión
  **sigue viva** y se muestra un error. Se reutiliza `verifyCredentials`
  (`src/lib/auth/users.ts`), sin inventar un segundo mecanismo de comprobación.

- **CA-4 (Con la contraseña correcta desaparece TODO lo suyo — CE-5, ADR-022 pto. 1).**
  Dado un usuario con datos en **todas** sus tablas (avisos leídos y sin leer, vigiladas con
  zonas, un episodio de zona abierto y otro cerrado, compras, ventas, un split, un
  dividendo, un alias de import y un token de recuperación vivo),
  cuando confirma el borrado con su contraseña,
  entonces **no queda ninguna fila suya** en `users`, `password_reset_tokens`,
  `transactions`, `watched_symbols`, `zone_triggers`, `notifications` ni `symbol_aliases`.
  Se comprueba **tabla por tabla**, no por muestreo.

- **CA-5 (La cobertura del borrado está atada al esquema).**
  Dado el esquema de `src/db/schema.ts`,
  cuando aparece una tabla con columna `userId` que el borrado **no** cubre,
  entonces un test **falla**. Igual que **CA-4 de SPEC-035** ata la política de privacidad al
  esquema: quien añada mañana una tabla con datos de usuario se entera **en su PR** de que
  también tiene que borrarla, y no seis meses después por una reclamación.

- **CA-6 (Lo compartido y lo ajeno no se tocan — R-6, RN-01, ADR-002).**
  Dados dos usuarios que vigilan **el mismo símbolo** y ambos con operaciones sobre él,
  cuando uno borra su cuenta,
  entonces las filas de `symbols`, `quotes` y `quote_diagnostics` **siguen exactamente
  igual** (mismo recuento y mismos valores), y el **otro** usuario conserva íntegras sus
  vigiladas, zonas, episodios, avisos y operaciones, y sigue viendo el precio de ese símbolo.

- **CA-7 (O cae todo, o no cae nada — ADR-022 pto. 4).**
  Dado un borrado en el que una de las sentencias intermedias falla,
  cuando termina la operación,
  entonces **la base queda exactamente como estaba**: el usuario sigue existiendo con todos
  sus datos y no hay ninguna tabla parcialmente vaciada. Un borrado a medias deja a alguien
  sin cuenta y con datos: el peor de los dos mundos.

- **CA-8 (El email vuelve a estar libre y la cuenta nueva no hereda nada — CE-5, RN-02).**
  Dado un usuario borrado,
  cuando alguien se registra con **ese mismo email**,
  entonces el alta funciona (no hay conflicto de unicidad), la cuenta nueva **no tiene
  ninguna vigilada, ningún aviso, ninguna operación ni ningún alias**, y **nace con rol
  `tester`** (**SPEC-034** CA-3, **ADR-021** pto. 8).

- **CA-9 (Las sesiones del borrado mueren en todas partes, al instante — ADR-022 pto. 7).**
  Dado el mismo usuario con **dos** sesiones abiertas en navegadores distintos,
  cuando borra su cuenta desde una,
  entonces **la otra deja de autenticar en su siguiente petición**: va a `/login` y **no se
  le sirve ni un dato**. Es una propiedad heredada de **ADR-016** (sin fila no hay época),
  pero se prueba: heredar una garantía sin comprobarla es confiar, no diseñar.

- **CA-10 (Después del borrado se aterriza en un sitio público y con una confirmación).**
  Dado el borrado completado,
  cuando termina el flujo,
  entonces el usuario acaba en una **página pública** con la confirmación de que su cuenta y
  sus datos se han borrado, **sin** error de Next, **sin** una pantalla autenticada a medio
  pintar y **sin** cookie de sesión válida.

- **CA-11 (Una cuenta `admin` no se borra desde la app — ADR-022 pto. 8).**
  Dada una cuenta con rol **`admin`**,
  cuando visita `/cuenta`, entonces **no se le ofrece el borrado** y se le explica por qué y
  cómo proceder (degradarse primero); y cuando se invoca la acción directamente, entonces
  **se rechaza y no se borra nada**. Ocultar el botón sin cerrar la acción no cumple este CA.

- **CA-12 (La regla no tiene casos frontera: da igual cuántos `admin` haya — ADR-022 pto. 8).**
  Dadas tres bases: una con **un solo** `admin`, otra con **dos**, y otra con dos donde
  ambos intentan borrarse **a la vez**,
  cuando cada `admin` intenta borrar su cuenta,
  entonces **ninguno lo consigue en ningún caso** y **siempre queda al menos un `admin`**.
  Se prueba explícitamente el escenario simultáneo: la regla no cuenta administradores, así
  que no puede perder esa carrera — a diferencia de un *"solo el último no puede"*, que sí
  la pierde y dejaría el servicio con cero operadores.

- **CA-13 (Degradarse primero SÍ permite irse — ADR-022 pto. 8).**
  Dado un `admin` que pasa a `tester` o a `completo` en la base,
  cuando vuelve a `/cuenta`,
  entonces **ya se le ofrece el borrado** y este funciona con normalidad (CA-4). La
  restricción es sobre el **rol**, no sobre la persona: irse es siempre posible, solo exige
  dejar de ser el operador primero.

- **CA-14 (La política de privacidad enlaza aquí — frontera con SPEC-035 CA-16).**
  Dada `/legal/privacidad`,
  cuando se lee el apartado de derechos,
  entonces contiene un **enlace navegable** a `/cuenta`, y ese enlace lleva a la pantalla de
  esta spec. SPEC-035 enuncia el derecho; **este CA es el que lo hace clicable**.

- **CA-15 (No degrada lo entregado).**
  Dada la suite existente,
  cuando se ejecuta completa,
  entonces sigue verde: en particular **CA-6 de SPEC-001** (aislamiento), **CA-13 de
  SPEC-023** (sesiones invalidadas) y los CA de **SPEC-024**/**ADR-017** (dejar de vigilar
  conserva los avisos) — esta spec **no** cambia qué pasa al dejar de vigilar, solo qué pasa
  al **irse**.

## Entidades y reglas afectadas

**Sin cambios de esquema.** No se añade ninguna columna ni ninguna tabla: no hay `deletedAt`,
no hay lápida, no hay estado intermedio (**ADR-022** ptos. 1 y 3). Es lo que hace este
borrado auditable con una consulta por tabla en vez de con un filtro que hay que recordar
poner en cada consulta del proyecto.

**Lo que se borra, en este orden y en una sola transacción** (**ADR-022** pto. 4):
`notifications` → `watched_symbols` (arrastra `zone_triggers` por su `on delete cascade`,
**ADR-017**) → `transactions` → `symbol_aliases` → `password_reset_tokens` → `users`.

**Lo que NO se toca**: `symbols`, `quotes` y `quote_diagnostics` (compartidas: **ADR-002**,
**ADR-004**, **SPEC-016**). Un símbolo que se quede sin nadie que lo referencie **deja de
cotizarse solo**, porque `symbolUniverse` (`src/lib/market/refresh.ts`) compone el universo
del ciclo desde `watched_symbols` y `transactions`: no consume cuota y no hace falta código.

**Rutas nuevas**: `/cuenta` (autenticada, **RN-03**; **no** es una sección sujeta al rol de
**SPEC-034**) y la página pública de confirmación posterior al borrado (CA-10), que se
declara en `PUBLIC_PREFIXES` como cualquier otra excepción a RN-03.

**Piezas existentes que se reutilizan, no se duplican**: `verifyCredentials` y
`hashPassword` (`src/lib/auth/`), la frontera de sesión de Node (`resolveSessionWithEpoch`,
**ADR-016**) que hace CA-9 gratis, `signOut` de Auth.js, y los helpers de propiedad de
`src/lib/data/ownership.ts` como referencia de que **todo filtra por `userId`**.

**Reglas y decisiones**: **RN-01** (CA-6), **RN-02** (CA-8), **RN-03** (CA-1), **RN-15**
(acotada por **ADR-022** pto. 3, con su argumento frente a **ADR-017**); **ADR-022** (origen
de esta spec, en `borrador`), **ADR-016** (sesiones), **ADR-021** (rol de la cuenta nueva),
**ADR-023** (identidad del operador, CA-11), **ADR-002**/**ADR-007** (lo compartido).
Dominio: se añade a `docs/fundacion/dominio.md` el término **Borrado de cuenta**.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Exportar mis datos (portabilidad)**: fuera de la épica por decisión escrita. Entra solo
  la supresión, que es la que bloquea publicar.
- **Periodo de gracia, papelera o borrado diferido**: rechazado en **ADR-022** con su motivo.
- **Anonimizar en vez de borrar**: rechazado en **ADR-022** con su motivo.
- **Correo de confirmación "tu cuenta ha sido borrada"**: **F-ADR-022-3**. Debe decidirse a
  la vez que **F-SPEC-023-4** (el aviso de contraseña cambiada), no por separado.
- **Purgar los `symbols` que se quedan sin referencias**: **F-ADR-022-2**. Es aseo, no
  corrección: un símbolo inerte no se cotiza.
- **Que un operador borre la cuenta de otro**: no existe y no entra. El borrado es
  autoservicio, como la recuperación de contraseña de **SPEC-023**.
- **Cambiar el email o la contraseña desde `/cuenta`**: esta pantalla **solo** entrega el
  borrado. El cambio de contraseña desde sesión pertenece a **EPIC-003** y el de email no
  tiene épica.
- **El cupo del registro**: que un borrado libere plaza es consecuencia de contar cuentas
  vivas y se especifica y se prueba en **SPEC-037** (**ADR-022** pto. 9), no aquí.
- **RLS (F-SPEC-001-1)**: sigue aparcado. **R-5** sube su prioridad; esta spec no lo cierra.

## Salvedades y follow-ups

- **F-SPEC-036-1 (residual asumido, R-6).** El borrado y el **ciclo diario** pueden
  solaparse: si el cron inserta un aviso para este usuario justo entre el borrado de
  `notifications` y el de `users`, la transacción **falla entera** (clave foránea) y el
  usuario reintenta. Es el comportamiento correcto —CA-7 garantiza que nunca queda a
  medias— pero es un fallo visible en una ventana de milisegundos, una vez al día. No se
  serializa contra el cron: el remedio costaría más que el mal.
- **F-SPEC-036-2 (residual asumido, F-ADR-022-1).** Los correos ya **entregados** por Resend
  antes del borrado siguen en el buzón del destinatario y en los registros del proveedor.
  Está fuera de nuestro alcance y **SPEC-035** CA-16 obliga a decirlo en vez de prometer más
  de lo que se puede.
- **F-SPEC-036-3 (DESPLIEGUE).** Esta spec **no migra el esquema y no necesita ninguna
  variable de entorno**, así que no activa `F-SPEC-023-1` por sí sola. Es la más barata de
  desplegar de las tres que bloquean publicar, junto con SPEC-035. Su única dependencia es
  la columna `role` de **SPEC-034** (CA-11 a CA-13).
- **F-SPEC-036-4 (higiene).** El borrado deja `symbols` sin referencias (F-ADR-022-2) y
  `quotes`/`quote_diagnostics` de esos símbolos congeladas. Inocuo y reutilizable si alguien
  vuelve a vigilarlos.

## Notas para el gate humano

1. **La decisión de fondo es de ADR-022 y merece tu lectura: se borra de verdad, no se
   anonimiza.** El camino cómodo era un `deletedAt` y un email machacado: cumple RN-02 y
   deja los datos donde estaban. Lo he descartado porque CE-5 dice *"no queda rastro suyo"*
   y porque no hay **nadie** que consuma esa lápida —la analítica está fuera de la épica por
   decisión tuya—. Retener datos financieros de un desconocido que ha pedido irse, sin un
   consumidor que lo justifique, es exactamente lo que publicar obliga a no hacer.

2. **RN-15 y ADR-017 dicen que un aviso no se pierde; aquí se pierden todos. No es una
   contradicción, pero quiero que lo sanciones tú.** ADR-017 decidió conservar los avisos al
   dejar de vigilar **porque seguía habiendo un usuario a quien proteger**. Aquí no lo hay:
   quien pide el borrado está pidiendo que esa memoria desaparezca. Usar una regla de
   confianza para retener datos contra la voluntad de su beneficiario sería darle la vuelta.

3. **El caso del último `admin`: he elegido la regla ANCHA, y quiero que lo veas.** Me
   pediste que el último `admin` no pudiera borrarse. He escrito algo más fuerte —**ningún
   `admin` puede**— porque la regla estrecha exige **contar administradores dentro del
   borrado**, y ese conteo **pierde una carrera**: dos `admin` que se borran a la vez ven
   ambos un censo de dos, ambos se creen "no el último" y el servicio se queda con cero
   operadores. Cerrarlo de verdad obligaría a serializar `users` en cada baja. La regla ancha
   no tiene el caso, no cuesta una consulta y **cubre por construcción** lo que pediste. Su
   precio es un paso más para el `admin` que quiera irse: degradarse primero (CA-13), que
   además es la misma disciplina con la que se nombra a un operador. Si prefieres la regla
   estrecha, dilo: cambian CA-11, CA-12 y ADR-022 pto. 8, y hay que decidir si se paga el
   bloqueo o se asume la carrera.

4. **Tu veredicto cerró dos riesgos que yo había levantado.** Con el operador como rol,
   ya **no hay email liberado que siga dando acceso** (borrar una cuenta se lleva su rol) ni
   **variable de entorno que pueda faltar** y dejar a todas las cuentas desprotegidas.
   R-nuevo-1 y R-nuevo-2 de mi informe quedan **cerrados por diseño**, no mitigados.

5. **La contraseña como confirmación (CA-3) frente a "teclea tu email".** He elegido la
   contraseña porque el email está a la vista de cualquiera que tenga el portátil abierto y
   porque reutiliza código ya probado. Es más fricción; es fricción **útil**. Si prefieres
   la variante suave, afecta solo a CA-3.

6. **No hay marcha atrás y no ofrezco ninguna.** Ni papelera, ni periodo de gracia, ni
   correo de confirmación (**F-ADR-022-3**). Si te incomoda, la pieza más barata de las tres
   es el correo posterior —pero tiene la ironía de escribir a alguien de quien acabas de
   prometer no conservar nada—.

7. **Secuencia.** **Secuencia sancionada en el gate del 2026-08-19: 034 → 035 → 036 → 037 → 039 → 038.** Esta va **tercera**: después de **SPEC-035** (para que CA-14 tenga a
   qué enlazar) y
   **después de SPEC-034**, que le da la columna `role` (CA-8, CA-11 a CA-13). **No depende
   de SPEC-037 en absoluto** —eso cambió con tu veredicto: al ser el operador un rol y no una
   lista de emails, esta spec ya no necesita ninguna variable de entorno— así que **puede
   publicarse antes** que SPEC-037 sin dejar ningún CA sin verificar.

8. **Aprobación**: la spec queda en **`borrador`** y **no la firmo yo**. **ADR-022** nace
   también en `borrador` y se aprueba en este mismo gate; si prefieres la anonimización,
   decaen CA-4, CA-5 y CA-8 y CE-5 pasa a cumplirse solo a medias.
