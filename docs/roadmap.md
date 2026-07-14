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
<!-- Vacío por ahora: se comprometerán épicas cuando EPIC-001 tenga specs en marcha. -->

## Más adelante (idea, sin compromiso)
- Multi-moneda y fiscalidad (P/L con comisiones, dividendos, splits, ventas parciales).
- Import automático de posiciones desde el bróker.
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
