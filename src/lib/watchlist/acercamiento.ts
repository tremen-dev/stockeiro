import { Decimal } from 'decimal.js';
import { ESCALA_ACERCAMIENTO_PCT } from '@/lib/config/escala-acercamiento';
import { entraEnZona, type Zona } from './zones';

/**
 * SPEC-062 / **RN-18** — **cuánto le falta al precio para entrar en una zona**.
 *
 * ## Qué hace y qué NO hace
 *
 * Hace **una resta**: la separación entre el precio y el borde más cercano del rango,
 * dividida por el precio. No decide nada. La entrada en zona la siguen decidiendo
 * `entraEnZona` (RN-11) y el ciclo (RN-13/RN-14), y la zona la sigue poniendo entera el
 * usuario (**D-4**). Una barra llena **no es un disparo**.
 *
 * Por eso este módulo **no reimplementa la pertenencia**: pregunta a `entraEnZona`, que es
 * la única definición de *dentro* que tiene el proyecto (CA-4). Dos definiciones de la
 * regla que más importa del producto acabarían divergiendo, y la divergencia se vería como
 * una fila «fuera de zona» con un acercamiento de cero.
 *
 * ## La ausencia no es un cero (CA-1)
 *
 * `null` significa **no hay medida** —falta la cotización, la zona está incompleta o el
 * precio no es positivo— y es justo lo contrario de `0`, que significa **dentro de la
 * zona**. Quien presente esto tiene que distinguirlos: enseñar «0%» sobre una fila sin
 * datos sería exactamente el silencio con cara de dato que costó EPIC-FIX.
 *
 * ## Por qué el denominador es el precio y no el borde
 *
 * Porque lo que el usuario pregunta es **cuánto tiene que moverse el precio**, que es la
 * convención con la que lee cualquier variación porcentual del mercado (dictamen de
 * sdd-mercados, 2026-09-12). Consecuencia que obliga a CA-9: la medida **no es simétrica**
 * —bajar un 3,2% desde 100 lleva a 96,8; subir un 3,2% desde 96,8 no devuelve a 100—, así
 * que el **sentido** se muestra siempre.
 *
 * ## Aritmética decimal, y no por gusto
 *
 * `Decimal` de principio a fin, como `zones.ts`. El precio y las zonas llegan como
 * `numeric` de Postgres (cadenas), y pasar por `number` para dividir mete error binario en
 * la cifra que se enseña.
 */

/** A qué zona apunta la medida. Vocabulario del dominio, no del esquema. */
export type ZonaObjetivo = 'compra' | 'venta';

/** Qué tendría que hacer el precio para entrar. `null` = ya está dentro. */
export type SentidoDeAcercamiento = 'bajar' | 'subir';

export interface Acercamiento {
  /** La zona medida: la más cercana de las que el usuario haya definido (CA-7). */
  zona: ZonaObjetivo;
  /** El precio está DENTRO de esa zona (RN-11, extremos incluidos). */
  dentro: boolean;
  /**
   * Distancia relativa **en porcentaje**, exacta, como cadena decimal (`'3.1553398…'`).
   * `'0'` cuando está dentro. Se guarda sin redondear a propósito: el redondeo es cosa de
   * la presentación (CA-13) y ordenar se hace sobre esto.
   */
  porcentaje: string;
  /** `null` si está dentro; si no, hacia dónde tiene que ir el precio. */
  sentido: SentidoDeAcercamiento | null;
}

/**
 * La escala de la barra (CA-8, 10% decidido en el gate del 2026-09-13). **Se re-exporta,
 * no se redefine**: su único hogar es `src/lib/config/escala-acercamiento.ts`, donde está
 * escrito por qué vive fuera de esta carpeta — `/ayuda` cuenta el mismo tramo y tiene
 * prohibido alcanzar `src/lib/watchlist/` (SPEC-039 CA-14).
 */
export { ESCALA_ACERCAMIENTO_PCT };

/** Decimales con los que se ENSEÑA el porcentaje. Uno, y por un motivo (ver `visible`). */
export const DECIMALES_VISIBLES = 1;

/** Lo que hace falta de una fila para medirla. Deliberadamente mínimo: es una resta. */
export interface FilaConZonas {
  price: string | null;
  buyMin: string | null;
  buyMax: string | null;
  sellMin: string | null;
  sellMax: string | null;
}

const zonaDe = (min: string | null, max: string | null): Zona | null =>
  min != null && max != null ? { min, max } : null;

/**
 * La distancia de un precio a **una** zona, o `null` si no hay con qué medirla (CA-1, CA-2).
 *
 * El orden de las comprobaciones importa: primero se pregunta a `entraEnZona` y sólo
 * después se resta, de modo que el caso «dentro» nunca pasa por la división y nunca
 * produce un sentido (CA-3).
 */
export function distanciaAZona(
  precio: string | null | undefined,
  zona: Zona | null,
): Omit<Acercamiento, 'zona'> | null {
  if (precio == null || zona == null) return null;

  const p = new Decimal(precio);
  // Un precio no positivo no es un precio, y además es el único divisor imposible.
  if (!p.isFinite() || p.lte(0)) return null;

  if (entraEnZona(precio, zona)) {
    return { dentro: true, porcentaje: '0', sentido: null };
  }

  const min = new Decimal(zona.min);
  const max = new Decimal(zona.max);
  // Fuera, y `entraEnZona` ya ha dicho que lo está: o por encima del techo o por debajo
  // del suelo. No hay tercer caso, y el que quede se resuelve con el borde que toca.
  const porEncima = p.gt(max);
  const borde = porEncima ? max : min;
  const distancia = p.minus(borde).abs().div(p).times(100);

  return {
    dentro: false,
    porcentaje: distancia.toString(),
    sentido: porEncima ? 'bajar' : 'subir',
  };
}

/**
 * El acercamiento **de una fila**: la zona más cercana de las que tenga definidas (CA-7).
 *
 * Las tres reglas de desempate, escritas y no emergentes:
 *
 *  - **dentro gana a fuera** — si el precio está en alguna de sus zonas, eso es lo que se
 *    dice, y no «te faltan 4 puntos para la otra»;
 *  - entre dos medidas, la **menor** distancia;
 *  - **empate exacto → compra**. Declarado, y por tanto estable: no depende del orden en
 *    que se evalúen las zonas ni de dónde caiga la fila en la lista.
 */
export function acercamientoDeVigilada(fila: FilaConZonas): Acercamiento | null {
  const compra = distanciaAZona(fila.price, zonaDe(fila.buyMin, fila.buyMax));
  const venta = distanciaAZona(fila.price, zonaDe(fila.sellMin, fila.sellMax));

  if (compra == null) return venta == null ? null : { zona: 'venta', ...venta };
  if (venta == null) return { zona: 'compra', ...compra };

  if (compra.dentro || venta.dentro) {
    return compra.dentro ? { zona: 'compra', ...compra } : { zona: 'venta', ...venta };
  }

  // `lte`: el empate cae del lado de compra, que es la regla declarada de CA-7.
  return new Decimal(compra.porcentaje).lte(venta.porcentaje)
    ? { zona: 'compra', ...compra }
    : { zona: 'venta', ...venta };
}

/**
 * La fracción de barra, en `[0, 1]` (CA-8). Dentro de zona, llena.
 *
 * La barra es una **escala**: se acota, y lo que no cabe en ella lo sigue diciendo el
 * número, que nunca se acota (ver `visible`).
 */
export function fraccionDeBarra(a: Acercamiento, escala = ESCALA_ACERCAMIENTO_PCT): number {
  if (a.dentro) return 1;
  const fraccion = 1 - Number(a.porcentaje) / escala;
  return Math.min(1, Math.max(0, fraccion));
}

/**
 * El porcentaje **como se lee** (CA-13).
 *
 * Dos decisiones dentro de esta función, y las dos son del dominio:
 *
 *  - **un solo decimal**, porque el precio es el último cierre **no ajustado** (RN-12) y
 *    las zonas las escribió el usuario a mano, quizá antes de un split: más cifras serían
 *    precisión aparente sobre un dato que no la tiene (sdd-mercados, 2026-09-12);
 *  - **«menos de 0,1%» en vez de «0,0%»**, porque un cero redondeado sobre una fila que
 *    está FUERA se lee como *ha entrado* — y entonces la fila de al lado, que sí entró,
 *    parece idéntica y el motor de disparo parece roto. El redondeo no puede fabricar una
 *    entrada en zona (RN-18 pto. b).
 */
export function porcentajeVisible(a: Acercamiento): string {
  const exacto = new Decimal(a.porcentaje);
  const redondeado = exacto.toDecimalPlaces(DECIMALES_VISIBLES, Decimal.ROUND_HALF_UP);
  if (redondeado.isZero() && !exacto.isZero()) {
    const minimo = new Decimal(1).div(new Decimal(10).pow(DECIMALES_VISIBLES));
    return `menos de ${minimo.toFixed(DECIMALES_VISIBLES).replace('.', ',')}%`;
  }
  return `${redondeado.toFixed(DECIMALES_VISIBLES).replace('.', ',')}%`;
}

/** La flecha del sentido. Decorativa: lo que informa es el texto (CA-10). */
export const FLECHA: Record<SentidoDeAcercamiento, string> = {
  bajar: '▼',
  subir: '▲',
};

/**
 * El texto corto que se ve en la fila (CA-9). Vacío cuando está dentro: ahí quien lo dice
 * es la etiqueta de estado que tiene encima (SPEC-007), y repetirlo sería ruido.
 */
export function textoDeAcercamiento(a: Acercamiento): string {
  if (a.dentro || a.sentido == null) return '';
  return `${FLECHA[a.sentido]} ${porcentajeVisible(a)} hasta ${a.zona}`;
}

/**
 * El nombre accesible del conjunto barra + texto (CA-10). Dice **lo mismo** que se ve, en
 * una frase entera: quien escucha no tiene la flecha ni la barra.
 */
export function nombreAccesibleDeAcercamiento(a: Acercamiento): string {
  if (a.dentro || a.sentido == null) {
    return `Dentro de la zona de ${a.zona}`;
  }
  return `El precio tiene que ${a.sentido} un ${porcentajeVisible(a)} para entrar en la zona de ${a.zona}`;
}
