---
id: SPEC-013
tipo: spec
epica: EPIC-002
estado: hecho
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-07-14, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-07-14, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-07-14, por: sdd-verificador}
---
# SPEC-013 — Registro idempotente en la cartera

## Problema
Con las operaciones **leídas** (SPEC-011) y **resueltas a símbolo** (SPEC-012), el
último paso es **escribirlas como transacciones** en la cartera del usuario y que
el **P/L cuadre** con el extracto (CE-2), **sin duplicar** al re-importar (CE-4) y
**sin cruzar** datos entre usuarios (CE-5). El modelo ya existe: ledger de
transacciones `buy/sell/split/dividend` con `gastos` unificado (ADR-003). Esta spec
lo **alimenta desde el import**: mapea COMPRA/VENTA a `buy/sell`, fija `price`,
`gastos` y **divisa** según **ADR-011**, aplica la **clave de idempotencia** de
**ADR-010**, y exige **previsualización antes de confirmar** (riesgo R-5). No lee el
fichero (SPEC-011) ni resuelve identidad (SPEC-012).

## Usuarios / roles afectados
- **Usuario final**: revisa una **previsualización** (qué se creará, qué se salta por
  duplicado, qué queda pendiente, qué avisos) y **confirma**; tras ello ve su cartera
  y su P/L al día. Todo bajo su sesión (RN-01/RN-03).
- **Sistema**: escribe en el ledger de forma idempotente y aislada por usuario.

## Criterios de aceptación
Cada CA es verificable con un test (fixtures de operaciones ya resueltas; el ledger
y el P/L se comprueban con la lógica de SPEC-002).

- **CA-1 (Mapeo a transacciones del ledger).**
  Dadas operaciones resueltas,
  cuando se confirma el import,
  entonces cada COMPRA crea un `buy` y cada VENTA un `sell` en `transaction`, con
  `userId`, `symbolId`, `occurredOn`, `quantity = títulos` y `price = precioOrigen`
  (ADR-003).
- **CA-2 (Coste en mercados EUR; el importe cuadra — ADR-011).**
  Dada una operación de un mercado en EUR (p. ej. M.CONTINUO),
  cuando se registra,
  entonces `gastos = |importeEur − price × cantidad|` y la transacción **reproduce el
  `importeEur`** del extracto (RN-04); el P/L de la posición cuadra con el extracto.
- **CA-3 (Divisa nativa + gastos=0 en no-euro — ADR-011).**
  Dada una operación de un mercado no-euro (símbolo en USD/SEK; p. ej. NASDAQ),
  cuando se registra,
  entonces la transacción va en la **divisa nativa del símbolo**, `price =
  precioOrigen`, `gastos = 0`, y el `importeEur` se guarda solo como **metadato**
  (no entra en el coste base). *(Sujeto al ruling del gate sobre ADR-011; si se elige
  la Alternativa B, estas operaciones no se registran y quedan pendientes.)*
- **CA-4 (Idempotencia — ADR-010).**
  Dado el mismo extracto importado **dos veces**,
  cuando se confirma el import las dos veces,
  entonces la cartera queda **idéntica** a importarlo una vez (0 transacciones
  duplicadas); `importKey` es único por `(userId, importKey)`.
- **CA-5 (Export incremental).**
  Dado un extracto más reciente que **solapa** periodos ya importados,
  cuando se importa sobre lo existente,
  entonces se insertan **solo** las operaciones nuevas; las ya registradas se saltan.
- **CA-6 (Idénticas el mismo día — `ordinalIntradía`).**
  Dadas dos operaciones legítimamente **idénticas** el mismo día en el fichero,
  cuando se registran,
  entonces **ambas** quedan (no se colapsan en una), y un re-import **no** las duplica.
- **CA-7 (Previsualización antes de confirmar — R-5).**
  Dadas operaciones resueltas y pendientes,
  cuando el usuario lanza el import,
  entonces ve una **previsualización** (a crear / a saltar por duplicado / pendientes
  / avisos) y **nada se escribe** hasta que **confirma**.
- **CA-8 (Historia incompleta / no sobreventa — RN-08).**
  Dado que el extracto empieza a media serie y una VENTA excede la cantidad viva
  derivable (faltan compras anteriores a la ventana del export),
  cuando se registra,
  entonces el import **avisa** de la incoherencia (posición imposible) en la
  previsualización en vez de crear en silencio una cantidad negativa; el usuario
  decide (p. ej. añadir la compra anterior a mano).
- **CA-9 (Aislamiento por usuario — RN-01).**
  Dado el import,
  cuando lo confirma un usuario,
  entonces **solo** escribe en la cartera de **ese** usuario; ningún dato toca a otro.
- **CA-10 (Pendientes no se escriben).**
  Dadas operaciones de valores sin resolver (SPEC-012),
  cuando se confirma el import,
  entonces **no** se registran: permanecen pendientes y visibles.

## Entidades y reglas afectadas
- **`transaction`** (ledger, ADR-003): gana columna **`importKey`** (nullable; solo
  filas importadas), **única por `(userId, importKey)`** (ADR-010). El alta manual
  la deja `null`. Se guarda además el **`importeEur`** como metadato de las filas
  importadas (ADR-011).
- **Posición y P/L** (derivados, SPEC-002/ADR-003): no cambian su lógica; el import
  solo añade transacciones que la alimentan.
- Reglas: **RN-04** (coste medio incl. gastos), **RN-08** (no sobreventa),
  **RN-09** (divisa única = símbolo), **RN-01/RN-03** (aislamiento/acceso).
  Decisiones: **ADR-003** (ledger), **ADR-010** (idempotencia), **ADR-011**
  (divisa/coste). Términos: `docs/fundacion/dominio.md` (transacción, gastos,
  precio medio, cantidad viva, P/L).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Leer el fichero** (SPEC-011) y **resolver identidad** (SPEC-012).
- **Crear eventos `split`/`dividend`** desde el import: el export no los trae; se
  registran a mano (ADR-003). El import solo **avisa** de posibles splits (SPEC-012).
- **Re-escalar por splits**: ADR-009 (fuera).
- **Reconstruir comisión/FX** en mercados no-euro: ADR-011 (fuera); `gastos=0`.
- **Deshacer/editar** un import ya confirmado: fuera de v1 (el ledger es inmutable;
  correcciones = nuevas transacciones manuales).

## Notas para el gate humano
- **Depende del ruling de ADR-011** (divisa/coste): CA-3 se escribe con la
  **Decisión recomendada** (nativa + `gastos=0` en no-euro). Si eliges la
  **Alternativa B** (solo EUR en v1), CA-3 pasa a "las operaciones no-euro no se
  registran; quedan pendientes".
- **Historia incompleta (CA-8)**: el export es una ventana temporal; puede haber
  ventas sin sus compras previas. v1 **avisa** y no crea posiciones imposibles;
  reconciliar es acción manual del usuario. ¿Conforme?
- **Previsualizar-y-confirmar** es innegociable por confianza (R-5): ningún import
  escribe sin que el usuario vea antes qué va a pasar.
