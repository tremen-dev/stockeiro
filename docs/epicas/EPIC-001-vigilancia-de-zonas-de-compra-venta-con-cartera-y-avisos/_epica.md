---
id: EPIC-001
tipo: epica
estado: hecho
historial:
  - {estado: borrador, fecha: 2026-07-13, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-07-14, por: humano (Alberto Fojo)}
  - {estado: en-revision, fecha: 2026-07-14, por: humano (Alberto Fojo)}
  - {estado: hecho, fecha: 2026-07-14, por: humano (Alberto Fojo)}
---
# EPIC-001 — Vigilancia de zonas de compra/venta con cartera y avisos

## Objetivo
Entregar la capacidad núcleo del producto: que un inversor particular a largo
plazo registre las acciones que sigue con las **zonas de compra y venta** que le
sugieren sus portales de análisis, y que la app vigile las cotizaciones por él y
le **avise de forma proactiva** cuando una acción entra en una de esas zonas —
para dejar de revisar manualmente y no perder oportunidades. Incluye la gestión
de **cartera** (precio de compra, cantidad, precio de venta, beneficio/pérdida
actual y realizado) porque el aviso solo es útil si el usuario ve, en el mismo
sitio, qué posición tiene y qué implica actuar sobre ella.

Por qué ahora: es el mínimo que resuelve el dolor declarado (vigilancia manual →
oportunidades perdidas). Sin esto, no hay producto.

## Criterios de éxito
Medibles. La épica cumple su promesa cuando:

- **CE-1 (Cero zonas perdidas).** Para toda acción vigilada por un usuario, si su
  cotización entra en la zona de compra o de venta definida, la app lo detecta
  dentro de un ciclo de refresco acordado (hipótesis a validar en spec: ≤ 24 h;
  las inversiones son a largo plazo y el disparador es una zona, no un valor
  exacto). Objetivo: 0 zonas alcanzadas sin detectar.
- **CE-2 (Aviso proactivo).** Cuando se detecta una entrada en zona, el usuario
  recibe una notificación (canal a decidir en spec: email/push/in-app) sin haber
  abierto la app. Objetivo: 100 % de disparos notificados; el usuario no necesita
  revisar cotizaciones manualmente.
- **CE-3 (Cartera siempre al día).** El usuario ve de un vistazo, por posición y
  agregado de cartera: precio de compra, cantidad, precio de venta (si aplica),
  beneficio/pérdida **actual** (posición abierta) y **realizado** (tras venta),
  con datos refrescados a diario y sin hojas de cálculo externas.
- **CE-4 (Multiusuario aislado).** Varios usuarios usan la app con sus propias
  carteras, acciones vigiladas y zonas, sin ver ni afectar los datos de otros.

## Alcance
- **Dentro:**
  - Registro/gestión de acciones vigiladas con zona de compra y zona de venta
    (rangos, no valores puntuales).
  - Ingesta de cotizaciones desde una plataforma de bolsa externa (Yahoo /
    Google / equivalente), en modo diferido/batch (no tiempo real).
  - Motor de disparo por zonas: detecta entrada en zona de compra/venta.
  - Notificación proactiva al usuario cuando se dispara una zona.
  - Cartera: precio de compra, cantidad de acciones, precio de venta,
    beneficio/pérdida actual y realizado; vista por posición y agregada.
  - Multiusuario con autenticación y aislamiento de datos por usuario.
  - UI web en Next.js usando el design system `design/tremen-ds`.
- **Fuera (aparcado a propósito, no por descuido):**
  - Cotizaciones en tiempo real / intradía y disparadores por valor exacto.
  - Ejecución de órdenes reales o conexión con bróker (la app avisa, no opera).
  - Recomendaciones/análisis propios de compra-venta (las zonas las aporta el
    usuario desde sus portales; la app no las calcula).
  - Instrumentos distintos de acciones (fondos, cripto, derivados, divisas).
  - App móvil nativa; import automático de posiciones desde el bróker.
  - Multi-moneda avanzada y fiscalidad (se tratará como hipótesis si surge).

## Specs
<!-- Tabla DERIVADA de los frontmatters; la regenera /sdd-tablero. No editar a mano. -->
| Spec | Título | Estado |
|---|---|---|

## Riesgos
- **R-1 (Fuente de datos).** Yahoo/Google no ofrecen APIs oficiales estables y
  gratuitas; términos de uso y límites de rate pueden romper la ingesta. Decisión
  técnica de sdd-arquitecto (ADR): qué proveedor y con qué contrato/fallback.
- **R-2 (Definición de "zona").** Ambigüedad sobre si la zona es un rango
  [min,max], un umbral con dirección, o incluye reglas (tocar vs. cerrar dentro).
  Debe cerrarse en la primera spec; afecta a CE-1.
- **R-3 (Latencia de aviso).** El ciclo de refresco elegido determina si CE-1 se
  cumple; demasiado espaciado pierde disparos, demasiado frecuente choca con R-1.
- **R-4 (Entrega de notificación).** Email/push pueden fallar o caer en spam;
  CE-2 exige un canal fiable y, quizá, un fallback in-app.
- **R-5 (Exactitud de P/L).** Comisiones, ventas parciales, splits y dividendos
  distorsionan beneficio/pérdida; alcance inicial debe declarar qué contempla.
- **R-6 (Datos personales/financieros).** Multiusuario con carteras exige
  autenticación sólida y aislamiento; brecha = pérdida de confianza.

## Desglose orientativo en specs (propuesta, NO autoritativa)
> El desglose real y su secuencia son competencia de **sdd-arquitecto**. Esto es
> solo una hipótesis de trabajo para dimensionar la épica.

| # | Spec candidata | Idea |
|---|---|---|
| 1 | Cuentas y multiusuario | Auth, sesión, aislamiento de datos por usuario. |
| 2 | Cartera y P/L | Posiciones: compra, cantidad, venta, P/L actual y realizado. |
| 3 | Acciones vigiladas y zonas | Alta de tickers y definición de zonas compra/venta. |
| 4 | Ingesta de cotizaciones | Conector a proveedor externo en batch/diferido. |
| 5 | Motor de disparo por zonas | Evaluación periódica y detección de entradas en zona. |
| 6 | Notificaciones | Aviso proactivo por el canal elegido + registro de avisos. |
| 7 | UI con tremen-ds | Dashboard de cartera y panel de vigilancia con el design system. |
