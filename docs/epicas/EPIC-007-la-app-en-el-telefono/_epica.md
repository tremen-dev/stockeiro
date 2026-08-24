---
id: EPIC-007
tipo: epica
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-24, por: sdd-producto}
---
# EPIC-007 — La app en el teléfono

## Objetivo
Que Stockeiro se pueda **usar desde un móvil**, no solo abrir. Hoy la app está construida
para una pantalla ancha y en un teléfono se defiende como puede: la tabla de `/vigiladas`
—nueve columnas— se resuelve con **desplazamiento horizontal dentro de su caja**
(`.table-scroll`, `src/app/globals.css:512`), que fue la salida correcta para el defecto que
SPEC-040 arregló, pero **no es una interfaz móvil**: es una tabla de escritorio metida en un
teléfono y arrastrada de lado.

**Lo que hay hoy, medido, no supuesto:**

- La única adaptación al ancho vive en cinco bloques `@media (max-width: 720px)` de
  `globals.css` (líneas 516, 695, 1043, 1215, 1429) más dos de 599/600. Lo que hacen es
  **apretar separaciones**: `.app-nav { gap: 12px }`, `.app-nav-links { gap: 16px }`
  (`:516-517`), `.app-nav-user { gap: 14px }` (`:1044`). **Ningún elemento cambia de forma
  en ningún ancho.** La navegación de una app con seis destinos no se reorganiza: se
  estrecha.
- La guardia de geometría **sí mide móvil de verdad** —`tests/e2e/geometria.ts:66` declara
  `ANCHOS = [360, 390, 640, 700, 730, 760, 800, 1280]` desde SPEC-040— pero **no mide toda la
  app**: `tests/e2e/geometria-rutas.spec.ts:49,52` cubre nueve rutas (`/`, `/ayuda`, `/legal`,
  `/login`, `/register`, `/dashboard`, `/vigiladas`, `/avisos`, `/cuenta`) y deja fuera
  **`/cartera`, `/cartera/importar`, `/admin`, las tres páginas bajo `/legal/` y las de
  restablecer contraseña**. Una de las dos tablas del producto **no se mide a ningún ancho**,
  y lleva así desde SPEC-002.

**Por qué ahora.** EPIC-004 abrió la app a testers externos y el enlace se va a compartir en
un **foro de bolsa**. Un enlace en un foro se abre en el teléfono: el móvil no es un extra de
comodidad, es **el camino de entrada por defecto** al producto. El primer tester que lo abra
en el metro decide ahí si vuelve.

**Por qué épica propia y no EPIC-MEJORA.** Nació dentro de ella —SPEC-054 se escribió allí— y
la sacó **su propio criterio**: CE-M3 dice que si una spec necesita ADR nuevo hay que
replantear su encaje, SPEC-054 necesita **ADR-034**, y el replanteo lo decidió el humano el
2026-08-24. La razón de fondo es que EPIC-MEJORA es un *bucket* de roces sueltos —cada caso
entra con su "dónde se vio"— y esto **no es una lista de roces**: es una superficie entera del
producto que nunca se diseñó, con un breakpoint de modo, una regla de conmutación y un
medidor nuevo detrás. Eso tiene forma de épica, no de caso.

**Para quién.** El inversor particular de `vision.md`, y en concreto **el tester que llega
desde el foro**: alguien que no conoce la app, no tiene sus zonas puestas y la está juzgando
en los primeros dos minutos, con el pulgar.

## Criterios de éxito
Medibles, verificables por spec. La épica no se cumple pantalla a pantalla: se cumple cuando
**ninguna** de las que el usuario puede alcanzar se rompe en un teléfono.

- **CE-1 — Ninguna pantalla desborda en un teléfono.** En todas las rutas alcanzables, a 360 y
  390 px, no hay desbordamiento horizontal ni contenedor arrastrable que no sea deliberado.
  Medida: los medidores de ADR-026 a cero en todos los `ANCHOS`, no solo en los dos móviles.
- **CE-2 — Lo que no se mide no cuenta como terminado.** El conjunto de rutas que la guardia
  mide es el conjunto de rutas que el usuario puede alcanzar. Hoy son nueve de dieciséis.
  Medida: binario, con un test que afirma la correspondencia — no una lista mantenida a mano
  (F-SPEC-048-2 documenta lo que pasa con las listas congeladas).
- **CE-3 — Se puede operar con el pulgar.** Todo control accionable alcanza el suelo de área
  táctil de **44×44 px CSS**. Fuente citada con precisión: es el criterio de **WCAG 2.1 SC
  2.5.5 (nivel AAA)** y el de las *Apple HIG*; WCAG 2.2 SC 2.5.8 (AA) exige solo 24×24, y este
  producto elige el listón alto porque se juzga en un teléfono ajeno. Medida: medidor propio en
  el módulo compartido, con prueba de eficacia por reinyección de defecto (ADR-026 §7).
- **CE-4 — Caber no se paga escondiendo.** Ningún dato que el escritorio enseña desaparece en
  móvil sin que el usuario pueda llegar a él. Medida: anti-deriva por pantalla — lo que hay en
  la vista ancha está en la estrecha, con el mismo texto. *(Es ADR-026 §4 aplicado al
  contenido: `overflow: hidden` no es un arreglo, y esconder tampoco.)*
- **CE-5 — El escritorio no paga la factura del móvil.** Cada spec de esta épica deja la vista
  ancha como estaba: mismas suites en verde sin aflojar aserciones. Medida: binario.
- **CE-6 — Un solo breakpoint de modo.** Solo un ancho puede hacer aparecer o desaparecer una
  representación; el resto son de densidad. ADR-034 lo fija en **720 px** y esta épica no lo
  reabre spec a spec. Medida: binario, verificable en el CSS.
- **CE-7 — Cambiar de forma no cambia lo que la pantalla significa.** Cuando un elemento se
  reorganiza en móvil, su semántica viaja con él: lo que era una tabla ordenable sigue
  anunciando su orden, el orden de lectura del DOM sigue siendo el orden visual, y el texto se
  puede leer sin ampliar — suelo de **16 px en los controles de formulario**, porque por debajo
  Safari en iOS hace zoom solo al enfocarlos, y ningún texto por debajo de 12 px. Medida:
  binario, verificable en test.
  *(Añadido el 2026-08-24 a petición de sdd-arquitecto: SPEC-054 tenía cuatro CA —`aria-sort`,
  orden anunciado, orden de lectura y el suelo tipográfico— que colgaban de CE-4 con una lectura
  forzada. CE-3 es táctil, no semántico ni tipográfico, y las specs 2 y 3 lo van a necesitar más
  que ésta: la navegación y los formularios son donde el foco y el teclado importan de verdad.)*

## Alcance
- **Dentro:**
  - **Las dos tablas del producto** — `/vigiladas` (9 columnas) y `/cartera` (5) — que pasan a
    tarjetas por debajo de 720. **Ya especificado: SPEC-054, aprobada por el humano el
    2026-08-24.** Es la primera spec de la épica y la que fija el patrón que heredan las demás.
  - **La navegación global.** Seis destinos más el bloque de usuario, hoy solo "más juntos" a
    720 px. Es lo primero que toca cualquiera que entre por el foro.
  - **`/avisos`** — la bandeja, y `.notif-item` / `.notif-actions`, que ya tienen tratamiento
    parcial a 720 (`globals.css:518-519`).
  - **`/cartera/importar`** — el flujo de import, con sus `.import-buckets` (ya pasan a una
    columna a 720, `:695`) y su selección de fichero desde un teléfono.
  - **`/cuenta`, `/admin`, `/ayuda`, las páginas de `/legal/` y las de sesión** (`/login`,
    `/register`, restablecer contraseña): formularios y texto largo, donde el listón es el
    tamaño de fuente que no dispara el zoom de iOS y el área táctil.
  - **Cerrar el agujero de CE-2**: meter en la guardia las rutas que no mide.
- **Fuera (aparcado a propósito, no por descuido):**
  - **App nativa y notificaciones push.** Ya están en "Más adelante" del roadmap y siguen ahí.
    Esta épica hace que la **web** funcione en el teléfono; no la empaqueta.
  - **Manifiesto PWA, *apple-touch-icon*, *theme-color* e instalación en pantalla de inicio.**
    Parientes cercanos del icono que entregó SPEC-047 y **ninguno observado como problema**.
    CE-M2 de EPIC-MEJORA los dejó fuera por imaginarios; salir de aquella épica no los
    convierte en reales.
  - **Rediseño de la vista ancha.** CE-5 lo dice al revés: el escritorio se respeta. Si una
    pantalla está mal diseñada en 1280 px, eso es un roce y su sitio es EPIC-MEJORA.
  - **Identidad gráfica nueva** (paleta, tipografía, *wordmark*). La marca ya existe en el
    código y SPEC-047 la aplicó; esta épica la usa, no la reinventa.
  - **Densidad específica de tablet** (600–720 px en vertical). Decidido con el humano el
    2026-08-24: bajo 720 hay **una** columna de tarjetas. Si la franja molesta, la salida es un
    `grid-template-columns`, no un breakpoint nuevo — y no cambia ningún CA.
  - **Gestos táctiles** (deslizar para archivar, pulsación larga, *pull to refresh*). Nadie los
    ha pedido y ninguno está observado.
  - **Funcionamiento sin conexión.** Otro dominio y otra épica.
  - **Capacidad nueva de producto.** Esta épica no enseña nada que la app no sepa ya hacer.
    Si en el camino aparece "en el móvil haría falta que además…", eso es EPIC-006 o una spec
    nueva, no esto.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

> **Propuesta orientativa de sdd-producto** — el desglose real, sus fronteras y su numeración
> son de **sdd-arquitecto**. Se escribe solo para dar tamaño:
>
> 1. **Las tablas se leen como tarjetas** (CE-1, CE-3, CE-4, CE-6, y CE-2 parcial: mete
>    `/cartera` en la guardia). **Es SPEC-054, ya escrita y aprobada.** Trae ADR-034 y el
>    medidor de área táctil, que es infraestructura de la que viven las demás.
> 2. **La navegación en el teléfono** (CE-1, CE-3). Va **detrás de SPEC-054** a propósito: el
>    medidor de área táctil nace allí, y la navegación es el primer sitio donde se va a poner
>    roja. **Tiene una precondición de orden, `F-ADR-035-1`**: el suelo sin holgura de ADR-035
>    debe estar implementado **antes** de que esta spec escriba guardias nuevas de M5. El motivo
>    es que la navegación es donde M5 decide qué se agranda, y decidirlo contra un suelo efectivo
>    de 43 sería decidirlo mal — SPEC-054 ya pagó ese error una vez.
> 3. **El resto de rutas y el cierre de la guardia** (CE-2 completo, CE-1, CE-3). Puede ser una
>    spec o dos; lo decide el arquitecto según lo que el barrido encuentre. **No se especifica
>    a ciegas**: primero se mide, luego se escribe — la misma disciplina que EPIC-MEJORA se
>    impuso en su barrido de diseño.

## Riesgos
- **R-1 — El medidor de área táctil nace rojo, y no solo en las tablas.** `.btn-sm` mide ≈31 px
  de alto y lo usan *Editar*, *Quitar* y el botón de dirección del orden; en cuanto exista el
  medidor de CE-3, **cada botón pequeño de la app** es un rojo pendiente. Es deuda real que
  llevaba oculta por no tener quien la mirase, pero significa que la épica **descubre trabajo a
  medida que avanza**: la spec 2 y la 3 no se pueden dimensionar bien hasta que SPEC-054 encienda
  el medidor. La salida es agrandar los controles; **bajar el suelo sería `F-ADR-026-1`
  cumpliéndose por escrito**.
- **R-2 — La salida que ADR-026 prohíbe está viva en el CSS que sirve el navegador.**
  `design/tremen-ds/responsive.css:11` declara, dentro de su `@media (max-width: 720px)`,
  `html, body { overflow-x: hidden }` — **exactamente** lo que ADR-026 §4 dice que no es un
  arreglo. Y no es un mal ejemplo aparcado en una carpeta de referencia: **la app lo carga**,
  por una cadena de tres saltos que está entera en el árbol —
  `src/app/layout.tsx:5` → `src/app/globals.css:3` (`@import '../../design/tremen-ds/components/index.css'`)
  → `design/tremen-ds/components/index.css:26` (`@import url('../responsive.css')`).
  Es decir: **hoy, en producción, por debajo de 720 px el documento tiene el desbordamiento
  horizontal tapado.** Ésa es la razón de fondo por la que ADR-026 exige medir **elemento a
  elemento** y no fiarse del documento — un `scrollWidth` de `body` sano no prueba nada aquí.
  Consecuencia para esta épica: ninguna spec puede declararse verde apoyándose en que "la
  página no se desplaza", y ninguna puede añadir un `overflow: hidden` propio. Lo segundo hay
  que decirlo por escrito en cada spec, porque el patrón está a un `@import` de distancia y
  cualquiera lo copiará al ver una barra de desplazamiento.
  *(Corregido el 2026-08-24: esta épica afirmó primero que el fichero no se cargaba. Era falso
  —el grep que lo "comprobó" filtraba por `.ts/.tsx` y se dejó fuera el CSS—, y lo destapó
  sdd-arquitecto al recibir la corrección. Queda escrito el error porque, si el fichero no se
  cargara, **ADR-026 entero descansaría sobre una premisa falsa**, y eso merece no volver a
  dudarse a la ligera.)*
- **R-3 — Colisión con EPIC-005 / SPEC-045.** SPEC-045 (silenciar) está **aprobada y sin
  implementar** sobre `/vigiladas` y añade una **tercera acción** a la fila. Si entra después de
  SPEC-054, negocia con un pie de tarjeta ya diseñado para dos botones al 50 %; si entra antes,
  diseña sobre una tabla que está a punto de dejar de existir en móvil. **Decidido: SPEC-054
  primero**, y SPEC-045 hereda el pie de tarjeta. Quien implemente SPEC-045 debe leer ADR-034.
- **R-4 — La guardia se encarece.** CE-2 multiplica rutas × 8 anchos en Playwright, y la e2e ya
  es el paso largo del CI. Además `tests/e2e/server.mjs` fija puertos a fuego (3200/54329), lo
  que ya mordió a dos verificadores en paralelo (anotado en EPIC-INFRA). Si el tiempo de CI se
  vuelve el cuello de botella, la salida es **cómo se corre**, no **cuánto se mide**: recortar
  anchos es reabrir el hueco que SPEC-040 pagó por descubrir.
- **R-5 — Alcance rampante hacia el rediseño.** En cuanto alguien mire la app en un teléfono con
  ojos frescos aparecerá "ya que estamos". La lista de "fuera" es larga a propósito y la frontera
  es CE-5: **esta épica adapta lo que hay, no lo mejora**. Lo que sea mejora va a EPIC-MEJORA con
  su "dónde se vio".
- ✅ **R-6 — La etiqueta `<meta name="viewport">`: CERRADO el 2026-08-24, verificado en el HTML
  servido.** `src/app/layout.tsx` exporta `metadata` pero **no** `viewport`, así que la etiqueta
  depende enteramente del valor por defecto de Next.js 16 — y toda esta épica descansa sobre
  ella: sin `width=device-width`, un navegador móvil compone a ~980 px y escala, con lo que todo
  lo que la guardia mide a 360 y 390 px sería cierto en Playwright y **falso en un teléfono**.
  Comprobado contra producción, no contra la documentación:
  `curl https://stockeiro.tremen.dev/login` devuelve
  `<meta name="viewport" content="width=device-width, initial-scale=1"/>`.
  Queda escrito **con su porqué** y no simplemente tachado: el día que se migre de mayor de
  Next —ya pasó una vez, SPEC-009— esta comprobación hay que repetirla, porque lo que la sostiene
  es un valor por defecto del framework y no una línea de este proyecto. Si alguna vez conviene
  dejar de depender de él, la salida es exportar `viewport` en `layout.tsx`; hoy no hace falta.
