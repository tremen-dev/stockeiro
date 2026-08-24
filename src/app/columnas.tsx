import type { ReactNode } from 'react';

/**
 * SPEC-054 / ADR-034 §3 — **la descripción de columnas: una sola fuente para las dos
 * formas**.
 *
 * ## Por qué existe este fichero
 *
 * Por debajo de 720 px una tabla de datos se presenta como **tarjetas**, y por encima
 * como **tabla**. ADR-034 §3 elige montar las dos representaciones a la vez y alternarlas
 * con `display: none`, y dice por qué: cada forma usa el marcado nativamente correcto
 * para lo que es, no hay parpadeo, no hay desajuste de hidratación y `display: none`
 * retira **de verdad** del árbol de accesibilidad, así que en cada ancho hay **una**
 * representación y no dos.
 *
 * **El coste de esa decisión es el riesgo de que las dos se separen** —alguien añade una
 * columna a la tabla y se olvida de la tarjeta— y por eso el ADR no se conforma con «dos
 * árboles»: exige **dos árboles derivados de una sola descripción de las columnas**. Esto
 * es esa descripción. Añadir una columna a la tabla sin añadirla a la tarjeta deja de ser
 * posible **por construcción**, y SPEC-054 CA-6 lo comprueba además por su efecto: todo
 * dato visible en una fila lo es en su tarjeta, y con el mismo rótulo.
 *
 * ## Lo que NO se generaliza (ADR-034, alternativas)
 *
 * Esto **no** es un componente genérico de tabla responsive, y se rechazó serlo. Hay dos
 * tablas en el producto y son muy distintas: nueve columnas con estado de zona, avisos de
 * diagnóstico y dos acciones por fila una, cinco columnas numéricas la otra. Generalizar
 * sobre dos casos produce una abstracción que encaja mal en los dos y cara de cambiar.
 * Lo que sí se comparte desde el primer día es **la forma de describir columnas** (esto)
 * y **la medida** (M5, en `tests/e2e/geometria.ts`). A la tercera tabla, se revisa.
 */

/**
 * Dónde cae una columna cuando la fila se presenta como tarjeta.
 *
 * Los tres sitios que no son `par` son los que el boceto aprobado **promociona** fuera de
 * la lista de pares: la identidad sube a la cabecera, el estado se convierte en el fondo
 * de la tarjeta más su etiqueta, y las acciones bajan al pie.
 */
export type SitioEnLaTarjeta = 'cabecera' | 'estado' | 'par' | 'acciones';

/**
 * Qué representación se está pintando.
 *
 * Lo reciben las funciones de valor para **una sola cosa**: derivar los `data-testid`.
 * El texto, las clases y la estructura del valor son idénticos en las dos formas —ése es
 * el punto entero de esta descripción—, pero un `data-testid` repetido en los dos árboles
 * rompería por duplicado el recuento de las guardias que ya existen (`page.getByTestId(
 * 'sin-refrescar')` cuenta a nivel de página). Así que la identidad de las asas de prueba
 * se distingue, y sólo ella.
 */
export type Forma = 'tabla' | 'tarjeta';

/** El `data-testid` de un elemento en la forma que se está pintando. */
export const asa = (base: string, forma: Forma): string =>
  forma === 'tabla' ? base : `${base}-tarjeta`;

/** El sufijo que llevan las asas de prueba del árbol de tarjetas. */
export const SUFIJO_TARJETA = '-tarjeta';

export interface Columna<F> {
  /** Identificador estable de la columna. No se enseña. */
  clave: string;
  /**
   * El texto del `<th>` **y** del `<dt>`. Es literalmente el mismo (ADR-034 §4: «los
   * `<th>` se convierten en los `<dt>` de cada tarjeta, con el mismo texto»), y por eso
   * se declara una vez. Cadena vacía = columna sin rótulo visible.
   */
  rotulo: string;
  /** Nombre accesible del `<th>` cuando no hay rótulo visible (la de acciones). */
  ariaLabel?: string;
  sitio: SitioEnLaTarjeta;
  /**
   * El orden del par dentro de la tarjeta, que es **el del boceto que aprobó el humano**
   * y no tiene por qué ser el de la tabla (SPEC-054 CA-9). Se declara aquí para que las
   * dos secuencias salgan del mismo sitio: la de la tabla es el orden del array, la de la
   * tarjeta es éste.
   */
  ordenEnLaTarjeta?: number;
  /** El valor de la celda. **Idéntico en las dos formas**: es lo que impide la deriva. */
  valor: (fila: F, forma: Forma) => ReactNode;
  /** Clases del `<td>`. No viajan a la tarjeta: allí el valor vive en un `<dd>`. */
  claseCelda?: string;
  /** Clases del `<th>`. */
  claseCabecera?: string;
  /** `aria-sort` del `<th>`. Es de una tabla y **desaparece con ella** (ADR-034 §4). */
  ariaSort?: 'ascending' | 'descending' | 'none';
}

/** Las columnas que se convierten en pares `<dt>`/`<dd>`, en el orden del boceto. */
export const paresDeLaTarjeta = <F,>(columnas: readonly Columna<F>[]): Columna<F>[] =>
  columnas
    .filter((c) => c.sitio === 'par')
    .sort((a, b) => (a.ordenEnLaTarjeta ?? 0) - (b.ordenEnLaTarjeta ?? 0));

/** La única columna que ocupa un sitio dado en la tarjeta, o `null` si esta tabla no lo usa. */
export const columnaEn = <F,>(
  columnas: readonly Columna<F>[],
  sitio: Exclude<SitioEnLaTarjeta, 'par'>,
): Columna<F> | null => columnas.find((c) => c.sitio === sitio) ?? null;
