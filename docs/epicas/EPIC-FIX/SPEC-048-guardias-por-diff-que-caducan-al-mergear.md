---
id: SPEC-048
tipo: spec
epica: EPIC-FIX
estado: aprobada
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-22, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-22, por: humano (Alberto Fojo)}
---
# SPEC-048 — Guardias por diff que caducan al mergear: `main` vuelve a verde y no puede volver a romperse sola

## Problema

**`main` está en rojo y no se recupera solo.** Al mergear la PR #52 (SPEC-047, el
icono) la CI de `main` se puso roja —run
[32583255349](https://github.com/tremen-dev/stockeiro/actions/runs/32583255349),
job `Checks` → `Unit tests`; `E2E` pasó— y seguirá roja en cada push mientras
nadie toque nada, porque **el defecto no está en el producto: está en la forma de
tres aserciones**.

Reproducido en este árbol antes de escribir esto
(`npx vitest run tests/icono-frontera.test.ts tests/icono-guardias-ampliadas.test.ts`
→ **3 failed | 26 passed**):

| # | Fichero | Caso | Error |
|---|---|---|---|
| R-1 | `tests/icono-frontera.test.ts` | *«el guardián de sesión cambia en una sola línea de código: la del matcher»* (SPEC-047 CA-16) | `se ha quitado más de una línea de código: expected [] to have a length of 1 but got +0` |
| R-2 | `tests/icono-frontera.test.ts` | *«el diff sobre tests/ añade ficheros y casos, y sólo modifica las tres guardias»* (SPEC-047 CA-18) | `un CUARTO fichero ajeno modificado es RED: expected [] to deeply equal [ 'tests/cuenta-rutas.test.ts', …(2) ]` |
| R-3 | `tests/icono-guardias-ampliadas.test.ts` | *«el diff sobre tests/ no modifica ningún fichero ajeno fuera de esas tres»* (SPEC-047 CA-19.1) | igual que R-2 |

### La causa

Los dos ficheros declaran `const BASE = 'origin/main'` y construyen sus
aserciones sobre `git diff origin/main...HEAD`. Mientras la rama estaba sin
mergear, ese diff contenía la línea del matcher de `src/proxy.ts` y los tres
ficheros de test ampliados, y los tres casos pasaban. **Al mergear, `origin/main`
pasó a incluir el propio cambio, el diff quedó vacío y las aserciones se
invirtieron.** No pueden volver a ser ciertas nunca: no hay commit futuro que las
arregle.

El fondo es de naturaleza, no de descuido. CA-16, CA-18 y CA-19 de SPEC-047 eran
criterios **de gate** —*«este cambio está bien acotado»*— y se codificaron como
tests **permanentes** —*«el código es correcto»*—. Un criterio sobre un cambio
sólo es cierto mientras el cambio no se ha integrado. Es el **quinto** incidente
de esta familia en el proyecto y el primero que ocurre **después** de que
`FOUNDATION.md` § *Cómo se trabaja aquí* fijara la convención (2026-08-20,
`F-SPEC-034-6`). Esa convención dice cómo **reparar** una guardia caducada; no
decía dónde **nace** un criterio de gate. Eso es lo que decide **ADR-031**.

### Lo que el rojo tapa: doce verdes vacíos

De los 26 casos que hoy pasan en esos dos ficheros, **doce pasan sin mirar
nada**: dependen del mismo diff vacío o del mismo `git show origin/main:<f>`, que
tras el merge devuelve exactamente lo que hay en el árbol. *«No se toca ni un
fichero fuera del conjunto pactado»* sobre una lista vacía es verde. *«El caso de
ahora es byte a byte el de `origin/main`»* es verde por definición. **Son gates
vacíos presentándose como verdes**, y esa es la mitad silenciosa —y peor— del
mismo defecto. Inventario completo en §Entidades y reglas afectadas.

### Qué NO está roto, y por qué importa

El valor duradero de las tres aserciones rojas **ya está cubierto por sus
hermanas basadas en estado**, que miden que las listas y los literales siguen
**cerrados** y no el diff, y que están **en verde en `main` ahora mismo**:
`tests/legal-rutas-publicas.test.ts` (SPEC-035 CA-2), `tests/cuenta-rutas.test.ts`
(SPEC-036 CA-10) y `tests/deploy-gate-workflow.test.ts` (SPEC-028 CA-9.3). Esta
spec **no las toca**. Lo que se pierde si se borran las rojas no es cobertura de
propiedad: es **auditoría** —la comprobación de que aquella entrega estuvo
acotada—, y el humano decidió el 2026-08-22 conservarla.

## Usuarios / roles afectados

- **sdd-verificador y el humano en el gate.** Son los primeros perjudicados: un
  rojo permanente sin defecto detrás destruye la señal. Con `main` roja por esto,
  el siguiente rojo de verdad no se distingue del ruido, y **RI-02** (*"hecho"
  significa "vivo"*) queda contaminada: el verde de `main` y la puerta post-deploy
  son la evidencia que se pega en cada ledger.
- **sdd-implementador de cualquier spec futura.** Hoy no tiene forma de saber, al
  escribir una guardia de frontera, si lo que escribe caduca al mergear. Después
  de esta spec la tiene, y automática.
- **El usuario final: indirectamente y de verdad.** Un CI en rojo crónico es un CI
  que se deja de mirar, y ese es el camino corto a que un defecto real llegue a
  producción con testers dentro (EPIC-004 está entera en `hecho`).

## Criterios de aceptación

> Todos los CA se verifican con `npm run test`. **Ninguno** exige despliegue.
> Las aserciones nuevas o re-encuadradas obedecen **ADR-031** pto. 2 en sus
> cuatro condiciones (ventana fija, centinela, salto declarado, porqué al lado).

### La ventana de la entrega de SPEC-047

- **CA-1** — Dado que SPEC-047 se entregó en un rango de commits que ya no puede
  cambiar, cuando la suite necesita mirar aquel diff, entonces lo mira sobre una
  **ventana de dos sha fijos declarada en una constante con nombre**:
  `antes = 6da9fbe` (`main` justo antes del merge, es decir `104f94e^1`) y
  `despues = 104f94e` (el merge de la PR #52). Ninguna revisión móvil
  —`origin/main`, `main`, `HEAD`, `@`— aparece como argumento de revisión de git
  en los dos ficheros afectados.
- **CA-2** — *Centinela de no-vacuidad.* Dado que una ventana mal escrita dejaría
  todo el bloque en verde sin haber mirado nada, cuando se evalúa la ventana,
  entonces un caso propio afirma que **contiene lo que la entrega sí trajo**: al
  menos `src/app/icon.svg`, `scripts/build-icon.mjs` y `src/proxy.ts` están entre
  los ficheros del rango. Si la ventana quedara vacía, **este caso es rojo**.
- **CA-3** — *Salto declarado, y prohibido en CI.* Dado un clon superficial en el
  que alguno de los dos sha no exista, cuando se ejecutan los bloques anclados,
  entonces se saltan (`describe.skipIf`) en vez de fallar; **y** un caso siempre
  activo afirma que **el salto no ha ocurrido cuando la variable de entorno `CI`
  está definida**. Un verde en CI no puede provenir de un bloque saltado.

### Los tres rojos: qué se hace con cada uno

- **CA-4** — Dado **R-1** (`tests/icono-frontera.test.ts`, *«el guardián de sesión
  cambia en una sola línea de código: la del matcher»*), cuando se ejecuta,
  entonces **se re-encuadra sobre la ventana de CA-1 y vuelve a ser verde**,
  afirmando lo mismo que afirmaba: en aquella entrega, el diff de `src/proxy.ts`
  quitó **exactamente una** línea de código y añadió **exactamente una**, y las
  dos contienen `matcher`. No se borra: el hecho sigue siendo cierto y sigue
  siendo comprobable.
- **CA-5** — Dado **R-2** (`tests/icono-frontera.test.ts`, CA-18, *«el diff sobre
  tests/ … sólo modifica las tres guardias»*), cuando se ejecuta, entonces **se
  re-encuadra sobre la ventana y vuelve a ser verde**: en aquella entrega los
  únicos ficheros de `tests/` **modificados** —no añadidos— fueron
  `tests/cuenta-rutas.test.ts`, `tests/deploy-gate-workflow.test.ts` y
  `tests/legal-rutas-publicas.test.ts`, exactamente los tres que el arbitraje del
  humano del 2026-08-22 autorizó.
- **CA-6** — Dado **R-3** (`tests/icono-guardias-ampliadas.test.ts`, CA-19.1,
  misma afirmación que R-2 desde el lado de CA-19), cuando se ejecuta, entonces
  **se re-encuadra sobre la misma ventana y vuelve a ser verde**. Se conserva y no
  se funde con CA-5: son dos CA distintos de SPEC-047 y cada uno responde en su
  fichero. Los dos leen la **misma** ventana, y un caso afirma que los dos sha
  declarados en ambos ficheros **coinciden**.

### Los doce verdes vacíos

- **CA-7** — Dado el inventario de §Entidades (12 aserciones que hoy pasan sobre
  un diff vacío o sobre un blob idéntico al del árbol), cuando se ejecuta la
  suite, entonces **todas miran la ventana de CA-1** y **ninguna queda pasando por
  vacuidad**. Se demuestra caso a caso: para cada una, la misma comparación
  evaluada contra una **entrada mutada** —un fichero de más en la lista, un byte
  de más en el blob— **la rechaza**. Es la disciplina que SPEC-047 CA-19.3 aplicó
  a las tres guardias ajenas; aquí se aplica a las suyas propias.
- **CA-8** — Dado que un re-encuadre sin explicación es indistinguible de una
  aflojada, cuando se lee cualquier aserción tocada por CA-4…CA-7, entonces junto
  a ella está escrito, dentro del mismo caso: **qué vigilaba antes**, **qué vigila
  ahora**, la **fecha** (`2026-08-22`), que lo arbitró el **humano** y el **CA de
  esta spec** que lo autoriza. Un caso propio lo comprueba sobre el texto, con el
  mismo mecanismo que SPEC-047 CA-19.2 usó contra las guardias ajenas.

### El corazón: que el arreglo no vuelva a caducar

- **CA-9** — *Prueba de no-caducidad por merge simulado.* Dado un futuro en el que
  `main` ha avanzado por encima de la entrega de SPEC-047, cuando se evalúan las
  aserciones re-encuadradas **en ese futuro**, entonces **su veredicto es
  idéntico**. Se prueba, no se argumenta:
  - **CA-9.1** — La prueba construye un repositorio temporal (clon o *worktree*
    desechable) sobre el que se añade al menos un commit posterior a `104f94e`
    que **habría invertido la formulación vieja**: toca `src/proxy.ts` y modifica
    un **cuarto** fichero ajeno de `tests/`. **No muta el repositorio real**: al
    terminar, el árbol de trabajo y los refs quedan como estaban.
  - **CA-9.2** — Evaluadas ahí, las aserciones de CA-4, CA-5 y CA-6 **siguen
    verdes** y devuelven **exactamente los mismos valores** que en el árbol
    actual.
  - **CA-9.3** — *Control negativo, sin el cual esto no prueba nada.* La
    **formulación vieja** —la que usa `origin/main...HEAD`— evaluada en ese mismo
    futuro simulado **falla**. Si el control no falla, el escenario no reproduce
    la caducidad y el caso es **rojo**.
  - **CA-9.4** — Junto a la aserción queda escrito que **este es el caso que
    impide repetir el error de SPEC-047**, citando ADR-031 pto. 2.

### La regla, y la guardia que la hace cumplible

- **CA-10** — Dado que la convención de `FOUNDATION.md` aguantó dos días sin
  mecanismo, cuando se recorre `tests/**/*.test.ts`, entonces **una meta-guardia
  falla si alguna invocación de git que alimenta una aserción toma una revisión
  móvil** (`origin/main`, `main`, `HEAD`, `@`) como argumento de revisión de
  `git diff`, `git show` o `git log`/`rev-list`. Condiciones:
  - **CA-10.1** — Se juzga **código**, no prosa: los comentarios se descartan
    antes de mirar (precedente: `sinComentarios` en
    `tests/icono-guardias-ampliadas.test.ts`). Una mención en un comentario, en un
    título de `describe` o en un mensaje de aserción **no** es infracción.
  - **CA-10.2** — No se prohíbe `git` en los tests ni `HEAD` en general: siguen
    siendo legítimos `git rev-parse HEAD` para obtener el sha actual
    (`tests/version-build-identity.test.ts`) y pasar `HEAD` como **entrada** a un
    script bajo prueba (`tests/version-bump-gate.test.ts`). La regla es sobre
    **revisiones de diff/show/log**, no sobre el uso de git.
  - **CA-10.3** — La meta-guardia se prueba a sí misma: aplicada a un fragmento de
    fuente **sintético** que contiene la infracción, la detecta; aplicada a otro
    que sólo la menciona en un comentario, no.
  - **CA-10.4** — Con el árbol tal y como queda tras esta spec, la meta-guardia
    **encuentra cero infracciones** — lo que incluye, y ése es el cierre del
    círculo, los dos ficheros de SPEC-047.
- **CA-11** — Dado que las reglas de ingeniería de este proyecto viven en
  `docs/fundacion/reglas.md` § *Reglas de ingeniería (RI-xx)* y su fuente es
  siempre un ADR, cuando se aprueba **ADR-031**, entonces se escribe **RI-03** en
  esa sección, con: qué distingue un criterio de gate de una propiedad, las cuatro
  condiciones de la guardia anclada, el mecanismo que la hace cumplible (CA-10) y
  su fuente (**ADR-031**). Un caso lo comprueba, al estilo de lo que
  `tests/reglas-ingenieria.test.ts` hace con RI-01, **sin tocar ese fichero**: la
  serie RI no está congelada en él y RI-03 entra sin romper nada (verificado en el
  árbol).
- **CA-12** — Dado que el defecto se detectó en `main` y no en la PR, cuando esta
  rama se mergee, entonces **el CI de `main` queda verde**: `npm run test`
  completo sin fallos y sin ningún bloque saltado (CA-3). Es el criterio que
  cierra el problema tal y como se enunció.

### Criterios de **gate**, no de suite

> Coherencia con ADR-031 pto. 1: los siguientes son criterios sobre **este
> cambio** y por eso **no se codifican como tests permanentes**. Los verifica el
> gate y su evidencia va al **ledger**. Escribirlos como tests sería repetir en
> SPEC-048 el error que SPEC-048 viene a arreglar.

- **CA-G1** — El diff de esta entrega **no toca** `src/`, `drizzle/`,
  `vercel.json`, `.github/workflows/` ni las dependencias de `package.json`.
  Consecuencia buscada: **no hace falta subir la versión** —`.sdd.json` declara
  `rutasVigiladas: ["src/", "app/"]` y `scripts/check-version-bump.mjs` sólo exige
  bump si el diff las toca—, y el step `Version bump` pasa sin intervención.
- **CA-G2** — El diff **no modifica** ninguna de las tres hermanas por estado
  (`tests/legal-rutas-publicas.test.ts`, `tests/cuenta-rutas.test.ts`,
  `tests/deploy-gate-workflow.test.ts`) ni ninguno de los seis sitios que el
  barrido declaró sanos (§Entidades). Los únicos ficheros de `tests/`
  **modificados** son los dos de SPEC-047; lo demás son altas.
- **CA-G3** — El verificador deja en el ledger la salida de `npm run test`
  **antes y después**, y la del control negativo de CA-9.3, para que el gate vea
  con sus ojos que el escenario simulado sí reproduce la caducidad.

## Entidades y reglas afectadas

### Reglas y decisiones

- **ADR-031** (nuevo, en `borrador`, se aprueba en este mismo gate) — *«Un
  criterio sobre un cambio se verifica en el gate; si se queda en la suite, nace
  anclado a una ventana de dos sha fijos»*. Es la fuente de RI-03 y el origen de
  CA-1…CA-10.
- **RI-03** (nuevo, CA-11) en `docs/fundacion/reglas.md`. Fuente: ADR-031.
- **RI-02** (*"hecho" significa "vivo"*, fuente ADR-018 D-7) — no cambia, pero es
  la damnificada: se apoya en el verde de `main`.
- **ADR-025** — una spec en `hecho` **no se reabre**. SPEC-047 sigue en `hecho` y
  esta spec **no la reabre**: el defecto se arregla desde **EPIC-FIX**, que es
  exactamente el vehículo que ADR-025 nombra. Lo que se toca son **sus guardias**,
  con el arbitraje escrito antes de ejecutarse (CA-8), tal como `FOUNDATION.md`
  exige.
- **FOUNDATION.md § *Cómo se trabaja aquí*** — las dos salidas legítimas
  (re-encuadrar / borrar) y las dos condiciones (queda escrito qué vigilaba antes
  y qué vigila ahora; quien lo toca no es quien se beneficia). Esta spec elige
  **re-encuadrar** en los tres casos, por decisión del humano del 2026-08-22.
- **CE-F1** (EPIC-FIX) — *la promesa se restaura y se prueba, sin regresión*. La
  promesa restaurada aquí es la del propio CI: que su rojo signifique algo.
- **RN-xx**: ninguna. Esta spec no toca dominio ni datos; es salud de la suite.

### Ficheros que esta spec modifica

**`tests/icono-frontera.test.ts`** (SPEC-047) — un helper y ocho casos dependen de
`origin/main`:

| Caso | Estado hoy | CA |
|---|---|---|
| helper `tocados()` (`origin/main...HEAD`) | base de casi todo lo demás | CA-1 |
| CA-16 *«no se toca ni un fichero fuera del conjunto pactado»* | verde vacío | CA-7 |
| CA-16 *«ni un dato, ni un cálculo, ni una regla: nada bajo src/db, drizzle o src/lib»* | verde vacío | CA-7 |
| CA-16 *«la evidencia de otras specs es suya»* | verde vacío | CA-7 |
| CA-16 *«el guardián de sesión cambia en una sola línea»* | **ROJO (R-1)** | CA-4 |
| CA-4 *«no nace ningún fichero bajo public/»* | verde vacío | CA-7 |
| CA-17 *«no entra ninguna dependencia nueva»* (`git show origin/main:package.json`) | verde vacío | CA-7 |
| CA-18 *«el diff sobre tests/ … sólo modifica las tres guardias»* | **ROJO (R-2)** | CA-5 |
| CA-18 *«los dos verdes que CA-18 cita … siguen sin tocarse»* | verde vacío | CA-7 |

**`tests/icono-guardias-ampliadas.test.ts`** (SPEC-047) — un helper y siete casos:

| Caso | Estado hoy | CA |
|---|---|---|
| helper `fuenteEnMain()` (`git show origin/main:<f>`) | base de seis casos | CA-1 |
| CA-19.1 *«el diff sobre tests/ no modifica ningún fichero ajeno»* | **ROJO (R-3)** | CA-6 |
| CA-19.1 *«el único caso que cambia es el ampliado»* ×3 ficheros | verde vacío ×3 | CA-7 |
| CA-19.4 *«la hermana … sigue byte a byte como estaba»* ×3 ficheros | verde vacío ×3 | CA-7 |

Los bloques **CA-19.2** y **CA-19.3** de ese fichero leen **sólo el árbol actual**
y son sanos: no se tocan.

**Altas**: el test de la meta-guardia y de la no-caducidad (CA-9, CA-10) —nombre a
elección del implementador, en `tests/`—; **RI-03** en `docs/fundacion/reglas.md`;
**ADR-031** en `docs/adr/`.

### El barrido: todo lo que en este árbol compara contra una revisión de git

Recorridos `tests/`, `scripts/`, `src/` y `.github/workflows/`. **Ocho** sitios
tocan `origin/main` o una revisión de git; **dos** tienen el defecto y son los de
arriba. Los seis restantes se **aparcan a propósito**, con su motivo:

| Sitio | Veredicto | Motivo |
|---|---|---|
| `tests/deploy-gate-workflow.test.ts` (SPEC-028 CA-9) | **sano — aparcado** | Ya usa ventana fija `de3a6ee…0d389c8` con su `baseDisponible()`. Único residuo: el **título** del `describe` (l. 467) sigue diciendo *«el diff contra origin/main»* y engaña al lector. Es prosa, en fichero **ajeno y sano**, y **no se toca sin arbitraje** → §Notas para el gate humano, pto. 4. |
| `tests/neon-preview-cleanup-workflow.test.ts` (SPEC-042 CA-1) | **sano** | Es el **molde** de esta spec: ventana `124085a`/`31bb01b`, `hayVentana()`, centinela de no-vacuidad y un caso borrado con su motivo escrito en el sitio. Sólo menciona `origin/main` en comentarios. |
| `tests/spec-031-frontera.test.ts` | **sano** | Convirtió el criterio en **propiedad**: literales congelados de `vercel.json` y `.env.example`, sin git de por medio. `origin/main` aparece sólo en comentarios que explican por qué. |
| `tests/version-bump-gate.test.ts` (SPEC-038 CA-13) | **sano, y además es la dependencia** | No compara nada por su cuenta: afirma que el job `Checks` lleva `fetch-depth: 0`, que es justo lo que hace alcanzable un sha histórico en CI. `origin/main` aparece en un **mensaje** de aserción; `HEAD` se pasa como **entrada** al script bajo prueba. Sin este test, todas las ventanas ancladas se saltarían en silencio. |
| `tests/version-build-channel.test.ts` | **sano** | Menciona `origin/main` en un comentario que justifica por qué `check-version-bump.mjs` está en la lista cerrada de lectores de `package.json`. No invoca git. |
| `tests/version-build-identity.test.ts` | **sano** | `git rev-parse HEAD` para obtener el sha actual y contrastarlo con el que reporta la identidad. Es una **propiedad** cierta en cualquier `HEAD`, no un diff. |
| `scripts/check-version-bump.mjs` (`BASE_POR_DEFECTO = 'origin/main'`) | **sano — y es el ejemplo positivo** | Es un **criterio de gate puro** y **debe** comparar contra `origin/main`: lo que juzga es el delta de la rama. Que tras el merge su diff quede vacío y salga 0 es **correcto** — ya no hay nada que exigir. Vive en `scripts/`, lo invoca un step propio de CI, no la suite. ADR-031 pto. 1.3 lo cita como molde. |
| `.github/workflows/ci.yml` | **sano** | La mención está en el comentario que justifica `fetch-depth: 0`. **No se toca.** |

**Conclusión del barrido:** no hay más guardias caducadas ni caducables en el
árbol. Las dos defectuosas son las de SPEC-047 y entran enteras en esta spec; lo
demás está bien por construcción, y el único residuo es un título engañoso que se
aparca con nombre y apellidos.

## Fuera de alcance

- **Tocar las tres hermanas por estado.** `tests/legal-rutas-publicas.test.ts`
  (SPEC-035 CA-2), `tests/cuenta-rutas.test.ts` (SPEC-036 CA-10) y
  `tests/deploy-gate-workflow.test.ts` (SPEC-028 CA-9.3) están en verde y miden
  propiedades cerradas. No se rozan (CA-G2).
- **Arreglar el título del `describe` de `tests/deploy-gate-workflow.test.ts`.**
  Aparcado a propósito: fichero ajeno y sano, y la convención de `FOUNDATION.md`
  dice que la conversación ocurre **antes** de tocarlo. Se lleva al gate como
  pregunta (§Notas, pto. 4).
- **Revisar `scripts/check-version-bump.mjs`.** Su comparación contra
  `origin/main` es correcta por naturaleza. No se cambia ni una línea.
- **Reabrir SPEC-047.** Sigue en `hecho`. Se tocan sus guardias desde EPIC-FIX,
  que es lo que ADR-025 prescribe.
- **Cualquier cambio en `src/`, `drizzle/`, `vercel.json` o los workflows.**
  Ninguno hace falta (CA-G1). Si el implementador cree que sí, es RED: escala al
  gate en vez de tocarlo.
- **Un `lint` que prohíba `origin/main` en todo el repositorio.** La meta-guardia
  de CA-10 mira `tests/`, que es donde el defecto hace daño. Extenderla a
  `scripts/` sería falso: ahí la comparación contra `origin/main` es lo correcto.
- **Añadir ventanas ancladas a specs pasadas que hoy no las tienen.** No hay
  ninguna que las necesite (barrido), y hacerlo por gusto es inventar alcance.
- **Regenerar el tablero.** Es de `sdd-documentalista` al cierre, no de aquí.

## Notas para el gate humano

1. **La decisión de fondo ya la tomaste** (2026-08-22): re-encuadrar con el patrón
   de SPEC-042, no borrar, para conservar el valor de auditoría. Todo lo demás
   cuelga de ahí. Si prefieres borrar los tres, CA-4, CA-5, CA-6 y CA-7 cambian de
   forma y ADR-031 hay que reescribirlo.
2. **Aprobar esta spec es aprobar también ADR-031**, que es lo que constriñe a
   todas las specs futuras. Lo que te ata: *un criterio con forma de «este cambio
   está acotado» no se codifica como test permanente; y si se queda en la suite
   por auditoría, nace con ventana fija, centinela, salto declarado y su porqué al
   lado*. Es una carga real sobre cada spec que escriba una guardia de frontera —
   míralo con lupa, porque es la parte que no se deshace fácil.
3. **El barrido dice que no hay más defecto latente que el de SPEC-047.** Los otros
   seis sitios están bien por construcción y quedan aparcados con su motivo
   escrito. Si eso te parece optimista, el sitio para apretar es **CA-10.4**: hoy
   afirma cero infracciones tras la spec, y esa afirmación pasa a ser automática y
   permanente.
4. **La pregunta que te traigo, y que no toco sin tu palabra:** el título del
   bloque de `tests/deploy-gate-workflow.test.ts:467` dice *«SPEC-028 CA-9: y el
   diff contra origin/main no toca lo que no debe»* cuando su mecanismo es, desde
   SPEC-034, una ventana fija. El título miente sobre lo que el test hace, y es lo
   primero que lee quien vaya a copiar el patrón. **¿Autorizas cambiar esa única
   línea de prosa** —fichero ajeno, cero cambios de comportamiento, con el porqué
   escrito al lado según CA-8—, o se queda como está y sólo se documenta en
   ADR-031?
5. **CA-9 es el corazón y también lo más caro.** Construir un futuro simulado en un
   repositorio temporal es la única forma honesta de probar que el arreglo no
   caduca; el atajo —*«confía, la ventana es fija»*— es exactamente el
   razonamiento que produjo este rojo. Cuesta unos segundos de suite y algo de
   fontanería con git. Si te parece demasiado, dilo aquí: es la parte que yo no
   recortaría.
6. **Riesgo aceptado y declarado en ADR-031:** anclar a sha ata la suite al
   histórico de git. Un squash o una migración de repositorio invalidarían todas
   las ventanas a la vez. El `skipIf` lo convierte en salto y CA-3 lo hace visible
   en CI, pero conviene que lo sepas antes de firmar.
7. **Esta spec no exige subir la versión** (no toca `rutasVigiladas`) y **no exige
   despliegue** para verificarse. Cierra cuando `main` esté verde (CA-12); **RI-02**
   se aplica igual, con la puerta post-deploy del merge.
