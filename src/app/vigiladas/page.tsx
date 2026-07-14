import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { listWatched } from '@/lib/watchlist/service';
import { WatchForm } from './watch-form';
import { removeAction } from './actions';

// Exposición mínima de las acciones vigiladas (SPEC-003). La evaluación de zonas
// contra precios reales llega con la Ingesta + Motor de disparo (specs propias).
export default async function VigiladasPage() {
  const session = await auth();
  const watched = await listWatched(db, session!.user.id);
  const zona = (min: string | null, max: string | null) =>
    min !== null && max !== null ? `${min} – ${max}` : '—';

  return (
    <main className="auth-wrap" style={{ placeContent: 'start', gap: 28 }}>
      <h1 className="headline">Acciones vigiladas</h1>

      {watched.length === 0 ? (
        <p className="lede">Aún no vigilas ninguna acción.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Zona de compra</th>
              <th>Zona de venta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {watched.map((w) => (
              <tr key={w.id}>
                <td>{w.ticker}</td>
                <td>{zona(w.buyMin, w.buyMax)}</td>
                <td>{zona(w.sellMin, w.sellMax)}</td>
                <td>
                  <form action={removeAction}>
                    <input type="hidden" name="ticker" value={w.ticker} />
                    <button className="btn-link" type="submit">
                      Quitar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <WatchForm />

      <p className="lede">
        <Link href="/dashboard">← Volver al panel</Link>
      </p>
    </main>
  );
}
