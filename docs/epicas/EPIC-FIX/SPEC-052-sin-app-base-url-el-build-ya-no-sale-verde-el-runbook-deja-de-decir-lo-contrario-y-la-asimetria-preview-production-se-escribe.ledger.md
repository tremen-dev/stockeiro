---
id: SPEC-052
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-052 Sin `APP_BASE_URL` el build ya no sale verde: el runbook deja de decir lo contrario y la asimetría Preview/Production se escribe

## Resumen
- Fase: **borrador** — escrita por sdd-arquitecto el 2026-08-23; **arbitrada por el
  humano (Alberto Fojo) el 2026-08-24** e incorporado el arbitraje al texto. Sigue en
  `borrador`: la transición a `aprobada` la registra el orquestador, no la autora. La
  fuente de verdad del estado es el frontmatter de la spec.
- **Arbitraje del 2026-08-24, incorporado**: Q-1 resuelta (la asimetría de Preview es
  deliberada → **D-5** + **CA-4 (b)**); Q-2 resuelta (`.env.example` a
  `http://localhost:3000` → **D-6** + **CA-17**, que además ajustó **CA-3**); **sin ADR**
  para la regla de D-1, con la condición de reapertura escrita (ver F-SPEC-052-6). Y un
  hallazgo propio al reverificar contra `3b6fc8b`: una **segunda** afirmación falsa en el
  mismo párrafo de §0, absorbida por **CA-2 (d)**.
- Rama: `ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde`
- Épica: **EPIC-FIX**, validado contra su carta y contra el precedente de SPEC-033,
  SPEC-048 y SPEC-049 (defectos de herramienta ya entregada → EPIC-FIX, no
  EPIC-INFRA).
- **Origen del defecto**: `docs/despliegue.md` §0 líneas 110-111 afirmaba que la
  ausencia de `APP_BASE_URL` era un error de tiempo de petición «así que el deploy
  sale verde igualmente». Dejó de ser cierto con **SPEC-051** (mergeada el
  2026-08-23), que añadió `metadataBase: new URL(appBaseUrl())` al export `metadata`
  del layout raíz.
- **Impacto medido**: el despliegue de **Preview del PR #58** falló en `next build`
  (*Collecting page data* → `Failed to collect configuration for /_not-found`). Todas
  las previews fallaban.
- **Arreglo de ops YA APLICADO por el humano el 2026-08-23** (no lo rehace esta spec):
  `APP_BASE_URL = https://stockeiro.tremen.dev` añadida al entorno **Preview**;
  redespliegue del PR #58 verde en **53 s**.
- **Sin cambios en `src/`**: documentación + una guardia en `tests/`. Consecuencia
  esperada y correcta: `version:check` dirá *«el diff no toca codigo de aplicacion»*.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 — frase falsa fuera, y no vuelve por copia | | | | ❌ |
| CA-2 — lo que dice en su lugar (build, PR #58, log literal) **+ (d) origen real → `stockeiro.tremen.dev`** | | | | ❌ |
| CA-3 — conserva lo que sí era cierto (falta ≠ mal); **ya NO conserva el desmentido del ejemplo** | | | | ❌ |
| CA-4 — **(a)** columna **Entornos**, vocabulario cerrado, sin celdas vacías · **(b)** el motivo escrito de las solo-Production | | | | ❌ |
| CA-5 — foto de `vercel env ls` del 2026-08-23 en §13, etiquetada como foto | | | | ❌ |
| CA-6 — el arreglo de ops consta como HECHO (§13 + checklist §5) | | | | ❌ |
| CA-7 — Preview deja de ser opcional en §3.2 y §7 | | | | ❌ |
| CA-8 — cruce: claves del build ⊆ claves marcadas `Preview + Production` | | | | ❌ |
| CA-9 — centinela: conjunto derivado no vacío, un solo job, contiene `APP_BASE_URL` y `DATABASE_URL` | | | | ❌ |
| CA-10 — centinela: tabla parseada ≥ 11 filas, con celdas de entorno no vacías | | | | ❌ |
| CA-11 — **la guardia probada en rojo** con entrada propia, en los dos sentidos | | | | ❌ |
| CA-12 — `.env.example` admite Production/Preview/Development | | | | ❌ |
| CA-13 — `.env.example`: la ausencia de `APP_BASE_URL` rompe el build | | | | ❌ |
| CA-14 — `appBaseUrl()` sigue lanzando, con la nota de que es deliberado | | | | ❌ |
| CA-15 — la entrega no toca `src/` ni `drizzle/` | — (criterio sobre el delta) | **n-a — ver nota N-1** | gate | n-a |
| CA-16 — `npm run build` sin `APP_BASE_URL` falla | — (verificación empírica única) | **n-a — ver nota N-2** | gate | n-a |
| CA-17 — `.env.example`: `APP_BASE_URL` → `http://localhost:3000`, y §0 retira el desmentido | | | | ❌ |

### Notas de los `n-a` (por qué no hay test, y dónde se verifica en su lugar)

- **N-1 (CA-15)** — *«esta entrega no toca `src/`»* es un criterio sobre un **delta**, no
  una propiedad del árbol: codificado como test caducaría al mergear y pasaría a estar
  vacío, que es literalmente lo que **ADR-031 / RI-03** prohíbe. Se verifica **en el
  gate**. Evidencia a pegar aquí: salida de `git diff --name-only <base>...<rama>`, con
  la base indicada.

  ```
  (pendiente: pegar aquí la salida de git diff --name-only de la rama de entrega)
  ```

- **N-2 (CA-16)** — un `next build` completo por pasada de suite es inviable, y
  sustituirlo por un unitario que «afirme» el fallo sin construir sería el verde vacío
  que ADR-031 prohíbe. Verificación de **gate** (RI-03, opción 2): se ejecuta **una vez**
  y su salida literal se pega aquí. Es lo que sostiene el literal que CA-2 exige en el
  documento.

  ```
  (pendiente: pegar aquí la salida literal de `npm run build` con APP_BASE_URL ausente)
  ```

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
Pendiente.

## Evidencia visual
No aplica: esta spec no cambia ninguna superficie de UI. La evidencia es textual
(diffs de documentación, salida de la guardia y las dos capturas de consola de N-1/N-2).

## Salvedades / follow-ups

- **F-SPEC-052-1** (destino **EPIC-INFRA**, futuro) — **nada compara el runbook con el
  estado REAL de Vercel.** La guardia de CA-8 cruza `docs/despliegue.md` contra
  `.github/workflows/ci.yml`: si el panel de Vercel pierde una clave mañana, la guardia
  sigue verde. Cerrarlo exige la API/CLI de Vercel con credencial y red desde la suite,
  y sale del alcance de un FIX. Mientras tanto, la única prueba imposible de falsear de
  que Preview tiene sus claves es **que una PR construya verde** — mismo argumento que
  el runbook ya da para `ALLOW_MIGRATE` (§13.2, F-SPEC-032-2). **Declarado a propósito:
  se prefirió un documento cierto sin guardia a una guardia falsa.**

- **F-SPEC-052-2** (higiene, sin destino asignado) — la derivación de D-1 (*lo que el
  build exige = bloque `env` del job de CI que construye*) es correcta **porque hoy ese
  job construye en un runner donde no hay definido nada más**. Si algún día heredara
  variables de nivel de workflow, de `secrets` o del entorno del runner, la derivación
  dejaría de ser completa y la guardia pasaría a exigir de menos sin decirlo. Queda
  anotado aquí para que quien toque ese workflow lo sepa.

- **F-SPEC-052-3** (sobreaproximación aceptada) — la guardia exigirá en Preview **todas**
  las claves del bloque `env` del job que construye, incluidas las que el build quizá no
  necesite **estrictamente** (candidata: `AUTH_TRUST_HOST`). Asimetría de coste
  deliberada: exigir de más cuesta una entrada en un panel; exigir de menos cuesta
  **todas** las previews.

- **F-SPEC-052-4** — ~~decisión pendiente del humano (**Q-1**)~~ **CERRADO el 2026-08-24
  por el humano (Alberto Fojo): la asimetría es DELIBERADA y se queda.**
  `TWELVE_DATA_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM` y `CRON_SECRET` siguen **solo en
  Production**, porque *una preview no debe gastar cuota de proveedores externos ni poder
  mandar correo de verdad*. Que en una preview el buscador no busque, no salga un correo
  y el cron no se pruebe es el **precio aceptado, no un defecto**. **No se cierra sin
  dejar trabajo**: pasa a ser **CA-4 (b)** y **D-5** — el motivo se escribe junto a la
  tabla de §0, para que el runbook le responda solo a quien concluya que Preview está mal
  configurado. La configuración no cambia; lo que cambia es su estatuto.

- **F-SPEC-052-5** — ~~decisión pendiente del humano (**Q-2**)~~ **CERRADO el 2026-08-24
  por el humano: `.env.example` pasa a `http://localhost:3000`.** Entra como **CA-17** y
  **D-6**. Un fichero de ejemplo se copia a `.env` y se usa tal cual en local, así que
  sus valores por defecto tienen que funcionar en local; `https://stockeiro.app` era un
  dominio inventado que ni era el real ni servía para desarrollar, y que obligaba a §0 a
  salir a desmentirlo en otro fichero. **Efecto en cascada, ya incorporado**: **CA-3 deja
  de exigir** que §0 conserve ese desmentido, porque se queda sin nadie a quien
  desmentir; retirarlo pasa a estar **exigido** por CA-17.

- **F-SPEC-052-6** — ~~decisión pendiente del humano~~ **CERRADO el 2026-08-24 por
  sdd-arquitecto, con el id ofrecido y declinado: la regla de D-1 NO necesita ADR.** Es
  **autoejecutable en el punto donde se viola** —añadir una lectura de entorno en build
  obliga a tocar el `env` del job de CI, eso obliga a tocar el `toEqual` de
  `tests/ci-workflow.test.ts` 5.1, y la guardia de CA-8 obliga entonces a documentarla
  como necesaria en Preview: tres eslabones que fallan en rojo—. **ADR-031 necesitó ser
  ADR justamente porque su regla no tenía mecanismo** (su propio texto registra que la
  convención en prosa *«aguantó dos días»*, y hubo que fabricarle la meta-guardia de
  SPEC-048). Aquí el mecanismo **es** la regla, y un ADR cuyo contenido íntegro fuese
  *«hay un test que hace esto»* duplicaría el test y añadiría un artefacto inmutable que
  mantener. Precedente: SPEC-051 rechazó tres alternativas por escrito en su §Diseño D-4
  sin ADR y aguantó el arbitraje.
  **Condición de reapertura, escrita para que sea comprobable**: si el build llega a leer
  una clave que el `env` de ese job **no puede ver** —el escenario de **F-SPEC-052-2**—,
  la regla deja de ser autoejecutable, vuelve a ser prosa y **entonces sí** necesita ADR
  + RI-04 con id asignado desde fuera.

## Cómo retomar (handoff)

**Estado real**: solo existe el papel. Spec y ledger escritos el 2026-08-23 por
sdd-arquitecto; **nada implementado**, ningún fichero de `docs/`, `.env.example` o
`tests/` tocado todavía.

**Lo primero, antes de implementar**: la spec está en `borrador` y **no la aprueba su
autor**. El humano ya la arbitró el 2026-08-24 y **no quedan decisiones abiertas** —Q-1,
Q-2 y la del ADR están cerradas e incorporadas al texto—; falta solo que el orquestador
registre la transición a `aprobada`.

**Orden sugerido de implementación** cuando esté aprobada:

1. `docs/despliegue.md` §0: quitar la frase falsa, corregir el origen real a
   `https://stockeiro.tremen.dev`, retirar el desmentido del valor de ejemplo y
   reescribir el aviso (CA-1..CA-3, CA-17); añadir la columna **Entornos** con el
   vocabulario cerrado **y el motivo escrito de las claves solo-Production** (CA-4 a+b).
2. `docs/despliegue.md` §3.2, §5, §7 y §13 (CA-5..CA-7).
3. `.env.example` (CA-12, CA-13, CA-17 → `http://localhost:3000`).
4. La guardia `tests/entornos-de-despliegue.test.ts` **con TDD y empezando por CA-11**
   (el camino rojo con entrada propia): si se escribe al final, la tentación es hacerla
   pasar y no verla fallar nunca. Después CA-8 y los dos centinelas CA-9/CA-10.
5. La nota de CA-14 en el test existente de `appBaseUrl()` (SPEC-023). **Añadir la nota,
   no tocar la aserción.**
6. Las dos verificaciones de gate: N-1 (`git diff --name-only`) y N-2 (`npm run build`
   sin `APP_BASE_URL`), con su salida literal pegada en este ledger.

**Trampas conocidas, para no repetirlas**:

- **No aflojar `tests/ci-workflow.test.ts` caso 5.1.** Esta spec **depende** de que ese
  `toEqual` congele el bloque `env`: es el punto de paso obligatorio del que cuelga toda
  la cadena de D-1. Si se pone rojo, es información, no un estorbo.
- **La guardia no puede usar `git`.** Es una propiedad del árbol (D-4) y la meta-guardia
  de SPEC-048 la revisará. Ninguna revisión —`origin/main`, `main`, `HEAD`, `@`— puede
  alimentar una aserción (ADR-031 / RI-03).
- **El job de CI que construye se localiza por su contenido** (un `run` con
  `npm run build`), **no por su nombre** (`E2E`). Un nombre es un literal que caduca al
  primer renombrado; el `run` es lo que de verdad importa. CA-9 vigila que se encuentre
  exactamente uno.
- **CA-10 usa una cota inferior (≥ 11 filas), no un recuento exacto.** §0 crecerá, y un
  recuento exacto sería congelar el estado del árbol — lo que `FOUNDATION.md` prohíbe
  desde el 2026-08-20.
- **No tocar `src/lib/config/app-url.ts`.** Que lance en build es diseño arbitrado de
  SPEC-051 (D-4, R-2). Si alguien cree que hay que revisarlo, para y abre otra spec.
- **`RESEND_FROM` conserva su ejemplo** (`Stockeiro <avisos@stockeiro.app>`). CA-17
  alcanza **solo** a `APP_BASE_URL`. Es tentador «arreglar de paso» el otro
  `stockeiro.app` del fichero: no se hace aquí, porque ese es un ejemplo de formato de
  remitente y ningún build lo lee.
- **El motivo de CA-4 (b) no es adorno.** Escribir solo la columna deja a Preview
  pareciendo mal configurada, y el siguiente que pase la «arreglará» — gastando cuota de
  proveedores y habilitando correo real desde una rama, que es justo lo que la decisión
  evita.
