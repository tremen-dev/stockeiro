import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-031 CA-2, mitad estática — de DÓNDE sale la identidad.
 *
 * La mitad dinámica (nadie la relee por petición) vive en
 * `tests/version-endpoint.test.ts`. Aquí se prueba el canal: los tres valores se
 * declaran bajo `env` en `next.config.mjs` —Next los sustituye por literales en
 * tiempo de compilación—, derivan de las variables de Vercel, y ningún módulo
 * servido en runtime lee `VERCEL_GIT_*` directamente.
 *
 * Se EVALÚA el config, no se le pasa un regex: un regex sobre `next.config.mjs`
 * casa con lo que haya en un comentario y no distingue un valor derivado de una
 * constante escrita a mano (patrón de `tests/ci-workflow.test.ts`, SPEC-027).
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(rootDir, 'src');

const BUILD_CHANNEL = ['STOCKEIRO_BUILT_AT', 'STOCKEIRO_COMMIT', 'STOCKEIRO_ENVIRONMENT'];
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

type NextConfigModule = { default: { env?: Record<string, string> } };

let snapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  snapshot = { ...process.env };
});

afterEach(() => {
  process.env = { ...snapshot };
});

/** Re-evalúa `next.config.mjs` con el entorno actual, como haría un build. */
async function loadConfig(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
  const mod = (await import('../next.config.mjs')) as unknown as NextConfigModule;
  return mod.default;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

describe('SPEC-031 CA-2: el canal de tiempo de build', () => {
  it('next.config.mjs declara bajo `env` exactamente las tres claves de la identidad', async () => {
    const config = await loadConfig({
      VERCEL_GIT_COMMIT_SHA: SHA,
      VERCEL_ENV: 'production',
    });
    expect(Object.keys(config.env ?? {}).sort()).toEqual(BUILD_CHANNEL);
  });

  it('el commit deriva de VERCEL_GIT_COMMIT_SHA', async () => {
    const config = await loadConfig({ VERCEL_GIT_COMMIT_SHA: SHA, VERCEL_ENV: 'production' });
    expect(config.env!.STOCKEIRO_COMMIT).toBe(SHA);

    const otro = await loadConfig({ VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) });
    expect(otro.env!.STOCKEIRO_COMMIT).toBe('b'.repeat(40));
  });

  it('el entorno deriva de VERCEL_ENV', async () => {
    for (const value of ['production', 'preview', 'development']) {
      const config = await loadConfig({ VERCEL_GIT_COMMIT_SHA: SHA, VERCEL_ENV: value });
      expect(config.env!.STOCKEIRO_ENVIRONMENT).toBe(value);
    }
  });

  it('el instante del build lo pone el build, no el entorno', async () => {
    const antes = Date.now();
    const config = await loadConfig({ VERCEL_GIT_COMMIT_SHA: SHA, VERCEL_ENV: 'production' });
    const builtAt = Date.parse(config.env!.STOCKEIRO_BUILT_AT);

    expect(Number.isNaN(builtAt)).toBe(false);
    expect(builtAt).toBeGreaterThanOrEqual(antes - 1000);
    expect(builtAt).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('los tres valores son cadenas: `env` de Next no admite otra cosa', async () => {
    const config = await loadConfig({ VERCEL_GIT_COMMIT_SHA: SHA, VERCEL_ENV: 'preview' });
    for (const key of BUILD_CHANNEL) expect(typeof config.env![key]).toBe('string');
  });

  it('con VERCEL_GIT_COMMIT_SHA vacía —el caso real de hoy— el canal no inventa un sha', async () => {
    const config = await loadConfig({ VERCEL_GIT_COMMIT_SHA: '', VERCEL_ENV: 'production' });
    // O bien cae al git local (CA-4), o bien queda vacío; lo que NO puede es
    // devolver la cadena vacía disfrazada de identidad válida.
    expect(config.env!.STOCKEIRO_COMMIT).not.toBe(' ');
    expect(config.env!.STOCKEIRO_COMMIT === '' || /^[0-9a-f]{7,40}$/.test(config.env!.STOCKEIRO_COMMIT)).toBe(true);
  });
});

describe('SPEC-031 CA-2: nadie lee las variables de Vercel en runtime', () => {
  it('ningún fichero bajo src/ menciona VERCEL_GIT_', () => {
    const offenders = filesUnder(srcDir)
      .filter((file) => readFileSync(file, 'utf8').includes('VERCEL_GIT_'))
      .map((file) => relative(rootDir, file).replace(/\\/g, '/'));

    expect(
      offenders,
      'Leer VERCEL_GIT_* desde un módulo servido en runtime rompe el congelado: ' +
        'el valor podría cambiar sin reconstruir, y entonces la comprobación miente ' +
        '(ADR-018 D-6). El único sitio donde ese nombre puede aparecer es next.config.mjs.',
    ).toEqual([]);
  });

  it('el módulo de identidad solo lee el canal de build STOCKEIRO_*', () => {
    const source = readFileSync(join(srcDir, 'lib', 'version', 'identity.ts'), 'utf8');
    const read = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);

    expect(read.length).toBeGreaterThan(0);
    expect([...new Set(read)].sort()).toEqual(BUILD_CHANNEL);
  });
});
