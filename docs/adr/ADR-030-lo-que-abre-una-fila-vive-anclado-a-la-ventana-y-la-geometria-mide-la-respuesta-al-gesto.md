---
id: ADR-030
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-22, por: sdd-arquitecto}
---
# ADR-030: Lo que abre una fila vive anclado a la ventana, y la geometría mide la respuesta al gesto

- Deciders: propone **sdd-arquitecto** (2026-08-22) al escribir **SPEC-046**, sobre el
  defecto que reportó el humano (Alberto Fojo) ese mismo día: *«cuando una vigilada está
  arriba de todo y se le da a "editar", el componente de edición no se ve porque queda
  fuera de la pantalla»*. Pendiente de aprobación por el humano. **No es una decisión de
  producto ni de stack**: es una decisión sobre **dónde vive una superficie que se abre
  desde una fila** y sobre **qué más tiene que medir la geometría** para que esa clase de
  defecto no vuelva a pasar por verde.
- Specs relacionadas: la origina y la consume **SPEC-046**. **Precisa —no supersede—
  ADR-026**, del que hereda las tres medidas, el módulo único y los ocho anchos. Corrige
  una decisión de colocación de **SPEC-044** (comentario de
  `src/app/vigiladas/watched-table.tsx:263-270`) sin invalidar su motivo. Constriñe a
  **SPEC-045**, que añadirá una segunda acción a la misma fila.

## Contexto

**SPEC-044 entregó la edición de zonas el 2026-08-21 y quedó `hecho` con sus 25 CA en
verde. El 2026-08-22 el humano descubrió que en su lista real no se puede usar.**

Los hechos, sin interpretar:

- `src/app/vigiladas/watched-table.tsx` renderiza **un solo** panel de edición
  (`id="editar-panel"`), **fuera de `.table-scroll` y después de la tabla entera**. El
  `id` de la fila que se edita vive en el estado del componente (`editandoId`), no en el
  árbol: da igual qué fila pulses, el panel sale siempre en el mismo sitio — **el final de
  la lista**.
- Con dos filas eso es invisible. Con cuarenta, pulsar *Editar* en la primera abre un
  panel a cuarenta filas de distancia, muy por debajo del pliegue. Desde el punto de vista
  del usuario, **el botón no hace nada**: no hay cambio en lo que ve, no hay foco que se
  mueva, no hay nada. Es un fallo silencioso de maquetación, hermano del *«sin
  cotización»* mudo que **CE-F2 de EPIC-FIX** existe para erradicar.
- La colocación **estaba razonada por escrito** y su razón es **buena**: dentro de
  `.table-scroll` el panel heredaría el ancho de una tabla de nueve columnas y —peor—
  quedaría en el subárbol de un contenedor de desplazamiento realmente desplazado, donde
  **M1 deja de medir a propósito** (`tests/e2e/geometria.ts`,
  `dentroDeContenedorDesplazable`). Es decir: el arreglo evidente —meter el panel en su
  fila— **compra un defecto vertical pagando con un punto ciego horizontal**.
- **Y había guardia.** `tests/e2e/vigiladas-editar.spec.ts` (SPEC-044 CA-23) abre el panel
  y lo mide **a los ocho anchos** con M1, M2 y M3, escribe capturas y un fichero de
  medidas… y **pasa**. Porque las tres medidas de ADR-026 son **horizontales**: preguntan
  *«¿cabe a lo ancho?»*, nunca *«¿lo ve el usuario que acaba de pulsar?»*. Y además su
  escenario tiene **dos filas**, así que el panel caía dentro de la ventana por accidente
  del tamaño de la muestra.

Debajo hay **tres problemas distintos**, y confundirlos es cómo se llega otra vez aquí:

1. **Una superficie que se abre desde una fila y se pinta en un punto fijo del flujo tiene
   una distancia al gesto que crece con la lista.** No es un bug de CSS: es una propiedad
   estructural de la colocación. Cualquier arreglo que deje la superficie en el flujo
   detrás de la lista es correcto **sólo para listas cortas**.
2. **La geometría del proyecto sólo mira un eje.** ADR-026 nació de recortes horizontales
   y fijó tres medidas horizontales. Un elemento a 2.400 px de la parte de arriba de la
   ventana **cabe perfectamente a lo ancho**: M1, M2 y M3 lo aprueban las tres. La familia
   entera de *«el gesto no produce nada visible»* está fuera de su alcance.
3. **Una guardia de lista con dos filas no prueba nada sobre listas.** El escenario de
   SPEC-044 se eligió por economía, no por descuido, y es razonable para casi todos sus
   CA. Pero para el CA que mide la pantalla convirtió la muestra en la hipótesis: se midió
   el caso en el que el defecto **no puede existir**.

El punto 2 es el que duele, porque **SPEC-040 se escribió entera para curar exactamente
esto** —una guardia que mira donde el defecto no está— y aun así la ceguera nueva se coló
dos specs después. La lección de SPEC-040 no era «mide elemento a elemento»: era **«una
medida sólo ve lo que pregunta, así que la pregunta hay que escribirla»**. ADR-026 §2 ya
lo previó al decir que una spec que necesite un invariante que no existe **lo aporta al
módulo**. Ésta es la primera vez que toca ejercerlo.

## Decisión

### 1. Una superficie que se abre desde una fila **no vive en el flujo detrás de la lista**

Vive en una **capa anclada a la ventana**: su caja se define respecto al viewport
(`position: fixed`), no respecto al documento. La propiedad que se compra —y que es toda
la decisión— es que **la distancia entre el gesto y su respuesta deja de depender de la
longitud de la lista, de la fila pulsada y del desplazamiento de la página**.

Esto **no revoca el motivo de SPEC-044**: la capa sigue estando **fuera de
`.table-scroll`** y sigue sin heredar el ancho de la tabla. Lo que se corrige es la otra
mitad de aquella frase —*«después de la tabla entera»*—, que era la parte que nadie había
medido.

### 2. El vehículo es el `<dialog>` nativo, abierto con `showModal()`

Foco que entra al abrir, **Escape** que cierra, fondo inerte, capa superior y `::backdrop`
vienen dados por la plataforma. Un `<div role="dialog">` con trampa de foco escrita a mano
es **más código, peor accesibilidad y una fuente de defectos propia**; no se acepta salvo
que aparezca un problema **medido** con el elemento nativo, y en ese caso vuelve al gate.

Obligaciones que no da la plataforma y sí se exigen:

- **Nombre accesible que nombre al sujeto** (aquí: el activo y su mercado). Una capa que no
  dice de qué fila habla reintroduce el problema en su versión semántica.
- **El foco vuelve al control que la abrió** al cerrarse por cualquier vía (guardar,
  cancelar, Escape). Es lo que reubica al usuario en su fila sin que nadie desplace nada.
- **El disparador declara `aria-haspopup="dialog"`**, no `aria-expanded`: no es un
  desplegable en flujo, y decir que lo es engaña al lector de pantalla sobre dónde va a
  aparecer el contenido.

### 3. **M4 — la respuesta al gesto cae dentro de la ventana**, y vive en el módulo compartido

Cuarta medida de la geometría del proyecto, en `tests/e2e/geometria.ts` junto a las tres de
ADR-026, con esta forma:

> Dado un control y el elemento que su activación revela, tras el gesto y **sin ningún
> desplazamiento programático** (`scrollIntoView`, `scrollTo`, ni el que el motor de
> pruebas hace por su cuenta al interactuar), el elemento revelado tiene
> `top ≥ −tolerancia` y `bottom ≤ innerHeight + tolerancia`, y la posición de
> desplazamiento del documento es **la misma que antes del gesto**.

Las dos mitades son necesarias. Sin la segunda, «llevar al usuario a la superficie» a base
de desplazar la página pasaría la medida, y eso **no es lo mismo**: mueve al usuario de
sitio, le quita de la vista la lista sobre la que estaba trabajando y hay que devolverlo
después. M4 dice *«la respuesta va donde está el usuario»*, no *«el usuario va donde está
la respuesta»*.

Cuando el contenido revelado sea **más alto que la ventana** —caso legítimo a 360 px— la
exigencia se cumple sobre la caja de la capa, cuyo alto queda acotado a la ventana, y su
desplazamiento **vertical, propio y declarado** (ADR-026 §4, segunda salida). Lo que nunca
se acepta es que la capa sobresalga por abajo y se confíe en que el usuario lo descubra.

M4 es **complementaria**, nunca sustituta: una capa anclada también tiene que caber a lo
ancho (M1), no generar desplazamiento de documento (M2) y no partir palabras (M3).

### 4. Una guardia que mide una **lista** se ejecuta con una lista **larga de verdad**, y lo comprueba

Nada de números mágicos: la guardia **afirma su propia precondición** antes de medir —que
el final de la lista queda **por debajo del pliegue** en el ancho que está midiendo— y
falla si deja de cumplirse. Así el escenario no caduca en silencio cuando cambie el alto de
una fila: o sigue siendo largo, o el test lo dice. Es la regla de FOUNDATION («un test de
frontera fija una propiedad, no un estado del árbol») aplicada al **escenario**, no sólo a
la aserción.

Y se mide en **más de una posición de la lista**: la **primera**, una **intermedia** y la
**última**. Las tres, porque cada una mata una solución equivocada distinta — la primera
mata el panel al final, la última mataría un panel al principio, y la intermedia mata las
dos.

### 5. Una capa anclada a la ventana **no entra en `EXCLUSIONES_M1`**

La lista de exclusiones de ADR-026 es para lo que está **fuera de flujo y anclado a su
disparador** (hoy, `.symbol-results`): su caja no es maquetación de la página. Una capa
modal es lo contrario — ocupa la ventana y **es** maquetación. Meterla en la lista para que
la medida deje de quejarse sería `F-ADR-026-2` cumpliéndose por escrito. Y la guardia
**afirma que la capa entró en la medida**, no sólo que no violó nada: una medida que no la
mide tampoco la puede aprobar.

### 6. La **confirmación** de un gesto vive donde vive el gesto

Un `role="status"` al final del documento es el mismo defecto con otra ropa: se anuncia al
lector de pantalla y es invisible para quien mira. Lo que confirme una acción hecha desde
una capa anclada se enseña **en esa capa** o en otra igualmente anclada.

## Consecuencias

### Positivas

- **La clase entera de defecto muere, no el caso.** Con la caja definida respecto a la
  ventana, «lista larga», «fila de arriba» y «página desplazada» dejan de ser variables:
  no hay un tamaño de lista a partir del cual vuelva.
- **La geometría del proyecto pasa a tener las dos preguntas escritas**: *«¿cabe?»* (M1,
  M2, M3) y *«¿lo ve quien acaba de pulsar?»* (M4). Y M4 nace ya en el módulo, así que la
  hereda la spec siguiente sin copiar nada — que es literalmente el problema que ADR-026
  vino a resolver.
- **Libera el espacio de la fila**, que es lo que R-5 de EPIC-005 tenía en riesgo: la
  superficie de edición ya no compite por el ancho de la tabla, así que la segunda acción
  de SPEC-045 negocia sólo con *Editar* y *Quitar*, no con un panel.
- **Accesibilidad neta positiva** por el vehículo: foco, Escape y fondo inerte gratis y
  correctos, en vez de un panel en flujo al que hoy hay que llegar tabulando por toda la
  tabla.

### Negativas / follow-ups

- **Se pierde de vista la tabla mientras se edita.** Es el precio del modal y es real: no
  se puede comparar la zona nueva con la de la fila de al lado sin cerrar. Se compensa
  nombrando el activo en la capa (pto. 2) y devolviendo el foco a su fila al cerrar, pero
  no se anula.
- **Un clic más por edición** si la confirmación se lee en la capa (pto. 6). Se acepta a
  cambio de que la frase de cadencia se lea siempre; la alternativa —una franja anclada que
  se cierra sola— es más código y trae temporizadores a la suite.
- **F-ADR-030-1 (follow-up).** M4 depende de que **nadie desplace nada** entre el gesto y
  la medida. El motor de pruebas desplaza por su cuenta al interactuar con un elemento
  fuera de la ventana; la medida tiene que registrar la posición **antes** del gesto y
  compararla, y ésa es una sutileza fácil de perder en la siguiente copia. Va comentada
  dentro del módulo, junto a la de `dentroDeContenedorDesplazable`.
- **F-ADR-030-2 (follow-up).** Este ADR decide la colocación **de lo que abre una fila de
  una lista**. No dice nada de las demás superficies del producto (el alta plegable de
  SPEC-041, la ayuda, los formularios de página completa), que siguen en flujo con razón.
  Si alguna crece hasta tener el mismo problema se decide entonces; no se extiende esta
  decisión por analogía.
- **La capa modal es una superficie nueva que medir a los ocho anchos**, con su coste de
  e2e (ADR-026 ya avisó de que la suite crece por spec).

## Alternativas consideradas

- **Panel *inline* en su fila (un `<tr>` con `colspan` debajo de la fila editada).** Es la
  respuesta intuitiva y está **rechazada por dos motivos independientes**, cualquiera de
  los dos bastante: (a) heredaría el ancho de una tabla de nueve columnas, que es
  exactamente lo que SPEC-044 evitó por escrito; y (b) quedaría dentro de `.table-scroll`,
  un contenedor de desplazamiento realmente desplazado, donde **M1 deja de medir por
  diseño**. Cambiaríamos un defecto visible por un punto ciego — la operación que ADR-026
  existe para impedir. Y a 360 px, cuatro campos dentro de una celda de una tabla que ya se
  desplaza a lo ancho no son un formulario: son un laberinto.

- **Dejar el panel donde está y llevar al usuario a él (`scrollIntoView` + foco).** Es la
  más barata y **pasaría una versión perezosa de M4**, que es justo por lo que M4 exige que
  la posición de desplazamiento **no cambie**. Rechazada porque: mueve al usuario al final
  de una lista de cuarenta filas por un gesto que él entendía como local; obliga a un viaje
  de vuelta que nadie programa bien; el desplazamiento suave introduce carreras en la
  suite; y **no arregla nada estructural** — el panel sigue lejos, sólo que ahora hay una
  cinta transportadora. Sigue siendo correcto sólo mientras el usuario no toque el ratón
  entre medias.

- **Anclar el panel a la fila con posicionamiento absoluto (o *CSS anchor positioning*).**
  Rechazada: con la fila cerca del borde inferior la superficie vuelve a caer fuera; a 360
  px un panel anclado a una fila de una tabla que se desplaza a lo ancho es un problema de
  colocación en dos ejes; y el posicionamiento por ancla tiene soporte desigual entre
  motores para algo que aquí no aporta nada que no dé una capa centrada.

- **Cajón (*drawer*) no modal anclado al borde inferior, con la tabla viva detrás.**
  Rechazada **por poco**, y es la alternativa que merece releerse si el modal molesta en el
  uso real: conserva el contexto de la lista, pero tapa filas —a 360 px, muchas—, exige
  escribir a mano el foco y el Escape que el `<dialog>` da hechos, y deja al usuario la
  duda de si la fila que ve detrás del cajón es la que está editando. Si el humano prefiere
  no perder la tabla de vista, **éste es el cambio a pedir en el gate**, y no cambia ni una
  línea de M4.

- **Ampliar sólo la guardia y no tocar la colocación** («que el test compruebe que el panel
  se ve, y ya lo arreglará quien lo rompa»). Rechazada: con el panel en el flujo detrás de
  la lista, esa guardia **nace roja y no se puede poner verde sin cambiar la colocación**.
  Escribir la medida sin la decisión sería dejar el arreglo a la improvisación de quien
  implemente, que es exactamente cómo se elige un `scrollIntoView`.

- **Comparación de imágenes para cazar «el gesto no hizo nada».** Rechazada por cuarta vez
  en este proyecto, con el motivo de ADR-026 §6 intacto: una captura se rompe al cambiar
  una fuente y no se rompe cuando el panel aparece a 2.400 px del pliegue, porque a esa
  altura simplemente no sale en la foto. Se miden cajas.

- **Meter la capa en `EXCLUSIONES_M1` si diera guerra a 360 px.** Rechazada de antemano y
  por escrito (pto. 5), porque es la salida cómoda que `F-ADR-026-2` predijo. Si la capa no
  cabe a 360, las salidas son las dos de ADR-026 §4: que quepa, o que su desplazamiento
  viva dentro de ella y esté declarado.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
