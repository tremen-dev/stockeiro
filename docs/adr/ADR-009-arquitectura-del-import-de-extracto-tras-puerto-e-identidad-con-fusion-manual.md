---
id: ADR-009
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
---
# ADR-009: Arquitectura del import de extracto tras puerto e identidad con fusion manual

- Deciders: propone sdd-arquitecto (con dictamen de dominio sdd-mercados sobre el mapeo mercado→MIC y la resolución por nombre, pendiente de verificar contra el proveedor); aprueba el humano (gate). EPIC-002.
- Specs relacionadas: origina **SPEC-011** (Lectura del extracto de ING) y **SPEC-012** (Resolución de identidad e importación asistida). Reutiliza el puerto `SymbolSearchProvider` y la identidad `(ticker, mic_code)` de **ADR-007**; alimenta el ledger de **ADR-003** (vía SPEC-013). Consume el patrón de puerto de **ADR-002**.

## Contexto
EPIC-002 debe llevar un extracto de bróker a transacciones de la cartera del
usuario. El material real (`examples/historico.xls`, export de ING "Movimientos de
la Cartera", JasperReports) fija los hechos duros:

- **250 operaciones** COMPRA/VENTA, **52 valores**, **7 mercados** (M.CONTINUO,
  NASDAQ, NYSE, XETRA, ESTOCOLMO, BOLSA PARIS, BOLSA AMSTERDAM), 2018–2026.
- Encoding **cp1252/latin-1**; cabecera de metadatos (cuenta, titular, fecha).
- **No hay ISIN ni ticker**: cada operación trae solo un **nombre visible** +
  **etiqueta de mercado** propia de ING.
- Los nombres **colisionan por eventos corporativos**: `PHARMAMAR`/`PHARMA MAR`
  (contrasplit 12:1 + renombrado), `D.FELGUERA`/`DURO FELGUERA`. El nombre NO es
  identidad estable.

Decisiones de producto ya cerradas en el gate de EPIC-002: import **fiel + fusión
manual**; **no** re-escalar cantidades/precios por splits; identidad resuelta con
**confirmación del usuario** en los casos ambiguos. El proyecto ya dispone de
`SymbolSearchProvider` (ADR-007, resuelve nombre → `(ticker, micCode, currency)`
tras puerto, con adaptador Twelve Data `/symbol_search` y fake) y de la identidad
de símbolo `(ticker, mic_code)`. No hay que inventar mecanismo de búsqueda: hay que
**conectar** el extracto a lo existente.

## Decisión
1. **Lectura tras puerto `BrokerStatementReader`** (patrón de integración de
   ADR-002/006/007): `read(file) -> ExtractoParseado` con los metadatos de cabecera
   y una lista de **operaciones crudas** `{occurredOn, side (buy|sell), nombreBroker,
   etiquetaMercado, cantidad, precioOrigen, importeEur}`. Primer y único adaptador
   de v1: **ING `.xls` "Movimientos de la Cartera"**. Solo se parsean filas
   **COMPRA/VENTA**; otros tipos de fila se ignoran de forma explícita (no hay
   dividendos/traspasos en este export). El dominio no depende del formato ING.
2. **Alcance v1 = ING**. Otros brókers y formatos (CSV, PDF, API) son **futuros
   adaptadores del mismo puerto**, no una reescritura (EPIC-002 "Fuera").
3. **La identidad se resuelve reutilizando `SymbolSearchProvider`** (ADR-007), sin
   proveedor nuevo: por cada `(nombreBroker, etiquetaMercado)` **distinto**, se busca
   por nombre y se **filtran** los candidatos por el **MIC** derivado de la etiqueta
   de mercado. Tabla estática de mapeo (a **verificar** contra el `mic_code` que
   devuelve el proveedor — dictamen sdd-mercados):
   `M.CONTINUO→XMAD`, `NASDAQ→XNAS`, `NYSE→XNYS`, `XETRA→XETR`, `ESTOCOLMO→XSTO`,
   `BOLSA PARIS→XPAR`, `BOLSA AMSTERDAM→XAMS`.
4. **La resolución es una sugerencia; la confirma el usuario** antes de cualquier
   escritura (CE-3 de EPIC-002). Un único candidato inequívoco puede pre-seleccionarse;
   **ambiguo (>1 candidato) o sin coincidencia** queda **SIN RESOLVER** y se muestra
   para que el usuario actúe. **No se escribe ninguna transacción de un valor sin
   resolver.**
5. **Eventos corporativos / renombrados, fiel**: por defecto cada nombre-bróker
   distinto se resuelve **de forma independiente**. El usuario puede **fusionar**
   explícitamente dos grupos de nombre sobre el **mismo símbolo** cuando reconoce que
   son el mismo emisor. El import **nunca re-escala** cantidades ni precios por
   split/contrasplit: las transacciones conservan los valores del extracto. La
   reconciliación de un split, si el usuario fusiona tramos de antes y después del
   evento, se hace **a mano** con el evento `split` del ledger (ADR-003, RN-07), que
   ya existe; el import puede **avisar** de una discontinuidad de escala pero no la
   corrige.
6. **Las resoluciones confirmadas se recuerdan** (mapeo `(userId, nombreBroker,
   etiquetaMercado) → symbolId`) para que un re-import no vuelva a preguntar y para
   estabilizar la clave de idempotencia (ADR-010). El detalle de persistencia lo fija
   SPEC-012.

## Consecuencias
### Positivas
- Reutiliza búsqueda, identidad `(ticker, mic)` y ledger ya construidos: **cero
  proveedores y credenciales nuevos**; coste marginal.
- Honesto con el dominio: el usuario es dueño de la identidad ambigua; nada se
  asigna a un símbolo equivocado sin su confirmación (CE-3).
- Símbolo con **mercado y divisa reales** desde el origen (ADR-007), no EUR asumido.
- Otros brókers/formatos entran como adaptadores del puerto sin tocar dominio.

### Negativas / follow-ups
- **Fusión de tramos pre/post-evento sin `split` manual** deja una **cantidad viva
  incoherente** (mezcla escalas 12:1) hasta que el usuario registre el `split`
  (ADR-003). El import lo **advierte**, no lo arregla: es consecuencia directa de
  "no re-escalar" (decisión de producto).
- **Valores no cotizados por Twelve Data** (nombres pequeños/ilíquidos o deslistados
  del fichero real: `ABENGOA.B`, `D.FELGUERA`, `INTERCITY`…) pueden ser
  **irresolubles** → quedan pendientes y no se importan hasta resolverse a mano.
  Riesgo real dado el histórico largo del ejemplo.
- **Créditos de `/symbol_search`**: ~1 por valor distinto (~52 en el ejemplo),
  acotado y cacheable por el mapeo recordado (punto 6); comparte free tier con el
  refresco (ADR-002/ADR-007).
- **La tabla mercado→MIC** debe verificarse contra los `mic_code` reales del
  proveedor y puede variar entre versiones/idiomas del informe ING (riesgo R-3).

## Alternativas consideradas
- **Confiar en el nombre del bróker como identidad** (sin resolver): colisiona por
  eventos corporativos, no trae ticker/ISIN y no fija mercado/divisa; rechazada por
  falsear P/L y divisa (RN-06, RN-09).
- **Proveedor/lookup dedicado por ISIN**: el export **no trae ISIN**; añadir un
  proveedor no se justifica cuando `SymbolSearchProvider` ya resuelve por
  nombre+mercado. Opción futura si el emparejamiento por nombre resulta débil.
- **Fusión automática de eventos corporativos + re-escala de splits**: rechazada en
  el gate de producto; exige una fuente fiable de eventos (EPIC-002 "Fuera").
- **Parsear ING con código inline (sin puerto)**: rechazada por romper el patrón de
  puerto establecido y bloquear otros brókers.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
