---
id: SPEC-046
tipo: spec
epica: EPIC-FIX
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-08-22, por: sdd-arquitecto}
---
# SPEC-046 — El panel de edición se abre donde el usuario mira, y la guardia lo mide

## Problema

**Editar una vigilada está `hecho` y no se puede usar.** Lo reportó el humano el
2026-08-22, con la lista real delante:

> *«edición de valores de vigiladas: cuando una vigilada está arriba de todo y se le da a
> "editar", el componente de edición no se ve porque queda fuera de la pantalla, queda en
> la parte de abajo. necesitamos resolver esto»*

La causa está en dos líneas de colocación. `src/app/vigiladas/watched-table.tsx:263-270`
renderiza **un solo** panel de edición (`id="editar-panel"`, `data-testid="editar-panel"`)
**fuera de `.table-scroll` y después de la tabla entera**. Qué fila se está editando vive
en el estado del componente (`editandoId`), no en el árbol: da igual dónde pulses, el panel
sale **siempre al final de la lista**. Con dos filas eso no se nota. Con cuarenta, pulsar
*Editar* en la primera abre un formulario a cuarenta filas de distancia y **el usuario no
ve nada suceder**: ni contenido nuevo, ni foco que se mueva, ni aviso. Para él, **el botón
está roto**.

Tres cosas más que hay que tener delante antes de tocar nada:

1. **La colocación estaba razonada, y su razón es buena a medias.** El comentario que la
   acompaña dice que el panel va fuera de `.table-scroll` porque dentro heredaría el ancho
   de una tabla de nueve columnas y quedaría en el subárbol de un contenedor de
   desplazamiento realmente desplazado, donde **M1 deja de medir**
   (`tests/e2e/geometria.ts`, `dentroDeContenedorDesplazable`; ADR-026 §4). Las dos cosas
   son ciertas, con un matiz que importa y que **ADR-030** detalla: la ceguera de M1 **no
   es universal** —pide `overflow-x: auto|scroll` **y** que el contenedor desborde de
   verdad—, así que aparece entre 360 y 800 px y no a 1280. Es decir: exactamente donde el
   defecto duele.
2. **Había guardia y no lo vio.** `tests/e2e/vigiladas-editar.spec.ts` (SPEC-044 CA-23)
   abre el panel y lo mide **a los ocho anchos** con M1, M2 y M3, guarda capturas y escribe
   un fichero de medidas. Y pasa. Porque las tres medidas de ADR-026 son **horizontales**:
   preguntan *«¿cabe a lo ancho?»* y nunca *«¿lo ve quien acaba de pulsar?»*. Un elemento a
   2.400 px por debajo del pliegue **cabe perfectamente**. Encima su escenario tiene **dos
   filas**, así que el panel caía dentro de la ventana por accidente del tamaño de la
   muestra: se midió el caso en el que el defecto no puede existir.
3. **Que esta ceguera se colara después de SPEC-040 es el dato importante.** SPEC-040 se
   escribió entera —y con ella ADR-026— para curar *«una guardia que mira donde el defecto
   no está»*. Dos specs después volvió a pasar, con otra medida que faltaba. La lección no
   era «mide elemento a elemento»: era **«una medida sólo ve lo que pregunta»**. ADR-026 §2
   previó este momento cuando dijo que una spec que necesite un invariante que no existe
   **lo aporta al módulo**; es la primera vez que toca ejercerlo.

Esta spec hace las dos mitades: **mueve la superficie de edición a una capa anclada al
borde inferior de la ventana** (ADR-030, que escribe esta spec) y **añade la medida que
faltaba** —M4, la respuesta al gesto cae dentro de la ventana— al módulo compartido, con la
prueba de que la guardia vieja no la habría cazado y la nueva sí.

### «¿No se puede editar dentro de la tabla?» — sí se puede, y aun así no se hace

El humano lo preguntó en el gate del 2026-08-22 y la pregunta es buena, porque desplegar
la edición **debajo de su fila** es lo que cualquiera espera. La respuesta honesta es que
**sí es posible** —una fila desplegable con `colSpan` se puede escribir, se puede hacer
que quepa y se puede medir— y que aun así no se elige. El razonamiento completo, con el
mecanismo, está en **ADR-030 §Alternativas (a) y (b)**; el resumen, para que se pueda leer
sin abrirlo:

- **El ancho no se hereda: se impone.** `.data-table` declara `width: 100%`, pero con
  `table-layout: auto` eso es un **suelo**. Sus anchos mínimos suman mucho más — 288 px
  sólo de relleno (nueve columnas × 32), `.activo-caja { min-width: 170px }`,
  `.estado-caja { max-width: 170px }` y `.zone-label { white-space: nowrap }`. A 360 px la
  tabla mide varios cientos de píxeles más que la ventana, y un `<td colspan="9">` **mide
  lo que mida la tabla**: `.auth-form` resolvería su `min(420px, 100%)` a **420 px sobre
  una ventana de 360**.
- **Y el control *Editar* está en la novena columna.** En móvil hay que arrastrar la tabla
  a la derecha para alcanzarlo (SPEC-040 CA-5), así que al pulsar, el `scrollLeft` está al
  máximo y la fila desplegada se ancla ~800 px a la izquierda de lo que se ve: **el mismo
  defecto girado 90°**.
- **Ambas cosas tienen arreglo, y ése es el problema.** `position: sticky; left: 0` y una
  anchura sacada de la ventana (`calc(100vw − relleno)` o un `ResizeObserver`) lo
  resuelven. Pero la primera mete el relleno de un ancestro dentro de un descendiente
  (ADR-026 §5), y las dos hay que volver a acertarlas cada vez que la tabla cambie.
- **Y la guardia pasaría a depender de que alguien se acuerde.** Se puede medir un panel
  dentro de `.table-scroll` pasándolo como **raíz de medida**; funciona. Pero deja de valer
  *por defecto* y vale *porque se añadió una raíz*: lo siguiente que otra spec meta ahí
  dentro nace ciego. Esa apuesta ya se perdió en SPEC-037, SPEC-039 y aquí.
- **La edición en celda es peor, y no por maquetación**: cuatro `<input>` sueltos son un
  **segundo camino de edición**, y eso deshace lo que SPEC-044 compró con CA-15/CA-20 — que
  *«la edición no puede validar más flojo que el alta»* fuera verdad **por construcción**.
  Además, *Guardar* y *Cancelar* por fila se comen el hueco que SPEC-045 necesita.

Lo que sí se hace es **pagar el coste que esa opción evitaba**: la capa se ancla **abajo**
(no centrada), el velo **atenúa en vez de ocultar** para que la lista se siga leyendo
detrás, y **la fila que se edita queda marcada**. Recupera la vista de la tabla; no la
interacción con ella, que el modo modal suspende a propósito.

### Por qué es EPIC-FIX y no EPIC-MEJORA

Es el patrón exacto de **CE-F1**: una capacidad **ya entregada y verificada** —SPEC-044,
`hecho` el 2026-08-21— que **no cumple su promesa con uso real**. No se añade alcance: se
restaura lo prometido. **CE-M1 de EPIC-MEJORA la expulsa explícitamente** («si algo no
cumple lo prometido, es EPIC-FIX»), y el roadmap ya lo anotó en la entrada de EPIC-FIX con
fecha 2026-08-22. Y es hermano de **CE-F2** en su versión visual: un botón que no produce
nada visible es un fallo silencioso, igual que el *«sin cotización»* mudo que originó la
épica.

## Usuarios / roles afectados

- **Cualquier usuario con más vigiladas de las que caben en una pantalla** (roles `tester`,
  `completo`, `admin`; RN-03 y ADR-021): hoy no puede editar las zonas de las filas de
  arriba. Es el afectado principal y es quien lo reportó.
- **El usuario de móvil**, agravado: a 360 × 800 caben menos filas que en un escritorio, así
  que el umbral a partir del cual la edición deja de funcionar es **más bajo**.
- **El tester externo que llega del foro** (CE-1 de EPIC-004): llega **sin sus zonas
  puestas** y va a corregirlas mucho más que el autor, que ya las tenía. Es exactamente el
  motivo por el que EPIC-005 subió de prioridad.
- **El proyecto entero**, como destinatario de la mitad de la guardia: mientras la
  geometría sólo pregunte por el eje horizontal, cualquier spec puede volver a entregar un
  gesto sin respuesta visible con la suite en verde.
- **Sistema / dominio**: **no cambia nada**. Ni esquema, ni reglas, ni ciclo, ni avisos.
  Esta spec es maquetación, colocación y guardia.

## Criterios de aceptación

Todo lo que dice pantalla se mide **en el navegador con la app corriendo** (Playwright), a
los **ocho anchos** de `tests/e2e/geometria.ts` (**360, 390, 640, 700, 730, 760, 800,
1280**), con los altos que ese módulo ya declara. Tolerancia de redondeo: **1 px**, la del
módulo.

**La lista larga es el escenario, y no es un número mágico.** Los CA que hablan de lista
larga siembran vigiladas suficientes para que el **final de la tabla quede por debajo del
pliegue** en el ancho que se está midiendo, y la guardia **lo comprueba antes de pulsar
nada** (ADR-030 §4): si un día las filas encogen y deja de ser cierto, el test falla y se
re-encuadra — no se afloja (FOUNDATION, 2026-08-20). Los tickers de esta spec van
prefijados y son suyos: el registro de símbolos es compartido (ADR-002), como ya cuidan
`spec041.ts` con `Z4` y `vigiladas-editar.spec.ts` con `Z5`.

### Rebanada 1 — El defecto, reproducido y muerto (CE-F1)

- **CA-1 (El caso reportado: la primera fila de una lista larga).**
  Dada `/vigiladas` con una lista larga (precondición comprobada: el fondo de la tabla cae
  por debajo del pliegue) y la página **sin desplazar**,
  cuando el usuario pulsa *Editar* en la **primera** fila,
  entonces la superficie de edición está **dentro de la ventana** sin que nadie desplace
  nada: `top ≥ −1` y `bottom ≤ innerHeight + 1` (**M4**), su título, sus cuatro campos y su
  botón de guardar son visibles, y **la posición de desplazamiento del documento es la
  misma que antes de pulsar**. Ese último punto no es decorativo: separa «la respuesta va
  donde está el usuario» de «al usuario lo mandan al final de la lista» (ADR-030 §3).

- **CA-2 (Y no sólo la primera: la de en medio y la última, y en los ocho anchos).**
  Dada la misma lista larga,
  cuando se repite el gesto sobre la fila **intermedia** y sobre la **última** —y, para la
  intermedia y la última, también con la página **desplazada** hasta tenerlas a la vista—,
  entonces se cumple **CA-1** en los tres casos. Cobertura: las **tres posiciones** a
  **360** y **1280 px** (los dos extremos declarados), y la **primera** posición a **los
  ocho anchos**. Las tres posiciones son obligatorias porque cada una mata una solución
  equivocada distinta: la primera mata el panel al final, la última mataría un panel al
  principio, la intermedia mata las dos.

- **CA-3 (El panel que se abre es el de la fila que pulsaste).**
  Dada la lista larga —con **dos vigiladas del mismo ticker en dos mercados** entre ellas
  (ADR-007/ADR-012)—,
  cuando se pulsa *Editar* en una fila cualquiera de las tres posiciones,
  entonces la capa **nombra a ese activo** (su nombre accesible y su bloque
  `editar-activo` contienen el **ticker y el mercado de esa fila**, no los de otra) y los
  cuatro campos traen **los valores de esa fila**; se cierra y se abre otra, y cambian los
  dos. Y **la fila que se está editando queda marcada** mientras la capa está abierta —de
  forma comprobable en el árbol y visible detrás del velo—, y deja de estarlo al cerrar.
  Es la comprobación de **relación fila ↔ panel** que la guardia anterior nunca hizo: no
  basta con que se vea algo, tiene que verse **lo de esa fila**, y tiene que poder
  encontrarse **de qué fila era**.

### Rebanada 2 — La capa anclada (ADR-030)

- **CA-4 (Anclada a la ventana por abajo, no al documento).**
  Dada la superficie de edición abierta,
  cuando se inspecciona y se mide,
  entonces (a) su `position` computada es `fixed`; (b) sigue estando **fuera de
  `.table-scroll`** (`closest('.table-scroll') === null`), que es lo que SPEC-044 protegía
  y aquí no se toca; (c) **su caja respecto a la ventana no depende del desplazamiento**:
  abriéndola con la página arriba del todo, con la página al fondo y con `.table-scroll`
  arrastrado a su extremo derecho, el `getBoundingClientRect()` de la capa coincide en los
  tres casos con ±1 px; y (d) está **anclada al borde inferior** de la ventana
  (`bottom ≥ innerHeight − 1`, salvo el margen que declare). (c) es la propiedad
  estructural entera de este arreglo expresada como medida, y su tercer caso —la tabla
  arrastrada— es el que distingue esta forma de una fila desplegable, que ahí se iría con
  el `scrollLeft` (ADR-030, alternativa (a), pto. 2).

- **CA-5 (El vehículo, y lo que la plataforma da hecho).**
  Dada la capa,
  cuando se abre y se cierra,
  entonces es un `<dialog>` nativo abierto con `showModal()`: el foco **entra** en ella al
  abrirse; **Escape** la cierra; el fondo queda **inerte** (no se puede tabular a los
  controles de la tabla ni activarlos con el ratón); tiene **nombre accesible** que nombra
  al activo (CA-3); y **al cerrarse por cualquier vía —guardar, cancelar o Escape— el foco
  vuelve al control *Editar* de su fila**. El disparador declara `aria-haspopup="dialog"`
  y **no** `aria-expanded`: ya no es un desplegable en flujo, y decir que lo es engaña al
  lector de pantalla sobre dónde va a aparecer el contenido.

- **CA-6 (Cabe a lo ancho, y si no cabe a lo alto se desplaza ella, no la página).**
  Dada la capa abierta a los **ocho anchos**,
  cuando se mide,
  entonces (a) **M1** no reporta ninguna violación bajo `nav`/`main`/`footer`; (b)
  `document.scrollWidth ≤ clientWidth + 1` (**M2**); (c) la propia capa **no se desplaza a
  lo ancho** (`scrollWidth ≤ clientWidth + 1`) — que además de ser lo correcto evita que se
  dispare la exención de contenedor desplazable de M1 y el subárbol deje de medirse; (d) si
  su contenido no cabe a lo alto, el desplazamiento es **vertical, propio y declarado**
  (ADR-026 §4, segunda salida), nunca `overflow: hidden` ni una capa que sobresalga por
  abajo; (e) **M3**: ninguna etiqueta ni rótulo de la capa parte palabras; y (f) el velo
  **atenúa sin ocultar** — con la capa abierta, las filas que quedan por encima de ella
  siguen siendo legibles, comprobado sobre el contraste efectivo del texto de la tabla, no
  sobre la opacidad declarada. (f) es la devolución parcial del contexto que se le debe a
  la opción que el humano prefería (ADR-030 §1); si se implementa un velo opaco, esta spec
  no ha pagado ese coste.

- **CA-7 (La capa se mide: no se excluye, y la guardia lo afirma).**
  Dado el módulo `tests/e2e/geometria.ts`,
  cuando se ejecuta la guardia,
  entonces (a) el selector de la capa **no** figura en `EXCLUSIONES_M1` —comprobable
  leyendo la lista— y (b) la guardia **afirma que la capa entró en el conjunto de elementos
  medidos por M1**, no sólo que no violó nada. Para eso el módulo expone de qué elementos
  se tomó medida. Una medida que no mide la capa tampoco la puede aprobar, y esconderla en
  la lista de exclusiones sería `F-ADR-026-2` cumpliéndose por escrito.

- **CA-8 (La caja del formulario sigue siendo la del alta).**
  Dada la capa abierta,
  cuando se compara con lo que fijó SPEC-040,
  entonces el formulario de zonas sigue siendo **el mismo componente** (`WatchForm`, sin
  buscador) con la misma caja `.auth-form`; la capa **no declara un ancho propio distinto**
  del que ya cabe, y a 360 px los cuatro campos `min`/`max` siguen dentro de la ventana
  (M1). SPEC-044 CA-20 sigue siendo verdad; lo único que cambia es **dónde** está la caja,
  no **cómo** es.

### Rebanada 3 — La guardia que habría cazado esto (CE-F2, ADR-026 §2 y §7)

- **CA-9 (M4 vive en el módulo compartido, no en esta spec).**
  Dado `tests/e2e/geometria.ts`,
  cuando se lee,
  entonces expone **M4** —«la respuesta al gesto cae dentro de la ventana»— junto a M1, M2
  y M3, con su motivo escrito y con la sutileza de `F-ADR-030-1` comentada: la posición de
  desplazamiento se registra **antes** del gesto, y la medida no admite que el motor de
  pruebas desplace por su cuenta al interactuar. Ninguna guardia de spec escribe su propia
  versión (misma comprobación binaria que SPEC-040 CA-6).

- **CA-10 (Prueba de eficacia: la guardia nueva caza el defecto, la vieja no).**
  Dada la lista larga y el defecto **reinyectado en tiempo de ejecución** por CSS —devolver
  la capa al flujo detrás de la tabla, p. ej. anulando su anclaje—,
  cuando sobre **la misma página** se toman las cuatro medidas,
  entonces **M4 reporta violación** con la cifra medida en el mensaje (a cuántos píxeles
  por debajo del pliegue quedó la superficie), y **M1, M2 y M3 no ven nada**. Y sin
  reinyectar el defecto, M4 no reporta nada. Los cuatro hechos, en el mismo test.
  Es el patrón de ADR-026 §7 y el gemelo exacto de **SPEC-040 CA-8**: existe para que nadie
  vuelva a creer que medir el ancho es medir la pantalla.

- **CA-11 (Una guardia de lista se ejecuta con una lista, y lo comprueba).**
  Dado el escenario de las guardias de esta spec,
  cuando arrancan,
  entonces **afirman su precondición antes de medir**: el fondo de la tabla queda por
  debajo del pliegue en el ancho que se está midiendo. El número de filas no se escribe
  como verdad: se **deriva** hasta cumplir la precondición, o el test falla diciendo que el
  escenario dejó de ser largo. Así el escenario no caduca en silencio cuando cambie el alto
  de una fila (FOUNDATION, 2026-08-20: un test de frontera fija una propiedad, no un estado
  del árbol).

### Rebanada 4 — Lo que SPEC-044 prometió sigue en pie

- **CA-12 (Las promesas funcionales de la edición, intactas).**
  Dada la capa,
  cuando se usa,
  entonces siguen siendo verdad **CA-19** (los cuatro campos precargados con lo vigente;
  una zona sin definir aparece **vacía**, no con `0`; el activo se identifica y **no se
  puede cambiar**: sin buscador), **CA-21** (guardar refleja los valores nuevos en la tabla
  con el estado de zona recalculado en render; un error de validación deja la superficie
  **abierta**, con lo escrito y el mensaje visible) y **CA-24** (tras reordenar por Nombre o
  por Estado se edita **la fila pulsada** y ninguna otra, y la tabla conserva color de
  fondo, etiqueta de estado, motivo de SPEC-016, marca de «sin refrescar» de SPEC-043,
  tipo, mercado y nombre). Nada de dominio se toca: **CA-1 a CA-18 de SPEC-044 no se
  reescriben ni se rozan**.

- **CA-13 (La confirmación se lee donde se hizo el gesto).**
  Dada la lista larga y una edición guardada con éxito,
  cuando se confirma,
  entonces la frase de cadencia (`CADENCIA_LINEA`, `src/lib/help/content.ts`, SPEC-039
  CA-3 — **la misma constante**, sin frase nueva) se muestra **dentro de la ventana**
  (M4), en la propia capa, y la capa se cierra cuando el usuario lo dice, devolviendo el
  foco a su fila (CA-5). Hoy esa frase se pinta **detrás de la tabla**, así que con
  cuarenta filas es invisible: es el mismo defecto que esta spec arregla, en su segunda
  instancia, y arreglar uno sin el otro dejaría media promesa de SPEC-044 CA-22 sin
  cumplir. **Decidido por el humano en el gate del 2026-08-22** —«confirmar dentro de la
  ventana»— frente a la alternativa de cierre automático más franja anclada. Consecuencia
  aceptada: **un clic más por edición**. Y consecuencia que este CA vigila: la
  confirmación se mide con **M4** igual que el formulario, porque el defecto que arregla
  esta spec era precisamente un mensaje que nadie lee.

- **CA-14 (Las aserciones que codificaban la colocación se re-encuadran, y se declara).**
  Dado `tests/e2e/vigiladas-editar.spec.ts`,
  cuando se ajusta,
  entonces las aserciones que fijaban **dónde** estaba el panel —que su `max-width`
  computado es `none`, que su ancho coincide con el del formulario, que al guardar
  desaparece del árbol— **se re-encuadran a la propiedad que sigue viva** (la caja sigue
  siendo la de `.auth-form`; la superficie deja de estar a la vista cuando el usuario la
  cierra), **nunca se aflojan hasta que pasen**; queda escrito en el ledger **qué vigilaba
  cada una antes y qué vigila ahora**; y lo hace **esta spec, no quien se beneficie de que
  pase** (FOUNDATION, 2026-08-20; precedentes `F-SPEC-034-6` y `F-SPEC-042-9`). La
  aserción de que el panel vive fuera de `.table-scroll` **no se toca**: sigue siendo
  cierta y sigue siendo necesaria (CA-4b).

### Rebanada 5 — No cerrarle la puerta a SPEC-045

- **CA-15 (La celda de acciones admite una tercera acción sin esconder ninguna).**
  Dada una fila de `/vigiladas` a los **ocho anchos**, con un **tercer control simulado**
  inyectado por el test en `.fila-acciones` (etiqueta del largo de «Silenciar»; **no se
  implementa nada de SPEC-045**),
  cuando se desplaza `.table-scroll` hasta su extremo derecho,
  entonces se alcanzan **los tres** controles dentro de la ventana (`right ≤ innerWidth + 1`,
  `left ≥ −1`, SPEC-040 CA-5) y ninguna etiqueta parte palabras (**M3**). Si a 360 px no
  caben en línea, **se apilan** —`.fila-acciones` ya es `flex-wrap: wrap`—; esconder un
  control no cuenta como arreglo (ADR-026 §4). Es una **propiedad derivada en ejecución**,
  no un «esto todavía no existe» congelado: mide lo que la celda tolera hoy, y SPEC-045
  llegará a una pantalla donde eso ya está medido (R-5 de EPIC-005).

### Rebanada 6 — Cero regresión y evidencia

- **CA-16 (La suite entera, en verde, sin relajar nada).**
  Dado el conjunto de comprobaciones del proyecto,
  cuando se ejecuta,
  entonces pasa **unit y e2e**, y en particular `vigiladas.spec.ts`, `vigiladas-alta.spec.ts`,
  `vigiladas-orden.spec.ts`, `vigiladas-editar.spec.ts`, `geometria-rutas.spec.ts`,
  `geometria-eficacia.spec.ts`, `geometria-puntos-ciegos.spec.ts`, `movil-alta.spec.ts` y
  `sin-refrescar-geometria.spec.ts` **sin reescribir aserciones a la baja** (se admite
  ajustar selectores; no relajar umbrales). A **1280 px** la tabla y el alta se ven **igual
  que antes**: lo único que cambia de sitio es la superficie de edición.

- **CA-17 (Evidencia medida, no razonada).**
  Dado el cierre de la spec,
  cuando se revisa `_qa/SPEC-046/`,
  entonces hay (a) capturas del **defecto reproducido** —lista larga, *Editar* en la
  primera fila, panel fuera de la ventana— a **360** y **1280 px**, con la distancia medida
  en píxeles entre el pliegue y la superficie; (b) las mismas dos capturas **después**,
  con la capa dentro de la ventana; y (c) el fichero de medidas de M4 para las tres
  posiciones y los anchos de CA-2. La cifra de (a) es la que convierte «se veía mal» en un
  número.

## Entidades y reglas afectadas

**Ni esquema, ni migración, ni dominio.** Esta spec no toca `watched_symbols`,
`zone_triggers` ni `notifications`, no añade servicios ni acciones, y **no bautiza ningún
término**: no hay nada que escribir en `docs/fundacion/dominio.md` al aprobarla (ADR-025
pto. 1). El rótulo *Editar* ya existía y no cambia.

- **Decisiones**: **ADR-030** (nuevo, lo propone esta spec) — dónde vive lo que abre una
  fila y qué mide M4. **ADR-026** — las tres medidas, el módulo único, los ocho anchos y
  las dos salidas legítimas ante un desborde; ADR-030 lo **precisa**, no lo supersede.
  **ADR-028** — la edición sigue siendo una actualización y la reconciliación sigue siendo
  del ciclo siguiente: esta spec no roza el motor. **ADR-007 / ADR-012** — la identidad de
  la vigilada, que es lo que CA-3 usa para probar la relación fila ↔ panel. **ADR-021** —
  Vigiladas es de cualquier rol. **ADR-025** — nada que escribir en el glosario.
- **Reglas**: **RN-01** y **RN-03** siguen tal cual (la acción de edición no se toca:
  `userId` dentro del `WHERE`, sesión obligatoria). **RN-10** y **RN-11** intactas: ni las
  validaciones ni el estado de zona cambian.
- **Criterios de épica**: **CE-F1** (restaurar lo prometido, probado con uso real) y
  **CE-F2** (ningún fallo silencioso — aquí, un gesto sin respuesta visible).
- **Ficheros que toca**: `src/app/vigiladas/watched-table.tsx` (la colocación y el gesto),
  `src/app/globals.css` (la caja de la capa: `.editar-vigilada` y su `::backdrop`),
  `tests/e2e/geometria.ts` (M4 y el reporte de elementos medidos),
  `tests/e2e/vigiladas-editar.spec.ts` (re-encuadre declarado, CA-14) y la guardia nueva de
  esta spec. `src/app/vigiladas/watch-form.tsx` y `actions.ts` **no se tocan**.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Silenciar y reactivar (SPEC-045).** Está `aprobada` y sin implementar, y se hace
  **después** de este arreglo por decisión del humano. Aquí sólo se comprueba que la fila
  **tolera** su control (CA-15); no se implementa, ni se especifica, ni se le adelanta
  ninguna decisión de rótulo o de estado.
- **Rediseñar `/vigiladas`.** Se cambia de sitio **una** superficie. La tabla, sus nueve
  columnas, el control de orden, el alta plegable y el estado vacío siguen como los dejaron
  SPEC-039, SPEC-040 y SPEC-041.
- **Paginar, virtualizar o limitar la lista.** Que la tabla sea larga no es el defecto: el
  defecto es que la respuesta al gesto dependa de su longitud. Paginar sería tapar el
  síntoma y además es alcance de producto sin épica.
- **Llevar la misma capa a otras superficies del producto** (el alta plegable, la ayuda,
  los formularios de página completa). ADR-030 decide **lo que abre una fila de una lista**
  y deja escrito que no se extiende por analogía (`F-ADR-030-2`).
- **Una franja de estado anclada y reutilizable (*toast*)** para confirmar acciones en todo
  el producto. Es mecanismo nuevo y traería temporizadores a la suite. **Descartada por el
  humano en el gate del 2026-08-22** al elegir «confirmar dentro de la ventana» (CA-13).
- **La fila desplegable y la edición en celda.** Evaluadas a fondo a petición del humano en
  el mismo gate: **son posibles** y se rechazan con mecanismo en **ADR-030 §Alternativas
  (a) y (b)**. Si el uso real demuestra que perder la interacción con la tabla pesa más que
  las cuatro compensaciones que la fila desplegable exige, el camino de vuelta está escrito
  y medido — pero no se implementan las dos formas «por si acaso».
- **Editar desde el teclado sin ratón como recorrido completo**, más allá de lo que CA-5
  exige (foco que entra, Escape, foco que vuelve). Una auditoría de teclado de
  `/vigiladas` entera es otra cosa.
- **Tocar `design/tremen-ds/`.** ADR-026 §5 sigue mandando: los ajustes van en
  `src/app/globals.css` o en una clase propia de la app.
- **Formatear importes, validar signo y rango** (`F-SPEC-030-1`, `F-SPEC-030-2`): se
  heredan tal cual, como ya hacía SPEC-044.

## Notas para el gate humano

Lo que necesitas mirar con lupa antes de firmar:

1. **Tu pregunta del gate: sí, editar dentro de la tabla es posible. Y aun así no lo hago.**
   Una fila desplegable con `colSpan` se puede escribir y se puede medir; no te estoy
   diciendo que no se pueda. Lo que hace falta para que funcione son **cuatro
   compensaciones**: `position: sticky; left: 0` (porque *Editar* está en la novena columna
   y al pulsarlo la tabla está arrastrada a la derecha, así que el panel nacería fuera de
   pantalla **por la izquierda**), una anchura sacada de la ventana con `calc(100vw − …)` o
   un `ResizeObserver` (porque un `<td colspan="9">` mide lo que mide la tabla: ~800 px a
   360, y el formulario se pintaría a 420 sobre una ventana de 360), **una raíz de medida
   extra** para que la guardia no se quede ciega entre 360 y 800 px, y **un M4 más flojo**
   (un formulario de 400 px de alto desplegado desde una fila de la mitad inferior no cabe
   entero). Cuatro parches para colocar una superficie es la señal de que se está colocando
   mal. El detalle completo, con los números y el código de la guardia, está en **ADR-030
   §Alternativas (a)**; si tras leerlo sigues queriéndolo, es un «sí» que puedes dar y que
   cuesta lo que ahí pone.

2. **La edición en celda la descarto por un motivo que no es de maquetación.** Cuatro
   `<input>` sueltos en las columnas de zona son un **segundo camino de edición**, y eso
   deshace lo que SPEC-044 compró: que *«la edición no pueda validar más flojo que el
   alta»* fuera verdad **por construcción** (mismo `WatchForm`, CA-15/CA-20) en vez de por
   vigilancia. Además los mensajes de error de SPEC-030 no caben en una celda, y *Guardar*
   y *Cancelar* por fila se comen el hueco donde va *Silenciar*. Es la única de las tres
   opciones que puede **romper algo que hoy funciona**.

3. **Lo que sí te devuelvo del coste que señalaste.** La capa se ancla **abajo** y no en el
   centro; el velo **atenúa en vez de ocultar**, así que la lista se sigue leyendo detrás
   (CA-6f lo mide sobre el contraste real, no sobre la opacidad declarada); y **la fila que
   editas queda marcada** para que la encuentres al cerrar (CA-3). Recuperas la **vista** de
   la tabla, no la **interacción**: eso el modo modal lo suspende a propósito. Si lo que
   quieres es seguir tocando la tabla mientras editas, entonces lo que quieres es el **cajón
   no modal** que sigue evaluado en ADR-030, y hay que pedirlo aquí.

4. **CA-13 queda como lo decidiste**: al guardar, la confirmación con la frase de cadencia
   se lee **en la propia capa** y ésta se cierra cuando tú lo dices. Cuesta **un clic más
   por edición**; a cambio la frase se lee siempre, que era el problema (hoy se pinta detrás
   de la tabla y con cuarenta filas no la ve nadie). La guardia la mide con M4, igual que
   al formulario — porque el defecto original era exactamente un mensaje invisible.

5. **Toco una guardia de una spec `hecho`, y lo declaro.** Tres aserciones de
   `vigiladas-editar.spec.ts` codificaban **dónde** estaba el panel (`max-width: none`, su
   ancho igual al del formulario, y que al guardar desaparece del árbol). Con la capa
   anclada dejan de ser expresables tal cual. **No se aflojan: se re-encuadran** a la
   propiedad que sigue viva, queda escrito en el ledger qué vigilaba cada una antes y qué
   vigila ahora, y **lo hace el arquitecto, no quien se beneficia de que pasen** — que es
   exactamente la condición que FOUNDATION fijó el 2026-08-20. Es CA-14 y es el punto donde
   más fácil sería hacer trampa.

6. **ADR-030 constriñe a SPEC-045 antes de que se escriba.** Le dice dónde vivirá su
   superficie si la necesita, le regala M4 sin copiar nada, y le libera el ancho de la fila
   (la edición deja de competir por él). CA-15 mide **hoy** que la celda de acciones tolera
   un tercer control a 360 px con un botón simulado. Si al medirlo resulta que no cabe con
   dignidad, **la salida es apilar, nunca esconder**, y saldrá en la evidencia de `_qa/`.

7. **El número de ADR ya no es una duda: ADR-030 está libre** (confirmado en el gate del
   2026-08-22 — `origin/main` llega a ADR-029 y la sesión del favicon no escribió ninguno).
   Lo que **sigue** siendo riesgo de rama es `tests/e2e/geometria.ts`: dos ramas que añadan
   medidas al mismo módulo van a chocar, y ADR-026 ya avisó de que el módulo compartido es
   punto único de conflicto.

8. **Esto no toca base de datos, ni motor, ni avisos.** Ni migración, ni esquema, ni
   término nuevo de dominio. Es maquetación, colocación y guardia — lo cual también
   significa que **la única forma de saber si está bien es mirar la evidencia**: CA-17 deja
   en `_qa/SPEC-046/` el antes y el después con la distancia medida en píxeles.

9. **Lo que esta spec no promete.** Que la tabla sea cómoda con cuarenta filas. No hay
   paginación, ni búsqueda dentro de la lista, ni filtro. Editar la vigilada número 40
   seguirá exigiendo desplazarse hasta ella; lo que se arregla es que **una vez que la
   pulsas, pase algo que veas**.
