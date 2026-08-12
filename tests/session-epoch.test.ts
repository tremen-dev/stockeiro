import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser, verifyCredentials } from '@/lib/auth/users';
import { requireSession, LOGIN_PATH } from '@/lib/auth/guard';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';
import { requestPasswordReset, resetPasswordWithToken } from '@/lib/auth/password-reset';
import { isSessionEpochCurrent, toEpochClaim } from '@/lib/auth/session-epoch';
import { resolveSessionWithEpoch } from '@/lib/auth/session-boundary';

const BASE = 'https://stockeiro.app';
const EMAIL = 'ana@example.com';
const OLD_PWD = 'clave-vieja-123';
const NEW_PWD = 'clave-nueva-456';

/**
 * CA-13 / CA-14 — invalidación de sesiones previas por época de credencial (ADR-016).
 * Dos de los tres niveles que pide CA-13: la función PURA de comparación (unidad) y
 * la frontera de sesión de Node (integración). El tercero (dos contextos de navegador)
 * vive en tests/e2e/recuperacion.spec.ts.
 */

describe('CA-13 (unidad): comparación de época de credencial', () => {
  const epoch = new Date('2026-08-12T10:00:00.000Z');

  it('la sesión sigue vigente si el token trae la misma época que la base', () => {
    expect(isSessionEpochCurrent(toEpochClaim(epoch), epoch)).toBe(true);
  });

  it('deja de estar vigente en cuanto la época de la base avanza', () => {
    const despues = new Date(epoch.getTime() + 1);
    expect(isSessionEpochCurrent(toEpochClaim(epoch), despues)).toBe(false);
  });

  it('ADR-016 pto. 6: un token SIN el dato se considera caducado, no válido por defecto', () => {
    expect(isSessionEpochCurrent(undefined, epoch)).toBe(false);
    expect(isSessionEpochCurrent(null, epoch)).toBe(false);
    expect(isSessionEpochCurrent('2026-08-12T10:00:00.000Z', epoch)).toBe(false);
    expect(isSessionEpochCurrent(Number.NaN, epoch)).toBe(false);
  });

  it('sin época en la base (usuario inexistente) tampoco autentica', () => {
    expect(isSessionEpochCurrent(toEpochClaim(epoch), null)).toBe(false);
    expect(isSessionEpochCurrent(toEpochClaim(epoch), undefined)).toBe(false);
  });
});

describe('CA-13 / CA-14 (integración): frontera de sesión de Node', () => {
  let db: TestDb;
  let sender: FakeNotificationSender;

  beforeEach(async () => {
    ({ db } = await makeTestDb());
    sender = new FakeNotificationSender();
  });

  /** Emula el login: el JWT estampa la época que el usuario tenía al autenticarse. */
  async function loginToken(email: string, password: string) {
    const user = await verifyCredentials(db, email, password);
    return { id: user.id, credentialEpoch: toEpochClaim(user.passwordChangedAt) };
  }

  const sessionOf = (email: string) => ({ user: { id: 'pendiente', email }, expires: 'x' });

  async function resetVia(email: string, nueva: string) {
    const { delivery } = await requestPasswordReset(db, sender, email, { baseUrl: BASE });
    await delivery;
    const token = sender.sent[sender.sent.length - 1].body.match(
      /\/reset-password\/([A-Za-z0-9_-]+)/,
    )![1];
    const res = await resetPasswordWithToken(db, token, nueva);
    expect(res.ok).toBe(true);
  }

  it('antes del reset, la sesión abierta resuelve autenticada', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const token = await loginToken(EMAIL, OLD_PWD);

    const resolved = await resolveSessionWithEpoch(db, sessionOf(EMAIL), token);
    expect(resolved.user?.id).toBe(token.id);
    expect(requireSession(resolved.user?.id ? { userId: resolved.user.id } : null).ok).toBe(true);
  });

  it('CA-13: tras el reset, la sesión previa ya NO autentica y acaba en login', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const previa = await loginToken(EMAIL, OLD_PWD); // sesión abierta en otro navegador

    await resetVia(EMAIL, NEW_PWD);

    const resolved = await resolveSessionWithEpoch(db, sessionOf(EMAIL), previa);
    expect(resolved.user).toBeUndefined(); // no se resuelve como autenticada

    const guard = requireSession(resolved.user?.id ? { userId: resolved.user.id } : null);
    expect(guard.ok).toBe(false);
    if (!guard.ok) expect(guard.redirectTo).toBe(LOGIN_PATH);
  });

  it('CA-13: la revocación es del usuario que cambió la contraseña, no de todos', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    await registerUser(db, 'bea@example.com', OLD_PWD);
    const otra = await loginToken('bea@example.com', OLD_PWD);

    await resetVia(EMAIL, NEW_PWD);

    const resolved = await resolveSessionWithEpoch(db, sessionOf('bea@example.com'), otra);
    expect(resolved.user?.id).toBe(otra.id);
  });

  it('CA-14: la sesión NUEVA, iniciada con la contraseña nueva, sí vale', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    await resetVia(EMAIL, NEW_PWD);

    const nueva = await loginToken(EMAIL, NEW_PWD);
    const resolved = await resolveSessionWithEpoch(db, sessionOf(EMAIL), nueva);
    expect(resolved.user?.id).toBe(nueva.id);
  });

  it('ADR-016 pto. 6: un JWT sin época (emitido antes del despliegue) deja de autenticar', async () => {
    const user = await registerUser(db, EMAIL, OLD_PWD);

    const resolved = await resolveSessionWithEpoch(db, sessionOf(EMAIL), { id: user.id });
    expect(resolved.user).toBeUndefined();
  });

  it('ADR-016 pto. 5: la época se compara contra la base, no se recalcula al rotar', async () => {
    await registerUser(db, EMAIL, OLD_PWD);
    const previa = await loginToken(EMAIL, OLD_PWD);
    await resetVia(EMAIL, NEW_PWD);

    // Una rotación del JWT copia el claim tal cual; si se "curara" solo, el token
    // del intruso volvería a valer. Copiarlo y volver a resolver debe seguir fallando.
    const rotado = { ...previa };
    const resolved = await resolveSessionWithEpoch(db, sessionOf(EMAIL), rotado);
    expect(resolved.user).toBeUndefined();
  });
});
