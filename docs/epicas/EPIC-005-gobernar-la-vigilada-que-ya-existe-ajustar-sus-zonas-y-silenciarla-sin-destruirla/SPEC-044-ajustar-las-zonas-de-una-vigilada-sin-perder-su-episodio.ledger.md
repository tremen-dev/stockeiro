---
id: SPEC-044
tipo: ledger
epica: EPIC-005
---
# Ledger — SPEC-044 Ajustar las zonas de una vigilada sin perder su episodio

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
  `en-revision` — implementación completa, pendiente del gate del verificador.
- Rama: `ft/SPEC-044-ajustar-las-zonas-de-una-vigilada-sin-perder-su-episodio`
- Versión: `0.2.1` → **`0.3.0`** (MINOR: capacidad nueva; SPEC-038 CA-12 / ADR-024 pto. 8).
- **Sin migración y sin cambio de esquema**: `git diff main HEAD -- src/db/schema.ts drizzle/`
  no devuelve nada. Todo el riesgo de esquema de EPIC-005 sigue concentrado en SPEC-045.
- **Sin tocar el motor**: `git diff main HEAD -- src/lib/triggers/ src/lib/notifications/`
  tampoco devuelve nada. CE-2 sale de las tres ramas que `evaluateTriggers` ya tenía.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/watchlist/service.ts` (`updateWatchedZones`) | `tests/spec044-edicion-zonas.test.ts` › *CA-1: edición en sitio de los cuatro valores* (2 casos: identidad/`createdAt` y recuento de filas) | | 🚧 |
| CA-2 | `src/lib/watchlist/service.ts` (`str`/`has`: campo vacío = `null`) | `tests/spec044-edicion-zonas.test.ts` › *CA-2: vaciar una zona entera es una edición válida* (3 casos: compra sola, campo vacío del formulario, las cuatro) | | 🚧 |
| CA-3 | `src/lib/watchlist/service.ts` (el `UPDATE` no alcanza `zone_triggers` ni `notifications`) | `tests/spec044-edicion-zonas.test.ts` › *CA-3: los episodios y los avisos siguen siendo suyos* | | 🚧 |
| CA-4 | `src/lib/watchlist/service.ts` (`updateWatchedZones` vs. `unwatch` + `watchSymbol`) | `tests/spec044-edicion-zonas.test.ts` › *CA-4: editar y borrar+recrear dejan de ser el mismo camino* (las dos vigiladas en el MISMO test) | | 🚧 |
| CA-5 | — (sin código nuevo: `src/lib/triggers/service.ts`, rama «sigue dentro») | `tests/spec044-continuidad-episodio.test.ts` › *CA-5: caso 1 — sigue dentro* | | 🚧 |
| CA-6 | — (sin código nuevo: rama «fuera && con episodio → cierra») | `tests/spec044-continuidad-episodio.test.ts` › *CA-6: caso 2 — el cambio deja el precio fuera* | | 🚧 |
| CA-7 | — (sin código nuevo: rama «dentro && sin episodio → abre») | `tests/spec044-continuidad-episodio.test.ts` › *CA-7: caso 3 — estaba fuera y el cambio lo mete dentro* | | 🚧 |
| CA-8 | `src/app/vigiladas/actions.ts` (`editZonesAction`) | `tests/spec044-accion-edicion.test.ts` › *CA-8* (3 casos: instantánea de las dos tablas + `FakeNotificationSender` sin envíos; la action no importa motor/notificador; el cuerpo del servicio solo toca `watchedSymbols`) | | 🚧 |
| CA-9 | — (orden de `runRefreshCycle`: ingesta → disparos → avisos) | `tests/spec044-continuidad-episodio.test.ts` › *CA-9: el orden del ciclo protege el digest* | | 🚧 |
| CA-10 | — | `tests/spec044-continuidad-episodio.test.ts` › *CA-10: editar dos veces antes del ciclo* (2 casos: acaba fuera / acaba dentro) | | 🚧 |
| CA-11 | `src/app/vigiladas/actions.ts` (`readZones` → `readDecimalField`, SPEC-030) | `tests/spec044-edicion-zonas.test.ts` › *CA-11: coma decimal, la misma puerta que el alta* | | 🚧 |
| CA-12 | `src/lib/watchlist/service.ts` (`validatePair` antes del `UPDATE`) | `tests/spec044-edicion-zonas.test.ts` › *CA-12: min > max se rechaza* (2 casos, incluido «todo o nada») | | 🚧 |
| CA-13 | `src/lib/watchlist/service.ts` (`validatePair`) | `tests/spec044-edicion-zonas.test.ts` › *CA-13: par incompleto rechazado* (2 casos: incompleta / vacía) | | 🚧 |
| CA-14 | `src/app/vigiladas/actions.ts` (`toFormError`, normalización fuera del `try`) | `tests/spec044-accion-edicion.test.ts` › *CA-14* (4 casos: `abc` sin traza, base caída con traza, los dos mensajes distintos, `InvalidZoneError` sin traza) | | 🚧 |
| CA-15 | `src/lib/watchlist/service.ts` + `src/app/vigiladas/actions.ts` (una `validatePair`, un `readZones`) | `tests/spec044-edicion-zonas.test.ts` › *CA-15* (mensajes idénticos alta/edición) **y** `tests/spec044-accion-edicion.test.ts` › *CA-15* (4 casos de inspección de fuente, incluido `userId` dentro del `WHERE`) | | 🚧 |
| CA-16 | `src/lib/watchlist/service.ts` (identifica por `id`, no acepta símbolo) | `tests/spec044-edicion-zonas.test.ts` › *CA-16: identifica por id de vigilada, no por ticker* | | 🚧 |
| CA-17 | `src/lib/watchlist/service.ts` (`and(eq(id), eq(userId))` en el `UPDATE`) | `tests/spec044-edicion-zonas.test.ts` › *CA-17: un id ajeno no edita nada* + `tests/spec044-accion-edicion.test.ts` › *el `userId` viaja DENTRO del WHERE* | | 🚧 |
| CA-18 | `src/lib/watchlist/service.ts` (guarda `UUID`, devuelve `null`) | `tests/spec044-edicion-zonas.test.ts` › *CA-18: id ausente o malformado no es una excepción* | | 🚧 |
| CA-19 | `src/app/vigiladas/watched-table.tsx` + `watch-form.tsx` | `tests/e2e/vigiladas-editar.spec.ts` › *CA-19: el control por fila abre un formulario con los valores actuales* | | 🚧 |
| CA-20 | `src/app/vigiladas/watch-form.tsx` (modo edición) + `src/app/globals.css` (`.editar-vigilada`, sin ancho) | `tests/e2e/vigiladas-editar.spec.ts` › *CA-20* **y** `tests/spec044-frontera.test.ts` › *CA-19/CA-20* (4 casos de inspección) | | 🚧 |
| CA-21 | `src/app/vigiladas/watch-form.tsx` (campos controlados, `onGuardado`) | `tests/e2e/vigiladas-editar.spec.ts` › *CA-21: guardar cierra…* y *CA-21: un error de validación deja el panel abierto…* | | 🚧 |
| CA-22 | `src/app/vigiladas/watched-table.tsx` (`CADENCIA_LINEA`) | `tests/e2e/vigiladas-editar.spec.ts` › *CA-22* **y** `tests/spec044-frontera.test.ts` › *CA-22* | | 🚧 |
| CA-23 | `src/app/globals.css` (`.fila-acciones`, `.editar-vigilada`); panel FUERA de `.table-scroll` | `tests/e2e/vigiladas-editar.spec.ts` › *CA-23: M1, M2, M3 y alcance de los controles a los ocho anchos* (cerrado **y** abierto) | | 🚧 |
| CA-24 | `src/app/vigiladas/watched-table.tsx` (estado por `id`, no por posición) | `tests/e2e/vigiladas-editar.spec.ts` › *CA-24: reordenar y editar…* y *CA-24: el estado vacío…* **y** `tests/spec044-frontera.test.ts` › *CA-24* | | 🚧 |
| CA-25 | — (nada de SPEC-003/005/006/007 se tocó) | Suite completa: `npm test` **96 ficheros / 1441 tests** verdes (baseline en `main`: 92 / 1400, ninguna aserción reescrita) y `npx playwright test` **243 verdes** (antes 235) | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-044/. Informe HTML opcional: _qa/SPEC-044/informe.html -->
Generada por `tests/e2e/vigiladas-editar.spec.ts` (CA-23), en `_qa/SPEC-044/`:

| CA | Evidencia |
|---|---|
| CA-23 | `ca23-<ancho>-cerrado.png` y `ca23-<ancho>-abierto.png` para 360, 390, 640, 700, 730, 760, 800 y 1280 |
| CA-23 | `medidas-ca23.txt` — M1: **0 violaciones** sobre 43 elementos (panel cerrado) y **58** (abierto) a los siete anchos móviles, 96/111 a 1280; M2: desborde **0** en los dieciséis estados |

## Salvedades / follow-ups
<!-- IDs F-SPEC-044-1, F-SPEC-044-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-044-1 — El campo vacío significa «vacía esta zona», no «déjala como estaba».**
  La edición manda siempre los cuatro valores y escribe los cuatro. Es lo que CA-2 pide
  (vaciar es una edición válida) y lo que hace el formulario, que siempre trae los cuatro
  campos; pero significa que un consumidor futuro de `updateWatchedZones` que quiera
  actualizar **solo una** zona tiene que releer la otra y reenviarla. Si algún día hace
  falta una edición parcial (API, edición masiva), es otra operación y otra spec.
  → **EPIC-MEJORA**, sin urgencia.
- **F-SPEC-044-2 — Signo y rango de los valores de zona siguen sin validarse.** `-5` se
  acepta y se guarda, en la edición igual que en el alta. Es **F-SPEC-030-2** heredado tal
  cual y la spec lo deja fuera a propósito (arreglarlo cambiaría también el alta).
  → sigue en **F-SPEC-030-2**, no se abre nada nuevo.
- **F-SPEC-044-3 — El panel de edición y el de alta pueden estar abiertos a la vez.** Son
  dos formularios `.auth-form` en la misma pantalla, uno debajo del otro. No incumple
  ningún CA (CA-23 mide la página entera con el panel de edición abierto y sale limpia) y
  ninguna spec pide excluirlos, pero es una decisión que la spec no zanjaba: se dejó que
  convivan porque cerrar el alta al editar sería tomar por el usuario una decisión que no
  ha pedido. Con SPEC-045 y tres controles por fila conviene revisarlo. → **EPIC-MEJORA**.

### Decisiones que la spec no zanjaba
1. **Orden de las comprobaciones en `updateWatchedZones`: primero el dato, luego la fila.**
   `validatePair` corre ANTES de mirar el `id`. Si el id se comprobara primero, un id
   malformado se saltaría la validación entera — o sea, una puerta más floja para editar,
   que es justo lo que CA-15 prohíbe. CA-18 se cumple igual: con zonas válidas, un id
   vacío/no-uuid/manipulado devuelve `null` sin lanzar.
2. **Dónde se dice la cadencia (CA-22): al guardar, y también con el panel abierto.** El CA
   dice «cuando se guarda, la pantalla dice…», así que el aviso aparece tras guardar
   (`data-testid="edicion-cadencia"`), con la frase literal de `CADENCIA_LINEA`. Es
   incondicional —no solo cuando la edición mete el precio en zona— porque decirlo siempre
   es cierto siempre y condicionarlo exigiría comparar el estado de zona antes y después
   en el cliente, que es frágil y no lo pide nadie.
3. **Los cuatro campos son controlados.** No es estilo: React reinicia el formulario tras
   ejecutar su `action`, así que con campos no controlados un error de validación **borraba
   lo que el usuario acababa de escribir** (medido: «40 / 10» volvía a «12 / 14») con el
   mensaje delante pidiéndole que lo corrigiera. Lo cazó el e2e de CA-21, no la revisión.
4. **El panel vive FUERA de `.table-scroll`.** Dentro heredaría el ancho de la tabla y —
   peor— quedaría en el subárbol de un contenedor desplazable, donde M1 **deja de medir**
   (ADR-026 §4): el formulario podría salirse de la ventana sin que ninguna guardia lo
   viera. Está afirmado en `tests/e2e/vigiladas-editar.spec.ts` › CA-20.
5. **Versión 0.3.0, no 0.4.0.** El gate compara contra `origin/main`, que está en **0.2.1**
   (`git show origin/main:package.json`). 0.3.0 es el MINOR que corresponde a una capacidad
   nueva desde esa base; `npm run version:check` sale limpio («La version sube de 0.2.1 a
   0.3.0»). Si quien revise esperaba 0.4.0 es porque daba `main` por 0.3.0, y no lo está.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
**Está todo implementado y probado.** Los 25 CA tienen código y test; nada quedó a medias.

Cinco commits de código sobre la rama, más uno inicial de `docs(...)` que sólo transporta
los artefactos de EPIC-005 escritos por otros roles (spec 044, spec 045, ADR-028, ADR-029,
`_epica.md`, los dos ledgers y `docs/roadmap.md`), sin modificarlos.

Comandos con los que se comprobó, todos verdes:

```
npm test           → 96 ficheros / 1441 tests   (baseline main: 92 / 1400)
npm run lint       → sin salida (--max-warnings=0)
npm run typecheck  → sin salida
npm run db:scan    → 11 migraciones, 2 con SQL destructivo, ambas con waiver previo
npm run version:check → «La version sube de 0.2.1 a 0.3.0»
npx playwright test → 243 verdes (antes 235; los 8 nuevos son de SPEC-044)
```

Para volver a generar la evidencia de CA-23 hace falta un build primero:

```
DATABASE_URL=postgres://ci:ci@localhost:5432/ci \
AUTH_SECRET=ci-not-a-real-secret-ci-not-a-real-secret \
AUTH_TRUST_HOST=true APP_BASE_URL=http://localhost:3200 npm run build
npx playwright test tests/e2e/vigiladas-editar.spec.ts
```

Dónde mirar primero si algo se pone rojo:

- **La operación** vive entera en `updateWatchedZones` (`src/lib/watchlist/service.ts`). Es
  un `UPDATE` y nada más. Si aparece la tentación de llamar al motor desde ahí, léase
  ADR-028 §Alternativas (a) y (b): las dos producen el aviso duplicado que CE-2 prohíbe.
- **La continuidad del episodio** no tiene código propio: es
  `tests/spec044-continuidad-episodio.test.ts` contra `evaluateTriggers` sin tocar. Un rojo
  ahí significa que alguien cambió el motor, no que falte algo en la edición.
- **La geometría** se mide en `tests/e2e/vigiladas-editar.spec.ts` › CA-23, con el panel
  abierto y cerrado. Un rojo con un control fuera de la ventana se arregla en la caja
  (`.auth-form`, territorio de SPEC-040), no aflojando la medida.

**Lo que NO entra en esta rama, a propósito**: SPEC-045 (silenciar/reactivar, columna
`silenced_at`) va en otra rama y otra PR, porque es la que migra producción. Aquí no hay
migración ni cambio de `src/db/schema.ts`.
