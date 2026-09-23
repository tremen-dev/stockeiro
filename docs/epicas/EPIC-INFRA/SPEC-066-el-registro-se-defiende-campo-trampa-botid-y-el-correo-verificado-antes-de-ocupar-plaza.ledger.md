---
id: SPEC-066
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-066 El registro se defiende: campo trampa, BotID y el correo verificado antes de ocupar plaza

## Resumen
- Fase: **en-revision** — implementada por sdd-implementador el 2026-09-23; F-SPEC-066-8/-9 resueltos por el arquitecto y aplicados; batería completa en verde (ver handoff)
- Rama: `ft/SPEC-066-el-registro-se-defiende`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/registration/form-guard.ts` (`caughtByHoneypot`), `signup-flow.ts` (orden pto. 12), `register-form.tsx` (campo `website`) | `tests/spec066-capa1-trampa-y-tiempo.test.ts` › CA-1 (3 que cazan: `x`, espacio, URL; 2 que no: vacío, ausente) | | ❌ |
| CA-2 | `src/app/(auth)/register/register-form.tsx` (bloque `hidden` + `aria-hidden`, `tabIndex=-1`, `autocomplete=off`) | `tests/e2e/spec066-alta.spec.ts` › CA-2 (oculto/a11y/autocomplete; recorrido con Tab; alta sólo con teclado crea la cuenta) | | ❌ |
| CA-3 | `src/lib/registration/form-guard.ts` (`sealFormRender`/`isSealOldEnough`, HMAC con subclave HKDF de `AUTH_SECRET`), `register/page.tsx` (sella en la petición) | `tests/spec066-capa1-trampa-y-tiempo.test.ts` › CA-3 (falta, manipulado ×2, otra clave, <2 s, basura; ≥2 s y 1 día pasan; reloj del cliente; sin secreto) | | ❌ |
| CA-4 | `src/lib/registration/bot-check.ts` (`verdictFrom`, `botVerdictFailOpen`), `signup-flow.ts` (`handleSignup`, `handleResend`) | `tests/spec066-capa2-botid.test.ts` › CA-4 (bot/verificado en alta y reenvío; humano; lanza → sigue + log `[BotID]`; trampa/tiempo no consultan el puerto) | | ❌ |
| CA-5 | `src/lib/registration/bot-check.ts` (`checkBotIdOptions`, `makeBotCheck`), `botid-client.ts`, `despliegue.ts`, `src/instrumentation-client.ts` | `tests/spec066-capa2-botid.test.ts` › CA-5 (servidor y cliente con identidad simulada; librería real sin red; NODE_ENV no decide) + `tests/e2e/spec066-alta.spec.ts` › CA-5 (ninguna petición al prefijo en un alta completa) | | ❌ |
| CA-6 | `src/lib/auth/guard.ts` (`BOTID_PATH_PREFIX`, `isBotIdPath`), `src/proxy.ts` (antes de Auth.js) | `tests/spec066-proxy-botid.test.ts` (rutas derivadas de `withBotId(...).rewrites()` + centinela; parecidas y `/dashboard` redirigen; mutación «quitar la excepción» → rojo, medida a mano) | | ❌ |
| CA-7 | `next.config.mjs` (`withBotId`, `Referrer-Policy` en `/register/confirmar/:token*`) | `tests/spec066-next-config.test.ts` + `tests/e2e/spec066-alta.spec.ts` › CA-7 (cabeceras y `/api/version` 0.9.0 en el build servido) | | ❌ |
| CA-8 | `src/lib/registration/signup.ts` (`signUp`: NULL explícito, token digest, `after`), `src/lib/registration/service.ts` (`countAccounts`) | `tests/spec066-cuenta-pendiente.test.ts` › CA-8; `tests/spec066-acciones.test.ts` › «un alta NO inicia sesión» | | ❌ |
| CA-9 | `src/lib/registration/signup.ts` (tres ramas con hash), `src/app/(auth)/actions.ts` (`registerAction` → `{ sent: true }`) | `tests/spec066-cuenta-pendiente.test.ts` › CA-9 (forma idéntica, activada intacta, 3 hash, envío diferido, RN-02); `tests/spec066-acciones.test.ts` › CA-9; `tests/e2e/auth.spec.ts` › CA-2 (re-encuadrado) | | ❌ |
| CA-10 | `src/lib/registration/signup.ts` (re-alta: contraseña, `created_at`, invalidar, límite primero) | `tests/spec066-cuenta-pendiente.test.ts` › CA-10 | | ❌ |
| CA-11 | `src/lib/registration/signup.ts` (`issueAndSend` caduca en `created_at + 24 h`; `activateAccount` con CTE atómica) | `tests/spec066-cuenta-pendiente.test.ts` › CA-11 (digest; dos simultáneos → uno; 4 inválidos iguales; hora 23) | | ❌ |
| CA-12 | `src/lib/registration/signup.ts` (`emailsInWindow`, `ACTIVATION_EMAIL_LIMIT`) | `tests/spec066-cuenta-pendiente.test.ts` › CA-12 (límite + 1 mezclando causas; ventana móvil) | | ❌ |
| CA-13 | `src/app/(auth)/register/confirmar/[token]/page.tsx` + `activate-form.tsx`, `actions.ts` (`activateAccountAction`), `login/page.tsx` (aviso) | `tests/spec066-acciones.test.ts` › CA-13; `tests/e2e/spec066-alta.spec.ts` › CA-13 (GET ×3 no activa, noindex; pulsar → `/login?activada=1` sin cookie de sesión; usado no sirve) | | ❌ |
| CA-14 | `src/lib/registration/signup.ts` (`activateAccount` consulta el grifo antes de consumir), `actions.ts` (motivo de `REGISTRO_CERRADO_MOTIVO`) | `tests/spec066-cuenta-pendiente.test.ts` › CA-14 (a mano y por cupo; reabierto, el mismo enlace activa) | | ❌ |
| CA-15 | `src/lib/registration/service.ts` (`countAccounts` con `email_verified_at IS NOT NULL`) | `tests/spec066-cuenta-pendiente.test.ts` › CA-15; e2e del grifo re-encuadrado (`tests/e2e/grifo.ts`, CA-25 pto. 3) | | ❌ |
| CA-16 | `src/lib/registration/signup.ts` (`resendActivation`), `signup-flow.ts` (`handleResend`), `register/reenviar/` | `tests/spec066-cuenta-pendiente.test.ts` › CA-16 (cinco casos, un correo; no alarga); `tests/spec066-capa2-botid.test.ts` (BotID en el reenvío); `tests/e2e/spec066-alta.spec.ts` › CA-16 | | ❌ |
| CA-17 | `src/lib/auth/users.ts` (`AccountPendingError` tras la contraseña), `actions.ts` (`loginAction` verifica antes de `signIn`), `login-form.tsx` (enlace a reenviar) | `tests/spec066-acciones.test.ts` › CA-17; `tests/spec066-pendiente-sin-correo-y-purga.test.ts` › CA-17; `tests/e2e/spec066-alta.spec.ts` › CA-23 + CA-17 | | ❌ |
| CA-18 | `src/lib/auth/password-reset.ts` (pendiente → nada), `src/lib/notifications/service.ts` (`isNotNull(users.emailVerifiedAt)`) | `tests/spec066-pendiente-sin-correo-y-purga.test.ts` › CA-18 | | ❌ |
| CA-19 | `src/lib/registration/signup.ts` (`purgeExpiredPendingAccounts` → `purgeUserData`), `src/lib/triggers/cycle.ts` (tras `closeCronRun`, fallo contenido), `src/lib/account/deletion.ts` (tabla nueva) | `tests/spec066-pendiente-sin-correo-y-purga.test.ts` › CA-19 (sólo la >24 h con lo suyo; purga que lanza: misma respuesta, `cron_runs` success, log) | | ❌ |
| CA-20 | `drizzle/0012_account_activation.sql` (+ snapshot y journal), `src/db/schema.ts` | `tests/spec066-migracion.test.ts` (relleno, insert del código anterior activado, NULL admitido, digest único, `db:scan`) | | ❌ |
| CA-21 | `src/lib/notifications/templates/correos.ts` (`correoDeActivacion`), `src/lib/config/app-url.ts` (`buildActivationUrl`) | `tests/spec066-correo-activacion.test.ts` (+ evidencia `_qa/SPEC-066/correo-activacion.html`) | | ❌ |
| CA-22 | `src/lib/legal/content.ts` (categoría, fecha de verificación, 24 h, BotID en Vercel/cookies, Resend) — **propuesta, la aprueba el humano** | `tests/spec066-privacidad.test.ts`; guardia SPEC-035 CA-5 (`tests/legal-datos-y-esquema.test.ts`) verde sin tocarla | | ❌ |
| CA-23 | `tests/e2e/alta.ts` (ayudante compartido) y su adopción en las suites que se daban de alta por la interfaz | `tests/e2e/spec066-alta.spec.ts` › CA-23 + CA-17; el resto de la batería e2e pasa por el ayudante | | ❌ |
| CA-24 | `docs/despliegue.md` §15 | Se verifica leyendo en el gate (ADR-040); sin guardia | | ❌ |
| CA-25 | Versión 0.9.0 en `package.json` y `package-lock.json`; `.env.example` sin diff (11); `matcher` y `PUBLIC_PREFIXES` sin diff | Batería completa — ver handoff: **5 `expect` ajenos rojos NO autorizados, escalados al gate sin tocarlos** | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-066/. Informe HTML opcional: _qa/SPEC-066/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-066-1, F-SPEC-066-2… con destino (spec futura o EPIC-MEJORA). -->

Levantados por sdd-arquitecto al escribir la spec (2026-09-23), antes de implementar:

- **F-SPEC-066-1 — Sin límite de frecuencia por IP.** Las tres capas filtran automatismos baratos,
  no ráfagas desde una IP. *Destino*: spec propia en EPIC-INFRA (Vercel WAF o propio), cuando haya
  señal de abuso. *Dueño de la decisión*: humano.
- **F-SPEC-066-2 — Sin alerta de altas anómalas ni recuento de pendientes en `/admin`.** Una ráfaga
  que atraviese las capas no avisa a nadie; sólo se ve en el log. *Destino*: EPIC-INFRA o
  EPIC-MEJORA (alerting heredado de EPIC-FIX).
- **F-SPEC-066-3 — `/forgot-password` sin BotID.** Limitado por cuenta (SPEC-023 CA-12) y sólo
  escribe a cuentas activadas (CA-18), así que no alcanza a terceros. *Destino*: EPIC-INFRA si
  aparece abuso.
- **F-SPEC-066-4 — `tests/tarjeta-guardias-ampliadas.test.ts` congela `PUBLIC_PREFIXES` por
  igualdad exacta** contra una lista literal: el anti-patrón del 3.er corolario de FOUNDATION.
  SPEC-066 lo esquiva colgando sus rutas de `/register/` (D-2). *Destino*: EPIC-FIX, junto a
  `F-SPEC-051-1`.
- **F-SPEC-066-5 — Pre-secuestro residual.** Si un atacante re-registra el correo de la víctima
  **después** de que ella se registre y ella pulsa el enlace de esa re-alta, la cuenta queda
  activada con la contraseña del atacante (ADR-042 pto. 7). Mitigado en el caso común; la víctima
  lo nota al no poder entrar y lo arregla con la recuperación (ADR-016 corta sesiones). *Destino*:
  aceptado; reabrir si se observa.
- **F-SPEC-066-6 — El alta exige JavaScript en Vercel.** BotID no protege envíos nativos. *Destino*:
  aceptado; reabrir si un tester lo reporta.
- **F-SPEC-066-7 — El cliente de BotID espera al reto antes de enviar.** Si el reto no carga, el
  formulario puede quedarse colgado; el *fail-open* del servidor no lo cubre (leído en
  `botid@1.5.11`, `dist/client/core`). *Destino*: vigilar tras mergear (CA-24 c); si ocurre, spec
  en EPIC-FIX.

Levantados por sdd-implementador (2026-09-23):

- **F-SPEC-066-8 — Cinco `expect` ajenos rojos que CA-25 NO autoriza a re-encuadrar; escalados
  al gate sin tocarlos.** Todos congelan un estado del árbol (3.ª convención de FOUNDATION), no
  una propiedad:
  1. `tests/primera-pantalla-fuente.test.ts` › *«las dependencias son EXACTAMENTE las de
     siempre»* (SPEC-050) y 2. `tests/tarjeta-frontera.test.ts` › *«no entra ninguna
     dependencia»* (SPEC-051): lista literal de `dependencies`; entra `botid`, que ADR-042 exige.
  3. `tests/roles-schema.test.ts` › *«RI-01: el código anterior…»* (SPEC-034): congela la lista
     exacta de columnas de `users`; entra `email_verified_at`, que CA-20 exige. (La mitad que
     vigila la propiedad —el INSERT del código anterior sigue funcionando— pasa.)
  4. `tests/reglas-ingenieria-hecho-vivo.test.ts` y 5. `tests/reglas-ingenieria.test.ts` › *«las
     RN de dominio siguen todas, y en el mismo orden»* (SPEC-028/032): lista literal de RN; ya
     estaban **rojos en `5e86b52`**, antes de implementar, porque RN-19 la escribió el gate y el
     precedente del propio fichero dice que *«el hueco lo abre el arquitecto al aprobar»*.
  *Destino*: gate humano / sdd-arquitecto. Propuesta: 1–3 re-encuadrar a pertenencia
  (*«éstas siguen»*) y 4–5 añadir `RN-19` como hicieron RN-16/17/18.
  ↳ **Resuelto por sdd-arquitecto el 2026-09-23 (refinamiento post-aprobación de CA-25, pts.
  4–6; ADR-042 sin cambios).** 1 y 2: **se añade `botid`** a las dos listas y siguen siendo
  igualdad exacta —pertenencia dejaría entrar cualquier dependencia futura sin gate, que es
  aflojar; la lista es el sitio donde se pide permiso y ADR-042 es el permiso—. 3: **pasa a
  pertenencia** de las seis columnas previas, que es la propiedad que su comentario declara
  (RI-01: lo viejo no se rompe; añadir columnas es lo que RI-01 permite). 4 y 5: **hueco de RN-19
  abierto por el arquitecto** en los dos ficheros (hecho en la rama; los dos en verde). Queda al
  implementador aplicar 1–3 y anotar aquí qué vigilaba antes y qué vigila ahora cada uno, con el
  mutante de 3 (quitar una columna previa del esperado real → rojo).
- **F-SPEC-066-9 — Extensiones de guardias ajenas diseñadas para crecer, hechas en la rama.**
  `tests/account-deletion-coverage.test.ts` y `tests/account-deletion-neon-http.test.ts` llevan
  el orden literal del borrado: se añade `email_verification_tokens` (antes vigilaban el orden
  de ADR-022 con 8 tablas; ahora, el mismo con 9). `tests/account-deletion.test.ts` siembra una
  fila más. Es lo que esos tests piden al añadir una tabla con dueño (precedente SPEC-063), pero
  no está en la lista de CA-25: el verificador decide si lo acepta o lo escala.
  ↳ **Aceptado por sdd-arquitecto el 2026-09-23** (CA-25 pto. 7): no es un re-encuadre sino la
  guardia funcionando —ADR-022 exige que todo lo propio caiga y la tabla nueva es propia—.
  Revisado el diff: sólo añade (una tabla antes de `users` en los dos órdenes y una fila de
  siembra); no quita ni reordena nada.
- **F-SPEC-066-12 — Dos copias de la misma lista cerrada de dependencias.** SPEC-050
  (`primera-pantalla-fuente`) y SPEC-051 (`tarjeta-frontera`) congelan cada una la lista entera
  de `dependencies`: añadir una dependencia aprobada obliga a tocar dos tests de dos specs
  ajenas, que es el arrastre de la 3.ª convención de FOUNDATION. *Destino*: EPIC-FIX, junto a
  `F-SPEC-051-1` y `F-SPEC-066-4` (una sola lista, con un único dueño).
- **F-SPEC-066-10 — Ruido en el log fuera de Vercel.** La vía de desarrollo de `checkBotId`
  escribe *«Possible misconfiguration of Vercel BotId»* por `console.error` en cada alta del
  e2e/local (la librería, no nuestro código). Inocuo; se ve en los logs del e2e. *Destino*:
  EPIC-MEJORA si molesta.
- **F-SPEC-066-11 — `registerIfOpen`/`registerUser` siguen existiendo** como semilla de «cuenta
  activada» para los tests (y el grifo de SPEC-037); ninguna ruta de `src/` los llama ya. Si un
  día un camino de `src/` los usa, crearía cuentas activadas sin verificar. *Destino*:
  EPIC-FIX (moverlos a un ayudante de test).

Re-encuadres AUTORIZADOS por CA-25 hechos en la rama (qué vigilaban antes → qué vigilan ahora):

- **Pto. 4** — `tests/primera-pantalla-fuente.test.ts` › *«las dependencias son EXACTAMENTE las
  de siempre»* y `tests/tarjeta-frontera.test.ts` › *«no entra ninguna dependencia»*: antes,
  igualdad exacta con 11 dependencias; ahora, igualdad exacta con esas 11 **más `botid`** (y sólo
  `botid`), comentario citando ADR-042. `devDependencies` y `scripts` sin tocar. Mutante medido
  (implementador, 2026-09-23): añadir una dependencia cualquiera a `package.json` → los dos casos
  en rojo (2 failed / 48); restaurado, verde.
- **Pto. 5** — `tests/roles-schema.test.ts` › *«RI-01: el código anterior…»*: antes, igualdad
  exacta de las columnas de `users` (prohibía también cualquier columna nueva); ahora,
  **pertenencia** de las seis previas (`created_at`, `email`, `id`, `password_changed_at`,
  `password_hash`, `role`), un `toContain` por columna con su nombre en el mensaje. Mutante
  medido: añadir al esperado una columna que la tabla no tiene → rojo con *«falta la columna …
  de users»* (1 failed / 11); restaurado, verde. La columna nueva la vigila CA-20.
- **Pto. 1 y 2** — `tests/registration-action.test.ts` › SPEC-037 CA-3: antes, alta abierta ⇒
  cuenta + `signIn` a `/dashboard`, y duplicado ⇒ mensaje de SPEC-001 CA-2; ahora, cuenta
  pendiente sin `signIn` y `{ sent: true }`, y duplicado ⇒ misma respuesta que un correo nuevo
  (CA-8, CA-9). El formulario del arnés lleva sello válido (no cambia ningún `expect` del grifo).
- **Pto. 1 y 2** — `tests/e2e/auth.spec.ts` › SPEC-001 CA-1 (alta ⇒ panel, ahora por el
  recorrido de CA-23) y CA-2 (duplicado ⇒ «ya está registrado», ahora ⇒ pantalla idéntica a la
  de un correo nuevo).
- **Pto. 2** — las suites e2e que se daban de alta por la interfaz pasan por `tests/e2e/alta.ts`
  (admin-grifo, admin-responsive, avisos-zona, ayuda, ayuda-responsive, buscador-instrumentos,
  cartera, cuenta, cuenta-responsive, decimales, diagnostico-cotizacion, icono, importar,
  ingesta-cartera, movil-alta, pie-legal, recuperacion, roles, tarjeta, vigiladas y los
  ayudantes spec040/041/043/054/062). Lo que afirman tras entrar no cambia. `recuperacion.spec`
  filtra su buzón a los correos de recuperación (antes leía el último correo de la cuenta, que
  ahora es el de activación).
- **Pto. 3** — `tests/e2e/grifo.ts` (`censo`/`contarCuentas`): antes contaba toda fila de
  `users`; ahora cuenta activadas, como `/admin` y el cupo (CA-15).

Notas del arquitecto para quien implemente:

- **La API de BotID está leída del paquete, no de memoria** (`botid@1.5.11`, 2026-09-23):
  `withBotId` en `botid/next/config` (añade `rewrites` y `headers`, conservando los existentes);
  `initBotId({ protect: [{ path, method, advancedOptions: { checkLevel } }] })` en
  `botid/client/core`, desde `src/instrumentation-client.ts`; `checkBotId({ developmentOptions:
  { isDevelopment, bypass }, advancedOptions: { checkLevel } })` en `botid/server`. **Fuera de
  Vercel con `NODE_ENV=production` lanza por falta de OIDC** si no se le pasa `isDevelopment` —es
  el e2e—; por eso CA-5.
- **El reto de BotID vive bajo `/149e9513-…`** y cae en el `matcher` del proxy: sin CA-6, en
  producción el reto rebotaría a `/login` para todo el que se registra.
- **~18 ficheros de `tests/e2e/` copian `registrarYEntrar`** (alta por la interfaz → `/dashboard`).
  CA-23 y CA-25 pto. 2 autorizan migrarlos a un ayudante compartido sin cambiar lo que afirman
  después de entrar. Playwright rellena en milisegundos: el ayudante tiene que esperar el tiempo
  mínimo leyendo la constante, no un literal.
- **`tests/ops-cron-runs.test.ts` fija las claves del cuerpo del cron**: la purga no añade ninguna
  (ADR-042 pto. 11, CA-19).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**2026-09-23, sdd-arquitecto** — spec y ADR-042 en `borrador`. Nada implementado. Siguiente paso: gate humano.

**2026-09-23, sdd-implementador** — Implementados los 25 CA en `ft/SPEC-066-el-registro-se-defiende`
(commits `dc04d2f`…`39b406f` + este). Spec a `en-revision`.

- Gates medidos sobre el árbol commiteado: `npm run typecheck` ✅, `npm run lint` ✅,
  `npm run db:scan` ✅ (sólo 0001 y 0007, con su desbloqueo), `npm run version:check` ✅ (0.8.0 →
  0.9.0), `tests/guard-migrate.test.ts` ✅ 43/43 (`node scripts/guard-migrate.mjs` en local
  rechaza con salida 1 por falta de `VERCEL_ENV`, que es su contrato; no se migró ninguna base
  remota: la migración sólo se aplicó a PGlite y al Postgres efímero del e2e).
- `npm test`: **2229/2234**; los 5 rojos son F-SPEC-066-8 (ajenos, no autorizados, sin tocar).
- `npx playwright test` (build de este árbol con los valores de juguete de `ci.yml`): 378/383 en
  la pasada completa; de los 5 rojos, 4 eran de esta rama (buzón de recuperación y un
  re-relleno en CA-17), corregidos en `39b406f` y re-ejecutados en verde (admin-grifo +
  recuperacion + spec066-alta: 27/27); el 5.º, `admin-grifo` CA-6, fue un `Protocol error
  (Page.captureScreenshot)` de Chromium en Windows y pasó en la re-ejecución. **Pendiente para
  el verificador**: una pasada completa del e2e sobre `39b406f`+.
- Mutación medida a mano en CA-6: quitar la línea `isBotIdPath` de `src/proxy.ts` pone rojo
  `tests/spec066-proxy-botid.test.ts`; restaurada, verde.
- CA-22 (texto legal) y CA-24 (runbook §15) son **propuestas para el humano**; CA-24 c se mide
  tras mergear. Evidencia visual en `_qa/SPEC-066/` (8 capturas + el HTML del correo).
- Siguiente paso: sdd-verificador; y el gate humano para F-SPEC-066-8.

**2026-09-23, sdd-implementador (2.ª pasada, tras el refinamiento de CA-25 en `c115f05`)** —
Aplicados los ptos. 4 y 5 en `8792ddc` (anotados arriba, con sus mutantes). Gates sobre el árbol
commiteado `8792ddc`: `npm run typecheck` ✅; `npm run lint` ✅; `npm test` **2235/2235** (142
ficheros); `npm run db:scan` ✅; `npm run build` con los valores de juguete de `ci.yml` ✅;
`npx playwright test --forbid-only` pasada **completa** **383/383** (11,7 min);
`npm run version:check` ✅ 0.8.0 → 0.9.0. Capturas ajenas restauradas con `git checkout -- _qa/`.
Siguiente paso: sdd-verificador.

