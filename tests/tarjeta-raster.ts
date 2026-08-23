/**
 * SPEC-051 — herramientas de medida sobre los PÍXELES DE LA TARJETA social.
 *
 * Hay un fichero nuevo y no una ampliación de `tests/icono-raster.ts` por dos razones,
 * y las dos importan:
 *
 *   1. `icono-raster.ts` es de SPEC-047 y su `Analisis` es **cuadrado** (`raster.size`).
 *      La tarjeta es 1200×630, así que no cabe sin reescribirle la clase — y reescribirla
 *      sería tocar un fichero ajeno que **CA-17 no autoriza**. Lo que sí se hace es
 *      IMPORTAR de allí todo lo que ya es agnóstico a la forma del lienzo (`hexARgb`,
 *      `caja`, `centroide`, `regionesConexas`, la tolerancia): importar no es modificar,
 *      y así no hay dos versiones de «una región conexa» que puedan separarse.
 *   2. Aquí vive además el **decodificador de PNG**, que el icono no necesitaba. Es
 *      propio y sin librerías, igual que el lector de `.ico` de SPEC-047 y por el mismo
 *      motivo: un test que le preguntara al generador qué escribió no probaría nada.
 *      El codificador está en `scripts/png.mjs`; este decodificador no lo mira.
 */

import { inflateSync } from 'node:zlib';

import {
  TOLERANCIA_RGB,
  caja,
  centroide,
  hexARgb,
  regionesConexas,
  type Clase,
  type Colores,
  type Punto,
} from './icono-raster';

export { TOLERANCIA_RGB, caja, centroide, hexARgb, regionesConexas };
export type { Clase, Colores, Punto };

/** Un rasterizado rectangular en RGBA, fila a fila desde arriba. */
export type Lienzo = { ancho: number; alto: number; data: Uint8ClampedArray };

// ---------------------------------------------------------------------------
// Decodificador de PNG — bytes crudos, sólo `node:zlib` (CA-7)
// ---------------------------------------------------------------------------

const FIRMA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type Trozo = { tipo: string; datos: Uint8Array };

/** Los chunks del PNG, en orden, con su firma verificada. */
export function trozosPng(buf: Uint8Array): Trozo[] {
  for (let i = 0; i < FIRMA.length; i++) {
    if (buf[i] !== FIRMA[i]) throw new Error('no empieza por la firma de un PNG');
  }
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: Trozo[] = [];
  let o = 8;
  while (o < buf.length) {
    const largo = dv.getUint32(o, false);
    const tipo = String.fromCharCode(buf[o + 4], buf[o + 5], buf[o + 6], buf[o + 7]);
    const datos = buf.subarray(o + 8, o + 8 + largo);
    // El CRC se comprueba aquí y no «se confía»: un chunk con CRC malo es exactamente
    // el fallo de R-5 que un visor tolerante perdona y un rastreador no.
    const esperado = dv.getUint32(o + 8 + largo, false);
    const real = crc32(buf.subarray(o + 4, o + 8 + largo));
    if (esperado !== real) throw new Error(`CRC incorrecto en el chunk ${tipo}`);
    out.push({ tipo, datos });
    o += 12 + largo;
    if (tipo === 'IEND') break;
  }
  return out;
}

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type CabeceraPng = {
  ancho: number;
  alto: number;
  profundidad: number;
  tipoColor: number;
  compresion: number;
  filtro: number;
  entrelazado: number;
};

export function cabeceraPng(buf: Uint8Array): CabeceraPng {
  const ihdr = trozosPng(buf).find((t) => t.tipo === 'IHDR');
  if (!ihdr) throw new Error('el PNG no trae IHDR');
  const dv = new DataView(ihdr.datos.buffer, ihdr.datos.byteOffset, ihdr.datos.byteLength);
  return {
    ancho: dv.getUint32(0, false),
    alto: dv.getUint32(4, false),
    profundidad: ihdr.datos[8],
    tipoColor: ihdr.datos[9],
    compresion: ihdr.datos[10],
    filtro: ihdr.datos[11],
    entrelazado: ihdr.datos[12],
  };
}

/** El paso de predicción de PNG, con los cinco filtros del estándar. */
function desfiltrar(crudo: Uint8Array, ancho: number, alto: number, bpp: number): Uint8Array {
  const porFila = ancho * bpp;
  const salida = new Uint8Array(alto * porFila);
  let o = 0;
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[o++];
    const fila = salida.subarray(y * porFila, (y + 1) * porFila);
    const previa = y > 0 ? salida.subarray((y - 1) * porFila, y * porFila) : null;
    for (let x = 0; x < porFila; x++) {
      const val = crudo[o + x];
      const a = x >= bpp ? fila[x - bpp] : 0;
      const b = previa ? previa[x] : 0;
      const c = previa && x >= bpp ? previa[x - bpp] : 0;
      let pred: number;
      switch (filtro) {
        case 0:
          pred = 0;
          break;
        case 1:
          pred = a;
          break;
        case 2:
          pred = b;
          break;
        case 3:
          pred = (a + b) >> 1;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default:
          throw new Error(`filtro de scanline desconocido: ${filtro}`);
      }
      fila[x] = (val + pred) & 0xff;
    }
    o += porFila;
  }
  return salida;
}

/** El PNG decodificado a RGBA. Sólo 8 bits, sin paleta y sin entrelazar. */
export function decodificarPng(buf: Uint8Array): Lienzo {
  const cab = cabeceraPng(buf);
  if (cab.profundidad !== 8) throw new Error(`profundidad ${cab.profundidad}; se esperaba 8`);
  if (cab.entrelazado !== 0) throw new Error('PNG entrelazado; se esperaba entrelazado 0');
  if (cab.tipoColor !== 6 && cab.tipoColor !== 2) {
    throw new Error(`tipo de color ${cab.tipoColor}; se esperaba 6 (RGBA) o 2 (RGB)`);
  }
  const canales = cab.tipoColor === 6 ? 4 : 3;
  const idat = trozosPng(buf).filter((t) => t.tipo === 'IDAT');
  if (!idat.length) throw new Error('el PNG no trae IDAT');
  const crudo = inflateSync(Buffer.concat(idat.map((t) => Buffer.from(t.datos))));
  const plano = desfiltrar(crudo, cab.ancho, cab.alto, canales);

  const data = new Uint8ClampedArray(cab.ancho * cab.alto * 4);
  for (let i = 0; i < cab.ancho * cab.alto; i++) {
    data[i * 4] = plano[i * canales];
    data[i * 4 + 1] = plano[i * canales + 1];
    data[i * 4 + 2] = plano[i * canales + 2];
    data[i * 4 + 3] = canales === 4 ? plano[i * canales + 3] : 255;
  }
  return { ancho: cab.ancho, alto: cab.alto, data };
}

// ---------------------------------------------------------------------------
// Medida
// ---------------------------------------------------------------------------

const distancia = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** El color de un píxel, tal cual. */
export function pixel(lienzo: Lienzo, x: number, y: number): [number, number, number, number] {
  const i = (y * lienzo.ancho + x) * 4;
  return [lienzo.data[i], lienzo.data[i + 1], lienzo.data[i + 2], lienzo.data[i + 3]];
}

/**
 * El mapa de clases de un lienzo rectangular. Mismo alfabeto que `icono-raster.ts`
 * (`H` hueso · `A` acento · `F` fondo · `~` mezcla de borde), pero sin la clase `-`:
 * la tarjeta es opaca a sangre por CA-7, así que un píxel no opaco no es «borde de la
 * teselá», es un defecto — y lo caza CA-7, no la clasificación.
 */
export class AnalisisTarjeta {
  readonly ancho: number;
  readonly alto: number;
  readonly mapa: Clase[][];

  constructor(lienzo: Lienzo, colores: Colores, tolerancia = TOLERANCIA_RGB) {
    this.ancho = lienzo.ancho;
    this.alto = lienzo.alto;
    const ref = {
      H: hexARgb(colores.hueso),
      A: hexARgb(colores.acento),
      F: hexARgb(colores.fondo),
    };
    this.mapa = [];
    for (let y = 0; y < lienzo.alto; y++) {
      const fila: Clase[] = [];
      for (let x = 0; x < lienzo.ancho; x++) {
        const [r, g, b] = pixel(lienzo, x, y);
        const rgb: [number, number, number] = [r, g, b];
        const candidatos = (['H', 'A', 'F'] as const)
          .map((c) => ({ c, d: distancia(rgb, ref[c]) }))
          .filter(({ d }) => d <= tolerancia)
          .sort((p, q) => p.d - q.d);
        fila.push(candidatos.length ? candidatos[0].c : '~');
      }
      this.mapa.push(fila);
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

  /** Toda la tinta: lo que no es fondo limpio. */
  tinta(): Punto[] {
    const out: Punto[] = [];
    this.mapa.forEach((fila, y) => fila.forEach((c, x) => c !== 'F' && out.push({ x, y })));
    return out;
  }
}

/** ¿Hay algún píxel de clase `a` pegado (8-vecindad) a alguno de clase `b`? */
export function seTocanEn(an: AnalisisTarjeta, a: Clase, b: Clase): Punto[] {
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
 * CA-12 — una fila «tiene ojo» si dentro de ella aparece el patrón
 * `hueso → fondo → hueso` con al menos `minFondo` píxeles de fondo limpio en el hueco.
 * Los píxeles de mezcla del borde no suman ni restan, por el mismo motivo que en
 * `filaConOjo()` de SPEC-047: un antialiasing más o menos agresivo no cambia si la
 * letra está abierta.
 */
export function filaConOjoEn(an: AnalisisTarjeta, y: number, minFondo: number): boolean {
  const fila = an.mapa[y];
  if (!fila) return false;
  const huesos = fila.flatMap((c, x) => (c === 'H' ? [x] : []));
  for (let k = 0; k + 1 < huesos.length; k++) {
    const hueco = fila.slice(huesos[k] + 1, huesos[k + 1]);
    if (hueco.filter((c) => c === 'F').length >= minFondo) return true;
  }
  return false;
}

/** Las filas con ojo, separadas por la mitad de la caja envolvente del hueso. */
export function ojosEn(an: AnalisisTarjeta, minFondo: number) {
  const { y0, y1 } = caja(an.puntos('H'));
  const medio = (y0 + y1) / 2;
  const superiores: number[] = [];
  const inferiores: number[] = [];
  for (let y = y0; y <= y1; y++) {
    if (!filaConOjoEn(an, y, minFondo)) continue;
    if (y < medio) superiores.push(y);
    if (y > medio) inferiores.push(y);
  }
  return { superiores, inferiores, y0, y1 };
}

/**
 * Reducción por promedio de área — CA-12. El factor tiene que ser entero (1200→240 y
 * 630→126 son ×1/5 exactos), y se exige: un remuestreo con interpolación metería un
 * criterio propio en la medida, y lo que se quiere saber es si la marca sobrevive a
 * que la aplasten, no cuál es el mejor algoritmo para aplastarla.
 */
export function reducir(lienzo: Lienzo, ancho: number, alto: number): Lienzo {
  const fx = lienzo.ancho / ancho;
  const fy = lienzo.alto / alto;
  if (!Number.isInteger(fx) || !Number.isInteger(fy)) {
    throw new Error(`la reducción ${lienzo.ancho}×${lienzo.alto} → ${ancho}×${alto} no es entera`);
  }
  const data = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const suma = [0, 0, 0, 0];
      for (let sy = 0; sy < fy; sy++) {
        for (let sx = 0; sx < fx; sx++) {
          const p = pixel(lienzo, x * fx + sx, y * fy + sy);
          for (let k = 0; k < 4; k++) suma[k] += p[k];
        }
      }
      const i = (y * ancho + x) * 4;
      for (let k = 0; k < 4; k++) data[i + k] = Math.round(suma[k] / (fx * fy));
    }
  }
  return { ancho, alto, data };
}
