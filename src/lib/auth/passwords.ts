import bcrypt from 'bcryptjs';

const COST = 10;

/**
 * Hash de contraseña con bcrypt. La política de contraseña se delega en Auth.js
 * (resolución del gate humano, SPEC-001): aquí solo se persiste el hash, nunca
 * la contraseña en claro.
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
