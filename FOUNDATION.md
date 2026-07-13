# FOUNDATION — Stockeiro

> Constitución del proyecto. Las decisiones D-N están **locked**: solo un ADR
> aceptado puede reinterpretarlas o supersederlas. Dueños: sdd-arquitecto y
> sdd-producto (hook protege-verdad).

- Creado: 2026-07-13
- Dominio: Gestión de inversiones en bolsa

## Decisiones locked
<!-- Una por línea, numeradas y datadas. Ej.: -->
- **D-1** (2026-07-13): La app **avisa, no opera**. Vigila cotizaciones y
  notifica; nunca ejecuta órdenes ni se conecta a la cuenta del bróker. Porque
  el dolor es la vigilancia manual, no la ejecución (visión "Qué NO es").
- **D-2** (2026-07-13): **No es tiempo real**. El disparo se evalúa en modo
  diferido/batch dentro de un ciclo de refresco acordado. Porque la inversión es
  a largo plazo y el gatillo es una zona, no un valor exacto (visión; CE-1).
- **D-3** (2026-07-13): El disparo es **por zona, no por valor puntual**. Las
  zonas de compra/venta son rangos que definen la entrada. Porque refleja cómo
  trabajan los portales de análisis del usuario (épica; CE-1).
- **D-4** (2026-07-13): La app **no calcula ni recomienda zonas**: las aporta el
  usuario desde sus portales de análisis. Porque el producto vigila y avisa, no
  genera criterio de inversión (visión "Qué NO es").
- **D-5** (2026-07-13): **Multiusuario con aislamiento estricto por usuario**.
  Cada persona solo ve y actúa sobre sus datos. Porque son datos financieros
  personales y es requisito de confianza (CE-4; RN-01).
- **D-6** (2026-07-13): El **P/L distingue siempre actual vs. realizado**: el de
  posición abierta no se mezcla con el materializado tras venta. Porque son
  magnitudes distintas y confundirlas engaña sobre el resultado (CE-3).
- **D-7** (2026-07-13): El **instrumento es la acción**. Otros instrumentos
  (fondos, cripto, derivados, divisas) quedan fuera del núcleo. Porque acota el
  modelo de dominio al problema validado antes de ampliar (épica "Fuera").

## Alcance
- Dentro:
  - Acciones vigiladas con **zona de compra y zona de venta** (rangos), dadas
    por el usuario.
  - **Ingesta de cotizaciones** desde proveedor externo (Yahoo/Google/equiv.) en
    modo diferido/batch (ver ADR-001/ADR-002).
  - **Motor de disparo por zonas**: detecta la entrada en zona de compra/venta.
  - **Aviso proactivo** al usuario cuando se dispara una zona (CE-2).
  - **Cartera**: precio de compra, cantidad, precio de venta y P/L **actual** y
    **realizado**; vista por posición y agregada (CE-3).
  - **Multiusuario** con acceso autenticado y aislamiento por usuario (CE-4).
  - **UI web en Next.js** con el design system `design/tremen-ds`.
- Fuera (aparcado a propósito, no por descuido):
  - Tiempo real / intradía y disparadores por valor exacto.
  - Ejecución de órdenes reales o conexión con bróker (la app avisa, no opera).
  - Recomendaciones o cálculo propio de zonas/análisis.
  - Instrumentos distintos de acciones (fondos, cripto, derivados, divisas).
  - App móvil nativa e import automático de posiciones desde el bróker.
  - Multi-moneda avanzada y fiscalidad (P/L con comisiones, dividendos, splits).

## No-negociables
<!-- Seguridad, cumplimiento, invariantes del dominio. -->
- **Aislamiento de datos por usuario** (RN-01): toda lectura/escritura filtra por
  el `userId` de la sesión; ningún flujo devuelve ni acepta datos de otro usuario.
- **Acceso autenticado** (RN-03): salvo registro e inicio de sesión, todo acceso
  a datos o acciones exige sesión válida.
- **Nunca ejecutar órdenes con dinero real** ni conectar con el bróker: el
  producto solo avisa (D-1).
- **Mostrar siempre el `asOf` / carácter diferido del dato**: cada cotización y
  disparo indica su antigüedad; jamás dar falsa sensación de tiempo real (D-2).
- **El P/L distingue siempre actual vs. realizado** (D-6): no se agregan ni
  presentan como una sola magnitud.

## Cómo se trabaja aquí
Este proyecto sigue el estándar **tremen-sdd**: nada se implementa sin una
SPEC aprobada; las decisiones técnicas se registran como ADR inmutables; la
evidencia de verificación vive en el ledger de cada spec. Roles: /sdd-orquestador
(entrada), /sdd-producto, /sdd-arquitecto, /sdd-implementador, /sdd-verificador,
/sdd-documentalista, /sdd-como-vamos.
