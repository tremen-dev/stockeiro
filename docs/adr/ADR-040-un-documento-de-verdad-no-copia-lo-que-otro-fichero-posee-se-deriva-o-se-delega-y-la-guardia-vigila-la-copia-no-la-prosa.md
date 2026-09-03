---
id: ADR-040
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-09-03, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-03, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-040: Un documento de verdad no copia lo que otro fichero posee: se deriva o se delega, y la guardia vigila la copia, no la prosa

- Deciders: propone **sdd-arquitecto** (2026-09-03, al escribir SPEC-060); **aprueba Alberto Fojo
  el 2026-09-03**, en el mismo gate que SPEC-060 y **sin enmiendas al texto**. **Generaliza
  ADR-039 pto. 8** —que fijó la regla para **un** valor, la hora del cron— y **no supersede
  nada**: ADR-039, ADR-037, ADR-031 y ADR-025 siguen enteros, y este ADR se apoya en los tres
  últimos.
- Specs relacionadas: **SPEC-060** (lo origina y es su primera aplicación); **SPEC-059**
  (precedente completo: CA-4 derivando, CA-5 delegando, CA-9 y CA-10 sin guardia); **SPEC-057** /
  **ADR-037** (lo que este ADR **no** autoriza a mecanizar).

## Contexto

`docs/fundacion/contexto.md` es el documento que `CLAUDE.md` manda leer en el paso 2: el primer
sitio donde mira todo el que entra al proyecto, humano o agente. El 2026-09-03, al abrirlo con
desconfianza, salieron **once afirmaciones falsas o caducadas** en 121 líneas — entre ellas la
versión del framework (decía 15, es 16), un fichero citado que no existe (`src/middleware.ts`), un
scheduler descrito como *«aún no implementado»* que lleva vivo desde SPEC-004, una lista de claves
de entorno con dos de las once y **sin la que trae los precios**, y dos valores de `DB_DRIVER`
—`neon-http`, `postgres-js`— que `src/db/client.ts` **no reconoce**, en un módulo que hace caer
todo lo no reconocido en Neon **en silencio**.

Esa última merece nombrarse porque es la que enseña el tamaño del problema: un documento de
orientación no se ignora, **se obedece**. Quien copiaba `DB_DRIVER=postgres-js` creyendo apuntar a
su Postgres local acababa hablando con el de producción sin un aviso.

**La causa es única, y es la misma en las once**: el documento **guardaba una copia de un valor
cuyo dueño es otro fichero**, y el dueño siguió su camino. Es exactamente el defecto que ADR-039
pto. 8 cerró para la hora del cron (*«`vercel.json` es el único sitio donde vive el valor; todo lo
demás o lo deriva de ahí o nombra el fichero que lo posee»*), sólo que aquel ADR lo dijo de **un**
número y esto pasa con **todo**: versiones, rutas, listas de claves, censos de decisiones, estado
de specs.

Y hay una segunda causa, de método: **la reacción instintiva a un documento que envejece es
ponerle una guardia**, y en este proyecto eso ya ha salido caro dos veces por el lado contrario
—ADR-037 documenta *«dos escaladas al humano, seis rondas de rol, cero defectos reales cazados»*—.
Una guardia que congela prosa es un test que hay que aflojar cada vez que alguien redacta mejor
una frase, y una guardia que molesta acaba desactivada. Hace falta escribir **dónde está la
frontera**, no sólo prohibir cruzarla.

## Decisión

### 1. Un documento de verdad no guarda copias: cada afirmación se clasifica en uno de tres niveles

Al escribir o revisar `FOUNDATION.md`, `docs/fundacion/*` o cualquier documento que otros lean
para orientarse, **cada afirmación técnica cae en uno de estos tres tratamientos, y se elige a
propósito**:

- **Nivel 1 — DERIVABLE.** El valor es **pequeño, cerrado y load-bearing** para quien lee, y existe
  un artefacto que **un proceso real consume** del que se puede sacar mecánicamente. Entonces el
  documento **sí lo escribe**, y **una guardia compara las dos mitades derivándolas**: el test **no
  teclea el valor**. Molde: SPEC-059 CA-4 (el bloque JSON del runbook contra el `crons` de
  `vercel.json`).
- **Nivel 2 — DELEGABLE.** El valor tiene dueño y copiarlo no compra nada porque el dueño ya lo
  documenta mejor, o porque el dueño ya tiene guardia propia. Entonces el documento **no lo
  escribe: nombra al dueño**. Molde: SPEC-059 CA-5 (*no copies el valor, nombra a su dueño*).
- **Nivel 3 — PROSA IRREDUCIBLE.** No hay predicado mecánico que la decida sin congelar redacción.
  **No se vigila**: se corrige y se revisa en el diff del gate. Lo único que se le exige es que **no
  lleve dentro una copia de Nivel 1 o 2**.

**Lo que decide entre Nivel 1 y Nivel 2 no es el gusto**: es si el valor le sirve al lector en el
sitio (`DB_DRIVER=pg` sí; las once claves de entorno no, porque `.env.example` las explica una a
una con su ADR) y si existe un artefacto **vivo** del que derivarlo.

### 2. Lo que puede leer una guardia de documento, y lo que no

Rige, sin excepción, el 1.er corolario de `FOUNDATION.md`: **leer un fichero sólo compra algo
cuando lo que se lee es un valor VIVO —uno que un proceso real consume— y ese proceso es de tu
spec o de nadie.** De ahí, para este dominio:

- **Sí son fuente de derivación**: `package.json` (CI instala con él), `vercel.json` (Vercel
  programa con él), el sistema de ficheros (existir o no existir no es opinión), y **un módulo de
  `src/` cuando la afirmación es sobre lo que ese módulo decide** (p. ej. qué valores de
  `DB_DRIVER` distingue `src/db/client.ts`).
- **No lo es `.env.example`**: no lo lee ningún proceso, es documentación para humanos, y su lista
  **ya tiene guardia en su dueño** (`tests/spec-031-frontera.test.ts` CA-13.3, cerrada con
  contador). Una tercera copia sólo añade un sitio donde envejecer.

### 3. Una guardia de documento nace con conjunto esperado vacío o con las dos mitades derivadas

Nunca con una lista literal no vacía de lo que el documento dice hoy: eso es congelar redacción, y
caduca a la primera reescritura legítima. Las formas admitidas son las cuatro que `FOUNDATION.md`
ya declara supervivientes, y en este dominio se concretan en dos:

- **conjunto esperado vacío** —*«ninguna cita rota»*, *«ninguna copia del valor»*—, que sobrevive a
  que el documento crezca; o
- **las dos mitades derivadas** y comparadas entre sí, sin literal en el test.

Con **centinela de no-vacuidad obligatorio** en ambas: si el extractor no encuentra nada que
analizar, el caso se pone **rojo**, no verde. Y con **prueba de eficacia en los dos sentidos**,
con los especímenes escritos en el CA (ADR-026 §7, FOUNDATION 2.º corolario): lo que debe cazar y
lo que **no** debe cazar.

### 4. El sujeto de una guardia de documento es **un** documento, nombrado

No `docs/`, no `docs/fundacion/`, no `tests/`. Ampliar el sujeto es cómo un detector correcto
acaba acusando al registro histórico: un barrido de la hora vieja sobre `docs/fundacion/` pondría
roja la entrada *«Refresco bajo demanda»* de `dominio.md`, que la cita **en pasado** y que
**SPEC-059 CA-10** protege expresamente; y uno sobre `tests/` acusaría a fixtures con `22:00` como
timestamp y a los **especímenes de la propia guardia**. Medido sobre el árbol el 2026-09-03: **tres
inocentes por tres culpables**, la misma aritmética de ADR-037.

### 5. Lo que **no** se mecaniza, y se declara en el CA en vez de olvidarse

**No lleva guardia** —y el CA lo dice por escrito, citando este punto— la afirmación cuyo rojo
sólo puede encenderlo *«cualquiera que trabaje en otra spec»* (ADR-037, discriminante). En
particular:

- el **estado** de una spec o una épica (dueño: `docs/tablero.md`, generado, más el frontmatter);
- el **censo** de un directorio que otros hacen crecer (`docs/adr/`, `docs/epicas/`, `src/lib/`,
  `tests/`);
- la **redacción** de un párrafo.

La ausencia de guardia **se escribe con su motivo**. Un CA que simplemente no menciona la guardia
no es lo mismo que uno que declara por qué no la lleva: el primero se lee como olvido y alguien la
añade en la siguiente ronda.

### 6. Se rechaza la guardia de frescura

Un `Actualizado: <fecha>` que se ponga rojo pasados N días **queda prohibido**: se pone rojo **sin
defecto detrás** —la peor clase de rojo, FOUNDATION 3.ª convención— y su reparación barata es tocar
la fecha sin leer el documento, o sea verde vacío con ceremonia.

### 7. El coste de un Nivel 1 se acepta explícitamente, y es un verdadero positivo

Una guardia de Nivel 1 pone roja **la rama de quien cambia el artefacto derivado**: quien suba el
*major* de Next verá rojo por una palabra en un documento. Eso **no** es el rojo que ADR-037
prohíbe: allí el rojo lo encendía un tercero **que no había tocado nada** y no había defecto
detrás; aquí hay un defecto real —el documento quedó falso—, la mano es la de un acto deliberado y
specado, y el arreglo es de una línea. **La distinción se hace con la pregunta de ADR-037**
(*«¿de quién es la mano que puede poner esto rojo?»*), añadiéndole una segunda: **¿queda algo
falso cuando se enciende?** Si no queda nada falso, no es Nivel 1: es una foto.

### 8. Lo que este ADR **no** autoriza

- **No autoriza vigilar prosa.** Ni presencia de frases, ni longitudes, ni fechas.
- **No autoriza enumerar un directorio ajeno** para afirmar sobre él. ADR-037 sigue entero, y este
  ADR lo cita como límite, no como material a reinterpretar.
- **No autoriza aflojar una guardia que se pone roja.** Siguen valiendo las dos únicas salidas de
  `FOUNDATION.md` —re-encuadrar o borrar—, con lo que vigilaba antes y lo que vigila ahora escrito
  en el ledger, y quien la toca no es quien se beneficia.
- **No obliga a retro-auditar** `dominio.md`, `reglas.md` ni `vision.md`. Rige desde su aprobación
  para lo que se escriba y para lo que una spec abra a propósito.

## Consecuencias

### Positivas

- **El documento que todos leen primero deja de poder envejecer en las tres cosas más citadas**:
  versión del framework, ficheros que nombra y valores que le dice al lector que escriba.
- **Desaparece la duplicación estructural**: las claves de entorno pasan de vivir en tres sitios
  (`.env.example`, la guardia de SPEC-031 y `contexto.md`) a vivir en su dueño y a estar nombradas
  desde el resto.
- **La ausencia de guardia deja de parecer descuido.** Cinco CA de SPEC-060 declaran que no la
  llevan y por qué; el siguiente que los lea no vuelve a proponerla.
- **Hay una respuesta escrita** a *«¿esto se puede vigilar?»*, que hasta hoy se contestaba de
  memoria y con distinto criterio cada vez.

### Negativas / follow-ups

- **Un rojo de Nivel 1 le sale a quien cambia el artefacto, no a quien escribió el documento.** Es
  el precio, está aceptado en el pto. 7, y el arreglo es de una línea — pero es real y hay que
  decirlo en la PR que lo introduce.
- **Ocho de las once averías de SPEC-060 se curan sin guardia.** Su defensa es estructural (el
  documento deja de guardar lo que envejece) más un mapa de dueños en la cabecera. **No hay
  garantía mecánica** sobre ellas, y fabricarla sería peor que no tenerla.
- **El mapa de alias de prosa** que necesita la derivación de versiones (`next-auth` ↔ *Auth.js*)
  es una tabla escrita a mano: una dependencia nombrada en prosa con un alias no previsto **no se
  vigila**. Es un agujero declarado, no un descuido; si algún día molesta, se amplía la tabla.
- **Follow-up abierto**: `dominio.md` y `reglas.md` no se han medido con esta vara. Puede haber
  ahí el mismo mal; medirlo es otra spec y **no** se cuela en la que origina este ADR.

## Alternativas consideradas

- **No escribir ADR: corregir las once frases y ya.** Rechazada porque es exactamente lo que se
  hizo la última vez y por eso hay once. Sin una decisión escrita, el próximo arquitecto vuelve a
  pegar la lista de claves en `contexto.md` y no hay nada que lo impida.
- **Guardia de frescura por fecha.** Rechazada en el pto. 6: rojo sin defecto detrás y reparación
  barata que no lee el documento.
- **Congelar el documento entero contra un snapshot.** Rechazada: es la foto del árbol el día de la
  entrega que FOUNDATION prohíbe en su 3.ª convención, y aquí encima sobre un texto que **debe**
  reescribirse cuando alguien lo redacte mejor.
- **Derivar la lista de claves de `.env.example`.** Rechazada por el 1.er corolario de FOUNDATION
  —no lo lee ningún proceso, aseverar sobre él acopla igual que escribirlo— y porque la lista **ya**
  tiene guardia en su dueño, con contador. Comprarlo dos veces sólo añade un sitio donde envejecer.
- **Quitar del documento todo número y toda ruta** (Nivel 2 puro para todo). Rechazada: convierte un
  documento de orientación en un índice de enlaces. La información que sirve en el sitio se queda —
  y por eso mismo se vigila.
- **Mecanizar el discriminante de ADR-037** para poder vigilar también los censos. Rechazada, y no
  aquí: ADR-037 ya lo rechazó midiéndolo (tres inocentes por un culpable) y exige que quien lo
  quiera traiga un discriminante que separe a los inocentes que nombra por línea. Este ADR **no
  reabre** esa puerta.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
