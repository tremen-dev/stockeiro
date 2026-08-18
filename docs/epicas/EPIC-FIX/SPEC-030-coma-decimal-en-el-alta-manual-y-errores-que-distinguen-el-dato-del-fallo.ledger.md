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
| CA-1 Coma decimal | `src/lib/format/decimal-input.ts` (`normalizeDecimalInput`, paso 5) | `tests/decimal-input.test.ts` › CA-1 «"12,5" vale 12.5 y no lanza» | Sonda propia fuera de la suite (node sobre el módulo): `12,5` → `12.5`, sin lanzar. Confirmado en navegador (CA-16). | ✅ |
| CA-2 El punto no regresa | `src/lib/format/decimal-input.ts` (paso 5, rama "no ambiguo") | `tests/decimal-input.test.ts` › CA-2 (3 casos: `12.5`, `100`, `0.001`) | Sonda propia: `12.5`→12.5, `100`→100, `0.001`→0.001. No hay regresión. | ✅ |
| CA-3 Espacios (U+00A0/U+202F) | `src/lib/format/decimal-input.ts` (paso 1, `WHITESPACE`) | `tests/decimal-input.test.ts` › CA-3 (4 casos) | Verificados los **codepoints reales** del test (U+00A0 en l. 52, U+202F en l. 56; no son espacios normales). Sonda propia: los tres → 1234.56. | ✅ |
| CA-4 Dos dialectos de miles | `src/lib/format/decimal-input.ts` (paso 3: el separador de más a la derecha manda) | `tests/decimal-input.test.ts` › CA-4 (4 casos) | Sonda propia: `1.234,56` y `1,234.56` → 1234.56; `1.234.567,89` → 1234567.89; decimal repetido → ambiguo. | ✅ |
| CA-5 Separador repetido | `src/lib/format/decimal-input.ts` (paso 4) | `tests/decimal-input.test.ts` › CA-5 (`1,234,567`, `1.234.567`) | Sonda propia: `1,234,567` y `1.234.567` → rechazo con motivo `ambiguo`. | ✅ |
| CA-6 Único + 3 dígitos | `src/lib/format/decimal-input.ts` (`isAmbiguousGrouping`, `PLAUSIBLE_THOUSANDS`) | `tests/decimal-input.test.ts` › CA-6 — **las dos columnas** de la tabla: 5 rechazos, 9 que siguen valiendo, y la simetría coma/punto | **Las dos columnas re-verificadas con sonda propia.** Rechaza `1.234` `1,234` `12,345` `123.456` `10,000` `999,000` `-1.234`; **siguen valiendo** `0.001` `0,500` `0,000` `1234,567` `1,2345` `12,5` `12,75`. La condición existe de verdad: `PLAUSIBLE_THOUSANDS` (decimal-input.ts:75) aplicada en `isAmbiguousGrouping` (l. 87-90); no está simplificada a «tres dígitos detrás → rechazo». | ✅ |
| CA-7 El ambiguo dice qué escribir | `src/lib/format/decimal-input.ts` (`invalidNumberText`) | `tests/decimal-input.test.ts` › CA-7 (3 casos, las dos direcciones: `1.234` trae la orientación, `abc` no la finge) | Mensaje real capturado en navegador (`ca10-error-que-dice-que-escribir.png`): valor rechazado + las dos salidas. El test asserta las dos direcciones (`abc` no finge la orientación). Ver O-1. | ✅ |
| CA-8 No-números como dato | `src/lib/format/decimal-input.ts` (paso 6, `STRICT_NUMBER`) | `tests/decimal-input.test.ts` › CA-8 (los 5 valores del CA, la notación científica, `.5`/`5.`, y el campo/valor como datos del error) | Sonda propia: `12€` `abc` `-` `1e3` → `no_es_numero`; `12,5,3` → `ambiguo`. Ninguno llega a `new Decimal` (l. 140 corta antes) y ningún mensaje contiene «DecimalError». | ✅ |
| CA-9 El vacío es ausencia | `src/lib/format/decimal-input.ts` (paso 2) | `tests/decimal-input.test.ts` › CA-9 (vacío, espacios, U+00A0, `null`, `undefined`) | Sonda propia: cadena vacía, `"   "`, U+00A0 solo, `null` y `undefined` → `null`, sin lanzar. | ✅ |
| CA-10 Error de dato con campo y valor | `src/lib/format/action-error.ts` (`toFormError`) + `NUMERIC_FIELD_LABELS` | `tests/action-error.test.ts` › CA-10 (3 casos) · `tests/e2e/decimales.spec.ts` › «un valor ambiguo dice el campo, el valor y qué escribir» | e2e propio en navegador: el `.auth-error` real dice «Zona de compra (mínimo): «1.234» es ambiguo… (1234) … (1234,00)». `grep -rn "Datos inválidos" src/` → solo 2 comentarios, ninguna cadena de UI. | ✅ |
| CA-11 Infra: mensaje distinto + traza | `src/lib/format/action-error.ts` (`INFRA_ERROR_TEXT` + `console.error`) | `tests/action-error.test.ts` › CA-11 (4 casos, incluido que el log NO vuelca el formulario) | `toFormError` (action-error.ts:48) loguea exactamente 2 argumentos —acción y excepción— y devuelve `INFRA_ERROR_TEXT`. El test lo fija con `toHaveLength(2)`: el formulario no se vuelca (RN-01/D-5). | ✅ |
| CA-12 Los dos no se confunden | `src/lib/format/action-error.ts` | `tests/action-error.test.ts` › CA-12 (3 casos, las dos direcciones) | Las dos direcciones asertadas y releídas: dato → `console.error` NO llamado; infra → llamado 1 vez; mensajes distintos. | ✅ |
| CA-13 Una sola puerta | `src/lib/format/decimal-input.ts` (`readDecimalField`) · `src/app/vigiladas/actions.ts` (`readZones`) · `src/app/cartera/actions.ts` (`readCommon`) | `tests/manual-input-boundary.test.ts` › CA-13 (los 7 campos con coma + comprobación estática de que las actions no leen el campo crudo ni construyen `Decimal` a mano) | Auditoría propia del producto entero: los **7** `<input inputMode="decimal">` que existen (watch-form.tsx:27-35, portfolio-forms.tsx:14-22) son exactamente las 7 claves de `NUMERIC_FIELD_LABELS`; no hay ningún otro campo numérico de texto libre. `grep "new Decimal(" src/app/` → 0 resultados. | ✅ |
| CA-14 Dominio intacto | `src/lib/format/action-error.ts` (ramas `InvalidZoneError` / `OversellError` / `NoPositionError`) | `tests/action-error.test.ts` › CA-14 (5 casos) · `tests/manual-input-boundary.test.ts` › CA-14 (min>max y par incompleto sobre valores **ya normalizados**, contra DB real) | Los cuatro mensajes son **idénticos** a los previos (comprobado en `git diff 429140d..HEAD`). Los e2e de dominio siguen verdes: vigiladas.spec.ts:165 (min>max) y cartera.spec.ts:52 (sobreventa). | ✅ |
| CA-15 El import no se toca | *(no-cambio deliberado)* `src/lib/import/ing-xls-reader.ts:36` intacto | `tests/manual-input-boundary.test.ts` › CA-15 (3 casos: la coma sigue siendo miles; ni import/market/portfolio/watchlist importan el normalizador; los literales en-US vivos serían rechazados por CA-6) · `tests/ing-statement-reader.test.ts` y `tests/import-register.test.ts` pasan **sin tocar una expectativa** | `git diff 83ebdb8..HEAD -- src/lib/import/ src/lib/market/ tests/ing-statement-reader.test.ts tests/import-register.test.ts tests/market-provider-dialect.test.ts` → **vacío**: ni una expectativa tocada. `grep -rn "format/decimal-input" src/` → solo las 2 server actions. Las 3 suites verdes. Guardia **conductual** real: `280.093` (ing-statement-reader.test.ts:134), `11.984` y `3.615` se pondrían rojos si alguien unificase los parsers, porque CA-6 los rechaza (verificado con sonda). Ver O-2. | ✅ |
| CA-16 Vigilar con coma (navegador) | `src/app/vigiladas/actions.ts` | `tests/e2e/decimales.spec.ts` › CA-16 — zona `12,5`/`13,5`, sin error, fila `12.5 – 13.5`, y con cotización 13 la fila queda `zone-buy` (RN-11) | Ejecutado por el verificador: `npx playwright test --forbid-only` → 30/30. Captura `ca16-zona-evaluada.png`: **TEF, precio 13, ZONA COMPRA `12.5 – 13.5`, fila `zone-buy` «En zona de compra»**. Con 125–135 el precio 13 habría quedado fuera de zona: la coma NO se leyó como miles. | ✅ |
| CA-17 Comprar con coma (navegador) | `src/app/cartera/actions.ts` | `tests/e2e/decimales.spec.ts` › CA-17 — `1,5` × `12,5` + `0,95` → cantidad viva `1.5`, coste medio `13.13` (RN-04) | Captura `ca17-comprar-con-coma.png`: MSFT, cantidad viva `1.5`, coste medio `13.13` = (1,5 × 12,5 + 0,95) / 1,5 (RN-04). Sin mensaje de error. | ✅ |

### Gates en local (SPEC-027)
| Gate | Comando | Resultado |
|---|---|---|
| typecheck | `npm run typecheck` | verde |
| lint | `npm run lint` (`eslint . --max-warnings=0`) | verde |
| unit | `npm test` | verde — 35 ficheros, 388 tests |
| e2e | `npm run test:e2e` | verde — 30 tests |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-18, sdd-verificador. 17/17 CA cerrados, ninguna salvedad bloqueante.**

Verificado sobre `ft/SPEC-030-coma-decimal-en-el-alta-manual` @ `4f1c042` (implementación:
`411f4c7`, `280a7f3`, `d88d94f` sobre `429140d`; base `origin/main` @ `83ebdb8`).

### Gates ejecutados por el verificador (no reportados: corridos)
| Gate | Comando | Salida |
|---|---|---|
| typecheck | `npm run typecheck` | exit 0, sin diagnósticos |
| lint | `npm run lint` (`eslint . --max-warnings=0`) | exit 0, sin warnings |
| unit | `npm test` | exit 0 — **35 ficheros, 388 tests, 388 passed** |
| e2e | `npm run build` + `npx playwright test --forbid-only` | exit 0 — **30/30 passed**, ningún `.only` |

`tests/schema-source.test.ts` y `tests/ci-workflow.test.ts` verdes: esta spec no tocó ni
esquema ni CI (`git diff` sobre `.github/`, `package.json` y `src/db/` → vacío).

### Lo que no me creí y comprobé aparte
1. **CA-6, las dos columnas.** No me fié de la suite: cargué `decimal-input.ts` fuera de
   vitest y pasé los casos de la tabla más seis propios (`999,000`, `0,000`, `00,500`,
   `-1.234`, `1234.567`, `1 234,56` con los tres espacios). 0 fallos. La regla **no** está
   simplificada: `0.001`, `0,500` y `1234,567` siguen valiendo y `1.234` se rechaza, con
   simetría entre coma y punto.
2. **CA-13/CA-15, la trampa del parser del import.** `src/lib/import/ing-xls-reader.ts` no
   aparece en el diff contra la base; su línea 36 sigue siendo `.replace(/,/g, '')` con la
   coma como separador de MILES. Las suites `ing-statement-reader`, `import-register` y
   `market-provider-dialect` pasan **sin una sola expectativa modificada** (diff vacío). El
   test que blinda la separación no es cosmético: además de la aserción estática sobre el
   fuente, comprueba que los literales en-US vivos (`11.984`, `3.615`, `12.852`, `280.093`)
   **serían rechazados** por el normalizador, así que unificar los parsers pondría roja la
   suite del import de verdad.
3. **CA-10/CA-11, el aserto en las dos direcciones.** Releídos: el error de dato no llama a
   `console.error` y el de infraestructura sí, con exactamente 2 argumentos (acción +
   excepción). No se filtra nada del formulario.
4. **CA-15, el normalizador solo en la frontera.** `grep -rn "format/decimal-input" src/`
   devuelve únicamente `src/app/vigiladas/actions.ts` y `src/app/cartera/actions.ts`. Ni
   `import/`, ni `market/`, ni `portfolio/`, ni `watchlist/`.
5. **El flujo real en navegador.** Corrido por mí contra la app construida (`next start` +
   Postgres efímero). El defecto reportado está cerrado: `12,5`/`13,5` en `/vigiladas` se
   guarda como **12.5 – 13.5** y una cotización de 13 pinta la fila «En zona de compra»
   (RN-11). Si la coma se hubiera leído como miles la zona sería 125–135 y el 13 quedaría
   fuera: no es el caso.
6. **El rodeo del hook `require-spec`.** No dejó nada a medias: el árbol de trabajo está
   limpio (solo PNGs de `_qa` regenerados por mi propia pasada de e2e), no hay ficheros sin
   seguimiento ni ignorados bajo `src/` o `tests/`, y los cuatro ficheros de `src/` tocados
   (`decimal-input.ts`, `action-error.ts` y las dos actions) tienen test. La rama ya cumple
   el convenio: `ft/SPEC-030-coma-decimal-en-el-alta-manual` — **S-1 queda resuelta**; su
   texto conserva el nombre viejo porque es historia.

### Juicio sobre los tres puntos que dejó anotados el implementador
- **F-SPEC-030-3 (prioridad del mensaje): ACEPTADA, no bloquea.** Confirmado leyendo
  `readCommon` (cartera/actions.ts:34-41): el objeto se evalúa en orden y el primer campo
  mal escrito lanza antes de llegar al guard de obligatorios. Ningún CA fija esa prioridad,
  los dos son errores de dato, el nuevo es estrictamente más informativo y no se pierde ni
  se enruta mal ningún dato. Coste máximo: un viaje extra cuando el usuario deja cantidad
  vacía **y además** escribe mal otro importe. Se queda como follow-up.
- **CA-7 con literales fijos: CUMPLE tal como está escrito.** El propio CA nombra `1234` y
  `1234,00` como las dos salidas concretas, y el mensaje muestra el valor rechazado más esas
  dos. Cumple la letra. Dicho eso, para `10,000` los ejemplos no guardan relación con lo
  tecleado y se leen como instrucción sobre *ese* valor → **O-1**: mejora, no defecto.
- **La escritura por Bash: sin rastro.** Ver punto 6.

### Observaciones (no bloquean; ningún CA las exige)
- **O-1.** El mensaje del ambiguo usa `1234`/`1234,00` fijos. Derivarlos del valor tecleado
  (para `10,000` → «10000» o «10,000 con decimales explícitos») sería más claro. CA-7 no lo
  pide. → EPIC-MEJORA.
- **O-2.** El sentido en-US de la coma en el import está blindado por (a) una aserción
  estática sobre el fuente y (b) los literales vivos que CA-6 rechazaría; **no** hay un test
  que meta `"1,234.56"` por `parseDecimal` y espere `1234.56`. CA-15 no lo exige y las dos
  guardias funcionan, pero un caso conductual sería más barato de leer. → EPIC-MEJORA.
- **O-3.** Al fallar la validación, el formulario de `/vigiladas` se vacía y el usuario tiene
  que reescribir las zonas (visible en `ca10-error-que-dice-que-escribir.png`). Es
  comportamiento anterior a esta spec, no una regresión suya, y el mensaje devuelve el valor
  rechazado. Emparenta con F-SPEC-030-1. → EPIC-MEJORA.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-030/. Informe HTML opcional: _qa/SPEC-030/informe.html -->
| CA | Captura |
|---|---|
| CA-16 | `_qa/SPEC-030/ca16-vigilar-con-coma.png`, `_qa/SPEC-030/ca16-zona-evaluada.png` — zona `12.5 – 13.5` y fila en zona con precio 13 |
| CA-10 · CA-7 | `_qa/SPEC-030/ca10-error-que-dice-que-escribir.png` — mensaje real: campo, valor y las dos salidas |
| CA-17 | `_qa/SPEC-030/ca17-comprar-con-coma.png` — cantidad viva `1.5`, coste medio `13.13` |

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
