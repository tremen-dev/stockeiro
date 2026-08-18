import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-028 CA-11, CA-12 y CA-13 — el runbook reescrito.
 *
 * `docs/despliegue.md` describe hasta esta spec un mundo que ADR-018 D-1 deroga:
 * §3.4 dice que se despliega con `vercel` / `vercel --prod`, y §5 lleva un
 * `vercel --prod verde` en el checklist. Es el documento que más cambia de todo
 * el diff, y por eso lleva tres CA en vez de una nota.
 *
 * Como en `tests/runbook-check-alive.test.ts` y
 * `tests/runbook-guardias-migracion.test.ts`, el documento se trocea por
 * secciones y cada cosa se comprueba **donde tiene que estar**: un `toContain`
 * sobre el fichero entero casaría igual con una mención de pasada, y aquí
 * justamente lo que se juzga es dónde se lee cada aviso.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runbookPath = join(rootDir, 'docs', 'despliegue.md');

const source = () => readFileSync(runbookPath, 'utf8');

/** Todo lo que hay antes de la primera sección `##`: cabecera y lección. */
function preambulo(): string {
  return source().split(/^## /m)[0];
}

function trocear(texto: string, marca: RegExp, corte?: RegExp): Map<string, string> {
  const partes = texto.split(marca).slice(1);
  return new Map(
    partes.map((parte) => {
      const salto = parte.indexOf('\n');
      const cuerpo = parte.slice(salto + 1);
      return [parte.slice(0, salto).trim(), corte ? cuerpo.split(corte)[0] : cuerpo];
    }),
  );
}

const secciones = () => trocear(source(), /^## /m);
/** Una subsección acaba en la siguiente `###` —que el `split` ya consume— o en la
 *  siguiente `##`. Sin ese corte, el cuerpo de §3.4 se comería §4, §5, §6 y §7,
 *  y este test afirmaría sobre secciones que no está juzgando. */
const subsecciones = () => trocear(source(), /^### /m, /^## /m);

function queCumple(mapa: Map<string, string>, predicado: (t: string) => boolean, pista: string) {
  const encontrada = [...mapa.entries()].find(([titulo]) => predicado(titulo));
  expect(encontrada, pista).toBeDefined();
  return encontrada![1];
}

const seccion = (predicado: (t: string) => boolean, pista: string) =>
  queCumple(secciones(), predicado, pista);
const subseccion = (predicado: (t: string) => boolean, pista: string) =>
  queCumple(subsecciones(), predicado, pista);

/** §3.4 — el apartado que hasta hoy decía "así se despliega". */
const desplegar = () =>
  subseccion((t) => t.startsWith('3.4'), 'Ha desaparecido §3.4, el apartado de desplegar');

/** La sección nueva de CA-12: el pipeline entero y qué hacer con el rojo. */
const pipeline = () =>
  seccion(
    (t) => /puerta/i.test(t),
    'No hay ninguna sección que documente la puerta post-deploy y el pipeline (CA-12)',
  );

/** La sección nueva de CA-13: lo que se configura fuera del repositorio. */
const ops = () =>
  seccion(
    (t) => /fuera del repositorio|acciones de ops|configuraci[óo]n de plataforma/i.test(t),
    'No hay ninguna sección que documente la configuración que no vive en el repo (CA-13)',
  );

const checklist = () => seccion((t) => t.startsWith('5.'), 'No existe la sección §5');
const gotchas = () => seccion((t) => t.startsWith('6.'), 'No existe la sección §6');

describe('SPEC-028 CA-11: el despliegue manual deja de ser la vía normal', () => {
  it('11.1 — §3.4 describe que un merge a main construye y despliega a producción', () => {
    const cuerpo = desplegar();
    expect(cuerpo).toMatch(/merge[^\n]*`?main`?/i);
    expect(cuerpo).toMatch(/despliega|despliegue/i);
    expect(cuerpo).toMatch(/producci[óo]n/i);
  });

  it('11.1 — y que cada PR obtiene un despliegue de Preview', () => {
    const cuerpo = desplegar();
    expect(cuerpo).toMatch(/\bPR\b|pull request/i);
    expect(cuerpo).toMatch(/Preview/);
  });

  it('11.1 — `vercel --prod` ya no se presenta como el procedimiento', () => {
    // Hasta esta spec, §3.4 eran dos lineas: `vercel` y `vercel --prod`, sin mas.
    const cuerpo = desplegar();
    expect(
      cuerpo,
      'Sigue habiendo una linea suelta de `vercel --prod` presentada como el paso normal.',
    ).not.toMatch(/^\s*vercel(\s+--prod)?\s*(#.*)?$/m);
  });

  it('11.2 — el comando de CLI se conserva marcado como recurso de emergencia', () => {
    const cuerpo = desplegar();
    expect(cuerpo).toContain('vercel --prod --archive=tgz');
    expect(
      cuerpo,
      'ADR-018 D-1: el despliegue por CLI "pasa a ser recurso de emergencia, y el ' +
        'runbook lo marcará como tal con su advertencia".',
    ).toMatch(/emergencia/i);
  });

  it('11.2 — con sus dos trampas ya documentadas: el falso "Not authorized" y el worktree', () => {
    const cuerpo = desplegar();
    expect(cuerpo).toMatch(/Not authorized/);
    expect(cuerpo).toMatch(/worktree/i);
  });

  it('11.2 — y con la consecuencia nueva: la puerta delata un despliegue por CLI', () => {
    // Un despliegue por CLI sube sin `.git`, asi que /api/version responde
    // `commit: unknown`. Deja de ser un detalle: es la firma de un despliegue
    // fuera de proceso, y la puerta lo pone en rojo con codigo 2.
    const cuerpo = desplegar();
    expect(cuerpo).toContain('unknown');
    expect(cuerpo).toMatch(/puerta/i);
    expect(cuerpo).toMatch(/fuera de proceso/i);
  });

  it('11.3 — la lección del 2026-08-11 no se borra, pero se actualiza', () => {
    const cabecera = preambulo();
    expect(cabecera, 'La lección es historia y es la razón de todo esto').toContain(
      'LECCIÓN DEL 2026-08-11',
    );
    expect(cabecera).toContain('check-alive');
    expect(cabecera, 'No dice que mergear ya es desplegar').toMatch(
      /mergear ya es desplegar|mergear\s+(pasa a ser|ya es)/i,
    );
    expect(cabecera, 'No dice que lo que hay que mirar ahora es el check de la puerta').toMatch(
      /puerta/i,
    );
  });
});

describe('SPEC-028 CA-12: la sección que documenta el pipeline entero', () => {
  it('12.1 — el disparador: merge a main → build en Vercel → producción; PR → Preview', () => {
    const cuerpo = pipeline();
    expect(cuerpo).toContain('guard-migrate');
    expect(cuerpo).toContain('db:migrate');
    expect(cuerpo).toMatch(/next build|npm run build/);
    expect(cuerpo).toMatch(/Preview/);
  });

  it('12.2 — la puerta: qué workflow es, contra qué dominio y con qué plazo', () => {
    const cuerpo = pipeline();
    expect(cuerpo).toContain('.github/workflows/deploy-gate.yml');
    expect(cuerpo).toContain('https://stockeiro.tremen.dev');
    expect(cuerpo).toMatch(/900|15 minutos/);
  });

  it('12.2 — y cómo se llama el check en la lista de GitHub', () => {
    // Sin el nombre, quien mire la PR no sabe cuál de los checks es la puerta.
    expect(pipeline()).toContain('Deploy gate / Alive');
  });

  it('12.3 — la tabla de reacción documenta los cuatro códigos de salida', () => {
    const cuerpo = pipeline();
    for (const codigo of ['0', '1', '2', '3']) {
      expect(
        cuerpo,
        `El código ${codigo} no está en la tabla de reacción. Los cuatro son el ` +
          'contrato de SPEC-031, y aquí es donde se dice qué hacer con cada uno.',
      ).toMatch(new RegExp(`(^|\\n)[^\\n]*\\|\\s*\\*\\*${codigo}\\*\\*\\s*\\|`));
    }
  });

  it('12.3 — y cada código dice qué mirar: la guardia, la CLI, el dominio', () => {
    const cuerpo = pipeline();
    expect(cuerpo, 'El 1 debe mandar a mirar en qué eslabón falló el build').toMatch(
      /migraci[óo]n|guardia/i,
    );
    expect(cuerpo, 'El 2 debe decir que alguien desplegó por CLI').toMatch(/CLI/);
    expect(cuerpo, 'El 3 debe mandar a mirar dominio y DNS').toMatch(/DNS/);
  });

  it('12.4 — dice que la puerta NO revierte nada, y cuál es el procedimiento manual', () => {
    const cuerpo = pipeline();
    expect(cuerpo).toMatch(/no revierte/i);
    expect(cuerpo).toContain('vercel rollback');
  });

  it('12.4 — con el límite escrito: devuelve el código, no el esquema', () => {
    const cuerpo = pipeline();
    expect(cuerpo).toMatch(/devuelve el c[óo]digo, no el esquema/i);
    expect(cuerpo, 'La red última es el historial de restauración de Neon').toMatch(
      /Neon/,
    );
    expect(cuerpo).toMatch(/restauraci[óo]n/i);
  });

  it('12.5 — dice que la CI informa pero NO impide, y que ya no queda ninguna persona', () => {
    // Es la única huella verificable de F-SPEC-028-1, el riesgo que el humano
    // aceptó en el gate del 2026-08-18 en contra de la recomendación del
    // arquitecto. Va sin suavizar, a propósito.
    const cuerpo = pipeline();
    expect(cuerpo).toMatch(/informa[^.]*(pero )?no impide|no impide mezclar/i);
    expect(
      cuerpo,
      'Falta lo que de verdad cambia con esta spec: entre un merge en rojo y ' +
        'producción no queda ninguna persona.',
    ).toMatch(/ninguna persona/i);
    expect(cuerpo).toContain('F-SPEC-028-1');
  });

  it('12.5 — y que nadie va a mirar el check por ti', () => {
    expect(pipeline()).toMatch(/nadie lo va a mirar por ti/i);
  });
});

describe('SPEC-028 CA-13: la configuración que no vive en el repo queda escrita', () => {
  it('13.1 — la conexión Git: repositorio, proyecto, rama de producción y cómo se comprueba', () => {
    const cuerpo = ops();
    expect(cuerpo).toContain('tremen-dev/stockeiro');
    expect(cuerpo).toMatch(/rama de producci[óo]n/i);
    expect(cuerpo).toContain('vercel project inspect');
    expect(cuerpo, 'Un despliegue conectado muestra Source con rama y commit').toMatch(
      /Source/,
    );
  });

  it('13.2 — ALLOW_MIGRATE en Preview, y qué pasa si falta', () => {
    const cuerpo = ops();
    expect(cuerpo).toContain('vercel env add ALLOW_MIGRATE preview');
    expect(cuerpo).toContain('F-SPEC-032-2');
    expect(
      cuerpo,
      'Si falta, TODAS las previews fallan en la guardia: en rojo y a propósito.',
    ).toMatch(/todas las previews/i);
  });

  it('13.3 — el preview branching de Neon y sus dos techos', () => {
    const cuerpo = ops();
    expect(cuerpo).toMatch(/preview branching/i);
    expect(cuerpo, 'El techo de 10 ramas del plan Free no está escrito').toMatch(
      /10 ramas/i,
    );
    expect(cuerpo, 'Las ramas de preview sobreviven al cierre de la PR').toMatch(
      /sobreviven|retenci[óo]n/i,
    );
    expect(cuerpo).toContain('F-SPEC-028-2');
  });

  it('13.3 — con su apartado de mantenimiento: revisar y borrar ramas viejas', () => {
    expect(ops()).toMatch(/borrar[^\n]*ramas|podar/i);
  });

  it('13.4 — y el orden, que importa: ALLOW_MIGRATE antes de conectar', () => {
    const cuerpo = ops();
    expect(cuerpo).toMatch(/ALLOW_MIGRATE[^\n]*antes de conectar|antes de conectar/i);
    expect(cuerpo, 'El atraso se drena antes que nada (gate del 2026-08-18)').toMatch(
      /drenar|atraso/i,
    );
  });

  it('13.5 — §5 deja de pedir `vercel --prod` verde y pide la puerta en verde', () => {
    const cuerpo = checklist();
    expect(
      cuerpo,
      'El checklist sigue pidiendo un `vercel --prod` verde, que ya no es la vía normal.',
    ).not.toMatch(/vercel --prod[^\n]*verde/);
    expect(cuerpo).toMatch(/puerta/i);
    expect(cuerpo).toMatch(/verde/i);
  });

  it('13.5 — §6 reencuadra el gotcha del worktree como firma de un despliegue fuera de proceso', () => {
    const cuerpo = gotchas();
    expect(cuerpo).toMatch(/worktree/i);
    expect(cuerpo).toMatch(/fuera de proceso/i);
  });
});

describe('SPEC-028 — el runbook no se contradice a sí mismo', () => {
  it('ninguna sección sigue presentando `vercel --prod` como el paso normal', () => {
    // El comando se conserva (es el recurso de emergencia y es como se drena el
    // atraso), pero siempre acompañado: nunca como una línea suelta de código.
    for (const [titulo, cuerpo] of secciones()) {
      expect(
        cuerpo,
        `§${titulo} presenta \`vercel --prod\` como una línea suelta, sin marcarlo.`,
      ).not.toMatch(/^\s*vercel --prod\s*$/m);
    }
  });

  it('la sección de /api/version ya no dice que el sha llegará "cuando SPEC-028 conecte"', () => {
    // SPEC-028 es esta. Dejarlo en futuro convierte el runbook en una promesa.
    const cuerpo = seccion(
      (t) => /versi[oó]n/i.test(t) && /api|vivo/i.test(t),
      'No existe la sección de /api/version',
    );
    expect(cuerpo).not.toMatch(/cuando\s+\*?\*?SPEC-028\*?\*?\s+conecte/i);
  });
});
