#!/usr/bin/env node
/**
 * build-icon.mjs — SPEC-047 CA-17. Escribe los dos ficheros del icono.
 *
 *   npm run icon:build                 # → src/app/
 *   node scripts/build-icon.mjs --out <dir>
 *
 * El binario no se comete a mano: sale de `scripts/icon-geometry.mjs`, que es su
 * fuente, y este script es la única forma de producirlo. `tests/icono-frontera.test.ts`
 * lo ejecuta sobre un directorio temporal y compara los bytes con los committeados, así
 * que un `.ico` retocado por fuera se cae el mismo día (R-5).
 *
 * No instala nada, no sale a la red y no lee más entrada que el sistema de diseño.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { argv, exit, stderr, stdout } from 'node:process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { icoDelIcono, svgDelIcono, tokensDeMarca } from './icon-geometry.mjs';

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
    'build-icon.mjs — genera src/app/icon.svg y src/app/favicon.ico desde ' +
      'scripts/icon-geometry.mjs.\n  --out <directorio>   escribe en otro sitio (lo usa el test de CA-17)\n',
  );
  exit(0);
}

const salida = destino(args);
const colores = tokensDeMarca();
mkdirSync(salida, { recursive: true });
writeFileSync(join(salida, 'icon.svg'), svgDelIcono(colores));
writeFileSync(join(salida, 'favicon.ico'), icoDelIcono(colores));
stdout.write(`icono escrito en ${salida} (${colores.fondo}, ${colores.hueso}, ${colores.acento})\n`);
