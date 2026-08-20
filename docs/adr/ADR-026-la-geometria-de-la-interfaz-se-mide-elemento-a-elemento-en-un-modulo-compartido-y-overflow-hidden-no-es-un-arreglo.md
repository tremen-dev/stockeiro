---
id: ADR-026
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-20, por: sdd-arquitecto}
---
# ADR-026: La geometría de la interfaz se mide elemento a elemento, en un módulo compartido, y `overflow: hidden` no es un arreglo

- Deciders: propone **sdd-arquitecto** (2026-08-20), al escribir **SPEC-040** y al triar
  **F-SPEC-035-11**, que llevaba abierto desde SPEC-035 pidiendo explícitamente que esto se
  decidiera «arriba» (*«es política de proyecto, no un CA de esta spec»*). Pendiente de
  aprobación por el humano (Alberto Fojo). **No es una decisión de producto ni de stack**: es
  una decisión sobre **cómo se prueba la maquetación** y sobre **quién declara la caja de un
  componente**.
- Specs relacionadas: nace de **F-SPEC-035-11** (SPEC-035) y de **V-SPEC-039-6** (SPEC-039).
  La consume **SPEC-040**, que es su primera aplicación. Toca las guardias entregadas por
  **SPEC-035**, **SPEC-036**, **SPEC-037** y **SPEC-039**.

## Contexto

El proyecto lleva **cuatro specs seguidas** entregando guardias de geometría y **el mismo
defecto ha vuelto tres veces**. Los hechos, sin interpretar:

- **SPEC-035.** `.app-footer` no declaraba su `flex-direction`; por debajo de 720 px lo
  heredó de `design/tremen-ds/responsive.css` §footer, el `flex: 1 1 320px` del descargo dejó
  de ser un ancho y pasó a ser un alto, y el pie —montado en el layout raíz— medía **452 px**
  con ~280 de hueco muerto **en todas las pantallas de móvil y tablet**. Llegó al verificador
  con **879 tests en verde**. Costó una **ronda RED entera**.
- **SPEC-036.** Escribió la medida correcta: recorrer `main *` y comprobar
  `rect.right > clientWidth + 1`, elemento a elemento.
- **SPEC-037 y SPEC-039.** Copiaron y adaptaron la guardia anterior… y **perdieron esa
  medida**: las dos derivan el desborde de `document.scrollWidth - document.clientWidth` y
  nada más.
- **SPEC-039, verificación (2026-08-20).** Con la suite en verde, el verificador encontró a
  mano que a 390 px el **botón «Vigilar» estaba fuera de la pantalla**: `.symbol-picker` mide
  444 px en una columna de 350. `html, body { overflow-x: hidden }` del sistema de diseño lo
  recorta **sin mover `scrollWidth`**, así que la guardia no podía verlo. Es
  **V-SPEC-039-6**, y con él vinieron dos defectos más de la misma familia
  (`V-SPEC-039-2`, `-3`), todos preexistentes en `origin/main`.

Hay **tres problemas distintos** debajo, y confundirlos es parte de por qué esto se repite:

1. **La medida elegida puede ser ciega.** `document.scrollWidth` responde a *«¿tiene el
   documento barra horizontal?»*, no a *«¿cabe el contenido?»*. Con `overflow-x: hidden` esas
   dos preguntas **dejan de tener la misma respuesta**, y en este proyecto el sistema de
   diseño la pone por debajo de 720 px, que es justo donde importa. Una guardia que use sólo
   esa medida está **estructuralmente incapacitada** para ver un recorte en móvil.
2. **Hay un modo de fallo que ninguna medida de desborde ve.** Cuando el contenedor es
   estrecho de más pero el texto **se reparte dentro** —«Ac / cio / ne / s»—, no se sale
   nada. No hay desborde de documento ni de elemento: hay una columna imposible. Requiere
   preguntar por la **integridad de la palabra**, no por la caja.
3. **La medida no tiene domicilio.** Cada spec escribió su propia función `medir` copiando de
   la anterior. Copiar es lossy: lo que una spec aprendió no llega a la siguiente salvo que
   quien copie entienda por qué estaba ahí cada línea. **La degradación de SPEC-036 →
   SPEC-037 → SPEC-039 no es negligencia de nadie: es lo que hace el copiar-pegar.**

Y sobre la causa raíz de los defectos, no de los tests: `design/tremen-ds/` estiliza **por
selector de elemento** (`footer`, `nav`, `h1`…) y su `responsive.css` **cambia ejes y
direcciones** por debajo de 720 px. Cualquier componente de `src/app/` que use uno de esos
elementos y **no declare sus propias propiedades de caja** hereda las del sistema. Eso no es
un bug del sistema —hace lo que un sistema de diseño hace— sino una **frontera sin escribir**
entre el sistema y la app. `F-SPEC-035-11` pedía elegir entre una convención escrita y unas
comprobaciones de caja; llevaba una spec y media esperando.

## Decisión

### 1. La geometría se mide con **tres medidas complementarias**, y ninguna sustituye a otra

- **(M1) Desborde por elemento.** Para cada elemento visible bajo `nav`, `main` y `footer`:
  `getBoundingClientRect().right <= innerWidth + 1` y `left >= -1`. Es la medida que **no se
  puede enmascarar** con `overflow: hidden`, y por tanto **la principal**.
- **(M2) Desborde de documento.** `documentElement.scrollWidth <= clientWidth + 1`. Sigue
  siendo útil —caza el caso 721–800 px de `V-SPEC-039-3`, donde no hay `hidden` que
  disimule— pero **nunca es la única**.
- **(M3) Integridad de palabra.** Para los textos de título de un componente, el número de
  cajas de línea (`Range.getClientRects()`) es **≤ el número de palabras**, y ninguna caja de
  línea excede el ancho de contenido de su contenedor. Es lo único que caza el modo de fallo
  «columna imposible».

A ellas se suman las que el proyecto ya usaba y **siguen vigentes**: el **hueco muerto**
(caja frente a la unión real de las cajas de sus hijos, descontando su `padding`) y el **eje
declarado** (ningún contenedor propio con `flex-direction` heredado).

**Regla operativa, y es la que hay que poder citar: una guardia de geometría que derive el
desborde horizontal únicamente de `document.scrollWidth` está mal escrita.** No es una
preferencia de estilo: es una medida que ya demostró no ver el defecto que existía.

### 2. Las medidas viven en **un único módulo compartido**, no copiadas en cada spec

Un solo fichero (`tests/e2e/geometria.ts` o el nombre que le ponga SPEC-040) exporta las
medidas y los **anchos de referencia**. Cada guardia de spec importa de ahí y **añade lo
suyo**: sus rutas, sus umbrales, sus invariantes propios. Se unifica **cómo se mide**; **no**
se unifica qué afirma cada spec, que es asunto de sus CA.

**Una spec nueva con pantalla nueva no escribe una medida nueva: añade su ruta al conjunto y,
si necesita un invariante que no existe, lo aporta al módulo** —donde queda para todos— en
vez de dejarlo en su fichero.

### 3. Los **anchos de referencia** son del proyecto, no de cada spec

**360, 390, 640, 700, 730, 760, 800 y 1280 px.** Los cinco que fijó SPEC-035 (390, 640, 700,
760, 1280), más **730 y 800** —que SPEC-040 añade porque `V-SPEC-039-3` vive exactamente en el
hueco que dejaban 700 y 760: un defecto que sólo existe entre dos anchos medidos es un defecto
que nadie mide—, más **360**, el suelo que fijó el humano en el gate del 2026-08-20 (Android
pequeño e iPhone SE).

**El suelo declarado es 360 px**, y bajarlo más **no es un parámetro de test**: a 320 px la
tabla de datos y el formulario de alta no se ajustan, se rediseñan, y eso es una decisión de
producto con su épica. Subir el suelo tampoco es libre: cada ancho que se retira es una franja
en la que nadie vuelve a mirar.

### 4. `overflow: hidden` **no es una respuesta a un desborde**

Si algo no cabe, hay exactamente **dos** salidas legítimas: **que quepa** (que el componente
declare su caja de forma que encoja) o **que el desplazamiento viva en un contenedor propio y
declarado** (`overflow-x: auto` en el bloque que contiene lo ancho — una tabla, un bloque de
código—, **a todos los anchos**, no dentro de un `@media`).

Recortar el contenido para que el número salga bien es la versión visual del *fallo
silencioso* que **CE-F2 de EPIC-FIX** existe para erradicar: el problema sigue ahí y encima
deja de verse. `html, body { overflow-x: hidden }` del sistema **puede quedarse** —quitarlo
es tocar el sistema y abrir superficie sin medir— porque con **M1** ya no esconde nada de lo
que se mide. Lo que queda prohibido es **añadir `overflow: hidden` como arreglo** de un
desborde propio.

### 5. Un componente de `src/app/` **declara sus propias propiedades de caja**

Eje (`flex-direction`), reparto (`grid-template-columns`) y capacidad de encoger
(`min-width`) **se declaran**, no se heredan del sistema de diseño. Un componente que use un
selector de elemento que `tremen-ds` estiliza (`footer`, `nav`, `h1`…) y no fije lo suyo está
aceptando que el sistema decida su maquetación por debajo de 720 px, que es exactamente cómo
nació `F-SPEC-035-11`.

**Y la app no muta el sistema.** `design/tremen-ds/` lo comparte el sitio de tremen.dev: los
ajustes de Stockeiro van en `src/app/globals.css` —que importa el sistema en su primera línea
y por tanto gana a igual especificidad— o, si la cascada no basta, **dando al componente una
clase propia de la app**. Nunca con `!important` ni escalando especificidad a martillazos.

### 6. Nada de regresión visual por comparación de imágenes

Se miden **cajas**, no píxeles. Ya lo rechazaron SPEC-035, SPEC-036 y SPEC-037 con el mismo
motivo y aquí queda fijado: una captura de referencia se rompe al cambiar una fuente o un
color —cosas que **se pueden cambiar a propósito**— y no se rompe cuando un botón se va
fuera de la pantalla dentro de un contenedor recortado, que es lo que hay que proteger.

### 7. Una guardia nueva **demuestra que caza el defecto**

Cuando una spec añade una medida por un defecto concreto, entrega también la prueba de que la
medida lo ve: **reinyectar el defecto** (CSS inyectado en tiempo de ejecución) y comprobar
que la medida **reporta violación**, y que sin reinyectarlo no. Es el patrón que funcionó en
SPEC-035 y es la única forma barata de distinguir «el test está verde» de «el test mira».

## Consecuencias

### Positivas

- **`F-SPEC-035-11` queda cerrado**, y con las dos mitades que pedía: convención escrita
  (ptos. 4 y 5) y comprobaciones de caja en las pantallas principales (ptos. 1–3, aplicados
  por SPEC-040).
- **La degradación por copia se acaba.** Lo que una spec aprende sobre cómo medir entra en el
  módulo y llega a todas; hoy llegaba sólo a la siguiente, y a veces ni eso.
- **Una guardia mal escrita se detecta leyendo, no sufriendo**: «¿deriva el desborde sólo de
  `scrollWidth`?» es una pregunta binaria que cabe en una revisión.
- **El arreglo de un desborde deja de tener una salida barata y mala.** Con el pto. 4 escrito,
  `overflow: hidden` no es un atajo defendible.
- **La frontera con `tremen-ds` está escrita**, así que dejar de declarar el eje o el
  `min-width` pasa a ser un descuido señalable y no una costumbre.

### Negativas / follow-ups

- **Coste por spec.** Toda pantalla nueva añade sus rutas al conjunto y paga sus medidas: la
  e2e crece. Ocho anchos × diez rutas ya son ochenta medidas por ejecución. Si el tiempo se
  vuelve un problema, la salida es **reducir anchos por ruta** (móvil siempre; el resto según
  lo que la pantalla arriesgue), no volver a la medida ciega.
- **F-ADR-026-1 (follow-up).** El módulo compartido crea un **punto único de fallo con
  tentación de aflojar**: un umbral relajado para «arreglar» un test rojo afecta ahora a todas
  las guardias a la vez. Las holguras deben seguir siendo **de cada guardia**, y una holgura
  nueva en el módulo debería justificarse por escrito.
- **F-ADR-026-2 (follow-up).** La lista de exclusiones de M1 (elementos absolutos que sólo
  existen desplegados) **puede crecer hasta vaciar la medida**. Va comentada dentro del módulo
  y con motivo por línea; conviene mirarla en cada revisión que la toque.
- **Se acepta un `overflow-x: hidden` heredado** que nadie ha medido. No es incoherencia con
  el pto. 4 —prohíbe **añadirlo** como arreglo— pero significa que si el sistema de diseño se
  reescribiera algún día, podrían aparecer barras horizontales en superficies fuera del
  conjunto de rutas.
- **La convención del pto. 5 no la comprueba nada automáticamente** en general; se comprueba
  por sus efectos (M1, hueco muerto, eje declarado) en las rutas medidas. Un componente nuevo
  en una ruta no medida sigue pudiendo heredar del sistema sin que nadie lo vea.

## Alternativas consideradas

- **Dejarlo en convención escrita, sin ADR ni módulo.** **Rechazada**: es lo que pedía la
  mitad barata de `F-SPEC-035-11` y no habría evitado nada. La convención de «declara tu eje»
  ya se cumplía en SPEC-039 —sus contenedores son `grid` a propósito, y lo dice su cabecera—
  y aun así el botón «Vigilar» estaba fuera de la pantalla. Sin medida, una convención sólo
  documenta la buena intención.

- **Comparación de imágenes (captura de referencia).** **Rechazada** por tercera vez, y ahora
  con motivo fijado: se rompe por cambios deliberados (fuente, color, copy) y no se rompe por
  el defecto que nos ocupa. Además, una suite de capturas que se actualiza con un `--update`
  deja de proteger el día que alguien la actualice con el defecto dentro.

- **Quitar `html, body { overflow-x: hidden }` del sistema de diseño y confiar en que la barra
  horizontal delate el problema.** **Rechazada**: sería tocar el sistema compartido con
  tremen.dev, destaparía superficies que nadie ha medido —convirtiendo un arreglo acotado en
  una auditoría— y **seguiría sin medir nada**: dependería de que alguien mire. M1 no depende
  de que nadie mire.

- **Una guardia por spec, como hasta ahora.** **Rechazada por los hechos**: se probó cuatro
  veces y la técnica se degradó dos. El estado del arte del proyecto era, literalmente, que la
  guardia buena existía y las dos siguientes no la copiaron.

- **Un único fichero de guardia global para toda la app, en vez de módulo + guardia por
  spec.** **Rechazada**: haría que cada spec tuviera que editar un fichero común para añadir
  su pantalla, con conflictos entre ramas paralelas —que en este proyecto son la norma— y
  perdería el vínculo entre un invariante y el CA que lo pidió. El módulo comparte **la
  medida**; la **afirmación** sigue siendo de cada spec.

- **Medir con un umbral de holgura global generoso en vez de exclusiones nombradas.**
  **Rechazada**: una holgura que cubra un desplegable absoluto de 200 px cubre también el
  recorte de 94 px que originó todo esto. Es la forma elegante de apagar la medida.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
