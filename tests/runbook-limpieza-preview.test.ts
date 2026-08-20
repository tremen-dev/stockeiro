import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-042 CA-7 — el runbook cuenta la trampa, la solución y lo que la solución
 * cuesta.
 *
 * Hasta hoy `docs/despliegue.md` §13.3 defendía el techo de ramas de Neon con un
 * párrafo pidiéndole a una persona que revisara la consola periódicamente. Duró
 * **un día**: el 2026-08-19/20 el techo se agotó y tumbó un despliegue de
 * producción. Lo que sustituye a ese párrafo es un mecanismo
 * (`.github/workflows/neon-preview-cleanup.yml`), y este test congela que el
 * runbook lo cuente entero — incluida la contrapartida que hay que aceptar a
 * cambio y lo que el mecanismo **no** arregla.
 *
 * Se trocea el documento por secciones y cada cosa se comprueba **donde tiene
 * que estar**, como en `tests/runbook-check-alive.test.ts` y
 * `tests/runbook-despliegue-automatico.test.ts`: un `toContain` sobre el fichero
 * entero casaría igual con una mención de pasada en otro apartado.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runbookPath = join(rootDir, 'docs', 'despliegue.md');

const source = () => readFileSync(runbookPath, 'utf8');

/** Encabezado -> cuerpo, cortando en `corte` para no arrastrar lo de después. */
function trocear(texto: string, separador: RegExp, corte?: RegExp): Map<string, string> {
  const partes = texto.split(separador).slice(1);
  return new Map(
    partes.map((parte) => {
      const salto = parte.indexOf('\n');
      const titulo = parte.slice(0, salto).trim();
      let cuerpo = parte.slice(salto + 1);
      if (corte) cuerpo = cuerpo.split(corte)[0];
      return [titulo, cuerpo];
    }),
  );
}

const secciones = () => trocear(source(), /^## /m);
const subsecciones = () => trocear(source(), /^### /m, /^## /m);

function queCumple(mapa: Map<string, string>, predicado: (t: string) => boolean, pista: string) {
  const encontrada = [...mapa.entries()].find(([titulo]) => predicado(titulo));
  expect(encontrada, pista).toBeDefined();
  return encontrada![1];
}

/** §6 — notas y gotchas. */
const gotchas = () =>
  queCumple(secciones(), (t) => t.startsWith('6.'), 'No existe la sección §6');
/** §9 — la CI de las PR. */
const ci = () => queCumple(secciones(), (t) => t.startsWith('9.'), 'No existe la sección §9');
/** §13 entero — acciones de ops, con su tabla y sus subapartados. */
const ops = () =>
  queCumple(
    secciones(),
    (t) => /fuera del repositorio|acciones de ops/i.test(t),
    'No existe la sección §13',
  );
/** Solo la tabla de acciones de §13: lo que hay antes de §13.1. */
const tablaDeOps = () => ops().split(/^### /m)[0];
/** §13.3 — el preview branching de Neon y sus techos. */
const preview = () =>
  queCumple(subsecciones(), (t) => t.startsWith('13.3'), 'No existe §13.3');

/** Una cita se comprueba con los espacios normalizados: markdown parte las líneas
 *  a 100 columnas y la cita sigue siendo literal aunque el salto caiga en medio. */
const citado = (texto: string) => texto.replace(/\s+/g, ' ');

/** El mensaje literal del incidente, para que sea reconocible si vuelve. */
const MENSAJE = 'Branch limit reached. Upgrade your plan or delete unused branches.';
/** Las dos fuentes de Neon que sostienen todo lo de arriba. */
const FUENTE_INTEGRACION = 'https://neon.com/docs/guides/vercel-managed-integration';
const FUENTE_LIMPIEZA = 'https://neon.com/docs/guides/vercel-branch-cleanup';
const WORKFLOW = '.github/workflows/neon-preview-cleanup.yml';

describe('SPEC-042 CA-7.1: §6 cuenta la trampa — borrar la rama de git NO borra la de Neon', () => {
  it('7.1 — la entrada existe y dice exactamente eso', () => {
    expect(
      gotchas(),
      'Es la frase que resume el defecto entero. Sin ella, quien borre la rama de git ' +
        'seguirá creyendo que ha limpiado algo.',
    ).toMatch(/borrar la rama de git[^\n]*no borra la rama de neon/i);
  });

  it('7.1 — dice de qué cuelga la rama de preview: de la retención de Vercel', () => {
    const cuerpo = gotchas();
    expect(cuerpo).toMatch(/retenci[óo]n/i);
    expect(cuerpo).toMatch(/6 meses|seis meses/i);
    expect(cuerpo, 'La retención es de DESPLIEGUES de Vercel, no de la PR').toMatch(
      /vercel/i,
    );
  });

  it('7.1 — y a qué ritmo revienta: una spec por PR, diez de techo', () => {
    expect(gotchas()).toMatch(/~?\s*8\s+merges|cada\s+~?8/i);
  });

  it('7.1 — con la cita de Neon y el enlace a la fuente, no de memoria', () => {
    const cuerpo = gotchas();
    expect(cuerpo).toContain(FUENTE_INTEGRACION);
    expect(
      citado(cuerpo),
      'La cita literal es lo que separa un hecho verificado de una suposición.',
    ).toMatch(/retains preview deployments for 6 months by default/i);
  });

  it('7.1 — y apunta a dónde vive el mecanismo que lo resuelve', () => {
    expect(gotchas()).toMatch(/13\.3|SPEC-042/);
  });
});

describe('SPEC-042 CA-7.2: §9 dice que hay TRES workflows, y qué pregunta responde cada uno', () => {
  it('7.2 — los tres ficheros están nombrados', () => {
    const cuerpo = ci();
    for (const fichero of ['ci.yml', 'deploy-gate.yml', 'neon-preview-cleanup.yml']) {
      expect(cuerpo, `§9 no nombra ${fichero}`).toContain(fichero);
    }
  });

  it('7.2 — y dice que son tres, con todas las letras', () => {
    expect(ci()).toMatch(/\btres\b[^\n]{0,40}workflows?|workflows?[^\n]{0,40}\btres\b/i);
  });

  it('7.2 — cada uno con su pregunta y su momento', () => {
    const cuerpo = ci();
    expect(cuerpo, 'Falta la pregunta de ci.yml').toMatch(/se puede mezclar/i);
    expect(cuerpo, 'Falta la pregunta de deploy-gate.yml').toMatch(/lleg[óo]\?/i);
    expect(cuerpo, 'Falta la pregunta del limpiador').toMatch(/queda basura/i);
    expect(cuerpo, 'Falta el momento del limpiador: al CERRAR la PR').toMatch(
      /al\s+\*{0,2}cerrar\*{0,2}\s+la\s+PR/i,
    );
  });

  it('7.2 — y que el tercero NO es ni debe ser un check requerido', () => {
    expect(
      ci(),
      'Un check requerido que se ejecuta después del merge es una contradicción: ' +
        'bloquearía todas las PR esperando algo que en una PR nunca aparece.',
    ).toMatch(/no es[^.\n]{0,40}(ni debe serlo|ni debe ser)[^.\n]{0,40}requerido|no es[^.\n]{0,60}check requerido/i);
  });

  it('7.2 — por la misma razón por la que `Alive` tampoco lo es', () => {
    expect(ci()).toContain('Alive');
  });
});

describe('SPEC-042 CA-7.3: §13 gana sus tres filas de ops, cada una con su follow-up', () => {
  it('7.3 — NEON_PROJECT_ID, y como VARIABLE del repositorio', () => {
    const tabla = tablaDeOps();
    expect(tabla).toContain('NEON_PROJECT_ID');
    expect(tabla, 'No es un secreto: verla en el log ayuda a diagnosticar').toMatch(
      /NEON_PROJECT_ID[^\n]*variable|variable[^\n]*NEON_PROJECT_ID/i,
    );
    expect(tabla).toContain('F-SPEC-042-1');
  });

  it('7.3 — NEON_API_KEY, como SECRETO y con dónde se crea', () => {
    const tabla = tablaDeOps();
    expect(tabla).toContain('NEON_API_KEY');
    expect(tabla).toMatch(/NEON_API_KEY[^\n]*secreto|secreto[^\n]*NEON_API_KEY/i);
    expect(tabla, 'Sin decir dónde se crea, la fila es un recordatorio más').toMatch(
      /Account Settings.{0,10}(→|->).{0,10}API Keys/i,
    );
    expect(tabla).toContain('F-SPEC-042-2');
  });

  it('7.3 — y la casilla de GitHub, separada a propósito', () => {
    const tabla = tablaDeOps();
    expect(tabla).toContain('Automatically delete head branches');
    expect(tabla).toContain('F-SPEC-042-3');
  });

  it('7.3 — las tres filas son filas de la tabla, no un párrafo suelto', () => {
    const filas = tablaDeOps()
      .split('\n')
      .filter((l) => l.trim().startsWith('|'));
    const texto = filas.join('\n');
    for (const clave of ['NEON_PROJECT_ID', 'NEON_API_KEY', 'Automatically delete head branches']) {
      expect(texto, `${clave} no está en la tabla de acciones de ops`).toContain(clave);
    }
  });
});

describe('SPEC-042 CA-7.4: §13.3 reescrita — el techo 2 tiene dueño automático', () => {
  it('7.4 — el techo 1 sigue intacto: esta spec no lo sube', () => {
    const cuerpo = preview();
    expect(cuerpo).toMatch(/10 ramas/i);
    expect(cuerpo).toMatch(/\bFree\b/);
  });

  it('7.4 — el techo 2 deja de resolverse con "revisar la consola periódicamente"', () => {
    expect(
      preview(),
      'Mientras el mantenimiento a mano siga presentado como la defensa, el runbook ' +
        'sigue pidiéndole a una persona que se acuerde — que es el defecto, no la cura.',
    ).not.toMatch(/\*\*Mantenimiento\*\*:\s*revisar la consola/i);
  });

  it('7.4 — y pasa a tener dueño: el workflow, nombrado por su ruta', () => {
    const cuerpo = preview();
    expect(cuerpo).toContain(WORKFLOW);
    expect(cuerpo).toMatch(/al\s+\*{0,2}cerrar\*{0,2}\s+la\s+PR/i);
    expect(cuerpo).toContain(FUENTE_LIMPIEZA);
  });

  it('7.4 — con el incidente del 2026-08-19/20 y su mensaje LITERAL', () => {
    const cuerpo = preview();
    expect(cuerpo).toContain('2026-08-19');
    expect(
      citado(cuerpo),
      'El mensaje literal es lo que hará reconocible el fallo si vuelve.',
    ).toContain(MENSAJE);
  });

  it('7.4 — y sin dejar en futuro un mecanismo que ya está escrito', () => {
    expect(
      preview(),
      'Mientras diga "mientras SPEC-042 no esté viva", el runbook describe una promesa ' +
        'y no lo que hay en el árbol.',
    ).not.toMatch(/mientras\s+\*{0,2}SPEC-042\*{0,2}\s+no est[ée]/i);
  });

  it('7.4 — deja hueco escrito para lo que aún no se ha medido (CA-9)', () => {
    // Qué hace la acción ante una rama que ya no existe NO está documentado en su
    // README. Se mide en el primer cierre real; hasta entonces el runbook dice que
    // no se sabe, en vez de inventarlo.
    expect(preview()).toMatch(/rama que (ya )?no existe|rama inexistente/i);
  });
});

describe('SPEC-042 CA-7.5: la contrapartida, escrita y no enterrada', () => {
  it('7.5 — las URLs de preview antiguas dejan de conectar', () => {
    const cuerpo = preview();
    expect(cuerpo).toMatch(/URLs? de preview[^\n]*dejan de conectar|dejan de conectar/i);
  });

  it('7.5 — con las palabras de Neon, que es quien lo declara', () => {
    expect(citado(preview())).toMatch(/those deployments will fail on database connections/i);
  });
});

describe('SPEC-042 CA-7.6: y lo que NO arregla, dicho para que nadie lo confunda', () => {
  it('7.6 — la casilla de GitHub no toca Neon', () => {
    const cuerpo = preview();
    expect(cuerpo).toContain('Automatically delete head branches');
    expect(
      cuerpo,
      'Quien crea que con esa casilla el problema de Neon está resuelto, se lo volverá ' +
        'a encontrar.',
    ).toMatch(/no toca Neon/i);
  });

  it('7.6 — y lo que sí hace: barrer ramas de git muertas (27 el mismo día)', () => {
    expect(preview()).toMatch(/\b27\b/);
  });

  it('7.6 — la mitad 1 de F-SPEC-028-2 sigue abierta: se quita la acumulación, no el techo', () => {
    const cuerpo = preview();
    expect(cuerpo).toContain('F-SPEC-028-2');
    expect(cuerpo).toMatch(/mitad 1|sigue abierta/i);
  });
});

describe('SPEC-042 — el runbook no se contradice a sí mismo', () => {
  it('ninguna sección sigue diciendo que el repositorio no tiene ni un secreto', () => {
    // La propiedad murió aquí, y decirlo es parte del trato (ADR-018 D-4 se lee
    // como propiedad DEL CI, no como frontera del repositorio). §9 puede seguir
    // afirmándolo de `ci.yml`, pero no del repositorio entero.
    expect(source()).not.toMatch(/(el|este) repositorio no (tiene|lleva) (ni un|ning[úu]n) secreto/i);
  });

  it('§9 sigue diciendo que la CI —la de las PR— no lleva ni un secreto', () => {
    // Lo que SPEC-031 y SPEC-032 congelaron en tests sigue siendo verdad, y el
    // runbook lo sigue afirmando de quien corresponde.
    expect(ci()).toMatch(/no lleva ni un secreto/i);
  });
});

/**
 * O-2 del verificador (ronda 2) — el hueco nuevo tampoco se queda sin red.
 *
 * Todo lo que pide CA-7 lo congelan los bloques de arriba. Lo que la ronda 2
 * añadió **por encima** de CA-7 —el filtro de caracteres, lo que cuesta
 * (`F-SPEC-042-7`) y cómo se diagnostica su silencio— era prosa que se podía
 * borrar sin que nada se pusiera rojo. Y ya se ha reescrito dos veces: primero
 * porque afirmaba que no había shell, después porque afirmaba que un job saltado
 * no aparece en Actions. Un párrafo que ha sido falso dos veces es exactamente el
 * que hay que congelar.
 *
 * Lo que NO se congela aquí, y el motivo: el comando de CA-9 y sus dos ramas
 * («si sale verde» / «si sale rojo»). Ese texto está escrito para ser
 * **sustituido** por el veredicto antes de mezclar; un test sobre él tendría que
 * editarse en el mismo commit que lo responde, que es un test que pide permiso en
 * vez de proteger algo. Lo que sí sobrevive al veredicto —que §13.3 declare el
 * hueco de CA-9— ya lo congela el caso 7.4 de arriba.
 */
describe('SPEC-042 O-2: el hueco del filtro (F-SPEC-042-7) también queda congelado', () => {
  it('§13.3 nombra los tres caracteres filtrados y por qué llegan a una shell', () => {
    const cuerpo = preview();
    expect(cuerpo, 'Sin los tres caracteres, la viñeta no dice qué se filtra').toMatch(
      /composite action/i,
    );
    expect(cuerpo).toMatch(/backtick/i);
    expect(cuerpo).toMatch(/comilla doble/i);
    expect(
      cuerpo,
      'El punto entero es que `github.head_ref` SÍ llega a un intérprete de comandos.',
    ).toMatch(/int[ée]rprete de comandos|shell/i);
  });

  it('§13.3 dice lo que el filtro cuesta, con su identificador', () => {
    const cuerpo = preview();
    expect(cuerpo).toContain('F-SPEC-042-7');
    expect(
      cuerpo,
      'Cerrar un agujero abrió un hueco: la rama que no se barre queda huérfana.',
    ).toMatch(/hu[ée]rfana/i);
  });

  it('§13.3 NO vuelve a decir que un job saltado no aparece en Actions', () => {
    // Era falso, y del modo que más estorba: es la línea de diagnóstico. El
    // disparador `pull_request: [closed]` no filtra por rama ni por ruta, así que
    // el evento crea la ejecución y el `if` se evalúa después, a nivel de job.
    // Comprobado contra la API de GitHub el 2026-08-20: `?status=skipped` es un
    // filtro válido de `/actions/runs` y devuelve ejecuciones reales.
    expect(
      source(),
      'Quien siga esa frase verá una ejecución en Actions, concluirá que el limpiador ' +
        'corrió y nunca mirará el nombre de la rama — lo contrario de lo que pretende.',
    ).not.toMatch(/no aparece en Actions|no dej[óo] rastro/i);
  });

  it('§13.3 dice lo que de verdad se ve: la ejecución aparece, con el job saltado', () => {
    const cuerpo = citado(preview());
    expect(cuerpo).toMatch(/aparece\*{0,2}\s+una\s+ejecuci[óo]n|\*{0,2}aparece\*{0,2}\s+en Actions/i);
    expect(cuerpo, 'La conclusión que se ve es `skipped`, no una ausencia').toMatch(/skipped/);
    expect(
      cuerpo,
      'Y la señal de diagnóstico es la ejecución sin trabajo hecho, no la ejecución que falta.',
    ).toMatch(/sin trabajo hecho/i);
    expect(cuerpo, 'Y remata donde hay que mirar: el nombre de la rama').toMatch(
      /nombre de su rama/i,
    );
  });

  it('los dos *fail-closed* de §13.3 se distinguen: uno avisa y el otro no', () => {
    const cuerpo = citado(preview());
    expect(
      cuerpo,
      'El hueco del filtro falla EN SILENCIO; las variables de ops que faltan fallan EN ' +
        'ROJO. Bajo la misma etiqueta y sin distinguir, la etiqueta engaña.',
    ).toMatch(/fail-closed\*{0,2}\s+\*{0,2}y en\s+silencio/i);
    expect(cuerpo).toMatch(/fail-closed\*{0,2}\s+\*{0,2}y en\s+rojo/i);
  });
});
