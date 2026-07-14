---
id: EPIC-INFRA
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-07-14, por: sdd-arquitecto (épica bucket sancionada)}
---
# EPIC-INFRA — Infraestructura y mantenimiento

## Objetivo
Épica **bucket** (transversal, no de producto) que agrupa el trabajo de
infraestructura, seguridad y mantenimiento del stack: parcheo de CVE, subidas de
versión de framework/dependencias, plataforma de despliegue (Vercel), CI y salud
técnica del proyecto. No entrega capacidad de negocio nueva; **protege** la que ya
entregó EPIC-001 manteniendo el sistema seguro, soportado y desplegable.

Por qué existe: el trabajo de infra llega de forma reactiva (avisos de Vercel,
CVE, deprecaciones) y necesita gobernarse por specs testables igual que una feature,
sin forzar una visión de producto para cada bump.

## Criterios de éxito
Medibles, por spec:
- Cada aviso de vulnerabilidad o CVE que afecte a producción se cierra con una spec
  cuya verificación demuestra el sistema parcheado y **sin regresión funcional**.
- El proyecto se mantiene en líneas de dependencia **soportadas activamente**
  (ver ADR-008 para Next.js).
- Cero avisos de seguridad visibles en los builds de producción de Vercel.

## Alcance
- Dentro:
  - Parcheo de CVE y subidas de versión de framework/plataforma (Next.js, React,
    runtime de Vercel).
  - Salud de dependencias (`npm audit`), CI y configuración de despliegue.
- Fuera (aparcado a propósito, no por descuido):
  - Funcionalidad de producto (va en épicas de producto tipo EPIC-001).
  - Rediseño de arquitectura de dominio (compete a ADRs vía sdd-arquitecto).

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

## Riesgos
- **R-1 (Breaking changes en subidas de major):** una migración puede romper flujos;
  se mitiga con la suite E2E/Playwright existente como red de no-regresión.
- **R-2 (Deriva de la línea mantenida):** quedarse en versiones de fin de vida
  reintroduce avisos y deuda de seguridad; ADR-008 fija la política de piso.
