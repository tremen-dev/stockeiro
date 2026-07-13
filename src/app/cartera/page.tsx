import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { portfolioSummary } from '@/lib/portfolio/service';
import { BuyForm, SellForm } from './portfolio-forms';

// Exposición mínima de la cartera (SPEC-002). Sin ingesta aún, el P/L actual se
// muestra "—" (RN-06/D-6): sin cotización no se calcula ni se mezcla con el realizado.
export default async function CarteraPage() {
  const session = await auth();
  const summary = await portfolioSummary(db, session!.user.id);
  const dash = (v: string | null) => (v === null ? '—' : v);

  return (
    <main className="auth-wrap" style={{ placeContent: 'start', gap: 28 }}>
      <h1 className="headline">Tu cartera</h1>

      <section className="lede">
        <p>
          P/L realizado total: <strong>{summary.realizadoTotal}</strong> · P/L actual total:{' '}
          <strong>{dash(summary.actualTotal)}</strong>{' '}
          <em>(sin cotización aún; llega con la Ingesta)</em>
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
