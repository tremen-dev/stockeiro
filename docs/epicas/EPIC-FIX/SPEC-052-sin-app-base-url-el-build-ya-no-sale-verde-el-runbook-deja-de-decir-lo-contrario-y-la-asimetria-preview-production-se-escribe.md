---
id: SPEC-052
tipo: spec
epica: EPIC-FIX
estado: en-revision
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-23, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-24, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-24, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-08-24, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-08-24, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-08-24, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-08-24, por: sdd-implementador}
---
# SPEC-052 — Sin `APP_BASE_URL` el build ya no sale verde: el runbook deja de decir lo contrario y la asimetría Preview/Production se escribe

## Problema

**`docs/despliegue.md` afirma, en su sección 0, algo que hoy es falso — y lo afirma
con la seguridad de quien lo ha comprobado.** Líneas 110-111 del fichero, dentro del
aviso de `APP_BASE_URL`:

> «Y ojo: el error es en tiempo de **petición**, no de build, así que el deploy sale
> verde igualmente.»

Era cierto y dejó de serlo. **SPEC-051**, mergeada el **2026-08-23**, puso
`metadataBase: new URL(appBaseUrl())` en el export `metadata` del layout raíz
(`src/app/layout.tsx`). `appBaseUrl()` (`src/lib/config/app-url.ts`) **lanza** si la
clave falta, y la declaración de `metadata` se evalúa **al construir**. Desde ese
merge, un `next build` sin `APP_BASE_URL` no arranca: revienta recogiendo datos de
página.

### No es teoría: tumbó un despliegue el mismo día

El despliegue de **Preview del PR #58** falló con este log de Vercel:

```
[✓] migrations applied successfully!
> next build
✓ Compiled successfully in 8.3s
Collecting page data using 1 worker ...
Error: Failed to collect configuration for /_not-found
  [cause]: Error: APP_BASE_URL no definida (ver .env.example): sin ella no hay enlaces válidos.
> Build error occurred
Error: Command "node scripts/guard-migrate.mjs && npm run db:migrate && npm run build" exited with 1
```

El artefacto **no llegó a existir**. No es que el deploy saliera verde con una
funcionalidad rota: es que no hubo deploy.

### La segunda prueba: el documento no está desactualizado, está engañando

Un agente documentalista leyó ese mismo párrafo **el mismo día, después del
incidente**, y reportó que el residual era *«técnicamente correcto (el build no falla
sin la variable)»*. Es decir: el documento **convenció a un lector** de exactamente lo
contrario de lo que acababa de ocurrir, con el log del fallo a un `git log` de
distancia.

Esa es la diferencia que fija la severidad de esta spec. Un documento obsoleto calla;
este **habla**, y lo que dice tiene la forma de una comprobación ya hecha («y ojo»,
«igualmente»), que es precisamente la forma que desactiva la comprobación del lector.
`docs/despliegue.md` es un **documento de verdad** —el hook `protege-verdad` lo trata
como tal— y su valor entero descansa en que quien lo lee no vuelva a medir. Una frase
así no cuesta una lectura equivocada: cuesta la confianza en el resto del fichero.

### La causa raíz es más ancha que el párrafo

El párrafo era el síntoma. **La causa es que el entorno Preview de Vercel no tiene las
mismas claves que Production, y eso no estaba escrito en ningún sitio.** Verificado con
`vercel env ls` el **2026-08-23**:

| Dónde vive | Claves |
|---|---|
| **Solo Production** | `APP_BASE_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET`, `TWELVE_DATA_API_KEY` |
| **Production y Preview** | `MARKETSTACK_API_KEY`, `DATABASE_*`; y en Preview además `AUTH_*` y `ALLOW_MIGRATE` |

Mientras `APP_BASE_URL` solo se leía **en tiempo de petición**, su ausencia en Preview
era **invisible**: nadie pide un reset de contraseña en una preview. En cuanto pasó a
leerse **en build**, la ausencia dejó de ser invisible de golpe y **todas** las
previews empezaron a fallar. Producción nunca estuvo en riesgo: allí la clave sí
estaba.

Dicho de otra forma, y esto es lo que hay que evitar que se repita: **mover una lectura
de entorno de tiempo de petición a tiempo de build cambia el conjunto de entornos que
necesitan esa clave, y hoy nada en el repositorio lo dice ni lo comprueba.**

### Por qué la CI no lo cazó, que es la pieza que faltaba

Porque la CI **sí tenía la clave**. `.github/workflows/ci.yml`, job `E2E`, define
`APP_BASE_URL: http://localhost:3200` en su bloque `env` y con eso ejecuta
`npm run build`. La PR de SPEC-051 pasó su check de CI en verde y falló en Vercel al
mismo tiempo, sobre el mismo commit.

Ahí está la asimetría exacta que nadie tenía escrita: **el entorno de build de la CI es
un superconjunto del entorno de build de Preview**. Mientras eso sea cierto y no se
vigile, la CI puede seguir dando verdes que Vercel desmiente.

### El arreglo de ops ya está hecho, y esta spec NO lo rehace

El **2026-08-23** el humano añadió `APP_BASE_URL` al entorno **Preview** con valor
`https://stockeiro.tremen.dev`. El redespliegue del PR #58 pasó en **53 s** y las PR
posteriores salen verdes. Esta spec **documenta y protege**; no vuelve a aprovisionar
nada.

### Lo que este defecto NO es

- **No es un defecto de `appBaseUrl()`.** Que lance en build es **diseño deliberado**
  de SPEC-051 (§Diseño **D-4**, riesgo **R-2**), arbitrado y aprobado en su gate: una
  tarjeta de vista previa que en producción apunta a `localhost` es peor que un build
  rojo. Esta spec **no toca esa conducta** (CA-14). Revisarla sería otra spec y otra
  conversación.
- **No es un defecto de la CI.** El job `E2E` hace lo correcto teniendo la variable:
  sin ella, el gate no podría construir. Lo que falta no es quitarla de la CI, es
  **declarar que quien la necesita en CI la necesita también en Preview**.
- **No es un fallo silencioso** (CE-F2). Fue ruidoso y rojo. Lo silencioso fue el
  **documento**, que es otra cosa y es de lo que va esta spec.

## Usuarios / roles afectados

- **El titular/operador (Alberto Fojo)**, que es quien lee el runbook para decidir si
  puede desplegar y quien paga con un despliegue roto que el runbook mienta.
- **Cualquier agente del ciclo tremen-sdd** que lea `docs/despliegue.md` como fuente:
  ya hay un caso registrado de un agente convencido por la frase falsa el mismo día del
  incidente.
- **Quien escriba la siguiente spec que lea una variable de entorno en tiempo de
  build**: hoy no tiene forma de enterarse de que acaba de romper todas las previews.
- **Indirectamente, los testers externos** (EPIC-004): una preview que no construye es
  una PR que no se puede enseñar antes de mergear.

## Diseño

Las cuatro decisiones que sostienen los criterios de abajo. Van aquí y no en un ADR por
lo que se explica en §Notas para el gate humano (punto 3).

- **D-1 — La fuente de «qué exige el build» es el bloque `env` del job de CI que
  construye, y se *deriva*, no se copia.** Ese bloque es hoy la única declaración
  ejecutable que el repositorio tiene del asunto: el job `E2E` corre `npm run build` en
  un runner donde **no hay definido nada más**, así que lo que lleva es exactamente lo
  que el build exige para no caerse. Además ya está **congelado con `toEqual`** en
  `tests/ci-workflow.test.ts` (caso 5.1), de modo que añadir una clave de build obliga
  a tocar ese fichero: hay un punto de paso obligatorio, y esta spec lo aprovecha en
  vez de crear otro.
  *Rechazadas*: **(a)** una lista nueva en un fichero propio (`build-env.json` o
  similar) — es una **segunda fuente** que nada obliga a mantener y que diverge en
  silencio, el mismo defecto que esta spec viene a arreglar; **(b)** análisis estático
  del grafo de imports desde `layout.tsx` para descubrir lecturas de `process.env` en
  ámbito de módulo — ni es completo (hay lecturas indirectas) ni es estable ante un
  refactor, y una guardia incompleta que parece completa es peor que ninguna;
  **(c)** preguntar a la API de Vercel — ver D-2.
  *Coste aceptado y declarado*: la derivación es una **sobreaproximación segura**. Si
  el bloque llevara una clave que el build no necesita **estrictamente** (candidata:
  `AUTH_TRUST_HOST`), la guardia exigirá documentarla como necesaria en Preview. El
  error caro es el otro: exigir de más cuesta una entrada en un panel; exigir de menos
  cuesta **todas** las previews.

- **D-2 — La guardia cruza el *runbook* contra la *CI*, nunca contra Vercel.** Saber
  qué claves tiene realmente el entorno Preview exige hablar con la API de Vercel:
  credencial, red y un secreto en la suite. Queda **fuera** (F-SPEC-052-1). Lo que sí
  se puede afirmar sin salir del árbol es esta implicación, que es la que se rompió:
  *si el build exige una clave, el runbook tiene que decir que Preview la necesita.*
  El runbook pasa así de prosa a **lista de comprobación con guardia detrás**, y la
  única prueba imposible de falsear de que Preview la tiene sigue siendo **que una PR
  construya verde** — exactamente el mismo argumento que el runbook ya da para
  `ALLOW_MIGRATE` (§13.2, F-SPEC-032-2).

- **D-3 — La comprobación es una función pura sobre dos cadenas, y se prueba en
  rojo.** Extraer el parseo (`clavesQueExigeElBuild(yaml)` y
  `entornosDeclarados(markdown)`) permite ejercitar el **camino rojo** con cadenas de
  prueba dentro del propio test. Es la única defensa real contra el verde vacío que
  ADR-031 documenta y que este proyecto ya pagó cinco veces: una guardia que nunca se
  ha visto fallar no es una guardia, es una decoración. Va acompañada de dos centinelas
  de no-vacuidad (CA-9, CA-10).

- **D-4 — La guardia no usa `git`, y por construcción cumple RI-03.** Lo que afirma es
  una **propiedad del estado del árbol** (*«el runbook y el workflow concuerdan»*), no
  un criterio sobre un delta. Es cierta hoy, mañana y después de mergear. Por tanto no
  necesita ventana de dos sha, ni `skipIf`, ni centinela de ventana: no hay revisión
  que anclar. La meta-guardia de SPEC-048 pasa sobre ella sin excepciones. Lo único de
  esta entrega que **sí** es criterio de gate —*«esto no toca `src/`»*— se queda fuera
  de la suite y se verifica en el gate, con su evidencia en el ledger (CA-15).

- **D-5 — La asimetría de Preview no se corrige: se convierte en decisión escrita.**
  Arbitrado por el humano en el gate del **2026-08-24**. `TWELVE_DATA_API_KEY`,
  `RESEND_API_KEY`, `RESEND_FROM` y `CRON_SECRET` **siguen solo en Production**, y el
  motivo es que **una preview no debe gastar cuota de proveedores externos ni poder
  mandar correo de verdad**. La consecuencia —en una preview el buscador de símbolos no
  busca, no sale ni un correo y el cron no se puede probar— es el **precio aceptado, no
  un defecto**. Lo que esta spec cambia no es la configuración sino su **estatuto**: de
  ambigüedad no escrita a decisión con motivo, para que el runbook le responda solo a
  quien pase por ahí y piense *«esto está mal configurado»*. Es la diferencia entre una
  asimetría y un descuido, y es lo que hace que la columna de CA-4 valga algo: una
  columna que solo dijera *dónde está* cada clave describiría el panel; esta dice además
  *por qué*, que es lo que impide que alguien la «arregle» sin saber que no está rota.

- **D-6 — Un fichero de ejemplo trae el valor de desarrollo, no uno de producción.**
  Arbitrado por el humano el **2026-08-24** (CA-17). `.env.example` proponía
  `APP_BASE_URL="https://stockeiro.app"`, un dominio **inventado** que ni es el real
  (`https://stockeiro.tremen.dev`) ni sirve para desarrollar, y que obligaba a §0 a
  **salir a desmentirlo en otro fichero**. Pasa a `http://localhost:3000`. La regla que
  queda: un `.env.example` se copia a `.env` y se usa tal cual en local, así que sus
  valores por defecto tienen que **funcionar en local**; un valor de producción ahí es
  una trampa que solo se desactiva leyendo un segundo documento — y la lección entera de
  esta spec es que el segundo documento puede estar mintiendo.

- **D-7 — La guardia ajena de SPEC-051 CA-17.1 se RE-ENCUADRA, no se retira; y lo que se
  corrige es un error de converso.** Autorizado nominalmente por el humano (Alberto Fojo)
  el **2026-08-24**; detectado y **escalado sin tocarlo** por el implementador; redactado
  por el arquitecto, que es quien no se beneficia de que la guardia calle.

  **El diagnóstico, confirmado y afinado.** La aserción de
  `tests/tarjeta-guardias-ampliadas.test.ts:118-126` confunde **mencionar** con
  **re-encuadrar**. Su propio comentario declara la inferencia en que se apoya: *«si
  alguien re-encuadrara un tercer fichero ajeno tendría que escribir su porqué al lado
  —lo exige CA-17.2— y ese porqué nombra la spec»*. Eso es una condición **necesaria**
  (*todo re-encuadre menciona SPEC-051*) usada como **suficiente** (*toda mención es un
  re-encuadre*). El converso no se sigue, y lo paga el primero que cite legítimamente a
  SPEC-051 — que resulta ser **esta misma entrega**, obligada a citarla por CA-2 (a) y
  CA-14. La guardia se rompe **por cumplir la spec**, no por incumplirla.

  **Su forma, nombrada: un conjunto cerrado sobre un universo abierto.** Los ficheros que
  *pueden* mencionar `SPEC-051` crecen sin límite; la lista contra la que se comparan está
  congelada el día de la entrega. Es la familia de `F-SPEC-034-6` (*«drizzle/ tiene nueve
  `.sql`»*), no la de ADR-031: **caduca por instantánea, no por diana móvil**. Por eso la
  meta-guardia de SPEC-048 no la vio — vigila revisiones móviles de git, y aquí no hay
  ninguna: es una propiedad del árbol, formalmente impecable ante ADR-031, y aun así
  caduca.

  **Por qué re-encuadrar y no retirar.** Porque la proposición **sigue viva y no está
  cubierta en ningún otro punto del fichero**. Verificado leyendo sus cuatro bloques:
  **CA-17.2** recorre `GUARDIAS` —las dos— y exige que su porqué esté escrito;
  **CA-17.3** comprueba que **de esas dos** no se apagó ni se aflojó nada, con prueba por
  mutación incluida; **CA-17.4** protege las hermanas, el matcher sin rutas de producto y
  `PUBLIC_PREFIXES`. **Ninguno dice absolutamente nada sobre un tercero.** Retirar la
  aserción dejaría sin dueño el único punto que vigila *«no hubo un tercero»*. Eso separa
  este caso del de SPEC-050 resuelto esta madrugada (SPEC-053 CA-13), donde lo vigilado ya
  **no podía volver a ser cierto** y borrar era la salida correcta. Aquí sí puede: mañana
  alguien puede aflojar una tercera guardia ajena, y eso es exactamente lo que no debe
  pasar en silencio.

  **El re-encuadre.** El conjunto deja de cerrarse sobre la cadena `SPEC-051` y pasa a
  cerrarse sobre **la firma de un re-encuadre autorizado**. Y esa firma **ya está
  definida**: la define CA-17.2 al exigir que toda ampliación autorizada por SPEC-051
  lleve, en el cuerpo de su caso, `SPEC-051` + `CA-17` + `2026-08-23` + *arbitraje del
  humano* + *Qué vigilaba antes* + *Qué vigila ahora*. Una cita en prosa no produce esa
  conjunción; un re-encuadre autorizado sí, **por obligación de CA-17.2**. Es decir: el
  re-encuadre no inventa un criterio nuevo — hace que el **mecanismo** coincida con la
  **inferencia que la guardia ya declaraba** como su propia justificación.

  **Qué NO mejora, y hay que decirlo en voz alta.** Un re-encuadre **mudo** —aflojar una
  tercera guardia ajena sin escribir nota alguna— no lo caza ninguna de las dos versiones.
  **Tampoco lo cazaba la original**: su detección siempre dependió de que el infractor
  escribiera la nota. La cobertura frente al fallo real es **idéntica**; lo único que
  desaparece es el **falso positivo**. Ese hueco pertenece a la meta-guardia futura (ver
  §Fuera de alcance), no a esta spec.

  **Rechazado, y consta que no se hizo:** partir, interpolar o disfrazar el literal
  `'SPEC-051'` para que la cadena no case (CA-18 f). Es aflojar en silencio y a favor de
  quien se beneficia — prohibido por `FOUNDATION.md`. El implementador dejó constancia de
  que no lo hizo, y esta spec lo prohíbe por escrito para que tampoco lo haga el siguiente.

## Criterios de aceptación

Numeración: **CA-1 … CA-18**. Los que no se pueden probar con un test están marcados
**n-a** de forma explícita, con el motivo y con dónde se verifican en su lugar; ninguno
se disfraza de test. **CA-17 y la parte (b) de CA-4 nacen del arbitraje humano del
2026-08-24**; la nota de CA-3 se ajustó por efecto de CA-17. **CA-18 nace de una guardia
ajena rota que el implementador escaló sin tocar** (autorizada por el humano el
2026-08-24, redactada por el arquitecto); **CA-14 se corrigió** al descubrirse que su
premisa era falsa (F-SPEC-052-8).

### El párrafo deja de mentir

- **CA-1** — *La frase falsa desaparece, y no puede volver por copia.* Dado
  `docs/despliegue.md`, cuando se busca en todo el fichero, entonces **no aparece**
  ninguna de las afirmaciones retiradas: `el error es en tiempo de **petición**, no de
  build`, `así que el deploy sale verde igualmente`. El caso lleva la lista literal de
  frases prohibidas con la fecha y el motivo al lado. Molde:
  `tests/ayuda-afirmaciones-prohibidas.ts`, `tests/spec043-formulas-prohibidas.ts`.
  Su no-vacuidad la garantiza CA-2, que corre en el mismo bloque y exige contenido
  positivo en el mismo párrafo.

- **CA-2** — *Lo que dice en su lugar.* Dado el aviso de `APP_BASE_URL` en §0, entonces
  afirma las tres cosas: **(a)** que `appBaseUrl()` se evalúa **en tiempo de build**
  desde el export `metadata` del layout raíz (SPEC-051); **(b)** que sin la variable
  **`next build` falla y el despliegue no llega a existir** — no es un deploy verde con
  algo roto, es la ausencia de deploy; y **(c)** que ocurrió el **2026-08-23** en el
  **PR #58**, con el error del log (`Failed to collect configuration for /_not-found`)
  citado literalmente para que sea reconocible si vuelve. Y **(d)** el **origen real
  vigente**: hoy el párrafo dice *«(hoy `https://stockeiro-lemon.vercel.app`)»* y eso
  **contradice a su propio fichero once líneas más arriba**, donde §0 declara
  `https://stockeiro.tremen.dev` como dominio principal desde el 2026-08-17 y cierra
  F-SPEC-023-3 con ese valor. Se corrige a `https://stockeiro.tremen.dev`. Test:
  presencia de esos literales; y el dominio `stockeiro-lemon.vercel.app` **no** aparece
  como «el origen real» en el aviso.

  > **Hallazgo del 2026-08-24, para el gate**: ese *«hoy `stockeiro-lemon`»* es una
  > **segunda afirmación falsa en el mismo párrafo**, distinta de la que originó la
  > spec y encontrada al reverificar contra `3b6fc8b`. Entra en alcance porque es el
  > párrafo que ya se está reescribiendo y es exactamente la misma familia de defecto:
  > una frase que fue cierta, dejó de serlo y sigue afirmándose con aire de comprobada.

- **CA-3** — *El arreglo no tira lo que sí seguía siendo cierto.* Dado el mismo aviso,
  entonces **conserva** la advertencia de que `appBaseUrl()` falla ruidosamente si la
  variable **falta** pero **no puede detectar que esté mal**, y que un origen
  equivocado solo lo ve quien pincha el enlace. Test: presencia del literal. Existe
  porque la salida fácil de un párrafo que miente es borrarlo entero, y aquí una parte
  era verdad y sigue siendo útil.
  **Lo que CA-3 ya NO exige conservar** (ajustado el 2026-08-24 por CA-17): el
  desmentido del valor de ejemplo —*«no el valor de ejemplo de `.env.example`
  (`https://stockeiro.app`, un dominio propio que quizá no exista aún)»*—. Con CA-17,
  `.env.example` deja de traer ese dominio y el desmentido pasa a **no tener a quien
  desmentir**: conservarlo sería dejar en §0 una advertencia sobre un valor que ya no
  existe, que es otra vez prosa que envejece sola. Se retira.

### La asimetría Preview/Production se escribe

- **CA-4** — *La tabla de §0 gana una columna de entorno, ninguna fila queda sin marcar,
  y lo que hoy es ambigüedad pasa a ser decisión con motivo.* Dos partes, ambas
  exigidas:

  **(a) La columna.** Dada la tabla de §0 (`| Variable | Servicio | Para qué | Spec |`),
  entonces gana una columna **Entornos** y **cada** fila declara un valor de un
  vocabulario **cerrado** —`Production`, `Preview + Production`, `Opcional`— sin celdas
  vacías, sin guiones y sin texto libre. Test: parseo de la tabla; toda fila tiene un
  valor del conjunto cerrado. El vocabulario es cerrado a propósito: una columna que
  admite prosa vuelve a ser prosa, y el cruce de CA-8 dejaría de poder leerla.

  **(b) El motivo de las que son solo de Production** (arbitrado 2026-08-24, D-5). Dado
  que `TWELVE_DATA_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM` y `CRON_SECRET` quedan
  marcadas `Production`, entonces §0 declara **junto a la tabla** que eso es
  **deliberado** y por qué: *una preview no debe gastar cuota de proveedores externos ni
  poder mandar correo de verdad*; y declara la consecuencia como **precio aceptado**: en
  una preview **el buscador de símbolos no busca, no sale ni un correo y el cron no se
  puede probar**. Test: presencia de esos literales, y de las cuatro claves marcadas
  `Production`.

  El porqué de (b), que es el punto entero del arbitraje: sin él, la columna solo
  describe el panel, y el primero que la lea concluirá que Preview está mal configurado
  y «lo arreglará». **El runbook tiene que poder responderle solo.** Una asimetría con
  motivo escrito es una decisión; sin él es un descuido, y este proyecto ya sabe lo que
  cuesta confundir las dos cosas.

- **CA-5** — *La foto del panel queda escrita, fechada y etiquetada como foto.* Dada
  §13 (*la configuración que no vive en el repositorio*), entonces incluye un apartado
  con el **inventario por entorno medido con `vercel env ls` el 2026-08-23** —
  solo Production: `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET`,
  `TWELVE_DATA_API_KEY`; en ambos: `MARKETSTACK_API_KEY`, `DATABASE_*`, `AUTH_*`,
  `ALLOW_MIGRATE`, y `APP_BASE_URL` **desde ese mismo día** — y dice explícitamente que
  es una **foto fechada de un panel que el repositorio no puede leer**, no una fuente
  de verdad viva. Test: presencia del apartado, de la fecha y del comando que lo
  produjo. Que los valores sigan siendo ciertos mañana **no** lo puede afirmar ningún
  test (F-SPEC-052-1), y por eso la etiqueta de «foto» es parte del criterio.

- **CA-6** — *El arreglo de ops consta como hecho, no como pendiente.* Dado el runbook,
  entonces registra en §13 —junto a `ALLOW_MIGRATE=1 en Preview`, que es su gemelo
  exacto— que **`APP_BASE_URL` se añadió al entorno Preview el 2026-08-23** con valor
  `https://stockeiro.tremen.dev`, y que el redespliegue del PR #58 pasó. Y §5 gana la
  línea de checklist correspondiente. Test: presencia de ambos. Un runbook que pide
  hacer otra vez algo ya hecho gasta la atención que necesita para lo que sí falta.

- **CA-7** — *Preview deja de presentarse como opcional para las claves que el build
  exige.* Dado §3.2, entonces **no** aparecen las frases que hoy lo hacen opcional
  —`repite para Preview si quieres previews funcionales` (§3.2) y `repite en Preview si
  lo usas` (§7 paso 2)— y en su lugar el bloque distingue las claves **obligatorias en
  Preview porque el build las lee** de las que solo hacen la preview más útil. Test:
  frases prohibidas ausentes + literal nuevo presente.

### La guardia: lo que el build exige, cruzado con lo que el runbook promete

Guardia nueva en `tests/` (nombre propuesto: `tests/entornos-de-despliegue.test.ts`).
No usa `git` (D-4).

- **CA-8** — *Toda clave que el build exige está declarada como exigida también en
  Preview.* Dado el conjunto de claves derivado del bloque `env` del job de
  `.github/workflows/ci.yml` **cuyos `steps` contienen un `run` con `npm run build`**
  —localizado por su contenido, no por su nombre—, y dada la columna **Entornos** de la
  tabla de §0 de `docs/despliegue.md`, entonces **cada** clave del conjunto aparece en
  la tabla con valor `Preview + Production`. Si falta una fila, o si una está marcada
  `Production` a secas, el test **falla**.

- **CA-9** — *Centinela de no-vacuidad del conjunto derivado.* Dado que un localizador
  roto dejaría el conjunto vacío y CA-8 en verde **sin haber mirado nada** —que es el
  modo de fallo exacto que ADR-031 documenta—, entonces un caso del mismo bloque
  afirma: se ha encontrado **exactamente un** job con un `run` de `npm run build`; su
  conjunto de claves **no está vacío**; y contiene **`APP_BASE_URL`** y
  **`DATABASE_URL`**, las dos que hoy se sabe que el build lee.

- **CA-10** — *Centinela de no-vacuidad del parseo de la tabla.* Dado que un parser que
  no case con ninguna fila dejaría CA-4 y CA-8 en verde por vacío, entonces un caso
  afirma que la tabla parseada tiene **al menos 11 filas** (las claves que §0 lleva
  hoy) y que **`APP_BASE_URL`** y **`MARKETSTACK_API_KEY`** están entre ellas con su
  celda de entorno no vacía. La cota es inferior y no exacta: §0 crecerá, y un recuento
  exacto sería congelar el estado del árbol — lo que `FOUNDATION.md` prohíbe.

- **CA-11** — *La guardia se prueba en rojo, con su propia entrada.* Dado que la
  comprobación es una **función pura** sobre dos cadenas (D-3), cuando se le pasa un
  runbook de prueba en el que `APP_BASE_URL` figura como `Production` a secas, entonces
  **devuelve un incumplimiento** cuyo mensaje **nombra la clave** y dice **qué pasa si
  no se arregla** (*«el build de Preview de toda PR fallará en `next build`»*); y con la
  misma cadena corregida a `Preview + Production`, **no devuelve ninguno**. Los dos
  sentidos, en el mismo bloque. Es el criterio que impide que esta guardia sea otra
  decoración verde.

### `.env.example` deja de inducir el mismo error

- **CA-12** — *La plantilla admite que Vercel tiene más de un entorno.* Dado
  `.env.example`, entonces su cabecera **no** dice que las claves se definen «en
  producción (Vercel) … en Settings → Environment Variables del proyecto» como si
  hubiera **un solo** entorno, y en su lugar declara que hay **Production, Preview y
  Development**, que **no todas las claves viven en todos**, y que las que el **build**
  lee tienen que existir **también en Preview** — remitiendo a §0 del runbook como
  fuente. Test: frase prohibida ausente + literal nuevo presente.

- **CA-13** — *El comentario de `APP_BASE_URL` en la plantilla dice la consecuencia
  entera.* Dado el bloque de `APP_BASE_URL` en `.env.example`, entonces **añade** a lo
  que ya dice (*«si falta o apunta mal, los enlaces no funcionan en absoluto»*, que
  sigue siendo cierto) que **desde SPEC-051 su ausencia rompe el `next build`**. Test:
  literal presente. Se **añade**, no se sustituye: la consecuencia vieja no se ha ido,
  se le ha sumado otra peor.

- **CA-17** — *El valor de ejemplo de `APP_BASE_URL` es el de desarrollo, no un dominio
  de producción inventado.* (Arbitrado por el humano el **2026-08-24**; ver D-6.) Dado
  `.env.example`, entonces `APP_BASE_URL` vale **`http://localhost:3000`** y el dominio
  **`stockeiro.app` no aparece** como valor de esa clave. Test: el valor literal está, y
  `APP_BASE_URL="https://stockeiro.app"` no. **Efecto colateral exigido, no opcional:**
  §0 **retira** el desmentido de ese valor de ejemplo (ver CA-3), porque deja de tener a
  quien desmentir; y el aviso de §0 sigue diciendo que la variable debe ser el **origen
  real del despliegue** (CA-2 d), que es la parte que no dependía del ejemplo.

  **Enmienda del 2026-08-25 — la propiedad detrás del literal (viene de `D-SPEC-055-1`).**
  Lo anterior congela **un literal**; esto añade **la propiedad que ese literal
  representa**, que es la parte que sobrevive a que un día se cambie el valor con
  autorización. Es el patrón *hermana* que este repositorio ya nombra —una foto del árbol
  y, en su mismo fichero, un caso que mide la propiedad— y que el propio
  `tests/tarjeta-guardias-ampliadas.test.ts` enuncia en su cabecera. Escribir en esta
  entrega un literal congelado **sin** su hermana, siendo esta la entrega que formalizó la
  distinción en CA-18, sería incoherente.

  **(c) El valor de ejemplo de `.env.example` es un valor que `appBaseUrl()` acepta.**
  Dado el valor de `APP_BASE_URL` leído de `.env.example`, cuando se pasa a
  `appBaseUrl({ APP_BASE_URL: <valor> })`, entonces **no lanza** y devuelve el mismo
  origen. Tres condiciones sobre cómo se escribe:

  1. **Se llama a la función; no se reescriben sus reglas.** La aserción **invoca**
     `appBaseUrl()`. Queda **prohibido** replicar aquí su criterio con una expresión
     regular o una lista de comprobaciones propias. SPEC-055 es la **única dueña** de qué
     es un origen usable —protocolo, credenciales, query, fragmento y ruta, sus cuatro
     condiciones— y restatearlas aquí convertiría a SPEC-052 en **segunda dueña** del
     mismo contrato: exactamente lo que SPEC-055 evitó al aflojar a propósito su propia
     aserción sobre el mensaje para que CA-14 fuese el único dueño de aquel literal. Un
     contrato con dos dueños diverge; la forma de tener uno solo es **ejecutarlo**.
  2. **Centinela de no-vacuidad.** Un lector que no case ninguna línea dejaría el caso en
     verde sin haber mirado nada. Un caso del mismo bloque afirma que el valor extraído
     **no está vacío** y que es **el que CA-17 (a) congela**; y que el lector aplicado a
     un `.env.example` sintético **sin** la clave **no devuelve un valor**, sino que falla
     de forma reconocible.
  3. **Se prueba en rojo.** Con un `.env.example` sintético cuyo `APP_BASE_URL` lleve una
     **ruta** (p. ej. `http://localhost:3000/app`) —el caso que SPEC-055 documenta como el
     que significaría dos cosas distintas según quién lo lea—, la comprobación **falla**.
     Misma exigencia que CA-11 y CA-18 (c), y por la misma razón.

  Por qué entra aquí y no en un residual: **el valor lo cambia esta spec**, así que quien
  lo cambia es quien responde de que sirva; y la propiedad vive en el **fichero propio** de
  esta entrega, sin tocar nada ajeno, sin `git` y sin ensanchar CA-15. Cuenta como
  **enmienda a CA-17**, no como criterio decimonoveno: el humano aprobó *«el valor de
  ejemplo es el de desarrollo»*, y *«y de verdad sirve»* es la forma-propiedad de ese mismo
  criterio, no alcance nuevo. Origen: petición **`D-SPEC-055-1`** de SPEC-055, detectada
  por su arquitecto y **no ejecutada por el implementador** —correctamente— porque ningún
  CA aprobado la pedía. La decide sdd-arquitecto el **2026-08-25**.

  Nota de alcance, para que nadie la amplíe sola: `RESEND_FROM` sigue proponiendo
  `Stockeiro <avisos@stockeiro.app>` y **no se toca aquí**. Ese sí es un ejemplo de
  formato de remitente y no un valor que ningún build vaya a leer; cambiarlo es otra
  conversación y no se cuela en esta.

### Lo que esta spec no toca, y por qué queda escrito

- **CA-14** — *La conducta que causó el incidente se conserva a propósito, y por fin
  tiene un test propio.* Dado `appBaseUrl()` con `APP_BASE_URL` ausente del entorno,
  entonces **lanza**, y el mensaje es **el mismo que aparece en el log de Vercel del
  PR #58**: `APP_BASE_URL no definida (ver .env.example): sin ella no hay enlaces
  válidos.` El caso lleva escrito al lado que esto es **deliberado** (SPEC-051 D-4/R-2,
  arbitrado en su gate) y que **SPEC-052 no lo revisa**. Test: el caso, con la nota y con
  la aserción sobre el mensaje — que es lo que ata el literal que CA-2 (c) exige en el
  documento al literal que el código lanza.

  **Corrección de la premisa (2026-08-24, cierra F-SPEC-052-8).** La redacción original
  de este CA decía *«si el caso ya existe (SPEC-023), se le añade la nota y no se
  duplica»*. **Ese caso no existía.** El implementador lo buscó por símbolo, por módulo y
  por mensaje: la única cobertura viva era un test **estático sobre el texto** de
  `layout.tsx`. O sea que la función cuya excepción tumbó **todas** las previews **no
  tenía ni un test unitario**. El motivo es instructivo y por eso queda escrito: SPEC-023
  la ejercitaba solo **de paso**, dentro del flujo de recuperación de contraseña, y
  cuando SPEC-051 le dio un **segundo consumidor completamente distinto** —metadatos en
  tiempo de build— no había nada que la probara **por sí misma**. Una función con dos
  consumidores y cero tests propios es una función que solo se prueba por accidente. Así
  que el caso **se crea, una sola vez**, en el fichero de test de esta spec; la condición
  *«no se duplica»* sigue en pie.

- **CA-15** — *Esta entrega no toca `src/` ni `drizzle/`.* Dado el alcance —
  documentación y una guardia en `tests/`—, entonces el delta de la rama no contiene
  ningún fichero bajo `src/` ni `drizzle/`. **Consecuencia declarada:** `.sdd.json`
  vigila `src/` y `app/`, así que el gate `Version bump` no exigirá subida de versión y
  dirá *«el diff no toca codigo de aplicacion»*; eso es correcto aquí y no un verde
  vacío. **Estado: `n-a`.** Motivo explícito: es un **criterio sobre un delta**, y
  RI-03/ADR-031 prohíben codificarlo como test permanente —caducaría al mergear y
  pasaría a estar vacío—. Se verifica **en el gate**, con la salida de
  `git diff --name-only` de la rama pegada en el ledger.

- **CA-16** — *La afirmación nueva se prueba una vez, en el gate, no en la suite.* Dado
  un árbol con `APP_BASE_URL` ausente, cuando se ejecuta `npm run build`, entonces
  **falla** con el error de `appBaseUrl()` durante *Collecting page data*. **Estado:
  `n-a`.** Motivo explícito: un `next build` completo por pasada de suite es inviable, y
  meter en su lugar un unitario que «afirme» el fallo sin construir sería exactamente el
  verde vacío que ADR-031 prohíbe. Verificación de **gate** (RI-03, opción 2): se
  ejecuta una vez y su **salida literal** se pega en el ledger, que es lo que sostiene
  el literal que CA-2 exige en el documento.

### La guardia ajena que esta entrega rompe por cumplirla

- **CA-18** — *El re-encuadre de `tests/tarjeta-guardias-ampliadas.test.ts`, con su
  autorización escrita.* **Aserción nombrada**: `tests/tarjeta-guardias-ampliadas.test.ts`,
  **líneas 118-126** — bloque `describe('SPEC-051 CA-17.1: son DOS guardias ajenas…')`,
  caso *«los únicos ficheros ajenos de tests/ que esta spec nombra son esos dos»*,
  comparación `expect(nombran, …).toEqual(esperados)`. Motivo y elección entre las dos
  salidas legítimas: **D-7**. Seis partes, todas exigidas:

  **(a) Qué vigila ahora.** El conjunto se deriva de la **firma de re-encuadre** y no de
  la mención: un fuente de `tests/` entra si contiene, en el cuerpo de un mismo caso, la
  conjunción que **CA-17.2 ya exige** a toda ampliación autorizada por SPEC-051
  —`SPEC-051` + `CA-17` + `2026-08-23` + *arbitraje del humano* + *Qué vigilaba antes* +
  *Qué vigila ahora*—. El conjunto resultante es **exactamente los dos ficheros de
  `GUARDIAS`**. Un fichero que solo **cite** SPEC-051 en prosa **no entra**.
  Consecuencia: `PROPIOS` deja de alimentar esta aserción —era la **segunda instantánea
  congelada** del mismo caso, y los ficheros propios de SPEC-051 no llevan firma porque
  no son re-encuadres—. Se retira, o se deja explícitamente inerte con su motivo escrito;
  **no se queda como lista muerta sin explicación**.

  **(b) La autoexclusión, nombrada y probada.** Este fichero **define** la firma en sus
  propias aserciones (CA-17.2) y por tanto **la contiene**: sin tratarlo, se detectaría a
  sí mismo. La detección excluye **su propia ruta**, declarada en una constante con su
  motivo al lado. **Centinela obligatorio**: un caso afirma que la fuente de este fichero
  **sí lleva la firma** —lo que prueba que la exclusión es *necesaria* y no un blanqueo
  preventivo— y que la lista de exclusiones tiene **exactamente un elemento**. Una
  exclusión que nadie comprueba es la puerta por la que se afloja esto sin que se note.

  **(c) Se prueba en rojo, en los dos sentidos.** Misma exigencia que CA-11 y por la misma
  razón. La detección es una **función pura** `(ruta, fuente) => boolean`, no un `expect`
  incrustado. Con una fuente sintética que lleva la **firma completa**, devuelve `true`;
  con una fuente que solo dice `SPEC-051` en un comentario en prosa —**el caso exacto que
  rompía la guardia vieja**— devuelve `false`. Y un tercer caso comprueba que **añadir un
  fichero sintético con firma rompe la igualdad**, que es la prueba de que la lista sigue
  cerrada y de que un tercer re-encuadre seguiría siendo RED.

  **(d) El porqué, al lado de la aserción.** Junto a la comparación queda escrito: **qué
  vigilaba antes** (*«los ficheros de `tests/` que mencionan la cadena SPEC-051 son estos
  siete»*); **qué vigila ahora** (*«los ficheros de `tests/` re-encuadrados bajo la
  autorización de SPEC-051 CA-17 son estos dos»*); **por qué cambió** (mencionar ≠
  re-encuadrar — condición necesaria usada como suficiente; y la lista era un conjunto
  cerrado sobre un universo abierto); **en virtud de qué CA** (SPEC-052 **CA-18**); **con
  qué fecha** (**2026-08-24**); **con autorización nominal** del humano (**Alberto Fojo,
  2026-08-24**); y **constancia del proceso**: lo detectó y lo **escaló sin tocarlo el
  implementador**, y el arreglo lo **redactó el arquitecto**. Además, el porqué que
  SPEC-051 dejó en la **cabecera** del fichero **no se borra**: una re-escritura no borra
  la auditoría de la anterior — es la misma regla que CA-17.2 impone a las ampliaciones
  cuando exige `toContain('2026-08-22')`.

  **(e) No se afloja nada más del fichero.** Los otros tres bloques —**CA-17.2**,
  **CA-17.3** (incluida su prueba por mutación contra una séptima exclusión inventada) y
  **CA-17.4** (las hermanas, el matcher sin una sola ruta de producto, y `PUBLIC_PREFIXES`
  congelado)— y el caso *«`tests/deploy-gate-workflow.test.ts` ni siquiera sabe que esta
  spec existe»* quedan **intactos**. Ningún caso del fichero queda apagado
  (`it.skip`/`.only`/`.todo`/`xit`). Test: los títulos de casos del fichero son los mismos
  salvo el re-encuadrado, y ninguno lleva marca de apagado.

  **(f) Prohibido el atajo silencioso.** No se parte, interpola ni disfraza el literal
  `'SPEC-051'` en ningún fuente de `tests/` para que la cadena deje de casar. Test: ningún
  fuente de `tests/` compone esa cadena por concatenación o interpolación. Es aflojar en
  silencio y a favor de quien se beneficia; consta que el implementador **no** lo hizo, y
  queda prohibido por escrito para el siguiente.

## Entidades y reglas afectadas

### Lo que esta spec aplica sin cambiarlo

- **RI-03** / **ADR-031** — la distinción criterio-de-gate vs. propiedad. Se aplica dos
  veces: la guardia nueva es **propiedad** (no toca `git`, D-4) y los dos criterios que
  sí son sobre un delta (CA-15, CA-16) quedan **fuera de la suite**, en el gate y en el
  ledger. Los centinelas de no-vacuidad (CA-9, CA-10) y el rojo probado (CA-11) son la
  condición 2.2 de ese ADR aplicada a una guardia que no es por diff.
- **`FOUNDATION.md` § Cómo se trabaja aquí** — *un test de frontera fija una propiedad,
  no un estado del árbol*. Por eso CA-10 usa una cota inferior y no un recuento exacto.
- **ADR-018 D-1** (*mergear es desplegar*) y **D-3** (*fail-closed*) — el Preview roto
  es un incumplimiento de la primera; la asimetría documentada es lo que la sostiene.
- **SPEC-051** §Diseño **D-4** y riesgo **R-2** — el origen absoluto sale de
  configuración y `appBaseUrl()` lanza en build. **Intactos** (CA-14).
- **ADR-015 pto. 8** y **SPEC-023 CA-4** — el enlace de recuperación nunca sale de
  `Host`. Es la razón de que `APP_BASE_URL` exista; no cambia.
- **F-SPEC-032-2** — `ALLOW_MIGRATE=1` en Preview: el precedente exacto de una clave de
  entorno que solo Preview necesita y cuya única prueba real es una preview verde. El
  tratamiento de `APP_BASE_URL` se calca de ahí (CA-6).

### Ficheros que esta spec modifica

| Fichero | Qué cambia | CA |
|---|---|---|
| `docs/despliegue.md` §0 | Frase falsa fuera; origen real corregido; desmentido del ejemplo retirado; aviso reescrito; columna **Entornos** + el motivo de las solo-Production | CA-1, CA-2, CA-3, CA-4, CA-17 |
| `docs/despliegue.md` §3.2, §5, §7, §13 | Preview deja de ser opcional; checklist; foto de `vercel env ls`; el arreglo del 2026-08-23 como hecho | CA-5, CA-6, CA-7 |
| `.env.example` | Cabecera por entornos; consecuencia entera de `APP_BASE_URL`; valor de ejemplo → `http://localhost:3000` | CA-12, CA-13, CA-17 |
| `tests/entornos-de-despliegue.test.ts` (**nuevo**) | La guardia y sus centinelas; **y el primer test propio de `appBaseUrl()`**, con su nota | CA-1..CA-4, CA-7..CA-14, CA-17 |
| `tests/tarjeta-guardias-ampliadas.test.ts` (**ajeno, re-encuadrado con autorización**) | Solo el caso de las líneas 118-126; los otros tres bloques intactos | CA-18 |

Nada bajo `src/`, `drizzle/`, `vercel.json` ni `.github/workflows/`.

## Fuera de alcance

Aparcado a propósito, con su motivo:

- **Cambiar la conducta de `appBaseUrl()`** (que no lance, que caiga a un valor por
  defecto, que lea `VERCEL_URL`). Es diseño arbitrado de SPEC-051 y las tres
  alternativas están rechazadas por escrito en su §Diseño D-4. Otra spec y otra
  conversación.
- **Preguntar a Vercel qué claves tiene realmente cada entorno.** Exige la API/CLI de
  Vercel con credencial y red desde la suite. Es la guardia que de verdad cerraría el
  agujero, y **no cabe en una spec de FIX**: se declara como **F-SPEC-052-1** con
  destino EPIC-INFRA. Se dice en voz alta porque **un documento cierto sin guardia es
  mejor que una guardia falsa**.
- **Descubrir automáticamente qué variables se leen en tiempo de build** analizando el
  grafo de imports. Rechazado en D-1(b): incompleto y frágil, y una guardia incompleta
  que parece completa es peor que ninguna.
- **Poner `TWELVE_DATA_API_KEY`, `RESEND_*` o `CRON_SECRET` en Preview.** **Resuelto en
  el gate del 2026-08-24: no se ponen, y es deliberado** (D-5). Una preview no debe
  gastar cuota de proveedores externos ni poder mandar correo de verdad. Lo que entra en
  alcance no es la configuración sino **escribir el motivo** (CA-4 b); lo que queda
  fuera es cambiarla.
- **Tocar el resto de valores de ejemplo de `.env.example`.** `RESEND_FROM` sigue
  proponiendo `Stockeiro <avisos@stockeiro.app>`: es un ejemplo de **formato** de
  remitente y ningún build lo lee. CA-17 alcanza solo a `APP_BASE_URL`, que es la clave
  cuyo valor de ejemplo obligaba al runbook a desmentirlo.
- **Una puerta post-deploy para los despliegues de Preview.** Ya está declarada como
  `F-SPEC-028-3` y sigue igual de fuera.
- **Tocar `tests/ci-workflow.test.ts` caso 5.1.** Se apoya en él (D-1) y no lo modifica:
  aflojar el `toEqual` que congela el bloque `env` destruiría el punto de paso obligatorio
  del que esta spec depende.
- **La meta-guardia contra el patrón de CA-18.** Es el **segundo** caso del mismo molde en
  veinticuatro horas: la guardia de SPEC-050 que barría `docs/adr/` (retirada en SPEC-053
  CA-13, PR #60, aún sin mergear) y esta. Los dos comparten forma **exacta**: un
  **conjunto cerrado sobre un universo abierto**, congelado el día de la entrega, que
  caduca **no cuando algo se rompe sino cuando alguien hace algo legítimo** —citar una
  spec, añadir un ADR—. Y los dos **escapan a la meta-guardia de SPEC-048**, que vigila
  revisiones móviles de git: aquí no hay ninguna, son propiedades del árbol, formalmente
  impecables ante ADR-031 y aun así caducas. Eso es un **patrón, no un incidente**, y el
  disparador que SPEC-053 dejó anotado —*«la segunda vez»*— ha saltado. **El humano ya ha
  decidido que la meta-guardia es spec propia, después de que estas dos se mergeen**, así
  que **no se escribe aquí** y esta spec no amplía su alcance hacia ella. Lo que sí deja
  es lo que esa spec necesitará para no empezar de cero: el **segundo caso documentado**,
  su **forma nombrada** y la razón por la que la guardia existente no lo caza.

## Notas para el gate humano

Lo que necesitas para decidir, y las tres cosas que decides tú.

**1. El encaje en EPIC-FIX está validado, con precedente propio.** Es un defecto de una
capacidad **ya entregada y verificada** —el runbook de SPEC-028 y el despliegue de
Preview de ADR-018 D-1— que dejó de cumplir su promesa con uso real. Podría discutirse
EPIC-INFRA, que es donde vive el runbook; pero este proyecto ya ha resuelto tres veces
la misma disyuntiva en el mismo sentido: **SPEC-033** (la puerta post-deploy perdía la
carrera), **SPEC-048** (guardias que caducaban al mergear) y **SPEC-049** (el gate de
versión decía verde sin mirar) son todas defectos de herramienta y todas están en
EPIC-FIX. La regla implícita que siguen: **EPIC-INFRA construye la herramienta,
EPIC-FIX arregla la herramienta rota.** Aquí toca lo segundo. Si prefieres INFRA, es un
cambio de carpeta y de campo `epica`, nada más.

**2. Las cuatro piezas que pediste que considerara, con veredicto de cada una.**

| # | Pieza | Veredicto | Razón |
|---|---|---|---|
| 1 | Corregir el párrafo mentiroso | **Entra** (CA-1..CA-3) | Mínimo indispensable. Y se conserva el tercio que sí era cierto |
| 2 | Documentar la asimetría Preview/Production | **Entra** (CA-4..CA-7) | Es la causa raíz. Sin esto, el punto 1 arregla una frase y deja el mecanismo |
| 3 | Guardia contra la reincidencia | **Entra, pero acotada** (CA-8..CA-11) | Ver punto 3 de abajo: hay una propiedad honesta que sí cabe, y una que no |
| 4 | `.env.example` | **Entra** (CA-12, CA-13) | Sí induce el error: dice «en producción (Vercel), define estas claves», en singular, y nunca nombra Preview |

**3. La guardia: qué cabe honestamente y qué no.** Me pediste criterio, y este es.
**No cabe** la guardia que de verdad cerraría el agujero —comparar el runbook con lo
que Vercel tiene de verdad—: exige credencial, red y un secreto en la suite, y no es
una spec de FIX. Queda aparcada como **F-SPEC-052-1**, dicha en voz alta.
**Sí cabe** una propiedad honesta y no vacua: *cada clave que el build exige está
declarada en el runbook como necesaria también en Preview*, derivando «lo que el build
exige» del bloque `env` del job de CI que construye (D-1). Su valor real es que existe
un **punto de paso obligatorio**: añadir una lectura de entorno en build obliga a
añadir la clave al `env` de la CI (o la CI no construye), y eso obliga a tocar
`tests/ci-workflow.test.ts` 5.1 (`toEqual`), y esta guardia obliga entonces a
documentarla como necesaria en Preview. Tres eslabones, ninguno saltable en silencio.
Y contra el problema que ya pagaste en SPEC-048/ADR-031, tres defensas explícitas: dos
**centinelas de no-vacuidad** (CA-9, CA-10) y, sobre todo, la guardia **probada en
rojo** con su propia entrada (CA-11), que es lo único que distingue una guardia de una
decoración verde. **Su límite, escrito para que no se olvide: no sabe nada del estado
real de Vercel.** Si el panel pierde una clave mañana, esta guardia sigue verde. Lo
único que lo delata es una preview roja.

**4. Q-1 — RESUELTA en el gate del 2026-08-24: la asimetría es deliberada y se queda.**
`TWELVE_DATA_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM` y `CRON_SECRET` siguen solo en
Production, porque **una preview no debe gastar cuota de proveedores externos ni poder
mandar correo de verdad**. Que en una preview el buscador no busque, no salga un correo
y el cron no se pruebe es el **precio aceptado**. Incorporado en **D-5** y en la parte
**(b) de CA-4**, que exige escribir el motivo junto a la tabla y no solo la marca. Lo
que ha cambiado no es la configuración: es que deja de ser una ambigüedad que cada lector
resuelve a su manera.

**5. Q-2 — RESUELTA en el gate del 2026-08-24: `.env.example` pasa a
`http://localhost:3000`.** Entra como **CA-17** e incorporado en **D-6**. **Y obligó a
mover otro criterio**, que es lo que conviene que mires: **CA-3 ya no exige conservar el
desmentido de §0** sobre el valor de ejemplo (*«no el valor de ejemplo de `.env.example`
(`https://stockeiro.app`…)»*). Con CA-17 ese desmentido se queda **sin nadie a quien
desmentir**, y mantenerlo sería dejar en §0 una advertencia sobre un valor que ya no
existe — otra vez prosa que envejece sola, que es el defecto que esta spec persigue. El
retirarlo está ahora **exigido** por CA-17, no permitido.

**6. Un hallazgo nuevo al reverificar contra `3b6fc8b`, y entra en alcance.** El mismo
párrafo de §0 lleva una **segunda afirmación falsa**, independiente de la que originó la
spec: dice *«el origen REAL del despliegue (hoy `https://stockeiro-lemon.vercel.app`)»*
cuando **once líneas más arriba, en el mismo fichero**, §0 declara
`https://stockeiro.tremen.dev` como dominio principal desde el 2026-08-17 y cierra
F-SPEC-023-3 con ese valor. Un documento contradiciéndose a sí mismo dentro de la misma
sección. Lo he metido en **CA-2 (d)** en vez de abrir residual: es el párrafo que ya se
está reescribiendo, es la misma familia exacta de defecto —una frase que fue cierta y
sigue afirmándose con aire de comprobada— y dejarlo sería reescribir un párrafo mentiroso
y firmar debajo con la mentira que quedaba.

**7. Mi decisión sobre el ADR: NO hace falta, y no es por simetría ni por evitar el
trámite.** Me pediste que decidiera y he vuelto sobre ello. La regla de **D-1** es
**autoejecutable en el punto exacto donde se viola**: no se puede añadir una lectura de
entorno en tiempo de build sin añadir la clave al `env` del job de CI (o la CI no
construye), eso obliga a tocar el `toEqual` de `tests/ci-workflow.test.ts` 5.1, y la
guardia de CA-8 obliga entonces a documentarla como necesaria en Preview. Tres eslabones
que fallan en rojo. **ADR-031 necesitó ser ADR precisamente porque su regla no tenía
mecanismo** —su propio texto documenta que la convención en prosa *«aguantó dos días»*—
y hubo que fabricarle uno (la meta-guardia de SPEC-048) además de escribirla. Aquí el
mecanismo **es** la regla, y un ADR cuyo contenido íntegro sea *«hay un test que hace
esto»* duplica el test y añade un artefacto inmutable que mantener. Precedente del propio
proyecto: SPEC-051 rechazó por escrito tres alternativas en su §Diseño D-4 sin ADR, y esa
decisión aguantó tu arbitraje.
**La condición bajo la que cambia de opinión, escrita para que se pueda comprobar**: si
alguna vez el build llega a leer una clave que el `env` de ese job **no puede ver**
—variables heredadas del workflow, de `secrets` o del runner, que es justo lo que declara
**F-SPEC-052-2**—, la regla deja de ser autoejecutable, vuelve a ser prosa, y entonces
sí necesita ADR + RI-04 con el id que tú asignes. Ese es el disparador; hasta él, se
sostiene como decisión de spec.

**8. Lo que NO estoy tocando, y conviene que lo confirmes.** `appBaseUrl()` no cambia
(CA-14); `vercel.json`, los workflows y `src/` no se tocan; `tests/ci-workflow.test.ts`
caso 5.1 se **usa** pero no se modifica; y `RESEND_FROM` conserva su ejemplo. Si en el
gate decides que `appBaseUrl()` debería degradar en vez de lanzar, **para esta spec y abre
otra**: es reabrir un arbitraje tuyo de anteayer y no debe colarse por la puerta de atrás
de un FIX de documentación.

**9. La guardia ajena rota (CA-18): re-encuadrada, no retirada, y aquí está el porqué en
una línea.** Su proposición —*«nadie re-encuadró una tercera guardia ajena bajo SPEC-051»*—
**sigue viva y no la cubre ningún otro bloque del fichero**: lo comprobé leyendo los
cuatro, y CA-17.2/17.3/17.4 solo hablan de **las dos** autorizadas. Eso la separa del caso
de SPEC-050 de esta madrugada, donde lo vigilado ya no podía volver a ser cierto y borrar
era lo correcto. El defecto real es un **error de converso**: la guardia usa *«todo
re-encuadre menciona SPEC-051»* como si fuera *«toda mención es un re-encuadre»*. El
arreglo cierra el conjunto sobre la **firma** de un re-encuadre autorizado —que CA-17.2 ya
define— en vez de sobre la cadena. **Cobertura frente al fallo real: idéntica**; lo que
desaparece es el falso positivo. **Lo que sigue sin cubrirse, y lo digo yo, no el
verificador**: un re-encuadre **mudo**, sin nota. Tampoco lo cubría la versión original —su
detección siempre dependió de que el infractor escribiera la nota—, así que no se pierde
nada; pero es el hueco que la meta-guardia futura tiene que mirar. Todo esto está en
**D-7** y exigido en **CA-18 (a)…(f)**, incluida la prueba en rojo en los dos sentidos y la
prohibición explícita del atajo de partir el literal.

**10. F-SPEC-052-8: el implementador tenía razón y mi CA-14 estaba mal redactado.**
Escribí *«si el caso ya existe (SPEC-023)»* sobre una suposición que **no verifiqué**, y
era falsa. Crear el caso una sola vez en el fichero nuevo es **lo correcto**, y he
reescrito CA-14 para que no descanse en la premisa falsa. Pero el hallazgo merece más que
una corrección de redacción, y por eso queda escrito en el CA: **la función cuya excepción
tumbó todas las previews no tenía ni un test unitario**. SPEC-023 la ejercitaba solo *de
paso*, dentro del flujo de recuperación; cuando SPEC-051 le dio un segundo consumidor
completamente distinto —metadatos en build— no había nada que la probara por sí misma. Una
función con dos consumidores y cero tests propios se prueba solo por accidente. He añadido
además que el caso asserte **el mensaje literal**, que es el que aparece en el log de
Vercel y el que CA-2 (c) exige en el documento: así el documento y el código quedan atados
por el mismo literal.

**11. `D-SPEC-055-1` entra, como enmienda a CA-17 y no como criterio decimonoveno**
(2026-08-25). SPEC-055 pidió una guardia que compruebe que el valor de ejemplo de
`.env.example` **pasa `appBaseUrl()`**. La acepto, y por una razón que me obliga: **CA-17
congela un literal**, y esta es la entrega que en CA-18 acaba de formalizar que un literal
congelado necesita su **hermana** que mida la propiedad. Enviar CA-17 sin ella, en esta
spec precisamente, sería predicar y no aplicar. Además SPEC-055 hizo la propiedad
**significativa**: `appBaseUrl()` ya no comprueba solo presencia sino cuatro condiciones
reales, así que *«el ejemplo sirve»* dejó de ser trivial. Lo que **no** se hace, y está
exigido por escrito: **no se reescriben las reglas de SPEC-055 aquí**; la aserción
**llama** a la función. SPEC-055 se quedó como dueña única de qué es un origen usable
—igual que CA-14 quedó como dueño único del literal del mensaje—, y un contrato con dos
dueños diverge. El implementador tiene tres condiciones en **CA-17 (c)**: invocar la
función, un centinela de no-vacuidad sobre el lector, y el rojo probado con un valor con
ruta. **El implementador hizo bien en no escribirla por iniciativa propia**: con CA-18
recién puesto, añadir aserciones que ningún CA pide es justo lo que esa disciplina evita.

**12. Sin paradas.** El defecto está medido, la causa raíz verificada con `vercel env ls`,
el arreglo de ops hecho y fechado, las dos preguntas arbitradas e incorporadas, y el
alcance de la guardia acotado con su límite declarado (F-SPEC-052-1). Nada queda abierto
que impida implementar.
