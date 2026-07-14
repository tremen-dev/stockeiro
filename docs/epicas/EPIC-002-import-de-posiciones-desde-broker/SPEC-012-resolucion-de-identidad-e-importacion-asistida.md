---
id: SPEC-012
tipo: spec
epica: EPIC-002
estado: en-revision
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-07-14, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-07-14, por: sdd-implementador}
---
# SPEC-012 — Resolucion de identidad e importacion asistida

## Problema
Las operaciones leídas (SPEC-011) traen **nombre de bróker + etiqueta de mercado**,
**sin ticker ni ISIN**. Para registrar la cartera hay que resolver cada valor a un
**símbolo canónico** `(ticker, mic_code)` (ADR-007) — si no, `/eod` no cotiza y el
P/L queda en "—" (RN-06). Y los nombres **colisionan por eventos corporativos**
(`PHARMAMAR`/`PHARMA MAR`, contrasplit 12:1 + renombrado; `D.FELGUERA`/`DURO
FELGUERA`): el nombre no es identidad. Decisión de producto (CE-3): **fiel + fusión
manual** — resolver con **confirmación del usuario** en los ambiguos, sin asignar a
un símbolo equivocado y **sin re-escalar** por splits.

Esta spec entrega la **resolución de identidad asistida**: por cada `(nombreBroker,
etiquetaMercado)` distinto, busca candidatos reutilizando `SymbolSearchProvider`
(SPEC-008/ADR-007) filtrados por el MIC del mercado, deja que el usuario **elija /
fusione / separe**, **recuerda** su decisión y marca lo **irresoluble** como
pendiente. Implementa **ADR-009**. No escribe transacciones (SPEC-013).

## Usuarios / roles afectados
- **Usuario final**: revisa la correspondencia valor→símbolo, elige el candidato
  correcto cuando hay duda, fusiona dos nombres que son el mismo emisor y ve qué
  valores no se han podido resolver. Todo bajo su sesión (RN-01/RN-03).
- **Sistema**: consulta el puerto de búsqueda y persiste el **mapeo recordado** para
  no volver a preguntar en re-imports (base de la idempotencia, ADR-010).

## Criterios de aceptación
Cada CA es verificable con un test. La búsqueda usa el **fake** tras
`SymbolSearchProvider` (ADR-007); Twelve Data real no se llama en tests.

- **CA-1 (Mapeo etiqueta de mercado → MIC).**
  Dada una operación con `etiquetaMercado` (p. ej. `M.CONTINUO`, `NASDAQ`),
  cuando se resuelve,
  entonces la búsqueda de candidatos se **filtra por el MIC** correspondiente
  (`XMAD`, `XNAS`, …, según la tabla de ADR-009); un candidato de otro mercado no se
  ofrece.
- **CA-2 (Resolución por nombre vía puerto).**
  Dado `(nombreBroker="INDITEX", M.CONTINUO)`,
  cuando se resuelve,
  entonces se consulta `SymbolSearchProvider.search` y se ofrece el candidato
  `(ITX, XMAD, EUR)` con su `name`/`exchange`/`currency` (a través del puerto, no
  del proveedor real).
- **CA-3 (Ambiguo o sin coincidencia → sin resolver, sin auto-asignar).**
  Dado un valor con **más de un** candidato válido, o con **ninguno**,
  cuando se resuelve,
  entonces queda **SIN RESOLVER**: se pide al usuario que elija (o que lo deje
  pendiente) y **no** se asigna ningún símbolo automáticamente (CE-3).
- **CA-4 (Selección del usuario fija la identidad).**
  Dado que el usuario elige un candidato concreto para un valor,
  cuando confirma,
  entonces ese `(nombreBroker, etiquetaMercado)` queda ligado a
  `(ticker, micCode, currency)` del candidato — no a un valor tecleado ni a EUR fijo.
- **CA-5 (Lo no resuelto no pasa a registro).**
  Dado un valor que sigue sin resolver,
  cuando se prepara el import,
  entonces sus operaciones **no** se envían al registro (SPEC-013): se listan como
  **pendientes** para que el usuario actúe, sin bloquear las demás.
- **CA-6 (Resolución recordada, sin re-preguntar).**
  Dado que el usuario ya confirmó `(nombreBroker, etiquetaMercado) → symbolId`,
  cuando vuelve a importar un extracto con ese mismo valor,
  entonces se **reutiliza** el mapeo y no se le vuelve a preguntar (estabiliza la
  clave de idempotencia, ADR-010).
- **CA-7 (Fusión manual de eventos corporativos, sin re-escalar).**
  Dados dos nombres distintos que el usuario reconoce como el **mismo emisor**
  (p. ej. `PHARMAMAR` y `PHARMA MAR`),
  cuando el usuario los **fusiona** sobre el mismo símbolo,
  entonces ambos grupos se resuelven a ese `symbolId`, las **cantidades y precios se
  conservan tal cual** (no se re-escala por el contrasplit) y se **advierte** de que,
  si hubo split, debe reconciliarse a mano con el evento `split` del ledger
  (ADR-003/RN-07).
- **CA-8 (Independiente por defecto).**
  Dados dos nombres distintos sin acción del usuario,
  cuando se resuelven,
  entonces se tratan de forma **independiente**; la fusión es una acción **explícita**,
  nunca automática.
- **CA-9 (Solo acciones, D-7).**
  Dado que el proveedor devuelve acciones y no-acciones,
  cuando se listan candidatos,
  entonces solo se ofrecen **acciones** (hereda el filtro de `SymbolSearchProvider`,
  SPEC-008); ETFs/cripto/derivados no.
- **CA-10 (Aislamiento y acceso, RN-01/RN-03).**
  Dada la resolución,
  cuando la invoca un usuario sin sesión válida,
  entonces se rechaza; y el mapeo recordado es **por usuario**, sin cruzarse con otros.
- **CA-11 (Resiliencia del proveedor).**
  Dado que la búsqueda falla para un valor,
  cuando se resuelve el extracto,
  entonces ese valor queda **pendiente** y **no** aborta la resolución de los demás.

## Entidades y reglas afectadas
- **Mapeo recordado `symbolAlias`** (nuevo): `(userId, nombreBroker, etiquetaMercado)
  → symbolId`, con aislamiento por usuario (RN-01). Fuente de la estabilidad de la
  clave de idempotencia (ADR-010).
- **`symbols`** (compartida, `(ticker, micCode)`, ADR-002/ADR-007): el import
  referencia/crea símbolos vía la selección, como SPEC-008.
- **Puerto `SymbolSearchProvider`** (ADR-007, SPEC-008): se **reutiliza**; no se crea
  proveedor nuevo. Tabla `etiquetaMercado → MIC` en ADR-009.
- Reglas: **RN-01/RN-03** (aislamiento/acceso), **RN-09** (la selección fija
  mercado/divisa), **D-7** (solo acciones), **RN-07** (el split se reconcilia a mano).
  Decisiones: **ADR-009** (identidad/fusión), **ADR-007** (puerto/identidad).
  Términos: `docs/fundacion/dominio.md` (símbolo/ticker, split).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Escribir las transacciones** y la idempotencia efectiva: SPEC-013.
- **Re-escalar cantidades/precios por split** o **fusión automática** de eventos
  corporativos: ADR-009 (fuera); el usuario decide y reconcilia el split a mano.
- **Lookup por ISIN o proveedor dedicado de identidad**: el export no trae ISIN;
  ADR-009 lo deja como opción futura.
- **La lectura del fichero**: SPEC-011.

## Notas para el gate humano
- **Tabla `mercado ING → MIC`** (ADR-009) **a verificar** contra los `mic_code` que
  devuelve realmente Twelve Data `/symbol_search` (dictamen sdd-mercados). Riesgo si
  ING cambia etiquetas entre versiones del informe.
- **Valores irresolubles reales**: el histórico largo trae nombres deslistados o
  ilíquidos (`ABENGOA.B`, `D.FELGUERA`, `INTERCITY`) que el proveedor puede no
  cotizar → quedarán **pendientes**. ¿Conforme con que v1 los deje fuera hasta
  resolución manual?
- **UX de fusión**: la decisión de fusionar dos nombres es del usuario; la app solo
  la facilita y **avisa** del posible split, sin tocar cantidades (coherente con tu
  decisión "fiel").
