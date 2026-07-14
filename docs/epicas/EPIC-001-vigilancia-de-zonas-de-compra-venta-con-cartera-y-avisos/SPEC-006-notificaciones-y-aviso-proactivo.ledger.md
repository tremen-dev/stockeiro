---
id: SPEC-006
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-006 Notificaciones y aviso proactivo

## Resumen
- Fase: implementación completa (CA-1..CA-9 con test), pendiente de verificación. Spec en `en-revision`.
- Rama: `ft/SPEC-006-notificaciones-y-aviso-proactivo`
- Gates locales del implementador: **10 tests nuevos verdes** (85/85 en la suite, sin
  regresiones), **9/9 e2e** (paridad del arnés `server.mjs` con la tabla `notifications`),
  `eslint` 0 errores, `tsc --noEmit` 0, `next build` verde.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/notifications/service.ts` (`notifyCycle`, aviso de entrada) · `src/db/schema.ts` (`notifications`) | `tests/notifications-service.test.ts` › "CA-1: aviso de entrada…" | | 🚧 |
| CA-2 | `src/lib/notifications/service.ts` (chequeo previo por `zoneTriggerId` + unique) | `tests/notifications-service.test.ts` › "CA-2: idempotencia…" | | 🚧 |
| CA-3 | `src/lib/notifications/service.ts` (agrupa por usuario → 1 digest que lista todo) | `tests/notifications-service.test.ts` › "CA-3: aviso agregado…" | | 🚧 |
| CA-4 | `src/lib/notifications/service.ts` (`cycleRef`, unique (userId,cycleRef)) | `tests/notifications-service.test.ts` › "CA-4: se repite por ciclo…" | | 🚧 |
| CA-5 | `src/lib/notifications/service.ts` (`listNotificationsForUser`, asOf+status) | `tests/notifications-service.test.ts` › "CA-5: registro consultable…" | | 🚧 |
| CA-6 | `src/lib/notifications/service.ts` (filtrado userId; `getNotificationForOwner`) · `src/lib/data/ownership.ts` | `tests/notifications-service.test.ts` › "CA-6: aislamiento…" | | 🚧 |
| CA-7 | `src/lib/notifications/service.ts` (`deliver` no lanza → status failed, persiste igual) · `sender.ts`/`fake-sender.ts` | `tests/notifications-service.test.ts` › "CA-7: fallback in-app…" | | 🚧 |
| CA-8 | `src/lib/triggers/cycle.ts` (`runCronCycle` notifica tras evaluar, mismo `CRON_SECRET`) · `src/app/api/cron/refresh/route.ts` | `tests/notifications-cycle.test.ts` › "CA-8: …ciclo protegido" | | 🚧 |
| CA-9 | `src/lib/notifications/service.ts` (1 entry por episodio abierto, incluso `failed`) | `tests/notifications-service.test.ts` › "CA-9: ningún disparo sin aviso" | | 🚧 |

Puerto real sin cobertura por diseño: `src/lib/notifications/resend-sender.ts` (`ResendSender`,
Resend real) NO se ejerce en tests (se usa `FakeNotificationSender`); su validación contra la
API real es F-SPEC-006-1 (despliegue).

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-006/. Informe HTML opcional: _qa/SPEC-006/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-006-1, F-SPEC-006-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-006-1** (ops, para DESPLIEGUE): aprovisionar `RESEND_API_KEY` + dominio verificado
  (SPF/DKIM) y `RESEND_FROM` en Vercel. El adaptador real `ResendSender` no tiene cobertura
  automática por diseño (sender fake en tests). Se suma a F-SPEC-004-1 (env de despliegue).
- **F-SPEC-007** (UI, comprometida): bandeja de avisos rica (lista, leído/no-leído, badge de
  nav, filtros) + indicador "en zona" en /vigiladas **por color de fondo, NO badge** (decisión
  del humano). Esta spec deja el historial consultable (CA-5) pero sin pantalla.
- **F-SPEC-006-2** (futuro): preferencias de notificación (silenciar, canal/frecuencia por
  usuario) y reintentos/backoff del proveedor; retención del log `notifications`.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- **Hecho (implementador):** CA-1..CA-9 con test (verde), gates locales verdes. Spec a `en-revision`.
- **Módulos nuevos** (`src/lib/notifications/`): `sender.ts` (puerto), `fake-sender.ts` (tests),
  `resend-sender.ts` (adaptador real, NO en tests), `service.ts` (`notifyCycle` idempotente +
  `listNotificationsForUser`/`getNotificationForOwner`).
- **Enganche:** `src/lib/triggers/cycle.ts` (`runRefreshCycle`/`runCronCycle` con `sender`
  opcional) llama a `notifyCycle` tras evaluar disparos; la ruta `/api/cron/refresh` inyecta
  `ResendSender`. Los tests del motor (SPEC-005) siguen pasando sin sender (notificación omitida).
- **Entidad:** `notifications` (`schema.ts` + `test-db.ts` + `tests/e2e/server.mjs` en paridad).
  Idempotencia por UNIQUE (`zone_trigger_id`) y UNIQUE (`user_id`, `cycle_ref`).
- **Sin UI:** backend + email. El usuario ve avisos por email (tras F-SPEC-006-1) y el historial
  es consultable; la pantalla es F-SPEC-007.
- **Pendiente (verificador):** rellenar Verif./Estado. Probe sugerido: entrada→permanencia en
  ciclos consecutivos (1 entry, N digests) y re-arme (cierra episodio → nuevo entry en el 2º).
