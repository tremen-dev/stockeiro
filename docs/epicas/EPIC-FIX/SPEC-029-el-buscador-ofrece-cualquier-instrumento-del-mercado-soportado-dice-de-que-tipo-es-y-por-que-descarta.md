---
id: SPEC-029
tipo: spec
epica: EPIC-FIX
estado: hecho
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-18, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-18, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-18, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-18, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-08-18, por: sdd-verificador}
---
# SPEC-029 — El buscador ofrece cualquier instrumento del mercado soportado, dice de qué tipo es y por qué descarta

## Problema

El buscador de símbolos —la **única** puerta de entrada a vigilar una acción o registrar una
compra (SPEC-008: sin selección no hay campos, no se puede guardar)— **oculta valores que
existen, cotizan y son vigilables**, y cuando lo hace **dice exactamente lo mismo que si no
existieran**.

Reportado por el humano en producción el 2026-08-18. Verificado el mismo día sondeando la API
real de Twelve Data `/symbol_search` con la clave del `.env`:

| Búsqueda del usuario | Ticker | `mic_code` | `instrument_type` | Divisa | Nombre |
|---|---|---|---|---|---|
| `upwork` | `UPWK` | `XNGS` → **XNAS** | `Common Stock` | USD | Upwork Inc. |
| `lexinfintech` | `LX` | `XNGS` → **XNAS** | `American Depositary Receipt` | USD | LexinFintech Holdings Ltd. ADS |
| `orchid island` | `ORC` | **`XNYS`** | `REIT` | USD | Orchid Island Capital Inc. |

Los tres caen en **mercados soportados** (`src/lib/market/mic.ts`) y los tres son
**cotizables** con el dialecto ya arreglado en SPEC-020/SPEC-021 (EEUU se pide con el ticker
pelado). Aun así, «orchid island capital» y «lexinfintech» devuelven **"Sin resultados"**.

### Defecto 1 — la búsqueda oculta REITs y ADRs

Dos líneas implementan D-7, y ninguna implementa lo que dice implementar:

- `src/lib/market/search.ts:20` — `return raw.filter((m) => m.type === 'stock');`
- `src/lib/market/twelve-data-search-provider.ts:65` —
  `type: /stock/i.test(instrumentType) ? 'stock' : instrumentType.toLowerCase()`

La regla efectiva es **«el proveedor escribió literalmente la palabra *stock*»**. Un REIT es
una sociedad cotizada y un ADR es el envoltorio con el que una acción extranjera cotiza en
EEUU: los dos **son** renta variable y los dos se caen. Es vocabulario de proveedor colado
como regla de dominio, y por eso el defecto no se agota en estos tres casos: el vocabulario de
`instrument_type` **crece**, y cada valor nuevo desaparece en silencio.

**ADR-020** (**aprobado** por el humano el 2026-08-18) supersede D-7 en su parte
de filtro: no hay lista blanca de tipos, el mercado es el único filtro, y **el tipo se muestra
en vez de juzgarse**.

### Defecto 2 — "Sin resultados" no distingue "no existe" de "lo hemos descartado"

Cuando el descarte se lo come todo, `src/app/_components/symbol-search.tsx` (estado `empty`,
l. 138) muestra «*Sin resultados para «x»*». El usuario no puede saber si se equivocó de
nombre o si el problema es nuestro, y por tanto **no tiene ninguna acción posible**.

Es el mismo modo de fallo que **SPEC-016** ya erradicó un puerto más allá para las
cotizaciones: allí el motivo dejó de tragarse (ADR-012 pto. 6), se clasificó en vocabulario de
dominio (`QuoteFailureReason`) y se le puso texto de usuario (`src/lib/market/fail-reason-text.ts`).
El buscador se quedó fuera de aquella limpieza; **CE-F2** ("ningún fallo silencioso") no admite
la excepción.

Quedan **dos** causas de descarte, no una:

1. El **filtro de tipo** — desaparece con ADR-020.
2. El **filtro de mercado** — `toOperatingMic` devuelve `null` fuera de los 7 operating MIC y
   el adaptador hace `continue` (`twelve-data-search-provider.ts:56`). Un valor cuya única
   plaza sea **XLON**, **XMIL**, **XFRA** o **PINX** desaparece sin explicación. No bloquea
   los tres casos reportados, pero **saldrá en cuanto un tester busque un valor europeo
   no-BME**, y la app se va a compartir con testers en un foro de bolsa (**R-F4**: la
   confianza ya está tocada; un arreglo a medias y otra vez mudo sería peor que el bug).

Los dos defectos son **el mismo defecto en dos filtros**, comparten el arreglo (que el
descarte cruce el puerto en vez de morir en él) y se verifican en el mismo flujo. Por eso van
en una sola spec y no en dos.

### Encaje en la épica

Rompe **CA-1 de SPEC-003** ("vigilar una acción") y **CA-1 de SPEC-002** ("registrar una
compra") para todo lo que no sea `Common Stock`: capacidades dadas por `hecho` y verificadas
que no cumplen su promesa con datos reales — el caso exacto que EPIC-FIX existe para restaurar
(**CE-F1**) — y lo hacen en silencio (**CE-F2**).

## Usuarios / roles afectados

- **Usuario final (el humano y los testers del foro).** Quiere vigilar *un activo*, no
  aprender el vocabulario de instrumentos de un proveedor de datos. Debe poder (a) encontrar
  cualquier valor que cotice en un mercado que cubrimos, (b) **saber de qué tipo es** —acción,
  REIT, ADR, ETF— tanto al elegirlo como después, en su lista de vigiladas, y (c) cuando no
  aparezca, **entender por qué**: que no existe, o que existe y no lo cubrimos.
- **Usuario que importa su extracto** (SPEC-012/SPEC-014): resuelve la identidad de sus
  posiciones con el mismo buscador. Hoy no puede resolver un ETF de su cartera real.

## Criterios de aceptación

Cada CA es verificable con un test. CA-1..CA-8 y CA-15 son de adaptador/dominio (Vitest;
adaptador contra **fixtures de la respuesta real** de `/symbol_search` capturada el
2026-08-18, sin red — mismo patrón que `tests/quote-diagnostics.test.ts` CA-1). CA-9, CA-11,
CA-16 y CA-17 son de dominio/servicio; CA-14 es de proyección (`zone-status.ts`) más su mapa
de nombres, función pura. CA-10, CA-12, CA-13 y CA-18 son e2e (Playwright).

### El buscador deja pasar lo que existe en un mercado soportado

- **CA-1 (Un REIT se encuentra y se puede elegir).**
  Dada la respuesta real del proveedor para «orchid island» —`ORC`, `mic_code` `XNYS`,
  `instrument_type` **`REIT`**, USD, "Orchid Island Capital Inc."—,
  cuando se busca «orchid island»,
  entonces el candidato **aparece** entre los resultados con `ticker` `ORC`, `micCode`
  **`XNYS`** (operating MIC canónico, ADR-012) y su divisa USD, y es seleccionable.

- **CA-2 (Un ADR se encuentra y se puede elegir).**
  Dada la respuesta real para «lexinfintech» —`LX`, `mic_code` **`XNGS`**, `instrument_type`
  **`American Depositary Receipt`**, USD—,
  cuando se busca «lexinfintech»,
  entonces el candidato aparece con `micCode` **`XNAS`** (segmento `XNGS` normalizado a
  operating, ADR-012) y su divisa USD.

- **CA-3 (No hay regresión: la acción común sigue pasando).**
  Dada la respuesta real para «upwork» —`UPWK`, `XNGS`, `Common Stock`, USD—,
  cuando se busca «upwork»,
  entonces aparece exactamente como antes: `UPWK`@`XNAS`, USD.

- **CA-4 (Un ETF en mercado soportado entra, y eso es querido).**
  Dado un candidato con `instrument_type` `ETF` en un mercado soportado (p. ej. Euronext
  Ámsterdam, `XAMS`),
  cuando se busca su nombre,
  entonces **aparece** entre los resultados.
  *Este CA invierte a propósito **CA-2 de SPEC-008** y **CA-9 de SPEC-012**, por ADR-020.*

- **CA-5 (Ninguna capa filtra por tipo: el defecto no puede volver).**
  Dado un candidato con un `instrument_type` **que nadie ha previsto** (una etiqueta inventada
  para el test, p. ej. `Closed-End Fund` o una cadena arbitraria) en un mercado soportado,
  cuando se busca,
  entonces **aparece igual**. El test debe fallar si alguien reintroduce cualquier lista
  blanca de tipos, en el adaptador o en el dominio.

- **CA-6 (El tipo del proveedor llega íntegro al dominio, sin normalizar).**
  Dadas las filas de CA-1..CA-4,
  cuando el adaptador las traduce a `SymbolMatch`,
  entonces el campo de tipo lleva **la etiqueta tal cual la dio el proveedor**
  (`REIT`, `American Depositary Receipt`, `Common Stock`, `ETF`) — no `'stock'`, no
  minúsculas, no vacío. Una fila sin `instrument_type` deja el campo vacío y **no** se
  descarta.

### El descarte deja de ser mudo

- **CA-7 (Descarte por mercado no soportado: se reporta, con su mercado).**
  Dada una fila del proveedor en un mercado **no** soportado (p. ej. `XLON`), acompañada o no
  de otras filas,
  cuando se busca,
  entonces esa fila **no** sale entre los candidatos **y sí** sale entre los descartes, con
  motivo **`mercado_no_soportado`** y con el `mic_code`/`exchange` que dio el proveedor, para
  poder decirle al usuario *qué* mercado es.

- **CA-8 (Descarte por falta de identidad de mercado: se reporta).**
  Dada una fila del proveedor **sin `mic_code`**,
  cuando se busca,
  entonces no sale entre los candidatos y sí entre los descartes, con motivo
  **`sin_identidad_de_mercado`** (mismo vocabulario que `QuoteFailureReason`, SPEC-016).
  Se mantiene la razón original: sin identidad de mercado no se podría cotizar (ADR-007) —
  **lo que cambia es que ya no se calla**.

- **CA-9 (Tres desenlaces distinguibles en el resultado del dominio).**
  Dado `runSymbolSearch` con sesión válida,
  cuando el proveedor devuelve (a) **nada**, (b) filas que se descartan **todas**, o
  (c) al menos un candidato,
  entonces el resultado permite distinguir los tres casos **sin ambigüedad**: (a) sin
  candidatos y sin descartes, (b) sin candidatos y con descartes (con sus motivos), (c) con
  candidatos —y, si los hubo, con sus descartes al lado, que no impiden mostrar los
  candidatos—.

- **CA-10 (Texto de usuario: por qué no hay resultados).**
  Dado cada uno de los desenlaces de CA-9,
  cuando la UI los presenta,
  entonces el usuario lee mensajes **distintos y accionables**:
  (a) «no existe» → *no hemos encontrado ningún valor con ese nombre*;
  (b) «descartado» → *existe, pero está en un mercado que no cubrimos*, **nombrando el
  mercado** de lo descartado;
  y en ningún caso llega a la UI el texto crudo del proveedor (aserto negativo, como en
  SPEC-016 CA-1). Los dos estados son **distinguibles por `data-testid` distinto** y cada
  test asserta la **ausencia** del otro (patrón de SPEC-016 CA-3).

### El tipo y el mercado se ven

- **CA-11 (Traducción del tipo: lo conocido se traduce, lo desconocido se muestra).**
  Dado el tipo que trae un candidato,
  cuando se presenta,
  entonces las etiquetas conocidas salen en vocabulario del dominio (`Common Stock` →
  **Acción**, `REIT` → **REIT**, `American Depositary Receipt` → **ADR**, `ETF` → **ETF**), una
  etiqueta **desconocida** sale **tal cual la dio el proveedor** (nunca "Otro", nunca oculta —
  ADR-020 pto. 3) y una etiqueta **vacía** no muestra nada (ni hueco raro ni "—" engañoso).

- **CA-12 (El tipo se ve en los resultados del buscador).**
  Dado un usuario autenticado que busca en `/vigiladas`,
  cuando aparecen los candidatos,
  entonces cada fila muestra su **tipo** junto al mercado y la divisa que ya muestra, de forma
  que ORC se lee como REIT y LX como ADR **antes** de elegirlo.

- **CA-13 (El tipo se ve en la tabla de `/vigiladas`).**
  Dado un usuario que ha vigilado un valor elegido del buscador,
  cuando abre `/vigiladas`,
  entonces la tabla muestra el **tipo** de cada fila. Es la petición literal del humano:
  «*puede aparecer también en la tabla*».

- **CA-14 (El mercado se ve en la tabla de `/vigiladas`: dos filas del mismo ticker dejan de
  ser iguales).**
  Dado un usuario con dos acciones vigiladas **del mismo ticker en mercados distintos**
  (identidades distintas por ADR-007),
  cuando abre `/vigiladas`,
  entonces cada fila muestra su **mercado** junto al ticker y al tipo, y las dos filas son
  **distinguibles por esa celda** sin mirar precios ni zonas. **Cierra F-SPEC-024-1.**

  *Decisión del humano en el gate del 2026-08-18*: entran **las dos** columnas a la vez, tipo y
  mercado. Motivo registrado: con el mismo ticker en dos mercados (ADR-007) la fila es hoy
  **ambigua** —se puede ver `ORC` dos veces sin saber cuál es cuál—, y añadir las dos cuesta
  prácticamente lo mismo que añadir una.

  Qué se pinta exactamente, y por qué (esto es la parte que la spec tiene que dejar cerrada, no
  el implementador):

  - **La fuente es `symbols.micCode`** —el operating MIC canónico de ADR-012—, **no
    `exchange`**. Los dos están ya en `symbols` (`src/db/schema.ts:64-65`), así que **ninguno
    cuesta esquema** y la elección es puramente de corrección: `micCode` es **la mitad de la
    identidad** del símbolo, o sea exactamente lo que distingue las dos filas que hoy se ven
    iguales; `exchange` es texto libre del proveedor, cambia con él y con el momento en que se
    guardó el símbolo, de modo que dos símbolos del **mismo** mercado podrían acabar rotulados
    distinto y la columna dejaría de servir para lo que se añade.
  - **Se traduce a nombre de dominio** con un mapa **total** sobre los 7 operating MIC de
    `mic.ts`: `BMEX` → **BME**, `XNAS` → **NASDAQ**, `XNYS` → **NYSE**, `XETR` → **Xetra**,
    `XSTO` → **Nasdaq Estocolmo**, `XPAR` → **Euronext París**, `XAMS` → **Euronext Ámsterdam**.
    Aquí **sí** se sigue el precedente de SPEC-016 sin excepción, al revés que con el tipo
    (CA-11), y el motivo es preciso: el vocabulario de mercados **lo cerramos nosotros**
    (`mic.ts`), no lo dicta el proveedor, así que un mapa total es posible y no pierde
    información. Donde no se puede cerrar el vocabulario —el tipo— se muestra en crudo; donde sí
    —el mercado— se traduce. La regla que gobierna las dos es la misma: **no perder información
    y no inventarla**.
  - **`micCode` NULL (símbolos legacy pre-ADR-007): la celda queda vacía.** No se rellena con
    `exchange`, ni con `—`, ni con el ticker: de esos símbolos **no sabemos** en qué mercado
    cotizan, y escribir uno sería inventarlo. Misma política que el tipo ausente (CA-15) y que
    ADR-020 pto. 6. Se asserta explícitamente, igual que el legacy sin tipo.
  - **Un `micCode` que no esté entre los 7** (hoy imposible por construcción, pero el dato es
    dato) se muestra **en crudo**, nunca oculto ni convertido en hueco.
  - **El mismo nombre en el buscador.** Hoy `symbol-search.tsx:99,147` pinta
    `m.exchange || m.micCode`, o sea texto del proveedor o el código pelado. Pasa a usar **el
    mismo mapa**, para que lo que el usuario lee al **elegir** el valor sea literalmente lo
    mismo que lee después en la tabla. Sin esto, la enmienda crearía una incoherencia nueva
    (`NASDAQ` en la tabla, `XNGS` en el buscador) el mismo día que cierra F-SPEC-024-1.

  La distinción de las dos filas se verifica sobre la **proyección** (`zone-status.ts`), con dos
  símbolos sembrados en el test —mismo ticker, `micCode` distinto—: no hace falta tocar el
  catálogo E2E compartido, que es justo lo que esta spec evita (ver "Símbolos E2E").

- **CA-15 (El tipo se persiste con el símbolo, y los legacy no rompen — ni en tipo ni en
  mercado).**
  Dado un símbolo que se crea al elegir un candidato,
  cuando se guarda,
  entonces su tipo queda persistido en el símbolo compartido; y dado un símbolo **anterior** a
  esta spec —sin tipo, y en el caso de los legacy pre-ADR-007 también **sin `micCode`**—,
  cuando se muestra en `/vigiladas`,
  entonces **las dos** celdas nuevas quedan **vacías** (la de tipo y la de mercado, cada una
  por su propio motivo) y ni la página ni la consulta fallan. El test cubre las tres
  combinaciones que existen de verdad en la base: con tipo y con mercado, sin tipo y con
  mercado (símbolo creado entre ADR-007 y esta spec), y sin ninguno de los dos (legacy).

### Nada de lo que ya funcionaba se rompe

- **CA-16 (El import sigue resolviendo identidad, y ahora también no-acciones).**
  Dada la resolución de identidad del extracto (`src/lib/import/identity.ts:90`, que consume
  `searchSymbols`),
  cuando el proveedor devuelve un ETF para el nombre del bróker,
  entonces **se ofrece como candidato** en vez de descartarse, y el resto de la resolución
  (filtro por etiqueta de mercado, alias, estados de resolución) **se comporta igual** que
  antes: la suite de `tests/import-identity.test.ts` pasa entera, con **CA-9 de SPEC-012**
  cambiado de expectativa **a propósito** (y anotado como tal en el test, para que nadie lo
  lea como una regresión colada).

- **CA-17 (Sesión y resiliencia intactas).**
  Dado el flujo de búsqueda,
  cuando no hay sesión válida, entonces **no se consulta al proveedor** y el resultado es
  `unauthorized` (**RN-03**, SPEC-008 CA-7); y cuando el proveedor **falla**, entonces el
  resultado es `error` sin romper la página (SPEC-008 CA-8) y **sin confundirse** con
  "descartado" ni con "no existe" — son tres estados distintos y el test lo asserta.

- **CA-18 (Flujo real de punta a punta con un REIT).**
  Dado un usuario autenticado en `/vigiladas` (E2E con el catálogo fake propio de esta spec),
  cuando busca el REIT, lo elige, le pone zonas y guarda,
  entonces la fila aparece en la tabla **con su tipo y su mercado visibles** (`REIT` y `NYSE`
  para `ORC`@`XNYS`), y **el mercado que leyó en el buscador es el mismo texto** que ve en la
  tabla, sin pantalla de error. El
  mismo flujo desde `/cartera` (registrar compra) queda cubierto por el mismo componente
  compartido (SPEC-008 CA-9); basta ejercitar uno y comprobar que el otro no regresa.

## Entidades y reglas afectadas

### Decisión que la gobierna

**ADR-020**, **aprobado por el humano (Alberto Fojo) el 2026-08-18**. Era la condición de
implementabilidad de esta spec —D-7 estaba locked y solo un ADR aceptado la supersede— y está
cumplida: el superseding ya se aplicó a `FOUNDATION.md`, `dominio.md` y `contexto.md` ese mismo
día. ADR-020 es ahora **inmutable**: si algo de su decisión hubiera que cambiar, sería otro ADR,
no una enmienda a este.

### Puerto `SymbolSearchProvider` — cambia de contrato (ADR-020 pto. 5)

`src/lib/market/search-provider.ts` pasa de devolver una lista a devolver **candidatos y
descartes**, exactamente como `MarketDataProvider.getQuotes` pasó a `{quotes, failures}` en
SPEC-016 (ADR-012 pto. 6). Forma propuesta (el nombre exacto lo cierra el implementador; la
**semántica** es lo que fija esta spec):

- `search(query) -> { matches: SymbolMatch[]; discarded: DiscardedSymbol[] }`
- `DiscardedSymbol` lleva lo que hace falta para **explicárselo al usuario**: nombre, ticker,
  el MIC/exchange **tal como los dio el proveedor** (sin normalizar: es lo que no supimos
  normalizar) y el motivo.
- `SearchDiscardReason = 'mercado_no_soportado' | 'sin_identidad_de_mercado'`. Vocabulario del
  **dominio**, cerrado y estable; el texto crudo del proveedor no cruza el puerto (SPEC-016).
- **Invariante**: `matches` y `discarded` son **disjuntos** — la lección cara de
  **F-SPEC-016-3**, donde un símbolo salía a la vez en `quotes` y en `failures`. El test debe
  asertar los dos conjuntos con igualdad estricta, no solo la presencia del propio.

- **`SymbolMatch.type` se RENOMBRA a `instrumentType`** y cambia de semántica: ya no es
  `'stock'`, es la etiqueta del proveedor. El renombrado es deliberado y **no es cosmético**:
  obliga al compilador a señalar los cuatro sitios que hoy leen `type`, para que ninguna
  comparación `=== 'stock'` sobreviva escondida. Se propaga a `symbol-selection.ts` (campo
  oculto nuevo en el formulario) y a `SymbolMarket`.

### Esquema

- **`symbols`** (`src/db/schema.ts:61`) gana `instrument_type text` **nullable** — misma
  política que `micCode`/`exchange`/`name`, que ya son nullable por los símbolos legacy
  (ADR-007). Nada de `NOT NULL` con default inventado: un símbolo sin tipo conocido **no tiene
  tipo**, y eso es información verdadera (CA-15).
- **Migración: obligatoria, y generada, no opcional.** Tocar `src/db/schema.ts` **no basta**.
  Hay que generar la migración correspondiente con `npm run db:generate`
  (`drizzle-kit generate`), que en el estado actual del repo será **`drizzle/0008_*.sql`** —
  en `main` las migraciones llegan hasta `0007_tearful_roughhouse.sql`, así que el 0008 está
  libre. No se escribe a mano. Es `ADD COLUMN` nullable: sin movimiento de datos y compatible
  hacia atrás.
- **El arnés de test ya no hay que tocarlo, pero sí obliga.** Desde **SPEC-026/ADR-019** el
  esquema de test es el de producción: los tests aplican las **migraciones**, no un DDL
  paralelo. En consecuencia, **`CA-6` de `tests/schema-source.test.ts` falla si
  `src/db/schema.ts` se queda sin migrar** — es una guardia activa, no un aviso, y SPEC-027
  le añadió un **canario** (su CA-11) que demuestra en cada pasada que la guardia sabe
  detectar, de modo que no puede quedarse dormida sin que se note. Si ese test se pone rojo,
  la respuesta es **generar/arreglar la migración**, nunca tocar el arnés ni relajar la
  guardia.
- **Sin backfill** de los símbolos existentes: exigiría una llamada de búsqueda por símbolo
  contra el free tier (**CE-F3**, **F-ADR-020-3**). Se rellenan solos cuando alguien vuelva a
  elegir ese valor en el buscador.
- **La columna de mercado (CA-14) NO añade esquema.** `micCode` y `exchange` ya existen y ya
  son nullable; la enmienda del gate añade **presentación**, no datos. La única migración de
  esta spec sigue siendo la `0008` del tipo de instrumento.

### Código afectado (mapa para el implementador, no receta)

- `src/lib/market/search.ts:20` — **se borra** el filtro. `searchSymbols` pasa a propagar
  candidatos **y** descartes; `runSymbolSearch` los lleva al `SymbolSearchOutcome`.
- `src/lib/market/twelve-data-search-provider.ts:50-66` — el `continue` mudo de las líneas 50
  y 56 pasa a **empujar un descarte**; la línea 65 deja de normalizar el tipo.
- `src/lib/market/fake-search-provider.ts` — acepta también descartes sembrados y los filtra
  por la misma regla de subcadena.
- `src/lib/market/search-provider-factory.ts` — ver "Símbolos E2E" abajo.
- `src/app/_components/symbol-search.tsx` — tres estados de "sin candidatos" en vez de uno
  (l. 138), y el tipo en cada fila de resultado y en el chip de selección. Además, las
  **l. 99 y 147** dejan de pintar `m.exchange || m.micCode` (texto del proveedor o código
  pelado) y pasan por `market-name.ts` (CA-14).
- **Fichero nuevo** `src/lib/market/instrument-type-text.ts` — traducción de tipo, **hermano
  de `fail-reason-text.ts`** y con la misma responsabilidad: lo que ve el usuario. Se aparta
  en un punto y solo en uno: aquí el `default` **no** es una categoría genérica, es la
  etiqueta del proveedor (ADR-020 pto. 3).
- **Fichero nuevo** `src/lib/market/search-discard-text.ts` (o dentro del anterior) — texto de
  usuario por motivo de descarte.
- **Fichero nuevo** `src/lib/market/market-name.ts` (nombre orientativo) — mapa **total**
  operating MIC → nombre de dominio (CA-14). Vive junto a `mic.ts`, que es de quien depende:
  si algún día se amplía `OPERATING_MICS`, el mapa debe ampliarse con él, y conviene que un
  test lo ate (mapa exhaustivo sobre `OPERATING_MICS`, para que añadir un MIC sin nombre no
  compile o no pase). Lo consumen la tabla de `/vigiladas` y el buscador, para que digan lo
  mismo.
- `src/lib/market/symbol-selection.ts` + `src/lib/portfolio/symbols.ts` (`SymbolMarket`,
  `getOrCreateSymbol`) — el tipo viaja del formulario a la fila del símbolo.
- `src/lib/watchlist/zone-status.ts:56` — la proyección suma **el tipo y el `micCode`** del
  símbolo; `src/app/vigiladas/page.tsx` pinta **dos** columnas nuevas, tipo (CA-13) y mercado
  (CA-14), junto a la de ticker (l. 66).
- `src/lib/import/identity.ts:90` — el comentario «solo renta variable (D-7, CA-9)» deja de
  ser cierto: se actualiza citando ADR-020 (CA-16).
- **Tests que cambian de expectativa a propósito**: `tests/symbol-search.test.ts` (bloque
  «CA-2: solo renta variable (D-7)», l. 45-57) e `tests/import-identity.test.ts` (CA-9). No se
  borran: se **invierten** y se anotan con la referencia a ADR-020, para que el histórico diga
  que fue una decisión y no un descuido.

### Símbolos E2E — esta spec pide los suyos

`E2E_CATALOG` (`search-provider-factory.ts:12`, activado con `E2E_FAKE_SYMBOL_SEARCH=1`) es
**compartido** entre specs, y sus 6 símbolos actuales (`ITX`, `SAN`, `AAPL`, `MSFT`, `REP`,
`TEF`) **ya los usan** los e2e de `vigiladas`, `cartera`, `avisos-zona` e `importar`.
Sembrar los casos nuevos en un símbolo ajeno contaminaría la prueba de otra spec. Esta spec
pide, por tanto, **entradas propias**, marcadas en el código como pertenecientes a SPEC-029:

| Ticker | MIC | Tipo (etiqueta de proveedor) | Divisa | Para qué CA |
|---|---|---|---|---|
| `ORC` | `XNYS` | `REIT` | USD | CA-1, CA-12, CA-13, CA-14, CA-18 |
| `LX` | `XNAS` | `American Depositary Receipt` | USD | CA-2, CA-11 |
| `UPWK` | `XNAS` | `Common Stock` | USD | CA-3 (no regresión) |
| `IWDA` | `XAMS` | `ETF` | EUR | CA-4 |
| `TSCO` | *(descartado)* `XLON` | `Common Stock` | GBp | CA-7, CA-10 (existe y no lo cubrimos) |

`TSCO` **no** es un candidato: se siembra en la lista de **descartes** del fake, porque el
descarte por mercado ocurre en el adaptador y el fake tiene que poder reproducirlo. Ninguno de
los cinco tickers aparece hoy en `tests/e2e/`; **ninguna spec existente los usa**.

### Transversal

- Reglas: **RN-03** (acceso autenticado, CA-17), **RN-09** (divisa única por posición: la
  divisa la sigue fijando el candidato elegido), **RN-01** (aislamiento, sin cambios: la
  búsqueda no lee datos de usuario).
- Decisiones: **ADR-020** (nueva, la gobierna), **ADR-007** (puerto e identidad
  `(ticker, mic_code)`, vigente salvo su pto. 4), **ADR-012** (operating MIC canónico, el
  único filtro que queda), **ADR-002** (símbolo compartido), **ADR-019/SPEC-026** (el esquema
  de test es el de producción, aplicado desde las migraciones), **ADR-018/SPEC-027** (CI en
  cada PR).
- Términos de `docs/fundacion/dominio.md`: *Símbolo (ticker)*, *Acción vigilada*, *Cartera*,
  *Posición*. **Ya aplicado el 2026-08-18**, tras la aprobación de ADR-020 en el gate (la
  fundación no esperaba a la implementación, esperaba al ADR):
  - `FOUNDATION.md` **D-7 sustituida** por el texto del punto 1 de ADR-020, con la redacción
    original conservada debajo y la marca *supersedida por ADR-020 el 2026-08-18*; el bullet de
    §Alcance "Fuera" reinterpretado (lo que queda fuera es el **modelado específico** por tipo;
    cripto y divisas quedan fuera **por mercado**).
  - `docs/fundacion/dominio.md`: fila *Acción / Instrumento* **reescrita** y **dos entradas
    nuevas**, *Tipo de instrumento* (se muestra, no se filtra; lo desconocido en crudo) y
    *Mercado* (operating MIC canónico con su nombre de dominio) — esta segunda porque CA-14 la
    convierte en término visible de la UI y el glosario exige registrarlo antes de usarlo.
  - `docs/fundacion/contexto.md` (l. 11 y 63): **anotado** el superseding de D-7.

  Lo que esta spec debe hacer al implementarse es **no contradecir** ese texto, no volver a
  escribirlo.

### Dónde se verifica: en CI, no a mano (SPEC-027)

Desde **SPEC-027** hay CI en cada PR (`.github/workflows/ci.yml`): dos jobs en paralelo y **un
step por gate**. Esta spec no se da por terminada con "la suite pasa en mi máquina": el PR
tiene que salir verde en los cuatro gates —**typecheck**, **lint** (`npm run lint`, que es
`eslint . --max-warnings=0`: un warning tumba el gate), **unit** (`npm run test`) y **e2e**
(`npm run test:e2e`, con `--forbid-only`: un `.only` olvidado en los e2e nuevos de CA-18
tumba el gate)—.

Dos consecuencias concretas para el implementador:

- Los **e2e nuevos** de esta spec corren en CI contra el catálogo fake; los símbolos propios
  (`ORC`, `LX`, `UPWK`, `IWDA`, `TSCO`) tienen que quedar sembrados de forma que el job de E2E
  los encuentre sin red.
- **`tests/ci-workflow.test.ts` no se puede romper.** Es un test **estático** del propio
  workflow (nombres de los steps, un gate por step, jobs en paralelo, caché, una sola fuente
  para la versión de Node). Esta spec **no tiene ningún motivo para tocar
  `.github/workflows/ci.yml`** ni `package.json`; si alguien lo toca de pasada, ese test lo
  para y la respuesta es revertir el toque, no ajustar el test.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Ampliar los mercados soportados** (XLON, XMIL, XFRA, PINX…). Es una decisión distinta, que
  depende de la cobertura y del plan del proveedor de **cotizaciones** (Marketstack, ADR-012),
  no del de búsqueda: añadir un MIC al buscador sin que Marketstack lo cotice crearía el
  fallo silencioso justo un paso más allá. Aquí solo se hace que **el descarte se vea**
  (CA-7/CA-10). → **F-SPEC-029-1** (candidata a spec propia con dictamen de sdd-mercados).
- **Backfill del tipo** de los símbolos ya existentes (**F-ADR-020-3**).
- **Filtrar, ordenar o agrupar los resultados por tipo** en la UI: ADR-020 rechazó el filtro
  por tipo y esta spec no lo reintroduce disfrazado de "orden". Mejora → EPIC-MEJORA.
- **Mostrar el mercado en la tabla de `/cartera`** (**F-SPEC-025-1**, ya registrado, hermano
  del F-SPEC-024-1 que esta spec sí cierra). El razonamiento del humano vale **igual** ahí:
  dos posiciones del mismo ticker en mercados distintos (ADR-007, SPEC-025) se ven como filas
  idénticas, y con `market-name.ts` ya escrito el coste es pequeño. **Se queda fuera** aun así:
  esta spec entra por el **buscador** y su consumidora directa es `/vigiladas`; `/cartera` es
  otra página, otra proyección (`src/lib/portfolio/`) y otras columnas (cantidad, precio medio,
  P/L) cuyo diseño no ha mirado nadie en este gate. Meterla sería ampliar alcance a ojo el
  mismo día que se amplía una vez. → **F-SPEC-025-1** queda abierto y ahora **barato**: solo
  reutilizar el mapa. Lo mismo para el **tipo** en `/cartera`.
  *(Nota: **F-SPEC-024-1** —el mercado en `/vigiladas`— deja de estar pendiente: lo cierra
  CA-14 por decisión del humano en el gate del 2026-08-18.)*
- **Reglas de negocio específicas por tipo de instrumento** (tratamiento fiscal, dividendos de
  REIT, TER de un ETF, ratio de un ADR frente a la acción subyacente). ADR-020 pto. 7: el
  modelo de cartera **no** se rediseña. El tipo es **informativo**; no entra en ningún cálculo.
- **El caso del bono cotizado en porcentaje del nominal** (**F-ADR-020-1**): asumido, no
  resuelto.
- **La coma decimal y los errores opacos del alta manual**: son **SPEC-030**. No comparten
  código con esta ni se bloquean entre sí.

## Notas para el gate humano

1. **RESUELTO (2026-08-18): ADR-020 está aprobado y la fundación ya está actualizada.**
   Elegiste *no filtrar por tipo* y *que se muestre el tipo*. ADR-020 lo escribió, tú lo
   aprobaste en el gate, y con eso se ha aplicado el superseding de **D-7** en `FOUNDATION.md`
   y las anotaciones en `dominio.md` y `contexto.md`. Ya no hay bloqueo: esta spec se puede
   implementar contra la fundación vigente.
2. **Verificado, como pediste: esto NO arrastra el modelo de cartera.** ADR-003 modela la
   posición con `quantity`/`price`/`gastos`/`ratio`/`amount`, magnitudes agnósticas al tipo:
   un ETF o un REIT se compran, se venden, hacen splits y pagan dividendos igual que una
   acción. **D-6 y RN-04..RN-09 quedan intactos.** El único borde honesto es
   **F-ADR-020-1** (un bono en XETR/XPAR cotiza en % del nominal, y su P/L saldría
   aritméticamente correcto pero semánticamente raro): registrado y **asumido**, porque
   ponerle una regla especial sería reintroducir la lista blanca por la puerta de atrás.
3. **DECIDIDO (humano, 2026-08-18): el tipo desconocido se muestra EN CRUDO.** Era la única
   parte donde me aparto del precedente de SPEC-016 (allí el texto crudo del proveedor nunca
   llega a la UI) y la dejé marcada para que la vieras. Quedó **confirmada tal cual** al
   aprobar ADR-020 sin objeción, y el ADR es inmutable: no es ya una pregunta abierta.
   El motivo, para el registro: allí queríamos **estabilizar** un mensaje de error; aquí
   queremos **no perder información sobre el activo**, y "Otro" es indistinguible de "no te lo
   digo" —que es el defecto que venimos a matar—. La coherencia con SPEC-016 se recupera donde
   sí se puede: el **mercado** (CA-14) tiene vocabulario cerrado por nosotros y por eso ahí se
   traduce siempre, sin crudo. La regla que gobierna las dos: *no perder información y no
   inventarla*.
4. **Esto cambia el import** (CA-16): al resolver la identidad de tu extracto, empezará a
   ofrecerte ETFs y demás. Lo considero **deseable** (tu extracto real puede traerlos y hoy no
   los puedes resolver), pero es un cambio de comportamiento de SPEC-012 y lo digo antes, no
   después.
5. **DECIDIDO (humano, 2026-08-18): entran las DOS columnas, tipo y mercado.** `/vigiladas`
   mostrará **tipo** (CA-13) y **mercado** (CA-14). Motivo registrado: con el mismo ticker en
   dos mercados (ADR-007) la fila es hoy **ambigua** —se puede ver `ORC` dos veces sin saber
   cuál es cuál—. Con esto **F-SPEC-024-1 queda cerrado por SPEC-029** y así está anotado en el
   ledger de SPEC-024 (que sigue en `hecho`; no se reabre).
   Tres cosas que decidí yo al aterrizarlo y conviene que veas, todas en CA-14: se pinta desde
   **`micCode`** y no desde `exchange` (es la mitad de la identidad, y `exchange` es texto libre
   del proveedor); se **traduce** con un mapa total de los 7 MIC (`XNYS` → **NYSE**), no se
   enseña el código; y un símbolo **legacy sin `micCode`** deja la celda **vacía**, no inventa
   mercado. **Ni una columna nueva en la base**: `micCode` ya está guardado.
   Lo que **no** entra: la misma columna en `/cartera` (**F-SPEC-025-1**). El razonamiento vale
   igual allí, pero es otra página y otra proyección, y no la ha mirado nadie hoy. Queda
   abierta y ahora barata: solo reutilizar el mapa. Si la quieres, es su propia spec pequeña.
6. **Toca el esquema, y quiero enunciar el riesgo con precisión.** Se añade una columna nueva,
   nullable, con su migración `drizzle/0008_*.sql`. **Abrir el PR no migra nada**: ADR-018 y
   SPEC-027 verificaron que **no hay integración Vercel↔GitHub**, así que ningún push ni
   ninguna PR construye ni despliega. Lo que sí es cierto: `vercel.json` sigue con el
   `buildCommand` pelado (`npm run db:migrate && npm run build`) y la guardia
   `scripts/guard-migrate.mjs` de **ADR-018 D-2** está **decidida pero no implementada** (hoy
   no existe `scripts/` en el repo; es justo lo que bloquea **F-SPEC-027-2**). El riesgo real,
   entonces, es este: **el próximo despliegue MANUAL a producción aplicará la 0008**. Es un
   `ADD COLUMN` nullable, aditivo, sin movimiento de datos y compatible hacia atrás —riesgo
   bajo—, pero es un `ALTER TABLE` en producción y toca decirlo. Se suma que `DATABASE_URL`
   está compartida entre Production y Preview (**F-SPEC-023-1**), así que no hay un ensayo
   previo aislado: cuando se aplique, se aplica sobre la base buena.
7. **Los símbolos E2E son nuevos y propios** (`ORC`, `LX`, `UPWK`, `IWDA`, `TSCO`). No toco los
   6 que ya existen: están compartidos con los e2e de otras specs y sembrar en ellos
   contaminaría sus pruebas.
8. **Lo que sigue estando fuera es el mercado, no el tipo.** Cripto y divisas **seguirán sin
   aparecer** — no porque las filtremos por tipo, sino porque no cotizan en ninguno de los 7
   mercados que cubrimos. Si algún día añadimos un mercado que las liste, entrarán: es
   consecuencia consciente de tu decisión y prefiero que quede escrita aquí.

---
*Historial de la spec: redactada el 2026-08-18 junto con **ADR-020**. **Enmendada el
2026-08-18** tras el gate humano: ADR-020 queda **aprobado** (las notas 1 y 3 pasan de pregunta
abierta a decisión registrada; el superseding de D-7 ya está aplicado en la fundación) y entra
la columna de **mercado** en `/vigiladas` (nota 5), que cierra **F-SPEC-024-1**. Cambios en los
CA: **CA-14 nuevo** (mercado), **CA-15** ampliado (el legacy sin `micCode` también deja celda
vacía), **CA-18** ampliado (el e2e comprueba mercado además de tipo) y los antiguos
CA-14..CA-17 renumerados a **CA-15..CA-18**. La spec sigue en `borrador`: su aprobación la
registra el orquestador, no la arquitecta.*
