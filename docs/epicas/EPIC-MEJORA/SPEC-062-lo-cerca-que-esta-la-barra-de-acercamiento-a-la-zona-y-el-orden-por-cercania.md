---
id: SPEC-062
tipo: spec
epica: EPIC-MEJORA
estado: en-revision
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-09-12, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-13, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-09-13, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-09-13, por: sdd-implementador}
---
# SPEC-062 — Lo cerca que está: la barra de acercamiento a la zona y el orden por cercanía

## Problema

`/vigiladas` responde hoy una pregunta **binaria**: *¿está dentro de la zona?* El color de
fondo de la fila lo dice (SPEC-007, RN-11) y el orden por estado pone arriba lo que reclama
atención (SPEC-041 CA-8). Lo que la pantalla **no** dice es **cuánto falta**: una acción a un
0,4% de su zona de compra y otra a un 28% se ven exactamente igual —*Fuera de zona*, fondo
neutro— y la única forma de distinguirlas es leer el precio, leer el rango de la celda de al
lado y **hacer la resta a ojo, fila por fila, cada mañana**.

El roce, en palabras del humano (2026-09-12, Alberto Fojo):

> *«También es interesante que diga el porcentaje de acercamiento a la zona de compra o
> venta que tenemos, porque si está muy cerca ya quizás se puede comprar con tranquilidad.»*

No es capacidad nueva: **los dos números ya están en la fila**. El precio lo trae
`zoneStatusForUser` y el rango lo pinta la celda de zona desde `watched_symbols`. Lo que
falta es hacer la resta **una vez, bien y en un solo sitio**, en vez de dejársela al ojo del
usuario. Esta spec entrega esa resta —la **distancia relativa a la zona**—, la pinta como
**una barra de proximidad con su porcentaje** que apunta a la zona más cercana, y añade **un
criterio de orden más**: por cercanía.

Cubre **CE-M1** (presentación, no dato), **CE-M2** (el roce está observado, y es cita
textual), **CE-M3** (cabe en una sesión: sin esquema, sin proveedor) y **CE-M4** (Vigiladas
se lee de un vistazo) de EPIC-MEJORA.

Reglas heredadas: **RN-11** (entrada en zona, inclusive en los extremos), **RN-10** (la zona
es un rango), **RN-12** (el precio es el último cierre **no ajustado**), **RN-16**
(cotización sin refrescar), **RN-01**/**RN-03** (aislamiento y acceso). Decisiones que la
enmarcan: **D-2** (el dato es diferido), **D-3** (el disparo es por zona), **D-4** (*la app no
calcula ni recomienda zonas*) y **ADR-026**/**ADR-034**/**ADR-035** (cómo se mide la
geometría y cómo conmuta la tabla a tarjetas por debajo de 720 px). Propone **RN-18**, que
define la magnitud, y un término de dominio; los escribe sdd-arquitecto **en el gate**
(ADR-025), antes de la primera línea de implementación.

**Esta spec no cambia el esquema, no lleva migración y no habla con el proveedor.** La
distancia se deriva en render sobre datos que ya viajan, igual que el estado de zona.

## Usuarios / roles afectados

- **Usuario final** (cualquier rol con la sección Vigiladas, incluido `tester`, ADR-021):
  recorre su lista y ve, en cada fila, **cuánto le falta al precio, en qué sentido y hacia
  qué zona**; puede poner arriba lo más cercano sin leer la tabla entera.
- **Sistema (ciclo de refresco, motor de disparo, avisos)**: **no cambia ni una línea**. La
  entrada en zona la sigue decidiendo `entraEnZona` dentro del ciclo (RN-11, RN-13) y el
  aviso sigue siendo del ciclo. Una barra casi llena **no es un disparo** y no emite nada.
- **Operador**: sin coste nuevo de proveedor. Cero llamadas añadidas (ADR-027/ADR-032).

## Criterios de aceptación

Cada CA es verificable con un test. Unitarios con **Vitest** sobre la función pura y sobre la
vista (`zoneStatusForUser` con **PGlite**, esquema desde las migraciones reales, ADR-019);
**e2e Playwright** los que dicen pantalla, con `E2E_FAKE_QUOTES=1`; la geometría, con el
módulo compartido `tests/e2e/geometria.ts` (ADR-026 §1) y **nunca** con una medida contra un
umbral (ADR-035).

### Rebanada 1 — La medida, como función pura (RN-18)

- **CA-1 (La medida existe solo cuando hay con qué medirla, y su ausencia se distingue).**
  Dada una vigilada, hay distancia **si y solo si** hay cotización **y** la zona tiene sus
  dos extremos. En cualquier otro caso **no hay medida**, y *no hay medida* no es cero, ni
  *lejos*, ni «0%»: es una ausencia que quien la consuma tiene que poder distinguir de un
  cero. Especímenes en las dos direcciones: sin cotización → ausencia; zona con un solo
  extremo → ausencia; precio cero o no positivo → ausencia (no se divide); zona completa con
  cotización → un número.

- **CA-2 (Qué mide y sobre qué denominador).**
  Fuera de zona, la distancia es la que separa el precio del **borde más cercano** del rango,
  **dividida por el precio actual** y expresada en porcentaje, con su **sentido**:
  - precio **por encima** del rango → el precio tiene que **bajar**: `(p − max) / p`;
  - precio **por debajo** del rango → el precio tiene que **subir**: `(min − p) / p`.
  Especímenes con su resultado exacto: `p = 4,12`, zona `3,80–3,99` → **bajar 3,2%**;
  `p = 3,70`, zona `3,80–3,99` → **subir 2,7%**. El denominador es el precio y no el borde
  **a propósito**: lo que el usuario pregunta es cuánto tiene que moverse **el precio**, que
  es la convención con la que lee cualquier variación porcentual del mercado.

- **CA-3 (Dentro de zona: distancia cero y sin sentido).**
  Si el precio está dentro de la zona, la distancia es **cero** y **no hay dirección** que
  mostrar. Incluye los extremos: `p = max` y `p = min` están **dentro** (RN-11 es inclusiva),
  así que ninguno de los dos produce una dirección.

- **CA-4 (Una sola definición de «dentro», no dos).**
  El módulo nuevo **no vuelve a decidir** qué es estar en zona: la pertenencia la sigue
  decidiendo `entraEnZona`. Verificable como propiedad sobre un barrido de precios que cruce
  los dos bordes —extremos exactos incluidos—: *distancia cero* y *`entraEnZona` cierto*
  coinciden en **todos** los puntos del barrido, sin excepción. El barrido lleva su centinela
  de no-vacuidad (tiene que haber puntos dentro **y** fuera).

- **CA-5 (La aritmética es decimal, y se nota en el resultado).**
  La medida se calcula con `decimal.js` sobre los valores tal como llegan de la base, nunca
  en coma flotante binaria. Especimen discriminante: un caso cuyo resultado en `number`
  difiere del exacto en la cifra que se muestra — la implementación decimal lo da bien y una
  implementación en `number` lo da mal, de modo que el test **puede ponerse rojo**.

### Rebanada 2 — La barra y el número en pantalla

> **Decidido en el gate del 2026-09-13**: **una sola barra por fila**, apuntando a la zona
> **más cercana**, y **`ESCALA` = 10%**.

- **CA-6 (Una barra por fila, y vive con el estado).**
  Cada fila de `/vigiladas` muestra **una** barra con su porcentaje y su sentido, dentro de
  la **celda de Estado** —bajo la etiqueta de zona que ya está ahí—, y **no** en una columna
  nueva. Sale de la **descripción única de columnas**, así que **tabla** (>720 px) y
  **tarjeta** (≤720 px) enseñan lo mismo con el mismo rótulo, comprobado dato a dato en las
  dos formas (ADR-034 §3).
  **Por qué ahí y no en una columna propia**, que es lo primero que se piensa: la tabla ya
  tiene nueve columnas y **no cabe** a 730–760 px —lo dicen las guardias de geometría que ya
  existen—, así que una décima columna empuja justo donde más aprieta. Además el
  acercamiento **responde a la misma pregunta** que la celda de estado —*¿cómo está esto
  respecto a sus zonas?*— y esa celda ya es un bloque con su etiqueta y sus avisos
  (SPEC-040 CA-4).

- **CA-7 (Qué zona elige la barra, y el empate no se decide al azar).**
  La barra apunta a la zona **más cercana** por distancia relativa. Propiedades, todas
  verificables por separado:
  - con las **dos** zonas definidas y el precio fuera de ambas → la de **menor** distancia;
  - con **una sola** zona definida → esa, aunque esté lejos;
  - con el precio **dentro** de cualquiera de las dos → **en zona**: barra llena y sin
    porcentaje, porque la etiqueta que tiene encima ya dice en cuál está (SPEC-007);
  - **empate exacto** entre las dos distancias → **compra**, declarado y **estable**: no
    depende del orden en que se evalúen las zonas ni de la posición de la fila.

- **CA-8 (La barra es una escala; el número es el dato).**
  El relleno es la fracción `1 − distancia / ESCALA`, acotada a `[0, 1]`, con **`ESCALA`
  declarada en un solo sitio del código** y con valor **10%** (decisión del gate). El
  **porcentaje que se lee es siempre el real**, también con la barra vacía. Especímenes:
  distancia `0` → llena; distancia `= ESCALA` → vacía; distancia `> ESCALA` (p. ej. 23,4%) →
  vacía y el texto diciendo **23,4%**, no «lejos» ni un tope inventado.
  **Medida de la geometría** (ADR-026 §1, ADR-035): la fracción **medida** del relleno
  respecto a su carril coincide —dentro de `TOLERANCIA_PX`— con la que la función pura
  devuelve **para esos mismos datos**. Son **dos medidas comparadas entre sí**, nunca una
  medida contra un número escrito en el test.

- **CA-9 (El sentido se dice, porque un 3% hacia abajo y un 3% hacia arriba no son la misma
  noticia).**
  Una acción **por debajo** de su zona de compra —el precio ya cayó por debajo del rango— no
  puede leerse igual que una que está por encima y bajando hacia ella. El texto dice **qué
  tiene que hacer el precio** para entrar y **a qué zona**. Especímenes en las dos
  direcciones, con la misma zona y dos precios, uno a cada lado.

- **CA-10 (Ni el color ni la forma llevan solos la información).**
  Siempre que hay medida hay **texto** con el porcentaje y con el destino, y la barra tiene
  un nombre accesible que dice lo mismo. En zona, el texto que lo dice es la **etiqueta de
  estado** que ya está en esa celda. Una fila sin medida no deja un hueco mudo: dice lo que
  ya dice hoy (sin cotización, con su motivo si lo hay; sin zonas, nada).

### Rebanada 3 — El orden por cercanía

- **CA-11 (Un criterio más, y ninguno menos).**
  A los criterios de orden de SPEC-041 se suma **cercanía**, que ordena por la distancia de
  la fila —la misma que elige la barra, CA-7—. Propiedades, en las **dos** direcciones: lo
  que está **en zona** (distancia 0) encabeza el ascendente; las filas con medida se ordenan
  por distancia creciente; y una fila **sin medida nunca se cuela entre filas con medida** —va
  al final tanto en ascendente como en descendente, porque una ausencia no se invierte—. El
  desempate sigue siendo el estable de SPEC-041 CA-9 (nombre o ticker → ticker → `id`), así
  que dos filas empatadas **no bailan** entre ejecuciones.
  Y **ninguno menos**: los criterios que ya existían siguen ofrecidos, en su orden, y el
  **orden por defecto de la pantalla no cambia** (ticker ascendente, SPEC-041 CA-6).

- **CA-12 (Ordenar no cambia lo que dice ninguna fila — CE-M1).**
  Tras ordenar por cercanía, el conjunto de filas es **el mismo** y cada fila conserva su
  precio, su estado, su color de fondo y su porcentaje: es la misma lista permutada. Se
  afirma comparando el contenido antes y después, no contando filas.

### Rebanada 4 — Honestidad de la medida

- **CA-13 (El redondeo no puede fabricar una entrada en zona).**
  Ninguna fila que esté **fuera** puede mostrar un texto que se lea como *cero*. Por debajo
  de la resolución que se muestra, se dice **«menos de 0,1%»** y la fila sigue siendo, en
  todo lo demás, una fila fuera de zona. Especímenes en las dos direcciones: distancia
  `0,04%` → «menos de 0,1%», fondo y estado de *fuera*; distancia exacta `0` → en zona, con
  el fondo y el estado de SPEC-007. Sin esto, el usuario leería **dos filas idénticas** —una
  en zona y otra no— y concluiría que el motor de disparo falla.

- **CA-14 (La medida hereda la vejez del precio del que sale).**
  En una fila marcada **sin refrescar** (RN-16), el acercamiento **no se presenta como
  vigente**: lleva la misma marca que el precio. Direcciones: fila vigente → sin marca; fila
  sin refrescar → con marca **y con su número**, porque marcar no es borrar (SPEC-043). La
  marca se decide con la función que ya existe y su único umbral; no se introduce un segundo.

- **CA-15 (La app sigue sin recomendar — D-4).**
  Ni la barra, ni el porcentaje, ni el orden introducen **juicio**: no hay umbral de
  «oportunidad», ni rótulo que sugiera comprar o vender, ni semántica de decisión nueva en el
  color (el fondo de fila sigue siendo exactamente el de SPEC-007). Los textos que esta spec
  añade pasan por el mecanismo **ya versionado** de afirmaciones prohibidas que protegen
  `/ayuda` y `/legal` (SPEC-035 CA-7, SPEC-039 CA-7), con especímenes en las dos direcciones:
  una frase que aconseja debe **cazarse**, y las frases que esta spec escribe **no** deben
  cazarse.

### Rebanada 5 — Dominio, ayuda y cero regresión

- **CA-16 (El término existe antes que la pantalla).**
  **Acercamiento a zona** entra en `docs/fundacion/dominio.md` y **RN-18** en
  `docs/fundacion/reglas.md`, escritos por **sdd-arquitecto en el gate** (ADR-025) y **antes**
  de la primera línea de implementación. El rótulo de la UI se **copia** de ahí; la
  implementación no escribe en los documentos de verdad.

- **CA-17 (La ayuda dice qué es la barra, y qué no es).**
  `/ayuda` explica que la barra mide contra el **último cierre** (D-2), que es una **escala de
  lectura** y no un consejo (D-4), y **deriva del código** el valor de `ESCALA` en vez de
  copiarlo — como ya hace con la cadencia y con los mercados. Propiedad verificable: cambiar
  `ESCALA` **no puede** dejar la ayuda diciendo otra cosa.

- **CA-18 (Cero regresión).**
  La batería completa queda verde y **ninguna guardia ajena se afloja ni se borra** para que
  esto pase. Siguen cumpliéndose sobre `/vigiladas`: SPEC-007 (color de fondo), SPEC-041
  (los tres criterios de orden y su desempate), SPEC-043 (sin refrescar), SPEC-016 (el
  silencio con motivo) y ADR-034/ADR-035 (conmutación a tarjetas por debajo de 720 px, área
  táctil y suelos tipográficos). Se verifica **en el gate** corriendo la batería completa y
  revisando el diff sobre tests ajenos, no con una guardia congelada (ADR-031, ADR-037).

- **CA-19 (Las dos guardias que este cambio caduca se re-encuadran a la vista, y no se
  aflojan).**
  Añadir un cuarto criterio de orden pone en rojo **dos guardias de SPEC-041** que congelan
  la lista de criterios por **igualdad exacta contra una lista literal** —una unitaria sobre
  la constante y una e2e sobre las opciones del selector—. Es el patrón que **ADR-037**
  declara no superviviente, y la salida legítima es **re-encuadrarlas**, porque la propiedad
  que SPEC-041 quería sigue viva y sólo estaba mal expresada: *«Ticker es el primero y es el
  orden por defecto, y los criterios de SPEC-041 siguen ofrecidos en su orden»*. Eso es
  **pertenencia**, que sí sobrevive a que la lista crezca.
  Tres condiciones, las tres exigibles: queda escrito en el ledger **qué vigilaba antes y qué
  vigila después** (FOUNDATION, tercera convención); la guardia re-encuadrada **se puede
  poner roja** —quitar «Nombre» del selector, o mover «Ticker» del primer puesto, tiene que
  seguir fallando—; y **no se toca ningún otro `expect` ajeno**. Lo que **no** vale es
  ampliar la lista literal con el criterio nuevo: eso es la misma foto, un día más tarde.
  ⚠️ Y una advertencia de proceso que se declara en vez de disimularse: aquí **quien toca la
  guardia es quien se beneficia** —la misma sesión que la rompe—, que es justo lo que
  FOUNDATION pide no hacer en silencio. Por eso está escrito como CA, se verifica en el gate
  y se cuenta en el ledger.

## Entidades y reglas afectadas

- **Esquema: ninguno.** Cero tablas, cero columnas, cero migraciones. La distancia se deriva
  en render, como el estado de zona, y viaja en la vista que la pantalla ya recibe.
- **RN-18 (propuesta) — Distancia a zona.** *Para una acción vigilada con cotización y una
  zona completa, la **distancia a esa zona** es la separación entre el precio y el borde más
  cercano del rango, dividida por el precio, con el **sentido** en que el precio debe moverse
  para entrar; es **cero** cuando el precio está dentro (RN-11), y **no está definida** si
  falta la cotización o la zona. Se calcula sobre el mismo precio que evalúa RN-11 —el último
  cierre **no ajustado** (RN-12)— y **no genera disparo ni aviso**.*
- **Término de dominio (propuesto) — Acercamiento a zona**, con su nota: es **presentación de
  una resta**, no criterio; la zona la sigue poniendo entera el usuario (D-4).
- **Dónde vive el cálculo.** Módulo puro nuevo bajo `src/lib/watchlist/`, invocado desde
  `zoneStatusForUser` (servidor) para que el valor viaje con la fila. Esto **no** es un
  detalle de implementación suelto: el orden por cercanía se hace en el cliente (SPEC-041), y
  si el cliente tuviera que recalcular la distancia habría **dos definiciones de RN-18**
  condenadas a divergir — la misma razón, escrita al revés, por la que `sort.ts` **no**
  recalcula el estado.
- **Superficies que se tocan**: la descripción única de columnas de `/vigiladas`, los
  criterios de orden, la hoja de estilos del *design system* para la barra, y el contenido de
  `/ayuda`.

## Dictamen de sdd-mercados (2026-09-12)

Consultado sobre la definición de la medida. **Correcto con condiciones**, y las condiciones
están arriba convertidas en CA:

1. **El denominador correcto es el precio actual**, no el borde de la zona: es la convención
   con la que se lee cualquier variación porcentual y es lo que el usuario pregunta. Con una
   advertencia: la medida **no es simétrica ni invertible** (bajar un 3,2% desde 100 lleva a
   96,8; subir un 3,2% desde 96,8 no devuelve a 100), así que **el sentido tiene que
   mostrarse siempre** — CA-8.
2. **Splits: la trampa seria, y queda como salvedad, no como alcance.** `quotes.price` es el
   cierre **no ajustado** (RN-12) y las zonas las escribió el usuario a mano, quizá meses
   antes. Después de un split, el precio cambia de escala y **la zona se queda en la
   anterior**: la distancia sale enorme —o pequeñísima— y **con cara de dato exacto**. Hoy el
   estado de zona ya sufre exactamente lo mismo y dice *Fuera*; la diferencia es que un
   número con un decimal **aparenta precisión que no tiene**. Por eso: **un solo decimal**, y
   nada de dos o tres. Detectar el split queda fuera (el proyecto lo tiene en stand-by
   deliberado desde el 2026-08-21).
3. **Divisa: sin riesgo, por construcción.** Es un cociente entre dos importes de la **misma**
   divisa y del **mismo símbolo** `(ticker, operating MIC)`: es adimensional. Lo que queda
   prohibido es **agregar** distancias entre símbolos (sumarlas o promediarlas); ordenar por
   ellas sí es legítimo, porque compara magnitudes adimensionales.
4. **Sin refrescar: es donde más daño hace.** Una barra casi llena sobre un precio de hace
   tres días es **el fallo de SPEC-043 otra vez**, pero con más fuerza persuasiva, porque una
   barra convence más que un `asOf` en gris. De ahí CA-13.
5. **`asOf` desigual por símbolo** (medido el 2026-08-21: el proveedor publica el EOD con
   retraso distinto según el símbolo). Ordenar por cercanía puede poner juntas dos filas con
   fechas distintas; es aceptable **porque la fecha sigue visible en cada fila**, y no se
   toca.
6. **D-4 no se rompe, y se rompería así**: la distancia no calcula ninguna zona —la zona sigue
   siendo del usuario íntegramente— ni recomienda nada; es aritmética entre dos datos que ya
   están en pantalla. Lo que **sí** cruzaría la raya es convertirla en criterio: un umbral de
   «caliente» propio de la app, un color que signifique *oportunidad*, o un **aviso**. Nada de
   eso entra aquí — CA-14, y el aviso sigue siendo idea sin compromiso en el roadmap.
7. **RN-13 intacta**: una barra llena **no es un disparo**. La entrada la sigue abriendo el
   ciclo con `entraEnZona`. De ahí la exigencia dura de CA-12: **el redondeo nunca puede
   producir la apariencia de haber entrado**.

## Fuera de alcance

- **Avisar por acercamiento** («zona caliente»): cambia la promesa del producto (D-1/D-2,
  modelo *edge-triggered* de ADR-005) y necesita su propio gate y su propio ADR. Sigue en el
  roadmap como idea sin compromiso; esta spec entrega **solo la señal visual**.
- **Umbral configurable** por usuario o por vigilada (y cualquier preferencia persistida:
  EPIC-MEJORA la excluye por texto propio).
- **El acercamiento en `/cartera`**: allí no hay zonas; la magnitud no existe.
- **Ajustar zonas o precios por eventos corporativos** (splits): stand-by deliberado.
- **Enseñar el acercamiento en el correo** de aviso o en `/avisos`.
- **Histórico de la distancia** (cómo se ha ido acercando): eso es EPIC-006, que sigue sin
  firmar.

## Decisiones del gate (2026-09-13, humano — Alberto Fojo)

Las cuatro preguntas que llevaba esta spec al gate, con su respuesta:

1. **Encaje en EPIC-MEJORA: se queda.** CE-M3 corta por *migración de esquema, proveedor
   nuevo o ADR*, y aquí no hay ninguno de los tres. La lectura estricta de CE-M1 —que habría
   mandado esto a una épica propia, «Zonas calientes»— se consideró y **se descartó**.
2. **Una sola barra por fila, apuntando a la zona más cercana** (no una por zona). Lo que se
   compra: una fila más limpia de leer, sobre todo en tarjeta. Lo que cuesta: la app decide
   **cuál de las dos zonas te importa**, y por eso esa regla —incluido el empate— está
   escrita como propiedad verificable en **CA-7** y no dejada al orden de evaluación.
3. **`ESCALA` = 10%**: la barra se llena a distancia 0 y queda vacía a partir de un 10%. Es
   **escala de lectura**, no umbral del dominio: no significa *«a partir de aquí, compra»*,
   vive en el código y se explica en `/ayuda` (CA-17).
4. **El aviso por acercamiento queda fuera** («solo se ve»). Sigue en el roadmap como idea
   sin compromiso, y necesitará gate y ADR propios cuando se pida.

Decisión de arquitecto tomada **después** del gate, y que conviene que se vea (CA-6): la
barra va **dentro de la celda de Estado** y no en una columna nueva, porque la tabla de
nueve columnas ya no cabe a 730–760 px y una décima empujaría justo ahí. Si en la revisión
visual la celda queda apretada, la salida **no** es encoger la barra: es apilar, como ya
decidió ADR-034 §10 para el pie de la tarjeta.
