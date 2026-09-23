/**
 * SPEC-066 CA-5 / ADR-042 pto. 17 — «¿estoy en un despliegue de Vercel?», decidido UNA vez.
 *
 * La respuesta sale de la identidad de despliegue que `next.config.mjs` congela en el
 * build (`STOCKEIRO_ENVIRONMENT`, ADR-024 pto. 4), ya resuelta por
 * `src/lib/version/identity.ts`. NO de `NODE_ENV`: el e2e corre `next start` con
 * `NODE_ENV=production` fuera de Vercel, y con esa pregunta BotID exigiría un OIDC que
 * no hay y cada alta del e2e lanzaría.
 *
 * Production **y** Preview son Vercel: los dos llevan cliente y servidor de BotID
 * enteros. Cualquier otra cosa (local, CI, e2e, `unknown`) no.
 *
 * Sin `import`: lo leen el servidor y el cliente.
 */
export function isVercelDeployment(environment: string | null | undefined): boolean {
  return environment === 'production' || environment === 'preview';
}
