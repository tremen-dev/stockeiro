---
id: SPEC-067
tipo: spec
epica: EPIC-MEJORA
estado: aprobada
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-09-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-23, por: humano (Alberto Fojo)}
---
# SPEC-067 — El enlace se abre desde la fila: uno va directo, varios se eligen, y la nota tiene su propia señal

## Problema

**Dónde se vio (CE-M2).** El humano (Alberto Fojo, 2026-09-23), sobre la pantalla real de
`/vigiladas`, con captura de la fila de `QFIN` («Qfin Holdings Inc. ADR»):

> «me gustaría mejorar el UX respecto a los enlaces en las acciones. ahora mismo tenemos este
> comportamiento, muestra que hay un enlace, pero hay que abrir el menu de editar, buscarlo...
> no está muy bien. si ya estamos indicando que hay un enlace, por qué no creamos el link
> directamente?»

**Qué hay hoy, leído en `origin/main` (1c24f0c) el 2026-09-23:**

- SPEC-063 (CA-9/CA-10) pinta **una sola señal** pegada al ticker, en la celda «Activo» de la
  descripción única de columnas (`src/app/vigiladas/columnas-vigiladas.tsx`, ADR-034 §3): un
  `<span role="img">` con el glifo `✎`, `aria-label` y `title` iguales a
  `textoDeContexto(contexto)` (`src/lib/contexto/senal.ts`) — «Tiene nota tuya», «Tiene 1
  enlace tuyo», «Tiene nota tuya y 2 enlaces»… Estilo `.contexto-senal`: `color: var(--fg-dim)`,
  `cursor: default`.
- **La señal está fundida**: nota y enlaces comparten **un único glifo, y es un lápiz**. Con
  sólo enlaces, la fila enseña un lápiz — que se lee como «nota» o como «editar», no como
  «enlace». El detalle viaja sólo en el `title`, que en táctil no existe.
- **La señal es inerte.** Para abrir el enlace hay que pulsar *Editar* (novena columna; en
  móvil, arrastrando la tabla), desplegar el bloque de contexto del `<dialog>` de edición
  (ADR-030) y localizar el enlace ahí, donde **sí** es un `<a target="_blank"
  rel="noopener noreferrer">` (`src/app/vigiladas/contexto-form.tsx`). Tres gestos y una
  capa modal para una acción de lectura.
- **`/cartera` no pinta contexto**: es la segunda spec de EPIC-009, sin escribir. Esta spec no
  la adelanta (ver «Fuera de alcance»).
- **Ya se valida el esquema al guardar**: `normalizarEnlace` (`src/lib/contexto/enlace.ts`)
  parsea con `new URL` y compara `protocol` contra `ESQUEMAS_PERMITIDOS = ['http:', 'https:']`
  (SPEC-063 CA-11). `rotuloDeEnlace` da la etiqueta o, sin ella, el dominio sin `www.`
  (SPEC-063 CA-15).
- **Nada en la fila abre la capa salvo el botón *Editar*** (`ctx.abrir(r.id,
  e.currentTarget)`); la fila y la tarjeta no tienen manejador de clic propio.

**Por qué es mejora y no capacidad nueva (CE-M1, CE-M3).** El dato ya está cargado en la
página (`ContextoVigiladas.contextos`, por `symbolId`), la validación ya existe y el vehículo
de lo que se abre desde una fila ya está decidido (ADR-030). No hay migración, ni proveedor,
ni acción de servidor, ni ADR nuevos: cambia **cómo se presenta y se alcanza** lo que ya se
sabe.

## Decisión de diseño (lo que el gate aprueba)

1. **Dos señales, no una.** La nota y los enlaces dejan de compartir glifo:
   - **Nota**: se queda como está hoy —informativa, `role="img"`, glifo `✎`, «Tiene nota
     tuya»—. No es interactiva: la nota vive en la capa de edición y no hay nada que «abrir»
     en la fila.
   - **Enlaces**: un **control** propio, con un glifo de enlace monocromo (SVG en
     `currentColor`, **no** emoji: los emoji cambian de color y de métrica según el sistema).
   Motivo: un mismo elemento no puede ser a la vez una imagen informativa y un control; y un
   lápiz no dice «enlace». Separarlas también arregla la señal de sólo-enlaces, que hoy
   enseña un lápiz.
2. **Con 1 enlace, la señal ES el enlace**: un `<a href target="_blank" rel="noopener
   noreferrer">` a la URL guardada. Un gesto.
3. **Con 2 o más (tope 5, SPEC-063 CA-14), la señal abre la lista de enlaces en un
   `<dialog>` modal anclado a la ventana**, con el mismo vehículo y las mismas obligaciones que
   la capa de edición (ADR-030 §1, §2 y §3): hoja inferior en móvil, nombre accesible que
   nombra al activo y su mercado, `Escape`, foco que vuelve al disparador. Cada enlace es una
   fila de 44 px con su rótulo y, debajo, su dominio. El disparador lleva el número de
   enlaces junto al glifo, para que se vea antes de pulsar que hay que elegir.
   - **Por qué no un *popover* ligero anclado al glifo**, que sería la forma más directa en
     escritorio: ADR-030 §1–§2 decide que **lo que se abre desde una fila** vive en una capa
     anclada a la ventana y que su vehículo es el `<dialog>` con `showModal()`; un *popover*
     no modal (atributo `popover` o menú posicionado) sería **otro vehículo** y exigiría un
     ADR que precise ADR-030 — y una mejora que necesita ADR **no es una mejora** (CE-M3). En
     móvil, además, la hoja inferior es la forma natural de un menú de 2–5 destinos. El coste
     real es un velo modal en escritorio para una lista corta; se deja escrito como pregunta
     del gate.
   - **Por qué no pintar los enlaces en la fila**: la tabla de nueve columnas no cabe a
     730–760 px (SPEC-062, SPEC-063 CA-10) y cinco chips en la celda «Activo» la rompen.
   - **Por qué no «abrir el primero» y ya**: con varios, elegir por el usuario cuál es el
     importante es inventar un dato.
4. **Activar un enlace de la lista la cierra** y devuelve el foco al disparador: al volver de
   la pestaña nueva el usuario está en su fila, no en una capa que ya no necesita.

## Usuarios / roles afectados

- **Usuario final** (cualquier rol con Vigiladas, incluido `tester`, ADR-021): abre sus
  enlaces desde la fila, en tabla y en tarjeta, con ratón, teclado o dedo.
- **Sistema**: nada. Ni una lectura nueva, ni una escritura, ni una petición a la URL del
  usuario (EPIC-009 CE-4).
- **Operador**: nada.

## Criterios de aceptación

Unitarios con **Vitest** para lo puro (qué se ofrece y cómo se nombra); **e2e Playwright**
para la pantalla, en **las dos formas** de la descripción única (tabla ≥ 720 px y tarjeta
< 720 px, ADR-034); geometría con el **módulo compartido** `tests/e2e/geometria.ts` (M1–M5),
nunca con arneses propios. Las e2e **no salen a Internet**: la navegación de la pestaña nueva
se intercepta y se responde en local.

### Rebanada 1 — Nota y enlaces, cada uno con su señal

- **CA-1 (Dos señales distintas, las cuatro combinaciones).**
  Dada una lista con cuatro vigiladas —sin contexto, sólo nota, sólo enlaces (1), nota y
  enlaces (≥ 2)—, cuando se pinta `/vigiladas` en tabla y en tarjeta, entonces: la de sin
  contexto **no tiene ninguna marca ni hueco**; la de sólo nota tiene **la señal de nota y no
  la de enlaces**; la de sólo enlaces tiene **la de enlaces y no la de nota**; la de ambas
  tiene **las dos**. Cada señal es un elemento distinto, con su propio `data-testid`, y los
  glifos son distintos entre sí.

- **CA-2 (La señal de nota sigue siendo información, no un control).**
  Dada una vigilada con nota, entonces su señal de nota tiene `role="img"`, nombre accesible
  «Tiene nota tuya», **no es alcanzable con Tab** y no reacciona al clic. Su texto sale de
  `src/lib/contexto/senal.ts` (el mismo módulo puro de SPEC-063), no se escribe en la celda.

### Rebanada 2 — Un enlace: un gesto

- **CA-3 (Con un enlace, la señal abre ese enlace).**
  Dada una vigilada con exactamente 1 enlace `https://foro.example.com/hilo`, cuando el
  usuario pulsa la señal de enlaces, entonces se abre **una pestaña nueva** cuya URL es la
  guardada; la señal es un `<a>` con `href` igual a la URL guardada, `target="_blank"` y `rel`
  que contiene **`noopener`** y **`noreferrer`**; y la pestaña original **sigue en
  `/vigiladas`**, sin capa abierta.

- **CA-4 (Dice adónde lleva antes de pulsar).**
  El nombre accesible y el `title` de la señal de un solo enlace dicen **el destino** y que
  **se abre en pestaña nueva**, con el rótulo de SPEC-063 CA-15. Las dos direcciones, como
  especímenes unitarios de la función pura que compone la frase:
  - con etiqueta «Tesis Q3» y URL `https://www.seekingalpha.com/x`: la frase contiene
    «Tesis Q3» **y** el dominio `seekingalpha.com`;
  - sin etiqueta: la frase contiene el dominio **una sola vez** (no «seekingalpha.com
    (seekingalpha.com)») y **nunca** la URL entera.

### Rebanada 3 — Varios enlaces: se eligen en una capa

- **CA-5 (Con varios, la señal abre la lista, con cuántos a la vista).**
  Dada una vigilada con 3 enlaces, entonces la señal de enlaces es un `<button>` con
  `aria-haspopup="dialog"` (no `aria-expanded`, ADR-030 §2) que **enseña el número 3** junto
  al glifo y cuyo nombre accesible dice que son 3 enlaces y de qué activo. Al pulsarlo se abre
  un `<dialog>` en modo modal cuyo nombre accesible nombra **el activo y su mercado** (p. ej.
  «Enlaces de QFIN · NASDAQ»). Dentro hay **exactamente 3** enlaces, **en el orden guardado**
  (SPEC-063 CA-2), cada uno un `<a>` con `target="_blank"` y `rel` con `noopener` y
  `noreferrer`, que enseña su **rótulo** y, debajo, su **dominio**.

- **CA-6 (La capa se comporta como la de editar).**
  Con la lista abierta: `Escape` la cierra; hay un botón de cerrar visible; al cerrarse **por
  cualquier vía** el foco vuelve **a la señal que la abrió**. Activar uno de los enlaces abre
  una pestaña nueva con **esa** URL, **cierra la capa** y devuelve el foco a la señal.

- **CA-7 (La respuesta cae donde está el usuario, y cabe).**
  Con una lista **larga de verdad** —la guardia afirma su precondición: el final de la lista
  queda por debajo del pliegue en el ancho que mide (ADR-030 §4)—, abrir la lista de enlaces
  desde la vigilada **primera, una intermedia y la última** cumple **M4** (dentro de la
  ventana, sin desplazamiento del documento). La capa y la fila con sus señales cumplen **M1,
  M2 y M3** a los ocho anchos de ADR-026, y por debajo de 720 px **M5**: la señal de enlaces y
  cada enlace de la capa tienen al menos 44 × 44 px (contando pseudoelementos) y **no se
  solapan** con otro control. La capa **entra en la medida** (ADR-030 §5), no en
  `EXCLUSIONES_M1`. La señal **no añade columna** y la tabla no desborda más que hoy a
  730–760 px.

### Rebanada 4 — Teclado, foco y no disparar otra cosa

- **CA-8 (Se llega y se usa con teclado).**
  Tabulando por una fila con enlaces, la señal de enlaces **recibe el foco** —antes que
  *Editar*, en el orden del documento— con un **anillo de foco visible** (el mismo tratamiento
  `:focus-visible` que el resto de controles); `Enter` sobre ella abre el enlace (1) o la capa
  (≥ 2), con el foco dentro de la capa en el primer enlace.

- **CA-9 (Activar la señal no hace nada más).**
  Pulsar o activar con teclado la señal de enlaces **no abre la capa de edición**, **no cambia
  el orden** de la lista ni la URL de la página, y la pestaña original no navega. El evento no
  se propaga a ningún manejador de la fila o de la tarjeta (hoy no hay ninguno; el test lo
  fija para cuando lo haya). Verificable en e2e: tras el gesto, `editar-vigilada` no está
  abierto y `page.url()` es la de antes.

### Rebanada 5 — Seguridad: se abre lo que se validó, y nada más

- **CA-10 (Sólo `http`/`https` se ofrecen como enlace, también al pintar).**
  La decisión de qué enlaces son **abribles** es una función **pura** que reutiliza
  `ESQUEMAS_PERMITIDOS` (no una segunda lista). Defensa en profundidad sobre lo que ya validó
  SPEC-063 al guardar: un valor que llegue a la página con otro esquema —fila antigua, escritura
  fuera del formulario— **no se pinta como `href`** en la fila ni en la capa. Especímenes en
  las dos direcciones:
  - **no se ofrecen**: `javascript:alert(1)`, `JavaScript:…`, `  javascript:…` con espacios,
    `data:text/html,…`, `vbscript:…`, `file:///etc/passwd`;
  - **sí se ofrecen**: `https://a.example/`, `https://a.example:8443/x`,
    `https://a.example/p?q=1#f`, `https://a.example/ruta/ñandú`, `http://a.example/`.
  Si **ningún** enlace de una vigilada es abrible, no hay señal de enlaces (la de nota, si la
  hay, sigue).

- **CA-11 (La app sigue sin visitar lo que el usuario pega).**
  Cargar `/vigiladas` y abrir la capa de enlaces **no emite ninguna petición** al dominio de
  un enlace del usuario: la única que aparece es la **navegación de la pestaña nueva**, y sólo
  tras activar el enlace (e2e registrando las peticiones de la página). Ni *favicon* del
  dominio, ni prefetch, ni previsualización (SPEC-063 CA-13; EPIC-009 CE-4). Los módulos
  nuevos no importan ni llaman a `fetch`.

### Rebanada 6 — Mejora pura, profesional y sin regresión

- **CA-12 (Ni un dato nuevo).**
  El diff **no toca** `src/db/schema.ts`, no añade migración, ni acción de servidor, ni ruta,
  ni consulta: la señal se alimenta de `ContextoVigiladas.contextos`, que ya se carga. Se
  verifica en el gate sobre `git diff origin/main...HEAD` (y `db:scan` sin cambios).

- **CA-13 (Nivel profesional, con evidencia).**
  El control de enlaces tiene estados **reposo / hover / foco** diferenciados y, al ser un
  control, su glifo cumple **contraste no textual ≥ 3:1** contra su fondo (WCAG 2.2 SC 1.4.11,
  AA), medido con colores computados; la señal de nota, que no es control, conserva el bajo
  contraste deliberado de SPEC-063. Ningún texto baja de 12 px (ADR-034 §7). Capturas en
  `_qa/SPEC-067/` a 1280 px y a 390 px de: fila con las cuatro combinaciones de CA-1, señal
  en foco, y capa de enlaces abierta.

- **CA-14 (Cero regresión, y las guardias de SPEC-063 se adaptan sin aflojarse).**
  Batería completa verde. SPEC-063 CA-9/CA-10 fijaban **una** señal con **una** frase; esta
  spec la parte en dos, así que su e2e (`tests/e2e/spec063-contexto.spec.ts`) y
  `tests/spec063-vocabulario-y-ayuda.test.ts` **se adaptan**, conservando las propiedades:
  sin contexto no hay marca; con contexto, **entre las dos señales** el nombre accesible dice
  que hay nota, que hay enlaces y cuántos. Cualquier `expect` ajeno modificado se justifica
  uno a uno en el ledger (ADR-031, ADR-037). Siguen en verde sobre `/vigiladas`: SPEC-007,
  SPEC-041, SPEC-043, SPEC-044/SPEC-046 (capa de edición), SPEC-054 (tarjetas), SPEC-062
  (barra de acercamiento) y SPEC-063/SPEC-064. Versión subida según `version:check`, verificada
  sobre el árbol commiteado.

## Entidades y reglas afectadas

- **Término de dominio** «Enlace de un símbolo» (`docs/fundacion/dominio.md`): **no cambia**.
  Ya dice que se abre en el navegador de su dueño, en pestaña nueva y sin referencia de
  origen, y que sin etiqueta se presenta por su dominio; esta spec sólo lo hace alcanzable
  desde la fila.
- **Reglas**: RN-01 (aislamiento: la señal pinta sólo los `contextos` del usuario, que ya
  vienen filtrados). Ninguna RN nueva.
- **ADR que la enmarcan (sin ADR nuevo)**: **ADR-030** §1–§6 (vehículo y medidas de la capa
  de enlaces), **ADR-034** §3 (una sola descripción para tabla y tarjeta), §6 (M5) y §7
  (suelos de legibilidad), **ADR-026** (M1–M3, ocho anchos).
- **Código que se toca**: `src/lib/contexto/senal.ts` (frases, ahora dos), `src/lib/contexto/`
  (función pura de enlaces abribles y nombre del destino, reutilizando `enlace.ts`),
  `src/app/vigiladas/columnas-vigiladas.tsx` (celda «Activo»), el componente de la capa de
  enlaces (hermano del `<dialog>` de `watched-table.tsx`) y `src/app/globals.css`.

## Fuera de alcance

- **`/cartera`**: la señal allí es la segunda spec de EPIC-009. Se deja el componente de la
  señal **sin acoplarse a `/vigiladas`** para que aquella lo reutilice, pero no se pinta aquí.
- **Hacer interactiva la señal de nota** (p. ej. que abra la capa de edición con el foco en la
  nota, o que enseñe la nota en un globo). Ver pregunta 2 del gate.
- **Editar o reordenar enlaces desde la capa de enlaces**: sigue siendo cosa de la capa de
  edición (SPEC-063).
- **Título, icono (*favicon*) o previsualización del destino**: prohibido por EPIC-009 CE-4.
- **Un *popover* no modal**: exigiría ADR (ver Decisión, pto. 3).

## Notas para el gate humano

1. **La decisión que más conviene mirar: varios enlaces en `<dialog>` modal y no en un
   desplegable ligero.** Es lo que ADR-030 permite sin ADR nuevo; en escritorio cuesta un velo
   modal para elegir entre 2–5 enlaces. Si el humano prefiere el *popover* anclado al glifo,
   hace falta un ADR que precise ADR-030 §2 para esta clase de superficie (lista de destinos,
   sin formulario), y por CE-M3 la spec saldría de EPIC-MEJORA o se aprobaría con esa
   excepción explícita. **Pregunta**: ¿se acepta la capa modal?
2. **La nota queda como señal informativa, no clicable.** Junto a un glifo de enlace que sí
   reacciona puede sorprender que el lápiz no lo haga. Alternativa barata (y dentro de
   ADR-030): que la señal de nota abra la capa de edición ya existente. No se incluye porque
   no está pedido (CE-M2). **Pregunta**: ¿se deja informativa o se hace atajo a la capa de
   edición?
3. **Esta spec modifica guardias de SPEC-063** (CA-9/CA-10 fijaban una frase única). Es
   inevitable al partir la señal; CA-14 obliga a conservar la propiedad y a justificar cada
   `expect` tocado.
4. **Colisiones**: SPEC-045 (silenciar, aprobada y sin implementar) añade un control a la
   misma fila; la segunda de EPIC-009 (cartera) heredará esta señal. Quien llegue después
   rebasa y reconcilia.
5. **Mergear es desplegar** (F-SPEC-023-1): sin migración, el riesgo de despliegue es sólo de
   interfaz.
