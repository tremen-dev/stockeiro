'use client';

import { useActionState } from 'react';
import { addBuyAction, addSellAction, type FormState } from './actions';

function fields() {
  return (
    <>
      <label>
        Ticker
        <input name="ticker" required placeholder="ITX" />
      </label>
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
      <input type="hidden" name="currency" value="EUR" />
    </>
  );
}

export function BuyForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addBuyAction, undefined);
  return (
    <form action={action} className="card auth-form">
      <strong>Registrar compra</strong>
      {fields()}
      {state && 'error' in state ? <p className="auth-error">{state.error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Comprar'}
      </button>
    </form>
  );
}

export function SellForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addSellAction, undefined);
  return (
    <form action={action} className="card auth-form">
      <strong>Registrar venta</strong>
      {fields()}
      {state && 'error' in state ? <p className="auth-error">{state.error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Vender'}
      </button>
    </form>
  );
}
