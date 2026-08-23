#!/usr/bin/env node
/**
 * build-icon.mjs — SPEC-047 CA-17 y SPEC-051 CA-13. Escribe los TRES activos de marca:
 * `icon.svg`, `favicon.ico` y `opengraph-image.png`.
 *
 *   npm run icon:build                 # → src/app/
 *   node scripts/build-icon.mjs --out <dir>
 *
 * Decía «los dos ficheros del icono» hasta el 2026-08-23, y desde que la tarjeta social
 * cuelga de aquí eso era falso: un documento de verdad que afirma algo que no es no es un
 * detalle, es un defecto (SPEC-051 D-8).
 *
 * Los tres salen del MISMO sitio a propósito —`scripts/icon-geometry.mjs`, la misma
 * geometría y los mismos tokens—, y por eso la tarjeta no estrena su propio `npm run`:
 * el generador que ya existía es el que la escribe, así que `package.json` no gana
 * ninguna clave en `scripts` (SPEC-051 D-8, arbitrado por el humano el 2026-08-23).
 *
 * Los binarios no se cometen a mano: este script es la única forma de producirlos.
 * `tests/icono-frontera.test.ts` (el `.ico` y el SVG) y `tests/tarjeta-frontera.test.ts`
 * (el PNG) lo ejecutan sobre un directorio temporal y comparan los bytes con los
 * committeados, así que un activo retocado por fuera se cae el mismo día (R-5).
 *
 * No instala nada, no sale a la red y no lee más entrada que el sistema de diseño.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { argv, exit, stderr, stdout } from 'node:process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { icoDelIcono, pngDeLaTarjeta, svgDelIcono, tokensDeMarca } from './icon-geometry.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO_POR_DEFECTO = join(RAIZ, 'src', 'app');

function destino(args) {
  const i = args.indexOf('--out');
  if (i === -1) return DESTINO_POR_DEFECTO;
  const valor = args[i + 1];
  if (!valor) {
    stderr.write('uso: node scripts/build-icon.mjs [--out <directorio>]\n');
    exit(2);
  }
  return resolve(valor);
}

const args = argv.slice(2);
if (args.includes('--help')) {
  stdout.write(
    'build-icon.mjs — genera src/app/icon.svg, src/app/favicon.ico y ' +
      'src/app/opengraph-image.png desde scripts/icon-geometry.mjs.\n' +
      '  --out <directorio>   escribe en otro sitio (lo usan los tests de frontera)\n',
  );
  exit(0);
}

const salida = destino(args);
const colores = tokensDeMarca();
mkdirSync(salida, { recursive: true });
writeFileSync(join(salida, 'icon.svg'), svgDelIcono(colores));
writeFileSync(join(salida, 'favicon.ico'), icoDelIcono(colores));
writeFileSync(join(salida, 'opengraph-image.png'), pngDeLaTarjeta(colores));
stdout.write(
  `marca escrita en ${salida}: icon.svg, favicon.ico y opengraph-image.png ` +
    `(${colores.fondo}, ${colores.hueso}, ${colores.acento})\n`,
);
