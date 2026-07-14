import { Decimal } from 'decimal.js';

/**
 * Semántica formal de "zona" (SPEC-003, R-2, RN-10/RN-11). Lógica PURA.
 * Una zona es un rango [min, max]; la entrada se evalúa sobre el precio observado
 * del ciclo (sin intradía, "tocar" no aplica — dictamen sdd-mercados).
 */

export interface Zona {
  min: Decimal.Value;
  max: Decimal.Value;
}

export interface Zonas {
  compra: Zona | null;
  venta: Zona | null;
}

export interface EntradaZonas {
  compra: boolean;
  venta: boolean;
}

/**
 * RN-11: el precio ENTRA en la zona sii `min ≤ precio ≤ max` (inclusive: los
 * extremos cuentan como dentro). Zona ausente (null o par incompleto) → false.
 */
export function entraEnZona(precio: Decimal.Value, zona: Zona | null | undefined): boolean {
  if (!zona || zona.min == null || zona.max == null) return false;
  const p = new Decimal(precio);
  return p.gte(new Decimal(zona.min)) && p.lte(new Decimal(zona.max));
}

/**
 * RN-11 / CA-7: evalúa un precio contra ambas zonas con la MISMA regla. Compra y
 * venta son etiquetas; una acción sin zonas nunca reporta entrada.
 */
export function zonasEntradas(precio: Decimal.Value, zonas: Zonas): EntradaZonas {
  return {
    compra: entraEnZona(precio, zonas.compra),
    venta: entraEnZona(precio, zonas.venta),
  };
}
