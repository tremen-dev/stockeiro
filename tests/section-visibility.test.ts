import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROLES,
  SECTIONS,
  DEFAULT_ROLE,
  canSee,
  isRole,
  visibleSections,
  type Role,
  type Section,
} from '@/lib/auth/sections';

/**
 * SPEC-034 CA-4 — la decisión de visibilidad es una función PURA y EXHAUSTIVA
 * (ADR-021 pto. 5).
 *
 * Aquí no se levanta nada: ni Auth.js, ni base de datos, ni Next. Es el mismo
 * patrón de `isPublicPath` (SPEC-001) e `isSessionEpochCurrent` (ADR-016 pto. 7):
 * la decisión se aísla del acceso a datos justo para que se pueda probar entera.
 *
 * Y se prueba ENTERA: las 18 casillas del producto (3 roles x 6 secciones) van una
 * a una, no por muestreo — un `for` sobre una tabla de expectativas escrita a mano.
 * Un muestreo dejaría fuera exactamente la casilla que algún día cambie sola.
 */

// La tabla de la verdad, escrita a mano y a propósito: si alguien cambia la
// jerarquía, esto no se adapta solo — se pone rojo y hay que decidir.
const ESPERADO: Record<Role, Record<Section, boolean>> = {
  tester: {
    panel: true,
    vigiladas: true,
    avisos: true,
    cartera: false,
    importar: false,
    operacion: false,
  },
  completo: {
    panel: true,
    vigiladas: true,
    avisos: true,
    cartera: true,
    importar: true,
    operacion: false,
  },
  admin: {
    panel: true,
    vigiladas: true,
    avisos: true,
    cartera: true,
    importar: true,
    operacion: true,
  },
};

describe('SPEC-034 CA-4: el catálogo de secciones', () => {
  it('tiene exactamente los tres roles de ADR-021 pto. 1', () => {
    expect([...ROLES]).toEqual(['tester', 'completo', 'admin']);
  });

  it('tiene exactamente las seis secciones que enumera CA-4', () => {
    expect([...SECTIONS].sort()).toEqual(
      ['avisos', 'cartera', 'importar', 'operacion', 'panel', 'vigiladas'].sort(),
    );
  });

  it('el rol por defecto de una cuenta nueva es tester (ADR-021 pto. 8)', () => {
    expect(DEFAULT_ROLE).toBe('tester');
  });

  it('isRole acepta los tres valores del dominio y rechaza cualquier otro', () => {
    for (const rol of ROLES) expect(isRole(rol)).toBe(true);
    for (const impostor of ['root', '', 'TESTER', 'Admin', null, undefined, 0, {}]) {
      expect(isRole(impostor), `isRole(${JSON.stringify(impostor)})`).toBe(false);
    }
  });
});

describe('SPEC-034 CA-4: las 18 combinaciones, una a una', () => {
  for (const rol of ROLES) {
    for (const seccion of SECTIONS) {
      const esperado = ESPERADO[rol][seccion];
      it(`${rol} ${esperado ? 'VE' : 'NO ve'} ${seccion}`, () => {
        expect(canSee(rol, seccion)).toBe(esperado);
      });
    }
  }

  it('el producto cartesiano cubierto es de 18 casillas, ni una menos', () => {
    expect(ROLES.length * SECTIONS.length).toBe(18);
  });
});

describe('SPEC-034 CA-4: la propiedad de cadena tester ⊂ completo ⊂ admin (ADR-021 pto. 1.a)', () => {
  it('no hay ninguna sección que un tester vea y un completo no', () => {
    const rotas = SECTIONS.filter((s) => canSee('tester', s) && !canSee('completo', s));
    expect(rotas).toEqual([]);
  });

  it('no hay ninguna sección que un completo vea y un admin no', () => {
    const rotas = SECTIONS.filter((s) => canSee('completo', s) && !canSee('admin', s));
    expect(rotas).toEqual([]);
  });

  it('la cadena es estricta: cada eslabón ve MÁS que el anterior', () => {
    expect(visibleSections('tester').length).toBeLessThan(visibleSections('completo').length);
    expect(visibleSections('completo').length).toBeLessThan(visibleSections('admin').length);
  });

  it('visibleSections devuelve justo las secciones que canSee aprueba, en orden de catálogo', () => {
    for (const rol of ROLES) {
      expect(visibleSections(rol)).toEqual(SECTIONS.filter((s) => canSee(rol, s)));
    }
  });
});

// ---------------------------------------------------------------------------
// CA-4: «La función NO lee la base, NO importa Next y se prueba sin levantar nada».
// Se comprueba con el mismo recorrido de grafo de imports que usa
// tests/version-import-graph.test.ts para /api/version (SPEC-031 CA-5).
// ---------------------------------------------------------------------------

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(rootDir, 'src');
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

function firstExisting(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

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

describe('SPEC-034 CA-4: el catálogo es puro (no lee la base, no importa Next)', () => {
  const sectionsFile = join(srcDir, 'lib', 'auth', 'sections.ts');

  it('el módulo vive donde ADR-021 pto. 5 lo pide, junto a guard.ts', () => {
    expect(existsSync(sectionsFile)).toBe(true);
  });

  it('no alcanza ningún módulo bajo src/db/', () => {
    const reached = walk(sectionsFile).files.map((f) => relative(rootDir, f).replace(/\\/g, '/'));
    expect(reached.filter((f) => f.startsWith('src/db/'))).toEqual([]);
  });

  it('no importa Next, ni Auth.js, ni ningún cliente de base de datos', () => {
    const { packages } = walk(sectionsFile);
    const prohibidos = [
      'next',
      'next-auth',
      'react',
      'drizzle-orm',
      'postgres',
      'pg',
      '@neondatabase/serverless',
      '@electric-sql/pglite',
      'bcryptjs',
    ];
    for (const pkg of packages) {
      const root = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
      expect(prohibidos, `"${pkg}" no puede entrar en el catálogo puro`).not.toContain(root);
    }
  });
});
