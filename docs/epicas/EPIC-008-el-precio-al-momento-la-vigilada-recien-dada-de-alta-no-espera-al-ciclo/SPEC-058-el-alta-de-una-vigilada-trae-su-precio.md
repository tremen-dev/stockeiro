---
id: SPEC-058
tipo: spec
epica: EPIC-008
estado: en-progreso
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-25, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-25, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-25, por: sdd-implementador}
---
# SPEC-058 — El alta de una vigilada trae su precio

## Problema

Dar de alta una vigilada en `/vigiladas` crea el símbolo y la fila, **mete el símbolo en el
universo del ciclo y ahí acaba su trabajo**. El único camino por el que un precio entra en la
base es el cron `0 22 * * *` (`vercel.json` → `/api/cron/refresh` → `runCronCycle` →
`refreshQuotes`), así que entre el alta y el ciclo siguiente hay **hasta 24 horas** en las que
la fila recién creada enseña una de estas dos cosas:

1. **Símbolo nuevo**: sin cotización, estado de zona en neutro (`state: 'none'`) y **sin
   diagnóstico**, porque no ha fallado nada — el ciclo sencillamente no ha corrido.
2. **Símbolo que alguien dejó de seguir**: el precio **congelado** del día en que salió del
   universo, marcado *sin refrescar* (RN-16). Honesto, pero no es lo que el usuario acaba de
   pedir.

Las dos comparten la frase del usuario, observada sobre la pantalla real el 2026-08-25:
*«acabo de decirle a la app que vigile esto y la app no sabe cuánto vale»*.

Esta spec entrega el **refresco bajo demanda** en su primera y única puerta: **el alta pide el
precio de ese símbolo en el acto y lo persiste**. Cubre **CE-1** (la vigilada nace con precio),
**CE-2** (nunca peor que hoy), **CE-3** (el disparo sigue siendo diferido) y **CE-4** (la cuenta
del coste, escrita) de EPIC-008. Implementa **ADR-038**, que es donde vive la lectura de **D-2**
que la hace legal —*el precio se puede pedir bajo demanda; el disparo y el aviso siguen siendo
del ciclo*— y el dictamen de **sdd-mercados** del 2026-08-25.

Reglas: **RN-12** (base = último cierre **no ajustado**), **RN-11** (entrada en zona), **RN-09**
(la divisa es la del símbolo, no la del proveedor), **RN-16** (cotización sin refrescar, medida
por `updated_at`), **RN-13**/**RN-14** (el disparo y el aviso, que **no** se tocan), **RN-01**
(aislamiento), **RN-03** (acceso autenticado). Hereda **ADR-002** (dedupe), **ADR-004**,
**ADR-005**, **ADR-007**/**ADR-012** (identidad `(ticker, operating MIC)`), **ADR-026** (una
medida, un módulo), **ADR-027** (unidad de presupuesto), **ADR-028** (el gesto no dispara),
**ADR-032** (cupo de 10.000/mes) y el vocabulario de fallo de **SPEC-016**/**SPEC-020**.

**Esta spec no cambia el esquema y no lleva migración.** No hay columna nueva, no hay tabla
nueva y no hay bandera de «precio provisional» (ADR-038 pto. 9) — deliberadamente, porque
`main` migra producción desde cualquier PR.

## Usuarios / roles afectados

- **Usuario final** (autenticado, RN-03; sección Vigiladas para cualquier rol, incluido
  `tester`, ADR-021): da de alta una acción en `/vigiladas` y **ve su precio y su estado de zona
  en la misma respuesta**, sin recargar y sin esperar a la noche. Si el precio no se pudo traer,
  el alta se completa igual y la pantalla le dice lo que sabe.
- **Sistema (ciclo de refresco)**: **no cambia**. Mismo universo, mismo orden ingesta →
  disparos → avisos, misma cadencia, y **sin presupuesto de tiempo** (el ciclo no tiene prisa).
  Sigue siendo el único que compara con las zonas y el único que manda correo.
- **Operador**: un segundo escritor sobre `quotes`, y un consumo extra acotado que queda
  contado abajo.

## Criterios de aceptación

Cada CA es verificable con un test. Unitarios sobre servicio, refresco y acción con **PGlite**
(`makeTestDb`, esquema desde las migraciones reales, ADR-019) y **proveedor falso**; **e2e
Playwright** los que dicen pantalla, con `E2E_FAKE_QUOTES=1`; los del ciclo se ejercen llamando
a `runRefreshCycle` con proveedor y `sender` falsos, como ya hacen SPEC-005, SPEC-006 y
SPEC-044.

### Rebanada 1 — La vigilada nace con precio (CE-1)

- **CA-1 (Un símbolo nuevo entra ya con su precio).**
  Dado un usuario autenticado y un símbolo que **nadie** vigila ni ha operado, y un proveedor
  que devuelve precio para él,
  cuando el usuario lo da de alta desde `/vigiladas`,
  entonces al terminar la acción existe **una** cotización para ese símbolo con el **precio**
  y el **`asOf`** que devolvió el proveedor y con la **divisa del símbolo** (RN-09), y su
  estado de zona deja de ser *sin dato*: `hasQuote` es cierto y el `state` es el que dictan sus
  zonas y ese precio (RN-11). No queda diagnóstico vigente para ese símbolo.

- **CA-2 (El símbolo congelado se descongela, incluso si el precio no ha cambiado).**
  Dado un símbolo con cotización cuyo `updated_at` supera el umbral de RN-16 —o sea, la
  pantalla la presenta como *sin refrescar*—,
  cuando un usuario lo da de alta,
  entonces tras la acción **deja de estar marcada sin refrescar**.
  Las **dos direcciones**, y la segunda es el caso que importa:
  - el proveedor devuelve un precio **distinto** → la fila lleva el precio nuevo y pierde la marca;
  - el proveedor devuelve **exactamente el mismo `price` y el mismo `asOf`** que ya había → la
    fila **también** pierde la marca, porque lo que RN-16 mide es **cuándo se escribió**, no qué
    se escribió.

- **CA-3 (Aparece sin que el usuario recargue).**
  Dado un usuario en `/vigiladas`,
  cuando envía el formulario de alta de una acción cotizable,
  entonces **en la propia respuesta a ese envío** —sin navegar, sin recargar y sin ninguna
  acción adicional— la fila nueva enseña **precio, fecha del precio y el color de fondo del
  estado de zona** que le corresponde (SPEC-007).

- **CA-4 (La identidad y la divisa son las del símbolo, no las del proveedor).**
  Dados dos símbolos con el **mismo ticker** en **dos mercados** distintos y con **divisas**
  distintas (ADR-007/ADR-012),
  cuando se da de alta cada uno,
  entonces cada fila de cotización lleva **el precio del mercado que se pidió** y **la divisa de
  su símbolo**, y ninguna toma la divisa que devuelva —o deje de devolver— el proveedor.
  Especímenes en las dos direcciones: un proveedor que devuelve una divisa **contradictoria** no
  la impone; un proveedor que **no devuelve divisa** (el caso real de Marketstack) no deja el
  campo vacío ni lo adivina.

### Rebanada 2 — Nunca peor que hoy (CE-2)

- **CA-5 (Fallo clasificado: el alta se completa y el silencio deja de ser mudo).**
  Dado un proveedor que **responde** y no sirve ese símbolo (cualquiera de los motivos
  clasificados de SPEC-016/SPEC-020),
  cuando el usuario lo da de alta,
  entonces la acción devuelve éxito, la vigilada existe con **sus cuatro zonas tal como se
  escribieron**, no se persiste cotización, y queda un **diagnóstico vigente con ese motivo**,
  de modo que la fila explica su silencio **desde el primer minuto** en vez de a las 22:00.

- **CA-6 (Fallo inesperado: el alta tampoco se entera).**
  Dado un adaptador que **lanza** en vez de informar el fallo por símbolo —excepción no
  contemplada, clave de API ausente—,
  cuando el usuario da de alta,
  entonces la acción devuelve éxito, la vigilada existe, y el símbolo queda con
  `proveedor_no_disponible`, que es el camino de degradación que **ya existe** (SPEC-020 CA-9).
  No hay motivo de fallo nuevo en el vocabulario de dominio.

- **CA-7 (Presupuesto de tiempo: el alta no espera indefinidamente, y su agotamiento no inventa
  nada).**
  Dado un proveedor que **no responde nunca**,
  cuando el usuario da de alta,
  entonces la acción **termina** dentro del presupuesto de tiempo declarado, devuelve éxito, y
  el símbolo queda con `proveedor_no_disponible` — **el mismo tratamiento que CA-6**, sin motivo
  ni rama propios.
  Las **dos direcciones**, porque sin la segunda la guardia estaría cazando *«el proveedor
  falla»* en vez de *«el proveedor tarda»*: un proveedor que responde **por debajo** del
  presupuesto **sí** persiste su precio y **no** deja diagnóstico.
  El presupuesto es **inyectable** en el punto donde se aplica, para que la propiedad se pueda
  afirmar sin esperar segundos reales, y su valor por defecto se declara **en un solo sitio**
  (ADR-026 pto. 2; ADR-038 pto. 5).

- **CA-8 (Marcar no es borrar: un fallo no destruye el precio viejo).**
  Dado un símbolo con cotización congelada y marcada *sin refrescar*,
  cuando su refresco al alta **falla** por cualquiera de los caminos de CA-5, CA-6 o CA-7,
  entonces la cotización vieja **sigue ahí, intacta** (mismo `price`, misma `currency`, mismo
  `asOf`, misma `updated_at`) y **sigue marcada** *sin refrescar*, ahora acompañada del motivo
  (RN-16, SPEC-043 CA-10). No se borra, no se pone a cero y no se presenta como vigente.

- **CA-9 (El resultado del refresco no puede alterar el alta).**
  Dada la **misma** alta —mismo usuario, mismo símbolo, mismas cuatro zonas— ejecutada contra
  proveedores que se comportan de forma distinta: uno que acierta, uno que falla clasificado,
  uno que lanza y uno que no responde,
  entonces **lo que la acción devuelve y lo que queda en `watched_symbols` es indistinguible en
  los cuatro casos**: mismo resultado de éxito, misma fila con sus zonas, mismo recuento.
  *El precio es un extra, jamás un requisito del alta* (ADR-038 pto. 4).

### Rebanada 3 — El disparo y el aviso siguen siendo del ciclo (CE-3)

- **CA-10 (Un alta no dispara y no avisa, ni cuando el precio cae dentro de la zona).**
  Dado un usuario que da de alta una acción con zona de compra, y un proveedor cuyo precio
  **cae dentro** de esa zona,
  cuando termina la acción,
  entonces la pantalla la pinta **en zona de compra** y, a la vez, **no existe ningún episodio**
  para esa vigilada, **ningún aviso** registrado y **ningún envío** observado en el `sender`.
  **Control positivo obligatorio en el mismo test**: ejecutar a continuación el ciclo sobre ese
  mismo estado **sí** abre exactamente un episodio y **sí** emite exactamente un aviso — sin él,
  el CA pasaría igual con el motor roto.

- **CA-11 (Que la pantalla vaya por delante del correo no se lee como un fallo).**
  Dado un usuario con al menos una vigilada **en zona**,
  cuando mira `/vigiladas`,
  entonces lee, **en esa misma pantalla**, que el aviso se emite en el ciclo diario y no en el
  momento en que la fila se pinta en zona.
  El texto vive en el **mismo módulo de contenido compartido** que la frase de la cadencia
  (`src/lib/help/content.ts`) y la sección de cadencia de `/ayuda` lo incluye: **una frase, dos
  sitios que la muestran, ninguna copia** (ADR-026 pto. 2; precedente SPEC-044 CA-22). La prosa
  de esa sección **deja de decir que el ciclo es quien pide los precios**, porque a partir de
  esta spec no es el único; lo que sigue diciendo, y es lo que importa, es que el ciclo es el
  único que **compara con las zonas y avisa**.

### Rebanada 4 — El gasto: acotado, y contado en la unidad canónica (CE-4, R-2 de la épica)

- **CA-12 (No se le pide al proveedor un precio que ya está al día).**
  Dado un símbolo cuya cotización es **vigente** —existe y **no** está *sin refrescar* (RN-16)—,
  cuando un usuario lo da de alta,
  entonces **no se produce ninguna llamada al proveedor**, y la fila enseña igualmente precio y
  estado de zona, así que **CE-1 se cumple sin gastar nada**.
  Las **dos direcciones**, con sus especímenes mínimos: **no se llama** con una cotización
  escrita hace una hora; **sí se llama** con un símbolo que **no tiene** cotización y con uno
  cuya cotización está *sin refrescar*.
  La guardia cuenta **invocaciones al proveedor**, no ausencia de una forma concreta de llamada.

- **CA-13 (Repetir el gesto no repite el gasto).**
  Dado un símbolo cualquiera,
  cuando el gesto se repite —dar de alta **dos veces seguidas** lo mismo (`watchSymbol` es
  *upsert*), o `unwatch` y volver a dar de alta, o que **un segundo usuario** dé de alta el
  mismo símbolo—,
  entonces el proveedor recibe **una sola** llamada en total: la primera. El usuario no tiene un
  botón de gastar cuota sin saberlo.

- **CA-14 (La condición de gasto y la marca de la pantalla no pueden divergir).**
  Dado un símbolo **con** cotización y un conjunto de antigüedades de escritura que cruzan el
  umbral de RN-16 por ambos lados,
  entonces *«la pantalla la presenta como vigente»* y *«el alta no la vuelve a pedir»* son
  **la misma respuesta para toda antigüedad**, sin excepción y sin zona intermedia. No existe
  un segundo umbral, ni un valor de antigüedad para el que la pantalla diga *al día* y el alta
  la considere caducada, ni al revés (ADR-038 pto. 6).

### Rebanada 5 — Un solo camino de ingesta (ADR-038 pto. 2)

- **CA-15 (El ciclo y el alta ingieren igual, o no ingieren igual).**
  Dado el **mismo** símbolo y la **misma** respuesta del proveedor,
  cuando el precio lo ingiere el **ciclo** y cuando lo ingiere el **alta**,
  entonces lo que queda persistido es **indistinguible**: mismo `price`, misma `currency`, mismo
  `asOf`, mismo tratamiento del diagnóstico.
  Las **dos direcciones**: con una respuesta **buena** (fila escrita y diagnóstico previo
  **borrado** en los dos casos) y con un **fallo clasificado** (ninguna fila escrita y **el mismo
  motivo** registrado en los dos casos). La comparación es entre **los dos caminos reales**
  ejecutados en el mismo test, no entre un camino y una expectativa escrita a mano.

### Rebanada 6 — Dominio y cero regresión

- **CA-16 (El rótulo se copia, no se inventa).**
  Dado que esta spec introduce vocabulario de dominio nuevo —**«refresco bajo demanda»** y su
  regla— y **precisa la redacción de RN-16**,
  entonces la implementación **copia** el rótulo de `docs/fundacion/dominio.md` y
  `docs/fundacion/reglas.md`, que los escribe **sdd-arquitecto en el gate de aprobación**
  (ADR-025). Si el término falta cuando llegue la implementación, se **levanta el residual y no
  se escribe en el documento de verdad**.
  Lo que la precisión de RN-16 cambia es **solo la redacción** —`updated_at` es *cuándo se
  escribió la fila*, no *cuándo la escribió el ciclo*—: **umbral (36 h), medida (`updated_at` y
  nunca `as_of`), los tres motivos por los que se mide así y la premisa de ciclo diario sin
  saltos quedan intactos**, y `src/lib/market/sin-refrescar.ts` sigue siendo su único hogar.

- **CA-17 (Cero regresión, y el ciclo hace exactamente lo que hacía).**
  Cuando se ejecuta la batería completa (`npm test` y Playwright),
  entonces está verde **sin reescribir ni aflojar ninguna aserción ajena**, y el ciclo diario
  conserva su comportamiento: mismo universo (`watched_symbols ∪ transactions`), mismo orden
  ingesta → disparos → avisos, misma cadencia declarada y **sin presupuesto de tiempo**.
  Verificable en el gate comparando contra la línea base de `origin/main` con la ventana de diff
  **anclada a esta entrega**; **no se escribe como guardia congelada en `tests/`** (ADR-031,
  ADR-037 y el tercer corolario de FOUNDATION).

## Entidades y reglas afectadas

- **Términos de `docs/fundacion/dominio.md`**: «Cotización sin refrescar» (**se precisa la
  redacción**, no el fondo), «Puerto de datos de mercado (`MarketDataProvider`)», «Caché de
  cotizaciones deduplicada» (se extiende al camino bajo demanda), «Estado de zona». **Término
  nuevo: «Refresco bajo demanda»**, que escribe sdd-arquitecto en el gate (ADR-025).
- **Reglas**: **RN-12** (base no ajustada, intacta), **RN-11** (entrada en zona, computada en
  render, intacta), **RN-09** (divisa del símbolo), **RN-16** (**redacción precisada**),
  **RN-13**/**RN-14** (disparo y aviso: **no se tocan**), **RN-01**, **RN-03**. **Regla nueva:
  RN-17 (refresco bajo demanda)**, que escribe sdd-arquitecto en el gate.
- **ADRs**: **ADR-038** (esta spec lo implementa), **ADR-002** pto. 4 (dedupe, extendido),
  **ADR-004**, **ADR-005**, **ADR-007**, **ADR-012**, **ADR-014**, **ADR-026**, **ADR-027**
  pto. 1 (unidad de presupuesto), **ADR-028** pto. 3 (el gesto no dispara), **ADR-032** (cupo).
- **Esquema**: **sin cambios y sin migración**. Se escribe en `quotes` y en `quote_diagnostics`
  por el mismo camino que el ciclo.
- **Superficie de código prevista**: `src/lib/market/refresh.ts` (extracción del cuerpo
  compartido y refresco de un símbolo), `src/lib/market/sin-refrescar.ts` (predicado de
  *vigente*, en su único hogar), `src/app/vigiladas/actions.ts` (`watchAction`),
  `src/lib/help/content.ts` y el render de `/vigiladas` (CA-11). **El motor
  (`src/lib/triggers/`) y las notificaciones no se tocan.**

### La cuenta del consumo (CE-4), en la unidad de ADR-027 pto. 1

La unidad canónica es **símbolos distintos × ciclos**; **1 símbolo pedido = 1 unidad**, sin
descuento por ir en un lote (medición y documentación en ADR-027). Cupo: **10.000/mes**
(ADR-032).

| Concepto | Unidades/mes | % del cupo |
|---|---|---|
| Hoy, solo el ciclo: 13 símbolos × 31 ciclos | **≈ 403** | 4 % |
| Extra de esta spec, escenario plausible: 100 altas/mes que **todas** refrescan | **+100** | +1 % |
| **Total previsto** | **≈ 503** | **5 %** (margen ~20×) |

- **Cota superior dura** del camino nuevo: **1 unidad por símbolo distinto y ventana de RN-16**
  (36 h), o sea **≤ 1 unidad por símbolo y día**, por CA-12 y CA-13. Un usuario **no puede**
  gastar más repitiendo el gesto.
- **El extra es pequeño porque es de una sola vez**: un símbolo recién vigilado costará **1
  unidad cada día hasta fin de mes** por el mero hecho de estar vigilado. El refresco al alta
  añade, como mucho, **el equivalente a un día más de vigilancia de ese mismo símbolo**.
- **El techo del plan no lo mueve esta spec**: sigue siendo el número de **símbolos distintos
  vigilados**, `10.000 / 31 ≈ **322**`. Con 20 testers y ~13 símbolos hoy, el margen es el que
  ya había.
- **Los errores no consumen cuota** (ADR-027). **Un presupuesto de tiempo agotado sí la
  consume**, porque la petición ya salió: el presupuesto ahorra espera, no cuota (ADR-038 pto. 5).

## Fuera de alcance

Aparcado a propósito, no por descuido. Lo de la épica, más lo que esta spec añade:

- **El alta manual de una posición en `/cartera`** y **el import desde bróker (EPIC-002)**:
  decisión del humano del 2026-08-25. El import, además, tiene un patrón de consumo distinto
  —decenas de símbolos de golpe— y quien lo abra vuelve a ADR-038 ptos. 6 y 8.
- **Un botón de «actualizar ahora»** sobre una vigilada existente. Es el vecino más tentador y
  no está observado. Además es el único gesto **repetible a voluntad** de la lista, así que es
  el que puede ráfagar contra el tope por segundo del proveedor (ADR-038, dictamen aviso 6).
- **Avisar al momento.** Si el precio refrescado ya está en zona, la tabla lo pinta y **el correo
  espera al ciclo** (CE-3, D-2, ADR-005, ADR-028 pto. 3).
- **Tiempo real, polling, refresco automático de la pantalla y disparadores por valor puntual.**
  Vetados por D-2 y D-3; esta spec añade **un** refresco atado a **un** gesto.
- **Cambiar la cadencia del ciclo** (ADR-004), **el umbral de RN-16** o **el plan del proveedor**
  (ADR-032).
- **Tocar el motor de disparo o las notificaciones.** Persistir el precio basta para que la fila
  pinte precio y color, porque el estado de zona se computa **en render**.
- **Refrescar en segundo plano** (cola, `waitUntil`, segundo *round-trip* del cliente):
  alternativa (d) de ADR-038, rechazada hoy y reconsiderable **por ADR** si la latencia medida
  molesta.
- **Marcar el precio bajo demanda como «provisional»**: ADR-038 pto. 9.

## Notas para el gate humano

Cinco cosas que mirar con lupa, y dos preguntas que necesitan respuesta antes de aprobar.

1. **Lo que de verdad se aprueba aquí es la lectura de D-2, y está en ADR-038 pto. 1.**
   D-2 está *locked*. La spec entera se sostiene sobre leerla así: *«D-2 gobierna el **disparo**
   y el **aviso**; la ingesta es el insumo, no el gatillo»*. Los tres apoyos —el sujeto de la
   frase de D-2 es *el disparo*; el no-negociable que la acompaña es de presentación y se sigue
   cumpliendo; y el dato **no** se vuelve de tiempo real por pedirlo antes, porque
   `/v1/eod/latest` devuelve el mismo cierre no ajustado a cualquier hora— están en el ADR. **Si
   esta lectura no convence, la spec no se puede implementar**: no es un detalle que se ajuste
   después.

2. **El correo puede no llegar nunca en un caso concreto, y hay que quererlo.** Precio de ayer
   dentro de zona a las 10:00 (la pantalla dice «En compra») y precio de hoy fuera a las 22:00:
   el motor **nunca ve la entrada** y no sale aviso. Es D-2 funcionando —lo que se compara es el
   cierre del ciclo, que es lo que `/ayuda` ya promete—, pero es nuevo que el usuario **vea** el
   estado intermedio. **CA-11** existe para que no se lea como un fallo. Aviso 3 del dictamen de
   sdd-mercados.

3. **PREGUNTA 1 — ¿3 segundos de presupuesto?** El alta pasa a esperar a un tercero desde un
   formulario que hasta hoy solo hablaba con la base. **La latencia real no está medida**: 3 s es
   un techo razonado (1 s se agotaría con latencia normal; 10 s hace que la gente pulse dos
   veces), no un percentil observado. Si prefieres otro número, es el sitio de decirlo — y si
   prefieres que el alta no espere en absoluto, eso es la alternativa (d) de ADR-038 y **cambia
   la spec**, no un parámetro.

4. **PREGUNTA 2 — ¿Dónde va la frase de CA-11 y cuándo se ve?** La spec la pone en `/vigiladas`
   **siempre que haya al menos una vigilada en zona**. Se eligió eso, y no solo `/ayuda`, porque
   este repositorio ya tiene escrito el precedente contrario: *«decirlo una vez, en la ayuda, no
   sirve: nadie lee la ayuda antes de quejarse»* (SPEC-039, comentario de `CADENCIA_LINEA`). El
   precio es que la verá **cada día** quien tenga algo en zona de forma permanente. La
   alternativa —enseñarla solo justo después de un alta— pide plumbing de estado en la acción y
   más superficie en el render, que es justo donde R-4 avisa de colisiones. **Dilo aquí si
   prefieres la otra.**

5. **La condición que evita gastar cuota mira el DATO, no el GESTO** (ADR-038 pto. 6), y es la
   decisión técnica menos obvia de la spec. No es *«solo si el alta es nueva»* —eso deja fuera el
   `unwatch`+`watch` y al segundo usuario, y gasta cuando el precio de anoche ya está en la
   fila—: es *«solo si la cotización no es vigente»*, con **el mismo umbral de RN-16**. **CA-14**
   existe para que las dos cosas no puedan divergir nunca. Consecuencia que conviene ver: un
   símbolo refrescado anoche **no** se vuelve a pedir al darlo de alta hoy — y CE-1 se cumple
   igual, porque el precio ya está.

6. **Segundo escritor sobre `quotes`, y una regla que había que precisar.** RN-16 dice *«el
   momento en que el **ciclo** la escribió»*; a partir de aquí hay dos escritores. **CA-16**
   precisa la redacción **sin tocar umbral, medida ni motivo**. Lo escribo yo al aprobar
   (ADR-025), junto con **RN-17** y el término **«refresco bajo demanda»**. Cualquier lectura
   futura que asuma *«esta fila la escribió el cron»* pasa a ser falsa.

7. **Colisión con lo que está en vuelo (R-4 de la épica).** El grueso de la spec vive en
   `src/lib/market/refresh.ts` y `src/app/vigiladas/actions.ts`, que **SPEC-054** (tarjetas en
   móvil) y **SPEC-045** (silenciar) no tocan. **La excepción es CA-11**, que sí entra en el
   render de `/vigiladas`. Quien llegue el segundo **rebasa y reconcilia**; ninguna de las tres
   está en `main`.

8. **Lo que NO se toca, para que conste en el gate**: el motor (`src/lib/triggers/`), las
   notificaciones, el esquema, la migración, la cadencia del cron y el umbral de RN-16.
