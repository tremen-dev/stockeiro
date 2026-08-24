'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { marketName } from '@/lib/market/market-name';
import type { ZoneStatusView } from '@/lib/watchlist/zone-status';
import {
  CRITERIOS_ORDEN,
  ordenarVigiladas,
  type ClaveOrden,
  type DireccionOrden,
} from '@/lib/watchlist/sort';
import { CADENCIA_LINEA } from '@/lib/help/content';
import { columnaEn, paresDeLaTarjeta } from '../columnas';
import { columnasDeVigiladas } from './columnas-vigiladas';
import { WatchForm } from './watch-form';

/**
 * SPEC-041 / SPEC-054 — **la tabla de acciones vigiladas, que en un teléfono se lee como
 * tarjetas**.
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
 * Porque las cabeceras viven dentro de `.table-scroll`, que en la vista ancha desborda:
 * la cabecera `Estado` está fuera de la pantalla hasta que arrastras la tabla, así que el
 * gesto para ordenar exigiría un gesto para encontrarlo (SPEC-041 CA-11). Las cabeceras
 * se marcan con `aria-sort` para que el lector de pantalla lo cuente igual.
 *
 * **SPEC-054 confirma ese motivo en vez de invalidarlo, y lo amplía**: por debajo de
 * 720 px la tabla no está en el árbol de accesibilidad, así que `aria-sort` no está —
 * anunciar el orden de una tabla que quien escucha no puede alcanzar es informar sobre
 * nada (ADR-034 §4). El estado de orden lo sigue diciendo `.orden-control`, que es
 * visible **a todos los anchos**.
 *
 * ## Los dos árboles (ADR-034 §3)
 *
 * Esta pantalla monta la fila **dos veces** —`<table>` y `<ul>` de tarjetas— y el
 * `@media (max-width: 720px)` de `globals.css` oculta la que no toca con `display: none`.
 * Las dos salen de **una sola descripción de columnas** (`columnas-vigiladas.tsx`), que
 * es lo único que impide que se separen cuando alguien añada una columna. `display: none`
 * importa por dos motivos a la vez: retira del árbol de accesibilidad —así que en cada
 * ancho hay UNA representación, no dos— y deja la caja a 0 × 0, con lo que M1 la salta y
 * la representación oculta no ensucia el recuento (`tests/e2e/geometria.ts`).
 */

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

  const ordenadas = useMemo(
    () => ordenarVigiladas(filas, clave, direccion),
    [filas, clave, direccion],
  );
  const enEdicion = filas.find((f) => f.id === editandoId) ?? null;

  /*
    SPEC-046 / ADR-030 §2 — la capa es un `<dialog>` NATIVO abierto con `showModal()`.

    Foco que entra al abrir, **Escape** que cierra, fondo inerte, capa superior y
    `::backdrop` los da la plataforma. Un `<div role="dialog">` con trampa de foco
    escrita a mano sería más código, peor accesibilidad y una fuente de defectos propia.

    Lo que la plataforma NO da y aquí se añade: el nombre accesible que nombra al activo,
    y el foco que **vuelve al control que la abrió**. Ese retorno es lo que reubica al
    usuario en su fila sin que nadie desplace nada — que es media medida de M4. Y desde
    SPEC-054 vale igual sobre una tarjeta que sobre una fila: la capa no se mueve, lo
    único que cambia es sobre qué se abre (ADR-034, «no toca ADR-030»).
  */
  const dialogo = useRef<HTMLDialogElement>(null);
  const disparador = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const capa = dialogo.current;
    if (capa && !capa.open) capa.showModal();
  }, [editandoId]);

  function abrir(id: string, boton: HTMLButtonElement) {
    disparador.current = boton;
    setGuardada(false);
    setEditandoId(id);
  }

  /*
    Cerrar es, en este orden: soltar el modo modal, olvidar la fila y devolver el foco.

    El orden importa y no es estético: mientras la capa está en modo modal el resto del
    documento es **inerte**, así que enfocar el disparador ANTES de `close()` no haría
    nada. Y `close()` es síncrono, con lo que el foco se puede devolver aquí mismo, sin
    esperar al repintado — el botón nunca se desmonta.
  */
  function cerrar() {
    dialogo.current?.close();
    setEditandoId(null);
    setGuardada(false);
    disparador.current?.focus();
  }

  const nombreDeLaCapa = enEdicion
    ? `Editar zonas de ${enEdicion.ticker}` +
      (marketName(enEdicion.micCode) !== '' ? ` · ${marketName(enEdicion.micCode)}` : '')
    : '';

  // «Ticker» y «Nombre» ordenan por la MISMA columna de la tabla —el nombre vive bajo el
  // ticker, en la celda «Activo» (CA-2)—, así que las dos marcan ese `<th>`.
  const columnas = columnasDeVigiladas({
    activoOrdenado: clave === 'ticker' || clave === 'name',
    estadoOrdenado: clave === 'state',
    direccion,
    abrir,
  });
  const cabecera = columnaEn(columnas, 'cabecera');
  const estado = columnaEn(columnas, 'estado');
  const acciones = columnaEn(columnas, 'acciones');
  const pares = paresDeLaTarjeta(columnas);

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

      {/* ── La tabla: la representación de 721 px para arriba ─────────────────── */}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th
                  key={c.clave}
                  className={c.claseCabecera}
                  aria-label={c.rotulo === '' ? c.ariaLabel : undefined}
                  aria-sort={c.ariaSort}
                >
                  {c.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((r) => (
              /*
                SPEC-046 CA-3 — la fila que se está editando queda MARCADA mientras la
                capa está abierta. La capa se ancla a la ventana, así que ya no está
                pegada a su fila: detrás del velo hay que poder encontrar de cuál se
                está hablando, y encontrarla sola al cerrar. Se dice en el árbol
                (`data-editando`) y se ve en pantalla (`.fila-editando`).
              */
              <tr
                key={r.id}
                className={`zone-${r.state}${editandoId === r.id ? ' fila-editando' : ''}`}
                data-editando={editandoId === r.id ? 'true' : undefined}
              >
                {columnas.map((c) => (
                  <td key={c.clave} className={c.claseCelda}>
                    {c.valor(r, 'tabla')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Las tarjetas: la representación de 720 px para abajo ──────────────────

          Mismo contenido, mismo orden de filas y los mismos rótulos; lo que cambia es el
          marcado, que aquí es el nativamente correcto para lo que hay: una LISTA de
          fichas, no una tabla. Los pares van en un `<dl>` con un `<dt>` por `<dd>`, que
          es lo que sustituye a la asociación cabecera-celda sin una sola línea de ARIA
          (ADR-034 §4).

          El orden del DOM es el del boceto —identidad → estado → pares → acciones— y no
          hay ni una propiedad de CSS reordenando nada dentro de la tarjeta, así que el
          orden visual, el del lector de pantalla y el del tabulador son el mismo
          (SPEC-054 CA-9). */}
      <ul
        className="tarjetas tarjetas-vigiladas"
        data-testid="tarjetas-vigiladas"
        aria-label="Acciones vigiladas"
      >
        {ordenadas.map((r) => (
          <li
            key={r.id}
            className={`tarjeta zone-${r.state}${editandoId === r.id ? ' fila-editando' : ''}`}
            data-editando={editandoId === r.id ? 'true' : undefined}
          >
            {/* El estado de zona ES el fondo de la tarjeta, con la MISMA clase
                `zone-${state}` y por tanto el mismo color computado que el `<tr>`
                (SPEC-007: color de fondo, no distintivo; ADR-034 §5). */}
            {cabecera && <div className="tarjeta-cabecera">{cabecera.valor(r, 'tarjeta')}</div>}
            {estado && <div className="tarjeta-estado">{estado.valor(r, 'tarjeta')}</div>}
            <dl className="tarjeta-datos">
              {pares.map((c) => (
                <div key={c.clave} className="tarjeta-par">
                  <dt>{c.rotulo}</dt>
                  <dd className={c.claseCelda}>{c.valor(r, 'tarjeta')}</dd>
                </div>
              ))}
            </dl>
            {acciones && acciones.valor(r, 'tarjeta')}
          </li>
        ))}
      </ul>

      {/*
        SPEC-046 / ADR-030 §1 — **la capa vive anclada a la VENTANA, no en el flujo detrás
        de la lista**.

        SPEC-044 la ponía fuera de `.table-scroll` y **después de la tabla entera**. La
        primera mitad era y sigue siendo correcta: dentro heredaría el ancho de una tabla
        de nueve columnas y quedaría en el subárbol de un contenedor desplazable, donde M1
        deja de medir (ADR-026 §4). La segunda mitad era el defecto, y **nadie la había
        medido**: con la superficie en un punto fijo del flujo, la distancia entre el gesto
        y su respuesta **crece con la lista**. Con cuarenta filas, pulsar *Editar* en la
        primera abría el formulario muy por debajo del pliegue y, para el usuario, el botón
        no hacía nada.

        Con la caja definida respecto al viewport, «lista larga», «fila de arriba» y
        «página desplazada» dejan de ser variables: no hay un tamaño de lista a partir del
        cual el defecto vuelva. Y sigue **fuera de `.table-scroll`** y fuera de la lista de
        tarjetas, así que lo que SPEC-044 protegía no se toca (CA-4b).

        Se ancla ABAJO y no al centro: el pulgar está abajo, una hoja inferior crece en una
        sola dirección —así que «no cabe a lo alto» se resuelve acotándola y desplazándola
        por dentro— y lo que queda a la vista por encima es la **parte alta de la lista**,
        que es donde vive el caso que originó todo esto.
      */}
      {enEdicion && (
        <dialog
          ref={dialogo}
          className="editar-vigilada"
          id="editar-panel"
          data-testid="editar-panel"
          // La capa dice de qué activo habla: una que no lo diga reintroduce el problema
          // en su versión semántica (ADR-030 §2).
          aria-label={nombreDeLaCapa}
          // Escape lo maneja la plataforma; se intercepta sólo para pasar por `cerrar` y
          // que el foco vuelva a su fila por el mismo camino que guardar y cancelar.
          onCancel={(e) => {
            e.preventDefault();
            cerrar();
          }}
        >
          {guardada ? (
            /*
              SPEC-046 CA-13 — **la confirmación se lee donde se hizo el gesto**.

              Antes, la frase de cadencia se pintaba al final del documento con
              `role="status"`: se anunciaba al lector de pantalla y era **invisible** para
              quien mira, porque con cuarenta filas queda tan abajo como quedaba el panel.
              Era el mismo defecto que esta spec arregla, en su segunda instancia
              (ADR-030 §6).

              La capa **no se cierra sola**: la cierra el usuario. Lo decidió el humano en
              el gate del 2026-08-22 frente a la alternativa de cierre automático más
              franja anclada, y la consecuencia —**un clic más por edición**— se acepta a
              sabiendas. La frase es la MISMA constante que la primera pantalla, `/ayuda` y
              el estado vacío (`CADENCIA_LINEA`, SPEC-039 CA-3): ni una promesa de
              inmediatez, ni una frase nueva.
            */
            <div className="card auth-form editar-confirmacion" data-testid="editar-confirmacion">
              <strong>Zonas guardadas</strong>
              <p className="editar-cadencia" data-testid="edicion-cadencia" role="status">
                {CADENCIA_LINEA}
              </p>
              {/* `autoFocus`: al desaparecer el formulario, el foco se quedaría sin sitio
                  DENTRO de una capa modal. Aquí tiene dónde caer, y es lo que hay que
                  pulsar. */}
              <button
                className="btn primary"
                type="button"
                data-testid="editar-cerrar"
                autoFocus
                onClick={cerrar}
              >
                Entendido
              </button>
            </div>
          ) : (
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
                // Guardar ya NO cierra: enseña la confirmación en la misma capa (CA-13).
                onGuardado: () => setGuardada(true),
                onCancelar: cerrar,
              }}
            />
          )}
        </dialog>
      )}
    </>
  );
}
