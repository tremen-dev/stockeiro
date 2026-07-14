---
id: SPEC-005
tipo: spec
epica: EPIC-001
estado: aprobada
aprobada-por: humano (Alberto Fojo) — gate 2026-07-14
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
---
# SPEC-005 — Motor de disparo por zonas

## Problema
La app ya sabe qué acciones vigila cada usuario con sus zonas (SPEC-003) e ingiere a
diario el precio de cada símbolo (SPEC-004), pero **nadie compara ambas cosas**: una
cotización puede entrar en la zona de compra o de venta de un usuario y la app no se
entera. Sin esa detección no hay "cero zonas perdidas" (CE-1) ni, después, aviso
proactivo (CE-2). Esta spec cierra el hueco: cada ciclo de refresco, evalúa las zonas
de las acciones vigiladas contra la última cotización y **registra un disparo** cuando
una acción **entra** en zona (RN-11), sin repetirlo mientras permanezca dentro (RN-13).
Implementa **ADR-005**. Reglas: **RN-11, RN-13, RN-01, D-2, D-3**. Dominio: sdd-mercados.
NO incluye el canal de notificación (CE-2): aquí solo se detecta y se persiste el evento.

## Usuarios / roles afectados
- **Sistema** (proceso programado): tras la ingesta del ciclo (SPEC-004), evalúa zonas y
  genera disparos. No es una acción de usuario final; se dispara por Vercel Cron (ADR-005).
- **Usuario final** (indirecto): sus acciones vigiladas generan disparos propios (aislados,
  RN-01) que la spec de notificación usará para avisarle; cada disparo lleva su `asOf` (D-2).

## Criterios de aceptación
Cada CA es verificable con un test. La verificación inyecta cotizaciones con un **proveedor
fake** (ADR-004) o sembrando `quote`, y ejerce el motor tras el refresco; no llama a APIs reales.

- **CA-1 (Disparo al entrar en zona de compra, RN-11).**
  Dada una acción vigilada por un usuario con zona de compra [min,max] y sin episodio abierto,
  cuando el ciclo ingiere una cotización con `min ≤ precio ≤ max`,
  entonces se registra un disparo de compra para ese usuario y acción, con el precio y el `asOf`
  que lo originaron.
- **CA-2 (Disparo al entrar en zona de venta, RN-11).**
  Dada una acción vigilada con zona de venta [min,max] y sin episodio abierto,
  cuando el ciclo ingiere una cotización dentro de ese rango,
  entonces se registra un disparo de venta (independiente del de compra), con precio y `asOf`.
- **CA-3 (No re-disparo mientras permanece dentro, pero permanencia observable, RN-13).**
  Dada una acción cuya cotización ya disparó su zona (episodio abierto),
  cuando en ciclos sucesivos el precio sigue dentro de la misma zona,
  entonces NO se genera un disparo nuevo (sigue habiendo exactamente uno para ese episodio),
  y ese par sigue apareciendo como "en zona" en la consulta de episodios abiertos (permanencia).
- **CA-4 (Re-armado tras salir y volver a entrar, RN-13).**
  Dada una acción que disparó y cuyo precio después SALIÓ de la zona (episodio cerrado),
  cuando un ciclo posterior vuelve a entrar en la zona,
  entonces se genera un disparo NUEVO (segundo episodio); total de disparos de esa zona = 2.
- **CA-5 (Fuera de zona o sin zona no dispara).**
  Dada una acción vigilada sin zona definida, o con el precio fuera de la zona,
  cuando se ejecuta la evaluación,
  entonces no se registra ningún disparo para ese par (acción, tipo de zona).
- **CA-6 (Límites inclusive, misma regla compra/venta).**
  Dada una zona [min,max] (incluida la de punto único min=max),
  cuando el precio cae exactamente en min o en max,
  entonces se considera dentro y dispara (RN-11: `min ≤ p ≤ max` inclusive), idéntico para
  compra y venta; el predicado es el ya probado de SPEC-003 (`entraEnZona`).
- **CA-7 (Evaluación acoplada al ciclo de refresco, ADR-005).**
  Dado el ciclo de refresco,
  cuando se ejecuta,
  entonces la evaluación de disparos corre DESPUÉS del upsert de cotizaciones y sobre esas
  cotizaciones; un símbolo que la ingesta saltó ese ciclo (sin precio) no se evalúa (no abre
  ni cierra episodio) y no cuenta como zona perdida.
- **CA-8 (Aislamiento por usuario, RN-01).**
  Dados dos usuarios que vigilan el MISMO símbolo compartido con zonas distintas,
  cuando una cotización entra en la zona de uno pero no en la del otro,
  entonces solo el usuario cuya zona se cumple recibe el disparo; ninguno ve ni afecta los
  disparos del otro (ni por lista ni por id).
- **CA-9 (`asOf` en el disparo, D-2).**
  Dado un disparo generado,
  cuando se persiste y se consulta,
  entonces lleva el `asOf` de la cotización que lo originó, disponible para mostrarse; jamás se
  presenta como dato de tiempo real.
- **CA-10 (Consulta de entradas y de permanencia por usuario, RN-13).**
  Dados los disparos generados,
  cuando la (futura) spec de notificación consulta el motor,
  entonces puede obtener, filtrado por `userId`: (a) las **entradas de este ciclo** (episodios
  abiertos en el ciclo actual) para el aviso individual, y (b) **todas las acciones que
  permanecen en zona** (episodios abiertos) para el aviso agregado. Ambas consultas alimentan
  los dos tipos de aviso (CE-2); esta spec expone las consultas, no envía los avisos.

## Entidades y reglas afectadas
- **`zone_trigger`** (por usuario, ADR-005): episodio de entrada en zona.
  `userId`, `watchedSymbolId`→watched_symbols, `symbolId`→symbol, `zoneKind` ('buy'|'sell'),
  `price`, `asOf`, `openedAt`, `closedAt` (null mientras dentro). La fila con `closedAt` null
  es el estado actual (dentro ahora) y garantiza idempotencia; el conjunto de filas es el log
  de eventos que consumirá la notificación.
- **Servicio de evaluación**: por cada acción vigilada con zona y cotización disponible,
  aplica `zonasEntradas`/`entraEnZona` (SPEC-003) y abre/cierra episodios (RN-13).
- **Enganche**: se invoca tras `refreshQuotes` en el mismo ciclo de cron (SPEC-004/ADR-005);
  reutiliza el endpoint protegido con `CRON_SECRET`.
- Reglas: **RN-11** (entrada en zona), **RN-13** (disparo por entrada, no permanencia),
  **RN-10** (zona = rango), **RN-01** (aislamiento), **RN-12** (base no ajustada del precio a
  comparar). Decisiones: **ADR-005** (y ADR-002/ADR-004 heredadas). Términos:
  `docs/fundacion/dominio.md` (disparo/entrada en zona, motor de disparo, ciclo de refresco, asOf).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Notificación / aviso proactivo (CE-2)**: canal (email/push/in-app), entrega y registro de
  avisos son la spec siguiente. Aquí solo se detecta y persiste el disparo.
- **Disparo intradía / "tocar" la zona**: sin datos intradía no aplica (D-2, RN-11); un precio
  que entra y sale dentro del mismo día puede no verse. Salvedad aceptada de la cadencia diaria.
- **UI de disparos**: exponer la lista de disparos al usuario en pantalla puede ir con la spec de
  notificación o una de UI; esta spec deja la consulta lista (CA-10), no la pantalla.
- **Reglas compuestas** (p. ej. "dispara solo si además tengo posición"): el disparo depende solo
  de la zona vigilada, no de la cartera. Futuro si se pide.

## Notas para el gate humano
Resoluciones tomadas contigo en el gate (2026-07-14):

- **Detección deduplicada + permanencia observable (RN-13)**: se registra un disparo por
  episodio de ENTRADA; mientras siga dentro no se duplica, y se re-arma al salir y volver a
  entrar. La permanencia (episodios abiertos) queda consultable para que la spec de aviso emita
  **dos** tipos de notificación: (a) una por cada acción que ENTRA, y (b) una **agregada** con
  todas las que PERMANECEN en zona. *Resuelto: conforme.*
- **Evaluación dentro del cron de ingesta (ADR-005)**: mismo ciclo y mismo endpoint protegido,
  sin un segundo scheduler. *Resuelto: conforme.*
- **Cadencia diaria hereda D-2**: un cruce de zona intradía (entra y sale el mismo día) puede no
  detectarse sin datos intradía; coherente con "no tiempo real". *Resuelto: aceptado como salvedad.*
- **Solo detección y registro**, sin canal de aviso: el envío de los dos tipos de notificación es
  de la spec siguiente (CE-2); aquí solo se detecta, persiste y se exponen las consultas.
