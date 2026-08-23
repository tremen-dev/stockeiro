---
id: SPEC-046
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-046 El panel de edición se abre donde el usuario mira, y la guardia lo mide

## Resumen
- Fase: `hecho` — implementada por sdd-implementador el 2026-08-22 y **verificada en GREEN
  por sdd-verificador** ese mismo día (16 CA ✅ · CA-6 ⚠️ con salvedad aceptada y su
  residual `F-SPEC-046-4` abierto).
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
| CA-1 (primera fila, lista larga) | `src/app/vigiladas/watched-table.tsx` (`<dialog className="editar-vigilada">`), `src/app/globals.css` (`dialog.editar-vigilada`) | `tests/e2e/vigiladas-capa-edicion.spec.ts` › *CA-1/CA-11 … a los ocho anchos* | Reproducido por el verificador con su propio instrumento a los **ocho anchos**: capa `top=404 bottom=800` (360) … `top=504 bottom=900` (1280), `scrollY 0 → 0`, título/4 campos/botón visibles. Precondición afirmada antes de pulsar (1122–2170 px de tabla bajo el pliegue, 26 filas derivadas). | ✅ |
| CA-2 (tres posiciones, ocho anchos) | idem CA-1 | `vigiladas-capa-edicion.spec.ts` › *CA-2: las tres posiciones …* (360 y 1280, con la página arriba y desplazada) + *CA-1/CA-11* para la primera a los ocho anchos | `medidas-m4-tres-posiciones.txt` regenerado **byte a byte idéntico** en mi pasada: primera/intermedia/última a 360 y 1280, con la página arriba y desplazada — 10 medidas, todas dentro de la ventana y con `scrollAntes == scrollDespués`. | ✅ |
| CA-3 (relación fila ↔ panel) | `watched-table.tsx` (`aria-label` con ticker+mercado, `data-editando`), `globals.css` (`tr.fila-editando`) | `vigiladas-capa-edicion.spec.ts` › *CA-3: la capa nombra la fila pulsada …*; escenario dual en `tests/e2e/spec046.ts` (`TICKER_DUAL`, `ZONAS_DUAL`) | Verificado en pantalla: con `Z6DUAL` en **dos mercados**, la capa abre BME con `11/13/31/33` y NYSE con `61/63/81/83`; `aria-label` = «Editar zonas de Z6DUAL · NYSE»; exactamente **una** `tr[data-editando="true"]` mientras está abierta y **cero** al cerrar; el realce es `outline` (no ocupa caja) y se ve detrás del velo — `verif-contexto-360.png`. | ✅ |
| CA-4 (anclada a la ventana) | `globals.css` (`position: fixed; inset: auto 0 0 0`) | `vigiladas-capa-edicion.spec.ts` › *CA-4: la caja de la capa no depende del desplazamiento de nada* (tres situaciones, ±1 px) | Medido por mí a los ocho anchos: `position: fixed`, `closest('.table-scroll') === null`, `bottom == innerHeight` (800/800, 844/844, 900/900). La guardia compara además las tres situaciones (arriba, fondo, tabla arrastrada) con ±1 px. | ✅ |
| CA-5 (`<dialog>`, foco, Escape, retorno) | `watched-table.tsx` (`showModal()`, `onCancel`, `cerrar()`, `aria-haspopup="dialog"`) | `vigiladas-capa-edicion.spec.ts` › *CA-5: `<dialog>` modal, foco que entra, fondo inerte y foco que vuelve* | Probado con **teclado y ratón** por el verificador: abre con Enter, `:modal` = true, foco en `buyMin`; **20 tabulaciones** recorren sólo los 6 controles de la capa y el único punto fuera es `BODY` (la vuelta del ciclo de Chromium) — nunca un control del fondo; `.focus()` sobre `orden-criterio` no prende y un clic sobre `orden-direccion` no lo activa; Escape, Cancelar y «Entendido» devuelven el foco al *Editar* de su fila. `aria-haspopup="dialog"` y `aria-expanded` ausente. Traza en `_qa/SPEC-046/verif-gate-adversarial.txt`. | ✅ |
| CA-6 (M1/M2/M3 con la capa abierta) | `globals.css` (`overflow-y: auto`, `::backdrop` a 0,45) | `vigiladas-capa-edicion.spec.ts` › *CA-6/CA-7/CA-8 …* (a–e) y › *CA-6(f): el velo atenúa sin ocultar* | (a)–(e) verificados por mí a los **ocho anchos**: M1 0 violaciones (58 medidos a 360–800, 591 a 1280), M2 desborde 0, la capa no se desplaza a lo ancho (`scrollWidth == clientWidth`), `overflow-y: auto` declarado, M3 sin rótulos partidos. **(f) con salvedad**: el velo atenúa —contraste efectivo del texto de la tabla **17,01:1 → 5,54:1** con mi propio cálculo WCAG (la guardia mide 5,57:1), muy por encima de 4,5:1— pero **la guardia de (f) sólo corre a 1280 px**, cuando CA-6 pide los ocho, y a 360/390 con la página arriba su precondición interna no se cumple. Medido entero en `verif-contexto-devuelto.txt`. Ver F-SPEC-046-4. | ⚠️ |
| CA-7 (la capa se mide, no se excluye) | `tests/e2e/geometria.ts` (`MedidaM1.testigos`) | `tests/spec046-m4-en-el-modulo.test.ts` › *CA-7(a) …* (lista de exclusiones) + `vigiladas-capa-edicion.spec.ts` › *CA-6/CA-7/CA-8* (testigos ≠ ∅) | (a) `EXCLUSIONES_M1` contiene **sólo** `.symbol-results` — leído. (b) `testigos = 1` para `dialog[data-testid="editar-panel"]` en los ocho anchos **y también con el defecto reinyectado**, o sea que el «0 violaciones» sí habla de la capa. | ✅ |
| CA-8 (la caja sigue siendo la del alta) | `globals.css` (capa sin relleno, sin borde y sin fondo) | `vigiladas-capa-edicion.spec.ts` › *CA-6/CA-7/CA-8* (capa ≡ form ±1 px, sin buscador) + `tests/spec044-frontera.test.ts` (re-encuadrado) | Capa ≡ formulario ±1 px en los ocho anchos (360/390 a ancho completo; 520 de 640 arriba); `.auth-form` sin buscador; capa con `padding: 0`, `border: 0`, fondo transparente y `max-width: 100%`. A 360 los cuatro campos entran en M1 sin violación. | ✅ |
| CA-9 (M4 en el módulo compartido) | `tests/e2e/geometria.ts` (`medirRespuestaAlGesto`, `medirContencionEnLaVentana`, `medirFondoDeLista`) | `tests/spec046-m4-en-el-modulo.test.ts` (5 casos: existe, motivo, F-ADR-030-1, las dos mitades, nadie escribe la suya) | Leído: M4, su mitad sin gesto, la precondición de lista y los testigos viven en `tests/e2e/geometria.ts`, con motivo escrito y `F-ADR-030-1` comentado. La guardia binaria prohíbe que cualquier fichero de `tests/e2e` calcule el pliegue por su cuenta (`innerHeight`/`clientHeight`) y pasa. | ✅ |
| CA-10 (eficacia: M4 la caza, M1–M3 no) | `geometria.ts` (`defectoSuperficieTrasLaLista`) | `tests/e2e/capa-edicion-eficacia.spec.ts` › *CA-10 …* (los cuatro hechos, a 360 y 1280) | **Reinyectado por el verificador con CSS propio**, no con el del proyecto: M4 viola en 360 y 1280, el documento se mueve 0→2584 y 0→1536, y puesta la página donde estaba el usuario la capa queda **2584 px** y **1536 px** por debajo del pliegue; M1 (0/58 y 0/591, testigos 1), M2 (0) y M3 (0) **no ven nada**; retirado el defecto, M4 calla. Sin números mágicos: la coordenada sale de `medirFondoDeLista().fondoEnElDocumento`. | ✅ |
| CA-11 (precondición de lista larga) | `geometria.ts` (`medirFondoDeLista`) | `tests/e2e/spec046.ts` (`derivarListaLarga`, `afirmarListaLarga`), afirmada en cada guardia y en cada ancho | `derivarListaLarga` tantea 24→48→96→192 hasta que el fondo de la tabla cae bajo el pliegue a 1280 px, y `afirmarListaLarga` se vuelve a afirmar **en cada guardia y en cada ancho**. Ningún recuento de filas escrito como verdad; el mensaje de fallo dice que se re-encuadre el escenario, nunca la medida. | ✅ |
| CA-12 (promesas de SPEC-044 intactas) | `watched-table.tsx` (sigue montando `WatchForm`; `watch-form.tsx` y `actions.ts` sin tocar) | `vigiladas-capa-edicion.spec.ts` › *CA-12 …* — CA-19 (precarga, zona sin definir **vacía** vía `TICKER_SIN_ZONA_DE_VENTA`, sin buscador), CA-21 (error que no cierra + guardado con estado recalculado) y CA-24 (retrato de la fila antes/después de reordenar y editar) — más `tests/e2e/vigiladas-editar.spec.ts` entero (7 casos) | CA-19/21/24 verificados en verde (nueva guardia + `vigiladas-editar.spec.ts` entero, 8 casos). Y **CA-1..18 no se rozan**: auditado el diff completo contra `origin/main` — `spec044-accion-edicion.test.ts`, `spec044-continuidad-episodio.test.ts` y `spec044-edicion-zonas.test.ts`, donde viven esos 18 CA, **no aparecen en el diff**. `watch-form.tsx` y `actions.ts` tampoco. | ✅ |
| CA-13 (la cadencia se lee donde se pulsó) | `watched-table.tsx` (`editar-confirmacion` dentro de la capa, `editar-cerrar`) | `vigiladas-capa-edicion.spec.ts` › *CA-13 …* (M4 sobre la confirmación, a 360 y 1280) | M4 sobre la confirmación a 360 y 1280, dentro de la ventana y sin mover el documento; `CADENCIA_LINEA` es la misma constante; la frase está `closest('[data-testid="editar-panel"]') !== null`; la capa no se cierra sola y al cerrarla el foco vuelve a su fila. Ya no queda ningún `editar-cadencia` fuera de la capa. | ✅ |
| CA-14 (re-encuadre declarado) | — (sólo tests) | `vigiladas-editar.spec.ts` (3 aserciones) y `tests/spec044-frontera.test.ts` (2 más); tabla de declaración más abajo | Auditadas **una a una las cinco**, y auditado el diff entero de `tests/` contra `origin/main`: hay exactamente **5 líneas de aserción eliminadas** y **11 añadidas** — **no hay una sexta sin declarar**. Las cinco están re-encuadradas o son equivalentes; **ninguna aflojada**. Comprobado además que las viejas ya no son satisfacibles: `setEditandoId(…r.id)` no casa tras mover el manejador a `abrir(r.id, …)` (CA-5), y el regex de CSS casa con `max-width: 100%`. Matiz que corrijo del ledger: la vieja del CSS habría seguido pasando con `width: min(520px, 100%)` a secas — dejó de ser satisfacible **porque el implementador añadió el tope explícito**, no por la forma anclada en sí; el cambio sigue siendo un fortalecimiento (1 negativa débil → 4 exigencias). Arbitraje completo en el veredicto. | ✅ |
| CA-15 (la fila tolera un tercer control) | — (nada de SPEC-045 implementado) | `vigiladas-capa-edicion.spec.ts` › *CA-15: con un tercer control simulado …* (ocho anchos, tabla arrastrada, M3) | Verde a los ocho anchos con la tabla arrastrada a tope: los **tres** controles presentes y dentro de la ventana, M3 sin partir palabras. Comprobado que **no se ha implementado nada de SPEC-045**: `grep -rn 'ilenciar' src/ drizzle/` no devuelve nada; el tercer control lo inyecta el test. | ✅ |
| CA-16 (cero regresión) | `package.json` 0.3.1 | suite entera: **unidad 1446/1446**, **e2e 254/254** | Pasada propia y limpia: **unidad 1446/1446** (97 ficheros, 165,9 s), **e2e 254/254** (3,9 min), `tsc --noEmit` y `eslint . --max-warnings=0` sin una queja, `check-version-bump` 0.3.0 → 0.3.1. Ninguna caducidad de `pglite` en mi pasada. Los nueve ficheros que CA-16 nombra, todos verdes. | ✅ |
| CA-17 (evidencia medida) | — | `_qa/SPEC-046/`: `antes-{360,1280}.png`, `despues-{360,1280}.png`, `m4-eficacia.txt`, `medidas-m4-primera-fila.txt`, `medidas-m4-tres-posiciones.txt`, `medidas-capa-abierta.txt` | `_qa/SPEC-046/` completo. Los cuatro `.txt` del implementador se **regeneraron byte a byte idénticos** en mi pasada, o sea que las cifras son reproducibles y no un adorno. Añado `verif-gate-adversarial.txt`, `verif-contexto-devuelto.txt` y `verif-contexto-{360,390,1280}.png`. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### 🟢 GREEN — 2026-08-22, sdd-verificador

**16 CA ✅ y 1 ⚠️ (CA-6, por su apartado (f)), aceptada y con su residual abierto.** El
defecto que originó la spec está **muerto por construcción**, no por parche: la caja de la
superficie se define respecto al viewport, así que «lista larga», «fila de arriba» y
«página desplazada» dejaron de ser variables. Y —lo que de verdad compra esta spec— **la
medida que faltaba existe, vive en el módulo compartido y se ha demostrado eficaz con el
defecto reinyectado por el verificador, no por la guardia**.

**Puertas automáticas, pasada propia y limpia:** unidad **1446/1446** (97 ficheros,
165,9 s), e2e **254/254** (3,9 min, un solo worker), `tsc --noEmit` y
`eslint . --max-warnings=0` sin una queja, `check-version-bump` 0.3.0 → 0.3.1.
**Cero caducidades de `pglite`** en mi pasada: `F-SPEC-046-3` no se reprodujo, así que no
hay nada que imputarle a esta rama.

**Los cuatro `.txt` de `_qa/SPEC-046/` se regeneraron byte a byte idénticos** al ejecutar yo
la suite. Las cifras del ledger no son un relato: son reproducibles.

#### CA-10 — reinyectado por el verificador, con CSS propio

No acepté la reinyección del proyecto: escribí la mía y derivé la coordenada por mi cuenta
(`medirFondoDeLista().fondoEnElDocumento`). Resultado, en 360 y 1280:

- **M4 se pone roja con la cifra**: el gesto mueve el documento `0 → 2584` (360) y
  `0 → 1536` (1280) —la mitad «no desplazarás al usuario»—, y puesta la página donde el
  usuario la tenía, la capa queda **2584 px** y **1536 px por debajo del pliegue**.
- **M1, M2 y M3 no ven absolutamente nada**: 0 violaciones de 58 y de 591 medidos, con
  `testigos = 1` —o sea que M1 **sí midió la capa** y aun así la aprobó—, desborde de
  documento 0 y ningún rótulo partido.
- **Retirado el defecto, M4 vuelve a callar**, y sin defecto nunca se quejó.

Confirmo el hallazgo de `F-SPEC-046-1`: **la capa superior no tiene flujo**, así que la
posición estática no se recupera con `position: static` ni con `absolute` + `inset: auto`.
Derivar la coordenada del fondo de la tabla es la salida correcta, y **no es un número
mágico**: se mide en cada ejecución. Igual que el escenario, que se **deriva**
(24→48→96→192) hasta cumplir la precondición y se **vuelve a afirmar en cada guardia y en
cada ancho**.

#### CA-14 — arbitraje: la spec autorizaba tres, se tocaron cinco

**Cumple, y con margen.** Mi arbitraje, con lo que medí:

1. **No hay una sexta.** Audité el diff completo de `tests/` contra `origin/main`: sólo dos
   ficheros preexistentes cambian, y en todo el diff hay **exactamente 5 líneas de aserción
   eliminadas** y **11 añadidas**. Las cinco eliminadas son las cinco declaradas (una de
   ellas, el `toHaveCount(0)` del cierre de CA-23, ni siquiera se pierde: se muda literal al
   ayudante `cerrarEdicion`). La sexta declarada —el ancho panel ≈ formulario— **no se
   tocó**, tal y como dice el ledger.
2. **Ninguna se aflojó; las viejas eran ya insatisfacibles y las nuevas piden más.** Lo
   comprobé ejecutando las viejas contra el código nuevo: `setEditandoId(…r.id)` deja de
   casar al mover el manejador a `abrir(r.id, …)` —refactor que **exige CA-5** para devolver
   el foco—, y el regex de CSS casa ahora con `max-width: 100%`, de modo que la aserción
   negativa se rompe. Las dos imprevistas cambian una comprobación negativa por cuatro
   exigencias positivas sobre la propiedad que de verdad importaba, y **conservan las dos
   negativas** que protegían del índice.
3. **Un matiz que corrijo del ledger.** La afirmación de que «la ausencia de `width` dejó de
   ser alcanzable» es más fuerte de lo que el regex viejo pedía: con `width: min(520px, 100%)`
   a secas la aserción vieja **habría seguido pasando**, porque sólo prohibía un ancho que
   empezara por dígito. Lo que la rompió fue **añadir el tope explícito `max-width: 100%`**,
   es decir, apretar. La dirección del cambio es la correcta —de una negativa débil a cuatro
   exigencias—, pero la justificación escrita afina de más, y queda anotado aquí.
4. **Literalidad.** La spec enumeró tres porque eran las tres que el arquitecto conocía; lo
   que CA-14 exige de forma normativa —re-encuadrar y no aflojar, declarar qué vigilaba cada
   una antes y qué vigila ahora, y hacerlo desde esta spec y no desde quien se beneficia— se
   cumple en **las cinco**, y además con el porqué escrito **junto a cada aserción**. Las dos
   imprevistas caen dentro de la banda CA-19/20/24 que la propia spec ya da por tocada, y
   **CA-1..18 de SPEC-044 ni se rozan** (sus tres ficheros no aparecen en el diff). Por eso
   **no lo dejo como salvedad**: lo dejo ✅ con la constancia de que el inventario de la spec
   estaba incompleto, que es un defecto del inventario y no del trabajo.

#### CA-6(f) y F-SPEC-046-2 — la salvedad, con los números corregidos

El velo **atenúa y no oculta**: contraste efectivo del texto de la tabla **17,01:1 →
5,54:1** con mi propio cálculo WCAG, escrito aparte del de la guardia (que da 5,57:1 sobre
otra fila). Muy por encima del 4,5:1 de AA, y el número no se tocó para que pasara: la
propia rama subió el velo de 0,55 a 0,45 cuando el test se puso rojo.

Pero **la guardia de (f) sólo se ejecuta a 1280 px**, cuando CA-6 pide los ocho. Medí los
ocho (`_qa/SPEC-046/verif-contexto-devuelto.txt`):

| ancho | página arriba, primera fila | página desplazada, fila intermedia |
|---|---|---|
| 360 / 390 | **0 filas** por encima | 3 filas |
| 640 … 800 | 1 fila | — |
| 1280 | 2 filas | 7 filas |

**Sobre `F-SPEC-046-2`: la salvedad es legítima, pero su cifra está mal atribuida.** «Dos
filas a 360 px» es la cifra de **1280**. A 360, en el caso exacto que reportó el humano
—lista larga, página arriba, *Editar* en la primera fila—, **no queda ninguna fila entera a
la vista**: lo que se lee por encima de la capa es el encabezado de la página, no la lista.
Y ahí la guardia de (f) ni siquiera correría: lanzaría «la capa tapa la tabla entera».

Aun así **no lo tumbo, y no es RED**, por tres razones que sostengo con lo medido: (i) la
propiedad que CA-6(f) nombra —el velo atenúa, comprobado sobre contraste efectivo— **es
invariante con el ancho** (un solo color de `::backdrop`) y la verifiqué en los ocho; (ii)
los cero de 360/390 son un artefacto de la **posición de desplazamiento**, no de la capa: en
cuanto la página se mueve —que es como se llega a cualquier fila que no sea la primera— hay
**3 filas** legibles a 360, con la fila en edición marcada y visible
(`verif-contexto-360.png`); y (iii) ADR-030 §1 factura esta devolución como **«parcial y
honesta»**, sin fijar un número.

Lo que sí es cierto es que **el test no protege el beneficio, sólo su presencia**: exige
«más de cero filas», no un mínimo, así que si el formulario engordara el contexto podría
irse a cero también a 1280 sin que nada se ponga rojo. Eso queda como **F-SPEC-046-4**, con
la corrección de la cifra y con el número que hoy es verdad, para que la próxima medida
tenga contra qué comparar.

#### Lo que también comprobé, y no me creí de entrada

- **El vehículo, con teclado y con ratón.** 20 tabulaciones seguidas recorren sólo los seis
  controles de la capa; el único punto fuera es `BODY`, la vuelta del ciclo de Chromium —el
  foco **nunca** llega a un control del fondo—. Escape, *Cancelar* y *Entendido* devuelven
  el foco al *Editar* **de su fila**, y `tr[data-editando]` vuelve a 0.
- **La relación fila ↔ panel con el mismo ticker en dos mercados.** `Z6DUAL`/BME abre
  `11–13 / 31–33`; `Z6DUAL`/NYSE abre `61–63 / 81–83`; una sola fila marcada cada vez.
- **La forma es la que decidió ADR-030**, no una variante: `position: fixed`,
  `inset: auto 0 0 0` (anclada al borde **inferior**: `bottom == innerHeight` en los ocho
  anchos), `<dialog>` + `showModal()`, `::backdrop` que atenúa, fila marcada con `outline`
  —que no ocupa caja, así que ninguna medida cambia por ella—, `aria-haspopup="dialog"` sin
  `aria-expanded`, confirmación **dentro** de la capa, y la capa **fuera** de
  `.table-scroll`.
- **CA-7 de verdad.** `EXCLUSIONES_M1` sigue teniendo un solo elemento (`.symbol-results`),
  y el testigo de la capa vuelve con 1 en los ocho anchos **y con el defecto puesto**.
- **CA-15 sin adelantar SPEC-045.** `grep -rn 'ilenciar' src/ drizzle/` no devuelve nada: el
  tercer control lo inyecta el test y se retira solo.

**Residuales abiertos por el verificador:** `F-SPEC-046-4`. **Confirmados sin cambios:**
`F-SPEC-046-1`, `F-ADR-030-1/2/3`. **No reproducido:** `F-SPEC-046-3`.

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
| CA-6(f) · verificador | `_qa/SPEC-046/verif-contexto-devuelto.txt`, `verif-contexto-{360,390,1280}.png` | Cuántas filas quedan legibles por encima de la capa **en los ocho anchos y en las dos posiciones de desplazamiento**, con el contraste efectivo al lado. A 360, con la página desplazada, se ven tres filas y la fila en edición marcada detrás del velo. |
| Gate · verificador | `_qa/SPEC-046/verif-gate-adversarial.txt` | Las cuatro puertas automáticas con sus cifras, la reinyección de CA-10 hecha con CSS del verificador, la tabla de la capa medida a los ocho anchos y el recorrido real del foco con teclado (20 tabulaciones). |

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

Abierto por el verificador (gate del 2026-08-22):

- **F-SPEC-046-4** — **CA-6(f) se mide en 1 de los 8 anchos, y su umbral no protege el
  beneficio.** La guardia `vigiladas-capa-edicion.spec.ts › CA-6(f)` sólo corre a **1280 px**
  aunque CA-6 pide los ocho, y exige *«más de cero filas por encima»*, no un mínimo. Medido
  por el verificador con instrumento propio, con la capa abierta y **la página arriba, sobre
  la primera fila**: **0 filas** a 360 y 390, **1 fila** de 640 a 800, **2 filas** a 1280; con
  la **página desplazada** sobre la fila intermedia, **3 filas** a 360/390 y **7** a 1280. El
  contraste efectivo del texto de la tabla es **17,01:1 → 5,54:1** en todos los casos en que
  hay fila que medir, o sea que el velo **atenúa y no oculta** (CA-6f se cumple). Dos
  consecuencias que quedan abiertas: (a) a 360/390 con la página arriba la guardia **no
  podría ejecutarse** —su precondición interna lanzaría «la capa tapa la tabla entera»—, y
  (b) el contexto devuelto puede erosionarse hasta cero sin que ninguna aserción se ponga
  roja. Lo que hay que re-encuadrar cuando se retome: medir (f) **a los ocho anchos y en las
  dos posiciones de desplazamiento**, y fijar el mínimo contra los números de arriba, que son
  los que hoy son verdad. **Corrige además la cifra de `F-SPEC-046-2`**: sus «dos filas a
  360 px» son en realidad las de 1280. Evidencia: `_qa/SPEC-046/verif-contexto-devuelto.txt`
  y `verif-contexto-{360,390,1280}.png`.

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

**Gate adversarial: hecho el 2026-08-22 — GREEN.** La spec pasa a `hecho`.

**Pendiente tras el cierre**: (1) regenerar `docs/tablero.md`, que sigue en 2026-08-21 y
no conoce SPEC-046 (`/sdd-tablero`); (2) triar **F-SPEC-046-4** —CA-6(f) medida en 1 de 8
anchos y con la cifra de `F-SPEC-046-2` corregida— y **F-SPEC-046-3** —el `hookTimeout`
de `vitest.config.ts`—, que no bloquean nada de esta spec.
