import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-028 CA-14 — ADR-018 **D-7** aterriza como `RI-02`: *"hecho" significa
 * "vivo"*.
 *
 * D-7 estuvo **aplazado** desde el 2026-08-17 (`F-SPEC-031-1`) con la razón
 * escrita: antes de esta spec era una regla **incumplible**, porque sin conexión
 * Git el sha real no llega y `/api/version` responde `unknown`. El gate del
 * 2026-08-18 (Alberto Fojo) la firmó **con el matiz que la hizo firmable**: el
 * verificador trabaja **antes** del merge, así que lo que la regla mueve es el
 * paso a `hecho`, que ocurre **después**.
 *
 * El test tiene dos mitades, como el de SPEC-032 que lo precede
 * (`tests/reglas-ingenieria.test.ts`, que **no se toca**): que la regla nueva
 * esté con su contenido, su fuente y su mecanismo, y que **nada más se mueva** —
 * ni `RI-01`, ni las quince `RN`.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reglasPath = join(rootDir, 'docs', 'fundacion', 'reglas.md');

const source = () => readFileSync(reglasPath, 'utf8');

const ENCABEZADO = '\n## Reglas de ingeniería (RI-xx)\n';

function seccionDeIngenieria(): string {
  const partes = source().split(ENCABEZADO);
  expect(
    partes.length,
    'La sección "Reglas de ingeniería (RI-xx)" —creada por SPEC-032— tiene que seguir ' +
      'existiendo, una sola vez. Esta spec añade RI-02 dentro, no crea otra sección.',
  ).toBe(2);
  return partes[1];
}

const seccionDeDominio = () => source().split(ENCABEZADO)[0];

/** El texto con los saltos de línea planchados: dónde caiga cada salto al
 *  ajustar el margen no es contrato; las palabras sí. */
const llano = (texto: string) => texto.replace(/\s+/g, ' ').trim();

/** El cuerpo de una regla: desde su marca hasta la siguiente `- **RI-` o el fin. */
function regla(id: string): string {
  const seccion = seccionDeIngenieria();
  const inicio = seccion.indexOf(`- **${id}**`);
  expect(inicio, `No hay ninguna regla ${id} en la sección de ingeniería`).toBeGreaterThanOrEqual(
    0,
  );
  const resto = seccion.slice(inicio);
  const siguiente = resto.slice(1).search(/\n- \*\*RI-/);
  return llano(siguiente === -1 ? resto : resto.slice(0, siguiente + 1));
}

/** RI-01, tal y como SPEC-032 la dejó. Congelada entera: CA-14.3 dice que no se
 *  toca, y "no se toca" solo se puede comprobar contra el texto exacto. */
const RI_01_INTACTA = llano(`- **RI-01** (Migraciones aditivas, *expand/contract*): una migración no borra, no
  renombra y no estrecha una columna **en el mismo despliegue** que cambia el
  código. Lo destructivo se parte en dos despliegues separados por al menos un
  despliegue verde: primero se añade y se rellena; después, en otra spec, se
  retira lo viejo. El incumplimiento se detecta automáticamente (SPEC-032) y
  **solo se desbloquea por escrito**, con justificación y plan de vuelta atrás,
  en \`drizzle/destructive-waivers.json\`. Fuente: ADR-018 D-5.1.`);

describe('SPEC-028 CA-14.1: RI-02 existe, dentro de la sección que ya había', () => {
  it('la sección de ingeniería contiene RI-02', () => {
    expect(seccionDeIngenieria()).toContain('**RI-02**');
  });

  it('lleva su nombre: "Hecho" significa "vivo"', () => {
    expect(regla('RI-02')).toMatch(/"Hecho" significa "vivo"/);
  });

  it('va después de RI-01, en la misma serie', () => {
    const seccion = seccionDeIngenieria();
    expect(seccion.indexOf('**RI-01**')).toBeLessThan(seccion.indexOf('**RI-02**'));

    // La forma vieja de decir esto era `toEqual(['RI-01', 'RI-02'])`, y fue cierta
    // mientras dos fueron dos. **Re-encuadrado el 2026-08-22, autorizado por SPEC-048
    // CA-13** —nominal y cerrado a este fichero y a este caso— al escribir RI-03 (CA-11,
    // fuente ADR-031) en esta misma sección. Es el mismo caso y el mismo remedio que
    // SPEC-043 aplicó a RN-16 en `tests/reglas-ingenieria.test.ts`.
    //
    // Qué vigilaba antes: que la serie de ingeniería fuera exactamente RI-01 y RI-02 —una
    // FOTO de su extensión de aquel día, que caduca en cuanto se escribe la regla
    // siguiente—. Qué vigila ahora: la propiedad que no caduca —la serie empieza en
    // RI-01, va en orden, no salta números ni se repite, y RI-02 sigue dentro de ella—.
    // La guardia sale MÁS FUERTE, no más laxa: la forma vieja aceptaba cualquier par de
    // reglas mientras se llamaran así; ésta rechaza un hueco, un repetido, un desorden y
    // la desaparición de RI-02, y las mutaciones de control de abajo lo demuestran en vez
    // de afirmarlo (CA-13.2, la disciplina de CA-7). Lo que SPEC-028 CA-14.1 afirma sigue
    // entero: RI-02 existe, en esta sección y después de RI-01. Dos era el número que
    // había, no el tope.
    //
    // **Y el proceso, dicho como fue, porque ratificar no es borrar (CA-13.4):** el
    // arbitraje del humano **NO precedió al cambio**. El barrido de SPEC-048 buscaba
    // comparaciones contra revisiones de git y no vio esta guardia, que es una lista
    // cerrada por estado; lo levantó el implementador como `F-SPEC-048-1` en vez de
    // dejarlo correr, y el humano (Alberto Fojo) lo **ratificó el 2026-08-23**,
    // encargando la formalización a sdd-arquitecto precisamente porque no se beneficia de
    // que este test pase. Es la excepción, está datada y no sienta precedente: la regla de
    // `FOUNDATION.md` § *Cómo se trabaja aquí* —la conversación ocurre ANTES— sigue en pie.
    const numeros = (fuente: string) =>
      [...fuente.matchAll(/\*\*RI-(\d+)\*\*/g)].map((m) => Number(m[1]));

    /** La propiedad entera, aislada para poder volver a ejecutarla contra una serie mutada. */
    const serieSana = (serie: number[]) =>
      serie.length > 0 && serie.every((n, i) => n === i + 1) && serie.includes(2);

    const serie = numeros(seccion);
    expect(serie.length, 'la serie de ingeniería no puede quedarse vacía').toBeGreaterThan(0);
    expect(serie, 'la serie RI ni salta números, ni se repite, ni se desordena').toEqual(
      serie.map((_, i) => i + 1),
    );
    expect(serie, 'RI-02 tiene que seguir dentro de la serie').toContain(2);
    expect(serieSana(serie), 'la serie de ingeniería del árbol real no cumple la propiedad')
      .toBe(true);

    // …y la MISMA comparación rechaza las cuatro formas de romperla, más la serie vacía.
    // Sin esto, «la serie está bien formada» sería una afirmación sin probar — que es
    // justo el pecado que SPEC-048 vino a corregir (CA-13.2).
    expect(serieSana([1, 3]), 'acepta un hueco: RI-02 podría desaparecer sin ruido').toBe(false);
    expect(serieSana([1, 2, 2]), 'acepta un número repetido').toBe(false);
    expect(serieSana([2, 1, 3]), 'acepta la serie desordenada').toBe(false);
    expect(serieSana([1]), 'acepta que RI-02 desaparezca de la serie').toBe(false);
    expect(serieSana([]), 'acepta una sección de ingeniería vacía').toBe(false);
  });
});

describe('SPEC-028 CA-14.1: y dice exactamente lo que el gate firmó', () => {
  const FRAGMENTOS = [
    // El GREEN del verificador deja de ser suficiente…
    'una spec no pasa a `hecho` por tener GREEN del verificador',
    // …y lo que lo sustituye tiene dos mitades: mergeado Y vivo.
    'Pasa a `hecho` cuando su merge está en `main` **y** el despliegue de ese merge está vivo',
    // Las dos formas de evidencia, la automática y la manual.
    'la puerta de despliegue (`.github/workflows/deploy-gate.yml`) en verde',
    '`node scripts/check-alive.mjs --url <origen> --commit <sha del merge>` con salida **0**',
    // El matiz que la hizo firmable: sin él la regla vuelve a ser incumplible,
    // o empuja al verificador a mezclar para poder verificar, que es peor.
    'El GREEN del verificador **sigue siendo sobre el árbol de trabajo y antes del merge**',
    'lo que esta regla añade es el último paso, que ocurre **después**',
    // Y dónde queda la prueba.
    'se pega en el ledger de la spec',
  ];

  for (const fragmento of FRAGMENTOS) {
    it(`dice: "${fragmento.slice(0, 60)}…"`, () => {
      expect(regla('RI-02')).toContain(fragmento);
    });
  }
});

describe('SPEC-028 CA-14.2: cita su fuente y el mecanismo que la hace cumplible', () => {
  it('la fuente es ADR-018 D-7', () => {
    expect(regla('RI-02')).toContain('ADR-018 D-7');
  });

  it('nombra el mecanismo: /api/version (SPEC-031) y la puerta post-deploy (SPEC-028)', () => {
    // Sin los dos, la regla es incumplible — que es exactamente por lo que
    // estuvo aplazada desde el 2026-08-17.
    const cuerpo = regla('RI-02');
    expect(cuerpo).toContain('/api/version');
    expect(cuerpo).toContain('SPEC-031');
    expect(cuerpo).toContain('SPEC-028');
  });
});

describe('SPEC-028 CA-14.3: alcance estricto — nada más se mueve', () => {
  it('RI-01 sigue palabra por palabra como la dejó SPEC-032', () => {
    expect(
      regla('RI-01'),
      'CA-14.3 es explícito: RI-01 no se toca. Su política de migraciones aditivas es ' +
        'lo que hace tolerable que un merge migre producción sin que nadie mire el SQL.',
    ).toBe(RI_01_INTACTA);
  });

  it('las RN de dominio siguen todas, y en el mismo orden', () => {
    expect([...seccionDeDominio().matchAll(/\*\*(RN-\d+)\*\*/g)].map((m) => m[1])).toEqual([
      'RN-01',
      'RN-02',
      'RN-03',
      'RN-04',
      'RN-05',
      'RN-06',
      'RN-07',
      'RN-08',
      'RN-09',
      'RN-10',
      'RN-11',
      'RN-12',
      'RN-13',
      'RN-14',
      'RN-15',
      // SPEC-043, gate humano del 2026-08-21: «Cotización sin refrescar». Es de dominio
      // —dictamen de sdd-mercados, ADR-027, D-2— y entra en la serie que le toca.
      'RN-16',
    ]);
  });

  it('la serie de dominio no se ensucia con reglas de ingeniería', () => {
    // Antes se decía «no nace ninguna RN-16», porque entonces no la había. RN-16 nació
    // con SPEC-043 y es de dominio; lo que CA-14.3 protege —que las RI no se cuelen en
    // la serie RN— se sigue comprobando, y ahora por lo que es, no por el número.
    expect(
      seccionDeDominio(),
      'La numeración RN la vigilan sdd-cartera y sdd-mercados. Las RI van aparte, que es ' +
        'la razón por la que SPEC-032 creó la sección.',
    ).not.toMatch(/\*\*RI-\d+\*\*/);
  });

  it('ninguna regla de dominio se ha colado dentro de la sección de ingeniería', () => {
    expect(seccionDeIngenieria()).not.toMatch(/\*\*RN-\d+\*\*/);
  });
});
