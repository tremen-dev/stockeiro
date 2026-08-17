---
id: SPEC-024
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-024 Quitar de vigiladas la accion correcta, haya estado o no en zona

## Resumen
- Fase: en-revision (implementación terminada; pendiente del verificador)
- Rama: `ft/SPEC-024-quitar-de-vigiladas-la-accion-correcta-haya-estado-o-no-en-zona`
- Commits: `f69e76b` (docs) · `c9a5f82` (RED de los 13 CA) · `3e218f9` (defecto A, esquema)
  · `2bca480` (defecto B, identidad por id)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/db/schema.ts` (`zoneTriggers.watchedSymbolId` → `onDelete: 'cascade'`) + `drizzle/0007_tearful_roughhouse.sql` + `src/db/test-db.ts` | `tests/watchlist-service.test.ts` › *SPEC-024 CA-1: quitar una vigilada con episodio de zona ABIERTO* | | ❌ |
| CA-2 | `src/db/schema.ts` (`notifications.zoneTriggerId` → `onDelete: 'set null'`) + migración 0007 | `tests/watchlist-service.test.ts` › *SPEC-024 CA-2: … episodios CERRADOS y avisos emitidos* | | ❌ |
| CA-3 | idem CA-2 (sin cambios en `src/lib/notifications/service.ts`) | `tests/watchlist-service.test.ts` › *SPEC-024 CA-3: el aviso huérfano queda legible y contable* | | ❌ |
| CA-4 | idem CA-2 (`notif_entry_trigger` se conserva; NULL distintos) | `tests/watchlist-service.test.ts` › *SPEC-024 CA-4: varios avisos huérfanos conviven* | | ❌ |
| CA-5 | `src/lib/watchlist/service.ts` (`unwatch`, `where id = ? and user_id = ?`) + migración 0007 | `tests/watchlist-service.test.ts` › *SPEC-024 CA-5: sin daño colateral…* | | ❌ |
| CA-6 | sin código nuevo: corolario de la migración 0007 + `watchSymbol` (vigilada nueva) | `tests/watchlist-service.test.ts` › *SPEC-024 CA-6: re-vigilar un ticker que se quitó vuelve a avisar* | | ❌ |
| CA-7 | `src/app/vigiladas/page.tsx` + `src/app/vigiladas/actions.ts` + esquema | `tests/e2e/vigiladas.spec.ts` › *SPEC-024 CA-7: quitar una vigilada EN ZONA…* (capturas en `_qa/SPEC-024/ca7-*.png`) | | ❌ |
| CA-8 | `src/db/schema.ts` + `drizzle/0007_tearful_roughhouse.sql` + `src/db/test-db.ts` + `tests/e2e/server.mjs` | `tests/watchlist-service.test.ts` › *SPEC-024 CA-8: la invariante vive en el esquema…* | | ❌ |
| CA-9 | ningún cambio en `src/lib/triggers/*` ni `src/lib/notifications/*` | suites existentes sin tocar: `tests/triggers-service.test.ts`, `tests/triggers-cycle.test.ts`, `tests/notifications-{service,cycle,read}.test.ts` (24/24) | | ❌ |
| CA-10 | `src/lib/watchlist/service.ts:126-152` (`unwatch` por `watchedId`, sin `getSymbolByTicker`) | `tests/watchlist-service.test.ts` › *SPEC-024 CA-10: mismo ticker en dos mercados…* | | ❌ |
| CA-11 | `src/lib/watchlist/service.ts` — `userId` DENTRO del `DELETE`, sin guardia previa (decisión del gate) | `tests/watchlist-service.test.ts` › *SPEC-024 CA-11: un id ajeno no borra nada* | | ❌ |
| CA-12 | `src/lib/watchlist/service.ts` (guarda de forma uuid) + `src/app/vigiladas/actions.ts:50-62` | `tests/watchlist-service.test.ts` › *SPEC-024 CA-12: id inexistente o ausente…* | | ❌ |
| CA-13 | `src/app/vigiladas/page.tsx:89-96` (`name="watchedId" value={r.id}`) | `tests/e2e/vigiladas.spec.ts` › *SPEC-024 CA-13: con dos mercados del mismo ticker…* (capturas en `_qa/SPEC-024/ca13-*.png`) | | ❌ |

### Evidencia de la implementación (comandos y resultado)
- **RED antes del arreglo** (`c9a5f82`, `npx vitest run tests/watchlist-service.test.ts`):
  9 fallos. CA-1..CA-6 y CA-8 con `23503 — update or delete on table "watched_symbols"
  violates foreign key constraint "zone_triggers_watched_symbol_id_fkey"`; CA-10 con
  `expected false to be true`. CA-11/CA-12 pasaban ya, pero por accidente (con el código
  viejo un uuid no es un ticker y todo devolvía `false`).
- **RED e2e antes del arreglo** (`npx playwright test tests/e2e/vigiladas.spec.ts`): CA-7 y
  CA-13 en rojo. CA-7 terminaba en la página de error 500 de Next (capturada durante la
  investigación: *"This page couldn't load"* + digest opaco).
- **GREEN final**: `npx vitest run` → **263/263** en 30 ficheros. `npx playwright test` →
  **26/26**. `npm run typecheck` limpio. `npx eslint src tests` → 0 errores (1 warning
  preexistente en `tests/position.test.ts`, ajeno a esta spec).

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-024/. Informe HTML opcional: _qa/SPEC-024/informe.html -->
<!-- CA-7 y CA-13 son e2e Playwright: se espera captura de ambos. -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-024-1, F-SPEC-024-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-024-1** (abierto en spec, fuera de alcance): `/vigiladas` no muestra el mercado,
  así que dos vigiladas del mismo ticker en mercados distintos se ven como filas idénticas.
  Presentación, no corrección → EPIC-MEJORA.
- **F-SPEC-024-2** (abierto en spec, fuera de alcance): mismo defecto de identidad por ticker
  en la cartera (`recordSell`/`recordSplit`/`recordDividend`,
  `src/lib/portfolio/service.ts:98,127,144`) → candidato a spec propia en EPIC-FIX.
  No tocado: `getSymbolByTicker` sigue en pie para ese camino legacy; solo `unwatch` dejó
  de usarlo.
- **F-SPEC-024-3** (nuevo, abierto por el implementador): `tests/e2e/server.mjs` monta el
  esquema del e2e con **un TERCER DDL a mano** (además de la migración y de
  `src/db/test-db.ts`). La spec solo señalaba `test-db.ts`; se ha sincronizado también
  `server.mjs` porque CA-7 y CA-13 corren contra él y, sin las cláusulas `ON DELETE`, el
  e2e habría verificado un esquema que no es el de producción. Queda la deuda de fondo:
  **tres definiciones del mismo esquema que hay que acordarse de sincronizar a mano**, con
  un solo commit de por medio para que vuelvan a divergir. Candidato a EPIC-MEJORA
  (aplicar las migraciones drizzle también en test/e2e, o generar el DDL desde el esquema).
- **Salvedad de entorno (no es follow-up de producto)**: en un worktree limpio no hay `.env`
  (está en `.gitignore` y vive solo en el repo raíz), así que `npm run build` —que el e2e
  necesita— falla con *"DATABASE_URL no definida"* al recolectar `/api/cron/refresh`. Se
  construyó con `DATABASE_URL=... AUTH_SECRET=... npm run build` (valores de usar y tirar;
  el e2e los sobreescribe en `tests/e2e/server.mjs`). Quien verifique en este worktree
  necesitará hacer lo mismo.
- **Aviso para el orquestador (documento de verdad, no lo toco)**: `ADR-017` sigue con
  `estado: borrador` en su frontmatter aunque el gate humano del 2026-08-17 aprobó su
  decisión y la spec que lo cita está aprobada e implementada. Corresponde a
  sdd-arquitecto/orquestador moverlo a `aceptada`.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- **Implementación terminada**: los 13 CA tienen código y test, y todo está en verde en la
  rama `ft/SPEC-024-…` (sin push, sin PR). Falta el paso del verificador.
- Cómo verificar en este worktree:
  `npx vitest run` (263/263) ·
  `DATABASE_URL=postgres://postgres:postgres@localhost:54329/stockeiro_e2e AUTH_SECRET=cualquier-cosa npm run build` ·
  `npx playwright test` (26/26; CA-7 y CA-13 en `tests/e2e/vigiladas.spec.ts`).
  El `build` necesita esas dos variables porque el worktree no tiene `.env` (ver salvedades).
- Qué mirar con lupa (lo pidió el gate): **CA-11**. El `userId` va dentro del `DELETE`
  (`src/lib/watchlist/service.ts`), sin guardia previa con `getWatchedForOwner` — descartada
  a propósito por el humano. Un id ajeno devuelve `false` igual que uno inexistente.
- **CA-6 es comportamiento querido**, no efecto colateral: quitar y volver a vigilar vuelve a
  avisar aunque el precio nunca saliera de la zona. Su test lo fija; no lo "arregles".
- La migración `drizzle/0007_tearful_roughhouse.sql` está generada pero **no aplicada** a
  ninguna base real. Abrir el PR migra producción (`DATABASE_URL` compartida con Preview,
  F-SPEC-023-1): son dos `DROP`/`ADD CONSTRAINT`, sin movimiento de datos.
- `tests/repro-unwatch-en-zona.test.ts` (scratch de investigación) **ya está borrado**; su
  escenario vive en `tests/watchlist-service.test.ts` (CA-1/CA-2/CA-8).
