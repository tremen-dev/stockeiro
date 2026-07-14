---
id: ADR-007
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
---
# ADR-007: Identidad de simbolo por ticker mas mic_code y busqueda de simbolos tras puerto

- Deciders: propone sdd-arquitecto (con dictamen de dominio sdd-mercados, verificado online 2026-07-14); aprobado por el humano (gate) el 2026-07-14.
- Specs relacionadas: SPEC-008 (Buscador de símbolos por nombre) lo origina. Reinterpreta el punto 3 de **ADR-002** (identidad del símbolo compartido) y toca al adaptador `TwelveDataProvider.getQuotes` de **SPEC-004**. Consumido por SPEC-003 (acciones vigiladas) y SPEC-002 (cartera), que referencian el símbolo.

## Contexto
Hoy el usuario teclea el ticker a pelo (`watch-form.tsx`, `portfolio-forms.tsx`);
un error se persiste igual y el refresco diario `/eod` (SPEC-004) no encuentra
precio → P/L en "—" y zonas que nunca disparan, sin feedback. Es un fallo
silencioso. Se quiere buscar la acción por **nombre** ("Microsoft" → MSFT).

Verificación de dominio (sdd-mercados, búsqueda online 2026-07-14):
- **Twelve Data `/symbol_search`** está en el **free tier (Basic)**, cuesta 1
  crédito/llamada y busca por nombre, ticker, ISIN y FIGI. Devuelve por fila:
  `symbol`, `instrument_name`, `exchange`, `mic_code`, `currency`, `country`,
  `instrument_type`. Fuente: https://twelvedata.com/docs.
- **Yahoo Finance** (autocomplete no oficial) queda **descartado**: usa otro
  namespace de símbolos (sufijos `ITX.MC`, `BMW.DE`) que **no** coincide con el
  que `/eod` acepta, y sus términos son "personal use only". Mezclarlo rompería
  la coherencia símbolo↔cotización. Coherente con el rechazo de Yahoo ya hecho en
  ADR-002 para cotizaciones.

Observación clave (invariante que ADR-002 no cerró): **un mismo ticker existe en
varios mercados**. `/symbol_search` para "SAN" o "ITX" devuelve **varias filas**
con el mismo `symbol` pero distinto `mic_code`/`exchange`/`currency` (p. ej.
Santander cotiza en BME, LSE y NYSE en divisas distintas). ADR-002 asumió "un
símbolo por ticker" (`symbols.ticker` único). Con esa identidad, dos mercados del
mismo ticker colisionan y `/eod` — al que hoy se le manda solo `symbol` — puede
devolver el precio de **otra bolsa y otra divisa**, falseando P/L (RN-06) y
disparos (RN-11). La divisa de la posición es única (RN-09): el símbolo debe
fijar de qué mercado/divisa hablamos.

## Decisión
1. **Identidad del símbolo = `ticker` + `mic_code`** (Market Identifier Code,
   ISO 10383), no solo `ticker`. La entidad `symbols` (ADR-002) gana `mic_code`,
   `exchange` y `name` (instrument_name); la unicidad pasa de `ticker` a
   **`(ticker, mic_code)`**. Reinterpreta el punto 3 de ADR-002 (registro
   compartido de símbolos): **sigue siendo global y compartido**, solo se afina su
   clave para distinguir mercados. La `currency` del símbolo pasa a venir de la
   fila elegida en la búsqueda, no de un valor tecleado/hardcodeado.
2. **La cotización se pide por (`ticker`, `mic_code`)**: el puerto
   `MarketDataProvider.getQuotes` deja de recibir `string[]` y pasa a recibir la
   identidad de mercado; el adaptador Twelve Data manda `mic_code` a `/eod` (que lo
   acepta) para que el precio sea el del mercado correcto. Es un cambio de contrato
   del puerto de SPEC-004 (ver follow-up).
3. **Nuevo puerto de dominio `SymbolSearchProvider`** (frontera de integración,
   patrón ADR-002): expone `search(query) -> SymbolMatch[]` con
   `{ticker, micCode, exchange, name, currency, country}`. El dominio y la UI
   dependen del puerto, **no** de Twelve Data. Primer adaptador: Twelve Data
   `/symbol_search`; un **fake** cubre los tests (como `FakeMarketDataProvider`).
   Se separa de `MarketDataProvider` (cotizar) porque es otra responsabilidad;
   un proveedor podría dar búsqueda y otro precios.
4. **Solo renta variable** (D-7): la búsqueda filtra `instrument_type` a acciones;
   ETFs, cripto y derivados no se ofrecen aunque el proveedor los devuelva.
5. **Presupuesto de API compartido** con el refresco diario (free tier ~8/min,
   ~800/día, ADR-002): la búsqueda es interactiva, así que se protege con
   **debounce** en el cliente y umbral mínimo de caracteres; el detalle de la
   política (y caché opcional) lo fija SPEC-008.

## Consecuencias
### Positivas
- Elimina el fallo silencioso de raíz: el símbolo persistido es uno que `/eod`
  cotiza en el mercado y divisa correctos → P/L y disparos fiables.
- Divisa real capturada en el origen (RN-09), sin asumir EUR.
- Búsqueda intercambiable de proveedor (puerto), sin lock-in ni tocar dominio.
- Reutiliza el proveedor ya contratado (Twelve Data): coste marginal cero.

### Negativas / follow-ups
- **Migración de esquema**: `symbols` gana columnas y cambia su índice único
  (`ticker` → `(ticker, mic_code)`). Datos sembrados sin `mic_code` deben
  backfillarse o marcarse; lo detalla SPEC-008.
- **Cambio de contrato del puerto `MarketDataProvider.getQuotes`** (SPEC-004):
  pasa de `string[]` a la identidad con `mic_code`. Afecta al adaptador Twelve
  Data, al fake y al servicio de refresco/dedupe (la dedupe pasa a ser por
  `(ticker, mic_code)`). Coordinar con la implementación de SPEC-008.
- Presupuesto diario finito compartido: la búsqueda consume créditos; vigilar
  consumo si crece el uso (mismo aviso que ADR-002).

## Alternativas consideradas
- **Mantener identidad solo por `ticker` (ADR-002 tal cual) y buscar sin mercado:**
  simple, pero deja el fallo de mercado/divisa equivocada abierto; rechazado por
  falsear P/L y disparos (RN-06, RN-11, RN-09).
- **Yahoo Finance / autocomplete no oficial:** namespace de símbolos incompatible
  con `/eod` y ToS "personal use only"; rechazado por romper coherencia
  símbolo↔cotización (dictamen sdd-mercados).
- **Reusar `MarketDataProvider` añadiéndole `search()`:** mezcla dos
  responsabilidades (buscar vs. cotizar) en un puerto; rechazado por cohesión —
  un proveedor de búsqueda y uno de precios podrían diferir.
- **Índice local de símbolos (descarga del catálogo completo):** evita llamadas
  por búsqueda, pero exige sincronizar >1M de símbolos y mantenerlos; sobredimen-
  sionado para v1. Queda como opción futura si el consumo de créditos aprieta.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
