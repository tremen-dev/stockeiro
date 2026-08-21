'use client';

import { useMemo, useState } from 'react';
import { failReasonText } from '@/lib/market/fail-reason-text';
import { instrumentTypeText } from '@/lib/market/instrument-type-text';
import { marketName } from '@/lib/market/market-name';
import { marcaSinRefrescar } from '@/lib/market/sin-refrescar';
import type { ZoneStatusView, ZoneState } from '@/lib/watchlist/zone-status';
import {
  CRITERIOS_ORDEN,
  ordenarVigiladas,
  type ClaveOrden,
  type DireccionOrden,
} from '@/lib/watchlist/sort';
import { CADENCIA_LINEA } from '@/lib/help/content';
import { removeAction } from './actions';
import { WatchForm } from './watch-form';

/**
 * SPEC-041 — **la tabla de acciones vigiladas, ahora legible y ordenable**.
 *
 * ## Por qué es componente de cliente (y qué se pierde con ello)
 *
 * Ordenar exige JavaScript, y eso se dice en vez de esconderse (R-5): sin JS la tabla
 * se pinta en su orden por defecto —ticker ascendente, el de siempre— y no se reordena.
 * No es una regresión (el buscador de símbolos y el formulario de alta ya eran cliente,
 * esta pantalla nunca funcionó sin JS), pero sí una propiedad que se pierde a
 * conciencia.
 *
 * Lo que **no** se mueve al cliente es el cálculo: el `state` de cada fila lo computa el
 * servidor con `entraEnZona` (RN-11) y llega aquí ya resuelto. El cliente **sólo
 * ordena** (CA-10, CE-M1). Ordenar tampoco pide datos nuevos: lo que se serializa es
 * exactamente la salida de `zoneStatusForUser` para ese usuario (CA-20).
 *
 * ## Y por qué el control de orden va ENCIMA de la tabla, no en las cabeceras
 *
 * Porque las cabeceras viven dentro de `.table-scroll`, que en móvil desborda: la
 * cabecera `Estado` está fuera de la pantalla hasta que arrastras la tabla, así que el
 * gesto para ordenar exigiría un gesto para encontrarlo, justo donde menos sitio hay
 * (CA-11). Las cabeceras se marcan con `aria-sort` para que el lector de pantalla lo
 * cuente igual.
 */

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

const zona = (min: string | null, max: string | null) =>
  min !== null && max !== null ? `${min} – ${max}` : '—';

/** `aria-sort` del `<th>`: sólo la columna por la que se ordena AHORA lo declara. */
const ariaSort = (
  activa: boolean,
  direccion: DireccionOrden,
): 'ascending' | 'descending' | 'none' => (activa ? (direccion === 'asc' ? 'ascending' : 'descending') : 'none');

export function WatchedTable({ filas }: { filas: ZoneStatusView[] }) {
  const [clave, setClave] = useState<ClaveOrden>('ticker');
  const [direccion, setDireccion] = useState<DireccionOrden>('asc');
  /*
    SPEC-044 CA-24 — se guarda el **id** de la fila que se edita, nunca su posición. El
    control de orden reordena el array en el cliente, así que un índice señalaría a otra
    vigilada en cuanto alguien cambie el criterio: es el mismo motivo por el que la baja
    manda el id en un `hidden` desde SPEC-024 (ADR-007).
  */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  /*
    SPEC-044 CA-22 — la ventana de una cadencia es real y se DICE. Si la edición deja el
    precio dentro de una zona en la que no estaba, la fila lo enseña al instante (el
    estado se computa en render, SPEC-007 CA-1) pero el aviso llega con el ciclo siguiente
    (ADR-028 ptos. 4 y 5). Es la primera vez que esa espera la provoca un clic del
    usuario, así que se cuenta con la MISMA frase que la primera pantalla, `/ayuda` y el
    estado vacío (`CADENCIA_LINEA`, SPEC-039 CA-3) — ni una promesa de inmediatez, ni una
    frase nueva.
  */
  const [guardada, setGuardada] = useState(false);

  const ordenadas = useMemo(() => ordenarVigiladas(filas, clave, direccion), [filas, clave, direccion]);
  const enEdicion = filas.find((f) => f.id === editandoId) ?? null;

  // «Ticker» y «Nombre» ordenan por la MISMA columna de la tabla —el nombre vive bajo el
  // ticker, en la celda «Activo» (CA-2)—, así que las dos marcan ese `<th>`.
  const activoOrdenado = clave === 'ticker' || clave === 'name';

  return (
    <>
      <div className="orden-control" data-testid="orden-control">
        <label htmlFor="orden-criterio">Ordenar por</label>
        <select
          id="orden-criterio"
          data-testid="orden-criterio"
          value={clave}
          onChange={(e) => setClave(e.target.value as ClaveOrden)}
        >
          {CRITERIOS_ORDEN.map((c) => (
            <option key={c.clave} value={c.clave}>
              {c.etiqueta}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-sm"
          data-testid="orden-direccion"
          data-direccion={direccion}
          aria-pressed={direccion === 'desc'}
          onClick={() => setDireccion((d) => (d === 'asc' ? 'desc' : 'asc'))}
        >
          {direccion === 'asc' ? '↑ Ascendente' : '↓ Descendente'}
        </button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {/* SPEC-041 CA-2: el ticker sigue siendo el ancla y el nombre va DEBAJO,
                  en la misma celda. Ninguna columna nueva: la tabla ya tiene nueve y se
                  desborda en móvil, así que una décima empeoraría lo que venimos a
                  mejorar. La cabecera es «Activo» y no «Valor» (que junto a «Precio» se
                  lee como *value*) ni «Acción» (mentira desde ADR-020: hay REIT, ADR y
                  ETF). */}
              <th className="col-activo" aria-sort={ariaSort(activoOrdenado, direccion)}>
                Activo
              </th>
              {/* SPEC-029: tipo (CA-13) y mercado (CA-14). El mercado sale de
                  `micCode` —la mitad de la identidad, ADR-012— y no de `exchange`,
                  que es texto libre del proveedor: con el mismo ticker en dos
                  mercados, esta celda es lo unico que distingue las dos filas
                  (cierra F-SPEC-024-1). Celda VACIA cuando no se sabe: ni «—» ni
                  un mercado inventado. */}
              <th>Tipo</th>
              <th>Mercado</th>
              <th className="col-estado" aria-sort={ariaSort(clave === 'state', direccion)}>
                Estado
              </th>
              <th>Precio</th>
              <th>A fecha</th>
              <th>Zona compra</th>
              <th>Zona venta</th>
              <th aria-label="acciones"></th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((r) => {
              // CA-3: sin nombre NO se inventa un nombre. Ni «—», ni «Sin nombre», ni el
              // `exchange`, ni el ticker repetido: el elemento simplemente no se pinta.
              const nombre = (r.name ?? '').trim();
              return (
                <tr key={r.id} className={`zone-${r.state}`}>
                  <td>
                    <div className="activo-caja">
                      <span className="ticker">{r.ticker}</span>
                      {nombre !== '' && (
                        <span className="activo-nombre" data-testid="row-name">
                          {nombre}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="muted" data-testid="row-type">
                    {instrumentTypeText(r.instrumentType)}
                  </td>
                  <td className="muted" data-testid="row-market">
                    {marketName(r.micCode)}
                  </td>
                  <td>
                    {/* CA-4: la celda de estado deja de estirar la tabla. El culpable no
                        era la etiqueta —la más larga, «En compra y venta», cabe en una
                        línea— sino el párrafo del motivo de SPEC-016, que se extendía en
                        vez de envolverse. Ahora se envuelve DENTRO de su caja y no se
                        pierde ni una palabra. */}
                    <div className="estado-caja">
                      <span className={`zone-label is-${r.state}`} data-state={r.state}>
                        <span className="dot" aria-hidden="true" />
                        {LABEL[r.state]}
                      </span>
                      {r.state === 'none' && (
                        <p
                          className={r.failReason ? 'quote-fail' : 'quote-pending'}
                          data-testid={r.failReason ? 'fail-reason' : 'sin-datos-aun'}
                          data-reason={r.failReason ?? undefined}
                        >
                          {r.failReason
                            ? `⚠ No se vigila: ${failReasonText(r.failReason)}`
                            : SIN_DATO_AUN}
                        </p>
                      )}
                      {/* SPEC-043 CA-8 — **el defecto de esta spec vivía justo aquí**.
                          El aviso de SPEC-016 estaba condicionado a `r.state === 'none'`,
                          y una cotización que dejó de refrescarse SÍ tiene precio y SÍ
                          tiene estado de zona: decía «Fuera de zona» sobre un precio de
                          hace tres días y no lo advertía. La marca es INDEPENDIENTE del
                          estado — ésa es literalmente la corrección (RN-16, D-2).

                          Y sigue siendo excluyente con el bloque de arriba sin necesidad
                          de decirlo: sin cotización no hay `updatedAt`, y sin `updatedAt`
                          no se puede haber dejado de refrescar nada. */}
                      {r.sinRefrescar && r.updatedAt && (
                        <p
                          className="quote-stale"
                          data-testid="sin-refrescar"
                          data-reason={r.failReason ?? undefined}
                        >
                          {marcaSinRefrescar(r.updatedAt, r.failReason)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="num">{r.price ?? <span className="muted">—</span>}</td>
                  <td className="num muted">{r.asOf ? r.asOf.toISOString().slice(0, 10) : '—'}</td>
                  <td className="num">{zona(r.buyMin, r.buyMax)}</td>
                  <td className="num">{zona(r.sellMin, r.sellMax)}</td>
                  <td>
                    <div className="fila-acciones">
                      {/* SPEC-044 CA-19: el control de edición vive EN SU FILA y lleva el
                          id de esa fila. Reordenar no lo afecta, por el mismo motivo que
                          no afecta a «Quitar». */}
                      <button
                        className="btn-sm"
                        type="button"
                        data-testid="editar-zonas"
                        data-watched-id={r.id}
                        aria-expanded={editandoId === r.id}
                        aria-controls="editar-panel"
                        onClick={() => {
                          setGuardada(false);
                          setEditandoId(editandoId === r.id ? null : r.id);
                        }}
                      >
                        Editar
                      </button>
                      <form action={removeAction}>
                        {/* SPEC-024: viaja el id de la ACCIÓN VIGILADA (el mismo que la
                            fila usa como key), no el ticker: dos mercados del mismo ticker
                            son dos vigiladas distintas (ADR-007). Y por eso reordenar no lo
                            afecta (CA-18): lo que viaja es la identidad de SU fila, no su
                            posición en la lista. */}
                        <input type="hidden" name="watchedId" value={r.id} />
                        <button className="btn-sm" type="submit">
                          Quitar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/*
        El panel va FUERA de `.table-scroll`, y es deliberado. Dentro heredaría el ancho
        de la tabla y —peor— quedaría en el subárbol de un contenedor desplazable, donde
        M1 deja de medir (ADR-026 §4): el formulario podría salirse de la ventana sin que
        ninguna guardia lo viera. Fuera, se mide como el del alta y con la misma caja
        (SPEC-040), que es justo lo que pide CA-20.
      */}
      {enEdicion && (
        <div className="editar-vigilada" id="editar-panel" data-testid="editar-panel">
          <WatchForm
            // Cambiar de fila REMONTA el formulario: sin `key`, los campos no
            // controlados conservarían los valores de la vigilada anterior.
            key={enEdicion.id}
            edicion={{
              id: enEdicion.id,
              ticker: enEdicion.ticker,
              micCode: enEdicion.micCode,
              buyMin: enEdicion.buyMin,
              buyMax: enEdicion.buyMax,
              sellMin: enEdicion.sellMin,
              sellMax: enEdicion.sellMax,
              onGuardado: () => {
                setEditandoId(null);
                setGuardada(true);
              },
              onCancelar: () => setEditandoId(null),
            }}
          />
        </div>
      )}

      {guardada && !enEdicion && (
        <p className="editar-cadencia" data-testid="edicion-cadencia" role="status">
          {CADENCIA_LINEA}
        </p>
      )}
    </>
  );
}
