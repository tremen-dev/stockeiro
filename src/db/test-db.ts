import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { PGlite } from '@electric-sql/pglite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

/**
 * Base de datos de test: Postgres embebido (PGlite, WASM). Permite probar el
 * comportamiento real contra Postgres —unicidad, aislamiento, persistencia—
 * sin depender de un servicio externo. En producción se usa Neon (ADR-001).
 *
 * El esquema NO se escribe aquí: se obtiene aplicando las migraciones de
 * `drizzle/`, las mismas que se aplican a producción (ADR-019, SPEC-026). Hay
 * una sola definición del esquema —`src/db/schema.ts`, materializada en esas
 * migraciones— y ya no hay nada que sincronizar a mano. Eso incluye las
 * cláusulas `ON DELETE` de SPEC-024, que son DDL puro y ningún test de
 * comportamiento delataría (quedan ancladas en `tests/schema-source.test.ts`).
 *
 * Consecuencias que conviene conocer (ADR-019):
 * - Toda migración futura debe poder aplicarse sobre PGlite.
 * - Una migración que no aplique limpia tumba TODA la suite, no un test: un
 *   fallo masivo y homogéneo se lee como "la migración nueva no aplica".
 * - Aparece el esquema `drizzle` (tabla de control). Cualquier test que
 *   enumere el catálogo debe acotarse a `public`.
 */

/** Resuelto desde este fichero, no desde el cwd: así el arnés funciona se
 *  invoque desde donde se invoque. */
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle');

export async function makeTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db, client };
}

export type TestDb = Awaited<ReturnType<typeof makeTestDb>>['db'];
