import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  SALIDA,
  compararSemver,
  evaluar,
  evaluarConPendientes,
  parsearSemver,
  rutasDeAplicacion,
  tocanCodigoDeAplicacion,
} from '../scripts/check-version-bump.mjs';

/**
 * SPEC-038 CA-12 y CA-13 / ADR-024 ptos. 9 y 10 — la ceremonia se convierte en gate.
 *
 * El número que hay que acordarse de subir a mano acaba congelado, y un `0.1.0`
 * inmóvil durante seis meses miente más que no tener número: afirma una identidad
 * estable sobre artefactos distintos. Por eso lo automático es la EXIGENCIA, no el
 * acto (ADR-024 pto. 8): la CI falla si tocas código de aplicación y no subes el
 * número; qué segmento subir sigue siendo un juicio de producto.
 *
 * Mismo patrón que `scripts/scan-destructive-sql.mjs` (SPEC-032): una regla que el
 * repositorio se aplica a sí mismo, en vez de una costumbre que se olvida.
 *
 * La separación que exige CA-12 se prueba aquí: la COMPARACIÓN es una función pura
 * —`compararSemver`, `tocanCodigoDeAplicacion`, `evaluar`— y se prueba caso a caso
 * sin tocar git; averiguar qué ficheros cambiaron es otra cosa y vive detrás de
 * `git diff`.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(rootDir, 'scripts', 'check-version-bump.mjs');
const workflowPath = join(rootDir, '.github', 'workflows', 'ci.yml');

type Step = { name?: string; uses?: string; run?: string; if?: string; with?: Record<string, unknown> };
type Job = { name?: string; steps: Step[] };
type Workflow = { jobs: Record<string, Job> };

const workflowSource = () => readFileSync(workflowPath, 'utf8');
const workflow = () => parse(workflowSource()) as Workflow;
const jobs = () => Object.values(workflow().jobs ?? {});
const steps = () => jobs().flatMap((job) => job.steps ?? []);

/** Las rutas de aplicación de HOY, derivadas como las deriva el script. */
const RUTAS = rutasDeAplicacion();

describe('SPEC-038 CA-12: la comparación es semver, no textual', () => {
  it('parsea los tres segmentos', () => {
    expect(parsearSemver('0.1.0')).toEqual([0, 1, 0]);
    expect(parsearSemver('10.20.30')).toEqual([10, 20, 30]);
  });

  for (const invalido of ['', '   ', ' 1.2.3 ', 'v1.2.3', '1.2', '1.2.3-beta', 'latest', '01.2.3']) {
    it(`\`${invalido}\` no es un semver de producto`, () => {
      expect(parsearSemver(invalido)).toBeNull();
    });
  }

  it('ordena por segmento y no por texto: 0.10.0 es mayor que 0.9.0', () => {
    // El caso que un `>` de cadenas se come: "0.10.0" < "0.9.0" alfabéticamente.
    expect(compararSemver('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compararSemver('0.9.0', '0.10.0')).toBeLessThan(0);
  });

  it('el MAJOR pesa más que el MINOR y el MINOR más que el PATCH', () => {
    expect(compararSemver('1.0.0', '0.99.99')).toBeGreaterThan(0);
    expect(compararSemver('0.2.0', '0.1.99')).toBeGreaterThan(0);
    expect(compararSemver('0.1.2', '0.1.1')).toBeGreaterThan(0);
  });

  it('iguales son iguales', () => {
    expect(compararSemver('0.1.0', '0.1.0')).toBe(0);
  });
});

describe('SPEC-038 CA-12: qué cuenta como código de aplicación', () => {
  it('las rutas salen de la configuración del proyecto, no de una lista inventada', () => {
    // ADR-024 pto. 9: "`src/` y las que la configuración del proyecto ya declara
    // vigiladas". `.sdd.json` es donde este proyecto ya las declara; el gate lee
    // de ahí en vez de mantener una segunda lista que divergiría.
    const sdd = JSON.parse(readFileSync(join(rootDir, '.sdd.json'), 'utf8')) as {
      rutasVigiladas?: string[];
    };
    for (const ruta of sdd.rutasVigiladas ?? []) expect(RUTAS).toContain(ruta);
    expect(RUTAS).toContain('src/');
  });

  it('sin `.sdd.json` legible no se queda sin criterio: `src/` es el suelo', () => {
    expect(rutasDeAplicacion(join(rootDir, 'no-existe-este-fichero.json'))).toEqual(['src/']);
  });

  for (const fichero of [
    'src/app/app-footer.tsx',
    'src/lib/version/identity.ts',
    'src/proxy.ts',
  ]) {
    it(`\`${fichero}\` es código de aplicación`, () => {
      expect(tocanCodigoDeAplicacion([fichero], RUTAS)).toEqual([fichero]);
    });
  }

  for (const fichero of [
    'docs/adr/ADR-024-lo-que-sea.md',
    'docs/epicas/EPIC-004/SPEC-038.ledger.md',
    'README.md',
    'FOUNDATION.md',
    '_qa/SPEC-038/pie.png',
  ]) {
    it(`\`${fichero}\` no lo es`, () => {
      expect(tocanCodigoDeAplicacion([fichero], RUTAS)).toEqual([]);
    });
  }

  it('un fichero que EMPIEZA como una ruta vigilada pero no lo está no cuenta', () => {
    // `srcado/` no es `src/`. La comparación es por segmento de ruta, no por prefijo
    // de cadena, que es como se cuelan los falsos positivos.
    expect(tocanCodigoDeAplicacion(['srcado/cosa.ts'], ['src/'])).toEqual([]);
  });

  it('con separadores de Windows también, porque git los normaliza pero el humano no', () => {
    expect(tocanCodigoDeAplicacion(['src\\lib\\version\\identity.ts'], RUTAS)).toHaveLength(1);
  });
});

describe('SPEC-038 CA-12: el veredicto', () => {
  const CODIGO = ['src/lib/version/identity.ts'];
  const DOCS = ['docs/adr/ADR-024.md', 'docs/tablero.md'];

  it('toca código y SUBE el número -> pasa', () => {
    const veredicto = evaluar({
      ficheros: CODIGO,
      versionBase: '0.1.0',
      versionRama: '0.2.0',
      rutas: RUTAS,
    });
    expect(veredicto.salida).toBe(SALIDA.LIMPIO);
    expect(veredicto.motivo).toBe('subida');
  });

  it('toca código y NO sube el número -> falla', () => {
    const veredicto = evaluar({
      ficheros: CODIGO,
      versionBase: '0.1.0',
      versionRama: '0.1.0',
      rutas: RUTAS,
    });
    expect(veredicto.salida).toBe(SALIDA.MARCADO);
    expect(veredicto.motivo).toBe('sin-subir');
  });

  it('el mensaje del fallo dice QUÉ hacer, con el comando exacto', () => {
    const { mensaje } = evaluar({
      ficheros: CODIGO,
      versionBase: '0.1.0',
      versionRama: '0.1.0',
      rutas: RUTAS,
    });
    // Un gate que dice "no" sin decir cómo salir de ahí se rodea, no se cumple.
    expect(mensaje).toContain('npm version');
    expect(mensaje).toContain('--no-git-tag-version');
    expect(mensaje).toContain('0.1.0');
    // Y enseña QUÉ fichero lo disparó, para que nadie tenga que adivinarlo.
    expect(mensaje).toContain('src/lib/version/identity.ts');
  });

  it('solo documentación -> pasa sin exigir nada', () => {
    const veredicto = evaluar({
      ficheros: DOCS,
      versionBase: '0.1.0',
      versionRama: '0.1.0',
      rutas: RUTAS,
    });
    expect(veredicto.salida).toBe(SALIDA.LIMPIO);
    expect(veredicto.motivo).toBe('sin-codigo');
  });

  it('un diff vacío -> pasa', () => {
    const veredicto = evaluar({
      ficheros: [],
      versionBase: '0.1.0',
      versionRama: '0.1.0',
      rutas: RUTAS,
    });
    expect(veredicto.salida).toBe(SALIDA.LIMPIO);
  });

  it('la versión BAJA -> falla, aunque el diff sea solo documentación', () => {
    // El rebase mal resuelto. Bajar el número no es "no subirlo": es afirmar que
    // este artefacto es anterior al que ya está en main. Por eso no depende de qué
    // ficheros se tocaron.
    const veredicto = evaluar({
      ficheros: DOCS,
      versionBase: '0.2.0',
      versionRama: '0.1.0',
      rutas: RUTAS,
    });
    expect(veredicto.salida).toBe(SALIDA.MARCADO);
    expect(veredicto.motivo).toBe('bajada');
  });

  it('la versión baja tocando código -> falla igual', () => {
    expect(
      evaluar({ ficheros: CODIGO, versionBase: '0.2.0', versionRama: '0.1.0', rutas: RUTAS })
        .salida,
    ).toBe(SALIDA.MARCADO);
  });

  it('una versión con forma inválida en la rama -> falla, y lo dice', () => {
    const veredicto = evaluar({
      ficheros: CODIGO,
      versionBase: '0.1.0',
      versionRama: '0.2.0-rc1',
      rutas: RUTAS,
    });
    expect(veredicto.salida).toBe(SALIDA.MARCADO);
    expect(veredicto.motivo).toBe('semver-invalido');
    // Y con motivo: un semver que `resolveIdentity` no acepta saldría como
    // `unknown` en el pie y en /api/version (CA-8).
    expect(veredicto.mensaje).toContain('0.2.0-rc1');
  });

  it('una versión con forma inválida en la base -> falla también', () => {
    expect(
      evaluar({ ficheros: CODIGO, versionBase: 'latest', versionRama: '0.2.0', rutas: RUTAS })
        .motivo,
    ).toBe('semver-invalido');
  });
});

describe('SPEC-038 CA-12: el gate corre de verdad sobre este repositorio', () => {
  /** Ejecuta el script como lo ejecuta la CI, y devuelve código y salida. */
  function ejecutar(args: string[] = []) {
    try {
      const stdout = execFileSync(process.execPath, [scriptPath, ...args], {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { codigo: 0, salida: stdout };
    } catch (error) {
      const e = error as { status?: number; stdout?: string; stderr?: string };
      return { codigo: e.status ?? -1, salida: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  }

  it('--help explica el gate y sale con 0', () => {
    const { codigo, salida } = ejecutar(['--help']);
    expect(codigo).toBe(SALIDA.LIMPIO);
    expect(salida).toContain('npm version');
  });

  it('una bandera desconocida es un error de USO (2), no un veredicto', () => {
    expect(ejecutar(['--que-es-esto']).codigo).toBe(SALIDA.USO);
  });

  it('una base que no existe es un error de USO (2): un gate que no puede comparar NO dice verde', () => {
    const { codigo, salida } = ejecutar(['--base', 'refs/heads/rama-que-no-existe-jamas']);
    expect(codigo).toBe(SALIDA.USO);
    expect(salida).toContain('rama-que-no-existe-jamas');
  });

  it('comparada consigo misma no hay diff, así que pasa', () => {
    const { codigo } = ejecutar(['--base', 'HEAD']);
    expect(codigo).toBe(SALIDA.LIMPIO);
  });

  it('esta rama pasa el gate: toca código de aplicación y sube el número', () => {
    // El gate se aplica a la rama que lo introduce, igual que el CI de SPEC-027 se
    // verificaba a sí mismo. Si esto se pone rojo, es que falta el `npm version`.
    const { codigo, salida } = ejecutar();
    expect(codigo, salida).toBe(SALIDA.LIMPIO);
  });
});

describe('SPEC-038 CA-12: el script no hace nada que no le toque', () => {
  const fuente = () => readFileSync(scriptPath, 'utf8');

  it('solo importa de `node:*`, como la guardia y como check-alive', () => {
    const especificadores = [...fuente().matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    expect(especificadores.length).toBeGreaterThan(0);
    for (const spec of especificadores) expect(spec.startsWith('node:')).toBe(true);
  });

  it('no sale a la red: ni un fetch, ni una URL', () => {
    expect(fuente()).not.toMatch(/\bfetch\s*\(/);
    expect(fuente()).not.toMatch(/https?:\/\//);
  });

  it('no escribe en el árbol: lee y juzga, no arregla', () => {
    // Un gate que sube el número por su cuenta escribiría en la rama por la
    // espalda — la alternativa que ADR-024 rechaza explícitamente.
    expect(fuente()).not.toMatch(/writeFileSync|appendFileSync|writeFile|mkdirSync/);
  });

  it('nunca invoca `git` para escribir', () => {
    const subcomandos = [...fuente().matchAll(/git\(\[\s*'([a-z-]+)'/g)].map((m) => m[1]);
    expect(subcomandos.length).toBeGreaterThan(0);
    for (const sub of subcomandos) expect(['diff', 'show', 'rev-parse']).toContain(sub);
  });
});

describe('SPEC-038 CA-13: el gate se declara donde este proyecto declara sus gates', () => {
  const paso = () => steps().find((s) => s.name === 'Version bump');

  it('existe un step con nombre propio, no una línea dentro de otro', () => {
    // El requisito del humano en SPEC-027: el nombre del check rojo tiene que
    // decir qué se rompió. "Unit tests" no dice "alguien tocó código sin subir
    // la versión".
    expect(paso(), 'No existe el step `Version bump` en .github/workflows/ci.yml').toBeDefined();
  });

  it('ejecuta `npm run version:check` y solo eso', () => {
    expect(paso()!.run!.trim()).toBe('npm run version:check');
    expect(paso()!.run).not.toMatch(/&&|\|\||;/);
  });

  it('vive en el job Checks, con los demás gates de lógica', () => {
    const checks = jobs().find((j) => j.name === 'Checks')!;
    expect(checks.steps.map((s) => s.name)).toContain('Version bump');
  });

  it('lleva `if: !cancelled()`: un gate roto no puede ocultar a los demás', () => {
    expect(paso()!.if ?? '').toMatch(/!\s*cancelled\(\)/);
  });

  it('el checkout de ese job trae el histórico: sin `origin/main` no hay con qué comparar', () => {
    const checks = jobs().find((j) => j.name === 'Checks')!;
    const checkout = checks.steps.find((s) => (s.uses ?? '').startsWith('actions/checkout'))!;
    expect(
      String(checkout.with?.['fetch-depth']),
      'Con el clonado superficial por defecto `origin/main` no existe en el runner, ' +
        'y el gate saldría con 2 (no puede comparar) en vez de comparar.',
    ).toBe('0');
  });

  it('el gate NO invoca check-alive: la puerta post-deploy es otra cosa (CA-15)', () => {
    expect(paso()!.run).not.toMatch(/check-alive/);
  });

  it('el gate no habla con ningún host externo', () => {
    expect(paso()!.run).not.toMatch(/https?:\/\//);
  });

  it('vercel.json no cambia por culpa de este gate', () => {
    expect(JSON.parse(readFileSync(join(rootDir, 'vercel.json'), 'utf8'))).toEqual({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      buildCommand: 'node scripts/guard-migrate.mjs && npm run db:migrate && npm run build',
      crons: [{ path: '/api/cron/refresh', schedule: '0 22 * * *' }],
    });
  });

  it('package.json expone `version:check` y apunta a este fichero', () => {
    const { scripts } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(scripts['version:check']).toBe('node scripts/check-version-bump.mjs');
  });
});

describe('SPEC-038 CA-14: la cuarta clave del canal tampoco se configura', () => {
  it('`STOCKEIRO_VERSION` no aparece en .env.example ni en el workflow', () => {
    expect(readFileSync(join(rootDir, '.env.example'), 'utf8')).not.toContain(
      'STOCKEIRO_VERSION',
    );
    expect(workflowSource()).not.toContain('STOCKEIRO_VERSION');
  });
});

describe('SPEC-049 CA-1: el contraste con lo pendiente, como función pura', () => {
  /**
   * El defecto del 2026-08-23 (PR #56): el gate juzga COMMITS, así que con el trabajo
   * todavía en el árbol el rango `base...HEAD` está vacío, `evaluar` devuelve
   * `sin-codigo` y el script sale con **0**. Ese 0 se citó en un mensaje de commit y en
   * el cuerpo de una PR; la CI lo desmintió después sobre los mismos ficheros.
   *
   * La regla de CA-1 no mira si el árbol está sucio: mira si la suciedad **cambiaría el
   * veredicto**. Forma el veredicto dos veces con las MISMAS dos versiones commiteadas y
   * la misma base, cambiando sólo la lista de ficheros (diff vs. diff ∪ pendientes), y
   * compara el **código de salida** —no el motivo—, que es lo que se consume aguas
   * arriba. Se prueba caso a caso sin invocar git, igual que `evaluar` (SPEC-038 CA-12).
   */
  const CODIGO = ['src/lib/version/identity.ts'];
  const DOCS = ['docs/adr/ADR-024.md', 'docs/tablero.md'];
  const PENDIENTE_APP = ['src/lib/version/a-medio-escribir.ts'];

  const contrastar = (entrada: Partial<Parameters<typeof evaluarConPendientes>[0]> = {}) =>
    evaluarConPendientes({
      ficheros: DOCS,
      pendientes: [],
      versionBase: '0.1.0',
      versionRama: '0.1.0',
      rutas: RUTAS,
      ...entrada,
    });

  const LOS_CINCO_MOTIVOS = [
    { motivo: 'sin-codigo', ficheros: DOCS, versionBase: '0.1.0', versionRama: '0.1.0' },
    { motivo: 'subida', ficheros: CODIGO, versionBase: '0.1.0', versionRama: '0.2.0' },
    { motivo: 'sin-subir', ficheros: CODIGO, versionBase: '0.1.0', versionRama: '0.1.0' },
    { motivo: 'bajada', ficheros: CODIGO, versionBase: '0.2.0', versionRama: '0.1.0' },
    { motivo: 'semver-invalido', ficheros: CODIGO, versionBase: '0.1.0', versionRama: 'v2' },
  ] as const;

  for (const caso of LOS_CINCO_MOTIVOS) {
    it(`CA-7 — sin nada pendiente, \`${caso.motivo}\` sale exactamente como hoy`, () => {
      const { ficheros, versionBase, versionRama } = caso;
      const hoy = evaluar({ ficheros: [...ficheros], versionBase, versionRama, rutas: RUTAS });
      const ahora = contrastar({ ficheros: [...ficheros], versionBase, versionRama, pendientes: [] });
      expect(ahora.salida).toBe(hoy.salida);
      expect(ahora.motivo).toBe(hoy.motivo);
      expect(ahora.mensaje).toBe(hoy.mensaje);
      expect(ahora.tocados).toEqual(hoy.tocados);
    });
  }

  it('lo pendiente que no cambia el código de salida no cambia nada: emite el primero tal cual', () => {
    // Docs, specs, ledgers, el `package.json` del `npm version` sin commitear: la unión
    // no mueve `tocados`, así que el veredicto es el mismo que hoy.
    const hoy = evaluar({
      ficheros: DOCS,
      versionBase: '0.1.0',
      versionRama: '0.1.0',
      rutas: RUTAS,
    });
    const ahora = contrastar({ pendientes: ['docs/roadmap.md', 'package.json', 'tests/x.test.ts'] });
    expect(ahora.salida).toBe(hoy.salida);
    expect(ahora.motivo).toBe(hoy.motivo);
    expect(ahora.mensaje).toBe(hoy.mensaje);
  });

  it('el falso verde del 2026-08-23: `sin-codigo` que al commitear sería `sin-subir` -> 2', () => {
    const veredicto = contrastar({ ficheros: DOCS, pendientes: PENDIENTE_APP });
    expect(veredicto.salida).toBe(SALIDA.USO);
    expect(veredicto.motivo).toBe('pendiente-sin-commitear');
    // Y no emite NINGUNO de los dos veredictos, ni siquiera su texto.
    expect(veredicto.mensaje).not.toContain('El diff no toca codigo de aplicacion');
  });

  it('el diff vacío de quien ejecuta el gate antes de commitear -> 2 igual', () => {
    // La reproducción literal: la rama todavía sin commits, todo el trabajo en el árbol.
    const veredicto = contrastar({ ficheros: [], pendientes: PENDIENTE_APP });
    expect(veredicto.salida).toBe(SALIDA.USO);
    expect(veredicto.motivo).toBe('pendiente-sin-commitear');
  });

  it('se compara el CÓDIGO de salida, no el motivo: `sin-codigo` que sería `subida` emite el primero', () => {
    // CA-4 por la vía pura. Los dos motivos difieren —`sin-codigo` y `subida`— pero los
    // dos son 0: commitear esos ficheros no puede convertir un verde en rojo, así que
    // abstenerse aquí sería bloquear a quien ya hizo lo que ADR-024 pide.
    const veredicto = contrastar({
      ficheros: DOCS,
      pendientes: PENDIENTE_APP,
      versionBase: '0.1.0',
      versionRama: '0.2.0',
    });
    expect(veredicto.salida).toBe(SALIDA.LIMPIO);
    expect(veredicto.motivo).toBe('sin-codigo');
  });

  it('CA-5 — un `sin-subir` con código pendiente sigue siendo el `1` completo', () => {
    const hoy = evaluar({
      ficheros: CODIGO,
      versionBase: '0.1.0',
      versionRama: '0.1.0',
      rutas: RUTAS,
    });
    const veredicto = contrastar({ ficheros: CODIGO, pendientes: PENDIENTE_APP });
    expect(veredicto.salida).toBe(SALIDA.MARCADO);
    expect(veredicto.motivo).toBe('sin-subir');
    // Con su mensaje entero: el mejor diagnóstico que el script sabe dar no se degrada
    // a una negativa.
    expect(veredicto.mensaje).toBe(hoy.mensaje);
    expect(veredicto.mensaje).toContain('src/lib/version/identity.ts');
  });

  it('CA-5 — y un `bajada` o un `semver-invalido` tampoco se degradan', () => {
    expect(
      contrastar({ ficheros: DOCS, pendientes: PENDIENTE_APP, versionBase: '0.2.0' }).motivo,
    ).toBe('bajada');
    expect(
      contrastar({ ficheros: DOCS, pendientes: PENDIENTE_APP, versionRama: '0.2.0-rc1' }).motivo,
    ).toBe('semver-invalido');
  });

  it('CA-3 — sólo lo que se le pasa como pendiente cuenta: la lista es la que decide', () => {
    // Lo que `.gitignore` excluye no llega hasta aquí —lo filtra `git status`—, y sin
    // pendientes la función es la de hoy. Que la parte pura no invente nada es lo que
    // permite probar el filtro donde vive: en la lectura del árbol.
    expect(contrastar({ ficheros: DOCS, pendientes: [] }).salida).toBe(SALIDA.LIMPIO);
  });

  it('CA-9 — devuelve los pendientes de aplicación, para que main pueda decir cuántos son', () => {
    const veredicto = contrastar({
      ficheros: DOCS,
      pendientes: ['docs/roadmap.md', ...PENDIENTE_APP],
      versionRama: '0.2.0',
    });
    expect(veredicto.pendientes).toEqual(PENDIENTE_APP);
  });

  it('CA-8 — el mensaje de la abstención: se distingue, nombra, dice la salida y no habla de la versión', () => {
    const muchos = Array.from({ length: 12 }, (_, i) => `src/pendiente-${i}.ts`);
    const { mensaje } = contrastar({ ficheros: DOCS, pendientes: muchos });
    // 1. Frase propia: ni «Bandera desconocida» ni «No hay con que comparar».
    expect(mensaje).toContain('pendiente sin commitear');
    // 2. Nombra los ficheros, con el mismo recorte y el mismo formato que `sin-subir`.
    expect(mensaje).toContain('  · src/pendiente-0.ts');
    expect(mensaje).toContain('  · src/pendiente-9.ts');
    expect(mensaje).not.toContain('src/pendiente-10.ts');
    expect(mensaje).toContain('y 2 mas.');
    // 3. Dice la salida.
    expect(mensaje).toMatch(/commitea/i);
    // 4. Y no afirma nada sobre la versión: no es un veredicto, es la negativa a emitir
    //    uno, y sugerir aquí el remedio del `1` sería inventarse el veredicto que falta.
    expect(mensaje).not.toContain('npm version');
    expect(mensaje).not.toMatch(/\bsub[ei]\w*/i);
  });
});
