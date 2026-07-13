import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/passwords';

describe('passwords', () => {
  it('hashea y verifica correctamente (nunca guarda la contraseña en claro)', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toContain('correct horse');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('s3cret');
    expect(await verifyPassword('otra', hash)).toBe(false);
  });
});
