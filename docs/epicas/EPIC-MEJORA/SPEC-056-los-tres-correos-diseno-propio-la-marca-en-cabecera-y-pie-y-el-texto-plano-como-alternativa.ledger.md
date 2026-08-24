---
id: SPEC-056
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-056 Los tres correos: diseño propio, la marca en cabecera y pie, y el texto plano como alternativa

## Resumen
- Fase: `borrador` — escrita por sdd-arquitecto el **2026-08-25**. Ese mismo día el humano (Alberto
  Fojo) **resolvió en el gate las seis decisiones abiertas**, y sdd-arquitecto las dejó escritas en la
  spec (§Notas para el gate, ahora con su resolución al lado; D-11; CA-19 y CA-20). La spec sigue en
  `borrador` a propósito: **la transición de estado la hace el orquestador con `estado.mjs`**, no su
  autora, y el arquitecto no aprueba su propia spec.
- Rama: `ft/SPEC-056-los-tres-correos-diseno-marca-y-texto-plano`, desde `origin/main` en `825046f`
  (renombrada por el orquestador; el slug original era `ft/SPEC-056-plantillas-de-correo`).
- ADR que la acompaña: **ADR-036** (`docs/adr/ADR-036-el-correo-lleva-dos-cuerpos-…-enmienda-a-adr-006.md`),
  también en `borrador` y también pendiente del mismo gate. **La spec no se puede implementar sin él**:
  CA-1 y CA-2 son literalmente su decisión.
- Ids verificados contra `origin/main` y contra todas las ramas locales y remotas: **SPEC-056** libre
  (054 mergeada; 055 y 052 en vuelo en otras sesiones) y **ADR-036** libre (último en `main`: ADR-035).
  El scaffold propuso `SPEC-055` porque este worktree no ve las ramas en vuelo; renombrado a mano.
- Versión prevista: **PATCH** (ADR-024), mismo criterio que SPEC-047 y SPEC-051 — presentación pura,
  sin cambio del contrato de `/api/version`. El campo nuevo del puerto es interno y opcional.
  Recordatorio de SPEC-049: `npm run version:check` se ejecuta **tras commitear**, no sobre árbol sucio.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (el puerto admite dos cuerpos) | | | | ❌ |
| CA-2 (ResendSender manda `text` y `html`) | | | | ❌ |
| CA-3 (la plantilla es pura y vive sobre el puerto) | | | | ❌ |
| CA-4 (marca en cabecera, en los tres) | | | | ❌ |
| CA-5 (marca en pie, con la fórmula de la app) | | | | ❌ |
| CA-6 (fuente única: nada tecleado) | | | | ❌ |
| CA-7 (documento declarado + preheader) | | | | ❌ |
| CA-8 (maquetación de correo: tablas, 600 px, estilo en línea) | | | | ❌ |
| CA-9 (nada que el cliente tire ni ejecute) | | | | ❌ |
| CA-10 (cero terceros; toda URL absoluta es un `href`) | | | | ❌ |
| CA-11 (paleta derivada de los tokens) | | | | ❌ |
| CA-12 (contraste medido) | | | | ❌ |
| CA-13 (dos cuerpos; el de texto sin etiquetas) | | | | ❌ |
| CA-14 (los dos cuerpos dicen lo mismo) | | | | ❌ |
| CA-15 (el enlace de reset, primero en el texto y visible en el HTML) | | | | ❌ |
| CA-16 (asuntos byte-idénticos) | | | | ❌ |
| CA-17 (el registro in-app sigue siendo texto; sin migración) | | | | ❌ |
| CA-18 (cero regresión; ninguna guardia aflojada) | | | | ❌ |
| CA-19 (el remitente por defecto ya no cita `stockeiro.app`) | | | | ❌ |
| CA-20 (código, `.env.example` y `despliegue.md` coinciden; siguen once claves) | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-056/. Informe HTML opcional: _qa/SPEC-056/informe.html -->

Un correo no se pantalla con Playwright como una página, así que la evidencia de esta spec **no es
automática**. Su forma quedó **acordada con el humano en el gate del 2026-08-25** (nota 5) y está
escrita también en la cabecera de §Criterios de aceptación de la spec, que es donde el verificador
mira:

- El implementador escribe los **tres HTML generados** (con datos de muestra) en
  `_qa/SPEC-056/entrada.html`, `_qa/SPEC-056/resumen.html` y `_qa/SPEC-056/recuperacion.html`.
- El verificador los abre en un navegador y captura los tres, más una captura a **360 px** de ancho
  para comprobar que el contenedor de 600 px se comporta.
- Queda dicho lo que esa evidencia **no** prueba: cómo se ve en Outlook. Eso solo lo cierra
  F-SPEC-056-1.

Aviso de higiene (memoria del proyecto): la e2e completa reescribe capturas ajenas en `_qa/`. Si se
ejecuta, restaurar lo que no es de esta spec con `git checkout -- _qa/` y commitear solo
`_qa/SPEC-056/`.

## Salvedades / follow-ups
<!-- IDs F-SPEC-056-1, F-SPEC-056-2… con destino (spec futura o EPIC-MEJORA). -->

Nacen con la spec, antes de implementar. Ninguno bloquea el gate.

- **F-SPEC-056-1 (DESPLIEGUE)** — **Un envío real de los tres correos** tras desplegar, mirado en al
  menos un cliente de escritorio y uno móvil. Es la única prueba de que la parte HTML se entrega y se
  pinta: `ResendSender` no se ejerce en la suite (ADR-036, contexto pto. 1) y CA-2 solo afirma que la
  petición lleva el campo. Se cierra como se cerró **F-SPEC-006-1** (`docs/despliegue.md:53-54`, «un
  reset real entregado»).
- **F-SPEC-056-2 (observación, tras desplegar)** — Vigilar el *bounce rate* de Resend (exige < 4 %) y
  la carpeta de spam durante los días siguientes (R-5). Si empeora, el sospechoso número uno es el
  marcado nuevo.
- **F-SPEC-056-3 (higiene → EPIC-INFRA)** — Renombrar `body` → `text` en `NotificationMessage`, en un
  cambio **aislado** que no toque conducta. El nombre correcto es `text` (ADR-036, alternativas); se
  aparta de aquí para que un fallo en esta entrega signifique lo que dice.
- **F-SPEC-056-4 (DESPLIEGUE, nace del gate del 2026-08-25)** — **Fijar `RESEND_FROM` en el entorno
  de Production de Vercel** al valor que CA-19 deja en el código
  (`"Stockeiro - tremen.dev" <stockeiro@tremen.dev>`), y **comprobarlo con un envío real** que salga
  desde `@tremen.dev` y no rebote.

  **Esto NO lo entrega la spec y es la confusión que hay que evitar al cerrarla.** La spec cambia el
  **valor por defecto del código** y **los dos ficheros que lo documentan** (CA-19, CA-20) — eso es
  trabajo de ficheros, implementable y verificable. Fijar la variable en Vercel es una acción de
  despliegue del humano. **Mientras no se haga, el remitente real en producción sigue siendo el que
  hoy esté configurado**, por muy `hecho` que esté esta spec. Misma marca y mismo trato que
  F-SPEC-006-1, que se cerró con «un reset real entregado» (`docs/despliegue.md:53-54`).

  Nota de contexto para quien lo ejecute: la documentación caduca que motivó esto —`.env.example:58`,
  `docs/despliegue.md:183` y `:187` citando `stockeiro.app`— **sí queda corregida por la spec**. Lo
  que **no** se toca son las menciones a `stockeiro.app` que cuelgan de `APP_BASE_URL`
  (`.env.example:30`, `docs/despliegue.md:107`): son territorio de SPEC-052 y SPEC-055.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Hecho:** la spec y ADR-036, los dos en `borrador`, con las **seis resoluciones del gate del
2026-08-25 ya escritas dentro** (encaje en EPIC-MEJORA, cabecera y pie, remitente, Geist fuera,
evidencia visual y versión PATCH). Nada de `src/` tocado — ni una línea.

**Lo siguiente:** que el orquestador **registre la aprobación** y mueva el estado con `estado.mjs`.
Ya no queda ninguna decisión abierta que bloquee la implementación.

**Lo que el gate añadió al alcance, por si se lee esto en diagonal:** el remitente. Entran **CA-19**
(el valor por defecto de `ResendSender` deja de apuntar a `stockeiro.app`) y **CA-20** (código,
`.env.example` y `docs/despliegue.md` dicen los tres lo mismo, y `.env.example` sigue con once
claves). No entra fijar la variable en Vercel: eso es **F-SPEC-056-4**.

**Para quien implemente, cuando esté aprobada** — el orden que menos duele:

1. **Primero la frontera** (CA-1, CA-2): `html?: string` en `NotificationMessage`, `html` en el JSON
   de `ResendSender`. Los tres adaptadores compilan sin tocarse; la suite entera debe seguir verde
   **antes** de escribir una sola plantilla. Si algo se rompe aquí, se rompió por el tipo, y es barato
   de ver.
2. **Luego el módulo de plantillas** (CA-3 a CA-15), puro y con sus tests, **sin engancharlo todavía**
   a los emisores. Es una función de datos a `{ subject, text, html }`: se puede afirmar entera sin
   base de datos y sin navegador.
3. **Y al final el enganche**, emisor a emisor: primero `service.ts` (entrada y resumen), después
   `password-reset.ts`. Éste último es el delicado.

**Las tres trampas de esta spec**, por si el que llega no ha leído los §Riesgos:

- `tests/password-reset.test.ts:163` toma **la primera URL absoluta del texto** y afirma que es el
  enlace de reset. La línea de marca va **al final** del texto (D-6). Si esa guardia se pone roja,
  **no se toca el regex**: se mueve la marca.
- `tests/e2e/recuperacion.spec.ts:39` hace lo mismo leyendo el buzón en disco. `OutboxFileSender`
  serializa el mensaje **entero** con `JSON.stringify`, así que el HTML acabará en el `.jsonl` — es
  deseable (deja el correo mirable) y no rompe el parseo, pero el fichero crecerá bastante.
- CA-18 dice que el diff sobre ficheros de test **que ya existían solo puede añadir**. Es el criterio,
  no una recomendación.
- `.env.example` se toca en **una sola línea**, la de `RESEND_FROM`, y solo su valor.
  `tests/spec-031-frontera.test.ts` congela el recuento en **once** claves con `toHaveLength(11)`:
  añadir o quitar cualquier cosa ahí lo pone rojo, y además choca de frente con SPEC-052 y SPEC-055.
  Las menciones a `stockeiro.app` que cuelgan de `APP_BASE_URL` (`.env.example:30`,
  `docs/despliegue.md:107`) **no son de esta spec**.

**Solape con otras sesiones** (R-6, y subió con la resolución del remitente): SPEC-052 y SPEC-055
están en vuelo sobre `APP_BASE_URL`, y esta spec **ahora sí toca `.env.example`**. Sigue **sin tocar**
`src/lib/config/app-url.ts`, sin tocar `APP_BASE_URL` y sin cambiar el número de claves. Los ficheros
compartidos quedan en dos: `src/lib/auth/password-reset.ts` —solo la función `resetEmailBody`— y una
línea de `.env.example` con valor distinto, que es el conflicto más barato que existe. Quien mergee el
segundo, rebasa y reconcilia.
