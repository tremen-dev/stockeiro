import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * SPEC-040 CA-6 — **una sola guardia de geometría, compartida, en vez de cuatro copias
 * que se degradan**.
 *
 * ## Por qué esto es un test y no una nota en un ADR
 *
 * El proyecto escribió cuatro guardias de geometría, una por spec, copiando cada una de
 * la anterior:
 *
 * | Guardia                    | Spec     | ¿Medía elemento a elemento? |
 * |----------------------------|----------|-----------------------------|
 * | `pie-responsive.spec.ts`   | SPEC-035 | n/a (mide altos del pie)    |
 * | `cuenta-responsive.spec.ts`| SPEC-036 | **Sí**                      |
 * | `admin-responsive.spec.ts` | SPEC-037 | **No** — sólo `scrollWidth` |
 * | `ayuda-responsive.spec.ts` | SPEC-039 | **No** — sólo `scrollWidth` |
 *
 * La técnica correcta entró en SPEC-036 y **se cayó en las dos copias siguientes**. No
 * es negligencia de nadie: es lo que hace el copiar-pegar. Y tuvo consecuencia medible —
 * la suite estuvo en verde con el botón «Vigilar» fuera de la pantalla, porque
 * `overflow-x: hidden` recorta al hijo **sin mover `scrollWidth`**.
 *
 * ADR-026 §1 lo deja como regla operativa citable:
 *
 *   > Una guardia de geometría que derive el desborde horizontal únicamente de
 *   > `document.scrollWidth` está **mal escrita**.
 *
 * Este test es la forma binaria de comprobarlo, y la razón de que sea barato es que la
 * pregunta cabe en una revisión: **¿la lectura de `scrollWidth` con fines de desborde
 * aparece fuera del módulo compartido?**
 *
 * Es unitario y no e2e a propósito: mira el ÁRBOL DE TESTS, no el navegador. Un fallo
 * aquí no significa que una pantalla esté mal, significa que la próxima guardia ya
 * nació ciega — y eso hay que saberlo sin arrancar Postgres.
 */

const DIR = 'tests/e2e';
const MODULO = `${DIR}/geometria.ts`;

const guardias = () =>
  readdirSync(DIR)
    .filter((n) => n.endsWith('-responsive.spec.ts'))
    .map((n) => `${DIR}/${n}`);

describe('SPEC-040 CA-6: la medida de geometría tiene un solo domicilio', () => {
  it('el módulo compartido existe y expone las tres medidas más los anchos', () => {
    const fuente = readFileSync(MODULO, 'utf8');
    for (const exportado of [
      'export const ANCHOS',
      'export async function medirDesbordePorElemento', // M1
      'export async function medirDesbordeDeDocumento', // M2
      'export async function medirIntegridadDePalabra', // M3
      'export const EXCLUSIONES_M1',
    ]) {
      expect(fuente, `${MODULO} no expone \`${exportado}\``).toContain(exportado);
    }
  });

  it('los ocho anchos de referencia son los del proyecto, no los de cada spec', () => {
    const fuente = readFileSync(MODULO, 'utf8');
    const declarados = fuente.match(/export const ANCHOS = \[([^\]]+)\]/)?.[1] ?? '';
    expect(
      declarados.split(',').map((n) => Number(n.trim())),
      'los anchos de ADR-026 §3 son 360, 390, 640, 700, 730, 760, 800 y 1280',
    ).toEqual([360, 390, 640, 700, 730, 760, 800, 1280]);
  });

  it('hay al menos tres guardias `*-responsive.spec.ts` que auditar', () => {
    // Si alguien las renombrara, este test dejaría de mirar sin decir nada.
    expect(guardias().length).toBeGreaterThanOrEqual(3);
  });

  it('NINGUNA guardia lee `scrollWidth` por su cuenta: sólo lo hace el módulo', () => {
    for (const fichero of guardias()) {
      const lineas = readFileSync(fichero, 'utf8')
        .split('\n')
        // Los comentarios SÍ pueden nombrarla: contar la lección no es cometerla.
        .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
        .filter((l) => l.includes('scrollWidth'));
      expect(
        lineas,
        `${fichero} lee \`scrollWidth\` fuera del módulo compartido. La medida de ` +
          `documento vive en \`${MODULO}\` (M2) y nunca es la ÚNICA de una guardia ` +
          `(ADR-026 §1): con \`overflow-x: hidden\` puesto, un hijo que se sale se ` +
          `recorta sin mover ese número.\n` +
          lineas.map((l) => `  ${l.trim()}`).join('\n'),
      ).toEqual([]);
    }
  });

  it('TODA guardia consume el módulo compartido', () => {
    for (const fichero of guardias()) {
      expect(
        readFileSync(fichero, 'utf8'),
        `${fichero} no importa de './geometria': o repite la medida, o no la hace`,
      ).toMatch(/from '\.\/geometria'/);
    }
  });

  it('la lista de exclusiones de M1 es corta y cada línea lleva su motivo', () => {
    const fuente = readFileSync(MODULO, 'utf8');
    const bloque = fuente.slice(fuente.indexOf('export const EXCLUSIONES_M1'));
    const cerrado = bloque.slice(0, bloque.indexOf('];') + 2);
    const selectores = [...cerrado.matchAll(/selector:/g)].length;
    const motivos = [...cerrado.matchAll(/motivo:/g)].length;

    expect(selectores, 'no se declaró ninguna exclusión, o el bloque cambió de forma').toBeGreaterThan(
      0,
    );
    expect(
      motivos,
      'hay exclusiones de M1 sin motivo escrito. F-ADR-026-2: esta lista puede crecer ' +
        'hasta vaciar la medida, y por eso cada línea se justifica',
    ).toBe(selectores);
    expect(
      selectores,
      'la lista de exclusiones de M1 ha crecido más allá de lo que una revisión mira de ' +
        'un vistazo. Cada entrada apaga la medida en una zona de la pantalla (F-ADR-026-2)',
    ).toBeLessThanOrEqual(4);
  });

  it('`hidden` no cuenta como contenedor de desplazamiento en M1', () => {
    // ADR-026 §4: las dos salidas legítimas son que quepa o que el desplazamiento viva
    // en un contenedor DECLARADO (`auto`/`scroll`). Si `hidden` entrara en esa lista,
    // M1 volvería a ser ciega a lo que `html, body { overflow-x: hidden }` recorta —
    // que es exactamente el defecto que originó esta spec.
    const fuente = readFileSync(MODULO, 'utf8');
    const condicion = fuente.match(/if \(ox === [^\n]*\) return true;/)?.[0] ?? '';
    expect(condicion, 'no se encontró la condición de contenedor desplazable en M1').not.toBe('');
    expect(condicion).toContain("'auto'");
    expect(condicion).toContain("'scroll'");
    expect(
      condicion,
      'M1 estaría tratando `overflow: hidden` como un contenedor de desplazamiento ' +
        'legítimo: es justo la ceguera que ADR-026 existe para acabar',
    ).not.toContain("'hidden'");
  });
});
