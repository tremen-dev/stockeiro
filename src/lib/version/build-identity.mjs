/**
 * SPEC-031 / ADR-018 D-6 — lado de BUILD de la identidad del despliegue.
 *
 * Lo evalúa `next.config.mjs` una vez, al construir, y su resultado se declara
 * bajo `env`: Next sustituye entonces `process.env.STOCKEIRO_*` por literales en
 * el bundle. Ese es el "canal de tiempo de build" que exige D-6 — si el valor
 * pudiera cambiar sin reconstruir, la comprobación de vida mentiría.
 *
 * Es `.mjs` y no `.ts` porque `next.config.mjs` no puede importar TypeScript.
 *
 * Recibe el sha de Vercel como PARÁMETRO en lugar de leerlo del entorno: así el
 * nombre de las variables de Vercel vive solo en `next.config.mjs` y ningún
 * módulo bajo `src/` las menciona (CA-2, mitad estática). No valida nada: juzgar
 * los valores es trabajo de `resolveIdentity` en runtime (CA-3), que es donde
 * está la sentinela `unknown` y sus tests exhaustivos.
 */
import { execFileSync } from 'node:child_process';

/**
 * El sha de `HEAD` del repositorio, o cadena vacía si no se puede saber.
 *
 * NUNCA lanza (CA-4): un build que muere porque `git` no está es peor que un
 * build que no sabe de dónde viene. Cubre las tres formas de fallo — binario
 * ausente o inaccesible por PATH (ENOENT), directorio sin repositorio y `git`
 * que sale con código distinto de cero — con el mismo resultado: `''`.
 *
 * Alcance real: SOLO builds locales o de CI. Vercel sube el código sin `.git`,
 * así que allí este camino no se dispara, y es correcto que no se dispare.
 *
 * @param {{ cwd?: string, gitBinary?: string }} [options]
 * @returns {string}
 */
export function gitHeadSha(options = {}) {
  const { cwd = process.cwd(), gitBinary = 'git' } = options;
  try {
    return execFileSync(gitBinary, ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      // El ruido de git no debe ensuciar el log del build.
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Las tres variables del canal de build, siempre presentes y siempre cadenas.
 *
 * @param {{ sha?: string | null, vercelEnv?: string | null, now?: Date,
 *           cwd?: string, gitBinary?: string }} [options]
 * @returns {{ STOCKEIRO_COMMIT: string, STOCKEIRO_ENVIRONMENT: string, STOCKEIRO_BUILT_AT: string }}
 */
export function buildIdentity(options = {}) {
  const { sha, vercelEnv, now = new Date(), cwd, gitBinary } = options;
  const fromVercel = typeof sha === 'string' ? sha.trim() : '';
  const commit = fromVercel !== '' ? fromVercel : gitHeadSha({ cwd, gitBinary });

  return {
    STOCKEIRO_COMMIT: commit,
    STOCKEIRO_ENVIRONMENT: typeof vercelEnv === 'string' ? vercelEnv : '',
    STOCKEIRO_BUILT_AT: now.toISOString(),
  };
}
