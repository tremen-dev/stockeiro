import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-053 CA-1, CA-4, CA-5 y CA-6 / **ADR-033** — la versión vive en los dos ficheros.
 *
 * `npm version <segmento> --no-git-tag-version` escribe **dos** ficheros:
 * `package.json` y `package-lock.json`, y en el lock escribe **dos** campos —el
 * `version` de la raíz y el de `packages[""]`—. ADR-024 pto. 8 decía que editaba
 * *«`package.json` y nada más»*; su intención era el contraste con las etiquetas de
 * git, pero su letra es falsa y se leyó dos veces: SPEC-051 y SPEC-050 revirtieron a
 * mano el cambio del lock para no romper su propio conjunto cerrado de ficheros. El
 * resultado es que sobre `3b6fc8b` el producto era `0.3.4` y el lock declaraba
 * `0.3.2`. **ADR-033** enmienda esa cláusula y decide que el lock lleva la versión de
 * producto como espejo obligatorio de `package.json`.
 *
 * ESTO ES UNA PROPIEDAD, NO UN CRITERIO DE GATE (RI-03 / ADR-031 pto. 1). *«Los tres
 * campos coinciden»* es cierto sobre el **estado del árbol**, en cualquier momento y
 * para siempre. Por eso este fichero **lee los dos ficheros del disco y no invoca git
 * en absoluto**: sin `git diff`, sin `git show`, sin ventana de dos sha y sin salto
 * declarado por disponibilidad. Funciona igual en un clon superficial, sobrevive a
 * cualquier merge y no puede caducar el día que `main` avance — que es exactamente el
 * modo de fallo que `FOUNDATION.md` fijó el 2026-08-20 y que ADR-031 documentó.
 *
 * NACIÓ ROJA, Y ESO ES LA PRUEBA DE QUE MIRA ALGO. Escrita sobre `3b6fc8b` antes de
 * sincronizar nada, esta guardia falló por un defecto vivo (`0.3.4` ≠ `0.3.2`). Ese
 * rojo está pegado en el ledger de SPEC-053. La no-vacuidad no hubo que fabricarla.
 *
 * SI TE FALLA A TI: no edites el lock a mano. `npm install --package-lock-only`
 * sincroniza el número sin subirlo; `npm version <segmento> --no-git-tag-version` lo
 * sube y sincroniza a la vez. En los dos casos **los dos ficheros entran en el mismo
 * commit** (ADR-033 ptos. 4 y 5), y la spec que lo haga lista **los dos** en su
 * conjunto cerrado de ficheros.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PAQUETE = 'package.json';
const LOCK = 'package-lock.json';

/** La misma forma que exige el gate de versión y `resolveIdentity`: MAJOR.MINOR.PATCH. */
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Los tres campos que ADR-033 obliga a mantener iguales, con el rótulo con el que se leen. */
type Campos = { paquete: string; lockRaiz: string; lockPaquete: string };

const ROTULOS: Record<keyof Campos, string> = {
  paquete: `${PAQUETE} → version`,
  lockRaiz: `${LOCK} → version`,
  lockPaquete: `${LOCK} → packages[""].version`,
};

const leer = (nombre: string) => readFileSync(join(rootDir, nombre), 'utf8');

/**
 * Los tres campos, leídos del contenido de los dos ficheros. Pura: recibe texto y
 * devuelve valores, para que la mutación de CA-6 pueda ejercitar el camino entero
 * —parsear y comparar— sin escribir en el árbol.
 */
export function camposDeVersion(paqueteCrudo: string, lockCrudo: string): Campos {
  const paquete = JSON.parse(paqueteCrudo);
  const lock = JSON.parse(lockCrudo);
  return {
    paquete: String(paquete?.version),
    lockRaiz: String(lock?.version),
    lockPaquete: String(lock?.packages?.['']?.version),
  };
}

/**
 * Los campos que NO coinciden con `package.json`, que es la fuente de verdad (ADR-024
 * pto. 3, intacto). Lista vacía = los tres iguales.
 */
export function divergencias(campos: Campos): string[] {
  return (['lockRaiz', 'lockPaquete'] as const)
    .filter((campo) => campos[campo] !== campos.paquete)
    .map((campo) => ROTULOS[campo]);
}

/**
 * El rojo, escrito para que quien lo lea sepa salir de ahí (CA-5). Un
 * *«expected 0.3.2 to be 0.3.4»* deja al siguiente implementador donde estábamos: sin
 * saber qué fichero, sin saber que son dos campos y sin saber con qué comando se
 * arregla — que es justo el hueco por el que dos entregas revirtieron el lock.
 */
export function mensajeDeDeriva(campos: Campos): string {
  return [
    `Las versiones de ${PAQUETE} y ${LOCK} no coinciden (SPEC-053 CA-1 / ADR-033).`,
    '',
    'Los tres campos que tienen que decir lo mismo:',
    `  · ${ROTULOS.paquete}   = ${campos.paquete}   <- la fuente de verdad (ADR-024 pto. 3)`,
    `  · ${ROTULOS.lockRaiz}   = ${campos.lockRaiz}`,
    `  · ${ROTULOS.lockPaquete}   = ${campos.lockPaquete}`,
    '',
    `No edites ${LOCK} a mano. Lo sincroniza npm:`,
    '  npm install --package-lock-only            # reparar sin subir el numero',
    '  npm version <segmento> --no-git-tag-version # subirlo y sincronizar a la vez',
    '',
    `Y ${PAQUETE} y ${LOCK} entran LOS DOS EN EL MISMO COMMIT (ADR-033 pto. 4).`,
    'Si estas subiendo la version, tu spec lista LOS DOS ficheros en su conjunto',
    'cerrado (ADR-033 pto. 5): revertir el lock para no romper la acotacion es lo que',
    'produjo esta deriva dos veces.',
  ].join('\n');
}

const campos = () => camposDeVersion(leer(PAQUETE), leer(LOCK));

/** El mismo lock del árbol, con un campo cambiado. No escribe nada en disco. */
function conLockMutado(mutar: (lock: any) => void): Campos {
  const lock = JSON.parse(leer(LOCK));
  mutar(lock);
  return camposDeVersion(leer(PAQUETE), JSON.stringify(lock));
}

describe('SPEC-053 CA-1 y CA-4: la version vive en los dos ficheros y coincide', () => {
  it('los tres campos de version declaran exactamente lo mismo', () => {
    const actuales = campos();
    expect(divergencias(actuales), mensajeDeDeriva(actuales)).toEqual([]);
  });

  it('y los tres son un semver de producto, no una cadena cualquiera', () => {
    // Sin esto, un lock sin `packages[""]` daría `"undefined" === "undefined"` y la
    // comprobación de arriba pasaría comparando dos ausencias.
    const actuales = campos();
    for (const campo of ['paquete', 'lockRaiz', 'lockPaquete'] as const) {
      expect(actuales[campo], `${ROTULOS[campo]} no es MAJOR.MINOR.PATCH`).toMatch(SEMVER);
    }
  });
});

describe('SPEC-053 CA-5: el rojo ensena la salida, no obliga a deducirla', () => {
  const derivado: Campos = { paquete: '0.3.4', lockRaiz: '0.3.2', lockPaquete: '0.3.2' };
  const mensaje = mensajeDeDeriva(derivado);

  it('nombra los DOS ficheros', () => {
    expect(mensaje).toContain(PAQUETE);
    expect(mensaje).toContain(LOCK);
  });

  it('nombra los TRES campos, con su valor real', () => {
    expect(mensaje).toContain(ROTULOS.paquete);
    expect(mensaje).toContain(ROTULOS.lockRaiz);
    expect(mensaje).toContain(ROTULOS.lockPaquete);
    expect(mensaje).toContain('0.3.4');
    expect(mensaje).toContain('0.3.2');
  });

  it('dice CON QUE COMANDO se sincroniza, en los dos casos', () => {
    expect(mensaje).toContain('npm install --package-lock-only');
    expect(mensaje).toContain('npm version <segmento> --no-git-tag-version');
  });

  it('y dice que los dos ficheros entran en el mismo commit', () => {
    expect(mensaje).toMatch(/LOS DOS EN EL MISMO COMMIT/);
    expect(mensaje).toContain('ADR-033');
  });

  it('no se limita a un `expected X to be Y`: cabe la explicacion entera', () => {
    expect(mensaje.split('\n').length).toBeGreaterThan(8);
  });
});

describe('SPEC-053 CA-6: la guardia no puede ser un verde vacio', () => {
  const fuente = readFileSync(join(rootDir, 'tests', 'version-en-los-dos-ficheros.test.ts'), 'utf8');

  /**
   * Los tres tokens que convertirían esta guardia en decoración. Se construyen por
   * concatenación a propósito: escritos de una pieza aparecerían en este mismo fichero
   * y el caso se detectaría a sí mismo. Es el mismo recurso que usa la meta-guardia de
   * SPEC-048 con sus fragmentos infractores.
   */
  const PROHIBIDOS = [['sk', 'ip'].join(''), ['.on', 'ly'].join(''), ['to', 'do('].join('')];

  it('no contiene salto, `only` ni pendiente: se ejecuta siempre y en cualquier clon', () => {
    for (const token of PROHIBIDOS) {
      expect(fuente, `esta guardia contiene \`${token}\` y deja de ejecutarse siempre`).not.toContain(
        token,
      );
    }
  });

  it('CA-4 — y no invoca git en absoluto: es una propiedad del arbol, no un diff', () => {
    // ADR-031 pto. 2.1 / RI-03: lo que caduca al mergear es la comparación contra una
    // diana móvil. Aquí no hay diana: no hay git que invocar. Los tokens van partidos
    // por el mismo motivo que los de arriba: enteros se detectarían a sí mismos.
    const SIN_GIT = [
      ['child', '_process'].join(''),
      ['execFile', 'Sync'].join(''),
      ['origin', '/main'].join(''),
    ];
    for (const token of SIN_GIT) {
      expect(fuente, `esta guardia invoca git (\`${token}\`) y entonces puede caducar`).not.toContain(
        token,
      );
    }

    // Y la otra mitad, por si algún día se invoca git de otra forma: los únicos módulos
    // de Node que este fichero importa son los de leer un fichero y resolver su ruta.
    const importados = [...fuente.matchAll(/from '(node:[^']+)'/g)].map((m) => m[1]);
    expect([...new Set(importados)].sort()).toEqual(['node:fs', 'node:path', 'node:url']);
  });

  it('mutando el `version` de la raiz del lock, la guardia se pone ROJA', () => {
    const mutado = conLockMutado((lock) => {
      lock.version = '9.9.9';
    });
    expect(divergencias(mutado)).toContain(ROTULOS.lockRaiz);
  });

  it('mutando el `version` de `packages[""]`, tambien', () => {
    const mutado = conLockMutado((lock) => {
      lock.packages[''].version = '9.9.9';
    });
    expect(divergencias(mutado)).toContain(ROTULOS.lockPaquete);
  });

  it('mutando el de `package.json`, los DOS del lock quedan senalados', () => {
    // Es la deriva real: el número de producto se mueve y el lock se queda quieto.
    const actuales = campos();
    const mutado: Campos = { ...actuales, paquete: '9.9.9' };
    expect(divergencias(mutado)).toEqual([ROTULOS.lockRaiz, ROTULOS.lockPaquete]);
  });

  it('con los tres iguales, VERDE', () => {
    expect(divergencias({ paquete: '1.2.3', lockRaiz: '1.2.3', lockPaquete: '1.2.3' })).toEqual([]);
  });
});
