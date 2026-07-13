# Contexto maestro — Stockeiro

> Documento vivo: TODO lo que un agente (o una persona) necesita para situarse.
> Se actualiza al cambiar el rumbo; la historia fina vive en ADRs y specs.

## Qué es y en qué punto está

Stockeiro es un gestor de inversiones en bolsa a largo plazo (Next.js) que
**vigila cotizaciones y avisa, no opera**: avisa cuando una acción entra en una
zona de compra/venta definida por el usuario y mantiene su cartera con P/L actual
y realizado (ver `vision.md`, FOUNDATION D-1..D-7). Estado: **EPIC-001** (núcleo:
vigilancia + avisos + cartera) en curso. **SPEC-001 (Cuentas y multiusuario)
HECHA y verificada GREEN** (8/8 CA; ver su ledger). El resto de specs de
EPIC-001 (Cartera/P/L, Zonas, Ingesta, Motor de disparo, Notificaciones, UI) aún
**sin crear** — el desglose de `_epica.md` es orientativo, no autoritativo.

## Stack y arquitectura (resumen as-built)

Lo realmente montado (decisión en **ADR-001**; ingesta en **ADR-002**):

- **Next.js 15 App Router** (React 19) sobre Vercel; Server Components + Server
  Actions. Rutas en `src/app/`: grupo `(auth)/` (login, register + `actions.ts`),
  `dashboard/`, `api/auth/[...nextauth]/route.ts`.
- **Auth.js v5 (NextAuth beta) con split-config**: `src/lib/auth/base-config.ts`
  edge-safe (solo callbacks jwt/session, sin DB ni bcrypt) para
  `src/middleware.ts`; `src/lib/auth/config.ts` en Node añade provider
  **Credentials** con bcrypt (`passwords.ts`) + Postgres. Sesión JWT.
- **Drizzle ORM** (`src/db/schema.ts`, `drizzle.config.ts`); migraciones
  versionadas (`db:generate`/`db:migrate`).
- **Cliente de datos INTERCAMBIABLE por `DB_DRIVER`** (`src/db/client.ts`):
  `neon-http` (Neon serverless) en prod / `postgres-js` en local y e2e.
- **Persistencia por entorno**: **Neon Postgres** (prod), **PGlite**
  (`src/db/test-db.ts`, unit) y **embedded-postgres** (e2e efímero).
- **Aislamiento por `userId` en capa de app** (no RLS): `src/lib/data/ownership.ts`
  (listForOwner / findByIdForOwner); `userId` como ancla en el esquema.
- **Tests**: **Vitest** (`tests/*.test.ts`, PGlite) y **Playwright** e2e
  (`tests/e2e/`, `playwright.config.ts`) contra Postgres real efímero.
- **Design system**: `design/tremen-ds` como capa de UI.
- **Scheduler** previsto: Vercel Cron para el refresco diario (ADR-001/ADR-002),
  aún no implementado.
- Env real: `.env.example` → `DATABASE_URL`, `AUTH_SECRET`; `TWELVE_DATA_API_KEY`
  para specs de ingesta.

## Decisiones clave hasta hoy
<!-- Referencias a ADR-NNN, no duplicar su contenido. -->

- **ADR-001** — Stack y plataforma: Next.js App Router en Vercel, Neon Postgres,
  Drizzle, Auth.js v5, Vercel Cron, `design/tremen-ds`.
- **ADR-002** — Ingesta de mercado: puerto `MarketDataProvider`, primer adaptador
  **Twelve Data**, registro de símbolos compartido y **caché de cotizaciones
  deduplicada** (1 símbolo = 1 llamada por ciclo), `asOf` explícito, refresco
  diario por Cron.
- **FOUNDATION D-1..D-7** (locked): avisa no opera; no tiempo real; disparo por
  **zona** (rango), no por valor; la app no calcula zonas; multiusuario aislado;
  P/L actual vs. realizado siempre separado; el instrumento es la **acción**.
- Resoluciones del gate de **SPEC-001**: política de contraseña **delegada en
  Auth.js** (sin política propia); aislamiento **en capa de app** con test (CA-6),
  **RLS a futuro** (refuerzo, no ahora); errores de login genéricos; sin
  recuperación de contraseña en esta spec.

## Riesgos y preguntas abiertas

Riesgos vigentes de EPIC-001 (`_epica.md`):

- **R-1** Fuente de datos: sin API oficial gratuita fiable en Yahoo/Google;
  mitigado por ADR-002 (Twelve Data tras puerto, proveedor intercambiable).
- **R-2** Definición formal de **"zona"** (rango [min,max] vs. umbral con
  dirección; tocar vs. cerrar dentro): abierta, debe cerrarse en la spec de zonas.
- **R-3** Latencia de aviso vs. cadencia del refresco: el ciclo elegido decide si
  se cumple CE-1 (hipótesis 1×/día tras cierre, a fijar en spec de ingesta).
- **R-4** Entrega de notificación (canal fiable, posible fallback in-app): abierto.
- **R-5** Exactitud de P/L (comisiones, ventas parciales, splits, dividendos):
  alcance inicial debe declarar qué contempla.
- **R-6** Datos personales/financieros: mitigado por SPEC-001 (auth + aislamiento).

Salvedades del ledger SPEC-001 pendientes:

- **F-SPEC-001-1** (futuro): reforzar aislamiento con **RLS** en Postgres; no
  bloquea (CA-6 cubierto en capa de app).
- **F-SPEC-001-2** (para DESPLIEGUE): aprovisionar **Neon + `AUTH_SECRET` reales**
  antes de producción; ya no bloquea la verificación (e2e usa Postgres efímero).

Preguntas abiertas pendientes de spec: definición formal de "zona" (R-2), cadencia
exacta del refresco (R-3) y canal de aviso proactivo (R-4/CE-2).
