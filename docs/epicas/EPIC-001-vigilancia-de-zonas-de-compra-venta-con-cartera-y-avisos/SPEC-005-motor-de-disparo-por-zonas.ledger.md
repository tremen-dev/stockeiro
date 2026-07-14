---
id: SPEC-005
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-005 Motor de disparo por zonas

## Resumen
- Fase: implementación completa (CA-1..CA-10 con test), pendiente de verificación. Spec en `en-revision`.
- Rama: `ft/SPEC-005-motor-de-disparo-por-zonas`
- Gates locales del implementador: **11 tests nuevos verdes** (75/75 en la suite, sin
  regresiones), **9/9 e2e** (paridad del arnés `server.mjs` con la tabla nueva, sin
  repetir el RED-1 de SPEC-004), `eslint` 0 errores, `tsc --noEmit` 0, `next build` verde.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/triggers/service.ts` (`evaluateTriggers`, abre episodio buy) · `src/db/schema.ts` (`zone_triggers`) | `tests/triggers-service.test.ts` › "CA-1: disparo… zona de compra" | | 🚧 |
| CA-2 | `src/lib/triggers/service.ts` (zonaOf buy/sell independientes) | `tests/triggers-service.test.ts` › "CA-2: … zona de venta, independiente" | | 🚧 |
| CA-3 | `src/lib/triggers/service.ts` (episodio abierto → no-op; `openTriggersForUser`) | `tests/triggers-service.test.ts` › "CA-3: no re-disparo… permanencia observable" | | 🚧 |
| CA-4 | `src/lib/triggers/service.ts` (cierra al salir; re-abre al volver) | `tests/triggers-service.test.ts` › "CA-4: re-armado tras salir y volver" | | 🚧 |
| CA-5 | `src/lib/triggers/service.ts` (`entraEnZona` null/fuera → sin disparo) · `src/lib/watchlist/zones.ts` | `tests/triggers-service.test.ts` › "CA-5: fuera de zona o sin zona no dispara" | | 🚧 |
| CA-6 | `src/lib/watchlist/zones.ts` (`entraEnZona` inclusive, reusado) | `tests/triggers-service.test.ts` › "CA-6: límites inclusive y punto único" | | 🚧 |
| CA-7 | `src/lib/triggers/cycle.ts` (`runRefreshCycle`: refresh→evaluate; join interno con `quotes` salta sin-precio) · `src/app/api/cron/refresh/route.ts` | `tests/triggers-cycle.test.ts` › "CA-7: evaluación tras ingesta…" | | 🚧 |
| CA-8 | `src/lib/triggers/service.ts` (evalúa por watched_symbol de cada usuario; `getTriggerForOwner`) · `src/lib/data/ownership.ts` | `tests/triggers-service.test.ts` › "CA-8: aislamiento… símbolo compartido" | | 🚧 |
| CA-9 | `src/lib/triggers/service.ts` (persiste `asOf` de la cotización en el disparo) · `src/db/schema.ts` | `tests/triggers-service.test.ts` › "CA-9: el disparo lleva el asOf" | | 🚧 |
| CA-10 | `src/lib/triggers/service.ts` (`evaluateTriggers.opened` = entradas de ciclo; `openTriggersForUser` = permanencia; `listTriggersForUser`) | `tests/triggers-service.test.ts` (CA-1/CA-3) · `tests/triggers-cycle.test.ts` (opened del ciclo) | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-005/. Informe HTML opcional: _qa/SPEC-005/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-005-1, F-SPEC-005-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-005-1** (para la spec de Notificaciones, CE-2): el motor deja listas las dos
  consultas (`evaluateTriggers().opened` = entradas del ciclo; `openTriggersForUser` =
  permanencia). La spec de aviso las consume para emitir el aviso individual por entrada
  y el aviso agregado de permanencia (RN-13); aquí NO se envía nada hacia fuera.
- **F-SPEC-005-2** (retención): `zone_triggers` es un log que crece; purga/archivado de
  episodios cerrados antiguos queda a futuro (no afecta v1).
- **Zonas calientes** (roadmap, "Más adelante"): acción a un % de entrar en zona; idea
  registrada, no comprometida.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- **Hecho (implementador):** CA-1..CA-10 con test (verde), gates locales verdes. Spec a `en-revision`.
- **Módulos nuevos** (`src/lib/triggers/`): `service.ts` (`evaluateTriggers` edge-triggered +
  `openTriggersForUser`/`listTriggersForUser`/`getTriggerForOwner`), `cycle.ts`
  (`runRefreshCycle` = ingesta+evaluación; `runCronCycle` con auth `CRON_SECRET`).
- **Enganche:** `src/app/api/cron/refresh/route.ts` ahora ejecuta el ciclo completo
  (antes solo ingesta). `runCronRefresh` de SPEC-004 queda como primitivo (aún testeado).
- **Entidad:** tabla `zone_triggers` (`src/db/schema.ts` + `src/db/test-db.ts` +
  `tests/e2e/server.mjs`, los tres en paridad — lección del RED-1 de SPEC-004).
- **Sin UI:** spec de backend; la exposición al usuario es de la spec de notificación/UI.
- **Pendiente (verificador):** rellenar Verif./Estado. Opción de probe adversarial:
  secuencia dentro→dentro→fuera→dentro sobre un mismo par para confirmar 2 episodios y 0
  duplicados; y aislamiento por id entre usuarios con símbolo compartido (CA-8).
