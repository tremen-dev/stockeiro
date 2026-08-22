import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPublicPath, PUBLIC_PREFIXES } from '@/lib/auth/guard';
import { CUENTA_PATH, CUENTA_BORRADA_PATH } from '@/lib/account/routes';

/**
 * SPEC-036 CA-1 y CA-10 — las dos rutas de esta spec, y de qué lado de RN-03 cae
 * cada una.
 *
 * `/cuenta` es una pantalla de datos: exige sesión como cualquier otra. La página
 * de confirmación posterior al borrado es lo contrario y no puede no serlo — quien
 * acaba de borrarse **ya no tiene cuenta**, así que una página autenticada le daría
 * un rebote a `/login` en vez de la confirmación que CA-10 pide.
 *
 * La excepción se declara donde se declaran todas (`PUBLIC_PREFIXES`,
 * `src/lib/auth/guard.ts`) y NO en el matcher del proxy, por lo mismo que razonó
 * SPEC-035 CA-2: sacar una ruta del matcher la saca del middleware entero, que es
 * otra cosa y peor.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('SPEC-036 CA-1: /cuenta exige sesión (RN-03)', () => {
  it('no es pública, ni ella ni nada que cuelgue de ella', () => {
    expect(isPublicPath(CUENTA_PATH)).toBe(false);
    expect(isPublicPath(`${CUENTA_PATH}/lo-que-sea`)).toBe(false);
  });

  it('no se cuela como prefijo público por parecerse a la de confirmación', () => {
    // El emparejamiento de `isPublicPath` es por segmento completo, así que
    // `/cuenta-borrada` no abre `/cuenta`. Escrito porque es exactamente el error
    // que un `startsWith` mal puesto produciría, y su precio sería servir la
    // pantalla de borrado a cualquiera.
    expect(PUBLIC_PREFIXES).not.toContain(CUENTA_PATH);
    expect(isPublicPath(CUENTA_PATH)).toBe(false);
  });

  it('la ruta es la que promete /legal/privacidad, literalmente', () => {
    expect(CUENTA_PATH).toBe('/cuenta');
  });
});

describe('SPEC-036 CA-10: la confirmación del borrado es pública', () => {
  it('se alcanza sin sesión, que es el único estado posible tras borrarse', () => {
    expect(isPublicPath(CUENTA_BORRADA_PATH)).toBe(true);
  });

  it('la excepción se declara en PUBLIC_PREFIXES, único sitio donde vive', () => {
    expect(PUBLIC_PREFIXES).toContain(CUENTA_BORRADA_PATH);
  });

  it('una ruta que solo SE PARECE no es pública', () => {
    expect(isPublicPath('/cuenta-borradaX')).toBe(false);
    expect(isPublicPath('/cuenta-borrar')).toBe(false);
  });

  it('las rutas de datos siguen exigiendo sesión', () => {
    for (const p of ['/dashboard', '/cartera', '/vigiladas', '/avisos', CUENTA_PATH]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});

describe('SPEC-036 CA-10: el matcher del proxy sigue sin conocer rutas de producto', () => {
  it('sigue siendo el de siempre — quien decide es el guard, no el matcher', () => {
    // AMPLIADA POR SPEC-047 (CA-19), arbitraje del humano del 2026-08-22.
    //
    // Qué vigilaba antes: que el literal del matcher fuera EXACTAMENTE el que había el
    // día en que SPEC-036 CA-10 lo congeló — o sea, una foto del árbol.
    // Qué vigila ahora: exactamente lo mismo, sobre la foto de hoy. La lista de
    // exclusiones crece en UN elemento, `icon.svg`, y sigue siendo un literal completo
    // comparado carácter a carácter: un quinto que apareciera sin CA detrás vuelve a
    // poner esto en rojo, igual que antes.
    //
    // En virtud de qué entra: **CA-6 y CA-7 de SPEC-047**. El navegador pide el icono
    // SIN sesión; con `icon.svg` dentro del matcher la petición entraba en Auth.js,
    // salía redirigida a `/login` y estampaba `authjs.csrf-token` y
    // `authjs.callback-url` — es decir, ponía RED a SPEC-035 CA-13, que es justo lo que
    // esta guardia existe para proteger.
    //
    // Por qué no debilita nada: `icon.svg` NO es una ruta de producto, es un ACTIVO, de
    // la misma familia que `_next/static`, `_next/image` y `favicon.ico`, que ya estaban
    // en esta misma línea y por la misma razón. La propiedad de verdad la mide el caso
    // de abajo —«ninguna ruta concreta se cuela como excepción DENTRO del matcher»—, que
    // sigue verde y SIN TOCAR, y `PUBLIC_PREFIXES` no se ha tocado (SPEC-047 CA-8).
    //
    // El implementador no tocó esto por su cuenta: escaló, lo decidió el humano y la
    // autorización está escrita en la spec (SPEC-047 §El arbitraje de las tres guardias
    // ajenas y CA-19) ANTES de ejecutarse.
    const proxy = readFileSync(join(rootDir, 'src', 'proxy.ts'), 'utf8');
    expect(proxy).toContain(
      "matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)']",
    );
  });

  it('ni `cuenta` ni `cuenta-borrada` aparecen dentro del literal del matcher', () => {
    const proxy = readFileSync(join(rootDir, 'src', 'proxy.ts'), 'utf8');
    const literal = proxy.match(/matcher:\s*\[([\s\S]*?)\]/);
    expect(literal, 'no se encuentra el matcher en src/proxy.ts').not.toBeNull();
    expect(literal![1]).not.toContain('cuenta');
  });
});
