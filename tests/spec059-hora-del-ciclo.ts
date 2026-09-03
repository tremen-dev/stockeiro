/**
 * SPEC-059 — **los detectores de la hora del ciclo, con sus especímenes**.
 *
 * Vive fuera del `.test.ts` por el mismo motivo que
 * `tests/ayuda-afirmaciones-prohibidas.ts` y `tests/revision-movil.ts`: la **medida**
 * se escribe una vez, en un módulo, y el test la **ejercita** antes de aplicarla al
 * árbol (ADR-026 pto. 2). Y porque una guardia que no se puede poner roja no es una
 * guardia: es una casilla (FOUNDATION, 2.º corolario), así que los especímenes de los
 * **dos sentidos** viajan con el detector, no en la cabeza de quien lo escribió.
 *
 * Los especímenes NO son elección del implementador: están escritos en los CA de la
 * spec, y aquí se transcriben.
 */

/** Un campo cron que denota **todos** los valores. */
const TODOS_LOS_VALORES = /^\*$/;

/** Un campo cron que denota **un solo** valor: un entero pelado y nada más. */
const UN_SOLO_VALOR = /^\d{1,2}$/;

/**
 * **CA-2** — ¿esa expresión declara **exactamente una ejecución al día a hora fija**?
 *
 * Es lo que ADR-004 pto. 1 llama *«1×/día a hora fija UTC»* y lo que la premisa de
 * **RN-16** necesita (un ciclo al día, sin saltos: `tests/spec043-sin-refrescar.test.ts`
 * vigila los tres campos de calendario, y lo sigue haciendo sin tocarse).
 *
 * La propiedad se enuncia **sobre la forma de los campos y no sobre la hora**, a
 * propósito: **ADR-039 pto. 4** deja pactado mover la hora a ≥ 11:05 UTC **sin ADR
 * nuevo** si CA-8 sale mal, y ese segundo movimiento no debería poner esto rojo.
 *
 *  - día-del-mes, mes y día-de-semana denotan **todos los valores** (`*`);
 *  - minuto y hora denotan **un solo valor cada uno** — un entero, dentro de su rango.
 *
 * Cualquier lista (`0,30`), rango (`0-30`), paso (`* / 6`) o comodín en minuto u hora
 * denota **más de un momento del día**, que es una cadencia distinta disfrazada de la
 * declarada. Y un campo fuera de rango no denota nada: no se le da por bueno.
 */
export function declaraUnaEjecucionDiariaAHoraFija(schedule: string): boolean {
  const campos = schedule.trim().split(/\s+/);
  if (campos.length !== 5) return false;

  const [minuto, hora, diaDelMes, mes, diaSemana] = campos;

  if (![diaDelMes, mes, diaSemana].every((c) => TODOS_LOS_VALORES.test(c))) return false;
  if (!UN_SOLO_VALOR.test(minuto) || !UN_SOLO_VALOR.test(hora)) return false;

  return Number(minuto) <= 59 && Number(hora) <= 23;
}

/**
 * Lo que el detector de CA-2 **debe cazar**. Especímenes escritos en el CA: dos
 * ejecuciones diarias disfrazadas de una.
 */
export const CADENCIAS_QUE_HAY_QUE_CAZAR: readonly string[] = ['0,30 6 * * *', '0 */6 * * *'];

/**
 * Lo que el detector de CA-2 **no debe cazar**: horas fijas legítimas y **distintas
 * entre sí**. La segunda es el destino pactado de ADR-039 pto. 4.
 */
export const CADENCIAS_LEGITIMAS: readonly string[] = ['0 6 * * *', '30 11 * * *'];

/**
 * **CA-4** — el `crons` que **documenta** `docs/despliegue.md` §3.3, sacado del bloque
 * JSON que la sección enseña.
 *
 * Se **deriva**, no se teclea: es la mitad del par que el test compara contra el
 * `crons` de `vercel.json`, y ninguna de las dos mitades lleva la hora escrita en el
 * test. Así el día que **ADR-039 pto. 4** obligue a mover la hora, esto sigue verde
 * tocando un fichero — y rojo si alguien se olvida del runbook, que es justo lo que
 * había pasado.
 *
 * Devuelve **`null`** —y nunca `[]`— cuando la sección no está, el bloque no está, no
 * parsea o viene vacío. Es el **centinela de extracción no vacía**: sin él, un
 * documento reescrito dejaría el caso comparando dos vacíos, que es verde sin haber
 * mirado nada.
 */
export function cronsDelRunbook(markdown: string): { path: string; schedule: string }[] | null {
  const seccion = markdown
    .split(/^### /m)
    .slice(1)
    .find((parte) => parte.startsWith('3.3'));
  if (!seccion) return null;

  const bloque = /```json\s*\n([\s\S]*?)```/.exec(seccion);
  if (!bloque) return null;

  let contenido: unknown;
  try {
    contenido = JSON.parse(bloque[1]);
  } catch {
    return null;
  }

  const crons = (contenido as { crons?: unknown }).crons;
  if (!Array.isArray(crons) || crons.length === 0) return null;
  return crons as { path: string; schedule: string }[];
}

/** Un campo de una expresión cron: comodín, paso, lista, rango o valor. */
const CAMPO_CRON = String.raw`(?:\*(?:\/\d{1,2})?|\d{1,2}(?:[-,]\d{1,2})*(?:\/\d{1,2})?)`;

/** Los cinco campos, con su rango: minuto, hora, día del mes, mes y día de semana. */
const RANGOS: readonly [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];

/** ¿Ese campo denota algo que el reloj de cron pueda leer, y dentro de su rango? */
function campoValido(campo: string, [min, max]: [number, number]): boolean {
  const [base, paso, ...sobra] = campo.split('/');
  if (sobra.length > 0) return false;
  if (paso !== undefined && !/^\d{1,2}$/.test(paso)) return false;
  if (base === '*') return true;
  return base
    .split(',')
    .every((trozo) =>
      trozo
        .split('-')
        .every((n) => /^\d{1,2}$/.test(n) && Number(n) >= min && Number(n) <= max),
    );
}

/**
 * **CA-5** — las **copias del `schedule`** que hay en un texto.
 *
 * Lo que se prohíbe es la **segunda copia**, **no una hora concreta**: el detector
 * reconoce la **forma** —cinco campos cron seguidos— y le da exactamente igual si dice
 * la hora vieja o la nueva. Enunciarlo sobre la hora sería volver a escribirla, que es
 * el defecto que **ADR-039 pto. 8** cierra: `vercel.json` es el único sitio donde vive
 * el valor, y todo lo demás **nombra al fichero que lo posee**.
 *
 * Aplica a **prosa y comentarios**, no a las guardias que congelan el `vercel.json`
 * entero: ésas llevan el literal por obligación de CA-3, porque derivarlo del propio
 * fichero las dejaría verdes de vacío.
 *
 * **Cinco campos seguidos no bastan**, y esto no es teoría: el propio módulo escribe
 * `UMBRAL_SIN_REFRESCAR_HORAS * 60 * 60 * 1000`, que en bruto casa la forma. Una guardia
 * que lo acusara sería la que acaba aflojada, así que el candidato tiene que ser además
 * una expresión que el reloj de cron pueda leer: `60` no es una hora y ahí se cae.
 */
export function copiasDelSchedule(texto: string): string[] {
  const rx = new RegExp(
    String.raw`(?<![\w*/-])${CAMPO_CRON}(?:\s+${CAMPO_CRON}){4}(?![\w*/-])`,
    'g',
  );
  return [...texto.matchAll(rx)]
    .map((m) => m[0])
    .filter((candidato) =>
      candidato.split(/\s+/).every((campo, i) => campoValido(campo, RANGOS[i])),
    );
}

/**
 * Lo que el detector de CA-5 **debe cazar**: la copia reintroducida, con la hora vieja
 * y con la nueva. Son la frase que el módulo llevaba, y la misma «actualizada» — que es
 * exactamente la reparación que hay que impedir.
 */
export const COPIAS_QUE_HAY_QUE_CAZAR: readonly string[] = [
  ' * (ADR-004 pto. 1; el cron de `vercel.json` es `0 22 * * *`, todos los días).',
  ' * (ADR-004 pto. 1; el cron de `vercel.json` es `0 6 * * *`, todos los días).',
];

/**
 * Lo que el detector de CA-5 **no debe cazar**: nombrar al dueño del valor sin
 * teclearlo. Es exactamente lo que la corrección deja escrito, así que si un patrón
 * nuevo rompe una de estas, el patrón está mal.
 */
export const MENCIONES_LEGITIMAS: readonly string[] = [
  ' * (ADR-004 pto. 1; la cadencia y su hora las declara `vercel.json`, en `crons`).',
  ' * El cron de `vercel.json` corre todos los días; su hora vive allí y solo allí.',
  // Éste no es hipotético: lo escribe el propio módulo vigilado, y una guardia que lo
  // acusara sería la que acaba aflojada. Es la aritmética del umbral, no un schedule.
  'export const UMBRAL_SIN_REFRESCAR_MS = UMBRAL_SIN_REFRESCAR_HORAS * 60 * 60 * 1000;',
];
