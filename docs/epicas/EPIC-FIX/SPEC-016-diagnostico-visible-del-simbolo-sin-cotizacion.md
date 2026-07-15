---
id: SPEC-016
tipo: spec
epica: EPIC-FIX
estado: en-progreso
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-15, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-07-15, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-07-15, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-07-15, por: sdd-verificador}
---
# SPEC-016 — Diagnostico visible del simbolo sin cotizacion

## Problema
El defecto de cobertura (EPIC-FIX) tardó semanas en detectarse **porque la app no lo
dijo**. El ciclo respondía `200`, `refreshQuotes` marcaba los símbolos españoles como
`skipped` (CA-6 de SPEC-004: resiliencia por símbolo, correcta por diseño) y **el motivo
que devolvía el proveedor se descartaba**. El usuario solo veía *"sin cotización"* en
`/vigiladas` y `"—"` en `/cartera` — indistinguible de *"el ciclo aún no ha corrido"*.

Es el **mismo fallo silencioso** que SPEC-008 vino a eliminar (tickers tecleados que no
cotizaban), reaparecido un nivel más abajo. Esta spec cumple **CE-F2 de EPIC-FIX**:
**ningún símbolo se descarta sin traza visible**. Implementa el punto 6 de **ADR-012**
(el puerto deja de tragarse el motivo). Reglas: **RN-06** (sin precio NO se calcula P/L
—esto no cambia—), **RN-01/RN-03**, **D-2**. No cambia el cálculo de P/L ni la
resiliencia: solo hace **observable** lo que ya ocurría.

## Usuarios / roles afectados
- **Usuario final**: cuando una acción no se puede cotizar, ve **que pasa y por qué**
  (p. ej. "el proveedor no cubre este mercado", "símbolo desconocido", "proveedor no
  disponible"), en vez de un "sin dato" mudo. Puede actuar: cambiar el símbolo, quitarlo
  de vigiladas, o saber que no es culpa suya.
- **Sistema/operador**: el resultado del ciclo deja de perder información.

## Criterios de aceptación
Cada CA es verificable con un test; los de UI, con Playwright (patrón SPEC-007). Se usa
el **fake** tras `MarketDataProvider` para inyectar los motivos.

- **CA-1 (El motivo se propaga por el puerto — ADR-012).**
  Dado que el proveedor no devuelve precio para un símbolo con un motivo concreto,
  cuando el adaptador responde,
  entonces el motivo **llega al dominio** por el puerto (no se descarta), clasificado en
  categorías estables (p. ej. `mercado_no_cubierto`, `simbolo_desconocido`,
  `proveedor_no_disponible`), no como texto libre del proveedor.
- **CA-2 (Se persiste el último diagnóstico por símbolo).**
  Dado un ciclo en el que un símbolo no se cotiza,
  cuando termina el ciclo,
  entonces queda registrado, **por símbolo**, el motivo y **cuándo** se intentó — de modo
  que la UI pueda mostrarlo sin re-llamar al proveedor.
- **CA-3 (Distinguir "sin datos aún" de "no se puede cotizar").**
  Dado un símbolo **nunca cotizado porque el ciclo aún no ha corrido** y otro **que el
  proveedor rechaza**,
  cuando se consulta su estado,
  entonces son **estados distintos y distinguibles** — no ambos "sin dato".
- **CA-4 (Visible en `/vigiladas`).**
  Dada una acción vigilada cuyo símbolo no se puede cotizar,
  cuando el usuario abre `/vigiladas`,
  entonces ve que **no se está vigilando de verdad** y **por qué**, junto a su estado de
  zona (que seguirá siendo "sin dato", RN-11/SPEC-007).
- **CA-5 (Visible en `/cartera`).**
  Dada una posición cuyo símbolo no se puede cotizar,
  cuando el usuario abre `/cartera`,
  entonces el P/L actual sigue siendo **"—"** (RN-06, no se inventa) **pero acompañado
  del motivo**, en vez de un guion mudo.
- **CA-6 (RN-06 intacto).**
  Dado un símbolo sin precio,
  cuando se calcula el P/L,
  entonces **NO se calcula el actual** (se muestra "sin dato") y **nunca** se mezcla con
  el realizado (D-6). Esta spec **no** cambia el cálculo.
- **CA-7 (La resiliencia no se rompe — CA-6 de SPEC-004).**
  Dado un símbolo que falla,
  cuando se ejecuta el ciclo,
  entonces los demás **se actualizan igual** y el ciclo termina correctamente; el
  diagnóstico es **información añadida**, no un motivo de aborto.
- **CA-8 (El diagnóstico se limpia al resolverse).**
  Dado un símbolo con diagnóstico de fallo,
  cuando un ciclo posterior **sí** obtiene su precio,
  entonces el diagnóstico desaparece y la UI vuelve a la normalidad (no queda un aviso
  fantasma).
- **CA-9 (Aislamiento — RN-01/RN-03).**
  Dado el diagnóstico,
  cuando lo consulta un usuario,
  entonces solo ve el de **los símbolos que él referencia**, bajo sesión válida.

## Entidades y reglas afectadas
- **Puerto `MarketDataProvider`** (ADR-002, contrato precisado por **ADR-012**): además
  de las cotizaciones resueltas, informa de los **no resueltos con su motivo
  clasificado**. Afecta al adaptador real, al fake y al servicio de refresco
  (`RefreshResult.skipped[]` deja de ser una lista de tickers pelada).
- **Diagnóstico por símbolo** (nuevo): último motivo y fecha del intento fallido, por
  símbolo (compartido, como `quotes` — el motivo no depende del usuario). La forma
  concreta (columna en `quotes`, tabla propia) la decide el implementador; el CA exige
  el comportamiento, no el esquema.
- **UI**: `/vigiladas` (SPEC-007, estado de zona) y `/cartera` (SPEC-002) muestran el
  motivo junto al "sin dato". Design system `tremen-ds`.
- Reglas: **RN-06** (sin precio → sin P/L; **no cambia**), **RN-11** (estado de zona "sin
  dato"), **RN-01/RN-03**, **D-2/D-6**. Decisiones: **ADR-012** (punto 6), **ADR-002**
  (puerto), **ADR-004** (ciclo).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Arreglar la cobertura**: eso es **SPEC-015**. Esta spec hace visible el fallo, no lo
  cura — y sigue siendo necesaria **después** de SPEC-015 (siempre habrá símbolos que un
  proveedor no cubra: valores deslistados, ilíquidos…).
- **Alerting al operador** (email/log del resultado del ciclo): es aviso *al operador*,
  no *al usuario*; queda en el roadmap como mejora (EPIC-MEJORA).
- **Reintentos/backoff** del proveedor: mejora, no defecto.
- **Histórico de diagnósticos**: solo el último por símbolo, como `quotes` (ADR-004).
- **Sugerir un símbolo alternativo** cuando el mercado no está cubierto: útil, pero es
  funcionalidad nueva → su épica.

## Notas para el gate humano
1. **Por qué es criterio de éxito y no una mejora**: este defecto lleva desde el
   despliegue sin detectarse **precisamente porque la app callaba**. Si SPEC-015 arregla
   la cobertura pero el silencio sigue, el próximo fallo (un valor deslistado, un cambio
   de plan del proveedor) volverá a tardar semanas. Por eso EPIC-FIX lo mete dentro
   (R-F4: un arreglo a medias y otra vez mudo sería peor que el bug).
2. **Motivos clasificados, no texto del proveedor** (CA-1): la UI no debe enseñar
   `"code":403,"message":"...upgrade your plan"`. Se traduce a categorías estables del
   dominio; el texto crudo, si acaso, va al log.
3. **Independiente de SPEC-015**: se puede implementar y verificar por separado (con el
   fake inyectando motivos). Sugerencia de secuencia: **SPEC-015 primero** (restaura la
   promesa, que es lo urgente), **SPEC-016 después**. Pero si prefieres verlo antes en la
   UI, el orden es reversible.
4. **La forma de persistir el diagnóstico la deja abierta la spec** a propósito (columna
   vs tabla): es decisión de implementación; los CA fijan el comportamiento observable.
