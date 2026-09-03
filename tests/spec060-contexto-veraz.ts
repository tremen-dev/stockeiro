/**
 * SPEC-060 — **los detectores del contexto maestro, con sus especímenes**.
 *
 * Vive fuera del `.test.ts` por el mismo motivo que `tests/spec059-hora-del-ciclo.ts`,
 * `tests/ayuda-afirmaciones-prohibidas.ts` y `tests/revision-movil.ts`: la **medida** se
 * escribe una vez, en un módulo, y el test la **ejercita** —en los dos sentidos— antes
 * de aplicarla al árbol (ADR-026 pto. 2 y §7). Una guardia que no se puede poner roja no
 * es una guardia: es una casilla (FOUNDATION, 2.º corolario).
 *
 * Los especímenes **NO son elección del implementador**: están escritos en los CA de la
 * spec, y aquí se transcriben.
 *
 * ## Sujeto único: `docs/fundacion/contexto.md`
 *
 * **ADR-040 pto. 4**: el sujeto de una guardia de documento es **un** documento,
 * nombrado. No `docs/`, no `docs/fundacion/`, no `tests/`. Está medido y no es una
 * moraleja: un barrido de la hora vieja sobre `docs/fundacion/` pondría roja la entrada
 * *«Refresco bajo demanda»* de `dominio.md`, que la cita **en pasado** y que **SPEC-059
 * CA-10** protege expresamente; y uno sobre `tests/` acusaría a fixtures con `22:00` como
 * timestamp y a los **especímenes de la propia guardia**. Tres inocentes por tres
 * culpables — la aritmética de **ADR-037**.
 *
 * ## Las tres guardias son de Nivel 1 (ADR-040 pto. 1): derivan las dos mitades
 *
 * Ninguna teclea el valor vigilado. La versión sale de `package.json`, la existencia de
 * las citas sale del sistema de ficheros y el conjunto de `DB_DRIVER` sale de
 * `src/db/client.ts`. Lo que el test escribe son **especímenes**, nunca la verdad.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────────────
// CA-1 — la versión del framework se afirma sólo si se puede derivar
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * **El mapa de alias de prosa**, declarado y comentado (CA-1 lo exige con esas palabras).
 *
 * Un documento de orientación no escribe `next-auth`: escribe *Auth.js*, que es como se
 * llama el producto. La derivación necesita las dos mitades del puente, y esta tabla es
 * la única parte escrita a mano de CA-1 — está declarada como agujero en **ADR-040**
 * («una dependencia nombrada en prosa con un alias no previsto **no se vigila**»), no
 * descubierta después.
 *
 * La clave es lo que el documento escribe; el valor, el nombre del paquete en
 * `package.json`. Los majors **no viven aquí**: se leen de `package.json` en cada
 * ejecución.
 */
export const ALIAS_DE_PROSA: Readonly<Record<string, string>> = {
  'Next.js': 'next',
  React: 'react',
  'Auth.js': 'next-auth',
  NextAuth: 'next-auth',
  'Drizzle ORM': 'drizzle-orm',
  Drizzle: 'drizzle-orm',
  Vitest: 'vitest',
  Playwright: '@playwright/test',
  TypeScript: 'typescript',
  PGlite: '@electric-sql/pglite',
  Zod: 'zod',
};

/** Lo que `package.json` declara: nombre del paquete → *major*. */
export function majoresDeclarados(packageJsonRaw: string): Map<string, number> {
  const pkg = JSON.parse(packageJsonRaw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const majores = new Map<string, number>();
  for (const [nombre, rango] of Object.entries({
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  })) {
    // Un rango semver, con o sin operador: `^16.2.10`, `~0.45.2`, `>=5.0.0-beta.31`.
    // Lo que NO es un rango —`xlsx` se instala desde una URL de tarball— se queda fuera
    // en vez de inventarle un número: no hay major que derivar y se dice callando.
    const m = /^[\^~>=<\sv]*(\d+)\.\d+/.exec(rango);
    if (m) majores.set(nombre, Number(m[1]));
  }
  return majores;
}

/** Una versión que el documento le atribuye a una dependencia declarada. */
export type VersionAfirmada = {
  /** Como lo escribe el documento (`Next.js`). */
  alias: string;
  /** Como lo declara `package.json` (`next`). */
  paquete: string;
  /** El *major* que el documento afirma. */
  afirmado: number;
  /** El trozo literal del documento, para que el rojo diga dónde mirar. */
  cita: string;
};

function escaparRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Las versiones que `texto` le atribuye a las dependencias que `majores` declara.
 *
 * **Los nombres salen de `package.json`** (vía el mapa de alias) y **las versiones
 * también**: este módulo no conoce ningún número. Por eso un detector ingenuo de
 * *«nombre seguido de número»* —que acusaría a `ADR-020`, `D-7`, `RN-16`, `SPEC-023`,
 * `10.000/mes`, `30 min`, `~82%` y `2026-08-23`, **todos dentro del propio
 * `contexto.md`**— aquí no puede existir: el barrido arranca en un alias conocido, y
 * `ADR` no es ninguno.
 *
 * La comparación posterior es **por major**, que es lo que un documento de orientación
 * tiene sentido que afirme: `^16.2.10` satisface *«Next.js 16»* y ningún parche futuro
 * pone esto rojo.
 *
 * El alias y el número tienen que ir **en la misma línea** (`[ \t]+`, no `\s+`): un salto
 * de línea entre una palabra y un número no es una afirmación de versión, es maquetado.
 */
export function versionesAfirmadas(
  texto: string,
  majores: Map<string, number>,
): VersionAfirmada[] {
  const encontradas: VersionAfirmada[] = [];
  for (const [alias, paquete] of Object.entries(ALIAS_DE_PROSA)) {
    if (!majores.has(paquete)) continue;
    const rx = new RegExp(
      // `(?<![\w.-])` para que `React` no case dentro de `react-dom`; `\*{0,2}` y `v?`
      // porque el documento escribe **negritas** y *Auth.js v5*.
      String.raw`(?<![\w.-])${escaparRegExp(alias)}[ \t]+\*{0,2}v?(\d+)(?:\.\d+)*`,
      'g',
    );
    for (const m of texto.matchAll(rx)) {
      encontradas.push({ alias, paquete, afirmado: Number(m[1]), cita: m[0] });
    }
  }
  return encontradas;
}

/** Una afirmación de versión que no coincide con lo declarado. Conjunto esperado: vacío. */
export type DesajusteDeVersion = VersionAfirmada & { declarado: number };

/** Las versiones del documento que **difieren** de `package.json`. Vacío = el documento dice la verdad. */
export function desajustesDeVersion(
  texto: string,
  packageJsonRaw: string,
): DesajusteDeVersion[] {
  const majores = majoresDeclarados(packageJsonRaw);
  return versionesAfirmadas(texto, majores)
    .map((v) => ({ ...v, declarado: majores.get(v.paquete)! }))
    .filter((v) => v.afirmado !== v.declarado);
}

/**
 * Lo que CA-1 **debe cazar**: las tres versiones que el documento tenía o pudo tener.
 * `Next.js 15` es literalmente la línea 26 de hoy.
 */
export const VERSIONES_QUE_HAY_QUE_CAZAR: readonly string[] = [
  'Next.js 15 App Router (React 19) sobre Vercel',
  'La sesión la lleva React 18 en el cliente',
  'Auth.js v4 con split-config',
];

/**
 * Lo que CA-1 **no debe cazar**. Las tres primeras son las versiones buenas; `Drizzle ORM`
 * nombra un paquete **sin número** y no afirma nada. Las demás son **texto real del
 * documento vigilado**, y son la parte que hay que probar de verdad: es exactamente lo
 * que un detector de «nombre + número» escrito en bruto acusaría, y lo que ya pisó a
 * SPEC-059.
 */
export const VERSIONES_LEGITIMAS: readonly string[] = [
  'Next.js 16 App Router (React 19) sobre Vercel',
  'Auth.js v5 (NextAuth beta) con split-config',
  'Drizzle ORM (`src/db/schema.ts`, `drizzle.config.ts`)',
  'D-7 supersedida por ADR-020 el 2026-08-18',
  'RN-16 y RN-17 gobiernan el refresco; SPEC-023 cerró la recuperación',
  'plan de pago Basic (10.000/mes), margen ~82% del presupuesto',
  'caducidad 30 min, tres solicitudes por hora',
];

// ─────────────────────────────────────────────────────────────────────────────────────
// CA-2 — toda cita del documento apunta a algo que existe
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Los `code spans` del markdown. Las rutas se citan siempre así en este documento, y
 * limitar el barrido a los backticks es lo que impide que `P/L` o `símbolos × ciclos`
 * entren como candidatos a fichero.
 */
function spansEntreBackticks(markdown: string): string[] {
  return [...markdown.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

/** Extensiones que la **raíz** de este repositorio usa para ficheros citables. */
const EXTENSIONES_DE_RAIZ = /\.(?:json|md|ts|mjs|yml|yaml|example)$/;

/** La forma de una ruta: segmentos separados por `/`, con los corchetes de las rutas dinámicas. */
const FORMA_DE_RUTA = /^[A-Za-z0-9_@.()[\]-]+(?:\/[A-Za-z0-9_@.()[\]-]+)*\/?$/;

/**
 * Las **rutas del repositorio** que cita el documento.
 *
 * CA-2 exige que se escriban **enteras desde la raíz** (`src/app/api/auth/[...nextauth]/route.ts`,
 * no `api/auth/[...nextauth]/route.ts`); es requisito de contenido, y es también lo que
 * hace posible comprobarlas. Un span sin `/` sólo se toma por fichero de la raíz si
 * empieza por punto (`.env.example`) o si su extensión es de las que la raíz usa
 * (`package.json`, `vercel.json`). **`.js` queda fuera a propósito**: `decimal.js` es el
 * nombre de un paquete npm que el documento cita, no un fichero de este árbol, y una
 * guardia que lo acusara sería la que acaba aflojada.
 *
 * **Los comodines se saltan a propósito**: `tests/*.test.ts` describe una familia, no un
 * fichero.
 */
export function rutasCitadas(markdown: string): string[] {
  return spansEntreBackticks(markdown).filter((span) => {
    if (span.includes('*')) return false;
    if (!FORMA_DE_RUTA.test(span)) return false;
    return span.includes('/') || span.startsWith('.') || EXTENSIONES_DE_RAIZ.test(span);
  });
}

/**
 * Los identificadores `ADR-nnn` / `SPEC-nnn` / `EPIC-nnn` que cita el documento.
 *
 * `(?<![\w-])` y `(?![\w-])` dejan fuera a `F-SPEC-023-1`, que es un identificador de
 * **salvedad** y no un fichero; y `RN-16`, `RI-03`, `D-2` y `CE-1` no entran siquiera en
 * el barrido, porque son reglas y decisiones, no documentos.
 */
export function identificadoresCitados(markdown: string): string[] {
  return [...markdown.matchAll(/(?<![\w-])(ADR|SPEC|EPIC)-(\d{3})(?![\w-])/g)].map((m) => m[0]);
}

/** El índice de lo que existe bajo `docs/`, derivado del árbol en cada ejecución. */
function documentosPresentes(raiz: string): Set<string> {
  const presentes = new Set<string>();
  const adrDir = join(raiz, 'docs', 'adr');
  if (existsSync(adrDir)) {
    for (const f of readdirSync(adrDir)) {
      const m = /^(ADR-\d{3})/.exec(f);
      if (m) presentes.add(m[1]);
    }
  }
  const epicasDir = join(raiz, 'docs', 'epicas');
  if (existsSync(epicasDir)) {
    // `withFileTypes` porque `docs/epicas/` no sólo tiene directorios: lleva un
    // `.gitkeep` desde el primer commit, y un `readdirSync` sobre él revienta.
    for (const entrada of readdirSync(epicasDir, { withFileTypes: true })) {
      if (!entrada.isDirectory()) continue;
      const m = /^(EPIC-\d{3})/.exec(entrada.name);
      if (m) presentes.add(m[1]);
      for (const f of readdirSync(join(epicasDir, entrada.name))) {
        const s = /^(SPEC-\d{3})/.exec(f);
        if (s) presentes.add(s[1]);
      }
    }
  }
  return presentes;
}

/**
 * **CA-2** — las citas del documento que **no corresponden a nada presente en el árbol**.
 *
 * Conjunto esperado **vacío**: la forma que FOUNDATION (3.er corolario) declara
 * superviviente al crecimiento del árbol, y la que hace que esto no caduque cuando el
 * documento crezca. Un directorio cuenta como existente.
 */
export function citasRotas(markdown: string, raiz: string): string[] {
  const presentes = documentosPresentes(raiz);
  const rutas = rutasCitadas(markdown).filter(
    (ruta) => !existsSync(join(raiz, ruta.replace(/\/$/, ''))),
  );
  const ids = identificadoresCitados(markdown).filter((id) => !presentes.has(id));
  return [...new Set([...rutas, ...ids])];
}

/**
 * Lo que CA-2 **debe cazar**: la cita muerta de hoy (`src/middleware.ts`, que Next 16
 * renombró a `src/proxy.ts`) y un identificador con forma válida que **nunca existió**.
 */
export const CITAS_QUE_HAY_QUE_CAZAR: readonly string[] = [
  'edge-safe para `src/middleware.ts`, que Next 16 renombró',
  'la decisión vive en ADR-013, con su porqué',
];

/**
 * Lo que CA-2 **no debe cazar**: ficheros y directorios que existen, identificadores que
 * existen, los patrones con comodín —que describen una familia— y los identificadores de
 * regla o de salvedad, que no son ficheros y no entran en el barrido.
 */
export const CITAS_LEGITIMAS: readonly string[] = [
  '`src/proxy.ts` y `src/db/client.ts` son los dos ficheros',
  'el design system vive en `design/tremen-ds`',
  'las claves las declara `.env.example`; el estado, `docs/tablero.md`',
  'ADR-039 fijó la hora, SPEC-059 la movió y EPIC-008 la observó',
  'los unitarios son `tests/*.test.ts` y los e2e `tests/e2e/*.spec.ts`',
  'RN-16, RI-03, D-2, CE-1 y F-SPEC-023-1 no son ficheros',
  'el P/L se calcula con `decimal.js`, que es un paquete y no una ruta',
];

// ─────────────────────────────────────────────────────────────────────────────────────
// CA-3 — `DB_DRIVER`: el documento nombra los valores que el código reconoce
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * **La mitad del código**: los valores de `DB_DRIVER` que `src/db/client.ts` reconoce,
 * leídos del **único sitio del módulo donde viven** (CA-14 pto. 4 lo exige, y de ese
 * mismo sitio salen la decisión y el texto del mensaje de error: **ADR-040** pto. 1
 * aplicado al propio arreglo).
 *
 * La propiedad es *«los valores que el módulo reconoce»*, **no una forma sintáctica
 * concreta**: si mañana el módulo los declara de otra manera, este extractor se
 * re-encuadra. Lo que **no** se admite es escribirlos en el test.
 *
 * Devuelve **`null`** —y nunca `[]`— cuando no hay nada que leer: es el **centinela de
 * extracción no vacía**. Sin él, un módulo reescrito dejaría el caso comparando dos
 * vacíos, que es verde sin haber mirado nada.
 */
export function driversDelCodigo(fuente: string): string[] | null {
  const declaracion = /DRIVERS_RECONOCIDOS[^=]*=\s*\[([^\]]*)\]/.exec(fuente);
  if (!declaracion) return null;
  const valores = [...declaracion[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
  return valores.length > 0 ? valores : null;
}

/**
 * **La mitad del documento**: los valores que `contexto.md` le atribuye a `DB_DRIVER`,
 * extraídos de su texto en la forma en que se le dice al lector que los escriba
 * (`DB_DRIVER=pg`), que es la única que le sirve para copiarla a su `.env`.
 *
 * Mismo centinela: `null` cuando el documento no atribuye ninguno.
 */
export function driversDelDocumento(markdown: string): string[] | null {
  const valores = [...markdown.matchAll(/DB_DRIVER=([A-Za-z0-9_.-]+)/g)].map((m) => m[1]);
  return valores.length > 0 ? [...new Set(valores)] : null;
}

/**
 * Módulos sintéticos para ejercitar el extractor del código **antes** de aplicarlo al
 * árbol. El segundo es el que prueba lo que de verdad importa: el extractor **sigue al
 * código y no a esta spec**, así que un driver nuevo no lo deja mintiendo.
 */
export const MODULO_CON_DOS_DRIVERS = `
export const DRIVERS_RECONOCIDOS = ['neon', 'pg'] as const;
`;
export const MODULO_CON_TRES_DRIVERS = `
export const DRIVERS_RECONOCIDOS = ['neon', 'pg', 'postgres-js'] as const;
`;
export const MODULO_SIN_DRIVERS = `
const driver = process.env.DB_DRIVER ?? 'neon';
`;

/**
 * El documento **de ayer**, en la forma que el detector lee: los dos nombres que
 * `src/db/client.ts` nunca ha reconocido y que llevaban en la línea 39 desde el
 * 2026-08-23. Es la mitad roja del par completo que pide CA-3.
 */
export const DOCUMENTO_DE_AYER =
  'Cliente de datos INTERCAMBIABLE por `DB_DRIVER` (`src/db/client.ts`): ' +
  '`DB_DRIVER=neon-http` (Neon serverless) en prod / `DB_DRIVER=postgres-js` en local y e2e.';
