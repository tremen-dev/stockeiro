---
id: ADR-020
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-18, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-18, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-020: El buscador no filtra por tipo de instrumento y ningún descarte es mudo

- Deciders: propone **sdd-arquitecto**. La decisión de alcance —**no filtrar por tipo de
  instrumento y mostrar el tipo**— la tomó el **humano (Alberto Fojo)** en el gate del
  **2026-08-18**, eligiendo entre dos opciones que se le plantearon, con estas palabras:
  «*no sé si el filtro es correcto, cuando quiero vigilar un activo no quiero tener que
  filtrar, prefiero que me diga qué tipo de activo es y listo. puede aparecer también en
  la tabla*». Queda pendiente su **aprobación formal** del ADR (que es lo que habilita el
  superseding de D-7).
- Specs relacionadas: **SPEC-029** (buscador sin filtro de tipo, con tipo visible y motivo
  del descarte) lo origina y es su primera consumidora. **Supersede** el punto 4 de
  **ADR-007** ("Solo renta variable") y la decisión locked **D-7** de `FOUNDATION.md` en su
  parte de filtro. Deja sin efecto **CA-2 de SPEC-008** y **CA-9 de SPEC-012**. Reutiliza el
  patrón de **ADR-012 punto 6** / **SPEC-016** (el puerto informa de por qué no hubo dato).
  No toca **ADR-003** (modelo de cartera) ni **ADR-012** (identidad por operating MIC).

## Contexto

El buscador de símbolos (`/vigiladas`, `/cartera`) **oculta valores que existen, cotizan y
son perfectamente vigilables**. Reportado por el humano en producción el 2026-08-18 y
verificado sondeando la API real de Twelve Data `/symbol_search` con la clave del `.env`:

| Búsqueda | Ticker | `mic_code` | `instrument_type` | Divisa | Nombre |
|---|---|---|---|---|---|
| `upwork` | `UPWK` | `XNGS` → **XNAS** | `Common Stock` | USD | Upwork Inc. |
| `lexinfintech` | `LX` | `XNGS` → **XNAS** | `American Depositary Receipt` | USD | LexinFintech Holdings Ltd. ADS |
| `orchid island` | `ORC` | **`XNYS`** | `REIT` | USD | Orchid Island Capital Inc. |

Los tres caen en **mercados soportados** (los 7 operating MIC de `src/lib/market/mic.ts`) y
los tres son **cotizables** con el dialecto Marketstack ya arreglado (SPEC-020/SPEC-021: en
EEUU se pide el ticker pelado). Aun así, buscar «orchid island capital» o «lexinfintech»
devuelve **"Sin resultados"**: el mismo texto que si el valor no existiera.

### Causa raíz: vocabulario de proveedor colado como regla de dominio

Dos líneas, en dos capas distintas, implementan D-7:

- `src/lib/market/search.ts:20` — `return raw.filter((m) => m.type === 'stock');`
- `src/lib/market/twelve-data-search-provider.ts:65` — `type: /stock/i.test(instrumentType) ? 'stock' : instrumentType.toLowerCase()`

O sea: **pasa lo que el proveedor haya escrito con la palabra "stock" dentro**. Eso no es
"solo renta variable": `REIT` y `American Depositary Receipt` **son** renta variable —un REIT
es una sociedad cotizada y un ADR es el envoltorio con el que una acción extranjera cotiza en
EEUU—, y quedan fuera solo porque el proveedor no las llamó "stock". El filtro no implementa
la regla que dice implementar.

Y no es un caso raro: el vocabulario de `instrument_type` de un proveedor **crece y cambia**
sin avisar, y con este diseño **cada valor nuevo desaparece en silencio**. Una lista blanca de
tipos es una trampa permanente: ampliarla con `REIT` y `ADR` arregla los tres casos de hoy y
deja armado exactamente el mismo defecto para el siguiente `Depositary Receipt`, `Unit`,
`Trust` o `Closed-End Fund` que el proveedor decida devolver.

### El descarte, además, es mudo

Cuando el descarte se lo come todo, la UI (`src/app/_components/symbol-search.tsx`, estado
`empty`) dice «*Sin resultados para «x»*». El usuario **no puede distinguir "ese valor no
existe" de "lo hemos descartado nosotros"** — y sin esa distinción no tiene ninguna acción
posible: ni corregir el nombre, ni entender que el problema no es suyo.

Es **exactamente** el modo de fallo que SPEC-016 ya erradicó un puerto más allá, para las
cotizaciones: allí `getQuotes` dejó de tragarse el motivo (ADR-012 punto 6), se clasificó en
vocabulario de dominio (`QuoteFailureReason`) y se le puso texto de usuario
(`fail-reason-text.ts`). El buscador se quedó fuera de aquella limpieza. **CE-F2 de EPIC-FIX**
—"ningún fallo silencioso"— no admite esa excepción.

Hay **dos** causas de descarte mudo hoy, no una:

1. El **filtro de tipo** (arriba), que este ADR elimina.
2. El **filtro de mercado**: `toOperatingMic` devuelve `null` para cualquier MIC fuera de los
   7 soportados y el adaptador hace `continue` (`twelve-data-search-provider.ts:56`). Una
   acción cuya única plaza sea **XMIL** (Milán), **XLON** (Londres), **XFRA** (Fráncfort) o
   **PINX** (OTC) desaparece sin explicación. No bloquea los tres casos reportados, pero
   saldrá en cuanto un tester busque un valor europeo no-BME — y la app se va a compartir con
   testers en un foro de bolsa, donde la primera impresión importa (R-F4).

### Lo que el filtro de mercado ya acota (dato que acotó la decisión)

`src/lib/market/mic.ts` solo admite **7 operating MIC**: `BMEX`, `XNAS`, `XNYS`, `XETR`,
`XSTO`, `XPAR`, `XAMS`. Ese filtro **ya excluye de facto cripto y divisas**, que no cotizan en
ninguno de ellos. Por tanto "no filtrar por tipo" **no** significa abrir la puerta a bitcoin:
en la práctica significa **dejar entrar ETFs, REITs, ADRs y fondos cotizados en esos 7
mercados**, que es justo lo que un inversor particular quiere vigilar.

## Decisión

1. **Se supersede D-7 en su parte de filtro.** El producto deja de restringir el
   **instrumento** a "la acción". Admite **cualquier instrumento que el proveedor devuelva en
   un mercado soportado**. Lo que D-7 protegía de verdad —acotar el **modelo de dominio** al
   problema validado— **no cambia**: el modelo sigue siendo el de ADR-003 y no se añade
   ninguna entidad, ningún cálculo ni ninguna pantalla por tipo de instrumento.

   Texto de sustitución para `FOUNDATION.md`, a aplicar **cuando este ADR se apruebe**:

   > - **D-7** (2026-07-13, *supersedida por ADR-020 el 2026-08-18*): El instrumento **es el
   >   que cotice en un mercado soportado**. No se filtra por tipo de instrumento: el
   >   buscador ofrece lo que el proveedor devuelva en los mercados soportados y **muestra**
   >   de qué tipo es (acción, REIT, ADR, ETF…). El **modelo de dominio sigue siendo el de la
   >   acción** (ADR-003: ledger, precio medio, splits, dividendos, P/L actual vs. realizado);
   >   lo que se retira es la **lista blanca de tipos**, no la contención del modelo.
   >   *Redacción original*: «El instrumento es la acción. Otros instrumentos (fondos, cripto,
   >   derivados, divisas) quedan fuera del núcleo».

2. **El buscador no filtra por `instrument_type`.** Desaparece
   `raw.filter((m) => m.type === 'stock')` de `searchSymbols`. **Ninguna capa** vuelve a
   decidir qué tipos "valen": no hay lista blanca, ni en el dominio ni en el adaptador.

3. **El tipo se MUESTRA, no se juzga.** `SymbolMatch.type` deja de normalizarse a
   `'stock'`/minúsculas y **conserva la etiqueta del proveedor**. Para presentarlo:
   - hay una **traducción a vocabulario del dominio** para las etiquetas conocidas
     (`Common Stock` → *Acción*, `REIT` → *REIT*, `American Depositary Receipt` → *ADR*,
     `ETF` → *ETF*…);
   - lo **desconocido se muestra tal cual lo dijo el proveedor**, y **nunca** se descarta ni
     se oculta.

   Este es el punto donde ADR-020 se **aparta** deliberadamente del precedente de SPEC-016
   (donde el texto crudo del proveedor jamás llega a la UI). El motivo: allí el objetivo era
   **estabilizar** un mensaje de error frente a los cambios de redacción del proveedor; aquí
   el objetivo es **no perder información sobre el activo**. Un tipo desconocido mostrado en
   crudo es informativo e inofensivo; un tipo desconocido tragado es **el defecto que este ADR
   viene a matar**. La regla, entonces: *el vocabulario del proveedor nunca decide; puede
   informar*.

4. **El mercado sigue siendo el único filtro**, con los 7 operating MIC de `mic.ts` como
   frontera (ADR-012). No se amplían aquí: ampliar la cobertura de mercados es una decisión
   distinta, con coste de proveedor, y va por su propia vía.

5. **Ningún descarte es mudo** (CE-F2). El puerto `SymbolSearchProvider` (ADR-007 punto 3)
   pasa a **informar de lo que descartó y por qué**, igual que `MarketDataProvider.getQuotes`
   hizo en ADR-012 punto 6: deja de devolver una lista de candidatos y pasa a devolver
   candidatos **y** descartes con motivo clasificado del dominio. El usuario distingue
   siempre estos tres desenlaces:
   - **no existe**: el proveedor no devolvió nada;
   - **existe pero no lo cubrimos**: el proveedor devolvió filas y **todas** se descartaron,
     con su motivo (p. ej. mercado no soportado) y el mercado concreto de lo descartado;
   - **hay candidatos**, con o sin descartes junto a ellos.

   La forma exacta del tipo, los motivos y su texto de usuario los fija **SPEC-029**, igual
   que ADR-012 dejó la forma a SPEC-016.

6. **El tipo se persiste con el símbolo.** Para poder mostrarlo también en la tabla de
   `/vigiladas` (petición explícita del humano), `symbols` gana una columna de tipo,
   nullable: los símbolos ya creados no lo tienen y **se degradan mostrando nada**, no un
   valor inventado. Sigue la misma política que `micCode`/`exchange`/`name`, que ya son
   nullable por los símbolos legacy pre-ADR-007.

7. **El modelo de cartera NO se rediseña. Verificado, no supuesto.** ADR-003 modela la
   posición como *ledger* de eventos `buy`/`sell`/`split`/`dividend` con `quantity`, `price`,
   `gastos`, `ratio` y `amount` — magnitudes **agnósticas al tipo de instrumento**. Un ETF, un
   REIT o un ADR se compran por participaciones a un precio, hacen splits y reparten
   dividendos exactamente igual que una acción: precio medio (RN-04), P/L realizado (RN-05),
   P/L actual (RN-06), splits (RN-07), no sobreventa (RN-08) y divisa única (RN-09) **se
   aplican sin cambio alguno**. **D-6 no se toca** y **ADR-003 no se reinterpreta**.

## Consecuencias

### Positivas
- **Los tres casos reportados dejan de estar rotos**: `UPWK`@XNAS, `LX`@XNAS (ADR) y
  `ORC`@XNYS (REIT) aparecen en el buscador y se pueden vigilar y comprar.
- **Se cierra la clase entera de defecto, no los tres casos**: al no haber lista blanca, el
  próximo `instrument_type` que Twelve Data invente **no rompe nada**. Con la alternativa
  "añadir REIT y ADR a la lista" volveríamos aquí en semanas.
- **El usuario gana información que hoy no tiene**: saber que ORC es un REIT y que LX es un
  ADR es relevante para decidir, y hoy la app se lo oculta incluso cuando sí muestra el valor.
- **CE-F2 se extiende al buscador**, que era el último sitio del flujo donde un descarte
  seguía siendo mudo. El flujo completo *buscar → vigilar → cotizar* queda sin puntos ciegos.
- **Coste de implementación bajo y sin migración de datos**: se **borra** un filtro, se añade
  una columna nullable y se propaga un motivo. No hay backfill ni reescritura de historia.

### Negativas / follow-ups
- **F-ADR-020-1 — Instrumentos con semántica de precio distinta.** Los 7 mercados admitidos
  no listan solo acciones: en `XETR`/`XPAR` cotizan también **bonos** (que se cotizan en
  **porcentaje del nominal**, no en euros por título) y **derivados/certificados**. Si un
  usuario vigila uno, el P/L saldrá aritméticamente correcto pero **semánticamente raro**
  (RN-06 calcula `(precio − medio) × cantidad`, que en un bono no es dinero). **Se asume**:
  es un caso que exige buscarlo a propósito, el dato mostrado no miente (es el precio que
  publica el mercado) y ponerle una regla especial sería reintroducir la lista blanca por la
  puerta de atrás. Queda registrado para que, si aparece de verdad, se trate como spec propia
  y no como sorpresa.
- **F-ADR-020-2 — El tipo mostrado depende del proveedor de búsqueda.** Si algún día la
  búsqueda cambia de proveedor (ADR-007 la dejó tras puerto justo para eso), el vocabulario de
  tipos cambia con él y las traducciones conocidas habrá que revisarlas. El diseño lo tolera
  (lo desconocido se muestra en crudo, no se pierde), pero la tabla de traducción es
  mantenimiento recurrente.
- **F-ADR-020-3 — Símbolos ya guardados sin tipo.** Todo lo vigilado antes de SPEC-029 tendrá
  la columna a `null` y la tabla mostrará hueco. No se backfillea: exigiría una llamada de
  búsqueda por símbolo contra el free tier. Se rellenará solo si alguien vuelve a elegir ese
  valor en el buscador. Aceptado.
- **Cambio de contrato del puerto `SymbolSearchProvider`** (punto 5): afecta al adaptador real
  (`twelve-data-search-provider.ts`), al fake (`fake-search-provider.ts`), al servicio de
  dominio (`search.ts`) y a **la resolución de identidad del import**
  (`src/lib/import/identity.ts:90`, SPEC-012/SPEC-014), que consume `searchSymbols`. Es el
  mismo tipo de cambio que SPEC-016 hizo en `getQuotes` y tiene el mismo coste: mecánico y
  contenido. Lo detalla SPEC-029.
- **El import empieza a ofrecer no-acciones** al resolver la identidad de una posición del
  extracto. Es **deseable** (el extracto de ING puede traer ETFs y el usuario hoy no los puede
  resolver), pero **cambia el comportamiento de SPEC-012** y por eso está escrito aquí y no
  descubierto luego.

### Artefactos afectados por el superseding

| Artefacto | Qué dice hoy | Qué pasa con ADR-020 |
|---|---|---|
| `FOUNDATION.md` D-7 | «El instrumento es la acción… fondos, cripto, derivados y divisas quedan fuera» | **Supersedida** en su parte de filtro; texto de sustitución en el punto 1. La contención del **modelo** sobrevive |
| `FOUNDATION.md` §Alcance, "Fuera" | «Instrumentos distintos de acciones (fondos, cripto, derivados, divisas)» | **Reinterpretado**: lo que queda fuera es el **modelado específico** de esos instrumentos, no su vigilancia. Cripto y divisas siguen fuera **por mercado** (ningún operating MIC soportado las lista), no por tipo |
| `ADR-007` punto 4 ("Solo renta variable") | «la búsqueda filtra `instrument_type` a acciones; ETFs, cripto y derivados no se ofrecen» | **Supersedido**. El resto de ADR-007 (identidad `(ticker, mic_code)`, puerto de búsqueda, presupuesto de API) **sigue vigente** |
| `ADR-007` punto 3 (puerto) | `search(query) -> SymbolMatch[]` | **Ampliado**, no supersedido: el puerto sigue existiendo igual; devuelve además los descartes (punto 5) |
| `docs/fundacion/dominio.md`, fila *Acción / Instrumento* | «es el único instrumento que modela el núcleo… quedan fuera (D-7)» | **Se reescribe** en SPEC-029: el instrumento es lo cotizado en un mercado soportado; el **modelo** es el de la acción. Entrada nueva de dominio: **Tipo de instrumento** |
| `docs/fundacion/contexto.md` (l. 11 y 63) | Cita «D-1..D-7 (locked)» | **Se anota** que D-7 está supersedida por ADR-020. Sin más cambio |
| `SPEC-008` CA-2 ("Solo renta variable, D-7") | Exige descartar ETF/cripto | **Sin efecto**. SPEC-029 lo sustituye por su contrario y lo deja anotado en SPEC-008; la spec queda `hecho` con la nota, no se reabre |
| `SPEC-012` CA-9 ("Solo acciones, D-7") | El import solo ofrece acciones | **Sin efecto**, misma vía. El test que hoy exige descartar el ETF cambia de expectativa: es un cambio **querido**, no una regresión |
| `ADR-003`, `D-6`, `RN-04..RN-09` | Modelo de cartera y P/L | **Intactos** (punto 7, verificado) |
| `ADR-012`, `mic.ts` | Identidad canónica por operating MIC | **Intacto y reforzado**: pasa a ser el **único** filtro |

## Alternativas consideradas

- **Ampliar la lista blanca con `REIT` y `American Depositary Receipt`** (el arreglo mínimo).
  **Rechazada**: arregla los tres casos de hoy y **conserva la causa raíz**. El vocabulario del
  proveedor crece; el siguiente tipo nuevo vuelve a desaparecer en silencio y volvemos a esta
  misma conversación con la confianza del usuario ya gastada (R-F4). Es la opción que el
  humano **descartó explícitamente** en el gate del 2026-08-18.
- **Filtro por tipo configurable por el usuario** (una casilla "incluir ETFs y otros
  instrumentos"). **Rechazada** por el humano con el argumento directo: «*cuando quiero
  vigilar un activo no quiero tener que filtrar*». Además traslada al usuario un problema de
  vocabulario de proveedor que él no puede entender, y añade estado de preferencias que hoy no
  existe.
- **Mostrar todo pero sin decir de qué tipo es.** **Rechazada**: resuelve el defecto 1 y deja
  al usuario sin saber que ORC es un REIT o LX un ADR, que es información que **cambia la
  decisión de inversión**. Y era la mitad expresa de la petición: «*prefiero que me diga qué
  tipo de activo es y listo*».
- **Filtrar en el adaptador en vez de en el dominio** (mover la línea de sitio).
  **Rechazada**: es la misma regla en otra capa. El problema no es *dónde* vive el filtro, es
  que el filtro existe.
- **Traducir el tipo desconocido a una categoría genérica ("Otro")**, por coherencia estricta
  con SPEC-016. **Rechazada**: destruye justo la información que el usuario pidió. "Otro" y
  "no te lo digo" son lo mismo para quien busca. Se prefiere la incoherencia **explicada** del
  punto 3.
- **Ampliar también los mercados soportados** (XLON, XMIL, XFRA, PINX) en este mismo ADR.
  **Rechazada por alcance**: es una decisión distinta —depende de la cobertura y del plan del
  proveedor de **cotizaciones** (Marketstack, ADR-012), no del de búsqueda— y mezclarla haría
  este ADR indecidible. Lo que sí entra aquí es que ese descarte **deje de ser mudo** (punto
  5): el usuario que busque Tesco sabrá que existe y que no lo cubrimos, en vez de creer que
  no existe.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
