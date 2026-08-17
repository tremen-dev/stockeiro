---
id: ADR-018
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-17, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-17, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-018: El esquema de test es el de producción — una sola fuente aplicada desde las migraciones

- Deciders: propone **sdd-arquitecto** (2026-08-17), a raíz de **F-SPEC-024-3** abierto por
  sdd-implementador y elevado por sdd-verificador. Aprueba **el humano en el gate de SPEC-026**.
- Specs relacionadas: **SPEC-026** (la implementa), **SPEC-024** (el precedente que lo motiva),
  SPEC-001/002/003/004/005/006/007/012/013/015/016/023 (todas las que montan esquema en test).

## Contexto

El mismo esquema de base de datos está escrito **tres veces** en el repo, y las tres copias se
mantienen sincronizadas **a mano**:

1. `drizzle/*.sql` — migraciones generadas desde `src/db/schema.ts`. Es lo que se aplica a
   **producción** (Neon, ADR-001).
2. `src/db/test-db.ts` — DDL a mano sobre PGlite. Es contra lo que corren los **273 tests
   unitarios**.
3. `tests/e2e/server.mjs` — DDL a mano sobre el Postgres efímero. Es contra lo que corre el **e2e**.

Nada comprueba que coincidan. El modo de fallo no es un test rojo, sino **un test verde que
valida lo que no es**: si alguien cambia `src/db/schema.ts` y regenera la migración sin tocar
los otros dos DDL, la suite entera sigue verde contra un esquema que no es el de producción.

No es hipotético. **SPEC-024** corrigió dos cláusulas `ON DELETE` (`zone_triggers` → cascade,
`notifications` → set null) que **tuvieron que replicarse a mano en los tres sitios**; el
tercero (`server.mjs`) ni siquiera estaba en la spec y lo descubrió el implementador a mitad
de trabajo. Si se hubiera olvidado, CA-7 y CA-13 habrían pasado en verde con el bug intacto en
producción. Y `onDelete` es el caso más traicionero: es **DDL puro, sin efecto en runtime**, así
que ningún test de comportamiento lo delata — solo el esquema real lo dice.

Medición del estado actual (2026-08-17, comparando el catálogo de Postgres de las dos fuentes
levantadas en paralelo sobre PGlite): **48 diferencias, todas de NOMBRE de constraint o índice,
ninguna de definición**. Es decir: las tres copias son hoy semánticamente equivalentes —el
verificador tenía razón— pero ya han divergido en lo que Postgres sí distingue. Ejemplos:
`watched_user_symbol` (migración) frente a `watched_symbols_user_id_symbol_id_key` (DDL a mano);
`users_email_unique` frente a `users_email_key`. Hoy nadie depende de esos nombres; el día que
alguien capture un `23505` por `constraint_name`, o use `onConflictDoConstraint`, la
divergencia deja de ser cosmética.

## Decisión

**Hay una sola definición del esquema: `src/db/schema.ts`, materializada en las migraciones de
`drizzle/`. Todo entorno que necesite el esquema —producción, unitarios y e2e— lo obtiene
aplicando esas migraciones. El DDL escrito a mano desaparece del repo.**

En concreto:

1. `src/db/test-db.ts` aplica las migraciones de `drizzle/` sobre PGlite
   (`drizzle-orm/pglite/migrator`) en vez de ejecutar su bloque de `CREATE TABLE`.
2. `tests/e2e/server.mjs` hace lo mismo sobre el Postgres efímero
   (`drizzle-orm/postgres-js/migrator`), reutilizando la conexión que ya abre.
3. La cadena de migraciones queda sujeta a una restricción nueva: **toda migración debe poder
   aplicarse sobre PGlite**. Deja de ser libre usar en una migración cualquier cosa que el
   Postgres WASM no soporte. A cambio, la suite entera se convierte en la prueba de que la
   cadena de migraciones aplica limpia desde cero — cobertura que hoy no existe en ninguna parte.
4. Como la unificación deja **un** eslabón manual vivo —cambiar `src/db/schema.ts` y olvidar
   `db:generate`—, y ese eslabón reproduce exactamente el mismo fallo silencioso para `onDelete`,
   la decisión incluye una **guardia automática y en rojo** de que no hay cambios de esquema sin
   migrar. Sin esa guardia, la decisión mueve el agujero en vez de cerrarlo.

## Consecuencias

### Positivas

- **La clase de fallo desaparece por construcción**, no por vigilancia: no hay tres cosas que
  puedan divergir porque solo hay una. Se cumple el criterio "que no dependa de que nadie se
  acuerde de nada".
- **Los tests corren contra el esquema de producción, nombres incluidos**: las 48 divergencias
  de nombre se evaporan, y con ellas el riesgo latente de que un manejo de error por
  `constraint_name` se pruebe contra un nombre que producción no tiene.
- **La cadena de migraciones queda probada en cada `npm test`**. Hoy nada verifica que
  `0000..0007` apliquen limpio sobre una base vacía; el primer sitio donde se descubriría una
  migración rota es el despliegue. Verificado ya: las 8 aplican sobre PGlite y sobre Postgres 17
  real, y los 273 tests pasan sin tocar ni una expectativa.
- Añadir una tabla o una columna pasa a ser **un solo cambio** (`schema.ts` + `db:generate`) en
  vez de tres ediciones coordinadas.

### Negativas / follow-ups

- **La suite se ralentiza ~6%** (medida en SPEC-026: ~87s → ~94s de *duration* de Vitest, dos
  ejecuciones de cada). El coste es de **+112 ms por instancia de PGlite** y el arnés se levanta
  en `beforeEach` de 23 ficheros, así que **crece con el número de migraciones**: hoy son 8.
  Follow-up con umbral explícito: si el arranque del arnés supera los **~250 ms de sobrecoste**
  (orden de 20-25 migraciones), toca actuar —o bien colapsar el histórico en un *squash* de
  migraciones, o bien reutilizar una instancia de PGlite y truncar entre tests—. No se hace
  ahora: 6% no molesta y optimizar sin necesidad añade un mecanismo que también puede divergir.
- **Una migración rota tumba TODA la suite**, no un test. Es el precio correcto (es también el
  aviso más temprano posible), pero cambia el diagnóstico: un fallo masivo y homogéneo en 30
  ficheros a la vez debe leerse como "la migración nueva no aplica", no como "he roto el dominio".
- **Restricción nueva sobre las migraciones**: han de ser aplicables por PGlite. Extensiones,
  tipos o sintaxis que el WASM no soporte quedan vetados de facto. Con el stack actual (uuid,
  text, numeric, date, timestamptz, `gen_random_uuid()`) no hay ningún roce.
- **Aparece el schema `drizzle`** (tabla de control `__drizzle_migrations`) en las bases de test.
  Es inerte para el dominio, pero cualquier test que enumere el catálogo debe acotarse a `public`.
- **Residual conocido, no cerrado**: la guardia del punto 4 diffea `schema.ts` contra los
  *snapshots* de `drizzle/meta/`, no contra el SQL aplicado. Si alguien **edita un `.sql` a mano**
  sin tocar su snapshot, la guardia no lo ve. El daño queda acotado —test y producción aplican
  ese mismo `.sql`, así que **siguen coincidiendo**, que es lo que este ADR protege— y la regla
  vigente sigue siendo la de SPEC-024: las migraciones se generan con `db:generate`, no se
  escriben a mano. Se registra, no se resuelve.

## Alternativas consideradas

- **(a) Un test de coherencia que compare las tres definiciones** (levantar cada una y diffear el
  catálogo de Postgres). Es la que más sonaba a priori. **Rechazada por medición**: ejecutado el
  comparador, da **48 diferencias hoy mismo**, todas de nombre. Nace en rojo, así que exige
  normalizar los nombres — y esa normalización es lógica escrita a mano que hay que mantener
  correcta: se cambia "acuérdate de sincronizar tres DDL" por "acuérdate de que el comparador
  siga siendo honesto", que es peor porque es más sutil. Además **conserva las tres fuentes** y
  todo su coste de mantenimiento: solo detecta la divergencia, no la elimina. Y para cubrir la
  tercera fuente (el e2e) tendría que arrancar `embedded-postgres` dentro de la suite unitaria
  (**8,8 s de arranque medidos**), diez veces más caro que la opción elegida.
- **(b) `drizzle-kit push`: generar el DDL de test desde `schema.ts` en tiempo de test.**
  Rechazada porque **prueba la cosa equivocada**: lo que corre en producción es la cadena de
  migraciones, no `schema.ts`. Un `push` deja el test verde precisamente cuando alguien cambió
  `schema.ts` y **no** generó la migración — el hueco que el punto 4 existe para cerrar. Encima
  es un CLI que necesita conexión viva, mal encaje en un `beforeEach`.
- **(c) Generar los dos DDL a mano desde el esquema en tiempo de build** (un script que escriba
  `test-db.ts` y `server.mjs`). Rechazada por ser drizzle-kit reimplementado en casa, con
  artefactos generados versionados que alguien acabará editando a mano, y sin resolver nada que
  aplicar las migraciones no resuelva ya.
- **(d) No hacer nada y confiar en la disciplina.** Es el statu quo, y es lo que **ya falló una
  vez**: en SPEC-024 la tercera copia se descubrió por casualidad. El fallo es silencioso y con
  cobertura verde, la peor combinación posible.
