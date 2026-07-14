---
id: ADR-010
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
---
# ADR-010: Idempotencia del import por clave derivada de la operacion

- Deciders: propone sdd-arquitecto (con dictamen de dominio sdd-cartera sobre falsos positivos/negativos del emparejado); aprueba el humano (gate). EPIC-002.
- Specs relacionadas: **SPEC-013** (Registro idempotente en la cartera). Escribe sobre el ledger de **ADR-003**; depende de la identidad resuelta y recordada de **ADR-009**.

## Contexto
El re-import es el flujo esperado: el usuario exportará su extracto **más de una
vez** (histórico completo hoy, export más reciente que solapa periodos mañana). El
ledger es **inmutable y append-only** (ADR-003), así que no hay "actualizar": hay
que **reconocer** una operación ya importada para **no volver a insertarla**. Pero
el export de ING **no trae ningún identificador de operación** — solo fecha,
operación, valor, mercado, títulos, precio origen e importe EUR. Un import que
duplica operaciones corrompe el P/L y destruye la confianza en datos reales
(riesgo R-5 de EPIC-002). Decisión de producto ya cerrada: **idempotencia por clave
derivada** de la propia operación.

## Decisión
1. **Cada transacción importada lleva una `importKey` determinista** derivada de los
   campos estables de la operación:
   `(userId, symbolId, side, occurredOn (fecha), cantidad, precioOrigen, importeEur,
   ordinalIntradía)`.
   El **`ordinalIntradía`** es el índice (0,1,2…) de la operación entre las que
   coinciden en TODOS los campos anteriores dentro del **mismo extracto**, en el
   orden estable del fichero (fecha descendente). Distingue repeticiones legítimas
   idénticas el mismo día sin depender de un ID inexistente.
2. **`importKey` se persiste como columna nullable en `transaction`**: solo la
   llevan las filas importadas; el alta manual la deja `null`. Índice **único por
   `(userId, importKey)`**.
3. **Import idempotente por "saltar si existe"**: para cada operación parseada y
   **ya resuelta** (ADR-009), se computa `importKey`; si existe una transacción con
   `(userId, importKey)`, se **salta**; si no, se **inserta**. Re-importar el mismo
   fichero → **0 filas nuevas**. Un export más reciente que solape periodos →
   **solo** las operaciones genuinamente nuevas.
4. **La clave se computa DESPUÉS de resolver la identidad** (usa `symbolId`): una
   operación sin resolver nunca se clava ni se escribe; al resolverla y reimportar,
   se inserta **una** vez. La resolución **recordada** (ADR-009) garantiza que el
   `symbolId` sea estable entre imports (si no, la clave cambiaría y duplicaría).

## Consecuencias
### Positivas
- Re-import seguro y **export incremental** soportado sin depender de un ID del
  bróker.
- Clave sobre **campos tipados** del dato, no sobre texto presentado: resistente a
  reordenaciones de columnas.
- Idempotencia verificable con un test directo (importar dos veces = importar una).

### Negativas / follow-ups (riesgo R-2)
- **Falso negativo (operación perdida):** dos operaciones **legítimamente idénticas**
  el mismo día se distinguen por `ordinalIntradía` **mientras aparezcan en el mismo
  fichero** en orden estable. Riesgo residual: si esas dos idénticas se reparten
  entre **dos exports distintos**, el ordinal se reinicia por fichero y la segunda
  colisionaría con la primera → se descartaría. Documentado; una reconciliación por
  conteo queda a futuro.
- **Falso positivo (duplicado creado):** si ING cambia el **formato/redondeo** de un
  campo entre exports (p. ej. precisión del importe) o el `symbolId` resuelto cambia
  (el usuario re-resuelve distinto), la clave difiere y la operación se **reinserta**.
  Mitigación: clavar sobre los campos **parseados en crudo** (no sobre presentación
  re-derivable) y **recordar** la resolución (ADR-009) para fijar `symbolId`.
- **Cambiar la definición de la clave más adelante** invalida las claves previas →
  re-clave/migración puntual. Se acepta: la definición queda **congelada para v1** en
  este ADR (cambiarla exige un ADR que lo supersede).

## Alternativas consideradas
- **ID de operación del bróker**: no existe en el export; rechazada por indisponible.
- **Hash del texto completo de la fila**: frágil ante cambios de formato/encoding
  entre exports; rechazada frente a la clave por campos tipados.
- **Deduplicar por `(símbolo, fecha, cantidad)` a secas** (sin precio/importe/ordinal):
  colapsa repeticiones legítimas el mismo día y confunde compras/ventas parciales
  distintas; rechazada por **perder datos**.
- **Sin idempotencia (que el usuario evite reimportar)**: rechazada — el re-import es
  el flujo esperado; la duplicación silenciosa arruina el P/L (R-5).

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
