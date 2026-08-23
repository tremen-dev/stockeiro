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
| CA-1 | `scripts/check-version-bump.mjs:339-364` — `evaluarConPendientes`, pura: forma el veredicto dos veces (diff vs. diff ∪ pendientes) con la misma base y las mismas dos versiones commiteadas, y compara el **código de salida** | `tests/version-bump-gate.test.ts:443-690` — bloque *«CA-1: el contraste con lo pendiente, como función pura»*, 15 casos sin invocar git; en particular *«el falso verde del 2026-08-23»*, *«el diff vacío de quien ejecuta el gate antes de commitear»* y *«se compara el CÓDIGO de salida, no el motivo»* | Leido `evaluarConPendientes` (`:339-364`): compara `conPendientes.salida === veredicto.salida` — el **codigo de salida**, no `motivo`. Verificado en el codigo, no en el comentario. Los 14 casos del bloque puro corren y pasan (`vitest --reporter=verbose`). Contraste vivo en repositorio propio: `sin-codigo`→`subida` con `src/` sucio emite `0` (mismos codigos) y `sin-codigo`→`sin-subir` sale `2`. | ✅ |
| CA-2 | `scripts/check-version-bump.mjs:417-440` (`ficherosPendientes`, `git status --porcelain -z --untracked-files=all`) + `:523-529` (la salida de la abstención) | `tests/version-bump-gate.test.ts:715-737` — las tres formas, sobre repositorio temporal: *«sin seguimiento»*, *«modificado»*, *«en el indice»*; cada una exige `2` y que la salida **no** contenga `El diff no toca codigo de aplicacion` | **Reproducido a mano sobre este arbol**, las tres formas: sin seguimiento (`src/__qa049-sin-seguimiento.ts`), modificado (`src/lib/version/identity.ts`) e indexado (`git add` sin commit). Las tres → **EXIT=2**, nombran el fichero y **no** imprimen `El diff no toca codigo de aplicacion`. Extra no pedido: un `git mv` bajo `src/` tambien sale `2` y lista origen y destino. Arbol restaurado. | ✅ |
| CA-3 | `scripts/check-version-bump.mjs:417-440` — `--porcelain` deja fuera lo ignorado; el filtro no se reimplementa | `tests/version-bump-gate.test.ts:754-761` — *«lo que `.gitignore` ya excluye no cuenta como pendiente»* (`src/generado/` ignorado → `0` y sin nota) + `:665-670` en la parte pura | Comprobado sobre este arbol con ficheros que `.gitignore` si excluye: `src/dist/qa049.ts` (`.gitignore:5`) y `src/qa049.tsbuildinfo` (`.gitignore:6`). `git check-ignore -v` los confirma, `git status --porcelain` los omite, el gate sale **0** con el mensaje de siempre y **sin** nota de pendientes. | ✅ |
| CA-4 | `scripts/check-version-bump.mjs:346-350` — códigos iguales ⇒ se emite el primero | `tests/version-bump-gate.test.ts:776-788` — *«si el número ya subió, emite el 0…»* (repo temporal) + `:601-613` en la parte pura | Verificado en **repositorio propio del verificador** (no el que monta el test): base + commit que sube `0.1.0`→`0.2.0` tocando solo docs, y `src/a-medias.ts` sin seguimiento → **EXIT=0** con `El diff no toca codigo de aplicacion` mas la nota de CA-9. No degrada a `2`. | ✅ |
| CA-5 | `scripts/check-version-bump.mjs:346-350`; la pista de `:542-560` (*«en el arbol de trabajo ya pone X»*) se conserva **sin tocar** | `tests/version-bump-gate.test.ts:790-806` — *«un `sin-subir` se emite entero, con su lista y con la pista del bump sin commitear»* + `:615-637` en la parte pura | Verificado en repositorio propio: commit que toca `src/tocado.ts` sin subir el numero, mas `src/otro-a-medias.ts` pendiente y el `npm version` sin commitear → **EXIT=1** con el mensaje entero (`Ficheros que lo disparan: · src/tocado.ts`, `npm version patch/minor`) **y** la pista literal `Ojo: en el arbol de trabajo ya pone 0.2.0, pero todavia no esta commiteado`. No degrada a `2`. | ✅ |
| CA-6 | `scripts/check-version-bump.mjs:339-364` — lo de fuera de las rutas de aplicación no mueve `tocados`, así que el código de salida no cambia | `tests/version-bump-gate.test.ts:763-774` — docs + tests + `package.json` con el bump sin commitear → mismo `0` y misma frase que con el árbol limpio | Comprobado sobre este arbol: `docs/roadmap.md` modificado mas `tests/__qa049.tmp.ts` sin seguimiento → **EXIT=0** y salida identica a la del arbol limpio, sin nota de pendientes (no hay ninguno de aplicacion). El `package.json` del bump sin commitear queda cubierto por el caso de repositorio temporal. | ✅ |
| CA-7 | Nada que implementar: sin pendientes, `evaluarConPendientes` delega en `evaluar` intacto | `tests/version-bump-gate.test.ts:492-501` — los **cinco motivos**, uno a uno, comparados contra `evaluar` (salida, motivo, mensaje y `tocados`); `:703-709` control de árbol limpio sobre repo temporal. El bloque `:130-233` (SPEC-038 CA-12) sigue verde **sin una línea tocada** | Cero regresion por tres vias: (a) `git diff main...HEAD` **no toca ni una linea** de `:130-233` ni de `:376-432` — las unicas lineas eliminadas del test son los dos casos re-encuadrados, la lista de subcomandos y dos imports; (b) del script solo se eliminan texto de cabecera/`--help` y la extraccion de la lista a `listar()`, cuya salida es identica caracter a caracter; (c) los cinco motivos pasan comparados contra `evaluar` en salida, motivo, mensaje y `tocados`, y el control de arbol limpio sale `0` con la frase de siempre. | ✅ |
| CA-8 | `scripts/check-version-bump.mjs:351-363` — frase propia, lista con `listar()` (el mismo recorte de `sin-subir`), la salida, y ni un `npm version` | `tests/version-bump-gate.test.ts:672-690` (los cuatro puntos sobre el mensaje, con 12 pendientes para el recorte a diez) y `:739-752` (sobre el script: no se confunde con los otros dos motivos del `2`) | Los tres motivos del `2` ejecutados y contrastados sobre este arbol: abstencion → `No puedo emitir un veredicto: hay codigo de aplicacion pendiente sin commitear.`; bandera → `Bandera desconocida: …` mas el texto de uso; base → `No hay con que comparar contra "…"`. Frases propias y disjuntas (1). Nombra el fichero con el formato `  · ruta`, del mismo `listar()` que usa `sin-subir` (2). Dice `Commitealos —o guardalos aparte con git stash— y vuelve a pasar el gate` (3). En la salida real **no aparece `npm version`** ni se pide subir el numero (4). | ✅ |
| CA-9 | `scripts/check-version-bump.mjs:442-451` (`notaDePendientes`) + `:529-540` | `tests/version-bump-gate.test.ts:776-806` — la nota se exige en el `0` de CA-4 y en el `1` de CA-5; `:653-663` comprueba que la función pura devuelve los pendientes de aplicación | Vista en las dos ramas de emision, en repositorio propio: con el `0` de CA-4 y con el `1` de CA-5 aparece `Ojo: 1 fichero de codigo de aplicacion sigue pendiente en el arbol de trabajo y NO ha entrado en este veredicto.` Con cero pendientes de aplicacion (CA-3, CA-6) la linea **no** aparece. | ✅ |
| CA-10 | n-a (sólo suite) | `tests/version-bump-gate.test.ts:283-333` — helper `pendientesDeAplicacionAhora()` + `coherenteConElArbol()`, y los dos casos re-encuadrados con el antes/ahora/CA/fecha escrito al lado. Comprobados **rojos** con la formulación vieja y verdes con la nueva, con el árbol sucio y con el árbol limpio | **Los dos escenarios corridos por el verificador.** Arbol limpio: `npm run test` → **1586/1586 en 105 ficheros**, verde. Arbol sucio (`src/__qa049-suciedad.ts` sin seguimiento, con el gate devolviendo `2` en ese mismo instante): `npx vitest run` → **1586/1586**, verde otra vez. El re-encuadre lleva antes/ahora/CA/fecha escrito al lado (`:311-334`). No exige estado del arbol: pregunta a git y filtra con la funcion que el script exporta. | ✅ |
| CA-11 | n-a (sólo suite) | `tests/version-bump-gate.test.ts:692-808` — repositorio temporal construido por el test (molde: `tests/guardias-no-caducan.test.ts`), escena de CA-2, **sin `skipIf`**: no depende del árbol de nadie | Siempre activo: `grep` de `skip`, `.only` y `todo(` sobre el fichero → **ninguno**; los ocho casos aparecen ejecutados con tiempo real (~500 ms cada uno) en `--reporter=verbose`. Independiente del arbol de nadie: `montarEscena` crea el repo en `tmpdir()`, escribe su propio `package.json`/`.sdd.json`/`.gitignore`, **copia** el script (con lo que `RAIZ` cae dentro del temporal) y pasa su propio `--base <sha>`. **No vacio, demostrado**: mutando en mi scratchpad la unica linea que lo activa (`pendientes: ficherosPendientes()` → `pendientes: []`) sobre esa misma escena, el gate reproduce el falso verde del 2026-08-23 (`EXIT=0` mas `El diff no toca codigo de aplicacion`), que es justo lo que el centinela rechaza. | ✅ |
| CA-12 | `scripts/check-version-bump.mjs:429` — única invocación nueva, `git(['status', …])`, de sólo lectura | `tests/version-bump-gate.test.ts:357-372` — *«nunca invoca `git` para escribir»*: `PERMITIDOS` pasa a cuatro con `expect(PERMITIDOS).toHaveLength(4)` como tope, y el porqué/fecha/CA al lado. El resto de `:337-374` sin aflojar | Contados los subcomandos **realmente** invocados en el script: `show` (`:390`), `status` (`:418`), `diff` (`:454`), `rev-parse` (`:500`) — **cuatro**, todos de lectura. Tope escrito y ejecutado: `expect(PERMITIDOS).toHaveLength(4)` (`:369`). El resto de `:337-374` no se afloja: sigue exigiendo solo `node:*`, ni `fetch` ni URL, y ni `writeFileSync|appendFileSync|writeFile|mkdirSync`. | ✅ |
| CA-13 | `scripts/check-version-bump.mjs:36-64` (cabecera y contrato del `2`) y `:111-114`, `:126-130` (`--help`) | `tests/version-bump-gate.test.ts:810-870` — `--help` sale `0` y menciona la abstención; la cabecera dice la otra mitad; el contrato del `2` recoge los **tres** motivos en cabecera y ayuda | `node scripts/check-version-bump.mjs --help` → **EXIT=0**, y su contrato dice `2  uso incorrecto; no hay con que comparar; o hay codigo de aplicacion / pendiente sin commitear que cambiaria el veredicto (abstencion)`: los tres motivos. La cabecera (`:36-64`) dice la otra mitad (*si te adelantaste con el CODIGO … el gate se abstiene con 2 en vez de decir 0*) y el cuerpo de `--help` (`:111-114`) tambien. | ✅ |
| CA-14 | n-a — `.github/workflows/ci.yml` **no se ha tocado** (`git diff` de la rama no lo incluye) | `tests/version-bump-gate.test.ts:376-432` — bloque *«SPEC-038 CA-13»* verde **sin tocarse**: mismo step `Version bump`, `npm run version:check` y sólo eso, job `Checks`, `if: !cancelled()`, `fetch-depth: 0` | `git diff main...HEAD --name-only` devuelve **exactamente cuatro** rutas: la spec, este ledger, `scripts/check-version-bump.mjs` y `tests/version-bump-gate.test.ts`. `.github/workflows/ci.yml` **no aparece**, ni ningun otro fichero. El bloque `SPEC-038 CA-13` (`:376-432`) sigue verde sin una linea tocada. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-23, sdd-verificador.** Los catorce CA cumplen. El defecto del
2026-08-23 está cerrado y comprobado a mano sobre este mismo árbol, no sólo por la
suite.

### Gates automáticos

| Gate | Resultado |
|---|---|
| `npm run test` (árbol limpio) | **1586/1586 en 105 ficheros**, verde |
| `npm run test` (árbol **sucio**, `src/` con fichero sin seguimiento) | **1586/1586**, verde |
| `npm run typecheck` | limpio, sin salida |
| `npm run lint` (`--max-warnings=0`) | limpio, sin salida |
| `npm run version:check` (árbol commiteado y limpio) | `0` — *«El diff no toca codigo de aplicacion: no hay nada que subir.»* Esta rama toca `scripts/` y `tests/`, no `src/`: correcto, y esta vez el `0` sí ha mirado |

### La reproducción del defecto, hecha por el verificador

Sobre `D:\src\tremen-dev\stockeiro`, árbol restaurado a limpio después de cada caso:

| Escena | Salida | Código |
|---|---|---|
| Limpio | `El diff no toca codigo de aplicacion` | `0` |
| `src/__qa049-sin-seguimiento.ts` **sin seguimiento** | abstención, nombra el fichero | **`2`** |
| `src/lib/version/identity.ts` **modificado** | abstención, nombra el fichero | **`2`** |
| `src/__qa049-indexado.ts` **en el índice** (`git add`) | abstención, nombra el fichero | **`2`** |
| `git mv` bajo `src/` (**renombrado**, no pedido por ningún CA) | abstención, lista **origen y destino** | **`2`** |
| Ignorados bajo `src/` (`src/dist/…`, `*.tsbuildinfo`) | `El diff no toca codigo de aplicacion`, sin nota | `0` |
| Sucio sólo en `docs/` y `tests/` | idéntico al árbol limpio | `0` |

En ninguna de las abstenciones aparece `El diff no toca codigo de aplicacion`, y en
ninguna aparece `npm version`.

### Lo que más apreté, y por qué pasó

1. **CA-4 y CA-5 no degradan a `2`.** Verificados en repositorios que monté yo, no en
   los del test: con la versión ya subida y `src/` sucio el gate **emite** su `0`; con un
   `sin-subir` commiteado y `src/` sucio emite el **`1` entero**, con la lista de ficheros
   y con la pista *«en el arbol de trabajo ya pone 0.2.0, pero todavia no esta
   commiteado»* intacta. El arreglo no es peor que el defecto.
2. **CA-10 en los dos escenarios.** Ensucié el árbol con un fichero bajo `src/` —con el
   gate devolviendo `2` en ese mismo instante— y volví a correr la suite entera:
   1586/1586. El re-encuadre no deja un test que se ponga rojo durante el desarrollo
   normal.
3. **CA-11 no es un verde vacío.** Sin `skipIf`, sin `.only`, sin `skip`; los ocho casos
   se ven ejecutados con tiempo real. Y lo probé por mutación en mi scratchpad: revirtiendo
   la única línea que activa la abstención (`pendientes: ficherosPendientes()` →
   `pendientes: []`) sobre la misma escena, el gate reproduce el falso verde (`0` +
   `El diff no toca codigo de aplicacion`) — que es exactamente lo que el centinela
   rechaza. Se pondría rojo en CI.
4. **CA-12 son cuatro y hay tope.** `show`, `status`, `diff`, `rev-parse`; ni uno más en
   el script, y `expect(PERMITIDOS).toHaveLength(4)` escrito y ejecutado. El resto del
   bloque no se ha aflojado.
5. **CA-1 compara el código, no el motivo, en el código y no en el comentario**:
   `conPendientes.salida === veredicto.salida` (`:348`).
6. **CA-7 y CA-14 sin regresión.** `git diff main...HEAD --name-only` devuelve **cuatro**
   rutas: la spec, este ledger, `scripts/check-version-bump.mjs` y
   `tests/version-bump-gate.test.ts`. `.github/workflows/ci.yml` no aparece. Los bloques
   `:130-233` (SPEC-038 CA-12) y `:376-432` (SPEC-038 CA-13) no tienen ni una línea tocada.

### Observaciones que no bloquean

- **O-1 — referencias de línea del ledger con deriva.** Varias celdas de la columna *Test*
  apuntan a líneas que ya no son las suyas: el bloque puro de CA-1 es `:443-592` (no
  `:443-690`) y son **14** casos, no 15; las sub-referencias de CA-3 (`:665-670`), CA-4
  (`:601-613`), CA-5 (`:615-637`), CA-8 (`:672-690`) y CA-9 (`:653-663`) caen dentro del
  helper de CA-11, no en la parte pura. Los casos existen y pasan —los he ejecutado uno a
  uno por nombre—, así que ningún CA se cae por esto; es exactitud documental de la mitad
  del implementador. Sin destino: se corrige al vuelo si alguien toca el ledger.
- **O-2 — asimetría de comillas en el helper de CA-10.** El script lee el árbol con
  `git status --porcelain -z` (rutas sin comillar); `pendientesDeAplicacionAhora()`
  (`:272-285`) usa la forma **sin** `-z`, donde git comilla y escapa las rutas con
  caracteres no ASCII o espacios. Si algún día hay un pendiente así **y** el gate se
  abstiene, el `salida.includes(fichero)` podría fallar y poner rojo un caso que no
  debería. No es alcanzable hoy y ningún CA lo pide. Destino: EPIC-MEJORA si aparece.

### Lo que la spec pide y no he encontrado que falte

Nada. Todo lo declarado en §*Ficheros que esta spec modifica* está, y nada fuera de eso
se ha tocado.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-049/. Informe HTML opcional: _qa/SPEC-049/informe.html -->

n-a — no hay UI. La verificación es de un script de línea de comandos: la evidencia son
los códigos de salida y las salidas literales de arriba, reproducibles con los comandos
que las nombran. Playwright no aplica y no se ha usado.

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
