---
id: SPEC-066
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-066 El registro se defiende: campo trampa, BotID y el correo verificado antes de ocupar plaza

## Resumen
- Fase: **borrador** — spec y ADR-042 escritos por sdd-arquitecto el 2026-09-23; pendiente del gate humano
- Rama: `ft/SPEC-066-el-registro-se-defiende`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | | | | ❌ |
| CA-2 | | | | ❌ |
| CA-3 | | | | ❌ |
| CA-4 | | | | ❌ |
| CA-5 | | | | ❌ |
| CA-6 | | | | ❌ |
| CA-7 | | | | ❌ |
| CA-8 | | | | ❌ |
| CA-9 | | | | ❌ |
| CA-10 | | | | ❌ |
| CA-11 | | | | ❌ |
| CA-12 | | | | ❌ |
| CA-13 | | | | ❌ |
| CA-14 | | | | ❌ |
| CA-15 | | | | ❌ |
| CA-16 | | | | ❌ |
| CA-17 | | | | ❌ |
| CA-18 | | | | ❌ |
| CA-19 | | | | ❌ |
| CA-20 | | | | ❌ |
| CA-21 | | | | ❌ |
| CA-22 | | | | ❌ |
| CA-23 | | | | ❌ |
| CA-24 | | | | ❌ |
| CA-25 | | | | ❌ |

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
