import { checkBotId } from 'botid/server';
import { deploymentIdentity } from '@/lib/version/identity';
import { isVercelDeployment } from './despliegue';

/**
 * SPEC-066 D-5 — el PUERTO de BotID (capa 2, ADR-042 ptos. 16 a 18).
 *
 * Es el ÚNICO módulo que importa `botid/server`. Devuelve un veredicto del dominio
 * (`humano | automatismo`), no la respuesta de la librería, y lo recibe inyectado quien
 * decide (`./signup-flow.ts`): por ahí simulan bot los unitarios, sin parchear la librería.
 */

export type BotVerdict = 'humano' | 'automatismo';

/** El puerto: una pregunta sin argumentos sobre la petición en curso. Puede LANZAR. */
export type BotCheck = () => Promise<BotVerdict>;

/** Lo mínimo que este módulo lee de la respuesta de `checkBotId`. */
export type BotIdResult = { isHuman: boolean; isBot: boolean; isVerifiedBot: boolean };

export type CheckBotIdOptions = {
  developmentOptions: { isDevelopment: boolean };
  advancedOptions: { checkLevel: 'basic' };
};

/**
 * Las opciones con que se llama a `checkBotId` (CA-5).
 *
 * - **Siempre `checkLevel: 'basic'`** (pto. 16): fijado en el código para que un clic en
 *   el panel no cambie el coste. Deep Analysis no existe en Hobby y se cobra por llamada.
 * - **`isDevelopment` siempre explícito**: en Vercel, `false` (comprobación real); fuera,
 *   `true` —la vía de desarrollo de la propia librería, que responde humano sin salir a
 *   la red ni pedir OIDC (pto. 17)—. Explícito para que la librería no caiga en su
 *   defecto, que lee `NODE_ENV`.
 */
export function checkBotIdOptions(onVercel: boolean): CheckBotIdOptions {
  return {
    developmentOptions: { isDevelopment: !onVercel },
    advancedOptions: { checkLevel: 'basic' },
  };
}

/**
 * Un bot VERIFICADO (un rastreador conocido) cuenta como automatismo: ninguno tiene nada
 * que hacer creando cuentas (pto. 16). Y lo que no se declare humano, tampoco lo es.
 */
export function verdictFrom(result: BotIdResult): BotVerdict {
  if (result.isBot || result.isVerifiedBot || !result.isHuman) return 'automatismo';
  return 'humano';
}

type CheckFn = (options: CheckBotIdOptions) => Promise<BotIdResult>;

/** El puerto real. `check` y `onVercel` se inyectan sólo para probar las dos mitades. */
export function makeBotCheck(
  opts: { check?: CheckFn; onVercel?: boolean } = {},
): BotCheck {
  const check: CheckFn = opts.check ?? ((o) => checkBotId(o));
  const onVercel = opts.onVercel ?? isVercelDeployment(deploymentIdentity.environment);
  return async () => verdictFrom(await check(checkBotIdOptions(onVercel)));
}

/**
 * FAIL-OPEN (ADR-042 pto. 18): si BotID lanza —red, OIDC, servicio caído— el alta sigue
 * y queda una línea en el log de error que nombra BotID. Bloquear altas humanas por la
 * caída de un tercero sería peor que dejar pasar a un bot que aún tiene delante el
 * campo trampa, el tiempo mínimo, la verificación del correo y el cupo.
 */
export async function botVerdictFailOpen(check: BotCheck): Promise<BotVerdict> {
  try {
    return await check();
  } catch (e) {
    console.error(
      '[BotID] la comprobación anti-bots ha fallado y el envío sigue su camino (fail-open, ADR-042 pto. 18):',
      e instanceof Error ? e.message : e,
    );
    return 'humano';
  }
}
