import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPublicPath } from '@/lib/auth/guard';
import { RUTAS_INDEXABLES } from '@/lib/seo/indexables';

/**
 * SPEC-065 CA-1 — una lista de rutas indexables, y sólo de rutas públicas.
 *
 * La comprobación vive en una función para poder ponerla roja con especímenes en los dos
 * sentidos (FOUNDATION, 2.º corolario): una lista con una ruta privada se caza; la lista
 * propuesta en el gate, no.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(rootDir, 'src');
const MODULO = join(srcDir, 'lib', 'seo', 'indexables.ts');

/** Lo que está mal en una lista de rutas indexables. Vacío = la lista es válida. */
function problemasDeLaLista(lista: readonly string[]): string[] {
  const problemas: string[] = [];
  if (lista.length === 0) problemas.push('la lista está vacía');
  if (!lista.includes('/')) problemas.push('la portada `/` no está en la lista');
  for (const ruta of lista) {
    if (!isPublicPath(ruta)) problemas.push(`${ruta} no es pública según isPublicPath`);
  }
  return problemas;
}

describe('SPEC-065 CA-1: una lista, y sólo de rutas públicas', () => {
  it('la lista real es válida: no vacía, con `/` y toda pública', () => {
    expect(problemasDeLaLista(RUTAS_INDEXABLES)).toEqual([]);
  });

  it('espécimen que NO debe cazar: la lista propuesta en el gate', () => {
    expect(problemasDeLaLista(['/', '/ayuda'])).toEqual([]);
  });

  it.each(['/dashboard', '/cuenta'])('espécimen que debe cazar: una lista con %s', (privada) => {
    expect(problemasDeLaLista(['/', '/ayuda', privada])).toEqual([
      `${privada} no es pública según isPublicPath`,
    ]);
  });

  it('espécimen que debe cazar: una lista vacía, o sin la portada', () => {
    expect(problemasDeLaLista([])).toContain('la lista está vacía');
    expect(problemasDeLaLista(['/ayuda'])).toEqual(['la portada `/` no está en la lista']);
  });
});

// ---------------------------------------------------------------------------
// El módulo es puro: mismo molde que `tests/legal-import-graph.test.ts`.
// ---------------------------------------------------------------------------

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx'];

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

function resolveLocal(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(srcDir, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else return null;
  for (const c of [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => join(base, `index${e}`))]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

function walk(entry: string, leer: (f: string) => string = (f) => readFileSync(f, 'utf8')) {
  const files = new Set<string>();
  const packages = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (files.has(current)) continue;
    files.add(current);
    for (const specifier of specifiersOf(leer(current))) {
      const local = resolveLocal(specifier, current);
      if (local === null) packages.add(specifier);
      else pending.push(local);
    }
  }
  const rel = (f: string) => relative(rootDir, f).replace(/\\/g, '/');
  return { files: [...files].map(rel), packages: [...packages] };
}

/** Lo que un grafo alcanza y que el módulo de D-1 no puede alcanzar. */
function impurezas(g: { files: string[]; packages: string[] }): string[] {
  return [
    ...g.packages.filter((p) => p === 'next' || p.startsWith('next/') || p.startsWith('next-auth')),
    ...g.packages.filter((p) => ['drizzle-orm', 'postgres', '@neondatabase/serverless'].includes(p)),
    ...g.files.filter((f) => f.startsWith('src/db/')),
  ];
}

describe('SPEC-065 CA-1: el módulo de la lista es puro', () => {
  it('su grafo de imports no alcanza Next, Auth.js ni src/db/', () => {
    const g = walk(MODULO);
    expect(g.files, 'centinela: el recorrido empieza en el módulo').toContain(
      'src/lib/seo/indexables.ts',
    );
    expect(impurezas(g)).toEqual([]);
  });

  it('espécimen que debe cazar: el mismo módulo importando Next o la base', () => {
    const conNext = walk(MODULO, (f) =>
      f === MODULO ? `import type { Metadata } from 'next';\n${readFileSync(f, 'utf8')}` : readFileSync(f, 'utf8'),
    );
    expect(impurezas(conNext)).toEqual(['next']);
    const conDb = walk(MODULO, (f) =>
      f === MODULO ? `import { db } from '@/db/client';\n${readFileSync(f, 'utf8')}` : readFileSync(f, 'utf8'),
    );
    expect(impurezas(conDb)).toContain('src/db/client.ts');
  });
});
