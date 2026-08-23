import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-051 — **la frontera de la tarjeta**: CA-1, CA-6, la mitad de código de CA-9 y
 * CA-13.
 *
 * Todo lo de aquí son **propiedades del árbol tal y como queda**, no fotos de un diff.
 * Es deliberado y viene escrito en la spec (§Notas pto. 10): el borrador redactaba media
 * docena de criterios como *«el diff contra `origin/main`»*, y **ADR-031 pto. 2.1** lo
 * prohíbe precisamente porque ese molde ya se puso verde por vacuidad al mergear —es lo
 * que SPEC-048 tuvo que desmontar—. Lo que se puede decir como propiedad del árbol se
 * dice así; lo que no —«el cambio está bien acotado»— sale de la suite y lo verifica
 * sdd-verificador en el gate, con la salida en el ledger (**CA-20**).
 *
 * Por eso este fichero no invoca `git diff` ni una sola vez y funciona igual en un clon
 * superficial.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = join(rootDir, 'src', 'app');
const srcDir = join(rootDir, 'src');

const fuente = (ruta: string) => readFileSync(join(rootDir, ruta), 'utf8');

/** Todos los fuentes bajo un directorio, con la extensión que se pida. */
function ficheros(dir: string, extensiones: string[]): string[] {
  const out: string[] = [];
  for (const entrada of readdirSync(dir).sort()) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) out.push(...ficheros(ruta, extensiones));
    else if (extensiones.some((e) => entrada.endsWith(e))) out.push(ruta);
  }
  return out;
}

const rel = (f: string) => relative(rootDir, f).replace(/\\/g, '/');

/** El texto sin comentarios: lo que se audita es lo que se ejecuta, no lo que se explica. */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---------------------------------------------------------------------------
// CA-1 — el origen absoluto sale de la configuración que ya existe, y de un solo sitio
// ---------------------------------------------------------------------------

describe('SPEC-051 CA-1: `metadataBase` sale de `appBaseUrl()`, y de un solo sitio', () => {
  it('aparece UNA sola vez en todo src/, y es en el layout raíz', () => {
    // Sobre el CÓDIGO, con los comentarios fuera: el layout explica en prosa de dónde
    // sale el origen absoluto —es lo que hace auditable la decisión— y esa explicación
    // nombra la clave. Lo que se cuenta es lo que se ejecuta, mismo criterio que
    // `sinComentarios` en `tests/icono-guardias-ampliadas.test.ts`.
    const apariciones = ficheros(srcDir, ['.ts', '.tsx'])
      .filter((f) => /\bmetadataBase\b/.test(sinComentarios(readFileSync(f, 'utf8'))))
      .map(rel);
    expect(
      apariciones,
      'dos sitios declarando el origen absoluto son dos fuentes de verdad, y una acaba ' +
        'mintiendo',
    ).toEqual(['src/app/layout.tsx']);

    expect(sinComentarios(fuente('src/app/layout.tsx')).match(/\bmetadataBase\b/g)).toHaveLength(1);
  });

  it('su valor se construye con `appBaseUrl()`, la de SPEC-023', () => {
    // ADR-015 pto. 8: el origen absoluto sale de configuración y NUNCA de la cabecera
    // `Host`. `appBaseUrl()` ES esa decisión, ya tomada; esta spec la consume para una
    // segunda superficie en vez de inventar una paralela (D-4). Por eso no lleva ADR.
    const layout = fuente('src/app/layout.tsx');
    expect(layout).toMatch(/from\s+'@\/lib\/config\/app-url'/);
    expect(layout).toMatch(/metadataBase:\s*new URL\(appBaseUrl\(\)\)/);
  });

  it('no hay ningún origen absoluto alternativo en src/', () => {
    // Las tres alternativas que D-4 rechaza por escrito. `VERCEL_URL` es la URL del
    // despliegue y no el alias que recorren las personas; `NEXT_PUBLIC_SITE_URL` sería
    // una clave nueva —y la lista de `.env.example` está cerrada en once, cosa que
    // `tests/spec-031-frontera.test.ts` ya afirma con `toHaveLength(11)`: este CA la CITA
    // en vez de duplicarla, para que siga habiendo un solo sitio donde pedir permiso—; y
    // `TITULAR.dominio` es una afirmación legal sobre quién opera el servicio, no la
    // configuración del despliegue.
    //
    // Otra vez sobre el código y no sobre los comentarios: el layout NOMBRA las tres
    // alternativas para dejar escrito por qué no son ninguna de ellas, y esa prosa es
    // parte de lo que se pide, no una infracción.
    const infractores: string[] = [];
    for (const f of ficheros(srcDir, ['.ts', '.tsx'])) {
      const codigo = sinComentarios(readFileSync(f, 'utf8'));
      for (const patron of ['VERCEL_URL', 'NEXT_PUBLIC_SITE_URL']) {
        if (codigo.includes(patron)) infractores.push(`${rel(f)}: ${patron}`);
      }
    }
    expect(infractores).toEqual([]);
    expect(
      sinComentarios(fuente('src/app/layout.tsx')),
      'los metadatos no se atan al aviso legal: corregirlo cambiaría el origen en silencio',
    ).not.toMatch(/TITULAR|legal\/content/);
  });
});

// ---------------------------------------------------------------------------
// CA-6 — lo declara el framework por la convención de fichero, y nadie a mano
// ---------------------------------------------------------------------------

describe('SPEC-051 CA-6: la convención de fichero, y ni un `<meta>` escrito a mano', () => {
  it('existen la imagen y su texto alternativo, en la raíz de app/', () => {
    expect(existsSync(join(appDir, 'opengraph-image.png'))).toBe(true);
    const alt = readFileSync(join(appDir, 'opengraph-image.alt.txt'), 'utf8').trim();
    expect(alt.length, 'el alt vacío es peor que no tenerlo: promete y no dice').toBeGreaterThan(20);
  });

  it('ningún .tsx escribe un `<meta property="og:` ni un `<meta name="twitter:`', () => {
    // Misma disciplina que SPEC-047 CA-4 impuso a los `<link rel="icon">`: quien calcula
    // la URL (con su hash de caché) y quien emite las etiquetas es Next. Escribir una a
    // mano crea un segundo emisor que se desincroniza el día que el fichero cambie.
    const infractores: string[] = [];
    for (const f of ficheros(srcDir, ['.tsx'])) {
      const src = readFileSync(f, 'utf8');
      if (/<meta[^>]*(property=["']og:|name=["']twitter:)/.test(src)) infractores.push(rel(f));
    }
    expect(infractores).toEqual([]);
  });

  it('nadie precarga ni pinta la tarjeta: no es un recurso de la página', () => {
    // Un `<meta>` no provoca descarga. La imagen la pide el RASTREADOR, no el visitante,
    // y meterla en la página costaría 16 KB a cada desconocido que llega del foro para no
    // enseñarle nada (CA-19).
    const infractores: string[] = [];
    for (const f of ficheros(srcDir, ['.tsx', '.ts', '.css'])) {
      const src = readFileSync(f, 'utf8');
      if (/opengraph-image/.test(src) && /<img|rel=["']preload|url\(/.test(src)) {
        infractores.push(rel(f));
      }
    }
    expect(infractores).toEqual([]);
  });

  it('no se crea public/: los activos viven en app/, como los iconos', () => {
    expect(existsSync(join(rootDir, 'public'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CA-9 (mitad de código) — ni una letra, ni una fuente, ni nada de fuera
// ---------------------------------------------------------------------------

/** Los tres ficheros que componen el generador. */
const GENERADOR = ['scripts/build-icon.mjs', 'scripts/icon-geometry.mjs', 'scripts/png.mjs'];

describe('SPEC-051 CA-9: el generador no sabe de tipografía y no sale a la red', () => {
  it.each(GENERADOR)('%s sólo importa de node:* o de un fichero vecino', (ruta) => {
    for (const m of fuente(ruta).matchAll(/from\s+'([^']+)'/g)) {
      expect(m[1], `${ruta} importa ${m[1]}`).toMatch(/^(node:|\.\/|\.\.\/)/);
    }
  });

  it.each(GENERADOR)('%s no menciona ningún fichero de fuente tipográfica', (ruta) => {
    expect(fuente(ruta)).not.toMatch(/\.(ttf|otf|woff2?|eot)\b/i);
  });

  it.each(GENERADOR)('%s no pinta texto: ni `<text`, ni `font-family`', (ruta) => {
    // Con los comentarios fuera: `icon-geometry.mjs` NOMBRA las dos formas prohibidas en
    // su prosa, precisamente para explicar que no las usa. Lo que se audita es el código.
    const codigo = sinComentarios(fuente(ruta));
    expect(codigo).not.toMatch(/<text\b/i);
    expect(codigo).not.toMatch(/font-family/i);
  });

  it.each(GENERADOR)('%s no contiene ninguna URL externa', (ruta) => {
    const externas = [...sinComentarios(fuente(ruta)).matchAll(/https?:\/\/[^\s'"`)]+/g)]
      .map((m) => m[0])
      // El namespace SVG queda fuera, y con motivo: es el NOMBRE del espacio de nombres,
      // obligatorio en un fichero SVG suelto y que ningún renderizador descarga jamás.
      // Es el mismo carve-out que documenta `tests/icono-fichero.test.ts`; incluirlo
      // convertiría la comprobación en «este fichero no puede producir un SVG válido».
      .filter((u) => !u.startsWith('http://www.w3.org/'));
    expect(externas, `${ruta} apunta fuera`).toEqual([]);
  });

  it('la tarjeta se dibuja con las formas del wordmark, no con formas propias', () => {
    // D-2 leído en el código; el mismo hecho medido en píxeles está en
    // `tests/tarjeta-imagen.test.ts` («las formas son las del wordmark que ya existe»).
    const geometria = sinComentarios(fuente('scripts/icon-geometry.mjs'));
    const cuerpo = /export function rasterizarTarjeta[\s\S]*?\n}/.exec(geometria)?.[0] ?? '';
    expect(cuerpo, 'no se encuentra `rasterizarTarjeta`').not.toBe('');
    expect(cuerpo, 'la S de la tarjeta no sale del trazado que ya existe').toContain(
      'cuencosDeLaS()',
    );
    expect(cuerpo, 'el punto de la tarjeta no sale del que ya existe').toContain('poligonoPunto()');
  });
});

// ---------------------------------------------------------------------------
// CA-13 — se reproduce desde fuente comprometida, sin dependencias y sin clave nueva
// ---------------------------------------------------------------------------

describe('SPEC-051 CA-13: el PNG se reproduce, byte a byte, con el `icon:build` de siempre', () => {
  it('regenerar sobre un directorio limpio escribe TRES ficheros y el PNG coincide', () => {
    const salida = mkdtempSync(join(tmpdir(), 'tarjeta-051-'));
    try {
      execFileSync(process.execPath, [join('scripts', 'build-icon.mjs'), '--out', salida], {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      expect(
        readdirSync(salida).sort(),
        'el generador escribe los TRES activos de marca, ni uno más ni uno menos',
      ).toEqual(['favicon.ico', 'icon.svg', 'opengraph-image.png']);

      const generado = readFileSync(join(salida, 'opengraph-image.png'));
      const committeado = readFileSync(join(appDir, 'opengraph-image.png'));
      expect(
        generado.equals(committeado),
        'la tarjeta regenerada difiere de la committeada: el binario y su fuente se han ' +
          'separado. Ejecuta `npm run icon:build` y comete el resultado.',
      ).toBe(true);
    } finally {
      rmSync(salida, { recursive: true, force: true });
    }
  });

  it('el codificador se apoya en `node:zlib`, que es biblioteca estándar', () => {
    expect(fuente('scripts/png.mjs')).toMatch(/from\s+'node:zlib'/);
  });

  it('`scripts` de package.json tiene EXACTAMENTE las mismas claves, `icon:build` incluida', () => {
    // D-8: la tarjeta cuelga del generador que ya existía, así que aquí no nace ninguna
    // clave. Es también la prueba, como propiedad del árbol, de que la TERCERA guardia
    // ajena de SPEC-047 —`tests/deploy-gate-workflow.test.ts`, la lista cerrada de
    // `scripts` de SPEC-028 CA-9.3— no ha hecho falta tocarla: si esta lista es la misma,
    // aquélla sigue verde por mérito propio. Una clave de más aquí es RED por CA-17.1.
    const { scripts } = JSON.parse(fuente('package.json')) as { scripts: Record<string, string> };
    const esperadas = [
      'build',
      'db:generate',
      'db:migrate',
      'db:scan',
      'dev',
      'icon:build',
      'lint',
      'start',
      'test',
      'test:e2e',
      'test:watch',
      'typecheck',
      'version:check',
    ].sort();
    expect(Object.keys(scripts).sort()).toEqual(esperadas);
    expect(
      [...Object.keys(scripts), 'tarjeta:build'].sort(),
      'la comparación no distingue una clave de más: habría dejado de estar cerrada',
    ).not.toEqual(esperadas);
  });

  it('no entra ninguna dependencia: los mismos nombres de siempre, en las dos listas', () => {
    // CE-M3. El codificador de PNG se escribe sobre `node:zlib` justamente para que esta
    // lista no crezca: una librería de imagen para pintar un rectángulo y dos formas es
    // lo que la épica llama «no es una mejora».
    const pkg = JSON.parse(fuente('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(
      [
        '@neondatabase/serverless',
        'bcryptjs',
        'decimal.js',
        'drizzle-orm',
        'next',
        'next-auth',
        'postgres',
        'react',
        'react-dom',
        'xlsx',
        'zod',
      ].sort(),
    );
    expect(Object.keys(pkg.devDependencies).sort()).toEqual(
      [
        '@electric-sql/pglite',
        '@eslint/js',
        '@playwright/test',
        '@types/bcryptjs',
        '@types/node',
        '@types/react',
        '@types/react-dom',
        'drizzle-kit',
        'embedded-postgres',
        'eslint',
        'globals',
        'typescript',
        'typescript-eslint',
        'vitest',
        'yaml',
      ].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// CA-18 — los cuatro verdes que la spec cita por su nombre siguen existiendo
// ---------------------------------------------------------------------------

describe('SPEC-051 CA-18: los cuatro verdes citados siguen en su sitio', () => {
  /** Los que este cambio pone a prueba de verdad, con el caso que lo hace. */
  const CITADOS: ReadonlyArray<[string, string, string]> = [
    [
      'tests/legal-sin-terceros.test.ts',
      'ninguna referencia a un host externo, tipografías incluidas',
      'SPEC-035 CA-12',
    ],
    [
      'tests/e2e/legal.spec.ts',
      'recorrer /legal anónimamente no fija ninguna cookie',
      'SPEC-035 CA-13 — el que cazaría el fallo del matcher',
    ],
    [
      'tests/spec-031-frontera.test.ts',
      'y son ONCE: si mañana hay doce, es que alguien no pasó por un gate',
      'SPEC-031 CA-13.3',
    ],
    [
      'tests/icono-frontera.test.ts',
      'regenerar sobre un árbol limpio devuelve los mismos bytes, uno a uno',
      'SPEC-047 CA-17',
    ],
  ];

  it.each(CITADOS)('%s conserva su caso — %s', (ruta, titulo) => {
    // No se comprueba que pasen —eso lo hace la suite entera al correr—, sino que **siguen
    // existiendo con ese nombre**. Es la mitad que sí cabe en la suite: borrar el caso
    // que te está fallando es la forma más barata de ponerse verde, y así no se puede.
    expect(fuente(ruta), `ha desaparecido el caso "${titulo}"`).toContain(titulo);
  });
});
