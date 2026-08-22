---
id: EPIC-005
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-22, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-08-21, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# EPIC-005 — Gobernar la vigilada que ya existe: ajustar sus zonas y silenciarla sin destruirla

## Objetivo
Hoy una acción vigilada es **inmutable**: nace con sus cuatro números y lo único que
se puede hacer con ella después es destruirla. `src/app/vigiladas/actions.ts` expone
exactamente dos operaciones —`watchAction` (alta) y `removeAction` (baja)— y no hay
tercera. Esta épica entrega la capacidad que falta: **cambiar de opinión sobre una
vigilada sin perderla**.

Son dos gestos, no uno:

- **Ajustar sus zonas.** Una zona de compra es una hipótesis sobre el precio, y las
  hipótesis se corrigen: el valor se mueve, lees algo, decides entrar más abajo. Hoy
  eso obliga a borrar y volver a crear.
- **Callarla un tiempo.** A veces la vigilada sigue siendo buena pero el aviso sobra:
  el valor está lejos, o simplemente no quieres oírla ahora. Hoy la única forma de no
  oír una vigilada es no tenerla.

**Por qué es capacidad nueva y no una mejora.** EPIC-MEJORA deja fuera, con estas
palabras, *"una acción que la app no sabe hacer: es alcance nuevo, va a su épica de
producto"*, y su CE-M1 exige que ninguna spec suya altere un dato o una regla de
negocio. Esto hace las dos cosas: escribe datos y crea reglas. EPIC-001, que sería su
casa natural, está en `hecho`.

**Por qué ahora, y por qué no es solo comodidad.** El apaño actual —borrar y recrear—
**no es equivalente** a editar, y el propio ADR-017 explica por qué: los episodios de
zona son **derivados** y caen en cascada con la vigilada (`zone_triggers` tiene
`onDelete: 'cascade'` sobre `watched_symbols`). Consecuencias observadas en el esquema:

1. **Te vuelve a avisar de algo de lo que ya te avisó.** Al recrear la vigilada no hay
   episodio abierto; si el precio está dentro de la zona, el motor lo lee como entrada
   nueva (ADR-005, *edge-triggered*) y dispara otro aviso. Ajustar un rango de 12,00 a
   12,50 —un gesto que no debería significar nada— produce una notificación.
2. **El historial queda huérfano.** Los avisos sobreviven (`notifications.zoneTriggerId`
   es `onDelete: 'set null'`), pero pierden el episodio que los explicaba.
3. **La vigilada miente sobre su edad.** `createdAt` vuelve a hoy: una acción que sigues
   desde hace tres meses aparenta haber nacido esta mañana.

Y hay un motivo de calendario: EPIC-004 abre la app a **testers externos**, que llegan
sin saberse el producto y van a ajustar rangos mucho más que su autor, que ya los tenía
puestos. El primero que quiera mover una zona descubrirá que la app le pide destruir su
propia vigilancia para hacerlo.

**Para quién.** Hoy, el humano que usa la app a diario. A partir de EPIC-004, cualquier
tester con una lista viva de vigiladas.

## Criterios de éxito
Medibles, verificables por spec.

- **CE-1 — Ajustar una zona no destruye nada.** Tras cambiar cualquiera de los cuatro
  valores, la vigilada conserva su identidad: su antigüedad, sus episodios y sus avisos
  siguen siendo suyos. Medida: binario, verificable en test — editar y borrar+recrear
  dejan de ser el mismo camino.
- **CE-2 — La edición no genera ruido; solo el precio lo genera.** Un cambio de rangos
  **nunca** produce por sí mismo un aviso duplicado. Si tras el cambio el precio sigue
  dentro de la zona, el episodio abierto **continúa** y no se vuelve a avisar; si el
  cambio lo deja fuera, el episodio se cierra; si estaba fuera y el cambio lo mete
  dentro, eso sí es una entrada y se avisa como tal. Medida: binario, con los tres casos
  cubiertos en test. *(Decidido contigo el 2026-08-22.)*
- **CE-3 — Se puede callar una vigilada sin cegarla.** Una vigilada silenciada deja de
  avisar, pero **sigue viva**: su precio se actualiza cada ciclo y su estado real se ve
  en la tabla. Silenciar no es un borrado blando ni una forma de ahorrar cuota. Medida:
  binario, verificable en test y en pantalla. *(Decidido contigo el 2026-08-22.)*
- **CE-4 — Al reactivar, la app cuenta lo que pasó mientras callaba.** Si durante el
  silencio la acción entró en zona y sigue dentro, al reactivarla el usuario **se entera**
  —y se entera de cuánto lleva así—, no empieza a contar de cero. El silencio suprime el
  aviso, no el conocimiento. Medida: binario, verificable en test. *(Decidido contigo el
  2026-08-22.)*
- **CE-5 — Cero regresión sobre la promesa de EPIC-001.** Para una vigilada que nadie
  edita ni silencia, la vigilancia se comporta **exactamente** como hoy: mismos disparos,
  mismos avisos, mismo estado. Medida: la suite de EPIC-001 sigue en verde sin tocarla.

## Alcance
- **Dentro:**
  - **Editar los cuatro valores de zona** (`buyMin`, `buyMax`, `sellMin`, `sellMax`) de
    una vigilada existente, incluido **vaciar una zona entera** — RN-10 de SPEC-003 ya
    las declara opcionales e independientes, así que dejar de vigilar la compra sin dejar
    de vigilar la venta debe poder hacerse editando.
  - **Silenciar y reactivar** una vigilada, con el significado que fija CE-3.
  - **La continuidad del episodio** a través de una edición y a través de un silencio:
    es la regla de negocio nueva que esta épica introduce, y es lo que separa CE-2 y CE-4
    de un simple formulario.
  - **Cómo se ve en `/vigiladas`** una vigilada silenciada: que se distinga sin
    esconderse, porque sigue teniendo estado real que mostrar.
  - Las **mismas validaciones que el alta** aplicadas a la edición (coma decimal,
    min ≤ max, mensajes que distinguen el dato del fallo — SPEC-030 ya las resolvió una
    vez; la edición no puede ser una puerta trasera con reglas más flojas).
- **Fuera (aparcado a propósito, no por descuido):**
  - **Cambiar el símbolo de una vigilada.** `ITX` convertido en `SAN` no es la misma
    vigilada editada: es otra. La identidad es `(userId, symbolId)` por clave única, y el
    camino sigue siendo baja + alta. Editar el símbolo tendría que decidir además qué pasa
    con los episodios del símbolo viejo, y no hay caso que lo pida.
  - **Pausa con vencimiento** ("reactívala sola el día 15"). Descartado contigo el
    2026-08-22: añade un concepto de tiempo que hoy no existe en ninguna parte del
    producto. Se reabre si alguien lo pide de verdad.
  - **Que el silencio ahorre cuota del proveedor.** Descartado contigo el 2026-08-22 al
    elegir "calla, pero sigue viva". Es tentador —ADR-027 mide el presupuesto en símbolos
    por ciclo— pero congelaría el precio y obligaría a explicar en la tabla que ese dato
    es viejo a propósito. Se reabre si la cuota aprieta.
  - **Historial de cambios de zona** ("antes tenías 12,00–14,00"). Nadie lo ha pedido y
    es esquema nuevo al servicio de una curiosidad.
  - **Deshacer una edición.** Consecuencia de lo anterior: sin historial no hay deshacer.
  - **Edición masiva o multi-selección** ("baja un 5% todas mis zonas"). Optimiza un gesto
    que aún no sabemos que sea frecuente.
  - **Preferencias de notificación por canal o frecuencia** (F-SPEC-006-2): silenciar
    *una vigilada* no es configurar *cómo avisa la app*. Sigue en "Más adelante".
  - **Editar la cartera** (transacciones, precios de compra). Otro dominio, otra épica.
  - **Rediseño de `/vigiladas`.** Esta épica añade dos acciones a esa pantalla y respeta
    lo que SPEC-039, SPEC-040 y SPEC-041 dejaron decidido sobre ella.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

> **Propuesta orientativa de sdd-producto** — el desglose real, sus fronteras y su
> numeración son de **sdd-arquitecto**. Se escribe solo para dar tamaño:
>
> 1. **Ajustar las zonas de una vigilada sin perder su episodio** (CE-1, CE-2, CE-5).
> 2. **Silenciar y reactivar una vigilada, y lo que se cuenta al volver** (CE-3, CE-4, CE-5).
>
> Van en este orden porque la segunda **hereda la regla de continuidad** que fija la
> primera: si el episodio no sabe sobrevivir a una edición, tampoco sabrá sobrevivir a un
> silencio. Se pueden partir de otro modo, pero no invertir.

## Riesgos
- **R-1 — La continuidad del episodio a través de un cambio es regla nueva sobre ADR-005.**
  ADR-005 fijó episodios *edge-triggered*: se abre uno al **entrar** en zona y se cierra al
  salir. CE-2 introduce un tercer suceso que ese modelo no contempla — **la zona se movió
  debajo del precio, sin que el precio se moviera**— y CE-4 introduce un cuarto: un
  episodio que existió mientras nadie escuchaba. Esperable que sdd-arquitecto necesite
  **ADR propio** (enmienda o sucesor de ADR-005). Si resulta que no hace falta, mejor;
  pero la épica no debe presuponerlo.
- **R-2 — "Silenciada" es estado nuevo en `watched_symbols`: hay migración.** No existe
  hoy ninguna columna donde vivir. Es esquema, con todo lo que eso arrastra (SPEC-032:
  nada migra sin permiso, ningún `drop` pasa mudo) y con el aviso ya registrado en el
  roadmap: **Preview comparte la BD de producción**, así que una PR de esta épica migra
  producción. Debe planificarse a sabiendas.
- **R-3 — El digest diario no sabe de silencios.** SPEC-006 entrega aviso individual y
  digest. Una vigilada silenciada tiene que desaparecer de **los dos**, o el silencio será
  mentira el primer día que se agrupe. Es fácil de olvidar porque el digest se construye
  aparte del disparo.
- **R-4 — Alcance rampante: "editar" invita a todo.** En cuanto exista un formulario de
  edición aparecerán el historial, el deshacer y la edición masiva. La lista de "fuera"
  es larga a propósito: cada uno de esos se aparcó con su razón, no por descuido.
- **R-5 — `/vigiladas` es la pantalla más tocada del producto.** SPEC-039 (ayuda y estados
  vacíos), SPEC-040 (el alta en móvil y la guardia de geometría) y SPEC-041 (nombre del
  activo, orden y alta plegable) han pasado todas por ahí en las últimas semanas. Meter
  dos acciones nuevas por fila tiene coste de espacio real, y ADR-026 obliga a medir la
  geometría elemento a elemento: `overflow: hidden` no es un arreglo.
- **R-6 — El silencio puede tapar la promesa del producto.** Una vigilada callada que el
  usuario olvidó reactivar es exactamente el fallo que EPIC-FIX persiguió durante ocho
  specs: la app deja de avisar y **el usuario no se entera de que no le avisa**. CE-3
  exige que siga viéndose en la tabla precisamente por esto, pero la spec tiene que
  tratarlo como requisito, no como detalle visual.
