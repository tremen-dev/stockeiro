---
id: SPEC-001
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-001 Cuentas y multiusuario

## Resumen
- Fase: GREEN — los 8 CA verificados por el gate (unit + e2e en navegador). Spec a `hecho`.
- Rama: `ft/SPEC-001-cuentas-y-multiusuario`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/auth/users.ts` (registerUser) · `src/app/(auth)/actions.ts` (registerAction) · `src/app/(auth)/register/*` | `tests/users.test.ts` › "CA-1…" · **e2e** `tests/e2e/auth.spec.ts` › "CA-1: registro… redirige al panel" (📸 ca1-registro-panel.png) | **e2e en navegador (verificador):** registro → autenticado → /dashboard mostrando "Sesión iniciada como ca1@example.com". Captura inspeccionada. | ✅ |
| CA-2 | `src/lib/auth/users.ts` (registerUser, chequeo previo) · `src/lib/auth/errors.ts` (EmailAlreadyRegisteredError) | `tests/users.test.ts` › "CA-2…" · **e2e** `tests/e2e/auth.spec.ts` › "CA-2: email ya existente" (📸 ca2-email-duplicado.png) | Unit (PGlite) + e2e: 2º registro con mismo email → "Ese email ya está registrado.", sigue en /register. Captura inspeccionada. | ✅ |
| CA-3 | `src/lib/auth/users.ts` (verifyCredentials) · `src/lib/auth/config.ts` (authorize) · `src/app/(auth)/actions.ts` (loginAction) | `tests/credentials.test.ts` › "CA-3…" · **e2e** `tests/e2e/auth.spec.ts` › "CA-3…login accede al panel" (📸 ca3-login-panel.png) | **e2e:** login con credenciales válidas → /dashboard con el email del usuario. | ✅ |
| CA-4 | `src/lib/auth/users.ts` (error genérico + dummy hash) · `src/lib/auth/errors.ts` (InvalidCredentialsError) | `tests/credentials.test.ts` › "CA-4…" (3 casos) · **e2e** `tests/e2e/auth.spec.ts` › "CA-4: login inválido" (📸 ca4-login-invalido.png) | Unit prueba mensaje idéntico ante clave mala/email inexistente; e2e muestra "Email o contraseña incorrectos." en UI. Captura inspeccionada. | ✅ |
| CA-5 | `src/middleware.ts` · `src/lib/auth/guard.ts` (requireSession, isPublicPath) | `tests/guard.test.ts` › "CA-5: sin sesión → redirige a login", "isPublicPath…" | **HTTP real (next start + curl):** GET /dashboard sin sesión → 307 → /login; /login y /register → 200. `_qa/SPEC-001/http-evidence.md`. | ✅ |
| CA-6 | `src/lib/data/ownership.ts` (listForOwner, findByIdForOwner) · `src/db/schema.ts` (ancla userId) | `tests/ownership.test.ts` › 4 casos "CA-6…" | Aislamiento probado contra Postgres real (PGlite): B lista 0 filas de A; findById de recurso ajeno → null; dueño sí ve el suyo. Sin UI de entidad en esta spec (fuera de alcance): n-a e2e de UI. | ✅ |
| CA-7 | `src/app/(auth)/actions.ts` (logoutAction → signOut) · `src/lib/auth/guard.ts` | `tests/guard.test.ts` › "CA-7…" · **e2e** `tests/e2e/auth.spec.ts` › "CA-7: logout invalida la sesión" (📸 ca7-logout.png) | **e2e:** tras "Cerrar sesión" → /login; volver a /dashboard → redirige a /login (sesión invalidada). Captura inspeccionada. | ✅ |
| CA-8 | `src/db/schema.ts` (users persistente) · `src/lib/auth/users.ts` (getUserByEmail) · `src/db/client.ts` (Neon/pg swappable) | `tests/users.test.ts` › "CA-8: persistencia de identidad" | Unit: usuario recuperable desde la DB tras crearse. e2e refuerza: registro→logout→login del mismo usuario funciona (el registro persistió). | ✅ |

Gates automáticos (ejecutados por el verificador en la re-verificación): **21 unit verdes**, **4/4 e2e verdes**, `eslint` 0, `tsc --noEmit` 0, `next build` verde. Sin regresiones.

## Veredicto del verificador
**GREEN — 2026-07-13.**

Los 8 CA están cerrados con Implementado + Test + Verif. en verde. La re-verificación
resolvió el RED previo: con el cliente de datos intercambiable (RED-1) y el arnés e2e
Playwright contra Postgres real efímero (RED-2), los CA end-to-end que antes no eran
observables (CA-1, CA-3, CA-7) se ejecutaron y observaron en navegador, con capturas
que inspeccioné una a una. CA-5 quedó probado por HTTP real; CA-2/CA-4/CA-6/CA-8 por
tests contra Postgres real. Historial: RED 2026-07-13 → RED-1/RED-2 resueltos → GREEN 2026-07-13.

## Evidencia visual
Capturas regeneradas por el verificador (`npx playwright test`) en `_qa/SPEC-001/`:

| CA | Evidencia | Fichero |
|---|---|---|
| CA-1 | Panel autenticado tras registro ("Sesión iniciada como ca1@example.com") | `_qa/SPEC-001/ca1-registro-panel.png` |
| CA-2 | Error "Ese email ya está registrado." en /register | `_qa/SPEC-001/ca2-email-duplicado.png` |
| CA-3 | Panel autenticado tras login | `_qa/SPEC-001/ca3-login-panel.png` |
| CA-4 | Error genérico "Email o contraseña incorrectos." en /login | `_qa/SPEC-001/ca4-login-invalido.png` |
| CA-7 | De vuelta en /login tras cerrar sesión | `_qa/SPEC-001/ca7-logout.png` |
| CA-5 | Redirección HTTP 307 /dashboard → /login | `_qa/SPEC-001/http-evidence.md` |

## Salvedades / follow-ups
- **F-SPEC-001-1** (hardening, futuro): RLS en Postgres como refuerzo del aislamiento (ADR-001). No bloquea; CA-6 cubierto en capa de app.
- **F-SPEC-001-2** (ops, para DESPLIEGUE): aprovisionar Neon + `AUTH_SECRET` reales antes de producción. Ya NO bloquea la verificación (el e2e usa Postgres local efímero).

## Cómo retomar (handoff)
- **Cerrado (GREEN):** los 8 CA. Spec en `hecho`.
- **Antes de desplegar:** resolver F-SPEC-001-2 (Neon + AUTH_SECRET). El cierre mecánico
  (índices, archivado) lo hace `/sdd-documentalista`; el merge/PR de la rama lo decide el humano.
