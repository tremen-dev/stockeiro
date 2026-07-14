'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { watchAction, type FormState } from './actions';
import { SymbolSearch } from '@/app/_components/symbol-search';

export function WatchForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(watchAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // Tras un alta con éxito, deja el formulario listo para otra: limpia zonas (form.reset)
  // y remonta el buscador con una key nueva para vaciar su selección (V-SPEC-008-1).
  const [pickerKey, setPickerKey] = useState(0);
  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      formRef.current?.reset();
      setPickerKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card auth-form">
      <strong>Vigilar una acción</strong>
      <SymbolSearch key={pickerKey} helpText="Elige la acción y su mercado para vigilarla." />
      <label>
        Zona de compra (min / max)
        <span style={{ display: 'flex', gap: 8 }}>
          <input name="buyMin" inputMode="decimal" placeholder="min" />
          <input name="buyMax" inputMode="decimal" placeholder="max" />
        </span>
      </label>
      <label>
        Zona de venta (min / max)
        <span style={{ display: 'flex', gap: 8 }}>
          <input name="sellMin" inputMode="decimal" placeholder="min" />
          <input name="sellMax" inputMode="decimal" placeholder="max" />
        </span>
      </label>
      {state && 'error' in state ? <p className="auth-error">{state.error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Vigilar'}
      </button>
    </form>
  );
}
