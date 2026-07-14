---
tipo: roadmap
---
# Roadmap — Stockeiro

> Curado por sdd-producto. Secuencia de épicas, horizonte y criterios de corte.
> El estado fino por spec vive en el tablero; aquí vive la INTENCIÓN.

## Ahora (en curso)
- **EPIC-001 — Vigilancia de zonas de compra/venta con cartera y avisos**
  (estado: borrador). Es el núcleo del producto: sin la vigilancia de zonas + el
  aviso proactivo + la cartera, no hay app que resuelva el dolor declarado. Todo
  lo demás depende de esta base, por eso va primero.

## Después (comprometido, sin empezar)
- **EPIC-002 — Import de posiciones desde bróker** (estado: borrador). Con EPIC-001
  ya `hecho`, el cuello de botella para que un usuario real use la app con datos
  verdaderos es la carga inicial de la cartera: teclear años de operativa a mano no
  se hace. El import (fichero de bróker → transacciones) es la palanca de adopción
  sobre el núcleo ya entregado. Arranca por el export real de ING
  (`examples/historico.xls`); coste en EUR neto manda; identidad resuelta con
  confirmación humana en eventos corporativos (no re-escala splits); idempotente por
  clave derivada. Pendiente de gate humano para pasar a `aprobada`.

## Más adelante (idea, sin compromiso)
- **Zonas calientes**: una acción a un X% de entrar en su zona (aún FUERA) se marca como
  "caliente" para seguirla de cerca; no dispara todavía, pero anticipa la entrada. Complementa
  el motor de disparo (SPEC-005) sin sustituirlo. Idea, sin compromiso; requeriría definir el
  umbral (% o distancia) y si genera aviso propio o solo señal en la UI.
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
  requiere una fuente de eventos fiable. Idea, sin compromiso.
- Canales de aviso adicionales (push móvil / app nativa).
- Analítica histórica de la cartera y de aciertos de zona.
- **F-SPEC-001-1** (deuda técnica de hardening, derivado de SPEC-001): reforzar el
  aislamiento entre usuarios con Row Level Security (RLS) en Postgres. Hoy el
  aislamiento vive en capa de app y CA-6 lo cubre; RLS es refuerzo futuro, no bloqueante.

## Criterios de corte
<!-- Qué haría subir o bajar una épica de sección. -->
- Sube a "Ahora" lo que desbloquee un criterio de éxito de EPIC-001.
- Baja a "Más adelante" todo lo que amplíe alcance antes de validar el núcleo
  (más instrumentos, tiempo real, operar de verdad): son mejoras, no el problema.

## Antes de desplegar
<!-- Acciones de ops previas a producción; no son épicas ni cambian de sección. -->
- **F-SPEC-001-2** (ops, derivado de SPEC-001): aprovisionar Neon + `AUTH_SECRET`
  reales antes de desplegar a producción. Prerequisito de despliegue; ya no bloquea
  la verificación porque el e2e usa Postgres efímero.
- **Ops-ingesta** (derivado de SPEC-004): aprovisionar en Vercel (Settings →
  Environment Variables) `TWELVE_DATA_API_KEY` (Twelve Data, ADR-002) y `CRON_SECRET`
  (protege `/api/cron/refresh`, ADR-004). No bloquean la verificación (los tests usan
  proveedor fake + Postgres efímero); son prerequisito de producción, junto a
  F-SPEC-001-2. Ver checklist de env en `.env.example`.
  - `CRON_SECRET` no se pide a ningún proveedor: se genera (`openssl rand -hex 32`) y
    se define en Vercel; Vercel Cron lo reenvía como `Authorization: Bearer <CRON_SECRET>`
    en cada disparo. Tras cambiar variables, hacer redeploy.
