---
id: ADR-035
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-24, por: sdd-arquitecto}
aprobada-por:
---
# ADR-035: Un suelo declarado se afirma sin holgura: la tolerancia de redondeo compara dos medidas, nunca una medida contra un umbral (precisa ADR-026 y ADR-034 §6)

- Deciders: propone **sdd-arquitecto** (2026-08-24), al recoger el finding
  **`F-VERIF-054-1`** de la verificación de **SPEC-054** y la devolución explícita del
  implementador, que topó con el problema, tuvo prohibido tocar el módulo y lo devolvió con
  dos salidas propuestas. **Pendiente de aprobación por el humano (Alberto Fojo).** No es una
  decisión de producto ni de stack: es una decisión sobre **qué significa un umbral** en la
  geometría del proyecto, y por tanto sobre cuándo una guardia está midiendo y cuándo está
  aprobando.
- Épica: **EPIC-007 — La app en el teléfono**, cuyo **CE-3** («se puede operar con el pulgar»,
  44 × 44 px) depende enteramente de que el suelo de M5 sea el que dice ser. Constriñe a las
  **tres** specs de la épica, y a cualquier guardia futura que compare contra un umbral.
- Specs relacionadas: lo **origina** SPEC-054 (el defecto se descubrió allí) pero **no se
  implementa allí** — ver §Decisión pto. 5. **Precisa —no supersede— ADR-026** (§2, el módulo
  compartido; `F-ADR-026-1`, la tentación de aflojar) y **ADR-034 §6** (M5 y el suelo de
  44 × 44). Ninguno de los dos se invalida: los dos decían ya lo correcto, y este ADR cierra
  el hueco entre lo que dicen y lo que el módulo hace.

## Contexto

**Los hechos, medidos, no supuestos.** La verificación de SPEC-054 (ronda 1, 2026-08-24)
encontró que **todos** los campos de formulario en alcance medían **43,00 px exactos** de
alto —8 en los formularios de compra y venta de `/cartera`, 5 en el alta desplegada de
`/vigiladas` y 4 en la capa de edición— y que **la guardia de M5 los daba por buenos**.

No los daba por buenos por un defecto de la guardia. Los daba por buenos porque
`medirAreaTactil`, en `tests/e2e/geometria.ts`, filtra así:

```ts
medidos.filter((m) => m.ancho < suelo - tolerancia || m.alto < suelo - tolerancia)
```

con `TOLERANCIA_PX = 1`, que el propio módulo documenta con todas las letras:

> *«Tolerancia de redondeo del motor, en px. **NO es una holgura de diseño**: es que
> `getBoundingClientRect()` devuelve fracciones y `clientWidth` enteros.»*

La documentación es **correcta para el caso para el que se escribió** —M1 compara el borde
derecho fraccionario de un rect contra un `clientWidth` entero, y ahí un píxel de margen es
obligatorio o la medida grita por medio píxel— y **falsa para el caso al que se aplicó**. En
M5 no hay ninguna asimetría fracción/entero que tolerar: hay un rect medido y un **44
escrito por nosotros**. Restarle uno no absorbe ruido del motor: **baja el suelo a 43**. Y
43,00 no es una fracción de redondeo; es exactamente el número que estaba pasando.

**Por qué esto es grave y no una minucia de un píxel.** ADR-034 §6 no adopta 44 porque sea
un número redondo: lo adopta **citando WCAG 2.2 SC 2.5.5 (*Target Size (Enhanced)*, nivel
AAA)** y los 44 pt de las *Apple HIG*, y se molesta en decir que el mínimo AA es 24 × 24 para
que nadie confunda el listón alto con el mínimo legal. Un suelo efectivo de 43 **no es SC
2.5.5**. Citar una norma y no cumplirla es peor que no citarla, porque el que lea el ADR
creerá que se cumple.

**Y ya estaba previsto que pasaría, aunque no por esta puerta.** `F-ADR-026-1` dice, literal:

> *«El módulo compartido crea un punto único de fallo con tentación de aflojar: un umbral
> relajado para "arreglar" un test rojo afecta ahora a todas las guardias a la vez. Las
> holguras deben seguir siendo de cada guardia, y una holgura nueva en el módulo debería
> justificarse por escrito.»*

Aquí nadie aflojó nada para arreglar un rojo: la holgura **ya estaba**, escrita para otra
medida, y M5 la heredó al nacer dentro del mismo módulo. Es la misma avería con la puerta al
revés, y es peor de detectar precisamente porque no hay ningún commit culpable que leer.

**Lo que el implementador devolvió.** Con la prohibición de tocar el módulo, cerró el defecto
donde sí podía —subiendo los campos de 43,00 a 45 px con `padding-block: 11px`, y añadiendo
en la ronda 2 una comprobación propia (`camposBajoElSuelo`) que mide con el primitivo del
módulo y **afirma el suelo sin tolerancia ninguna**— y devolvió el problema de fondo con dos
salidas propuestas: **(A)** que `medirAreaTactil` acepte la tolerancia **por parámetro**, con
la de hoy por defecto; **(B)** que la resta se aplique **sólo a fracciones**
(`alto < suelo && suelo - alto > fracción`). Las dos están consideradas abajo y las dos se
rechazan, por el mismo motivo.

## Decisión

### 1. Hay **dos clases de comparación** en la geometría, y sólo una admite tolerancia

- **Medida contra medida** — el borde derecho de un rect contra `clientWidth`, el `top` de una
  caja contra el `bottom` de la anterior, el `scrollLeft` de antes del gesto contra el de
  después, el solape entre dos rects. Los dos lados salen del motor, con precisiones
  distintas, y **la tolerancia es obligatoria**: sin ella la medida grita por medio píxel de
  redondeo y acaba desactivada por ruidosa. Aquí `TOLERANCIA_PX` se queda como está, en 1, y
  con su comentario intacto.

- **Medida contra umbral declarado** — un rect contra los **44** de M5, un `font-size`
  computado contra los **16** o los **12** de ADR-034 §7, un ancho contra los **34ch** de
  `.quote-*`. Un lado sale del motor; el otro **lo escribimos nosotros en un ADR**. No hay
  ninguna asimetría que absorber, y **la tolerancia no aplica**: se afirma `medida < umbral`,
  a secas. Si el umbral es 44, el suelo es 44.

**La regla en una línea, para que quepa en una revisión**: *si el número del otro lado de la
comparación está escrito en un ADR, no se le resta nada.*

### 2. Consecuencia concreta sobre el módulo

`medirAreaTactil` **deja de restar `TOLERANCIA_PX` al suelo**: el filtro pasa a ser
`m.ancho < suelo || m.alto < suelo`. `TOLERANCIA_PX` **no cambia de valor ni desaparece**:
sigue valiendo 1 y sigue rigiendo M1, M3, M4 **y el cálculo de solapes de la propia M5**, que
es medida contra medida —dos rects— y por tanto de la primera clase.

Lo mismo vale, por si algún día se escribe con resta, para `medirSuelosTipograficos`: 16 y 12
son umbrales declarados y se afirman a secas.

### 3. Un umbral no se baja para que pase un control

Es ADR-026 §4 y ADR-034 §6 otra vez, y se repite aquí porque la vía suave —**dejar de restar
en un sitio y volver a restar en otro**— es exactamente la que este ADR cierra. Cuando un
control no llega al suelo, la salida es **agrandarlo**; si dos controles de 44 no caben en una
línea, **apilarlos**. Bajar el suelo, o restarle una holgura, o pasarle una tolerancia propia,
es `F-ADR-026-1` cumpliéndose por escrito.

### 4. Una holgura nueva contra un umbral necesita **un ADR**, no un parámetro

Si algún día una superficie concreta necesita de verdad medir contra 43, eso **no es una
opción de guardia**: es un cambio del suelo del producto para esa superficie, y se decide
donde se decidió el 44 —en un ADR, citando qué criterio de accesibilidad se está dejando de
cumplir y a cambio de qué—. La firma de la función no es el sitio donde se toman decisiones
de producto.

### 5. Dónde se implementa: **no en SPEC-054**

SPEC-054 está implementada, verificada y su defecto concreto está cerrado (los campos miden 45
px, no 43). Meter aquí un cambio del módulo compartido significaría **volver a correr las
cinco medidas sobre todas las rutas medidas** en una spec que ya pasó dos rondas, por un
cambio que no arregla ningún rojo suyo. Esto entra en **una spec propia de EPIC-007**, y con
una condición de orden: **antes de que la spec 2 de la épica (la navegación) escriba guardias
nuevas de M5**, porque la navegación es justamente donde M5 va a decidir qué se agranda, y
decidirlo contra un suelo de 43 sería decidirlo mal. Queda como **`F-ADR-035-1`**.

## Consecuencias

### Positivas

- **El suelo de CE-3 vuelve a ser el que dice ser.** 44 × 44 pasa a significar 44 × 44, y la
  cita de WCAG 2.2 SC 2.5.5 en ADR-034 §6 vuelve a ser cierta.
- **`F-ADR-026-1` deja de tener una puerta trasera abierta.** El follow-up vigilaba que nadie
  *añadiera* una holgura; este ADR cubre el caso que no vigilaba, que es que una holgura
  legítima para una medida se **herede** por vecindad a otra que no la necesita.
- **La regla es general y barata de aplicar.** No hay que auditar el módulo entero: se mira
  cada comparación y se pregunta de dónde sale el número del otro lado. Cabe en una revisión.
- **Se generaliza a los suelos tipográficos y a cualquier umbral futuro**, que hoy no tienen
  el problema pero podrían adquirirlo por el mismo camino: naciendo dentro del módulo.

### Negativas / follow-ups

- **`F-ADR-035-1`** (dueño: **sdd-arquitecto**; **no bloquea SPEC-054**): el cambio en
  `medirAreaTactil` está decidido pero **no implementado**. Su sitio es una spec de EPIC-007,
  y tiene que entrar **antes** que las guardias de M5 de la spec 2.
- **Puede aparecer trabajo que hoy pasa.** Cualquier control cuya caja caiga entre **43,00 y
  43,99** px pasa hoy y dejará de pasar. Dentro del alcance de SPEC-054 no se espera ninguno
  —los campos están en 45, `.btn-sm` en 46 y el `select` del orden en 45— pero **eso hay que
  medirlo, no suponerlo**: la comprobación estricta de la ronda 2 (`camposBajoElSuelo`) sólo
  recorre los campos de formulario, no todos los controles. Fuera de alcance el efecto es
  seguro y ya está dimensionado: los doce controles de `F-SPEC-054-1` (nav, marca, pie,
  enlace de feedback) están muy por debajo de 43, así que no cambian de color.
- **M5 es hoy la única medida con umbral declarado**, así que el alcance real del cambio es
  pequeño. La **regla**, en cambio, es general — y ése es el motivo de escribirla en un ADR y
  no en un comentario del módulo, que es donde ya estaba la mitad correcta y no bastó.
- **Queda una asimetría honesta**: un control de 43,999 px falla y uno de 44,000 pasa, sin
  margen entre los dos. Es lo que significa un umbral. Si algún día un motor devuelve 43,9999
  por un control declarado a 44 exactos, **eso sí sería redondeo** y su sitio sería una
  tolerancia de esa guardia, con su motivo escrito — no una resta global.

## Alternativas consideradas

- **(A) La tolerancia por parámetro, con la de hoy por defecto** *(propuesta del
  implementador)*. **Rechazada.** Un parámetro con `TOLERANCIA_PX` por defecto deja el suelo
  efectivo en **43 para toda guardia que no lo pase**, que son todas las de hoy y todas las
  que alguien escriba sin leer esta discusión: el defecto sobrevive intacto y encima queda
  camuflado detrás de una firma que parece configurable a propósito. Y convierte una
  **propiedad del producto** —cuánto mide una diana— en una **opción de cada guardia**, que es
  literalmente lo que `F-ADR-026-1` pide evitar. Si el suelo pasa a ser negociable por
  llamada, deja de ser un suelo.

- **(B) Restar sólo a las fracciones** —`alto < suelo && suelo - alto > fracción`— *(propuesta
  del implementador)*. **Rechazada, aunque llega al resultado correcto en el caso de hoy.** Es
  la regla buena escrita al revés: introduce una segunda condición para simular que no hay
  tolerancia, en vez de decir que no la hay. Deja el suelo efectivo en 43 para cualquier
  control que aterrice en 43,5 —que es un valor perfectamente alcanzable con un
  `line-height` fraccionario— y obliga a quien lea el filtro a reconstruir la intención a
  partir de una aritmética. Lo que hay que arreglar no es *cuánto* se resta: es *que se reste*.

- **(C) Dejarlo como está y documentar que el suelo efectivo de M5 es 43.** **Rechazada.**
  Sería coherente consigo misma y es la más barata, pero obliga a reescribir ADR-034 §6
  quitando la cita de WCAG SC 2.5.5 —porque 43 no es ese criterio— y a explicarle a quien
  venga por qué el producto eligió un número que no es de ninguna norma. El coste de la salida
  correcta es un `-1` en un filtro; el de ésta es la credibilidad de todas las cifras que el
  proyecto cita.

- **(D) Arreglarlo dentro de SPEC-054.** **Rechazada por alcance, no por contenido.** La spec
  está verificada y su defecto cerrado; el cambio toca el módulo compartido y obliga a
  reejecutar las cinco medidas sobre todas las rutas medidas para cazar, con suerte, cero
  rojos nuevos. Un cambio de infraestructura de medida entra por su propia puerta y con su
  propia evidencia. Ver §Decisión pto. 5.

- **(E) Subir `SUELO_TACTIL_PX` a 45 para que, restando uno, el efectivo sea 44.**
  **Rechazada, y se anota por si a alguien le parece ingeniosa.** Deja el número mentiroso en
  las dos direcciones: el módulo diría 45, el ADR 44 y la realidad 44, y el día que alguien
  arregle la resta el suelo se iría a 45 sin que nadie lo decidiera. Un arreglo que depende de
  que otro defecto siga vivo no es un arreglo.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
