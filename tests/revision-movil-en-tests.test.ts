import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { infraccionesEnFuente } from './revision-movil';

/**
 * SPEC-048 CA-10 — **la meta-guardia que hace cumplible RI-03**.
 *
 * ADR-031 pto. 4: una convención que sólo vive en prosa compite con la prisa y pierde.
 * `FOUNDATION.md` fijó el 2026-08-20 que un test de frontera fija una propiedad y no un
 * estado del árbol; **dos días después** SPEC-047 escribió dos guardias por diff contra
 * `origin/main` y `main` se puso roja al mergear la PR #52. Esto es lo que impide que
 * haya un sexto incidente: el defecto se cae en la PR que lo introduce, no en `main`.
 *
 * La afirmación es sobre el **árbol de hoy**, no sobre ningún diff: por eso este fichero
 * no necesita ventana, no invoca git y funciona en cualquier clon, superficial incluido.
 * Es, literalmente, la forma que ADR-031 pto. 1.1 recomienda antes que ninguna otra.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = join(rootDir, 'tests');

/** Todos los fuentes TypeScript bajo `tests/`: los `.test.ts`, los `.spec.ts` y los helpers. */
function fuentesDeTests(dir = testsDir): string[] {
  const out: string[] = [];
  for (const entrada of readdirSync(dir).sort()) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) out.push(...fuentesDeTests(ruta));
    else if (entrada.endsWith('.ts')) out.push(ruta);
  }
  return out;
}

/**
 * CA-10.3 — la meta-guardia se prueba a sí misma. Los fragmentos van dentro de cadenas a
 * propósito: así el analizador, que consume un literal entero de una pieza, no los lee
 * como código de ESTE fichero, y CA-10.4 puede seguir exigiendo cero infracciones aquí.
 */
const INFRACTOR = [
  "const BASE = 'origin/main';",
  "const tocados = () => git('diff', '--name-only', `${BASE}...HEAD`);",
].join('\n');

/** La misma forma, pero con la revisión escondida detrás de una concatenación. */
const INFRACTOR_CONCATENADO = [
  "const BASE = 'origin/main';",
  "const fuenteEnMain = (ruta) => git('show', BASE + ':' + ruta);",
].join('\n');

/** Lo que NO es infracción: la mención vive en un comentario y la revisión es fija. */
const INOCENTE_COMENTARIO = [
  '// Antes esto comparaba contra origin/main...HEAD y por eso caducó al mergear.',
  "const ENTREGA = { antes: '6da9fbe', despues: '104f94e' };",
  "const tocados = () => git('diff', '--name-only', `${ENTREGA.antes}...${ENTREGA.despues}`);",
].join('\n');

/** Tampoco lo es un título de `describe` que nombre la diana móvil (CA-10.1). */
const INOCENTE_TITULO = "describe('y el diff contra origin/main no toca lo que no debe', () => {});";

/** Ni `git rev-parse HEAD` para saber en qué sha estamos (CA-10.2). */
const INOCENTE_REV_PARSE = "const sha = execFileSync('git', ['rev-parse', 'HEAD']).trim();";

/** Ni pasar `HEAD` como ENTRADA a un script bajo prueba (CA-10.2). */
const INOCENTE_ENTRADA_DE_SCRIPT = "const { codigo } = ejecutar(['--base', 'HEAD']);";

describe('SPEC-048 CA-10.3: la meta-guardia se prueba a sí misma', () => {
  it('sobre un fragmento con la infracción, la detecta y nombra la revisión', () => {
    const infracciones = infraccionesEnFuente(INFRACTOR);
    expect(infracciones.length, 'la meta-guardia no ve el defecto que existe').toBeGreaterThan(0);
    expect(infracciones.map((i) => i.revision)).toContain('origin/main');
  });

  it('y también cuando la revisión llega concatenada desde una constante', () => {
    // Es la forma exacta que tenía `tests/icono-guardias-ampliadas.test.ts`:
    // `git('show', BASE + ':' + ruta)`. Si la meta-guardia sólo mirara los literales
    // escritos dentro de la llamada, este defecto —el real— se le escaparía.
    expect(infraccionesEnFuente(INFRACTOR_CONCATENADO).map((i) => i.revision)).toContain(
      'origin/main',
    );
  });

  it('sobre un fragmento que sólo la menciona en un comentario, no la detecta', () => {
    expect(infraccionesEnFuente(INOCENTE_COMENTARIO)).toEqual([]);
  });

  it('CA-10.1 — un título de describe que nombra la diana móvil no es infracción', () => {
    expect(infraccionesEnFuente(INOCENTE_TITULO)).toEqual([]);
  });

  it('CA-10.2 — `git rev-parse HEAD` sigue siendo legítimo', () => {
    expect(infraccionesEnFuente(INOCENTE_REV_PARSE)).toEqual([]);
  });

  it('CA-10.2 — pasar HEAD como entrada a un script bajo prueba sigue siendo legítimo', () => {
    expect(infraccionesEnFuente(INOCENTE_ENTRADA_DE_SCRIPT)).toEqual([]);
  });
});

describe('SPEC-048 CA-10.4: en tests/ no queda ni una revisión móvil alimentando una aserción', () => {
  it('cero infracciones en todo tests/**/*.ts', () => {
    const encontradas: string[] = [];
    for (const ruta of fuentesDeTests()) {
      for (const i of infraccionesEnFuente(readFileSync(ruta, 'utf8'))) {
        encontradas.push(`${relative(rootDir, ruta).replace(/\\/g, '/')}: ${i.revision} en ${i.invocacion}`);
      }
    }
    expect(
      encontradas,
      'RI-03 (ADR-031): un `git diff`/`show`/`log` que alimenta una aserción no puede tomar ' +
        'una revisión móvil. Si el criterio es "este cambio está acotado", su sitio es el ' +
        'gate; si se queda en la suite por auditoría, nace anclado a dos sha fijos.\n' +
        encontradas.join('\n'),
    ).toEqual([]);
  });

  it('y el barrido mira de verdad: encuentra los ficheros que dice mirar', () => {
    // Centinela del propio recorrido: sin esto, un `readdirSync` sobre el directorio
    // equivocado dejaría el caso de arriba en verde sin haber leído nada — que es la
    // misma vacuidad que SPEC-048 viene a arreglar.
    const vistos = fuentesDeTests().map((r) => relative(rootDir, r).replace(/\\/g, '/'));
    expect(vistos.length).toBeGreaterThan(50);
    for (const esperado of [
      'tests/icono-frontera.test.ts',
      'tests/icono-guardias-ampliadas.test.ts',
      'tests/deploy-gate-workflow.test.ts',
      'tests/neon-preview-cleanup-workflow.test.ts',
      'tests/version-bump-gate.test.ts',
      'tests/revision-movil.ts',
    ]) {
      expect(vistos).toContain(esperado);
    }
  });
});
