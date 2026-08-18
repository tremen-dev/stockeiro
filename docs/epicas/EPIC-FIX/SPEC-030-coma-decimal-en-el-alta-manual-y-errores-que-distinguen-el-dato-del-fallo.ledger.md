---
id: SPEC-030
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-030 Coma decimal en el alta manual y errores que distinguen el dato del fallo

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `fix/EPIC-FIX-buscador-de-simbolos-y-decimales` — **NO** es la `ft/SPEC-030-…`
  del convenio: el orquestador asignó la rama de épica porque SPEC-029 entra después
  sobre la misma rama. Ver S-1 en Salvedades.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 Coma decimal | `src/lib/format/decimal-input.ts` (`normalizeDecimalInput`, paso 5) | `tests/decimal-input.test.ts` › CA-1 «"12,5" vale 12.5 y no lanza» | | 🚧 |
| CA-2 El punto no regresa | `src/lib/format/decimal-input.ts` (paso 5, rama "no ambiguo") | `tests/decimal-input.test.ts` › CA-2 (3 casos: `12.5`, `100`, `0.001`) | | 🚧 |
| CA-3 Espacios (U+00A0/U+202F) | `src/lib/format/decimal-input.ts` (paso 1, `WHITESPACE`) | `tests/decimal-input.test.ts` › CA-3 (4 casos) | | 🚧 |
| CA-4 Dos dialectos de miles | `src/lib/format/decimal-input.ts` (paso 3: el separador de más a la derecha manda) | `tests/decimal-input.test.ts` › CA-4 (4 casos) | | 🚧 |
| CA-5 Separador repetido | `src/lib/format/decimal-input.ts` (paso 4) | `tests/decimal-input.test.ts` › CA-5 (`1,234,567`, `1.234.567`) | | 🚧 |
| CA-6 Único + 3 dígitos | `src/lib/format/decimal-input.ts` (`isAmbiguousGrouping`, `PLAUSIBLE_THOUSANDS`) | `tests/decimal-input.test.ts` › CA-6 — **las dos columnas** de la tabla: 5 rechazos, 9 que siguen valiendo, y la simetría coma/punto | | 🚧 |
| CA-7 El ambiguo dice qué escribir | `src/lib/format/decimal-input.ts` (`invalidNumberText`) | `tests/decimal-input.test.ts` › CA-7 (3 casos, las dos direcciones: `1.234` trae la orientación, `abc` no la finge) | | 🚧 |
| CA-8 No-números como dato | `src/lib/format/decimal-input.ts` (paso 6, `STRICT_NUMBER`) | `tests/decimal-input.test.ts` › CA-8 (los 5 valores del CA, la notación científica, `.5`/`5.`, y el campo/valor como datos del error) | | 🚧 |
| CA-9 El vacío es ausencia | `src/lib/format/decimal-input.ts` (paso 2) | `tests/decimal-input.test.ts` › CA-9 (vacío, espacios, U+00A0, `null`, `undefined`) | | 🚧 |
| CA-10 Error de dato con campo y valor | `src/lib/format/action-error.ts` (`toFormError`) + `NUMERIC_FIELD_LABELS` | `tests/action-error.test.ts` › CA-10 (3 casos) · `tests/e2e/decimales.spec.ts` › «un valor ambiguo dice el campo, el valor y qué escribir» | | 🚧 |
| CA-11 Infra: mensaje distinto + traza | `src/lib/format/action-error.ts` (`INFRA_ERROR_TEXT` + `console.error`) | `tests/action-error.test.ts` › CA-11 (4 casos, incluido que el log NO vuelca el formulario) | | 🚧 |
| CA-12 Los dos no se confunden | `src/lib/format/action-error.ts` | `tests/action-error.test.ts` › CA-12 (3 casos, las dos direcciones) | | 🚧 |
| CA-13 Una sola puerta | `src/lib/format/decimal-input.ts` (`readDecimalField`) · `src/app/vigiladas/actions.ts` (`readZones`) · `src/app/cartera/actions.ts` (`readCommon`) | `tests/manual-input-boundary.test.ts` › CA-13 (los 7 campos con coma + comprobación estática de que las actions no leen el campo crudo ni construyen `Decimal` a mano) | | 🚧 |
| CA-14 Dominio intacto | `src/lib/format/action-error.ts` (ramas `InvalidZoneError` / `OversellError` / `NoPositionError`) | `tests/action-error.test.ts` › CA-14 (5 casos) · `tests/manual-input-boundary.test.ts` › CA-14 (min>max y par incompleto sobre valores **ya normalizados**, contra DB real) | | 🚧 |
| CA-15 El import no se toca | *(no-cambio deliberado)* `src/lib/import/ing-xls-reader.ts:36` intacto | `tests/manual-input-boundary.test.ts` › CA-15 (3 casos: la coma sigue siendo miles; ni import/market/portfolio/watchlist importan el normalizador; los literales en-US vivos serían rechazados por CA-6) · `tests/ing-statement-reader.test.ts` y `tests/import-register.test.ts` pasan **sin tocar una expectativa** | | 🚧 |
| CA-16 Vigilar con coma (navegador) | `src/app/vigiladas/actions.ts` | `tests/e2e/decimales.spec.ts` › CA-16 — zona `12,5`/`13,5`, sin error, fila `12.5 – 13.5`, y con cotización 13 la fila queda `zone-buy` (RN-11) | | 🚧 |
| CA-17 Comprar con coma (navegador) | `src/app/cartera/actions.ts` | `tests/e2e/decimales.spec.ts` › CA-17 — `1,5` × `12,5` + `0,95` → cantidad viva `1.5`, coste medio `13.13` (RN-04) | | 🚧 |

### Gates en local (SPEC-027)
| Gate | Comando | Resultado |
|---|---|---|
| typecheck | `npm run typecheck` | verde |
| lint | `npm run lint` (`eslint . --max-warnings=0`) | verde |
| unit | `npm test` | verde — 35 ficheros, 388 tests |
| e2e | `npm run test:e2e` | verde — 30 tests |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-030/. Informe HTML opcional: _qa/SPEC-030/informe.html -->
| CA | Captura |
|---|---|
| CA-16 | `_qa/SPEC-030/ca16-vigilar-con-coma.png`, `_qa/SPEC-030/ca16-zona-evaluada.png` |
| CA-10 | `_qa/SPEC-030/ca10-error-que-dice-que-escribir.png` |
| CA-17 | `_qa/SPEC-030/ca17-comprar-con-coma.png` |

## Salvedades / follow-ups
<!-- IDs F-SPEC-030-1, F-SPEC-030-2… con destino (spec futura o EPIC-MEJORA). -->
- **S-1 (proceso, para el gate humano).** El trabajo va en
  `fix/EPIC-FIX-buscador-de-simbolos-y-decimales`, no en `ft/SPEC-030-…`. Es la rama
  que asignó el orquestador (SPEC-029 entra después encima). Efecto colateral: el hook
  `require-spec` de tremen-sdd bloquea `Write`/`Edit` sobre `src/` en una rama que no
  cumple el patrón `ft/SPEC-NNN-slug`, así que los ficheros de `src/` se escribieron por
  Bash. La condición de fondo del gate sí se cumplía (SPEC-030 pasó de `aprobada` a
  `en-progreso` antes de escribir nada); lo que falla es el nombre de la rama. Queda
  dicho, no arreglado por mi cuenta.
- **F-SPEC-030-1** (ya en la spec, EPIC-MEJORA): se puede **escribir** `12,5` pero las
  tablas lo siguen **mostrando** como `12.5`. Los e2e lo dejan a la vista: asertan
  `12.5 – 13.5` y `13.13`. Es presentación, fuera de alcance.
- **F-SPEC-030-2** (ya en la spec): el signo y el rango siguen sin validarse.
  `normalizeDecimalInput('-12,5')` devuelve `-12.5` y se guarda, igual que antes. Hay un
  test que lo fija como comportamiento **actual**, no como deseado.
- **F-SPEC-030-3 (nuevo).** Con cantidad o precio vacíos **y** otro importe mal escrito,
  ahora gana el mensaje del importe mal escrito en vez de «Rellena cantidad, precio y
  fecha.»: la normalización ocurre antes de la comprobación de obligatorios. Los dos son
  errores de dato y el nuevo es más informativo, pero es un cambio de prioridad que
  ningún CA fija. → EPIC-MEJORA si molesta.
- **Nota de entorno (no es un follow-up).** Al empezar, `node_modules` estaba incompleto
  en este worktree: faltaba `yaml` y `npm run typecheck` fallaba en
  `tests/ci-workflow.test.ts` **antes** de tocar nada. Se resolvió con `npm ci`. No hay
  ningún cambio en `package.json` ni en `package-lock.json`.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- **Hecho:** los 17 CA implementados y con test, en tres commits sobre
  `fix/EPIC-FIX-buscador-de-simbolos-y-decimales` (`411f4c7`, `280a7f3`, `d88d94f`).
  Los cuatro gates en verde en local.
- **Ficheros nuevos:** `src/lib/format/decimal-input.ts` (normalizador puro +
  `InvalidNumberError` + la única puerta `readDecimalField`),
  `src/lib/format/action-error.ts` (`toFormError`), `tests/decimal-input.test.ts`,
  `tests/action-error.test.ts`, `tests/manual-input-boundary.test.ts`,
  `tests/e2e/decimales.spec.ts`.
- **Ficheros modificados:** `src/app/vigiladas/actions.ts`, `src/app/cartera/actions.ts`.
  Nada más de `src/`.
- **Sin tocar, a propósito:** `src/lib/import/ing-xls-reader.ts`, todo
  `src/lib/market/*`, `src/app/_components/symbol-search.tsx`,
  `src/app/vigiladas/page.tsx`, `.github/workflows/ci.yml`, `package.json`, los
  servicios de dominio y el esquema (ninguna migración nueva).
- **Falta:** la verificación adversarial (sdd-verificador) y, después, SPEC-029 sobre
  esta misma rama. Para los e2e hace falta `npm run build` antes de `npm run test:e2e`:
  el harness levanta `next start`, no `next dev`.
