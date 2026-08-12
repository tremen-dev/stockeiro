import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/db/client';
import { portfolioSummary } from '@/lib/portfolio/service';
import { getDiagnosticMap, getPriceMap, getQuoteViews } from '@/lib/market/quotes';
import { failReasonText } from '@/lib/market/fail-reason-text';
import { AppNav } from '../app-nav';
import { BuyForm, SellForm } from './portfolio-forms';

// Exposición de la cartera (SPEC-002) alimentada por la Ingesta (SPEC-004): el P/L
// actual usa el último cierre no ajustado ingerido (RN-06/RN-12). Sin cotización
// para un símbolo, ese P/L actual sigue "—" (D-6). SPEC-007: nav compartida + estilo.
export default async function CarteraPage() {
  const user = await requireUser(); // SPEC-023 CA-13: sesión revocada -> login
  const priceByTicker = await getPriceMap(db);
  const summary = await portfolioSummary(db, user.id, priceByTicker);
  const quotes = await getQuoteViews(db);
  const asOf = quotes.length
    ? new Date(Math.max(...quotes.map((q) => q.asOf.getTime()))).toISOString().slice(0, 10)
    : null;
  const dash = (v: string | null) => (v === null ? '—' : v);
  // SPEC-016: el P/L actual sigue siendo "—" cuando no hay precio (RN-06: no se inventa),
  // pero deja de ser un guion MUDO — se acompaña del motivo si el símbolo no se puede cotizar.
  const diagnosticos = await getDiagnosticMap(db);

  return (
    <>
      <AppNav active="cartera" />
      <main className="page">
        <div className="page-head page-head-row">
          <div>
            <span className="eyebrow">Cartera</span>
            <h1 className="headline">Tu cartera</h1>
          </div>
          <Link href="/cartera/importar" className="btn" data-testid="importar-cta">
            Importar extracto
          </Link>
        </div>

        <section className="lede">
          <p>
            P/L realizado total: <strong>{summary.realizadoTotal}</strong> · P/L actual total:{' '}
            <strong>{dash(summary.actualTotal)}</strong>{' '}
            {asOf ? (
              <em>(cotizaciones a fecha {asOf})</em>
            ) : (
              <em>(sin cotización aún; se ingiere a diario)</em>
            )}
          </p>
        </section>

        {summary.positions.length === 0 ? (
          <div className="empty">
            <span className="empty-title">Aún no has registrado operaciones</span>
            <p>Registra una compra abajo para ver tu posición y tu P/L.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Cantidad viva</th>
                  <th>Coste medio</th>
                  <th>P/L realizado</th>
                  <th>P/L actual</th>
                </tr>
              </thead>
              <tbody>
                {summary.positions.map((p) => (
                  <tr key={p.ticker}>
                    <td className="ticker">{p.ticker}</td>
                    <td className="num">{p.cantidadViva}</td>
                    <td className="num">{dash(p.costeMedio)}</td>
                    <td className="num">{p.realizadoPL}</td>
                    <td className="num">
                      {dash(p.plActual)}
                      {p.plActual === null && diagnosticos[p.ticker] && (
                        <span
                          className="quote-fail"
                          data-testid="fail-reason"
                          data-reason={diagnosticos[p.ticker].reason}
                        >
                          ⚠ {failReasonText(diagnosticos[p.ticker].reason)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <BuyForm />
          <SellForm />
        </div>
      </main>
    </>
  );
}
