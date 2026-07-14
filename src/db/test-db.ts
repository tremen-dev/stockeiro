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
    CREATE TABLE symbols (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ticker text NOT NULL UNIQUE,
      currency text NOT NULL
    );
    CREATE TABLE transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id),
      symbol_id uuid NOT NULL REFERENCES symbols(id),
      type text NOT NULL,
      occurred_on date NOT NULL,
      quantity numeric,
      price numeric,
      gastos numeric,
      ratio numeric,
      amount numeric,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE watched_symbols (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id),
      symbol_id uuid NOT NULL REFERENCES symbols(id),
      buy_min numeric,
      buy_max numeric,
      sell_min numeric,
      sell_max numeric,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, symbol_id)
    );
    CREATE TABLE quotes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      symbol_id uuid NOT NULL UNIQUE REFERENCES symbols(id),
      price numeric NOT NULL,
      currency text NOT NULL,
      as_of timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE zone_triggers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id),
      watched_symbol_id uuid NOT NULL REFERENCES watched_symbols(id),
      symbol_id uuid NOT NULL REFERENCES symbols(id),
      zone_kind text NOT NULL,
      price numeric NOT NULL,
      as_of timestamptz NOT NULL,
      opened_at timestamptz NOT NULL DEFAULT now(),
      closed_at timestamptz
    );
    CREATE TABLE notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id),
      kind text NOT NULL,
      zone_trigger_id uuid REFERENCES zone_triggers(id),
      cycle_ref text,
      payload text NOT NULL,
      channel text NOT NULL,
      status text NOT NULL,
      as_of timestamptz NOT NULL,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT notif_entry_trigger UNIQUE (zone_trigger_id),
      CONSTRAINT notif_digest_cycle UNIQUE (user_id, cycle_ref)
    );
  `);
  const db = drizzle(client, { schema });
  return { db, client };
}

export type TestDb = Awaited<ReturnType<typeof makeTestDb>>['db'];
