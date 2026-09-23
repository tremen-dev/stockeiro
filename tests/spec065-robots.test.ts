import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appBaseUrl } from '@/lib/config/app-url';

/**
 * SPEC-065 CA-5 — la política de `robots.txt` depende del entorno del despliegue, y sólo
 * producción deja rastrear (D-4).
 *
 * Se verifica sobre la RUTA REAL (`src/app/robots.ts`), importada con la identidad de
 * despliegue simulada, y no sobre una copia. El e2e no es producción (su identidad sale
 * `unknown`), así que la rama de producción sólo se puede probar aquí.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = 'https://stockeiro.example';

const identidad = vi.hoisted(() => ({
  deploymentIdentity: { version: '0.0.0', commit: 'unknown', environment: 'unknown', builtAt: 'unknown' },
}));
vi.mock('@/lib/version/identity', () => identidad);

async function politica(environment: string) {
  identidad.deploymentIdentity.environment = environment;
  const { default: robots } = await import('@/app/robots');
  return robots();
}

type Regla = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] };
const lista = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const reglas = (r: { rules: Regla | Regla[] }): Regla[] => (Array.isArray(r.rules) ? r.rules : [r.rules]);

beforeEach(() => {
  vi.stubEnv('APP_BASE_URL', ORIGEN);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SPEC-065 CA-5: sólo producción deja rastrear', () => {
  it('production: permite `/`, veta `/api/` y declara el sitemap absoluto', async () => {
    const r = await politica('production');
    const [regla] = reglas(r);
    expect(reglas(r)).toHaveLength(1);
    expect(regla.userAgent).toBe('*');
    expect(lista(regla.allow)).toEqual(['/']);
    expect(lista(regla.disallow)).toEqual(['/api/']);
    expect(r.sitemap).toBe(new URL('/sitemap.xml', appBaseUrl()).href);
  });

  it.each(['preview', 'development', 'unknown'])(
    '%s: veta `/` y no permite nada, ni declara sitemap',
    async (entorno) => {
      const r = await politica(entorno);
      for (const regla of reglas(r)) {
        expect(lista(regla.disallow)).toEqual(['/']);
        expect(lista(regla.allow)).toEqual([]);
      }
      expect(r.sitemap).toBeUndefined();
    },
  );

  it('la pregunta es a la identidad, no a VERCEL_ENV: con VERCEL_ENV=production y la identidad en preview, veta', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NODE_ENV', 'production');
    const r = await politica('preview');
    expect(lista(reglas(r)[0].disallow)).toEqual(['/']);
  });

  it('y al revés: con VERCEL_ENV=preview y la identidad en production, permite', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    const r = await politica('production');
    expect(lista(reglas(r)[0].allow)).toEqual(['/']);
  });

  it('el origen del sitemap sale de APP_BASE_URL, no de otra parte', async () => {
    vi.stubEnv('APP_BASE_URL', 'https://otro-origen.example');
    const r = await politica('production');
    expect(r.sitemap).toBe('https://otro-origen.example/sitemap.xml');
  });

  it('el fuente de la ruta no lee claves de entorno ni la cabecera Host', () => {
    const fuente = readFileSync(join(rootDir, 'src', 'app', 'robots.ts'), 'utf8').replace(
      /\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm,
      '',
    );
    expect(fuente).not.toMatch(/process\.env/);
    expect(fuente).not.toMatch(/next\/headers/);
  });
});
