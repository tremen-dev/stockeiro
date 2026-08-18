'use client';

import { useEffect, useRef, useState } from 'react';
import { searchSymbolsAction } from './symbol-search-action';
import type { SymbolMatch, DiscardedSymbol } from '@/lib/market/search-provider';
import { instrumentTypeText } from '@/lib/market/instrument-type-text';
import { marketName } from '@/lib/market/market-name';
import { searchDiscardText, discardedMarketLabel } from '@/lib/market/search-discard-text';

/** Umbral mínimo y debounce del cliente (CA-10): protegen el free tier compartido. */
const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

/**
 * SPEC-029 CA-9/CA-10: «sin candidatos» ya no es UN estado, son DOS, y se leen
 * distinto porque significan cosas distintas y dejan al usuario con acciones
 * distintas. `empty` = no existe nada con ese nombre (revisa el nombre);
 * `discarded` = existe, pero no lo cubrimos (el problema es nuestro).
 */
type Status = 'idle' | 'loading' | 'empty' | 'discarded' | 'error';

/**
 * Buscador-y-selección de símbolos compartido por /vigiladas y /cartera (CA-9).
 * El usuario busca por nombre o ticker; al elegir un candidato, la identidad de
 * mercado (ticker, micCode, exchange, name, currency, instrumentType) queda en
 * campos ocultos que la server action lee. Sin selección no hay campos → no se
 * puede guardar (CA-8).
 *
 * El **mercado** se pinta con `marketName(micCode)`, el MISMO mapa que la tabla de
 * /vigiladas (SPEC-029 CA-14): antes se pintaba `exchange || micCode` —texto libre
 * del proveedor o el código pelado—, y con eso el usuario habría leído «NASDAQ» en
 * la tabla y «XNGS» en el buscador para el mismo valor.
 *
 * `onSelect` (opcional, SPEC-014): si se pasa, al elegir un candidato se invoca el
 * callback y el picker se resetea para volver a usarse (flujo cliente del import),
 * en vez de quedar fijado con campos ocultos de formulario. Sin él, comportamiento
 * original (chip + inputs ocultos). No rompe a los consumidores existentes.
 */
export function SymbolSearch({
  helpText,
  onSelect,
  placeholder,
}: {
  helpText?: string;
  onSelect?: (m: SymbolMatch) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolMatch[]>([]);
  const [discarded, setDiscarded] = useState<DiscardedSymbol[]>([]);
  const [selected, setSelected] = useState<SymbolMatch | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (selected) return;
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setResults([]);
      setDiscarded([]);
      setStatus('idle');
      setOpen(false);
      return;
    }
    const handle = setTimeout(async () => {
      const mySeq = ++seq.current;
      setStatus('loading');
      setOpen(true);
      const outcome = await searchSymbolsAction(q);
      if (mySeq !== seq.current) return; // ignora respuestas obsoletas (carrera de tecleo)
      if (outcome.status === 'ok') {
        setResults(outcome.results);
        setDiscarded(outcome.discarded);
        // Tres desenlaces, tres mensajes (CA-9/CA-10). Si hay candidatos se muestran,
        // aunque también haya descartes: los descartes no tapan lo que sí sirve.
        if (outcome.results.length) setStatus('idle');
        else setStatus(outcome.discarded.length ? 'discarded' : 'empty');
      } else {
        setResults([]);
        setDiscarded([]);
        setStatus('error'); // unauthorized o fallo del proveedor (CA-8)
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, selected]);

  function choose(m: SymbolMatch) {
    if (onSelect) {
      // Flujo cliente (import): notifica y resetea el picker para reutilizarlo.
      onSelect(m);
      setSelected(null);
      setOpen(false);
      setResults([]);
      setDiscarded([]);
      setQuery('');
      return;
    }
    setSelected(m);
    setOpen(false);
    setResults([]);
    setDiscarded([]);
    setQuery('');
  }

  function clear() {
    setSelected(null);
    setQuery('');
    setResults([]);
    setDiscarded([]);
    setStatus('idle');
  }

  if (selected) {
    const tipo = instrumentTypeText(selected.instrumentType);
    return (
      <div className="symbol-picker">
        <span className="symbol-picker-label">Acción</span>
        <div className="symbol-chip">
          <div className="symbol-chip-main">
            <strong className="symbol-chip-tk">{selected.ticker}</strong>
            <span className="symbol-chip-name">{selected.name}</span>
          </div>
          <div className="symbol-chip-meta">
            <span data-testid="chip-market">{marketName(selected.micCode)}</span>
            {tipo !== '' && (
              <span className="symbol-type" data-testid="chip-type">
                {tipo}
              </span>
            )}
            <span className="symbol-chip-ccy">{selected.currency}</span>
          </div>
          <button type="button" className="symbol-chip-change" onClick={clear}>
            Cambiar
          </button>
        </div>
        <input type="hidden" name="ticker" value={selected.ticker} />
        <input type="hidden" name="micCode" value={selected.micCode} />
        <input type="hidden" name="exchange" value={selected.exchange} />
        <input type="hidden" name="name" value={selected.name} />
        <input type="hidden" name="currency" value={selected.currency} />
        <input type="hidden" name="instrumentType" value={selected.instrumentType} />
      </div>
    );
  }

  return (
    <div className="symbol-picker">
      <label className="symbol-picker-label" htmlFor="symbol-q">
        Acción
      </label>
      <div className="symbol-search">
        <input
          id="symbol-q"
          className="symbol-search-input"
          autoComplete="off"
          placeholder={placeholder ?? 'Busca por nombre o ticker (p. ej. Microsoft)'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length || status !== 'idle') setOpen(true);
          }}
        />
        {open && (
          <ul className="symbol-results" role="listbox">
            {status === 'loading' && <li className="symbol-hint">Buscando…</li>}
            {status === 'error' && (
              <li className="symbol-hint symbol-hint-error" data-testid="search-error">
                Búsqueda no disponible. Inténtalo de nuevo.
              </li>
            )}
            {status === 'empty' && (
              <li className="symbol-hint" data-testid="search-empty">
                No hemos encontrado ningún valor con «{query.trim()}». Revisa el nombre o prueba con
                el ticker.
              </li>
            )}
            {status === 'discarded' && (
              <li className="symbol-hint symbol-hint-discarded" data-testid="search-discarded">
                <span className="symbol-hint-title">Existe, pero no lo cubrimos</span>
                <ul className="symbol-discards">
                  {discarded.map((d) => {
                    const mercado = discardedMarketLabel(d);
                    return (
                      <li key={`${d.ticker}:${d.micCode}`}>
                        <strong>{d.ticker}</strong> {d.name} — {searchDiscardText(d.reason)}
                        {mercado !== '' && <> ({mercado})</>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            )}
            {results.map((m) => {
              const tipo = instrumentTypeText(m.instrumentType);
              return (
                <li key={`${m.ticker}:${m.micCode}`}>
                  <button type="button" className="symbol-result" onClick={() => choose(m)}>
                    <span className="symbol-result-tk">
                      <strong>{m.ticker}</strong>
                      <span className="symbol-result-name">{m.name}</span>
                    </span>
                    <span className="symbol-result-meta">
                      <span data-testid="result-market">{marketName(m.micCode)}</span>
                      {tipo !== '' && (
                        <>
                          {' · '}
                          <span className="symbol-type" data-testid="result-type">
                            {tipo}
                          </span>
                        </>
                      )}
                      {' · '}
                      {m.currency}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="symbol-picker-help">{helpText ?? 'Elige una acción de la lista.'}</p>
    </div>
  );
}
