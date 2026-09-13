---
id: EPIC-009
tipo: epica
estado: aprobada
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-09-12, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-09-13, por: humano (Alberto Fojo)}
---
# EPIC-009 — El contexto que el usuario pone a una vigilada: la nota y los enlaces

## Objetivo
Que una vigilada pueda llevar encima **por qué la vigila**: una **nota** escrita por su
dueño y **los enlaces** a los sitios donde la analiza (TradingView, el hilo del foro, el
informe del broker). Hoy la app guarda **los números del usuario** —las zonas— y **tira su
razonamiento**: el porqué vive en una pestaña abierta, en un marcador o en la cabeza, y se
pierde entre el día en que se fija la zona y el día, semanas después, en que salta el aviso.

Es **capacidad nueva**: dato que no está en la base y acción que la app no sabe hacer.

### El roce, en palabras del humano (2026-09-12, Alberto Fojo)
> *«Me gustaría añadir a cada vigilada: una nota, uno o varios enlaces (por ejemplo a
> tradingview, un foro, etc.)»*

La mecánica que lo produce, sobre el código de hoy y no supuesta:

- Lo único que un usuario puede escribir sobre una acción son **cuatro números**:
  `buy_min`, `buy_max`, `sell_min`, `sell_max` (`watched_symbols`, `src/db/schema.ts:174`).
  No hay ni un campo de texto suyo en toda la vigilancia.
- El resto de columnas del símbolo —`name`, `micCode`, `instrumentType`— son **metadato del
  proveedor**, compartido entre usuarios (ADR-007): no son suyas y no puede escribirlas.
- Así que la pregunta que se hace quien abre `/vigiladas` un mes después —*«¿por qué puse
  yo esta zona aquí?»*— **no tiene respuesta dentro de la app**, y el aviso que llega por
  correo llega igual de mudo.

### Por qué cuelga del símbolo del usuario y no de la vigilada
Decisión del humano del **2026-09-12**, elegida sobre las tres opciones que se le
presentaron: la nota y los enlaces son **del usuario sobre un símbolo**, no de la fila de
`watched_symbols`.

Lo que compra: **sobreviven a dejar de vigilar**. Quitar de vigiladas es hoy una acción
limpia y reversible (SPEC-024, ADR-017: los episodios son derivados, el historial de avisos
se conserva) y sería un mal negocio que borrase en silencio el trabajo de análisis de su
dueño — precisamente el dato que más caro le ha salido. Y compra un segundo efecto que el
humano pidió expresamente: **la misma nota se ve en Cartera**, donde la pregunta *«¿por qué
compré yo esto?»* es todavía más frecuente que en Vigiladas.

Lo que cuesta, y queda escrito para que la spec lo resuelva en vez de descubrirlo: hace
falta decidir **qué borra la nota** (no la quita de vigiladas; sí el borrado de cuenta,
ADR-022), y el dato queda **vivo sin nadie que lo enseñe** si el usuario no vigila ni tiene
la posición. Ninguna de las dos es una pregunta difícil; las dos tienen que estar contestadas
por escrito antes de la primera migración.

### Por qué no cabe en ningún *bucket*
Las tres candidatas, con su razón:

- **EPIC-MEJORA** se excluye por su propio texto: *«si al mejorar la presentación aparece un
  dato que no está en la base de datos o una acción que la app no sabe hacer, es alcance
  nuevo»*, y aquí fallan **las dos**. Su **CE-M3** remata: una mejora que necesita
  **migración de esquema** no es una mejora.
- **EPIC-FIX** es lo que está **roto**. Esto no lo está: la app nunca prometió guardar el
  porqué.
- **EPIC-INFRA** es salud técnica. Esto es producto visible.

### Por qué épica propia y no una spec suelta
Porque abre una **superficie**: en cuanto el usuario puede escribir sobre un símbolo,
aparecen vecinos evidentes —la nota en el correo del aviso, notas por operación en cartera,
adjuntos, recordatorios con fecha— y esta épica es el sitio donde se gobiernan **cuando se
pidan**. Hoy entra lo observado y nada más (ver Alcance).

## Criterios de éxito
- **CE-1 — El porqué viaja con la acción.** Sobre una acción vigilada, el usuario puede
  escribir una **nota** y **uno o varios enlaces** con su etiqueta, y los vuelve a
  encontrar **donde mira la acción**, sin abrir otra pantalla ni recordar dónde los guardó.
  Medida: binario, verificable en test y en pantallazo.
- **CE-2 — La fila dice que hay contexto sin obligar a abrirlo.** Quien recorre `/vigiladas`
  **ve de un vistazo** qué acciones llevan nota o enlaces y cuáles no. Una nota que hay que
  buscar fila a fila es una nota que no se lee. Medida: binario, verificable en test y en
  pantallazo.
- **CE-3 — Lo escrito sobrevive a dejar de vigilar.** Quitar la acción de vigiladas **no
  borra** su nota ni sus enlaces, y volver a vigilarla los devuelve tal como estaban. Lo
  único que se los lleva es el **borrado de cuenta** (ADR-022), que se los lleva enteros.
  Medida: binario, verificable en test.
- **CE-4 — Un enlace del usuario no es un vector.** El texto de la nota **nunca** se
  interpreta como marcado, y un enlace solo puede ser **`http` o `https`**: los demás
  esquemas se rechazan al guardar, con motivo visible y sin tragárselos en silencio. La app
  **no visita** los enlaces del usuario —ni para validarlos, ni para sacar su título, ni para
  previsualizarlos—. Medida: binario, con especímenes en las **dos** direcciones (lo que
  debe rechazarse y lo que no) y verificable en test.
- **CE-5 — Aislamiento y migración, sin sorpresas.** La nota y los enlaces son de **un solo
  usuario** (RN-01) y ninguna lectura los cruza; la migración es **aditiva y compatible hacia
  atrás** (RI-01), porque abrir una PR migra producción (`F-SPEC-023-1`). Medida: binario,
  verificable en test.

## Alcance
- **Dentro:**
  - Una **nota** de texto llano por usuario y símbolo, editable y borrable por su dueño.
  - **Varios enlaces** por usuario y símbolo, cada uno con su **etiqueta** legible, en un
    orden estable; se añaden, se editan y se borran.
  - La **señal en la fila** de `/vigiladas` de que esa acción lleva contexto (CE-2), y su
    lectura y edición **ancladas al gesto** que ya abre la fila (ADR-030, SPEC-046).
  - **Verlos también desde Cartera**, que es la consecuencia directa de colgarlos del
    símbolo y lo que el humano pidió al elegir esa forma.
  - Los **límites escritos** —cuántos enlaces y cuánto texto— como decisión, no como
    descuido de un `textarea` sin fondo.
- **Fuera (aparcado a propósito, no por descuido):**
  - **La nota dentro del correo de aviso.** Es el vecino más tentador y no está observado;
    además toca las plantillas de ADR-036 y el aviso agregado. Entra cuando se pida.
  - **Traer el título, el icono o una previsualización del enlace.** Obligaría a la app a
    **visitar una URL que escribe el usuario** desde el servidor, que es superficie de SSRF
    y coste de red por fila. Explícitamente prohibido en CE-4.
  - **Marcado enriquecido** (Markdown, HTML, negritas), adjuntos, imágenes y ficheros.
  - **Notas por operación** en cartera (sobre una compra o una venta concretas) y **notas
    fechadas / diario**. Esto entrega *el porqué vigente*, no un histórico.
  - **Compartir** la nota con otro usuario, exportarla o publicarla. RN-01 sigue entero.
  - **Buscar o filtrar** por el texto de la nota. Con listas de decenas de filas no está
    observado; se reabre cuando alguien tenga cien.
  - **Recordatorios** con fecha, o cualquier cosa que **avise** por la nota: eso cambiaría
    la promesa del producto (D-1/D-2) y necesitaría su propio gate.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

> **Propuesta orientativa de sdd-producto** — el desglose real, sus fronteras y su
> numeración son de **sdd-arquitecto**:
>
> 1. **La nota y los enlaces del símbolo, en Vigiladas**: esquema aditivo, escritura y
>    borrado desde el panel que ya abre la fila, la señal en la fila y las guardias de
>    CE-4. Es la spec que carga con la migración y con el modelo.
> 2. **Cartera enseña el mismo contexto**: solo lectura sobre lo que la primera entregó,
>    más el enlace a editarlo. Se separa porque es otra pantalla y otro rol de la misma
>    información, no porque sea mucho trabajo.

## Riesgos
- **R-1 — Esquema nuevo en un repositorio donde abrir una PR migra producción.** Es la
  salvedad viva `F-SPEC-023-1`: `DATABASE_URL` es compartida entre Production y Preview. La
  migración tiene que ser **aditiva y compatible hacia atrás** (RI-01) y pasar por las
  guardias de SPEC-032 (`db:scan`, nada se migra sin permiso, ningún `drop` mudo).
- **R-2 — `/vigiladas` es la superficie más disputada del repositorio.** El panel que abre
  la fila lo fijó SPEC-046/ADR-030 y **SPEC-045** (silenciar, EPIC-005) está **aprobada y sin
  implementar** sobre ese mismo panel. Quien llegue el segundo **rebasa y reconcilia**, y el
  panel no se rediseña por el camino: se le añade un sitio.
- **R-3 — Texto libre del usuario es superficie de seguridad, aunque sea suya.** El riesgo
  no es que se ataque a otro —RN-01 lo impide— sino que la app **ejecute** lo que su dueño
  pegó sin querer, o que un enlace `javascript:` se convierta en un clic armado dentro de su
  propia sesión. CE-4 es el criterio que lo cierra, y se verifica con especímenes, no con
  buenas intenciones.
- **R-4 — El alcance crece solo.** Adjuntos, Markdown, títulos automáticos, notas por
  operación, recordatorios: todos son un paso pequeño desde aquí y ninguno está observado.
  La lista de «Fuera» de arriba es el corte, y mover algo de ahí a «Dentro» es una decisión
  del humano, no del implementador.
- **R-5 — Es alcance nuevo por delante de lo comprometido, y conviene que conste.**
  **SPEC-045** lleva aprobada y sin implementar desde el 2026-08-21, y **EPIC-006** sigue en
  `borrador` sin firmar. Esta épica **nace hoy a petición del humano** y no de un criterio de
  corte. Si prefiere que espere, baja a "Después" con un renglón.
- **R-6 — El dato puede quedarse sin pantalla que lo enseñe.** Colgarlo del símbolo (y no de
  la vigilada) hace que, si el usuario deja de vigilar **y** no tiene posición, su nota siga
  viva y **sin sitio donde verse**. No es una fuga —es suya, aislada y la borra su cuenta—
  pero la spec tiene que decir qué pasa: o hay una puerta para recuperarla, o se dice al
  quitar de vigiladas que lo escrito se conserva. Lo que no vale es que desaparezca sin
  decirlo.
