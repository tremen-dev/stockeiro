---
id: SPEC-046
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-046 El panel de edición se abre donde el usuario mira, y la guardia lo mide

## Resumen
- Fase: `borrador` — spec y **ADR-030** escritos por sdd-arquitecto el 2026-08-22 y
  **revisados el mismo día** tras la primera vuelta del gate, en la que el humano pidió
  evaluar la edición inline / fila desplegable. Nada implementado.
- Rama: `ft/SPEC-046-panel-edicion-fuera-de-pantalla`
- Worktree: `D:/src/wt-46`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (primera fila, lista larga) | | | | ❌ |
| CA-2 (tres posiciones, ocho anchos) | | | | ❌ |
| CA-3 (relación fila ↔ panel) | | | | ❌ |
| CA-4 (anclada a la ventana) | | | | ❌ |
| CA-5 (`<dialog>`, foco, Escape, retorno) | | | | ❌ |
| CA-6 (M1/M2/M3 con la capa abierta) | | | | ❌ |
| CA-7 (la capa se mide, no se excluye) | | | | ❌ |
| CA-8 (la caja sigue siendo la del alta) | | | | ❌ |
| CA-9 (M4 en el módulo compartido) | | | | ❌ |
| CA-10 (eficacia: M4 la caza, M1–M3 no) | | | | ❌ |
| CA-11 (precondición de lista larga) | | | | ❌ |
| CA-12 (promesas de SPEC-044 intactas) | | | | ❌ |
| CA-13 (la cadencia se lee donde se pulsó) | | | | ❌ |
| CA-14 (re-encuadre declarado) | | | | ❌ |
| CA-15 (la fila tolera un tercer control) | | | | ❌ |
| CA-16 (cero regresión) | | | | ❌ |
| CA-17 (evidencia medida) | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-046/. Informe HTML opcional: _qa/SPEC-046/informe.html -->

CA-17 exige, como mínimo: `_qa/SPEC-046/` con el **antes** (lista larga, *Editar* en la
primera fila, superficie fuera de la ventana) y el **después**, a **360** y **1280 px**,
con la distancia medida en píxeles entre el pliegue y la superficie, más el fichero de
medidas de M4 para las tres posiciones de fila.

## Salvedades / follow-ups
<!-- IDs F-SPEC-046-1, F-SPEC-046-2… con destino (spec futura o EPIC-MEJORA). -->

Abiertos ya en el ADR que escribe esta spec, para que no se pierdan:

- **F-ADR-030-1** — M4 depende de que nadie desplace nada entre el gesto y la medida; la
  posición se registra **antes** del gesto. Sutileza fácil de perder al copiar. Va comentada
  dentro de `tests/e2e/geometria.ts`.
- **F-ADR-030-2** — ADR-030 decide la colocación de lo que abre **una fila de una lista**.
  No se extiende por analogía a otras superficies (alta plegable, ayuda, formularios de
  página completa).
- **F-ADR-030-3** — la forma **débil** de M4 (proximidad, para superficies en flujo) queda
  definida y **sin implementar**, porque nada la usa. Si una spec futura elige una forma en
  flujo, la aporta al módulo con ese nombre en vez de inventar otra medida.

### Re-encuadre de guardias (CA-14) — a rellenar al implementar

FOUNDATION (2026-08-20) exige que quede escrito **qué vigilaba antes y qué vigila ahora**
cada aserción re-encuadrada de `tests/e2e/vigiladas-editar.spec.ts`. Las tres previstas:

| Aserción | Vigilaba antes | Vigila ahora |
|---|---|---|
| `maxWidth === 'none'` sobre `editar-panel` | | |
| ancho del panel ≈ ancho del formulario | | |
| `panel().toHaveCount(0)` tras guardar | | |

La aserción de que el panel vive **fuera de `.table-scroll`** no se re-encuadra: sigue
siendo cierta y necesaria (CA-4b).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

Hecho: `SPEC-046` (borrador) y `docs/adr/ADR-030-...` (borrador), ya con la segunda vuelta
del gate incorporada. **Resuelto por el humano el 2026-08-22**: CA-13 se confirma dentro de
la ventana; ADR-030 no colisiona. **Evaluado y respondido**: la fila desplegable y la
edición en celda **son posibles** — el mecanismo y los cuatro costes están en ADR-030
§Alternativas (a) y (b), y el resumen legible en el §«¿No se puede editar dentro de la
tabla?» de la spec. **Pendiente**: la firma del humano, sabiendo que (i) puede pedir la
fila desplegable con el coste ya escrito, y (ii) puede pedir el cajón no modal si lo que
quiere es seguir tocando la tabla mientras edita. No hay código ni tests escritos.
