import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * SPEC-050 — lo que se puede afirmar **leyendo el árbol**, sin navegador y sin git.
 *
 * ## Por qué este fichero existe, y por qué NO consulta git
 *
 * El borrador de SPEC-050 escribía media docena de criterios como *«el diff contra
 * `origin/main`»*. **ADR-031 pto. 2.1** lo prohíbe y **SPEC-048** ya tuvo que desmontar
 * ese molde en `tests/icono-frontera.test.ts`: una guardia anclada a una referencia móvil
 * se pone **verde por vacuidad** el día que se mergea, que es justo cuando debería seguir
 * vigilando. Aquí todo se afirma como **propiedad del fichero tal y como está**: se lee, se
 * compara con un valor declarado o derivado de la propia fuente, y funciona en cualquier
 * clon.
 *
 * Lo que cubre:
 *
 *   CA-4   una sola definición de la marca en el CSS, y el MISMO marcado en las dos
 *          superficies que la pintan
 *   CA-11  la cadencia es una constante importada, y en la primera pantalla no hay un
 *          segundo literal que la parafrasee
 *   CA-15  el pie sigue sin saber en qué ruta está: ni `usePathname`, ni `headers`, ni
 *          prop, ni la palabra `landing`
 *   CA-20  ni una dependencia nueva, ni un script nuevo, ni un ADR nuevo
 *   CA-22  las condiciones 2, 3 y 4 de la ÚNICA guardia ajena que esta spec estrecha,
 *          que son propiedades de `tests/e2e/ayuda.spec.ts` y se comprueban aquí
 *          (la condición 1 —«y ningún otro fichero»— es de acotación y va al gate,
 *          ADR-031 pto. 1.2)
 */

const fuente = (ruta: string) => readFileSync(ruta, 'utf8');

/** Quita comentarios de bloque y de línea. Lo que queda es lo que la página DICE. */
const sinComentarios = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/* ────────────────────────────────────────────────────────────────────────────
   Un lector de reglas CSS mínimo: selector + cuerpo, sin dependencias.
   ──────────────────────────────────────────────────────────────────────────── */

interface Regla {
  selector: string;
  cuerpo: string;
}

/**
 * Todas las reglas de una hoja, como pares selector/cuerpo. No entiende anidamiento
 * (esta hoja no lo usa) y se salta las at-rules de bloque quedándose con las reglas de
 * dentro, que es exactamente lo que hace falta para preguntar «¿quién declara esto?».
 */
function reglasDe(css: string): Regla[] {
  const limpio = sinComentarios(css);
  const reglas: Regla[] = [];
  const patron = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = patron.exec(limpio)) !== null) {
    const selector = m[1].replace(/\s+/g, ' ').trim();
    // `@media (...)` y compañía dejan su cabecera pegada al primer selector de dentro.
    if (selector.startsWith('@')) continue;
    reglas.push({ selector, cuerpo: m[2] });
  }
  return reglas;
}

/** ¿Declara esta regla la propiedad `prop` (o el atajo `font`, que la incluye)? */
const declara = (cuerpo: string, prop: string) =>
  new RegExp(`(^|;|\\s)${prop}\\s*:`, 'i').test(cuerpo);

/* ────────────────────────────────────────────────────────────────────────────
   CA-4 — una sola definición de la marca, y el mismo marcado
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-050 CA-4: la marca se define UNA vez y se pinta igual en las dos superficies', () => {
  const css = fuente('src/app/globals.css');
  const reglas = reglasDe(css);
  /** Reglas cuyo selector menciona la clase `.brand`. */
  const deLaMarca = reglas.filter((r) => /\.brand\b/.test(r.selector));

  it('la tipografía del wordmark vive en la regla `.brand` de primer nivel', () => {
    const definidoras = deLaMarca.filter(
      (r) =>
        declara(r.cuerpo, 'font') ||
        declara(r.cuerpo, 'font-size') ||
        declara(r.cuerpo, 'font-weight') ||
        declara(r.cuerpo, 'font-family') ||
        declara(r.cuerpo, 'letter-spacing'),
    );

    expect(
      definidoras.map((r) => r.selector),
      'la tipografía del wordmark tiene que estar declarada en UNA sola regla (D-1)',
    ).toEqual(['.brand']);
  });

  it('el tamaño es una propiedad personalizada que la superficie puede sobrescribir', () => {
    const brand = deLaMarca.find((r) => r.selector === '.brand');
    expect(brand, 'no existe la regla `.brand` de primer nivel').toBeTruthy();
    expect(
      brand!.cuerpo,
      'el tamaño tiene que salir de `--brand-size` con su valor por defecto, no de un ' +
        'número escrito dentro del atajo `font` (D-1)',
    ).toMatch(/var\(\s*--brand-size\s*,\s*20px\s*\)/);
  });

  it('el color del punto se declara una sola vez, en `.brand .dot`', () => {
    const conPunto = reglas.filter((r) => /\.dot\b/.test(r.selector) && /\bbrand\b/.test(r.selector));
    expect(
      conPunto.map((r) => r.selector),
      'el punto de acento se define en una sola regla',
    ).toEqual(['.brand .dot']);
  });

  it('`.app-nav` conserva SOLO lo que es del menú: que el enlace no lleve subrayado', () => {
    const delNav = deLaMarca.filter((r) => r.selector.includes('.app-nav'));
    expect(delNav.map((r) => r.selector)).toEqual(['.app-nav .brand']);

    for (const prop of ['font', 'font-size', 'font-weight', 'letter-spacing', 'color']) {
      expect(
        declara(delNav[0].cuerpo, prop),
        `.app-nav .brand no puede volver a declarar \`${prop}\`: eso son dos definiciones ` +
          'de la misma marca, que es lo que D-1 viene a acabar',
      ).toBe(false);
    }
    expect(declara(delNav[0].cuerpo, 'text-decoration')).toBe(true);
  });

  it('la landing pinta el MISMO par de nodos que la barra de navegación, no una variante', () => {
    const aplanar = (t: string) => t.replace(/\s+/g, ' ');
    const nav = aplanar(fuente('src/app/app-nav.tsx'));
    const page = aplanar(fuente('src/app/page.tsx'));

    const marcado = 'Stockeiro<span className="dot">.</span>';
    expect(nav, 'la barra ya no pinta el wordmark que este CA toma como referencia').toContain(
      marcado,
    );
    expect(
      page,
      'la primera pantalla tiene que pintar el wordmark que YA existe (nota 3 del gate), ' +
        'no una versión suya',
    ).toContain(marcado);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-11 — la cadencia es UNA constante, y no hay un segundo literal al lado
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-050 CA-11: ni una palabra menos de cadencia, y ni una palabra nueva', () => {
  const page = fuente('src/app/page.tsx');

  it('la primera pantalla IMPORTA la cadencia de `@/lib/help/content` y la renderiza entera', () => {
    expect(page).toMatch(/import\s*\{[^}]*\bCADENCIA_LINEA\b[^}]*\}\s*from\s*'@\/lib\/help\/content'/);
    expect(page, 'la constante tiene que renderizarse, no copiarse').toContain('{CADENCIA_LINEA}');
  });

  it('y no la parafrasea en ningún texto propio de la página', () => {
    // El modo de fallo que este CA existe para cerrar es `F-SPEC-039-3`: un segundo
    // literal escrito al lado que envejece en silencio mientras la constante cambia.
    // Se mira lo que la página DICE (los comentarios se retiran antes): tanto las
    // cadenas de `metadata` como el texto JSX.
    const dicho = sinComentarios(page);
    const prohibido = /cierre|refresc|una vez al d[ií]a|tiempo real|diferid/i;
    const encontrado = dicho.match(prohibido);

    expect(
      encontrado === null ? null : `${encontrado[0]} (…${dicho.slice(Math.max(0, encontrado.index! - 60), encontrado.index! + 60)}…)`,
      'src/app/page.tsx no puede tener un segundo literal sobre la cadencia: la única ' +
        'forma de que no se desincronice entre tres pantallas es que siga siendo UNA ' +
        'constante (SPEC-039 CA-3, F-SPEC-039-3)',
    ).toBeNull();
  });

  it('la constante sigue siendo la de siempre y no ha perdido palabras', async () => {
    const { CADENCIA_LINEA } = await import('../src/lib/help/content');
    expect(CADENCIA_LINEA.split(/\s+/).length, 'D-2 es locked: la frase se dice entera').toBe(40);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-15 — el pie no sabe en qué ruta está, y el componente no se toca
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-050 CA-15: el pie sigue sin saber nada', () => {
  const pie = fuente('src/app/app-footer.tsx');

  it('no lee la ruta, ni la cabecera, ni sabe que existe una landing', () => {
    for (const prohibido of ['usePathname', 'useSelectedLayoutSegment', 'next/headers', 'landing']) {
      expect(
        pie.includes(prohibido),
        `app-footer.tsx menciona \`${prohibido}\`: la subordinación de D-4 se hace en CSS ` +
          '(`.landing ~ .app-footer`), no dándole conocimiento de ruta al componente',
      ).toBe(false);
    }
  });

  it('sigue siendo la función SIN argumentos que pinta lo mismo para todo el mundo', () => {
    expect(pie).toMatch(/export function AppFooter\(\s*\)/);
  });

  it('y sigue pintando sus cinco bloques', () => {
    for (const bloque of [
      'app-footer-descargo',
      'app-footer-links',
      'app-footer-feedback',
      'app-footer-version',
      'app-footer-marca',
    ]) {
      expect(pie, `el pie ha perdido ${bloque}`).toContain(bloque);
    }
  });

  it('la subordinación se escribe en el CSS, alcanzando al pie como hermano del `<main>`', () => {
    const css = fuente('src/app/globals.css');
    const reglas = reglasDe(css).filter((r) => r.selector.includes('.landing ~ .app-footer'));

    expect(
      reglas.length,
      'nadie subordina el pie desde el CSS: si el efecto se logró de otra forma, o el pie ' +
        'sabe algo que no debe, o el selector no es el que D-4 fija',
    ).toBeGreaterThan(0);

    const feedback = reglas.find((r) => r.selector.includes('.app-footer-feedback'));
    expect(feedback, 'el canal de feedback no se retira de la landing desde el CSS').toBeTruthy();
    expect(
      feedback!.cuerpo,
      'tiene que ser `display: none`: `visibility: hidden` y `opacity: 0` dejan la caja ' +
        'ocupando alto, que es el hueco muerto que las dos guardias de pie miden (D-5)',
    ).toMatch(/display\s*:\s*none/);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-20 — sin dependencia nueva, sin script nuevo, sin ADR nuevo
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-050 CA-20: esto es presentación pura', () => {
  const pkg = JSON.parse(fuente('package.json'));

  /** Declaradas, no leídas de git: la lista vive aquí y se compara con el árbol. */
  const DEPENDENCIAS = [
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
  ];

  const DEV_DEPENDENCIAS = [
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
  ];

  const SCRIPTS = [
    'dev',
    'build',
    'start',
    'test',
    'test:watch',
    'test:e2e',
    'lint',
    'typecheck',
    'db:generate',
    'db:migrate',
    'db:scan',
    'icon:build',
    'version:check',
  ];

  it('las dependencias son EXACTAMENTE las de siempre', () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual([...DEPENDENCIAS].sort());
  });

  it('las de desarrollo también', () => {
    // La lista se declara arriba en vez de compararse contra `origin/main` (ADR-031).
    const declaradas = [...DEV_DEPENDENCIAS].sort();
    const reales = Object.keys(pkg.devDependencies).sort();
    expect(reales.filter((d) => !declaradas.includes(d)), 'dependencia de desarrollo nueva').toEqual(
      [],
    );
  });

  it('y los scripts, sin uno de más ni de menos', () => {
    expect(Object.keys(pkg.scripts).sort()).toEqual([...SCRIPTS].sort());
  });

  it('la versión sube (ADR-024 exige semver al tocar `src/`) y sigue siendo semver', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('`docs/adr/` no gana ningún fichero por esta spec: no hay decisión que registrar', () => {
    const adrs = readdirSync('docs/adr').filter((f) => f.endsWith('.md'));
    const citantes = adrs.filter((f) => fuente(`docs/adr/${f}`).includes('SPEC-050'));
    expect(
      citantes,
      'esta spec no toma ninguna decisión que constriña trabajo futuro (CE-M3): ' +
        'desacoplar `.brand` de `.app-nav` REDUCE acoplamiento, no abre puerta a nada',
    ).toEqual([]);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-22 — la única guardia ajena que se estrecha, y sus condiciones 2, 3 y 4
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-050 CA-22: la guardia ajena que se estrecha no pierde fuerza', () => {
  const ayuda = fuente('tests/e2e/ayuda.spec.ts');

  it('condición 1 (la parte comprobable aquí): el bucle de CA-12 ya no recorre `/`', () => {
    // La otra mitad de la condición 1 —«y ningún OTRO fichero»— es criterio de acotación
    // y la comprueba el verificador en el gate (ADR-031 pto. 1.2, CA-19).
    //
    // Se mira el CÓDIGO, no los comentarios: la condición 2 obliga precisamente a dejar
    // escrito al lado *qué vigilaba antes*, y eso incluye citar la lista vieja.
    const codigo = sinComentarios(ayuda);
    expect(
      codigo,
      'la lista de rutas públicas del canal de feedback tiene que quedar sin `/`: es la ' +
        'única ruta que SPEC-039 CA-12 no pedía',
    ).toContain("['/ayuda', '/login', '/register']");
    expect(codigo).not.toContain("['/ayuda', '/', '/login', '/register']");
  });

  it('condición 2: el porqué está escrito AL LADO de la aserción, no solo en el ledger', () => {
    // `FOUNDATION.md`: qué vigilaba antes, qué vigila ahora, y en virtud de qué entra.
    for (const exigido of ['SPEC-050', 'D-5', 'CA-21', '2026-08-23']) {
      expect(
        ayuda,
        `el fichero de test tiene que citar \`${exigido}\` junto a la guardia estrechada`,
      ).toContain(exigido);
    }
  });

  it('condición 3: no es una aflojada — el caso retirado se sustituye por su INVERSO', () => {
    expect(
      ayuda,
      'tiene que quedar un caso que afirme que en `/` el canal NO se muestra: el ' +
        'comportamiento en la landing sigue fijado por un test, solo que al revés',
    ).toMatch(/toHaveCount\(0\)|not\.toBeVisible\(\)/);
    // Y en lo demás nada se relaja.
    expect(ayuda).toContain('toBeVisible()');
    expect(ayuda).toMatch(/toMatch\(\/\^mailto:\//);
    expect(ayuda, 'ningún caso marcado .skip').not.toMatch(/test\.skip|describe\.skip/);
  });

  it('condición 4: la mitad autenticada de SPEC-039 CA-12 sigue entera y sin tocar', () => {
    expect(ayuda).toContain("'y desde cualquier pantalla autenticada'");
    expect(ayuda).toContain("['/dashboard', '/vigiladas', '/avisos', '/cuenta']");
  });
});
