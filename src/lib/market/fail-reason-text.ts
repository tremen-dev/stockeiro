import type { QuoteFailureReason } from './provider';

/**
 * Texto que ve el USUARIO para cada motivo (SPEC-016, CA-1). El texto crudo del proveedor
 * (`{"code":403,"message":"...upgrade your plan"}`) NUNCA llega a la UI: se traduce a estas
 * categorías estables del dominio. Si el proveedor cambia sus mensajes, esto no se entera.
 *
 * Deben decirle al usuario dos cosas: qué pasa y si puede hacer algo.
 */
export const FAIL_REASON_TEXT: Record<QuoteFailureReason, string> = {
  mercado_no_cubierto: 'Nuestro proveedor de precios no cubre este mercado',
  simbolo_desconocido: 'El proveedor no reconoce este símbolo (puede estar deslistado)',
  sin_identidad_de_mercado: 'Falta el mercado de esta acción: vuelve a añadirla eligiéndola del buscador',
  // Ni acusa al valor de estar deslistado (no lo está) ni promete que el próximo ciclo lo
  // arregle (no lo hará): el trabajo es nuestro, y eso es lo que se le dice (SPEC-020 CA-8).
  simbolo_no_admitido: 'Nuestro proveedor no nos da precio para este símbolo en este mercado; lo estamos revisando',
  // SPEC-043 CA-4 / ADR-027 pto. 4. Dice las tres cosas que tiene que decir: la causa es
  // NUESTRA (no del valor, no del mercado), la acción es NUESTRA, y no promete el próximo
  // ciclo — porque reintentar una cuota agotada falla igual, y falló igual dos días
  // seguidos. `tests/spec043-formulas-prohibidas.ts` vigila que siga sin prometerlo.
  cuota_agotada:
    'Hemos agotado la cuota de precios de nuestro proveedor; no se actualizará hasta que la repongamos',
  proveedor_no_disponible: 'El proveedor de precios no respondió; se reintentará en el próximo ciclo',
};

/** Texto para un motivo; cadena vacía si no hay motivo (nunca falló). */
export function failReasonText(reason: QuoteFailureReason | null | undefined): string {
  return reason ? FAIL_REASON_TEXT[reason] ?? '' : '';
}
