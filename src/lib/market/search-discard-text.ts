import type { SearchDiscardReason, DiscardedSymbol } from './search-provider';
import { marketName } from './market-name';

/**
 * Texto que ve el USUARIO cuando el buscador **descarta** una fila (SPEC-029 CA-10).
 * Hermano de `fail-reason-text.ts`: el texto crudo del proveedor NUNCA llega a la UI,
 * solo estas categorías estables del dominio.
 *
 * Tienen que decirle dos cosas: qué pasa y si puede hacer algo. Y sobre todo tienen
 * que ser DISTINTAS de «no hemos encontrado nada»: la diferencia entre «te has
 * equivocado de nombre» y «el problema es nuestro» es la única forma que tiene el
 * usuario de saber si le queda alguna acción posible.
 */
export const SEARCH_DISCARD_TEXT: Record<SearchDiscardReason, string> = {
  mercado_no_soportado: 'cotiza en un mercado que todavía no cubrimos',
  sin_identidad_de_mercado: 'el proveedor no nos dice en qué mercado cotiza',
};

/** Texto para un motivo de descarte; cadena vacía si no hay motivo. */
export function searchDiscardText(reason: SearchDiscardReason | null | undefined): string {
  return reason ? SEARCH_DISCARD_TEXT[reason] ?? '' : '';
}

/**
 * Qué mercado nombrar en un descarte. Por definición no es ninguno de los 7 (si lo
 * fuera sería candidato), así que `marketName` lo devuelve en crudo — que es lo
 * honesto: es el código que dio el proveedor. Si no dio ninguno, no se nombra.
 */
export function discardedMarketLabel(d: DiscardedSymbol): string {
  return marketName(d.micCode);
}
