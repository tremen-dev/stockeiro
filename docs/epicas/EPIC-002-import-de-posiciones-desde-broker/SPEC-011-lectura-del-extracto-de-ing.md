---
id: SPEC-011
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
# SPEC-011 — Lectura del extracto de ING

## Problema
Para sembrar la cartera desde el bróker (EPIC-002, CE-1) el primer paso es **leer
el extracto** de forma fiable. El material real es `examples/historico.xls`: export
de ING "Movimientos de la Cartera" (JasperReports), `.xls` BIFF/OLE2, encoding
**cp1252/latin-1**, con una **cabecera de metadatos** (cuenta, titular, fecha de
exportación), una fila de cabeceras y **250 filas** de operaciones COMPRA/VENTA
sobre 7 mercados. Un parseo descuidado corrompe importes (float), destroza acentos
y el símbolo `€`/`Ñ`, o traga filas de pie/blancos como si fueran operaciones.

Esta spec entrega **solo la lectura**: convierte el fichero en un **modelo
intermedio validado** de operaciones, **sin** resolver símbolos (SPEC-012) ni
escribir en la cartera (SPEC-013). Implementa **ADR-009** (puerto
`BrokerStatementReader`, adaptador ING `.xls`). No interpreta identidad ni coste:
conserva el nombre y el mercado **tal como vienen**.

## Usuarios / roles afectados
- **Usuario final** (indirecto): sube su extracto; esta capa es la que lo entiende.
  El disparo real (subida autenticada) y su orquestación viven en SPEC-012/013.
- **Sistema**: el adaptador de lectura, aislado tras el puerto, que otras piezas
  consumen sin conocer el formato ING.

## Criterios de aceptación
Cada CA es verificable con un test que usa **`examples/historico.xls`** como
fixture (y ficheros mínimos construidos para los casos de error).

- **CA-1 (Parseo de operaciones).**
  Dado el fichero de ejemplo,
  cuando se lee con el puerto `BrokerStatementReader`,
  entonces devuelve **250 operaciones**, cada una con `occurredOn` (fecha),
  `side` (`buy` para COMPRA, `sell` para VENTA), `nombreBroker`, `etiquetaMercado`,
  `cantidad`, `precioOrigen` e `importeEur`.
- **CA-2 (Encoding correcto).**
  Dado que el fichero está en cp1252,
  cuando se leen los textos,
  entonces se decodifican sin *mojibake* (p. ej. la operación se reconoce como
  `COMPRA`/`VENTA` y nombres como `PHARMAMAR` o valores con acento/`Ñ` salen
  íntegros), no como `OPERACI�N`.
- **CA-3 (Metadatos de cabecera).**
  Dado el bloque superior del fichero,
  cuando se lee,
  entonces se extraen **número de cuenta**, **titular** y **fecha de exportación**
  como metadatos del extracto (no como operaciones).
- **CA-4 (Solo COMPRA/VENTA; el resto se ignora).**
  Dadas las filas en blanco, de cabecera o de pie, y cualquier fila cuya operación
  no sea COMPRA ni VENTA,
  cuando se lee,
  entonces **no** se convierten en operaciones y **no** provocan error: solo
  COMPRA/VENTA entran al modelo.
- **CA-5 (Precisión numérica).**
  Dados títulos, precio origen e importe con decimales finos y magnitudes grandes
  (p. ej. `0,0142`, `175270`, `12,7`, `1120,00`),
  cuando se parsean,
  entonces se representan **sin pérdida de precisión** (decimal, no float binario
  con arrastre), aptos para el coste base de la cartera (RN-04).
- **CA-6 (Detrás de puerto, formato desacoplado).**
  Dado el puerto `BrokerStatementReader`,
  cuando el dominio consume una lectura,
  entonces depende del **modelo intermedio** (`ExtractoParseado`), no del `.xls` ni
  de ING; un adaptador distinto (o un fake en tests) produce el mismo modelo.
- **CA-7 (Fallo legible ante fichero no válido).**
  Dado un fichero que no es un "Movimientos de la Cartera" de ING (hoja/columnas
  inesperadas o fichero corrupto),
  cuando se intenta leer,
  entonces falla con un **error claro** que identifica el problema y **no** emite
  operaciones parciales o basura.

## Entidades y reglas afectadas
- **Puerto `BrokerStatementReader`** (nuevo, ADR-009): `read(fichero) ->
  ExtractoParseado { metadatos, operaciones[] }`. Adaptador v1:
  `IngXlsStatementReader`. `operacion = { occurredOn, side, nombreBroker,
  etiquetaMercado, cantidad, precioOrigen, importeEur }`.
- **No hay entidad persistida** en esta spec: la salida es un modelo en memoria.
- Reglas: alimenta **RN-04** (precisión del coste) aguas abajo; **RN-01/RN-03** (la
  subida autenticada) se ejercen en SPEC-012/013, no aquí. Decisiones: **ADR-009**.
  Términos: `docs/fundacion/dominio.md` (posición, precio medio, gastos).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Resolver el símbolo** (nombre/mercado → ticker+MIC): SPEC-012.
- **Escribir en la cartera** y la idempotencia: SPEC-013.
- **Otros brókers y formatos** (CSV, PDF, API): futuros adaptadores del puerto (ADR-009).
- **Operaciones distintas de COMPRA/VENTA** (dividendos, traspasos, ampliaciones):
  el export no las trae; fuera de v1 (EPIC-002).
- **Decidir divisa/coste** de cada operación: eso es ADR-011/SPEC-013; aquí el
  `precioOrigen` y el `importeEur` se conservan crudos.

## Notas para el gate humano
- El **fichero real de ejemplo** (`examples/historico.xls`) se usa como fixture de
  verificación: los CA se prueban contra datos reales, no sintéticos.
- **Precisión**: los importes se parsean a decimal (coherente con `numeric` del
  ledger, ADR-003), evitando el arrastre float que se ve en el crudo del `.xls`.
- El lector es **puro** (no toca red ni BD): habilita probar todo aguas abajo con
  fixtures sin depender de ING.
