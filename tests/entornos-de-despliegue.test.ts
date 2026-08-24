import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { appBaseUrl } from '@/lib/config/app-url';

/**
 * SPEC-052 — **lo que el build exige, cruzado con lo que el runbook promete.**
 *
 * ## Qué se rompió, y por qué hacía falta una guardia y no otro párrafo
 *
 * `docs/despliegue.md` §0 afirmaba que la ausencia de `APP_BASE_URL` era un error de
 * tiempo de **petición** y que el despliegue salía verde igualmente. Fue cierto hasta
 * que **SPEC-051** puso `metadataBase: new URL(appBaseUrl())` en el export `metadata`
 * del layout raíz: eso se evalúa **al construir**, y `appBaseUrl()` lanza si la clave
 * falta. El **2026-08-23** el Preview del **PR #58** murió en `next build`
 * (*Collecting page data* → `Failed to collect configuration for /_not-found`) y el
 * artefacto **no llegó a existir**. Ese mismo día, un lector del párrafo concluyó que
 * era «técnicamente correcto»: el documento no estaba callado, estaba **convenciendo**.
 *
 * La causa raíz no era el párrafo, era la **asimetría**: el entorno de build de la CI es
 * un **superconjunto** del de Preview, y eso no estaba escrito ni vigilado en ningún
 * sitio. Mover una lectura de entorno de tiempo de petición a tiempo de build **cambia
 * el conjunto de entornos que necesitan esa clave**, y hasta hoy nada lo decía.
 *
 * ## La propiedad que este fichero afirma, y su límite declarado
 *
 * *Toda clave que el build exige está declarada en el runbook como necesaria también en
 * Preview.* «Lo que el build exige» se **deriva** del bloque `env` del job de CI que
 * ejecuta `npm run build` (**D-1**) — la única declaración ejecutable que el repositorio
 * tiene del asunto, ya congelada con `toEqual` en `tests/ci-workflow.test.ts` caso 5.1,
 * que **esta spec usa y NO modifica**. Tres eslabones sin salto silencioso: añadir una
 * lectura de entorno en build obliga a añadir la clave al `env` de la CI (o la CI no
 * construye) → obliga a tocar aquel `toEqual` → esta guardia obliga a documentarla como
 * necesaria en Preview.
 *
 * **Su límite, escrito para que no se olvide (F-SPEC-052-1):** no sabe nada del estado
 * REAL del panel de Vercel. Si mañana el panel pierde una clave, esta guardia sigue
 * verde; lo único que lo delata es una preview roja. Se prefirió un documento cierto sin
 * guardia a una guardia falsa.
 *
 * ## Por qué no toca `git` (D-4)
 *
 * Lo que afirma es una **propiedad del estado del árbol** —*el runbook y el workflow
 * concuerdan*—, no un criterio sobre un delta. Es cierta hoy, mañana y después de
 * mergear, así que no necesita ventana de dos sha, ni `skipIf`, ni centinela de ventana:
 * no hay revisión que anclar (ADR-031 / RI-03). Los dos criterios de esta spec que **sí**
 * son sobre un delta —*«esto no toca `src/`»* (CA-15) y *«un build sin la clave falla»*
 * (CA-16)— se quedan **fuera de la suite**, en el gate, con su evidencia en el ledger.
 *
 * ## Contra el verde vacío
 *
 * Tres defensas explícitas, porque este proyecto ya pagó cinco veces por guardias que
 * nunca se habían visto fallar (ADR-031): dos **centinelas de no-vacuidad** (CA-9, CA-10)
 * y, sobre todo, la comprobación **probada en rojo con su propia entrada** (CA-11). Una
 * guardia que nunca falló no es una guardia, es una decoración.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runbookPath = join(rootDir, 'docs', 'despliegue.md');
const workflowPath = join(rootDir, '.github', 'workflows', 'ci.yml');
const envExamplePath = join(rootDir, '.env.example');
const esteFichero = fileURLToPath(import.meta.url);

const runbook = () => readFileSync(runbookPath, 'utf8');
const workflow = () => readFileSync(workflowPath, 'utf8');
const envExample = () => readFileSync(envExamplePath, 'utf8');

// ---------------------------------------------------------------------------
// Normalizadores. Una frase es contrato; dónde caiga el salto de línea al ajustar
// el margen, no. Y el énfasis tampoco: una afirmación retirada no vuelve a estar
// permitida por escribirla en cursiva.
// ---------------------------------------------------------------------------

/** Sin las marcas de cita de markdown y con los espacios planchados: una frase partida en
 *  dos líneas de un blockquote sigue siendo la misma frase. */
const llano = (t: string) =>
  t
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
/** Y sin énfasis ni comillas de código. El guion bajo NO se toca: forma parte de nombres
 *  que son contrato (`APP_BASE_URL`, `/_not-found`). */
const desnudo = (t: string) => llano(t).replace(/[*`]/g, '');

// ===========================================================================
// D-3 — LAS FUNCIONES PURAS. Dos cadenas entran, un veredicto sale. Es lo que
// permite ejercitar el camino ROJO con entradas de prueba (CA-11) sin tocar el
// árbol ni inventar un repositorio temporal.
// ===========================================================================

/** El vocabulario CERRADO de la columna `Entornos` (CA-4 a). Cerrado a propósito: una
 *  columna que admite prosa vuelve a ser prosa, y el cruce de CA-8 no podría leerla. */
export const VOCABULARIO_ENTORNOS = ['Production', 'Preview + Production', 'Opcional'] as const;

/** El único valor que satisface a CA-8: la clave tiene que existir también en Preview. */
const EXIGIDA_EN_PREVIEW = 'Preview + Production';

type Step = { name?: string; run?: string };
type Job = { name?: string; env?: Record<string, unknown>; steps?: Step[] };
type Workflow = { jobs?: Record<string, Job> };

/**
 * Los jobs que **construyen**, localizados por su CONTENIDO —un `run` que ejecuta
 * `npm run build`— y **nunca por su nombre**. Un nombre es un literal que caduca al
 * primer renombrado; el `run` es lo que de verdad importa. Se parsea el YAML de verdad
 * (paquete `yaml`) en vez de pasarle un regex al texto: un regex casaría con la mención
 * de `npm run build` que hay en la cabecera de comentarios del propio workflow.
 */
export function jobsQueConstruyen(yamlDeCI: string): string[] {
  const wf = (parse(yamlDeCI) ?? {}) as Workflow;
  return Object.entries(wf.jobs ?? {})
    .filter(([, job]) =>
      (job.steps ?? []).some((s) => typeof s.run === 'string' && /\bnpm run build\b/.test(s.run)),
    )
    .map(([id]) => id);
}

/**
 * D-1 — **lo que el build exige, derivado y no copiado**: el bloque `env` del job que
 * construye. Ese job corre en un runner donde no hay definido nada más, así que lo que
 * lleva es exactamente lo que el build necesita para no caerse.
 *
 * Es una **sobreaproximación segura** y está declarada como tal (F-SPEC-052-3): si el
 * bloque llevara una clave que el build no necesita *estrictamente*, la guardia exigirá
 * documentarla como necesaria en Preview igualmente. El error caro es el otro — exigir de
 * más cuesta una entrada en un panel; exigir de menos cuesta **todas** las previews.
 */
export function clavesQueExigeElBuild(yamlDeCI: string): string[] {
  const wf = (parse(yamlDeCI) ?? {}) as Workflow;
  const claves = new Set<string>();
  for (const id of jobsQueConstruyen(yamlDeCI)) {
    for (const clave of Object.keys(wf.jobs?.[id]?.env ?? {})) claves.add(clave);
  }
  return [...claves].sort();
}

export type FilaDeEntorno = { variable: string; entornos: string };

/** Corta una sección `## <prefijo>…` del markdown. Devuelve `null` si no existe. */
function seccionDeNivel2(markdown: string, prefijo: string): string | null {
  const parte = markdown.split(/^## /m).find((p) => p.startsWith(prefijo));
  return parte === undefined ? null : parte;
}

/** Las celdas de una fila de tabla markdown, sin las barras de los extremos. */
const celdas = (linea: string) =>
  linea
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());

/**
 * La columna **Entornos** de la tabla de §0, leída como datos. Toma el runbook **entero**
 * a propósito: así la misma función que lee el fichero real puede leer un runbook de
 * prueba escrito dentro de un caso (CA-11).
 */
export function entornosDeclarados(runbookMarkdown: string): FilaDeEntorno[] {
  const seccion = seccionDeNivel2(runbookMarkdown, '0.');
  if (seccion === null) return [];
  const lineas = seccion.split('\n');
  const iCabecera = lineas.findIndex(
    (l) => /^\s*\|/.test(l) && /\bVariable\b/.test(l) && /\bEntornos\b/.test(l),
  );
  if (iCabecera === -1) return [];
  const cabecera = celdas(lineas[iCabecera]);
  const iVariable = cabecera.indexOf('Variable');
  const iEntornos = cabecera.indexOf('Entornos');
  if (iVariable === -1 || iEntornos === -1) return [];

  const filas: FilaDeEntorno[] = [];
  // +2: la cabecera y la línea de separación `|---|`.
  for (let i = iCabecera + 2; i < lineas.length; i++) {
    if (!/^\s*\|/.test(lineas[i])) break;
    const c = celdas(lineas[i]);
    const variable = (c[iVariable] ?? '').replace(/`/g, '').trim();
    if (variable === '') continue;
    filas.push({ variable, entornos: (c[iEntornos] ?? '').trim() });
  }
  return filas;
}

export type Incumplimiento = { clave: string; mensaje: string };

/**
 * **La comprobación entera, como función pura sobre dos cadenas.** La implicación que se
 * rompió el 2026-08-23, y la única que se puede afirmar sin salir del árbol (D-2): *si el
 * build exige una clave, el runbook tiene que decir que Preview la necesita*.
 */
export function incumplimientos(yamlDeCI: string, runbookMarkdown: string): Incumplimiento[] {
  const declarado = new Map(entornosDeclarados(runbookMarkdown).map((f) => [f.variable, f.entornos]));
  const out: Incumplimiento[] = [];
  for (const clave of clavesQueExigeElBuild(yamlDeCI)) {
    const valor = declarado.get(clave);
    if (valor === EXIGIDA_EN_PREVIEW) continue;
    const declara =
      valor === undefined
        ? 'no aparece en la tabla de §0 de `docs/despliegue.md`'
        : `la tabla de §0 de \`docs/despliegue.md\` la declara como «${valor}»`;
    out.push({
      clave,
      mensaje:
        `${clave}: el build la exige —está en el bloque \`env\` del job de CI que ejecuta ` +
        `\`npm run build\`— pero ${declara}. Tiene que decir «${EXIGIDA_EN_PREVIEW}»: si no ` +
        `está en el entorno Preview, el build de Preview de toda PR fallará en \`next build\` ` +
        `y la PR se quedará sin preview, como pasó el 2026-08-23 en el PR #58.`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// CA-11 — el camino ROJO, con entrada propia. Va PRIMERO en el fichero porque es
// lo primero que se escribió: una guardia que se redacta al final se redacta para
// que pase, y nunca se la ve fallar.
// ---------------------------------------------------------------------------

/** Un runbook mínimo pero con la forma real: §0, su tabla y la columna `Entornos`. */
const runbookDePrueba = (entornosDeAppBaseUrl: string) => `# Runbook de prueba

## 0. Qué vamos a aprovisionar

| Variable | Servicio | Para qué | Entornos | Spec |
|---|---|---|---|---|
| \`DATABASE_URL\` | Neon | Postgres | Preview + Production | ADR-001 |
| \`AUTH_SECRET\` | — | Firma de sesión | Preview + Production | SPEC-001 |
| \`AUTH_TRUST_HOST\` | — | Tras el proxy | Preview + Production | SPEC-001 |
| \`APP_BASE_URL\` | — | Origen absoluto | ${entornosDeAppBaseUrl} | SPEC-023 |

## 1. Lo que venga después
`;

describe('SPEC-052 CA-11: la guardia se prueba EN ROJO, con su propia entrada', () => {
  it('con `APP_BASE_URL` marcada «Production» a secas, devuelve un incumplimiento', () => {
    // El escenario exacto del 2026-08-23: la clave existe en el runbook, pero declarada
    // como si solo hiciera falta en producción. Es el estado en el que estaba el panel de
    // Vercel cuando SPEC-051 movió la lectura a tiempo de build.
    const fallos = incumplimientos(workflow(), runbookDePrueba('Production'));

    expect(fallos.map((f) => f.clave)).toEqual(['APP_BASE_URL']);

    const mensaje = fallos[0].mensaje;
    expect(mensaje, 'un incumplimiento que no nombra la clave no sirve de nada').toContain(
      'APP_BASE_URL',
    );
    expect(mensaje, 'y tiene que decir qué pasa si no se arregla, no solo que está mal').toContain(
      'el build de Preview de toda PR fallará en `next build`',
    );
  });

  it('y también cuando la clave falta entera de la tabla', () => {
    // El otro modo de romperlo: no marcarla mal, sino no marcarla. Si solo se mirase el
    // valor de las filas presentes, una clave nueva del build entraría sin ruido.
    const sinFila = runbookDePrueba('Production').replace(/^\|\s*`APP_BASE_URL`.*$/m, '');
    const fallos = incumplimientos(workflow(), sinFila);
    expect(fallos.map((f) => f.clave)).toEqual(['APP_BASE_URL']);
    expect(fallos[0].mensaje).toContain('no aparece en la tabla');
  });

  it('con la misma cadena corregida a «Preview + Production», no devuelve ninguno', () => {
    // El sentido contrario, en el mismo bloque. Sin esto, el caso de arriba probaría que
    // la función devuelve algo, no que sepa distinguir.
    expect(incumplimientos(workflow(), runbookDePrueba('Preview + Production'))).toEqual([]);
  });

  it('y un runbook sin §0 no la deja en verde por vacío', () => {
    // Un localizador roto (§0 renombrada, tabla movida) dejaría el mapa vacío. La
    // implicación tiene que romperse, no ablandarse: sin declaración no hay promesa.
    const fallos = incumplimientos(workflow(), '# Runbook sin sección cero\n\nnada que ver\n');
    expect(fallos.map((f) => f.clave)).toEqual(clavesQueExigeElBuild(workflow()));
  });
});

// ---------------------------------------------------------------------------
// CA-9 / CA-10 — los dos centinelas de no-vacuidad
// ---------------------------------------------------------------------------

describe('SPEC-052 CA-9: el conjunto derivado del workflow no está vacío', () => {
  it('hay EXACTAMENTE un job de CI que ejecuta `npm run build`', () => {
    // Si el localizador se rompiera —o si mañana hubiera dos jobs construyendo con envs
    // distintos— el conjunto derivado dejaría de significar lo que dice. Dos es tan
    // informativo como cero: en ambos casos hay que volver a mirar.
    expect(
      jobsQueConstruyen(workflow()),
      'o el localizador por contenido dejó de casar, o el workflow cambió de forma',
    ).toHaveLength(1);
  });

  it('y sus claves no están vacías: están `APP_BASE_URL` y `DATABASE_URL`', () => {
    // Las dos que hoy se SABE que el build lee: `APP_BASE_URL` desde SPEC-051
    // (`metadataBase` en el layout raíz) y `DATABASE_URL` desde siempre (el cliente de
    // BD se instancia al importar, §3.2). Sin este caso, un `env` vacío dejaría CA-8 en
    // verde sin haber mirado nada — el modo de fallo exacto que ADR-031 documenta.
    const claves = clavesQueExigeElBuild(workflow());
    expect(claves.length).toBeGreaterThan(0);
    expect(claves).toContain('APP_BASE_URL');
    expect(claves).toContain('DATABASE_URL');
  });
});

describe('SPEC-052 CA-10: el parseo de la tabla de §0 no está vacío', () => {
  it('la tabla parseada tiene al menos once filas', () => {
    // Cota INFERIOR y no recuento exacto, a propósito: §0 crecerá, y congelar su
    // extensión sería fijar el estado del árbol en vez de una propiedad — lo que
    // `FOUNDATION.md` prohíbe desde el 2026-08-20. Once son las que §0 llevaba el día de
    // esta entrega; lo que se vigila es que el parser CASE, no cuántas hay.
    expect(entornosDeclarados(runbook()).length).toBeGreaterThanOrEqual(11);
  });

  it('y `APP_BASE_URL` y `MARKETSTACK_API_KEY` están, con su celda de entorno no vacía', () => {
    const porVariable = new Map(entornosDeclarados(runbook()).map((f) => [f.variable, f.entornos]));
    for (const clave of ['APP_BASE_URL', 'MARKETSTACK_API_KEY']) {
      expect(porVariable.has(clave), `${clave} no aparece en la tabla de §0`).toBe(true);
      expect(porVariable.get(clave), `${clave} tiene la celda de entorno vacía`).not.toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// CA-8 — el cruce, sobre el árbol real
// ---------------------------------------------------------------------------

describe('SPEC-052 CA-8: toda clave que el build exige está declarada como exigida en Preview', () => {
  it('el runbook y el workflow concuerdan', () => {
    const fallos = incumplimientos(workflow(), runbook());
    expect(fallos.map((f) => f.mensaje), fallos.map((f) => f.mensaje).join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// CA-4 — la columna, su vocabulario cerrado y el motivo escrito de las solo-Production
// ---------------------------------------------------------------------------

const seccionCero = () => {
  const s = seccionDeNivel2(runbook(), '0.');
  expect(s, 'no existe la sección §0 en docs/despliegue.md').not.toBeNull();
  return s!;
};

describe('SPEC-052 CA-4 (a): la tabla de §0 declara el entorno de cada clave', () => {
  it('todas las filas usan un valor del vocabulario CERRADO, sin celdas vacías', () => {
    const raros = entornosDeclarados(runbook()).filter(
      (f) => !(VOCABULARIO_ENTORNOS as readonly string[]).includes(f.entornos),
    );
    expect(
      raros.map((f) => `${f.variable} → «${f.entornos}»`),
      'ni celdas vacías, ni guiones, ni texto libre: la columna es datos, no prosa. ' +
        `Valores admitidos: ${VOCABULARIO_ENTORNOS.join(' · ')}`,
    ).toEqual([]);
  });
});

describe('SPEC-052 CA-4 (b): §0 escribe POR QUÉ hay claves solo en Production', () => {
  it('las cuatro claves de proveedor y correo están marcadas `Production`', () => {
    const porVariable = new Map(entornosDeclarados(runbook()).map((f) => [f.variable, f.entornos]));
    for (const clave of [
      'TWELVE_DATA_API_KEY',
      'RESEND_API_KEY',
      'RESEND_FROM',
      'CRON_SECRET',
    ]) {
      expect(porVariable.get(clave), `${clave} debería seguir marcada solo Production`).toBe(
        'Production',
      );
    }
  });

  it('y §0 dice que es deliberado, con el motivo y el precio aceptado', () => {
    // Sin esto la columna solo describiría el panel, y el primero que la lea concluirá
    // que Preview está mal configurada y «lo arreglará» — gastando cuota de proveedores y
    // habilitando correo real desde una rama, que es justo lo que la decisión evita. Una
    // asimetría con motivo escrito es una decisión; sin él es un descuido.
    const cuerpo = desnudo(seccionCero());
    expect(cuerpo, 'falta el motivo de la asimetría').toContain(
      'una preview no debe gastar cuota de proveedores externos ni poder mandar correo de verdad',
    );
    expect(cuerpo, 'falta la consecuencia declarada como precio aceptado').toContain(
      'el buscador de símbolos no busca, no sale ni un correo y el cron no se puede probar',
    );
    expect(cuerpo, 'falta decir que el precio se acepta, no que se sufre').toMatch(
      /precio aceptado/i,
    );
  });
});

// ---------------------------------------------------------------------------
// CA-1 / CA-2 / CA-3 / CA-17 — el párrafo de §0
// ---------------------------------------------------------------------------

/**
 * Las afirmaciones RETIRADAS de `docs/despliegue.md`, con su fecha y su motivo al lado.
 * Lista cerrada y versionada, mismo mecanismo que `tests/ayuda-afirmaciones-prohibidas.ts`
 * y `tests/spec043-formulas-prohibidas.ts`.
 *
 * No se comparan crudas: se comparan **desnudas** (sin énfasis ni comillas de código y con
 * los espacios planchados), porque una frase falsa no vuelve a ser cierta por escribirse
 * en cursiva ni por partirse en dos líneas al ajustar el margen.
 */
const AFIRMACIONES_RETIRADAS: ReadonlyArray<{ frase: string; fecha: string; motivo: string }> = [
  {
    frase: 'el error es en tiempo de **petición**, no de build',
    fecha: '2026-08-23',
    motivo:
      'Falsa desde SPEC-051: `metadataBase: new URL(appBaseUrl())` vive en el export ' +
      '`metadata` del layout raíz, que se evalúa AL CONSTRUIR. Volver a escribirla ' +
      'reabre el incidente del PR #58.',
  },
  {
    frase: 'así que el deploy sale verde igualmente',
    fecha: '2026-08-23',
    motivo:
      'La mitad más dañina: tiene forma de comprobación ya hecha y desactiva la del ' +
      'lector. El deploy no salió verde — no llegó a existir.',
  },
  {
    frase: 'no el valor de ejemplo de `.env.example` (`https://stockeiro.app`',
    fecha: '2026-08-24',
    motivo:
      'CA-17: `.env.example` deja de proponer ese dominio inventado, así que el ' +
      'desmentido se queda sin nadie a quien desmentir. Conservarlo sería dejar en §0 ' +
      'una advertencia sobre un valor que ya no existe.',
  },
];

describe('SPEC-052 CA-1: la frase falsa desaparece, y no puede volver por copia', () => {
  for (const { frase, fecha, motivo } of AFIRMACIONES_RETIRADAS) {
    it(`no vuelve a aparecer: «${frase}»`, () => {
      expect(
        desnudo(runbook()),
        `Retirada el ${fecha}. ${motivo}`,
      ).not.toContain(desnudo(frase));
    });
  }
});

/**
 * El aviso de `APP_BASE_URL` de §0: los bloques de cita de esa sección que lo nombran.
 * Se comprueba **donde tiene que estar** y no sobre el fichero entero, como en
 * `tests/runbook-limpieza-preview.test.ts`: un `toContain` global casaría igual con una
 * mención de pasada en otro apartado.
 */
function avisoDeAppBaseUrl(): string {
  const bloques: string[] = [];
  let actual: string[] = [];
  for (const linea of seccionCero().split('\n')) {
    if (linea.startsWith('>')) actual.push(linea.replace(/^>\s?/, ''));
    else if (actual.length) {
      bloques.push(actual.join('\n'));
      actual = [];
    }
  }
  if (actual.length) bloques.push(actual.join('\n'));
  const avisos = bloques.filter((b) => b.includes('APP_BASE_URL'));
  expect(avisos.length, 'no se encuentra ningún aviso de APP_BASE_URL en §0').toBeGreaterThan(0);
  return avisos.join('\n\n');
}

describe('SPEC-052 CA-2: lo que el aviso dice en su lugar', () => {
  it('(a) que `appBaseUrl()` se evalúa en tiempo de BUILD, y desde dónde', () => {
    const aviso = desnudo(avisoDeAppBaseUrl());
    expect(aviso).toContain('SPEC-051');
    expect(aviso).toContain('metadataBase: new URL(appBaseUrl())');
    expect(aviso).toContain('src/app/layout.tsx');
    expect(aviso).toMatch(/en tiempo de build/i);
  });

  it('(b) que sin la variable `next build` falla y el despliegue NO llega a existir', () => {
    // La distinción entera: no es un deploy verde con algo roto, es la ausencia de deploy.
    const aviso = desnudo(avisoDeAppBaseUrl());
    expect(aviso).toContain('next build');
    expect(aviso).toContain('el despliegue no llega a existir');
  });

  it('(c) que ocurrió el 2026-08-23 en el PR #58, con el error citado literalmente', () => {
    // El literal va entero para que sea RECONOCIBLE si vuelve a aparecer en un log.
    const aviso = desnudo(avisoDeAppBaseUrl());
    expect(aviso).toContain('2026-08-23');
    expect(aviso).toContain('PR #58');
    expect(aviso).toContain('Failed to collect configuration for /_not-found');
  });

  it('(d) y el origen REAL vigente es `stockeiro.tremen.dev`, no el alias de Vercel', () => {
    // Segunda afirmación falsa del mismo párrafo, encontrada al reverificar: decía «hoy
    // https://stockeiro-lemon.vercel.app» cuando §0 declara `stockeiro.tremen.dev` como
    // dominio principal desde el 2026-08-17, once líneas más arriba y en el mismo fichero.
    // El documento se contradecía dentro de su propia sección.
    const aviso = desnudo(avisoDeAppBaseUrl());
    expect(aviso).toContain('https://stockeiro.tremen.dev');
    expect(
      aviso,
      'el alias `stockeiro-lemon.vercel.app` no es el origen real desde el 2026-08-17',
    ).not.toContain('stockeiro-lemon.vercel.app');
  });
});

describe('SPEC-052 CA-3: el arreglo no tira lo que sí seguía siendo cierto', () => {
  it('sigue diciendo que falla ruidosamente si FALTA, pero no detecta que esté MAL', () => {
    // La salida fácil de un párrafo que miente es borrarlo entero. Aquí una parte era
    // verdad y sigue siendo útil: la única forma de detectar un origen equivocado es que
    // alguien pinche el enlace.
    const aviso = desnudo(avisoDeAppBaseUrl());
    expect(aviso).toContain('falla ruidosamente si la variable falta');
    expect(aviso).toMatch(/no puede detectar que esté mal/i);
    expect(aviso).toMatch(/solo lo ve (el usuario|quien) /i);
  });
});

describe('SPEC-052 CA-17: §0 retira el desmentido del valor de ejemplo', () => {
  it('el aviso ya no nombra el dominio inventado `stockeiro.app`', () => {
    expect(
      desnudo(avisoDeAppBaseUrl()),
      'CA-17 dejó a ese desmentido sin nadie a quien desmentir',
    ).not.toContain('stockeiro.app');
  });

  it('pero sigue exigiendo que la variable sea el origen REAL del despliegue', () => {
    // Es la parte que no dependía del ejemplo, y se conserva.
    expect(desnudo(avisoDeAppBaseUrl())).toMatch(/origen REAL del despliegue/i);
  });
});

// ---------------------------------------------------------------------------
// CA-7 — Preview deja de presentarse como opcional
// ---------------------------------------------------------------------------

const subseccion = (prefijo: string) => {
  const parte = runbook()
    .split(/^### /m)
    .find((p) => p.startsWith(prefijo));
  expect(parte, `no existe la subsección §${prefijo}`).toBeDefined();
  return parte!.split(/^## /m)[0];
};

const FRASES_QUE_HACIAN_PREVIEW_OPCIONAL = [
  'repite para Preview si quieres previews funcionales',
  'repite en Preview si lo usas',
];

describe('SPEC-052 CA-7: Preview deja de ser opcional para lo que el build exige', () => {
  for (const frase of FRASES_QUE_HACIAN_PREVIEW_OPCIONAL) {
    it(`ya no dice «${frase}»`, () => {
      expect(
        desnudo(runbook()),
        'una preview sin las claves del build no sale «a medias»: no llega a existir',
      ).not.toContain(desnudo(frase));
    });
  }

  it('y §3.2 distingue las obligatorias en Preview de las que solo la hacen más útil', () => {
    const cuerpo = desnudo(subseccion('3.2'));
    expect(cuerpo).toContain('Obligatorias en Preview porque el build las lee');
    expect(cuerpo).toContain('solo hacen la preview más útil');
  });
});

// ---------------------------------------------------------------------------
// CA-5 / CA-6 — §13 y el checklist de §5
// ---------------------------------------------------------------------------

const seccionOps = () => {
  const s = runbook()
    .split(/^## /m)
    .find((p) => /^13\./.test(p));
  expect(s, 'no existe la sección §13').toBeDefined();
  return s!;
};

const checklist = () => {
  const s = runbook()
    .split(/^## /m)
    .find((p) => /^5\./.test(p));
  expect(s, 'no existe la sección §5').toBeDefined();
  return s!;
};

describe('SPEC-052 CA-5: la foto del panel queda escrita, fechada y etiquetada como foto', () => {
  it('§13 lleva el inventario por entorno con el comando y la fecha que lo produjo', () => {
    const cuerpo = desnudo(seccionOps());
    expect(cuerpo, 'falta el comando que produjo la foto').toContain('vercel env ls');
    expect(cuerpo, 'falta la fecha de la medición').toContain('2026-08-23');
    for (const clave of [
      'RESEND_API_KEY',
      'RESEND_FROM',
      'CRON_SECRET',
      'TWELVE_DATA_API_KEY',
      'MARKETSTACK_API_KEY',
      'ALLOW_MIGRATE',
      'APP_BASE_URL',
    ]) {
      expect(cuerpo, `el inventario no menciona ${clave}`).toContain(clave);
    }
  });

  it('y dice EXPLÍCITAMENTE que es una foto fechada, no una fuente de verdad viva', () => {
    // Que los valores sigan siendo ciertos mañana no lo puede afirmar ningún test
    // (F-SPEC-052-1): el repositorio no puede leer el panel. Por eso la etiqueta de
    // «foto» es parte del criterio y no un adorno de redacción.
    const cuerpo = desnudo(seccionOps());
    expect(cuerpo).toMatch(/foto fechada/i);
    expect(cuerpo).toMatch(/no es una fuente de verdad viva/i);
  });
});

describe('SPEC-052 CA-6: el arreglo de ops consta como HECHO, no como pendiente', () => {
  it('§13 registra que `APP_BASE_URL` se añadió a Preview el 2026-08-23, y que el PR #58 pasó', () => {
    // Un runbook que pide hacer otra vez algo ya hecho gasta la atención que necesita
    // para lo que sí falta. Se calca del tratamiento de `ALLOW_MIGRATE=1` (§13.2), que es
    // su gemelo exacto: una clave que solo Preview necesita y cuya única prueba real es
    // una preview verde.
    const cuerpo = desnudo(seccionOps());
    expect(cuerpo).toContain('vercel env add APP_BASE_URL preview');
    expect(cuerpo).toContain('https://stockeiro.tremen.dev');
    expect(cuerpo).toContain('PR #58');
    expect(cuerpo).toMatch(/2026-08-23/);
  });

  it('y §5 gana su línea de checklist', () => {
    const linea = checklist()
      .split('\n')
      .find((l) => /^- \[/.test(l) && l.includes('APP_BASE_URL') && /Preview/.test(l));
    expect(linea, 'el checklist de §5 no tiene línea de `APP_BASE_URL` en Preview').toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CA-12 / CA-13 / CA-17 — `.env.example` deja de inducir el mismo error
// ---------------------------------------------------------------------------

/** La plantilla con los `#` de comentario fuera: lo que se lee es la prosa, no la marca. */
const plantillaLlana = () => desnudo(envExample().replace(/^#\s?/gm, ''));

describe('SPEC-052 CA-12: la plantilla admite que Vercel tiene más de un entorno', () => {
  it('ya no habla de UN solo entorno de producción', () => {
    expect(
      plantillaLlana(),
      'hablar de «producción (Vercel)» en singular es lo que hacía invisible a Preview',
    ).not.toContain(
      'En producción (Vercel), define estas claves en Settings → Environment Variables del proyecto',
    );
  });

  it('y declara los tres entornos, que no todas viven en todos, y quién manda', () => {
    const cuerpo = plantillaLlana();
    for (const entorno of ['Production', 'Preview', 'Development']) {
      expect(cuerpo, `la cabecera no nombra el entorno ${entorno}`).toContain(entorno);
    }
    expect(cuerpo).toMatch(/no todas .* viven en todos/i);
    expect(cuerpo, 'falta que las del BUILD tienen que estar también en Preview').toMatch(
      /también en Preview/i,
    );
    expect(cuerpo, 'falta remitir a §0 del runbook como fuente').toContain('docs/despliegue.md');
  });
});

describe('SPEC-052 CA-13: el comentario de `APP_BASE_URL` dice la consecuencia entera', () => {
  it('conserva la vieja: si falta o apunta mal, los enlaces no funcionan', () => {
    // Se AÑADE, no se sustituye: la consecuencia vieja no se ha ido, se le ha sumado otra
    // peor.
    // Insensible a la caja **solo** en la inicial: la frase abre oración en la plantilla y
    // la spec la cita en minúscula. Lo que se vigila es que el literal siga entero.
    expect(plantillaLlana()).toMatch(
      /si falta o apunta mal, los enlaces no funcionan en absoluto/i,
    );
  });

  it('y añade la nueva: desde SPEC-051 su ausencia rompe el `next build`', () => {
    const cuerpo = plantillaLlana();
    expect(cuerpo).toContain('SPEC-051');
    expect(cuerpo).toMatch(/rompe el next build/i);
  });
});

describe('SPEC-052 CA-17: el valor de ejemplo es el de desarrollo', () => {
  it('`APP_BASE_URL` vale `http://localhost:3000`', () => {
    // Un `.env.example` se copia a `.env` y se usa tal cual en local, así que sus valores
    // por defecto tienen que FUNCIONAR en local. Un valor de producción ahí es una trampa
    // que solo se desactiva leyendo un segundo documento — y la lección entera de esta
    // spec es que el segundo documento puede estar mintiendo (D-6).
    expect(envExample()).toMatch(/^APP_BASE_URL="http:\/\/localhost:3000"$/m);
  });

  it('y el dominio inventado `stockeiro.app` ya no es su valor', () => {
    expect(envExample()).not.toContain('APP_BASE_URL="https://stockeiro.app"');
  });

  it('pero `RESEND_FROM` conserva el suyo: el alcance de CA-17 es UNA clave', () => {
    // Alcance acotado a propósito y escrito para que nadie lo amplíe de paso: ese sí es un
    // ejemplo de FORMATO de remitente y ningún build lo lee. Cambiarlo es otra
    // conversación y no se cuela en esta.
    expect(envExample()).toMatch(/^RESEND_FROM="Stockeiro <avisos@stockeiro\.app>"$/m);
  });
});

// ---------------------------------------------------------------------------
// CA-14 — la conducta que causó el incidente se conserva A PROPÓSITO
// ---------------------------------------------------------------------------

describe('SPEC-052 CA-14: `appBaseUrl()` sigue lanzando si la clave falta', () => {
  it('lanza con el mensaje que remite a `.env.example`', () => {
    // NOTA DELIBERADA (CA-14). Que esto lance —y que por tanto un `next build` sin la
    // clave se caiga— es DISEÑO ARBITRADO de SPEC-051 (§Diseño D-4, riesgo R-2), aprobado
    // en su gate: una tarjeta de vista previa que en producción apunte a `localhost` es
    // peor que un build rojo. **SPEC-052 NO revisa esta conducta**: documenta y protege su
    // consecuencia, no la cambia. Las tres alternativas —no lanzar, caer a un valor por
    // defecto, leer `VERCEL_URL`— están rechazadas por escrito en SPEC-051 D-4. Revisarlo
    // es otra spec y otra conversación; si alguien llega aquí queriendo ablandarlo, para y
    // ábrela.
    const sinLaClave: NodeJS.ProcessEnv = { ...process.env };
    delete sinLaClave.APP_BASE_URL;
    expect(() => appBaseUrl(sinLaClave)).toThrow(/APP_BASE_URL no definida/);

    // Y una cadena de espacios cuenta como ausente: `.trim()` la vacía. Si no lanzara,
    // el build produciría `new URL('')` y el fallo llegaría más tarde y peor explicado.
    expect(() => appBaseUrl({ ...sinLaClave, APP_BASE_URL: '   ' })).toThrow(
      /APP_BASE_URL no definida/,
    );
  });

  it('y el caso lleva escrito al lado que es deliberado y que esta spec no lo revisa', () => {
    // Sin la nota, el próximo que vea un build rojo por esta causa leerá el caso como un
    // descuido pendiente de arreglar. La nota es la mitad del CA, no un comentario.
    //
    // Se lee la fuente de ESTE fichero, no un diff: es una propiedad del árbol y no toca
    // `git` (D-4). El caso al que acompaña es el de arriba, y el extractor lo localiza por
    // su título — mismo mecanismo que `casos()` en `tests/guardias-ancladas.test.ts`.
    const fuente = readFileSync(esteFichero, 'utf8');
    const patron =
      /^([ \t]+)it\('lanza con el mensaje que remite a `\.env\.example`',[\s\S]*?^\1\}\);$/m;
    const caso = patron.exec(fuente);
    expect(caso, 'no se encuentra el caso de CA-14 en este fichero').not.toBeNull();

    const cuerpo = desnudo(caso![0]);
    expect(cuerpo, 'falta decir de qué spec es el diseño').toContain('SPEC-051');
    expect(cuerpo, 'falta la decisión concreta que lo arbitró').toMatch(/D-4/);
    expect(cuerpo, 'falta decir que es deliberado').toMatch(/DISEÑO ARBITRADO|deliberad/i);
    expect(cuerpo, 'falta decir que SPEC-052 no lo revisa').toMatch(
      /SPEC-052 NO revisa esta conducta/i,
    );
  });
});
