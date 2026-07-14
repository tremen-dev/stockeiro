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
| CA-1 (etiqueta→MIC/bolsa) | `src/lib/import/market-map.ts` (`filterByMarket`); `identity.ts` (`resolverValor`) | `tests/import-identity.test.ts` › CA-1 | verde: solo XNGS ofrecido para NASDAQ (XMAD excluido); sub-MIC aceptado | ✅ |
| CA-2 (búsqueda por nombre vía puerto) | `identity.ts` (`resolverValor`→`searchSymbols`) | `tests/import-identity.test.ts` › CA-2 | verde: `provider.calls` contiene 'INDITEX'; candidato ITX/XMAD/EUR | ✅ |
| CA-3 (ambiguo/sin match → sin resolver) | `identity.ts` (`resolverValor`, estados ambiguous/unmatched) | `tests/import-identity.test.ts` › CA-3 (2 casos) | verde: ambos SIN `symbolId` (no auto-asigna, CE-3) | ✅ |
| CA-4 (selección fija identidad) | `identity.ts` (`confirmarSeleccion`→`getOrCreateSymbol`+alias) | `tests/import-identity.test.ts` › CA-4 | verde: símbolo ITX/XMAD/EUR creado + alias persistido | ✅ |
| CA-5 (no resuelto no pasa a registro) | `identity.ts` (`particionar`) | `tests/import-identity.test.ts` › CA-5 | verde: resueltas=[INDITEX], pendientes=[NOEXISTE] | ✅ |
| CA-6 (recordado, sin re-preguntar) | `identity.ts` (`getAlias`→`remembered`, sin llamar proveedor) | `tests/import-identity.test.ts` › CA-6 | verde: `remembered` con symbolId y `provider.calls` VACÍO | ✅ |
| CA-7 (fusión manual, sin re-escalar) | `identity.ts` (`confirmarSeleccion`/`fusionarValor`, `fused`) | `tests/import-identity.test.ts` › CA-7 (2 casos) | verde: mismo symbolId + `fused=true`; el layer no toca cantidades (no re-escala por construcción) | ✅ |
| CA-8 (independiente por defecto) | `identity.ts` (`distinctValores`/`resolverValores`) | `tests/import-identity.test.ts` › CA-8 | verde: 2 valores resueltos por separado, sin fusión auto | ✅ |
| CA-9 (solo acciones, D-7) | `identity.ts` (vía `searchSymbols` filtro stock) | `tests/import-identity.test.ts` › CA-9 | verde: ETF descartado, solo la acción ofrecida | ✅ |
| CA-10 (aislamiento/acceso) | `identity.ts` (`runResolucion`+`requireSession`; alias por userId) | `tests/import-identity.test.ts` › CA-10 (2 casos) | verde: sin sesión→unauthorized (proveedor no llamado); alias de A no visto por B | ✅ |
| CA-11 (resiliencia del proveedor) | `identity.ts` (`resolverValor` try/catch por valor) | `tests/import-identity.test.ts` › CA-11 | verde: BADCO→error, GOODCO→suggested (no aborta) | ✅ |

## Veredicto del verificador
**GREEN** — 2026-07-15 (sdd-verificador).

Gates automáticos (independientes): `tsc --noEmit` limpio; `eslint` sobre `src/lib/import`,
tests, `schema.ts`, `test-db.ts` sin errores; suite completa **132/132** (23 ficheros),
sin regresiones. Los 14 tests de SPEC-012 en verde.

CA-1..CA-11 todos **✅** con test no vacío. Auditoría adversarial superada:
- **Alcance estricto**: `identity.ts`/`market-map.ts` NO importan `transactions` ni el
  ledger (grep limpio); crean el símbolo compartido y el alias, no escriben cartera
  (eso es SPEC-013). No re-escalan splits.
- **CE-3 (no auto-asignar)**: en `ambiguous`/`unmatched` no hay `symbolId`; incluso un
  único candidato queda `suggested` (no se commitea sin confirmación).
- **CA-6 recordado**: `provider.calls` VACÍO tras recordar → no re-consulta.
- **CA-7 fusión**: dos nombres → mismo `symbolId` + aviso `fused=true`; el layer no
  tiene acceso a cantidades, así que "no re-escalar" se cumple por construcción.
- **CA-10 aislamiento/acceso**: alias por `userId` (A no lo ve B); sin sesión rechaza.
- **CA-11 resiliencia**: el fallo de un valor no aborta los demás.

**F-SPEC-012-1** (aceptado, no bloqueante): el mapeo `MARKET_MAP` (etiqueta→MIC/bolsa) es
**provisional** — modelado por familia para tolerar sub-MICs (NASDAQ→XNGS…, verificado en
CA-1), pero los valores exactos de Twelve Data deben confirmarse contra la API real
(dictamen sdd-mercados) en el follow-up de despliegue. En tests se usa el fake. No afecta
al veredicto: la lógica de filtrado y su tolerancia a sub-MICs están demostradas.

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
