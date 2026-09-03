---
id: SPEC-060
tipo: spec
epica: EPIC-FIX
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-09-03, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-03, por: Alberto Fojo}
---
# SPEC-060 — El contexto maestro deja de mentir: lo que se puede derivar se deriva, lo que no, nombra a su dueño

## Problema

`docs/fundacion/contexto.md` es **el primer documento que lee todo el que entra aquí**: `CLAUDE.md`
lo pone en el paso 2, antes de que nadie escriba una línea. Es un **documento de verdad**, es
**mío** (sdd-arquitecto) — y es **el único del proyecto que nadie ha mantenido**. Su última
edición es del **2026-08-23**; describe una aplicación que dejó de existir alrededor de
**SPEC-023**, hace treinta y seis specs.

El daño no es cosmético y no es hipotético: **un documento de orientación falso no se ignora, se
obedece**. Quien lo lee no tiene forma de saber qué frase envejeció, así que las cree todas. Y
una de ellas manda al lector contra la base de datos de producción sin un solo aviso (D-5, abajo).

### El inventario, comprobado contra el árbol el 2026-09-03

Las líneas son las del fichero **hoy**; lo que importa es la afirmación, no el número.

| # | Dónde | Lo que dice | Lo que hay |
|---|---|---|---|
| **D-1** | L26 | «**Next.js 15** App Router» | `package.json` declara `"next": "^16.2.10"`. Falso desde **SPEC-009**, y contradice además **ADR-008**, que fijó la **línea 16.x** como piso de seguridad |
| **D-2** | L31 | cita `src/middleware.ts` | Ese fichero **no existe**: es `src/proxy.ts` (el renombrado de Next 16) |
| **D-3** | L47-48 | «**Scheduler** *previsto*: Vercel Cron … **aún no implementado**» | Implementado desde **SPEC-004**; `vercel.json` lo declara, `cron_runs` (**ADR-023**) registra nueve días seguidos en `success`, y **SPEC-059** acaba de moverle la hora (**ADR-039**) |
| **D-4** | L49-53 | la ingesta necesita `TWELVE_DATA_API_KEY` y `CRON_SECRET` | `.env.example` declara **once** claves. Faltan `MARKETSTACK_API_KEY` —el proveedor de precios **real** desde **ADR-012**—, `RESEND_API_KEY`, `RESEND_FROM` y `FEEDBACK_EMAIL` |
| **D-5** | L38-39 | `DB_DRIVER`: «`neon-http` … / `postgres-js`» | `src/db/client.ts` reconoce **`neon`** y **`pg`**. **Ninguno de los dos nombres del documento existe** |
| **D-6** | L12-20 | «EPIC-001 … **en curso**», «SPEC-003 **en `borrador`**», «**Faltan por crear**: Ingesta, Motor de disparo, Notificaciones y UI» | El tablero del 2026-09-03: **EPIC-001 `hecho`** con sus ocho specs, **53 specs en `hecho`**, ocho épicas más tres *buckets* |
| **D-7** | L27-28 | rutas de `src/app/`: `(auth)/`, `dashboard/`, `api/auth/…` | Además existen `vigiladas/`, `cartera/`, `avisos/`, `cuenta/`, `admin/`, `ayuda/`, `legal/`, `api/cron/refresh`, `api/version` |
| **D-8** | L35-37 | «**Tabla nueva** `password_reset_tokens`» | `src/db/schema.ts` declara doce tablas; ésa dejó de ser nueva hace treinta y seis specs. Y la sección **no nombra ni una** de las capas que sostienen el producto: `market`, `triggers`, `notifications`, `portfolio`, `watchlist`, `import`, `ops`, `help`, `legal`, `version`, `feedback`, `account`, `registration` |
| **D-9** | L55-80 | «Decisiones clave **hasta hoy**»: ADR-001, 002, 015, 016 | Hay **39 ADR aprobados**. No aparecen **ADR-012** (el proveedor de precios real), **ADR-018** (*mergear es desplegar*), **ADR-024/033** (versión de producto), **ADR-037**, **ADR-038** (dos escritores de `quotes`) ni **ADR-039** |
| **D-10** | L120-121 | «Preguntas abiertas pendientes de spec: **R-2**, **R-3**, **R-4**» | Las tres cerradas: R-2 por **SPEC-003** (`hecho`), R-3 por **ADR-004** y **ADR-039**, R-4 por **ADR-006**/**SPEC-006** y **ADR-036**/**SPEC-056** |
| **D-11** | L104-118 | salvedades de SPEC-001 y SPEC-023 «pendientes» | Su estado vive en los ledgers de esas specs, que es quien lo posee. F-SPEC-001-2 («aprovisionar Neon y `AUTH_SECRET` **antes de producción**») quedó atrás: la app está desplegada desde **SPEC-028** |

Once afirmaciones falsas o caducadas en un documento de 121 líneas. **Cinco de ellas se me
encargaron comprobadas; las otras seis salieron al barrer el documento entero**, que es
exactamente lo que había que hacer: cinco fallos en un documento sin dueño efectivo nunca son
cinco.

### D-5 aparte: esto no es una errata, es una trampa

`src/db/client.ts`, líneas 22 y 25:

```ts
const driver = process.env.DB_DRIVER ?? 'neon';
…
  driver === 'pg' ? drizzlePg(…) : drizzleNeon(neon(connectionString), { schema });
```

Sólo `pg` desvía. **Todo lo demás cae en Neon, en silencio**: sin excepción, sin aviso, sin log.
Y el documento maestro le dice al recién llegado que escriba **`DB_DRIVER=postgres-js`** «en local
y e2e». Quien lo copie creyendo que apunta a su Postgres local **acaba hablando con el de
producción y no se entera** — con la `DATABASE_URL` que tenga a mano, que en este proyecto es
compartida entre Production y Preview (**F-SPEC-023-1**).

Son **dos defectos superpuestos**, y conviene no confundirlos:

1. **El documento nombra valores que no existen.** Eso lo arregla **CA-3**, y además lo arregla
   *para siempre*: los valores pasan a derivarse del módulo que los decide.
2. **El módulo acepta cualquier cosa y no se queja.** Eso es un defecto de `src/`, y **entra
   también en esta spec** (**CA-14**) **por decisión del humano en el gate del 2026-09-03**, contra
   mi recomendación de partirlo en spec propia (§Notas pto. 3). Arreglar sólo (1) quitaría la
   trampa que puso el documento pero **no** la que pone el código a quien escriba `postgress` con
   dos eses.

## La pregunta de diseño: qué se puede derivar, qué se puede vigilar y qué es prosa

Corregir once frases cuesta una tarde y **se vuelve a romper en tres meses**, porque nada obliga a
nadie a mirar. Pero la salida contraria —una guardia que congele el documento— es peor: acaba en
un test que hay que aflojar cada vez que alguien redacta mejor una frase, y una guardia que
molesta acaba desactivada. Así que la frontera hay que ponerla, y por escrito.

**La regla que sale de las once**: las once son **la misma avería**. El documento **copió un valor
cuyo dueño es otro fichero**, y el dueño siguió su camino. La cura no es «actualizar la copia» —eso
es lo que hay que dejar de hacer— sino, para cada afirmación, elegir uno de tres tratamientos:

**Nivel 1 — DERIVABLE.** El valor es pequeño, cerrado, load-bearing para quien lea el documento, y
existe un artefacto que **un proceso real consume** del que se puede sacar mecánicamente. Entonces
el documento **sí** lo escribe, y **una guardia compara las dos mitades derivándolas: el test no
teclea el valor**. Es literalmente **SPEC-059 CA-4** (el runbook y `vercel.json`), y aquí aplica a
tres cosas: la **versión del framework** (contra `package.json`, que es lo que CI instala), la
**existencia de cada fichero citado** (contra el sistema de ficheros) y los **valores de
`DB_DRIVER`** (contra `src/db/client.ts`, que es quien decide). Coste aceptado: la guardia se pone
roja en la rama de quien suba el *major* de Next o toque el driver. Eso es **un verdadero
positivo con arreglo de una línea**, no el rojo sin defecto detrás que FOUNDATION prohíbe, y la
mano que lo enciende es la de un acto deliberado y specado, nunca «la de cualquiera que trabaje en
otra spec» (**ADR-037**).

**Nivel 2 — DELEGABLE.** El valor tiene dueño, pero copiarlo no compra nada porque el dueño ya lo
documenta mejor. Entonces el documento **no lo escribe: nombra al dueño**, y así no hay nada que
pueda envejecer. Es **SPEC-059 CA-5** (*«no copies el valor, nombra a su dueño»*) y aquí aplica a
la **lista de claves de entorno** → `.env.example`, al **censo de ADR** → `docs/adr/` y al
**estado de specs y épicas** → `docs/tablero.md` y el frontmatter. **Sin guardia nueva, y con
motivo**: FOUNDATION (1.º corolario) dice con estas palabras que *«un `.env.example` no lo lee
ningún proceso, es documentación para humanos… leerlo no compra nada y cuesta el acoplamiento
entero»*; y la lista **ya tiene guardia en su dueño** —`tests/spec-031-frontera.test.ts` CA-13.3
la mantiene cerrada en once con su contador—, así que una tercera copia sólo añadiría un sitio más
donde envejecer.

**Nivel 3 — PROSA IRREDUCIBLE.** *«El scheduler está implementado»*, *«el aislamiento es en capa
de app y no RLS»*, *«el proveedor de precios pasó a plan de pago»*. No hay predicado mecánico que
las decida, y fabricar uno significa congelar redacción. **No se vigilan**: se corrigen, y se
revisan en el diff del gate. Lo único que se les exige es que **no lleven dentro una copia de
Nivel 1 o 2** — por eso el scheduler se describe **sin teclear su hora** (**ADR-039** pto. 8), y
eso sí es guardable con un detector que ya existe.

**Lo que se rechaza a propósito**, porque va a proponerlo alguien: una guardia de **frescura** (un
`Actualizado: <fecha>` que se ponga rojo pasados N días). Se pone roja **sin defecto detrás**, que
es la peor clase de rojo (FOUNDATION, 3.ª convención), y su reparación barata es tocar la fecha
sin leer el documento — o sea, verde vacío con ceremonia.

**Y la advertencia que SPEC-059 pagó**: un detector escrito en bruto acusa al documento o al módulo
que vigila. Aquí eso es concreto y está medido, no es una moraleja: un detector de *«nombre seguido
de número»* acusaría a `ADR-020`, `D-7`, `RN-16`, `SPEC-023`, `10.000/mes`, `30 min`, `~82%` y
`2026-08-23`, **todos dentro del propio `contexto.md`**; y un barrido de franjas horarias sobre
`tests/` acusaría a `tests/ops-snapshot.test.ts` y `tests/e2e/admin-grifo.spec.ts` —donde `22:00`
es un **timestamp de fixture**, dato legítimo— y a `tests/spec059-hora-del-ciclo.ts`, que lleva
`'El aviso sale a las 22:00…'` **como espécimen de su propia guardia**. Tres inocentes por tres
culpables: la misma aritmética que **ADR-037** documenta. Por eso **CA-9 no lleva guardia**, y se
dice aquí en vez de descubrirse en la ronda roja.

## Usuarios / roles afectados

- **Todo agente y toda persona que entre al proyecto**: `contexto.md` es su paso 2 obligatorio
  (`CLAUDE.md`). Es quien paga las once afirmaciones falsas, y quien cobra la corrección.
- **sdd-arquitecto** — dueño de `docs/fundacion/contexto.md` y de esta spec.
- **sdd-producto** — dueño de `docs/epicas/EPIC-008-…/_epica.md` (**CA-11**) y de `docs/roadmap.md`
  (que ya se curó en `20ffd72` y **no se toca**).
- **sdd-implementador** — ejecuta. Toca **un** fichero de `src/` (`src/db/client.ts`, **CA-14**) y
  por eso la entrega **sube versión** (**CA-12**).

## Criterios de aceptación

> **Cómo leer los CA que traen guardia.** Cada uno enuncia la **propiedad**, no la forma prohibida
> (FOUNDATION, 2.º corolario), y trae **los especímenes mínimos de los dos sentidos escritos aquí**
> — lo que la guardia debe cazar y lo que **no** debe cazar (ADR-026 §7). Los especímenes **no son
> elección del implementador**: se transcriben. Molde vivo y reciente: `tests/spec059-hora-del-ciclo.ts`
> junto a su `.test.ts`, con los detectores en un módulo aparte y ejercitados **antes** de aplicarse
> al árbol.
>
> **Dónde viven las guardias nuevas**: `tests/spec060-contexto-veraz.ts` (detectores + especímenes)
> y `tests/spec060-contexto-veraz.test.ts`. **Sujeto único: `docs/fundacion/contexto.md`.** Ninguna
> se aplica a `docs/fundacion/` en bloque ni a `tests/` en bloque; el porqué está arriba y es la
> parte que más caro sale si se ignora.
>
> **CA-1 a CA-3 son Nivel 1** (guardia que deriva las dos mitades). **CA-4 a CA-8, CA-9 y CA-11 son
> Nivel 2 o 3** (sin guardia, con el motivo escrito). **CA-5** reutiliza un detector que ya existe
> y no añade ninguno. **CA-14 no es de ningún nivel**: los niveles clasifican afirmaciones de un
> documento, y CA-14 arregla **el código** del que CA-3 deriva — es la otra mitad de D-5.
>
> **CA-14 lleva ese número, y no el 4, a propósito.** Entró en el **gate del 2026-09-03**, cuando
> los trece ya estaban escritos y referenciados entre sí y en las notas; renumerarlos habría
> movido diez referencias para no ganar nada. Se coloca **aquí**, junto a CA-3, porque es donde se
> lee: los dos hablan del mismo módulo y el segundo cambia lo que el primero obliga a escribir.

### Nivel 1 — lo que se deriva, y el módulo del que se deriva

- **CA-1 (la versión del framework se afirma sólo si se puede derivar).** Dado que `contexto.md`
  dice hoy *«Next.js 15 App Router (React 19)»* y que `package.json` declara `next` en `^16.2.10`,
  entonces, tras esta entrega, **ninguna versión que el documento atribuya a una dependencia
  declarada en `package.json` difiere de la declarada allí**, y la guardia lo comprueba
  **derivando las dos mitades**: los nombres salen de `package.json` (más un mapa de alias de
  prosa declarado y comentado, p. ej. `next-auth` ↔ *Auth.js* / *NextAuth*) y las versiones
  también; **el test no teclea `16` ni ningún otro número de versión**.
  La comparación es **por *major***, que es lo que el documento tiene sentido que afirme: `^16.2.10`
  satisface *«Next.js 16»* y ningún parche futuro pone esto rojo.
  **Centinela de no-vacuidad**: si del documento real no se extrae **ninguna** pareja
  (paquete, versión), el caso se pone **rojo** — un documento que dejó de nombrar su *stack* no
  puede dar verde por vacío.
  **Eficacia en los dos sentidos**, con los especímenes mínimos: **debe cazar** `Next.js 15`,
  `React 18` y `Auth.js v4`; **no debe cazar** `Next.js 16`, `React 19`, `Auth.js v5`, `Drizzle ORM`
  (sin número) ni —y esto es lo que hay que probar de verdad, porque son texto real del documento
  vigilado— `ADR-020`, `D-7`, `RN-16`, `SPEC-023`, `10.000/mes`, `30 min`, `~82%` y `2026-08-23`.
  **Coste asumido y declarado**: subir Next de *major* pondrá esto rojo en la rama que lo suba. Es
  deliberado —un *major* de framework es una spec entera, nunca un cambio al paso (**SPEC-009**,
  **ADR-008**)— y el arreglo es una palabra.

- **CA-2 (toda cita del documento apunta a algo que existe).** Dado que el documento cita hoy
  `src/middleware.ts`, que **no existe**, entonces tras esta entrega **toda ruta del repositorio y
  todo identificador `ADR-nnn` / `SPEC-nnn` / `EPIC-nnn` que el documento cite corresponde a algo
  presente en el árbol**, y la guardia lo comprueba contra el sistema de ficheros: **conjunto
  esperado de citas rotas, vacío** — la forma que FOUNDATION declara superviviente al crecimiento
  del árbol, y la que hace que esto no caduque cuando el documento crezca.
  Un directorio cuenta como existente. Para que la comprobación sea posible, **las rutas se
  escriben enteras desde la raíz del repositorio** (`src/app/api/auth/[...nextauth]/route.ts`, no
  `api/auth/[...nextauth]/route.ts`); es un requisito de contenido y forma parte de este CA.
  **Centinela de no-vacuidad**: si no se extrae ninguna cita, **rojo**.
  **Eficacia en los dos sentidos**: **debe cazar** `src/middleware.ts` (la cita muerta de hoy) y
  `ADR-013` (identificador con forma válida que **nunca existió**); **no debe cazar**
  `src/proxy.ts`, `src/db/client.ts`, `design/tremen-ds`, `.env.example`, `docs/tablero.md`,
  `ADR-039`, `SPEC-059`, `EPIC-008`, ni los patrones con comodín como `tests/*.test.ts` —que
  describen una familia, no un fichero, y **se saltan a propósito**— ni los identificadores de
  regla o decisión `RN-16`, `RI-03`, `D-2`, `CE-1`, `F-SPEC-023-1`, que **no son ficheros** y no
  entran en el barrido.

- **CA-3 (`DB_DRIVER`: el documento nombra los valores que el código reconoce, y dice qué pasa con
  los demás).** Dado que el documento dice hoy `neon-http` y `postgres-js` y que `src/db/client.ts`
  reconoce `neon` y `pg`, entonces:
  1. **El conjunto de valores que el documento atribuye a `DB_DRIVER` coincide con el que
     `src/db/client.ts` reconoce**, y **las dos mitades se derivan**: la del código, leyéndolo; la
     del documento, extrayéndola de su texto. **Ningún literal de driver se teclea en el test.**
     **Centinela doble**: si cualquiera de las dos mitades sale vacía, **rojo** — comparar dos
     vacíos es verde sin haber mirado.
     Para que la mitad del código sea derivable sin adivinar, **CA-14 exige que el módulo tenga un
     único sitio donde vive el conjunto reconocido**, y ese sitio es del que sale esta mitad. La
     propiedad es *«los valores que el módulo reconoce»*, no una forma sintáctica concreta: si
     mañana el módulo los declara de otra manera, el extractor se re-encuadra — lo que **no** se
     admite es escribirlos en el test.
  2. **El documento dice, en prosa, qué pasa con cada caso**, y tras **CA-14** son **tres**, no dos:
     ausente → Neon (el valor por defecto); `pg` → Postgres estándar; **cualquier otra cosa →
     falla al arrancar, nombrando la clave y el fichero**. Sin guardia (es Nivel 3): se revisa en el
     diff del gate. Es la mitad que impide que el lector se fíe del nombre que escribió de memoria.
     **Ojo al orden**: esta prosa sólo es cierta **después** de CA-14. Las dos van en la misma
     entrega y no se pueden separar sin dejar el documento mintiendo otra vez, ahora al revés.
  **Eficacia en los dos sentidos** para la mitad mecánica: el extractor del código, aplicado a un
  módulo sintético que reconozca `neon` y `pg`, **devuelve exactamente `{neon, pg}`**; aplicado a
  uno que reconozca además `postgres-js`, **lo devuelve** —o sea, **sigue al código y no a esta
  spec**, que es lo que hace que la guardia sobreviva a un driver nuevo—; aplicado a un módulo que
  no reconozca ninguno, **devuelve vacío y el centinela lo pone rojo**. Y el par completo: con el
  documento de hoy (`neon-http` / `postgres-js`) el caso está **rojo**; con el corregido, **verde**.

- **CA-14 (un `DB_DRIVER` que el código no reconoce falla al arrancar, en vez de irse a producción
  en silencio).** Dado que `src/db/client.ts` hace hoy `process.env.DB_DRIVER ?? 'neon'` y
  `driver === 'pg' ? … : neon`, de modo que **sólo `pg` desvía y todo lo demás cae en Neon sin
  excepción, sin aviso y sin log**, entonces:
  1. **Ausente sigue significando `neon`.** Ni una diferencia de comportamiento: es lo que corre en
     producción hoy y lo que va a seguir corriendo.
  2. **Un valor reconocido se comporta como hoy.** `pg` sigue llevando a Postgres estándar; el e2e
     —único sitio del repositorio que define la variable— **no cambia una línea y sigue verde**.
  3. **Un valor presente y no reconocido lanza**, y el error trae las cuatro cosas que quien
     arranca necesita: **la clave** (`DB_DRIVER`), **el valor recibido** delimitado, **los valores
     que sí se reconocen** —tomados del mismo sitio del que los toma la decisión, no de una segunda
     lista— y **dónde mirar** (`.env.example`, `src/db/client.ts`). Molde exacto y aprobado:
     `src/lib/config/app-url.ts` (**SPEC-055**), que rechaza el valor envenenado *«con sujeto»* en
     vez de estallar río abajo con un `Invalid URL` mudo.
  4. **El conjunto de valores reconocidos vive en un solo sitio del módulo**, y de ahí salen **la
     decisión, el mensaje de error y la mitad del código de CA-3**. Es **ADR-040** pto. 1 aplicado
     al propio arreglo: si el mensaje repitiera la lista, la entrega que cura una copia nacería con
     otra dentro.
  **Eficacia en los dos sentidos**, con los especímenes mínimos escritos aquí: **debe lanzar** con
  `postgres-js` (el valor que el documento lleva recomendando), con `neon-http`, con `postgress`
  (el typo) y con `PG` en mayúsculas —no se normaliza: reconocer `PG` sería adivinar la intención,
  y adivinar es lo que trajo el defecto—; **no debe lanzar** con la variable **ausente**, con
  `neon` ni con `pg`. El mensaje, en los cuatro rechazos, **nombra la clave y el fichero**.

  **Por qué fail-closed, con el riesgo delante.** El idioma de la casa es fallar cerrado
  —`authorizeCron` deniega sin secreto configurado (*fail-closed* escrito en el propio comentario),
  `scripts/guard-migrate.mjs` corta el build *«por omisión, NO migra: falla»*, `appBaseUrl()` lanza
  ante un valor que no es un origen absoluto—, y la pregunta legítima es si romper el arranque por
  un typo en una variable puede tumbar producción. **Medido, no supuesto, sobre este árbol:**
  - **En producción `DB_DRIVER` no está definida.** No aparece en `vercel.json`, ni en los workflows
    de `.github/`, y en `.env.example` está **comentada**. El **único** sitio del repositorio que la
    define es `tests/e2e/server.mjs` (`DB_DRIVER: 'pg'`). Con la variable ausente, la rama nueva
    **no se puede alcanzar**: sólo lanza cuando alguien **escribió** un valor a propósito, que es
    exactamente el caso en que cree estar apuntando a un sitio y está apuntando a otro.
  - **No es una clase de fallo nueva en este fichero.** El módulo **ya lanza al importarse** si
    falta `DATABASE_URL` (*«DATABASE_URL no definida. Configúrala (ver .env.example)»*), y lleva así
    desde ADR-001 sin haber tumbado nada. CA-14 no abre una puerta: ensancha en una condición la
    que ya estaba abierta, con el mismo tono de mensaje.
  - **Y si algún día se alcanzara en un build de producción** —alguien define la variable en Vercel
    con un typo—, el `&&` del `buildCommand` corta, **el build falla y se queda viva la versión
    anterior**. Es la protección que `guard-migrate` documenta, y es estrictamente mejor que el
    desenlace de hoy: un despliegue **vivo** escribiendo en la base de producción mientras su autor
    cree estar en local, con la `DATABASE_URL` compartida entre Production y Preview
    (**F-SPEC-023-1**).
  - **La alternativa —avisar y seguir— se rechaza**: es el statu quo con camisa nueva. Una línea de
    log en una función *serverless* que nadie lee no impide la escritura, y aquí lo que hay que
    impedir es la escritura. *Decir el motivo* (SPEC-016, SPEC-043) es requisito **del rechazo**, no
    su sustituto.
  **Esto NO lleva ADR, y la ausencia es una decisión** (ADR-040 pto. 5): no constriñe trabajo
  futuro más de lo que ya lo constriñen los tres precedentes citados — es **aplicar** un idioma
  existente a un módulo, no adoptarlo. El precedente de alcance es **SPEC-055**, que resolvió un
  caso de la **misma forma** (variable de entorno envenenada que degradaba en silencio) con
  decisiones escritas **dentro de la spec** y **sin ADR**.

### Nivel 2 y 3 — lo que se delega o se corrige sin guardia

- **CA-4 (las claves de entorno dejan de vivir en tres sitios).** Dado que el documento enumera hoy
  dos de las **once** claves que `.env.example` declara —y que la que trae los precios de verdad,
  `MARKETSTACK_API_KEY` (**ADR-012**), no está—, entonces el documento **deja de enumerarlas y
  nombra a `.env.example`**, que ya las documenta una a una con su ADR y su porqué. La propiedad:
  **añadir o quitar una clave de entorno no obliga a editar `contexto.md`**.
  Puede seguir nombrando una clave concreta cuando la prosa la necesite para explicar una decisión
  (p. ej. `APP_BASE_URL` y por qué el enlace no sale del `Host`); lo que desaparece es **la lista**.
  **Sin guardia nueva, y por dos razones que no son pereza**: FOUNDATION (1.º corolario) dice que
  `.env.example` **no lo lee ningún proceso** y que aseverar sobre él *«no compra nada y cuesta el
  acoplamiento entero»*; y la lista **ya tiene guardia en su dueño** —`tests/spec-031-frontera.test.ts`
  CA-13.3, cerrada en once con contador propio—, de modo que una clave nueva ya no puede entrar sin
  pasar por un gate. Verificable por revisión del diff.

- **CA-5 (el scheduler se describe como lo que es, sin teclear su hora).** Dado que el documento
  dice *«Scheduler previsto… aún no implementado»* y que el ciclo lleva vivo desde **SPEC-004**,
  entonces esa afirmación desaparece y en su lugar el documento describe **el mecanismo que hay**:
  Vercel Cron declarado en `vercel.json`, endpoint `src/app/api/cron/refresh/route.ts` protegido por
  `CRON_SECRET`, constancia por ejecución en `cron_runs` (**ADR-023**), cadencia y base en
  **ADR-004**, y la hora fijada por **ADR-039** / **SPEC-059**.
  Y lo describe **sin teclear la hora**: **ADR-039 pto. 8** — *quien la cita la nombra por su
  dueño*. Verificable con el detector que **ya existe**, `copiasDelSchedule` de
  `tests/spec059-hora-del-ciclo.ts`, aplicado a `contexto.md`: **conjunto esperado vacío**. Esta
  spec **no añade detector nuevo ni especímenes nuevos**: los dos sentidos ya están probados en la
  misma batería por SPEC-059 CA-5, y duplicarlos sería una segunda copia de la regla.
  **El detector se aplica a `contexto.md` y a nada más.** Ampliarlo a `docs/fundacion/` pondría
  roja la entrada *«Refresco bajo demanda»* de `dominio.md`, que cita el cron viejo **en pasado**
  y que **SPEC-059 CA-10 protege expresamente**. Acusar al registro histórico es el pisotón, no un
  efecto colateral.

- **CA-6 (el documento deja de ser un tablero).** Dado que hoy narra *«EPIC-001 en curso»*,
  *«SPEC-003 en `borrador`»* y *«faltan por crear: Ingesta, Motor de disparo, Notificaciones y UI»*
  —tres afirmaciones falsas sobre trabajo terminado hace treinta y seis specs—, entonces el
  documento **deja de afirmar el estado de ninguna spec ni de ninguna épica** y **nombra a su
  dueño**: `docs/tablero.md` (generado, nunca editado a mano), el frontmatter de cada spec y el
  ledger de cada una. Lo que conserva es lo que **no decae**: qué es el producto, qué invariantes lo
  gobiernan y **dónde vive cada verdad**.
  **Sin guardia, y con motivo**: vigilar esto exigiría o congelar prosa —el test que hay que
  aflojar cada vez que alguien redacta mejor— o enumerar `docs/epicas/`, que es un directorio que
  otros hacen crecer y cuya mano roja sería *«la de cualquiera que trabaje en otra spec»*
  (**ADR-037**, literal). Verificable por revisión del diff en el gate.

- **CA-7 (el as-built vuelve a describir la aplicación que hay).** Dado que la sección *«Stack y
  arquitectura (resumen as-built)»* describe la aplicación de **SPEC-023** —tres rutas de las diez
  que hay, `password_reset_tokens` como *«tabla nueva»*, y **ninguna** de las capas de mercado,
  disparo, avisos, cartera, vigiladas, import, operación, ayuda, legal, versión ni feedback—,
  entonces la sección nombra **las capas que existen** y **cita a `src/db/schema.ts` como dueño del
  esquema** en vez de calificar de *nueva* a una tabla de julio.
  Corrige además, en la misma sección, **D-1** (CA-1), **D-2** (CA-2), **D-5** (CA-3) y **D-4**
  (CA-4), que viven todas ahí.
  **Sin guardia**: exigir que toda carpeta de `src/lib/` aparezca nombrada sería enumerar un
  directorio que crece por mano ajena — **ADR-037** otra vez, y con el mismo desenlace.

- **CA-8 (riesgos y salvedades: o se dicen con su desenlace, o se delegan).** Dado que el documento
  cierra afirmando que **R-2**, **R-3** y **R-4** siguen *«pendientes de spec»* cuando las tres
  están cerradas —R-2 por **SPEC-003**, R-3 por **ADR-004** y **ADR-039**, R-4 por **ADR-006** /
  **SPEC-006** y **ADR-036** / **SPEC-056**—, y que enumera salvedades de SPEC-001 y SPEC-023 cuyo
  estado vive en sus ledgers, entonces:
  - **lo que es as-built se queda como as-built**: el contenido de R-1 sobre el proveedor de precios
    —Marketstack (**ADR-012**), plan Basic de pago (**ADR-032**), presupuesto medido en
    `símbolos × ciclos` (**ADR-027**)— es descripción del sistema, no un riesgo abierto, y sube a la
    sección de arquitectura con sus ADR;
  - **lo que es estado se delega** a quien lo posee: los riesgos de épica al `_epica.md` de
    **EPIC-001** (de sdd-producto), las salvedades a los ledgers de sus specs;
  - **ninguna pregunta cerrada se sigue presentando como abierta**.
  **Sin guardia** (mismo motivo que CA-6). Verificable por revisión del diff.

- **CA-9 (los tres rótulos caducados de `tests/`, en este lote).** Dado que tres comentarios siguen
  hablando del *«ciclo de las 22:00»* después de **SPEC-059** —`tests/spec043-sin-refrescar.test.ts:69`,
  `tests/e2e/spec058-alta-con-precio.spec.ts:82` y `tests/spec058-alta-con-precio.test.ts:302`—,
  ninguno afecta a lo que su test vigila y los tres están verdes, entonces esta entrega los ajusta
  para que **describan la cadencia y no la hora**, y **los tres tests siguen verdes sin que cambie
  una sola aserción**.
  Entran aquí por **ADR-025**: un rótulo caducado descubierto tras el cierre **no reabre** la spec
  cerrada; *«cuelga de una spec viva que ya toque esa superficie, o espera en EPIC-FIX a un lote»*.
  **Ésta es ese lote**, y es el sitio natural: misma causa (**ADR-039** pto. 8), mismo día, misma
  épica.
  **Sin guardia, y el motivo está medido**: un barrido de franjas horarias sobre `tests/` acusaría a
  `tests/ops-snapshot.test.ts` y `tests/e2e/admin-grifo.spec.ts` —donde `22:00` es un **timestamp de
  fixture**, dato legítimo y ajeno a la hora del ciclo— y a `tests/spec059-hora-del-ciclo.ts`, que
  lleva *«El aviso sale a las 22:00…»* **como espécimen de su propia guardia**. Tres inocentes por
  tres culpables. Verificable por revisión del diff y por la batería en verde.

- **CA-10 (la evidencia histórica no se reescribe).** Dado que ledgers cerrados, ADR y entradas
  fechadas de `docs/fundacion/dominio.md` citan la hora vieja **en pasado** y como evidencia de lo
  que se verificó ese día, entonces **el diff de la rama no los toca**. Eran ciertos cuando se
  escribieron; reescribirlos falsearía el registro, y el registro es lo que permitió encontrar
  estos once defectos. Mismo criterio, palabra por palabra, que **SPEC-059 CA-10**.
  Tampoco se toca `docs/roadmap.md`, que ya se curó en `20ffd72`, ni `vercel.json`, que ya declara
  la hora buena desde el merge de la PR #69.
  Es **criterio de gate** (**RI-03**), verificable con `git diff --name-only origin/main...HEAD`, y
  **no lleva guardia** — enumerar en un test los ficheros intocables es justo lo que **ADR-037**
  documenta como *«dos escaladas al humano, seis rondas de rol, cero defectos reales cazados»*.

- **CA-11 (EPIC-008 deja de afirmar en presente lo que ya no es verdad).** Dado que
  `docs/epicas/EPIC-008-…/_epica.md` dice *«El **único** refresco **es** el cron `0 22 * * *`»*, en
  presente y **falso por dos vías** —la hora se movió (**SPEC-059**) y `quotes` tiene **dos
  escritores** desde **SPEC-058** (**ADR-038**)—, entonces esa sección **se enmarca como pasado
  fechado**, con la misma cura que `docs/roadmap.md` recibió en `20ffd72`: un marcador explícito de
  *«esto describe el estado ANTES de SPEC-058»*, **sin reescribir el análisis** ni tocar la cita del
  usuario.
  **La salvedad, resuelta y no esquivada.** El encabezado de la sección —*«El roce, observado sobre
  la pantalla real (2026-08-25)»*— fecha **la observación del roce**, y por un momento parece que
  salva el párrafo. **No lo salva**, por tres motivos: (1) la lista va introducida por *«La mecánica
  que lo produce **está medida**»*, en presente y fuera de la cita; (2) el roadmap tenía el **mismo**
  texto con el **mismo** encuadre y su autor juzgó que necesitaba marcador explícito — hacer aquí lo
  contrario dejaría dos documentos hermanos diciendo cosas distintas sobre el mismo hecho; y (3) lo
  que aquí se afirma no es sólo una hora vieja sino **la unicidad del escritor**, que **ADR-038**
  derogó: eso no lo fecha ningún encabezado.
  **El fichero es de sdd-producto, no mío**, así que hacía falta permiso: **concedido en el gate
  del 2026-09-03** por Alberto Fojo, que acepta el razonamiento de los tres puntos y da el mismo
  permiso que **SPEC-059 CA-9** obtuvo para el roadmap (allí el humano autorizó que la spec de FIX
  curase un documento de sdd-producto porque era *«una línea factual, no una revisión de la
  intención»*, y separarlo *«sólo garantizaría que se quedase sin hacer»*). **Sin guardia** (mismo
  motivo que CA-6).

- **CA-12 (la entrega toca `src/`, así que la versión SÍ sube, y sube *patch*).** Dado que el gate
  del **2026-09-03** metió **CA-14** en el alcance y que eso hace que la entrega modifique
  `src/db/client.ts` —ruta vigilada por el gate de versión (`.sdd.json` → `rutasVigiladas`, con
  `src/` como suelo en `scripts/check-version-bump.mjs`)—, entonces **la versión sube**, y sube
  **patch**: CA-14 **cierra una vía de fallo de una promesa ya entregada** —*«el cliente de datos
  es intercambiable por `DB_DRIVER`»*— en vez de añadir alcance; mismo criterio que **SPEC-043**,
  **SPEC-055** y **SPEC-059**.
  `package.json` y `package-lock.json` van en el **mismo commit** (**ADR-033**, que enmienda el
  pto. 8 de **ADR-024**), y `npm run version:check` se ejecuta **con el árbol limpio**
  (**SPEC-049**: sobre árbol sucio se abstiene, y **un verde de abstención no es un verde** — es el
  fallo que costó un verde vacío citado como evidencia).
  Se dice explícitamente, y con el porqué, **para que el implementador no lo adivine**: hasta el
  gate esta spec era puramente documental y **no** subía versión. **Cambió por decisión del humano,
  no por descubrimiento técnico**; si CA-14 saliera del alcance, este CA volvería a invertirse.
  Nada de lo demás que toca la entrega mueve el gate: `docs/` y `tests/` **no** son rutas vigiladas
  —lo comprueba el propio `tests/version-bump-gate.test.ts` en su caso *«editar docs, tests o el
  `package.json` del bump no dispara nada»*—, así que **el bump lo justifica un solo fichero**.

- **CA-13 (el documento abre diciendo dónde vive cada verdad).** Dado que las once averías nacen de
  que el documento **guardaba copias** sin decir de quién, entonces `contexto.md` incorpora, cerca
  de su cabecera, un **mapa de dueños** corto y explícito: estado de specs y épicas →
  `docs/tablero.md` y el frontmatter; censo de decisiones → `docs/adr/`; claves de entorno →
  `.env.example`; esquema → `src/db/schema.ts`; hora y cadencia del ciclo → `vercel.json` y
  **ADR-004**/**ADR-039**; versión de producto → `package.json`; reglas de negocio e ingeniería →
  `docs/fundacion/reglas.md`; términos → `docs/fundacion/dominio.md`.
  Es lo único de esta entrega que **impide la próxima avería en vez de curar la de hoy**: quien vaya
  a escribir una copia se topa con el dueño antes que con el hueco.
  Sus rutas quedan cubiertas por **CA-2** (existen de verdad); el mapa en sí es prosa y **no lleva
  guardia propia**.

## Entidades y reglas afectadas

- **Ninguna entidad de dominio cambia.** No hay esquema, no hay migración, no hay dato tocado.
  **CA-14 tampoco lo hace**: cambia **cuándo se rechaza un arranque mal configurado**, no qué se
  guarda ni cómo. La forma de conectarse a Neon y a Postgres estándar es la misma que hoy.
- **Ninguna RN cambia.** `RN-16` y `RN-17` se **citan** al describir el ciclo y el refresco bajo
  demanda; no se tocan.
- **RI-01** — **no aplica**: CA-14 no toca el esquema ni las migraciones, así que no hay nada
  *expand/contract* que partir en dos despliegues.
- **RI-03** — CA-10 es criterio de gate declarado como tal, con evidencia al ledger y **sin**
  guardia permanente. CA-1, CA-2, CA-3 y CA-14 son **propiedades**: ciertas sobre el estado del
  árbol en cualquier momento, con conjunto esperado vacío o derivado de las dos mitades.
- **ADR-001** (`RED-1`) — dueño de la promesa *«cliente de datos intercambiable por `DB_DRIVER`»*
  que CA-14 deja de incumplir en silencio. No se reinterpreta: se hace cumplible.
- **SPEC-055** — precedente de forma y de alcance para **CA-14**: variable de entorno envenenada
  que degradaba en silencio, arreglada **con rechazo que nombra la clave y el fichero** y **sin
  ADR**, con las decisiones escritas dentro de la spec.
- **ADR-025** — es lo que autoriza a **CA-9**: un rótulo caducado no reabre una spec cerrada; se
  agrupa en un lote de EPIC-FIX. Éste.
- **ADR-037** — es lo que **prohíbe** las guardias que CA-6, CA-7, CA-8, CA-9 y CA-11 declaran no
  escribir. Se cita por nombre en cada uno para que la ausencia sea una decisión y no un olvido.
- **ADR-039 pto. 8** — *la hora se escribe una vez y quien la cita nombra a su dueño*. **CA-5** lo
  aplica al contexto maestro; **ADR-040** (propuesto) lo generaliza más allá de la hora.
- **ADR-008** — dueño de la decisión *«línea 16.x de Next.js»*, que es lo que **D-1** contradecía.
- **ADR-012**, **ADR-027**, **ADR-032** — dueños de lo que CA-8 sube de *riesgo* a *as-built*.
- **ADR-023**, **ADR-004** — el ciclo y su constancia, que es lo que CA-5 describe.
- **ADR-038** — *dos escritores de `quotes`*, la segunda falsedad de **CA-11**.
- **ADR-033** / **ADR-024** / **SPEC-049** — gobiernan **CA-12**: hay bump **patch**, los dos
  ficheros de versión van en el mismo commit y el `version:check` se ejecuta con el árbol limpio.
- **FOUNDATION**, 1.º, 2.º y 3.er corolario — gobiernan la frontera entera: qué se puede leer, cómo
  se enuncian los CA y qué no puede ser un test. Se citan literalmente donde deciden algo.
- **Dominio** (`docs/fundacion/dominio.md`): **ningún término nuevo**, y **ninguna entrada tocada**
  (CA-10).

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **`vercel.json`.** Ya declara `0 6 * * *` desde el merge de la PR #69 (**SPEC-059**). No se toca,
  ni para «confirmar».
- **`docs/roadmap.md`.** Curado en `20ffd72`. No se toca.
- **Cualquier otro cambio en `src/db/client.ts` que no sea el rechazo de CA-14.** No se toca la
  forma de conectar, ni los parámetros de `postgres()`, ni se añade un tercer driver, ni se mueve
  el módulo. **Un fichero de `src/`, una condición.** El bump de CA-12 lo paga ese cambio y sólo
  ese; cualquier otra cosa que aparezca ahí en el diff es alcance colado.
- **Validar ninguna otra variable de entorno.** `DB_DRIVER` entra porque su valor inválido manda a
  producción en silencio. `AUTH_SECRET`, `CRON_SECRET`, `RESEND_FROM` y las demás **no se tocan**;
  el día que alguna lo pida, será por su propio motivo medido y en su propia spec.
- **Cerrar EPIC-002, EPIC-003 y EPIC-004**, que tienen todas sus specs en `hecho`. Cerrar una épica
  es gate humano y va aparte.
- **El símbolo `TPG0`** y **las filas huérfanas de `quotes`** (`PHM`, `IPH`). Otros asuntos, ya
  reportados, ya fuera del alcance de SPEC-059 y siguen fuera.
- **Revisar `dominio.md`, `reglas.md` o `vision.md`** en busca del mismo mal. Puede haberlo; medirlo
  es otra spec, y meterlo aquí haría esta entrega inabarcable. Si el gate lo quiere, es un residual
  con nombre, no un CA colado.
- **Una guardia de frescura** por fecha de última revisión. Rechazada por escrito arriba.
- **Reescribir `contexto.md` entero de cero.** Se corrige y se reordena lo que las once averías
  piden; lo que es cierto y sigue sirviendo (visión, invariantes, decisiones de SPEC-001, ADR-015 y
  ADR-016) se conserva tal cual.

## Notas para el gate humano

1. **La premisa del encargo tenía un dato viejo, y conviene que conste.** El encargo decía que
   **PR #69 no estaba mergeada** y que por eso `main` seguía con `0 22 * * *`. **Está mergeada**
   (`a781ce7`, *Merge pull request #69*), `main` está limpio y `vercel.json` ya dice `0 6 * * *`.
   Consecuencias buenas: (a) no hay nada que hacer con `vercel.json`, la restricción se cumple
   sola; (b) `tests/spec059-hora-del-ciclo.ts` **está en `main`**, así que **CA-5 puede reutilizar
   su detector sin dependencia entre ramas** — si no lo estuviera, esta spec habría nacido
   bloqueada o con un detector duplicado, que era el riesgo real.

2. **Lo que se pide aprobar, en una línea**: corregir once afirmaciones falsas del documento que
   todo el mundo lee primero, y **cambiar la forma en que ese documento guarda la verdad** para que
   no se vuelva a romper — derivando tres cosas, delegando otras tres y dejando la prosa como prosa,
   con el motivo escrito en cada caso.

3. **DECIDIDO EN EL GATE (2026-09-03) — el *fallback* silencioso ENTRA: es CA-14.** Se pedía
   decisión sobre `F-SPEC-060-1` y **el humano la tomó contra mi recomendación**: leyó el argumento
   —que tocar el arranque de la conexión en *runtime* merecía gate propio— y **prefiere una sola
   pasada**. Queda registrado así, con el disenso escrito, que es como se registran aquí las
   decisiones del gate; y **no se rediscute**.
   Lo que la decisión arrastra, ya ejecutado en el texto: **CA-14** nuevo; **CA-12 invertido** (la
   entrega toca `src/`, sube versión **patch**); **CA-3 pto. 2 reescrito**, porque tras CA-14 los
   desenlaces de `DB_DRIVER` son **tres** y no dos —y el documento tenía que decir el nuevo, no el
   viejo—; §Fuera de alcance acotado para que *«un fichero de `src/`»* no se convierta en dos.
   **El diseño del arreglo es mío, y es fail-closed**: ausente → `neon` (sin cambio); `pg` → sin
   cambio; **presente y no reconocido → lanza**, nombrando clave, valor, valores reconocidos y
   fichero. El riesgo de *«un typo tumba producción»* se miró de frente y **no se materializa aquí**,
   por tres hechos medidos sobre este árbol y escritos dentro de CA-14: en producción la variable
   **no está definida** (sólo la define `tests/e2e/server.mjs`), el módulo **ya lanza al importarse**
   si falta `DATABASE_URL` desde ADR-001, y un fallo en build **corta el `&&` y deja viva la versión
   anterior**. La alternativa de *avisar y seguir* se rechaza por escrito: no impide la escritura,
   que es lo único que hay que impedir.
   **CA-14 no lleva ADR, y la ausencia es deliberada** (ADR-040 pto. 5): aplica un idioma que ya
   existe —`authorizeCron`, `guard-migrate.mjs`, `appBaseUrl()`— a un módulo, y el precedente de
   alcance es **SPEC-055**, misma forma de defecto resuelta **sin ADR**.

4. **DECIDIDO EN EL GATE (2026-09-03) — CA-11 se queda.** El humano acepta el argumento de que el
   encabezado fechado **no salva** el párrafo de `_epica.md`, y concede el mismo permiso que
   **SPEC-059 CA-9** obtuvo para el roadmap: esta spec cura el `_epica.md` de **EPIC-008**, que es
   de sdd-producto. Los tres motivos de esa conclusión siguen escritos dentro del CA, para que
   quien verifique pueda comprobarlos en vez de fiarse.

5. **DECIDIDO EN EL GATE (2026-09-03) — ADR-040 aprobado**, sin enmiendas al texto, por **Alberto
   Fojo**, y así queda en su línea `Deciders`. La frontera —Nivel 1 deriva, Nivel 2 delega, Nivel 3
   es prosa y no se vigila— pasa a ser **decisión del proyecto** y no doctrina de esta spec: obliga
   a lo que se escriba en `docs/fundacion/` de aquí en adelante y da respuesta escrita a
   *«¿esto se puede vigilar?»*, que hasta hoy se contestaba de memoria.

6. **Lo que esta spec NO puede prometer, dicho antes de que se note.** Las guardias cubren **tres**
   de las once averías del documento (D-1, D-2, D-5) — y con **CA-14** se cierra además el **daño**
   de D-5, que es lo que el gate compró al meterlo: el documento deja de recomendar un valor
   inválido **y** el código deja de aceptarlo. Las otras ocho averías son prosa o delegación: se
   curan hoy y su defensa es **estructural** —el documento deja de guardar lo que envejece— más el
   **mapa de dueños** de CA-13. No hay test que impida escribir una frase falsa sobre el estado del
   proyecto, y **fabricar uno sería peor que no tenerlo**: congelaría redacción y acabaría aflojado.
   Esto se dice aquí para que no se lea la entrega como una garantía mecánica sobre las once.

7. **Coste declarado de CA-1.** El día que alguien suba Next de *major*, su rama se pondrá roja por
   una palabra en un documento. Es deliberado y es barato; si el gate lo considera un peaje
   inaceptable, la alternativa es quitar el número del documento (Nivel 2 puro: *«la versión la
   declara `package.json`»*) y perder una información que hoy orienta bien. **Mi recomendación es
   mantener el número, precisamente porque ahora está vigilado.**

8. **Verificación esperada**: batería completa en verde (`npm test`), **e2e** (`npm run test:e2e`,
   que es quien ejerce la rama `pg` de CA-14 de verdad: `tests/e2e/server.mjs` es el único sitio del
   repositorio que define `DB_DRIVER`), `npm run lint`, `npm run typecheck`, y
   `npm run version:check` **con el árbol limpio** y **con el bump ya commiteado** (**CA-12**;
   sobre árbol sucio se abstiene y un verde de abstención no es un verde, **SPEC-049**). Más la
   revisión del diff para los CA sin guardia (4, 6, 7, 8, 9, 10, 11, 13) y para
   `git diff --name-only origin/main...HEAD` en CA-10.
   **No hay CA de observación post-deploy** —no se cambia ningún comportamiento observable en
   producción: con `DB_DRIVER` ausente, que es como corre allí, la rama nueva es inalcanzable—,
   pero **sí aplica RI-02 como a toda entrega**: `hecho` significa merge en `main` **y** despliegue
   vivo, con la puerta de despliegue en verde y su evidencia en el ledger. Ahora pesa un poco más
   que de costumbre, porque lo que cambia es **el arranque**: si el despliegue vive, la rama nueva
   no se disparó, que es exactamente lo que CA-14 pto. 1 promete.
