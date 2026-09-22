import type { MetadataRoute } from 'next';
import { appBaseUrl } from '@/lib/config/app-url';
import { deploymentIdentity } from '@/lib/version/identity';

/**
 * SPEC-065 D-4 — `robots.txt`, y sólo producción deja rastrear.
 *
 * **Quién decide el entorno es la identidad del despliegue** (SPEC-038), la misma fuente
 * que pinta el entorno en el pie: horneada en build desde el canal de `next.config.mjs`.
 * No una clave nueva, ni la variable de Vercel leída aquí, ni la cabecera `Host`.
 * Cualquier valor que no sea `production` —`preview`, `development` o `unknown`, que es lo
 * que da una máquina local o el e2e— responde `Disallow: /`. En los Preview es la tercera
 * capa: Vercel ya los sirve tras su SSO y con `X-Robots-Tag: noindex` (medido el
 * 2026-09-23); si un día se quitara la protección, seguirían sin dejarse rastrear.
 *
 * **Las rutas privadas NO se listan** (D-4), y es a propósito: `robots.txt` es público y
 * listarlas sería publicar el mapa de la zona privada; una URL vetada aquí no se rastrea
 * pero puede indexarse desnuda, porque el buscador nunca llega a ver su `noindex`; y sin
 * sesión ya responden `307 → /login`, que es `noindex` por el layout raíz. `/api/` sí se
 * veta: devuelve JSON y no tiene dónde llevar un `<meta name="robots">`.
 *
 * El origen absoluto del sitemap sale de `appBaseUrl()` (ADR-015 pto. 8, SPEC-055).
 */
export default function robots(): MetadataRoute.Robots {
  if (deploymentIdentity.environment !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: new URL('/sitemap.xml', appBaseUrl()).href,
  };
}
