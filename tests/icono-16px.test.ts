import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Analisis,
  caja,
  centroide,
  enEsquina,
  imagenIcoDe,
  noOpacos,
  ojos,
  regionesConexas,
  seTocan,
  type Colores,
} from './icono-raster';

/**
 * SPEC-047 CA-12, CA-13 y CA-14 sobre el `.ico` — **la parte que de verdad importa**.
 *
 * «Un icono se diseña a 512 y se vive a 16.» Estos tres criterios no miran
 * intenciones ni proporciones: decodifican la entrada de 16×16 del `.ico` de sus
 * bytes y cuentan píxeles. Si el trazado no pasa, el trazado está mal — la salida no
 * es bajar el listón, es engordar el ojo (R-1 de la spec).
 *
 * El SVG se somete a los MISMOS tres en `tests/e2e/icono.spec.ts`, donde hay un
 * rasterizador de verdad (el navegador). CA-15 los compara.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const icoPath = join(rootDir, 'src', 'app', 'favicon.ico');
const cssPath = join(rootDir, 'design', 'tremen-ds', 'colors_and_type.css');

/** Los tres colores, otra vez desde su fuente y no tecleados (CA-5). */
function colores(): Colores {
  const css = readFileSync(cssPath, 'utf8');
  const leer = (selector: string, nombre: string): string => {
    const desde = css.indexOf(`${selector} {`);
    const bloque = css.slice(desde, css.indexOf('}', desde));
    const valor = new RegExp(`--${nombre}\\s*:\\s*([^;]+);`).exec(bloque)![1].trim();
    const alias = /^var\(\s*--([\w-]+)\s*\)$/.exec(valor);
    return alias ? leer(':root', alias[1]) : valor;
  };
  return {
    fondo: leer('.v-tremendo', 'bg'),
    hueso: leer(':root', 'bone'),
    acento: leer('.v-tremendo', 'accent'),
  };
}

const analisis = (lado: number) =>
  new Analisis(imagenIcoDe(new Uint8Array(readFileSync(icoPath)), lado).raster, colores());

describe('SPEC-047 CA-12: a 16 px el punto sobrevive, y sigue siendo una cosa aparte', () => {
  it('hay al menos 6 píxeles de acento', () => {
    const an = analisis(16);
    expect(an.puntos('A').length, `\n${an.dibujo()}`).toBeGreaterThanOrEqual(6);
  });

  it('forman una sola región conexa', () => {
    const an = analisis(16);
    expect(regionesConexas(an.puntos('A')).length, `\n${an.dibujo()}`).toBe(1);
  });

  it('su centroide cae en la mitad derecha y en la mitad inferior', () => {
    const c = centroide(analisis(16).puntos('A'));
    expect(c.x).toBeGreaterThan(8 - 0.5);
    expect(c.y).toBeGreaterThan(8 - 0.5);
  });

  it('ningún píxel de acento toca uno de hueso: el punto y la letra no se han fundido', () => {
    const an = analisis(16);
    expect(seTocan(an, 'A', 'H'), `\n${an.dibujo()}`).toEqual([]);
  });
});

describe('SPEC-047 CA-13: la S sigue siendo una S, no un borrón', () => {
  it('a 16 px hay un ojo abierto arriba y otro abajo, con ≥ 1 px de fondo', () => {
    const an = analisis(16);
    const { superiores, inferiores } = ojos(an, 1);
    expect(superiores, `ojo superior cerrado\n${an.dibujo()}`).not.toEqual([]);
    expect(inferiores, `ojo inferior cerrado\n${an.dibujo()}`).not.toEqual([]);
  });

  it('a 32 px los dos ojos siguen abiertos, y con ≥ 2 px de fondo', () => {
    const an = analisis(32);
    const { superiores, inferiores } = ojos(an, 2);
    expect(superiores, `ojo superior cerrado\n${an.dibujo()}`).not.toEqual([]);
    expect(inferiores, `ojo inferior cerrado\n${an.dibujo()}`).not.toEqual([]);
  });
});

describe('SPEC-047 CA-14: la tinta ocupa lo que debe, y el suelo es opaco', () => {
  it('el hueso ocupa entre el 15 % y el 40 % de los 256 píxeles', () => {
    const an = analisis(16);
    const porcentaje = (100 * an.puntos('H').length) / 256;
    expect(porcentaje, `ni hilo ni bloque\n${an.dibujo()}`).toBeGreaterThanOrEqual(15);
    expect(porcentaje, `ni hilo ni bloque\n${an.dibujo()}`).toBeLessThanOrEqual(40);
  });

  it('los 256 píxeles son opacos salvo, como mucho, los del redondeo de las esquinas', () => {
    const an = analisis(16);
    // El radio de la teselá es 6 sobre la rejilla de 32, o sea 3 px a 16.
    const fuera = noOpacos(an).filter((p) => !enEsquina(p, 16, 3));
    expect(fuera, `hay transparencia fuera del redondeo\n${an.dibujo()}`).toEqual([]);
  });

  it('la caja de la tinta no llega al borde: el suelo se ve por los cuatro lados', () => {
    const an = analisis(16);
    const c = caja([...an.puntos('H'), ...an.puntos('A')]);
    expect(c.x0).toBeGreaterThan(0);
    expect(c.y0).toBeGreaterThan(0);
    expect(c.x1).toBeLessThan(15);
    expect(c.y1).toBeLessThan(15);
  });
});
