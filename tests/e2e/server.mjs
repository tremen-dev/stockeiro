// Launcher del e2e (RED-1): arranca un Postgres real efímero (embedded-postgres),
// crea el esquema, y lanza `next start` apuntando a él con DB_DRIVER=pg. Playwright
// usa este comando como webServer y espera a que responda. Al recibir señal de
// parada, tumba la app y Postgres.
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const PG_PORT = 54329;
const APP_PORT = 3200;
const DB = 'stockeiro_e2e';
const dir = './.pg-e2e';

try {
  rmSync(dir, { recursive: true, force: true });
} catch {
  // directorio inexistente: nada que limpiar
}

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'postgres',
  port: PG_PORT,
  persistent: false,
});

await pg.initialise();
await pg.start();
await pg.createDatabase(DB);

const url = `postgres://postgres:postgres@localhost:${PG_PORT}/${DB}`;

// Esquema (idéntico a src/db/schema.ts / test-db.ts).
const sql = postgres(url, { ssl: false, max: 1 });
await sql`CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE TABLE IF NOT EXISTS symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  mic_code text,
  exchange text,
  name text,
  currency text NOT NULL,
  CONSTRAINT symbols_ticker_mic UNIQUE (ticker, mic_code)
)`;
await sql`CREATE INDEX IF NOT EXISTS symbols_ticker_idx ON symbols (ticker)`;
await sql`CREATE TABLE IF NOT EXISTS transactions (
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
  import_key text,
  importe_eur numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactions_user_import_key UNIQUE (user_id, import_key)
)`;
await sql`CREATE TABLE IF NOT EXISTS symbol_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  broker_name text NOT NULL,
  market_label text NOT NULL,
  symbol_id uuid NOT NULL REFERENCES symbols(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT symbol_alias_user_broker_market UNIQUE (user_id, broker_name, market_label)
)`;
await sql`CREATE INDEX IF NOT EXISTS symbol_alias_user_idx ON symbol_aliases (user_id)`;
await sql`CREATE TABLE IF NOT EXISTS watched_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  symbol_id uuid NOT NULL REFERENCES symbols(id),
  buy_min numeric,
  buy_max numeric,
  sell_min numeric,
  sell_max numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol_id)
)`;
await sql`CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol_id uuid NOT NULL UNIQUE REFERENCES symbols(id),
  price numeric NOT NULL,
  currency text NOT NULL,
  as_of timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE TABLE IF NOT EXISTS zone_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  watched_symbol_id uuid NOT NULL REFERENCES watched_symbols(id),
  symbol_id uuid NOT NULL REFERENCES symbols(id),
  zone_kind text NOT NULL,
  price numeric NOT NULL,
  as_of timestamptz NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
)`;
await sql`CREATE TABLE IF NOT EXISTS notifications (
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
)`;
await sql.end();

const child = spawn('npx', ['next', 'start', '-p', String(APP_PORT)], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: url,
    DB_DRIVER: 'pg',
    AUTH_SECRET: 'e2e-secret-please-change-0123456789',
    AUTH_TRUST_HOST: 'true',
    NODE_ENV: 'production',
    // SPEC-008: el buscador usa el catálogo fake (determinista, sin red) en e2e.
    E2E_FAKE_SYMBOL_SEARCH: '1',
    // SPEC-015/ADR-012: las cotizaciones usan el fake (sin llamar a Marketstack).
    E2E_FAKE_QUOTES: '1',
  },
});

async function shutdown() {
  try {
    child.kill();
  } catch {
    // ya terminado
  }
  try {
    await pg.stop();
  } catch {
    // ya parado
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
child.on('exit', (code) => {
  pg.stop().finally(() => process.exit(code ?? 0));
});
