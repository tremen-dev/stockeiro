import { describe, it, expect } from 'vitest';
import { requireSession, isPublicPath, LOGIN_PATH } from '@/lib/auth/guard';

describe('requireSession (CA-5 / CA-7, RN-03)', () => {
  it('CA-5: sin sesión -> redirige a login', () => {
    const r = requireSession(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.redirectTo).toBe(LOGIN_PATH);
  });

  it('con sesión válida -> continúa y expone el userId', () => {
    const r = requireSession({ userId: 'u-123' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.userId).toBe('u-123');
  });

  it('CA-7: tras cerrar sesión (sesión efectiva null) vuelve a exigir login', () => {
    // signOut deja la petición sin sesión; el guard debe volver a denegar.
    const afterLogout = requireSession(undefined);
    expect(afterLogout.ok).toBe(false);
    if (!afterLogout.ok) expect(afterLogout.redirectTo).toBe(LOGIN_PATH);
  });
});

describe('isPublicPath (RN-03)', () => {
  it('login y register son públicas', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/register')).toBe(true);
    expect(isPublicPath('/')).toBe(true);
  });

  it('las rutas de aplicación no son públicas', () => {
    expect(isPublicPath('/dashboard')).toBe(false);
    expect(isPublicPath('/dashboard/cartera')).toBe(false);
  });
});
