import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
 * pto. 1.1). La condición 1 de CA-17 —«el diff sólo toca estos dos ficheros»— es criterio
 * de acotación y vive **entera** en el gate (CA-20, ADR-031 pto. 1.2). Aquí llegó a haber
 * una forma suya sin git —*«nadie más ha sido re-encuadrado por esta spec»*—, y **se
 * retiró el 2026-08-25 por SPEC-057 CA-1**: enumeraba `tests/` y congelaba el resultado,
 * y eso, aun sin `git`, sigue siendo criterio de gate (**ADR-037**). El porqué entero
 * está escrito en el hueco que dejó, más abajo. Lo que este fichero afirma hoy son las
 * condiciones 2, 3 y 4 de CA-17: que cada ampliación lleve su porqué al lado de la
 * aserción (17.2), que la guardia siga cerrada ante una exclusión inventada (17.3), y que
 * la hermana que mide la propiedad siga mirando (17.4).
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const fuente = (ruta: string) => readFileSync(join(rootDir, ruta), 'utf8');

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

/**
 * ⚠️ **Bloque RETIRADO el 2026-08-25 por SPEC-057, bajo su CA-1.** Aquí vivía
 * `describe('SPEC-051 CA-17.1: son DOS guardias ajenas, y la tercera no ha hecho falta')`
 * con sus **dos** casos, y no se ha sustituido por nada: **este hueco es la retirada.**
 *
 * - **Qué vigilaba antes**, los dos, que decían lo mismo sobre distinto universo:
 *   1. *«los únicos ficheros ajenos de tests/ que esta spec nombra son esos dos»* —
 *      barría `tests/` entero, se quedaba con los fuentes que contienen la cadena
 *      `SPEC-051` y **congelaba la lista** con `toEqual` contra `GUARDIAS` + `PROPIOS`.
 *   2. *«`tests/deploy-gate-workflow.test.ts` ni siquiera sabe que esta spec existe»* —
 *      la misma afirmación sobre un universo de un solo fichero: *«esta entrega no lo
 *      tocó»*, cierta sobre el **delta** de aquel día.
 *
 *   Los dos afirmaban **«este cambio está bien acotado»**, que es palabra por palabra la
 *   forma que **ADR-031 pto. 1** llama **criterio de gate, no test permanente**.
 * - **Qué vigila ahora**: **nada en la suite.** La afirmación vuelve al **gate**, que es
 *   donde le tocaba por **ADR-031 pto. 1.2** / **RI-03**, y donde **ya se consumó**: el
 *   ledger de SPEC-051 lleva su **GREEN 20/20 del 2026-08-23** con la revisión del diff
 *   pegada —*«los únicos ficheros ajenos tocados son los dos autorizados»*— y su **CA-20**
 *   lo verificó a mano, fichero por fichero. Es la segunda salida legítima de
 *   `FOUNDATION.md` —*borrar, si lo que vigilaba era del momento de la entrega y ya no
 *   puede volver a ser cierto*—, molde `F-SPEC-042-9` y **SPEC-053 CA-13**.
 * - **Por qué ya no puede volver a ser cierto**: **SPEC-051 está en `hecho`, y una spec en
 *   `hecho` no se reabre** (**ADR-025**). No puede re-encuadrar una tercera guardia ajena
 *   nunca más. Lo que el bloque negaba está zanjado; lo único que podía hacer ya era dar
 *   **rojos falsos**, y de la peor clase: `tests/` **sólo crece, y crece por mano ajena**,
 *   así que la primera spec que citara a `SPEC-051` legítimamente —citar a la spec que te
 *   precede es el comportamiento sano de este proyecto— paraba la CI de quien no había
 *   hecho nada. Es el **error de converso** que **ADR-037** nombra: *«todo re-encuadre
 *   autorizado menciona a X»* usado como *«toda mención de X es un re-encuadre
 *   autorizado»*, una condición necesaria tratada como suficiente.
 * - **Por qué se retira en vez de re-encuadrarse**: el re-encuadre existe, está escrito y
 *   es correcto —**SPEC-052 CA-18**, derivar el conjunto de la *firma de un re-encuadre
 *   autorizado* en vez de la cadena—, y costó **+185 líneas** en la guardia y **+212** en
 *   el fichero que la vigila: **397 líneas de maquinaria para conservar un criterio de
 *   gate ya consumido** sobre una spec que **ADR-025** impide reabrir. Lo que ese
 *   re-encuadre vigilaría —*«SPEC-051 no re-encuadró una tercera guardia»*— ya no puede
 *   volverse falso.
 * - **Por qué se retiran los DOS y no sólo el primero**: el segundo es la **misma
 *   enfermedad sobre un universo más estrecho**. Hoy no está rojo, pero se pondría el día
 *   que alguien re-encuadre `tests/deploy-gate-workflow.test.ts` citando a SPEC-051 como
 *   precedente. Retirar uno solo dejaría la clase viva, y **SPEC-057 CA-1** cond. 1 lo
 *   declara **RED**.
 * - **Lo que NO se ha hecho, y está prohibido hacer** (CA-1 cond. 3): **excluir por
 *   nombre** el fichero o la spec que rompieran el barrido. Dejaría el molde vivo para el
 *   siguiente. Lo descartó el humano explícitamente el 2026-08-24 (SPEC-053 CA-13
 *   cond. 3).
 * - **En virtud de qué entra**: **SPEC-057 CA-1** y **ADR-037 pto. 7**, que autoriza esta
 *   retirada *«y no autoriza nada más de ese fichero»*. Los dos **aprobados nominalmente
 *   por el humano (Alberto Fojo) el 2026-08-25**, y escritos **antes** de implementarse.
 *   **Quien lo escribe no es quien se beneficia**: lo redactó el **arquitecto** en la spec
 *   y en ADR-037; el implementador lo ejecuta y no lo decide (`FOUNDATION.md`, ADR-031
 *   pto. 5).
 * - **Qué se pierde**: cazar automáticamente a quien re-encuadrara una tercera guardia
 *   ajena en nombre de SPEC-051 sin pasar por el gate. Aceptado: SPEC-051 está en `hecho`
 *   y ya no puede hacerlo, y cualquier re-encuadre pasa por el gate humano de su propia
 *   spec.
 * - **Qué NO se pierde**: los **diez** casos restantes de este fichero siguen verdes y sin
 *   una línea tocada —**CA-17.2** (cada ampliación lleva su porqué al lado de la
 *   aserción), **CA-17.3** (la guardia sigue cerrada ante una exclusión inventada, con su
 *   mutación de control) y **CA-17.4** (la hermana que mide la propiedad sigue mirando,
 *   incluidas `PUBLIC_PREFIXES` y las doce rutas de producto)—. No se ha marcado nada
 *   `.skip`, `.only` ni `.todo`, ninguna comparación exacta se ha cambiado por una laxa, y
 *   no se ha tocado ningún otro fichero de `tests/`.
 *
 * *Nota mecánica, para que no se lea como cambio de criterio*: la retirada deja sin uso
 * `readdirSync`, `statSync`, `relative`, `testsDir`, `rel`, `NO_SE_TOCA`, `PROPIOS` y
 * `fuentesDeTests`. Se eliminan **porque `eslint --max-warnings=0` rechaza un símbolo sin
 * usar**, no porque se decida nada sobre ellos. `casos()`, `sinComentarios()`, `caso()`,
 * `fuente()` y `GUARDIAS` **se quedan**: los usan los tres bloques que sobreviven. Es la
 * misma nota que SPEC-053 CA-13 dejó escrita para su `readdirSync`.
 */

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
