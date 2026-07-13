---
id: SPEC-001
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-001 Cuentas y multiusuario

## Resumen
- Fase: RED-1/RED-2 resueltos por el implementador (cliente swappable + e2e Playwright contra Postgres real; 4/4 e2e verdes con capturas). Devuelto a en-revisión para re-verificación.
- Rama: `ft/SPEC-001-cuentas-y-multiusuario`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/auth/users.ts` (registerUser) · `src/app/(auth)/actions.ts` (registerAction) · `src/app/(auth)/register/*` | `tests/users.test.ts` › "CA-1…" · **e2e** `tests/e2e/auth.spec.ts` › "CA-1: registro… redirige al panel" (📸 ca1-registro-panel.png) | Alta de cuenta + hash: test verde. Página /register renderiza formulario real (curl DOM). NO observado: "queda autenticado y redirige al panel" (signIn+redirect exige DB). | ⚠️ |
| CA-2 | `src/lib/auth/users.ts` (registerUser, chequeo previo) · `src/lib/auth/errors.ts` (EmailAlreadyRegisteredError) | `tests/users.test.ts` › "CA-2…" · **e2e** `tests/e2e/auth.spec.ts` › "CA-2: email ya existente" (📸 ca2-email-duplicado.png) | Test verde contra Postgres real (PGlite): rechazo + una sola fila. Sin dimensión de navegador. | ✅ |
| CA-3 | `src/lib/auth/users.ts` (verifyCredentials) · `src/lib/auth/config.ts` (authorize) · `src/app/(auth)/actions.ts` (loginAction) | `tests/credentials.test.ts` › "CA-3…" · **e2e** `tests/e2e/auth.spec.ts` › "CA-3…login accede al panel" (📸 ca3-login-panel.png) | verifyCredentials devuelve identidad: test verde. /login renderiza. NO observado: "obtiene sesión y accede al panel" (exige DB). | ⚠️ |
| CA-4 | `src/lib/auth/users.ts` (error genérico + dummy hash) · `src/lib/auth/errors.ts` (InvalidCredentialsError) | `tests/credentials.test.ts` › "CA-4…" (3 casos) · **e2e** `tests/e2e/auth.spec.ts` › "CA-4: login inválido" (📸 ca4-login-invalido.png) | Propiedad de seguridad probada: mismo error genérico ante clave mala y email inexistente (no filtra). authorize→null determinista. | ✅ |
| CA-5 | `src/middleware.ts` · `src/lib/auth/guard.ts` (requireSession, isPublicPath) | `tests/guard.test.ts` › "CA-5: sin sesión → redirige a login", "isPublicPath…" | **Observado end-to-end (next start + curl):** GET /dashboard sin sesión → 307 → /login; /login y /register → 200. Evidencia en `_qa/SPEC-001/http-evidence.md`. | ✅ |
| CA-6 | `src/lib/data/ownership.ts` (listForOwner, findByIdForOwner) · `src/db/schema.ts` (ancla userId) | `tests/ownership.test.ts` › 4 casos "CA-6…" | Aislamiento probado contra Postgres real (PGlite): B lista 0 filas de A; findById de recurso ajeno → null; dueño sí ve el suyo. | ✅ |
| CA-7 | `src/app/(auth)/actions.ts` (logoutAction → signOut) · `src/lib/auth/guard.ts` | `tests/guard.test.ts` › "CA-7…" · **e2e** `tests/e2e/auth.spec.ts` › "CA-7: logout invalida la sesión" (📸 ca7-logout.png) | La mitad "vuelve a exigir login" está cubierta por CA-5 (ruta protegida redirige sin sesión). NO observado: signOut invalidando una sesión real (exige login previo → DB). | ⚠️ |
| CA-8 | `src/db/schema.ts` (users persistente) · `src/lib/auth/users.ts` (getUserByEmail) · `src/db/client.ts` (Neon) | `tests/users.test.ts` › "CA-8: persistencia de identidad" | Persistencia probada: el usuario se recupera desde la DB tras crearse. Esquema idéntico en Neon (prod) y PGlite (test). | ✅ |

Gates automáticos (ejecutados por el verificador): **21 tests verdes**, `eslint` 0, `tsc --noEmit` 0, `next build` verde. Sin regresiones.

## Veredicto del verificador
**RED — 2026-07-13.**

Resumen: la implementación es correcta y está bien probada a nivel de lógica y
datos (5 de 8 CA verificados, incluido CA-5 observado por HTTP real). PERO 3 CA
(**CA-1, CA-3, CA-7**) incluyen comportamiento end-to-end —creación de cuenta con
inicio de sesión y redirección al panel, login con sesión y acceso al panel, y
cierre de sesión invalidando una sesión real— que **no he podido observar** en
este entorno porque:
1. No hay base de datos aprovisionada (el driver `neon-http` exige un endpoint
   Neon; F-SPEC-001-2). Sin DB no se puede crear ni autenticar un usuario real.
2. No hay herramienta de navegación/Playwright disponible para el flujo de UI.

No es un defecto de código detectado: es evidencia ausente. Por regla del gate
("un CA está ✅ solo con Verif. en verde; salvedad = ⚠️; si dudas, devuelves"),
no puedo cerrar en GREEN con 3 CA sin observar.

### Findings accionables (para reabrir el gate en verde)
- **RED-1**: habilitar verificación end-to-end. Aprovisionar una DB de test/preview
  (Neon) O hacer el cliente de datos intercambiable para levantar la app real
  contra Postgres local/PGlite en e2e. (Toca a implementador/ops; ADR-001.)
- **RED-2**: añadir un e2e (Playwright) que ejercite en navegador: registro →
  panel (CA-1), login → panel (CA-3), logout → la ruta protegida vuelve a exigir
  login (CA-7), y aislamiento entre dos usuarios por la UI (refuerzo de CA-6).
- Tras RED-1/RED-2, re-verificar CA-1/CA-3/CA-7 y capturar PNG por CA en `_qa/SPEC-001/`.

### Alternativa (decisión del humano/orquestador)
Dado que el bloqueo es de entorno y no un defecto, el humano PUEDE aceptar las
salvedades ⚠️ de CA-1/CA-3/CA-7 como deuda de verificación (a saldar cuando se
aprovisione la DB) y autorizar el avance. Esa aceptación es suya, no mía: yo, como
juez, reporto lo que pude observar.

## Evidencia visual
No hay capturas de navegador (sin herramienta Playwright en este entorno). Evidencia HTTP real registrada en su lugar:

| CA | Evidencia | Ubicación |
|---|---|---|
| CA-5 | Redirección real 307 /dashboard → /login; /login y /register 200 | `_qa/SPEC-001/http-evidence.md` |
| CA-1/CA-3 | DOM real de /register y /login con formularios email+password y labels en español | (curl DOM, ver veredicto) |

## Salvedades / follow-ups
- **F-SPEC-001-1** (hardening, futuro): RLS en Postgres como refuerzo del aislamiento (ADR-001).
- **F-SPEC-001-2** (ops, BLOQUEANTE para e2e): aprovisionar Neon + `AUTH_SECRET` real. Es la causa raíz de RED-1.

## Respuesta del implementador al RED (2026-07-13)
- **RED-1 resuelto:** `src/db/client.ts` ahora es intercambiable por `DB_DRIVER`
  (`neon` prod / `pg` local con postgres-js). No requiere aprovisionar Neon para
  verificar: el e2e levanta un Postgres real efímero con `embedded-postgres`.
- **RED-2 resuelto:** e2e Playwright (`tests/e2e/auth.spec.ts`) contra la app real
  (`next start`) + Postgres real (`tests/e2e/server.mjs`). **4/4 tests verdes**,
  con capturas por CA en `_qa/SPEC-001/`. Cubre end-to-end CA-1 (registro→panel),
  CA-2 (email duplicado), CA-3 (login→panel), CA-4 (error genérico), CA-7
  (logout invalida sesión + ruta protegida re-exige login).
- Gates: 21 unit verdes, `eslint` 0, `tsc` 0, `next build` verde. Sin regresiones.
- Nota CA-6 UI: no hay entidad de dominio con UI en esta spec (fuera de alcance),
  así que el aislamiento se prueba a nivel de datos (`tests/ownership.test.ts`);
  no aplica un e2e de UI aquí.

## Cómo retomar (handoff)
- **Listo para re-verificación:** los 8 CA tienen ahora Implementado + Test
  (unit y, donde aplica, e2e en navegador con captura).
- **Dónde seguir:** re-lanzar `/sdd-verificador` para que reevalúe CA-1/CA-3/CA-7
  con el e2e (comando: `npx playwright test`; capturas en `_qa/SPEC-001/`),
  rellene Verif./Estado y emita GREEN/RED.
- **F-SPEC-001-2** (ops) sigue pendiente para el DESPLIEGUE real (Neon + AUTH_SECRET),
  pero ya NO bloquea la verificación.
