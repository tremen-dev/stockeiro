'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { watchAction, editZonesAction, type FormState } from './actions';
import { SymbolSearch } from '@/app/_components/symbol-search';
import { marketName } from '@/lib/market/market-name';

/**
 * El formulario de zonas, con **dos modos y una sola caja**.
 *
 * ## Por qué la edición reutiliza este componente (SPEC-044 CA-20)
 *
 * No es pereza: es lo que hace verdad, **por construcción**, que «la edición no puede
 * tener validación más floja que el alta». Si un día alguien afloja algo, lo afloja para
 * las dos y lo cazan los tests de SPEC-030. Una segunda maquetación tendría además una
 * segunda caja que mantener, y la caja —anchos, `min-width`, cómo encogen los campos— es
 * territorio de SPEC-040 (ADR-026): aquí no se declara ni un ancho.
 *
 * Lo único que cambia entre los dos modos:
 *
 *  - **el destino**: `watchAction` (alta) o `editZonesAction` (edición, SPEC-044);
 *  - **el buscador**: en edición **no se monta**. El activo se muestra identificado —
 *    ticker y mercado— y no se puede cambiar: la identidad es `(userId, symbolId)` y
 *    cambiar el símbolo sería otra vigilada (ADR-028 pto. 8). La action ni siquiera
 *    acepta símbolo;
 *  - **los valores iniciales**: en edición los cuatro campos vienen precargados con lo
 *    vigente. Una zona sin definir aparece **vacía**, no con `0` — `0` es un número que
 *    el usuario no escribió, y vaciar una zona es una edición válida (CA-2/RN-10);
 *  - **qué pasa al terminar**: el alta se limpia y se queda lista para otra; la edición
 *    avisa a quien la abrió para que cierre el panel (CA-21). Con error, ninguno de los
 *    dos se cierra: el mensaje quedaría escondido.
 */

/** Los datos de la vigilada que se está editando, más el aviso de "ya está" (CA-21). */
export interface EdicionVigilada {
  id: string;
  ticker: string;
  micCode: string | null;
  buyMin: string | null;
  buyMax: string | null;
  sellMin: string | null;
  sellMax: string | null;
  onGuardado: () => void;
  onCancelar: () => void;
}

/** Una zona sin definir se pinta VACÍA; nunca `0` (CA-19). */
const valor = (v: string | null | undefined) => v ?? '';

type Zonas = Record<'buyMin' | 'buyMax' | 'sellMin' | 'sellMax', string>;

const CAMPOS_VACIOS: Zonas = { buyMin: '', buyMax: '', sellMin: '', sellMax: '' };

export function WatchForm({ edicion }: { edicion?: EdicionVigilada } = {}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    edicion ? editZonesAction : watchAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  /*
    Los cuatro campos son CONTROLADOS, y esto no es estilo: es CA-21. React reinicia el
    formulario después de ejecutar su `action`, así que con campos no controlados un
    error de validación devolvía el panel a los valores guardados y **borraba lo que el
    usuario acababa de escribir** — con el mensaje delante diciéndole que lo corrigiera.
    Medido con «40 / 10»: el panel volvía a «12 / 14». Controlados, el reinicio del DOM no
    los toca y sigue mandando el estado.
  */
  const [zonas, setZonas] = useState<Zonas>(() =>
    edicion
      ? {
          buyMin: valor(edicion.buyMin),
          buyMax: valor(edicion.buyMax),
          sellMin: valor(edicion.sellMin),
          sellMax: valor(edicion.sellMax),
        }
      : CAMPOS_VACIOS,
  );
  const escribir = (campo: keyof Zonas) => (e: { target: { value: string } }) =>
    setZonas((z) => ({ ...z, [campo]: e.target.value }));

  // Tras un alta con éxito, deja el formulario listo para otra: limpia zonas y remonta el
  // buscador con una key nueva para vaciar su selección (V-SPEC-008-1).
  const [pickerKey, setPickerKey] = useState(0);
  // El manejador de cierre cambia de identidad en cada render del padre; guardarlo en una
  // ref evita que el efecto dependa de él y se dispare por un repintado ajeno.
  const alGuardar = useRef(edicion?.onGuardado);
  alGuardar.current = edicion?.onGuardado;

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      if (alGuardar.current) {
        alGuardar.current(); // CA-21: guardar cierra el panel.
        return;
      }
      formRef.current?.reset();
      setZonas(CAMPOS_VACIOS);
      setPickerKey((k) => k + 1);
    }
  }, [state]);

  return (
    /*
      SPEC-040 CA-1: la fila `min` / `max` era un `style` en línea
      (`display: flex; gap: 8`), y ahí no hay dónde declarar que sus dos `<input>`
      pueden encoger. Cada campo imponía su mínimo intrínseco —218 px con la
      tipografía de la app— y la fila entera medía 444 px dentro de una columna de
      320, sacando de la pantalla el buscador y el botón «Vigilar» sin que se notara.
      Ahora es `.zona-campos`, una clase de la app que declara eje, reparto y
      `min-width` (ADR-026 §5).
    */
    <form
      ref={formRef}
      action={action}
      className="card auth-form"
      data-testid={edicion ? 'editar-form' : 'alta-form'}
    >
      {edicion ? (
        <>
          <strong>Editar zonas</strong>
          {/* Viaja el id de la ACCIÓN VIGILADA, como en la baja: con el mismo ticker en
              dos mercados, el ticker no identifica nada (ADR-007). */}
          <input type="hidden" name="watchedId" value={edicion.id} />
          <p className="muted" data-testid="editar-activo">
            <span className="ticker">{edicion.ticker}</span>
            {marketName(edicion.micCode) !== '' && ` · ${marketName(edicion.micCode)}`}
          </p>
        </>
      ) : (
        <>
          <strong>Vigilar una acción</strong>
          <SymbolSearch key={pickerKey} helpText="Elige la acción y su mercado para vigilarla." />
        </>
      )}
      <label>
        Zona de compra (min / max)
        <span className="zona-campos">
          <input
            name="buyMin"
            inputMode="decimal"
            placeholder="min"
            value={zonas.buyMin}
            onChange={escribir('buyMin')}
          />
          <input
            name="buyMax"
            inputMode="decimal"
            placeholder="max"
            value={zonas.buyMax}
            onChange={escribir('buyMax')}
          />
        </span>
      </label>
      <label>
        Zona de venta (min / max)
        <span className="zona-campos">
          <input
            name="sellMin"
            inputMode="decimal"
            placeholder="min"
            value={zonas.sellMin}
            onChange={escribir('sellMin')}
          />
          <input
            name="sellMax"
            inputMode="decimal"
            placeholder="max"
            value={zonas.sellMax}
            onChange={escribir('sellMax')}
          />
        </span>
      </label>
      {state && 'error' in state ? (
        <p className="auth-error" data-testid="editar-error">
          {state.error}
        </p>
      ) : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : edicion ? 'Guardar zonas' : 'Vigilar'}
      </button>
      {edicion && (
        <button
          className="btn-sm"
          type="button"
          data-testid="editar-cancelar"
          onClick={edicion.onCancelar}
        >
          Cancelar
        </button>
      )}
    </form>
  );
}
