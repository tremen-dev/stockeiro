---
id: ADR-039
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-09-03, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-03, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-039: La hora del ciclo la fija cuando publica el proveedor, no el cierre de mercado (precisa ADR-004 pto. 1)

- Deciders: propone **sdd-arquitecto** (2026-09-03) al escribir **SPEC-059**, sobre **evidencia
  de producción recogida ese mismo día** —tabla `cron_runs`, tabla `quotes` y dos consultas a la
  API real de Marketstack— y **sin medición nueva de cuota** más allá de esas dos consultas.
  **Aprobado por el humano (Alberto Fojo) el 2026-09-03**, en el mismo gate en que se aprobó
  **SPEC-059**.
  La única pregunta abierta que este ADR llevaba al gate era **la hora exacta**, y el humano la
  **cerró en `0 6 * * *`** (06:00 UTC = 08:00 de Madrid en horario de verano) — **con la salvedad
  encima de la mesa y sin borrarla**: **06:00 UTC no está probada** por la evidencia, cae dentro
  de la ventana abierta `(22:48, 11:05)` UTC del pto. 3, y se elige por la **asimetría de riesgo**
  del pto. 5 (el peor caso de equivocarse es el statu quo) contando con que el **pto. 4** obliga a
  observar y deja pactado mover a una hora probada (≥ 11:05 UTC) **sin ADR nuevo**. Esa salvedad
  **sigue escrita a propósito** y no se borra por estar aprobada — igual que el presupuesto de 3 s
  de ADR-038 pto. 5.
  A partir de aquí este ADR es **inmutable**: para cambiarlo, otro que lo supersede. Lo que **no**
  necesita otro ADR es mover la hora dentro del criterio ya fijado (pto. 4).
- Specs relacionadas: nace de **SPEC-059** (EPIC-FIX), que es su primera y única aplicación.
  **Precisa ADR-004 pto. 1** —*«cadencia 1×/día tras el cierre, vía Vercel Cron a hora fija
  UTC»*— **sin superseder nada**: la cadencia (1×/día), la base no ajustada (RN-12), la
  persistencia de una fila por símbolo y el puerto con dos implementaciones quedan **intactos**.
  Lo único que precisa es **de qué evento cuelga la hora**. Precedentes de esta figura en el
  repositorio: **ADR-035** precisa ADR-026, y **ADR-037** precisa ADR-031 pto. 1.
  **ADR-004 quedó aprobado por el humano (Alberto Fojo) el 2026-09-03, en este mismo gate**: al
  escribirse esta precisión llevaba desde el 2026-07-14 en `borrador` —*«pendiente de
  aprobación»*— mientras gobernaba la cadencia, la base no ajustada, la persistencia y el
  `CRON_SECRET` de media docena de specs. Se levantó al aprobar esto y se cerró en el acto, así
  que **esta precisión ya no cuelga de un ADR pendiente**.
  Hereda **ADR-012** y **ADR-027** (proveedor, identidad y unidad de presupuesto), **ADR-032**
  (plan Basic), **ADR-018** (*mergear es desplegar*), **ADR-023** (`cron_runs` es donde queda la
  constancia del ciclo, y por tanto la evidencia) y **ADR-038**/**RN-17** (el segundo escritor
  de `quotes`). **Toca la hora de llegada del aviso** —**RN-14**, **ADR-006**— sin cambiar su
  regla, y **roza la premisa de RN-16**/**SPEC-043** (umbral de 36 h sobre cadencia diaria sin
  saltos), que este ADR obliga a comprobar en la transición (pto. 6). **No supersede a nadie.**

## Contexto

### El hecho, medido en producción el 2026-09-03

El ciclo diario **corre bien y trae el dato equivocado**. Las tres piezas de evidencia, en el
orden en que se recogieron:

1. **El cron corre y termina bien.** Últimas filas de `cron_runs` en producción:
   `2026-09-02T22:48:45Z | outcome=success | requested 21 | updated 20 | skipped 1`, y **nueve
   días consecutivos** con la misma forma, **sin un solo `failure`** y **sin ninguna fila con
   `finished_at` nulo**. No es un fallo del ciclo, ni de autorización (`CRON_SECRET`), ni del
   proveedor, ni de cuota (ADR-032: margen ~25×).
2. **Lo que trajo era viejo.** Las **20** cotizaciones que esa ejecución escribió quedaron
   **todas** con `as_of = 2026-09-01`: **un día por detrás de la ejecución**. Fila de muestra:
   `WEN | as_of 2026-09-01 | updated_at 2026-09-02T22:48:47Z | 8.27 USD`.
3. **El dato del día 2 existía; solo que más tarde.** `GET /v1/eod/latest?symbols=WEN,NOW,TEP.XPAR`
   ejecutada el **2026-09-03 a las 11:05 UTC** devuelve `date: 2026-09-02T00:00:00+0000` y
   `WEN close 8.24`. El histórico lo confirma
   (`GET /v1/eod?symbols=WEN&date_from=2026-08-31&date_to=2026-09-03`):
   `2026-09-02 → 8.24`, `2026-09-01 → 8.27`, `2026-08-31 → 8.30`. O sea: el **8.27** guardado es
   **exactamente** el cierre del día 1, y a las **22:48 UTC del día 2** el endpoint todavía
   servía el del día 1.

**Conclusión, y es la que manda sobre todo lo demás: no hay defecto en el código.** El adaptador
(`src/lib/market/marketstack-provider.ts`) y el ciclo (`src/lib/triggers/cycle.ts`,
`src/lib/market/refresh.ts`) hacen lo correcto, y el `asOf` que persisten es **honesto**: dice
D-2 porque el dato **es** de D-2. Lo que está mal es **cuándo se pregunta**.

El efecto para el usuario, dicho en su idioma: **durante todo el día de hoy está mirando el
cierre de anteayer**, con el `asOf` a la vista diciéndoselo —así que ni siquiera es una mentira,
es una pérdida sistemática de una sesión entera—. Y con ella se pierde un día en **todo** lo que
cuelga del precio: el P/L actual (RN-06), el estado de zona (RN-11) y, lo que más duele, **el
disparo y el aviso** (RN-13, RN-14): un valor que entra en zona el lunes se avisa el miércoles.

### El criterio equivocado, y las tres veces que viajó

**ADR-004 pto. 1** dice *«Cadencia: 1×/día **tras el cierre**»*. Esa frase ancla la hora al
**cierre de mercado**, y el cierre de mercado **no es el evento que importa**: lo que decide si
hay dato es **cuándo lo publica el proveedor**, que es otra cosa y ocurre después.

No es una sutileza retórica: el criterio equivocado **viajó y se usó como prueba**.

- **ADR-004 pto. 1** (2026-07-14) lo escribe: *«tras el cierre»*.
- **`vercel.json`** lo implementa como `0 22 * * *`, que efectivamente es posterior al cierre de
  los siete mercados soportados —el más tardío es EE. UU., **20:00 UTC** en horario de verano— y
  por tanto **cumple ADR-004 al pie de la letra** mientras trae el dato equivocado.
- **El ledger de SPEC-039** (2026-08-xx) lo cita como **evidencia** para aprobar copia visible
  para el usuario: *«sí — 22:00 UTC es posterior al cierre de los 7 mercados»*. Ahí el criterio
  malo deja de ser una frase de un ADR y pasa a **justificar una promesa al usuario**.

Es exactamente el molde del error que esta épica ya tiene documentado y pagado: **la unidad
equivocada de EPIC-FIX** —contar *llamadas* donde el proveedor factura *símbolos*— que *«viajó
tres saltos —ADR-002 → ADR-012 → esta épica— sin que nadie lo tocase»*. Un criterio mal
enunciado no se cae solo: se **hereda**, y cada salto le añade autoridad. Por eso la corrección
se escribe **aquí**, en un sitio inmutable, y no solo en el `vercel.json` de la entrega: para que
el cuarto salto no exista.

### El agravante que lo hace urgente: la cuenta pasó a Vercel Pro

Mírense las horas de `cron_runs`: **todas a las 22:48**, no a las 22:00 del `vercel.json`. Ese
es el comportamiento del plan **Hobby** —dispara en un minuto cualquiera dentro de la hora, y
**no garantiza el día**: falta la ejecución del **2026-08-24**, con un salto del
`2026-08-23T22:50Z` al `2026-08-25T07:38Z`, y esta última con toda la pinta de un disparo
manual—.

En **Pro** el cron se dispara **clavado a las 22:00 UTC**: **48 minutos antes** que ahora. Si no
se toca el horario, el paso a Pro deja la foto **igual o peor**, y lo hace en silencio.

Merece constar una segunda lectura del mismo hecho, porque toca a **RN-16**: el salto del
2026-08-24 es un **ciclo perdido de ~32 h** bajo un umbral de 36 h. Cabía por doce minutos. En
Pro esa clase de salto deja de ocurrir, lo cual **refuerza** la premisa de SPEC-043 en vez de
debilitarla — pero conviene saber que hasta hoy la premisa *«ciclo diario sin saltos»* era una
declaración, no un hecho observado.

### La pregunta que hay que responder por escrito

*«¿A qué hora hay que preguntar?»* — y la respuesta honesta hoy es **no lo sabemos con
precisión**, porque:

- La evidencia **acota** el momento de publicación a la ventana abierta **(22:48 UTC, 11:05
  UTC del día siguiente)**: a las 22:48 no estaba, a las 11:05 sí.
- La hora exacta de publicación **no la hemos medido** y **no viene en la respuesta**: el campo
  `date` de Marketstack es **solo fecha**, sin sello de publicación. No hay nada que leer; habría
  que **sondear** por horas durante varios días, y cada sondeo **consume cuota** en la unidad de
  ADR-027 pto. 1.
- Y aunque se midiera, **no sería una constante**: el proveedor ya publica con **retraso desigual
  por símbolo** (medido el 2026-08-21 en una sola llamada: `APP` traía `date` `2026-08-19`
  mientras `AAPL` e `ITX` ya traían `2026-08-20` — ADR-027, SPEC-043), y puede cambiar sin
  avisar.

De ahí la forma de este ADR: **fija el criterio y las obligaciones, no consagra un número**. El
número que el gate del 2026-09-03 eligió —**06:00 UTC**— vive en `vercel.json` y se puede mover
bajo el pto. 4 sin volver a pasar por aquí; lo que **no** se puede mover sin otro ADR es el
criterio.

## Decisión

### 1. La hora del ciclo cuelga de **cuándo publica el proveedor**, no del cierre de mercado

Se **precisa ADR-004 pto. 1**: donde dice *«1×/día tras el cierre»*, léase **«1×/día, a hora
fija UTC, elegida con margen sobre el momento en que el proveedor publica el EOD de la sesión
anterior»**. El cierre de mercado sigue siendo **una cota inferior necesaria** —no se puede
publicar lo que no ha cerrado— pero **deja de ser el criterio**: es condición necesaria, no
suficiente, y confundir las dos es exactamente lo que produjo este defecto.

La prueba de que la distinción es real y no filosófica: `0 22 * * *` **cumple** el criterio
viejo y **falla** el nuevo, y por eso el defecto pudo vivir nueve semanas dentro de un ADR
respetado.

**Consecuencia inmediata sobre la copia visible**: una frase como *«se refrescan una vez al día,
después del cierre de mercado»* (`CADENCIA_LINEA`) sigue siendo **verdad** —el ciclo ocurre
después del cierre— y **no cambia**. Lo que no puede volver a pasar es que *«es posterior al
cierre»* se acepte como **prueba** de que el dato del día está.

### 2. Lo que **no** cambia, y es casi todo

**La cadencia sigue siendo 1×/día a hora fija UTC** (ADR-004 pto. 1). **La base sigue siendo el
último cierre no ajustado** (RN-12, ADR-004 pto. 2). **La persistencia sigue siendo una fila por
símbolo** (ADR-004 pto. 3). **El endpoint, el adaptador, el universo, el orden ingesta → disparos
→ avisos y el vocabulario de fallo no se tocan.** Este ADR mueve **un número de cinco campos** en
`vercel.json` y escribe por qué.

Y **D-2 no se roza**: D-2 está *locked* y dice que el **disparo** se evalúa en modo
diferido/batch **dentro de un ciclo de refresco acordado**. Mover la hora del ciclo **es acordar
otro momento del mismo ciclo**; no hay más ciclos, no hay intradía y no hay tiempo real. La
lectura de D-2 que sí necesitó ADR fue la de **ADR-038** (ingesta fuera del ciclo), y esa ya
está escrita y aprobada.

### 3. La ventana medida se escribe, y la que **no** está medida también

- **Probado**: a las **22:48 UTC** el EOD de esa misma sesión **no está**. A las **11:05 UTC**
  del día siguiente **sí está**.
- **No probado**: **todo lo que hay entre medias**. Cualquier hora que se elija dentro de
  `(22:48, 11:05)` es un **techo razonado, no un percentil observado** — la misma clase de
  número que el presupuesto de 3 s de ADR-038 pto. 5, y se declara igual de explícitamente.

Quien elija una hora dentro de esa ventana **hereda el pto. 4**. Quien elija **11:05 UTC o más
tarde** compra certeza a cambio de que el aviso llegue a mediodía.

**La hora elegida en el gate del 2026-09-03 es `0 6 * * *` — 06:00 UTC—, y cae DENTRO de la
ventana no probada.** Está dicho aquí sin rodeos porque es la consecuencia entera de la elección:
**el pto. 4 no es opcional para esta decisión, es su condición.** Lo que la sostiene es el pto. 5
(el peor caso es el statu quo) y no una creencia sobre el proveedor.

### 4. Una hora no probada obliga a **observación post-deploy con desenlace escrito**

No se elige a ojo y se olvida. **`0 6 * * *` es una hora no probada, así que este punto aplica de
lleno a esta entrega.** La elección arrastra tres obligaciones, y ninguna es opcional:

1. **Se observa.** Tras el despliegue, las **dos primeras** ejecuciones bajo el horario nuevo se
   miran en **`cron_runs`** (ADR-023: es exactamente para esto que existe la tabla) y en
   **`quotes`**. La pregunta que se responde es una sola: **¿el `as_of` que escribió el ciclo es
   el cierre de la sesión anterior (D-1), o sigue siendo el de dos sesiones antes (D-2)?**
2. **Se escribe.** La respuesta —con fecha, hora de la fila y `as_of` observado— va al **ledger
   de SPEC-059**. Sin eso, esta decisión queda sin evidencia y el siguiente que la lea tendrá
   que volver a medirlo todo.
3. **Hay desenlace pactado.** Si las dos primeras ejecuciones siguen escribiendo **D-2**, la hora
   elegida **está dentro del hueco de publicación** y se mueve a una hora **probada** (≥ 11:05
   UTC) — no se investiga durante semanas ni se convive con ello. Ese movimiento es **un cambio
   de un campo bajo esta misma decisión**, no un ADR nuevo.

Esto es lo que convierte una apuesta en un experimento: **falla barato, se detecta en 48 h y
tiene salida escrita de antemano.**

### 5. El peor caso del cambio es el statu quo — y por eso se puede arriesgar una hora temprana

Argumento que sostiene el pto. 4 y que conviene tener escrito, porque cambia por completo el
apetito de riesgo:

- Si a la hora nueva **el dato ya está publicado**, el ciclo escribe `as_of = D-1`: **el defecto
  queda corregido**.
- Si **todavía no está**, el ciclo escribe `as_of = D-2`: **exactamente lo que pasa hoy**.

**No existe un desenlace peor que el actual.** No se pierde dato, no se gasta cuota de más (el
mismo lote de símbolos, una vez al día, en la unidad de ADR-027 pto. 1), no se rompe ningún
invariante y no se degrada ninguna pantalla. Lo único que se arriesga es **no haber arreglado
nada todavía**, y el pto. 4 lo detecta en dos días.

### 6. La hora elegida tiene que sobrevivir a la **transición** sin cruzar el umbral de RN-16

Restricción **aritmética** sobre la elección, y hay que comprobarla **antes** de mergear, no
después.

`RN-16` marca *sin refrescar* una cotización cuyo `updated_at` lleva más de **36 h**
(`UMBRAL_SIN_REFRESCAR_HORAS`, `src/lib/market/sin-refrescar.ts`). Cambiar la hora abre **un
hueco de una sola vez** entre la última escritura del horario viejo y la primera del nuevo. Si
ese hueco pasa de 36 h, **todo el universo aparece marcado *sin refrescar*** una mañana, sin que
nada esté roto: es el rojo sin defecto detrás, en su versión de producto.

La cuenta, con el peor caso real —que el despliegue se coma la ejecución del día en curso, así
que la última escritura del horario viejo es la de **anoche a las 22:48 UTC**:

| Hora nueva | Peor hueco de transición | ¿Cruza las 36 h? |
|---|---|---|
| **`0 6 * * *`** *(la elegida)* | 22:48 D-1 → 06:00 D+1 = **31 h 12 min** | **No** |
| `0 8 * * *` | 22:48 D-1 → 08:00 D+1 = **33 h 12 min** | **No** |
| `0 12 * * *` | 22:48 D-1 → 12:00 D+1 = **37 h 12 min** | **Sí, por 1 h 12 min** |

O sea: **la hora tardía, que es la segura frente al proveedor, es la arriesgada frente a
RN-16** — y por una hora larga. No es motivo para descartarla: es motivo para **saberlo**, y para
que quien elija ≥ 11:00 UTC **mergee después de la ejecución de esa noche** en vez de antes, con
lo que el hueco cae a ~13 h. La restricción, enunciada como propiedad y no como número: **el
hueco de transición no puede superar el umbral de RN-16, y el umbral se lee de su único hogar,
no se teclea aquí.**

**Con `0 6 * * *` esta restricción se cumple con 4 h 48 min de holgura y el merge no tiene
condición de horario.** Pero el cálculo se queda escrito, y no como adorno: es exactamente el
control que hay que repetir **si el pto. 4 obliga a mover la hora a ≥ 11:05 UTC**, porque entonces
el hueco **sí** cruza el umbral y ese segundo merge tendrá que ir **después** del ciclo de esa
noche.

### 7. Mover la hora del ciclo **mueve la hora del aviso**, y se dice en voz alta

**RN-13** (disparo) y **RN-14** (aviso) **no cambian de regla**: el disparo se evalúa dentro del
ciclo y el aviso se emite exactamente una vez por episodio. Pero el ciclo **es** quien los
ejecuta (**ADR-038 pto. 1** lo acaba de reafirmar), así que **el correo cambia de franja horaria**.

Concretamente, y esto es un **cambio de encuadre de producto**, no un detalle técnico: hoy el
aviso sale a las **00:48 de Madrid** —de madrugada, y el usuario lo encuentra al despertarse—. Con
`0 6 * * *` pasa a salir **a las 08:00 de Madrid** (07:00 en horario de invierno): **a primera
hora de la mañana**, con el mercado europeo a punto de abrir y el estadounidense todavía cerrado.

Se declaró como **consecuencia** y no en un pie de página porque era lo que el humano tenía que
sopesar en el gate junto con la hora: **cuanto más tarde, más seguro el dato y más tarde el aviso;
cuanto más temprano, más útil el aviso y más riesgo de repetir el defecto.** Lo aceptó **con la
hora elegida y sabiendo esto**: nadie pidió mover el correo, y se mueve.

Y queda dicho por si algún día molesta: la salida **no** es volver a mover el ciclo para colocar
el correo —eso reintroduce este mismo defecto por el otro extremo—, sino **desacoplar la emisión
del aviso de la ingesta**, que es alcance nuevo con su propia épica.

### 8. La hora se escribe **una vez**, y quien la cita la nombra por su dueño

`vercel.json` es el **único** sitio donde vive el valor. Todo lo demás —runbook, comentarios de
fuente, prosa— o **deriva** el valor de ahí o **nombra el fichero que lo posee**, y **nunca lo
teclea otra vez**. Es ADR-026 pto. 2 aplicado a un número que acaba de demostrar que se copia:
hoy hay al menos **tres literales congelados** de `0 22 * * *` en la batería, **uno** en el
runbook y **uno** en un comentario de `src/`, y esta entrega tiene que tocar los cinco. La
próxima vez que la hora se mueva debería tocar **uno**.

Corolario sobre la copia visible: **ningún texto que lea el usuario nombra un momento del día
para el ciclo.** Lo que se le cuenta es la **cadencia** (una vez al día), su relación con el
**cierre** y el carácter **diferido** del dato (D-2) — todo eso sigue siendo cierto a cualquier
hora. Una frase que diga *«sin esperar a la noche»* queda **falsa** en el momento en que el ciclo
deja de ser nocturno, y ese es precisamente el acoplamiento que este punto elimina.

### 9. Lo que este ADR **no** autoriza

Se escribe porque mover una hora es la clase de cambio del que se cuelgan otros:

- **No autoriza 2×/día ni cadencia horaria.** ADR-004 las rechazó explícitamente por ir contra
  D-2, y ese rechazo **sigue vivo** sin un rasguño.
- **No autoriza intradía, polling ni disparadores por valor puntual** (D-2, D-3).
- **No autoriza una hora por mercado ni por huso.** El *«afinado multi-mercado / por huso
  horario»* que ADR-004 pto. 1 dejó fuera **sigue fuera**: un solo cron, una sola hora UTC.
- **No autoriza saltar fines de semana.** Sigue siendo `* * *` en día/mes/día-de-semana, y el
  día que alguien lo restrinja tiene que tocar el umbral de RN-16 en la misma entrega
  (**F-SPEC-043-2**, y `tests/spec043-sin-refrescar.test.ts` lo vigila).

## Consecuencias

### Positivas

- **El usuario deja de mirar el cierre de anteayer.** Es la promesa de EPIC-001 (CE-1, CE-3)
  restaurada: el precio, el P/L actual y el estado de zona pasan a ser de **la última sesión
  cerrada**, que es lo que el producto siempre dijo que enseñaba.
- **El aviso adelanta un día entero.** Un valor que entra en zona el lunes deja de avisarse el
  miércoles. Es el efecto que más vale de todos y el que menos se ve en el diff.
- **El criterio queda escrito donde no se puede perder.** El siguiente que toque la hora, cambie
  de proveedor o añada un mercado **no tiene que volver a deducirlo** — y no puede volver a usar
  *«es posterior al cierre»* como prueba.
- **El paso a Pro deja de ser un empeoramiento silencioso.** Con la hora corregida, la precisión
  de Pro (dispara clavado, y garantiza el día) es una **mejora** en vez de 48 minutos de
  regresión.
- **La premisa de RN-16 se refuerza**: Pro garantiza el día, así que *«ciclo diario sin saltos»*
  pasa de declaración a propiedad de la plataforma.

### Negativas / follow-ups

- **La hora exacta de publicación del proveedor sigue sin medir**, y este ADR **no la mide**:
  acota la ventana `(22:48, 11:05)` UTC y declara que lo elegido dentro de ella es un techo
  razonado. **F-ADR-039-1**: si algún día interesa afinar, la medida cuesta un sondeo por horas
  durante varios días **y consume cuota** en la unidad de ADR-027 pto. 1; el sitio natural para
  gastarla es una spec de observabilidad del ciclo, no ésta.
- **El aviso cambia de franja horaria** (pto. 7). Nadie lo ha pedido y es un efecto colateral de
  arreglar el dato. Si la franja nueva molesta, la salida **no** es volver a mover el ciclo: es
  desacoplar la emisión del aviso de la ingesta, y eso es alcance nuevo con su propia épica.
- **El defecto solo se puede dar por cerrado en producción.** Ningún test unitario puede probar
  que el proveedor ya había publicado: la batería prueba **qué hora está declarada** y **que la
  documentación no dice otra cosa**; que el dato llegue fresco se ve en `cron_runs` + `quotes` y
  **en ningún otro sitio**. La spec tiene que ser honesta con esa frontera y no fingir un CA
  automático donde solo cabe observación.
- **Riesgo residual: el proveedor puede cambiar su hora de publicación** sin avisar, y el defecto
  volvería exactamente igual de silencioso que ahora. **F-ADR-039-2**: una alerta sobre
  *«el ciclo escribió un `as_of` de más de una sesión de antigüedad»* es la vigilancia que de
  verdad lo cazaría. Es alcance nuevo (EPIC-MEJORA / observabilidad del ciclo), y se anota aquí
  porque este ADR es donde se descubre que hace falta.
- **Nueve días de precios con una sesión de retraso quedan en la base y no se reparan.** Se
  corrigen solos en el primer ciclo bueno: `quotes` guarda **una fila por símbolo**, no una serie
  (ADR-004 pto. 3), así que no hay histórico que rectificar. Lo que **no** se recupera son los
  avisos que salieron tarde; no hay nada que hacer con ellos y no se va a fingir que sí.

## Alternativas consideradas

- **(a) Statu quo: dejar `0 22 * * *`.** Es el defecto observado, y con el paso a Pro pasa a ser
  **48 minutos peor**. Rechazada.
- **(b) Subir la cadencia a 2×/día (una tarde, una mañana).** «Resolvería» el problema por fuerza
  bruta y es lo primero que se le ocurre a cualquiera. Rechazada **dos veces**: ADR-004 ya la
  rechazó por ir contra **D-2**, y ese rechazo sigue vigente sin necesidad de este ADR; y además
  **duplica el consumo** en la unidad de ADR-027 pto. 1 para traer, la mitad de las veces, el
  mismo dato que ya había. El problema no es que se pregunte poco: es que se pregunta **pronto**.
- **(c) Reintentar dentro del mismo ciclo hasta que el `as_of` avance.** Convierte el ciclo en un
  bucle de espera contra un tercero dentro de una función de Vercel, gasta una unidad de cuota
  por intento **y por símbolo** (los errores no consumen, pero **una respuesta con dato viejo
  sí**), y no tiene condición de parada honesta: en un festivo el `as_of` **no va a avanzar
  nunca** y el ciclo se quedaría reintentando contra un mercado cerrado. Rechazada.
- **(d) Detectar el retraso y no escribir la fila vieja.** Rechazada por dos motivos, y el segundo
  es el que la mata: primero, **marcar no es borrar** (RN-16) y no escribir es peor que escribir
  un dato honesto con su `asOf`; segundo, el proveedor publica con **retraso desigual por
  símbolo** (medición del 2026-08-21), así que un símbolo legítimamente rezagado sería
  indistinguible de un ciclo prematuro.
- **(e) Fijar la hora por el cierre del mercado más tardío + un margen fijo.** Es el criterio
  viejo con maquillaje: sigue anclando al evento equivocado, y el margen que hiciera falta habría
  que sacarlo… de medir la publicación, que es lo que este ADR dice que hay que hacer. Rechazada.
- **(f) Elegir directamente una hora probada (≥ 11:05 UTC) y no arriesgar.** Era la otra opción
  real del gate —la única con certeza detrás— y **el humano no la eligió** el 2026-09-03. Su
  precio eran dos cosas: el aviso se iba a **mediodía** (14:00 de Madrid), y el hueco de
  transición **cruza el umbral de RN-16** si el despliegue se come la ejecución de esa noche
  (pto. 6), lo que obligaba a mergear después del ciclo. Se descarta **por decisión del humano y
  no por preferencia del arquitecto**, y **no queda muerta**: es exactamente el destino que el
  pto. 4 tiene pactado si las dos primeras ejecuciones bajo `0 6 * * *` siguen escribiendo D-2.
- **(g) Escribir la hora en una variable de entorno para poder moverla sin desplegar.** Rechazada:
  Vercel lee `crons` del **artefacto desplegado**, no del entorno, así que no funcionaría; y aun
  si funcionase, sacaría del repositorio un valor que hoy está versionado, revisado en PR y
  vigilado por la batería. Se perdería justo la propiedad que hace que este defecto sea
  arreglable de una vez.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
