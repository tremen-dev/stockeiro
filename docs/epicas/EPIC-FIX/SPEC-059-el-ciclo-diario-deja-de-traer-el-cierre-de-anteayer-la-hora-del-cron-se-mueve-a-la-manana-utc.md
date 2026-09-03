---
id: SPEC-059
tipo: spec
epica: EPIC-FIX
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-09-03, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-03, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-09-03, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-09-03, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-09-03, por: sdd-verificador}
---
# SPEC-059 — El ciclo diario deja de traer el cierre de anteayer: la hora del cron se mueve a la mañana UTC

## Problema

El ciclo diario **corre bien y trae el dato equivocado**. Se dispara antes de que Marketstack
publique el EOD de la sesión, así que **guarda siempre el cierre de la sesión anterior a la que
tocaba**: durante todo el día de hoy el usuario está mirando **el cierre de anteayer**.

### La evidencia, medida en producción el 2026-09-03

No hay que reproducirla ni gastar cuota volviéndola a pedir: está recogida y se cita.

1. **El cron corre y termina bien.** Últimas filas de `cron_runs`:
   `2026-09-02T22:48:45Z | outcome=success | requested 21 | updated 20 | skipped 1`, y **nueve
   días consecutivos** iguales, **sin un solo `failure`** y **sin ninguna fila con `finished_at`
   nulo**. No es un fallo del ciclo, ni de autorización (`CRON_SECRET`), ni del proveedor, ni de
   cuota (ADR-032 deja margen ~25×).
2. **Lo que trajo era viejo.** Las **20** cotizaciones que esa ejecución escribió quedaron todas
   con `as_of = 2026-09-01`: **un día por detrás de la ejecución**. Fila de muestra:
   `WEN | as_of 2026-09-01 | updated_at 2026-09-02T22:48:47Z | 8.27 USD`.
3. **El dato del día 2 existía, solo que más tarde.**
   `GET /v1/eod/latest?symbols=WEN,NOW,TEP.XPAR`, ejecutada el **2026-09-03 a las 11:05 UTC**,
   devuelve `date: 2026-09-02T00:00:00+0000` y `WEN close 8.24`. El histórico
   (`GET /v1/eod?symbols=WEN&date_from=2026-08-31&date_to=2026-09-03`) confirma la serie:
   `2026-09-02 → 8.24`, `2026-09-01 → 8.27`, `2026-08-31 → 8.30`. O sea: el **8.27** que se
   guardó es **exactamente** el cierre del día 1, y a las **22:48 UTC del día 2** el endpoint
   todavía servía el del día 1.

### Qué NO está roto, y hay que decirlo antes de tocar nada

**El código está bien.** El adaptador (`src/lib/market/marketstack-provider.ts`) y el ciclo
(`src/lib/triggers/cycle.ts`, `src/lib/market/refresh.ts`) hacen lo correcto, y el `asOf` que
persisten es **honesto**: dice D-2 porque el dato **es** de D-2, y la pantalla lo enseña con su
fecha al lado tal y como exige D-2 de FOUNDATION. Lo único que está mal es **cuándo se pregunta**:
`vercel.json` declara `0 22 * * *`.

El coste para el usuario no es cosmético. Se pierde **una sesión entera** en todo lo que cuelga
del precio: el **P/L actual** (RN-06), el **estado de zona** (RN-11) y —lo que más duele— el
**disparo** y el **aviso** (RN-13, RN-14). Un valor que entra en zona el lunes se avisa el
miércoles. Es exactamente **CE-F1** de EPIC-FIX: una capacidad ya entregada y verificada que no
cumple su promesa con datos reales.

### El agravante que lo hace urgente: la cuenta pasó a Vercel Pro

Las horas de `cron_runs` son **todas las 22:48**, no las 22:00 declaradas. Ese es el
comportamiento de **Hobby**: dispara en un minuto cualquiera dentro de la hora y **no garantiza
el día** —falta la ejecución del **2026-08-24**, con un salto del `2026-08-23T22:50Z` al
`2026-08-25T07:38Z`, y esta última con pinta de disparo manual—.

En **Pro** el cron se dispara **clavado a las 22:00 UTC**, o sea **48 minutos antes** que ahora.
**Si no se toca el horario, el paso a Pro deja la foto igual o peor**, en silencio.

### Qué entrega esta spec

**Mover la hora del ciclo a `0 6 * * *`** —06:00 UTC, 08:00 de Madrid en horario de verano— y
dejar escrito el criterio con el que se elige, para que el defecto no pueda volver por la misma
puerta. La decisión que lo gobierna es **ADR-039** —*la hora del ciclo la fija cuándo publica el
proveedor, no el cierre de mercado; precisa ADR-004 pto. 1*—, que nace con esta spec, **no
supersede a nadie** y quedó **aprobado por el humano (Alberto Fojo) el 2026-09-03**.

**La hora es una decisión cerrada, no un parámetro que el implementador elija**, y viene con una
salvedad que no se borra por estar aprobada: **06:00 UTC no está probada por la evidencia** —cae
dentro de la ventana abierta `(22:48, 11:05)` UTC— y se eligió por **asimetría de riesgo**, porque
el peor caso de equivocarse es el statu quo (ADR-039 pto. 5). De ahí que **CA-8 no sea opcional**:
es la condición de la elección, con el desenlace ya pactado si falla (ADR-039 pto. 4: mover a
≥ 11:05 UTC, **sin ADR nuevo**).

**La cadencia no se toca**: sigue siendo **1×/día a hora fija UTC** (ADR-004 pto. 1), y el
rechazo explícito de ADR-004 a la cadencia 2×/día u horaria **sigue vivo**. **D-2 no se roza**:
mover la hora del ciclo es acordar otro momento del **mismo** ciclo.

Reglas y decisiones que cita, sin duplicarlas: **RN-12** (base = último cierre no ajustado),
**RN-11** (entrada en zona), **RN-13**/**RN-14** (disparo y aviso, que **no** cambian de regla
pero **sí** de hora de llegada), **RN-16** (cotización sin refrescar y su umbral de 36 h),
**RN-17** (refresco bajo demanda, el segundo escritor), **RI-03** (el diff acotado es criterio de
gate); **ADR-004** (precisado por ADR-039), **ADR-006** (canal del aviso), **ADR-012**/**ADR-027**/
**ADR-032** (proveedor, unidad de presupuesto y plan), **ADR-018** (*mergear es desplegar*),
**ADR-023** (`cron_runs`), **ADR-026 pto. 2** (una medida, un módulo), **ADR-033** (bump de
versión en dos ficheros), **ADR-038** (el disparo y el aviso siguen siendo del ciclo).

**Cero esquema, cero migración.** No hay columna, tabla ni bandera nueva.

## Usuarios / roles afectados

- **Usuario final.** Deja de mirar el cierre de anteayer: precio, P/L actual y estado de zona
  pasan a ser de la **última sesión cerrada**. Y su **aviso adelanta un día entero**.
  **Contrapartida que tiene que constar**: el correo **cambia de franja horaria**. Hoy sale a las
  **00:48 de Madrid** (de madrugada, se encuentra al despertarse); con `0 6 * * *` pasa a salir a
  las **08:00 de Madrid** (07:00 en invierno), con el mercado europeo a punto de abrir y el
  estadounidense cerrado. Nadie lo ha pedido: es efecto colateral de arreglar el dato, y por eso
  está escrito aquí y en ADR-039 pto. 7, **aceptado por el humano junto con la hora**.
- **Sistema (ciclo de refresco).** **No cambia nada de su código.** Mismo endpoint, mismo
  universo, mismo orden ingesta → disparos → avisos, misma cadencia, mismo consumo de cuota
  (mismo lote de símbolos, una vez al día, en la unidad de **ADR-027 pto. 1**). Cambia **un
  número de cinco campos** en `vercel.json`.
- **Quien despliega.** Un cambio en `crons` **solo entra en vigor con un despliegue de
  producción**. Aquí **mergear ES desplegar** (ADR-018 / SPEC-028), así que el merge de la PR lo
  activa — pero eso convierte el **momento del merge** en una decisión con consecuencia
  (CA-7) y deja la comprobación del arreglo **fuera de la batería** (CA-8).

## Criterios de aceptación

> **Nota de encuadre, y aplica a todos.** Esta entrega vive en una frontera incómoda: lo que se
> puede probar con un test es **qué hora está declarada** y **que nada la contradiga**; que el
> proveedor ya hubiera publicado a esa hora **solo se ve en producción**. Los CA lo dicen en voz
> alta en vez de fingir cobertura: **CA-1 a CA-6** son automáticos, **CA-7 y CA-10** son cálculo
> y criterio de gate sin guardia permanente, y **CA-8** es observación post-deploy. Ninguno finge
> ser otra cosa.
>
> **La hora está decidida: `0 6 * * *`** (06:00 UTC = 08:00 de Madrid en horario de verano),
> elegida por el humano (Alberto Fojo) en el gate del **2026-09-03** entre las tres opciones que
> §Notas para el gate humano pto. 1 deja documentadas con su precio. **No es un parámetro
> abierto**: el implementador escribe ese valor, no elige.
> Aun así los CA siguen enunciados **sobre la propiedad y no sobre el número** donde eso es
> posible, por un motivo práctico y no estético: **ADR-039 pto. 4 deja pactado que la hora se
> mueva a ≥ 11:05 UTC sin ADR nuevo** si CA-8 sale mal, y ese segundo movimiento no debería
> obligar a reescribir criterios.

- **CA-1 (la hora cambia, y solo la hora).** Dado `vercel.json` con
  `crons[0] = { path: '/api/cron/refresh', schedule: '0 22 * * *' }`, cuando se aplica esta spec,
  entonces `crons[0].schedule` es **`0 6 * * *`** y **todo lo demás del fichero es idéntico**:
  `$schema`, `buildCommand`, el número de entradas de `crons` y el `path`. Verificable con una
  comparación estructural del fichero entero contra el objeto esperado.

- **CA-2 (sigue siendo una ejecución diaria a hora fija).** Dado el `schedule` de
  `/api/cron/refresh` leído de `vercel.json`, entonces la expresión declara **exactamente una
  ejecución al día**: los campos de día-del-mes, mes y día-de-semana denotan *todos los valores*,
  y los de minuto y hora denotan **un solo valor cada uno**. Es lo que ADR-004 pto. 1 llama *«hora
  fija UTC»* y lo que la premisa de **RN-16** necesita (`tests/spec043-sin-refrescar.test.ts` ya
  vigila los tres últimos campos y **sigue verde sin tocarse**).
  **Prueba de eficacia en los dos sentidos** (FOUNDATION, 2.º corolario; ADR-026 §7), con los
  especímenes mínimos escritos aquí: **debe cazar** `0,30 6 * * *` y `0 */6 * * *` —dos
  ejecuciones diarias disfrazadas de una—; **no debe cazar** `0 6 * * *` ni `30 11 * * *`, que
  son horas fijas legítimas y distintas entre sí.

- **CA-3 (las tres guardias que congelan `vercel.json` se re-congelan al valor nuevo, y ninguna
  se afloja).** Dado que **tres** ficheros de la batería comparan el `vercel.json` **entero**
  contra un literal que hoy incluye `schedule: '0 22 * * *'` —`tests/deploy-gate-workflow.test.ts`
  (caso *9.2*), `tests/spec-031-frontera.test.ts` (*CA-13.2*) y `tests/version-bump-gate.test.ts`
  (*«vercel.json no cambia por culpa de este gate»*)—, cuando cambia la hora, entonces las tres
  se ponen **rojas**, y esta entrega actualiza **el valor del `schedule` y nada más** en cada una,
  dejando las tres verdes **y siguiendo comparando el fichero entero**.
  Lo que esas guardias compran es *«`vercel.json` no cambia sin un CA que lo pida»*, y **esta
  spec es ese CA**: por eso se **re-congelan**, no se relajan. **Queda prohibido** convertir la
  comparación en parcial o hacer que el valor esperado se **derive del propio `vercel.json`** —eso
  la dejaría verde de vacío, que es la única salida que FOUNDATION declara ilegítima—.
  Verificable en los dos sentidos: con el árbol de la entrega las tres están **verdes**, y
  cambiando a mano el `schedule` de `vercel.json` las tres se ponen **rojas**.
  Y **queda escrito en el ledger qué vigilaban antes y qué vigilan ahora** (FOUNDATION, 3.ª
  convención): lo toca quien lo declara, no quien se beneficia en silencio.

- **CA-4 (el runbook deja de decir lo viejo, y lo dice derivándolo).** Dado que
  `docs/despliegue.md` **§3.3** documenta el cron con un bloque JSON que hoy lleva
  `"schedule": "0 22 * * *"`, entonces ese bloque, **parseado**, coincide con el `crons` de
  `vercel.json`. El test **deriva las dos partes** y **no teclea la hora**, con **centinela de
  extracción no vacía**: si el bloque no se encuentra o no parsea, el caso se pone **rojo**, no
  verde. Eficacia: mutando cualquiera de los dos lados el caso se pone rojo.
  Además, la nota de plan de esa misma sección deja de decir solo *«En plan Hobby el cron es
  diario (nos vale)»* y recoge lo **medido**: en Hobby el disparo cae en **un minuto cualquiera
  dentro de la hora** y **no garantiza el día** (ejemplo real: falta el 2026-08-24), y en **Pro**
  se dispara **clavado**.

- **CA-5 (la hora se escribe una sola vez: el fuente deja de llevar una segunda copia).** Dado
  que `src/lib/market/sin-refrescar.ts` documenta hoy la cadencia citando el valor
  (*«el cron de `vercel.json` es `0 22 * * *`»*), entonces tras esta entrega **mover la hora en
  `vercel.json` no obliga a editar ese módulo**: su documentación nombra **el fichero que posee
  el valor**, no el valor. Es **ADR-026 pto. 2** aplicado a un número que acaba de demostrar que
  se copia. Lo que el módulo **sigue** diciendo, porque es lo que su umbral necesita, es la
  **premisa**: *un ciclo al día, sin saltos*.
  **Prueba de eficacia en los dos sentidos**, con los especímenes mínimos: **debe cazar** una
  copia del `schedule` reintroducida en el módulo (con la hora vieja o con la nueva, da igual: lo
  que se prohíbe es la **segunda copia**, no una hora concreta); **no debe cazar** una mención a
  `vercel.json` o a `crons` sin valor, que es exactamente lo que la corrección deja escrito.
  Centinela: si el detector no encuentra nada que analizar en el módulo, **rojo**.

- **CA-6 (ningún texto que lea el usuario nombra un momento del día para el ciclo).** Dado que
  `src/lib/help/content.ts` dice hoy *«…el gesto de empezar a vigilar una acción, que trae su
  precio **sin esperar a la noche**»*, y que esa frase queda **falsa** en cuanto el ciclo deja de
  ser nocturno, entonces la copia visible describe **cadencia** (una vez al día), **relación con
  el cierre** y **carácter diferido** (D-2) — y **no franja horaria**, de modo que mover la hora
  otra vez no obligue a reescribir copia.
  **`CADENCIA_LINEA` y `AVISO_LO_EMITE_EL_CICLO` no cambian**: las dos siguen siendo verdad a
  cualquier hora, y sus guardias —`tests/ayuda-contenido.test.ts` (*SPEC-039 CA-3*),
  `tests/e2e/ayuda.spec.ts`, `tests/e2e/primera-pantalla.spec.ts`— siguen **verdes sin una línea
  modificada**.
  Se ajustan también, por la misma razón y en la misma entrega, **dos comentarios** que quedan
  falsos: el ejemplo *10:00 / 22:00* de `src/lib/help/content.ts` y *«el correo salir esta
  noche»* de `src/app/vigiladas/actions.ts`. Son comentarios, no copia: no llevan guardia propia,
  y se declaran aquí para que su cambio no aparezca como ruido en el diff.
  **CA-5 y CA-6 están DENTRO del alcance por decisión del humano del 2026-09-03**, y con ellos los
  **tres ficheros de `src/`** que nombran: `src/lib/market/sin-refrescar.ts`,
  `src/lib/help/content.ts` y `src/app/vigiladas/actions.ts`. No hay que adivinarlo ni preguntarlo:
  entran, y por eso la entrega sube versión (**CA-11**). Se consideró dejarlos fuera para no tocar
  `src/` y **se descartó**: el repositorio quedaría diciéndole al usuario *«sin esperar a la
  noche»* sobre un ciclo que ya no es nocturno, y con una segunda copia de la hora viva en un
  comentario — o sea, con la mitad del defecto dentro.

- **CA-7 (la transición no puede cruzar el umbral de RN-16).** Dado que cambiar la hora abre **un
  hueco de una sola vez** entre la última escritura del horario viejo y la primera del nuevo,
  entonces ese hueco, **en el peor caso** —que el despliegue se coma la ejecución del día en
  curso, luego la última escritura es la de **anoche a las 22:48 UTC**—, **no supera
  `UMBRAL_SIN_REFRESCAR_HORAS`** (36 h, `src/lib/market/sin-refrescar.ts`), o si lo supera, el
  merge se hace **después** de la ejecución de esa noche y así queda escrito en la PR y en el
  ledger. Si no, **todo el universo aparece marcado *sin refrescar*** una mañana sin que nada esté
  roto.
  La cuenta, con la hora decidida y con las dos que el gate descartó:

  | Hora | Peor hueco de transición | ¿Cruza las 36 h? |
  |---|---|---|
  | **`0 6 * * *`** *(la decidida)* | 22:48 D-1 → 06:00 D+1 = **31 h 12 min** | **No** |
  | `0 8 * * *` | 22:48 D-1 → 08:00 D+1 = **33 h 12 min** | **No** |
  | `0 12 * * *` | 22:48 D-1 → 12:00 D+1 = **37 h 12 min** | **Sí, por 1 h 12 min** |

  **Con `0 6 * * *` este CA se cumple con 4 h 48 min de holgura, así que el merge NO tiene
  condición de horario**: se puede mergear a cualquier hora. Se recalcula y se escribe igual en el
  ledger, y no por ceremonia: es **el mismo control que habrá que repetir** si CA-8 obliga a mover
  la hora a ≥ 11:05 UTC (ADR-039 pto. 4), porque **entonces sí cruza** y ese segundo merge tendrá
  que ir **después** del ciclo de esa noche.
  **Verificable por recálculo, y a propósito SIN guardia permanente**: es una propiedad del
  **momento de la entrega**, no del producto, y dejarla en la batería sería congelar cómo estaba
  el árbol el día del merge — el patrón que FOUNDATION prohíbe en su 3.ª convención. El umbral se
  **lee** de su único hogar; no se teclea *36* en ningún sitio nuevo. La evidencia del recálculo
  va al ledger.

- **CA-8 (el arreglo se comprueba en producción, y eso no es un test).** Dado que un cambio en
  `crons` **solo entra en vigor con un despliegue de producción** y que aquí **mergear ES
  desplegar** (ADR-018 / SPEC-028), cuando se mergea la PR, entonces:
  1. **La siguiente fila de `cron_runs` aparece a la hora nueva** (en Pro, clavada; ADR-023 es
     donde queda la constancia), con `outcome = success` y `finished_at` **no nulo**.
  2. **Las cotizaciones que esa ejecución escribió llevan `as_of` = cierre de la sesión anterior
     (D-1)**, no de dos sesiones antes (D-2). Se contrasta con **al menos un símbolo** y su serie,
     igual que se hizo con `WEN` para levantar el defecto.
  3. **Las dos primeras ejecuciones** bajo el horario nuevo se anotan en el ledger con **fecha,
     hora de la fila y `as_of` observado**. Sin eso esta decisión queda sin evidencia y el
     siguiente que la lea tendrá que volver a medirlo todo.
  4. **Si las dos siguen escribiendo D-2**, la hora elegida cayó dentro del hueco de publicación
     y se aplica el desenlace ya pactado de **ADR-039 pto. 4**: mover a una hora **probada**
     (≥ 11:05 UTC). Es un cambio de un campo **bajo esta misma decisión**, no un ADR nuevo — y
     también queda escrito.
  **Esto NO se prueba con un test, y no se va a fingir que sí.** Ningún test unitario puede
  afirmar que el proveedor ya había publicado. Lo que la batería sí garantiza (CA-1 a CA-6) es
  que la hora declarada es la aprobada y que nada en el repositorio dice otra cosa.
  **El peor desenlace posible de este CA es el statu quo** (ADR-039 pto. 5): si a la hora nueva
  el dato aún no está, se escribe lo mismo que hoy. No se pierde dato, no se gasta cuota de más y
  no se rompe ningún invariante.

- **CA-9 (el roadmap deja de afirmar en presente lo que ya no es verdad).** Dado que
  `docs/roadmap.md` nombra las 22:00 en tres sitios, entonces se distingue **historia de
  presente**, que es lo único que importa aquí. **La cura esta spec y no sdd-producto** —decisión
  del humano del 2026-09-03: es **una línea factual**, no una revisión de la intención del
  roadmap, y separarla en otra entrega solo garantizaría que se quedase sin hacer:
  - Las dos frases en **pasado** —*«el único camino… **era** el cron `0 22 * * *`»* y *«Entre el
    alta y las 22:00 **había** hasta 24 horas»*— describen el estado **anterior a SPEC-058**, el
    propio párrafo lo declara así, y **eran ciertas**: **no se tocan**.
  - La frase en **presente** —*«pero el **aviso** sigue saliendo a las 22:00»*— queda **falsa**:
    se ajusta para nombrar **el ciclo**, no su hora, con lo que deja de caducar cada vez que la
    hora se mueva.
  Verificable por revisión del diff: **ninguna afirmación en presente del roadmap nombra la hora
  del ciclo**. **Sin guardia permanente**: el roadmap lo cura sdd-producto y crece, y una guardia
  que lo enumere sería el criterio de gate disfrazado que **ADR-037** prohíbe.

- **CA-10 (la evidencia histórica no se reescribe).** Dado que varios ledgers, ADR y una entrada
  de `dominio.md` citan `0 22 * * *` o *«el cron de las 22:00»* **en pasado y como evidencia de
  lo que se verificó ese día** —`SPEC-004.ledger`, `SPEC-035.ledger`, `SPEC-039.ledger`,
  `ADR-004`, `ADR-038`, `SPEC-058`, `docs/fundacion/dominio.md`—, entonces **el diff de la rama
  no los toca**. Eran ciertos cuando se escribieron; reescribirlos sería falsear el registro, y
  el registro es lo que permitió encontrar este defecto.
  Es **criterio de gate** (`RI-03`), verificable con `git diff --name-only origin/main...HEAD`, y
  **no lleva guardia** — a propósito: enumerar en un test los ficheros que no se pueden tocar es
  exactamente el patrón que **ADR-037** documenta como *«dos escaladas al humano, seis rondas de
  rol, cero defectos reales cazados»*.

- **CA-11 (la entrega toca `src/`, así que la versión sube).** Dado que esta entrega modifica
  `src/lib/market/sin-refrescar.ts`, `src/lib/help/content.ts` y `src/app/vigiladas/actions.ts`,
  entonces el gate **Version bump** exige subida y se hace **patch** —restaura una promesa ya
  entregada en vez de añadir alcance; mismo criterio que **SPEC-043** y **SPEC-055**—, con
  `package.json` y `package-lock.json` en el **mismo commit** (**ADR-033**) y
  `npm run version:check` ejecutado **con el árbol limpio** (**SPEC-049**: sobre árbol sucio se
  abstiene, y un verde de abstención no es un verde). **Decidido en el gate del 2026-09-03**: la
  entrega toca `src/` a propósito y sube versión; no se parte para evitarlo (§Notas pto. 5).

## Entidades y reglas afectadas

- **Entidades**: `quotes` (`as_of`, `updated_at`) y `cron_runs` (`started_at`, `finished_at`,
  `outcome`, `requested`, `updated`, `skipped`). **Ninguna cambia de forma**: no hay migración.
- **RN-12** — la base sigue siendo el **último cierre no ajustado**. La hora no la toca.
- **RN-11**, **RN-06** — se benefician sin cambiar: pasan a computarse sobre el cierre de la
  sesión anterior en vez del de dos sesiones antes.
- **RN-13**, **RN-14** — **no cambian de regla**: el disparo se evalúa dentro del ciclo y el
  aviso se emite una vez por episodio. **Sí cambia la hora a la que llegan** (ADR-039 pto. 7).
- **RN-16** — umbral, medida (`updated_at`) y motivos **intactos**. Lo que esta spec toca es su
  **premisa** en dos sentidos: la comprueba en la transición (CA-7) y la **refuerza**, porque en
  Pro el cron garantiza el día (el salto del 2026-08-24 era un hueco de ~32 h que cupo por doce
  minutos bajo un umbral de 36).
- **RN-17** — el refresco bajo demanda no se toca. Sigue habiendo **dos escritores** de `quotes`,
  y su condición de gasto (cotización vigente, mismo umbral de RN-16) es independiente de la hora.
- **D-2** — no se roza: mover la hora del ciclo es **acordar otro momento del mismo ciclo**. Sin
  intradía, sin polling, sin segundo ciclo.
- **ADR-004** — **precisado por ADR-039** en su pto. 1 (de qué evento cuelga la hora), sin tocar
  cadencia, base, persistencia ni puerto, y **sin superseder** nada. Su rechazo a la cadencia
  2×/día u horaria sigue vigente.
- **ADR-039** — nace con esta spec; es su decisión de gobierno y hay que aprobarlo en el mismo
  gate.
- **ADR-018** / **SPEC-028** — *mergear es desplegar*: es lo que activa el cron nuevo y lo que
  hace que el momento del merge importe (CA-7).
- **ADR-023** — `cron_runs` es la fuente de la evidencia post-deploy (CA-8). Se **lee**; no se
  toca.
- **Dominio** (`docs/fundacion/dominio.md`): **ningún término nuevo**. La entrada *«Refresco bajo
  demanda»* menciona *«el cron de las 22:00»* **en pasado**, describiendo por qué nació RN-17: es
  historia correcta y **no se toca** (CA-10).

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **El símbolo `TPG0`** (`simbolo_desconocido`, el desajuste Twelve Data / Marketstack). Es otro
  problema, ya reportado al proveedor y **pendiente de su corrección**. No comparte causa con
  éste: aquí el proveedor responde bien y a tiempo, solo que se le pregunta pronto.
- **Las filas huérfanas de `quotes`** (`PHM`, `IPH`: cotizaciones viejas de símbolos que ya no
  vigila nadie). Inofensivas —quedan fuera del universo y RN-16 ya las marca— y otro asunto.
- **Cambiar la cadencia, meter intradía o añadir una segunda ejecución diaria.** Rechazado por
  **ADR-004** contra **D-2**, y ese rechazo **no se reabre aquí** (ADR-039 pto. 9).
- **Una hora por mercado o por huso horario.** El *«afinado multi-mercado»* que ADR-004 pto. 1
  dejó fuera **sigue fuera**: un solo cron, una sola hora UTC.
- **Saltar fines de semana** (F-SPEC-043-2). Sigue fuera, y el día que entre tiene que **tocar el
  umbral de RN-16 en la misma entrega**.
- **Medir la hora exacta de publicación de Marketstack.** Requiere sondear por horas durante
  varios días y **consume cuota** en la unidad de ADR-027 pto. 1. Queda como **F-ADR-039-1**; su
  sitio natural es una spec de observabilidad del ciclo.
- **Alertar cuando el ciclo escriba un `as_of` con más de una sesión de antigüedad.** Es la
  vigilancia que cazaría este defecto si el proveedor volviera a cambiar su hora de publicación
  —y por eso queda anotada, **F-ADR-039-2**—, pero es **capacidad nueva** y va a EPIC-MEJORA:
  EPIC-FIX restaura lo prometido, no añade alcance.
- **Reparar los nueve días de precios rezagados.** No hay nada que reparar: `quotes` guarda **una
  fila por símbolo**, no una serie (ADR-004 pto. 3), y el primer ciclo bueno la sobrescribe. Los
  avisos que salieron tarde **no se recuperan**, y no se va a fingir lo contrario.
- **Desacoplar la emisión del aviso de la ingesta** para que el correo llegue a la hora que le
  convenga al usuario. Es la salida si la franja nueva molesta, y es **épica propia**.

## Notas para el gate humano

> **Gate cerrado el 2026-09-03 por el humano (Alberto Fojo).** Se aprobaron **SPEC-059** y
> **ADR-039**, y con ellos las decisiones marcadas abajo. Lo que era la pregunta abierta —**la
> hora**— es a partir de aquí **una decisión**. Esta sección se conserva con la forma en que se
> planteó, y no se reescribe: **el precio de las opciones descartadas es lo único que explica la
> elegida**, y quien lea esto en seis meses necesita ver las tres.

### 1. La hora: **DECIDIDO `0 6 * * *`** (06:00 UTC = 08:00 de Madrid en verano)

Era LA pregunta abierta de esta spec. Se planteó con los datos delante en vez de esconderla, y se
cerró con ellos.

**Lo único que la evidencia acota** es que a las **22:48 UTC** el dato del día **no estaba**, y a
las **11:05 UTC del día siguiente sí**. La hora exacta de publicación **no la hemos medido** y
**no viene en la respuesta**: el campo `date` de Marketstack es **solo fecha**, sin sello de
publicación. La ventana `(22:48, 11:05)` UTC está **abierta y sin medir**.

El cierre más tardío de los siete mercados soportados es el de **EE. UU., 20:00 UTC** en horario
de verano, así que cualquier hora de la madrugada o mañana UTC siguiente da margen sobre el
cierre. Lo que **no** da automáticamente es margen sobre la **publicación**, que es lo que
importa (ADR-039 pto. 1).

| Opción | Hora Madrid (verano) | Margen sobre cierre US | ¿Probada por la evidencia? | Aviso llega | Hueco de transición |
|---|---|---|---|---|---|
| **(A) `0 6 * * *`** — **ELEGIDA** | 08:00 | ~10 h | **No** — cae dentro de la ventana abierta | primera hora de la mañana | 31 h 12 min ✅ |
| (B) `0 8 * * *` — descartada | 10:00 | ~12 h | **No** — sigue dentro de la ventana | media mañana | 33 h 12 min ✅ |
| (C) `0 12 * * *` — descartada | 14:00 | ~16 h | **Sí** — posterior a las 11:05 observadas | mediodía | 37 h 12 min ⚠️ cruza RN-16 |

**Las contrapartidas, dichas enteras**: **más tarde = más seguro el dato, pero el aviso llega más
tarde**; **más temprano = aviso más útil, pero más riesgo de repetir el defecto**. Y hay un
**cambio de encuadre** que conviene decir en voz alta y que no es técnico: hoy el aviso sale a las
**00:48 de Madrid** (de madrugada) y pasa a salir **a las 08:00**.

**Qué se eligió, y con qué en la mano.** **(A) `0 6 * * *`**, por **asimetría de riesgo** y no por
optimismo sobre el proveedor: **el peor caso de equivocarse es el statu quo** (se escribe lo mismo
que hoy, ADR-039 pto. 5), se **detecta en 48 h** mirando `cron_runs` + `as_of` (**CA-8**), y el
desenlace ya está pactado por escrito (**ADR-039 pto. 4**: mover a ≥ 11:05 UTC, **sin ADR nuevo**).
A cambio, si acierta —y diez horas después del cierre es mucho margen— el usuario gana el aviso de
la mañana **para siempre**.

**El humano lo aprobó con la salvedad explícitamente sobre la mesa**: sabe que **06:00 UTC no está
probada** por la evidencia y que cae dentro de la ventana abierta. La salvedad **no se borra por
estar aprobada** —igual que el presupuesto de 3 s de ADR-038 pto. 5—, y **CA-8 deja de ser una
buena práctica para ser la condición de la decisión**.

**(C) era la alternativa real y no queda muerta**: es la opción con certeza detrás, y es
exactamente el destino pactado si CA-8 sale mal. Lo que se pagaba por ella eran dos cosas —el
aviso a mediodía y un hueco de transición que **cruza** el umbral de RN-16, obligando a mergear
después del ciclo de esa noche (CA-7)—. Con **(A)** el hueco es de 31 h 12 min contra 36 h, así
que **el merge no tiene condición de horario**.

### 2. ¿Hacía falta un ADR? Sí, y este es el argumento

Se podría haber hecho con la spec sola: ADR-004 pto. 1 fija *«hora fija UTC»* sin fijar cuál, así
que mover el número **cabe dentro de la decisión vigente**. **No es un ADR por el número: es un
ADR por el criterio.**

ADR-004 dice *«1×/día **tras el cierre**»*, y **ése es el criterio equivocado**: `0 22 * * *`
cumple esa frase al pie de la letra y trae el dato de anteayer. Y el criterio **ya viajó y se usó
como prueba**: el ledger de **SPEC-039** lo cita para aprobar copia visible para el usuario —*«sí
— 22:00 UTC es posterior al cierre de los 7 mercados»*—. Es el mismo molde que la **unidad
equivocada** que esta épica ya pagó (contar *llamadas* donde el proveedor factura *símbolos*,
*«viajó tres saltos sin que nadie lo tocase»*). Un criterio mal enunciado se **hereda**, y cada
salto le añade autoridad. **ADR-039** existe para que el cuarto salto no exista, y por eso
**precisa** ADR-004 pto. 1 en lugar de supersederlo: la cadencia, la base y la persistencia de
ADR-004 están bien y siguen intactas. Precedentes de esta figura en el repositorio: **ADR-035**
precisa ADR-026; **ADR-037** precisa ADR-031 pto. 1.

**ADR-039 quedó aprobado el 2026-09-03** por Alberto Fojo, junto con esta spec.

### 3. **RESUELTO**: ADR-004 se aprueba en este mismo gate

Se levantó al escribir esta spec: **ADR-004 estaba en `estado: borrador` y decía *«Pendiente de
aprobación»***, desde el 2026-07-14 —y llevaba desde entonces gobernando la cadencia, la base no
ajustada, la persistencia y el `CRON_SECRET`, citado por media docena de specs—, de modo que
ADR-039 iba a precisar un ADR que nunca se aprobó formalmente. No lo tocó el arquitecto: **un ADR
no lo aprueba su autor**.

**Decisión del humano del 2026-09-03: ADR-004 queda aprobado en el mismo gate.** La redacción de
ADR-039 ya no dice que precise nada pendiente. La transición de estado la registra el orquestador
con el script del núcleo; **no se toca el frontmatter a mano**.

### 4. Lo que esta entrega pone rojo antes de arreglarlo

**Tres ficheros de la batería se ponen rojos en cuanto cambie el `schedule`**, y no es una
sorpresa: es su trabajo. `tests/deploy-gate-workflow.test.ts` (9.2),
`tests/spec-031-frontera.test.ts` (CA-13.2) y `tests/version-bump-gate.test.ts` congelan el
`vercel.json` **entero** para afirmar *«este fichero no cambia sin un CA que lo pida»*. **CA-3**
es ese CA. Se **re-congelan al valor nuevo** —no se relajan, no se derivan del propio fichero— y
queda escrito en el ledger qué vigilaban antes y qué vigilan ahora, como manda FOUNDATION.

Merece constar que la guardia que **sí** estaba bien encuadrada aguanta sin tocarse:
`tests/spec043-sin-refrescar.test.ts` mira **solo** los tres campos de calendario y le da igual la
hora. Es la diferencia entre vigilar una propiedad y congelar una foto, con las dos formas en el
mismo repositorio y a la vista.

### 5. **DECIDIDO**: CA-5 y CA-6 dentro del alcance, y la versión sube patch

**Tres ficheros de `src/` cambian, y están nombrados para que el implementador no tenga que
adivinarlos**: `src/lib/market/sin-refrescar.ts` (la segunda copia del valor, CA-5),
`src/lib/help/content.ts` (la frase *«sin esperar a la noche»* y el comentario del ejemplo
10:00/22:00, CA-6) y `src/app/vigiladas/actions.ts` (el comentario *«el correo salir esta
noche»*, CA-6).

Eso mete la entrega en el gate **Version bump** → **patch** —restaura una promesa ya entregada en
vez de añadir alcance, mismo criterio que SPEC-043 y SPEC-055—, con `package.json` y
`package-lock.json` en el **mismo commit** (**ADR-033**) y `npm run version:check` sobre árbol
**limpio** (**SPEC-049**: sobre árbol sucio se abstiene, y un verde de abstención no es un verde).

Se puso sobre la mesa dejar CA-5 y CA-6 fuera para no tocar `src/`, y **el humano lo descartó el
2026-09-03**: el repositorio quedaría diciéndole al usuario *«sin esperar a la noche»* sobre un
ciclo que ya no es nocturno, y con una segunda copia de la hora viva en un comentario. Es el mismo
defecto, y separarlo garantiza que la mitad se olvide.

### 6. **DECIDIDO**: la línea del roadmap la cura esta spec

`docs/roadmap.md` lo cura **sdd-producto**, pero la corrección de la línea ~39 —*«pero el aviso
sigue saliendo a las 22:00»*, la única en **presente** y la única que queda falsa— **entra en CA-9
de esta spec**, por decisión del humano del 2026-09-03: es **una línea factual**, no una revisión
de la intención del roadmap. Las líneas ~16 y ~18 están en **pasado**, eran ciertas y **no se
tocan**.

### 7. Frontera honesta de la verificación

El verificador **no puede** dar GREEN a *«el ciclo ya trae el dato de ayer»* desde la batería.
Puede dar GREEN a CA-1…CA-6, a CA-7 por recálculo y a CA-10 por diff. **CA-8 se cierra después
del merge**, con dos filas de `cron_runs` y sus `as_of`, escritas en el ledger. Esto significa que
**la spec se mergea antes de estar verificada del todo**, a propósito y con el desenlace pactado
por escrito. Es la única forma honesta de entregar un arreglo cuya prueba vive en producción, y
prefiero decirlo aquí que inventar un CA que finja probarlo en un test unitario.

**Y con la hora que se eligió esto pesa más, no menos.** `0 6 * * *` es precisamente la opción
cuya corrección **solo** se puede confirmar observando: quien cierre esta spec sin las dos filas
de `cron_runs` en el ledger la está cerrando sin la única evidencia que importa.
