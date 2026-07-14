import type { SymbolSearchProvider, SymbolMatch } from './search-provider';

/**
 * Proveedor de búsqueda fake para tests/e2e (ADR-007): candidatos controlados sin
 * tocar la API real. El dominio depende del puerto, así que es intercambiable con
 * `TwelveDataSymbolSearchProvider` sin cambiar el servicio de búsqueda.
 *
 * Filtra los candidatos cuyo ticker o nombre contienen el término (case-insensitive),
 * imitando la búsqueda del proveedor. Con `{ fail: true }` simula una caída del
 * proveedor (lanza) para probar la resiliencia (CA-8).
 */
export class FakeSymbolSearchProvider implements SymbolSearchProvider {
  /** Consultas recibidas, para asertar que NO se llama sin sesión (CA-7). */
  public readonly calls: string[] = [];

  constructor(
    private readonly matches: SymbolMatch[] = [],
    private readonly opts: { fail?: boolean } = {},
  ) {}

  async search(query: string): Promise<SymbolMatch[]> {
    this.calls.push(query);
    if (this.opts.fail) throw new Error('proveedor de búsqueda no disponible (simulado)');
    const q = query.trim().toLowerCase();
    if (q === '') return [];
    return this.matches.filter(
      (m) => m.ticker.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    );
  }
}
