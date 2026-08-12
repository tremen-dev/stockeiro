import { requireUser } from '@/lib/auth/session';
import { db } from '@/db/client';
import { zoneStatusForUser, type ZoneState } from '@/lib/watchlist/zone-status';
import { failReasonText } from '@/lib/market/fail-reason-text';
import { AppNav } from '../app-nav';
import { WatchForm } from './watch-form';
import { removeAction } from './actions';

// Acciones vigiladas con ESTADO DE ZONA (SPEC-007): el color de fondo de cada fila
// indica si su última cotización está en zona (compra/venta) o fuera; la etiqueta de
// texto lo acompaña para accesibilidad. El estado se computa con `entraEnZona` (RN-11).
const LABEL: Record<ZoneState, string> = {
  buy: 'En zona de compra',
  sell: 'En zona de venta',
  both: 'En compra y venta',
  out: 'Fuera de zona',
  none: 'Sin cotización',
};

// SPEC-016 (CE-F2): "sin cotización" ya no es mudo. Si el símbolo NO se puede cotizar, se
// dice y se explica por qué; si simplemente no ha corrido el ciclo, se dice eso otro. Antes
// ambos casos se veían igual — por eso el defecto de cobertura pasó semanas sin detectarse.
const SIN_DATO_AUN = 'Aún sin datos: se ingiere en el próximo ciclo diario';

export default async function VigiladasPage() {
  const user = await requireUser(); // SPEC-023 CA-13: sesión revocada -> login
  const rows = await zoneStatusForUser(db, user.id);
  const zona = (min: string | null, max: string | null) =>
    min !== null && max !== null ? `${min} – ${max}` : '—';

  return (
    <>
      <AppNav active="vigiladas" />
      <main className="page">
        <div className="page-head">
          <span className="eyebrow">Vigiladas</span>
          <h1 className="headline">Acciones vigiladas</h1>
          <p className="sub">
            El color de cada fila indica su estado de zona según la última cotización (precio de
            cierre no ajustado, con su fecha).
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <span className="empty-title">Aún no vigilas ninguna acción</span>
            <p>Añade un ticker con su zona de compra y/o venta para empezar a vigilarlo.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Estado</th>
                  <th>Precio</th>
                  <th>A fecha</th>
                  <th>Zona compra</th>
                  <th>Zona venta</th>
                  <th aria-label="acciones"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`zone-${r.state}`}>
                    <td className="ticker">{r.ticker}</td>
                    <td>
                      <span
                        className={`zone-label is-${r.state}`}
                        data-state={r.state}
                      >
                        <span className="dot" aria-hidden="true" />
                        {LABEL[r.state]}
                      </span>
                      {r.state === 'none' && (
                        <p
                          className={r.failReason ? 'quote-fail' : 'quote-pending'}
                          data-testid={r.failReason ? 'fail-reason' : 'sin-datos-aun'}
                          data-reason={r.failReason ?? undefined}
                        >
                          {r.failReason ? `⚠ No se vigila: ${failReasonText(r.failReason)}` : SIN_DATO_AUN}
                        </p>
                      )}
                    </td>
                    <td className="num">{r.price ?? <span className="muted">—</span>}</td>
                    <td className="num muted">{r.asOf ? r.asOf.toISOString().slice(0, 10) : '—'}</td>
                    <td className="num">{zona(r.buyMin, r.buyMax)}</td>
                    <td className="num">{zona(r.sellMin, r.sellMax)}</td>
                    <td>
                      <form action={removeAction}>
                        <input type="hidden" name="ticker" value={r.ticker} />
                        <button className="btn-sm" type="submit">
                          Quitar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <WatchForm />
      </main>
    </>
  );
}
