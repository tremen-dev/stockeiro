---
id: SPEC-032
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-032 Las guardias de migración: nada migra sin permiso y ningún DROP pasa mudo

## Resumen
- Fase: spec redactada el 2026-08-18 por sdd-arquitecto y **aprobada en el gate humano el
  2026-08-18 (Alberto Fojo)**, con una enmienda: se añade **CA-15** y la spec pasa de 14 a
  **15 CA**. La transición de estado la registra el orquestador con `estado.mjs`; **la fuente de
  verdad del estado es el frontmatter de la spec**, no esta línea.
- Rama: `ft/SPEC-032-guardias-de-migracion` (worktree `.claude/worktrees/spec-032`, basada en
  `origin/main` @ `65ed40e`, que ya incluye SPEC-031 mergeada).
- Origen: **F-SPEC-027-2** (ledger de SPEC-027). Implementa **ADR-018 D-2** (guardia
  *fail-closed* delante de `db:migrate`), **D-5.2** (escáner de SQL destructivo con desbloqueo
  escrito) y, desde el gate, **D-5.1**: la política de migraciones aditivas se adopta como regla
  del proyecto y se escribe como **RI-01** en `docs/fundacion/reglas.md`, en una sección de
  reglas de ingeniería aparte de la serie de dominio (**CA-15**). Eso responde la **pregunta 2
  del gate de ADR-018**, abierta desde el 2026-08-17.
- Por qué ahora: es el **último bloqueante de SPEC-028**. Los otros dos ya están vivos —
  **SPEC-031** (`hecho`, mergeada el 2026-08-18) y **F-SPEC-023-1** (cerrado por ops el
  2026-08-18 con *preview branching* de Neon: rama copy-on-write por despliegue de Preview,
  `Create Database Branch For Deployment` = Preview sí / Production no, prefijo `DATABASE`).
- **Implementación cerrada el 2026-08-18 por sdd-implementador**, en el worktree
  `.claude/worktrees/spec-032` sobre `ft/SPEC-032-guardias-de-migracion`. Los 15 CA tienen
  código y test; la spec pasa a `en-revision`. Verificación local: `npm test` **678/678 en 50
  ficheros**, `npm run typecheck` y `npm run lint --max-warnings=0` limpios, `npm run db:scan`
  con salida 0. **Sin red y sin desplegar nada.**
- Artefactos previstos por la spec (todos escritos ya; los escribió sdd-implementador):
  `scripts/guard-migrate.mjs`, `scripts/scan-destructive-sql.mjs`,
  `drizzle/destructive-waivers.json`, script npm `db:scan`, step de CI `Migration scan`,
  cambio del `buildCommand` en `vercel.json`, ampliación de `tests/ci-workflow.test.ts`,
  sección nueva en `docs/despliegue.md` y **`RI-01` en `docs/fundacion/reglas.md`**.
- **Todos los CA son cerrables en local y en CI, sin desplegar y sin red** (CA-14). Es la misma
  restricción que hizo verificable a SPEC-031.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 — la guardia existe, stdlib-only, `--help`, códigos de salida | `scripts/guard-migrate.mjs` (cabecera con el contrato, `USO`, `SALIDA`, `VARIABLE`, `VALOR_QUE_AUTORIZA`) | `tests/guard-migrate.test.ts` › *CA-1: la guardia existe, vive en el repo y no puede filtrar nada* — 7 casos: existe · todos los `import` son `node:*` · la cabecera documenta 0/1/2 · `--help` sale con 0 · códigos exportados · nombre y valor de la variable · argumento desconocido → 2 | **Ejecutado por mí como procesos reales**: `node scripts/guard-migrate.mjs --help` → **0**; `node scripts/guard-migrate.mjs --migra-porfa` → **2**, con `No acepto argumentos (recibido: --migra-porfa)` en stderr. Los tres `import` del fuente son `node:process`, `node:path` y `node:url` — nada de `package.json` ni de `src/`. | ✅ |
| CA-2 — tabla de decisión *fail-closed* completa | `scripts/guard-migrate.mjs` › `decidir()`, función pura sobre el objeto de entorno | `tests/guard-migrate.test.ts` › *CA-2: fail-closed, la tabla de decisión completa* — 21 filas, una por caso de la tabla (incluidas ` 1 ` con espacios, `true`, `yes`, `1x`, vacío y `VERCEL_ENV` ausente) + 3 subprocesos reales, uno por decisión distinta | **Las siete filas de la tabla, recorridas como 15 subprocesos reales** (con `env -u` para garantizar la ausencia): production sin ALLOW→**0** · production+`0`→**0** · preview+`1`→**0** · preview ausente→**1** · preview vacío→**1** · preview+`0`→**1** · preview+`true`→**1** · preview+`yes`→**1** · preview+`" 1 "`→**0** (recorta espacios) · development+`1`→**0** · development ausente→**1** · valor arbitrario+`1`→**0** · valor arbitrario ausente→**1** · **sin `VERCEL_ENV` y sin `ALLOW_MIGRATE`→1**, con el motivo «no hay VERCEL_ENV: no se sabe dónde corre este build». La fila *fail-closed* es la que más me interesaba y es la que cierra. | ✅ |
| CA-3 — dice qué autorizó y contra qué host/base, sin credenciales | `scripts/guard-migrate.mjs` › `describirDestino()` y la salida de `main()` | `tests/guard-migrate.test.ts` › *CA-3* — 5 subprocesos: imprime entorno/motivo/host/base · **no** filtra usuario, contraseña ni *query string* · distingue producción de permiso explícito · sin `DATABASE_URL` lo dice · el rechazo dice entorno, `ALLOW_MIGRATE=1` y «la base no se ha tocado» | **Subproceso con credenciales reconocibles**: `DATABASE_URL=postgresql://usuario_secreto:contrasena_supersecreta@ep-cool-1234.eu-central-1.aws.neon.tech:5432/stockeiro_prod?sslmode=require&channel_binding=require` → imprime `host=ep-cool-1234.eu-central-1.aws.neon.tech:5432 base=stockeiro_prod` y **nada más de esa URL**: ni `usuario_secreto`, ni `contrasena_supersecreta`, ni `sslmode`, ni `channel_binding`. El rechazo imprime las tres cosas exigidas: el entorno que vio, `ALLOW_MIGRATE=1` como el valor que autorizaría, y «La base no se ha tocado». | ✅ |
| CA-4 — cableada en `vercel.json` antes de `db:migrate`, no en `package.json` | `vercel.json` (`buildCommand`); `package.json` **sin cambiar** su `db:migrate` | `tests/guard-migrate.test.ts` › *CA-4* — 3 casos: el `buildCommand` exacto · los tres eslabones separados por `&&` y en orden · `db:migrate` sigue siendo `drizzle-kit migrate`. Más `tests/spec-031-frontera.test.ts` › *CA-13.2* | `vercel.json` parseado: `buildCommand` == `node scripts/guard-migrate.mjs && npm run db:migrate && npm run build` — los tres eslabones, en ese orden, separados por `&&`. `package.json` › `db:migrate` sigue siendo `drizzle-kit migrate` a secas; `db:scan` es un script **aparte**, sin envolver a nadie. | ✅ |
| CA-5 — nunca abre la base ni sale a la red | `scripts/guard-migrate.mjs` (sin `node:net`/`tls`/`dns`/`http`, sin `fetch`) | `tests/guard-migrate.test.ts` › *CA-5* — 3 casos: host `.invalid` autorizando y rechazando, ambos muy por debajo de 5 s · el fuente no menciona sockets, HTTP ni cliente de BD | **Subproceso con `DATABASE_URL=postgres://u:p@no-existe.invalid:5432/x`**: autoriza en **125 ms** (exit 0) y rechaza en **121 ms** (exit 1) — órdenes de magnitud por debajo de cualquier tiempo de espera de red. Además **instrumenté `net.Socket.prototype.connect` y `dns.lookup/resolve/resolve4`**: **0 llamadas de red observadas**. Y con la red externa cortada de raíz (precarga que lanza excepción ante cualquier socket o resolución no-loopback) la guardia decide exactamente igual. | ✅ |
| CA-6 — el escáner existe, autosuficiente, sin git ni red | `scripts/scan-destructive-sql.mjs` (lee `meta/_journal.json`, `--dir`, `--help`, `SALIDA`) | `tests/destructive-sql-scan.test.ts` › *CA-6* — 7 casos: existe · solo `node:*` · el código no usa `child_process`, `fetch` ni URLs · orden de journal ≠ orden del sistema de ficheros · `--help` documenta 0/1/2 · directorio ilegible → 2 · bandera desconocida → 2 | **Ejercitado como proceso**: `npm run db:scan` sobre el `drizzle/` real → **0**; `--help` → **0**; bandera desconocida → **2**; `--dir /no/existe/nada` → **2**, nombrando el `meta/_journal.json` que no pudo leer. Los cuatro `import` son `node:*`. Corre sin inmutarse **con la red externa bloqueada**, y no invoca git ni ninguna rama base. | ✅ |
| CA-7 — marca lo que enumera D-5.2 y no marca folklore (`UPDATE` fuera) | `scripts/scan-destructive-sql.mjs` › `PATRONES`, `normalizar()`, `sentencias()`, `detectar()` | `tests/destructive-sql-scan.test.ts` › *CA-7: marca lo que ADR-018 D-5.2 enumera* (11 patrones + mayúsculas/minúsculas + número de línea) y › *CA-7: y no marca folklore* (11 limpios: comentario de línea, de bloque, literal, `dropped_things`, `renamed_at`, `CREATE`, `ADD COLUMN`, `ADD COLUMN … NOT NULL`, `ON DELETE cascade`, `CREATE INDEX`, `UPDATE`; más el separador de drizzle y el comentario en la misma línea) | **Matriz adversarial propia**, distinta de la del implementador. **Marca**: `drop` en minúsculas y `DrOp` mezclado · `DROP TABLE IF EXISTS` · un `DROP` repartido en cuatro líneas · un `DROP` que va tras un comentario de línea · `RENAME TO` · `TRUNCATE public.x` · `DELETE\nFROM` · `ALTER COLUMN b SET NOT NULL` sin comillas · `ALTER COLUMN b TYPE integer` sin `SET DATA`. **No marca**: `ADD COLUMN … NOT NULL` (el caso real de `0006`) · `ON DELETE cascade` y `ON DELETE set null` (los de `0007`) · `NOT NULL` dentro de un `CREATE TABLE` · `UPDATE` (el backfill de `0004`) · un `DROP TABLE users` dentro de un literal de cadena · dentro de `/* … */` · `CREATE TABLE "drop_me"` · `renamed_at` · `truncated_at`. Ni un falso negativo de la lista de D-5.2, ni un falso positivo de los plausibles. | ✅ |
| CA-8 — calibración medida: exactamente `0001` y `0007` de 9 | `scripts/scan-destructive-sql.mjs` › `escanear()` sobre el `drizzle/` real | `tests/destructive-sql-scan.test.ts` › *CA-8* — 3 casos: nueve migraciones · el conjunto marcado es exactamente `['0001_symbol_market_identity', '0007_tearful_roughhouse']` · 1 y 2 sentencias respectivamente | **Medido por mí primero sobre los `.sql`, y solo después contrastado con el escáner** —para que un detector mal calibrado y unos tests escritos para coincidir con él no pudieran mentir a la vez—. Censo directo de las nueve migraciones (barrido de `drop|rename|truncate|delete|not null|alter column|type` sobre todas, más lectura íntegra de las pequeñas): los únicos `DROP` del árbol están en `0001` (1 `DROP CONSTRAINT`) y en `0007` (2 `DROP CONSTRAINT`); **no hay ni un `RENAME`, `TRUNCATE`, `DELETE FROM` ni `ALTER COLUMN` en todo `drizzle/`**. Las trampas plausibles se comportan: `0000`/`0002`/`0005`/`0006` solo llevan `NOT NULL` **dentro de `CREATE TABLE`** o en un `ADD COLUMN`; los `ON DELETE no action|cascade|set null` de `0000`/`0002`/`0005`/`0006`/`0007` **no** son `DELETE FROM`; `0003` y `0008` son `ADD COLUMN` puros; `0004` son tres `UPDATE`. **Mi censo y el escáner coinciden exactamente: `0001` (1 sentencia) y `0007` (2), y ninguna de las otras siete.** | ✅ |
| CA-9 — desbloqueo explícito, escrito y versionado (`destructive-waivers.json`) | `drizzle/destructive-waivers.json` con las **dos entradas sembradas** + `scan-destructive-sql.mjs` › `evaluar()` | `tests/destructive-sql-scan.test.ts` › *CA-9* — 11 casos sobre `drizzle/` sintéticos en un temporal: limpio sin fichero · desbloqueo completo → 0 · sin entrada · `reason` en blanco · sin `rollback` · sin `spec` · `statements` desfasado dice el número real · huérfano inexistente · huérfano que ya no marca · JSON inválido → 2 · las dos entradas reales del repositorio con justificación de verdad | **Los caminos de rechazo, ejercitados como procesos** sobre un `drizzle/` sintético en un temporal: desbloqueo completo → **0** · sin entrada → **1** · `reason: "   "` → **1** («…el desbloqueo tiene reason vacío o ausente. Un desbloqueo sin justificación no es un desbloqueo: es una casilla marcada») · `rollback` ausente → **1** · `statements: 5` con 6 reales → **1**, diciendo el número real («Pon statements: 6») · desbloqueo huérfano de fichero inexistente (`0099_fantasma`) → **1** · huérfano de una migración que ya no marca (`0000_aditiva`) → **1**. Y las **dos entradas reales sembradas** (`0001`→SPEC-008, `0007`→SPEC-024) traen `spec`, `reason`, `rollback` y `statements` con justificación y plan de vuelta atrás **de verdad** —no una casilla marcada—, y hacen que el repositorio salga con **0**. | ✅ |
| CA-10 — el rojo dice fichero, línea, sentencia y qué escribir | `scripts/scan-destructive-sql.mjs` › `pegable()` y el bloque de error de `main()` | `tests/destructive-sql-scan.test.ts` › *CA-10* — subproceso contra un `drizzle/` sintético: nombra el fichero, la línea 2 y `DROP CONSTRAINT`, no nombra al inocente, y el fragmento entre `8<` y `>8` es JSON válido con las cuatro claves y `statements: 1` | **Subproceso contra el sintético**: por cada hallazgo imprime `fichero, línea N — PATRÓN` y la sentencia recortada; los seis hallazgos salieron con sus seis líneas distintas y correctas. El fragmento entre `8<` y `>8` lo **parseé con `JSON.parse`**: JSON válido, con las cuatro claves `spec`/`reason`/`rollback`/`statements` y el conteo ya rellenado (`statements: 6`). No nombra al fichero inocente. | ✅ |
| CA-11 — step propio `Migration scan` en el job `Checks` + `GATES` a seis | `.github/workflows/ci.yml` (step `Migration scan`, con `if: !cancelled()`) + `package.json` (`db:scan`) | `tests/ci-workflow.test.ts` con `GATES` a seis entradas: los seis gates una vez cada uno · un step invoca un solo script · `Checks` = Typecheck·Lint·Unit tests·Migration scan y `E2E` = Build·End-to-end tests · `!cancelled()` en los cuatro de `Checks`. Más `tests/spec-031-frontera.test.ts` › *CA-13.1* | `.github/workflows/ci.yml` parseado: el job **`Checks`** tiene el step **`Migration scan`** con `run: npm run db:scan` —y **solo** eso— e `if: ${{ !cancelled() }}`, igual que sus tres hermanos. `tests/ci-workflow.test.ts` lleva el mapa `GATES` a las **seis** entradas exactas y conserva sus dos aserciones de contrato (un step invoca un script; `Checks` = Typecheck·Lint·Unit tests·Migration scan y `E2E` = Build·End-to-end tests). Ese fichero pasa con **25 tests verdes**. La ejecución real en la CI queda para la PR (no la abro yo). | ✅ |
| CA-12 — `npm test` invoca el mismo script (red local) | `package.json` › `"db:scan": "node scripts/scan-destructive-sql.mjs"` | `tests/destructive-sql-scan.test.ts` › *CA-12* — 2 casos: el escáner sale con 0 sobre el `drizzle/` real **como subproceso del mismo script**, sin reimplementar la detección · `package.json` expone `db:scan` apuntando a ese fichero. Coste medido: **105-115 ms** por pasada | Leí el test para descartar un test vacío: **lanza el script de verdad** (`execFile(process.execPath, [scan-destructive-sql.mjs])`) y no reimplementa la detección — una sola lógica, dos invocadores. Coste medido por mí: **126-139 ms** por pasada del escáner (tres medidas), y los 51 tests del fichero tardan **1,1 s**. La cadena está probada en ambos sentidos: el script devuelve **1** ante SQL destructivo sin desbloquear (verificado arriba) y el test afirma **0** sobre el árbol real. | ✅ |
| CA-13 — runbook: las dos guardias, `ALLOW_MIGRATE`, y Preview al día | `docs/despliegue.md`: **§11 nueva** (11.1 la guardia, 11.2 el escáner, 11.3 el desbloqueo) + §1.1, §6, §9 y cabecera al día, y la nota «Preview y la BD de producción» reescrita | `tests/runbook-guardias-migracion.test.ts` — 15 casos, troceando el documento por secciones y subsecciones: §11 con la tabla de decisión y los tres códigos · `ALLOW_MIGRATE` con qué es, dónde y qué pasa si falta · el desbloqueo con sus cuatro claves · `SPEC-028` como dueño de lo que no entra · el `buildCommand` viejo no se cita como vigente en ninguna parte · F-SPEC-023-1 cerrado con fecha · `Migration scan` en la tabla de §9 | `docs/despliegue.md` leído entero en sus partes tocadas: **§11 nueva** con la tabla de las dos piezas y su alcance, §11.1 (tabla de decisión completa, los tres códigos de salida, y `ALLOW_MIGRATE`: qué es, `vercel env add ALLOW_MIGRATE preview`, y qué pasa si falta), §11.2 (el escáner, sus patrones y sus códigos) y §11.3 (cómo se escribe un desbloqueo, con las cuatro claves y el caso huérfano). §1.1 y §6 citan el `buildCommand` **nuevo**, y un `grep` confirma que **el viejo no aparece en ninguna parte del documento**. §6 separa lo que había que separar: el branching responde *contra qué base*, la guardia *si tengo permiso*. La cabecera marca **F-SPEC-023-1 CERRADO el 2026-08-18**, y la nota «Preview y la BD de producción» ya no describe una `DATABASE_URL` compartida como estado actual. §9 lista `Migration scan` entre los gates de `CI / Checks`. Alcance respetado: remite a **SPEC-028** para todo lo automático. | ✅ |
| CA-14 — nada queda conectado; la suite pasa sin red | *No se implementa nada: se restringe.* Diff acotado a `scripts/`, `vercel.json`, `package.json`, `.github/workflows/ci.yml`, `drizzle/destructive-waivers.json`, `docs/` y `tests/` | `tests/spec-032-frontera.test.ts` — 19 casos: el step nuevo ejecuta `npm run db:scan` y solo eso · sin `secrets.` · `contents: read` · ningún step migra, nombra Vercel/Neon ni habla con un host · ni `check-alive` ni `/api/version` en el `buildCommand` ni en los scripts · `scripts/` con sus tres habitantes · nueve `.sql` y nueve entradas de journal · lo único nuevo en `drizzle/` es el JSON, que no está en el journal · ninguna URL fuera del loopback · cadenas de conexión a `.invalid` | **Verificado sobre el diff completo `65ed40e..HEAD`, no sobre la promesa**: 17 ficheros, y el filtro `FOUNDATION|adr/|^src/|\.sql$` sobre `git diff --name-only` devuelve **ninguno**. El workflow no gana ni una referencia a `secrets.`, conserva `permissions: contents: read`, ningún step nombra Vercel ni Neon ni una URL, y ninguno invoca `db:migrate` (regla dura de ADR-018 D-4, intacta). `drizzle/` gana **un `.json` y cero `.sql`**: siguen nueve migraciones y nueve entradas de journal. **La prueba fuerte de «sin red»**: precargué en todos los procesos un bloqueo que lanza excepción ante cualquier socket, resolución DNS o `fetch` que no sea loopback —verificado con un control: `cdn.sheetjs.com` explota, `localhost` pasa— y **la suite completa pasó igual: 678/678 en 50 ficheros, 107 s**. | ✅ |
| CA-15 — `RI-01` (migraciones aditivas) en `docs/fundacion/reglas.md`, sección `RI-xx` aparte | `docs/fundacion/reglas.md`: sección **«Reglas de ingeniería (RI-xx)»** al final + **RI-01** con el texto literal del CA. **16 líneas añadidas, 0 borradas** | `tests/reglas-ingenieria.test.ts` — 26 casos: existe la sección y va al final · `RI-01` nombra *expand/contract*, qué prohíbe, cómo se parte, `SPEC-032`, `drizzle/destructive-waivers.json` y `ADR-018 D-5.1` · **las quince RN siguen ahí, en orden y con su enunciado**, y no nace ninguna `RN-16` | **Comprobado byte a byte, que es la parte frágil**: el `docs/fundacion/reglas.md` de hoy (6 374 B) **empieza con el fichero anterior íntegro** (5 396 B) — `cmp` sobre el prefijo: idéntico, y el diff tiene **0 líneas eliminadas**. Las **quince RN-01…RN-15 siguen presentes, una vez cada una, en orden y sin renumerar**, y no nace ninguna `RN-16`. La sección **«## Reglas de ingeniería (RI-xx)»** es nueva, va al final, y contiene **RI-01** con *expand/contract*, «no borra, no renombra y no estrecha», «en el mismo despliegue», el desbloqueo solo por escrito, `drizzle/destructive-waivers.json`, `SPEC-032` como su vigilante y `Fuente: ADR-018 D-5.1`. **`FOUNDATION.md` y `docs/adr/ADR-018` no aparecen en el diff.** 26 tests verdes en `tests/reglas-ingenieria.test.ts`. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
### 🟢 GREEN — 2026-08-18, sdd-verificador (contexto aislado, sin leer el relato del implementador)

**15/15 CA cerrados (✅), ninguna salvedad abierta contra un CA.** Verificado íntegramente en el
worktree `.claude/worktrees/spec-032` (`ft/SPEC-032-guardias-de-migracion`, ocho commits sobre
`origin/main` @ `65ed40e`), **en local, sin desplegar nada y con la red externa bloqueada**.

**Gates automáticos, ejecutados por mí:**

| Gate | Resultado |
|---|---|
| `npm run typecheck` | 0 |
| `npm run lint` (`--max-warnings=0`) | 0 |
| `npm test` | **678/678 en 50 ficheros**, 105 s |
| `npm test` **con la red externa cortada** | **678/678 en 50 ficheros**, 107 s |
| `npm run db:scan` | 0 — 9 escaneadas, 2 marcadas y desbloqueadas |
| Los 5 ficheros de test nuevos + los 2 tocados | **189/189**, 2,6 s |

**Las tres cosas que fui a buscar con más ganas de encontrar un fallo, y lo que encontré:**

1. **La calibración «dos de nueve» la medí yo primero, sobre los `.sql`, antes de mirar el
   escáner.** Si el detector estuviera mal calibrado y sus tests escritos para coincidir con él,
   ambos mentirían a la vez y el test de CA-8 no lo delataría. Censo directo: los únicos `DROP`
   del árbol están en `0001` (uno) y `0007` (dos), y no hay ni un `RENAME`, `TRUNCATE`,
   `DELETE FROM` ni `ALTER COLUMN` en las nueve migraciones. Los falsos positivos plausibles se
   comportan: los `ON DELETE cascade/set null` **no** son `DELETE FROM`, y los `NOT NULL` de
   `0000`/`0006` van dentro de un `CREATE TABLE` o de un `ADD COLUMN`, no de un
   `ALTER COLUMN … SET NOT NULL`. **Mi censo y el escáner coinciden exactamente.**
2. **Los caminos de rechazo los ejercité como procesos de verdad, no como aserciones.** Las
   siete filas de la tabla de decisión de la guardia en 15 subprocesos (incluida la fila
   *fail-closed*: sin `VERCEL_ENV` y sin `ALLOW_MIGRATE` → **1**), y los cinco modos de fallo del
   escáner (sin entrada, `reason` en blanco, `rollback` ausente, `statements` desfasado, y las
   dos formas de huérfano) sobre un `drizzle/` sintético en un temporal. Todos con su código de
   salida y su mensaje.
3. **«Sin red» lo verifiqué cortándola, no leyéndolo.** Precargué en todos los procesos un
   bloqueo que lanza excepción ante cualquier socket, resolución DNS o `fetch` que no sea
   loopback (control: `cdn.sheetjs.com` explota, `localhost` pasa). La **suite completa** pasó
   igual. Y con `net.Socket.connect` y `dns.*` instrumentados, la guardia hace **0 llamadas de
   red** aun con una `DATABASE_URL` en la mano: decide en ~125 ms contra un host `.invalid`.

**Lo que el contrato del gate humano del 2026-08-18 ya había resuelto, y que por tanto no cuento
como desviación:** que la guardia entre aunque con *preview branching* activo quede como
*tripwire* y auditoría (`F-SPEC-032-1`, residual **declarado**, con CA-3 como mitigación
entregada y verificada); y que el desbloqueo sea un fichero versionado en vez de una etiqueta de
PR — desvío consciente de la **letra** de ADR-018 D-5.2, firmado, que conserva su propiedad y la
mejora (queda en el diff y sobrevive a la PR). **ADR-018 no se toca**, y no debe tocarse.

**CA-15, que es lo nuevo y lo frágil, cierra limpio.** El `reglas.md` de hoy contiene el anterior
**byte a byte como prefijo**: 0 líneas eliminadas, las quince RN-01…RN-15 intactas, en orden, sin
renumerar y sin que nazca una `RN-16`. La sección `RI-xx` es nueva y va al final. `FOUNDATION.md`
y `ADR-018` no aparecen en el diff.

**Salvedad aceptada, no defecto:** `tests/spec-031-frontera.test.ts` está tocado y queda **fuera
del alcance literal** de §Fuera de alcance, que solo autorizaba el mapa `GATES` de
`tests/ci-workflow.test.ts`. Es mecánicamente inevitable —ese test congelaba el literal del
`buildCommand` que CA-4 cambia y la lista cerrada de steps que CA-11 amplía—, el cambio se limita
a esos dos valores, la propiedad que el bloque defiende sigue en pie (lista cerrada; nada entra
sin un CA que lo pida), y **el implementador lo declaró él mismo** como `F-SPEC-032-3` en vez de
esconderlo. **Lo doy por cerrado aquí**: es un descuido de redacción de la spec, no de la
implementación.

**Lo único que no puedo verificar desde este worktree, y no me lo pide ningún CA:** la pasada
real de la CI con `Migration scan` (no existe hasta que haya PR, y no abro PR ni empujo), y
`F-SPEC-032-2` (`ALLOW_MIGRATE=1` en el entorno Preview), que es acción de ops declarada. **D-7
sigue aplazada** (`F-SPEC-031-1`) y no la exijo.

**Transición: `en-revision` → `hecho`**, registrada con `estado.mjs`.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-032/. Informe HTML opcional: _qa/SPEC-032/informe.html -->
**No aplica captura de pantalla.** Ninguna pantalla cambia y no hay flujo de usuario que
capturar: la evidencia de esta spec son códigos de salida de dos scripts, un YAML parseado y un
runbook. Aquí va la salida **real**, pegada tal cual.

### La guardia, en sus tres decisiones

```
$ VERCEL_ENV=production DATABASE_URL="postgres://neondb_owner:npg_XXXX@ep-cool-1234.eu-central-1.aws.neon.tech:5432/neondb?sslmode=require" node scripts/guard-migrate.mjs
[guard-migrate] AUTORIZADO: VERCEL_ENV=production — es el entorno de producción.
[guard-migrate] DATABASE_URL: host=ep-cool-1234.eu-central-1.aws.neon.tech:5432 base=neondb
exit=0
```

Nótese lo que **no** aparece: ni `neondb_owner`, ni `npg_XXXX`, ni `sslmode`. Es CA-3, y es la
mitigación de F-SPEC-032-1: no previene, delata.

```
$ VERCEL_ENV=preview node scripts/guard-migrate.mjs
[guard-migrate] RECHAZADO: VERCEL_ENV=preview — este entorno no declara permiso para migrar.
[guard-migrate] Para autorizarlo, este entorno debe declarar ALLOW_MIGRATE=1 (valor literal; `true`, `yes` o `0` no valen).
[guard-migrate] La base no se ha tocado: la migración no ha llegado a ejecutarse.
exit=1

$ node scripts/guard-migrate.mjs --migra-porfa
[guard-migrate] No acepto argumentos (recibido: --migra-porfa).
(… el contrato de --help …)
exit=2
```

### El escáner, en verde y en rojo

Verde, sobre el `drizzle/` real ya sembrado (CA-8 + CA-9):

```
$ npm run db:scan
[scan-destructive-sql] 9 migración(es) escaneada(s) en …/drizzle.
[scan-destructive-sql] 2 con SQL destructivo, todas desbloqueadas por escrito en destructive-waivers.json:
[scan-destructive-sql]   0001_symbol_market_identity.sql — 1 sentencia(s), desbloqueada por SPEC-008.
[scan-destructive-sql]   0007_tearful_roughhouse.sql — 2 sentencia(s), desbloqueada por SPEC-024.
exit=0
```

Rojo, medido **antes** de sembrar los desbloqueos —es decir, el estado real del repositorio
hasta este commit—, que es a la vez la calibración de CA-8 y el mensaje de CA-10:

```
[scan-destructive-sql] SQL DESTRUCTIVO sin desbloquear, o desbloqueo inválido.

  0001_symbol_market_identity.sql, línea 1 — DROP
    ALTER TABLE "symbols" DROP CONSTRAINT "symbols_ticker_unique"
  0007_tearful_roughhouse.sql, línea 1 — DROP
    ALTER TABLE "notifications" DROP CONSTRAINT "notifications_zone_trigger_id_zone_triggers_id_fk"
  0007_tearful_roughhouse.sql, línea 3 — DROP
    ALTER TABLE "zone_triggers" DROP CONSTRAINT "zone_triggers_watched_symbol_id_watched_symbols_id_fk"

  · 0001_symbol_market_identity.sql: 1 sentencia(s) destructiva(s) SIN desbloquear. Falta su entrada en destructive-waivers.json.
  · 0007_tearful_roughhouse.sql: 2 sentencia(s) destructiva(s) SIN desbloquear. Falta su entrada en destructive-waivers.json.

[scan-destructive-sql] Si el cambio es deliberado, pega esto en …/drizzle/destructive-waivers.json
(fusiónalo con lo que ya haya) y rellena los tres campos vacíos …:

8<
{
  "0001_symbol_market_identity": { "spec": "", "reason": "", "rollback": "", "statements": 1 },
  "0007_tearful_roughhouse":     { "spec": "", "reason": "", "rollback": "", "statements": 2 }
}
>8
exit=1
```

**Dos de nueve, y son las dos que el arquitecto midió y que ADR-018 midió sobre ocho.** Ninguna
de las otras siete se marca. Ese conjunto está congelado en un test (CA-8) precisamente para que
una futura «mejora» del detector se caiga el mismo día.

### Lo que falta y no es mío

- **La ejecución de la CI con `Migration scan` en verde**, y —al menos una vez, a propósito— en
  rojo. Eso solo existe cuando haya PR: lo recoge sdd-verificador o el humano al abrirla.
- **La cobertura local está en su sitio**: `tests/ci-workflow.test.ts` parsea el YAML de verdad
  y afirma el step, su `if`, y que invoca `npm run db:scan` y nada más.

## Salvedades / follow-ups
<!-- IDs F-SPEC-032-1, F-SPEC-032-2… con destino (spec futura o EPIC-MEJORA). -->
Abiertos ya en el nacimiento de la spec (declarados en §Fuera de alcance y §Notas para el gate):

- **F-SPEC-032-1 — `ALLOW_MIGRATE=1` en el entorno Preview es una autorización permanente que
  asume que el *preview branching* de Neon sigue encendido.** Si alguien lo apaga, o reconecta el
  recurso sin esa casilla, el permiso sobrevive y vuelve a apuntar a producción: la guardia
  pregunta *"¿tengo permiso?"*, no *"¿contra qué base?"*. Mitigación entregada aquí: CA-3 obliga a
  imprimir host y base en el log del build (delata, no previene). Cierre real —comprobar desde el
  build que un Preview no apunta a la base de producción— exige conocer la identidad de esa base
  o un marcador de la integración de Neon **no verificado**; no se inventa aquí. → **SPEC-028**.
- **F-SPEC-032-2 — poner `ALLOW_MIGRATE=1` en el entorno Preview de Vercel.** Acción de **ops**,
  no código; esta spec la documenta (CA-13.1) pero no la ejecuta. Hoy no rompe nada porque sin
  integración Git no se disparan builds de Preview; el día que SPEC-028 conecte el repo **sin**
  esa variable, todas las previews fallarán en la guardia — que es el comportamiento correcto
  (ADR-018 D-3), pero conviene que sea decisión y no sorpresa. → **SPEC-028 / ops**.

Abierto **durante la implementación** (2026-08-18, sdd-implementador):

- **F-SPEC-032-3 — dos tests de SPEC-031 congelaban el estado que esta spec cambia, y he tenido
  que tocarlos.** `tests/spec-031-frontera.test.ts` fijaba (a) el literal completo de
  `vercel.json`, incluido `"buildCommand": "npm run db:migrate && npm run build"`, y (b) la lista
  cerrada de steps con `run` del workflow. **CA-4 cambia lo primero y CA-11 lo segundo**, así que
  la única forma de dejar esos dos literales intactos era no implementar la spec. He actualizado
  los dos valores —nada más— y he dejado escrito en el propio test por qué, conservando la
  propiedad que aquel bloque defiende: que nada entra ahí sin un CA que lo pida.
  **Sale del alcance literal de §Fuera de alcance**, que solo autorizaba a tocar el mapa `GATES`
  de `tests/ci-workflow.test.ts`; es un descuido de la spec, no una decisión mía, y por eso queda
  declarado en vez de escondido. → **para el gate del verificador**; sin destino futuro: se cierra
  al aceptarlo.
  **✅ CERRADO el 2026-08-18 por sdd-verificador**: aceptado. Comprobé el cambio y se limita a los
  dos literales; el bloque sigue siendo una lista cerrada que defiende la misma propiedad, y no
  hay ningún otro test existente tocado. El descuido es de la spec, no de la implementación.

Heredados, sin cambio y sin efecto sobre los CA de esta spec:

- **F-SPEC-027-1** — la CI **informa pero no impide** mezclar (repo privado + org en plan free →
  `403 Upgrade to GitHub Pro`). Se aplica también al gate nuevo: `Migration scan` en rojo publica,
  no bloquea. La guardia de build **no** se ve afectada: no depende de GitHub en absoluto.
- **F-SPEC-027-5** — `actions/checkout@v4` y `actions/setup-node@v4` deprecadas. Deuda con fecha,
  ajena a esta spec.
- **F-SPEC-031-1** — adoptar **D-7** (*"hecho" exige "vivo"*), aplazado al gate de **SPEC-028**.
  Esta spec no lo toca.
- **Pregunta 7 del gate de ADR-018** — la ventana real de restauración de Neon sigue sin medirse,
  y es la red última ante una migración destructiva. Comprobación de ops.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
**Estado: implementación terminada, spec en `en-revision`.** Toca sdd-verificador. No hay push
ni PR: eso lo hace el orquestador.

**Qué hay en la rama `ft/SPEC-032-guardias-de-migracion`** (worktree `.claude/worktrees/spec-032`,
sobre `origin/main` @ `65ed40e`), un commit por bloque de CA:

| Commit | Qué cierra |
|---|---|
| `docs(SPEC-032)`: la spec y su ledger entran al repo | Estaban *untracked* |
| `feat(SPEC-032)`: la guardia, fail-closed y cableada en `vercel.json` | CA-1 … CA-5 |
| `feat(SPEC-032)`: el escáner y sus dos desbloqueos sembrados | CA-6 … CA-10, CA-12 |
| `feat(SPEC-032)`: `Migration scan` es un gate con nombre propio | CA-11 |
| `docs(SPEC-032)`: `RI-01` en `docs/fundacion/reglas.md` | CA-15 |
| `docs(SPEC-032)`: el runbook documenta las dos guardias | CA-13 |
| `test(SPEC-032)`: la frontera es un criterio, no una promesa | CA-14 |

**Ficheros nuevos**: `scripts/guard-migrate.mjs`, `scripts/scan-destructive-sql.mjs`,
`drizzle/destructive-waivers.json`, y cinco de test — `tests/guard-migrate.test.ts`,
`tests/destructive-sql-scan.test.ts`, `tests/reglas-ingenieria.test.ts`,
`tests/runbook-guardias-migracion.test.ts`, `tests/spec-032-frontera.test.ts` (154 casos entre
los cinco).
**Modificados**: `vercel.json` (`buildCommand`), `package.json` (`db:scan`),
`.github/workflows/ci.yml` (step `Migration scan`), `tests/ci-workflow.test.ts` (`GATES` a seis),
`tests/spec-031-frontera.test.ts` (dos literales congelados; ver **F-SPEC-032-3**),
`docs/despliegue.md` (§11 nueva + §1.1/§6/§9/cabecera/nota de Preview),
`docs/fundacion/reglas.md` (+16 líneas, −0).

**Cómo comprobarlo en un minuto**, sin red y sin desplegar:

```bash
npm ci                     # dentro del worktree: sin node_modules propio, la resolución cae al padre
npm run typecheck && npm run lint && npm test
npm run db:scan            # 0, con las dos desbloqueadas
VERCEL_ENV=preview node scripts/guard-migrate.mjs   # 1, y dice qué falta
```

**Lo que NO se ha hecho, y es correcto que no se haya hecho** (CA-14): no se ha conectado el
repositorio a Vercel, no hay puerta post-deploy, no se ha tocado `/api/version` ni
`scripts/check-alive.mjs`, no hay migración nueva y `src/` no cambia ni una línea. **D-7 sigue
aplazada** (`F-SPEC-031-1`) y no se ha empujado.

**Lo que queda para el humano / ops, ya declarado**: `ALLOW_MIGRATE=1` en el entorno Preview
(**F-SPEC-032-2**, `vercel env add ALLOW_MIGRATE preview`), documentado en §11.1 del runbook. Sin
esa variable, el día que SPEC-028 conecte el repositorio **todas las previews fallarán en la
guardia** — que es el comportamiento correcto, pero conviene que sea decisión y no sorpresa.
