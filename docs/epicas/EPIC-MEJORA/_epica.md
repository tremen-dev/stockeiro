---
id: EPIC-MEJORA
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-20, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-08-20, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# EPIC-MEJORA — Mejoras de presentación y usabilidad

## Objetivo
Épica **bucket** (transversal, no de producto nuevo) que agrupa las **mejoras**:
casos en que una capacidad **ya entregada y verificada cumple su promesa**, pero
cuesta más de lo debido usarla, leerla o entenderla. No restaura nada roto — eso es
EPIC-FIX — ni protege la salud técnica — eso es EPIC-INFRA: **baja la fricción** de
lo que ya funciona.

Por qué existe ahora, y no antes: hasta hoy la app tenía **un solo usuario, que es su
autor**. Un autor tolera cualquier interfaz porque sabe lo que hay detrás de cada
celda. EPIC-004 la abre a desconocidos, y en ese momento cada roce deja de ser una
molestia privada y pasa a ser **la razón por la que un tester se va sin dejar
feedback**. Los roces que ya se conocían tienen por fin sitio donde gobernarse con
spec testable, sin reabrir la épica de producto que los entregó ni colarse como
"defecto" en EPIC-FIX, que es donde vive lo que está roto de verdad.

Es **bucket permanente**: no se cierra aunque todas sus specs estén en `hecho`
(decisión del humano, 2026-08-18). Siempre habrá otro roce.

### Caso que la motiva — la tabla de Vigiladas (2026-08-20)
`/vigiladas` es **la pantalla donde vive la promesa** del producto y la única que un
tester ve a diario (EPIC-004 la deja dentro del alcance del rol `tester`). Hoy tiene
tres roces observados por el humano sobre la pantalla real:

1. **La tabla identifica las acciones solo por su código.** La columna `Ticker` da
   `ITX`, `SAN`, `TEF` — y nada más. El nombre del activo **ya está en la base de
   datos** (`symbols.name`, *instrument_name* del proveedor, p. ej. "Microsoft Corp"),
   pero no se enseña. Quien no se sepa los tickers de memoria no reconoce su propia
   lista. Un autor se los sabe; un tester recién llegado del foro, no.
2. **No se puede ordenar.** El orden es fijo por ticker (`orderBy(symbols.ticker)`),
   así que la pregunta que de verdad se hace el usuario cada mañana — *¿cuáles están
   en zona?* — se responde recorriendo la tabla a ojo.
3. **El formulario de alta ocupa la pantalla siempre.** `<WatchForm />` se renderiza
   permanentemente bajo la tabla, tenga el usuario 0 vigiladas o 40. Es un bloque
   grande al servicio de una acción **ocasional**, compitiendo por el espacio con la
   información **de consulta diaria**.

Como ayuda observada para el hueco de (1): la columna `Estado` es la más ancha de la
tabla y su contenido más largo ("En compra y venta") no justifica ese ancho.

### Segundo caso — la app no tiene icono (2026-08-22)
Observado por el humano en la pestaña real del navegador: **Stockeiro no tiene favicon**.
No hay `public/`, ni `src/app/icon.*`, ni `favicon.ico` en el repositorio; `src/app/layout.tsx`
declara `metadata.title` y `metadata.description` y nada más. El navegador cae en su icono por
defecto —el folio en blanco— en cada pestaña, en cada marcador y en cada pantallazo que un
tester comparta en el foro.

**Por qué esto es mejora y no rediseño**, que es la frontera delicada. La lista de "fuera" de
esta épica excluye *"cambiar la identidad gráfica, la tipografía o el sistema de color
completo"*. Aquí no se cambia ninguna de las tres: **la identidad ya existe y está en el
código**. La marca es un *wordmark* montado en `src/app/app-nav.tsx:45` —`Stockeiro` seguido de
un `<span className="dot">.</span>`— con el punto pintado en el color de acento
(`.app-nav .brand .dot { color: var(--accent); }`, `src/app/globals.css:271`). Un icono que sea
**la inicial y ese punto** no inventa identidad: **aplica la que ya hay** a la única superficie
que se quedó sin ella. La intuición del humano al pedirlo —*"una S y un punto"*— coincide
literalmente con el marcado que ya está escrito. Si alguna vez se propusiera un icono que **no**
se derive del wordmark existente, eso sí sería identidad nueva y saldría de esta épica.

**Cuidado con el alcance**, porque este roce es de los que crecen solos: lo observado es la
pestaña vacía. El manifiesto PWA, el *apple-touch-icon*, la imagen de Open Graph para cuando
alguien pegue el enlace en el foro y el *theme-color* son parientes cercanos y **ninguno está
observado**. CE-M2 aplica aquí igual que en la tabla: los delimita sdd-arquitecto al escribir la
spec, y lo que no se justifique se aparca.

## Criterios de éxito
Medibles, por spec. Los tres primeros son de la épica; el cuarto es del caso que la
motiva y se mide sobre `/vigiladas`.

- **CE-M1 — La mejora no cambia lo que la app dice.** Ninguna spec de esta épica
  altera un dato, un cálculo o una regla de negocio: cambia **cómo se presenta**. Toda
  spec cierra demostrando **cero regresión** en los criterios de la épica que entregó
  la capacidad. Medida: binario, verificable en test.
- **CE-M2 — El roce estaba observado, no imaginado.** Cada spec cita **dónde se vio**
  el problema (pantalla real, sesión con un usuario, feedback de tester). No se
  especulan mejoras. Medida: binario, revisable en el gate.
- **CE-M3 — Cabe en una sesión.** Una mejora que necesita migración de esquema,
  proveedor nuevo o decisión de arquitectura **no es una mejora**: es alcance nuevo y
  se va a su épica de producto. Medida: si la spec necesita ADR nuevo, se replantea su
  encaje aquí.
- **CE-M4 — Vigiladas se lee de un vistazo.** Sobre `/vigiladas`, con una lista de
  varias acciones: el usuario **reconoce cada fila sin saberse el ticker**, puede
  **poner arriba lo que le interesa** (por nombre o por estado) sin leer la tabla
  entera, y **la información de consulta no compite** con el formulario de alta.
  Medida: binario, verificable en test y en pantallazo.

## Alcance
- **Dentro:**
  - **Legibilidad**: enseñar dato que **ya existe** y hoy se oculta; jerarquía visual;
    anchos y densidad; etiquetas que se entienden sin contexto previo.
  - **Ordenación, filtrado y agrupación** de listas ya entregadas, cuando el orden fijo
    obliga a leerlo todo.
  - **Economía de la pantalla**: que lo ocasional (formularios de alta, acciones poco
    frecuentes) no ocupe el sitio de lo que se consulta a diario.
  - **Reintentos/backoff finos del proveedor y alerting del ciclo**, heredados de
    EPIC-FIX, que los declaró explícitamente "mejora, no defecto".
- **Fuera (aparcado a propósito, no por descuido):**
  - **Capacidad nueva.** Si al mejorar la presentación aparece un dato que **no está en
    la base de datos** o una acción que la app no sabe hacer, es alcance nuevo: va a su
    épica de producto. Aquí solo se enseña mejor lo que ya se sabe.
  - **Defectos.** Si algo no cumple lo prometido, es EPIC-FIX. La frontera es
    deliberada: mezclar "está roto" con "molesta" hace que lo roto espere turno.
  - **Salud técnica** (CVE, CI, dependencias, esquema): EPIC-INFRA.
  - **Rediseño visual de la app.** Cambiar la identidad gráfica, la tipografía o el
    sistema de color completo no es una mejora incremental: es un proyecto, y hoy no
    hay evidencia que lo pida.
  - **Onboarding guiado / tour multipaso.** Ya lo descartó EPIC-004 y esta épica no lo
    recupera por la puerta de atrás.
  - **i18n.** La app es en español y así se publica (heredado de EPIC-004).
  - **Preferencias de usuario persistidas** (que la app recuerde tu orden, tus columnas
    o tus filtros entre sesiones). Es capacidad nueva con esquema nuevo, no
    presentación. Se reabre cuando un tester lo pida.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

> **Propuesta orientativa de sdd-producto** — el desglose real, sus fronteras y su
> numeración son de **sdd-arquitecto**. Se escribe aquí solo para dar tamaño al caso
> que motiva la épica, no como compromiso:
>
> 1. La tabla de Vigiladas: nombre del activo, ordenación por nombre y por estado, y el
>    alta que solo aparece cuando se va a usar. Los tres roces son la **misma pantalla
>    y el mismo reparto de espacio** — el ancho que suelta `Estado` es el que ocupa el
>    nombre, y el sitio que suelta el formulario es el que gana la tabla. Separarlos en
>    tres specs obligaría a decidir el layout tres veces.

## Riesgos
- **R-M1 — Colisión con SPEC-039, que está en vuelo sobre esta misma pantalla.**
  SPEC-039 (EPIC-004, *ayuda de Vigiladas, estados vacíos y canal de feedback*) toca
  `/vigiladas` **ahora mismo** en otra rama y **no está en `main`**: reescribe
  justamente el estado vacío y el primer paso que el usuario ve. La primera spec de
  esta épica parte de `origin/main`, o sea **sin** esos cambios. **Consecuencia**:
  conflicto de merge probable en `src/app/vigiladas/page.tsx`, y riesgo peor de que
  las dos specs decidan distinto sobre "qué se ve cuando no hay nada". **Decisión del
  humano (2026-08-20): se trabaja en paralelo desde `main`, con worktree propio.**
  Mitigación: quien implemente la segunda en llegar **rebasa y reconcilia**, y el
  estado vacío se trata como territorio de SPEC-039 — esta épica no lo redefine.
- **R-M2 — El nombre del activo puede no existir.** `symbols.name` es **nullable**: es
  metadato del proveedor y los símbolos *legacy* anteriores a ADR-007 no lo tienen. Una
  tabla que asuma nombre siempre enseñará huecos. La spec tiene que decir qué se ve
  cuando falta, y no puede ser un nombre inventado — la misma regla que ya aplica a la
  celda de mercado (SPEC-029).
- **R-M3 — Esconder el alta puede esconder el primer paso.** El formulario está siempre
  visible y eso hoy **funciona como onboarding accidental**: un usuario nuevo no puede
  no verlo. Plegarlo detrás de un botón mejora la pantalla del que ya tiene lista y
  puede empeorar la del que llega con cero. Es exactamente el usuario que CE-1 de
  EPIC-004 mide. Cualquier propuesta tiene que resolver los dos casos, no uno.
- **R-M4 — La mejora compite con lo que aún no está publicado.** EPIC-004 es lo único
  que separa el producto de su primer usuario real. Esta épica es *bucket*: **no
  adelanta a EPIC-004 en el roadmap**, y si el caso que la motiva se cuela antes es
  porque es barato y toca la pantalla que el tester va a mirar — no porque haya
  cambiado la prioridad.
