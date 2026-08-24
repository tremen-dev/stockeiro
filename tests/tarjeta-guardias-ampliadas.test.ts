import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-051 CA-17 — **las DOS guardias ajenas se amplían nombradas, y ninguna propiedad se
 * debilita**.
 *
 * Excluir la tarjeta del `matcher` de `src/proxy.ts` es lo que la hace alcanzable por un
 * rastreador anónimo (CA-14, CA-15) y, de paso, mueve un literal que dos tests ajenos
 * tienen copiado carácter a carácter. Son **fotos del árbol**, no propiedades, y cada una
 * tiene una **hermana** en su mismo fichero que sí mide la propiedad.
 *
 * **Son dos, no tres.** SPEC-047 tuvo que ampliar tres; aquí la tercera
 * —`tests/deploy-gate-workflow.test.ts`, la lista cerrada de claves de `scripts` de
 * SPEC-028 CA-9.3— **desaparece por construcción**: el humano eligió el 2026-08-23 que el
 * generador de la tarjeta cuelgue del `icon:build` que ya existía (D-8), así que
 * `package.json` no gana ninguna clave y ese fichero no se toca en absoluto. Es la lección
 * que la spec deja escrita como precedente: **la mejor forma de tratar con una guardia
 * ajena es no necesitarla**, y el orden correcto es cambiar el diseño antes que la
 * aserción.
 *
 * El implementador no las tocó por su cuenta: escaló, lo decidió el humano (Alberto Fojo,
 * 2026-08-23) y la autorización quedó escrita **en la spec** —§Notas pto. 2 y CA-17— ANTES
 * de ejecutarse. Ese orden es la condición de proceso de `FOUNDATION.md`: quien toca una
 * guardia no es quien se beneficia de que pase.
 *
 * Este fichero es lo que impide que esa autorización se convierta en barra libre. Y no
 * mira ningún diff: **todo lo que afirma es una propiedad del árbol de hoy** (ADR-031
 * pto. 1.1). La condición 1 de CA-17 en su versión «el diff sólo toca estos dos ficheros»
 * es criterio de acotación y vive en el gate (CA-20, ADR-031 pto. 1.2); lo que sí cabe
 * aquí —y está— es su forma comprobable sin git: *nadie más ha sido re-encuadrado por
 * esta spec*.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = join(rootDir, 'tests');

const fuente = (ruta: string) => readFileSync(join(rootDir, ruta), 'utf8');
const rel = (f: string) => relative(rootDir, f).replace(/\\/g, '/');

/** Las DOS, nombradas una a una — CA-17.1. Ni una más. */
const GUARDIAS = [
  {
    fichero: 'tests/legal-rutas-publicas.test.ts',
    de: 'SPEC-035 CA-2',
    ampliada: 'sigue siendo el de siempre — quien decide es el guard, no el matcher',
    hermana: 'ninguna ruta concreta se cuela como excepción DENTRO del matcher',
  },
  {
    fichero: 'tests/cuenta-rutas.test.ts',
    de: 'SPEC-036 CA-10',
    ampliada: 'sigue siendo el de siempre — quien decide es el guard, no el matcher',
    hermana: 'ni `cuenta` ni `cuenta-borrada` aparecen dentro del literal del matcher',
  },
];

/** La que NO se toca, y el motivo por el que no hace falta (D-8). */
const NO_SE_TOCA = 'tests/deploy-gate-workflow.test.ts';

/**
 * **La FIRMA de un re-encuadre autorizado por SPEC-051 CA-17** — re-encuadrada por
 * **SPEC-052 CA-18** el **2026-08-24**; ver el porqué entero al lado de la aserción.
 *
 * No la inventa esta lista: la define **CA-17.2**, aquí abajo, al exigir que toda
 * ampliación autorizada lleve **en el cuerpo de su caso** estas seis marcas juntas. Una
 * cita en prosa no produce la conjunción; un re-encuadre autorizado sí, **por obligación**.
 */
const FIRMA_DE_REENCUADRE: ReadonlyArray<{ marca: RegExp; parte: string }> = [
  { marca: /SPEC-051/, parte: 'la spec que autoriza' },
  { marca: /CA-17/, parte: 'el CA que autoriza' },
  { marca: /2026-08-23/, parte: 'la fecha del arbitraje' },
  { marca: /arbitraje del humano/i, parte: 'quién lo arbitró' },
  { marca: /Qué vigilaba antes/, parte: 'qué vigilaba antes' },
  { marca: /Qué vigila ahora/, parte: 'qué vigila ahora' },
];

/**
 * **La autoexclusión, y por qué es necesaria y no un blanqueo** (SPEC-052 CA-18 b).
 *
 * Este fichero **define** la firma en las aserciones de CA-17.2, así que su propia fuente
 * la contiene y la detección se encontraría a sí misma. La exclusión va en una constante
 * con su motivo —y no escondida en un `filter`— porque una exclusión que nadie mira es la
 * puerta por la que se afloja esto sin que se note. El centinela de abajo comprueba las
 * dos mitades: que la fuente de este fichero **sí lleva** la firma (luego la exclusión
 * hace falta) y que la lista tiene **exactamente un** elemento (luego nadie ha colado un
 * segundo excluido de paso).
 */
const EXCLUIDOS_DE_LA_DETECCION = ['tests/tarjeta-guardias-ampliadas.test.ts'];

/**
 * Los cuerpos de caso de un fuente, con **cualquier sangría** y con el título en comilla
 * simple o en acento grave — los casos de CA-17.2 y CA-17.3 llevan el nombre interpolado y
 * van a cuatro espacios dentro de un `for`. Mismo mecanismo que `casos()` en
 * `tests/guardias-ancladas.test.ts`.
 *
 * **No sustituye a `casos()` de aquí abajo, que no se toca**: aquella la usan CA-17.2 y
 * CA-17.3 para localizar UN caso por su título exacto, y ampliarla movería aserciones que
 * SPEC-052 no tiene autorización para mover (CA-18 e).
 */
function cuerposDeCasos(src: string): string[] {
  const patron =
    /^([ \t]+)it\((?:'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`),[\s\S]*?^\1\}\);$/gm;
  return [...src.matchAll(patron)].map((m) => m[0]);
}

/**
 * **La detección, como función pura `(ruta, fuente) => boolean`** (SPEC-052 CA-18 c).
 * Función y no `expect` incrustado para poder ejercitarla **en los dos sentidos** con
 * entradas sintéticas, que es lo único que distingue una guardia de una decoración verde.
 *
 * La firma tiene que estar completa **dentro del cuerpo de UN MISMO caso**: repartida
 * entre casos distintos no es la conjunción que CA-17.2 exige, es coincidencia.
 */
function llevaFirmaDeReencuadre(ruta: string, src: string): boolean {
  if (EXCLUIDOS_DE_LA_DETECCION.includes(ruta)) return false;
  return cuerposDeCasos(src).some((cuerpo) =>
    FIRMA_DE_REENCUADRE.every(({ marca }) => marca.test(cuerpo)),
  );
}

/** Un caso sintético CON la firma completa: la detección tiene que verlo. */
const FUENTE_CON_FIRMA = [
  "describe('bloque sintético', () => {",
  "  it('una guardia ajena re-encuadrada', () => {",
  '    // Re-encuadrada por SPEC-051 CA-17, arbitraje del humano del 2026-08-23.',
  '    // Qué vigilaba antes: una foto del árbol. Qué vigila ahora: la propiedad.',
  '    expect(1).toBe(1);',
  '  });',
  '});',
].join('\n');

/** Y uno que solo la CITA en prosa: **el caso exacto que rompía la guardia vieja**. */
const FUENTE_QUE_SOLO_CITA = [
  "describe('bloque sintético', () => {",
  "  it('cita la spec, que no es re-encuadrarla', () => {",
  '    // Desde SPEC-051 el origen absoluto se lee también en tiempo de build.',
  '    expect(2).toBe(2);',
  '  });',
  '});',
].join('\n');

/**
 * Los casos de un fichero de test, por título: un `it(` con dos espacios de sangría y
 * todo lo suyo hasta el `});` que lo cierra a esa misma sangría — el estilo de los dos
 * ficheros de arriba. Mismo mecanismo que `casos()` en
 * `tests/icono-guardias-ampliadas.test.ts`, reescrito aquí en vez de importado porque
 * aquel fichero es de SPEC-047 y esta spec no lo toca ni para exportarle algo.
 */
function casos(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^ {2}it\('((?:[^'\\]|\\.)*)',[\s\S]*?^ {2}\}\);$/gm)) {
    out.set(m[1], m[0]);
  }
  return out;
}

/**
 * El caso sin sus comentarios. Hace falta porque el porqué que CA-17.2 obliga a escribir
 * al lado de la aserción NOMBRA las formas prohibidas de aflojarla, y buscarlas sobre el
 * texto entero encontraría la explicación en vez del código.
 */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function caso(src: string, titulo: string): string {
  const encontrado = casos(src).get(titulo);
  expect(encontrado, `no se encuentra el caso "${titulo}"`).toBeDefined();
  return encontrado!;
}

/** Todos los fuentes bajo `tests/`, incluidos los de e2e y los helpers. */
function fuentesDeTests(dir = testsDir): string[] {
  const out: string[] = [];
  for (const entrada of readdirSync(dir).sort()) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) out.push(...fuentesDeTests(ruta));
    else if (entrada.endsWith('.ts')) out.push(ruta);
  }
  return out;
}

describe('SPEC-051 CA-17.1: son DOS guardias ajenas, y la tercera no ha hecho falta', () => {
  it('los ficheros de tests/ re-encuadrados bajo la autorización de esta spec son esos dos', () => {
    // **`F-SPEC-052-7` — RE-ENCUADRADA por SPEC-052 CA-18 el 2026-08-24**, con
    // **autorización nominal del humano (Alberto Fojo, 2026-08-24)**. Constancia del
    // proceso, que es la mitad del valor de esto: el defecto lo detectó y lo **escaló sin
    // tocarlo** el implementador de SPEC-052, y el arreglo lo **redactó el arquitecto** —
    // quien toca una guardia no puede ser quien se beneficia de que calle
    // (`FOUNDATION.md`). El porqué que SPEC-051 dejó en la cabecera de este fichero
    // **sigue intacto**: una re-escritura no borra la auditoría de la anterior.
    //
    // **Qué vigilaba antes:** que los ficheros de `tests/` cuya fuente contuviera la
    // cadena `SPEC-051` fueran exactamente siete — las dos guardias ajenas ampliadas más
    // los cinco que aquella entrega estrenaba (`PROPIOS`, retirada con esta aserción:
    // era la **segunda instantánea congelada** del mismo caso, y los ficheros propios de
    // SPEC-051 no llevan firma porque no son re-encuadres).
    //
    // **Qué vigila ahora:** que los ficheros de `tests/` **re-encuadrados bajo la
    // autorización de SPEC-051 CA-17** sean exactamente esos dos. El conjunto se deriva
    // de la **firma** de un re-encuadre —`FIRMA_DE_REENCUADRE`, la conjunción que CA-17.2
    // ya exige aquí abajo— y no de la mención. Un fichero que solo **cite** la spec en
    // prosa no entra.
    //
    // **Por qué cambió:** era un **error de converso**. El comentario original declaraba
    // su inferencia —*«todo re-encuadre menciona SPEC-051»*— y el código la usaba como si
    // fuera *«toda mención es un re-encuadre»*: condición **necesaria** tratada como
    // **suficiente**. El converso no se sigue, y lo pagó el primero que citó
    // legítimamente a SPEC-051 — `tests/entornos-de-despliegue.test.ts`, obligado a
    // citarla por CA-2 (a) y CA-14 de SPEC-052. La guardia se rompía **por cumplir la
    // spec**, no por incumplirla. Su forma tiene nombre: **un conjunto cerrado sobre un
    // universo abierto** —los ficheros que *pueden* mencionar la cadena crecen sin
    // límite—, así que **caduca por instantánea, no por diana móvil**. Por eso la
    // meta-guardia de SPEC-048 no la vio: aquí no hay ni un `git`, y ante ADR-031 era
    // formalmente impecable.
    //
    // **Por qué se RE-ENCUADRA y no se borra:** porque *«no hubo un tercer fichero ajeno
    // aflojado»* **sigue vivo** y **ningún otro caso de este fichero lo cubre** —CA-17.2,
    // CA-17.3 y CA-17.4 hablan solo de las dos guardias autorizadas—. Borrarlo dejaría
    // esa proposición sin dueño. Es la diferencia con el caso de SPEC-050, donde lo
    // vigilado ya no podía volver a ser falso y retirarlo era limpio.
    //
    // **Lo que NO mejora, dicho en voz alta:** un re-encuadre **mudo** —aflojar una
    // tercera guardia ajena sin escribir nota alguna— no lo caza ni esta versión ni la
    // anterior; la detección siempre dependió de que el infractor escribiera la nota. La
    // cobertura frente al fallo real es **idéntica**; lo que desaparece es el falso
    // positivo.
    const reencuadrados = fuentesDeTests()
      .map(rel)
      .filter((ruta) => llevaFirmaDeReencuadre(ruta, fuente(ruta)))
      .sort();
    expect(
      reencuadrados,
      'un TERCER fichero ajeno re-encuadrado es RED: se escala al gate, no se toca',
    ).toEqual(GUARDIAS.map((g) => g.fichero).sort());
  });

  it('la exclusión de este fichero es NECESARIA, y es exactamente una', () => {
    // SPEC-052 CA-18 (b). Las dos mitades del centinela. Sin la primera, la exclusión
    // podría ser un blanqueo preventivo —excluir por si acaso, sin que hiciera falta— y
    // nadie lo sabría. Sin la segunda, mañana alguien añade un segundo excluido y la
    // lista deja de ser una excepción para convertirse en un desagüe.
    expect(
      EXCLUIDOS_DE_LA_DETECCION,
      'la lista de exclusiones no es un desagüe: es UNA excepción con nombre y motivo',
    ).toHaveLength(1);

    const yo = EXCLUIDOS_DE_LA_DETECCION[0];
    expect(yo).toBe('tests/tarjeta-guardias-ampliadas.test.ts');
    // Se pregunta por la firma SIN pasar por la exclusión: si este fichero no la llevara,
    // excluirlo sobraría y habría que quitar la excepción.
    const cuerpos = cuerposDeCasos(fuente(yo));
    expect(
      cuerpos.some((c) => FIRMA_DE_REENCUADRE.every(({ marca }) => marca.test(c))),
      'este fichero ya no contiene la firma: la exclusión ha dejado de hacer falta y ' +
        'mantenerla sería taparse un ojo sin motivo',
    ).toBe(true);
  });

  it('la detección se prueba en rojo: firma completa sí, mención en prosa NO', () => {
    // SPEC-052 CA-18 (c). Los dos sentidos, con entrada propia y en el mismo caso. El
    // segundo es literalmente el escenario que rompía la guardia vieja: una fuente que
    // nombra la spec sin haber re-encuadrado nada.
    expect(
      llevaFirmaDeReencuadre('tests/sintetico-con-firma.test.ts', FUENTE_CON_FIRMA),
      'no reconoce un re-encuadre que lleva las seis marcas: la guardia no vería el ' +
        'defecto que existe',
    ).toBe(true);
    expect(
      llevaFirmaDeReencuadre('tests/sintetico-que-cita.test.ts', FUENTE_QUE_SOLO_CITA),
      'confunde citar con re-encuadrar: es el error de converso, otra vez',
    ).toBe(false);

    // Y falta una marca cualquiera → deja de ser firma. Se quita la fecha, que es la que
    // más fácil se olvidaría al copiar una nota de otra spec.
    expect(
      llevaFirmaDeReencuadre(
        'tests/sintetico-incompleto.test.ts',
        FUENTE_CON_FIRMA.replace('2026-08-23', 'hace un tiempo'),
      ),
      'acepta una firma incompleta: entonces no está exigiendo la conjunción de CA-17.2',
    ).toBe(false);
  });

  it('y un TERCER fichero con firma rompería la igualdad: la lista sigue cerrada', () => {
    // SPEC-052 CA-18 (c), tercer caso. La comparación de arriba tiene que **distinguir**
    // un tercero, no limitarse a coincidir con lo que hay. Sin esto, un `toEqual` contra
    // un conjunto que resultara vacío pasaría igual.
    const autorizados = GUARDIAS.map((g) => g.fichero).sort();
    expect(autorizados.length, 'el conjunto autorizado no puede estar vacío').toBe(2);
    expect(
      [...autorizados, 'tests/inventado-re-encuadrado.test.ts'].sort(),
      'la comparación no distingue un tercero: habría dejado de ser una lista cerrada',
    ).not.toEqual(autorizados);
  });

  it(`${NO_SE_TOCA} ni siquiera sabe que esta spec existe`, () => {
    // D-8, y es el punto entero de la elección del humano: la tercera guardia de SPEC-047
    // no se ha ampliado, se ha vuelto innecesaria. Si esta spec hubiera estrenado un
    // `npm run`, tendría que aparecer aquí — y su ausencia es la prueba de que no lo hizo.
    expect(fuente(NO_SE_TOCA)).not.toContain('SPEC-051');
  });
});

describe('SPEC-051 CA-17.2: cada ampliación lleva su porqué al lado de la aserción', () => {
  for (const { fichero, ampliada } of GUARDIAS) {
    it(`${fichero}: dice qué vigilaba, qué vigila y en virtud de qué CA entra`, () => {
      const cuerpo = caso(fuente(fichero), ampliada);

      expect(cuerpo, 'falta la spec que amplía').toContain('SPEC-051');
      expect(cuerpo, 'falta el CA que autoriza la ampliación').toContain('CA-17');
      expect(cuerpo, 'falta la fecha del arbitraje').toContain('2026-08-23');
      expect(cuerpo, 'falta decir que lo arbitró el humano').toMatch(/arbitraje del humano/i);
      expect(cuerpo, 'falta qué vigilaba antes').toMatch(/Qué vigilaba antes/);
      expect(cuerpo, 'falta qué vigila ahora').toMatch(/Qué vigila ahora/);
      expect(cuerpo, 'falta en virtud de qué CA entra el elemento nuevo').toMatch(
        /CA-14 y CA-15/,
      );
      // Y lo que SPEC-047 escribió sigue ahí: una ampliación no borra la anterior, porque
      // entonces la auditoría de la primera desaparecería con la segunda.
      expect(cuerpo, 'se ha borrado el porqué que dejó SPEC-047').toContain('2026-08-22');
    });
  }
});

describe('SPEC-051 CA-17.3: es una ampliación, no una aflojada', () => {
  for (const { fichero } of GUARDIAS) {
    it(`${fichero}: ningún caso queda apagado`, () => {
      expect(fuente(fichero)).not.toMatch(/\b(it|describe|test)\.(skip|only|todo)\b/);
      expect(fuente(fichero)).not.toMatch(/\bxit\(|\bxdescribe\(/);
    });
  }

  for (const { fichero, ampliada } of GUARDIAS) {
    it(`${fichero}: la guardia sigue cerrada ante una exclusión inventada`, () => {
      const cuerpo = sinComentarios(caso(fuente(fichero), ampliada));
      // Sigue siendo una CADENA literal comparada con `toContain`: ni expresión regular,
      // ni `stringMatching`, ni `stringContaining` — que es como se afloja esto sin que
      // se note.
      expect(cuerpo, 'la comparación ha dejado de ser sobre una cadena literal').not.toMatch(
        /stringMatching|stringContaining|new RegExp|toMatch\(/,
      );
      const m = /toContain\(\s*\n?\s*"([^"]+)"/.exec(cuerpo);
      expect(m, 'no se encuentra el literal del matcher en la aserción').not.toBeNull();
      const literal = m![1];
      expect(
        literal,
        'la guardia ya no describe la exclusión que esta spec añade',
      ).toContain('opengraph-image.png');

      const proxy = fuente('src/proxy.ts');
      // Con el árbol real, la guardia pasa…
      expect(proxy, 'la guardia no describe el matcher que hay').toContain(literal);
      // …y con una SÉPTIMA exclusión inventada, la MISMA comparación la rechaza. Esto no
      // es leer el diff: es volver a ejecutar la guardia contra una entrada mutada.
      const mutado = proxy.replace(/(matcher: \['\/\(\(\?!)([^)]*)/, '$1$2|inventado.svg');
      expect(mutado, 'la mutación no se aplicó: la comprobación no probaría nada').not.toBe(proxy);
      expect(
        mutado.includes(literal),
        'la guardia acepta un matcher con una exclusión de más: ha dejado de estar cerrada',
      ).toBe(false);
    });
  }
});

describe('SPEC-051 CA-17.4: ninguna propiedad protegida se debilita', () => {
  for (const { fichero, hermana } of GUARDIAS) {
    it(`${fichero}: la hermana que mide la propiedad sigue ahí y sigue mirando`, () => {
      // La propiedad es «el matcher no conoce **rutas de producto**», y la tarjeta es un
      // ACTIVO —de la familia de `_next/static`, `_next/image`, `favicon.ico` e
      // `icon.svg`, que ya están en esa línea y por la misma razón—. Así que la hermana
      // tiene que seguir siendo cierta sin tocarla, y aquí se comprueba que sigue
      // existiendo y que su lista de rutas prohibidas no se ha recortado.
      const cuerpo = caso(fuente(fichero), hermana);
      expect(cuerpo).toMatch(/matcher/);
      expect(cuerpo).toMatch(/not\.toContain/);
    });
  }

  it('el matcher sigue sin conocer una sola ruta de producto', () => {
    const literal = /matcher:\s*\[([\s\S]*?)\]/.exec(fuente('src/proxy.ts'))![1];
    for (const pagina of [
      'legal',
      'login',
      'register',
      'forgot-password',
      'reset-password',
      'cuenta',
      'ayuda',
      'vigiladas',
      'cartera',
      'dashboard',
      'avisos',
      'admin',
    ]) {
      expect(literal, `"${pagina}" no se decide en el matcher, se decide en el guard`).not.toContain(
        pagina,
      );
    }
  });

  it('`PUBLIC_PREFIXES` no crece: la excepción documentada a RN-03 sigue siendo de páginas', () => {
    // CA-16. La lista de páginas públicas es la excepción DOCUMENTADA a RN-03 y engordarla
    // con estáticos la desdibuja. La tarjeta no entra aquí, entra en el matcher.
    const guard = fuente('src/lib/auth/guard.ts');
    const bloque = /export const PUBLIC_PREFIXES = \[([\s\S]*?)\];/.exec(guard);
    expect(bloque, 'no se encuentra PUBLIC_PREFIXES').not.toBeNull();
    const rutas = [...bloque![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(rutas).toEqual(
      [
        '/ayuda',
        '/cuenta-borrada',
        '/forgot-password',
        '/legal',
        '/login',
        '/register',
        '/reset-password',
      ].sort(),
    );
    expect(bloque![1], 'la tarjeta NO es una página pública: es un activo').not.toContain(
      'opengraph',
    );
  });
});
