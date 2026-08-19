/**
 * Las dos rutas de SPEC-036, en un módulo SIN imports.
 *
 * Vive aparte de `deletion.ts` a propósito: ese módulo importa el esquema y bcrypt
 * (a través de `verifyCredentials`), y la página de confirmación del borrado es
 * PÚBLICA — tiene que poder pintarse sin base de datos, igual que las de `/legal`
 * (SPEC-035 CA-14). Un módulo de constantes que no importa nada puede leerlo
 * cualquiera de los dos lados sin arrastrar consigo media aplicación.
 *
 * Y por lo mismo lo puede leer un test junto a `isPublicPath`, que es lo que ata la
 * ruta declarada a la ruta que de verdad se decide (`tests/cuenta-rutas.test.ts`).
 */

/** La pantalla de cuenta (CA-1). Autenticada: es una pantalla de datos (RN-03). */
export const CUENTA_PATH = '/cuenta';

/**
 * Donde aterriza quien acaba de borrarse (CA-10). PÚBLICA, y no puede no serlo:
 * su usuario ya no existe, así que una página autenticada le daría un rebote a
 * `/login` en vez de la confirmación de que se ha ido.
 */
export const CUENTA_BORRADA_PATH = '/cuenta-borrada';
