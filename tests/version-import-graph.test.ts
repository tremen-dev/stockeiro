import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-031 CA-5 y CA-7 — lo que `/api/version` NO puede alcanzar.
 *
 * Se recorre el grafo de imports TRANSITIVO desde el fichero de la ruta. El
 * porqué del grafo y no solo de la llamada: la llamada pasa hoy por accidente
 * (nadie ha importado la BD todavía); el grafo prueba la PROPIEDAD que exige
 * ADR-018 D-6 —"debe poder responder con la BD caída, es justo cuando más falta
 * hace"— y falla el día en que alguien añada un import inocente.
 *
 * CA-7 añade a la lista el ciclo de refresco. ADR-018 §Frontera lo escribe como
 * regla dura ("`/api/version` no dice nada de ciclos, y el resumen de ciclo no
 * dice nada de versiones") y las dos cosas sirven al mismo rol, así que la
 * presión para fusionarlas llegará. Un test lo impide; un párrafo, no.
 *
 * SPEC-038 CA-7 / ADR-024 pto. 7 lo AMPLÍA, sin relajar nada de lo anterior. Esa
 * spec añade una pieza que consume la identidad para pintarla —el módulo de
 * presentación y el pie compartido— y con ella la tentación evidente: poner el
 * formato "donde ya está el dato", dentro de `identity.ts`. Eso metería React y
 * medio proyecto en el grafo de una ruta cuya razón de ser es responder cuando
 * todo lo demás falla. Por eso la flecha va en UN SOLO SENTIDO —la presentación
 * importa la identidad; la identidad no importa la presentación— y hay dos
 * bloques nuevos abajo: uno mira el grafo de la ruta y el otro, el de
 * `identity.ts`. La lista de prefijos prohibidos crece; ninguna de las
 * comprobaciones de SPEC-031 se toca.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(rootDir, 'src');
const routeFile = join(srcDir, 'app', 'api', 'version', 'route.ts');

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx'];

/** Todos los especificadores de módulo que aparecen en un fichero. */
function specifiersOf(source: string): string[] {
  const patterns = [
    /(?:^|\n)\s*import\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

function firstExisting(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Resuelve a fichero del proyecto, o null si es un paquete de node_modules. */
function resolveLocal(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(srcDir, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else return null;

  return firstExisting([
    base,
    ...EXTENSIONS.map((ext) => base + ext),
    // Un `.js`/`.mjs` en el especificador que en realidad es TypeScript.
    ...EXTENSIONS.map((ext) => base.replace(/\.(m?js)$/, ext)),
    ...EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ]);
}

/** Ficheros del proyecto alcanzables desde `entry`, y paquetes externos citados. */
function walk(entry: string): { files: string[]; packages: string[] } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const pending = [entry];

  while (pending.length > 0) {
    const current = pending.pop()!;
    if (files.has(current)) continue;
    files.add(current);

    for (const specifier of specifiersOf(readFileSync(current, 'utf8'))) {
      const local = resolveLocal(specifier, current);
      if (local === null) packages.add(specifier);
      else pending.push(local);
    }
  }
  return { files: [...files], packages: [...packages] };
}

/** Prefijos de `src/` que el endpoint no puede alcanzar, y por qué. */
const FORBIDDEN_PREFIXES: Array<[string, string]> = [
  ['src/db', 'CA-5: debe poder responder con la BD caída (ADR-018 D-6)'],
  ['src/lib/market', 'CA-7: el ciclo de refresco (ADR-018 §Frontera)'],
  ['src/lib/triggers', 'CA-7: el ciclo de refresco (ADR-018 §Frontera)'],
  ['src/lib/notifications', 'CA-7: el ciclo de refresco (ADR-018 §Frontera)'],
  ['src/app/api/cron', 'CA-7: el ciclo de refresco (ADR-018 §Frontera)'],
  // SPEC-038 CA-7: la presentación consume la identidad, nunca al revés. Un
  // endpoint que arrastrara el pie arrastraría React, el sistema de diseño y todo
  // lo que el pie importe, y dejaría de poder responder con la base caída.
  ['src/app/app-footer', 'SPEC-038 CA-7: el endpoint no pinta nada (ADR-024 pto. 7)'],
  ['src/lib/feedback', 'SPEC-038 CA-7: el endpoint no compone enlaces (ADR-024 pto. 7)'],
  ['src/lib/legal', 'SPEC-038 CA-7: el endpoint no sirve textos legales'],
];

/** Ficheros concretos —no prefijos— que el endpoint tampoco puede alcanzar. */
const FORBIDDEN_FILES: Array<[string, string]> = [
  [
    'src/lib/version/presentation.ts',
    'SPEC-038 CA-7: la flecha va en un solo sentido (ADR-024 pto. 7)',
  ],
  ['src/app/app-footer.tsx', 'SPEC-038 CA-7: el endpoint no pinta nada'],
];

/** Paquetes de interfaz: si el endpoint los alcanza, es que se ha cruzado la frontera. */
const UI_PACKAGES = ['react', 'react-dom', 'next/link', 'next/font/google'];

/** Paquetes que SON un cliente de base de datos: importarlos ya es tocar la BD. */
const DB_PACKAGES = [
  'drizzle-orm',
  'postgres',
  'pg',
  '@neondatabase/serverless',
  '@electric-sql/pglite',
];

describe('SPEC-031 CA-5/CA-7: el grafo de imports de /api/version', () => {
  it('la ruta existe donde ADR-001 pide que viva un route handler', () => {
    expect(existsSync(routeFile)).toBe(true);
  });

  it('el recorrido no es vacío: llega al menos al módulo de identidad', () => {
    // Sin esto, un fallo del resolutor dejaría los tres tests de abajo en verde
    // sin haber mirado nada.
    const reached = walk(routeFile).files.map((f) => relative(rootDir, f).replace(/\\/g, '/'));
    expect(reached).toContain('src/lib/version/identity.ts');
  });

  it('no alcanza ningún módulo bajo src/db/ ni el ciclo de refresco', () => {
    const reached = walk(routeFile).files.map((f) => relative(rootDir, f).replace(/\\/g, '/'));
    for (const [prefix, motivo] of FORBIDDEN_PREFIXES) {
      const offenders = reached.filter((f) => f.startsWith(`${prefix}/`));
      expect(offenders, `${prefix} es inalcanzable desde /api/version — ${motivo}`).toEqual([]);
    }
  });

  it('no importa ningún cliente de base de datos', () => {
    const { packages } = walk(routeFile);
    for (const pkg of packages) {
      const root = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
      expect(DB_PACKAGES, `"${pkg}" es (o contiene) un cliente de BD`).not.toContain(root);
    }
  });
});

describe('SPEC-038 CA-7: la presentación no puede colarse en /api/version', () => {
  const alcanzados = () =>
    walk(routeFile).files.map((f) => relative(rootDir, f).replace(/\\/g, '/'));

  it('la pieza de presentación existe donde la spec dice que vive', () => {
    // Sin esto, mover o renombrar el módulo dejaría el resto del bloque en verde
    // sin haber mirado nada — el modo de fallo clásico de un test de frontera.
    expect(existsSync(join(srcDir, 'lib', 'version', 'presentation.ts'))).toBe(true);
  });

  it('el endpoint NO alcanza el módulo de presentación ni el pie', () => {
    const reached = alcanzados();
    for (const [fichero, motivo] of FORBIDDEN_FILES) {
      expect(reached, `${fichero} es inalcanzable desde /api/version — ${motivo}`).not.toContain(
        fichero,
      );
    }
  });

  it('el endpoint no arrastra la interfaz: ni React, ni el enrutado, ni las fuentes', () => {
    const { packages } = walk(routeFile);
    for (const pkg of packages) {
      expect(UI_PACKAGES, `"${pkg}" es interfaz, y el endpoint no pinta nada`).not.toContain(pkg);
    }
  });

  it('la IDENTIDAD no importa a la presentación: la flecha va en un solo sentido', () => {
    // Es la mitad que de verdad protege RI-02. Si `identity.ts` importara el
    // formato —"total, si está al lado"—, el grafo de la ruta se lo tragaría
    // entero por transitividad y el test de arriba seguiría pareciendo verde
    // hasta que alguien metiera un import de React tres capas más abajo.
    const identityFile = join(srcDir, 'lib', 'version', 'identity.ts');
    const reached = walk(identityFile)
      .files.map((f) => relative(rootDir, f).replace(/\\/g, '/'))
      .filter((f) => f !== 'src/lib/version/identity.ts');

    expect(
      reached,
      'src/lib/version/identity.ts no puede importar NADA del proyecto: es la hoja ' +
        'del grafo, y lo que la haga crecer crece también el grafo de /api/version.',
    ).toEqual([]);
  });

  it('el módulo de presentación SÍ importa la identidad, que es el sentido bueno', () => {
    // La otra mitad de "una sola fuente de verdad" (CA-5): si el formato dejara de
    // leer de `identity.ts`, es que se ha inventado un segundo sitio de donde
    // sacar el número, y el pie y el endpoint podrían decir cosas distintas.
    const presentacion = join(srcDir, 'lib', 'version', 'presentation.ts');
    const reached = walk(presentacion).files.map((f) => relative(rootDir, f).replace(/\\/g, '/'));

    expect(reached).toContain('src/lib/version/identity.ts');
  });
});
