import { TITULAR } from '@/lib/legal/content';
import type { DeploymentIdentity } from '@/lib/version/identity';

/**
 * El canal de feedback (SPEC-039, CE-8).
 *
 * Es **un enlace, no una bandeja**. Lo decidió la épica con esas palabras y es la
 * decisión correcta para veinte testers: un formulario propio significa tabla,
 * moderación y un compromiso de respuesta que nadie ha decidido asumir. Aquí es un
 * `mailto:` y se acaba.
 *
 * Lo único que se le añade por encima es **la versión del despliegue prefijada**
 * (CA-13). El tester no tiene que saber qué es una versión para que su reporte sea
 * útil: la lleva puesta sin hacer nada. Sale de `deploymentIdentity` (SPEC-031,
 * ADR-024), que es exactamente lo que responde `/api/version` y lo que el pie
 * enseñará cuando entre SPEC-038 — las dos beben de la misma fuente, ninguna depende
 * de la otra.
 *
 * ## La dirección
 *
 * Es **la misma** que el contacto del titular de SPEC-035, y por eso se lee de allí
 * (`TITULAR.contacto`) en vez de volver a teclearla: que no se duplique es parte de
 * CA-16, y un segundo literal es la forma más barata de que un día haya dos
 * direcciones distintas publicadas y una de ellas muerta. Ese literal vive en
 * `src/lib/legal/content.ts` y en ningún otro sitio de `src/`; hay un test que lo
 * comprueba sobre este mismo fichero.
 *
 * `FEEDBACK_EMAIL` permite reapuntar el canal sin desplegar código (por ejemplo a un
 * buzón distinto del legal), y es la ÚNICA variable de entorno que añade toda
 * EPIC-004. Se valida por CONTENIDO y no por presencia, por la misma razón que
 * `resolveIdentity`: Vercel deja variables definidas y vacías, y un `??` mandaría el
 * feedback a una dirección vacía sin que nadie se enterase.
 *
 * Residual asumido y escrito (F-SPEC-039-2): publicar la dirección en abierto la
 * expone a recolectores de correo. Es el precio de un canal sin infraestructura.
 */

/** La clave de entorno que reapunta el canal. La única nueva de EPIC-004 (CA-16). */
export const FEEDBACK_ENV_KEY = 'FEEDBACK_EMAIL';

/** Cómo se llama el enlace, en el pie y en cualquier otro sitio que lo ofrezca. */
export const ETIQUETA_FEEDBACK = 'Contar algo o reportar un fallo';

/** Lo mínimo para que una cadena sea una dirección y no un descuido. */
const PARECE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * La dirección del canal AHORA. Sin argumento lee el entorno del proceso; el
 * argumento existe para poder probar los casos raros sin tocar `process.env`.
 */
export function direccionDeFeedback(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): string {
  const candidata = (env[FEEDBACK_ENV_KEY] ?? '').trim();
  return PARECE_CORREO.test(candidata) ? candidata : TITULAR.contacto;
}

/**
 * El `mailto:` que compone el mensaje, con la versión delante.
 *
 * El asunto la lleva **prefijada** —lo primero que se lee en la bandeja del
 * operador— y el cuerpo repite los tres datos de identidad en claro, porque el
 * asunto lo puede reescribir cualquiera sin darse cuenta. Entre medias queda un
 * hueco en blanco: el tester escribe y envía, sin borrar nada.
 */
export function construirMailtoDeFeedback(
  identidad: DeploymentIdentity,
  direccion: string = direccionDeFeedback(),
): string {
  const asunto = `[Stockeiro ${identidad.commit}] `;
  const cuerpo = [
    '',
    '',
    '— No borres estas líneas: dicen desde qué despliegue escribes —',
    `versión: ${identidad.commit}`,
    `entorno: ${identidad.environment}`,
    `construido: ${identidad.builtAt}`,
  ].join('\n');

  return `mailto:${direccion}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}
