import type { SymbolMatch } from '@/lib/market/search-provider';

/**
 * Mapeo de la etiqueta de mercado del bróker (ING) a la familia de identificadores
 * de mercado del proveedor (ADR-009, SPEC-012). Se usa para FILTRAR los candidatos
 * de la búsqueda al mercado de la operación, de modo que un mismo nombre no resuelva
 * a la bolsa/divisa equivocada (RN-09, ADR-007).
 *
 * IMPORTANTE — tabla PROVISIONAL: los `mics`/`exchanges` deben verificarse contra los
 * valores REALES que devuelve Twelve Data `/symbol_search` (`mic_code`, `exchange`);
 * es un follow-up de despliegue (dictamen sdd-mercados). Se filtra por MIC **o** por
 * nombre de bolsa a propósito: NASDAQ/NYSE devuelven **sub-MICs por segmento**
 * (XNGS/XNMS/XNCM…), así que una igualdad ingenua a un único MIC excluiría candidatos
 * válidos. Por eso el match es por FAMILIA (varios MIC) más el nombre de la bolsa.
 */
export interface MarketFilter {
  mics: string[];
  exchanges: string[];
}

export const MARKET_MAP: Record<string, MarketFilter> = {
  'M.CONTINUO': { mics: ['XMAD', 'XMCE'], exchanges: ['BME', 'BOLSA DE MADRID', 'MADRID'] },
  NASDAQ: { mics: ['XNAS', 'XNGS', 'XNMS', 'XNCM'], exchanges: ['NASDAQ'] },
  NYSE: { mics: ['XNYS'], exchanges: ['NYSE'] },
  XETRA: { mics: ['XETR'], exchanges: ['XETRA'] },
  ESTOCOLMO: { mics: ['XSTO'], exchanges: ['STOCKHOLM', 'OMX'] },
  'BOLSA PARIS': { mics: ['XPAR'], exchanges: ['EURONEXT PARIS', 'PARIS'] },
  'BOLSA AMSTERDAM': { mics: ['XAMS'], exchanges: ['EURONEXT AMSTERDAM', 'AMSTERDAM'] },
};

const up = (s: string | null | undefined): string => (s ?? '').trim().toUpperCase();

/** Filtro de mercado de la etiqueta, o `null` si no la conocemos. */
export function marketFilterFor(label: string): MarketFilter | null {
  return MARKET_MAP[up(label)] ?? null;
}

/** True si un candidato pertenece al mercado de la etiqueta (por MIC o por bolsa). */
export function matchesMarket(candidate: SymbolMatch, label: string): boolean {
  const f = marketFilterFor(label);
  if (!f) return true; // mercado desconocido: no podemos filtrar → permisivo (se marcará ambiguo si hay varios)
  const mic = up(candidate.micCode);
  const ex = up(candidate.exchange);
  return f.mics.includes(mic) || f.exchanges.some((e) => ex.includes(e));
}

/**
 * Filtra los candidatos al mercado de la etiqueta. Si la etiqueta es desconocida,
 * devuelve los candidatos sin filtrar (permisivo): la ambigüedad, si la hay, la
 * resolverá el usuario (CA-3) en vez de descartar en silencio.
 */
export function filterByMarket(candidates: SymbolMatch[], label: string): SymbolMatch[] {
  return candidates.filter((c) => matchesMarket(c, label));
}
