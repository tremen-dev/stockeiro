import { deploymentIdentity } from '@/lib/version/identity';

/**
 * SPEC-031 / ADR-018 D-6 — la identidad de este despliegue, legible desde fuera.
 *
 * Responde `{ commit, environment, builtAt }` y nada más. Ni una clave de más:
 * es la forma verificable de las dos restricciones de D-6 —por construcción no
 * expone dato personal ninguno— y de la regla de no solapamiento de §Frontera:
 * **`/api/version` no dice nada de ciclos**.
 *
 * Público a propósito: el `matcher` de `src/proxy.ts` excluye `/api`, así que
 * nace sin sesión y no hay nada que proteger — devuelve tres constantes
 * congeladas en el build (RN-03 no se relaja: aquí no se sirve dato de usuario).
 *
 * No importa NADA más que la identidad: debe poder responder con la BD caída,
 * que es justo cuando más falta hace (CA-5). El grafo de imports lo vigila en
 * `tests/version-import-graph.test.ts`.
 *
 * Si `commit` vale `unknown`, eso ES la alarma: este despliegue no sabe de dónde
 * viene. El código de estado sigue siendo 200 — interpretar es trabajo de
 * `scripts/check-alive.mjs`, no del endpoint.
 */

// Nunca prerenderizado ni servido de caché: una respuesta cacheada diría "vivo"
// sobre código que ya no está, y eso es peor que no comprobar nada (CA-6).
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response(JSON.stringify(deploymentIdentity), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
