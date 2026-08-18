'use server';

import type { Decimal } from 'decimal.js';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { recordBuy, recordSell } from '@/lib/portfolio/service';
import { readSymbolSelection } from '@/lib/market/symbol-selection';
import { readDecimalField } from '@/lib/format/decimal-input';
import { toFormError } from '@/lib/format/action-error';

export type FormState = { error: string } | { ok: true } | undefined;

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('No autenticado');
  return session.user.id;
}

interface CommonInput {
  quantity: Decimal | null;
  price: Decimal | null;
  gastos: Decimal | null;
  occurredOn: string;
}

/**
 * Importe y fecha, comunes a compra y venta. El símbolo va aparte en cada una.
 *
 * Los tres importes pasan por la única puerta de entrada numérica (SPEC-030 CA-13), que
 * entiende la coma decimal y lanza `InvalidNumberError` con el campo y el valor cuando no
 * entiende lo escrito. `gastos` es opcional: vacío es ausencia, no error (CA-9).
 */
function readCommon(formData: FormData): CommonInput {
  return {
    quantity: readDecimalField(formData, 'quantity'),
    price: readDecimalField(formData, 'price'),
    gastos: readDecimalField(formData, 'gastos'),
    occurredOn: String(formData.get('occurredOn') ?? '').trim(),
  };
}

/** Registrar compra (CA-1/CA-2). El símbolo se elige del buscador (SPEC-008). */
export async function addBuyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const selection = readSymbolSelection(formData);
  if (!selection) return { error: 'Busca y elige una acción de la lista.' };

  // SPEC-030: normalizar ANTES del try del servicio (ver vigiladas/actions.ts).
  let c: CommonInput;
  try {
    c = readCommon(formData);
  } catch (e) {
    return toFormError('comprar', e);
  }
  if (c.quantity === null || c.price === null || !c.occurredOn) {
    return { error: 'Rellena cantidad, precio y fecha.' };
  }

  try {
    await recordBuy(
      db,
      userId,
      selection.ticker,
      selection.currency,
      { quantity: c.quantity, price: c.price, gastos: c.gastos, occurredOn: c.occurredOn },
      selection.market,
    );
  } catch (e) {
    return toFormError('comprar', e);
  }
  revalidatePath('/cartera');
  return { ok: true };
}

/**
 * Registrar venta (CA-3/CA-4). Rechaza sobreventa (CA-5).
 *
 * SPEC-025 CA-8: lo que llega del formulario es el `symbolId` de la posición elegida
 * (ADR-007), no un ticker: el ticker no distingue el mercado y la venta acababa en la
 * posición equivocada. El aislamiento lo hace `recordSell` con el `userId` dentro de
 * la consulta (RN-01), no esta capa.
 */
export async function addSellAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const symbolId = String(formData.get('symbolId') ?? '').trim();
  if (!symbolId) return { error: 'Elige la posición que vendes.' };

  let c: CommonInput;
  try {
    c = readCommon(formData);
  } catch (e) {
    return toFormError('vender', e);
  }
  if (c.quantity === null || c.price === null || !c.occurredOn) {
    return { error: 'Rellena cantidad, precio y fecha.' };
  }

  try {
    await recordSell(db, userId, symbolId, {
      quantity: c.quantity,
      price: c.price,
      gastos: c.gastos,
      occurredOn: c.occurredOn,
    });
  } catch (e) {
    return toFormError('vender', e);
  }
  revalidatePath('/cartera');
  return { ok: true };
}
