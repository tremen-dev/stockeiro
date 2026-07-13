import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

/**
 * Cliente de producción: Neon Postgres serverless (ADR-001).
 * Los tests NO importan este módulo; usan `src/db/test-db.ts` (PGlite).
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no definida. Configúrala (ver .env.example).');
}

const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
