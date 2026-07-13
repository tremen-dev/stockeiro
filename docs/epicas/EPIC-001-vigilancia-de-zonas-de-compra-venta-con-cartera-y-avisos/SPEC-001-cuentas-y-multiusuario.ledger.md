---
id: SPEC-001
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-001 Cuentas y multiusuario

## Resumen
- Fase: en-revisión (implementación completa con tests en verde; pendiente de verificación adversarial).
- Rama: `ft/SPEC-001-cuentas-y-multiusuario`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/auth/users.ts` (registerUser) · `src/app/(auth)/actions.ts` (registerAction) · `src/app/(auth)/register/*` | `tests/users.test.ts` › "CA-1: crea una cuenta…", "CA-1: normaliza el email…" | | ❌ |
| CA-2 | `src/lib/auth/users.ts` (registerUser, chequeo previo) · `src/lib/auth/errors.ts` (EmailAlreadyRegisteredError) | `tests/users.test.ts` › "CA-2: rechaza email ya registrado…", "CA-2: detecta duplicado…" | | ❌ |
| CA-3 | `src/lib/auth/users.ts` (verifyCredentials) · `src/lib/auth/config.ts` (authorize) · `src/app/(auth)/actions.ts` (loginAction) | `tests/credentials.test.ts` › "CA-3: credenciales válidas…", "CA-3: acepta el email con distinto casing…" | | ❌ |
| CA-4 | `src/lib/auth/users.ts` (error genérico + dummy hash) · `src/lib/auth/errors.ts` (InvalidCredentialsError) | `tests/credentials.test.ts` › "CA-4: contraseña incorrecta…", "CA-4: email inexistente…", "CA-4: el mensaje NO revela…" | | ❌ |
| CA-5 | `src/middleware.ts` · `src/lib/auth/guard.ts` (requireSession, isPublicPath) | `tests/guard.test.ts` › "CA-5: sin sesión → redirige a login", "isPublicPath…" | | ❌ |
| CA-6 | `src/lib/data/ownership.ts` (listForOwner, findByIdForOwner) · `src/db/schema.ts` (ancla userId) | `tests/ownership.test.ts` › 4 casos "CA-6…" | | ❌ |
| CA-7 | `src/app/(auth)/actions.ts` (logoutAction → signOut) · `src/lib/auth/guard.ts` | `tests/guard.test.ts` › "CA-7: tras cerrar sesión… vuelve a exigir login" | | ❌ |
| CA-8 | `src/db/schema.ts` (users persistente) · `src/lib/auth/users.ts` (getUserByEmail) · `src/db/client.ts` (Neon) | `tests/users.test.ts` › "CA-8: persistencia de identidad" | | ❌ |

Cobertura automática: **21 tests en verde** (Vitest + PGlite). `tsc --noEmit` limpio.
Build de producción (`next build`) en verde y middleware edge-safe (bcrypt fuera del bundle Edge).

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-001/. Informe HTML opcional: _qa/SPEC-001/informe.html -->
Pendiente: capturas del flujo real (registro → panel → logout → ruta protegida) las aporta sdd-verificador con Playwright.

## Salvedades / follow-ups
- **F-SPEC-001-1** (hardening, futuro): reforzar el aislamiento con Row Level
  Security a nivel de Postgres (ADR-001 lo dejó como refuerzo posterior). Hoy el
  aislamiento vive en la capa de app vía `ownership.ts` (CA-6 lo cubre con test).
- **F-SPEC-001-2** (ops, previo a desplegar): aprovisionar el proyecto Neon y un
  `AUTH_SECRET` real; hoy el build se validó con env dummy. No afecta a los CA.
- Nota: los tests de CA-5/CA-7 prueban la lógica de guard/logout a nivel unitario
  (misma función que corre en el middleware). El flujo end-to-end en navegador
  (redirección real, cookie de sesión, sesión invalidada tras logout) es trabajo
  del verificador con Playwright.

## Cómo retomar (handoff)
- **Qué está hecho:** los 8 CA implementados con test automático (21 verdes),
  typecheck limpio y `next build` OK. Stack montado según ADR-001 (Next.js App
  Router, Auth.js v5 split-config, Drizzle, bcryptjs; Neon en prod, PGlite en
  test). UI de login/register/dashboard con tremen-ds.
- **Qué falta (verificador):** verificación adversarial de CA-5, CA-7 y CA-6 en
  navegador con Playwright; capturas en `_qa/SPEC-001/`; rellenar columnas Verif.
  y Estado y emitir GREEN/RED. Para arrancar la app: crear `.env` desde
  `.env.example` (DATABASE_URL de Neon + `npx auth secret`), `npm run dev`.
- **Dónde seguir:** matriz de CA arriba (cada fila apunta a su fichero y su test).
