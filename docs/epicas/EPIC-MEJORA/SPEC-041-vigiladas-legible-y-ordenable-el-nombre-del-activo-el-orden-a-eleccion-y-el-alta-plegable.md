---
id: SPEC-041
tipo: spec
epica: EPIC-MEJORA
estado: en-progreso
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-20, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-20, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-20, por: sdd-implementador}
---
# SPEC-041 — Vigiladas legible y ordenable: el nombre del activo, el orden a elección y el alta plegable

## Problema

`/vigiladas` es **la pantalla donde vive la promesa del producto** y la única que un `tester`
—el rol con el que nace toda cuenta nueva (**ADR-021**)— ve a diario. Hoy cumple lo que
prometió: el color de fondo dice el estado de zona (**SPEC-007**), el motivo del «no se
vigila» está a la vista (**SPEC-016**), tipo y mercado distinguen dos filas del mismo ticker
(**SPEC-029**) y quitar borra la vigilada correcta y no otra (**SPEC-024**). **Nada de eso
está roto.** Lo que cuesta es *usarla*, y por eso esto es EPIC-MEJORA y no EPIC-FIX.

Los tres roces están **observados sobre la pantalla real** por el humano el 2026-08-20
(**CE-M2**) y verificados en el código de `origin/main` antes de escribir esta spec:

1. **La tabla identifica cada acción solo por su código.** `src/app/vigiladas/page.tsx` abre
   con una columna `Ticker` y nada más: `ITX`, `SAN`, `TEF`. El nombre **ya está en la base de
   datos** —`symbols.name`, el *instrument_name* del proveedor, que `getOrCreateSymbol`
   (`src/lib/portfolio/symbols.ts`) guarda al crear el símbolo desde el buscador— pero
   `zoneStatusForUser` (`src/lib/watchlist/zone-status.ts`) **ni siquiera lo selecciona**. El
   buscador sí lo enseña al elegir (`symbol-chip-name`), o sea que el usuario **ve el nombre
   al dar de alta y lo pierde al día siguiente**. Quien no se sepa los tickers de memoria no
   reconoce su propia lista: el autor se los sabe, un desconocido del foro no.
2. **El orden es fijo.** `zoneStatusForUser` cierra con `.orderBy(symbols.ticker)` y no hay
   ningún control en pantalla. La pregunta que el usuario se hace cada mañana —*¿cuáles están
   en zona?*— se responde recorriendo la tabla entera a ojo, precisamente la tarea para la que
   el color de fondo de SPEC-007 era una ayuda y no una respuesta.
3. **El formulario de alta ocupa sitio siempre.** `<WatchForm />` se renderiza al final del
   `<main>` **fuera del condicional** de lista vacía: con 0 vigiladas y con 40. Es un bloque
   grande —buscador de símbolos, cuatro campos de zona y un botón— al servicio de una acción
   **ocasional**, compitiendo por la pantalla con la información de **consulta diaria**.

Y hay un cuarto hecho que ata los tres: **el ancho**. La columna `Estado` es la más ancha de
la tabla, pero no por su etiqueta —la más larga es «En compra y venta»— sino porque en el
estado `none` la misma celda mete además un párrafo entero: el motivo de SPEC-016
(«⚠ No se vigila: …») o «Aún sin datos: se ingiere en el próximo ciclo diario». Ese párrafo
**estira la columna** y, con ella, la tabla dentro de `.table-scroll` (que en ≤ 720 px es
`overflow-x: auto`). Es decir: el sitio para el nombre y el sitio que suelta `Estado` son
**el mismo reparto**, exactamente como anticipó la épica al pedir una sola spec y no tres.

### Lo que ya no es un riesgo, y lo que pasó a serlo (actualizado 2026-08-20, tras el gate)

**SPEC-039 se mergeó a `main` (PR #42) y está `hecho`.** El *«conflicto probable, quien llegue
segundo rebasa»* que traía **R-M1** de la épica **ha dejado de existir**: esta rama está
rebasada sobre `784c1ea` y **ya tiene** el estado vacío de SPEC-039 delante. Lo que era riesgo
de coordinación es ahora una **restricción de no regresión**, y como tal se escribe: en
`src/app/vigiladas/page.tsx` viven hoy el bloque `.empty` con `data-testid="vigiladas-vacio"`,
los textos de `VACIO_VIGILADAS` (título, primer paso y ejemplo **con números**), la línea
`CADENCIA_LINEA` y el enlace a `RUTA_AYUDA`, todos servidos desde `src/lib/help/content.ts`.
Esta spec **no puede romper nada de eso** (CA-21) y **no lo reescribe**.

Y hay un detalle literal que ata SPEC-039 con el punto 3 de esta spec, y conviene leerlo
entero antes de discutir el plegado: `VACIO_VIGILADAS.primerPaso` dice **«Empieza aquí
abajo…»**. Es una promesa de **posición**, no una invitación genérica: el formulario tiene que
seguir estando **justo debajo** de ese bloque y desplegado (CA-12). Plegarlo también en el
vacío no sería solo empeorar el onboarding: dejaría a la app **mintiendo por escrito**.

En su lugar aparece un riesgo nuevo que no existía cuando se escribió el borrador: **SPEC-040
(EPIC-FIX) arregla la geometría de este mismo formulario en móvil**, con **ADR-026** detrás, y
está viva en paralelo. Se trata en §Riesgos (**R-2**, **R-3**).

Esta spec cubre **CE-M4** y se somete a **CE-M1** (no cambia ni un dato, ni un cálculo, ni una
regla) y a **CE-M3** (sin migración, sin proveedor nuevo y **sin ADR**).

Reglas en juego, todas por respeto y ninguna por cambio: **RN-01** (la tabla sigue saliendo de
`zoneStatusForUser`, filtrada por el `userId` de la sesión; ordenar no es una consulta nueva),
**RN-10** y **RN-11** (las zonas y la pertenencia a zona no se tocan: el `state` de cada fila
se sigue calculando con `entraEnZona` **en el servidor**), **RN-03** (`/vigiladas` sigue
exigiendo sesión) y **RI-01** (no hay migración que pueda incumplirla: **no hay migración**).

## Usuarios / roles afectados

- **Usuario con lista (`tester`, `completo` o `admin`)**: reconoce cada fila por el nombre del
  activo sin saberse el ticker, puede poner arriba lo que le interesa —por nombre o por
  estado— sin leer la tabla entera, y recupera la pantalla que ocupaba un formulario que casi
  nunca usa.
- **Usuario que llega con cero vigiladas**: **no pierde nada**. El formulario le sigue saliendo
  desplegado sin tocar nada (CA-12), que es justo el «primer paso a la vista» que **SPEC-039**
  CA-9 exige. Esta spec **no** redefine qué texto acompaña a ese vacío: eso es territorio de
  SPEC-039 (ver §Notas, pto. 8).
- **Usuario con símbolos legacy** (dados de alta antes de que el buscador guardara el nombre, o
  creados por el camino sin mercado de `getOrCreateSymbol`): ve la fila **exactamente como
  hoy**, con su ticker y sin nombre inventado (CA-3).
- **Usuario en móvil**: gana ancho en vez de perderlo — la tabla no suma columnas y `Estado`
  deja de estirarse (CA-4, CA-14).
- **Quien implemente SPEC-040 (EPIC-FIX, *el móvil completa el alta*)**: comparte componente.
  Ella arregla **cómo mide** el formulario; esta decide **cuándo está a la vista**. Reparto de
  territorio en §Riesgos **R-2** y en §Notas, pto. 8.

## Criterios de aceptación

Cada CA es verificable con un test: la vista y el orden con **Vitest** (PGlite para lo que toca
base; función pura para el comparador), y la pantalla real con **Playwright** contra Postgres
efímero. Los CA de pantalla están escritos para comprobarse **mirando el DOM renderizado**, no
la intención.

### El nombre del activo

- **CA-1 (La vista trae el nombre, sin tocar el esquema ni la consulta que ya existía).**
  Dada una acción vigilada cuyo símbolo tiene `symbols.name` = «Industria de Diseño Textil SA»,
  cuando se llama a `zoneStatusForUser(db, userId)`,
  entonces la fila devuelta incluye ese nombre en un campo propio de `ZoneStatusView`; y **no
  hay ninguna migración nueva** en `drizzle/`, ni cambia ninguna columna de `src/db/schema.ts`.
  El `orderBy(symbols.ticker)` de la consulta **se mantiene**: es el orden por defecto (CA-6) y
  la base del desempate (CA-9).

- **CA-2 (La tabla enseña ticker y nombre, y el ticker sigue siendo el ancla).**
  Dada una lista con esa acción,
  cuando el usuario abre `/vigiladas`,
  entonces en **la primera columna** lee el **ticker** (destacado, como hoy: clase `.ticker`)
  **y**, bajo él, el **nombre del activo** en tono secundario; ambos en la **misma celda**, sin
  que la tabla haya ganado ninguna columna nueva respecto a hoy. La cabecera de esa columna es
  **«Activo»** (término del dominio, §Notas pto. 7) y el número total de `<th>` de la tabla es
  **el mismo que antes de esta spec**.

- **CA-3 (Sin nombre no se inventa un nombre — R-M2, misma honestidad que el mercado en
  SPEC-029).**
  Dada una acción vigilada cuyo símbolo tiene `symbols.name` **nulo**,
  cuando el usuario abre `/vigiladas`,
  entonces la celda «Activo» muestra **solo el ticker** y **nada más**: no aparece «—», ni
  «Sin nombre», ni «(desconocido)», ni el `exchange`, ni el ticker repetido como si fuera
  nombre, ni un hueco con guion. El elemento del nombre **no se renderiza**. La fila es por lo
  demás idéntica a cualquier otra.

### El reparto del ancho

- **CA-4 (`Estado` se estrecha, y el motivo de SPEC-016 sigue entero).**
  Dada una lista que contiene una fila en estado `none` **con motivo de fallo**
  (`quote_diagnostics`, SPEC-016) y otra en estado `none` **sin** motivo («aún sin datos»),
  cuando el usuario abre `/vigiladas` en un viewport de escritorio (1280 px),
  entonces (a) el **ancho** de la columna `Estado` es **menor o igual** que el de la columna
  «Activo»; (b) el texto **completo** del motivo sigue **presente y visible** —se envuelve en
  varias líneas dentro de su celda, sin recorte, sin «…», sin quedar solo en un `title` ni en
  un tooltip—; y (c) la etiqueta de estado («En compra y venta», la más larga) se lee en **una
  sola línea**, sin partirse por la mitad de una palabra.
  *Verificación*: (a) con `boundingBox()` sobre los `<th>` correspondientes; (b) comparando el
  texto renderizado con la salida completa de `failReasonText(...)`.

- **CA-5 (Las etiquetas de estado NO cambian).**
  Dada cualquier fila,
  cuando se lee su etiqueta,
  entonces el texto es exactamente el de hoy —«En zona de compra», «En zona de venta», «En
  compra y venta», «Fuera de zona», «Sin cotización»— y el punto de color, la clase
  `zone-label is-<state>` y el atributo `data-state` siguen ahí. Estrechar la columna es un
  cambio de **layout**, no de vocabulario: el rótulo es dominio (*Estado de zona*) y esta spec
  no lo reescribe.

### El orden

- **CA-6 (El orden por defecto es el de hoy).**
  Dado un usuario con varias vigiladas,
  cuando abre `/vigiladas` **sin tocar nada**,
  entonces las filas salen ordenadas **por ticker ascendente**, igual que antes de esta spec, y
  el control de orden indica «Ticker». No hay orden recordado de una visita anterior ni de otra
  sesión (fuera de alcance por decisión de la épica).

- **CA-7 (Se ordena por nombre, y quien no tiene nombre no se cae de la lista).**
  Dada una lista con acciones de nombres «Acerinox», «iberdrola», «Índice X» y una **sin
  nombre** con ticker `BBVA`,
  cuando el usuario elige ordenar por **Nombre** ascendente,
  entonces las cuatro filas siguen presentes y el orden es alfabético en **español**,
  **insensible a mayúsculas y a acentos** (`localeCompare` con locale `es` y sensibilidad
  `base`), usando para la fila sin nombre **su ticker** como clave; y al elegir **descendente**
  el orden es **exactamente el inverso**. Ninguna fila desaparece ni queda relegada a un bloque
  mudo de «sin nombre».

- **CA-8 (Se ordena por estado, con la prioridad de producto declarada).**
  Dada una lista con al menos una fila de cada estado,
  cuando el usuario elige ordenar por **Estado** ascendente,
  entonces las filas salen en este orden, y no en el alfabético de sus etiquetas:
  **1. `both`** (en compra y venta) → **2. `buy`** → **3. `sell`** → **4. `out`** →
  **5. `none`**; y **dentro del bloque `none`**, primero las que tienen **motivo de fallo**
  (SPEC-016) y después las de «aún sin datos», porque un símbolo que no se puede cotizar **pide
  una acción del usuario** y uno que espera al ciclo no.
  Al elegir **descendente**, el orden es **exactamente el inverso**.

- **CA-9 (El orden es total y estable: dos filas nunca bailan).**
  Dadas varias filas **del mismo estado**,
  cuando se ordena por Estado (en cualquier dirección),
  entonces se desempatan **siempre** por la misma clave que CA-7 (nombre, o ticker si no hay
  nombre) **ascendente**, de modo que la salida es **determinista**: dos ejecuciones sobre los
  mismos datos dan la misma secuencia. El comparador es una **función pura exportada** y se
  prueba con Vitest sin levantar navegador ni base de datos.

- **CA-10 (Ordenar no dispara ninguna consulta ni recarga la página).**
  Dado el usuario en `/vigiladas`,
  cuando cambia el criterio o la dirección del orden,
  entonces la tabla se reordena **sin navegación** —no cambia la URL, no hay recarga, no hay
  petición al servidor— y los datos mostrados son **los mismos** que ya estaban en pantalla:
  mismo precio, mismo `asOf` y mismo `state` por fila. El estado de zona **se sigue calculando
  en el servidor** con `entraEnZona`; el cliente **solo ordena** (RN-11 intacta, CE-M1).

- **CA-11 (El control de orden se alcanza siempre, incluso donde la tabla se desborda).**
  Dado un viewport de 390 × 844 px (móvil) con una lista de varias filas,
  cuando el usuario abre `/vigiladas`,
  entonces el control de orden es **visible sin desplazar la tabla horizontalmente** —vive
  **fuera** del contenedor `.table-scroll`, sobre la tabla— y permite elegir los tres criterios
  (Ticker, Nombre, Estado) y las dos direcciones. La columna por la que se ordena queda marcada
  además con `aria-sort` en su `<th>` para quien use lector de pantalla.

### El alta que solo aparece cuando se va a usar

- **CA-12 (Con la lista vacía, el alta sigue a la vista, y justo donde SPEC-039 promete que
  está — R-M3, SPEC-039 CA-9).**
  Dado un usuario **sin ninguna** acción vigilada,
  cuando abre `/vigiladas`,
  entonces el formulario de alta está **desplegado y utilizable sin ningún clic previo** —el
  buscador de símbolos y los campos de zona son visibles en el primer render— **y aparece
  inmediatamente después** del bloque `data-testid="vigiladas-vacio"`, sin ningún control
  intermedio que haya que pulsar. Es una exigencia **literal**: `VACIO_VIGILADAS.primerPaso`
  dice «**Empieza aquí abajo**…», así que un formulario plegado, o colocado por encima de ese
  bloque, deja el texto mintiendo. Esconder el primer paso a quien aún no ha dado ninguno
  **incumple este CA**.

- **CA-13 (Con lista, el alta está plegada tras un control explícito).**
  Dado un usuario **con al menos una** acción vigilada,
  cuando abre `/vigiladas`,
  entonces (a) el formulario **no** está en pantalla —ni sus campos ni el buscador—; (b) hay un
  control visible cuyo texto dice qué hace (**«+ Vigilar una acción»**), con
  `aria-expanded="false"`; y (c) al activarlo, el formulario aparece **en la misma página**, sin
  navegar a otra ruta, con `aria-expanded="true"`, y el buscador recibe el foco o es alcanzable
  con un `Tab`. Al volver a activarlo, se pliega.

- **CA-14 (Plegado, el alta no ocupa el sitio de la tabla — CE-M4).**
  Dado un usuario con lista y el alta plegada, en viewport de 390 × 844 px,
  cuando abre `/vigiladas`,
  entonces la altura ocupada por la zona de alta (control incluido) es **menor** que la del
  formulario desplegado, y **ningún elemento visible de la página se sale por el lado
  derecho**: para cada elemento bajo `nav`, `main` y `footer`,
  `getBoundingClientRect().right <= innerWidth + 1` (medida **M1** de **ADR-026**). El
  desbordamiento horizontal de la tabla, si lo hay, sigue confinado a `.table-scroll`.
  *Corrección respecto al borrador del 2026-08-20*: este CA decía
  `document.body.scrollWidth <= window.innerWidth`, que es **exactamente la medida ciega** que
  **ADR-026** pto. 1 declara mal escrita y que **SPEC-040** (EPIC-FIX) CA-8 demuestra incapaz
  de ver un recorte bajo `html, body { overflow-x: hidden }` —puesto por el sistema de diseño
  por debajo de 720 px, o sea justo aquí—. Con aquella redacción, este CA habría pasado en
  verde con medio formulario fuera de la pantalla.

- **CA-15 (Dar de alta varias seguidas sigue siendo un flujo, no un ritual).**
  Dado un usuario con lista que despliega el alta y **da de alta una acción con éxito**,
  cuando la página se refresca con la fila nueva,
  entonces el formulario **sigue desplegado** y limpio, listo para la siguiente (comportamiento
  existente de `WatchForm`, V-SPEC-008-1): pasar de 0 a 1 filas, o de 1 a 2, **no vuelve a
  plegarlo**. Y cuando el alta **falla** (p. ej. zona inválida, SPEC-003, o coma decimal,
  SPEC-030), el formulario está **desplegado** y el mensaje de error es visible: un error nunca
  queda escondido detrás de un panel cerrado.

- **CA-16 (Plegar descarta lo escrito, y se comporta igual siempre).**
  Dado el formulario desplegado con un símbolo elegido y zonas tecleadas,
  cuando el usuario lo pliega y lo vuelve a desplegar,
  entonces el formulario aparece **vacío**, sin símbolo seleccionado y sin zonas: plegar
  **descarta**, no guarda un borrador. Es la misma semántica que el reset tras un alta con
  éxito, y se declara aquí para que no sea una sorpresa.

### Cero regresión (CE-M1)

- **CA-17 (Todo lo que esta pantalla ya prometía sigue en pie, y también después de ordenar).**
  Dada una lista con filas de varios estados, con y sin motivo de fallo, con y sin mercado
  conocido, y **después de haber reordenado por Nombre y por Estado**,
  entonces cada fila conserva **lo suyo**: el color de fondo `zone-<state>` correspondiente a
  **su** estado (**SPEC-007**); el motivo de «no se vigila» con su `data-testid="fail-reason"` y
  su `data-reason`, o el «aún sin datos» (**SPEC-016** CE-F2); el **tipo** y el **mercado**
  (**SPEC-029** CA-13/CA-14), con la celda de mercado **vacía** cuando no se sabe —ni «—» ni
  inventado—; el precio y el `asOf` (**D-2**); y las zonas de compra y de venta.

- **CA-18 (Quitar borra la fila que se pulsó, esté donde esté tras ordenar — SPEC-024).**
  Dada una lista **reordenada** (por Estado descendente, de modo que la posición de cada fila
  difiera de la original),
  cuando el usuario pulsa «Quitar» en una fila concreta,
  entonces desaparece **esa** acción vigilada y ninguna otra: el `watchedId` que viaja en el
  formulario es el de **su** fila. Con el **mismo ticker vigilado en dos mercados**
  (**ADR-007**), se va **solo el del mercado pulsado** y el otro permanece.

- **CA-19 (La suite existente sigue verde).**
  Dado el árbol con esta spec implementada,
  cuando se ejecutan la suite de Vitest y la de Playwright,
  entonces siguen verdes **sin reescribir sus aserciones de dominio**; en particular
  `tests/e2e/vigiladas.spec.ts`, `tests/e2e/diagnostico-cotizacion.spec.ts` y
  `tests/e2e/avisos-zona.spec.ts`. Se admite **ajustar selectores** si una celda cambia de
  sitio; **no** se admite relajar ni borrar una aserción para que pase.

- **CA-20 (Aislamiento intacto — RN-01).**
  Dados dos usuarios con vigiladas distintas,
  cuando cada uno abre `/vigiladas` y ordena como quiera,
  entonces cada uno ve **solo** las suyas. Ordenar en cliente **no** amplía el conjunto de datos
  que llega al navegador: lo que se serializa es exactamente la salida de `zoneStatusForUser`
  para **ese** `userId`, sin campos nuevos más allá del nombre del activo.

- **CA-21 (El estado vacío que dejó SPEC-039 sigue intacto — no regresión sobre `main`).**
  Dado un usuario **sin ninguna** acción vigilada,
  cuando abre `/vigiladas`,
  entonces sigue viendo, con su marca y su texto **sin cambiar ni una palabra**: el bloque
  `data-testid="vigiladas-vacio"` con el título de `VACIO_VIGILADAS`; el primer paso; el
  **ejemplo con números** (`data-testid="vigiladas-vacio-ejemplo"`); la **línea de cadencia**
  (`data-testid="vigiladas-vacio-cadencia"`, la misma frase literal `CADENCIA_LINEA` que la
  primera pantalla y `/ayuda`, SPEC-039 CA-3); y el **enlace a `RUTA_AYUDA`**. Todos los textos
  se siguen leyendo de `src/lib/help/content.ts`: esta spec **no los copia, no los mueve de
  fichero y no los reescribe**. `tests/e2e/ayuda.spec.ts` sigue verde sin tocar sus
  aserciones.

- **CA-22 (Plegar el alta NO deja ciega a la guardia de geometría — ADR-026, frontera con
  SPEC-040 de EPIC-FIX).**
  Dado `/vigiladas` **con al menos una fila** y el alta **desplegada por el control** de
  CA-13, a **360 × 800** y **390 × 844**,
  entonces se aplica la medida **M1** de **ADR-026** —`right <= innerWidth + 1` y
  `left >= -1`, elemento a elemento— sobre `form.auth-form` y todo su contenido, y **ninguno
  la viola**. Dicho de otro modo: **el estado "lista con filas + alta desplegada" es un estado
  medido**, no un hueco. Es el CA que existe **por** esta spec: hasta ella, el formulario
  estaba siempre en el DOM y la barrida de la guardia lo alcanzaba en las dos rutas; a partir
  de ella hay un estado del formulario que **solo existe tras un clic**, y una medida que no
  dé ese clic dejaría de verlo. Crear un punto ciego nuevo en la guardia sería, precisamente,
  el fallo silencioso que SPEC-040 viene a matar.

## Entidades y reglas afectadas

**Reglas**: **RN-01** (aislamiento; CA-20), **RN-10** y **RN-11** (zonas y entrada en zona: **no
se tocan**; el `state` se sigue computando en servidor, CA-10), **RN-03** (sesión requerida),
**RI-01** (no aplica: no hay migración).

**Términos de dominio** (`docs/fundacion/dominio.md`): *Símbolo (ticker)*, *Acción vigilada*,
*Estado de zona*, *Tipo de instrumento*, *Mercado*, *asOf*. Esta spec **pide un término nuevo**,
**Nombre del activo**, que se escribe en el gate (**ADR-025**; redacción propuesta en §Notas
pto. 7).

**Decisiones**: **D-2** (el `asOf` sigue visible), **D-5** / **RN-01**, **ADR-007** (identidad
`(ticker, micCode)`: dos mercados del mismo ticker son dos filas, y CA-18 lo protege),
**ADR-012** (el mercado sale del *operating MIC*), **ADR-020** (el tipo se muestra, no filtra),
**ADR-021** (rol de cuenta: `/vigiladas` es sección de `tester` en adelante), **ADR-025** (el
término del glosario lo escribe el arquitecto en el gate) y **ADR-026** (la geometría se mide
elemento a elemento, en un módulo compartido, y `overflow: hidden` no es un arreglo) — esta
spec lo **consume** en CA-14 y CA-22 y **no lo modifica**. **Esta spec no propone ningún ADR
nuevo** (**CE-M3**).

**Specs vecinas vivas al escribirla**: **SPEC-039** (EPIC-004, `hecho` y **en `main`**: su
estado vacío es no regresión, CA-21) y **SPEC-040** (EPIC-FIX, `aprobada`, en otra rama: la
geometría móvil de este mismo `WatchForm`, R-2/R-3).

**Piezas que se extienden, no se duplican:**

- `src/lib/watchlist/zone-status.ts` — `ZoneStatusView` gana **un campo** (el nombre) y la
  consulta **una columna** en el `select`. El `orderBy(symbols.ticker)` **se queda**.
- `src/app/vigiladas/page.tsx` — sigue siendo Server Component: hace la consulta, calcula el
  estado y entrega las filas ya resueltas. La **tabla** pasa a ser componente de cliente para
  poder reordenar sin ir al servidor (CA-10); la server action `removeAction` se sigue usando
  desde el formulario de cada fila (CA-18).
- `src/app/vigiladas/watch-form.tsx` — **no cambia por dentro**: conserva su `useActionState`,
  su reset y su `pickerKey` (V-SPEC-008-1). Lo que se añade es **quién lo monta y cuándo**
  (CA-12/CA-13/CA-15).
- `src/app/globals.css` — `.data-table`, `.zone-*`, `.table-scroll` y `.empty` **existen y se
  reutilizan**; lo nuevo es el ancho acotado de la celda de estado y el estilo del nombre bajo
  el ticker.
- `src/lib/market/fail-reason-text.ts`, `instrument-type-text.ts` y `market-name.ts` — **única**
  fuente de esos rótulos; no se duplican ni se reescriben.

## Fuera de alcance

- **Recordar el orden entre visitas o entre sesiones.** Lo excluye la épica por escrito
  (*«Preferencias de usuario persistidas»*): sería esquema nuevo y capacidad nueva, no
  presentación. Se reabre cuando un tester lo pida.
- **Rellenar (*backfill*) los `symbols.name` que hoy son nulos.** Costaría una búsqueda contra
  el proveedor por símbolo —el mismo argumento de **F-ADR-020-3** con `instrument_type`— y eso
  es **capacidad nueva**, no presentación. CA-3 dice qué se ve mientras tanto. *(Ojo: hoy
  `getOrCreateSymbol` **solo** escribe el nombre al **crear** la fila; un símbolo ya existente
  no lo gana aunque otro usuario vuelva a elegirlo en el buscador. Ver §Notas pto. 6.)*
- **Filtrar, agrupar, buscar dentro de la tabla o paginar.** El roce observado es de orden y de
  legibilidad; con listas de decenas de filas, filtrar no está pedido.
- **Elegir qué columnas se ven.** Un selector de columnas es preferencia persistida disfrazada.
- **Enseñar el nombre del activo en `/cartera`, `/avisos` o el panel.** Mismo roce, otra
  pantalla: candidato natural a la siguiente spec de esta épica, pero aquí no entra porque
  ampliaría la superficie de conflicto con SPEC-039 y con SPEC-025 sin necesidad.
- **Redefinir el estado vacío de `/vigiladas`** (qué texto, qué ejemplo, qué enlaces).
  Territorio de **SPEC-039** CA-9. Esta spec solo fija que **el formulario está desplegado**
  cuando la lista está vacía (CA-12), que es la propiedad que SPEC-039 necesita que se cumpla.
- **Cambiar las etiquetas del estado de zona** ni el color de fondo (SPEC-007): CA-5.
- **Rediseño visual de la app** (tipografía, sistema de color): lo excluye la épica.
- **La geometría del formulario de alta en móvil** —que `.symbol-picker` y los campos
  `min`/`max` encojan para caber en una columna de 320/350 px, el módulo compartido de medida
  de **ADR-026** y su prueba de eficacia—. Es **SPEC-040** (EPIC-FIX) entera. Esta spec **no
  toca anchos ni `min-width` de `WatchForm`**: decide **cuándo se ve**, no **cuánto mide**.
  CA-14 y CA-22 se limitan a **usar** la medida de ADR-026, no a escribirla.
- **Sacar `.table-scroll` de su `@media`** (defecto 3 de SPEC-040, `V-SPEC-039-3`): también es
  suyo, por su CA-5. Aquí solo se depende del resultado.
- **Ordenar por precio, por `asOf` o por zona.** No están pedidos y cada uno abre su propia
  pregunta (¿cómo ordena un precio ausente? ¿y una zona sin definir?). Si se quisieran, el
  comparador de CA-9 es el sitio donde entrarían.

## Riesgos

- **R-1 (SPEC-039 ya no es un riesgo de coordinación, sino una restricción — cerrado).**
  **R-M1** de la épica anticipaba conflicto de merge en `src/app/vigiladas/page.tsx` y la regla
  *«quien llegue segundo rebasa»*. **Se resolvió solo**: SPEC-039 mergeó a `main` (PR #42) y
  esta rama está rebasada encima (`784c1ea`). Lo que queda es **no romper lo que dejó**, y eso
  ya no es un riesgo abierto sino un CA: **CA-21**. Se anota cerrado en vez de borrarlo, para
  que quien lea la épica no busque un conflicto que no va a encontrar.

- **R-2 (SPEC-040 de EPIC-FIX toca el MISMO componente, y este paralelo sí está vivo).**
  `ft/SPEC-040-movil-completa-el-alta-y-guardia-que-lo-ve` está **aprobada** y arregla
  `WatchForm` en móvil: a 390 px `.symbol-picker` y `.symbol-search-input` miden **444 px** en
  una columna de **350** (y de **320** a 360 px), así que hoy se salen de la pantalla el campo
  de búsqueda, los «max» de las dos zonas y **el botón Vigilar** — en silencio, porque
  `design/tremen-ds/responsive.css` pone `html, body { overflow-x: hidden }` por debajo de
  720 px. Trae además **ADR-026** y una guardia de geometría compartida.
  **Ella arregla el formulario y esta spec lo pliega. Mismo componente, dos ramas vivas.**
  **Reparto de territorio, escrito para no discutirlo en caliente:**
  - **De SPEC-040**: la **caja** del formulario —anchos, `min-width`, cómo encogen el buscador y
    los campos de zona—, la salida de `.table-scroll` de su `@media`, el módulo compartido de
    medida (`tests/e2e/geometria.ts`), los ocho anchos de referencia y la prueba de eficacia.
    **Esta spec no toca ni una de esas líneas.**
  - **De SPEC-041**: **cuándo** el formulario está en el DOM y a la vista (CA-12/CA-13/CA-15),
    la tabla, el orden y el reparto de ancho de la columna `Estado`.
  - **Punto de contacto único**: el estado *«lista con filas + alta desplegada»*, que **no
    existía** antes de esta spec. Lo cubre **CA-22**.
  **Orden de merge**: indiferente para la corrección, pero **conviene que SPEC-040 vaya
  primero** —es EPIC-FIX, bloquea publicar, y su módulo de medida es el que esta spec quiere
  usar—. Quien llegue segundo rebasa; el conflicto esperable está acotado a
  `src/app/vigiladas/page.tsx` y `src/app/globals.css`.

- **R-3 (plegar el alta puede dejar ciega a la guardia de geometría — mitigado, no ignorado).**
  Hoy `<WatchForm />` está **siempre** en el DOM, así que la barrida elemento a elemento de
  SPEC-040 **CA-3** lo mide **en las dos rutas** que recorre (`/vigiladas` vacía **y** con
  filas). Con el plegado, en la ruta *«con al menos una fila»* el formulario **deja de existir**
  hasta que alguien pulse el control: esa segunda medición **desaparece sola, sin que ningún
  test se ponga rojo**. Es exactamente la clase de punto ciego que **ADR-026** existe para
  impedir, y sería una ironía crearlo nosotros.
  **Por qué NO rompe SPEC-040**: su **CA-1** —el que mide el formulario— está escrito sobre la
  **lista vacía**, y ahí esta spec lo mantiene desplegado (**CA-12**); y su **CA-2** recorre
  CE-1 con un usuario **recién registrado**, o sea también con lista vacía. **Ninguno de los
  dos se cae.**
  **Lo que sí hay que hacer, y es barato**: (a) **CA-22** de esta spec añade el estado *«con
  filas + desplegado»* al conjunto medido —un clic antes de medir—; y (b) si el test de
  eficacia de SPEC-040 (**CA-7** caso (a), y **CA-8**) se ejecuta sobre `/vigiladas` **con
  filas**, hay que dejarlo en la **lista vacía** o **desplegar el alta antes de inyectar**: si
  no, la inyección no encontrará elementos que medir y el test se pondrá **rojo** —ruidoso, no
  silencioso, pero rojo por un motivo falso—. Queda dicho **antes** de implementar ninguna de
  las dos.

- **R-4 (CA-14 dependía de una medida ciega — corregido en el texto).** El borrador del
  2026-08-20 afirmaba el «sin scroll horizontal» con `document.body.scrollWidth`, que es
  justamente la medida que **ADR-026** pto. 1 declara mal escrita y que **SPEC-040 CA-8**
  demuestra incapaz de ver un recorte enmascarado por `overflow-x: hidden`. **CA-14 se ha
  reescrito** para usar la medida por elemento (**M1**). Se deja anotado como riesgo cumplido:
  la primera versión de esta spec habría certificado en verde una pantalla con el botón
  «Vigilar» fuera de ella.

- **R-5 (la tabla pasa a componente de cliente).** Ordenar exige JavaScript. No es regresión
  —`WatchForm` y el buscador ya lo exigen— pero es una propiedad que se pierde de forma
  explícita (§Notas pto. 2): sin JS la tabla se pinta en su orden por defecto y no se reordena.

- **R-6 (el nombre puede faltar y la tabla parecer incompleta).** `symbols.name` es nullable y
  **nadie lo va a rellenar** en esta spec (§Fuera de alcance). Mitigación: **CA-3** fija qué se
  ve —solo el ticker, sin inventar— y **CA-7** garantiza que esas filas se ordenan por su
  ticker en la misma secuencia, así que no forman un bloque mudo al final.

## Notas para el gate humano

> **Estado tras el gate del 2026-08-20 (Alberto Fojo).** Dos veredictos ya están dados y
> **aplicados tal cual**: el **nombre bajo el ticker, sin columna nueva** (pto. 5) y la
> **prioridad `both → buy → sell → out → none`** (pto. 3). No se vuelven a abrir. Siguen
> pendientes de tu palabra los ptos. 1 (plegado por defecto con lista) y 4 (control propio de
> orden frente a cabeceras pinchables). El pto. 6 sale de esta spec por decisión del
> orquestador. Lo que cambió del terreno —SPEC-039 ya en `main`, SPEC-040 de EPIC-FIX viva
> sobre el mismo componente— está en §Riesgos y reescrito en el pto. 8.

1. **Punto 3 de tu petición — lo he analizado y elijo el botón que despliega el formulario ahí
   mismo, con una excepción: la lista vacía.** El control («+ Vigilar una acción») está siempre
   presente; el formulario aparece **plegado** si ya tienes vigiladas (CA-13) y **desplegado**
   si no tienes ninguna (CA-12).
   **Por qué esta y no las otras** —todas las consideré de verdad:
   - **Un panel lateral (*drawer*) o un modal.** Es lo que más «producto» parece y lo descarto.
     La app **no tiene hoy ningún modal ni ningún drawer**: habría que traer patrón nuevo, con
     trampa de foco, cierre con `Esc`, bloqueo de scroll y `aria-modal`, para una pantalla cuyo
     problema es de **espacio**, no de contexto. Y hay un choque concreto: el buscador de
     símbolos ya abre su **propio desplegable de resultados** (SPEC-008), o sea un `popover`
     dentro de un `popover`. Coste alto, riesgo de accesibilidad, y **CE-M3** («cabe en una
     sesión») empezando a crujir.
   - **Una página aparte (`/vigiladas/nueva`).** Barata de escribir, cara de usar: mete una
     navegación completa —y un render de servidor— en la acción **creativa** de la pantalla, y
     rompe el flujo de dar de alta varias seguidas que hoy funciona (CA-15). Además cambia el
     mapa de rutas, que ya es más que «presentación».
   - **El formulario visible solo cuando la lista está vacía.** La descarto por un motivo que me
     parece decisivo: **hace desaparecer el control justo cuando el usuario ha aprendido a
     usarlo**. Añades tu primera acción y el formulario se esfuma; para añadir la segunda tienes
     que descubrir de nuevo cómo. Es el callejón sin salida clásico. Lo que **sí** me quedo de
     esa idea es su intuición buena: **con la lista vacía, desplegado**.
   - **Una fila de «alta rápida» dentro de la tabla.** No cabe: son un combobox de búsqueda y
     cuatro campos de zona; en una tabla que ya se desborda en móvil sería el peor de los dos
     mundos.
   - **Dejarlo como está.** Es el roce que pediste quitar.
   **Y el riesgo R-M3 —esconder el alta esconde el primer paso— queda resuelto por
   construcción**: quien llega con cero no ve ningún cambio respecto a hoy. El que gana sitio es
   quien ya tiene lista, que es quien lo pedía.
   **Si discrepas**, lo más barato de cambiar es el comportamiento por defecto con lista
   (CA-13): «plegado» es un valor, no una arquitectura.

2. **Ordeno en el cliente, y la razón principal no es el rendimiento.** El **estado de zona no
   es una columna de la base**: se deriva en JavaScript comparando el precio con las zonas
   mediante `entraEnZona` (RN-11, semántica decimal). Ordenar por estado **en SQL** obligaría a
   **reimplementar RN-11 en SQL** —una segunda definición de la regla que más importa del
   producto, condenada a divergir de la primera—. Eso, por sí solo, decide.
   Se suman: listas de decenas de filas (no hay paginación), un viaje de ida y vuelta por cada
   clic si fuera en servidor, y que **no** queremos el orden en la URL, porque una URL con el
   orden dentro es media persistencia y la épica la excluye.
   **Precio que pagamos y quiero que veas**: la tabla pasa a ser componente de cliente, así que
   ordenar **exige JavaScript**. No es regresión —`WatchForm` y el buscador ya son cliente, esta
   pantalla nunca funcionó sin JS— pero sí es una propiedad que perdemos de forma explícita: sin
   JS la tabla se pinta, en su orden por defecto, y no se reordena.

3. **Prioridad al ordenar por estado — RATIFICADA EN EL GATE (2026-08-20), tal cual.** Queda
   como estaba y no se reabre; el razonamiento se conserva por si algún día alguien pregunta
   por qué.
   Propongo **`both` → `buy` → `sell` → `out` → `none`** (CA-8), leído como *«lo que reclama tu
   atención, primero»*: `both` es la señal más fuerte; luego lo accionable; `out` es «todo en
   orden»; `none` es «no puedo decirte nada».
   La única elección de verdad discutible es **`buy` antes que `sell`**, y la razón que doy es
   floja a propósito para que la puedas tumbar: la vigilancia de **entrada** es el caso que
   fundó el producto (D-3/D-4, zonas que el usuario trae de sus portales) y las zonas son
   opcionales e independientes (RN-10), así que espero más zonas de compra definidas que de
   venta. Si tu mañana empieza por «¿puedo vender algo?», **intercámbialos**: es una línea del
   comparador y un CA.
   El matiz que sí defiendo: **dentro de `none`, los que tienen motivo de fallo van antes**. Un
   símbolo que **no se puede cotizar** te pide que hagas algo; uno que espera al ciclo, no.

4. **El control de orden es un control propio sobre la tabla, no cabeceras pinchables.** Lo
   decidí contra mi instinto. En escritorio, pinchar la cabecera es lo esperado; el problema es
   que **las cabeceras viven dentro de `.table-scroll`**, que en móvil desborda: la cabecera
   `Estado` está **fuera de la pantalla** hasta que arrastras la tabla, o sea que el gesto para
   ordenar exigiría un gesto para encontrarlo, justo donde menos sitio hay. Un control encima de
   la tabla se ve siempre, se prueba una vez, y además me deja ofrecer **«Ticker»** como opción
   explícita —el orden por defecto **con nombre**, y una forma de volver a él— en vez de un
   tercer clic escondido en un ciclo de tres estados. Las cabeceras se marcan con `aria-sort`
   para que el lector de pantalla lo cuente (CA-11).
   Si prefieres cabeceras pinchables, cambian CA-11 y CA-6; el resto sobrevive.

5. **El nombre bajo el ticker, sin columna nueva — RATIFICADO EN EL GATE (2026-08-20), tal
   cual.** Queda como estaba y no se reabre. Era lo que más se apartaba de tu petición
   literal, así que el razonamiento se conserva entero: Pediste el nombre «en la tabla» y ofreciste el ancho de `Estado` como
   moneda de cambio. Lo que hago es **no añadir columna**: la tabla ya tiene nueve y se desborda
   en móvil, y una décima empeoraría exactamente lo que venimos a mejorar. Ticker arriba, nombre
   debajo, es además el patrón de cualquier pantalla financiera y mantiene el ticker como ancla
   visual.
   **Y aun así estrecho `Estado`** (CA-4): lo hago porque el culpable real del ancho no es la
   etiqueta sino **el párrafo del motivo de SPEC-016**, que hoy estira la columna en vez de
   envolverse. Acotar esa celda y dejar que el motivo ocupe dos líneas devuelve ancho a **toda**
   la tabla, sin perder ni una palabra del motivo. Si querías literalmente una columna «Nombre»
   aparte, dilo en el gate: cambian CA-2 y CA-4 y el resto sobrevive.

6. **Hallazgo colateral — FUERA de esta spec, y ya tiene dueño.** `getOrCreateSymbol`
   (`src/lib/portfolio/symbols.ts`) escribe `name` **solo al insertar**: si el símbolo ya
   existe, devuelve la fila tal cual y el nombre nulo **se queda nulo para siempre**, aunque
   otro usuario lo elija en el buscador con nombre incluido. Es el mismo hueco que
   **F-ADR-020-3** describe para `instrument_type`, y el comentario del esquema («se rellenan
   solos cuando alguien vuelva a elegir ese valor») **no se cumple**. Queda **fuera** porque es
   escritura de datos, no presentación, y **CE-M1** dice que una mejora no cambia lo que la app
   guarda. **Lo levanta el orquestador como residual hacia EPIC-FIX** (decisión del 2026-08-20);
   esta spec solo lo deja escrito para que no se pierda, y **CA-3** dice qué se ve mientras
   tanto.

7. **Término nuevo para el glosario, que escribo en el gate y no antes (ADR-025).** Redacción
   propuesta para `docs/fundacion/dominio.md`:
   > **Nombre del activo** — Nombre legible del instrumento tal como lo da el proveedor de
   > búsqueda (*instrument_name*: «Industria de Diseño Textil SA», «Microsoft Corp»). Es
   > **metadato informativo**, como el *Tipo de instrumento*: identifica para el humano, pero la
   > **identidad** del símbolo sigue siendo `(ticker, mic_code)` (ADR-007) y el nombre no entra
   > en ningún cálculo, ni en la petición de cotizaciones, ni en ninguna clave.
   > *Notas*: `symbols.name` es **nullable** y lo seguirá siendo: un símbolo sin nombre conocido
   > **no tiene nombre**, y la celda muestra solo su ticker —ni «—», ni «Sin nombre», ni un
   > nombre inventado—, la misma honestidad que ya aplican *Mercado* y *Tipo de instrumento*
   > (SPEC-029; SPEC-041 CA-3). Se ve al elegir en el buscador (SPEC-008) y en la tabla de
   > `/vigiladas` (SPEC-041).

   **Y la cabecera de la columna es «Activo», no «Nombre» ni «Valor»**: «Valor» en castellano
   financiero significa *security*, pero junto a una columna «Precio» se lee como *value*; y
   «Acción» sería mentira desde **ADR-020** (hay REIT, ADR y ETF). Si el término te suena mal, se
   cambia en el gate, que es exactamente para lo que existe ADR-025.

   **Confirmado el 2026-08-20**: `docs/fundacion/dominio.md` **no se toca en esta rama**. La fila
   la escribe el orquestador al cerrar el gate, que es lo que **ADR-025** manda; aquí queda solo
   la redacción propuesta.

8. **El vecindario cambió mientras se escribía esto, y en las dos direcciones.**

   **(a) SPEC-039 ya no es un riesgo: es una restricción.** Mergeó a `main` (PR #42) y está
   `hecho`; esta rama está rebasada sobre `784c1ea` y **ya tiene su estado vacío delante**. El
   *«quien llegue segundo rebasa»* de **R-M1** ha dejado de aplicar. Lo que queda es **no
   romperlo**, y eso es **CA-21**: el bloque `vigiladas-vacio`, el ejemplo con números, la línea
   de cadencia y el enlace a la ayuda siguen tal cual, leídos de `src/lib/help/content.ts`.
   Detalle que conviene que veas porque **ata tu punto 3 con lo ya publicado**: el texto de
   SPEC-039 dice literalmente *«Empieza aquí abajo…»*. Es una promesa de **posición**. Por eso
   CA-12 no dice solo «desplegado», dice **desplegado y justo debajo de ese bloque**: si
   plegásemos también en el vacío, la app quedaría **mintiendo por escrito**.

   **(b) Y aparece un vecino nuevo, este sí vivo: SPEC-040 de EPIC-FIX.** Arregla el **mismo
   componente** que esta spec pliega — a 390 px el buscador mide 444 px en una columna de 350 y
   **el botón «Vigilar» está fuera de la pantalla**, sin que se note, porque el sistema de
   diseño recorta con `overflow-x: hidden`. Trae **ADR-026**.
   **Reparto de territorio** (el detalle está en §Riesgos **R-2**):
   - **cuánto mide** el formulario y **cómo se mide** — anchos, `min-width`, módulo compartido
     de geometría, ocho anchos de referencia, prueba de eficacia — es **de SPEC-040**;
   - **cuándo está a la vista** — desplegado con lista vacía, plegado con lista, qué pasa tras
     un alta con éxito o con error — es **de SPEC-041**;
   - **el punto de contacto** es un estado que **no existía antes de esta spec**: *«lista con
     filas + alta desplegada»*. Lo cubre **CA-22**, y existe precisamente para que plegar el
     alta **no le abra un punto ciego** a la guardia que SPEC-040 viene a arreglar.
   **Recomendación de secuencia**: que SPEC-040 vaya primero. Es EPIC-FIX, bloquea publicar, y
   deja escrito el módulo de medida que CA-14 y CA-22 quieren usar. Si va primero esta, quien
   implemente aquella tendrá que dar un clic más antes de medir — y está avisado por escrito en
   **R-3**.

9. **Lo que esta spec NO necesita, y quiero que conste porque es la mitad de su valor:** no
   necesita migración, ni columna nueva, ni proveedor, ni ADR, ni variable de entorno, ni
   despliegue especial. **CE-M3** se cumple con holgura. Si en el gate decides algo que exija
   cualquiera de esas cosas, deja de ser una mejora y hay que replantear su encaje en esta épica
   —dilo y lo saco.

10. **Numeración**: esta spec nació como SPEC-040 y **se subió a SPEC-041** el 2026-08-20 por
    orden tuya, al chocar con la **SPEC-040 de EPIC-FIX** (*el móvil completa el alta*), escrita
    el mismo día en otra rama y con **ADR-026** detrás. A partir de ahí, **«SPEC-040» significa
    aquella, no esta**. Nota de intendencia para quien venga después: el **directorio del
    worktree se sigue llamando `spec-040`** porque Windows no dejó renombrarlo; la rama sí es
    `ft/SPEC-041-vigiladas-legible-y-ordenable`. Está anotado también en el ledger.

11. **Aprobación**: la spec queda en **`borrador`** y **no la firmo yo**. Del gate del
    2026-08-20 ya vienen ratificados los ptos. **3** y **5**, y el pto. **6** sale de aquí.
    Quedan pendientes de tu palabra los ptos. **1** (plegado por defecto cuando hay lista) y
    **4** (control propio de orden frente a cabeceras pinchables), y el **7** (el término
    «Nombre del activo» y el rótulo «Activo») en el momento de cerrar el gate.
