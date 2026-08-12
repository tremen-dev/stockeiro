---
id: SPEC-023
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-023 Recuperacion de contrasena por email

## Resumen
- Fase: en-revisión — implementación completa, pendiente del gate del verificador.
  <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-023-recuperacion-de-contrasena-por-email` (sin push ni PR: F-SPEC-023-1)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 respuesta genérica exista o no la cuenta | `src/lib/auth/password-reset.ts` (`requestPasswordReset`) · `src/app/(auth)/actions.ts` (`requestPasswordResetAction`) · `src/lib/auth/reset-messages.ts` (`RECUPERACION_ENVIADA`) · `src/app/(auth)/forgot-password/` | `tests/password-reset.test.ts` › «CA-1: …» (3 casos) · `tests/e2e/recuperacion.spec.ts` › «CA-1: la respuesta es la misma con cuenta y sin cuenta, y sin cuenta no hay correo» | | ❌ |
| CA-2 indistinguibilidad temporal (envío fuera del camino de respuesta) | `src/lib/auth/password-reset.ts` (`defer`, `PasswordResetRequest.delivery`) · `src/app/(auth)/actions.ts` (`after()`) | `tests/password-reset.test.ts` › «CA-2: …» → «al retornar, el sender aún NO ha sido invocado…» y «ambas ramas responden por debajo de la latencia inyectada» | | ❌ |
| CA-3 correo por el puerto, con enlace, y sin fila in-app | `src/lib/auth/password-reset.ts` (`resetEmailBody`, envío por `NotificationSender`) · `src/lib/notifications/sender-factory.ts` | `tests/password-reset.test.ts` › «CA-3: …» (2 casos, incl. `notifications` vacía) · `tests/e2e/recuperacion.spec.ts` › «CA-3 + CA-6 + CA-14: …» | | ❌ |
| CA-4 origen del enlace desde `APP_BASE_URL`, no desde `Host` | `src/lib/config/app-url.ts` (`appBaseUrl`, `buildResetUrl`) · `src/app/(auth)/actions.ts` | `tests/password-reset.test.ts` › «CA-4: el enlace usa APP_BASE_URL aunque el Host de la petición esté falsificado» · `tests/e2e/recuperacion.spec.ts` (aserción sobre el origen del enlace recibido) | | ❌ |
| CA-5 el token no se almacena en claro | `src/lib/auth/reset-tokens.ts` (`generateResetToken`, `hashResetToken`) · `src/db/schema.ts` (`passwordResetTokens.tokenHash`) | `tests/password-reset.test.ts` › «CA-5: ninguna columna persistida contiene el token en claro» | | ❌ |
| CA-6 el enlace válido establece la contraseña nueva | `src/lib/auth/password-reset.ts` (`resetPasswordWithToken`) · `src/app/(auth)/reset-password/[token]/` | `tests/password-reset.test.ts` › «CA-6: …» (3 casos) · `tests/e2e/recuperacion.spec.ts` › «CA-3 + CA-6 + CA-14: …» | | ❌ |
| CA-7 un solo uso, atómico ante envíos simultáneos | `src/lib/auth/password-reset.ts` (`UPDATE … WHERE consumed_at IS NULL AND expires_at > now() RETURNING`) | `tests/password-reset.test.ts` › «CA-7: …» → «reusar un token consumido no cambia la contraseña» y «dos envíos simultáneos del mismo token: exactamente uno cambia la contraseña» · `tests/e2e/recuperacion.spec.ts` › «CA-10 + CA-7 + CA-9: …» | | ❌ |
| CA-8 caducidad (30 min) | `src/lib/auth/reset-tokens.ts` (`RESET_TOKEN_TTL_MINUTES`, `resetTokenExpiry`) · `src/lib/auth/password-reset.ts` | `tests/password-reset.test.ts` › «CA-8: …» (2 casos: ventana persistida y token caducado) | | ❌ |
| CA-9 enlace inexistente o manipulado: misma respuesta | `src/lib/auth/password-reset.ts` (`reason: 'invalid-token'` único) · `src/lib/auth/reset-messages.ts` (`ENLACE_NO_VALIDO`) | `tests/password-reset.test.ts` › «CA-9: …» (2 casos, incl. igualdad estricta entre inexistente/reusado/caducado) · `tests/e2e/recuperacion.spec.ts` › «CA-10 + CA-7 + CA-9: …» (compara los textos renderizados) | | ❌ |
| CA-10 el GET no consume el token | `src/lib/auth/password-reset.ts` (`isResetTokenUsable`) · `src/app/(auth)/reset-password/[token]/page.tsx` | `tests/password-reset.test.ts` › «CA-10: comprobar el token (GET) lo deja usable y luego el envío sí lo consume» · `tests/e2e/recuperacion.spec.ts` › «CA-10 + CA-7 + CA-9: …» (3 visitas al enlace) | | ❌ |
| CA-11 una solicitud nueva invalida la anterior | `src/lib/auth/password-reset.ts` (`invalidateLiveTokens` antes de emitir) | `tests/password-reset.test.ts` › «CA-11: solo el último enlace es usable» · `tests/e2e/recuperacion.spec.ts` › «CA-11: pedir un enlace nuevo mata al anterior» | | ❌ |
| CA-12 límite 3/hora por cuenta, invisible en la respuesta | `src/lib/auth/password-reset.ts` (conteo en ventana) · `src/lib/auth/reset-tokens.ts` (`RESET_REQUEST_LIMIT`, `RESET_REQUEST_WINDOW_MINUTES`) | `tests/password-reset.test.ts` › «CA-12: …» (4 casos: cuarta bloqueada, respuesta indistinguible, ventana que expira, límite por cuenta) | | ❌ |
| CA-13 las sesiones anteriores dejan de valer (R-4) | `src/lib/auth/session-epoch.ts` (pura) · `src/lib/auth/session-boundary.ts` (frontera Node) · `src/lib/auth/config.ts` · `src/lib/auth/base-config.ts` · `src/lib/auth/session.ts` (`requireUser`) · `src/db/schema.ts` (`users.passwordChangedAt`) | Unidad: `tests/session-epoch.test.ts` › «CA-13 (unidad): …» (4 casos) · Integración: idem › «CA-13 / CA-14 (integración): …» (4 casos) · e2e con **dos contextos de navegador**: `tests/e2e/recuperacion.spec.ts` › «CA-13: la sesión abierta en otro navegador deja de valer tras el reset» | | ❌ |
| CA-14 sin auto-login tras el reset; la sesión nueva sí vale | `src/app/(auth)/actions.ts` (`redirect('/login?reset=1')`, sin `signIn`) · `src/app/(auth)/login/page.tsx` | `tests/session-epoch.test.ts` › «CA-14: la sesión NUEVA, iniciada con la contraseña nueva, sí vale» · `tests/e2e/recuperacion.spec.ts` › «CA-3 + CA-6 + CA-14: …» (aterriza en `/login?reset=1`, `/dashboard` sigue rebotando) | | ❌ |
| CA-15 rutas públicas declaradas y acotadas | `src/lib/auth/guard.ts` (`PUBLIC_PREFIXES` exportado). `src/proxy.ts` sin cambios | `tests/guard.test.ts` › «CA-15: …» (4 casos, incl. `/reset-passwordX` no pública) · `tests/e2e/recuperacion.spec.ts` › «CA-15: las rutas de recuperación son públicas y las de datos siguen protegidas» | | ❌ |
| CA-16 sin regresión y sin política de contraseña nueva | `src/lib/auth/validation.ts` (`newPasswordSchema = credentialsSchema.shape.password`) | `tests/password-reset.test.ts` › «CA-16: …» (4 casos, incl. identidad del esquema) · Suite completa: 253/253 unidad, 24/24 e2e (SPEC-001 CA-1..CA-8 incluidos) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-023/. Informe HTML opcional: _qa/SPEC-023/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-023-1, F-SPEC-023-2… con destino (spec futura o EPIC-MEJORA). -->
Pre-registradas por sdd-arquitecto en la spec (§ Salvedades y follow-ups); el detalle vive allí.

| ID | Qué | Destino |
|---|---|---|
| F-SPEC-023-1 | Preview comparte `DATABASE_URL` con Production y el build migra siempre → abrir la PR de esta spec **migra producción**. Las dos migraciones son aditivas y compatibles hacia atrás, pero el riesgo es real. | Ops / runbook §6 · decisión del humano sobre cuándo se abre la PR |
| F-SPEC-023-2 | Nada purga los tokens caducados o consumidos de `password_reset_tokens`. | EPIC-MEJORA (o el cron diario ya existente) |
| F-SPEC-023-3 | Variable nueva `APP_BASE_URL` en Vercel; si falta o apunta mal, los enlaces no funcionan. Viaja con **F-SPEC-006-1** (Resend con dominio verificado, 🔴 bloqueante). | Ops / despliegue |
| F-SPEC-023-4 | Correo de aviso "tu contraseña ha cambiado" tras el reset. | Spec futura de EPIC-003 o EPIC-MEJORA |
| F-SPEC-023-5 | Residual asumido de CE-2: la rama del email registrado hace un `INSERT` que la otra no (sub-ms, bajo el ruido de red). Mismo tipo de residuo que ya asume `verifyCredentials`. | Asumido, sin destino |

Añadidas durante la implementación (sdd-implementador):

| ID | Qué | Destino |
|---|---|---|
| F-SPEC-023-6 | `/api/cron/refresh` sigue instanciando `new ResendSender()` a mano en vez de usar la fábrica nueva `resolveNotificationSender()`. No es un defecto (el cron no necesita el desvío de e2e), pero deja dos sitios que eligen adaptador. Unificar es un cambio de una línea. | EPIC-MEJORA |
| F-SPEC-023-7 | Las **server actions** protegidas (`cartera`, `vigiladas`, `avisos`) siguen resolviendo la sesión revocada como `throw new Error('No autenticado')`, no como redirect. No sirven ni un dato (RN-01 intacto) y el efecto lo absorbe la página, pero el trato no es homogéneo con `requireUser()`. | EPIC-MEJORA |
| F-SPEC-023-8 | El e2e necesita leer el correo, y la app corre en otro proceso: se añadió `OutboxFileSender` + `E2E_OUTBOX_FILE` (buzón en disco, nunca Resend). Es el mismo patrón que `E2E_FAKE_QUOTES`/`E2E_FAKE_SYMBOL_SEARCH`, pero conviene que quien audite sepa que existe una vía de desvío del correo activable por variable de entorno. | Nota de seguridad · revisar que la variable no exista en Vercel |

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Estado: los 16 CA implementados con test. Nada pendiente de código.** 5 commits en
`ft/SPEC-023-recuperacion-de-contrasena-por-email`, **sin push y sin PR** (F-SPEC-023-1: la
decisión de cuándo se abre es del humano, porque abrirla migra producción).

**Cómo reproducir la verificación**

```
npm run typecheck                 # limpio
npm test                          # 253/253 en 30 ficheros
DATABASE_URL="postgres://postgres:postgres@localhost:54329/stockeiro_e2e" \
  DB_DRIVER=pg AUTH_SECRET="build-only-secret-0123456789" npm run build
npx playwright test               # 24/24; las capturas caen en _qa/SPEC-023/
```

El e2e necesita un `build` previo (`next start`), y el build exige `DATABASE_URL`. Usa la
URL del Postgres efímero de arriba — **nunca** una que pueda apuntar a producción, y **no
ejecutes `db:migrate`** (F-SPEC-023-1).

**Migración**: `drizzle/0006_chemical_chronomancer.sql`, aditiva (`CREATE TABLE
password_reset_tokens`, `ADD COLUMN users.password_changed_at NOT NULL DEFAULT now()`). El
esquema está duplicado a mano en tres sitios que hay que mantener en sincronía:
`src/db/schema.ts`, `src/db/test-db.ts`, `tests/e2e/server.mjs` — y `tests/ownership.test.ts`
lleva su propio DDL de `users`.

**Dónde mirar primero si algo falla**

- `src/lib/auth/password-reset.ts` — motor completo (solicitud, consumo atómico, límite).
- `src/lib/auth/session-boundary.ts` — la frontera Node de ADR-016; si una sesión válida
  dejara de resolver, es aquí.
- `src/lib/auth/session.ts` (`requireUser`) — lo que traduce "sesión revocada" a redirect.

**Prerrequisitos de despliegue (no bloquean la verificación, sí el valor en producción)**:
`APP_BASE_URL` (F-SPEC-023-3) y Resend con dominio verificado (F-SPEC-006-1, 🔴). Y ADR-016
pto. 6: **el día del despliegue todo el mundo tiene que volver a iniciar sesión una vez**.

**Cobertura por nivel, para que el verificador no la busque**: CA-2, CA-5, CA-8 y CA-12 se
verifican solo en unidad/integración (no tienen dimensión de navegador observable); CA-12 en
concreto es invisible por diseño, así que un e2e no podría distinguirlo de CA-1. El resto
tiene además e2e.

**Fuera de mis commits, a propósito**: `docs/fundacion/dominio.md` (mezcla filas de SPEC-023
y de SPEC-022), `docs/roadmap.md` y `docs/epicas/EPIC-MEJORA/` — trabajo ajeno en vuelo.
