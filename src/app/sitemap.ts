import type { MetadataRoute } from 'next';
import { appBaseUrl } from '@/lib/config/app-url';
import { RUTAS_INDEXABLES } from '@/lib/seo/indexables';

/**
 * SPEC-065 D-1 y D-6 — el sitemap ES la lista de rutas indexables, en absoluto.
 *
 * Se deriva de `RUTAS_INDEXABLES` y de nada más: añadir una ruta a la lista la hace
 * aparecer aquí. El origen sale de `appBaseUrl()` (ADR-015 pto. 8), nunca del `Host`.
 *
 * **No inventa fechas** (D-6): sólo `<loc>`. `changefreq` y `priority` los ignora Google, y
 * un `lastmod` que no sale de un cambio real enseña al buscador a desconfiar del campo. Si
 * algún día hay una fecha verdadera, se añade con su fuente.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origen = appBaseUrl();
  return RUTAS_INDEXABLES.map((ruta) => ({ url: new URL(ruta, origen).href }));
}
