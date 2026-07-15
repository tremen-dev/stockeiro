import type { SymbolMatch } from '@/lib/market/search-provider';
import { isOperatingMic, type OperatingMic } from '@/lib/market/mic';

/**
 * Mapeo de la etiqueta de mercado del bróker (ING) al **operating MIC canónico**
 * (ADR-009 + **ADR-012**). Se usa para FILTRAR los candidatos de la búsqueda al mercado
 * de la operación, de modo que un mismo nombre no resuelva a la bolsa/divisa equivocada
 * (RN-09, ADR-007).
 *
 * **Corrige F-SPEC-012-1**: la tabla original mapeaba `M.CONTINUO→XMAD` (el MIC de
 * *segmento* de la Bolsa de Madrid). ADR-012 canoniza la identidad en el **operating
 * MIC**, así que es **`BMEX`** (Bolsas y Mercados Españoles). Además, la tolerancia a
 * sub-MICs (XNGS/XNMS/XNCM…) que llevaba esta tabla **ya no hace falta**: el adaptador
 * de búsqueda normaliza segmento→operating en la frontera (ADR-012), así que aquí llegan
 * candidatos ya canónicos y basta comparar el MIC.
 */
export const MARKET_MAP: Record<string, OperatingMic> = {
  'M.CONTINUO': 'BMEX',
  NASDAQ: 'XNAS',
  NYSE: 'XNYS',
  XETRA: 'XETR',
  ESTOCOLMO: 'XSTO',
  'BOLSA PARIS': 'XPAR',
  'BOLSA AMSTERDAM': 'XAMS',
};

const up = (s: string | null | undefined): string => (s ?? '').trim().toUpperCase();

/** Operating MIC de la etiqueta de mercado del bróker, o `null` si no la conocemos. */
export function marketFilterFor(label: string): OperatingMic | null {
  return MARKET_MAP[up(label)] ?? null;
}

/** True si un candidato pertenece al mercado de la etiqueta (por operating MIC). */
export function matchesMarket(candidate: SymbolMatch, label: string): boolean {
  const mic = marketFilterFor(label);
  if (!mic) return true; // mercado desconocido: no podemos filtrar → permisivo (el usuario decide)
  return isOperatingMic(candidate.micCode) && up(candidate.micCode) === mic;
}

/**
 * Filtra los candidatos al mercado de la etiqueta. Si la etiqueta es desconocida,
 * devuelve los candidatos sin filtrar (permisivo): la ambigüedad, si la hay, la
 * resolverá el usuario (CA-3 de SPEC-012) en vez de descartar en silencio.
 */
export function filterByMarket(candidates: SymbolMatch[], label: string): SymbolMatch[] {
  return candidates.filter((c) => matchesMarket(c, label));
}
