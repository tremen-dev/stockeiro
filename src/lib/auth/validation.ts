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
