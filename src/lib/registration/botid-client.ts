import { REGISTER_PATH, RESEND_ACTIVATION_PATH } from './activation-rules';
import { isVercelDeployment } from './despliegue';

/**
 * SPEC-066 CA-5 — la mitad CLIENTE de BotID (ADR-042 ptos. 16 y 17).
 *
 * Protege EXACTAMENTE dos POST: el alta y el reenvío del correo de activación, los dos
 * que hacen salir correo hacia una dirección que teclea un desconocido. Las server
 * actions viajan por `fetch` al path de su página, que es lo que BotID parchea.
 * `checkLevel: 'basic'` también aquí, para que un clic en el panel no cambie el coste.
 */
export const BOTID_PROTECTED_ROUTES = [
  { path: REGISTER_PATH, method: 'POST', advancedOptions: { checkLevel: 'basic' as const } },
  { path: RESEND_ACTIVATION_PATH, method: 'POST', advancedOptions: { checkLevel: 'basic' as const } },
];

export type BotIdInit = (options: { protect: typeof BOTID_PROTECTED_ROUTES }) => void;

/**
 * Inicializa el cliente de BotID SÓLO en un despliegue de Vercel (pto. 17): fuera de él
 * no se inicializa y, por tanto, no se carga ningún recurso de BotID. Devuelve si lo ha
 * hecho, para que el test lo observe sin navegador.
 */
export function startBotIdClient(environment: string | null | undefined, init: BotIdInit): boolean {
  if (!isVercelDeployment(environment)) return false;
  init({ protect: BOTID_PROTECTED_ROUTES });
  return true;
}
