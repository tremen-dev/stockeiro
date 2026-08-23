---
id: SPEC-049
tipo: spec
epica: EPIC-FIX
estado: hecho
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-23, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-23, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-23, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-08-23, por: sdd-verificador}
---
# SPEC-049 — El gate de versión no dice verde sobre un árbol sucio: si lo que juzga no está commiteado, se abstiene

## Problema

**`scripts/check-version-bump.mjs` devuelve `0` cuando no ha mirado nada, y ese `0`
es indistinguible del `0` que significa «todo en orden».** No es un matiz teórico:
ocurrió hoy, 2026-08-23, en la PR #56, y el `0` se consumió como evidencia en un
mensaje de commit y en el cuerpo de una PR antes de que la CI dijera lo contrario
sobre exactamente los mismos ficheros.

### El mecanismo, con los números de línea confirmados en este árbol

El gate juzga **commits**: `git diff --name-only ${base}...HEAD`
(`scripts/check-version-bump.mjs:327`). Cuando se ejecuta con los cambios todavía en
el árbol de trabajo y sin commitear, ese rango está **vacío**: `evaluar` recibe
`ficheros: []`, `tocados.length === 0`, y devuelve la rama `sin-codigo` →
`SALIDA.LIMPIO` (`:247-254`), que `main` imprime por `stdout` y devuelve como `0`
(`:393-397`):

```
[check-version-bump] Base: origin/main.
[check-version-bump] El diff no toca codigo de aplicacion: no hay nada que subir.
```

**Reproducido en este árbol antes de escribir esto** (rama
`docs/SPEC-049-gate-de-version-sobre-arbol-sucio`, `origin/main` = `90d79e1`,
versión `0.3.2`):

| # | Estado del árbol | `node scripts/check-version-bump.mjs` | Salida |
|---|---|---|---|
| R-0 | limpio | `El diff no toca codigo de aplicacion: no hay nada que subir.` | **0** — correcto |
| R-1 | + `src/__spec049-repro.ts` sin seguimiento | **el mismo mensaje, byte a byte** | **0** — **falso verde** |

El fichero de prueba se retiró acto seguido; el árbol quedó limpio. R-1 es el
defecto: el gate afirma *«el diff no toca código de aplicación»* mientras hay un
fichero bajo `src/` esperando a entrar en el commit siguiente.

### Cómo se pagó, en la PR #56

Está escrito por el propio autor en el commit **`3f62762`** (*«chore(version):
0.3.1 -> 0.3.2»*), que es el commit de reparación:

> *«El gate de ADR-024 tiene razon y yo me equivoque al darlo por verde: lo ejecute
> antes de commitear, con HEAD todavia en origin/main, asi que el rango de diff
> estaba vacio y el gate no tenia nada que mirar.»*

Y el `0` ya había viajado como prueba: el commit anterior, **`395e908`**, cierra su
mensaje con *«Son comentarios: sin cambio de comportamiento, **y check-version-bump
lo confirma**»*. No confirmaba nada. La CI tumbó la rama después, con el gate
diciendo lo contrario sobre `src/app/legal/terminos/page.tsx`,
`src/lib/legal/content.ts` y `src/lib/market/marketstack-provider.ts`.

**Esa es la forma exacta del daño**: no es que el operador pierda un rato mirando un
rojo. Es que el gate **produce una afirmación falsa que se cita**, y la cita
sobrevive al `git commit`. Un rojo tardío es una molestia; un verde vacío es una
mentira firmada.

### La mitad silenciosa: el test que lo cubría también estaba vacío

`tests/version-bump-gate.test.ts:270-275`, caso *«esta rama pasa el gate: toca
código de aplicación y sube el número»*, ejecuta el script **contra la propia
rama**. Con la rama todavía sin commits, ese caso pasa por la misma razón por la que
el gate salió 0: **no había nada que mirar**. El mismo commit `3f62762` lo dice:

> *«Lo mismo explica que tests/version-bump-gate.test.ts pasara en local — ese test
> corre el gate contra la propia rama, y en local la rama aun no existia como
> commit.»*

Es decir: el fallo pasó inadvertido **dentro de una suite en verde**. Es la misma
patología que `ADR-031` nombró el 2026-08-22 —*«un gate vacío que se presenta como
verde»*— llegando por una puerta que ADR-031 no cubrió.

Y hay un segundo caso afectado que el encargo no nombraba y conviene tener delante:
**`:265-268`**, *«comparada consigo misma no hay diff, así que pasa»*
(`--base HEAD`). Con `--base HEAD` las dos versiones son idénticas por
construcción, así que cualquier arreglo que se plante ante código pendiente lo toca
también. Son **dos** casos, no uno.

### Por qué esto es un defecto del gate y no «usarlo mal»

Tres hechos del propio repositorio, verificados hoy:

1. **La guardia ya existe, pero está puesta en un solo sentido.** La ayuda del
   script dice *«Juzga COMMITS, no el arbol de trabajo»* (`:98-99`), y en la rama de
   **fallo** el script sí mira el árbol para avisar: *«Ojo: en el arbol de trabajo ya
   pone X, pero todavia no esta commiteado»* (`:405-419`). O sea: el script **ya
   sabe** que el operador se adelanta al commit, y ya tiene el código para mirarlo.
   Avisa si te adelantaste con **la versión**; no avisa si te adelantaste con **el
   código**. El sentido no cubierto es justo el que produce el falso verde — y es el
   peligroso, porque el otro solo te acompaña hacia un rojo que ibas a tener igual.

2. **El principio ya está escrito y testado, para el caso hermano.**
   `tests/version-bump-gate.test.ts:259-263` afirma, literalmente: *«una base que no
   existe es un error de USO (2): un gate que no puede comparar NO dice verde»*. Y la
   cabecera del script lo eleva a contrato: *«El 2 es deliberado y no se degrada a 0:
   **un gate que no puede comparar no dice verde**»* (`:48-51`). Se cubrió *«no hay
   base»* y se dejó fuera *«hay base, pero lo que quieres juzgar todavía no está en
   ningún commit»*. **Misma clase de imposibilidad, misma consecuencia**: no hay con
   qué formar un veredicto.

3. **El proyecto ya rechazó este modo de fallo en el script de al lado, firmado por
   el humano.** La cabecera de `scripts/scan-destructive-sql.mjs:14-21` explica por
   qué escanea todo siempre en vez de «lo nuevo de la PR»: una implementación por
   diff *«necesita una rama base: no existe en un `push` a `main`, **se comporta
   distinto en local**, depende de la profundidad del clonado y muere en un
   worktree»*. Desvío firmado por el humano en el gate del **2026-08-18**.
   `check-version-bump.mjs` es el **único** script de gate que se quedó sin esa
   lección — y «se comporta distinto en local» describe con precisión lo que pasó
   hoy.

### Lo que este defecto NO es

No es que comparar contra `origin/main` esté mal. **RI-03** cita este script como el
**molde** de un criterio de gate bien puesto —*«`scripts/check-version-bump.mjs`, que
compara contra `origin/main` y **debe** hacerlo»*— y SPEC-048 lo dejó explícitamente
fuera de alcance: *«Su comparación contra `origin/main` es correcta por naturaleza.
No se cambia ni una línea»*. Todo eso sigue en pie. Lo que esta spec arregla no es
**contra qué** compara el gate: es **cuándo tiene derecho a hablar**.

## Usuarios / roles afectados

- **Quien va a pushear (implementador, arquitecto, el humano).** Es la víctima
  directa: ejecuta el gate de buena fe, recibe un `0` y lo escribe como evidencia.
  El coste no es el rojo posterior, es haber afirmado algo falso por escrito.
- **sdd-verificador.** Su GREEN es *«sobre el árbol de trabajo y antes del merge»*
  (**RI-02**). Un gate que en el árbol de trabajo devuelve un verde vacío es
  exactamente la herramienta que no puede usar, y hoy nada se lo dice.
- **El humano en el gate.** Lee mensajes de commit y cuerpos de PR que citan salidas
  de scripts. Si un `0` puede significar dos cosas, la evidencia que le llega no es
  evidencia.
- **El operador a mitad de spec.** Rol de primer orden en esta spec, y no como
  víctima sino como **restricción de diseño**: trabaja con `src/` sucio durante horas
  y ejecuta la suite muchas veces. Un arreglo que lo deje en rojo permanente acabaría
  desactivado, y eso es peor que el defecto que arregla.
- **La CI.** No cambia en nada: el checkout es limpio por construcción, así que en el
  runner el veredicto de hoy y el de mañana son idénticos.

## Criterios de aceptación

> Todos los CA se verifican con `npm run test`. **Ninguno** exige despliegue ni
> ejecuta red. Los CA que tocan `tests/version-bump-gate.test.ts` son un
> **re-encuadre** en el sentido de `FOUNDATION.md` § *Cómo se trabaja aquí* —la
> propiedad sigue viva y estaba mal expresada—, autorizado aquí y no por el
> implementador (CA-10).

### El corazón: el gate se abstiene cuando su veredicto depende de lo que no está commiteado

- **CA-1** — *La regla, como función pura.* Dado el veredicto que el gate forma hoy
  sobre los commits (base, versiones y lista de ficheros del diff), cuando existan
  ficheros **pendientes** en el árbol de trabajo, entonces el gate forma un **segundo**
  veredicto con **la misma base y las mismas dos versiones commiteadas**, cambiando
  únicamente la lista de ficheros por *diff ∪ pendientes*; y:
  - si los dos veredictos tienen el **mismo código de salida**, emite el primero tal
    cual lo emite hoy;
  - si **difieren en el código de salida**, **no emite ninguno de los dos**: sale con
    `SALIDA.USO` (**2**).

  Se compara el **código de salida** y no el motivo a propósito: lo que se consume
  aguas arriba es el código, y un `sin-codigo` que al commitear pasara a `subida`
  sigue siendo un `0` honesto. La regla vive en la parte **pura** del script y se
  prueba caso a caso sin invocar git, igual que `evaluar` (SPEC-038 CA-12).

- **CA-2** — *La reproducción del 2026-08-23.* Dado un repositorio con la base
  alcanzable, un diff commiteado que **no** toca código de aplicación y la misma
  versión que la base, cuando el árbol contiene un fichero **sin seguimiento** bajo
  una ruta de aplicación, entonces el script sale con **2** y su salida **no**
  contiene `El diff no toca codigo de aplicacion`. Lo mismo con ese fichero
  **modificado** y con ese fichero **en el índice** (`git add` sin `commit`): las tres
  formas de «todavía no es un commit» se comportan igual.

- **CA-3** — *Qué cuenta como pendiente.* Dado un árbol con ficheros **ignorados**
  bajo una ruta de aplicación (los que `.gitignore` ya excluye: artefactos de build,
  dependencias), cuando se ejecuta el gate, entonces **no** cuentan como pendientes y
  el gate **no** se abstiene por ellos. Sólo cuentan los que `git` reporta como
  modificados, en el índice o sin seguimiento.

### Que el gate siga siendo soportable para quien está a mitad de una spec

- **CA-4** — *Si el número ya subió, lo pendiente no puede cambiar el veredicto.*
  Dada una rama cuya versión commiteada es **estrictamente mayor** que la de la base,
  cuando el árbol tiene código de aplicación pendiente, entonces el gate **emite** su
  veredicto (`0`) y no se abstiene: commitear esos ficheros no puede convertir un
  verde en rojo.

- **CA-5** — *Un rojo no es un verde falso.* Dado un veredicto commiteado de
  `sin-subir` (`1`), cuando hay código de aplicación pendiente, entonces el gate
  **emite el `1`** con su mensaje completo —incluida la lista de ficheros que lo
  disparan y la pista de *«en el arbol de trabajo ya pone X, pero todavia no esta
  commiteado»* (`:405-419`), que se conserva sin tocar—, y **no** se abstiene.
  Abstenerse ahí cambiaría un diagnóstico útil por una negativa.

- **CA-6** — *Editar docs, specs, ledgers o tests no dispara nada.* Dado un árbol
  sucio **sólo** fuera de las rutas de aplicación (`docs/`, `tests/`, `_qa/`,
  `.github/`, `README.md`, `package.json`…), cuando se ejecuta el gate, entonces
  **no** se abstiene y emite el mismo veredicto que con el árbol limpio. En
  particular, un `package.json` con el `npm version` sin commitear **no** provoca
  abstención: la versión del árbol **nunca** entra en el veredicto y sigue siendo
  sólo la pista de CA-5.

- **CA-7** — *Cero regresión con el árbol limpio.* Dado un árbol de trabajo limpio,
  cuando se ejecuta el gate, entonces devuelve **exactamente** lo mismo que hoy
  —mismo código de salida, mismo motivo y mismo mensaje— para los cinco motivos
  existentes (`sin-codigo`, `subida`, `sin-subir`, `bajada`, `semver-invalido`). El
  bloque *«SPEC-038 CA-12: el veredicto»* (`tests/version-bump-gate.test.ts:128-231`)
  sigue verde **sin que se le cambie una línea**; si hay que tocarlo, es RED y se
  escala al gate.

### El mensaje: una negativa que no se pueda confundir ni con un veredicto ni con otro `2`

- **CA-8** — *El mensaje de la abstención.* Dado que el gate se abstiene, cuando
  escribe su salida, entonces el mensaje cumple las cuatro cosas:
  1. **se distingue** de los otros dos motivos del `2` —bandera desconocida, base
     inalcanzable (`fetch-depth`)— por una frase propia, de modo que quien lea un rojo
     de CI o de local sepa cuál de los tres es;
  2. **nombra los ficheros pendientes** que lo disparan (hasta diez, con el mismo
     recorte y el mismo formato que el mensaje de `sin-subir`);
  3. **dice la salida**: commitea lo pendiente (o guárdalo aparte) y vuelve a pasar el
     gate;
  4. **no afirma nada sobre la versión**: no contiene `npm version` ni pide subir el
     número. No es un veredicto sobre el código; es la negativa a emitir uno, y
     sugerir el remedio del `1` aquí sería inventarse un veredicto.

- **CA-9** — *Cuando sí emite y hay pendientes, lo dice.* Dado que el gate **emite**
  un veredicto (CA-4, CA-5, CA-6) existiendo ficheros pendientes bajo una ruta de
  aplicación, cuando escribe su salida, entonces añade una línea que dice **cuántos**
  hay y que **no** han entrado en el veredicto. Es lo que impide que un `El diff no
  toca codigo de aplicacion` se lea como *«no hay código tocado»* cuando lo hay,
  esperando en el árbol.

### La suite: el re-encuadre y la prueba que no puede quedarse vacía

- **CA-10** — *Re-encuadre de los dos casos caducos, con su porqué al lado.* Dados
  los casos `tests/version-bump-gate.test.ts:265-268` (*«comparada consigo misma no
  hay diff, así que pasa»*) y `:270-275` (*«esta rama pasa el gate: toca código de
  aplicación y sube el número»*), que hoy exigen `LIMPIO` sobre el árbol de quien
  ejecute la suite, cuando se re-encuadran, entonces **dejan de exigir un estado del
  árbol y pasan a exigir una propiedad**: que el veredicto del gate sea **coherente
  con el árbol que hay**. En concreto, y sin reimplementar la lógica del script:
  - si `git` no reporta ningún fichero pendiente bajo las rutas de aplicación, el gate
    **no se abstiene** (su salida es `0` o `1`, nunca `2` por este motivo);
  - si el gate se abstiene, el mensaje **nombra un fichero que `git` reporta de
    verdad** como pendiente.

  Los dos casos quedan **verdes con el árbol limpio y verdes con el árbol sucio**, en
  cualquier clon y para siempre. No se borran ni se aflojan: **se re-encuadran**, y
  junto a cada uno queda escrito —como exige `FOUNDATION.md` y `ADR-031` pto. 2.4—
  **qué vigilaba antes, qué vigila ahora, en virtud de qué CA y con qué fecha**.

- **CA-11** — *Centinela de no-vacuidad.* Dado que CA-10 sólo ejercita la rama de
  abstención cuando el árbol de quien ejecuta está sucio —y en CI nunca lo está—,
  cuando corre la suite, entonces un caso **siempre activo** demuestra la abstención
  sobre un **repositorio construido por el propio test** (temporal, fuera del árbol
  del proyecto), con la escena de CA-2: base alcanzable, diff sin código de
  aplicación, versión igual y un fichero pendiente bajo una ruta de aplicación →
  salida **2**. Ese caso **no depende del estado del árbol de nadie**, no se salta
  nunca y se pone rojo si la abstención se revierte. Molde disponible:
  `tests/guardias-no-caducan.test.ts` (SPEC-048 CA-9), que ya construye un repositorio
  temporal para simular un futuro.

### Las expectativas existentes que este arreglo cambia, y su autorización

- **CA-12** — *La guardia de subcomandos crece, y sólo lo justo.* Dado el caso
  *«nunca invoca `git` para escribir»* (`tests/version-bump-gate.test.ts:298-302`),
  que hoy exige que todo subcomando esté en `['diff', 'show', 'rev-parse']`, cuando el
  script necesita preguntar por el estado del árbol, entonces la lista admite **un**
  subcomando más —el de consulta de estado— y **ni uno más**; el resto del bloque
  *«el script no hace nada que no le toque»* (`:278-303`) sigue exigiéndose sin
  aflojarse: sólo importa de `node:*`, no sale a la red y **no escribe en el árbol**.

- **CA-13** — *La cabecera deja de decir media verdad.* Dado que el script ya avisa de
  que **el bump** tiene que estar commiteado (`:36-41`, `:98-99`), cuando se lee su
  cabecera, el texto de `--help` y el contrato de códigos de salida (`:43-51`),
  entonces dicen también la otra mitad: que **el código** tiene que estarlo, y que si
  no lo está el gate **se abstiene con 2 en vez de decir 0**. El `2` recoge su tercer
  motivo junto a *«uso incorrecto»* y *«no hay con qué comparar»*. Verificable:
  `--help` sigue saliendo con `0` y su texto menciona la abstención.

- **CA-14** — *El CI no cambia.* Dado el step `Version bump` de
  `.github/workflows/ci.yml`, cuando se entrega este arreglo, entonces sigue siendo
  `npm run version:check` y nada más, en el job `Checks`, con `if: !cancelled()` y con
  `fetch-depth: 0` en su checkout. No se añade ningún step, ninguna bandera, ninguna
  variable de entorno ni ninguna clave. El bloque *«SPEC-038 CA-13»*
  (`tests/version-bump-gate.test.ts:305-361`) sigue verde sin tocarse.

## Entidades y reglas afectadas

### Decisiones y reglas que esta spec aplica sin cambiar

- **ADR-024 ptos. 9, 10 y 11** — *qué* exige el gate (subir el número si el diff toca
  código de aplicación, comparación semver estrictamente mayor, y que la puerta
  post-despliegue siga mirando el commit). **No se toca nada de eso.** Esta spec
  decide **cuándo el gate puede opinar**, no **qué opina**.
- **RI-03 / ADR-031** — la distinción *criterio de gate* vs *propiedad permanente*, y
  el hecho de que este script sea el **molde** citado del criterio de gate bien
  puesto. Se conserva: la comparación sigue siendo contra `origin/main` con
  `${base}...HEAD`. Lo que ADR-031 no cubrió es este segundo eje: no la **diana** que
  se mueve, sino el **sujeto** que aún no existe como commit. CA-10 y CA-11 obedecen
  el espíritu de ADR-031 pto. 2 (propiedad antes que ventana; centinela de
  no-vacuidad) sin necesitar ventana fija, porque ninguna de las dos aserciones toma
  una revisión de git.
- **ADR-018 D-5.2 y `scripts/scan-destructive-sql.mjs:14-21`** — el precedente
  firmado por el humano el 2026-08-18: una guardia por diff *«se comporta distinto en
  local»*, y por eso aquel script escanea todo siempre. Aquí no se copia la solución
  —el diff contra la base es correcto para este gate— pero sí se cierra el mismo
  agujero.
- **ADR-018 D-6 (enmendado por ADR-024)** y **RI-02** — por qué el número importa: al
  mergear se despliega, y un artefacto distinto con el mismo número es la ambigüedad
  que ADR-024 vino a matar.
- **ADR-025** — el defecto se arregla desde **EPIC-FIX** sobre ficheros de una spec
  en `hecho` (SPEC-038). **SPEC-038 no se reabre.**
- **`FOUNDATION.md` § *Cómo se trabaja aquí*** — las dos salidas legítimas cuando una
  guardia caduca (re-encuadrar o borrar), que aflojar no es ninguna de las dos, y que
  **quien toca la guardia no es quien se beneficia**. Aquí el re-encuadre lo ordena
  esta spec en el gate (CA-10), no el implementador al ver el rojo.

### Ficheros que esta spec modifica

| Fichero | Qué cambia | CA |
|---|---|---|
| `scripts/check-version-bump.mjs` | Una función pura nueva (el contraste de CA-1), la lectura del estado del árbol detrás de git, el mensaje de la abstención, la nota de pendientes, y la cabecera / `--help` / contrato del `2` | CA-1…CA-9, CA-13 |
| `tests/version-bump-gate.test.ts` | Casos nuevos para CA-1…CA-9 y CA-11; **re-encuadre** de `:265-268` y `:270-275`; la lista de subcomandos de `:301` | CA-10, CA-11, CA-12 |

Ningún otro fichero. En particular **no** se tocan `src/`, `drizzle/`,
`.github/workflows/`, `vercel.json`, `.sdd.json`, `package.json`,
`docs/fundacion/reglas.md` ni ningún otro test. Si el implementador cree que hace
falta, es RED: escala al gate.

### Barrido: ¿hay más scripts con este agujero?

**No hoy.** Verificado el 2026-08-23 sobre `scripts/`, `tests/` y `.github/`:
`check-version-bump.mjs:327` es la **única** aparición de `...HEAD` en un script de
producción. `tests/ventana-fija.ts` y sus consumidores usan ventanas de dos sha fijos
(SPEC-048), que por construcción no tienen este problema: no juzgan lo que está
pasando ahora, sino una entrega cerrada. `scripts/scan-destructive-sql.mjs` escanea
el árbol entero y `scripts/check-alive.mjs` habla con un despliegue: ninguno compara
contra una base.

Por eso esta spec **no construye ningún mecanismo genérico** (ver §Fuera de alcance):
un framework para un solo consumidor es alcance inventado. La lección se deja escrita
donde la leerá quien escriba el gate siguiente —la cabecera del propio script, que es
el molde que RI-03 manda copiar (CA-13)—, y nada más.

## Fuera de alcance

- **Cambiar la regla de ADR-024 sobre cuándo hay que subir la versión.** Esta spec
  arregla **cuándo el gate puede opinar**, no **qué opina**. Ni un umbral, ni una
  excepción, ni un cambio en las rutas vigiladas.
- **Eximir los cambios de sólo-comentarios.** **Descartado por el humano el
  2026-08-23**, y se deja escrito con su motivo para que no vuelva: al mergear se
  despliega (ADR-018), y un artefacto distinto que sigue diciendo el mismo número es
  exactamente la ambigüedad que ADR-024 vino a matar con testers fuera. Además
  requeriría que el gate leyera el **contenido** del diff y no sus rutas, que es un
  gate distinto y mucho más frágil.
- **Una bandera para juzgar el árbol de trabajo** (`--tree`, `--incluir-pendientes`).
  **Rechazada con motivo** en §Notas pto. 2: crearía un segundo modo cuyo `0` afirma
  algo sobre lo que **no** se va a mergear, y ese `0` acabaría pegado en un cuerpo de
  PR — que es literalmente el daño que esta spec viene a cerrar.
- **Cambiar la base, el `...`, o dejar de comparar contra `origin/main`.** RI-03 cita
  este script como molde por hacerlo así, y SPEC-048 lo dejó fuera de alcance con esa
  misma razón. Sigue igual.
- **Un cuarto código de salida.** `SALIDA = { LIMPIO: 0, MARCADO: 1, USO: 2 }` es
  contrato (`:66-67`) y lo consume el step de CI. La abstención es un `2`; el
  razonamiento está en §Notas pto. 3.
- **Añadir una cláusula a `RI-03` o escribir una `RI-04`.** Las reglas de ingeniería
  tienen por definición un **ADR** como fuente (`docs/fundacion/reglas.md`), y RI-03
  cuelga de ADR-031, que es inmutable. Meter esto ahí exigiría un ADR nuevo; §Notas
  pto. 4 argumenta por qué creo que no hace falta, y deja la puerta abierta a que el
  humano decida lo contrario.
- **Un mecanismo genérico o una meta-guardia para scripts futuros que comparen contra
  una base.** Hoy hay **un** consumidor (barrido arriba). Construir el framework antes
  del segundo caso es inventar alcance, y una meta-guardia textual sobre `scripts/`
  sería además falsa: ahí comparar contra `origin/main` es lo correcto —lo dice
  SPEC-048 al rechazar exactamente esa extensión.
- **Reabrir SPEC-038 o tocar sus otros artefactos.** Sigue en `hecho`. Se tocan dos de
  sus ficheros desde EPIC-FIX, que es lo que ADR-025 prescribe.
- **Un hook de pre-commit o pre-push que ejecute el gate.** Hoy no hay hooks en el
  proyecto y ninguno hace falta para cerrar este defecto. Si se quisiera, es otra
  spec.
- **Regenerar el tablero.** Es de `sdd-documentalista` al cierre.

## Notas para el gate humano

1. **La tensión que me pediste resolver, y cómo la resuelvo: ni (a) ni (b) solas,
   sino las dos, y la (a) afinada.** El problema es que el gate y el test tiran en
   sentidos opuestos: si el gate se planta con el árbol sucio, el caso `:270` —que
   corre el gate contra la propia rama— se pone rojo **justo durante el desarrollo
   normal**, que es cuando el árbol siempre está sucio. Un rojo permanente acaba
   desactivado, y eso sería peor que el defecto.
   - **En el gate (CA-1)**: no se planta ante cualquier suciedad, y tampoco sólo ante
     código de aplicación. Se planta **cuando su respuesta depende de lo pendiente**:
     forma el veredicto con y sin los pendientes, y si el **código de salida** cambia,
     se calla. Es la (a) del encargo llevada un paso más allá, y el paso importa: con
     la (a) pelada, un `1` legítimo de `sin-subir` se convertiría en un `2` y
     perderíamos el mejor diagnóstico que el script sabe dar (CA-5); y una rama que
     **ya** subió el número quedaría bloqueada por su propio `src/` sucio sin que el
     veredicto pudiera cambiar (CA-4). Con el contraste, la abstención cae **sólo**
     donde vive el falso verde.
   - **En la suite (CA-10)**: los dos casos afectados dejan de exigir un estado del
     árbol y pasan a exigir **coherencia con el árbol que haya**. No es «tolerar el
     `2`» —eso sería aflojar—: es exigir que el `2` aparezca cuando toca y no aparezca
     cuando no toca. Verde con el árbol limpio y verde con el árbol sucio.
   - **Y para que ese verde no sea vacío en CI** (donde el árbol siempre está limpio y
     la rama de abstención nunca se ejercitaría), **CA-11** prueba la abstención sobre
     un repositorio temporal que construye el propio test. Es el centinela que ADR-031
     pto. 2.2 exige por costumbre en esta casa, aplicado aquí por analogía.
   - **El operador real, al final de todo esto**: a mitad de una spec, con `src/`
     sucio y sin haber subido el número todavía, ejecuta `npm run test` → **verde**.
     Ejecuta `npm run version:check` → **2**, con un mensaje que le dice que commitee.
     Sube el número y lo commitea → el gate vuelve a hablar aunque siga tocando
     `src/`. La fricción cae exactamente sobre el gesto que ADR-024 quiere, y cuesta
     un commit.

2. **Por qué rechazo la (c), la bandera explícita.** Sería la opción cómoda: `--tree`
   y el operador elige. La rechazo porque **multiplica por dos los significados de un
   `0`** en vez de reducirlos a uno, que es todo el problema. Un `0` de `--tree` no
   dice nada sobre lo que se va a mergear —el árbol no es lo que se mergea— y, siendo
   la invocación cómoda, se convertiría en la habitual: el mismo `0` acabaría pegado
   en el mismo cuerpo de PR, con una bandera delante que nadie mira. Si alguien quiere
   saber qué dirá el gate cuando commitee, la forma correcta y ya disponible es
   **commitear** (o commitear en una rama de usar y tirar): es reversible, es barato y
   produce exactamente el objeto que el gate juzga.

3. **Por qué `USO` (2) y no `MARCADO` (1), y por qué no un cuarto código.** Encaja con
   el contrato documentado en `:43-51` sin forzarlo: el `2` ya significa *«no puedo
   emitir un veredicto»* y ya se justifica con la frase *«un gate que no puede comparar
   no dice verde»*. Lo que la abstención añade es un tercer motivo del mismo `2`, no
   una categoría nueva: **hay base, pero el sujeto todavía no existe como commit**. Un
   `1` sería peor porque **afirma** algo —*«tienes que subir el número»*— que el gate
   no ha averiguado, y cualquier automatismo futuro que reaccione al `1` sugeriría el
   remedio equivocado. Un cuarto código rompería un contrato que consume el step de CI
   a cambio de nada: CI sólo distingue cero de no-cero, y la diferencia entre los tres
   motivos del `2` la lleva el mensaje (CA-8.1).

4. **Mi lectura: no hace falta ADR, y la comparto contigo por si la ves distinta.** No
   se cambia ninguna decisión: se aplica un principio **ya decidido y ya testado** para
   el caso hermano —*«un gate que no puede comparar NO dice verde»*, `:48-51` y
   `tests/version-bump-gate.test.ts:259`— al otro sentido de la misma imposibilidad. No
   constriñe trabajo futuro más allá de un script con un único consumidor. Y si quieres
   que la lección quede en `docs/fundacion/reglas.md` **entonces sí haría falta un
   ADR**, porque las `RI-xx` tienen un ADR por fuente y RI-03 cuelga de ADR-031, que es
   inmutable. Mi propuesta es que no haga falta ninguna de las dos cosas y que la
   lección viva en la cabecera del script (CA-13), que es el sitio donde mirará quien
   escriba el gate siguiente. **Si prefieres el ADR, dímelo en el gate y lo escribo
   antes de que esto pase a `aprobada`** — no lo he escrito por adelantado a propósito.

5. **Un caso más de los que traías, y conviene que lo veas.** El encargo señalaba
   `:270`; también queda afectado **`:265-268`** (`--base HEAD`), porque con esa base
   las dos versiones son idénticas por construcción y cualquier abstención lo alcanza.
   Los dos se re-encuadran juntos en CA-10. No hay un tercero: los demás casos del
   fichero o no ejecutan el script o le pasan una base inexistente.

6. **Lo que estoy autorizando a tocar de una entrega cerrada, para que lo mires con
   lupa.** Dos cosas, y las dos son cambios de expectativas existentes:
   - el **re-encuadre** de `:265` y `:270` (CA-10) — la propiedad sigue viva y estaba
     mal expresada, que es la primera de las dos salidas legítimas de `FOUNDATION.md`;
   - el **crecimiento** de la lista de subcomandos de git permitidos, de tres a cuatro
     (CA-12). Es la clase de cambio que FOUNDATION vigila —una guardia que se ensancha
     para dejar pasar lo que la está incomodando—, así que lo dejo autorizado **aquí**,
     acotado a un subcomando de sólo lectura y con el resto del bloque explícitamente
     intacto. Si al implementarlo hiciera falta un quinto, es RED.

   En los dos casos vale la regla de FOUNDATION de que **quien toca la guardia no es
   quien se beneficia**: lo ordena esta spec en el gate, no el implementador al
   encontrarse el rojo.

7. **Riesgo residual que asumo y declaro.** El gate sigue sin poder decir nada sobre lo
   que **todavía no está escrito**. Un operador que ejecute el gate, obtenga un verde
   legítimo y **luego** edite `src/` sigue pudiendo citar aquel verde. Esta spec cierra
   el caso en que la edición **ya existe** en el árbol cuando el gate habla —que es el
   caso medido y el que se pagó—, y no pretende cerrar el otro, que no tiene arreglo
   mecánico. Lo dejo escrito para que la promesa de esta spec no se lea más grande de
   lo que es.
