---
id: ADR-031
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-22, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-22, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# ADR-031: Un criterio sobre un cambio se verifica en el gate; si se queda en la suite, nace anclado a una ventana de dos sha fijos

- Deciders: propone **sdd-arquitecto** (2026-08-22, al especificar SPEC-048);
  aprueba **humano (Alberto Fojo)** en el gate de SPEC-048. El humano ya fijó el
  fondo el 2026-08-22 al triar el rojo de `main`: *se arregla con el patrón de
  SPEC-042 —anclar a la ventana de la entrega—, y no borrando los tres, para
  **conservar el valor de auditoría***. Lo que este ADR añade sobre esa decisión
  es la parte que la hace no repetirse: **dónde nace** cada clase de criterio.
- Specs relacionadas: **SPEC-048** (lo origina y lo consume);
  **SPEC-047** (las dos guardias defectuosas son suyas); **SPEC-042** y
  **SPEC-028** (los dos precedentes que ya lo hacen bien); **SPEC-038**
  (`fetch-depth: 0`, que es lo que hace viable la ventana fija en CI).

## Contexto

### El hecho

El 2026-08-22, al mergear la PR #52 (SPEC-047), la CI de `main` se puso roja
(run `32583255349`, job `Checks` → `Unit tests`). Tres casos fallaron, ninguno
por un defecto del producto:

| Fichero | Caso | Error |
|---|---|---|
| `tests/icono-frontera.test.ts` | SPEC-047 CA-16, *«el guardián de sesión cambia en una sola línea»* | `expected [] to have a length of 1 but got +0` |
| `tests/icono-frontera.test.ts` | SPEC-047 CA-18, *«el diff sobre tests/ … sólo modifica las tres guardias»* | `expected [] to deeply equal [ 'tests/cuenta-rutas.test.ts', …(2) ]` |
| `tests/icono-guardias-ampliadas.test.ts` | SPEC-047 CA-19.1, *«el diff sobre tests/ no modifica ningún fichero ajeno»* | igual que el anterior |

Las tres aserciones no miden el **código**: miden el **diff contra
`origin/main`** (`git diff origin/main...HEAD`). Mientras la rama estaba sin
mergear ese diff contenía la línea del matcher y los tres ficheros de test, y
las tres pasaban. Al mergear, `origin/main` pasó a incluir el propio cambio, el
diff quedó **vacío** y las aserciones se invirtieron. No pueden volver a ser
ciertas nunca.

### Lo que el rojo tapaba: doce verdes vacíos

El rojo es el síntoma ruidoso; el silencioso es peor. En esos dos mismos
ficheros hay **doce aserciones más** que dependen del mismo diff vacío o del
mismo `git show origin/main:<fichero>`, y que al mergear **pasaron a pasar sin
mirar nada**: *«no se toca ni un fichero fuera del conjunto pactado»* sobre una
lista vacía es verde; *«el caso de ahora es byte a byte el de `origin/main`»* lo
es por definición cuando `origin/main` ya lo contiene. Un gate vacío que se
presenta como verde es exactamente lo que `FOUNDATION.md` § *Cómo se trabaja
aquí* llama **aflojar la comprobación hasta que pase**, sólo que aquí lo hizo el
propio calendario en vez de una persona.

### Por qué la convención que ya existía no lo evitó

`FOUNDATION.md` fija desde el **2026-08-20** —tras cuatro incidentes, cerrando
`F-SPEC-034-6`— que *«un test de frontera fija una propiedad, no un estado del
árbol»*, y da las dos salidas legítimas cuando una guardia caduca:
**re-encuadrar** o **borrar**. Esa convención es de **reparación**: dice qué
hacer con la guardia el día que se pone roja.

Este es el **quinto** incidente y ocurrió **dos días después** de escribirla, en
una spec que además re-encuadró tres guardias ajenas con toda la disciplina. Es
decir: quien escribió las guardias defectuosas conocía la convención y aun así
las escribió por diff contra `origin/main`. La convención no falló al aplicarse;
falló porque **no cubre el momento de escribir**. Nada del proyecto decía dónde
nace un criterio con forma de *«este cambio está bien acotado»*.

### La distinción que faltaba, y que el propio repositorio ya practica sin nombrarla

Hay dos clases de afirmación y se estaban tratando igual:

- **Criterio de gate**: *«este cambio está bien acotado»*. Es cierto sobre un
  **delta**, y sólo mientras el delta no se ha integrado. Su verificador natural
  es el gate — la persona que aprueba, el verificador que firma, o un **script
  de gate** que corre sobre la rama.
- **Propiedad permanente**: *«esta lista sigue cerrada»*, *«este literal sigue
  siendo el que hay»*, *«nadie de `src/` lee `package.json`»*. Es cierta sobre
  el **estado** del árbol, en cualquier momento y para siempre. Su verificador
  natural es la suite.

El repositorio ya tiene las dos formas bien hechas y nunca las había separado
por escrito:

- `scripts/check-version-bump.mjs` (SPEC-038) es un **criterio de gate puro**:
  compara la rama con `origin/main` y **debe** hacerlo, porque lo que juzga es
  el delta. Al mergear, su diff queda vacío y sale 0 — y eso es **correcto**: ya
  no hay nada que exigir. Vive en `scripts/` y lo invoca un step de CI, no la
  suite.
- `tests/deploy-gate-workflow.test.ts` (SPEC-028 CA-9) y
  `tests/neon-preview-cleanup-workflow.test.ts` (SPEC-042 CA-1) son **criterios
  de gate conservados en la suite por su valor de auditoría**, y los dos se
  anclaron a una **ventana de dos sha fijos** (`de3a6ee…0d389c8` y
  `124085a`/`31bb01b`) precisamente cuando caducaron.
- `tests/spec-031-frontera.test.ts` y `tests/version-build-channel.test.ts`
  convirtieron su criterio en **propiedad**: literales congelados y listas
  cerradas, sin git de por medio.

### La restricción de CI

Cualquier mecanismo tiene que funcionar en el runner.
`tests/version-bump-gate.test.ts` ya deja escrito que **con el clonado
superficial por defecto `origin/main` no existe en el runner**, y por eso el job
`Checks` de `.github/workflows/ci.yml` lleva `fetch-depth: 0` (SPEC-038 CA-13).
Ese `fetch-depth: 0` es lo que hace alcanzable cualquier sha histórico en el job
donde corren los unitarios — y por tanto lo que hace viable la ventana fija. Es
una dependencia real y hay que declararla: si alguien lo quitara, todas las
guardias ancladas se saltarían.

## Decisión

**1. Un criterio con forma de *«este cambio está bien acotado»* es un criterio
de gate, no un test permanente.** Su sitio, por orden de preferencia:

1. **Reexpresarlo como propiedad** del estado del árbol, si se puede. Es siempre
   la mejor opción: no caduca, no necesita git y funciona en cualquier clon.
   Molde: `tests/spec-031-frontera.test.ts` (de *«el diff no toca
   `vercel.json`»* a *«`vercel.json` es exactamente esto»*).
2. **Verificarlo en el gate** y dejar la evidencia en el **ledger** de la spec:
   quién lo comprobó, sobre qué rama y con qué salida. No entra en la suite.
3. **Un script de gate** en `scripts/`, invocado por un step propio de CI, si la
   comprobación merece automatizarse sobre cada rama. Molde:
   `scripts/check-version-bump.mjs`.

**2. Si por valor de auditoría el criterio se queda en la suite —que es una
razón legítima y este proyecto la ha invocado dos veces—, nace anclado.** Cuatro
condiciones, todas obligatorias y todas desde el primer día, no como parche el
día que se pone rojo:

- **2.1 Ventana de dos sha fijos.** Las revisiones son sha literales declarados
  en una constante con nombre (`ENTREGA_DE_SPEC_NNN` o equivalente). **Ningún
  nombre móvil** —`origin/main`, `main`, `HEAD`, `@`— puede ser revisión de un
  `git diff`, `git show` o `git log`/`rev-list` que alimente una aserción.
- **2.2 Centinela de no-vacuidad.** Un caso del mismo bloque afirma que la
  ventana **contiene** algo que la entrega sí trajo. Sin él, una ventana mal
  escrita deja todo el bloque en verde sin haber mirado nada — que es el modo de
  fallo de las doce aserciones de arriba. Molde: el caso *«y la ventana no está
  vacía: lo que sí trajo fue el limpiador»* de SPEC-042.
- **2.3 Salto declarado por disponibilidad.** El bloque se salta si alguno de los
  dos sha no está en el clon (`describe.skipIf`), para que un clon superficial no
  lo convierta en rojo falso; y **el salto no puede ocurrir en CI**: un caso
  siempre activo lo comprueba.
- **2.4 El porqué, al lado.** Junto a la aserción queda escrito **qué vigilaba
  antes, qué vigila ahora, en virtud de qué CA y con qué fecha**. Es la condición
  que `FOUNDATION.md` ya exige al re-encuadrar; aquí se exige también al
  **nacer**.

**3. La regla queda escrita como `RI-03`** en `docs/fundacion/reglas.md`, serie
de ingeniería, con este ADR como fuente. Vincula a cualquier spec que escriba
una guardia sobre un diff.

**4. Lo hace cumplible una meta-guardia** (SPEC-048): un test que recorre
`tests/` y falla si alguna invocación de git que alimenta una aserción toma una
revisión móvil. Automático, porque una convención que sólo vive en prosa ya se
saltó una vez a los dos días de escribirse.

**5. Nada de esto autoriza a aflojar.** Las dos salidas de `FOUNDATION.md`
siguen siendo las únicas cuando una guardia caduca —re-encuadrar o borrar—, y
sigue vigente que **quien toca la guardia no es quien se beneficia**: el
implementador escala al gate, no ablanda en silencio.

## Consecuencias

### Positivas
- El rojo de `main` desaparece por la causa correcta, y no puede volver: el
  veredicto de una guardia anclada no depende de dónde apunte ninguna rama.
- Los doce verdes vacíos vuelven a mirar algo. El valor de auditoría de SPEC-047
  —*«aquella entrega estuvo acotada, y las tres guardias ajenas se ampliaron sin
  aflojarse»*— se conserva, que es justo lo que el humano pidió conservar.
- La distinción gate/propiedad queda nombrada. Las tres formas buenas que el
  repositorio ya tenía (`check-version-bump.mjs`, ventana fija, literal
  congelado) dejan de ser tres hallazgos sueltos y pasan a ser un catálogo.
- La meta-guardia convierte la convención en mecanismo. El sexto incidente se
  cae en la PR que lo introduce, no en `main` dos días después.

### Negativas / follow-ups
- **La ventana fija es opaca de leer.** `6da9fbe…104f94e` no dice nada a quien
  pase por ahí dentro de seis meses; el comentario de al lado (2.4) es lo único
  que lo salva, y es prosa que hay que escribir a mano.
- **Ancla la suite al histórico de git.** Un `git filter-repo`, un squash del
  histórico o una migración de repositorio invalidan todas las ventanas a la vez.
  Es un riesgo aceptado: el `skipIf` de 2.3 lo convierte en salto, no en rojo, y
  el caso de 2.3 que prohíbe saltar en CI lo haría visible enseguida.
- **Depende de `fetch-depth: 0`** en el job `Checks`. Ya lo vigila
  `tests/version-bump-gate.test.ts` (SPEC-038 CA-13) y no se duplica aquí, pero
  la dependencia es real y ahora tiene dos consumidores en vez de uno.
- **La meta-guardia es análisis de texto sobre fuente**, con los límites que eso
  tiene: es el estilo que este proyecto ya usa (`casos()`, `sinComentarios`, el
  recuento de subcomandos de `tests/version-bump-gate.test.ts`), y como toda
  guardia textual puede rodearse con suficiente empeño. No pretende ser una
  prueba: pretende que colarlo requiera intención.
- **Aparcado, y se declara:** el título del bloque de
  `tests/deploy-gate-workflow.test.ts:467` sigue diciendo *«el diff contra
  origin/main»* cuando su mecanismo es ya una ventana fija. Es prosa engañosa en
  un fichero **ajeno y sano**. No se toca sin arbitraje del humano (SPEC-048,
  §Notas para el gate humano).

## Alternativas consideradas

- **Borrar los tres casos rojos.** Es una de las dos salidas legítimas de
  `FOUNDATION.md`, y para el caso 1.4 de SPEC-042 fue la correcta. **Rechazada
  aquí por el humano (2026-08-22)**: lo que afirman —que aquella entrega estuvo
  acotada y que las tres guardias ajenas se ampliaron sin aflojarse— es un hecho
  sobre unos commits concretos que **sigue siendo cierto y sigue siendo
  comprobable**. Borrarlo tira el valor de auditoría que el arbitraje del
  2026-08-22 quería preservar.
- **Dejarlo en `FOUNDATION.md` sin mecanismo.** Es el statu quo desde el
  2026-08-20. **Rechazada por evidencia directa**: aguantó dos días. Una
  convención sin guardia que la ejecute compite con la prisa, y pierde.
- **Prohibir toda guardia por diff en `tests/`** (todo criterio de gate fuera de
  la suite, sin excepción). Más simple de enunciar y de vigilar. **Rechazada**:
  mataría `tests/deploy-gate-workflow.test.ts` CA-9 y
  `tests/neon-preview-cleanup-workflow.test.ts` CA-1, que son auditoría útil,
  correctamente anclada y que ya sobrevivieron a varios merges. La regla no es
  *«no midas diffs»*, es *«no midas diffs contra una diana que se mueve»*.
- **Recalcular la base con `git merge-base origin/main HEAD`** en vez de anclar.
  Parece que arregla el caso: la base de fusión de una rama sin mergear es
  estable. **Rechazada**: después del merge, `merge-base(origin/main, HEAD)` en
  `main` es `HEAD` mismo, y el diff vuelve a quedar vacío. Es la misma diana
  móvil con otro nombre.
- **Guardar el diff esperado como fixture** (un `.patch` committeado y comparado
  byte a byte). No necesita git en tiempo de test. **Rechazada**: congela el
  formato del diff, no el hecho; se rompe con cualquier cambio de opciones de git
  y no es más legible que dos sha con su comentario al lado.
- **Marcar los casos con `it.skip` hasta decidir.** **Rechazada de plano**: es
  literalmente la tercera salida que `FOUNDATION.md` declara ilegítima —dejar el
  fichero en verde y el gate sin nada dentro—, y es lo que las doce aserciones
  vacías ya estaban haciendo sin querer.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
