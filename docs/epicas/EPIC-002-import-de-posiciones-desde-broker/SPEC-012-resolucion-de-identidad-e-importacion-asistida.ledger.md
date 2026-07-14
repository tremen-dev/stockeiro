---
id: SPEC-012
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-012 Resolucion de identidad e importacion asistida

## Resumen
- Fase: en-revision (implementación completa; pendiente de verificador)
- Rama: `ft/SPEC-012-resolucion-de-identidad-e-importacion-asistida`
- Resuelve `nombreBroker`+`etiquetaMercado` → símbolo canónico `(ticker,micCode)`
  reutilizando `SymbolSearchProvider` (ADR-007); sin auto-asignar (CE-3), con mapeo
  recordado por usuario (`symbol_aliases`) y fusión manual (CA-7). Lectura SPEC-011
  como entrada; NO escribe transacciones (SPEC-013) ni re-escala splits.
- Entidad nueva `symbol_aliases` (schema + migración `drizzle/0002_symbol_aliases.sql`
  + tabla en `test-db.ts`). Lógica en `src/lib/import/identity.ts` y `market-map.ts`.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (etiqueta→MIC/bolsa) | `src/lib/import/market-map.ts` (`filterByMarket`); `identity.ts` (`resolverValor`) | `tests/import-identity.test.ts` › CA-1 | | ❌ |
| CA-2 (búsqueda por nombre vía puerto) | `identity.ts` (`resolverValor`→`searchSymbols`) | `tests/import-identity.test.ts` › CA-2 | | ❌ |
| CA-3 (ambiguo/sin match → sin resolver) | `identity.ts` (`resolverValor`, estados ambiguous/unmatched) | `tests/import-identity.test.ts` › CA-3 (2 casos) | | ❌ |
| CA-4 (selección fija identidad) | `identity.ts` (`confirmarSeleccion`→`getOrCreateSymbol`+alias) | `tests/import-identity.test.ts` › CA-4 | | ❌ |
| CA-5 (no resuelto no pasa a registro) | `identity.ts` (`particionar`) | `tests/import-identity.test.ts` › CA-5 | | ❌ |
| CA-6 (recordado, sin re-preguntar) | `identity.ts` (`getAlias`→`remembered`, sin llamar proveedor) | `tests/import-identity.test.ts` › CA-6 | | ❌ |
| CA-7 (fusión manual, sin re-escalar) | `identity.ts` (`confirmarSeleccion`/`fusionarValor`, `fused`) | `tests/import-identity.test.ts` › CA-7 (2 casos) | | ❌ |
| CA-8 (independiente por defecto) | `identity.ts` (`distinctValores`/`resolverValores`) | `tests/import-identity.test.ts` › CA-8 | | ❌ |
| CA-9 (solo acciones, D-7) | `identity.ts` (vía `searchSymbols` filtro stock) | `tests/import-identity.test.ts` › CA-9 | | ❌ |
| CA-10 (aislamiento/acceso) | `identity.ts` (`runResolucion`+`requireSession`; alias por userId) | `tests/import-identity.test.ts` › CA-10 (2 casos) | | ❌ |
| CA-11 (resiliencia del proveedor) | `identity.ts` (`resolverValor` try/catch por valor) | `tests/import-identity.test.ts` › CA-11 | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-012/. Informe HTML opcional: _qa/SPEC-012/informe.html -->

## Salvedades / follow-ups
- **F-SPEC-012-1** (mercado→MIC provisional): la tabla `MARKET_MAP` (`market-map.ts`)
  se ha diseñado por FAMILIA de MIC + nombre de bolsa para tolerar sub-MICs
  (NASDAQ→XNGS/XNMS/XNCM, no solo XNAS), pero los valores exactos (`mic_code`/`exchange`
  que devuelve Twelve Data) deben **verificarse contra la API real** (dictamen
  sdd-mercados). En tests se usa el fake. Destino: follow-up de despliegue de EPIC-002.
- **Nota (mercado desconocido)**: si la etiqueta no está en `MARKET_MAP`, el filtro es
  **permisivo** (no descarta candidatos) y la ambigüedad la resuelve el usuario; así no
  se pierde en silencio un mercado no mapeado. Las 7 etiquetas del extracto real están
  mapeadas.

## Cómo retomar (handoff)
Implementación de SPEC-012 **completa y en verde** (14 tests; suite 132/132; typecheck
y lint limpios). Ficheros:
- `src/db/schema.ts` — tabla `symbol_aliases` (única por (userId, brokerName, marketLabel)).
- `drizzle/0002_symbol_aliases.sql` — migración generada. `src/db/test-db.ts` — tabla de test.
- `src/lib/import/market-map.ts` — mapeo etiqueta→MIC/bolsa (`filterByMarket`).
- `src/lib/import/identity.ts` — resolución (`resolverValor(es)`), confirmación
  (`confirmarSeleccion`), fusión (`fusionarValor`), partición (`particionar`),
  acceso con sesión (`runResolucion`).
- `tests/import-identity.test.ts` — CA-1..CA-11.

Siguiente: **verificador** (gate de SPEC-012). Después, SPEC-013 consumirá la partición
(`resueltas` con `symbolId`) para escribir el ledger idempotente (ADR-010) con la divisa
de ADR-011. La confirmación de selección crea el símbolo compartido y recuerda el alias,
lo que estabiliza la clave de idempotencia. Alcance respetado: NO escribe transacciones,
NO re-escala splits.
