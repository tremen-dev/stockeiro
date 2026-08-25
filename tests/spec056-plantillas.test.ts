import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MARCA } from '@/lib/legal/content';
import { PILA_DE_FUENTES } from '@/lib/notifications/templates';
import {
  correoDeEntradaEnZona,
  correoDeRecuperacion,
  correoDeResumen,
  type CorreoCompuesto,
} from '@/lib/notifications/templates';

/**
 * SPEC-056 — **las tres plantillas**: CA-3 a CA-16.
 *
 * Todo esto corre en Vitest **sin base de datos y sin navegador**, y esa es la ganancia de
 * haber puesto la plantilla sobre el puerto (ADR-036 pto. 4) en vez de dentro del
 * adaptador: la plantilla es una función pura que devuelve `string`, así que «lleva la
 * marca», «no pide recursos fuera» o «no usa flex» son aserciones sobre texto.
 *
 * Tres cosas se **derivan** en cada ejecución en vez de teclearse (tercera convención de
 * `FOUNDATION.md`, y las tres son criterio explícito de la spec):
 *
 *   - **La paleta** (CA-11) sale de `design/tremen-ds/colors_and_type.css`, resolviendo los
 *     alias `var(...)`. Es la misma lectura que hacen `tests/tarjeta-imagen.test.ts` y
 *     `tests/icono-fichero.test.ts`. Un test con `#111110` escrito a mano dejaría de
 *     vigilar el día que la marca cambiase de suelo.
 *   - **El literal de marca** (CA-6) sale de `MARCA`, no de una cadena escrita aquí.
 *   - **La pila de fuentes** (D-8) sale de `--font-sans` del mismo CSS, quitándole la
 *     primera familia. Así el intercambio que D-8 acepta —Geist se pierde porque pedirla a
 *     un host es lo que D-7 prohíbe— no puede envejecer en silencio.
 *
 * Y de paso este fichero escribe la **evidencia visual** acordada con el humano en el gate
 * del 2026-08-25: los tres HTML con datos de muestra en `_qa/SPEC-056/`. La escribe el test
 * que los afirma —y no un script aparte— para que la evidencia no pueda quedarse atrás
 * respecto del código que la produce. La salida es determinista, así que reescribirla no
 * ensucia el árbol.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(rootDir, 'src');
const cssPath = join(rootDir, 'design', 'tremen-ds', 'colors_and_type.css');

// ---------------------------------------------------------------------------
// Los tres correos, con datos de muestra distinguibles entre sí.
// ---------------------------------------------------------------------------

const ENTRADA = {
  ticker: 'ITX',
  precio: '45.20',
  zona: 'compra',
  asOf: '2026-08-24',
} as const;

const RESUMEN = {
  posiciones: [
    { ticker: 'ITX', zona: 'compra' },
    { ticker: 'SAN', zona: 'venta' },
    { ticker: 'TEF', zona: 'compra' },
  ],
  asOf: '2026-08-24',
} as const;

const RECUPERACION = {
  url: 'https://stockeiro.tremen.dev/reset-password/8Rb2xQm-7fLPa_0KcVzT9uNhJdEwYsGi',
  minutosDeCaducidad: 30,
} as const;

const CORREOS: Array<[string, CorreoCompuesto]> = [
  ['entrada', correoDeEntradaEnZona({ ...ENTRADA })],
  ['resumen', correoDeResumen({ posiciones: [...RESUMEN.posiciones], asOf: RESUMEN.asOf })],
  ['recuperacion', correoDeRecuperacion({ ...RECUPERACION })],
];

const porNombre = (nombre: string) => CORREOS.find(([n]) => n === nombre)![1];

// ---------------------------------------------------------------------------
// Evidencia visual: los tres HTML a `_qa/SPEC-056/` (nota 5 del gate).
// ---------------------------------------------------------------------------

const qaDir = join(rootDir, '_qa', 'SPEC-056');
mkdirSync(qaDir, { recursive: true });
for (const [nombre, correo] of CORREOS) {
  writeFileSync(join(qaDir, `${nombre}.html`), `${correo.html}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// La paleta, derivada del sistema de diseño en cada ejecución (CA-11).
// ---------------------------------------------------------------------------

/**
 * Lee un token del sistema de diseño resolviendo los alias `var(--otro)`. Misma lectura
 * que hace `tests/tarjeta-imagen.test.ts`, reimplementada aquí en vez de importada: aquel
 * fichero es de otra spec y CA-18 no autoriza tocarlo, ni siquiera para exportar algo.
 */
function token(selector: string, nombre: string): string {
  const css = readFileSync(cssPath, 'utf8');
  const leer = (sel: string, tok: string): string => {
    const desde = css.indexOf(`${sel} {`);
    expect(desde, `no hay bloque "${sel}" en el sistema de diseño`).toBeGreaterThanOrEqual(0);
    const bloque = css.slice(desde, css.indexOf('}', desde));
    const m = new RegExp(`--${tok}\\s*:\\s*([^;]+);`).exec(bloque);
    expect(m, `no hay --${tok} en ${sel}`).not.toBeNull();
    const valor = m![1].trim();
    const alias = /^var\(\s*--([\w-]+)\s*\)$/.exec(valor);
    return alias ? leer(':root', alias[1]) : valor;
  };
  return leer(selector, nombre);
}

/** Un color, en una forma comparable: hex en mayúsculas, `rgba()` sin espacios. */
const normalizar = (color: string) => color.trim().replace(/\s+/g, '').toUpperCase();

/** Los SEIS colores que la spec autoriza, y de qué token sale cada uno. */
function paletaAutorizada(): Map<string, string> {
  const origen: Array<[string, string, string]> = [
    ['lienzo', '.v-tremendo', 'bg'],
    ['tarjeta', '.v-tremendo', 'bg-elev'],
    ['hueso', ':root', 'bone'],
    ['acento', '.v-tremendo', 'accent'],
    ['apagado', '.v-tremendo', 'fg-muted'],
    ['filete', '.v-tremendo', 'line'],
  ];
  return new Map(origen.map(([rotulo, sel, tok]) => [rotulo, token(sel, tok)]));
}

/** Todo literal de color que aparezca en un texto: hexadecimales y `rgb()`/`rgba()`. */
const coloresDe = (html: string): string[] => [
  ...(html.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []),
  ...(html.match(/rgba?\([^)]*\)/g) ?? []),
];

// ---------------------------------------------------------------------------
// CA-3 — la plantilla es pura y vive SOBRE el puerto.
// ---------------------------------------------------------------------------

const EXTENSIONES = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx'];

/** Todos los especificadores de módulo que aparecen en un fichero. */
function especificadoresDe(fuente: string): string[] {
  const patrones = [
    /(?:^|\n)\s*import\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const encontrados = new Set<string>();
  for (const patron of patrones) {
    for (const m of fuente.matchAll(patron)) encontrados.add(m[1]);
  }
  return [...encontrados];
}

const primeroQueExista = (candidatos: string[]): string | null =>
  candidatos.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;

/** Resuelve a fichero del proyecto, o null si es un paquete de `node_modules`. */
function resolverLocal(especificador: string, desde: string): string | null {
  let base: string;
  if (especificador.startsWith('@/')) base = join(srcDir, especificador.slice(2));
  else if (especificador.startsWith('.')) base = resolve(dirname(desde), especificador);
  else return null;

  return primeroQueExista([
    base,
    ...EXTENSIONES.map((e) => base + e),
    ...EXTENSIONES.map((e) => join(base, `index${e}`)),
  ]);
}

/** Ficheros del proyecto alcanzables desde `entrada`, y paquetes externos citados. */
function recorrer(entrada: string): { ficheros: string[]; paquetes: string[] } {
  const ficheros = new Set<string>();
  const paquetes = new Set<string>();
  const pendientes = [entrada];

  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    if (ficheros.has(actual)) continue;
    ficheros.add(actual);
    for (const especificador of especificadoresDe(readFileSync(actual, 'utf8'))) {
      const local = resolverLocal(especificador, actual);
      if (local === null) paquetes.add(especificador);
      else pendientes.push(local);
    }
  }
  return { ficheros: [...ficheros], paquetes: [...paquetes] };
}

const rel = (f: string) => relative(rootDir, f).replace(/\\/g, '/');

/** Todos los ficheros con una de esas extensiones bajo `dir`, recursivamente. */
function ficherosDe(dir: string, extensiones = EXTENSIONES): string[] {
  const out: string[] = [];
  for (const entrada of readdirSync(dir).sort()) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) out.push(...ficherosDe(ruta, extensiones));
    else if (extensiones.some((e) => entrada.endsWith(e))) out.push(ruta);
  }
  return out;
}

const PLANTILLAS = join(srcDir, 'lib', 'notifications', 'templates');
const ADAPTADORES = ['resend-sender.ts', 'fake-sender.ts', 'outbox-file-sender.ts'];

describe('SPEC-056 CA-3: la plantilla es pura y vive sobre el puerto', () => {
  it('el recorrido no es vacío: desde las plantillas se llega al módulo de marca', () => {
    // Centinela. Sin esto, un fallo del resolutor dejaría lo de abajo en verde sin mirar.
    const alcanzado = ficherosDe(PLANTILLAS).flatMap((f) => recorrer(f).ficheros).map(rel);
    expect(alcanzado).toContain('src/lib/legal/content.ts');
    expect(alcanzado).toContain('src/lib/notifications/templates/marco.ts');
  });

  it('no alcanzan `@/db`, ni un cliente de base de datos, ni Next, ni Auth.js', () => {
    const PROHIBIDOS = [
      ['src/db', 'la plantilla tiene que poder afirmarse sin base de datos'],
      ['src/lib/market', 'una plantilla no consulta cotizaciones'],
    ] as const;
    const PAQUETES_PROHIBIDOS = [
      'drizzle-orm',
      'postgres',
      'pg',
      '@neondatabase/serverless',
      '@electric-sql/pglite',
      'next',
      'next-auth',
      'react',
    ];

    for (const fichero of ficherosDe(PLANTILLAS)) {
      const { ficheros, paquetes } = recorrer(fichero);
      for (const [prefijo, motivo] of PROHIBIDOS) {
        expect(
          ficheros.map(rel).filter((f) => f.startsWith(`${prefijo}/`)),
          `${rel(fichero)} alcanza ${prefijo} — ${motivo}`,
        ).toEqual([]);
      }
      for (const paquete of paquetes) {
        const raiz = paquete.startsWith('@')
          ? paquete.split('/').slice(0, 2).join('/')
          : paquete.split('/')[0];
        expect(PAQUETES_PROHIBIDOS, `${rel(fichero)} importa "${paquete}"`).not.toContain(raiz);
      }
    }
  });

  it('no alcanzan ningún adaptador del puerto: el diseño no vive en el camino de Resend', () => {
    const adaptadores = ADAPTADORES.map((a) => `src/lib/notifications/${a}`);
    for (const fichero of ficherosDe(PLANTILLAS)) {
      const alcanzado = recorrer(fichero).ficheros.map(rel);
      for (const adaptador of adaptadores) {
        expect(alcanzado, `${rel(fichero)} alcanza ${adaptador}`).not.toContain(adaptador);
      }
    }
  });

  it('y ningún adaptador importa las plantillas: la dependencia va en un solo sentido', () => {
    for (const adaptador of ADAPTADORES) {
      const ruta = join(srcDir, 'lib', 'notifications', adaptador);
      const alcanzado = recorrer(ruta).ficheros.map(rel);
      expect(
        alcanzado.filter((f) => f.startsWith('src/lib/notifications/templates/')),
        `${adaptador} importa las plantillas — un adaptador transporta, no compone`,
      ).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// CA-4, CA-5, CA-6 — la marca: dónde está y de dónde sale.
// ---------------------------------------------------------------------------

/**
 * Lo que el lector ve de verdad: el `<body>` sin su bloque de preheader. Fuera quedan
 * el `<title>` —que repite el asunto, y por tanto el ticker— y el texto oculto que D-9
 * coloca por delante de todo por definición. Comparar posiciones contra ellos no diría
 * nada sobre dónde está la marca.
 */
const cuerpoVisible = (html: string) =>
  html
    .slice(html.indexOf('<body'))
    .replace(/<div style="display:none;[^"]*">[^<]*<\/div>\n?/, '');

/** El bloque de cabecera de un HTML: desde el primer `<tr>` de la tarjeta hasta su cierre. */
const bloqueDeCabecera = (html: string) => {
  const desde = html.indexOf('<tr><td style="padding:26px');
  expect(desde, 'no se encuentra el bloque de cabecera').toBeGreaterThanOrEqual(0);
  return html.slice(desde, html.indexOf('</td></tr>', desde) + '</td></tr>'.length);
};

/** El bloque de pie: el `<tr>` que lleva `border-top` y la línea de marca. */
const bloqueDePie = (html: string) => {
  const desde = html.indexOf('<tr><td style="padding:20px');
  expect(desde, 'no se encuentra el bloque de pie').toBeGreaterThanOrEqual(0);
  return html.slice(desde);
};

describe('SPEC-056 CA-4: los tres llevan la marca arriba, antes de nada', () => {
  it.each(CORREOS)('%s: la cabecera lleva Stockeiro y la marca, con su URL como href', (_n, c) => {
    const cabecera = bloqueDeCabecera(c.html);
    expect(cabecera).toContain('Stockeiro');
    expect(cabecera).toContain(MARCA.nombre);
    expect(cabecera).toContain(`href="${MARCA.url}"`);
  });

  it.each(CORREOS)('%s: la cabecera va ANTES del contenido propio del correo', (nombre, c) => {
    // Sobre el cuerpo VISIBLE: el preheader es texto oculto y va antes que todo por
    // definición (D-9), así que compararlo con él no diría nada.
    const visible = cuerpoVisible(c.html);
    const propio = { entrada: 'ITX', resumen: 'SAN', recuperacion: RECUPERACION.url }[nombre]!;
    expect(visible.indexOf(propio), `no aparece «${propio}»`).toBeGreaterThan(0);
    expect(visible.indexOf(bloqueDeCabecera(visible))).toBeLessThan(visible.indexOf(propio));
  });

  it('no hay ni un `<img>` en la cabecera: la marca es TEXTO (D-2)', () => {
    // Una marca en imagen es, en la primera lectura y para mucha gente, un hueco en
    // blanco: la mayoría de clientes bloquean las imágenes por defecto.
    for (const [, c] of CORREOS) expect(bloqueDeCabecera(c.html)).not.toContain('<img');
  });
});

describe('SPEC-056 CA-5: los tres llevan el pie con la fórmula exacta de la app', () => {
  it.each(CORREOS)('%s: el pie lleva `MARCA.linea` con `MARCA.url` como href', (_n, c) => {
    const pie = bloqueDePie(c.html);
    expect(pie).toContain(MARCA.linea);
    expect(pie).toContain(`href="${MARCA.url}"`);
  });

  it.each(CORREOS)('%s: el pie va DESPUÉS del contenido propio', (nombre, c) => {
    const propio = { entrada: 'ITX', resumen: 'TEF', recuperacion: RECUPERACION.url }[nombre]!;
    expect(c.html.lastIndexOf(propio)).toBeLessThan(c.html.indexOf(bloqueDePie(c.html)));
  });

  it.each(CORREOS)('%s: el texto plano TERMINA con esa misma línea', (_n, c) => {
    expect(c.text.endsWith(MARCA.linea)).toBe(true);
  });
});

/** Un fuente sin sus comentarios: lo que el módulo dice de verdad. */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('SPEC-056 CA-6: una sola fuente — nada de la marca está tecleado', () => {
  const LITERALES = ['tremen.dev', 'https://tremen.dev', 'un proyecto de'];

  /**
   * La ÚNICA excepción, y está declarada porque la pide la propia spec: la **dirección**
   * del remitente (D-11 razón 5). El dominio de envío es configuración de despliegue —lo
   * verificado en Resend—, no una etiqueta de marca, y derivarlo de `MARCA` haría que
   * retocar el rótulo cambiase en silencio desde dónde se manda el correo. El **nombre
   * visible** sí sale de `MARCA.nombre` (CA-19), así que lo tecleado se reduce al buzón.
   */
  const EXCEPCION = /^export const REMITENTE_POR_DEFECTO = .*<stockeiro@tremen\.dev>`;$/;

  const vigilados = [
    ...ficherosDe(join(srcDir, 'lib', 'notifications')),
    join(srcDir, 'lib', 'auth', 'password-reset.ts'),
  ];

  it('el recorrido mira de verdad los ficheros que la spec nombra', () => {
    const nombres = vigilados.map(rel);
    expect(nombres).toContain('src/lib/notifications/templates/marco.ts');
    expect(nombres).toContain('src/lib/notifications/service.ts');
    expect(nombres).toContain('src/lib/auth/password-reset.ts');
    expect(nombres.length).toBeGreaterThanOrEqual(8);
  });

  it('ningún literal de marca aparece escrito a mano en el código', () => {
    const infracciones: string[] = [];
    for (const fichero of vigilados) {
      const lineas = soloCodigo(readFileSync(fichero, 'utf8')).split('\n');
      lineas.forEach((linea, i) => {
        if (!LITERALES.some((l) => linea.includes(l))) return;
        if (EXCEPCION.test(linea.trim())) return; // la dirección del remitente (D-11.5)
        infracciones.push(`${rel(fichero)}:${i + 1}: ${linea.trim()}`);
      });
    }
    expect(
      infracciones,
      'la marca sale de `MARCA` (src/lib/legal/content.ts), no se teclea:\n' +
        infracciones.join('\n'),
    ).toEqual([]);
  });

  it('la excepción declarada es exactamente UNA línea, y es la dirección del remitente', () => {
    // Si mañana hubiera dos, el carve-out habría dejado de ser un carve-out.
    const conExcepcion = vigilados.flatMap((f) =>
      soloCodigo(readFileSync(f, 'utf8'))
        .split('\n')
        .filter((l) => EXCEPCION.test(l.trim()))
        .map(() => rel(f)),
    );
    expect(conExcepcion).toEqual(['src/lib/notifications/resend-sender.ts']);
  });

  it('la cabecera y el pie están escritos UNA sola vez, en el módulo de marco', () => {
    const conMarca = ficherosDe(PLANTILLAS).filter((f) =>
      soloCodigo(readFileSync(f, 'utf8')).includes('MARCA.'),
    );
    expect(conMarca.map(rel)).toEqual(['src/lib/notifications/templates/marco.ts']);
  });

  it('y los tres correos comparten LITERALMENTE el mismo marco, byte a byte', () => {
    // Es la propiedad de D-1: tres copias del mismo bloque son tres sitios donde diverger.
    const cabeceras = new Set(CORREOS.map(([, c]) => bloqueDeCabecera(c.html)));
    const pies = new Set(CORREOS.map(([, c]) => bloqueDePie(c.html)));
    expect(cabeceras.size, 'las cabeceras han divergido').toBe(1);
    expect(pies.size, 'los pies han divergido').toBe(1);
  });
});

// ---------------------------------------------------------------------------
// CA-7 a CA-12 — el correo es correo.
// ---------------------------------------------------------------------------

describe('SPEC-056 CA-7: el documento se declara y se anuncia', () => {
  it.each(CORREOS)('%s: doctype, idioma, charset, viewport, título y color-scheme', (_n, c) => {
    expect(c.html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(c.html).toContain('<html lang="es">');
    expect(c.html).toContain('<meta charset="utf-8">');
    expect(c.html).toMatch(/<meta name="viewport" content="[^"]+">/);
    expect(c.html).toContain('<meta name="color-scheme" content="dark light">');
    expect(c.html).toContain('<meta name="supported-color-schemes" content="dark light">');
    const titulo = /<title>([^<]*)<\/title>/.exec(c.html);
    expect(titulo, 'no hay <title>').not.toBeNull();
    expect(titulo![1].length).toBeGreaterThan(0);
  });

  it.each(CORREOS)('%s: el preheader es EXACTAMENTE la primera línea del texto (D-9)', (_n, c) => {
    const m = /<div style="display:none;[^"]*">([^<]*)<\/div>/.exec(c.html);
    expect(m, 'no hay bloque de preheader oculto').not.toBeNull();
    expect(m![1]).toBe(c.text.split('\n')[0]);
    expect(m![1].length, 'el preheader está vacío').toBeGreaterThan(0);
  });

  it.each(CORREOS)('%s: el preheader va antes de cualquier otro texto visible', (_n, c) => {
    const preheader = c.html.indexOf('<div style="display:none;');
    expect(preheader).toBeGreaterThan(0);
    expect(preheader).toBeLessThan(c.html.indexOf('Stockeiro<span'));
  });
});

describe('SPEC-056 CA-8: maquetado como se maqueta el correo, no como se maqueta la web', () => {
  it.each(CORREOS)('%s: TODA `<table>` lleva role="presentation"', (_n, c) => {
    const tablas = c.html.match(/<table[^>]*>/g) ?? [];
    expect(tablas.length, 'no hay ninguna tabla: esto no es maquetación de correo').toBeGreaterThan(
      1,
    );
    for (const tabla of tablas) expect(tabla, `tabla sin role: ${tabla}`).toContain('role="presentation"');
  });

  it.each(CORREOS)('%s: la tabla exterior va al 100% y pinta el fondo a sangre', (_n, c) => {
    const exterior = (c.html.match(/<table[^>]*>/g) ?? [])[0];
    expect(exterior).toContain('width="100%"');
    expect(exterior).toContain(`background-color:${paletaAutorizada().get('lienzo')}`);
  });

  it.each(CORREOS)('%s: el contenedor interior declara un ancho máximo de 600 px', (_n, c) => {
    expect(c.html).toContain('max-width:600px');
  });

  it.each(CORREOS)('%s: el estilo va EN LÍNEA y no en un bloque que Gmail pueda podar', (_n, c) => {
    expect((c.html.match(/style="/g) ?? []).length).toBeGreaterThan(10);
    // Si algún día hay `<style>`, CA-8 solo lo admite con todas sus reglas dentro de un
    // `@media`. Hoy no hay ninguno, que es más fuerte todavía: lo que no existe no se poda.
    for (const bloque of c.html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) ?? []) {
      const cuerpo = bloque.replace(/<\/?style[^>]*>/g, '').trim();
      expect(cuerpo.replace(/@media[^{]*\{[\s\S]*\}/g, '').trim()).toBe('');
    }
    expect(c.html).not.toContain('<style');
  });
});

describe('SPEC-056 CA-9: nada que el cliente tire, y nada que el cliente ejecute', () => {
  /** La lista es CERRADA y el test la enumera: añadir marcado obliga a mirar aquí. */
  const PROHIBIDAS: Array<[string, RegExp]> = [
    ['<script', /<script/i],
    ['<iframe', /<iframe/i],
    ['<form', /<form/i],
    ['<object', /<object/i],
    ['<embed', /<embed/i],
    ['un atributo on*=', /\son[a-z]+\s*=/i],
    ['position:', /position\s*:/i],
    ['float:', /float\s*:/i],
    ['display:flex', /display\s*:\s*flex/i],
    ['display:grid', /display\s*:\s*grid/i],
    ['@import', /@import/i],
    ['<link', /<link/i],
  ];

  it.each(CORREOS)('%s: ninguna de las doce construcciones prohibidas', (_n, c) => {
    for (const [rotulo, patron] of PROHIBIDAS) {
      expect(patron.test(c.html), `aparece «${rotulo}» — el correo no es la web (D-5)`).toBe(false);
    }
  });

  it('la lista de prohibidas no está vacía por accidente: sabe reconocerlas', () => {
    // Control positivo. Sin esto, una lista mal escrita pasaría los tres casos de arriba
    // sin haber mirado nada, que es exactamente la clase de guardia ciega que este
    // proyecto ya se ha comido dos veces.
    const infractor =
      '<div onclick="x()" style="position:absolute;display:flex;float:left;">' +
      '<b style="display:grid"></b>' +
      '<script></script><iframe></iframe><form></form><object></object><embed>' +
      '<link><style>@import url(x);</style></div>';
    for (const [rotulo, patron] of PROHIBIDAS) {
      expect(patron.test(infractor), `el patrón de «${rotulo}» no reconoce su propia infracción`).toBe(
        true,
      );
    }
  });
});

describe('SPEC-056 CA-10: cero terceros — toda URL absoluta es algo que el lector pincha', () => {
  it.each(CORREOS)('%s: ni un solo `<img>`, y por tanto ni un píxel de seguimiento', (_n, c) => {
    expect(c.html).not.toContain('<img');
    expect(c.html).not.toMatch(/background\s*=/i);
    expect(c.html).not.toMatch(/\ssrc\s*=/i);
    expect(c.html).not.toMatch(/url\s*\(/i);
  });

  it.each(CORREOS)('%s: cada URL absoluta es un href o es texto visible, nunca un recurso', (_n, c) => {
    const total = (c.html.match(/https?:\/\//g) ?? []).length;
    expect(total, 'no hay ninguna URL: el enlace de marca ha desaparecido').toBeGreaterThan(0);

    // Se quitan las que SÍ son `href`; lo que quede no puede estar dentro de una etiqueta
    // ni dentro de una declaración de estilo — o sea, solo puede ser texto del documento.
    const sinHref = c.html.replace(/href="[^"]*"/g, 'href=""');
    for (const trozo of sinHref.match(/<[^>]*>/g) ?? []) {
      expect(trozo, `una URL absoluta viaja dentro de una etiqueta: ${trozo}`).not.toMatch(
        /https?:\/\//,
      );
    }
  });
});

describe('SPEC-056 CA-11: los colores son los de la app, leídos de su fuente', () => {
  it('el sistema de diseño sigue declarando los seis tokens que la spec nombra', () => {
    const paleta = paletaAutorizada();
    expect([...paleta.keys()]).toHaveLength(6);
    for (const [rotulo, valor] of paleta) {
      expect(valor, `el token de «${rotulo}» ha venido vacío`).toMatch(/^(#[0-9A-Fa-f]{3,8}|rgba?\()/);
    }
  });

  it.each(CORREOS)('%s: todo literal de color pertenece a ese conjunto', (_n, c) => {
    const autorizados = new Set([...paletaAutorizada().values()].map(normalizar));
    const usados = coloresDe(c.html).map(normalizar);
    expect(usados.length, 'no se ha encontrado ni un color: el correo saldría sin diseño').toBeGreaterThan(
      5,
    );
    const intrusos = [...new Set(usados)].filter((color) => !autorizados.has(color));
    expect(
      intrusos,
      `colores que no salen de design/tremen-ds/colors_and_type.css: ${intrusos.join(', ')}`,
    ).toEqual([]);
  });

  it.each(CORREOS)('%s: ni un degradado, ni una sombra', (_n, c) => {
    expect(c.html).not.toMatch(/gradient/i);
    expect(c.html).not.toMatch(/box-shadow|text-shadow/i);
  });

  it('la pila de fuentes es la de `--font-sans` sin su primera familia (D-8)', () => {
    const esperada = token(':root', 'font-sans')
      .split(',')
      .slice(1)
      .map((f) => f.trim())
      .join(', ');
    expect(PILA_DE_FUENTES).toBe(esperada);
    // Y en el correo no queda rastro de Geist: pedirla exigiría un host (D-7).
    for (const [, c] of CORREOS) expect(c.html).not.toContain('Geist');
  });
});

describe('SPEC-056 CA-12: el contraste se mide, no se supone', () => {
  const canal = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

  /** Un color a `[r,g,b]`, componiendo el alfa de `rgba()` sobre el fondo que toca. */
  function rgb(color: string, fondo: [number, number, number]): [number, number, number] {
    const hex = /^#([0-9A-Fa-f]{6})$/.exec(color.trim());
    if (hex) {
      const n = parseInt(hex[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = /^rgba?\(([^)]+)\)$/.exec(color.trim());
    expect(m, `color no reconocido: ${color}`).not.toBeNull();
    const partes = m![1].split(',').map((p) => Number(p.trim()));
    const alfa = partes.length > 3 ? partes[3] : 1;
    return [0, 1, 2].map((i) => Math.round(partes[i] * alfa + fondo[i] * (1 - alfa))) as [
      number,
      number,
      number,
    ];
  }

  const luminancia = (c: [number, number, number]) => {
    const [r, g, b] = c.map((v) => canal(v / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  /** Razón de contraste WCAG 2.x de `color` sobre `fondo`, componiendo el alfa. */
  function razon(color: string, fondo: string): number {
    const base = rgb(fondo, [0, 0, 0]);
    const [x, y] = [luminancia(rgb(color, base)), luminancia(base)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  }

  /** Los dos fondos que las plantillas usan: el lienzo y la tarjeta. */
  const fondos = () => {
    const p = paletaAutorizada();
    return [
      ['el lienzo', p.get('lienzo')!],
      ['la tarjeta', p.get('tarjeta')!],
    ] as const;
  };

  it('el control es válido: el mismo cálculo reproduce los pares canónicos de WCAG', () => {
    // Sin esto, un error en la fórmula podría dar números altos siempre y los tres casos
    // de abajo pasarían sin medir nada. Negro sobre blanco es 21:1 por definición.
    expect(razon('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(razon('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('el texto principal está por encima de 15:1 sobre los dos fondos', () => {
    const hueso = paletaAutorizada().get('hueso')!;
    for (const [rotulo, fondo] of fondos()) {
      expect(razon(hueso, fondo), `hueso sobre ${rotulo}`).toBeGreaterThanOrEqual(15);
    }
  });

  it('el acento está por encima de 6:1 sobre los dos fondos', () => {
    const acento = paletaAutorizada().get('acento')!;
    for (const [rotulo, fondo] of fondos()) {
      expect(razon(acento, fondo), `acento sobre ${rotulo}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('el texto secundario está por encima de 4,5:1 sobre los dos fondos', () => {
    const apagado = paletaAutorizada().get('apagado')!;
    for (const [rotulo, fondo] of fondos()) {
      expect(razon(apagado, fondo), `apagado sobre ${rotulo}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('y el rótulo del botón sobre el acento también pasa de 6:1', () => {
    const p = paletaAutorizada();
    expect(razon(p.get('lienzo')!, p.get('acento')!)).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// CA-13 a CA-15 — el texto plano sigue siendo un correo completo.
// ---------------------------------------------------------------------------

describe('SPEC-056 CA-13: los dos cuerpos existen y el de texto no tiene ni una etiqueta', () => {
  it.each(CORREOS)('%s: los dos son cadenas no vacías', (_n, c) => {
    expect(c.text.trim().length).toBeGreaterThan(0);
    expect(c.html.trim().length).toBeGreaterThan(0);
  });

  it.each(CORREOS)('%s: el texto no lleva ninguna etiqueta HTML', (_n, c) => {
    expect(c.text).not.toMatch(/<[A-Za-z/]/);
  });

  it.each(CORREOS)('%s: ni entidades sin resolver, ni la coartada del "ábrelo en el navegador"', (_n, c) => {
    expect(c.text).not.toContain('&amp;');
    expect(c.text).not.toContain('&nbsp;');
    expect(c.text.toLowerCase()).not.toContain('si no ves bien este correo');
  });
});

describe('SPEC-056 CA-14: los dos cuerpos dicen lo mismo', () => {
  /** Cada dato variable de cada correo. Si falta en uno de los dos, el test lo dice. */
  const DATOS: Array<[string, string[]]> = [
    ['entrada', [ENTRADA.ticker, ENTRADA.precio, ENTRADA.zona, ENTRADA.asOf]],
    [
      'resumen',
      [
        ...RESUMEN.posiciones.flatMap((p) => [p.ticker, p.zona]),
        String(RESUMEN.posiciones.length),
        RESUMEN.asOf,
      ],
    ],
    ['recuperacion', [RECUPERACION.url, String(RECUPERACION.minutosDeCaducidad)]],
  ];

  it.each(DATOS)('%s: cada dato variable aparece en el texto Y en el HTML', (nombre, datos) => {
    const c = porNombre(nombre);
    expect(datos.length, 'la lista de datos está vacía').toBeGreaterThan(1);
    for (const d of datos) {
      expect(c.text, `«${d}» falta en el texto de ${nombre}`).toContain(d);
      expect(c.html, `«${d}» falta en el HTML de ${nombre}`).toContain(d);
    }
  });
});

describe('SPEC-056 CA-15: el enlace de reset, primero en el texto y visible en el HTML', () => {
  const correo = porNombre('recuperacion');

  it('la PRIMERA URL absoluta del texto es el enlace de reset, desnudo', () => {
    const primera = correo.text.match(/https?:\/\/\S+/);
    expect(primera, 'el texto no lleva ninguna URL').not.toBeNull();
    expect(primera![0]).toBe(RECUPERACION.url);
  });

  it('ninguna URL de marca se cuela por delante de él', () => {
    expect(correo.text.indexOf(RECUPERACION.url)).toBeLessThan(
      correo.text.includes(MARCA.url) ? correo.text.indexOf(MARCA.url) : Number.MAX_SAFE_INTEGER,
    );
    // Y va en su propia línea, sin corchetes, sin acortar y sin envolver.
    expect(correo.text.split('\n')).toContain(RECUPERACION.url);
  });

  it('en el HTML aparece DOS veces: como href del botón y como texto copiable', () => {
    const apariciones = correo.html.split(RECUPERACION.url).length - 1;
    expect(apariciones).toBe(2);
    expect(correo.html).toContain(`href="${RECUPERACION.url}"`);
    // La segunda no está dentro de ninguna etiqueta: es texto que se puede seleccionar.
    expect(correo.html.replace(`href="${RECUPERACION.url}"`, '')).toMatch(
      new RegExp(`>[^<]*${RECUPERACION.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
  });

  it('el botón tiene área táctil de sobra: 14 + 20 + 14 = 48 px de alto (≥ 44, ADR-034)', () => {
    expect(correo.html).toContain('padding:14px 26px');
    expect(correo.html).toContain('line-height:20px');
  });
});

// ---------------------------------------------------------------------------
// CA-16 — los asuntos no se tocan.
// ---------------------------------------------------------------------------

describe('SPEC-056 CA-16: los asuntos son byte-idénticos a los de hoy', () => {
  it('entrada en zona', () => {
    expect(porNombre('entrada').subject).toBe(`${ENTRADA.ticker} entró en tu zona de ${ENTRADA.zona}`);
  });

  it('resumen de permanencia', () => {
    expect(porNombre('resumen').subject).toBe(
      `Resumen: ${RESUMEN.posiciones.length} acción(es) en zona`,
    );
  });

  it('recuperación de contraseña', () => {
    expect(porNombre('recuperacion').subject).toBe('Recupera tu contraseña de Stockeiro');
  });

  it('ni una coma nueva, ni marca en el asunto', () => {
    for (const [nombre, c] of CORREOS) {
      expect(c.subject, `${nombre} mete la marca en el asunto`).not.toContain(MARCA.nombre);
      expect(c.subject).not.toContain(MARCA.linea);
    }
  });
});

// ---------------------------------------------------------------------------
// La evidencia visual, comprobada como fichero (nota 5 del gate del 2026-08-25).
// ---------------------------------------------------------------------------

describe('SPEC-056: la evidencia visual queda escrita en `_qa/SPEC-056/`', () => {
  it.each(CORREOS)('%s.html está en disco y es exactamente lo que la plantilla produce', (n, c) => {
    const ruta = join(qaDir, `${n}.html`);
    expect(existsSync(ruta), `falta ${rel(ruta)}`).toBe(true);
    expect(readFileSync(ruta, 'utf8').trimEnd()).toBe(c.html);
  });
});
