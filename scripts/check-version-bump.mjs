#!/usr/bin/env node
/**
 * check-version-bump.mjs — si tocas código, el número sube.
 *
 * SPEC-038 CA-12 / ADR-024 ptos. 9 y 10. Compara el campo `version` de
 * `package.json` en esta rama con el de `origin/main` y **falla** si el diff toca
 * código de aplicación y el número no ha aumentado.
 *
 *   node scripts/check-version-bump.mjs               # == npm run version:check
 *   node scripts/check-version-bump.mjs --base <ref>
 *   node scripts/check-version-bump.mjs --help
 *
 * POR QUÉ EXISTE. Un número que hay que acordarse de subir a mano acaba congelado,
 * y un `0.1.0` inmóvil durante seis meses **miente más que no tener número**:
 * afirma una identidad estable sobre artefactos distintos. Con testers fuera, la
 * versión del pie es lo que se cita en un reporte; si no se mueve, no dice nada.
 *
 * QUÉ SE AUTOMATIZA Y QUÉ NO (ADR-024 pto. 8). Se automatiza la **exigencia**, no
 * el **acto**: elegir `MAJOR`, `MINOR` o `PATCH` es un juicio de producto, y un
 * número que sube solo no distingue un arreglo de tipografía de una capacidad
 * nueva — sería un sha más largo y peor. Este script no escribe nada, no crea
 * etiquetas y no toca la rama: lee, compara y dice que no.
 *
 * QUÉ FICHEROS TOCA EL COMANDO QUE ESTE GATE RECOMIENDA (ADR-033, que **enmienda** el
 * pto. 8 de ADR-024). `npm version <segmento> --no-git-tag-version` edita **dos**
 * ficheros: `package.json` y `package-lock.json` —y en el lock, **dos** campos: el
 * `version` de la raíz y el de `packages[""]`—. Los dos ficheros entran en el
 * **mismo commit**, y la spec que suba el número los lista **los dos** en su conjunto
 * cerrado de ficheros. ADR-024 pto. 8 lo describió de otra forma; su intención era el contraste
 * con las etiquetas de git, pero su letra se leyó dos veces —SPEC-051 y SPEC-050— como
 * autoridad para revertir el lock, y de ahí salió una deriva de dos versiones (`0.3.4`
 * en el producto contra `0.3.2` en el lock). Para reparar el lock **sin** subir el
 * número: `npm install --package-lock-only`, que produce el mismo diff de dos líneas y
 * no re-resuelve dependencias. En ninguno de los dos casos se edita el lock a mano.
 * Este gate NO comprueba nada de eso —sigue comparando dos `package.json` y no mira el
 * lock (ADR-033 pto. 7)—: quien lo vigila es la propiedad
 * `tests/version-en-los-dos-ficheros.test.ts` (SPEC-053 CA-1).
 *
 * QUÉ CUENTA COMO CÓDIGO DE APLICACIÓN. Las rutas que ya declara la configuración
 * del proyecto (`.sdd.json` → `rutasVigiladas`), con `src/` como suelo. Se leen de
 * ahí a propósito: una segunda lista mantenida aquí divergiría de la primera el
 * día que alguien mueva una carpeta. Una PR **solo de documentación no exige
 * nada**, y eso es lo que hace el gate soportable.
 *
 * LA COMPARACIÓN ES SEMVER, NO TEXTUAL (ADR-024 pto. 10). `0.10.0` es mayor que
 * `0.9.0` aunque alfabéticamente sea al revés, y se exige **estrictamente mayor**,
 * de modo que bajar el número —un rebase mal resuelto— también se caza. Bajarlo
 * falla siempre, toque lo que toque el diff: no es "no subirlo", es afirmar que
 * este artefacto es anterior al que ya está en `main`.
 *
 * QUÉ SE JUZGA: lo que se MERGEARÍA. Las dos versiones y la lista de ficheros
 * salen de git (`git show <ref>:package.json`, `git diff base...HEAD`), no del
 * árbol de trabajo, porque lo que se despliega son commits. En CI eso es
 * exactamente el checkout; en local significa que **el bump y el código tienen que
 * estar commiteados** para que el gate los vea. Las dos mitades, no una:
 *   - si te adelantaste con el NÚMERO, el gate ve el anterior y te lo dice (`:405`);
 *   - si te adelantaste con el CÓDIGO, el rango `base...HEAD` no lo contiene, y ahí
 *     el gate **se abstiene con 2 en vez de decir 0** (SPEC-049).
 *
 * La segunda mitad faltaba y se pagó el 2026-08-23 (PR #56): ejecutado antes de
 * commitear, el gate respondió *«el diff no toca codigo de aplicacion»* y salió 0
 * sobre un `src/` que sí estaba tocado. Ese 0 se citó como evidencia en un mensaje
 * de commit y en el cuerpo de una PR, y la CI lo desmintió después. La abstención no
 * cae ante cualquier árbol sucio —eso dejaría en rojo permanente a quien está a
 * mitad de una spec—, sino sólo cuando el veredicto DEPENDE de lo pendiente:
 * `evaluarConPendientes` lo forma dos veces y compara el código de salida.
 *
 * CÓDIGOS DE SALIDA — son el contrato:
 *   0  no hace falta subir nada, o ya se subió.
 *   1  hay que subir el número y no se ha subido (o se ha bajado, o no es semver).
 *   2  uso incorrecto; no hay con qué comparar (base inalcanzable, git ausente); o
 *      hay código de aplicación pendiente sin commitear cuyo commit cambiaría el
 *      veredicto, y entonces el gate se abstiene en vez de emitirlo.
 *
 * El 2 es deliberado y no se degrada a 0: **un gate que no puede comparar no dice
 * verde**, y tampoco lo dice cuando el sujeto todavía no existe como commit. En CI
 * eso se ve como rojo con un mensaje que explica cuál de los tres motivos es —falta
 * el histórico (`fetch-depth: 0`), la bandera no existe, o hay trabajo sin
 * commitear—, que es información; un verde silencioso sería un gate vacío.
 *
 * PROPIEDADES QUE HAY QUE CONSERVAR (las prueba tests/version-bump-gate.test.ts):
 *   - Solo importa de `node:*`, igual que `scan-destructive-sql.mjs` y `check-alive.mjs`.
 *   - No sale a la red, no escribe en el árbol y solo invoca git para LEER.
 *   - La comparación es pura y se prueba caso a caso, separada de la parte que
 *     averigua qué ficheros cambiaron.
 */

import { argv, exit, stderr, stdout } from 'node:process';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Códigos de salida. Contrato público: los consume el step de CI. */
export const SALIDA = { LIMPIO: 0, MARCADO: 1, USO: 2 };

/** La raíz del repositorio, deducida de dónde vive este fichero. */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** La base por defecto. Es lo que la CI compara y lo que el humano compara en local. */
export const BASE_POR_DEFECTO = 'origin/main';

/**
 * `MAJOR.MINOR.PATCH` y nada más — la MISMA forma que acepta `resolveIdentity`
 * (`src/lib/version/identity.ts`, CA-8). Que las dos coincidan no es casualidad:
 * un número que pasara este gate pero no aquella validación saldría como
 * `unknown` en el pie y en `/api/version`, y el gate habría dejado pasar una
 * versión invisible.
 */
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Error de uso: se distingue de un veredicto para poder salir con 2. */
class ErrorDeUso extends Error {}

const USO = `check-version-bump.mjs — si tocas código, el número sube (SPEC-038 / ADR-024).

  node scripts/check-version-bump.mjs
  node scripts/check-version-bump.mjs --base <ref>
  node scripts/check-version-bump.mjs --help

  --base <ref>   Con qué se compara. Por defecto \`${BASE_POR_DEFECTO}\`. En CI hace
                 falta un checkout con historico (\`fetch-depth: 0\`); sin el, la
                 referencia no existe y el gate sale con 2 en vez de comparar.
  --help         Esto.

Juzga COMMITS, no el arbol de trabajo, y eso vale para las dos mitades: si acabas
de subir el numero y aun no lo has commiteado, el gate todavia ve el anterior (y
te lo dice); y si el codigo pendiente cambiaria el veredicto, el gate SE ABSTIENE
con 2 en vez de decir 0. Un 0 que no ha mirado nada acaba citado como evidencia.

Falla si el diff contra la base toca codigo de aplicacion y \`version\` de
package.json no ha AUMENTADO, y falla tambien si ha bajado. Una PR solo de
documentacion no exige nada.

Para subirlo:  npm version patch --no-git-tag-version
               npm version minor --no-git-tag-version
Guia (ADR-024 pto. 8): PATCH para un defecto, MINOR para una spec entregada,
MAJOR reservado para el 1.0.0. No se crean etiquetas de git: la identidad del
despliegue sigue siendo el commit.

Ese comando edita DOS ficheros —package.json y package-lock.json, y en el lock
los DOS campos \`version\`: el de la raiz y el de packages[""]— y los dos entran
en el MISMO COMMIT (ADR-033, que enmienda el pto. 8 de ADR-024). Tu spec los
lista los dos en su conjunto cerrado de ficheros. Para reparar el lock SIN subir
el numero: npm install --package-lock-only. No lo edites a mano. Lo vigila
tests/version-en-los-dos-ficheros.test.ts, no este gate.

Codigos de salida:
  0  no hace falta subir nada, o ya se subio
  1  hay que subirlo y no se ha subido (o se ha bajado, o no es semver)
  2  uso incorrecto; no hay con que comparar; o hay codigo de aplicacion
     pendiente sin commitear que cambiaria el veredicto (abstencion)`;

/**
 * Los tres segmentos de un semver de producto, o `null` si no lo es.
 *
 * @param {unknown} texto
 * @returns {[number, number, number] | null}
 */
export function parsearSemver(texto) {
  if (typeof texto !== 'string') return null;
  const match = SEMVER.exec(texto);
  return match === null ? null : [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compara dos semver por segmento. Negativo si `a < b`, 0 si iguales, positivo si
 * `a > b`. Lanza si alguno no es un semver: comparar basura en silencio es peor
 * que no comparar.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compararSemver(a, b) {
  const izquierda = parsearSemver(a);
  const derecha = parsearSemver(b);
  if (izquierda === null || derecha === null) {
    throw new ErrorDeUso(`No puedo comparar "${a}" con "${b}": alguno no es MAJOR.MINOR.PATCH.`);
  }
  for (let i = 0; i < 3; i += 1) {
    if (izquierda[i] !== derecha[i]) return izquierda[i] - derecha[i];
  }
  return 0;
}

/**
 * Las rutas de aplicación: `src/` más las que el proyecto ya declara vigiladas.
 *
 * ADR-024 pto. 9 lo dice así de literal, y por eso se leen de `.sdd.json` en vez
 * de escribirse aquí: una segunda lista divergiría de la primera. Si el fichero
 * falta o no se puede leer, queda `src/` como suelo — el gate no se queda sin
 * criterio por un fichero de configuración ausente.
 *
 * @param {string} [ficheroConfig]
 * @returns {string[]}
 */
export function rutasDeAplicacion(ficheroConfig = join(RAIZ, '.sdd.json')) {
  const rutas = new Set(['src/']);
  try {
    const config = JSON.parse(readFileSync(ficheroConfig, 'utf8'));
    if (Array.isArray(config?.rutasVigiladas)) {
      for (const ruta of config.rutasVigiladas) {
        if (typeof ruta === 'string' && ruta.trim() !== '') rutas.add(ruta.trim());
      }
    }
  } catch {
    // Sin configuración legible, `src/` basta.
  }
  return [...rutas].sort();
}

/**
 * Normaliza una ruta a segmentos con `/`, para comparar igual en Windows y en el
 * runner de CI.
 *
 * Se hace con `split`/`join` y no con un `replace` de expresión regular a
 * propósito: un literal de regex que case la barra invertida rompe la carga de
 * este fichero desde Vitest 2.1 —`SyntaxError: Invalid or unexpected token` al
 * importar el `.mjs`, aunque Node y esbuild lo parseen sin quejarse—, y el test
 * que prueba este gate importa de aquí. Ocurre también si ese literal aparece
 * dentro de un COMENTARIO, así que aquí ni se escribe. Aislado el 2026-08-20.
 */
const normalizar = (ruta) => {
  const conBarras = String(ruta).split('\\').join('/');
  return conBarras.startsWith('./') ? conBarras.slice(2) : conBarras;
};

/**
 * De los ficheros dados, los que caen bajo una ruta de aplicación.
 *
 * La comparación es **por segmento de ruta**, no por prefijo de cadena: `srcado/`
 * no es `src/`, y un prefijo pelado lo daría por bueno.
 *
 * @param {string[]} ficheros
 * @param {string[]} rutas
 * @returns {string[]}
 */
export function tocanCodigoDeAplicacion(ficheros, rutas) {
  const prefijos = rutas.map((r) => (normalizar(r).endsWith('/') ? normalizar(r) : `${normalizar(r)}/`));
  return ficheros.filter((fichero) => {
    const limpio = normalizar(fichero);
    return prefijos.some((prefijo) => limpio.startsWith(prefijo));
  });
}

/**
 * Hasta diez ficheros, uno por línea. Vive fuera de los mensajes para que la lista de
 * la abstención (SPEC-049 CA-8.2) tenga literalmente el mismo recorte y el mismo
 * formato que la de `sin-subir`, en vez de una copia que se les separe.
 *
 * @param {string[]} ficheros
 * @returns {string}
 */
function listar(ficheros) {
  const muestra = ficheros.slice(0, 10).map((f) => `  · ${normalizar(f)}`).join('\n');
  const resto = ficheros.length > 10 ? `\n  … y ${ficheros.length - 10} mas.` : '';
  return `${muestra}${resto}`;
}

/**
 * El veredicto, puro: qué pasa con este diff y estas dos versiones.
 *
 * @param {{ ficheros: string[], versionBase: string, versionRama: string, rutas: string[] }} entrada
 * @returns {{ salida: number, motivo: string, tocados: string[], mensaje: string }}
 */
export function evaluar({ ficheros, versionBase, versionRama, rutas }) {
  const tocados = tocanCodigoDeAplicacion(ficheros, rutas);

  if (parsearSemver(versionRama) === null || parsearSemver(versionBase) === null) {
    const culpable = parsearSemver(versionRama) === null ? versionRama : versionBase;
    return {
      salida: SALIDA.MARCADO,
      motivo: 'semver-invalido',
      tocados,
      mensaje:
        `La version de package.json no tiene forma de semver de producto: "${culpable}".\n` +
        'Tiene que ser MAJOR.MINOR.PATCH, sin `v` delante, sin prelanzamiento y sin\n' +
        'metadatos de build. Cualquier otra cosa la sirve /api/version como `unknown`\n' +
        '(SPEC-038 CA-8) y el pie la enseña como desconocida, que es peor que no tenerla.',
    };
  }

  const comparacion = compararSemver(versionRama, versionBase);

  if (comparacion < 0) {
    return {
      salida: SALIDA.MARCADO,
      motivo: 'bajada',
      tocados,
      mensaje:
        `La version BAJA: ${versionBase} en la base y ${versionRama} en esta rama.\n` +
        'Suele ser un rebase mal resuelto. Bajarla no es "no subirla": afirma que este\n' +
        `artefacto es anterior al que ya esta desplegado. Recupera al menos ${versionBase}\n` +
        'y sube desde ahi con `npm version <segmento> --no-git-tag-version`.',
    };
  }

  if (tocados.length === 0) {
    return {
      salida: SALIDA.LIMPIO,
      motivo: 'sin-codigo',
      tocados,
      mensaje: 'El diff no toca codigo de aplicacion: no hay nada que subir.',
    };
  }

  if (comparacion === 0) {
    return {
      salida: SALIDA.MARCADO,
      motivo: 'sin-subir',
      tocados,
      mensaje:
        `Esta rama toca codigo de aplicacion y deja la version en ${versionRama}, la misma\n` +
        'que la base. Un numero que no se mueve afirma una identidad estable sobre\n' +
        'artefactos distintos, y con testers fuera eso convierte cada reporte en una ida\n' +
        'y vuelta.\n\n' +
        `Ficheros que lo disparan:\n${listar(tocados)}\n\n` +
        'Subelo y vuelve a intentarlo:\n' +
        '  npm version patch --no-git-tag-version   # corregiste un defecto\n' +
        '  npm version minor --no-git-tag-version   # entregaste una spec\n\n' +
        'Ese comando edita DOS ficheros —package.json y package-lock.json— y los dos\n' +
        'entran en el MISMO COMMIT (ADR-033, que enmienda el pto. 8 de ADR-024). No\n' +
        'reviertas el lock: tu spec lista los dos ficheros en su conjunto cerrado, y si\n' +
        'solo commiteas package.json la suite se pone roja\n' +
        '(tests/version-en-los-dos-ficheros.test.ts).\n\n' +
        'No crea etiquetas de git a proposito (ADR-024 pto. 8): la identidad del\n' +
        'despliegue sigue siendo el commit.',
    };
  }

  return {
    salida: SALIDA.LIMPIO,
    motivo: 'subida',
    tocados,
    mensaje: `La version sube de ${versionBase} a ${versionRama}.`,
  };
}

/**
 * El contraste de SPEC-049 CA-1, también puro: **¿depende este veredicto de lo que
 * todavía no está commiteado?**
 *
 * El gate juzga commits, así que con el trabajo aún en el árbol el rango `base...HEAD`
 * está vacío y `evaluar` responde `sin-codigo` → 0. Ese 0 no significa "todo en orden":
 * significa que no ha mirado nada, y el 2026-08-23 (PR #56) se citó como evidencia en
 * un mensaje de commit y en el cuerpo de una PR antes de que la CI dijera lo contrario
 * sobre los mismos ficheros.
 *
 * La regla no es "si el árbol está sucio, plántate" —eso dejaría en rojo permanente a
 * quien está a mitad de una spec, y un rojo permanente acaba desactivado—. Es: forma el
 * veredicto DOS veces, con la misma base y las mismas dos versiones **commiteadas**,
 * cambiando únicamente la lista de ficheros por *diff ∪ pendientes*. Si el código de
 * salida coincide, lo pendiente no puede cambiar la respuesta y se emite el primero tal
 * cual. Si difiere, no se emite ninguno: `USO` (2).
 *
 * Se compara el **código de salida** y no el motivo a propósito: lo que se consume
 * aguas arriba es el código, y un `sin-codigo` que al commitear pasara a `subida` sigue
 * siendo un 0 honesto. Por eso una rama que ya subió el número no se bloquea por su
 * propio `src/` sucio, y un `sin-subir` legítimo se emite entero en vez de degradarse a
 * una negativa: el 1 es el mejor diagnóstico que este script sabe dar.
 *
 * @param {{ ficheros: string[], pendientes: string[], versionBase: string, versionRama: string, rutas: string[] }} entrada
 * @returns {{ salida: number, motivo: string, tocados: string[], pendientes: string[], mensaje: string }}
 */
export function evaluarConPendientes({ ficheros, pendientes, versionBase, versionRama, rutas }) {
  const veredicto = evaluar({ ficheros, versionBase, versionRama, rutas });
  const pendientesDeAplicacion = tocanCodigoDeAplicacion(pendientes, rutas);
  const emitir = () => ({ ...veredicto, pendientes: pendientesDeAplicacion });

  if (pendientes.length === 0) return emitir();

  const union = [...new Set([...ficheros, ...pendientes])];
  const conPendientes = evaluar({ ficheros: union, versionBase, versionRama, rutas });
  if (conPendientes.salida === veredicto.salida) return emitir();

  return {
    salida: SALIDA.USO,
    motivo: 'pendiente-sin-commitear',
    tocados: veredicto.tocados,
    pendientes: pendientesDeAplicacion,
    mensaje:
      'No puedo emitir un veredicto: hay codigo de aplicacion pendiente sin commitear.\n\n' +
      'Este gate juzga COMMITS —es lo que se mergea—, y con estos ficheros dentro el\n' +
      'veredicto cambiaria. Contestar ahora seria afirmar por escrito algo que el commit\n' +
      'siguiente desmiente, y esa afirmacion viaja: acaba citada en un mensaje de commit\n' +
      'o en el cuerpo de una PR.\n\n' +
      `Pendientes en el arbol de trabajo:\n${listar(pendientesDeAplicacion)}\n\n` +
      'Commitealos —o guardalos aparte con `git stash`— y vuelve a pasar el gate.',
  };
}

/**
 * Ejecuta git para LEER, y traduce cualquier fallo a un error de uso.
 *
 * @param {string[]} args
 * @returns {string}
 */
function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: RAIZ,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (error) {
    throw new ErrorDeUso(
      `\`git ${args.join(' ')}\` ha fallado: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** El campo `version` de un `package.json` en una referencia dada. */
function versionEn(ref) {
  let crudo;
  try {
    crudo = git(['show', `${ref}:package.json`]);
  } catch {
    throw new ErrorDeUso(
      `No puedo leer package.json en "${ref}". Si esto es CI, al checkout le falta el\n` +
        'historico: `fetch-depth: 0` en actions/checkout. En local, `git fetch origin main`.',
    );
  }
  try {
    return String(JSON.parse(crudo).version);
  } catch (error) {
    throw new ErrorDeUso(
      `El package.json de "${ref}" no es JSON valido: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Lo que el arbol de trabajo tiene a medias: modificado, en el indice o sin
 * seguimiento. Es la ÚNICA lectura del árbol que entra en la decisión (SPEC-049), y
 * entra sólo para saber si el veredicto dependería de ella — nunca para juzgarla.
 *
 * `--porcelain` deja fuera lo que `.gitignore` ya excluye (CA-3): un `node_modules/`
 * o un artefacto de build no son trabajo a medias, y abstenerse por ellos dejaría el
 * gate en rojo permanente, que es como se desactiva un gate.
 *
 * @returns {string[]}
 */
function ficherosPendientes() {
  const entradas = git(['status', '--porcelain', '--untracked-files=all', '-z']).split('\0');
  const pendientes = [];
  for (let i = 0; i < entradas.length; i += 1) {
    const entrada = entradas[i];
    if (entrada.length < 4) continue;
    pendientes.push(entrada.slice(3));
    // Un renombrado o una copia traen la ruta de ORIGEN en la entrada siguiente.
    const estado = entrada.slice(0, 2);
    if ((estado.includes('R') || estado.includes('C')) && entradas[i + 1]) {
      pendientes.push(entradas[i + 1]);
      i += 1;
    }
  }
  return pendientes;
}

/**
 * La línea de CA-9: cuando el gate SÍ emite y hay pendientes, decir cuántos son y que
 * no han entrado. Es lo que impide leer un «el diff no toca codigo de aplicacion» como
 * «no hay codigo tocado» cuando lo hay, esperando en el árbol.
 *
 * @param {string[]} pendientes
 * @returns {string}
 */
function notaDePendientes(pendientes) {
  if (pendientes.length === 0) return '';
  const uno = pendientes.length === 1;
  return (
    `\n[check-version-bump] Ojo: ${pendientes.length} fichero${uno ? '' : 's'} de codigo de ` +
    `aplicacion ${uno ? 'sigue pendiente' : 'siguen pendientes'} en el arbol de trabajo y ` +
    `NO ${uno ? 'ha' : 'han'} entrado en este veredicto.\n`
  );
}

/** Los ficheros que cambian entre la base y HEAD, desde su ancestro comun. */
function ficherosCambiados(base) {
  return git(['diff', '--name-only', `${base}...HEAD`])
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea !== '');
}

/** @param {string[]} args */
function parsearArgs(args) {
  let base = BASE_POR_DEFECTO;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--help' || args[i] === '-h') return { ayuda: true, base };
    if (args[i] === '--base') {
      const valor = args[i + 1];
      if (valor === undefined || valor.startsWith('--')) {
        throw new ErrorDeUso('--base necesita una referencia.');
      }
      base = valor;
      i += 1;
      continue;
    }
    throw new ErrorDeUso(`Bandera desconocida: ${args[i]}.`);
  }
  return { ayuda: false, base };
}

/** @param {string[]} args */
function main(args) {
  let opciones;
  try {
    opciones = parsearArgs(args);
  } catch (error) {
    stderr.write(`[check-version-bump] ${error.message}\n\n${USO}\n`);
    return SALIDA.USO;
  }
  if (opciones.ayuda) {
    stdout.write(`${USO}\n`);
    return SALIDA.LIMPIO;
  }

  let veredicto;
  let base;
  let versionDeHead = '';
  try {
    // Que la referencia exista se comprueba ANTES de nada: si no, `git diff`
    // devolveria un error confuso y el mensaje no diria que falta el historico.
    git(['rev-parse', '--verify', `${opciones.base}^{commit}`]);
    base = opciones.base;
    versionDeHead = versionEn('HEAD');
    veredicto = evaluarConPendientes({
      ficheros: ficherosCambiados(base),
      pendientes: ficherosPendientes(),
      versionBase: versionEn(base),
      versionRama: versionDeHead,
      rutas: rutasDeAplicacion(),
    });
  } catch (error) {
    if (error instanceof ErrorDeUso) {
      stderr.write(
        `[check-version-bump] No hay con que comparar contra "${opciones.base}".\n` +
          `[check-version-bump] ${error.message}\n`,
      );
      return SALIDA.USO;
    }
    throw error;
  }

  // SPEC-049 CA-1: el veredicto dependia de lo que todavia no es un commit, asi que no
  // hay veredicto que emitir. Ni el de ahora ni el de despues: sale con 2 y lo explica.
  if (veredicto.motivo === 'pendiente-sin-commitear') {
    stderr.write(`[check-version-bump] Base: ${base}.\n\n`);
    stderr.write(`${veredicto.mensaje}\n`);
    return SALIDA.USO;
  }

  const nota = notaDePendientes(veredicto.pendientes);

  if (veredicto.salida === SALIDA.LIMPIO) {
    stdout.write(`[check-version-bump] Base: ${base}.\n`);
    stdout.write(`[check-version-bump] ${veredicto.mensaje}\n`);
    stdout.write(nota);
    return SALIDA.LIMPIO;
  }

  stderr.write(`[check-version-bump] Base: ${base}.\n\n`);
  stderr.write(`${veredicto.mensaje}\n`);
  stderr.write(nota);

  // El malentendido barato: has hecho el `npm version` y no lo has commiteado.
  // Este gate juzga commits, asi que todavia ve el anterior. Decirlo cuesta tres
  // lineas y ahorra el rato de mirar un rojo sin causa aparente.
  if (veredicto.motivo === 'sin-subir') {
    try {
      const enElArbol = String(
        JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version,
      );
      if (compararSemver(enElArbol, versionDeHead) > 0) {
        stderr.write(
          `\n[check-version-bump] Ojo: en el arbol de trabajo ya pone ${enElArbol}, pero ` +
            'todavia no esta commiteado.\n[check-version-bump] Este gate juzga commits ' +
            '—es lo que se mergea—, asi que commitea el bump y vuelve a pasarlo.\n',
        );
      }
    } catch {
      // Si no se puede leer, no pasa nada: es una ayuda, no parte del veredicto.
    }
  }

  return SALIDA.MARCADO;
}

const invocadoDirectamente =
  typeof argv[1] === 'string' && resolve(argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invocadoDirectamente) exit(main(argv.slice(2)));
