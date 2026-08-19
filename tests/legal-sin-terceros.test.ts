import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-035 CA-12 — la mitad estructural de "no se carga nada de terceros".
 *
 * El e2e lo comprueba donde importa, interceptando las peticiones del navegador. Este
 * test existe porque ese e2e llegó **tarde**: el sistema de diseño traía un
 * `@import url('https://fonts.googleapis.com/...')` y, con él, **todas** las páginas
 * de la app pedían un recurso a Google. Incluidas `/legal`, que promete lo contrario,
 * y `/reset-password`, sobre la que ADR-015 pto. 9 ya daba por hecho lo mismo ("esta
 * página no carga recursos de terceros") sin que fuera cierto.
 *
 * El e2e habría vuelto a cazarlo, sí — dentro de una vuelta entera de build y
 * navegador. Esto lo caza en el hook de fichero, y además dice dónde.
 *
 * Se mira TODO el CSS que la app sirve (el suyo y el del sistema de diseño), no solo
 * el de las páginas legales: una hoja global no distingue de qué página se carga.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Todos los `.css` que acaban dentro del bundle: los de `src/` y los del sistema. */
function hojasDeEstilo(): string[] {
  const encontradas: string[] = [];
  const pendientes = [join(rootDir, 'src'), join(rootDir, 'design')];

  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    if (!existsSync(actual)) continue;
    for (const entrada of readdirSync(actual)) {
      const ruta = join(actual, entrada);
      if (statSync(ruta).isDirectory()) pendientes.push(ruta);
      else if (entrada.endsWith('.css')) encontradas.push(ruta);
    }
  }
  return encontradas;
}

/**
 * Un `url(...)` o un `@import` que apunte fuera. `data:` no cuenta: va incrustado en
 * la propia hoja y no genera petición (así entra el cheurón de los `select`).
 */
const REFERENCIA_EXTERNA = /(?:@import\s+)?url\(\s*['"]?(https?:)?\/\/[^)'"]+/gi;

describe('SPEC-035 CA-12: ninguna hoja de estilo pide nada a un tercero', () => {
  it('el recorrido encuentra CSS de verdad, el propio y el del sistema de diseño', () => {
    const hojas = hojasDeEstilo().map((f) => relative(rootDir, f).replace(/\\/g, '/'));
    expect(hojas).toContain('src/app/globals.css');
    expect(hojas).toContain('design/tremen-ds/colors_and_type.css');
  });

  it('ninguna referencia a un host externo, tipografías incluidas', () => {
    const infractoras: string[] = [];
    for (const hoja of hojasDeEstilo()) {
      const encontradas = readFileSync(hoja, 'utf8').match(REFERENCIA_EXTERNA);
      if (encontradas) {
        infractoras.push(`${relative(rootDir, hoja).replace(/\\/g, '/')}: ${encontradas.join(', ')}`);
      }
    }
    expect(
      infractoras,
      'CSS que carga un recurso de terceros — CA-12 exige que todo salga del propio origen.\n' +
        'Si es una tipografía, resuélvela con `next/font` en src/app/layout.tsx.\n' +
        infractoras.join('\n'),
    ).toEqual([]);
  });

  it('las familias del sistema de diseño se sirven desde el propio origen', () => {
    // La contrapartida de haber quitado el @import: si nadie las provee, la app se
    // queda sin su tipografía y el arreglo de CA-12 se convierte en una regresión
    // visual silenciosa.
    const layout = readFileSync(join(rootDir, 'src', 'app', 'layout.tsx'), 'utf8');
    expect(layout).toContain('next/font/google');
    expect(layout).toMatch(/--font-geist-sans/);
    expect(layout).toMatch(/--font-geist-mono/);

    const globals = readFileSync(join(rootDir, 'src', 'app', 'globals.css'), 'utf8');
    expect(globals).toMatch(/--font-sans:\s*var\(--font-geist-sans\)/);
    expect(globals).toMatch(/--font-mono:\s*var\(--font-geist-mono\)/);
  });
});
