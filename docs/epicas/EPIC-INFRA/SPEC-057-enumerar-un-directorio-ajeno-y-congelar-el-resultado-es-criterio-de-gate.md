---
id: SPEC-057
tipo: spec
epica: EPIC-INFRA
estado: aprobada
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-25, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-25, por: humano (Alberto Fojo)}
---
# SPEC-057 — Enumerar un directorio ajeno y congelar el resultado es criterio de gate

> **Esta spec QUITA.** Retira **dos** comprobaciones y **no añade ninguna**.
> Saldo: **−2 / +0**. Si al implementarla el saldo deja de ser negativo, la
> implementación se ha desviado y se escala al gate antes de seguir.

## Problema

Hay una familia de comprobaciones que **barren un directorio que solo crece y
congelan el resultado** con una igualdad exacta. Afirman *«el árbol estaba así el
día de la entrega»*: una **foto**, no una propiedad. Caducan de dos maneras, las
dos malas — a **verde vacío** (dejan de comprobar y nadie se entera) o a **rojo
falso** (acusan a quien no ha hecho nada y **paran la CI de un tercero**).

Ha pasado **dos veces**, con el mismo molde y distinto sujeto:

1. **`tests/primera-pantalla-fuente.test.ts`** (SPEC-050 CA-20) exigía que
   **ningún** fichero de `docs/adr/` contuviera jamás la cadena `SPEC-050`.
   `ADR-033` la disparó al **citar `F-SPEC-050-4`**, el hallazgo que lo origina —
   el comportamiento sano de este proyecto. Resuelto **retirando** el caso
   (**SPEC-053 CA-13**, ya en `main`).
2. **`tests/tarjeta-guardias-ampliadas.test.ts`** (SPEC-051 CA-17.1) congela la
   lista de ficheros de `tests/` que mencionan `SPEC-051`. Cualquier spec
   posterior que la cite legítimamente lo rompe. **Sigue viva en `main`**: el
   arreglo escrito (SPEC-052 CA-18) está en una rama **parada y sin mergear**.

**Coste conjunto: dos escaladas al humano, dos rondas de arquitecto, dos de
implementador, dos de verificador. Defectos reales cazados: CERO.**

El diagnóstico está hecho y verificado, y vive entero en **ADR-037**:

- Es un **error de converso**: la guardia declara *«todo re-encuadre menciona a
  X»* y la usa como *«toda mención es un re-encuadre»*. Necesaria tratada como
  suficiente.
- Su forma es **conjunto cerrado sobre universo abierto**, y caduca **por
  instantánea**, no por diana móvil.
- **Por eso `ADR-031` no la cubre y la meta-guardia de SPEC-048 no la ve**:
  aquéllas persiguen guardias que dependen de `git`, y **aquí no hay ni un
  `git`**. Son propiedades del árbol, formalmente impecables ante `RI-03`, y
  caducan igual. **Esa es la grieta que esta spec cierra.**

### El dictamen de los cinco ficheros, uno a uno

Los cinco que el encargo señala. **Uno** está defectuoso, **uno** no existe en
`main` y **tres** están sanos. La corrección importa: es la diferencia entre una
spec estrecha y una ancha.

| # | Fichero | Veredicto |
|---|---|---|
| 1 | `tests/primera-pantalla-fuente.test.ts` | **Nada que hacer — ya retirado** |
| 2 | `tests/tarjeta-guardias-ampliadas.test.ts` | **RETIRAR** (CA-1) |
| 3 | `tests/entornos-de-despliegue.test.ts` | **Fuera de alcance — no está en `main`** |
| 4 | `tests/revision-movil-en-tests.test.ts` | **Se queda, intacto** |
| 5 | `tests/version-bump-gate.test.ts` | **Se queda, intacto** |

**1. `tests/primera-pantalla-fuente.test.ts` — nada que hacer.** El caso que
barría `docs/adr/` **ya no existe en `main`**: lo retiró **SPEC-053 CA-13** el
2026-08-24, y en su hueco quedó la prosa que explica la retirada. El fichero ya
no importa `readdirSync`. Lo que le queda son las listas exactas de
`dependencies`, `devDependencies` y `scripts` de `package.json`: **fichero
nombrado**, y quien añade una dependencia es quien tiene que tocar la lista, y
está delante. No es la forma rota. **No se toca ni una línea.**

**2. `tests/tarjeta-guardias-ampliadas.test.ts` — RETIRAR el bloque
`SPEC-051 CA-17.1` entero.** Es la **única instancia viva** en `main`. Lo que
afirma es, palabra por palabra, la forma que **ADR-031 pto. 1** llama criterio de
gate: *«los únicos ficheros ajenos de `tests/` que esta spec nombra son esos
dos»*, es decir *«este cambio está bien acotado»*. Y **ya se consumió en el
gate**: el ledger de SPEC-051 lleva su **GREEN 20/20 del 2026-08-23** con la
revisión del diff pegada — *«los únicos ficheros ajenos tocados son los dos
autorizados»*—, y CA-20 lo verificó a mano fichero por fichero. **SPEC-051 está
en `hecho` y ADR-025 impide reabrirla**: no puede re-encuadrar una tercera
guardia nunca más. Lo único que ese bloque puede hacer ya es dar rojos falsos.
Salida legítima: **borrar** (`FOUNDATION.md`), molde **SPEC-053 CA-13**.

*Por qué retirar y no re-encuadrar.* El re-encuadre existe, está escrito y es
correcto —SPEC-052 CA-18, derivar el conjunto de la **firma de un re-encuadre
autorizado** en vez de la cadena—, y costó (`130acd1`, `git show --numstat`)
**+185 líneas** en la guardia y **+212** en el fichero que la vigila. **397 líneas
de maquinaria para conservar un criterio de gate ya consumido sobre una spec que
no se puede reabrir.** La retirada cuesta un bloque menos y un comentario. Ver §Notas pto. 2:
esto **pisa** una rama parada y es decisión del humano.

**3. `tests/entornos-de-despliegue.test.ts` — fuera de alcance, y no por
descuido.** **No existe en `origin/main` (`778f189`).** Lo crea `fc14150` y lo
extiende `130acd1`, los dos en la rama
`ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde`, que está **parada por
decisión del humano**. Es el fichero que vigila el
re-encuadre de SPEC-052 CA-18 (e). **No es de esta spec y no se toca.**

**4. `tests/revision-movil-en-tests.test.ts` — se queda, y es el molde.** Sí
barre `tests/` recursivamente, pero el lado esperado es el **conjunto vacío**
(`expect(encontradas).toEqual([])` sobre las infracciones). Un conjunto esperado
vacío es **invariante al crecimiento**: un fichero nuevo solo puede romperlo
**cometiendo la infracción**, y entonces el acusado es su autor, no un tercero.
Además ya lleva su **centinela de no-vacuidad** (`vistos.length > 50` más seis
ficheros nombrados con `toContain`, no con `toEqual`). Es la forma sana. **Cero
líneas.**

**5. `tests/version-bump-gate.test.ts` — se queda, intacto.** Tiene dos barridos
y los dos son sanos. `readdirSync('docs/adr').find(n => n.startsWith('ADR-024-'))`
es una **búsqueda por nombre**: el directorio es el índice, no el valor afirmado.
`readdirSync('scripts').filter(n => n.endsWith('.mjs'))` alimenta una aserción
**por elemento** (`toBe(false)` para cada uno) y lleva su **centinela** propio
(`length > 0`). Ninguno congela una lista. Sus `toEqual` son sobre `vercel.json`
parseado y sobre fixtures de funciones puras. **Cero líneas.**

### La regla, para que no nazca una sexta

Vive en **ADR-037**, y se recoge en `RI-03` y en `FOUNDATION.md`. En una línea:

> **Si el valor que afirmas sale de recorrer un directorio, la aserción tiene que
> sobrevivir a que ese directorio crezca.**

Y se reconoce con una pregunta, no con una lista de matchers —enumerar formas
prohibidas está prohibido (`FOUNDATION.md`, 2.º corolario):

> **¿De quién es la mano que puede poner esto rojo?** Si es la de cualquiera que
> trabaje en otra spec, es **criterio de gate** y su sitio es el gate.

**No lleva mecanismo, y eso es una decisión, no una omisión.** El discriminante
necesita saber **quién escribe en ese directorio**, que es un hecho del
**proceso** y no del texto del fuente; la mejor meta-guardia textual que sé
escribir da, sobre `main`, **tres inocentes por un culpable** —y el culpable lo
retira esta misma spec, dejando la población en cero—. El detalle, con los tres
inocentes nombrados por línea, en **ADR-037 §Contexto**. El disparador, ya que no
hay mecanismo, es el **sitio donde se lee**: `FOUNDATION.md`, que `CLAUDE.md`
obliga a leer en el paso 1, pegada a la convención de la que esto es un caso.

## Usuarios / roles afectados

Ninguno de producto: **no toca `src/` ni el comportamiento del producto**. Afecta
a quien trabaja en el repositorio:

- **sdd-arquitecto**, que es quien escribe el CA del que sale la guardia — y de
  quien depende, sin mecanismo, que la sexta no nazca.
- **sdd-implementador**, que escribe la guardia leyendo la letra del CA.
- **sdd-verificador**, que hereda el gate de lo que no se automatiza.
- **Cualquier agente ajeno** cuya CI se para hoy por citar una spec previa.

## Criterios de aceptación

- **CA-1** *(propiedad — se lee el árbol)* **— la única guardia ajena que se
  retira, nombrada, y sin perder fuerza.** **Dado** el único bloque ajeno que
  esta entrega toca —y **solo** ése—, **cuando** se lee
  `tests/tarjeta-guardias-ampliadas.test.ts` **tal y como queda en el árbol**,
  **entonces** se cumplen las **cuatro** condiciones del molde de **SPEC-053
  CA-13** (y antes **SPEC-047 CA-19** y **SPEC-050 CA-22**):

  1. **Está nombrado, y es exactamente éste**:
     `tests/tarjeta-guardias-ampliadas.test.ts:111-139`, el bloque
     `describe('SPEC-051 CA-17.1: son DOS guardias ajenas, y la tercera no ha
     hecho falta')` **con sus dos casos**:
     - *«los únicos ficheros ajenos de tests/ que esta spec nombra son esos
       dos»* (112-132) — el barrido de `tests/` congelado con `toEqual`;
     - *«`tests/deploy-gate-workflow.test.ts` ni siquiera sabe que esta spec
       existe»* (133-138) — la misma afirmación sobre un universo más estrecho:
       *«esta entrega no tocó ese fichero»*, cierta sobre el delta, y roja el día
       que otra spec re-encuadre ese fichero citando a SPEC-051 como precedente.

     Se retiran **los dos**, enteros. **Ninguna otra línea de ese fichero, y
     ningún otro fichero ajeno.** Retirar **uno solo** deja la clase viva y es
     **RED**.

  2. **Lleva su porqué escrito en el sitio** —en el propio fichero, donde estaba
     el bloque, y no solo en el ledger—: **qué vigilaba antes**, **qué vigila
     ahora** (*nada en la suite*: la afirmación vuelve al gate, **donde ya se
     consumó** — GREEN 20/20 de SPEC-051, 2026-08-23, con la revisión del diff en
     su ledger), **por qué ya no puede volver a ser cierto** (SPEC-051 en
     `hecho`; **ADR-025** no la reabre), **por qué se retira en vez de
     re-encuadrarse** (el re-encuadre existe y cuesta 397 líneas para conservar
     un criterio consumido), **en virtud de qué** (`SPEC-057 CA-1` y **ADR-037**
     pto. 7), con la **fecha** y la **autorización nominal del humano** del gate,
     y dejando constancia de que **quien lo escribe no es quien se beneficia**:
     lo redacta el **arquitecto** y el implementador no lo decide.

     **Y la cabecera del fichero se corrige en la misma pasada**: hoy afirma
     *«lo que sí cabe aquí —y está— es su forma comprobable sin git: nadie más ha
     sido re-encuadrado por esta spec»*, y después de la retirada eso es **falso**.
     Dejar una cabecera que miente es exactamente el defecto que `ADR-033` tuvo
     que venir a corregir en `ADR-024` pto. 8. Se reescribe esa frase para que
     diga lo que el fichero hace; **el resto de la cabecera no se toca**.

  3. **No es una aflojada y no se toca nada más.** Los **diez** casos restantes
     —los bloques `CA-17.2`, `CA-17.3` y `CA-17.4`— siguen **verdes y sin una
     línea tocada**. No se marca nada `.skip`, `.only` ni `.todo`; no se borra
     ningún otro caso; no se cambia ninguna comparación exacta por una laxa; y
     —**explícitamente prohibido**— **no se añade ninguna exclusión por nombre**
     de ningún fichero ni de ninguna spec: eso dejaría el molde vivo para el
     siguiente. Lo descartó el humano el 2026-08-24 (SPEC-053 CA-13 cond. 3).

  4. **Ninguna propiedad protegida se debilita.** Lo retirado no era una
     propiedad: era un **criterio de gate ya verificado**. Lo que sí era
     propiedad de CA-17 se queda entero: que cada ampliación lleve su porqué al
     lado (17.2), que la guardia siga cerrada ante una exclusión inventada —con
     su mutación de control— (17.3), y que la hermana que mide la propiedad siga
     mirando (17.4), incluidas `PUBLIC_PREFIXES` y las doce rutas de producto.

  *Nota mecánica, para que no se lea como cambio de criterio*: la retirada deja
  sin uso `readdirSync`, `statSync` (línea 2), `relative` (línea 3), `testsDir`
  (38), `rel` (41), `NO_SE_TOCA` (60), `PROPIOS` (63) y `fuentesDeTests`
  (101-109). Se eliminan **porque `eslint --max-warnings=0` rechaza un símbolo sin
  usar**, no porque se decida nada sobre ellos. `casos()`, `sinComentarios()`,
  `caso()`, `fuente()` y `GUARDIAS` **se quedan**: los usan los tres bloques que
  sobreviven. Es la misma nota que SPEC-053 CA-13 dejó escrita para su
  `readdirSync`.

  *Y la condición de proceso, que no es decorativa*: la autorización queda escrita
  **aquí, en la spec, antes de que se implemente**. Un cambio en ese fichero que
  no esté en esta lista **no está autorizado** por haberse razonado en el ledger a
  posteriori.

- **CA-2** *(propiedad — recuento)* **— la suite queda verde entera, y no por
  haber aflojado otra cosa.** **Dado** el árbol entregado, **cuando** se ejecuta
  `npx vitest run`, **entonces** hay **cero rojos**; y el recuento lo demuestra
  caso a caso: `tests/tarjeta-guardias-ampliadas.test.ts` pasa de **12 casos** a
  **10** —la diferencia es **exactamente dos**, y son los dos retirados—, y
  **ningún otro fichero de `tests/` cambia su número de casos**, en particular
  ninguno de los tres que §Problema dictamina *«se queda, intacto»*. Los dos
  recuentos, antes y después, van al ledger. Un verde global obtenido retirando
  tres casos en vez de dos, o tocando cualquier otro fichero, es **RED**.
  Molde: **SPEC-053 CA-14**.

- **CA-3** *(propiedad — ficheros nombrados)* **— la regla queda escrita en los
  dos sitios donde se lee, con su fuente, y dice la pregunta y el disparador.**
  **Dado** que esta spec no deja mecanismo, **cuando** se leen `FOUNDATION.md` y
  `docs/fundacion/reglas.md` tal y como quedan, **entonces**:

  1. **`FOUNDATION.md`**, § *Cómo se trabaja aquí*, gana un **tercer corolario**
     de la convención del 2026-08-20 —*«un test de frontera fija una propiedad, no
     un estado del árbol»*—, datado **2026-08-25**, que dice: la forma que caduca
     (**enumerar un directorio que otros hacen crecer y congelar el resultado**),
     la pregunta que la reconoce (**¿de quién es la mano que puede ponerlo
     rojo?**), qué formas sí sobreviven al crecimiento (**vacío, por elemento,
     pertenencia, búsqueda por nombre**), los **dos incidentes** con su coste, y
     que **no lleva guardia y por qué**. Va **pegado a los otros dos corolarios**,
     no en una sección nueva: el disparador es que se lea en el paso 1 de
     `CLAUDE.md`.
  2. **`RI-03`** en `docs/fundacion/reglas.md` gana el párrafo equivalente, con
     **ADR-037 añadido a su línea de fuente** junto a ADR-031, y **conserva su
     número**: no hay `RI-04`. Y deja dicho **explícitamente** que las cuatro
     condiciones (1)-(4) de RI-03 siguen siendo **para guardias con `git`** y no
     se extienden a ésta, salvo el **centinela de no-vacuidad**, que sí aplica a
     cualquier barrido.
  3. Ninguno de los dos documentos afirma que exista una meta-guardia para esta
     familia. **La ausencia de mecanismo se dice**, no se calla: callarla sería la
     media verdad que ADR-033 tuvo que corregir en ADR-024.

  Se verifica **leyendo los dos ficheros en el gate**, con la evidencia al ledger.
  **No se añade ningún test que compruebe que un documento contiene una frase**:
  sería una casilla, y esta spec no añade comprobaciones (ver CA-5 y §Notas
  pto. 4).

- **CA-4** *(propiedad — el saldo)* **— esta spec quita más de lo que pone.**
  **Dado** el árbol entregado, **cuando** se cuentan las comprobaciones
  **retiradas** y las **añadidas** respecto de `origin/main` (`778f189`),
  **entonces** el saldo es **−2 / +0**: dos casos de `vitest` menos y **ningún
  caso nuevo**, ni en `tests/`, ni en `tests/e2e/`, ni un script de gate nuevo en
  `scripts/`, ni un step nuevo en `.github/workflows/ci.yml`. El recuento va al
  ledger con las dos cifras. **Un saldo que no sea negativo es RED** y se escala
  al gate antes de seguir: el encargo de esta spec era **quitar**.

- **CA-5** *(gate — `n-a` a propósito)* **— el alcance queda acotado, y se
  verifica donde se verifica una acotación.** **Dado** el diff de la rama con el
  árbol limpio, **cuando** lo revisa el verificador en el gate, **entonces** los
  únicos ficheros tocados son: `tests/tarjeta-guardias-ampliadas.test.ts`,
  `docs/adr/ADR-037-*.md`, `docs/fundacion/reglas.md`, `FOUNDATION.md`, esta spec
  y su ledger, y `docs/tablero.md` (generado). **Ni un fichero bajo `src/`,
  `app/`, `drizzle/` ni `scripts/`**; **ningún otro fichero de `tests/`**; y
  **ninguno de los tres ficheros que §Problema dictamina sanos**. La salida del
  diff se pega en el ledger.

  > **Este CA no lleva fila de test, y su `n-a` no está en blanco por descuido.**
  > *«Este cambio está bien acotado»* es cierto sobre un **delta** y su sitio es
  > el gate: **ADR-031 pto. 1.2** y `RI-03`. Codificarlo como test —barriendo
  > `tests/` y congelando qué ficheros nombran a `SPEC-057`— sería **literalmente
  > el defecto que esta spec persigue**, escrito por la spec que lo persigue.
  > Se declara aquí para que nadie lo lea como una omisión.

## Entidades y reglas afectadas

- **ADR-037** (nuevo, esta spec): la decisión. Precisa **ADR-031 pto. 1** sin
  enmendarlo ni supersederlo; sus condiciones 2.1-2.4 siguen siendo para `git`.
- **RI-03** (`docs/fundacion/reglas.md`): gana su párrafo y **ADR-037** como
  segunda fuente. **No cambia de número y no nace `RI-04`.**
- **`FOUNDATION.md`** § *Cómo se trabaja aquí*: tercer corolario de la convención
  del 2026-08-20. Es documento **locked** con hook `protege-verdad`; lo escribe el
  **arquitecto** en el gate, como manda **ADR-025**.
- **ADR-025**: es lo que hace irreversible la premisa de CA-1 — SPEC-051 está en
  `hecho` y no se reabre, así que lo que CA-17.1 negaba está zanjado.
- **ADR-031** y **SPEC-048**: la meta-guardia de `RI-03` **no** ve esta familia
  —no hay `git` que inspeccionar— y **no se toca**. No se le añade una segunda
  responsabilidad.
- **SPEC-051** (`hecho`, EPIC-MEJORA): dueña de la guardia que se retira. **No se
  reabre**; se toca su fichero de test con autorización escrita aquí, que es la
  vía que `FOUNDATION.md` sanciona.
- **SPEC-052** (parada, sin mergear): su **CA-18** re-encuadra la misma aserción.
  Ver §Notas pto. 2. **Esta spec no toca su rama, ni su ledger, ni
  `docs/despliegue.md`.**
- **ADR-024** / `version:check`: esta spec **no toca código de aplicación**
  (`.sdd.json` → `src/`, `app/`), así que **no exige bump de versión**. Si el
  gate pidiera uno, es señal de que el alcance se ha desviado.
- Ninguna **RN-xx** de dominio: no hay producto en juego.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **`tests/entornos-de-despliegue.test.ts` y todo lo de SPEC-052.** Su rama está
  parada por decisión del humano, `docs/despliegue.md` sigue con su frase falsa en
  `main`, y **nada de eso es de esta spec**. No se toca la rama, ni se rescatan
  commits, ni se abre su PR.
- **Una meta-guardia para esta familia.** No se escribe, y el porqué es decisión
  registrada en **ADR-037 pto. 4**, no un pendiente. Si alguien quiere revertirlo
  tiene que traer un discriminante que separe los **tres inocentes** que ADR-037
  nombra por línea.
- **`tests/spec-032-frontera.test.ts:162-164`** (`readdirSync(drizzle/)` filtrado
  contra `['destructive-waivers.json']`). Encaja en la firma y **no se toca**:
  en ese directorio escribe `drizzle-kit`, no otra spec, así que la mano que
  podría ponerlo rojo no es la de un tercero. Queda declarado como **caso
  fronterizo** en ADR-037 §Consecuencias, con su aviso escrito. SPEC-032 está en
  `hecho` y no hay defecto que arreglar hoy.
- **Barrer el repositorio en busca de más instancias.** Los cinco ficheros del
  encargo están dictaminados y la población queda en cero. Un barrido general es
  otra spec, y hoy no hay nada que le dé motivo.
- **Tocar los otros 21 ficheros de `tests/` que barren el repositorio.** No
  comparten el defecto; el dictamen de los tres sanos es el molde para juzgar los
  demás si algún día hace falta.
- **Cualquier cambio en `src/`.** Ni un rótulo, ni un typo. Esta spec no toca
  producto.

## Notas para el gate humano

**1. Léete el dictamen antes que los CA, porque corrige el encargo.** De los
cinco ficheros señalados, **uno** está defectuoso, **uno no existe en `main`** —
`tests/entornos-de-despliegue.test.ts` lo crean los commits `fc14150`/`130acd1` de la rama
parada de SPEC-052— y **tres están sanos**: sus barridos esperan el conjunto
**vacío**, afirman **por elemento** o **buscan por nombre**, y los tres llevan
centinela. Si el dictamen es correcto, esta spec es de **un solo arreglo** y todo
lo demás es la regla. **Si crees que alguno de los tres sanos no lo está, dilo
ahora**: es el punto donde esta spec se puede volver ancha, y una spec ancha ya
costó cuatro rondas esta semana.

**2. Lo que de verdad tienes que decidir: esto PISA la rama parada de SPEC-052.**
`SPEC-052 CA-18` re-encuadra esta misma aserción —de la cadena a la **firma de un
re-encuadre autorizado**— y está escrita, implementada y empujada, sin PR. Si
apruebas SPEC-057, **CA-18 (a)-(f) se queda sin objeto**: no se puede re-encuadrar
lo que ya no existe. Las cifras para que decidas:

| | Retirar (SPEC-057 CA-1) | Re-encuadrar (SPEC-052 CA-18) |
|---|---|---|
| Coste | un bloque menos + un comentario | **+185 líneas** en la guardia, **+212** en el fichero que la vigila (**397**) |
| Qué conserva | nada en la suite; el gate ya lo consumió (GREEN 20/20, 2026-08-23) | *«SPEC-051 no re-encuadró una tercera guardia»* |
| Puede volver a ser falso | **no** — SPEC-051 en `hecho`, ADR-025 no la reabre | no |
| Estado | por hacer | escrito y parado |

**Mi recomendación es retirar**, y el motivo no es que el re-encuadre esté mal
—está bien hecho—: es que conserva un criterio de gate **ya consumido** sobre una
spec que **no se puede reabrir**. Pero es tu llamada, porque el trabajo de
SPEC-052 ya está pagado y tirarlo tiene un coste que no es técnico. **Si prefieres
rescatar SPEC-052 primero y que SPEC-057 se limite a la regla**, dilo: la spec se
queda con CA-3, CA-4 y CA-5, y CA-1 y CA-2 se retiran. Sigue mereciendo la pena.

**3. Pido ADR-037, y te debo el argumento porque me pediste que eligiera con
criterio y no por simetría.** Lo pido **aunque la regla no lleve mecanismo** —de
hecho, **porque** no lo lleva:

- Un ADR cuyo contenido íntegro fuera *«hay un test que hace esto»* duplicaría el
  test. Aquí **no hay test**, así que el ADR es el **único** portador de la
  decisión.
- `reglas.md` declara que la fuente de toda `RI-xx` **es un ADR**. Si meto el
  párrafo en `RI-03` sin fuente, la regla afirma algo que su ADR no dice — la
  misma media verdad que `ADR-033` tuvo que venir a corregir en `ADR-024` pto. 8.
- Y la razón que de verdad lo justifica: **el argumento de NO mecanizar ya se
  derivó una vez y se perdió.** El arquitecto de SPEC-053 lo razonó el 2026-08-24
  y lo dejó en la prosa de su spec; **al día siguiente** hubo que derivarlo entero
  otra vez para escribir esto. Un ADR es el instrumento de *«decidido, no se
  vuelve a litigar»*. Sin él, el tercer agente que se tropiece con esto volverá a
  proponer la meta-guardia y volverá a costar lo mismo descartarla.

**Contraargumento honesto, para que puedas rechazarlo**: ADR-031 registró que una
convención en prosa *«aguantó dos días»*, y yo te traigo prosa. Mi respuesta es la
**población**: ADR-031 apostaba contra **quince** aserciones vivas y `main` en
rojo; ésta apuesta contra **cero**, con la forma nombrada y el disparador en el
documento que `CLAUDE.md` obliga a leer primero. Es una apuesta, y lo digo en
§Consecuencias del ADR: si aparece una tercera instancia, ahí está escrito que la
apuesta se perdió.

**4. La trampa que me pediste esquivar, y cómo la esquivo.** El arquitecto de
SPEC-053 no escribió la meta-guardia porque *«una meta-guardia tosca mataría
comprobaciones legítimas, incluida la suya propia»*. Tenía razón, pero era una
intuición. La he medido sobre `main` (`778f189`) y da **un culpable y tres
inocentes**:

- ✅ **Culpable:** `tests/tarjeta-guardias-ampliadas.test.ts:112-132`. El único.
  **Y esta spec lo retira**, así que la población pasa a **cero**.
- ❌ **Inocente 1:** `tests/spec-032-frontera.test.ts:148-151`,
  `expect(sql.slice(0, LAS_NUEVE.length)).toEqual(LAS_NUEVE)`. Encaja en la firma
  entera. **Y es uno de los tres moldes que `FOUNDATION.md` cita por su nombre
  como re-encuadre correcto.** Lo salva el `.slice(0, N)` —es un **prefijo**—, y
  distinguir prefijo de barrido leyendo texto es justo la delicadeza que SPEC-053
  rehusó. La meta-guardia **pintaría de rojo el ejemplo que tu constitución pone
  de bueno**.
- ❌ **Inocente 2:** `tests/spec-032-frontera.test.ts:162-164`. Formalmente **es**
  la forma rota; en la práctica no, porque en `drizzle/` escribe una herramienta y
  no otra spec. La guardia no puede saberlo.
- ❌ **Inocente 3 (casi):** `tests/revision-movil-en-tests.test.ts:101-115`,
  `expect(encontradas).toEqual([])`. Se salva **por un carácter** —el lado
  esperado vacío—. Es la propia meta-guardia de `RI-03`.

Y el dato que cierra el argumento no es el ratio, es **qué información le falta al
mecanismo**: el discriminante necesita saber **quién escribe en ese directorio**,
un hecho del **proceso** y no del texto. Ningún análisis textual lo deriva. No es
que sea difícil: es que **la premisa no está donde la guardia mira**. Contra eso,
la asimetría que tú ya juzgaste: un falso negativo cuesta una revisión de
arquitecto; un falso positivo **para la CI de un tercero**. Ya han sido acusados
dos. **Por eso: regla escrita, sin guardia, con el disparador en `FOUNDATION.md`.**

**5. El saldo, que es la vara con la que me pediste medirme: −2 / +0.** Dos casos
de `vitest` retirados, **ninguno añadido** — ni test, ni script de gate, ni step
de CI, ni un test que compruebe que un documento contiene una frase. CA-4 lo hace
condición de aceptación, y CA-5 declara `n-a` la acotación **en vez de
disfrazarla de test**, que es lo que esta spec persigue. Si al implementarla el
saldo deja de ser negativo, es que se ha desviado.

**6. Lo que te dejo decidir, en una lista corta:**

1. **Retirar o rescatar SPEC-052** (pto. 2). Es la única decisión con dinero
   dentro.
2. **ADR-037 sí o no** (pto. 3). Si dices que no, la regla se queda solo en
   `FOUNDATION.md` y `RI-03` pierde el párrafo, porque no puedo darle una fuente.
3. **Retirar los DOS casos de CA-17.1 o solo el primero** (CA-1 cond. 1). El
   segundo —*«`deploy-gate-workflow.test.ts` ni siquiera sabe que esta spec
   existe»*— es la misma enfermedad sobre un universo más estrecho: hoy no está
   rojo y su radio de daño es menor. Retirarlo cierra la clase; conservarlo deja
   una mina para el día que alguien re-encuadre ese fichero citando a SPEC-051.
   **Recomiendo retirar los dos**, pero es discutible y prefiero que lo veas.
4. **Si el dictamen de los tres sanos te convence** (pto. 1). Si no, dilo antes de
   aprobar, no después.
