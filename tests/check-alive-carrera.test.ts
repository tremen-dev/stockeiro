import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-033 CA-1 … CA-5 — la puerta post-deploy deja de perder la carrera.
 *
 * El 2026-08-19, el primer despliegue automático del proyecto (merge de la PR #35,
 * sha `0d389c8`) **funcionó** y la puerta salió **roja en 1 segundo**: GitHub Actions
 * arranca en el `push`, Vercel tarda ~35 s en publicar, y en esa ventana
 * `/api/version` sigue sirviendo el despliegue ANTERIOR — el manual por CLI, que
 * responde `commit: unknown` legítimamente. `check-alive` trataba `unknown` como
 * terminal y salía al primer sondeo: sus `--timeout 900 --interval 10` no se usaban
 * nunca.
 *
 * La regla nueva (SPEC-033 D-A/D-B): la presencia de `--commit` separa los dos modos.
 * Con `--commit` el script **espera a un despliegue que viene**, así que `unknown`
 * es **transitorio** y el 2 solo llega al **agotar el plazo**. Sin `--commit` es un
 * *smoke test*, la pregunta es otra y `unknown` sigue siendo **terminal e inmediato**
 * (SPEC-031 CA-11, que esta spec reinterpreta pero no deroga).
 *
 * Como en `tests/check-alive.test.ts` (SPEC-031): servidor de juguete con `node:http`
 * en el *loopback* con puerto efímero, y el script como SUBPROCESO real. Se prueba el
 * binario, no una función interna: los códigos de salida son el contrato, y un código
 * de salida solo existe cuando hay proceso. Ningún test sale a la red, y ninguno
 * necesita desplegar.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(rootDir, 'scripts', 'check-alive.mjs');

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const BUILT_AT = '2026-08-18T22:55:08.899Z';

type Run = { code: number; stdout: string; stderr: string };

function run(args: string[]): Promise<Run> {
  return new Promise((resolveRun) => {
    execFile(process.execPath, [scriptPath, ...args], { encoding: 'utf8' }, (error, stdout, stderr) => {
      const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 1;
      resolveRun({ code, stdout, stderr });
    });
  });
}

/** Ejecuta y devuelve además el tiempo transcurrido: es lo único que distingue
 *  "salió al primer intento" de "esperó el plazo". */
async function runCronometrado(args: string[]): Promise<Run & { transcurrido: number }> {
  const inicio = Date.now();
  const resultado = await run(args);
  return { ...resultado, transcurrido: Date.now() - inicio };
}

type Toy = { origin: string; hits: () => number; close: () => Promise<void> };

async function toyServer(
  handler: (req: IncomingMessage, res: ServerResponse, hit: number) => void,
): Promise<Toy> {
  let hits = 0;
  const server = createServer((req, res) => handler(req, res, ++hits));
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    hits: () => hits,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}

function responderIdentidad(res: ServerResponse, commit: string) {
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ commit, environment: 'production', builtAt: BUILT_AT }));
}

/** La ventana del incidente: los `unknown` primeros sondeos sirven el despliegue
 *  anterior (por CLI, sin metadatos de git); a partir de ahí, el sha mergeado. */
function servidorDeLaVentana(unknowns: number) {
  return (req: IncomingMessage, res: ServerResponse, hit: number) => {
    if (req.url !== '/api/version') {
      res.writeHead(404).end();
      return;
    }
    responderIdentidad(res, hit <= unknowns ? 'unknown' : SHA);
  };
}

/** Nunca llega nada con metadatos de git: el caso del build caído, o del
 *  despliegue por CLI que se queda ahí. */
const servidorSiempreUnknown = () => servidorDeLaVentana(Number.MAX_SAFE_INTEGER);

// ---------------------------------------------------------------------------

describe('SPEC-033 CA-1: la carrera se deja de perder', () => {
  it('`unknown` en los tres primeros sondeos y luego el sha: termina en 0', async () => {
    const toy = await toyServer(servidorDeLaVentana(3));
    try {
      const { code, stdout } = await run([
        '--url',
        toy.origin,
        '--commit',
        SHA,
        '--timeout',
        '20',
        '--interval',
        '0.3',
      ]);

      expect(
        code,
        'Es la reproducción literal del job `Alive` del merge `0d389c8`: con --commit, ' +
          '`unknown` significa "todavía no ha llegado el mío", no "aquí no hay metadatos".',
      ).toBe(0);
      expect(stdout).toContain(SHA);
      expect(stdout).toContain('production');
      expect(stdout).toContain(BUILT_AT);
    } finally {
      await toy.close();
    }
  });

  it('y el contador del servidor lo delata: hubo al menos cuatro peticiones', async () => {
    // Sin esta aserción el caso de arriba pasaría con un script que sondease una
    // sola vez y tuviera suerte. El contador es la prueba de que reintentó.
    const toy = await toyServer(servidorDeLaVentana(3));
    try {
      await run(['--url', toy.origin, '--commit', SHA, '--timeout', '20', '--interval', '0.3']);
      expect(toy.hits()).toBeGreaterThanOrEqual(4);
    } finally {
      await toy.close();
    }
  });
});

describe('SPEC-033 CA-2: el plazo se usa de verdad, y solo al expirar hay veredicto', () => {
  it('`unknown` para siempre con --commit: agota el plazo y entonces sale 2', async () => {
    const toy = await toyServer(servidorSiempreUnknown());
    try {
      const { code, stderr, transcurrido } = await runCronometrado([
        '--url',
        toy.origin,
        '--commit',
        SHA,
        '--timeout',
        '3',
        '--interval',
        '0.5',
      ]);

      expect(code, 'El veredicto sigue siendo el 2, no el 1 (SPEC-033 D-B)').toBe(2);
      // No se rinde al primer intento...
      expect(
        transcurrido,
        'Salió antes de agotar el plazo: es exactamente el defecto que esta spec corrige.',
      ).toBeGreaterThanOrEqual(2700);
      // ...y tampoco se cuelga.
      expect(transcurrido).toBeLessThan(12000);
    } finally {
      await toy.close();
    }
  });

  it('el diagnóstico de SPEC-031 sobrevive: dice que no sabe de qué commit viene, y no dice "no coincide"', async () => {
    const toy = await toyServer(servidorSiempreUnknown());
    try {
      const { stderr } = await run([
        '--url',
        toy.origin,
        '--commit',
        SHA,
        '--timeout',
        '3',
        '--interval',
        '0.5',
      ]);
      expect(stderr).toMatch(/no sabe de qué commit viene/i);
      expect(
        stderr,
        'ADR-018 D-6 llama a esto "la alarma": es otra cosa que un desacuerdo de shas.',
      ).not.toMatch(/no coincide/i);
    } finally {
      await toy.close();
    }
  });
});

describe('SPEC-033 CA-3: el 2 es comprensible, no un cuelgue mudo de 15 minutos', () => {
  it('el veredicto nombra el sha esperado, el `unknown` vivo y su `builtAt`', async () => {
    const toy = await toyServer(servidorSiempreUnknown());
    try {
      const { stderr } = await run([
        '--url',
        toy.origin,
        '--commit',
        SHA,
        '--timeout',
        '3',
        '--interval',
        '0.5',
      ]);
      expect(stderr, 'Sin el sha esperado, quien mire no sabe qué se estaba esperando').toContain(SHA);
      expect(stderr).toContain('unknown');
      expect(
        stderr,
        'El builtAt es el dato con el que la persona desempata las dos causas (D-D).',
      ).toContain(BUILT_AT);
    } finally {
      await toy.close();
    }
  });

  it('y nombra las DOS causas posibles con su desempate: el build que no llegó, o un despliegue por CLI', async () => {
    // SPEC-028 dejó la CLI viva a propósito como recurso de emergencia (§3.4 del
    // runbook). Un plazo de 15 minutos que termina en un 2 sin explicar por qué se
    // esperó tanto convierte un recurso legítimo en una trampa.
    const toy = await toyServer(servidorSiempreUnknown());
    try {
      const { stderr } = await run([
        '--url',
        toy.origin,
        '--commit',
        SHA,
        '--timeout',
        '3',
        '--interval',
        '0.5',
      ]);
      expect(stderr, 'Falta la causa "el despliegue anterior sigue vivo: el build no llegó"').toMatch(
        /build/i,
      );
      expect(stderr, 'Falta la causa "alguien desplegó por CLI"').toMatch(/CLI/);
      expect(stderr, 'Falta decir que el builtAt es lo que separa las dos causas').toMatch(
        /builtAt[^\n]*(separa|desempat|distingue)|(separa|desempat|distingue)[^\n]*builtAt/i,
      );
    } finally {
      await toy.close();
    }
  });
});

describe('SPEC-033 CA-4: la espera no es muda, y tampoco es ruido', () => {
  it('avisa en el primer `unknown` diciendo que sigue esperando y con qué `builtAt`', async () => {
    const toy = await toyServer(servidorDeLaVentana(4));
    try {
      const { stderr } = await run([
        '--url',
        toy.origin,
        '--commit',
        SHA,
        '--timeout',
        '20',
        '--interval',
        '0.3',
      ]);
      const aviso = stderr.split('\n').find((linea) => /sigo esperando/i.test(linea));
      expect(
        aviso,
        '900 s de silencio en un job de CI son indistinguibles de un cuelgue (D-C).',
      ).toBeDefined();
      expect(aviso).toContain(BUILT_AT);
    } finally {
      await toy.close();
    }
  });

  it('y esa línea aparece exactamente UNA vez por ejecución, con cuatro sondeos `unknown`', async () => {
    // 90 líneas idénticas no son un log, son ruido.
    const toy = await toyServer(servidorDeLaVentana(4));
    try {
      const { stderr } = await run([
        '--url',
        toy.origin,
        '--commit',
        SHA,
        '--timeout',
        '20',
        '--interval',
        '0.3',
      ]);
      expect(toy.hits(), 'El servidor tiene que haber visto los cuatro `unknown`').toBeGreaterThanOrEqual(5);
      expect([...stderr.matchAll(/sigo esperando/gi)]).toHaveLength(1);
    } finally {
      await toy.close();
    }
  });
});

describe('SPEC-033 CA-5: el modo smoke no cambia — `unknown` sigue terminal e inmediato', () => {
  it('sin --commit y con un plazo largo, sale con 2 en unos pocos segundos', async () => {
    const toy = await toyServer(servidorSiempreUnknown());
    try {
      const { code, stderr, transcurrido } = await runCronometrado([
        '--url',
        toy.origin,
        '--timeout',
        '60',
      ]);

      expect(code).toBe(2);
      expect(
        transcurrido,
        'Sin --commit la pregunta es "¿este despliegue sabe de dónde viene?", y la ' +
          'respuesta inmediata es la útil (SPEC-031 CA-9 y CA-11).',
      ).toBeLessThan(10000);
      expect(stderr).toMatch(/no sabe de qué commit viene/i);
      expect(stderr, 'En modo smoke no hay espera, así que no hay nada que anunciar').not.toMatch(
        /sigo esperando/i,
      );
    } finally {
      await toy.close();
    }
  });
});

describe('SPEC-033 CA-9.1: la regla nueva queda escrita en el propio script', () => {
  const source = () => readFileSync(scriptPath, 'utf8');

  it('la cabecera dice que `unknown` es terminal en smoke y transitorio con --commit', () => {
    const cabecera = source().split('\n').slice(0, 60).join('\n');
    expect(cabecera).toMatch(/smoke/i);
    expect(cabecera).toMatch(/transitorio/i);
    expect(cabecera).toContain('SPEC-033');
    // El bloque de códigos de salida sigue dentro de la ventana que mira
    // `tests/check-alive.test.ts` 8.4, que esta spec no autoriza a tocar.
    for (const codigo of ['0', '1', '2', '3']) {
      expect(cabecera).toMatch(new RegExp(`\\b${codigo}\\b`));
    }
  });

  it('`--help` también lo dice: el 2 con --commit solo llega al agotar el plazo', async () => {
    const { code, stdout } = await run(['--help']);
    expect(code).toBe(0);
    expect(stdout).toMatch(/transitorio/i);
    expect(stdout).toMatch(/plazo/i);
  });
});
