---
id: SPEC-053
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-053 La versión vive en los dos ficheros: el lock deja de derivar y una guardia lo mantiene

## Resumen
- Fase: **borrador** — pendiente del gate humano. La fuente de verdad es el frontmatter de
  la spec.
- Rama: `ft/SPEC-053-la-version-vive-en-los-dos-ficheros-el-lock-deja-de-derivar-y-una-guardia-lo-mantiene`
- Trae un ADR que necesita aprobación aparte: **ADR-033** (enmienda el pto. 8 de ADR-024).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->

> **Cuatro CA son criterios de GATE, no de test** (RI-03 / ADR-031): **CA-2, CA-3, CA-11 y
> CA-12** afirman algo sobre un **delta** —*«esta reparación estuvo acotada»*—, que deja de
> ser cierto en cuanto se mergea. Van `n-a` en la columna *Test* **a propósito**, con la
> evidencia en §Evidencia de los criterios de gate. Convertirlos en un test que mire
> `git diff origin/main` es exactamente lo que ADR-031 prohíbe y lo que SPEC-048 tuvo que
> desmontar: **si aparecen como test, es RED**.

| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 — los tres campos de versión coinciden | | | | ❌ |
| CA-2 — la reparación del lock es de dos líneas exactas | | **n-a (gate)** — criterio sobre el delta; evidencia abajo | | ❌ |
| CA-3 — `npm ci --dry-run` sigue en 0 tras sincronizar | | **n-a (gate)** — criterio sobre el delta; evidencia abajo | | ❌ |
| CA-4 — guardia permanente, sin git y sin `skipIf` | | | | ❌ |
| CA-5 — el rojo enseña la salida (ficheros, campos, comando, «los dos al mismo commit») | | | | ❌ |
| CA-6 — no vacuidad: mutación roja / coincidencia verde, y sin `skip`/`only`/`todo` | | | | ❌ |
| CA-7 — `tests/guardias-no-caducan.test.ts` sigue verde con el fichero nuevo dentro | | | | ❌ |
| CA-8 — `--help` y cabecera de `check-version-bump.mjs` dicen «los dos ficheros» | | | | ❌ |
| CA-9 — el mensaje de `sin-subir` lo dice también (sobre `evaluar`, puro) | | | | ❌ |
| CA-10 — no queda en el repositorio ninguna afirmación de «un solo fichero» | | | | ❌ |
| CA-11 — sobre `tests/` solo el fichero nuevo y adiciones a `version-bump-gate.test.ts` | | **n-a (gate)** — criterio sobre el delta; evidencia abajo | | ❌ |
| CA-12 — conjunto cerrado de ficheros de la rama | | **n-a (gate)** — criterio sobre el delta; evidencia abajo | | ❌ |

## Evidencia de los criterios de gate
<!-- CA-2, CA-3, CA-11, CA-12. Salida de comandos pegada, no parafraseada (RI-03 opción 2). -->

- **CA-2** — pegar aquí `git diff -- package-lock.json` **entero**. Tiene que ser
  `3c3` + `9c9` y nada más.
- **CA-3** — pegar la salida de `npm ci --dry-run` **antes y después** de sincronizar, con
  el exit code y el recuento de paquetes de las dos.
- **CA-11** — pegar `git diff --name-only <base>...HEAD -- tests/` y el diff completo de
  `tests/version-bump-gate.test.ts`, para que se vea que son **solo adiciones**.
- **CA-12** — pegar `git diff --name-only <base>...HEAD` entero.
- **`npm run version:check`** — se espera `0` con *«El diff no toca codigo de aplicacion»*.
  Esta rama no toca `src/` ni `app/`. Si sale otra cosa, hay que explicar por qué.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

_Pendiente: la spec está en `borrador`._

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-053/. Informe HTML opcional: _qa/SPEC-053/informe.html -->

**No aplica.** Esta spec no toca `src/` ni cambia un solo píxel de la interfaz. Su
evidencia es la salida de comandos, que va en §Evidencia de los criterios de gate y en la
matriz. Un `_qa/SPEC-053/` con capturas sería teatro.

## Salvedades / follow-ups

- **`F-SPEC-053-1` (aceptado, escrito antes de empezar)** — **la caché del navegador de
  Playwright se invalida en cada subida de versión.** La clave es
  `playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}`
  (`.github/workflows/ci.yml:169`) y su comentario dice que sale del lock *«porque es lo que
  fija la version de @playwright/test»*. Al sincronizar el lock en cada bump, la clave
  cambia aunque `@playwright/test` no se haya movido: **~130 MB de chromium descargados en
  cada PR que suba el número**, ~1 min (step `Install Playwright browser`,
  `timeout-minutes: 5`; `npx playwright install chromium` corre igual, así que el coste es
  la descarga, no un fallo). No se arregla aquí a propósito: tocar esa clave es tocar un
  step de CI que `tests/spec-031-frontera.test.ts` congela, y sería poner en juego un
  criterio de gate para arreglar otro —el error que `F-SPEC-050-4` describe—. *Destino*:
  **EPIC-INFRA**. *Disparador*: que el minuto moleste, o que el job de e2e se acerque a su
  `timeout-minutes: 25`. Es el mismo residual que **ADR-033** registra como `F-ADR-033-1`.

- **`F-SPEC-053-2` (para el gate, mecánico)** — **posible colisión del id `ADR-033`.** Los
  ids de spec vienen fijados desde fuera (053) porque hay otro arquitecto trabajando
  **SPEC-052** en paralelo; el del ADR lo asignó `scaffold.mjs`. **Comprobado al escribir
  esto**: en este worktree SPEC-052 ya ha depositado su spec y su ledger
  (`docs/epicas/EPIC-FIX/SPEC-052-…`) y **no ha creado ningún ADR** —`git status` sobre
  `docs/adr/` solo lista `ADR-033`, el mío—. Riesgo bajo, pero SPEC-052 aún puede estar
  escribiendo: **volver a mirar antes de mergear**. Si colisiona, el arreglo es un
  renombrado.

- **`F-SPEC-053-3` (cerrado por esta spec, se registra para trazabilidad)** —
  **`F-SPEC-050-4`** (ledger de SPEC-050) es el finding que origina esta spec. Se cierra
  con CA-1 (la deriva) y CA-8/CA-9 (el bucle de aprendizaje que lo produjo). Al cerrar
  SPEC-053, anotarlo allí.

## Cómo retomar (handoff)

**Estado**: solo existen los tres documentos. **Cero código, cero tests, cero cambios en el
árbol.** La spec está en `borrador` y **no la puede aprobar el arquitecto**.

**Lo que hay escrito**:

- `docs/epicas/EPIC-INFRA/SPEC-053-…md` — 12 CA, la decisión (A) argumentada frente a (B),
  y el precio de (A) que no estaba en la propuesta (la caché de Playwright).
- `docs/epicas/EPIC-INFRA/SPEC-053-…ledger.md` — este fichero.
- `docs/adr/ADR-033-…md` — **borrador**, enmienda el pto. 8 de ADR-024. Necesita aprobación
  **separada** en el mismo gate.

**Lo verificado al escribir, para que no se repita**:

| Afirmación | Cómo se comprobó | Resultado |
|---|---|---|
| La deriva existe en `3b6fc8b` | `git show origin/main:package.json` / `:package-lock.json` | `0.3.4` vs `0.3.2` (dos campos: líneas 3 y 9) |
| `npm version` toca los dos ficheros | copia de `3b6fc8b` en un directorio aparte + `diff` | **exactamente 2 líneas** (3 y 9), sin re-resolver dependencias |
| La reparación sin bump también | `npm install --package-lock-only` con `package.json` en `0.3.4` | **el mismo diff de 2 líneas** |
| Nadie lee el `version` del lock en CI | `grep package-lock .github/workflows/*.yml` | solo `hashFiles(…)` como clave de caché (`ci.yml:169`) |
| El gate compara `package.json`, no el lock | lectura de `scripts/check-version-bump.mjs` | `versionEn(ref)` → `git show <ref>:package.json` |
| Cuándo empezó la deriva | `git log -L 3,3:package-lock.json` | última sincronía en `3f62762` (0.3.2); `0.3.3` y `0.3.4` no la tocaron |
| No hay un tercer sitio con la versión | `grep '"version"'` en `*.json` + `grep '0\.3\.[0-9]'` en `src/ tests/ scripts/ .github/ vercel.json` | solo `package.json` y el lock; los `"version": "7"` de `drizzle/meta/` son el formato de snapshot; cero literales |

**Siguiente paso**: gate humano. Necesita **dos** decisiones —aprobar (A) sobre (B), y
aprobar ADR-033 como enmienda de ADR-024 pto. 8—, más el visto bueno a asumir
`F-SPEC-053-1` (el minuto de CI).

**Al implementar, el orden importa**: escribir la guardia de CA-4 **antes** de tocar
`package-lock.json`, dejar que se ponga **roja** por el defecto vivo, y pegar ese rojo en la
matriz. Es la prueba de no-vacuidad más fuerte disponible y es gratis; si se sincroniza
primero, se pierde.
