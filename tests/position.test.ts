import { describe, it, expect } from 'vitest';
import {
  computePosition,
  costeMedio,
  plActual,
  OversellError,
  type LedgerEntry,
} from '@/lib/portfolio/position';
import { moneyStr } from '@/lib/portfolio/money';

const on = (day: number): string => `2026-01-${String(day).padStart(2, '0')}`;

describe('computePosition — compras y coste medio (CA-1, CA-2, RN-04)', () => {
  it('CA-1: una compra abre posición con coste base = (precio×cantidad + gastos)/cantidad', () => {
    const pos = computePosition([
      { type: 'buy', occurredOn: on(1), quantity: 10, price: 100, gastos: 5 },
    ]);
    expect(pos.cantidadViva.toString()).toBe('10');
    expect(pos.costeBaseTotal.toString()).toBe('1005'); // 1000 + 5 gastos
    expect(costeMedio(pos)!.toString()).toBe('100.5');
    expect(pos.isOpen).toBe(true);
  });

  it('CA-2: varias compras → coste medio ponderado incluyendo gastos', () => {
    const pos = computePosition([
      { type: 'buy', occurredOn: on(1), quantity: 10, price: 100, gastos: 5 },
      { type: 'buy', occurredOn: on(2), quantity: 5, price: 120, gastos: 3 },
    ]);
    expect(pos.cantidadViva.toString()).toBe('15');
    expect(pos.costeBaseTotal.toString()).toBe('1608'); // 1005 + 603
    expect(costeMedio(pos)!.toString()).toBe('107.2'); // 1608/15
  });
});

describe('computePosition — ventas y P/L realizado (CA-3, CA-4, RN-05)', () => {
  it('CA-3: venta total → P/L realizado correcto y posición cerrada', () => {
    const pos = computePosition([
      { type: 'buy', occurredOn: on(1), quantity: 10, price: 100, gastos: 5 },
      { type: 'sell', occurredOn: on(2), quantity: 10, price: 110, gastos: 4 },
    ]);
    // proceeds 1100-4=1096 ; coste 100.5*10=1005 ; realizado 91
    expect(pos.realizadoPL.toString()).toBe('91');
    expect(pos.cantidadViva.toString()).toBe('0');
    expect(pos.isOpen).toBe(false);
    expect(costeMedio(pos)).toBeNull();
  });

  it('CA-4: venta parcial → cantidad viva reducida, coste medio intacto, realizado proporcional', () => {
    const pos = computePosition([
      { type: 'buy', occurredOn: on(1), quantity: 10, price: 100, gastos: 5 },
      { type: 'sell', occurredOn: on(2), quantity: 4, price: 110, gastos: 2 },
    ]);
    // proceeds 440-2=438 ; coste 100.5*4=402 ; realizado 36
    expect(pos.realizadoPL.toString()).toBe('36');
    expect(pos.cantidadViva.toString()).toBe('6');
    expect(costeMedio(pos)!.toString()).toBe('100.5'); // NO cambia
    expect(pos.isOpen).toBe(true);
  });
});

describe('computePosition — no sobreventa (CA-5, RN-08)', () => {
  it('lanza OversellError al vender más que la cantidad viva', () => {
    expect(() =>
      computePosition([
        { type: 'buy', occurredOn: on(1), quantity: 5, price: 100 },
        { type: 'sell', occurredOn: on(2), quantity: 6, price: 110 },
      ]),
    ).toThrow(OversellError);
  });
});

describe('plActual — P/L actual con y sin precio (CA-6, RN-06/D-6)', () => {
  const pos = computePosition([
    { type: 'buy', occurredOn: on(1), quantity: 10, price: 100 },
  ]);

  it('con precio de mercado: (precio − coste medio) × cantidad viva', () => {
    expect(plActual(pos, 120)!.toString()).toBe('200'); // (120-100)*10
  });

  it('sin precio: "sin dato" (null), nunca 0', () => {
    expect(plActual(pos, null)).toBeNull();
    expect(plActual(pos, undefined)).toBeNull();
  });

  it('posición cerrada: sin no-realizado (0)', () => {
    const cerrada = computePosition([
      { type: 'buy', occurredOn: on(1), quantity: 10, price: 100 },
      { type: 'sell', occurredOn: on(2), quantity: 10, price: 130 },
    ]);
    expect(plActual(cerrada, 200)!.toString()).toBe('0');
  });
});

describe('computePosition — split (CA-7, RN-07)', () => {
  it('ratio r ajusta cantidad ×r y coste medio ÷r sin cambiar valor ni P/L', () => {
    const pos = computePosition([
      { type: 'buy', occurredOn: on(1), quantity: 10, price: 100 }, // cost 1000, avg 100
      { type: 'split', occurredOn: on(2), ratio: 2 },
    ]);
    expect(pos.cantidadViva.toString()).toBe('20');
    expect(pos.costeBaseTotal.toString()).toBe('1000'); // valor intacto
    expect(costeMedio(pos)!.toString()).toBe('50'); // 100/2
    expect(pos.realizadoPL.toString()).toBe('0');
    // valor de la posición = coste medio × cantidad = 1000, invariante
    expect(costeMedio(pos)!.times(pos.cantidadViva).toString()).toBe('1000');
  });
});

describe('computePosition — dividendo (CA-8, RN-05)', () => {
  it('suma al P/L realizado sin alterar coste base ni cantidad', () => {
    const pos = computePosition([
      { type: 'buy', occurredOn: on(1), quantity: 10, price: 100 },
      { type: 'dividend', occurredOn: on(2), amount: 25 },
    ]);
    expect(pos.realizadoPL.toString()).toBe('25');
    expect(pos.cantidadViva.toString()).toBe('10');
    expect(pos.costeBaseTotal.toString()).toBe('1000');
  });
});

describe('precisión con divisiones periódicas (RED-A/RED-B)', () => {
  it('CA-6 exacto: buy 3 @100 gastos 1, precio 100 → P/L actual −1 (no −0.999…)', () => {
    const pos = computePosition([
      { type: 'buy', occurredOn: on(1), quantity: 3, price: 100, gastos: 1 },
    ]);
    expect(plActual(pos, 100)!.toString()).toBe('-1'); // exacto, sin deriva
    expect(moneyStr(plActual(pos, 100)!)).toBe('-1.00');
  });

  it('coste medio redondeado estable tras venta parcial (sin deriva perceptible)', () => {
    const antes = computePosition([
      { type: 'buy', occurredOn: on(1), quantity: 3, price: 100, gastos: 1 },
    ]);
    const despues = computePosition([
      { type: 'buy', occurredOn: on(1), quantity: 3, price: 100, gastos: 1 },
      { type: 'sell', occurredOn: on(2), quantity: 1, price: 100 },
    ]);
    expect(moneyStr(costeMedio(antes)!)).toBe('100.33');
    expect(moneyStr(costeMedio(despues)!)).toBe('100.33');
  });

  it('venta total con división periódica: realizado redondeado correcto', () => {
    // buy 3 @100 g1 (coste 301) ; sell 3 @110 g0 → proceeds 330 − 301 = 29
    const pos = computePosition([
      { type: 'buy', occurredOn: on(1), quantity: 3, price: 100, gastos: 1 },
      { type: 'sell', occurredOn: on(2), quantity: 3, price: 110 },
    ]);
    expect(moneyStr(pos.realizadoPL)).toBe('29.00');
    expect(pos.isOpen).toBe(false);
  });
});
