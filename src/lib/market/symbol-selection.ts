import type { SymbolMarket } from '@/lib/portfolio/symbols';

/**
 * Selección de un candidato del buscador de símbolos (SPEC-008/ADR-007). La UI
 * (componente compartido) envía la identidad completa en campos ocultos tras elegir
 * de la lista; el usuario NO teclea el símbolo a mano.
 */
export interface SymbolSelection {
  ticker: string;
  currency: string;
  market: SymbolMarket;
}

/**
 * Lee la selección de símbolo del formulario. Devuelve null si falta la identidad
 * de mercado (ticker/micCode/divisa): en ese caso NO se puede guardar un símbolo sin
 * resolver (CA-8) y la acción debe rechazar. La divisa proviene del candidato, nunca
 * de un valor tecleado ni de EUR fijo (CA-4).
 */
export function readSymbolSelection(formData: FormData): SymbolSelection | null {
  const ticker = String(formData.get('ticker') ?? '').trim().toUpperCase();
  const micCode = String(formData.get('micCode') ?? '').trim();
  const currency = String(formData.get('currency') ?? '').trim();
  if (!ticker || !micCode || !currency) return null;
  const exchange = String(formData.get('exchange') ?? '').trim() || null;
  const name = String(formData.get('name') ?? '').trim() || null;
  return { ticker, currency, market: { micCode, exchange, name } };
}
