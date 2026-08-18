import { test, expect } from '@playwright/test';

/**
 * SPEC-031 CA-1 y CA-6 — `/api/version` contra la app corriendo de verdad.
 *
 * Los unitarios invocan el manejador importado; esto ancla lo que solo se ve con
 * un servidor delante: que la ruta está PUBLICADA y que se sirve **sin sesión**.
 * El `matcher` de `src/proxy.ts` excluye `/api`, así que el endpoint nace público
 * por construcción — y este test es lo que pone en rojo una futura edición de ese
 * matcher que lo metiera detrás del login.
 *
 * `request` usa un contexto propio, sin las cookies de ninguna página: es
 * literalmente una petición anónima.
 */

const CONTRATO = ['builtAt', 'commit', 'environment'];

test('CA-1: /api/version responde 200 sin sesión, con el contrato exacto', async ({ request }) => {
  const res = await request.get('/api/version');

  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/json');

  const body = await res.json();
  expect(Object.keys(body).sort()).toEqual(CONTRATO);
  for (const clave of CONTRATO) expect(typeof body[clave]).toBe('string');
});

test('CA-6: la respuesta no se cachea', async ({ request }) => {
  const res = await request.get('/api/version');
  expect(res.headers()['cache-control']).toContain('no-store');
});

test('CA-4: en un build local la identidad no es anónima — commit sale de git', async ({
  request,
}) => {
  // El e2e construye desde este árbol de trabajo, que SÍ tiene git usable. Es el
  // caso que CA-4 protege: `npm run build && npm start` en local sirve una
  // identidad real, no `unknown`. (En Vercel el código se sube sin `.git`, así
  // que allí este camino no se dispara — y es correcto que no se dispare.)
  const body = await (await request.get('/api/version')).json();
  expect(body.commit).toMatch(/^[0-9a-f]{7,40}$/);
});

test('CA-7: el cuerpo no dice nada del ciclo de refresco', async ({ request }) => {
  // ADR-018 §Frontera, regla dura: `/api/version` no dice nada de ciclos, y el
  // resumen de ciclo no dice nada de versiones.
  const crudo = await (await request.get('/api/version')).text();
  for (const palabra of ['refresh', 'triggers', 'notifications', 'quotes', 'cycle']) {
    expect(crudo).not.toContain(palabra);
  }
});
