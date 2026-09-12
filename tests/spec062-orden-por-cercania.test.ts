import { describe, it, expect } from 'vitest';
import {
  CRITERIOS_ORDEN,
  ordenarVigiladas,
  type FilaOrdenable,
} from '@/lib/watchlist/sort';
import { acercamientoDeVigilada } from '@/lib/watchlist/acercamiento';
import type { ZoneState } from '@/lib/watchlist/zone-status';

/**
 * SPEC-062 CA-11 y CA-12 — **el orden por cercanía**.
 *
 * Dos propiedades, y la segunda es la que sostiene CE-M1 de EPIC-MEJORA: ordenar **no
 * cambia lo que dice ninguna fila**. Una mejora de presentación que alterase un dato al
 * reordenar dejaría de ser una mejora.
 *
 * La tercera propiedad, la fina: **una ausencia no se invierte**. Una fila sin cotización
 * o sin zonas no es «la más lejana» — es que no se sabe —, así que se queda al final tanto
 * en ascendente como en descendente. Darle la vuelta a la lista no puede convertir un *no
 * se sabe* en la respuesta a *¿qué tengo más cerca?*.
 */

const fila = (
  ticker: string,
  price: string | null,
  zonas: Partial<Record<'buyMin' | 'buyMax' | 'sellMin' | 'sellMax', string>> = {},
  state: ZoneState = 'out',
): FilaOrdenable => ({
  id: `id-${ticker}`,
  ticker,
  name: null,
  state,
  failReason: null,
  acercamiento: acercamientoDeVigilada({
    price,
    buyMin: zonas.buyMin ?? null,
    buyMax: zonas.buyMax ?? null,
    sellMin: zonas.sellMin ?? null,
    sellMax: zonas.sellMax ?? null,
  }),
});

const tickers = (filas: FilaOrdenable[]) => filas.map((f) => f.ticker);

/** Compra 90–100, y el precio a distintas alturas por encima: distancias crecientes. */
const CERCA = fila('CERCA', '100.5', { buyMin: '90', buyMax: '100' }); // ~0,5 %
const MEDIO = fila('MEDIO', '105', { buyMin: '90', buyMax: '100' }); // ~4,8 %
const LEJOS = fila('LEJOS', '130', { buyMin: '90', buyMax: '100' }); // ~23,1 %
const DENTRO = fila('DENTRO', '95', { buyMin: '90', buyMax: '100' }, 'buy'); // 0
const SINQUOTE = fila('SINQUOTE', null, { buyMin: '90', buyMax: '100' }, 'none');
const SINZONA = fila('SINZONA', '100');

describe('SPEC-062 CA-11: «cercanía» se suma a los criterios, y ninguno se va', () => {
  it('los criterios que ya existían siguen ofrecidos, en su orden, y «Ticker» sigue el primero', () => {
    const claves = CRITERIOS_ORDEN.map((c) => c.clave);
    const posicion = (clave: (typeof claves)[number]) => claves.indexOf(clave);

    expect(claves[0]).toBe('ticker'); // el orden por defecto de la pantalla (SPEC-041 CA-6)
    expect(posicion('ticker')).toBeLessThan(posicion('name'));
    expect(posicion('name')).toBeLessThan(posicion('state'));
    expect(claves).toContain('cercania');
  });

  it('y el criterio nuevo llega con su rótulo, no con su clave', () => {
    expect(CRITERIOS_ORDEN.find((c) => c.clave === 'cercania')?.etiqueta).toBe('Cercanía');
  });

  it('ascendente: lo que está en zona encabeza, y detrás va lo más cerca', () => {
    const filas = [LEJOS, SINQUOTE, CERCA, DENTRO, MEDIO];
    expect(tickers(ordenarVigiladas(filas, 'cercania', 'asc'))).toEqual([
      'DENTRO',
      'CERCA',
      'MEDIO',
      'LEJOS',
      'SINQUOTE',
    ]);
  });

  it('descendente invierte a las que tienen medida — y sólo a ésas', () => {
    const filas = [LEJOS, SINQUOTE, CERCA, DENTRO, MEDIO];
    expect(tickers(ordenarVigiladas(filas, 'cercania', 'desc'))).toEqual([
      'LEJOS',
      'MEDIO',
      'CERCA',
      'DENTRO',
      'SINQUOTE',
    ]);
  });

  it('una fila sin medida NUNCA se cuela entre filas con medida, en ninguna dirección', () => {
    const filas = [CERCA, SINQUOTE, MEDIO, SINZONA, LEJOS];

    for (const direccion of ['asc', 'desc'] as const) {
      const orden = tickers(ordenarVigiladas(filas, 'cercania', direccion));
      const sinMedida = orden.filter((t) => t === 'SINQUOTE' || t === 'SINZONA');
      const ultimas = orden.slice(-2);

      expect(sinMedida).toHaveLength(2);
      expect([...ultimas].sort()).toEqual([...sinMedida].sort());
    }
  });

  it('sin cotización y sin zonas van las dos al final, y entre ellas desempata el criterio estable', () => {
    const orden = tickers(ordenarVigiladas([SINZONA, SINQUOTE], 'cercania', 'asc'));
    expect(orden).toEqual(['SINQUOTE', 'SINZONA']); // por ticker, ascendente (SPEC-041 CA-9)
    // Y el desempate no cambia de opinión al invertir la dirección.
    expect(tickers(ordenarVigiladas([SINQUOTE, SINZONA], 'cercania', 'desc'))).toEqual([
      'SINQUOTE',
      'SINZONA',
    ]);
  });

  it('dos filas empatadas no bailan: el desempate llega hasta el id y es estable', () => {
    const a = { ...fila('AAA', '100.5', { buyMin: '90', buyMax: '100' }), id: 'id-1' };
    const b = { ...fila('AAA', '100.5', { buyMin: '90', buyMax: '100' }), id: 'id-2' };

    expect(ordenarVigiladas([b, a], 'cercania', 'asc').map((f) => f.id)).toEqual(['id-1', 'id-2']);
    expect(ordenarVigiladas([a, b], 'cercania', 'asc').map((f) => f.id)).toEqual(['id-1', 'id-2']);
  });

  it('ordenar por cercanía no toca los otros criterios: siguen ordenando como antes', () => {
    const filas = [LEJOS, CERCA, MEDIO];
    expect(tickers(ordenarVigiladas(filas, 'ticker', 'asc'))).toEqual(['CERCA', 'LEJOS', 'MEDIO']);
  });
});

describe('SPEC-062 CA-12: ordenar es una permutación, no una reescritura', () => {
  it('la lista ordenada tiene las MISMAS filas, con el mismo contenido', () => {
    const filas = [LEJOS, SINQUOTE, CERCA, DENTRO, MEDIO];
    const ordenadas = ordenarVigiladas(filas, 'cercania', 'asc');

    expect(ordenadas).toHaveLength(filas.length);
    for (const original of filas) {
      const despues = ordenadas.find((f) => f.id === original.id);
      expect(despues).toEqual(original);
    }
  });

  it('y la lista que llega del servidor no se muta', () => {
    const filas = [LEJOS, CERCA, MEDIO];
    const antes = tickers(filas);
    ordenarVigiladas(filas, 'cercania', 'asc');
    expect(tickers(filas)).toEqual(antes);
  });

  it('el acercamiento de cada fila sigue siendo el suyo después de reordenar', () => {
    const ordenadas = ordenarVigiladas([LEJOS, CERCA, MEDIO], 'cercania', 'asc');
    const cerca = ordenadas.find((f) => f.ticker === 'CERCA')!;
    expect(cerca.acercamiento).toEqual(CERCA.acercamiento);
    expect(cerca.acercamiento!.zona).toBe('compra');
  });
});
