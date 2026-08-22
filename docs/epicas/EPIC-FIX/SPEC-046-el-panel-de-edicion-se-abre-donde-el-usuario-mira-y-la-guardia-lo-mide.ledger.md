---
id: SPEC-046
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-046 El panel de edición se abre donde el usuario mira, y la guardia lo mide

## Resumen
- Fase: `en-revisión` — implementada por sdd-implementador el 2026-08-22 sobre la spec
  firmada por el humano ese mismo día. Los 17 CA tienen código y prueba; falta el gate
  adversarial.
- Rama: `ft/SPEC-046-panel-edicion-fuera-de-pantalla`
- Worktree: `D:/src/wt-46`
- Versión: **0.3.1** (patch; ADR-024 / SPEC-038 CA-12 — la rama toca `src/`).
- Cifras de la ejecución, en pasada limpia y con la máquina para ella sola:
  **unidad 1446/1446** (97 ficheros), **e2e 254/254** (7,3 min, un solo worker),
  `tsc --noEmit` y `eslint . --max-warnings=0` sin una queja.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (primera fila, lista larga) | `src/app/vigiladas/watched-table.tsx` (`<dialog className="editar-vigilada">`), `src/app/globals.css` (`dialog.editar-vigilada`) | `tests/e2e/vigiladas-capa-edicion.spec.ts` › *CA-1/CA-11 … a los ocho anchos* | | 🚧 |
| CA-2 (tres posiciones, ocho anchos) | idem CA-1 | `vigiladas-capa-edicion.spec.ts` › *CA-2: las tres posiciones …* (360 y 1280, con la página arriba y desplazada) + *CA-1/CA-11* para la primera a los ocho anchos | | 🚧 |
| CA-3 (relación fila ↔ panel) | `watched-table.tsx` (`aria-label` con ticker+mercado, `data-editando`), `globals.css` (`tr.fila-editando`) | `vigiladas-capa-edicion.spec.ts` › *CA-3: la capa nombra la fila pulsada …*; escenario dual en `tests/e2e/spec046.ts` (`TICKER_DUAL`, `ZONAS_DUAL`) | | 🚧 |
| CA-4 (anclada a la ventana) | `globals.css` (`position: fixed; inset: auto 0 0 0`) | `vigiladas-capa-edicion.spec.ts` › *CA-4: la caja de la capa no depende del desplazamiento de nada* (tres situaciones, ±1 px) | | 🚧 |
| CA-5 (`<dialog>`, foco, Escape, retorno) | `watched-table.tsx` (`showModal()`, `onCancel`, `cerrar()`, `aria-haspopup="dialog"`) | `vigiladas-capa-edicion.spec.ts` › *CA-5: `<dialog>` modal, foco que entra, fondo inerte y foco que vuelve* | | 🚧 |
| CA-6 (M1/M2/M3 con la capa abierta) | `globals.css` (`overflow-y: auto`, `::backdrop` a 0,45) | `vigiladas-capa-edicion.spec.ts` › *CA-6/CA-7/CA-8 …* (a–e) y › *CA-6(f): el velo atenúa sin ocultar* | | 🚧 |
| CA-7 (la capa se mide, no se excluye) | `tests/e2e/geometria.ts` (`MedidaM1.testigos`) | `tests/spec046-m4-en-el-modulo.test.ts` › *CA-7(a) …* (lista de exclusiones) + `vigiladas-capa-edicion.spec.ts` › *CA-6/CA-7/CA-8* (testigos ≠ ∅) | | 🚧 |
| CA-8 (la caja sigue siendo la del alta) | `globals.css` (capa sin relleno, sin borde y sin fondo) | `vigiladas-capa-edicion.spec.ts` › *CA-6/CA-7/CA-8* (capa ≡ form ±1 px, sin buscador) + `tests/spec044-frontera.test.ts` (re-encuadrado) | | 🚧 |
| CA-9 (M4 en el módulo compartido) | `tests/e2e/geometria.ts` (`medirRespuestaAlGesto`, `medirContencionEnLaVentana`, `medirFondoDeLista`) | `tests/spec046-m4-en-el-modulo.test.ts` (5 casos: existe, motivo, F-ADR-030-1, las dos mitades, nadie escribe la suya) | | 🚧 |
| CA-10 (eficacia: M4 la caza, M1–M3 no) | `geometria.ts` (`defectoSuperficieTrasLaLista`) | `tests/e2e/capa-edicion-eficacia.spec.ts` › *CA-10 …* (los cuatro hechos, a 360 y 1280) | | 🚧 |
| CA-11 (precondición de lista larga) | `geometria.ts` (`medirFondoDeLista`) | `tests/e2e/spec046.ts` (`derivarListaLarga`, `afirmarListaLarga`), afirmada en cada guardia y en cada ancho | | 🚧 |
| CA-12 (promesas de SPEC-044 intactas) | `watched-table.tsx` (sigue montando `WatchForm`; `watch-form.tsx` y `actions.ts` sin tocar) | `vigiladas-capa-edicion.spec.ts` › *CA-12 …* — CA-19 (precarga, zona sin definir **vacía** vía `TICKER_SIN_ZONA_DE_VENTA`, sin buscador), CA-21 (error que no cierra + guardado con estado recalculado) y CA-24 (retrato de la fila antes/después de reordenar y editar) — más `tests/e2e/vigiladas-editar.spec.ts` entero (7 casos) | | 🚧 |
| CA-13 (la cadencia se lee donde se pulsó) | `watched-table.tsx` (`editar-confirmacion` dentro de la capa, `editar-cerrar`) | `vigiladas-capa-edicion.spec.ts` › *CA-13 …* (M4 sobre la confirmación, a 360 y 1280) | | 🚧 |
| CA-14 (re-encuadre declarado) | — (sólo tests) | `vigiladas-editar.spec.ts` (3 aserciones) y `tests/spec044-frontera.test.ts` (2 más); tabla de declaración más abajo | | 🚧 |
| CA-15 (la fila tolera un tercer control) | — (nada de SPEC-045 implementado) | `vigiladas-capa-edicion.spec.ts` › *CA-15: con un tercer control simulado …* (ocho anchos, tabla arrastrada, M3) | | 🚧 |
| CA-16 (cero regresión) | `package.json` 0.3.1 | suite entera: **unidad 1446/1446**, **e2e 254/254** | | 🚧 |
| CA-17 (evidencia medida) | — | `_qa/SPEC-046/`: `antes-{360,1280}.png`, `despues-{360,1280}.png`, `m4-eficacia.txt`, `medidas-m4-primera-fila.txt`, `medidas-m4-tres-posiciones.txt`, `medidas-capa-abierta.txt` | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-046/. Informe HTML opcional: _qa/SPEC-046/informe.html -->

| CA | Evidencia | Qué se ve |
|---|---|---|
| CA-17(a) | `_qa/SPEC-046/antes-360.png`, `antes-1280.png` | El defecto **reproducido**: lista larga, *Editar* pulsado en la primera fila —que se ve marcada— y **nada más en pantalla**. La superficie se pintó **2.584 px** (360) y **1.536 px** (1280) por debajo del pliegue. |
| CA-17(b) | `_qa/SPEC-046/despues-360.png`, `despues-1280.png` | La capa anclada al borde inferior, con el activo nombrado, y la lista legible por encima del velo. |
| CA-17(c) | `_qa/SPEC-046/medidas-m4-primera-fila.txt` | M4 sobre la primera fila a los **ocho anchos**, con la precondición de CA-11 al lado (fondo de la tabla entre 1.122 y 2.170 px por debajo del pliegue). |
| CA-17(c) | `_qa/SPEC-046/medidas-m4-tres-posiciones.txt` | M4 en las **tres posiciones**, a 360 y 1280, con la página arriba y desplazada. |
| CA-10 | `_qa/SPEC-046/m4-eficacia.txt` | Las cuatro medidas sobre la misma página con el defecto puesto. |
| CA-6/7/8 | `_qa/SPEC-046/medidas-capa-abierta.txt` | M1 (violaciones/medidos/testigos), M2, la caja de la capa y el ancho del formulario, a los ocho anchos. |

**La cifra que convierte «se veía mal» en un número** (CA-17a), copiada del fichero de
eficacia:

```
360 px  · en la posición del usuario: top=2988 bottom=3384 sobre una ventana de 800 px
        · 2584 px POR DEBAJO DEL PLIEGUE · M1 0 violaciones de 58 medidos (testigos 1)
        · M2 desborde 0 · M3 0 rótulos partidos
1280 px · en la posición del usuario: top=2040 bottom=2436 sobre una ventana de 900 px
        · 1536 px POR DEBAJO DEL PLIEGUE · M1 0 violaciones de 591 medidos (testigos 1)
        · M2 desborde 0 · M3 0 rótulos partidos
```

Y la del velo (CA-6f), medida sobre el **contraste efectivo** y no sobre la opacidad
declarada: el texto de la tabla pasa de **17,01:1** a **5,57:1** con el velo puesto, con
**dos filas** enteras legibles por encima de la capa. El umbral del test es 4,5:1 (AA para
texto normal); con `rgba(10, 9, 8, 0.55)` daba 4,03:1 y **el test se puso rojo**, así que
el velo se aclaró a 0,45 — no se bajó el umbral.

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

Abiertos al implementar:

- **F-SPEC-046-1** — **la capa superior del navegador no tiene flujo**, y eso limita lo que
  una reinyección de CSS puede reproducir. Medido en Chromium: sobre un `<dialog>` abierto
  con `showModal()`, tanto `position: static` como `position: absolute` con los cuatro
  desplazamientos en `auto` dejan la caja **arriba del todo** (`top = 18`), no en su
  posición de flujo. Por eso `defectoSuperficieTrasLaLista` recibe la coordenada **medida**
  del fondo de la lista. Quien tenga que reinyectar un defecto de colocación sobre otra
  capa modal se va a encontrar lo mismo: está escrito en el jsdoc de esa función.
- **F-SPEC-046-2** — a **360 px** la capa ocupa **396 px de 800**, así que quedan dos filas
  legibles por encima. Cumple CA-6(f) —la lista se sigue leyendo— pero con poco margen: si
  el formulario de zonas creciera, el contexto devuelto se acercaría a cero sin que ninguna
  aserción se ponga roja (el test exige «más de una fila», no un número de filas). Si eso
  molesta en el uso real, el camino de vuelta está en ADR-030 §Alternativas (c): el cajón
  no modal, rechazado **por poco**.
- **F-SPEC-046-3** — la suite de unidad **caduca por tiempo cuando la máquina está
  cargada**, y siempre en el mismo sitio: los `beforeAll` que levantan `pglite`, contra el
  `hookTimeout` de 20 s por defecto. Observado en dos pasadas de esta sesión, con
  **ficheros distintos cada vez** (`account-deletion`, y luego `symbol-identity`,
  `triggers-cycle`, `zone-status`) — la firma de un límite de tiempo, no la de un defecto.
  En pasada limpia: **1446/1446**. No toca nada de SPEC-046, pero es ruido que un día de
  cola pinta rojo en CI a specs ajenas. Queda anotado para quien decida si `vitest.config.ts`
  debe declarar su `hookTimeout`.

### Re-encuadre de guardias (CA-14) — declarado

FOUNDATION (2026-08-20) exige que quede escrito **qué vigilaba antes y qué vigila ahora**
cada aserción re-encuadrada. **Ninguna se aflojó hasta que pasara**: en los cinco casos la
propiedad que sostenía la aserción vieja sigue exigida, y en tres de ellos con más
comprobaciones que antes. El porqué está además escrito **junto a cada aserción**, en el
fichero, para que no haya que venir aquí a entenderlo.

Las **tres previstas**, en `tests/e2e/vigiladas-editar.spec.ts`:

| Aserción | Vigilaba antes | Vigila ahora |
|---|---|---|
| `maxWidth === 'none'` sobre `editar-panel` | «El panel no declara caja propia: la fija `.auth-form` (SPEC-040)». Se expresaba como la **ausencia** de un `max-width`, forma posible sólo mientras la superficie va en flujo y hereda el ancho de la columna. | «**La caja visible sigue siendo la del formulario**»: la capa declara `padding: 0`, `border: 0` y fondo transparente —lo que se ve es la misma tarjeta del alta— y su ancho **nunca supera la ventana**. Misma propiedad (SPEC-044 CA-20, SPEC-046 CA-8), medida por lo que de verdad la sostiene. |
| ancho del panel ≈ ancho del formulario | «El panel es transparente al ancho: el que manda es `.auth-form`». | Lo mismo, y **la comparación numérica no se toca**. Cambia su motivo: antes probaba que el panel no imponía ancho al ir en flujo; ahora prueba que la capa no añade caja alrededor del formulario aunque su anchura la fije ella. Se le **añade** el techo que antes daba el flujo: nunca más ancha que la ventana. |
| `panel().toHaveCount(0)` tras guardar | «Guardar cierra la superficie y no deja un formulario editable colgando». Se expresaba como la desaparición del panel porque, con la confirmación al final del documento, cerrar era lo único que ocurría. | Lo mismo, **en sus dos mitades**: el **formulario** sí desaparece al guardar (`formEdicion` a 0, y la confirmación visible), y la **superficie** deja de estar a la vista **cuando el usuario la cierra** (CA-13, decidido en el gate del 2026-08-22). Dejarlo en «sigue abierta» habría sido aflojarlo; se exigen las dos cosas. |

Y **dos más que la spec no había previsto**, en `tests/spec044-frontera.test.ts`. Se
declaran aquí con la misma disciplina porque son guardias de una spec en `hecho` y
codificaban lo mismo —la colocación vieja— desde el lado del código fuente:

| Aserción | Vigilaba antes | Vigila ahora |
|---|---|---|
| el bloque CSS de `.editar-vigilada` no contiene ningún `width:` | «La superficie no declara ancho propio; la CAJA es territorio de SPEC-040 y este panel sólo decide **cuándo** está en pantalla». | «**No pinta caja propia y no puede declarar un ancho que no quepa**»: se exigen `padding: 0`, `border: 0`, `background: transparent` **y** `max-width: 100%`. Una capa anclada al viewport **tiene** que declarar su anchura —no hay columna de la que heredarla—, así que la ausencia de `width` dejó de ser alcanzable; lo que la sostenía se exige entero. Tres comprobaciones débiles → cuatro fuertes. |
| `setEditandoId(… r.id …)` en el manejador del control | «Lo que se guarda al pulsar es el **id** de la fila, nunca su posición» (CA-24, ADR-007). | Exactamente lo mismo. El manejador ya no escribe el estado a mano: llama a `abrir(r.id, …)`, que además recuerda el disparador para devolverle el foco (CA-5). La aserción sigue el id hasta donde está (`abrir(r.id` y `setEditandoId(id)`) y **conserva las dos negativas** —ni se mapea con índice, ni se guarda un índice—, que son la mitad que de verdad protege. |

Y un **ajuste mecánico**, que no es re-encuadre de ninguna aserción y se declara para que
nadie lo confunda con uno: cerrar la superficie ya no es volver a pulsar *Editar*. Con la
capa modal **el fondo queda inerte** (ADR-030 §2), así que ese gesto no existe para un
usuario; los dos sitios donde el test lo usaba como «cerrar» pasan por el control de
*Cancelar* (`cerrarEdicion`). No se afirma nada distinto: se hace el gesto que la pantalla
ofrece.

La aserción de que el panel vive **fuera de `.table-scroll`** no se re-encuadra: sigue
siendo cierta y necesaria (CA-4b), y se comprueba además en `CA-4(b)` de la guardia nueva.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Hecho** (rama `ft/SPEC-046-panel-edicion-fuera-de-pantalla`, worktree `D:/src/wt-46`):

- **La capa**: `src/app/vigiladas/watched-table.tsx` monta un `<dialog>` nativo abierto con
  `showModal()`, anclado al borde inferior por `dialog.editar-vigilada` en
  `src/app/globals.css`. `watch-form.tsx` y `actions.ts` **no se han tocado**.
- **La medida**: **M4** (`medirRespuestaAlGesto`) vive en `tests/e2e/geometria.ts`, junto a
  `medirContencionEnLaVentana` —su mitad sin gesto—, `medirFondoDeLista` —la precondición
  de ADR-030 §4— y `MedidaM1.testigos` —de qué elementos se tomó medida (CA-7b)—.
- **Las guardias**: `tests/e2e/vigiladas-capa-edicion.spec.ts` (10 casos),
  `tests/e2e/capa-edicion-eficacia.spec.ts` (CA-10) y `tests/spec046-m4-en-el-modulo.test.ts`
  (5 casos unitarios y binarios). El escenario compartido, en `tests/e2e/spec046.ts`.
- **Ejecución**: unidad **1446/1446**, e2e **254/254**, `tsc` y `eslint` limpios. Versión
  **0.3.1**.

**Para verificar, tres sitios donde mirar con lupa** (son donde más fácil sería hacer
trampa, y por eso se señalan):

1. **CA-14**, la tabla de re-encuadre de arriba. Son **cinco** aserciones, no tres: dos de
   ellas viven en `tests/spec044-frontera.test.ts` y la spec no las había previsto.
2. **CA-10**. La reinyección **no** pudo hacerse devolviendo la capa al flujo con
   `position: static` ni con `absolute` + `inset: auto`: medido en Chromium, un `<dialog>`
   modal vive en la **capa superior**, que no tiene flujo, y las dos formas dejan la caja
   arriba del todo. Se reinyecta con la coordenada **medida** de dónde acaba la tabla
   (`fondoEnElDocumento`), que se deriva y no se escribe. Está razonado en el jsdoc de
   `defectoSuperficieTrasLaLista`.
3. **El segundo hallazgo de CA-10**, que conviene no perder: con la superficie detrás de la
   lista, `showModal()` enfoca el primer campo y **el navegador arrastra al usuario hasta
   allí** (0 → 2.584 px a 360). O sea que el defecto reinyectado dispara **primero** la
   mitad «no desplazarás el documento» de M4 — que es literalmente la alternativa
   `scrollIntoView` que ADR-030 §3(c) rechazó. Por eso el test devuelve la página a donde
   estaba antes de enseñar la cifra: sin ese paso, el propio navegador la habría tapado.

**Pendiente**: el gate adversarial de sdd-verificador. Nada más: los 17 CA tienen código y
prueba.
