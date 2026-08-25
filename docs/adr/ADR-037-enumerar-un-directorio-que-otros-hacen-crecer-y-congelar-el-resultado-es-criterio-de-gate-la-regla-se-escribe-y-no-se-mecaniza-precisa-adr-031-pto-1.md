---
id: ADR-037
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-25, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-25, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-037: Enumerar un directorio que otros hacen crecer y congelar el resultado es criterio de gate; la regla se escribe y no se mecaniza. Precisa ADR-031 pto. 1

- Deciders: propone **sdd-arquitecto** (2026-08-25, al especificar SPEC-057);
  aprueba **humano (Alberto Fojo)** en el gate de SPEC-057. El humano ya fijó el
  fondo el **2026-08-25**, al parar otra spec por este mismo molde: *«nos ha hecho
  perder mucho tiempo y tokens, con escaso beneficio»*. Lo que este ADR añade
  sobre esa decisión es **cómo se reconoce la forma antes de escribirla**, y —lo
  que más cuesta escribir— **por qué no se le pone guardia**.
- Specs relacionadas: **SPEC-057** (lo origina y lo consume); **SPEC-051**
  (la guardia defectuosa que queda viva en `main` es suya, CA-17.1);
  **SPEC-050** (la primera, CA-20) y **SPEC-053** (que la retiró, CA-13, y cuyo
  arquitecto ya se planteó la meta-guardia y decidió no escribirla);
  **ADR-031** (del que esto es una precisión de su pto. 1, no una enmienda);
  **SPEC-048** (la meta-guardia de RI-03, que **no** ve esta familia y por qué).

## Contexto

### El hecho, dos veces

| Cuándo | Guardia | Universo barrido | Qué la puso roja |
|---|---|---|---|
| 2026-08-24 | `tests/primera-pantalla-fuente.test.ts`, SPEC-050 CA-20 | `docs/adr/` | `ADR-033` **citó `F-SPEC-050-4`**, el hallazgo que lo origina |
| 2026-08-25 | `tests/tarjeta-guardias-ampliadas.test.ts`, SPEC-051 CA-17.1 | `tests/` | cualquier spec posterior que cite `SPEC-051` legítimamente |

Las dos afirman lo mismo con distinto sujeto: *«el conjunto de ficheros de
`<dir>` que mencionan a esta spec es **exactamente** esta lista»*. Las dos
caducan. Ninguna ha cazado jamás un defecto.

**El coste medido:** dos escaladas al humano, dos rondas de arquitecto, dos de
implementador, dos de verificador. **Defectos reales cazados: cero.** Y el
arreglo de la segunda, el que vive parado en
`ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde`, fue un **re-encuadre**
que costó (`130acd1`, `git show --numstat`) **+185 líneas** en la guardia y
**+212** en el fichero que la vigila: **397 líneas** de maquinaria para conservar
un criterio de gate **que ya se había consumido en el gate**. Ése es el «escaso
beneficio» del arbitraje, con su número al lado.

### El defecto lógico, nombrado

Es un **error de converso**. La guardia declara —y lo declara bien, en su propio
comentario— *«todo re-encuadre autorizado menciona a X»*, y el código la usa como
*«toda mención de X es un re-encuadre autorizado»*. Una condición **necesaria**
tratada como **suficiente**. El primero que menciona a X legítimamente paga el
rojo; y como mencionar a la spec que te precede es el **comportamiento sano** de
este proyecto —unas specs levantan hallazgos y otras los recogen—, la guardia
está calibrada para castigar exactamente lo que el método pide hacer.

Su forma es **conjunto cerrado sobre universo abierto**. `docs/adr/`,
`docs/epicas/` y `tests/` **solo crecen**, y crecen **por mano ajena**: quien
añade el fichero número N+1 trabaja en otra spec, no ha leído esta guardia y no
tiene motivo para leerla. Caduca **por instantánea**, no por diana móvil.

### Por qué ADR-031 no lo cubría, aunque su pto. 1 ya lo dijera

**ADR-031 pto. 1 ya es la decisión correcta**: *«un criterio con forma de "este
cambio está bien acotado" es un criterio de gate, no un test permanente»*. Las
dos guardias de arriba son, palabra por palabra, esa forma —*«los únicos
ficheros ajenos que esta spec nombra son esos dos»*, *«`docs/adr/` no gana
ningún fichero por esta spec»*—. **Estaban prohibidas desde el 2026-08-22 y se
escribieron igual.**

Lo que falló no es la decisión: es que **todo lo demás de ADR-031 habla de
`git`**. Sus cuatro condiciones (2.1 a 2.4) son sobre ventanas de sha; su
mecanismo (pto. 4, SPEC-048) busca *«una invocación de git que alimenta una
aserción tomando una revisión móvil»*. Estas dos guardias **no invocan git ni
una vez**: leen el disco. Son formalmente impecables ante RI-03, pasan la
meta-guardia sin despeinarse, y caducan igual. **Esa es la grieta**, y no está
en la regla sino en su cara visible: un agente que busca *«¿está prohibido lo
que voy a escribir?»* encuentra un ADR entero sobre diffs, no ve un `git diff`
en su código, y concluye que no va con él.

### El discriminante, y por qué es tan estrecho

La forma sana y la rota se parecen mucho. Este repositorio tiene **las dos**, y
la diferencia cabe en una pregunta:

> **¿De quién es la mano que puede poner esto rojo?**

Si la respuesta es *«la mía, o la de quien toque el fichero que estoy
afirmando»*, es una **propiedad** y su sitio es la suite. Si es *«la de
cualquiera que trabaje en otra spec»*, es un **criterio de gate** disfrazado.

Aplicado al árbol de hoy, con nombres:

| Forma | Ejemplo en `main` | Veredicto |
|---|---|---|
| Barrido + conjunto esperado **vacío** | `tests/revision-movil-en-tests.test.ts`, `expect(encontradas).toEqual([])` | **Sana.** Un fichero nuevo solo la rompe **cometiendo la infracción**; el acusado es su autor |
| Barrido + aserción **por elemento** | `tests/version-bump-gate.test.ts`, `for (const s of scripts) expect(...).toBe(false)` | **Sana.** Misma razón, y lleva su centinela de no-vacuidad (`length > 0`) |
| Barrido como **búsqueda por nombre** | `tests/version-bump-gate.test.ts`, `readdirSync('docs/adr').find(n => n.startsWith('ADR-024-'))` | **Sana.** El directorio es el índice, no el valor afirmado |
| **Pertenencia**: *«estos siguen ahí»* | `tests/spec-032-frontera.test.ts`, `expect(vistos).toContain(...)`, `sql.slice(0, 9)` | **Sana.** Tolera el crecimiento por construcción; es el molde que `FOUNDATION.md` ya canoniza |
| Fichero **nombrado**, igualdad exacta | `expect(Object.keys(pkg.dependencies).sort()).toEqual(DEPENDENCIAS)` | **Sana.** Quien añade la dependencia es quien tiene que tocar la lista, y está delante |
| Barrido + **igualdad exacta contra lista literal no vacía** | `tests/tarjeta-guardias-ampliadas.test.ts` CA-17.1 | **Rota.** La única viva en `main` |

Entre la primera fila y la última hay **un carácter de diferencia** en el
código: que el lado esperado esté vacío o no.

### Por qué no se mecaniza: el falso positivo, con nombres y líneas

El arquitecto de SPEC-053 ya se planteó una meta-guardia contra este molde y
**decidió no escribirla**, porque distinguir *enumerar esperando una lista
congelada* de *afirmar algo de un fichero nombrado* es delicado y una guardia
tosca mataría comprobaciones legítimas. Esa razón era correcta pero era una
intuición. Aquí queda **medida**, que es lo que permite cerrarla.

La meta-guardia menos tosca que sé escribir sería: *«un valor derivado de
`readdirSync` comparado con `toEqual` contra una lista literal no vacía»*.
Ejecutada mentalmente sobre `main` (`778f189`) da **un culpable y tres
inocentes**:

- ✅ **Culpable:** `tests/tarjeta-guardias-ampliadas.test.ts:112-132`. El único.
  Y **SPEC-057 lo retira**, así que la población pasa a **cero**.
- ❌ **Inocente 1:** `tests/spec-032-frontera.test.ts:148-151` —
  `expect(sql.slice(0, LAS_NUEVE.length)).toEqual(LAS_NUEVE)`. Encaja en la
  firma entera. Y es una de **las tres formas buenas que `FOUNDATION.md` cita
  por su nombre** como molde de re-encuadre correcto. Lo salva el `.slice(0, N)`
  —es un **prefijo**, no el listado—, y distinguir *prefijo de un barrido* de
  *barrido entero* leyendo texto es precisamente la delicadeza que SPEC-053
  rehusó. **La meta-guardia pintaría de rojo el ejemplo que la constitución pone
  de correcto.**
- ❌ **Inocente 2:** `tests/spec-032-frontera.test.ts:162-164` —
  `readdirSync(drizzleDir).filter(f => f.endsWith('.json'))` contra
  `['destructive-waivers.json']`. Formalmente **es** la forma rota. En la
  práctica no lo es, porque en ese directorio escribe `drizzle-kit`, no otra
  spec: la mano que podría ponerlo rojo no es la de un tercero. La guardia no
  puede saberlo.
- ❌ **Inocente 3 (casi):** `tests/revision-movil-en-tests.test.ts:101-115` —
  `expect(encontradas).toEqual([])`. Se salva solo por tener el lado esperado
  vacío. Es **la propia meta-guardia de RI-03**, y sobrevive por un carácter.

**Tres inocentes contra un culpable que esta misma spec retira.** Y el dato que
cierra el argumento no es el ratio: es **qué información le falta al
mecanismo**. El discriminante exige saber **quién escribe en ese directorio** —si
lo llena `drizzle-kit`, si lo llena otra spec, si lo llena el propio autor—, y
ése es un hecho sobre el **proceso** de este proyecto, no sobre el texto del
fuente. Ninguna cantidad de análisis textual lo puede derivar. No es que la
guardia sea difícil: es que **la premisa que necesita no está en el sitio donde
la guardia mira**.

Contra eso, la asimetría de costes es la que el humano ya juzgó: un falso
negativo cuesta una revisión de arquitecto en la spec siguiente; un falso
positivo **para la CI de un tercero que no ha hecho nada**. Ya han sido acusados
dos.

### Y por qué entonces vale la pena escribirla

ADR-031 rechazó *«dejarlo en `FOUNDATION.md` sin mecanismo»* con evidencia
directa: *«aguantó dos días»*. La objeción es legítima y hay que contestarla, no
esquivarla. Se contesta con la **población**:

- Cuando ADR-031 se escribió había **quince** aserciones vivas con el defecto y
  `main` en rojo. Prosa contra quince es una apuesta perdida.
- Cuando SPEC-057 cierre, habrá **cero**. Prosa contra cero, con la forma
  nombrada y con el disparador puesto donde se lee, es otra apuesta.

Y hay una segunda razón, que es la que de verdad justifica gastar un inmutable:
**el argumento de no mecanizar ya se derivó una vez y se perdió.** SPEC-053 lo
razonó el 2026-08-24 y lo dejó en la prosa de su spec; **al día siguiente** hubo
que volver a derivarlo entero desde cero para escribir esto. Un ADR
es el instrumento que este proyecto tiene para *«decidido, no se vuelve a
litigar»*. Sin él, el tercer agente que se tropiece con la tercera instancia
volverá a proponer la meta-guardia, y volverá a costar lo mismo descartarla.

## Decisión

**1. Un conjunto esperado que enumera lo que hay dentro de un directorio que
crece por mano ajena es un criterio de gate, no un test.** Es el mismo criterio
que ADR-031 pto. 1 ya prohíbe —*«este cambio está bien acotado»*—, expresado sin
`git`. Le aplican **las mismas tres salidas y en el mismo orden**: reexpresar
como propiedad, verificar en el gate con evidencia al ledger, o script de gate
en `scripts/`.

**2. La forma se reconoce con una pregunta, no con una lista de matchers**
(`FOUNDATION.md`, 2.º corolario: enumerar formas prohibidas está prohibido):

> **¿De quién es la mano que puede poner esto rojo?** Si es la de cualquiera que
> trabaje en otra spec, es criterio de gate.

**3. Si el valor afirmado sale de recorrer un directorio, la aserción tiene que
sobrevivir a que ese directorio crezca.** Formas que lo cumplen, todas ya
presentes en el repositorio: conjunto esperado **vacío**; aserción **por
elemento**; **pertenencia** (*«estos siguen ahí»*, incluido el prefijo);
**búsqueda por nombre**. La que no lo cumple es **la igualdad exacta contra una
lista literal no vacía**. Y sigue vigente la exigencia de ADR-031 pto. 2.2: un
barrido lleva su **centinela de no-vacuidad**, porque un barrido sobre el
directorio equivocado es verde sin haber mirado nada.

**4. No se escribe meta-guardia, y el motivo queda registrado aquí para que no
se vuelva a proponer.** El discriminante necesita saber **quién escribe en el
directorio**, que es un hecho del proceso y no del texto; el mejor mecanismo
textual que se sabe escribir da **tres inocentes por un culpable**, y uno de los
inocentes es un molde que `FOUNDATION.md` cita como correcto. Se prefiere una
**regla escrita sin guardia** a una **guardia que acusa a inocentes**. Quien
quiera revertir esto tiene que traer un discriminante que separe los tres
inocentes de §Contexto, nombrados y por línea; no basta con proponerlo mejor.

**5. El disparador, ya que no hay mecanismo, es el sitio donde se lee.** La
regla se escribe en los dos documentos que un agente lee **antes** de escribir
nada, y no en un tercero:

- **`FOUNDATION.md`**, § *Cómo se trabaja aquí*, pegada a la convención de la
  que es un caso —*«un test de frontera fija una propiedad, no un estado del
  árbol»*—, porque `CLAUDE.md` obliga a leerlo en el paso 1.
- **`RI-03`** en `docs/fundacion/reglas.md`, que es donde va el detalle, con
  **este ADR** añadido a su línea de fuente junto a ADR-031.

**6. Esto NO enmienda ni supersede a ADR-031.** Su pto. 1 sigue diciendo lo
mismo y sigue siendo la decisión; sus condiciones 2.1-2.4 siguen siendo para
guardias con `git` y no se extienden. Lo que este ADR hace es **precisarlo**
—como ADR-035 precisó a ADR-026— nombrando el vector sin `git` que su texto no
nombraba. `RI-03` no cambia de número.

**7. Autoriza la retirada de `tests/tarjeta-guardias-ampliadas.test.ts`
CA-17.1** (SPEC-057 CA-1), por la vía de ADR-031 pto. 1.2: es un criterio de
gate **ya consumido**, con su GREEN 20/20 del 2026-08-23 y la revisión del diff
pegada en el ledger de SPEC-051. Y **no** autoriza nada más de ese fichero.

## Consecuencias

### Positivas
- La única instancia viva en `main` desaparece, y con ella la clase entera: la
  población del defecto pasa a **cero**.
- **El saldo es negativo**: SPEC-057 retira **dos** comprobaciones y no añade
  ninguna. Es la primera spec de esta familia que sale más barata de lo que
  entra.
- El re-encuadre de 397 líneas que espera en la rama parada de SPEC-052 deja de
  ser necesario: lo que iba a re-encuadrar ya no existe.
- La grieta queda nombrada. Un agente que busque *«¿está prohibido lo que voy a
  escribir?»* ya no necesita ver un `git diff` en su código para encontrarse la
  regla.
- El argumento de **no** mecanizar deja de ser prosa perecedera en la spec de
  turno y pasa a ser una decisión con nombre, con sus tres inocentes por línea.

### Negativas / follow-ups
- **No hay mecanismo, y se sabe lo que eso vale.** ADR-031 documentó que una
  convención en prosa aguantó dos días. Ésta se apuesta contra una población
  cero y con el disparador en `FOUNDATION.md`, pero **es una apuesta**. Si
  aparece una tercera instancia, este ADR es el sitio donde se lee que la
  apuesta se perdió, y entonces sí toca mecanismo — con el listón del pto. 4.
- **La pregunta del pto. 2 exige criterio.** *«¿De quién es la mano?»* no se
  responde con un `grep`; la responde quien escribe el CA. Es deliberado (2.º
  corolario de `FOUNDATION.md`), pero traslada trabajo al arquitecto y al gate.
- **`tests/spec-032-frontera.test.ts:162-164` queda como caso fronterizo
  declarado.** Encaja en la firma del pto. 3 y no se toca, porque su directorio
  lo llena una herramienta y no otra spec. Si algún día `drizzle/` gana un
  `.json` por otra vía, esa guardia se pondrá roja y **este párrafo es su aviso
  escrito**. No se arregla ahora: SPEC-032 está en `hecho` y no hay defecto.
- **Un inmutable más que mantener**, y su contenido es una regla sin código
  detrás. Aceptado por el pto. 5 de §Contexto: el coste de re-derivar el
  argumento ya se pagó una vez.

## Alternativas consideradas

- **Escribir la meta-guardia igualmente.** Es lo que ADR-031 hizo con RI-03 y
  funcionó. **Rechazada por medición**: sobre `main` da tres inocentes por un
  culpable, uno de ellos canonizado por `FOUNDATION.md`, y el culpable lo retira
  esta misma spec. Añadiría comprobaciones a una spec cuyo encargo era quitarlas
  y pondría en riesgo la CI de terceros para proteger una población de cero. El
  humano ya dijo que prefiere una regla sin guardia a una guardia que acusa
  inocentes.
- **Re-encuadrar CA-17.1 en vez de retirarla** —el camino de SPEC-052 CA-18,
  derivar el conjunto de la *firma de un re-encuadre autorizado* en vez de la
  cadena—. Es técnicamente correcto y está escrito. **Rechazada por coste y por
  sitio**: 397 líneas para conservar un criterio de gate ya consumido sobre una
  spec en `hecho`, que **ADR-025** impide reabrir. Lo que ese re-encuadre
  vigilaría —*«SPEC-051 no re-encuadró una tercera guardia»*— ya no puede
  volverse falso.
- **Excluir por nombre los ficheros que la rompen** (`ADR-033`,
  `tests/entornos-de-despliegue.test.ts`…). **Rechazada de plano y ya rechazada
  antes**: es la condición 3 de SPEC-053 CA-13, que el humano descartó
  explícitamente el 2026-08-24. Deja el molde vivo para el siguiente.
- **Prohibir todo barrido de directorio en `tests/`.** Simple de enunciar y de
  vigilar. **Rechazada**: mataría la meta-guardia de RI-03, las dos
  comprobaciones sanas de `tests/version-bump-gate.test.ts` y los barridos de
  `tests/spec-032-frontera.test.ts`. La regla no es *«no enumeres»*, es *«no
  congeles lo que enumeras»*.
- **Enmendar ADR-031 con un pto. 5 nuevo.** Más económico en número de
  documentos. **Rechazada por la regla dura del estándar**: un ADR aceptado es
  **inmutable**. La vía que este proyecto tiene para esto es un ADR que precisa
  —ADR-033 sobre ADR-024, ADR-035 sobre ADR-026—, y es la que se usa.
- **Dejarlo solo en `FOUNDATION.md`, sin ADR.** Un documento menos y ningún
  inmutable nuevo. **Rechazada por dos motivos**: `reglas.md` declara que la
  fuente de toda `RI-xx` **es un ADR**, y añadir el párrafo a `RI-03` sin fuente
  dejaría la regla afirmando algo que su ADR no dice —exactamente la clase de
  media verdad que `ADR-033` tuvo que venir a corregir en `ADR-024` pto. 8—; y
  el argumento de **no** mecanizar necesita un sitio estable donde leerse, o se
  vuelve a derivar por tercera vez.
- **Retirar también las dos comprobaciones sanas de barrido**
  (`tests/revision-movil-en-tests.test.ts`, `tests/version-bump-gate.test.ts`)
  «por si acaso». **Rechazada**: no comparten el defecto —su conjunto esperado
  es vacío o su aserción es por elemento—, llevan centinela de no-vacuidad, y
  una de ellas es el mecanismo que hace cumplible RI-03. Quitarlas sería la
  aflojada que `FOUNDATION.md` declara ilegítima.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
