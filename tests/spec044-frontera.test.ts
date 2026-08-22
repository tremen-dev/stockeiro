import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CADENCIA_LINEA } from '@/lib/help/content';

/**
 * SPEC-044 rebanada 5 — **la frontera de la pantalla**, comprobada donde es binaria.
 *
 * Lo que se ve (que el panel abre, que los campos vienen cargados, que la tabla se
 * recalcula) lo mide `tests/e2e/vigiladas-editar.spec.ts` con un navegador de verdad.
 * Aquí viven las mitades que **no hace falta arrancar Postgres para saber**, y que son
 * justo las que se degradan sin que nadie se entere:
 *
 *  - que el panel de edición **reutiliza `WatchForm`** en vez de inventarse una segunda
 *    maquetación (CA-20) — que es lo que hace verdad «la edición no puede tener
 *    validación más floja» **por construcción**;
 *  - que en modo edición **no monta el buscador** y el activo no se puede cambiar (CA-19,
 *    ADR-028 pto. 8);
 *  - que la cadencia se dice con **la constante compartida** y no con una frase nueva
 *    (CA-22, SPEC-039 CA-3);
 *  - que el id viaja **con su fila** y no con su posición (CA-24).
 */

const raiz = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

/** El fuente sin comentarios: lo que la pantalla dice, no lo que el código se explica. */
const sinComentarios = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');

const TABLA = 'src/app/vigiladas/watched-table.tsx';
const FORM = 'src/app/vigiladas/watch-form.tsx';
const ALTA = 'src/app/vigiladas/alta-vigilada.tsx';
const CSS = 'src/app/globals.css';

describe('SPEC-044 CA-19/CA-20: el panel de edición reutiliza el formulario del alta', () => {
  it('la tabla monta `WatchForm`, no un formulario propio', () => {
    const src = raiz(TABLA);
    expect(src).toMatch(/from '\.\/watch-form'/);
    expect(src).toContain('<WatchForm');
  });

  it('los campos de zona se declaran en UN solo sitio: `watch-form.tsx`', () => {
    // Si apareciera un segundo `name="buyMin"` en otro componente, habría dos cajas que
    // mantener y dos sitios donde aflojar la validación (CA-20, nota 6 del gate).
    for (const campo of ['buyMin', 'buyMax', 'sellMin', 'sellMax']) {
      const enForm = [...raiz(FORM).matchAll(new RegExp(`name="${campo}"`, 'g'))];
      expect(enForm, `\`${campo}\` no se declara en ${FORM}`).toHaveLength(1);
      for (const otro of [TABLA, ALTA]) {
        expect(
          raiz(otro),
          `${otro} declara su propio campo \`${campo}\`: eso es una SEGUNDA maquetación ` +
            `del formulario de zonas, y CA-20 la prohíbe`,
        ).not.toContain(`name="${campo}"`);
      }
    }
  });

  it('en modo edición NO se monta el buscador de símbolos (el activo no se cambia)', () => {
    const src = raiz(FORM);
    // El buscador se monta UNA vez y en la rama de alta del ternario `edicion ? … : …`;
    // ADR-028 pto. 8: cambiar el símbolo sería otra vigilada, y la acción de edición ni
    // siquiera acepta símbolo.
    expect([...src.matchAll(/<SymbolSearch/g)]).toHaveLength(1);
    const abre = src.indexOf('{edicion ? (');
    const rama = src.indexOf(') : (', abre);
    const cierra = src.indexOf('</>\n      )}', rama);
    expect(abre, 'el formulario ya no distingue los dos modos con un ternario').toBeGreaterThan(-1);
    const soloAlta = src.slice(rama, cierra);
    expect(
      soloAlta,
      'el buscador no está en la rama de alta del ternario: en edición se montaría, y el ' +
        'activo no se puede cambiar (CA-19)',
    ).toContain('<SymbolSearch');
    // Y el `hidden` con el id de la vigilada vive en la OTRA rama.
    expect(src.slice(abre, rama)).toContain('name="watchedId"');
    expect(
      raiz('src/app/vigiladas/actions.ts'),
      'la action de edición no puede leer una selección de símbolo',
    ).not.toMatch(/editZonesAction[\s\S]*?readSymbolSelection/);
  });

  it('el panel no declara ancho propio (ADR-026, convención de SPEC-040)', () => {
    expect(raiz(TABLA)).not.toMatch(/style=\{\{[^}]*[Ww]idth/);
    const css = raiz(CSS);
    const desde = css.indexOf('.editar-vigilada');
    expect(desde, 'no se encontró la caja del panel de edición en globals.css').toBeGreaterThan(-1);
    const bloque = css.slice(desde, css.indexOf('}', desde));
    expect(
      bloque,
      'el panel de edición declara un ancho propio: la CAJA del formulario es territorio ' +
        'de SPEC-040 y este panel sólo decide CUÁNDO está en pantalla',
    ).not.toMatch(/(^|[^-])(max-|)width:\s*\d/);
  });
});

describe('SPEC-044 CA-22: la app dice cuándo llegará el aviso, con la frase de siempre', () => {
  it('usa `CADENCIA_LINEA` y no inventa una frase nueva', () => {
    const src = raiz(TABLA);
    expect(src).toMatch(/CADENCIA_LINEA/);
    expect(src).toMatch(/from '@\/lib\/help\/content'/);
    // Nada de prometer inmediatez ni de reescribir la cadencia a mano. Se mira el CÓDIGO,
    // no los comentarios: contar por qué existe la ventana de una cadencia no es
    // prometer que no la hay (mismo criterio que `geometria-guardias.test.ts`).
    const codigo = sinComentarios(src).toLowerCase();
    for (const prohibido of ['al instante', 'inmediat', 'en unos segundos', 'ahora mismo']) {
      expect(codigo, `la tabla promete «${prohibido}» por su cuenta`).not.toContain(prohibido);
    }
    expect(CADENCIA_LINEA).toContain('una vez al día');
  });
});

describe('SPEC-044 CA-24: el id viaja con su fila, no con su posición', () => {
  it('el control de editar lleva `r.id`, igual que el de quitar (SPEC-024)', () => {
    const src = raiz(TABLA);
    // El estado de edición se guarda por ID, nunca por índice del array ordenado: al
    // reordenar, un índice señalaría a otra vigilada.
    const codigo = sinComentarios(src);
    expect(codigo).toMatch(/setEditandoId\([^)]*r\.id/);
    expect(codigo).not.toMatch(/\.map\(\((?:r|fila),\s*(?:i|idx|index)\)/);
    expect(codigo).not.toMatch(/setEditandoId\((?:i|idx|index|posicion)\)/);
    expect(codigo).toContain('data-watched-id={r.id}');
    expect(codigo).toContain('value={r.id}'); // el hidden de `removeAction` sigue igual
    // Y el panel se resuelve buscando la fila POR ID, no por posición.
    expect(codigo).toMatch(/filas\.find\(\(f\) => f\.id === editandoId\)/);
  });
});
