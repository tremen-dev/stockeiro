---
id: SPEC-024
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-024 Quitar de vigiladas la accion correcta, haya estado o no en zona

## Resumen
- Fase: **hecho** (verificada GREEN el 2026-08-17; 13/13 CA)
- Rama: `ft/SPEC-024-quitar-de-vigiladas-la-accion-correcta-haya-estado-o-no-en-zona`
- Commits: `f69e76b` (docs) · `c9a5f82` (RED de los 13 CA) · `3e218f9` (defecto A, esquema)
  · `2bca480` (defecto B, identidad por id)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/db/schema.ts` (`zoneTriggers.watchedSymbolId` → `onDelete: 'cascade'`) + `drizzle/0007_tearful_roughhouse.sql` + `src/db/test-db.ts` | `tests/watchlist-service.test.ts` › *SPEC-024 CA-1: quitar una vigilada con episodio de zona ABIERTO* | ✔ verde en `npx vitest run` (263/263). **Mutación M1** (quito `ON DELETE CASCADE` de `test-db.ts`): falla → el cascade es el que lo sostiene, no el test | ✅ |
| CA-2 | `src/db/schema.ts` (`notifications.zoneTriggerId` → `onDelete: 'set null'`) + migración 0007 | `tests/watchlist-service.test.ts` › *SPEC-024 CA-2: … episodios CERRADOS y avisos emitidos* | ✔ verde. El test compara `payload\|kind\|status\|asOf\|readAt` **antes vs. después** (no solo "existe"). **M1**: falla | ✅ |
| CA-3 | idem CA-2 (sin cambios en `src/lib/notifications/service.ts`) | `tests/watchlist-service.test.ts` › *SPEC-024 CA-3: el aviso huérfano queda legible y contable* | ✔ verde. **M1**: falla. Confirmado también en la UI real: `_qa/SPEC-024/ca7-avisos-conservados.png` (contador "1 sin leer" y payload íntegro tras la baja) | ✅ |
| CA-4 | idem CA-2 (`notif_entry_trigger` se conserva; NULL distintos) | `tests/watchlist-service.test.ts` › *SPEC-024 CA-4: varios avisos huérfanos conviven* | ✔ verde. **M1**: falla | ✅ |
| CA-5 | `src/lib/watchlist/service.ts` (`unwatch`, `where id = ? and user_id = ?`) + migración 0007 | `tests/watchlist-service.test.ts` › *SPEC-024 CA-5: sin daño colateral…* | ✔ verde. Afirma en positivo lo que SOBREVIVE (episodios de la otra vigilada de A, los de B, símbolo, cotización y transacción). **M1**: falla | ✅ |
| CA-6 | sin código nuevo: corolario de la migración 0007 + `watchSymbol` (vigilada nueva) | `tests/watchlist-service.test.ts` › *SPEC-024 CA-6: re-vigilar un ticker que se quitó vuelve a avisar* | ✔ verde con el motor real (`evaluateTriggers` + `notifyCycle`), no con dobles. Decisión humana del gate 2026-08-17, verificada como querida. **M1**: falla | ✅ |
| CA-7 | `src/app/vigiladas/page.tsx` + `src/app/vigiladas/actions.ts` + esquema | `tests/e2e/vigiladas.spec.ts` › *SPEC-024 CA-7: quitar una vigilada EN ZONA…* (capturas en `_qa/SPEC-024/ca7-*.png`) | ✔ `npx playwright test` 26/26. **Contra-prueba en worktree pre-fix (`5167cf5`)**: falla en la aserción POSITIVA `.empty-title` = "Aún no vigilas ninguna acción" (la pantalla 500 no la tiene). Una aserción solo en negativo habría pasado con el bug delante; esta no | ✅ |
| CA-8 | `src/db/schema.ts` + `drizzle/0007_tearful_roughhouse.sql` + `src/db/test-db.ts` + `tests/e2e/server.mjs` | `tests/watchlist-service.test.ts` › *SPEC-024 CA-8: la invariante vive en el esquema…* | ✔ verde. **Contra-prueba pre-fix**: reproduce el defecto exacto — `23503 … violates foreign key constraint "zone_triggers_watched_symbol_id_fkey"` — sin pasar por `unwatch`. Las **tres** definiciones del esquema (migración 0007, `src/db/test-db.ts`, `tests/e2e/server.mjs`) llevan las mismas cláusulas `ON DELETE`: comprobado | ✅ |
| CA-9 | ningún cambio en `src/lib/triggers/*` ni `src/lib/notifications/*` | suites existentes sin tocar: `tests/triggers-service.test.ts`, `tests/triggers-cycle.test.ts`, `tests/notifications-{service,cycle,read}.test.ts` (24/24) | ✔ 24/24 verde, y `git diff 5167cf5..HEAD -- tests/triggers-*.test.ts tests/notifications*.test.ts` es **vacío**: ninguna expectativa relajada | ✅ |
| CA-10 | `src/lib/watchlist/service.ts:126-152` (`unwatch` por `watchedId`, sin `getSymbolByTicker`) | `tests/watchlist-service.test.ts` › *SPEC-024 CA-10: mismo ticker en dos mercados…* | ✔ verde. **Contra-prueba pre-fix**: `expected false to be true` — el camino por ticker no resolvía el id | ✅ |
| CA-11 | `src/lib/watchlist/service.ts` — `userId` DENTRO del `DELETE`, sin guardia previa (decisión del gate) | `tests/watchlist-service.test.ts` › *SPEC-024 CA-11: un id ajeno no borra nada* | ✔ Inspección: `where(and(eq(id, watchedId), eq(userId, userId)))`, **sin** guardia previa con `getWatchedForOwner` (respeta la decisión humana). **Mutación M2** (quito `eq(watchedSymbols.userId, userId)` del `where`): **CA-11 es el ÚNICO test de los 263 que se pone rojo** → hoy prueba lo que dice, no una coincidencia de tipos uuid/ticker | ✅ |
| CA-12 | `src/lib/watchlist/service.ts` (guarda de forma uuid) + `src/app/vigiladas/actions.ts:50-62` | `tests/watchlist-service.test.ts` › *SPEC-024 CA-12: id inexistente o ausente…* | ✔ verde: uuid inexistente, cadena vacía y cadena no-uuid → `false` sin lanzar y lista intacta. `removeAction` conserva la guarda de campo ausente | ✅ |
| CA-13 | `src/app/vigiladas/page.tsx:89-96` (`name="watchedId" value={r.id}`) | `tests/e2e/vigiladas.spec.ts` › *SPEC-024 CA-13: con dos mercados del mismo ticker…* (capturas en `_qa/SPEC-024/ca13-*.png`) | ✔ 26/26. **Contra-prueba pre-fix**: la cuenta genérica de filas BBVA (=1) **pasaba igual con el bug** (borraba la otra); lo que lo cazó es la aserción de identidad `tr con "60 – 65" → 0` / `"10 – 15" → 1`, que falló con `Received: 1`. El e2e distingue los tres estados (2 filas / 1 correcta / 0 = error 500) | ✅ |

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

**GREEN — 2026-08-17, sdd-verificador.** 13/13 CA cerrados. Ningún ⚠️.

### Gates automáticos (ejecutados por el verificador en este worktree)
| Gate | Comando | Resultado |
|---|---|---|
| Suite completa | `npx vitest run` | **263/263** en 30 ficheros (96,95 s) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | limpio, sin salida |
| Lint | `npx eslint src tests` | **0 errores**; 1 warning preexistente (`tests/position.test.ts:7` `LedgerEntry` sin usar), fichero ajeno a esta rama |
| Build e2e | `DATABASE_URL=… AUTH_SECRET=… npm run build` | OK (el worktree no tiene `.env`; ver salvedades) |
| E2E | `npx playwright test` | **26/26** (1,1 min), CA-7 y CA-13 incluidos |
| Regresión CA-9 | `npx vitest run tests/triggers-*.test.ts tests/notifications-*.test.ts` | **24/24** |

### Contra-pruebas adversariales (que los tests no pasen con el defecto delante)
Se montaron dos worktrees desechables fuera del repo, se usaron y se eliminaron
(`git worktree list` vuelve a mostrar solo los de siempre; árbol de la rama limpio).

1. **Worktree pre-fix (`5167cf5`) + los tests de HEAD copiados encima.**
   `npx vitest run tests/watchlist-service.test.ts` → **8 fallos** (CA-1..CA-6, CA-8, CA-10).
   CA-8 reproduce literalmente el defecto A: `23503 — update or delete on table
   "watched_symbols" violates foreign key constraint "zone_triggers_watched_symbol_id_fkey"`.
   `npx playwright test tests/e2e/vigiladas.spec.ts` → **CA-7 y CA-13 en rojo**, y por la
   aserción correcta en cada caso (ver tabla). Los dos e2e de SPEC-003 siguen verdes ahí,
   así que el rojo es del defecto, no del arnés.
2. **Mutaciones sobre HEAD** (en el worktree desechable, nunca sobre la rama):
   - **M1** — quitar `ON DELETE CASCADE`/`ON DELETE SET NULL` del DDL de `src/db/test-db.ts`:
     caen **CA-1..CA-6 y CA-8** (7 tests). El invariante de esquema es load-bearing.
   - **M2** — quitar `eq(watchedSymbols.userId, userId)` del `where` del `DELETE`:
     cae **solo CA-11**, y cae. Descarta la sospecha de que CA-11 pasara "por accidente"
     (con el código viejo pasaba porque un uuid nunca es un ticker; hoy no).

### Trampas que el gate pedía descartar, y con qué evidencia
- **(a) e2e que pasarían con el bug delante.** Descartada. CA-7 ancla en el marcador
  **positivo** `.empty-title`, que la pantalla 500 de Next no tiene — y así falló en el
  worktree pre-fix. CA-13 no se conforma con "queda 1 fila BBVA" (eso pasaba **también**
  con el bug, porque borraba la otra): exige `"60 – 65" → 0` y `"10 – 15" → 1`, y es ahí
  donde el pre-fix falla con `Received: 1`. Los tres estados quedan distinguidos.
- **(b) CA que pasan por coincidencia de tipos.** Descartada para CA-11 con M2 (único rojo)
  y por inspección para CA-12 (cubre uuid inexistente, cadena vacía **y** cadena no-uuid).
- **Tres definiciones del esquema.** Comprobadas una por una: `drizzle/0007_tearful_roughhouse.sql`,
  `src/db/test-db.ts:89,102` y `tests/e2e/server.mjs:122,134` llevan las mismas cláusulas.
  Además los nombres de constraint que el 0007 hace `DROP` coinciden **exactamente** con los
  que creó `drizzle/0000_real_tusk.sql:81,88`, y ninguna migración intermedia (0001–0006)
  los toca: la migración aplicará sin error sobre una base creada por drizzle.
- **Scratch de investigación.** `tests/repro-unwatch-en-zona.test.ts` no está en el árbol
  (`ls tests/`), y su escenario vive en CA-1/CA-2/CA-8.
- **Suites de disparos y avisos sin relajar.** `git diff 5167cf5..HEAD` sobre
  `tests/triggers-*.test.ts` y `tests/notifications*.test.ts` devuelve **vacío**.

### Decisiones humanas vinculantes: respetadas
1. Esquema por **migración drizzle** (`0007_tearful_roughhouse.sql` + snapshot + journal),
   `cascade` en `zone_triggers` y `set null` en `notifications`. El historial de avisos se
   conserva: comprobado en test (CA-2 compara campo a campo) y en la UI (bandeja tras la baja).
2. **CA-11**: el `userId` va dentro del `DELETE`; **no** hay guardia previa con
   `getWatchedForOwner`. Un id ajeno y un id inexistente devuelven ambos `false`.
3. **CA-6** verificado como comportamiento **querido**: re-vigilar vuelve a avisar.
4. **F-SPEC-024-1** y **F-SPEC-024-2** siguen abiertos y fuera de alcance; no se han contado
   como defecto. `getSymbolByTicker` sigue en pie solo para `src/lib/portfolio/service.ts:98,127,144`.

### Migración: NO aplicada
No se ejecutó `db:migrate` contra ninguna base real. Toda la verificación de esquema es
contra PGlite (vitest) y contra el Postgres embebido efímero de `tests/e2e/server.mjs`.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-024/. Informe HTML opcional: _qa/SPEC-024/informe.html -->
<!-- CA-7 y CA-13 son e2e Playwright: se espera captura de ambos. -->

Capturas regeneradas por el verificador en su propia pasada de `npx playwright test` (26/26)
y revisadas una a una. El árbol se dejó en el estado del commit: correr el e2e reescribe
**todos** los PNG de `_qa/` (render no determinista), así que tras revisarlas se restauraron
con `git checkout -- _qa` para no inflar el diff de la rama.

| CA | Captura | Qué se ve |
|---|---|---|
| CA-7 | `_qa/SPEC-024/ca7-antes-de-quitar.png` | Fila MSFT con fondo verde y "En zona de compra", precio 12, zona 10 – 15, botón "Quitar". Badge "Avisos 1" en la barra |
| CA-7 | `_qa/SPEC-024/ca7-despues-de-quitar.png` | `/vigiladas` renderizada, `h1` = "Acciones vigiladas", estado vacío "Aún no vigilas ninguna acción" — **no** la pantalla de error. El badge "Avisos 1" sigue ahí |
| CA-3/CA-7 | `_qa/SPEC-024/ca7-avisos-conservados.png` | Bandeja `/avisos`: "1 sin leer", aviso "MSFT en zona de compra @ 12", "ENTRADA EN ZONA", "a fecha 2026-07-13 no leído". El aviso sobrevivió a la baja (RN-15) |
| CA-13 | `_qa/SPEC-024/ca13-dos-mercados.png` | Dos filas BBVA, distinguibles solo por su zona de compra (10 – 15 / 60 – 65) — que es exactamente F-SPEC-024-1 |
| CA-13 | `_qa/SPEC-024/ca13-queda-la-otra.png` | Tras "Quitar" en la fila 60 – 65: queda **una** fila BBVA, la de 10 – 15, sin pantalla de error |

Lenguaje ubicuo del DOM conforme a `docs/fundacion/dominio.md`: "Acciones vigiladas",
"En zona de compra", "Sin cotización", "Tus avisos", "Entrada en zona", "no leído", "Quitar".
Viewport: el único que define el proyecto (`playwright.config.ts` → chromium Desktop Chrome).

## Salvedades / follow-ups
<!-- IDs F-SPEC-024-1, F-SPEC-024-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-024-1** (abierto en spec, fuera de alcance): `/vigiladas` no muestra el mercado,
  así que dos vigiladas del mismo ticker en mercados distintos se ven como filas idénticas.
  Presentación, no corrección → EPIC-MEJORA.
  **CERRADO por SPEC-029 (CA-14)**, decisión del humano en el gate del 2026-08-18: `/vigiladas`
  pasa a mostrar mercado (y tipo). Se anota aquí y **SPEC-024 no se reabre**: sigue en `hecho`.
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

### Añadido por el verificador (2026-08-17)
- **F-SPEC-024-3 confirmado y elevado.** No es solo deuda de mantenimiento: es un agujero de
  cobertura latente. Las tres definiciones del esquema hoy coinciden —comprobado—, pero
  **ninguna suite lo comprueba**: si mañana alguien cambia `src/db/schema.ts` y regenera la
  migración sin tocar `src/db/test-db.ts` y `tests/e2e/server.mjs`, todos los tests seguirán
  verdes contra un esquema que no es el de producción, y este mismo defecto puede volver sin
  que nada lo vea. Sugerencia para EPIC-MEJORA: aplicar las migraciones drizzle en test/e2e
  en vez de tres DDL a mano, o al menos un test que compare las cláusulas `ON DELETE` de las
  tres fuentes.
- **Riesgo de despliegue (no bloquea el GREEN, pero es el punto 6 del gate).** La migración
  `0007` no está aplicada a ninguna base. Abrir el PR migra **producción**, porque
  `DATABASE_URL` está compartida con Preview (F-SPEC-023-1). Verificado que es solo
  `DROP CONSTRAINT` + `ADD CONSTRAINT` sobre dos FKs, sin movimiento de datos, y que los
  nombres que hace `DROP` son los que creó `drizzle/0000_real_tusk.sql` (81, 88), sin
  migración intermedia que los renombre. Es un `ALTER TABLE` con lock breve sobre
  `notifications` y `zone_triggers`.
- **Efecto irreversible de la nueva semántica, para que conste.** A partir del despliegue,
  cualquier `DELETE` sobre `watched_symbols` —venga de donde venga— borra sus episodios
  **en silencio**. Es exactamente lo que ADR-017 decide, y CA-8 lo fija a propósito; se
  registra aquí solo porque es acción a distancia y conviene que esté escrito.
- **Salvedad de entorno confirmada**: sin `.env` en el worktree, `npm run build` falla; se
  reprodujo y se resolvió pasando `DATABASE_URL` y `AUTH_SECRET` en línea, como decía el
  handoff. El dato del handoff era correcto.
- **Estado del árbol tras verificar**: limpio, en `9f8aa82`. Los dos worktrees desechables
  usados para las contra-pruebas se eliminaron. Sin push y sin PR, como se pidió.

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
