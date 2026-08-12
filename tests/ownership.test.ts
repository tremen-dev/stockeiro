import { describe, it, expect, beforeEach } from 'vitest';
import { pgTable, uuid, text } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { registerUser } from '@/lib/auth/users';
import { users } from '@/db/schema';
import { listForOwner, findByIdForOwner } from '@/lib/data/ownership';

/**
 * Tabla-fixture propiedad de un usuario, para ejercitar el patrón de aislamiento
 * (RN-01, CA-6). No es una entidad de dominio de esta spec: solo demuestra que el
 * ancla `userId` + los helpers de ownership impiden ver datos de otro usuario.
 */
const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  body: text('body').notNull(),
});

async function makeDbWithNotes() {
  const client = new PGlite();
  await client.exec(`
    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      password_changed_at timestamptz NOT NULL DEFAULT now(), -- época de credencial (ADR-016)
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      body text NOT NULL
    );
  `);
  return drizzle(client, { schema: { users, notes } });
}

let db: Awaited<ReturnType<typeof makeDbWithNotes>>;
let userA: string;
let userB: string;
let noteOfA: string;

beforeEach(async () => {
  db = await makeDbWithNotes();
  userA = (await registerUser(db as any, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db as any, 'b@example.com', 'clave')).id;
  const [n] = await db.insert(notes).values({ userId: userA, body: 'secreto de A' }).returning();
  noteOfA = n.id;
});

describe('aislamiento de datos por usuario (CA-6, RN-01)', () => {
  it('CA-6: al listar como B no aparece ningún recurso de A', async () => {
    const visibleForB = await listForOwner(db as any, notes, userB);
    expect(visibleForB).toHaveLength(0);
  });

  it('CA-6: el dueño A sí ve su propio recurso', async () => {
    const visibleForA = await listForOwner(db as any, notes, userA);
    expect(visibleForA).toHaveLength(1);
    expect(visibleForA[0].body).toBe('secreto de A');
  });

  it('CA-6: pedir por id un recurso de A siendo B devuelve null (no encontrado)', async () => {
    const asB = await findByIdForOwner(db as any, notes, noteOfA, userB);
    expect(asB).toBeNull();
  });

  it('CA-6: pedir por id el propio recurso siendo A lo devuelve', async () => {
    const asA = await findByIdForOwner(db as any, notes, noteOfA, userA);
    expect(asA).not.toBeNull();
    expect(asA.body).toBe('secreto de A');
  });
});
