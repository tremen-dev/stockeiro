import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-032 CA-13 — el runbook explica las dos guardias, y deja de mentir sobre
 * Preview.
 *
 * `docs/despliegue.md` es la única documentación operativa del proyecto, y hoy
 * describe un `buildCommand` que deja de ser el vigente y una `DATABASE_URL`
 * compartida entre Production y Preview que ya no lo está (F-SPEC-023-1 se cerró
 * el 2026-08-18 con *preview branching* de Neon). Un runbook que describe un
 * estado que no existe es peor que no tenerlo: se sigue al pie de la letra.
 *
 * Como en `tests/runbook-check-alive.test.ts`, el documento se trocea por
 * secciones y cada cosa se comprueba donde tiene que estar: un `toContain` sobre
 * el fichero entero casaría igual con una mención de pasada.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runbookPath = join(rootDir, 'docs', 'despliegue.md');

const source = () => readFileSync(runbookPath, 'utf8');

const BUILD_COMMAND_NUEVO =
  'node scripts/guard-migrate.mjs && npm run db:migrate && npm run build';
const BUILD_COMMAND_VIEJO = 'npm run db:migrate && npm run build';

/** Todo lo que hay antes de la primera sección `##`: cabecera y estado. */
function preambulo(): string {
  return source().split(/^## /m)[0];
}

/** Encabezado `## …` -> cuerpo de esa sección. */
function secciones(): Map<string, string> {
  const partes = source().split(/^## /m).slice(1);
  return new Map(
    partes.map((parte) => {
      const salto = parte.indexOf('\n');
      return [parte.slice(0, salto).trim(), parte.slice(salto + 1)];
    }),
  );
}

/** Encabezado `### …` -> cuerpo. La nota sobre Preview vive un nivel más abajo. */
function subsecciones(): Map<string, string> {
  const partes = source().split(/^### /m).slice(1);
  return new Map(
    partes.map((parte) => {
      const salto = parte.indexOf('\n');
      return [parte.slice(0, salto).trim(), parte.slice(salto + 1)];
    }),
  );
}

function seccionQueCumple(predicado: (titulo: string) => boolean, pista: string): [string, string] {
  const encontrada = [...secciones().entries()].find(([titulo]) => predicado(titulo));
  expect(encontrada, pista).toBeDefined();
  return encontrada!;
}

function subseccionQueCumple(
  predicado: (titulo: string) => boolean,
  pista: string,
): [string, string] {
  const encontrada = [...subsecciones().entries()].find(([titulo]) => predicado(titulo));
  expect(encontrada, pista).toBeDefined();
  return encontrada!;
}

const notaSobrePreview = () =>
  subseccionQueCumple(
    (t) => /Preview/i.test(t) && /BD|base/i.test(t),
    'No existe la nota sobre Preview y la BD de producción',
  )[1];

const seccionDeGuardias = () =>
  seccionQueCumple(
    (t) => /guardia/i.test(t),
    'No hay ninguna sección que documente las dos guardias de migración (CA-13.1)',
  )[1];

describe('SPEC-032 CA-13.1: hay una sección que documenta las dos guardias', () => {
  it('cita el buildCommand nuevo, con la guardia delante', () => {
    expect(seccionDeGuardias()).toContain(BUILD_COMMAND_NUEVO);
  });

  it('documenta la tabla de decisión de la guardia con sus códigos de salida', () => {
    const cuerpo = seccionDeGuardias();
    expect(cuerpo).toContain('VERCEL_ENV');
    for (const codigo of ['0', '1', '2']) {
      expect(
        cuerpo,
        `El código de salida ${codigo} de la guardia no está documentado. Los tres ` +
          'son el contrato: cualquier valor distinto de 0 corta el && del buildCommand.',
      ).toMatch(new RegExp(`(^|\\n)[^\\n]*\\|\\s*\\*\\*${codigo}\\*\\*\\s*\\|`));
    }
  });

  it('explica ALLOW_MIGRATE: qué es, dónde debe existir y qué pasa si falta', () => {
    const cuerpo = seccionDeGuardias();
    expect(cuerpo).toContain('ALLOW_MIGRATE');
    expect(cuerpo).toMatch(/ALLOW_MIGRATE\s*=\s*1|`ALLOW_MIGRATE=1`/);
    expect(cuerpo, 'No dice en qué entorno de Vercel debe existir').toMatch(/Preview/i);
    expect(cuerpo, 'No dice qué pasa si falta').toMatch(/si falta|si no est[áa]|sin ella/i);
  });

  it('documenta el escáner y cómo se escribe un desbloqueo', () => {
    const cuerpo = seccionDeGuardias();
    expect(cuerpo).toContain('db:scan');
    expect(cuerpo).toContain('drizzle/destructive-waivers.json');
    for (const clave of ['spec', 'reason', 'rollback', 'statements']) {
      expect(cuerpo, `El desbloqueo documentado no menciona "${clave}"`).toContain(clave);
    }
  });

  it('alcance estricto: el despliegue automático NO es esta spec', () => {
    // La documentación es de uso manual y de contrato. El runbook no describe
    // despliegue automático, ni conexión a Vercel, ni puerta post-deploy.
    expect(seccionDeGuardias()).toContain('SPEC-028');
  });

  it('deja escrito que poner ALLOW_MIGRATE en Preview es una acción de ops pendiente', () => {
    expect(seccionDeGuardias()).toMatch(/vercel env add|acci[óo]n de ops/i);
  });
});

describe('SPEC-032 CA-13.2: §1.1 y §6 quedan al día', () => {
  it('el buildCommand viejo ya no se cita como el vigente en ninguna parte', () => {
    // El viejo es subcadena del nuevo, así que no basta con buscarlo: lo que se
    // exige es que toda aparición venga precedida de la guardia.
    const texto = source();
    let desde = 0;
    for (;;) {
      const i = texto.indexOf(BUILD_COMMAND_VIEJO, desde);
      if (i === -1) break;
      expect(
        texto.slice(Math.max(0, i - 40), i + BUILD_COMMAND_VIEJO.length),
        'El runbook sigue citando el buildCommand de antes de SPEC-032 como si fuera el vigente.',
      ).toContain('node scripts/guard-migrate.mjs && ');
      desde = i + 1;
    }
  });

  it('§1.1 cita el buildCommand nuevo', () => {
    const [, cuerpo] = seccionQueCumple((t) => t.startsWith('1.'), 'No existe la sección §1');
    expect(cuerpo).toContain(BUILD_COMMAND_NUEVO);
  });

  it('§1.1 aclara que el camino manual de db:migrate sigue sin guardia', () => {
    const [, cuerpo] = seccionQueCumple((t) => t.startsWith('1.'), 'No existe la sección §1');
    expect(cuerpo).toContain('npm run db:migrate');
    expect(cuerpo).toMatch(/guardia/i);
  });

  it('§6 ya no dice que un Preview migre "la BD a la que apunte" sin más', () => {
    const [, cuerpo] = seccionQueCumple((t) => t.startsWith('6.'), 'No existe la sección §6');
    expect(cuerpo).toMatch(/preview branching|rama .* de Neon/i);
    expect(cuerpo).toContain('guard-migrate');
    expect(
      cuerpo,
      'El gotcha de Preview sigue describiendo la Neon compartida como estado actual.',
    ).not.toMatch(/Si el entorno\s+\*?Preview\*?\s+comparte la Neon de producción/);
  });
});

describe('SPEC-032 CA-13.3: F-SPEC-023-1 deja de figurar como pendiente', () => {
  it('la cabecera lo marca cerrado, con su fecha', () => {
    const cabecera = preambulo();
    const linea = cabecera.split('\n').find((l) => l.includes('F-SPEC-023-1'));
    expect(linea, 'F-SPEC-023-1 ha desaparecido de la cabecera en vez de cerrarse').toBeDefined();
    expect(linea!, 'Sigue marcado como pendiente').not.toContain('⏳');
    expect(linea!).toContain('✅');
    expect(cabecera).toMatch(/F-SPEC-023-1[^\n]*2026-08-18|2026-08-18[^\n]*F-SPEC-023-1/);
  });

  it('la nota sobre Preview ya no describe una DATABASE_URL compartida como estado actual', () => {
    const cuerpo = notaSobrePreview();
    expect(cuerpo).toMatch(/preview branching/i);
    expect(cuerpo).toMatch(/copy-on-write|rama/i);
    expect(
      cuerpo,
      'Sigue diciendo que un build de Preview migraría producción, que ya no es el estado de hoy.',
    ).not.toMatch(/\*\*un build de Preview migrar[íi]a producción\*\*/);
  });

  it('y explica que la guardia es la segunda línea, que no depende de ese ajuste', () => {
    expect(notaSobrePreview()).toContain('guard-migrate');
  });
});

describe('SPEC-032 CA-13: el runbook nombra las tres piezas nuevas', () => {
  it('aparecen guard-migrate, ALLOW_MIGRATE y db:scan', () => {
    for (const pieza of ['guard-migrate', 'ALLOW_MIGRATE', 'db:scan']) {
      expect(source(), `El runbook no menciona ${pieza}`).toContain(pieza);
    }
  });

  it('la tabla de checks de §9 incluye el gate nuevo', () => {
    const [, cuerpo] = seccionQueCumple((t) => t.startsWith('9.'), 'No existe la sección §9');
    expect(cuerpo).toContain('Migration scan');
  });
});
