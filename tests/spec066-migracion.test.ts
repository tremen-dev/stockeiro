import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// El escáner de SPEC-032 se consume tal cual, sin tipos: es un script de node.
import * as escaner from '../scripts/scan-destructive-sql.mjs';

/**
 * SPEC-066 CA-20 — la migración de la cuenta pendiente: ADITIVA, las cuentas de antes
 * quedan activadas y las que inserte el código anterior durante la convivencia, también
 * (ADR-042 ptos. 2 y 3, RI-01).
 *
 * El esquema sale de los `.sql` de `drizzle/` (ADR-019): aquí no se escribe DDL. Para
 * medir el relleno se aplica todo lo ANTERIOR, se siembran cuentas como las tendría
 * producción y sólo entonces se aplica la migración de esta spec. La migración se busca
 * por su nombre (`0012_account_activation`), no por posición: que después vengan otras
 * no pone esto rojo.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(rootDir, 'drizzle');
const TAG = '0012_account_activation';

type JournalEntry = { idx: number; tag: string };
type Marcada = { tag: string; hallazgos: unknown[] };
const escanear = (dir: string) =>
  (escaner as unknown as { escanear: (d: string) => { ficheros: Marcada[] } }).escanear(dir);

function journalEntries(): JournalEntry[] {
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: JournalEntry[] };
  return [...journal.entries].sort((a, b) => a.idx - b.idx);
}

async function aplicar(client: PGlite, tag: string) {
  const sql = readFileSync(join(migrationsDir, `${tag}.sql`), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    if (statement.trim() === '') continue;
    await client.exec(statement);
  }
}

describe('SPEC-066 CA-20: la migración es aditiva y no deja a nadie fuera', () => {
  let client: PGlite;
  const antes = { a: '', b: '' };

  beforeAll(async () => {
    const entradas = journalEntries();
    const propia = entradas.find((e) => e.tag === TAG);
    expect(propia, `no está ${TAG} en el diario de drizzle/`).toBeDefined();

    client = new PGlite();
    for (const e of entradas.filter((x) => x.idx < propia!.idx)) await aplicar(client, e.tag);

    // Dos cuentas "de producción", con fechas de alta distintas y en el pasado.
    const sembrar = async (email: string, creada: string) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, created_at) VALUES ($1, 'x', $2) RETURNING id`,
        [email, creada],
      );
      return rows[0].id;
    };
    antes.a = await sembrar('antigua-a@example.com', '2026-08-01T10:00:00Z');
    antes.b = await sembrar('antigua-b@example.com', '2026-09-20T18:30:00Z');

    for (const e of entradas.filter((x) => x.idx >= propia!.idx)) await aplicar(client, e.tag);
  });

  afterAll(async () => {
    await client?.close();
  });

  it('toda cuenta previa queda ACTIVADA con email_verified_at = created_at', async () => {
    const { rows } = await client.query<{ id: string; iguales: boolean; verificada: Date | null }>(
      `SELECT id, email_verified_at = created_at AS iguales, email_verified_at AS verificada
         FROM users WHERE id IN ($1, $2)`,
      [antes.a, antes.b],
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.verificada, `${r.id} ha quedado pendiente`).not.toBeNull();
      expect(r.iguales, `${r.id} no conserva su fecha de alta como fecha de verificación`).toBe(true);
    }
  });

  it('una fila insertada SIN nombrar la columna (código anterior) nace activada', async () => {
    const { rows } = await client.query<{ verificada: Date | null }>(
      `INSERT INTO users (email, password_hash) VALUES ('codigo-viejo@example.com', 'x')
       RETURNING email_verified_at AS verificada`,
    );
    expect(rows[0].verificada).not.toBeNull();
  });

  it('y el camino nuevo PUEDE escribir NULL: la columna admite la cuenta pendiente', async () => {
    const { rows } = await client.query<{ verificada: Date | null }>(
      `INSERT INTO users (email, password_hash, email_verified_at)
       VALUES ('pendiente@example.com', 'x', NULL) RETURNING email_verified_at AS verificada`,
    );
    expect(rows[0].verificada).toBeNull();
  });

  it('la tabla email_verification_tokens existe con digest ÚNICO y cuelga de users', async () => {
    const { rows: columnas } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'email_verification_tokens'`,
    );
    const nombres = columnas.map((c) => c.column_name);
    for (const c of ['id', 'user_id', 'token_hash', 'expires_at', 'consumed_at', 'created_at']) {
      expect(nombres, `falta la columna ${c}`).toContain(c);
    }
    // Ni rastro de un secreto en claro: sólo el digest.
    expect(nombres.filter((n) => n === 'token')).toEqual([]);

    const { rows: unicas } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.table_constraints tc
         JOIN information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'email_verification_tokens' AND tc.constraint_type = 'UNIQUE'
          AND ccu.column_name = 'token_hash'`,
    );
    expect(unicas[0].n).toBe(1);

    const { rows: usuario } = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'pendiente@example.com'`,
    );
    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, 'digest-1', now() + interval '1 hour')`,
      [usuario[0].id],
    );
    await expect(
      client.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, 'digest-1', now() + interval '1 hour')`,
        [usuario[0].id],
      ),
    ).rejects.toThrow();
  });

  it('db:scan no encuentra SQL destructivo en la migración de esta spec', () => {
    const marcadas = escanear(migrationsDir).ficheros.filter((f) => f.hallazgos.length > 0);
    // Centinela: el escáner sí ve las destructivas históricas, así que está mirando.
    expect(marcadas.length).toBeGreaterThan(0);
    expect(marcadas.map((m) => m.tag)).not.toContain(TAG);
  });
});
