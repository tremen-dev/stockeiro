import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';

/**
 * Base de datos de test: Postgres embebido (PGlite, WASM). Permite probar el
 * comportamiento real contra Postgres —unicidad, aislamiento, persistencia—
 * sin depender de un servicio externo. En producción se usa Neon (ADR-001).
 *
 * El esquema se crea con SQL explícito para no depender de drizzle-kit en tests;
 * debe mantenerse en sincronía con `src/db/schema.ts`.
 */
export async function makeTestDb() {
  const client = new PGlite();
  await client.exec(`
    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  const db = drizzle(client, { schema });
  return { db, client };
}

export type TestDb = Awaited<ReturnType<typeof makeTestDb>>['db'];
