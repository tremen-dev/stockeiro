---
id: SPEC-049
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-049 El gate de versión no dice verde sobre un árbol sucio: si lo que juzga no está commiteado, se abstiene

## Resumen
- Fase: en-revisión (implementación cerrada, a la espera de sdd-verificador)
- Rama: `ft/SPEC-049-el-gate-de-version-no-dice-verde-sobre-un-arbol-sucio-si-lo-que-juzga-no-esta-commiteado-se-abstiene`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `scripts/check-version-bump.mjs:339-364` — `evaluarConPendientes`, pura: forma el veredicto dos veces (diff vs. diff ∪ pendientes) con la misma base y las mismas dos versiones commiteadas, y compara el **código de salida** | `tests/version-bump-gate.test.ts:443-690` — bloque *«CA-1: el contraste con lo pendiente, como función pura»*, 15 casos sin invocar git; en particular *«el falso verde del 2026-08-23»*, *«el diff vacío de quien ejecuta el gate antes de commitear»* y *«se compara el CÓDIGO de salida, no el motivo»* | | ❌ |
| CA-2 | `scripts/check-version-bump.mjs:417-440` (`ficherosPendientes`, `git status --porcelain -z --untracked-files=all`) + `:523-529` (la salida de la abstención) | `tests/version-bump-gate.test.ts:715-737` — las tres formas, sobre repositorio temporal: *«sin seguimiento»*, *«modificado»*, *«en el indice»*; cada una exige `2` y que la salida **no** contenga `El diff no toca codigo de aplicacion` | | ❌ |
| CA-3 | `scripts/check-version-bump.mjs:417-440` — `--porcelain` deja fuera lo ignorado; el filtro no se reimplementa | `tests/version-bump-gate.test.ts:754-761` — *«lo que `.gitignore` ya excluye no cuenta como pendiente»* (`src/generado/` ignorado → `0` y sin nota) + `:665-670` en la parte pura | | ❌ |
| CA-4 | `scripts/check-version-bump.mjs:346-350` — códigos iguales ⇒ se emite el primero | `tests/version-bump-gate.test.ts:776-788` — *«si el número ya subió, emite el 0…»* (repo temporal) + `:601-613` en la parte pura | | ❌ |
| CA-5 | `scripts/check-version-bump.mjs:346-350`; la pista de `:542-560` (*«en el arbol de trabajo ya pone X»*) se conserva **sin tocar** | `tests/version-bump-gate.test.ts:790-806` — *«un `sin-subir` se emite entero, con su lista y con la pista del bump sin commitear»* + `:615-637` en la parte pura | | ❌ |
| CA-6 | `scripts/check-version-bump.mjs:339-364` — lo de fuera de las rutas de aplicación no mueve `tocados`, así que el código de salida no cambia | `tests/version-bump-gate.test.ts:763-774` — docs + tests + `package.json` con el bump sin commitear → mismo `0` y misma frase que con el árbol limpio | | ❌ |
| CA-7 | Nada que implementar: sin pendientes, `evaluarConPendientes` delega en `evaluar` intacto | `tests/version-bump-gate.test.ts:492-501` — los **cinco motivos**, uno a uno, comparados contra `evaluar` (salida, motivo, mensaje y `tocados`); `:703-709` control de árbol limpio sobre repo temporal. El bloque `:130-233` (SPEC-038 CA-12) sigue verde **sin una línea tocada** | | ❌ |
| CA-8 | `scripts/check-version-bump.mjs:351-363` — frase propia, lista con `listar()` (el mismo recorte de `sin-subir`), la salida, y ni un `npm version` | `tests/version-bump-gate.test.ts:672-690` (los cuatro puntos sobre el mensaje, con 12 pendientes para el recorte a diez) y `:739-752` (sobre el script: no se confunde con los otros dos motivos del `2`) | | ❌ |
| CA-9 | `scripts/check-version-bump.mjs:442-451` (`notaDePendientes`) + `:529-540` | `tests/version-bump-gate.test.ts:776-806` — la nota se exige en el `0` de CA-4 y en el `1` de CA-5; `:653-663` comprueba que la función pura devuelve los pendientes de aplicación | | ❌ |
| CA-10 | n-a (sólo suite) | `tests/version-bump-gate.test.ts:283-333` — helper `pendientesDeAplicacionAhora()` + `coherenteConElArbol()`, y los dos casos re-encuadrados con el antes/ahora/CA/fecha escrito al lado. Comprobados **rojos** con la formulación vieja y verdes con la nueva, con el árbol sucio y con el árbol limpio | | ❌ |
| CA-11 | n-a (sólo suite) | `tests/version-bump-gate.test.ts:692-808` — repositorio temporal construido por el test (molde: `tests/guardias-no-caducan.test.ts`), escena de CA-2, **sin `skipIf`**: no depende del árbol de nadie | | ❌ |
| CA-12 | `scripts/check-version-bump.mjs:429` — única invocación nueva, `git(['status', …])`, de sólo lectura | `tests/version-bump-gate.test.ts:357-372` — *«nunca invoca `git` para escribir»*: `PERMITIDOS` pasa a cuatro con `expect(PERMITIDOS).toHaveLength(4)` como tope, y el porqué/fecha/CA al lado. El resto de `:337-374` sin aflojar | | ❌ |
| CA-13 | `scripts/check-version-bump.mjs:36-64` (cabecera y contrato del `2`) y `:111-114`, `:126-130` (`--help`) | `tests/version-bump-gate.test.ts:810-870` — `--help` sale `0` y menciona la abstención; la cabecera dice la otra mitad; el contrato del `2` recoge los **tres** motivos en cabecera y ayuda | | ❌ |
| CA-14 | n-a — `.github/workflows/ci.yml` **no se ha tocado** (`git diff` de la rama no lo incluye) | `tests/version-bump-gate.test.ts:376-432` — bloque *«SPEC-038 CA-13»* verde **sin tocarse**: mismo step `Version bump`, `npm run version:check` y sólo eso, job `Checks`, `if: !cancelled()`, `fetch-depth: 0` | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-049/. Informe HTML opcional: _qa/SPEC-049/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-049-1, F-SPEC-049-2… con destino (spec futura o EPIC-MEJORA). -->

- **F-SPEC-049-1** — *Si `git status` fallara, la primera línea del `2` sería la
  equivocada.* `ficherosPendientes()` traduce cualquier fallo de git a `ErrorDeUso`, y el
  `catch` de `main` lo imprime bajo la cabecera *«No hay con que comparar contra
  "origin/main"»*, que no sería el motivo real. El código de salida sí es el correcto
  (`2`, no un `0` falso) y el `error.message` de debajo nombra `git status`, así que la
  información está. No lo he tocado porque el escenario es prácticamente imposible —si
  `rev-parse`, `show` y `diff` funcionaron, `status` funciona— y arreglarlo pedía un
  cuarto motivo de mensaje que ningún CA contempla. Destino: EPIC-FIX si se ve alguna vez.
- **F-SPEC-049-2** — *El bloque de CA-11 monta ocho repositorios temporales.* Uno por
  caso, para que ninguno herede la suciedad del anterior; añade unos 8 s al fichero de
  tests. Aceptable frente al coste de compartir estado entre casos, pero si la suite se
  pone lenta la palanca obvia es montar la escena base una vez y clonarla. Destino:
  EPIC-MEJORA.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Hecho y cerrado.** Los catorce CA implementados con TDD en cinco commits sobre
`ft/SPEC-049-…`, encima de `main` (b3a982a). Sólo dos ficheros tocados, los dos que la
spec autoriza: `scripts/check-version-bump.mjs` y `tests/version-bump-gate.test.ts`.

- `npm run test` → **1586/1586 en 105 ficheros**, verde.
- `npm run typecheck` → limpio. `npm run lint` → limpio (`--max-warnings=0`).
- `npm run version:check` **con el árbol commiteado** → `0`, *«El diff no toca codigo de
  aplicacion»*. Esta rama toca `scripts/` y `tests/`, no `src/`: **no hace falta bump**.
  Y esta vez ese `0` significa algo, porque el árbol estaba limpio y el gate sí miró.
- Comprobación de la ironía del encargo, sobre este mismo árbol: con
  `src/__spec049-repro.ts` sin seguimiento (la R-1 de la spec), `npm run version:check`
  devuelve **2** con el mensaje de la abstención y nombrando el fichero. Retirado
  después; el árbol quedó limpio.

**Para el verificador**, los dos sitios donde mirar con lupa:

1. El bloque de CA-11 (`tests/version-bump-gate.test.ts:692`) **no lleva `skipIf`** y no
   consulta el árbol del proyecto: si la abstención se revirtiera, se pone rojo en CI. Es
   lo único que impide que este verde sea vacío en el runner, donde el árbol está limpio.
2. El re-encuadre de CA-10 se comprobó en los dos sentidos **antes** de escribirlo: con un
   fichero suelto bajo `src/`, la formulación vieja se ponía roja (`expected 2 to be +0`);
   la nueva queda verde con el árbol sucio y con el árbol limpio. Repetible: crea un
   fichero cualquiera bajo `src/`, corre el fichero de tests, bórralo y vuelve a correrlo.

**Nada pendiente de implementación.** Sin push y sin PR: los lleva el humano.
