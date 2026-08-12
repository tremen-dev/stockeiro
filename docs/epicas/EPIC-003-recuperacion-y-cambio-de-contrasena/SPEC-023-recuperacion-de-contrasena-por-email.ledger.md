---
id: SPEC-023
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-023 Recuperacion de contrasena por email

## Resumen
- Fase: hecho — **GREEN** del verificador el 2026-08-12 (16/16 CA).
  <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-023-recuperacion-de-contrasena-por-email` (sin push ni PR: F-SPEC-023-1)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 respuesta genérica exista o no la cuenta | `src/lib/auth/password-reset.ts` (`requestPasswordReset`) · `src/app/(auth)/actions.ts` (`requestPasswordResetAction`) · `src/lib/auth/reset-messages.ts` (`RECUPERACION_ENVIADA`) · `src/app/(auth)/forgot-password/` | `tests/password-reset.test.ts` › «CA-1: …» (3 casos) · `tests/e2e/recuperacion.spec.ts` › «CA-1: la respuesta es la misma con cuenta y sin cuenta, y sin cuenta no hay correo» | `npm test` 253/253 · `npx playwright test` 24/24. **Sonda propia** en navegador real contra el servidor e2e: el acuse con cuenta y el acuse sin cuenta son idénticos byte a byte, mismo destino (`/forgot-password`), y el buzón (`.e2e-outbox.jsonl`) registra **0** mensajes para el email inventado. | ✅ |
| CA-2 indistinguibilidad temporal (envío fuera del camino de respuesta) | `src/lib/auth/password-reset.ts` (`defer`, `PasswordResetRequest.delivery`) · `src/app/(auth)/actions.ts` (`after()`) | `tests/password-reset.test.ts` › «CA-2: …» → «al retornar, el sender aún NO ha sido invocado…» y «ambas ramas responden por debajo de la latencia inyectada» | Leído `defer()`: es una macrotarea (`setTimeout(…,0)`), no un `.then()` sobre promesa resuelta, así que al retornar el sender **no** ha sido invocado — el test lo demuestra con `expect(slow.sent).toHaveLength(0)` antes de `await delivery`. **Medición propia por HTTP real** (3 pares alternados): con cuenta [198, 377, 271] ms · sin cuenta [353, 350, 408] ms → medianas 271 vs 350 ms, sin señal explotable. | ✅ |
| CA-3 correo por el puerto, con enlace, y sin fila in-app | `src/lib/auth/password-reset.ts` (`resetEmailBody`, envío por `NotificationSender`) · `src/lib/notifications/sender-factory.ts` | `tests/password-reset.test.ts` › «CA-3: …» (2 casos, incl. `notifications` vacía) · `tests/e2e/recuperacion.spec.ts` › «CA-3 + CA-6 + CA-14: …» | Sonda propia contra el Postgres efímero: tras una solicitud hay **exactamente 1** mensaje en el buzón, dirigido al email almacenado, con URL absoluta y token en claro; `SELECT count(*) FROM notifications` = **0**. | ✅ |
| CA-4 origen del enlace desde `APP_BASE_URL`, no desde `Host` | `src/lib/config/app-url.ts` (`appBaseUrl`, `buildResetUrl`) · `src/app/(auth)/actions.ts` | `tests/password-reset.test.ts` › «CA-4: el enlace usa APP_BASE_URL aunque el Host de la petición esté falsificado» · `tests/e2e/recuperacion.spec.ts` (aserción sobre el origen del enlace recibido) | **Sonda decisiva**: replay del POST real del formulario con `Host: atacante.example`, `X-Forwarded-Host: atacante.example`, `Origin`/`Referer: https://atacante.example`, sobre el servidor con `AUTH_TRUST_HOST=true` → HTTP 200 con el acuse genérico y enlace `http://localhost:3200/reset-password/ISQcALKZckCDgyWUxjG-arnvkrO33Z0hmtXd6MWpNPQ`; el cuerpo del correo **no menciona** `atacante.example`. Además, `grep` sobre `src/` confirma que no existe ninguna llamada a `headers()` ni lectura de `x-forwarded-host`: `appBaseUrl()` solo lee `process.env.APP_BASE_URL`. | ✅ |
| CA-5 el token no se almacena en claro | `src/lib/auth/reset-tokens.ts` (`generateResetToken`, `hashResetToken`) · `src/db/schema.ts` (`passwordResetTokens.tokenHash`) | `tests/password-reset.test.ts` › «CA-5: ninguna columna persistida contiene el token en claro» | `SELECT *` sobre `password_reset_tokens` en **Postgres real**: ninguna columna contiene el token en claro (ni igual ni como substring); `token_hash` coincide exactamente con `sha256(token)` en hex. Con la base sola no se reconstruye ningún enlace. | ✅ |
| CA-6 el enlace válido establece la contraseña nueva | `src/lib/auth/password-reset.ts` (`resetPasswordWithToken`) · `src/app/(auth)/reset-password/[token]/` | `tests/password-reset.test.ts` › «CA-6: …» (3 casos) · `tests/e2e/recuperacion.spec.ts` › «CA-3 + CA-6 + CA-14: …» | Flujo real en navegador (suyo y mío): con la contraseña nueva entra a `/dashboard`; con la anterior, error genérico de login. Email y `created_at` intactos (RN-02/RN-01). El barrido de los demás tokens vivos se comprueba en unidad. | ✅ |
| CA-7 un solo uso, atómico ante envíos simultáneos | `src/lib/auth/password-reset.ts` (`UPDATE … WHERE consumed_at IS NULL AND expires_at > now() RETURNING`) | `tests/password-reset.test.ts` › «CA-7: …» → «reusar un token consumido no cambia la contraseña» y «dos envíos simultáneos del mismo token: exactamente uno cambia la contraseña» · `tests/e2e/recuperacion.spec.ts` › «CA-10 + CA-7 + CA-9: …» | El consumo es **una sola** sentencia condicional (`UPDATE … WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > now() RETURNING user_id`), no un lee-comprueba-escribe. **Carrera ejercida contra Postgres real** (no PGlite): dos POST simultáneos del mismo enlace con contraseñas distintas → A responde 303 → `/login?reset=1`, B responde 200 con «Este enlace no es válido»; 1 fila, 1 `consumed_at`; después vale A, **no** vale B y **no** vale la anterior. | ✅ |
| CA-8 caducidad (30 min) | `src/lib/auth/reset-tokens.ts` (`RESET_TOKEN_TTL_MINUTES`, `resetTokenExpiry`) · `src/lib/auth/password-reset.ts` | `tests/password-reset.test.ts` › «CA-8: …» (2 casos: ventana persistida y token caducado) | `RESET_TOKEN_TTL_MINUTES = 30` en constante única. Medido en **Postgres real**: `expires_at - created_at` = **29,99992 min**. Con la ventana vencida, `isResetTokenUsable` = false y el envío devuelve `invalid-token` sin tocar la contraseña. Sin dimensión de navegador observable (haría falta viajar en el tiempo), verificado en integración. | ✅ |
| CA-9 enlace inexistente o manipulado: misma respuesta | `src/lib/auth/password-reset.ts` (`reason: 'invalid-token'` único) · `src/lib/auth/reset-messages.ts` (`ENLACE_NO_VALIDO`) | `tests/password-reset.test.ts` › «CA-9: …» (2 casos, incl. igualdad estricta entre inexistente/reusado/caducado) · `tests/e2e/recuperacion.spec.ts` › «CA-10 + CA-7 + CA-9: …» (compara los textos renderizados) | Sonda propia en navegador: enlace **usado**, enlace **inexistente** y enlace **manipulado** (último carácter alterado) devuelven los tres HTTP 200 con h1 «Enlace no válido» y la misma nota, idénticos byte a byte. Ninguno distingue «caducado» (resolución 2 del gate honrada). | ✅ |
| CA-10 el GET no consume el token | `src/lib/auth/password-reset.ts` (`isResetTokenUsable`) · `src/app/(auth)/reset-password/[token]/page.tsx` | `tests/password-reset.test.ts` › «CA-10: comprobar el token (GET) lo deja usable y luego el envío sí lo consume» · `tests/e2e/recuperacion.spec.ts` › «CA-10 + CA-7 + CA-9: …» (3 visitas al enlace) | Sonda propia: tras **3 GET** al enlace, `SELECT consumed_at` en Postgres real sigue devolviendo `NULL`; el envío posterior del formulario sí lo consume. El GET solo llama a `isResetTokenUsable` (SELECT), no a `resetPasswordWithToken`. | ✅ |
| CA-11 una solicitud nueva invalida la anterior | `src/lib/auth/password-reset.ts` (`invalidateLiveTokens` antes de emitir) | `tests/password-reset.test.ts` › «CA-11: solo el último enlace es usable» · `tests/e2e/recuperacion.spec.ts` › «CA-11: pedir un enlace nuevo mata al anterior» | e2e verde en mi ejecución: el primer enlace pasa a «Enlace no válido» en cuanto llega el segundo, y solo el último abre el formulario. `invalidateLiveTokens` corre **antes** del `INSERT`, así que nunca hay dos llaves vivas. Captura `ca11-solo-el-ultimo-vale.png`. | ✅ |
| CA-12 límite 3/hora por cuenta, invisible en la respuesta | `src/lib/auth/password-reset.ts` (conteo en ventana) · `src/lib/auth/reset-tokens.ts` (`RESET_REQUEST_LIMIT`, `RESET_REQUEST_WINDOW_MINUTES`) | `tests/password-reset.test.ts` › «CA-12: …» (4 casos: cuarta bloqueada, respuesta indistinguible, ventana que expira, límite por cuenta) | Sonda propia en navegador real: 4 solicitudes seguidas para la misma cuenta → **3** correos y **3** tokens en base; los 4 acuses renderizados son idénticos entre sí **y** idénticos al acuse genérico de CA-1. Ninguna mención de límite en pantalla. Constantes `RESET_REQUEST_LIMIT = 3`, `RESET_REQUEST_WINDOW_MINUTES = 60`. | ✅ |
| CA-13 las sesiones anteriores dejan de valer (R-4) | `src/lib/auth/session-epoch.ts` (pura) · `src/lib/auth/session-boundary.ts` (frontera Node) · `src/lib/auth/config.ts` · `src/lib/auth/base-config.ts` · `src/lib/auth/session.ts` (`requireUser`) · `src/db/schema.ts` (`users.passwordChangedAt`) | Unidad: `tests/session-epoch.test.ts` › «CA-13 (unidad): …» (4 casos) · Integración: idem › «CA-13 / CA-14 (integración): …» (4 casos) · e2e con **dos contextos de navegador**: `tests/e2e/recuperacion.spec.ts` › «CA-13: la sesión abierta en otro navegador deja de valer tras el reset» | Los tres niveles verdes en mi ejecución. Además, **sonda propia por HTTP crudo con la cookie previa** (sin JS, sin cliente, saltándose cualquier redirect pintado en el navegador): antes del reset `/dashboard` responde 200 con el email del usuario; después del reset, `/dashboard`, `/cartera`, `/vigiladas` y `/avisos` responden **307 → /login** y ningún cuerpo contiene datos del usuario. `password_changed_at ≠ created_at` tras el reset. | ✅ |
| CA-14 sin auto-login tras el reset; la sesión nueva sí vale | `src/app/(auth)/actions.ts` (`redirect('/login?reset=1')`, sin `signIn`) · `src/app/(auth)/login/page.tsx` | `tests/session-epoch.test.ts` › «CA-14: la sesión NUEVA, iniciada con la contraseña nueva, sí vale» · `tests/e2e/recuperacion.spec.ts` › «CA-3 + CA-6 + CA-14: …» (aterriza en `/login?reset=1`, `/dashboard` sigue rebotando) | e2e verde: tras guardar la contraseña el usuario acaba en `/login?reset=1` con la confirmación y `/dashboard` **sigue** rebotando a login (la ruta pública no emite sesión); al entrar con la nueva, sesión válida y datos con normalidad. `resetPasswordAction` no llama a `signIn` en ninguna rama. Capturas `login-reset-desktop.png` / `login-reset-movil.png`. | ✅ |
| CA-15 rutas públicas declaradas y acotadas | `src/lib/auth/guard.ts` (`PUBLIC_PREFIXES` exportado). `src/proxy.ts` sin cambios | `tests/guard.test.ts` › «CA-15: …» (4 casos, incl. `/reset-passwordX` no pública) · `tests/e2e/recuperacion.spec.ts` › «CA-15: las rutas de recuperación son públicas y las de datos siguen protegidas» | Sonda propia **contra el middleware real**, contexto limpio sin cookies: `/reset-passwordX`, `/forgot-passwordX`, `/reset-password-admin`, `/dashboard`, `/cartera`, `/vigiladas`, `/avisos` y `/cartera/importar` acaban las ocho en `/login`; `/forgot-password` y `/reset-password/<token>` no rebotan. El emparejamiento es por segmento completo (`p` o `p + '/'`), no `startsWith` a secas. `src/proxy.ts` sin cambios. | ✅ |
| CA-16 sin regresión y sin política de contraseña nueva | `src/lib/auth/validation.ts` (`newPasswordSchema = credentialsSchema.shape.password`) | `tests/password-reset.test.ts` › «CA-16: …» (4 casos, incl. identidad del esquema) · Suite completa: 253/253 unidad, 24/24 e2e (SPEC-001 CA-1..CA-8 incluidos) | Reejecutado por mí: `npm run typecheck` limpio · `npm test` **253/253 en 30 ficheros** (98,93 s) · `npx playwright test` **24/24** (1,4 min), con `tests/e2e/auth.spec.ts` (SPEC-001 CA-1..CA-8) y `tests/ownership.test.ts` (RN-01) verdes · `npx eslint .` **0 errores** (1 warning preexistente en `tests/position.test.ts`, ajeno a esta spec). `newPasswordSchema === credentialsSchema.shape.password` es identidad de referencia, no copia: no cabe una regla de complejidad nueva sin romper ese test. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-12 — sdd-verificador. 16/16 CA ✅, ninguna salvedad.**

**Gates automáticos** (ejecutados por mí en la rama `ft/SPEC-023-recuperacion-de-contrasena-por-email`,
worktree `deploy-main`, sin tocar código):

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` | limpio |
| Unidad/integración | `npm test` | **253/253** en 30 ficheros (98,93 s) |
| Lint | `npx eslint .` | **0 errores**, 1 warning preexistente (`tests/position.test.ts`, ajeno) |
| Build | `DATABASE_URL=<pg efímero> DB_DRIVER=pg AUTH_SECRET=… APP_BASE_URL=http://localhost:3200 npm run build` | OK; `/forgot-password` estática, `/reset-password/[token]` dinámica |
| e2e | `npx playwright test` | **24/24** (1,4 min), Postgres efímero + correo al buzón en disco |

Nunca se llamó a la API de Resend: el único adaptador activo en e2e es `OutboxFileSender`
(`E2E_OUTBOX_FILE`), que extiende `FakeNotificationSender`. No se ejecutó `db:migrate`
contra ninguna `DATABASE_URL` (F-SPEC-023-1 respetado).

**Las cuatro resoluciones del gate humano se cumplen, comprobadas una a una:**

1. **Sí se invalidan las sesiones previas** (ADR-016 completo): la cookie de un navegador
   anterior deja de servir datos por HTTP crudo — 307 a `/login` en las cuatro rutas de datos.
2. **Mensaje único** para usado / caducado / inexistente / manipulado: los cuatro renderizan
   el mismo h1 y la misma nota, byte a byte, con HTTP 200.
3. **Sin auto-login**: `resetPasswordAction` termina en `redirect('/login?reset=1')` y no
   invoca `signIn` en ninguna rama; `/dashboard` sigue rebotando justo después del reset.
4. **30 min / 3 por hora / 1 enlace vivo**: ventana medida en Postgres real = 29,99992 min;
   la 4ª solicitud de la hora no emite token ni correo y responde igual; `invalidateLiveTokens`
   corre antes del `INSERT`, así que nunca hay dos llaves vivas.

**ADR-001 intacto (comprobado sobre el bundle, no sobre la intención).** El chunk del
middleware (`.next/server/chunks/[root-of-the-server]__0g_x3fw._.js`, 377 KB) no contiene
`bcrypt`, `drizzle`, `postgres`, `neondatabase`, `DATABASE_URL`, `getCredentialEpoch`,
`resolveSessionWithEpoch` ni `isSessionEpochCurrent`; sí contiene `credentialEpoch` (solo el
estampado de la callback `jwt`) y los prefijos públicos. `middleware.js.nft.json` no traza
ningún fichero de bcrypt/drizzle/postgres. La revalidación de época vive únicamente en la
frontera Node.

**Lo que miré con lupa y no cedió**

- **CA-2 no es una afirmación, es una macrotarea.** `defer()` usa `setTimeout(…, 0)` con el
  comentario explícito de por qué no vale un `.then()` sobre promesa resuelta; el test asserta
  el sender vacío *antes* de esperar la entrega. Mi medición por HTTP real no encontró señal.
- **CA-7 no es un lee-comprueba-escribe.** Además de leer la sentencia, ejercí la carrera
  contra Postgres real con dos POST simultáneos: uno gana con 303, el otro recibe el mensaje
  genérico, y solo la contraseña del ganador abre sesión.
- **CA-4 ejercido de verdad**, no asumido: el test de unidad nunca envía una cabecera, así que
  lo repetí con un POST crudo del formulario real con `Host`/`X-Forwarded-Host`/`Origin`
  falsificados sobre un servidor con `AUTH_TRUST_HOST=true`. El enlace salió con el origen de
  `APP_BASE_URL`. (Nota lateral: con solo `X-Forwarded-Host` falsificado y `Origin` legítimo,
  Next aborta la server action por sí mismo — defensa adicional, no la que exige el CA.)
- **CA-15 contra el middleware real**, no solo contra `isPublicPath`: `/reset-passwordX` y
  compañía acaban en `/login`.

**UI (testers externos).** Revisada con Playwright a 1440×900 y 390×844. Las tres pantallas
nuevas reutilizan `auth-wrap` / `headline` / `card auth-form` / `btn primary` y los enlaces
`lede`: son indistinguibles en acabado de `login` y `register`. Sin desbordes horizontales en
móvil (`scrollWidth == clientWidth == 390` en las tres). Sin elementos rotos, sin texto
cortado, jerarquía y contraste coherentes con el design system.

**Residuales que no bloquean** (ya declarados, no los reabro): F-SPEC-023-5 (el `INSERT` de la
rama registrada, sub-ms, invisible bajo el ruido de red), F-SPEC-023-1/3 y F-SPEC-006-1 son de
despliegue y decisión del humano, y F-SPEC-023-6/7/8 quedan encaminados a EPIC-MEJORA.
Observación de higiene, sin efecto sobre ningún CA: los términos de dominio *Enlace de
recuperación*, *Token de recuperación* y *Época de credencial* están en `docs/fundacion/dominio.md`,
que sigue **sin commitear** y mezclado con trabajo de SPEC-022; hay que separarlo antes del merge.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-023/. Informe HTML opcional: _qa/SPEC-023/informe.html -->

Capturas regeneradas por el verificador en su propia ejecución (`_qa/SPEC-023/`), más el
barrido de UI en dos viewports (`_qa/SPEC-023/verificador/`).

| CA | Captura |
|---|---|
| CA-1 | `_qa/SPEC-023/ca1-acuse-con-cuenta.png` · `ca1-acuse-sin-cuenta.png` (idénticas salvo el email tecleado) |
| CA-6 | `_qa/SPEC-023/ca6-pantalla-nueva-clave.png` · `ca6-entra-con-la-nueva.png` |
| CA-7 / CA-9 | `_qa/SPEC-023/ca7-enlace-ya-usado.png` |
| CA-10 | `_qa/SPEC-023/ca10-abrir-no-gasta.png` |
| CA-11 | `_qa/SPEC-023/ca11-solo-el-ultimo-vale.png` |
| CA-13 | `_qa/SPEC-023/ca13-a-antes-con-sesion.png` → `ca13-a-expulsado.png` · `ca13-b-sesion-nueva-vale.png` |
| CA-14 | `_qa/SPEC-023/ca14-confirmacion-en-login.png` |
| CA-15 | `_qa/SPEC-023/ca15-rutas-publicas.png` |
| UI (acabado) | `_qa/SPEC-023/verificador/{forgot,forgot-acuse,reset-form,reset-invalido,login-reset,login,register}-{desktop,movil}.png` |

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
