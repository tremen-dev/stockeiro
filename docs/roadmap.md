---
tipo: roadmap
---
# Roadmap — Stockeiro

> Curado por sdd-producto. Secuencia de épicas, horizonte y criterios de corte.
> El estado fino por spec vive en el tablero; aquí vive la INTENCIÓN.

## Ahora (en curso)
- **EPIC-004 — Puesta en público para testers externos** (estado: aprobada;
  gate humano el 2026-08-19, Alberto Fojo).
  **Por qué manda ahora.** No entrega capacidad nueva de vigilancia: entrega la
  posibilidad de **enseñársela a alguien**. Y es lo único que queda entre el producto
  y su primer usuario real. El criterio de corte que exigía no comprometer alcance
  nuevo hasta restaurar la promesa está superado (EPIC-FIX, ocho specs `hecho`), y
  EPIC-003 cerró el agujero sin remedio del primer minuto. `main` está en verde con
  27 specs `hecho` y ninguna en curso: **no queda defecto conocido que tape la promesa**.
  Lo que queda no es hacer la app mejor, es hacerla *presentable*.
  Cubre lo que obliga publicar: **rol por usuario** (el tester ve Panel, Vigiladas y
  Avisos; Cartera e Importar se ocultan), **versión visible**, **páginas legales** con
  descargo de no asesoramiento, **ayuda de Vigiladas**, **borrar mi cuenta** (supresión
  RGPD, hoy inexistente), **grifo del registro** cerrable sin desplegar, **estados
  vacíos que guían** y un **canal de feedback**.
  ⚠️ **Destapa R-1 (licencia de datos)**: el free tier de Marketstack no concede uso
  comercial ni redistribución, y ADR-012 asumió esa ambigüedad *"porque se compartirá
  con testers"*. Publicar en abierto es ese escenario. Ver "Ops y despliegue".

- **EPIC-FIX — Defectos en producción** (estado: aprobada; épica *bucket*).
  Sube a "Ahora" porque hay un defecto que **rompe la promesa central del producto**:
  la vigilancia (CE-1) y el P/L actual (CE-3) **no funcionan para el mercado principal
  del usuario**. El free tier de Twelve Data no cubre BME/M.CONTINUO y la cartera real
  es ~82% mercado continuo español; además el fallo es **silencioso** (el usuario solo
  ve "sin cotización"). La app está desplegada, así que lleva desde el despliegue sin
  cumplir lo prometido. Nada de lo demás importa hasta que esto funcione.
  Aprobada por humano el 2026-07-15.
  ↳ **Estado real a 2026-08-17**: sus seis specs (SPEC-015, 016, 020, 021, 024, 025)
  están `hecho`. La promesa está restaurada **de facto**; falta el cierre formal de la
  épica (moverla a "Entregado" cuando lo sanciones).

- **EPIC-003 — Recuperación y cambio de contraseña** (estado: borrador).
  **Por qué está aquí y no en "Después", pese al criterio de corte.** El criterio dice
  que no se compromete alcance nuevo hasta que EPIC-FIX restaure la promesa — y eso
  **ya ha ocurrido**: las seis specs de EPIC-FIX (015, 016, 020, 021, 024, 025) están
  `hecho`. El listón que ese criterio puso está superado; mantener la sección vacía
  sería respetar la letra de la regla contra su propósito.
  Y hay una razón propia, no derivada: la app se va a compartir con **testers externos**
  en un foro de bolsa, y hoy **un usuario que olvida su contraseña queda fuera para
  siempre** (única salida: tocar el hash a mano en Neon). Es el primer minuto de la
  relación con el producto y no tiene remedio.
  Además **no es alcance nuevo en sentido estricto**: el gate humano de SPEC-001
  (2026-07-13) ya resolvió que *"el flujo de reset será spec propia"*. Esta épica paga
  una deuda contraída, no amplía la ambición del producto.
  ⚠️ **Convierte F-SPEC-006-1 en bloqueante** (ver "Ops y despliegue"): sin Resend con
  dominio verificado no hay recuperación posible — el email no tiene fallback aquí.

## Entregado
> Lo que ya cumple su promesa. El detalle por spec vive en `docs/tablero.md`.

- **EPIC-001 — Vigilancia de zonas con cartera y avisos** (`hecho`). El núcleo:
  vigiladas + zonas, ingesta, motor de disparo, avisos, cartera con P/L y UI.
  ⚠️ Su promesa está **parcialmente incumplida en producción** por el defecto de
  cobertura de mercado → lo restaura EPIC-FIX.
- **EPIC-002 — Import de posiciones desde bróker** (`hecho`). Lee el `.xls` de ING,
  resuelve identidad con fusión manual, registra idempotente y lo expone en
  `/cartera/importar`. Coste en EUR neto; sin re-escalar splits.
- **EPIC-INFRA — Infraestructura y mantenimiento** (bucket, `aprobada`). Parcheo de
  CVE y línea mantenida de Next.js (ADR-008), una sola definición del esquema
  (SPEC-026) y CI en cada PR (SPEC-027).
  ↳ **Estado real a 2026-08-18**: sus cuatro specs (SPEC-009, 010, 026, 027) están
  `hecho`; la épica sigue abierta como bucket.

## Después (comprometido, sin empezar)
<!-- Sigue vacío. La regla que lo vaciaba ("nada nuevo hasta que EPIC-FIX restaure la
promesa") ya se ha cumplido, pero eso no la convierte en barra libre: lo único que ha
subido es EPIC-003, y por las razones propias que allí se argumentan. -->

## Más adelante (idea, sin compromiso)
- **Observabilidad del ciclo diario**: registrar el resultado de cada ejecución del cron
  (ingeridos / saltados / avisos) y **alertar si falla**. Hoy solo se sabe mirando logs o
  viendo un `asOf` viejo — así se tardó en detectar el defecto de cobertura. Idea nacida
  de EPIC-FIX; el aviso *al usuario* (CE-F2) sí entra en EPIC-FIX, esto es el aviso *al
  operador*.
- **Zonas calientes**: una acción a un X% de entrar en su zona (aún FUERA) se marca como
  "caliente" para seguirla de cerca; no dispara todavía, pero anticipa la entrada. Complementa
  el motor de disparo (SPEC-005) sin sustituirlo. Requeriría definir el umbral (% o distancia)
  y si genera aviso propio o solo señal en la UI.
- **Mejoras de la bandeja de avisos** (aparcadas en SPEC-007, para no bloquear el MVP):
  filtros y paginación del inbox (por tipo/ticker/fecha), archivar/borrar avisos, y
  actualización en vivo del estado de zona / contador (hoy se refresca al navegar; el tiempo
  real choca con D-2, por eso es idea, no compromiso).
- **Preferencias de notificación** (F-SPEC-006-2): silenciar, elegir canal/frecuencia por
  usuario; reintentos/backoff del proveedor de email y retención del log de avisos.
- Multi-moneda y fiscalidad (P/L con comisiones, dividendos, splits, ventas parciales).
- Import por **conexión** con el bróker (API, sin fichero) y **otros formatos/brókers**
  (CSV, PDF): evolución de EPIC-002, que en v1 solo lee el `.xls` de ING. La conexión
  a la cuenta real choca con la visión ("la app no opera"); idea, sin compromiso.
- Ajuste automático por **eventos corporativos** (re-escalar cantidades/precios en
  splits/contrasplits): EPIC-002 lo delega en confirmación humana; automatizarlo
  requiere una fuente de eventos fiable. *(El proveedor que entra por EPIC-FIX expone
  `split_factor`/`dividend`, lo que lo haría más viable — pero sigue sin compromiso.)*
- Canales de aviso adicionales (push móvil / app nativa).
- Analítica histórica de la cartera y de aciertos de zona.
- **Analítica de uso y retención** (cuántos usuarios vuelven, qué secciones tocan):
  dejado **fuera de EPIC-004 a propósito**. Con veinte testers es una consulta SQL en
  Neon y no cambia ninguna decisión de la primera semana. EPIC-004 sí entrega los
  contadores operativos mínimos (cuentas, vigiladas, último ciclo) en su pantalla de
  admin — eso es *saber si está vivo*, no analítica de producto.
- **Flags de capacidad por usuario individual** (abrir una sección a personas
  concretas): EPIC-004 resolvió la visibilidad con **rol**, que cubre el caso de hoy.
  Se reabre el día que haya que abrir Cartera a tres personas y no a las demás.
- **Exportar mis datos** (portabilidad RGPD): EPIC-004 entrega solo la **supresión**,
  que es la que bloquea publicar. La portabilidad, cuando alguien la pida.
- **F-SPEC-001-1** (deuda técnica de hardening, derivado de SPEC-001): reforzar el
  aislamiento entre usuarios con Row Level Security (RLS) en Postgres. Hoy el
  aislamiento vive en capa de app y CA-6 lo cubre; RLS es refuerzo futuro, no bloqueante.

## Criterios de corte
<!-- Qué haría subir o bajar una épica de sección. -->
- Sube a "Ahora" lo que **restaure una promesa incumplida** de una épica entregada
  (defecto en producción) — tiene prioridad sobre cualquier alcance nuevo.
- Sube a "Ahora" lo que desbloquee un criterio de éxito aún no entregado.
- Baja a "Más adelante" todo lo que amplíe alcance antes de que lo entregado funcione
  de verdad (más instrumentos, tiempo real, operar): son mejoras, no el problema.

## Ops y despliegue (estado)
<!-- Acciones de ops; no son épicas ni cambian de sección. El runbook es docs/despliegue.md. -->
**La app está desplegada** en <https://stockeiro.tremen.dev> desde 2026-07-14 (dominio
propio desde 2026-08-18; el `*.vercel.app` sigue respondiendo), con
Neon + Marketstack + Twelve Data + Resend + cron diario activos. El esquema **se migra solo en el build**
(`vercel.json`: `buildCommand = db:migrate && build`), así que una spec con cambio de
esquema no necesita paso manual.

- ✅ **F-SPEC-001-2** (Neon + `AUTH_SECRET`) — **cerrada**.
- ✅ **F-SPEC-004-1** (`TWELVE_DATA_API_KEY` + `CRON_SECRET` + Vercel Cron) — **cerrada**.
  ⚠️ Aprovisionada, pero el **free tier no cubre BME** → es el defecto que ataca EPIC-FIX.
- ✅ **F-SPEC-006-1** (Resend: `RESEND_API_KEY` + `RESEND_FROM` + dominio verificado) —
  **CERRADA y PROBADA el 2026-08-18** (dominio `tremen.dev` verificado, un reset real
  entregado). Fue bloqueante desde 2026-08-11 porque EPIC-003 no tiene fallback: la
  recuperación de contraseña viaja por email o no viaja. Runbook §7 y §8.
- 🟡 **F-EPIC-004-1 — Plan de Marketstack (R-1 de EPIC-004)**: el free tier **no concede
  derechos de uso comercial ni de redistribución**, y ADR-012 asumió esa ambigüedad
  explícitamente *"porque la app se compartirá con testers"*. Publicar en un hilo abierto
  de un foro es ese escenario, ya sin ambigüedad — y las páginas legales de EPIC-004
  tendrán que declarar de dónde vienen los precios. **Mitigación conocida: plan Basic
  ($9.99/mes), misma key, cero código.** No es una spec: es una decisión de ops.
  ↳ **Decidido en el gate de EPIC-004 (2026-08-19, Alberto Fojo): se publica con el
  free tier; el paso a Basic queda para más adelante.** Riesgo **asumido a conciencia**.
  Queda abierta como recordatorio, no como bloqueo. Se revisa si el uso crece, si
  Marketstack lo reclama, o antes de cualquier cobro a usuarios.
- ⏳ **F-SPEC-011-1** (el build debe alcanzar `cdn.sheetjs.com`; `xlsx` viene del CDN por
  los CVE del paquete npm) — registrado en el runbook §6.
- ⏳ **F-SPEC-012-1** (validar el mapeo mercado→MIC contra el proveedor real) — **lo
  absorbe EPIC-FIX**: es la misma raíz (operating MIC vs segment MIC).
- ⚠️ **Preview comparte la BD de producción**: `DATABASE_URL` está definida para
  `Production, Preview` con un único valor, y el build migra en **todos** los entornos →
  **una PR migraría producción**. Arreglo: BD Neon aparte para Preview (runbook §6).
