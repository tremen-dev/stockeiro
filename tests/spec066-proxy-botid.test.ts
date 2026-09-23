import { describe, it, expect, beforeAll, vi } from 'vitest';
import { NextRequest, type NextFetchEvent } from 'next/server';
import { withBotId } from 'botid/next/config';
import { BOTID_PATH_PREFIX, isBotIdPath, isPublicPath, PUBLIC_PREFIXES } from '@/lib/auth/guard';

/**
 * SPEC-066 CA-6 — las rutas de BotID salen del proxy sin sesión y sin rastro (ADR-042
 * pto. 19).
 *
 * La lista de rutas NO se escribe aquí: se DERIVA de lo que la librería reescribe, en cada
 * ejecución (`withBotId(...).rewrites()`, ADR-040). Si `botid` cambia su prefijo al
 * actualizarse, la derivación trae el nuevo y el proxy —que no lo conoce— se pone rojo
 * aquí, antes de que el reto rebote a `/login` en producción.
 *
 * Se ejecuta el proxy REAL (`src/proxy.ts`) sobre una petición sin cookies y se mira lo
 * que el navegador vería: si redirige y si fija alguna cookie `authjs.*`.
 *
 * `next-auth` se sustituye por un doble porque su build ESM no carga fuera del runtime de
 * Next. El doble hace lo que hace Auth.js en el proxy y que importa aquí (lo documenta el
 * propio `src/proxy.ts`, SPEC-035 CA-13): toda petición que ENTRA en `auth()` sale con
 * `authjs.csrf-token` y `authjs.callback-url`, y sin sesión `req.auth` es null. Así, «no
 * lleva `authjs.*`» significa exactamente «no ha entrado en Auth.js».
 */

vi.mock('next-auth', async () => {
  const { NextResponse } = await import('next/server');
  return {
    default: () => ({
      auth:
        (handler: (req: unknown) => Response) =>
        (req: Record<string, unknown>) => {
          const res = handler(Object.assign(req, { auth: null })) ?? NextResponse.next();
          res.headers.append('set-cookie', 'authjs.csrf-token=x; Path=/');
          res.headers.append('set-cookie', 'authjs.callback-url=x; Path=/');
          return res;
        },
    }),
  };
});

type Proxy = (req: NextRequest, ev: NextFetchEvent) => Promise<Response> | Response;
let proxy: Proxy;

beforeAll(async () => {
  proxy = (await import('@/proxy')).default as unknown as Proxy;
});

/** Las fuentes de las `rewrites` que añade BotID, sin ninguna nuestra. */
async function fuentesDeBotId(): Promise<string[]> {
  const config = withBotId({});
  const rewrites = await (config.rewrites as () => Promise<unknown>)();
  const lista = Array.isArray(rewrites)
    ? rewrites
    : [
        ...((rewrites as { beforeFiles?: unknown[] }).beforeFiles ?? []),
        ...((rewrites as { afterFiles?: unknown[] }).afterFiles ?? []),
        ...((rewrites as { fallback?: unknown[] }).fallback ?? []),
      ];
  return (lista as Array<{ source: string }>).map((r) => r.source);
}

/** Rutas concretas que casan con una fuente de Next (`:param*` = cero o más segmentos). */
function rutasDe(fuente: string): string[] {
  if (!fuente.includes(':')) return [fuente];
  const base = fuente.replace(/\/:[^/]+\*$/, '');
  return [base, `${base}/p.js`, `${base}/a/b/c.js`];
}

async function pedir(ruta: string) {
  const req = new NextRequest(new URL(ruta, 'http://localhost:3200'));
  const res = await proxy(req, {} as NextFetchEvent);
  const cookies = res.headers.get('set-cookie') ?? '';
  return {
    redirige: res.status >= 300 && res.status < 400,
    destino: res.headers.get('location'),
    authjs: /authjs\./i.test(cookies),
  };
}

describe('SPEC-066 CA-6: las rutas que withBotId reescribe salen del proxy', () => {
  it('centinela: la derivación encuentra rutas de verdad', async () => {
    const fuentes = await fuentesDeBotId();
    expect(fuentes.length).toBeGreaterThan(0);
    expect(fuentes.flatMap(rutasDe).length).toBeGreaterThan(fuentes.length - 1);
  });

  it('TODA ruta reescrita, sin cookies: ni redirección a /login ni cookie authjs.*', async () => {
    for (const ruta of (await fuentesDeBotId()).flatMap(rutasDe)) {
      const r = await pedir(ruta);
      expect(r.redirige, `${ruta} → ${r.destino}`).toBe(false);
      expect(r.authjs, `${ruta} fija una cookie authjs.*`).toBe(false);
      expect(isBotIdPath(ruta), `${ruta} no la reconoce la excepción`).toBe(true);
    }
  });

  it('lo que sólo SE PARECE sigue exigiendo sesión (prefijo sin separador, o con un carácter de más)', async () => {
    const [primero, segundo] = BOTID_PATH_PREFIX.split('/').filter(Boolean);
    for (const parecida of [
      `/${primero}${segundo}`, // sin el separador
      `${BOTID_PATH_PREFIX}x`, // un carácter de más
      `${BOTID_PATH_PREFIX}x/a-4-a/c.js`,
      `/${primero}`,
    ]) {
      expect(isBotIdPath(parecida), parecida).toBe(false);
      const r = await pedir(parecida);
      expect(r.redirige, `${parecida} debería exigir sesión`).toBe(true);
      expect(r.destino).toMatch(/\/login$/);
    }
  });

  it('una ruta privada sigue redirigida: la excepción no abre nada más', async () => {
    const r = await pedir('/dashboard');
    expect(r.redirige).toBe(true);
    expect(r.destino).toMatch(/\/login$/);
    // Control del doble: lo que entra en Auth.js SÍ sale con `authjs.*`. Sin esto, el
    // «no fija authjs.*» de arriba podría ser verde sin haber mirado nada.
    expect(r.authjs).toBe(true);
  });

  it('las rutas de BotID NO entran por la lista de páginas: RN-03 no se ensancha', async () => {
    for (const ruta of (await fuentesDeBotId()).flatMap(rutasDe)) {
      expect(isPublicPath(ruta)).toBe(false);
    }
    expect(PUBLIC_PREFIXES.some((p) => p.includes('149e9513'))).toBe(false);
  });
});
