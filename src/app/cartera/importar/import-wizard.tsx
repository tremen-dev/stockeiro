'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { SymbolSearch } from '@/app/_components/symbol-search';
import type { SymbolMatch } from '@/lib/market/search-provider';
import type { OperacionImportada } from '@/lib/import/statement-reader';
import type { ImportPreview, ImportResult } from '@/lib/import/register';
import {
  readStatementAction,
  resolveAction,
  confirmSelectionAction,
  fuseAction,
  previewAction,
  confirmImportAction,
  type ValorResolucionUI,
} from './actions';

type Step = 1 | 2 | 3 | 4;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Subir' },
  { n: 2, label: 'Resolver' },
  { n: 3, label: 'Confirmar' },
];

const keyOf = (v: { nombreBroker: string; etiquetaMercado: string }) => `${v.nombreBroker}|${v.etiquetaMercado}`;
const estaResuelto = (r: ValorResolucionUI) => r.estado === 'remembered';

export function ImportWizard() {
  const [step, setStep] = useState<Step>(1);
  const [operaciones, setOperaciones] = useState<OperacionImportada[]>([]);
  const [summary, setSummary] = useState<{ numOperaciones: number; numValores: number; titular: string } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [resoluciones, setResoluciones] = useState<ValorResolucionUI[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  function reemplazaValor(k: string, patch: Partial<ValorResolucionUI>) {
    setResoluciones((prev) => prev.map((r) => (keyOf(r) === k ? { ...r, ...patch } : r)));
  }

  async function onSubir(formData: FormData) {
    setReadError(null);
    const res = await readStatementAction(formData);
    if (!res.ok) {
      setReadError(res.error);
      return;
    }
    setOperaciones(res.operaciones);
    setSummary({ numOperaciones: res.numOperaciones, numValores: res.numValores, titular: res.titular });
    const resol = await resolveAction(res.operaciones);
    if (resol.ok) setResoluciones(resol.resoluciones);
    setStep(2);
  }

  async function elegir(r: ValorResolucionUI, m: SymbolMatch) {
    const out = await confirmSelectionAction(r.nombreBroker, r.etiquetaMercado, m);
    if (out.ok) {
      reemplazaValor(keyOf(r), {
        estado: 'remembered',
        symbolId: out.symbolId,
        symbolInfo: { ticker: m.ticker, micCode: m.micCode, name: m.name, currency: m.currency },
        fused: out.fused,
        candidatos: undefined,
      });
    }
  }

  async function fusionar(r: ValorResolucionUI, destino: ValorResolucionUI) {
    if (!destino.symbolId) return;
    const out = await fuseAction(r.nombreBroker, r.etiquetaMercado, destino.symbolId);
    if (out.ok) {
      reemplazaValor(keyOf(r), {
        estado: 'remembered',
        symbolId: destino.symbolId,
        symbolInfo: destino.symbolInfo,
        fused: true,
        candidatos: undefined,
      });
    }
  }

  async function irAPrevisualizar() {
    const res = await previewAction(operaciones);
    if (res.ok) {
      setPreview(res.preview);
      setStep(3);
    }
  }

  async function confirmar() {
    const res = await confirmImportAction(operaciones);
    if (res.ok) {
      setResult(res.result);
      setStep(4);
    }
  }

  const resueltos = resoluciones.filter(estaResuelto);
  const pendientesCount = resoluciones.filter((r) => !estaResuelto(r)).length;

  return (
    <section className="import-wizard">
      <ol className="import-steps" aria-label="Pasos">
        {STEPS.map((s) => (
          <li key={s.n} className={step >= s.n ? 'done' : undefined} aria-current={step === s.n ? 'step' : undefined}>
            <span className="import-step-n">{s.n}</span> {s.label}
          </li>
        ))}
      </ol>

      {/* Paso 1 — Subir */}
      {step === 1 && (
        <form
          className="card"
          data-testid="step-upload"
          action={(fd) => start(() => onSubir(fd))}
        >
          <strong>Sube tu extracto</strong>
          <label>
            Fichero del bróker (.xls)
            <input type="file" name="file" accept=".xls,application/vnd.ms-excel" required data-testid="file-input" />
          </label>
          {readError && (
            <p className="auth-error" data-testid="read-error">
              {readError}
            </p>
          )}
          <button className="btn primary" type="submit" disabled={pending} data-testid="read-btn">
            {pending ? 'Leyendo…' : 'Leer extracto'}
          </button>
        </form>
      )}

      {/* Paso 2 — Resolver */}
      {step === 2 && (
        <div data-testid="step-resolve">
          {summary && (
            <p className="lede" data-testid="summary">
              Detectadas <strong>{summary.numOperaciones}</strong> operaciones en{' '}
              <strong>{summary.numValores}</strong> valores. Resuelve los que falten y continúa.
            </p>
          )}
          <ul className="import-valores">
            {resoluciones.map((r) => {
              const k = keyOf(r);
              return (
                <li key={k} className="card import-valor" data-testid="valor-row" data-valor={r.nombreBroker}>
                  <div className="import-valor-head">
                    <div>
                      <strong>{r.nombreBroker}</strong>
                      <span className="import-valor-mkt">{r.etiquetaMercado}</span>
                    </div>
                    {estaResuelto(r) ? (
                      <span className="pill import-ok" data-testid="valor-ok">
                        → {r.symbolInfo?.ticker ?? 'resuelto'} {r.symbolInfo?.currency ? `· ${r.symbolInfo.currency}` : ''}
                      </span>
                    ) : (
                      <span className="pill import-pending" data-testid="valor-pending">
                        Pendiente
                      </span>
                    )}
                  </div>

                  {r.fused && (
                    <p className="import-warn" data-testid="fuse-warn">
                      ⚠ Fusionado con otro nombre del mismo valor. Si hubo un split/contrasplit,
                      regístralo a mano en la cartera para cuadrar la cantidad.
                    </p>
                  )}

                  {r.estado === 'ambiguous' && r.candidatos && (
                    <div className="import-candidatos" data-testid="candidatos">
                      <span className="import-hint">Varios mercados coinciden — elige uno:</span>
                      {r.candidatos.map((c) => (
                        <button
                          key={`${c.ticker}:${c.micCode}`}
                          type="button"
                          className="btn"
                          onClick={() => start(() => elegir(r, c))}
                        >
                          {c.ticker} · {c.exchange || c.micCode} · {c.currency}
                        </button>
                      ))}
                    </div>
                  )}

                  {!estaResuelto(r) && r.estado !== 'ambiguous' && (
                    <div className="import-resolver">
                      <SymbolSearch
                        helpText="Busca el valor por su nombre y elígelo."
                        placeholder="Busca la acción (p. ej. Apple)"
                        onSelect={(m) => start(() => elegir(r, m))}
                      />
                      {resueltos.length > 0 && (
                        <label className="import-fuse">
                          …o es el mismo que
                          <select
                            defaultValue=""
                            data-testid="fuse-select"
                            onChange={(e) => {
                              const dest = resoluciones.find((x) => keyOf(x) === e.target.value);
                              if (dest) start(() => fusionar(r, dest));
                            }}
                          >
                            <option value="" disabled>
                              elige un valor ya resuelto
                            </option>
                            {resueltos.map((x) => (
                              <option key={keyOf(x)} value={keyOf(x)}>
                                {x.nombreBroker} ({x.symbolInfo?.ticker})
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="import-actions">
            {pendientesCount > 0 && (
              <span className="import-hint" data-testid="pending-note">
                {pendientesCount} valor(es) quedarán sin importar (pendientes).
              </span>
            )}
            <button
              className="btn primary"
              type="button"
              disabled={pending}
              data-testid="preview-btn"
              onClick={() => start(irAPrevisualizar)}
            >
              Previsualizar
            </button>
          </div>
        </div>
      )}

      {/* Paso 3 — Previsualizar / Confirmar */}
      {step === 3 && preview && (
        <div data-testid="step-preview">
          <div className="import-buckets">
            <div className="card import-bucket">
              <span className="import-bucket-n" data-testid="count-crear">
                {preview.aCrear.length}
              </span>
              <span>a crear</span>
            </div>
            <div className="card import-bucket">
              <span className="import-bucket-n" data-testid="count-saltar">
                {preview.aSaltar.length}
              </span>
              <span>ya importadas (se saltan)</span>
            </div>
            <div className="card import-bucket">
              <span className="import-bucket-n" data-testid="count-pendientes">
                {preview.pendientes.length}
              </span>
              <span>pendientes (sin resolver)</span>
            </div>
          </div>

          {preview.avisos.length > 0 && (
            <ul className="import-avisos" data-testid="avisos">
              {preview.avisos.map((a, i) => (
                <li key={i} className="import-warn" data-testid="aviso">
                  ⚠ {a}
                </li>
              ))}
            </ul>
          )}

          <div className="import-actions">
            <button className="btn" type="button" onClick={() => setStep(2)} disabled={pending}>
              ← Volver
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={pending || preview.aCrear.length === 0}
              data-testid="confirm-btn"
              onClick={() => start(confirmar)}
            >
              {pending ? 'Importando…' : `Confirmar e importar ${preview.aCrear.length}`}
            </button>
          </div>
        </div>
      )}

      {/* Paso 4 — Resultado */}
      {step === 4 && result && (
        <div className="card" data-testid="step-done">
          <strong>Import completado</strong>
          <p data-testid="result">
            Creadas <strong>{result.creadas}</strong> · saltadas <strong>{result.saltadas}</strong> · pendientes{' '}
            <strong>{result.pendientes}</strong>.
          </p>
          {result.avisos.length > 0 && (
            <ul className="import-avisos">
              {result.avisos.map((a, i) => (
                <li key={i} className="import-warn">
                  ⚠ {a}
                </li>
              ))}
            </ul>
          )}
          <Link className="btn primary" href="/cartera" data-testid="go-cartera">
            Ver mi cartera
          </Link>
        </div>
      )}
    </section>
  );
}
