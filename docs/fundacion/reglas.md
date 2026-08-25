# Reglas de negocio — Stockeiro

> Numeradas y estables: las specs y ADRs las citan como RN-xx. No se borran;
> se marcan derogadas con fecha y motivo.

- **RN-01** (Aislamiento de datos por usuario): cada usuario solo puede ver y
  modificar sus propios datos (carteras, posiciones, acciones vigiladas, zonas y
  avisos). Ningún flujo devuelve ni acepta datos de otro usuario. Invariante de
  seguridad: toda lectura/escritura filtra por el `userId` de la sesión.
- **RN-02** (Identidad por email único): un usuario se identifica por una
  dirección de email única en el sistema; no puede haber dos cuentas con el mismo
  email.
- **RN-03** (Acceso autenticado): salvo las páginas públicas de registro e inicio
  de sesión, todo acceso a datos o acciones requiere una sesión válida.
- **RN-04** (Coste base = precio medio ponderado): el coste base de una posición
  es el precio medio ponderado de sus compras, incluyendo los **gastos** de cada
  compra. Fuente: sdd-cartera. (Gastos = concepto único: broker, impuestos de
  compra, cambio de divisa; no se separan.)
- **RN-05** (P/L realizado): el P/L realizado de una venta = (precio de venta ×
  cantidad vendida − gastos de la venta) − (precio medio × cantidad vendida). Los
  **dividendos** se suman al P/L realizado como ingreso, sin alterar el coste base
  ni la cantidad. Fuente: sdd-cartera; D-6.
- **RN-06** (P/L actual): el P/L actual de una posición abierta = (precio de
  mercado − precio medio) × cantidad viva. Requiere una cotización; si no hay
  precio, NO se calcula (se muestra "sin dato") y NUNCA se mezcla ni suma con el
  realizado. Fuente: sdd-cartera; D-6.
- **RN-07** (Splits): un split de ratio r ajusta la cantidad viva (×r) y el precio
  medio (÷r); no cambia el valor de la posición ni su P/L. Fuente: sdd-cartera.
- **RN-08** (No sobreventa): no se puede vender más cantidad que la cantidad viva
  de la posición.
- **RN-09** (Divisa única por posición): los importes de una posición están en una
  única divisa; no hay conversión automática de divisa (el coste del cambio, si lo
  hay, se registra dentro de los **gastos**). Multi-moneda avanzada queda fuera
  (FOUNDATION "Fuera").
- **RN-10** (Zona = rango de precio): una zona de compra o de venta es un **rango
  [min, max]** con min ≤ max, no un valor puntual (D-3). Las zonas de una acción
  vigilada son **opcionales e independientes**: se puede vigilar sin zona, con solo
  una, o con ambas. Compra y venta son **etiquetas**; no se exige que una esté por
  debajo de la otra.
- **RN-11** (Entrada en zona): el precio observado del ciclo (cierre/último, con su
  `asOf`, en la MISMA base ajustada/no-ajustada con la que el usuario definió la
  zona) **entra** en una zona si `min ≤ precio ≤ max` (inclusive). La detección es
  idéntica para compra y venta. Sin datos intradía, "tocar" no aplica (dictamen
  sdd-mercados). Afecta a CE-1.
- **RN-12** (Base de precio = último cierre NO ajustado): la cotización que se
  ingiere, se compara contra zonas (RN-11) y alimenta el P/L actual (RN-06) es el
  **último precio de cierre NO ajustado**, coherente con cómo el usuario define
  zonas y su coste base manual. La serie NO se ajusta por splits/dividendos (esos
  se registran a mano en la cartera, RN-07/RN-05). Cada cotización lleva su `asOf`,
  que se muestra al usuario (D-2). Fuente: sdd-mercados; ADR-002/ADR-004.
- **RN-13** (Disparo por entrada; permanencia observable): el motor registra **un
  solo** disparo por **episodio de entrada** en zona (transición fuera→dentro, RN-11):
  mientras la cotización permanezca dentro NO se crean disparos nuevos (idempotencia),
  y el disparo se **re-arma** solo cuando sale de la zona y vuelve a entrar. La zona de
  compra y la de venta se evalúan de forma independiente. La **condición de permanencia**
  (acciones que siguen dentro de su zona) queda **observable** —los episodios abiertos
  son el estado actual— para que la capa de aviso (CE-2) pueda emitir tanto el aviso de
  **entrada** (por cada acción que entra) como un aviso **agregado de permanencia** (uno
  con todas las que siguen en zona). La detección no se duplica; la periodicidad de los
  avisos la decide la spec de notificación. Fuente: sdd-mercados; ADR-005.
- **RN-14** (Tipos de aviso e idempotencia del envío): el aviso de **entrada** (individual)
  se emite **exactamente una vez por episodio de disparo** (RN-13); no se reenvía mientras
  el episodio siga abierto. El aviso de **permanencia** (agregado) es un resumen periódico,
  **uno por usuario y ciclo**, con todas las acciones cuyo episodio sigue abierto; se repite
  cada ciclo como recordatorio pero no se duplica dentro del mismo ciclo. Esta idempotencia
  del ENVÍO es distinta de la del disparo (RN-13): aquí se deduplica la emisión del aviso.
  Cada aviso se registra con su `asOf` (D-2). Fuente: producto (gate humano); ADR-006.
- **RN-15** (Canal proactivo con registro y fallback): el aviso se entrega por un canal
  **proactivo** que no exige abrir la app (email transaccional en v1) y se **registra
  siempre in-app** como fuente de verdad y fallback: un fallo de entrega del canal externo
  **no pierde** el aviso (queda in-app) ni aborta los avisos de otros usuarios (resiliencia
  por usuario, RN-01). Objetivo CE-2: 100 % de disparos con aviso registrado. Fuente:
  ADR-006; cierra R-4.
- **RN-16** (Cotización sin refrescar): una cotización cuyo `updated_at` —el momento en que
  el ciclo la **escribió**, no su `as_of` de mercado— supera el umbral de la cadencia
  declarada (**36 h**: un ciclo perdido más medio día de holgura) está **sin refrescar**.
  Se **sigue usando** para RN-06 y RN-11 —marcar no es borrar—, pero **no se presenta como
  vigente**: toda pantalla que la muestre dice que no se está actualizando y, si se conoce,
  por qué; y si no se conoce, **no se inventa la causa**. Se mide por `updated_at` y
  **nunca** por `as_of`, porque un ciclo con éxito reescribe la fila aunque el precio no
  cambie: así el fin de semana, el festivo y el **retraso desigual de publicación** del
  proveedor **no** producen falsos positivos, y no hace falta calendario de sesiones. El
  umbral **presupone ciclo diario sin saltos**: quien introduzca saltos lo revisa en la
  misma entrega. Fuente: sdd-mercados; D-2; ADR-027; SPEC-043.

## Reglas de ingeniería (RI-xx)

> Serie aparte de la de dominio. Las **RN-xx** de arriba son reglas de negocio
> —las vigilan `sdd-cartera` y `sdd-mercados`, y su fuente es un dictamen de
> dominio—; las **RI-xx** son reglas de ingeniería: vinculan a cualquier spec que
> toque el código o el esquema, y su fuente es un ADR. La numeración es
> independiente y estable: no se borran, se marcan derogadas con fecha y motivo.

- **RI-01** (Migraciones aditivas, *expand/contract*): una migración no borra, no
  renombra y no estrecha una columna **en el mismo despliegue** que cambia el
  código. Lo destructivo se parte en dos despliegues separados por al menos un
  despliegue verde: primero se añade y se rellena; después, en otra spec, se
  retira lo viejo. El incumplimiento se detecta automáticamente (SPEC-032) y
  **solo se desbloquea por escrito**, con justificación y plan de vuelta atrás,
  en `drizzle/destructive-waivers.json`. Fuente: ADR-018 D-5.1.
- **RI-02** (*"Hecho" significa "vivo"*): una spec no pasa a `hecho` por tener
  GREEN del verificador. Pasa a `hecho` cuando su merge está en `main` **y** el
  despliegue de ese merge está vivo: la puerta de despliegue
  (`.github/workflows/deploy-gate.yml`) en verde, o a mano
  `node scripts/check-alive.mjs --url <origen> --commit <sha del merge>` con
  salida **0**. El GREEN del verificador **sigue siendo sobre el árbol de trabajo
  y antes del merge**: lo que esta regla añade es el último paso, que ocurre
  **después**. La evidencia (enlace al run de la puerta, o la salida del comando)
  se pega en el ledger de la spec. Fuente: ADR-018 D-7.
  El mecanismo que la hace cumplible son `/api/version` (SPEC-031) y la puerta
  post-deploy (SPEC-028): sin los dos, la regla es incumplible —el despliegue no
  sabría de qué commit viene y respondería `unknown`—, que es exactamente por lo
  que estuvo aplazada desde el 2026-08-17.
- **RI-03** (Un criterio de gate no se codifica como test permanente; y si se queda
  en la suite, nace anclado): hay dos clases de afirmación y no se tratan igual. Un
  **criterio de gate** —*«este cambio está bien acotado»*— es cierto sobre un **delta**
  y sólo mientras el delta no se ha integrado; una **propiedad** —*«esta lista sigue
  cerrada»*, *«este literal sigue siendo el que hay»*— es cierta sobre el **estado del
  árbol**, en cualquier momento y para siempre. Un criterio de gate se reexpresa como
  propiedad si se puede; si no, se verifica en el **gate** y su evidencia va al
  **ledger** de la spec —quién lo comprobó, sobre qué rama y con qué salida—, o vive en
  un script de `scripts/` invocado por un step propio de CI (molde:
  `scripts/check-version-bump.mjs`, que compara contra `origin/main` y **debe** hacerlo).
  Si por valor de auditoría se queda en la suite —razón legítima—, **nace anclado**, con
  las cuatro condiciones desde el primer día y no como parche el día que se pone rojo:
  **(1) ventana de dos sha fijos** declarada en una constante con nombre, sin que ningún
  nombre móvil —`origin/main`, `main`, `HEAD`, `@`— sea revisión de un `git diff`, `show`
  o `log`/`rev-list` que alimente una aserción; **(2) centinela de no-vacuidad**, un caso
  del mismo bloque que afirma que la ventana contiene algo que la entrega sí trajo;
  **(3) salto declarado** por disponibilidad (`describe.skipIf`) para que un clon
  superficial no la convierta en rojo falso, salto que **no puede ocurrir en CI** y que un
  caso siempre activo comprueba; y **(4) el porqué al lado**: qué vigilaba antes, qué
  vigila ahora, en virtud de qué CA y con qué fecha. El incumplimiento se detecta
  automáticamente (SPEC-048): una **meta-guardia** recorre `tests/` y falla si alguna
  invocación de git que alimenta una aserción toma una revisión móvil; juzga código, no
  prosa, y no prohíbe ni `git` ni `HEAD` fuera de las revisiones de comparación. Nada de
  esto autoriza a aflojar: cuando una guardia caduca, las únicas salidas siguen siendo
  las dos de `FOUNDATION.md` —re-encuadrar o borrar— y quien la toca no es quien se
  beneficia. Fuente: ADR-031.

  **Precisión del 2026-08-25, para el vector que no usa `git`** (SPEC-057): la distinción de
  arriba —criterio de gate contra propiedad— **no depende de que haya un `git` de por medio**.
  Un conjunto esperado que **enumera lo que hay dentro de un directorio que crece por mano
  ajena** (`docs/adr/`, `docs/epicas/`, `tests/`) es la misma afirmación *«este cambio está
  bien acotado»*, escrita leyendo el disco: caduca igual, pero **a rojo falso** —acusa a quien
  no ha tocado nada y le para la CI— en vez de a verde vacío. Le aplican **las mismas tres
  salidas y en el mismo orden**: propiedad, gate con evidencia al ledger, o script en
  `scripts/`. Lo que **no** le aplican son las cuatro condiciones (1)-(4) de arriba, que son
  **para guardias con `git`** y no se extienden — **salvo el centinela de no-vacuidad (2)**,
  que vale para cualquier barrido. **En una línea: si el valor que afirmas sale de recorrer un
  directorio, la aserción tiene que sobrevivir a que ese directorio crezca.** Sobreviven cuatro
  formas: conjunto esperado **vacío**, aserción **por elemento**, **pertenencia** (*«estos
  siguen ahí»*, incluido el prefijo) y **búsqueda por nombre**; no sobrevive la **igualdad
  exacta contra una lista literal no vacía**. Y se reconoce con una pregunta, no con una lista
  de matchers: **¿de quién es la mano que puede poner esto rojo?** — si es la de cualquiera
  que trabaje en otra spec, es criterio de gate. **Esta mitad NO lleva meta-guardia, y es
  decisión registrada, no olvido**: el discriminante exige saber quién escribe en el
  directorio, que es un hecho del **proceso** y no del texto, y el mejor mecanismo textual
  conocido da **tres inocentes por un culpable**. Su disparador es `FOUNDATION.md` (3.er
  corolario), que se lee en el paso 1 de `CLAUDE.md`. Fuente: **ADR-037**, que **precisa**
  ADR-031 pto. 1 y no lo supersede; esta regla **conserva su número** y no nace `RI-04`.
