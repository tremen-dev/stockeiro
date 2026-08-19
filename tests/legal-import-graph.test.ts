import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-035 CA-14 (y la mitad estructural de CA-10) — lo que `/legal` y el pie
 * compartido NO pueden alcanzar.
 *
 * Mismo recorrido transitivo que `tests/version-import-graph.test.ts` (SPEC-031) y
 * por la misma razón: hoy ninguna de estas páginas toca la base **por accidente**
 * —nadie ha importado nada—, y el accidente no es una garantía. El grafo prueba la
 * propiedad que la spec exige: *"una página que explica el servicio y desaparece
 * cuando el servicio falla no sirve para lo que se escribió"*. El momento en que
 * alguien busca "quién opera esto y a quién reclamo" es precisamente el momento en
 * que algo va mal.
 *
 * El layout raíz entra en la lista de entradas a propósito: es el que envuelve a las
 * cuatro páginas, así que un `import` de base de datos allí las tumbaría igual que
 * uno dentro de ellas. Y el pie tiene además su propio motivo (CA-10): no consulta
 * la base porque no sabe quién eres — no hay sesión que leer ni contador que contar.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(rootDir, 'src');

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

const rel = (f: string) => relative(rootDir, f).replace(/\\/g, '/');

/** Todo lo que se renderiza al pedir una página de /legal. */
const ENTRADAS: Array<[string, string]> = [
  ['src/app/legal/page.tsx', 'CA-14: el índice legal'],
  ['src/app/legal/aviso-legal/page.tsx', 'CA-14: el aviso legal'],
  ['src/app/legal/privacidad/page.tsx', 'CA-14: la política de privacidad'],
  ['src/app/legal/terminos/page.tsx', 'CA-14: los términos'],
  ['src/app/layout.tsx', 'CA-14: el layout raíz envuelve a las cuatro'],
  ['src/app/app-footer.tsx', 'CA-10: el pie no consulta la base de datos'],
];

/** Prefijos de `src/` inalcanzables desde una página legal, y por qué. */
const PREFIJOS_PROHIBIDOS: Array<[string, string]> = [
  ['src/db', 'CA-14: tienen que responder con la base caída'],
  ['src/lib/market', 'CA-14: nada de cotizaciones para explicar quién opera esto'],
  ['src/lib/notifications', 'CA-10: el pie no cuenta avisos ni sabe de quién'],
  ['src/lib/portfolio', 'CA-14: nada de cartera'],
  ['src/lib/watchlist', 'CA-14: nada de vigiladas'],
];

/** Paquetes que SON un cliente de base de datos: importarlos ya es tocar la BD. */
const PAQUETES_DE_BD = [
  'drizzle-orm',
  'postgres',
  'pg',
  '@neondatabase/serverless',
  '@electric-sql/pglite',
];

describe('SPEC-035 CA-14 / CA-10: el grafo de imports de /legal y del pie', () => {
  it.each(ENTRADAS)('%s existe — %s', (ruta) => {
    expect(existsSync(join(rootDir, ruta))).toBe(true);
  });

  it('el recorrido no es vacío: las páginas legales llegan al módulo de contenido', () => {
    // Sin esto, un fallo del resolutor dejaría las comprobaciones de abajo en verde
    // sin haber mirado nada.
    for (const ruta of ['src/app/legal/aviso-legal/page.tsx', 'src/app/legal/privacidad/page.tsx']) {
      const alcanzado = walk(join(rootDir, ruta)).files.map(rel);
      expect(alcanzado, `${ruta} debería leer el contenido legal`).toContain(
        'src/lib/legal/content.ts',
      );
    }
  });

  it.each(ENTRADAS)('%s no alcanza ningún módulo prohibido — %s', (ruta) => {
    const alcanzado = walk(join(rootDir, ruta)).files.map(rel);
    for (const [prefijo, motivo] of PREFIJOS_PROHIBIDOS) {
      expect(
        alcanzado.filter((f) => f.startsWith(`${prefijo}/`)),
        `${ruta} alcanza ${prefijo} — ${motivo}`,
      ).toEqual([]);
    }
  });

  it.each(ENTRADAS)('%s no importa ningún cliente de base de datos — %s', (ruta) => {
    const { packages } = walk(join(rootDir, ruta));
    for (const pkg of packages) {
      const raiz = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
      expect(PAQUETES_DE_BD, `"${pkg}" es (o contiene) un cliente de BD`).not.toContain(raiz);
    }
  });

  it('CA-10: el pie no lee la sesión — ni Auth.js, ni el guard, ni server actions', () => {
    const pie = join(rootDir, 'src', 'app', 'app-footer.tsx');
    const { files, packages } = walk(pie);
    expect(packages).not.toContain('next-auth');
    expect(files.map(rel)).not.toContain('src/lib/auth/config.ts');
    // Ni el propio fichero lo hace a mano: `auth()` es la puerta y no se abre aquí.
    expect(readFileSync(pie, 'utf8')).not.toContain('auth(');
  });

  it('CA-14: el módulo de contenido es puro — ni Next, ni React, ni base de datos', () => {
    const contenido = join(srcDir, 'lib', 'legal', 'content.ts');
    const { files, packages } = walk(contenido);
    // Es la propiedad que lo hace reutilizable desde un test sin renderizar nada.
    expect(files.map(rel)).toEqual(['src/lib/legal/content.ts']);
    expect(packages).toEqual([]);
  });
});
