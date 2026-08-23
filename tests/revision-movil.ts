/**
 * SPEC-048 CA-10 — el analizador de la meta-guardia: **¿alimenta esta fuente una
 * aserción con un `git diff`/`show`/`log`/`rev-list` sobre una revisión móvil?**
 *
 * Es el mecanismo que hace cumplible RI-03 (ADR-031 pto. 4). La convención estaba
 * escrita en `FOUNDATION.md` desde el 2026-08-20 y aguantó **dos días**: SPEC-047
 * escribió dos guardias por diff contra `origin/main` y `main` se puso roja al mergear.
 * Una convención que sólo vive en prosa compite con la prisa, y pierde.
 *
 * Lo que se juzga y lo que no (CA-10.1 y CA-10.2):
 *
 * - Se juzga **código**. Los comentarios, los títulos de `describe` y los mensajes de
 *   aserción se descartan antes de mirar: el analizador tapa los comentarios y sólo
 *   considera un literal si cae **dentro de una invocación de git**. Nombrar
 *   `origin/main` en prosa —y hay que nombrarlo, porque el porqué se escribe al lado—
 *   no es una infracción.
 * - **No se prohíbe git en los tests, ni `HEAD` en general.** `git rev-parse HEAD` para
 *   obtener el sha actual (`tests/version-build-identity.test.ts`) es legítimo:
 *   `rev-parse` no está en la lista de subcomandos. Y pasar `HEAD` como **entrada** a un
 *   script bajo prueba (`tests/version-bump-gate.test.ts`) tampoco, porque la llamada no
 *   es a git. La regla es sobre **revisiones de diff/show/log**, no sobre usar git.
 *
 * Es análisis de texto sobre fuente, con los límites que eso tiene —el estilo que este
 * proyecto ya usa en `casos()` y `sinComentarios`—. No pretende ser una prueba: pretende
 * que colarlo requiera intención (ADR-031, §Consecuencias).
 */

/** Los subcomandos que TOMAN una revisión y la convierten en una comparación. */
export const SUBCOMANDOS = ['diff', 'show', 'log', 'rev-list'] as const;

/** Las cuatro dianas móviles que ADR-031 pto. 2.1 nombra. */
export const REVISIONES_MOVILES = ['origin/main', 'main', 'HEAD', '@'] as const;

/**
 * Relleno opaco de UN carácter: tapar conserva la longitud, así que el texto analizado
 * y la fuente original quedan alineados índice a índice y el mensaje de error puede citar
 * la invocación tal y como está escrita.
 */
const HUECO = '';

export type Infraccion = {
  /** La invocación tal y como está escrita, recortada para el mensaje de error. */
  invocacion: string;
  /** La revisión móvil encontrada. */
  revision: string;
};

type Literal = { inicio: number; valor: string };
type Analisis = { codigo: string; literales: Literal[] };

const ARRANQUE_DE_REGEX =
  /(^|[(,=:[!&|?{};+\-*%~^<>\n]|\b(?:return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await))\s*$/;

/**
 * Un pase por la fuente que devuelve dos cosas: el **código** con los comentarios, los
 * literales de cadena y los literales de expresión regular tapados con `HUECO` (para
 * poder contar paréntesis sin que un `(` dentro de un texto descoloque la cuenta), y la
 * lista de esos literales con su posición y su valor real.
 */
function analizar(src: string): Analisis {
  let i = 0;
  let codigo = '';
  const literales: Literal[] = [];
  const tapar = (desde: number, hasta: number) => {
    for (let k = desde; k < hasta; k++) codigo += src[k] === '\n' ? '\n' : HUECO;
  };

  while (i < src.length) {
    const c = src[i];
    const dos = src.slice(i, i + 2);

    if (dos === '//') {
      const fin = src.indexOf('\n', i);
      const hasta = fin === -1 ? src.length : fin;
      tapar(i, hasta);
      i = hasta;
      continue;
    }

    if (dos === '/*') {
      const fin = src.indexOf('*/', i + 2);
      const hasta = fin === -1 ? src.length : fin + 2;
      tapar(i, hasta);
      i = hasta;
      continue;
    }

    if (c === '/' && ARRANQUE_DE_REGEX.test(codigo)) {
      let j = i + 1;
      let enClase = false;
      let cerrado = false;
      while (j < src.length) {
        const d = src[j];
        if (d === '\\') {
          j += 2;
          continue;
        }
        if (d === '\n') break;
        if (d === '[') enClase = true;
        else if (d === ']') enClase = false;
        else if (d === '/' && !enClase) {
          cerrado = true;
          break;
        }
        j++;
      }
      if (cerrado) {
        let fin = j + 1;
        while (fin < src.length && /[a-z]/.test(src[fin])) fin++;
        tapar(i, fin);
        i = fin;
        continue;
      }
    }

    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      let valor = '';
      while (j < src.length) {
        const d = src[j];
        if (d === '\\') {
          valor += src[j + 1] ?? '';
          j += 2;
          continue;
        }
        if (d === c) break;
        valor += d;
        j++;
      }
      literales.push({ inicio: codigo.length, valor });
      codigo += c;
      tapar(i + 1, Math.min(j, src.length));
      codigo += c;
      i = Math.min(j, src.length) + 1;
      continue;
    }

    codigo += c;
    i++;
  }

  return { codigo, literales };
}

/**
 * Los `const NOMBRE = 'literal'` y `const NOMBRE = { clave: 'literal' }` del fichero.
 * Hacen falta porque la forma en que SPEC-047 escribió el defecto era exactamente ésa:
 * `const BASE = 'origin/main'` y después `git('show', BASE + ':' + ruta)`. Sin resolver
 * el enlace, la infracción queda invisible.
 */
function enlaces({ codigo, literales }: Analisis): Map<string, string> {
  const out = new Map<string, string>();
  for (const lit of literales) {
    const antes = codigo.slice(Math.max(0, lit.inicio - 300), lit.inicio);
    const simple = /const\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*$/.exec(antes);
    if (simple) {
      out.set(simple[1], lit.valor);
      continue;
    }
    const objeto =
      /const\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*\{[^{}]*?([A-Za-z_$][\w$]*)\s*:\s*$/.exec(antes);
    if (objeto) out.set(`${objeto[1]}.${objeto[2]}`, lit.valor);
  }
  return out;
}

/** Las revisiones móviles que hay dentro de un texto que git leería como revisión. */
function movilesEn(valor: string, mapa: Map<string, string>): string[] {
  const resuelto = valor.replace(/\$\{([^}]*)\}/g, (_, expr: string) => {
    return mapa.get(expr.trim()) ?? HUECO;
  });
  return resuelto
    .split(/(?:\.{2,3}|[:^~\s])+/)
    .map((p) => p.trim())
    .filter((p) => (REVISIONES_MOVILES as readonly string[]).includes(p));
}

type Invocacion = { inicio: number; fin: number };

/** La llamada (paréntesis balanceados) que envuelve a una posición dada. */
function llamadaQueEnvuelve(codigo: string, posicion: number): Invocacion | null {
  let nivel = 0;
  let abre = -1;
  for (let k = posicion - 1; k >= 0; k--) {
    const c = codigo[k];
    if (c === ')') nivel++;
    else if (c === '(') {
      if (nivel === 0) {
        abre = k;
        break;
      }
      nivel--;
    }
  }
  if (abre < 0) return null;
  let profundidad = 0;
  let cierra = codigo.length - 1;
  for (let k = abre; k < codigo.length; k++) {
    const c = codigo[k];
    if (c === '(') profundidad++;
    else if (c === ')') {
      profundidad--;
      if (profundidad === 0) {
        cierra = k;
        break;
      }
    }
  }
  let ini = abre;
  while (ini > 0 && /[\w$.]/.test(codigo[ini - 1])) ini--;
  return { inicio: ini, fin: cierra + 1 };
}

/**
 * Las infracciones de RI-03 en una fuente: toda invocación de git que lleva un subcomando
 * de comparación y, como revisión, un nombre móvil.
 */
export function infraccionesEnFuente(src: string): Infraccion[] {
  const analisis = analizar(src);
  const { codigo, literales } = analisis;
  const mapa = enlaces(analisis);
  const encontradas: Infraccion[] = [];
  const vistas = new Set<string>();

  for (const lit of literales) {
    if (!(SUBCOMANDOS as readonly string[]).includes(lit.valor)) continue;
    const llamada = llamadaQueEnvuelve(codigo, lit.inicio);
    if (!llamada) continue;

    const dentro = literales.filter((l) => l.inicio >= llamada.inicio && l.inicio < llamada.fin);
    const nombre = codigo.slice(llamada.inicio, codigo.indexOf('(', llamada.inicio));
    const esGit =
      /\bgit\b/i.test(nombre) || dentro.some((l) => /(^|[\\/])git(\.exe)?$/i.test(l.valor));
    if (!esGit) continue;

    const trozo = codigo.slice(llamada.inicio, llamada.fin);
    const moviles = new Set<string>();
    for (const l of dentro) for (const rev of movilesEn(l.valor, mapa)) moviles.add(rev);
    for (const id of trozo.matchAll(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g)) {
      const valor = mapa.get(id[0]);
      if (valor !== undefined) for (const rev of movilesEn(valor, mapa)) moviles.add(rev);
    }

    for (const revision of moviles) {
      const invocacion = src.slice(llamada.inicio, llamada.fin).replace(/\s+/g, ' ').slice(0, 160);
      const clave = `${llamada.inicio}:${revision}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      encontradas.push({ invocacion, revision });
    }
  }

  return encontradas;
}
