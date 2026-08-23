import { execFileSync } from 'node:child_process';

/**
 * SPEC-048 CA-1 — la maquinaria de una **ventana fija**: dos sha literales, y ninguna
 * revisión móvil.
 *
 * Existe porque ADR-031 pto. 2 obliga a que un criterio de gate conservado en la suite
 * nazca anclado, y porque la alternativa —copiar la fontanería en cada fichero— es lo
 * que produjo el rojo de `main` del 2026-08-22: tres aserciones medían
 * `git diff origin/main...HEAD` y, al mergear la PR #52, ese diff quedó vacío y se
 * invirtieron para siempre.
 *
 * La regla que este módulo hace fácil de cumplir: **las revisiones entran como
 * parámetro**, nunca escritas dentro de la invocación de git. Así el fichero que llama
 * declara su ventana en una constante con nombre, se lee de un vistazo cuál es, y la
 * meta-guardia de `tests/revision-movil-en-tests.test.ts` puede comprobar que ahí no hay
 * ningún nombre móvil.
 *
 * Todas las funciones toman el repositorio como primer argumento —y no dan por hecho el
 * árbol de trabajo— porque `tests/guardias-no-caducan.test.ts` (SPEC-048 CA-9) las evalúa
 * sobre un repositorio temporal que simula un futuro en el que `main` ya avanzó.
 */

/** Los dos extremos de una entrega que ya no puede cambiar. */
export type Ventana = { antes: string; despues: string };

/**
 * `git` sobre un repositorio concreto. `stdio` con `pipe` en stderr a propósito: hay
 * llamadas que se espera que fallen y un `fatal:` escupido en medio de la suite se lee
 * como un fallo que no es (mismo criterio que `tests/neon-preview-cleanup-workflow.test.ts`).
 */
export function git(repo: string, ...args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** ADR-031 pto. 2.3: ¿están los dos extremos en este clon? En uno superficial puede que no. */
export function hayVentana(repo: string, ventana: Ventana): boolean {
  try {
    for (const rev of [ventana.antes, ventana.despues]) {
      execFileSync('git', ['-C', repo, 'rev-parse', '--verify', `${rev}^{commit}`], {
        stdio: 'ignore',
      });
    }
    return true;
  } catch {
    return false;
  }
}

const lineas = (salida: string) =>
  salida
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** Todos los ficheros que cambiaron dentro de la ventana. */
export function ficherosDeLaVentana(repo: string, ventana: Ventana): string[] {
  return lineas(git(repo, 'diff', '--name-only', `${ventana.antes}...${ventana.despues}`));
}

/**
 * Los ficheros de `tests/` que la ventana **modificó** — no los que añadió. La distinción
 * es el fondo de SPEC-047 CA-18 y CA-19.1: una spec puede traer tests nuevos a puñados;
 * lo que no puede es editar los de otra sin arbitraje.
 */
export function testsModificadosEnLaVentana(repo: string, ventana: Ventana): string[] {
  return git(repo, 'diff', '--name-status', `${ventana.antes}...${ventana.despues}`, '--', 'tests/')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'))
    .filter(([tipo]) => tipo !== 'A')
    .map(([, f]) => f)
    .sort();
}

/**
 * Las líneas de **código** que la ventana quitó y añadió en un fichero. Los comentarios
 * se descartan: no son comportamiento, y lo que SPEC-047 CA-16 acota es el código.
 */
export function lineasDeCodigoDelDiff(
  repo: string,
  ventana: Ventana,
  ruta: string,
): { quitadas: string[]; anadidas: string[] } {
  const diff = git(repo, 'diff', '-U0', `${ventana.antes}...${ventana.despues}`, '--', ruta);
  const conSigno = (signo: '+' | '-') =>
    diff
      .split('\n')
      .filter((l) => l.startsWith(signo) && !l.startsWith(signo.repeat(3)))
      .map((l) => l.slice(1))
      .filter((l) => l.trim().length > 0)
      .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l));
  return { quitadas: conSigno('-'), anadidas: conSigno('+') };
}

/** El contenido de un fichero tal y como estaba en una revisión concreta. */
export function blob(repo: string, revision: string, ruta: string): string {
  return git(repo, 'show', `${revision}:${ruta}`);
}
