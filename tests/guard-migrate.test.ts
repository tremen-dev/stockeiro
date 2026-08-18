import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decidir, SALIDA, VARIABLE, VALOR_QUE_AUTORIZA } from '../scripts/guard-migrate.mjs';

/**
 * SPEC-032 CA-1 … CA-5 — `scripts/guard-migrate.mjs` (ADR-018 D-2).
 *
 * La guardia es lo primero que corre dentro del `buildCommand` de Vercel, y su
 * contrato entero cabe en dos frases: **decide leyendo solo el entorno** y **su
 * código de salida corta el `&&`**. Por eso aquí hay dos capas de prueba y no
 * una:
 *
 *   - unitarios sobre la **función pura** de decisión, una fila de la tabla de
 *     CA-2 por caso, la tabla entera; y
 *   - **subprocesos reales**, porque un código de salida solo existe cuando hay
 *     proceso: una función que devuelve `false` no corta ningún `&&`.
 *
 * Ningún test sale a la red ni abre una base de datos (CA-5, CA-14.4).
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(rootDir, 'scripts', 'guard-migrate.mjs');
const source = () => readFileSync(scriptPath, 'utf8');

type Run = { code: number; stdout: string; stderr: string };

/** Entorno controlado: se parte del real (Node lo necesita en Windows) y se
 *  borran las tres variables que la guardia mira, para que un `ALLOW_MIGRATE`
 *  de la máquina de alguien no decida el resultado de un test. */
function entorno(extra: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = { ...process.env };
  delete base.VERCEL_ENV;
  delete base.ALLOW_MIGRATE;
  delete base.DATABASE_URL;
  for (const [clave, valor] of Object.entries(extra)) {
    if (valor === undefined) delete base[clave];
    else base[clave] = valor;
  }
  return base;
}

function run(args: string[], env: NodeJS.ProcessEnv): Promise<Run> {
  return new Promise((resolveRun) => {
    execFile(
      process.execPath,
      [scriptPath, ...args],
      { encoding: 'utf8', env },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 1;
        resolveRun({ code, stdout, stderr });
      },
    );
  });
}

describe('SPEC-032 CA-1: la guardia existe, vive en el repo y no puede filtrar nada', () => {
  it('scripts/guard-migrate.mjs existe', () => {
    expect(
      existsSync(scriptPath),
      'Sin guardia, el `buildCommand` migra la base a la que apunte, sea cual sea.',
    ).toBe(true);
  });

  it('1.2 — no importa nada fuera de la biblioteca estándar de Node', () => {
    // Corre en la primera línea del build, antes de que nada garantice que
    // `node_modules` sirva para algo. Una guardia que depende de la instalación
    // se cae justo cuando el build es raro.
    const especificadores = [
      ...source().matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm),
      ...source().matchAll(/\bimport\(\s*['"]([^'"]+)['"]/g),
      ...source().matchAll(/\brequire\(\s*['"]([^'"]+)['"]/g),
    ].map((m) => m[1]);

    expect(especificadores.length, 'Se esperaba al menos un import de node:*').toBeGreaterThan(0);
    for (const especificador of especificadores) {
      expect(especificador, `La guardia importa "${especificador}", que no es node:*`).toMatch(
        /^node:/,
      );
    }
  });

  it('1.3 — la cabecera documenta los tres códigos de salida', () => {
    const cabecera = source().split('*/')[0];
    expect(cabecera).toMatch(/\b0\b[^\n]*autoriza/i);
    expect(cabecera).toMatch(/\b1\b[^\n]*rechaza/i);
    expect(cabecera).toMatch(/\b2\b[^\n]*uso/i);
  });

  it('1.1 — `--help` imprime el contrato y sale con 0', async () => {
    const { code, stdout } = await run(['--help'], entorno({}));
    expect(code).toBe(0);
    expect(stdout).toContain('ALLOW_MIGRATE');
    expect(stdout).toMatch(/VERCEL_ENV/);
    for (const codigo of ['0', '1', '2']) {
      expect(stdout, `El código de salida ${codigo} no aparece en --help`).toMatch(
        new RegExp(`(^|\\n)\\s*${codigo}\\s+\\S`),
      );
    }
  });

  it('los códigos de salida exportados son el contrato: 0 / 1 / 2', () => {
    expect(SALIDA).toEqual({ AUTORIZA: 0, RECHAZA: 1, USO: 2 });
  });

  it('el nombre y el valor de la variable son los que fija la spec', () => {
    expect(VARIABLE).toBe('ALLOW_MIGRATE');
    expect(VALOR_QUE_AUTORIZA).toBe('1');
  });

  it('un argumento desconocido es uso incorrecto: sale con 2', async () => {
    const { code } = await run(['--migra-porfa'], entorno({ VERCEL_ENV: 'production' }));
    expect(code).toBe(SALIDA.USO);
  });
});

describe('SPEC-032 CA-2: fail-closed, la tabla de decisión completa', () => {
  /** Una fila de la tabla de CA-2 = un caso. `undefined` = variable ausente. */
  const TABLA: ReadonlyArray<{
    vercelEnv: string | undefined;
    allowMigrate: string | undefined;
    autoriza: boolean;
  }> = [
    // production: autoriza con cualquier valor de ALLOW_MIGRATE, o sin él.
    { vercelEnv: 'production', allowMigrate: '1', autoriza: true },
    { vercelEnv: 'production', allowMigrate: undefined, autoriza: true },
    { vercelEnv: 'production', allowMigrate: '0', autoriza: true },
    { vercelEnv: 'production', allowMigrate: 'no', autoriza: true },
    // preview: solo con permiso explícito y literal.
    { vercelEnv: 'preview', allowMigrate: '1', autoriza: true },
    { vercelEnv: 'preview', allowMigrate: ' 1 ', autoriza: true },
    { vercelEnv: 'preview', allowMigrate: undefined, autoriza: false },
    { vercelEnv: 'preview', allowMigrate: '', autoriza: false },
    { vercelEnv: 'preview', allowMigrate: '0', autoriza: false },
    { vercelEnv: 'preview', allowMigrate: 'true', autoriza: false },
    { vercelEnv: 'preview', allowMigrate: 'yes', autoriza: false },
    { vercelEnv: 'preview', allowMigrate: '1x', autoriza: false },
    // development o cualquier otro valor: igual que preview.
    { vercelEnv: 'development', allowMigrate: '1', autoriza: true },
    { vercelEnv: 'development', allowMigrate: undefined, autoriza: false },
    { vercelEnv: 'development', allowMigrate: 'true', autoriza: false },
    { vercelEnv: 'un-entorno-personalizado', allowMigrate: '1', autoriza: true },
    { vercelEnv: 'un-entorno-personalizado', allowMigrate: undefined, autoriza: false },
    // ausente: la parte fail-closed que importa. No saber NO es adelante.
    { vercelEnv: undefined, allowMigrate: '1', autoriza: true },
    { vercelEnv: undefined, allowMigrate: undefined, autoriza: false },
    { vercelEnv: undefined, allowMigrate: '0', autoriza: false },
    { vercelEnv: undefined, allowMigrate: '', autoriza: false },
  ];

  for (const fila of TABLA) {
    const nombre =
      `VERCEL_ENV=${fila.vercelEnv ?? '(ausente)'} · ` +
      `ALLOW_MIGRATE=${fila.allowMigrate === undefined ? '(ausente)' : JSON.stringify(fila.allowMigrate)}` +
      ` → ${fila.autoriza ? 'autoriza' : 'rechaza'}`;

    it(nombre, () => {
      const env: Record<string, string> = {};
      if (fila.vercelEnv !== undefined) env.VERCEL_ENV = fila.vercelEnv;
      if (fila.allowMigrate !== undefined) env.ALLOW_MIGRATE = fila.allowMigrate;
      expect(decidir(env).autoriza).toBe(fila.autoriza);
    });
  }

  it('la ausencia de VERCEL_ENV es un rechazo, no un "no sé, adelante"', () => {
    expect(decidir({}).autoriza).toBe(false);
  });

  it('subproceso — producción autoriza y sale con 0', async () => {
    const { code } = await run([], entorno({ VERCEL_ENV: 'production' }));
    expect(code).toBe(SALIDA.AUTORIZA);
  });

  it('subproceso — preview sin permiso rechaza y sale con 1', async () => {
    const { code } = await run([], entorno({ VERCEL_ENV: 'preview' }));
    expect(code).toBe(SALIDA.RECHAZA);
  });

  it('subproceso — preview con ALLOW_MIGRATE=1 autoriza y sale con 0', async () => {
    const { code } = await run([], entorno({ VERCEL_ENV: 'preview', ALLOW_MIGRATE: '1' }));
    expect(code).toBe(SALIDA.AUTORIZA);
  });
});

describe('SPEC-032 CA-3: dice qué autorizó y contra qué base, sin credenciales', () => {
  const URL_CON_SECRETOS =
    'postgres://usuario_delator:contrasena_delatora@db.ejemplo.invalid:5433/stockeiro_prod?sslmode=require&channel_binding=require';

  it('al autorizar imprime el entorno, el motivo, el host y la base', async () => {
    const { code, stdout } = await run(
      [],
      entorno({ VERCEL_ENV: 'production', DATABASE_URL: URL_CON_SECRETOS }),
    );
    expect(code).toBe(SALIDA.AUTORIZA);
    expect(stdout).toContain('production');
    expect(stdout).toContain('db.ejemplo.invalid');
    expect(stdout).toContain('stockeiro_prod');
  });

  it('y NADA más de esa URL: ni usuario, ni contraseña, ni query string', async () => {
    const { stdout, stderr } = await run(
      [],
      entorno({ VERCEL_ENV: 'production', DATABASE_URL: URL_CON_SECRETOS }),
    );
    const todo = `${stdout}\n${stderr}`;
    for (const secreto of [
      'usuario_delator',
      'contrasena_delatora',
      'sslmode',
      'channel_binding',
    ]) {
      expect(todo, `La guardia ha filtrado "${secreto}" al log del build`).not.toContain(secreto);
    }
  });

  it('el motivo distingue producción de permiso explícito', async () => {
    const porProduccion = await run([], entorno({ VERCEL_ENV: 'production' }));
    const porPermiso = await run([], entorno({ VERCEL_ENV: 'preview', ALLOW_MIGRATE: '1' }));
    expect(porProduccion.stdout).toMatch(/producci[oó]n/i);
    expect(porPermiso.stdout).toContain('ALLOW_MIGRATE');
  });

  it('sin DATABASE_URL lo dice, y no revienta', async () => {
    const { code, stdout } = await run([], entorno({ VERCEL_ENV: 'production' }));
    expect(code).toBe(SALIDA.AUTORIZA);
    expect(stdout).toMatch(/DATABASE_URL/);
  });

  it('al rechazar dice qué entorno vio, qué lo autorizaría y que la base no se ha tocado', async () => {
    const { code, stderr } = await run(
      [],
      entorno({ VERCEL_ENV: 'preview', DATABASE_URL: URL_CON_SECRETOS }),
    );
    expect(code).toBe(SALIDA.RECHAZA);
    expect(stderr).toContain('preview');
    expect(stderr).toContain('ALLOW_MIGRATE=1');
    expect(stderr).toMatch(/no se ha tocado/i);
  });
});

describe('SPEC-032 CA-4: va en vercel.json, delante de la migración, y NO en package.json', () => {
  const vercelJson = () =>
    JSON.parse(readFileSync(join(rootDir, 'vercel.json'), 'utf8')) as {
      buildCommand: string;
    };
  const scripts = () =>
    (
      JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts;

  it('el buildCommand encadena guardia && db:migrate && build, en ese orden', () => {
    expect(vercelJson().buildCommand).toBe(
      'node scripts/guard-migrate.mjs && npm run db:migrate && npm run build',
    );
  });

  it('los tres eslabones van separados por && (si uno falla, se corta)', () => {
    const eslabones = vercelJson()
      .buildCommand.split('&&')
      .map((parte) => parte.trim());
    expect(eslabones).toEqual([
      'node scripts/guard-migrate.mjs',
      'npm run db:migrate',
      'npm run build',
    ]);
  });

  it('package.json conserva db:migrate sin envoltorio: el camino manual del runbook sigue vivo', () => {
    // Meter la guardia aquí rompería `DATABASE_URL=… npm run db:migrate` en la
    // máquina del humano —no hay VERCEL_ENV ahí— y convertiría una defensa en un
    // estorbo, que es como mueren las defensas.
    expect(scripts()['db:migrate']).toBe('drizzle-kit migrate');
  });
});

describe('SPEC-032 CA-5: nunca abre la base, nunca sale a la red', () => {
  it('con un host que no existe decide igual, y sin esperar a ningún timeout de red', async () => {
    const inicio = Date.now();
    const { code } = await run(
      [],
      entorno({
        VERCEL_ENV: 'production',
        DATABASE_URL: 'postgres://u:p@no-existe.invalid:5432/x',
      }),
    );
    const transcurrido = Date.now() - inicio;

    expect(code).toBe(SALIDA.AUTORIZA);
    // Holgura amplia a propósito: lo que se afirma es que no hay resolución DNS
    // ni handshake, no un número de milisegundos.
    expect(
      transcurrido,
      'La guardia ha tardado lo que tarda una red: alguien le ha puesto una conexión.',
    ).toBeLessThan(5000);
  });

  it('un rechazo con host inexistente tampoco espera a nada', async () => {
    const inicio = Date.now();
    const { code } = await run(
      [],
      entorno({
        VERCEL_ENV: 'preview',
        DATABASE_URL: 'postgres://u:p@no-existe.invalid:5432/x',
      }),
    );
    expect(code).toBe(SALIDA.RECHAZA);
    expect(Date.now() - inicio).toBeLessThan(5000);
  });

  it('el código fuente no habla con nada: ni sockets, ni HTTP, ni cliente de BD', () => {
    const texto = source();
    for (const prohibido of [
      /\bfetch\s*\(/,
      /node:net\b/,
      /node:tls\b/,
      /node:http/,
      /node:dns\b/,
      /\bdrizzle\b/,
      /\bpostgres\s*\(/,
    ]) {
      expect(texto, `La guardia menciona ${prohibido}: eso la ata a la red`).not.toMatch(prohibido);
    }
  });
});
