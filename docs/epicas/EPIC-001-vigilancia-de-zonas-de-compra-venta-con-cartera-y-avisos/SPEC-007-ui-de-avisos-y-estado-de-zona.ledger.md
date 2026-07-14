---
id: SPEC-007
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-007 UI de avisos y estado de zona

## Resumen
- Fase: implementación completa (CA-1..CA-11 con test), pendiente de verificación. Spec en `en-revision`.
- Rama: `ft/SPEC-007-ui-de-avisos-y-estado-de-zona`
- Gates locales del implementador: **12 tests nuevos** (6 unit + 6 e2e); **91/91 unit**,
  **12/12 e2e**, `eslint` 0 errores, `tsc` 0, `next build` verde. UI con `design/tremen-ds`:
  nav compartida, tabla de datos, color de fondo por estado de zona, bandeja de avisos.
  Capturas inspeccionadas (nivel profesional para testers).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/watchlist/zone-status.ts` (`zoneStatusForUser`) · `src/app/vigiladas/page.tsx` (clase `zone-*` + etiqueta) · `globals.css` (tintes) | `tests/zone-status.test.ts` › "CA-1/CA-3…" · **e2e** avisos-zona.spec.ts (📸 ca1-vigiladas-estado-zona.png) | | 🚧 |
| CA-2 | `zone-status.ts` (leftJoin quotes → `state='none'`, price null) · `vigiladas/page.tsx` | `tests/zone-status.test.ts` › "CA-2: sin cotización → neutro" · **e2e** (TEF neutro) | | 🚧 |
| CA-3 | `zone-status.ts` (`stateOf`: buy/sell/both) · `vigiladas/page.tsx` (LABEL) | `tests/zone-status.test.ts` › "CA-1/CA-3… ambas y fuera" | | 🚧 |
| CA-4 | `zone-status.ts` (asOf de la quote) · `vigiladas/page.tsx` (columna A fecha) | `tests/zone-status.test.ts` (asOf) · **e2e** (2026-07-13 visible) | | 🚧 |
| CA-5 | `zone-status.ts` (filtro `userId`) | `tests/zone-status.test.ts` › "CA-5: aislamiento" | | 🚧 |
| CA-6 | `src/lib/notifications/service.ts` (`listNotificationsForUser` + readAt/isRead) · `src/app/avisos/page.tsx` | `tests/notifications-read.test.ts` › "CA-10/CA-6…" · **e2e** (2 items) | | 🚧 |
| CA-7 | `avisos/page.tsx` (empty state `.empty`) | **e2e** avisos-zona.spec.ts › "estado vacío" | | 🚧 |
| CA-8 | `notifications/service.ts` (`markNotificationRead` idempotente + userId) · `src/app/avisos/actions.ts` | `tests/notifications-read.test.ts` › "CA-8…" · **e2e** (marcar leído baja contador) | | 🚧 |
| CA-9 | `notifications/service.ts` (`markAllRead`) · `avisos/actions.ts` (`markAllReadAction`) | `tests/notifications-read.test.ts` › "CA-9/CA-11…" · **e2e** ("Todo al día") | | 🚧 |
| CA-10 | `notifications/service.ts` (`countUnread`) · `src/app/app-nav.tsx` (`.nav-count`) | `tests/notifications-read.test.ts` › "CA-10…" · **e2e** (nav-count 2→1→0) | | 🚧 |
| CA-11 | `notifications/service.ts` (filtros userId; `getNotificationForOwner`) · `ownership.ts` | `tests/notifications-read.test.ts` › "CA-8/CA-9/CA-11 aislamiento" | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-007/. Informe HTML opcional: _qa/SPEC-007/informe.html -->
Capturas del flujo real (Playwright) en `_qa/SPEC-007/`:

| CA | Evidencia | Fichero |
|---|---|---|
| CA-1/CA-2/CA-4 | /vigiladas: fila REP con fondo verde "En zona de compra" + asOf; TEF neutro "Sin cotización" | `_qa/SPEC-007/ca1-vigiladas-estado-zona.png` |
| CA-8/CA-10 | /avisos: contador "1" en nav, aviso no-leído con acento ámbar y "Marcar leído" | `_qa/SPEC-007/ca8-avisos-marcar-leido.png` |

## Salvedades / follow-ups
<!-- IDs F-SPEC-007-1, F-SPEC-007-2… con destino (spec futura o EPIC-MEJORA). -->
- **Aparcados en el roadmap** ("Más adelante"): filtros/paginación del inbox, archivar/borrar
  avisos, actualización en vivo del estado/contador (choca con D-2), y preferencias de
  notificación (F-SPEC-006-2). No bloquean el MVP.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- **Hecho (implementador):** CA-1..CA-11 con test (6 unit + 6 e2e), gates verdes. Spec a `en-revision`.
- **Capa de datos:** `src/lib/watchlist/zone-status.ts` (`zoneStatusForUser`), `notifications/service.ts`
  extendido (`readAt`/`isRead`, `countUnread`, `markNotificationRead`, `markAllRead`). Columna
  `notification.readAt` (schema.ts + test-db.ts + tests/e2e/server.mjs, tres en paridad — RED-1).
- **UI:** nav compartida `src/app/app-nav.tsx` (con contador), páginas `/avisos` (+ `actions.ts`),
  `/vigiladas` (color de fondo por zona), `/dashboard` y `/cartera` reformadas para coherencia.
  Estilos en `globals.css` (tokens `design/tremen-ds`).
- **Nota de e2e (símbolos compartidos):** el nuevo e2e usa tickers EXCLUSIVOS (REP/TEF) para no
  contaminar la DB e2e compartida que otros specs asumen sin cotización (ITX/AAPL/SAN). El botón
  de logout conserva el texto "Cerrar sesión" que asume el e2e de SPEC-001.
- **Pendiente (verificador):** rellenar Verif./Estado; inspeccionar las capturas con el listón
  "profesional/vendible" (se compartirá en un foro de bolsa para captar testers).
