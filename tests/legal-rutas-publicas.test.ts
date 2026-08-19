import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPublicPath, PUBLIC_PREFIXES } from '@/lib/auth/guard';
import { RUTAS_LEGALES } from '@/lib/legal/content';

/**
 * SPEC-035 CA-2 — la excepción a RN-03 se DECLARA en un solo sitio y se ACOTA.
 *
 * Mismo patrón que SPEC-023 CA-15 (`tests/guard.test.ts`), y por la misma razón:
 * una ruta pública que nace de un descuido no se distingue de una que nace de una
 * decisión salvo porque la decisión está escrita y probada. `/legal` es pública
 * **por diseño** — quien llega de un foro tiene que poder leer quién opera esto
 * antes de teclear su email — y esa es toda la excepción que se concede.
 *
 * La segunda mitad es igual de importante: el `matcher` de `src/proxy.ts` NO
 * cambia. `/legal` ya entra en él, así que quien decide es el guard. Si mañana
 * alguien "arregla" el acceso público tocando el matcher, estará sacando `/legal`
 * del middleware entero —y con él cualquier control futuro—, no abriendo una
 * puerta. Este test lo pone en rojo.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('SPEC-035 CA-2: /legal y sus subrutas son públicas', () => {
  it('las cuatro rutas legales se alcanzan sin sesión', () => {
    for (const ruta of RUTAS_LEGALES) {
      expect(isPublicPath(ruta), `${ruta} tiene que ser pública (CA-1)`).toBe(true);
    }
  });

  it('el prefijo se declara en PUBLIC_PREFIXES, único sitio donde vive la excepción', () => {
    expect(PUBLIC_PREFIXES).toContain('/legal');
  });

  it('una ruta que solo SE PARECE no es pública', () => {
    expect(isPublicPath('/legalX')).toBe(false);
    expect(isPublicPath('/legal-admin')).toBe(false);
    expect(isPublicPath('/legales')).toBe(false);
  });

  it('las rutas de datos siguen exigiendo sesión', () => {
    for (const p of ['/dashboard', '/cartera', '/vigiladas', '/avisos', '/cartera/importar']) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});

describe('SPEC-035 CA-2: el matcher del proxy no cambia', () => {
  it('sigue siendo el de siempre — quien decide es el guard, no el matcher', () => {
    const proxy = readFileSync(join(rootDir, 'src', 'proxy.ts'), 'utf8');
    expect(proxy).toContain("matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']");
  });

  it('ninguna ruta concreta se cuela como excepción DENTRO del matcher', () => {
    // La propiedad es "el matcher no conoce rutas de producto", no "el fichero no
    // menciona /legal": los comentarios del proxy explican por qué la decisión vive
    // en el guard, y eso es justamente lo que se quiere que siga escrito ahí. Se
    // mira, por tanto, el literal del matcher y no el fichero entero.
    const proxy = readFileSync(join(rootDir, 'src', 'proxy.ts'), 'utf8');
    const literal = proxy.match(/matcher:\s*\[([\s\S]*?)\]/);
    expect(literal, 'no se encuentra el matcher en src/proxy.ts').not.toBeNull();

    for (const ruta of ['legal', 'login', 'register', 'forgot-password', 'reset-password']) {
      expect(literal![1], `"${ruta}" no se decide en el matcher, se decide en el guard`).not.toContain(
        ruta,
      );
    }
  });
});
