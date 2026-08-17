// Launcher del e2e (RED-1): arranca un Postgres real efímero (embedded-postgres),
// crea el esquema, y lanza `next start` apuntando a él con DB_DRIVER=pg. Playwright
// usa este comando como webServer y espera a que responda. Al recibir señal de
// parada, tumba la app y Postgres.
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PG_PORT = 54329;
const APP_PORT = 3200;
const DB = 'stockeiro_e2e';
const dir = './.pg-e2e';
// SPEC-023: buzón de correo del e2e. La app corre en OTRO proceso, así que el enlace
// de recuperación se vuelca aquí (JSON por línea) para que el test pueda leerlo.
// El mismo path lo lee tests/e2e/recuperacion.spec.ts. Nunca se llama a Resend.
const OUTBOX = './.e2e-outbox.jsonl';

// Resuelto desde este fichero, no desde el cwd (SPEC-026).
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle');

try {
  rmSync(dir, { recursive: true, force: true });
  rmSync(OUTBOX, { force: true });
} catch {
  // no existían: nada que limpiar
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

// El esquema del e2e se obtiene aplicando las migraciones de `drizzle/` —las mismas
// que se aplican a producción (ADR-018, SPEC-026)—. Ya no hay una copia del esquema
// aquí que pudiera divergir en silencio, cláusulas ON DELETE incluidas (SPEC-024).
const sql = postgres(url, { ssl: false, max: 1 });
await migrate(drizzle(sql), { migrationsFolder });
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
    // SPEC-023 CA-4: el origen del enlace sale de configuración, no de la cabecera Host.
    APP_BASE_URL: `http://localhost:${APP_PORT}`,
    // SPEC-023: el correo va al buzón en disco (ADR-006 tras el puerto), nunca a Resend.
    E2E_OUTBOX_FILE: OUTBOX,
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
