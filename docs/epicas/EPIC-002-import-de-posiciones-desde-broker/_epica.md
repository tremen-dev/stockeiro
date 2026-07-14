---
id: EPIC-002
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
---
# EPIC-002 — Import de posiciones desde broker

## Objetivo
Permitir que un inversor **siembre su cartera real** en Stockeiro subiendo el
extracto de movimientos que exporta su bróker, en lugar de teclear a mano cientos
de transacciones históricas. Hoy la cartera (SPEC-002) solo se alimenta con alta
manual: para alguien con años de operativa, reconstruir su histórico es tan
costoso y propenso a errores que, en la práctica, no lo hará —y sin cartera real,
la promesa del producto (P/L al día, vigilancia útil sobre lo que de verdad
posee) no llega a materializarse.

Esta épica cubre el camino **fichero de bróker → transacciones en la cartera del
usuario**: leer el extracto, resolver cada valor a un símbolo canónico
(apoyándose en ADR-007 y SPEC-008), registrar compras y ventas con su coste real
en EUR, y hacerlo de forma **repetible sin duplicar** (re-importar el mismo o un
export más reciente no crea transacciones repetidas).

Por qué ahora: EPIC-001 ya entregó el núcleo (cartera, P/L, vigilancia, avisos) y
está `hecho`. El cuello de botella para que un usuario real —empezando por el
propio titular del extracto de ejemplo— use la app con datos verdaderos es la
carga inicial. El import es la palanca de adopción natural sobre esa base.

Material real de referencia: `examples/historico.xls` — export de ING
"Movimientos de la Cartera" (JasperReports), **250 operaciones COMPRA/VENTA**,
**52 valores**, **7 mercados** (M.CONTINUO, NASDAQ, NYSE, XETRA, ESTOCOLMO, BOLSA
PARIS, BOLSA AMSTERDAM), rango **2018–2026**. Es la fuente que fija el alcance de
v1; el modelo de dominio lo custodian **sdd-cartera** (coste/comisiones/P-L) y
**sdd-mercados** (identidad de símbolo, MIC, divisas).

## Criterios de éxito
Medibles. La épica cumple su promesa cuando:

- **CE-1 (Carga sin teclear).** Un usuario reconstruye su cartera histórica
  subiendo el extracto del bróker, sin introducir manualmente las transacciones.
  Objetivo: las **250 operaciones** del fichero de ejemplo se registran a partir
  del fichero, no a mano.
- **CE-2 (Coste fiel en EUR).** Cada transacción importada toma como coste/ingreso
  el **IMPORTE TOTAL (€) neto** del extracto (comisiones ya incorporadas: compra =
  base + gastos, venta = base − gastos); el precio en divisa origen es informativo.
  El **P/L de la cartera tras el import cuadra** con lo que refleja el extracto, sin
  hojas de cálculo externas. (Modelo: ADR-003 / sdd-cartera.)
- **CE-3 (Identidad resuelta, con el usuario al mando).** Cada valor del extracto
  se asocia a un símbolo canónico (ticker + MIC, ADR-007). Cuando el nombre es
  ambiguo o cambió por un evento corporativo (p.ej. PharmaMar: contrasplit 12:1 +
  renombrado), la app **pide confirmación al usuario** para fusionar o separar; no
  inventa la identidad ni re-escala cantidades/precios por el evento. Objetivo:
  0 transacciones asignadas a un símbolo equivocado sin que el usuario lo haya
  confirmado.
- **CE-4 (Idempotencia).** Re-importar el mismo extracto —o uno más reciente que
  solape periodos— **no duplica** transacciones ya registradas: las operaciones se
  identifican por una **clave derivada** de sus campos (no hay ID de operación en el
  export). Objetivo: importar dos veces el mismo fichero deja la cartera idéntica a
  importarlo una vez.
- **CE-5 (Aislamiento multiusuario).** El import escribe **solo** en la cartera del
  usuario autenticado que sube el fichero; ningún dato se cruza entre usuarios
  (coherente con CE-4 de EPIC-001 / SPEC-001).

## Alcance
- **Dentro (aparcado a propósito lo de "Fuera"):**
  - Subida de un fichero de extracto de bróker por un usuario autenticado y su
    procesamiento hasta transacciones en su cartera.
  - Formato de v1: **export de ING "Movimientos de la Cartera"** (`.xls`), tal como
    `examples/historico.xls`. Operaciones **COMPRA / VENTA**.
  - Lectura robusta del fichero real: encoding cp1252/latin-1, cabecera de
    metadatos (cuenta, titular, fecha), columnas FECHA · OPERACIÓN · VALOR ·
    MERCADO · TÍTULOS · PRECIO (divisa origen) · IMPORTE TOTAL (€).
  - **Coste en EUR neto** como fuente de verdad (CE-2).
  - **Resolución de identidad** nombre-bróker → símbolo canónico (ADR-007), con
    **fusión/separación confirmada por el usuario** en los casos ambiguos (CE-3),
    reutilizando la búsqueda de símbolos (SPEC-008).
  - Mapeo de **etiquetas de mercado ING → MIC** (dominio sdd-mercados).
  - **Idempotencia** por clave derivada de la operación (CE-4).
  - Manejo explícito de valores **no resueltos**: quedan pendientes/visibles para
    que el usuario actúe, sin bloquear el resto del import.
- **Fuera (aparcado a propósito, no por descuido):**
  - **Ajuste por eventos corporativos**: la app NO re-escala cantidades ni precios a
    través de splits/contrasplits ni fusiona identidades automáticamente; el usuario
    decide (CE-3). El ajuste automático necesitaría una fuente de eventos fiable —
    futura, si se valida la necesidad.
  - **Otros brókers y otros formatos** (CSV, PDF, API): v1 es solo el `.xls` de ING;
    generalizar el lector es evolución posterior.
  - **Operaciones distintas de COMPRA/VENTA**: dividendos, traspasos, ampliaciones,
    comisiones sueltas, retenciones fiscales — el extracto de ejemplo no las trae y
    quedan fuera de v1.
  - **Conciliación de saldos/tesorería** y **fiscalidad** (plusvalías, retenciones):
    fuera, como en EPIC-001.
  - **Descomponer comisión y tipo de cambio** en valores extranjeros: el extracto no
    los da por separado (solo importe EUR + precio origen); v1 no los reconstruye.
  - **Import automático vía conexión con el bróker** (sin fichero): la app no se
    conecta a la cuenta real (coherente con la visión); v1 es carga de fichero.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

## Riesgos
- **R-1 (Identidad de símbolo).** El extracto no trae ISIN ni ticker, solo nombre
  visible + mercado, y los nombres colisionan por eventos corporativos
  (PharmaMar/PHARMA MAR, D.FELGUERA/DURO FELGUERA) o se repiten entre mercados. Una
  resolución errónea corrompe el P/L. Mitigación de producto: el usuario confirma
  los ambiguos (CE-3); el mecanismo técnico es ADR de sdd-arquitecto apoyado en
  ADR-007 y SPEC-008.
- **R-2 (Clave de idempotencia).** Sin ID de operación, la clave derivada
  (fecha+operación+valor+títulos+precio+importe u otra combinación) podría colisionar
  en operaciones legítimamente idénticas el mismo día, o no reconocer una repetida si
  el bróker cambia el formato. Debe cerrarse su definición y sus falsos positivos/negativos
  en spec (afecta a CE-4).
- **R-3 (Formato del export).** El `.xls` de ING (encoding cp1252, layout de
  JasperReports, etiquetas de mercado propias) puede variar entre versiones del
  informe o entre idiomas; el lector debe fallar de forma legible, no corromper datos.
- **R-4 (Coste vs. precio en extranjero).** En mercados no-euro, importe EUR y precio
  origen no permiten separar comisión de FX; tomar el importe EUR como verdad (CE-2)
  es correcto para el coste, pero el "precio medio en divisa" mostrado será aproximado.
  Debe declararse para no confundir al usuario. Dominio: sdd-cartera / sdd-mercados.
- **R-5 (Confianza en datos reales).** El usuario sube su histórico financiero real;
  un import que duplica, pierde o malasigna operaciones destruye la confianza más que
  no tener import. Exige validación previa (previsualización antes de confirmar) y
  aislamiento estricto (CE-5).

## Desglose orientativo en specs (propuesta, NO autoritativa)
> El desglose real y su secuencia son competencia de **sdd-arquitecto**. Esto es
> solo una hipótesis de trabajo para dimensionar la épica.

| # | Spec candidata | Idea |
|---|---|---|
| 1 | Lectura del extracto ING | Parsear el `.xls` (encoding, metadatos, filas COMPRA/VENTA) a un modelo intermedio; fallar legible. |
| 2 | Resolución de identidad + fusión | Nombre-bróker → símbolo canónico (ADR-007/SPEC-008); UI de confirmación para ambiguos y eventos corporativos. |
| 3 | Registro idempotente en cartera | Alta de transacciones con coste EUR neto (ADR-003) y clave derivada anti-duplicado; previsualización antes de confirmar. |
