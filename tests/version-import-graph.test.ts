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
];

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
