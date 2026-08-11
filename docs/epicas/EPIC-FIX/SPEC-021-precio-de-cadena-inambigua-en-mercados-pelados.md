---
id: SPEC-021
tipo: spec
epica: EPIC-FIX
estado: hecho
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-11, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-11, por: humano (Alberto Fojo) — visto bueno en sesion sobre el resumen de los 9 CA y sobre la asuncion critica de F-SPEC-021-1 (unicidad de ticker NYSE/Nasdaq y divisa unica)}
  - {estado: en-progreso, fecha: 2026-08-11, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-11, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-08-11, por: sdd-verificador}
---
# SPEC-021 — Precio de cadena inambigua en mercados pelados

## Problema

**SPEC-020 arregló el dialecto y destapó el siguiente escalón: los dos proveedores
discrepan sobre en qué mercado cotiza un valor, y el guardarraíl deja al usuario sin un
precio que existe.**

Observado en producción hoy (2026-08-11, con SPEC-020 ya desplegada): `WEN`, `TTD` y `PHM`
cotizan — el arreglo del dialecto funciona. Pero **DOCS** (Doximity) sigue sin precio, y el
motivo que lee el usuario es `simbolo_no_admitido`: *"Nuestro proveedor no nos da precio
para este símbolo en este mercado"*. Es **cierto pero inútil**: el precio existe.

Causa exacta, deducida de `marketstack-provider.ts` y confirmada contra la API:

- Nuestra BD guarda `DOCS` con operating MIC **`XNYS`**. Es **correcto**: Doximity cotiza
  en el NYSE, y así lo devuelve el buscador (Twelve Data, **ADR-012** pto. 2).
- Marketstack **sí devuelve precio** para la cadena pelada `DOCS` (`close` 25,63), pero
  etiqueta la fila con **`exchange: "XNAS"`**.
- El eco no casa con el mercado pedido → **CA-4 de SPEC-020** se niega a asignar el precio
  (`askable.find(x => x.ticker === ticker && x.mic === micEco)` no encuentra nada), y el
  barrido final lo reporta como `simbolo_no_admitido` porque su cadena **sí** trajo precio
  (`conPrecio.has(a.sent)`).

**No hay apaño por datos.** Cambiar el MIC del símbolo a `XNAS` sería falsificar el
mercado para contentar al adaptador: el buscador solo ofrece NYSE, que es lo cierto, y el
import (**ADR-009**/`MARKET_MAP`) volvería a poner `XNYS`. Tampoco es un defecto de
SPEC-020: su guardarraíl es **correcto en su intención** — un precio del mercado
equivocado falsea el P/L (**RN-09**/**RN-06**) y es peor que ningún precio. El problema es
que ese guardarraíl es **más ancho de lo que necesita ser**, y su exceso cuesta un
síntoma real: una posición de la cartera del usuario sin P/L actual (**RN-06**) y sin
zonas evaluadas (**RN-11**) — exactamente lo que **CE-F1** de EPIC-FIX promete.

### La regla, y por qué se formula así

> Cuando la cadena enviada al proveedor **no nombra ningún mercado** (se pidió pelada),
> **corresponde a un único pedido** del lote, y el mercado del eco pertenece al **mismo
> grupo de mercados equivalentes** que el pedido, el precio devuelto se asigna a ese
> pedido **aunque el `exchange` del eco nombre otro mercado del grupo**. En cualquier otro
> caso se mantiene el rechazo estricto de SPEC-020.

La pregunta que hay que contestar es sobre qué se formula la relajación: sobre *"cadena
pelada"* o sobre *"cadena inambigua"*. **Ninguna de las dos por separado es segura**, y la
regla es la **conjunción** de ambas más una tercera condición:

- **Solo "cadena inambigua" NO basta.** Un único pedido `MC@XPAR` viaja como `MC.XPAR`; si
  el eco dijera `XMIL`, relajar le colgaría a LVMH el precio de **otra empresa** en otro
  mercado. Los tickers europeos **no** comparten espacio de nombres.
- **Solo "cadena pelada" NO basta.** Es justo el caso de **CA-5 de SPEC-020**: el mismo
  ticker pedido en `XNAS` y en `XNYS` produce **la misma cadena**, y ahí el eco es la
  **única** información que distingue a qué pedido pertenece el precio. Relajar sería
  cruzar precios entre dos posiciones distintas.
- **Falta una tercera condición que el enunciado corto esconde: el mercado del eco tiene
  que estar en el grupo.** Una cadena pelada y única cuyo eco dijera `XETRA` sería un
  listado alemán **en EUR** de un valor que tenemos en USD; como el refresco pone la
  divisa **del símbolo** (**RN-09**, `refresh.ts`), guardaríamos un importe en euros
  etiquetado como dólares. La homogeneidad de divisa **no es un adorno del argumento: es
  la condición que hay que comprobar**, y se comprueba mirando el mercado del eco.

Por eso la regla se formula sobre **la cadena dentro de un grupo de mercados
equivalentes**: un conjunto declarado en el adaptador (hoy `{XNAS, XNYS}`) cuyos miembros
(a) se piden **pelados** —la cadena no puede desambiguarlos—, (b) comparten **divisa**, y
(c) comparten **espacio de nombres de tickers**. Los mercados **con sufijo** llevan el
mercado en la propia cadena: ahí un eco discrepante sigue siendo **sospechoso** y no se
relaja nada.

### Asunción revisable (es lo que carga con todo el peso)

Esta spec **no demuestra** que asignar el precio sea correcto: **asume** tres cosas del
mundo exterior, y las declara para que se puedan refutar. Se registran juntas como
**F-SPEC-021-1**:

1. **La ambigüedad solo aparece en el grupo pelado.** Hoy `XNAS` y `XNYS` son los únicos
   mercados que Marketstack acepta sin sufijo (tabla verificada de SPEC-020).
2. **Los dos son USD**, luego **RN-09** no se puede violar por esta vía *dentro del grupo*.
3. **Los tickers estadounidenses son únicos entre NYSE y Nasdaq**: la misma cadena no
   puede ser dos empresas distintas. (Es la razón por la que el propio proveedor puede
   permitirse aceptarlos pelados.)

**Qué pasa si una asunción se rompe**: si el proveedor empezara a aceptar pelado un
mercado de otra divisa, o si un ticker US dejara de ser único, el grupo dejaría de ser
seguro. Por eso el grupo es una **tabla declarada y auditable**, no una heurística
derivada, y por eso ampliarlo exige rehacer el argumento mercado a mercado (ver el ADR).

### Alcance de la corrección

Es **detalle de adaptador**, como SPEC-020. Precisa **ADR-012** pto. 4 (la cláusula
"valida que el `exchange` devuelto **casa**"), y esa precisión —por ser una excepción a
una decisión aceptada— se registra en un **ADR propio**, no en silencio dentro de esta
spec. Reglas: **RN-09**, **RN-06**, **RN-12**, **RN-11**, **D-2**. Cierra el último
síntoma abierto de **CE-F1** en la cartera real. Dominio: sdd-mercados.

## Usuarios / roles afectados

- **Usuario final**: la posición de un valor cuyo mercado los dos proveedores no cuentan
  igual (hoy **DOCS**) pasa a tener **P/L actual con dato** (**RN-06**) y **zona
  evaluada** (**RN-11**), con su `asOf` (**D-2**). Sigue viendo el mercado que su símbolo
  dice (**NYSE**), porque es el cierto: la discrepancia es del proveedor y **no se le
  traslada**.
- **Usuario final (lo que NO cambia)**: sigue sin poder recibir jamás el precio de otra
  empresa ni de otra divisa. Todo lo que SPEC-020 rechazaba por sospechoso —mercados con
  sufijo, cadenas ambiguas, ecos de fuera del grupo— **se sigue rechazando igual**.
- **Operador**: cuando el precio se asigne con una etiqueta de mercado discrepante, queda
  **constancia** en el resultado del ciclo. Si mañana el proveedor empieza a mentir en el
  `exchange`, se ve; no se descubre por el P/L de un usuario.

## Criterios de aceptación

Cada CA es verificable con un test. Se usan fakes y `fetch` inyectado (patrón de
SPEC-015/016/020): **NO se llama a la API real de Marketstack** — los datos ya están
verificados (SPEC-020 y el síntoma de DOCS de hoy) y quedan ~85 llamadas del mes.

- **CA-1 (El caso real: DOCS cotiza).**
  Dado un único pedido `DOCS@XNYS`, que viaja como cadena **pelada** `DOCS`, y una
  respuesta `{symbol:"DOCS", exchange:"XNAS", close:25.63, date}`,
  cuando el adaptador responde,
  entonces el precio **se asigna** a ese pedido: sale en `quotes` con `price` = `close` no
  ajustado (**RN-12**) y `asOf` = `date` (**D-2**), y **deja de salir** en `failures` con
  `simbolo_no_admitido`.
- **CA-2 (El mercado que viaja al dominio es el DEL PEDIDO, y el ciclo lo persiste).**
  Dado el mismo caso,
  cuando la cotización llega al dominio,
  entonces su `micCode` es **`XNYS`** —el del pedido, que es el que el dominio tiene por
  cierto— y **no** `XNAS`, de modo que `quoteKey(ticker, micCode)` empareja en
  `refresh.ts`; el precio se persiste con la divisa **del símbolo** (**RN-09**), se
  **limpia** su diagnóstico (**SPEC-016** CA-8) y el P/L actual pasa a tener dato
  (**RN-06**). El mercado del eco **no** sustituye al del símbolo en ningún sitio.
- **CA-3 (Cadena AMBIGUA: sigue el rechazo estricto — SPEC-020 CA-5 intacto).**
  Dado el mismo ticker pedido a la vez en `XNAS` y en `XNYS` (dos pedidos, **misma
  cadena** pelada) y un eco que confirma solo uno de los dos,
  cuando el adaptador responde,
  entonces el precio se asigna **solo** al mercado que el eco confirma y el otro sale en
  `failures` con `simbolo_no_admitido`, **exactamente como hoy**. Con dos pedidos
  compitiendo por la cadena, el eco es la única información que los distingue: aquí no se
  relaja nada.
- **CA-4 (Mercado CON sufijo: sigue el rechazo estricto — SPEC-020 CA-4 intacto ahí).**
  Dado un único pedido de un mercado con sufijo (p. ej. `MC@XPAR`, que viaja como
  `MC.XPAR`) y un eco cuyo `exchange` nombra otro mercado,
  cuando el adaptador responde,
  entonces **NO** se le asigna el precio: sale en `failures` con motivo. La cadena ya
  nombraba el mercado, así que un eco discrepante es una **anomalía**, no una diferencia
  de criterio — y los tickers europeos no comparten espacio de nombres.
- **CA-5 (Eco FUERA del grupo: sigue el rechazo estricto, aunque la cadena sea pelada y
  única).**
  Dado un único pedido `WEN@XNAS`, que viaja pelado, y un eco cuyo `exchange` es un
  mercado que **no** está en el grupo equivalente (p. ej. `XETRA`),
  cuando el adaptador responde,
  entonces **NO** se le asigna el precio. Es el guardarraíl de divisa: el refresco pondría
  la divisa del símbolo (USD) sobre un importe en EUR y falsearía el P/L (**RN-09**).
- **CA-6 (Eco SIN mercado: sigue el rechazo estricto).**
  Dado un único pedido pelado y una fila **sin** `exchange` y **sin** sufijo en `symbol`,
  cuando el adaptador responde,
  entonces **NO** se le asigna el precio y sale con su motivo. La relajación exige **leer**
  el mercado del eco y comprobar que está en el grupo; una fila que no lo dice no permite
  comprobar nada, y no comprobar no es lo mismo que comprobar y aceptar.
- **CA-7 (El emparejamiento exacto manda; ningún pedido recibe dos precios).**
  Dado un lote donde el proveedor devuelve, para la misma cadena, una fila que **casa**
  con el mercado pedido y otra que no,
  cuando el adaptador responde,
  entonces el pedido se queda con la fila que **casa** (la relajación es un segundo paso,
  solo sobre pedidos que han quedado sin precio) y recibe **una sola** cotización. Si dos
  filas del grupo compiten por el mismo pedido y **ninguna** casa exactamente, **no se
  asigna ninguna**: se falla seguro, como en SPEC-020.
- **CA-8 (Queda constancia observable de la etiqueta discrepante).**
  Dado un precio asignado por esta vía,
  cuando termina el ciclo,
  entonces el resultado del ciclo (`RefreshResult`, que ya viaja entero al cuerpo de la
  respuesta del cron) hace constar el caso con **ticker, mercado pedido y mercado del
  eco**; y al usuario **no se le muestra nada** —para él no ha fallado nada: hay precio y
  **no** hay diagnóstico (**SPEC-016**)—. Sin tabla nueva, sin telemetría nueva y sin
  reutilizar `quote_diagnostics`, que es el canal de *"no hay precio"* y aquí sí lo hay.
- **CA-9 (Sin regresión: SPEC-020 sigue en pie salvo el caso que esta spec deroga).**
  Dado el ciclo completo con la suite existente,
  cuando se ejecuta,
  entonces siguen verdes CA-1/2/3/5/6/7/8/9/10 de SPEC-020 (dialecto por mercado, dedupe
  de la cadena, colisión US, `mercado_no_cubierto`, fallo global sin `throw`, motivos
  distintos, degradación en `refresh.ts`) y toda la suite de SPEC-015/016; y el **único**
  test que cambia de expectativa es
  `tests/market-provider-dialect.test.ts › CA-4 › "un eco con exchange XNYS NO se le
  asigna al pedido de XNAS"` — porque es **literalmente el escenario que esta spec
  deroga** (un solo pedido, cadena pelada, eco dentro del grupo), no una aserción
  debilitada para que pase el código.

## Entidades y reglas afectadas

- **`market/marketstack-provider.ts`** (todo el cambio de comportamiento):
  - Una **tabla declarada** de grupos de mercados equivalentes para *este* proveedor, hoy
    con un solo grupo: `{XNAS, XNYS}`. Es conocimiento **de proveedor** (qué mercados
    comparten cadena) con una **justificación de dominio** (divisa y espacio de nombres),
    así que vive **aquí** junto a `PROVIDER_SUFFIX` y **no** en `market/mic.ts`
    (**ADR-012** pto. 4). Debe llevar, como `PROVIDER_SUFFIX`, la **procedencia del dato y
    el argumento de seguridad** en el propio comentario: quien la amplíe tiene que ver por
    qué no es libre hacerlo.
  - La atribución pasa a dos pasos: **(1)** emparejado exacto por `(ticker, MIC del eco)`,
    igual que hoy; **(2)** para los pedidos que queden sin precio, relajación si y solo si
    la cadena era pelada, corresponde a **un único** pedido del lote, y el mercado del eco
    está en el **mismo grupo** que el del pedido.
  - El emparejado exacto **sigue teniendo prioridad** y el barrido final de `pedidos` (y
    su motivo `simbolo_no_admitido`) **sigue igual** para todo lo no relajado.
  - Precedente interno que esta spec extiende, no inventa: `matchRow()` ya acepta atribuir
    una fila **sin mercado** a un pedido cuando hay **un único** candidato con ese ticker.
    SPEC-020 ya consideró segura la desambiguación por unicidad; lo hacía solo para
    **fallos**, y esta spec la lleva a **precios**, acotada por el grupo.
- **`market/provider.ts`**: `ProviderQuote` gana **un campo opcional** para el mercado que
  el proveedor etiquetó cuando difiere del pedido (CA-8). Es **aditivo y opcional**: el
  fake y cualquier otro adaptador siguen valiendo sin tocarse. `quoteKey`, `QuotesResult`,
  `QuoteFailureReason` y `ProviderFailure` **no cambian** — en particular, esta spec **no
  añade ningún motivo nuevo** al vocabulario.
- **`market/refresh.ts`**: `RefreshResult` gana la lista observable de CA-8. El
  emparejado por `quoteKey`, la divisa del símbolo, el diagnóstico y el `try/catch` de
  SPEC-020 CA-9 **no cambian**. La forma exacta (nombre del campo) la decide el
  implementador; el CA fija lo observable.
- **`market/mic.ts`**, **`market/fail-reason-text.ts`**, cartera, motor de disparo, avisos
  y UI: **no se tocan**.
- Reglas: **RN-09** (divisa/mercado — la protege el grupo, no el eco), **RN-06** (sin
  precio no hay P/L), **RN-12** (`close` no ajustado), **RN-11** (evaluación de zona),
  **D-2** (`asOf`), **RN-01/RN-03** (aislamiento, intactos).
- Decisiones: **ADR-014** (esta spec lo origina: precisa la cláusula de ADR-012 pto. 4 que
  exige que el eco case), **ADR-012** (pto. 3 y 4: la identidad canónica del dominio sigue
  siendo el operating MIC del símbolo), **ADR-007** (identidad `(ticker, operating MIC)`,
  intacta), **ADR-002** (puerto, batch y dedupe, intactos).

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Ampliar el grupo equivalente a otros mercados.** Hoy tiene exactamente un grupo,
  `{XNAS, XNYS}`. Añadir cualquier otro exige rehacer el argumento (divisa + espacio de
  nombres + cadena pelada) mercado a mercado, y eso es un ADR, no un `push` a una tabla.
- **Relajar el eco en mercados con sufijo** (CA-4) o **con eco ausente** (CA-6): sería
  cambiar el guardarraíl por una heurística.
- **Corregir el dato de mercado del símbolo** (mover `DOCS` a `XNAS`, o reconciliar los
  dos proveedores): no procede — `XNYS` es lo cierto y lo que devuelve el buscador. Y
  **con más razón hoy**: `F-SPEC-020-5` (el P/L resuelve el precio por TICKER, no por
  `(ticker, MIC)`) sigue abierto; tocar MICs a mano mientras eso está vivo es pedir un
  segundo defecto.
- **`F-SPEC-020-5`** (el P/L mapea precios por ticker) **no se arregla aquí**: es un
  defecto **aguas abajo**, en la lectura de cartera, y merece su propia spec. Esta spec no
  lo agrava: sigue habiendo **una** cotización por símbolo, con el MIC del pedido.
- **`XSTO`** (`F-SPEC-020-1`): sigue sin dialecto verificado y sin pedirse. Nada que ver
  con esta relajación.
- **Persistir o alertar sobre las etiquetas discrepantes** (histórico, umbrales, aviso al
  operador): CA-8 deja constancia en el resultado del ciclo, que es el canal que ya
  existe. Convertirlo en telemetría es **EPIC-MEJORA**.
- **Llamar a la API real** en tests o para "confirmar" el caso de DOCS: prohibido (~85
  llamadas libres este mes). El síntoma ya está observado en producción.
- **Cambiar de proveedor** de cotizaciones o de búsqueda: **ADR-012** sigue vigente. Que
  los dos discrepen sobre el mercado de un valor es exactamente el escenario que ADR-007
  previó al separar los puertos.

## Notas para el gate humano

1. **Lo que hay que mirar con lupa es la asunción, no el código** (**F-SPEC-021-1**). El
   cambio es pequeño y sus tests son fáciles; lo que sostiene la corrección es una
   afirmación sobre el mundo: *NYSE y Nasdaq comparten divisa y espacio de tickers*. Es
   cierta hoy y ampliamente conocida, pero **no la hemos verificado nosotros contra una
   fuente**, y no se puede verificar con los tests. Si te incomoda, el sitio para decirlo
   es este punto — y la alternativa honesta está en el punto 4.
2. **Se deroga un caso de SPEC-020 CA-4, y se dice en voz alta.** SPEC-020 CA-4 decía
   *"eco de otro mercado → nunca el precio"*. Queda **matizado**: sigue entero para
   mercados con sufijo (CA-4 aquí), cadenas ambiguas (CA-3), ecos fuera del grupo (CA-5) y
   ecos sin mercado (CA-6); pierde **solo** el caso "cadena pelada + un único pedido + eco
   del mismo grupo". **CA-5 de SPEC-020 queda intacta**. En la suite cambia **un** test
   —el de CA-4— y CA-9 exige que sea exactamente ese: si al implementar hiciera falta
   tocar otro, es señal de que la regla está mal acotada y hay que volver aquí.
3. **Hay ADR nuevo, y aquí sí.** SPEC-020 argumentó que no hacía falta ADR porque
   *cumplía* ADR-012 pto. 4. Esta spec hace lo contrario: **abre una excepción** a la
   cláusula "valida que el `exchange` devuelto casa". Un ADR aceptado es inmutable y una
   spec no puede recortarlo en silencio, así que la excepción —y su condición de validez—
   se registran en **ADR-014** (en borrador, se aprueba en el mismo gate). Si prefieres
   que la asunción viva solo en la spec, dilo: es defendible, pero entonces el próximo que
   añada un mercado no tendrá dónde leer por qué no puede ampliar la tabla.
4. **La alternativa que descarté, para que puedas discrepar**: dejar a DOCS sin precio y
   **arreglar el dato** (o esperar a que el proveedor corrija su etiqueta). Es la opción
   más conservadora y no toca ningún guardarraíl. La descarté porque el dato **no está
   mal** —`XNYS` es correcto y es lo que devuelve el buscador—, porque no controlamos al
   proveedor, y porque el síntoma es una posición real sin P/L, que es justo lo que
   **CE-F1** promete arreglar. La segunda alternativa, relajar el eco **en general**, la
   descarté por insegura (ver "La regla, y por qué se formula así").
5. **El usuario no ve ni entiende nada de esto**, y es a propósito: ve el precio y su
   mercado (`NYSE`), que es el cierto. La discrepancia es ruido del proveedor y se queda
   en el log del ciclo (CA-8). Si prefieres que se le muestre algo, es decisión de
   producto y cambia CA-8.
6. **Aprobación**: la spec queda en **`borrador`** y **no la firmo yo**. La aprobación de
   SPEC-020 quedó registrada como delegación **sin lectura humana** (`F-SPEC-020-2`, que
   además dejó el estado bloqueado); tú decides cómo registrar este gate. Yo no acumulo
   otra.
