---
id: ADR-001
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-13, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-13, por: humano}
---
# ADR-001: Stack y plataforma: Next.js en Vercel, Neon Postgres, Auth.js

- Deciders: propone sdd-arquitecto; aprobado por el humano (gate) el 2026-07-13.
- Specs relacionadas: SPEC-001 (Cuentas y multiusuario); base para todas las de EPIC-001.

## Contexto
EPIC-001 exige una app web en Next.js, multiusuario con aislamiento de datos
(CE-4), persistencia de carteras/acciones/zonas y un proceso periódico (batch
diario) para refrescar cotizaciones y evaluar disparos. La petición fija Next.js;
el resto (hosting, base de datos, autenticación, ORM, scheduler) es decisión
técnica abierta. Restricciones: proyecto personal, preferencia por free/hobby
tier y baja fricción operativa.

## Decisión
Adoptar el ecosistema Vercel + Next.js App Router:

- **Framework:** Next.js (App Router) con Server Components y Server Actions /
  Route Handlers para la API.
- **Hosting:** Vercel (Fluid Compute; funciones Node.js). Despliegue continuo.
- **Base de datos:** **Neon Postgres** (Postgres gestionado, del Marketplace de
  Vercel), relacional — el dominio (usuarios, posiciones, símbolos, zonas,
  avisos) es fuertemente relacional.
- **ORM:** **Drizzle** (SQL-first, migraciones versionadas, arranque ligero en
  serverless).
- **Autenticación:** **Auth.js (NextAuth v5)** con adaptador Postgres. El
  aislamiento por usuario se implementa en la capa de aplicación (todo acceso a
  datos filtra por `userId` de la sesión); ver SPEC-001.
- **Scheduler:** **Vercel Cron** dispara el refresco/evaluación diaria (la
  ingesta y su cadencia se detallan en ADR-002).
- **Design system:** `design/tremen-ds` (CSS/tokens/componentes ya presentes en
  el repo) como capa de UI.

## Consecuencias
### Positivas
- Mínima fricción: despliegue, DB, cron y auth encajan en un solo ecosistema.
- Free/hobby tier suficiente para el arranque; escalado sin recableado.
- Postgres relacional simplifica integridad referencial y consultas de cartera.

### Negativas / follow-ups
- Acoplamiento a Vercel (cron, funciones). Mitigable: la lógica de dominio vive
  en módulos framework-agnósticos; Vercel solo la invoca.
- El aislamiento a nivel de aplicación (no RLS de base de datos) exige disciplina:
  toda query debe filtrar por `userId`. SPEC-001 lo blinda con criterios de
  aceptación y tests; a futuro puede reforzarse con RLS.
- Auth.js v5 (NextAuth) tiene API en evolución; fijar versión.

## Alternativas consideradas
- **Supabase (Postgres + Auth + RLS):** aislamiento a nivel de fila muy atractivo,
  pero añade un segundo proveedor y su propio modelo de auth; se prefiere mantener
  auth y datos dentro del mismo stack para reducir superficie. No descartado a
  futuro si el aislamiento a nivel de app se queda corto.
- **Autohospedado (Docker + Postgres + VPS):** más control y sin límites de tier,
  pero traslada al usuario despliegue, backups y scheduler; contradice la
  preferencia por baja fricción para un proyecto personal.
- **Prisma como ORM:** más maduro y popular, pero arranque más pesado en
  serverless y cliente más grande; se rechaza frente a Drizzle por eficiencia en
  funciones. Reevaluable si el equipo prioriza DX sobre cold-start.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
