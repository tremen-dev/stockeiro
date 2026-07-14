import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { portfolioSummary } from '@/lib/portfolio/service';
import { getPriceMap, getQuoteViews } from '@/lib/market/quotes';
import { BuyForm, SellForm } from './portfolio-forms';

// Exposición de la cartera (SPEC-002) alimentada por la Ingesta (SPEC-004): el P/L
// actual usa el último cierre no ajustado ingerido (RN-06/RN-12). Sin cotización
// para un símbolo, ese P/L actual sigue "—" (D-6): no se calcula ni se mezcla.
export default async function CarteraPage() {
  const session = await auth();
  // Precios ingeridos por la ingesta diaria (CA-4). Sin cotización -> plActual "—".
  const priceByTicker = await getPriceMap(db);
  const summary = await portfolioSummary(db, session!.user.id, priceByTicker);
  const quotes = await getQuoteViews(db);
  const asOf = quotes.length
    ? new Date(Math.max(...quotes.map((q) => q.asOf.getTime()))).toISOString().slice(0, 10)
    : null;
  const dash = (v: string | null) => (v === null ? '—' : v);

  return (
    <main className="auth-wrap" style={{ placeContent: 'start', gap: 28 }}>
      <h1 className="headline">Tu cartera</h1>

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
        <p className="lede">Aún no has registrado operaciones.</p>
      ) : (
        <table>
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
                <td>{p.ticker}</td>
                <td>{p.cantidadViva}</td>
                <td>{dash(p.costeMedio)}</td>
                <td>{p.realizadoPL}</td>
                <td>{dash(p.plActual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <BuyForm />
        <SellForm />
      </div>

      <p className="lede">
        <Link href="/dashboard">← Volver al panel</Link>
      </p>
    </main>
  );
}
