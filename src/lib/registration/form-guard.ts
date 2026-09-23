import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { MIN_FORM_FILL_MS } from './activation-rules';

/**
 * SPEC-066 capa 1 (ADR-042 ptos. 14 y 15): el campo trampa y el tiempo mínimo.
 *
 * Los dos son filtros BARATOS —ni red ni base— y por eso van antes que BotID (pto. 12).
 * Ninguno le dice al automatismo qué le delató: quien llama responde lo mismo que a un
 * alta legítima (pto. 13).
 */

/**
 * ¿El campo trampa delata un automatismo? Cualquier valor NO VACÍO lo delata, también
 * un espacio: un humano no ve el campo, así que no puede haber tecleado nada en él.
 * Ausente o cadena vacía = no delata.
 */
export function caughtByHoneypot(value: FormDataEntryValue | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return true; // un fichero en un campo de texto: no es un humano
  return value.length > 0;
}

/**
 * La subclave del sello. Se DERIVA de `AUTH_SECRET` con HKDF y una etiqueta propia, así
 * que ni el sello ni la clave con que se firma contienen el secreto ni permiten
 * recuperarlo, y la misma clave no sirve para firmar nada más (ADR-042 pto. 15).
 */
const ETIQUETA = 'stockeiro/registro/sello-de-pintado/v1';

function subclave(secret: string): Buffer {
  if (!secret) throw new Error('AUTH_SECRET no definida: sin ella no se puede sellar el alta.');
  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), ETIQUETA, 32));
}

function firma(instante: string, secret: string): string {
  return createHmac('sha256', subclave(secret)).update(instante, 'utf8').digest('base64url');
}

/**
 * El sello del instante en que el SERVIDOR pinta el formulario: `<ms>.<hmac>`. Va en un
 * campo oculto y vuelve con el envío.
 */
export function sealFormRender(nowMs: number, secret: string): string {
  const instante = String(Math.trunc(nowMs));
  return `${instante}.${firma(instante, secret)}`;
}

/**
 * ¿El sello es NUESTRO y tiene al menos el tiempo mínimo? Falta, forma rara, firma que no
 * cuadra (manipulado o firmado con otra clave) o menos de `MIN_FORM_FILL_MS` = automatismo.
 *
 * `nowMs` es el reloj del SERVIDOR al recibir el envío: el cliente no aporta ninguna
 * hora, así que adelantar su reloj no cambia nada. Sin cota superior (pto. 15).
 */
export function isSealOldEnough(
  seal: FormDataEntryValue | null | undefined,
  nowMs: number,
  secret: string,
): boolean {
  if (typeof seal !== 'string') return false;
  const m = /^(\d{1,16})\.([A-Za-z0-9_-]{43})$/.exec(seal);
  if (!m) return false;
  const [, instante, recibida] = m;

  const esperada = Buffer.from(firma(instante, secret), 'utf8');
  const llegada = Buffer.from(recibida, 'utf8');
  if (esperada.length !== llegada.length || !timingSafeEqual(esperada, llegada)) return false;

  return nowMs - Number(instante) >= MIN_FORM_FILL_MS;
}
