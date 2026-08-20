import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIdentity, gitHeadSha } from '@/lib/version/build-identity.mjs';
import { UNKNOWN, resolveIdentity } from '@/lib/version/identity';

/**
 * SPEC-031 CA-4 — fallback a git local, y NUNCA tumba el build.
 *
 * Este módulo es el lado de *build* de la identidad: lo evalúa
 * `next.config.mjs`, no el runtime. Por eso es `.mjs` (un `.mjs` no puede
 * importar TypeScript) y por eso recibe el sha de Vercel como PARÁMETRO en vez
 * de leerlo: así el nombre `VERCEL_GIT_*` vive únicamente en `next.config.mjs` y
 * ningún módulo bajo `src/` lo menciona (CA-2, mitad estática).
 *
 * La propiedad que se prueba aquí: un build que muere porque `git` no está es
 * peor que un build que no sabe de dónde viene. `unknown` es información; un
 * build roto no lo es.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const NO_GIT = 'git-que-no-existe-en-ninguna-parte';

/** El sha real de HEAD, obtenido por una vía independiente de la implementación. */
const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: rootDir,
  encoding: 'utf8',
}).trim();

function tempDirWithoutRepo(): string {
  return mkdtempSync(join(tmpdir(), 'spec031-'));
}

describe('SPEC-031 CA-4: gitHeadSha', () => {
  it('en un repositorio usable devuelve el sha de HEAD', () => {
    // Ojo: este árbol es un git *worktree*, donde `.git` es un FICHERO y no un
    // directorio — la trampa que hace fallar a `vercel --prod` (runbook §6).
    // `git rev-parse` funciona igual, y ese es justo el caso de uso local.
    expect(gitHeadSha({ cwd: rootDir })).toBe(headSha);
  });

  it('con el ejecutable de git sustituido por uno inexistente devuelve cadena vacía, sin lanzar', () => {
    expect(() => gitHeadSha({ cwd: rootDir, gitBinary: NO_GIT })).not.toThrow();
    expect(gitHeadSha({ cwd: rootDir, gitBinary: NO_GIT })).toBe('');
  });

  it('en un directorio sin repositorio devuelve cadena vacía (git sale con código != 0)', () => {
    const dir = tempDirWithoutRepo();
    try {
      expect(gitHeadSha({ cwd: dir })).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('con el PATH recortado (git inaccesible) devuelve cadena vacía, sin lanzar', () => {
    const previous = process.env.PATH;
    process.env.PATH = '';
    try {
      expect(gitHeadSha({ cwd: rootDir, gitBinary: NO_GIT })).toBe('');
    } finally {
      process.env.PATH = previous;
    }
  });
});

describe('SPEC-031 CA-4: buildIdentity', () => {
  const now = new Date('2026-08-18T09:30:00.000Z');

  it('declara exactamente las claves del canal de build, todas cadenas', () => {
    // De TRES a CUATRO por SPEC-038 CA-14 / ADR-024 pto. 4: entra
    // `STOCKEIRO_VERSION`, la versión de producto, que llega como parámetro igual
    // que el sha. Lo que esta igualdad de conjunto vigila no cambia —ninguna clave
    // del canal entra sin un CA que la pida, y todas son cadenas porque `env` de
    // Next no admite otra cosa—; cambia el número de claves que la cumplen.
    const identity = buildIdentity({ version: '0.2.0', sha: SHA, vercelEnv: 'production', now });
    expect(Object.keys(identity).sort()).toEqual([
      'STOCKEIRO_BUILT_AT',
      'STOCKEIRO_COMMIT',
      'STOCKEIRO_ENVIRONMENT',
      'STOCKEIRO_VERSION',
    ]);
    for (const value of Object.values(identity)) expect(typeof value).toBe('string');
  });

  it('cuando Vercel aporta el sha, ese sha manda y git ni se consulta', () => {
    const identity = buildIdentity({
      sha: SHA,
      vercelEnv: 'production',
      now,
      // Directorio sin repositorio y git inexistente: si se consultara, saldría vacío.
      cwd: tempDirWithoutRepo(),
      gitBinary: NO_GIT,
    });
    expect(identity.STOCKEIRO_COMMIT).toBe(SHA);
    expect(identity.STOCKEIRO_ENVIRONMENT).toBe('production');
    expect(identity.STOCKEIRO_BUILT_AT).toBe('2026-08-18T09:30:00.000Z');
  });

  it('sin sha de Vercel (build local o CI) cae al `git rev-parse HEAD` del repositorio', () => {
    expect(buildIdentity({ sha: '', now, cwd: rootDir }).STOCKEIRO_COMMIT).toBe(headSha);
    expect(buildIdentity({ sha: undefined, now, cwd: rootDir }).STOCKEIRO_COMMIT).toBe(headSha);
    // La cadena vacía es el caso real de hoy: Vercel define la variable y la deja vacía.
    expect(buildIdentity({ sha: '   ', now, cwd: rootDir }).STOCKEIRO_COMMIT).toBe(headSha);
  });

  it('sin sha y sin git no lanza: el build sigue, y la identidad acaba en `unknown`', () => {
    const dir = tempDirWithoutRepo();
    try {
      let identity!: ReturnType<typeof buildIdentity>;
      expect(() => {
        identity = buildIdentity({ sha: '', now, cwd: dir, gitBinary: NO_GIT });
      }).not.toThrow();
      expect(
        resolveIdentity({
          commit: identity.STOCKEIRO_COMMIT,
          environment: identity.STOCKEIRO_ENVIRONMENT,
          builtAt: identity.STOCKEIRO_BUILT_AT,
        }).commit,
      ).toBe(UNKNOWN);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('el entorno se pasa crudo: juzgarlo es trabajo del runtime, no del build', () => {
    expect(buildIdentity({ sha: SHA, vercelEnv: undefined, now }).STOCKEIRO_ENVIRONMENT).toBe('');
    expect(buildIdentity({ sha: SHA, vercelEnv: 'staging', now }).STOCKEIRO_ENVIRONMENT).toBe(
      'staging',
    );
    expect(resolveIdentity({ environment: 'staging' }).environment).toBe(UNKNOWN);
  });

  it('el instante del build es un ISO-8601 que el runtime acepta', () => {
    const builtAt = buildIdentity({ sha: SHA }).STOCKEIRO_BUILT_AT;
    expect(resolveIdentity({ builtAt }).builtAt).toBe(builtAt);
  });
});
