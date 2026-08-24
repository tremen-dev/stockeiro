import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANCHOS } from '../tests/e2e/geometria';
import { RUTAS_CON_POSICIONES, RUTAS_MEDIDAS } from '../tests/e2e/rutas';

/**
 * SPEC-054 CA-18, CA-2 (segunda mitad) y CA-11 (segunda mitad) — **el breakpoint de modo
 * es uno, el canto está bracketeado, y `/cartera` está en el conjunto que se mide**.
 *
 * ## Por qué estas tres son unitarias
 *
 * Porque las tres son **propiedades**, no estados de una pantalla, y las tres se
 * degradarían en silencio. Un `@media` nuevo con un ancho nuevo no rompe ninguna captura y
 * no mueve ninguna cifra: simplemente devuelve el proyecto al estado del que ADR-034 lo
 * saca —breakpoints sin dueño— y el día que dos superficies cambien de forma en anchos
 * distintos, nadie sabrá cuándo empezó. Igual con una ruta retirada del conjunto medido:
 * la suite se pone **más verde**, no más roja.
 *
 * Es el mismo criterio que `tests/geometria-guardias.test.ts` (SPEC-040 CA-6) y
 * `tests/spec046-m4-en-el-modulo.test.ts` (SPEC-046 CA-9): la pregunta es binaria, cabe en
 * una revisión, y no hace falta arrancar Postgres para responderla.
 */

const CSS = 'src/app/globals.css';

/** El breakpoint de MODO del producto (ADR-034 §1). */
const MODO = 720;
/** El de DENSIDAD de `.cards`, que ADR-034 §2 deja donde está (`599`/`600`). */
const DENSIDAD_CARDS = 599;
/**
 * Y su borde superior, que ya estaba en el árbol antes de esta spec:
 * `@media (min-width: 600px) and (max-width: 1023px)` reparte el panel en **dos** columnas
 * de tablet y deja las **tres** del escritorio a 1024 px para arriba.
 *
 * Se nombra aquí, con su motivo, porque si no la lista de anchos aceptados sería una lista
 * sin explicar — y una lista sin explicar es la que crece. **No es un breakpoint de modo**:
 * lo único que hay dentro de ese bloque es `.cards { grid-template-columns: … }`, y el test
 * `sólo los bloques de modo cambian representaciones` lo comprueba en vez de suponerlo.
 * `/dashboard` y su panel de teselas están **fuera del alcance** de SPEC-054, así que este
 * valor no se toca: se declara.
 */
const DENSIDAD_CARDS_TOPE = 1023;

const fuente = () => readFileSync(CSS, 'utf8');

interface BloqueMedia {
  /** La condición tal cual está escrita. */
  condicion: string;
  /** El cuerpo del bloque, con sus reglas. */
  cuerpo: string;
  /**
   * Los **cantos** que la condición nombra, normalizados.
   *
   * `max-width: 720px` y `min-width: 721px` son **el mismo canto** visto desde sus dos
   * lados, y así lo escribe ADR-034 §1 (*«`max-width: 720px` es móvil, `min-width: 721px`
   * es tabla»*). Contarlos como dos anchos distintos convertiría en «cuarto valor» la otra
   * mitad de la única decisión que hay. Se normaliza `min-width: N` a `N - 1`.
   */
  cantos: number[];
}

/**
 * Todos los `@media` de `globals.css`, con su cuerpo, contando llaves.
 *
 * Se cuentan llaves y no se parte por texto porque un bloque `@media` contiene reglas con
 * sus propias llaves; un `split` daría cuerpos truncados y el test aprobaría de más.
 */
function bloquesMedia(): BloqueMedia[] {
  const src = fuente();
  const bloques: BloqueMedia[] = [];
  const re = /@media([^{]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const condicion = m[1].trim();
    let nivel = 1;
    let i = m.index + m[0].length;
    while (i < src.length && nivel > 0) {
      if (src[i] === '{') nivel += 1;
      else if (src[i] === '}') nivel -= 1;
      i += 1;
    }
    const cantos = [...condicion.matchAll(/(min|max)-width:\s*(\d+)px/g)].map(([, lado, px]) =>
      lado === 'min' ? Number(px) - 1 : Number(px),
    );
    bloques.push({ condicion, cuerpo: src.slice(m.index + m[0].length, i - 1), cantos });
  }
  return bloques;
}

/**
 * Cada declaración de `display` del fichero, con el selector al que se aplica y si está
 * dentro de un bloque de modo.
 *
 * Es un análisis de texto sobre CSS, con los límites que eso tiene —el mismo estilo que ya
 * usa `tests/geometria-guardias.test.ts` sobre el módulo—. No pretende ser un parser:
 * pretende que colar un `display` fuera del bloque de modo requiera intención.
 */
function declaracionesDeDisplay(): { selector: string; valor: string; dentroDeModo: boolean }[] {
  const src = fuente();
  const bloques = bloquesMedia();
  const salida: { selector: string; valor: string; dentroDeModo: boolean }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const display = m[2].match(/(?:^|;)\s*display\s*:\s*([^;]+)/);
    if (!display) continue;
    const posicion = m.index;
    const dentro = bloques.find((b) => {
      const inicio = src.indexOf(b.cuerpo, 0);
      return inicio >= 0 && posicion >= inicio && posicion < inicio + b.cuerpo.length;
    });
    salida.push({
      // El selector, sin la cola del comentario o de la regla anterior que el regex arrastra.
      selector: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().split('\n').slice(-4).join(' ').trim(),
      valor: display[1].trim(),
      dentroDeModo: dentro !== undefined && dentro.cantos.every((c) => c === MODO),
    });
  }
  return salida;
}

describe('SPEC-054 CA-18: un solo breakpoint de MODO, y afirmado', () => {
  it('los únicos cantos de `globals.css` son el de modo y el de densidad de `.cards`', () => {
    const cantos = [...new Set(bloquesMedia().flatMap((b) => b.cantos))].sort((a, b) => a - b);
    expect(
      cantos,
      `\`${CSS}\` declara los cantos [${cantos.join(', ')}]. ADR-034 §2 sólo admite tres: ` +
        `**${MODO}** (el único de MODO, escrito por sus dos lados —\`max-width: ${MODO}px\` ` +
        `y \`min-width: ${MODO + 1}px\`—) y **${DENSIDAD_CARDS}/${DENSIDAD_CARDS_TOPE}**, que ` +
        `son los dos bordes del bloque de DENSIDAD de \`.cards\` y ya estaban aquí antes de ` +
        `esta spec. Un cuarto valor devuelve el proyecto al estado del que ADR-034 lo saca: ` +
        `breakpoints sin dueño. Si hace falta otro ancho, se decide en un gate y se escribe ` +
        `su motivo aquí — no se cuela`,
    ).toEqual([DENSIDAD_CARDS, MODO, DENSIDAD_CARDS_TOPE].sort((a, b) => a - b));
  });

  it('sólo el bloque de modo puede hacer aparecer o desaparecer una representación', () => {
    // La distinción de ADR-034 §2, comprobada en vez de supuesta: «un breakpoint de MODO
    // cambia qué elementos existen; uno de DENSIDAD cambia cuántos caben en una línea o
    // cuánto miden». Si el bloque de 599/600–1023 tocara algo que no sea el reparto de
    // `.cards`, dejaría de ser de densidad y habría DOS breakpoints de modo.
    for (const b of bloquesMedia()) {
      if (b.cantos.every((c) => c === MODO)) continue;
      const reglas = b.cuerpo
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('}')
        .map((r) => r.split('{')[0].trim())
        .filter((r) => r !== '');
      expect(
        reglas,
        `el bloque \`@media ${b.condicion}\` no es de modo y toca selectores que no son ` +
          `\`.cards\`: [${reglas.join(', ')}]. Un breakpoint de densidad cambia cuántos ` +
          `caben en una línea, no qué existe (ADR-034 §2)`,
      ).toEqual(['.cards']);
    }
  });

  it('TODA regla que pone o quita `display` a la tabla o a las tarjetas vive en el bloque de modo', () => {
    const gobernadas = declaracionesDeDisplay().filter((d) =>
      /table\.data-table|\.tarjetas\b|\.table-scroll/.test(d.selector),
    );
    expect(
      gobernadas.length,
      'no se encontró ni una regla de `display` sobre la tabla o la lista de tarjetas. O ' +
        'la conmutación de ADR-034 §3 desapareció, o este test dejó de saber leerla — y en ' +
        'los dos casos deja de vigilar',
    ).toBeGreaterThan(2);
    for (const d of gobernadas) {
      expect(
        d.dentroDeModo,
        `\`${d.selector} { display: ${d.valor} }\` está FUERA del bloque de ${MODO} px. La ` +
          `conmutación entre la tabla y las tarjetas es la decisión de ADR-034 §1 y vive ` +
          `entera en ese ancho: repartirla deja al producto con dos sitios donde cambiar de ` +
          `modo, que es exactamente lo que CE-6 de EPIC-007 prohíbe`,
      ).toBe(true);
    }
  });

  it('y las dos representaciones se declaran: una se apaga arriba y la otra abajo', () => {
    // La propiedad que hace falsa la mitad tonta del test anterior: que existan las dos
    // caras. Con sólo una, a un lado del canto no habría representación ninguna.
    const gobernadas = declaracionesDeDisplay().filter((d) =>
      /table\.data-table|\.tarjetas\b/.test(d.selector),
    );
    expect(
      gobernadas.filter((d) => /table\.data-table/.test(d.selector) && d.valor === 'none'),
      'nadie apaga la tabla por debajo del breakpoint: en un teléfono se verían las dos ' +
        'representaciones a la vez (SPEC-054 CA-1)',
    ).not.toEqual([]);
    expect(
      gobernadas.filter((d) => /\.tarjetas\b/.test(d.selector) && d.valor === 'none'),
      'nadie apaga la lista de tarjetas por encima del breakpoint',
    ).not.toEqual([]);
  });
});

describe('SPEC-054 CA-2: el canto queda entre dos anchos medidos ADYACENTES', () => {
  it('`ANCHOS` contiene 700 y 730, y no hay ningún ancho medido entre ellos', () => {
    // Es ADR-026 §3 aplicado a una decisión nueva en vez de recordado después: «un defecto
    // que sólo existe entre dos anchos medidos es un defecto que nadie mide». Con el corte
    // en 720 el canto cae entre 700 (última tarjeta) y 730 (primera tabla), a 30 px uno del
    // otro. Con el corte en 599/600 caería en el hueco 390 → 640: 250 px que nadie mira,
    // con el cambio de representación dentro.
    const ordenados = [...ANCHOS].sort((a, b) => a - b);
    const debajo = ordenados.filter((a) => a <= MODO);
    const encima = ordenados.filter((a) => a > MODO);
    expect(debajo.at(-1), 'el último ancho medido por debajo del canto ya no es 700').toBe(700);
    expect(encima[0], 'el primer ancho medido por encima del canto ya no es 730').toBe(730);
    expect(
      ordenados.filter((a) => a > 700 && a < 730),
      'apareció un ancho medido entre 700 y 730: el canto deja de estar bracketeado por dos ' +
        'anchos ADYACENTES y hay que volver a razonar dónde cae',
    ).toEqual([]);
  });
});

describe('SPEC-054 CA-11: `/cartera` está en el conjunto de rutas que la guardia mide', () => {
  it('la ruta está en el conjunto, y retirarla se ve en rojo', () => {
    // Una de las dos tablas del producto no se medía a NINGÚN ancho, y llevaba así desde
    // SPEC-002. Este test existe para que sacarla otra vez no ponga la suite más verde.
    expect(
      RUTAS_MEDIDAS,
      '`/cartera` salió del conjunto de rutas que mide `geometria-rutas.spec.ts`. Con ella ' +
        'fuera, una de las dos tablas del producto vuelve a no medirse a ningún ancho — y ' +
        'la suite se pone MÁS verde, no más roja (SPEC-054 CA-11, ADR-034 §9)',
    ).toContain('/cartera');
    expect(
      RUTAS_CON_POSICIONES,
      '`/cartera` está en el conjunto, pero no en el que se mide CON POSICIONES. Sin ' +
        'operaciones la pantalla pinta el estado vacío, que es otra y no tiene tabla dentro',
    ).toContain('/cartera');
  });

  it('la guardia consume el conjunto compartido, no una copia suya', () => {
    const guardia = readFileSync('tests/e2e/geometria-rutas.spec.ts', 'utf8');
    expect(
      guardia,
      '`geometria-rutas.spec.ts` no importa las rutas de `./rutas`: si se las volviera a ' +
        'escribir en casa, este test seguiría verde midiendo una lista que nadie recorre',
    ).toMatch(/from '\.\/rutas'/);
    for (const lista of ['RUTAS_PUBLICAS', 'RUTAS_CON_SESION', 'RUTAS_CON_POSICIONES']) {
      expect(guardia, `la guardia no recorre \`${lista}\``).toContain(lista);
    }
  });
});
