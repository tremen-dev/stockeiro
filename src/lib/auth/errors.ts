/**
 * Error de registro con email ya existente (RN-02, CA-2). Mensaje claro:
 * el email SÍ es un dato que el propio usuario conoce al registrarse.
 */
export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Ese email ya está registrado.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

/**
 * Error de credenciales inválidas (CA-4). Mensaje GENÉRICO y único tanto si el
 * email no existe como si la contraseña es incorrecta: no se revela cuál de los
 * dos falló (decisión de seguridad del gate humano, SPEC-001).
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Email o contraseña incorrectos.');
    this.name = 'InvalidCredentialsError';
  }
}
