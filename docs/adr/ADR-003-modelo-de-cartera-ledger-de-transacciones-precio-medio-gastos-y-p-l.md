---
id: ADR-003
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-13, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-13, por: humano}
---
# ADR-003: Modelo de cartera: ledger de transacciones, precio medio, gastos y P/L

- Deciders: propone sdd-arquitecto (con dictamen de dominio sdd-cartera); aprobado por el humano (gate) el 2026-07-13.
- Specs relacionadas: SPEC-002 (Cartera y P/L). Consume el patrón de ADR-001 (Drizzle/Neon, aislamiento por userId) y ADR-002 (símbolo compartido).

## Contexto
CE-3 exige mostrar por posición y agregado: precio de compra, cantidad, precio de
venta y **P/L actual y realizado**. El dominio (sdd-cartera, `docs/fundacion/`)
fija: precio medio ponderado, ventas parciales, gastos, splits/dividendos y
divisa consistente; y separar SIEMPRE actual de realizado (D-6, RN-04..RN-09).

Decisiones de alcance ya tomadas con el humano para v1: modelar la cartera como
**ledger de transacciones**; unificar costes en un único concepto **`gastos`**
(broker, impuestos de compra, cambio de divisa; sin separar); incluir varias
compras, ventas parciales, gastos, splits y dividendos; y calcular el **P/L
actual como función que recibe un precio** (la fuente real —cotización— llega con
la spec de Ingesta; hasta entonces la UI muestra "—").

## Decisión
1. **Ledger de transacciones** (`transaction`): la posición y el P/L son
   DERIVADOS de una secuencia inmutable de eventos, no de una fila mutable.
   Tipos de evento: `buy`, `sell`, `split`, `dividend`. Cada evento tiene
   `userId`, `symbolId`, `type`, `occurredOn` (fecha), y campos según tipo:
   - buy/sell: `quantity`, `price`, `gastos`;
   - split: `ratio`;
   - dividend: `amount` (importe total del dividendo cobrado).
2. **Símbolo compartido** (`symbol`): entidad global (ticker único + divisa),
   NO por usuario, sembrando el registro compartido de ADR-002. Las transacciones
   referencian `symbolId`. Es la semilla; watchlist/ingesta lo extienden.
3. **Posición derivada** (no persistida como verdad): por (userId, symbolId) se
   deriva cantidad viva, coste base (precio medio ponderado incluyendo gastos de
   compra, RN-04) y estado abierta/cerrada.
4. **P/L**:
   - **Realizado** (RN-05): por cada `sell`, `(price·qty − gastos) − avgCost·qty`;
     los `dividend` suman como ingreso. Se acumula por posición.
   - **Actual** (RN-06): función pura `(marketPrice − avgCost) · cantidadViva`;
     `marketPrice` es un parámetro. Sin precio → sin dato; NUNCA se mezcla con el
     realizado (D-6).
   - **Split** (RN-07): ajusta cantidad viva ×ratio y precio medio ÷ratio.
5. **Aislamiento** (RN-01): toda transacción lleva `userId`; el acceso reutiliza
   el patrón de SPEC-001 (`ownership.ts`, filtrar por sesión).
6. **Divisa única por posición** (RN-09): importes en la divisa del símbolo; sin
   conversión automática (el coste de cambio va en `gastos`).
7. **Persistencia**: Drizzle sobre Postgres (ADR-001); `numeric` para importes
   monetarios (no float) para no perder precisión en el redondeo.

## Consecuencias
### Positivas
- El ledger da precio medio, ventas parciales y eventos corporativos sin reescritura.
- Auditable e inmutable: el histórico de operaciones es la fuente; el P/L se recalcula.
- P/L actual desacoplado de la ingesta: la lógica se prueba hoy inyectando precio.
- Símbolo compartido coherente con ADR-002 desde el primer uso.

### Negativas / follow-ups
- Derivar la posición en cada consulta tiene coste; si molesta, se cachea/materializa
  más adelante (optimización, no ahora).
- `gastos` unificado pierde el desglose (broker vs impuestos vs FX): aceptado para v1.
- Splits/dividendos se registran MANUALMENTE en v1; su detección automática depende
  de datos de mercado (sdd-mercados/ingesta) y queda fuera.

## Alternativas consideradas
- **Posición "snapshot" mutable** (precio de compra + cantidad + venta): más simple
  pero no modela varias compras ni ventas parciales sin perder el coste base;
  rechazada por reescritura probable (decisión del humano).
- **Separar gastos por tipo** (broker/impuestos/FX): más informativo pero más
  complejo; el humano pidió un único `gastos` para v1. Reevaluable a futuro.
- **Persistir la posición como verdad** (además del ledger): duplica estado y abre
  la puerta a incoherencias; se prefiere derivar. Materializar es optimización futura.
- **FIFO/LIFO para coste base**: el dominio (sdd-cartera) fija **precio medio
  ponderado**; FIFO/LIFO fuera.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
