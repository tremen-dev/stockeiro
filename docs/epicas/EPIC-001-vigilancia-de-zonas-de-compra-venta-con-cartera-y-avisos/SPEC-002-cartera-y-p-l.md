---
id: SPEC-002
tipo: spec
epica: EPIC-001
estado: hecho
aprobada-por: humano
historial:
  - {estado: borrador, fecha: 2026-07-13, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-13, por: humano}
  - {estado: en-progreso, fecha: 2026-07-13, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-07-13, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-07-13, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-07-13, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-07-13, por: sdd-verificador}
---
# SPEC-002 — Cartera y P/L

## Problema
El usuario necesita ver su cartera al día sin hojas de cálculo (CE-3): por cada
acción, cuánto invirtió, cuánto tiene y cuánto gana o pierde —tanto lo **actual**
(posición abierta) como lo **realizado** (tras vender)—. Hoy no hay dónde
registrar sus operaciones ni cálculo de P/L. Esta spec entrega la **cartera** como
un **ledger de transacciones** por usuario y el cálculo de P/L, reutilizando el
ancla `userId` y el aislamiento de SPEC-001. Reglas: **RN-01, RN-04..RN-09**;
decisiones **D-6, ADR-002, ADR-003**. Dominio: sdd-cartera.

## Usuarios / roles afectados
- **Usuario final**: registra compras/ventas/splits/dividendos de sus acciones y
  consulta su cartera y su P/L. Todo ligado a su cuenta (RN-01).

## Criterios de aceptación
Cada CA es verificable con un test. Importes monetarios en `numeric` (sin float),
en la divisa del símbolo (RN-09). "gastos" es un único importe por transacción.

- **CA-1 (Compra abre posición).**
  Dado un usuario autenticado sin posición en un símbolo,
  cuando registra una compra (cantidad, precio, gastos),
  entonces existe una posición con esa cantidad viva y coste base = (precio×cantidad
  + gastos) / cantidad (precio medio con gastos, RN-04).
- **CA-2 (Precio medio ponderado en varias compras).**
  Dada una posición con una compra previa,
  cuando registra una segunda compra a otro precio/gastos,
  entonces la cantidad viva es la suma y el coste base es el **medio ponderado**
  incluyendo los gastos de ambas (RN-04).
- **CA-3 (Venta total → P/L realizado y cierre).**
  Dada una posición abierta,
  cuando vende toda la cantidad (precio de venta, gastos),
  entonces la cantidad viva queda a 0 (posición cerrada) y el P/L realizado =
  (precioVenta×cantidad − gastos) − costeBase×cantidad (RN-05).
- **CA-4 (Venta parcial).**
  Dada una posición abierta con cantidad Q,
  cuando vende q < Q,
  entonces la cantidad viva pasa a Q−q, el coste base por acción NO cambia, y el
  P/L realizado suma (precioVenta×q − gastos) − costeBase×q (RN-05).
- **CA-5 (No sobreventa, RN-08).**
  Dada una posición con cantidad viva Q,
  cuando intenta vender más de Q,
  entonces la operación se rechaza con error y no altera la posición.
- **CA-6 (P/L actual con y sin precio, RN-06/D-6).**
  Dada una posición abierta con coste base y cantidad viva,
  cuando se calcula el P/L actual con un precio de mercado dado,
  entonces vale (precio − costeBase) × cantidadViva; y cuando NO hay precio
  disponible, el P/L actual es "sin dato" (no 0) y nunca se suma al realizado.
- **CA-7 (Split, RN-07).**
  Dada una posición abierta,
  cuando se registra un split de ratio r,
  entonces la cantidad viva se multiplica por r y el coste base se divide por r,
  de modo que el valor de la posición y su P/L no cambian.
- **CA-8 (Dividendo, RN-05).**
  Dada una posición,
  cuando se registra un dividendo por un importe,
  entonces ese importe se suma al P/L realizado como ingreso, sin alterar el coste
  base ni la cantidad viva.
- **CA-9 (Vista agregada distingue actual y realizado, D-6).**
  Dadas varias posiciones de un usuario,
  cuando consulta el resumen de su cartera,
  entonces ve el P/L **realizado** total y el P/L **actual** total (con los precios
  disponibles) como magnitudes SEPARADAS, nunca sumadas en una sola cifra.
- **CA-10 (Aislamiento por usuario, RN-01).**
  Dado el usuario A con posiciones/transacciones y el usuario B autenticado,
  cuando B consulta la cartera o una posición/transacción por id,
  entonces no ve ni puede leer/modificar ningún dato de A (filtrado por `userId`).
- **CA-11 (Símbolo compartido, ADR-002).**
  Dado que el usuario A opera el ticker "ITX",
  cuando el usuario B opera el mismo ticker "ITX",
  entonces ambas transacciones referencian el MISMO registro de símbolo (uno por
  ticker, no por usuario).

## Entidades y reglas afectadas
- **`symbol`** (compartido, ADR-002): `id`, `ticker` (único), `currency`. Semilla
  del registro de símbolos; watchlist/ingesta lo extienden.
- **`transaction`** (ledger, ADR-003): `id`, `userId`→user, `symbolId`→symbol,
  `type` (buy|sell|split|dividend), `occurredOn`, y según tipo: `quantity`,
  `price`, `gastos`, `ratio`, `amount`. Inmutable (correcciones = nuevo evento).
- **Posición** (derivada, no persistida): cantidad viva, coste base (RN-04),
  abierta/cerrada, P/L realizado acumulado (RN-05) y P/L actual (RN-06, requiere
  precio).
- Reglas: **RN-01, RN-04, RN-05, RN-06, RN-07, RN-08, RN-09**. Decisiones: **D-6,
  ADR-001, ADR-002, ADR-003**. Términos: `docs/fundacion/dominio.md`.

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Fetch de cotización en vivo** (P/L actual): la fuente del precio de mercado la
  aporta la spec de Ingesta; aquí el P/L actual es función que recibe el precio.
- **Detección automática de splits/dividendos**: en v1 se registran a mano; su
  automatización depende de datos de mercado (sdd-mercados/ingesta).
- **Conversión de divisa / multi-moneda avanzada** (FOUNDATION "Fuera"); el coste
  de cambio va dentro de `gastos` (RN-09).
- **Desglose de `gastos`** por tipo (broker/impuestos/FX): un único importe en v1.
- **Fiscalidad / informes fiscales**; **FIFO/LIFO** (se usa precio medio, RN-04).
- **Editar/borrar transacciones**: el ledger es inmutable; corrección = evento
  compensatorio. (Un flujo de edición se tratará en spec propia si se necesita.)
- **UI final de cartera con estilo tremen-ds**: esta spec cubre modelo + cálculo +
  su exposición mínima; el pulido de la vista puede ir con la spec de UI.

## Notas para el gate humano
Resoluciones del gate (aprobado 2026-07-13 por el humano): los 3 puntos ACEPTADOS
tal cual — (1) dividendos como ingreso realizado; (2) P/L actual "—" hasta la
Ingesta; (3) tabla `symbol` compartida ya en esta spec.

- **Dividendos como ingreso realizado** (RN-05, dictamen sdd-cartera): el dividendo
  suma al P/L realizado y NO reduce el coste base (no se modela "return of
  capital"). ¿Lo aceptas para v1?
- **`gastos` unificado** (broker + impuestos de compra + FX en un solo importe por
  transacción), por tu decisión. Se puede desglosar a futuro.
- **P/L actual = "—" hasta la Ingesta**: CE-3 queda parcialmente visible (realizado
  completo; actual solo cuando haya precio). ¿Conforme con esta secuencia?
- **Precisión monetaria**: importes en `numeric` y redondeo explícito; sdd-cartera
  avisa de que un signo/redondeo mal falsea la decisión de venta. El verificador
  debe probar signos y redondeo.
- **Símbolo compartido ya en esta spec** (ADR-002): introducimos la tabla `symbol`
  mínima ahora para no reescribir; el registro completo llega con watchlist/ingesta.
