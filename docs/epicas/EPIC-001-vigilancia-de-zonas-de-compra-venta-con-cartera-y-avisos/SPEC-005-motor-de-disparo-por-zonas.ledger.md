---
id: SPEC-005
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-005 Motor de disparo por zonas

## Resumen
- Fase: GREEN — los 10 CA verificados (unit + probe adversarial). Spec a `hecho`.
- Rama: `ft/SPEC-005-motor-de-disparo-por-zonas`
- Gates (verificador): **75/75 vitest**, **9/9 e2e**, `eslint` 0 errores, `tsc` 0,
  `next build` verde. Probe adversarial RN-13/CA-8 sin findings.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/triggers/service.ts` (`evaluateTriggers`, abre episodio buy) · `src/db/schema.ts` (`zone_triggers`) | `tests/triggers-service.test.ts` › "CA-1: disparo… zona de compra" | Unit (PGlite) verde: abre disparo buy con precio 22 y asOf; no vacío. | ✅ |
| CA-2 | `src/lib/triggers/service.ts` (zonaOf buy/sell independientes) | `tests/triggers-service.test.ts` › "CA-2: … zona de venta, independiente" | Unit verde: precio en zona de venta abre sell; la de compra no interfiere. | ✅ |
| CA-3 | `src/lib/triggers/service.ts` (episodio abierto → no-op; `openTriggersForUser`) | `tests/triggers-service.test.ts` › "CA-3: no re-disparo… permanencia observable" | Unit + **probe**: 2 ciclos dentro → 1 solo disparo, sigue "en zona"; reevaluar el mismo ciclo es idempotente. | ✅ |
| CA-4 | `src/lib/triggers/service.ts` (cierra al salir; re-abre al volver) | `tests/triggers-service.test.ts` › "CA-4: re-armado tras salir y volver" | Unit + **probe** (in→in→out→in→in→out): exactamente 2 episodios, re-armado correcto. | ✅ |
| CA-5 | `src/lib/triggers/service.ts` (`entraEnZona` null/fuera → sin disparo) · `src/lib/watchlist/zones.ts` | `tests/triggers-service.test.ts` › "CA-5: fuera de zona o sin zona no dispara" | Unit verde: sin zona y precio fuera → 0 disparos. | ✅ |
| CA-6 | `src/lib/watchlist/zones.ts` (`entraEnZona` inclusive, reusado) | `tests/triggers-service.test.ts` › "CA-6: límites inclusive y punto único" | Unit verde: extremo (25) y punto único (min=max=20) disparan; misma regla compra/venta. | ✅ |
| CA-7 | `src/lib/triggers/cycle.ts` (`runRefreshCycle`: refresh→evaluate; join interno con `quotes` salta sin-precio) · `src/app/api/cron/refresh/route.ts` | `tests/triggers-cycle.test.ts` › "CA-7: evaluación tras ingesta…" / "…exige CRON_SECRET" | Unit verde: la evaluación corre sobre las cotizaciones recién ingeridas; símbolo sin precio no se evalúa; sin secreto → 401 y 0 disparos. | ✅ |
| CA-8 | `src/lib/triggers/service.ts` (evalúa por watched_symbol de cada usuario; `getTriggerForOwner`) · `src/lib/data/ownership.ts` | `tests/triggers-service.test.ts` › "CA-8: aislamiento… símbolo compartido" | Unit + **probe**: símbolo compartido, cada usuario su episodio; cross-read por id → null en ambas direcciones. | ✅ |
| CA-9 | `src/lib/triggers/service.ts` (persiste `asOf` de la cotización en el disparo) · `src/db/schema.ts` | `tests/triggers-service.test.ts` › "CA-9: el disparo lleva el asOf" | Unit verde: el disparo persiste el asOf (2026-07-10) de la cotización. | ✅ |
| CA-10 | `src/lib/triggers/service.ts` (`evaluateTriggers.opened` = entradas de ciclo; `openTriggersForUser` = permanencia; `listTriggersForUser`) | `tests/triggers-service.test.ts` (CA-1/CA-3) · `tests/triggers-cycle.test.ts` (opened del ciclo) | Unit verde: `opened` (entradas de ciclo) y `openTriggersForUser` (permanencia) filtrados por userId, listos para CE-2. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-07-14.**

Los 10 CA quedan cerrados con Implementado + Test + Verif. en verde. Gates automáticos:
**75/75 vitest**, **9/9 e2e** (sin regresión; el arnés `server.mjs` crea `zone_triggers`
en paridad con `schema.ts`/`test-db.ts` — no se repitió el RED-1 de SPEC-004),
`eslint` 0 errores, `tsc --noEmit` 0, `next build` verde. Cada CA está demostrado por
tests NO vacíos contra Postgres real (PGlite).

Un **probe adversarial** (efímero, ejecutado y retirado) reforzó el invariante clave
RN-13: la secuencia `dentro→dentro→fuera→dentro→dentro→fuera` produce EXACTAMENTE 2
episodios sin duplicados; reevaluar el mismo ciclo es idempotente; zonas de compra y
venta solapadas abren/cierran episodios independientes; y con símbolo compartido cada
usuario obtiene su propio disparo con lectura cruzada por id siempre `null` (CA-8/RN-01).
Sin findings. Historial: en-revisión → GREEN 2026-07-14 (a la primera; lección del RED-1
de SPEC-004 aplicada: paridad de los tres arneses de esquema).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-005/. Informe HTML opcional: _qa/SPEC-005/informe.html -->
n-a — SPEC-005 es de backend (detección y registro de disparos); no introduce UI. La
exposición al usuario es de la spec de notificación/UI (CE-2). Evidencia = tests contra
Postgres real + probe adversarial (arriba).

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
