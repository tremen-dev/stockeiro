---
id: EPIC-006
tipo: epica
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-22, por: sdd-producto}
---
# EPIC-006 — El historial de una vigilada

## Objetivo
Hoy una vigilada solo sabe decir **cómo está**. Esta épica le enseña a decir **cómo ha
estado**: cuándo entró en zona, cuándo salió, a qué precio y cuánto aguantó dentro.

No es una idea nueva que haya que inventar de cero. Es **dato que la app ya calcula, ya
guarda y hoy tira a la basura**:

- `zone_triggers` (`src/db/schema.ts:257`) guarda por episodio `zoneKind` (compra/venta),
  `price` que lo disparó, `asOf` de la cotización, `openedAt` y `closedAt`. Entrada,
  salida, precio y duración: los cuatro datos que hacen falta, ya escritos.
- `src/lib/triggers/service.ts:109` **cierra los episodios cada ciclo**
  (`.set({ closedAt: c.asOf })`) y su función devuelve explícitamente
  `{ opened, closed }` (línea 117). La salida no es que no se sepa: **se detecta, se
  persiste y se retorna**.
- Y ahí muere. `src/lib/notifications/service.ts` solo crea dos clases de aviso:
  `kind: 'entry'` (línea 107) y `kind: 'digest'` (línea 146). **No hay ninguna
  notificación de salida, en ningún canal.**

De modo que el producto tiene, para cada acción vigilada, la historia completa de sus
entradas y salidas — y **ninguna pantalla la enseña**. `/avisos` se le parece pero no lo
es: es una bandeja **plana y transversal** de *avisos* (`src/app/avisos/page.tsx`,
`KIND` = `entry` | `digest`), ordenada por fecha y mezclando todas las acciones. Responde
"¿qué me han notificado?", no "¿qué ha hecho **esta** acción?".

**Por qué ahora.** Dos razones, y ninguna es "porque queda bonito":

1. **Es el único trozo del comportamiento de una vigilada que el usuario no puede ver.**
   El precio actual está en `/vigiladas`, el estado de zona está en `/vigiladas`, las
   entradas están en `/avisos`. **Las salidas no están en ninguna parte**, pese a estar
   en la base de datos. Es un agujero de información, no una carencia estética.
2. **EPIC-004 abre la app a testers externos.** Un tester que lleva dos semanas con una
   acción vigilada y quiere saber si su zona estaba bien puesta no tiene forma de
   averiguarlo. El autor tampoco, pero el autor se acuerda; el tester no tiene de qué
   acordarse.

**Por qué es épica propia y no cabe en las que ya hay.** Se comprobaron las tres
candidatas antes de crearla:

- **EPIC-MEJORA** la excluye por su propia frontera: deja fuera *"una acción que la app no
  sabe hacer"*. Enseñar el historial no es hacer más legible `/vigiladas` — es responder
  una **pregunta distinta**, en una superficie que no existe. Que el dato ya esté guardado
  no lo convierte en presentación: CE-M4 mide que la tabla se lea de un vistazo, y esto no
  toca esa medida.
- **EPIC-005** gobierna *actuar* sobre la vigilada (ajustar sus zonas, silenciarla). Su
  objetivo escrito es *"cambiar de opinión sobre una vigilada sin perderla"*. Consultar su
  pasado no es cambiar de opinión. Además su lista de "fuera" aparca el **historial de
  cambios de zona**, y meter aquí un historial de *episodios* dentro de EPIC-005
  emborronaría esa frontera justo después de haberla trazado.
- **EPIC-001** entregó la vigilancia y está en `hecho`.

**Para quién.** El inversor particular de `vision.md`: el que pone zonas que vienen de un
análisis de terceros y necesita saber si esas zonas le están sirviendo. Hoy, el humano que
usa la app a diario; a partir de EPIC-004, cualquier tester con vigiladas con recorrido.

## Criterios de éxito
Medibles, verificables por spec.

- **CE-1 — Cada vigilada sabe contar lo suyo.** Para una vigilada concreta se pueden ver
  sus episodios de zona: si fue de compra o de venta, cuándo empezó, cuándo terminó, a qué
  precio se disparó y cuánto duró. Medida: binario, verificable en test y en pantalla, con
  episodios reales de `zone_triggers`.
- **CE-2 — La salida deja de ser invisible.** Un episodio ya cerrado se ve **como cerrado**,
  con su fecha de salida. Es el dato que hoy no aparece en ninguna pantalla del producto
  pese a estar persistido. Medida: binario — existe al menos una vista donde un episodio
  con `closedAt` no nulo se distingue de uno abierto.
- **CE-3 — El episodio abierto se reconoce sin leer fechas.** Una acción que **sigue dentro**
  de su zona ahora mismo se distingue de una que estuvo y salió, sin que el usuario tenga que
  comparar `closedAt` contra hoy. Medida: binario, verificable en pantalla.
- **CE-4 — Ni un dato nuevo, ni una regla nueva.** Esta épica **lee**: no crea tablas, no
  cambia el motor de disparo, no altera cuándo se avisa ni de qué. Medida: cero migraciones y
  la suite de EPIC-001 en verde sin tocarla. *(Decidido contigo el 2026-08-22: solo el
  episodio, lo que ya se guarda.)*
- **CE-5 — Sin historia no se inventa historia.** Una vigilada recién creada, o anterior a que
  el motor registrase episodios, dice **que no tiene historial** — no enseña una tabla vacía sin
  explicar, ni un cero que parezca un dato. Misma regla que ya aplican SPEC-029 y SPEC-039 a los
  huecos y a los estados vacíos. Medida: binario, verificable en test.

## Alcance
- **Dentro:**
  - **El historial de episodios de una vigilada**: lista de sus entradas y salidas de zona,
    con tipo de zona, precio de disparo, fecha de entrada, fecha de salida y duración.
  - **La distinción abierto/cerrado**, que es lo que convierte una lista de fechas en una
    historia legible (CE-3).
  - **Dónde vive y cómo se llega**: si es una pantalla propia, un panel por fila o una
    ampliación de `/avisos` filtrable por acción, lo decide **sdd-arquitecto**. Lo que esta
    épica fija es que se llegue **desde la vigilada**, porque la pregunta nace mirándola.
  - **Los avisos que ya cuelgan del episodio.** `notifications.zoneTriggerId` existe y hoy
    solo se usa hacia atrás; si ayuda a contar la historia, se usa. Es dato existente.
- **Fuera (aparcado a propósito, no por descuido):**
  - **Avisar de la salida de zona.** Tentador —el dato está y el hueco es evidente— pero
    **cambia la promesa del producto**. `vision.md` promete avisar *"cuando una acción entra
    en su zona"*, y ADR-005 fijó el modelo *edge-triggered* sobre esa promesa. Añadir un aviso
    de salida es alcance de notificación, no de historial: se decide aparte, con su propio gate,
    y probablemente arrastre preferencias por canal (F-SPEC-006-2, que sigue en "Más adelante").
    Esta épica **cuenta** la salida; no la **notifica**.
  - **Historial de cambios de zona** (*"antes tenías 12,00–14,00"*). Sigue fuera, con la misma
    razón que le puso EPIC-005: no está guardado en ninguna parte, exige tabla nueva y escritura
    en cada edición. Confirmado contigo el 2026-08-22 al elegir "solo el episodio".
  - **Deshacer una edición.** Consecuencia de lo anterior: sin ese historial no hay deshacer.
  - **Gráfico de la cotización en el tiempo.** La app **no guarda serie histórica de precios**:
    guarda el precio que disparó cada episodio (`zone_triggers.price`) y la última cotización.
    Dibujar una curva exigiría almacenar series y probablemente cuota nueva del proveedor. Es
    otra épica, con su ADR.
  - **Estadísticas y juicio sobre la zona** (*"tu zona de compra acierta el 70%"*). Eso es
    análisis, y `vision.md` dice explícitamente que el producto **no genera recomendaciones ni
    calcula las zonas**. Contar lo que pasó es historial; puntuarlo es asesorar.
  - **Exportar el historial** (CSV, informe). Nadie lo ha pedido.
  - **Historial de la cartera** (movimientos, ventas, dividendos). Otro dominio.
  - **Rediseño de `/vigiladas`.** Esta épica respeta lo que SPEC-039, SPEC-040, SPEC-041 y
    SPEC-044 dejaron decidido sobre esa pantalla, y lo que SPEC-045 decida.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

> **Propuesta orientativa de sdd-producto** — el desglose real, sus fronteras y su numeración
> son de **sdd-arquitecto**. Se escribe solo para dar tamaño:
>
> 1. **El historial de episodios de una vigilada** (CE-1 a CE-5). Se ve como **una sola spec**:
>    es una lectura sobre una tabla que ya existe, sin migración y sin regla de negocio nueva.
>    Si al especificarla resulta que la superficie donde vive obliga a decidir el layout de
>    `/vigiladas`, es señal de que hay que esperar a SPEC-045, no de que haya que partirla.

## Riesgos
- **R-1 — El precio guardado no está ajustado por splits.** `zone_triggers.price` lleva escrito
  en el propio esquema *"precio que originó el disparo (RN-12, no ajustado)"*
  (`src/db/schema.ts:269`). Un episodio anterior a un split enseñará un precio que **no se puede
  comparar** con el de hoy, y el usuario leerá una caída o una subida que nunca ocurrió. Es el
  riesgo más serio de la épica porque **parece un dato correcto**. La spec tiene que decidir qué
  se enseña y qué se advierte; consúltese `sdd-mercados`, que es la autoridad de dominio.
- **R-2 — Colisión y sinergia con SPEC-045.** SPEC-045 (silenciar) está **aprobada y sin
  implementar** sobre `/vigiladas`, y su **CE-4 obliga a contar lo que pasó mientras la vigilada
  callaba** — que es exactamente esta materia prima. Dos specs leyendo `zone_triggers` para
  contarle al usuario lo que pasó, decidiendo por separado cómo se redacta, es una incoherencia
  esperando a ocurrir. **Por eso esta épica va detrás** (ver roadmap): SPEC-045 fija primero cómo
  se cuenta el pasado, y el historial lo hereda en vez de contradecirlo.
- **R-3 — Puede no haber historia que contar.** Los episodios existen desde que el motor los
  registra, y solo para acciones que **hayan entrado en zona alguna vez**. Una lista de vigiladas
  puede estar entera sin un solo episodio. Si la épica se mide con la cartera del autor puede
  parecer rica y estar vacía para un tester nuevo. CE-5 existe por esto.
- **R-4 — El valor es hipótesis, no hecho.** Lo dijiste tú al pedirlo: *"no es obligatorio, me
  gustaría ver si es útil"*. **No hay evidencia de usuario** de que el historial se consulte; hay
  evidencia de que el dato existe y se desperdicia. Se marca como **hipótesis a validar con
  testers**, y su sitio en el roadmap ("Después", detrás de todo lo comprometido) es consecuencia
  directa de eso. Si tras EPIC-004 ningún tester lo echa de menos, es candidato legítimo a no
  hacerse.
- **R-5 — Alcance rampante hacia el análisis.** En cuanto exista una pantalla de historial pedirán
  el gráfico, el porcentaje de acierto y la comparación entre zonas. La lista de "fuera" es larga a
  propósito, y la frontera es de `vision.md`, no de gusto: **el producto no asesora**.
