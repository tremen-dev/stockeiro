---
id: SPEC-013
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-013 Registro idempotente en la cartera

## Resumen
- Fase: en-revision (implementación completa; pendiente de verificador)
- Rama: `ft/SPEC-013-registro-idempotente-en-la-cartera`
- Escribe las operaciones resueltas (SPEC-012) como transacciones `buy`/`sell` del
  ledger (ADR-003), idempotente por `importKey` (ADR-010) y con coste según ADR-011
  (EUR: gastos=|importe−price×qty|; no-euro: gastos=0, importeEur metadato).
  Previsualizar-y-confirmar; avisa de sobreventa (RN-08). No lee fichero ni resuelve.
- `transactions` gana `import_key` (único por usuario) + `importe_eur`
  (migración `drizzle/0003_import_idempotency.sql` + test-db). Lógica en
  `src/lib/import/register.ts` (reutiliza `computePosition` para sobreventa/P-L).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (mapeo a ledger buy/sell) | `src/lib/import/register.ts` (`confirmarImport`→insert) | `tests/import-register.test.ts` › CA-1 | | ❌ |
| CA-2 (coste EUR, importe cuadra) | `register.ts` (`camposCoste`, rama EUR) | `tests/import-register.test.ts` › CA-2 | | ❌ |
| CA-3 (nativa + gastos=0 no-euro) | `register.ts` (`camposCoste`, rama no-EUR) | `tests/import-register.test.ts` › CA-3 | | ❌ |
| CA-4 (idempotencia) | `register.ts` (`importKeyOf` + `onConflictDoNothing` + único (userId,importKey)) | `tests/import-register.test.ts` › CA-4 | | ❌ |
| CA-5 (export incremental) | `register.ts` (`clavesExistentes`→`aSaltar`) | `tests/import-register.test.ts` › CA-5 | | ❌ |
| CA-6 (idénticas mismo día / ordinal) | `register.ts` (`conClaves` ordinal intradía) | `tests/import-register.test.ts` › CA-6 | | ❌ |
| CA-7 (previsualizar-y-confirmar) | `register.ts` (`previsualizarImport` vs `confirmarImport`) | `tests/import-register.test.ts` › CA-7 | | ❌ |
| CA-8 (no sobreventa, avisa) | `register.ts` (`detectarSobreventa`) | `tests/import-register.test.ts` › CA-8 | | ❌ |
| CA-9 (aislamiento por usuario) | `register.ts` (filtro `userId` en lectura/escritura) | `tests/import-register.test.ts` › CA-9 | | ❌ |
| CA-10 (pendientes no se escriben) | `register.ts` (`pendientes` pasa, no se inserta) | `tests/import-register.test.ts` › CA-10 | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-013/. Informe HTML opcional: _qa/SPEC-013/informe.html -->

## Salvedades / follow-ups
- **Sobreventa (CA-8)**: las ventas que exceden la cantidad viva se **avisan y se
  omiten** (no se escriben) en vez de crear una posición imposible; su `importKey` no
  se persiste, así que al añadir la compra que falta y reimportar, la venta se crea
  (idempotencia intacta). Es el comportamiento acordado en el gate (previsualizar-y-avisar).
- **F-SPEC-013-1** (falso negativo de ADR-010, ya documentado en el ADR): dos
  operaciones legítimamente idénticas repartidas entre DOS exports distintos podrían
  colisionar (el ordinal se reinicia por fichero). Riesgo residual conocido; una
  reconciliación por conteo queda a futuro. Destino: EPIC-MEJORA.
- **UI del import**: el flujo subir→resolver→previsualizar→confirmar se prueba a nivel
  de servicio (sin UI). El cableado de UI de las tres specs (011/012/013) no está en
  el alcance de ningún CA; si se quiere, sería una spec de UI aparte.

## Cómo retomar (handoff)
Implementación de SPEC-013 **completa y en verde** (10 tests; suite 142/142; typecheck
y lint limpios). Cierra la cadena del import (SPEC-011 lee → SPEC-012 resuelve →
SPEC-013 registra). Ficheros:
- `src/db/schema.ts` — `transactions` gana `import_key` (único por usuario) + `importe_eur`.
- `drizzle/0003_import_idempotency.sql` — migración. `src/db/test-db.ts` — columnas+constraint.
- `src/lib/import/register.ts` — `previsualizarImport`, `confirmarImport`, clave
  derivada (`importKeyOf`), coste ADR-011 (`camposCoste`), sobreventa (`detectarSobreventa`).
- `tests/import-register.test.ts` — CA-1..CA-10.

Con esto EPIC-002 queda funcionalmente completa (falta solo el cableado de UI, opcional,
y los follow-ups de despliegue: TWELVE_DATA_API_KEY/CRON_SECRET ya existentes, verificar
el mapeo mercado→MIC real F-SPEC-012-1, y SheetJS desde CDN F-SPEC-011-1). Siguiente:
verificador (gate de SPEC-013).
