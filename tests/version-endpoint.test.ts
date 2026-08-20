import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * SPEC-031 — el endpoint `/api/version` (ADR-018 D-6).
 *
 * Se invoca el manejador de ruta importado directamente: no hace falta un
 * servidor para comprobar lo que responde una función.
 *
 * Cubre CA-1 (contrato exacto), la mitad dinámica de CA-2 (la identidad se
 * resuelve UNA vez, al cargar el módulo), la mitad dinámica de CA-5 (responde
 * con la BD caída) y CA-6 (no se cachea).
 */

const VER_A = '0.2.0';
const VER_B = '9.9.9';
const SHA_A = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const SHA_B = 'ffffffffffffffffffffffffffffffffffffffff';
const ISO_A = '2026-08-18T09:30:00.000Z';
const ISO_B = '2020-01-01T00:00:00.000Z';

let snapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  snapshot = { ...process.env };
});

afterEach(() => {
  process.env = { ...snapshot };
});

function setBuildChannel(commit: string, environment: string, builtAt: string, version = VER_A) {
  process.env.STOCKEIRO_VERSION = version;
  process.env.STOCKEIRO_COMMIT = commit;
  process.env.STOCKEIRO_ENVIRONMENT = environment;
  process.env.STOCKEIRO_BUILT_AT = builtAt;
}

/** Recarga la ruta desde cero, para que la identidad se resuelva con el entorno actual. */
async function loadRoute() {
  vi.resetModules();
  return import('@/app/api/version/route');
}

describe('SPEC-031 CA-1: el cuerpo es exactamente el contrato', () => {
  it('responde 200 con Content-Type application/json', async () => {
    setBuildChannel(SHA_A, 'production', ISO_A);
    const { GET } = await loadRoute();
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('el conjunto de claves es EXACTAMENTE { version, commit, environment, builtAt }', async () => {
    setBuildChannel(SHA_A, 'production', ISO_A);
    const { GET } = await loadRoute();
    const body = await (await GET()).json();

    // Igualdad de conjunto, no `toMatchObject`: es la forma verificable de las dos
    // restricciones de ADR-018 D-6 (no expone dato personal ninguno) y de la regla
    // de no solapamiento de §Frontera (no dice nada de ciclos). Cualquier campo
    // que alguien añada después sin pensarlo cae aquí.
    //
    // SPEC-038 CA-3 / ADR-024 ptos. 1 y 2: la clave `version` entra, y entra
    // SOLA. Es el único cambio admisible sobre el contrato que fijó SPEC-031, y
    // lo que esta aserción vigila sigue siendo lo mismo que vigilaba antes —que
    // no se cuele nada más—, ahora sobre cuatro claves en vez de tres.
    expect(Object.keys(body).sort()).toEqual(['builtAt', 'commit', 'environment', 'version']);
    expect(body).toEqual({
      version: VER_A,
      commit: SHA_A,
      environment: 'production',
      builtAt: ISO_A,
    });
  });

  it('el semver que sirve es el del canal de build, validado por contenido', async () => {
    setBuildChannel(SHA_A, 'production', ISO_A, '10.20.30');
    const { GET } = await loadRoute();
    expect((await (await GET()).json()).version).toBe('10.20.30');
  });

  it('un semver con forma inválida en el canal sale como `unknown`, no crudo', async () => {
    setBuildChannel(SHA_A, 'production', ISO_A, 'latest');
    const { GET } = await loadRoute();
    const body = await (await GET()).json();

    expect(body.version).toBe('unknown');
    expect(JSON.stringify(body)).not.toContain('latest');
  });

  it('NO incluye la rama ni ningún otro metadato de git más allá del sha', async () => {
    process.env.VERCEL_GIT_COMMIT_REF = 'main';
    setBuildChannel(SHA_A, 'production', ISO_A);
    const { GET } = await loadRoute();
    const body = await (await GET()).json();

    expect(JSON.stringify(body)).not.toContain('main');
    expect(body).not.toHaveProperty('branch');
    expect(body).not.toHaveProperty('ref');
  });

  it('sin nada en el canal de build responde 200 igualmente, con las CUATRO claves en `unknown`', async () => {
    delete process.env.STOCKEIRO_VERSION;
    delete process.env.STOCKEIRO_COMMIT;
    delete process.env.STOCKEIRO_ENVIRONMENT;
    delete process.env.STOCKEIRO_BUILT_AT;
    const { GET } = await loadRoute();
    const res = await GET();

    // La alarma es el CONTENIDO, no el código de estado: interpretar es trabajo
    // de la comprobación de vida (CA-11), no del endpoint.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      version: 'unknown',
      commit: 'unknown',
      environment: 'unknown',
      builtAt: 'unknown',
    });
  });

  it('el sha vacío —el caso real de hoy— también responde 200 y dice `unknown`', async () => {
    setBuildChannel('', '', '', '');
    const { GET } = await loadRoute();
    const res = await GET();

    expect(res.status).toBe(200);
    expect((await res.json()).commit).toBe('unknown');
  });
});

describe('SPEC-031 CA-2: la identidad va congelada con el artefacto', () => {
  it('mutar process.env entre dos peticiones NO cambia la respuesta', async () => {
    setBuildChannel(SHA_A, 'production', ISO_A);
    const { GET } = await loadRoute();

    const first = await (await GET()).json();

    // Alguien cambia el entorno del proceso vivo, sin reconstruir nada.
    setBuildChannel(SHA_B, 'preview', ISO_B, VER_B);

    const second = await (await GET()).json();

    // Si esto fallara, "si cambia sin build, la comprobación miente" (ADR-018 D-6).
    expect(second).toEqual(first);
    expect(first.commit).toBe(SHA_A);
    // El semver va congelado igual que el sha: es un dato del artefacto (SPEC-038).
    expect(first.version).toBe(VER_A);
  });
});

describe('SPEC-031 CA-5: responde con la base de datos caída', () => {
  it('sin DATABASE_URL definida responde 200 con el cuerpo completo', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.DB_DRIVER;
    setBuildChannel(SHA_A, 'production', ISO_A);

    const { GET } = await loadRoute();
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      version: VER_A,
      commit: SHA_A,
      environment: 'production',
      builtAt: ISO_A,
    });
  });
});

describe('SPEC-031 CA-6: no se cachea', () => {
  it('la respuesta lleva Cache-Control: no-store', async () => {
    setBuildChannel(SHA_A, 'production', ISO_A);
    const { GET } = await loadRoute();

    // Una respuesta cacheada diría "vivo" sobre código que ya no está: es el
    // mismo fallo que esta spec cierra, pero con un sello automático encima.
    expect((await GET()).headers.get('cache-control')).toContain('no-store');
  });

  it('la ruta declara render dinámico', async () => {
    const route = await loadRoute();
    expect(route.dynamic).toBe('force-dynamic');
  });
});
