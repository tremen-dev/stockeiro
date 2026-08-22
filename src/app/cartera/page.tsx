import Link from 'next/link';
import { requireSectionUser } from '@/lib/auth/session';
import { db } from '@/db/client';
import { portfolioSummary } from '@/lib/portfolio/service';
import { getDiagnosticMap, getPriceMap, getQuoteViews } from '@/lib/market/quotes';
import { failReasonText } from '@/lib/market/fail-reason-text';
import { estaSinRefrescar, marcaSinRefrescar } from '@/lib/market/sin-refrescar';
import { AppNav } from '../app-nav';
import { BuyForm, SellForm } from './portfolio-forms';

// Exposición de la cartera (SPEC-002) alimentada por la Ingesta (SPEC-004): el P/L
// actual usa el último cierre no ajustado ingerido (RN-06/RN-12). Sin cotización
// para un símbolo, ese P/L actual sigue "—" (D-6). SPEC-007: nav compartida + estilo.
export default async function CarteraPage() {
  // SPEC-023 CA-13: sesión revocada -> login. SPEC-034 CA-6: rol sin Cartera -> panel
  // con la nota, y sin servir NI UN DATO por el camino (ADR-021 pto. 6).
  const user = await requireSectionUser('cartera');
  // SPEC-025: precios y diagnósticos van indexados por `symbolId`, no por ticker: con
  // el mismo ticker en dos mercados, la clave por ticker valoraba las dos posiciones
  // con el mismo precio (y con la divisa de una sola).
  const priceBySymbolId = await getPriceMap(db);
  const summary = await portfolioSummary(db, user.id, priceBySymbolId);
  const quotes = await getQuoteViews(db);
  const asOf = quotes.length
    ? new Date(Math.max(...quotes.map((q) => q.asOf.getTime()))).toISOString().slice(0, 10)
    : null;
  const dash = (v: string | null) => (v === null ? '—' : v);
  // SPEC-016: el P/L actual sigue siendo "—" cuando no hay precio (RN-06: no se inventa),
  // pero deja de ser un guion MUDO — se acompaña del motivo si el símbolo no se puede cotizar.
  const diagnosticos = await getDiagnosticMap(db);
  // SPEC-043 CA-9/CA-12: qué cotizaciones dejó de reescribir el ciclo (RN-16). Sale de
  // `quotes` que la página YA tenía cargadas —ni una consulta más— y se decide con la
  // MISMA función que usa `/vigiladas`: un solo umbral, un solo sitio.
  const escritaHace: Record<string, Date> = {};
  for (const q of quotes) {
    if (estaSinRefrescar(q.updatedAt)) escritaHace[q.symbolId] = q.updatedAt;
  }

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
                  <tr key={p.symbolId}>
                    <td className="ticker">{p.ticker}</td>
                    <td className="num">{p.cantidadViva}</td>
                    <td className="num">{dash(p.costeMedio)}</td>
                    <td className="num">{p.realizadoPL}</td>
                    <td className="num">
                      {dash(p.plActual)}
                      {p.plActual === null && diagnosticos[p.symbolId] && (
                        <span
                          className="quote-fail"
                          data-testid="fail-reason"
                          data-reason={diagnosticos[p.symbolId].reason}
                        >
                          ⚠ {failReasonText(diagnosticos[p.symbolId].reason)}
                        </span>
                      )}
                      {/* SPEC-043 CA-9 — la otra mitad del defecto. El motivo estaba
                          condicionado a `p.plActual === null`, y con una cotización que
                          dejó de refrescarse el P/L actual TIENE número: se calcula
                          igual (RN-06 no cambia, CA-13) sobre un precio de hace días.
                          La marca no depende de que el P/L falte — depende de que el
                          precio no se esté actualizando. */}
                      {escritaHace[p.symbolId] && (
                        <span
                          className="quote-stale"
                          data-testid="sin-refrescar"
                          data-reason={diagnosticos[p.symbolId]?.reason}
                        >
                          {marcaSinRefrescar(escritaHace[p.symbolId], diagnosticos[p.symbolId]?.reason)}
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
          {/* SPEC-025 CA-8: la venta se elige de la lista de posiciones que la página
              ya tiene (sin consulta nueva); es la única forma de decir SOBRE QUÉ
              mercado se vende cuando el ticker vive en dos. */}
          <SellForm positions={summary.positions} />
        </div>
      </main>
    </>
  );
}
