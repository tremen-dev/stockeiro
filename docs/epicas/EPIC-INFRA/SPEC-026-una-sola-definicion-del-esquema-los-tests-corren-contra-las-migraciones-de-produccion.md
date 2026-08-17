---
id: SPEC-026
tipo: spec
epica: EPIC-INFRA
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-08-17, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-17, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-08-17, por: sdd-implementador}
---
# SPEC-026 — Una sola definición del esquema: los tests corren contra las migraciones de producción

> Origen: **F-SPEC-024-3**, abierto por sdd-implementador y **elevado por sdd-verificador** de
> "deuda de mantenimiento" a **agujero de cobertura**. Priorizado por el humano el 2026-08-17.

## Problema

El mismo esquema de base de datos está definido **tres veces** en el repo, y **nada comprueba
que las tres coincidan**:

1. **`drizzle/*.sql`** (8 migraciones, `0000`..`0007`) — generadas desde `src/db/schema.ts`.
   Es lo que se aplica a **producción** (Neon, ADR-001).
2. **`src/db/test-db.ts:18-123`** — DDL escrito a mano sobre PGlite. Es contra lo que corren
   los **273 tests unitarios**.
3. **`tests/e2e/server.mjs:43-144`** — DDL escrito a mano sobre el Postgres efímero. Es contra
   lo que corre el **e2e**.

El fallo que esto habilita **no se manifiesta como un test rojo, sino como un test verde que
valida lo que no es**. Si alguien cambia `src/db/schema.ts` y regenera la migración sin tocar
los otros dos DDL, la suite entera sigue en verde contra un esquema que no es el de producción.
Y el caso peor es justamente el que ya nos mordió: **`onDelete` es DDL puro, sin ningún efecto
en runtime**, así que ningún test de comportamiento lo delata — solo el catálogo lo dice.

**Precedente concreto y reciente.** SPEC-024 arregló dos cláusulas `ON DELETE` (`zone_triggers`
→ `cascade`, `notifications` → `set null`) que hubo que **replicar a mano en los tres sitios**.
La tercera copia (`server.mjs`) **ni siquiera estaba en la spec**: la descubrió el implementador
a mitad de trabajo. Si se le hubiera pasado, CA-7 y CA-13 de SPEC-024 habrían dado verde con el
defecto intacto en producción. Este defecto **puede volver siendo invisible**.

### Lo que se ha medido antes de decidir (2026-08-17, este worktree)

- **Las tres copias son hoy semánticamente equivalentes**, como dijo el verificador… pero **ya
  han divergido en 48 puntos**. Levantadas las dos fuentes en paralelo sobre PGlite y comparado
  el catálogo de Postgres (columnas, constraints, índices), salen **48 diferencias: todas de
  NOMBRE de constraint o índice, cero de definición**. Ejemplos: la unicidad de vigiladas se
  llama `watched_user_symbol` en producción y `watched_symbols_user_id_symbol_id_key` en los
  tests; la de email, `users_email_unique` frente a `users_email_key`. Hoy **ningún código
  depende de esos nombres** (comprobado: no hay captura de `23505` por `constraint_name` ni
  `onConflictDoConstraint`), así que es riesgo latente, no daño vivo. Pero es la prueba de que
  "coinciden" ya era falso en la letra pequeña.
- **La suite entera pasa contra las migraciones reales**: 273/273 en 30 ficheros, **sin tocar
  ni una expectativa ni una llamada**. Las 8 migraciones aplican limpias sobre PGlite (incluida
  `0004`, que es de datos) y sobre el Postgres 17 real del e2e.

### Encaje en la épica

EPIC-INFRA cubre "CI y **salud técnica del proyecto**". No es un defecto que vea el usuario: es
que la red de seguridad —la suite que EPIC-INFRA declara como red de no-regresión en su **R-1**—
tiene un agujero por el que se cuela precisamente la clase de cambio más peligrosa. También es
relevante que **no hay CI** (no existe `.github/`): la única detección automática posible hoy es
la que corra dentro de `npm test`, no un *workflow*.

## Usuarios / roles afectados

- **sdd-implementador / quien toque el esquema**: hoy tiene que acordarse de tres ficheros, y
  la spec que lee puede nombrarle solo uno (SPEC-024 nombraba dos). Debe poder cambiar el
  esquema en un sitio y que el sistema haga el resto o le grite.
- **sdd-verificador**: hoy la única forma de saber si las tres copias coinciden es compararlas
  a mano, una a una, como hizo en SPEC-024. Debe poder confiar en que el verde significa algo.
- **Usuario final (indirecto)**: es quien paga si el verde miente. El defecto de SPEC-024 —no
  poder quitar una vigilada— es exactamente lo que un esquema de test divergente habría dejado
  pasar.

## Decisión de diseño

**Una sola definición del esquema: `src/db/schema.ts`, materializada en `drizzle/`. Todo
entorno que necesite esquema —producción, unitarios y e2e— lo obtiene aplicando esas
migraciones. Los dos DDL a mano se borran.** Más una **guardia automática** de que `schema.ts`
no puede quedarse sin migrar (sin ella la decisión mueve el agujero en vez de cerrarlo, porque
un `onDelete` cambiado en `schema.ts` y no generado reproduce el mismo fallo silencioso).

El razonamiento completo, con las alternativas rechazadas y sus motivos medidos, está en
**ADR-018**. Resumen de por qué no las otras:

- **Test de coherencia entre las tres fuentes** (la que más sonaba): da **48 falsos positivos
  el primer día**; obliga a escribir una normalización de nombres a mano que hay que mantener
  honesta; **conserva las tres fuentes** y su coste; y cubrir el e2e exigiría arrancar
  `embedded-postgres` dentro de la suite unitaria (**8,8 s solo de arranque**, medido).
- **`drizzle-kit push` desde `schema.ts`**: prueba la cosa equivocada — lo que corre en
  producción es la cadena de migraciones, no `schema.ts`; daría verde justo cuando alguien
  olvidó `db:generate`.
- **Generar los DDL a mano en build**: drizzle-kit reimplementado en casa.

## Criterios de aceptación

Cada CA es verificable con un test. CA-1, CA-2, CA-4 y CA-6 son de un fichero nuevo
(`tests/schema-source.test.ts`, Vitest); CA-3 y CA-7 se verifican con la suite e2e existente;
CA-5 y CA-6 exigen **demostrar el rojo**, no solo el verde; CA-8 es una medición registrada en
el ledger.

- **CA-1 (El arnés unitario monta el esquema de producción, nombres incluidos).**
  Dado un arnés de test recién creado con `makeTestDb()`,
  cuando se inspecciona el catálogo de Postgres del esquema `public`,
  entonces contiene **exactamente** las tablas, columnas, constraints e índices que producen las
  migraciones de `drizzle/`, **con los nombres de producción**: existen `watched_user_symbol`,
  `users_email_unique`, `quotes_symbol_id_unique`, `password_reset_tokens_token_hash_unique` y
  `quote_diagnostics_symbol_id_unique`, y **no existe ninguno** de los nombres que generaba el
  DDL a mano (`watched_symbols_user_id_symbol_id_key`, `users_email_key`, `quotes_symbol_id_key`,
  `password_reset_tokens_token_hash_key`, `quote_diagnostics_symbol_id_key`).
  *Comparación válida*: acotada a `public` — la tabla de control `__drizzle_migrations` vive en
  el schema `drizzle` y queda fuera.

- **CA-2 (Las cláusulas `ON DELETE` de SPEC-024 quedan ancladas en un test).**
  Dado el catálogo del arnés unitario,
  cuando se leen las claves foráneas con `pg_get_constraintdef`,
  entonces `zone_triggers.watched_symbol_id → watched_symbols.id` es **`ON DELETE CASCADE`** y
  `notifications.zone_trigger_id → zone_triggers.id` es **`ON DELETE SET NULL`** (ADR-017), y
  ninguna otra FK declara `ON DELETE`. Es el test que SPEC-024 no pudo tener: fija la invariante
  contra el catálogo, no contra el comportamiento.

- **CA-3 (El arnés e2e monta el esquema desde las mismas migraciones).**
  Dado el launcher `tests/e2e/server.mjs` con su Postgres efímero,
  cuando arranca,
  entonces el esquema se crea **aplicando `drizzle/`** y la suite e2e completa pasa sin cambiar
  ninguna expectativa — incluidos los CA de SPEC-024 (`tests/e2e/vigiladas.spec.ts`) que
  dependen de las cláusulas `ON DELETE`.

- **CA-4 (No queda ninguna segunda definición, y no puede volver a colarse).**
  Dado el repositorio tras el cambio,
  cuando un test lee `src/db/test-db.ts` y `tests/e2e/server.mjs`,
  entonces **ninguno de los dos contiene sentencias `CREATE TABLE`, `ALTER TABLE` ni
  `CREATE INDEX`**. El test es permanente y su función es que reintroducir un DDL a mano en
  cualquiera de los dos arneses **ponga la suite en rojo en el mismo commit**.

- **CA-5 (Una migración que no aplique limpio tumba la suite, y se demuestra).**
  Dada una migración deliberadamente rota añadida a `drizzle/` en un árbol desechable,
  cuando se ejecuta `npx vitest run`,
  entonces la suite **falla**, con un fallo homogéneo y un mensaje que identifica la migración.
  Se verifica y **se revierte**: la migración rota no se commitea. Deja constancia de la
  cobertura nueva — hoy **nada** comprueba que `0000..0007` apliquen limpio sobre una base vacía,
  y el primer sitio donde se descubriría una migración rota es el despliegue.

- **CA-6 (Cambiar `src/db/schema.ts` sin migrar pone la suite en rojo).**
  Dado un `src/db/schema.ts` con un cambio de esquema **no capturado** en `drizzle/` (columna
  nueva, o —el caso que importa— un `onDelete` distinto),
  cuando se ejecuta la suite,
  entonces **falla** con un mensaje que dice qué hacer (`npm run db:generate`).
  **Requisito de diseño**: la guardia **no puede depender de un CI que no existe** (no hay
  `.github/`), así que corre dentro de `npm test`. Mecanismo verificado y disponible:
  `drizzle-kit generate` sobre una **copia desechable** de `drizzle/` **no escribe nada** si no
  hay cambios y **emite un `.sql` nuevo** si los hay (probado en ambos sentidos el 2026-08-17);
  el criterio es "¿apareció un fichero?", no el código de salida (siempre es 0) ni el texto de
  stdout. Coste medido: **2,4 s, una sola vez** por ejecución de la suite, no por test.
  **Este CA se verifica en rojo Y en verde**: una guardia que solo se ha visto verde no es una
  guardia.

- **CA-7 (Sin regresión).**
  Dada la suite existente (273 tests en 30 ficheros) y la suite e2e,
  cuando se aplica el cambio,
  entonces **todo pasa sin modificar ni una expectativa ni una llamada**: la firma de
  `makeTestDb()` (`{ db, client }`) no cambia y ningún `*.test.ts` se toca.
  *Ya comprobado en la investigación*: 273/273 con el arnés sustituido y cero ediciones en tests.

- **CA-8 (El coste está medido y dentro de presupuesto).**
  Dado el tiempo de `npx vitest run` **antes** del cambio, medido en la misma máquina y en la
  misma sesión,
  cuando se mide **después**,
  entonces el incremento es **≤ 15%**, y las dos cifras (antes/después, dos ejecuciones de cada)
  quedan **escritas en el ledger**. Medición previa disponible como referencia: **+6%**
  (~87 s → ~94 s de *duration* de Vitest). Si el incremento superara el 15%, **no se fuerza**:
  se para y se lleva al gate la alternativa de reutilizar la instancia de PGlite.

## Entidades y reglas afectadas

Ningún cambio de esquema, de dominio ni de comportamiento de la aplicación. **`src/db/schema.ts`
no se toca**, no hay migración nueva y **no se toca ninguna base de datos real**: esta spec
cambia únicamente cómo se construye el esquema en los dos entornos de prueba.

### Ficheros

- **`src/db/test-db.ts`** — el bloque `client.exec(...)` (líneas 18-123, ~105 líneas de DDL)
  desaparece y se sustituye por `migrate(db, { migrationsFolder })` de
  `drizzle-orm/pglite/migrator`. La firma pública (`makeTestDb(): { db, client }`, tipo `TestDb`)
  **no cambia**, por eso ningún test se toca. El comentario de cabecera —que hoy explica que hay
  que sincronizar tres DDL a mano— se reescribe para decir lo contrario y citar ADR-018.
- **`tests/e2e/server.mjs`** — las ~100 líneas de `CREATE TABLE IF NOT EXISTS` (43-144) se
  sustituyen por `migrate()` de `drizzle-orm/postgres-js/migrator` **sobre la conexión `postgres`
  que el launcher ya abre**. Coste medido: **236 ms**, una vez por ejecución de e2e, frente a los
  **8,8 s** que ya cuesta arrancar `embedded-postgres`. Es ruido.
- **`tests/schema-source.test.ts`** (nuevo) — CA-1, CA-2, CA-4 y la guardia de CA-6.
- **Sin dependencias nuevas**: `drizzle-orm` (dep) ya trae los dos migradores y `drizzle-kit`
  (devDep) ya está. `package.json` no cambia salvo que se decida exponer un script auxiliar.

### Nota de diseño para el implementador

`migrationsFolder` se resuelve **relativo al cwd**. Funciona hoy porque tanto Vitest como el
launcher e2e arrancan desde la raíz del repo, pero es frágil: resuélvelo desde `import.meta.url`
(o `__dirname`) para que no dependa de dónde se invoque.

### Transversal

- Decisión: **ADR-018** (nueva, esta spec la implementa). Precedente: **ADR-017** y **SPEC-024**
  (cuyas cláusulas `ON DELETE` quedan ancladas por CA-2). Contexto: **ADR-001** (Neon en
  producción, PGlite/embedded-postgres en test).
- Épica: **EPIC-INFRA**, criterio "salud técnica del proyecto"; refuerza su **R-1** (la suite
  como red de no-regresión de las subidas de versión).
- Identificadores y código en inglés; comentarios y documentación en español.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Montar CI.** No existe `.github/` y esta spec no lo crea: por eso toda la detección se diseña
  dentro de `npm test`. Que la salud técnica dependa de que alguien ejecute la suite en local es
  un hueco real, pero es **otro** hueco. → **F-SPEC-026-1** (EPIC-INFRA): workflow que corra
  `npm test`, `npm run typecheck`, lint y e2e en cada PR.
- **Optimizar el arranque del arnés** (reutilizar una instancia de PGlite y truncar entre tests,
  o `squash` de migraciones). Con +6% medido no hace falta, y añadir ahora un mecanismo de reuso
  introduce estado compartido entre tests —otra cosa que puede divergir— sin necesidad.
  → **F-SPEC-026-2**, con disparador numérico: cuando el sobrecoste del arnés supere ~250 ms por
  instancia (orden de 20-25 migraciones).
- **Cerrar el residual de los snapshots.** La guardia de CA-6 diffea `schema.ts` contra
  `drizzle/meta/*.json`, no contra el SQL aplicado: editar un `.sql` a mano sin tocar su snapshot
  la esquiva. El daño queda acotado (test y producción aplican **ese mismo** `.sql`, así que
  siguen coincidiendo, que es lo que esta spec protege) y la regla de SPEC-024 sigue en pie: las
  migraciones se generan con `db:generate`. → **F-SPEC-026-3** (bajo).
- **Renombrar constraints o normalizar nombres en producción.** Las 48 divergencias se resuelven
  solas al adoptar los nombres de las migraciones en test; producción no se toca.
- **RLS y aislamiento en base de datos** (F-SPEC-001-1): sigue aparcado, no lo toca esta spec.

## Notas para el gate humano

1. **Confirmo que el riesgo es real, no inflado — pero también acoto qué es y qué no.** No hay
   ningún fallo vivo hoy: las tres copias son semánticamente equivalentes y ningún código depende
   de los nombres que divergen. Lo que hay es una **clase de fallo silencioso con cobertura
   verde**, y ya se activó una vez en SPEC-024 (la tercera copia se encontró por casualidad).
   Si tu criterio fuera "solo arreglamos lo que duele hoy", esta spec no haría falta. Mi
   recomendación es hacerla, y el argumento es el coste: **+6% de suite** contra **eliminar la
   clase entera**.
2. **La decisión de fondo, en una frase: los tests dejan de tener su propio esquema.** A partir
   de aquí, montar la base de test **es** ejecutar lo que se ejecuta en producción. El precio
   está en ADR-018 y el que más te puede importar es este: **toda migración futura tendrá que
   poder aplicarse sobre PGlite**. Con el stack actual (uuid, text, numeric, date, timestamptz,
   `gen_random_uuid()`) no hay ningún roce, pero es una restricción nueva y permanente sobre algo
   que hoy es libre. Si algún día una migración necesita algo que el Postgres WASM no soporta,
   esta decisión habrá que revisitarla con otro ADR.
3. **Descarté la opción que más te sonaba, y la descarté midiendo, no opinando.** El test de
   coherencia entre las tres fuentes **da 48 diferencias hoy mismo** — todas de nombre de
   constraint, ninguna de definición. Nace en rojo. Para que sirviera habría que normalizar los
   nombres a mano, y ahí cambias "acuérdate de sincronizar tres DDL" por "acuérdate de que el
   comparador siga siendo honesto", que es más sutil y por tanto peor. Y sobre tu pregunta de si
   PGlite es comparable con el Postgres del e2e: **sí lo es** (el catálogo se lee igual y las 8
   migraciones aplican en ambos), pero hacerlo dentro de la suite unitaria costaría **8,8 s solo
   de arrancar `embedded-postgres`**, más caro que toda la opción elegida.
4. **Lo que te pido mirar con lupa es CA-6, la guardia.** Es la pieza que decide si esta spec
   cierra el agujero o solo lo mueve. Unificar las tres fuentes deja **un** eslabón manual vivo:
   cambiar `src/db/schema.ts` y olvidar `db:generate`. Y para `onDelete` ese olvido reproduce
   **exactamente** el mismo fallo silencioso, porque `onDelete` no tiene efecto en runtime. Si
   la guardia no entra, la spec vale la mitad. El mecanismo está probado en ambos sentidos y
   cuesta 2,4 s una vez por suite.
5. **Un efecto que conviene que aceptes explícitamente: una migración rota tumbará TODA la
   suite**, no un test. Es el precio correcto (es el aviso más temprano posible, y hoy no
   existe: nada comprueba que la cadena aplique limpia hasta que se despliega), pero cambia
   cómo se leen los fallos. Treinta ficheros rojos a la vez ya no querrá decir "he roto el
   dominio", querrá decir "la migración nueva no aplica". Queda escrito en ADR-018.
6. **Presupuesto de tiempo: he puesto el techo en +15% (CA-8) con +6% ya medido.** El margen
   existe porque tu máquina y la mía pueden no coincidir y porque el coste crece con el número
   de migraciones. Si al implementar se pasara del 15%, la instrucción de la spec es **parar y
   volver al gate**, no forzar. Dime si prefieres un techo más estricto.
7. **Riesgo de despliegue: ninguno.** Esta spec **no toca `src/db/schema.ts`, no crea migración
   y no toca ninguna base real**. Abrir el PR **no migra producción** — a diferencia de SPEC-024
   y del aviso permanente de F-SPEC-023-1.
8. **Tres follow-ups nuevos, todos fuera de alcance a propósito**: **F-SPEC-026-1** (no hay CI:
   `.github/` no existe, así que la detección vive en `npm test` y depende de que alguien la
   ejecute — es el hueco que más me preocupa después de este), **F-SPEC-026-2** (optimizar el
   arranque del arnés, con disparador numérico) y **F-SPEC-026-3** (el residual de los snapshots
   de drizzle, bajo). Dime si el primero te urge.
9. **Pregunta abierta, la única que tengo**: ¿quieres que CA-4 se extienda a **todo** el repo
   (ningún `CREATE TABLE` fuera de `drizzle/`) en vez de solo a los dos arneses conocidos? Es más
   estricto y atrapa una cuarta copia que aparezca en otro sitio; el precio es que cualquier
   `CREATE TABLE` legítimo futuro (un fixture, un script de mantenimiento) tendría que declararse
   como excepción. Mi inclinación es **acotarlo a los dos arneses**, que es donde está el
   problema real, pero es tu llamada.

---
*Historial de la spec: redactada el 2026-08-17 a partir de F-SPEC-024-3, con medición previa en
este worktree (dos ejecuciones de la suite en cada variante, comparación de catálogos entre las
dos fuentes, y prueba de la guardia en rojo y en verde). Sigue en `borrador`.*
