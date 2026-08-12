import { z } from 'zod';

/**
 * Validación de forma de entrada. La POLÍTICA de contraseña se delega en Auth.js
 * (gate humano, SPEC-001): aquí solo exigimos email con forma válida y contraseña
 * no vacía; no imponemos reglas de complejidad propias.
 */
export const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'Email requerido').email('Email no válido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export type Credentials = z.infer<typeof credentialsSchema>;

/**
 * Contraseña nueva del reset (SPEC-023 CA-16). NO es una regla nueva: es LA MISMA
 * de `credentialsSchema`, tomada de su propia forma, para que una contraseña que el
 * registro acepta hoy el reset la acepte también. La política sigue delegada en
 * Auth.js por resolución del gate de SPEC-001 y esta spec no la reabre.
 */
export const newPasswordSchema = credentialsSchema.shape.password;

/** Email del formulario de recuperación: misma forma que la del login (CE-2). */
export const emailSchema = credentialsSchema.shape.email;
