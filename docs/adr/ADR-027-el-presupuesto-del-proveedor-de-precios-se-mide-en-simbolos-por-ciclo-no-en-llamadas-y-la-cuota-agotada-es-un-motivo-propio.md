---
id: ADR-027
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-21, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-21, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-027: El presupuesto del proveedor de precios se mide en simbolos por ciclo, no en llamadas; y la cuota agotada es un motivo propio

- Deciders: propone **sdd-arquitecto** (2026-08-21) al escribir **SPEC-043**, con **dictamen
  de dominio de sdd-mercados** verificado **contra la API real** (tres llamadas medidas con
  la misma clave) **y corroborado por la documentación del propio proveedor**. El humano
  (Alberto Fojo) respondió al gate el **2026-08-21** —umbral, vocabulario, `outcome` y las
  dos exclusiones— y **lo aprobó ese mismo día**. A partir de aquí es **inmutable**: para
  cambiarlo, otro ADR que lo supersede. **No decide el plan ni el proveedor**: eso es
  producto y coste, y es del humano (ver pto. 7).
- Specs relacionadas: nace de **SPEC-043** (EPIC-FIX), que es su primera y única aplicación.
  **Enmienda una cláusula de ADR-002 pto. 4** y **corrige una cifra de ADR-012**, dejando
  intacto todo lo demás de ambos —el mismo encuadre con el que **ADR-024** enmendó D-6 de
  **ADR-018**—. Amplía el juego de motivos de **ADR-012 pto. 6** (que es de donde salen
  `QuoteFailureReason`, SPEC-016 y SPEC-020). No supersede a nadie.

## Contexto

### El incidente, medido (2026-08-21)

El ciclo diario llevaba desde el **2026-08-19** sin actualizar ni un precio y nadie se
enteró durante tres días. Los hechos, leídos de producción:

- **`cron_runs`**: run del `2026-08-19T22:12Z` y run del `2026-08-20T22:14Z`, los dos con
  `outcome='success'`, `requested=13`, `updated=0`, `skipped=13`.
- **`quote_diagnostics`**: los **13** símbolos con `reason='proveedor_no_disponible'`,
  escritos **en el mismo segundo** — firma de un fallo **global**, no de trece fallos por
  símbolo.
- **Causa externa**: Marketstack respondió **HTTP 429** con
  `{"code":"usage_limit_reached","message":"Your monthly usage limit has been reached."}`.
- **Última ingesta buena**: `2026-08-18T23:43Z`. El producto llevaba tres días enseñando
  el mismo precio con cara de vigente.

### Dictamen de sdd-mercados (2026-08-21): la cuota se cuenta por símbolo

Dos patas independientes que dicen lo mismo:

1. **Medición contra la API real**, misma clave, tres llamadas seguidas: **13 símbolos →
   429 `usage_limit_reached`**; **1 símbolo → 200**; **5 símbolos → 200**. Si el límite
   fuera **por petición**, la de un solo símbolo habría fallado igual. No falló.
2. **La documentación del proveedor dice literalmente lo mismo**: *«Each time the
   marketstack API service is used to look up data for one specific stock ticker, one API
   request is consumed. If a given API request contains 5 tickers, 5 API requests will be
   consumed»* (marketstack.com/faq). Free tier = **100 peticiones/mes**; sobregiro máximo
   del **5 %**; corte total al **120 %** salvo *overage billing*; avisos automáticos al
   **75/90/100 %** por correo al titular de la cuenta; **los errores no consumen cuota**;
   **5 req/s** y hasta **100 símbolos por petición**.

   > **Los avisos al 75/90/100 % existen en la documentación y NO existen en la práctica**
   > (constatado el 2026-08-21). La clave `MARKETSTACK_API_KEY` de producción pertenece a
   > una **cuenta de prueba creada con un correo cualquiera que el titular no administra**,
   > así que esos correos **van a un buzón que nadie lee**. Es la explicación de por qué el
   > incidente **no fue** «teníamos aviso y lo ignoramos»: el aviso nunca llegó a nadie.
   > **Este ADR no usa ese canal como mitigación en ningún punto**, y quien lo lea después
   > de que la clave se rote tampoco debe hacerlo sin comprobar quién administra la cuenta.

Aritmética del proyecto bajo esa regla: **13 símbolos × ~31 días ≈ 400 unidades/mes**
contra las **100** del free tier. El presupuesto muere hacia el **octavo día** del ciclo de
facturación — exactamente donde se congelaron los precios.

### Qué premisa se rompe

**ADR-002 pto. 4** fijó la caché deduplicada con este argumento: *«1 símbolo = 1 llamada,
sirva a 1 o a 100 usuarios»*, y en Consecuencias: *«Coste de API escala con símbolos
distintos, no con usuarios → free tier rinde»*.

La primera mitad **sigue siendo cierta y es lo valioso**: pedir cada símbolo una sola vez
por ciclo hace que el coste escale con **símbolos**, no con **usuarios**. La segunda —que
por eso *el batch ahorra cuota* y *el free tier rinde*— es **falsa para Marketstack**: el
batch ahorra una conexión, no un crédito.

**ADR-012 heredó el error y lo escribió como cifra**: *«el consumo real (~30 llamadas/mes)
cabe en las 100»*. Contó **llamadas** donde había que contar **símbolos**, y lo contó sobre
un universo que hoy es de trece. La misma frase está en **EPIC-FIX** (*«además es
innecesario: el consumo real (~30 llamadas/mes) cabe de sobra en las 100»*), donde sirvió
para descartar —con razón, pero por el motivo equivocado— las cuentas múltiples.

### Por qué esto es un ADR y no una nota en una spec

La premisa no describe un defecto de código: describe **cómo se mide el coste de un
proveedor de precios**, y es el criterio con el que se elegirá el siguiente. Dejarla
escrita mal donde está significa que el próximo cambio de proveedor volverá a hacer la
cuenta con la unidad equivocada. Es la lección que **ADR-012 se apuntó a sí mismo**
—*«verificar la cobertura del mercado real ANTES de fijar un proveedor»*— repetida en el
eje del **coste** en vez del de la **cobertura**.

### El segundo hecho: el motivo que se persistió era falso

`classifyGlobal` (`src/lib/market/marketstack-provider.ts:171`) no tiene rama para HTTP 429
ni para `usage_limit_reached`, así que la respuesta cayó al motivo por defecto,
`proveedor_no_disponible`, cuyo contrato escrito en `src/lib/market/provider.ts` y en
`fail-reason-text.ts` promete que *«es transitorio y el próximo ciclo puede ir bien»* y le
dice al usuario *«se reintentará en el próximo ciclo»*.

**No lo era.** La cuota agotada es terminal hasta que renueve el mes o se cambie de plan:
reintentar mañana falla igual, y falló igual dos días seguidos. Al operador se le dijo *«el
proveedor se cayó»* cuando la verdad era *«te has quedado sin cuota»* — que pide una acción
**distinta** (reponer, no esperar). Un motivo mentiroso es exactamente el defecto que
**EPIC-FIX** vino a matar (**CE-F2**), y es el mismo razonamiento con el que **SPEC-020**
separó `simbolo_no_admitido` de `proveedor_no_disponible`.

## Decisión

1. **El presupuesto de un proveedor de precios se mide en `símbolos distintos × ciclos`,
   no en llamadas.** Es la unidad canónica del proyecto para dimensionar un plan, verificar
   un free tier y comparar proveedores. Toda decisión futura sobre plan o proveedor hace la
   cuenta en esta unidad y la **deja escrita** con el universo de símbolos que supone.

2. **Enmienda a ADR-002 pto. 4 — una sola cláusula.** La **deduplicación por símbolo se
   reafirma íntegra**: sigue siendo obligatorio pedir cada símbolo **una sola vez por
   ciclo**, y sigue siendo cierto que el coste escala con **símbolos distintos y no con
   usuarios**, que es lo que la hacía valer y sigue haciéndola valer. Lo que **se retira**
   es la inferencia *«…y por eso el free tier rinde»*: el batch **no ahorra cuota**; ahorra
   latencia, sockets y superficie de fallo. **Quien lea ADR-002 pto. 4 a partir de hoy debe
   leerlo junto a este ADR.** El resto de ADR-002 —puerto `MarketDataProvider`, registro
   compartido de símbolos, `asOf` explícito, cadencia diaria por Cron, ajustado vs. no
   ajustado— queda **vigente y sin tocar**, y se **reafirma por escrito**.

3. **Corrección de cifra en ADR-012 (y en EPIC-FIX).** La frase *«el consumo real (~30
   llamadas/mes) cabe en las 100»* queda **medida como falsa**: el consumo real es de **~400
   unidades/mes** con trece símbolos. Todo lo demás de ADR-012 —Marketstack como adaptador
   de cotizaciones, Twelve Data para la búsqueda, operating MIC canónico, la traducción en
   el adaptador, el puerto que no se traga el motivo— queda **íntegro**. El descarte de las
   **cuentas múltiples** de EPIC-FIX **también queda en pie**: se rechazó por términos de
   uso y por coherencia con el rechazo de Yahoo, y esos dos motivos no dependían de la
   cifra.

4. **La cuota agotada es un motivo del dominio, distinto de la caída del proveedor.** Se
   añade **`cuota_agotada`** al tipo cerrado `QuoteFailureReason` (ADR-012 pto. 6). Su
   contrato: *el proveedor respondió y nos dijo que hemos consumido nuestro presupuesto; no
   es un problema del valor, ni del mercado, ni del símbolo; **no lo arregla esperar al
   ciclo siguiente**; lo resuelve el operador reponiendo cuota o cambiando de plan.*
   `proveedor_no_disponible` **conserva su contrato** —transitorio, el próximo ciclo puede
   ir bien— y precisamente por eso **deja de ser el cajón** donde caía la cuota.

5. **Taxonomía del 429, porque no todo 429 es cuota.** El proveedor usa el mismo estado
   para dos cosas distintas y el usuario merece saber cuál:
   - `usage_limit_reached` (presupuesto **mensual** agotado) → **`cuota_agotada`**;
   - `rate_limit_reached` / `too_many_requests` (tope de **5 peticiones por segundo**) →
     **`proveedor_no_disponible`**, que ahí sí es la verdad: eso es transitorio;
   - **429 con cuerpo ilegible o con código no reconocido → `cuota_agotada`.** Motivado:
     este producto hace **una** llamada por ciclo y **no puede** alcanzar un tope por
     segundo, así que ante la duda el motivo probable es el presupuesto. Y los dos errores
     no cuestan lo mismo: errar hacia *«revisa tu cuota»* manda al operador al sitio
     correcto, mientras que errar hacia *«se reintentará»* es **reproducir el defecto exacto
     que este ADR cierra**.

6. **El motivo nuevo no cambia la resiliencia ni el contrato del ciclo.** Un fallo global
   sigue degradando a fallo **por símbolo** sin abortar el ciclo (SPEC-016 CA-7, SPEC-020
   CA-9), el ciclo termina, la respuesta HTTP del cron **no cambia** y `cron_runs` se cierra
   como hoy. **Y no alerta a nadie**: la frontera normativa de **ADR-023 pto. 15** —*se
   registra y se muestra, nunca alerta*— sigue en pie y este ADR **no la abre**.

7. **Nada de esto decide el plan.** Elegir free tier, Basic o cambiar de proveedor es
   decisión de **producto y coste**, y es del humano. Lo que este ADR fija es que la app
   **diga la verdad pague lo que pague**: con cuota de sobra el motivo no aparece nunca, y
   con cuota agotada aparece con su nombre.

## Consecuencias

### Positivas
- **El operador recibe la acción correcta.** «Reponer cuota» y «esperar a que el proveedor
  vuelva» son cosas distintas y a partir de aquí se llaman distinto.
- **La unidad de medida queda escrita**: el siguiente proveedor —o el siguiente plan— se
  dimensiona en símbolos × ciclos, que es como se factura de verdad.
- **CE-F2 se cumple un escalón más arriba**: no basta con que el motivo se propague (SPEC-016);
  tiene que ser **verdad**.
- **Cero cambios de dominio.** Es un adaptador y un valor más en un tipo cerrado: puerto,
  ledger, cartera, motor de disparo y avisos siguen intactos, que es justo lo que ADR-002
  compró al introducir el puerto.
- **La garantía de SPEC-039 se hereda gratis**: `FAIL_REASON_TEXT` y `EXPLICACION` de la
  ayuda son mapas **totales** sobre `QuoteFailureReason`, así que añadir el motivo **obliga
  por compilación** a explicárselo al usuario. Nadie puede añadir un motivo mudo.
- **El batch sobrevive por los motivos correctos.** Se conserva porque ahorra latencia y
  superficie de fallo, no por una ventaja de cuota que no existía.

### Negativas / follow-ups
- **F-ADR-027-1 (para el gate humano): CE-F3 de EPIC-FIX queda tocado.** El criterio
  *«coste cero de arranque: el arreglo funciona en la capa gratuita, sin gasto
  recurrente»* y la realidad medida **ya no caben juntos**: con trece símbolos y ciclo
  diario, el free tier de Marketstack **no puede sostener la promesa**, y **ningún cambio
  de código lo arregla**. Este ADR no lo resuelve —no es suyo—, pero lo deja escrito para
  que se decida a la vista.
- **F-ADR-027-2: la señal externa que parecía existir NO existe.** El proveedor avisa al
  75/90/100 % de consumo por correo **al titular de la cuenta de la API** — y esa cuenta es
  hoy **una de prueba, con un correo que el titular de Stockeiro no administra**, así que
  los avisos caen en un buzón que nadie lee (constatado 2026-08-21; el humano dará de alta
  cuenta propia y **rotará la clave**). Dos consecuencias que hay que separar: **(i)** ese
  canal **no puede citarse como mitigación** de nada mientras la cuenta no sea propia, y
  **(ii)** aunque lo fuera, **cablearlo a la app** sería la alerta proactiva que **ADR-023
  pto. 15** deja fuera por decisión escrita — `cron_runs` no es la puerta de atrás por la
  que se cuela, y este ADR tampoco. Rotar la clave **arregla (i) y no (ii)**.
- **F-ADR-027-3 (EPIC-MEJORA): el consumo previsto no lo mira nadie.** El coste crece con
  **cada símbolo nuevo que alguien vigile** y hoy no hay ningún sitio donde se vea venir.
  Un contador (símbolos distintos × días del mes) en **Operación** sería barato, pero es
  **funcionalidad**, no defecto: va a su épica.
- **Los errores no consumen cuota**, así que un ciclo fallido no empeora el consumo — y
  tampoco hay castigo por reintentar. Lo cual **no** convierte el reintento en un arreglo:
  es exactamente lo que el motivo nuevo dice en voz alta.
- **El sobregiro del 5 % y el corte al 120 % son del proveedor, no nuestros.** La app **no**
  intenta administrarlos, ni contar créditos, ni frenar el ciclo para no pasarse: eso sería
  duplicar dentro de la app una contabilidad que vive fuera y que no podemos leer.
- **Un motivo más en un tipo cerrado toca cinco sitios** (tipo, texto de usuario, ayuda,
  clasificador y la prosa que cuenta cuántos motivos hay). Es el precio de que el tipo sea
  cerrado, y es el precio correcto.

## Alternativas consideradas

- **Editar ADR-002 en su sitio.** Rechazada: un ADR aceptado es **inmutable**, por regla del
  estándar y del propio fichero. El precedente del proyecto es **ADR-024**, que enmendó una
  cláusula de D-6 de ADR-018 **desde fuera** y reafirmó el resto por escrito; este ADR
  repite ese encuadre a propósito.
- **Superseder ADR-002 entero.** Rechazada por desproporcionada: el grueso de ADR-002
  —puerto, símbolo compartido, dedupe, `asOf`, cadencia— **se ha demostrado correcto** y
  sigue sosteniendo el diseño. Lo que falló fue **una inferencia económica**, no la
  arquitectura. Superseder lo bueno junto con lo malo destruiría trazabilidad sin ganar
  nada.
- **Dejarlo como nota dentro de SPEC-043.** Rechazada: una nota dentro de una spec cerrada
  **no la lee quien elige el proveedor siguiente**; un ADR sí. La premisa mal escrita ya ha
  viajado dos saltos (ADR-002 → ADR-012 → EPIC-FIX) y no hay motivo para creer que pararía
  sola en el tercero.
- **Una spec aparte para «el presupuesto del proveedor».** Rechazada: no hay
  **comportamiento observable** que verificar en *cómo se mide una cuota*. Una spec necesita
  CA con test; esto necesita **constar**.
- **Renunciar al batch y pedir símbolo a símbolo.** Rechazada: cuesta **lo mismo** en cuota
  (esa es literalmente la medición), trece veces más en latencia, multiplica por trece la
  superficie de fallo y se acerca al tope de 5 req/s. El batch sigue siendo lo correcto,
  ahora por los motivos que sí son ciertos.
- **Saltar el ciclo los fines de semana para gastar menos cuota.** Propuesta en el gate del
  2026-08-21 y **rechazada**, con la cuenta hecha en la unidad de este ADR (pto. 1):
  13 símbolos × ~22 días hábiles ≈ **286 unidades/mes**, todavía **casi 3×** las 100 del
  free tier; y sobre Basic (10.000/mes) el ahorro es de ~114 unidades, un **1,1 %**. **No
  rescata ningún plan por ninguno de los dos lados**, que es justo lo que la unidad correcta
  permite ver de un vistazo y la unidad vieja («llamadas») escondía. Y no es gratis: rompe
  el umbral de rancidez de SPEC-043 (72 h de hueco de viernes a lunes contra 36 h de
  umbral), reintroduce la necesidad del calendario de sesiones que medir por `updated_at`
  había eliminado, y **pierde el cierre del viernes hasta el lunes** para los símbolos con
  publicación rezagada — el proveedor publica el EOD con **retraso desigual por símbolo**
  (medido el 2026-08-21 en una sola llamada: `APP` con `date` `2026-08-19` mientras `AAPL` e
  `ITX` ya traían `2026-08-20`). Queda como **candidato a spec propia** con una condición:
  entra **a la vez** que un umbral consciente del calendario, nunca antes.
- **Clasificar todo 429 como `cuota_agotada`.** Rechazada: el proveedor también devuelve 429
  para el tope por segundo, que **sí** es transitorio; meterlo en el mismo saco sería
  sustituir una mentira por otra. Se distingue por código y solo se **presume** ante cuerpo
  ilegible, con el motivo de la presunción escrito (pto. 5).
- **No añadir motivo y limitarse a corregir el texto de `proveedor_no_disponible`** para que
  dejara de prometer el próximo ciclo. Rechazada: haría **más vago el motivo verdadero** para
  acomodar a un impostor. Los dos casos piden acciones distintas del operador y merecen
  nombres distintos — el mismo razonamiento con el que SPEC-020 separó `simbolo_no_admitido`.
- **Frenar el ciclo cuando el consumo previsto se acerque a la cuota.** Rechazada: exige
  llevar dentro de la app una contabilidad que vive en el proveedor y que no podemos leer;
  el primer desajuste dejaría de pedir precios que sí había derecho a pedir — romper CE-1
  por precaución, que es peor que el defecto.
- **Cambiar a plan Basic y no tocar nada.** Rechazada **como decisión de este ADR**, no como
  opción: es decisión de producto y coste del humano (pto. 7), y aunque se tome, **la app
  seguiría mintiendo el día que la cuota se agote por otro motivo**. Pagar no arregla el
  motivo falso; solo lo aplaza.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
