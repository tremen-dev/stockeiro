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

1. **La colocación estaba razonada, y su razón es buena.** El comentario que la acompaña
   dice que el panel va fuera de `.table-scroll` porque dentro heredaría el ancho de una
   tabla de nueve columnas y quedaría en el subárbol de un contenedor de desplazamiento
   realmente desplazado, **donde M1 deja de medir a propósito** (`tests/e2e/geometria.ts`,
   `dentroDeContenedorDesplazable`; ADR-026 §4). Es verdad, y por eso **el arreglo
   intuitivo —meter el panel en su fila— está descartado**: cambiaría un defecto visible
   por un punto ciego.
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

Esta spec hace las dos mitades: **mueve la superficie de edición a una capa anclada a la
ventana** (ADR-030, que escribe esta spec) y **añade la medida que faltaba** —M4, la
respuesta al gesto cae dentro de la ventana— al módulo compartido, con la prueba de que la
guardia vieja no la habría cazado y la nueva sí.

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
  dos. Es la comprobación de **relación fila ↔ panel** que la guardia anterior nunca hizo:
  no basta con que se vea algo, tiene que verse **lo de esa fila**.

### Rebanada 2 — La capa anclada (ADR-030)

- **CA-4 (Anclada a la ventana, no al documento).**
  Dada la superficie de edición abierta,
  cuando se inspecciona y se mide,
  entonces (a) su `position` computada es `fixed`; (b) sigue estando **fuera de
  `.table-scroll`** (`closest('.table-scroll') === null`), que es lo que SPEC-044 protegía
  y aquí no se toca; y (c) **su caja respecto a la ventana no depende del
  desplazamiento**: abriéndola con la página arriba del todo y con la página al fondo, el
  `getBoundingClientRect()` de la capa coincide en ±1 px. (c) es la propiedad estructural
  entera de este arreglo, expresada como medida.

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
  abajo; y (e) **M3**: ninguna etiqueta ni rótulo de la capa parte palabras.

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
  cumplir. *(Ver nota 3 del gate: hay una alternativa y la firma el humano.)*

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
  el producto. Es mecanismo nuevo y traería temporizadores a la suite; ver nota 3 del gate,
  donde se ofrece como alternativa a CA-13 si el humano la prefiere.
- **Editar desde el teclado sin ratón como recorrido completo**, más allá de lo que CA-5
  exige (foco que entra, Escape, foco que vuelve). Una auditoría de teclado de
  `/vigiladas` entera es otra cosa.
- **Tocar `design/tremen-ds/`.** ADR-026 §5 sigue mandando: los ajustes van en
  `src/app/globals.css` o en una clase propia de la app.
- **Formatear importes, validar signo y rango** (`F-SPEC-030-1`, `F-SPEC-030-2`): se
  heredan tal cual, como ya hacía SPEC-044.

## Notas para el gate humano

Lo que necesitas mirar con lupa antes de firmar:

1. **La solución cambia el gesto, no sólo el sitio.** Editar pasa a abrirse como una
   **ventana modal**: se oscurece la tabla, el foco entra en el formulario y Escape cierra.
   Ganas que funcione igual con tres vigiladas que con cuarenta, y que el teclado y el
   lector de pantalla funcionen de verdad. **Pierdes ver la tabla mientras editas** — no
   puedes comparar la zona nueva con la de la fila de al lado sin cerrar. Si eso te importa
   más de lo que parece, la alternativa está escrita y evaluada en ADR-030: un **cajón
   inferior no modal** que deja la tabla viva detrás. Cuesta más código (foco y Escape a
   mano), tapa filas a 360 px, y **no cambia ni una línea de la guardia**. Es un cambio que
   se pide aquí y ya.

2. **El arreglo intuitivo está descartado, y conviene que sepas por qué.** «Que el panel
   salga debajo de su fila» heredaría el ancho de una tabla de nueve columnas y —lo grave—
   metería el formulario dentro de `.table-scroll`, donde **M1 deja de medir por diseño**.
   Cambiaríamos un defecto que se ve por un punto ciego que no. Es justo el motivo que
   SPEC-044 dejó escrito en el código, y sigue siendo válido: lo que estaba mal de aquella
   decisión era la **otra** mitad, «después de la tabla entera».

3. **CA-13 te cuesta un clic y hay que decidirlo.** Hoy, al guardar, el panel se cierra
   solo y la frase *«el aviso llega con el próximo ciclo diario»* se pinta detrás de la
   tabla — con cuarenta filas **no la lee nadie**: es el mismo defecto en su segunda
   instancia. La propuesta es que el guardado se confirme **en la propia ventana**, que se
   cierra cuando tú lo dices. **Alternativa**: que se cierre sola y la frase aparezca en una
   franja anclada abajo; se lee sin clic extra, pero es un mecanismo nuevo (aparición,
   cierre, temporizador) y los temporizadores dan pruebas frágiles. **Si prefieres que no
   se diga nada al guardar, CA-13 se cae sin arrastrar nada más** — pero entonces SPEC-044
   CA-22 queda incumplida a sabiendas y hay que anotarlo.

4. **Toco una guardia de una spec `hecho`, y lo declaro.** Tres aserciones de
   `vigiladas-editar.spec.ts` codificaban **dónde** estaba el panel (`max-width: none`, su
   ancho igual al del formulario, y que al guardar desaparece del árbol). Con la capa
   anclada dejan de ser expresables tal cual. **No se aflojan: se re-encuadran** a la
   propiedad que sigue viva, queda escrito en el ledger qué vigilaba cada una antes y qué
   vigila ahora, y **lo hace el arquitecto, no quien se beneficia de que pasen** — que es
   exactamente la condición que FOUNDATION fijó el 2026-08-20. Es CA-14 y es el punto donde
   más fácil sería hacer trampa.

5. **ADR-030 constriñe a SPEC-045 antes de que se escriba.** Le dice dónde vivirá su
   superficie si la necesita, le regala M4 sin copiar nada, y le libera el ancho de la fila
   (la edición deja de competir por él). CA-15 mide **hoy** que la celda de acciones tolera
   un tercer control a 360 px con un botón simulado. Si al medirlo resulta que no cabe con
   dignidad, **la salida es apilar, nunca esconder**, y saldrá en la evidencia de `_qa/`.

6. **El número de ADR puede colisionar.** Escribo **ADR-030** porque el máximo en `main`
   más el commit de producto de esta rama es ADR-029. Hay dos sesiones en paralelo
   (SPEC-047, favicon en EPIC-MEJORA). Si alguna escribe un ADR, hay que renumerar antes de
   mergear. Lo mismo con las guardias de geometría: dos ramas que añadan medidas al mismo
   módulo van a chocar — ADR-026 ya avisó de que el módulo compartido es punto único de
   conflicto entre ramas.

7. **Esto no toca base de datos, ni motor, ni avisos.** Ni migración, ni esquema, ni
   término nuevo de dominio. Es maquetación, colocación y guardia — lo cual también
   significa que **la única forma de saber si está bien es mirar la evidencia**: CA-17 deja
   en `_qa/SPEC-046/` el antes y el después con la distancia medida en píxeles.

8. **Lo que esta spec no promete.** Que la tabla sea cómoda con cuarenta filas. No hay
   paginación, ni búsqueda dentro de la lista, ni filtro. Editar la vigilada número 40
   seguirá exigiendo desplazarse hasta ella; lo que se arregla es que **una vez que la
   pulsas, pase algo que veas**.
