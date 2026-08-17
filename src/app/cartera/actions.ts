'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { recordBuy, recordSell, NoPositionError } from '@/lib/portfolio/service';
import { OversellError } from '@/lib/portfolio/position';
import { readSymbolSelection } from '@/lib/market/symbol-selection';

export type FormState = { error: string } | { ok: true } | undefined;

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('No autenticado');
  return session.user.id;
}

/** Importe y fecha, comunes a compra y venta. El símbolo va aparte en cada una. */
function readCommon(formData: FormData) {
  return {
    quantity: String(formData.get('quantity') ?? '').trim(),
    price: String(formData.get('price') ?? '').trim(),
    gastos: String(formData.get('gastos') ?? '').trim() || null,
    occurredOn: String(formData.get('occurredOn') ?? '').trim(),
  };
}

/** Registrar compra (CA-1/CA-2). El símbolo se elige del buscador (SPEC-008). */
export async function addBuyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const c = readCommon(formData);
  const selection = readSymbolSelection(formData);
  if (!selection) return { error: 'Busca y elige una acción de la lista.' };
  if (!c.quantity || !c.price || !c.occurredOn) {
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
  } catch {
    return { error: 'Datos inválidos.' };
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
  const c = readCommon(formData);
  const symbolId = String(formData.get('symbolId') ?? '').trim();
  if (!symbolId) return { error: 'Elige la posición que vendes.' };
  if (!c.quantity || !c.price || !c.occurredOn) {
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
    if (e instanceof OversellError) return { error: 'No puedes vender más de lo que tienes.' };
    if (e instanceof NoPositionError) return { error: 'No tienes posición en ese valor.' };
    return { error: 'Datos inválidos.' };
  }
  revalidatePath('/cartera');
  return { ok: true };
}
