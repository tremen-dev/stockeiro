import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { users } from '@/db/schema';
import { registerUser, getUserByEmail } from '@/lib/auth/users';
import { EmailAlreadyRegisteredError } from '@/lib/auth/errors';

let db: TestDb;
beforeEach(async () => {
  ({ db } = await makeTestDb());
});

describe('registerUser (CA-1 / CA-2, RN-02)', () => {
  it('CA-1: crea una cuenta con email válido no usado y guarda solo el hash', async () => {
    const user = await registerUser(db, 'ana@example.com', 'una-clave-cualquiera');
    expect(user.id).toBeTruthy();
    expect(user.email).toBe('ana@example.com');

    const [row] = await db.select().from(users).where(eq(users.email, 'ana@example.com'));
    expect(row.passwordHash).toBeTruthy();
    expect(row.passwordHash).not.toContain('una-clave-cualquiera');
  });

  it('CA-1: normaliza el email (trim + lowercase)', async () => {
    const user = await registerUser(db, '  ANA@Example.COM ', 'clave');
    expect(user.email).toBe('ana@example.com');
  });

  it('CA-2: rechaza email ya registrado y NO crea una segunda cuenta', async () => {
    await registerUser(db, 'bea@example.com', 'clave1');
    await expect(registerUser(db, 'bea@example.com', 'clave2')).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
    const rows = await db.select().from(users).where(eq(users.email, 'bea@example.com'));
    expect(rows).toHaveLength(1);
  });

  it('CA-2: detecta duplicado aunque cambie mayúsculas/espacios', async () => {
    await registerUser(db, 'cris@example.com', 'clave1');
    await expect(registerUser(db, ' Cris@Example.com ', 'clave2')).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
  });
});

describe('CA-8: persistencia de identidad', () => {
  it('el usuario sigue existiendo y es recuperable tras registrarse', async () => {
    const created = await registerUser(db, 'dan@example.com', 'clave');
    // Simula "otra sesión/consulta posterior": buscamos de nuevo en la misma DB.
    const found = await getUserByEmail(db, 'dan@example.com');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });
});
