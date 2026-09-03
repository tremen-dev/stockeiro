---
id: SPEC-059
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-059 El ciclo diario deja de traer el cierre de anteayer: la hora del cron se mueve a la mañana UTC

## Resumen
- Fase: **aprobada** — escrita por sdd-arquitecto el 2026-09-03 junto con **ADR-039**, y
  **aprobada por el humano (Alberto Fojo) ese mismo día**. Nada implementado todavía: la spec y el
  ADR están listos y el trabajo de código está por empezar. *(La fuente de verdad del estado es el
  frontmatter de la spec; la transición la registra el orquestador con el script del núcleo.)*
- Rama: `ft/SPEC-059-el-ciclo-diario-deja-de-traer-el-cierre-de-anteayer-la-hora-del-cron-se-mueve-a-la-manana-utc`
- **Lo que se decidió en el gate del 2026-09-03 (Alberto Fojo)**, que es lo que convierte esta
  spec en implementable:
  1. **La hora es `0 6 * * *`** — 06:00 UTC = 08:00 de Madrid en verano (opción **A** de las tres
     que la spec puso sobre la mesa). Se eligió por **asimetría de riesgo** y **con la salvedad
     encima de la mesa**: 06:00 UTC **no está probada** por la evidencia —cae dentro de la ventana
     abierta `(22:48, 11:05)` UTC—, el peor caso de equivocarse es el **statu quo**, y **ADR-039
     pto. 4** deja pactado mover a ≥ 11:05 UTC **sin ADR nuevo** si se confirma que el proveedor
     publica más tarde. **Ya no es una pregunta abierta; es la decisión, y `CA-8` es su condición.**
  2. **ADR-004 queda aprobado en el mismo gate** (llevaba desde 2026-07-14 en `borrador`,
     *«pendiente de aprobación»*, mientras gobernaba la cadencia). ADR-039 ya no precisa nada
     pendiente.
  3. **CA-5 y CA-6 dentro del alcance**: la entrega toca `src/` a propósito y **sube versión
     patch**. No se parte para evitarlo.
  4. **La línea ~39 de `docs/roadmap.md` la cura esta spec** (CA-9), no sdd-producto. Las ~16 y
     ~18 están en pasado y no se tocan.
- **Decisión de gobierno**: **ADR-039** (*la hora del ciclo la fija cuándo publica el proveedor,
  no el cierre de mercado; precisa ADR-004 pto. 1*), **aprobado por Alberto Fojo el 2026-09-03**.
  No supersede a nadie.
- **Toca `src/`**: `src/lib/market/sin-refrescar.ts`, `src/lib/help/content.ts` y
  `src/app/vigiladas/actions.ts` (dos comentarios y una frase de copia). El gate **Version bump**
  exigirá subida **patch** con `package.json` + `package-lock.json` en el mismo commit (ADR-033) y
  `version:check` sobre árbol limpio (SPEC-049).
- **Cero esquema, cero migración.**
- **El merge no tiene condición de horario**: con `0 6 * * *` el hueco de transición es de
  **31 h 12 min** contra el umbral de 36 h de RN-16 (CA-7). Con la opción (C) descartada sí la
  habría tenido — y volverá a tenerla si CA-8 obliga a mover la hora a ≥ 11:05 UTC.
- **Entrega parcialmente verificable en batería**: CA-1…CA-6 automáticos, CA-7 y CA-10 por
  recálculo y diff, y **CA-8 se cierra después del merge** con dos filas de `cron_runs`. Está
  declarado así en la spec a propósito, y con la hora elegida pesa más: `0 6 * * *` es justo la
  opción cuya corrección **solo** se confirma observando.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Qué exige (resumen; la fuente es la spec) | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|---|
| CA-1 | `vercel.json` → `crons[0].schedule` pasa a **`0 6 * * *`**; **nada más** del fichero cambia | | | | ❌ |
| CA-2 | La expresión declara **una sola ejecución diaria a hora fija**; eficacia en los dos sentidos (`0,30 6 * * *` y `0 */6 * * *` sí; `0 6 * * *` y `30 11 * * *` no) | | | | ❌ |
| CA-3 | Las **tres** guardias que congelan `vercel.json` entero se **re-congelan** al valor nuevo, sin relajar ni derivar del propio fichero; qué vigilaban antes / ahora, escrito aquí | | | | ❌ |
| CA-4 | `docs/despliegue.md` §3.3: el bloque JSON **derivado** coincide con `crons`, con centinela; y la nota de plan recoge Hobby (minuto arbitrario, día no garantizado) vs Pro (clavado) | | | | ❌ |
| CA-5 | `src/lib/market/sin-refrescar.ts` deja de llevar una **segunda copia** del valor: nombra el fichero dueño, no la hora; eficacia en los dos sentidos | | | | ❌ |
| CA-6 | Ningún texto visible nombra franja horaria del ciclo (*«sin esperar a la noche»* fuera); `CADENCIA_LINEA` y `AVISO_LO_EMITE_EL_CICLO` **sin tocar** y sus guardias verdes | | | | ❌ |
| CA-7 | El hueco de transición no supera `UMBRAL_SIN_REFRESCAR_HORAS`. **Con `0 6 * * *`: 31 h 12 min contra 36 h → se cumple con holgura y el merge no tiene condición de horario.** Por recálculo, **sin guardia permanente** | | n-a (a propósito) | | ❌ |
| CA-8 | **Observación post-deploy**: dos filas de `cron_runs` **a las 06:00 UTC** con `outcome=success`, y `as_of` = D-1 contrastado con un símbolo y su serie; desenlace de ADR-039 pto. 4 si sigue D-2. **Es la condición de la hora elegida, no un extra** | | n-a (no automatizable) | | ❌ |
| CA-9 | `docs/roadmap.md`: las dos frases en **pasado** no se tocan; la que está en **presente** (*«el aviso sigue saliendo a las 22:00»*) deja de nombrar la hora. Sin guardia | | n-a (ADR-037) | | ❌ |
| CA-10 | Ledgers, ADR y `dominio.md` que citan las 22:00 **en pasado** no se tocan. Criterio de gate (`RI-03`), por `git diff --name-only`. **Sin guardia** (ADR-037) | | n-a (a propósito) | | ❌ |
| CA-11 | Subida de versión **patch** con los dos ficheros en el mismo commit (ADR-033) y `version:check` sobre árbol limpio (SPEC-049) | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-059/. Informe HTML opcional: _qa/SPEC-059/informe.html -->

Esta spec **no genera evidencia visual**: no cambia ninguna pantalla. La evidencia de CA-8 es
**tabular** (filas de `cron_runs` y de `quotes`) y va escrita en este ledger, no en capturas.

## Salvedades / follow-ups
<!-- IDs F-SPEC-059-1, F-SPEC-059-2… con destino (spec futura o EPIC-MEJORA). -->

Abiertas ya desde el diseño (las dos nacen en ADR-039 y se anotan aquí para que no se pierdan):

- **F-ADR-039-1 — la hora de publicación del proveedor sigue sin medir.** La evidencia solo acota
  la ventana abierta `(22:48, 11:05)` UTC. Medirla cuesta un sondeo por horas durante varios días
  y **consume cuota** (ADR-027 pto. 1). Destino: spec de observabilidad del ciclo.
- **F-ADR-039-2 — nadie vigila que el `as_of` que escribe el ciclo sea el de la sesión anterior.**
  Es lo que cazaría este defecto si el proveedor volviera a mover su hora de publicación. Destino:
  **EPIC-MEJORA** (capacidad nueva; EPIC-FIX restaura, no añade).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Hecho**: la spec y **ADR-039**, escritos y **aprobados por el humano el 2026-09-03**, con las
cuatro decisiones del gate ya incorporadas al texto (§Resumen). Nada más — **no se ha tocado ni
una línea de código, ni `vercel.json`, ni la documentación**.

**No queda ninguna pregunta abierta que bloquee la implementación.** La hora es `0 6 * * *`, y el
implementador **escribe ese valor, no lo elige**. Lo que sí tiene que leer antes de empezar es por
qué esa hora arrastra **CA-8**: no está probada por la evidencia, y CA-8 es la condición de la
decisión, no un extra.

El orden de trabajo que menos sorpresas da:
1. `vercel.json`: `0 22 * * *` → **`0 6 * * *`** (CA-1). En cuanto se guarde, **tres ficheros de
   la batería se ponen rojos** —`deploy-gate-workflow` (9.2), `spec-031-frontera` (CA-13.2),
   `version-bump-gate`—; es lo esperado, y CA-3 dice exactamente qué hacer con ellos: **re-congelar
   al valor nuevo**, sin relajar la comparación y sin derivarla del propio fichero.
2. Las guardias de CA-2, CA-3, CA-4 y CA-5.
3. Los tres ficheros de `src/` (CA-5, CA-6) y el bump de versión **patch** (CA-11).
4. `docs/despliegue.md` §3.3 (CA-4) y la línea ~39 del roadmap (CA-9).
5. Dejar escrito aquí el recálculo de CA-7 (31 h 12 min contra 36 h) **antes** de abrir la PR.

**Después del merge** (CA-8): mirar las **dos primeras** filas de `cron_runs` bajo el horario
nuevo —deben aparecer **a las 06:00 UTC**, clavadas, porque la cuenta ya está en Pro—, anotar aquí
fecha, hora y `as_of` observado, y contrastar el `as_of` con la serie de al menos un símbolo. Si
las dos siguen escribiendo **D-2**, la hora cayó dentro del hueco de publicación y se aplica
**ADR-039 pto. 4** —mover a una hora probada (≥ 11:05 UTC), **sin ADR nuevo**—, y entonces **hay
que rehacer CA-7**: con ≥ 11:00 UTC el hueco de transición **sí** cruza el umbral de RN-16 y ese
segundo merge tiene que ir **después** del ciclo de esa noche. Todo eso se escribe aquí.

**La spec no se puede dar por hecha hasta que esas dos filas estén en este ledger.**
