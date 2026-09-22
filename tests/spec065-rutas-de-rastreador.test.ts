import { describe, it, expect } from 'vitest';
import { isCrawlerPath, isPublicPath, CRAWLER_PATHS, PUBLIC_PREFIXES } from '@/lib/auth/guard';

/**
 * SPEC-065 CA-7 — `robots.txt` y `sitemap.xml` salen del proxy por una lista propia, de
 * emparejamiento EXACTO (D-5), declarada en `src/lib/auth/guard.ts` junto a la de páginas.
 *
 * El `matcher` de `src/proxy.ts` y `PUBLIC_PREFIXES` no se tocan: las guardias que
 * congelan el primero siguen siendo suyas, y RN-03 no se ensancha a ninguna página.
 */

describe('SPEC-065 CA-7: la excepción de rastreador es exacta, no un prefijo', () => {
  it.each(['/robots.txt', '/sitemap.xml'])('es cierta para %s', (ruta) => {
    expect(isCrawlerPath(ruta)).toBe(true);
  });

  it.each(['/robots.txtx', '/sitemap.xml/x', '/sitemap.xmlx', '/robots', '/sitemap', '/'])(
    'es falsa para %s',
    (ruta) => {
      expect(isCrawlerPath(ruta)).toBe(false);
    },
  );

  it('las dos rutas NO entran por la lista de páginas: RN-03 no se ensancha', () => {
    for (const ruta of CRAWLER_PATHS) {
      expect(isPublicPath(ruta), `${ruta} no es una página pública`).toBe(false);
      expect(PUBLIC_PREFIXES).not.toContain(ruta);
    }
  });

  it('isPublicPath responde lo mismo que antes para públicas y privadas', () => {
    for (const publica of ['/', '/login', '/register', '/ayuda', '/legal/aviso-legal']) {
      expect(isPublicPath(publica), publica).toBe(true);
    }
    for (const privada of ['/dashboard', '/cuenta', '/cartera', '/admin', '/vigiladas']) {
      expect(isPublicPath(privada), privada).toBe(false);
    }
  });
});
