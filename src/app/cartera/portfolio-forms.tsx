'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { addBuyAction, addSellAction, type FormState } from './actions';
import { SymbolSearch } from '@/app/_components/symbol-search';
import type { PositionView } from '@/lib/portfolio/service';

/** Campos comunes de importe/fecha (sin el símbolo, que va aparte). */
function amountFields() {
  return (
    <>
      <label>
        Cantidad
        <input name="quantity" required inputMode="decimal" placeholder="10" />
      </label>
      <label>
        Precio
        <input name="price" required inputMode="decimal" placeholder="100" />
      </label>
      <label>
        Gastos (opcional)
        <input name="gastos" inputMode="decimal" placeholder="0" />
      </label>
      <label>
        Fecha
        <input name="occurredOn" type="date" required />
      </label>
    </>
  );
}

/** Compra: se elige la acción por nombre desde el buscador (SPEC-008). */
export function BuyForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addBuyAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // Tras una compra con éxito, deja el formulario listo para otra (V-SPEC-008-1).
  const [pickerKey, setPickerKey] = useState(0);
  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      formRef.current?.reset();
      setPickerKey((k) => k + 1);
    }
  }, [state]);
  return (
    <form ref={formRef} action={action} className="card auth-form">
      <strong>Registrar compra</strong>
      <SymbolSearch key={pickerKey} helpText="Elige la acción y su mercado; la divisa se toma de ahí." />
      {amountFields()}
      {state && 'error' in state ? <p className="auth-error">{state.error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Comprar'}
      </button>
    </form>
  );
}

/**
 * Etiqueta distinguible de una posición (SPEC-025 CA-8): ticker + mercado + divisa.
 * Con el mismo ticker en dos mercados, "SAN" y "SAN" no dicen nada; "SAN · NYSE (USD)"
 * sí. `exchange`/`micCode` faltan en los símbolos legacy (ADR-007): entonces la divisa
 * es lo único que hay, y basta porque en ese caso solo hay una posición por ticker.
 */
function positionLabel(p: PositionView): string {
  const mercado = p.exchange ?? p.micCode;
  return `${p.ticker}${mercado ? ` · ${mercado}` : ''} (${p.currency}) — ${p.cantidadViva} uds.`;
}

/**
 * Venta: opera sobre una posición YA existente, así que se ELIGE de la lista de
 * posiciones abiertas en vez de teclear un ticker (SPEC-025 CA-8). Lo que viaja es el
 * `symbolId`, la identidad del símbolo (ADR-007): un ticker no distingue el mercado, y
 * sin mercado la venta caía —en silencio— en la otra posición y en otra divisa (RN-09).
 *
 * Solo posiciones con cantidad viva > 0: vender una cerrada es sobreventa por
 * definición (RN-08).
 */
export function SellForm({ positions }: { positions: PositionView[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addSellAction, undefined);
  const abiertas = positions.filter((p) => p.isOpen);

  if (abiertas.length === 0) {
    return (
      <div className="card auth-form">
        <strong>Registrar venta</strong>
        <p>No tienes ninguna posición abierta que vender. Registra antes una compra.</p>
      </div>
    );
  }

  return (
    <form action={action} className="card auth-form">
      <strong>Registrar venta</strong>
      <label>
        Posición
        <select name="symbolId" required defaultValue={abiertas[0].symbolId}>
          {abiertas.map((p) => (
            <option key={p.symbolId} value={p.symbolId}>
              {positionLabel(p)}
            </option>
          ))}
        </select>
      </label>
      {amountFields()}
      {state && 'error' in state ? <p className="auth-error">{state.error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Vender'}
      </button>
    </form>
  );
}
