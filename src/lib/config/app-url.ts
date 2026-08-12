/**
 * Origen absoluto de la app (SPEC-023 CA-4, ADR-015 pto. 8).
 *
 * Los enlaces que salen por correo se componen SIEMPRE desde configuración de
 * despliegue y NUNCA desde la cabecera `Host` / `X-Forwarded-Host` de la petición:
 * con `AUTH_TRUST_HOST=true` (obligatorio tras el proxy de Vercel), un atacante
 * podría pedir el reset de una cuenta ajena con un Host falsificado y lograr que
 * NUESTRO correo, legítimo y firmado, llevase a la víctima a su servidor.
 *
 * Falla ruidosamente si falta: preferimos un error visible a un enlace que apunta
 * a donde diga quien pregunta (F-SPEC-023-3).
 */
export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.APP_BASE_URL?.trim();
  if (!raw) {
    throw new Error('APP_BASE_URL no definida (ver .env.example): sin ella no hay enlaces válidos.');
  }
  return raw.replace(/\/+$/, '');
}

/** URL absoluta de la página de contraseña nueva (el token viaja en el path, ADR-015 pto. 9). */
export function buildResetUrl(baseUrl: string, token: string): string {
  return new URL(`/reset-password/${encodeURIComponent(token)}`, `${baseUrl}/`).toString();
}
