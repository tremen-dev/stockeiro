---
id: ADR-004
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-03, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-004: Cadencia diaria y base no-ajustada de la ingesta; persistencia de cotizaciones

- Deciders: propone sdd-arquitecto (con dictamen de dominio sdd-mercados); aprueba el humano (gate). Pendiente de aprobación.
- Specs relacionadas: SPEC-004 (Ingesta de cotizaciones). Refina ADR-002 (puerto, adaptador, dedupe); consumido por SPEC-002 (P/L actual) y el futuro Motor de disparo.

## Contexto
ADR-002 fijó la arquitectura de ingesta (puerto `MarketDataProvider`, adaptador
Twelve Data, registro de símbolos compartido, **caché de cotizaciones deduplicada**
1-símbolo-1-llamada, refresco diario por Vercel Cron, `asOf` explícito) pero dejó
a "la spec de ingesta" tres decisiones que constriñen trabajo futuro (Motor de
disparo, P/L actual): la **cadencia exacta** (R-3), la **base del precio**
(ajustado vs no-ajustado) y la **persistencia** de las cotizaciones.

## Decisión
1. **Cadencia: 1×/día tras el cierre**, vía **Vercel Cron** a hora fija UTC. Es
   suficiente para inversión a largo plazo con disparadores por zona (D-2) y cabe
   holgadamente en el free tier del proveedor (ADR-002). El afinado multi-mercado
   / por huso horario queda fuera (futuro).
2. **Base de precio: último precio de cierre NO ajustado** (RN-12). Es la base
   coherente con cómo el usuario define sus zonas (RN-11) y con el coste base
   introducido a mano en la cartera; los splits/dividendos se registran
   manualmente (SPEC-002), no se ajusta la serie. Se persiste explícitamente la
   base y el `asOf` (invariante sdd-mercados).
3. **Persistencia: tabla `quote`** con la ÚLTIMA cotización por símbolo
   (`symbolId` único, `price`, `currency`, `asOf`), upsert cada ciclo. El
   histórico de cotizaciones queda fuera (futuro); para P/L actual y disparos
   basta la última.
4. **Puerto con dos implementaciones**: `TwelveDataProvider` (real, Node, usa
   `TWELVE_DATA_API_KEY`) para producción, y un **proveedor fake** inyectable para
   tests/e2e (precios y fallos controlados). El dominio depende del puerto, no del
   proveedor.
5. **Endpoint de refresco protegido**: la ruta que dispara el batch (p. ej.
   `/api/cron/refresh`) exige el secreto de cron (`CRON_SECRET`, cabecera que envía
   Vercel Cron); sin él, se rechaza. Evita que cualquiera dispare la ingesta.
6. **Resiliencia por símbolo**: si el proveedor falla para un símbolo, se salta ese
   y el resto se actualiza; el ciclo no se aborta entero.

## Consecuencias
### Positivas
- Base de precio coherente en zonas y P/L (cierra la deuda que dejó SPEC-003).
- Coste de API mínimo (1 lote diario de símbolos distintos, ADR-002).
- Ingesta testable sin API real (proveedor fake); adaptador real desacoplado.

### Negativas / follow-ups
- Sin histórico de cotizaciones (solo la última): analítica temporal queda a futuro.
- Cadencia única UTC ignora husos/mercados distintos: aceptable en v1; afinar luego.
- Requiere `TWELVE_DATA_API_KEY` y `CRON_SECRET` reales para producción (follow-up de despliegue).

## Alternativas consideradas
- **Base ajustada**: mejor para históricos, pero descuadra con zonas y coste base
  no ajustados que introduce el usuario; rechazada (decisión del humano).
- **Cadencia 2×/día u horaria**: más frescura pero más consumo y contra D-2 (no
  tiempo real); innecesaria para disparos por zona a largo plazo. Rechazada.
- **Histórico de cotizaciones desde ya**: más datos, más complejidad sin CA que lo
  pida; se difiere.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
