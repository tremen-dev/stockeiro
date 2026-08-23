/**
 * png.mjs — SPEC-051 CA-13. Un codificador de PNG sobre `node:zlib`, y nada más.
 *
 * SIN DEPENDENCIAS, por lo mismo que `icon-geometry.mjs` no las tiene: una librería de
 * imagen para escribir un rectángulo de color plano con dos formas encima es exactamente
 * lo que CE-M3 llama «no es una mejora», y un binario committeado que nadie sabe
 * regenerar es un callejón sin salida el día que haya que mover el punto medio píxel.
 *
 * El formato, para quien venga detrás y no quiera abrir la especificación:
 *
 *   firma │ IHDR │ IDAT… │ IEND
 *
 * Cada chunk es `longitud(4) · tipo(4) · datos · CRC32(4)`, todo big-endian, y el CRC
 * cubre el TIPO y los datos pero no la longitud. El cuerpo de IDAT es un flujo zlib con
 * las filas ya filtradas: cada scanline lleva delante un byte que dice con qué predictor
 * se escribió. Aquí se usa siempre el 2 (`Up`, resta la fila de encima), que en una
 * imagen con grandes zonas planas deja filas enteras a cero y las comprime a casi nada
 * — 1200×630 en RGBA son 3 MB crudos y salen unas decenas de kilobytes.
 *
 * `tests/tarjeta-raster.ts` trae un decodificador propio que verifica el CRC de cada
 * chunk y entiende los cinco filtros del estándar. Es a propósito: un test que le
 * preguntara a este fichero qué escribió no probaría nada (R-5).
 */

import { deflateSync } from 'node:zlib';

/** La firma que abre todo PNG. */
const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

/** CRC-32 tal y como lo define el PNG (el mismo polinomio de zip). */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Un chunk completo: longitud, tipo, datos y CRC. */
function trozo(tipo, datos) {
  const cabecera = Buffer.alloc(4);
  cabecera.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([cabecera, cuerpo, crc]);
}

/**
 * El PNG de un lienzo RGBA (fila a fila desde arriba, alfa recta).
 *
 * Tipo de color 6 (RGBA de 8 bits) y no 2 (RGB): CA-7 exige poder afirmar que **todos**
 * los píxeles son opacos, y un canal alfa presente y a 255 en todas partes es una
 * afirmación comprobable; un fichero sin canal alfa sólo permite decir que la pregunta
 * no se puede hacer.
 */
export function codificarPng(ancho, alto, rgba) {
  if (rgba.length !== ancho * alto * 4) {
    throw new Error(`el lienzo no mide ${ancho}×${alto}×4 (${rgba.length} bytes)`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // tipo de color: RGBA
  ihdr[10] = 0; // compresión: deflate
  ihdr[11] = 0; // filtrado: el estándar
  ihdr[12] = 0; // sin entrelazar

  const porFila = ancho * 4;
  const crudo = Buffer.alloc(alto * (porFila + 1));
  for (let y = 0; y < alto; y++) {
    const destino = y * (porFila + 1);
    crudo[destino] = 2; // filtro `Up`
    for (let x = 0; x < porFila; x++) {
      const actual = rgba[y * porFila + x];
      const encima = y > 0 ? rgba[(y - 1) * porFila + x] : 0;
      crudo[destino + 1 + x] = (actual - encima) & 0xff;
    }
  }

  return Buffer.concat([
    FIRMA,
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}
