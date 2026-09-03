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
