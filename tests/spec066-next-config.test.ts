import { describe, it, expect } from 'vitest';
import { withBotId } from 'botid/next/config';

/**
 * SPEC-066 CA-7 — la configuración de Next envuelta con `withBotId` conserva lo que ya
 * tenía. Aquí, sobre la configuración que exporta `next.config.mjs` (la que lee `next
 * build`); el e2e (`tests/e2e/spec066-alta.spec.ts`) lo mira sobre el build servido.
 */

type Cabecera = { source: string; headers: Array<{ key: string; value: string }> };

async function configuracion() {
  return (await import('../next.config.mjs')).default as {
    env?: Record<string, string>;
    headers: () => Promise<Cabecera[]>;
    rewrites: () => Promise<unknown>;
  };
}

const politica = (lista: Cabecera[], source: string) =>
  lista.find((h) => h.source === source)?.headers.find((x) => x.key === 'Referrer-Policy')?.value;

describe('SPEC-066 CA-7: la configuración de Next conserva lo que ya tenía', () => {
  it('/reset-password/<token> sigue con Referrer-Policy: no-referrer', async () => {
    const cabeceras = await (await configuracion()).headers();
    expect(politica(cabeceras, '/reset-password/:token*')).toBe('no-referrer');
  });

  it('/register/confirmar/<token> sale con la MISMA cabecera (D-2)', async () => {
    const cabeceras = await (await configuracion()).headers();
    expect(politica(cabeceras, '/register/confirmar/:token*')).toBe('no-referrer');
  });

  it('la identidad de despliegue sigue en `env` (SPEC-031): /api/version no pierde su canal', async () => {
    const { env } = await configuracion();
    for (const clave of ['STOCKEIRO_VERSION', 'STOCKEIRO_COMMIT', 'STOCKEIRO_ENVIRONMENT', 'STOCKEIRO_BUILT_AT']) {
      expect(env, `falta ${clave}`).toHaveProperty(clave);
    }
  });

  it('y ahora lleva las rewrites de BotID, las mismas que genera la librería', async () => {
    const nuestras = await (await configuracion()).rewrites();
    const deLaLibreria = await (withBotId({}).rewrites as () => Promise<unknown>)();
    expect(nuestras).toEqual(deLaLibreria);
    expect(Array.isArray(nuestras) ? nuestras.length : 0).toBeGreaterThan(0);
  });
});
