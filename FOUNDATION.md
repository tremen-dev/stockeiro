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
- **D-7** (2026-07-13, *supersedida por **ADR-020** el 2026-08-18*): El
  instrumento **es el que cotice en un mercado soportado**. No se filtra por
  tipo de instrumento: el buscador ofrece lo que el proveedor devuelva en los
  mercados soportados y **muestra** de qué tipo es (acción, REIT, ADR, ETF…). El
  **modelo de dominio sigue siendo el de la acción** (ADR-003: ledger, precio
  medio, splits, dividendos, P/L actual vs. realizado); lo que se retira es la
  **lista blanca de tipos**, no la contención del modelo.
  *Redacción original (2026-07-13)*: «El **instrumento es la acción**. Otros
  instrumentos (fondos, cripto, derivados, divisas) quedan fuera del núcleo.
  Porque acota el modelo de dominio al problema validado antes de ampliar
  (épica "Fuera")».

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
  - **Modelado específico** de instrumentos distintos de la acción (fiscalidad
    propia, TER de un ETF, ratio de un ADR, dividendos de REIT…): vigilarlos y
    tenerlos en cartera **sí** entra desde **ADR-020**; lo que queda fuera es
    poner reglas de negocio por tipo. Cripto y divisas siguen fuera **por
    mercado** —no cotizan en ninguno de los operating MIC soportados
    (ADR-012)—, no por tipo (D-7 supersedida por ADR-020, 2026-08-18).
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

Dos convenciones que ya costaron ruido y quedan fijadas en **ADR-025**:

- **Los términos de `docs/fundacion/dominio.md` los escribe sdd-arquitecto, en el gate en
  que se aprueba la spec que los pide** — nunca la implementación, y nunca al cerrar. La
  implementación **copia** de ahí el rótulo; si el término falta, levanta el residual y no
  escribe en el documento de verdad.
- **Una spec en `hecho` no se reabre y el gate `require-spec` no se rodea.** Un retoque
  trivial de `src/` descubierto después (rótulo, texto, typo) **cuelga de una spec viva que
  ya toque esa superficie**, o espera en **EPIC-FIX** a un lote de rótulos. Lo decide el
  arquitecto al triar el residual y se escribe en él.

Y una tercera, que ya ha costado **cuatro** veces y se fija el **2026-08-20** (cierra
`F-SPEC-034-6`):

- **Un test de frontera fija una propiedad, no un estado del árbol.** El patrón que
  caduca es congelar cómo estaba el repositorio el día de la entrega: un recuento de
  ficheros, un `HEAD` móvil, un *"esto todavía no existe"*. Caduca al mergear —no cuando
  algo se rompe— y entonces pinta rojo sin defecto detrás, que es la peor clase de rojo.
  Los tres encuadres buenos que este proyecto ya tiene, y que sirven de molde:
  `tests/deploy-gate-workflow.test.ts` acota su ventana de diff a **su propia entrega**
  (`de3a6ee...0d389c8`) y no a `HEAD`; `tests/spec-032-frontera.test.ts` pasó de *"drizzle/
  tiene nueve `.sql`"* a *"estas nueve siguen ahí, con su nombre y en su orden"*; y el
  caso 4.5 de `tests/neon-preview-cleanup-workflow.test.ts` **vuelve a derivar** su lista
  de caracteres preguntándole a `git check-ref-format` en cada ejecución, en vez de
  escribirla.
- **Cuando caduca igualmente —y pasará—, hay dos salidas legítimas y una que no lo es.**
  **Re-encuadrar**, si la propiedad sigue viva y solo estaba mal expresada; o **borrar**,
  si lo que vigilaba era del momento de la entrega y ya no puede volver a ser cierto.
  **Aflojar la comprobación hasta que pase no es ninguna de las dos**: deja el fichero en
  verde y el gate sin nada dentro. Con dos condiciones, en cualquiera de los dos casos:
  **queda escrito en el ledger qué vigilaba antes y qué vigila ahora**, y **quien lo toca
  no es quien se beneficia** — un implementador no ablanda en silencio la guardia que le
  está fallando; la declara y la lleva al gate. Precedentes: `F-SPEC-034-6` (tres guardias
  re-encuadradas) y `F-SPEC-042-9` (un caso borrado, con su motivo escrito en el sitio).

Y un **primer corolario de esa tercera**, que ya ha costado una vez y se fija el
**2026-08-24** (cierra `F1` de la 1.ª vuelta de SPEC-055):

- **Leer un fichero ajeno y aseverar sobre su contenido acopla igual que escribirlo.** Que
  `git diff --name-only` de dos ramas no se solape **no prueba que estén desacopladas**. Un
  test que **lee** un fichero de otra spec en vuelo y **exige algo de lo que encuentra** ata
  su rama al estado del árbol de la otra: cuando la otra cambie ese fichero —cambio legítimo,
  dentro de su territorio— el primer merge deja **roja** a la que quedó, y con la cara de un
  defecto de la vecina. Es el rojo sin defecto detrás de la convención de arriba, entrando
  por la puerta que esa convención no nombraba.
- **La regla, en una línea: leer un fichero sólo compra algo cuando lo que se lee es un valor
  VIVO —uno que un proceso real consume— y ese proceso es de tu spec o de nadie.**
  `.github/workflows/ci.yml` lo es, porque CI construye con su valor, y `tests/e2e/server.mjs`
  lo es, porque el e2e sirve con el suyo: leerlos hace que el rojo salga en la batería **antes**
  que en CI, que es la protección que se paga. Un `.env.example` **no** lo es: no lo lee ningún
  proceso, es documentación para humanos, y quien lo cambia es su dueño. Leerlo no compra nada
  y cuesta el acoplamiento entero.
- **Si la propiedad que quieres vigilar es sobre un fichero ajeno, la guardia vive con el
  dueño del fichero**, y se le pide como dependencia (`D-SPEC-nnn-n`). No se trae de contrabando
  al fichero de test propio. Precedente: `D-SPEC-055-1` pto. 3.

Y un **segundo corolario**, éste sobre cómo se escriben los **criterios de aceptación** y no
sobre cómo se escriben los tests. Ya ha costado **cuatro rondas rojas** en dos specs y dos
épicas, y se fija el **2026-08-24** (cierra `F1` de la 2.ª vuelta de SPEC-055):

- **Un CA enuncia la PROPIEDAD que quiere garantizar, nunca la FORMA concreta que quiere
  prohibir.** Quien implementa escribe exactamente lo que la letra pide, y hace bien: si la
  letra nombra una forma, sale una guardia que sólo conoce esa forma y que **da por vigilado
  todo lo demás**. El rojo llega en el gate, el defecto es de la letra —no del código— y lo
  paga una ronda entera. Los cuatro casos, para que esto sea comprobable y no una moraleja:
  **SPEC-054 CA-15** pidió que cada aviso *«envuelva»* —una forma— cuando la propiedad era que
  la caja acotada funcione, y así se pedía a sí mismo dos cosas incompatibles; **SPEC-054
  CA-16** pidió guardias ajenas *«sin tocarse»* —una forma— cuando la propiedad era *sin
  aflojarse*, y era incumplible por construcción; **SPEC-055 CA-5** pidió el tercer valor *«de
  la misma forma»* que los otros dos y se acabó leyendo un fichero de otra spec; **SPEC-055
  CA-12** pidió que una constante *«no aparezca dentro de un `toHaveLength(`»* —una forma—
  cuando la propiedad era que **añadir una fila no obligue a tocar ningún aserto**, y la
  guardia resultante no veía la congelación escrita al derecho.
- **Enumerar formas prohibidas está prohibido.** Una lista de matchers, de literales o de
  ficheros vetados dentro de un CA es la misma lista que caduca de `F-SPEC-048-2`, sólo que
  escrita un piso más arriba: en la spec en vez de en el test. Caduca igual, y encima con la
  autoridad de un criterio aprobado detrás.
- **Cuando el único entregable de un CA es una guardia, el CA exige también la prueba de que
  esa guardia se pone roja** (ADR-026 §7), con los **especímenes mínimos escritos en el propio
  CA** y **en los dos sentidos**: lo que debe cazar, y lo que **no** debe cazar. La segunda
  dirección no es adorno — sin ella la reparación barata es cazar de más, y una guardia que
  molesta acaba aflojada. **Una guardia que no se puede poner roja no es una guardia: es una
  casilla.**
- **El listón, en una línea: un CA está bien escrito si se puede violar de una forma que no se
  le ocurrió a quien lo escribió, y aun así falla.**

Y un **tercer corolario**, gemelo del primero —aquél sobre **leer** un fichero ajeno, éste
sobre **enumerar** un directorio ajeno—. Ya ha costado **dos** veces, con el mismo molde y
distinto sujeto, y se fija el **2026-08-25** (cierra SPEC-057; fuente **ADR-037**, que
**precisa** ADR-031 pto. 1 sin superseder nada):

- **Enumerar un directorio que otros hacen crecer y congelar el resultado es criterio de
  gate, no un test.** Afirma *«el árbol estaba así el día de la entrega»*: una **foto**, no
  una propiedad. Es el mismo criterio que `RI-03` ya prohibía —*«este cambio está bien
  acotado»*—, sólo que escrito **sin `git`**: por eso ni ADR-031 ni la meta-guardia de
  SPEC-048 lo veían, y por eso hay que nombrarlo aparte. Los dos casos, para que esto sea
  comprobable y no una moraleja: **SPEC-050 CA-20** exigía que ningún fichero de `docs/adr/`
  contuviera jamás la cadena `SPEC-050`, y la disparó `ADR-033` **al citar `F-SPEC-050-4`**,
  el hallazgo que lo origina; **SPEC-051 CA-17.1** congelaba la lista de ficheros de `tests/`
  que mencionan `SPEC-051`, y la rompía cualquier spec posterior que la citase. Coste
  conjunto: dos escaladas al humano y seis rondas de rol. **Defectos reales cazados: cero.**
- **El defecto es un error de converso.** La guardia declara —y lo declara bien, en su propio
  comentario— *«todo re-encuadre autorizado menciona a X»*, y el código la usa como *«toda
  mención de X es un re-encuadre»*: condición **necesaria** tratada como **suficiente**. Y
  como citar a la spec que te precede es el comportamiento **sano** de este proyecto —unas
  levantan hallazgos y otras los recogen—, la guardia queda calibrada para castigar justo lo
  que el método pide hacer. Caduca **a rojo falso**, no a verde vacío: el que paga es un
  tercero que no ha tocado nada, y le para la CI.
- **La regla, en una línea: si el valor que afirmas sale de recorrer un directorio, la
  aserción tiene que sobrevivir a que ese directorio crezca.** Sobreviven cuatro formas, y las
  cuatro están ya en este repositorio: conjunto esperado **vacío**
  (`tests/revision-movil-en-tests.test.ts`), aserción **por elemento**
  (`tests/version-bump-gate.test.ts`), **pertenencia** —*«estos siguen ahí»*, incluido el
  prefijo— (`tests/spec-032-frontera.test.ts`) y **búsqueda por nombre**
  (`readdirSync(...).find(n => n.startsWith('ADR-024-'))`). No sobrevive **la igualdad exacta
  contra una lista literal no vacía**. Y sigue en pie lo de siempre: todo barrido lleva su
  **centinela de no-vacuidad**, porque un barrido sobre el directorio equivocado es verde sin
  haber mirado nada.
- **Se reconoce con una pregunta, no con una lista de matchers** —enumerar formas prohibidas
  sigue prohibido (2.º corolario)—: **¿de quién es la mano que puede poner esto rojo?** Si es
  la mía, o la de quien toque el fichero del que estoy afirmando algo, es una **propiedad** y
  su sitio es la suite. Si es **la de cualquiera que trabaje en otra spec**, es un criterio de
  gate disfrazado y su sitio es el gate.
- **Y esto NO lleva guardia, a propósito.** El discriminante necesita saber **quién escribe en
  ese directorio**, que es un hecho del **proceso** y no del texto del fuente; el mejor
  mecanismo textual que se sabe escribir da, medido sobre el árbol, **tres inocentes por un
  culpable** —y uno de los inocentes es `tests/spec-032-frontera.test.ts`, que este mismo
  documento cita más arriba como molde de re-encuadre **correcto**—. Se prefiere **una regla
  escrita sin guardia a una guardia que acusa a inocentes**: ya acusó a dos. El disparador,
  por tanto, es **este sitio**, que se lee en el paso 1 de `CLAUDE.md`, antes de escribir
  nada. Quien quiera mecanizarlo tiene que traer un discriminante que separe los tres
  inocentes que **ADR-037** nombra por línea; no basta con proponerlo mejor.
