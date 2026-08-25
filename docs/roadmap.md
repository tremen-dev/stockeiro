---
tipo: roadmap
---
# Roadmap — Stockeiro

> Curado por sdd-producto. Secuencia de épicas, horizonte y criterios de corte.
> El estado fino por spec vive en el tablero; aquí vive la INTENCIÓN.

## Ahora (en curso)
- **EPIC-008 — El precio al momento: la vigilada recién dada de alta no espera al ciclo**
  (estado: borrador; nace el 2026-08-25 a petición del humano, sobre la pantalla real).
  **Qué entrega.** Que dar de alta una vigilada **devuelva su precio en el acto**. Hoy el
  único camino por el que un precio entra en la base es el cron `0 22 * * *`
  (`vercel.json` → `refreshQuotes`), y el alta —`watchAction` → `watchSymbol`
  (`src/lib/watchlist/service.ts:51`)— **crea la vigilada sin pedir precio**: mete el
  símbolo en el universo del ciclo y ahí acaba. Entre el alta y las 22:00 hay **hasta 24
  horas** en las que la fila recién creada o no tiene cotización (símbolo nuevo, estado
  neutro y **sin diagnóstico**, porque no ha fallado nada: es que el ciclo no ha corrido) o
  enseña **el precio viejo** que quedó congelado cuando alguien dejó de seguirla, marcado
  *sin refrescar* (SPEC-043). Es la primera capacidad de **refresco bajo demanda** del
  producto.
  **Por qué manda ahora.** Es **una spec y un punto de llamada**, y toca el primer minuto de
  la pantalla que EPIC-004 puso delante de testers que llegan **sin sus vigiladas puestas**:
  el gesto inaugural del producto —*vigila esto*— hoy se responde con una fila muda.
  **No desplaza a EPIC-005 ni a EPIC-007**: cabe en paralelo, con worktree propio, como ya
  se trabaja aquí.
  ⚠️ **Es alcance nuevo por delante de lo comprometido** (R-5), y conviene que conste: entra
  por petición del humano del 2026-08-25, no por el criterio de corte. Si prefiere que
  espere, baja a "Después" con un renglón.
  ⚠️ **Probable ADR** (R-1), y es lo que decide si cabe en una sesión: mete una llamada de
  red **síncrona a un tercero dentro de una server action de escritura**, que hasta hoy solo
  hablaba con la base. Y obliga a **escribir** la lectura de **D-2** que la sostiene: *el
  precio se puede pedir bajo demanda; el disparo sigue evaluándose en el ciclo*.
  ⚠️ **La pantalla y el correo van desacompasados, a propósito** (R-3). El estado de zona se
  computa en render (`zoneStatusForUser`), así que un precio fresco pinta «En compra» al
  instante — pero el **aviso** sigue saliendo a las 22:00. Decisión del humano del
  2026-08-25: avisar al momento reinterpretaría D-2 (*locked*) y el modelo *edge-triggered*
  de ADR-005, y eso necesita su propio gate.
  ⚠️ **Coste medido, no temido** (R-2): en la unidad de ADR-027 pto. 1 hoy son **13 × 31 ≈
  400 unidades/mes contra 10.000** (ADR-032, margen ~25×); un refresco al alta cuesta **1**.
  El techo del plan sigue siendo **~322 símbolos distintos vigilados**, no las altas. Lo que
  sí hay que impedir es que el gesto sea repetible a voluntad: `watchSymbol` es *upsert*.
  ⚠️ **Cero esquema.** No añade ni una columna: escribe en `quotes` por el mismo `upsertQuote`
  que ya usa el ciclo. **Cartera, import y un botón de «actualizar ahora» quedan FUERA**, por
  decisión del mismo día — la épica es el sitio donde se gobiernan cuando se pidan.

- **EPIC-007 — La app en el teléfono** (estado: borrador; nace el 2026-08-24 por decisión
  del humano, con su primera spec **ya aprobada**).
  **Qué entrega.** Que Stockeiro se pueda **usar** desde un móvil, no solo abrir. Hoy la
  única adaptación al ancho son cinco bloques `@media (max-width: 720px)` en `globals.css`
  que **aprietan separaciones** (`.app-nav { gap: 12px }`, `:516`) — **ningún elemento
  cambia de forma en ningún ancho**. La tabla de `/vigiladas`, nueve columnas, se resuelve
  arrastrándola de lado dentro de `.table-scroll`: fue la salida correcta al defecto de
  SPEC-040, pero no es una interfaz móvil.
  **Por qué manda ahora.** EPIC-004 abrió la app a testers externos y el enlace se comparte
  en un **foro de bolsa**. Un enlace en un foro se abre en el teléfono: el móvil es **el
  camino de entrada por defecto**, no un extra. Y el trabajo empieza hoy — SPEC-054 está
  aprobada y entra a implementación.
  **No desplaza a EPIC-005**, que sigue siendo lo comprometido y sin entregar. Tampoco es
  alcance nuevo saltándose el criterio de corte: es alcance **ya aprobado** que cambia de
  dirección, no que se cuele.
  **Por qué épica propia.** Nació en EPIC-MEJORA —SPEC-054 se escribió allí— y la sacó **su
  propio CE-M3**: la spec necesita **ADR-034**, y eso obliga a replantear el encaje. El
  replanteo (humano, 2026-08-24) concluyó que EPIC-MEJORA es un *bucket* de roces sueltos y
  esto es una **superficie entera del producto** con un breakpoint de modo, una regla de
  conmutación y un medidor nuevo detrás.
  ⚠️ **Destapa un agujero de instrumentación, y es el hallazgo serio**: la guardia de
  geometría mide 360 y 390 desde SPEC-040 (`tests/e2e/geometria.ts:66`) pero cubre **nueve
  rutas de dieciséis** (`geometria-rutas.spec.ts:49,52`). **`/cartera` no se mide a ningún
  ancho**, y lleva así desde SPEC-002: una de las dos tablas del producto está fuera del
  radar. CE-2 lo cierra.
  ⚠️ **El medidor de área táctil nace rojo** (R-1): `.btn-sm` mide ≈31 px de alto contra un
  suelo de 44, y lo usan *Editar*, *Quitar* y el control de orden. Es deuda que llevaba
  oculta por no tener quien la mirase; la épica **descubre trabajo a medida que avanza**.
  ⚠️ **Colisiona con SPEC-045** (R-3), aprobada y sin implementar sobre `/vigiladas`, que
  añade una tercera acción a la fila. **Decidido: SPEC-054 primero**; SPEC-045 hereda el pie
  de tarjeta y quien la implemente debe leer ADR-034 §10, que ya deja resuelta la aritmética:
  a 360 px caben dos controles a ~146 px, **tres a ~95** — así que cuando el pie pase de dos,
  se **apila**; nunca se encoge ni se esconde.
  ⚠️ **La salida que ADR-026 prohíbe está viva en el CSS servido** (R-2): la app carga
  `design/tremen-ds/responsive.css` por una cadena de tres `@import` desde `globals.css:3`, y
  ese fichero declara `html, body { overflow-x: hidden }` bajo 720 px. Hoy, en producción, el
  desbordamiento horizontal del documento está tapado — que es justo por lo que ADR-026 exige
  medir **elemento a elemento** y no fiarse del `scrollWidth` de `body`.
  ⚠️ **Cero esquema y cero capacidad nueva**: esta épica no enseña nada que la app no sepa
  hacer ya. App nativa, push y manifiesto PWA quedan **fuera** y siguen en "Más adelante".

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
  ✅ **R-1 (licencia de datos) — CERRADO el 2026-08-23.** Destapó que el free tier de
  Marketstack no concedía uso comercial ni redistribución, ambigüedad que ADR-012 asumió
  *"porque se compartirá con testers"* y que publicar en abierto convertía en escenario
  real. Se extingue al contratar el **plan Basic (10.000/mes)**, que sí concede uso
  comercial. Las páginas legales **no cambian**: siguen sin afirmar derechos sobre las
  cotizaciones, ahora por prudencia elegida y no por falta de licencia. Ver
  "Ops y despliegue" (`F-EPIC-004-1`) y **ADR-032**.

- **EPIC-FIX — Defectos en producción** (estado: aprobada; épica *bucket*).
  Sube a "Ahora" porque hay un defecto que **rompe la promesa central del producto**:
  la vigilancia (CE-1) y el P/L actual (CE-3) **no funcionan para el mercado principal
  del usuario**. El free tier de Twelve Data no cubre BME/M.CONTINUO y la cartera real
  es ~82% mercado continuo español; además el fallo es **silencioso** (el usuario solo
  ve "sin cotización"). La app está desplegada, así que lleva desde el despliegue sin
  cumplir lo prometido. Nada de lo demás importa hasta que esto funcione.
  Aprobada por humano el 2026-07-15.
  ↳ **Estado real a 2026-08-23**: **trece** specs en `hecho` (SPEC-015, 016, 020, 021,
  024, 025, 029, 030, 033, 040, 043, **046, 048**) y ninguna en curso. La promesa está
  restaurada **de facto**; falta el cierre formal de la épica (moverla a "Entregado"
  cuando lo sanciones).
  ↳ *El cabo suelto de SPEC-033 quedó cerrado: su frontmatter pasó a `hecho` el 2026-08-21,
  firmado por el verificador que la juzgó.*
  ↳ **Lo que entró el 2026-08-22/23 no es más cobertura de mercado, y conviene saberlo.**
  SPEC-046 y SPEC-048 no restauran la promesa —eso ya estaba hecho— sino que reparan **la
  capacidad de esta épica para detectar sus propios fallos**: SPEC-046 arregló un panel de
  edición que se abría fuera de la pantalla **y la guardia geométrica que no lo vio**, y
  SPEC-048 destapó que tres guardias caducaban al mergear y que **otras doce pasaban sin
  mirar nada**. Es defecto de instrumentación, no de producto, pero cae aquí por la misma
  razón que todo lo demás: algo prometido no estaba siendo cierto.
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
  ⚠️ **Caso hermano del de SPEC-052, observado el 2026-08-24 y NO cubierto por ella.**
  SPEC-052 (en vuelo, `en-revision`) ataca el `APP_BASE_URL` **ausente**: sin la clave, el
  build revienta desde que SPEC-051 metió `metadataBase: new URL(appBaseUrl())` en el layout.
  Lo que se topó el implementador de SPEC-054 es el caso **contrario y peor**: la clave
  **está**, pero **envenenada**. `.env.production.local` —que Next carga **por encima** de
  `.env`— trae `APP_BASE_URL=[SENSITIVE]`, el literal, de un `vercel env pull`. El build
  muere con un `Invalid URL` que **no nombra ni la clave ni el fichero**, y que aparece justo
  cuando el desarrollador cree haber hecho lo correcto (definir `DATABASE_URL`). Se arranca
  con `APP_BASE_URL=http://localhost:3200 npm run build`.
  ✅ **CERRADO por SPEC-055** (`hecho`, GREEN 13/13 el 2026-08-24). `appBaseUrl()` valida
  ahora el **valor** y no sólo su presencia, y el mensaje nombra clave, valor, forma esperada
  y la precedencia de `.env.production.local` sobre `.env`.
  ↳ **Y lo que destapó al especificarlo pesa más que el build**: con la clave envenenada el
  valor entraba **vivo** en `requestPasswordReset`, y el estallido caía **después** de las dos
  salidas tempranas (`src/lib/auth/password-reset.ts:79-107`). Email inexistente → acuse
  normal; email existente → `invalidateLiveTokens`, insert, y `buildResetUrl` lanza. **200 vs
  500 es un oráculo de enumeración de cuentas**, justo lo que SPEC-023 CA-1/CA-12 cerró por
  diseño, y de propina el usuario legítimo perdía su enlace vivo. Con la clave **ausente** no
  ocurría: `appBaseUrl()` se evalúa como argumento en `src/app/(auth)/actions.ts:128`, antes
  de entrar. **Era el envenenamiento, y sólo él, el que movía el fallo al lado malo.**
  ⚠️ **Era LATENTE, no vivo**, y conviene decirlo con todas las letras: `metadataBase` se
  evalúa en tiempo de **build**, así que un despliegue de producción con la clave envenenada
  **no llega a existir**. Medido, no deducido: `curl https://stockeiro.tremen.dev/login`
  devuelve `og:url = https://stockeiro.tremen.dev`, que sale de `metadataBase` ← `appBaseUrl()`.
  No hubo incidente que investigar ni usuarios a los que avisar.
  ↳ *Corregido el 2026-08-25: esta entrada decía que el build muere en `/_not-found`. La ruta
  es **variable** —Next genera con quince workers y nombra la del que estalla primero; se han
  medido `/register`, `/admin`, `/ayuda` y `/_not-found` en corridas distintas de la misma
  escena—, y el diagnóstico bueno viaja dentro de `[cause]`, en la segunda línea.*
  Comprobado que SPEC-052 **no lo menciona**: su texto no cita `.env.production.local`, ni
  `vercel env pull`, ni el marcador `[SENSITIVE]`, ni la precedencia entre ficheros de
  entorno. Es la misma superficie y merece entrar por la misma puerta —probablemente ampliando
  SPEC-052 antes de que cierre, que sale más barato que una spec nueva—, pero **la decisión es
  de quien gobierne SPEC-052**, que va en otra sesión. Sin spec asignada todavía.

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
  ↳ **CE-M3 se ejerció por primera vez, 2026-08-24 — y expulsó una spec.** El humano pidió
  adaptar la vista a móvil; el arquitecto escribió **SPEC-054** aquí y con ella **ADR-034**.
  CE-M3 dice que si una spec necesita ADR nuevo hay que replantear su encaje, y el replanteo
  concluyó que no encaja: **se fue a EPIC-007**, con su ADR. Vale la pena anotarlo porque el
  criterio funcionó **como red, no como trámite** — la spec ya estaba escrita y aprobada
  cuando saltó, y aun así movió la carpeta en vez de mirar hacia otro lado.
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
  ⚠️ **Trabajo vivo entrante desde EPIC-FIX — `F-SPEC-048-2` (2026-08-23)**: quedan en el repo
  **guardias que congelan listas cerradas por estado** y que caducarán solas cuando el proyecto
  crezca. SPEC-048 cerró para siempre una familia del defecto (la que compara contra una revisión
  **móvil** de git, ahora vigilada por RI-03) pero **no ésta**: series `RI`/`RN`, los `scripts` de
  `package.json`, los ficheros de `drizzle/`, los workflows. La frontera para decidir cuáles hay
  que tocar está escrita en SPEC-048: **¿la lista crece por diseño o está cerrada por diseño?** Una
  lista cerrada congelada al milímetro es una guardia **correcta** —su rojo dice *"alguien añadió
  algo sin un CA detrás"*—; una que crece es una **foto**, y su rojo solo dice *"el proyecto
  avanzó"*. Hay una **localizada y viva**: `tests/reglas-ingenieria-hecho-vivo.test.ts:181-183`
  congela la serie `RN` y se pondrá roja el día que se escriba `RN-17`. Se dejó sin tocar a
  propósito: la autorización de SPEC-048 CA-13 era nominal y no la cubría.
  Cae aquí y **no** en EPIC-MEJORA porque su CE-M1 excluye defectos: una guardia que puede
  quedarse vacía no es fricción de uso, es salud técnica. Sin spec asignada todavía.
  ⚠️ **Dos roces de herramienta, observados el 2026-08-22 al correr dos worktrees a la vez**:
  `tests/e2e/server.mjs` fija los puertos **3200 y 54329** a fuego, así que dos ramas no pueden
  correr la e2e simultáneamente —le pasó a dos verificadores—; y `npm run build` **falla sin
  `DATABASE_URL`** dejando `.next` sin `BUILD_ID`, con un mensaje que no señala la causa. Ninguno
  es defecto de producto; los dos cuestan tiempo cada día que se trabaja en paralelo, que es como
  se trabaja aquí.

## Después (comprometido, sin empezar)
<!-- La regla que lo vaciaba ("nada nuevo hasta que EPIC-FIX restaure la promesa") ya se
ha cumplido, pero eso no la convierte en barra libre: lo único que subió por su cuenta fue
EPIC-003, por las razones propias que allí se argumentan. EPIC-005 nació aquí el 2026-08-22
y subió a "Ahora" el mismo día por decisión del humano. -->

- **EPIC-006 — El historial de una vigilada** (estado: **borrador — sin gate humano**; nace
  el 2026-08-22 a petición del humano).
  ⚠️ **Está en `main` sin firmar, y es una anomalía de proceso, no una aprobación tácita.**
  Su documento viajó dentro de las ramas de SPEC-046 y SPEC-047 —se crearon desde el commit
  de producto para que cada spec llevara su justificación al lado— y entró al mergear los PR
  #52 y #53. **Que exista en `main` no la aprueba**: sigue en `borrador` y nada suyo se codea
  hasta que el humano lo diga. Se retira si no la quiere.
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
- ✅ **F-EPIC-004-1 — Plan de Marketstack (R-1 de EPIC-004)** — **cerrada el 2026-08-23**:
  contratado el **plan Basic (10.000 peticiones/mes, ~$9.99/mes)** sobre **cuenta propia
  del titular**. La mitigación se ejecutó **tal como estaba escrita** —misma key, cero
  código—, así que no hubo despliegue ni cambio de variables de entorno.
  ↳ Historia, porque explica el porqué: el free tier **no concedía derechos de uso
  comercial ni de redistribución**; ADR-012 asumió esa ambigüedad *"porque la app se
  compartirá con testers"*, y el gate de EPIC-004 (2026-08-19, Alberto Fojo) decidió
  **publicar igualmente con el free tier**, dejando el paso a Basic "para más adelante".
  Ese "más adelante" fue **cuatro días**. Lo que lo precipitó no fue la licencia sino la
  **cuota**: el incidente del 2026-08-19/20 (tres días de precios congelados, ADR-027)
  midió que 13 símbolos × ~31 días ≈ **400 unidades/mes** contra las **100** del free
  tier. Con Basic hay margen **~25×**, y el riesgo de licencia **desaparece de raíz**:
  el plan de pago sí concede uso comercial.
  ↳ **Lo que NO cambia**, y es deliberado: las páginas legales siguen declarando la
  fuente y el carácter meramente informativo del dato, **sin afirmar derechos** sobre
  las cotizaciones. Ya no es una restricción de licencia — es **prudencia elegida**.
  Decisión del humano el 2026-08-23. El motivo actualizado vive en `docs/fundacion/
  dominio.md` y en **ADR-032**.
- ⏳ **F-SPEC-011-1** (el build debe alcanzar `cdn.sheetjs.com`; `xlsx` viene del CDN por
  los CVE del paquete npm) — registrado en el runbook §6.
- ⏳ **F-SPEC-012-1** (validar el mapeo mercado→MIC contra el proveedor real) — **lo
  absorbe EPIC-FIX**: es la misma raíz (operating MIC vs segment MIC).
- ⚠️ **Preview comparte la BD de producción**: `DATABASE_URL` está definida para
  `Production, Preview` con un único valor, y el build migra en **todos** los entornos →
  **una PR migraría producción**. Arreglo: BD Neon aparte para Preview (runbook §6).
