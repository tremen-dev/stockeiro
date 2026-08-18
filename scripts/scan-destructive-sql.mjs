#!/usr/bin/env node
/**
 * scan-destructive-sql.mjs — ningún DROP pasa mudo.
 *
 * SPEC-032 / ADR-018 D-5.2. Escanea las migraciones de `drizzle/` buscando SQL
 * destructivo y **falla** si encuentra algo que nadie ha desbloqueado por
 * escrito. El freno pasa de *"el humano se acuerda de mirar"* a *"el humano
 * tiene que decir que sí por escrito"*.
 *
 *   node scripts/scan-destructive-sql.mjs            # == npm run db:scan
 *   node scripts/scan-destructive-sql.mjs --dir <ruta de un drizzle/>
 *   node scripts/scan-destructive-sql.mjs --help
 *
 * POR QUÉ ESCANEA TODO Y NO "LO NUEVO DE LA PR". ADR-018 D-5.2 lo describe como
 * *"escanea las migraciones nuevas de la PR"*, y una implementación por diff
 * necesita una rama base: no existe en un `push` a `main`, se comporta distinto
 * en local, depende de la profundidad del clonado y muere en un worktree.
 * Escanear todo siempre, con desbloqueos escritos, da EL MISMO VEREDICTO para
 * cada PR y deja documentadas las destructivas históricas, que es justo lo que
 * el ADR pide que alguien mire. Desvío de mecanismo, no de propiedad, firmado
 * por el humano en el gate del 2026-08-18.
 *
 * QUÉ MARCA (la lista de ADR-018 D-5.2, ni una más):
 *   DROP · RENAME · TRUNCATE · DELETE FROM ·
 *   ALTER COLUMN … SET NOT NULL · ALTER COLUMN … TYPE / SET DATA TYPE
 *
 * QUÉ NO MARCA, a propósito:
 *   - La palabra dentro de un comentario (de línea o de bloque) o de un literal
 *     de cadena: el análisis va sobre el SQL con ambos retirados.
 *   - `CREATE …`, `ADD COLUMN`, `ADD CONSTRAINT` ni nada aditivo.
 *   - `UPDATE`, aunque toque datos. La política expand/contract (RI-01,
 *     ADR-018 D-5.1) EXIGE el relleno; marcar los backfills marcaría la mitad
 *     sancionada del patrón y enseñaría a desbloquear por rutina, que es como se
 *     rompe un gate.
 *
 * EL DESBLOQUEO vive en `drizzle/destructive-waivers.json`, versionado, con una
 * entrada por migración marcada:
 *
 *   { "0007_tearful_roughhouse": {
 *       "spec": "SPEC-024",
 *       "reason": "…por qué hace falta destruir esto…",
 *       "rollback": "…cómo se vuelve atrás si sale mal…",
 *       "statements": 2 } }
 *
 * `statements` ata el permiso a lo que autoriza: si alguien edita una migración
 * ya desbloqueada para colarle una sentencia más, el conteo deja de cuadrar.
 *
 * CÓDIGOS DE SALIDA — son el contrato:
 *   0  limpio, o todo lo marcado está desbloqueado por escrito.
 *   1  hay SQL destructivo sin desbloquear, o un desbloqueo inválido o huérfano.
 *   2  uso incorrecto, o `drizzle/` ilegible.
 *
 * PROPIEDADES QUE HAY QUE CONSERVAR (las prueba tests/destructive-sql-scan.test.ts):
 *   - Solo importa de `node:*`, igual que la guardia y que `check-alive.mjs`.
 *   - No necesita git, ni una rama base, ni acceso a GitHub, ni red.
 *   - La CALIBRACIÓN es parte del contrato: sobre el árbol de hoy marca
 *     exactamente `0001` y `0007` de nueve. Una "mejora" que empiece a marcar
 *     `ADD COLUMN` se cae en rojo el mismo día, en vez de erosionar el gate
 *     hasta que se desbloquea todo por costumbre.
 */

import { argv, exit, stderr, stdout } from 'node:process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Códigos de salida. Contrato público: los consume el step de CI y `npm test`. */
export const SALIDA = { LIMPIO: 0, MARCADO: 1, USO: 2 };

/** El fichero de desbloqueos, dentro del propio directorio de migraciones. */
export const FICHERO_DE_DESBLOQUEOS = 'destructive-waivers.json';

/** Las cuatro claves que ADR-018 D-5.2 exige a un desbloqueo. */
export const CLAVES_DEL_DESBLOQUEO = ['spec', 'reason', 'rollback', 'statements'];

/** El separador que genera drizzle-kit. Es sintácticamente un comentario, así
 *  que hay que trocearlo ANTES de retirar comentarios o desaparece. */
const BREAKPOINT = '--> statement-breakpoint';

/** La lista de ADR-018 D-5.2. Ampliarla es fácil el día que un incidente lo
 *  justifique; hacerlo hoy, sin caso, sube la tasa de desbloqueos por rutina. */
export const PATRONES = [
  { nombre: 'DROP', regex: /\bdrop\b/i },
  { nombre: 'RENAME', regex: /\brename\b/i },
  { nombre: 'TRUNCATE', regex: /\btruncate\b/i },
  { nombre: 'DELETE FROM', regex: /\bdelete\s+from\b/i },
  {
    nombre: 'ALTER COLUMN … SET NOT NULL',
    regex: /\balter\s+column\s+(?:"[^"]*"|[\w$]+)\s+set\s+not\s+null\b/i,
  },
  {
    nombre: 'ALTER COLUMN … TYPE',
    regex: /\balter\s+column\s+(?:"[^"]*"|[\w$]+)\s+(?:set\s+data\s+)?type\b/i,
  },
];

const USO = `scan-destructive-sql.mjs — ningún DROP pasa mudo (SPEC-032 / ADR-018 D-5.2).

  node scripts/scan-destructive-sql.mjs
  node scripts/scan-destructive-sql.mjs --dir <ruta de un drizzle/>
  node scripts/scan-destructive-sql.mjs --help

  --dir <ruta>   Directorio de migraciones. Por defecto, el \`drizzle/\` del
                 repositorio. Se leen los \`.sql\` en el orden de
                 \`meta/_journal.json\`; no hace falta git, ni rama base, ni red.
  --help         Esto.

Marca: DROP · RENAME · TRUNCATE · DELETE FROM · ALTER COLUMN … SET NOT NULL ·
ALTER COLUMN … TYPE / SET DATA TYPE. No marca comentarios, literales, sentencias
aditivas ni \`UPDATE\` (el relleno es la mitad sancionada de expand/contract).

El desbloqueo es explícito, escrito y versionado, en \`${FICHERO_DE_DESBLOQUEOS}\`
dentro de ese mismo directorio, con \`spec\`, \`reason\`, \`rollback\` y \`statements\`.

Códigos de salida:
  0  limpio, o todo lo marcado está desbloqueado por escrito
  1  hay SQL destructivo sin desbloquear, o un desbloqueo inválido o huérfano
  2  uso incorrecto, o el directorio de migraciones es ilegible`;

/** Error de uso: se distingue de un veredicto para poder salir con 2. */
class ErrorDeUso extends Error {}

/**
 * Devuelve el SQL con los `--> statement-breakpoint` convertidos en `;` y los
 * comentarios y literales de cadena convertidos en espacios. La cadena
 * resultante tiene EXACTAMENTE la misma longitud y los mismos saltos de línea
 * que la original, para que los desplazamientos y los números de línea sigan
 * valiendo sobre el texto de verdad.
 *
 * @param {string} sql
 * @returns {string}
 */
export function normalizar(sql) {
  const salida = new Array(sql.length);
  const blanquear = (desde, hasta) => {
    for (let k = desde; k < hasta; k += 1) salida[k] = sql[k] === '\n' ? '\n' : ' ';
  };

  let i = 0;
  while (i < sql.length) {
    if (sql.startsWith(BREAKPOINT, i)) {
      salida[i] = ';';
      blanquear(i + 1, i + BREAKPOINT.length);
      i += BREAKPOINT.length;
      continue;
    }
    if (sql[i] === '-' && sql[i + 1] === '-') {
      let j = i;
      while (j < sql.length && sql[j] !== '\n') j += 1;
      blanquear(i, j);
      i = j;
      continue;
    }
    if (sql[i] === '/' && sql[i + 1] === '*') {
      let j = i + 2;
      while (j < sql.length && !(sql[j] === '*' && sql[j + 1] === '/')) j += 1;
      j = Math.min(sql.length, j + 2);
      blanquear(i, j);
      i = j;
      continue;
    }
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          j += 1;
          break;
        }
        j += 1;
      }
      blanquear(i, j);
      i = j;
      continue;
    }
    salida[i] = sql[i];
    i += 1;
  }
  return salida.join('');
}

/**
 * Trocea el SQL en sentencias, conservando el texto original de cada una y el
 * desplazamiento donde empieza.
 *
 * @param {string} sql
 * @returns {{ desplazamiento: number, analizable: string, original: string }[]}
 */
export function sentencias(sql) {
  const limpio = normalizar(sql);
  const trozos = [];
  let inicio = 0;
  for (let i = 0; i <= limpio.length; i += 1) {
    if (i === limpio.length || limpio[i] === ';') {
      const analizable = limpio.slice(inicio, i);
      if (analizable.trim() !== '') {
        const sangria = analizable.length - analizable.trimStart().length;
        trozos.push({
          desplazamiento: inicio + sangria,
          analizable,
          original: sql.slice(inicio + sangria, i),
        });
      }
      inicio = i + 1;
    }
  }
  return trozos;
}

const RECORTE = 120;

/**
 * La detección, pura: qué sentencias de este SQL son destructivas y por qué.
 *
 * @param {string} sql
 * @returns {{ linea: number, patron: string, sentencia: string }[]}
 */
export function detectar(sql) {
  const hallazgos = [];
  for (const trozo of sentencias(sql)) {
    for (const patron of PATRONES) {
      if (!patron.regex.test(trozo.analizable)) continue;
      const previo = sql.slice(0, trozo.desplazamiento);
      const recortada = trozo.original.trim().replace(/\s+/g, ' ');
      hallazgos.push({
        linea: previo.split('\n').length,
        patron: patron.nombre,
        sentencia:
          recortada.length > RECORTE ? `${recortada.slice(0, RECORTE)}…` : recortada,
      });
      break; // una sentencia = un hallazgo: el primer motivo basta para leerla.
    }
  }
  return hallazgos;
}

/**
 * Lee un directorio de migraciones y detecta sobre cada `.sql`, en el orden que
 * fija el journal (no el del sistema de ficheros).
 *
 * @param {string} dir
 * @returns {{ dir: string, ficheros: { tag: string, fichero: string, hallazgos: ReturnType<typeof detectar> }[], desbloqueos: Record<string, any> }}
 */
export function escanear(dir) {
  let journal;
  try {
    journal = JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf8'));
  } catch (error) {
    throw new ErrorDeUso(
      `No puedo leer ${join(dir, 'meta', '_journal.json')}: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const entradas = Array.isArray(journal?.entries) ? journal.entries : null;
  if (entradas === null) {
    throw new ErrorDeUso(`El journal de ${dir} no tiene una lista \`entries\`.`);
  }

  const ficheros = entradas.map((entrada) => {
    const tag = String(entrada?.tag ?? '');
    const fichero = `${tag}.sql`;
    let sql;
    try {
      sql = readFileSync(join(dir, fichero), 'utf8');
    } catch (error) {
      throw new ErrorDeUso(
        `El journal enumera ${fichero} pero no puedo leerlo: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return { tag, fichero, hallazgos: detectar(sql) };
  });

  let desbloqueos = {};
  const rutaDesbloqueos = join(dir, FICHERO_DE_DESBLOQUEOS);
  if (readdirSync(dir).includes(FICHERO_DE_DESBLOQUEOS)) {
    let crudo;
    try {
      crudo = JSON.parse(readFileSync(rutaDesbloqueos, 'utf8'));
    } catch (error) {
      throw new ErrorDeUso(
        `${rutaDesbloqueos} no es JSON válido: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (crudo === null || typeof crudo !== 'object' || Array.isArray(crudo)) {
      throw new ErrorDeUso(`${rutaDesbloqueos} debe ser un objeto JSON de tag → desbloqueo.`);
    }
    desbloqueos = crudo;
  }

  return { dir, ficheros, desbloqueos };
}

function esTextoUtil(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

/**
 * El veredicto: cruza lo detectado con lo desbloqueado.
 *
 * @param {ReturnType<typeof escanear>} escaneo
 * @returns {{ salida: number, problemas: string[], pendientes: Record<string, number> }}
 */
export function evaluar(escaneo) {
  const problemas = [];
  /** tag → nº de sentencias destructivas que habría que desbloquear. */
  const pendientes = {};
  const marcados = new Map(
    escaneo.ficheros.filter((f) => f.hallazgos.length > 0).map((f) => [f.tag, f]),
  );

  for (const [tag, fichero] of marcados) {
    const desbloqueo = escaneo.desbloqueos[tag];
    const cuantas = fichero.hallazgos.length;

    if (desbloqueo === undefined) {
      problemas.push(
        `${fichero.fichero}: ${cuantas} sentencia(s) destructiva(s) SIN desbloquear. ` +
          `Falta su entrada en ${FICHERO_DE_DESBLOQUEOS}.`,
      );
      pendientes[tag] = cuantas;
      continue;
    }
    if (desbloqueo === null || typeof desbloqueo !== 'object' || Array.isArray(desbloqueo)) {
      problemas.push(`${fichero.fichero}: su desbloqueo no es un objeto con las cuatro claves.`);
      pendientes[tag] = cuantas;
      continue;
    }

    const vacias = ['spec', 'reason', 'rollback'].filter((c) => !esTextoUtil(desbloqueo[c]));
    if (vacias.length > 0) {
      problemas.push(
        `${fichero.fichero}: el desbloqueo tiene ${vacias.join(', ')} vacío o ausente. ` +
          'Un desbloqueo sin justificación no es un desbloqueo: es una casilla marcada.',
      );
    }
    if (desbloqueo.statements !== cuantas) {
      problemas.push(
        `${fichero.fichero}: el desbloqueo dice statements=${JSON.stringify(desbloqueo.statements)} ` +
          `y hoy hay ${cuantas} sentencia(s) destructiva(s). Pon statements: ${cuantas} ` +
          'si el cambio es deliberado, y vuelve a leer la migración si no lo era.',
      );
    }
  }

  for (const tag of Object.keys(escaneo.desbloqueos)) {
    if (marcados.has(tag)) continue;
    const existe = escaneo.ficheros.some((f) => f.tag === tag);
    problemas.push(
      `${tag}: desbloqueo huérfano — ${
        existe ? 'esa migración ya no marca nada' : 'no hay ninguna migración con ese nombre'
      }. Un permiso que sobrevive a lo que permitía es ruido que enseña a no leer el fichero.`,
    );
  }

  return {
    salida: problemas.length === 0 ? SALIDA.LIMPIO : SALIDA.MARCADO,
    problemas,
    pendientes,
  };
}

/** El fragmento JSON exacto que hay que pegar, con los campos por rellenar. */
function pegable(pendientes) {
  const objeto = {};
  for (const [tag, cuantas] of Object.entries(pendientes)) {
    objeto[tag] = { spec: '', reason: '', rollback: '', statements: cuantas };
  }
  return JSON.stringify(objeto, null, 2);
}

/** @param {string[]} args */
function parsearArgs(args) {
  const raizDelRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let dir = join(raizDelRepo, 'drizzle');

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--help' || args[i] === '-h') return { ayuda: true, dir };
    if (args[i] === '--dir') {
      const valor = args[i + 1];
      if (valor === undefined || valor.startsWith('--')) {
        throw new ErrorDeUso('--dir necesita una ruta.');
      }
      dir = resolve(valor);
      i += 1;
      continue;
    }
    throw new ErrorDeUso(`Bandera desconocida: ${args[i]}.`);
  }
  return { ayuda: false, dir };
}

/** @param {string[]} args */
function main(args) {
  let opciones;
  try {
    opciones = parsearArgs(args);
  } catch (error) {
    stderr.write(`[scan-destructive-sql] ${error.message}\n\n${USO}\n`);
    return SALIDA.USO;
  }
  if (opciones.ayuda) {
    stdout.write(`${USO}\n`);
    return SALIDA.LIMPIO;
  }

  let escaneo;
  try {
    escaneo = escanear(opciones.dir);
  } catch (error) {
    stderr.write(`[scan-destructive-sql] ${error.message}\n`);
    return SALIDA.USO;
  }

  const veredicto = evaluar(escaneo);
  const marcados = escaneo.ficheros.filter((f) => f.hallazgos.length > 0);

  if (veredicto.salida === SALIDA.LIMPIO) {
    stdout.write(
      `[scan-destructive-sql] ${escaneo.ficheros.length} migración(es) escaneada(s) en ${opciones.dir}.\n`,
    );
    if (marcados.length === 0) {
      stdout.write('[scan-destructive-sql] Nada destructivo. LIMPIO.\n');
    } else {
      stdout.write(
        `[scan-destructive-sql] ${marcados.length} con SQL destructivo, todas desbloqueadas por ` +
          `escrito en ${FICHERO_DE_DESBLOQUEOS}:\n`,
      );
      for (const fichero of marcados) {
        const desbloqueo = escaneo.desbloqueos[fichero.tag];
        stdout.write(
          `[scan-destructive-sql]   ${fichero.fichero} — ${fichero.hallazgos.length} sentencia(s), ` +
            `desbloqueada por ${desbloqueo.spec}.\n`,
        );
      }
    }
    return SALIDA.LIMPIO;
  }

  stderr.write('[scan-destructive-sql] SQL DESTRUCTIVO sin desbloquear, o desbloqueo inválido.\n\n');

  for (const fichero of marcados) {
    if (veredicto.pendientes[fichero.tag] === undefined) continue;
    for (const hallazgo of fichero.hallazgos) {
      stderr.write(
        `  ${fichero.fichero}, línea ${hallazgo.linea} — ${hallazgo.patron}\n` +
          `    ${hallazgo.sentencia}\n`,
      );
    }
  }

  stderr.write('\n');
  for (const problema of veredicto.problemas) stderr.write(`  · ${problema}\n`);

  if (Object.keys(veredicto.pendientes).length > 0) {
    stderr.write(
      `\n[scan-destructive-sql] Si el cambio es deliberado, pega esto en ` +
        `${join(opciones.dir, FICHERO_DE_DESBLOQUEOS)} (fusiónalo con lo que ya haya) ` +
        'y rellena los tres campos vacíos — la spec que lo pide, por qué hace falta ' +
        'destruir esto, y cómo se vuelve atrás si sale mal:\n\n8<\n' +
        `${pegable(veredicto.pendientes)}\n>8\n`,
    );
  }

  return SALIDA.MARCADO;
}

const invocadoDirectamente =
  typeof argv[1] === 'string' && resolve(argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invocadoDirectamente) exit(main(argv.slice(2)));
