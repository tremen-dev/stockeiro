import { expect, type Locator, type Page } from '@playwright/test';
import {
  TOLERANCIA_PX,
  altoPara,
  medirFondoDeLista,
  ponerVentana,
  type MedidaFondoDeLista,
} from './geometria';
import { entrar, sembrarVigiladas, type FilaSembrada } from './spec041';

/**
 * SPEC-046 — **la lista larga**, que es el escenario entero de esta spec, y los gestos
 * que sus guardias comparten.
 *
 * ## Por qué la lista larga no es un número
 *
 * El defecto que originó SPEC-046 **no puede existir con dos filas**. La guardia de
 * SPEC-044 medía el panel de edición a los ocho anchos, con M1, M2 y M3, y pasaba: su
 * escenario tenía dos filas, así que el panel caía dentro de la ventana **por accidente
 * del tamaño de la muestra**. Se midió el caso en el que el defecto no puede darse.
 *
 * De ahí ADR-030 §4 y CA-11: una guardia que mide una **lista** se ejecuta con una lista
 * larga **de verdad**, y **lo comprueba antes de medir**. El número de filas no se
 * escribe como verdad —eso es un estado del árbol, no una propiedad (FOUNDATION,
 * 2026-08-20)—: se **deriva** hasta que el fondo de la tabla cae por debajo del pliegue,
 * y si un día las filas encogen, el test lo dice en vez de aprobar en silencio.
 *
 * La derivación se hace **a 1280 px**, que es el ancho donde la precondición cuesta más:
 * las filas envuelven menos —luego son más bajas— y la ventana es más alta (900 px frente
 * a 800 a 360). Lo que es largo a 1280 lo es en los ocho anchos, y cada guardia **vuelve
 * a afirmar la precondición** en el ancho que está midiendo.
 *
 * ## Los tickers son EXCLUSIVOS de esta spec
 *
 * El registro de símbolos es COMPARTIDO (ADR-002): escribir sobre `ITX` cambiaría lo que
 * ven otras pruebas. Todos los de aquí empiezan por `Z6`, como `spec041.ts` usa `Z4` y
 * `vigiladas-editar.spec.ts` usa `Z5`.
 */

export const CUENTA = 'spec046-capa@example.com';
export const SHOTS = '_qa/SPEC-046';

/** Con cuántas filas se empieza a tantear. No es la respuesta: es el primer intento. */
const FILAS_INICIALES = 24;
/** Techo del tanteo. Si con esto no basta, el escenario dejó de ser una lista. */
const FILAS_MAXIMAS = 192;

/** El ancho donde la precondición de «lista larga» cuesta más de cumplir. */
export const ANCHO_DE_DERIVACION = 1280;

/**
 * El **mismo ticker en dos mercados** (ADR-007 / ADR-012).
 *
 * Es lo que hace que CA-3 pruebe algo: si la capa nombrara «el ticker» y no «esta fila»,
 * con dos vigiladas de `Z6DUAL` no habría forma de saber cuál se está editando — y ése es
 * exactamente el fallo que la relación fila ↔ panel tiene que descartar.
 */
export const TICKER_DUAL = 'Z6DUAL';

/**
 * Una de cada cinco filas va **sin zona de venta**.
 *
 * No es adorno del escenario: es lo que hace comprobable, sobre la lista larga, que una
 * zona sin definir aparece **vacía y no con `0`** (SPEC-044 CA-19, que SPEC-046 CA-12
 * exige que siga siendo verdad). `0` es un número que el usuario no escribió, y vaciar
 * una zona es una edición válida (RN-10).
 */
export const TICKER_SIN_ZONA_DE_VENTA = 'Z6L001';

/** Las zonas de la fila dual, distintas por mercado: son la huella de CADA fila. */
export const ZONAS_DUAL = {
  BMEX: { buyMin: '11', buyMax: '13', sellMin: '31', sellMax: '33' },
  XNYS: { buyMin: '61', buyMax: '63', sellMin: '81', sellMax: '83' },
} as const;

/**
 * `n` vigiladas, con el par dual entre ellas.
 *
 * La tabla ordena por ticker de serie, así que `Z6DUAL` acaba **al principio** de la
 * lista, no donde se siembra: da igual, lo que CA-3 necesita es que las dos filas existan
 * y se distingan sólo por su mercado — y el test las busca por (ticker, mercado), nunca
 * por posición.
 *
 * El relleno lleva nombre, tipo, mercado, precio y las cuatro zonas para que cada fila
 * mida lo que mide una fila real: una lista de filas mínimas sería más corta que la de
 * verdad y la precondición de CA-11 se derivaría sobre un escenario más fácil.
 */
export function listaLarga(n: number): FilaSembrada[] {
  const medio = Math.floor(n / 2);
  const filas: FilaSembrada[] = [];
  for (let i = 0; i < n; i++) {
    if (i === medio) {
      // Dos filas, un solo ticker, dos mercados: la identidad es (ticker, mic).
      filas.push({
        ticker: TICKER_DUAL,
        micCode: 'BMEX',
        name: 'Dual Vigilada SA',
        instrumentType: 'Common Stock',
        ...ZONAS_DUAL.BMEX,
        price: '12',
      });
      filas.push({
        ticker: TICKER_DUAL,
        micCode: 'XNYS',
        name: 'Dual Vigilada SA',
        instrumentType: 'Common Stock',
        ...ZONAS_DUAL.XNYS,
        price: '99',
      });
      continue;
    }
    const num = String(i + 1).padStart(3, '0');
    // Una de cada cinco, sin zona de venta (ver `TICKER_SIN_ZONA_DE_VENTA`).
    const sinZonaDeVenta = i % 5 === 0;
    filas.push({
      ticker: `Z6L${num}`,
      micCode: i % 2 === 0 ? 'BMEX' : 'XNYS',
      name: `Vigilada Larga ${num}`,
      instrumentType: i % 3 === 0 ? 'ETF' : 'Common Stock',
      buyMin: '10',
      buyMax: '20',
      ...(sinZonaDeVenta ? {} : { sellMin: '40', sellMax: '50' }),
      price: i % 4 === 0 ? '15' : '30',
    });
  }
  return filas;
}

/* ────────────────────────────────────────────────────────────────────────────
   La precondición de CA-11
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Mide si el fondo de la tabla cae por debajo del pliegue en el ancho que hay puesto.
 *
 * La medida vive en el módulo (`medirFondoDeLista`, ADR-030 §4): aquí sólo se dice cuál
 * es la lista de esta pantalla.
 */
export const medirPrecondicion = async (page: Page): Promise<MedidaFondoDeLista> =>
  (await page.locator('table.data-table').isVisible())
    ? medirFondoDeLista(page, { lista: 'table.data-table', elementos: 'tbody tr' })
    : medirFondoDeLista(page, { lista: LISTA_DE_TARJETAS, elementos: ':scope > li' });

/**
 * **CA-11 afirmada.** El fondo de la tabla queda por debajo del pliegue, o el test falla
 * diciendo que el escenario dejó de ser una lista larga.
 *
 * No se afloja: si un día las filas encogen y esto deja de cumplirse, lo que hay que
 * re-encuadrar es el escenario, no la aserción (FOUNDATION, 2026-08-20).
 */
export async function afirmarListaLarga(page: Page, ancho: number): Promise<MedidaFondoDeLista> {
  const p = await medirPrecondicion(page);
  expect(
    p.porDebajoDelPliegue,
    `a ${ancho} px el escenario dejó de ser una LISTA LARGA: con ${p.elementos} filas, ` +
      `el fondo de la tabla cae en ${Math.round(p.fondo)} sobre una ventana de ` +
      `${p.ventanaAlto} px, o sea POR ENCIMA del pliegue. Con la tabla entera a la vista, ` +
      `el defecto que esta spec arregla no puede existir y medirlo no demuestra nada ` +
      `(ADR-030 §4). Re-encuadra el escenario —más filas—, nunca la medida`,
  ).toBeGreaterThan(TOLERANCIA_PX);
  return p;
}

/**
 * Siembra la lista y **deriva** cuántas filas hacen falta para que sea larga a 1280 px.
 *
 * Devuelve el número de filas sembradas. Deja la página en `/vigiladas`, a
 * `ANCHO_DE_DERIVACION`, con la tabla pintada.
 */
export async function derivarListaLarga(page: Page): Promise<number> {
  await entrar(page, CUENTA);
  await ponerVentana(page, ANCHO_DE_DERIVACION);

  for (let n = FILAS_INICIALES; n <= FILAS_MAXIMAS; n *= 2) {
    await sembrarVigiladas(CUENTA, listaLarga(n));
    await page.goto('/vigiladas');
    await page.locator('table.data-table').waitFor({ state: 'visible' });
    const p = await medirPrecondicion(page);
    if (p.porDebajoDelPliegue > TOLERANCIA_PX) return p.elementos;
  }
  throw new Error(
    `ni con ${FILAS_MAXIMAS} filas el fondo de la tabla cae por debajo del pliegue a ` +
      `${ANCHO_DE_DERIVACION}×${altoPara(ANCHO_DE_DERIVACION)}. O la tabla cambió mucho, ` +
      `o la siembra no está llegando a la pantalla`,
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Gestos y localizadores
   ──────────────────────────────────────────────────────────────────────────── */

/*
  ── ADAPTACIÓN DE SPEC-054 (dónde MIRAN estos localizadores, no qué exigen) ──────────

  Desde SPEC-054 / ADR-034 §3, `/vigiladas` monta la fila **dos veces** —`<table>` y `<ul>`
  de tarjetas— y el `@media` de 720 px apaga la que no toca con `display: none`. Las
  guardias de SPEC-046 recorren los **ocho anchos** del proyecto, así que a 360, 390, 640 y
  700 px la representación viva ya no es la tabla: es la lista de tarjetas.

  Lo que SPEC-046 vigila no cambia ni un ápice —M4 sobre la capa de edición, la
  precondición de lista larga, las tres posiciones, el foco que vuelve— y **ni una de sus
  aserciones se toca**. Lo único que cambia es a qué apuntan estos localizadores: a **la
  representación que está viva a este ancho**, que es la que el usuario tiene delante. Un
  localizador clavado en la tabla mediría, por debajo del canto, un árbol que nadie ve.

  Las asas de prueba del árbol de tarjetas llevan sufijo a propósito (`editar-zonas-tarjeta`
  y no `editar-zonas`): hay guardias que cuentan a nivel de página y un asa repetida las
  rompería por duplicado sin que exista ningún defecto.
*/
const FILAS_DE_LA_TABLA = 'table.data-table tbody tr';
const LISTA_DE_TARJETAS = 'ul[data-testid="tarjetas-vigiladas"]';
const TARJETAS = `${LISTA_DE_TARJETAS} > li`;
const EDITAR = '[data-testid="editar-zonas"], [data-testid="editar-zonas-tarjeta"]';
const MERCADO = '[data-testid="row-market"], [data-testid="row-market-tarjeta"]';

/** Las filas de la representación **viva** a este ancho: `<tr>` o tarjeta. */
export const filas = (page: Page) =>
  page.locator(`${FILAS_DE_LA_TABLA}, ${TARJETAS}`).filter({ visible: true });

export const capa = (page: Page) => page.getByTestId('editar-panel');
export const formEdicion = (page: Page) => page.getByTestId('editar-form');
export const cadencia = (page: Page) => page.getByTestId('edicion-cadencia');

/** El control *Editar* de la fila que ocupa la posición `i` **en pantalla**. */
export const editarEnFila = (page: Page, i: number): Locator =>
  filas(page).nth(i).locator(EDITAR);

/** La fila de `TICKER_DUAL` en el mercado indicado: dos filas, un ticker (ADR-007). */
export const filaDual = (page: Page, mercado: 'BME' | 'NYSE'): Locator =>
  filas(page)
    .filter({ hasText: TICKER_DUAL })
    .filter({ has: page.locator(MERCADO).filter({ hasText: mercado }) });

/** Las tres posiciones que ADR-030 §4 exige medir: cada una mata un error distinto. */
export interface Posicion {
  nombre: 'primera' | 'intermedia' | 'última';
  indice: number;
}

export const posiciones = (total: number): Posicion[] => [
  { nombre: 'primera', indice: 0 },
  { nombre: 'intermedia', indice: Math.floor(total / 2) },
  { nombre: 'última', indice: total - 1 },
];

/** Cierra la capa si está abierta, por el control de cancelar. */
export async function cerrarCapa(page: Page): Promise<void> {
  if ((await capa(page).count()) === 0) return;
  const cancelar = page.getByTestId('editar-cancelar');
  if ((await cancelar.count()) > 0) await cancelar.click();
  else await page.getByTestId('editar-cerrar').click();
  await expect(capa(page)).toHaveCount(0);
}

/** Deja el documento arriba del todo, sin haber pulsado nada. */
export async function subirDelTodo(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
}
