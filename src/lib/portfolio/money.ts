import { Decimal } from 'decimal.js';

/**
 * Redondeo monetario explícito (SPEC-002, dictamen sdd-cartera). Los importes se
 * presentan/devuelven redondeados a la unidad menor de la divisa (2 decimales en
 * v1, asunción EUR/USD) con ROUND_HALF_UP. El cálculo interno mantiene precisión
 * completa (Decimal); solo se redondea en la frontera de servicio/UI.
 */
export const MONEY_DP = 2;

export function moneyStr(v: Decimal): string {
  return v.toFixed(MONEY_DP, Decimal.ROUND_HALF_UP);
}
