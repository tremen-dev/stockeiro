import Link from 'next/link';
import { requireSectionUser } from '@/lib/auth/session';
import { db } from '@/db/client';
import { portfolioSummary } from '@/lib/portfolio/service';
import { getDiagnosticMap, getPriceMap, getQuoteViews } from '@/lib/market/quotes';
import { estaSinRefrescar } from '@/lib/market/sin-refrescar';
import { AppNav } from '../app-nav';
import { columnaEn, paresDeLaTarjeta } from '../columnas';
import { columnasDeCartera } from './columnas-cartera';
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
  // RN-06 / D-6: sin dato no se inventa un número. Aquí, para el total de la entradilla;
  // en las celdas, la MISMA regla vive en la descripción de columnas.
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

  /*
    SPEC-054 / ADR-034 §3 — **las dos representaciones salen de una sola descripción de
    columnas**. La `<table>` de siempre por encima de 720 px y una lista de tarjetas por
    debajo, alternadas por CSS con `display: none`. Ni un rótulo ni un valor se escriben
    dos veces: es lo único que impide que las dos formas se separen (F-ADR-034-2).

    Y `/cartera` **sigue siendo Server Component**: la conmutación es CSS, no `matchMedia`,
    así que esta pantalla se sigue pintando sin una línea de JavaScript (ADR-034 §3,
    alternativa rechazada).
  */
  const columnas = columnasDeCartera({ diagnosticos, escritaHace });
  const cabecera = columnaEn(columnas, 'cabecera');
  const pares = paresDeLaTarjeta(columnas);

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
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {columnas.map((c) => (
                      <th key={c.clave}>{c.rotulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.positions.map((p) => (
                    <tr key={p.symbolId}>
                      {columnas.map((c) => (
                        <td key={c.clave} className={c.claseCelda}>
                          {c.valor(p, 'tabla')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* La misma fila, leída como ficha. Sin fondo de estado —la cartera no tiene
                zonas— y sin pie de acciones: estas filas no tienen controles. */}
            <ul
              className="tarjetas tarjetas-cartera"
              data-testid="tarjetas-cartera"
              aria-label="Posiciones de la cartera"
            >
              {summary.positions.map((p) => (
                <li key={p.symbolId} className="tarjeta">
                  {cabecera && <div className="tarjeta-cabecera">{cabecera.valor(p, 'tarjeta')}</div>}
                  <dl className="tarjeta-datos">
                    {pares.map((c) => (
                      <div key={c.clave} className="tarjeta-par">
                        <dt>{c.rotulo}</dt>
                        <dd className={c.claseCelda}>{c.valor(p, 'tarjeta')}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </>
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
