import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/db/client';
import { zoneStatusForUser, type ZoneState } from '@/lib/watchlist/zone-status';
import { failReasonText } from '@/lib/market/fail-reason-text';
import { instrumentTypeText } from '@/lib/market/instrument-type-text';
import { marketName } from '@/lib/market/market-name';
import { CADENCIA_LINEA, RUTA_AYUDA, VACIO_VIGILADAS } from '@/lib/help/content';
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
          /*
            SPEC-039 CA-9 — el estado vacío GUÍA en vez de constatar. Antes decía
            «añade un ticker con su zona de compra y/o venta» y ya: correcto, y
            completamente insuficiente para quien no sabe qué es una zona en este
            producto, si el rango es de precio, ni cada cuánto se mira.

            Ahora lleva las cuatro cosas que CE-1 necesita: el primer paso (el
            formulario está justo debajo, no hay que buscarlo), un ejemplo CON
            NÚMEROS, la cadencia —la misma frase literal que la primera pantalla y la
            ayuda, CA-3— y el enlace a la explicación larga.

            La cadencia va aquí y no solo en la ayuda a propósito (R-4): esta es la
            pantalla donde alguien se queda mirando un precio que no cambia, y nadie
            lee la ayuda antes de quejarse.
          */
          <div className="empty" data-testid="vigiladas-vacio">
            <span className="empty-title">{VACIO_VIGILADAS.titulo}</span>
            <p>{VACIO_VIGILADAS.primerPaso}</p>
            <div className="empty-guia">
              <p className="empty-ejemplo" data-testid="vigiladas-vacio-ejemplo">
                {VACIO_VIGILADAS.ejemplo}
              </p>
              <p data-testid="vigiladas-vacio-cadencia">{CADENCIA_LINEA}</p>
              <p>
                <Link href={RUTA_AYUDA}>Cómo funciona Stockeiro</Link> — qué es una zona,
                cuándo dispara y cuándo llega el aviso.
              </p>
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  {/* SPEC-029: tipo (CA-13) y mercado (CA-14). El mercado sale de
                      `micCode` —la mitad de la identidad, ADR-012— y no de `exchange`,
                      que es texto libre del proveedor: con el mismo ticker en dos
                      mercados, esta celda es lo unico que distingue las dos filas
                      (cierra F-SPEC-024-1). Celda VACIA cuando no se sabe: ni «—» ni
                      un mercado inventado. */}
                  <th>Tipo</th>
                  <th>Mercado</th>
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
                    <td className="muted" data-testid="row-type">{instrumentTypeText(r.instrumentType)}</td>
                    <td className="muted" data-testid="row-market">{marketName(r.micCode)}</td>
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
                        {/* SPEC-024: viaja el id de la ACCIÓN VIGILADA (el mismo que la
                            fila usa como key), no el ticker: dos mercados del mismo ticker
                            son dos vigiladas distintas (ADR-007). */}
                        <input type="hidden" name="watchedId" value={r.id} />
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
