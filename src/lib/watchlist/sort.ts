import type { ZoneState } from './zone-status';

/**
 * SPEC-041 — **el orden de la tabla de acciones vigiladas, como función pura**.
 *
 * ## Por qué esto vive aquí y no en SQL
 *
 * Porque el **estado de zona no es una columna de la base**: se deriva comparando el
 * precio con las zonas mediante `entraEnZona` (RN-11, semántica decimal). Ordenar por
 * estado en SQL obligaría a **reimplementar RN-11 en SQL**, o sea a tener dos
 * definiciones de la regla que más importa del producto, condenadas a divergir. Esa
 * sola razón decide (SPEC-041, §Notas pto. 2).
 *
 * El resto son consecuencias baratas: listas de decenas de filas, ningún viaje al
 * servidor por clic y ningún parámetro de orden en la URL —que sería media
 * persistencia, y la épica la excluye—.
 *
 * ## Lo que este módulo NO hace
 *
 * No calcula el `state` ni toca las zonas: llega dado desde el servidor
 * (`zoneStatusForUser`). Ordenar es **presentación** (CE-M1 de EPIC-MEJORA): no cambia
 * ni un dato, ni un cálculo, ni una regla.
 */

/** Criterio de orden elegible por el usuario (CA-6/CA-7/CA-8). */
export type ClaveOrden = 'ticker' | 'name' | 'state';

export type DireccionOrden = 'asc' | 'desc';

/**
 * Los tres criterios, con el rótulo que se lee en pantalla. «Ticker» va **primero** y
 * es el orden por defecto (CA-6): ofrecerlo con nombre es también la forma de volver a
 * él, en vez de esconderlo en el tercer clic de un ciclo de estados (§Notas pto. 4).
 */
export const CRITERIOS_ORDEN: readonly { clave: ClaveOrden; etiqueta: string }[] = [
  { clave: 'ticker', etiqueta: 'Ticker' },
  { clave: 'name', etiqueta: 'Nombre' },
  { clave: 'state', etiqueta: 'Estado' },
] as const;

/**
 * Prioridad de producto al ordenar por estado (CA-8), **ratificada en el gate del
 * 2026-08-20** y leída como *«lo que reclama tu atención, primero»*: `both` es la señal
 * más fuerte, luego lo accionable, `out` es «todo en orden» y `none` es «no puedo
 * decirte nada».
 *
 * NO es el orden alfabético de las etiquetas, y no debe serlo: «En compra y venta» iría
 * antes que «En zona de compra» por casualidad tipográfica, no por significado.
 */
export const PRIORIDAD_ESTADO: Record<ZoneState, number> = {
  both: 0,
  buy: 1,
  sell: 2,
  out: 3,
  none: 4,
};

/** Lo mínimo que el comparador necesita mirar de una fila. */
export interface FilaOrdenable {
  id: string;
  ticker: string;
  name: string | null;
  state: ZoneState;
  /** SPEC-016: motivo por el que el símbolo no se puede cotizar; null = nunca falló. */
  failReason: string | null;
}

/**
 * La clave de texto de una fila: **su nombre, o su ticker si no tiene nombre** (CA-7).
 *
 * Esto es lo que evita el «bloque mudo»: sin nombre no se manda la fila al final ni se
 * le inventa uno —eso sería mentir, CA-3—, se la ordena por lo único que sí se sabe de
 * ella. Una cadena en blanco tampoco es un nombre.
 */
export function claveDeNombre(fila: Pick<FilaOrdenable, 'ticker' | 'name'>): string {
  const n = (fila.name ?? '').trim();
  return n === '' ? fila.ticker : n;
}

/**
 * Comparación de textos en **español**, insensible a mayúsculas y a acentos (CA-7):
 * «Acerinox» < «BBVA» < «iberdrola» < «Índice X». Con `sensitivity: 'base'`, «Índice» e
 * «indice» comparan igual — y por eso el desempate de CA-9 llega hasta el `id`.
 */
const colador = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/**
 * Dentro de `none`, primero las que tienen **motivo de fallo** (SPEC-016) y después las
 * de «aún sin datos» (CA-8): un símbolo que no se puede cotizar **pide una acción del
 * usuario**; uno que espera al ciclo diario, no.
 */
const estorbo = (fila: FilaOrdenable): number => (fila.state === 'none' && fila.failReason ? 0 : 1);

function compararPrimario(a: FilaOrdenable, b: FilaOrdenable, clave: ClaveOrden): number {
  if (clave === 'ticker') return colador.compare(a.ticker, b.ticker);
  if (clave === 'name') return colador.compare(claveDeNombre(a), claveDeNombre(b));
  const porEstado = PRIORIDAD_ESTADO[a.state] - PRIORIDAD_ESTADO[b.state];
  if (porEstado !== 0) return porEstado;
  return estorbo(a) - estorbo(b);
}

/**
 * El comparador (CA-9). **Función pura**: mismos argumentos, mismo resultado, sin leer
 * nada de fuera.
 *
 * Dos reglas que conviven y conviene no confundir:
 *
 *  - **La dirección invierte el criterio primario.** Con una fila por estado —el
 *    escenario de CA-8— eso hace que descendente sea exactamente la lista ascendente
 *    del revés, que es lo que el CA afirma.
 *  - **El desempate es SIEMPRE ascendente** por la clave de CA-7 (nombre, o ticker), y
 *    después por ticker y por `id`. Es lo que CA-9 pide «en cualquier dirección», y lo
 *    que hace que dos filas del mismo estado **no bailen** entre dos ejecuciones. El
 *    `id` al final garantiza un orden **total**: sin él, dos vigiladas del mismo ticker
 *    en dos mercados (ADR-007) empatarían hasta el final y quedarían al albur de la
 *    estabilidad del `sort` del motor.
 */
export function compararVigiladas(
  clave: ClaveOrden,
  direccion: DireccionOrden,
): (a: FilaOrdenable, b: FilaOrdenable) => number {
  const signo = direccion === 'desc' ? -1 : 1;
  return (a, b) => {
    const primario = compararPrimario(a, b, clave);
    if (primario !== 0) return signo * primario;

    const porNombre = colador.compare(claveDeNombre(a), claveDeNombre(b));
    if (porNombre !== 0) return porNombre;
    const porTicker = colador.compare(a.ticker, b.ticker);
    if (porTicker !== 0) return porTicker;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

/** Ordena una copia: la lista que llega del servidor **no se muta** (CA-9). */
export function ordenarVigiladas<T extends FilaOrdenable>(
  filas: readonly T[],
  clave: ClaveOrden,
  direccion: DireccionOrden,
): T[] {
  return [...filas].sort(compararVigiladas(clave, direccion));
}
