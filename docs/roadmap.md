---
tipo: roadmap
---
# Roadmap — Stockeiro

> Curado por sdd-producto. Secuencia de épicas, horizonte y criterios de corte.
> El estado fino por spec vive en el tablero; aquí vive la INTENCIÓN.

## Ahora (en curso)
- **EPIC-FIX — Defectos en producción** (estado: `aprobada`; épica *bucket*).
  Subió a "Ahora" porque hay un defecto que **rompe la promesa central del producto**:
  la vigilancia (CE-1) y el P/L actual (CE-3) **no funcionan para el mercado principal
  del usuario**. El free tier de Twelve Data no cubre BME/M.CONTINUO y la cartera real
  es ~82% mercado continuo español; además el fallo es **silencioso** (el usuario solo
  ve "sin cotización"). La app está desplegada, así que lleva desde el despliegue sin
  cumplir lo prometido. Nada de lo demás importa hasta que esto funcione.
  **Estado**: SPEC-015 (proveedor con cobertura real → Marketstack) y SPEC-016
  (diagnóstico visible, **CE-F2 cumplido**) están `hecho` y en `main`. Queda confirmar
  **CE-F1 contra la cartera real en producción** — el despliegue aplica la migración en
  el build, así que se verá en el próximo ciclo del cron.

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
  CVE y línea mantenida de Next.js (ADR-008).

## Después (comprometido, sin empezar)
- **EPIC-003 — Continuidad del valor a través de eventos corporativos** (estado: borrador).
  Cuando una empresa hace un contrasplit y cambia de nombre, o cambia de ticker, la cartera
  **no sabe decir que el de antes y el de ahora son el mismo valor**: las transacciones
  cuelgan del símbolo viejo, no hay forma de continuarlas y el P/L actual se queda en "—"
  **para siempre**. Rompe CE-3 de EPIC-001 para ese valor. Caso real y documentado:
  **PharmaMar, contrasplit 12:1 + cambio de nombre**, en el extracto de ING que originó
  EPIC-002.
  **Por qué "Después" y no "Ahora"**: rompe CE-3 solo para los valores que han pasado por un
  evento corporativo, no para la cartera entera — EPIC-FIX era el 82% de la cartera sin
  cotizar, y por eso mandaba. En cuanto EPIC-FIX cierre, esta es la siguiente.
  **Por qué ahora se ve y antes no**: estaba tapado por el silencio. SPEC-016 hace visible
  *por qué* un símbolo no cotiza, y el usuario descubre que no puede hacer nada al respecto.
  Es la cláusula que EPIC-FIX dejó escrita: *"si el arreglo destapa una capacidad que falta,
  va a su épica de producto"*. Pendiente de gate humano.

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
- **Detección automática** de eventos corporativos (que la app se entere sola del split, sin
  que el usuario lo declare): sigue sin compromiso porque automatizarlo **requiere una fuente
  de eventos fiable** y no está validada. El proveedor que entra por EPIC-FIX expone
  `split_factor`/`dividend`, lo que lo haría más viable. **Ojo, ya no es lo que era**:
  EPIC-003 se lleva el *re-escalado* (lo hará la app aplicando RN-07, con confirmación del
  usuario), así que lo único que queda aquí es la **detección** — enterarse del evento sin
  que nadie lo teclee.
- **Deslistado sin sucesor**: un valor que deja de cotizar y **no continúa en ningún sitio**
  (¿archivar la posición? ¿congelar su P/L?). Se dejó **fuera de EPIC-003 a propósito**: esa
  épica va de *continuar* un valor, y esto es *cerrar* uno muerto — otra capacidad, otra
  aritmética. Idea, sin compromiso, hasta que haya caso real.
- Canales de aviso adicionales (push móvil / app nativa).
- Analítica histórica de la cartera y de aciertos de zona.
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
**La app está desplegada** en <https://stockeiro-lemon.vercel.app> desde 2026-07-14, con
Neon + Twelve Data + cron diario activos. El esquema **se migra solo en el build**
(`vercel.json`: `buildCommand = db:migrate && build`), así que una spec con cambio de
esquema no necesita paso manual.

- ✅ **F-SPEC-001-2** (Neon + `AUTH_SECRET`) — **cerrada**.
- ✅ **F-SPEC-004-1** (`TWELVE_DATA_API_KEY` + `CRON_SECRET` + Vercel Cron) — **cerrada**.
  ⚠️ Aprovisionada, pero el **free tier no cubre BME** → es el defecto que ataca EPIC-FIX.
- ⏳ **F-SPEC-006-1** (Resend: `RESEND_API_KEY` + dominio verificado) — **pendiente por
  diseño**. Sin ella los avisos quedan **in-app** (RN-15) y no sale email; el ciclo no
  falla. Se activa cuando se quiera (runbook §7).
- ⏳ **F-SPEC-011-1** (el build debe alcanzar `cdn.sheetjs.com`; `xlsx` viene del CDN por
  los CVE del paquete npm) — registrado en el runbook §6.
- ⏳ **F-SPEC-012-1** (validar el mapeo mercado→MIC contra el proveedor real) — **lo
  absorbe EPIC-FIX**: es la misma raíz (operating MIC vs segment MIC).
- ⚠️ **Preview comparte la BD de producción**: `DATABASE_URL` está definida para
  `Production, Preview` con un único valor, y el build migra en **todos** los entornos →
  **una PR migraría producción**. Arreglo: BD Neon aparte para Preview (runbook §6).
