import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser, verifyCredentials } from '@/lib/auth/users';
import { InvalidCredentialsError } from '@/lib/auth/errors';

let db: TestDb;
beforeEach(async () => {
  ({ db } = await makeTestDb());
  await registerUser(db, 'user@example.com', 'la-clave-correcta');
});

describe('verifyCredentials (CA-3 / CA-4)', () => {
  it('CA-3: credenciales válidas devuelven la identidad del usuario', async () => {
    const user = await verifyCredentials(db, 'user@example.com', 'la-clave-correcta');
    expect(user.email).toBe('user@example.com');
    expect(user.id).toBeTruthy();
  });

  it('CA-3: acepta el email con distinto casing/espacios', async () => {
    const user = await verifyCredentials(db, ' User@Example.com ', 'la-clave-correcta');
    expect(user.email).toBe('user@example.com');
  });

  it('CA-4: contraseña incorrecta -> InvalidCredentialsError', async () => {
    await expect(
      verifyCredentials(db, 'user@example.com', 'clave-mala'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('CA-4: email inexistente -> InvalidCredentialsError (mismo error genérico)', async () => {
    await expect(
      verifyCredentials(db, 'noexiste@example.com', 'lo-que-sea'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('CA-4: el mensaje NO revela si el email existe (idéntico en ambos fallos)', async () => {
    const msgBadPassword = await verifyCredentials(db, 'user@example.com', 'x')
      .then(() => null)
      .catch((e) => e.message);
    const msgNoUser = await verifyCredentials(db, 'noexiste@example.com', 'x')
      .then(() => null)
      .catch((e) => e.message);
    expect(msgBadPassword).toBe(msgNoUser);
  });
});
