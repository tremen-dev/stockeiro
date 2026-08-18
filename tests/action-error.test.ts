import { describe, it, expect, vi, afterEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { toFormError, INFRA_ERROR_TEXT } from '@/lib/format/action-error';
import { InvalidNumberError, normalizeDecimalInput } from '@/lib/format/decimal-input';
import { InvalidZoneError } from '@/lib/watchlist/service';
import { NoPositionError } from '@/lib/portfolio/service';
import { OversellError } from '@/lib/portfolio/position';

// SPEC-030 — el error dice qué pasa y de quién es la culpa. CA-10..CA-12 y CA-14.
// «Datos inválidos.» significaba a la vez "has escrito mal un número" y "se ha caído la
// base de datos", y no dejaba rastro. Aquí se separan las dos cosas, en las dos
// direcciones (patrón de SPEC-016 CA-3).

afterEach(() => {
  vi.restoreAllMocks();
});

/** Ejecuta el mapeo espiando el log del servidor. */
function mapear(action: string, e: unknown) {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const salida = toFormError(action, e);
  return { salida, log };
}

/** El `InvalidNumberError` real que produce escribir `raw` en un campo concreto. */
function errorDeDato(raw: string, campo: string): InvalidNumberError {
  try {
    normalizeDecimalInput(raw, campo);
  } catch (e) {
    return e as InvalidNumberError;
  }
  throw new Error(`"${raw}" debería haber sido rechazado.`);
}

describe('CA-10: error de dato — nombra el campo, el valor y qué se espera', () => {
  const CAMPO = 'Zona de compra (mínimo)';

  it('"12,5,3" en Zona de compra (mínimo) ya no es «Datos inválidos.»', () => {
    const { salida } = mapear('vigilar', errorDeDato('12,5,3', CAMPO));
    expect(salida.error).toContain(CAMPO);
    expect(salida.error).toContain('12,5,3');
    expect(salida.error).not.toBe('Datos inválidos.');
    expect(salida.error).not.toContain('Datos inválidos');
  });

  it('el mensaje del ambiguo dice cómo escribirlo (CA-7 llega hasta el usuario)', () => {
    const { salida } = mapear('vigilar', errorDeDato('1.234', CAMPO));
    expect(salida.error).toContain('sin separador de miles');
    expect(salida.error).toContain('1234,00');
  });

  it('el de "abc" dice qué se espera, con un ejemplo, sin fingir la orientación', () => {
    const { salida } = mapear('vigilar', errorDeDato('abc', 'Precio'));
    expect(salida.error).toContain('Precio');
    expect(salida.error).toContain('abc');
    expect(salida.error).toContain('12,5');
    expect(salida.error).not.toContain('sin separador de miles');
  });
});

describe('CA-11: error de infraestructura — mensaje distinto y con traza', () => {
  it('el usuario lee que el fallo es nuestro y que reintente', () => {
    const { salida } = mapear('vigilar', new Error('connection terminated unexpectedly'));
    expect(salida.error).toBe(INFRA_ERROR_TEXT);
    expect(salida.error).not.toContain('Datos inválidos');
    expect(salida.error).toMatch(/nuestra parte/i);
    expect(salida.error).toMatch(/int[ée]nta/i);
  });

  it('queda traza en el log del servidor con la acción y la excepción original', () => {
    const boom = new Error('connection terminated unexpectedly');
    const { log } = mapear('vigilar', boom);
    expect(log).toHaveBeenCalledTimes(1);
    const args = log.mock.calls[0];
    expect(args.join(' ')).toContain('vigilar');
    expect(args).toContain(boom);
  });

  it('el log NO vuelca el formulario: solo acción y excepción (RN-01, D-5)', () => {
    const boom = new Error('connection terminated unexpectedly');
    const { log } = mapear('comprar', boom);
    const args = log.mock.calls[0];
    expect(args).toHaveLength(2);
    expect(args[1]).toBe(boom);
  });

  it('una excepción que no es Error tampoco se traga', () => {
    const { salida, log } = mapear('vender', 'algo raro');
    expect(salida.error).toBe(INFRA_ERROR_TEXT);
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe('CA-12: los dos errores no se confunden (en las dos direcciones)', () => {
  const dato = () => errorDeDato('12,5,3', 'Cantidad');
  const infra = () => new Error('connection terminated unexpectedly');

  it('los mensajes son distintos', () => {
    expect(mapear('comprar', dato()).salida.error).not.toBe(
      mapear('comprar', infra()).salida.error,
    );
  });

  it('el de dato NO escribe log de infraestructura', () => {
    expect(mapear('comprar', dato()).log).not.toHaveBeenCalled();
  });

  it('el de infraestructura SÍ lo escribe', () => {
    expect(mapear('comprar', infra()).log).toHaveBeenCalledTimes(1);
  });
});

describe('CA-14: los errores de dominio que ya existían siguen intactos', () => {
  it('InvalidZoneError conserva su mensaje (RN-10) y no deja log', () => {
    const e = new InvalidZoneError('Zona de compra incompleta: define el mínimo y el máximo.');
    const { salida, log } = mapear('vigilar', e);
    expect(salida.error).toBe('Zona de compra incompleta: define el mínimo y el máximo.');
    expect(log).not.toHaveBeenCalled();
  });

  it('InvalidZoneError de min > max conserva el suyo', () => {
    const e = new InvalidZoneError('Zona de compra: el mínimo no puede ser mayor que el máximo.');
    expect(mapear('vigilar', e).salida.error).toBe(
      'Zona de compra: el mínimo no puede ser mayor que el máximo.',
    );
  });

  it('OversellError conserva el mensaje de siempre (RN-08) y no deja log', () => {
    const e = new OversellError(new Decimal(10), new Decimal(20));
    const { salida, log } = mapear('vender', e);
    expect(salida.error).toBe('No puedes vender más de lo que tienes.');
    expect(log).not.toHaveBeenCalled();
  });

  it('NoPositionError conserva el mensaje de siempre y no deja log', () => {
    const { salida, log } = mapear('vender', new NoPositionError('sym-1'));
    expect(salida.error).toBe('No tienes posición en ese valor.');
    expect(log).not.toHaveBeenCalled();
  });

  it('ninguno de los cuatro cae en el cajón de sastre', () => {
    const dominio = [
      new InvalidZoneError('Zona de compra incompleta: define el mínimo y el máximo.'),
      new OversellError(new Decimal(10), new Decimal(20)),
      new NoPositionError('sym-1'),
      errorDeDato('abc', 'Precio'),
    ];
    for (const e of dominio) {
      expect(mapear('x', e).salida.error).not.toBe(INFRA_ERROR_TEXT);
    }
  });
});
