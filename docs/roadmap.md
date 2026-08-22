---
tipo: roadmap
---
# Roadmap — Stockeiro

> Curado por sdd-producto. Secuencia de épicas, horizonte y criterios de corte.
> El estado fino por spec vive en el tablero; aquí vive la INTENCIÓN.

## Ahora (en curso)
- **EPIC-005 — Gobernar la vigilada que ya existe: ajustar sus zonas y silenciarla sin
  destruirla** (estado: aprobada; gate humano el 2026-08-22, Alberto Fojo).
  **Qué falta.** Una vigilada es hoy **inmutable**: `src/app/vigiladas/actions.ts` solo
  sabe dar de alta y dar de baja. Para mover un rango hay que borrarla y recrearla, y eso
  **no es equivalente** — ADR-017 dejó los episodios de zona como derivados, con
  `zone_triggers` en cascada sobre `watched_symbols`: al recrear no hay episodio abierto,
  así que el motor lee el precio como entrada nueva y **vuelve a avisar de algo ya
  avisado**; los avisos viejos quedan huérfanos y `createdAt` miente sobre la edad de la
  vigilada. Entrega además **silenciar** una vigilada sin borrarla: deja de avisar pero
  sigue viva, con su precio al día y su estado visible.
  **Por qué manda ahora.** Nació en "Después" el 2026-08-22 —es alcance nuevo, y el
  criterio de corte dice que el alcance nuevo no adelanta— y **el humano la subió el mismo
  día**. La razón que lo sostiene: "Ahora" está de facto drenada (EPIC-004 tiene sus seis
  specs en `hecho`, EPIC-003 la suya, y EPIC-FIX y EPIC-MEJORA son *buckets* que no ocupan
  turno), así que esperar al cierre formal de EPIC-004 habría sido respetar la letra del
  criterio contra su propósito. Y la fricción que arregla es la que EPIC-004 pone delante
  de gente que llega **sin sus zonas puestas**, al contrario que el autor, que ya las
  tenía: el primer tester que quiera mover un rango descubrirá que la app le pide destruir
  su propia vigilancia para hacerlo.
  ⚠️ **Trae migración de esquema** (R-2): "silenciada" es estado nuevo en
  `watched_symbols`, y **Preview comparte la BD de producción** (ver "Ops y despliegue"),
  así que una PR de esta épica migra producción. No es un detalle de implementación:
  condiciona cómo se abre la rama.
  ⚠️ **Probable ADR** (R-1): la continuidad del episodio cuando **la zona se mueve debajo
  de un precio quieto** es un suceso que ADR-005 (*edge-triggered*) no contempla.
  ⚠️ **R-6 — el silencio puede tapar la promesa**: una vigilada callada y olvidada es
  exactamente el fallo que EPIC-FIX persiguió ocho specs (la app deja de avisar y el
  usuario no se entera de que no le avisa). CE-3 lo trata como requisito, no como detalle
  visual.

- **EPIC-004 — Puesta en público para testers externos** (estado: aprobada;
  gate humano el 2026-08-19, Alberto Fojo).
  **Por qué manda ahora.** No entrega capacidad nueva de vigilancia: entrega la
  posibilidad de **enseñársela a alguien**. Y es lo único que queda entre el producto
  y su primer usuario real. El criterio de corte que exigía no comprometer alcance
  nuevo hasta restaurar la promesa está superado (EPIC-FIX, ocho specs `hecho`), y
  EPIC-003 cerró el agujero sin remedio del primer minuto. `main` está en verde con
  27 specs `hecho` y ninguna en curso: **no queda defecto conocido que tape la promesa**.
  Lo que queda no es hacer la app mejor, es hacerla *presentable*.
  Cubre lo que obliga publicar: **rol por usuario** (el tester ve Panel, Vigiladas y
  Avisos; Cartera e Importar se ocultan), **versión visible**, **páginas legales** con
  descargo de no asesoramiento, **ayuda de Vigiladas**, **borrar mi cuenta** (supresión
  RGPD, hoy inexistente), **grifo del registro** cerrable sin desplegar, **estados
  vacíos que guían** y un **canal de feedback**.
  ⚠️ **Destapa R-1 (licencia de datos)**: el free tier de Marketstack no concede uso
  comercial ni redistribución, y ADR-012 asumió esa ambigüedad *"porque se compartirá
  con testers"*. Publicar en abierto es ese escenario. Ver "Ops y despliegue".

- **EPIC-FIX — Defectos en producción** (estado: aprobada; épica *bucket*).
  Sube a "Ahora" porque hay un defecto que **rompe la promesa central del producto**:
  la vigilancia (CE-1) y el P/L actual (CE-3) **no funcionan para el mercado principal
  del usuario**. El free tier de Twelve Data no cubre BME/M.CONTINUO y la cartera real
  es ~82% mercado continuo español; además el fallo es **silencioso** (el usuario solo
  ve "sin cotización"). La app está desplegada, así que lleva desde el despliegue sin
  cumplir lo prometido. Nada de lo demás importa hasta que esto funcione.
  Aprobada por humano el 2026-07-15.
  ↳ **Estado real a 2026-08-19**: **ocho** specs en `hecho` (SPEC-015, 016, 020, 021,
  024, 025, **029, 030**) y **SPEC-033 en `en-revision`**. La promesa está restaurada
  **de facto**; falta el cierre formal de la épica (moverla a "Entregado" cuando lo
  sanciones).
  ⚠️ **Cabo suelto detectado el 2026-08-19**: SPEC-033 está **mergeada en `main`** (PR #36,
  con su commit de GREEN) pero su frontmatter sigue diciendo `en-revision`. El estado no se
  cerró al mergear. No se toca desde aquí —`hecho` lo firma el verificador que juzgó, no
  otro— así que hay que cerrarlo en su propia línea de trabajo.
  ⚠️ **Residual levantado el 2026-08-20 desde EPIC-MEJORA — `F-SPEC-041-1`**: los metadatos
  del símbolo (`name`, `instrument_type`) se escriben **solo al insertar**. `getOrCreateSymbol`
  (`src/lib/portfolio/symbols.ts`) devuelve la fila tal cual si el símbolo ya existe, así que
  un `name` nulo **se queda nulo para siempre** aunque después otro usuario elija ese valor en
  el buscador y el proveedor sí traiga el nombre. El comentario del esquema —*"se rellenan
  solos cuando alguien vuelva a elegir ese valor"*— **no se cumple**; es el mismo hueco que
  `F-ADR-020-3` ya anotó para el tipo, ahora con consecuencia visible: SPEC-041 saca el nombre
  del activo a la tabla de Vigiladas, y esas filas se quedarán sin él. Es **escritura de
  datos**, no presentación, así que CE-M1 lo expulsa de EPIC-MEJORA. Sin spec asignada todavía.
  ⚠️ **Defecto observado el 2026-08-22 — el panel de edición se abre fuera de la pantalla.**
  Al pulsar "Editar" en una vigilada que está **arriba de la tabla**, el panel aparece tan
  abajo que el usuario no lo ve: parece que el botón no hizo nada. La causa está en
  `src/app/vigiladas/watched-table.tsx:263-270` — hay **un solo** panel (`id="editar-panel"`),
  renderizado **fuera de `.table-scroll`, después de la tabla entera**, con un comentario que
  lo declara deliberado para no heredar el ancho del scroll. Con 40 vigiladas, editar la
  primera abre un panel a 40 filas de distancia. **Es defecto, no mejora**: SPEC-044 entregó
  la edición y quedó `hecho` el 2026-08-21, así que hay una capacidad verificada que en la
  práctica no se puede usar — CE-M1 lo expulsa de EPIC-MEJORA por la misma frontera que
  separa "está roto" de "molesta". **Lo agrava que había guardia y no lo vio**:
  `tests/e2e/vigiladas-editar.spec.ts` mide el panel abierto **a 8 anchos** (geometría
  horizontal) y nunca comprobó su posición **respecto a la fila que lo abrió** — justo el
  tipo de ceguera que SPEC-040 dijo haber curado. Va a spec propia de EPIC-FIX; es lo
  primero de la tanda del 2026-08-22.

- **EPIC-003 — Recuperación y cambio de contraseña** (estado: borrador).
  **Por qué está aquí y no en "Después", pese al criterio de corte.** El criterio dice
  que no se compromete alcance nuevo hasta que EPIC-FIX restaure la promesa — y eso
  **ya ha ocurrido**: las seis specs de EPIC-FIX (015, 016, 020, 021, 024, 025) están
  `hecho`. El listón que ese criterio puso está superado; mantener la sección vacía
  sería respetar la letra de la regla contra su propósito.
  Y hay una razón propia, no derivada: la app se va a compartir con **testers externos**
  en un foro de bolsa, y hoy **un usuario que olvida su contraseña queda fuera para
  siempre** (única salida: tocar el hash a mano en Neon). Es el primer minuto de la
  relación con el producto y no tiene remedio.
  Además **no es alcance nuevo en sentido estricto**: el gate humano de SPEC-001
  (2026-07-13) ya resolvió que *"el flujo de reset será spec propia"*. Esta épica paga
  una deuda contraída, no amplía la ambición del producto.
  ⚠️ **Convierte F-SPEC-006-1 en bloqueante** (ver "Ops y despliegue"): sin Resend con
  dominio verificado no hay recuperación posible — el email no tiene fallback aquí.

- **EPIC-MEJORA — Mejoras de presentación y usabilidad** (estado: borrador; épica
  *bucket*). Nace el 2026-08-20 con el mismo papel que EPIC-FIX y EPIC-INFRA, pero en
  otro eje: EPIC-FIX protege la **verdad funcional**, EPIC-INFRA la **salud técnica**,
  y esta la **fricción de uso** de lo que ya funciona. Existía como destino citado en
  los "fuera de alcance" de otras épicas (EPIC-FIX manda aquí el backoff del proveedor
  y el alerting del ciclo) sin tener carpeta donde caer.
  **Por qué aparece ahora.** Hasta hoy la app tenía un solo usuario, que es su autor, y
  un autor no se queja de una interfaz que él mismo entiende. EPIC-004 la abre a
  desconocidos: a partir de ahí, un roce deja de ser molestia privada y pasa a ser la
  razón por la que un tester se va sin dejar feedback.
  **Por qué en "Ahora" y no en "Después".** Es *bucket*: no ocupa turno, acompaña. Está
  en "Ahora" porque tiene trabajo vivo — la tabla de `/vigiladas`, la pantalla que el
  tester va a mirar a diario: identifica las acciones **solo por su ticker** teniendo el
  nombre en la base de datos, **no se puede ordenar**, y el formulario de alta ocupa
  sitio permanente al servicio de una acción ocasional.
  ↳ **Segundo caso, 2026-08-22 — la app no tiene icono.** Observado por el humano en la
  pestaña real: no hay `public/`, ni `src/app/icon.*`, ni `favicon.ico`; `layout.tsx` solo
  declara `title` y `description`. El navegador sirve su folio en blanco en cada pestaña,
  marcador y pantallazo que un tester comparta en el foro. **No choca con la frontera de
  "identidad gráfica fuera"**: la marca ya existe en el código —el *wordmark*
  `Stockeiro` + `<span className="dot">.</span>` de `src/app/app-nav.tsx:45`, con el punto
  en `var(--accent)` (`globals.css:271`)— así que un icono hecho de **la inicial y ese
  punto** no inventa identidad, **aplica la que ya hay**. La intuición del humano al
  pedirlo (*"una S y un punto"*) coincide literalmente con el marcado existente. Ojo al
  alcance: manifiesto PWA, *apple-touch-icon*, imagen de Open Graph y *theme-color* son
  parientes cercanos y **ninguno está observado** — CE-M2 aplica.
  ↳ **Barrido de diseño encargado el 2026-08-22.** El humano pide ayuda con lo que él no
  ve (*"seguro que hay más"*). **No se especifica: se mira.** Es descubrimiento, no spec —
  redactar una spec de "mejorar el diseño" antes de mirar las pantallas sería exactamente
  lo que CE-M2 prohíbe, imaginar roces. Su salida es una **lista de roces observados** que
  entra aquí caso a caso, cada uno con dónde se vio.
  ⚠️ **No adelanta a EPIC-004** (R-M4): EPIC-004 sigue siendo lo único que separa el
  producto de su primer usuario real. Si esta mejora entra antes es porque es barata y
  toca esa misma pantalla, no porque haya cambiado la prioridad.
  ⚠️ **Colisiona con SPEC-039** (R-M1), que está en vuelo sobre `/vigiladas` y **aún no
  está en `main`**. Decidido contigo el 2026-08-20: se trabaja **en paralelo desde
  `main`**, en worktree propio; la segunda rama en llegar rebasa y reconcilia, y el
  estado vacío se respeta como territorio de SPEC-039.

## Entregado
> Lo que ya cumple su promesa. El detalle por spec vive en `docs/tablero.md`.

- **EPIC-001 — Vigilancia de zonas con cartera y avisos** (`hecho`). El núcleo:
  vigiladas + zonas, ingesta, motor de disparo, avisos, cartera con P/L y UI.
  ⚠️ Su promesa está **parcialmente incumplida en producción** por el defecto de
  cobertura de mercado → lo restaura EPIC-FIX.
- **EPIC-002 — Import de posiciones desde bróker** (`hecho`). Lee el `.xls` de ING,
  resuelve identidad con fusión manual, registra idempotente y lo expone en
  `/cartera/importar`. Coste en EUR neto; sin re-escalar splits.
- **EPIC-INFRA — Infraestructura y mantenimiento** (bucket, `aprobada`). Parcheo de
  CVE y línea mantenida de Next.js (ADR-008), una sola definición del esquema
  (SPEC-026) y CI en cada PR (SPEC-027).
  ↳ **Estado real a 2026-08-22**: todas sus 8 specs (SPEC-009, 010, 026, 027, 028, 031, 032, 042) están
  `hecho`; la épica bucket permanece abierta (no se cierran aunque todas sus specs lo estén).

## Después (comprometido, sin empezar)
<!-- La regla que lo vaciaba ("nada nuevo hasta que EPIC-FIX restaure la promesa") ya se
ha cumplido, pero eso no la convierte en barra libre: lo único que subió por su cuenta fue
EPIC-003, por las razones propias que allí se argumentan. EPIC-005 nació aquí el 2026-08-22
y subió a "Ahora" el mismo día por decisión del humano. -->

- **EPIC-006 — El historial de una vigilada** (estado: borrador; nace el 2026-08-22 a
  petición del humano).
  **Qué entrega.** Que una vigilada sepa decir **cómo ha estado**, no solo cómo está:
  cuándo entró en zona, **cuándo salió**, a qué precio y cuánto duró dentro.
  **El hallazgo que la justifica.** No es capacidad que haya que inventar: es dato que la
  app **ya calcula, ya guarda y hoy tira**. `zone_triggers` (`src/db/schema.ts:257`) tiene
  `zoneKind`, `price`, `asOf`, `openedAt` y `closedAt`; el ciclo **cierra los episodios**
  (`src/lib/triggers/service.ts:109`) y su función **devuelve `{ opened, closed }`**
  (línea 117). Y ahí muere: `src/lib/notifications/service.ts` solo crea `kind: 'entry'`
  (línea 107) y `kind: 'digest'` (línea 146). **La salida de zona se detecta, se persiste,
  se retorna — y no se cuenta en ninguna pantalla.** `/avisos` no lo cubre: es una bandeja
  plana y transversal de *avisos*, responde "¿qué me han notificado?", no "¿qué ha hecho
  **esta** acción?".
  **Por qué en "Después" y no en "Ahora".** Decidido contigo el 2026-08-22, y por dos
  razones que se refuerzan. La primera es de **valor no demostrado**: lo pediste con estas
  palabras — *"no es obligatorio, pero me gustaría ver si es útil"*—, así que su utilidad es
  **hipótesis a validar con testers** (R-4), no hecho. La segunda es de **orden técnico**:
  SPEC-045 (silenciar) está aprobada y sin implementar, y su **CE-4 ya obliga a contar lo que
  pasó mientras la vigilada callaba** — la misma materia prima. Que SPEC-045 fije primero cómo
  se le cuenta el pasado al usuario, y que el historial lo **herede** en vez de contradecirlo,
  vale más que ganar unos días (R-2).
  **Por qué épica propia.** Se descartaron las tres candidatas con su razón escrita:
  EPIC-MEJORA excluye *"una acción que la app no sabe hacer"* y esto responde una pregunta
  nueva en una superficie que no existe; EPIC-005 gobierna **actuar** sobre la vigilada, no
  consultar su pasado, y acaba de trazar la frontera del "historial de cambios de zona" —
  meter aquí un historial de *episodios* la emborronaría; EPIC-001 está en `hecho`.
  ⚠️ **Cero esquema** (CE-4): solo lee. Es la diferencia con el *historial de cambios de zona*,
  que EPIC-005 aparcó por exigir tabla nueva y que **sigue fuera**.
  ⚠️ **R-1, el riesgo serio**: `zone_triggers.price` está guardado **sin ajustar por splits**
  (RN-12, comentado en `src/db/schema.ts:269`). Un episodio anterior a un split enseñará un
  precio incomparable con el de hoy y el usuario leerá un movimiento que nunca ocurrió — y
  **parecerá un dato correcto**. Consúltese `sdd-mercados` al especificar.
  ⚠️ **Avisar de la salida queda FUERA**, y no por descuido: `vision.md` promete avisar
  *"cuando una acción entra en su zona"* y ADR-005 fijó el modelo *edge-triggered* sobre esa
  promesa. Un aviso de salida **cambia la promesa del producto** y necesita su propio gate.
  Esta épica **cuenta** la salida; no la notifica.

## Más adelante (idea, sin compromiso)
- **Observabilidad del ciclo diario**: registrar el resultado de cada ejecución del cron
  (ingeridos / saltados / avisos) y **alertar si falla**. Hoy solo se sabe mirando logs o
  viendo un `asOf` viejo — así se tardó en detectar el defecto de cobertura. Idea nacida
  de EPIC-FIX; el aviso *al usuario* (CE-F2) sí entra en EPIC-FIX, esto es el aviso *al
  operador*.
- **Zonas calientes**: una acción a un X% de entrar en su zona (aún FUERA) se marca como
  "caliente" para seguirla de cerca; no dispara todavía, pero anticipa la entrada. Complementa
  el motor de disparo (SPEC-005) sin sustituirlo. Requeriría definir el umbral (% o distancia)
  y si genera aviso propio o solo señal en la UI.
- **Mejoras de la bandeja de avisos** (aparcadas en SPEC-007, para no bloquear el MVP):
  filtros y paginación del inbox (por tipo/ticker/fecha), archivar/borrar avisos, y
  actualización en vivo del estado de zona / contador (hoy se refresca al navegar; el tiempo
  real choca con D-2, por eso es idea, no compromiso).
- **Preferencias de notificación** (F-SPEC-006-2): silenciar, elegir canal/frecuencia por
  usuario; reintentos/backoff del proveedor de email y retención del log de avisos.
- Multi-moneda y fiscalidad (P/L con comisiones, dividendos, splits, ventas parciales).
- Import por **conexión** con el bróker (API, sin fichero) y **otros formatos/brókers**
  (CSV, PDF): evolución de EPIC-002, que en v1 solo lee el `.xls` de ING. La conexión
  a la cuenta real choca con la visión ("la app no opera"); idea, sin compromiso.
- Ajuste automático por **eventos corporativos** (re-escalar cantidades/precios en
  splits/contrasplits): EPIC-002 lo delega en confirmación humana; automatizarlo
  requiere una fuente de eventos fiable. *(El proveedor que entra por EPIC-FIX expone
  `split_factor`/`dividend`, lo que lo haría más viable — pero sigue sin compromiso.)*
  ⏸️ **Continuidad del valor: EN STAND-BY por decisión humana (2026-08-21).** Hubo una
  EPIC-003 anterior —*"continuidad del valor a través de eventos corporativos"*— con
  SPEC-017 (`hecho`), SPEC-018 (`RED`, 7/9) y SPEC-019 (`aprobada`), que **nunca llegó a
  `main`**: su hueco lo ocupó *"Recuperación y cambio de contraseña"* cuando EPIC-FIX se
  volvió urgente. Su trabajo sigue vivo en la **PR #21** (`ft/EPIC-003-continuidad-del-valor`),
  que **se deja abierta a propósito**.
  **Motivo del stand-by, en palabras del humano**: *"es algo demasiado complejo que aporta
  muy poco valor"*. Y es consistente con el caso real que lo originó — PharmaMar,
  contrasplit 12:1 con cambio de nombre: el problema solo afecta a los valores que **han
  pasado por un evento corporativo**, no a la cartera entera, y exige modelar linaje de
  símbolos, posición derivada y re-escalado con confirmación.
  **Qué lo reabriría**: que un tester del foro se tope con el caso y lo reporte, o que la
  cartera real acumule suficientes valores con eventos corporativos como para que el "—"
  permanente del P/L deje de ser una anécdota. Hasta entonces, no se toca.
- Canales de aviso adicionales (push móvil / app nativa).
- Analítica histórica de la cartera y de aciertos de zona.
- **Analítica de uso y retención** (cuántos usuarios vuelven, qué secciones tocan):
  dejado **fuera de EPIC-004 a propósito**. Con veinte testers es una consulta SQL en
  Neon y no cambia ninguna decisión de la primera semana. EPIC-004 sí entrega los
  contadores operativos mínimos (cuentas, vigiladas, último ciclo) en su pantalla de
  admin — eso es *saber si está vivo*, no analítica de producto.
- **Flags de capacidad por usuario individual** (abrir una sección a personas
  concretas): EPIC-004 resolvió la visibilidad con **rol**, que cubre el caso de hoy.
  Se reabre el día que haya que abrir Cartera a tres personas y no a las demás.
- **Exportar mis datos** (portabilidad RGPD): EPIC-004 entrega solo la **supresión**,
  que es la que bloquea publicar. La portabilidad, cuando alguien la pida.
- **F-SPEC-001-1** (deuda técnica de hardening, derivado de SPEC-001): reforzar el
  aislamiento entre usuarios con Row Level Security (RLS) en Postgres. Hoy el
  aislamiento vive en capa de app y CA-6 lo cubre; RLS es refuerzo futuro, no bloqueante.

## Criterios de corte
<!-- Qué haría subir o bajar una épica de sección. -->
- Sube a "Ahora" lo que **restaure una promesa incumplida** de una épica entregada
  (defecto en producción) — tiene prioridad sobre cualquier alcance nuevo.
- Sube a "Ahora" lo que desbloquee un criterio de éxito aún no entregado.
- Baja a "Más adelante" todo lo que amplíe alcance antes de que lo entregado funcione
  de verdad (más instrumentos, tiempo real, operar): son mejoras, no el problema.

## Ops y despliegue (estado)
<!-- Acciones de ops; no son épicas ni cambian de sección. El runbook es docs/despliegue.md. -->
**La app está desplegada** en <https://stockeiro.tremen.dev> desde 2026-07-14 (dominio
propio desde 2026-08-18; el `*.vercel.app` sigue respondiendo), con
Neon + Marketstack + Twelve Data + Resend + cron diario activos. El esquema **se migra solo en el build**
(`vercel.json`: `buildCommand = db:migrate && build`), así que una spec con cambio de
esquema no necesita paso manual.

- ✅ **F-SPEC-001-2** (Neon + `AUTH_SECRET`) — **cerrada**.
- ✅ **F-SPEC-004-1** (`TWELVE_DATA_API_KEY` + `CRON_SECRET` + Vercel Cron) — **cerrada**.
  ⚠️ Aprovisionada, pero el **free tier no cubre BME** → es el defecto que ataca EPIC-FIX.
- ✅ **F-SPEC-006-1** (Resend: `RESEND_API_KEY` + `RESEND_FROM` + dominio verificado) —
  **CERRADA y PROBADA el 2026-08-18** (dominio `tremen.dev` verificado, un reset real
  entregado). Fue bloqueante desde 2026-08-11 porque EPIC-003 no tiene fallback: la
  recuperación de contraseña viaja por email o no viaja. Runbook §7 y §8.
- 🟡 **F-EPIC-004-1 — Plan de Marketstack (R-1 de EPIC-004)**: el free tier **no concede
  derechos de uso comercial ni de redistribución**, y ADR-012 asumió esa ambigüedad
  explícitamente *"porque la app se compartirá con testers"*. Publicar en un hilo abierto
  de un foro es ese escenario, ya sin ambigüedad — y las páginas legales de EPIC-004
  tendrán que declarar de dónde vienen los precios. **Mitigación conocida: plan Basic
  ($9.99/mes), misma key, cero código.** No es una spec: es una decisión de ops.
  ↳ **Decidido en el gate de EPIC-004 (2026-08-19, Alberto Fojo): se publica con el
  free tier; el paso a Basic queda para más adelante.** Riesgo **asumido a conciencia**.
  Queda abierta como recordatorio, no como bloqueo. Se revisa si el uso crece, si
  Marketstack lo reclama, o antes de cualquier cobro a usuarios.
- ⏳ **F-SPEC-011-1** (el build debe alcanzar `cdn.sheetjs.com`; `xlsx` viene del CDN por
  los CVE del paquete npm) — registrado en el runbook §6.
- ⏳ **F-SPEC-012-1** (validar el mapeo mercado→MIC contra el proveedor real) — **lo
  absorbe EPIC-FIX**: es la misma raíz (operating MIC vs segment MIC).
- ⚠️ **Preview comparte la BD de producción**: `DATABASE_URL` está definida para
  `Production, Preview` con un único valor, y el build migra en **todos** los entornos →
  **una PR migraría producción**. Arreglo: BD Neon aparte para Preview (runbook §6).
