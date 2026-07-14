import { describe, it, expect } from 'vitest';
import { entraEnZona, zonasEntradas } from '@/lib/watchlist/zones';

describe('entraEnZona (CA-6, RN-11)', () => {
  const zona = { min: 10, max: 20 };

  it('dentro del rango → true', () => {
    expect(entraEnZona(15, zona)).toBe(true);
  });

  it('extremos inclusive (min y max cuentan como dentro)', () => {
    expect(entraEnZona(10, zona)).toBe(true);
    expect(entraEnZona(20, zona)).toBe(true);
  });

  it('fuera del rango → false', () => {
    expect(entraEnZona('9.99', zona)).toBe(false);
    expect(entraEnZona('20.01', zona)).toBe(false);
  });

  it('zona ausente o par incompleto → false', () => {
    expect(entraEnZona(15, null)).toBe(false);
    expect(entraEnZona(15, undefined)).toBe(false);
    expect(entraEnZona(15, { min: 10, max: null as unknown as number })).toBe(false);
  });
});

describe('zonasEntradas (CA-7, RN-11)', () => {
  it('detecta la zona de compra (misma regla) sin tocar la de venta ausente', () => {
    const r = zonasEntradas(12, { compra: { min: 10, max: 15 }, venta: null });
    expect(r).toEqual({ compra: true, venta: false });
  });

  it('detecta la zona de venta', () => {
    const r = zonasEntradas(105, { compra: null, venta: { min: 100, max: 110 } });
    expect(r).toEqual({ compra: false, venta: true });
  });

  it('ambas zonas solapadas: precio en las dos → ambas true (detección idéntica)', () => {
    const r = zonasEntradas(50, { compra: { min: 40, max: 60 }, venta: { min: 45, max: 55 } });
    expect(r).toEqual({ compra: true, venta: true });
  });

  it('sin zonas → nunca reporta entrada', () => {
    expect(zonasEntradas(50, { compra: null, venta: null })).toEqual({
      compra: false,
      venta: false,
    });
  });
});
