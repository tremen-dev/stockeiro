import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * SPEC-046 CA-9 y CA-7(a) — **M4 vive en el módulo compartido, y la capa NO se excluye**.
 *
 * ## Por qué estas dos comprobaciones son unitarias
 *
 * Son binarias y caben en una revisión, exactamente como la de SPEC-040 CA-6
 * (`tests/geometria-guardias.test.ts`): no preguntan si una pantalla está bien, sino si
 * **la próxima guardia nace ciega**. Y eso hay que saberlo sin arrancar Postgres.
 *
 * ADR-026 §2 dejó escrito que una spec que necesite un invariante que no existe **lo
 * aporta al módulo**. SPEC-046 es la primera que lo ejerce: la medida que faltaba —«la
 * respuesta al gesto cae dentro de la ventana»— no se escribe en la guardia de esta spec,
 * se escribe en `tests/e2e/geometria.ts` y la hereda quien venga detrás. Si se permitiera
 * lo contrario, la historia de SPEC-037 / SPEC-039 —la medida buena que se cae en la
 * siguiente copia— volvería con la cuarta medida en vez de con la primera.
 *
 * ## Y por qué se audita la lista de exclusiones
 *
 * ADR-030 §5: una capa modal **es** maquetación de la página —ocupa la ventana— así que
 * meterla en `EXCLUSIONES_M1` para que la medida deje de quejarse sería `F-ADR-026-2`
 * cumpliéndose por escrito. La otra mitad de CA-7 —que la capa entró **de verdad** en el
 * conjunto medido— se comprueba en el navegador (`vigiladas-capa-edicion.spec.ts`),
 * porque no leer una exclusión no demuestra que se midiera.
 */

const DIR = 'tests/e2e';
const MODULO = `${DIR}/geometria.ts`;

const fuenteDelModulo = () => readFileSync(MODULO, 'utf8');

/** Todas las guardias e2e del proyecto, que es donde puede reaparecer una copia de M4. */
const guardiasE2E = () =>
  readdirSync(DIR)
    .filter((n) => n.endsWith('.spec.ts'))
    .map((n) => `${DIR}/${n}`);

describe('SPEC-046 CA-9: M4 vive en el módulo compartido, junto a M1, M2 y M3', () => {
  it('el módulo exporta la medida y su descripción', () => {
    const fuente = fuenteDelModulo();
    for (const exportado of [
      'export async function medirRespuestaAlGesto', // M4
      'export const describirRespuestaAlGesto',
      'export interface MedidaM4',
    ]) {
      expect(fuente, `${MODULO} no expone \`${exportado}\` (M4, ADR-030 §3)`).toContain(exportado);
    }
  });

  it('M4 lleva escrito su motivo y la sutileza de F-ADR-030-1', () => {
    const fuente = fuenteDelModulo();
    expect(
      fuente,
      'M4 no cita `F-ADR-030-1` en el módulo. La sutileza —la posición de desplazamiento ' +
        'se registra ANTES del gesto y el motor de pruebas no puede desplazar por su ' +
        'cuenta— es lo primero que se pierde al copiar, y por eso vive comentada aquí',
    ).toContain('F-ADR-030-1');
    expect(
      fuente,
      'M4 no dice para qué existe. Una medida sin motivo escrito es la que la siguiente ' +
        'copia deja caer (ADR-026 §2)',
    ).toMatch(/M4 — la respuesta al gesto cae dentro de la ventana/);
  });

  it('M4 compara la posición de desplazamiento antes y después del gesto (ADR-030 §3)', () => {
    // Las dos mitades de la medida hacen falta: sin la segunda, «llevar al usuario a la
    // superficie» con un `scrollIntoView` pasaría, y eso NO es lo mismo — mueve al
    // usuario de sitio y le quita de la vista la lista sobre la que estaba trabajando.
    const fuente = fuenteDelModulo();
    const desde = fuente.indexOf('export async function medirRespuestaAlGesto');
    expect(desde, 'no se encontró M4 en el módulo').toBeGreaterThan(-1);
    const cuerpo = fuente.slice(desde);
    expect(
      cuerpo,
      'M4 no registra la posición de desplazamiento ANTES del gesto: sin esa mitad, un ' +
        '`scrollIntoView` pasaría la medida (ADR-030 §3, alternativa (c) rechazada)',
    ).toMatch(/scrollAntes/);
    expect(cuerpo, 'M4 no compara con la posición posterior al gesto').toMatch(/scrollDespues/);
  });

  it('NINGUNA guardia de spec escribe su propia versión de M4', () => {
    // Misma comprobación binaria que SPEC-040 CA-6 hace con `scrollWidth`, y por el mismo
    // motivo: la medida buena entró una vez y se cayó en las dos copias siguientes.
    for (const fichero of guardiasE2E()) {
      const lineas = readFileSync(fichero, 'utf8')
        .split('\n')
        // Los comentarios SÍ pueden nombrarla: contar la lección no es cometerla.
        .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
        .filter((l) => /innerHeight|documentElement\.clientHeight/.test(l));
      expect(
        lineas,
        `${fichero} calcula el pliegue por su cuenta. La medida «¿lo ve quien acaba de ` +
          `pulsar?» vive en \`${MODULO}\` (M4, ADR-030 §3) y se importa de allí.\n` +
          lineas.map((l) => `  ${l.trim()}`).join('\n'),
      ).toEqual([]);
    }
  });
});

describe('SPEC-046 CA-7(a): la capa de edición NO figura en las exclusiones de M1', () => {
  it('ni por su clase ni por su `data-testid`', () => {
    const fuente = fuenteDelModulo();
    const bloque = fuente.slice(fuente.indexOf('export const EXCLUSIONES_M1'));
    const lista = bloque.slice(0, bloque.indexOf('];') + 2);

    for (const prohibido of ['editar-vigilada', 'editar-panel']) {
      expect(
        lista.includes(prohibido),
        `la capa de edición está en \`EXCLUSIONES_M1\` (por «${prohibido}»). ADR-030 §5: ` +
          `la lista es para lo que está fuera de flujo y anclado a su disparador; una capa ` +
          `modal OCUPA la ventana y ES maquetación. Esconderla ahí sería F-ADR-026-2 ` +
          `cumpliéndose por escrito`,
      ).toBe(false);
    }
  });
});
