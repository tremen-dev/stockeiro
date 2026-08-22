---
id: SPEC-046
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-046 El panel de edición se abre donde el usuario mira, y la guardia lo mide

## Resumen
- Fase: `borrador` — spec y **ADR-030** escritos por sdd-arquitecto el 2026-08-22, a la
  espera del gate humano. Nada implementado.
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

Hecho: `SPEC-046` (borrador) y `docs/adr/ADR-030-...` (borrador). Pendiente: el gate humano
sobre las notas 1 (modal vs. cajón inferior), 3 (confirmación de cadencia) y 6 (posible
colisión de numeración de ADR con las ramas paralelas). No hay código ni tests escritos.
