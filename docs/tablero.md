<!-- GENERADO por tremen-sdd (scripts/tablero.mjs). NO EDITAR A MANO. -->
# Tablero

Actualizado: 2026-08-17

## EPIC-001 — vigilancia-de-zonas-de-compra-venta-con-cartera-y-avisos (hecho)

| Spec | Estado | Último cambio |
|---|---|---|
| SPEC-001 — cuentas-y-multiusuario | hecho | 2026-07-13 (sdd-verificador) |
| SPEC-002 — cartera-y-p-l | hecho | 2026-07-13 (sdd-verificador) |
| SPEC-003 — acciones-vigiladas-y-zonas | hecho | 2026-07-13 (sdd-verificador) |
| SPEC-004 — ingesta-de-cotizaciones | hecho | 2026-07-14 (sdd-verificador) |
| SPEC-005 — motor-de-disparo-por-zonas | hecho | 2026-07-14 (sdd-verificador) |
| SPEC-006 — notificaciones-y-aviso-proactivo | hecho | 2026-07-14 (sdd-verificador) |
| SPEC-007 — ui-de-avisos-y-estado-de-zona | hecho | 2026-07-14 (sdd-verificador) |
| SPEC-008 — buscador-de-simbolos-por-nombre | hecho | 2026-07-14 (sdd-verificador) |

## EPIC-002 — import-de-posiciones-desde-broker (aprobada)

| Spec | Estado | Último cambio |
|---|---|---|
| SPEC-011 — lectura-del-extracto-de-ing | hecho | 2026-07-14 (sdd-verificador) |
| SPEC-012 — resolucion-de-identidad-e-importacion-asistida | hecho | 2026-07-14 (sdd-verificador) |
| SPEC-013 — registro-idempotente-en-la-cartera | hecho | 2026-07-14 (sdd-verificador) |
| SPEC-014 — ui-del-import-desde-broker | hecho | 2026-07-15 (sdd-verificador) |

## EPIC-003 — recuperacion-y-cambio-de-contrasena (aprobada)

| Spec | Estado | Último cambio |
|---|---|---|
| SPEC-023 — recuperacion-de-contrasena-por-email | hecho | 2026-08-12 (sdd-verificador) |

## EPIC-FIX (aprobada)

| Spec | Estado | Último cambio |
|---|---|---|
| SPEC-015 — proveedor-de-cotizaciones-con-cobertura-del-mercado-real | hecho | 2026-07-15 (sdd-verificador) |
| SPEC-016 — diagnostico-visible-del-simbolo-sin-cotizacion | hecho | 2026-07-15 (sdd-verificador) |
| SPEC-020 — dialecto-de-simbolo-del-proveedor-por-mercado | hecho | 2026-08-11 (humano (Alberto Fojo) — FIRMA RETROACTIVA del gate: aprobo la spec despues de estar implementada) |
| SPEC-021 — precio-de-cadena-inambigua-en-mercados-pelados | hecho | 2026-08-11 (sdd-verificador) |
| SPEC-024 — quitar-de-vigiladas-la-accion-correcta-haya-estado-o-no-en-zona | hecho | 2026-08-17 (sdd-verificador) |

## EPIC-INFRA (aprobada)

| Spec | Estado | Último cambio |
|---|---|---|
| SPEC-009 — migracion-a-next-16-y-remediacion-de-cve-de-rsc | hecho | 2026-07-14 (sdd-verificador) |
| SPEC-010 — bump-de-drizzle-orm-por-cve-de-sql-injection | hecho | 2026-07-14 (sdd-verificador) |

## ADRs

| ADR | Estado | Título | Último cambio |
|---|---|---|---|
| ADR-001 | aprobada | stack-y-plataforma-next-js-en-vercel-neon-postgres-auth-js | 2026-07-13 (humano) |
| ADR-002 | aprobada | ingesta-de-mercado-twelve-data-tras-puerto-con-simbolos-compartidos-y-cache-deduplicada | 2026-07-13 (humano) |
| ADR-003 | aprobada | modelo-de-cartera-ledger-de-transacciones-precio-medio-gastos-y-p-l | 2026-07-13 (humano) |
| ADR-004 | borrador | cadencia-diaria-y-base-no-ajustada-de-la-ingesta-persistencia-de-cotizaciones | 2026-07-14 (sdd-arquitecto) |
| ADR-005 | aprobada | evaluacion-de-disparos-dentro-del-ciclo-de-refresco-con-episodios-edge-triggered | 2026-07-14 (humano (Alberto Fojo)) |
| ADR-006 | aprobada | canal-de-aviso-email-resend-tras-puerto-con-registro-in-app-y-fallback | 2026-07-14 (humano (Alberto Fojo)) |
| ADR-007 | aprobada | identidad-de-simbolo-por-ticker-mas-mic-code-y-busqueda-de-simbolos-tras-puerto | 2026-07-14 (humano (Alberto Fojo)) |
| ADR-008 | aprobada | linea-mantenida-de-next-js-16-x-como-piso-de-seguridad-y-politica-de-parcheo-de-cve | 2026-07-14 (humano (Alberto Fojo)) |
| ADR-009 | aprobada | arquitectura-del-import-de-extracto-tras-puerto-e-identidad-con-fusion-manual | 2026-07-14 (humano (Alberto Fojo)) |
| ADR-010 | aprobada | idempotencia-del-import-por-clave-derivada-de-la-operacion | 2026-07-14 (humano (Alberto Fojo)) |
| ADR-011 | aprobada | divisa-y-coste-de-las-transacciones-importadas-divisa-nativa-y-gastos-en-euro | 2026-07-14 (humano (Alberto Fojo)) |
| ADR-012 | aprobada | marketstack-para-cotizaciones-e-identidad-de-mercado-canonica-por-operating-mic | 2026-07-15 (humano (Alberto Fojo)) |
| ADR-014 | aprobada | confianza-en-el-eco-de-mercado-dentro-de-un-grupo-de-mercados-equivalentes-del-proveedor | 2026-08-11 (humano (Alberto Fojo) — aprobado en el mismo gate que SPEC-021) |
| ADR-015 | aprobada | token-de-recuperacion-opaco-de-un-solo-uso-almacenado-hasheado-y-con-caducidad-corta | 2026-08-12 (humano (Alberto Fojo)) |
| ADR-016 | aprobada | invalidacion-de-sesiones-previas-al-cambiar-la-contrasena-mediante-epoca-de-credencial-en-el-jwt | 2026-08-12 (humano (Alberto Fojo)) |
| ADR-017 | aprobada | baja-de-una-accion-vigilada-los-episodios-de-zona-son-derivados-y-el-historial-de-avisos-se-conserva | 2026-08-17 (Alberto Fojo) |

## Resumen

- hecho: 20
