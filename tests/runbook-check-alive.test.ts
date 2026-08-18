import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-031 CA-12 — el truco del `curl | grep` muere en el runbook.
 *
 * El paso 8 de §8 prescribía hoy un `curl` del HTML público de `/forgot-password`
 * canalizado a un `grep -o` de esa misma cadena.
 * Funciona una vez, para una spec, si a alguien se le ocurre una cadena que solo
 * exista tras ese cambio. No es reutilizable, no distingue "no está desplegado"
 * de "el HTML cambió de forma", y hay que inventarlo de nuevo en cada entrega.
 *
 * El test trocea el documento por secciones y comprueba cada cosa donde tiene
 * que estar, en vez de pasarle un regex al fichero entero: un `toContain` sobre
 * todo el runbook casaría igual con una mención de pasada.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runbookPath = join(rootDir, 'docs', 'despliegue.md');

const source = () => readFileSync(runbookPath, 'utf8');

/** Todo lo que hay antes de la primera sección `##`: cabecera y lección. */
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

function seccionQueCumple(predicado: (titulo: string) => boolean): [string, string] {
  const encontrada = [...secciones().entries()].find(([titulo]) => predicado(titulo));
  expect(encontrada, 'No hay ninguna sección que documente /api/version').toBeDefined();
  return encontrada!;
}

describe('SPEC-031 CA-12: el runbook retira el truco y documenta su sustituto', () => {
  it('el `curl | grep` de una cadena inventada ya no aparece en ninguna parte', () => {
    expect(source()).not.toContain('grep -o "forgot-password"');
    expect(source()).not.toMatch(/curl[^\n]*\|\s*grep/);
  });

  it('el paso de "comprueba que está VIVO" de §8 invoca check-alive', () => {
    const [, cuerpo] = seccionQueCumple((t) => t.startsWith('8.'));
    expect(cuerpo).toContain('scripts/check-alive.mjs');
  });

  it('existe una sección que documenta el contrato de /api/version', () => {
    const [, cuerpo] = seccionQueCumple((t) => /versi[oó]n/i.test(t) && /api|vivo/i.test(t));
    expect(cuerpo).toContain('/api/version');
    for (const clave of ['commit', 'environment', 'builtAt']) {
      expect(cuerpo).toContain(clave);
    }
  });

  it('esa sección documenta los cuatro códigos de salida, uno por uno', () => {
    const [, cuerpo] = seccionQueCumple((t) => /versi[oó]n/i.test(t) && /api|vivo/i.test(t));
    for (const codigo of ['0', '1', '2', '3']) {
      expect(
        cuerpo,
        `El código de salida ${codigo} no está documentado. Los cuatro son el ` +
          'contrato que SPEC-028 va a consumir.',
      ).toMatch(new RegExp(`(^|\\n)[^\\n]*\\|\\s*\\*\\*${codigo}\\*\\*\\s*\\|`));
    }
    expect(cuerpo).toContain('unknown');
  });

  it('la sección deja escrito que el despliegue automático NO es esta spec', () => {
    // Alcance estricto de CA-12: la documentación es de uso MANUAL. El runbook no
    // describe despliegue automático, ni puerta post-deploy, ni conexión a Vercel.
    const [, cuerpo] = seccionQueCumple((t) => /versi[oó]n/i.test(t) && /api|vivo/i.test(t));
    expect(cuerpo).toContain('SPEC-028');
  });

  it('la lección del 2026-08-11 deja de recomendar el curl del HTML y apunta aquí', () => {
    const cabecera = preambulo();
    expect(cabecera).toContain('LECCIÓN DEL 2026-08-11');
    expect(cabecera).not.toMatch(/buscando una clase o cadena/);
    expect(cabecera).toContain('check-alive');
  });
});
