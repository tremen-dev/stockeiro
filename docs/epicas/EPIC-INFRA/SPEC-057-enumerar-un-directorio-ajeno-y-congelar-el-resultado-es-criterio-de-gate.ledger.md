---
id: SPEC-057
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-057 Enumerar un directorio ajeno y congelar el resultado es criterio de gate

## Resumen
- Fase: **borrador** — spec y `ADR-037` escritos por el arquitecto el 2026-08-25,
  pendientes del gate humano. **Nada implementado.**
- Rama: `ft/SPEC-057-enumerar-un-directorio-ajeno-y-congelar-el-resultado-es-criterio-de-gate`
  (creada desde `origin/main` = `778f189`).
- **Saldo comprometido: −2 comprobaciones / +0.** Es condición de aceptación
  (CA-4), no una aspiración. Si al implementar el saldo deja de ser negativo, se
  escala al gate antes de seguir.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (la retirada, con las cuatro condiciones) | `tests/tarjeta-guardias-ampliadas.test.ts` (se retira el bloque `SPEC-051 CA-17.1`, líneas 111-139, sus **dos** casos) | **n-a a propósito** — lo que sustituye al bloque es **prosa en el sitio** (cond. 2). Un test en su lugar sería el verde vacío que ADR-031 prohíbe; molde `F-SPEC-042-9` y SPEC-053 CA-13 | Se **lee el fichero** en el gate y se contrastan las cuatro condiciones una a una | ❌ |
| CA-2 (recuento y suite verde) | — | `npx vitest run` sobre el árbol commiteado y limpio | Recuentos **antes (12)** y **después (10)** del fichero, y que **ningún otro fichero de `tests/` cambie su número de casos**. Los dos recuentos se pegan abajo | ❌ |
| CA-3 (la regla escrita, con su fuente) | `FOUNDATION.md` (3.er corolario), `docs/fundacion/reglas.md` (`RI-03` + fuente ADR-037), `docs/adr/ADR-037-*.md` | **n-a a propósito** — no se añade un test que compruebe que un documento contiene una frase: sería una casilla, y esta spec no añade comprobaciones (CA-4) | Se **leen los dos documentos** en el gate contra los tres puntos de CA-3 | ❌ |
| CA-4 (el saldo, −2 / +0) | — | — | Recuento de casos retirados y añadidos contra `778f189`, y comprobación de que no hay script de gate nuevo en `scripts/` ni step nuevo en `.github/workflows/ci.yml`. **Saldo no negativo = RED** | ❌ |
| CA-5 (acotación) | **n-a** | **n-a — por ADR-031 pto. 1.2 / `RI-03`, con el porqué escrito debajo; no es una omisión** | Diff de la rama con el árbol limpio, revisado a mano; salida pegada en §Acotación | ❌ |

> **CA-5 no lleva fila de test a propósito, y su `n-a` no está en blanco por
> descuido.** *«Este cambio está bien acotado»* es cierto sobre un **delta** y su
> sitio es el gate. Codificarlo como test —barriendo `tests/` y congelando qué
> ficheros nombran a `SPEC-057`— sería **literalmente el defecto que esta spec
> persigue**, escrito por la spec que lo persigue. Lo mismo vale, por otra razón,
> para el `n-a` de CA-1 (lo que sustituye al caso retirado es prosa) y el de CA-3
> (un `toContain` sobre un documento es una casilla).

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-057/. Informe HTML opcional: _qa/SPEC-057/informe.html -->

**n-a.** Esta spec no toca `src/` ni ninguna superficie de interfaz. No hay nada
que capturar.

## Acotación (CA-5) — el diff de la rama, con el árbol limpio
<!-- Lo pega sdd-verificador. Conjunto permitido, para contrastar uno a uno: -->

Conjunto **permitido** por CA-5 (cualquier fichero fuera de esta lista es RED):

- `tests/tarjeta-guardias-ampliadas.test.ts`
- `docs/adr/ADR-037-enumerar-un-directorio-que-otros-hacen-crecer-y-congelar-el-resultado-es-criterio-de-gate-la-regla-se-escribe-y-no-se-mecaniza-precisa-adr-031-pto-1.md`
- `docs/fundacion/reglas.md`
- `FOUNDATION.md`
- `docs/epicas/EPIC-INFRA/SPEC-057-*.md` y `SPEC-057-*.ledger.md`
- `docs/tablero.md` (generado por `/sdd-tablero`, nunca a mano)

Y **prohibido explícitamente**: cualquier fichero bajo `src/`, `app/`, `drizzle/`
o `scripts/`; **cualquier otro fichero de `tests/`**; y en particular los tres que
la spec dictamina sanos —`tests/revision-movil-en-tests.test.ts`,
`tests/version-bump-gate.test.ts`, `tests/primera-pantalla-fuente.test.ts`— y
`tests/spec-032-frontera.test.ts`, que queda declarado como caso fronterizo y **no
se toca**.

## Recuentos (CA-2 y CA-4)
<!-- Los pega sdd-implementador (antes/después) y los confirma sdd-verificador. -->

| | Antes (`778f189`) | Después | Δ |
|---|---|---|---|
| `tests/tarjeta-guardias-ampliadas.test.ts` | **12** casos | *(pendiente)* | esperado **−2** |
| Resto de `tests/**` | *(pendiente)* | *(pendiente)* | esperado **0** |
| Comprobaciones **añadidas** | — | *(pendiente)* | esperado **0** |

El **12** de partida está confirmado por el ledger de SPEC-051 (*«Verde (los doce
casos), 17.1 · 17.2 · 17.3 con mutación de control · 17.4»*, GREEN 2026-08-23) y
por el conteo del fichero: 2 (17.1) + 2 (17.2, bucle sobre `GUARDIAS`) + 4 (17.3,
dos bucles) + 4 (17.4) = 12.

## Salvedades / follow-ups
<!-- IDs F-SPEC-057-1, F-SPEC-057-2… con destino (spec futura o EPIC-MEJORA). -->

Levantadas por el **arquitecto al especificar**, antes de implementar:

- **`F-SPEC-057-1` (decisión del humano, bloqueante del gate) — esta spec pisa la
  rama parada de SPEC-052.** `SPEC-052 CA-18` re-encuadra la misma aserción que
  CA-1 retira, está implementada y empujada en
  `ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde` (`130acd1`) y **sin
  PR**. Si se aprueba SPEC-057, **CA-18 (a)-(f) se queda sin objeto**. No se
  resuelve aquí: **es del humano**. Ver §Notas pto. 2 de la spec, con la tabla de
  coste (retirar: un bloque y un comentario; re-encuadrar: **+185 / +212 líneas**,
  **397** en total). Esta spec **no toca** esa rama, ni su ledger, ni `docs/despliegue.md`.
- **`F-SPEC-057-2` (aviso escrito, sin destino) — `tests/spec-032-frontera.test.ts:162-164`
  queda como caso fronterizo declarado.** `readdirSync(drizzle/)` filtrado a
  `.json` y congelado contra `['destructive-waivers.json']` **encaja en la firma**
  de ADR-037 pto. 3. No se toca porque en ese directorio escribe `drizzle-kit`, no
  otra spec: la mano que podría ponerlo rojo no es la de un tercero, y SPEC-032
  está en `hecho` sin defecto. Si algún día `drizzle/` gana un `.json` por otra
  vía, esa guardia se pondrá roja y **este hallazgo es su aviso escrito**.
- **`F-SPEC-057-3` (apuesta declarada, sin destino) — la regla no lleva
  mecanismo.** ADR-031 registró que una convención en prosa *«aguantó dos días»*.
  Ésta se apuesta contra una población **cero** y con el disparador en
  `FOUNDATION.md`, pero es una apuesta. **Si aparece una tercera instancia de la
  forma, la apuesta se ha perdido** y toca mecanismo, con el listón de ADR-037
  pto. 4: traer un discriminante que separe los tres inocentes que el ADR nombra
  por línea. Registrado aquí para que el tercer incidente encuentre el aviso.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Hecho (arquitecto, 2026-08-25):**

1. Dictamen de los **cinco** ficheros del encargo, en §Problema de la spec. **Uno**
   defectuoso (`tests/tarjeta-guardias-ampliadas.test.ts` CA-17.1), **uno fuera de
   alcance** (`tests/entornos-de-despliegue.test.ts`, que **no existe en
   `origin/main`**: lo crean `fc14150`/`130acd1` en la rama parada de SPEC-052) y **tres
   sanos**, con el porqué de cada uno.
2. **`docs/adr/ADR-037-*.md`** en `borrador`: la regla, la pregunta que la
   reconoce, la medición del falso positivo con los **tres inocentes por línea**, y
   la decisión de **no** escribir meta-guardia con su motivo, para que no se vuelva
   a proponer.
3. La spec con **cinco CA**: la retirada (CA-1), el recuento (CA-2), la regla
   escrita (CA-3), el **saldo −2 / +0** como condición (CA-4) y la acotación como
   **`n-a` declarado** (CA-5).

**Falta — y en este orden:**

1. **El gate humano.** Hay **cuatro** decisiones esperándole, listadas en §Notas
   pto. 6 de la spec. La primera (`F-SPEC-057-1`, qué pasa con SPEC-052) condiciona
   si CA-1 y CA-2 sobreviven.
2. **Implementar** (solo con la spec aprobada): retirar el bloque 111-139 con su
   prosa en el sitio, **corregir la cabecera del fichero** (hoy dice *«nadie más ha
   sido re-encuadrado por esta spec»*, que después de la retirada es falso), limpiar
   los símbolos que quedan sin uso —`readdirSync`, `statSync`, `relative`,
   `testsDir`, `rel`, `NO_SE_TOCA`, `PROPIOS`, `fuentesDeTests`— **porque
   `eslint --max-warnings=0` lo exige y no porque se decida nada sobre ellos**, y
   escribir el 3.er corolario de `FOUNDATION.md` y el párrafo de `RI-03`.
3. **Verificar**: los recuentos de arriba, el diff contra el conjunto permitido de
   §Acotación, y la lectura de los dos documentos contra los tres puntos de CA-3.

**Trampas conocidas, para no repetirlas:**

- **`FOUNDATION.md` lo escribe el arquitecto en el gate** (ADR-025), no la
  implementación. Si al implementar falta una frase, se levanta residual y no se
  escribe en el documento de verdad.
- **`version:check` juzga lo commiteado.** Esta spec **no toca `src/` ni `app/`**,
  así que no debe exigir bump; si lo exige, el alcance se ha desviado. Y en
  cualquier caso el gate se ejecuta **después de commitear**, nunca con el árbol
  sucio: con el árbol sucio da un verde vacío.
- **No añadir ni una comprobación.** Ni test, ni script en `scripts/`, ni step en
  CI, ni un `toContain` sobre un documento. CA-4 lo hace RED.
