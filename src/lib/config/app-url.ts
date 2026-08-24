/**
 * Origen absoluto de la app (SPEC-023 CA-4, ADR-015 pto. 8).
 *
 * Los enlaces que salen por correo se componen SIEMPRE desde configuración de
 * despliegue y NUNCA desde la cabecera `Host` / `X-Forwarded-Host` de la petición:
 * con `AUTH_TRUST_HOST=true` (obligatorio tras el proxy de Vercel), un atacante
 * podría pedir el reset de una cuenta ajena con un Host falsificado y lograr que
 * NUESTRO correo, legítimo y firmado, llevase a la víctima a su servidor.
 *
 * **Lanza si falta o si el valor no es un origen absoluto `http`/`https`** (SPEC-055).
 * Hasta el 2026-08-24 sólo comprobaba la presencia, y esa es media guardia: con
 * `APP_BASE_URL="[SENSITIVE]"` —el marcador que `vercel env pull` escribe en
 * `.env.production.local` cuando la variable está marcada como *Sensitive* en Vercel— el
 * valor es una cadena no vacía, atravesaba la función y estallaba río abajo. En dos
 * sitios y de dos maneras distintas:
 *
 * - en `metadataBase` (`src/app/layout.tsx`), durante el build, como un `Invalid URL`
 *   que no nombraba ni la clave ni el fichero;
 * - y en el enlace de recuperación, **después** de las dos salidas tempranas de
 *   `src/lib/auth/password-reset.ts` — o sea, sólo para las cuentas que existen. Eso
 *   convertía el par 200/500 en un oráculo de enumeración y quemaba el enlace vivo del
 *   usuario legítimo, reabriendo por la puerta de atrás lo que SPEC-023 CA-1/CA-12 cerró
 *   por diseño. El arreglo es que el valor envenenado ya no llega hasta allí; por eso
 *   `password-reset.ts` no cambia una línea (SPEC-055 CA-8).
 *
 * Que `new URL()` no lance NO basta como listón, y está medido: `ftp://x.com` y
 * `file:///etc/passwd` parsean y llegan vivos hasta el correo, y un valor con ruta
 * significa dos cosas distintas según quién lo lea —`metadataBase` la conserva y el
 * enlace del correo la tira—. De ahí las cuatro condiciones de `appBaseUrl()`.
 *
 * Preferimos un error visible a un enlace que apunta a donde diga quien pregunta
 * (F-SPEC-023-3), y un error visible **con sujeto** a un `Invalid URL` mudo (SPEC-016 y
 * SPEC-043 son la misma doctrina: decir el motivo es requisito, no aseo).
 */

/**
 * El valor entra recortado en el mensaje. `APP_BASE_URL` es un origen público y no un
 * secreto —por eso se puede echar al log entero—, así que el recorte es por legibilidad:
 * un valor de trescientos caracteres esconde el resto del diagnóstico en vez de ayudar.
 */
const MAX_VALOR_EN_MENSAJE = 120;

/** El marcador que deja `vercel env pull`. Se reconoce para dar una pista, nunca para decidir. */
const MARCADOR_DE_VERCEL = '[SENSITIVE]';

/** Delimitado para que se vean los espacios y las comillas que trae el valor. */
function delimitar(valor: string): string {
  const recorte =
    valor.length > MAX_VALOR_EN_MENSAJE ? `${valor.slice(0, MAX_VALOR_EN_MENSAJE)}…` : valor;
  return `«${recorte}»`;
}

/**
 * El rechazo, con las cuatro cosas que quien construye necesita: la clave culpable, el
 * valor recibido, la forma esperada con ejemplo y dónde mirar.
 *
 * La pista de `[SENSITIVE]` es **aditiva**: se añade encima del rechazo genérico y no es
 * la condición que decide. Si mañana Vercel escribe `[REDACTED]` o cualquier otra cosa,
 * el valor se sigue rechazando y sólo se pierde la pista (SPEC-055 D-5, CA-7). Es la
 * lección de `F-SPEC-048-2`: un literal reconocido, cero listas cerradas.
 */
function rechazar(valor: string, motivo: string): never {
  const partes = [
    `APP_BASE_URL no es un origen absoluto usable: ${delimitar(valor)} — ${motivo}.`,
    'Se espera un origen `http` o `https` sin ruta, query, fragmento ni credenciales; ' +
      'por ejemplo http://localhost:3200 o https://stockeiro.tremen.dev.',
    'Dónde mirar: en un build de producción `.env.production.local` manda sobre `.env`, ' +
      'así que el valor puede venir de ahí aunque `.env` ni siquiera declare la clave.',
  ];
  if (valor === MARCADOR_DE_VERCEL) {
    partes.push(
      `Pista: «${MARCADOR_DE_VERCEL}» es lo que escribe \`vercel env pull\` cuando la ` +
        'variable está marcada como Sensitive en Vercel: la CLI no revela el valor y deja ' +
        'ese marcador en `.env.production.local`. Escribe ahí el origen real, o desmarca ' +
        'la variable en Vercel.',
    );
  }
  throw new Error(partes.join(' '));
}

export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.APP_BASE_URL?.trim();
  if (!raw) {
    // El literal de este mensaje y la firma de esta función son CONTRATO con SPEC-052
    // CA-14, que los congela en `tests/entornos-de-despliegue.test.ts`. No se cambian sin
    // avisar a esa spec (SPEC-055 CA-1).
    throw new Error('APP_BASE_URL no definida (ver .env.example): sin ella no hay enlaces válidos.');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    rechazar(raw, 'no es una URL absoluta, `new URL()` la rechaza');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    // `ftp:` y `file:` parsean y llegarían vivos hasta el enlace del correo; que un valor
    // parsee no lo hace usable como origen.
    rechazar(raw, `el protocolo recibido es \`${url.protocol}\` y sólo valen \`http:\` y \`https:\``);
  }
  if (url.username !== '' || url.password !== '') {
    rechazar(raw, 'lleva credenciales, y viajarían dentro de cada enlace que enviemos');
  }
  if (url.search !== '') {
    rechazar(raw, 'lleva query (`?…`), y un origen no la lleva');
  }
  if (url.hash !== '') {
    rechazar(raw, 'lleva fragmento (`#…`), y un origen no lo lleva');
  }
  if (!/^\/+$/.test(url.pathname)) {
    // La barra final se tolera —se recorta abajo, como siempre—; un segmento de ruta no.
    // Motivo medido y no estético: `metadataBase` conservaría la ruta y `buildResetUrl` la
    // tiraría, así que el mismo valor significaría dos cosas según quién lo lea.
    //
    // El texto del rechazo nombra a los dos consumidores por lo que son y NO por el
    // identificador de uno de ellos: `tests/tarjeta-frontera.test.ts` (SPEC-051 CA-1)
    // cuenta los ficheros de `src/` cuyo CÓDIGO menciona ese identificador y exige que
    // sea exactamente uno, el layout raíz. Un literal dentro de un mensaje de error
    // cuenta como código para esa guardia, y pondría RED a una spec ya cerrada.
    rechazar(
      raw,
      `lleva ruta (\`${url.pathname}\`): la tarjeta de enlace la conservaría y el enlace ` +
        'de recuperación la perdería, así que el mismo valor significaría dos cosas',
    );
  }

  return raw.replace(/\/+$/, '');
}

/** URL absoluta de la página de contraseña nueva (el token viaja en el path, ADR-015 pto. 9). */
export function buildResetUrl(baseUrl: string, token: string): string {
  return new URL(`/reset-password/${encodeURIComponent(token)}`, `${baseUrl}/`).toString();
}
