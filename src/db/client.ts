import type { PgDatabase } from 'drizzle-orm/pg-core';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Cliente de base de datos, INTERCAMBIABLE por driver (ADR-001, RED-1):
 * - `DB_DRIVER=neon` (por defecto): Neon Postgres serverless en producción.
 * - `DB_DRIVER=pg`: Postgres estándar (driver postgres-js), para desarrollo o
 *   para el e2e contra una instancia local efímera.
 *
 * En ambos casos el resto de la app depende solo de `db` (un PgDatabase de
 * Drizzle), no del driver concreto. Los tests unitarios usan `test-db.ts` (PGlite).
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no definida. Configúrala (ver .env.example).');
}

const driver = process.env.DB_DRIVER ?? 'neon';

export const db: PgDatabase<any, any, any> =
  driver === 'pg'
    ? drizzlePg(postgres(connectionString, { max: 5, ssl: false }), { schema })
    : drizzleNeon(neon(connectionString), { schema });
