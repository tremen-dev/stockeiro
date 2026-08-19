import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-031 CA-8 … CA-11 — `scripts/check-alive.mjs`.
 *
 * No hace falta desplegar para probar un cliente HTTP; hace falta un servidor, y
 * eso es gratis: cada caso levanta su propio servidor de juguete con `node:http`
 * en el *loopback* con puerto efímero, y ejecuta el script como SUBPROCESO real.
 * Se prueba el binario, no una función interna: los códigos de salida son el
 * contrato, y un código de salida solo existe cuando hay proceso.
 *
 * Ningún test sale a la red (CA-13.4).
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(rootDir, 'scripts', 'check-alive.mjs');

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const OTRO_SHA = 'ffffffffffffffffffffffffffffffffffffffff';

type Run = { code: number; stdout: string; stderr: string };

function run(args: string[]): Promise<Run> {
  return new Promise((resolveRun) => {
    execFile(
      process.execPath,
      [scriptPath, ...args],
      { encoding: 'utf8' },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 1;
        resolveRun({ code, stdout, stderr });
      },
    );
  });
}

type Toy = { origin: string; port: number; hits: () => number; close: () => Promise<void> };

async function toyServer(
  handler: (req: IncomingMessage, res: ServerResponse, hit: number) => void,
  port = 0,
): Promise<Toy> {
  let hits = 0;
  const server = createServer((req, res) => handler(req, res, ++hits));
  await new Promise<void>((ready) => server.listen(port, '127.0.0.1', ready));
  const actual = (server.address() as AddressInfo).port;
  return {
    origin: `http://127.0.0.1:${actual}`,
    port: actual,
    hits: () => hits,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}

/** Servidor que responde el contrato con el commit dado. */
function identityServer(commit: string, extra: Record<string, unknown> = {}) {
  return (req: IncomingMessage, res: ServerResponse) => {
    if (req.url !== '/api/version') {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(
      JSON.stringify({
        commit,
        environment: 'production',
        builtAt: '2026-08-18T09:30:00.000Z',
        ...extra,
      }),
    );
  };
}

// ---------------------------------------------------------------------------

describe('SPEC-031 CA-8: existe, es reutilizable y no puede filtrar nada', () => {
  const source = () => readFileSync(scriptPath, 'utf8');

  it('el fichero existe donde la spec lo pone', () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('8.2 — todo lo que importa es de la biblioteca estándar de Node', () => {
    const specifiers = [
      ...source().matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?from\s*)?['"]([^'"]+)['"]/g),
      ...source().matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
      ...source().matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((m) => m[1]);

    for (const specifier of specifiers) {
      expect(
        specifier.startsWith('node:'),
        `"${specifier}" no es de la stdlib. El script debe correr en un runner con ` +
          'solo el repositorio clonado, sin `npm ci` (ADR-018 D-4.1).',
      ).toBe(true);
    }
  });

  it('8.2 — no importa ninguna dependencia de package.json ni código de la app', () => {
    const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const instalados = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
    for (const nombre of instalados) {
      expect(source()).not.toMatch(new RegExp(`from\\s*['"]${nombre}`));
    }
    expect(source()).not.toContain('../src/');
    expect(source()).not.toContain('@/');
  });

  it('8.3 — no lee ni una variable de entorno: no puede filtrar un secreto que no toca', () => {
    expect(
      source(),
      'Solo habla HTTP con un endpoint público. Es la propiedad que permitirá a ' +
        'SPEC-028 llamarlo desde un paso sin secretos.',
    ).not.toContain('process.env');
  });

  it('8.4 — los cuatro códigos de salida están documentados en la cabecera del fichero', () => {
    const cabecera = source().split('\n').slice(0, 60).join('\n');
    for (const codigo of ['0', '1', '2', '3']) {
      expect(cabecera).toMatch(new RegExp(`\\b${codigo}\\b`));
    }
    expect(cabecera).toMatch(/unknown/);
  });

  it('8.1 — `--help` imprime el contrato y sale con 0', async () => {
    const { code, stdout } = await run(['--help']);
    expect(code).toBe(0);
    for (const flag of ['--url', '--commit', '--timeout', '--interval']) {
      expect(stdout).toContain(flag);
    }
    expect(stdout).toContain('check-alive.mjs');
  });

  it('8.1 — `--url` es obligatorio: sin él, uso incorrecto (3)', async () => {
    const { code, stderr } = await run([]);
    expect(code).toBe(3);
    expect(stderr).toContain('--url');
  });

  it('8.1 — una bandera desconocida es uso incorrecto (3)', async () => {
    const { code } = await run(['--url', 'http://127.0.0.1:1', '--inventada']);
    expect(code).toBe(3);
  });

  it('8.1 — un plazo que no es un número es uso incorrecto (3)', async () => {
    const { code } = await run(['--url', 'http://127.0.0.1:1', '--timeout', 'pronto']);
    expect(code).toBe(3);
  });
});

describe('SPEC-031 CA-9: verde cuando el despliegue lleva el commit esperado', () => {
  it('con --commit coincidente sale con 0 e imprime la identidad completa', async () => {
    const toy = await toyServer(identityServer(SHA));
    try {
      const { code, stdout } = await run(['--url', toy.origin, '--commit', SHA]);
      expect(code).toBe(0);
      expect(stdout).toContain(SHA);
      expect(stdout).toContain('production');
      expect(stdout).toContain('2026-08-18T09:30:00.000Z');
    } finally {
      await toy.close();
    }
  });

  it('el sha se compara sin distinguir mayúsculas', async () => {
    const toy = await toyServer(identityServer(SHA));
    try {
      expect((await run(['--url', toy.origin, '--commit', SHA.toUpperCase()])).code).toBe(0);
    } finally {
      await toy.close();
    }
  });

  it('modo smoke (sin --commit): identidad bien formada y commit != unknown -> 0', async () => {
    const toy = await toyServer(identityServer(SHA));
    try {
      const { code, stdout } = await run(['--url', toy.origin]);
      expect(code).toBe(0);
      expect(stdout).toContain(SHA);
    } finally {
      await toy.close();
    }
  });

  it('tolera la barra final en el origen', async () => {
    const toy = await toyServer(identityServer(SHA));
    try {
      expect((await run(['--url', `${toy.origin}/`, '--commit', SHA])).code).toBe(0);
    } finally {
      await toy.close();
    }
  });
});

describe('SPEC-031 CA-10: rojo cuando no llega, con qué se necesita para diagnosticar', () => {
  it('sale con 1 dentro del plazo, y nombra el esperado y el último visto', async () => {
    const toy = await toyServer(identityServer(OTRO_SHA));
    try {
      const inicio = Date.now();
      const { code, stderr } = await run([
        '--url',
        toy.origin,
        '--commit',
        SHA,
        '--timeout',
        '2',
        '--interval',
        '0.4',
      ]);
      const transcurrido = Date.now() - inicio;

      expect(code).toBe(1);
      // Sin el "último visto", el mensaje solo dice "no llegó" y quien mire tiene
      // que ir a mano a averiguar qué hay vivo — el trabajo que esta spec elimina.
      expect(stderr).toContain(SHA);
      expect(stderr).toContain(OTRO_SHA);
      // Respeta el plazo en vez de rendirse al primer intento...
      expect(transcurrido).toBeGreaterThanOrEqual(1800);
      // ...y no se pasa de largo.
      expect(transcurrido).toBeLessThan(9000);
      expect(toy.hits()).toBeGreaterThan(2);
    } finally {
      await toy.close();
    }
  });

  it('un origen que nunca responde también acaba en 1, no en un cuelgue', async () => {
    // Puerto reservado y cerrado: la conexión se rechaza en cada intento.
    const cerrado = await toyServer(() => {});
    const { port } = cerrado;
    await cerrado.close();

    const { code, stderr } = await run([
      '--url',
      `http://127.0.0.1:${port}`,
      '--commit',
      SHA,
      '--timeout',
      '2',
      '--interval',
      '0.4',
    ]);
    expect(code).toBe(1);
    expect(stderr).toContain(SHA);
  });
});

describe('SPEC-031 CA-11: `unknown` tiene su propio rojo', () => {
  /**
   * Retitulado por **SPEC-033** (con su permiso explícito, escrito en §Fuera de
   * alcance y acotado por CA-8: este caso y ningún otro de este fichero).
   *
   * La regla de CA-11 sobrevive —`unknown` tiene su propio rojo, el **2**, y su
   * propio mensaje— pero **cuándo** se emite depende ahora del modo: con
   * `--commit` el script espera a un despliegue que viene, así que `unknown` es
   * transitorio y el 2 solo llega **al agotar el plazo**. El título anterior
   * decía "-> 2" a secas y el caso seguiría pasando sin tocarlo, sólo que un par
   * de segundos más tarde: un test que pasa por una razón distinta de la que
   * anuncia su título es peor que un test roto. La aserción de tiempo es lo que
   * lo ata a la regla que de verdad rige.
   *
   * El modo *smoke*, aquí abajo, no cambia ni una palabra (SPEC-033 CA-5).
   */
  it('commit `unknown` con --commit -> 2 al AGOTAR EL PLAZO, y el mensaje NO dice "no coincide"', async () => {
    const toy = await toyServer(identityServer('unknown'));
    try {
      const inicio = Date.now();
      const { code, stderr } = await run(['--url', toy.origin, '--commit', SHA, '--timeout', '2']);
      const transcurrido = Date.now() - inicio;

      expect(code).toBe(2);
      expect(stderr).toMatch(/no sabe de qué commit viene/i);
      expect(stderr).not.toMatch(/no coincide/i);
      // El 2 llega al final del plazo, no al primer sondeo (SPEC-033 CA-2).
      expect(transcurrido).toBeGreaterThanOrEqual(1800);
      expect(transcurrido).toBeLessThan(9000);
    } finally {
      await toy.close();
    }
  });

  it('commit `unknown` en modo smoke también es 2: es la alarma, no un verde', async () => {
    const toy = await toyServer(identityServer('unknown'));
    try {
      expect((await run(['--url', toy.origin, '--timeout', '2'])).code).toBe(2);
    } finally {
      await toy.close();
    }
  });

  it('un fallo de red no es un veredicto: 500 y luego 200 termina en 0', async () => {
    const toy = await toyServer((req, res, hit) => {
      if (hit <= 2) {
        res.writeHead(500).end('boom');
        return;
      }
      identityServer(SHA)(req, res);
    });
    try {
      const { code } = await run([
        '--url',
        toy.origin,
        '--commit',
        SHA,
        '--timeout',
        '10',
        '--interval',
        '0.3',
      ]);
      expect(code).toBe(0);
      expect(toy.hits()).toBeGreaterThanOrEqual(3);
    } finally {
      await toy.close();
    }
  });

  it('conexión rechazada y luego servidor arriba: reintenta y termina en 0', async () => {
    // El despliegue tarda en propagarse; el primer `ECONNREFUSED` no es un no.
    const reservado = await toyServer(() => {});
    const { port } = reservado;
    await reservado.close();

    let tardio: Toy | null = null;
    const arranque = setTimeout(async () => {
      tardio = await toyServer(identityServer(SHA), port);
    }, 900);

    try {
      const { code } = await run([
        '--url',
        `http://127.0.0.1:${port}`,
        '--commit',
        SHA,
        '--timeout',
        '10',
        '--interval',
        '0.3',
      ]);
      expect(code).toBe(0);
    } finally {
      clearTimeout(arranque);
      if (tardio !== null) await (tardio as Toy).close();
    }
  });

  it('200 con un cuerpo que no es JSON -> 3', async () => {
    const toy = await toyServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' }).end('<html>vaya</html>');
    });
    try {
      const { code, stderr } = await run(['--url', toy.origin, '--commit', SHA, '--timeout', '2']);
      expect(code).toBe(3);
      expect(stderr).toMatch(/contrato|ininteligible|JSON/i);
    } finally {
      await toy.close();
    }
  });

  it('200 con JSON al que le faltan claves del contrato -> 3', async () => {
    const toy = await toyServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ commit: SHA }));
    });
    try {
      expect((await run(['--url', toy.origin, '--commit', SHA, '--timeout', '2'])).code).toBe(3);
    } finally {
      await toy.close();
    }
  });

  it('200 con claves de MÁS también es 3: el contrato es exacto', async () => {
    const toy = await toyServer(identityServer(SHA, { cycle: 'ayer' }));
    try {
      expect((await run(['--url', toy.origin, '--commit', SHA, '--timeout', '2'])).code).toBe(3);
    } finally {
      await toy.close();
    }
  });
});
