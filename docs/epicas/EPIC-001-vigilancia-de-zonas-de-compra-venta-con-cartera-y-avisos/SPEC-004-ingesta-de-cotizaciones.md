---
id: SPEC-004
tipo: spec
epica: EPIC-001
estado: hecho
aprobada-por: humano (Alberto Fojo) — gate 2026-07-14
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-07-14, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-07-14, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-07-14, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-07-14, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-07-14, por: sdd-verificador}
---
# SPEC-004 — Ingesta de cotizaciones

## Problema
Para que la app calcule el P/L actual real (CE-3) y, después, dispare por zonas
(CE-1), necesita **precios de mercado**. Hoy no hay ninguno: el P/L actual se
muestra "—" y el predicado de zona (SPEC-003) no tiene contra qué evaluar. Esta
spec ingiere, una vez al día, el **último precio de cierre no ajustado** de cada
símbolo que algún usuario referencia (watchlist o cartera), lo persiste y lo pone
a disposición del P/L actual. Implementa **ADR-002** y **ADR-004**. Reglas: **D-2,
RN-12**. Dominio: sdd-mercados. NO incluye el motor de disparo ni las notificaciones.

## Usuarios / roles afectados
- **Sistema** (proceso programado): refresca las cotizaciones. No es una acción de
  usuario final; se dispara por Vercel Cron.
- **Usuario final** (indirecto): ve su P/L actual con dato real y el `asOf`.

## Criterios de aceptación
Cada CA es verificable con un test. La verificación usa un **proveedor fake** tras
el puerto `MarketDataProvider` (ADR-004); el adaptador real de Twelve Data se
escribe pero no se llama en tests.

- **CA-1 (Deduplicación 1-símbolo-1-llamada, ADR-002).**
  Dado que varios usuarios referencian el mismo ticker (en watchlist y/o cartera),
  cuando se ejecuta el refresco,
  entonces ese símbolo se solicita al proveedor UNA sola vez (el conjunto pedido no
  tiene duplicados), independientemente de cuántos usuarios lo referencien.
- **CA-2 (Universo de símbolos).**
  Dadas las acciones vigiladas y las posiciones de todos los usuarios,
  cuando se ejecuta el refresco,
  entonces el conjunto a pedir es la UNIÓN de símbolos referenciados por watchlist
  y por transacciones (distinct); un símbolo no referenciado por nadie no se pide.
- **CA-3 (Persistencia de la cotización).**
  Dado un símbolo con precio devuelto por el proveedor,
  cuando se ejecuta el refresco,
  entonces se guarda su cotización (precio, divisa, `asOf`) como ÚLTIMA del símbolo
  (upsert por símbolo, ADR-004); un segundo refresco la actualiza, no la duplica.
- **CA-4 (Alimenta el P/L actual, CE-3).**
  Dada una posición abierta de un usuario y una cotización ingerida para su símbolo,
  cuando se consulta el resumen de cartera (SPEC-002),
  entonces el P/L actual usa el precio ingerido (deja de ser "—") = (precio −
  coste medio) × cantidad viva (RN-06).
- **CA-5 (Base no ajustada + asOf, RN-12).**
  Dada una cotización ingerida,
  cuando se persiste y se expone,
  entonces es el último precio NO ajustado y lleva su `asOf`, que queda disponible
  para mostrarse (D-2); no se ajusta por splits/dividendos.
- **CA-6 (Resiliencia por símbolo, ADR-004).**
  Dado un conjunto de símbolos donde el proveedor falla para uno,
  cuando se ejecuta el refresco,
  entonces ese símbolo se salta (queda sin actualizar) y los demás SÍ se actualizan;
  el ciclo no se aborta entero.
- **CA-7 (Endpoint de refresco protegido, ADR-004).**
  Dada la ruta que dispara el refresco,
  cuando se invoca sin el secreto de cron correcto (`CRON_SECRET`),
  entonces se rechaza (no autorizada) y no se ejecuta la ingesta; con el secreto
  correcto, se ejecuta.

## Entidades y reglas afectadas
- **`quote`** (compartida, ADR-004): `symbolId`→symbol (único), `price`, `currency`,
  `asOf` (timestamp), `updatedAt`. Última cotización por símbolo.
- **Puerto `MarketDataProvider`** (ADR-002): `getQuotes(tickers[]) -> {symbol, price,
  currency, asOf}[]` (omite los que fallan). Implementaciones: `TwelveDataProvider`
  (real) y un fake para tests.
- **Servicio de refresco**: calcula el universo distinct (watchlist ∪ transactions),
  llama al proveedor una vez, hace upsert de las cotizaciones, salta fallos.
- **Ruta de cron** protegida con `CRON_SECRET`.
- Integración con SPEC-002: `portfolioSummary` toma los precios de `quote`.
- Reglas: **D-2, RN-06, RN-12**. Decisiones: **ADR-002, ADR-004**. Términos:
  `docs/fundacion/dominio.md` (cotización, asOf, caché deduplicada, puerto de datos).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Motor de disparo** (evaluar zonas contra las cotizaciones y generar disparos) y
  **notificaciones** (CE-2): specs propias. Aquí solo se ingiere y persiste el precio.
- **Histórico de cotizaciones** (solo se guarda la última por símbolo, ADR-004).
- **Multi-mercado / husos horarios**: una cadencia diaria única UTC (ADR-004).
- **Llamada real a Twelve Data en tests**: se usa proveedor fake; la key real y la
  verificación contra la API son follow-up de despliegue.
- **Reintentos/backoff avanzados**: v1 salta el símbolo que falla (CA-6); política
  de reintentos fina queda a futuro.

## Notas para el gate humano
Resoluciones ya tomadas contigo (ADR-004): base = **último cierre NO ajustado**;
cadencia = **1×/día tras cierre** (Vercel Cron); verificación con **proveedor fake**
(Twelve Data real sin llamar en tests).

- **Proveedor fake en tests**: los CA se prueban con precios inyectados; el adaptador
  real de Twelve Data queda sin cobertura automática hasta aprovisionar la key
  (follow-up). ¿Conforme?
- **Solo última cotización** (sin histórico) por símbolo: suficiente para P/L actual
  y disparos. ¿OK?
- **`CRON_SECRET` y `TWELVE_DATA_API_KEY`**: necesarios en producción; en tests se
  usan valores de prueba. Se suman a F-SPEC-001-2 (env de despliegue).
