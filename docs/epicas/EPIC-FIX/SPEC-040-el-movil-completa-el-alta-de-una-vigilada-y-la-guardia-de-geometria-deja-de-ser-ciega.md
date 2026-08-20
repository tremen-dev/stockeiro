---
id: SPEC-040
tipo: spec
epica: EPIC-FIX
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-08-20, por: sdd-arquitecto}
---
# SPEC-040 — El móvil completa el alta de una vigilada, y la guardia de geometría deja de ser ciega

## Problema

**En un teléfono no se puede crear la primera acción vigilada.** Es exactamente el paso
que **CE-1 de EPIC-004** persigue —*«un tester que llega desde el foro sin hablar con
nadie … crea su primera acción vigilada con su zona»*—, y la app se va a publicar en un
hilo de un foro de bolsa. **Los foros se leen en el móvil.** El humano decidió en el gate
del **2026-08-20** que esto entra **antes** de publicar.

Los cuatro primeros defectos los midió el verificador de **SPEC-039** contra la app
corriendo, y comprobó que **ya estaban en `origin/main`** por doble vía: mismo CSS y
mismos componentes que `main`, y el defecto **persiste al borrar del DOM** el bloque
entero que SPEC-039 añade. Están escritos con su medida en el ledger de SPEC-039
(§Residuales que levanta el verificador, 2026-08-20). El quinto viene de **SPEC-036** y ya
tenía vía asignada.

### 1. El formulario de alta se recorta — `V-SPEC-039-1`

A **390 px**, en `/vigiladas`, `.symbol-picker` y `.symbol-search-input` miden **444 px**
dentro de una columna de **350** (`.auth-wrap` es `width: min(420px, 100%)` y `.frame` se
lleva 20 px de relleno a cada lado). Quedan fuera de la pantalla el campo de búsqueda, los
«max» de las dos zonas y **el botón Vigilar**.

Y no se nota, que es lo peor: `design/tremen-ds/responsive.css` declara
`html, body { overflow-x: hidden }` por debajo de 720 px, así que en vez de aparecer una
barra de desplazamiento —fea pero honesta— **el contenido se corta en silencio**. El
usuario no ve que le falta algo: ve un formulario que parece completo y no lo es.

### 2. Los títulos del panel se parten letra a letra — `V-SPEC-039-2`

`.cards` (`design/tremen-ds/components/cards.css:15`) es
`grid-template-columns: repeat(3, 1fr)` **sin ninguna variante responsive**. A 390 px las
tarjetas del panel caen en columnas de ~110 px y los títulos se rompen dentro de la
palabra: «Ac / cio / ne / s». Es la **segunda pantalla** que ve un tester recién
registrado, justo después del registro.

### 3. `/vigiladas` con filas desplaza la página entera — `V-SPEC-039-3`

Con al menos una fila, la página se va en horizontal entre **~721 y ~800 px** (medido a
760: `scrollWidth` **819** sobre `clientWidth` **760**). La causa es de una línea:
`.table-scroll { overflow-x: auto }` vive **dentro** de `@media (max-width: 720px)`
(`src/app/globals.css:330`), así que por encima de 720 px **no hay contenedor** que absorba
la tabla y la absorbe el documento.

### 4. La guardia no mide lo que hay que medir — `V-SPEC-039-6`

Esto es lo que **impide que la familia entera vuelva**, y por eso es el centro de esta spec
y no un extra.

`tests/e2e/ayuda-responsive.spec.ts` mide el desborde como
`document.scrollWidth - document.clientWidth`. Con `overflow-x: hidden` en `body`, **un
hijo que se sale se recorta sin mover ese número**. Por eso la suite estaba verde con el
botón «Vigilar» fuera de la pantalla: la medida elegida es literalmente incapaz de ver el
defecto número 1.

Lo grave es que el proyecto **ya sabía medirlo bien y lo perdió**. Las cuatro guardias se
escribieron una por spec, copiando y adaptando la anterior:

| Guardia | Spec | ¿Mide elemento a elemento? |
|---|---|---|
| `pie-responsive.spec.ts` | SPEC-035 | n/a (mide altos del pie) |
| `cuenta-responsive.spec.ts` | SPEC-036 | **Sí** — invariante (2), `r.right > ventana + 1` sobre `main *` |
| `admin-responsive.spec.ts` | SPEC-037 | **No** — sólo `doc.scrollWidth - doc.clientWidth` |
| `ayuda-responsive.spec.ts` | SPEC-039 | **No** — sólo `doc.scrollWidth - doc.clientWidth` |

La técnica correcta entró en SPEC-036 y **se cayó en las dos copias siguientes**. No es que
nadie supiera medir: es que **la medida no vive en ningún sitio del que se pueda copiar sin
degradarla**. Mientras cada spec escriba su propia función `medir`, la próxima volverá a
perder lo que aprendió la anterior.

Y hay un tercer punto ciego que **ninguna** de las cuatro cubre: el defecto 2 —partir
palabras— **no desborda nada**. El texto se reparte dentro de su caja, así que ni la medida
de documento ni la medida por elemento lo ven. Hace falta una tercera medida.

### 5. Un rótulo que contradice al glosario — `F-SPEC-036-9`

`/cuenta` rotula el rol como «**Tipo de cuenta**» (`src/app/cuenta/page.tsx:74`) cuando
`docs/fundacion/dominio.md` dice «**Rol de cuenta**» (término que entró con SPEC-034, desde
ADR-021). **ADR-025 pto. 4** ya le asignó la vía **(b)**: *«el primer punto del lote de
rótulos de EPIC-FIX»*, con el motivo escrito de que un rótulo que contradice al glosario
**en una pantalla que va a ver un tester externo no espera compañía**. El humano confirmó en
el gate del 2026-08-20 que entra aquí.

### Por qué esto es EPIC-FIX

Es el patrón exacto de **CE-F1**: capacidades **ya entregadas y verificadas** —el alta de
vigiladas (SPEC-002/SPEC-008), el panel (SPEC-034), la tabla de vigiladas (SPEC-007/029) y
el perfil (SPEC-036)— que **no cumplen su promesa con uso real**, aquí el uso real de un
teléfono. No se añade alcance: se restaura lo prometido. Y es hermano de **CE-F2** (ningún
fallo silencioso) en su versión visual: `overflow-x: hidden` es el equivalente de
maquetación al *«sin cotización»* mudo — esconde el problema en vez de enseñarlo.

## Usuarios / roles afectados

- **Tester externo que llega del foro con su teléfono** — el afectado principal: hoy no
  puede completar CE-1. Sufre los defectos 1, 2 y 5.
- **Cualquier usuario en móvil o tablet** (roles `tester`, `completo`, `admin`): defectos 1,
  2, 3 y 5.
- **Usuario en tablet o en ventana estrecha de escritorio (721–800 px)**: defecto 3.
- **El proyecto entero** como destinatario del defecto 4: mientras la guardia mida mal,
  cualquier spec futura puede reintroducir esta familia con la suite en verde.

## Criterios de aceptación

Todas las medidas se toman **en el navegador, con la app corriendo** (Playwright), a los
**siete anchos de referencia**: **390, 640, 700, 730, 760, 800 y 1280 px**. Son los cinco
que usa toda la épica (390, 640, 700, 760, 1280) **más 730 y 800**, que son los bordes de la
ventana en que vive el defecto 3 y que ninguna guardia miraba. Alto de ventana: 844 px en
móvil (390) y 900 en el resto. Tolerancia de redondeo del motor: **1 px**.

- **CA-1 (el formulario de alta cabe entero).** Dado un usuario con sesión y la lista de
  vigiladas **vacía**, cuando abre `/vigiladas` a **390 × 844**, entonces **ningún** elemento
  visible dentro de `form.auth-form` tiene `getBoundingClientRect().right > innerWidth + 1`
  ni `left < -1`. En particular `.symbol-picker`, `.symbol-search-input`, los cuatro campos
  `min`/`max` de las dos zonas y el botón **Vigilar** caben dentro de la columna de **350
  px** (hoy miden 444). Además el propio formulario no genera desplazamiento interno:
  `form.auth-form.scrollWidth <= clientWidth + 1`. El test escribe la anchura medida de cada
  elemento en el mensaje de fallo.

- **CA-2 (y sirve para lo que existe: CE-1 en un teléfono).** Dado un visitante anónimo a
  **390 × 844**, cuando se registra y en `/vigiladas` teclea en el buscador, **elige un
  candidato de la lista**, rellena la zona de compra (min y max) y pulsa **Vigilar**,
  entonces la acción aparece en la tabla — y **todo el recorrido ocurre sin desplazamiento
  horizontal de la página**: antes de cada interacción el test comprueba que el control está
  dentro de la ventana (`right <= innerWidth + 1`) y el clic se hace sin forzar
  `scrollIntoView` horizontal. Es CE-1 de EPIC-004, medido en el ancho en el que hoy falla.

- **CA-3 (el desborde no se puede enmascarar: se mide elemento a elemento).** Dados los
  siete anchos y las rutas que alcanza un **tester** —`/`, `/ayuda`, `/legal`, `/login`,
  `/register`, `/dashboard`, `/vigiladas` **vacía** y **con al menos una fila**, `/avisos` y
  `/cuenta`—, cuando se recorre cada elemento visible de `nav`, `main` y `footer`, entonces
  ninguno tiene `right > innerWidth + 1`. Las **únicas** exclusiones admitidas son elementos
  `position: absolute|fixed` que sólo existen desplegados bajo demanda (hoy: `.symbol-results`
  y su lista de candidatos); van en una **lista escrita y comentada** dentro del módulo de
  medida, con su motivo, de forma que ampliarla sea una decisión visible en la revisión y no
  un descuido. El mensaje de fallo nombra el elemento peor y su `right`.

- **CA-4 (ninguna palabra se parte, y el panel reparte columnas según lo que cabe).** Dado
  `/dashboard` con rol **`tester`** (dos tarjetas) y con rol **`completo`** (tres), entonces:
  (a) a **390 px** el contenedor de tarjetas resuelve a **una sola columna**
  (`getComputedStyle(...).gridTemplateColumns` con **1** pista) y a **640/700 px** a **dos
  como mucho**; (b) a **1280 px** sigue habiendo **tres** pistas — el escritorio no cambia; y
  (c) a los siete anchos, para cada `.card h3` y cada `.card .num`, el número de cajas de
  línea que devuelve `Range.getClientRects()` sobre su texto es **≤ su número de palabras**
  —es decir, ninguna palabra se rompe— y ninguna caja de línea excede el ancho de contenido
  de su tarjeta. Traducción del defecto: «Acciones vigiladas» ocupa como mucho **2** líneas,
  no ocho.

- **CA-5 (la tabla se desplaza dentro de su caja, nunca la página).** Dado `/vigiladas` con
  **al menos una fila**, a los siete anchos, entonces
  `document.documentElement.scrollWidth <= clientWidth + 1`; `.table-scroll` tiene
  `overflow-x: auto` **computado a todos los anchos** (no sólo por debajo de 720); y la tabla
  **sigue siendo legible**: desplazando `.table-scroll` hasta su extremo derecho se alcanza
  la última columna (el control de **Quitar**) y queda dentro de la ventana. Medida de hoy
  que debe desaparecer: `scrollWidth` **819** sobre `clientWidth` **760**.

- **CA-6 (una sola guardia, compartida, en vez de cuatro copias que se degradan).** Dado el
  árbol de tests, entonces existe **un único módulo** de medición reutilizable (p. ej.
  `tests/e2e/geometria.ts`) que expone las tres medidas de CA-3, CA-4 y CA-5 más los anchos
  de referencia; y `ayuda-responsive.spec.ts`, `cuenta-responsive.spec.ts` y
  `admin-responsive.spec.ts` **lo consumen** en lugar de repetir su propia función `medir`.
  Comprobable de forma binaria: **ningún** fichero `tests/e2e/*-responsive.spec.ts` deriva el
  desborde horizontal de `document.scrollWidth` como **única** medida; la lectura de
  `scrollWidth` con ese fin aparece **sólo** dentro del módulo. Cada guardia conserva sus
  invariantes propios (los altos del pie, el hueco muerto, el eje declarado): lo que se
  unifica es **cómo se mide**, no qué se afirma.

- **CA-7 (prueba de eficacia: la guardia caza los tres defectos).** Dado un test que
  **reinyecta cada defecto en tiempo de ejecución** con CSS inyectado en la página —(a)
  devolverle a `.symbol-picker`/`.symbol-search-input` la anchura que hoy los saca de la
  columna; (b) `.cards { grid-template-columns: repeat(3, 1fr) }` a 390 px; (c)
  `.table-scroll { overflow-x: visible }` a 760 px—, cuando se aplica **la misma función de
  medida** que usan CA-3, CA-4 y CA-5, entonces **las tres inyecciones producen violación**
  con la cifra medida en el mensaje, y **sin inyectar ninguna, no hay violación**. Los tres
  casos, en verde, en el mismo fichero. Es el patrón que ya funcionó en SPEC-035: si la
  guardia no se pone roja al devolver el defecto, no está midiendo lo que dice medir.

- **CA-8 (la lección de `V-SPEC-039-6`, escrita como comprobación).** Dado el caso (a) de
  CA-7 reinyectado en `/vigiladas` a 390 px, cuando se toman **las dos** medidas sobre la
  misma página, entonces la medida de documento (`scrollWidth - clientWidth`) **no ve nada**
  —porque `body { overflow-x: hidden }` la enmascara— y la medida por elemento **sí lo ve**.
  El test lo afirma con las dos cifras. Existe para que nadie vuelva a sustituir la segunda
  por la primera creyendo que son equivalentes.

- **CA-9 (el rótulo sale del glosario).** Dado `/cuenta` con sesión, entonces el rótulo del
  rol es exactamente «**Rol de cuenta**» y no aparece «Tipo de cuenta» en la pantalla. Y no
  se queda en una cadena suelta: un test lee la fila del término en
  `docs/fundacion/dominio.md` y **compara** el rótulo que pinta la app con el nombre del
  término, de modo que salta tanto si el rótulo se desvía como si el glosario se renombra.
  Cierra **F-SPEC-036-9** por la vía **(b)** de **ADR-025 pto. 3**.

- **CA-10 (no degradar lo entregado).** Dado el conjunto de comprobaciones del proyecto,
  entonces **toda la suite queda en verde** —unit y e2e—, y en particular `pie-responsive`,
  `cuenta-responsive`, `admin-responsive`, `ayuda-responsive`, `ayuda.spec.ts` (incluido su
  CA-9: el formulario de alta sigue cayendo dentro de la ventana sin scroll a
  640/700/760/1280), `vigiladas.spec.ts`, `roles.spec.ts` y `cuenta.spec.ts`. A **1280 px**
  la app se ve **igual que antes**: tres tarjetas en el panel y la tabla sin cambio de
  aspecto.

- **CA-11 (evidencia medida, no razonada).** Dado el cierre de la spec, entonces quedan en
  `_qa/SPEC-040/` las **capturas y las medidas** de los siete anchos para `/vigiladas`
  (vacía y con filas) y `/dashboard`, con las tres cifras de antes y después:
  `.symbol-picker` **444 → ≤ 350** a 390 px; documento **819/760 → ≤ 760** a 760 px; pistas
  de `.cards` **3 → 1** a 390 px y **3** a 1280 px.

## Entidades y reglas afectadas

**No hace falta ningún término nuevo de dominio**: esta spec arregla maquetación y corrige
un rótulo, y el término que ese rótulo necesita **ya existe**. Nada que escribir en
`docs/fundacion/dominio.md` al aprobarla (ADR-025 pto. 1).

- **«Rol de cuenta»** — `docs/fundacion/dominio.md`, fila introducida por **SPEC-034** desde
  **ADR-021**. Es la fuente literal del rótulo de CA-9. La implementación **copia**, no
  inventa.
- **CE-1 y CE-2 de EPIC-004** — CE-1 es el recorrido que CA-2 mide en un teléfono; CE-2 fija
  que un `tester` no ve Cartera ni Importar, y por eso CA-4 exige el panel correcto en **los
  dos** repartos de tarjetas (dos y tres).
- **CE-F1 y CE-F2 de EPIC-FIX** — restaurar lo prometido con uso real, y no esconder el
  fallo.
- **ADR-025 pto. 3 (vía b) y pto. 4** — origen del punto 5 de esta spec.
- **ADR-026** (nuevo, propuesto con esta spec) — **cómo** se mide la geometría para que no se
  pueda enmascarar, y la convención de que un componente de `src/app/` declara sus propias
  propiedades de caja en vez de heredarlas del sistema de diseño. CA-3, CA-4, CA-6 y CA-7 son
  su aplicación.
- **`F-SPEC-035-11` — se cierra con esta spec.** Pedía decidir «arriba» entre una convención
  escrita y un puñado de comprobaciones de caja en las pantallas principales, porque *«es
  política de proyecto, no un CA de esta spec»*. La respuesta es **las dos**: la convención
  va a **ADR-026** y las comprobaciones a **CA-3/CA-4/CA-6**, sobre el conjunto de rutas que
  alcanza un tester. Se cierra citando esta spec.
- **`V-SPEC-039-1`, `-2`, `-3` y `-6`** — quedan cerrados por CA-1, CA-4, CA-5 y CA-6/7/8
  respectivamente. **`F-SPEC-036-9`**, por CA-9.
- **Dónde vive el arreglo.** En **`src/app/`** (`globals.css` y, si hace falta, una clase
  propia para el contenedor de tarjetas). **`design/tremen-ds/` no se toca**: es el sistema
  compartido con el sitio de tremen.dev, y añadirle allí la variante responsive de `.cards`
  cambiaría también esa web. `globals.css` importa el sistema en su primera línea, así que lo
  que declare la app gana por orden de fuente a igual especificidad.

## Fuera de alcance

1. **Rediseñar `design/tremen-ds`.** No se toca ni un fichero: ni la variante responsive de
   `.cards`, ni `responsive.css`. Motivo arriba: es sistema compartido.
2. **Quitar `html, body { overflow-x: hidden }`.** No se exige. Sería tocar el sistema (1) y
   destaparía desbordes de superficies que esta spec no ha medido. Con la medida por elemento
   de CA-3, que siga puesto **ya no esconde nada**.
3. **Regresión visual por comparación de imágenes.** Rechazada, con el mismo motivo con que
   la rechazaron SPEC-035, SPEC-036 y SPEC-037: una prueba de captura se rompe al cambiar una
   fuente o un color, que no es lo que hay que proteger. Se miden **cajas**, no píxeles de
   color.
4. **Anchos fuera de [390, 1280]**, orientación apaisada y zoom del navegador. 390 px es el
   suelo declarado; 320 px no se soporta en esta spec.
5. **Rediseñar la tabla de vigiladas en móvil** —columnas colapsables, tarjetas en vez de
   tabla, columna de ticker fija—. Basta con que el desplazamiento viva en su contenedor
   (CA-5). Si el humano quiere una tabla pensada para móvil, es producto y va a su épica.
6. **Pantallas no medidas**: `/cartera` e `/importar` (ocultas al tester por CE-2) y `/admin`
   (no la ve un tester y ya tiene guardia propia, que sí migra a la medida buena por CA-6).
   Entran al conjunto de rutas cuando su spec lo pida — que es justo lo que **ADR-026** obliga
   a hacer.
7. **Un barrido general de rótulos contra el glosario.** Sólo entra `F-SPEC-036-9`. Y
   **`F-ADR-025-1`** —el test que ate **todos** los términos del dominio a los textos de la
   UI— **sigue abierto**: CA-9 deja el patrón escrito para un término, no la disciplina
   entera.
8. **Los demás residuales de SPEC-039**: `V-SPEC-039-4` y `-5` (documentales, ver §Notas),
   `-7` (coste de consulta en `/dashboard`, EPIC-MEJORA) y `-8` (ya asignado en
   `F-SPEC-038-7`).
9. **Accesibilidad más allá de la caja**: tamaño mínimo de área táctil, contraste, orden de
   foco y lectores de pantalla. Merecen su propia spec y su propia guardia; mezclarlos aquí
   difuminaría la única pregunta que esta spec responde, que es si el contenido **cabe**.

## Riesgos

- **R-1 (arreglar el ancho puede estropear el buscador).** Dejar que `.symbol-picker` encoja
  —típicamente con `min-width: 0` en el ítem de rejilla— también encoge la **lista de
  candidatos**, donde conviven nombre largo, ticker y mercado. Si se resuelve con un recorte
  duro, el usuario deja de poder distinguir dos mercados del mismo ticker, que es
  precisamente lo que entregó SPEC-029. **Mitigación**: CA-2 exige **elegir un candidato de
  la lista** a 390 px, así que un desplegable ilegible se nota en el recorrido y no sólo en
  la medida.
- **R-2 (el refactor de la guardia puede poner roja la suite por motivos ajenos).** CA-6 toca
  tres ficheros de test que hoy están en verde. **Mitigación**: se unifica **la medida**, no
  las afirmaciones; cada guardia conserva sus umbrales y sus invariantes (`HOLGURA_PX`
  distinta en cada una, altos del pie, eje declarado). Si al migrar aparece un desborde nuevo
  en una pantalla ya entregada, **es un hallazgo, no una regresión**: se anota como residual
  y se decide en el gate si entra aquí o espera.
- **R-3 (falsos positivos de la medida por elemento).** Recorrer todos los descendientes
  encuentra también elementos absolutos, decorativos o fuera de flujo. `/vigiladas` tiene un
  desplegable absoluto (`.symbol-results`) que `/cuenta` no tenía, así que la versión de
  SPEC-036 no lo sufrió. **Mitigación**: CA-3 exige lista de exclusiones **escrita, corta y
  comentada**; una tolerancia global disfrazada de «holgura» sería volver al punto de partida.
- **R-4 (el orden de la cascada).** El arreglo vive en `src/app/globals.css`, que importa el
  sistema en su primera línea; a igual especificidad gana la app. Si alguna regla del sistema
  ganase igualmente (por especificidad o por venir de un `@media` posterior), la salida **no**
  es subir la especificidad a martillazos ni `!important`, sino **darle al contenedor su
  propia clase de app**. Queda dicho para que no se resuelva por la vía fácil.
- **R-5 (`overflow-x: auto` siempre en la tabla).** Sacar `.table-scroll` del `@media` le da
  contexto de desplazamiento **también en escritorio**. Es inocuo mientras la tabla quepa,
  pero cambia el comportamiento del foco al tabular por celdas anchas. CA-10 lo vigila por el
  lado de «a 1280 se ve igual».
- **R-6 (el defecto 2 no lo caza ninguna medida de desborde).** Partir palabras cabe dentro
  de la caja. Si la implementación se limita a las dos medidas de desborde, CA-4 no queda
  cubierto aunque la pantalla parezca arreglada. Está escrito como **tercera medida** a
  propósito.

## Notas para el gate humano

Lo que conviene mirar con lupa, en orden:

1. **El centro de la spec es CA-6 + CA-7, no los tres arreglos de CSS.** Los tres defectos se
   arreglan en unas pocas líneas; lo que cuesta —y lo que evita que la familia vuelva— es que
   la medida deje de vivir copiada en cuatro ficheros. Si en el gate hay que recortar algo,
   recortar la guardia **es exactamente lo contrario** de lo que este defecto enseña: la app
   ya estuvo verde con el botón fuera de la pantalla.
2. **Cierro `F-SPEC-035-11` aquí** (llevaba abierto desde SPEC-035 esperando una decisión de
   política), y para eso propongo un **ADR nuevo, ADR-026**: cómo se mide la geometría de
   forma que `overflow: hidden` no la pueda enmascarar, y la convención de que un componente
   de `src/app/` declara sus propias propiedades de caja. **Es una decisión que constriñe
   trabajo futuro** —toda pantalla nueva se añade al conjunto de rutas de la guardia— y por
   eso va como ADR y no como una frase dentro de esta spec. Apruébalo junto con la spec, o
   dime que lo dejemos en convención sin ADR.
3. **Añado dos anchos a los cinco de la épica: 730 y 800.** El defecto 3 vive **entre** 721 y
   800, justo en el hueco que dejaban 700 y 760. Cuesta dos medidas más por pantalla.
4. **`design/tremen-ds` no se toca.** Es una decisión, no un olvido: el sistema lo comparte el
   sitio de tremen.dev y una variante responsive de `.cards` allí cambiaría esa web. El coste
   es que la app acumula overrides; el beneficio, que este arreglo no puede romper nada fuera
   de Stockeiro.
5. **`overflow-x: hidden` se queda.** Lo honesto sería quitarlo, pero eso es tocar el sistema
   (punto 4) y abriría una superficie que nadie ha medido. Con CA-3 ya no esconde nada: si
   algo se sale, el test lo dice aunque la pantalla lo disimule.
6. **No hay término de dominio que aprobar** con esta spec (ADR-025 pto. 1): el rótulo de CA-9
   sale de una fila que ya existe.

### Preguntas abiertas

- **¿320 px?** He puesto el suelo en **390** (iPhone 12/13/14, y el ancho con el que se
  midieron los defectos). Un Android pequeño o un iPhone SE están en **360**, y con la barra
  lateral de algún navegador se baja de ahí. Añadir 360 al conjunto es gratis; **320** ya
  obligaría a repensar la tabla y probablemente el formulario. ¿Bajo el suelo a 360?
- **`V-SPEC-039-4`: una frase del glosario que describe un futuro.** La fila «Canal de
  feedback» de `docs/fundacion/dominio.md` dice que la identidad del despliegue es *«la misma
  fuente que … enseña el pie»*, y el pie **todavía no la enseña** — eso llega con SPEC-038.
  **No lo he tocado**: es documento de verdad y su momento natural es el cierre de SPEC-038,
  no un arreglo de maquetación. Si prefieres que lo corrija ya, dilo y lo llevo en este mismo
  gate.
- **¿`/legal` y `/register` dentro del conjunto de rutas de la guardia?** Las he metido porque
  son públicas y las ve un desconocido que llega del foro. Suman ~14 medidas más por
  ejecución. Si el tiempo de e2e importa, se pueden dejar sólo en los tres anchos de móvil.
- **`/cartera` e `/importar` quedan fuera.** Un `tester` no las ve (CE-2), pero **tú sí**, y
  `/cartera` tiene una tabla ancha con el mismo `.table-scroll` del defecto 3. Si quieres que
  el arreglo de CA-5 se **verifique** también allí, dilo y añado la ruta: es una línea en la
  lista, no un CA nuevo.
