'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { addBuyAction, addSellAction, type FormState } from './actions';
import { SymbolSearch } from '@/app/_components/symbol-search';

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
 * Venta: opera sobre una posición YA existente, así que se identifica por su ticker
 * (no re-busca). La divisa y el mercado ya están fijados por la compra.
 */
export function SellForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addSellAction, undefined);
  return (
    <form action={action} className="card auth-form">
      <strong>Registrar venta</strong>
      <label>
        Ticker
        <input name="ticker" required placeholder="ITX" />
      </label>
      {amountFields()}
      {state && 'error' in state ? <p className="auth-error">{state.error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Vender'}
      </button>
    </form>
  );
}
