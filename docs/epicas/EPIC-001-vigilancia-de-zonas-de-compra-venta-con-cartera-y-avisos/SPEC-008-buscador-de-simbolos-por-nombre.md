---
id: SPEC-008
tipo: spec
epica: EPIC-001
estado: en-revision
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-07-14, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-07-14, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-07-14, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-07-14, por: sdd-implementador}
---
# SPEC-008 — Buscador de simbolos por nombre

## Problema
Hoy el usuario **teclea el ticker a pelo** al vigilar una acción
(`src/app/vigiladas/watch-form.tsx`, input libre `"ITX"` con `currency=EUR`
hardcodeado) y al añadir una posición (`src/app/cartera/portfolio-forms.tsx`).
Conocer el ticker exacto de una acción que solo se conoce por su nombre
("Microsoft" → MSFT) es difícil. Peor: si se teclea mal, **se persiste igual**,
el refresco diario `/eod` (SPEC-004) no encuentra precio y el P/L queda en "—"
(RN-06) y las zonas nunca disparan (RN-11) **sin ningún aviso** — un fallo
silencioso. Además, aun con el ticker correcto, un mismo ticker existe en
**varios mercados** con distinta divisa; sin fijar el mercado, la cotización
puede venir de la bolsa equivocada (RN-09).

Esta spec entrega un **buscador de símbolos por nombre** (o ticker/ISIN) que
resuelve el nombre a un símbolo **concreto de un mercado** (ticker + `mic_code` +
divisa reales), reutilizando el proveedor ya contratado (Twelve Data
`/symbol_search`, free tier) **tras un puerto de dominio** nuevo. Implementa
**ADR-007**; reinterpreta la identidad de símbolo de **ADR-002**. Reglas: **RN-09,
RN-01, RN-06, RN-11**. Dominio: sdd-mercados. Se aplica en los **dos** formularios
(vigiladas y cartera) mediante un componente compartido. NO incluye cotizar ni
disparar (specs propias) ni descargar el catálogo completo de símbolos.

## Usuarios / roles afectados
- **Usuario final**: al vigilar una acción o registrar una posición, busca por
  nombre, ve candidatos (nombre, ticker, bolsa, divisa) y **elige uno**; el
  formulario queda ligado a ese símbolo concreto. Todo bajo su sesión (RN-01).
- **Sistema** (indirecto): el refresco (SPEC-004) cotiza el símbolo elegido en su
  mercado correcto porque queda persistido con `mic_code`.

## Criterios de aceptación
Cada CA es verificable con un test. La búsqueda usa un **proveedor fake** tras el
puerto `SymbolSearchProvider` (ADR-007); el adaptador real de Twelve Data se
escribe pero no se llama en tests (análogo a SPEC-004).

- **CA-1 (Buscar por nombre).**
  Dado un usuario autenticado,
  cuando busca "Microsoft",
  entonces el buscador devuelve candidatos que incluyen el símbolo `MSFT`, cada uno
  con `ticker`, `name` (instrument_name), `exchange`, `micCode` y `currency`
  (a través del puerto, no llamando al proveedor real).
- **CA-2 (Solo renta variable, D-7).**
  Dado un término cuya respuesta del proveedor incluye acciones, ETFs y cripto,
  cuando se listan los candidatos,
  entonces solo se ofrecen los de tipo **acción** (`instrument_type` = stock); los
  demás instrumentos se descartan (D-7).
- **CA-3 (Desambiguación por mercado, ADR-007/RN-09).**
  Dado un ticker que cotiza en varios mercados (mismo `ticker`, distinto `micCode`
  y `currency`),
  cuando se listan los candidatos,
  entonces cada mercado aparece como una opción **distinta** distinguible por su
  `exchange`/`micCode` y su `currency`; no se colapsan en una sola.
- **CA-4 (Selección fija identidad y divisa).**
  Dado que el usuario elige un candidato concreto,
  cuando se envía el formulario (vigilar o añadir posición),
  entonces el símbolo se resuelve/crea con **(`ticker`, `micCode`)** como identidad
  y con la `currency` **del candidato elegido** — no un valor tecleado ni EUR fijo.
- **CA-5 (Símbolo compartido por mercado, ADR-002 + ADR-007).**
  Dado que el usuario A ya usa el símbolo (`ITX`, `XMAD`),
  cuando el usuario B elige ese mismo (`ITX`, `XMAD`),
  entonces ambos referencian el **mismo** registro de símbolo (upsert por
  `(ticker, micCode)`); si B eligiera `ITX` en otro mercado, sería **otro** símbolo.
- **CA-6 (Coherencia símbolo↔cotización, ADR-007).**
  Dado un símbolo elegido con su `micCode`,
  cuando el refresco pide su cotización a través del puerto `MarketDataProvider`,
  entonces la petición incluye el `micCode` del símbolo (el mercado correcto), de
  modo que el precio devuelto corresponde a ese mercado y divisa (RN-09), no a otra
  bolsa homónima.
- **CA-7 (Aislamiento por usuario, RN-01).**
  Dada la acción de búsqueda,
  cuando la invoca un usuario sin sesión válida,
  entonces se rechaza (RN-03); y ningún resultado depende de datos de otro usuario
  (la búsqueda es contra el proveedor, no contra datos ajenos).
- **CA-8 (Resiliencia del proveedor).**
  Dado que el proveedor de búsqueda falla o no devuelve candidatos,
  cuando el usuario busca,
  entonces el formulario informa "sin resultados / búsqueda no disponible" y **no**
  permite guardar un símbolo sin resolver; el fallo no rompe la página.
- **CA-9 (Ambos formularios, componente compartido).**
  Dado el buscador,
  cuando el usuario está en `/vigiladas` o en `/cartera`,
  entonces el mismo componente de búsqueda-y-selección está disponible en ambos y
  produce la misma identidad de símbolo `(ticker, micCode, currency)`.
- **CA-10 (Debounce / umbral, presupuesto de API — ADR-007).**
  Dado el buscador interactivo,
  cuando el usuario teclea,
  entonces no se dispara una búsqueda por pulsación: se aplica un **umbral mínimo de
  caracteres** y **debounce** antes de consultar el puerto (protege el free tier
  compartido con el refresco, ADR-002).

## Entidades y reglas afectadas
- **`symbols`** (compartida, ADR-002 → **reinterpretada por ADR-007**): gana
  `micCode`, `exchange`, `name`; la unicidad pasa de `ticker` a **`(ticker,
  micCode)`**; `currency` proviene de la búsqueda. Migración de esquema (backfill
  de símbolos sembrados sin `micCode`): la resuelve el implementador con dictamen
  sdd-mercados.
- **Puerto `SymbolSearchProvider`** (nuevo, ADR-007): `search(query) ->
  {ticker, micCode, exchange, name, currency, country}[]` filtrado a acciones.
  Implementaciones: `TwelveDataSymbolSearchProvider` (real, `/symbol_search`) y un
  fake para tests.
- **Puerto `MarketDataProvider.getQuotes`** (SPEC-004): cambia de contrato para
  recibir la identidad con `micCode` y pasarla a `/eod` (CA-6). Toca el adaptador
  Twelve Data, el fake y la dedupe del refresco (ahora por `(ticker, micCode)`).
- **UI**: componente compartido de búsqueda-y-selección reemplaza el input libre de
  ticker en `watch-form.tsx` y `portfolio-forms.tsx`; se elimina el `currency=EUR`
  hardcodeado.
- Reglas: **RN-09** (divisa única por posición), **RN-01/RN-03** (aislamiento y
  acceso), **RN-06/RN-11** (coherencia del precio que alimenta P/L y disparos).
  Decisiones: **ADR-007** (identidad + puerto), **ADR-002** (símbolo compartido,
  reinterpretado). Términos: `docs/fundacion/dominio.md` (símbolo/ticker, cotización,
  puerto de datos de mercado).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Cotizar y disparar**: SPEC-004/SPEC-005. Aquí solo se resuelve nombre → símbolo
  y se persiste su identidad de mercado.
- **Catálogo local completo de símbolos** (descargar y sincronizar >1M símbolos):
  ADR-007 lo deja como opción futura; v1 consulta el proveedor por búsqueda.
- **Instrumentos no-acción** (ETF, cripto, derivados, fondos): D-7; se filtran.
- **Migración retroactiva de datos de usuarios reales**: si hubiera símbolos
  sembrados sin `micCode`, el plan de backfill se acota en implementación; esta spec
  fija la identidad objetivo, no el guion de migración.
- **Autocompletado avanzado / ranking de relevancia propio**: se usa el orden del
  proveedor; afinar relevancia queda a futuro.
- **Llamada real a Twelve Data en tests**: proveedor fake; la key real y la
  verificación contra la API son follow-up de despliegue (se suma a la env ya
  existente `TWELVE_DATA_API_KEY`).

## Notas para el gate humano
Contexto para decidir. Puntos que quiero que confirmes:

1. **Identidad de símbolo `(ticker, mic_code)` en vez de solo `ticker`
   (ADR-007).** Es la decisión de fondo: distingue el mismo ticker en distintos
   mercados/divisas y arregla el fallo silencioso de raíz, **pero** cambia el
   esquema de `symbols` (columnas + índice único) y **el contrato del puerto
   `getQuotes` de SPEC-004** (pasa `mic_code` a `/eod`). ¿Apruebas ADR-007 con ese
   alcance, sabiendo que arrastra migración de esquema y retoque del adaptador de
   ingesta?
2. **Proveedor: Twelve Data `/symbol_search`** (free tier, ya contratado), **Yahoo
   descartado** por namespace incompatible con `/eod` y ToS. ¿Conforme?
3. **Solo acciones (D-7):** el buscador oculta ETFs/cripto aunque el proveedor los
   devuelva. ¿OK?
4. **Divisa del candidato elegido**, fin del `currency=EUR` hardcodeado. ¿OK?
5. **Proveedor fake en tests** (Twelve Data real sin llamar): los CA se prueban con
   candidatos inyectados; el `/symbol_search` real queda sin cobertura automática
   hasta el follow-up de despliegue. ¿Conforme?

Dependencia de secuencia: si apruebas, conviene implementar SPEC-008 **antes o
junto** al retoque del adaptador de ingesta, porque el cambio de contrato de
`getQuotes` (mic_code) afecta a SPEC-004 ya en `hecho`.
