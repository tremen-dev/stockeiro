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
| CA-1 | `src/lib/watchlist/service.ts` (`updateWatchedZones`) | `tests/spec044-edicion-zonas.test.ts` › *CA-1: edición en sitio de los cuatro valores* (2 casos: identidad/`createdAt` y recuento de filas) | Test verde. Leído: el test relee la fila de la BD (no el retorno) y compara `id`/`userId`/`symbolId`/`createdAt`; el segundo caso cuenta `watched_symbols` antes y después con dos usuarios sembrados | ✅ |
| CA-2 | `src/lib/watchlist/service.ts` (`str`/`has`: campo vacío = `null`) | `tests/spec044-edicion-zonas.test.ts` › *CA-2: vaciar una zona entera es una edición válida* (3 casos: compra sola, campo vacío del formulario, las cuatro) | Test verde. Los tres casos afirman `null` en BD **y** que la vigilada sigue en `listWatched` (no es una baja). El caso 2 pasa por `readDecimalField` con `FormData` vacío: es el camino real del formulario | ✅ |
| CA-3 | `src/lib/watchlist/service.ts` (el `UPDATE` no alcanza `zone_triggers` ni `notifications`) | `tests/spec044-edicion-zonas.test.ts` › *CA-3: los episodios y los avisos siguen siendo suyos* | Test verde. Comparación por huella completa: episodios por `id|openedAt|closedAt|price|asOf` y avisos por `id|zoneTriggerId|payload|readAt|status`, con un episodio abierto, uno cerrado y un aviso ya leído | ✅ |
| CA-4 | `src/lib/watchlist/service.ts` (`updateWatchedZones` vs. `unwatch` + `watchSymbol`) | `tests/spec044-edicion-zonas.test.ts` › *CA-4: editar y borrar+recrear dejan de ser el mismo camino* (las dos vigiladas en el MISMO test) | Test verde. **Confirmado que compara las dos rutas, no una**: en el mismo `it` corren `updateWatchedZones` sobre una y `unwatch`+`watchSymbol` sobre la otra, y se afirman las dos mitades (id/`createdAt`/episodio conservados vs. id nuevo, fila vieja `undefined`, cero episodios y un aviso huérfano) | ✅ |
| CA-5 | — (sin código nuevo: `src/lib/triggers/service.ts`, rama «sigue dentro») | `tests/spec044-continuidad-episodio.test.ts` › *CA-5: caso 1 — sigue dentro* | Test verde. **Afirma el MISMO `id` y el MISMO `openedAt`** (no «hay un episodio»), más `closedAt` null, `opened`/`closed` vacíos y exactamente un aviso de entrada para ese `id` | ✅ |
| CA-6 | — (sin código nuevo: rama «fuera && con episodio → cierra») | `tests/spec044-continuidad-episodio.test.ts` › *CA-6: caso 2 — el cambio deja el precio fuera* | Test verde. Mismo `id` de episodio, `closedAt` = `asOf` del ciclo, cero avisos nuevos de entrada, y el aviso previo comprobado por `payload` y `readAt` | ✅ |
| CA-7 | — (sin código nuevo: rama «dentro && sin episodio → abre») | `tests/spec044-continuidad-episodio.test.ts` › *CA-7: caso 3 — estaba fuera y el cambio lo mete dentro* | Test verde. Parte de cero episodios, abre uno nuevo, exactamente un aviso, con `price`/`asOf` de la cotización que lo originó (D-2) y un envío real observado en `FakeNotificationSender` | ✅ |
| CA-8 | `src/app/vigiladas/actions.ts` (`editZonesAction`) | `tests/spec044-accion-edicion.test.ts` › *CA-8* (3 casos: instantánea de las dos tablas + `FakeNotificationSender` sin envíos; la action no importa motor/notificador; el cuerpo del servicio solo toca `watchedSymbols`) | Test verde. La instantánea JSON de `zone_triggers`+`notifications` es real y el control positivo (la fila SÍ cambia) descarta el falso verde. El «ni envía nada» queda probado por **construcción**: `actions.ts` no contiene `lib/triggers`/`evaluateTriggers`/`notifyCycle`/`NotificationSender`/`zoneTriggers`/`notifications`, y el cuerpo de `updateWatchedZones` es un solo `.update(watchedSymbols)` sin `insert`/`delete`. Verificado a mano con `grep` sobre las dos fuentes. **Reserva anotada**: el `expect(sender.sent).toHaveLength(0)` es decorativo — el fake se instancia y nunca se conecta a nada, así que pasaría igual con un envío por otro sender; la prueba que sostiene el CA es la estructural | ✅ |
| CA-9 | — (orden de `runRefreshCycle`: ingesta → disparos → avisos) | `tests/spec044-continuidad-episodio.test.ts` › *CA-9: el orden del ciclo protege el digest* | Test verde. Control positivo previo (el digest del primer ciclo SÍ lista las dos) y luego el digest del segundo lista solo la testigo | ✅ |
| CA-10 | — | `tests/spec044-continuidad-episodio.test.ts` › *CA-10: editar dos veces antes del ciclo* (2 casos: acaba fuera / acaba dentro) | Test verde. Las dos direcciones: el ida y vuelta que acaba fuera deja 0 episodios / 0 avisos / 0 envíos; el que acaba dentro abre exactamente uno | ✅ |
| CA-11 | `src/app/vigiladas/actions.ts` (`readZones` → `readDecimalField`, SPEC-030) | `tests/spec044-edicion-zonas.test.ts` › *CA-11: coma decimal, la misma puerta que el alta* | Test verde. `12,5`→`12.5` y `1 234,56`→`1234.56` comprobados en BD; `1,234` rechazado por ambiguo, todo a través de `readDecimalField` | ✅ |
| CA-12 | `src/lib/watchlist/service.ts` (`validatePair` antes del `UPDATE`) | `tests/spec044-edicion-zonas.test.ts` › *CA-12: min > max se rechaza* (2 casos, incluido «todo o nada») | Test verde. El caso «todo o nada» manda una compra válida y nueva junto a una venta inválida y comprueba que **tampoco** se guardó la buena | ✅ |
| CA-13 | `src/lib/watchlist/service.ts` (`validatePair`) | `tests/spec044-edicion-zonas.test.ts` › *CA-13: par incompleto rechazado* (2 casos: incompleta / vacía) | Test verde. Las dos zonas y las dos direcciones del par; y el contraste con «vaciar ambos», que sí se acepta | ✅ |
| CA-14 | `src/app/vigiladas/actions.ts` (`toFormError`, normalización fuera del `try`) | `tests/spec044-accion-edicion.test.ts` › *CA-14* (4 casos: `abc` sin traza, base caída con traza, los dos mensajes distintos, `InvalidZoneError` sin traza) | Test verde. Las dos direcciones afirmadas: dato → nombra campo (`Zona de compra (mínimo)`), valor (`abc`) y ejemplo (`12,5`), sin `console.error`; infra → `INFRA_ERROR_TEXT` **con** traza; y un tercer caso que afirma que los dos mensajes difieren | ✅ |
| CA-15 | `src/lib/watchlist/service.ts` + `src/app/vigiladas/actions.ts` (una `validatePair`, un `readZones`) | `tests/spec044-edicion-zonas.test.ts` › *CA-15* (mensajes idénticos alta/edición) **y** `tests/spec044-accion-edicion.test.ts` › *CA-15* (4 casos de inspección de fuente, incluido `userId` dentro del `WHERE`) | Test verde, **y comprobado a mano en todo `src/`**: `grep -rn validatePair src/` da UNA declaración (`service.ts:34`) usada por `watchSymbol` (l. 59-60) y por `updateWatchedZones` (l. 143-144); `readDecimalField` tiene un único punto de definición y `readZones` una única declaración usada por las dos actions; no hay segundo normalizador (`replace(/,/g` solo aparece en `ing-xls-reader.ts`, ajeno). Los mensajes se comparan además en ejecución, no solo por inspección | ✅ |
| CA-16 | `src/lib/watchlist/service.ts` (identifica por `id`, no acepta símbolo) | `tests/spec044-edicion-zonas.test.ts` › *CA-16: identifica por id de vigilada, no por ticker* | Test verde. `SAN`@`BMEX` y `SAN`@`XNYS` con `symbolId` distintos comprobados; cambia solo la señalada. La firma de `updateWatchedZones` no acepta símbolo y `editZonesAction` no llama a `readSymbolSelection` (afirmado en `spec044-frontera.test.ts`) | ✅ |
| CA-17 | `src/lib/watchlist/service.ts` (`and(eq(id), eq(userId))` en el `UPDATE`) | `tests/spec044-edicion-zonas.test.ts` › *CA-17: un id ajeno no edita nada* + `tests/spec044-accion-edicion.test.ts` › *el `userId` viaja DENTRO del WHERE* | Test verde. **Los dos casos son indistinguibles y se afirma la igualdad entre ellos**, no solo cada uno por separado (`expect(conIdAjeno).toEqual(conIdInexistente)`, ambos `null`); además la fila de B y su episodio quedan intactos. `userId` DENTRO del `WHERE` confirmado leyendo el fuente (`.where(and(eq(watchedSymbols.id, id), eq(watchedSymbols.userId, userId)))`) y fijado por un test de regex sobre el cuerpo de la función. En la action las dos rutas devuelven `{ ok: true }`, igual que el éxito: tampoco ahí se revela nada | ✅ |
| CA-18 | `src/lib/watchlist/service.ts` (guarda `UUID`, devuelve `null`) | `tests/spec044-edicion-zonas.test.ts` › *CA-18: id ausente o malformado no es una excepción* | Test verde. Vacío, no-uuid e inyección SQL: `null` sin lanzar y lista intacta | ✅ |
| CA-19 | `src/app/vigiladas/watched-table.tsx` + `watch-form.tsx` | `tests/e2e/vigiladas-editar.spec.ts` › *CA-19: el control por fila abre un formulario con los valores actuales* | e2e verde (ejecutado por el verificador). Los cuatro campos precargados (`12`/`14`/`20`/`22`), el activo identificado (`Z5EDIT` · `BME`), cero `.symbol-search-input` en el panel, y una zona sin definir que aparece **vacía**, no `0`. Confirmado también en la captura `ca23-360-abierto.png` | ✅ |
| CA-20 | `src/app/vigiladas/watch-form.tsx` (modo edición) + `src/app/globals.css` (`.editar-vigilada`, sin ancho) | `tests/e2e/vigiladas-editar.spec.ts` › *CA-20* **y** `tests/spec044-frontera.test.ts` › *CA-19/CA-20* (4 casos de inspección) | Verdes. El panel monta `WatchForm` con clase `auth-form` y dos `.zona-campos`; `max-width` computado = `none`; ancho del panel = ancho del form (±1 px); vive FUERA de `.table-scroll` (comprobado con `closest()` en el navegador). Los cuatro `name="buyMin|buyMax|sellMin|sellMax"` se declaran una sola vez y solo en `watch-form.tsx` | ✅ |
| CA-21 | `src/app/vigiladas/watch-form.tsx` (campos controlados, `onGuardado`) | `tests/e2e/vigiladas-editar.spec.ts` › *CA-21: guardar cierra…* y *CA-21: un error de validación deja el panel abierto…* | e2e verde. Guardar: panel a 0, tabla con `30 – 40`, clase de fila de `zone-buy` a `zone-out` (estado recalculado en render, SPEC-007 CA-1) y la testigo intacta. Error: panel visible, mensaje `Zona de compra`, y **lo escrito conservado** (`40`/`10`, no los valores guardados) | ✅ |
| CA-22 | `src/app/vigiladas/watched-table.tsx` (`CADENCIA_LINEA`) | `tests/e2e/vigiladas-editar.spec.ts` › *CA-22* **y** `tests/spec044-frontera.test.ts` › *CA-22* | Verdes. El escenario del e2e es exactamente el del CA (una edición que mete el precio 99 en una zona en la que no estaba) y la línea `edicion-cadencia` se afirma con `toHaveText(CADENCIA_LINEA)` — la constante importada, no una copia. `grep` confirma que es la misma que usan `src/app/page.tsx` y el estado vacío de `/vigiladas`. Que se muestre también sin condicionar al cambio de estado de zona es un superconjunto del CA, no un incumplimiento | ✅ |
| CA-23 | `src/app/globals.css` (`.fila-acciones`, `.editar-vigilada`); panel FUERA de `.table-scroll` | `tests/e2e/vigiladas-editar.spec.ts` › *CA-23: M1, M2, M3 y alcance de los controles a los ocho anchos* (cerrado **y** abierto) | e2e verde, **reejecutado por el verificador y reproducido byte a byte**. 16 estados = 8 anchos × {cerrado, abierto}, con M1 = 0 violaciones en todos. El estado abierto es real y no una etiqueta: mide 58 elementos frente a 43 (111 vs 96 a 1280 px) y `abrirEdicion` espera a que el form sea visible. M2 desborde 0 en los dieciséis; M3 sin palabras partidas; alcance de los dos controles de fila con `.table-scroll` a tope. Las medidas se importan de `tests/e2e/geometria.ts` (ADR-026 §1), sin holguras locales | ✅ |
| CA-24 | `src/app/vigiladas/watched-table.tsx` (estado por `id`, no por posición) | `tests/e2e/vigiladas-editar.spec.ts` › *CA-24: reordenar y editar…* y *CA-24: el estado vacío…* **y** `tests/spec044-frontera.test.ts` › *CA-24* | Verdes. Reordenado por Estado desc (orden invertido comprobado), se edita la fila pulsada y la testigo no se mueve. **Salvedad**: de los siete elementos que el CA enumera se afirman cinco (color `zone-<state>`, etiqueta de estado, tipo, mercado, nombre); **no** se afirman el motivo de SPEC-016 (`fail-reason`) ni la marca «sin refrescar» de SPEC-043 (`sin-refrescar`) — el escenario siembra cotizaciones frescas y ninguno de los dos aparece. Aceptada: el diff no toca esas celdas (`watched-table.tsx` l. 190 y 211 intactas) y sus propias guardias e2e pasan en esta rama | ⚠️ |
| CA-25 | — (nada de SPEC-003/005/006/007 se tocó) | Suite completa: `npm test` **96 ficheros / 1441 tests** verdes (baseline en `main`: 92 / 1400, ninguna aserción reescrita) y `npx playwright test` **243 verdes** (antes 235) | Reejecutado por el verificador: `npm test` → **96 ficheros / 1441 tests**, exit 0. `npx playwright test` → **243 passed**, exit 0. **Sin reescribir ni una aserción, comprobado y no aceptado de palabra**: `git diff --name-status origin/main HEAD -- tests/` da cinco ficheros **A** (añadidos) y ninguno **M**; `git diff origin/main HEAD -- tests/ \| grep '^-'` no devuelve **ni una línea borrada o cambiada**. Y `git diff --stat origin/main HEAD -- src/db/ drizzle/ src/lib/triggers/ src/lib/notifications/` sale vacío: ni esquema, ni migración, ni motor | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN** — 2026-08-22, `sdd-verificador`. 24 CA en ✅ y 1 en ⚠️ justificada y aceptada
(CA-24). Verificación adversarial sobre artefactos: no se leyó el informe del implementador
y ningún CA se dio por bueno sin evidencia propia.

### Gates, reejecutados por el verificador

```
npm test               → 96 ficheros / 1441 tests passed          exit 0
npm run typecheck      → sin salida                               exit 0
npm run lint           → sin salida (--max-warnings=0)            exit 0
npm run db:scan        → 11 migraciones, 2 destructivas, ambas con waiver
npm run version:check  → «La version sube de 0.2.1 a 0.3.0» (base origin/main)
npx playwright test    → 243 passed (1.7m)                        exit 0
```

Entorno: Node v26.4.0 con `.nvmrc` pidiendo 24. No se observó ni un síntoma atribuible al
desajuste; los seis gates salen limpios y la geometría se reprodujo exacta.

### Lo que se comprobó a mano, más allá de «el test está verde»

1. **Frontera del cambio.** `git diff --stat origin/main HEAD` sobre `src/db/`, `drizzle/`,
   `src/lib/triggers/` y `src/lib/notifications/` sale **vacío**. Solo cinco ficheros de
   `src/` tocados: `globals.css`, `vigiladas/actions.ts`, `watch-form.tsx`,
   `watched-table.tsx`, `watchlist/service.ts`. La spec no llevaba migración y no la lleva;
   ADR-028 anticipaba que el motor no debía cambiar y no cambia.
2. **CE-5 sin trampa (CA-25).** Cinco ficheros de test **añadidos**, cero modificados. El
   diff de `tests/` no tiene **ni una línea borrada o cambiada**: la no-regresión no se
   compró aflojando aserciones viejas.
3. **CA-4 compara de verdad las dos rutas**, en el mismo `it`, con las dos mitades
   afirmadas — incluido el aviso que queda huérfano por la cascada de ADR-017.
4. **CA-5 afirma el mismo `id` y el mismo `openedAt`**, no «hay un episodio».
5. **CA-15 comprobado sobre todo `src/`, no solo sobre los dos ficheros que el test mira**:
   una sola `validatePair`, un solo `readZones`, un solo `readDecimalField`, y ningún
   normalizador paralelo.
6. **CA-17: los dos casos son indistinguibles y el test lo afirma como igualdad**, no como
   dos aserciones sueltas. `userId` dentro del `WHERE`, leído en el fuente.
7. **CA-23 reproducido**: se reejecutó la guardia y `_qa/SPEC-044/medidas-ca23.txt` salió
   idéntico al commiteado. El estado «abierto» es real (58 elementos medidos frente a 43;
   111 frente a 96 a 1280 px) y se ve en las capturas.

### Salvedad aceptada

**CA-24 (⚠️).** La guardia de SPEC-044 afirma cinco de los siete elementos que el CA
enumera; quedan sin afirmar el motivo de SPEC-016 y la marca «sin refrescar» de SPEC-043,
porque el escenario siembra cotizaciones frescas y ninguno de los dos se renderiza. Se
acepta porque el riesgo que el CA cubre está cubierto igual: el diff no toca esas celdas y
las guardias propias de SPEC-016 y SPEC-043 pasan en esta rama. Si algún día el escenario
del e2e crece, es el sitio natural donde añadirlo.

### Observaciones que no bloquean

- **CA-8**: `expect(sender.sent).toHaveLength(0)` es decorativo — el `FakeNotificationSender`
  se instancia y nunca se conecta a nada, así que la aserción pasaría igual con un envío por
  otro sender. El CA se sostiene igualmente, y con evidencia más fuerte, sobre la prueba
  estructural (la action no alcanza el notificador ni el motor; el cuerpo del servicio es un
  único `UPDATE`). Conviene no confundir esa línea con la prueba real si algún día se toca.
- La evidencia visual commiteada se generó con un build en `cd68e3d` (se ve en el pie de las
  capturas). Es válida: los dos commits posteriores son de tests y de documentación, y la
  reejecución desde `HEAD` da las mismas medidas.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-044/. Informe HTML opcional: _qa/SPEC-044/informe.html -->
Generada por `tests/e2e/vigiladas-editar.spec.ts` (CA-23), en `_qa/SPEC-044/`:

| CA | Evidencia |
|---|---|
| CA-23 | `ca23-<ancho>-cerrado.png` y `ca23-<ancho>-abierto.png` para 360, 390, 640, 700, 730, 760, 800 y 1280 |
| CA-23 | `medidas-ca23.txt` — M1: **0 violaciones** sobre 43 elementos (panel cerrado) y **58** (abierto) a los siete anchos móviles, 96/111 a 1280; M2: desborde **0** en los dieciséis estados |

**Verificado por `sdd-verificador` (2026-08-22).** La guardia se reejecutó desde `HEAD`
(`npm run build` + `npx playwright test`) y `medidas-ca23.txt` se regeneró **idéntico** al
commiteado: mismas dieciséis líneas, mismos recuentos. Las dieciséis capturas existen y
cubren de verdad los dos estados; revisada `ca23-360-abierto.png`, que es el ancho crítico:
el panel «Editar zonas» se ve entero con los cuatro campos precargados (12/14, 20/22), el
activo identificado como `Z5EDIT · BME`, sin buscador, y con los controles *Editar* y
*Quitar* apilados en la fila — apilar, no esconder, que es lo que pedía la nota 5 del gate.
Tras la comprobación se restauró `_qa/` con `git checkout` para dejar el árbol limpio.

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
