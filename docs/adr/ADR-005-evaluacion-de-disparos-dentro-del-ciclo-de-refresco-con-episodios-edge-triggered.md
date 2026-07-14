---
id: ADR-005
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-arquitecto}
---
# ADR-005: Evaluación de disparos dentro del ciclo de refresco con episodios edge-triggered

- Deciders: propone sdd-arquitecto; pendiente de aprobación del humano (gate). Dominio: sdd-mercados (base de precio y semántica de zona).
- Specs relacionadas: la origina **SPEC-005** (Motor de disparo por zonas). Consume la ingesta de **SPEC-004** (tabla `quote`), el predicado de zona de **SPEC-003** (`entraEnZona`/`zonasEntradas`) y las zonas de `watched_symbols`. La consumirá la spec de **Notificaciones** (CE-2).

## Contexto
El motor de disparo (D-2/D-3, CE-1) debe detectar cuándo la cotización de una acción
vigilada entra en su zona de compra o de venta y registrar ese evento para que la spec
de notificación avise al usuario. Dos decisiones no triviales:

1. **Dónde se engancha la evaluación.** La ingesta (SPEC-004) ya corre 1×/día por
   Vercel Cron y persiste la última cotización por símbolo. La evaluación de zonas
   necesita exactamente esos precios frescos. ¿Se evalúa en el MISMO ciclo (tras el
   upsert de cotizaciones) o en un proceso/cron separado?

2. **Cómo se evita el re-disparo.** Si un precio permanece dentro de la zona varios
   ciclos seguidos, evaluar "está dentro" cada día generaría un disparo (y un aviso)
   diario por el mismo evento. El usuario quiere saber que **entró** en zona, no que
   **sigue** en zona. Hace falta una regla de idempotencia/anti-spam (RN-13).

## Decisión
1. **Evaluación acoplada al ciclo de refresco.** Tras el upsert de cotizaciones del
   refresco (SPEC-004), en la MISMA ejecución de cron, el motor evalúa las zonas de las
   acciones vigiladas contra las cotizaciones recién persistidas. Una sola cadencia, un
   solo scheduler, precios y evaluación siempre coherentes (sin ventana de desfase que
   arriesgue CE-1). El endpoint protegido sigue siendo el de SPEC-004 (`CRON_SECRET`).

2. **Disparo edge-triggered por episodios (RN-13).** Por cada par (acción vigilada,
   tipo de zona ∈ {compra, venta}) se modela un **episodio** en la tabla `zone_trigger`:
   - Al evaluar, si el precio **entra** en la zona (RN-11) y NO hay episodio abierto para
     ese par → se **abre** un episodio (= el disparo): se persiste `openedAt`, precio y
     `asOf` que lo originaron. Esto es el evento que la notificación consumirá.
   - Si el precio **ya no** está en la zona y hay un episodio abierto → se **cierra**
     (`closedAt` = `asOf` del ciclo).
   - Si sigue dentro con episodio abierto, o sigue fuera sin episodio → no-op.

   Así el disparo salta solo en la TRANSICIÓN fuera→dentro; mientras permanezca dentro no
   se repite, y vuelve a armarse tras salir. La fila abierta (`closedAt` null) ES el
   estado actual: reevaluar el mismo ciclo es idempotente (no duplica).

3. **Base de precio y `asOf`.** Se compara la zona contra el último cierre NO ajustado
   (RN-12, la misma base con la que el usuario definió la zona; dictamen sdd-mercados) y
   el disparo lleva el `asOf` de esa cotización (D-2), disponible para mostrarse.

4. **Símbolo sin cotización ese ciclo.** Si la ingesta saltó un símbolo (CA-6 de
   SPEC-004), no hay precio nuevo: ese par no se evalúa este ciclo (no abre ni cierra
   episodio). No es una "zona perdida" (no hay dato), y se recupera en el siguiente ciclo
   con dato. Aislamiento por usuario (RN-01): los episodios pertenecen al dueño de la
   watchlist.

## Consecuencias
### Positivas
- CE-1 sin ventana de desfase: se evalúa con el precio del propio ciclo.
- Sin spam: un aviso por entrada, no por permanencia (RN-13); re-armado natural.
- `zone_trigger` es a la vez log de eventos y estado (fila abierta = dentro ahora):
  simple, idempotente, y ya deja el evento listo para la spec de notificación.
- Reusa piezas probadas: `entraEnZona`/`zonasEntradas` (SPEC-003) y `quote` (SPEC-004).

### Negativas / follow-ups
- Acoplar evaluación e ingesta en un endpoint hace ese paso más largo; si el volumen de
  símbolos crece mucho habrá que trocearlo (follow-up, igual que el batch de ingesta).
- La cadencia diaria hereda el límite de D-2: un precio que entra y sale de la zona DENTRO
  del mismo día (sin intradía) puede no verse; aceptable por D-2/RN-11 (sin "tocar"), se
  documenta como salvedad.
- El histórico de episodios crece; purga/retención queda a futuro (no afecta v1).

## Alternativas consideradas
- **Cron separado para disparos:** desacopla, pero añade un segundo scheduler, otra
  ventana de coherencia precio↔evaluación y más superficie de fallo para CE-1; rechazado.
- **Disparo por nivel (cada ciclo dentro de zona genera evento):** trivial, pero produce
  avisos diarios repetidos por el mismo evento; contradice el valor "avisar de la entrada";
  rechazado (origen de RN-13).
- **Estado in/out como columnas en `watched_symbols`:** mezcla configuración del usuario con
  estado de evaluación y no deja log de eventos para la notificación; rechazado a favor de
  una tabla `zone_trigger` dedicada.
- **Evaluar contra precio ajustado:** descuadra con zonas y coste base no ajustados del
  usuario (RN-12); rechazado (coherente con ADR-004, dictamen sdd-mercados).

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
