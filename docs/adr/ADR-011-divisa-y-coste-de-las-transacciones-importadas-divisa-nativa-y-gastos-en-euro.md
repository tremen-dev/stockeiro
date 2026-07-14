---
id: ADR-011
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
---
# ADR-011: Divisa y coste de las transacciones importadas: divisa nativa y gastos en euro

- Deciders: propone sdd-arquitecto (con dictamen de dominio sdd-cartera sobre coste base/gastos y sdd-mercados sobre divisa/precio nativo, pendiente de verificar los MIC contra el proveedor); el humano (Alberto Fojo) **eligió en el gate (2026-07-15) la Decisión recomendada** — divisa nativa + `gastos=0` en no-euro (cobertura 250/250), descartando la Alternativa B. Walk-back parcial y consciente de "EUR manda" para mercados no-euro. EPIC-002.
- Specs relacionadas: **SPEC-013** (Registro idempotente en la cartera). Constriñe cómo se rellenan `price`/`gastos`/divisa del ledger de **ADR-003**; interactúa con la identidad/divisa de **ADR-007** y con la base de precio de **ADR-004/RN-12**.

## Contexto
Decisión de producto (2) del gate de EPIC-002: **"EUR manda"** — el `IMPORTE TOTAL
(€)` neto del extracto es la fuente de verdad del coste; el precio en divisa origen
es informativo. Pero choca con reglas **locked**:

- **RN-09**: los importes de una posición están en **una única divisa = la del
  símbolo**; **no hay conversión automática de divisa** (multi-moneda avanzada,
  FOUNDATION "Fuera").
- **RN-06/RN-12 + ADR-007/ADR-004**: el P/L **actual** = `(precioMercado − precioMedio)
  × cantidadViva`, y `precioMercado` es el **último cierre NO ajustado** que `/eod`
  devuelve **en la divisa nativa del mercado** (USD para NASDAQ/NYSE, SEK para
  Estocolmo, EUR para BME/XETRA/Euronext).

Datos del extracto: `PRECIO` en divisa **origen**; `IMPORTE (€)` en **EUR**, ya neto
(comisiones dentro) y, en mercados no-euro, **ya convertido** por FX. **Comisión y
FX no son separables** con estas columnas. Del fichero real: EUR = M.CONTINUO,
XETRA, BOLSA PARIS, BOLSA AMSTERDAM (~**204/250** ops son M.CONTINUO); no-euro =
NASDAQ/NYSE (USD) y ESTOCOLMO (SEK), ~**46/250**.

**La tensión:** guardar el coste en EUR ("EUR manda") para un símbolo cuya cotización
llega en divisa **nativa** produciría un P/L actual sin sentido (restar EUR menos
USD). Mantener la coherencia con lo ya construido obliga a decidir la divisa de
almacenamiento.

## Decisión
1. **Las transacciones importadas se guardan en la DIVISA NATIVA del símbolo**
   (RN-09, ADR-007), porque el P/L actual compara contra el cierre nativo de `/eod`
   (RN-06/RN-12). Es lo **coherente con el sistema existente**: las posiciones
   extranjeras ya operan en divisa nativa en SPEC-002/SPEC-004.
2. **Mercados en EUR** (divisa del símbolo = EUR: M.CONTINUO, XETRA, Euronext
   Paris/Ámsterdam):
   - `price` = **precio origen** (ya EUR).
   - `gastos` = `importeEur − (price × cantidad)` en COMPRA; `(price × cantidad) −
     importeEur` en VENTA (≥ 0).
   - **"EUR manda" se cumple exacto**: la transacción reproduce el importe del
     extracto; RN-04 (coste medio incl. gastos) satisfecho.
3. **Mercados no-euro** (divisa del símbolo = USD/SEK/…):
   - `price` = **precio origen** (nativo).
   - `gastos` **no es reconstruible en divisa nativa** desde el export (el importe
     está en EUR y mezcla comisión + FX). **v1 fija `gastos = 0`** para estas
     transacciones; el `importeEur` se conserva como **metadato informativo** (no
     entra en el coste base).
   - Consecuencia asumida: el coste base nativo **infravalora** ligeramente el coste
     real (omite comisión), y la caja EUR realmente pagada **no** se refleja en el P/L
     de la posición (que va, correctamente, en divisa nativa).
4. **El `importeEur` de toda operación se preserva como metadato** (auditoría,
   reconciliación, visualización), **nunca** mezclado en un P/L de divisa nativa.

## Punto de decisión para el gate humano
El punto 3 es un **walk-back parcial de "EUR manda"** para mercados no-euro (46/250
ops del ejemplo). Presento la alternativa por si prefieres no perder la comisión:

- **Alternativa B — importar en v1 solo operaciones de mercados en EUR.** Las
  operaciones no-euro se marcan como **"no soportadas en v1 / pendientes"** y no se
  escriben, evitando un coste base inexacto. Más honesto y **100% fiel** en lo que
  importa, a costa de **cobertura** (deja fuera 46/250). Coincide con que el 82% del
  fichero es M.CONTINUO (EUR).

Recomiendo la **Decisión (nativa + gastos=0 en no-euro)** por cobertura; la
**Alternativa B** si priorizas exactitud total sobre cobertura. **Necesita tu
ruling** y dictamen de sdd-cartera/sdd-mercados.

## Consecuencias
### Positivas
- Posiciones **coherentes** con el sistema existente y con el P/L actual; **no** se
  introduce modelado de FX (respeta RN-09 y "multi-moneda avanzada fuera").
- **Mercados en EUR completamente fieles** (mayoría del fichero): el importe se
  reproduce exacto.

### Negativas / follow-ups
- Posiciones extranjeras **pierden la comisión** en el coste base (Decisión) o **no
  se importan** (Alternativa B). "EUR manda" solo aplica pleno a mercados en EUR.
- El entrelazado FX+comisión es una **limitación del dato** del export, no una
  elección de modelo; separarlo exigiría una fuente de FX por fecha (fuera de v1).

## Alternativas consideradas
- **Guardar todo en EUR (posiciones extranjeras incluidas)**: exigiría convertir el
  precio nativo de `/eod` a EUR para el P/L actual = conversión de divisa, **prohibida
  por RN-09** y "multi-moneda avanzada fuera"; rechazada.
- **Derivar un FX implícito por fila y reconstruir el `gastos` nativo**: FX y comisión
  están entrelazados en una sola cifra EUR; cualquier separación es una conjetura;
  rechazada por **inventar datos** (regla del arquitecto: no inventar; citar o marcar
  hipótesis).
- **Rechazar siempre las operaciones extranjeras**: es la Alternativa B, ofrecida al
  gate, no impuesta.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
