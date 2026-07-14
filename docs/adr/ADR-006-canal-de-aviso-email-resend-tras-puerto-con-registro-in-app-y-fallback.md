---
id: ADR-006
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-arquitecto}
---
# ADR-006: Canal de aviso — email (Resend) tras un puerto, con registro in-app y fallback

- Deciders: propone sdd-arquitecto (con búsqueda de opciones de canal, 2026-07-14); pendiente de aprobación del humano (gate). Cierra el riesgo R-4 (entrega de notificación) de EPIC-001.
- Specs relacionadas: la origina **SPEC-006** (Notificaciones / aviso proactivo). Consume los disparos de **SPEC-005** (`zone_triggers`) y el ciclo de cron de **SPEC-004/ADR-005**.

## Contexto
CE-2 exige que, cuando una acción entra en zona (disparo, SPEC-005), el usuario reciba
un aviso **sin abrir la app**, con objetivo del 100 % de disparos notificados. El riesgo
R-4 (la entrega puede fallar o caer en spam) es la decisión central. El humano definió
además DOS tipos de aviso: uno **individual** por cada acción que ENTRA y uno **agregado**
periódico con todas las que PERMANECEN en zona.

Verificación de opciones (búsqueda 2026-07-14):
- **Email transaccional (Resend):** free tier 3.000/mes y 100/día, 1 dominio verificado,
  logs 30 días, webhooks; DX pensada para Next.js (React Email) y presente en el
  Marketplace de Vercel. Exige bounce rate < 4 %. Inbox placement de email ≈ 80 % (1 de
  cada 5 puede no llegar a bandeja principal).
- **Web push:** entrega ≈ 95 % y 100 % de visibilidad, PERO exige service worker + VAPID +
  permiso explícito del usuario, y se acerca a "app nativa" (fuera de FOUNDATION).
- **In-app solo:** fiable y propio, pero NO cumple "sin abrir la app" (no es proactivo).
- Best practice del sector: email como canal proactivo **+** registro in-app como record
  duradero y fallback; push complementa, no sustituye.

## Decisión
1. **Canal primario: email transaccional vía `Resend`**, detrás de un **puerto
   `NotificationSender`** (misma frontera que `MarketDataProvider`, ADR-002): el dominio
   depende del puerto, no del proveedor; cambiar de proveedor = nuevo adaptador. Adaptador
   real `ResendSender` (usa `RESEND_API_KEY`, no se llama en tests) + **fake** inyectable.
2. **Registro in-app SIEMPRE, como fuente de verdad y fallback (RN-15).** Cada aviso se
   persiste en la entidad `notification` con independencia del envío externo. Si el email
   falla, el aviso NO se pierde: queda in-app y visible cuando el usuario abra la app.
   Mitiga R-4 (el ≈20 % de email que puede no llegar) sin bloquear CE-2.
3. **Dos tipos de aviso (RN-14):**
   - **Entrada (individual):** por cada episodio de disparo recién abierto (SPEC-005),
     un aviso al usuario dueño. **Idempotente por episodio**: exactamente uno por episodio,
     no se reenvía mientras siga abierto.
   - **Permanencia (agregado):** un aviso por **usuario y ciclo** que lista todas sus
     acciones con episodio abierto. Se repite cada ciclo por diseño (recordatorio), pero
     no se duplica dentro del mismo ciclo.
   Esta idempotencia del ENVÍO es distinta de la del disparo (RN-13, que ya deduplica el
   episodio): aquí se deduplica la EMISIÓN del aviso.
4. **Enganche en el ciclo de cron.** El envío corre DESPUÉS de la evaluación de disparos
   (ADR-005), en la MISMA ejecución y endpoint protegido con `CRON_SECRET`. Una sola
   cadencia; el aviso hereda el `asOf` de la cotización del ciclo (D-2), que se muestra.
5. **Resiliencia por usuario.** Si el envío externo falla para un usuario, ese aviso se
   marca `failed` (queda in-app) y el ciclo sigue con los demás; no aborta el lote.

## Consecuencias
### Positivas
- Cumple CE-2 (proactivo, sin abrir la app) con coste bajo (free tier Resend) y buena DX.
- R-4 acotado: el registro in-app garantiza que ningún disparo queda sin aviso aunque el
  email no llegue; el carácter diferido (D-2) hace tolerable el ≈20 % de fallo de bandeja.
- Puerto `NotificationSender` desacopla el proveedor; migrar a Postmark/SES o añadir push
  luego = nuevo adaptador, sin tocar dominio.

### Negativas / follow-ups
- Límite free tier (100/día): suficiente para MVP (1 digest + pocas entradas por usuario/día);
  si crecen usuarios/símbolos habrá que subir de tier o agrupar. Monitorizar consumo.
- Deliverability de email exige dominio verificado y SPF/DKIM; `RESEND_API_KEY` + dominio
  son follow-up de despliegue (se suma a F-SPEC-004-1).
- Web push (mayor fiabilidad/inmediatez) queda fuera de v1; futuro si se pide.

## Alternativas consideradas
- **Web push como canal primario:** mejor entrega, pero exige service worker/VAPID/permiso
  y roza app nativa (FOUNDATION "Fuera"); rechazado para v1, queda futuro.
- **In-app solo:** no cumple "sin abrir la app" (CE-2); rechazado como único canal, pero
  SÍ se adopta como registro/fallback (decisión 2).
- **SendGrid:** retiró su free tier; peor encaje que Resend. **Postmark:** buena entrega,
  pero Resend gana en DX Next.js/React Email e integración Vercel. Ambos quedan como
  adaptadores alternativos tras el puerto.
- **SMS:** fiable pero con coste por mensaje y sin free tier real; desproporcionado para
  avisos diferidos; rechazado.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
