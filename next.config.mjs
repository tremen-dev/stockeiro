import { readFileSync } from 'node:fs';
import { buildIdentity } from './src/lib/version/build-identity.mjs';

/**
 * SPEC-031 / ADR-018 D-6 — canal de tiempo de build de la identidad del despliegue.
 *
 * Este es el ÚNICO sitio del repositorio donde se leen las variables de git de
 * Vercel. Se resuelven aquí, una vez, y se declaran abajo bajo `env`: Next
 * sustituye entonces `process.env.STOCKEIRO_*` por literales en el bundle, así
 * que el valor queda congelado con el artefacto. Si pudiera cambiar sin
 * reconstruir, la comprobación de vida mentiría.
 *
 * Hoy `VERCEL_GIT_COMMIT_SHA` llega **vacía** (no hay integración Vercel↔GitHub,
 * verificado en ADR-018 el 2026-08-17), así que en producción el endpoint dirá
 * `unknown` — que es el diagnóstico correcto, no un fallo. En un build local sí
 * hay `.git`, y `buildIdentity` cae a `git rev-parse HEAD` (CA-4). Ese fallback
 * nunca lanza: un build que muere porque `git` no está sería peor que un build
 * que no sabe de dónde viene.
 *
 * Ninguna de estas claves se configura en ninguna parte: se CALCULAN. No van a
 * `.env.example` ni a los entornos de Vercel (CA-13.3 de SPEC-031, CA-14 de
 * SPEC-038).
 *
 * SPEC-038 / ADR-024 pto. 4 — la CUARTA clave, `STOCKEIRO_VERSION`, entra por
 * aquí y solo por aquí. `package.json` es la fuente de verdad del número
 * (ADR-024 pto. 3) y este fichero es el único autorizado a leerlo, igual que es
 * el único que lee las variables de Vercel. Se hace en tiempo de BUILD a
 * propósito: leerlo en runtime sería E/S de disco dentro de la función que tiene
 * que responder cuando todo lo demás falla, y el valor dejaría de estar congelado
 * con el artefacto. Aquí no se valida nada — juzgar la forma del semver es de
 * `resolveIdentity`, que es quien tiene la sentinela.
 */
const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const deploymentIdentity = buildIdentity({
  version: packageJson.version,
  sha: process.env.VERCEL_GIT_COMMIT_SHA,
  vercelEnv: process.env.VERCEL_ENV,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: deploymentIdentity,
  async headers() {
    return [
      {
        // ADR-015 pto. 9: el token viaja en el path, así que la página de contraseña
        // nueva NO debe enviar `Referer` a nadie. La fuga no se evita eligiendo path o
        // query —las dos filtran igual—, se evita no enviando la cabecera. Esta página
        // no carga recursos de terceros, así que la política no cuesta nada.
        source: '/reset-password/:token*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },
};

export default nextConfig;
