/**
 * SPEC-047 — herramientas de medida sobre PÍXELES, compartidas por la suite unitaria
 * (que mide el `.ico` decodificado de sus bytes) y por la e2e (que mide el SVG
 * rasterizado por el navegador en un `<canvas>`).
 *
 * Viven aquí y no dentro de un `*.test.ts` por la razón de ADR-026 §1 que ya obligó a
 * `tests/e2e/geometria.ts`: cuatro guardias copiadas se degradan, una compartida no. Y
 * porque CA-15 exige literalmente que **los dos formatos** pasen CA-12, CA-13 y CA-14:
 * si cada suite escribiera su propia versión de «el punto sobrevive», la comparación
 * dejaría de comparar lo mismo el día que una de las dos se retocara.
 *
 * Ninguna de estas funciones sabe nada del generador: el `.ico` se decodifica aquí
 * desde los bytes crudos, con un lector propio. Es deliberado — un test que pidiera al
 * generador que le contara qué escribió no probaría nada.
 */

/** Los tres literales del icono, tal y como salen del sistema de diseño. */
export type Colores = { fondo: string; hueso: string; acento: string };

/** Distancia euclídea máxima en RGB para decir que un píxel «es» de un color (CA-12…CA-14). */
export const TOLERANCIA_RGB = 24;

/** Un píxel se considera opaco a partir de aquí; por debajo es borde de la teselá. */
const ALFA_OPACO = 255;

export type Punto = { x: number; y: number };

/** Un rasterizado cuadrado en RGBA, fila a fila desde arriba. */
export type Raster = { size: number; data: Uint8ClampedArray };

/** `H` hueso · `A` acento · `F` fondo · `~` mezcla de borde · `-` no opaco. */
export type Clase = 'H' | 'A' | 'F' | '~' | '-';

export function hexARgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`color no hexadecimal de 6 dígitos: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

const distancia = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** El análisis completo de un rasterizado: el mapa de clases y sus listas por color. */
export class Analisis {
  readonly size: number;
  readonly mapa: Clase[][];
  readonly alfa: number[][];

  constructor(raster: Raster, colores: Colores) {
    this.size = raster.size;
    const ref = {
      H: hexARgb(colores.hueso),
      A: hexARgb(colores.acento),
      F: hexARgb(colores.fondo),
    };
    this.mapa = [];
    this.alfa = [];
    for (let y = 0; y < raster.size; y++) {
      const fila: Clase[] = [];
      const alfas: number[] = [];
      for (let x = 0; x < raster.size; x++) {
        const i = (y * raster.size + x) * 4;
        const rgb: [number, number, number] = [raster.data[i], raster.data[i + 1], raster.data[i + 2]];
        const a = raster.data[i + 3];
        alfas.push(a);
        if (a < ALFA_OPACO) {
          fila.push('-');
          continue;
        }
        const candidatos = (['H', 'A', 'F'] as const)
          .map((c) => ({ c, d: distancia(rgb, ref[c]) }))
          .filter(({ d }) => d <= TOLERANCIA_RGB)
          .sort((p, q) => p.d - q.d);
        fila.push(candidatos.length ? candidatos[0].c : '~');
      }
      this.mapa.push(fila);
      this.alfa.push(alfas);
    }
  }

  puntos(clase: Clase): Punto[] {
    const out: Punto[] = [];
    this.mapa.forEach((fila, y) => fila.forEach((c, x) => c === clase && out.push({ x, y })));
    return out;
  }

  clase(x: number, y: number): Clase | undefined {
    return this.mapa[y]?.[x];
  }

  /** El dibujo en texto, para que un fallo se lea sin abrir un visor de imágenes. */
  dibujo(): string {
    return this.mapa.map((f) => f.join('')).join('\n');
  }
}

/** Caja envolvente de un conjunto de píxeles. */
export function caja(pts: Punto[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

export function centroide(pts: Punto[]) {
  const n = pts.length;
  return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
}

/** Regiones conexas por 8-vecindad. CA-12 exige que el acento forme UNA sola. */
export function regionesConexas(pts: Punto[]): Punto[][] {
  const pendientes = new Map(pts.map((p) => [`${p.x},${p.y}`, p]));
  const regiones: Punto[][] = [];
  while (pendientes.size) {
    const [clave, semilla] = pendientes.entries().next().value as [string, Punto];
    pendientes.delete(clave);
    const region = [semilla];
    const pila = [semilla];
    while (pila.length) {
      const p = pila.pop()!;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const k = `${p.x + dx},${p.y + dy}`;
          const vecino = pendientes.get(k);
          if (!vecino) continue;
          pendientes.delete(k);
          region.push(vecino);
          pila.push(vecino);
        }
      }
    }
    regiones.push(region);
  }
  return regiones;
}

/** ¿Hay algún píxel de `a` pegado (8-vecindad) a alguno de clase `b`? */
export function seTocan(an: Analisis, a: Clase, b: Clase): Punto[] {
  return an.puntos(a).filter((p) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (an.clase(p.x + dx, p.y + dy) === b) return true;
      }
    }
    return false;
  });
}

/**
 * CA-13 — los ojos de la S. Una fila «tiene ojo» si dentro de la caja de hueso aparece
 * el patrón `hueso → fondo → hueso`, con al menos `minFondo` píxeles de fondo en el
 * hueco.
 *
 * El hueco se mide como el tramo ENTRE dos píxeles de hueso consecutivos, y lo que se
 * cuenta dentro es el fondo: los píxeles de mezcla del borde (`~`) no suman ni restan,
 * porque un antialiasing más o menos agresivo no cambia si la letra está abierta —
 * cambia sólo cuánto borde tiñe. Lo que sí sería un ojo cerrado es que no quede ni un
 * píxel de fondo limpio, y eso es exactamente lo que esto exige.
 */
export function filaConOjo(an: Analisis, y: number, minFondo: number): boolean {
  const fila = an.mapa[y];
  if (!fila) return false;
  const huesos = fila.flatMap((c, x) => (c === 'H' ? [x] : []));
  for (let k = 0; k + 1 < huesos.length; k++) {
    const hueco = fila.slice(huesos[k] + 1, huesos[k + 1]);
    if (hueco.filter((c) => c === 'F').length >= minFondo) return true;
  }
  return false;
}

/** Las filas con ojo, separadas por mitad de la caja envolvente del hueso. */
export function ojos(an: Analisis, minFondo: number) {
  const hueso = an.puntos('H');
  const { y0, y1 } = caja(hueso);
  const medio = (y0 + y1) / 2;
  const superiores: number[] = [];
  const inferiores: number[] = [];
  for (let y = y0; y <= y1; y++) {
    if (!filaConOjo(an, y, minFondo)) continue;
    if (y < medio) superiores.push(y);
    if (y > medio) inferiores.push(y);
  }
  return { superiores, inferiores, y0, y1 };
}

/** Píxeles que no son totalmente opacos: sólo pueden ser los del redondeo (CA-14). */
export function noOpacos(an: Analisis): Punto[] {
  const out: Punto[] = [];
  an.alfa.forEach((fila, y) => fila.forEach((a, x) => a < ALFA_OPACO && out.push({ x, y })));
  return out;
}

/** ¿Cae el píxel dentro del cuadrado de una de las cuatro esquinas, de lado `lado`? */
export function enEsquina(p: Punto, size: number, lado: number): boolean {
  const cerca = (v: number) => v < lado || v >= size - lado;
  return cerca(p.x) && cerca(p.y);
}

// ---------------------------------------------------------------------------
// Lector de .ico — bytes crudos, sin librerías (CA-3, CA-15)
// ---------------------------------------------------------------------------

export type EntradaIco = {
  /** Lo que DICE la cabecera del directorio. */
  anchoDeclarado: number;
  altoDeclarado: number;
  planos: number;
  bits: number;
  bytes: number;
  offset: number;
};

export type ImagenIco = { ancho: number; alto: number; raster: Raster; bits: number };

export function entradasIco(buf: Uint8Array): EntradaIco[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint16(0, true) !== 0) throw new Error('ICONDIR: el campo reservado no es 0');
  if (dv.getUint16(2, true) !== 1) throw new Error('ICONDIR: el tipo no es 1 (icono)');
  const n = dv.getUint16(4, true);
  return Array.from({ length: n }, (_, i) => {
    const o = 6 + i * 16;
    return {
      // 0 significa 256 en el formato; aquí no se usa, pero el lector no miente.
      anchoDeclarado: buf[o] === 0 ? 256 : buf[o],
      altoDeclarado: buf[o + 1] === 0 ? 256 : buf[o + 1],
      planos: dv.getUint16(o + 4, true),
      bits: dv.getUint16(o + 6, true),
      bytes: dv.getUint32(o + 8, true),
      offset: dv.getUint32(o + 12, true),
    };
  });
}

/** Decodifica la imagen de una entrada: BITMAPINFOHEADER + BGRA de abajo arriba. */
export function imagenIco(buf: Uint8Array, entrada: EntradaIco): ImagenIco {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const o = entrada.offset;
  const cabecera = dv.getUint32(o, true);
  if (cabecera !== 40) throw new Error(`DIB: cabecera de ${cabecera} bytes, se esperaba 40`);
  const ancho = dv.getInt32(o + 4, true);
  const altoDoble = dv.getInt32(o + 8, true);
  const bits = dv.getUint16(o + 14, true);
  const compresion = dv.getUint32(o + 16, true);
  if (compresion !== 0) throw new Error('DIB: comprimido; se esperaba BI_RGB');
  if (bits !== 32) throw new Error(`DIB: ${bits} bpp; se esperaba 32`);
  const alto = altoDoble / 2;
  const data = new Uint8ClampedArray(ancho * alto * 4);
  const inicio = o + 40;
  for (let y = 0; y < alto; y++) {
    const filaOrigen = alto - 1 - y; // el DIB va de abajo arriba
    for (let x = 0; x < ancho; x++) {
      const src = inicio + (filaOrigen * ancho + x) * 4;
      const dst = (y * ancho + x) * 4;
      data[dst] = buf[src + 2];
      data[dst + 1] = buf[src + 1];
      data[dst + 2] = buf[src];
      data[dst + 3] = buf[src + 3];
    }
  }
  return { ancho, alto, bits, raster: { size: ancho, data } };
}

/** La imagen de N×N del `.ico`, o un error que dice qué tamaños sí hay. */
export function imagenIcoDe(buf: Uint8Array, lado: number): ImagenIco {
  const entradas = entradasIco(buf);
  const imagenes = entradas.map((e) => imagenIco(buf, e));
  const encontrada = imagenes.find((i) => i.ancho === lado && i.alto === lado);
  if (!encontrada) {
    throw new Error(
      `el .ico no trae ninguna entrada de ${lado}×${lado}; trae ${imagenes
        .map((i) => `${i.ancho}×${i.alto}`)
        .join(', ')}`,
    );
  }
  return encontrada;
}
