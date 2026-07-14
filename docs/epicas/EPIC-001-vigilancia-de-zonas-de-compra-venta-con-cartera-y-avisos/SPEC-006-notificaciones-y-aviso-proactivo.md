---
id: SPEC-006
tipo: spec
epica: EPIC-001
estado: en-revision
aprobada-por: humano (Alberto Fojo) — gate 2026-07-14
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-07-14, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-07-14, por: sdd-implementador}
---
# SPEC-006 — Notificaciones y aviso proactivo

## Problema
El motor ya detecta y registra los disparos por zona (SPEC-005), pero el usuario **no se
entera**: para saber que una acción entró en su zona tendría que abrir la app y mirar. Eso
incumple CE-2 (aviso proactivo, 100 % de disparos notificados sin abrir la app) y deja el
dolor original —vigilancia manual— a medio resolver. Esta spec envía el aviso: por cada
episodio de disparo abierto emite un **aviso de entrada** individual, y por ciclo emite un
**aviso de permanencia** agregado con todas las acciones que siguen en zona (el modelo que
pidió el humano). El envío va tras un **puerto** (`NotificationSender`, canal email en v1) y
cada aviso se **registra in-app** como fuente de verdad y fallback. Implementa **ADR-006**.
Reglas: **RN-14, RN-15, RN-01, D-2**. Cierra el riesgo **R-4**. NO define nuevas reglas de
disparo (eso es SPEC-005) ni una bandeja de avisos en pantalla más allá de poder consultarlos.

## Usuarios / roles afectados
- **Sistema** (proceso programado): tras evaluar disparos (SPEC-005), emite y registra los
  avisos del ciclo. Se dispara por Vercel Cron, mismo endpoint protegido (ADR-005/ADR-006).
- **Usuario final**: recibe el aviso proactivo (email) sin abrir la app y, si el canal
  externo falla, lo conserva in-app. Cada aviso muestra su `asOf` (carácter diferido, D-2).

## Criterios de aceptación
Cada CA es verificable con un test. La verificación usa un **proveedor de envío fake** tras
el puerto `NotificationSender` (el adaptador real `ResendSender` se escribe pero no se llama
en tests); los disparos se preparan con el motor de SPEC-005 y cotizaciones sembradas.

- **CA-1 (Aviso de entrada por acción que entra, CE-2/RN-14).**
  Dado un episodio de disparo recién abierto (una acción que entró en zona) de un usuario,
  cuando corre la notificación del ciclo,
  entonces se emite un aviso de entrada a ESE usuario con ticker, tipo de zona, precio y
  `asOf`, y queda registrado como enviado (entidad `notification`).
- **CA-2 (Idempotencia del aviso de entrada, RN-14).**
  Dado un episodio de disparo ya notificado que sigue abierto,
  cuando la notificación corre en ciclos sucesivos,
  entonces NO se reenvía el aviso de entrada: existe exactamente uno por episodio.
- **CA-3 (Aviso agregado de permanencia, RN-14).**
  Dadas varias acciones de un usuario con episodios abiertos,
  cuando corre la notificación del ciclo,
  entonces se emite UN solo aviso agregado a ese usuario que las lista todas (no uno por
  acción), con su `asOf`.
- **CA-4 (El agregado se repite por ciclo pero no dentro del ciclo, RN-14).**
  Dado un usuario con permanencia en zona,
  cuando la notificación del MISMO ciclo se ejecuta/reintenta,
  entonces se emite como mucho un agregado por (usuario, ciclo); en un ciclo POSTERIOR con
  permanencia se emite un nuevo agregado (recordatorio).
- **CA-5 (Registro consultable con `asOf`, D-2).**
  Dados los avisos emitidos,
  cuando se consulta el historial de un usuario,
  entonces se listan sus avisos (entrada y agregado) con su `asOf` y estado (enviado/fallido),
  filtrados por `userId`; jamás se presentan como dato de tiempo real.
- **CA-6 (Aislamiento por usuario, RN-01).**
  Dados dos usuarios con disparos,
  cuando corre la notificación,
  entonces cada uno recibe SOLO sus avisos; el agregado de A solo incluye acciones de A, y
  ningún usuario ve ni consulta los avisos de otro (ni por lista ni por id).
- **CA-7 (Envío tras puerto + fallback in-app, RN-15).**
  Dado que el canal externo (proveedor fake) falla para un usuario,
  cuando corre la notificación,
  entonces su aviso se registra igualmente in-app con estado `failed` (no se pierde) y los
  avisos de los demás usuarios SÍ se envían; el ciclo no se aborta.
- **CA-8 (Enganche en el ciclo de cron protegido, ADR-005/ADR-006).**
  Dado el endpoint del ciclo,
  cuando se invoca sin el `CRON_SECRET` correcto,
  entonces no se emite ni registra ningún aviso; con el secreto correcto, la notificación
  corre DESPUÉS de la evaluación de disparos, en el mismo ciclo.
- **CA-9 (Cobertura CE-2: ningún disparo sin aviso).**
  Dados los episodios de entrada abiertos en un ciclo,
  cuando corre la notificación,
  entonces para cada uno existe un aviso de entrada registrado (enviado o `failed`), de modo
  que el 100 % de los disparos queda notificado/registrado (ninguno se omite silenciosamente).

## Entidades y reglas afectadas
- **`notification`** (por usuario, ADR-006): aviso emitido. `userId`, `kind`
  ('entry' | 'digest'), `zoneTriggerId`→zone_triggers (para 'entry'; null en 'digest'),
  `cycleRef` (identifica el ciclo, para idempotencia del 'digest'), `payload`/resumen,
  `channel` ('email' | 'in_app'), `status` ('sent' | 'failed'), `asOf`, `createdAt`.
  Idempotencia: único (`zoneTriggerId`) para 'entry'; único (`userId`, `cycleRef`) para 'digest'.
- **Puerto `NotificationSender`** (ADR-006): `send(mensaje) -> {ok}` (omite/`failed` si falla).
  Implementaciones: `ResendSender` (real, `RESEND_API_KEY`, no en tests) y un **fake**.
- **Servicio de notificación**: lee de SPEC-005 las entradas del ciclo (`opened`) y la
  permanencia (`openTriggersForUser`), emite avisos (idempotentes, RN-14), registra y aplica
  el fallback in-app (RN-15).
- **Enganche**: corre tras `evaluateTriggers` en `runRefreshCycle` (SPEC-005/ADR-005); mismo
  endpoint `CRON_SECRET`.
- Reglas: **RN-14** (tipos e idempotencia), **RN-15** (canal + fallback), **RN-01**
  (aislamiento), **D-2** (`asOf`/diferido). Decisiones: **ADR-006** (hereda ADR-002/004/005).
  Términos: `docs/fundacion/dominio.md` (aviso proactivo, aviso de entrada, aviso de
  permanencia, puerto de envío de avisos, asOf).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Web push / app nativa**: mayor fiabilidad pero exige service worker/VAPID/permiso y roza
  app nativa (FOUNDATION "Fuera"); futuro (ADR-006).
- **Preferencias de notificación** (silenciar, elegir canal/frecuencia por usuario): v1 envía
  email + registra in-app; la configuración fina es follow-up.
- **Bandeja/UI de avisos** rica en pantalla: esta spec deja el historial CONSULTABLE (CA-5);
  la pantalla puede ir con una spec de UI.
- **Reintentos/backoff del proveedor** y verificación real de deliverability (dominio, SPF/DKIM):
  v1 marca `failed` y conserva in-app; la política fina y la key real son follow-up de despliegue.
- **Nuevas reglas de disparo**: son de SPEC-005; aquí solo se notifica lo ya detectado.

## Notas para el gate humano
Resoluciones que propongo (ADR-006 + RN-14/RN-15), para tu aprobación:

- **Canal = email transaccional (Resend) + registro in-app como fallback**. Email cumple
  "sin abrir la app"; el registro in-app garantiza que ningún disparo se pierde aunque el
  email no llegue (email ≈ 80 % de inbox). Web push (más fiable) queda a futuro por exigir
  service worker/permiso y acercarse a app nativa. ¿Conforme con email + fallback in-app?
- **Dos avisos (tu modelo)**: uno **individual por entrada** (una vez por episodio) y uno
  **agregado por ciclo** con todas las que permanecen en zona (recordatorio que se repite
  cada ciclo). ¿Confirmas esta semántica de idempotencia?
- **Coste/límite**: free tier de Resend (100 emails/día) basta para el MVP; si crecen
  usuarios/símbolos habrá que subir de tier o agrupar. `RESEND_API_KEY` + dominio verificado
  son follow-up de despliegue (se suman a F-SPEC-004-1). ¿OK?
- **Alcance sin UI de bandeja**: el usuario recibe email y el aviso queda consultable in-app,
  pero la pantalla de avisos rica queda fuera (posible spec de UI). ¿Cierras aquí el alcance?
