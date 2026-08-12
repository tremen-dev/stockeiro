import { describe, it, expect } from 'vitest';
import { requireSession, isPublicPath, PUBLIC_PREFIXES, LOGIN_PATH } from '@/lib/auth/guard';

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

/**
 * SPEC-023 CA-15 (CE-5, RN-03): la excepción a "todo exige sesión" se DECLARA en un
 * único sitio y se prueba; no se hereda por descuido ni se cuela por parecido.
 */
describe('CA-15: rutas públicas de recuperación, declaradas y acotadas', () => {
  it('la recuperación y la página de contraseña nueva son públicas sin sesión', () => {
    expect(isPublicPath('/forgot-password')).toBe(true);
    expect(isPublicPath('/reset-password/abc123_-XYZ')).toBe(true);
  });

  it('se declaran en PUBLIC_PREFIXES, el único sitio donde viven las rutas públicas', () => {
    expect(PUBLIC_PREFIXES).toContain('/forgot-password');
    expect(PUBLIC_PREFIXES).toContain('/reset-password');
  });

  it('una ruta que solo SE PARECE a las nuevas no es pública', () => {
    expect(isPublicPath('/reset-passwordX')).toBe(false);
    expect(isPublicPath('/forgot-passwordX')).toBe(false);
    expect(isPublicPath('/reset-password-admin')).toBe(false);
  });

  it('las rutas de datos siguen exigiendo sesión', () => {
    for (const p of ['/dashboard', '/cartera', '/vigiladas', '/avisos', '/cartera/importar']) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});
