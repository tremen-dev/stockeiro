---
id: ADR-002
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-13, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-13, por: humano}
---
# ADR-002: Ingesta de mercado: Twelve Data tras puerto, con símbolos compartidos y caché deduplicada

- Deciders: propone sdd-arquitecto (con dictamen de dominio sdd-mercados); aprobado por el humano (gate) el 2026-07-13. Auth.js gestiona la política de contraseña (ver SPEC-001).
- Specs relacionadas: futura spec de Ingesta de cotizaciones y Motor de disparo (EPIC-001). Consumida por Cartera (P/L actual) y Zonas.

## Contexto
La app necesita cotizaciones para (a) calcular P/L actual (CE-3) y (b) evaluar
entradas en zona (CE-1). No se requiere tiempo real: inversión a largo plazo,
disparadores por **zona**, no por valor exacto (FOUNDATION, EPIC-001).

Verificación de dominio (sdd-mercados, búsqueda 2026-07-13):
- Yahoo/Google no ofrecen API oficial gratuita; los endpoints no oficiales
  (yfinance) se bloquean y limitan sin aviso → **inviables** para multiusuario.
- Free tiers viables (datos diferidos, aceptable aquí): Twelve Data ~800 req/día,
  Finnhub ~300/día (60/min), Alpha Vantage ~25/día (insuficiente).

Observación clave: **la cotización es por símbolo, no por usuario**. Si N usuarios
vigilan INDITEX, el precio debe pedirse **una sola vez** por ciclo. Sin dedupe, el
free tier se agota linealmente con los usuarios; con dedupe, escala con el número
de **símbolos distintos**, no de usuarios.

## Decisión
1. **Puerto `MarketDataProvider`** (frontera de integración): interfaz de dominio
   que expone `getQuotes(symbols[]) -> {symbol, price, currency, asOf}`. El motor
   de disparo y la cartera dependen del puerto, no del proveedor.
2. **Primer adaptador: Twelve Data** (mayor free tier diario). Cambiar de
   proveedor = nuevo adaptador, sin tocar dominio.
3. **Registro compartido de símbolos** (`instrument`/`symbol`): entidad global,
   no por usuario. Las acciones vigiladas y las posiciones de cada usuario
   **referencian** un símbolo compartido.
4. **Caché de cotizaciones deduplicada**: por ciclo de refresco se calcula el
   conjunto ÚNICO de símbolos referenciados por cualquier usuario y se pide cada
   uno **una sola vez**; el precio se guarda en una tabla `quote` (símbolo, precio,
   divisa, `asOf`) que todos los usuarios leen. 1 símbolo = 1 llamada, sirva a 1 o
   a 100 usuarios.
5. **Cadencia:** refresco diario por **Vercel Cron** (ADR-001). Frecuencia exacta
   y ventana horaria se fijan en la spec de ingesta (hipótesis: 1×/día tras cierre;
   afecta a CE-1/R-3). Reintentos y backoff ante rate-limit del proveedor.
6. **Precio ajustado vs. no ajustado y divisa** se persisten explícitamente
   (invariante sdd-mercados) para no falsear disparos ni P/L.

## Consecuencias
### Positivas
- Coste de API escala con símbolos distintos, no con usuarios → free tier rinde.
- Proveedor intercambiable; sin lock-in de datos.
- Una sola fuente de precio por símbolo → P/L y disparos consistentes entre usuarios.

### Negativas / follow-ups
- Introduce una entidad global `symbol`/`quote` y un job de reconciliación del
  conjunto de símbolos vigilados; complejidad de sincronización.
- Datos diferidos: el `asOf` debe mostrarse al usuario para no dar falsa sensación
  de tiempo real.
- Límite diario finito: si crece mucho el nº de símbolos distintos, habrá que
  paginar el batch o subir de tier. Monitorizar consumo.

## Alternativas consideradas
- **Fetch por usuario (sin dedupe):** simple, pero agota el free tier con pocos
  usuarios y produce precios inconsistentes; rechazado.
- **Finnhub como primer adaptador:** válido (60/min ayuda al batch), pero menor
  límite diario; queda como segundo adaptador tras el puerto.
- **yfinance / scraping de Yahoo:** gratis pero se bloquea y viola términos;
  rechazado por fiabilidad (dictamen sdd-mercados).
- **Tiempo real (WebSocket/intradía):** fuera de alcance de la épica; innecesario
  para disparadores por zona.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
