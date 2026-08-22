import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { entradasIco, imagenIco, hexARgb } from './icono-raster';

/**
 * SPEC-047 — **los ficheros del icono son lo que dicen ser**.
 *
 * Cubre lo que se puede afirmar leyendo bytes, sin navegador y sin base de datos:
 *
 *   CA-1  el SVG es autónomo: ni fuente, ni terceros, ni script
 *   CA-2  no cambia de aspecto según quién lo mire
 *   CA-3  el `.ico` trae 16, 32 y 48
 *   CA-5  los tres colores son los tokens de la marca, leídos de su fuente
 *   CA-9  la geometría cumple el contrato de proporciones
 *   CA-10 sólo hay tres formas, y son las del wordmark
 *   CA-11 contraste medido sobre el suelo propio del icono
 *
 * Los CA de PÍXELES (12, 13, 14) están en `icono-16px.test.ts` para el `.ico` y en
 * `tests/e2e/icono.spec.ts` para el SVG, que necesita un rasterizador de verdad.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = join(rootDir, 'src', 'app', 'icon.svg');
const icoPath = join(rootDir, 'src', 'app', 'favicon.ico');
const cssPath = join(rootDir, 'design', 'tremen-ds', 'colors_and_type.css');

const svg = () => readFileSync(svgPath, 'utf8');
const ico = () => new Uint8Array(readFileSync(icoPath));

// ---------------------------------------------------------------------------
// Lectura del SVG. Deliberadamente tonta: expresiones regulares sobre el texto,
// sin DOM. Un icono de tres formas no necesita un parser, y uno de verdad se
// tragaría cosas (namespaces, entidades) que aquí queremos que canten.
// ---------------------------------------------------------------------------

type Elemento = { tag: string; attrs: Record<string, string> };

function elementos(fuente: string): Elemento[] {
  return [...fuente.matchAll(/<([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*\/?>/g)].map(
    (m) => ({
      tag: m[1],
      attrs: Object.fromEntries(
        [...m[2].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((a) => [a[1], a[2]]),
      ),
    }),
  );
}

const elemento = (tag: string): Elemento => {
  const hallados = elementos(svg()).filter((e) => e.tag === tag);
  expect(hallados.length, `se esperaba exactamente un <${tag}> en icon.svg`).toBe(1);
  return hallados[0];
};

const num = (e: Elemento, attr: string): number => {
  const v = Number(e.attrs[attr]);
  expect(Number.isFinite(v), `<${e.tag}> no trae un ${attr} numérico`).toBe(true);
  return v;
};

/**
 * Los vértices del trazado de la S. El `d` que emite el generador es una polilínea
 * (`M x y L x y x y … Z`, una subruta por cuenco), así que medirla es exacto: no hay
 * curva que aproximar y lo que mide el test es LO QUE HAY EN EL FICHERO.
 */
function subrutas(d: string): Array<Array<[number, number]>> {
  return d
    .split(/(?=M)/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((sub) => {
      expect(sub, 'cada subruta empieza en M y cierra con Z').toMatch(/^M[\s\d.,-]+L[\s\d.,-]+Z$/);
      const nums = (sub.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      expect(nums.length % 2, 'las coordenadas van en pares').toBe(0);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
      return pts;
    });
}

/** Todos los puntos del trazado, con los bordes remuestreados: la distancia mínima
 *  al punto puede caer en mitad de un segmento, no sólo en un vértice. */
function puntosDeLaS(): Array<[number, number]> {
  const d = elemento('path').attrs.d ?? '';
  const out: Array<[number, number]> = [];
  for (const sub of subrutas(d)) {
    for (let i = 0; i < sub.length; i++) {
      const [x0, y0] = sub[i];
      const [x1, y1] = sub[(i + 1) % sub.length];
      for (let k = 0; k < 4; k++) {
        out.push([x0 + ((x1 - x0) * k) / 4, y0 + ((y1 - y0) * k) / 4]);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CA-5: los colores NO se teclean aquí. Se extraen del sistema de diseño, que es
// su fuente (tercera convención de FOUNDATION.md). El extractor es propio y no el
// del generador: un test que preguntara al generador por sus propios colores no
// comprobaría nada.
// ---------------------------------------------------------------------------

function bloque(css: string, selector: string): string {
  const i = css.indexOf(`${selector} {`);
  expect(i, `no hay bloque "${selector}" en colors_and_type.css`).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf('}', i));
}

function variable(css: string, selector: string, nombre: string): string {
  const m = new RegExp(`--${nombre}\\s*:\\s*([^;]+);`).exec(bloque(css, selector));
  expect(m, `no hay --${nombre} en ${selector}`).not.toBeNull();
  const valor = m![1].trim();
  const alias = /^var\(\s*--([\w-]+)\s*\)$/.exec(valor);
  return alias ? variable(css, ':root', alias[1]) : valor;
}

function tokensDeMarca() {
  const css = readFileSync(cssPath, 'utf8');
  return {
    fondo: variable(css, '.v-tremendo', 'bg'),
    hueso: variable(css, ':root', 'bone'),
    acento: variable(css, '.v-tremendo', 'accent'),
  };
}

// ---------------------------------------------------------------------------

describe('SPEC-047 CA-1: el SVG es autónomo — ni fuente, ni terceros, ni script', () => {
  it('es un SVG con viewBox cuadrado', () => {
    const raiz = elemento('svg');
    const [minX, minY, ancho, alto] = (raiz.attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
    expect([minX, minY]).toEqual([0, 0]);
    expect(ancho, 'el viewBox tiene que ser cuadrado').toBe(alto);
    expect(ancho).toBeGreaterThan(0);
  });

  for (const prohibido of ['text', 'tspan', 'script', 'foreignObject', 'image']) {
    it(`no contiene ningún <${prohibido}>`, () => {
      expect(elementos(svg()).map((e) => e.tag)).not.toContain(prohibido);
    });
  }

  it('no menciona ninguna fuente: ni font-family, ni @font-face, ni @import', () => {
    const fuente = svg();
    expect(fuente).not.toMatch(/font-family/i);
    expect(fuente).not.toMatch(/@font-face/i);
    expect(fuente).not.toMatch(/@import/i);
  });

  it('ningún atributo apunta a un host externo', () => {
    for (const el of elementos(svg())) {
      for (const [nombre, valor] of Object.entries(el.attrs)) {
        // `xmlns` queda fuera y con motivo: es el NOMBRE del espacio de nombres SVG,
        // obligatorio en un fichero suelto y que ningún renderizador descarga jamás.
        // Excluirlo es lo que hace que la comprobación signifique algo; incluirlo la
        // convertiría en «este fichero no puede ser un SVG válido».
        if (nombre.startsWith('xmlns')) continue;
        expect(valor, `<${el.tag} ${nombre}> apunta fuera`).not.toMatch(/https?:|\/\/|url\(/i);
      }
    }
  });

  it('un <title> sí se admite: es metadato, no texto pintado', () => {
    expect(svg()).toMatch(/<title>[^<]+<\/title>/);
  });
});

describe('SPEC-047 CA-2: el SVG no cambia de aspecto según quién lo mire', () => {
  for (const patron of ['prefers-color-scheme', 'currentColor', 'var(--']) {
    it(`no aparece "${patron}": los tres colores son literales`, () => {
      expect(svg()).not.toContain(patron);
    });
  }
});

describe('SPEC-047 CA-3: el .ico trae los tres tamaños', () => {
  it('la cabecera declara 16, 32 y 48', () => {
    const declarados = entradasIco(ico()).map((e) => `${e.anchoDeclarado}×${e.altoDeclarado}`);
    expect(declarados.sort()).toEqual(['16×16', '32×32', '48×48']);
  });

  it('cada entrada decodifica a una imagen de esas dimensiones exactas', () => {
    const buf = ico();
    for (const entrada of entradasIco(buf)) {
      const img = imagenIco(buf, entrada);
      expect(img.ancho).toBe(entrada.anchoDeclarado);
      expect(img.alto).toBe(entrada.altoDeclarado);
    }
  });
});

describe('SPEC-047 CA-5: los colores del icono son los tokens de la marca', () => {
  it('los literales del SVG son exactamente --bg, --bone y --accent', () => {
    const tokens = tokensDeMarca();
    const literales = [...new Set((svg().match(/#[0-9a-fA-F]{3,8}/g) ?? []).map((c) => c.toUpperCase()))];
    expect(literales.sort()).toEqual(
      [tokens.fondo, tokens.hueso, tokens.acento].map((c) => c.toUpperCase()).sort(),
    );
  });

  it('cada forma lleva el token que le toca', () => {
    const tokens = tokensDeMarca();
    expect(elemento('rect').attrs.fill?.toUpperCase()).toBe(tokens.fondo.toUpperCase());
    expect(elemento('path').attrs.fill?.toUpperCase()).toBe(tokens.hueso.toUpperCase());
    expect(elemento('circle').attrs.fill?.toUpperCase()).toBe(tokens.acento.toUpperCase());
  });
});

describe('SPEC-047 CA-9: la geometría cumple el contrato de proporciones', () => {
  const REJILLA = 32;

  it('la teselá cubre el lienzo entero, es opaca y su rx está entre 5 y 7', () => {
    const rect = elemento('rect');
    expect([num(rect, 'x'), num(rect, 'y')]).toEqual([0, 0]);
    expect(num(rect, 'width')).toBe(REJILLA);
    expect(num(rect, 'height')).toBe(REJILLA);
    expect(num(rect, 'rx')).toBeGreaterThanOrEqual(5);
    expect(num(rect, 'rx')).toBeLessThanOrEqual(7);
    // Opaca a sangre: ni transparencia declarada, ni color con canal alfa.
    expect(svg()).not.toMatch(/\b(fill-opacity|opacity|stop-opacity)\s*=/);
    expect(svg()).not.toMatch(/rgba?\(/i);
    expect(rect.attrs.fill).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('la altura de mayúscula de la S está entre 18 y 22', () => {
    const ys = puntosDeLaS().map(([, y]) => y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(18);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(22);
  });

  it('el punto es un círculo de diámetro entre 5 y 7', () => {
    const r = num(elemento('circle'), 'r');
    expect(2 * r).toBeGreaterThanOrEqual(5);
    expect(2 * r).toBeLessThanOrEqual(7);
  });

  it('el centro del punto cae en la mitad derecha y en la mitad inferior', () => {
    const c = elemento('circle');
    expect(num(c, 'cx')).toBeGreaterThan(REJILLA / 2);
    expect(num(c, 'cy')).toBeGreaterThan(REJILLA / 2);
  });

  it('la separación mínima entre el punto y la S es ≥ 2', () => {
    const c = elemento('circle');
    const [cx, cy, r] = [num(c, 'cx'), num(c, 'cy'), num(c, 'r')];
    const separacion = Math.min(...puntosDeLaS().map(([x, y]) => Math.hypot(x - cx, y - cy) - r));
    expect(separacion, 'si se tocan, dejan de ser dos cosas').toBeGreaterThanOrEqual(2);
  });

  it('ninguna tinta invade los 2 de margen exterior', () => {
    const c = elemento('circle');
    const [cx, cy, r] = [num(c, 'cx'), num(c, 'cy'), num(c, 'r')];
    const tinta: Array<[number, number]> = [
      ...puntosDeLaS(),
      [cx - r, cy],
      [cx + r, cy],
      [cx, cy - r],
      [cx, cy + r],
    ];
    for (const [x, y] of tinta) {
      expect(x, `tinta en x=${x}`).toBeGreaterThanOrEqual(2);
      expect(x, `tinta en x=${x}`).toBeLessThanOrEqual(REJILLA - 2);
      expect(y, `tinta en y=${y}`).toBeGreaterThanOrEqual(2);
      expect(y, `tinta en y=${y}`).toBeLessThanOrEqual(REJILLA - 2);
    }
  });
});

describe('SPEC-047 CA-10: sólo hay tres formas, y son las del wordmark', () => {
  const DIBUJO = [
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polygon',
    'polyline',
    'use',
    'image',
    'text',
  ];

  it('exactamente tres elementos de dibujo: la teselá, la S y el punto', () => {
    const dibujados = elementos(svg())
      .map((e) => e.tag)
      .filter((t) => DIBUJO.includes(t));
    expect(dibujados.sort()).toEqual(['circle', 'path', 'rect']);
  });

  it('ni degradados, ni filtros, ni brillos', () => {
    for (const tag of ['linearGradient', 'radialGradient', 'filter', 'pattern', 'mask']) {
      expect(elementos(svg()).map((e) => e.tag), `sobra un <${tag}>`).not.toContain(tag);
    }
  });
});

describe('SPEC-047 CA-11: contraste medido sobre el suelo propio del icono', () => {
  /** Luminancia relativa WCAG 2.x. */
  function luminancia(hex: string): number {
    const [r, g, b] = hexARgb(hex)
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const ratio = (a: string, b: string) => {
    const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it('la S contra la teselá está por encima de 15:1', () => {
    const t = tokensDeMarca();
    expect(ratio(t.hueso, t.fondo)).toBeGreaterThanOrEqual(15);
  });

  it('el punto contra la teselá está por encima de 6:1', () => {
    const t = tokensDeMarca();
    expect(ratio(t.acento, t.fondo)).toBeGreaterThanOrEqual(6);
  });
});
