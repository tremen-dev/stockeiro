import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-039 CA-14 (mitad estructural) — lo que la primera pantalla y `/ayuda` NO
 * pueden alcanzar.
 *
 * Mismo recorrido transitivo que `tests/version-import-graph.test.ts` (SPEC-031) y
 * `tests/legal-import-graph.test.ts` (SPEC-035), y por la misma razón: hoy ninguna de
 * estas dos páginas toca la base **por accidente** —nadie ha importado nada—, y el
 * accidente no es una garantía. Lo que el grafo prueba es la propiedad: la pantalla
 * que le explica el producto a un desconocido tiene que responder **cuando algo va
 * mal**, porque ese es exactamente el momento en que alguien la busca. Una ayuda que
 * desaparece con la base no sirve para lo que se escribió.
 *
 * La otra mitad de CA-14 —que no pidan un solo recurso a un tercero— la mide
 * Playwright interceptando la red en `tests/e2e/ayuda.spec.ts`.
 *
 * ## Qué SÍ puede alcanzar, y por qué no es una excepción
 *
 * `/ayuda` llega a `src/lib/market/`: `OPERATING_MICS`, `marketName` y
 * `FAIL_REASON_TEXT`. Es deliberado y es CA-6/CA-8 — la lista de mercados y los
 * motivos de «sin precio» se **derivan** del código en vez de copiarse, que es como
 * la ayuda llegó a prometer mercados que el proveedor no servía (EPIC-FIX). Esos tres
 * módulos son conocimiento de dominio: ni uno solo importa infraestructura, y este
 * fichero lo comprueba en vez de darlo por hecho.
 *
 * `/` llega a `src/lib/auth/public-session.ts` → `base-config.ts`, que es la config
 * EDGE-SAFE de Auth.js: decodifica la cookie y ya. La que tiene bcrypt y Postgres es
 * `src/lib/auth/config.ts`, y está en la lista de lo prohibido.
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

/** Todo lo que se renderiza al pedir una de las dos páginas públicas de esta spec. */
const ENTRADAS: Array<[string, string]> = [
  ['src/app/ayuda/page.tsx', 'CA-14: la ayuda'],
  ['src/app/page.tsx', 'CA-14: la primera pantalla'],
  ['src/lib/help/content.ts', 'CA-14: el contenido del que las dos beben'],
];

/** Prefijos y ficheros de `src/` inalcanzables desde ellas, y por qué. */
const PROHIBIDO: Array<[string, string]> = [
  ['src/db/', 'CA-14: tienen que responder con la base caída'],
  ['src/lib/notifications/', 'CA-14: no cuentan avisos ni saben de quién'],
  ['src/lib/portfolio/', 'CA-14: nada de cartera'],
  ['src/lib/watchlist/', 'CA-14: nada de vigiladas'],
  ['src/lib/account/', 'CA-14: nada de cuentas'],
  ['src/lib/registration/', 'CA-14: nada del grifo'],
  ['src/lib/auth/config.ts', 'CA-14: esa es la config de Node, con bcrypt y Postgres'],
  ['src/lib/auth/users.ts', 'CA-14: leer usuarios es tocar la base'],
  ['src/lib/auth/session.ts', 'CA-14: la frontera de sesión consulta el rol en la base'],
];

/** Paquetes que SON un cliente de base de datos: importarlos ya es tocar la BD. */
const PAQUETES_DE_BD = [
  'drizzle-orm',
  'postgres',
  'pg',
  '@neondatabase/serverless',
  '@electric-sql/pglite',
];

/**
 * Los módulos de dominio de los que la ayuda SÍ tira. Se listan aquí para poder
 * comprobar que siguen siendo lo que se creyó al apoyarse en ellos: si mañana
 * `mic.ts` importara el cliente de base de datos, `/ayuda` caería con él sin que
 * nadie hubiera tocado `/ayuda`.
 */
const FUENTES_DE_DOMINIO: Array<[string, string]> = [
  ['src/lib/market/mic.ts', 'CA-6: de aquí sale la lista de mercados'],
  ['src/lib/market/market-name.ts', 'CA-6: y de aquí su nombre de dominio'],
  ['src/lib/market/fail-reason-text.ts', 'CA-8: de aquí salen los motivos de «sin precio»'],
  ['src/lib/version/identity.ts', 'CA-13: de aquí sale la versión que viaja con el feedback'],
];

describe('SPEC-039 CA-14: el grafo de imports de / y de /ayuda', () => {
  it.each(ENTRADAS)('%s existe — %s', (ruta) => {
    expect(existsSync(join(rootDir, ruta))).toBe(true);
  });

  it('el recorrido no es vacío: la ayuda llega a su contenido y a los mercados', () => {
    // Sin esto, un fallo del resolutor dejaría todo lo de abajo en verde sin haber
    // mirado nada.
    const alcanzado = walk(join(rootDir, 'src/app/ayuda/page.tsx')).files.map(rel);
    expect(alcanzado).toContain('src/lib/help/content.ts');
    expect(alcanzado).toContain('src/lib/market/mic.ts');
    expect(alcanzado).toContain('src/lib/market/fail-reason-text.ts');
  });

  it.each(ENTRADAS)('%s no alcanza nada prohibido — %s', (ruta) => {
    const alcanzado = walk(join(rootDir, ruta)).files.map(rel);
    for (const [prefijo, motivo] of PROHIBIDO) {
      expect(
        alcanzado.filter((f) => f === prefijo || f.startsWith(prefijo)),
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

  it.each(FUENTES_DE_DOMINIO)('%s sigue siendo dominio puro — %s', (ruta) => {
    const { files, packages } = walk(join(rootDir, ruta));
    for (const [prefijo, motivo] of PROHIBIDO) {
      expect(
        files.map(rel).filter((f) => f === prefijo || f.startsWith(prefijo)),
        `${ruta} alcanza ${prefijo} — ${motivo}`,
      ).toEqual([]);
    }
    expect(packages, `${ruta} dejó de ser puro`).toEqual([]);
  });

  it('la ayuda no lee la sesión: ni Auth.js, ni el guard, ni server actions', () => {
    const pagina = join(rootDir, 'src', 'app', 'ayuda', 'page.tsx');
    const { packages } = walk(pagina);
    expect(packages).not.toContain('next-auth');
    expect(readFileSync(pagina, 'utf8')).not.toContain('use server');
  });

  it('la raíz solo llega a la config EDGE-SAFE de Auth.js, la que no tiene base', () => {
    const alcanzado = walk(join(rootDir, 'src/app/page.tsx')).files.map(rel);
    expect(alcanzado).toContain('src/lib/auth/base-config.ts');
    expect(alcanzado).not.toContain('src/lib/auth/config.ts');
  });
});
