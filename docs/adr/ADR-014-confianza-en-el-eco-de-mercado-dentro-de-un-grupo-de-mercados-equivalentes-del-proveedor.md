---
id: ADR-014
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-11, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-11, por: humano (Alberto Fojo) — aprobado en el mismo gate que SPEC-021, tras plantearle que la excepcion a ADR-012 se documenta aqui y no dentro de la spec}
---
# ADR-014: Confianza en el eco de mercado dentro de un grupo de mercados equivalentes del proveedor

- Deciders: propone **sdd-arquitecto** (2026-08-11), a partir de un síntoma **observado en producción**, no de un dictamen nuevo de dominio. **Aprobado en el gate por Alberto Fojo (2026-08-11)**: el ADR abre una **excepción** a una cláusula de ADR-012, y la excepción se sostiene sobre una **asunción sobre el mundo exterior** (F-SPEC-021-1) que se le planteó de forma explícita —incluido el riesgo de que, si la asunción fuese falsa, el usuario recibiría un precio equivocado **sin motivo visible**— y que aceptó. **No pasó por sdd-mercados**: queda como **F-ADR-014-1**, ratificación pendiente.
- Specs relacionadas: lo origina **SPEC-021** (Precio de cadena inambigua en mercados pelados). **Precisa ADR-012 pto. 4** (no lo supersede) y deja intactos ADR-012 pto. 3, **ADR-007** (identidad `(ticker, operating MIC)`) y **ADR-002** (puerto, batch, dedupe). Nace de un caso que **SPEC-020** destapó al hacer viables los mercados US.

## Contexto

**ADR-012 pto. 4** ordenó al adaptador de cotizaciones traducir el operating MIC canónico
al dialecto del proveedor y **"validar que el `exchange` devuelto casa"**. Esa cláusula
tiene una razón fuerte: el propio ADR-012 documenta que `SAN` cotiza en Madrid (EUR) y en
NYSE (USD) con precios distintos, y que asignar el precio del mercado equivocado falsearía
el P/L (**RN-09**/**RN-06**). **SPEC-020** la implementó al pie de la letra.

Al hacerlo, apareció un caso que ADR-012 no contempló: **los dos proveedores discrepan
sobre en qué mercado cotiza un valor**.

- El proveedor de **búsqueda** (Twelve Data, ADR-012 pto. 2) sitúa `DOCS` (Doximity) en
  **NYSE**, y ese `XNYS` es lo que guarda `symbols.micCode`. Es correcto.
- El proveedor de **cotizaciones** (Marketstack) **devuelve precio** para `DOCS`
  (`close` 25,63) pero etiqueta la fila con **`exchange: "XNAS"`**.

Con la cláusula tal cual, el eco no casa, no se asigna precio, y el usuario ve una posición
real sin P/L actual y sin zonas evaluadas — el síntoma que **CE-F1** de EPIC-FIX promete no
tener. **No hay salida por datos**: `XNYS` es lo cierto, es lo único que ofrece el buscador
y es lo que el import volvería a poner.

Lo que hace tratable el caso es una particularidad **verificada** de este proveedor
(SPEC-020, tabla del Problema, llamadas reales del 2026-08-11): `XNAS` y `XNYS` son los
**únicos** mercados que Marketstack acepta con el ticker **pelado**. Es decir: son los
únicos donde **la cadena enviada no nombra el mercado**, y por tanto los únicos donde una
discrepancia de etiqueta puede leerse como *"los dos proveedores clasifican distinto el
mismo valor"* en vez de *"el proveedor me está dando otra cosa"*. En un mercado con sufijo
(`MC.XPAR`) le hemos dicho el mercado en la propia cadena: un eco discrepante ahí es una
**anomalía**, y los tickers europeos **no** comparten espacio de nombres (`MC` no es la
misma empresa en París que en Milán).

Precedente interno: el propio adaptador de SPEC-020 ya acepta desambiguar **por unicidad**
—`matchRow()` atribuye una fila sin mercado cuando hay un único pedido con ese ticker—,
pero solo para **fallos**. La cuestión es si esa misma unicidad basta para atribuir un
**precio**, que es una afirmación mucho más fuerte.

## Decisión

1. **Se define el concepto de "grupo de mercados equivalentes para un proveedor"**: un
   conjunto de operating MIC que, **para ese proveedor concreto**, cumple las tres
   condiciones a la vez:
   - **(a) Cadena indistinguible**: el proveedor pide sus símbolos **pelados**, de modo que
     la cadena enviada **no nombra** el mercado.
   - **(b) Divisa homogénea**: todos los mercados del grupo cotizan en la **misma divisa**.
     Es la condición que protege **RN-09**, porque el refresco pone la divisa **del
     símbolo** y el proveedor no manda divisa alguna.
   - **(c) Espacio de nombres de tickers compartido y único**: una misma cadena **no puede**
     ser dos empresas distintas dentro del grupo.
2. **Dentro de un grupo equivalente, el eco discrepante se acepta si la cadena es
   inambigua.** Si la cadena enviada corresponde a **un único** pedido del lote y el
   mercado del eco pertenece al **mismo grupo** que el mercado pedido, el precio se asigna
   a ese pedido **aunque el `exchange` nombre otro mercado del grupo**. Esto **precisa
   ADR-012 pto. 4**: la validación del eco deja de ser "igualdad de MIC" y pasa a ser
   "igualdad de MIC **o** equivalencia dentro del grupo con cadena inambigua". **No se
   supersede** ADR-012: fuera de esa condición, la cláusula original rige entera.
3. **Todo lo demás sigue en rechazo estricto**, y esto es parte de la decisión, no una
   omisión: mercados **con sufijo** (la cadena ya nombra el mercado), cadenas **ambiguas**
   (dos o más pedidos comparten cadena: ahí el eco es la única información que los
   distingue), ecos de mercados **fuera del grupo**, y filas **sin mercado legible** — no
   comprobar no equivale a comprobar y aceptar.
4. **La identidad del dominio no se toca**: el precio se asigna con el **operating MIC del
   pedido** (ADR-007/ADR-012 pto. 3). El mercado que dijo el proveedor **no** sustituye al
   del símbolo en ninguna parte, ni se le muestra al usuario. Solo viaja como dato
   observable del ciclo.
5. **El grupo es una tabla declarada y auditable en el adaptador**, junto a su tabla de
   dialecto (ADR-012 pto. 4: es conocimiento **de proveedor**), con la **procedencia del
   dato y el argumento de seguridad escritos al lado**. Hoy tiene **un** grupo:
   **`{XNAS, XNYS}`** — USD, tickers únicos entre NYSE y Nasdaq, ambos pedidos pelados.
6. **Ampliar el grupo, o crear uno nuevo, exige un ADR.** No es un `push` a una tabla:
   cada miembro obliga a rehacer las tres condiciones (a)(b)(c) con evidencia. En
   particular, **un grupo NUNCA puede mezclar divisas**.
7. **La asunción se declara revisable y se registra** (F-SPEC-021-1 en SPEC-021): las tres
   condiciones del grupo `{XNAS, XNYS}` son afirmaciones sobre el mundo exterior, no
   invariantes demostrados por nuestros tests.

## Consecuencias

### Positivas

- **Devuelve el precio a un valor real** sin degradar el guardarraíl donde importa: el
  rechazo estricto sigue vigente en **todos** los casos donde una equivocación podría
  significar otra empresa u otra divisa.
- **Convierte un accidente en un criterio.** Antes había una regla implícita ("el eco debe
  casar") con una excepción que se iba a descubrir valor a valor; ahora hay una condición
  **explícita y comprobable** para cuándo se puede confiar en la unicidad.
- **Acota el radio de daño por construcción**: como la divisa la pone el símbolo (RN-09) y
  el grupo es homogéneo en divisa, el peor caso concebible dentro del grupo es el precio de
  **la misma empresa** en el otro mercado US, no el de otra empresa ni el de otra divisa.
- **Cero cambios de dominio**: cartera, motor de disparo, avisos y UI intactos; el puerto
  solo gana un campo **opcional** y aditivo.
- **Deja rastro** (SPEC-021 CA-8): si el proveedor empieza a etiquetar mal de forma masiva,
  se ve en el resultado del ciclo y no en el P/L de un usuario.

### Negativas / follow-ups

- **Se acepta un precio cuya etiqueta de mercado no casa.** Es una **rebaja real** de un
  invariante, por acotada que esté. Si la asunción (c) fuera falsa para algún ticker
  —dos empresas distintas con la misma cadena entre NYSE y Nasdaq—, el usuario recibiría el
  precio equivocado **sin motivo visible**, que es peor que el fallo actual: hoy al menos
  se ve que algo pasa. **El caso a favor**: la unicidad de tickers entre NYSE y Nasdaq es
  la razón por la que el proveedor puede permitirse aceptarlos pelados.
- **F-ADR-014-1 (la asunción no está verificada por nosotros).** Las tres condiciones se
  dan por buenas por conocimiento general de mercado, no por un dictamen citado.
  **Follow-up: pasarla por sdd-mercados** para que la ratifique o la mate con fuente
  —especialmente (c)—, como ADR-012 hizo con la cobertura del proveedor. Es exactamente la
  lección de ADR-002 que ADR-012 pagó: *verificar la premisa antes de fijarla*.
- **Riesgo de erosión**: la tentación de "meter un mercado más en el grupo" cuando aparezca
  el siguiente síntoma. Mitigación: punto 6 (ADR obligatorio) y el argumento escrito junto
  a la tabla.
- **Depende de que el proveedor siga devolviendo `exchange`.** Si dejara de mandarlo, se
  vuelve al rechazo estricto (fallo seguro, con motivo veraz): degrada bien, pero degrada.
- **No arregla `F-SPEC-020-5`** (el P/L resuelve el precio por ticker, no por
  `(ticker, MIC)`): esta decisión mantiene una sola cotización por símbolo con el MIC del
  pedido, así que no lo agrava — pero tampoco lo cierra, y sigue siendo el defecto que más
  cerca está de este terreno.

## Alternativas consideradas

- **No hacer nada: dejar el valor sin precio.** Cero riesgo técnico y guardarraíl intacto.
  **Rechazada** porque el síntoma es una posición real sin P/L actual (RN-06) ni zonas
  evaluadas (RN-11), que es justo lo que **CE-F1** de EPIC-FIX promete, y porque no depende
  de nosotros arreglarlo: el dato nuestro es correcto y el proveedor no va a cambiar su
  etiqueta.
- **Corregir el dato: mover `DOCS` a `XNAS`.** Un `UPDATE` y desaparece el síntoma.
  **Rechazada**: sería falsificar el mercado del valor para contentar al adaptador. `XNYS`
  es lo cierto, es lo único que ofrece el buscador (ADR-012 pto. 2) y el import lo volvería
  a poner (`MARKET_MAP`, ADR-009). Además rompe el invariante que ADR-007 protege — la
  identidad de mercado del símbolo — para arreglar un detalle de adaptador, que es
  exactamente al revés de como debe fluir.
- **Relajar el eco en general** (aceptar cualquier precio cuando la cadena corresponde a un
  único pedido, con o sin sufijo). Es la formulación más simple y arreglaría también
  síntomas futuros. **Rechazada por insegura**: un pedido único `MC@XPAR` con eco `XMIL`
  le colgaría a LVMH el precio de otra empresa, y un eco `XETRA` sobre una cadena US
  metería un importe en EUR en un símbolo USD (RN-09). La simplicidad del enunciado se
  paga con precios falsos.
- **Relajar solo por "cadena pelada"**, sin exigir unicidad. **Rechazada**: es literalmente
  el escenario de SPEC-020 CA-5 (mismo ticker en XNAS y XNYS produce **la misma cadena**),
  donde el eco es la única información que distingue a qué posición pertenece el precio.
  Relajar ahí cruzaría precios entre dos posiciones distintas del usuario.
- **Ignorar el `exchange` y fiarse solo del ticker.** Es la alternativa que **ADR-012 ya
  rechazó** ("quitar el `mic_code` de la petición... peor que el bug"). Sigue rechazada por
  el mismo motivo, y esta decisión es su opuesto: el eco se lee **siempre** y se exige que
  esté en el grupo.
- **Pedir los símbolos US con sufijo para que el eco case.** **Imposible**: verificado en
  SPEC-020 que `.XNAS`/`.XNYS` son inválidos para este proveedor. Es la causa raíz de que
  la cadena sea indistinguible.
- **Cambiar de proveedor de cotizaciones (EODHD u otro).** **Rechazada aquí**: es una
  decisión de ADR-012 con su análisis de coste y licencia, y un caso de etiqueta
  discrepante en un valor no la reabre. Queda como está: EODHD sigue siendo el segundo
  adaptador si Marketstack falla.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
