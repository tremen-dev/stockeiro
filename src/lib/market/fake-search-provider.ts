import type {
  SymbolSearchProvider,
  SymbolMatch,
  SymbolSearchResult,
  DiscardedSymbol,
} from './search-provider';

/**
 * Proveedor de búsqueda fake para tests/e2e (ADR-007): candidatos controlados sin
 * tocar la API real. El dominio depende del puerto, así que es intercambiable con
 * `TwelveDataSymbolSearchProvider` sin cambiar el servicio de búsqueda.
 *
 * Filtra candidatos **y descartes** por la MISMA regla de subcadena (ticker o
 * nombre, case-insensitive), imitando la búsqueda del proveedor. Los descartes se
 * siembran aparte porque el descarte por mercado ocurre en el adaptador
 * (SPEC-029): el fake tiene que poder reproducirlo, o el e2e no podría ejercer el
 * caso «existe, pero está en un mercado que no cubrimos».
 *
 * Con `{ fail: true }` simula una caída del proveedor (lanza) para probar la
 * resiliencia (CA-8 de SPEC-008 / CA-17 de SPEC-029).
 */
export class FakeSymbolSearchProvider implements SymbolSearchProvider {
  /** Consultas recibidas, para asertar que NO se llama sin sesión (CA-7 de SPEC-008). */
  public readonly calls: string[] = [];

  constructor(
    private readonly matches: SymbolMatch[] = [],
    private readonly opts: { fail?: boolean; discarded?: DiscardedSymbol[] } = {},
  ) {}

  async search(query: string): Promise<SymbolSearchResult> {
    this.calls.push(query);
    if (this.opts.fail) throw new Error('proveedor de búsqueda no disponible (simulado)');
    const q = query.trim().toLowerCase();
    if (q === '') return { matches: [], discarded: [] };
    const hit = (x: { ticker: string; name: string }) =>
      x.ticker.toLowerCase().includes(q) || x.name.toLowerCase().includes(q);
    return {
      matches: this.matches.filter(hit),
      discarded: (this.opts.discarded ?? []).filter(hit),
    };
  }
}
