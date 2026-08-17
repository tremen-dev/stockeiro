---
id: SPEC-026
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-026 Una sola definicion del esquema: los tests corren contra las migraciones de produccion

## Resumen
- Fase: hecho <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-026-una-sola-definicion-del-esquema-los-tests-corren-contra-las-migraciones-de-produccion`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/db/test-db.ts` (aplica `drizzle/` con `drizzle-orm/pglite/migrator`; desaparece el bloque `client.exec` de ~105 líneas) | `tests/schema-source.test.ts` › CA-1 (3 casos): «el catálogo del arnés es exactamente el que producen las migraciones», «las restricciones únicas llevan los nombres de producción», «no queda ningún nombre de los que generaba el DDL a mano» | Verde en las dos ejecuciones completas del verificador. **Probado por mutación**: con `git checkout e3de30f -- src/db/test-db.ts` (arnés de DDL a mano) los **3 casos caen** (`expected [ 'notif_digest_cycle', …(33) ] to include 'watched_user_symbol'`). Sonda revertida, árbol limpio. El catálogo de referencia se levanta por un camino distinto (lee los `.sql` y los aplica con `client.exec`, sin migrador), así que la comparación no es el arnés midiéndose a sí mismo | ✅ |
| CA-2 | `src/db/test-db.ts` (las `ON DELETE` llegan de `drizzle/0007_tearful_roughhouse.sql`, no de una copia a mano) | `tests/schema-source.test.ts` › CA-2 (3 casos): cascade en `zone_triggers.watched_symbol_id`, set null en `notifications.zone_trigger_id`, y «ninguna otra clave foránea declara ON DELETE» — todos leyendo `pg_get_constraintdef` | **Probado por mutación**: sustituidas las dos cláusulas por `ON DELETE no action` en `drizzle/0007_tearful_roughhouse.sql` → **3/3 rojos** (`expected 'FOREIGN KEY (zone_trigger_id) REFEREN…' to match /ON DELETE SET NULL/`). Sonda revertida con `git checkout`. Confirmado además que CA-1 **no** detecta esa mutación (ambos lados leen el mismo `.sql`): es CA-2 quien ancla el valor, como pide la spec | ✅ |
| CA-3 | `tests/e2e/server.mjs` (aplica `drizzle/` con `drizzle-orm/postgres-js/migrator` sobre la conexión `postgres` que ya abría; desaparecen ~100 líneas de DDL) | Suite e2e completa: `npx playwright test` — 27/27, incluida `tests/e2e/vigiladas.spec.ts` (CA de SPEC-024, dependientes de las `ON DELETE`) | Reproducido por el verificador: `next build` con entorno desechable + `npx playwright test` → **27/27 en 1,7 min**, con `SPEC-024 CA-7` (quitar una vigilada en zona) y `SPEC-024 CA-13` en verde — que solo pasan si el `ON DELETE CASCADE` llegó al Postgres efímero, y ya no hay DDL en `server.mjs` que lo pudiera poner. Capturas de `_qa/SPEC-001..025` restauradas con `git checkout -- _qa` | ✅ |
| CA-4 | `src/db/test-db.ts` y `tests/e2e/server.mjs` (sin DDL) | `tests/schema-source.test.ts` › CA-4 (2 casos): «src/db/test-db.ts no contiene DDL escrito a mano» y «tests/e2e/server.mjs no contiene DDL escrito a mano» | **Probado por mutación**: añadida la línea `// sonda verificador: CREATE TABLE foo (id int);` al final de `src/db/test-db.ts` → rojo con el mensaje accionable (`vuelve a declarar esquema a mano (CREATE\s+TABLE)`). Sonda revertida. Acotado a los dos arneses, conforme a la decisión humana del gate (pregunta 9 de la spec) | ✅ |
| CA-5 | `src/db/test-db.ts` (aplicar la cadena de migraciones es ahora precondición de cada test) | Demostrado en rojo con migración sonda desechable, **revertida** (ver «Demostraciones en rojo») | **Reproducido con sonda propia**: `drizzle/0008_verif_probe.sql` (`ALTER TABLE "tabla_que_no_existe" …`) + su entrada en `_journal.json`. Todos los ficheros con arnés caen con el **mismo** error, que nombra la sentencia culpable (`Failed query: ALTER TABLE "tabla_que_no_existe" ADD COLUMN "probe" text;` / `42P01`). Sonda borrada y journal restaurado; `drizzle/` vuelve a tener `0000..0007` y 8 entradas | ✅ |
| CA-6 | `tests/schema-source.test.ts` (guardia; corre dentro de `npm test`, sin depender de CI) | `tests/schema-source.test.ts` › CA-6 «drizzle/ está al día respecto de src/db/schema.ts». Demostrado **en rojo** (con `onDelete` cambiado sin migrar y con columna nueva sin migrar) **y en verde** | **No se dio por bueno el rojo ajeno: se reprodujo.** (a) `onDelete: 'cascade'`→`'restrict'` en `src/db/schema.ts:215` sin `db:generate` → guardia **roja**, nombrando `0008_secret_steel_serpent.sql` y diciendo `npm run db:generate`; revertido. (b) **Guardia que no puede ejecutarse**: probadas tres roturas (schema inexistente, flag desconocido, binario ausente) → drizzle-kit sale con **código 1** en las tres y `execFileSync` lanza, así que la guardia se pone **roja, no verde**. (c) Reproducido el bug original: con `--out` **absoluto** fuera del repo drizzle-kit sale 0, no escribe nada y no imprime nada → verde mudo; la corrección efectiva es la ruta **relativa** al repo, que es la que está en el código. Corre dentro de `npm test` (`vitest.config.ts` incluye `tests/**/*.test.ts`) | ✅ |
| CA-7 | Sin cambios en `makeTestDb()` (firma `{ db, client }` intacta) ni en ningún `*.test.ts` preexistente | `npx vitest run` → 282/282 en 31 ficheros (273 previos + 9 nuevos), cero expectativas editadas; `npx playwright test` → 27/27 | `npx vitest run` ejecutado **dos veces** por el verificador: **282/282 en 31 ficheros** las dos. `git diff e3de30f HEAD -- tests/` toca **solo** `tests/e2e/server.mjs` (DDL→`migrate()`) y el fichero nuevo `tests/schema-source.test.ts`: **ningún `*.test.ts` preexistente editado**, ninguna expectativa cambiada. `makeTestDb()` conserva `{ db, client }` y el tipo `TestDb`. `npx tsc --noEmit` limpio; `npx eslint src tests` 0 errores (1 warning preexistente en `tests/position.test.ts:7`, ajeno). `src/db/schema.ts`, `drizzle/` y `package.json` **sin cambios** (diff vacío): sin migración nueva y sin tocar ninguna base real | ✅ |
| CA-8 | — | Medición registrada abajo («Medición de coste») | Medido de nuevo por el verificador, sin copiar cifras (ver «Medición independiente del verificador»): en pared **no hay incremento observable** (−7 % de *duration*), y el coste aislado por instancia de PGlite es **+113 ms (+7,4 %)**, que proyectado sobre la suite da **≈ +2 a +5 %**. **Por debajo del techo de +15 %** por cualquiera de las dos vías | ✅ |

## Medición de coste (CA-8)

Misma máquina y misma sesión (Windows 11, `npx vitest run`, dos ejecuciones de cada variante).

| Variante | Ejecución 1 | Ejecución 2 | Media | Tests |
|---|---|---|---|---|
| **Antes** (DDL a mano) | 128,47 s *(en frío: transform 16,05 s, prepare 40,06 s)* | 109,34 s *(en caliente)* | 118,9 s | 273/273 en 30 ficheros |
| **Después** (migraciones) | 99,00 s | 100,21 s | 99,6 s | 282/282 en 31 ficheros |

**Incremento medido: −16 % (la suite no se ralentiza de forma observable).** Muy por debajo
del techo de +15 % de CA-8, así que no hay que parar ni llevar nada al gate.

Tercera ejecución «después», ya con la guardia corregida (`19083fe`), como confirmación final:
**117,08 s**, 282/282. Media de las tres: **105,4 s** frente a 118,9 s de antes → sigue en
negativo. Se registra la cifra alta a propósito para que se vea la dispersión real de la
máquina, que es de donde sale la advertencia del párrafo siguiente.

La cifra negativa **no significa que el cambio acelere la suite**: significa que el ruido de la
máquina (±10-20 % entre ejecuciones) es mayor que el sobrecoste. Para no apoyar el CA en un
número que el ruido domina, se midió además el coste **aislado** del arnés —el mismo trabajo que
hace cada `beforeEach`, 23 iteraciones alternadas de cada variante, con calentamiento previo:

| Montaje del esquema | Coste por instancia de PGlite |
|---|---|
| DDL a mano (antes) | 968 ms |
| Migraciones de `drizzle/` (después) | 1002 ms |
| **Delta** | **+34 ms (+3,5 %)** |

- El arnés se levanta en `beforeEach` de **23 ficheros**, que suman **216 tests** → cota superior
  del sobrecoste: **+7,3 s** de trabajo serie (que además se reparte entre los hilos de Vitest).
- Costes de una sola vez, no por test: la guardia de CA-6 **~1,8-2,5 s** y el catálogo de
  referencia de CA-1 **~1,1 s**.
- Total teórico ≈ **+10 s sobre ~110 s (≈ +9 %)**, también por debajo del techo. En pared no se
  observa porque queda dentro del ruido.
- El delta medido aquí (+34 ms/instancia) es **menor** que el que midió sdd-arquitecto
  (+112 ms/instancia) — máquina distinta, misma conclusión.
- Umbral de F-SPEC-026-2 (actuar cuando el sobrecoste por instancia supere ~250 ms): **lejos**.

## Demostraciones en rojo (CA-5 y CA-6)

Ninguna de las dos sondas quedó en el árbol; `git status` limpio tras cada una (ver «Higiene»).

**CA-5 — una migración que no aplica limpio tumba la suite.**
Sonda: `drizzle/0008_probe.sql` con `ALTER TABLE "tabla_que_no_existe" ADD COLUMN "probe" text;`
más su entrada en `drizzle/meta/_journal.json`. `npx vitest run`:

```
Test Files  24 failed | 7 passed (31)
     Tests  211 failed | 62 passed | 9 skipped (282)

Error: Failed query: ALTER TABLE "tabla_que_no_existe" ADD COLUMN "probe" text;
Caused by: error: relation "tabla_que_no_existe" does not exist   (code 42P01)
```

Fallo homogéneo en los 24 ficheros que levantan el arnés y el mensaje nombra literalmente la
sentencia de la migración culpable. Es la consecuencia que ADR-018 pide aceptar explícitamente:
un rojo masivo se lee «la migración nueva no aplica», no «he roto el dominio». Cobertura nueva:
hasta ahora **nada** comprobaba que `0000..0007` aplicaran limpio sobre una base vacía.
Sonda revertida (`rm drizzle/0008_probe.sql` + `git checkout drizzle/meta/_journal.json`).

**CA-6 — cambiar `src/db/schema.ts` sin migrar pone la suite en rojo.** Dos variantes:

1. *El caso que importa*: `onDelete: 'cascade'` → `'restrict'` en `zoneTriggers.watchedSymbolId`,
   sin `db:generate`. La guardia falla y nombra la migración que drizzle-kit quiso generar
   (`0008_flimsy_goliath.sql`), con el mensaje que dice qué hacer (`npm run db:generate`).
   Es exactamente el fallo que **ningún test de comportamiento** delataría, porque `onDelete`
   no existe en runtime.
2. Columna nueva (`probe_column` en `users`) sin `db:generate` → mismo rojo
   (`0008_dazzling_moira_mactaggert.sql`).

Ambas revertidas con `git checkout -- src/db/schema.ts`. En verde con el árbol limpio: 9/9.

**Hallazgo: la primera versión de la guardia no se ejecutaba.** Exigir el rojo destapó que la
guardia daba verde sin haber comprobado nada. Dos causas combinadas:

- `drizzle-kit generate` resuelve `--out` **contra el cwd** y descarta las rutas absolutas: con
  el probe en el temp del sistema, intentaba abrir
  `D:\...\worktrees\followups-024-025\C:\Users\...\probe\meta\0000_snapshot.json` y moría con
  `ENOENT`.
- `drizzle-kit` **termina con código 0 aunque falle**, así que `execFileSync` no lanzaba y
  «no apareció ningún `.sql`» era indistinguible de «no se ejecutó».

Corregido en `19083fe`: el probe vive en `node_modules/.cache/` (ruta **relativa** al repo,
borrada en el `finally`) y la salida de drizzle-kit se inspecciona en busca de `error|ENOENT`,
de modo que una guardia que no puede ejecutarse se pone **roja**, no verde. El criterio de
CA-6 sigue siendo el que fija la spec —«¿apareció un fichero?»—; la inspección de salida solo
distingue «no hay cambios» de «no se ejecutó».

## Medición independiente del verificador (CA-8)

Medida por el verificador en su propia sesión, sin reutilizar las cifras de arriba. Misma
máquina, mismo worktree, árbol restaurado a HEAD entre variantes.

**Vía 1 — suite completa en pared.** «Antes» = `src/db/test-db.ts` de `e3de30f` (DDL a mano) con
`tests/schema-source.test.ts` apartado, para comparar la suite que existía; «después» = HEAD.

| Variante | Ejec. 1 | Ejec. 2 | Media *duration* | Media pared | Tests |
|---|---|---|---|---|---|
| **Antes** (DDL a mano) | 136,19 s | 146,45 s | **141,3 s** | 148,2 s | 273/273 en 30 ficheros |
| **Después** (migraciones) | 118,89 s | 142,82 s | **130,9 s** | 134,5 s | 282/282 en 31 ficheros |

**Incremento en pared: −7 % (duration) / −9 % (reloj).** Coincide con lo que reporta el
implementador: la dispersión de la máquina (aquí ±8 % dentro de la misma variante) es mayor que
el sobrecoste, así que **el signo negativo no es una aceleración, es ruido**. Por eso el número
que se usa para juzgar CA-8 no es este.

**Vía 2 — coste aislado por instancia de PGlite** (el mismo trabajo que hace cada `beforeEach`;
12 iteraciones alternadas de cada variante, con calentamiento previo de 2+2):

| Montaje del esquema | Media | Mediana |
|---|---|---|
| DDL a mano (antes) | 1534,1 ms | 1574,9 ms |
| Migraciones de `drizzle/` (después) | 1646,9 ms | 1622,2 ms |
| **Delta** | **+112,8 ms (+7,4 %)** | +47,3 ms (+3,0 %) |

Proyección honesta sobre la suite, con los números contados en este árbol:

- **24 ficheros** levantan el arnés; suman **224 tests**, de los cuales **216** lo hacen en
  `beforeEach` (el 25.º, `schema-source`, lo levanta una sola vez en `beforeAll`).
- Trabajo extra en **serie**: 216 × 112,8 ms ≈ **+24,4 s**. Pero Vitest paraleliza: en la
  ejecución medida la suma de duraciones de test (1479,7 s) sobre el reloj (142,8 s) da una
  concurrencia efectiva de **≈ 10×**, así que el impacto real en pared es **≈ +2,4 s**. Incluso
  asumiendo pesimistamente concurrencia 4× serían **+6,1 s**.
- Costes de una sola vez, no por test: guardia de CA-6 **≈ 2,5 s** + catálogo de referencia de
  CA-1 **≈ 1,6 s** + el arnés extra del fichero nuevo **≈ 1,6 s** ≈ **+5,7 s** en serie, casi
  todo dentro de un único fichero que corre en paralelo con los demás.
- **Total proyectado: +2 % a +5 % sobre ~141 s.** Techo de CA-8: **+15 %**. Hay margen de sobra;
  no procede parar ni volver al gate.
- Delta por instancia frente al disparador de **F-SPEC-026-2** (~250 ms): **+113 ms, lejos**.
  Mi cifra queda entre la del arquitecto (+112 ms) y la del implementador (+34 ms); la
  conclusión es la misma en las tres.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-18, sdd-verificador. 8/8 CA cerrados.**

Gates automáticos, todos ejecutados por el verificador en este worktree:

| Gate | Comando | Resultado |
|---|---|---|
| Unitarios | `npx vitest run` (×2) | **282/282 en 31 ficheros**, las dos veces |
| Tipos | `npx tsc --noEmit` | limpio |
| Lint | `npx eslint src tests` | 0 errores, 1 warning preexistente (`tests/position.test.ts:7`) |
| Build | `next build` con entorno desechable | OK (12 rutas) |
| e2e | `npx playwright test` | **27/27 en 1,7 min** |

**Lo que se apretó y por qué.** Esta spec existe para cerrar un agujero cuyo síntoma es «el test
pasa sin probar nada», así que la trampa a descartar era la misma aplicada a sí misma: una
guardia verde que no prueba nada. **No se aceptó ningún verde por inspección.** Los cinco CA con
test se sometieron a **mutación**, provocando el rojo con sondas propias y revirtiéndolas: CA-1
(restaurando el arnés de DDL a mano → 3 rojos), CA-2 (`ON DELETE no action` en la migración 0007
→ 3 rojos), CA-4 (reintroduciendo un `CREATE TABLE` → rojo con mensaje accionable), CA-5
(migración rota → rojo homogéneo que nombra la sentencia), CA-6 (`onDelete` cambiado sin migrar
→ rojo que nombra la migración que faltaba y el comando a ejecutar).

**Sobre la guardia de CA-6, que es el corazón de la spec.** El implementador declara que su
primera versión daba verde sin ejecutarse y que lo corrigió en `19083fe`. Se comprobó de forma
independiente y **la guardia hoy es honesta**, con dos matices que conviene dejar escritos:

1. **Falla cuando no puede ejecutarse.** Probadas tres roturas realistas —ruta de schema
   inexistente, flag desconocido, binario ausente— drizzle-kit sale con **código 1** en las tres
   y `execFileSync` lanza: la guardia se pone **roja**, no verde. Verificado, no supuesto.
2. **El arreglo efectivo es la ruta relativa, no la inspección de salida.** Reproducido el bug
   original: con `--out` **absoluto** fuera del repo, drizzle-kit sale **0**, no escribe nada y
   **no imprime nada** ni por stdout ni por stderr → verde mudo. Es decir, el
   `/error|ENOENT/i.test(output)` no habría salvado ese caso (y además solo mira stdout, mientras
   que los errores de drizzle-kit van por stderr). Lo que cierra el agujero es que el probe viva
   **dentro** del repo con ruta relativa, que es lo que hace el código. La red de seguridad real
   es el código de salida. Ver residual R-1 abajo.

**Decisiones humanas del gate: respetadas.** CA-4 acotado a los dos arneses (no a todo el repo);
techo de +15 % no superado por ninguna de las dos vías de medida; la guardia de CA-6 entró y es
funcional; el rojo masivo por migración rota queda documentado y demostrado; **sin migración
nueva y sin tocar ninguna base real** (`git diff e3de30f HEAD` deja `src/db/schema.ts`, `drizzle/`
y `package.json` intactos). Abrir el PR no migra producción.

**Higiene del árbol tras la verificación**: `git status` limpio. `drizzle/` contiene exactamente
`0000..0007` más `meta/` (8 snapshots), y `_journal.json` sus 8 entradas originales. Ninguna sonda
—ni del implementador ni del verificador— sobrevive. Las 27 capturas de `_qa/SPEC-001..025` que
reescribe Playwright se restauraron con `git checkout -- _qa`.

### Residuales aceptados (no bloquean)

- **R-1 (bajo, higiene de la guardia).** La comprobación `/error|ENOENT/i.test(output)` de
  `tests/schema-source.test.ts:228-231` es, en la práctica, código muerto: mira **stdout**, y en
  las cuatro invocaciones rotas que se probaron drizzle-kit escribe por **stderr** y sale con
  código ≠ 0 (que ya lanza). No hace daño, pero puede dar una falsa sensación de que la guardia
  está protegida por ahí. Lo que de verdad la protege es (a) el código de salida y (b) que
  `probeRel` sea **relativo**. Si alguien «limpia» esa ruta relativa a absoluta, la guardia
  vuelve a ser verde muda sin que nada lo delate. El comentario de las líneas 203-206 lo
  advierte; conviene que siga ahí. Se anota junto a **F-SPEC-026-4**.
- **R-2 (bajo, preexistente y fuera del alcance decidido).** `tests/ownership.test.ts:20-34`
  levanta su propio PGlite con `CREATE TABLE users (...)` más una tabla ficticia `notes`. Es una
  **cuarta copia parcial** de `users`, la que la pregunta 9 del gate dejó deliberadamente fuera
  al acotar CA-4 a los dos arneses. Es un fixture sintético para probar lógica de propiedad
  genérica, no el esquema de la app, y CA-4 no la cubre **por decisión humana**, no por descuido.
  Queda anotada por si algún día se reabre el alcance de CA-4.
- **R-3 (informativo).** El arnés tarda ~1,6 s por instancia y `vitest.config.ts` fija
  `hookTimeout: 20000`. Con 8 migraciones sobra margen; es otro motivo por el que el disparador
  numérico de **F-SPEC-026-2** merece vigilarse cuando crezca la cadena.
- Se confirman abiertos y sin tocar los tres follow-ups que la spec declara fuera de alcance
  (**F-SPEC-026-1** no hay CI, **F-SPEC-026-2**, **F-SPEC-026-3**) y el **F-SPEC-026-4** que abre
  esta implementación.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-026/. Informe HTML opcional: _qa/SPEC-026/informe.html -->
No aplica: esta spec no toca UI. La evidencia es de suite (Vitest, Playwright) y de catálogo
de Postgres, recogida arriba.

## Salvedades / follow-ups

Los tres follow-ups que la spec declara fuera de alcance siguen abiertos y no se han tocado:

- **F-SPEC-026-1** (EPIC-INFRA, el más relevante): **no hay CI**. `.github/` no existe, así que
  toda la detección de esta spec —guardia de CA-6 incluida— vive dentro de `npm test` y depende
  de que alguien la ejecute en local. Destino: workflow que corra `npm test`, `npm run typecheck`,
  lint y e2e en cada PR.
- **F-SPEC-026-2** (bajo, con disparador numérico): optimizar el arranque del arnés (reutilizar
  una instancia de PGlite y truncar entre tests, o *squash* de migraciones) cuando el sobrecoste
  por instancia supere ~250 ms. Medido hoy: **+34 ms**. Muy lejos del disparador.
- **F-SPEC-026-3** (bajo): la guardia diffea `schema.ts` contra los *snapshots* de `drizzle/meta/`,
  no contra el SQL aplicado; editar un `.sql` a mano sin tocar su snapshot la esquiva. Daño
  acotado (test y producción aplican **ese mismo** `.sql`, así que siguen coincidiendo) y la regla
  de SPEC-024 sigue vigente: las migraciones se generan con `db:generate`.

Abiertos por esta implementación:

- **F-SPEC-026-4** (bajo, higiene de tooling): la guardia de CA-6 invoca `npx drizzle-kit` como
  proceso hijo. Es lento (~2 s) y depende de que `drizzle-kit` siga aceptando estos flags y
  siga escribiendo el `.sql` cuando hay cambios. Si algún día drizzle-kit expone una API
  programática de *diff*, sustituirla ahorraría el proceso y quitaría la dependencia del CLI.
  No bloquea: el contrato está anclado en rojo y en verde, y una invocación rota ahora falla.
- **Nota de operación, no follow-up**: `next build` exige `DATABASE_URL` (y `AUTH_SECRET`) en el
  entorno, y este worktree no tiene `.env`. Para el e2e hubo que construir con las variables por
  delante. Es preexistente y ajeno a esta spec, pero conviene saberlo para reproducir el e2e.

## Cómo retomar (handoff)

**Estado: implementación completa, los 8 CA cubiertos con test o medición. Listo para
sdd-verificador.** Nada a medias.

Commits en la rama (todos con `Refs: SPEC-026`):

1. `37f1ade` — test(SPEC-026): RED. `tests/schema-source.test.ts` con CA-1, CA-2, CA-4 y la
   guardia de CA-6. 6/9 en rojo contra el DDL a mano.
2. `867df07` — feat(SPEC-026): `src/db/test-db.ts` y `tests/e2e/server.mjs` aplican las
   migraciones. Desaparecen ~205 líneas de DDL.
3. `19083fe` — fix(SPEC-026): la guardia de CA-6 no se ejecutaba (ver «Demostraciones en rojo»).

Cómo reproducir la verificación:

- Unitarios: `npx vitest run` → **282/282 en 31 ficheros**. Solo `tests/schema-source.test.ts`
  es nuevo; ningún test previo se editó.
- Tipos y lint: `npx tsc --noEmit` (limpio) y `npx eslint src tests` (0 errores; 1 warning
  preexistente en `tests/position.test.ts`, ajeno a esta spec).
- e2e: hace falta build previo con entorno —
  `DATABASE_URL=postgres://postgres:postgres@localhost:54329/stockeiro_e2e DB_DRIVER=pg
  AUTH_SECRET=e2e-secret-please-change-0123456789 AUTH_TRUST_HOST=true
  APP_BASE_URL=http://localhost:3200 npx next build`— y luego `npx playwright test` → **27/27**.
- Guardia de CA-6 en rojo (opcional, para no fiarse): cambia `onDelete: 'cascade'` por
  `'restrict'` en `src/db/schema.ts:215`, corre
  `npx vitest run tests/schema-source.test.ts -t "al día"` y revierte con
  `git checkout -- src/db/schema.ts`.

### Higiene del árbol

Sin ficheros sonda. `drizzle/` contiene **exactamente** `0000..0007` más `meta/`, y
`drizzle/meta/_journal.json` tiene sus 8 entradas originales. `src/db/schema.ts` está
**sin modificar** (no había que tocarlo y no se tocó): no hay migración nueva y **abrir el PR
no migra producción**. El probe de la guardia se crea y se borra dentro del propio test, bajo
`node_modules/.cache/`, que además está en `.gitignore`.

Aviso para quien reejecute el e2e: la suite de Playwright **reescribe las capturas de
`_qa/SPEC-001..025/`** (28 ficheros, evidencia de specs anteriores). Aquí se revirtieron con
`git checkout -- _qa`; no forman parte de este cambio. Es preexistente y ajeno a SPEC-026.
