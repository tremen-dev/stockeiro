import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AnalisisTarjeta,
  caja,
  cabeceraPng,
  centroide,
  decodificarPng,
  hexARgb,
  ojosEn,
  pixel,
  reducir,
  regionesConexas,
  seTocanEn,
  trozosPng,
  type Colores,
  type Lienzo,
} from './tarjeta-raster';

/**
 * SPEC-051 — **la imagen es lo que dice ser**: CA-7, CA-8, CA-9 (la mitad que se ve en
 * los píxeles), CA-10, CA-11 y CA-12.
 *
 * Todo se mide sobre el fichero committeado, decodificando sus bytes. Ni navegador, ni
 * base de datos, ni preguntarle al generador qué cree que escribió.
 *
 * Dos cosas NO se teclean aquí, y es a propósito (tercera convención de `FOUNDATION.md`):
 *
 *   - **Los colores** salen de `design/tremen-ds/colors_and_type.css`, que es su fuente
 *     (CA-8). Un test con `#111110` escrito a mano deja de vigilar el día que la marca
 *     cambie de suelo: pasaría a vigilar el hexadecimal de 2026.
 *   - **La geometría esperada** sale de `src/app/icon.svg`, que es el otro entregable de
 *     la MISMA fuente (`scripts/icon-geometry.mjs`). Así CA-9 —«las formas provienen del
 *     trazado que ya existe»— se comprueba comparando dibujo con dibujo, y no leyendo el
 *     código del generador y creyéndoselo. Y la escala se **deriva** de la propia imagen
 *     en vez de fijarse: lo que la spec contrata es una proporción, no un número.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pngPath = join(rootDir, 'src', 'app', 'opengraph-image.png');
const svgPath = join(rootDir, 'src', 'app', 'icon.svg');
const cssPath = join(rootDir, 'design', 'tremen-ds', 'colors_and_type.css');

const bytes = () => new Uint8Array(readFileSync(pngPath));

/** Los tres colores, desde su fuente y no tecleados (CA-8). */
function colores(): Colores {
  const css = readFileSync(cssPath, 'utf8');
  const leer = (selector: string, nombre: string): string => {
    const desde = css.indexOf(`${selector} {`);
    expect(desde, `no hay bloque "${selector}" en el sistema de diseño`).toBeGreaterThanOrEqual(0);
    const bloque = css.slice(desde, css.indexOf('}', desde));
    const m = new RegExp(`--${nombre}\\s*:\\s*([^;]+);`).exec(bloque);
    expect(m, `no hay --${nombre} en ${selector}`).not.toBeNull();
    const valor = m![1].trim();
    const alias = /^var\(\s*--([\w-]+)\s*\)$/.exec(valor);
    return alias ? leer(':root', alias[1]) : valor;
  };
  return {
    fondo: leer('.v-tremendo', 'bg'),
    hueso: leer(':root', 'bone'),
    acento: leer('.v-tremendo', 'accent'),
  };
}

// ---------------------------------------------------------------------------
// La geometría de referencia: el OTRO entregable de la misma fuente.
// ---------------------------------------------------------------------------

/**
 * El `d` de `icon.svg` es una polilínea (`M x y L x y … Z`, una subruta por cuenco), así
 * que leerla es exacto: no hay curva que aproximar. Mismo criterio que
 * `tests/icono-fichero.test.ts`, reimplementado aquí en vez de importado porque aquel
 * fichero es de SPEC-047 y CA-17 no autoriza tocarlo — ni siquiera para exportar algo.
 */
function rejillaDelIcono() {
  const svg = readFileSync(svgPath, 'utf8');
  const viewBox = (/viewBox="([^"]+)"/.exec(svg)?.[1] ?? '').trim().split(/[\s,]+/).map(Number);
  const d = /<path[^>]*\sd="([^"]+)"/.exec(svg)?.[1] ?? '';
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  expect(nums.length, 'no se ha podido leer el trazado de la S de icon.svg').toBeGreaterThan(100);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < nums.length; i += 2) {
    xs.push(nums[i]);
    ys.push(nums[i + 1]);
  }
  const circulo = /<circle[^>]*>/.exec(svg)?.[0] ?? '';
  const attr = (n: string) => Number(new RegExp(`${n}="([^"]+)"`).exec(circulo)?.[1]);

  return {
    rejilla: viewBox[2],
    s: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) },
    punto: { cx: attr('cx'), cy: attr('cy'), r: attr('r') },
  };
}

/** La caja envolvente de TODA la marca sobre la rejilla del icono: la S más el punto. */
function marcaEnRejilla() {
  const { s, punto } = rejillaDelIcono();
  return {
    x0: Math.min(s.x0, punto.cx - punto.r),
    x1: Math.max(s.x1, punto.cx + punto.r),
    y0: Math.min(s.y0, punto.cy - punto.r),
    y1: Math.max(s.y1, punto.cy + punto.r),
  };
}

// ---------------------------------------------------------------------------

let cacheLienzo: Lienzo | null = null;
const lienzo = (): Lienzo => (cacheLienzo ??= decodificarPng(bytes()));
const analisis = () => new AnalisisTarjeta(lienzo(), colores());

describe('SPEC-051 CA-7: es lo que dice ser — PNG de 1200×630 y opaco a sangre', () => {
  it('la firma y la cabecera declaran 1200 × 630', () => {
    const cab = cabeceraPng(bytes());
    expect([cab.ancho, cab.alto]).toEqual([1200, 630]);
    expect(cab.profundidad, 'se esperaban 8 bits por canal').toBe(8);
    expect(cab.entrelazado, 'un PNG entrelazado no lo lee todo el mundo').toBe(0);
  });

  it('los chunks obligatorios están, en orden, y con su CRC correcto', () => {
    // `trozosPng` verifica el CRC de cada chunk al recorrerlo: un fichero mal formado
    // lanza aquí. Es el R-5 de la spec —un PNG que abre en un visor tolerante y falla en
    // un rastreador— puesto como aserción.
    const tipos = trozosPng(bytes()).map((t) => t.tipo);
    expect(tipos[0]).toBe('IHDR');
    expect(tipos).toContain('IDAT');
    expect(tipos[tipos.length - 1]).toBe('IEND');
  });

  it('decodifica al tamaño exacto y TODOS sus píxeles son opacos', () => {
    const img = lienzo();
    expect([img.ancho, img.alto]).toEqual([1200, 630]);
    const translucidos: string[] = [];
    for (let y = 0; y < img.alto && translucidos.length < 5; y++) {
      for (let x = 0; x < img.ancho; x++) {
        if (pixel(img, x, y)[3] !== 255) translucidos.push(`(${x},${y})`);
        if (translucidos.length >= 5) break;
      }
    }
    expect(
      translucidos,
      'con transparencia, la tarjeta se compone contra el fondo que decida cada ' +
        'plataforma y el contraste de CA-11 deja de ser el que se midió',
    ).toEqual([]);
  });
});

describe('SPEC-051 CA-8: exactamente tres colores, y son los tokens de la marca', () => {
  const exactos = () => {
    const t = colores();
    return new Map(
      (['fondo', 'hueso', 'acento'] as const).map((k) => {
        const [r, g, b] = hexARgb(t[k]);
        return [`${r},${g},${b}`, k];
      }),
    );
  };

  it('los tres tokens están presentes en la imagen, y ninguno falta', () => {
    const img = lienzo();
    const esperados = exactos();
    const vistos = new Set<string>();
    for (let i = 0; i < img.ancho * img.alto; i++) {
      const clave = `${img.data[i * 4]},${img.data[i * 4 + 1]},${img.data[i * 4 + 2]}`;
      if (esperados.has(clave)) vistos.add(clave);
    }
    expect([...vistos].map((c) => esperados.get(c)).sort()).toEqual(['acento', 'fondo', 'hueso']);
  });

  it('lo que no es uno de los tres es borde, y no llega al 12 % del lienzo', () => {
    const img = lienzo();
    const esperados = exactos();
    let intermedios = 0;
    for (let i = 0; i < img.ancho * img.alto; i++) {
      const clave = `${img.data[i * 4]},${img.data[i * 4 + 1]},${img.data[i * 4 + 2]}`;
      if (!esperados.has(clave)) intermedios++;
    }
    const total = img.ancho * img.alto;
    expect(
      intermedios / total,
      `${intermedios} píxeles de ${total} no son ninguno de los tres tokens`,
    ).toBeLessThanOrEqual(0.12);
  });

  it('y ese borde es MEZCLA de dos tokens: ni degradado, ni sombra, ni cuarto color', () => {
    // La comprobación de arriba, sola, admitiría un degradado suave que ocupara el 10 %
    // del lienzo. Ésta cierra esa puerta: cada píxel que no es un token exacto tiene que
    // caer sobre el segmento que une DOS de los tres en el espacio RGB, que es lo único
    // que produce el suavizado de un borde entre dos formas planas.
    const img = lienzo();
    const t = colores();
    const ref = [hexARgb(t.fondo), hexARgb(t.hueso), hexARgb(t.acento)];
    const segmentos: Array<[number[], number[]]> = [
      [ref[0], ref[1]],
      [ref[0], ref[2]],
      [ref[1], ref[2]],
    ];
    const alSegmento = (p: number[], a: number[], b: number[]) => {
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
      const largo = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
      const k = Math.min(1, Math.max(0, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / largo));
      return Math.hypot(ap[0] - k * ab[0], ap[1] - k * ab[1], ap[2] - k * ab[2]);
    };
    const exactos = new Set(ref.map((c) => c.join(',')));
    const fuera: string[] = [];
    for (let i = 0; i < img.ancho * img.alto && fuera.length < 5; i++) {
      const p = [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]];
      if (exactos.has(p.join(','))) continue;
      const d = Math.min(...segmentos.map(([a, b]) => alSegmento(p, a, b)));
      if (d > 8) fuera.push(`rgb(${p.join(',')}) a ${d.toFixed(1)} del segmento más cercano`);
    }
    expect(fuera, 'hay color que no es mezcla de dos tokens: eso es un cuarto color').toEqual([]);
  });
});

describe('SPEC-051 CA-9: en la imagen no hay ni una letra, ni una fuente', () => {
  it('el PNG no lleva ningún chunk de texto', () => {
    // La única forma de que un PNG «contenga texto» sin pintarlo es un chunk tEXt/iTXt/
    // zTXt. No hay ninguno: la tarjeta no dice nada, lo dicen `og:title` y
    // `og:description` (D-1).
    const tipos = trozosPng(bytes()).map((t) => t.tipo);
    for (const prohibido of ['tEXt', 'iTXt', 'zTXt']) {
      expect(tipos, `sobra un chunk ${prohibido}`).not.toContain(prohibido);
    }
  });

  it('las formas son las del wordmark que ya existe: la S y el punto, a escala', () => {
    // D-2 comprobado dibujo contra dibujo. La referencia es `src/app/icon.svg`, el otro
    // entregable de la MISMA fuente (`scripts/icon-geometry.mjs`): si la tarjeta trajera
    // una forma nueva —o la misma deformada—, las cajas dejarían de casar.
    const an = analisis();
    const { s, punto } = rejillaDelIcono();
    const cajaHueso = caja(an.puntos('H'));
    const cajaAcento = caja(an.puntos('A'));

    // La escala se DERIVA de la altura de la S: lo que la spec contrata es la
    // proporción, no un número concreto de píxeles por unidad de rejilla.
    const escala = (cajaHueso.y1 - cajaHueso.y0) / (s.y1 - s.y0);
    expect(escala, 'la S de la tarjeta no es una ampliación de la del icono').toBeGreaterThan(1);

    const anchoEsperado = (s.x1 - s.x0) * escala;
    expect(
      Math.abs(cajaHueso.x1 - cajaHueso.x0 - anchoEsperado) / anchoEsperado,
      'la S está deformada: su relación alto/ancho no es la del icono',
    ).toBeLessThanOrEqual(0.02);

    const diametroEsperado = 2 * punto.r * escala;
    for (const medido of [cajaAcento.x1 - cajaAcento.x0, cajaAcento.y1 - cajaAcento.y0]) {
      expect(
        Math.abs(medido - diametroEsperado) / diametroEsperado,
        'el punto no es el círculo del icono a la misma escala',
      ).toBeLessThanOrEqual(0.02);
    }

    // Y la relación entre las dos formas —la de SPEC-047 D-3— se conserva: la distancia
    // del centro del punto al eje de la S, medida en unidades de rejilla, es la misma.
    const centroS = { x: (cajaHueso.x0 + cajaHueso.x1) / 2, y: (cajaHueso.y0 + cajaHueso.y1) / 2 };
    const centroPunto = centroide(an.puntos('A'));
    const enRejilla = {
      x: (centroPunto.x - centroS.x) / escala + (s.x0 + s.x1) / 2,
      y: (centroPunto.y - centroS.y) / escala + (s.y0 + s.y1) / 2,
    };
    expect(Math.abs(enRejilla.x - punto.cx)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(enRejilla.y - punto.cy)).toBeLessThanOrEqual(0.5);
  });
});

describe('SPEC-051 CA-10: la geometría cumple el contrato', () => {
  it('la marca mide entre 220 y 315 px de alto', () => {
    const { y0, y1 } = caja(analisis().tinta());
    expect(y1 - y0).toBeGreaterThanOrEqual(220);
    expect(y1 - y0).toBeLessThanOrEqual(315);
  });

  it('está centrada: su centro cae a 8 px o menos del centro del lienzo', () => {
    const { x0, x1, y0, y1 } = caja(analisis().tinta());
    expect(Math.abs((x0 + x1) / 2 - 1200 / 2)).toBeLessThanOrEqual(8);
    expect(Math.abs((y0 + y1) / 2 - 630 / 2)).toBeLessThanOrEqual(8);
  });

  it('toda la tinta cabe en el cuadrado central de 630×630, con 60 px de aire', () => {
    // D-6: las plataformas recortan. X en `summary_large_image` ronda 2:1 y otras enseñan
    // un cuadrado; una tarjeta que sólo se ve entera en Facebook es media tarjeta.
    const { x0, x1, y0, y1 } = caja(analisis().tinta());
    const izquierda = (1200 - 630) / 2;
    expect(x0, 'la tinta se sale del cuadrado central por la izquierda').toBeGreaterThanOrEqual(
      izquierda + 60,
    );
    expect(x1, 'la tinta se sale del cuadrado central por la derecha').toBeLessThanOrEqual(
      izquierda + 630 - 60,
    );
    expect(y0).toBeGreaterThanOrEqual(60);
    expect(y1).toBeLessThanOrEqual(630 - 60);
  });

  it('el acento es UNA sola región, a la derecha de la S y en su mitad inferior', () => {
    const an = analisis();
    const acento = an.puntos('A');
    expect(regionesConexas(acento), 'el punto se ha partido en trozos').toHaveLength(1);

    const cajaHueso = caja(an.puntos('H'));
    const centro = centroide(acento);
    expect(centro.x, 'el punto no está a la derecha de la S').toBeGreaterThan(cajaHueso.x1);
    expect(centro.y, 'el punto no está en la mitad inferior de la S').toBeGreaterThan(
      (cajaHueso.y0 + cajaHueso.y1) / 2,
    );
  });

  it('el punto y la letra siguen siendo dos cosas: ni un píxel se tocan', () => {
    const an = analisis();
    expect(seTocanEn(an, 'A', 'H'), 'el acento toca al hueso').toEqual([]);
    expect(seTocanEn(an, 'H', 'A'), 'el hueso toca al acento').toEqual([]);
  });
});

describe('SPEC-051 CA-11: contraste medido sobre el propio lienzo', () => {
  /** Luminancia relativa WCAG 2.x. */
  const luminancia = (hex: string) => {
    const [r, g, b] = hexARgb(hex)
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it('la S contra el lienzo está por encima de 15:1', () => {
    const t = colores();
    expect(ratio(t.hueso, t.fondo)).toBeGreaterThanOrEqual(15);
  });

  it('el punto contra el lienzo está por encima de 6:1', () => {
    const t = colores();
    expect(ratio(t.acento, t.fondo)).toBeGreaterThanOrEqual(6);
  });
});

describe('SPEC-051 CA-12: sobrevive al tamaño al que se ve de verdad (240×126)', () => {
  const miniatura = () => new AnalisisTarjeta(reducir(lienzo(), 240, 126), colores());

  it('el punto sigue ahí: al menos 6 píxeles de acento', () => {
    expect(miniatura().puntos('A').length).toBeGreaterThanOrEqual(6);
  });

  it('y sigue siendo UNA región, separada de la S', () => {
    const an = miniatura();
    expect(regionesConexas(an.puntos('A'))).toHaveLength(1);
    expect(seTocanEn(an, 'A', 'H'), 'a este tamaño el punto se ha pegado a la letra').toEqual([]);
  });

  it('los dos ojos de la S siguen abiertos, arriba y abajo', () => {
    const an = miniatura();
    const { superiores, inferiores } = ojosEn(an, 2);
    expect(superiores.length, 'el ojo de arriba se ha cerrado').toBeGreaterThan(0);
    expect(inferiores.length, 'el ojo de abajo se ha cerrado').toBeGreaterThan(0);
  });
});
