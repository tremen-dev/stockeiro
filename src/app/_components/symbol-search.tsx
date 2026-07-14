'use client';

import { useEffect, useRef, useState } from 'react';
import { searchSymbolsAction } from './symbol-search-action';
import type { SymbolMatch } from '@/lib/market/search-provider';

/** Umbral mínimo y debounce del cliente (CA-10): protegen el free tier compartido. */
const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

type Status = 'idle' | 'loading' | 'empty' | 'error';

/**
 * Buscador-y-selección de símbolos compartido por /vigiladas y /cartera (CA-9).
 * El usuario busca por nombre o ticker; al elegir un candidato, la identidad de
 * mercado (ticker, micCode, exchange, name, currency) queda en campos ocultos que
 * la server action lee. Sin selección no hay campos → no se puede guardar (CA-8).
 */
export function SymbolSearch({ helpText }: { helpText?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolMatch[]>([]);
  const [selected, setSelected] = useState<SymbolMatch | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (selected) return;
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setResults([]);
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
        setStatus(outcome.results.length ? 'idle' : 'empty');
      } else {
        setResults([]);
        setStatus('error'); // unauthorized o fallo del proveedor (CA-8)
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, selected]);

  function choose(m: SymbolMatch) {
    setSelected(m);
    setOpen(false);
    setResults([]);
    setQuery('');
  }

  function clear() {
    setSelected(null);
    setQuery('');
    setResults([]);
    setStatus('idle');
  }

  if (selected) {
    return (
      <div className="symbol-picker">
        <span className="symbol-picker-label">Acción</span>
        <div className="symbol-chip">
          <div className="symbol-chip-main">
            <strong className="symbol-chip-tk">{selected.ticker}</strong>
            <span className="symbol-chip-name">{selected.name}</span>
          </div>
          <div className="symbol-chip-meta">
            <span>{selected.exchange || selected.micCode}</span>
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
          placeholder="Busca por nombre o ticker (p. ej. Microsoft)"
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
              <li className="symbol-hint symbol-hint-error">Búsqueda no disponible. Inténtalo de nuevo.</li>
            )}
            {status === 'empty' && <li className="symbol-hint">Sin resultados para «{query.trim()}».</li>}
            {results.map((m) => (
              <li key={`${m.ticker}:${m.micCode}`}>
                <button type="button" className="symbol-result" onClick={() => choose(m)}>
                  <span className="symbol-result-tk">
                    <strong>{m.ticker}</strong>
                    <span className="symbol-result-name">{m.name}</span>
                  </span>
                  <span className="symbol-result-meta">
                    {m.exchange || m.micCode} · {m.currency}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="symbol-picker-help">{helpText ?? 'Elige una acción de la lista.'}</p>
    </div>
  );
}
