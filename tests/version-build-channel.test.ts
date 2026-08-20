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

/**
 * El canal, ordenado. SPEC-038 CA-14 / ADR-024 pto. 4 lo lleva de TRES a CUATRO
 * con `STOCKEIRO_VERSION`. Lo que esta lista vigila no es el número: es que
 * ninguna clave del canal entre sin un CA que la pida, y que las que hay se
 * CALCULEN en el build en vez de configurarse (eso lo comprueba
 * `tests/spec-031-frontera.test.ts` CA-13.3).
 */
const BUILD_CHANNEL = [
  'STOCKEIRO_BUILT_AT',
  'STOCKEIRO_COMMIT',
  'STOCKEIRO_ENVIRONMENT',
  'STOCKEIRO_VERSION',
];
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

/** Extensiones de código: lo que se ejecuta, no lo que se lee. */
const CODIGO = /\.(mjs|cjs|js|jsx|ts|tsx|mts)$/;

const rutaRelativa = (file: string) => relative(rootDir, file).replace(/\\/g, '/');

/**
 * El código sin sus comentarios.
 *
 * Buscar el literal `package.json` a pelo casaría con cualquier fichero que lo
 * MENCIONE al explicarse —y varios lo hacen, precisamente para decir que NO lo
 * leen—. Lo que hay que vigilar es quién lo abre, no quién lo nombra.
 */
function sinComentarios(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const abrePackageJson = (file: string) =>
  sinComentarios(readFileSync(file, 'utf8')).includes('package.json');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

describe('SPEC-031 CA-2: el canal de tiempo de build', () => {
  it('next.config.mjs declara bajo `env` exactamente las claves de la identidad', async () => {
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

  it('los valores son cadenas: `env` de Next no admite otra cosa', async () => {
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

describe('SPEC-038 CA-6: el semver entra por el canal de BUILD', () => {
  it('el canal aporta el semver de package.json, sin que nadie lo teclee dos veces', async () => {
    const config = await loadConfig({ VERCEL_GIT_COMMIT_SHA: SHA, VERCEL_ENV: 'production' });
    const declarado = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { version: string };

    expect(config.env!.STOCKEIRO_VERSION).toBe(declarado.version);
    // Y tiene forma de semver: si el campo se corrompiera, el canal lo pasaría
    // igual (no valida nada) y `resolveIdentity` lo convertiría en `unknown`.
    expect(declarado.version).toMatch(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  });

  it('`buildIdentity` recibe el semver como PARÁMETRO: no lee ningún fichero', async () => {
    const { buildIdentity } = await import('../src/lib/version/build-identity.mjs');

    expect(buildIdentity({ version: '3.4.5' }).STOCKEIRO_VERSION).toBe('3.4.5');
    // Sin parámetro no se inventa nada: cadena vacía, y juzgar es de runtime.
    expect(buildIdentity({}).STOCKEIRO_VERSION).toBe('');
  });

  it('`next.config.mjs` es el ÚNICO sitio del canal de build que lee package.json', () => {
    // ADR-024 pto. 4. La lista es CERRADA y cada entrada lleva su motivo escrito:
    //   - `next.config.mjs` lee el campo `version` y lo inyecta en el canal;
    //   - `scripts/check-version-bump.mjs` es el gate de CI de CA-12, que por
    //     definición tiene que comparar DOS package.json (el de la rama y el de
    //     `origin/main`). No forma parte del artefacto ni del canal de build: no
    //     se empaqueta, no se importa desde `src/` y no corre en runtime.
    // Se mira donde vive el código que se construye y el que lo construye —la
    // raíz, `src/` y `scripts/`—; cualquier tercer fichero de ahí que empiece a
    // leer package.json cae en esta lista.
    const enLaRaiz = readdirSync(rootDir)
      .filter((entry) => statSync(join(rootDir, entry)).isFile())
      .map((entry) => join(rootDir, entry));

    const lectores = [...enLaRaiz, ...filesUnder(srcDir), ...filesUnder(join(rootDir, 'scripts'))]
      .filter((file) => CODIGO.test(file))
      .filter(abrePackageJson)
      .map(rutaRelativa)
      .sort();

    expect(lectores).toEqual(['next.config.mjs', 'scripts/check-version-bump.mjs']);
  });

  it('ningún módulo bajo src/ lee el fichero package.json', () => {
    // Leerlo en runtime sería E/S de disco en la ruta que debe responder cuando
    // todo lo demás falla (ADR-024 pto. 4, alternativa rechazada).
    const offenders = filesUnder(srcDir).filter(abrePackageJson).map(rutaRelativa);

    expect(offenders).toEqual([]);
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
